// Canasta SV · búsqueda en vivo (Cloudflare Worker)
// Recibe ?q=producto, consulta ESA búsqueda en cada tienda (una petición por tienda, sin descargar catálogos)
// y devuelve los resultados en JSON. Guarda cada consulta 10 minutos en caché para no repetir peticiones.
const UA = "CanastaSV/1.0 (comparador de precios sin fines de lucro)";
const MAX = 12; // resultados por tienda

// ---- tamaños (misma lógica que scraper/normalizar.mjs) ----
const RE = /(?<![\d.,])(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|kilos?|grs?|gramos?|g|mg|lbs?|libras?|oz|ml|lts?|litros?|l|gal(?:on(?:es)?)?)(?![a-z])/i;
const RE_UD = /(\d+)\s*(unidades|und|uds?|pzas?|piezas|tabletas|capsulas|cápsulas|tabs?|caps?)(?![a-z])/i;
const limpia = t => (t || "")
  .replace(/(\d{1,3})\s(\d{3})(?=\s*(?:g|gr|grs|gramos|ml)(?![a-z]))/gi, "$1$2")
  .replace(/(\d{1,3})\s(\d{3})(?=\s*(?:kg|kilos?|lts?|litros?|l)(?![a-z]))/gi, "$1.$2").replace(/\s+/g, " ");
function conv(v, u) {
  u = u.toLowerCase();
  if (/^(kg|kilos?)$/.test(u)) return v > 60 ? { q: v, u: "g" } : { q: v * 1000, u: "g" };
  if (/^(g|grs?|gramos?)$/.test(u)) return { q: v, u: "g" };
  if (/^(lbs?|libras?)$/.test(u)) return { q: v * 453.592, u: "g" };
  if (u === "oz") return { q: v * 28.3495, u: "g" };
  if (/^(l|lts?|litros?)$/.test(u)) return v > 50 ? { q: v, u: "ml" } : { q: v * 1000, u: "ml" };
  if (u === "ml") return { q: v, u: "ml" };
  if (/^gal/.test(u)) return { q: v * 3785.41, u: "ml" };
  return null; // mg: concentración de medicamentos, no tamaño de empaque
}
function tamano(nombre) {
  const t = limpia(nombre);
  for (const m of t.matchAll(new RegExp(RE.source, "gi"))) {
    const c = conv(parseFloat(m[2].replace(",", ".")), m[3]);
    if (c) return { q: Math.round(c.q * (m[1] ? +m[1] : 1)), u: c.u };
  }
  if (/docena/i.test(t)) return { q: 12, u: "ud" };
  const ud = t.match(RE_UD);
  return ud ? { q: +ud[1], u: "ud" } : null;
}
function porUnidad(precio, tam) {
  if (!tam) return {};
  const [pu, pl] = tam.u === "g" ? [precio / (tam.q / 453.592), "lb"] : tam.u === "ml" ? [precio / (tam.q / 1000), "L"] : [precio / tam.q, "ud"];
  return { pu: +pu.toFixed(3), pl };
}
const fila = (tienda, x) => {
  const tam = tamano(x.nombre);
  return { tienda, ...x, q: tam?.q ?? null, u: tam?.u ?? null, ...porUnidad(x.precio, tam) };
};

// ---- utilidades de HTML ----
const ENT = { amp: "&", quot: '"', lt: "<", gt: ">", nbsp: " ", apos: "'" };
const deco = s => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? m));
const texto = h => deco(h.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const sinAcento = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

async function pedir(url, accept) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept }, signal: c.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r;
  } finally { clearTimeout(t); }
}

// ---- tiendas: cada una recibe el texto buscado y devuelve [{id,nombre,marca,precio,url}] ----
async function walmart(q) {
  const base = "https://www.walmart.com.sv";
  const r = await pedir(`${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=${MAX - 1}`, "application/json");
  const out = [];
  for (const it of await r.json()) {
    const o = it.items?.[0]?.sellers?.[0]?.commertialOffer;
    if (!o || !(o.Price > 0) || !(o.AvailableQuantity > 0)) continue;
    out.push({ id: String(it.productId), nombre: it.productName, marca: it.brand || "", precio: o.Price, url: it.link || `${base}/${it.linkText}/p` });
  }
  return out;
}

async function selectos(q) {
  const SS = "https://www.superselectos.com";
  const html = await (await pedir(`${SS}/products?keyword=${encodeURIComponent(q)}`, "text/html")).text();
  // marcas: el filtro "Marcas" de la página lista las de estos resultados
  const hit = html.match(/>\s*Marcas\s*</i);
  const fin = html.search(/<h1[\s>]/i);
  const marcas = !hit ? [] : html.slice(hit.index + 1, fin > hit.index ? fin : hit.index + 20000).split(/<[^>]*>/)
    .map(x => deco(x).replace(/\s+/g, " ").trim())
    .filter(x => x.length >= 3 && x.length <= 30 && /[a-zñ]/i.test(x) && !/[$\d]/.test(x) &&
      !/^(marcas|close|filter_list|filtros|mas filtros|ofertas.*|rango.*|categor.*)$/i.test(x))
    .sort((a, b) => b.length - a.length);
  const marcaDe = n => { const s = ` ${sinAcento(n).replace(/[^a-z0-9ñ]+/g, " ")} `;
    return marcas.find(m => s.includes(` ${sinAcento(m).replace(/[^a-z0-9ñ]+/g, " ")} `)) || ""; };

  const h = fin >= 0 ? html.slice(fin) : html;      // la lista real va después del título "Resultado…"
  const re = /<a\b[^>]*href="([^"]*productId=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const out = []; let ult = 0, m;
  while ((m = re.exec(h)) && out.length < MAX) {
    const nombre = texto(m[3]);
    if (nombre.length < 3) continue;                // enlace de la imagen
    const antes = texto(h.slice(ult, m.index)).replace(/Seleccione\s*\d+\s*X\s*\$\s*[\d.,]+/gi, "");
    ult = m.index + m[0].length;
    const pr = antes.match(/\$\s*(\d{1,3}(?:,\d{3})*\.\d{2})/);
    if (!pr) continue;
    const href = deco(m[1]);
    out.push({ id: m[2], nombre, marca: marcaDe(nombre), precio: parseFloat(pr[1].replace(",", "")),
               url: href.startsWith("http") ? href : SS + (href.startsWith("/") ? "" : "/") + href });
  }
  return out;
}

// Para agregar una farmacia u otra tienda: escribe una función igual a las de arriba y agrégala aquí.
const TIENDAS = { "Walmart": walmart, "Super Selectos": selectos };

// ---- servidor ----
export default {
  async fetch(req, env, ctx) {
    const permitido = env.ORIGEN_PERMITIDO || "*";   // en Cloudflare: Settings → Variables → ORIGEN_PERMITIDO
    const origen = req.headers.get("Origin");
    const cors = { "access-control-allow-origin": permitido === "*" ? "*" : permitido, "vary": "Origin" };
    const salida = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj),
      { status, headers: { "content-type": "application/json; charset=utf-8", ...cors, ...extra } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET" } });
    if (permitido !== "*" && origen && origen !== permitido) return salida({ error: "Origen no permitido" }, 403);

    const q = (new URL(req.url).searchParams.get("q") || "").replace(/\s+/g, " ").trim();
    if (q.length < 2 || q.length > 60) return salida({ error: "Escribe entre 2 y 60 caracteres." }, 400);

    const hayCache = typeof caches !== "undefined";
    const llave = new Request("https://canasta.cache/" + encodeURIComponent(sinAcento(q)));
    if (hayCache) { const hit = await caches.default.match(llave); if (hit) return salida(await hit.json(), 200, { "x-cache": "HIT" }); }

    const nombres = Object.keys(TIENDAS);
    const res = await Promise.allSettled(nombres.map(n => TIENDAS[n](q)));
    const tiendas = {}, resultados = [];
    res.forEach((r, i) => {
      if (r.status === "fulfilled") { tiendas[nombres[i]] = { ok: true, n: r.value.length }; r.value.forEach(x => resultados.push(fila(nombres[i], x))); }
      else tiendas[nombres[i]] = { ok: false, error: String(r.reason?.message || r.reason).slice(0, 80) };
    });
    const cuerpo = { q, generado: new Date().toISOString(), tiendas, resultados };
    if (hayCache && resultados.length) ctx.waitUntil(caches.default.put(llave,
      new Response(JSON.stringify(cuerpo), { headers: { "content-type": "application/json", "cache-control": "max-age=600" } })));
    return salida(cuerpo, 200, { "x-cache": "MISS" });
  }
};

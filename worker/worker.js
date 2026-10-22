// Canasta SV · búsqueda en vivo (Cloudflare Worker)
// Recibe ?q=producto, consulta ESA búsqueda en cada tienda (una petición por tienda, sin descargar catálogos)
// y devuelve los resultados en JSON. Guarda cada consulta 10 minutos en caché para no repetir peticiones.
const UA = "CanastaSV/1.0 (comparador de precios sin fines de lucro)";
const MAX = 12; // resultados por tienda
const VERSION = "2026-10-22-a"; // aparece en cada respuesta: sirve para saber qué código está desplegado

// ---- tamaños (misma lógica que scraper/normalizar.mjs) ----
const RE = /(?<![\d.,])(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|kilos?|grs?|gramos?|g|mg|lbs?|libras?|floz|onzas?|oz|ml|lts?|litros?|l|gal(?:on(?:es)?)?)(?![a-z])/i;
const RE_UD = /(\d+)\s*(unidades|und|uds?|pzas?|piezas|tabletas|capsulas|cápsulas|tabs?|caps?)(?![a-z])/i;
const limpia = t => (t || "")
  // Onza líquida («fl oz», «fl. oz», «onzas líquidas», «oz líq») → «floz», que se convierte a ml; «oz» u «onzas» solas son de peso
  .replace(/(\d+(?:[.,]\d+)?)\s*(?:fl\.?\s*oz\.?|onzas?\s+l[ií]quidas?|oz\.?\s*l[ií]q(?:uidas?)?\.?)(?![a-z])/gi, "$1 floz")
  .replace(/(?<![\w.,])(\d{1,3})\s(\d{3})(?=\s*(?:g|gr|grs|gramos|ml)(?![a-z]))/gi, "$1$2")
  .replace(/(?<![\w.,])(\d{1,3})\s(\d{3})(?=\s*(?:kg|kilos?|lts?|litros?|l)(?![a-z]))/gi, "$1.$2").replace(/\s+/g, " ");
function conv(v, u) {
  u = u.toLowerCase();
  if (/^(kg|kilos?)$/.test(u)) return v > 60 ? { q: v, u: "g" } : { q: v * 1000, u: "g" };
  if (/^(g|grs?|gramos?)$/.test(u)) return { q: v, u: "g" };
  if (/^(lbs?|libras?)$/.test(u)) return { q: v * 453.592, u: "g" };
  if (/^(oz|onzas?)$/.test(u)) return { q: v * 28.3495, u: "g" };           // onza de peso
  if (u === "floz") return { q: v * 29.5735, u: "ml" };                    // onza líquida
  if (/^(l|lts?|litros?)$/.test(u)) return v > 50 ? { q: v, u: "ml" } : { q: v * 1000, u: "ml" };
  if (u === "ml") return { q: v, u: "ml" };
  if (/^gal/.test(u)) return { q: v * 3785.41, u: "ml" };
  return null; // mg: concentración de medicamentos, no tamaño de empaque
}
function tamano(nombre) {
  const t = limpia(nombre).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mp = t.match(/(\d+)\s*(?:unidades|unidad|uds?|und)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(kg|kilos?|grs?|gramos?|g|lbs?|libras?|floz|onzas?|oz|ml|lts?|litros?|l)(?![a-z])/i);
  if (mp) { const c = conv(parseFloat(mp[2].replace(",", ".")), mp[3]); if (c) return { q: Math.round(c.q * +mp[1]), u: c.u }; }
  for (const m of t.matchAll(new RegExp(RE.source, "gi"))) {
    const c = conv(parseFloat(m[2].replace(",", ".")), m[3]);
    if (c) {
      let q = c.q * (m[1] ? +m[1] : 1);
      const pk = t.slice(m.index + m[0].length).match(/(\d+)\s*pack\b/i); // "250 mL 6 Pack" = 6 envases
      if (pk && !m[1]) q *= +pk[1];
      return { q: Math.round(q), u: c.u };
    }
  }
  if (/\bgalon\b/i.test(t)) return { q: 3785, u: "ml" };
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
// Selectos y Maxi no encuentran nada con acentos («atún» → 0, «atun» → resultados). Se quitan tildes y se conserva la ñ.
const sinTilde = s => s.normalize("NFD").replace(/[\u0300-\u0302\u0304-\u036f]/g, "").normalize("NFC");
// Promociones por cantidad con texto claro: «2 x $2.20», «Seleccione 2X$0.90», «3x2». Otras no se interpretan.
const PROMO = /^(?:seleccione\s+)?\d+\s*[x×]\s*(?:\$\s*\d+(?:[.,]\d{1,2})?|\d+)$/i;
const promoDe = textos => textos.map(t => String(t || "").replace(/\s+/g, " ").trim()).find(t => PROMO.test(t)) || null;
// Walmart, Maxi y Despensa de Don Juan publican sus ofertas con nombres internos (verificado el 2026-10-21):
//   «Promo,1.1x2,2026-09-17-2026-12-31-… TYPE_PROMO_GPP»            = $1.10 c/u llevando 2 → «2 x $2.20»
//   «PromoCombinaEnFijo,0.5x3,2026-10-05-2027-01-05-… TYPE_PROMO_CMF» = 3 por $1.50 (la tienda deja combinar
//   productos de la promoción; aquí solo se aplica al mismo producto). Fuera de sus fechas no valen.
function promoVtex(t, hoy) {
  const nombre = t.Name ?? t["<Name>k__BackingField"];
  const cond = t.Conditions ?? t["<Conditions>k__BackingField"] ?? {};
  const minimo = cond.MinimumQuantity ?? cond["<MinimumQuantity>k__BackingField"];
  const m = String(nombre || "").match(/^Promo(?:CombinaEnFijo)?,(\d+(?:\.\d+)?)x(\d+),(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})/);
  if (!m) return promoDe([nombre]);
  const n = +m[2];
  if (n < 2 || (minimo != null && +minimo !== n) || hoy < m[3] || hoy > m[4]) return null;
  return `${n} x $${(Math.round(+m[1] * n * 100) / 100).toFixed(2)}`;
}

async function pedir(url, accept, init = {}) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(url, { method: init.method, body: init.body, headers: { "user-agent": UA, accept, ...(init.headers || {}) }, signal: c.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r;
  } finally { clearTimeout(t); }
}

// ---- tiendas: cada una recibe el texto buscado y devuelve [{id,nombre,marca,precio,url}] ----
const vtex = base => async q => {
  const r = await pedir(`${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(sinTilde(q))}&_from=0&_to=${MAX - 1}`, "application/json");
  const out = [], hoy = new Date(Date.now() - 6 * 36e5).toISOString().slice(0, 10);   // fecha de El Salvador (UTC−6)
  for (const it of await r.json()) {
    const o = it.items?.[0]?.sellers?.[0]?.commertialOffer;
    if (!o || !(o.Price > 0) || !(o.AvailableQuantity > 0)) continue;
    const promo = [...(o.PromotionTeasers || []), ...(o.Teasers || [])].map(t => promoVtex(t || {}, hoy)).find(Boolean) || null;
    out.push({ id: String(it.productId), nombre: it.productName, marca: it.brand || "", precio: o.Price, url: it.link || `${base}/${it.linkText}/p`,
      promo, antes: o.ListPrice > o.Price ? o.ListPrice : null });
  }
  return out;
};

// Selectos marca muchas ofertas con una imagen tipoPromoMM/<código>.png. Significado tomado de los filtros
// oficiales de /special-deals (verificado el 2026-10-21): el orden de los números no es siempre el mismo.
const PROMO_SELECTOS = { "2-1": "2x1", "2-3": "3x2", "3-4": "4x3", "4-5": "5x4", "4-6": "6x4", "5-6": "6x5", "6-7": "7x6", "8-12": "12x8",
  "2-40": "Segundo al 40%", "2-50": "Segundo al 50%", "2-75": "Segundo al 75%" };   // COMBO y «otras» no dicen cuánto se paga

async function selectos(q) {
  const SS = "https://www.superselectos.com";
  const html = await (await pedir(`${SS}/products?keyword=${encodeURIComponent(sinTilde(q))}`, "text/html")).text();
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
    const crudo = h.slice(ult, m.index), tramo = texto(crudo), oferta = tramo.match(/Seleccione\s*\d+\s*X\s*\$\s*[\d.,]*\d/i);
    const imagen = [...crudo.matchAll(/tipoPromoMM\/(\d+-\d+)\.png/gi)].at(-1)?.[1];   // la de este producto, junto a su nombre
    const antes = tramo.replace(/Seleccione\s*\d+\s*X\s*\$\s*[\d.,]+/gi, "");
    ult = m.index + m[0].length;
    const pr = antes.match(/\$\s*(\d{1,3}(?:,\d{3})*\.\d{2})/);
    if (!pr) continue;
    const href = deco(m[1]);
    out.push({ id: m[2], nombre, marca: marcaDe(nombre), precio: parseFloat(pr[1].replace(",", "")), promo: promoDe([oferta?.[0]]) || PROMO_SELECTOS[imagen] || null,
               url: href.startsWith("http") ? href : SS + (href.startsWith("/") ? "" : "/") + href });
  }
  return out;
}

// PriceSmart: usa un buscador externo (Bloomreach). La clave pública del sitio va en la variable PRICESMART_KEY del Worker.
// Solo para consultas puntuales (búsqueda en vivo). Si responde 403, no se insiste ni se disimula el origen.
async function pricesmart(q, env) {
  const pagina = `https://www.pricesmart.com/es-sv/busqueda?q=${encodeURIComponent(q)}`;
  const cuerpo = [{ account_id: "7024", auth_key: env.PRICESMART_KEY, domain_key: "pricesmart_bloomreach_io_es",
    fl: "pid,title,brand,slug,currency,fractionDigits,availability_SV,price_SV,inventory_SV",
    fq: [], q, request_id: Date.now(), rows: MAX, search_type: "keyword", start: 0, url: pagina, view_id: "SV" }];
  const r = await pedir("https://www.pricesmart.com/api/br_discovery/getProductsByKeyword", "application/json",
    { method: "POST", body: JSON.stringify(cuerpo), headers: { "content-type": "application/json" } });
  const j = await r.json(), o = Array.isArray(j) ? j[0] : j;
  return (o?.response?.docs || [])
    .filter(d => String(d.availability_SV) === "true" && Number(d.price_SV) > 0)
    .map(d => ({ id: String(d.pid), nombre: d.title, marca: d.brand || "", precio: Number(d.price_SV) / 10 ** (d.fractionDigits ?? 2), url: pagina }));
}

// Superea: su propio buscador usa Algolia con la clave pública de solo búsqueda que el sitio entrega a todo visitante.
// Bodega 1 es la que el sitio usa cuando no hay dirección elegida; el tamaño viene aparte en "grammage".
const SUPEREA = { app: "0L9N281WRT", clave: "6d8f296718166bdcfd63f9983931d63d", indice: "prod_SV_articles", bodega: 1 };
async function superea(q) {
  const p = new URLSearchParams({ query: q, hitsPerPage: String(MAX), filters: `visible_in_wh_ids:${SUPEREA.bodega}`,
    attributesToRetrieve: "id,name,slug,brand_name,final_price,available_balance,is_always_available,grammage" });
  const r = await pedir(`https://${SUPEREA.app.toLowerCase()}-dsn.algolia.net/1/indexes/${SUPEREA.indice}?${p}`, "application/json",
    { headers: { "x-algolia-application-id": SUPEREA.app, "x-algolia-api-key": SUPEREA.clave } });
  return ((await r.json()).hits || [])
    .filter(h => Number(h.final_price) > 0 && (Number(h.is_always_available) === 1 || Number(h.available_balance) > 0) && h.slug)
    .map(h => ({ id: String(h.id ?? h.objectID), nombre: !tamano(h.name) && h.grammage ? `${h.name} ${h.grammage}` : h.name,
      marca: h.brand_name || "", precio: Number(h.final_price), url: `https://superea.sv/productos/${encodeURIComponent(h.slug)}` }));
}

// Para agregar una farmacia u otra tienda: escribe una función igual a las de arriba y agrégala aquí.
const TIENDAS = { "Walmart": vtex("https://www.walmart.com.sv"), "Despensa de Don Juan": vtex("https://www.ladespensadedonjuan.com.sv"),
  "Maxi Despensa": vtex("https://www.maxidespensa.com.sv"), "Super Selectos": selectos, "Superea": superea, "PriceSmart": pricesmart };

// ---- aportes: el sitio envía comparaciones confirmadas y se crea una issue en GitHub para revisarlas ----
const limpio = (t, n) => String(t ?? "").replace(/[\u0000-\u001f`<>@|\\\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
function validar(grupos) {
  if (!Array.isArray(grupos) || !grupos.length || grupos.length > 10) return null;
  const out = [];
  for (const g of grupos) {
    if (!Array.isArray(g) || g.length < 2 || g.length > 6) return null;
    const grp = [];
    for (const x of g) {
      if (!x || !Object.keys(TIENDAS).includes(x.tienda)) return null;
      const id = limpio(x.id, 40), url = /^https:\/\/[\w./?=&%:#~+-]{3,300}$/.test(x.url || "") ? x.url : "";
      if (!id && !url) return null;
      grp.push({ tienda: x.tienda, id, url, nombre: limpio(x.nombre, 150) });
    }
    out.push(grp);
  }
  return out;
}
async function aporte(req, env, ctx, salida) {
  if (!env.GITHUB_TOKEN_APORTES) return salida({ error: "Los aportes no están activados." }, 501);
  if (env.ORIGEN_PERMITIDO && env.ORIGEN_PERMITIDO !== "*" && req.headers.get("Origin") !== env.ORIGEN_PERMITIDO) return salida({ error: "Origen no permitido" }, 403);
  const texto = await req.text();
  if (texto.length > 20000) return salida({ error: "Aporte demasiado grande." }, 413);
  let grupos; try { grupos = validar(JSON.parse(texto)?.grupos); } catch { grupos = null; }
  if (!grupos) return salida({ error: "Formato de aporte no válido." }, 400);
  const llave = new Request("https://canasta.cache/aporte/" + (req.headers.get("CF-Connecting-IP") || "?"));
  const hayCache = typeof caches !== "undefined";
  if (hayCache && await caches.default.match(llave)) return salida({ error: "Espera unos minutos antes de enviar otro aporte." }, 429);
  const tabla = (g, i) => [`### Comparación ${i + 1}`, "", "| Tienda | Producto | Enlace |", "|---|---|---|",
    ...g.map(x => `| ${x.tienda} | ${x.nombre || x.id} | ${x.url ? `[ver producto](${x.url})` : "—"} |`), ""].join("\n");
  const cuerpo = ["Aporte enviado desde el sitio.", "",
    "**Para aplicarlo a la base:** revisa que cada tabla sea el mismo producto y agrega la etiqueta `aprobado`. **Para rechazarlo:** ciérralo como *not planned*.", "",
    ...grupos.map(tabla), "<details><summary>JSON (lo usa la automatización)</summary>", "", "```json", JSON.stringify(grupos, null, 1), "```", "", "</details>"].join("\n");
  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO || "ivancortez0908-eng/Precio_Canasta"}/issues`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN_APORTES}`, accept: "application/vnd.github+json", "user-agent": UA, "x-github-api-version": "2022-11-28", "content-type": "application/json" },
    body: JSON.stringify({ title: `Aporte de equivalencias (${grupos.length}) ${new Date().toISOString().slice(0, 10)}`, body: cuerpo })
  });
  if (!r.ok) return salida({ error: "GitHub respondió " + r.status }, 502);
  const i = await r.json();
  if (hayCache) ctx.waitUntil(caches.default.put(llave, new Response("1", { headers: { "cache-control": "max-age=600" } })));
  return salida({ ok: true, numero: i.number, url: i.html_url });
}

// ---- servidor ----
export default {
  async fetch(req, env, ctx) {
    const permitido = env.ORIGEN_PERMITIDO || "*";   // en Cloudflare: Settings → Variables → ORIGEN_PERMITIDO
    const origen = req.headers.get("Origin");
    const cors = { "access-control-allow-origin": permitido === "*" ? "*" : permitido, "vary": "Origin" };
    const salida = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj),
      { status, headers: { "content-type": "application/json; charset=utf-8", ...cors, ...extra } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type" } });
    if (permitido !== "*" && origen && origen !== permitido) return salida({ error: "Origen no permitido" }, 403);
    if (req.method === "POST") return aporte(req, env, ctx, salida);

    const q = (new URL(req.url).searchParams.get("q") || "").replace(/\s+/g, " ").trim();
    if (q.length < 2 || q.length > 60) return salida({ error: "Escribe entre 2 y 60 caracteres." }, 400);

    const solo = (new URL(req.url).searchParams.get("tiendas") || "").split(",").map(x => x.trim()).filter(Boolean);
    const nombres = Object.keys(TIENDAS).filter(n => (!solo.length || solo.includes(n)) && (n !== "PriceSmart" || env.PRICESMART_KEY));
    const fresco = new URL(req.url).searchParams.has("fresh");   // ?fresh=1 salta la caché (para diagnosticar)
    const hayCache = typeof caches !== "undefined";
    const llave = new Request("https://canasta.cache/" + encodeURIComponent(sinAcento(q)) + "/" + nombres.join(","));
    if (hayCache && !fresco) { const hit = await caches.default.match(llave); if (hit) return salida(await hit.json(), 200, { "x-cache": "HIT" }); }

    const res = await Promise.allSettled(nombres.map(async n => {
      const t0 = Date.now();
      try { return { v: await TIENDAS[n](q, env), ms: Date.now() - t0 }; }
      catch (e) { e.ms = Date.now() - t0; throw e; }
    }));
    const tiendas = {}, resultados = [];
    res.forEach((r, i) => {
      if (r.status === "fulfilled") { tiendas[nombres[i]] = { ok: true, n: r.value.v.length, ms: r.value.ms }; r.value.v.forEach(x => resultados.push(fila(nombres[i], x))); }
      else tiendas[nombres[i]] = { ok: false, error: String(r.reason?.message || r.reason).slice(0, 80), ms: r.reason?.ms };
    });
    const omitidas = Object.keys(TIENDAS).filter(n => !nombres.includes(n) && !solo.length).map(n => n + (n === "PriceSmart" ? " (falta la variable PRICESMART_KEY)" : ""));
    const cuerpo = { version: VERSION, q, generado: new Date().toISOString(), tiendas, omitidas, resultados };
    // Solo se guarda en caché si TODAS las tiendas respondieron: un fallo pasajero no debe repetirse 10 minutos
    if (hayCache && resultados.length && Object.values(tiendas).every(t => t.ok)) ctx.waitUntil(caches.default.put(llave,
      new Response(JSON.stringify(cuerpo), { headers: { "content-type": "application/json", "cache-control": "max-age=600" } })));
    return salida(cuerpo, 200, { "x-cache": "MISS", "x-version": VERSION });
  }
};

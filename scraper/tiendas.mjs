// Cada tienda con activa:true debe tener catalogo(): generador que entrega
// { id, nombre, marca, ean, precio, url, cat } por cada producto disponible.
import { readFile } from "node:fs/promises";
import { parseTamano } from "./normalizar.mjs";
const UA = "CanastaSV/1.0 (comparador de precios sin fines de lucro)";
const CANASTA = JSON.parse(await readFile(new URL("./canasta.json", import.meta.url), "utf8"));
const CONFIG_JS = await readFile(new URL("../config.js", import.meta.url), "utf8").catch(() => "");
let avisos = 0;
const esp = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  let ultimo = "sin respuesta";
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
      if (r.ok) return await r.json();
      ultimo = "HTTP " + r.status;
      if (r.status === 400 || r.status === 404) { if (avisos++ < 5) console.warn(`[HTTP ${r.status}] ${url.slice(0, 150)}`); return []; }
    } catch (e) { ultimo = e.message; }
    await esp(1500 * (i + 1));
  }
  throw new Error(`${ultimo} en ${url}`);
}

async function sondearProductos(base) {
  const probar = async (etiqueta, url) => {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
      const j = r.ok ? await r.json() : [];
      console.log(`[sonda] ${etiqueta}: HTTP ${r.status}, ${Array.isArray(j) ? j.length : "?"} resultados`);
      for (const it of (Array.isArray(j) ? j : []).slice(0, 2)) {
        const o = it.items?.[0]?.sellers?.[0]?.commertialOffer;
        console.log(`        "${it.productName}" marca=${it.brand} Price=${o?.Price} Disponible=${o?.AvailableQuantity} IsAvailable=${o?.IsAvailable} skus=${it.items?.length} vendedores=${it.items?.[0]?.sellers?.length}`);
      }
    } catch (e) { console.log(`[sonda] ${etiqueta}: error ${e.message}`); }
  };
  await probar("búsqueda ft=leche", `${base}/api/catalog_system/pub/products/search?ft=leche&_from=0&_to=4`);
  const arbol = await fetch(`${base}/api/catalog_system/pub/category/tree/3`, { headers: { "user-agent": UA } }).then(r => r.json()).catch(() => []);
  const h = hojas(arbol)[0];
  if (h) {
    await probar(`categoría ${h.nombre} con ruta`, `${base}/api/catalog_system/pub/products/search?fq=C:/${h.ruta.join("/")}/&_from=0&_to=4`);
    await probar(`categoría ${h.nombre} solo id`, `${base}/api/catalog_system/pub/products/search?fq=C:${h.ruta.at(-1)}&_from=0&_to=4`);
  }
}

// Diagnóstico: imprime qué responde la tienda (estado, plataforma, primeras letras) para ver el log en GitHub
async function sondear(base) {
  for (const ruta of ["/", "/api/catalog_system/pub/category/tree/1"]) {
    try {
      const r = await fetch(base + ruta, { headers: { "user-agent": UA } });
      const h = ["server", "x-powered-by", "via", "cf-ray", "x-vtex-janus-router-backend-app", "content-type"]
        .map(k => `${k}=${r.headers.get(k)}`).join(" ");
      const b = (await r.text()).slice(0, 150).replace(/\s+/g, " ");
      console.log(`[sonda] ${base + ruta} -> ${r.status} ${h}\n        ${b}`);
    } catch (e) { console.log(`[sonda] ${base + ruta} -> error: ${e.message}`); }
  }
}

// Tiendas VTEX. Usa la MISMA consulta que el Worker (products/search?ft=…) para cada término de canasta.json.
// Si desde GitHub no devuelve nada (algunas tiendas bloquean IPs de servidores), usa el Worker como puente.
const hojas = (ns, ruta = [], out = []) => {
  for (const n of ns) { const r = [...ruta, n.id]; n.children?.length ? hojas(n.children, r, out) : out.push({ nombre: n.name, ruta: r }); }
  return out;
};
const apiVivo = () => (CONFIG_JS.match(/API_VIVO\s*=\s*"([^"]+)"/) || [])[1] || "";
function vtex(base, nombre) {
  return async function* () {
    const vistos = new Set(), rech = { sinPrecio: 0, sinStock: 0 };
    const mapear = (it, cat) => {
      const sku = it.items?.[0], o = sku?.sellers?.[0]?.commertialOffer;
      if (!o || !(o.Price > 0)) { rech.sinPrecio++; return null; }
      if (!(o.IsAvailable ?? o.AvailableQuantity > 0)) { rech.sinStock++; return null; }
      return { id: String(it.productId), nombre: it.productName, marca: it.brand || "", ean: sku.ean || "",
        desc: (it.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220),
        precio: o.Price, url: it.link || `${base}/${it.linkText}/p`, cat };
    };
    let a = 0, n = 0;
    for (const t of CANASTA.terminos) {
      for (let d = 0; d < 100; d += 50) {
        const items = await getJson(`${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(t)}&_from=${d}&_to=${d + 49}`);
        await esp(500);
        if (n < 3) console.log(`[${nombre}] "${t}" (desde ${d}): ${items.length} recibidos`);
        for (const it of items) {
          if (vistos.has(it.productId)) continue;
          const x = mapear(it, t);
          if (x) { vistos.add(it.productId); a++; yield x; }
        }
        if (items.length < 50) break;
      }
      if (++n === 3 && !a) break; // las primeras búsquedas no sirvieron: pasar al plan B
    }
    console.log(`[${nombre}] consulta directa: ${a} productos (descartados: ${rech.sinPrecio} sin precio, ${rech.sinStock} sin stock)`);
    if (a) return;
    const api = apiVivo();
    if (!api) throw new Error(`${nombre}: la consulta directa no devolvió productos y config.js no tiene API_VIVO para usar el Worker`);
    console.log(`[${nombre}] plan B: usando el Worker ${api}`);
    for (const t of CANASTA.terminos) {
      const j = await getJson(`${api}?q=${encodeURIComponent(t)}&tiendas=${encodeURIComponent(nombre)}`);
      await esp(1000);
      for (const x of j.resultados || []) {
        if (x.tienda !== nombre || vistos.has(x.id)) continue;
        vistos.add(x.id);
        yield { id: x.id, nombre: x.nombre, marca: x.marca, ean: "", desc: "", precio: x.precio, url: x.url, cat: t };
      }
    }
  };
}

// ---- Super Selectos: sitio con HTML ya armado; se leen páginas de búsqueda y de categoría ----
const SS = "https://www.superselectos.com";
const MARCAS = [...CANASTA.marcas].sort((a, b) => b.length - a.length);
const sinAcento = x => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// Super Selectos no entrega la marca en la lista: se detecta dentro del nombre
export const detectarMarca = (nombre, lista = MARCAS) => {
  const n = ` ${sinAcento(nombre).replace(/[^a-z0-9ñ]+/g, " ")} `;
  return lista.find(m => n.includes(` ${sinAcento(m).replace(/[^a-z0-9ñ]+/g, " ")} `)) || "";
};
const ENT = { amp: "&", quot: '"', lt: "<", gt: ">", nbsp: " ", apos: "'" };
const deco = s => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? m));
const texto = h => deco(h.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

async function getHtml(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
      if (r.ok) return await r.text();
    } catch {}
    await esp(3000 * (i + 1));
  }
  throw new Error("No respondió: " + url);
}

// Recorre los enlaces con productId que tienen texto (el nombre) y toma el precio que aparece justo antes
export function parseSelectos(html) {
  const ini = html.search(/<h1[\s>]/i);          // la lista real va después del título "Resultado…"
  const h = ini >= 0 ? html.slice(ini) : html;
  const re = /<a\b[^>]*href="([^"]*productId=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const out = []; let fin = 0, m;
  while ((m = re.exec(h))) {
    const nombre = texto(m[3]);
    if (nombre.length < 3) continue;               // enlace de la imagen
    const antes = texto(h.slice(fin, m.index)).replace(/Seleccione\s*\d+\s*X\s*\$\s*[\d.,]+/gi, "");
    fin = m.index + m[0].length;
    const pr = antes.match(/\$\s*(\d{1,3}(?:,\d{3})*\.\d{2})/);
    if (!pr) continue;
    const href = deco(m[1]);
    out.push({ id: m[2], nombre, marca: detectarMarca(nombre), ean: "", desc: "", precio: parseFloat(pr[1].replace(",", "")),
               url: href.startsWith("http") ? href : SS + (href.startsWith("/") ? "" : "/") + href });
  }
  return out;
}

// La página trae un filtro "Marcas" con las marcas de esos resultados: sirve para detectar la marca de cada producto
export function extraerMarcas(html) {
  const hit = html.match(/>\s*Marcas\s*</i);
  if (!hit) return [];
  const i = hit.index + 1;
  const fin = html.search(/<h1[\s>]/i);
  const seg = html.slice(i, fin > i ? fin : i + 20000);
  return seg.split(/<[^>]*>/).map(x => deco(x).replace(/\s+/g, " ").trim())
    .filter(x => x.length >= 3 && x.length <= 30 && /[a-zñ]/i.test(x) && !/[$\d]/.test(x) &&
      !/^(marcas|close|filter_list|filtros|mas filtros|ofertas.*|rango.*|categor.*)$/i.test(x));
}

function selectos() {
  return async function* () {
    const vistos = new Set();
    const paginas = [
      ...CANASTA.terminos.map(t => ({ cat: t, url: `${SS}/products?keyword=${encodeURIComponent(t)}` })),
      ...CANASTA.categorias_selectos.map(c => ({ cat: c.nombre, url: `${SS}/products?category=${c.id}` }))
    ];
    const descargadas = [], marcas = new Set(CANASTA.marcas);
    for (const p of paginas) {
      const html = await getHtml(p.url);
      descargadas.push([p, html]);
      extraerMarcas(html).forEach(m => marcas.add(m));
      await esp(3000);                              // pausa larga: un sitio ajeno, pocas peticiones
    }
    const lista = [...marcas].sort((a, b) => b.length - a.length);
    console.log(`[Super Selectos] ${lista.length} marcas conocidas`);
    for (const [p, html] of descargadas) {
      for (const it of parseSelectos(html)) {
        if (vistos.has(it.id)) continue;
        vistos.add(it.id);
        yield { ...it, marca: detectarMarca(it.nombre, lista), cat: p.cat };
      }
    }
  };
}

// Superea: consulta el índice público de Algolia que usa su propio buscador, un término de canasta.json a la vez.
// La clave es la de solo búsqueda que el sitio entrega a todo visitante; bodega 1 es la que usa sin dirección elegida.
function superea() {
  const app = "0L9N281WRT", clave = "6d8f296718166bdcfd63f9983931d63d";
  return async function* () {
    const vistos = new Set();
    let n = 0;
    for (const t of CANASTA.terminos) {
      const p = new URLSearchParams({ query: t, hitsPerPage: "100", filters: "visible_in_wh_ids:1",
        attributesToRetrieve: "id,name,slug,brand_name,description,final_price,available_balance,is_always_available,grammage",
        "x-algolia-application-id": app, "x-algolia-api-key": clave });
      const j = await getJson(`https://${app.toLowerCase()}-dsn.algolia.net/1/indexes/prod_SV_articles?${p}`);
      await esp(1000);
      for (const h of j.hits || []) {
        const id = String(h.id ?? h.objectID);
        if (vistos.has(id) || !h.slug || !(Number(h.final_price) > 0)) continue;
        if (!(Number(h.is_always_available) === 1 || Number(h.available_balance) > 0)) continue;
        vistos.add(id); n++;
        yield { id, nombre: !parseTamano(h.name) && h.grammage ? `${h.name} ${h.grammage}` : h.name, marca: h.brand_name || "", ean: "",
          desc: String(h.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220),
          precio: Number(h.final_price), url: `https://superea.sv/productos/${encodeURIComponent(h.slug)}`, cat: t };
      }
    }
    console.log(`[Superea] ${n} productos en ${CANASTA.terminos.length} búsquedas`);
  };
}

const pendiente = n => async function* () { throw new Error(n + ": adaptador pendiente"); };

export const TIENDAS = [
  { nombre: "Walmart",              activa: true,  catalogo: vtex("https://www.walmart.com.sv", "Walmart"), sonda: async () => { await sondear("https://www.walmart.com.sv"); await sondearProductos("https://www.walmart.com.sv"); } }, // VERIFICAR en la primera corrida
  { nombre: "Super Selectos",       activa: true,  catalogo: selectos() },
  { nombre: "Superea",              activa: true,  catalogo: superea() },
  { nombre: "Despensa de Don Juan", activa: true,  catalogo: vtex("https://www.ladespensadedonjuan.com.sv", "Despensa de Don Juan"), sonda: () => sondear("https://www.ladespensadedonjuan.com.sv") }, // VERIFICAR: es del grupo Walmart, pero no confirmado que use VTEX
  { nombre: "Maxi Despensa",        activa: true,  catalogo: vtex("https://www.maxidespensa.com.sv", "Maxi Despensa"), sonda: () => sondear("https://www.maxidespensa.com.sv") } // tienda en línea de Walmart Centroamérica desde 2024; VERIFICAR en la primera corrida
];
export const slug = n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");

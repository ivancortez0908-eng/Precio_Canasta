// Cada tienda con activa:true debe tener catalogo(): generador que entrega
// { id, nombre, marca, ean, precio, url, cat } por cada producto disponible.
import { readFile } from "node:fs/promises";
const UA = "CanastaSV/1.0 (comparador de precios sin fines de lucro)";
const CANASTA = JSON.parse(await readFile(new URL("./canasta.json", import.meta.url), "utf8"));
const esp = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  let ultimo = "sin respuesta";
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
      if (r.ok) return await r.json();
      ultimo = "HTTP " + r.status;
      if (r.status === 400 || r.status === 404) return [];
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

// Tiendas VTEX. Dos fases: (A) búsquedas por los términos de canasta.json, que es lo más confiable,
// y (B) recorrido de categorías usando la ruta completa (C:/1/20/55/), que es como VTEX la espera.
const hojas = (ns, ruta = [], out = []) => {
  for (const n of ns) { const r = [...ruta, n.id]; n.children?.length ? hojas(n.children, r, out) : out.push({ nombre: n.name, ruta: r }); }
  return out;
};
const disponible = o => o && o.Price > 0 && (o.IsAvailable ?? o.AvailableQuantity > 0);
function vtex(base) {
  const mapear = (it, cat) => {
    const sku = it.items?.[0], o = sku?.sellers?.[0]?.commertialOffer;
    if (!disponible(o)) return null;
    return { id: String(it.productId), nombre: it.productName, marca: it.brand || "", ean: sku.ean || "",
      desc: (it.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220),
      precio: o.Price, url: it.link || `${base}/${it.linkText}/p`, cat };
  };
  return async function* () {
    const vistos = new Set();
    // Fase A: términos
    let a = 0;
    for (const t of CANASTA.terminos) {
      for (let d = 0; d < 100; d += 50) {
        const items = await getJson(`${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(t)}&_from=${d}&_to=${d + 49}`);
        await esp(500);
        for (const it of items) {
          if (vistos.has(it.productId)) continue;
          const x = mapear(it, t);
          if (x) { vistos.add(it.productId); a++; yield x; }
        }
        if (items.length < 50) break;
      }
    }
    console.log(`[Walmart] fase A (términos): ${a} productos`);
    // Fase B: categorías con ruta completa
    const arbol = await getJson(`${base}/api/catalog_system/pub/category/tree/3`);
    let b = 0, vacias = 0;
    for (const cat of hojas(arbol)) {
      let n = 0;
      for (let d = 0; d < 2500; d += 50) {
        const items = await getJson(`${base}/api/catalog_system/pub/products/search?fq=C:/${cat.ruta.join("/")}/&_from=${d}&_to=${d + 49}`);
        await esp(500);
        for (const it of items) {
          if (vistos.has(it.productId)) continue;
          const x = mapear(it, cat.nombre);
          if (x) { vistos.add(it.productId); n++; b++; yield x; }
        }
        if (items.length < 50) break;
      }
      if (!n && ++vacias <= 3) console.log(`[Walmart] categoría sin productos nuevos: ${cat.nombre} (C:/${cat.ruta.join("/")}/)`);
    }
    console.log(`[Walmart] fase B (categorías): ${b} productos nuevos`);
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

const pendiente = n => async function* () { throw new Error(n + ": adaptador pendiente"); };

export const TIENDAS = [
  { nombre: "Walmart",              activa: true,  catalogo: vtex("https://www.walmart.com.sv"), sonda: async () => { await sondear("https://www.walmart.com.sv"); await sondearProductos("https://www.walmart.com.sv"); } }, // VERIFICAR en la primera corrida
  { nombre: "Super Selectos",       activa: true,  catalogo: selectos() },
  { nombre: "Despensa de Don Juan", activa: false, catalogo: pendiente("Despensa de Don Juan") }
];
export const slug = n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");

// Cada tienda con activa:true debe tener catalogo(): generador que entrega
// { id, nombre, marca, ean, precio, url, cat } por cada producto disponible.
import { readFile } from "node:fs/promises";
const UA = "CanastaSV/1.0 (comparador de precios sin fines de lucro)";
const esp = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
      if (r.ok) return await r.json();
      if (r.status === 400 || r.status === 404) return [];
    } catch {}
    await esp(1500 * (i + 1));
  }
  throw new Error("No respondió: " + url);
}
const hojas = (ns, out = []) => { for (const n of ns) n.children?.length ? hojas(n.children, out) : out.push(n); return out; };

// Tiendas VTEX: recorre todas las categorías y pagina cada una
function vtex(base) {
  return async function* () {
    const arbol = await getJson(`${base}/api/catalog_system/pub/category/tree/3`);
    const vistos = new Set();
    for (const cat of hojas(arbol)) {
      for (let d = 0; d < 2500; d += 50) {
        const items = await getJson(`${base}/api/catalog_system/pub/products/search?fq=C:${cat.id}&_from=${d}&_to=${d + 49}`);
        await esp(400);
        for (const it of items) {
          if (vistos.has(it.productId)) continue;
          vistos.add(it.productId);
          const sku = it.items?.[0];
          const o = sku?.sellers?.[0]?.commertialOffer;
          if (!o || !(o.Price > 0) || !(o.AvailableQuantity > 0)) continue;
          yield { id: String(it.productId), nombre: it.productName, marca: it.brand || "", ean: sku.ean || "",
                  precio: o.Price, desc: (it.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220), url: it.link || `${base}/${it.linkText}/p`, cat: cat.name };
        }
        if (items.length < 50) break;
      }
    }
  };
}

// ---- Super Selectos: sitio con HTML ya armado; se leen páginas de búsqueda y de categoría ----
const SS = "https://www.superselectos.com";
const CANASTA = JSON.parse(await readFile(new URL("./canasta.json", import.meta.url), "utf8"));
const MARCAS = [...CANASTA.marcas].sort((a, b) => b.length - a.length);
const sinAcento = x => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// Super Selectos no entrega la marca en la lista: se detecta dentro del nombre
export const detectarMarca = nombre => {
  const n = ` ${sinAcento(nombre).replace(/[^a-z0-9ñ]+/g, " ")} `;
  return MARCAS.find(m => n.includes(` ${sinAcento(m).replace(/[^a-z0-9ñ]+/g, " ")} `)) || "";
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

function selectos() {
  return async function* () {
    const vistos = new Set();
    const paginas = [
      ...CANASTA.terminos.map(t => ({ cat: t, url: `${SS}/products?keyword=${encodeURIComponent(t)}` })),
      ...CANASTA.categorias_selectos.map(c => ({ cat: c.nombre, url: `${SS}/products?category=${c.id}` }))
    ];
    for (const p of paginas) {
      const html = await getHtml(p.url);
      await esp(3000);                              // pausa larga: un sitio ajeno, pocas peticiones
      for (const it of parseSelectos(html)) {
        if (vistos.has(it.id)) continue;
        vistos.add(it.id);
        yield { ...it, cat: p.cat };
      }
    }
  };
}

const pendiente = n => async function* () { throw new Error(n + ": adaptador pendiente"); };

export const TIENDAS = [
  { nombre: "Walmart",              activa: true,  catalogo: vtex("https://www.walmart.com.sv") }, // VERIFICAR en la primera corrida
  { nombre: "Super Selectos",       activa: true,  catalogo: selectos() },
  { nombre: "Despensa de Don Juan", activa: false, catalogo: pendiente("Despensa de Don Juan") }
];
export const slug = n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");

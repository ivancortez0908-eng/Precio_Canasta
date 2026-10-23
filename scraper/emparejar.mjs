// Paso 2: une los catálogos y agrupa los productos equivalentes -> data/productos.json
// Equivalencia por (1) código de barras, (2) marca + nombre + tamaño, (3) lista manual.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { claveNombre, precioUnitario } from "./normalizar.mjs";

// Selectos cambia el ?keyword= según la búsqueda: se compara por productId; en las demás, el enlace sin parámetros
const normUrl = u => { const m = (u || "").match(/productId=(\d+)/); return m ? "id:" + m[1] : (u || "").split("?")[0].replace(/\/+$/, "").toLowerCase(); };
// Código de barras (EAN/UPC/GTIN) solo si su dígito de control es correcto: un número mal capturado
// (p. ej. un SKU interno en el campo del código) no debe unir productos distintos. Los códigos internos
// cortos rellenos de ceros (frutas, pan a granel) no se usan: pueden coincidir entre empresas distintas.
const gtin = s => {
  const d = String(s || "").replace(/\D/g, "");
  if (!/^(?:\d{8}|\d{12,14})$/.test(d) || d.replace(/^0+/, "").length < 8) return "";
  let suma = 0;
  for (let i = d.length - 2, w = 3; i >= 0; i--, w = 4 - w) suma += +d[i] * w;
  return (10 - suma % 10) % 10 === +d.at(-1) ? d.padStart(14, "0") : "";
};
const archivos = (await readdir("data/catalogo")).filter(f => f.endsWith(".json")).sort();
const supers = [], todos = [];
for (const f of archivos) {
  const d = JSON.parse(await readFile(`data/catalogo/${f}`, "utf8"));
  supers.push(d.tienda);
  d.items.forEach(it => todos.push({ ...it, ti: supers.length - 1 }));
}

const padre = todos.map((_, i) => i);
const raiz = i => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
const tipos = new Map(); // raíz -> tipos de unión usados
const unir = (a, b, tipo) => {
  const ra = raiz(a), rb = raiz(b);
  const ts = new Set([...(tipos.get(ra) || []), ...(tipos.get(rb) || []), tipo]);
  padre[ra] = rb; tipos.set(rb, ts);
};

const porEan = new Map(), porClave = new Map(), porId = new Map(), porUrl = new Map();
todos.forEach((it, i) => {
  porId.set(`${supers[it.ti]}#${it.id}`, i);
  if (it.url) porUrl.set(`${supers[it.ti]}#${normUrl(it.url)}`, i);
  const e = gtin(it.ean);
  if (e) porEan.has(e) ? unir(i, porEan.get(e), "ean") : porEan.set(e, i);
  const k = claveNombre(it);
  if (k) porClave.has(k) ? unir(i, porClave.get(k), "nombre") : porClave.set(k, i);
});

// Equivalencias manuales: scraper/equivalencias.json = [[{tienda,id},{tienda,id}], ...]
const manual = JSON.parse(await readFile("scraper/equivalencias.json", "utf8").catch(() => "[]"));
for (const grupo of manual) {
  const idx = grupo.map(x => porId.get(`${x.tienda}#${x.id}`) ?? (x.url ? porUrl.get(`${x.tienda}#${normUrl(x.url)}`) : undefined)).filter(x => x !== undefined);
  for (let j = 1; j < idx.length; j++) unir(idx[j], idx[0], "manual");
}

const grupos = new Map();
todos.forEach((_, i) => { const r = raiz(i); (grupos.get(r) || grupos.set(r, []).get(r)).push(i); });

const bonito = t => { // "FRIJOL ROJO DE SEDA" -> "Frijol Rojo De Seda"
  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  return letras && (t.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length / letras.length) > 0.8 ? t.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()).replace(/(\d)\s*(G|Kg|Ml|Lb|Oz)\b/g, (_, d, u) => d + " " + (u === "Ml" ? "ml" : u.toLowerCase())) : t;
};
const items = [];
for (const [r, idxs] of grupos) {
  const porTienda = new Map(); // se queda con el más barato de cada tienda
  for (const i of idxs) {
    const it = todos[i], prev = porTienda.get(it.ti);
    if (!prev || it.precio < prev.precio) porTienda.set(it.ti, it);
  }
  const lista = [...porTienda.values()];
  const base = lista[0], conQ = lista.find(x => x.q) || base;
  const t = lista.map(x => {
    const p = precioUnitario(x.precio, x.q, x.u);
    return [x.ti, +x.precio.toFixed(2), x.url, p ? +p.pu.toFixed(4) : null, bonito(x.nombre), x.marca || "", x.desc || "", x.id];
  });
  const pus = t.map(x => x[3]).filter(v => v != null);
  const ts = tipos.get(raiz(r));
  const k = lista.length < 2 ? null : ts?.has("manual") ? "manual" : ts?.has("ean") ? "ean" : "nombre";
  const conMarca = lista.find(x => x.marca);
  // Códigos de barras válidos del grupo (14 cifras): la página los usa para buscar o escanear un producto
  const b = [...new Set(idxs.map(i => gtin(todos[i].ean)).filter(Boolean))];
  items.push({ n: bonito(base.nombre), m: conMarca ? bonito(conMarca.marca) : "", q: conQ.q, u: conQ.u,
    pl: precioUnitario(1, conQ.q, conQ.u)?.pl ?? null, pu: pus.length ? Math.min(...pus) : null, k, t, ...(b.length ? { b } : {}) });
}
items.sort((a, b) => a.n.localeCompare(b.n, "es"));

await writeFile("data/productos.json", JSON.stringify({
  ejemplo: false, actualizado: new Date().toISOString().slice(0, 10), supers, items }));
const comp = items.filter(i => i.t.length > 1).length;
console.log(`Listo: ${items.length} productos, ${comp} presentes en 2 o más tiendas (${supers.join(", ")}).`);

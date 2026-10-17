import { readFile, writeFile } from "node:fs/promises";
import { TIENDAS } from "./tiendas.mjs";

const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const espera = ms => new Promise(r => setTimeout(r, ms));
const productos = JSON.parse(await readFile("scraper/productos.json", "utf8"));
const previo = JSON.parse(await readFile("data/precios.json", "utf8").catch(() => "null"));
const usarPrevio = previo && !previo.ejemplo; // nunca arrastrar datos de ejemplo

const tiendas = TIENDAS.filter(t => t.activa);
const salida = productos.map(p => ({ id: p.id, nombre: p.nombre, unidad: p.unidad, cat: p.cat, p: [], n: [] }));
let aciertos = 0;

for (const [ti, t] of tiendas.entries()) {
  const iPrev = usarPrevio ? previo.supers.indexOf(t.nombre) : -1;
  for (const [pi, prod] of productos.entries()) {
    let precio = null, nombre = null;
    try {
      const res = await t.buscar(prod.busca);
      const ok = res.find(x => prod.claves.every(c => norm(x.nombre).includes(norm(c))));
      if (ok) { precio = ok.precio; nombre = ok.nombre; aciertos++; }
    } catch (e) {
      console.warn(`[${t.nombre}] ${prod.nombre}: ${e.message}`);
    }
    // Si falló, conserva el último precio conocido de la corrida anterior
    if (precio == null && iPrev >= 0) {
      const old = previo.productos.find(x => x.id === prod.id);
      precio = old?.p[iPrev] ?? null; nombre = old?.n?.[iPrev] ?? null;
    }
    salida[pi].p[ti] = precio; salida[pi].n[ti] = nombre;
    await espera(1000); // trato amable con los servidores
  }
}

if (!tiendas.length || aciertos === 0) {
  console.error("Ningún precio obtenido; no se actualiza data/precios.json.");
  process.exit(1);
}
await writeFile("data/precios.json", JSON.stringify({
  ejemplo: false,
  actualizado: new Date().toISOString().slice(0, 10),
  supers: tiendas.map(t => t.nombre),
  productos: salida
}, null, 1));
console.log(`Listo: ${aciertos} precios de ${tiendas.length} tienda(s).`);

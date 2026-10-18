// Aplica una issue aprobada (etiqueta "aprobado") a scraper/equivalencias.json
import { readFile, writeFile } from "node:fs/promises";
const bloque = (process.env.CUERPO || "").match(/```json\s*([\s\S]*?)```/);
if (!bloque) { console.error("La issue no trae un bloque JSON."); process.exit(1); }
let nuevos; try { nuevos = JSON.parse(bloque[1]); } catch { console.error("JSON no válido."); process.exit(1); }
const texto = (t, n) => String(t ?? "").slice(0, n);
const valido = g => Array.isArray(g) && g.length >= 2 && g.length <= 6 && g.every(x => x && typeof x.tienda === "string" && (x.id || x.url));
if (!Array.isArray(nuevos) || !nuevos.length || !nuevos.every(valido)) { console.error("Formato no válido."); process.exit(1); }
const clave = g => g.map(x => x.tienda + "#" + (x.id || x.url)).sort().join("|");
let base = []; try { base = JSON.parse(await readFile("scraper/equivalencias.json", "utf8")); } catch {}
const vistos = new Set(base.map(clave)); let n = 0;
for (const g of nuevos) {
  if (vistos.has(clave(g))) continue;
  base.push(g.map(x => ({ tienda: texto(x.tienda, 40), id: texto(x.id, 40), url: texto(x.url, 300), nombre: texto(x.nombre, 150) })));
  vistos.add(clave(g)); n++;
}
await writeFile("scraper/equivalencias.json", JSON.stringify(base, null, 1));
console.log(`${n} grupo(s) nuevo(s) aplicado(s).`);

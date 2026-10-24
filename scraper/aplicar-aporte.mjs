// Aplica una issue aprobada (etiqueta "aprobado") a scraper/equivalencias.json
// Solo entran las comparaciones cuya sección («### Comparación N» y su tabla) sigue en la issue:
// para descartar una basta con borrar su sección antes de poner la etiqueta; el JSON no se edita.
import { readFile, writeFile, appendFile } from "node:fs/promises";
const cuerpo = process.env.CUERPO || "";
// Resumen para el comentario de cierre (lo lee el workflow como salida del paso)
const salida = async (resumen, aplicados) => {
  console.log(resumen);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `resumen=${resumen.replace(/\n/g, " ")}\naplicados=${aplicados}\n`);
};
const bloque = cuerpo.match(/```json\s*([\s\S]*?)```/);
if (!bloque) { console.error("La issue no trae un bloque JSON."); process.exit(1); }
let nuevos; try { nuevos = JSON.parse(bloque[1]); } catch { console.error("JSON no válido."); process.exit(1); }
const texto = (t, n) => String(t ?? "").slice(0, n);
const valido = g => Array.isArray(g) && g.length >= 2 && g.length <= 6 && g.every(x => x && typeof x.tienda === "string" && (x.id || x.url));
if (!Array.isArray(nuevos) || !nuevos.length || !nuevos.every(valido)) { console.error("Formato no válido."); process.exit(1); }

// Comparaciones que siguen en la issue (fuera del bloque JSON). Las issues antiguas no tienen secciones: se aplica todo.
const visibles = new Set([...cuerpo.replace(bloque[0], "").matchAll(/^###\s*Comparaci[oó]n\s+(\d+)\s*$/gim)].map(m => +m[1]));
const antigua = !/###\s*Comparaci[oó]n/i.test(cuerpo);
const elegidos = nuevos.map((g, i) => [i + 1, g]).filter(([n]) => antigua || visibles.has(n));
const omitidos = nuevos.map((_, i) => i + 1).filter(n => !antigua && !visibles.has(n));

const clave = g => g.map(x => x.tienda + "#" + (x.id || x.url)).sort().join("|");
let base = []; try { base = JSON.parse(await readFile("scraper/equivalencias.json", "utf8")); } catch {}
const vistos = new Set(base.map(clave)); const aplicadas = [], repetidas = [];
for (const [n, g] of elegidos) {
  if (vistos.has(clave(g))) { repetidas.push(n); continue; }
  base.push(g.map(x => ({ tienda: texto(x.tienda, 40), id: texto(x.id, 40), url: texto(x.url, 300), nombre: texto(x.nombre, 150) })));
  vistos.add(clave(g)); aplicadas.push(n);
}
if (aplicadas.length) await writeFile("scraper/equivalencias.json", JSON.stringify(base, null, 1));
const lista = ns => ns.length > 1 ? ns.slice(0, -1).join(", ") + " y " + ns.at(-1) : String(ns[0]);
const partes = [aplicadas.length ? `Se aplicaron ${aplicadas.length} comparación(es) (${lista(aplicadas)}) a scraper/equivalencias.json; se verán en el catálogo tras la próxima actualización de precios.`
  : "No se aplicó ninguna comparación."];
if (omitidos.length) partes.push(`Se omitieron ${lista(omitidos)} porque su tabla se borró de la issue.`);
if (repetidas.length) partes.push(`Ya estaban en la base: ${lista(repetidas)}.`);
await salida(partes.join(" "), aplicadas.length);

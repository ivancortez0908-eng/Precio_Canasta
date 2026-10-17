// Paso 1: descarga el catálogo completo de cada tienda activa -> data/catalogo/<tienda>.json
import { writeFile, mkdir } from "node:fs/promises";
import { TIENDAS, slug } from "./tiendas.mjs";
import { parseTamano } from "./normalizar.mjs";

await mkdir("data/catalogo", { recursive: true });
let bien = 0;
for (const t of TIENDAS.filter(t => t.activa)) {
  try {
    if (t.sonda) await t.sonda();
    const items = [];
    for await (const it of t.catalogo()) {
      const tam = parseTamano(it.nombre);
      items.push({ ...it, q: tam?.q ?? null, u: tam?.u ?? null });
      if (items.length % 500 === 0) console.log(`[${t.nombre}] ${items.length} productos…`);
    }
    if (items.length < 50) throw new Error(`solo ${items.length} productos; se conserva el catálogo anterior`);
    await writeFile(`data/catalogo/${slug(t.nombre)}.json`,
      JSON.stringify({ tienda: t.nombre, fecha: new Date().toISOString().slice(0, 10), items }));
    console.log(`[${t.nombre}] OK: ${items.length} productos`);
    bien++;
  } catch (e) { console.error(`[${t.nombre}] FALLÓ: ${e.message}`); }
}
if (!bien) { console.error("Ninguna tienda respondió."); process.exit(1); }

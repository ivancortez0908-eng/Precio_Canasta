// Cada tienda con activa:true debe tener catalogo(): generador que entrega
// { id, nombre, marca, ean, precio, url, cat } por cada producto disponible.
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
                  precio: o.Price, url: it.link || `${base}/${it.linkText}/p`, cat: cat.name };
        }
        if (items.length < 50) break;
      }
    }
  };
}

const pendiente = n => async function* () { throw new Error(n + ": adaptador pendiente"); };

export const TIENDAS = [
  { nombre: "Walmart",              activa: true,  catalogo: vtex("https://www.walmart.com.sv") }, // VERIFICAR en la primera corrida
  { nombre: "Super Selectos",       activa: false, catalogo: pendiente("Super Selectos") },
  { nombre: "Despensa de Don Juan", activa: false, catalogo: pendiente("Despensa de Don Juan") }
];
export const slug = n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");

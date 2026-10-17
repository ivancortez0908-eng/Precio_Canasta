// Cada tienda expone buscar(termino) -> { precio, nombre } | null
const UA = "CanastaSV/1.0 (comparador de precios sin fines de lucro)";

// Adaptador para tiendas VTEX (API pública de catálogo que usa la propia web de la tienda)
function vtex(base) {
  return async term => {
    const url = `${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(term)}&_from=0&_to=9`;
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const out = [];
    for (const it of await r.json()) {
      const o = it.items?.[0]?.sellers?.[0]?.commertialOffer;
      if (o && o.Price > 0 && o.AvailableQuantity > 0) out.push({ precio: o.Price, nombre: it.productName });
    }
    return out; // en orden de relevancia
  };
}

// Tiendas sin adaptador listo: ver README ("Agregar un supermercado")
const pendiente = nombre => async () => { throw new Error(nombre + ": adaptador pendiente"); };

export const TIENDAS = [
  { nombre: "Walmart",              activa: true,  buscar: vtex("https://www.walmart.com.sv") }, // VERIFICAR en la primera ejecución
  { nombre: "Super Selectos",       activa: false, buscar: pendiente("Super Selectos") },        // superselectos.com
  { nombre: "Despensa de Don Juan", activa: false, buscar: pendiente("Despensa de Don Juan") }
];

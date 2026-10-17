/* Reglas compartidas por la interfaz y las pruebas. Sin dependencias. */
(function (root) {
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const palabras = s => norm(s).replace(/[^a-z0-9]+/g, " ").trim();
  const nombre = x => x.nombre || x.n || "";
  const marca = x => palabras(x.marca || x.m);
  const precioValido = p => typeof p === "number" && Number.isFinite(p) && p > 0;
  function firma(x, marcaComun) {
    let s = norm(nombre(x))
      .replace(/(?<![\w.,])(\d{1,3})\s(\d{3})(?=\s*(?:g|gr|gramos|ml)\b)/g, "$1$2");
    // La concentración (mg), sabor, variedad y número de envases se conservan.
    s = s.replace(/(?<![\d.,])\d+(?:[.,]\d+)?\s*(?:kg|kilos?|grs?|gramos?|g|lbs?|libras?|oz|ml|lts?|litros?|l|galones|galon|gal)\b/g, " ");
    const ignorar = new Set(("de la el los las en y del bolsa caja paquete " + marcaComun).split(" "));
    return [...new Set(palabras(s).split(" ").filter(w => w && !ignorar.has(w)))].sort().join(" ");
  }
  function equivalente(a, b) {
    const ma = marca(a), mb = marca(b);
    if (ma && mb && ma !== mb) return false;
    if (!a.q || !b.q || !a.u || a.u !== b.u) return false;
    // Solo tolera redondeos de conversión (p. ej. 1 lb = 454 g).
    if (Math.abs(a.q - b.q) > Math.max(1, Math.min(a.q, b.q) * .005)) return false;
    const comun = ma || mb;
    if (!comun) return false;
    // Cuando una fuente omite la marca, debe aparecer completa en su nombre.
    if ((!ma && !(" " + palabras(nombre(a)) + " ").includes(" " + comun + " ")) ||
        (!mb && !(" " + palabras(nombre(b)) + " ").includes(" " + comun + " "))) return false;
    const fa = firma(a, comun), fb = firma(b, comun);
    return !!fa && fa === fb;
  }
  function resumir(favoritos, tiendas) {
    const res = tiendas.map(s => {
      let centavos = 0, faltan = 0;
      for (const f of favoritos) {
        if (precioValido(f.t[s]?.p)) centavos += Math.round(f.t[s].p * 100) * f.cant;
        else faltan++;
      }
      return { s, total: centavos / 100, faltan };
    });
    let centavos = 0, sinPrecio = 0;
    const por = {};
    for (const f of favoritos) {
      const opciones = Object.entries(f.t).filter(([, v]) => precioValido(v.p)).sort((a, b) => a[1].p - b[1].p);
      if (!opciones.length) { sinPrecio++; continue; }
      const [s, v] = opciones[0];
      centavos += Math.round(v.p * 100) * f.cant;
      por[s] = (por[s] || 0) + f.cant;
    }
    return { res, mix: centavos / 100, por, sinPrecio };
  }
  const api = { equivalente, precioValido, resumir };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Canasta = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

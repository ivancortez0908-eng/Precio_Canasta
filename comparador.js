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
  // Promoción por cantidad con texto claro: «2 x $2.20» (2 por $2.20), «Seleccione 2X$0.90», «3x2» (lleva 3, paga 2),
  // «Segundo al 50%» (la segunda unidad con 50 % de descuento). Cualquier otro texto no se interpreta.
  function leerPromo(texto) {
    const t = String(texto || "").trim().replace(/^seleccione\s+/i, "");
    let m = t.match(/^(\d+)\s*[x×]\s*\$\s*(\d+(?:[.,]\d{1,2})?)$/i);
    if (m && +m[1] >= 2 && +m[2].replace(",", ".") > 0) return { n: +m[1], total: +m[2].replace(",", ".") };
    m = t.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
    if (m && +m[1] > +m[2] && +m[2] > 0) return { n: +m[1], paga: +m[2] };
    m = t.match(/^segundo al (\d{1,2})\s*%$/i);
    if (m && +m[1] > 0) return { n: 2, segundo: +m[1] };
    return null;
  }
  // Costo en centavos de `cant` unidades en UNA tienda. La promoción de esa tienda se aplica por grupos completos
  // (3 unidades con «2 x $2.20» = un grupo de 2 + 1 a precio normal), solo si abarata y sin acumular descuentos.
  function costo(v, cant) {
    const c = Math.round(v.p * 100), pr = leerPromo(v.promo);
    if (!pr || cant < pr.n) return c * cant;
    const grupo = pr.total != null ? Math.round(pr.total * 100) : pr.segundo != null ? c + Math.round(c * (100 - pr.segundo) / 100) : pr.paga * c;
    return grupo < pr.n * c ? Math.floor(cant / pr.n) * grupo + (cant % pr.n) * c : c * cant;
  }
  function resumir(favoritos, tiendas) {
    const res = tiendas.map(s => {
      let centavos = 0, faltan = 0;
      for (const f of favoritos) {
        if (precioValido(f.t[s]?.p)) centavos += costo(f.t[s], f.cant);
        else faltan++;
      }
      return { s, total: centavos / 100, faltan };
    });
    let centavos = 0, sinPrecio = 0;
    const por = {};
    for (const f of favoritos) {
      // La tienda más barata para la cantidad pedida, con su propia promoción
      const opciones = Object.entries(f.t).filter(([, v]) => precioValido(v.p)).map(([s, v]) => [s, costo(v, f.cant)]).sort((a, b) => a[1] - b[1]);
      if (!opciones.length) { sinPrecio++; continue; }
      const [s, c] = opciones[0];
      centavos += c;
      por[s] = (por[s] || 0) + f.cant;
    }
    return { res, mix: centavos / 100, por, sinPrecio };
  }
  const api = { equivalente, precioValido, resumir, leerPromo, costo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Canasta = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

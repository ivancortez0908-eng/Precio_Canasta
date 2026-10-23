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
    // «3.38 fl oz» sale del nombre igual que «100 ml»: es la misma medida escrita de otra forma
    s = s.replace(/(?<![\d.,])\d+(?:[.,]\d+)?\s*(?:fl\.?\s*oz\.?|onzas?\s+liquidas?|oz\.?\s*liq(?:uidas?)?\.?|kg|kilos?|grs?|gramos?|g|lbs?|libras?|onzas?|oz|ml|lts?|litros?|l|galones|galon|gal)(?![a-z])/g, " ");
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
  // Búsqueda en vivo: un resultado debe contener al menos 2 palabras de la búsqueda (o la única que haya).
  // No cuentan artículos, números ni medidas; singular y plural son iguales y «cocacola» encuentra «Coca-Cola».
  const VACIAS = new Set("de del la las el los y con para por en al a un una".split(" "));
  const MEDIDAS = /^(?:\d.*|x|ml|l|lt|lts|litros?|g|gr|grs|gramos?|kg|kilos?|lb|lbs|libras?|oz|fl|floz|onzas?|liquidas?|galon(?:es)?|unidad(?:es)?|und|uds?|pack)$/;
  const igual = (a, b) => a === b || a + "s" === b || b + "s" === a || a + "es" === b || b + "es" === a;
  function palabrasBusqueda(q) {
    return [...new Set(palabras(q).split(" ").filter(w => w.length >= 2 && !VACIAS.has(w) && !MEDIDAS.test(w)))];
  }
  function coincideBusqueda(q, texto) {
    const qs = palabrasBusqueda(q);
    if (!qs.length) return true;
    const ws = palabras(texto).split(" ").filter(Boolean), junto = ws.join("");
    const ok = qs.filter(t => ws.some(w => igual(t, w)) || (t.length >= 4 && junto.includes(t)));
    return ok.length >= Math.min(2, qs.length);
  }
  // Código de barras (EAN/UPC/GTIN): misma regla que scraper/emparejar.mjs y el Worker. Dígito de control correcto y
  // al menos 8 cifras significativas; se devuelve con 14 cifras para comparar sin importar los ceros a la izquierda.
  function gtin(s) {
    const d = String(s || "").replace(/\D/g, "");
    if (!/^(?:\d{8}|\d{12,14})$/.test(d) || d.replace(/^0+/, "").length < 8) return "";
    let suma = 0;
    for (let i = d.length - 2, w = 3; i >= 0; i--, w = 4 - w) suma += +d[i] * w;
    return (10 - suma % 10) % 10 === +d.at(-1) ? d.padStart(14, "0") : "";
  }
  // Día (AAAA-MM-DD) de una fecha guardada. Las consultas guardan hora UTC: se pasan a la hora del dispositivo
  // para que una consulta de las 7 p. m. en El Salvador no aparezca con la fecha del día siguiente.
  function dia(f) {
    f = String(f || "");
    const d = f.includes("T") ? new Date(f) : null;
    if (!d || isNaN(d)) return f.slice(0, 10);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const api = { equivalente, precioValido, resumir, leerPromo, costo, palabrasBusqueda, coincideBusqueda, dia, gtin };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Canasta = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

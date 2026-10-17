// Utilidades para entender tamaños y comparar nombres entre tiendas
export const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const RE = /(?<![\d.,])(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|kilos?|grs?|gramos?|g|lbs?|libras?|oz|ml|lts?|litros?|l|gal(?:on(?:es)?)?)(?![a-z])/i;
const RE_UD = /(\d+)\s*(unidades|und|uds?|pzas?|piezas)(?![a-z])/i;

function conv(v, u) {
  u = u.toLowerCase();
  if (/^(kg|kilos?)$/.test(u)) return v > 60 ? { q: v, u: "g" } : { q: v * 1000, u: "g" };   // "802 kg" en un quitamanchas es 802 g
  if (/^(g|grs?|gramos?)$/.test(u)) return { q: v, u: "g" };
  if (/^(lbs?|libras?)$/.test(u)) return { q: v * 453.592, u: "g" };
  if (u === "oz") return { q: v * 28.3495, u: "g" };
  if (/^(l|lts?|litros?)$/.test(u)) return v > 50 ? { q: v, u: "ml" } : { q: v * 1000, u: "ml" };
  if (u === "ml") return { q: v, u: "ml" };
  if (/^gal/.test(u)) return { q: v * 3785.41, u: "ml" };
  return null;
}

// Superselectos escribe 1 816 g (miles con espacio): lo convertimos a 1816 g
export const limpiaTam = t => (t || "")
  .replace(/(\d{1,3})\s(\d{3})(?=\s*(?:g|gr|grs|gramos|ml)(?![a-z]))/gi, "$1$2")        // 1 816 g  -> 1816 g
  .replace(/(\d{1,3})\s(\d{3})(?=\s*(?:kg|kilos?|lts?|litros?|l)(?![a-z]))/gi, "$1.$2") // 2 500 kg -> 2.500 kg
  .replace(/\s+/g, " ");

// "Frijol rojo 2 lb" -> { q: 907, u: "g" }; "Cerveza 6 x 355 ml" -> { q: 2130, u: "ml" }
export function parseTamano(nombre) {
  const t = limpiaTam(nombre);
  const mp = t.match(/(\d+)\s*(?:unidades|unidad|uds?|und)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(kg|kilos?|grs?|gramos?|g|lbs?|libras?|oz|ml|lts?|litros?|l)(?![a-z])/i);
  if (mp) { const c = conv(parseFloat(mp[2].replace(",", ".")), mp[3]); if (c) return { q: Math.round(c.q * +mp[1]), u: c.u }; }
  const m = t.match(RE);
  if (m) {
    const c = conv(parseFloat(m[2].replace(",", ".")), m[3]);
    if (c) return { q: Math.round(c.q * (m[1] ? +m[1] : 1)), u: c.u };
  }
  if (/docena/i.test(t)) return { q: 12, u: "ud" };
  const ud = t.match(RE_UD);
  return ud ? { q: +ud[1], u: "ud" } : null;
}

// Precio por libra / litro / unidad, para comparar presentaciones distintas
export function precioUnitario(precio, q, u) {
  if (!q) return null;
  if (u === "g") return { pu: precio / (q / 453.592), pl: "lb" };
  if (u === "ml") return { pu: precio / (q / 1000), pl: "L" };
  return { pu: precio / q, pl: "ud" };
}

const VACIAS = new Set("de la el los las con en y para por del al un una bolsa caja paquete".split(" "));
// Clave para decidir si dos productos de tiendas distintas son "el mismo"
export function claveNombre(it) {
  if (!it.q) return null;
  const marca = norm(it.marca).replace(/[^a-z0-9]/g, "");
  const sinTam = norm(limpiaTam(it.nombre)).replace(RE, " ").replace(RE_UD, " ").replace(/docena/g, " ");
  const toks = [...new Set(sinTam.replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/)
    .filter(w => w && !VACIAS.has(w) && w !== marca && !(marca && marca.includes(w) && w.length > 2)))].sort();
  if (!marca && toks.length < 3) return null; // muy poco para asegurar equivalencia
  return `${marca}|${toks.join(" ")}|${it.q}${it.u}`;
}

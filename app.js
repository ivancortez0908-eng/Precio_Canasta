const $ = id => document.getElementById(id);
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const esc = s => (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => "$" + n.toFixed(2);
const fpu = n => "$" + n.toFixed(n < 0.01 ? 4 : n < 0.1 ? 3 : 2);
const puDe = x => (x.pu > 0 ? x.pu : 1e9);   // para ordenar: sin precio por unidad conocido, al final
const TAG = { ean: "Mismo código de barras", nombre: "Coincide por nombre y tamaño", manual: "Equivalencia verificada" };
let D, limite = 60, RV = [], fechaRV = "", busquedaRV = "", ctl, actualizando = false, porGuardar = null, abierto = null, verTodos = false;
const tiendasConocidas = new Set();
// Consultas y opciones por favorito (el objeto, porque un producto puede estar en varias listas)
const pendientes = new Map();
const { equivalente, precioValido, resumir, leerPromo, costo, palabrasBusqueda, coincideBusqueda, dia } = Canasta;
// Oferta y precio anterior que reporta cada tienda; solo valen para esa tienda
const oferta = x => ({ promo: x.promo || null, antes: x.antes > x.precio ? x.antes : null });

// ---------- Listas de favoritos (se guardan en este navegador) ----------
// Cada tienda de un favorito: { p, url, nom, ref, id, f, manual, cambio, src: "cat" | "auto" }.
// manual: elegido por la persona; cambio: elegido en la tabla de comparación; f.sin marca tiendas descartadas.
const CLAVE = "canasta-sv-listas-v1", CLAVE_ANTERIOR = "canasta-sv-favoritos-v1";
const limpiar = items => (Array.isArray(items) ? items : []).filter(f => f && typeof f.id === "string" && f.t && typeof f.t === "object").map(f => ({
  ...f, estado: "Precios guardados. Actualiza para consultar las tiendas.", cant: Math.max(1, Math.min(99, parseInt(f.cant) || 1)),
  // src "man" viene de una versión anterior de la página: equivale a una elección manual
  t: Object.fromEntries(Object.entries(f.t).filter(([, v]) => v && precioValido(v.p)).map(([s, v]) => [s, v.src === "man" ? { ...v, manual: true } : v]))
}));
let LISTAS = [], ACTIVA;
try {
  const d = JSON.parse(localStorage.getItem(CLAVE) || "null");
  if (d && Array.isArray(d.listas)) {
    LISTAS = d.listas.filter(l => l && typeof l.id === "string").map(l => ({ id: l.id, nombre: String(l.nombre || "Mi lista").slice(0, 40), items: limpiar(l.items) }));
    ACTIVA = LISTAS.find(l => l.id === d.activa);
  }
} catch {}
if (!LISTAS.length) {   // primera vez: los favoritos de la versión de una sola lista pasan a «Mi lista»
  let previos = [];
  try { previos = JSON.parse(localStorage.getItem(CLAVE_ANTERIOR) || "[]"); } catch {}
  LISTAS = [{ id: "l1", nombre: "Mi lista", items: limpiar(previos) }];
}
ACTIVA = ACTIVA || LISTAS[0];
let FAV = ACTIVA.items;   // favoritos de la lista que se está viendo
const todos = () => LISTAS.flatMap(l => l.items);
const guardado = f => LISTAS.some(l => l.items.includes(f));
const contar = () => { $("nf").textContent = FAV.length; };
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify({ activa: ACTIVA.id, listas: LISTAS })); } catch {} contar(); };
function crearLista(nombre) {
  const l = { id: "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nombre: nombre.trim().slice(0, 40) || "Lista", items: [] };
  LISTAS.push(l); guardar(); return l;
}
function activar(l) { ACTIVA = l; FAV = l.items; guardar(); }

// Fechas en la hora del dispositivo (las consultas se guardan en UTC)
const hoy = () => dia(new Date().toISOString());
const fecha = f => (f ? dia(f).slice(8, 10) + "/" + dia(f).slice(5, 7) : "");
const MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(" ");
const fechaLarga = f => (f ? `${+f.slice(8, 10)} de ${MESES[+f.slice(5, 7) - 1]}` : "");
const idGrupo = it => "g:" + norm(it.n) + "|" + (it.q || "") + (it.u || "");
const idVivo = x => x.ref || (String(x.id || "").startsWith("v:") ? x.id : "v:" + x.tienda + ":" + (x.id || x.url));
const pidDe = x => String(x.pid ?? (String(x.id || "").startsWith("v:") ? "" : x.id || ""));
// Un producto elegido a mano en la tabla (cambio) puede ser otra presentación: no identifica al favorito
const favoritoVivo = (x, items = todos()) => items.find(f => f.id === idVivo(x) || Object.entries(f.t).some(([s, v]) =>
  s === x.tienda && !v.cambio && (v.ref === idVivo(x) || (v.url === x.url && !/[?&]q=/.test(x.url || "")))));
const favoritoItem = (it, items = todos()) => items.find(f => f.id === it.fid || it.t.some(e =>
  Object.values(f.t).some(v => !v.cambio && v.url && v.url === e[2] && !/[?&]q=/.test(v.url))));
function cancelar(f) { pendientes.get(f)?.abort(); pendientes.delete(f); }
const favDeItem = it => ({ id: it.fid, n: it.n, m: it.m, q: it.q, u: it.u, pl: it.pl,
  t: Object.fromEntries(it.t.map(e => [D.supers[e[0]], { p: e[1], url: e[2], nom: e[4] || it.n, id: e[7] || "", f: D.actualizado, src: "cat" }])) });
// El producto marcado en la búsqueda en vivo lo eligió la persona: queda como elección manual
const favDeVivo = x => ({ id: x.id, n: x.nombre, m: x.marca, q: x.q, u: x.u, pl: x.pl, busqueda: busquedaRV,
  t: { [x.tienda]: { p: x.precio, url: x.url, nom: x.nombre, ref: idVivo(x), id: pidDe(x), f: fechaRV || hoy(), manual: true, ...oferta(x) } } });
// El precio más barato no se indica solo con color: ✓ visible y texto para lectores de pantalla
const barato = html => `<span class="ok" aria-hidden="true">✓</span>${html}<span class="vh"> (más barato)</span>`;
// Etiqueta «Tienda $precio» de las listas compactas del celular (enlace a la tienda si hay URL)
function chip(tienda, precio, mejor, extra = "", url = "") {
  const dentro = `${mejor ? `<span class="ok" aria-hidden="true">✓</span>` : ""}${esc(tienda)} <b>${fmt(precio)}</b>${extra}${mejor ? `<span class="vh"> (más barato)</span>` : ""}`;
  return url ? `<a class="chip${mejor ? " best" : ""}" href="${esc(url)}" target="_blank" rel="noopener">${dentro}</a>` : `<span class="chip${mejor ? " best" : ""}">${dentro}</span>`;
}
const estrella = (attr, on) => `<button class="star" ${attr} aria-pressed="${on}" aria-label="${on ? "Guardado en una lista; cambiar listas" : "Guardar en una lista"}">${on ? "★" : "☆"}</button>`;

// Agrega o quita un producto de una lista. Cada lista guarda su propia copia (cantidad y elecciones).
function alternar(f, lista = ACTIVA) {
  const i = lista.items.findIndex(x => x.id === f.id);
  let nuevo;
  if (i >= 0) cancelar(lista.items.splice(i, 1)[0]);
  else { nuevo = { ...JSON.parse(JSON.stringify(f)), cant: 1 }; lista.items.push(nuevo); }
  guardar(); pintarFav();
  if (nuevo) completarFavorito(nuevo);
}
function mezclarCatalogo(f) {
  if (!D) return;
  for (const it of D.items) {
    const enlazado = it.fid === f.id || it.t.some(e => Object.values(f.t).some(v => !v.cambio && v.url && v.url === e[2] && !/[?&]q=/.test(v.url)));
    if (!enlazado && !equivalente(f, it)) {
      // Lo elegido a mano en la tabla solo actualiza su propio precio, sin llenar las demás tiendas
      for (const e of it.t) {
        const s = D.supers[e[0]], v = f.t[s];
        if (v?.cambio && v.url === e[2] && precioValido(e[1]) && (D.actualizado || "") > (v.f || "")) f.t[s] = { ...v, p: e[1], f: D.actualizado, promo: null, antes: null };
      }
      continue;
    }
    for (const e of it.t) {
      const s = D.supers[e[0]], previo = f.t[s];
      if (f.sin?.[s] || (previo?.manual && previo.url !== e[2])) continue;
      if (precioValido(e[1]) && (!previo || (D.actualizado || "") > (previo.f || "")))
        f.t[s] = { ...previo, p: e[1], url: e[2], nom: e[4] || it.n, id: e[7] || previo?.id || "", f: D.actualizado, src: previo?.manual ? previo.src : "cat", promo: null, antes: null };
    }
  }
}
// El mismo producto de la tienda: por referencia, por ID de la tienda o por enlace (no de búsqueda)
const coincideCon = (previo, x) => previo && (previo.ref === idVivo(x) || (!!previo.id && String(previo.id) === pidDe(x)) || (previo.url === x.url && !/[?&]q=/.test(x.url || "")));
function aplicarResultados(f, resultados, generado) {
  const porTienda = new Map();
  for (const x of resultados) {
    if (!precioValido(x.precio)) continue;
    const opciones = porTienda.get(x.tienda) || [];
    opciones.push(x); porTienda.set(x.tienda, opciones);
  }
  for (const [s, opciones] of porTienda) {
    const previo = f.t[s];
    const exacto = opciones.find(x => coincideCon(previo, x));
    const seguros = opciones.filter(x => equivalente(f, x));
    // Varias coincidencias en una tienda requieren revisión; una tienda descartada no se vuelve a llenar sola.
    const elegido = exacto || (!previo && !f.sin?.[s] && seguros.length === 1 ? seguros[0] : null);
    if (elegido && (!previo || (generado || hoy()) >= (previo.f || ""))) f.t[s] = { p: elegido.precio, url: elegido.url, nom: elegido.nombre,
      ref: idVivo(elegido), id: pidDe(elegido) || previo?.id || "", f: generado || hoy(), manual: previo?.manual || false, ...oferta(elegido),
      ...(exacto && previo.cambio ? { cambio: true } : {}), src: exacto ? previo.src || "auto" : "auto" };
  }
  // Opciones para elegir a mano: se guardan con el favorito (sobreviven al recargar) y las nuevas van primero
  for (const [s, opciones] of porTienda) {
    const nuevas = opciones.filter(x => equivalente(f, x) || coincideBusqueda(f.n, `${x.nombre} ${x.marca || ""}`))
      .map(x => ({ k: idVivo(x), tienda: s, nombre: x.nombre, marca: x.marca || "", precio: x.precio, url: x.url, id: pidDe(x), q: x.q, u: x.u, promo: x.promo || null, antes: x.antes || null }));
    if (!nuevas.length) continue;
    const ks = new Set(nuevas.map(x => x.k));
    f.opc = { ...f.opc, [s]: [...nuevas, ...(f.opc?.[s] || []).filter(x => !ks.has(x.k))].slice(0, MAX_OPC) };
  }
}
const MAX_OPC = 8;
// Productos del catálogo parecidos a un favorito (se calcula una vez por favorito)
const catParecidos = new Map();
function delCatalogo(f) {
  if (!D) return [];
  const k = f.id + "|" + f.n;
  if (!catParecidos.has(k)) catParecidos.set(k, D.items.filter(it => it.fid === f.id || equivalente(f, it) || coincideBusqueda(f.n, it.n + " " + (it.m || ""))).slice(0, 40));
  return catParecidos.get(k);
}
// Opciones para «Cambiar producto» en una tienda: las consultadas y las del catálogo, las equivalentes primero
function opcionesDe(f, s) {
  const out = new Map();
  for (const x of f.opc?.[s] || []) out.set(x.k, x);
  for (const it of delCatalogo(f)) for (const e of it.t) if (D.supers[e[0]] === s && precioValido(e[1])) {
    const x = { tienda: s, nombre: e[4] || it.n, marca: it.m || "", precio: e[1], url: e[2], id: e[7] || "", q: it.q, u: it.u, cat: true };
    x.k = idVivo(x);
    if (!out.has(x.k)) out.set(x.k, x);
  }
  const eq = x => (equivalente(f, x) ? 0 : 1);
  return [...out.values()].sort((a, b) => eq(a) - eq(b) || a.precio - b.precio).slice(0, 15);
}
// Textos de búsqueda: el original y, como respaldo, la marca con las palabras clave del nombre
const PARASITAS = new Set("de la el los las con en y para por del al un una bolsa caja paquete pack unidades unidad ud uds g gr kg lb lbs ml l lt oz".split(" "));
const toks = t => norm(t).replace(/\d+([.,]\d+)?/g, " ").replace(/[^a-zñ ]/g, " ").split(/\s+/).filter(w => w.length > 1 && !PARASITAS.has(w));
function consultas(f) {
  const marca = norm(f.m || "").trim(), mw = marca.split(" ");
  const nom = [...new Set(toks(f.n))].filter(w => !mw.includes(w));
  const a = [marca, ...nom.slice(0, 3)].filter(Boolean).join(" ").slice(0, 60), b = nom.slice(0, 2).join(" ");
  return [...new Set([(f.busqueda || f.n || "").trim().slice(0, 60), a, b])].filter(q => q.length >= 2);
}
// completo: hace todas las búsquedas aunque ya haya coincidencias, para reunir más opciones
async function completarFavorito(f, completo = false) {
  if (!f || pendientes.has(f)) return;
  mezclarCatalogo(f);
  aplicarResultados(f, RV, fechaRV);
  if (!window.API_VIVO) {
    f.estado = "Sin conexión configurada para consultar las demás tiendas.";
    guardar(); pintarFav(true); return;
  }
  const control = new AbortController();
  pendientes.set(f, control);
  f.estado = "Consultando precios en las demás tiendas…";
  guardar(); pintarFav(true);
  const timeout = setTimeout(() => control.abort(), 25000);
  const sigue = () => !control.signal.aborted && guardado(f);
  try {
    const tiendas = {}, resultados = [], vistos = new Set();
    let generado = "", error;
    for (const q of consultas(f)) {
      let d;
      try {
        const r = await fetch(`${window.API_VIVO}?q=${encodeURIComponent(q)}`, { signal: control.signal });
        d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error " + r.status);
        if (!Array.isArray(d.resultados) || !d.tiendas) throw new Error("Respuesta inválida del buscador");
      } catch (e) {
        if (e.name === "AbortError" || !sigue()) throw e;
        error = e; continue;
      }
      if (!sigue()) return;
      generado = generado || d.generado;
      for (const [s, v] of Object.entries(d.tiendas)) if (!tiendas[s]?.ok) tiendas[s] = v;
      for (const x of d.resultados) if (!vistos.has(idVivo(x))) { vistos.add(idVivo(x)); resultados.push(x); }
      // Basta con que cada tienda que respondió tenga una coincidencia segura o el producto ya guardado
      const listas = Object.entries(tiendas).filter(([, v]) => v.ok).map(([s]) => s);
      if (!completo && listas.every(s => resultados.some(x => x.tienda === s && (coincideCon(f.t[s], x) || equivalente(f, x))))) break;
    }
    if (!sigue()) return;
    if (!Object.keys(tiendas).length) throw error || new Error("Sin respuesta del buscador");
    Object.keys(tiendas).forEach(s => tiendasConocidas.add(s));
    f.tiendas = Object.keys(tiendas);
    f.consultado = generado;
    f.fallos = Object.entries(tiendas).filter(([, v]) => !v.ok).map(([s]) => s);
    aplicarResultados(f, resultados, generado);
    f.estado = "Consulta terminada. Revisa las opciones donde falte una coincidencia.";
  } catch (e) {
    if (guardado(f)) f.estado = e.name === "AbortError" ? "La consulta tardó demasiado. Puedes reintentar." : "No se pudo actualizar: " + e.message;
  } finally {
    clearTimeout(timeout);
    if (pendientes.get(f) === control) pendientes.delete(f);
    guardar(); pintarFav(true); pintarVivo(); render();
  }
}
// Procesar en serie evita disparar todas las tiendas por cada favorito a la vez.
async function actualizarItems(items) {
  if (actualizando || !items.length) return;
  actualizando = true; $("favrefresh").disabled = true;
  try {
    for (let i = 0; i < items.length; i++) if (guardado(items[i])) {
      $("favest").textContent = `Consultando las tiendas… (${i + 1} de ${items.length})`;
      await completarFavorito(items[i]);
    }
  } finally { actualizando = false; $("favest").textContent = ""; pintarFav(true); }
}
const actualizarViejos = () => { if (window.API_VIVO) actualizarItems(FAV.filter(f => dia(f.consultado) !== hoy())); };
// Al cargar datos nuevos, actualiza los precios de los favoritos (por producto o por enlace de tienda)
function refrescarFavs() {
  todos().forEach(mezclarCatalogo);
  guardar();
}

// ---------- Catálogo ----------
const tam = it => !it.q ? "" : it.u === "g" ? `${Math.round(it.q)} g (${(it.q / 453.592).toFixed(it.q % 454 < 3 ? 0 : 1)} lb)` : it.u === "ml" ? (it.q >= 1000 ? `${+(it.q / 1000).toFixed(2)} L` : `${it.q} ml`) : `${it.q} ud`;
const desc = it => {
  const f = it.t.filter(e => e[4]);
  if (!f.length) return "";
  return `<details><summary>Descripción</summary>${f.map(e => `<p><b>${esc(D.supers[e[0]])}:</b> ${esc(e[4])}${e[5] ? ` · Marca: ${esc(e[5])}` : ""}${e[6] ? `. ${esc(e[6])}` : ""}</p>`).join("")}</details>`;
};
const dif = it => { const v = it.t.map(x => x[1]); return it.t.length > 1 ? (Math.max(...v) - Math.min(...v)) / Math.min(...v) : -1; };

function filtrar() {
  const ts = norm($("q").value).split(/\s+/).filter(Boolean), c = $("comp").checked, o = $("ord").value;
  const r = D.items.filter(it => ts.every(t => it.s.includes(t)) && (!c || it.t.length > 1));
  if (o === "pu") r.sort((a, b) => puDe(a) - puDe(b));
  if (o === "dif") r.sort((a, b) => dif(b) - dif(a));
  if (o === "n") r.sort((a, b) => a.n.localeCompare(b.n, "es"));
  return r;
}

function render() {
  if (!D) return;
  const r = filtrar(), S = D.supers;
  const q = $("q").value.trim();
  // Con la búsqueda vacía se ven las mayores diferencias del catálogo
  $("cattit").textContent = q ? "En el catálogo guardado" : $("ord").value === "dif" ? "Mayores diferencias entre tiendas" : "Todo el catálogo";
  $("count").textContent = r.length ? `${r.length} producto(s)` : "";
  let h = `<thead><tr><th>Producto</th>${S.map(s => `<th>${esc(s)}</th>`).join("")}<th>Por unidad</th><th>Fav.</th></tr></thead><tbody>`;
  const vacio = `No hay resultados en el catálogo guardado.${q.length > 1 ? " Usa «Buscar en las tiendas» para consultarlo en el momento." : ""}`;
  if (!r.length) h += `<tr><td colspan="${S.length + 3}">${vacio}</td></tr>`;
  for (const it of r.slice(0, limite)) {
    const min = Math.min(...it.t.map(x => x[1]));
    h += `<tr><td>${esc(it.n)}<small>${it.m ? `<span class="marca">${esc(it.m)}</span>` : "Marca no indicada"}${tam(it) ? " · " + tam(it) : ""}${it.k ? `<span class="tag">${TAG[it.k]}</span>` : ""}</small>${desc(it)}</td>` +
      S.map((_, si) => {
        const e = it.t.find(x => x[0] === si);
        if (!e) return `<td class="na">—</td>`;
        const p = fmt(e[1]), v = e[2] ? `<a href="${esc(e[2])}" target="_blank" rel="noopener">${p}</a>` : p;
        return e[1] === min && it.t.length > 1 ? `<td class="best">${barato(v)}</td>` : `<td>${v}</td>`;
      }).join("") +
      `<td>${it.pu > 0 ? `${fpu(it.pu)}<small>por ${it.pl}</small>` : "—"}</td>` +
      `<td>${estrella(`data-i="${it.i}"`, !!favoritoItem(it))}</td></tr>`;
  }
  $("tabla").innerHTML = h + "</tbody>";
  // Celular: nombre, precios con su tienda (el más barato primero), precio por unidad y ☆
  $("mcat").innerHTML = !r.length ? `<p class="msg">${vacio}</p>` : r.slice(0, limite).map(it => {
    const min = Math.min(...it.t.map(x => x[1]));
    return `<article class="mitem"><div class="mfila"><span class="mnom">${esc(it.n)}<small>${it.m ? `<span class="marca">${esc(it.m)}</span>` : "Marca no indicada"}${tam(it) ? " · " + tam(it) : ""}</small></span>` +
      estrella(`data-i="${it.i}"`, !!favoritoItem(it)) +
      `<span class="mprecios">${[...it.t].sort((a, b) => a[1] - b[1]).map(e => chip(S[e[0]], e[1], e[1] === min && it.t.length > 1, "", e[2])).join("")}</span>` +
      (it.pu > 0 ? `<small class="mpu">${fpu(it.pu)} por ${it.pl}</small>` : "") + "</div></article>";
  }).join("");
  $("mas").hidden = r.length <= limite;
}

// Oferta de una tienda: si se cumple con la cantidad pedida, muestra el subtotal; si no, cuántas faltan
function notaOferta(v, cant) {
  const pr = leerPromo(v.promo), antes = v.antes > v.p ? `<small class="antes">antes ${fmt(v.antes)}</small>` : "";
  if (!pr) return antes;
  const txt = pr.total != null ? `${pr.n} x ${fmt(pr.total)}` : pr.segundo != null ? `2.ª unidad al ${pr.segundo}% de descuento` : `${pr.n}x${pr.paga}`;
  if (!(costo(v, pr.n) < Math.round(v.p * 100) * pr.n)) return antes;
  if (cant == null) return `${antes}<small class="promo">Oferta ${txt}</small>`;
  return `${antes}<small class="promo${cant >= pr.n ? " si" : ""}">Oferta ${txt}${cant >= pr.n ? ` · aplicada: ${fmt(costo(v, cant) / 100)} por ${cant}` : ` · lleva ${pr.n} para aplicarla`}</small>`;
}

// ---------- Búsqueda en vivo ----------
function pintarVivo() {
  // Solo los resultados que contienen al menos 2 palabras de la búsqueda, salvo que la persona pida ver todos
  const o = $("ordv").value, r = RV.filter(x => verTodos || x.coincide), ocultos = RV.length - RV.filter(x => x.coincide).length;
  $("ocultos").hidden = !ocultos;
  $("ocultostxt").textContent = verTodos ? `Se muestran también ${ocultos} resultado(s) que no coinciden con 2 palabras de tu búsqueda. `
    : `Se ocultaron ${ocultos} resultado(s) de otros productos (no coinciden con 2 palabras de tu búsqueda). `;
  $("vertodos").textContent = verTodos ? "Ocultar los que no coinciden" : "Mostrar todos";
  r.sort((a, b) => o === "pu" ? puDe(a) - puDe(b) : a.precio - b.precio);
  const min = r.length ? Math.min(...r.map(x => x.precio)) : 0;
  $("tv").innerHTML = r.length
    ? `<thead><tr><th>Producto</th><th>Tienda</th><th>Precio</th><th>Por unidad</th><th>Fav.</th></tr></thead><tbody>` + r.map(x => `<tr>
        <td>${esc(x.nombre)}<small>${x.marca ? `<span class="marca">${esc(x.marca)}</span>` : "Marca no indicada"}${tam(x) ? " · " + tam(x) : ""}</small></td>
        <td><span class="store">${esc(x.tienda)}</span></td>
        <td class="${x.precio === min && r.length > 1 ? "best" : ""}">${(x.precio === min && r.length > 1 ? barato : h => h)(`<a href="${esc(x.url)}" target="_blank" rel="noopener">${fmt(x.precio)}</a>`)}${notaOferta({ p: x.precio, ...oferta(x) })}</td>
        <td>${x.pu > 0 ? `${fpu(x.pu)}<small>por ${x.pl}</small>` : "—"}</td>
        <td>${estrella(`data-id="${esc(x.id)}"`, !!favoritoVivo(x))}</td></tr>`).join("") + "</tbody>"
    : "";
  // Celular: un renglón por resultado con su tienda, precio, oferta y ☆
  $("mvivo").innerHTML = r.map(x => `<article class="mitem"><div class="mfila"><span class="mnom">${esc(x.nombre)}<small>${x.marca ? `<span class="marca">${esc(x.marca)}</span>` : "Marca no indicada"}${tam(x) ? " · " + tam(x) : ""}</small></span>` +
    estrella(`data-id="${esc(x.id)}"`, !!favoritoVivo(x)) +
    `<span class="mprecios">${chip(x.tienda, x.precio, x.precio === min && r.length > 1, leerPromo(x.promo) ? "<i>oferta</i>" : "", x.url)}</span>` +
    `<span class="mpu">${x.pu > 0 ? `<small>${fpu(x.pu)} por ${x.pl}</small>` : ""}${notaOferta({ p: x.precio, ...oferta(x) })}</span></div></article>`).join("");
}
async function vivo(q) {
  $("secvivo").hidden = false;
  if (!window.API_VIVO) { $("estv").textContent = "La búsqueda en vivo aún no está configurada. Mira el README, sección “Búsqueda en vivo”."; return; }
  ctl?.abort(); ctl = new AbortController();
  RV = [];
  $("estv").textContent = `Buscando “${q}” en las tiendas…`; $("tv").innerHTML = "";
  try {
    const r = await fetch(`${window.API_VIVO}?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Error " + r.status);
    RV = d.resultados.map(x => ({ ...x, pid: String(x.id ?? ""), id: idVivo(x), coincide: coincideBusqueda(q, `${x.nombre} ${x.marca || ""}`) }));
    verTodos = false;
    fechaRV = d.generado;
    busquedaRV = q;
    Object.keys(d.tiendas).forEach(s => tiendasConocidas.add(s));
    const est = Object.entries(d.tiendas).map(([t, v]) => v.ok ? `${t}: ${RV.filter(x => x.tienda === t && x.coincide).length} resultado(s)` : `${t}: no respondió`).join(" · ");
    const n = RV.filter(x => x.coincide).length;
    $("estv").textContent = n ? `${est}. Consultado ${new Date(d.generado).toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit" })}`.replace(/\.?$/, ".")
      : `Sin resultados que coincidan con “${q}”. ${est}. Prueba con otras palabras${RV.length ? " o usa «Mostrar todos»" : ""}.`;
    pintarVivo();
  } catch (e) { if (e.name !== "AbortError") $("estv").textContent = "No se pudo consultar: " + e.message; }
}

// ---------- Cuadro «Guardar en una lista» (se abre con la ☆) ----------
const buscarEn = (lista, o) => o.tipo === "item" ? favoritoItem(o.x, lista.items) : favoritoVivo(o.x, lista.items);
const nuevoDe = o => o.tipo === "item" ? favDeItem(o.x) : favDeVivo(o.x);
function pintarDialogo() {
  const o = porGuardar; if (!o) return;
  $("dlprod").textContent = o.tipo === "item" ? o.x.n : `${o.x.nombre} · ${o.x.tienda}`;
  $("dlopts").innerHTML = LISTAS.map(l => `<label><input type="checkbox" data-l="${esc(l.id)}"${buscarEn(l, o) ? " checked" : ""}><span>${esc(l.nombre)} <small>(${l.items.length})</small></span></label>`).join("");
}
function abrirListas(o) {
  porGuardar = o; pintarDialogo();
  const d = $("dlista");
  if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute("open", "");
  $("dlopts").querySelector("input")?.focus();
}
const trasCambio = () => { pintarDialogo(); render(); pintarVivo(); };
$("dlopts").onchange = e => {
  const l = LISTAS.find(x => x.id === e.target.dataset.l); if (!l || !porGuardar) return;
  const ya = buscarEn(l, porGuardar);
  if (!!ya !== e.target.checked) alternar(ya || nuevoDe(porGuardar), l);
  trasCambio();
};
$("dlnueva").onsubmit = e => {
  e.preventDefault();
  const nombre = $("dlnombre").value.trim(); if (!nombre || !porGuardar) return;
  $("dlnombre").value = "";
  alternar(nuevoDe(porGuardar), crearLista(nombre));
  trasCambio();
};
$("dlcerrar").onclick = () => $("dlista").close?.();
$("dlista").onclose = () => { porGuardar = null; };

// ---------- Vista de favoritos: listas, cantidades, quitar y comparación de la compra ----------
const tiendasFav = () => [...new Set([...(D ? D.supers : []), ...tiendasConocidas, ...FAV.flatMap(f => [...Object.keys(f.t), ...(f.tiendas || [])])])];
let repintar = false;
// fondo: lo pide una consulta de precios, no la persona. Redibujar cerraría el selector de «Cambiar producto»
// que se está usando (visible en pantalla), así que se espera a que lo suelte. Agregar, quitar o cambiar siempre redibuja.
function pintarFav(fondo = false) {
  const foco = document.activeElement;
  if (fondo && foco?.matches?.("select[data-fav]") && foco.isConnected && foco.offsetParent !== null) { repintar = true; return; }
  repintar = false;
  const abiertos = new Set([...(document.querySelectorAll?.("details.opciones[open]") || [])].map(x => x.dataset.fav + "|" + x.dataset.store));
  const S = tiendasFav();
  $("lsel").innerHTML = LISTAS.map(l => `<option value="${esc(l.id)}"${l === ACTIVA ? " selected" : ""}>${esc(l.nombre)} (${l.items.length})</option>`).join("");
  const fallan = [...new Set(FAV.flatMap(f => f.fallos || []))];
  $("favmsg").textContent = FAV.length ? `${FAV.length} producto(s) en «${ACTIVA.nombre}».` +
    (fallan.length ? ` No respondieron: ${fallan.join(", ")}. Usa «Actualizar precios» para reintentar.` : "") : `«${ACTIVA.nombre}» está vacía. Marca la ☆ en Buscar y elige esta lista.`;
  $("favresumen").hidden = !FAV.length;
  for (const id of ["favclear", "favres", "favrefresh", "ldescargas"]) $(id).hidden = !FAV.length;
  $("favrefresh").disabled = actualizando || pendientes.size > 0;
  // En celular se ve la versión corta; el nombre completo queda para lectores de pantalla
  $("favrefresh").innerHTML = pendientes.size ? `Consultando<span class="larga"> ${pendientes.size} producto(s)</span>…` : `Actualizar<span class="larga"> precios</span>`;
  $("favrefresh").setAttribute("aria-label", pendientes.size ? `Consultando ${pendientes.size} producto(s)…` : "Actualizar precios");
  if (!FAV.length) { $("tfav").innerHTML = $("mfav").innerHTML = ""; pintarAyuda(); return; }
  // Contenido de cada producto y tienda; lo usan la tabla (computadora) y la lista compacta (celular)
  const filas = FAV.map(f => {
    const ps = Object.values(f.t).map(v => costo(v, f.cant)), min = Math.min(...ps), id = esc(f.id), consultando = pendientes.has(f);
    const info = `<small>${f.m ? `<span class="marca">${esc(f.m)}</span>` : "Marca no indicada"}${tam(f) ? " · " + tam(f) : ""}</small>`, nombre = esc(f.n) + info;
    const acciones = `<small class="consulta">${esc(consultando ? "Consultando las tiendas…" : f.estado || "Precios guardados. Actualiza para consultar las tiendas.")}</small><span class="filafav"><span class="stp"><button data-a="menos" data-id="${id}" aria-label="Menos">−</button><input class="qty" type="number" min="1" max="99" value="${f.cant}" data-id="${id}" aria-label="Cantidad de ${esc(f.n)}"><button data-a="mas" data-id="${id}" aria-label="Más">+</button></span>` +
      `<button class="rm" data-a="rm" data-id="${id}">Quitar</button></span><button class="retry" data-a="refresh" data-id="${id}" ${consultando ? "disabled" : ""}>Consultar tiendas</button>`;
    const celdas = S.map(s => {
      const v = f.t[s], opciones = opcionesDe(f, s);
      const actual = x => v && (v.ref === x.k || (v.url && v.url === x.url));
      const lista = opciones.length ? `<label>Producto en ${esc(s)}<select data-fav="${id}" data-store="${esc(s)}" aria-label="Producto equivalente en ${esc(s)}"><option value="">Selecciona marca y presentación</option>${opciones.map(x => `<option value="${esc(x.k)}">${esc(x.nombre)} · ${fmt(x.precio)}${actual(x) ? " (actual)" : x.cat ? " · catálogo" : ""}</option>`).join("")}${v ? `<option value="ninguno">No está en esta tienda</option>` : ""}</select></label><small>Se usará esta presentación para calcular tu compra.</small>`
        : `<small>Aún no hay opciones de ${esc(s)} para este producto.</small>${v ? `<button class="retry" data-a="ninguno" data-id="${id}" data-store="${esc(s)}">No está en esta tienda</button>` : ""}`;
      const selector = `<details class="opciones" data-fav="${id}" data-store="${esc(s)}"${abiertos.has(f.id + "|" + s) ? " open" : ""}><summary>${v ? "Cambiar producto" : opciones.length ? `Elegir coincidencia (${opciones.length})` : "Buscar coincidencia"}</summary>${lista}` +
        `<button class="retry" data-a="opciones" data-id="${id}" ${consultando ? "disabled" : ""}>${consultando ? "Buscando opciones…" : "Buscar más opciones"}</button></details>`;
      if (!v) return { s, cls: "na", html: `<span>${consultando ? "Consultando…" : f.fallos?.includes(s) ? "Tienda sin respuesta" : f.sin?.[s] ? "Descartado por ti" : "Sin coincidencia"}</span>`, sel: selector };
      const p = v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener">${fmt(v.p)}</a>` : fmt(v.p), mejor = costo(v, f.cant) === min && ps.length > 1;
      return { s, v, mejor, cls: mejor ? "best" : "", html: `${mejor ? barato(p) : p}${notaOferta(v, f.cant)}<small class="product-source">${esc(v.nom || f.n)}</small>${v.f ? `<small class="f">al ${fecha(v.f)}${v.manual ? " · Elegido por ti" : ""}</small>` : ""}`, sel: selector };
    });
    return { f, id, nombre, info, acciones, celdas };
  });
  $("tfav").innerHTML = `<thead><tr><th>Producto y cantidad</th>${S.map(s => `<th>${esc(s)}</th>`).join("")}</tr></thead><tbody>` +
    filas.map(r => `<tr><td>${r.nombre}${r.acciones}</td>${r.celdas.map(c => `<td class="${c.cls}">${c.html}${c.sel}</td>`).join("")}</tr>`).join("") + "</tbody>";
  // Celular: nombre, cantidad y precios con su tienda (de más barato a más caro); al tocar se abre el detalle, uno a la vez
  if (!filas.some(r => r.f.id === abierto)) abierto = null;
  $("mfav").innerHTML = filas.map(r => {
    const con = r.celdas.filter(c => c.v).sort((a, b) => costo(a.v, r.f.cant) - costo(b.v, r.f.cant)), sin = r.celdas.length - con.length, open = r.f.id === abierto;
    return `<article class="mitem${open ? " abierto" : ""}"><button class="mcab" data-a="abrir" data-id="${r.id}" aria-expanded="${open}">` +
      `<span class="mnom">${esc(r.f.n)}</span><span class="mcant">× ${r.f.cant}</span><span class="mprecios">` +
      con.map(c => chip(c.s, c.v.p, c.mejor, leerPromo(c.v.promo) ? "<i>oferta</i>" : "")).join("") +
      (sin ? `<span class="chip na">${sin} sin precio</span>` : "") + `</span></button>` +
      (open ? `<div class="mdet"><div class="mprod">${r.info}${r.acciones}</div>${r.celdas.map(c => `<div class="mtienda ${c.cls}"><b class="mts">${esc(c.s)}</b><div>${c.html}</div><div class="msel">${c.sel}</div></div>`).join("")}</div>` : "") + "</article>";
  }).join("");
  const { res, mix, por, sinPrecio } = resumir(FAV, S);
  const ok = res.filter(r => !r.faltan), min = ok.length ? Math.min(...ok.map(r => r.total)) : null;
  // Semáforo: verde hasta 2 % sobre la más barata, amarillo hasta 10 %, rojo si es más cara o está incompleta
  const nivel = r => {
    if (r.faltan) return ["r", `Faltan ${r.faltan}: total parcial`];
    const p = (r.total - min) / min * 100;
    return p < 0.005 ? ["v", "La compra completa más barata"] : [p <= 2 ? "v" : p <= 10 ? "a" : "r", `+${fmt(r.total - min)} (${p.toFixed(1)} %) vs. la más barata`];
  };
  $("favtot").innerHTML = res.map(r => { const [n, t] = nivel(r); return `<div class="tot ${n}"><span class="dot"></span><span class="tn">${esc(r.s)}</span><b>${r.faltan === FAV.length ? "—" : fmt(r.total)}</b>` +
    `<span class="tl">${FAV.length - r.faltan} de ${FAV.length} productos</span><span class="tl${r.faltan ? " warn" : ""}">${t}</span></div>`; }).join("");
  const gan = ok.find(r => r.total === min);
  // Resumen arriba de la tabla: lo que la persona viene a saber, sin bajar hasta los totales
  $("favresumen").innerHTML = (gan ? `Compra completa más barata: <b>${esc(gan.s)} ${fmt(min)}</b>` : "Ninguna tienda tiene todos los productos") +
    ` · Combinando tiendas: <b>${fmt(mix)}</b>${sinPrecio ? " (parcial)" : ""} · <a href="#favres">Ver detalle</a>`;
  $("favmix").textContent = `Comprando cada producto donde es más barato: ${fmt(mix)} (${Object.entries(por).map(([s, n]) => `${n} unidad(es) en ${s}`).join(", ")})` +
    (sinPrecio ? `. Total parcial: ${sinPrecio} producto(s) sin precio.` : "") +
    (gan && mix < min - 0.004 ? `. Ahorras ${fmt(min - mix)} frente a comprar todo en ${gan.s}.` : ".");
  pintarAyuda();
}
function descartar(f, s) { f.sin = { ...f.sin, [s]: true }; delete f.t[s]; }

// ---------- Descargar la lista: PDF (impresión del navegador) o Excel ----------
const archivo = () => (norm(ACTIVA.nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lista") + "-" + hoy();
const nota = () => `Canasta SV · ${new Date().toLocaleDateString("es-SV", { day: "numeric", month: "long", year: "numeric" })} · Precios en USD de las tiendas en línea; pueden variar en sala. Una tienda sin precio no cuenta como $0.`;
function descargar(nombre, datos, tipo) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([datos], { type: tipo })); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("favxlsx").onclick = () => descargar(archivo() + ".xlsx", Exportar.xlsx(ACTIVA.nombre, nota(), Exportar.tablaLista(FAV, tiendasFav(), tam)),
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
$("favpdf").onclick = () => {
  const t = Exportar.tablaLista(FAV, tiendasFav(), tam);
  const celda = (v, i) => typeof v === "number" && i !== 3 ? fmt(v) : esc(String(v));
  const filas = (lista, etq) => lista.map(f => `<tr>${f.map((v, i) => `<${etq}>${celda(v, i)}</${etq}>`).join("")}</tr>`).join("");
  $("imprimir").innerHTML = `<h1>${esc(ACTIVA.nombre)}</h1><p>${esc(nota())}</p><table><thead>${filas([t.cabecera], "th")}</thead><tbody>${filas(t.filas, "td")}</tbody><tfoot>${filas(t.pie, "td")}</tfoot></table>`;
  // El título de la página es el nombre que el navegador propone para el PDF
  const titulo = document.title;
  document.title = archivo();
  window.addEventListener("afterprint", () => { document.title = titulo; }, { once: true });
  window.print();
};

// ---------- Pregunta al pie: compartir las comparaciones que cambiaste en la tabla ----------
// Solo entran grupos con al menos un producto elegido en la tabla; junto a él van los del catálogo o elegidos por ti.
// Un enlace de búsqueda no identifica un producto.
function equivalenciasLocal() {
  const out = new Map();
  for (const f of todos()) {
    const es = Object.entries(f.t).filter(([, v]) => (v.manual || v.src === "cat") && (v.id || (v.url && !/[?&]q=/.test(v.url))));
    if (es.length < 2 || !es.some(([, v]) => v.cambio)) continue;
    const g = es.map(([s, v]) => ({ tienda: s, id: v.id ? String(v.id) : "", url: v.url || "", nombre: v.nom || "" }));
    out.set(claveGrupo(g), g);
  }
  return [...out.values()];
}
const claveGrupo = g => g.map(x => x.tienda + "#" + (x.id || x.url)).sort().join("|");
const ENVK = "canasta-sv-aportes-v1";
let ENV = {}, graciasHasta = 0;
try { ENV = JSON.parse(localStorage.getItem(ENVK) || "{}"); } catch {}
if (!ENV || typeof ENV !== "object" || Array.isArray(ENV)) ENV = {};
const guardarEnv = () => { try { localStorage.setItem(ENVK, JSON.stringify(ENV)); } catch {} };
const aportesPendientes = () => equivalenciasLocal().filter(g => !ENV[claveGrupo(g)]);   // ENV[clave] = "enviado" | "no"
function pintarAyuda() {
  const p = window.API_VIVO ? aportesPendientes() : [];
  $("ayuda").hidden = !p.length && Date.now() > graciasHasta;
  if (!p.length) return;
  if ($("ayudadet").hidden) $("ayudamsg").textContent = `Cambiaste ${p.length} comparación(es) en la tabla de precios. Si las compartes, mejoran la base para todos.`;
  $("ayudalista").innerHTML = p.map(g => `<li><b>${esc(g[0].nombre)}</b> — ${g.map(x => esc(x.tienda)).join(" ↔ ")}</li>`).join("");
}
const cerrarAyuda = () => { $("ayudadet").hidden = true; $("ayudasn").hidden = false; };
$("ayudasi").onclick = () => { $("ayudadet").hidden = false; $("ayudasn").hidden = true; $("aest").textContent = ""; $("ayudamsg").textContent = "Esto es lo que se enviaría:"; };
$("ayudano").onclick = () => { for (const g of aportesPendientes()) ENV[claveGrupo(g)] = "no"; guardarEnv(); pintarAyuda(); };
$("acancel").onclick = () => { cerrarAyuda(); pintarAyuda(); };
$("aenviar").onclick = async () => {
  const p = aportesPendientes(); $("aest").textContent = "Enviando…";
  try {
    const r = await fetch(window.API_VIVO, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grupos: p }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "Error " + r.status);
    p.forEach(g => { ENV[claveGrupo(g)] = "enviado"; }); guardarEnv();
    cerrarAyuda(); graciasHasta = Date.now() + 8000; $("ayudamsg").textContent = "¡Gracias! Tu aporte se envió" + (j.numero ? ` (#${j.numero})` : "") + " y será revisado.";
    setTimeout(pintarAyuda, 8100);
  } catch (e) { $("aest").textContent = "No se pudo enviar: " + e.message + ". Puedes intentarlo más tarde."; }
};

// ---------- Pestañas y eventos ----------
function pestana(n) {
  for (const i of [1, 2]) { $("p" + i).hidden = i !== n; $("tab" + i).setAttribute("aria-selected", i === n); $("tab" + i).tabIndex = i === n ? 0 : -1; }
  if (n === 1) { render(); pintarVivo(); }
  // Al abrir Mi lista se consultan los productos que no se actualizaron hoy
  if (n === 2) { pintarFav(); actualizarViejos(); }
}
$("tab1").onclick = () => pestana(1);
$("tab2").onclick = () => pestana(2);
document.querySelector(".tabs").onkeydown = e => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  const actual = [1, 2].find(i => $("tab" + i).getAttribute("aria-selected") === "true");
  const siguiente = e.key === "Home" ? 1 : e.key === "End" ? 2 : actual === 1 ? 2 : 1;
  pestana(siguiente); $("tab" + siguiente).focus();
};
$("q").oninput = $("comp").onchange = $("ord").onchange = () => { limite = 60; render(); };
$("mas").onclick = () => { limite += 60; render(); };
$("tabla").onclick = e => {
  const b = e.target.closest(".star");
  if (b) abrirListas({ tipo: "item", x: D.items[+b.dataset.i] });
};
$("mcat").onclick = e => $("tabla").onclick(e);
// Enter o «Buscar en las tiendas»: consulta cada tienda con lo que se escribió
$("fbuscar").onsubmit = e => { e.preventDefault(); const q = $("q").value.trim(); if (q.length >= 2) vivo(q); else $("q").focus(); };
$("ordv").onchange = pintarVivo;
$("mvivo").onclick = e => $("tv").onclick(e);
$("vertodos").onclick = () => { verTodos = !verTodos; pintarVivo(); };
$("tv").onclick = e => {
  const b = e.target.closest(".star"), x = b && RV.find(r => r.id === b.dataset.id);
  if (x) abrirListas({ tipo: "vivo", x });
};
$("tfav").onclick = e => {
  const b = e.target.closest("button"), f = b && FAV.find(x => x.id === b.dataset.id); if (!f) return;
  if (b.dataset.a === "refresh") { completarFavorito(f); return; }
  if (b.dataset.a === "opciones") { completarFavorito(f, true); return; }
  if (b.dataset.a === "ninguno") { descartar(f, b.dataset.store); guardar(); pintarFav(); pintarVivo(); render(); return; }
  if (b.dataset.a === "rm") { cancelar(f); FAV.splice(FAV.indexOf(f), 1); }
  else f.cant = Math.max(1, Math.min(99, f.cant + (b.dataset.a === "mas" ? 1 : -1)));
  guardar(); pintarFav(); pintarVivo(); render();
};
$("tfav").onchange = e => {
  if (e.target.matches("select[data-fav]")) {
    const f = FAV.find(x => x.id === e.target.dataset.fav), s = e.target.dataset.store; if (!f) return;
    if (e.target.value === "ninguno") descartar(f, s);
    else {
      const x = e.target.value !== "" && opcionesDe(f, s).find(o => o.k === e.target.value);
      if (!x) return;
      f.t[s] = { p: x.precio, url: x.url, nom: x.nombre, ref: x.k, id: pidDe(x), f: x.cat ? D.actualizado : f.consultado || fechaRV || hoy(), manual: true, cambio: true, ...(x.cat ? { src: "cat" } : {}), ...oferta(x) };
      if (f.sin) delete f.sin[s];
    }
    guardar(); pintarFav(); pintarVivo(); render();
    return;
  }
  const f = e.target.classList.contains("qty") && FAV.find(x => x.id === e.target.dataset.id);
  if (f) { f.cant = Math.max(1, Math.min(99, parseInt(e.target.value) || 1)); guardar(); pintarFav(); }
};
// Lista compacta del celular: tocar un producto abre su detalle y cierra el anterior; el resto, igual que la tabla
$("mfav").onclick = e => {
  const b = e.target.closest("[data-a]");
  if (b?.dataset.a === "abrir") { abierto = abierto === b.dataset.id ? null : b.dataset.id; pintarFav(); return; }
  $("tfav").onclick(e);
};
$("mfav").onchange = e => $("tfav").onchange(e);
// Al soltar un selector de «Cambiar producto» se muestra lo que llegó mientras tanto
document.addEventListener?.("focusout", e => { if (repintar && e.target.matches?.("select[data-fav]")) setTimeout(() => pintarFav(), 0); });
$("lsel").onchange = e => { const l = LISTAS.find(x => x.id === e.target.value); if (l) { activar(l); pintarFav(); actualizarViejos(); } };
$("lnueva").onclick = () => { const n = prompt("Nombre de la nueva lista:"); if (n && n.trim()) { activar(crearLista(n)); pintarFav(); } };
$("lrenombrar").onclick = () => { const n = prompt("Nuevo nombre de la lista:", ACTIVA.nombre); if (n && n.trim()) { ACTIVA.nombre = n.trim().slice(0, 40); guardar(); pintarFav(); } };
$("lborrar").onclick = () => {
  if (!confirm(`¿Eliminar la lista «${ACTIVA.nombre}» y sus ${FAV.length} producto(s)?`)) return;
  FAV.forEach(cancelar);
  LISTAS.splice(LISTAS.indexOf(ACTIVA), 1);
  if (!LISTAS.length) LISTAS.push({ id: "l1", nombre: "Mi lista", items: [] });
  activar(LISTAS[0]); pintarFav(); pintarVivo(); render();
};
$("favclear").onclick = () => { if (confirm(`¿Vaciar la lista «${ACTIVA.nombre}»?`)) { FAV.forEach(cancelar); FAV.length = 0; guardar(); pintarFav(); pintarVivo(); render(); } };
$("favrefresh").onclick = () => actualizarItems([...FAV]);
// Menú «⋯» de la lista: se cierra al elegir, con Esc o tocando fuera; flechas para moverse
function menuLista(abrir, enfocar = true) {
  $("lacciones").hidden = !abrir; $("lmenu").setAttribute("aria-expanded", abrir);
  if (abrir && enfocar) $("lacciones").querySelector("button:not([hidden])")?.focus();
}
const itemsMenu = () => [...$("lacciones").querySelectorAll("button")].filter(visible);
$("lmenu").onclick = () => menuLista($("lacciones").hidden);
$("lacciones").addEventListener?.("click", e => { if (e.target.closest("button")) menuLista(false, false); });
$("lacciones").onkeydown = e => {
  const its = itemsMenu(), i = its.indexOf(document.activeElement);
  if (e.key === "Escape") { menuLista(false); $("lmenu").focus(); }
  else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
    e.preventDefault();
    its[e.key === "Home" ? 0 : e.key === "End" ? its.length - 1 : (i + (e.key === "ArrowDown" ? 1 : its.length - 1)) % its.length]?.focus();
  } else if (e.key === "Tab") menuLista(false, false);
};
// (los toques dentro de la guía de uso no cuentan: la guía abre el menú para mostrarlo)
document.addEventListener?.("click", e => { if (!$("lacciones").hidden && !e.target.closest?.(".menu, #guia")) menuLista(false, false); });

// ---------- Guía de uso: pasos con el elemento resaltado; simula la búsqueda y el cuadro de listas sin cambiar las listas ----------
const visible = el => !!el && el.getClientRects().length > 0;
const primero = (...sel) => sel.map(x => document.querySelector(x)).find(visible) || null;
const conLista = (si, no) => () => FAV.length ? si : no;
const GUIA = [
  { t: "Así funciona Canasta SV", tab: 1, x: "Compara los precios de los supermercados de El Salvador. En unos pasos verás cómo buscar un producto, guardarlo en una lista y comparar tu compra. La guía no cambia tus listas." },
  { t: "Busca un producto", tab: 1, q: true, escribir: true, el: () => $("q"), x: "Escribe un producto o una marca. Los resultados del catálogo aparecen mientras escribes." },
  { t: "Consulta las tiendas en el momento", tab: 1, q: true, el: () => $("fbuscar").querySelector("button"), x: "Si no lo encuentras o quieres el precio de hoy, toca «Buscar en las tiendas»: se consulta cada supermercado al instante." },
  { t: "Compara los precios", tab: 1, q: true, el: () => primero("#tabla tbody tr", "#mcat .mitem"), x: "Cada producto muestra su precio en cada tienda. El más barato lleva ✓ y fondo verde; también ves el precio por libra, litro o unidad." },
  { t: "Guárdalo en una lista", tab: 1, q: true, el: () => primero("#tabla tbody .star", "#mcat .star"), x: "Toca la ☆ del producto para guardarlo como favorito." },
  { t: "Elige la lista", tab: 1, q: true, dlg: true, el: () => $("dlopts"), x: "Marca una o varias listas. Cada lista guarda su propia cantidad y tus elecciones." },
  { t: "O crea una lista nueva", tab: 1, q: true, dlg: true, nombre: true, el: () => $("dlnueva"), x: "Escribe un nombre, por ejemplo «Compras del mes», y toca «Crear y agregar»." },
  { t: "Termina con «Listo»", tab: 1, q: true, dlg: true, el: () => $("dlcerrar"), x: "Al guardar un producto, la página lo busca en las demás tiendas para compararlo." },
  { t: "Abre tus listas", tab: 1, q: true, el: () => $("tab2"), x: "Aquí ves tus listas. El número indica cuántos productos tiene la lista que estás viendo." },
  { t: "Elige la lista y actualiza", tab: 2, el: () => $("lsel").closest(".controls"),
    x: conLista("Elige la lista que quieres ver. «Actualizar precios» vuelve a consultar las tiendas.", "Elige la lista que quieres ver. Cuando tenga productos, «Actualizar precios» volverá a consultar las tiendas.") },
  { t: "Más opciones en ⋯", tab: 2, menu: true, el: () => primero("#lacciones", "#lmenu"),
    x: conLista("Aquí creas una lista nueva, le cambias el nombre, la descargas en PDF o Excel, la vacías o la eliminas.", "Aquí creas una lista nueva, le cambias el nombre o la eliminas. Con productos también podrás descargarla en PDF o Excel y vaciarla.") },
  { t: "Cantidades y precios por tienda", tab: 2, el: () => primero("#tfav tbody tr", "#mfav .mitem"),
    x: conLista("Ajusta la cantidad con − y +. Cada tienda muestra su precio y su fecha; con «Cambiar producto» eliges otra presentación si no es la correcta.", "Cuando agregues productos, cada uno mostrará su cantidad (− y +) y el precio de cada tienda con su fecha. Con «Cambiar producto» eliges otra presentación si no es la correcta.") },
  { t: "Compara tu compra", tab: 2, el: () => primero("#favtot"),
    x: conLista("Verde: la tienda más barata para toda la lista (o hasta 2 % más). Amarillo: hasta 10 % más cara. Rojo: más cara o le faltan productos. También ves cuánto pagas combinando tiendas.", "Con productos en la lista verás el total en cada tienda: verde la más barata, amarillo hasta 10 % más cara y rojo más cara o con productos faltantes.") },
  { t: "¡Listo!", el: () => $("guiabtn"), x: "Vuelve a ver esta guía cuando quieras con este botón." }
];
let guiaPaso = 0, guiaPrevio = null, guiaTimer = null, guiaDemo = "";
const lento = () => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function guiaBuscar(q, escribir) {
  clearInterval(guiaTimer);
  if ($("q").value === q) return;
  const poner = v => { $("q").value = v; limite = 60; render(); guiaColocar(); };
  if (!escribir || !lento()) { poner(q); return; }
  let i = 0; poner("");
  guiaTimer = setInterval(() => { poner(q.slice(0, ++i)); if (i >= q.length) clearInterval(guiaTimer); }, 90);
}
function guiaEstado(p) {
  if (p.tab && $("p" + p.tab).hidden) pestana(p.tab);
  if (p.tab) guiaBuscar(p.q ? guiaDemo : guiaPrevio.q, p.escribir);
  $("dlnombre").value = p.nombre ? "Compras del mes" : "";
  menuLista(!!p.menu, false);
  if (!p.dlg && $("dlista").open) $("dlista").close();
  const item = D && (filtrar()[0] || D.items[0]);
  if (p.dlg && !$("dlista").open && item) {
    abrirListas({ tipo: "item", x: item });
    // el cuadro de listas se abrió encima: la guía vuelve al frente
    $("guia").close(); $("guia").showModal();
  }
}
function guiaIr(n) {
  guiaPaso = Math.max(0, Math.min(GUIA.length - 1, n));
  const p = GUIA[guiaPaso];
  guiaEstado(p);
  $("guiapaso").textContent = `Paso ${guiaPaso + 1} de ${GUIA.length}`;
  $("guiatit").textContent = p.t;
  $("guiatxt").textContent = typeof p.x === "function" ? p.x() : p.x;
  $("guiaant").hidden = guiaPaso === 0;
  $("guiasig").textContent = guiaPaso === GUIA.length - 1 ? "Terminar" : "Siguiente";
  const el = p.el?.();
  if (visible(el)) el.scrollIntoView({ block: "center", inline: "nearest" });
  guiaColocar();
  $("guiasig").focus();
}
// Resalta el elemento del paso y pone la ventanita debajo (o encima) señalándolo; sin elemento, al centro
function guiaColocar() {
  if (!guiaPrevio) return;
  const el = GUIA[guiaPaso].el?.(), luz = $("guialuz"), card = $("guiacard"), fl = $("guiaflecha");
  const W = innerWidth, H = innerHeight, m = 16, w = card.offsetWidth, h = card.offsetHeight;
  const px = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v) + "px"]));
  if (!visible(el)) {
    Object.assign(luz.style, px({ left: W / 2, top: H / 2, width: 0, height: 0 }));
    luz.classList.add("centro"); fl.hidden = true;
    Object.assign(card.style, px({ left: (W - w) / 2, top: Math.max(m, (H - h) / 2) }));
    return;
  }
  const r = el.getBoundingClientRect(), L = Math.max(4, r.left - 6), T = Math.max(4, r.top - 6), R = Math.min(W - 4, r.right + 6), B = Math.min(H - 4, r.bottom + 6);
  Object.assign(luz.style, px({ left: L, top: T, width: R - L, height: B - T }));
  luz.classList.remove("centro");
  let top, lado = "arriba";
  if (B + 14 + h <= H - 8) top = B + 14;
  else if (T - 14 - h >= 8) { top = T - 14 - h; lado = "abajo"; }
  else { top = H - h - m; lado = ""; }
  const left = Math.min(Math.max(m, (L + R) / 2 - w / 2), W - w - m);
  Object.assign(card.style, px({ left, top }));
  fl.hidden = !lado; fl.className = "guia-flecha " + lado;
  fl.style.left = Math.round(Math.min(Math.max(14, (L + R) / 2 - left - 7), w - 28)) + "px";
}
function guiaFin() {
  if (!guiaPrevio) return;
  const prev = guiaPrevio; guiaPrevio = null;
  clearInterval(guiaTimer);
  window.removeEventListener("resize", guiaColocar); window.removeEventListener("scroll", guiaColocar, true);
  if ($("guia").open) $("guia").close();
  if ($("dlista").open) $("dlista").close();
  $("dlnombre").value = "";
  menuLista(false, false);
  if ($("q").value !== prev.q) { $("q").value = prev.q; limite = 60; render(); }
  if ($("p" + prev.tab).hidden) pestana(prev.tab);
  window.scrollTo(0, prev.y);
  $("guiabtn").focus();
}
$("guiabtn").onclick = () => {
  if (guiaPrevio) return;
  guiaPrevio = { q: $("q").value, tab: $("p1").hidden ? 2 : 1, y: window.scrollY };
  guiaDemo = ["leche", "arroz", "frijol", "huevos"].find(w => D?.items.some(it => it.s.includes(w))) || "leche";
  window.addEventListener("resize", guiaColocar); window.addEventListener("scroll", guiaColocar, true);
  $("guia").showModal();
  guiaIr(0);
};
$("guiasig").onclick = () => guiaPaso === GUIA.length - 1 ? guiaFin() : guiaIr(guiaPaso + 1);
$("guiaant").onclick = () => guiaIr(guiaPaso - 1);
$("guiasalir").onclick = guiaFin;
$("guia").oncancel = e => { e.preventDefault(); guiaFin(); };
// Al volver la guía al frente se cierra y se abre de nuevo: solo termina si de verdad quedó cerrada
$("guia").onclose = () => { if (!$("guia").open) guiaFin(); };

contar();
pintarFav();
fetch("data/productos.json").then(r => { if (!r.ok) throw 0; return r.json(); }).then(d => {
  D = d;
  D.items.forEach((it, i) => { it.i = i; it.fid = idGrupo(it); it.s = norm(it.n + " " + it.m + " " + it.t.map(e => (e[4] || "") + " " + (e[5] || "")).join(" ")); });
  refrescarFavs();
  $("fecha").textContent = D.ejemplo ? "Catálogo de ejemplo (no son precios reales)." : `Catálogo actualizado al ${fechaLarga(D.actualizado)}.`;
  $("foot").textContent = D.ejemplo
    ? "Datos de ejemplo (no son precios reales). Ejecuta la acción “Actualizar precios” en GitHub para cargar los reales."
    : `Precios en USD tomados de las tiendas en línea. Actualizado: ${D.actualizado}. Pueden diferir de los precios en sala.`;
  if (D.supers.length < 2) { $("comp").checked = false; $("comp").disabled = true; $("comp").parentElement.title = "Se activa cuando haya 2 o más tiendas con datos"; }
  render(); pintarFav();
}).catch(() => { $("fecha").textContent = "No se pudo cargar el catálogo."; $("tabla").innerHTML = "<tr><td>No se pudieron cargar los precios. Si abriste el archivo directo, usa GitHub Pages o un servidor local (python3 -m http.server).</td></tr>"; pintarFav(); });

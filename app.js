const $ = id => document.getElementById(id);
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const esc = s => (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => "$" + n.toFixed(2);
const fpu = n => "$" + n.toFixed(n < 0.1 ? 3 : 2);
const TAG = { ean: "Mismo código de barras", nombre: "Coincide por nombre y tamaño", manual: "Equivalencia verificada" };
let D, limite = 60, RV = [], fechaRV = "", busquedaRV = "", ctl, actualizando = false;
const tiendasConocidas = new Set();
const pendientes = new Map(), candidatos = new Map();
const { equivalente, precioValido, resumir } = Canasta;

// ---------- Favoritos (se guardan en este navegador) ----------
// Cada tienda de un favorito: { p, url, nom, ref, id, f, manual, src: "cat" | "auto" }; f.sin marca tiendas descartadas.
const CLAVE = "canasta-sv-favoritos-v1";
let FAV = [];
try { FAV = JSON.parse(localStorage.getItem(CLAVE) || "[]"); } catch {}
if (!Array.isArray(FAV)) FAV = [];
FAV = FAV.filter(f => f && typeof f.id === "string" && f.t && typeof f.t === "object").map(f => ({
  ...f, estado: "Precios guardados. Actualiza para consultar las tiendas.", cant: Math.max(1, Math.min(99, parseInt(f.cant) || 1)),
  // src "man" viene de la versión anterior de la página: equivale a una elección manual
  t: Object.fromEntries(Object.entries(f.t).filter(([, v]) => v && precioValido(v.p)).map(([s, v]) => [s, v.src === "man" ? { ...v, manual: true } : v]))
}));
const contar = () => { $("nf").textContent = FAV.length; };
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(FAV)); } catch {} contar(); };
const hoy = () => new Date().toISOString().slice(0, 10);
const fecha = f => (f ? f.slice(8, 10) + "/" + f.slice(5, 7) : "");
const idGrupo = it => "g:" + norm(it.n) + "|" + (it.q || "") + (it.u || "");
const idVivo = x => x.ref || (String(x.id || "").startsWith("v:") ? x.id : "v:" + x.tienda + ":" + (x.id || x.url));
const pidDe = x => String(x.pid ?? (String(x.id || "").startsWith("v:") ? "" : x.id || ""));
const favoritoVivo = x => FAV.find(f => f.id === idVivo(x) || Object.entries(f.t).some(([s, v]) =>
  s === x.tienda && (v.ref === idVivo(x) || (v.url === x.url && !/[?&]q=/.test(x.url || "")))));
const favoritoItem = it => FAV.find(f => f.id === it.fid || it.t.some(e =>
  Object.values(f.t).some(v => v.url && v.url === e[2] && !/[?&]q=/.test(v.url))));
function cancelar(id) { pendientes.get(id)?.abort(); pendientes.delete(id); candidatos.delete(id); }
const favDeItem = it => ({ id: it.fid, n: it.n, m: it.m, q: it.q, u: it.u, pl: it.pl,
  t: Object.fromEntries(it.t.map(e => [D.supers[e[0]], { p: e[1], url: e[2], nom: e[4] || it.n, id: e[7] || "", f: D.actualizado, src: "cat" }])) });
// El producto marcado en la búsqueda en vivo lo eligió la persona: queda como elección manual
const favDeVivo = x => ({ id: x.id, n: x.nombre, m: x.marca, q: x.q, u: x.u, pl: x.pl, busqueda: busquedaRV,
  t: { [x.tienda]: { p: x.precio, url: x.url, nom: x.nombre, ref: idVivo(x), id: pidDe(x), f: fechaRV || hoy(), manual: true } } });
const estrella = (attr, on) => `<button class="star" ${attr} aria-pressed="${on}" aria-label="${on ? "Quitar de favoritos" : "Agregar a favoritos"}">${on ? "★" : "☆"}</button>`;

function alternar(f, b) {
  const i = FAV.findIndex(x => x.id === f.id);
  i >= 0 ? FAV.splice(i, 1) : FAV.push({ ...f, cant: 1 });
  guardar(); pintarFav();
  if (b) { const on = i < 0; b.setAttribute("aria-pressed", on); b.textContent = on ? "★" : "☆"; b.setAttribute("aria-label", on ? "Quitar de favoritos" : "Agregar a favoritos"); }
  if (i < 0) completarFavorito(FAV.find(x => x.id === f.id));
  else cancelar(f.id);
}
function mezclarCatalogo(f) {
  if (!D) return;
  for (const it of D.items) {
    const enlazado = it.fid === f.id || it.t.some(e => Object.values(f.t).some(v => v.url && v.url === e[2] && !/[?&]q=/.test(v.url)));
    if (!enlazado && !equivalente(f, it)) continue;
    for (const e of it.t) {
      const s = D.supers[e[0]], previo = f.t[s];
      if (f.sin?.[s] || (previo?.manual && previo.url !== e[2])) continue;
      if (precioValido(e[1]) && (!previo || (D.actualizado || "") > (previo.f || "")))
        f.t[s] = { ...previo, p: e[1], url: e[2], nom: e[4] || it.n, id: e[7] || previo?.id || "", f: D.actualizado, src: previo?.manual ? previo.src : "cat" };
    }
  }
}
const coincideCon = (previo, x) => previo && (previo.ref === idVivo(x) || (previo.url === x.url && !/[?&]q=/.test(x.url || "")));
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
      ref: idVivo(elegido), id: pidDe(elegido) || previo?.id || "", f: generado || hoy(), manual: previo?.manual || false, src: exacto ? previo.src || "auto" : "auto" };
  }
  candidatos.set(f.id, porTienda);
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
async function completarFavorito(f) {
  if (!f || pendientes.has(f.id)) return;
  mezclarCatalogo(f);
  aplicarResultados(f, RV, fechaRV);
  if (!window.API_VIVO) {
    f.estado = "Sin conexión configurada para consultar las demás tiendas.";
    guardar(); pintarFav(); return;
  }
  const control = new AbortController();
  pendientes.set(f.id, control);
  f.estado = "Consultando precios en las demás tiendas…";
  guardar(); pintarFav();
  const timeout = setTimeout(() => control.abort(), 25000);
  const sigue = () => !control.signal.aborted && FAV.includes(f);
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
      if (listas.every(s => resultados.some(x => x.tienda === s && (coincideCon(f.t[s], x) || equivalente(f, x))))) break;
    }
    if (!sigue()) return;
    if (!Object.keys(tiendas).length) throw error || new Error("Sin respuesta del buscador");
    Object.keys(tiendas).forEach(s => tiendasConocidas.add(s));
    f.tiendas = Object.keys(tiendas);
    f.consultado = generado;
    f.fallos = Object.entries(tiendas).filter(([, v]) => !v.ok).map(([s]) => s);
    aplicarResultados(f, resultados, generado);
    f.estado = f.fallos.length ? `No respondieron: ${f.fallos.join(", ")}. Puedes reintentar.` : "Consulta terminada. Revisa las opciones donde falte una coincidencia.";
  } catch (e) {
    if (FAV.includes(f)) f.estado = e.name === "AbortError" ? "La consulta tardó demasiado. Puedes reintentar." : "No se pudo actualizar: " + e.message;
  } finally {
    clearTimeout(timeout);
    if (pendientes.get(f.id) === control) pendientes.delete(f.id);
    guardar(); pintarFav(); pintarVivo(); render();
  }
}
// Procesar en serie evita disparar todas las tiendas por cada favorito a la vez.
async function actualizarLista(lista) {
  if (actualizando || !lista.length) return;
  actualizando = true; $("favrefresh").disabled = true;
  try {
    for (let i = 0; i < lista.length; i++) if (FAV.includes(lista[i])) {
      $("favest").textContent = `Consultando las tiendas… (${i + 1} de ${lista.length})`;
      await completarFavorito(lista[i]);
    }
  } finally { actualizando = false; $("favest").textContent = ""; pintarFav(); }
}
// Al cargar datos nuevos, actualiza los precios de los favoritos (por producto o por enlace de tienda)
function refrescarFavs() {
  FAV.forEach(mezclarCatalogo);
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
  if (o === "pu") r.sort((a, b) => (a.pu ?? 1e9) - (b.pu ?? 1e9));
  if (o === "dif") r.sort((a, b) => dif(b) - dif(a));
  if (o === "n") r.sort((a, b) => a.n.localeCompare(b.n, "es"));
  return r;
}

function render() {
  if (!D) return;
  const r = filtrar(), S = D.supers;
  $("count").textContent = r.length ? `${r.length} producto(s)` : "";
  let h = `<thead><tr><th>Producto</th>${S.map(s => `<th>${esc(s)}</th>`).join("")}<th>Por unidad</th><th>Fav.</th></tr></thead><tbody>`;
  if (!r.length) h += `<tr><td colspan="${S.length + 3}">No hay resultados en el catálogo guardado.${$("q").value.trim().length > 1 ? ` <button class="envivo">Buscar “${esc($("q").value.trim())}” en vivo</button>` : ""}</td></tr>`;
  for (const it of r.slice(0, limite)) {
    const min = Math.min(...it.t.map(x => x[1]));
    h += `<tr><td>${esc(it.n)}<small>${it.m ? `<span class="marca">${esc(it.m)}</span>` : "Marca no indicada"}${tam(it) ? " · " + tam(it) : ""}${it.k ? `<span class="tag">${TAG[it.k]}</span>` : ""}</small>${desc(it)}</td>` +
      S.map((_, si) => {
        const e = it.t.find(x => x[0] === si);
        if (!e) return `<td class="na">—</td>`;
        const p = fmt(e[1]), v = e[2] ? `<a href="${esc(e[2])}" target="_blank" rel="noopener">${p}</a>` : p;
        return `<td class="${e[1] === min && it.t.length > 1 ? "best" : ""}">${v}</td>`;
      }).join("") +
      `<td>${it.pu != null ? `${fpu(it.pu)}<small>por ${it.pl}</small>` : "—"}</td>` +
      `<td>${estrella(`data-i="${it.i}"`, !!favoritoItem(it))}</td></tr>`;
  }
  $("tabla").innerHTML = h + "</tbody>";
  $("mas").hidden = r.length <= limite;
}

// ---------- Búsqueda en vivo ----------
function pintarVivo() {
  const o = $("ordv").value, r = [...RV];
  r.sort((a, b) => o === "pu" ? (a.pu ?? 1e9) - (b.pu ?? 1e9) : a.precio - b.precio);
  const min = r.length ? Math.min(...r.map(x => x.precio)) : 0;
  $("tv").innerHTML = r.length
    ? `<thead><tr><th>Producto</th><th>Tienda</th><th>Precio</th><th>Por unidad</th><th>Fav.</th></tr></thead><tbody>` + r.map(x => `<tr>
        <td>${esc(x.nombre)}<small>${x.marca ? `<span class="marca">${esc(x.marca)}</span>` : "Marca no indicada"}${tam(x) ? " · " + tam(x) : ""}</small></td>
        <td><span class="store">${esc(x.tienda)}</span></td>
        <td class="${x.precio === min && r.length > 1 ? "best" : ""}"><a href="${esc(x.url)}" target="_blank" rel="noopener">${fmt(x.precio)}</a></td>
        <td>${x.pu != null ? `${fpu(x.pu)}<small>por ${x.pl}</small>` : "—"}</td>
        <td>${estrella(`data-id="${esc(x.id)}"`, !!favoritoVivo(x))}</td></tr>`).join("") + "</tbody>"
    : "";
}
async function vivo(q) {
  if (!window.API_VIVO) { $("estv").textContent = "La búsqueda en vivo aún no está configurada. Mira el README, sección “Búsqueda en vivo”."; return; }
  ctl?.abort(); ctl = new AbortController();
  RV = [];
  $("estv").textContent = `Buscando “${q}” en las tiendas…`; $("tv").innerHTML = "";
  try {
    const r = await fetch(`${window.API_VIVO}?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Error " + r.status);
    RV = d.resultados.map(x => ({ ...x, pid: String(x.id ?? ""), id: idVivo(x) }));
    fechaRV = d.generado;
    busquedaRV = q;
    Object.keys(d.tiendas).forEach(s => tiendasConocidas.add(s));
    const est = Object.entries(d.tiendas).map(([t, v]) => v.ok ? `${t}: ${v.n} resultado(s)` : `${t}: no respondió`).join(" · ");
    $("estv").textContent = RV.length ? `${est}. Consultado ${new Date(d.generado).toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit" })}.` : `Sin resultados para “${q}”. ${est}. Prueba con otra palabra.`;
    pintarVivo();
  } catch (e) { if (e.name !== "AbortError") $("estv").textContent = "No se pudo consultar: " + e.message; }
}

// ---------- Vista de favoritos: cantidades, quitar y comparación de la compra ----------
function pintarFav() {
  const S = [...new Set([...(D ? D.supers : []), ...tiendasConocidas, ...FAV.flatMap(f => [...Object.keys(f.t), ...(f.tiendas || [])])])];
  $("favmsg").textContent = FAV.length ? `${FAV.length} producto(s). Cada uno se busca en todas las tiendas y solo estos se comparan para tu compra.` : "Aún no tienes favoritos. Marca la ☆ en el catálogo o en la búsqueda en vivo para armar tu lista de compra.";
  $("favclear").hidden = !FAV.length; $("favres").hidden = !FAV.length;
  $("favrefresh").hidden = !FAV.length;
  $("favrefresh").disabled = actualizando || pendientes.size > 0;
  $("favrefresh").textContent = pendientes.size ? `Consultando ${pendientes.size} producto(s)…` : "Actualizar precios";
  if (!FAV.length) { $("tfav").innerHTML = ""; pintarEntrena(); return; }
  let h = `<thead><tr><th>Producto</th>${S.map(s => `<th>${esc(s)}</th>`).join("")}<th>Cantidad</th><th></th></tr></thead><tbody>`;
  for (const f of FAV) {
    const ps = Object.values(f.t).map(v => v.p), min = Math.min(...ps), id = esc(f.id);
    h += `<tr><td>${esc(f.n)}<small>${f.m ? `<span class="marca">${esc(f.m)}</span>` : "Marca no indicada"}${tam(f) ? " · " + tam(f) : ""}</small><small class="consulta">${esc(pendientes.has(f.id) ? "Consultando las tiendas…" : f.estado || "Precios guardados. Actualiza para consultar las tiendas.")}</small><button class="retry" data-a="refresh" data-id="${id}" ${pendientes.has(f.id) ? "disabled" : ""}>Consultar tiendas</button></td>` +
      S.map(s => {
        const v = f.t[s], opciones = candidatos.get(f.id)?.get(s) || [];
        const selector = opciones.length ? `<details class="opciones"><summary>${v ? "Cambiar producto" : `Elegir coincidencia (${opciones.length})`}</summary><label>Producto en ${esc(s)}<select data-fav="${id}" data-store="${esc(s)}" aria-label="Producto equivalente en ${esc(s)}"><option value="">Selecciona marca y presentación</option>${opciones.map((x, i) => `<option value="${i}">${esc(x.nombre)} · ${fmt(x.precio)}</option>`).join("")}</select></label><small>Se usará esta presentación para calcular tu compra.</small></details>` : "";
        if (!v) return `<td class="na"><span>${pendientes.has(f.id) ? "Consultando…" : f.fallos?.includes(s) ? "Tienda sin respuesta" : f.sin?.[s] ? "Descartado por ti" : "Sin coincidencia"}</span>${selector}</td>`;
        const p = v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener">${fmt(v.p)}</a>` : fmt(v.p);
        return `<td class="${v.p === min && ps.length > 1 ? "best" : ""}">${p}<small class="product-source">${esc(v.nom || f.n)}</small>${v.f ? `<small class="f">al ${fecha(v.f)}${v.manual ? " · Elegido por ti" : ""}</small>` : ""}${selector}</td>`;
      }).join("") +
      `<td><span class="stp"><button data-a="menos" data-id="${id}" aria-label="Menos">−</button><input class="qty" type="number" min="1" max="99" value="${f.cant}" data-id="${id}" aria-label="Cantidad de ${esc(f.n)}"><button data-a="mas" data-id="${id}" aria-label="Más">+</button></span></td>` +
      `<td><button class="rm" data-a="rm" data-id="${id}">Quitar</button></td></tr>`;
  }
  $("tfav").innerHTML = h + "</tbody>";
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
  $("favmix").textContent = `Comprando cada producto donde es más barato: ${fmt(mix)} (${Object.entries(por).map(([s, n]) => `${n} unidad(es) en ${s}`).join(", ")})` +
    (sinPrecio ? `. Total parcial: ${sinPrecio} producto(s) sin precio.` : "") +
    (gan && mix < min - 0.004 ? `. Ahorras ${fmt(min - mix)} frente a comprar todo en ${gan.s}.` : ".");
  pintarEntrena();
}

// ---------- Registro de decisiones y entrenamiento de la base ----------
const REGK = "canasta-sv-registro-v1";
let REG = [];
try { REG = JSON.parse(localStorage.getItem(REGK) || "[]"); } catch {}
REG = Array.isArray(REG) ? REG.filter(x => x && typeof x.fecha === "string" && x.ref && typeof x.tienda === "string") : [];
const guardarReg = () => { try { localStorage.setItem(REGK, JSON.stringify(REG)); } catch {} };
function anotar(f, tienda, accion, v) {   // accion: eligio | confirmo | ninguno
  REG.push({ fecha: new Date().toISOString(), ref: { n: f.n, m: f.m || "", q: f.q || null, u: f.u || null }, tienda, accion,
    producto: v ? { id: v.id || "", nombre: v.nom || "", precio: v.p ?? null, url: v.url || "" } : null });
  if (REG.length > 500) REG.shift();
  guardarReg();
}
function descartar(f, s) { const v = f.t[s]; f.sin = { ...f.sin, [s]: true }; delete f.t[s]; anotar(f, s, "ninguno", v); }
// Grupos de productos que confirmaste como equivalentes (formato de scraper/equivalencias.json).
// Solo entran precios del catálogo o elegidos por ti; un enlace de búsqueda no identifica un producto.
function equivalenciasLocal() {
  const out = [];
  for (const f of FAV) {
    const es = Object.entries(f.t).filter(([, v]) => (v.manual || v.src === "cat") && (v.id || (v.url && !/[?&]q=/.test(v.url))));
    if (es.length >= 2 && es.some(([, v]) => v.manual))
      out.push(es.map(([s, v]) => ({ tienda: s, id: v.id ? String(v.id) : "", url: v.url || "", nombre: v.nom || "" })));
  }
  return out;
}
const claveGrupo = g => g.map(x => x.tienda + "#" + (x.id || x.url)).sort().join("|");
async function armarEquivalencias() {   // junta lo que ya está publicado con lo nuevo
  let base = [];
  try { const r = await fetch("scraper/equivalencias.json", { cache: "no-store" }); if (r.ok) { const j = await r.json(); if (Array.isArray(j)) base = j; } } catch {}
  const vistos = new Set(base.map(claveGrupo));
  for (const g of equivalenciasLocal()) if (!vistos.has(claveGrupo(g))) { base.push(g); vistos.add(claveGrupo(g)); }
  return base;
}
const descargar = (nombre, obj) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" })); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };

// ---------- Pregunta al pie: compartir las comparaciones nuevas ----------
const ENVK = "canasta-sv-aportes-v1";
let ENV = {}, graciasHasta = 0;
try { ENV = JSON.parse(localStorage.getItem(ENVK) || "{}"); } catch {}
if (!ENV || typeof ENV !== "object" || Array.isArray(ENV)) ENV = {};
const guardarEnv = () => { try { localStorage.setItem(ENVK, JSON.stringify(ENV)); } catch {} };
const aportesPendientes = () => equivalenciasLocal().filter(g => !ENV[claveGrupo(g)]);   // ENV[clave] = "enviado" | "no"
function pintarAyuda() {
  const p = aportesPendientes();
  $("ayuda").hidden = !p.length && Date.now() > graciasHasta;
  if (!p.length) return;
  if ($("ayudadet").hidden) $("ayudamsg").textContent = `Tienes ${p.length} comparación(es) nueva(s) que confirmaste. Si las compartes, mejoran la base para todos.`;
  $("ayudalista").innerHTML = p.map(g => `<li><b>${esc(g[0].nombre)}</b> — ${g.map(x => esc(x.tienda)).join(" ↔ ")}</li>`).join("");
  $("aenviar").hidden = !window.API_VIVO; $("acorreo").hidden = !window.CORREO_APORTES;
}
const cerrarAyuda = () => { $("ayudadet").hidden = true; $("ayudasn").hidden = false; };
$("ayudasi").onclick = () => { $("ayudadet").hidden = false; $("ayudasn").hidden = true; $("aest").textContent = ""; $("ayudamsg").textContent = "Esto es lo que se enviaría:"; };
$("ayudano").onclick = () => { for (const g of aportesPendientes()) ENV[claveGrupo(g)] = "no"; guardarEnv(); pintarAyuda(); };
$("acancel").onclick = () => { cerrarAyuda(); pintarAyuda(); };
$("adesc").onclick = () => descargar("aporte-equivalencias.json", aportesPendientes());
$("acorreo").onclick = () => {
  descargar("aporte-equivalencias.json", aportesPendientes());
  $("aest").textContent = "Se descargó el archivo. Adjúntalo al correo que se abrirá.";
  location.href = `mailto:${window.CORREO_APORTES}?subject=${encodeURIComponent("Aporte de equivalencias - Canasta SV")}&body=${encodeURIComponent("Adjunto el archivo aporte-equivalencias.json.")}`;
};
$("aenviar").onclick = async () => {
  const p = aportesPendientes(); $("aest").textContent = "Enviando…";
  try {
    const r = await fetch(window.API_VIVO, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grupos: p }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "Error " + r.status);
    p.forEach(g => { ENV[claveGrupo(g)] = "enviado"; }); guardarEnv();
    cerrarAyuda(); graciasHasta = Date.now() + 8000; $("ayudamsg").textContent = "¡Gracias! Tu aporte se envió" + (j.numero ? ` (#${j.numero})` : "") + " y será revisado.";
    setTimeout(pintarAyuda, 8100);
  } catch (e) { $("aest").textContent = "No se pudo enviar: " + e.message + ". Puedes descargar el archivo o prepararlo por correo."; }
};
function pintarEntrena() {
  pintarAyuda();
  $("entrena").hidden = !FAV.length && !REG.length;
  if ($("entrena").hidden) return;
  const estado = v => v.manual ? "Confirmado por ti" : v.src === "cat" ? "Catálogo" : "Automático (sin confirmar)", filas = [];
  for (const f of FAV) for (const [s, v] of Object.entries(f.t)) filas.push([f, s, v]);
  $("tent").innerHTML = filas.length ? `<thead><tr><th>Producto de referencia</th><th>Tienda</th><th>Producto encontrado</th><th>Estado</th><th>¿Es el mismo?</th></tr></thead><tbody>` +
    filas.map(([f, s, v]) => `<tr><td>${esc(f.n)}</td><td>${esc(s)}</td><td>${esc(v.nom || "")}<small>${fmt(v.p)}</small></td><td>${estado(v)}</td><td><span class="stp">${!v.manual && v.src !== "cat" ? `<button data-a="ok" data-id="${esc(f.id)}" data-s="${esc(s)}">✓ Sí</button>` : ""}<button class="rm" data-a="no" data-id="${esc(f.id)}" data-s="${esc(s)}">✗ No</button></span></td></tr>`).join("") + "</tbody>" : "";
  $("nreg").textContent = REG.length;
  $("treg").innerHTML = REG.length ? `<thead><tr><th>Fecha</th><th>Referencia</th><th>Tienda</th><th>Decisión</th><th>Producto</th></tr></thead><tbody>` +
    [...REG].reverse().slice(0, 100).map(x => `<tr><td>${esc(x.fecha.slice(0, 16).replace("T", " "))}</td><td>${esc(x.ref.n)}</td><td>${esc(x.tienda)}</td><td>${{ eligio: "Eligió", ninguno: "Descartó", confirmo: "Confirmó" }[x.accion] || ""}</td><td>${esc(x.producto ? x.producto.nombre : "—")}</td></tr>`).join("") + "</tbody>" : "";
  $("entmsg").textContent = `${equivalenciasLocal().length} equivalencia(s) listas para entrenar la base · ${REG.length} decisión(es) en el registro.`;
}

// ---------- Pestañas y eventos ----------
function pestana(n) {
  for (const i of [1, 2, 3]) { $("p" + i).hidden = i !== n; $("tab" + i).setAttribute("aria-selected", i === n); $("tab" + i).tabIndex = i === n ? 0 : -1; }
  if (n === 1) render(); if (n === 2) pintarVivo();
  // Al abrir Favoritos se consultan los que no se actualizaron hoy
  if (n === 3) { pintarFav(); if (window.API_VIVO) actualizarLista(FAV.filter(f => (f.consultado || "").slice(0, 10) !== hoy())); }
}
$("tab1").onclick = () => pestana(1);
$("tab2").onclick = () => { pestana(2); $("qv").focus(); };
$("tab3").onclick = () => pestana(3);
document.querySelector(".tabs").onkeydown = e => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  const actual = [1, 2, 3].find(i => $("tab" + i).getAttribute("aria-selected") === "true");
  const siguiente = e.key === "Home" ? 1 : e.key === "End" ? 3 : ((actual - 1 + (e.key === "ArrowRight" ? 1 : 2)) % 3) + 1;
  pestana(siguiente); $("tab" + siguiente).focus();
};
$("q").oninput = $("comp").onchange = $("ord").onchange = () => { limite = 60; render(); };
$("mas").onclick = () => { limite += 60; render(); };
$("tabla").onclick = e => {
  if (e.target.classList.contains("envivo")) { $("qv").value = $("q").value.trim(); pestana(2); vivo($("qv").value); return; }
  const b = e.target.closest(".star");
  if (b) { const it = D.items[+b.dataset.i]; alternar(favoritoItem(it) || favDeItem(it), b); render(); pintarVivo(); }
};
$("fvivo").onsubmit = e => { e.preventDefault(); const q = $("qv").value.trim(); if (q.length >= 2) vivo(q); };
$("ordv").onchange = pintarVivo;
$("tv").onclick = e => {
  const b = e.target.closest(".star"), x = b && RV.find(r => r.id === b.dataset.id);
  if (x) { alternar(favoritoVivo(x) || favDeVivo(x), b); pintarVivo(); render(); }
};
$("tfav").onclick = e => {
  const b = e.target.closest("button"), f = b && FAV.find(x => x.id === b.dataset.id); if (!f) return;
  if (b.dataset.a === "refresh") { completarFavorito(f); return; }
  if (b.dataset.a === "rm") { cancelar(f.id); FAV.splice(FAV.indexOf(f), 1); }
  else f.cant = Math.max(1, Math.min(99, f.cant + (b.dataset.a === "mas" ? 1 : -1)));
  guardar(); pintarFav(); pintarVivo(); render();
};
$("tfav").onchange = e => {
  if (e.target.matches("select[data-fav]")) {
    const f = FAV.find(x => x.id === e.target.dataset.fav), s = e.target.dataset.store;
    const x = e.target.value !== "" && candidatos.get(f?.id)?.get(s)?.[Number(e.target.value)];
    if (x) {
      f.t[s] = { p: x.precio, url: x.url, nom: x.nombre, ref: idVivo(x), id: pidDe(x), f: f.consultado || fechaRV || hoy(), manual: true };
      if (f.sin) delete f.sin[s];
      anotar(f, s, "eligio", f.t[s]);
      guardar(); pintarFav(); pintarVivo(); render();
    }
    return;
  }
  const f = e.target.classList.contains("qty") && FAV.find(x => x.id === e.target.dataset.id);
  if (f) { f.cant = Math.max(1, Math.min(99, parseInt(e.target.value) || 1)); guardar(); pintarFav(); }
};
$("tent").onclick = e => {
  const b = e.target.closest("button"), f = b && FAV.find(x => x.id === b.dataset.id); if (!f || !f.t[b.dataset.s]) return;
  const s = b.dataset.s;
  if (b.dataset.a === "ok") { f.t[s].manual = true; anotar(f, s, "confirmo", f.t[s]); } else descartar(f, s);
  guardar(); pintarFav(); pintarVivo(); render();
};
$("expeq").onclick = async () => descargar("equivalencias.json", await armarEquivalencias());
$("expcopy").onclick = async () => {
  try { await navigator.clipboard.writeText(JSON.stringify(await armarEquivalencias(), null, 1)); $("entmsg").textContent = "Copiado. Pégalo en scraper/equivalencias.json de GitHub."; }
  catch { $("entmsg").textContent = "No se pudo copiar; usa «Descargar»."; }
};
$("expreg").onclick = () => descargar("registro-decisiones.json", REG);
$("reglimp").onclick = () => { if (confirm("¿Borrar el registro de decisiones? No afecta tus favoritos.")) { REG = []; guardarReg(); pintarEntrena(); } };
$("favclear").onclick = () => { if (confirm("¿Vaciar toda la lista de favoritos?")) { pendientes.forEach((_, id) => cancelar(id)); candidatos.clear(); FAV = []; guardar(); pintarFav(); pintarVivo(); render(); } };
$("favrefresh").onclick = () => actualizarLista([...FAV]);

contar();
pintarFav();
fetch("data/productos.json").then(r => { if (!r.ok) throw 0; return r.json(); }).then(d => {
  D = d;
  D.items.forEach((it, i) => { it.i = i; it.fid = idGrupo(it); it.s = norm(it.n + " " + it.m + " " + it.t.map(e => (e[4] || "") + " " + (e[5] || "")).join(" ")); });
  refrescarFavs();
  $("foot").textContent = D.ejemplo
    ? "Datos de ejemplo (no son precios reales). Ejecuta la acción “Actualizar precios” en GitHub para cargar los reales."
    : `Precios en USD tomados de las tiendas en línea. Actualizado: ${D.actualizado}. Pueden diferir de los precios en sala.`;
  if (D.supers.length < 2) { $("comp").checked = false; $("comp").disabled = true; $("comp").parentElement.title = "Se activa cuando haya 2 o más tiendas con datos"; }
  render(); pintarFav();
}).catch(() => { $("tabla").innerHTML = "<tr><td>No se pudieron cargar los precios. Si abriste el archivo directo, usa GitHub Pages o un servidor local (python3 -m http.server).</td></tr>"; pintarFav(); });

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { equivalente, resumir, leerPromo, costo, palabrasBusqueda, coincideBusqueda } = require('../comparador.js');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { tablaLista, xlsx } = require('../exportar.js');
const base = { nombre: 'Leche entera Salud 1 L', marca: 'Salud', q: 1000, u: 'ml' };
const producto = (tienda, precio, extra = {}) => ({ ...base, tienda, precio, id: tienda + '-1', url: 'https://tienda.test/' + tienda + '/1', ...extra });
const respuesta = resultados => ({ resultados, generado: '2026-10-17T12:00:00Z', tiendas: {
  Walmart: { ok: true, n: 1 }, Selectos: { ok: true, n: 1 }, Despensa: { ok: false }
} });

test('equivalencias: orden, unidades normalizadas y marca omitida en una fuente', () => {
  assert.ok(equivalente(base, { ...base, nombre: 'Salud Leche Entera 1000 ml', marca: '' }));
  assert.ok(equivalente({ nombre: 'Frijol rojo Marca 1 lb', marca: 'Marca', q: 454, u: 'g' },
    { nombre: 'Marca frijol rojo 454 g', marca: 'Marca', q: 453.592, u: 'g' }));
});
test('rechaza otra marca, sabor, tamaño, concentración o información insuficiente', () => {
  for (const cambio of [{ marca: 'Otra' }, { nombre: 'Leche descremada Salud 1 L' }, { q: 2000 }, { q: null }, { u: 'g' }])
    assert.equal(equivalente(base, { ...base, ...cambio }), false);
  assert.equal(equivalente({ ...base, marca: '' }, { ...base, marca: '' }), false);
  assert.equal(equivalente({ nombre: 'Medicamento Marca 500 mg 20 tabletas', marca: 'Marca', q: 20, u: 'ud' },
    { nombre: 'Medicamento Marca 250 mg 20 tabletas', marca: 'Marca', q: 20, u: 'ud' }), false);
});
test('totales por cantidad, centavos, cobertura parcial y compra combinada', () => {
  const f = [ { cant: 3, t: { A: { p: .1 }, B: { p: .2 } } }, { cant: 2, t: { A: { p: 1.25 } } } ];
  const r = resumir(f, ['A', 'B', 'C']);
  assert.deepEqual(r.res, [{ s: 'A', total: 2.8, faltan: 0 }, { s: 'B', total: .6, faltan: 1 }, { s: 'C', total: 0, faltan: 2 }]);
  assert.equal(r.mix, 2.8);
  assert.deepEqual(r.por, { A: 5 });
  assert.equal(resumir([{ cant: 1, t: {} }], ['A']).sinPrecio, 1);
});

function interfaz({ resultados = [], datos, fallo = false, guardados = [], porConsulta } = {}) {
  const elements = new Map();
  function el(id) {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', hidden: false, checked: true,
      dataset: {}, setAttribute(k, v) { this[k] = String(v); }, getAttribute(k) { return this[k]; }, focus() {}, querySelector: () => null, parentElement: {} });
    return elements.get(id);
  }
  el('ordv').value = 'pu'; el('ord').value = 'pu';
  el('ayudadet').hidden = true;
  const ANTERIOR = 'canasta-sv-favoritos-v1', LISTAS = 'canasta-sv-listas-v1', almacen = new Map([[ANTERIOR, JSON.stringify(guardados)]]), consultas = [];
  const context = vm.createContext({
    document: { getElementById: el, querySelector: () => el('tabs') },
    window: { API_VIVO: 'https://worker.test' },
    localStorage: { getItem: k => almacen.get(k) ?? null, setItem: (k, value) => { almacen.set(k, value); } },
    AbortController, setTimeout, clearTimeout, console, confirm: () => true,
    fetch: async url => {
      if (url === 'data/productos.json') return { ok: !!datos, json: async () => datos };
      if (fallo) throw Error('Sin conexión');
      const q = decodeURIComponent(String(url).split('?q=')[1] || ''); consultas.push(q);
      return { ok: true, json: async () => respuesta(porConsulta ? porConsulta(q) : resultados) };
    }
  });
  for (const file of ['comparador.js', 'exportar.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  const listas = () => JSON.parse(almacen.get(LISTAS) || 'null');
  // saved(): productos de la lista activa, tal como quedaron guardados
  return { run: code => vm.runInContext(code, context), el, consultas, listas,
    saved: () => { const d = listas(); return d ? d.listas.find(l => l.id === d.activa).items : JSON.parse(almacen.get(ANTERIOR)); } };
}
const terminar = () => new Promise(resolve => setImmediate(resolve));

test('al marcar un resultado consulta otras tiendas, guarda una fila y muestra totales', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75)] });
  await ui.run('vivo("leche salud")');
  ui.run('$("q").value = "leche salud"; alternar(favDeVivo(RV[0]));');
  await terminar();
  const f = ui.saved();
  assert.equal(f.length, 1);
  assert.equal(f[0].t.Selectos.p, 1.75);
  assert.equal(ui.run('!!favoritoVivo(RV[1])'), true);
  assert.match(ui.el('favtot').innerHTML, /\$1.75/);
  assert.match(ui.el('favtot').innerHTML, /total parcial/);
  assert.match(ui.el('tfav').innerHTML, /Tienda sin respuesta/);
  ui.run('FAV[0].cant = 3; pintarFav();');
  assert.match(ui.el('favtot').innerHTML, /\$5.25/);
});
test('una presentación distinta queda como opción manual y persiste al recargar', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 3, { q: 2000, nombre: 'Leche entera Salud 2 L' })] });
  await ui.run('vivo("leche")');
  ui.run('alternar(favDeVivo(RV[0]));'); await terminar();
  assert.equal(ui.saved()[0].t.Selectos, undefined);
  assert.match(ui.el('tfav').innerHTML, /Elegir coincidencia/);
  ui.run('$("tfav").onchange({target:{matches:()=>true,dataset:{fav:FAV[0].id,store:"Selectos"},value:idVivo(RV[1])}})');
  assert.equal(ui.saved()[0].t.Selectos.p, 3);
  assert.equal(ui.saved()[0].t.Selectos.manual, true);
  const reabierta = interfaz({ guardados: ui.saved() }); await terminar();
  assert.match(reabierta.el('tfav').innerHTML, /Elegido por ti/);
});
test('fallo de red conserva el favorito y permite reintentar', async () => {
  const ui = interfaz({ fallo: true });
  ui.run(`alternar(favDeVivo(${JSON.stringify(producto('Walmart', 2))}));`); await terminar();
  assert.equal(ui.saved()[0].t.Walmart.p, 2);
  assert.match(ui.el('tfav').innerHTML, /No se pudo actualizar/);
  assert.equal(ui.el('favrefresh').disabled, false);
});
test('varias coincidencias seguras en una tienda requieren elección manual', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75),
    producto('Selectos', 1.65, { id: 'selectos-2', url: 'https://tienda.test/Selectos/2' })] });
  await ui.run('vivo("leche")');
  ui.run('alternar(favDeVivo(RV[0]));'); await terminar();
  assert.equal(ui.saved()[0].t.Selectos, undefined);
  assert.match(ui.el('tfav').innerHTML, /Elegir coincidencia \(2\)/);
});
test('eliminar mientras se consulta no restaura el favorito con una respuesta tardía', async () => {
  const ui = interfaz(); await terminar();
  ui.run('fetch = () => new Promise(resolve => { globalThis.responder = resolve; });');
  ui.run(`alternar(favDeVivo(${JSON.stringify(producto('Walmart', 2))}));`);
  assert.equal(ui.run('pendientes.size'), 1);
  ui.run('$("tfav").onclick({target:{closest:()=>({dataset:{a:"rm",id:FAV[0].id}})}})');
  ui.run(`responder({ok:true,json:async()=>(${JSON.stringify(respuesta([producto('Walmart', 2), producto('Selectos', 1.75)]))})});`);
  await terminar();
  assert.equal(ui.saved().length, 0);
  assert.equal(ui.run('pendientes.size'), 0);
});
test('dos productos PriceSmart con un enlace de búsqueda compartido conservan IDs diferentes', () => {
  const ui = interfaz();
  assert.equal(ui.run('idVivo({tienda:"PriceSmart",id:"123",url:"https://p.test/?q=leche"}) === idVivo({tienda:"PriceSmart",id:"456",url:"https://p.test/?q=leche"})'), false);
});
test('catálogo antiguo no reemplaza un precio en vivo más reciente', async () => {
  const favorito = { id: 'g:leche|1000ml', n: base.nombre, m: 'Salud', q: 1000, u: 'ml', cant: 1,
    t: { Walmart: { p: 2, url: 'https://tienda.test/Walmart/1', f: '2026-10-17T12:00:00Z' } } };
  const ui = interfaz({ guardados: [favorito], datos: { supers: ['Walmart'], actualizado: '2026-10-15', items: [
    { n: base.nombre, m: 'Salud', q: 1000, u: 'ml', t: [[0, 1.5, 'https://tienda.test/Walmart/1']] }
  ] } });
  assert.equal(ui.el('cargando').hidden, false);
  await terminar();
  assert.equal(ui.saved()[0].t.Walmart.p, 2);
  assert.equal(ui.el('cargando').hidden, true);   // el «Espere…» se quita al cargar el catálogo
});
test('reutilizar una búsqueda antigua no rebaja la fecha ni reemplaza precios recientes', async () => {
  const ui = interfaz(); await terminar();
  ui.run(`const f = { n: "Leche entera Salud 1 L", m: "Salud", q: 1000, u: "ml", t: {
    Walmart: {p:2,ref:"v:Walmart:Walmart-1",f:"2026-10-17T15:00:00Z"}
  }}; aplicarResultados(f, [${JSON.stringify(producto('Walmart', 1.5))}], "2026-10-17T12:00:00Z");`);
  assert.equal(ui.run('f.t.Walmart.p'), 2);
});
test('un catálogo nuevo conserva una presentación elegida manualmente', async () => {
  const favorito = { id: 'g:leche entera salud 1 l|1000ml', n: base.nombre, m: 'Salud', q: 1000, u: 'ml', cant: 1,
    t: { Selectos: { p: 3, url: 'https://tienda.test/otra-presentacion', nom: 'Leche Salud 2 L', f: '2026-10-15', manual: true } } };
  const ui = interfaz({ guardados: [favorito], datos: { supers: ['Selectos'], actualizado: '2026-10-17', items: [
    { n: base.nombre, m: 'Salud', q: 1000, u: 'ml', t: [[0, 1.5, 'https://tienda.test/Selectos/1']] }
  ] } }); await terminar();
  assert.equal(ui.saved()[0].t.Selectos.p, 3);
  assert.equal(ui.saved()[0].t.Selectos.manual, true);
});
test('descartar una tienda la quita y una consulta nueva no la vuelve a llenar', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75)] });
  await ui.run('vivo("leche salud")');
  ui.run('alternar(favDeVivo(RV[0]));'); await terminar();
  assert.equal(ui.saved()[0].t.Selectos.p, 1.75);
  assert.equal(ui.saved()[0].t.Selectos.src, 'auto');
  ui.run('$("tfav").onchange({target:{matches:()=>true,dataset:{fav:FAV[0].id,store:"Selectos"},value:"ninguno"}})');
  assert.equal(ui.saved()[0].t.Selectos, undefined);
  await ui.run('completarFavorito(FAV[0])');
  assert.equal(ui.saved()[0].t.Selectos, undefined);
  assert.match(ui.el('tfav').innerHTML, /Descartado por ti/);
});
test('solo propone enviar comparaciones cambiadas a mano en la tabla, con el ID de cada tienda', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75)] });
  await ui.run('vivo("leche salud")');
  ui.run('alternar(favDeVivo(RV[0]));'); await terminar();
  // Una coincidencia automática no se envía ni hace aparecer la pregunta
  assert.equal(ui.run('equivalenciasLocal().length'), 0);
  assert.equal(ui.el('ayuda').hidden, true);
  ui.run('$("tfav").onchange({target:{matches:()=>true,dataset:{fav:FAV[0].id,store:"Selectos"},value:idVivo(RV[1])}})');
  const grupos = ui.run('equivalenciasLocal()');
  assert.deepEqual(JSON.parse(JSON.stringify(grupos)).map(g => g.map(x => x.tienda + ':' + x.id)), [['Walmart:Walmart-1', 'Selectos:Selectos-1']]);
  assert.equal(ui.el('ayuda').hidden, false);
  assert.match(ui.el('ayudamsg').textContent, /Cambiaste 1 comparación/);
});
test('favoritos de la versión anterior conservan sus elecciones manuales', async () => {
  const ui = interfaz({ guardados: [{ id: 'v:Walmart:x', n: base.nombre, m: 'Salud', q: 1000, u: 'ml', cant: 2,
    t: { Walmart: { p: 2, url: 'https://tienda.test/x', f: '2026-10-16', src: 'man', id: '9' } } }] }); await terminar();
  assert.equal(ui.run('FAV[0].t.Walmart.manual'), true);
  assert.equal(ui.run('FAV[0].cant'), 2);
  assert.equal(ui.run('ACTIVA.nombre'), 'Mi lista');
});
test('si la primera búsqueda no encuentra el producto, prueba con marca y palabras clave', async () => {
  const ui = interfaz({ porConsulta: q => q === 'salud leche entera' ? [producto('Walmart', 2), producto('Selectos', 1.75)] : [producto('Walmart', 2)] });
  ui.run(`alternar({ id: 'g:x', n: 'Leche entera Salud 1 L', m: 'Salud', q: 1000, u: 'ml', t: { Walmart: { p: 2, url: 'https://tienda.test/Walmart/1', src: 'cat' } } });`);
  await terminar(); await terminar();
  assert.deepEqual([...ui.consultas], ['Leche entera Salud 1 L', 'salud leche entera']);
  assert.equal(ui.saved()[0].t.Selectos.p, 1.75);
});
test('un producto puede estar en varias listas, cada una con su cantidad', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75)] });
  await ui.run('vivo("leche salud")');
  ui.run('abrirListas({ tipo: "vivo", x: RV[0] })');
  assert.match(ui.el('dlopts').innerHTML, /Mi lista/);
  ui.run('$("dlopts").onchange({ target: { dataset: { l: "l1" }, checked: true } })'); await terminar();
  ui.run('$("dlnombre").value = "Mensual"; $("dlnueva").onsubmit({ preventDefault() {} })');
  assert.match(ui.el('dlopts').innerHTML, /Mensual/);
  assert.equal(ui.listas(), null);   // nada se guarda hasta «Guardar»
  ui.run('$("dlguardar").onclick()'); await terminar();
  const d = ui.listas();
  assert.deepEqual(d.listas.map(l => [l.nombre, l.items.length]), [['Mi lista', 1], ['Mensual', 1]]);
  assert.equal(d.activa, 'l1');
  ui.run('abrirListas({ tipo: "vivo", x: RV[0] })');
  assert.match(ui.el('dlopts').innerHTML, /checked[^]*checked/);
  ui.run('FAV[0].cant = 4; guardar();');
  assert.deepEqual(ui.listas().listas.map(l => l.items[0].cant), [4, 1]);
  // Quitarlo de una lista no lo quita de la otra
  const mensual = d.listas[1].id;
  ui.run(`$("dlopts").onchange({ target: { dataset: { l: "${mensual}" }, checked: false } })`);
  ui.run('$("dlguardar").onclick()');
  assert.deepEqual(ui.listas().listas.map(l => l.items.length), [1, 0]);
  assert.equal(ui.run('!!favoritoVivo(RV[0])'), true);
});
test('«Cancelar» cierra el cuadro de listas sin agregar ni crear nada', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2)] });
  await ui.run('vivo("leche salud")');
  ui.run('abrirListas({ tipo: "vivo", x: RV[0] })');
  ui.run('$("dlopts").onchange({ target: { dataset: { l: "l1" }, checked: true } })');
  ui.run('$("dlnombre").value = "Fiesta"; $("dlnueva").onsubmit({ preventDefault() {} })');
  ui.run('$("dlcancelar").onclick()'); await terminar();
  assert.equal(ui.run('LISTAS.length + ":" + LISTAS[0].items.length'), '1:0');
  assert.equal(ui.run('porGuardar'), null);
});
test('con código de barras, una equivalencia aprobada llena la tienda aunque el nombre sea distinto', async () => {
  const pasta = { nombre: 'Pasta Dental Colgate Triple Acción - 75 ml', marca: 'Colgate', q: 75, u: 'ml' };
  const wal = { ...pasta, tienda: 'Walmart', id: '4059431', precio: 1.27, url: 'https://tienda.test/Walmart/4059431', porCodigo: true };
  const sup = { tienda: 'Superea', id: '1197', nombre: 'Crema Dental Triple Acción Colgate Caja 75ml', marca: 'Colgate', q: 75, u: 'ml', precio: 1.5, url: 'https://tienda.test/Superea/1197', porEquivalencia: true };
  const sinMarcas = ({ porCodigo, porEquivalencia, ...x }) => x;
  // Por nombre llegan los mismos productos, pero sin la marca de código o de equivalencia
  const ui = interfaz({ porConsulta: q => q === '' ? [wal, sup] : [sinMarcas(wal), sinMarcas(sup)] });
  assert.equal(equivalente(pasta, sup), false);
  await ui.run('vivo("7509546000985")');
  ui.run('alternar(favDeVivo(RV.find(x => x.tienda === "Walmart")))'); await terminar(); await terminar();
  let f = ui.saved()[0];
  assert.equal(f.ean, '07509546000985');
  assert.equal(f.t.Superea.p, 1.5);
  // Al actualizar después, consulta primero por código y conserva Superea
  const antes = ui.consultas.length;
  ui.run('delete FAV[0].t.Superea; codigoRV = ""; completarFavorito(FAV[0])'); await terminar(); await terminar();
  f = ui.saved()[0];
  assert.equal(ui.consultas[antes], '');   // la primera consulta es por código
  assert.equal(f.t.Superea.p, 1.5);
  // Una búsqueda por nombre no basta para unir productos de nombre distinto
  const ui2 = interfaz({ resultados: [sinMarcas(wal), sinMarcas(sup)] });
  await ui2.run('vivo("pasta colgate triple")');
  ui2.run('alternar(favDeVivo(RV.find(x => x.tienda === "Walmart")))'); await terminar(); await terminar();
  assert.equal(ui2.saved()[0].t.Superea, undefined);
});
test('cambiar de lista muestra sus productos y eliminarla cancela sus consultas', async () => {
  const ui = interfaz(); await terminar();
  ui.run('fetch = () => new Promise(() => {});');
  ui.run(`activar(crearLista("Fiesta")); alternar(favDeVivo(${JSON.stringify(producto('Walmart', 2))}));`);
  assert.equal(ui.run('pendientes.size'), 1);
  assert.match(ui.el('favmsg').textContent, /en «Fiesta»/);
  ui.run('$("lborrar").onclick()');
  assert.equal(ui.run('pendientes.size'), 0);
  assert.deepEqual(ui.listas().listas.map(l => l.nombre), ['Mi lista']);
  assert.equal(ui.run('ACTIVA.nombre'), 'Mi lista');
});
test('la lista exportada respeta cantidades, centavos y totales parciales', () => {
  const items = [{ n: 'Leche', m: 'Salud', cant: 3, t: { A: { p: .1, f: '2026-10-17' }, B: { p: .2, f: '2026-10-18T09:00:00Z' } } },
    { n: 'Arroz', m: '', cant: 2, t: { A: { p: 1.25, f: '2026-10-18' } } }];
  const t = tablaLista(items, ['A', 'B'], () => '1 L');
  assert.deepEqual(t.cabecera.slice(3, 8), ['Cantidad', 'A', 'B', 'Más barato en', 'Subtotal']);
  // fecha más reciente y, aparte, la tienda con un precio de un día anterior
  assert.deepEqual(t.filas[0].slice(3), [3, .1, .2, 'A', .3, '', '2026-10-18 · A: 2026-10-17']);
  assert.equal(t.filas[1].at(-1), '2026-10-18');
  assert.equal(t.cabecera.at(-1), 'Fecha del precio');
  assert.deepEqual(t.pie[0].slice(3, 6), [5, 2.8, .6]);
  assert.deepEqual(t.pie[1].slice(4, 6), ['2 de 2', '1 de 2 (total parcial)']);
  assert.equal(t.pie[2].at(-3), 2.8);
  const libro = Buffer.from(xlsx('Lista <1>', 'nota', t));
  assert.equal(libro.readUInt32LE(0), 0x04034b50);
  const fin = libro.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.equal(libro.readUInt16LE(fin + 10), 6);
  assert.match(libro.toString('utf8'), /Lista &lt;1&gt;/);
});

test('ofertas por cantidad: solo en su tienda, por grupos completos y sin abaratar de más', () => {
  assert.deepEqual(leerPromo('2 x $2.20'), { n: 2, total: 2.2 });
  assert.deepEqual(leerPromo('Seleccione 2X$0.90'), { n: 2, total: .9 });
  assert.deepEqual(leerPromo('3x2'), { n: 3, paga: 2 });
  for (const t of ['15% descuento', '2x3', 'Promo coca', '1 x $1.00', '', null]) assert.equal(leerPromo(t), null);
  const v = { p: 1.33, promo: '2 x $2.20' };
  assert.deepEqual([1, 2, 3, 4].map(n => costo(v, n)), [133, 220, 353, 440]);
  assert.deepEqual([2, 3, 4].map(n => costo({ p: 1, promo: '3x2' }, n)), [200, 200, 300]);
  assert.equal(costo({ p: 1, promo: '2 x $2.50' }, 2), 200);   // la «oferta» no abarata: precio normal
  assert.deepEqual(leerPromo('Segundo al 50%'), { n: 2, segundo: 50 });
  assert.deepEqual([1, 2, 3, 4].map(n => costo({ p: 3.25, promo: 'Segundo al 50%' }, n)), [325, 488, 813, 976]);
  assert.deepEqual([1, 2, 3].map(n => costo({ p: 1.25, promo: '2x1' }, n)), [125, 125, 250]);
  assert.deepEqual([2, 3, 6].map(n => costo({ p: 1, promo: '3x2' }, n)), [200, 200, 400]);
  const lista = [{ cant: 1, t: { A: { p: 1.33, promo: '2 x $2.20' }, B: { p: 1.2 } } }];
  assert.deepEqual(resumir(lista, ['A', 'B']).por, { B: 1 });
  lista[0].cant = 2;
  const r = resumir(lista, ['A', 'B']);
  assert.deepEqual(r.res.map(x => x.total), [2.2, 2.4]);   // B no recibe la oferta de A
  assert.equal(r.mix, 2.2);
  assert.deepEqual(r.por, { A: 2 });
});
test('la oferta de una tienda se guarda con su precio y se aplica al subir la cantidad', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2, { promo: '2 x $3.20', antes: 2.25 }), producto('Selectos', 1.75)] });
  await ui.run('vivo("leche salud")');
  ui.run('alternar(favDeVivo(RV[0]));'); await terminar();
  assert.equal(ui.saved()[0].t.Walmart.promo, '2 x $3.20');
  assert.equal(ui.saved()[0].t.Selectos.promo, null);
  assert.match(ui.el('tfav').innerHTML, /Oferta 2 x \$3\.20 · lleva 2 para aplicarla/);
  assert.match(ui.el('tfav').innerHTML, /antes \$2\.25/);
  assert.match(ui.el('favtot').innerHTML, /\$2\.00[^]*\$1\.75/);
  ui.run('$("tfav").onclick({target:{closest:()=>({dataset:{a:"mas",id:FAV[0].id}})}})');
  assert.match(ui.el('tfav').innerHTML, /Oferta 2 x \$3\.20 · aplicada: \$3\.20 por 2/);
  assert.match(ui.el('favtot').innerHTML, /\$3\.20[^]*\$3\.50/);
  assert.match(ui.el('favmix').textContent, /\$3\.20 \(2 unidad\(es\) en Walmart\)/);
});
test('un catálogo más nuevo no conserva una oferta que ya no puede confirmar', async () => {
  const favorito = { id: 'g:leche entera salud 1 l|1000ml', n: base.nombre, m: 'Salud', q: 1000, u: 'ml', cant: 2,
    t: { Walmart: { p: 2, url: 'https://tienda.test/Walmart/1', f: '2026-10-15', promo: '2 x $3.20' } } };
  const ui = interfaz({ guardados: [favorito], datos: { supers: ['Walmart'], actualizado: '2026-10-17', items: [
    { n: base.nombre, m: 'Salud', q: 1000, u: 'ml', t: [[0, 1.9, 'https://tienda.test/Walmart/1']] }] } });
  await terminar();
  assert.equal(ui.saved()[0].t.Walmart.p, 1.9);
  assert.equal(ui.saved()[0].t.Walmart.promo, null);
});
async function worker(respuestas) {
  const tmp = path.join(os.tmpdir(), `canasta-worker-${process.pid}-${Date.now()}.mjs`);
  fs.copyFileSync(path.join(__dirname, '..', 'worker', 'worker.js'), tmp);
  const pedidas = [], original = globalThis.fetch;
  globalThis.fetch = async url => { url = String(url); pedidas.push(url);
    const [, cuerpo] = Object.entries(respuestas).find(([k]) => url.includes(k)) || [, '[]'];
    return new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)); };
  try {
    const w = (await import(pathToFileURL(tmp).href)).default;
    const pedir = async qs => { const r = await w.fetch(new Request('https://w.test/?fresh=1&' + qs), {}, { waitUntil() {} }); return { status: r.status, ...(await r.json()) }; };
    return { pedidas, consultar: async q => pedir('q=' + encodeURIComponent(q)), porCodigo: async c => pedir('ean=' + encodeURIComponent(c)) };
  } finally { fs.rmSync(tmp); setImmediate(() => { globalThis.fetch = original; }); }
}
test('Worker: quita tildes y lee las ofertas internas de VTEX (vigentes y que cuadran) y las de Selectos', async () => {
  const vtex = (id, nombre, Price, extra = {}) => ({ productId: id, productName: nombre, brand: 'Coca Cola', link: 'https://maxi.test/' + id + '/p',
    items: [{ sellers: [{ commertialOffer: { Price, AvailableQuantity: 5, ...extra } }] }] });
  const w = await worker({
    // Formatos reales de Walmart Centroamérica (observados el 2026-10-21); fechas de fin futuras para que la prueba no caduque
    'maxidespensa.com.sv/api': [
      vtex('1', 'Gaseosa Coca Cola Pet 1250 ml', 1.33, { ListPrice: 1.5, PromotionTeasers: [{ Name: 'Promo,1.1x2,2026-09-17-2099-12-31-120535-14 TYPE_PROMO_GPP', Conditions: { MinimumQuantity: 2 } }] }),
      vtex('2', 'Café Cappuccino Sobre - 25 g', .54, { Teasers: [{ '<Name>k__BackingField': 'PromoCombinaEnFijo,0.5x3,2026-10-05-2099-01-05-123044-14 TYPE_PROMO_CMF',
        '<Conditions>k__BackingField': { '<MinimumQuantity>k__BackingField': 3 } }] }),
      vtex('3', 'Gaseosa Coca Cola Pet 3000 ml', 2.49, { PromotionTeasers: [{ Name: 'Promo,2.1x2,2020-01-01-2020-12-31-1 TYPE_PROMO_GPP' }] }),   // vencida
      vtex('4', 'Gaseosa Coca Cola Lata 354 ml', .78, { PromotionTeasers: [{ Name: 'Promo,0.7x2,2026-01-01-2099-12-31-1 TYPE_PROMO_GPP', Conditions: { MinimumQuantity: 3 } }] }),   // no cuadra
      vtex('5', 'Gaseosa Coca Cola Pet 600 ml', .8, { PromotionTeasers: [{ Name: 'PROMO INTERNA COCA' }] })],
    'superselectos.com': fs.readFileSync(path.join(__dirname, 'datos', 'selectos-busqueda.html'), 'utf8')
  });
  const d = await w.consultar('Atún café ñame');
  assert.ok(w.pedidas.some(u => u.includes('superselectos.com/products?keyword=Atun%20cafe%20%C3%B1ame')), w.pedidas.join(' '));
  assert.ok(w.pedidas.some(u => u.includes('maxidespensa.com.sv/api/catalog_system/pub/products/search?ft=Atun%20cafe%20%C3%B1ame')));
  const maxi = d.resultados.filter(x => x.tienda === 'Maxi Despensa');
  assert.deepEqual(maxi.map(x => [x.id, x.promo, x.antes]), [['1', '2 x $2.20', 1.5], ['2', '3 x $1.50', null], ['3', null, null], ['4', null, null], ['5', null, null]]);
  const sel = d.resultados.filter(x => x.tienda === 'Super Selectos');
  // La imagen tipoPromoMM/2-50.png es «Segundo al 50%» según los filtros oficiales de /special-deals
  assert.deepEqual(sel.map(x => [x.id, x.precio, x.promo]), [['21702', .5, 'Seleccione 2X$0.90'], ['89275', 1.1, null], ['77412', 3.25, 'Segundo al 50%']]);
});
test('ofertas de imagen de Selectos (2x1, segundo al 50%) se muestran y aplican solo en Selectos', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75, { promo: '2x1' })] });
  await ui.run('vivo("leche salud")');
  ui.run('alternar(favDeVivo(RV[0]));'); await terminar();
  assert.match(ui.el('tfav').innerHTML, /Oferta 2x1 · lleva 2 para aplicarla/);
  ui.run('FAV[0].cant = 2; pintarFav();');
  assert.match(ui.el('tfav').innerHTML, /Oferta 2x1 · aplicada: \$1\.75 por 2/);
  assert.match(ui.el('favtot').innerHTML, /\$4\.00[^]*\$1\.75/);   // Walmart sin oferta: 2 × $2.00
  ui.run('FAV[0].t.Selectos.promo = "Segundo al 50%"; pintarFav();');
  assert.match(ui.el('tfav').innerHTML, /Oferta 2\.ª unidad al 50% de descuento · aplicada: \$2\.63 por 2/);
});
test('celular: lista compacta con precios por tienda y solo un producto abierto a la vez', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75)] });
  await ui.run('vivo("leche salud")');
  ui.run('alternar(favDeVivo(RV[0])); alternar({ id: "g:arroz", n: "Arroz blanco 1 lb", m: "Precisa", q: 454, u: "g", t: { Walmart: { p: .9, src: "cat" } } });');
  await terminar(); await terminar();
  const html = () => ui.el('mfav').innerHTML;
  assert.match(html(), /Selectos <b>\$1\.75<\/b>[^]*Walmart <b>\$2\.00<\/b>/);
  assert.doesNotMatch(html(), /class="mdet"/);
  const abrir = i => ui.run(`$("mfav").onclick({ target: { closest: () => ({ dataset: { a: "abrir", id: FAV[${i}].id } }) } })`);
  abrir(0);
  assert.equal((html().match(/class="mdet"/g) || []).length, 1);
  assert.match(html(), /aria-expanded="true"[^]*Leche entera Salud/);
  abrir(1);   // abrir otro cierra el anterior
  assert.equal((html().match(/class="mdet"/g) || []).length, 1);
  assert.match(html(), /aria-expanded="false"><span class="mnom">Leche[^]*aria-expanded="true"><span class="mnom">Arroz/);
  abrir(1);   // tocar el abierto lo cierra
  assert.doesNotMatch(html(), /class="mdet"/);
  // la cantidad se cambia igual desde el detalle
  abrir(0);
  ui.run('$("mfav").onclick({ target: { closest: s => s === "[data-a]" ? { dataset: { a: "mas", id: FAV[0].id } } : { dataset: { a: "mas", id: FAV[0].id } } } })');
  assert.equal(ui.saved()[0].cant, 2);
});
test('búsqueda en vivo: los resultados deben contener al menos 2 palabras de la búsqueda', () => {
  const q = 'Gaseosa Cocacola';
  for (const n of ['Gaseosa Coca Cola regular - 1.25 L', 'Gaseosa Coca-Cola Sin Azúcar Lata 6pack']) assert.equal(coincideBusqueda(q, n), true, n);
  for (const n of ['Chorizo Argentino Superior - 454 g', 'Papel Higiénico Scott 4 Rollos', 'Gaseosa Pepsi 3 L', 'Chocolate con leche', 'Coca Cola Zero Lata 354 ml'])
    assert.equal(coincideBusqueda(q, n), false, n);
  assert.deepEqual(palabrasBusqueda('Leche entera de 1 litro Salud'), ['leche', 'entera', 'salud']);   // sin artículos, números ni medidas
  assert.equal(coincideBusqueda('galletas oreo', 'Galleta Oreo Original 12 Pack'), true);   // plural y singular
  assert.equal(coincideBusqueda('limones', 'Limón persa unidad'), true);   // una sola palabra basta si es la única
  assert.equal(coincideBusqueda('coca cola', 'Gaseosa Cocacola 3 L'), true);
  assert.equal(coincideBusqueda('1.25 L', 'Cualquier producto'), true);   // sin palabras que cuenten no se filtra
});
test('búsqueda en vivo: oculta los productos de otras categorías y deja verlos con «Mostrar todos»', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 1.35, { nombre: 'Gaseosa Coca Cola regular - 1.25 L', marca: 'Coca Cola' }),
    producto('Selectos', 4.5, { id: 'x2', url: 'https://tienda.test/x2', nombre: 'Chorizo Argentino Superior - 454 g', marca: 'Superior' }),
    producto('Selectos', 1.2, { id: 'x3', url: 'https://tienda.test/x3', nombre: 'Papel Higiénico Scott 4 Rollos', marca: 'Scott' })] });
  await ui.run('vivo("Gaseosa Cocacola")');
  assert.match(ui.el('tv').innerHTML, /Gaseosa Coca Cola/);
  assert.doesNotMatch(ui.el('tv').innerHTML, /Chorizo|Papel/);
  assert.equal(ui.el('ocultos').hidden, false);
  assert.match(ui.el('ocultostxt').textContent, /Se ocultaron 2 resultado/);
  assert.match(ui.el('estv').textContent, /Walmart: 1 resultado\(s\) · Selectos: 0 resultado\(s\)/);
  ui.run('$("vertodos").onclick()');
  assert.match(ui.el('tv').innerHTML, /Chorizo[^]*Papel|Papel[^]*Chorizo/);
  assert.equal(ui.el('vertodos').textContent, 'Ocultar los que no coinciden');
  ui.run('$("vertodos").onclick()');
  assert.doesNotMatch(ui.el('tv').innerHTML, /Chorizo/);
  await ui.run('vivo("chorizo argentino")');   // una búsqueda nueva vuelve a filtrar y no oculta nada si todo coincide
  assert.equal(ui.el('ocultos').hidden, false);
  assert.match(ui.el('tv').innerHTML, /Chorizo/);
  assert.doesNotMatch(ui.el('tv').innerHTML, /Gaseosa/);
});
test('el más barato se marca con ✓ y texto, y Catálogo y En vivo tienen lista compacta con tienda y precio', async () => {
  const arroz = { n: 'Arroz Blanco Precisa 1 lb', m: 'Precisa', q: 454, u: 'g', pl: 'lb', pu: .85, k: 'ean',
    t: [[0, .89, 'https://t.test/a1', .89, 'Arroz Blanco Precisa 1 lb', 'Precisa', '', 'a1'], [1, .85, 'https://t.test/a2', .85, 'Arroz Precisa 1 lb', 'Precisa', '', 'a2']] };
  const ui = interfaz({ datos: { supers: ['Walmart', 'Selectos'], actualizado: '2026-10-21', items: [arroz] },
    resultados: [producto('Walmart', 2), producto('Selectos', 1.75, { promo: '2x1' })] });
  await terminar();
  // tabla: la celda verde también dice que es la más barata
  assert.match(ui.el('tabla').innerHTML, /<td class="best"><span class="ok" aria-hidden="true">✓<\/span><a [^>]*>\$0\.85<\/a><span class="vh"> \(más barato\)<\/span><\/td>/);
  // lista compacta: precios con su tienda, el más barato primero, con enlace, y la ☆
  const cat = ui.el('mcat').innerHTML;
  assert.match(cat, /<a class="chip best" href="https:\/\/t\.test\/a2"[^>]*><span class="ok" aria-hidden="true">✓<\/span>Selectos <b>\$0\.85<\/b>[^]*Walmart <b>\$0\.89<\/b>/);
  assert.match(cat, /\$0\.85 por lb/);
  assert.match(cat, /class="star" data-i="0"/);
  await ui.run('vivo("leche salud")');
  const viv = ui.el('mvivo').innerHTML;
  assert.match(viv, /Selectos <b>\$1\.75<\/b><i>oferta<\/i>[^]*Oferta 2x1/);
  assert.match(viv, /class="star" data-id="v:Walmart:Walmart-1"/);
  assert.match(ui.el('tv').innerHTML, /\(más barato\)/);
  // la ☆ de la lista compacta abre el mismo cuadro de listas
  ui.run('$("mvivo").onclick({ target: { classList: { contains: () => false }, closest: s => s === ".star" ? { dataset: { id: RV[1].id } } : null } })');
  assert.equal(ui.run('porGuardar && porGuardar.x.tienda'), 'Selectos');
});
test('Favoritos: resumen arriba y «no respondieron» una sola vez para toda la lista', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75)] });
  await ui.run('vivo("leche salud")');
  ui.run('alternar(favDeVivo(RV[0])); alternar({ id: "g:arroz", n: "Arroz blanco 1 lb", m: "Precisa", q: 454, u: "g", t: { Walmart: { p: .9, src: "cat" } } });');
  await terminar(); await terminar();
  assert.equal(ui.el('favresumen').hidden, false);
  assert.match(ui.el('favresumen').innerHTML, /Compra completa más barata: <b>Walmart \$2\.90<\/b> · Combinando tiendas: <b>\$2\.65<\/b>/);
  ui.run('FAV[1].t = { Despensa: { p: .9 } }; pintarFav();');
  assert.match(ui.el('favresumen').innerHTML, /Ninguna tienda tiene todos los productos · Combinando tiendas: <b>\$2\.65<\/b>/);
  assert.equal((ui.el('favmsg').textContent.match(/No respondieron: Despensa/g) || []).length, 1);
  assert.doesNotMatch(ui.el('tfav').innerHTML, /No respondieron/);
  ui.run('FAV.splice(1, 1); pintarFav();');
  assert.match(ui.el('favresumen').innerHTML, /Compra completa más barata: <b>Selectos \$1\.75<\/b>/);
});
test('precio por unidad: 4 decimales bajo un centavo y «—» si el catálogo lo dejó en cero', async () => {
  const item = (n, pu) => ({ n, m: 'Gigante', q: 500, u: 'ud', pl: 'ud', pu, k: 'ean', t: [[0, 1.15, 'https://t.test/' + n, pu, n, 'Gigante', '', n], [1, 1.2, 'https://t.test/b' + n, pu, n, 'Gigante', '', 'b' + n]] });
  const ui = interfaz({ datos: { supers: ['Walmart', 'Selectos'], actualizado: '2026-10-21', items: [item('Sal A 500 sobres', .0023), item('Sal B 500 sobres', 0)] } });
  await terminar();
  assert.equal(ui.run('fpu(0.0023)'), '$0.0023');
  assert.match(ui.el('tabla').innerHTML, /\$0\.0023<small>por ud/);
  assert.doesNotMatch(ui.el('tabla').innerHTML, /\$0\.000</);
  assert.match(ui.el('mcat').innerHTML, /\$0\.0023 por ud/);
});
test('onzas: «fl oz» y «onzas líquidas» son ml; «oz» y «onzas» solas son peso; igual en scraper y Worker', async () => {
  const { parseTamano } = await import(pathToFileURL(path.join(__dirname, '..', 'scraper', 'normalizar.mjs')).href);
  const casos = { 'Gaseosa Coca Cola Lata 12 fl oz': '355 ml', 'Jugo Del Valle 16 onzas líquidas': '473 ml', 'Locion Nivea 13.5 fl. oz': '399 ml',
    'Cerveza 6 x 12 fl oz': '2129 ml', 'Activee Tr Argan 3.38 Fl oz 100 ml': '100 ml', 'Hongo Champinon 12 Onzas': '340 g',
    'Liempiador Armor All - 10onzas': '283 g', 'Salchichas Butterball de pavo - 16 oz': '454 g', 'Salsa Prego tradicional - 14 oz': '397 g' };
  for (const [n, esperado] of Object.entries(casos)) { const t = parseTamano(n); assert.equal(`${t?.q} ${t?.u}`, esperado, n); }
  // El Worker usa la misma lógica
  const vtex = (id, nombre) => ({ productId: id, productName: nombre, brand: '', link: 'https://t.test/' + id, items: [{ sellers: [{ commertialOffer: { Price: 1, AvailableQuantity: 1 } }] }] });
  const w = await worker({ 'walmart.com.sv/api': Object.keys(casos).map((n, i) => vtex(String(i), n)) });
  const d = await w.consultar('prueba onzas');
  for (const x of d.resultados.filter(r => r.tienda === 'Walmart')) assert.equal(`${x.q} ${x.u}`, casos[x.nombre], x.nombre);
  // Una lata de 12 fl oz equivale a una de 355 ml; a una de 350 ml, no
  const lata = (nombre, q) => ({ nombre, marca: 'Coca Cola', q, u: 'ml' });
  assert.equal(equivalente(lata('Gaseosa Coca Cola Lata 12 fl oz', 355), lata('Gaseosa Coca Cola Lata 355 ml', 355)), true);
  assert.equal(equivalente(lata('Gaseosa Coca Cola Lata 12 fl oz', 355), lata('Gaseosa Coca Cola Lata 350 ml', 350)), false);
  assert.equal(equivalente({ nombre: 'Activee Tr Argan 3.38 Fl oz 100 ml', marca: 'Activee', q: 100, u: 'ml' }, { nombre: 'Activee Tr Argan 100 ml', marca: 'Activee', q: 100, u: 'ml' }), true);
  assert.deepEqual(palabrasBusqueda('Shampoo Activee 13.5 fl oz'), ['shampoo', 'activee']);
});
test('«Cambiar producto»: opciones guardadas con el favorito, también del catálogo, y «Buscar más opciones» hace todas las búsquedas', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75), producto('Selectos', 1.9, { id: 'x5', url: 'https://tienda.test/x5', nombre: 'Leche Salud deslactosada 1 L' }),
    producto('Selectos', 4.5, { id: 'x6', url: 'https://tienda.test/x6', nombre: 'Chorizo Argentino Superior 454 g', marca: 'Superior' })] });
  await ui.run('vivo("leche salud")');
  ui.run('alternar(favDeVivo(RV[0]));'); await terminar();
  // solo las opciones parecidas al producto, guardadas para después de recargar
  assert.deepEqual(ui.saved()[0].opc.Selectos.map(x => x.nombre), ['Leche entera Salud 1 L', 'Leche Salud deslactosada 1 L']);
  const lecheCat = { n: 'Leche Salud entera 1 L', m: 'Salud', q: 1000, u: 'ml', t: [[0, 1.6, 'https://t.test/cat-leche', 1.6, 'Leche Salud entera 1 L', 'Salud', '', 'c1']] };
  const reabierta = interfaz({ guardados: ui.saved(), datos: { supers: ['Despensa'], actualizado: '2026-10-21', items: [lecheCat] } }); await terminar();
  const html = reabierta.el('tfav').innerHTML;
  assert.match(html, /Leche Salud deslactosada 1 L · \$1\.90/);
  assert.match(html, /Leche entera Salud 1 L · \$1\.75 \(actual\)/);
  // el catálogo llena una tienda sin coincidencia guardada
  reabierta.run('$("tfav").onchange({target:{matches:()=>true,dataset:{fav:FAV[0].id,store:"Despensa"},value:"v:Despensa:c1"}})');
  assert.deepEqual([reabierta.saved()[0].t.Despensa.p, reabierta.saved()[0].t.Despensa.manual, reabierta.saved()[0].t.Despensa.src], [1.6, true, 'cat']);
  // sin «completo» se detiene en la primera búsqueda que da coincidencias; con «Buscar más opciones» hace todas
  const antes = ui.consultas.length;
  await ui.run('completarFavorito(FAV[0])');
  assert.equal(ui.consultas.length - antes, 1);
  await ui.run('completarFavorito(FAV[0], true)');
  assert.ok(ui.consultas.length - antes > 2);
});
test('las consultas no redibujan con un selector de «Cambiar producto» en uso, pero agregar y quitar sí', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75)] });
  await ui.run('vivo("leche salud")');
  ui.run('alternar(favDeVivo(RV[0]));'); await terminar();
  // una consulta en segundo plano espera a que se suelte el selector visible
  ui.run('document.activeElement = { matches: s => s === "select[data-fav]", isConnected: true, offsetParent: {} }; $("tfav").innerHTML = "sin tocar"; pintarFav(true);');
  assert.equal(ui.el('tfav').innerHTML, 'sin tocar');
  // lo que hace la persona (agregar, quitar, cambiar) siempre redibuja
  ui.run('pintarFav()');
  assert.match(ui.el('tfav').innerHTML, /Cambiar producto/);
  // un selector que quedó con el foco en una pestaña oculta (Safari del iPhone) no detiene la lista
  ui.run('document.activeElement.offsetParent = null; $("tfav").innerHTML = "sin tocar"; pintarFav(true);');
  assert.match(ui.el('tfav').innerHTML, /Cambiar producto/);
  // quitar y volver a agregar el mismo producto con el selector en uso: la lista se actualiza
  ui.run('document.activeElement.offsetParent = {}; const p = JSON.parse(JSON.stringify(FAV[0])); alternar(FAV[0]);');
  assert.doesNotMatch(ui.el('tfav').innerHTML, /Cambiar producto/);
  ui.run('alternar(p);');
  assert.match(ui.el('tfav').innerHTML, /Leche entera Salud/);
});
test('un producto elegido con «Cambiar producto» no se confunde con el favorito ni le pasa sus precios', async () => {
  const datos = { supers: ['Walmart', 'Despensa'], actualizado: '2026-10-21', items: [
    { n: 'Pan Blanco Bimbo mediano - 450 g', m: 'Bimbo', q: 450, u: 'g', t: [[0, 1.5, 'https://t.test/w-mediano'], [1, 1.5, 'https://t.test/d-mediano']] },
    { n: 'Pan Bimbo Para Sandwich - 560 g', m: 'Bimbo', q: 560, u: 'g', t: [[0, 1.8, 'https://t.test/w-sandwich'], [1, 1.8, 'https://t.test/d-sandwich']] }] };
  const ui = interfaz({ datos }); await terminar();
  ui.run('alternar(favDeItem(D.items[0]));'); await terminar();
  // en Despensa la persona elige el de sándwich desde la tabla
  ui.run('$("tfav").onchange({target:{matches:()=>true,dataset:{fav:FAV[0].id,store:"Despensa"},value:"v:Despensa:https://t.test/d-sandwich"}})');
  assert.equal(ui.saved()[0].t.Despensa.url, 'https://t.test/d-sandwich');
  // el pan de sándwich no aparece como guardado, y marcarlo lo agrega sin quitar el mediano
  assert.equal(ui.run('!!favoritoItem(D.items[1])'), false);
  ui.run('alternar(favDeItem(D.items[1]));'); await terminar();
  assert.deepEqual(ui.saved().map(f => f.n), ['Pan Blanco Bimbo mediano - 450 g', 'Pan Bimbo Para Sandwich - 560 g']);
  // un catálogo nuevo solo actualiza el precio elegido; no pasa el precio del de sándwich a Walmart
  ui.run('D.items[1].t[1][1] = 1.95; D.items[0].t[0][1] = 1.55; D.actualizado = "2026-10-25"; refrescarFavs();');
  const mediano = ui.saved()[0];
  assert.deepEqual([mediano.t.Walmart.p, mediano.t.Despensa.p, mediano.t.Despensa.manual], [1.55, 1.95, true]);
});
test('«Actualizar precios» reconoce el producto por el ID de la tienda aunque cambie el enlace, y actualiza su fecha', async () => {
  const fav = { id: 'g:leche', n: base.nombre, m: 'Salud', q: 1000, u: 'ml', cant: 1, consultado: '2026-10-15T12:00:00Z',
    t: { Walmart: { p: 2.1, url: 'https://tienda.test/Walmart/leche-vieja/p', id: 'Walmart-1', f: '2026-10-15', src: 'cat' } } };
  const ui = interfaz({ guardados: [fav], resultados: [producto('Walmart', 1.95, { url: 'https://tienda.test/Walmart/leche-nueva/p?sku=9' })] });
  await terminar();
  await ui.run('completarFavorito(FAV[0])');
  const w = ui.saved()[0].t.Walmart;
  assert.deepEqual([w.p, w.f, w.url], [1.95, '2026-10-17T12:00:00Z', 'https://tienda.test/Walmart/leche-nueva/p?sku=9']);
});
test('las fechas usan la hora del dispositivo: una consulta de la noche en El Salvador no pasa al día siguiente', () => {
  const tz = process.env.TZ;
  try {
    process.env.TZ = 'America/El_Salvador';
    const { dia } = require('../comparador.js');
    assert.equal(dia('2026-10-23T01:30:00Z'), '2026-10-22');   // 7:30 p. m. del 22 en El Salvador
    assert.equal(dia('2026-10-23T12:00:00Z'), '2026-10-23');
    assert.equal(dia('2026-10-22'), '2026-10-22');            // fecha del catálogo, sin hora
    assert.equal(dia(''), '');
  } finally { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; }
});

test('código de barras: mismo dígito de control que el catálogo y el Worker', () => {
  const { gtin } = require('../comparador.js');
  assert.equal(gtin('7441029556735'), '07441029556735');
  assert.equal(gtin('7441029556736'), '');            // dígito de control incorrecto
  assert.equal(gtin('00000123'), '');                 // menos de 8 cifras significativas
  assert.equal(gtin('036000291452'), '00036000291452'); // UPC-A de 12 cifras
});
test('Worker: busca por código en las tiendas VTEX y, con el nombre encontrado, en las demás', async () => {
  const vtex = (id, nombre, ean) => ({ productId: id, productName: nombre, brand: 'Bimbo', link: 'https://w.test/' + id + '/p',
    items: [{ ean, sellers: [{ commertialOffer: { Price: 1.8, AvailableQuantity: 5 } }] }] });
  const w = await worker({
    'walmart.com.sv/api/catalog_system/pub/products/search?fq=alternateIds_Ean:7441029556735': [vtex('4054725', 'Pan Bimbo Para Sandwich - 560 g', '7441029556735')],
    'algolia.net': { hits: [{ id: 552, name: 'Pan Bimbo Sandwich 560g', slug: 'pan-bimbo-sandwich', brand_name: 'Bimbo', final_price: 1.95, is_always_available: 1 }] }
  });
  const d = await w.porCodigo('7441029556735');
  assert.equal(d.ean, '07441029556735');
  assert.equal(d.nombre, 'Pan Bimbo Para Sandwich - 560 g');
  const walmart = d.resultados.find(x => x.tienda === 'Walmart');
  assert.deepEqual([walmart.porCodigo, walmart.ean], [true, '07441029556735']);
  assert.ok(d.resultados.some(x => x.tienda === 'Superea' && !x.porCodigo));
  // las tiendas sin el código se consultan con el nombre, sin tildes
  assert.ok(w.pedidas.some(u => u.includes('algolia.net') && u.includes('Pan+Bimbo+Para+Sandwich')));
  assert.ok(w.pedidas.some(u => u.includes('maxidespensa.com.sv') && u.includes('ft=Pan')));
  assert.equal((await w.porCodigo('7441029556736')).status, 400);
});
test('código de barras en la página: el catálogo lo encuentra y la búsqueda muestra el mismo producto y sus equivalentes', async () => {
  const pan = { n: 'Pan Bimbo Para Sandwich - 560 g', m: 'Bimbo', q: 560, u: 'g', b: ['07441029556735'], t: [[0, 1.8, 'https://t.test/pan', 1.46, 'Pan Bimbo Para Sandwich - 560 g', 'Bimbo', '', '4054725']] };
  const otro = { n: 'Pan Blanco Bimbo mediano - 450 g', m: 'Bimbo', q: 450, u: 'g', t: [[0, 1.5, 'https://t.test/mediano', 1.5, 'Pan Blanco Bimbo mediano - 450 g', 'Bimbo', '', '1']] };
  const fila = (tienda, id, nombre, precio, extra = {}) => ({ tienda, id, nombre, marca: 'Bimbo', precio, url: 'https://t.test/' + id, q: 560, u: 'g', ...extra });
  const ui = interfaz({ datos: { supers: ['Walmart'], actualizado: '2026-10-22', items: [pan, otro] },
    resultados: [fila('Walmart', 'w1', 'Pan Bimbo Para Sandwich - 560 g', 1.8, { porCodigo: true, ean: '07441029556735' }),
      fila('Superea', 's1', 'Pan Bimbo Para Sandwich 560 g', 1.95), fila('Superea', 's2', 'Pan Bimbo Integral 630 g', 2.6, { q: 630 })] });
  await terminar();
  ui.run('$("q").value = "7441029556735"; render();');
  assert.match(ui.el('tabla').innerHTML, /Pan Bimbo Para Sandwich - 560 g/);
  assert.doesNotMatch(ui.el('tabla').innerHTML, /mediano/);
  await ui.run('vivo("7441029556735")');
  assert.equal(ui.consultas.at(-1), '');   // se pidió por ?ean=, no por ?q=
  assert.match(ui.el('estv').textContent, /^Código 7441029556735: Pan Bimbo Para Sandwich - 560 g\./);
  const tv = ui.el('tv').innerHTML;
  assert.match(tv, /Mismo código de barras[^]*Coincide por nombre y tamaño/);
  assert.doesNotMatch(tv, /Integral/);   // otro producto: queda oculto
  assert.equal(ui.run('busquedaRV'), 'Pan Bimbo Para Sandwich - 560 g');
});
test('catálogo: los productos de Selectos de las equivalencias aprobadas se buscan aparte, siempre en superselectos.com', async () => {
  const { paginasSelectos } = await import(pathToFileURL(path.join(__dirname, '..', 'scraper', 'tiendas.mjs')).href);
  const eq = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraper', 'equivalencias.json'), 'utf8')).flat().filter(x => x.tienda === 'Super Selectos');
  const extra = paginasSelectos().filter(p => p.cat === 'equivalencia aprobada');
  assert.equal(extra.length, new Set(eq.map(x => new URL(x.url).searchParams.get('keyword'))).size);
  assert.ok(extra.every(p => p.url.startsWith('https://www.superselectos.com/products?keyword=')));
});
test('Worker: al buscar por código usa las equivalencias aprobadas para traer el producto exacto de Selectos', async () => {
  const vtex = (id, nombre) => ({ productId: id, productName: nombre, brand: 'Bimbo', link: 'https://www.walmart.com.sv/pan-bimbo/p',
    items: [{ ean: '7441029556735', sellers: [{ commertialOffer: { Price: 1.8, AvailableQuantity: 5 } }] }] });
  const w = await worker({
    'raw.githubusercontent.com': [[{ tienda: 'Walmart', id: '', url: 'https://www.walmart.com.sv/pan-bimbo/p', nombre: 'Pan Bimbo' },
      { tienda: 'Super Selectos', id: '', url: 'https://www.superselectos.com/products?keyword=pan%20bimbo%20blanco&productId=89275', nombre: 'Pan Bimbo Selectos' }]],
    'walmart.com.sv/api/catalog_system/pub/products/search?fq=alternateIds_Ean:7441029556735': [vtex('4054725', 'Pan Bimbo Para Sandwich - 560 g')],
    'superselectos.com': fs.readFileSync(path.join(__dirname, 'datos', 'selectos-busqueda.html'), 'utf8')
  });
  const d = await w.porCodigo('7441029556735');
  const sel = d.resultados.filter(x => x.tienda === 'Super Selectos');
  assert.deepEqual(sel.map(x => [x.id, x.porEquivalencia]), [['89275', true]]);   // solo el producto confirmado, no toda la búsqueda
  assert.ok(w.pedidas.some(u => u.includes('superselectos.com/products?keyword=pan%20bimbo%20blanco')));
});
test('página: un resultado de una equivalencia aprobada se muestra con «Equivalencia verificada» después del mismo código', async () => {
  const fila = (tienda, id, nombre, precio, extra = {}) => ({ tienda, id, nombre, marca: 'Bimbo', precio, url: 'https://t.test/' + id, q: 560, u: 'g', ...extra });
  const ui = interfaz({ resultados: [fila('Super Selectos', 's9', 'Pan Blanco Sandwich Bimbo', 1.7, { q: null, porEquivalencia: true }),
    fila('Walmart', 'w1', 'Pan Bimbo Para Sandwich - 560 g', 1.8, { porCodigo: true })] });
  await terminar();
  await ui.run('vivo("7441029556735")');
  assert.match(ui.el('tv').innerHTML, /Mismo código de barras[^]*Pan Blanco Sandwich Bimbo[^]*Equivalencia verificada/);
});
test('aportes: solo se aplican las comparaciones cuya tabla sigue en la issue', async () => {
  const { execFileSync } = require('node:child_process');
  const g = (a, b) => [{ tienda: 'Walmart', id: a, url: '', nombre: 'P' + a }, { tienda: 'Super Selectos', id: b, url: '', nombre: 'Q' + b }];
  const json = '```json\n' + JSON.stringify([g('1', '11'), g('2', '22'), g('3', '33')], null, 1) + '\n```';
  const correr = cuerpo => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aporte-')); fs.mkdirSync(path.join(dir, 'scraper'));
    fs.writeFileSync(path.join(dir, 'scraper', 'equivalencias.json'), JSON.stringify([g('2', '22')]));
    const out = path.join(dir, 'salida.txt');
    execFileSync(process.execPath, [path.join(__dirname, '..', 'scraper', 'aplicar-aporte.mjs')], { cwd: dir, env: { ...process.env, CUERPO: cuerpo, GITHUB_OUTPUT: out } });
    const r = { base: JSON.parse(fs.readFileSync(path.join(dir, 'scraper', 'equivalencias.json'), 'utf8')).map(x => x[0].id), salida: fs.readFileSync(out, 'utf8') };
    fs.rmSync(dir, { recursive: true }); return r;
  };
  // La comparación 1 se borró de la issue; la 2 ya estaba en la base; la 3 entra
  let r = correr('### Comparación 2\n\n| tabla |\n\n### Comparación 3\n\n| tabla |\n\n<details>\n\n' + json + '\n\n</details>');
  assert.deepEqual(r.base, ['2', '3']);
  assert.match(r.salida, /resumen=Se aplicaron 1 comparación\(es\) \(3\)[^\n]*Se omitieron 1 porque su tabla se borró[^\n]*Ya estaban en la base: 2\./);
  // Issue antigua, sin secciones: se aplica todo
  r = correr('Aporte enviado desde el sitio.\n\n' + json);
  assert.deepEqual(r.base, ['2', '1', '3']);
  // Todas borradas: no se aplica nada
  r = correr('### Comparaciones descartadas\n\n' + json.replace(/^/, ''));
  assert.deepEqual(r.base, ['2']);
  assert.match(r.salida, /No se aplicó ninguna comparación\. Se omitieron 1, 2 y 3/);
  assert.match(r.salida, /aplicados=0/);
});
test('aportes: la issue que crea el Worker explica cómo descartar y numera cada comparación', async () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'worker', 'worker.js'), 'utf8');
  assert.match(fuente, /Para descartar una comparación:\*\* antes de poner la etiqueta, edita la issue y borra su sección completa/);
  assert.match(fuente, /`### Comparación \$\{i \+ 1\}`/);
});
test('los scripts de index.html llevan la misma versión (?v=) para no mezclar archivos guardados', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const v = [...html.matchAll(/<script src="(config|comparador|exportar|app)\.js\?v=([\w-]+)"/g)].map(m => m[2]);
  assert.equal(v.length, 4);
  assert.equal(new Set(v).size, 1);
});

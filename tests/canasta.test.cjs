const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { equivalente, resumir } = require('../comparador.js');
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
      dataset: {}, setAttribute(k, v) { this[k] = String(v); }, getAttribute(k) { return this[k]; }, focus() {}, parentElement: {} });
    return elements.get(id);
  }
  el('ordv').value = 'pu'; el('ord').value = 'pu';
  const CLAVE = 'canasta-sv-favoritos-v1', almacen = new Map([[CLAVE, JSON.stringify(guardados)]]), consultas = [];
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
  for (const file of ['comparador.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  return { run: code => vm.runInContext(code, context), el, consultas, saved: () => JSON.parse(almacen.get(CLAVE)),
    registro: () => JSON.parse(almacen.get('canasta-sv-registro-v1') || '[]') };
}
const terminar = () => new Promise(resolve => setImmediate(resolve));

test('al marcar un resultado consulta otras tiendas, guarda una fila y muestra totales', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75)] });
  await ui.run('vivo("leche salud")');
  ui.run('$("qv").value = "leche salud"; alternar(favDeVivo(RV[0]));');
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
  ui.run('$("tfav").onchange({target:{matches:()=>true,dataset:{fav:FAV[0].id,store:"Selectos"},value:"0"}})');
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
  await terminar();
  assert.equal(ui.saved()[0].t.Walmart.p, 2);
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
  ui.run('$("tent").onclick({target:{closest:()=>({dataset:{a:"no",id:FAV[0].id,s:"Selectos"}})}})');
  assert.equal(ui.saved()[0].t.Selectos, undefined);
  await ui.run('completarFavorito(FAV[0])');
  assert.equal(ui.saved()[0].t.Selectos, undefined);
  assert.match(ui.el('tfav').innerHTML, /Descartado por ti/);
  assert.equal(ui.registro().at(-1).accion, 'ninguno');
});
test('solo exporta equivalencias confirmadas, con el ID de cada tienda', async () => {
  const ui = interfaz({ resultados: [producto('Walmart', 2), producto('Selectos', 1.75)] });
  await ui.run('vivo("leche salud")');
  ui.run('alternar(favDeVivo(RV[0]));'); await terminar();
  assert.equal(ui.run('equivalenciasLocal().length'), 0);
  ui.run('$("tent").onclick({target:{closest:()=>({dataset:{a:"ok",id:FAV[0].id,s:"Selectos"}})}})');
  const grupos = ui.run('equivalenciasLocal()');
  assert.deepEqual(JSON.parse(JSON.stringify(grupos)).map(g => g.map(x => x.tienda + ':' + x.id)), [['Walmart:Walmart-1', 'Selectos:Selectos-1']]);
  assert.equal(ui.registro().at(-1).accion, 'confirmo');
});
test('favoritos de la versión anterior conservan sus elecciones manuales', async () => {
  const ui = interfaz({ guardados: [{ id: 'v:Walmart:x', n: base.nombre, m: 'Salud', q: 1000, u: 'ml', cant: 2,
    t: { Walmart: { p: 2, url: 'https://tienda.test/x', f: '2026-10-16', src: 'man', id: '9' } } }] }); await terminar();
  assert.equal(ui.run('FAV[0].t.Walmart.manual'), true);
  assert.equal(ui.run('FAV[0].cant'), 2);
  assert.match(ui.el('tent').innerHTML, /Confirmado por ti/);
});
test('si la primera búsqueda no encuentra el producto, prueba con marca y palabras clave', async () => {
  const ui = interfaz({ porConsulta: q => q === 'salud leche entera' ? [producto('Walmart', 2), producto('Selectos', 1.75)] : [producto('Walmart', 2)] });
  ui.run(`alternar({ id: 'g:x', n: 'Leche entera Salud 1 L', m: 'Salud', q: 1000, u: 'ml', t: { Walmart: { p: 2, url: 'https://tienda.test/Walmart/1', src: 'cat' } } });`);
  await terminar(); await terminar();
  assert.deepEqual([...ui.consultas], ['Leche entera Salud 1 L', 'salud leche entera']);
  assert.equal(ui.saved()[0].t.Selectos.p, 1.75);
});

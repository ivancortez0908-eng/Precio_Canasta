const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { equivalente, resumir, leerPromo, costo } = require('../comparador.js');
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
  ui.run('$("tfav").onchange({target:{matches:()=>true,dataset:{fav:FAV[0].id,store:"Selectos"},value:"0"}})');
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
  ui.run('$("dlnombre").value = "Mensual"; $("dlnueva").onsubmit({ preventDefault() {} })'); await terminar();
  const d = ui.listas();
  assert.deepEqual(d.listas.map(l => [l.nombre, l.items.length]), [['Mi lista', 1], ['Mensual', 1]]);
  assert.equal(d.activa, 'l1');
  assert.match(ui.el('dlopts').innerHTML, /checked[^]*checked/);
  ui.run('FAV[0].cant = 4; guardar();');
  assert.deepEqual(ui.listas().listas.map(l => l.items[0].cant), [4, 1]);
  // Quitarlo de una lista no lo quita de la otra
  const mensual = d.listas[1].id;
  ui.run(`$("dlopts").onchange({ target: { dataset: { l: "${mensual}" }, checked: false } })`);
  assert.deepEqual(ui.listas().listas.map(l => l.items.length), [1, 0]);
  assert.equal(ui.run('!!favoritoVivo(RV[0])'), true);
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
  assert.deepEqual(t.filas[0].slice(3), [3, .1, .2, 'A', .3, '', '2026-10-17 a 2026-10-18']);
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
    return { pedidas, consultar: async q => (await w.fetch(new Request('https://w.test/?fresh=1&q=' + encodeURIComponent(q)), {}, { waitUntil() {} })).json() };
  } finally { fs.rmSync(tmp); setImmediate(() => { globalThis.fetch = original; }); }
}
test('Worker: quita tildes, lee ofertas claras de VTEX y de Selectos', async () => {
  const vtex = (id, nombre, Price, extra = {}) => ({ productId: id, productName: nombre, brand: 'Coca Cola', link: 'https://maxi.test/' + id + '/p',
    items: [{ sellers: [{ commertialOffer: { Price, AvailableQuantity: 5, ...extra } }] }] });
  const w = await worker({
    'maxidespensa.com.sv/api': [vtex('1', 'Gaseosa Coca Cola Pet 1250 ml', 1.33, { ListPrice: 1.5, Teasers: [{ '<Name>k__BackingField': '2 x $2.20' }] }),
      vtex('2', 'Gaseosa Coca Cola Pet 3000 ml', 2.49, { Teasers: [{ Name: 'PROMO INTERNA COCA' }] })],
    'superselectos.com': fs.readFileSync(path.join(__dirname, 'datos', 'selectos-busqueda.html'), 'utf8')
  });
  const d = await w.consultar('Atún café ñame');
  assert.ok(w.pedidas.some(u => u.includes('superselectos.com/products?keyword=Atun%20cafe%20%C3%B1ame')), w.pedidas.join(' '));
  assert.ok(w.pedidas.some(u => u.includes('maxidespensa.com.sv/api/catalog_system/pub/products/search?ft=Atun%20cafe%20%C3%B1ame')));
  const maxi = d.resultados.filter(x => x.tienda === 'Maxi Despensa');
  assert.deepEqual(maxi.map(x => [x.id, x.promo, x.antes]), [['1', '2 x $2.20', 1.5], ['2', null, null]]);
  const sel = d.resultados.filter(x => x.tienda === 'Super Selectos');
  assert.deepEqual(sel.map(x => [x.id, x.precio, x.promo]), [['21702', .5, 'Seleccione 2X$0.90'], ['89275', 1.1, null]]);
});

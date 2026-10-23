// Prueba real de navegador con respuestas de tiendas simuladas.
// Requiere Playwright y Chromium instalados; no consulta comercios reales.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const raiz = path.join(__dirname, '..');
const leche = { nombre: 'Leche entera Salud 1 L', marca: 'Salud', q: 1000, u: 'ml', pu: 2, pl: 'L' };
const fila = (tienda, id, precio, extra = {}) => ({ ...leche, tienda, id, precio, url: 'https://tienda.test/' + id, ...extra });
const respuesta = { generado: '2026-10-17T12:00:00Z', tiendas: { Walmart: { ok: true, n: 1 }, 'Super Selectos': { ok: true, n: 1 }, 'Despensa de Don Juan': { ok: false }, 'Maxi Despensa': { ok: true, n: 0 }, Superea: { ok: true, n: 0 }, PriceSmart: { ok: true, n: 0 } },
  resultados: [fila('Walmart', '1', 2, { promo: '2 x $3.80', antes: 2.10 }), fila('Super Selectos', '2', 1.75)] };
// Búsqueda por código de barras: el mismo producto en Walmart (por código) y su equivalente en Super Selectos (por nombre)
const respuestaCodigo = { generado: '2026-10-17T12:00:00Z', ean: '07441029556735', nombre: 'Leche entera Salud 1 L', tiendas: { Walmart: { ok: true, n: 1 }, 'Super Selectos': { ok: true, n: 1 } },
  resultados: [fila('Walmart', '1', 2, { porCodigo: true, ean: '07441029556735' }), fila('Super Selectos', '2', 1.75)] };
const server = http.createServer((req, res) => {
  const archivos = { '/': 'index.html', '/app.js': 'app.js', '/comparador.js': 'comparador.js', '/exportar.js': 'exportar.js' };
  if (req.url === '/config.js') { res.setHeader('Content-Type', 'text/javascript'); res.end('window.API_VIVO="https://worker.test";'); return; }
  if (req.url === '/data/productos.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ supers: ['Walmart', 'Super Selectos'], actualizado: '2026-10-17', items: [{ n: 'Arroz Blanco Precisa 1 lb', m: 'Precisa', q: 454, u: 'g', pl: 'lb', pu: .85, k: 'ean',
    t: [[0, .89, 'https://t.test/a1', .89, 'Arroz Blanco Precisa 1 lb', 'Precisa', '', 'a1'], [1, .85, 'https://t.test/a2', .85, 'Arroz Precisa 1 lb', 'Precisa', '', 'a2']] }] })); return; }
  const archivo = archivos[req.url];
  if (!archivo) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', archivo.endsWith('.js') ? 'text/javascript' : 'text/html');
  res.end(fs.readFileSync(path.join(raiz, archivo)));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.route('https://worker.test/**', route => route.fulfill({ json: route.request().url().includes('ean=') ? respuestaCodigo : respuesta }));
    const url = 'http://127.0.0.1:' + server.address().port;
    // La impresión real abriría un cuadro del sistema; se registra la llamada
    await page.addInitScript(() => { window.print = () => { window.impreso = (window.impreso || 0) + 1; }; });
    await page.goto(url);
    // Accesibilidad: título principal, pestañas ligadas a sus paneles y solo la activa en el orden de Tab; catálogo por «Mayor diferencia»
    assert.equal(await page.getByRole('heading', { level: 1, name: 'Canasta SV', exact: true }).count(), 1);
    assert.deepEqual(await page.evaluate(() => [1, 2].map(i => [document.querySelector('#tab' + i).getAttribute('aria-controls'), document.querySelector('#tab' + i).tabIndex,
      document.querySelector('#p' + i).getAttribute('role')])), [['p1', 0, 'tabpanel'], ['p2', -1, 'tabpanel']]);
    // Página principal: un solo buscador, sugerencias y mayores diferencias; fecha del catálogo junto al buscador
    assert.deepEqual((await page.getByRole('tab').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')), ['Buscar', 'Mi lista 0']);
    // Página principal sin texto de más: sin sugerencias ni tarjeta de la lista
    assert.equal(await page.locator('#sug, #ilista').count(), 0);
    assert.equal(await page.locator('#secvivo').isVisible(), false);
    assert.equal(await page.locator('#cattit').innerText(), 'Mayores diferencias entre tiendas');
    assert.match(await page.locator('#fecha').innerText(), /^Catálogo actualizado al 17 de octubre\.$/);
    if (process.env.CANASTA_CAPTURAS) { fs.mkdirSync(process.env.CANASTA_CAPTURAS, { recursive: true }); await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'inicio-escritorio.png') }); }
    // Guía de uso: botón arriba a la derecha; cada paso resalta su elemento y la guía no cambia las listas
    const listasAntes = await page.evaluate(() => localStorage.getItem('canasta-sv-listas-v1'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Cómo funciona' }).click();
    const guia = page.locator('#guia');
    const pasos = await page.evaluate(() => GUIA.length);
    for (let i = 0; i < pasos; i++) {
      const p = await page.evaluate(() => { const el = GUIA[guiaPaso].el?.(), l = $('guialuz').style, c = $('guiacard').getBoundingClientRect();
        const e = visible(el) ? el.getBoundingClientRect() : null;
        return { t: GUIA[guiaPaso].t, q: $('q').value, dlista: $('dlista').open, centro: !e,
          rodea: !e || (parseFloat(l.left) <= Math.max(4, e.left) && parseFloat(l.top) <= Math.max(4, e.top) && parseFloat(l.left) + parseFloat(l.width) >= Math.min(innerWidth - 4, e.right)),
          dentro: c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight }; });
      assert.ok(p.rodea && p.dentro, JSON.stringify(p));
      if (p.t === 'Busca un producto') assert.equal(p.q, 'arroz');
      if (p.t === 'Elige la lista') assert.equal(p.dlista, true);
      if (p.t === 'Cantidades y precios por tienda') assert.equal(p.centro, true);   // lista vacía: explica al centro
      if (i === 1 && process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'guia-escritorio.png') });
      await guia.getByRole('button', { name: i === pasos - 1 ? 'Terminar' : 'Siguiente' }).click();
    }
    assert.deepEqual(await page.evaluate(() => [$('guia').open, $('dlista').open, $('q').value, $('p1').hidden, $('dlnombre').value]), [false, false, '', false, '']);
    assert.equal(await page.evaluate(() => localStorage.getItem('canasta-sv-listas-v1')), listasAntes);
    // Esc también sale de la guía
    await page.getByRole('button', { name: 'Cómo funciona' }).click();
    await page.keyboard.press('Escape');
    assert.equal(await guia.evaluate(d => d.open), false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('arroz');
    assert.match(await page.locator('#tabla').innerText(), /Arroz Blanco Precisa/);
    assert.equal(await page.locator('#ord').inputValue(), 'dif');
    assert.equal(await page.getAttribute('#estv', 'aria-live'), 'polite');
    // Solo modo claro: aunque el dispositivo esté en modo oscuro, el fondo y las tarjetas siguen claros
    await page.emulateMedia({ colorScheme: 'dark' });
    assert.deepEqual(await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('.controls')).backgroundColor]),
      ['rgb(244, 246, 245)', 'rgb(255, 255, 255)']);
    await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('leche salud');
    await page.getByRole('button', { name: 'Buscar en las tiendas' }).click();
    // El más barato no se indica solo con color
    assert.match(await page.locator('#tv td.best').innerText(), /✓[^]*\$1\.75[^]*\(más barato\)/);
    await page.locator('#tv .star').first().click();
    // La ☆ abre el cuadro para elegir o crear listas
    const cuadro = page.getByRole('dialog', { name: 'Guardar en una lista' });
    await cuadro.getByRole('checkbox', { name: /Mi lista/ }).check();
    await cuadro.getByRole('textbox', { name: 'Nombre de la nueva lista' }).fill('Mensual');
    await cuadro.getByRole('button', { name: 'Crear y agregar' }).click();
    await cuadro.getByRole('checkbox', { name: /Mensual/ }).waitFor();
    assert.equal(await cuadro.getByRole('checkbox', { name: /Mensual/ }).isChecked(), true);
    if (process.env.CANASTA_CAPTURAS) {
      fs.mkdirSync(process.env.CANASTA_CAPTURAS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'guardar-en-lista.png') });
    }
    await cuadro.getByRole('button', { name: 'Listo' }).click();
    await page.getByRole('tab', { name: /Mi lista/ }).click();
    assert.match(await page.getByRole('combobox', { name: 'Lista' }).innerText(), /Mi lista \(1\)[^]*Mensual \(1\)/);
    await page.getByRole('button', { name: 'Actualizar precios', exact: true }).waitFor();
    assert.equal(await page.locator('#tfav tbody tr').count(), 1);
    assert.match(await page.locator('#favtot').innerText(), /\$1.75/);
    assert.match(await page.locator('#favtot').innerText(), /total parcial/);
    await page.getByRole('button', { name: 'Más', exact: true }).click();
    assert.match(await page.locator('#favtot').innerText(), /\$3.50/);
    // La oferta de Walmart se aplica al llevar 2, solo en Walmart
    assert.match(await page.locator('#favtot').innerText(), /\$3.80/);
    assert.match(await page.locator('#tfav').innerText(), /aplicada: \$3\.80 por 2/);
    assert.equal(await page.locator('#entrena').count(), 0);
    // Resumen arriba de la tabla
    assert.match(await page.locator('#favresumen').innerText(), /Compra completa más barata: Super Selectos \$3\.50 · Combinando tiendas: \$3\.50/);
    // Zonas táctiles de al menos 24 px en computadora
    assert.ok(Math.min(...await page.locator('#tfav summary').evaluateAll(es => es.map(e => e.getBoundingClientRect().height))) >= 24);
    // Con seis tiendas en una ventana angosta, cantidad y Quitar siguen a la vista y la tabla se desplaza hasta la última tienda
    await page.setViewportSize({ width: 1000, height: 900 });
    const enPantalla = async l => { const b = await l.boundingBox(); return !!b && b.x >= 0 && b.x + b.width <= 1000; };
    assert.equal(await enPantalla(page.getByRole('button', { name: 'Quitar', exact: true })), true);
    assert.equal(await enPantalla(page.getByRole('button', { name: 'Más', exact: true })), true);
    const tabla = page.locator('#tfav').locator('xpath=..');
    assert.equal(await tabla.evaluate(w => { w.scrollLeft = w.scrollWidth; return w.scrollLeft > 0 && getComputedStyle(w).overflowX === 'auto'; }), true);
    assert.equal(await enPantalla(page.locator('#tfav th', { hasText: 'PriceSmart' })), true);
    assert.equal(await enPantalla(page.getByRole('button', { name: 'Quitar', exact: true })), true);
    if (process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'favoritos-1000px.png') });
    await tabla.evaluate(w => { w.scrollLeft = 0; });
    await page.setViewportSize({ width: 1440, height: 1100 });
    // En pantallas anchas la tabla usa todo el ancho disponible (margen de 16 px por lado)
    const ancho = await page.locator('#tfav').locator('xpath=..').evaluate(w => w.getBoundingClientRect().width);
    assert.ok(ancho >= 1440 - 32 - 20, `la tabla mide ${ancho}px`);
    if (process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'favoritos-escritorio.png'), fullPage: true });
    // Descargas: Excel como archivo .xlsx y PDF con la impresión del navegador
    // Menú «⋯»: acciones de la lista agrupadas, las que borran al final; teclado, Esc y tocar fuera lo cierran
    const menu = page.getByRole('button', { name: 'Más opciones de la lista' });
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(await page.getByRole('menuitem').allInnerTexts(), ['Nueva lista', 'Renombrar lista', 'Descargar PDF', 'Descargar Excel', 'Vaciar lista', 'Eliminar lista']);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'lnueva');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'lborrar');
    await page.keyboard.press('Escape');
    assert.deepEqual([await page.locator('#lacciones').isVisible(), await page.evaluate(() => document.activeElement.id)], [false, 'lmenu']);
    await menu.click(); await page.locator('#favmsg').click();
    assert.equal(await page.locator('#lacciones').isVisible(), false);
    await menu.click();
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Descargar Excel' }).click()]);
    assert.equal(await page.locator('#lacciones').isVisible(), false);
    assert.match(descarga.suggestedFilename(), /^mi-lista-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const libro = fs.readFileSync(await descarga.path());
    assert.equal(libro.readUInt32LE(0), 0x04034b50);
    await menu.click();
    await page.getByRole('menuitem', { name: 'Descargar PDF' }).click();
    assert.equal(await page.evaluate(() => window.impreso), 1);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('#imprimir table').isVisible(), true);
    assert.equal(await page.locator('#tfav').isVisible(), false);
    assert.match(await page.locator('#imprimir').innerText(), /Mi lista[^]*Total por tienda[^]*\$3\.50/);
    if (process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'pdf.png'), fullPage: true });
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // Celular: botones, campos y opciones de al menos 44 px de alto
    const bajos = await page.evaluate(() => [...document.querySelectorAll('#p2 button, #p2 select, #p2 input, #p2 summary')].filter(e => e.getBoundingClientRect().height)
      .map(e => [e.id || e.className || e.tagName, Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
    assert.deepEqual(bajos, []);
    // Celular: cada barra en una sola fila
    // misma fila = centros verticales a menos de 6 px entre sí
    const filas = async ids => { const c = await Promise.all(ids.map(id => page.locator(id).evaluate(b => { const r = b.getBoundingClientRect(); return r.top + r.height / 2; })));
      return Math.max(...c) - Math.min(...c) < 6 ? 1 : 2; };
    assert.equal(await filas(['#lsel', '#favrefresh', '#lmenu']), 1);
    // El menú abierto cabe en la pantalla y sus opciones miden al menos 44 px
    await page.getByRole('button', { name: 'Más opciones de la lista' }).click();
    const caja = await page.locator('#lacciones').boundingBox();
    assert.ok(caja.x >= 0 && caja.x + caja.width <= 390, JSON.stringify(caja));
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#lacciones button')].filter(b => b.getBoundingClientRect().height && b.getBoundingClientRect().height < 44).map(b => b.id)), []);
    if (process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'menu-movil.png') });
    await page.keyboard.press('Escape');
    // Lista compacta: nombre y precios con su supermercado (el más barato primero); el detalle se abre al tocar
    assert.equal(await page.locator('#tfav').isVisible(), false);
    const producto = page.locator('#mfav .mcab').first();
    assert.match(await producto.innerText(), /Leche entera Salud 1 L[^]*Super Selectos\s*\$1\.75[^]*Walmart\s*\$2\.00[^]*4 sin precio/);
    assert.equal(await page.getByRole('spinbutton').count(), 0);
    await producto.click();
    assert.equal(await producto.getAttribute('aria-expanded'), 'true');
    // El producto abierto se distingue de los demás: franja verde a la izquierda
    assert.equal(await page.locator('#mfav .mitem.abierto').evaluate(n => getComputedStyle(n).borderLeftColor), 'rgb(10, 110, 55)');
    assert.match(await page.locator('#mfav .mdet').innerText(), /Walmart[^]*Oferta 2 x \$3\.80[^]*Cambiar producto/);
    // «Cambiar producto» en celular: selector a todo el ancho del renglón, con opciones y «Buscar más opciones»
    await page.locator('#mfav .mtienda').first().getByText('Cambiar producto').click();
    const sel = page.locator('#mfav details.opciones[open] select');
    assert.ok((await sel.boundingBox()).width > 300);
    assert.match((await sel.locator('option').allInnerTexts()).join('|'), /Leche entera Salud 1 L · \$2\.00 \(actual\)/);
    assert.equal(await page.locator('#mfav details.opciones[open]').getByRole('button', { name: 'Buscar más opciones' }).count(), 1);
    if (process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'favoritos-movil.png'), fullPage: true });
    await page.reload();
    await page.getByRole('tab', { name: /Mi lista/ }).click();
    await page.locator('#mfav .mcab').first().click();
    assert.equal(await page.getByRole('spinbutton').inputValue(), '2');
    await page.getByRole('button', { name: 'Quitar', exact: true }).click();
    assert.match(await page.locator('#favmsg').innerText(), /está vacía/);
    // La otra lista conserva el producto con su propia cantidad
    await page.getByRole('combobox', { name: 'Lista' }).selectOption({ label: 'Mensual (1)' });
    if (!(await page.getByRole('spinbutton').count())) await page.locator('#mfav .mcab').first().click();
    assert.equal(await page.getByRole('spinbutton').inputValue(), '1');
    // Celular: catálogo y resultados de las tiendas también en lista compacta, con la tienda junto a cada precio y sin desplazar la página
    await page.getByRole('tab', { name: /Buscar/ }).click();
    // Celular: pestañas fijas abajo; filtros del catálogo compactos, en una fila y sin ocupar todo el ancho
    assert.equal(await page.locator('.tabs').evaluate(n => Math.round(n.getBoundingClientRect().bottom) === innerHeight), true);
    const filtros = await page.evaluate(() => [document.querySelector('#comp').parentElement, document.querySelector('#ord')].map(e => e.getBoundingClientRect()));
    assert.ok(Math.abs(filtros[0].top - filtros[1].top) < 6 && filtros[1].right <= 390 - 16 && filtros[1].width < 250, JSON.stringify(filtros));
    // También en un teléfono de 360 px (Android)
    await page.setViewportSize({ width: 360, height: 800 });
    const f360 = await page.evaluate(() => [document.querySelector('#comp').parentElement, document.querySelector('#ord')].map(e => e.getBoundingClientRect()));
    assert.ok(Math.abs(f360[0].top - f360[1].top) < 6 && f360[1].right <= 360 - 16, JSON.stringify(f360));
    if (process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'catalogo-360.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#tabla').isVisible(), false);
    assert.match(await page.locator('#mcat .mitem').first().innerText(), /Arroz Blanco Precisa 1 lb[^]*✓\s*Super Selectos\s*\$0\.85[^]*Walmart\s*\$0\.89[^]*\$0\.85 por lb/);
    if (process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'catalogo-movil.png') });
    await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('leche salud');
    await page.getByRole('button', { name: 'Buscar en las tiendas' }).click();
    await page.locator('#mvivo .mitem').first().waitFor();
    assert.equal(await page.locator('#tv').isVisible(), false);
    const vivoMovil = await page.locator('#mvivo').innerText();
    assert.match(vivoMovil, /✓\s*Super Selectos\s*\$1\.75/);
    assert.match(vivoMovil, /Walmart\s*\$2\.00\s*oferta[^]*Oferta 2 x \$3\.80/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'envivo-movil.png') });
    await page.mouse.move(0, 0);
    // Colores con contraste suficiente (verde de marca, botón principal relleno y rojo de acciones que borran) y bordes visibles en los campos
    assert.deepEqual(await page.evaluate(() => [getComputedStyle(document.querySelector('.brand')).color, getComputedStyle(document.querySelector('#favclear')).color,
      getComputedStyle(document.querySelector('#q')).borderTopColor, getComputedStyle(document.querySelector('#fbuscar button.pri')).backgroundColor]),
      ['rgb(10, 110, 55)', 'rgb(176, 20, 51)', 'rgb(124, 132, 128)', 'rgb(10, 110, 55)']);
    // Celular: campos de 16 px para que Safari no haga zoom al tocarlos
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('main input, main select')].filter(e => e.getBoundingClientRect().height)
      .filter(e => getComputedStyle(e).fontSize !== '16px').map(e => e.id || e.className || e.type)), []);
    // Código de barras escrito a mano (este Chromium no trae lector de códigos: lo explica y deja escribirlo)
    await page.getByRole('button', { name: 'Escanear código de barras' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear código de barras' });
    assert.match(await escaner.locator('#scanest').innerText(), /no puede leer códigos con la cámara/);
    await escaner.getByRole('textbox', { name: 'Código de barras' }).fill('7441029556736');
    await escaner.getByRole('button', { name: 'Buscar código' }).click();
    assert.match(await escaner.locator('#scanest').innerText(), /no es válido/);
    await escaner.getByRole('textbox', { name: 'Código de barras' }).fill('7441029556735');
    await escaner.getByRole('button', { name: 'Buscar código' }).click();
    await page.locator('#mvivo .mitem').first().waitFor();
    assert.equal(await escaner.isVisible(), false);
    assert.equal(await page.locator('#q').inputValue(), '7441029556735');
    assert.match(await page.locator('#estv').innerText(), /^Código 7441029556735: Leche entera Salud 1 L\./);
    assert.match(await page.locator('#mvivo').innerText(), /Mismo código de barras[^]*Walmart\s*\$2\.00[^]*Coincide por nombre y tamaño[^]*Super Selectos\s*\$1\.75/);
    if (process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'codigo-movil.png') });
    // Con cámara (simulada, como en Chrome de Android): lee el código, cierra la cámara y busca
    const cam = await browser.newPage({ viewport: { width: 390, height: 844 } });
    cam.on('pageerror', e => errores.push(e.message));
    await cam.route('https://worker.test/**', route => route.fulfill({ json: route.request().url().includes('ean=') ? respuestaCodigo : respuesta }));
    await cam.addInitScript(() => {
      window.BarcodeDetector = class { static async getSupportedFormats() { return ['ean_13', 'qr_code']; } async detect() { return (window.lecturas = (window.lecturas || 0) + 1) > 2 ? [{ rawValue: '7441029556735' }] : []; } };
      navigator.mediaDevices.getUserMedia = async () => { const c = document.createElement('canvas'); c.getContext('2d').fillRect(0, 0, 10, 10); window.camara = c.captureStream(); return window.camara; };
    });
    await cam.goto(url);
    await cam.getByRole('button', { name: 'Escanear código de barras' }).click();
    await cam.locator('#mvivo .mitem').first().waitFor();
    assert.deepEqual(await cam.evaluate(() => [$('dscan').open, $('q').value, window.camara.getTracks().every(t => t.readyState === 'ended')]), [false, '7441029556735', true]);
    await cam.close();
    assert.deepEqual(errores, []);
    console.log('Interfaz verificada: búsqueda → guardar en dos listas → cantidades → Excel y PDF → móvil → persistencia → quitar → cambiar de lista.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

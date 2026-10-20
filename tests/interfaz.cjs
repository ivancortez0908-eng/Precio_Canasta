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
const respuesta = { generado: '2026-10-17T12:00:00Z', tiendas: { Walmart: { ok: true, n: 1 }, 'Super Selectos': { ok: true, n: 1 }, 'Despensa de Don Juan': { ok: false } },
  resultados: [fila('Walmart', '1', 2), fila('Super Selectos', '2', 1.75)] };
const server = http.createServer((req, res) => {
  const archivos = { '/': 'index.html', '/app.js': 'app.js', '/comparador.js': 'comparador.js' };
  if (req.url === '/config.js') { res.setHeader('Content-Type', 'text/javascript'); res.end('window.API_VIVO="https://worker.test";'); return; }
  if (req.url === '/data/productos.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ supers: ['Walmart', 'Super Selectos'], actualizado: '2026-10-17', items: [] })); return; }
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
    await page.route('https://worker.test/**', route => route.fulfill({ json: respuesta }));
    const url = 'http://127.0.0.1:' + server.address().port;
    await page.goto(url);
    await page.getByRole('tab', { name: /En vivo/ }).click();
    await page.getByRole('searchbox', { name: 'Producto a buscar en vivo' }).fill('leche salud');
    await page.getByRole('button', { name: 'Buscar en las tiendas' }).click();
    await page.locator('#tv .star').first().click();
    await page.getByRole('tab', { name: /Favoritos/ }).click();
    await page.getByRole('button', { name: 'Actualizar precios', exact: true }).waitFor();
    assert.equal(await page.locator('#tfav tbody tr').count(), 1);
    assert.match(await page.locator('#favtot').innerText(), /\$1.75/);
    assert.match(await page.locator('#favtot').innerText(), /total parcial/);
    await page.getByRole('button', { name: 'Más', exact: true }).click();
    assert.match(await page.locator('#favtot').innerText(), /\$3.50/);
    assert.match(await page.locator('#favtot').innerText(), /\$4.00/);
    if (process.env.CANASTA_CAPTURAS) {
      fs.mkdirSync(process.env.CANASTA_CAPTURAS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'favoritos-escritorio.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.CANASTA_CAPTURAS) await page.screenshot({ path: path.join(process.env.CANASTA_CAPTURAS, 'favoritos-movil.png'), fullPage: true });
    await page.reload();
    await page.getByRole('tab', { name: /Favoritos/ }).click();
    assert.equal(await page.getByRole('spinbutton').inputValue(), '2');
    await page.getByRole('button', { name: 'Quitar', exact: true }).click();
    assert.match(await page.locator('#favmsg').innerText(), /Aún no tienes favoritos/);
    assert.deepEqual(errores, []);
    console.log('Interfaz verificada: búsqueda → favorito en varias tiendas → cantidades → móvil → persistencia → quitar.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

# Canasta SV

Plataforma web para consultar y comparar precios de productos básicos entre supermercados.

- Búsqueda por producto y filtro por categoría
- Resalta el precio más bajo de cada producto
- Canasta: calcula el total por supermercado
- Sitio estático (HTML + JS), sin dependencias ni servidor

## Estructura
```
index.html        # interfaz y lógica
data/precios.json # precios (los genera el scraper)
scraper/          # obtiene precios de las tiendas en línea
.github/workflows # ejecuta el scraper cada día
```

## Cómo se obtienen los precios
Un navegador no puede leer directamente otras páginas (CORS), así que una **GitHub Action** corre `scraper/scrape.mjs` cada día, consulta las tiendas en línea y guarda `data/precios.json`. El sitio lee ese archivo. Si una consulta falla, conserva el último precio conocido.

- `scraper/productos.json`: productos a rastrear (texto de búsqueda y palabras clave para validar el resultado).
- `scraper/tiendas.mjs`: una entrada por supermercado. Solo **Walmart** (tienda VTEX) viene configurado; **Super Selectos** y **Despensa de Don Juan** están como pendientes.
- Probar localmente: `node scraper/scrape.mjs` (Node 20+).
- Correr en GitHub: pestaña **Actions → Actualizar precios → Run workflow** (también corre solo cada día).

## Agregar un supermercado
En el navegador abre la tienda en línea, busca un producto y en DevTools → Network mira qué petición JSON devuelve los resultados. Luego crea un adaptador en `tiendas.mjs` que reciba un texto y devuelva `[{ precio, nombre }]`, y pon `activa: true`. Revisa antes los términos de uso y el `robots.txt` del sitio.

## Aviso
Los precios en línea pueden diferir de los de sala. Los datos iniciales son de ejemplo hasta la primera ejecución del scraper.

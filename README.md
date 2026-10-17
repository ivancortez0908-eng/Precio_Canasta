# Canasta SV

Comparador de precios de supermercados de El Salvador. Descarga el catálogo completo de cada tienda en línea, agrupa los productos equivalentes y los muestra lado a lado, con precio por libra, litro o unidad.

## Cómo funciona
1. `scraper/catalogo.mjs` descarga todo el catálogo de cada tienda activa a `data/catalogo/<tienda>.json` (la base de productos).
2. `scraper/emparejar.mjs` agrupa los productos equivalentes entre tiendas y genera `data/productos.json`, que lee la página.
3. Una GitHub Action ejecuta ambos pasos lunes y jueves (o a mano en **Actions → Actualizar precios → Run workflow**).

## Cómo se decide que dos productos son iguales
1. **Código de barras (EAN):** la señal más confiable.
2. **Marca + nombre + tamaño:** el tamaño se normaliza (1 lb = 454 g, 1 gal = 3785 ml…). Si el tamaño o la marca difieren, no se agrupan.
3. **Manual:** `scraper/equivalencias.json` fuerza equivalencias que el algoritmo no detecta:
   ```json
   [[ {"tienda":"Walmart","id":"12345"}, {"tienda":"Super Selectos","id":"678"} ]]
   ```
Cada fila muestra marca, tamaño y la descripción de cada tienda (desplegable “Descripción”) y con qué criterio se unió. Lo que no se pudo emparejar aparece en una sola tienda (desmarca “Solo productos en 2 o más tiendas” para verlo).

## Marca y descripción
- **Walmart** entrega marca y descripción en su catálogo.
- **Super Selectos** no las trae en el listado: la marca se detecta dentro del nombre con la lista `marcas` de `scraper/canasta.json` (agrega ahí las que falten) y no tiene descripción más allá del nombre.

## Tiendas
Se configuran en `scraper/tiendas.mjs`.
- **Super Selectos:** su página entrega el HTML ya armado. El scraper lee páginas de búsqueda (una por cada término de `scraper/canasta.json`) y unas pocas categorías, con 3 segundos de pausa entre peticiones. No descarga todo el catálogo: su `robots.txt` rechaza la extracción masiva. Solo se lee la primera página de cada búsqueda.
- **Walmart:** supone una tienda VTEX; falta verificarlo en la primera corrida.
- **Despensa de Don Juan:** pendiente.

Para ampliar la cobertura, agrega términos a `scraper/canasta.json`. Revisa términos de uso y `robots.txt` antes de activar cada tienda.

## Probar localmente
```bash
node scraper/catalogo.mjs && node scraper/emparejar.mjs   # Node 20+
python3 -m http.server                                    # abre http://localhost:8000
```

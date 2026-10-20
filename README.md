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
- **Walmart**, **Despensa de Don Juan** y **Maxi Despensa:** tiendas VTEX del mismo grupo (Walmart Centroamérica); comparten muchos IDs de producto, pero cada una tiene sus propios precios. Si la consulta directa desde GitHub no devuelve productos, el scraper usa el Worker como puente.
- **Despensa Familiar:** no se incluye porque no tiene tienda en línea en El Salvador.

Para ampliar la cobertura, agrega términos a `scraper/canasta.json`. Revisa términos de uso y `robots.txt` antes de activar cada tienda.

## Listas de favoritos
Marca la ☆ en un producto del catálogo o de la búsqueda en vivo: se abre **Guardar en una lista**, donde marcas en qué listas va o creas una nueva. Un producto puede estar en varias listas y cada una guarda su propia cantidad y sus elecciones.

En la pestaña **Favoritos** eliges la lista que quieres ver y puedes crear otra, renombrarla o eliminarla. Para cada producto la página lo busca en todas las tiendas (usa el Worker de la búsqueda en vivo) y arma el comparativo: precio por tienda, cantidad (1 a 99) y total de la compra en cada tienda.
- Solo se asigna un producto automáticamente si coinciden marca, nombre/variante y presentación, y hay una sola opción en esa tienda. Si hay varias o ninguna segura, la celda ofrece **Elegir coincidencia**; con **Cambiar producto** eliges otra presentación o indicas que **no está en esta tienda** (ya no se vuelve a llenar sola).
- Si la primera búsqueda no encuentra el producto, se prueba con la marca y las palabras clave del nombre.
- Una tienda sin coincidencia o que no respondió no cuenta como $0: su total sale como **parcial** y no puede ganar la comparación.
- Se actualiza al abrir la pestaña o cambiar de lista si no se consultó hoy, con **Actualizar precios** o con **Consultar tiendas** en cada fila. Si la red falla se conservan los precios guardados con su fecha.
- Las listas se guardan en el navegador (no en GitHub). La primera vez, la lista anterior pasa a «Mi lista».

### Descargar la lista
- **Descargar Excel:** genera un archivo `.xlsx` con cada producto, su cantidad, el precio en cada tienda, dónde conviene comprarlo, la fecha del precio y los totales por tienda (marcados como parciales si faltan productos).
- **Descargar PDF:** abre la ventana de impresión del navegador con la misma tabla; elige **Guardar como PDF** como destino.

La interfaz está en `index.html` (diseño), `app.js` (comportamiento), `comparador.js` (reglas de equivalencia y totales) y `exportar.js` (Excel y tabla para PDF). Se publican juntos.

## Aportes de comparaciones (pregunta al pie de la página)
Cuando eliges o cambias a mano un producto en la tabla de precios de Favoritos, al pie aparece «¿Nos ayudas con las comparaciones que cambiaste? Sí / No». Si dice Sí, la persona ve qué se enviaría y puede **enviarlo al proyecto**. Las coincidencias automáticas nunca se envían.
- **Enviar al proyecto:** el Worker valida el aporte y crea una *issue* en GitHub con la lista y el JSON. Tú la revisas y le pones la etiqueta `aprobado`: el workflow `aplicar-aporte.yml` la une a `scraper/equivalencias.json` y la cierra. Nada entra a la base sin tu aprobación. El emparejador usa esas equivalencias por id o por enlace y esos productos salen como «Equivalencia verificada».
- **Activarlo:** (1) crea un token fine-grained de GitHub solo para este repositorio con permiso *Issues: Read and write*; (2) en Cloudflare agrega el secreto `GITHUB_TOKEN_APORTES` y, si el repositorio no es `ivancortez0908-eng/Precio_Canasta`, la variable `GITHUB_REPO`; (3) crea en GitHub la etiqueta `aprobado`.

## Búsqueda en vivo (producto específico)
La pestaña **Buscar en vivo** consulta un solo producto en el momento en cada tienda, sin descargar catálogos. Como el navegador no puede leer otras tiendas directamente, se usa un Worker gratuito de Cloudflare (`worker/worker.js`) que hace una petición por tienda y guarda cada consulta 10 minutos en caché.

**Instalación (una vez):**
1. Crea una cuenta gratis en cloudflare.com → **Workers & Pages → Create → Create Worker**, ponle nombre `canasta-busqueda` y pulsa **Deploy**.
2. Pulsa **Edit code**, borra lo que haya, pega todo `worker/worker.js` y **Deploy**.
3. Copia la dirección del Worker (`https://canasta-busqueda.TU-SUBDOMINIO.workers.dev`).
4. **Settings → Variables and Secrets → Add**: nombre `ORIGEN_PERMITIDO`, valor `https://TU_USUARIO.github.io` (sin barra final). Así solo tu sitio puede usarlo.
5. En este repositorio edita `config.js` y pega la dirección: `window.API_VIVO = "https://canasta-busqueda.TU-SUBDOMINIO.workers.dev";`

**PriceSmart (opcional):** en Cloudflare, **Settings → Variables and Secrets → Add**, tipo **Secret**, nombre `PRICESMART_KEY`, valor = el `auth_key` público de su buscador. Sin esa variable, el Worker no consulta PriceSmart. Solo se usa en la búsqueda en vivo, nunca en la descarga programada.

**Agregar una farmacia o tienda:** en `worker/worker.js` escribe una función como `walmart` o `selectos` (recibe el texto buscado y devuelve `[{id, nombre, marca, precio, url}]`) y agrégala al objeto `TIENDAS`.

## Probar localmente
```bash
node scraper/catalogo.mjs && node scraper/emparejar.mjs   # Node 20+
python3 -m http.server                                    # abre http://localhost:8000
node --test tests/canasta.test.cjs                        # reglas y flujo de favoritos
node tests/interfaz.cjs                                   # en Chromium (requiere Playwright)
```

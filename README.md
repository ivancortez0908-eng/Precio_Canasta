# Canasta SV

Comparador de precios de supermercados de El Salvador. Descarga el catálogo completo de cada tienda en línea, agrupa los productos equivalentes y los muestra lado a lado, con precio por libra, litro o unidad.

## Cómo funciona
1. `scraper/catalogo.mjs` descarga todo el catálogo de cada tienda activa a `data/catalogo/<tienda>.json` (la base de productos).
2. `scraper/emparejar.mjs` agrupa los productos equivalentes entre tiendas y genera `data/productos.json`, que lee la página.
3. Una GitHub Action ejecuta ambos pasos lunes y jueves (o a mano en **Actions → Actualizar precios → Run workflow**).

## Cómo se decide que dos productos son iguales
1. **Código de barras (EAN):** la señal más confiable. Solo se usa si su dígito de control es correcto y tiene al menos 8 cifras significativas (los códigos internos cortos de productos a granel no se usan).
2. **Marca + nombre + tamaño:** el tamaño se normaliza (1 lb = 454 g, 1 gal = 3785 ml…). La onza de peso («oz», «onzas») vale 28.35 g y la onza líquida («fl oz», «onzas líquidas») 29.57 ml: una lata de «12 fl oz» equivale a una de «355 ml». Si el tamaño o la marca difieren, no se agrupan.
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
- **Superea:** supermercado solo en línea. Se consulta el índice público de Algolia que usa su propio buscador (la clave de solo búsqueda que el sitio entrega a todo visitante), con la bodega predeterminada del sitio; solo entran productos con precio y existencia. El catálogo usa los términos de `scraper/canasta.json`.
- **Despensa Familiar:** no se incluye porque no tiene tienda en línea en El Salvador.
- **Dollarcity:** no se incluye: su sitio solo muestra departamentos y ubicaciones de tiendas, sin productos ni precios en línea.

Para ampliar la cobertura, agrega términos a `scraper/canasta.json`. Revisa términos de uso y `robots.txt` antes de activar cada tienda.

## Listas de favoritos
Marca la ☆ en un producto del catálogo o de la búsqueda en vivo: se abre **Guardar en una lista**, donde marcas en qué listas va o creas una nueva y confirmas con **Guardar** (**Cancelar** cierra sin cambiar nada). Un producto puede estar en varias listas y cada una guarda su propia cantidad y sus elecciones.

En la pestaña **Favoritos** eliges la lista que quieres ver y puedes crear otra, renombrarla o eliminarla. Para cada producto la página lo busca en todas las tiendas (usa el Worker de la búsqueda en vivo) y arma el comparativo: precio por tienda, cantidad (1 a 99) y total de la compra en cada tienda.
- Solo se asigna un producto automáticamente si coinciden marca, nombre/variante y presentación, y hay una sola opción en esa tienda. Si hay varias o ninguna segura, la celda ofrece **Elegir coincidencia**; con **Cambiar producto** eliges otra presentación o indicas que **no está en esta tienda** (ya no se vuelve a llenar sola).
- Si guardaste el producto desde una búsqueda por código de barras (o el producto del catálogo tiene código), al actualizar se consulta primero por código: las tiendas con una **equivalencia aprobada** (por ejemplo Superea o Selectos, que no publican códigos) se llenan aunque su nombre sea distinto.
- Si la primera búsqueda no encuentra el producto, se prueba con la marca y las palabras clave del nombre.
- **Ofertas por cantidad:** si una tienda publica una oferta clara («2 x $2.20», «Seleccione 2X$0.90», «2x1», «Paga 2 y lleva 3», «Segundo al 50%»), se muestra en su celda y se aplica **solo en esa tienda** al llevar la cantidad necesaria, por grupos completos (3 unidades con «2 x $2.20» = 2 en oferta + 1 a precio normal). Los descuentos no se acumulan y los textos que no siguen ese formato no se interpretan. También se muestra el precio anterior cuando la tienda lo publica. La tienda más barata de cada producto se elige según la cantidad pedida.
- Una tienda sin coincidencia o que no respondió no cuenta como $0: su total sale como **parcial** y no puede ganar la comparación.
- Se actualiza al abrir la pestaña o cambiar de lista si no se consultó hoy, con **Actualizar precios** o con **Consultar tiendas** en cada fila. Si la red falla se conservan los precios guardados con su fecha.
- Las listas se guardan en el navegador (no en GitHub). La primera vez, la lista anterior pasa a «Mi lista».

### Descargar la lista
- **Descargar Excel:** genera un archivo `.xlsx` con cada producto, su cantidad, el precio en cada tienda, dónde conviene comprarlo, la fecha del precio y los totales por tienda (marcados como parciales si faltan productos).
- **Descargar PDF:** abre la ventana de impresión del navegador con la misma tabla; elige **Guardar como PDF** como destino.

La interfaz está en `index.html` (diseño), `app.js` (comportamiento), `comparador.js` (reglas de equivalencia y totales) y `exportar.js` (Excel y tabla para PDF). Se publican juntos.

## Aportes de comparaciones (pregunta al pie de la página)
Cuando eliges o cambias a mano un producto en la tabla de precios de Favoritos, al pie aparece «¿Nos ayudas con las comparaciones que cambiaste? Sí / No». Si dice Sí, la persona ve qué se enviaría y puede **enviarlo al proyecto**. Las coincidencias automáticas nunca se envían.
- **Enviar al proyecto:** el Worker valida el aporte y crea una *issue* en GitHub con la lista y el JSON. Tú la revisas y le pones la etiqueta `aprobado`: el workflow `aplicar-aporte.yml` la une a `scraper/equivalencias.json` y la cierra con un comentario que dice qué aplicó. **Para descartar una comparación**, antes de poner la etiqueta edita la issue y borra su sección completa (el título «Comparación N» y su tabla): solo se aplican las que sigan en la issue y el JSON del final no se toca. Para rechazar el aporte entero, ciérralo como *not planned*. Si una equivalencia equivocada ya entró, se quita de `scraper/equivalencias.json` y desaparece en la siguiente actualización del catálogo. Nada entra a la base sin tu aprobación. El emparejador usa esas equivalencias por id o por enlace y esos productos salen como «Equivalencia verificada».
- **Activarlo:** (1) crea un token fine-grained de GitHub solo para este repositorio con permiso *Issues: Read and write*; (2) en Cloudflare agrega el secreto `GITHUB_TOKEN_APORTES` y, si el repositorio no es `ivancortez0908-eng/Precio_Canasta`, la variable `GITHUB_REPO`; (3) crea en GitHub la etiqueta `aprobado`.

## Búsqueda en vivo (producto específico)
La pestaña **Buscar en vivo** consulta un solo producto en el momento en cada tienda, sin descargar catálogos. Solo se muestran los resultados que contienen **al menos 2 palabras** de la búsqueda (o la única, si se escribe una): «gaseosa cocacola» muestra las Coca Cola y oculta embutidos o papel. No cuentan artículos, números ni medidas; singular y plural son iguales y no importan acentos ni espacios («cocacola» = «Coca-Cola»). El botón **Mostrar todos** enseña también los ocultos. Como el navegador no puede leer otras tiendas directamente, se usa un Worker gratuito de Cloudflare (`worker/worker.js`) que hace una petición por tienda y guarda cada consulta 10 minutos en caché.

**Publicación automática:** al unir a `main` un cambio en `worker/worker.js` (o `worker/wrangler.toml`), la acción **Publicar Worker** corre las pruebas, publica el Worker `canasta-busqueda` en Cloudflare y comprueba que responda con la nueva `version`. También se puede lanzar a mano en **Actions → Publicar Worker → Run workflow**. Necesita dos secretos del repositorio (Settings → Secrets and variables → Actions):
- `CLOUDFLARE_API_TOKEN`: token de Cloudflare (My Profile → API Tokens) con permisos *Account · Workers Scripts · Edit* y *Account · Account Settings · Read*.
- `CLOUDFLARE_ACCOUNT_ID`: el Account ID que aparece en Workers & Pages.

`worker/wrangler.toml` conserva las variables y secretos definidos en el panel (`ORIGEN_PERMITIDO`, `PRICESMART_KEY`, `GITHUB_TOKEN_APORTES`).

**Instalación desde cero (solo si se crea otra cuenta):** crea en Cloudflare un Worker llamado `canasta-busqueda`, agrega la variable `ORIGEN_PERMITIDO` con la dirección de tu sitio (`https://TU_USUARIO.github.io`, sin barra final), guarda los dos secretos de arriba en GitHub, corre **Publicar Worker** y pega la dirección del Worker en `config.js`: `window.API_VIVO = "https://canasta-busqueda.TU-SUBDOMINIO.workers.dev";`

**PriceSmart (opcional):** en Cloudflare, **Settings → Variables and Secrets → Add**, tipo **Secret**, nombre `PRICESMART_KEY`, valor = el `auth_key` público de su buscador. Sin esa variable, el Worker no consulta PriceSmart. Solo se usa en la búsqueda en vivo, nunca en la descarga programada.

**Agregar una farmacia o tienda:** en `worker/worker.js` escribe una función como `walmart` o `selectos` (recibe el texto buscado y devuelve `[{id, nombre, marca, precio, url}]`) y agrégala al objeto `TIENDAS`.

## Probar localmente
```bash
node scraper/catalogo.mjs && node scraper/emparejar.mjs   # Node 20+
python3 -m http.server                                    # abre http://localhost:8000
node --test tests/canasta.test.cjs                        # reglas y flujo de favoritos
node tests/interfaz.cjs                                   # en Chromium (requiere Playwright)
```

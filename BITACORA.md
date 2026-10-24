# Bitácora — 24 de octubre de 2026 (el «Espere…» se quedaba en pantalla)

## Problema
Tras publicar el aviso, el celular mostraba los productos pero el «Espere…» no se quitaba. GitHub Pages deja que el navegador guarde los archivos 10 minutos: la página nueva (con el aviso) se combinó con un `app.js` anterior, que no sabe ocultarlo. Se reprodujo en Chromium sirviendo el `app.js` anterior: 60 productos y el aviso visible.

## Cambios
- `index.html`: respaldo en CSS: si `#fecha` tiene texto (el catálogo cargó o falló, con cualquier versión de `app.js`) el aviso se oculta.
- `index.html`: los cuatro `<script>` llevan `?v=2026-10-24c`; al cambiar cualquiera se sube ese valor para que el navegador descargue los nuevos junto con la página (regla en AGENTS).
- Prueba: los cuatro scripts tienen la misma versión.

## Validación
- `node --test tests/canasta.test.cjs`: 47 pasan. `node tests/interfaz.cjs` pasa. Con el `app.js` anterior, el aviso ahora se oculta al cargar el catálogo.

# Bitácora anterior (aviso «Espere…» al cargar el catálogo)

## Cambios
- `index.html`: `div#cargando` fijo al centro de la pantalla con un círculo giratorio, «Espere…» y «Cargando el catálogo» (`role="status"`). No bloquea la página; con movimiento reducido el círculo no gira. El texto «Cargando el catálogo…» bajo el buscador se quitó para no repetirlo.
- `app.js`: se oculta cuando el catálogo carga o falla (`finally`).
- Pruebas: el aviso se ve antes de cargar y se oculta después (unitaria y en Chromium). Guía de diseño actualizada.

## Validación
- `node --test tests/canasta.test.cjs`: 46 pasan. `node tests/interfaz.cjs` pasa. Capturas con carga lenta (3 s) en celular y escritorio revisadas.

# Bitácora anterior (guía: paso de buscar y escáner)

## Problema
En la guía, el paso «Consulta las tiendas en el momento» resaltaba el botón del escáner (era el primer botón del formulario) y el paso siguiente volvía a resaltarlo: parecía que «Buscar» y el escáner eran lo mismo.

## Cambios
- `index.html`: el botón «Buscar» tiene `id="buscarbtn"`.
- `app.js`: el paso 3 señala `#buscarbtn` y habla del botón verde «Buscar»; el paso 4 se llama «O escanea el código de barras» y describe el botón con rayas junto al buscador.
- `tests/interfaz.cjs`: comprueba qué botón resalta cada uno de esos pasos.

## Validación
- `node --test tests/canasta.test.cjs`: 46 pasan. `node tests/interfaz.cjs` pasa; capturas de los pasos 3 y 4 en celular revisadas.

# Bitácora anterior (equivalencias por código en Mi lista, «Cancelar» y título discreto)

## Problema
- Al buscar la pasta Colgate 75 ml por código, Superea salía con «Equivalencia verificada», pero al guardarla en una lista su precio no aparecía en el comparativo: la lista solo aceptaba coincidencias por marca, nombre y tamaño, y «Crema Dental … Caja 75ml» no coincide por nombre con «Pasta Dental … 75 ml». Además, al actualizar, la lista consultaba solo por nombre, sin las marcas de código o equivalencia.
- El cuadro «Guardar en una lista» aplicaba cada casilla al instante y no tenía forma de cancelar.
- «En las tiendas ahora !» se veía más grande que «Canasta SV» en el celular.

## Cambios
- `app.js`: el favorito guarda `ean` (el código con que se buscó, o el primero de `b` en el catálogo). Al consultarlo pide primero `?ean=` y luego por nombre. Los resultados `porCodigo`/`porEquivalencia` de ese mismo código cuentan como coincidencia segura (`marcarSeguros`); los de otro código o de una búsqueda por nombre, no.
- Cuadro de listas: las casillas y las listas nuevas quedan pendientes; «Guardar» las aplica y «Cancelar» (o Esc) cierra sin cambios. «Crear y agregar» deja de ser botón principal. La guía de uso termina con «Guardar».
- `index.html`: los títulos de sección (`.subbarra h2`) pasan a 1rem seminegrita y el «!» a un círculo fino de 24 px (44 px de área táctil en celular).
- Guía de diseño, README y AGENTS actualizados.
- Los favoritos ya guardados sin código no cambian: hay que quitarlos y volver a guardarlos desde la búsqueda por código, o esperar a que el catálogo incluya la equivalencia.

## Validación
- `node --test tests/canasta.test.cjs`: 46 pasan (nuevas: equivalencia por código llena Superea y se conserva al actualizar; por nombre no se une; «Cancelar» no guarda nada).
- `node tests/interfaz.cjs` en Chromium (escritorio y móvil) pasa con «Guardar».

# Bitácora anterior (aportes: descartar comparaciones)

## Problema
En el aporte #31 se borraron de la issue las tablas de las comparaciones 4, 5, 6 y 8 para descartarlas, pero la automatización leía solo el bloque JSON y aplicó las 10. Entraron a la base: Salsa Jalisco 148 ml unida con Salsa China McCormick (Superea), Pan Bimbo 560 g con Pan de caja Bimbo 580 g (Selectos), muslo de pollo Indio y bistec Angelina.

## Cambios
- `scraper/equivalencias.json`: se quitaron esos 4 grupos (13 → 9), identificados por tienda e ID; aún no habían llegado al catálogo publicado.
- `scraper/aplicar-aporte.mjs`: aplica solo las comparaciones cuya sección «### Comparación N» sigue en la issue (N = posición en el JSON). Issues antiguas sin secciones: todo. Escribe un resumen (aplicadas, omitidas, ya existentes) que `aplicar-aporte.yml` publica como comentario (aparte del cierre, para que salga aunque la issue ya se haya cerrado a mano).
- `worker/worker.js` (versión `2026-10-24-b`): el texto de cada aporte explica cómo descartar una comparación.
- README y AGENTS actualizados.

## Validación
- El script nuevo con el texto real de la issue #31 sobre la base anterior: aplica 1, 2, 3, 7, 9 y 10, omite 4, 5, 6 y 8, y deja exactamente la base corregida.
- Pruebas nuevas (comparación borrada, issue antigua, todas borradas, texto del Worker): 44 aprobadas; `node tests/interfaz.cjs` aprobado.

# Bitácora — 24 de octubre de 2026 (equivalencias aprobadas unidas al código de barras)

## Evaluación
- Una equivalencia aprobada solo se aplicaba si el producto de Selectos estaba en las ~871 que descarga el catálogo (46 términos y 4 categorías). De las 3 aprobadas, solo «Leche en Polvo Australian 350 g» quedó unida (con su código 07402000016495); el néctar Del Monte y la salsa Jalisco no estaban en el catálogo y se perdían.
- Al escanear, el Worker buscaba en Selectos solo por nombre: no usaba las equivalencias aprobadas.

## Cambios
- `scraper/tiendas.mjs`: `paginasSelectos()` agrega la búsqueda de cada producto de Selectos de una equivalencia aprobada (con su palabra clave guardada o su nombre; siempre en superselectos.com) y `terminosSuperea()` el nombre de cada producto de Superea. Con las 3 actuales: 53 páginas de Selectos en lugar de 50.
- `worker/worker.js` (versión `2026-10-24-a`): con `?ean=`, si el producto encontrado por código pertenece a una equivalencia aprobada, busca en cada otra tienda el producto confirmado y devuelve solo ese, con `porEquivalencia`. Las equivalencias se leen de GitHub (raw) y se guardan 10 minutos; si fallan, se sigue sin ellas. Las tiendas que no quedan cubiertas se buscan por nombre como antes.
- `app.js`: esos resultados se muestran después del mismo código, con «Equivalencia verificada».

## Validación
- 42 pruebas aprobadas (nuevas: páginas de Selectos por equivalencia; Worker trae solo el producto confirmado de Selectos; etiqueta y orden en la página). `node tests/interfaz.cjs` aprobado.

## Límites
- La descarga real de Selectos no se probó desde este entorno (sin red a las tiendas): se verá en la próxima ejecución de «Actualizar precios».
- Si el producto confirmado ya no aparece en la búsqueda de la tienda (agotado o retirado), esa tienda se busca por nombre.

# Bitácora — 23 de octubre de 2026 (resultados de las tiendas sin texto de más)

## Cambios
- «En las tiendas ahora»: el detalle de la búsqueda («Código …», resultados por tienda, hora, «Se ocultaron N… · Mostrar todos» y el aviso de verificar la presentación) pasa a un panel que se abre con el botón «!» junto al título. A la vista quedan los productos con sus precios por supermercado.
- Solo se muestran fuera del panel los mensajes que piden hacer algo (`#estvb`, con `aria-live`): «Buscando…», un error («Puedes reintentar»), sin resultados o código no encontrado.
- Si ya se buscó en las tiendas y el catálogo no tiene resultados, la sección del catálogo se oculta (sin «No hay resultados en el catálogo guardado…»).

## Validación
- 39 pruebas aprobadas; `node tests/interfaz.cjs` aprobado con comprobaciones nuevas (panel cerrado al buscar un código, sin mensajes ni catálogo vacío a la vista, «!» abre y cierra el detalle, botón de 44 px). Capturas revisadas a 390 px.

# Bitácora — 23 de octubre de 2026 (códigos de barras)

## Evaluación
- El emparejador ya usaba los códigos (2,164 grupos unidos por código), pero `data/productos.json` no los guardaba y el Worker no los devolvía.
- Publican código: Walmart y Despensa de Don Juan en el catálogo (todos sus productos) y Maxi Despensa en vivo (VTEX). Super Selectos, Superea y PriceSmart no.

## Cambios
- `scraper/emparejar.mjs`: cada producto guarda en `b` sus códigos válidos (14 cifras). Probado sin red sobre una copia de `data/catalogo/`: 2,782 de 5,312 productos con código, mismos grupos, +62 KB. `data/productos.json` no se sube: lo regenera el workflow en su próxima ejecución; mientras tanto la búsqueda por código usa el Worker.
- `worker/worker.js` (versión `2026-10-23-a`): `?ean=` valida el código, busca con `fq=alternateIds_Ean` en Walmart, Despensa de Don Juan y Maxi (con 13 cifras si llega un UPC de 12), marca esos resultados con `porCodigo` y, con el nombre encontrado, consulta las tiendas que no lo tenían. Las tiendas VTEX devuelven `ean` también en la búsqueda normal.
- `comparador.js`: `gtin`, la misma regla del emparejador.
- `app.js` e `index.html`: botón de código de barras junto al buscador y cuadro «Escanear código de barras» con la cámara (`BarcodeDetector`, sin librerías; formatos EAN-13, EAN-8 y UPC-A); sin lector o sin permiso, se explica y se escribe el código. Escribir un código válido en el buscador también funciona: el catálogo muestra el producto con ese código y «Buscar» consulta las tiendas por código. Los resultados con el mismo código van primero con su etiqueta; los equivalentes por marca, nombre y tamaño llevan la suya; lo demás queda en «Mostrar todos».
- Guía de uso: paso «Escanea un código de barras».

## Validación
- 39 pruebas aprobadas (nuevas: `gtin`; Worker por código con segunda búsqueda por nombre y error 400; catálogo y búsqueda por código en la página). `node tests/interfaz.cjs` aprobado: código escrito a mano (inválido y válido) y lectura con cámara simulada que apaga la cámara al leer.

## Límites
- No se pudo probar con el Worker real ni con una cámara real desde este entorno. `fq=alternateIds_Ean` es el filtro documentado de la búsqueda VTEX.
- iPhone: Safari no trae `BarcodeDetector`; queda escribir el código.

# Bitácora — 23 de octubre de 2026 (menú «⋯» en Mi lista y filtros en una fila)

## Cambios
- Mi lista: una sola barra «[lista] · Actualizar precios · ⋯». El menú «⋯» agrupa «Nueva lista · Renombrar lista», «Descargar PDF · Descargar Excel» (solo con productos) y «Vaciar lista · Eliminar lista» (rojas, al final). Se cierra al elegir, con Esc, Tab o tocando fuera; flechas, Inicio y Fin. Los `id` de los botones no cambian.
- El mensaje de la lista se acorta a «N producto(s) en «lista».» (más «No respondieron: …» si aplica).
- Buscar: los filtros del catálogo van en `.filtros`, que no se parte; en celular la casilla dice «2+ tiendas» y el orden puede encogerse. En un teléfono de 360 px (el del reporte) caben en una fila.
- Guía de uso: «Elige la lista y actualiza» y «Más opciones en ⋯» (abre el menú para mostrarlo). Un toque dentro de la guía no cierra el menú.

## Validación
- 36 pruebas aprobadas; `node tests/interfaz.cjs` aprobado con comprobaciones nuevas: orden de las opciones del menú, teclado, Esc y toque fuera, menú dentro de la pantalla con opciones de 44 px, barra en una fila y filtros en una fila a 360 px. Capturas revisadas en escritorio, 390 px y 360 px.

# Bitácora — 23 de octubre de 2026 (fechas de los precios después de «Actualizar precios»)

## Evaluación
- Reporte: después de «Actualizar precios» y recargar, el Excel seguía mostrando el mismo rango en «Precio consultado».
- Una tienda solo cambia de precio y fecha si la consulta devuelve el mismo producto; si no lo encuentra o no responde, conserva el precio anterior (p. ej. el del catálogo, 22/10). El rango «más viejo a más nuevo» no decía qué tienda tenía la fecha vieja.
- `coincideCon` reconocía el producto guardado solo por referencia o enlace; un precio tomado del catálogo no tiene referencia, así que si la tienda cambiaba el enlace no se actualizaba aunque tuviera el mismo ID.
- Las fechas de las consultas se guardan en UTC y se mostraban así: después de las 6 p. m. en El Salvador aparecía el día siguiente.
- No se pudo consultar el Worker real desde este entorno (el proxy bloquea el dominio): no se confirmó qué tiendas quedan sin reconfirmar en la lista del usuario.

## Cambios
- `app.js`: `coincideCon` también reconoce el producto por el ID de la tienda.
- `comparador.js`: `dia(f)` da el día en la hora del dispositivo; lo usan `hoy`, `fecha`, la actualización diaria y las descargas.
- `exportar.js`: la columna pasa a «Fecha del precio»: la fecha más reciente y, aparte, las tiendas con un precio de un día anterior («2026-10-23 · Superea: 2026-10-22»).

## Validación
- 36 pruebas aprobadas (nuevas: producto reconocido por ID con otro enlace; fechas en hora de El Salvador; columna de fechas del Excel). `node tests/interfaz.cjs` aprobado.

# Bitácora — 23 de octubre de 2026 (página principal con menos texto)

## Cambios
- Buscar: debajo del buscador solo «Catálogo actualizado al 22 de octubre.» (`fechaLarga`); la explicación del botón queda en la guía de uso. Si el catálogo no carga: «No se pudo cargar el catálogo.».
- Se quitan las sugerencias «Prueba: …» y la tarjeta de la lista activa (`#inicio`, `#ilista`, `.sug`).
- Filtros del catálogo y de los resultados de las tiendas compactos: casilla «2 o más tiendas» y orden como etiquetas redondas de ancho automático; en celular van en una fila bajo el título. Opciones: «Mayor diferencia», «Precio por unidad», «Nombre (A-Z)».

## Validación
- 34 pruebas aprobadas; `node tests/interfaz.cjs` aprobado con comprobaciones nuevas (sin sugerencias ni tarjeta, texto exacto de la fecha, filtros en una fila en 390 px). Capturas revisadas en escritorio y celular.

# Bitácora — 23 de octubre de 2026 (guía de uso)

## Cambios
- `index.html`: botón «Cómo funciona» arriba a la derecha (en celular «Guía», 44 px) y `dialog#guia`: fondo opaco (`--velo`, 60 %) con un hueco que resalta el elemento del paso y una ventanita con flecha que lo señala; sin elemento visible va al centro. Respeta «reducir movimiento».
- `app.js`: 14 pasos (`GUIA`): bienvenida → buscador (escribe una búsqueda de ejemplo del catálogo) → «Buscar en las tiendas» → resultados → ☆ → cuadro de listas (lo abre) → crear lista (escribe «Compras del mes» sin crearla) → «Listo» → pestaña Mi lista → administrar listas → actualizar y descargar → cantidades y precios por tienda → comparación de la compra → botón de la guía. «Anterior», «Siguiente», «Salir de la guía» y Esc. Con la lista vacía, los pasos de Mi lista explican qué se verá.
- La guía no cambia nada guardado: no marca casillas ni crea listas; al salir restaura búsqueda, pestaña y desplazamiento.

## Validación
- `tests/interfaz.cjs`: recorre los 14 pasos (resaltado alrededor del elemento, ventanita dentro de la pantalla, búsqueda de ejemplo, cuadro de listas abierto) y comprueba que las listas guardadas no cambian y que todo se restaura; Esc sale. Recorrido revisado en capturas a 1280 px y en Pixel 7 (con y sin productos). 34 pruebas aprobadas.

# Bitácora — 23 de octubre de 2026 (agregar de nuevo un producto quitado)

## Evaluación
- Caso reportado en Android: «Pan Bimbo Para Sandwich - 560 g» no se agregaba a la lista después de haberlo quitado; se guardó al cuarto intento.
- Agregar → quitar → agregar funciona al primer intento en Chromium con emulación de Pixel 7 y toques, desde el catálogo y desde «Buscar en las tiendas», también quitándolo mientras se consulta.
- Causa reproducida: `favoritoItem`/`favoritoVivo` reconocían un producto por la URL de cualquier tienda del favorito, también la elegida a mano con «Cambiar producto» (`cambio`). Si en «Pan Blanco Bimbo mediano 450 g» se había elegido en Despensa el pan de sándwich, la ☆ del pan de sándwich salía marcada y la casilla «Mi lista» también; al tocarla se **quitaba el pan mediano**, y había que volver a tocar para agregar el de sándwich. Desde que «Cambiar producto» ofrece productos del catálogo esto pasa más.
- Mismo origen, otro efecto: `mezclarCatalogo` enlazaba el favorito con la ficha del producto elegido y, con un catálogo nuevo, le pasaba sus precios a las demás tiendas (el pan mediano tomaba en Walmart el precio del de sándwich).
- Además, la espera de `pintarFav` con un selector de «Cambiar producto» con foco podía detener la lista si el foco quedaba en una pestaña oculta (Safari).

## Cambios
- `app.js`: una tienda con `cambio` no identifica al favorito (☆, cuadro de listas) ni lo enlaza con otra ficha del catálogo; el catálogo solo actualiza su propio precio.
- `app.js`: la espera de `pintarFav` solo aplica a consultas en segundo plano (`pintarFav(true)`) con el selector visible; agregar, quitar, vaciar o cambiar siempre redibujan.

## Validación
- 34 pruebas aprobadas (nueva: elección a mano no marca la ☆ ni borra el otro producto, y el catálogo no le pasa precios); la de «Cambiar producto» cubre selector con foco en pestaña oculta y quitar/agregar con el selector en uso. Reproducción en Pixel 7 emulado antes y después. `node tests/interfaz.cjs` aprobado.

# Bitácora — 22 de octubre de 2026 («Cambiar producto» sin opciones y se cerraba)

## Evaluación
- Reproducido en Chromium (celular y escritorio): al abrir «Cambiar producto» mientras corría la actualización automática de Mi lista, cada respuesta redibujaba la lista y cerraba el selector.
- Las opciones solo salían de la última consulta de la sesión (`candidatos`, en memoria): tras recargar no quedaba ninguna, y la consulta se detenía en la primera búsqueda con coincidencias, así que traía pocas. El catálogo no se ofrecía.
- En celular el selector medía como máximo 230 px y cortaba el texto.

## Cambios
- `app.js`: las opciones se guardan con el favorito (`opc`, hasta 8 por tienda, solo las parecidas por equivalencia o por `coincideBusqueda`); `opcionesDe` suma las del catálogo y pone las equivalentes primero; el valor de cada opción es su identificador (no la posición). Botón «Buscar más opciones» (`completarFavorito(f, true)` hace todas las búsquedas). Sin opciones se explica y se ofrece «No está en esta tienda».
- `pintarFav` mantiene abiertos los «Cambiar producto» y no redibuja mientras un selector tiene el foco (repinta al soltarlo).
- `index.html`: en celular el selector va en `.msel`, a todo el renglón de la tienda.

## Validación
- 33 pruebas aprobadas (2 nuevas: opciones guardadas y del catálogo, búsqueda completa; no redibujar con el selector en uso). `node tests/interfaz.cjs` aprobado con comprobación nueva del selector en celular.

# Bitácora — 22 de octubre de 2026 (producto abierto en Mi lista)

## Cambios
- `index.html`: en celular, el producto abierto de Mi lista (`.mitem.abierto`) lleva franja verde a la izquierda, más sombra y más espacio, para distinguir dónde terminan sus tiendas y empieza el siguiente producto. Se eligió entre cuatro opciones (franja y sombra, pie «Cerrar detalle», tiendas en un recuadro, fondo gris).

## Validación
- 31 pruebas aprobadas; `node tests/interfaz.cjs` aprobado con una comprobación nueva (franja verde del producto abierto).

# Bitácora — 22 de octubre de 2026 (página «Buscar» y barra inferior)

## Cambios
- Fase 3: Catálogo y En vivo se unen en la pestaña **Buscar** (página principal). Un solo buscador `#q`: al escribir filtra el catálogo; Enter o «Buscar en las tiendas» consulta las tiendas (`#secvivo` aparece arriba del catálogo). Con la búsqueda vacía se ven la tarjeta de la lista activa (`#ilista`, con la tienda más barata y «Ver mi lista»), sugerencias (`.sug`) y «Mayores diferencias entre tiendas». La fecha del catálogo pasa junto al buscador (`#fecha`). Se quita el botón «Buscar … en vivo» del catálogo vacío: el botón principal ya está arriba.
- Fase 4: pestañas con íconos SVG en lugar de emojis; «Favoritos» pasa a **Mi lista** con contador `.badge`. En celular las pestañas van en una barra fija abajo y el nombre del sitio vuelve a verse arriba.
- Paneles: `#p1` Buscar y `#p2` Mi lista (antes `#p3`); `#qv` y `#fvivo` se reemplazan por `#q` y `#fbuscar`.
- Guía `interfaz-canasta` actualizada (estructura, pestañas, celular).

## Validación
- 31 pruebas aprobadas; `node --check` de los tres archivos; `node tests/interfaz.cjs` aprobado con comprobaciones nuevas (dos pestañas, sugerencias, tarjeta de la lista, fecha del catálogo, barra inferior en celular). Capturas revisadas a 1440, 1000 y 390 px.

# Bitácora — 22 de octubre de 2026 (paleta propia y botón principal)

## Cambios
- `index.html`: paleta propia en lugar de la de Facebook. Verde de marca `--marca` `#0a6e37` (reemplaza `--blue`) y grises con un toque verde (`--bg` `#f4f6f5`, `--ink` `#1a1f1c`, `--mute` `#5c6660`, `--borde` `#7c8480`). Contrastes: marca 5.05:1 sobre `--btn`, 5.87:1 sobre `--bg`; blanco sobre marca 6.37:1; `--mute` 4.73:1 sobre `--btn`; borde de campos 3.54:1.
- Botón principal `.pri` relleno de verde, uno por barra: «Buscar en las tiendas», «Actualizar precios», «Crear y agregar», «Enviar al proyecto», «Sí» y «Buscar … en vivo» del catálogo vacío.
- Logo: canasta en SVG en lugar de la «C»; nombre en negrita.
- Celular: campos y selectores a 16 px (Safari del iPhone ya no hace zoom al tocarlos).
- Guía `interfaz-canasta` actualizada (tokens, `.pri`, regla de paleta).

## Validación
- 31 pruebas aprobadas; `node --check` de los tres archivos; `node tests/interfaz.cjs` aprobado con comprobaciones nuevas (color de marca, botón principal y campos de 16 px en celular). Capturas revisadas en escritorio y móvil.

# Bitácora — 22 de octubre de 2026 (publicación automática del Worker)

## Cambios
- `.github/workflows/publicar-worker.yml`: al unir a `main` un cambio en `worker/worker.js` o `worker/wrangler.toml` (o con «Run workflow»), corre `node --check` y las pruebas; si pasan, publica con `cloudflare/wrangler-action@v3` (wrangler 4.152.0) y comprueba que el Worker responda con la `VERSION` del archivo.
- `worker/wrangler.toml`: Worker `canasta-busqueda`, `workers_dev = true`, `compatibility_date = 2026-10-17` (creación del Worker) y `keep_vars = true` para conservar `ORIGEN_PERMITIDO`; los secretos no se tocan.
- Secretos del repositorio: `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit + Account Settings Read) y `CLOUDFLARE_ACCOUNT_ID`.
- README y AGENTS: el Worker ya no se pega a mano.

## Validación
- `wrangler deploy --dry-run` con wrangler 3 y 4.152.0: empaqueta 16.5 KB, sin bindings.
- YAML y TOML validados. Antes de esta entrega el Worker publicado era `2026-10-21-c`; la primera ejecución debe publicar `2026-10-22-a` (onzas).

# Bitácora — 22 de octubre de 2026 (onzas y mililitros)

## Evaluación
- Toda «oz» se convertía a 28.35 g (onza de peso). No existía la onza líquida ni la palabra «onzas»: «12 fl oz», «16 onzas líquidas», «13.5 fl. oz», «12 Onzas» y «10onzas» quedaban sin tamaño (sin precio por unidad ni equivalencias).
- «Activee 3.38 Fl oz 100 ml» y «Activee 100 ml» no se reconocían como el mismo producto: «fl oz» quedaba en el nombre.
- En el catálogo (26 productos con onzas) casi todas son de peso (snacks, salsas, embutidos) y estaban bien. En las tiendas en vivo aparecen «Fl oz» (cuidado personal) y «Onzas» (vasos, hongos, limpiadores).

## Cambios
- `scraper/normalizar.mjs` y `worker/worker.js` (versión `2026-10-22-a`): «fl oz», «fl. oz», «onzas líquidas» y «oz líq» → ml (× 29.5735); «onza(s)», también pegada al número, → g (× 28.3495). «oz» sola sigue siendo peso.
- `comparador.js`: «3.38 fl oz» se quita del nombre al comparar, como «100 ml»; «fl», «floz» y «líquidas» no cuentan como palabras de búsqueda.

## Validación
- Prueba nueva con nombres reales: tamaños en scraper y Worker idénticos; lata «12 fl oz» = «355 ml» (dentro de 0.5 %) y ≠ «350 ml»; Activee con y sin «fl oz» equivalentes. 31 pruebas aprobadas; `node tests/interfaz.cjs` aprobado.
- Catálogo actual reprocesado sin red: 0 diferencias de tamaño frente al código anterior (los casos nuevos aparecen en la búsqueda en vivo).

## Límite
- Una «oz» sin «fl» en un líquido (p. ej. «Shampoo 13.5 oz») se toma como peso; no se une sola con un tamaño en ml y se elige a mano.

# Bitácora — 21 de octubre de 2026 (revisión de diseño: prioridades 3 a 5)

## Cambios
- **Accesibilidad:** zonas táctiles de 44 px en celular (botones, campos, selectores, «Cambiar producto», ☆) y ≥ 24 px en computadora; `aria-live="polite"` en `#count`, `#estv`, `#favest` y el resumen; pestañas con `aria-controls`, paneles `role="tabpanel"` y solo la pestaña activa en el orden de Tab; «Canasta SV» es el `h1` (en celular el texto queda para lectores de pantalla).
- **Catálogo:** `scraper/emparejar.mjs` guarda el precio por unidad con 4 decimales (la sal de 500 sobres pasa de $0.00 a $0.0023); la página muestra 4 decimales bajo un centavo y «—» si un catálogo anterior lo dejó en cero, y ordena esos al final. El catálogo abre ordenado por «Mayor diferencia entre tiendas».
- **Favoritos:** resumen arriba de la tabla («Compra completa más barata: Tienda $X · Combinando tiendas: $Y · Ver detalle»); «No respondieron: …» aparece una vez en el mensaje de la lista y no en cada producto.
- Skill `interfaz-canasta` actualizado.

## Validación
- `node --test tests/canasta.test.cjs`: 30 pruebas (nuevas: resumen y aviso único; precio por unidad con 4 decimales y «—»).
- `node tests/interfaz.cjs`: `h1`, pestañas y paneles, orden inicial, `aria-live`, resumen, `summary` ≥ 24 px en computadora y ningún control de Favoritos por debajo de 44 px en celular. Capturas revisadas.
- `scraper/emparejar.mjs` en una copia: 0 productos con precio por unidad en cero (antes 1).

## Límite
- El catálogo publicado mostrará los 4 decimales tras la próxima actualización programada (lunes o jueves) o al correr «Actualizar precios» en Actions.

# Bitácora — 21 de octubre de 2026 (revisión de diseño: prioridades 1 y 2)

## Origen
Revisiones `design:design-critique` y `design:accessibility-review` (WCAG 2.1 AA) sobre capturas reales a 1440 y 390 px.

## Cambios
- **Celular, Catálogo y En vivo:** ya no muestran tablas con los precios cortados a la derecha. Lista compacta (`#mcat`, `#mvivo`) con nombre, marca y tamaño, ☆, etiquetas «Tienda $precio» (el más barato primero, en verde y con ✓; enlace a la tienda), precio por unidad y oferta. La ☆ y «Buscar en vivo» usan los mismos eventos de las tablas.
- **«Más barato» sin depender del color (WCAG 1.4.1):** ✓ visible y «(más barato)» para lectores de pantalla en las tablas de Catálogo, En vivo y Favoritos y en las etiquetas del celular.
- **Contraste (1.4.3 y 1.4.11):** azul `#1877f2` → `#1460cc` (4.23 → 5.2–5.9:1); rojo de acciones que borran y avisos `#e02849` → `#b01433` (3.68 → 5.0–7.0:1); «oferta» `#9a6a00` → `#7a5400` (4.22 → 6:1); nuevo `--borde` `#84878c` en búsqueda, selectores, cantidad y nombre de lista (1.12 → 3.2–3.6:1). El semáforo conserva su rojo: es decorativo y va con texto.
- Skill `interfaz-canasta` actualizado (colores, `--borde`, `barato()`, `chip()`, listas compactas en las tres pestañas).

## Validación
- `node --test tests/canasta.test.cjs`: 28 pruebas (nueva: marca de más barato en tabla y etiquetas, listas compactas de Catálogo y En vivo, ☆ desde la lista).
- `node tests/interfaz.cjs`: «✓ … (más barato)» en la tabla; a 390 px Catálogo y En vivo sin tabla, con tienda y precio y sin desplazamiento horizontal; colores calculados del azul, rojo y borde. Capturas revisadas.

## Pendiente de la revisión (prioridades 3 a 5)
Botones táctiles de 44 px, `aria-live` en mensajes de estado, precio por unidad «$0.000» (redondeo a 2 decimales en `emparejar.mjs`), orden inicial del catálogo, resumen de la compra arriba, `role="tabpanel"`/`h1` y mensaje de «no respondieron» repetido.

# Bitácora — 21 de octubre de 2026 (búsqueda en vivo más estricta)

## Solicitud
Que la búsqueda en vivo muestre solo resultados que cumplan al menos dos palabras: «Gaseosa Cocacola» traía embutidos, papel, etc.

## Cambios
- `comparador.js`: `palabrasBusqueda` y `coincideBusqueda`. Un resultado debe contener al menos 2 palabras de la búsqueda en su nombre o marca (o la única si solo hay una). No cuentan artículos, números ni medidas; singular/plural iguales; sin acentos; «cocacola» encuentra «Coca-Cola» (comparación sin espacios para palabras de 4 letras o más).
- `app.js`: la tabla de En vivo y el conteo por tienda usan solo los resultados que coinciden; un aviso dice cuántos se ocultaron y «Mostrar todos» / «Ocultar los que no coinciden» alterna. Cada búsqueda nueva vuelve a filtrar. La consulta de favoritos no cambia (ya exige equivalencia de marca, variante y tamaño).
- Se corrigió el doble punto después de la hora («12:00 p. m..»).
- No requiere actualizar el Worker.

## Validación
- Pruebas nuevas: el ejemplo «Gaseosa Cocacola» (muestra Coca Cola; oculta chorizo, papel, Pepsi, chocolate), plural/singular, palabras que no cuentan, y el flujo con «Mostrar todos». 27 pruebas aprobadas; `node tests/interfaz.cjs` aprobado; captura de celular revisada.

## Límites
- Un producto escrito de forma muy distinta (p. ej. «Coca Cola Zero Lata» al buscar «gaseosa coca cola», sin la palabra «gaseosa») queda oculto; se ve con «Mostrar todos».

# Bitácora — 21 de octubre de 2026 (celular compacto)

## Solicitud
En celular: tabla de favoritos más compacta (nombre y precios, sin perder de qué supermercado es cada precio), detalle al tocar un producto y solo uno abierto a la vez; barras de listas y de acciones en una sola fila.

## Cambios
- `#mfav`: lista compacta solo en celular (≤ 700 px). Cada producto muestra nombre, cantidad y precios como etiquetas con la tienda, del más barato al más caro (el más barato en verde, «oferta» si tiene una); las tiendas sin precio se resumen. Al tocarlo se abre el detalle con marca, cantidad, Quitar, Consultar tiendas y una fila por tienda (producto, fecha, oferta, Cambiar producto). Solo uno abierto; tocarlo de nuevo lo cierra.
- `pintarFav` arma cada celda una vez y la usan la tabla y la lista compacta.
- Barras en una sola fila en celular: «Lista · Nueva · Renombrar · Eliminar» y «Actualizar · PDF · Excel · Vaciar», con textos cortos y `aria-label` completos. «Vaciar lista» pasa a rojo como las demás acciones que borran.
- Celular más compacto: sin frase de introducción, menos relleno y totales en 2 columnas. En computadora no cambia nada más.
- Skill `interfaz-canasta` actualizado con estas reglas.

## Validación
- `node tests/interfaz.cjs` a 390 px: barras en una fila, tabla oculta, renglón con «Super Selectos $1.75 … Walmart $2.00 … 4 sin precio», detalle al tocar con la oferta y Cambiar producto; recarga, Quitar y cambio de lista desde el detalle. Capturas de celular y escritorio revisadas.
- Prueba nueva: con dos productos, abrir uno cierra el otro y la cantidad se cambia desde el detalle. 25 pruebas aprobadas.

# Bitácora — 21 de octubre de 2026 (solo modo claro)

## Cambio
- El sitio se ve siempre en modo claro, aunque el dispositivo use modo oscuro: se quitó el bloque `@media (prefers-color-scheme:dark)` y `:root` y `<meta name="color-scheme">` declaran `light` (también para selectores, casillas y barras de desplazamiento).
- Skill `interfaz-canasta`: la regla de solo modo claro queda escrita. Se corrigieron textos con el signo de dólar seguido de un número, que el comando `/interfaz-canasta` reemplazaba por el pedido escrito.

## Validación
- `node tests/interfaz.cjs` simula un dispositivo en modo oscuro y comprueba fondo `#f0f2f5` y tarjetas blancas; capturas revisadas.
- `node --test tests/canasta.test.cjs` (24) y `node --check` aprobados.

# Bitácora — 21 de octubre de 2026 (ofertas de Súper Selectos)

## Problema
Las ofertas de Walmart y las despensas ya aparecían, pero las de Súper Selectos marcadas con imagen («2X1», «Segundo al 50%»…) no.

## Diagnóstico
- `robots.txt` de Selectos permite las páginas públicas para `*` y bloquea bots de IA de entrenamiento y extracción masiva; solo se consultaron las páginas necesarias para entender los códigos.
- Cada oferta en imagen es `tipoPromoMM/<código>.png` dentro del producto, también en la búsqueda normal (`/products?keyword=`).
- Los filtros oficiales de `/special-deals` dan el significado: `2-1` 2x1; `2-3` paga 2 lleva 3; `3-4`, `4-5`, `4-6`, `5-6`, `6-7`, `8-12` paga/lleva; `2-40`, `2-50`, `2-75` segundo al 40/50/75 %; `COMBO`. El orden de los números no es constante (2-1 frente a 2-3), por eso no se adivinó. El `2-50` del atún observado por el otro proyecto es «Segundo al 50%», no «2 x $2.50».

## Cambios
- `worker/worker.js` (versión `2026-10-21-c`): lee el código de imagen de cada producto y lo traduce («2x1», «3x2», «Segundo al 50%»…); el texto «Seleccione NX$T» tiene prioridad. COMBO y otras no se interpretan.
- `comparador.js`: nuevo tipo «Segundo al X%» (la segunda unidad con X % de descuento, por pares). `app.js` lo muestra como «2.ª unidad al X% de descuento».

## Validación
- Worker contra Selectos real: Servilletas Scott en rollo $1.25 «2x1» (la de la captura), Papel higiénico húmedo «Seleccione 2X$3.50», galletas Club «Seleccione 2X$2.35».
- Pruebas: extracto real con imagen `2-50` → «Segundo al 50%»; costos de 2x1, 3x2 y segundo al 50 %; pantalla de favoritos con ambas ofertas solo en Selectos. 24 pruebas aprobadas.

# Bitácora — 21 de octubre de 2026 (ofertas de Walmart, Maxi y Despensa)

## Problema
Con el Worker `2026-10-21-a` publicado, las tiendas VTEX devolvían `promo: null`.

## Diagnóstico (con acceso a las tiendas reales)
- Las ofertas sí vienen en el servicio de datos (`commertialOffer.PromotionTeasers` y `Teasers`), pero con nombres internos: `Promo,1.1x2,2026-09-17-2026-12-31-120535-14 TYPE_PROMO_GPP` (precio por unidad × cantidad mínima) y `PromoCombinaEnFijo,0.5x3,2026-10-05-2027-01-05-… TYPE_PROMO_CMF` (precio fijo por grupo, combinable entre productos de la promoción). `Conditions.MinimumQuantity` confirma la cantidad.
- Coincide con lo que el otro proyecto vio en la página de Maxi: Coca Cola 1.25 L «2 x $2.20» (`1.1x2`) y 3 L «2 x $4.20» (`2.1x2`).
- La página de búsqueda de la tienda ya no trae las ofertas en su HTML (las dibuja con JavaScript), así que el servicio de datos es la fuente correcta y la más ligera.

## Cambios
- `worker/worker.js` (versión `2026-10-21-b`): convierte esos nombres a «N x $T», solo si la oferta está vigente según sus fechas (hora de El Salvador) y la cantidad coincide con `MinimumQuantity`. «Combina» se aplica solo al mismo producto (cálculo prudente).

## Validación
- Worker ejecutado contra las tiendas reales: Walmart Oreo 12 Pack «2 x $5.50»; Maxi y Despensa, cappuccino Nescafé «3 x $1.50» y Coca Cola «2 x $2.20» / «2 x $2.26». La búsqueda con acentos («café nescafé») devolvió resultados. Maxi Despensa respondió correctamente.
- Prueba del Worker con los formatos reales: vigente, combinable, vencida, cantidad que no cuadra y nombre desconocido. 23 pruebas aprobadas.

## Límites
- Con 3 unidades y «2 x $2.20» se calcula un grupo en oferta + 1 a precio normal; si la tienda cobrara las 3 a $1.10, el total real sería algo menor (nunca mayor).

# Bitácora — 21 de octubre de 2026 (acentos, códigos de barras y ofertas)

## Solicitud
A partir de la revisión del proyecto comparador-precios-sv: (1) quitar acentos en las búsquedas, (2) validar códigos de barras y (3) aplicar ofertas al aumentar cantidades, solo en la tienda que las tiene activas.

## Cambios
- **Acentos:** el Worker y el scraper envían las búsquedas a Selectos y a las tiendas VTEX sin tildes, conservando la ñ («Atún café» → «Atun cafe»). Ese proyecto comprobó que Selectos devuelve 0 resultados con «atún» y 20 con «atun».
- **Códigos de barras:** `scraper/emparejar.mjs` valida el dígito de control y exige al menos 8 cifras significativas. Con los catálogos actuales el resultado es idéntico (4,993 códigos, ninguno inválido); se descartó unir por códigos internos cortos (frutas, pan a granel) porque pueden coincidir entre empresas.
- **Ofertas:** el Worker devuelve `promo` (texto de la oferta) y `antes` (precio anterior). En Selectos se toma la insignia «Seleccione 2X$0.90» de cada producto; en VTEX, los nombres de `Teasers`, `PromotionTeasers` y `DiscountHighLight`, aceptando solo textos con formato claro. `comparador.js` agrega `leerPromo` y `costo`: la oferta se aplica por grupos completos, solo en su tienda y solo si abarata. Los totales por tienda, la compra combinada, el resaltado de la tienda más barata y las descargas (nueva columna «Ofertas») usan ese costo. Las celdas muestran «Oferta 2 x $2.20 · lleva 2 para aplicarla» o «aplicada: $X por N» y el precio anterior tachado.

## Validación
- `node --test tests/canasta.test.cjs`: 23 pruebas. Nuevas: ofertas por cantidad (solo en su tienda, grupos, sin abaratar de más), flujo de favoritos con oferta, catálogo nuevo sin oferta vieja, y Worker (tildes, ofertas VTEX, página real de Selectos en `tests/datos/selectos-busqueda.html`).
- `node tests/interfaz.cjs`: con «2 x $3.80» en Walmart, al llevar 2 su total baja a $3.80 y Selectos sigue en $3.50. Captura revisada.
- `scraper/emparejar.mjs` ejecutado sin red en una copia: mismos 3,624 productos.

## Límites
- No fue posible consultar desde este entorno las tiendas VTEX (Walmart, Despensa de Don Juan, Maxi Despensa), así que el formato real de sus nombres de promoción no se vio. Si no siguen el formato «N x $T», no se muestra oferta (nunca una equivocada). Verificar con el Worker publicado.
- El catálogo (pestaña Catálogo) todavía no muestra ofertas; los favoritos las toman de la consulta en vivo.

# Bitácora — 20 de octubre de 2026 (ancho completo)

## Cambio
La página tenía un ancho máximo de 1100 px. Ahora el contenido, la pregunta de aportes y el pie usan todo el ancho de la pantalla con 16 px de margen, para que las tablas con muchas tiendas quepan sin desplazarse en pantallas grandes. En pantallas angostas la tabla se sigue desplazando y la primera columna queda fija.

## Validación
- `node tests/interfaz.cjs`: a 1440 px la tabla mide todo el ancho menos los márgenes y muestra las seis tiendas; 1000 px y móvil sin cambios. Captura revisada.
- `node --test tests/canasta.test.cjs` aprobado.

# Bitácora — 20 de octubre de 2026 (cantidad y Quitar ocultos)

## Problema
Con seis tiendas, la tabla de favoritos era más ancha que la pantalla. En computadora (900 px o más) el recuadro usaba `overflow:clip`, que recorta en vez de desplazar: las columnas «Cantidad» y «Quitar» quedaban fuera de la vista.

## Cambios
- Cantidad (− / +) y «Quitar» pasan a la primera columna («Producto y cantidad»), que queda fija al desplazarse; siempre están a la vista sin importar cuántas tiendas haya.
- Las tablas se desplazan a lo ancho también en computadora (antes solo en móvil); el encabezado queda fijo dentro del recuadro.

## Validación
- `node tests/interfaz.cjs`: con seis tiendas en una ventana de 1000 px, «Más» y «Quitar» están en pantalla; la tabla se desplaza hasta PriceSmart y la primera columna sigue visible. Capturas de 1000 px y móvil revisadas.
- `node --test tests/canasta.test.cjs` y `node --check` aprobados.

# Bitácora — 20 de octubre de 2026 (Superea)

## Solicitud
Agregar https://superea.sv/ a la comparación y la búsqueda en vivo.

## Diagnóstico
- Superea es una aplicación Next.js. Su buscador consulta Algolia (aplicación `0L9N281WRT`, índice `prod_SV_articles`) con una clave pública de solo búsqueda incluida en el propio sitio, y filtra por la bodega 1 cuando no hay dirección elegida.
- Campos verificados en la página real de un producto: `final_price` (número), `available_balance` (existencia), `is_always_available` (0/1), `brand_name`, `slug` y `grammage` (tamaño aparte, p. ej. «1 Litro»).
- Las páginas de producto están en `/productos/<slug>`; los enlaces viejos (`/products/…`) ya dan 404.
- No tiene `robots.txt` y en los términos no se encontró una prohibición de consultas automáticas.

## Cambios
- `worker/worker.js`: nueva tienda «Superea» para búsqueda en vivo y favoritos; versión `2026-10-20-b`.
- `scraper/tiendas.mjs`: Superea en el catálogo, una búsqueda por término de `canasta.json` con 1 s de pausa.
- Solo entran productos con precio mayor que cero y con existencia (o siempre disponibles). Si el nombre no trae el tamaño, se le agrega `grammage` para calcular el precio por unidad.

## Validación
- Worker y scraper probados con respuestas simuladas que copian los campos reales: se descartan productos sin existencia o sin precio, el tamaño y el precio por litro salen bien, y el enlace apunta a `/productos/<slug>`.
- `node --test tests/canasta.test.cjs`, `node --check` y `node tests/interfaz.cjs` (ahora con cinco tiendas) aprobados.

## Límites
- Desde este entorno no se pudo llamar a Algolia (la red solo permite `superea.sv`), así que la consulta real se verifica tras publicar el Worker con `?q=leche&tiendas=Superea&fresh=1`.
- Si Superea cambia de buscador o de clave, el Worker la mostrará como «no respondió» sin afectar a las demás tiendas.

# Bitácora — 20 de octubre de 2026 (Maxi Despensa)

## Solicitud
Agregar Maxi Despensa y Despensa Familiar a la comparación y la búsqueda en vivo.

## Cambios
- **Maxi Despensa** se agregó al Worker (búsqueda en vivo y favoritos) y al scraper (catálogo), con la misma consulta VTEX que Walmart y Despensa de Don Juan, sobre `https://www.maxidespensa.com.sv` (tienda en línea de Walmart Centroamérica desde julio de 2024). La versión del Worker pasa a `2026-10-20-a`.
- **Despensa Familiar** no se agregó: no se encontró una tienda en línea en El Salvador (sus compras en línea en Guatemala van por el sitio de Maxi Despensa de ese país). Sin datos propios, aparecería siempre vacía.
- La interfaz no necesitó cambios: toma las tiendas que reporta el Worker y las del catálogo.

## Validación
- Worker probado sin red con una respuesta VTEX simulada: Maxi Despensa aparece en `tiendas` y sus resultados traen tamaño y precio por unidad.
- `node --test tests/canasta.test.cjs`, `node --check` y `node tests/interfaz.cjs` (ahora con una cuarta tienda) aprobados.

## Límites
- Desde este entorno no fue posible abrir `maxidespensa.com.sv` (la red bloquea sitios externos), así que no se confirmó que use VTEX. Si no lo usa, el Worker la mostrará como «no respondió» sin afectar a las demás tiendas, y el workflow de catálogo registrará el fallo y seguirá con las otras.
- Para que aparezca en la búsqueda en vivo hay que pegar el nuevo `worker/worker.js` en Cloudflare.

# Bitácora — 20 de octubre de 2026 (segunda entrega)

## Solicitud
Quitar «Entrenar la comparación», dejar solo el envío de comparaciones cuando hay cambios manuales en la tabla de precios, descargar la lista en PDF o Excel y manejar varias listas de favoritos.

## Cambios
- Se quitó «Entrenar la comparación»: tabla ✓ / ✗, registro de decisiones y opciones de administrador. Para descartar un producto equivocado, el selector de cada celda ofrece «No está en esta tienda».
- La pregunta al pie aparece solo cuando la persona elige o cambia un producto en la tabla de precios (marca `cambio`), y solo ofrece «Enviar al proyecto». Se quitaron «Descargar archivo» y «Preparar correo».
- Varias listas: la ☆ abre el cuadro «Guardar en una lista» para marcar listas existentes o crear una nueva. En Favoritos se elige, crea, renombra o elimina la lista. Cada lista guarda su copia del producto; quitarlo de una no lo quita de otra. Las consultas pendientes se cancelan al quitar el producto, vaciar o eliminar la lista. Los datos pasan a `canasta-sv-listas-v1`; la lista anterior se migra a «Mi lista» sin borrar la clave vieja.
- Descargas: **Excel** genera un `.xlsx` real en el navegador (`exportar.js`, sin librerías) con cantidades, precio por tienda, dónde conviene comprar, fecha del precio y totales (parciales marcados). **PDF** usa la impresión del navegador con una hoja limpia en horizontal; se elige «Guardar como PDF».

## Validación
- `node --test tests/canasta.test.cjs`: 19 pruebas aprobadas. Nuevas o actualizadas: listas (dos listas con cantidades propias, quitar de una sola, eliminar lista cancela consultas), envío solo tras cambios en la tabla, exportación (centavos, parciales, archivo ZIP válido) y descartar tienda.
- `node tests/interfaz.cjs` en Chromium: guardar en dos listas desde el cuadro, cantidades, descarga de Excel, vista de impresión, móvil sin desbordamiento, recarga, quitar y cambiar de lista. Capturas revisadas. Precios simulados.
- El `.xlsx` generado se abrió con `openpyxl`: valores, formato de moneda y negritas correctos.

## Límites
- El PDF depende de la impresión del navegador: en el celular, la opción se llama «Guardar como PDF» o «Imprimir → PDF» según el navegador.
- Las listas viven en el navegador de cada persona; no se sincronizan entre dispositivos.

# Bitácora — 20 de octubre de 2026

## Diagnóstico
- El `index.html` publicado tenía su propio JavaScript incrustado y no cargaba `app.js` ni `comparador.js`: los cambios del 17 de octubre nunca llegaron al sitio. A su vez, ese `index.html` (18 de octubre) traía funciones que `app.js` no tenía: aportes, registro de decisiones, entrenar la comparación y búsqueda con varias consultas.
- `scraper/emparejar.mjs` comparaba la URL completa; Super Selectos cambia el `?keyword=` según la búsqueda, por eso casi ninguna equivalencia manual se aplicaba. La corrección estaba en un `emparejar.mjs` de la raíz que ningún workflow usa.
- Había nueve copias sueltas en la raíz (scraper, Worker, workflow y datos), unas más nuevas y otras más viejas que las que sí se usan.

## Cambios
- `index.html` ya no tiene script incrustado: carga `config.js`, `comparador.js` y `app.js`. Se conserva su diseño, con el botón **Actualizar precios** y estilos para las celdas de elección. Las tablas anchas ya no ensanchan la página en móvil.
- `app.js` incorpora del `index.html` anterior: aportes por el Worker, descarga y correo; registro de decisiones; tabla «Entrenar la comparación» (✓ / ✗); semáforo de totales; precio unitario con 3 decimales cuando es menor de $0.10; actualización automática al abrir Favoritos si no se consultó hoy; y consultas de respaldo (marca + palabras clave) cuando la primera búsqueda no encuentra el producto.
- Se mantienen las reglas de `app.js`: totales en centavos, totales parciales que no ganan, varias coincidencias exigen elección manual, cancelación al quitar, IDs por tienda y precios recientes no reemplazados por un catálogo antiguo.
- Nuevo: una tienda descartada con ✗ no se vuelve a llenar sola. Cada precio guarda el ID del producto en su tienda y su origen (`cat` / `auto` / manual). Solo se exportan equivalencias confirmadas, nunca enlaces de búsqueda. Los favoritos guardados con la versión anterior (`src: "man"`) conservan su elección manual.
- `scraper/emparejar.mjs` compara Super Selectos por `productId` y las demás por enlace sin parámetros. Probado sin red sobre los catálogos actuales: el grupo de leche Australian ahora une las tres tiendas. Los grupos de néctar Del Monte y salsa Jalisco siguen sin unirse porque esos productos no están en los catálogos descargados.
- `worker/worker.js` pasa a la versión `2026-10-18-b` (antes solo existía en la raíz): campo `version`, `?fresh`, tiempos por tienda, `omitidas` y no guardar en caché respuestas con tiendas caídas. Hay que pegarlo en Cloudflare si no es el que está desplegado.
- Se borraron las copias de la raíz y se actualizaron `AGENTS.md` y `README.md`.

## Validación
- `node --test tests/canasta.test.cjs`: 16 pruebas aprobadas (4 nuevas: descartar tienda, exportar solo equivalencias confirmadas, migración de favoritos anteriores, consulta de respaldo). El `localStorage` simulado ahora distingue claves.
- `node tests/interfaz.cjs` en Chromium: aprobado, con capturas de escritorio y móvil revisadas. Precios simulados.
- `node --check` de `app.js`, `comparador.js`, `scraper/emparejar.mjs` y `worker/worker.js`.

# Bitácora — 17 de octubre de 2026

## Solicitud
Mejorar la interfaz y hacer que un producto seleccionado en búsqueda en vivo se guarde como favorito con los precios de las otras tiendas, para calcular el total de la lista por fuente.

## Diagnóstico
La búsqueda ya consultaba varias tiendas mediante el Worker, pero `favDeVivo` guardaba únicamente el precio del resultado seleccionado. La actualización del catálogo solo corregía enlaces conocidos, sin reunir todas las fuentes de ese favorito. Además, los identificadores basados únicamente en URL podían confundir resultados PriceSmart con un enlace de búsqueda compartido.

## Implementación
- Rediseño de encabezado, navegación, búsqueda y comparación, con ajustes de escritorio, móvil y modo oscuro.
- Separación del JavaScript en `app.js` y de las reglas de comparación en `comparador.js`.
- Al agregar un favorito, reutilizar los resultados disponibles y consultar el Worker para completar los precios. La consulta conserva el término de búsqueda que produjo el resultado seleccionado.
- Incorporar precios del catálogo cuando hay una relación conocida o una equivalencia conservadora.
- Agrupar coincidencias seguras por marca, variante y tamaño. Ofrecer selección manual cuando no existe una coincidencia segura, mostrando la presentación y precio antes de elegir.
- Mostrar todas las fuentes conocidas, incluso sin respuesta; mantener visibles las fechas y distinguir totales completos de parciales. Una fuente sin ningún precio muestra un guion como total.
- Calcular totales en centavos por cantidad y el costo de distribuir la compra entre las tiendas más baratas.
- Agregar actualización individual y de toda la lista; conservar favoritos, cantidades y equivalencias manuales en el navegador. La actualización de lista se procesa en serie.
- Cancelar consultas de favoritos eliminados y evitar que respuestas tardías restauren productos.
- Mantener el Worker y el workflow de GitHub existentes sin cambios.

## Validación
- 12 pruebas automatizadas aprobadas de equivalencias, cantidades, centavos, cobertura, favoritos entre tiendas, selección manual, persistencia, errores de red, cancelación, identificadores PriceSmart y conservación de precios recientes y elecciones manuales.
- Prueba con Chromium: buscar, agregar favorito, comparar varias fuentes, cambiar cantidad, verificar móvil sin desbordamiento de página, recargar y quitar.
- Capturas de escritorio y móvil revisadas visualmente. Los precios y las respuestas de tiendas se simularon para estas pruebas.
- Sintaxis de `app.js` y `comparador.js` comprobada con Node.

## Publicación y límites
La carpeta recibida no tiene `.git`, `config.js` ni los datos generados. No se publicó en GitHub ni Cloudflare desde esta copia. Subir `index.html`, `app.js` y `comparador.js` juntos al repositorio conectado; conservar allí el `config.js` que apunta al Worker y `data/`. Añadir también esta bitácora, `AGENTS.md`, el README y las pruebas para continuidad.

No se verificaron precios comerciales reales ni el despliegue existente, porque esta copia no incluye su URL. La cobertura depende de las tiendas habilitadas y sus resultados; una búsqueda puede no encontrar una presentación. En ese caso se muestra la ausencia y, si hay candidatos, permite elegir uno manualmente. Los precios guardados permanecen con su fecha hasta conseguir una actualización. Sin un código de barras compartido no se garantiza equivalencia universal; se evita unir productos de forma aproximada.

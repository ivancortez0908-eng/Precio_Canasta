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

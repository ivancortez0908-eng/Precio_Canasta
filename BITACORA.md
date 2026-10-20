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

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

# Guía de trabajo — Canasta SV

## Objetivo
Comparar una lista de productos entre supermercados de El Salvador. Al agregar un favorito, reunir sus precios en las otras fuentes y calcular la compra por tienda, respetando las cantidades.

## Estructura
- `index.html`: diseño adaptable, pestañas y contenedores de la interfaz.
- `app.js`: catálogo, búsqueda en vivo, favoritos, consultas y selección de equivalencias.
- `comparador.js`: reglas conservadoras de equivalencia y totales en centavos; sin dependencias.
- `worker/worker.js`: API de búsqueda en Cloudflare; devuelve `resultados`, `tiendas` y `generado`.
- `scraper/`: descarga y emparejamiento del catálogo.
- `.github/workflows/actualizar-precios.yml`: actualización programada del catálogo.
- `tests/canasta.test.cjs`: pruebas de reglas y flujo con DOM/respuestas simulados.
- `tests/interfaz.cjs`: flujo real en Chromium con respuestas simuladas.
- `BITACORA.md`: cambios, validación y límites de esta entrega.

## Integración existente
El usuario informa que GitHub y el Worker de Cloudflare ya están conectados y funcionan. Mantener esa integración. La URL se lee de `window.API_VIVO`, definida en el `config.js` del sitio; no inventar una URL ni sobrescribir la configuración existente. Esta copia local no contiene `config.js`, `data/productos.json` ni `.git`.

## Reglas del producto
- Un favorito agrupa precios de varias tiendas. Detectar el producto por tienda e ID; usar URL de producto como compatibilidad con favoritos anteriores.
- No usar una URL de búsqueda como identificador único: PriceSmart puede compartirla entre productos.
- Emparejar automáticamente solo con marca, nombre/variante y presentación compatibles. Mantener concentración, sabor y número de envases en la comparación. Las coincidencias ambiguas se eligen manualmente.
- Mostrar el nombre de cada fuente y la fecha del precio. Conservar las elecciones manuales en `localStorage` (`canasta-sv-favoritos-v1`).
- Una tienda sin coincidencia o que no responde no equivale a precio cero. Sus totales son parciales y no pueden ganar la comparación de compra completa.
- Multiplicar por cantidades de 1 a 99 y sumar en centavos. La compra combinada elige el menor precio disponible por favorito.
- Consultar todas las tiendas habilitadas por el Worker, incluidas las que fallan. No prometer cobertura de fuentes no habilitadas.
- Mantener datos guardados cuando falle la red y permitir reintentar. No sustituir precios recientes con un catálogo antiguo.
- Al quitar un favorito o vaciar la lista, cancelar sus consultas y evitar que respuestas tardías lo vuelvan a agregar.
- Mantener el cliente estático sin compilación ni dependencias de producción adicionales.

## Validación
Ejecutar `node --test tests/canasta.test.cjs`, `node --check app.js` y `node --check comparador.js`.

Si Playwright y Chromium están disponibles, ejecutar `node tests/interfaz.cjs`. `CANASTA_CAPTURAS` permite guardar capturas en una carpeta elegida. Verificar escritorio y móvil; los precios de esta prueba son ficticios y no validan la extracción real.

No descargar todos los catálogos para probar una mejora visual. Para publicar, conservar el `config.js` y los datos del repositorio conectado, y subir juntos `index.html`, `app.js` y `comparador.js`.

# Guía de trabajo — Canasta SV

## Objetivo
Comparar una lista de productos entre supermercados de El Salvador. Al agregar un favorito, reunir sus precios en las otras fuentes y calcular la compra por tienda, respetando las cantidades.

## Estructura
- `index.html`: diseño adaptable, pestañas y contenedores de la interfaz. Sin JavaScript incrustado: carga `config.js`, `comparador.js` y `app.js`.
- `app.js`: catálogo, búsqueda en vivo, favoritos, consultas, selección de equivalencias, registro de decisiones y aportes.
- `comparador.js`: reglas conservadoras de equivalencia y totales en centavos; sin dependencias.
- `worker/worker.js`: API de búsqueda en Cloudflare; devuelve `version`, `resultados`, `tiendas`, `omitidas` y `generado`. Por POST recibe aportes y crea una issue.
- `scraper/`: descarga y emparejamiento del catálogo; `equivalencias.json` guarda las equivalencias aprobadas.
- `.github/workflows/actualizar-precios.yml`: actualización programada del catálogo.
- `.github/workflows/aplicar-aporte.yml`: une a `scraper/equivalencias.json` las issues con la etiqueta `aprobado`.
- `config.js` y `data/`: configuración del sitio y datos generados; no editarlos a mano.

No crear copias de estos archivos en la raíz: los workflows y el sitio solo usan las rutas de arriba.
- `tests/canasta.test.cjs`: pruebas de reglas y flujo con DOM/respuestas simulados.
- `tests/interfaz.cjs`: flujo real en Chromium con respuestas simuladas.
- `BITACORA.md`: cambios, validación y límites de esta entrega.

## Integración existente
El usuario informa que GitHub y el Worker de Cloudflare ya están conectados y funcionan. Mantener esa integración. La URL se lee de `window.API_VIVO`, definida en `config.js`; no inventar una URL ni sobrescribir la configuración existente. El Worker se publica pegando `worker/worker.js` en Cloudflare; su campo `version` indica qué código está desplegado.

## Reglas del producto
- Un favorito agrupa precios de varias tiendas. Detectar el producto por tienda e ID; usar URL de producto como compatibilidad con favoritos anteriores.
- No usar una URL de búsqueda como identificador único: PriceSmart puede compartirla entre productos.
- Emparejar automáticamente solo con marca, nombre/variante y presentación compatibles. Mantener concentración, sabor y número de envases en la comparación. Las coincidencias ambiguas se eligen manualmente.
- Mostrar el nombre de cada fuente y la fecha del precio. Conservar las elecciones manuales en `localStorage` (`canasta-sv-favoritos-v1`); el registro de decisiones usa `canasta-sv-registro-v1` y los aportes `canasta-sv-aportes-v1`.
- Una tienda descartada por la persona (✗) no se vuelve a llenar automáticamente. Solo se exportan como equivalencias los precios del catálogo o elegidos por la persona, nunca coincidencias automáticas sin confirmar.
- Una tienda sin coincidencia o que no responde no equivale a precio cero. Sus totales son parciales y no pueden ganar la comparación de compra completa.
- Multiplicar por cantidades de 1 a 99 y sumar en centavos. La compra combinada elige el menor precio disponible por favorito.
- Consultar todas las tiendas habilitadas por el Worker, incluidas las que fallan. No prometer cobertura de fuentes no habilitadas.
- Mantener datos guardados cuando falle la red y permitir reintentar. No sustituir precios recientes con un catálogo antiguo.
- Al quitar un favorito o vaciar la lista, cancelar sus consultas y evitar que respuestas tardías lo vuelvan a agregar.
- Mantener el cliente estático sin compilación ni dependencias de producción adicionales.

## Validación
Ejecutar `node --test tests/canasta.test.cjs`, `node --check app.js` y `node --check comparador.js`.

Si Playwright y Chromium están disponibles, ejecutar `node tests/interfaz.cjs`. `CANASTA_CAPTURAS` permite guardar capturas en una carpeta elegida. Verificar escritorio y móvil; los precios de esta prueba son ficticios y no validan la extracción real.

No descargar todos los catálogos para probar una mejora visual. `node scraper/emparejar.mjs` trabaja sin red sobre `data/catalogo/`; para probarlo, ejecútalo en una copia y no subas el `data/productos.json` resultante (lo genera el workflow). Para publicar la interfaz, subir juntos `index.html`, `app.js` y `comparador.js`.

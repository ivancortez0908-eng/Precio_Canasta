# Guía de trabajo — Canasta SV

## Objetivo
Comparar listas de productos entre supermercados de El Salvador. Al agregar un favorito, reunir sus precios en las otras fuentes y calcular la compra por tienda, respetando las cantidades.

## Estructura
- `index.html`: diseño adaptable, pestañas y contenedores de la interfaz. Sin JavaScript incrustado: carga `config.js`, `comparador.js`, `exportar.js` y `app.js`.
- `app.js`: catálogo, búsqueda en vivo, listas de favoritos, consultas, selección de equivalencias, descargas y aportes.
- `exportar.js`: tabla de una lista para PDF (impresión del navegador) y archivo `.xlsx` generado sin librerías; sin dependencias.
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
- `.claude/skills/interfaz-canasta/SKILL.md`: guía de diseño (colores, estructura, posiciones, componentes y textos). Seguirla en todo cambio de interfaz.

## Integración existente
El usuario informa que GitHub y el Worker de Cloudflare ya están conectados y funcionan. Mantener esa integración. La URL se lee de `window.API_VIVO`, definida en `config.js`; no inventar una URL ni sobrescribir la configuración existente. El Worker se publica pegando `worker/worker.js` en Cloudflare; su campo `version` indica qué código está desplegado.

## Reglas del producto
- Hay varias listas de favoritos; la ☆ abre un cuadro para elegir o crear listas. Cada lista guarda su propia copia del producto (cantidad y elecciones).
- Un favorito agrupa precios de varias tiendas. Detectar el producto por tienda e ID; usar URL de producto como compatibilidad con favoritos anteriores.
- No usar una URL de búsqueda como identificador único: PriceSmart puede compartirla entre productos.
- Emparejar automáticamente solo con marca, nombre/variante y presentación compatibles. Mantener concentración, sabor y número de envases en la comparación. Las coincidencias ambiguas se eligen manualmente.
- Mostrar el nombre de cada fuente y la fecha del precio. Conservar las listas y elecciones manuales en `localStorage` (`canasta-sv-listas-v1`); la primera vez se migra la lista única de `canasta-sv-favoritos-v1` a «Mi lista» sin borrar la clave anterior. Los aportes usan `canasta-sv-aportes-v1`.
- Una tienda descartada por la persona («No está en esta tienda») no se vuelve a llenar automáticamente.
- La pregunta para enviar comparaciones al proyecto solo aparece cuando la persona elige o cambia un producto en la tabla de precios (`cambio`). Solo se envían precios del catálogo o elegidos por la persona, nunca coincidencias automáticas. No hay sección de entrenamiento ni registro de decisiones.
- Las descargas (PDF y Excel) muestran la fecha de cada precio y marcan los totales parciales; una tienda sin precio queda vacía, nunca en cero.
- Una tienda sin coincidencia o que no responde no equivale a precio cero. Sus totales son parciales y no pueden ganar la comparación de compra completa.
- Las ofertas por cantidad (`promo`: «N x $T», «Seleccione NX$T», «NxM») pertenecen al precio de una tienda y solo se aplican a esa tienda, por grupos completos, si abaratan y sin acumular descuentos (`costo` en `comparador.js`). Walmart, Maxi y Despensa de Don Juan las publican en `PromotionTeasers`/`Teasers` con nombres internos («Promo,1.1x2,AAAA-MM-DD-AAAA-MM-DD-…» = $1.10 c/u llevando 2; «PromoCombinaEnFijo,0.5x3,…» = 3 por $1.50) que el Worker convierte a «N x $T» solo si están vigentes y la cantidad coincide con `MinimumQuantity`. Selectos marca muchas ofertas con una imagen `tipoPromoMM/<código>.png`; el Worker traduce solo los códigos de los filtros oficiales de `/special-deals` (`2-1` = 2x1; `2-3`, `3-4`, `4-5`, `4-6`, `5-6`, `6-7`, `8-12` = paga el primero y lleva el segundo; `2-40`, `2-50`, `2-75` = segundo al X %); COMBO y otras no se interpretan. Un texto de oferta con otro formato no se interpreta. Un precio tomado del catálogo no conserva ofertas anteriores.
- Las búsquedas a las tiendas se envían sin tildes (se conserva la ñ): Selectos y Maxi no encuentran resultados con acentos.
- Un código de barras solo une productos si su dígito de control es válido y tiene al menos 8 cifras significativas.
- Multiplicar por cantidades de 1 a 99 y sumar en centavos. La compra combinada elige el menor precio disponible por favorito.
- Consultar todas las tiendas habilitadas por el Worker, incluidas las que fallan. No prometer cobertura de fuentes no habilitadas.
- Mantener datos guardados cuando falle la red y permitir reintentar. No sustituir precios recientes con un catálogo antiguo.
- Al quitar un favorito o vaciar la lista, cancelar sus consultas y evitar que respuestas tardías lo vuelvan a agregar.
- Mantener el cliente estático sin compilación ni dependencias de producción adicionales.

## Validación
Ejecutar `node --test tests/canasta.test.cjs`, `node --check app.js`, `node --check comparador.js` y `node --check exportar.js`.

Si Playwright y Chromium están disponibles, ejecutar `node tests/interfaz.cjs`. `CANASTA_CAPTURAS` permite guardar capturas en una carpeta elegida. Verificar escritorio y móvil; los precios de esta prueba son ficticios y no validan la extracción real.

No descargar todos los catálogos para probar una mejora visual. `node scraper/emparejar.mjs` trabaja sin red sobre `data/catalogo/`; para probarlo, ejecútalo en una copia y no subas el `data/productos.json` resultante (lo genera el workflow). Para publicar la interfaz, subir juntos `index.html`, `app.js`, `comparador.js` y `exportar.js`.

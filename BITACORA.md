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

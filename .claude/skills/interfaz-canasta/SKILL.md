---
name: interfaz-canasta
description: Guía de diseño de la interfaz de Canasta SV (solo modo claro) (index.html, app.js). Úsala antes de agregar o cambiar menús, pestañas, botones, tablas, cuadros, mensajes o estilos del sitio, para que todo siga la misma estructura, posiciones y textos.
---

# Interfaz de Canasta SV

<!-- No escribir el signo de dólar seguido de un número en este archivo: al usar /interfaz-canasta se reemplaza por el pedido. -->

Sitio estático, sin compilación ni librerías: los estilos viven en el `<style>` de `index.html` y el comportamiento en `app.js`. Antes de crear algo nuevo, **reutiliza un componente de esta guía**. Si de verdad falta uno, agrégalo aquí también.

## 1. Colores y apariencia

Usa siempre las variables de `:root`; nunca colores sueltos (salvo el amarillo de oferta aplicada).

**El sitio es solo de modo claro**, aunque el dispositivo esté en modo oscuro: `:root` y `<meta name="color-scheme">` declaran `light`. No agregues `@media (prefers-color-scheme:dark)` ni colores oscuros.

| Variable | Uso |
|---|---|
| `--bg` | fondo de la página y de campos de búsqueda |
| `--surf` | tarjetas, tablas, barra superior, cuadros |
| `--ink` / `--mute` | texto principal / secundario |
| `--line` | separadores de tabla y tarjetas |
| `--borde` | borde de campos (búsqueda, selectores, cantidad): contraste ≥ 3:1 |
| `--marca` / `--marcaHov` | verde de marca (`#0a6e37`, ≥ 4.5:1 sobre todos los fondos): logo, pestaña activa, foco, marcas de producto y fondo del botón principal `.pri` (texto blanco) / al pasar el mouse |
| `--btn` / `--hov` | botón normal / al pasar el mouse |
| `--best` / `--bestInk` | celda más barata |
| `--warn` | acciones que borran y avisos (`#b01433`, ≥ 4.5:1 también sobre botones grises) |
| `--v` `--a` `--r` | semáforo: verde, amarillo, rojo (decorativos: siempre acompañados de texto) |
| `--sh` | sombra de tarjetas |

- Todo texto nuevo debe tener contraste ≥ 4.5:1 con su fondo; compruébalo antes de elegir un color.
- Paleta propia de comparador (verde = ahorro), neutral frente a las tiendas: no uses el rojo de Selectos ni el azul y amarillo de Walmart como color de marca. El verde de marca va en navegación y botones; el verde claro `--best` con ✓ queda solo para el precio más barato.
- Letra: `system-ui`, 15 px (en celular, campos y selectores a 16 px para que Safari no haga zoom). Títulos de tarjeta `h2` 1.25rem; textos de apoyo `.msg` en `--mute`.
- Esquinas: tarjetas y tablas 8 px, botones 6 px, búsqueda y etiquetas redondas (999px).

## 2. Estructura de la página (no cambiar el orden)

```
header.top (fija, 56 px; 52 px en celular)
 ├─ h1.brand  logo (canasta en SVG) + «Canasta SV» (único h1)
 ├─ nav.tabs  [ícono] Buscar | [ícono] Mi lista [.badge n]   ← centradas; en celular, barra fija abajo
 └─ .sp  espacio que equilibra el logo (se oculta en móvil)
main (todo el ancho, 16 px de margen lateral)
 ├─ p.msg.intro   una línea que explica el sitio
 ├─ #p1 Buscar (página principal):
 │    form#fbuscar.controls (#q · «Buscar en las tiendas» .pri) → #fecha (fecha del catálogo)
 │    → #inicio, solo con la búsqueda vacía: section.cart#ilista (lista activa + «Ver mi lista») · .sug (sugerencias)
 │    → section#secvivo, tras buscar en las tiendas: .subbarra (h2 «En las tiendas ahora» · #ordv) → #estv → #ocultos → .wrap>table#tv / #mvivo → aviso
 │    → section#seccat: .subbarra (h2#cattit · #comp · #ord, por defecto «Mayor diferencia entre tiendas») → #count → .wrap>table#tabla / #mcat → «Mostrar más»
 └─ #p2 Mi lista:  .controls.listas → .controls.acciones (#favmsg + .botones) → #favresumen → #favest → .wrap.solo-escritorio>table#tfav
                    → #mfav (lista compacta, solo celular) → section.cart#favres
section#ayuda.ayuda   pregunta de aportes, al pie, solo cuando aplica
footer#foot           fecha y origen de los datos
dialog#dlista         «Guardar en una lista»
section#imprimir      hoja para PDF; solo visible al imprimir
```

- Un solo buscador: al escribir filtra el catálogo; Enter o «Buscar en las tiendas» consulta cada tienda (`vivo`). No vuelvas a separar Catálogo y En vivo en pestañas.
- Pestañas: ícono SVG en línea (`stroke: currentColor`, `aria-hidden`) + una o dos palabras; nada de emojis. Una pestaña nueva va **al final** de `nav.tabs`, con su panel `#pN` y `hidden`. Actualiza `pestana()`, las flechas del teclado (`onkeydown` de `.tabs`) y deja `role="tab"`/`aria-selected`.
- No agregues menús desplegables a la barra superior: tres pestañas como máximo; lo demás va dentro del panel.
- Títulos de sección dentro de un panel: `.subbarra` con `h2` a la izquierda y sus filtros a la derecha.

- Los `id` que usa `app.js` no se renombran sin cambiar también `app.js` y las pruebas.

## 3. Posiciones dentro de cada panel

Siempre de arriba abajo: **controles → estado → tabla → resumen**.

- **Barra de controles** (`.controls`, tarjeta en fila que se acomoda en móvil): primero lo que se escribe o elige (búsqueda, selector), después los botones.
- **Orden de botones** en una barra: mensaje a la izquierda (`flex:1`), luego acción principal (`.pri`, la única rellena de verde) → acciones secundarias → acción que borra al final (clase `.rm`, roja). Ejemplo real: «Actualizar precios · Descargar PDF · Descargar Excel · Vaciar lista».
- **Estado** (`p.msg` con `id`): justo debajo de la barra; dice qué pasó, en una frase («Buscando “leche” en las tiendas…», «No respondieron: …. Puedes reintentar.»).
- **Resumen** (`section.cart` con `h2`): debajo de la tabla, como la «Comparación de tu compra».
- Acciones de una fila van **en la primera columna** (fija), bajo el nombre: cantidad `.stp` (− número +), «Quitar» (`.rm`) y «Consultar tiendas» (`.retry`). Así se ven aunque haya muchas tiendas.

## 4. Componentes

| Necesito… | Usa |
|---|---|
| tarjeta con controles | `div.controls` (o `form.controls` si hay búsqueda con Enter) |
| tarjeta con título | `section.cart` + `h2` |
| tabla | `div.wrap > table`: encabezado y primera columna fijos, desplazamiento horizontal dentro del recuadro |
| botón principal (uno por barra) / normal / que borra / pequeño de fila | `button.pri` / `button` / `button.rm` / `button.retry` |
| texto solo para lectores de pantalla | `span.vh` |
| etiqueta tienda + precio (celular) | `chip(tienda, precio, mejor, extra, url)` en `app.js` |
| renglón compacto (celular) | `article.mitem > button.mcab[data-a=abrir][aria-expanded]` con `.mnom`, `.mcant`, `.mprecios > .chip` y, abierto, `.mdet` |
| cantidad | `span.stp` con `button[data-a=menos]`, `input.qty`, `button[data-a=mas]` (1 a 99) |
| favorito | `button.star` con `aria-pressed` y ☆/★; abre `dialog#dlista` |
| sugerencia de búsqueda | `.sug > button[data-q]` (redonda, fondo blanco) |
| contador en pestaña | `span.badge` (verde, texto blanco) |
| etiqueta pequeña | `.tag` (criterio de unión), `.store` (nombre de tienda), `.marca` (marca, verde) |
| precio más barato | `td.best` con `barato(html)` (✓ visible + «(más barato)» en `.vh`); nunca solo el color verde |
| sin dato | `td.na` con texto («Sin coincidencia», «Tienda sin respuesta», «Descartado por ti»); nunca cero dólares |
| oferta | `small.promo` («Oferta 2 x … · lleva 2 para aplicarla»), `small.promo.si` cuando ya se aplica, `small.antes` tachado |
| fecha y origen | `small.f` («al 20/10 · Elegido por ti») y `small.product-source` |
| elegir otra opción | `details.opciones[data-fav][data-store] > summary + select` + `button.retry[data-a=opciones]` «Buscar más opciones»; en la tabla dentro de la celda, en celular en `.msel` a todo el renglón. Sigue abierto aunque lleguen precios, y la lista no se redibuja mientras el selector tiene el foco |
| semáforo | `.totals > .tot.v|.a|.r` con `.dot`, `.tn`, `b`, `.tl` y la `.leyenda` |
| cuadro emergente | `<dialog>` con `h2`, contenido y botón «Listo» al final; `showModal()` |
| texto plegable | `details > summary` |
| aviso al pie | `section.ayuda` (borde izquierdo verde) con botones «Sí / No» |

## 5. Textos

- Español de El Salvador, tuteo («Marca la ☆…», «Puedes reintentar»). Frases cortas, sin tecnicismos ni inglés.
- Botones con verbo + objeto: «Actualizar precios», «Descargar Excel», «Crear y agregar». Nada de «OK» o «Enviar» a secas.
- Precios con `fmt()` (signo de dólar y 2 decimales); por unidad con `fpu()`; fechas cortas `dd/mm` con `fecha()`.
- Todo texto que venga de una tienda o del usuario pasa por `esc()` antes de ir a `innerHTML`.
- Explica los estados vacíos y los errores con qué hacer después («Aún no tienes favoritos. Marca la ☆…»).

## 6. Móvil y accesibilidad

**Celular (hasta 700 px) = versión compacta:**
- Cada barra de controles va **en una sola fila**: «Lista [selector] · Nueva · Renombrar · Eliminar» y «Actualizar · PDF · Excel · Vaciar». El mensaje de la barra va en su propia línea, encima de los botones.
- En celular los botones muestran una versión corta: la parte larga del texto va en `<span class="larga">` (se oculta) y el botón lleva `aria-label` con el nombre completo («Descargar PDF»). Si el texto lo cambia `app.js`, actualiza también el `aria-label`.
- **Las pestañas van en una barra fija abajo** (60 px + zona segura), con ícono arriba y texto abajo; la activa lleva borde superior verde. El `body` reserva ese espacio con `padding-bottom`. La barra superior queda solo con el logo y el nombre.
- **Ninguna pestaña muestra tablas en el celular** (`.solo-escritorio`): el catálogo usa `#mcat` y los resultados de las tiendas `#mvivo` (`.mlista`, renglones `.mitem > .mfila` con nombre, marca y tamaño, ☆, etiquetas «Tienda $precio» con el más barato primero y precio por unidad).
- Favoritos usa `#mfav`: cada producto es un renglón (`.mitem`) con nombre, cantidad y precios como etiquetas `.chip` **con el nombre de la tienda** y el más barato primero y en verde; las tiendas sin precio se resumen («4 sin precio»).
- Al tocar un renglón se abre su detalle (`.mdet`): marca y presentación, cantidad, Quitar, Consultar tiendas y una fila por tienda (`.mtienda`) con el mismo contenido de la celda de la tabla. El producto abierto (`.mitem.abierto`) lleva franja verde a la izquierda (`--marca`, 5 px), más sombra y más espacio, para que se vea dónde terminan sus tiendas. **Solo un producto abierto a la vez** (`abierto` en `app.js`); tocar el abierto lo cierra. La tabla y la lista compacta salen de los mismos datos (`filas` en `pintarFav`): no dupliques reglas.
- Se oculta la frase de introducción y los totales van en 2 columnas.


- Sin desplazamiento horizontal de la página: las tablas se desplazan dentro de `.wrap`; mantén `min-width:0` en los hijos de `main` y de los paneles.
- En menos de 700 px también se oculta `.sp`, y el botón de búsqueda se acorta a «Buscar».
- Botones de al menos ~32 px de alto; nada que dependa solo del color (el semáforo también dice el texto).
- Todo campo o botón de solo ícono lleva `aria-label`; las pestañas, `role="tab"` y `aria-selected`; mensajes que cambian solos (`#count`, `#estv`, `#favest`, `#favresumen`), `aria-live="polite"`.
- Respeta `:focus-visible` (contorno verde de marca); no lo quites.
- Zonas táctiles: al menos 44 px de alto en celular (botones, campos, selectores, `summary`, ☆) y 24 px en computadora.
- Pestañas: `aria-controls` hacia su panel, paneles con `role="tabpanel"` y `aria-labelledby`; solo la pestaña activa tiene `tabindex="0"`.
- Avisos que no se repiten por fila: lo que vale para toda la lista (p. ej. «No respondieron: …») va una vez en el mensaje de la barra.

## 7. Antes de terminar un cambio de interfaz

1. `node --test tests/canasta.test.cjs`, `node --check app.js`, `node --check comparador.js`, `node --check exportar.js`.
2. `CANASTA_CAPTURAS=<carpeta> node tests/interfaz.cjs` y mira las capturas: escritorio (1440 px), ventana mediana (1000 px) y móvil (390 px).
3. Si cambiaste algo visible, agrega o ajusta una comprobación en `tests/interfaz.cjs`.
4. Revisa que todo siga en modo claro con el dispositivo en modo oscuro, y la hoja de impresión (Descargar PDF) si tocaste colores o tablas.
5. Anota el cambio en `BITACORA.md`.

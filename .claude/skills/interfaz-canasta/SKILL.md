---
name: interfaz-canasta
description: Guía de diseño de la interfaz de Canasta SV (index.html, app.js). Úsala antes de agregar o cambiar menús, pestañas, botones, tablas, cuadros, mensajes o estilos del sitio, para que todo siga la misma estructura, posiciones y textos.
---

# Interfaz de Canasta SV

Sitio estático, sin compilación ni librerías: los estilos viven en el `<style>` de `index.html` y el comportamiento en `app.js`. Antes de crear algo nuevo, **reutiliza un componente de esta guía**. Si de verdad falta uno, agrégalo aquí también.

## 1. Colores y apariencia

Usa siempre las variables de `:root`; nunca colores sueltos (salvo el amarillo de oferta aplicada). Cada variable tiene su versión oscura en `@media (prefers-color-scheme:dark)`: si agregas una, define ambas.

| Variable | Uso |
|---|---|
| `--bg` | fondo de la página y de campos de búsqueda |
| `--surf` | tarjetas, tablas, barra superior, cuadros |
| `--ink` / `--mute` | texto principal / secundario |
| `--line` | bordes y separadores |
| `--blue` | marca, pestaña activa, foco, marcas de producto |
| `--btn` / `--hov` | botón normal / al pasar el mouse |
| `--best` / `--bestInk` | celda más barata |
| `--warn` | acciones que borran y avisos |
| `--v` `--a` `--r` | semáforo: verde, amarillo, rojo |
| `--sh` | sombra de tarjetas |

- Letra: `system-ui`, 15 px. Títulos de tarjeta `h2` 1.25rem; textos de apoyo `.msg` en `--mute`.
- Esquinas: tarjetas y tablas 8 px, botones 6 px, búsqueda y etiquetas redondas (999px).

## 2. Estructura de la página (no cambiar el orden)

```
header.top (fija, 56 px)
 ├─ .brand  logo «C» + «Canasta SV» (el texto se oculta en móvil)
 ├─ nav.tabs  🏪 Catálogo | ⚡ En vivo | ⭐ Favoritos (n)   ← centradas
 └─ .sp  espacio que equilibra el logo (se oculta en móvil)
main (todo el ancho, 16 px de margen lateral)
 ├─ p.msg.intro   una línea que explica el sitio
 ├─ #p1 Catálogo:   .controls (buscar · filtro · ordenar) → #count → .wrap>table#tabla → «Mostrar más»
 ├─ #p2 En vivo:    form.controls (buscar · «Buscar en las tiendas» · ordenar) → #estv → .wrap>table#tv → aviso
 └─ #p3 Favoritos:  .controls.listas → .controls (mensaje + acciones) → #favest → .wrap>table#tfav → section.cart#favres
section#ayuda.ayuda   pregunta de aportes, al pie, solo cuando aplica
footer#foot           fecha y origen de los datos
dialog#dlista         «Guardar en una lista»
section#imprimir      hoja para PDF; solo visible al imprimir
```

- Una pestaña nueva va **al final** de `nav.tabs`, con emoji + una o dos palabras, y su panel `#pN` con `hidden`. Actualiza `pestana()`, las flechas del teclado (`onkeydown` de `.tabs`) y deja `role="tab"`/`aria-selected`.
- No agregues menús desplegables a la barra superior: tres o cuatro pestañas como máximo; lo demás va dentro del panel.
- Los `id` que usa `app.js` no se renombran sin cambiar también `app.js` y las pruebas.

## 3. Posiciones dentro de cada panel

Siempre de arriba abajo: **controles → estado → tabla → resumen**.

- **Barra de controles** (`.controls`, tarjeta en fila que se acomoda en móvil): primero lo que se escribe o elige (búsqueda, selector), después los botones.
- **Orden de botones** en una barra: mensaje a la izquierda (`flex:1`), luego acción principal → acciones secundarias → acción que borra al final (clase `.rm`, roja). Ejemplo real: «Actualizar precios · Descargar PDF · Descargar Excel · Vaciar lista».
- **Estado** (`p.msg` con `id`): justo debajo de la barra; dice qué pasó, en una frase («Buscando “leche” en las tiendas…», «No respondieron: …. Puedes reintentar.»).
- **Resumen** (`section.cart` con `h2`): debajo de la tabla, como la «Comparación de tu compra».
- Acciones de una fila van **en la primera columna** (fija), bajo el nombre: cantidad `.stp` (− número +), «Quitar» (`.rm`) y «Consultar tiendas» (`.retry`). Así se ven aunque haya muchas tiendas.

## 4. Componentes

| Necesito… | Usa |
|---|---|
| tarjeta con controles | `div.controls` (o `form.controls` si hay búsqueda con Enter) |
| tarjeta con título | `section.cart` + `h2` |
| tabla | `div.wrap > table`: encabezado y primera columna fijos, desplazamiento horizontal dentro del recuadro |
| botón normal / que borra / pequeño de fila | `button` / `button.rm` / `button.retry` |
| cantidad | `span.stp` con `button[data-a=menos]`, `input.qty`, `button[data-a=mas]` (1 a 99) |
| favorito | `button.star` con `aria-pressed` y ☆/★; abre `dialog#dlista` |
| etiqueta pequeña | `.tag` (criterio de unión), `.store` (nombre de tienda), `.marca` (marca, azul) |
| precio más barato | `td.best` |
| sin dato | `td.na` con texto («Sin coincidencia», «Tienda sin respuesta», «Descartado por ti»); nunca $0 |
| oferta | `small.promo` («Oferta 2 x $2.20 · lleva 2…»), `small.promo.si` cuando ya se aplica, `small.antes` tachado |
| fecha y origen | `small.f` («al 20/10 · Elegido por ti») y `small.product-source` |
| elegir otra opción | `details.opciones > summary + select` dentro de la celda |
| semáforo | `.totals > .tot.v|.a|.r` con `.dot`, `.tn`, `b`, `.tl` y la `.leyenda` |
| cuadro emergente | `<dialog>` con `h2`, contenido y botón «Listo» al final; `showModal()` |
| texto plegable | `details > summary` |
| aviso al pie | `section.ayuda` (borde izquierdo azul) con botones «Sí / No» |

## 5. Textos

- Español de El Salvador, tuteo («Marca la ☆…», «Puedes reintentar»). Frases cortas, sin tecnicismos ni inglés.
- Botones con verbo + objeto: «Actualizar precios», «Descargar Excel», «Crear y agregar». Nada de «OK» o «Enviar» a secas.
- Precios con `fmt()` ($1.25); por unidad con `fpu()`; fechas cortas `dd/mm` con `fecha()`.
- Todo texto que venga de una tienda o del usuario pasa por `esc()` antes de ir a `innerHTML`.
- Explica los estados vacíos y los errores con qué hacer después («Aún no tienes favoritos. Marca la ☆…»).

## 6. Móvil y accesibilidad

- Sin desplazamiento horizontal de la página: las tablas se desplazan dentro de `.wrap`; mantén `min-width:0` en los hijos de `main` y de los paneles.
- En menos de 700 px se ocultan el nombre de la marca y `.sp`, y las pestañas se compactan.
- Botones de al menos ~32 px de alto; nada que dependa solo del color (el semáforo también dice el texto).
- Todo campo o botón de solo ícono lleva `aria-label`; las pestañas, `role="tab"` y `aria-selected`; mensajes que cambian solos, `aria-live="polite"`.
- Respeta `:focus-visible` (contorno azul); no lo quites.

## 7. Antes de terminar un cambio de interfaz

1. `node --test tests/canasta.test.cjs`, `node --check app.js`, `node --check comparador.js`, `node --check exportar.js`.
2. `CANASTA_CAPTURAS=<carpeta> node tests/interfaz.cjs` y mira las capturas: escritorio (1440 px), ventana mediana (1000 px) y móvil (390 px).
3. Si cambiaste algo visible, agrega o ajusta una comprobación en `tests/interfaz.cjs`.
4. Revisa el modo oscuro y la hoja de impresión (Descargar PDF) si tocaste colores o tablas.
5. Anota el cambio en `BITACORA.md`.

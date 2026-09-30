# Diseño visual de Setas

> **Estado: aprobadas por la usuaria el 2026-09-30**, sin cambios. Las maquetas `maqueta/hoy.html` y
> `maqueta/zona.html` son la referencia para construir las pantallas (tareas 12 a 19).

## Decisiones tomadas en la aprobación

- **Toxicología en la cabecera:** el botón dice solo «Toxicología» y llama con `tel:+34915620420` (el número va
  en su `aria-label`). El número completo, **91 562 04 20**, se ve en el pie de cada pantalla junto al 112.
- **Cero con barra:** se mantiene el de Atkinson Hyperlegible, a propósito, por legibilidad.

## Dirección

**Cuaderno de campo moderno.** Papel hueso con un punto de verde (no crema), tinta verde casi negra, verde de
pinar como único acento y ocre para lo que es previsión o incierto. Titulares con carácter, texto pensado para
leerse al sol, nombres científicos en cursiva de herbario y fotos reales grandes. La pieza principal de cada
pantalla va en una bandeja con bisel doble; el resto son tarjetas planas. Movimiento mínimo: solo respuesta al
toque y transiciones de estado, con `prefers-reduced-motion` respetado.

Plugins usados: `ui-ux-pro-max` (arquitectura, reglas de accesibilidad y gráficos), `design-taste-frontend`
(dirección, antipatrones), `high-end-visual-design` (bisel doble, isla de navegación, curvas), `ui-ux-pro-max:
design-system` (tokens en tres capas) y `brandkit` (estrategia del logo). No había herramienta de generación de
imágenes, así que el logo está dibujado a mano en SVG siguiendo la misma dirección.

## Logo

`img/logo.svg`: un sombrero de boletus con una **gota de lluvia vaciada** dentro y la gota en ocre. La idea de la
app en una forma: la lluvia hace la seta. El pie se ensancha en la base, como el de un boletus. El SVG cambia a
verde claro y ocre claro con el tema oscuro. `img/icono-192.png` e `img/icono-512.png` son la versión en tile de
bosque, con la marca dentro de la zona segura de un icono enmascarable.

## Tokens (`css/tokens.css`)

Tres capas: primitivos (`--p-*`, `--esp-*`, `--r-*`, `--fuente-*`, `--t-*`) → semánticos (`--c-*`, cambian con
el tema) → componente (`--tarjeta-*`, `--boton-*`, `--chip-*`, `--nav-*`, `--semaforo-*`). Los componentes no
usan hex sueltos.

Tema: claro por defecto; oscuro por `prefers-color-scheme` o con `<html data-theme="dark">`;
`data-theme="light"` fuerza el claro.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--c-fondo` | `#f1f2ea` | `#0c1510` | fondo de página |
| `--c-superficie` | `#fbfbf6` | `#121e17` | tarjetas |
| `--c-texto` | `#142019` | `#edf1ea` | texto principal |
| `--c-texto-2` | `#3d4a41` | `#bfcac1` | texto secundario |
| `--c-acento` | `#245a3d` | `#7fbf95` | botón principal, enlaces |
| `--c-ocre` | `#b27a0e` | `#e2ad48` | previsión, incierto, foco |
| `--c-peligro` | `#b3261e` | `#ff8a7e` | Toxicología, tóxicas parecidas |
| `--c-borde` | `#d3d6c8` | `#24382b` | divisiones |

### Semáforo

Cada nivel tiene tres colores: trazo (`--c-sem-X`, barras), fondo (`--c-sem-X-fondo`) y texto
(`--c-sem-X-texto`). **Se lee sin color:** siempre lleva la palabra y una forma de cuatro barras crecientes; cada
barra llena son 20 puntos.

**Herencia del nivel:** vale el `data-nivel` más cercano, sea del propio `.semaforo` o de un contenedor
(`.fila-zona`, una tarjeta). Todo el semáforo se pinta con propiedades personalizadas (`--sem`, `--sem-fondo`,
`--sem-texto`, `--b1` a `--b4` para las barras llenas...), así que un `.semaforo` con su propio nivel dentro de un
contenedor con otro nivel muestra el suyo. Sin `data-nivel` en ningún sitio, los valores de `:root` dan el aspecto
«sin datos»: nunca sale un nivel inventado.

| Nivel | Rango | Barras llenas | Claro (trazo) | Oscuro (trazo) |
|---|---|---|---|---|
| Nulo | 0 a 20 | 0 (cuatro huecas) | piedra `#7a736b` | `#a39c93` |
| Bajo | 20 a 40 | 1 | óxido `#b8542a` | `#e5825a` |
| Posible | 40 a 60 | 2 | ocre `#b27a0e` | `#e2ad48` |
| Bueno | 60 a 80 | 3 | musgo `#4c8a37` | `#93c877` |
| Muy bueno | 80 a 100 | 4 | pinar `#1d5e3a` | `#5fd08f` |
| Sin datos | sin nota | ninguna: «?» en círculo discontinuo, anillo fino y sin fondo, sin número | `#7d827e` | `#8f9791` |

### Contraste (comprobado)

Comprobado con `node scripts/contraste.mjs`, que resuelve los tokens de `css/tokens.css` y calcula la razón WCAG 2.x
de 52 pares por tema (texto ≥ 4,5:1; trazos, bordes de control y foco ≥ 3:1). También comprueba que los dos bloques
del tema oscuro (`@media (prefers-color-scheme: dark)` y `:root[data-theme="dark"]`) sigan siendo idénticos. Sale con
código 1 si algo falla: **hay que ejecutarlo tras tocar cualquier color.** Resultado actual: **0 fallos en los dos
temas.** Algunos valores:

| Par | Claro | Oscuro |
|---|---|---|
| texto sobre fondo | 14,90 | 16,25 |
| texto-2 sobre fondo | 8,26 | 11,00 |
| texto-3 sobre superficie | 5,47 | 6,85 |
| texto sobre botón de acento | 7,77 | 8,66 |
| texto sobre botón de Toxicología | 6,54 | 7,92 |
| texto del semáforo sobre su fondo (el peor) | 5,68 (posible) | 8,71 (bajo) |
| barras del semáforo sobre su fondo (el peor) | 3,04 (posible) | 5,41 (nulo) |
| sin datos: texto sobre la tarjeta | 7,71 | 10,28 |

## Tipografía (Google Fonts)

- **Bricolage Grotesque** 600 a 800 (`--fuente-display`): titulares, notas del índice, nombres de zona.
- **Atkinson Hyperlegible Next** 400 a 800 (`--fuente-texto`): todo el texto. Hecha para la máxima legibilidad
  (buena al sol); su cero lleva barra, a propósito.
- **Atkinson Hyperlegible Mono** 400 y 700 (`--fuente-cifras`): valores de los factores, fórmula, posiciones.
- **Newsreader** cursiva 500 (`--fuente-latin`): solo nombres científicos, como en una etiqueta de herbario.

Texto base **17 px** (`--t-base`); pies y etiquetas 15 px; 14 px solo para rótulos de la barra inferior, ejes y
etiquetas cortas. Todas las cifras con `font-variant-numeric: tabular-nums` (clases `.cifra`, `.tabular`, `.indice`).
Número y unidad van unidos con espacio duro (`74&nbsp;mm`).

## Componentes (`css/componentes.css`)

| Clase | Qué es |
|---|---|
| `.cabecera` | barra superior fija: marca y botón de **Toxicología** (`tel:+34915620420`), siempre visible |
| `.barra-nav` | isla flotante inferior con 5 secciones (Hoy, Mapa, Especies, Diario, Ajustes) y, encima, la franja «Ante la duda, no la comas.», siempre visible |
| `.tarjeta`, `.tarjeta--bisel` + `.tarjeta__nucleo` | tarjeta plana; bisel doble solo para la pieza principal de la pantalla |
| `.semaforo[data-nivel]` | distintivo del nivel con barras + palabra; hereda el `data-nivel` más cercano (ver «Herencia del nivel») |
| `.indice`, `.indice--grande` | nota 0 a 100 en el color de texto del nivel |
| `.chip`, `.chips` | filtros de 44 px, en fila desplazable; `aria-pressed="true"` para el activo |
| `.boton` (`--peligro`, `--suave`, `--compacto`, `--icono`) + `.boton__nido` | píldoras de 48 px (44 px las compactas); icono anidado a la derecha en la acción principal |
| `.etiqueta` (`--acento`, `--ocre`) | confianza, «orientativo», «incierta», origen del dato |
| `.aviso` | aviso ocre (previsión incierta) |
| `.aviso-peligro` | recuadro rojo (tóxicas parecidas, precaución) |
| `.hoja[data-abierta]` | hoja inferior para detalles, filtros o Toxicología. Cerrada lleva `visibility: hidden`: queda fuera del tabulador y del lector de pantalla, y el cambio espera al final del deslizamiento. **Quien la abre debe mover el foco a la hoja y, al cerrarla, devolverlo al botón que la abrió**; también se cierra con Escape |
| `.lista-zonas` + `.fila-zona[data-nivel]` | fila con raya lateral del nivel, nombre, nota grande, semáforo y frase; sirve también para especies |
| `.factores` + `.factor` | desglose del índice: código, nombre, valor, frase clara y barra fina sin pista |
| `.grafico` | gráfico SVG de lluvia: dos paneles con el mismo eje (acumulado de 26 días arriba, lluvia diaria abajo), previsión rayada en ocre con horquilla entre modelos y raya de «hoy» |
| `.modelos` + `.modelo` | contraste de modelos como diagrama de puntos con la media marcada |
| `.leyenda`, `.muestra` | leyenda de gráficos |
| `.pie` | aviso fijo del índice, Toxicología y 112, «Weather data by Open-Meteo.com» y AEMET |

Reglas: objetivos táctiles de 44 px o más; radios 24/18 px en tarjetas, píldora en controles, 10 px en detalles;
foco visible ocre de 3 px; sin guiones largos en los textos; la pestaña Especies usa la silueta del logo.

**Iconos:** Phosphor Icons (regular, licencia MIT) en un solo sprite, `img/iconos.svg`. Ids: `i-telefono`, `i-atras`,
`i-ir`, `i-abrir`, `i-hoy`, `i-mapa`, `i-diario`, `i-ajustes`, `i-aviso`, `i-lluvia`, `i-info`, `i-sello`, `i-pinar`,
`i-temp`, `i-flecha` e `i-especies`. La app, servida por http(s), los usa así:
`<svg class="icono" aria-hidden="true"><use href="img/iconos.svg#i-mapa"/></svg>`. Las maquetas llevan una copia en
línea del mismo sprite porque Chrome bloquea el `<use>` a un fichero externo cuando la página se abre con `file://`
(comprobado: con `file://` no pinta nada; por http, sí).

## Maquetas

- `maqueta/hoy.html`: zona destacada con foto, aviso de previsión incierta, filtro por especie, las 8 zonas
  ordenadas (con «incierta» y una «sin datos»), leyenda del semáforo y pie.
- `maqueta/zona.html`: resumen de Soria por puntos, gráfico de lluvia (60 días + 10 de previsión), desacuerdo
  entre modelos, desglose de *Boletus edulis* factor a factor con confianza, otras especies y cotos.

Los datos son **inventados** (lo dice una etiqueta arriba). La foto es `img/especies/boletus-edulis-2.webp`
(franciscodocampo, CC BY 4.0, iNaturalist), con su crédito visible.

## Auditoría de usabilidad final (2026-09-30)

Pase con `frontend-design-audit:quick` y recorrido con Playwright a 390×844 en claro y oscuro por Hoy, Zona
(Guadarrama y Soria), Mapa, Especies, ficha de *Amanita phalloides*, Seguridad, Diario y Ajustes: sin errores de
consola propios (solo un 429 de Open-Meteo tras recargas repetidas, que la app gestiona), sin desbordamiento
horizontal, con Toxicología, «Ante la duda» y la atribución de Open-Meteo visibles en todas.

- **Corregido:** los enlaces del pie (Reglas de seguridad, 91 562 04 20, 112, Open-Meteo) medían 20 px de alto; ahora
  tienen zona de toque de 44 px (`.pie a::after`) sin mover el texto.
- **No corregido, justificado:** los enlaces de crédito («original», «ver original», autor de la foto) y los nombres
  de especie dentro de frases miden 18 a 22 px. Son enlaces en línea dentro de texto (WCAG 2.2, criterio 2.5.8, los
  exime) y ampliarlos rompería la lectura compacta de créditos, que la licencia CC BY exige visibles. Las acciones
  principales sí miden 44 px o más.

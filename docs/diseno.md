# Diseño visual de Setas

> **Estado: pendiente de la aprobación de la usuaria.** Las maquetas `maqueta/hoy.html` y `maqueta/zona.html`
> son una propuesta. Si hay cambios, se apuntan aquí antes de construir las pantallas (tareas 12 a 19).

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

| Nivel | Rango | Barras llenas | Claro (trazo) | Oscuro (trazo) |
|---|---|---|---|---|
| Nulo | 0 a 20 | 0 (cuatro huecas) | piedra `#7a736b` | `#a39c93` |
| Bajo | 20 a 40 | 1 | óxido `#b8542a` | `#e5825a` |
| Posible | 40 a 60 | 2 | ocre `#b27a0e` | `#e2ad48` |
| Bueno | 60 a 80 | 3 | musgo `#4c8a37` | `#93c877` |
| Muy bueno | 80 a 100 | 4 | pinar `#1d5e3a` | `#5fd08f` |
| Sin datos | sin nota | ninguna: «?» en círculo discontinuo, borde discontinuo, sin número | `#7d827e` | `#8f9791` |

### Contraste (comprobado)

Comprobado con un script que resuelve los tokens de `tokens.css` y calcula la razón WCAG 2.x de 51 pares por tema
(texto ≥ 4,5:1; trazos, bordes de control y foco ≥ 3:1). **0 fallos en los dos temas.** Algunos valores:

| Par | Claro | Oscuro |
|---|---|---|
| texto sobre fondo | 14,90 | 16,25 |
| texto-2 sobre fondo | 8,26 | 11,00 |
| texto-3 sobre superficie | 5,47 | 6,85 |
| texto sobre botón de acento | 7,77 | 8,66 |
| texto sobre botón de Toxicología | 6,54 | 7,92 |
| texto del semáforo sobre su fondo (el peor) | 5,68 (posible) | 8,71 (bajo) |
| barras del semáforo sobre su fondo (el peor) | 3,04 (posible) | 5,41 (nulo) |
| sin datos: texto sobre su fondo | 6,51 | 8,79 |

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
| `.semaforo[data-nivel]` | distintivo del nivel con barras + palabra; `data-nivel` en un contenedor también da `--sem*` a sus hijos |
| `.indice`, `.indice--grande` | nota 0 a 100 en el color de texto del nivel |
| `.chip`, `.chips` | filtros de 44 px, en fila desplazable; `aria-pressed="true"` para el activo |
| `.boton` (`--peligro`, `--suave`, `--compacto`, `--icono`) + `.boton__nido` | píldoras de 48 px (44 px las compactas); icono anidado a la derecha en la acción principal |
| `.etiqueta` (`--acento`, `--ocre`) | confianza, «orientativo», «incierta», origen del dato |
| `.aviso` | aviso ocre (previsión incierta) |
| `.aviso-peligro` | recuadro rojo (tóxicas parecidas, precaución) |
| `.hoja[data-abierta]` | hoja inferior para detalles, filtros o Toxicología |
| `.lista-zonas` + `.fila-zona[data-nivel]` | fila con raya lateral del nivel, nombre, nota grande, semáforo y frase; sirve también para especies |
| `.factores` + `.factor` | desglose del índice: código, nombre, valor, frase clara y barra fina sin pista |
| `.grafico` | gráfico SVG de lluvia: dos paneles con el mismo eje (acumulado de 26 días arriba, lluvia diaria abajo), previsión rayada en ocre con horquilla entre modelos y raya de «hoy» |
| `.modelos` + `.modelo` | contraste de modelos como diagrama de puntos con la media marcada |
| `.leyenda`, `.muestra` | leyenda de gráficos |
| `.pie` | aviso fijo del índice, Toxicología y 112, «Weather data by Open-Meteo.com» y AEMET |

Reglas: objetivos táctiles de 44 px o más; radios 24/18 px en tarjetas, píldora en controles, 10 px en detalles;
foco visible ocre de 3 px; sin guiones largos en los textos; iconos de **Phosphor Icons** (regular, licencia MIT)
en un `<symbol>` por pantalla; la pestaña Especies usa la silueta del logo.

## Maquetas

- `maqueta/hoy.html`: zona destacada con foto, aviso de previsión incierta, filtro por especie, las 8 zonas
  ordenadas (con «incierta» y una «sin datos»), leyenda del semáforo y pie.
- `maqueta/zona.html`: resumen de Soria por puntos, gráfico de lluvia (60 días + 10 de previsión), desacuerdo
  entre modelos, desglose de *Boletus edulis* factor a factor con confianza, otras especies y cotos.

Los datos son **inventados** (lo dice una etiqueta arriba). La foto es `img/especies/boletus-edulis-2.webp`
(franciscodocampo, CC BY 4.0, iNaturalist), con su crédito visible.

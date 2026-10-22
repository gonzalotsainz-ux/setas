# La app gira en torno al mapa: una vista por niveles — diseño

> **Revisión 2026-10-21 por la usuaria:** el mapa queda limpio; la ficha del monte es la pantalla Zona; sin hoja fija ni
> barra de días en el mapa. Sus palabras: «no se ve bien porque los recuadros de información tapan el mapa. Prefiero que
> salgan las zonas y, si haces clic sobre la zona, hace zoom sobre las subzonas, y si haces clic en esas subzonas te lleva
> a otra página donde ya ves toda la información». Queda así: zonas → montes de la zona → página del monte
> (`#zona/<zona>/<punto>`); las laderas se tocan y abren un popup de Leaflet con su ficha (rojo en una zona prohibida); el
> mapa enseña siempre hoy; los avisos son una sola línea que se despliega al tocarla; un lugar buscado fuera de las zonas
> lo dice esa línea. Lo que sigue describe el diseño anterior: la hoja fija (§2), la barra de días (decisión 14) y la lista
> «Dónde ir» ya no existen.

Fecha: 21/10/2026 · Estado: **implementado el 2026-10-21 (rama `mapa-niveles`)**; aprobado por la usuaria el 21/10/2026 tras la revisión del constructor (brainstorming del 21/10/2026; maquetas aprobadas en `maqueta/mapa-niveles.html`, y las tres variantes previas en `maqueta/mapa-que-cuenta.html`)

## 1. Qué se quiere y por qué

La gente que usa la app entra directamente al **Mapa** para decidir dónde ir y espera encontrarlo todo ahí. Hoy el mapa es una pestaña más: la portada es «Hoy» (lista de zonas con nota), y para saber **por qué** una mancha es verde y **qué seta** esperar hay que tocar, arrastrar o salir a «Zona». El buscador solo conoce pueblos de las provincias de las zonas y no se comporta como el de Google Maps.

Lo que pidió la usuaria, con sus palabras: «ver de un vistazo dónde hay más probabilidades de encontrar setas, por qué y qué setas», «un mapa más intuitivo para usar desde el móvil», «si escribo un sitio en el buscador quiero que salga como si fuera Google Maps», «que toda la app gire en torno al Mapa», y la idea que lo articula: «unificar la vista de dónde ir hoy y que esté marcada en el mapa; si pulso sobre una de esas zonas la acerca y salen las subdivisiones de las zonas».

### Criterios de éxito
- Al abrir la app se ve el mapa con las zonas marcadas y ordenadas por nota, sin pasar por ninguna otra pantalla.
- En cada nivel (zonas, montes, laderas) se lee **dónde, por qué y qué seta** sin arrastrar nada.
- Escribir un pueblo o un paraje de cualquier punto de España lleva el mapa allí, con sugerencias mientras se escribe.
- Nada de lo que hoy dice «Hoy» (nota, confianza, previsión, datos incompletos, discrepancia estación/modelo, NO IR) se pierde: pasa a las filas del mapa.
- Las reglas del semáforo y de seguridad se mantienen: nunca una nota inventada, el nivel siempre con palabra y barras, Toxicología y «Ante la duda, no la comas» visibles en todo momento.

### No objetivos
- No cambia el cálculo del índice, ni la rejilla, ni el precálculo de Supabase, ni la meteo.
- No cambian las pantallas **Zona**, **Especies**, **Diario** ni **Ajustes** (salvo los enlaces a «Hoy»).
- No se hace la fase de grupos (diseño del 02/10/2026) ni las piezas A y B del brainstorming del 01/10/2026.
- No hay tiempos de viaje ni rutas calculadas en la app: «Cómo llegar» sigue siendo el enlace a Google Maps.

### Anti-objetivos (lo que haría fracasar el cambio aunque funcione)
- Que vuelvan los **rectángulos** de las zonas («los cuadraditos»): la usuaria los rechazó explícitamente. Las zonas se señalan solo con chinchetas y, dentro, con un contorno suave y discontinuo.
- Que el mapa tarde tanto en abrirse que la gente no vea nada en los primeros segundos.
- Que una chincheta de zona o de monte diga una cosa y la hoja otra.
- Que un sitio sin monte apropiado, o una zona prohibida, salga coloreado o con chincheta «buena».

## 2. Lo que ve la usuaria (aprobado en las maquetas)

Una sola pantalla, el mapa a pantalla completa, con tres **niveles** que son tres momentos de la misma vista. Arriba siguen el buscador y los chips de especie («Mejor hoy» y las comestibles en temporada); a la derecha, Capas y Mi ubicación; abajo, una **hoja** pegada al borde inferior que cambia de contenido con el nivel y que lleva dentro la **barra de días** (Hoy, Mañana…), visible en los tres niveles. La cabecera (logo, Reglas de seguridad, Toxicología) y la franja «Ante la duda, no la comas» no cambian.

### Nivel 1 · Lejos: las zonas
- Una **chincheta por zona** (12), con la nota grande en color del semáforo y el nombre corto de la zona. Sin nota: chincheta gris con «?», como el semáforo «sin datos».
- La hoja muestra **«Dónde ir hoy»** (o «mañana», «el jueves»… según el día elegido): las zonas ordenadas de mejor a peor, cada fila con nombre, nota, el porqué en una línea (la frase que hoy construye «Hoy»: mm en 26 días, cuándo llovió, temperatura, especie) y las etiquetas que hoy da «Hoy» (Confianza, Previsión, Previsión incierta, N especies sin datos, Estación y modelo no coinciden, NO IR). Es la pantalla «Hoy» metida en el mapa.
- Tocar una chincheta o una fila **acerca el mapa a esa zona** (nivel 2). Pellizcar para acercar también enseña las chinchetas de los montes, pero la hoja sigue en «Dónde ir» hasta que se toca una.

### Nivel 2 · Zona: sus montes
- El mapa encuadra la zona. Se dibuja un **contorno suave, fino y discontinuo** de la zona (su extensión) para saber dónde acaba; nunca un rectángulo relleno ni con halo.
- Una **chincheta por monte**: los «puntos» que la zona ya tiene en `data/zonas.json` (Pinar de Valsaín, Pinar de la Morcuera… hasta 11 por zona; Merindades tiene uno). Nota en color y nombre corto del monte. Los puntos NO IR llevan chincheta gris con su rótulo y no entran en el orden.
- Las manchas de ladera empiezan a verse de fondo, como hoy a partir del zoom 9.
- La hoja muestra la **zona**: nombre, nivel y nota, una frase con el porqué de la zona, las etiquetas de «Hoy», y la **lista de montes** ordenada, cada fila con nombre, nota y una línea (especie que da la nota, aviso de coto si el punto lo tiene). Un enlace «Detalle de la zona» abre la pantalla **Zona** actual.
- Tocar una chincheta o una fila acerca el mapa al monte (nivel 3).
- El buscador se convierte en **migas** («‹ Guadarrama»): tocar «‹» vuelve al nivel 1. El botón atrás del móvil hace lo mismo.

### Nivel 3 · Monte: las laderas
- El mapa encuadra el monte (vista cercana). Se ven las **manchas** de ladera de ese día y de ese chip, como hoy.
- Las mejores manchas de la vista llevan una **etiqueta** flotante (especie, nota y una palabra de porqué: «umbría», «solana», «1 450 m»). Pocas (tres como mucho), bien separadas, nunca sobre una zona prohibida.
- La hoja muestra la **ficha del monte**: nombre, nivel y nota, la especie que da la nota (nombre común y científico) y «también …» con la segunda, el porqué en una frase (lluvia de 26 días, humedad del suelo si hay, temperatura media), el coto (y si pide permiso) y los tres botones: **Cómo llegar**, **Diario** (nueva salida con zona, monte y coordenadas) y **Más** (abre la pantalla **Zona** con ese punto ya elegido). Arrastrada hacia arriba, el desglose del índice y la gráfica de lluvia del punto, como hoy en Zona.
- Tocar una mancha cambia la hoja a **esa ladera** (la hoja de celda actual: bosque, altitud, orientación, nota, especie, lluvia, coto y botones). Tocar fuera de una mancha vuelve a la ficha del monte.
- Migas: «‹ Guadarrama › Valsaín». Atrás vuelve al nivel 2.

### Buscador «como Google Maps»
- Mientras se escribe aparecen sugerencias (8 como mucho) de: especies (eligen su chip), zonas y montes de la app, sitios investigados, pueblos de `data/pueblos.json` y, además, **cualquier lugar de España** (pueblos, parajes, puertos, montes) de un geocodificador externo.
- Elegir una sugerencia lleva el mapa allí al nivel que corresponda: una zona al nivel 2, un monte al nivel 3, un pueblo o paraje a una vista cercana con una **chincheta de búsqueda** temporal (como la de Google Maps) y la hoja del nivel que toque.
- Si el lugar está **fuera de las 12 zonas**, el mapa va allí igualmente, se ven las chinchetas de las zonas más cercanas y la hoja avisa: «La app no tiene datos de monte aquí; las zonas más cercanas son…» con sus filas.

### Navegación de la app
- La barra inferior pasa a **cuatro** secciones: Mapa, Especies, Diario, Ajustes. «Hoy» desaparece.
- Abrir la app, tocar el logo y la dirección antigua `#hoy` llevan al mapa.
- La pantalla **Zona** se queda tal cual, como pantalla aparte: su botón «‹ Hoy» pasa a «‹ Mapa» y devuelve al nivel en el que se estaba.

### Lo que se quita
- La pantalla «Hoy» (archivo `js/pantallas/hoy.js` como pantalla; sus funciones de cálculo y de texto se conservan en un módulo compartido).
- El «modo de puntos» del mapa (círculos con popup y «Ver zona») y los rectángulos de zona en `js/mapa.js`: los sustituyen las chinchetas y la hoja.

## 3. Decisiones de la usuaria

- El mapa es la portada y toda la app gira en torno a él.
- Una sola vista por niveles: zonas → montes (las subdivisiones) → laderas. Tocar una zona la acerca y enseña sus montes.
- La lista «dónde ir» va unida al mapa y marcada en él.
- Chinchetas con la nota y el nombre (de las tres formas propuestas, se eligió por defecto esta al no marcar otra; flecha y globo con seta descartados).
- **Sin rectángulos** de zona. Contorno suave y discontinuo de la zona en el nivel 2: sí («me gusta así»).
- La pantalla **Zona** se queda como pantalla aparte a la que llevan «Más» y «Detalle de la zona».

## 4. Decisiones mías (comunicadas; cambiables)

1. **El zoom decide qué se ve en el mapa; la selección (decisión 13) decide la hoja y las migas.** El zoom controla exactamente dos cosas, con constantes que el constructor puede ajustar a ojo en el móvil: qué **chinchetas** se ven (zonas por debajo del zoom 9, `ZOOM_MIN_FINA`, donde hoy se pasa de celdas gruesas a finas; montes desde 9) y desde qué zoom se calculan las **etiquetas** de las manchas (13). Pellizcar enseña los montes, pero la hoja sigue en lo que se haya elegido hasta tocar una chincheta o una fila.
2. **Cada nivel tiene dirección:** `#mapa`, `#mapa/<zona>`, `#mapa/<zona>/<punto>`. Las migas y el botón atrás usan el historial. `#mapa/<zona>` ya existe hoy (encuadra la zona) y sigue valiendo.
3. **Qué nota lleva cada chincheta.** Zona: la que calcula hoy «Hoy» (`calcularZona`: la mejor especie del mejor punto recogible, con el chip y el día elegidos). Monte: la nota del punto con la meteo del punto (`notaPunto`, ampliada al día y al chip elegidos), que es la misma que enseña Zona para ese punto. Las manchas siguen saliendo del índice por ladera. Las dos fuentes pueden no coincidir al detalle; por eso la hoja del monte habla del **punto** (su nota, su especie, su lluvia) y las etiquetas de las manchas hablan de **laderas**. La hoja del monte no afirma nada sobre laderas concretas.
4. **La barra de días vive en la hoja** en los tres niveles; cambiar el día recalcula chinchetas, lista y manchas. Los días lejanos siguen con «menos fiable».
5. **El geocodificador externo es el de CartoCiudad del IGN**, comprobado el 21/10/2026: gratuito, sin clave, con CORS abierto y para toda España. `GET https://www.cartociudad.es/geocoder/api/geocoder/candidates?q=<texto>&limit=8&no_process=callejero,portal,carretera` devuelve pueblos (`poblacion`, `Municipio`), topónimos (`toponimo`: «Refugio de la Morcuera (Rascafría)») y parajes del NGBE (`ngbe`: «Pinar de Valsaín (Paraje) (Real Sitio de San Ildefonso)»); **las sugerencias vienen sin coordenadas** (`lat`/`lng` a 0), así que al elegir una se pide `find?id=<id>&type=<type>`, que sí las trae. Se excluyen calles y portales (`no_process`): no son sitios de setas y llenan la lista de ruido. Se consulta con un retardo de 300 ms tras dejar de escribir y a partir de 3 letras, y sus resultados van **después** de los de la app. Los datos del IGN son CC BY 4.0 (la app ya atribuye el NGBE y la Base IGN): se añade CartoCiudad a los créditos de Ajustes. No se ha encontrado un límite de peticiones publicado; el constructor cachea las sugerencias en memoria y no reintenta en bucle. Nominatim de OSM queda descartado (prohíbe el autocompletado); Photon (Komoot) es la reserva si CartoCiudad fallase, con la misma comprobación de condiciones. Sin red, el buscador funciona con lo local.
6. **Mapa en la portada = Leaflet y la primera rejilla se cargan nada más abrir.** Se acepta. Para que se vea algo enseguida: el mapa se monta con las chinchetas de zona en cuanto hay datos (sin esperar meteo: «?» y luego la nota) y la rejilla y el índice llegan después, como ahora.
7. **Sin índice, sin red o sin `DecompressionStream`**, los niveles 1 y 2 funcionan igual (sus notas salen de la meteo de los puntos, no del índice). En el nivel 3 no hay manchas ni etiquetas; la hoja del monte sigue y el aviso actual lo explica. El antiguo modo de puntos desaparece porque las chinchetas de monte lo sustituyen.
8. **Las etiquetas de las manchas** del nivel 3 se calculan con las notas que ya devuelve el pintor para la vista (sin pedir nada más): máximos locales con una separación mínima en píxeles, tres como mucho, solo con nota de «Bueno» o mejor; si no hay ninguna, no hay etiquetas. La palabra de porqué sale de la orientación (umbría/solana) o de la altitud.
9. **La tarjeta «destacada» de Hoy** (foto grande de la especie) desaparece: la primera fila de la lista ya es la mejor zona. El aviso de datos caducados («con los últimos datos») pasa a los avisos del mapa.
10. **Accesibilidad:** cada chincheta es un botón con etiqueta «Guadarrama, 82, muy bueno»; cada fila es un enlace; el nivel se lee por palabra y barras, no solo por color; el contorno no aporta significado. El orden de tabulación sigue siendo buscador, chips, botones, hoja, mapa.
11. **Diario desde el mapa:** el botón «Diario» de la hoja del monte abre la salida nueva con zona, punto y coordenadas del punto; el de la hoja de ladera, con las coordenadas de la celda, como hoy.
12. **Capa «Sitios»** y capa «Diario» siguen como capas opcionales; no se mezclan con las chinchetas de monte.

Tras la revisión del constructor (21/10/2026) se cierran además estas cinco:

13. **Manda la selección (el hash); el zoom solo decide qué chinchetas se ven.** La ruta guarda la selección explícita: nada (`#mapa`), una zona (`#mapa/<zona>`) o un monte (`#mapa/<zona>/<punto>`), y solo cambia al tocar una chincheta, una fila, una miga, una sugerencia del buscador o «atrás» (cada toque hace `pushState`; pellizcar y arrastrar **nunca** cambian la ruta). Las chinchetas dependen solo del zoom: por debajo de 9, las de zona; desde 9, las de **todos los montes visibles**, de cualquier zona, también en el nivel 3 (así se toca el monte vecino sin volver atrás). La **hoja depende solo de la selección**: sin selección, «Dónde ir»; con zona, la zona y sus montes; con monte, su ficha (o la ladera tocada). Así, si se pellizca sin tocar nada, el mapa enseña montes y la hoja sigue en «Dónde ir»: es coherente (la hoja dice lo que has elegido, el mapa lo que ves) y las migas nunca mienten. Arrastrar lejos de la zona elegida no la deselecciona. El contorno se dibuja solo para la zona seleccionada. Tocar una chincheta de zona desde cualquier nivel selecciona y encuadra esa zona; tocar una de monte, ese monte (y su zona en las migas). Consecuencia en `app.js`: un cambio de hash dentro de `#mapa…` no debe mover el foco a la raíz ni hacer `scrollTo`; el mapa mueve el foco él mismo al título de la hoja solo tras un toque explícito.
14. **Barra de días: una lista, y lo que no exista en una fuente sale como «sin datos».** La barra enseña los días del índice cuando hay índice (como hoy) y, si no, los de la meteo (hoy y 7 días, como «Hoy»). Para cada fecha, las chinchetas y las listas se calculan con el desplazamiento `d = fecha − meteo.hoy`; si `d` queda fuera de 0..7 (meteo caducada o fecha fuera de su horizonte), la chincheta y la fila salen **«sin datos»** («?»), nunca con una nota de otro día; las manchas de una fecha que no está en el índice no se pintan y el aviso actual lo dice. La meteo caducada ya no esconde la barra: se avisa («con los últimos datos, del día X») y se calcula lo que se pueda. Esto cambia a propósito lo que hace «Hoy» con meteo caducada (enseña el día 0 de la tanda vieja bajo «Hoy»): aquí «Hoy» usa el día de la tanda vieja que **corresponde a la fecha de hoy** (su previsión a +1 si la tanda es de ayer), que es lo que el usuario espera leer y lo que pintan las manchas. La conversión fecha→desplazamiento va en una función pura con prueba.
15. **La hoja es una región fija, no un diálogo.** Pasa de `role="dialog"` a una región permanente con tres estados: **recogida** (solo el asa, la barra de días y una línea de título: «Dónde ir hoy · 12 zonas», «Guadarrama · Muy bueno 82», «Pinar de Valsaín · 82»), **resumen** (lo descrito en §2, unas tres filas o la ficha corta; el mapa sigue viéndose por encima) y **completa** (toda la lista o el detalle, con desplazamiento interno). Nunca se cierra del todo; arrastrar hacia abajo la recoge. El foco solo va al título de la hoja tras un toque explícito (chincheta, fila, mancha, sugerencia), nunca al cambiar el zoom ni al llegar la meteo. Es un cambio de contrato de `js/mapa/hoja.js` y de `docs/diseno.md` (componente `.hoja`): se documenta. La zona prohibida es otro contenido de la misma región (variante roja, con la norma), no una segunda hoja encima; tocar fuera vuelve al contenido de la selección.
16. **«Más» abre Zona con el punto elegido mediante una ruta nueva**, `#zona/<zona>/<punto>`, que solo fija el punto desplegado (`ui.punto`); es el único cambio en Zona además de «‹ Mapa». El día y el chip **no** viajan: Zona enseña su vista de siempre (hoy). Por eso la ficha del monte en la hoja dice el día cuando no es hoy («previsión a +2 días») y la frase «la misma que enseña Zona» de la decisión 3 vale para hoy y «Mejor hoy».
17. **Nombre corto de los montes: campo nuevo `corto` en los 50 puntos de `data/zonas.json`** («Valsaín», «Morcuera», «Canencia», «Pinar Grande», «Gorbeia»…), 18 caracteres como mucho y único dentro de su zona, exigido por `scripts/validar-datos.mjs`. Es lo que llevan chincheta y migas; el nombre completo sigue en la ficha. Lo rellena el constructor a partir del nombre actual y del pueblo entre paréntesis; donde dude, el nombre del monte mejor que el del pueblo.

Y notas menores para el plan, de esa misma revisión: los chips de grupo (p. ej. «Boletus» agrupa varias especies) se pasan a `calcularZona` como conjunto de ids, no como una sola; los chips se enseñan también sin índice (ahora filtran chinchetas y listas); la chincheta de zona va en el centroide de sus puntos recogibles; las filas NO IR van al final, grises, con su rótulo; `urlNuevaSalida` admite el punto; las pruebas que importan de `js/pantallas/hoy.js` pasan al módulo compartido; `crearMapa` de `js/mapa.js` lo usa también el diario (quitar rectángulos y modo de puntos no le afecta); las etiquetas del nivel 3 recalculan `notaCelda` para las tres celdas elegidas (el pintor devuelve notas, no especie).

## 5. Restricciones

- Vanilla JS con módulos, sin empaquetador, servido por GitHub Pages; Leaflet 1.9.4 desde cdnjs; despliegue con `git push` a `main` (gancho pre-push `npm run comprobar`: pruebas + validador de datos).
- Tokens y componentes de `docs/diseno.md`: cuaderno de campo, semáforo con palabra y barras, bisel doble en la pieza principal (la hoja), isla de navegación, `prefers-reduced-motion`. Cualquier color nuevo pasa por `node scripts/contraste.mjs`.
- Nada numérico sin `semaforo()`/`nivelDe()`; nunca una nota sin datos.
- El cálculo pesado sigue en el Web Worker del pintor; las chinchetas y listas se calculan en el hilo principal con lo que ya hay (`estado.meteo`).
- Pruebas con `node --test` en `tests/`; lo nuevo con lógica (nivel por zoom, orden de montes, rutas, mezcla de resultados de búsqueda, colocación de etiquetas, modelo de la hoja por nivel) lleva su prueba.
- Idioma de UI, código y documentación: español.

## 6. Cómo encaja en el código (orientación, no plan)

- `js/app.js`: ruta por defecto y `#hoy` → `#mapa`; `SECCION` sin `hoy`; `PINTAN_METEO` sigue con `mapa` y `zona`.
- `index.html`: barra de cuatro secciones; logo a `#mapa`.
- `js/pantallas/hoy.js` → las funciones compartidas (`calcularZona`, `ordenarZonas`, frase, `textoFaltan`, `haceCuanto`) pasan a un módulo sin DOM de pantalla (p. ej. `js/zonas-hoy.js` o `js/ui/filas-zona.js`); `js/mapa/hoja.js` deja de importar de una pantalla.
- `js/pantallas/mapa.js`: estado de nivel (`{ nivel, zona, punto }`) derivado del hash y del zoom; capa de chinchetas (`L.marker` con `divIcon`, botón dentro); contorno de zona (polígono suave a partir del bbox, o la envolvente de sus celdas con monte si el constructor la tiene a mano; discontinuo, sin relleno); etiquetas de manchas; la hoja por nivel.
- `js/mapa/hoja.js`: región fija con tres estados (recogida, resumen, completa) y tres modelos nuevos (`listaZonas`, `zona`, `monte`) además de la celda y `prohibido`; la barra de días dentro.
- `js/mapa/controles.js`: buscador con fuente externa asíncrona y migas.
- `js/mapa.js`: se van `estiloPunto`, los rectángulos y el popup de punto.
- `js/pantallas/zona.js`: «‹ Mapa» y la ruta `#zona/<zona>/<punto>`.
- `data/zonas.json` y `scripts/validar-datos.mjs`: campo `corto` en los puntos.
- Documentación: `README.md`, `docs/diseno.md` (tabla de componentes y barra de navegación), este diseño.

## 7. Lo que queda al constructor

- Los umbrales exactos de zoom por nivel y los encuadres (márgenes para que nada quede bajo la hoja ni el buscador).
- La forma del contorno de zona (bbox suavizado o envolvente) y su trazo, dentro de «fino, discontinuo, sin relleno».
- El algoritmo de colocación de etiquetas y la separación mínima.
- Cómo se muestran las migas en el buscador sin perder el campo de texto (p. ej. chip dentro del campo, o línea sobre él).
- Qué se cachea del geocodificador (sugerencias recientes en memoria) y los límites de peticiones.
- Las pruebas concretas y las capturas para `capturas/`.

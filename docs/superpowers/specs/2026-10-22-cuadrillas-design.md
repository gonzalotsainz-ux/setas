# Cuadrillas: cuentas de Google, grupos abiertos por dentro, sitios vigilados y ficha de temporada

Fecha: 2026-10-22 · Estado: aprobado en conversación por la usuaria; revisado por el constructor (3 preguntas resueltas en §13)
Sustituye a `2026-10-02-grupos-design.md` en lo que choca; lo que no se menciona aquí sigue valiendo de aquella.

## 1. Intención y por qué

Setas pasa de app familiar a **producto**: que la use gente que no conocemos, en cuadrillas de amigos. La medida de
éxito es una sola: **que la gente apunte cada salida.** Todo lo demás (grupos, sitios vigilados, ficha de temporada)
existe para empujar a apuntar.

El razonamiento del enganche, en orden:

1. Apuntas una salida en un punto → ese punto pasa a ser un **sitio vigilado** tuyo.
2. Al abrir la app ves **qué sitios tuyos están hoy en buen momento**. Sin salidas apuntadas, esa lista está vacía y
   te lo dice: el beneficio es proporcional a lo que apuntas.
3. Con más salidas, cada sitio enseña **su historial** junto a los datos de hoy («aquí te salió el 12/10/2025 con
   38 mm en 26 días»): la app no aprende sola, pero tú sí.
4. Tus salidas las **ve tu cuadrilla** (muro y mapa del grupo): hay un público que nota si has ido.
5. Al final del año, la **ficha de temporada** resume kilos, especies, salidas y sitios, y se comparte como imagen.

### Decisiones de la usuaria (2026-10-22)

- Sin cuenta se ve lo de siempre: mapa, índice, zonas, montes, especies. **Diario y grupos piden cuenta.**
- Entrada con **Google**. Nada de contraseñas ni códigos de recuperación.
- Cualquiera crea un grupo e invita por enlace; el administrador puede expulsar (como ya está en la rama `grupos`).
- **Todo lo del grupo es del grupo:** si estás dentro ves todas las salidas y todos los sitios de todos. No se elige
  salida a salida ni hay «solo la zona». La confianza se da al entrar.
- Dentro del grupo se comparten salidas, sitios y charla sobre las salidas.
- Los avisos de sitios vigilados son **solo dentro de la app**. Sin notificaciones push ni correos.
- El grupo ve las salidas de dos maneras: **muro** cronológico para enterarse y **mapa** para decidir a dónde ir.
- Vuestro diario actual pasa a ser el grupo «familia» con vuestras dos cuentas.
- Se **reutiliza la rama `grupos`** (22 commits del 2 de octubre, nunca desplegada) y se adapta.
- Orden de construcción: (1) cuentas y grupos, (2) sitios vigilados, (3) muro y ficha de temporada.

### Lo que la haría un fracaso aunque funcione (anti-metas)

- **Que se filtren sitios** fuera de la cuadrilla.
- **Que se vuelva pesada o fea:** formularios largos, permisos nada más abrir, cosas encima del mapa.
- **Que cueste dinero mantenerla** con pocos usuarios.

### Metas y no-metas

**Metas:** apuntar una salida cuesta lo mismo que hoy o menos; un sitio vigilado se ve en buen momento sin tocar nada;
un grupo nuevo está en marcha en un minuto (crear, copiar enlace, pegarlo en WhatsApp); vuestras salidas de hoy no se
pierden ni se exponen.

**No-metas (fuera de esta fase):** notificaciones push, correos, grupos públicos por zona, «me gusta» o seguidores,
chat libre del grupo, cobro o planes de pago, identificación por foto, «solo la zona», salidas privadas dentro de un
grupo, exportar o importar sitios, umbrales por usuario (`ajustes_umbrales` sigue compartido como hoy), aprendizaje
automático sobre el historial.

## 2. Cuentas

- **Google con Supabase Auth, sin salir de la página:** botón de Google Identity Services (script
  `accounts.google.com/gsi/client`, cargado solo en la pantalla de entrada) que devuelve un *ID token*, y
  `supabase.auth.signInWithIdToken({ provider: 'google', token })`. La sesión la persiste supabase-js en localStorage.
  Motivo: la app se instala como PWA (`display: standalone`) y en iPhone el flujo por redirección
  (`signInWithOAuth`) puede volver a Safari en vez de a la app instalada. **Esto no está comprobado:** GIS en una
  PWA instalada de iPhone también puede abrir su ventana en Safari. Por eso la **primera tarea** del trabajo de
  cuentas es una prueba desechable en un iPhone con la app instalada: si GIS entra y la sesión queda en la app, es
  el camino; si no, se pasa a la redirección y se documenta aquí el resultado. En ambos casos, antes de salir a
  Google se guarda la ruta pendiente (p. ej. `#unirse/CODIGO`) y se restaura al volver. *Decisión del documento
  tras la revisión del constructor.* No hay otra forma de entrar.
- **Requisito previo (lo hace la usuaria o Gonzalo en los paneles, no el código):** cliente OAuth en Google Cloud
  con orígenes autorizados `https://gonzalotsainz-ux.github.io` y `http://localhost:8080`, y la pantalla de
  consentimiento **publicada** (en modo «pruebas» solo entran los correos dados de alta como probadores, y queremos
  gente que no conocemos); en Supabase, proveedor Google activado con ese ID de cliente y, para el respaldo por
  redirección, «Redirect URLs» `https://gonzalotsainz-ux.github.io/setas/` y `http://localhost:8080/`. Se documenta
  en `docs/supabase.md` igual que la rama documentaba «Anonymous sign-ins». «Anonymous sign-ins» **no** hace falta.
- **Perfil** (`perfiles`): `id` = `auth.uid()`, `nombre` visible (por defecto el nombre de Google, editable en
  Ajustes), `creado`. Desaparecen `hash_recuperacion`, `recuperar_cuenta`, `regenerar_recuperacion` y la UI del
  código de recuperación. `intentos_codigo` y `limitar_intentos` se quedan: los usa `unirse_grupo`.
- Primera entrada: tras Google, una hoja pide confirmar el nombre visible (prellenado) y crea el perfil. Nada más.
- **Qué se guarda de cada persona:** Google da correo y nombre; el correo solo vive en `auth.users` (nunca se enseña a
  otros miembros ni se copia a tablas públicas). Ajustes → «Mi cuenta» dice esto en dos frases.
- **Borrar mi cuenta** (Ajustes): función del servidor que borra salidas, fotos, sitios, comentarios y pertenencias y
  el usuario de Auth. Si era el único administrador de un grupo con más gente, se le pide antes nombrar sucesor o
  borrar el grupo (misma regla que `salir_grupo`). *Decisión del documento: un producto con login de Google necesita
  salida limpia; no se ha discutido con la usuaria.*
- Sin sesión: Diario y Grupos muestran una pantalla corta con el botón de Google y una frase de qué ganas. Mapa,
  zonas y especies siguen funcionando igual que hoy, sin pedir nada.

## 3. Grupos

Se mantiene lo construido en la rama: `grupos`, `miembros`, roles `admin`/`miembro`, código de invitación de 8
caracteres regenerable, enlace `…/setas/#unirse/CODIGO`, `max_miembros_grupo() = 20`, tope de 10 grupos creados por
persona, expulsar, salir, nombrar administrador, borrar grupo, nunca un grupo sin administrador, límite de intentos
en `unirse_grupo`.

**Cambia la visibilidad.** Se eliminan `salida_grupos`, `compartir_salida`, el selector de grupos al guardar y el
campo `ubicacion_exacta`. La regla pasa a ser: **un miembro del grupo ve todas las salidas, sitios y comentarios de
quienes son miembros en ese momento.** `salidas_del_grupo(p_grupo)` devuelve las salidas cuyo dueño está en
`miembros` del grupo (con `lat`, `lon`, especies, kilos, notas, fotos firmadas, nombre del autor; sin `meteo` ni
`indice`, para que el muro paginado pese poco). El historial de un sitio va por `salidas_del_sitio(p_sitio)`, que
para el dueño y para los miembros de sus grupos **sí** devuelve `meteo` e `indice` de cada salida: el motivo de
taparlos en la rama era «solo la zona» (`meteo.punto` delataba la ubicación) y ya no existe. La prueba de
`tests/sql/compartir.test.sql` que exige que vayan nulos se reescribe. Lo mismo para `sitios_del_grupo`.

- Si alguien sale o es expulsado, **sus salidas y sitios dejan de verse en ese grupo** en el acto, porque la lectura
  va por pertenencia. Sus comentarios en salidas ajenas se quedan, con su nombre.
- Estar en varios grupos: cada grupo ve lo mío entero. No hay nada que elegir.
- Contra las filtraciones, lo único que hay es: a quién invitas, el tope de 20, que el administrador pueda expulsar y
  regenerar el enlace, que no haya exportar ni copiar sitios a otro grupo, y que el mapa del grupo no ofrezca
  descargar nada. Una captura de pantalla no se puede impedir; Ajustes → «Mi cuenta» lo dice tal cual.

**Pantallas** (las de la rama, retocadas): `#grupos` lista mis grupos; `#grupos/<id>` es **la página del grupo**:
nombre, miembros, enlace de invitación (admin), y el **muro** (§6). `#unirse/<codigo>` como en la rama. Siguen
colgando de la sección «Diario» de la barra (no hay pestaña nueva).

## 4. Sitios

Nuevo concepto. Hoy una salida lleva un punto suelto (`lat`, `lon`); a partir de ahora el punto se guarda como
**sitio** reutilizable y la salida apunta a él.

- Tabla `sitios`: `id`, `usuario_id` (dueño), `nombre` (1–40 caracteres), `lat`, `lon`, `zona_id`, `creado`. RLS: solo
  el dueño lee y escribe la tabla; el grupo lee por `sitios_del_grupo`.
- `salidas` gana `sitio_id` (nulo permitido: salidas sin punto siguen existiendo, como hoy, y no vigilan nada).
- **Los sitios nacen de las salidas.** Al guardar una salida con punto, la app busca entre mis sitios uno a menos de
  150 m y lo propone («¿Es El Robledal?»); si no hay, crea uno con el nombre que escriba la persona o, si lo deja en
  blanco, el nombre del monte de la rejilla (`r.cabecera` / `corto` del punto más cercano) seguido de un número. Un
  sitio se puede renombrar y borrar desde su ficha; borrarlo no borra las salidas (se quedan sin `sitio_id` pero con
  su `lat`/`lon`). *Decisión del documento: no hay «crear sitio» suelto desde el mapa en esta fase; el único camino es
  apuntar una salida, que es justo el comportamiento que queremos empujar.*
- **Migración:** cada salida existente con punto genera su sitio (agrupando las del mismo autor a menos de 150 m),
  en la misma migración que asigna dueños (§8).
- **Ficha del sitio** (`#sitio/<id>`): nombre, zona y monte, el semáforo de hoy y de los días de previsión
  disponibles, y el **historial**: lista de salidas en ese sitio con fecha, especies, kilos y la lluvia de 26 días
  que había ese día (`salida.indice`/`salida.meteo`, que ya se guardan al apuntar; llegan por `salidas_del_sitio`,
  §3). Si el sitio es de otro miembro del grupo, se ve lo mismo, lluvia incluida, salvo editar.

## 5. Sitios vigilados («tus sitios hoy»)

- **Qué es «en buen momento»:** el mismo cálculo que hace el mapa para la ladera donde cae el sitio
  (`notaDeLadera` en `js/mapa/toque-celda.js`: celda fina de 250 m → archivo de rejilla → `notaCelda` con los
  agregados de la celda gruesa de `indice/ultimo.json`). Nivel con `nivelDe` de `js/ui/semaforo.js`; «en buen momento»
  = `bueno` o `muy-bueno`. Así la lista y la mancha del mapa dicen lo mismo. Si el sitio cae fuera de celda con monte
  (sin código) o fuera de las rejillas, se usa el índice del punto de zona más cercano (`fotoFijaDelDia` /
  `puntoMasCercano`, como ya hace el diario al guardar), y la ficha lo dice («calculado con el punto X de la zona»).
- **Todo en el móvil:** cero llamadas nuevas a Open-Meteo ni a Supabase; se reutilizan `cargarIndice` (caché de 3 h)
  y el cargador de rejillas (una descarga por archivo, los sitios de una persona se concentran en pocos archivos).
  Con el índice caducado o sin publicar se enseña el aviso que ya existe (`avisoIndice`) y la lista queda en «sin
  datos», nunca en silencio.
- **Dónde se ve:**
  - **Diario** empieza con el bloque **«Tus sitios hoy»**: los sitios en buen momento primero (nombre, zona,
    semáforo, última vez que fuiste), luego el resto plegados. Sin sitios: «Apunta una salida con punto y la app
    vigilará ese sitio por ti». Cada fila abre la ficha del sitio. Incluye, en pequeño, los sitios de mis grupos
    que estén en buen momento, marcados con el nombre del dueño.
  - **Mapa:** mis sitios y los de mis grupos se pintan como **chinchetas pequeñas** propias (icono distinto de los
    montes investigados, color del semáforo de hoy, los míos con borde y los del grupo sin él), visibles desde el
    nivel de montes (zoom ≥ `ZOOM_MIN_FINA`). Tocar una abre un **popup de Leaflet** con nombre, dueño, semáforo y
    última salida, y un enlace a la ficha. Nada fijo encima del mapa, ningún recuadro, ninguna lista: es la regla
    del mapa limpio del 2026-10-21.
  - **Pestaña Diario con un punto** en el icono cuando hay algún sitio mío en buen momento. *Decisión del documento:
    la usuaria pidió verlo «al abrir la app»; como la app abre en el mapa y no quiere nada encima, el aviso al abrir
    son las chinchetas coloreadas y el punto en la pestaña, y el detalle está en Diario. Si prefiere que la app abra
    en Diario cuando hay sitios en buen momento, es un cambio de una línea en el arranque.*

## 6. Muro y comentarios

- **Muro del grupo** en `#grupos/<id>`: las salidas de los miembros actuales, de más reciente a más antigua, una
  tarjeta por salida: foto (si la hay, firmada), autor, fecha, zona y sitio, especies con kilos, notas, y los
  comentarios. Carga por páginas de 20 (`salidas_del_grupo` admite `p_antes` y `p_limite`).
- **Comentarios** por salida **y por grupo**: tabla `comentarios` (`id`, `salida_id`, `grupo_id`, `usuario_id`,
  `texto` 1–500, `creado`). Un comentario se escribe desde el muro de un grupo y **solo se ve en ese grupo**: lo leen
  los miembros actuales de ese grupo (el dueño de la salida entre ellos), lo escribe cualquiera de ellos y lo borra
  solo su autor. Si el dueño está en dos grupos, su salida tiene dos conversaciones separadas, una por grupo; en su
  propio Diario las ve ambas, con el nombre del grupo. Motivo: la confianza se da al entrar en *ese* grupo, y un
  comentario que nombre un paraje no debe cruzar a un grupo donde el comentarista no está. *Decisión del documento
  tras la revisión del constructor.* Sin «me gusta», sin reacciones, sin hilos: esto es un cuaderno, no una red
  social.
- **La charla del grupo es sobre salidas.** No hay canal de mensajes sueltos: para «mañana salimos a las 8» ya está
  WhatsApp, donde además vive el enlace de invitación. *Decisión del documento.*
- Mi **Diario** sigue siendo la lista de lo mío (como en la rama), ahora con el bloque de sitios arriba y el enlace
  a la ficha de temporada.

## 7. Ficha de temporada

- `#temporada/<año>`: temporada = año natural (otoño y primavera del mismo año en una ficha). Contenido: kilos
  totales, salidas, especies con kilos (de más a menos), sitios distintos, mejor día (fecha, sitio, kilos), primera y
  última salida, y comparativa con el año anterior (kilos y salidas, flechas). Sin gráficas complicadas: el cuaderno
  de campo de `docs/diseno.md`.
- **Compartir como imagen:** botón que pinta la ficha en un `<canvas>` (1080 × 1350, fondo del tema claro, logo) y la
  entrega con `navigator.share` (ficheros) o descarga PNG si no hay Web Share. La imagen **no lleva coordenadas ni
  nombres de sitios**, solo zonas y números: es para presumir fuera de la cuadrilla sin regalar nada.
- Todo calculado en el móvil a partir de `listarSalidas`; no hay tablas ni funciones nuevas.

## 8. Migración desde lo que hay en producción

Lo que hay desplegado es `main` (sin cuentas). La rama `grupos` nunca se desplegó, así que sus migraciones
`20261005000000_cuentas`, `20261005000100_grupos`, `20261005000200_compartir` y la pendiente
`20261006000000_cerrar_acceso_abierto` **no están aplicadas y se pueden reescribir** con sus mismos nombres (la regla
de «no editar una aplicada» no las alcanza). Antes de tocar nada, confirmar con `supabase migration list` qué hay
aplicado en el proyecto, incluida `20261004000100_lluvia_ultima_hora`, que `docs/supabase.md` daba por pendiente.

Orden de despliegue (el mismo esquema que la rama, con Google en vez de anónimo):

1. Paneles: proveedor Google en Supabase y cliente OAuth en Google Cloud (requisito previo, §2).
2. Migraciones nuevas: perfiles sin código, grupos, sitios, comentarios, `usuario_id` en `salidas`,
   `reclamar_salidas` por nombre de autor (genera también los sitios del reclamante). Las políticas abiertas de
   `salidas`/`fotos` siguen activas en este paso.
3. Publicar la app. Cada uno entra con Google, reclama sus salidas («¿Quién eres?» entre los `autor` existentes),
   uno crea el grupo «familia» y el otro entra por el enlace.
4. Migración de cierre (`20261006000000_cerrar_acceso_abierto`, con el guardia que aborta si queda alguna salida sin
   dueño): fuera políticas abiertas, bucket `fotos` privado con URLs firmadas (rutas sin cambiar, como decidió la
   rama), fuera acceso de `anon` a `salidas` y `fotos`.

La ventana entre 2 y 4 es de minutos y solo hay dos personas: se hace el mismo día.

## 9. Datos y seguridad (resumen para el constructor)

| Tabla | Cambio respecto a la rama |
|---|---|
| `perfiles` | fuera `hash_recuperacion`; `nombre` por defecto el de Google |
| `grupos`, `miembros`, `intentos_codigo` | igual |
| `salida_grupos` | **se elimina** |
| `salidas` | `usuario_id` (como la rama) + `sitio_id` nuevo |
| `sitios` | nueva (§4) |
| `comentarios` | nueva (§6), con `grupo_id` |

Reglas: las tablas base (`salidas`, `fotos`, `sitios`, `comentarios`) solo las lee y escribe su dueño por RLS; el
grupo lee por funciones `security definer` con `search_path` fijado (`salidas_del_grupo`, `sitios_del_grupo`,
`salidas_del_sitio`, `comentarios_de_salida(p_salida, p_grupo)`) que comprueban `es_miembro` del grupo en cuestión y,
para sitios y salidas, que el dueño siga siendo miembro. `puede_ver_foto` pasa a mirar pertenencia al grupo del dueño
en vez de `salida_grupos`. Todas las escrituras de grupos, sitios compartidos y comentarios van por funciones del
servidor. Las funciones auxiliares no se exponen a `anon`.

Coste: todo cabe en el plan gratuito de Supabase a esta escala. El primer límite real serán las **fotos** (1 GB de
almacenamiento): se mantienen el presupuesto por borrador (`PRESUPUESTO`) y el tamaño máximo de 1600 px, y se apunta
en `docs/supabase.md` que ese es el primer indicador a vigilar si la app crece. Google OAuth no cuesta nada.

## 10. Puesta al día de la rama

La rama `grupos` nació de `fccbee7` y `main` ha avanzado 79 ficheros (mapa por niveles, mapa limpio). Primer paso del
plan: traer `main` a `grupos` (merge, no rebase: los commits ya tienen sesión apuntada) y dejar la suite en verde
(`npm run comprobar`: 669 pruebas en `main` + las de la rama; `npm run probar:sql` con Docker). Los choques
previsibles están en `js/pantallas/mapa.js` (la rama solo toca 4 líneas) y `css/componentes.css`. Se despliega
**solo desde `main`** tras fusionar, como siempre.

## 11. Pruebas

- SQL (Docker, como la rama): un no miembro no ve salidas, sitios ni comentarios; un expulsado deja de ver todo lo
  del expulsado en el acto; un miembro no lee las tablas base; un comentario escrito en el grupo A no se ve desde el
  grupo B aunque el dueño esté en ambos; `salidas_del_sitio` devuelve `meteo` e `indice` a un miembro y nada a un no
  miembro; solo el autor borra su comentario; `reclamar_salidas`
  crea los sitios agrupando a 150 m; el guardia de cierre aborta con salidas sin dueño; borrar cuenta deja limpio y
  respeta la regla del administrador único.
- Cliente (`node --test`): nivel de un sitio = nivel de la ladera del mapa para el mismo punto y día; sitio fuera de
  rejilla usa el punto de zona; lista «Tus sitios hoy» con índice caducado enseña el aviso; propuesta de sitio
  existente a menos de 150 m; ficha de temporada con año sin salidas y con comparativa; imagen compartida sin
  coordenadas.
- Recorridos manuales con Chrome contra la API simulada (`page.route`), nunca contra Open-Meteo real.

## 12. Lo que queda al constructor

- Esquema exacto de `sitios_del_grupo`, `comentarios_de_salida` y la paginación del muro.
- Cómo se cachean las notas de los sitios entre pantallas (Diario y mapa deben compartir el cálculo).
- Diseño de la chincheta de sitio y del punto en la pestaña, dentro de los tokens de `docs/diseno.md`.
- Composición de la imagen de temporada.
- Cómo se dibuja el estado «sin sesión» en Diario y Grupos.
- Qué pasa con un borrador offline guardado antes de entrar con Google (propuesta: se sube al entrar, como ya hace
  la cola de borradores de la rama).

## 13. Decisiones tomadas en este documento (no discutidas con la usuaria)

1. Borrar cuenta desde Ajustes (§2).
2. Los sitios nacen solo de salidas; no hay «crear sitio» desde el mapa (§4).
3. Sitios a menos de 150 m se consideran el mismo (§4).
4. El aviso «al abrir» son chinchetas coloreadas y punto en la pestaña; el detalle vive en Diario (§5).
5. Comentarios por salida sí; chat del grupo y reacciones no (§6).
6. Temporada = año natural; la imagen compartida no lleva sitios ni coordenadas (§7).
7. Las migraciones no aplicadas de la rama se reescriben con sus nombres (§8).
8. Merge de `main` en `grupos`, no rebase (§10).

Tras la revisión del constructor (2026-10-22):

9. Entrada con Google Identity Services + `signInWithIdToken` como camino preferido, **pendiente de una prueba en un
   iPhone con la app instalada** (primera tarea de cuentas); si falla, redirección. La pantalla de consentimiento de
   Google debe estar publicada (§2).
10. El historial de un sitio enseña la lluvia de cada salida también a los miembros del grupo: `salidas_del_sitio`
    devuelve `meteo` e `indice`; el muro no (§3, §4).
11. Los comentarios van por salida y grupo: no cruzan de un grupo a otro (§6).

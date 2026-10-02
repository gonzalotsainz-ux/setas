# Grupos de amigos: cuentas, visibilidad y recuperación

Fecha: 2026-10-02 · Estado: pendiente de revisión por la usuaria

## 1. Objetivo y alcance

Permitir que grupos de amigos compartan sus salidas (hallazgos) dentro de la app sin exponerlas al resto del mundo. Los aficionados son recelosos con sus sitios: entre amigos se comparte, con desconocidos no.

Es la primera fase del plan de rentabilidad (brainstorming 2026-10-02). **Los grupos son gratuitos por ahora.** El tope de miembros por grupo es una constante (`MAX_MIEMBROS_GRUPO = 20`) para poder ligarlo a un plan de pago más adelante.

**Dentro:** identidad por dispositivo, código de recuperación, grupos con código de invitación, visibilidad por salida (privada o con grupos) con ubicación exacta o solo zona, fotos privadas, migración de las salidas actuales.

**Fuera (YAGNI):** cobro, correo opcional, salidas públicas, marketplace de sitios, identificación por foto, ajustes de umbrales por usuario (siguen compartidos como hoy).

**Decisión anterior que se revierte:** el 2026-09-30 la usuaria decidió «sin login». Para los grupos hace falta saber quién es cada persona, así que las salidas pasan a tener dueño. Se mantiene la entrada sin correo ni contraseña.

**No cambia:** zonas, sitios investigados, índice, mapa y meteo siguen siendo públicos para todos.

## 2. Identidad y recuperación

- Al abrir la app por primera vez se crea una **sesión anónima de Supabase** (hay que activar «Anonymous sign-ins» en el proyecto) y se pide un nombre visible (el actual `autor`). El `auth.uid()` es la base de todas las reglas de privacidad.
- Se crea una fila en `perfiles` con el nombre y el **hash** del código de recuperación.
- **Código de recuperación:** formato `XXXX-XXXX-XXXX-XXXX` (~80 bits, alfabeto sin caracteres ambiguos). Se muestra una sola vez al crear el perfil, con botones de copiar y compartir. Se puede regenerar desde Ajustes (el anterior queda invalidado). Solo se guarda su hash.
- **Cambio de móvil:** «Ya tengo cuenta» pide el código. Una función del servidor (`recuperar_cuenta`) crea la sesión nueva y **traspasa del identificador antiguo al nuevo** el perfil, las pertenencias a grupos, las salidas y las fotos. El dispositivo antiguo queda sin acceso.
- **Fuerza bruta:** la función limita los intentos por código y por IP y registra los fallos.
- Aviso al usuario: quien tenga el código tiene la cuenta; hay que guardarlo bien.

## 3. Grupos

- Cualquiera puede crear un grupo con un nombre y queda como **administrador**.
- **Código de invitación** de 8 caracteres, compartible como texto o enlace (`…/setas/#unirse=CODIGO`). El administrador puede regenerarlo; el anterior deja de valer. La función `unirse_grupo` limita intentos.
- Roles: **administrador** (renombra, expulsa, regenera el código, nombra a otro administrador, borra el grupo) y **miembro** (ve lo compartido, comparte lo suyo, puede salir). Un grupo siempre tiene al menos un administrador: el último no puede salir sin nombrar sucesor o borrar el grupo.
- Un usuario puede estar en varios grupos.
- Tope de miembros: `MAX_MIEMBROS_GRUPO`.

## 4. Visibilidad de las salidas

- Cada salida es **privada** por defecto. Al guardarla (o después) se elige con qué grupos se comparte: uno, varios o ninguno.
- Por cada grupo con el que se comparte se elige la **ubicación**: «punto exacto» (por defecto) o «solo la zona».
- Lo que ve el grupo: fecha, zona, ubicación (según la elección), especies y kilos, notas y fotos.
- Solo el autor edita o borra su salida. El administrador del grupo solo puede expulsar, no modificar lo ajeno.
- Si un miembro sale o es expulsado, **sus salidas dejan de verse en ese grupo** (siguen siendo suyas).

## 5. Datos y seguridad

**Tablas nuevas**

| Tabla | Contenido |
|---|---|
| `perfiles` | `id` (= `auth.uid()`), `nombre`, `hash_recuperacion`, `creado` |
| `grupos` | `id`, `nombre`, `codigo_invitacion`, `creado_por`, `creado` |
| `miembros` | `grupo_id`, `usuario_id`, `rol` (`admin`/`miembro`), `alta` |
| `salida_grupos` | `salida_id`, `grupo_id`, `ubicacion_exacta` (bool) |

`salidas` gana `usuario_id` (dueño). `fotos` hereda el dueño de su salida.

**Reglas**
- La tabla base `salidas` (y `fotos`) solo la lee y escribe su **dueño**.
- Los miembros de un grupo leen lo compartido por una **vista o función del servidor**, no por la tabla. Cuando `ubicacion_exacta` es falso, el servidor devuelve `lat` y `lon` nulos: las reglas por fila no pueden ocultar columnas, y así la protección no depende del cliente.
- Funciones auxiliares `es_miembro(grupo)` y `es_admin(grupo)` (security definer, `search_path` fijado) para no repetir lógica.
- Las tablas `grupos`, `miembros`, `salida_grupos` y `perfiles` solo se modifican a través de funciones del servidor con las comprobaciones necesarias; el acceso directo de lectura se limita a los propios miembros.
- **Fotos:** el bucket `fotos` pasa a **privado**, con rutas que incluyen el identificador del dueño y enlaces temporales firmados para quien tenga permiso (dueño o miembro de un grupo con el que se compartió la salida).
- Las funciones `unirse_grupo`, `crear_grupo`, `regenerar_codigo` y `recuperar_cuenta` limitan los intentos.

## 6. Migración desde la versión actual

1. Migración nueva (sello de tiempo mayor; no se edita ninguna ya aplicada) que añade las tablas y deja las salidas actuales **sin dueño**.
2. En el primer acceso con la versión nueva, cada persona elige «¿Quién eres?» entre los `autor` existentes y **reclama** sus salidas, que pasan a ser suyas y privadas.
3. Mientras no se reclaman, nadie las ve (no hay ventana abierta).
4. Una vez reclamadas las de las dos personas, se eliminan las políticas «abiertas» de `salidas` y `fotos` y el bucket pasa a privado. Las fotos existentes se mueven a rutas con el identificador del dueño.

Riesgo: entre el paso 1 y el 4 las políticas antiguas siguen activas; el orden de despliegue debe ser app nueva → reclamo → cierre, para no dejar sin acceso a la versión antigua en caché.

## 7. Pruebas

- Pruebas de la base de datos con varios usuarios simulados: un no miembro no ve nada; un expulsado deja de ver; «solo la zona» no filtra coordenadas (ni en notas ni en meteo derivada del punto); un no dueño no edita ni borra; un miembro no lee la tabla base; `recuperar_cuenta` traspasa todo y desconecta lo antiguo; los límites de intentos funcionan; no se puede dejar un grupo sin administrador.
- Pruebas de la app para los flujos de crear grupo, unirse por enlace, compartir una salida y recuperar cuenta.
- Se mantienen `npm run comprobar` y las 207 pruebas existentes.

## 8. Puntos abiertos para el plan

- Si la meteo y el índice guardados en la salida (`meteo`, `indice`) revelan el punto exacto cuando se comparte «solo la zona». Hay que comprobarlo y, si es así, omitirlos o generalizarlos en la vista compartida.
- Versión mínima de Supabase y comportamiento de «Anonymous sign-ins» en el plan gratuito (límites por IP).
- Cómo tratar los ajustes de umbrales (hoy abiertos) cuando exista identidad: se dejan como están en esta fase.

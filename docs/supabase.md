# Supabase

- **Proyecto:** `ctgedeunquvmcfqsufjj` (`https://ctgedeunquvmcfqsufjj.supabase.co`), cuenta de Gonzalo, plan gratuito.
- **Se entra con Google; el diario queda abierto hasta la migración de cierre (ver «Cuentas y grupos» al final).** Hasta entonces
  cualquiera con la URL de la web puede leer y editar el diario (salidas, fotos, umbrales). La clave publicable (`sb_publishable_…`)
  está en `js/config.js` (la reexporta `js/supabase.js`) y es pública por diseño. Las salidas anteriores a las cuentas llevan como
  autor el nombre elegido en el dispositivo (`elegirAutor`) y se reclaman desde el Diario.
- `aemet_cache` tiene RLS sin políticas: solo la Edge Function (Tarea 18) la usa, con la clave de servicio.

## Aplicar migraciones

El *access token* personal se pasa solo como variable de entorno del comando; nunca se escribe en el repo,
en documentos ni en commits:

```bash
export SUPABASE_ACCESS_TOKEN=<token>      # solo en esa terminal
npx --yes supabase@latest link --project-ref ctgedeunquvmcfqsufjj
npx --yes supabase@latest db push
```

Las migraciones están en `supabase/migrations/`. Para cambios nuevos, crea un fichero con un sello de tiempo
mayor (no edites uno ya aplicado). `npx supabase@latest db query --linked "<sql>"` sirve para consultas puntuales.

## Claves

- La **clave de servicio** (`service_role`) y el *access token* **nunca** van al repo. La clave de servicio solo
  se configura como secreto de la Edge Function (`supabase secrets set`).
- La usuaria prevé **revocar el access token** al terminar la puesta en marcha (Supabase → Account → Access Tokens);
  para volver a aplicar migraciones habrá que crear otro.

## Cliente

`js/supabase.js` exporta `supabase`, `SUPABASE_URL`, `SUPABASE_ANON`, `autorActual()` y `elegirAutor(nombre)`
(localStorage, `null` si no está disponible). Versión fijada de `@supabase/supabase-js`: 2.117.2 (admite las
claves `sb_publishable_`).

## Edge Function `aemet` (lluvia medida en estaciones)

- Desplegada con `--no-verify-jwt` (la clave `sb_publishable_` no es un JWT); el cliente manda `apikey`. El secreto `AEMET_API_KEY` ya está en el proyecto.
- `GET /functions/v1/aemet?estaciones=A,B&desde=YYYY-MM-DD&hasta=YYYY-MM-DD` devuelve `{ idema: { fecha: mm|null } }`.
  Solo acepta estaciones de `supabase/functions/aemet/estaciones.json` (se regenera con `node scripts/estaciones-aemet.mjs aplicar zona=ID,ID …`),
  tramo máximo de 30 días, caché de 6 h en `aemet_cache`, CORS solo para la web de la app y `http://localhost:8080`.
- `?inventario=1` devuelve el inventario de estaciones (caché de 30 días); lo usa `scripts/estaciones-aemet.mjs`.
- La app lee `indice/pluvio/ultimo.json` (Hoy y Zona, `js/pluvio.js`) y la función `rejilla` lee `indice/pluvio/celdas.json`
  al construir las series de las celdas gruesas. Si faltan, todo funciona como antes, solo con el modelo.
- Avisos: Ajustes → Créditos → «Lluvia medida en pluviómetros» dice el último día con datos de cada fuente y marca en ocre
  las que llevan más de 2 días sin dar nada (Euskalmet no, porque se rellena a mano). Cuenta días respondidos, no solo
  válidos. Si una fuente falla seguido, mirar `node scripts/pluvio/sonda.mjs` y el registro de la función.
- Licencias: SAIH Tajo, Duero y Júcar, información del sector público, reutilización con cita de la fuente (sin aviso legal propio verificado), datos
  provisionales; Euskalmet, CC BY 4.0; AEMET, citando a AEMET. Detalle: `supabase/functions/_shared/pluvio-fuentes.js`.
- Despliegue: `npx --yes supabase@2.118.0 functions deploy aemet --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj`.
- **Retraso real de AEMET (30/09/2026):** el último día diario publicado era el 27/09 (D-3) en todas las estaciones.
  Un tramo de 30 días se acepta en una sola llamada y con varias estaciones separadas por comas.
  Consecuencia: la ventana de 26 días trae como mucho 23 días medidos; se exige un mínimo de 22 y los últimos días los pone el modelo.
- Algunas estaciones del inventario no tienen datos recientes (La Pinilla, Navarredonda, San Pablo de los Montes, Pantano de la Toba, Vitoria Aeródromo).
  Navahermosa (Toledo) solo tenía 12 días, no llega al mínimo y Montes de Toledo usa el modelo.

- Estación `3104Y` (Rascafría) añadida a la lista blanca el 30/09/2026 (27 de 27 días con lluvia, último dato D-3). La app elige, para cada punto, la estación más cercana de su zona entre las de `data/zonas.json`.
- **Pendiente (tarea 19, 30/09/2026):** dar de alta `2302N` (Monterrubio de la Demanda, para `burgos`) y `3504X` Hervás, `4245X` Guadalupe,
  `3536X` Hoyos y `3576X` Valencia de Alcántara (para `extremadura`). El despliegue no se pudo hacer desde la sesión. Orden: añadirlas a
  `estaciones.json`, desplegar, `node scripts/estaciones-aemet.mjs sonda 2302N,3504X,4245X,3536X,3576X` y solo entonces meter las que tengan datos en
  `estacionesAemet` de `data/zonas.json` (si una estación de `zonas.json` no está en la lista blanca desplegada, la función responde 403 a la llamada
  entera y ninguna zona tiene lluvia medida).

- **Pendiente (fase 1 de Madrid, 02/10/2026):** `3338` Robledo de Chavela y `3330Y` Rozas de Puerto Real (zona `sierra-oeste`) ya están en
  `supabase/functions/aemet/estaciones.json`, en `supabase/functions/pluvio/estaciones.json` y en `data/zonas.json`, pero **las funciones no se han
  redesplegado** desde la sesión. Antes de publicar la web hay que desplegar `aemet` (si no, la llamada entera de la app da 403) y `pluvio`, pasar
  `node scripts/estaciones-aemet.mjs sonda 3338,3330Y` y, si alguna no tiene datos recientes, quitarla de `estacionesAemet` de `sierra-oeste`
  con `aplicar` (pasando todas las zonas). La rejilla (`gruesa.json`, 366 celdas) también cambia: hay que redesplegar `rejilla`.

## Edge Function `rejilla` (índice por ladera)

- Calcula a las 07:00 y 19:00 de Madrid los agregados del índice de cada celda gruesa (`data/rejilla/gruesa.json`) y los
  publica en el bucket público `indice` (`<sello>.json` y `ultimo.json`). Diseño: `docs/superpowers/specs/2026-10-01-mapa-indice-design.md`.
- La lanza pg_cron (`rejilla-lote-0`, a las 05, 06, 17 y 18 UTC; la función solo trabaja si en Madrid son las 07 o las 19)
  con pg_net y la cabecera `x-rejilla-clave`, que se lee de Vault (`rejilla_clave`) y coincide con el secreto `REJILLA_CLAVE`.
  Desplegada con `--no-verify-jwt`; sin la clave responde 401 y a un GET, 405.
- Tablas privadas `meteo_celdas` (meteo diaria), `clima_celdas` (climatología del suelo por mes) y `rejilla_ejecuciones`
  (un sello por ejecución, para no repetirla); vista `meteo_celdas_resumen`; función SQL `series_celdas`. Sin acceso para
  anon ni authenticated. Limpieza diaria `rejilla-limpieza` (03:30 UTC).
- Presupuesto: 500 llamadas ponderadas a Open-Meteo por ejecución (1.000 al día). Si menos del 90 % de las celdas tiene
  datos frescos, no publica y sigue valiendo el índice anterior (el móvil avisa). El primer relleno del histórico (desde el
  1 de agosto) tarda unas 6 ejecuciones (unos 3 días) en octubre y algo más desde noviembre; mientras, no hay `ultimo.json`
  y el mapa enseña los puntos de siempre.
- Forzar una ejecución: `curl -X POST -H "x-rejilla-clave: <clave>" ".../functions/v1/rejilla?forzar=1"`. El sello es la hora de
  Madrid en ese momento (`AAAA-MM-DDTHH`): fuera de las horas 07 y 19 es un sello propio, pero dentro de ellas coincide con
  el del cron y, si el cron ya corrió, contesta «repetido» y no hace nada. Para forzar, hazlo en otra hora.
  La clave no está apuntada en ningún sitio; si hace falta, se genera otra y se actualizan el secreto y Vault
  (`select vault.update_secret(id, '<nueva>') from vault.secrets where name = 'rejilla_clave'`).
- Despliegue: `npx --yes supabase@2.118.0 functions deploy rejilla --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj`.
- Desde el 2026-10-02, `rejilla` toma `pluvio/celdas.json` (si está y valida) para la lluvia pasada de cada celda gruesa.
- Desplegada el 2026-10-01 (migraciones `20261002000000_rejilla.sql` y `20261002000100_rejilla_cron.sql`); primera
  ejecución forzada el 2026-10-01 a las 17:21 de Madrid: 109 celdas rellenadas, sin publicar (relleno en curso).

## Edge Function `pluvio` (lluvia medida en pluviómetros)

- Diseño: `docs/superpowers/specs/2026-10-01-pluviometros-design.md`; plan: `docs/superpowers/plans/2026-10-02-pluviometros.md`.
- La lanza pg_cron (`pluvio-hora`, cada hora en el minuto 10 UTC) con pg_net y la cabecera `x-pluvio-clave`, que se lee de
  Vault (`pluvio_clave`) y coincide con el secreto `PLUVIO_CLAVE`. Desplegada con `--no-verify-jwt`; sin la clave responde
  401 y a un GET, 405. Usa también el secreto `AEMET_API_KEY` (el mismo de la función `aemet`).
- Qué lee y cuándo (hora UTC): AEMET horario (`/observacion/convencional/todas`, 12 h) a las 0, 3, 6…; SAIH Tajo (últimas
  24 h por estación) a la 1, 4, 7…; SAIH Tajo 10 días a las 2; SAIH Duero (últimos 4 días) por lotes, uno de 4 estaciones
  en cada hora de AEMET (lote 0 a las 0 y 12, 1 a las 3 y 15, 2 a las 6 y 18, 3 a las 9 y 21: cada estación dos veces al
  día); SAIH Júcar a las 3 y 15; el paso `publicar` (lluvia_dia y los JSON públicos) a las 4 y 16. Lista blanca:
  `supabase/functions/pluvio/estaciones.json`.
- **Límite de CPU.** El plan gratuito corta una ejecución hacia los 2 s de CPU (`WORKER_RESOURCE_LIMIT`) y 150 MB: por eso
  el Duero va por lotes y ya no hay tarea `duero90` (los 90 días del Duero en una ejecución no cabían). Medir en local cada
  tarea (red real, sin escribir en Supabase): `node --expose-gc scripts/pluvio/medir-cpu.mjs [tarea…]`; ninguna debe
  pasar de ~1,2 s. Informe: `.superpowers/sdd/2026-10-02-pluviometros/cpu-report.md`.
- **Relleno del Duero** desde el 1 de agosto (o tras una caída de más de 4 días): `PLUVIO_CLAVE=<clave> node
  scripts/pluvio/relleno-duero.mjs [--desde=2026-08-01]` lee en local con el mismo lector y sube por `?accion=cargar`
  (`--seco` solo cuenta). `?accion=cargar` admite solo Euskalmet y Duero, cada una con estaciones de su lista blanca.
- Tabla privada `lluvia_obs` (fuente, estación, hora UTC del fin del intervalo, mm, calidad); se guardan 200 días
  (`pluvio-limpieza`, 03:40 UTC). `lluvia_dia` (días revisados) se guarda 400: `publicar` toma de ella los días anteriores
  a hoy − 198 (los que `lluvia_obs` ya no tiene enteros, desde febrero) y el relleno del Júcar ya no los vuelve a pedir.
- **Migración `20261004000100_lluvia_ultima_hora.sql` (revisión final, sin aplicar):** `lluvia_por_dia` devuelve además
  `ultima` (si el día tiene la hora que acaba a las 00:00 de Madrid). Hay que aplicarla **antes** de desplegar la nueva
  `pluvio`: sin la columna, ningún día cuenta como medido y Hoy, Zona y el mapa vuelven al modelo hasta aplicarla.
  Lleva el sello 20261004000100 (justo después de `lluvia_dia`) porque el plan de grupos usa 20261005000000 y siguientes.
- Forzar una lectura: `curl -X POST -H "x-pluvio-clave: <clave>" ".../functions/v1/pluvio?fuentes=tajo10"` (y luego
  `?fuentes=aemet`; mejor por separado, comparten un único plazo). La clave no está apuntada en ningún sitio; si hace falta se
  genera otra y se actualizan el secreto y Vault.
- Despliegue: `npx --yes supabase@2.118.0 functions deploy pluvio --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj`.
- Desplegada el 2026-10-02. Primera lectura forzada ese día: SAIH Tajo, 28 estaciones y 6.748 horas desde el 22/09 a las
  09:00 UTC (398,0 mm en total); AEMET horario, 23 estaciones y 245 horas de las 12 h previas. Trabajos `pluvio-hora`
  (`10 * * * *`) y `pluvio-limpieza` (`40 3 * * *`) activos.
- **Euskalmet (Álava).** Relleno desde el histórico anual (zip de unos 100 MB, CC BY 4.0, publicado con 2 a 6 semanas de
  retraso): `PLUVIO_CLAVE=<clave> node scripts/pluvio/relleno-euskalmet.mjs --desde=2026-08-01` (sube por `?accion=cargar`;
  `--seco` solo cuenta). Repetirlo cuando Euskalmet publique un mes nuevo (se puede borrar `_fuentes/euskalmet-AAAA.zip`
  para que lo vuelva a bajar). Datos de Euskalmet / Open Data Euskadi, licencia CC BY 4.0.
- **Euskalmet en tiempo real: pendiente de clave.** La API (`https://api.euskadi.eus/euskalmet/…`) pide un JWT RS256 firmado
  con la clave privada de la usuaria (claims `aud: "met01.apikey"`, `iss`, `exp`, `iat`, `version: "1.0.0"`, `email`;
  alta en `https://api.euskadi.eus/opendata-apikey/`). Cuando la haya: guardarla como secreto (`EUSKALMET_CLAVE_PRIVADA`,
  nunca en el repo), probar las rutas de lecturas, y añadir en `manejador.js` una tarea `euskalmet` que firme el JWT y
  entregue las lecturas de 10 minutos a `horasDeLecturas` (`lectores/euskalmet.js`); el resto no cambia.
- Relleno y primera publicación: 2026-10-02. Duero (16 estaciones, 22.821 horas desde el 01/08) y Euskalmet (28
  estaciones, 20.595 horas de agosto, zip anual) subidos desde local con `?accion=cargar`; Júcar rellenado con 5 lecturas
  forzadas. Primera `publicar`: 2.521 días-estación, 49 puntos con lluvia medida (sin estación cercana: Navalucillos,
  Salorino y Villuercas), 158 celdas gruesas; `ultimo.json` 33 KB. Álava en septiembre queda estimada con el modelo hasta
  que Euskalmet publique el mes o haya clave de su API. Para diagnosticar: `?fuentes=<tarea>&sincrono=1` con la clave
  devuelve el resumen de la ejecución (también va al registro de la función).

## Cuentas y grupos (2026-10)

Spec: `docs/superpowers/specs/2026-10-22-cuadrillas-design.md` (sustituye a la del 2026-10-02). Plan de la fase 1:
`docs/superpowers/plans/2026-10-22-cuadrillas-1-cuentas-grupos.md`.

- **Identidad:** se entra con Google. En la hoja «Entrar» el botón de Google Identity Services (script
  `accounts.google.com/gsi/client`, cargado solo ahí) devuelve un *ID token* que la app pasa a
  `supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })`. El nonce se genera en cada entrada
  (`js/google.js`: el valor bruto va a Supabase y su SHA-256 a Google). Respaldo «Entrar de otra forma»:
  `signInWithOAuth` por redirección. `PREFERIR_GIS` (`js/pantallas/cuenta-ui.js`) decide cuál de las dos es la
  opción principal y se fija con la prueba en un iPhone con la app instalada (spec §2). Antes de salir a Google se
  guarda la ruta pendiente (p. ej. `#unirse/CODIGO`) y se restaura al volver. La sesión la persiste supabase-js en
  localStorage. Google da correo y nombre: el **correo solo vive en `auth.users`** (no se copia a tablas públicas ni
  se enseña a nadie); el nombre visible se confirma en la primera entrada y se guarda en `perfiles`. No hay cuentas
  anónimas ni códigos de recuperación: la cuenta de Google identifica a la persona en cualquier dispositivo.
- **Datos:** `perfiles` (`id` = `auth.uid()`, `nombre`), `grupos`, `miembros` (rol `admin` o `miembro`) y
  `salidas.usuario_id` (FK a `perfiles` con borrado en cascada: las salidas y sus fotos se van con la cuenta).
  Las tablas base solo las lee y escribe su dueño por RLS. **Todo lo del grupo es del grupo:** no hay reparto salida a
  salida; un miembro lee las salidas completas (coordenadas y fotos) de quienes son miembros ahora con
  `salidas_del_grupo(p_grupo, p_antes, p_limite)` (*security definer*, paginada por `creado`, nunca devuelve
  `meteo` ni `indice`). Las escrituras de grupos van por funciones del servidor (`crear_grupo`, `unirse_grupo`,
  `regenerar_codigo`, `renombrar_grupo`, `hacer_admin`, `expulsar_miembro`, `salir_grupo`, `borrar_grupo`).
  `borrar_cuenta()` borra pertenencias, perfil, salidas (y fotos) y el usuario de Auth; quien es el único
  administrador de un grupo con más gente no puede irse ni borrarse sin nombrar sucesor (`ultimo_admin`), y los
  grupos donde está solo se borran con él. La app llama antes a `comprobar_borrar_cuenta()` (mismas comprobaciones,
  sin efectos) porque los ficheros del bucket los borra el cliente antes de la llamada final.
- **Reclamo:** las salidas anteriores a las cuentas (`usuario_id` nulo) se reclaman por el nombre de autor que
  llevaban: `salidas_sin_dueno()` lista esos autores y `reclamar_salidas(p_autor)` las asigna a quien pulsa
  (Diario → «Hay salidas de antes de las cuentas. ¿Cuáles son tuyas?»). Sin secreto: gana quien pulsa primero.
- **Fotos:** tras la migración de cierre el bucket `fotos` es privado y la app usa URLs firmadas (`firmarFotos`).
  Las rutas siguen siendo `<salida_id>/<n>.jpg`; `puede_ver_foto(ruta)` deja ver la foto al dueño de la salida
  y a quien comparte grupo con él.
- **Límites:** 20 miembros por grupo (`max_miembros_grupo()`); 10 fallos de código de invitación en 15 minutos por
  sesión o IP (`limitar_intentos`, que rechaza transacciones de solo lectura, así que `unirse_grupo` no se puede
  probar por GET); máximo 10 grupos creados por persona (`demasiados_grupos`).
- **Códigos de invitación:** 8 caracteres en Crockford base32 (`codigo_aleatorio`; `normalizar_codigo` unifica
  O/0 e I/L/1). Solo los administradores lo ven y lo comparten: `mis_grupos` lo devuelve según el rol y la tabla
  `grupos` no concede `select` sobre esa columna. Abrir un enlace de invitación nunca une al grupo por sí solo: hay que pulsar «Unirme al grupo».
- **Coste:** todo cabe en el plan gratuito a esta escala. El primer límite real serán las **fotos** (1 GB de
  almacenamiento): es el indicador a vigilar si la app crece. Google OAuth no cuesta nada.
- **Pruebas de la base de datos:** `npm run probar:sql` (necesita Docker; levanta un Postgres desechable que imita a
  Supabase y carga la migración original, las `20261005*` y la pendiente de cierre). No forman parte de
  `npm run comprobar`.

### Pasar a cuentas (orden de despliegue)

**Ventana de transición.** Las políticas abiertas de `salidas` y `fotos` siguen activas hasta el paso 7: entre el
paso 3 y el 7 cualquiera con la clave publicable (anon) sigue leyendo todas las salidas y fotos, igual que hoy. Son
minutos y dos personas: hacer los pasos 3–7 el mismo día. Los pasos marcados **(Manual)** se hacen en los paneles.

1. **(Manual) Google Cloud:** cliente OAuth de tipo «aplicación web» con orígenes autorizados
   `https://gonzalotsainz-ux.github.io` y `http://localhost:8080`, URI de redirección
   `https://ctgedeunquvmcfqsufjj.supabase.co/auth/v1/callback` y la pantalla de consentimiento **publicada** (en
   modo «pruebas» solo entran los correos dados de alta como probadores). Copiar el ID de cliente a
   `GOOGLE_CLIENT_ID` en `js/config.js`.
2. **(Manual) Supabase:** Authentication → Providers → Google: activar, pegar ID y secreto, y el ID también en
   «Authorized Client IDs». Authentication → URL Configuration: Site URL `https://gonzalotsainz-ux.github.io/setas/`
   y Redirect URLs esa misma y `http://localhost:8080/`. «Anonymous sign-ins» **no** hace falta.
3. `npx --yes supabase@latest migration list` (con `SUPABASE_ACCESS_TOKEN` en la terminal): confirmar que
   `20261004000100` está aplicada y que no hay ninguna `20261005*` ni `20261006*`. Después
   `npx --yes supabase@latest db push`: aplica `20261005*` (cuentas, grupos, lectura por pertenencia y reclamo).
   Es compatible con la app antigua: las políticas abiertas siguen activas.
4. Fusionar la rama `grupos` en `main` y subir a GitHub (Pages despliega la app nueva).
5. Cada uno entra con Google, confirma su nombre y pulsa el suyo en «¿Cuáles son tuyas?». Uno crea el grupo
   «familia» y el otro entra por el enlace de invitación.
6. Comprobar que no queda nada sin dueño:
   `npx supabase@latest db query --linked "select count(*) from public.salidas where usuario_id is null"` → `0`
   (si no, reclamarlas o borrarlas: la migración de cierre aborta sola si queda alguna).
7. `git mv supabase/pendientes/20261006000000_cerrar_acceso_abierto.sql supabase/migrations/` y `db push`. Desde
   aquí `anon` no lee salidas ni fotos y el bucket es privado.
8. Revocar el *access token* de Supabase cuando termine (pendiente desde septiembre).

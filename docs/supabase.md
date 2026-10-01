# Supabase

- **Proyecto:** `ctgedeunquvmcfqsufjj` (`https://ctgedeunquvmcfqsufjj.supabase.co`), cuenta de Gonzalo, plan gratuito.
- **Sin login, abierto por decisión de la usuaria (2026-09-30).** Cualquiera con la URL de la web puede leer y
  editar el diario (salidas, fotos, umbrales). La clave publicable (`sb_publishable_…`) está en `js/config.js` (la reexporta `js/supabase.js`)
  y es pública por diseño. El autor de cada salida es un nombre elegido en el dispositivo (`elegirAutor`).
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
- Forzar una ejecución (usa otro sello): `curl -X POST -H "x-rejilla-clave: <clave>" ".../functions/v1/rejilla?forzar=1"`.
  La clave no está apuntada en ningún sitio; si hace falta, se genera otra y se actualizan el secreto y Vault
  (`select vault.update_secret(id, '<nueva>') from vault.secrets where name = 'rejilla_clave'`).
- Despliegue: `npx --yes supabase@2.118.0 functions deploy rejilla --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj`.
- Desplegada el 2026-10-01 (migraciones `20261002000000_rejilla.sql` y `20261002000100_rejilla_cron.sql`); primera
  ejecución forzada el 2026-10-01 a las 17:21 de Madrid: 109 celdas rellenadas, sin publicar (relleno en curso).

# Supabase

- **Proyecto:** `ctgedeunquvmcfqsufjj` (`https://ctgedeunquvmcfqsufjj.supabase.co`), cuenta de Gonzalo, plan gratuito.
- **Sin login, abierto por decisión de la usuaria (2026-09-30).** Cualquiera con la URL de la web puede leer y
  editar el diario (salidas, fotos, umbrales). La clave publicable (`sb_publishable_…`) está en `js/supabase.js`
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

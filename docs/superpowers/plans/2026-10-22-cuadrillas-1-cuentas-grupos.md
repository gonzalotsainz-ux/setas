# Cuadrillas, fase 1: cuentas de Google y grupos abiertos por dentro — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquiera entre en Setas con Google, tenga su diario propio y cree o entre en grupos donde todos ven las salidas de todos; vuestro diario actual pasa a ser el grupo «familia».

**Architecture:** Se parte de la rama `grupos` (22 commits del 2026-10-02, nunca desplegada) y se adapta: la sesión anónima con código de recuperación se sustituye por Google (Google Identity Services + `signInWithIdToken`, con redirección de respaldo); el reparto salida a salida (`salida_grupos`, «solo la zona») se sustituye por visibilidad por pertenencia (un miembro ve lo de quienes son miembros ahora). Las migraciones de la rama nunca se aplicaron, así que se reescriben con sus nombres. Fases 2 (sitios vigilados) y 3 (muro, comentarios y ficha de temporada) van en planes aparte.

**Tech Stack:** PostgreSQL (migraciones de Supabase, RLS, plpgsql), Supabase Auth con proveedor Google, Google Identity Services (`accounts.google.com/gsi/client`), `@supabase/supabase-js` 2.117.2 (CDN), JavaScript vanilla ES modules, `node --test`, Docker (`postgres:17-alpine`) para las pruebas SQL, netlify-cli para la prueba en iPhone.

**Spec:** `docs/superpowers/specs/2026-10-22-cuadrillas-design.md` (§1–§3, §8–§11; sustituye a `2026-10-02-grupos-design.md` en lo que choca).

## Global Constraints

- Se trabaja en la rama `grupos` (worktree `C:/Users/Alejandra.ALEJANDRA-P/Las Gordillas/setas-grupos`). Se despliega **solo desde `main`**, tras fusionar.
- Sin cuenta: mapa, índice, zonas, montes y especies siguen funcionando igual que hoy, sin pedir nada. Diario y Grupos piden cuenta.
- Única forma de entrar: Google. Sin contraseñas, sin códigos de recuperación, sin «Anonymous sign-ins».
- Todo lo del grupo es del grupo: no hay compartir salida a salida, ni «solo la zona», ni salidas privadas dentro de un grupo.
- `MAX_MIEMBROS_GRUPO = 20` (`public.max_miembros_grupo()` y `MAX_MIEMBROS` en `js/grupos.js`); 10 grupos creados por persona; 10 fallos de código en 15 min (`limitar_intentos`).
- Código de invitación: 8 caracteres Crockford base32 (`0-9 A-Z` sin `I L O U`); enlace `…/setas/#unirse/CODIGO`.
- Migraciones: `20261005000000_cuentas.sql`, `20261005000100_grupos.sql`, `20261005000200_ver_grupo.sql` (antes `_compartir.sql`) y `supabase/pendientes/20261006000000_cerrar_acceso_abierto.sql` se **reescriben** (nunca se aplicaron). Antes de `db push`, confirmar con `supabase migration list` que ninguna `20261005*`/`20261006*` está aplicada.
- Interfaz y mensajes en español; nada de `innerHTML` con datos (usar `el()` de `js/ui/dom.js`); supabase-js fijado en 2.117.2.
- Nunca afirmar comestibilidad; esta fase no toca identificación ni umbrales (`ajustes_umbrales` sigue abierto y compartido).
- `npm run comprobar` (pruebas + validador) en verde en cada commit; `npm run probar:sql` (Docker) en verde al cerrar cada tarea SQL.
- Cada commit termina con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Decisiones de implementación

1. **Fusión, no rebase**, de `main` en `grupos` (spec §13.8). Reglas de resolución en la Tarea 0.
2. **Entrada:** `js/google.js` (GIS) + `js/cuenta.js` (`signInWithIdToken`). La redirección (`signInWithOAuth`) existe desde el principio como «otra forma de entrar»; la constante `PREFERIR_GIS` en `js/pantallas/cuenta-ui.js` decide cuál se ofrece primero y la fija la prueba en iPhone (Tarea 12). Si `GOOGLE_CLIENT_ID` (en `js/config.js`) está vacío, solo se ofrece la redirección.
3. **Nonce:** GIS recibe el SHA-256 en hexadecimal del nonce y Supabase el nonce en claro (`signInWithIdToken({ provider: 'google', token, nonce })`). El ID de cliente de Google va en el proveedor Google de Supabase (campo «Authorized Client IDs»).
4. **`salidas_del_grupo(p_grupo, p_antes timestamptz default null, p_limite int default 20)`** ordena por `creado desc` (orden de apuntado, el de un muro) con cursor por `creado`; se fija ya para que la fase 3 no cambie la firma. `p_limite` se acota a 1..100.
5. **`borrar_cuenta()`**: `salidas.usuario_id` pasa a `on delete cascade` (con `set null` una cuenta borrada dejaría salidas sin dueño reclamables por cualquiera). El cliente borra antes los objetos de Storage de cada salida (`borrarSalida` de `js/diario.js`, que ya quita Storage y luego la fila) y después llama a la función, que borra perfil y usuario de Auth. El entorno de pruebas gana una tabla `auth.users` mínima.
6. **Reclamo** de las salidas actuales por nombre de autor, como en la rama (`salidas_sin_dueno`, `reclamar_salidas`). Los sitios no existen en esta fase: la fase 2 los generará a partir de las salidas ya con dueño.
7. **Fotos:** rutas sin cambiar (`<salida_id>/<n>.jpg`); `puede_ver_foto` mira si quien pregunta comparte algún grupo con el dueño de la salida.
8. **Ruta pendiente** (`sessionStorage`, clave `setas.ruta`): solo la necesita la redirección (GIS no sale de la página). Se guarda al redirigir y `js/app.js` la restaura al arrancar.
9. **Capa «diario» del mapa de `main`** (`js/pantallas/mapa.js:435`): pasa `usuarioId` de la cuenta; sin sesión enseña el aviso «Entra con Google para ver tu diario en el mapa». Las chinchetas de sitio son de la fase 2.

## Review Focus

1. **Enlace de invitación abierto sin sesión** (`#unirse/CODIGO` → entrar con Google → volver a la invitación): la ruta debe sobrevivir tanto a GIS como a la redirección. → Tarea 8 (`tomarRutaPendiente`) y Tarea 10 (Unirse llama a `requerirCuenta` y se queda en su hash).
2. **Cuenta de Google sin nombre** (`full_name` vacío): `crear_perfil` rechaza en blanco; la hoja «Tu nombre» no deja guardar vacío. → Tarea 1 (SQL) y Tarea 8 (UI).
3. **Persona en dos grupos que sale de uno**: la visibilidad cae solo en ese grupo. → Tarea 3.
4. **Único administrador con más gente intenta borrar su cuenta**: `ultimo_admin`; si es el único miembro, el grupo se borra con él. → Tarea 2.
5. **Borrador guardado sin red y sin sesión, y después se entra con Google**: se sube con el dueño de la sesión, sin perder nada. → Tarea 7 (`crearSalida` con `usuarioId`) y Tarea 9 (`sincronizarYa` devuelve `sinSesion`).

---

### Task 0: Traer `main` a `grupos` y dejar la suite en verde

**Files:**
- Modify (resolución de conflictos): `js/app.js`, `css/componentes.css`, `js/diario.js`, `tests/diario.test.js`, `js/pantallas/mapa.js`, `README.md`, `docs/supabase.md`
- Test: `tests/*.test.js` (existentes)

**Interfaces:**
- Produces: rama `grupos` con todo lo de `main` (mapa limpio, mapa por niveles) más las cuentas anónimas y grupos de la rama, funcionando.

- [ ] **Step 1: Comprobar el punto de partida**

Run: `cd "C:/Users/Alejandra.ALEJANDRA-P/Las Gordillas/setas-grupos" && git branch --show-current && git status --short && git log --oneline -1 main`
Expected: `grupos`, sin cambios pendientes, y `main` en `43ff481` o posterior.

- [ ] **Step 2: Fusionar**

Run: `git merge main --no-edit`
Expected: conflictos en algunos de: `js/app.js`, `css/componentes.css`, `js/diario.js`, `tests/diario.test.js`, `README.md`, `docs/supabase.md`.

- [ ] **Step 3: Resolver con estas reglas**

- `js/app.js`: quedarse con la versión de `main` entera y volver a añadir solo las dos líneas de la rama: `grupos: () => import('./pantallas/grupos.js'), unirse: () => import('./pantallas/unirse.js'),` en `pantallas` y `grupos: 'diario', unirse: 'diario'` en `SECCION`. No debe quedar ninguna referencia a `hoy.js`.
- `css/componentes.css`: versión de `main` entera más el bloque de la rama `.grupo-codigo, .recuperacion-codigo { … }` … `.aviso-peligro[hidden], .diario-comp__zona[hidden] { display: none; }` (se limpia en la Tarea 11).
- `js/diario.js` y `tests/diario.test.js`: `urlNuevaSalida` y `leerNuevaSalida` con `punto`, como en `main` (la rama lo había quitado). El resto de cambios de la rama (`usuarioId`, `firmarFotos`, `guardarComparticion`) se conservan.
- `README.md` y `docs/supabase.md`: texto de `main` más las secciones de la rama (se reescriben en la Tarea 11).

- [ ] **Step 4: Parchear la capa «diario» del mapa**

En `js/pantallas/mapa.js`, donde está `pintarSalidas(capas.diario, await listarSalidas({ supabase }), datos)`: importar dinámicamente `./cuenta-ui.js`, pedir `const c = await cuentaActual()`; sin `c`, `avisar('Entra con Google para ver tu diario en el mapa.')` y salir; con `c`, `listarSalidas({ supabase, usuarioId: c.id })`. (Hasta la Tarea 8 `cuentaActual` sigue siendo la anónima; la firma no cambia.)

- [ ] **Step 5: Suite en verde**

Run: `npm run comprobar`
Expected: todas las pruebas pasan (las 669 de `main` más las de la rama: `cuenta`, `grupos`, `diario` ampliadas); el validador, sin errores.

- [ ] **Step 6: Commit de la fusión**

```bash
git add -A && git commit -m "Fusionar main en grupos: mapa limpio y por niveles con las cuentas y grupos de la rama"
```

---

### Task 1: Migración de cuentas sin código de recuperación

**Files:**
- Rewrite: `supabase/migrations/20261005000000_cuentas.sql`
- Modify: `tests/sql/arranque.sql`
- Rewrite: `tests/sql/cuentas.test.sql`

**Interfaces:**
- Produces: tabla `public.perfiles (id uuid pk, nombre text, creado timestamptz)`; funciones `crear_perfil(p_nombre text) returns void`, `renombrar_perfil(p_nombre text) returns void`; se conservan `intentos_codigo`, `ip_cliente()`, `codigo_aleatorio(int)`, `normalizar_codigo(text)`, `registrar_fallo(text)`, `limitar_intentos(text, int, interval)`. Desaparecen `hash_recuperacion`, `hash_codigo`, `regenerar_recuperacion`, `recuperar_cuenta`. Errores: `sin_sesion`, `perfil_existente`, `sin_perfil`.
- Entorno de pruebas: `auth.users (id uuid primary key)`; `t.como(n)` crea el usuario `t.uid(n)` en `auth.users` si no existe.

- [ ] **Step 1: Escribir la prueba que falla**

Sustituir `tests/sql/cuentas.test.sql` por una prueba con estas afirmaciones:

```sql
select t.como(1);
do $$ begin
  perform public.crear_perfil('  Ana ');
  perform t.afirma((select nombre from public.perfiles where id = t.uid(1)) = 'Ana', 'el nombre se guarda recortado');
  perform t.afirma(exists (select 1 from auth.users where id = t.uid(1)), 'el entorno de pruebas crea el usuario de Auth');
  perform t.falla('select public.crear_perfil(''Otra'')', 'perfil_existente');
  perform t.falla('select public.crear_perfil(''   '')', 'violates check constraint');
  perform public.renombrar_perfil('  Ana María ');
  perform t.afirma((select nombre from public.perfiles) = 'Ana María', 'renombrar recorta y guarda');
  perform t.falla('select public.registrar_fallo(''x'')', 'permission denied');
  perform t.falla('select public.limitar_intentos(''x'')', 'permission denied');
  perform t.falla('select public.codigo_aleatorio(4)', 'permission denied');
end $$;
select t.como(2);
do $$ begin
  perform t.afirma((select count(*) from public.perfiles) = 0, 'otra sesión no ve el perfil de Ana');
  perform t.falla('select public.renombrar_perfil(''X'')', 'sin_perfil');
end $$;
select t.anonimo();
do $$ begin perform t.falla('select public.crear_perfil(''X'')', 'permission denied'); end $$;
select t.admin();
do $$ begin
  perform t.afirma(not exists (select 1 from pg_proc where proname in ('recuperar_cuenta', 'regenerar_recuperacion', 'hash_codigo')), 'las funciones del código de recuperación ya no existen');
  perform t.afirma(not exists (select 1 from information_schema.columns where table_name = 'perfiles' and column_name = 'hash_recuperacion'), 'perfiles no guarda ningún hash');
end $$;
```

- [ ] **Step 2: Ejecutar para ver que falla**

Run: `npm run probar:sql -- cuentas`
Expected: `✘ cuentas.test.sql` (hoy `crear_perfil` devuelve texto y exige el hash).

- [ ] **Step 3: Entorno de pruebas con `auth.users`**

En `tests/sql/arranque.sql`, tras `create schema auth;`: `create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);` y en `t.como(n)`, antes de `set role`, `insert into auth.users (id) values (t.uid(n)) on conflict do nothing;`.

- [ ] **Step 4: Reescribir la migración**

`supabase/migrations/20261005000000_cuentas.sql`: cabecera que cite la spec de 2026-10-22 §2; `perfiles` sin `hash_recuperacion`; `grant select (id, nombre, creado)` y la política «perfil propio: ver» como estaban; `intentos_codigo` y las funciones internas igual **menos** `hash_codigo`; `crear_perfil(p_nombre text) returns void` (`sin_sesion` si `auth.uid()` es nulo, `perfil_existente`, `insert … values (auth.uid(), btrim(p_nombre))`); `renombrar_perfil` igual; permisos: `crear_perfil(text)` y `renombrar_perfil(text)` a `authenticated`, internas a nadie.

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `npm run probar:sql -- cuentas`
Expected: `✔ cuentas.test.sql`. (Las demás suites fallarán hasta las Tareas 2–4: aún llaman a `compartir_salida` y leen un código de `crear_perfil`.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261005000000_cuentas.sql tests/sql/arranque.sql tests/sql/cuentas.test.sql
git commit -m "Cuentas: perfil ligado al usuario de Google, sin código de recuperación"
```

---

### Task 2: Migración de grupos sin reparto por salida y con `borrar_cuenta`

**Files:**
- Rewrite: `supabase/migrations/20261005000100_grupos.sql`
- Modify: `tests/sql/grupos.test.sql`

**Interfaces:**
- Consumes: `perfiles`, `limitar_intentos`, `codigo_aleatorio`, `normalizar_codigo` (Tarea 1).
- Produces: `grupos`, `miembros`, `salidas.usuario_id uuid references perfiles (id) on update cascade on delete cascade`; funciones de la rama sin cambios de firma: `es_miembro(uuid)`, `es_admin(uuid)`, `max_miembros_grupo()`, `crear_grupo(text)`, `unirse_grupo(text)`, `regenerar_codigo(uuid)`, `renombrar_grupo(uuid, text)`, `hacer_admin(uuid, uuid)`, `expulsar_miembro(uuid, uuid)`, `salir_grupo(uuid)`, `borrar_grupo(uuid)`, `mis_grupos()`, `miembros_del_grupo(uuid)`; nueva `borrar_cuenta() returns void`. **No existe** `salida_grupos`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/sql/grupos.test.sql`: quitar la línea `perform t.falla('insert into public.salida_grupos …')` y todo el bloque «Limpieza de salida_grupos al expulsar y al salir» (líneas 193–234 actuales), dejando la comprobación de que un miembro corriente puede salir. Añadir al final:

```sql
-- borrar_cuenta: el único administrador con más gente no puede; el único miembro se lleva el grupo; lo suyo desaparece.
select t.como(21); select public.crear_perfil('Uno');
select t.como(22); select public.crear_perfil('Dos');
select t.como(21);
do $$ declare r record; begin
  select * into r from public.crear_grupo('Solo'); insert into t.codigos values ('solo', r.grupo_id::text);
  select * into r from public.crear_grupo('Dúo'); insert into t.codigos values ('duo', r.grupo_id::text), ('duo_c', r.codigo);
  insert into public.salidas (id, fecha, zona_id, usuario_id) values (gen_random_uuid(), current_date, 'z', t.uid(21));
end $$;
select t.como(22); select public.unirse_grupo((select valor from t.codigos where clave = 'duo_c'));
select t.como(21);
do $$ begin perform t.falla('select public.borrar_cuenta()', 'ultimo_admin'); end $$;
do $$ begin perform public.hacer_admin((select valor from t.codigos where clave = 'duo')::uuid, t.uid(22)); perform public.borrar_cuenta(); end $$;
select t.admin();
do $$ begin
  perform t.afirma(not exists (select 1 from public.perfiles where id = t.uid(21)), 'el perfil se borra');
  perform t.afirma(not exists (select 1 from auth.users where id = t.uid(21)), 'el usuario de Auth se borra');
  perform t.afirma(not exists (select 1 from public.grupos where id = (select valor from t.codigos where clave = 'solo')::uuid), 'el grupo donde era el único miembro se borra');
  perform t.afirma(exists (select 1 from public.grupos where id = (select valor from t.codigos where clave = 'duo')::uuid), 'el grupo con más gente sigue');
  perform t.afirma((select count(*) from public.miembros where usuario_id = t.uid(21)) = 0, 'sin pertenencias');
  perform t.afirma((select count(*) from public.salidas where usuario_id = t.uid(21)) = 0, 'sus salidas se borran');
  perform t.afirma((select count(*) from public.salidas where usuario_id is null) = 0, 'no queda ninguna salida sin dueño (sería reclamable por cualquiera)');
end $$;
select t.anonimo();
do $$ begin perform t.falla('select public.borrar_cuenta()', 'permission denied'); end $$;
```

- [ ] **Step 2: Ejecutar para ver que falla**

Run: `npm run probar:sql -- grupos`
Expected: `✘ grupos.test.sql` (`borrar_cuenta` no existe).

- [ ] **Step 3: Reescribir la migración**

`supabase/migrations/20261005000100_grupos.sql`: igual que la rama **sin** `salida_grupos` (tabla, índice, RLS, política «salida_grupos: del dueño», los `delete from salida_grupos` de `expulsar_miembro` y `salir_grupo`, y sus `revoke/grant`). `alter table public.salidas add column usuario_id uuid references public.perfiles (id) on update cascade on delete cascade`. Al final:

```sql
create function public.borrar_cuenta() returns void
language plpgsql security definer set search_path = public, auth as $$
-- sin_sesion si auth.uid() es nulo; sin_perfil si no hay perfil.
-- Por cada grupo donde soy admin: si hay otros miembros y ningún otro admin → raise 'ultimo_admin'.
-- Grupos donde soy el único miembro → delete (cascada a miembros).
-- delete from perfiles where id = auth.uid()  (cascada: miembros, salidas → fotos).
-- delete from auth.users where id = auth.uid().
```

`grant execute on function public.borrar_cuenta() to authenticated` y `revoke … from public, anon`.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npm run probar:sql -- grupos`
Expected: `✔ grupos.test.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261005000100_grupos.sql tests/sql/grupos.test.sql
git commit -m "Grupos: visibilidad por pertenencia (fuera salida_grupos) y borrar_cuenta"
```

---

### Task 3: Lectura del grupo por pertenencia y reclamo

**Files:**
- Delete: `supabase/migrations/20261005000200_compartir.sql`
- Create: `supabase/migrations/20261005000200_ver_grupo.sql`
- Modify: `scripts/probar-sql.mjs:19-23`
- Delete: `tests/sql/compartir.test.sql`
- Create: `tests/sql/ver_grupo.test.sql`

**Interfaces:**
- Consumes: `es_miembro`, `miembros`, `perfiles` (Tareas 1–2).
- Produces: políticas «salidas: dueño» y «fotos: dueño de la salida» (como la rama); `salidas_del_grupo(p_grupo uuid, p_antes timestamptz default null, p_limite int default 20) returns table (id uuid, usuario_id uuid, autor text, fecha date, zona_id text, lat double precision, lon double precision, especies jsonb, notas text, creado timestamptz, fotos jsonb)`; `salidas_sin_dueno() returns table (autor text, n bigint)`; `reclamar_salidas(p_autor text) returns integer`. **No existe** `compartir_salida`.

- [ ] **Step 1: Ampliar el cargador de migraciones de las pruebas**

En `scripts/probar-sql.mjs`, el filtro `/_(cuentas|grupos|compartir)\.sql$/` pasa a `/\/2026100[56]\d{6}_/` (todas las de cuentas, grupos, ver_grupo y la pendiente, por sello).

- [ ] **Step 2: Escribir la prueba que falla**

`tests/sql/ver_grupo.test.sql` (reutiliza de `compartir.test.sql` el arranque de Ana/Beto/Cris y los bloques de reclamo del final: reclamar dos veces, con otro nombre, sin perfil, autor nulo):

```sql
-- Ana (1) y Beto (2) en «Amigos»; Cris (3) fuera. Beto además en «Norte» con Cris.
-- Ana apunta una salida con foto, meteo e índice (misma fila que en compartir.test.sql).
select t.como(2);
do $$ declare s record; g uuid := (select valor from t.codigos where clave = 'gid')::uuid; n int; begin
  select * into s from public.salidas_del_grupo(g);
  perform t.afirma(s.lat = 41.76 and s.lon = -2.46 and s.autor = 'Ana' and jsonb_array_length(s.fotos) = 1, 'Beto ve la salida de Ana entera, con coordenadas');
  perform t.afirma((select count(*) from public.salidas) = 0, 'Beto no lee la tabla salidas');
  perform t.afirma((select count(*) from public.fotos) = 0, 'Beto no lee la tabla fotos');
  update public.salidas set notas = 'robada' where id = '11111111-1111-4111-8111-111111111111'; get diagnostics n = row_count;
  perform t.afirma(n = 0, 'Beto no edita la salida de Ana');
end $$;
select t.como(3);
do $$ declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid; begin
  perform t.falla(format('select * from public.salidas_del_grupo(%L)', g), 'no_miembro');
end $$;
-- Beto apunta dos salidas (creado distinto) y Cris las ve en Norte, Ana en Amigos.
-- Expulsar a Beto de Amigos: Ana deja de ver las de Beto en Amigos; Cris las sigue viendo en Norte.
-- Paginación: con 3 salidas en Amigos, salidas_del_grupo(g, null, 2) devuelve las 2 de creado más reciente;
--   salidas_del_grupo(g, <creado de la 2.ª>, 2) devuelve solo la 3.ª; p_limite 0 y 1000 se acotan a 1 y 100.
-- La función no tiene columna meteo ni indice:
--   perform t.falla('select meteo from public.salidas_del_grupo(...)', 'does not exist');
-- anon: salidas_del_grupo y mis_grupos → permission denied. compartir_salida no existe (pg_proc).
```

Cada comentario de arriba es un bloque `do $$ … $$` con sus `t.afirma`/`t.falla`; los bloques de reclamo se copian tal cual del fichero antiguo.

- [ ] **Step 3: Ejecutar para ver que falla**

Run: `npm run probar:sql -- ver_grupo`
Expected: `✘ ver_grupo.test.sql` (la migración vieja exige `compartir_salida`).

- [ ] **Step 4: Escribir la migración**

`supabase/migrations/20261005000200_ver_grupo.sql`: las dos políticas de dueño; `salidas_del_grupo` (plpgsql, `stable security definer`, `set search_path = public`): `if not es_miembro(p_grupo) then raise exception 'no_miembro'`; `return query select s.id, s.usuario_id, p.nombre, s.fecha, s.zona_id, s.lat, s.lon, s.especies, s.notas, s.creado, coalesce(<jsonb_agg de fotos ordenado por creado, ruta>, '[]') from salidas s join perfiles p on p.id = s.usuario_id where exists (select 1 from miembros m where m.grupo_id = p_grupo and m.usuario_id = s.usuario_id) and (p_antes is null or s.creado < p_antes) order by s.creado desc limit least(greatest(coalesce(p_limite, 20), 1), 100)`; `salidas_sin_dueno` y `reclamar_salidas` como en la rama; `revoke`/`grant` de las tres a `authenticated`.

- [ ] **Step 5: Ejecutar toda la suite SQL**

Run: `npm run probar:sql`
Expected: `cuentas`, `grupos`, `ver_grupo` en verde; `fotos` y `permisos` aún en rojo (Tarea 4).

- [ ] **Step 6: Commit**

```bash
git add scripts/probar-sql.mjs supabase/migrations tests/sql
git commit -m "Lectura del grupo por pertenencia: salidas_del_grupo paginada, reclamo; fuera compartir_salida"
```

---

### Task 4: Cierre del acceso abierto y fotos por pertenencia

**Files:**
- Modify: `supabase/pendientes/20261006000000_cerrar_acceso_abierto.sql:27-41`
- Modify: `tests/sql/fotos.test.sql`
- Modify: `tests/sql/permisos.test.sql`

**Interfaces:**
- Produces: `puede_ver_foto(p_ruta text) returns boolean` = dueño de la salida, o alguien que comparte un grupo con el dueño. Resto de la migración de cierre sin cambios (guardia de salidas sin dueño, bucket privado, políticas de Storage).

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/sql/fotos.test.sql`: sustituir el bloque «Compartida con el grupo» (que llama a `compartir_salida`) por: Beto (mismo grupo) ve la foto de Ana sin que Ana haga nada; Cris (fuera) no; tras `expulsar_miembro` de Beto (como Ana), Beto deja de verla. `tests/sql/permisos.test.sql`: en la lista de la API quitar `regenerar_recuperacion()`, `recuperar_cuenta(text)`, `compartir_salida(uuid, jsonb)` y cambiar `salidas_del_grupo(uuid)` por `salidas_del_grupo(uuid, timestamptz, int)`; añadir `borrar_cuenta()`; en las internas quitar `hash_codigo(text)`.

- [ ] **Step 2: Ejecutar para ver que falla**

Run: `npm run probar:sql -- fotos && npm run probar:sql -- permisos`
Expected: las dos en rojo.

- [ ] **Step 3: Cambiar `puede_ver_foto`**

Condición: `s.usuario_id = auth.uid() or exists (select 1 from miembros yo join miembros d on d.grupo_id = yo.grupo_id where yo.usuario_id = auth.uid() and d.usuario_id = s.usuario_id)`.

- [ ] **Step 4: Toda la suite SQL en verde**

Run: `npm run probar:sql`
Expected: `5/5 ficheros de prueba SQL correctos`.

- [ ] **Step 5: Commit**

```bash
git add supabase/pendientes tests/sql
git commit -m "Fotos privadas por pertenencia al grupo; permisos de la API actualizados"
```

---

### Task 5: `js/google.js`: Google Identity Services y nonce

**Files:**
- Create: `js/google.js`
- Modify: `js/config.js` (añadir `export const GOOGLE_CLIENT_ID = '';`)
- Test: `tests/google.test.js`

**Interfaces:**
- Produces:
  - `nonceNuevo({ cripto = globalThis.crypto } = {}) → Promise<{ bruto: string, hash: string }>`: `bruto` = 16 bytes aleatorios en hexadecimal (32 caracteres); `hash` = SHA-256 de `bruto` (texto UTF-8) en hexadecimal.
  - `cargarGis({ doc = document, espera = 10000 } = {}) → Promise<gis>`: inserta una sola vez `<script src="https://accounts.google.com/gsi/client" async defer>` y resuelve con `globalThis.google.accounts.id`; rechaza con `Error('No se pudo cargar Google')` si no carga en `espera` ms. Memorizada: llamadas simultáneas o repetidas comparten la misma promesa (y tras un rechazo se vuelve a intentar).
  - `botonGoogle(contenedor, { clientId, nonce, alCredencial, gis }) → void`: `gis.initialize({ client_id: clientId, callback: (r) => alCredencial(r.credential), nonce: nonce.hash, ux_mode: 'popup', itp_support: true })` y `gis.renderButton(contenedor, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'es', width: 280 })`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
test('nonceNuevo: 32 hex en claro y su SHA-256 en hex', async () => {
  const n = await nonceNuevo();
  assert.match(n.bruto, /^[0-9a-f]{32}$/);
  assert.equal(n.hash, createHash('sha256').update(n.bruto).digest('hex'));   // node:crypto
});
test('cargarGis inserta el script una sola vez y resuelve con google.accounts.id', async () => {
  const scripts = [];
  const doc = { createElement: () => ({ addEventListener(ev, fn) { this[ev] = fn; } }), head: { append: (s) => scripts.push(s) } };
  globalThis.google = { accounts: { id: { initialize() {}, renderButton() {} } } };
  const p1 = cargarGis({ doc }), p2 = cargarGis({ doc });
  scripts[0].load();
  assert.equal(await p1, globalThis.google.accounts.id); assert.equal(await p2, await p1);
  assert.equal(scripts.length, 1); assert.equal(scripts[0].src, 'https://accounts.google.com/gsi/client');
});
test('cargarGis rechaza si el script no carga a tiempo y después vuelve a intentarlo', …);   // espera: 5 ms; luego una segunda llamada inserta otro script
test('botonGoogle pasa el hash del nonce a initialize y el contenedor a renderButton', () => {
  const llamadas = {};
  const gis = { initialize: (o) => { llamadas.init = o; }, renderButton: (c, o) => { llamadas.render = [c, o]; } };
  const cont = {};
  botonGoogle(cont, { clientId: 'id-x', nonce: { bruto: 'b', hash: 'h' }, alCredencial: () => {}, gis });
  assert.equal(llamadas.init.client_id, 'id-x'); assert.equal(llamadas.init.nonce, 'h');
  assert.equal(llamadas.render[0], cont); assert.equal(llamadas.render[1].locale, 'es');
});
test('botonGoogle: el callback entrega solo la credencial', …);   // llamadas.init.callback({ credential: 'tok' }) → alCredencial('tok')
```

- [ ] **Step 2: Ejecutar para ver que falla**

Run: `node --test tests/google.test.js`
Expected: FAIL, `js/google.js` no existe.

- [ ] **Step 3: Escribir `js/google.js` y el export de `js/config.js`**

`nonceNuevo` con `cripto.getRandomValues` y `cripto.subtle.digest('SHA-256', new TextEncoder().encode(bruto))`. `cargarGis` guarda la promesa en módulo y la anula en el `catch`.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `node --test tests/google.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/google.js js/config.js tests/google.test.js
git commit -m "Google Identity Services: carga del script, nonce y botón"
```

---

### Task 6: `js/cuenta.js`: sesión de Google, perfil y ruta pendiente

**Files:**
- Rewrite: `js/cuenta.js`
- Rewrite: `tests/cuenta.test.js`

**Interfaces:**
- Consumes: `borrarSalida(id, { supabase })` de `js/diario.js`.
- Produces (todo con `{ supabase }` inyectado):
  - `normalizarCodigo(t)` (igual que hoy; lo usa `js/grupos.js`).
  - `sesionActual({ supabase }) → Promise<{ uid, nombreGoogle } | null>`: `auth.getSession()`; error → se propaga; `nombreGoogle` = `user.user_metadata.full_name ?? user.user_metadata.name ?? ''`.
  - `entrarConGoogle({ supabase, credencial, nonce }) → Promise<string uid>`: `auth.signInWithIdToken({ provider: 'google', token: credencial, nonce: nonce.bruto })`.
  - `entrarPorRedireccion({ supabase, redirigirA }) → Promise<void>`: `auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirigirA } })`.
  - `salir({ supabase }) → Promise<void>`: `auth.signOut()`.
  - `cargarPerfil({ supabase }) → Promise<{ estado: 'sin-sesion' } | { estado: 'sin-perfil', uid, nombreGoogle } | { estado: 'perfil', id, nombre }>`; un error de red se propaga.
  - `crearPerfil(nombre, { supabase }) → Promise<void>`, `renombrarPerfil(nombre, { supabase }) → Promise<void>`.
  - `borrarCuenta({ supabase, usuarioId, borrar = borrarSalida }) → Promise<void>`: lista `salidas.id` del usuario, llama a `borrar(id, { supabase })` por cada una, `rpc('borrar_cuenta')`, `auth.signOut()`.
  - `guardarRutaPendiente(hash, almacen = sessionStorage)`, `tomarRutaPendiente(almacen = sessionStorage) → string | null` (devuelve y borra; clave `setas.ruta`; solo acepta valores que empiecen por `#`).
  - `textoError(e)`: tabla `ERRORES` sin `sesion_con_perfil`, `perfil_existente` queda, sin `Anonymous sign-ins`; nuevas: `['sin_sesion', 'Entra con Google para continuar.']`, `['ultimo_admin', …]` (igual), `['Failed to fetch', 'Sin conexión.']`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Un `sbFalso({ sesion, perfil, errorPerfil, rpc })` como el actual pero con `auth: { getSession, signInWithIdToken, signInWithOAuth, signOut }` que registran llamadas. Pruebas:

```js
test('sesionActual: null sin sesión; uid y nombre de Google con ella; el error se propaga', …);
test('entrarConGoogle manda la credencial y el nonce en claro', async () => {
  const sb = sbFalso({ idToken: { data: { user: { id: 'u1' } }, error: null } });
  assert.equal(await entrarConGoogle({ supabase: sb, credencial: 'tok', nonce: { bruto: 'n', hash: 'h' } }), 'u1');
  assert.deepEqual(sb.llamadas.idToken[0], { provider: 'google', token: 'tok', nonce: 'n' });
});
test('entrarPorRedireccion pasa redirectTo', …);
test('cargarPerfil: sin-sesion, sin-perfil (con nombre de Google), perfil; el error de red se propaga', …);
test('crearPerfil y renombrarPerfil llaman a sus funciones', …);
test('borrarCuenta borra cada salida (Storage incluido), llama a borrar_cuenta y cierra la sesión, en ese orden', async () => {
  const orden = [];
  const sb = sbFalso({ salidasIds: ['a', 'b'], rpc: { borrar_cuenta: { data: null, error: null } } });
  sb.rpc = async (n) => { orden.push(n); return { data: null, error: null }; };
  sb.auth.signOut = async () => { orden.push('signOut'); return { error: null }; };
  await borrarCuenta({ supabase: sb, usuarioId: 'u1', borrar: async (id) => { orden.push(`borrar:${id}`); } });
  assert.deepEqual(orden, ['borrar:a', 'borrar:b', 'borrar_cuenta', 'signOut']);
});
test('borrarCuenta: si falla borrar una salida no llama a borrar_cuenta', …);
test('ruta pendiente: se guarda, se toma una sola vez y se ignora lo que no empieza por #', () => {
  const alm = almacenFalso();
  guardarRutaPendiente('#unirse/ABCD2345', alm); assert.equal(tomarRutaPendiente(alm), '#unirse/ABCD2345'); assert.equal(tomarRutaPendiente(alm), null);
  guardarRutaPendiente('javascript:x', alm); assert.equal(tomarRutaPendiente(alm), null);
});
test('textoError: sin_sesion, Failed to fetch y los de grupos', …);
```

- [ ] **Step 2: Ejecutar para ver que falla**

Run: `node --test tests/cuenta.test.js`
Expected: FAIL (`sesionActual` no existe).

- [ ] **Step 3: Reescribir `js/cuenta.js`**

Sin `asegurarSesion`, `formatearCodigo`, `codigoRecuperacionValido`, `regenerarRecuperacion`, `recuperarCuenta`. `cargarPerfil` consulta `perfiles` solo si hay sesión.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `node --test tests/cuenta.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/cuenta.js tests/cuenta.test.js
git commit -m "Cuenta: sesión de Google, perfil, borrar cuenta y ruta pendiente"
```

---

### Task 7: `js/grupos.js` y `js/diario.js` sin reparto por salida

**Files:**
- Modify: `js/grupos.js`
- Modify: `js/diario.js:96-160`
- Delete: `js/ui/compartir.js`
- Modify: `tests/grupos.test.js`, `tests/diario.test.js`

**Interfaces:**
- Consumes: `sesionActual`, `normalizarCodigo` (Tarea 6).
- Produces:
  - `js/grupos.js`: `llamar` usa `sesionActual` y lanza `Error('sin_sesion')` si no hay sesión; `salidasDelGrupo(grupoId, { supabase, antes = null, limite = 20 })` → `rpc('salidas_del_grupo', { p_grupo, p_antes: antes, p_limite: limite })` con fotos firmadas; desaparece `comparticionesDesdeMapa`. Resto igual.
  - `js/diario.js`: `crearSalida(b, { supabase, persistir, almacenFotos, usuarioId })` sin el bloque `b.grupos`/`compartida`; desaparece `guardarComparticion`; `listarSalidas({ supabase, usuarioId })` selecciona `'*, fotos(ruta, ancho, alto)'` (sin `salida_grupos`). `firmarFotos`, `borrarSalida`, `urlNuevaSalida` con `punto`: igual.

- [ ] **Step 1: Ajustar las pruebas**

`tests/grupos.test.js`: quitar `comparticionesDesdeMapa` y su prueba; `sbFalso` sin `getSession` → añadir prueba «sin sesión, `llamar` rechaza con `sin_sesion` y no llama al servidor»; prueba de `salidasDelGrupo('g1', { supabase, antes: '2026-10-01T00:00:00Z', limite: 5 })` → args `{ p_grupo: 'g1', p_antes: '2026-10-01T00:00:00Z', p_limite: 5 }` y por defecto `{ p_grupo: 'g1', p_antes: null, p_limite: 20 }`.
`tests/diario.test.js`: quitar las tres pruebas de `compartir_salida`/`b.grupos` y la de `guardarComparticion`; mantener «con usuarioId la fila lleva usuario_id»; la prueba de `listarSalidas` ya no espera `salida_grupos` en el select.

- [ ] **Step 2: Ejecutar para ver que falla**

Run: `node --test tests/grupos.test.js tests/diario.test.js`
Expected: FAIL en las pruebas nuevas.

- [ ] **Step 3: Cambiar `js/grupos.js` y `js/diario.js`; borrar `js/ui/compartir.js`**

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npm run comprobar`
Expected: PASS (nada importa ya `comparticionesDesdeMapa`, `guardarComparticion` ni `js/ui/compartir.js`; si `js/pantallas/diario.js` falla al importarlos, se deja roto hasta la Tarea 9 pero las pruebas de Node no cargan pantallas).

- [ ] **Step 5: Commit**

```bash
git add -A js tests
git commit -m "Grupos y diario sin reparto por salida: lectura paginada por pertenencia"
```

---

### Task 8: `cuenta-ui.js`: entrar con Google, «Tu nombre», pantalla sin sesión y ruta pendiente

**Files:**
- Rewrite: `js/pantallas/cuenta-ui.js`
- Modify: `js/app.js` (restaurar la ruta pendiente al arrancar)
- Modify: `js/supabase.js` (comentario de cabecera; `elegirAutor` se conserva para el nombre local)

**Interfaces:**
- Consumes: Tareas 5 y 6; `abrirHoja` de `js/ui/hoja.js`; `GOOGLE_CLIENT_ID`.
- Produces:
  - `PREFERIR_GIS = true` (constante exportada; la fija la Tarea 12).
  - `cuentaActual({ forzar } = {}) → Promise<{ id, nombre } | null>` (perfil o null), `estadoCuenta() → último resultado de cargarPerfil | null`, `errorDeCuenta()`, `fijarCuenta(c)`: como hoy.
  - `requerirCuenta() → Promise<{ id, nombre } | null>`: con perfil lo devuelve; sin sesión abre `hojaEntrar()`; con sesión y sin perfil abre `hojaNombre(nombreGoogle)`; `null` si se cierra sin terminar; lanza en español si no se pudo comprobar (sin red).
  - `hojaEntrar() → Promise<boolean>` (hoja «Entrar», `encima: true`): texto «Con tu cuenta de Google tendrás tu diario y podrás entrar en grupos. Tu correo no se enseña a nadie.»; si `GOOGLE_CLIENT_ID` y `PREFERIR_GIS`, contenedor con `botonGoogle` (nonce de `nonceNuevo`; `alCredencial` → `entrarConGoogle` → `cuentaActual({ forzar: true })` → resuelve `true`); botón secundario «Entrar de otra forma» → `guardarRutaPendiente(location.hash)` + `entrarPorRedireccion({ redirigirA: location.origin + location.pathname })`. Si GIS no carga o no hay `clientId`, solo el botón de redirección, rotulado «Entrar con Google». `PREFERIR_GIS = false` invierte el orden (redirección principal, GIS en «Entrar de otra forma»).
  - `hojaNombre(sugerido) → Promise<{ id, nombre } | null>`: campo prellenado con `sugerido`, maxlength 40, no deja guardar vacío («Escribe tu nombre.»); `crearPerfil` + `fijarCuenta`.
  - `tarjetaSinSesion(texto, alEntrar) → HTMLElement`: `.tarjeta.pila` con `<p>` y botón «Entrar con Google» que abre `hojaEntrar()` y, si vuelve `true`, llama a `alEntrar()`.
  - Al cargar el módulo: `supabase.auth.onAuthStateChange(() => cuentaActual({ forzar: true }).then(() => window.dispatchEvent(new CustomEvent('cuenta-cambio'))))`.
  - `js/app.js`: al arrancar, `const ruta = tomarRutaPendiente(); if (ruta) location.hash = ruta;` antes del primer `pintar()`.

- [ ] **Step 1: Escribir la hoja y la tarjeta**

Sin `mostrarCodigoRecuperacion` ni formularios de código. Mensajes de error con `textoError`.

- [ ] **Step 2: Comprobar que nada se rompe en Node**

Run: `npm run comprobar`
Expected: PASS.

- [ ] **Step 3: Recorrido manual (Chrome, servidor local, API simulada)**

Run: `npx --yes http-server -p 8080 -c-1 .` y abrir `http://localhost:8080/#diario` con `GOOGLE_CLIENT_ID` vacío. Expected: en Diario aparece la tarjeta sin sesión con «Entrar con Google»; al pulsar se abre la hoja «Entrar» con un solo botón (redirección). No hace falta completar el login en este paso.

- [ ] **Step 4: Commit**

```bash
git add js/pantallas/cuenta-ui.js js/app.js js/supabase.js
git commit -m "Entrar con Google: hoja de entrada, nombre del perfil, tarjeta sin sesión y ruta pendiente"
```

---

### Task 9: Diario y Ajustes con cuenta de Google

**Files:**
- Modify: `js/pantallas/diario.js`
- Modify: `js/pantallas/ajustes.js:36-120` (bloques «Este dispositivo» y «Mi cuenta»)
- Modify: `css/componentes.css` (quitar `.recuperacion-codigo`, `.diario-comp`, `.diario-comp__zona`, `.campo--marca`)

**Interfaces:**
- Consumes: Tareas 6–8.
- Produces:
  - `sincronizarYa() → { subidas, fallidas, sinSesion? }` (`sinSesion: true` cuando hay borradores y no hay perfil; antes `sinPerfil`).
  - Diario: sin `compartirCaja`, sin `hojaCompartirSalida`, sin etiquetas «Privada/Compartida con…» en las tarjetas (la etiqueta pasa a ser el nombre de la zona, como en `main`); cabecera: con perfil «Apuntas como **X**» + enlace «Grupos»; sin sesión, `tarjetaSinSesion('Entra con Google para apuntar tus salidas y verlas con tu cuadrilla.', refrescar)` en lugar de la línea de autor; el bloque de reclamo («Hay salidas de antes de las cuentas. ¿Cuáles son tuyas?») igual que en la rama, con el texto «Pasarán a ser tuyas y las verán tus grupos.». Guardar una salida: `requerirCuenta()`; si vuelve `null`, «Entra con Google para guardar la salida.»; sin red y con nombre local, se guarda el borrador igual que en la rama.
  - Ajustes → «Este dispositivo»: «Apuntas como X» con «Cambiar» (renombrar perfil) como en la rama; el mensaje de «Subir ahora» lee `r.sinSesion` («Entra con Google para subir tus salidas.»). Ajustes → «Mi cuenta»: con perfil, texto «Has entrado con Google como **X**. Tu correo solo sirve para entrar: no se enseña a nadie. Dentro de un grupo, todos ven tus salidas; una captura de pantalla no se puede impedir, así que invita solo a gente de confianza.» y botones «Salir» (`salir` + `cuentaActual({ forzar: true })` + repintar) y «Borrar mi cuenta» (`confirm('Se borrarán tus salidas, fotos y grupos donde seas el único miembro. No se puede deshacer. ¿Borrar la cuenta?')` → `borrarCuenta({ supabase, usuarioId })` → `location.hash = '#mapa'`); el error `ultimo_admin` se enseña con `textoError`. Sin sesión: botón «Entrar con Google» (`hojaEntrar`).

- [ ] **Step 1: Cambiar las dos pantallas y limpiar el CSS**

- [ ] **Step 2: Comprobar**

Run: `npm run comprobar`
Expected: PASS.

- [ ] **Step 3: Recorrido manual con la API simulada**

Con el servidor local y `page.route` (o Chrome con la red de Supabase cortada): Diario sin sesión → tarjeta; Ajustes sin sesión → botón entrar. Con una sesión inyectada en `localStorage` (`setas.sesion` con un usuario falso) y respuestas simuladas de `perfiles` y `mis_grupos`: Diario enseña «Apuntas como» y «Nueva salida» sin el bloque «Compartir con tus grupos».

- [ ] **Step 4: Commit**

```bash
git add js/pantallas/diario.js js/pantallas/ajustes.js css/componentes.css
git commit -m "Diario y Ajustes con cuenta de Google: sin compartir por salida, salir y borrar cuenta"
```

---

### Task 10: Grupos y Unirse con visibilidad por pertenencia

**Files:**
- Modify: `js/pantallas/grupos.js`
- Modify: `js/pantallas/unirse.js`

**Interfaces:**
- Consumes: Tareas 6–8; `salidasDelGrupo(id, { supabase, limite })`.
- Produces:
  - Grupos, lista: sin sesión → `tarjetaSinSesion('Los grupos sirven para que tu cuadrilla vea tus salidas y tú las suyas. Entra con Google para crear uno o unirte.', vistaLista)`; con sesión y sin perfil → `requerirCuenta()` antes de nada. Resto igual.
  - Grupos, página del grupo: «Salidas del grupo» = `salidasDelGrupo(id, { supabase, limite: 20 })`, tarjetas sin «solo la zona» ni etiqueta de precisión; vacío: «Las salidas de los miembros aparecerán aquí según las vayan apuntando.»; confirmaciones de expulsar/salir: «Sus salidas dejarán de verse en el grupo.» / «Tus salidas dejarán de verse en este grupo.».
  - Unirse: texto «Te han invitado a un grupo de Setas. Al unirte, sus miembros verán tus salidas y tú las suyas.»; «Unirme al grupo» → `requerirCuenta()` (que, por redirección, guarda y restaura `#unirse/CODIGO`) → `unirseAGrupo` → `#grupos/<id>`.

- [ ] **Step 1: Cambiar las dos pantallas**

- [ ] **Step 2: Comprobar**

Run: `npm run comprobar`
Expected: PASS.

- [ ] **Step 3: Recorrido manual con la API simulada**

`#unirse/ABCD2345` sin sesión → «Unirme» abre la hoja «Entrar»; cerrar la hoja deja la pantalla en la invitación (hash intacto). Con sesión simulada y `unirse_grupo` → `'g1'`, pulsar lleva a `#grupos/g1`.

- [ ] **Step 4: Commit**

```bash
git add js/pantallas/grupos.js js/pantallas/unirse.js
git commit -m "Grupos y Unirse: todo lo del grupo es del grupo"
```

---

### Task 11: Documentación y guion de despliegue

**Files:**
- Modify: `docs/supabase.md` (sección «Cuentas y grupos» y «Pasar a cuentas»)
- Modify: `README.md` (párrafo «Arquitectura» y la línea de Diario)
- Modify: `docs/superpowers/specs/2026-10-02-grupos-design.md` (cabecera: «Sustituida por 2026-10-22-cuadrillas-design.md»)

**Interfaces:**
- Produces: guion de despliegue que seguirá la usuaria (o Gonzalo), con los pasos de panel marcados como manuales.

- [ ] **Step 1: Reescribir «Cuentas y grupos» en `docs/supabase.md`**

Identidad (Google: GIS + `signInWithIdToken`, nonce, respaldo por redirección; qué guarda Auth y qué no se enseña), datos (`perfiles`, `grupos`, `miembros`, `salidas.usuario_id` con cascada; lectura por `salidas_del_grupo` paginada; `borrar_cuenta`), fotos (bucket privado tras el cierre, `puede_ver_foto` por pertenencia), límites, pruebas SQL. Quitar todo lo de anónimos y códigos de recuperación, incluido el aviso «Nunca ejecutes la limpieza de usuarios anónimos».

- [ ] **Step 2: Reescribir «Pasar a cuentas (orden de despliegue)»**

1. (Manual) Google Cloud: cliente OAuth «aplicación web» con orígenes `https://gonzalotsainz-ux.github.io` y `http://localhost:8080`; URI de redirección `https://ctgedeunquvmcfqsufjj.supabase.co/auth/v1/callback`; pantalla de consentimiento **publicada**. Copiar el ID de cliente a `GOOGLE_CLIENT_ID` en `js/config.js`.
2. (Manual) Supabase → Authentication → Providers → Google: activar, pegar ID y secreto, y el ID también en «Authorized Client IDs»; Authentication → URL Configuration: Site URL `https://gonzalotsainz-ux.github.io/setas/`, Redirect URLs esa misma y `http://localhost:8080/`.
3. `npx --yes supabase@latest migration list` (con `SUPABASE_ACCESS_TOKEN` en la terminal): confirmar que `20261004000100` está aplicada y que no hay ninguna `20261005*`/`20261006*`. Después `db push` (aplica `20261005*`; compatible con la app antigua).
4. Fusionar `grupos` en `main` y subir (Pages despliega).
5. Cada uno entra con Google, confirma su nombre y pulsa el suyo en «¿Cuáles son tuyas?». Uno crea «familia» y el otro entra por el enlace.
6. `db query --linked "select count(*) from public.salidas where usuario_id is null"` → `0`.
7. `git mv supabase/pendientes/20261006000000_cerrar_acceso_abierto.sql supabase/migrations/` y `db push`.
8. Revocar el access token cuando termine (pendiente desde septiembre).

- [ ] **Step 3: README**

«Arquitectura»: «**Cuentas y grupos.** Se entra con Google. Las salidas son de su dueño y las ven todos los miembros de sus grupos; sin cuenta se consulta el mapa, pero no el diario. Hasta aplicar la migración de cierre el diario sigue abierto: ver docs/supabase.md.» Línea de Diario: «salidas con foto, de cada uno, visibles para su cuadrilla, con borrador local si no hay cobertura».

- [ ] **Step 4: Commit**

```bash
git add docs README.md
git commit -m "Docs: cuentas de Google, visibilidad por grupo y guion de despliegue"
```

---

### Task 12: Prueba en iPhone instalado y elección de `PREFERIR_GIS`

**Files:**
- Modify: `js/pantallas/cuenta-ui.js` (`PREFERIR_GIS`), `docs/superpowers/specs/2026-10-22-cuadrillas-design.md` §2 (resultado)

**Interfaces:**
- Produces: la constante fijada por lo observado, y el resultado anotado en la spec.

Esta tarea tiene **pasos que solo puede dar la usuaria** (paneles de Google y Supabase, iPhone). El ejecutor prepara, pide y espera.

- [ ] **Step 1: Sitio temporal en Netlify**

Run (desde el worktree): `TMP=$(mktemp -d) && git archive HEAD | tar -x -C "$TMP" && npx netlify-cli deploy --dir="$TMP" --site setas-prueba --prod` (crear antes el sitio con `npx netlify-cli sites:create --name setas-prueba` si no existe).
Expected: URL `https://setas-prueba.netlify.app`.

- [ ] **Step 2: (Manual, usuaria) Añadir ese origen**

En Google Cloud: origen autorizado `https://setas-prueba.netlify.app`. En Supabase: Redirect URL `https://setas-prueba.netlify.app/`. Antes hay que haber hecho los pasos 1 y 2 del guion de la Tarea 11 (cliente OAuth, proveedor activado, `GOOGLE_CLIENT_ID` en `js/config.js` y redesplegar el sitio temporal con el valor).

- [ ] **Step 3: (Manual, usuaria) Probar en el iPhone**

Abrir la URL en Safari, «Añadir a pantalla de inicio», abrir la app instalada, Diario → «Entrar con Google» (botón GIS). Anotar: (a) ¿se abre la ventana de Google dentro de la app o salta a Safari? (b) al terminar, ¿Diario enseña «Apuntas como…» dentro de la app instalada? Repetir con «Entrar de otra forma» (redirección) tras «Salir».

- [ ] **Step 4: Fijar la constante y anotar**

Si (a) y (b) van bien con GIS: `PREFERIR_GIS = true` (ya está). Si GIS salta a Safari o la sesión no queda en la app y la redirección sí funciona: `PREFERIR_GIS = false`. Si ninguna de las dos deja la sesión en la app instalada: parar y volver a la usuaria (la spec §2 lo contempla como no comprobado). Añadir en la spec §2 una línea «Probado el <fecha> en iPhone instalado: <resultado>». Borrar el sitio temporal (`npx netlify-cli sites:delete setas-prueba`) y quitar su origen de Google y Supabase.

- [ ] **Step 5: Commit**

```bash
git add js/pantallas/cuenta-ui.js docs/superpowers/specs/2026-10-22-cuadrillas-design.md
git commit -m "Entrada con Google: forma preferida según la prueba en iPhone instalado"
```

---

### Task 13: Revisión final de la rama y entrega

- [ ] **Step 1: Suites completas**

Run: `npm run comprobar && npm run probar:sql`
Expected: todo en verde.

- [ ] **Step 2: Buscar restos**

Run: `grep -rn "recuperaci\|signInAnonymously\|salida_grupos\|compartir_salida\|ubicacion_exacta\|solo la zona" js css docs/supabase.md README.md tests supabase | grep -v "superpowers"`
Expected: ninguna coincidencia fuera de `docs/superpowers/`.

- [ ] **Step 3: Entregar**

Rama `grupos` lista para la revisión de la usuaria. La fusión en `main` y el `db push` se hacen con el guion de la Tarea 11, no en este plan.

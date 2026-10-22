-- Lectura del grupo por pertenencia (docs/superpowers/specs/2026-10-22-cuadrillas-design.md §3):
-- se ve lo de quien es miembro ahora, por función paginada; la tabla solo la lee su dueño.
select t.como(1); select public.crear_perfil('Ana');
select t.como(2); select public.crear_perfil('Beto');
select t.como(3); select public.crear_perfil('Cris');
select t.como(1);
do $$
declare r record;
begin
  select * into r from public.crear_grupo('Amigos');
  insert into t.codigos values ('g', r.codigo), ('gid', r.grupo_id::text);
end $$;
select t.como(2);
select public.unirse_grupo((select valor from t.codigos where clave = 'g'));
-- Norte: Beto y Cris.
do $$
declare r record;
begin
  select * into r from public.crear_grupo('Norte');
  insert into t.codigos values ('n', r.codigo), ('nid', r.grupo_id::text);
end $$;
select t.como(3);
select public.unirse_grupo((select valor from t.codigos where clave = 'n'));

-- Ana apunta una salida con una foto, meteo e índice.
select t.como(1);
insert into public.salidas (id, usuario_id, fecha, zona_id, lat, lon, especies, notas, meteo, indice, autor)
values ('11111111-1111-4111-8111-111111111111', t.uid(1), '2026-10-10', 'soria', 41.76, -2.46,
  '[{"especie_id":"boletus-edulis","kg":1}]', 'Pinar', '{"punto":"p1","serie":{"hoy":1}}',
  '{"punto":"p1","valor":72,"etiqueta":"Muy buena"}', 'Ana');
insert into public.fotos (salida_id, ruta, ancho, alto) values ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111/1.jpg', 10, 8);

-- Beto ve la salida entera; no lee las tablas base ni edita.
select t.como(2);
do $$
declare s record; g uuid := (select valor from t.codigos where clave = 'gid')::uuid; n int;
begin
  select * into s from public.salidas_del_grupo(g);
  perform t.afirma(s.lat = 41.76 and s.lon = -2.46 and s.autor = 'Ana' and jsonb_array_length(s.fotos) = 1, 'Beto ve la salida de Ana entera, con coordenadas');
  perform t.afirma(s.zona_id = 'soria' and s.usuario_id = t.uid(1), 'zona y dueño');
  perform t.afirma((select count(*) from public.salidas) = 0, 'Beto no lee la tabla salidas');
  perform t.afirma((select count(*) from public.fotos) = 0, 'Beto no lee la tabla fotos');
  update public.salidas set notas = 'robada' where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  perform t.afirma(n = 0, 'Beto no edita la salida de Ana');
  delete from public.salidas where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  perform t.afirma(n = 0, 'Beto no borra la salida de Ana');
end $$;

-- Cris (fuera de Amigos) no lee el grupo.
select t.como(3);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.falla(format('select * from public.salidas_del_grupo(%L)', g), 'no_miembro');
end $$;

-- Beto apunta dos salidas (creado distinto): Cris las ve en Norte, Ana en Amigos.
select t.como(2);
insert into public.salidas (id, usuario_id, fecha, zona_id, creado) values
  ('22222222-2222-4222-8222-222222222222', t.uid(2), '2026-10-11', 'soria', now() - interval '1 hour'),
  ('23232323-2323-4323-8323-232323232323', t.uid(2), '2026-10-12', 'soria', now() - interval '2 hours');
select t.como(3);
do $$
declare n uuid := (select valor from t.codigos where clave = 'nid')::uuid;
begin
  perform t.afirma((select count(*) from public.salidas_del_grupo(n)) = 2, 'Cris ve las dos salidas de Beto en Norte');
end $$;
select t.como(1);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.afirma((select count(*) from public.salidas_del_grupo(g)) = 3, 'Ana ve las tres en Amigos');
end $$;

-- Paginación: 3 salidas en Amigos (Ana la más reciente, luego las de Beto).
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid; c timestamptz; r uuid[];
begin
  select array_agg(id order by creado desc) into r from public.salidas_del_grupo(g, null, 2);
  perform t.afirma(array_length(r, 1) = 2 and r[1] = '11111111-1111-4111-8111-111111111111' and r[2] = '22222222-2222-4222-8222-222222222222',
    'página 1: las 2 más recientes');
  select creado into c from public.salidas_del_grupo(g, null, 2) order by creado limit 1;
  select array_agg(id) into r from public.salidas_del_grupo(g, c, 2);
  perform t.afirma(array_length(r, 1) = 1 and r[1] = '23232323-2323-4323-8323-232323232323', 'página 2 (cursor): solo la 3.ª');
  perform t.afirma((select count(*) from public.salidas_del_grupo(g, null, 0)) = 1, 'p_limite 0 se acota a 1');
  perform t.afirma((select count(*) from public.salidas_del_grupo(g, null, 1000)) = 3, 'p_limite 1000 se acota a 100 (devuelve las 3)');
  perform t.afirma((select count(*) from public.salidas_del_grupo(g, null, null)) = 3, 'p_limite nulo: valor por defecto');
end $$;

-- La función no tiene columna meteo ni indice.
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.falla(format('select meteo from public.salidas_del_grupo(%L)', g), 'does not exist');
  perform t.falla(format('select indice from public.salidas_del_grupo(%L)', g), 'does not exist');
end $$;

-- Expulsar a Beto de Amigos: Ana deja de ver las de Beto allí; Cris las sigue viendo en Norte.
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform public.expulsar_miembro(g, t.uid(2));
  perform t.afirma((select count(*) from public.salidas_del_grupo(g)) = 1, 'expulsado: sus salidas desaparecen de Amigos');
end $$;
select t.como(3);
do $$
declare n uuid := (select valor from t.codigos where clave = 'nid')::uuid;
begin
  perform t.afirma((select count(*) from public.salidas_del_grupo(n)) = 2, 'pero en Norte siguen');
end $$;
select t.como(2);
do $$
begin
  perform t.afirma((select count(*) from public.salidas) = 2, 'Beto sigue viendo sus salidas');
end $$;

-- anon no ejecuta la API de grupos; compartir_salida ya no existe.
select t.anonimo();
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.falla(format('select * from public.salidas_del_grupo(%L)', g), 'permission denied');
  perform t.falla('select * from public.mis_grupos()', 'permission denied');
  perform t.falla('select * from public.salidas_sin_dueno()', 'permission denied');
end $$;
select t.admin();
do $$
begin
  perform t.afirma(not exists (select 1 from pg_proc where proname = 'compartir_salida'), 'compartir_salida no existe');
  perform t.afirma(to_regclass('public.salida_grupos') is null, 'salida_grupos no existe');
end $$;

-- Reclamo de las salidas anteriores a las cuentas.
insert into public.salidas (id, fecha, zona_id, autor) values
  ('33333333-3333-4333-8333-333333333333', '2026-09-01', 'soria', 'Cris'),
  ('44444444-4444-4444-8444-444444444444', '2026-09-02', 'soria', 'Cris'),
  ('55555555-5555-4555-8555-555555555555', '2026-09-03', 'soria', null);
select t.como(99);
do $$ begin perform t.falla('select public.reclamar_salidas(''Cris'')', 'sin_perfil'); end $$;
select t.como(3);
do $$
begin
  perform t.afirma((select count(*) from public.salidas) = 0, 'las salidas sin dueño no las ve nadie');
  perform t.afirma((select count(*) from public.salidas_sin_dueno()) = 2, 'hay dos nombres sin reclamar (Cris y sin nombre)');
  perform t.afirma(public.reclamar_salidas('Cris') = 2, 'Cris reclama sus dos salidas');
  perform t.afirma(public.reclamar_salidas('Cris') = 0, 'reclamar otra vez no hace nada');
  perform t.afirma((select count(*) from public.salidas) = 2, 'ahora Cris las ve');
  perform t.afirma(public.reclamar_salidas('') = 1, 'las salidas sin nombre se reclaman con el nombre vacío');
end $$;

-- Compartir salidas: solo el dueño ve la tabla; el grupo lee por función, que nunca devuelve meteo ni índice.
select t.como(1); do $$ begin insert into t.codigos values ('ana', public.crear_perfil('Ana')); end $$;
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

-- Ana apunta una salida con una foto.
select t.como(1);
insert into public.salidas (id, usuario_id, fecha, zona_id, lat, lon, especies, notas, meteo, indice, autor)
values ('11111111-1111-4111-8111-111111111111', t.uid(1), '2026-10-10', 'soria', 41.76, -2.46,
  '[{"especie_id":"boletus-edulis","kg":1}]', 'Pinar', '{"punto":"p1","serie":{"hoy":1}}',
  '{"punto":"p1","valor":72,"etiqueta":"Muy buena"}', 'Ana');
insert into public.fotos (salida_id, ruta, ancho, alto) values ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111/1.jpg', 10, 8);

-- Privada: nadie más la ve, ni por la tabla ni por el grupo.
select t.como(2);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid; n int;
begin
  perform t.afirma((select count(*) from public.salidas) = 0, 'Beto no ve la salida de Ana en la tabla');
  perform t.afirma((select count(*) from public.fotos) = 0, 'Beto no ve las fotos de Ana');
  perform t.afirma((select count(*) from public.salidas_del_grupo(g)) = 0, 'sin compartir, el grupo no la ve');
  update public.salidas set notas = 'robada' where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  perform t.afirma(n = 0, 'Beto no puede editar la salida de Ana');
  delete from public.salidas where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  perform t.afirma(n = 0, 'Beto no puede borrar la salida de Ana');
  perform t.falla('insert into public.salidas (id, usuario_id, fecha, zona_id) values (gen_random_uuid(), ''' || t.uid(1) || ''', ''2026-10-10'', ''x'')', 'row-level security');
end $$;

-- Ana comparte con el punto exacto.
select t.como(1);
select public.compartir_salida('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(jsonb_build_object('grupo_id', (select valor from t.codigos where clave = 'gid'), 'ubicacion_exacta', true)));
select t.como(2);
do $$
declare s record; g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  select * into s from public.salidas_del_grupo(g);
  perform t.afirma(s.lat = 41.76 and s.lon = -2.46, 'punto exacto: coordenadas visibles');
  perform t.afirma(s.meteo is null and s.indice is null, 'punto exacto: la función del grupo no devuelve meteo ni índice');
  perform t.afirma(s.autor = 'Ana' and s.zona_id = 'soria' and jsonb_array_length(s.fotos) = 1, 'autor, zona y fotos');
  perform t.afirma(s.ubicacion_exacta, 'marcada como exacta');
end $$;

-- Un miembro del grupo (no el dueño) no lee la tabla de reparto: solo lo ve el dueño.
select t.como(2);
do $$
begin
  perform t.afirma((select count(*) from public.salida_grupos) = 0, 'Beto (miembro) no lee salida_grupos mientras la salida está compartida');
end $$;
select t.como(1);
do $$
begin
  perform t.afirma((select count(*) from public.salida_grupos) = 1, 'Ana (dueña) sí ve el reparto de su salida');
end $$;

-- anon no ejecuta la API de grupos ni lee los intentos fallidos.
select t.anonimo();
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.falla(format('select * from public.salidas_del_grupo(%L)', g), 'permission denied');
  perform t.falla('select * from public.mis_grupos()', 'permission denied');
  perform t.falla('select * from public.intentos_codigo', 'permission denied');
end $$;

-- Ana pasa a «solo la zona»: ni coordenadas, ni meteo, ni índice (revelaría el punto de la zona más cercano).
select t.como(1);
select public.compartir_salida('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(jsonb_build_object('grupo_id', (select valor from t.codigos where clave = 'gid'), 'ubicacion_exacta', false)));
select t.como(2);
do $$
declare s record; g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  select * into s from public.salidas_del_grupo(g);
  perform t.afirma(s.lat is null and s.lon is null, 'solo la zona: sin coordenadas');
  perform t.afirma(s.meteo is null, 'solo la zona: sin meteo');
  perform t.afirma(s.indice is null, 'solo la zona: sin índice');
  perform t.afirma(s.zona_id = 'soria' and s.ubicacion_exacta = false, 'la zona sí se ve');
end $$;

-- Cris (de fuera) y los permisos de compartir.
select t.como(3);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.falla(format('select * from public.salidas_del_grupo(%L)', g), 'no_miembro');
  perform t.falla(format('select public.compartir_salida(%L, ''[]'')', '11111111-1111-4111-8111-111111111111'), 'no_es_tuya');
end $$;
select t.como(1);
do $$
begin
  perform t.falla(format('select public.compartir_salida(%L, %L)', '11111111-1111-4111-8111-111111111111',
    jsonb_build_array(jsonb_build_object('grupo_id', gen_random_uuid(), 'ubicacion_exacta', true))), 'no_miembro');
end $$;

-- Dejar de compartir (conjunto vacío).
select t.como(1);
select public.compartir_salida('11111111-1111-4111-8111-111111111111', '[]');
select t.como(2);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.afirma((select count(*) from public.salidas_del_grupo(g)) = 0, 'al dejar de compartir el grupo no la ve');
end $$;

-- Expulsado: lo que había compartido desaparece del grupo, pero sigue siendo suyo.
select t.como(2);
insert into public.salidas (id, usuario_id, fecha, zona_id) values ('22222222-2222-4222-8222-222222222222', t.uid(2), '2026-10-11', 'soria');
select public.compartir_salida('22222222-2222-4222-8222-222222222222',
  jsonb_build_array(jsonb_build_object('grupo_id', (select valor from t.codigos where clave = 'gid'), 'ubicacion_exacta', true)));
select t.como(1);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.afirma((select count(*) from public.salidas_del_grupo(g)) = 1, 'Ana ve la salida compartida por Beto');
  perform public.expulsar_miembro(g, t.uid(2));
  perform t.afirma((select count(*) from public.salidas_del_grupo(g)) = 0, 'expulsado: su salida desaparece del grupo');
end $$;
select t.como(2);
do $$
begin
  perform t.afirma((select count(*) from public.salidas) = 1, 'Beto sigue viendo su propia salida');
  perform t.afirma((select count(*) from public.salida_grupos) = 0, 'y ya no está compartida con nadie');
end $$;

-- Reclamo de las salidas anteriores a las cuentas.
select t.admin();
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

-- Recuperar la cuenta traspasa las salidas.
select t.como(7);
do $$
declare c text;
begin
  select valor into c from t.codigos where clave = 'ana';
  perform t.afirma(public.recuperar_cuenta(c), 'recupera la cuenta de Ana');
  perform t.afirma((select count(*) from public.salidas) = 1, 've la salida de Ana');
end $$;

-- Endurecimiento (4b): dos grupos con precisión distinta, índice no objeto, filas de reparto obsoletas, duplicados.
select t.como(11); select public.crear_perfil('Dora');
select t.como(12); select public.crear_perfil('Eli');
select t.como(13); select public.crear_perfil('Fran');
select t.como(11);
do $$
declare r record;
begin
  select * into r from public.crear_grupo('GA'); insert into t.codigos values ('ga', r.codigo), ('gaid', r.grupo_id::text);
  select * into r from public.crear_grupo('GB'); insert into t.codigos values ('gb', r.codigo), ('gbid', r.grupo_id::text);
end $$;
select t.como(12); select public.unirse_grupo((select valor from t.codigos where clave = 'ga'));
select t.como(13); select public.unirse_grupo((select valor from t.codigos where clave = 'gb'));
select t.como(12);
do $$ declare r record; begin select * into r from public.crear_grupo('GE'); insert into t.codigos values ('geid', r.grupo_id::text); end $$;

select t.como(11);
insert into public.salidas (id, usuario_id, fecha, zona_id, lat, lon, meteo, indice, autor)
values ('66666666-6666-4666-8666-666666666666', t.uid(11), '2026-10-12', 'soria', 42.1, -2.1,
  '{"punto":"p2"}', '{"punto":"p2","valor":55}', 'Dora');
select public.compartir_salida('66666666-6666-4666-8666-666666666666', jsonb_build_array(
  jsonb_build_object('grupo_id', (select valor from t.codigos where clave = 'gaid'), 'ubicacion_exacta', true),
  jsonb_build_object('grupo_id', (select valor from t.codigos where clave = 'gbid'), 'ubicacion_exacta', false)));

select t.como(12);
do $$
declare s record; a uuid := (select valor from t.codigos where clave = 'gaid')::uuid;
begin
  perform t.afirma((select count(*) from public.salidas_del_grupo(a)) = 1, 'A: una salida');
  select * into s from public.salidas_del_grupo(a);
  perform t.afirma(s.lat = 42.1 and s.ubicacion_exacta and s.meteo is null and s.indice is null, 'miembro de A ve el punto exacto, sin meteo ni índice');
  perform t.falla(format('select * from public.salidas_del_grupo(%L)', (select valor from t.codigos where clave = 'gbid')), 'no_miembro');
end $$;
select t.como(13);
do $$
declare s record; b uuid := (select valor from t.codigos where clave = 'gbid')::uuid;
begin
  perform t.afirma((select count(*) from public.salidas_del_grupo(b)) = 1, 'B: una salida');
  select * into s from public.salidas_del_grupo(b);
  perform t.afirma(s.lat is null and s.lon is null and s.meteo is null and not s.ubicacion_exacta, 'miembro de B no ve el punto');
  perform t.afirma(s.indice is null, 'B: sin índice');
  perform t.falla(format('select * from public.salidas_del_grupo(%L)', (select valor from t.codigos where clave = 'gaid')), 'no_miembro');
end $$;

-- Índice escalar o nulo (y meteo) en la tabla: no rompe la lectura de la función, que devuelve nulo.
select t.admin();
update public.salidas set indice = '5'::jsonb where id = '66666666-6666-4666-8666-666666666666';
select t.como(13);
do $$
declare b uuid := (select valor from t.codigos where clave = 'gbid')::uuid; s record;
begin
  perform t.afirma((select count(*) from public.salidas_del_grupo(b)) = 1, 'índice escalar: sigue habiendo una fila');
  select * into s from public.salidas_del_grupo(b);
  perform t.afirma(s.indice is null, 'índice escalar en solo la zona: nulo');
end $$;
select t.admin();
update public.salidas set indice = null where id = '66666666-6666-4666-8666-666666666666';
select t.como(13);
do $$
declare b uuid := (select valor from t.codigos where clave = 'gbid')::uuid; s record;
begin
  perform t.afirma((select count(*) from public.salidas_del_grupo(b)) = 1, 'índice nulo: sigue habiendo una fila');
  select * into s from public.salidas_del_grupo(b);
  perform t.afirma(s.indice is null, 'índice nulo en solo la zona: nulo');
end $$;

-- Fila de reparto obsoleta: el dueño (Eli) no es miembro de GB.
select t.admin();
insert into public.salidas (id, usuario_id, fecha, zona_id) values ('77777777-7777-4777-8777-777777777777', t.uid(12), '2026-10-13', 'soria');
insert into public.salida_grupos (salida_id, grupo_id, ubicacion_exacta)
  values ('77777777-7777-4777-8777-777777777777', (select valor from t.codigos where clave = 'gbid')::uuid, true);
select t.como(13);
do $$
declare b uuid := (select valor from t.codigos where clave = 'gbid')::uuid;
begin
  perform t.afirma((select count(*) from public.salidas_del_grupo(b)) = 1, 'la fila obsoleta de quien no es miembro no se devuelve');
  perform t.afirma((select count(*) from public.salidas_del_grupo(b) where id = '77777777-7777-4777-8777-777777777777') = 0, 'y no es la de Eli');
end $$;

-- Validación de compartir_salida: duplicados, precisión ausente, grupo ajeno.
select t.como(11);
do $$
declare b text := (select valor from t.codigos where clave = 'gbid'); a text := (select valor from t.codigos where clave = 'gaid');
begin
  perform public.compartir_salida('66666666-6666-4666-8666-666666666666', jsonb_build_array(
    jsonb_build_object('grupo_id', b, 'ubicacion_exacta', true),
    jsonb_build_object('grupo_id', b, 'ubicacion_exacta', false),
    jsonb_build_object('grupo_id', a, 'ubicacion_exacta', true)));
  perform t.afirma((select count(*) from public.salida_grupos where salida_id = '66666666-6666-4666-8666-666666666666') = 2, 'duplicados: una fila por grupo');
  perform t.afirma((select ubicacion_exacta from public.salida_grupos where salida_id = '66666666-6666-4666-8666-666666666666' and grupo_id = b::uuid) = false, 'duplicados: gana la precisión más restrictiva');
  perform t.falla(format('select public.compartir_salida(%L, %L)', '66666666-6666-4666-8666-666666666666',
    jsonb_build_array(jsonb_build_object('grupo_id', b))), 'ubicacion_requerida');
  perform t.falla(format('select public.compartir_salida(%L, %L)', '66666666-6666-4666-8666-666666666666',
    jsonb_build_array(jsonb_build_object('grupo_id', b, 'ubicacion_exacta', null))), 'ubicacion_requerida');
  perform t.falla(format('select public.compartir_salida(%L, %L)', '66666666-6666-4666-8666-666666666666',
    jsonb_build_array(jsonb_build_object('grupo_id', (select valor from t.codigos where clave = 'geid'), 'ubicacion_exacta', true))), 'no_miembro');
  perform t.afirma((select count(*) from public.salida_grupos where salida_id = '66666666-6666-4666-8666-666666666666') = 2, 'los errores no cambian lo compartido');
  -- Reclamar con el nombre de una salida que ya es mía no toca nada.
  perform t.afirma(public.reclamar_salidas('Dora') = 0, 'reclamar lo que ya es tuyo: 0');
  perform t.afirma((select usuario_id from public.salidas where id = '66666666-6666-4666-8666-666666666666') = t.uid(11), 'la salida sigue siendo de Dora');
end $$;

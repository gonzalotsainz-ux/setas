-- Grupos: crear, unirse con código, expulsar, salir, administradores, tope de miembros y borrado de cuenta.
select t.como(1); select public.crear_perfil('Ana');
select t.como(2); select public.crear_perfil('Beto');
select t.como(3); select public.crear_perfil('Cris');
select t.como(4); select public.crear_perfil('Dani');

-- Sin perfil no se crea un grupo.
select t.como(99);
do $$ begin perform t.falla('select * from public.crear_grupo(''X'')', 'sin_perfil'); end $$;

-- Ana crea el grupo y queda como administradora.
select t.como(1);
do $$
declare r record;
begin
  select * into r from public.crear_grupo('  Amigos  ');
  insert into t.codigos values ('g', r.codigo), ('gid', r.grupo_id::text);
  perform t.afirma(char_length(r.codigo) = 8, 'el código de invitación tiene 8 caracteres');
  perform t.afirma((select nombre from public.mis_grupos()) = 'Amigos', 'el nombre se guarda recortado');
  perform t.afirma((select rol from public.mis_grupos()) = 'admin', 'quien crea es administrador');
  perform t.afirma((select codigo_invitacion from public.mis_grupos()) = r.codigo, 'la administradora ve el código de invitación');
end $$;

-- Beto se une (el código vale en minúsculas y dos veces es inocuo); un miembro no administra.
select t.como(2);
do $$
declare c text; g uuid;
begin
  select valor into c from t.codigos where clave = 'g';
  g := public.unirse_grupo(lower(c));
  perform t.afirma(g::text = (select valor from t.codigos where clave = 'gid'), 'unirse con el código en minúsculas devuelve el grupo');
  perform t.afirma((select rol from public.mis_grupos()) = 'miembro', 'quien se une es miembro');
  perform t.afirma((select codigo_invitacion from public.mis_grupos()) is null, 'un miembro corriente no ve el código de invitación (solo invita el administrador)');
  perform t.afirma((select count(*) from public.grupos) = 1, 'pero sí ve el grupo en la tabla');
  perform t.falla('select codigo_invitacion from public.grupos', 'permission denied');
  perform t.afirma(public.unirse_grupo(c) = g, 'unirse dos veces es inocuo');
  perform t.afirma((select count(*) from public.miembros_del_grupo(g)) = 2, 'dos miembros');
  perform t.afirma((select count(*) from public.mis_grupos()) = 1, 'sigue en un solo grupo');
  perform t.falla(format('select public.expulsar_miembro(%L, %L)', g, t.uid(1)), 'no_admin');
  perform t.falla(format('select public.regenerar_codigo(%L)', g), 'no_admin');
  perform t.falla(format('select public.renombrar_grupo(%L, %L)', g, 'Otro'), 'no_admin');
  perform t.falla(format('select public.hacer_admin(%L, %L)', g, t.uid(2)), 'no_admin');
  perform t.falla(format('select public.borrar_grupo(%L)', g), 'no_admin');
end $$;

-- Cris, de fuera: no ve nada; un código inexistente devuelve null.
select t.como(3);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.afirma((select count(*) from public.grupos) = 0, 'un no miembro no ve el grupo');
  perform t.afirma((select count(*) from public.miembros) = 0, 'un no miembro no ve los miembros');
  perform t.falla(format('select * from public.miembros_del_grupo(%L)', g), 'no_miembro');
  perform t.falla(format('select public.salir_grupo(%L)', g), 'no_miembro');
  perform t.afirma(public.unirse_grupo('ZZZZZZZZ') is null, 'un código inexistente devuelve null');
end $$;

-- Rondas de fuerza bruta al unirse: tras 10 fallos se rechaza.
select t.como(3);
do $$
declare i int;
begin
  for i in 1 .. 9 loop perform public.unirse_grupo('ZZZZZZZZ'); end loop;   -- ya había 1 fallo arriba: 10 en total
  perform t.falla('select public.unirse_grupo(''ZZZZZZZZ'')', 'demasiados_intentos');
end $$;

-- Ana expulsa a Beto (no puede expulsarse a sí misma).
select t.como(1);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.falla(format('select public.expulsar_miembro(%L, %L)', g, t.uid(1)), 'usa_salir');
  perform public.expulsar_miembro(g, t.uid(2));
  perform t.falla(format('select public.expulsar_miembro(%L, %L)', g, t.uid(99)), 'no_miembro');
  perform t.afirma((select count(*) from public.miembros_del_grupo(g)) = 1, 'queda un miembro');
end $$;
select t.como(2);
do $$ begin perform t.afirma((select count(*) from public.mis_grupos()) = 0, 'el expulsado ya no tiene el grupo'); end $$;

-- Regenerar el código invalida el anterior.
select t.como(1);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid; nuevo text;
begin
  nuevo := public.regenerar_codigo(g);
  insert into t.codigos values ('g2', nuevo);
  perform t.afirma(nuevo <> (select valor from t.codigos where clave = 'g') and char_length(nuevo) = 8, 'código nuevo');
  perform public.renombrar_grupo(g, '  Los de siempre ');
  perform t.afirma((select nombre from public.mis_grupos()) = 'Los de siempre', 'renombrar recorta y guarda');
end $$;
select t.como(4);
do $$
begin
  perform t.afirma(public.unirse_grupo((select valor from t.codigos where clave = 'g')) is null, 'el código viejo no vale');
  perform t.afirma(public.unirse_grupo((select valor from t.codigos where clave = 'g2')) is not null, 'el nuevo vale');
end $$;

-- El único administrador no puede salir si quedan miembros; nombra a otro y entonces sí.
select t.como(1);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform t.falla(format('select public.salir_grupo(%L)', g), 'ultimo_admin');
  perform public.hacer_admin(g, t.uid(4));
  perform public.salir_grupo(g);
  perform t.afirma((select count(*) from public.mis_grupos()) = 0, 'Ana ya no está en el grupo');
end $$;
-- El último miembro que sale borra el grupo.
select t.como(4);
do $$
declare g uuid := (select valor from t.codigos where clave = 'gid')::uuid;
begin
  perform public.salir_grupo(g);
end $$;
select t.admin();
do $$ begin perform t.afirma((select count(*) from public.grupos) = 0, 'el último en salir borra el grupo'); end $$;

-- Tope de miembros (20) y borrado por la administradora.
select t.como(1);
do $$
declare r record; i int; c text;
begin
  select * into r from public.crear_grupo('Grande');
  c := r.codigo;
  for i in 100 .. 118 loop   -- 19 miembros + la administradora = 20
    perform t.como(i);
    perform public.crear_perfil('U' || i);
    perform public.unirse_grupo(c);
  end loop;
  perform t.como(4);
  perform t.falla(format('select public.unirse_grupo(%L)', c), 'grupo_lleno');
  perform t.como(1);
  perform public.borrar_grupo(r.grupo_id);
  perform t.afirma((select count(*) from public.mis_grupos()) = 0, 'borrar el grupo lo quita');
end $$;
select t.admin();
do $$ begin perform t.afirma((select count(*) from public.miembros) = 0, 'borrar el grupo borra sus miembros'); end $$;

-- ---------- Ronda de correcciones ----------
select t.como(7); select public.crear_perfil('Gus');
select t.como(8); select public.crear_perfil('Hugo');
select t.como(9); select public.crear_perfil('Ines');

-- Tope de grupos creados por persona: 10.
select t.como(9);
do $$
declare i int;
begin
  for i in 1 .. 10 loop perform public.crear_grupo('G' || i); end loop;
  perform t.falla('select * from public.crear_grupo(''G11'')', 'demasiados_grupos');
end $$;

-- Gus administra "Norte" y "Sur"; Hugo e Ines son miembros de Norte; Ines tambien de Sur.
select t.como(7);
do $$
declare a record; b record;
begin
  select * into a from public.crear_grupo('Norte');
  select * into b from public.crear_grupo('Sur');
  insert into t.codigos values ('nn', a.codigo), ('nid', a.grupo_id::text), ('sn', b.codigo), ('sid', b.grupo_id::text);
end $$;
select t.como(8);
do $$ begin perform public.unirse_grupo((select valor from t.codigos where clave = 'nn')); end $$;
select t.como(9);
do $$ begin perform public.unirse_grupo((select valor from t.codigos where clave = 'nn')); perform public.unirse_grupo((select valor from t.codigos where clave = 'sn')); end $$;

-- Un miembro de A no puede leer B, y las escrituras directas estan denegadas.
select t.como(8);
do $$
declare b uuid := (select valor from t.codigos where clave = 'sid')::uuid;
begin
  perform t.falla(format('select * from public.miembros_del_grupo(%L)', b), 'no_miembro');
  perform t.afirma((select count(*) from public.mis_grupos()) = 1 and (select nombre from public.mis_grupos()) = 'Norte', 'solo lista su grupo');
  perform t.falla('update public.miembros set rol = ''admin''', 'permission denied');
  perform t.falla(format('insert into public.miembros (grupo_id, usuario_id, rol) values (%L, %L, ''admin'')', b, t.uid(8)), 'permission denied');
  perform t.falla('insert into public.grupos (nombre, codigo_invitacion) values (''X'', ''ABCDEFGH'')', 'permission denied');
end $$;

-- Un miembro corriente puede salir aunque el unico administrador siga alli.
select t.como(9);
do $$
declare n uuid := (select valor from t.codigos where clave = 'nid')::uuid;
begin
  perform public.salir_grupo(n);
  perform t.afirma((select count(*) from public.mis_grupos() where grupo_id = n) = 0, 'un miembro corriente puede salir');
end $$;

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
-- comprobar_borrar_cuenta avisa de antemano (la app borra las fotos de Storage antes de llamar a borrar_cuenta) y no toca nada.
do $$ begin perform t.falla('select public.comprobar_borrar_cuenta()', 'ultimo_admin'); end $$;
do $$ begin perform t.falla('select public.borrar_cuenta()', 'ultimo_admin'); end $$;
do $$ begin
  perform public.hacer_admin((select valor from t.codigos where clave = 'duo')::uuid, t.uid(22));
  perform public.comprobar_borrar_cuenta();
  perform t.afirma((select count(*) from public.salidas where usuario_id = t.uid(21)) = 1, 'comprobar_borrar_cuenta no borra nada');
  perform t.afirma(exists (select 1 from public.perfiles where id = t.uid(21)), 'comprobar_borrar_cuenta deja el perfil');
  perform public.borrar_cuenta();
end $$;
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
do $$ begin perform t.falla('select public.comprobar_borrar_cuenta()', 'permission denied'); end $$;

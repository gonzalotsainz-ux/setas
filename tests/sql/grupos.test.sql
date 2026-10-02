-- Grupos: crear, unirse con código, expulsar, salir, administradores, tope de miembros y traspaso de cuenta.
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

-- Recuperar la cuenta traspasa la pertenencia a grupos (y la administración).
select t.como(5);
do $$ begin insert into t.codigos values ('eva', public.crear_perfil('Eva')); end $$;
select t.como(5);
select public.crear_grupo('De Eva');
select t.como(6);
do $$
declare c text;
begin
  select valor into c from t.codigos where clave = 'eva';
  perform t.afirma(public.recuperar_cuenta(c), 'la sesión nueva recupera la cuenta');
  perform t.afirma((select rol from public.mis_grupos()) = 'admin', 'conserva el grupo y su rol de administradora');
end $$;
select t.como(5);
do $$ begin perform t.afirma((select count(*) from public.mis_grupos()) = 0, 'el dispositivo antiguo ya no tiene el grupo'); end $$;

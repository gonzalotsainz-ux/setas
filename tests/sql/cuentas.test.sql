-- Cuentas: perfil, código de recuperación, traspaso a otra sesión y límite de intentos.
select t.como(1);
do $$
declare c text;
begin
  c := public.crear_perfil('  Ana ');
  insert into t.codigos values ('ana', c);
  perform t.afirma(char_length(c) = 16, 'el código de recuperación tiene 16 caracteres');
  perform t.afirma(c ~ '^[0-9A-HJKMNP-TV-Z]{16}$', 'solo caracteres sin ambigüedad');
  perform t.afirma((select nombre from public.perfiles where id = t.uid(1)) = 'Ana', 'el nombre se guarda recortado');
  perform t.falla('select public.crear_perfil(''Otra'')', 'perfil_existente');
  perform t.falla('select hash_recuperacion from public.perfiles', 'permission denied');
  perform t.falla('select public.registrar_fallo(''x'')', 'permission denied');
  perform t.falla('select public.limitar_intentos(''x'')', 'permission denied');
  perform t.falla('select public.hash_codigo(''x'')', 'permission denied');
  perform t.falla('select public.codigo_aleatorio(4)', 'permission denied');
end $$;

-- Nombre vacío: la restricción lo rechaza.
select t.como(9);
do $$ begin perform t.falla('select public.crear_perfil(''   '')', 'violates check constraint'); end $$;

-- Sin sesión (anon) no se puede crear un perfil.
select t.anonimo();
do $$ begin perform t.falla('select public.crear_perfil(''X'')', 'permission denied'); end $$;

-- Una sesión nueva recupera la cuenta con el código (aunque venga en minúsculas, con guion y espacio).
select t.como(2);
do $$
declare c text;
begin
  select valor into c from t.codigos where clave = 'ana';
  perform t.afirma(public.recuperar_cuenta('0000-0000-0000-0000') = false, 'un código desconocido devuelve false');
  perform t.afirma(public.recuperar_cuenta(lower(substr(c, 1, 4) || '-' || substr(c, 5, 4) || ' ' || substr(c, 9))),
    'el código recupera aunque tenga minúsculas, guion y espacio');
  perform t.afirma((select count(*) from public.perfiles where id = t.uid(2)) = 1, 'el perfil pasó a la sesión nueva');
  perform t.afirma((select nombre from public.perfiles) = 'Ana', 'el nombre sobrevive a la recuperación');
end $$;

-- La sesión antigua queda sin perfil.
select t.como(1);
do $$
begin
  perform t.afirma((select count(*) from public.perfiles) = 0, 'la sesión antigua ya no ve ningún perfil');
  perform t.falla('select public.regenerar_recuperacion()', 'sin_perfil');
  perform t.falla('select public.renombrar_perfil(''X'')', 'sin_perfil');
end $$;

-- Regenerar invalida el código anterior.
select t.como(2);
do $$
declare viejo text; nuevo text;
begin
  select valor into viejo from t.codigos where clave = 'ana';
  nuevo := public.regenerar_recuperacion();
  insert into t.codigos values ('ana2', nuevo);
  perform t.afirma(nuevo <> viejo and char_length(nuevo) = 16, 'el código nuevo es distinto');
  perform public.renombrar_perfil('  Ana María ');
  perform t.afirma((select nombre from public.perfiles) = 'Ana María', 'renombrar recorta y guarda');
end $$;
select t.como(4);
do $$
declare viejo text; nuevo text;
begin
  select valor into viejo from t.codigos where clave = 'ana';
  select valor into nuevo from t.codigos where clave = 'ana2';
  perform t.afirma(public.recuperar_cuenta(viejo) = false, 'el código anterior deja de valer');
  perform t.afirma(public.recuperar_cuenta(nuevo), 'el código nuevo vale');
end $$;

-- Una sesión que ya tiene perfil no puede recuperar otra cuenta encima.
select t.como(5);
do $$ begin insert into t.codigos values ('beto', public.crear_perfil('Beto')); end $$;
select t.como(4);
do $$
declare c text;
begin
  select valor into c from t.codigos where clave = 'beto';
  perform t.falla(format('select public.recuperar_cuenta(%L)', c), 'sesion_con_perfil');
end $$;

-- Fuerza bruta: tras 10 fallos, el siguiente intento se rechaza (aunque el código fuese bueno).
select t.como(3);
do $$
declare i int; c text;
begin
  select valor into c from t.codigos where clave = 'beto';
  for i in 1 .. 10 loop
    perform public.recuperar_cuenta('1111-1111-1111-1111');
  end loop;
  perform t.falla(format('select public.recuperar_cuenta(%L)', c), 'demasiados_intentos');
end $$;
select t.admin();
do $$ begin perform t.afirma((select count(*) from public.intentos_codigo where tipo = 'recuperar' and uid = t.uid(3)) = 10, 'los fallos quedan registrados'); end $$;

-- GET /rpc corre en una transacción de solo lectura: ahí no se pueden registrar fallos, así que se rechaza.
select t.como(8);
begin read only;
select t.falla('select public.recuperar_cuenta(''1111-1111-1111-1111'')', 'solo_post');
rollback;

-- Cuentas ligadas al usuario de Google: perfil mínimo, sin código de recuperación.
select t.como(1);
do $$ begin
  perform public.crear_perfil('  Ana ');
  perform t.afirma((select nombre from public.perfiles where id = t.uid(1)) = 'Ana', 'el nombre se guarda recortado');
  perform t.afirma(exists (select 1 from auth.users where id = t.uid(1)), 'el entorno de pruebas crea el usuario de Auth');
  perform t.falla('select public.crear_perfil(''Otra'')', 'perfil_existente');
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
select t.como(9);
do $$ begin perform t.falla('select public.crear_perfil(''   '')', 'violates check constraint'); end $$;
select t.anonimo();
do $$ begin perform t.falla('select public.crear_perfil(''X'')', 'permission denied'); end $$;
select t.admin();
do $$ begin
  perform t.afirma(not exists (select 1 from pg_proc where proname in ('recuperar_cuenta', 'regenerar_recuperacion', 'hash_codigo')), 'las funciones del código de recuperación ya no existen');
  perform t.afirma(not exists (select 1 from information_schema.columns where table_name = 'perfiles' and column_name = 'hash_recuperacion'), 'perfiles no guarda ningún hash');
end $$;

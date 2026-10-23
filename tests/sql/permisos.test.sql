-- Permisos de EXECUTE explícitos: las funciones de la API las ejecuta `authenticated` y no `anon`;
-- los ayudantes internos no los ejecuta ninguno de los dos.
do $$
declare f text;
begin
  foreach f in array array[
    'public.crear_perfil(text)', 'public.renombrar_perfil(text)', 'public.borrar_cuenta()', 'public.comprobar_borrar_cuenta()',
    'public.es_miembro(uuid)', 'public.es_admin(uuid)', 'public.max_miembros_grupo()', 'public.crear_grupo(text)',
    'public.unirse_grupo(text)', 'public.regenerar_codigo(uuid)', 'public.renombrar_grupo(uuid, text)',
    'public.hacer_admin(uuid, uuid)', 'public.expulsar_miembro(uuid, uuid)', 'public.salir_grupo(uuid)',
    'public.borrar_grupo(uuid)', 'public.mis_grupos()', 'public.miembros_del_grupo(uuid)',
    'public.salidas_del_grupo(uuid, timestamptz, int)', 'public.salidas_sin_dueno()',
    'public.reclamar_salidas(text)',
    'public.ruta_salida_id(text)', 'public.es_mi_salida(uuid)', 'public.puede_ver_foto(text)'
  ] loop
    perform t.afirma(has_function_privilege('authenticated', f::regprocedure, 'execute'), 'authenticated ejecuta ' || f);
    perform t.afirma(not has_function_privilege('anon', f::regprocedure, 'execute'), 'anon NO ejecuta ' || f);
    perform t.afirma(not has_function_privilege('public', f::regprocedure, 'execute') , 'public NO ejecuta ' || f);
  end loop;

  foreach f in array array[
    'public.ip_cliente()', 'public.codigo_aleatorio(int)', 'public.normalizar_codigo(text)',
    'public.registrar_fallo(text)', 'public.limitar_intentos(text, int, interval)'
  ] loop
    perform t.afirma(not has_function_privilege('authenticated', f::regprocedure, 'execute'), 'authenticated NO ejecuta ' || f);
    perform t.afirma(not has_function_privilege('anon', f::regprocedure, 'execute'), 'anon NO ejecuta ' || f);
  end loop;
end $$;

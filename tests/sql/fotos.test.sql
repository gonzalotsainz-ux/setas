-- Fotos privadas: solo las ve el dueño o quien comparte algún grupo con él (spec cuadrillas §9).
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

select t.como(1);
insert into public.salidas (id, usuario_id, fecha, zona_id) values ('11111111-1111-4111-8111-111111111111', t.uid(1), '2026-10-10', 'soria');

-- Ana sube a su salida; no puede subir a la de otro ni fuera de una carpeta de salida.
insert into storage.objects (bucket_id, name) values ('fotos', '11111111-1111-4111-8111-111111111111/1.jpg');
do $$
begin
  perform t.falla('insert into storage.objects (bucket_id, name) values (''fotos'', ''no-es-un-uuid/1.jpg'')', 'row-level security');
  perform t.falla('insert into storage.objects (bucket_id, name) values (''fotos'', ''99999999-9999-4999-8999-999999999999/1.jpg'')', 'row-level security');
  perform t.falla('insert into storage.objects (bucket_id, name) values (''fotos'', ''11111111-1111-4111-8111-111111111111/1.gif'')', 'row-level security');
end $$;

-- Beto (mismo grupo) ve la foto de Ana sin que ella haga nada; el dueño la sube pero él no puede subir a su salida.
select t.como(2);
do $$
begin
  perform t.afirma((select count(*) from storage.objects) = 1, 'Beto, del mismo grupo, ve la foto de Ana');
  perform t.falla('insert into storage.objects (bucket_id, name) values (''fotos'', ''11111111-1111-4111-8111-111111111111/2.jpg'')', 'row-level security');
end $$;
-- Cris, de fuera, no.
select t.como(3);
do $$ begin perform t.afirma((select count(*) from storage.objects) = 0, 'Cris, fuera del grupo, no ve la foto'); end $$;
-- Tras expulsar a Beto (Ana es admin), deja de verla.
select t.como(1);
select public.expulsar_miembro((select valor::uuid from t.codigos where clave = 'gid'), t.uid(2));
select t.como(2);
do $$ begin perform t.afirma((select count(*) from storage.objects) = 0, 'Beto expulsado ya no ve la foto'); end $$;

-- Carpeta en MAYÚSCULAS: el uuid no distingue mayúsculas, así que vale para el dueño.
select t.como(1);
insert into public.salidas (id, usuario_id, fecha, zona_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', t.uid(1), '2026-10-11', 'soria');
insert into storage.objects (bucket_id, name) values ('fotos', 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA/1.jpg');

-- Actualizar: Beto (no dueño) no toca nada; Ana sí, pero sin renombrar a .gif ni a la carpeta de otro.
select t.como(2);
do $$
declare n int;
begin
  update storage.objects set owner = t.uid(1) where name like '11111111%';
  get diagnostics n = row_count;
  perform t.afirma(n = 0, 'Beto no puede actualizar la foto de Ana');
end $$;
select t.como(1);
do $$
declare n int;
begin
  update storage.objects set owner = t.uid(1) where name = '11111111-1111-4111-8111-111111111111/1.jpg';
  get diagnostics n = row_count;
  perform t.afirma(n = 1, 'Ana sí puede actualizar los metadatos de la suya');
  perform t.falla('update storage.objects set name = ''11111111-1111-4111-8111-111111111111/1.gif'' where name = ''11111111-1111-4111-8111-111111111111/1.jpg''', 'row-level security');
  perform t.falla('update storage.objects set name = ''99999999-9999-4999-8999-999999999999/1.jpg'' where name = ''11111111-1111-4111-8111-111111111111/1.jpg''', 'row-level security');
end $$;

-- anon no lee, no escribe, no actualiza y no borra mientras hay objetos (propios).
select t.anonimo();
do $$
declare n int;
begin
  perform t.afirma((select count(*) from storage.objects) = 0, 'anon no ve objetos existentes');
  perform t.falla('insert into storage.objects (bucket_id, name) values (''fotos'', ''11111111-1111-4111-8111-111111111111/3.jpg'')', 'row-level security');
  update storage.objects set owner = t.uid(1);
  get diagnostics n = row_count;
  perform t.afirma(n = 0, 'anon no actualiza objetos');
  delete from storage.objects;
  get diagnostics n = row_count;
  perform t.afirma(n = 0, 'anon no borra objetos');
end $$;
select t.admin();
do $$ begin perform t.afirma((select count(*) from storage.objects) = 2, 'los objetos siguen ahí tras los intentos de anon'); end $$;

-- Beto no puede borrar la foto de Ana.
select t.como(2);
do $$
declare n int;
begin
  delete from storage.objects where name like '11111111%';
  get diagnostics n = row_count;
  perform t.afirma(n = 0, 'Beto no puede borrar la foto de Ana');
end $$;

-- Ana la borra.
select t.como(1);
do $$
declare n int;
begin
  delete from storage.objects where name like '11111111%';
  get diagnostics n = row_count;
  perform t.afirma(n = 1, 'Ana sí puede borrar la suya');
end $$;

-- El bucket es privado y anon no toca las tablas.
select t.admin();
do $$ begin perform t.afirma((select public from storage.buckets where id = 'fotos') = false, 'el bucket fotos es privado'); end $$;
select t.anonimo();
do $$
begin
  perform t.falla('select * from public.salidas', 'permission denied');
  perform t.falla('select * from public.fotos', 'permission denied');
end $$;

-- Los umbrales siguen siendo comunes (fuera de esta fase): anon lee; un autenticado escribe y borra.
do $$ begin perform t.afirma(t.n('select * from public.ajustes_umbrales') >= 0, 'anon aún lee ajustes_umbrales'); end $$;
select t.como(1);
insert into public.ajustes_umbrales (especie_id, parametros) values ('zz-prueba', '{}');
do $$
declare n int;
begin
  perform t.afirma(t.n('select * from public.ajustes_umbrales where especie_id = ''zz-prueba''') = 1, 'autenticado escribe ajustes_umbrales');
  delete from public.ajustes_umbrales where especie_id = 'zz-prueba';
  get diagnostics n = row_count;
  perform t.afirma(n = 1, 'autenticado borra ajustes_umbrales');
end $$;

-- Cierre del acceso abierto (docs/superpowers/specs/2026-10-02-grupos-design.md §6, paso 4).
-- NO está en supabase/migrations/ a propósito: se mueve allí (git mv) y se aplica con `db push` solo cuando todas las
-- salidas tienen dueño y la app nueva está desplegada. Ver docs/supabase.md, «Pasar a cuentas».
do $$
begin
  if exists (select 1 from public.salidas where usuario_id is null) then
    raise exception 'Quedan salidas sin dueño: reclámalas antes de cerrar el acceso abierto';
  end if;
end $$;

drop policy "abierto salidas" on public.salidas;
drop policy "abierto fotos" on public.fotos;
revoke all on public.salidas, public.fotos from anon;

-- ---------- Fotos privadas ----------
update storage.buckets set public = false where id = 'fotos';
drop policy "fotos: ver" on storage.objects;
drop policy "fotos: subir" on storage.objects;
drop policy "fotos: cambiar" on storage.objects;
drop policy "fotos: borrar" on storage.objects;

-- Las rutas son <salida_id>/<n>.jpg: el permiso sale de la salida, no de la carpeta.
create function public.ruta_salida_id(p_ruta text) returns uuid language sql immutable as $$
  select case when split_part(p_ruta, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_ruta, '/', 1)::uuid end
$$;
create function public.es_mi_salida(p_salida uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from salidas where id = p_salida and usuario_id = auth.uid())
$$;
create function public.puede_ver_foto(p_ruta text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from salidas s
    where s.id = public.ruta_salida_id(p_ruta)
      and (s.usuario_id = auth.uid()
           or exists (select 1 from salida_grupos sg join miembros m on m.grupo_id = sg.grupo_id
                      where sg.salida_id = s.id and m.usuario_id = auth.uid()))
  )
$$;
revoke execute on function public.ruta_salida_id(text), public.es_mi_salida(uuid), public.puede_ver_foto(text) from public, anon;

create policy "fotos: ver" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.puede_ver_foto(name));
create policy "fotos: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and lower(name) ~ '\.(jpe?g|webp)$' and public.es_mi_salida(public.ruta_salida_id(name)));
create policy "fotos: cambiar" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.es_mi_salida(public.ruta_salida_id(name)))
  with check (bucket_id = 'fotos' and lower(name) ~ '\.(jpe?g|webp)$' and public.es_mi_salida(public.ruta_salida_id(name)));
create policy "fotos: borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.es_mi_salida(public.ruta_salida_id(name)));

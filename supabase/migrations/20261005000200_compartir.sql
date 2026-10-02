-- Visibilidad de las salidas (docs/superpowers/specs/2026-10-02-grupos-design.md §4 y §5).
-- Las políticas «abiertas» de la migración original siguen activas hasta la migración de cierre
-- (supabase/pendientes/20261006000000_cerrar_acceso_abierto.sql): las políticas de abajo ya son las definitivas.

create policy "salidas: dueño" on public.salidas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "fotos: dueño de la salida" on public.fotos for all to authenticated
  using (exists (select 1 from public.salidas s where s.id = salida_id and s.usuario_id = auth.uid()))
  with check (exists (select 1 from public.salidas s where s.id = salida_id and s.usuario_id = auth.uid()));

-- Reemplaza con qué grupos se comparte una salida (conjunto completo, atómico).
create function public.compartir_salida(p_salida uuid, p_grupos jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from salidas where id = p_salida and usuario_id = auth.uid()) then raise exception 'no_es_tuya'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_grupos) as x (grupo_id uuid, ubicacion_exacta boolean)
    where x.grupo_id is null or not public.es_miembro(x.grupo_id)
  ) then raise exception 'no_miembro'; end if;
  delete from salida_grupos sg
   where sg.salida_id = p_salida
     and not exists (select 1 from jsonb_to_recordset(p_grupos) as x (grupo_id uuid, ubicacion_exacta boolean) where x.grupo_id = sg.grupo_id);
  insert into salida_grupos (salida_id, grupo_id, ubicacion_exacta)
    select p_salida, x.grupo_id, coalesce(x.ubicacion_exacta, true)
    from jsonb_to_recordset(p_grupos) as x (grupo_id uuid, ubicacion_exacta boolean)
  on conflict (salida_id, grupo_id) do update set ubicacion_exacta = excluded.ubicacion_exacta;
end $$;

-- Lo que ve un miembro: sin coordenadas, sin meteo y sin el punto del índice cuando se compartió «solo la zona».
-- (Una policy no puede ocultar columnas: por eso se lee por función y no por la tabla.)
create function public.salidas_del_grupo(p_grupo uuid)
returns table (id uuid, usuario_id uuid, autor text, fecha date, zona_id text, lat double precision, lon double precision,
  ubicacion_exacta boolean, especies jsonb, notas text, meteo jsonb, indice jsonb, fotos jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_miembro(p_grupo) then raise exception 'no_miembro'; end if;
  return query
    select s.id, s.usuario_id, p.nombre, s.fecha, s.zona_id,
           case when sg.ubicacion_exacta then s.lat end,
           case when sg.ubicacion_exacta then s.lon end,
           sg.ubicacion_exacta, s.especies, s.notas,
           case when sg.ubicacion_exacta then s.meteo end,
           case when sg.ubicacion_exacta then s.indice else s.indice - 'punto' end,
           coalesce((select jsonb_agg(jsonb_build_object('ruta', f.ruta, 'ancho', f.ancho, 'alto', f.alto) order by f.ruta)
                     from fotos f where f.salida_id = s.id), '[]'::jsonb)
    from salida_grupos sg
    join salidas s on s.id = sg.salida_id
    join perfiles p on p.id = s.usuario_id
    where sg.grupo_id = p_grupo
    order by s.fecha desc, s.creado desc;
end $$;

-- Reclamo de las salidas anteriores a las cuentas (usuario_id nulo), por el nombre de autor que llevaban.
create function public.salidas_sin_dueno() returns table (autor text, n bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(s.autor, ''), count(*) from salidas s where s.usuario_id is null group by coalesce(s.autor, '') order by 1
$$;

create function public.reclamar_salidas(p_autor text) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then raise exception 'sin_perfil'; end if;
  update salidas set usuario_id = auth.uid() where usuario_id is null and coalesce(autor, '') = coalesce(p_autor, '');
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.compartir_salida(uuid, jsonb), public.salidas_del_grupo(uuid),
  public.salidas_sin_dueno(), public.reclamar_salidas(text) from public, anon;

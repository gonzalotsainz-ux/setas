-- Lectura del grupo por pertenencia (docs/superpowers/specs/2026-10-22-cuadrillas-design.md §3).
-- Un miembro ve las salidas de quienes son miembros del grupo ahora, completas (coordenadas y fotos), sin reparto por salida.
-- Las políticas «abiertas» de la migración original siguen activas hasta la migración de cierre
-- (supabase/pendientes/20261006000000_cerrar_acceso_abierto.sql): las políticas de abajo ya son las definitivas.

create policy "salidas: dueño" on public.salidas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "fotos: dueño de la salida" on public.fotos for all to authenticated
  using (exists (select 1 from public.salidas s where s.id = salida_id and s.usuario_id = auth.uid()))
  with check (exists (select 1 from public.salidas s where s.id = salida_id and s.usuario_id = auth.uid()));

-- Salidas del grupo, de la más reciente a la más antigua, paginadas por `creado` (cursor: p_antes).
-- Una policy no puede ocultar columnas ni mirar la pertenencia de otro: por eso se lee por función y no por la tabla.
-- Sin meteo ni índice: la vista de grupo no los usa.
create function public.salidas_del_grupo(p_grupo uuid, p_antes timestamptz default null, p_limite int default 20)
returns table (id uuid, usuario_id uuid, autor text, fecha date, zona_id text, lat double precision, lon double precision,
  especies jsonb, notas text, creado timestamptz, fotos jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_miembro(p_grupo) then raise exception 'no_miembro'; end if;
  return query
    select s.id, s.usuario_id, p.nombre, s.fecha, s.zona_id, s.lat, s.lon, s.especies, s.notas, s.creado,
           coalesce((select jsonb_agg(jsonb_build_object('ruta', f.ruta, 'ancho', f.ancho, 'alto', f.alto) order by f.creado, f.ruta)
                     from fotos f where f.salida_id = s.id), '[]'::jsonb)
    from salidas s
    join perfiles p on p.id = s.usuario_id
    where exists (select 1 from miembros m where m.grupo_id = p_grupo and m.usuario_id = s.usuario_id)
      and (p_antes is null or s.creado < p_antes)
    order by s.creado desc
    limit least(greatest(coalesce(p_limite, 20), 1), 100);
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

revoke execute on function public.salidas_del_grupo(uuid, timestamptz, int),
  public.salidas_sin_dueno(), public.reclamar_salidas(text) from public, anon;
grant execute on function public.salidas_del_grupo(uuid, timestamptz, int),
  public.salidas_sin_dueno(), public.reclamar_salidas(text) to authenticated;

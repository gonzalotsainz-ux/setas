-- Cuadrillas: grupos, pertenencia y borrado de cuenta (docs/superpowers/specs/2026-10-22-cuadrillas-design.md §2-§3).
-- Todo lo del grupo es del grupo: la visibilidad va por pertenencia, sin reparto salida a salida.

create function public.max_miembros_grupo() returns int language sql immutable as $$ select 20 $$;

create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  codigo_invitacion text not null unique,
  creado_por uuid references public.perfiles (id) on update cascade on delete set null,
  creado timestamptz not null default now()
);
create table public.miembros (
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on update cascade on delete cascade,
  rol text not null check (rol in ('admin', 'miembro')),
  alta timestamptz not null default now(),
  primary key (grupo_id, usuario_id)
);
create index on public.miembros (usuario_id);

-- Dueño de cada salida: al borrar la cuenta se van con ella sus salidas (y sus fotos).
alter table public.salidas add column usuario_id uuid references public.perfiles (id) on update cascade on delete cascade;
create index on public.salidas (usuario_id);

-- ---------- Comprobaciones (security definer: no pasan por RLS, así que no hay recursión) ----------
create function public.es_miembro(p_grupo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros where grupo_id = p_grupo and usuario_id = auth.uid())
$$;
create function public.es_admin(p_grupo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros where grupo_id = p_grupo and usuario_id = auth.uid() and rol = 'admin')
$$;

alter table public.grupos enable row level security;
alter table public.miembros enable row level security;
revoke all on public.grupos, public.miembros from anon, authenticated;
grant select on public.grupos, public.miembros to authenticated;
create policy "grupos: los míos" on public.grupos for select to authenticated using (public.es_miembro(id));
create policy "miembros: de mis grupos" on public.miembros for select to authenticated using (public.es_miembro(grupo_id));

-- ---------- API ----------
create function public.crear_grupo(p_nombre text) returns table (grupo_id uuid, codigo text)
language plpgsql security definer set search_path = public, extensions as $$
declare g uuid; c text; intento int := 0;
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then raise exception 'sin_perfil'; end if;
  if (select count(*) from grupos where creado_por = auth.uid()) >= 10 then raise exception 'demasiados_grupos'; end if;
  loop
    c := public.codigo_aleatorio(8);
    begin
      insert into grupos (nombre, codigo_invitacion, creado_por) values (btrim(p_nombre), c, auth.uid()) returning id into g;
      exit;
    exception when unique_violation then
      intento := intento + 1;
      if intento > 5 then raise; end if;
    end;
  end loop;
  insert into miembros (grupo_id, usuario_id, rol) values (g, auth.uid(), 'admin');
  return query select g, c;
end $$;

create function public.unirse_grupo(p_codigo text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare g uuid;
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then raise exception 'sin_perfil'; end if;
  perform public.limitar_intentos('unirse', 10, '15 minutes');
  select id into g from grupos where codigo_invitacion = public.normalizar_codigo(p_codigo);
  if g is null then
    perform public.registrar_fallo('unirse');
    return null;
  end if;
  -- Serializa altas y bajas del mismo grupo (READ COMMITTED no bloquea nada): sin esto el tope de miembros
  -- y "un grupo siempre tiene administrador" podrían romperse con peticiones simultáneas.
  perform 1 from grupos where id = g for update;
  if exists (select 1 from miembros where grupo_id = g and usuario_id = auth.uid()) then return g; end if;
  if (select count(*) from miembros where grupo_id = g) >= public.max_miembros_grupo() then raise exception 'grupo_lleno'; end if;
  insert into miembros (grupo_id, usuario_id, rol) values (g, auth.uid(), 'miembro');
  return g;
end $$;

create function public.regenerar_codigo(p_grupo uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text;
begin
  if not public.es_admin(p_grupo) then raise exception 'no_admin'; end if;
  c := public.codigo_aleatorio(8);
  update grupos set codigo_invitacion = c where id = p_grupo;
  return c;
end $$;

create function public.renombrar_grupo(p_grupo uuid, p_nombre text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin(p_grupo) then raise exception 'no_admin'; end if;
  update grupos set nombre = btrim(p_nombre) where id = p_grupo;
end $$;

create function public.hacer_admin(p_grupo uuid, p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin(p_grupo) then raise exception 'no_admin'; end if;
  -- Serializa altas y bajas del mismo grupo (READ COMMITTED no bloquea nada): sin esto el tope de miembros
  -- y "un grupo siempre tiene administrador" podrían romperse con peticiones simultáneas.
  perform 1 from grupos where id = p_grupo for update;
  update miembros set rol = 'admin' where grupo_id = p_grupo and usuario_id = p_usuario;
  if not found then raise exception 'no_miembro'; end if;
end $$;

create function public.expulsar_miembro(p_grupo uuid, p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin(p_grupo) then raise exception 'no_admin'; end if;
  if p_usuario = auth.uid() then raise exception 'usa_salir'; end if;
  -- Serializa altas y bajas del mismo grupo (READ COMMITTED no bloquea nada): sin esto el tope de miembros
  -- y "un grupo siempre tiene administrador" podrían romperse con peticiones simultáneas.
  perform 1 from grupos where id = p_grupo for update;
  if not exists (select 1 from miembros where grupo_id = p_grupo and usuario_id = p_usuario) then raise exception 'no_miembro'; end if;
  delete from miembros where grupo_id = p_grupo and usuario_id = p_usuario;
end $$;

create function public.salir_grupo(p_grupo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare otros int; admins int;
begin
  if not public.es_miembro(p_grupo) then raise exception 'no_miembro'; end if;
  -- Serializa altas y bajas del mismo grupo (READ COMMITTED no bloquea nada): sin esto el tope de miembros
  -- y "un grupo siempre tiene administrador" podrían romperse con peticiones simultáneas.
  perform 1 from grupos where id = p_grupo for update;
  select count(*) into otros from miembros where grupo_id = p_grupo and usuario_id <> auth.uid();
  if otros = 0 then
    delete from grupos where id = p_grupo;   -- el último en salir apaga la luz (cascada a miembros)
    return;
  end if;
  select count(*) into admins from miembros where grupo_id = p_grupo and rol = 'admin' and usuario_id <> auth.uid();
  if public.es_admin(p_grupo) and admins = 0 then raise exception 'ultimo_admin'; end if;
  delete from miembros where grupo_id = p_grupo and usuario_id = auth.uid();
end $$;

create function public.borrar_grupo(p_grupo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin(p_grupo) then raise exception 'no_admin'; end if;
  delete from grupos where id = p_grupo;
end $$;

create function public.mis_grupos() returns table (grupo_id uuid, nombre text, codigo_invitacion text, rol text, miembros bigint)
language sql stable security definer set search_path = public as $$
  select g.id, g.nombre, g.codigo_invitacion, m.rol, (select count(*) from miembros x where x.grupo_id = g.id)
  from miembros m join grupos g on g.id = m.grupo_id
  where m.usuario_id = auth.uid()
  order by g.nombre
$$;

create function public.miembros_del_grupo(p_grupo uuid) returns table (usuario_id uuid, nombre text, rol text, alta timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_miembro(p_grupo) then raise exception 'no_miembro'; end if;
  return query
    select m.usuario_id, p.nombre, m.rol, m.alta
    from miembros m join perfiles p on p.id = m.usuario_id
    where m.grupo_id = p_grupo
    order by m.alta;
end $$;

-- Borra la cuenta entera: pertenencias, perfil, salidas (y sus fotos, en cascada) y el usuario de Auth.
-- Un administrador que deja a otros miembros sin ningún otro administrador no puede irse (ultimo_admin);
-- los grupos donde es el único miembro se borran con él.
create function public.borrar_cuenta() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); g record;
begin
  if uid is null then raise exception 'sin_sesion'; end if;
  if not exists (select 1 from perfiles where id = uid) then raise exception 'sin_perfil'; end if;
  for g in select grupo_id from miembros where usuario_id = uid order by grupo_id loop
    -- Serializa altas y bajas del mismo grupo, como en salir_grupo.
    perform 1 from grupos where id = g.grupo_id for update;
  end loop;
  if exists (
    select 1 from miembros yo
    where yo.usuario_id = uid and yo.rol = 'admin'
      and exists (select 1 from miembros o where o.grupo_id = yo.grupo_id and o.usuario_id <> uid)
      and not exists (select 1 from miembros a where a.grupo_id = yo.grupo_id and a.usuario_id <> uid and a.rol = 'admin')
  ) then raise exception 'ultimo_admin'; end if;
  delete from grupos g2 where exists (select 1 from miembros m where m.grupo_id = g2.id and m.usuario_id = uid)
    and not exists (select 1 from miembros o where o.grupo_id = g2.id and o.usuario_id <> uid);
  delete from perfiles where id = uid;   -- cascada: miembros y salidas (y de ahí sus fotos)
  delete from auth.users where id = uid;
end $$;

-- ---------- Permisos ----------
revoke execute on function public.es_miembro(uuid), public.es_admin(uuid), public.max_miembros_grupo(),
  public.crear_grupo(text), public.unirse_grupo(text), public.regenerar_codigo(uuid), public.renombrar_grupo(uuid, text),
  public.hacer_admin(uuid, uuid), public.expulsar_miembro(uuid, uuid), public.salir_grupo(uuid), public.borrar_grupo(uuid),
  public.mis_grupos(), public.miembros_del_grupo(uuid), public.borrar_cuenta() from public, anon;
grant execute on function public.es_miembro(uuid), public.es_admin(uuid), public.max_miembros_grupo(),
  public.crear_grupo(text), public.unirse_grupo(text), public.regenerar_codigo(uuid), public.renombrar_grupo(uuid, text),
  public.hacer_admin(uuid, uuid), public.expulsar_miembro(uuid, uuid), public.salir_grupo(uuid), public.borrar_grupo(uuid),
  public.mis_grupos(), public.miembros_del_grupo(uuid), public.borrar_cuenta() to authenticated;

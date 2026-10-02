-- Cuentas anónimas con perfil y código de recuperación (docs/superpowers/specs/2026-10-02-grupos-design.md §2).
-- Cada dispositivo tiene una sesión anónima de Supabase (auth.uid()); el perfil le pone nombre y un código de
-- recuperación (solo se guarda su hash) con el que otra sesión puede quedarse con la cuenta.

create table public.perfiles (
  id uuid primary key,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 40),
  hash_recuperacion text not null unique,
  creado timestamptz not null default now()
);
alter table public.perfiles enable row level security;
revoke all on public.perfiles from anon, authenticated;
grant select (id, nombre, creado) on public.perfiles to authenticated;   -- el hash no se lee desde la API
create policy "perfil propio: ver" on public.perfiles for select to authenticated using (id = auth.uid());

-- Fallos de «código» (recuperar cuenta, unirse a un grupo) para limitar la fuerza bruta.
create table public.intentos_codigo (
  id bigserial primary key,
  tipo text not null,
  uid uuid,
  ip text,
  momento timestamptz not null default now()
);
create index on public.intentos_codigo (momento);
alter table public.intentos_codigo enable row level security;
revoke all on public.intentos_codigo from anon, authenticated;

-- ---------- Funciones internas ----------
create function public.ip_cliente() returns text language sql stable as $$
  select nullif(split_part(coalesce((nullif(current_setting('request.headers', true), '')::json) ->> 'x-forwarded-for', ''), ',', 1), '')
$$;

-- Texto aleatorio en Crockford base32 (0-9 A-Z sin I L O U): 5 bits por carácter, sin sesgo.
create function public.codigo_aleatorio(p_largo int) returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  alfabeto constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  b bytea := gen_random_bytes(p_largo);
  r text := '';
  i int;
begin
  for i in 0 .. p_largo - 1 loop
    r := r || substr(alfabeto, (get_byte(b, i) & 31) + 1, 1);
  end loop;
  return r;
end $$;

-- Quita separadores y unifica lo que se confunde al teclear (O→0, I y L→1).
create function public.normalizar_codigo(p text) returns text language sql immutable as $$
  select translate(upper(regexp_replace(coalesce(p, ''), '[\s-]', '', 'g')), 'OIL', '011')
$$;

-- Con ~80 bits de entropía basta un SHA-256 sin sal (y permite buscar por igualdad).
create function public.hash_codigo(p text) returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(public.normalizar_codigo(p), 'sha256'), 'hex')
$$;

create function public.registrar_fallo(p_tipo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into intentos_codigo (tipo, uid, ip) values (p_tipo, auth.uid(), public.ip_cliente());
end $$;

create function public.limitar_intentos(p_tipo text, p_max int default 10, p_ventana interval default '15 minutes') returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from intentos_codigo
   where tipo = p_tipo and momento > now() - p_ventana
     and (uid = auth.uid() or (ip is not null and ip = public.ip_cliente()));
  if n >= p_max then raise exception 'demasiados_intentos'; end if;
end $$;

-- ---------- API ----------
create function public.crear_perfil(p_nombre text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare codigo text;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if exists (select 1 from perfiles where id = auth.uid()) then raise exception 'perfil_existente'; end if;
  codigo := public.codigo_aleatorio(16);
  insert into perfiles (id, nombre, hash_recuperacion) values (auth.uid(), btrim(p_nombre), public.hash_codigo(codigo));
  return codigo;
end $$;

create function public.regenerar_recuperacion() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare codigo text;
begin
  codigo := public.codigo_aleatorio(16);
  update perfiles set hash_recuperacion = public.hash_codigo(codigo) where id = auth.uid();
  if not found then raise exception 'sin_perfil'; end if;
  return codigo;
end $$;

create function public.renombrar_perfil(p_nombre text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update perfiles set nombre = btrim(p_nombre) where id = auth.uid();
  if not found then raise exception 'sin_perfil'; end if;
end $$;

-- Llamada desde una sesión NUEVA (sin perfil): se queda con el perfil del código. El resto de tablas (grupos,
-- miembros, salidas) apuntan a perfiles(id) con `on update cascade`, así que todo lo del identificador antiguo pasa
-- al nuevo; el dispositivo antiguo se queda sin perfil.
create function public.recuperar_cuenta(p_codigo text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare viejo uuid;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  perform public.limitar_intentos('recuperar', 10, '15 minutes');
  select id into viejo from perfiles where hash_recuperacion = public.hash_codigo(p_codigo);
  if viejo is null then
    perform public.registrar_fallo('recuperar');
    return false;
  end if;
  if viejo = auth.uid() then return true; end if;
  if exists (select 1 from perfiles where id = auth.uid()) then raise exception 'sesion_con_perfil'; end if;
  update perfiles set id = auth.uid() where id = viejo;
  return true;
end $$;

-- ---------- Permisos ----------
revoke execute on function public.crear_perfil(text), public.regenerar_recuperacion(),
  public.renombrar_perfil(text), public.recuperar_cuenta(text) from public, anon;
revoke execute on function public.ip_cliente(), public.codigo_aleatorio(int), public.normalizar_codigo(text),
  public.hash_codigo(text), public.registrar_fallo(text), public.limitar_intentos(text, int, interval)
  from public, anon, authenticated;

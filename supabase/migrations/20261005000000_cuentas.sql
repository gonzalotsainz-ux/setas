-- Cuentas con Google y perfil mínimo (docs/superpowers/specs/2026-10-22-cuadrillas-design.md §2).
-- El perfil cuelga del usuario de Supabase Auth (auth.uid()) y solo guarda el nombre visible: no hay códigos
-- de recuperación, la cuenta de Google ya identifica a la persona en cualquier dispositivo.

create extension if not exists pgcrypto with schema extensions;

create table public.perfiles (
  id uuid primary key,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 40),
  creado timestamptz not null default now()
);
alter table public.perfiles enable row level security;
revoke all on public.perfiles from anon, authenticated;
grant select (id, nombre, creado) on public.perfiles to authenticated;
create policy "perfil propio: ver" on public.perfiles for select to authenticated using (id = auth.uid());

-- Fallos de «código» (unirse a un grupo) para limitar la fuerza bruta.
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

create function public.registrar_fallo(p_tipo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into intentos_codigo (tipo, uid, ip) values (p_tipo, auth.uid(), public.ip_cliente());
end $$;

create function public.limitar_intentos(p_tipo text, p_max int default 10, p_ventana interval default '15 minutes') returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- PostgREST ejecuta GET /rpc/... en una transacción de solo lectura: ahí registrar_fallo no puede insertar,
  -- el límite nunca saltaría y el error delataría si el código es válido. Solo se admite POST.
  if current_setting('transaction_read_only') = 'on' then raise exception 'solo_post'; end if;
  select count(*) into n from intentos_codigo
   where tipo = p_tipo and momento > now() - p_ventana
     and (uid = auth.uid() or (ip is not null and ip = public.ip_cliente()));
  if n >= p_max then raise exception 'demasiados_intentos'; end if;
end $$;

-- ---------- API ----------
create function public.crear_perfil(p_nombre text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  -- Se valida el nombre (check) antes de detectar el duplicado y, de paso, sin carreras entre dos llamadas.
  insert into perfiles (id, nombre) values (auth.uid(), btrim(p_nombre)) on conflict (id) do nothing;
  if not found then raise exception 'perfil_existente'; end if;
end $$;

create function public.renombrar_perfil(p_nombre text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update perfiles set nombre = btrim(p_nombre) where id = auth.uid();
  if not found then raise exception 'sin_perfil'; end if;
end $$;

-- ---------- Permisos ----------
revoke execute on function public.crear_perfil(text), public.renombrar_perfil(text) from public, anon;
grant execute on function public.crear_perfil(text), public.renombrar_perfil(text) to authenticated;
revoke execute on function public.ip_cliente(), public.codigo_aleatorio(int), public.normalizar_codigo(text),
  public.registrar_fallo(text), public.limitar_intentos(text, int, interval)
  from public, anon, authenticated;

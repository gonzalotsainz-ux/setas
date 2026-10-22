-- Entorno mínimo que imita a Supabase: roles, auth.uid(), extensions, un storage simplificado y ayudas de prueba.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema extensions;
create extension pgcrypto schema extensions;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
-- Solo para que las pruebas (que corren como authenticated) puedan comprobar que el usuario existe.
grant select on auth.users to authenticated;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Supabase concede todo en `public` a estos roles por defecto: las migraciones revocan lo que haga falta.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id), name text not null, owner uuid
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select, update on storage.buckets to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare partes text[];
begin
  partes := string_to_array(name, '/');
  return partes[1:array_length(partes, 1) - 1];
end $$;

-- Ayudas de prueba (esquema `t`).
create schema t;
grant usage on schema t to public;
create table t.codigos (clave text primary key, valor text);
grant all on t.codigos to public;

create function t.uid(n int) returns uuid language sql immutable
as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;

create function t.como(n int) returns void language plpgsql as $$
begin
  execute 'reset role';
  insert into auth.users (id) values (t.uid(n)) on conflict do nothing;
  perform set_config('request.jwt.claim.sub', t.uid(n)::text, false);
  execute 'set role authenticated';
end $$;

create function t.anonimo() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;

create function t.admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create function t.afirma(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
end $$;

-- La consulta debe fallar y el mensaje de error debe contener el patrón (sin distinguir mayúsculas).
create function t.falla(consulta text, patron text) returns void language plpgsql as $$
begin
  begin
    execute consulta;
  exception when others then
    if sqlerrm ilike '%' || patron || '%' then return; end if;
    raise exception 'FALLO: "%" falló con otro error: %', consulta, sqlerrm;
  end;
  raise exception 'FALLO: "%" debía fallar con "%" y no falló', consulta, patron;
end $$;

create function t.n(consulta text) returns bigint language plpgsql as $$
declare r bigint;
begin
  execute format('select count(*) from (%s) q', consulta) into r;
  return r;
end $$;

grant execute on all functions in schema t to public;

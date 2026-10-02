-- supabase/migrations/20261003000000_pluvio.sql
-- Lluvia medida en pluviómetros (docs/superpowers/specs/2026-10-01-pluviometros-design.md §3.1): las horas leídas de cada
-- fuente, en bruto y con su fuente. Solo escribe la Edge Function «pluvio» con la clave de servicio; anon no ve la tabla.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.lluvia_obs (
  fuente text not null,                       -- 'tajo' | 'aemet' | 'duero' | 'jucar' | 'euskalmet'
  estacion text not null,                     -- código de la estación en su fuente
  hora timestamptz not null,                  -- FIN del intervalo, en UTC
  horas smallint not null default 1,          -- horas que cubre el valor (24 = total del día, SAIH Júcar)
  mm double precision,                        -- null: sin dato
  calidad text not null default 'bruto',
  leido timestamptz not null default now(),
  primary key (fuente, estacion, hora)
);
alter table public.lluvia_obs enable row level security;
revoke all on public.lluvia_obs from anon, authenticated;
-- La Edge Function entra como service_role: permisos explícitos, sin depender de los privilegios por defecto del esquema.
grant select, insert, update, delete on public.lluvia_obs to service_role;

-- Se guardan 200 días: cubren la lluvia desde el 1 de agosto hasta el final de la temporada de otoño.
select cron.schedule('pluvio-limpieza', '40 3 * * *', $$
  delete from public.lluvia_obs where hora < now() - interval '200 days';
$$);

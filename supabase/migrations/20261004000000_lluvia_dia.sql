-- supabase/migrations/20261004000000_lluvia_dia.sql
-- Lluvia por día de Madrid de cada estación, con su control de calidad (spec §3.1 y §3.2). Privada como lluvia_obs.
create table public.lluvia_dia (
  fuente text not null,
  estacion text not null,
  fecha date not null,                        -- día de Madrid
  mm double precision,
  horas smallint not null default 0,          -- horas con dato (un total diario vale 24)
  maximo double precision,                    -- mayor lluvia horaria
  calidad text not null,                      -- 'ok' | 'incompleto' | 'sospechoso' | 'sin-dato'
  motivo text,
  actualizado timestamptz not null default now(),
  primary key (fuente, estacion, fecha)
);
alter table public.lluvia_dia enable row level security;
revoke all on public.lluvia_dia from anon, authenticated;
grant select, insert, update, delete on public.lluvia_dia to service_role;

-- Lluvia por día de Madrid de cada estación desde p_desde, con un array por columna (una fila por estación, para no topar
-- con el máximo de filas de la API). Igual que agregarHoras de supabase/functions/pluvio/dias.js: cada valor es del día de
-- su fin menos un minuto; solo suman los valores >= 0; `horas` suma las horas que cubre cada valor; `maximo`, la mayor
-- lluvia horaria.
create function public.lluvia_por_dia(p_desde date)
returns table (fuente text, estacion text, fechas date[], mm double precision[], horas smallint[], maximo double precision[])
language sql stable set search_path = public as $$
  with d as (
    select o.fuente as f, o.estacion as e, ((o.hora - interval '1 minute') at time zone 'Europe/Madrid')::date as dia,
      sum(o.mm) filter (where o.mm >= 0) as total,
      coalesce(sum(o.horas) filter (where o.mm >= 0), 0)::smallint as n,
      max(o.mm) filter (where o.mm >= 0 and o.horas = 1) as pico
    from public.lluvia_obs o
    where o.hora > (p_desde::timestamp at time zone 'Europe/Madrid')
    group by 1, 2, 3)
  select d.f, d.e, array_agg(d.dia order by d.dia), array_agg(d.total order by d.dia), array_agg(d.n order by d.dia), array_agg(d.pico order by d.dia)
  from d group by d.f, d.e;
$$;
revoke all on function public.lluvia_por_dia(date) from public, anon, authenticated;
grant execute on function public.lluvia_por_dia(date) to service_role;

-- La limpieza cubre también lluvia_dia (400 días). cron.schedule con el mismo nombre sustituye el trabajo.
select cron.schedule('pluvio-limpieza', '40 3 * * *', $$
  delete from public.lluvia_obs where hora < now() - interval '200 days';
  delete from public.lluvia_dia where fecha < current_date - 400;
$$);

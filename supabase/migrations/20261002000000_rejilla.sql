-- supabase/migrations/20261002000000_rejilla.sql
-- Mapa por laderas (docs/superpowers/specs/2026-10-01-mapa-indice-design.md §3.2): meteo diaria por celda gruesa,
-- climatología del suelo, registro de ejecuciones y bucket público con el índice precalculado. Solo escribe la Edge
-- Function «rejilla» con la clave de servicio; anon no ve las tablas. El índice publicado es público (lo lee el móvil sin login).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.meteo_celdas (
  celda text not null,
  fecha date not null,
  modelo text not null default 'best_match',
  precip double precision, tmedia double precision, tmin double precision, tmax double precision, et0 double precision,
  viento double precision, hr double precision, hsuelo double precision, tsuelo double precision,
  previsto boolean not null default false,
  actualizado timestamptz not null default now(),
  primary key (celda, fecha, modelo)
);
create table public.clima_celdas (
  celda text primary key,
  por_mes jsonb not null,                 -- { "9": [0.21, …], "10": […] }: humedad del suelo diaria por mes
  meses smallint[] not null,              -- meses que cubre (del anterior al segundo siguiente)
  actualizado timestamptz not null default now()
);
-- Una fila por sello y lote ejecutados: el insert falla si ya existe, así una llamada repetida a mano, un «forzar» con el
-- mismo sello o dos llamadas solapadas no vuelven a gastar presupuesto de Open-Meteo (pg_net no reintenta por sí solo).
create table public.rejilla_ejecuciones (
  sello text not null,
  lote smallint not null default 0,
  creado timestamptz not null default now(),
  primary key (sello, lote)
);
alter table public.meteo_celdas enable row level security;
alter table public.clima_celdas enable row level security;
alter table public.rejilla_ejecuciones enable row level security;
revoke all on public.meteo_celdas, public.clima_celdas, public.rejilla_ejecuciones from anon, authenticated;
-- La Edge Function entra como service_role: permisos explícitos, sin depender de los privilegios por defecto del esquema.
grant select, insert, update, delete on public.meteo_celdas, public.clima_celdas, public.rejilla_ejecuciones to service_role;

-- Días observados de cada celda (desde, último no previsto y cuántos): el planificador decide si basta con 2 días.
create view public.meteo_celdas_resumen with (security_invoker = true) as
  select celda, min(fecha) as desde, max(fecha) filter (where not previsto) as hasta, count(*) filter (where not previsto) as dias
  from public.meteo_celdas where modelo = 'best_match' group by celda;
revoke all on public.meteo_celdas_resumen from anon, authenticated;
grant select on public.meteo_celdas_resumen to service_role;

-- Series de varias celdas en una sola llamada, con un array por columna. `previsto` y `actualizado` van en paralelo a
-- `fechas`: el manejador descarta las previsiones que no se renovaron en la ejecución en curso (serieDesdeFilas).
create function public.series_celdas(p_celdas text[], p_desde date)
returns table (celda text, fechas date[], precip double precision[], tmedia double precision[], tmin double precision[], tmax double precision[],
  et0 double precision[], viento double precision[], hr double precision[], hsuelo double precision[], tsuelo double precision[],
  previsto boolean[], actualizado timestamptz[])
language sql stable set search_path = public as $$
  select m.celda, array_agg(m.fecha order by m.fecha), array_agg(m.precip order by m.fecha), array_agg(m.tmedia order by m.fecha),
    array_agg(m.tmin order by m.fecha), array_agg(m.tmax order by m.fecha), array_agg(m.et0 order by m.fecha),
    array_agg(m.viento order by m.fecha), array_agg(m.hr order by m.fecha), array_agg(m.hsuelo order by m.fecha), array_agg(m.tsuelo order by m.fecha),
    array_agg(m.previsto order by m.fecha), array_agg(m.actualizado order by m.fecha)
  from public.meteo_celdas m
  where m.celda = any(p_celdas) and m.fecha >= p_desde and m.modelo = 'best_match'
  group by m.celda;
$$;
revoke all on function public.series_celdas(text[], date) from public, anon, authenticated;
grant execute on function public.series_celdas(text[], date) to service_role;

-- Bucket público de lectura con el índice (JSON, hasta 5 MB). Sin políticas de escritura: solo la clave de servicio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('indice', 'indice', true, 5242880, array['application/json'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['application/json'];

-- La serie más larga va del 1 de agosto del año anterior: lo de más de 400 días sobra. Las ejecuciones se guardan 30 días.
select cron.schedule('rejilla-limpieza', '30 3 * * *', $$
  delete from public.meteo_celdas where fecha < current_date - 400;
  delete from public.rejilla_ejecuciones where creado < now() - interval '30 days';
$$);

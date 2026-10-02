-- supabase/migrations/20261005000000_lluvia_ultima_hora.sql
-- lluvia_por_dia devuelve además `ultima`: si el día tiene con dato (mm >= 0) la hora que acaba a las 00:00 de Madrid del
-- día siguiente, su última hora (revisión final, arreglo 1). Sin ella el día no cuenta como medido (calidad.js): con los
-- lotes del Duero, a las 4 UTC ayer puede estar leído solo hasta las 20 h. Cambia el tipo devuelto: hay que borrarla y
-- crearla de nuevo. Igual que agregarHoras de supabase/functions/pluvio/dias.js.
drop function public.lluvia_por_dia(date);
create function public.lluvia_por_dia(p_desde date)
returns table (fuente text, estacion text, fechas date[], mm double precision[], horas smallint[], maximo double precision[], ultima boolean[])
language sql stable set search_path = public as $$
  with d as (
    select o.fuente as f, o.estacion as e, ((o.hora - interval '1 minute') at time zone 'Europe/Madrid')::date as dia,
      sum(o.mm) filter (where o.mm >= 0) as total,
      coalesce(sum(o.horas) filter (where o.mm >= 0), 0)::smallint as n,
      max(o.mm) filter (where o.mm >= 0 and o.horas = 1) as pico,
      coalesce(bool_or((o.hora at time zone 'Europe/Madrid')::time = time '00:00') filter (where o.mm >= 0), false) as fin
    from public.lluvia_obs o
    where o.hora > (p_desde::timestamp at time zone 'Europe/Madrid')
    group by 1, 2, 3)
  select d.f, d.e, array_agg(d.dia order by d.dia), array_agg(d.total order by d.dia), array_agg(d.n order by d.dia), array_agg(d.pico order by d.dia),
    array_agg(d.fin order by d.dia)
  from d group by d.f, d.e;
$$;
revoke all on function public.lluvia_por_dia(date) from public, anon, authenticated;
grant execute on function public.lluvia_por_dia(date) to service_role;

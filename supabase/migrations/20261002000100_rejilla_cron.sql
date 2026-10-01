-- supabase/migrations/20261002000100_rejilla_cron.sql
-- pg_cron trabaja en UTC: 05, 06, 17 y 18 UTC cubren las 07:00 y 19:00 de Madrid en verano (UTC+2) y en invierno (UTC+1).
-- La función solo trabaja cuando en Madrid son las 07 o las 19 (tocaEjecutar); en las otras dos horas sale enseguida.
-- La clave se lee de Vault al ejecutar (se crea en el despliegue, tarea 13, antes de esta migración): nunca va en este archivo.
-- Con CONFIG.supabase.lotes = N > 1, un trabajo por lote: 'rejilla-lote-k' a los minutos 2·k ('2 5,6,17,18 * * *' para k = 1…)
-- y la URL con lote=k&lotes=N.
select cron.schedule('rejilla-lote-0', '0 5,6,17,18 * * *', $$
  select net.http_post(
    url := 'https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/rejilla?lote=0&lotes=1',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-rejilla-clave', (select decrypted_secret from vault.decrypted_secrets where name = 'rejilla_clave')),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000);
$$);

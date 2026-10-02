-- supabase/migrations/20261003000100_pluvio_cron.sql
-- Cada hora en el minuto 10 (UTC): la función decide qué fuentes tocan. La clave se lee de Vault al ejecutar (se crea en
-- el despliegue, tarea 2, antes de esta migración): nunca va en este archivo.
select cron.schedule('pluvio-hora', '10 * * * *', $$
  select net.http_post(
    url := 'https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/pluvio',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-pluvio-clave', (select decrypted_secret from vault.decrypted_secrets where name = 'pluvio_clave')),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000);
$$);

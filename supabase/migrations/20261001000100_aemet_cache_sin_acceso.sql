-- Defensa en profundidad: la caché de AEMET solo la usa la Edge Function con la clave de servicio.
revoke all on public.aemet_cache from anon, authenticated;

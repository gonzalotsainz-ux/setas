// supabase/functions/pluvio/index.ts
// Edge Function «pluvio» (spec §3.1): la lanza pg_cron cada hora (minuto 10) con pg_net y la cabecera x-pluvio-clave
// (secreto PLUVIO_CLAVE; se despliega con --no-verify-jwt). ?fuentes=tajo10,aemet fuerza tareas concretas.
// Contesta 202 enseguida y sigue en segundo plano (EdgeRuntime.waitUntil); el plazo lo vigila el manejador.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';   // la misma versión que js/supabase.js
import ESTACIONES from './estaciones.json' with { type: 'json' };
import PUNTOS from './puntos.json' with { type: 'json' };
import GRUESA from '../rejilla/gruesa.json' with { type: 'json' };
import { ejecutar, almacenSupabase, cargarFilas, leerCuerpoCarga, resumenEjecucion, limpiarMensaje } from './manejador.js';
import { claveValida } from '../_shared/clave.js';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('método no permitido', { status: 405 });
  if (!claveValida(req.headers.get('x-pluvio-clave'), Deno.env.get('PLUVIO_CLAVE'))) return new Response('no autorizado', { status: 401 });
  const u = new URL(req.url);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (u.searchParams.get('accion') === 'cargar') {
    const l = await leerCuerpoCarga(req);
    if (l.error) return new Response(l.error, { status: l.status });
    const r = await cargarFilas({ almacen: almacenSupabase(admin), estaciones: ESTACIONES, cuerpo: l.cuerpo });
    return Response.json(r, { status: r.ok ? 200 : 400 });
  }
  const pedidas = (u.searchParams.get('fuentes') ?? '').split(',').filter(Boolean);
  const sincrono = u.searchParams.get('sincrono') === '1';   // solo llega aquí con la clave válida
  const inicio = Date.now();
  const trabajo = ejecutar({ almacen: almacenSupabase(admin), fetchFn: fetch, estaciones: ESTACIONES, gruesa: GRUESA, puntos: PUNTOS, pedidas, claveAemet: Deno.env.get('AEMET_API_KEY') ?? null })
    .then((r) => { const resumen = resumenEjecucion(r, Date.now() - inicio); console.log(JSON.stringify(resumen)); return resumen; })
    .catch((e) => { const m = limpiarMensaje((e as Error)?.message ?? e); console.error(`pluvio: ${m}`); return { estado: 'error', error: m }; });
  if (sincrono) return Response.json(await trabajo);
  if (typeof EdgeRuntime !== 'undefined') { EdgeRuntime.waitUntil(trabajo); return new Response('en marcha', { status: 202 }); }
  await trabajo;
  return new Response('hecho');
});

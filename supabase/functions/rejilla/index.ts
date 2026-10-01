// supabase/functions/rejilla/index.ts
// Edge Function «rejilla» (spec §3.2): la lanza pg_cron con pg_net a las 05, 06, 17 y 18 UTC; solo trabaja a las 07:00 y
// 19:00 de Madrid. Protegida con la cabecera x-rejilla-clave (secreto REJILLA_CLAVE; se despliega con --no-verify-jwt).
// Contesta 202 enseguida y sigue en segundo plano (EdgeRuntime.waitUntil); el plazo de la ejecución lo vigila el manejador.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';   // la misma versión que js/supabase.js
import GRUESA from './gruesa.json' with { type: 'json' };
import { ejecutar, almacenSupabase, claveValida } from './manejador.js';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('método no permitido', { status: 405 });
  if (!claveValida(req.headers.get('x-rejilla-clave'), Deno.env.get('REJILLA_CLAVE'))) return new Response('no autorizado', { status: 401 });
  const u = new URL(req.url);
  const lote = Number(u.searchParams.get('lote') ?? 0), lotes = Number(u.searchParams.get('lotes') ?? 1);
  if (!(Number.isInteger(lotes) && lotes >= 1 && lotes <= 10 && Number.isInteger(lote) && lote >= 0 && lote < lotes)) return new Response('lote inválido', { status: 400 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const trabajo = ejecutar({ almacen: almacenSupabase(admin), fetchFn: fetch, gruesa: GRUESA, lote, lotes, forzar: u.searchParams.get('forzar') === '1' })
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => console.error(`rejilla: ${(e as Error).message}`));
  if (typeof EdgeRuntime !== 'undefined') { EdgeRuntime.waitUntil(trabajo); return new Response('en marcha', { status: 202 }); }
  await trabajo;
  return new Response('hecho');
});

// Intermediario de AEMET OpenData: esconde la clave, hace las 2 llamadas por dato, decodifica y guarda en caché.
// Sin login (la app es abierta): se protege la cuota de AEMET con una lista blanca de estaciones, tramo máximo de
// 30 días, caché de 6 h (inventario: 30 días) y CORS limitado a la web de la app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import ESTACIONES from './estaciones.json' with { type: 'json' };

const ORIGENES = ['https://gonzalotsainz-ux.github.io', 'http://localhost:8080'];
const SEIS_HORAS = 6 * 3600e3, TREINTA_DIAS = 30 * 24 * 3600e3;
const MAX_DIAS = 30;
const permitidas = new Set<string>(ESTACIONES as string[]);
const prec = (t?: string) => (t == null || t === '' || t === 'Acum' ? null : t === 'Ip' ? 0 : (Number.isFinite(Number(t.replace(',', '.'))) ? Number(t.replace(',', '.')) : null));

const cabeceras = (req: Request) => {
  const o = req.headers.get('Origin') ?? '';
  return { 'Access-Control-Allow-Origin': ORIGENES.includes(o) ? o : ORIGENES[0], 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
};

async function aemet(ruta: string) {
  const r1 = await fetch(`https://opendata.aemet.es/opendata/api${ruta}`, { headers: { api_key: Deno.env.get('AEMET_API_KEY')! } });
  const j1 = await r1.json();
  if (j1.estado === 404) return [];   // sin datos para ese tramo
  if (j1.estado !== 200) throw new Error(`AEMET ${j1.estado}: ${j1.descripcion}`);
  const r2 = await fetch(j1.datos);
  return JSON.parse(new TextDecoder('iso-8859-15').decode(await r2.arrayBuffer()));
}

Deno.serve(async (req) => {
  const CORS = cabeceras(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return new Response('método no permitido', { status: 405, headers: CORS });
  const u = new URL(req.url);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  async function conCache(clave: string, vida: number, calcular: () => Promise<unknown>, guardarVacio = false) {
    const { data: c } = await admin.from('aemet_cache').select('datos, creado').eq('clave', clave).maybeSingle();
    if (c && Date.now() - Date.parse(c.creado) < vida) return c.datos;
    const datos = await calcular();
    const vacio = Array.isArray(datos) ? datos.length === 0 : Object.keys(datos as object).length === 0;
    if (!vacio || guardarVacio) await admin.from('aemet_cache').upsert({ clave, datos, creado: new Date().toISOString() });
    return datos;
  }

  try {
    if (u.searchParams.get('inventario') === '1') {
      const datos = await conCache('inventario', TREINTA_DIAS,
        () => aemet('/valores/climatologicos/inventarioestaciones/todasestaciones'));
      return Response.json(datos, { headers: CORS });
    }

    const pedidas = [...new Set((u.searchParams.get('estaciones') ?? '').split(','))].filter((x) => /^[0-9A-Z]{4,6}$/.test(x));
    const desde = u.searchParams.get('desde') ?? '', hasta = u.searchParams.get('hasta') ?? '';
    const fecha = /^\d{4}-\d{2}-\d{2}$/;
    if (!pedidas.length || !fecha.test(desde) || !fecha.test(hasta)) return new Response('parámetros inválidos', { status: 400, headers: CORS });
    const dias = (Date.parse(hasta) - Date.parse(desde)) / 864e5 + 1;
    if (!(dias >= 1 && dias <= MAX_DIAS)) return new Response(`tramo máximo de ${MAX_DIAS} días`, { status: 400, headers: CORS });
    const estaciones = pedidas.filter((x) => permitidas.has(x)).sort();
    if (!estaciones.length || estaciones.length !== pedidas.length) return new Response('estación no permitida', { status: 403, headers: CORS });

    const datos = await conCache(`${estaciones.join(',')}|${desde}|${hasta}`, SEIS_HORAS, async () => {
      const filas = await aemet(`/valores/climatologicos/diarios/datos/fechaini/${desde}T00:00:00UTC/fechafin/${hasta}T23:59:59UTC/estacion/${estaciones.join(',')}`);
      const d: Record<string, Record<string, number | null>> = {};
      for (const f of filas) (d[f.indicativo] ??= {})[f.fecha] = prec(f.prec);
      return d;
    });
    return Response.json(datos, { headers: CORS });
  } catch (e) {
    return new Response(`AEMET no disponible: ${(e as Error).message}`, { status: 502, headers: CORS });
  }
});

// Intermediario de AEMET OpenData: esconde la clave, hace las 2 llamadas por dato, decodifica y guarda en caché.
// Sin login (la app es abierta): se protege la cuota de AEMET con una lista blanca de estaciones, tramo máximo de
// 30 días, caché de 6 h (inventario: 30 días) y CORS limitado a la web de la app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import ESTACIONES from './estaciones.json' with { type: 'json' };
import { parsearPrec } from './prec.js';
import { leerJsonAemet, esBuena, elegirViejo, marcarViejo, CUARENTA_Y_OCHO_H } from './viejo.js';

const ORIGENES = ['https://gonzalotsainz-ux.github.io', 'http://localhost:8080'];
const SEIS_HORAS = 6 * 3600e3, TREINTA_DIAS = 30 * 24 * 3600e3;
const MAX_DIAS = 30, ATRAS_MAX_DIAS = 60;
const DIEZ_MIN = 10 * 60e3, UN_MIN = 60e3;   // caché negativa: resultados vacíos y errores de AEMET
const permitidas = new Set<string>(ESTACIONES as string[]);

const cabeceras = (req: Request) => {
  const o = req.headers.get('Origin') ?? '';
  return { 'Access-Control-Allow-Origin': ORIGENES.includes(o) ? o : ORIGENES[0], 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
};

async function aemet(ruta: string) {
  const r1 = await fetch(`https://opendata.aemet.es/opendata/api${ruta}`, { headers: { api_key: Deno.env.get('AEMET_API_KEY')! } });
  const j1 = leerJsonAemet(r1.status, await r1.text());
  if (j1.estado === 404) return [];   // sin datos para ese tramo
  if (j1.estado !== 200) throw new Error(`AEMET ${j1.estado}: ${j1.descripcion}`);
  const r2 = await fetch(j1.datos);
  const t2 = new TextDecoder('iso-8859-15').decode(await r2.arrayBuffer());
  const j2 = leerJsonAemet(r2.status, t2);
  return j2;
}

Deno.serve(async (req) => {
  const CORS = cabeceras(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return new Response('método no permitido', { status: 405, headers: CORS });
  const u = new URL(req.url);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Caché con vida según el contenido: datos 'vida'; vacío 10 min; error de AEMET (429/5xx…) 1 min, para no gastar cuota
  // insistiendo. El error se guarda en OTRA clave (`clave|__error`) para no pisar la última copia buena. Si AEMET falla se
  // devuelve la copia buena de hasta 48 h (`buscarViejo`), marcada con `__viejo`.
  async function conCache(clave: string, vida: number, calcular: () => Promise<unknown>,
    buscarViejo: () => Promise<{ datos: unknown; creado: string } | null>) {
    const { data: c } = await admin.from('aemet_cache').select('datos, creado').eq('clave', clave).maybeSingle();
    if (c) {
      const edad = Date.now() - Date.parse(c.creado), d = c.datos as Record<string, unknown>;
      const vacio = Array.isArray(d) ? d.length === 0 : Object.keys(d).length === 0;
      if (!(d && typeof d === 'object' && '__error' in d) && edad < (vacio ? DIEZ_MIN : vida)) return c.datos;
    }
    const claveErr = `${clave}|__error`;
    const { data: ce } = await admin.from('aemet_cache').select('datos, creado').eq('clave', claveErr).maybeSingle();
    let fallo: string | null = ce && Date.now() - Date.parse(ce.creado) < UN_MIN ? String((ce.datos as Record<string, unknown>).__error) : null;
    if (!fallo) {
      try {
        const datos = await calcular();
        await admin.from('aemet_cache').upsert({ clave, datos, creado: new Date().toISOString() });
        return datos;
      } catch (e) {
        fallo = (e as Error).message;
        await admin.from('aemet_cache').upsert({ clave: claveErr, datos: { __error: fallo }, creado: new Date().toISOString() });
      }
    }
    const v = await buscarViejo();
    if (v) return marcarViejo(v.datos, v.creado);
    throw new Error(fallo);
  }

  async function viejoDe(estaciones: string[], desde: string, hasta: string) {
    const desdeIso = new Date(Date.now() - CUARENTA_Y_OCHO_H).toISOString();
    const { data } = await admin.from('aemet_cache').select('clave, datos, creado')
      .like('clave', `${estaciones.join(',')}|%`).gte('creado', desdeIso);
    return elegirViejo(data ?? [], { estaciones, desde, hasta });
  }

  try {
    if (u.searchParams.get('inventario') === '1') {
      const datos = await conCache('inventario', TREINTA_DIAS,
        () => aemet('/valores/climatologicos/inventarioestaciones/todasestaciones'), async () => {
          const { data } = await admin.from('aemet_cache').select('datos, creado').eq('clave', 'inventario').maybeSingle();
          return data && esBuena(data.datos) ? data : null;   // el inventario cambia poco: vale la copia que haya
        });
      return Response.json(datos, { headers: CORS });
    }

    const pedidas = [...new Set((u.searchParams.get('estaciones') ?? '').split(','))].filter((x) => /^[0-9A-Z]{4,6}$/.test(x));
    const desde = u.searchParams.get('desde') ?? '', hasta = u.searchParams.get('hasta') ?? '';
    const fecha = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
    if (!pedidas.length || !fecha.test(desde) || !fecha.test(hasta)) return new Response('parámetros inválidos', { status: 400, headers: CORS });
    const d0 = Date.parse(desde), d1 = Date.parse(hasta), hoy = Math.floor(Date.now() / 864e5) * 864e5;
    if (!Number.isFinite(d0) || !Number.isFinite(d1)) return new Response('parámetros inválidos', { status: 400, headers: CORS });
    const dias = (d1 - d0) / 864e5 + 1;
    if (!(dias >= 1 && dias <= MAX_DIAS)) return new Response(`tramo máximo de ${MAX_DIAS} días`, { status: 400, headers: CORS });
    if (d1 > hoy + 864e5 || d0 < hoy - ATRAS_MAX_DIAS * 864e5) return new Response(`fechas fuera de rango (hasta mañana y ${ATRAS_MAX_DIAS} días atrás)`, { status: 400, headers: CORS });
    const estaciones = pedidas.filter((x) => permitidas.has(x)).sort();
    if (!estaciones.length || estaciones.length !== pedidas.length) return new Response('estación no permitida', { status: 403, headers: CORS });

    const datos = await conCache(`${estaciones.join(',')}|${desde}|${hasta}`, SEIS_HORAS, async () => {
      const filas = await aemet(`/valores/climatologicos/diarios/datos/fechaini/${desde}T00:00:00UTC/fechafin/${hasta}T23:59:59UTC/estacion/${estaciones.join(',')}`);
      const d: Record<string, Record<string, number | null>> = {};
      for (const f of filas) (d[f.indicativo] ??= {})[f.fecha] = parsearPrec(f.prec);
      return d;
    }, () => viejoDe(estaciones, desde, hasta));
    return Response.json(datos, { headers: CORS });
  } catch (e) {
    return new Response(`AEMET no disponible: ${(e as Error).message}`, { status: 502, headers: CORS });
  }
});

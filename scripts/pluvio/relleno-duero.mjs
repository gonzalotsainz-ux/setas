// scripts/pluvio/relleno-duero.mjs
//   node scripts/pluvio/relleno-duero.mjs [--seco] [--desde=2026-08-01]
// Relleno del SAIH Duero desde --desde (por defecto, el 1 de agosto de la temporada): lee en local, con el mismo lector que
// la función «pluvio» (lectores/duero.js, con su cortesía), el histórico horario de las estaciones del Duero de la lista
// blanca y lo sube a la función (?accion=cargar) con la cabecera x-pluvio-clave, que se lee de la variable de entorno
// PLUVIO_CLAVE (nunca de un archivo). Sustituye a la antigua tarea «duero90», que no cabía en el CPU del plan gratuito.
// --seco solo lee y cuenta. Repetirlo no duplica nada (upsert por fuente, estación y hora).
import { readFileSync } from 'node:fs';
import { leerDuero } from '../../supabase/functions/pluvio/lectores/duero.js';
import { crearPedir, AGENTE } from '../../supabase/functions/pluvio/red.js';
import { agostoDe, hoyMadrid } from '../../supabase/functions/_shared/meteo.js';

const RAIZ = new URL('../../', import.meta.url);
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const seco = process.argv.includes('--seco'), desde = arg('desde', agostoDe(hoyMadrid()));
if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw new Error(`--desde no es una fecha AAAA-MM-DD: ${desde}`);
const FUNCION = 'https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/pluvio?accion=cargar';
const TROZO = 2000;

const estaciones = JSON.parse(readFileSync(new URL('supabase/functions/pluvio/estaciones.json', RAIZ), 'utf8')).filter((e) => e.fuente === 'duero');
const clave = process.env.PLUVIO_CLAVE;
if (!seco && !clave) throw new Error('falta PLUVIO_CLAVE en el entorno');
const { filas, errores, agotado } = await leerDuero({ pedir: crearPedir({ fetchFn: fetch }), estaciones, desde });
for (const e of errores) console.warn(e);
if (agotado) throw new Error('lectura cortada por el plazo');
const porEstacion = new Map();
for (const f of filas) porEstacion.set(f.estacion, (porEstacion.get(f.estacion) ?? 0) + 1);
const ultima = filas.map((f) => f.hora).sort().at(-1) ?? '—';
console.log(`${filas.length} horas de ${porEstacion.size} de ${estaciones.length} estaciones desde ${desde}, hasta ${ultima}`);
for (const e of estaciones) if (!porEstacion.has(e.codigo)) console.warn(`${e.codigo} (${e.nombre}): sin horas`);
if (!seco) {
  const cuerpo = filas.map((f) => ({ fuente: 'duero', estacion: f.estacion, hora: f.hora, mm: f.mm }));
  for (let k = 0; k < cuerpo.length; k += TROZO) {
    const r = await fetch(FUNCION, { method: 'POST', headers: { 'content-type': 'application/json', 'x-pluvio-clave': clave, 'User-Agent': AGENTE },
      body: JSON.stringify({ filas: cuerpo.slice(k, k + TROZO) }) });
    const texto = await r.text();
    if (!r.ok) throw new Error(`carga ${k}: ${r.status} ${texto}`);
    console.log(`${Math.min(k + TROZO, cuerpo.length)}/${cuerpo.length}: ${texto}`);
  }
}

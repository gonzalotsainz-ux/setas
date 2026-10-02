// scripts/pluvio/relleno-euskalmet.mjs
//   node scripts/pluvio/relleno-euskalmet.mjs [--seco] [--desde=2026-08-01] [--anio=2026]
// Lee _fuentes/euskalmet-AAAA.zip (lo descarga si no está; unos 100 MB, CC BY 4.0), saca las horas de lluvia de las
// estaciones de Euskalmet de la lista blanca desde --desde y las sube a la función «pluvio» (?accion=cargar) con la
// cabecera x-pluvio-clave, que se lee de la variable de entorno PLUVIO_CLAVE (nunca de un archivo). --seco solo cuenta.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { filasDeZipEuskalmet } from './euskalmet-zip.mjs';
import { urlZipEuskalmet } from '../../supabase/functions/pluvio/lectores/euskalmet.js';
import { AGENTE } from '../../supabase/functions/pluvio/red.js';

const RAIZ = new URL('../../', import.meta.url);
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const seco = process.argv.includes('--seco'), desde = arg('desde', '2026-08-01'), anio = arg('anio', desde.slice(0, 4));
const FUNCION = 'https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/pluvio?accion=cargar';
const TROZO = 2000;

const estaciones = JSON.parse(readFileSync(new URL('supabase/functions/pluvio/estaciones.json', RAIZ), 'utf8')).filter((e) => e.fuente === 'euskalmet');
const ruta = new URL(`_fuentes/euskalmet-${anio}.zip`, RAIZ);
if (!existsSync(ruta)) {
  mkdirSync(new URL('_fuentes/', RAIZ), { recursive: true });
  console.log(`descargando ${urlZipEuskalmet(anio)} …`);
  const r = await fetch(urlZipEuskalmet(anio), { headers: { 'User-Agent': AGENTE } });
  if (!r.ok) throw new Error(`Euskalmet respondió ${r.status}`);
  writeFileSync(ruta, Buffer.from(await r.arrayBuffer()));
}
const { filas, avisos } = filasDeZipEuskalmet(readFileSync(ruta), estaciones, desde);
for (const a of avisos) console.warn(a);
const ultima = filas.map((f) => f.hora).sort().at(-1) ?? '—';
console.log(`${filas.length} horas de ${new Set(filas.map((f) => f.estacion)).size} de ${estaciones.length} estaciones, hasta ${ultima}`);
if (!seco) {
  const clave = process.env.PLUVIO_CLAVE;
  if (!clave) throw new Error('falta PLUVIO_CLAVE en el entorno');
  for (let k = 0; k < filas.length; k += TROZO) {
    const r = await fetch(FUNCION, { method: 'POST', headers: { 'content-type': 'application/json', 'x-pluvio-clave': clave, 'User-Agent': AGENTE },
      body: JSON.stringify({ filas: filas.slice(k, k + TROZO) }) });
    const texto = await r.text();
    if (!r.ok) throw new Error(`carga ${k}: ${r.status} ${texto}`);
    console.log(`${Math.min(k + TROZO, filas.length)}/${filas.length}: ${texto}`);
  }
}

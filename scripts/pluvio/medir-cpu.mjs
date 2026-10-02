// scripts/pluvio/medir-cpu.mjs
//   node --expose-gc scripts/pluvio/medir-cpu.mjs [tarea…]
// Mide en local el CPU y la memoria de cada tarea de «pluvio» por separado (las Edge Functions del plan gratuito cortan
// hacia los 2 s de CPU y 150 MB por petición). Cada lectura se hace con red real y un almacén en memoria (no escribe en
// Supabase; serializa las filas como lo haría el upsert) y después se repite con las mismas respuestas guardadas, sin
// red: la segunda cifra es el CPU de nuestro código (parseo, filas), la primera incluye además TLS y descompresión.
// Las tareas por lotes (duero) se miden lote a lote, con la hora UTC que elige cada lote.
// «publicar» se mide con datos sintéticos realistas: todas las estaciones de la lista blanca con un día por fecha desde
// el 1 de agosto (como lo devuelve lluvia_por_dia), el modelo de las celdas cercanas y la subida de los dos JSON.
// AEMET necesita la clave (AEMET_API_KEY en el entorno); sin ella se mide con una respuesta sintética del tamaño real
// (unas 900 estaciones × 13 horas). «RSS pico» es el del proceso entero (acumula las tareas anteriores); «heap +MB», lo
// que crece el montón durante la tarea.
import { readFileSync } from 'node:fs';
import * as M from '../../supabase/functions/pluvio/manejador.js';
const { TAREAS, ejecutar } = M;
import { agostoDe, sumarDias, hoyMadrid } from '../../supabase/functions/_shared/meteo.js';
import { celdasCercanas } from '../../supabase/functions/pluvio/publicar.js';

const RAIZ = new URL('../../', import.meta.url);
const leerJson = (r) => JSON.parse(readFileSync(new URL(r, RAIZ), 'utf8'));
const ESTACIONES = leerJson('supabase/functions/pluvio/estaciones.json');
const PUNTOS = leerJson('supabase/functions/pluvio/puntos.json');
const GRUESA = leerJson('supabase/functions/rejilla/gruesa.json');
const pedidas = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const respuesta = (status, bytes) => ({ ok: status >= 200 && status < 300, status,
  json: async () => JSON.parse(Buffer.from(bytes).toString('utf8')), text: async () => Buffer.from(bytes).toString('utf8'),
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

// Almacén en memoria: el upsert real serializa las filas a JSON; las lecturas de lluvia_por_dia vienen vacías (peor caso
// del Júcar: relleno de los días que faltan).
function almacenMedida() {
  let filas = 0;
  return {
    get filas() { return filas; },
    async guardarObs(f) { JSON.stringify(f); filas += f.length; },
    async diasPorEstacion() { return []; },
    async guardarDias(f) { JSON.stringify(f); },
    async subir(_n, json) { JSON.stringify(json); },
    async precipCeldas() { return new Map(); },
  };
}

// AEMET sintética del tamaño real de /observacion/convencional/todas (sin clave no se puede pedir).
function aemetSintetica(ahora) {
  const lista = [], codigos = ESTACIONES.filter((e) => e.fuente === 'aemet').map((e) => e.codigo);
  for (let k = 0; k < 900; k++) for (let h = 0; h < 13; h++) {
    const fint = new Date(Math.floor(ahora / 3600e3) * 3600e3 - h * 3600e3).toISOString().slice(0, 19);
    lista.push({ idema: codigos[k] ?? `X${k}`, lon: -3.5, fint, prec: (k * h) % 7 === 0 ? 0.4 : 0, alt: 900, vmax: 4.1, vv: 2.2, dv: 210,
      lat: 40.5, dmax: 200, ubi: `ESTACION ${k}`, pres: 912.3, hr: 81, stdvv: 0.4, ts: 11.2, pres_nmar: 1015.2, tamin: 8.1, ta: 9.3, tamax: 10.2, tpr: 6.1, vis: 30, stddv: 12, inso: 0 });
  }
  return Buffer.from(JSON.stringify(lista), 'latin1');
}
function fetchAemetSintetico(ahora) {
  const datos = aemetSintetica(ahora);
  return async (url) => (url.includes('/convencional/todas')
    ? respuesta(200, Buffer.from(JSON.stringify({ estado: 200, datos: 'https://opendata.aemet.es/opendata/sh/sintetica' })))
    : respuesta(200, datos));
}

// Guarda cada respuesta para repetir la tarea sin red.
function grabadora(fetchFn) {
  const guardadas = new Map();
  const grabar = async (url, op) => {
    const r = await fetchFn(url, op);
    const bytes = new Uint8Array(await r.arrayBuffer());
    guardadas.set(url, { status: r.status, bytes });
    return respuesta(r.status, bytes);
  };
  const repetir = async (url) => { const g = guardadas.get(url); return g ? respuesta(g.status, g.bytes) : respuesta(404, new Uint8Array()); };
  return { grabar, repetir, guardadas };
}

async function medir(fn) {
  global.gc?.();
  const m0 = process.memoryUsage();
  let pico = m0.rss, picoHeap = m0.heapUsed;
  const vigia = setInterval(() => { const m = process.memoryUsage(); pico = Math.max(pico, m.rss); picoHeap = Math.max(picoHeap, m.heapUsed); }, 5);
  const c0 = process.cpuUsage(), t0 = performance.now();
  const r = await fn();
  const c = process.cpuUsage(c0), ms = performance.now() - t0;
  clearInterval(vigia);
  const m = process.memoryUsage();
  pico = Math.max(pico, m.rss); picoHeap = Math.max(picoHeap, m.heapUsed);
  return { r, cpu: Math.round((c.user + c.system) / 1000), ms: Math.round(ms), heapMb: Math.round((picoHeap - m0.heapUsed) / 1048576), rssMb: Math.round(pico / 1048576) };
}

const sinEspera = async () => {};
const claveAemet = process.env.AEMET_API_KEY ?? null;
const filasTabla = [];
const apuntar = (nombre, red, local, extra) => {
  filasTabla.push({ tarea: nombre, 'CPU red (ms)': red?.cpu ?? '—', 'CPU sin red (ms)': local.cpu, 'pared (ms)': red?.ms ?? local.ms,
    'heap +MB': local.heapMb, 'RSS pico MB': Math.max(red?.rssMb ?? 0, local.rssMb), ...extra });
};

async function medirLectura(t, ahora) {
  const nombre = TAREAS[t].lotes ? `${t} lote ${TAREAS[t].lote(ahora.getUTCHours())} (${ahora.getUTCHours()} UTC)` : t;
  const sintetica = t === 'aemet' && !claveAemet;
  const base = { ahora, estaciones: ESTACIONES, pedidas: [t], esperar: sinEspera, claveAemet: claveAemet ?? 'sintetica' };
  const g = grabadora(sintetica ? fetchAemetSintetico(ahora) : fetch);
  const a1 = almacenMedida();
  const red = await medir(() => ejecutar({ ...base, almacen: a1, fetchFn: g.grabar, esperar: (ms) => new Promise((r) => setTimeout(r, ms)) }));
  const a2 = almacenMedida();
  const local = await medir(() => ejecutar({ ...base, almacen: a2, fetchFn: g.repetir }));
  const bytes = [...g.guardadas.values()].reduce((s, x) => s + x.bytes.length, 0);
  apuntar(nombre + (sintetica ? ' (sintética)' : ''), sintetica ? null : red, local,
    { filas: a2.filas, peticiones: g.guardadas.size, KB: Math.round(bytes / 1024), errores: red.r.errores.length });
  if (red.r.errores.length) console.warn(`${nombre}: ${red.r.errores.slice(0, 5).join(' | ')}`);
}

// Datos de publicar como los devuelve la base: un día por fecha y estación (lluvia_por_dia) y el modelo de cada celda.
function almacenPublicar(hoy) {
  const desde = agostoDe(hoy), fechas = [];
  for (let f = desde; f < hoy; f = sumarDias(f, 1)) fechas.push(f);
  const lluvia = (k, j) => ((k * 7 + j * 3) % 11 === 0 ? 12.4 : (k + j) % 5 === 0 ? 1.6 : 0);
  const dias = JSON.stringify(ESTACIONES.map((e, k) => ({ fuente: e.fuente, estacion: e.codigo, fechas,
    mm: fechas.map((_, j) => lluvia(k, j)), horas: fechas.map(() => (e.fuente === 'jucar' ? 24 : 24)), maximo: fechas.map((_, j) => lluvia(k, j) / 3) })));
  const celdas = [...new Set(celdasCercanas(ESTACIONES, GRUESA.celdas).values())];
  const modelo = JSON.stringify(celdas.map((id, k) => ({ celda: id, fechas, precip: fechas.map((_, j) => lluvia(k + 1, j)), previsto: fechas.map(() => false) })));
  let subido = 0;
  return {
    async diasPorEstacion() { return JSON.parse(dias); },
    async precipCeldas() { return new Map(JSON.parse(modelo).map((f) => [f.celda, new Map(f.fechas.map((d, k) => [d, f.precip[k]]))])); },
    async guardarDias(f) { JSON.stringify(f); },
    async subir(_n, json) { subido += JSON.stringify(json).length; },
    get subido() { return subido; },
    resumen: { estaciones: ESTACIONES.length, fechas: fechas.length, celdasModelo: celdas.length },
  };
}
async function medirPaso(t, ahora, nombre) {
  const a = almacenPublicar(hoyMadrid(ahora));
  const local = await medir(() => ejecutar({ almacen: a, ahora, estaciones: ESTACIONES, gruesa: GRUESA, puntos: PUNTOS, pedidas: [t], esperar: sinEspera }));
  if (local.r.errores.length) console.warn(`${t}: ${local.r.errores.join(' | ')}`);
  apuntar(`${t} (sintético, ${nombre}: ${a.resumen.fechas} días)`, null, local, { filas: JSON.stringify(local.r.pasos[t] ?? {}), peticiones: 0, KB: Math.round(a.subido / 1024), errores: local.r.errores.length });
}

const ahora = new Date();
const hoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 0, 10));
for (const t of Object.keys(TAREAS)) {
  if (pedidas.length && !pedidas.includes(t)) continue;
  if (TAREAS[t].paso) {   // hoy y el último día de la temporada (del 1 de agosto al 31 de julio: el peor caso)
    await medirPaso(t, hoy, 'hoy');
    const fin = Number(agostoDe(hoyMadrid(hoy)).slice(0, 4)) + 1;
    await medirPaso(t, new Date(`${fin}-07-31T04:10:00Z`), `31/07/${fin}`);
    continue;
  }
  if (TAREAS[t].lotes) {
    for (let l = 0; l < TAREAS[t].lotes; l++) await medirLectura(t, new Date(hoy.getTime() + M.horaDeLote(t, l) * 3600e3));
  } else await medirLectura(t, hoy);
}
console.table(filasTabla);

// supabase/functions/pluvio/manejador.js
// Una ejecución de la Edge Function «pluvio» (spec §3.1) con dependencias inyectadas: qué toca a esta hora (UTC), leer con
// cortesía y guardar las horas en lluvia_obs con su fuente.
import { hoyMadrid, agostoDe, sumarDias } from '../_shared/meteo.js';
import { crearPedir, PlazoAgotado } from './red.js';
import { leerTajo } from './lectores/tajo.js';
import { leerAemet } from './lectores/aemet.js';
import { leerDuero } from './lectores/duero.js';
import { leerJucar, fechasJucar } from './lectores/jucar.js';
import { diasDeFilas } from './dias.js';
import { publicar } from './publicar.js';
import { calidadHora } from './calidad.js';
import { esHoraEnPunto } from './tiempo.js';

// Supabase corta a los 150 s: la ejecución acaba antes de PLAZO_EJECUCION y las lecturas dejan RESERVA_MS para guardar.
export const PLAZO_EJECUCION = 140000;
export const RESERVA_MS = 25000;
export const MINIMO_PASO_MS = 15000;   // un paso (agregar, revisar, publicar) que no tiene esto por delante no empieza
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Duero guarda unos 90 días: dos lecturas al día de los últimos DIAS_DUERO bastan (y cubren los huecos de una lectura
// fallida). Leer y parsear el histórico cuesta CPU (unos 90 días por estación) y el plan gratuito corta hacia los 2 s por
// ejecución: las estaciones se leen por lotes (LOTES_DUERO), uno en cada hora de AEMET (0, 3, …, 21 UTC), de modo que
// cada lote toca a las h y h + 12 UTC. El relleno desde el 1 de agosto ya no es una tarea de la función (duero90 no
// cabía en el CPU): se hace en local con scripts/pluvio/relleno-duero.mjs, que sube por ?accion=cargar.
export const DIAS_DUERO = 4;
export const LOTES_DUERO = 4;

// Lote `lote` de `lotes`: las estaciones ordenadas por código, una de cada `lotes` (lotes disjuntos que cubren todas).
export function estacionesDeLote(estaciones, lote, lotes) {
  return [...estaciones].sort((a, b) => a.codigo.localeCompare(b.codigo)).filter((_, k) => k % lotes === lote);
}

// Qué se lee y cuándo (hora UTC de la llamada de pg_cron, minuto 10). AEMET guarda 12 h: cada 3 h da 4 ocasiones.
// Tajo: las últimas 24 h cada 3 h y, una vez al día, los 10 días que guarda sin registrarse. Una tarea con `lotes` lee
// solo el lote `lote(hora UTC)` de sus estaciones (también si se pide a mano con ?fuentes=).
export const TAREAS = {
  aemet: { fuente: 'aemet', toca: (h) => h % 3 === 0, leer: (c) => leerAemet({ ...c, clave: c.claveAemet }) },
  tajo: { fuente: 'tajo', toca: (h) => h % 3 === 1, leer: (c) => leerTajo(c) },
  tajo10: { fuente: 'tajo', toca: (h) => h === 2, leer: (c) => leerTajo({ ...c, diezDias: true }) },
  duero: { fuente: 'duero', toca: (h) => h % 3 === 0, lotes: LOTES_DUERO, lote: (h) => Math.floor(h / 3) % LOTES_DUERO,
    leer: (c) => leerDuero({ ...c, desde: sumarDias(c.hoy, -DIAS_DUERO) }) },
  // Júcar a las 3 y 15 UTC, una hora antes de publicar (así publicar va casi solo: es la ejecución con más CPU). Días que
  // ya tienen dato de alguna estación del Júcar desde el 1 de agosto (de lluvia_por_dia): no se vuelven a pedir.
  jucar: { fuente: 'jucar', toca: (h) => h === 3 || h === 15, leer: async (c) => {
    const presentes = new Set(diasDeFilas((await c.almacen.diasPorEstacion(agostoDe(c.hoy))).filter((f) => f.fuente === 'jucar'))
      .filter((d) => d.horas > 0).map((d) => d.fecha));
    return leerJucar({ ...c, fechas: fechasJucar(c.hoy, presentes) });
  } },
  publicar: { toca: (h) => h === 4 || h === 16, paso: (c) => publicar(c) },
};
// Primera hora UTC del día en que a la tarea `t` le toca el lote `lote` (para medir y probar cada lote).
export function horaDeLote(t, lote) {
  for (let h = 0; h < 24; h++) if (TAREAS[t].toca(h) && TAREAS[t].lote(h) === lote) return h;
  return null;
}
export function fuentesQueTocan(ahora, pedidas = []) {
  const claves = Object.keys(TAREAS);
  if (pedidas.length) return claves.filter((t) => pedidas.includes(t));
  return claves.filter((t) => TAREAS[t].toca(ahora.getUTCHours(), ahora.getUTCDay()));
}
export const filaObs = (fuente, f) => ({ fuente, estacion: f.estacion, hora: f.hora, horas: f.horas ?? 1, mm: f.mm, calidad: calidadHora(f.mm, f.horas ?? 1) });
// Postgres no deja que un upsert toque dos veces la misma fila (la hora 02:00 repetida el 25 de octubre): gana la última.
export function unicas(filas) {
  const m = new Map();
  for (const f of filas) m.set(`${f.fuente}|${f.estacion}|${f.hora}`, f);
  return [...m.values()];
}

// Carga de horas leídas fuera: relleno de Euskalmet desde su zip anual (scripts/pluvio/relleno-euskalmet.mjs) y del
// Duero desde el 1 de agosto (scripts/pluvio/relleno-duero.mjs). Solo las fuentes de FUENTES_CARGA y, de cada una, las
// estaciones de su lista blanca; horas en punto de los últimos DIAS_CARGA días (hasta 1 día adelante) y mm numéricos
// >= 0. Euskalmet admite además mm nulos (hora sin dato); el Duero no: un hueco no debe pisar un valor bueno ya guardado.
// Como mucho MAX_FILAS_CARGA por llamada.
export const MAX_FILAS_CARGA = 5000;
export const DIAS_CARGA = 400;
export const MAX_BYTES_CARGA = 1000000;
export const FUENTES_CARGA = Object.freeze({ euskalmet: { nulos: true }, duero: { nulos: false } });
const mmValido = (v, nulos) => (v === null && nulos) || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
export async function cargarFilas({ almacen, estaciones, cuerpo, ahora = new Date() }) {
  const lista = cuerpo?.filas;
  if (!Array.isArray(lista) || !lista.length || lista.length > MAX_FILAS_CARGA) return { ok: false, error: `hacen falta entre 1 y ${MAX_FILAS_CARGA} filas` };
  const conocidas = new Set(estaciones.filter((e) => Object.hasOwn(FUENTES_CARGA, e.fuente)).map((e) => `${e.fuente}|${e.codigo}`));
  const desde = ahora.getTime() - DIAS_CARGA * 864e5, hasta = ahora.getTime() + 864e5;
  const enVentana = (iso) => Date.parse(iso) >= desde && Date.parse(iso) <= hasta;
  const malas = lista.filter((f) => !Object.hasOwn(FUENTES_CARGA, f?.fuente) || !conocidas.has(`${f.fuente}|${f.estacion}`) || !esHoraEnPunto(f.hora)
    || !enVentana(f.hora) || !mmValido(f.mm, FUENTES_CARGA[f.fuente].nulos));
  if (malas.length) return { ok: false, error: `${malas.length} filas no válidas; la primera: ${JSON.stringify(malas[0]).slice(0, 120)}` };
  const filas = unicas(lista.map((f) => filaObs(f.fuente, { estacion: f.estacion, hora: new Date(f.hora).toISOString(), mm: f.mm })));
  await almacen.guardarObs(filas);
  return { ok: true, guardadas: filas.length };
}
// Cuerpo de ?accion=cargar: se rechaza por tamaño antes de leerlo y un JSON malo da 400.
export async function leerCuerpoCarga(req) {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES_CARGA) return { error: 'cuerpo demasiado grande', status: 413 };
  const texto = await req.text();
  if (texto.length > MAX_BYTES_CARGA) return { error: 'cuerpo demasiado grande', status: 413 };
  try { return { cuerpo: JSON.parse(texto) }; } catch { return { error: 'cuerpo no válido', status: 400 }; }
}

export async function ejecutar({ almacen, fetchFn, ahora = new Date(), estaciones, pedidas = [], claveAemet = null, gruesa = { celdas: [] }, puntos = [],
  esperar = dormir, reloj = () => Date.now(), plazo = PLAZO_EJECUCION, senal }) {
  const limite = reloj() + plazo;
  const pedir = crearPedir({ fetchFn, esperar, margen: () => limite - RESERVA_MS - reloj(), ...(senal ? { senal } : {}) });
  const hoy = hoyMadrid(ahora);
  const tareas = fuentesQueTocan(ahora, pedidas);
  const r = { estado: 'hecho', tareas, filas: {}, leidas: {}, pasos: {}, errores: [] };
  let agotado = false;
  for (const t of tareas) {
    const { fuente, leer, paso, lotes, lote } = TAREAS[t];
    if (paso) {   // los pasos van después de las lecturas y se hacen aunque estas agotaran su plazo
      if (limite - reloj() < MINIMO_PASO_MS) { r.errores.push(`${t}: sin tiempo para el paso`); continue; }
      try { r.pasos[t] = await paso({ almacen, hoy, ahora, estaciones, puntos, gruesa, quedan: () => limite - reloj() }); } catch (e) { r.errores.push(`${t}: ${e.message}`); }
      continue;
    }
    if (agotado) continue;
    let res = null;
    // Un fallo al leer o al guardar se apunta y se sigue con la tarea siguiente; el plazo agotado para las lecturas (los pasos siguen). Si la lectura
    // llegó a terminar, sus errores y su aviso de plazo agotado se conservan aunque falle el guardado.
    let fallo = null;
    try {
      const propias = estaciones.filter((e) => e.fuente === fuente);
      res = await leer({ pedir, estaciones: lotes ? estacionesDeLote(propias, lote(ahora.getUTCHours()), lotes) : propias, claveAemet, hoy, almacen });
      r.leidas[t] = res.filas.length;
      const filas = unicas(res.filas.map((f) => filaObs(fuente, f)));
      if (filas.length) await almacen.guardarObs(filas);
      r.filas[t] = filas.length;
    } catch (e) {
      if (e instanceof PlazoAgotado) { r.estado = 'plazo-agotado'; r.errores.push(`${t}: plazo agotado`); agotado = true; continue; }
      fallo = e;
    }
    if (res) r.errores.push(...(res.errores ?? []).map((e) => `${t}: ${e}`));
    if (fallo) r.errores.push(`${t}: ${fallo.message}`);
    if (res?.agotado) { r.estado = 'plazo-agotado'; r.errores.push(`${t}: plazo agotado`); agotado = true; }
  }
  return r;
}

// Resumen del resultado de «ejecutar» para el registro y para la respuesta síncrona: por tarea filas leídas, guardadas,
// nº de errores y los 10 primeros; pasos y duración. Los mensajes se acortan y se les quita cualquier clave de URL.
export const MAX_ERRORES_RESUMEN = 10;
const limpiarMensaje = (m) => String(m).replace(/((?:api_?key|apikey|clave|token|key)=)[^&\s"']+/gi, '$1***').replace(/(bearer\s+)[\w.~+/=-]+/gi, '$1***').slice(0, 300);
export function resumenEjecucion(r, duracionMs = 0) {
  const tareas = {};
  for (const t of r.tareas ?? []) {
    if (TAREAS[t]?.paso) continue;
    const propios = (r.errores ?? []).filter((e) => String(e).startsWith(`${t}:`));
    tareas[t] = { leidas: r.leidas?.[t] ?? 0, guardadas: r.filas?.[t] ?? 0, errores: propios.length, mensajes: propios.slice(0, MAX_ERRORES_RESUMEN).map(limpiarMensaje) };
  }
  return { estado: r.estado, tareas, pasos: r.pasos ?? {}, errores_total: (r.errores ?? []).length, duracion_ms: Math.round(duracionMs) };
}

// Almacén real: tabla lluvia_obs (upsert por fuente, estación y hora, en trozos de 1.000).
export function almacenSupabase(admin) {
  const datos = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  return {
    async guardarObs(filas) {
      for (let k = 0; k < filas.length; k += 1000) datos(await admin.from('lluvia_obs').upsert(filas.slice(k, k + 1000), { onConflict: 'fuente,estacion,hora' }));
    },
    async diasPorEstacion(desde) { return datos(await admin.rpc('lluvia_por_dia', { p_desde: desde })); },
    async guardarDias(filas) {
      for (let k = 0; k < filas.length; k += 1000) datos(await admin.from('lluvia_dia').upsert(filas.slice(k, k + 1000), { onConflict: 'fuente,estacion,fecha' }));
    },
    // Bucket público «indice» (el de «rejilla»): pluvio/ultimo.json y pluvio/celdas.json. Las limpiezas de «rejilla»
    // solo tocan los <sello>.json de la raíz.
    async subir(nombre, json, cacheControl) {
      datos(await admin.storage.from('indice').upload(nombre, new Blob([JSON.stringify(json)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl }));
    },
    // Lluvia del modelo (best_match) de unas celdas gruesas, de la función SQL de «rejilla»; solo los días observados.
    async precipCeldas(ids, desde) {
      const filas = datos(await admin.rpc('series_celdas', { p_celdas: ids, p_desde: desde }));
      return new Map(filas.map((f) => [f.celda, new Map(f.fechas.map((d, k) => [String(d).slice(0, 10), f.previsto[k] ? null : f.precip[k]]).filter(([, v]) => v != null))]));
    },
  };
}

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
import { esHoraEnPunto } from './tiempo.js';

// Supabase corta a los 150 s: la ejecución acaba antes de PLAZO_EJECUCION y las lecturas dejan RESERVA_MS para guardar.
export const PLAZO_EJECUCION = 140000;
export const RESERVA_MS = 25000;
export const MINIMO_PASO_MS = 15000;   // un paso (agregar, revisar, publicar) que no tiene esto por delante no empieza
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Duero guarda unos 90 días: dos lecturas al día de los últimos DIAS_DUERO bastan, y una vez a la semana se repasa desde
// el 1 de agosto (por si una caída larga dejó huecos).
export const DIAS_DUERO = 4;

// Qué se lee y cuándo (hora UTC de la llamada de pg_cron, minuto 10). AEMET guarda 12 h: cada 3 h da 4 ocasiones.
// Tajo: las últimas 24 h cada 3 h y, una vez al día, los 10 días que guarda sin registrarse.
export const TAREAS = {
  aemet: { fuente: 'aemet', toca: (h) => h % 3 === 0, leer: (c) => leerAemet({ ...c, clave: c.claveAemet }) },
  tajo: { fuente: 'tajo', toca: (h) => h % 3 === 1, leer: (c) => leerTajo(c) },
  tajo10: { fuente: 'tajo', toca: (h) => h === 2, leer: (c) => leerTajo({ ...c, diezDias: true }) },
  duero: { fuente: 'duero', toca: (h) => h === 3 || h === 15, leer: (c) => leerDuero({ ...c, desde: sumarDias(c.hoy, -DIAS_DUERO) }) },
  duero90: { fuente: 'duero', toca: (h, d) => h === 1 && d === 0, leer: (c) => leerDuero({ ...c, desde: agostoDe(c.hoy) }) },
  // Días que ya tienen dato de alguna estación del Júcar desde el 1 de agosto (de lluvia_por_dia): no se vuelven a pedir.
  jucar: { fuente: 'jucar', toca: (h) => h === 4 || h === 16, leer: async (c) => {
    const presentes = new Set(diasDeFilas((await c.almacen.diasPorEstacion(agostoDe(c.hoy))).filter((f) => f.fuente === 'jucar'))
      .filter((d) => d.horas > 0).map((d) => d.fecha));
    return leerJucar({ ...c, fechas: fechasJucar(c.hoy, presentes) });
  } },
  publicar: { toca: (h) => h === 4 || h === 16, paso: (c) => publicar(c) },
};
export function fuentesQueTocan(ahora, pedidas = []) {
  const claves = Object.keys(TAREAS);
  if (pedidas.length) return claves.filter((t) => pedidas.includes(t));
  return claves.filter((t) => TAREAS[t].toca(ahora.getUTCHours(), ahora.getUTCDay()));
}
export const filaObs = (fuente, f) => ({ fuente, estacion: f.estacion, hora: f.hora, horas: f.horas ?? 1, mm: f.mm, calidad: 'bruto' });
// Postgres no deja que un upsert toque dos veces la misma fila (la hora 02:00 repetida el 25 de octubre): gana la última.
export function unicas(filas) {
  const m = new Map();
  for (const f of filas) m.set(`${f.fuente}|${f.estacion}|${f.hora}`, f);
  return [...m.values()];
}

// Carga de horas leídas fuera (relleno de Euskalmet desde su zip anual): solo estaciones de Euskalmet de la lista blanca,
// horas en punto de los últimos DIAS_CARGA días (hasta 1 día adelante) y mm numéricos >= 0 o nulos; como mucho
// MAX_FILAS_CARGA por llamada.
export const MAX_FILAS_CARGA = 5000;
export const DIAS_CARGA = 400;
export const MAX_BYTES_CARGA = 1000000;
const mmValido = (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
export async function cargarFilas({ almacen, estaciones, cuerpo, ahora = new Date() }) {
  const lista = cuerpo?.filas;
  if (!Array.isArray(lista) || !lista.length || lista.length > MAX_FILAS_CARGA) return { ok: false, error: `hacen falta entre 1 y ${MAX_FILAS_CARGA} filas` };
  const conocidas = new Set(estaciones.filter((e) => e.fuente === 'euskalmet').map((e) => e.codigo));
  const desde = ahora.getTime() - DIAS_CARGA * 864e5, hasta = ahora.getTime() + 864e5;
  const enVentana = (iso) => Date.parse(iso) >= desde && Date.parse(iso) <= hasta;
  const malas = lista.filter((f) => f?.fuente !== 'euskalmet' || !conocidas.has(f.estacion) || !esHoraEnPunto(f.hora) || !enVentana(f.hora) || !mmValido(f.mm));
  if (malas.length) return { ok: false, error: `${malas.length} filas no válidas; la primera: ${JSON.stringify(malas[0]).slice(0, 120)}` };
  const filas = unicas(lista.map((f) => filaObs('euskalmet', { estacion: f.estacion, hora: new Date(f.hora).toISOString(), mm: f.mm })));
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

export async function ejecutar({ almacen, fetchFn, ahora = new Date(), estaciones, pedidas = [], claveAemet = null,
  esperar = dormir, reloj = () => Date.now(), plazo = PLAZO_EJECUCION, senal }) {
  const limite = reloj() + plazo;
  const pedir = crearPedir({ fetchFn, esperar, margen: () => limite - RESERVA_MS - reloj(), ...(senal ? { senal } : {}) });
  const hoy = hoyMadrid(ahora);
  const tareas = fuentesQueTocan(ahora, pedidas);
  const r = { estado: 'hecho', tareas, filas: {}, pasos: {}, errores: [] };
  let agotado = false;
  for (const t of tareas) {
    const { fuente, leer, paso } = TAREAS[t];
    if (paso) {   // los pasos van después de las lecturas y se hacen aunque estas agotaran su plazo
      if (limite - reloj() < MINIMO_PASO_MS) { r.errores.push(`${t}: sin tiempo para el paso`); continue; }
      try { r.pasos[t] = await paso({ almacen, hoy, ahora, estaciones }); } catch (e) { r.errores.push(`${t}: ${e.message}`); }
      continue;
    }
    if (agotado) continue;
    let res = null;
    // Un fallo al leer o al guardar se apunta y se sigue con la tarea siguiente; el plazo agotado para las lecturas (los pasos siguen). Si la lectura
    // llegó a terminar, sus errores y su aviso de plazo agotado se conservan aunque falle el guardado.
    let fallo = null;
    try {
      res = await leer({ pedir, estaciones: estaciones.filter((e) => e.fuente === fuente), claveAemet, hoy, almacen });
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
  };
}

// supabase/functions/pluvio/manejador.js
// Una ejecución de la Edge Function «pluvio» (spec §3.1) con dependencias inyectadas: qué toca a esta hora (UTC), leer con
// cortesía y guardar las horas en lluvia_obs con su fuente.
import { hoyMadrid, agostoDe, sumarDias } from '../_shared/meteo.js';
import { crearPedir, PlazoAgotado } from './red.js';
import { leerTajo } from './lectores/tajo.js';
import { leerAemet } from './lectores/aemet.js';
import { leerDuero } from './lectores/duero.js';

// Supabase corta a los 150 s: la ejecución acaba antes de PLAZO_EJECUCION y las lecturas dejan RESERVA_MS para guardar.
export const PLAZO_EJECUCION = 140000;
export const RESERVA_MS = 25000;
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

export async function ejecutar({ almacen, fetchFn, ahora = new Date(), estaciones, pedidas = [], claveAemet = null,
  esperar = dormir, reloj = () => Date.now(), plazo = PLAZO_EJECUCION, senal }) {
  const limite = reloj() + plazo;
  const pedir = crearPedir({ fetchFn, esperar, margen: () => limite - RESERVA_MS - reloj(), ...(senal ? { senal } : {}) });
  const hoy = hoyMadrid(ahora);
  const tareas = fuentesQueTocan(ahora, pedidas);
  const r = { estado: 'hecho', tareas, filas: {}, errores: [] };
  for (const t of tareas) {
    const { fuente, leer } = TAREAS[t];
    let res = null;
    // Un fallo al leer o al guardar se apunta y se sigue con la tarea siguiente; el plazo agotado para. Si la lectura
    // llegó a terminar, sus errores y su aviso de plazo agotado se conservan aunque falle el guardado.
    let fallo = null;
    try {
      res = await leer({ pedir, estaciones: estaciones.filter((e) => e.fuente === fuente), claveAemet, hoy, almacen });
      const filas = unicas(res.filas.map((f) => filaObs(fuente, f)));
      if (filas.length) await almacen.guardarObs(filas);
      r.filas[t] = filas.length;
    } catch (e) {
      if (e instanceof PlazoAgotado) { r.estado = 'plazo-agotado'; r.errores.push(`${t}: plazo agotado`); break; }
      fallo = e;
    }
    if (res) r.errores.push(...(res.errores ?? []).map((e) => `${t}: ${e}`));
    if (fallo) r.errores.push(`${t}: ${fallo.message}`);
    if (res?.agotado) { r.estado = 'plazo-agotado'; r.errores.push(`${t}: plazo agotado`); break; }
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
  };
}

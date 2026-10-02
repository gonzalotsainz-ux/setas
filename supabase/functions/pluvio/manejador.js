// supabase/functions/pluvio/manejador.js
// Una ejecución de la Edge Function «pluvio» (spec §3.1) con dependencias inyectadas: qué toca a esta hora (UTC), leer con
// cortesía y guardar las horas en lluvia_obs con su fuente.
import { hoyMadrid } from '../_shared/meteo.js';
import { crearPedir, PlazoAgotado } from './red.js';
import { leerTajo } from './lectores/tajo.js';
import { leerAemet } from './lectores/aemet.js';

// Supabase corta a los 150 s: la ejecución acaba antes de PLAZO_EJECUCION y las lecturas dejan RESERVA_MS para guardar.
export const PLAZO_EJECUCION = 140000;
export const RESERVA_MS = 25000;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Qué se lee y cuándo (hora UTC de la llamada de pg_cron, minuto 10). AEMET guarda 12 h: cada 3 h da 4 ocasiones.
// Tajo: las últimas 24 h cada 3 h y, una vez al día, los 10 días que guarda sin registrarse.
export const TAREAS = {
  aemet: { fuente: 'aemet', toca: (h) => h % 3 === 0, leer: (c) => leerAemet({ ...c, clave: c.claveAemet }) },
  tajo: { fuente: 'tajo', toca: (h) => h % 3 === 1, leer: (c) => leerTajo(c) },
  tajo10: { fuente: 'tajo', toca: (h) => h === 2, leer: (c) => leerTajo({ ...c, diezDias: true }) },
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
    let res;
    try {
      res = await leer({ pedir, estaciones: estaciones.filter((e) => e.fuente === fuente), claveAemet, hoy, almacen });
    } catch (e) {
      if (e instanceof PlazoAgotado) { r.estado = 'plazo-agotado'; r.errores.push(`${t}: plazo agotado`); break; }
      r.errores.push(`${t}: ${e.message}`);
      continue;
    }
    const filas = unicas(res.filas.map((f) => filaObs(fuente, f)));
    if (filas.length) await almacen.guardarObs(filas);
    r.filas[t] = filas.length;
    r.errores.push(...res.errores.map((e) => `${t}: ${e}`));
    if (res.agotado) { r.estado = 'plazo-agotado'; r.errores.push(`${t}: plazo agotado`); break; }
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

// Descarga del índice diario (bucket público «indice» de Supabase; caché 3 h como js/cache.js) y de las rejillas
// finas que se ven (perezosa, una vez por archivo). Avisos de antigüedad (spec §3.4).
import { leer, guardar, almacenPorDefecto } from '../cache.js';
import { SUPABASE_URL } from '../config.js';
import { hoyMadrid, horaMadrid, sumarDias } from '../meteo.js';
import { validarSalida } from './salida.js';
import { decodificarRejilla } from './formato.js';
import { ventanaBbox } from './geo.js';

export const BASE_INDICE = `${SUPABASE_URL}/storage/v1/object/public/indice`;
const TRES_HORAS = 3 * 3600e3, MARGEN_MS = 45 * 60e3, ESPERA_MS = 20000;

// AbortSignal.timeout no existe en Safari < 16: se usa un AbortController con temporizador.
function conPlazo(ms) {
  if (typeof AbortController !== 'function') return { signal: undefined, fin() {} };
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, fin: () => clearTimeout(t) };
}
async function pedirJson(fetchFn, url) {
  const plazo = conPlazo(ESPERA_MS);
  try {
    const r = await fetchFn(url, { signal: plazo.signal });
    if (!r.ok) throw new Error(`Índice del mapa: ${r.status}`);
    return await r.json();
  } finally { plazo.fin(); }
}

// Safari < 16.4 no tiene DecompressionStream: sin él no se pueden leer las rejillas y el mapa cae al modo de puntos.
export const rejillasSoportadas = () => typeof globalThis.DecompressionStream === 'function';
export const AVISO_SIN_DESCOMPRESION = 'Este navegador no puede leer el mapa por laderas; se muestran solo los puntos. Actualiza el navegador para verlo.';

export async function cargarIndice({ fetchFn = globalThis.fetch?.bind(globalThis), ahora = new Date(), almacen = almacenPorDefecto() } = {}) {
  const previo = leer('indice', almacen);   // leer nunca lanza (almacén bloqueado → null)
  const valido = previo?.datos && !validarSalida(previo.datos).length ? previo : null;
  // Caché vigente: menos de 3 h, no de «el futuro» (reloj adelantado) y no más vieja que la ejecución que ya debería estar publicada.
  const edad = valido ? ahora - new Date(valido.hora) : NaN;
  if (valido && edad >= 0 && edad < TRES_HORAS && valido.datos.sello >= selloEsperado(ahora)) return { salida: valido.datos, desdeCache: true };
  try {
    const puntero = await pedirJson(fetchFn, `${BASE_INDICE}/ultimo.json?t=${Math.floor(ahora / 6e5)}`);
    if (typeof puntero?.sello !== 'string' || typeof puntero?.archivo !== 'string') throw new Error('puntero del índice del mapa mal formado');
    let salida = valido?.datos?.sello === puntero.sello ? valido.datos : null;
    if (!salida) {
      salida = await pedirJson(fetchFn, `${BASE_INDICE}/${encodeURIComponent(puntero.archivo)}`);
      const errores = validarSalida(salida);
      if (errores.length) throw new Error(`índice del mapa mal formado: ${errores[0]}`);
    }
    guardar('indice', salida, ahora.toISOString(), almacen);   // si no cabe, guardar devuelve false y se sigue sin caché
    return { salida, desdeCache: salida === valido?.datos };
  } catch (e) {
    if (valido) return { salida: valido.datos, desdeCache: true, error: e.message };
    return { salida: null, desdeCache: false, error: e.message };
  }
}

// La última ejecución (07 o 19 de Madrid) que ya debería estar publicada, con 45 minutos de margen. Siempre en hora de Madrid.
export function selloEsperado(ahora = new Date()) {
  const s = horaMadrid(new Date(ahora.getTime() - MARGEN_MS)), dia = s.slice(0, 10), h = Number(s.slice(11));
  return h >= 19 ? `${dia}T19` : h >= 7 ? `${dia}T07` : `${sumarDias(dia, -1)}T19`;
}
const FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
export function avisoIndice(salida, ahora = new Date()) {
  if (!salida?.sello || salida.sello >= selloEsperado(ahora)) return null;
  const hoy = hoyMadrid(ahora), dia = salida.sello.slice(0, 10), hora = `${salida.sello.slice(11)}:00`;
  const cuando = dia === hoy ? 'de hoy' : dia === sumarDias(hoy, -1) ? 'de ayer' : `del ${FECHA.format(new Date(`${dia}T12:00:00Z`))}`;
  return `Datos ${cuando} a las ${hora}. No se ha podido actualizar el mapa; las manchas son de entonces.`;
}
// Días que se pueden elegir en la barra: los del índice desde hoy (un índice de ayer empieza ayer).
export const diasDisponibles = (salida, hoy) => (salida?.fechas ?? []).filter((f) => f >= hoy);

export async function cargarDatosRejilla({ fetchFn = globalThis.fetch?.bind(globalThis), base = 'data/rejilla/', espera = ESPERA_MS } = {}) {
  const [indice, gruesa] = await Promise.all(['indice.json', 'gruesa.json'].map(async (n) => {
    const plazo = conPlazo(espera);
    try {
      const r = await fetchFn(`${base}${n}`, { signal: plazo.signal });
      if (!r.ok) throw new Error(`No se pudo cargar ${base}${n} (${r.status})`);
      return await r.json();
    } finally { plazo.fin(); }
  }));
  return { indice, gruesa };
}
// Una zona puede ir partida en bandas (extremadura-1.bin … -5.bin): cada archivo trae su propio rectángulo.
// Lejos (zoom < ZOOM_MIN_FINA) se pintan las celdas gruesas: no se bajan rejillas finas (plan, ZOOM_FINO = 9).
export const ZOOM_MIN_FINA = 9;
export function archivosVisibles(indiceRejilla, bbox, zoom) {
  if (zoom < ZOOM_MIN_FINA) return [];
  const v = ventanaBbox(bbox);
  return (indiceRejilla?.archivos ?? []).filter((a) => a.col0 < v.col0 + v.ancho && a.col0 + a.ancho > v.col0 && a.fila0 < v.fila0 + v.alto && a.fila0 + a.alto > v.fila0);
}
export const archivoDeCelda = (indiceRejilla, col, fila) =>
  (indiceRejilla?.archivos ?? []).find((a) => col >= a.col0 && col < a.col0 + a.ancho && fila >= a.fila0 && fila < a.fila0 + a.alto) ?? null;

export function crearCargadorRejillas({ fetchFn = globalThis.fetch?.bind(globalThis), base = 'data/rejilla/', espera = ESPERA_MS } = {}) {
  const cache = new Map();
  return {
    cargar(archivo) {
      if (!rejillasSoportadas()) return Promise.reject(new Error(AVISO_SIN_DESCOMPRESION));
      if (!cache.has(archivo)) {
        const plazo = conPlazo(espera);
        const descarga = (async () => {
          const r = await fetchFn(`${base}${archivo}`, { signal: plazo.signal });
          if (!r.ok) throw new Error(`No se pudo cargar ${archivo} (${r.status})`);
          return decodificarRejilla(await r.arrayBuffer());
        })();
        cache.set(archivo, descarga.finally(plazo.fin).catch((e) => { cache.delete(archivo); throw e; }));   // si falla o vence, se podrá reintentar
      }
      return cache.get(archivo);
    },
  };
}

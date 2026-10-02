// js/pluvio.js
// Lluvia medida en pluviómetros en Hoy y Zona (spec de pluviómetros §3.3): carga de pluvio/ultimo.json (bucket público
// «indice», caché 3 h como js/cache.js) y su aplicación a la meteo de los puntos de zona. Sin archivo vigente (falta, no
// valida, tiene más de 36 h o es del futuro), la meteo queda tal cual (prueba de equivalencia en tests/pluvio-app.test.js).
import { leer, guardar, almacenPorDefecto } from './cache.js';
import { SUPABASE_URL } from './config.js';
import { conPlazo } from './rejilla/carga.js';
import { aplicarMedida, factoresPorZona, pluvioVigente, VIGENCIA_PLUVIO } from '../supabase/functions/_shared/pluvio.js';
export { FUENTES_LLUVIA, LICENCIAS } from '../supabase/functions/_shared/pluvio-fuentes.js';

export const URL_PLUVIO = `${SUPABASE_URL}/storage/v1/object/public/indice/pluvio/ultimo.json`;
export const PLUVIO_MAX_HORAS = VIGENCIA_PLUVIO.maxHoras;
const TRES_HORAS = 3 * 3600e3, ESPERA_MS = 15000;

export async function cargarPluvio({ fetchFn = globalThis.fetch?.bind(globalThis), ahora = new Date(), almacen = almacenPorDefecto() } = {}) {
  const previo = leer('pluvio', almacen);   // leer nunca lanza
  const valido = pluvioVigente(previo?.datos, ahora) ? previo.datos : null;
  const edad = valido ? ahora - new Date(previo.hora) : NaN;
  if (valido && edad >= 0 && edad < TRES_HORAS) return valido;
  const plazo = conPlazo(ESPERA_MS);
  try {
    const r = await fetchFn(`${URL_PLUVIO}?t=${Math.floor(ahora / 6e5)}`, { signal: plazo.signal });
    if (!r.ok) throw new Error(`lluvia medida: ${r.status}`);
    const p = await r.json();
    if (!pluvioVigente(p, ahora)) throw new Error('lluvia medida mal formada o vieja');
    guardar('pluvio', p, ahora.toISOString(), almacen);   // si no cabe, se sigue sin caché
    return p;
  } catch {
    return valido;   // sin archivo o caído: el guardado aunque tenga más de 3 h (si sigue vigente); si no hay, null
  } finally { plazo.fin(); }
}

// La meteo con la lluvia medida en cada punto que la tiene (también los NO IR, que se ven «solo meteo») y, en los demás
// puntos de la misma zona, el modelo corregido por su sesgo de 30 días (factoresPorZona, el mismo cálculo que la rejilla:
// sobre las series del MODELO y con 2 estaciones distintas como mínimo). `seriesModelo` guarda las del modelo (el
// contraste AEMET compara con ellas).
export function aplicarPluvio(zonas, meteo, pluvio) {
  if (!meteo?.series || !pluvio?.lugares) return meteo;
  const lugares = zonas.flatMap((z) => z.puntos.filter((p) => meteo.series[p.id]).map((p) => ({ id: p.id, zona: z.id })));
  const factores = factoresPorZona(lugares, new Map(Object.entries(meteo.series)), pluvio);
  const series = { ...meteo.series }, porPunto = {};
  for (const { id, zona } of lugares) {
    const m = pluvio.lugares[id] ?? null, factor = factores.get(zona) ?? 1;
    series[id] = aplicarMedida(meteo.series[id], m, { desde: pluvio.desde, hasta: pluvio.hasta, factor });
    porPunto[id] = { estaciones: m?.estaciones ?? [], cercanas: m?.cercanas ?? 0, factor };
  }
  return { ...meteo, series, seriesModelo: meteo.series, pluvio: { porPunto, desde: pluvio.desde, hasta: pluvio.hasta } };
}

// Lluvia AEMET por estación y día: la validada (función «aemet», unos 3 días de retraso) y, en los días que aún no trae, la
// suma de la horaria que publica «pluvio» (solo días completos y buenos). Lo demás de `obs` (la marca `__viejo` de una
// copia de reserva) se conserva.
export function combinarObs(obs, pluvio) {
  const horaria = pluvio?.aemet;
  if (!horaria || !Object.keys(horaria).length) return obs;
  const r = { ...(obs ?? {}) };
  for (const [id, dias] of Object.entries(horaria)) {
    const d = { ...(r[id] ?? {}) };
    for (const [f, mm] of Object.entries(dias)) if (d[f] == null) d[f] = mm;
    r[id] = d;
  }
  return r;
}

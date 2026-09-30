import { parsearPrec } from '../supabase/functions/aemet/prec.js';

// Lluvia medida en estaciones AEMET (a través de la Edge Function) y contraste con el modelo.
// Sin login: la función se llama con la clave publicable en la cabecera `apikey`.
//
// Retraso real de AEMET (comprobado el 2026-09-30): el último día diario publicado es D-3 (el 30/09 llegaba el 27/09).
// Por eso la ventana de 26 días (hoy-25 … hoy) nunca trae más de 23 días medidos: se exige un mínimo de 22 y los
// últimos días los pone el modelo (cada día lleva su origen en `origenPrecip`).

export const MIN_DIAS_ESTACION = 22;

export { parsearPrec };

// Compara con los MISMOS días: Σ estación frente a Σ modelo en los días con observación. `discrepa` usa ese par
// (> 30 % y > 10 mm), así que no depende de los últimos días sin medida (AEMET publica con retraso).
// P26estacion es la definición del índice: días de estación + días del modelo en la cola sin medida (lo que produce
// aplicarEstacion). P26modelo es la lluvia de 26 días solo con el modelo. Con menos de MIN_DIAS_ESTACION días, null.
export function compararLluvia(serie, obs) {
  const i = serie.hoy, js = Array.from({ length: 26 }, (_, k) => i - 25 + k);
  const mod = (j) => serie.precip[j] ?? 0;
  const cubiertos = js.filter((j) => obs[serie.fechas[j]] != null);
  const estacionCubierta = cubiertos.reduce((t, j) => t + obs[serie.fechas[j]], 0);
  const modeloCubierto = cubiertos.reduce((t, j) => t + mod(j), 0);
  const P26modelo = js.reduce((t, j) => t + mod(j), 0);
  const completa = cubiertos.length >= MIN_DIAS_ESTACION;
  const P26estacion = completa ? estacionCubierta + P26modelo - modeloCubierto : null;
  const d = Math.abs(estacionCubierta - modeloCubierto);
  const discrepa = completa && d > 10 && d > 0.3 * Math.max(estacionCubierta, modeloCubierto);
  return { P26modelo, P26estacion, diasCubiertos: cubiertos.length, estacionCubierta, modeloCubierto, discrepa };
}

export function aplicarEstacion(serie, obs, id) {
  const precip = [...serie.precip], origenPrecip = [...serie.origenPrecip];
  serie.fechas.forEach((f, j) => { if (j <= serie.hoy && obs[f] != null) { precip[j] = obs[f]; origenPrecip[j] = `estacion:${id}`; } });
  return { ...serie, precip, origenPrecip };
}

// Devuelve una copia de `meteo` con la lluvia medida de la estación en las series de cada zona que tenga una
// estación con datos suficientes, salvo que se haya elegido «Usar modelo» y haya discrepancia.
// `meteo.contraste[zona.id] = { estacion, comparacion, discrepa, usaModelo, aplicada }`.
export function aplicarContraste(zonas, meteo, obs, usarModelo = () => false) {
  if (!meteo?.series || !obs) return meteo;
  const series = { ...meteo.series }, contraste = {};
  for (const z of zonas) {
    const propias = z.puntos.filter((p) => meteo.series[p.id]);
    if (!propias.length) continue;
    for (const est of z.estacionesAemet ?? []) {
      const o = obs[est.id];
      if (!o) continue;
      const ref = propias.reduce((a, b) => (Math.abs(b.altitud - est.altitud) < Math.abs(a.altitud - est.altitud) ? b : a));
      const comparacion = compararLluvia(meteo.series[ref.id], o);
      if (comparacion.P26estacion == null) continue;
      const usaModelo = comparacion.discrepa && usarModelo(z.id);
      if (!usaModelo) for (const p of propias) series[p.id] = aplicarEstacion(meteo.series[p.id], o, est.id);
      contraste[z.id] = { estacion: est, comparacion, discrepa: comparacion.discrepa, usaModelo, aplicada: !usaModelo };
      break;
    }
  }
  return { ...meteo, series, contraste };
}

// «Usar modelo», por zona, en localStorage.
const clavePref = (zonaId) => `setas.aemet.modelo.${zonaId}`;
export function usarModeloDe(zonaId) {
  try { return localStorage.getItem(clavePref(zonaId)) === '1'; } catch { return false; }
}
export function fijarUsarModelo(zonaId, valor) {
  try { if (valor) localStorage.setItem(clavePref(zonaId), '1'); else localStorage.removeItem(clavePref(zonaId)); } catch { /* sin almacenamiento */ }
}

const SEIS_HORAS = 6 * 3600e3;
const claveLocal = (estaciones, desde, hasta) => `setas.aemet|${[...estaciones].sort().join(',')}|${desde}|${hasta}`;

// Caché en localStorage 6 h por tramo de fechas, para no insistir a la función (y a AEMET).
export async function pedirObservaciones(estaciones, desde, hasta, { ahora = Date.now() } = {}) {
  const clave = claveLocal(estaciones, desde, hasta);
  try {
    const g = JSON.parse(localStorage.getItem(clave) ?? 'null');
    if (g && ahora - g.t < SEIS_HORAS) return g.datos;
  } catch { /* sin caché local */ }
  const { SUPABASE_URL, SUPABASE_ANON } = await import('./supabase.js');
  const url = `${SUPABASE_URL}/functions/v1/aemet?${new URLSearchParams({ estaciones: estaciones.join(','), desde, hasta })}`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_ANON } });
  if (!r.ok) throw new Error(`AEMET vía Supabase: ${r.status}`);
  const datos = await r.json();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('setas.aemet|') && k !== clave) localStorage.removeItem(k);
    localStorage.setItem(clave, JSON.stringify({ t: ahora, datos }));
  } catch { /* cuota o modo privado */ }
  return datos;
}

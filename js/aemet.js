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

// Distancia en km entre dos coordenadas (haversine); null si falta alguna.
export function distanciaKm(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every(Number.isFinite)) return null;
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Estaciones de la zona ordenadas por cercanía al punto. La `distanciaKm` de cada una pasa a ser la del punto. Sin
// coordenadas en el punto o en la estación queda al final y en su orden original (el sort es estable).
export function estacionesPorCercania(punto, estaciones) {
  return (estaciones ?? []).map((e) => { const d = distanciaKm(punto, e); return { e, d }; })
    .sort((x, y) => (x.d ?? Infinity) - (y.d ?? Infinity))
    .map(({ e, d }) => (d == null ? e : { ...e, distanciaKm: Math.round(d * 10) / 10 }));
}

// Devuelve una copia de `meteo` con la lluvia medida de la estación en la serie de cada punto que tenga una estación
// con datos suficientes: la más cercana de las de su zona (si no llega al mínimo de días, la siguiente). Si hay
// discrepancia y se ha elegido «Usar modelo» en la zona, ese punto se queda con el modelo.
// `meteo.contrastePuntos[punto.id] = { estacion, comparacion, discrepa, usaModelo, aplicada }` (la estación elegida lleva
// su distancia al punto) y `meteo.contraste[zona.id]` resume la zona: el primer punto que discrepa, o el primero con estación.
export function aplicarContraste(zonas, meteo, obs, usarModelo = () => false) {
  if (!meteo?.series || !obs) return meteo;
  const series = { ...meteo.series }, contraste = {}, contrastePuntos = {};
  for (const z of zonas) {
    const entradas = [];
    for (const p of z.puntos.filter((q) => meteo.series[q.id])) {
      for (const est of estacionesPorCercania(p, z.estacionesAemet)) {
        const o = obs[est.id];
        if (!o) continue;
        const comparacion = compararLluvia(meteo.series[p.id], o);
        if (comparacion.P26estacion == null) continue;
        const usaModelo = comparacion.discrepa && usarModelo(z.id);
        if (!usaModelo) series[p.id] = aplicarEstacion(meteo.series[p.id], o, est.id);
        const entrada = { estacion: est, comparacion, discrepa: comparacion.discrepa, usaModelo, aplicada: !usaModelo };
        contrastePuntos[p.id] = entrada;
        entradas.push(entrada);
        break;
      }
    }
    const resumen = entradas.find((x) => x.discrepa) ?? entradas[0];
    if (resumen) contraste[z.id] = resumen;
  }
  return { ...meteo, series, contraste, contrastePuntos };
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

// Lluvia medida en estaciones AEMET (a través de la Edge Function) y contraste con el modelo.
// Sin login: la función se llama con la clave publicable en la cabecera `apikey`.
//
// Retraso real de AEMET (comprobado el 2026-09-30): el último día diario publicado es D-3 (el 30/09 llegaba el 27/09).
// Por eso la ventana de 26 días (hoy-25 … hoy) nunca trae más de 23 días medidos: se exige un mínimo de 22 y los
// últimos días los pone el modelo (cada día lleva su origen en `origenPrecip`).

export const MIN_DIAS_ESTACION = 22;

export function parsearPrec(t) {
  if (t == null || t === '' || t === 'Acum') return null;
  if (t === 'Ip') return 0;
  const v = Number(String(t).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

// P26 del modelo frente a P26 de la estación (extrapolada a 26 días si faltan los últimos por el retraso de AEMET).
export function compararLluvia(serie, obs) {
  const i = serie.hoy, dias = serie.fechas.slice(i - 25, i + 1);
  const P26modelo = serie.precip.slice(i - 25, i + 1).reduce((a, b) => a + (b ?? 0), 0);
  const vals = dias.map((f) => obs[f]).filter((v) => v != null);
  const P26estacion = vals.length >= MIN_DIAS_ESTACION ? vals.reduce((a, b) => a + b, 0) * (26 / vals.length) : null;
  const discrepa = P26estacion != null && Math.abs(P26estacion - P26modelo) > 10
    && Math.abs(P26estacion - P26modelo) > 0.3 * Math.max(P26estacion, P26modelo);
  return { P26modelo, P26estacion, diasCubiertos: vals.length, discrepa };
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

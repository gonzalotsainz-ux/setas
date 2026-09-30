// Open-Meteo: serie principal (60 días pasados + 10 de previsión), contraste de modelos y climatología del suelo.
// Fundamento: docs/investigacion/03-fructificacion-datos.md §2.
// Comprobado en vivo (2026-09-30): el suelo horario con el modelo por defecto (best_match) viene relleno y el archivo
// histórico coincide con el forecast (sesgo medio < 0,001 m³/m³ en 52 días solapados), así que no hace falta `models=`.
import { leer, guardar, borrarPrefijo, almacenPorDefecto } from './cache.js';

const PREVISION = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVO = 'https://archive-api.open-meteo.com/v1/archive';
export const DIARIAS = ['precipitation_sum', 'temperature_2m_mean', 'temperature_2m_min', 'temperature_2m_max',
  'et0_fao_evapotranspiration', 'wind_speed_10m_max', 'relative_humidity_2m_mean'];
export const HORARIAS = ['soil_moisture_0_to_7cm', 'soil_temperature_0_to_7cm'];
export const MODELOS = ['ecmwf_ifs', 'icon_seamless', 'meteofrance_seamless'];
export const PASADOS = 60, FUTUROS = 10;
const TRES_HORAS = 3 * 3600e3;
const ZONA = 'Europe/Madrid';

export const hoyMadrid = (ahora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);

const lista = (puntos, k) => puntos.map((p) => p[k]).join(',');
const comoLista = (j) => (Array.isArray(j) ? j : [j]);
const coords = (puntos) => ({ latitude: lista(puntos, 'lat'), longitude: lista(puntos, 'lon'), elevation: lista(puntos, 'altitud'), timezone: ZONA });

export const urlPrincipal = (puntos) => `${PREVISION}?${new URLSearchParams({ ...coords(puntos),
  daily: DIARIAS.join(','), hourly: HORARIAS.join(','), past_days: PASADOS, forecast_days: FUTUROS })}`;
export const urlModelos = (puntos) => `${PREVISION}?${new URLSearchParams({ ...coords(puntos),
  daily: 'precipitation_sum', models: MODELOS.join(','), forecast_days: 8 })}`;
export const urlArchivo = (puntos, desde, hasta) => `${ARCHIVO}?${new URLSearchParams({ ...coords(puntos),
  daily: 'precipitation_sum,soil_moisture_0_to_7cm_mean', start_date: desde, end_date: hasta })}`;

function mediaDiaria(horas, valores) {
  const g = new Map();
  horas.forEach((h, k) => { const d = h.slice(0, 10); if (!g.has(d)) g.set(d, []); if (valores[k] != null) g.get(d).push(valores[k]); });
  const r = new Map();
  for (const [d, v] of g) r.set(d, v.length >= 20 ? v.reduce((a, b) => a + b, 0) / v.length : null);
  return r;
}

export function parsearPrincipal(json, puntos, hoy) {
  const series = {};
  comoLista(json).forEach((r, k) => {
    const d = r.daily, h = r.hourly;
    const i = d.time.indexOf(hoy);
    if (i === -1) throw new Error(`hoy (${hoy}) no está en la serie de Open-Meteo`);
    const hs = mediaDiaria(h.time, h.soil_moisture_0_to_7cm), ts = mediaDiaria(h.time, h.soil_temperature_0_to_7cm);
    series[puntos[k].id] = {
      fechas: d.time, hoy: i,
      precip: d.precipitation_sum, tmedia: d.temperature_2m_mean, tmin: d.temperature_2m_min, tmax: d.temperature_2m_max,
      et0: d.et0_fao_evapotranspiration, viento: d.wind_speed_10m_max, hr: d.relative_humidity_2m_mean,
      hsuelo: d.time.map((f) => hs.get(f) ?? null), tsuelo: d.time.map((f) => ts.get(f) ?? null),
      hsueloPct: d.time.map(() => null), lluviaAntesDeSerie: null,
      origenPrecip: d.time.map(() => 'modelo'), celdaAltitud: r.elevation,
    };
  });
  return series;
}

// Contraste sobre el horizonte común: cada modelo llega a un alcance distinto (Météo-France ~4 d, ICON ~7 d, ECMWF 8 d),
// así que se compara la lluvia acumulada de hoy+1…hoy+h, con h = el mayor (3–7) al que llegan al menos 2 modelos.
export function dispersion(r, hoy) {
  const d = r.daily, i0 = d.time.indexOf(hoy);
  const alcance = (m) => {
    const v = d[`precipitation_sum_${m}`];
    let n = 0;
    if (i0 !== -1 && v) while (n < 7 && v[i0 + 1 + n] != null) n++;
    return n;
  };
  const al = Object.fromEntries(MODELOS.map((m) => [m, alcance(m)]));
  let horizonte = null;
  for (let h = 7; h >= 3 && horizonte == null; h--) if (MODELOS.filter((m) => al[m] >= h).length >= 2) horizonte = h;
  if (horizonte == null) return { modelos: {}, media: null, rango: null, incierta: null, horizonte: null, excluidos: MODELOS.filter((m) => al[m] < 3) };
  const modelos = {};
  for (const m of MODELOS) if (al[m] >= horizonte) {
    const suma = d[`precipitation_sum_${m}`].slice(i0 + 1, i0 + 1 + horizonte).reduce((a, b) => a + b, 0);
    modelos[m] = Math.round(suma * 10) / 10;
  }
  const vals = Object.values(modelos), excluidos = MODELOS.filter((m) => !(m in modelos));
  const media = vals.reduce((a, b) => a + b, 0) / vals.length, rango = Math.max(...vals) - Math.min(...vals);
  return { modelos, media, rango, incierta: rango > 0.5 * media && rango > 10, horizonte, excluidos };
}

export function resumirArchivo(r, inicioSerie) {
  const d = r.daily, porMes = {};
  const a = Number(inicioSerie.slice(0, 4)), m = Number(inicioSerie.slice(5, 7));
  const agosto = `${m >= 8 ? a : a - 1}-08-01`;
  let mm = 0, falta = false;
  d.time.forEach((f, k) => {
    const v = d.soil_moisture_0_to_7cm_mean[k];
    if (v != null) (porMes[Number(f.slice(5, 7))] ??= []).push(v);
    if (f >= agosto && f < inicioSerie) { const p = d.precipitation_sum[k]; if (p == null) falta = true; else mm += p; }
  });
  return { porMes, lluviaAntesDeSerie: falta ? null : { desde: agosto, mm: Math.round(mm * 10) / 10 } };
}

export function percentil(v, muestra) {
  if (v == null || !muestra || muestra.length < 30) return null;
  let c = 0; for (const x of muestra) if (x <= v) c++;
  return (100 * c) / muestra.length;
}

export function aplicarClimatologia(serie, resumen) {
  const hsueloPct = serie.fechas.map((f, k) => {
    const m = Number(f.slice(5, 7));
    const muestra = [m - 1, m, m + 1].map((x) => ((x + 11) % 12) + 1).flatMap((x) => resumen.porMes[x] ?? []);
    return percentil(serie.hsuelo[k], muestra);
  });
  return { ...serie, hsueloPct, lluviaAntesDeSerie: resumen.lluviaAntesDeSerie };
}

async function pedir(fetchFn, url) {
  const r = await fetchFn(url);
  if (!r.ok) throw new Error(`Open-Meteo respondió ${r.status}`);
  const j = await r.json();
  if (j?.error) throw new Error(`Open-Meteo: ${j.reason}`);
  return j;
}

const diaAnterior = (f) => new Date(Date.parse(`${f}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);

async function climatologia(fetchFn, puntos, inicio, almacen) {
  const clave = `clim:${inicio}`;
  const c = leer(clave, almacen);
  if (c) return c.datos;
  try {
    const desde = `${Number(inicio.slice(0, 4)) - 3}-01-01`;
    const r = comoLista(await pedir(fetchFn, urlArchivo(puntos, desde, diaAnterior(inicio))));
    const res = Object.fromEntries(r.map((x, k) => [puntos[k].id, resumirArchivo(x, inicio)]));
    guardar(clave, res, undefined, almacen);
    borrarPrefijo('clim:', clave, almacen);
    return res;
  } catch { return null; }   // sin climatología, el índice se calcula sin fS y lo explica
}

// almacen: localStorage por defecto; null desactiva la caché (pruebas y scripts).
export async function obtenerMeteo(puntos, { fetchFn = globalThis.fetch?.bind(globalThis), ahora = new Date(), almacen = almacenPorDefecto() } = {}) {
  const hoy = hoyMadrid(ahora);
  const alm = almacen;
  const previo = leer('meteo', alm);
  if (previo && previo.datos.hoy === hoy && ahora - new Date(previo.hora) < TRES_HORAS) return { ...previo.datos, hora: previo.hora, desdeCache: true };
  try {
    const [principal, modelos] = await Promise.all([pedir(fetchFn, urlPrincipal(puntos)), pedir(fetchFn, urlModelos(puntos)).catch(() => null)]);
    let series = parsearPrincipal(principal, puntos, hoy);
    const inicio = series[puntos[0].id].fechas[0];
    const clim = await climatologia(fetchFn, puntos, inicio, alm);
    if (clim) series = Object.fromEntries(Object.entries(series).map(([id, s]) => [id, clim[id] ? aplicarClimatologia(s, clim[id]) : s]));
    const disp = modelos ? Object.fromEntries(comoLista(modelos).map((r, k) => [puntos[k].id, dispersion(r, hoy)])) : null;
    const datos = { hoy, series, dispersion: disp };
    const hora = ahora.toISOString();
    guardar('meteo', datos, hora, alm);
    return { ...datos, hora, desdeCache: false };
  } catch (e) {
    if (previo) return { ...previo.datos, hora: previo.hora, desdeCache: true, error: e.message };
    return { hoy, series: null, dispersion: null, hora: null, desdeCache: false, error: e.message };
  }
}

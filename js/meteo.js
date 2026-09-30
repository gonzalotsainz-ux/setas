// Open-Meteo: serie principal (60 días pasados + 10 de previsión), contraste de modelos, lluvia desde el 1-ago y climatología del suelo.
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
const ESPERA_MS = 15000;   // sin respuesta en 15 s, se da por caída y se usa la caché
export const ESPERA_ARCHIVO_MS = 45000;   // la climatología (2 años de archivo) tarda más
const ESPERA_LLUVIA_MS = 20000;           // la lluvia desde agosto es una petición pequeña
export const REINTENTO_MS = 20 * 60e3;    // la lluvia desde agosto que faltó se reintenta a los 20 min
// La climatología caída se reintenta con espera creciente (guardada en el almacén): 20 min → 1 h → 6 h → 24 h.
// Mientras dura la espera no se pide, ni en el refresco de 3 h. Un éxito la reinicia.
export const ESPERAS_CLIMA_MS = [20 * 60e3, 3600e3, 6 * 3600e3, 24 * 3600e3];
const CLIMA_VALIDA_MS = 30 * 864e5;       // la climatología del suelo apenas cambia: vale 30 días
const DIAS_CLIMA = 730;                   // 2 años completos: todas las estaciones del año (Morchella en primavera)

export const hoyMadrid = (ahora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);

const lista = (puntos, k) => puntos.map((p) => p[k]).join(',');
const comoLista = (j) => (Array.isArray(j) ? j : [j]);
const coords = (puntos) => ({ latitude: lista(puntos, 'lat'), longitude: lista(puntos, 'lon'), elevation: lista(puntos, 'altitud'), timezone: ZONA });

export const urlPrincipal = (puntos) => `${PREVISION}?${new URLSearchParams({ ...coords(puntos),
  daily: DIARIAS.join(','), hourly: HORARIAS.join(','), past_days: PASADOS, forecast_days: FUTUROS })}`;
export const urlModelos = (puntos) => `${PREVISION}?${new URLSearchParams({ ...coords(puntos),
  daily: 'precipitation_sum', models: MODELOS.join(','), forecast_days: 8 })}`;
export const urlArchivo = (puntos, desde, hasta, daily) => `${ARCHIVO}?${new URLSearchParams({ ...coords(puntos),
  daily, start_date: desde, end_date: hasta })}`;
// Pesos estimados de cada petición: docs/datos.md («Peso de las peticiones»).
export const urlClimatologia = (puntos, hasta) => urlArchivo(puntos, sumarDias(hasta, 1 - DIAS_CLIMA), hasta, 'soil_moisture_0_to_7cm_mean');
export const urlLluviaArchivo = (puntos, desde, hasta) => urlArchivo(puntos, desde, hasta, 'precipitation_sum');
export const urlLluviaPrevision = (puntos, desde, hasta) => `${PREVISION}?${new URLSearchParams({ ...coords(puntos),
  daily: 'precipitation_sum', start_date: desde, end_date: hasta })}`;

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

export function resumirArchivo(r) {
  const d = r?.daily, porMes = {};
  (d?.time ?? []).forEach((f, k) => {
    const v = d.soil_moisture_0_to_7cm_mean?.[k];
    if (v != null) (porMes[Number(f.slice(5, 7))] ??= []).push(v);
  });
  return { porMes };
}

// Lluvia de `desde` a `hasta` (ambos incluidos) de una respuesta diaria. Si falta algún día (hueco, o el archivo aún
// no llega hasta `hasta` por el retraso de ERA5), null: nunca se cuenta un día sin dato como 0.
export function lluviaAntes(r, desde, hasta) {
  const d = r?.daily;
  if (!d?.time || !d.precipitation_sum) return null;
  let mm = 0, dias = 0;
  for (const [k, f] of d.time.entries()) {
    if (f < desde || f > hasta) continue;
    const p = d.precipitation_sum[k];
    if (p == null || Number.isNaN(p)) return null;
    mm += p; dias++;
  }
  if (dias !== entreDias(desde, hasta) + 1) return null;
  return { desde, hasta, mm: Math.round(mm * 10) / 10 };
}

export function percentil(v, muestra) {
  if (v == null || !muestra || muestra.length < 30) return null;
  let c = 0; for (const x of muestra) if (x <= v) c++;
  return (100 * c) / muestra.length;
}

// Percentil de la humedad del suelo de cada día frente a la climatología del punto (mes anterior, el mismo y el siguiente).
export function aplicarClimatologia(serie, resumen) {
  const hsueloPct = serie.fechas.map((f, k) => {
    const m = Number(f.slice(5, 7));
    const muestra = [m - 1, m, m + 1].map((x) => ((x + 11) % 12) + 1).flatMap((x) => resumen.porMes?.[x] ?? []);
    return percentil(serie.hsuelo[k], muestra);
  });
  return { ...serie, hsueloPct };
}

// Lluvia desde el 1-ago hasta el día antes de la serie: solo vale si acaba justo ahí.
export function aplicarLluviaAntes(serie, ll) {
  const vale = ll && ll.hasta === diaAnterior(serie.fechas[0]);
  return { ...serie, lluviaAntesDeSerie: vale ? ll : null };
}

async function pedir(fetchFn, url, espera = ESPERA_MS) {
  const r = await fetchFn(url, { signal: AbortSignal.timeout(espera) });
  if (!r.ok) throw new Error(`Open-Meteo respondió ${r.status}`);
  const j = await r.json();
  if (j?.error) throw new Error(`Open-Meteo: ${j.reason}`);
  return j;
}

const DIA = 864e5;
const sumarDias = (f, n) => new Date(Date.parse(`${f}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const diaAnterior = (f) => sumarDias(f, -1);
const entreDias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA);
// 1 de agosto de la temporada de otoño en curso para una fecha (de agosto a diciembre, el del año; si no, el del anterior).
export const agostoDe = (f) => `${Number(f.slice(5, 7)) >= 8 ? Number(f.slice(0, 4)) : Number(f.slice(0, 4)) - 1}-08-01`;
const clavePuntos = (puntos) => puntos.map((p) => p.id).sort().join(',');

// Espera de la climatología tras fallos: { fallos, proximo (ISO) } o null.
function esperaClima(alm) {
  const e = leer('clim-espera', alm)?.datos;
  return e && Number.isFinite(e.fallos) && !Number.isNaN(Date.parse(e.proximo)) ? e : null;
}
export const climaEnEspera = (alm, ahora = new Date()) => { const e = esperaClima(alm); return !!e && ahora < new Date(e.proximo); };

// Climatología de humedad del suelo: 2 años hasta `hasta`, en caché 30 días con clave solo del conjunto de puntos
// (si se añade uno, se vuelve a pedir). Si falla, se usa la guardada aunque esté caducada; sin ninguna, null.
// Con la espera activa (fallos recientes) no se pide.
async function climatologia(fetchFn, puntos, hasta, alm, ahora) {
  const clave = `clim:${clavePuntos(puntos)}`;
  const c = leer(clave, alm);
  const guardada = c?.datos && typeof c.datos === 'object' && puntos.every((p) => c.datos[p.id]?.porMes) ? c.datos : null;
  if (guardada && ahora - new Date(c.hora) < CLIMA_VALIDA_MS) return guardada;
  if (climaEnEspera(alm, ahora)) return guardada;
  try {
    const r = comoLista(await pedir(fetchFn, urlClimatologia(puntos, hasta), ESPERA_ARCHIVO_MS));
    const res = Object.fromEntries(r.map((x, k) => [puntos[k].id, resumirArchivo(x)]));
    guardar(clave, res, ahora.toISOString(), alm);
    borrarPrefijo('clim:', clave, alm);
    borrarPrefijo('clim-espera', '', alm);
    return res;
  } catch {   // sin climatología, el índice se calcula sin fS y lo explica
    const fallos = (esperaClima(alm)?.fallos ?? 0) + 1;
    const espera = ESPERAS_CLIMA_MS[Math.min(fallos, ESPERAS_CLIMA_MS.length) - 1];
    guardar('clim-espera', { fallos, proximo: new Date(ahora.getTime() + espera).toISOString() }, undefined, alm);
    return guardada;
  }
}

// Lluvia desde el 1-ago hasta el día antes de la serie (la necesita el arranque de temporada de las de otoño desde que
// la serie de 60 días empieza después del 1-ago). Petición ligera al archivo (solo `precipitation_sum`), en caché por día
// (la clave lleva el inicio de la serie). Lo que el archivo no traiga se pide al forecast (guarda ~2 meses hacia atrás);
// si tampoco, ese punto queda sin dato (null) y sus especies de otoño salen «sin datos», no con una nota inventada.
// Devuelve { necesaria, porPunto: { id: {desde, hasta, mm} | null } }.
async function lluviaDesdeAgosto(fetchFn, puntos, hoy, inicio, alm) {
  const desde = agostoDe(hoy), hasta = diaAnterior(inicio);
  if (inicio <= desde) return { necesaria: false, porPunto: {} };
  const clave = `lluvia:${inicio}:${clavePuntos(puntos)}`;
  const c = leer(clave, alm)?.datos;
  if (c && puntos.every((p) => c[p.id]?.mm != null && c[p.id].desde === desde && c[p.id].hasta === hasta)) return { necesaria: true, porPunto: c };
  const porPunto = Object.fromEntries(puntos.map((p) => [p.id, null]));
  const rellenar = async (url, lista) => {
    try {
      const r = comoLista(await pedir(fetchFn, url, ESPERA_LLUVIA_MS));
      r.forEach((x, k) => { if (lista[k]) porPunto[lista[k].id] ??= lluviaAntes(x, desde, hasta); });
    } catch { /* se prueba con la siguiente fuente */ }
  };
  await rellenar(urlLluviaArchivo(puntos, desde, hasta), puntos);
  const faltan = puntos.filter((p) => !porPunto[p.id]);
  if (faltan.length) await rellenar(urlLluviaPrevision(faltan, desde, hasta), faltan);
  if (puntos.every((p) => porPunto[p.id])) { guardar(clave, porPunto, undefined, alm); borrarPrefijo('lluvia:', clave, alm); }
  return { necesaria: true, porPunto };
}

// Pone climatología y lluvia desde agosto en las series (cada una solo si llegó).
function completarSeries(series, clim, lluvia) {
  return Object.fromEntries(Object.entries(series).map(([id, s0]) => {
    let s = clim?.[id] ? aplicarClimatologia(s0, clim[id]) : s0;
    if (lluvia?.necesaria && !s.lluviaAntesDeSerie) s = aplicarLluviaAntes(s, lluvia.porPunto[id]);
    return [id, s];
  }));
}
// Qué falta (se reintenta a los REINTENTO_MS): climatología de algún punto o lluvia desde agosto cuando hace falta.
function pendienteDe(series, puntos, faltaClim) {
  const faltaLluvia = puntos.some((p) => { const s = series[p.id]; return s && s.fechas[0] > agostoDe(s.fechas[s.hoy]) && !s.lluviaAntesDeSerie; });
  return faltaClim || faltaLluvia ? { clim: faltaClim, lluvia: faltaLluvia } : null;
}
const faltaClimDe = (clim, puntos) => !clim || puntos.some((p) => !clim[p.id]);

// Qué reintento toca ya: la climatología si pasó su espera; la lluvia si pasaron REINTENTO_MS desde el último intento.
function tocaReintento(datos, alm, ahora) {
  const p = datos.pendiente;
  return { clim: !!p?.clim && !climaEnEspera(alm, ahora), lluvia: !!p?.lluvia && ahora - new Date(datos.intentoLluvia ?? datos.intento) >= REINTENTO_MS };
}
// Cuándo conviene volver a llamar a obtenerMeteo para reintentar lo pendiente (ISO) o null.
function proximoReintento(datos, alm) {
  const p = datos.pendiente, t = [];
  if (p?.clim) t.push(Date.parse(esperaClima(alm)?.proximo ?? datos.intento) || Date.now());
  if (p?.lluvia) t.push(Date.parse(datos.intentoLluvia ?? datos.intento) + REINTENTO_MS);
  return t.length ? new Date(Math.min(...t)).toISOString() : null;
}

// Reintento de lo que faltó y ya toca (climatología y/o lluvia desde agosto) sobre la meteo guardada, sin repetir el resto.
async function reintentarPendiente(fetchFn, puntos, datos, alm, ahora, toca) {
  const inicio = datos.series[puntos[0].id].fechas[0];
  const [clim, lluvia] = await Promise.all([
    toca.clim ? climatologia(fetchFn, puntos, diaAnterior(inicio), alm, ahora) : Promise.resolve(undefined),
    toca.lluvia ? lluviaDesdeAgosto(fetchFn, puntos, datos.hoy, inicio, alm) : Promise.resolve(undefined)]);
  const series = completarSeries(datos.series, clim, lluvia);
  const pendiente = pendienteDe(series, puntos, datos.pendiente.clim ? (toca.clim ? faltaClimDe(clim, puntos) : true) : false);
  return { ...datos, series, pendiente, ...(toca.lluvia ? { intentoLluvia: ahora.toISOString() } : {}) };
}

// almacen: localStorage por defecto; null desactiva la caché (pruebas y scripts).
export async function obtenerMeteo(puntos, { fetchFn = globalThis.fetch?.bind(globalThis), ahora = new Date(), almacen = almacenPorDefecto() } = {}) {
  const hoy = hoyMadrid(ahora);
  const alm = almacen;
  const previo = leer('meteo', alm)?.datos?.hoy ? leer('meteo', alm) : null;   // una entrada corrupta o antigua se ignora
  const completa = !!previo?.datos?.series && puntos.every((p) => previo.datos.series[p.id]);   // si se añadió un punto, la caché no vale
  if (previo && completa && previo.datos.hoy === hoy && ahora - new Date(previo.hora) < TRES_HORAS) {
    const p = previo.datos;
    const toca = tocaReintento(p, alm, ahora);
    if (toca.clim || toca.lluvia) {
      const datos = await reintentarPendiente(fetchFn, puntos, p, alm, ahora, toca);
      guardar('meteo', datos, previo.hora, alm);
      return { ...datos, hora: previo.hora, desdeCache: true, proximoReintento: proximoReintento(datos, alm) };
    }
    return { ...p, hora: previo.hora, desdeCache: true, proximoReintento: proximoReintento(p, alm) };
  }
  try {
    // Primero la serie principal (y los modelos); solo después el archivo, para no competir con ella.
    const [principal, modelos] = await Promise.all([pedir(fetchFn, urlPrincipal(puntos)), pedir(fetchFn, urlModelos(puntos)).catch(() => null)]);
    const bruto = parsearPrincipal(principal, puntos, hoy);
    const inicio = bruto[puntos[0].id].fechas[0];
    const [clim, lluvia] = await Promise.all([climatologia(fetchFn, puntos, diaAnterior(inicio), alm, ahora), lluviaDesdeAgosto(fetchFn, puntos, hoy, inicio, alm)]);
    const series = completarSeries(bruto, clim, lluvia);
    const pendiente = pendienteDe(series, puntos, faltaClimDe(clim, puntos));
    const disp = modelos ? Object.fromEntries(comoLista(modelos).map((r, k) => [puntos[k].id, dispersion(r, hoy)])) : null;
    const hora = ahora.toISOString();
    const datos = { hoy, series, dispersion: disp, pendiente, intento: hora };
    guardar('meteo', datos, hora, alm);
    return { ...datos, hora, desdeCache: false, proximoReintento: proximoReintento(datos, alm) };
  } catch (e) {
    if (previo) return { ...previo.datos, hora: previo.hora, desdeCache: true, error: e.message };
    return { hoy, series: null, dispersion: null, hora: null, desdeCache: false, error: e.message };
  }
}

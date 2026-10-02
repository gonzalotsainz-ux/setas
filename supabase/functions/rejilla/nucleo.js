// supabase/functions/rejilla/nucleo.js
// Lógica pura de la Edge Function «rejilla» (spec §3.2): cuándo toca, cuánto se gasta en Open-Meteo, qué se pide,
// cómo se reconstruyen las series y cuándo se publica. Sin red ni base de datos: se prueba con Node.
import { DIARIAS, HORARIAS, FUTUROS, PASADOS, urlPrincipal, urlArchivo, urlLluviaArchivo, parsearPrincipal, resumirArchivo,
  aplicarClimatologia, agostoDe, sumarDias, entreDias, horaMadrid, comoLista } from '../_shared/meteo.js';

export const PRESUPUESTO_DIA = 1000;                       // llamadas ponderadas a Open-Meteo al día (límite gratuito: 10.000)
export const EJECUCIONES_DIA = 2;
export const PRESUPUESTO_EJECUCION = PRESUPUESTO_DIA / EJECUCIONES_DIA;
export const HORAS = [7, 19];                              // hora de Madrid
export const MODELO = 'best_match';                        // la misma serie principal que js/meteo.js
export const TROZO = 200;                                  // = CONFIG.openMeteo.trozo (tarea 0)
export const MAX_PASADOS = 92;                             // = CONFIG.openMeteo.maxPasados (tarea 0)
export const CONSERVAR = 6;                                // índices publicados que se guardan (3 días)
const VARIABLES = DIARIAS.length + HORARIAS.length;
const SUELO = 'soil_moisture_0_to_7cm_mean';
const COLUMNAS = ['precip', 'tmedia', 'tmin', 'tmax', 'et0', 'viento', 'hr', 'hsuelo', 'tsuelo'];

// pg_cron va en UTC (05, 06, 17 y 18): solo trabaja la llamada en que en Madrid son las 07 o las 19, en verano y en invierno.
export const selloDe = (ahora) => horaMadrid(ahora);
export function tocaEjecutar(ahora) { const s = selloDe(ahora); return HORAS.includes(Number(s.slice(11))) ? s : null; }

export const pesoPeticion = (ubicaciones, variables, dias) => ubicaciones * Math.max(1, variables / 10) * Math.max(1, dias / 14);
export const inicioSerie = (hoy) => { const a = agostoDe(hoy), b = sumarDias(hoy, -(PASADOS - 1)); return a < b ? a : b; };

// Qué hay que pedir de una celda según su resumen en meteo_celdas ({ desde, hasta, dias } de días ya observados).
export function estadoCelda(res, hoy, maxPasados = MAX_PASADOS) {
  const inicio = inicioSerie(hoy);
  const completo = !!res && res.desde <= inicio && !!res.hasta && res.dias === entreDias(res.desde, res.hasta) + 1;
  if (completo && res.hasta >= sumarDias(hoy, -3)) return { tipo: 'diaria', pasados: 2 };
  const desde = completo ? sumarDias(res.hasta, 1) : inicio;
  const pasados = entreDias(desde, hoy);
  if (pasados <= maxPasados) return { tipo: 'relleno', pasados };
  return { tipo: 'relleno', pasados: maxPasados, archivo: { desde, hasta: sumarDias(hoy, -(maxPasados + 1)) } };
}

const mesDe = (f) => Number(f.slice(5, 7));
const normal = (m) => ((m - 1 + 12) % 12) + 1;
const dia = (d) => d.toISOString().slice(0, 10);
export function ventanasClima(fecha) {
  const a = Number(fecha.slice(0, 4)), m = mesDe(fecha);
  return { meses: [m - 1, m, m + 1, m + 2].map(normal),
    ventanas: [1, 2].map((k) => ({ desde: dia(new Date(Date.UTC(a - k, m - 2, 1))), hasta: dia(new Date(Date.UTC(a - k, m + 2, 0))) })) };
}
export const climaUtil = (fila, fecha) => { const m = mesDe(fecha); return Array.isArray(fila?.meses) && [m - 1, m, m + 1].map(normal).every((x) => fila.meses.includes(x)); };

const puntos = (cs) => cs.map((c) => ({ id: c.id, lat: c.lat, lon: c.lon, altitud: c.altRef }));
const trocear = (lista, n) => { const r = []; for (let k = 0; k < lista.length; k += n) r.push(lista.slice(k, k + n)); return r; };
const idsDe = (c) => [c.id, ...(c.iguales ?? [])];

// Una sola petición por posición: las gruesas que se repiten entre zonas (mismo col:fila) comparten meteo. La primera
// representa al grupo y lleva en `iguales` los ids de las demás; su altitud es la media de las finas de todas
// (ponderada por nFinas si lo traen, si no, simple), que es la altRef de la celda gruesa entera. [CRITERIO PROPIO]
function agrupar(celdas) {
  const g = new Map();
  for (const c of celdas) { const k = `${c.lat}|${c.lon}`; if (!g.has(k)) g.set(k, []); g.get(k).push(c); }
  return [...g.values()].map((miembros) => {
    if (miembros.length === 1) return { rep: miembros[0], miembros };
    const pesos = miembros.every((c) => c.nFinas > 0) ? miembros.map((c) => c.nFinas) : miembros.map(() => 1);
    const total = pesos.reduce((a, b) => a + b, 0);
    const altRef = Math.round(miembros.reduce((a, c, k) => a + c.altRef * pesos[k], 0) / total);
    return { rep: { ...miembros[0], altRef, iguales: miembros.slice(1).map((c) => c.id) }, miembros };
  });
}
// Altitud con la que se pide la meteo de cada celda (la del grupo si está repetida): es la altRef que debe publicarse
// y usarse al resumir, para que la temperatura y la altitud de referencia vayan juntas.
export const altitudConsulta = (celdas) => new Map(agrupar(celdas).flatMap((g) => g.miembros.map((c) => [c.id, g.rep.altRef])));

// Lo que necesita un grupo: si a alguien le falta más de lo diario, relleno con los pasados máximos y el archivo
// desde lo más antiguo; cubre lo que les falta a todos.
function unirEstados(estados) {
  const rellenos = estados.filter((e) => e.tipo === 'relleno');
  if (!rellenos.length) return estados[0];
  const pasados = Math.max(...rellenos.map((e) => e.pasados));
  const archivos = rellenos.filter((e) => e.archivo).map((e) => e.archivo);
  if (!archivos.length) return { tipo: 'relleno', pasados };
  return { tipo: 'relleno', pasados, archivo: { desde: archivos.map((a) => a.desde).sort()[0], hasta: archivos.map((a) => a.hasta).sort().at(-1) } };
}

export function planificar({ celdas, resumen, clima, hoy, presupuesto = PRESUPUESTO_EJECUCION, trozo = TROZO, maxPasados = MAX_PASADOS }) {
  const peticiones = [];
  let peso = 0;
  const pesoDe = (e) => pesoPeticion(1, VARIABLES, e.pasados + FUTUROS) + (e.archivo ? pesoPeticion(1, 1, entreDias(e.archivo.desde, e.archivo.hasta) + 1) : 0);
  const grupos = agrupar(celdas);
  const estados = grupos.map((g) => ({ g, e: unirEstados(g.miembros.map((c) => estadoCelda(resumen.get(c.id), hoy, maxPasados))) }));
  const lotes = new Map();
  for (const tipo of ['diaria', 'relleno']) for (const { g, e } of estados) {
    if (e.tipo !== tipo) continue;
    const p = pesoDe(e);
    if (peso + p > presupuesto) continue;
    peso += p;
    const clave = `${e.pasados}|${e.archivo?.desde ?? ''}|${e.archivo?.hasta ?? ''}`;
    if (!lotes.has(clave)) lotes.set(clave, { e, celdas: [] });
    lotes.get(clave).celdas.push(g.rep);
  }
  for (const { e, celdas: cs } of lotes.values()) for (const t of trocear(cs, trozo)) {
    peticiones.push({ tipo: 'principal', celdas: t, url: urlPrincipal(puntos(t), { pasados: e.pasados, futuros: FUTUROS }) });
    if (e.archivo) peticiones.push({ tipo: 'archivo', celdas: t, desde: e.archivo.desde, hasta: e.archivo.hasta, url: urlLluviaArchivo(puntos(t), e.archivo.desde, e.archivo.hasta) });
  }
  // Climatología del suelo: grupos en los que a alguien le falta para el final del horizonte, de la más vieja a la más nueva.
  const fin = sumarDias(hoy, FUTUROS - 1);
  const { ventanas } = ventanasClima(hoy);
  const pClima = ventanas.reduce((t, v) => t + pesoPeticion(1, 1, entreDias(v.desde, v.hasta) + 1), 0);
  const antiguedad = (g) => g.miembros.map((c) => String(clima.get(c.id)?.actualizado ?? '')).sort()[0];
  const viejas = grupos.filter((g) => g.miembros.some((c) => !climaUtil(clima.get(c.id), fin)))
    .sort((a, b) => antiguedad(a).localeCompare(antiguedad(b)));
  const elegidas = [];
  for (const g of viejas) { if (peso + pClima > presupuesto) break; peso += pClima; elegidas.push(g.rep); }
  trocear(elegidas, trozo).forEach((t, n) => { for (const v of ventanas) peticiones.push({ tipo: 'clima', trozo: n, celdas: t, url: urlArchivo(puntos(t), v.desde, v.hasta, SUELO) }); });
  return { peticiones, peso };
}

// Las filas* reciben las `celdas` de la petición (alineadas con las ubicaciones de la URL) y devuelven filas para
// cada id, también los de `iguales`.
export function filasDePrincipal(json, celdas, hoy, ahora = new Date()) {
  const series = parsearPrincipal(json, puntos(celdas), hoy), cuando = ahora.toISOString();
  return celdas.flatMap((c) => {
    const s = series[c.id];
    return idsDe(c).flatMap((id) => s.fechas.map((fecha, k) => ({ celda: id, fecha, modelo: MODELO,
      ...Object.fromEntries(COLUMNAS.map((col) => [col, s[col][k] ?? null])), previsto: fecha >= hoy, actualizado: cuando })));
  });
}
export function filasDeArchivoLluvia(json, celdas, desde, hasta, ahora = new Date()) {
  const lista = comoLista(json), cuando = ahora.toISOString();
  return celdas.flatMap((c, k) => {
    const d = lista[k]?.daily;
    if (!d?.time) return [];
    return idsDe(c).flatMap((id) => d.time.flatMap((fecha, j) => (fecha >= desde && fecha <= hasta && d.precipitation_sum?.[j] != null
      ? [{ celda: id, fecha, modelo: MODELO, precip: d.precipitation_sum[j], previsto: false, actualizado: cuando }] : [])));
  });
}
// Climatología de un trozo de celdas a partir de las dos ventanas; solo las celdas con todos los meses.
export function filasDeClima(partes, celdas, hoy, ahora = new Date()) {
  const { meses } = ventanasClima(hoy);
  return celdas.flatMap((c, k) => {
    const porMes = {};
    for (const json of partes) for (const [m, v] of Object.entries(resumirArchivo(comoLista(json)[k]).porMes)) (porMes[m] ??= []).push(...v);
    if (!meses.every((m) => porMes[m]?.length)) return [];
    return idsDe(c).map((id) => ({ celda: id, por_mes: porMes, meses, actualizado: ahora.toISOString() }));
  });
}

// Serie con la forma de parsearPrincipal (js/meteo.js) a partir de la fila de series_celdas (arrays por columna, con
// `previsto` y `actualizado` paralelos). No se usa como dato: una previsión para un día ya pasado (no llegó la
// observación) ni, si se da `inicioEjecucion`, una previsión de hoy en adelante que no se ha renovado en esta ejecución.
export function serieDesdeFilas(fila, desde, hasta, hoy, inicioEjecucion = null) {
  const fechas = Array.from({ length: entreDias(desde, hasta) + 1 }, (_, k) => sumarDias(desde, k));
  const iHoy = fechas.indexOf(hoy);
  if (iHoy === -1) throw new Error(`hoy (${hoy}) no está entre ${desde} y ${hasta}`);
  const pos = new Map((fila?.fechas ?? []).map((f, j) => [String(f).slice(0, 10), j]));
  const limite = inicioEjecucion == null ? null : new Date(inicioEjecucion).getTime();
  const vale = (f, j) => {
    if (!fila.previsto?.[j]) return true;
    if (f < hoy) return false;
    return limite == null || (fila.actualizado?.[j] != null && new Date(fila.actualizado[j]).getTime() >= limite);
  };
  const columna = (col) => fechas.map((f) => { const j = pos.get(f), v = j == null || !vale(f, j) ? null : fila[col]?.[j]; return v == null || Number.isNaN(v) ? null : v; });
  return { fechas, hoy: iHoy, ...Object.fromEntries(COLUMNAS.map((c) => [c, columna(c)])),
    hsueloPct: fechas.map(() => null), lluviaAntesDeSerie: null, origenPrecip: fechas.map(() => 'modelo') };
}
export function aplicarClimaCelda(serie, fila) {
  if (!fila?.por_mes) return serie;
  const s = aplicarClimatologia(serie, { porMes: fila.por_mes });
  return { ...s, hsueloPct: s.hsueloPct.map((v, k) => (climaUtil(fila, serie.fechas[k]) ? v : null)) };
}

export const decidirPublicacion = (conDatos, total) => total > 0 && conDatos / total >= 0.9;
export const archivosABorrar = (nombres, conservar = CONSERVAR) =>
  nombres.filter((n) => /^\d{4}-\d{2}-\d{2}T\d{2}\.json$/.test(n)).sort().reverse().slice(conservar);
export const celdasDelLote = (celdas, lote, lotes) => celdas.filter((_, k) => k % lotes === lote);

// Las IPs de salida de Supabase son compartidas: un 429 (o un 5xx, o un fallo de red) se espera (Retry-After si
// viene, acotado a 60 s) y se reintenta; al agotar los intentos, error. `limite` (tiempo máximo de cada intento) puede
// ser una función: se recalcula en cada intento, y si no llega a `minimo` el intento no empieza (PlazoAgotado).
export class PlazoAgotado extends Error { constructor() { super('plazo agotado'); this.name = 'PlazoAgotado'; } }
export async function pedirConReintento(fetchFn, url, { intentos = 3, esperas = [5000, 20000], esperar = (ms) => new Promise((r) => setTimeout(r, ms)),
  limite = 60000, minimo = 0, senal = (ms) => AbortSignal.timeout(ms) } = {}) {
  for (let n = 1; ; n++) {
    const ms = typeof limite === 'function' ? limite() : limite;
    if (!(ms > 0 && ms >= minimo)) throw new PlazoAgotado();
    let r;
    try { r = await fetchFn(url, { signal: senal(ms) }); } catch (e) {
      if (n >= intentos) throw e;
      await esperar(esperas[Math.min(n, esperas.length) - 1]);
      continue;
    }
    if (r.ok) { const j = await r.json(); if (j?.error) throw new Error(`Open-Meteo: ${j.reason}`); return j; }
    if ((r.status === 429 || r.status >= 500) && n < intentos) {
      const ra = Number(r.headers?.get?.('retry-after'));
      await esperar(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 60000) : esperas[Math.min(n, esperas.length) - 1]);
      continue;
    }
    throw new Error(`Open-Meteo respondió ${r.status}`);
  }
}

// Sesgo del modelo por zona: vive en _shared/pluvio.js (lo usan también Hoy y Zona); se reexporta para el manejador.
export { ESTACIONES_SESGO, factoresPorZona } from '../_shared/pluvio.js';

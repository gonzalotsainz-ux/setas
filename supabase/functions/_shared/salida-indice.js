// Índice diario que publica la Edge Function «rejilla» (bucket público `indice`, `<sello>.json`) y que lee el móvil.
// Por celda gruesa: altitud de referencia, lluvia diaria (para la gráfica) y, por día, los agregados de indice.js
// (agregadosDia) en una lista fija de 15 números; null = ese día no se pudo calcular. Formato: docs/datos.md.
import { agregadosDia, DatosIncompletos } from './indice.js';
import { sumarDias } from './meteo.js';

export const VERSION_SALIDA = 1;
export const CAMPOS_DIA = ['P26', 'P3', 'lag', 'pct', 'Pagosto', 'secante', 'T20aire', 'T20suelo'];
const LARGO = CAMPOS_DIA.length + 7;
const r2 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 100) / 100);
// Origen de la lluvia de cada día en `lluvia.origen` (solo si había lluvia medida publicada, tarea 12 del plan de
// pluviómetros): 0 modelo, 1 medida en pluviómetros, 2 modelo corregido por su sesgo.
const ORIGEN = { modelo: 0, medida: 1, estimada: 2 };
const ORIGEN_TEXTO = ['modelo', 'medida', 'estimada'];

export function empaquetarDia(ag) {
  if (!ag) return null;
  return [...CAMPOS_DIA.map((k) => (k === 'secante' ? (ag.secante == null ? null : ag.secante ? 1 : 0) : r2(ag[k]))), ...ag.tmin7.map(r2)];
}
export function desempaquetarDia(lista, fecha, prevision) {
  if (!Array.isArray(lista) || lista.length !== LARGO) return null;
  const ag = { fecha, prevision };
  CAMPOS_DIA.forEach((k, j) => { ag[k] = k === 'secante' ? (lista[j] === 0 || lista[j] === 1 ? lista[j] === 1 : null) : lista[j]; });
  ag.tmin7 = lista.slice(CAMPOS_DIA.length);
  return ag;
}
// Lo mínimo para que alguna especie pueda dar nota: lluvia de 26 días (P26), tanda de lluvia (P3), ambiente secante
// (índice 5) y temperatura del aire (T20aire). Una celda sin ello no cuenta como con datos.
export const diaConDatos = (lista) => Array.isArray(lista) && lista[0] != null && lista[1] != null && lista[5] != null && lista[6] != null;

export function resumirCelda({ altRef, serie, fechas, pluvio = null }) {
  const dias = fechas.map((f) => {
    const i = serie.fechas.indexOf(f);
    if (i === -1) return null;
    try { return empaquetarDia(agregadosDia(serie, i)); } catch (e) { if (e instanceof DatosIncompletos) return null; throw e; }
  });
  const i0 = Math.max(0, serie.hoy - 59), i1 = Math.min(serie.fechas.length, serie.hoy + fechas.length);
  const lluvia = { desde: serie.fechas[i0], hoy: serie.hoy - i0, mm: serie.precip.slice(i0, i1).map(r2) };
  if (pluvio) {
    lluvia.origen = serie.fechas.slice(i0, i1).map((_, k) => ORIGEN[serie.origenPrecip?.[i0 + k]] ?? 0);
    lluvia.estaciones = pluvio.estaciones;
    if (pluvio.km) lluvia.km = pluvio.km;   // distancia (km) de cada estación nombrada
    lluvia.cercanas = pluvio.cercanas;
  }
  return { altRef, incompleta: !dias.every(diaConDatos), lluvia, dias };
}

export function agregadosDeCelda(salida, id, fecha) {
  const c = salida?.celdas && Object.hasOwn(salida.celdas, id) ? salida.celdas[id] : null, k = salida?.fechas?.indexOf(fecha) ?? -1;
  if (!c || !Array.isArray(c.dias) || k === -1) return null;
  return desempaquetarDia(c.dias[k], fecha, fecha > salida.hoy);
}

export function serieLluvia(celda) {
  const { desde, hoy, mm, origen } = celda.lluvia;
  const serie = { fechas: mm.map((_, k) => sumarDias(desde, k)), precip: mm, hoy };
  return Array.isArray(origen) ? { ...serie, origenPrecip: origen.map((c) => ORIGEN_TEXTO[c] ?? 'modelo') } : serie;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));

export function validarSalida(s) {
  const e = [];
  if (s?.version !== VERSION_SALIDA) e.push('versión desconocida');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(s?.sello ?? '')) e.push('sello mal formado');
  const fechas = s?.fechas;
  if (!Array.isArray(fechas) || !fechas.length) e.push('sin fechas');
  else if (!fechas.every((f) => typeof f === 'string' && FECHA.test(f)) || fechas.some((f, k) => k && f <= fechas[k - 1])) e.push('fechas mal formadas, repetidas o desordenadas');
  if (!FECHA.test(s?.hoy ?? '') || (Array.isArray(fechas) && !fechas.includes(s.hoy))) e.push('hoy ausente o fuera de las fechas');
  const celdas = s?.celdas;
  if (!celdas || typeof celdas !== 'object' || !Object.keys(celdas).length) e.push('sin celdas');
  else for (const [id, c] of Object.entries(celdas)) {   // se reportan todas las celdas malas
    const l = c?.lluvia;
    const bien = typeof c?.altRef === 'number' && Array.isArray(c.dias) && c.dias.length === fechas?.length
      && c.dias.every((d) => d === null || (Array.isArray(d) && d.length === LARGO && d.every(num)))
      && typeof l?.desde === 'string' && FECHA.test(l.desde) && Number.isInteger(l.hoy) && Array.isArray(l.mm) && l.mm.every(num)
      && (!('origen' in l) || (Array.isArray(l.origen) && l.origen.length === l.mm.length && l.origen.every((c) => c === 0 || c === 1 || c === 2)))
      && (!('estaciones' in l) || (Array.isArray(l.estaciones) && l.estaciones.every((n) => typeof n === 'string')))
      && (!('km' in l) || (Array.isArray(l.km) && l.km.length === l.estaciones?.length && l.km.every(num)))
      && (!('cercanas' in l) || Number.isInteger(l.cercanas));
    if (!bien) e.push(`celda ${id} mal formada`);
  }
  return e;
}

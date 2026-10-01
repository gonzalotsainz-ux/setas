// Índice diario que publica la Edge Function «rejilla» (bucket público `indice`, `<sello>.json`) y que lee el móvil.
// Por celda gruesa: altitud de referencia, lluvia diaria (para la gráfica) y, por día, los agregados de indice.js
// (agregadosDia) en una lista fija de 15 números; null = ese día no se pudo calcular. Formato: docs/datos.md.
import { agregadosDia, DatosIncompletos } from './indice.js';
import { sumarDias } from './meteo.js';

export const VERSION_SALIDA = 1;
export const CAMPOS_DIA = ['P26', 'P3', 'lag', 'pct', 'Pagosto', 'secante', 'T20aire', 'T20suelo'];
const LARGO = CAMPOS_DIA.length + 7;
const r2 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 100) / 100);

export function empaquetarDia(ag) {
  if (!ag) return null;
  return [...CAMPOS_DIA.map((k) => (k === 'secante' ? (ag.secante == null ? null : ag.secante ? 1 : 0) : r2(ag[k]))), ...ag.tmin7.map(r2)];
}
export function desempaquetarDia(lista, fecha, prevision) {
  if (!Array.isArray(lista) || lista.length !== LARGO) return null;
  const ag = { fecha, prevision };
  CAMPOS_DIA.forEach((k, j) => { ag[k] = k === 'secante' ? (lista[j] == null ? null : lista[j] === 1) : lista[j]; });
  ag.tmin7 = lista.slice(CAMPOS_DIA.length);
  return ag;
}
// Lo mínimo para casi todas las especies: lluvia de 26 días y temperatura del aire.
export const diaConDatos = (lista) => Array.isArray(lista) && lista[0] != null && lista[6] != null;

export function resumirCelda({ altRef, serie, fechas }) {
  const dias = fechas.map((f) => {
    const i = serie.fechas.indexOf(f);
    if (i === -1) return null;
    try { return empaquetarDia(agregadosDia(serie, i)); } catch (e) { if (e instanceof DatosIncompletos) return null; throw e; }
  });
  const i0 = Math.max(0, serie.hoy - 59), i1 = Math.min(serie.fechas.length, serie.hoy + fechas.length);
  return { altRef, incompleta: !dias.every(diaConDatos), lluvia: { desde: serie.fechas[i0], hoy: serie.hoy - i0, mm: serie.precip.slice(i0, i1).map(r2) }, dias };
}

export function agregadosDeCelda(salida, id, fecha) {
  const c = salida?.celdas?.[id], k = salida?.fechas?.indexOf(fecha) ?? -1;
  if (!c || k === -1) return null;
  return desempaquetarDia(c.dias[k], fecha, fecha > salida.hoy);
}

export function serieLluvia(celda) {
  const { desde, hoy, mm } = celda.lluvia;
  return { fechas: mm.map((_, k) => sumarDias(desde, k)), precip: mm, hoy };
}

export function validarSalida(s) {
  const e = [];
  if (s?.version !== VERSION_SALIDA) e.push('versión desconocida');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(s?.sello ?? '')) e.push('sello mal formado');
  if (!Array.isArray(s?.fechas) || !s.fechas.length) e.push('sin fechas');
  if (!s?.celdas || typeof s.celdas !== 'object') e.push('sin celdas');
  else for (const [id, c] of Object.entries(s.celdas)) {
    if (typeof c?.altRef !== 'number' || !Array.isArray(c.dias) || c.dias.length !== s.fechas?.length) { e.push(`celda ${id} mal formada`); break; }
  }
  return e;
}

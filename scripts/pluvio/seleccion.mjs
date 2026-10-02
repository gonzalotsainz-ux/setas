// scripts/pluvio/seleccion.mjs
// Piezas puras de la selección de estaciones (scripts/pluvio/estaciones.mjs), con pruebas.
import { distanciaKm, MEZCLA } from '../../supabase/functions/_shared/pluvio.js';

const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'y']);
// «OLLA DEL QUIÑON EN BUSTARVIEJO» → «Olla del Quiñon en Bustarviejo» (tras un paréntesis, siempre mayúscula).
export function nombreBonito(texto) {
  const partes = String(texto).toLowerCase().split(/(\s+|-|\()/);
  return partes.map((p, k) => (k > 0 && partes[k - 1] !== '(' && MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
}
export const nombreDuero = (texto) => String(texto).replace(/,\s*PL-[\w.]+$/, '');

export function puntoCercano(e, puntos) {
  let mejor = null;
  for (const p of puntos) { const km = distanciaKm(e, p); if (km != null && (!mejor || km < mejor.km)) mejor = { p, km }; }
  return mejor;
}
export function elegir(candidatas, puntos, { maxKm = MEZCLA.radioKm, maxDesnivel = MEZCLA.desnivelMax, sinAltitud = false } = {}) {
  return candidatas.filter((e) => {
    const c = puntoCercano(e, puntos);
    return !!c && c.km < maxKm && (sinAltitud || (Number.isFinite(e.altitud) && Math.abs(e.altitud - c.p.altitud) <= maxDesnivel));
  });
}
export function resumenPorZona(lista, puntos) {
  const r = {};
  for (const e of lista) { const z = puntoCercano(e, puntos)?.p.zona ?? 'sin zona'; (r[z] ??= {})[e.fuente] = (r[z][e.fuente] ?? 0) + 1; }
  return r;
}

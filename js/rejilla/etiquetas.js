// js/rejilla/etiquetas.js
// Las mejores manchas de la vista (nivel 3): qué celdas llevan etiqueta y qué dice. Funciones puras, sin DOM ni Leaflet.
import { SIN_DATOS, SIN_COLOR } from './pintor.js';

const UMBRIA = new Set([1, 2, 8]);   // N, NE, NO (índices de ORIENTACIONES en formato.js)
const SOLANA = new Set([4, 5, 6]);   // SE, S, SO
const NBSP = ' ';

// → [{ k, col, fila, valor }]: celdas de `minimo` a 100 que son máximo local 3×3, de mayor a menor y a `separacion` celdas
// (Chebyshev) o más unas de otras; avaricia hasta `max`. En una meseta de celdas iguales solo cuenta la primera.
export const MINIMO_ETIQUETA = 60;   // solo llevan etiqueta las manchas de «Bueno» en adelante
export function elegirEtiquetas({ notas, ancho, max = 3, minimo = MINIMO_ETIQUETA, separacion = 12 }) {
  const alto = Math.floor(notas.length / ancho), candidatas = [];
  const valorDe = (c, f) => (c < 0 || f < 0 || c >= ancho || f >= alto ? -1 : (notas[f * ancho + c] > 100 ? -1 : notas[f * ancho + c]));
  for (let fila = 0; fila < alto; fila++) {
    for (let col = 0; col < ancho; col++) {
      const k = fila * ancho + col, v = notas[k];
      if (v === SIN_COLOR || v === SIN_DATOS || v < minimo || v > 100) continue;
      let maximo = true;
      for (let df = -1; df <= 1 && maximo; df++) for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !df) continue;
        const w = valorDe(col + dc, fila + df);
        if (w > v || (w === v && df * ancho + dc < 0)) { maximo = false; break; }   // mayor, o igual y anterior en el recorrido
      }
      if (maximo) candidatas.push({ k, col, fila, valor: v });
    }
  }
  return separar(candidatas, { max, separacion });
}

// Avaricia: de mayor a menor valor, descarta las que quedan a menos de `separacion` celdas (Chebyshev) de una ya elegida.
// Sirve también para juntar las de varios archivos si traen col y fila globales.
export function separar(candidatas, { max = 3, separacion = 12 } = {}) {
  const elegidas = [];
  for (const c of [...candidatas].sort((a, b) => b.valor - a.valor || a.k - b.k)) {
    if (elegidas.length >= max) break;
    if (elegidas.every((e) => Math.max(Math.abs(e.col - c.col), Math.abs(e.fila - c.fila)) >= separacion)) elegidas.push(c);
  }
  return elegidas;
}

// 'Níscalos 84 · umbría' | '… · solana' | '… · 1450 m' (altitud a 10 m, sin separador de miles, espacio duro antes de «m»).
export function textoEtiqueta({ especie, valor, orientacion, altitud }) {
  const lugar = UMBRIA.has(orientacion) ? 'umbría' : SOLANA.has(orientacion) ? 'solana' : `${Math.round(altitud / 10) * 10}${NBSP}m`;
  return `${especie} ${valor} · ${lugar}`;
}

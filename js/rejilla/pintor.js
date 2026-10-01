// js/rejilla/pintor.js
// Notas por celda fina y colores del semáforo (sin DOM: vale en un Web Worker). La nota se memoriza por celda gruesa,
// hábitat, altitud en tramos de 10 m y orientación. Sin monte apropiado o prohibido: SIN_COLOR (transparente);
// celda gruesa sin datos (o sin altitud de referencia): SIN_DATOS (gris, «sin datos suficientes»). Nunca un color
// inventado. El bit FUERA_PROVINCIAS no cambia la nota: la marca la pone la hoja.
import { notaCelda } from './nota.js';
import { agregadosDeCelda } from './salida.js';
import { idGruesa, centroFina, aGrados } from './geo.js';
import { PROHIBIDO, CODIGO } from './formato.js';
import { NIVEL_COLOR } from '../mapa/colores.js';
import { nivelDe } from '../ui/semaforo.js';

export const SIN_COLOR = 255, SIN_DATOS = 254;
export const ALFA = 150, ALFA_GRIS = 110;
// «Sin datos» en damero (una celda con ALFA_GRIS y la vecina con ALFA_TRAMA): así no se confunde con «Nulo», que es
// un gris parecido pero liso. La paleta de Hoy y Zona no cambia.
export const ALFA_TRAMA = 35;

// Solo una celda con código de hábitat y sin la marca de prohibido puede llevar nota.
const conMonte = (h) => (h & CODIGO) !== 0 && (h & PROHIBIDO) === 0;

export function gruesasDeArchivo(rejilla, gruesa) {
  const c = rejilla.cabecera, n = c.ancho * c.alto, idx = new Int32Array(n).fill(-1);
  const pos = new Map(gruesa.celdas.map((g, k) => [g.id, k])), paso = gruesa.pasos[c.zona];
  for (let f = 0; f < c.alto; f++) for (let col = 0; col < c.ancho; col++) {
    const k = f * c.ancho + col;
    if (!conMonte(rejilla.habitat[k])) continue;
    const { x, y } = centroFina(c.col0 + col, c.fila0 + f, c.tam), p = aGrados(x, y);
    idx[k] = pos.get(idGruesa(c.zona, p.lon, p.lat, paso)) ?? -1;
  }
  return idx;
}

// Altitud a la que se pidió la meteo de la celda gruesa (la publicada en el índice). Sin ella, undefined: notaCelda
// no corrige con un valor supuesto y la celda queda en gris.
const altRefDe = (salida, id) => (id != null && salida?.celdas && Object.hasOwn(salida.celdas, id) ? salida.celdas[id]?.altRef : undefined);
const notaDe = (r) => (r.sinEspecies ? SIN_COLOR : r.valor == null ? SIN_DATOS : r.valor);

export function notasDeArchivo({ rejilla, gruesas, gruesa, salida, fecha, especies, filtro = null }) {
  const c = rejilla.cabecera, n = c.ancho * c.alto, notas = new Uint8Array(n).fill(SIN_COLOR), memo = new Map();
  for (let k = 0; k < n; k++) {
    const h = rejilla.habitat[k];
    if (!conMonte(h)) continue;
    const codigo = h & CODIGO, g = gruesas[k], banda = Math.round(rejilla.altitud[k] / 10), ori = rejilla.terreno[k] & 0x0f;
    const clave = (((g + 1) * 32 + codigo) * 1024 + (banda + 100)) * 16 + ori;
    let v = memo.get(clave);
    if (v === undefined) {
      const cg = g >= 0 ? gruesa.celdas[g] : null;
      const ag = cg ? agregadosDeCelda(salida, cg.id, fecha) : null;
      v = notaDe(notaCelda({ ag, habitat: c.habitats[codigo - 1], altitud: banda * 10, altRef: altRefDe(salida, cg?.id),
        orientacion: ori, especies, fecha, filtro, explicar: false }));
      memo.set(clave, v);
    }
    notas[k] = v;
  }
  return notas;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// Paleta por nota (0–100), SIN_DATOS en gris y el resto (SIN_COLOR) transparente.
const PALETA = (() => {
  const p = new Uint8ClampedArray(256 * 4);
  for (let v = 0; v <= 100; v++) p.set([...rgb(NIVEL_COLOR[nivelDe(v)]), ALFA], v * 4);
  p.set([...rgb(NIVEL_COLOR['sin-datos']), ALFA_GRIS], SIN_DATOS * 4);
  return p;
})();
// Con `ancho` (columnas del archivo), las celdas sin datos van en damero.
export function colorear(notas, ancho = 0) {
  const px = new Uint8ClampedArray(notas.length * 4);
  for (let k = 0; k < notas.length; k++) {
    const o = notas[k] * 4;
    px[4 * k] = PALETA[o]; px[4 * k + 1] = PALETA[o + 1]; px[4 * k + 2] = PALETA[o + 2]; px[4 * k + 3] = PALETA[o + 3];
    if (ancho > 0 && notas[k] === SIN_DATOS && ((k % ancho) + Math.floor(k / ancho)) % 2 === 1) px[4 * k + 3] = ALFA_TRAMA;
  }
  return px;
}

// Vista lejana (zoom menor que ZOOM_MIN_FINA): la mejor nota de los hábitats de la celda gruesa a su altitud media.
export function notaGruesa(celda, { salida, fecha, especies, filtro = null }) {
  const ag = agregadosDeCelda(salida, celda.id, fecha), altRef = altRefDe(salida, celda.id);
  let hay = false, mejor = null;
  for (const habitat of celda.habitats) {
    const r = notaCelda({ ag, habitat, altitud: celda.altRef, altRef, orientacion: 0, especies, fecha, filtro, explicar: false });
    if (r.sinEspecies) continue;
    hay = true;
    if (r.valor != null && (mejor == null || r.valor > mejor)) mejor = r.valor;
  }
  return !hay ? SIN_COLOR : mejor ?? SIN_DATOS;
}
export const colorDeNota = (v) => (v === SIN_COLOR ? null : v === SIN_DATOS ? NIVEL_COLOR['sin-datos'] : NIVEL_COLOR[nivelDe(v)]);

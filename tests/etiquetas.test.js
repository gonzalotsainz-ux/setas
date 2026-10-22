import test from 'node:test';
import assert from 'node:assert/strict';
import { elegirEtiquetas, textoEtiqueta, MINIMO_ETIQUETA } from '../js/rejilla/etiquetas.js';
import { notaParaEtiqueta } from '../js/mapa/capa-etiquetas.js';

test('elegirEtiquetas: máximos locales de 60 o más, de mayor a menor, separados y como mucho 3', () => {
  const ancho = 40, notas = new Uint8Array(40 * 40).fill(255);
  const poner = (col, fila, v) => { notas[fila * ancho + col] = v; };
  poner(5, 5, 90); poner(6, 5, 85); poner(30, 30, 70); poner(21, 5, 65); poner(8, 8, 95); poner(35, 2, 50);
  const e = elegirEtiquetas({ notas, ancho, max: 3, minimo: 60, separacion: 12 });
  assert.deepEqual(e.map((x) => [x.col, x.fila, x.valor]), [[8, 8, 95], [30, 30, 70], [21, 5, 65]]);   // 90 y 85 caen por cercanía al 95; 50 por mínimo
  assert.equal(e[0].k, 8 * ancho + 8);
});

test('elegirEtiquetas ignora SIN_COLOR y SIN_DATOS', () => {
  const ancho = 30, notas = new Uint8Array(30 * 30).fill(255);
  notas[2 * ancho + 2] = 254; notas[20 * ancho + 20] = 255; notas[10 * ancho + 10] = 61;
  const e = elegirEtiquetas({ notas, ancho });
  assert.deepEqual(e.map((x) => x.valor), [61]);
  assert.equal(elegirEtiquetas({ notas: new Uint8Array(900).fill(254), ancho }).length, 0);
});

test('elegirEtiquetas: una meseta de celdas iguales da una sola etiqueta y un máximo no gana a un vecino mayor', () => {
  const ancho = 10, notas = new Uint8Array(100).fill(255);
  for (const c of [3, 4, 5]) notas[4 * ancho + c] = 80;
  assert.deepEqual(elegirEtiquetas({ notas, ancho, separacion: 1 }).map((x) => x.col), [3]);   // aun sin separación: la meseta cuenta una vez
  notas[4 * ancho + 6] = 85;   // el 80 de la derecha tiene un vecino mayor: no es máximo local
  assert.deepEqual(elegirEtiquetas({ notas, ancho, separacion: 1 }).map((x) => x.col), [6, 3]);
});

test('textoEtiqueta: umbría, solana o altitud', () => {
  assert.equal(textoEtiqueta({ especie: 'Níscalos', valor: 84, orientacion: 1, altitud: 1450 }), 'Níscalos 84 · umbría');
  assert.equal(textoEtiqueta({ especie: 'Boletus', valor: 66, orientacion: 5, altitud: 1450 }), 'Boletus 66 · solana');
  assert.equal(textoEtiqueta({ especie: 'Rebozuelo', valor: 62, orientacion: 3, altitud: 1450 }), 'Rebozuelo 62 · 1450 m');
  assert.equal(textoEtiqueta({ especie: 'Rebozuelo', valor: 62, orientacion: 0, altitud: 1453 }), 'Rebozuelo 62 · 1450 m');
});

test('notaParaEtiqueta: la nota recalculada de la celda tiene que seguir siendo de 60 o más (no basta con que exista)', () => {
  const especie = { id: 'boletus-edulis' };
  assert.equal(MINIMO_ETIQUETA, 60);
  assert.equal(notaParaEtiqueta({ valor: 72, especie, sinEspecies: false }), true);
  assert.equal(notaParaEtiqueta({ valor: 60, especie, sinEspecies: false }), true);
  assert.equal(notaParaEtiqueta({ valor: 59, especie, sinEspecies: false }), false);
  assert.equal(notaParaEtiqueta({ valor: null, especie, sinEspecies: false }), false);
  assert.equal(notaParaEtiqueta({ valor: 80, especie: null, sinEspecies: false }), false);
  assert.equal(notaParaEtiqueta({ valor: 80, especie, sinEspecies: true }), false);
});

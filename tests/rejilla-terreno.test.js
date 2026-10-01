// tests/rejilla-terreno.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orientacionPendiente, tramoDe } from '../scripts/rejilla/terreno.mjs';
import { altitudTerrarium, teselasDeVentana, acumularTesela, nuevoAcumulador, mediasDe, ladoTesela, acumularPunto } from '../scripts/rejilla/mdt.mjs';
import { ORIENTACIONES } from '../js/rejilla/formato.js';

const plano = (ancho, alto, f) => Float32Array.from({ length: ancho * alto }, (_, k) => f(k % ancho, Math.floor(k / ancho)));
const centro = (r, ancho = 5) => ({ o: ORIENTACIONES[r.orientacion[2 * ancho + 2]], t: r.tramo[2 * ancho + 2] });

test('tramos de pendiente', () => assert.deepEqual([0, 4.9, 5, 14.9, 15, 29.9, 30, 80].map(tramoDe), [0, 0, 1, 1, 2, 2, 3, 3]));

test('orientación: la ladera mira hacia donde baja', () => {
  assert.deepEqual(centro(orientacionPendiente(plano(5, 5, (c, f) => 1000 + f * 25), 5, 5, 250)), { o: 'N', t: 1 });   // sube hacia el sur: umbría
  assert.deepEqual(centro(orientacionPendiente(plano(5, 5, (c, f) => 1000 - f * 25), 5, 5, 250)), { o: 'S', t: 1 });
  assert.deepEqual(centro(orientacionPendiente(plano(5, 5, (c) => 1000 + c * 50), 5, 5, 250)), { o: 'O', t: 2 });       // 20 %
  assert.deepEqual(centro(orientacionPendiente(plano(5, 5, (c, f) => 1000 + (c + f) * 40), 5, 5, 250)), { o: 'NO', t: 2 });
  assert.deepEqual(centro(orientacionPendiente(plano(5, 5, () => 1000), 5, 5, 250)), { o: 'llano', t: 0 });
});

test('orientación: una celda sin dato no rompe a sus vecinas', () => {
  const a = plano(5, 5, (c, f) => 1000 + f * 25);
  a[2 * 5 + 1] = NaN;
  const r = orientacionPendiente(a, 5, 5, 250);
  assert.equal(ORIENTACIONES[r.orientacion[2 * 5 + 2]], 'N');
  assert.equal(r.orientacion[2 * 5 + 1], 0);
});

test('Terrarium: decodificación y teselas de una ventana de una celda (Valsaín, z12)', () => {
  assert.equal(altitudTerrarium(131, 232, 0), 1000);
  assert.deepEqual(teselasDeVentana({ col0: 78371, fila0: 60187, ancho: 1, alto: 1 }, 12), [{ tx: 2002, ty: 1537 }]);
});

test('Terrarium: una tesela uniforme da su altitud a las celdas que cubre', () => {
  const l = ladoTesela(12), tx = 2002, ty = 1537;
  const ventana = { col0: Math.floor((tx * l) / 250), fila0: Math.floor((ty * l) / 250), ancho: 42, alto: 42 };   // la tesela cubre ~39 celdas por lado
  const acc = nuevoAcumulador(ventana.ancho * ventana.alto);
  const datos = new Uint8Array(256 * 256 * 3);
  for (let k = 0; k < 256 * 256; k++) { datos[3 * k] = 131; datos[3 * k + 1] = 232; }
  acumularTesela(acc, ventana, { z: 12, tx, ty, datos, canales: 3, lado: 256 });
  const m = mediasDe(acc), con = [...m].filter(Number.isFinite);
  assert.ok(con.length > 1400, `${con.length} celdas con muestras`);
  assert.ok(con.every((v) => v === 1000));
  assert.ok(m.some(Number.isNaN));   // las de fuera de la tesela, sin dato
});

test('el 0 exacto del WCS (fuera de España) es sin dato, solo si se pide', () => {
  const v = { col0: 0, fila0: 0, ancho: 1, alto: 1 };
  const x = -20037508.34 + 10, y = 20037508.34 - 10;
  const a = nuevoAcumulador(1); acumularPunto(a, v, x, y, 0, 250, { ceroSinDato: true });
  assert.ok(Number.isNaN(mediasDe(a)[0]));
  const b = nuevoAcumulador(1); acumularPunto(b, v, x, y, 0);
  assert.equal(mediasDe(b)[0], 0);
});

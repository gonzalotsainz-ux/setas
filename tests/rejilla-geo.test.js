// tests/rejilla-geo.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aMercator, aGrados, celdaFina, centroFina, ventanaBbox, idGruesa, centroGruesa, limitesGruesa, metrosSuelo, puntoEnGeometria, bboxDe, ORIGEN } from '../js/rejilla/geo.js';

const cerca = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`);

test('Mercator ida y vuelta', () => {
  const p = aMercator(-3.9943, 40.853);
  cerca(p.x, -444643.4420755727, 1e-6);
  cerca(p.y, 4990683.316688638, 1e-6);
  const g = aGrados(p.x, p.y);
  cerca(g.lon, -3.9943); cerca(g.lat, 40.853);
});

test('celdas finas de 250 m alineadas con el origen de las teselas', () => {
  assert.deepEqual(celdaFina(0, 0), { col: 80150, fila: 80150 });
  const p = aMercator(-3.9943, 40.853);
  assert.deepEqual(celdaFina(p.x, p.y), { col: 78371, fila: 60187 });
  const c = centroFina(78371, 60187);
  cerca(c.x, 78371.5 * 250 - ORIGEN, 1e-6);
  cerca(c.y, ORIGEN - 60187.5 * 250, 1e-6);
});

test('ventana del bbox de Guadarrama', () => {
  assert.deepEqual(ventanaBbox([-4.25, 40.65, -3.7701, 41.05]), { col0: 78257, fila0: 60071, ancho: 215, alto: 236 });
});

test('celdas gruesas en grados, ancladas en 10° O y 35° N', () => {
  assert.equal(idGruesa('guadarrama', -3.9943, 40.853, 0.09), 'guadarrama:66:65');
  const c = centroGruesa('guadarrama:66:65', 0.09);
  cerca(c.lon, -4.015); cerca(c.lat, 40.895);
  const [o, s, e, n] = limitesGruesa('guadarrama:66:65', 0.09);
  cerca(o, -4.06); cerca(s, 40.85); cerca(e, -3.97); cerca(n, 40.94);
});

test('un metro de Mercator mide cos(lat) metros reales', () => cerca(metrosSuelo(250, 60), 125, 1e-9));

test('punto en polígono con hueco y multipolígono; bbox', () => {
  const conHueco = { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]] };
  assert.equal(puntoEnGeometria(0.5, 0.5, conHueco), true);
  assert.equal(puntoEnGeometria(2, 2, conHueco), false);
  assert.equal(puntoEnGeometria(5, 5, conHueco), false);
  const multi = { type: 'MultiPolygon', coordinates: [conHueco.coordinates, [[[10, 10], [11, 10], [11, 11], [10, 10]]]] };
  assert.equal(puntoEnGeometria(10.8, 10.2, multi), true);
  assert.equal(puntoEnGeometria(0, 0, { type: 'Point', coordinates: [0, 0] }), false);
  assert.deepEqual(bboxDe(multi), [0, 0, 11, 11]);
});

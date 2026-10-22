import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contornoZona, ESTILO_CONTORNO } from '../js/mapa/contorno.js';
import { COLOR } from '../js/mapa.js';

test('contornoZona: n puntos dentro del bbox, toca sus cuatro lados y no es un rectángulo', () => {
  const b = [-4, 40, -3, 41];
  const c = contornoZona(b, 64);
  assert.equal(c.length, 64);
  for (const [lat, lon] of c) assert.ok(lat >= 40 && lat <= 41 && lon >= -4 && lon <= -3);
  assert.ok(Math.abs(Math.max(...c.map((p) => p[0])) - 41) < 1e-9);
  assert.ok(Math.abs(Math.min(...c.map((p) => p[1])) + 4) < 1e-9);
  const esquinas = c.filter(([lat, lon]) => (lat === 41 || lat === 40) && (lon === -4 || lon === -3));
  assert.equal(esquinas.length, 0);
});

test('ESTILO_CONTORNO: acento, trazo fino discontinuo y no interactivo', () => {
  assert.equal(ESTILO_CONTORNO.color, COLOR.acento);
  assert.equal(ESTILO_CONTORNO.weight, 1.5);
  assert.equal(ESTILO_CONTORNO.dashArray, '6 6');
  assert.equal(ESTILO_CONTORNO.fill, false);
  assert.equal(ESTILO_CONTORNO.interactive, false);
});

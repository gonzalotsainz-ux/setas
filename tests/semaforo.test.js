import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nivelDe } from '../js/ui/semaforo.js';
test('nivelDe: puntos de corte 0/20/40/60/80 y sin datos', () => {
  const casos = [[0, 'nulo'], [19, 'nulo'], [20, 'bajo'], [39, 'bajo'], [40, 'posible'], [59, 'posible'],
    [60, 'bueno'], [79, 'bueno'], [80, 'muy-bueno'], [100, 'muy-bueno'], [null, 'sin-datos'], [undefined, 'sin-datos'], [NaN, 'sin-datos']];
  for (const [v, n] of casos) assert.equal(nivelDe(v), n, String(v));
});

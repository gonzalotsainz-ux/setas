import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardia } from '../js/ui/carrera.js';

test('solo la última pintura pedida sigue vigente', () => {
  const g = guardia();
  const a = g.nueva(), b = g.nueva();
  assert.equal(g.vigente(a), false);
  assert.equal(g.vigente(b), true);
});

test('un render lento no pisa a uno posterior', async () => {
  const g = guardia(), pintado = [];
  const render = async (nombre, ms) => { const t = g.nueva(); await new Promise((r) => setTimeout(r, ms)); if (g.vigente(t)) pintado.push(nombre); };
  await Promise.all([render('lento', 30), render('rapido', 5)]);
  assert.deepEqual(pintado, ['rapido']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarUmbral, guardarUmbral } from '../js/umbrales.js';
test('umbrales válidos', () => assert.deepEqual(validarUmbral({ topt: 12, trango: [9, 15], pmin: 30, pfull: 90, desfase: [7, 21] }), []));
test('pfull ≤ pmin → error', () => assert.match(validarUmbral({ pmin: 90, pfull: 30 }).join(), /pleno/));
test('pfull = pmin → error', () => assert.match(validarUmbral({ pmin: 30, pfull: 30 }).join(), /pleno/));
test('rango invertido → error', () => assert.match(validarUmbral({ trango: [15, 9] }).join(), /rango/));
test('valores fuera de lo físico → error', () => assert.match(validarUmbral({ topt: 45 }).join(), /temperatura/));
test('desfase negativo o invertido → error', () => {
  assert.match(validarUmbral({ desfase: [-1, 5] }).join(), /desfase/);
  assert.match(validarUmbral({ desfase: [20, 7] }).join(), /desfase/);
  assert.deepEqual(validarUmbral({ desfase: [7, 7] }), []);
});
test('NaN o texto → error', () => {
  assert.ok(validarUmbral({ topt: NaN }).length);
  assert.ok(validarUmbral({ trango: [1, NaN] }).length);
});
test('guardarUmbral no toca la base con valores inválidos', async () => {
  const sb = { from: () => { throw new Error('no debería llamarse'); } };
  await assert.rejects(guardarUmbral(sb, 'x', { pmin: 90, pfull: 30 }), /pleno/);
});
test('guardarUmbral guarda el autor', async () => {
  let fila;
  const sb = { from: () => ({ upsert: async (f) => { fila = f; return { error: null }; } }) };
  await guardarUmbral(sb, 'x', { topt: 12 }, 'Ale');
  assert.equal(fila.autor, 'Ale');
  await guardarUmbral(sb, 'x', { topt: 12 });
  assert.equal(fila.autor, 'desconocido');
});

import { cargarUmbrales } from '../js/umbrales.js';
import { especiesDeZona } from '../js/datos.js';
import { calcularIndice } from '../js/indice.js';
import { serieSintetica, BOLETUS, lluviaBuena } from './ayudas.js';
const zona = { id: 'soria', habitats: ['pinar-silvestre'] };
const esp = { ...BOLETUS, categoria: 'comestible', habitats: ['pinar-silvestre'], zonas: { soria: { presencia: 'confirmada' } } };
test('valores extremos aceptados dan un índice finito', () => {
  const p = { topt: 13, trango: [0, 1e-9], pmin: 30, pfull: 30 + 1e-9, desfase: [7, 21] };
  assert.deepEqual(validarUmbral(p), []);
  const [m] = especiesDeZona(zona, [esp], { 'boletus-edulis': p });
  const r = calcularIndice(serieSintetica({ precip: lluviaBuena }), 59, m);
  assert.ok(Number.isFinite(r.valor));
});
test('una fila parcial inválida se ignora (pfull < pmin de la original)', () => {
  const orig = console.warn; console.warn = () => {};
  try {
    const [m] = especiesDeZona(zona, [esp], { 'boletus-edulis': { pfull: 10 } });
    assert.deepEqual(m.indice, esp.indice);
    const [n] = especiesDeZona(zona, [esp], { 'boletus-edulis': { topt: NaN } });
    assert.deepEqual(n.indice, esp.indice);
  } finally { console.warn = orig; }
});
test('cargarUmbrales devuelve {} ante error', async () => {
  const sb = { from: () => ({ select: async () => ({ data: null, error: new Error('x') }) }) };
  assert.deepEqual(await cargarUmbrales(sb), {});
  assert.deepEqual(await cargarUmbrales({ from: () => { throw new Error('caído'); } }), {});
});

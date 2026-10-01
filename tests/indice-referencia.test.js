import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { casosIndice, resultadoCaso } from './casos-indice.js';

const referencia = JSON.parse(readFileSync(new URL('./fixtures/indice-referencia.json', import.meta.url), 'utf8'));

test('las notas, factores, datos y frases del índice no cambian (referencia fijada antes de dividirlo)', () => {
  const casos = casosIndice();
  assert.equal(casos.length, Object.keys(referencia).length);
  for (const c of casos) assert.deepStrictEqual(resultadoCaso(c), referencia[c.clave], c.clave);
});

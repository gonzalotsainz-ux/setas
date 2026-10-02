// tests/pluvio-ajustes.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estadoFuentesLluvia, FUENTES_LLUVIA } from '../js/pluvio.js';

test('estado de las fuentes: último día con dato y aviso si pasan más de 2 días', () => {
  const l = estadoFuentesLluvia({ fuentes: { duero: '2026-10-01', tajo: '2026-09-28' } }, '2026-10-02');
  assert.deepEqual(l.map((f) => [f.fuente, f.ultima, f.aviso]), [
    ['tajo', '2026-09-28', true], ['duero', '2026-10-01', false], ['jucar', null, true], ['euskalmet', null, false], ['aemet', null, true]]);
  assert.equal(l[0].nombre, FUENTES_LLUVIA.tajo.nombre);
  assert.match(l[3].licencia, /CC BY 4\.0/);
  assert.deepEqual(estadoFuentesLluvia(null, '2026-10-02'), []);
});

test('Ajustes da crédito a cada fuente de lluvia con su licencia y enseña su estado', () => {
  const src = readFileSync('js/pantallas/ajustes.js', 'utf8');
  assert.match(src, /estadoFuentesLluvia\(estado\.pluvio, hoyMadrid\(\)\)/);
  assert.match(src, /Lluvia medida en pluviómetros/);
});

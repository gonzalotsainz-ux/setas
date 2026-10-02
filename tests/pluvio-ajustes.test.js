// tests/pluvio-ajustes.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estadoFuentesLluvia, fuentesLluviaSinEstado, FUENTES_LLUVIA, LICENCIAS } from '../js/pluvio.js';

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

test('los créditos de las fuentes salen siempre; sin archivo, solo falta el estado de las lecturas', () => {
  const l = fuentesLluviaSinEstado();
  assert.deepEqual(l.map((f) => f.fuente), ['tajo', 'duero', 'jucar', 'euskalmet', 'aemet']);
  assert.ok(l.every((f) => f.licencia && f.url && f.ultima === null && !f.aviso));
  const src = readFileSync('js/pantallas/ajustes.js', 'utf8');
  assert.match(src, /Estado de las lecturas: no disponible ahora/);
  assert.match(src, /fuentesLluviaSinEstado\(\)/);
  assert.doesNotMatch(src, /if \(!filas\.length\) return null/);
});

test('licencia de los SAIH: reutilización con cita, sin citar una ley no verificada', () => {
  for (const k of ['tajo', 'duero', 'jucar']) {
    const txt = LICENCIAS[FUENTES_LLUVIA[k].licencia];
    assert.match(txt, /reutilización con cita de la fuente/);
    assert.doesNotMatch(txt, /Ley|\d+\/\d{4}/);
  }
});

test('Euskalmet: un día 1 (hora que termina a medianoche UTC) se enseña como el último día del mes anterior', () => {
  const [e] = estadoFuentesLluvia({ fuentes: { euskalmet: '2026-09-01' } }, '2026-10-02').filter((f) => f.fuente === 'euskalmet');
  assert.equal(e.ultima, '2026-08-31');
  assert.equal(e.aviso, false);
  const [g] = estadoFuentesLluvia({ fuentes: { euskalmet: '2026-08-31', tajo: '2026-10-01' } }, '2026-10-02').filter((f) => f.fuente === 'euskalmet');
  assert.equal(g.ultima, '2026-08-31');
});

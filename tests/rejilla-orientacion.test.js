// tests/rejilla-orientacion.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AJUSTE_ORIENTACION, FUENTES_ORIENTACION, ajusteHumedad, esOrientativo } from '../js/rejilla/orientacion.js';
import { ORIENTACIONES } from '../js/rejilla/formato.js';

test('ajuste por orientación: una entrada por rumbo, llano neutro', () => {
  assert.deepEqual(Object.keys(AJUSTE_ORIENTACION).sort(), [...ORIENTACIONES].sort());
  assert.equal(AJUSTE_ORIENTACION.llano, 1);
  assert.equal(ajusteHumedad(0), 1);
  assert.equal(ajusteHumedad(99), 1);
  assert.equal(esOrientativo(0), false);
});

test('ajuste por orientación: conservador (entre 0,85 y 1,15) y, si no es neutro, con fuente citada', () => {
  for (const [k, v] of Object.entries(AJUSTE_ORIENTACION)) assert.ok(v >= 0.85 && v <= 1.15, `${k}: ${v}`);
  if (Object.values(AJUSTE_ORIENTACION).some((v) => v !== 1)) {
    assert.ok(FUENTES_ORIENTACION.length > 0, 'hay valores distintos de 1 sin fuente');
    for (const f of FUENTES_ORIENTACION) {
      assert.match(f.url, /^https?:\/\//);
      assert.match(f.consultado, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(f.titulo && f.que);
    }
  }
});

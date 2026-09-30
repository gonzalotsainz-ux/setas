import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularIndice } from '../js/indice.js';
import { filasDesglose } from '../js/ui/desglose.js';
import { serieSintetica, lluviaBuena, BOLETUS, NISCALO, MORCHELLA } from './ayudas.js';

test('el desglose recompone exactamente la nota (con y sin suelo)', () => {
  const con = serieSintetica({ dias: 60, hoy: 59, precip: lluviaBuena });
  const sin = serieSintetica({ dias: 60, hoy: 59, precip: lluviaBuena, pct: () => null });
  for (const s of [con, sin]) for (const sp of [BOLETUS, NISCALO]) {
    const r = calcularIndice(s, 59, sp), d = filasDesglose(r);
    assert.equal(d.calculado, r.valor, sp.id);
    assert.equal(d.filas.length, 7);
    assert.ok(d.filas.every((f) => f.frase && f.frase.length > 3), 'cada factor lleva su frase');
  }
  assert.equal(filasDesglose(calcularIndice(sin, 59, BOLETUS)).sinSuelo, true);
});

test('fuera de temporada: sin factores, solo la explicación', () => {
  const r = calcularIndice(serieSintetica({ dias: 60, hoy: 59, precip: lluviaBuena }), 59, MORCHELLA);
  const d = filasDesglose(r);
  assert.equal(d.fueraDeTemporada, true);
  assert.equal(d.filas.length, 0);
});

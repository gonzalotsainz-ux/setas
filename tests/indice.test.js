import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularIndice, indiceZona, etiqueta, pesoPrevision, DatosIncompletos } from '../js/indice.js';
import { serieSintetica, BOLETUS, NISCALO, MORCHELLA, lluviaBuena } from './ayudas.js';

test('otoño húmedo y templado → muy bueno para boletus', () => {
  const r = calcularIndice(serieSintetica({ precip: lluviaBuena }), 59, BOLETUS);
  assert.equal(r.datos.P26, 106);
  assert.equal(r.factores.fW, 1);
  assert.equal(r.factores.fR, 1);
  assert.equal(r.factores.fT, 1);
  assert.equal(r.valor, 96);                 // 100 · 0,8^0,2 = 95,6
  assert.equal(r.etiqueta, 'muy bueno');
  assert.equal(r.confianza, 'alta');
});

test('sequía → nulo', () => {
  const r = calcularIndice(serieSintetica({ precip: () => 0 }), 59, BOLETUS);
  assert.equal(r.valor, 0);
  assert.equal(r.etiqueta, 'nulo');
});

test('helada de −4 °C corta el boletus pero no tanto el níscalo', () => {
  const s = serieSintetica({ precip: lluviaBuena, tmin: (k) => (k === 57 ? -4 : 6) });
  const b = calcularIndice(s, 59, BOLETUS), n = calcularIndice(s, 59, NISCALO);
  assert.ok(b.valor < 20, `boletus ${b.valor}`);
  assert.ok(n.valor > b.valor, `níscalo ${n.valor} > boletus ${b.valor}`);
  assert.ok(b.explicacion.some((t) => /helada/i.test(t)));
});

test('sin 50 mm desde el 1 de agosto → ×0,3', () => {
  const precip = (k) => (k >= 40 && k <= 42 ? 15 : 0);  // 45 mm en la serie
  const sin = calcularIndice(serieSintetica({ precip, lluviaAntes: { mm: 0 } }), 59, BOLETUS);
  const con = calcularIndice(serieSintetica({ precip, lluviaAntes: { mm: 30 } }), 59, BOLETUS);
  assert.equal(sin.factores.fA, 0.3);
  assert.equal(con.factores.fA, 1);
  assert.ok(Math.abs(sin.valor - Math.round(con.valor * 0.3)) <= 1);
});

test('fuera de temporada → 0 aunque llueva', () => {
  const r = calcularIndice(serieSintetica({ inicio: '2026-05-20', precip: lluviaBuena, lluviaAntes: null }), 59, BOLETUS);
  assert.equal(r.factores.fC, 0);
  assert.equal(r.valor, 0);
});

test('mes contiguo a la temporada → ×0,5, con salto de año', () => {
  const dic = { ...NISCALO, temporada: { meses: [11, 12], tipo: 'otono' } };
  const r = calcularIndice(serieSintetica({ inicio: '2026-11-15', precip: lluviaBuena }), 59, dic); // i = 13-ene-2027
  assert.equal(r.factores.fC, 0.5);
});

test('dato de lluvia nulo en la ventana → DatosIncompletos', () => {
  const s = serieSintetica({ precip: (k) => (k === 50 ? null : 2) });
  assert.throws(() => calcularIndice(s, 59, BOLETUS), DatosIncompletos);
});

test('historia insuficiente → DatosIncompletos', () => {
  assert.throws(() => calcularIndice(serieSintetica(), 10, BOLETUS), DatosIncompletos);
});

test('sin climatología de suelo → se calcula sin fS y se explica', () => {
  const r = calcularIndice(serieSintetica({ precip: lluviaBuena, pct: () => null }), 59, BOLETUS);
  assert.equal(r.factores.fS, null);
  assert.equal(r.valor, 100);
  assert.ok(r.explicacion.some((t) => /humedad del suelo/i.test(t)));
});

test('lluvia prevista se pondera según el horizonte', () => {
  assert.deepEqual([0, 1, 3, 4, 7, 8, 9].map(pesoPrevision), [1, 0.8, 0.8, 0.6, 0.6, 0.4, 0.4]);
  const s = serieSintetica({ hoy: 49, precip: (k) => (k === 55 ? 10 : 0) }); // día +6 → ×0,6
  const r = calcularIndice(s, 59, BOLETUS);
  assert.equal(r.datos.P26, 6);
  assert.equal(r.prevision, true);
});

test('Morchella usa la temperatura del suelo', () => {
  const s = serieSintetica({ inicio: '2026-02-15', precip: lluviaBuena, tmedia: () => 5, tsuelo: () => 12, lluviaAntes: null });
  const r = calcularIndice(s, 59, MORCHELLA);  // i = 15-abr
  assert.equal(r.factores.fT, 1);
  assert.equal(r.datos.T20, 12);
});

test('etiquetas en los cortes', () => {
  assert.deepEqual([0, 19, 20, 40, 60, 80, 100].map(etiqueta), ['nulo', 'nulo', 'bajo', 'posible', 'bueno', 'muy bueno', 'muy bueno']);
});

test('indiceZona: un punto con nulos no tumba la zona', () => {
  const bueno = serieSintetica({ precip: lluviaBuena });
  const roto = serieSintetica({ precip: (k) => (k === 58 ? null : 2) });
  const z = indiceZona({ a: roto, b: bueno }, 59, [BOLETUS, NISCALO]);
  assert.equal(z.sinDatos, false);
  assert.equal(z.especies[0].id, 'boletus-edulis');
  assert.equal(z.especies[0].punto, 'b');
  assert.equal(z.valor, z.especies[0].valor);
});

test('indiceZona: todo nulo → sinDatos y valor null', () => {
  const roto = serieSintetica({ precip: () => null });
  const z = indiceZona({ a: roto }, 59, [BOLETUS]);
  assert.equal(z.sinDatos, true);
  assert.equal(z.valor, null);
});

test('indiceZona: rango entre puntos', () => {
  const alto = serieSintetica({ precip: lluviaBuena });
  const bajo = serieSintetica({ precip: (k) => (k >= 40 && k <= 42 ? 12 : 1) });
  const z = indiceZona({ alto, bajo }, 59, [BOLETUS]);
  assert.ok(z.especies[0].min < z.especies[0].max);
  assert.equal(z.especies[0].max, z.especies[0].valor);
});

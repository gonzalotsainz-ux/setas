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

test('nulos al final de previsión (día 69) → sinDatos solo en ese día, no antes', () => {
  const s = serieSintetica({ dias: 70, hoy: 59, precip: (k) => (k === 69 ? null : 2) });
  const z68 = indiceZona({ a: s }, 68, [BOLETUS]);
  const z69 = indiceZona({ a: s }, 69, [BOLETUS]);
  assert.equal(z68.sinDatos, false);
  assert.ok(typeof z68.valor === 'number');
  assert.equal(z69.sinDatos, true);
  assert.equal(z69.valor, null);
});

import { agregadosDia, indiceDesdeAgregados } from '../js/indice.js';
import { readFileSync } from 'node:fs';
import { casosIndice } from './casos-indice.js';

test('agregadosDia: lo que no depende de la especie, con números exactos', () => {
  const ag = agregadosDia(serieSintetica({ precip: lluviaBuena }), 59);
  assert.equal(ag.fecha, '2026-10-18');
  assert.equal(ag.prevision, false);
  assert.equal(ag.P26, 106);
  assert.equal(ag.P3, 60);
  assert.equal(ag.lag, 17);
  assert.equal(ag.pct, 60);
  assert.equal(ag.Pagosto, 194);            // 20 mm antes de la serie + 57 × 2 + 3 × 20
  assert.equal(ag.secante, false);
  assert.equal(ag.T20aire, 13);
  assert.equal(ag.T20suelo, 13);
  assert.deepEqual(ag.tmin7, [6, 6, 6, 6, 6, 6, 6]);
});

test('agregadosDia: un hueco deja null en lo que lo usa, sin lanzar', () => {
  const ag = agregadosDia(serieSintetica({ precip: lluviaBuena, tsuelo: (k) => (k === 50 ? null : 13), tmin: (k) => (k === 58 ? null : 6) }), 59);
  assert.equal(ag.T20suelo, null);
  assert.equal(ag.T20aire, 13);
  assert.equal(ag.tmin7[5], null);
  assert.throws(() => agregadosDia(serieSintetica(), 10), DatosIncompletos);
});

test('los dos pasos (agregadosDia + indiceDesdeAgregados) dan la nota de la referencia fijada con el código anterior', () => {
  const referencia = JSON.parse(readFileSync(new URL('./fixtures/indice-referencia.json', import.meta.url), 'utf8'));
  let comparados = 0;
  for (const c of casosIndice()) {
    const esperado = referencia[c.clave];
    if (esperado.error) { assert.throws(() => indiceDesdeAgregados(agregadosDia(c.serie, c.i), c.especie), DatosIncompletos, c.clave); continue; }
    assert.deepStrictEqual(JSON.parse(JSON.stringify(indiceDesdeAgregados(agregadosDia(c.serie, c.i), c.especie))), esperado, c.clave);
    comparados++;
  }
  assert.equal(comparados, 258); // casos sin error de la referencia (450 en total; el resto lanza DatosIncompletos)
});

test('indiceDesdeAgregados: explicar=false da la misma nota sin frases', () => {
  const ag = agregadosDia(serieSintetica({ precip: lluviaBuena }), 59);
  const r = indiceDesdeAgregados(ag, BOLETUS, { explicar: false });
  assert.equal(r.valor, 96);
  assert.deepEqual(r.explicacion, []);
});

test('indiceDesdeAgregados: el ajuste de humedad multiplica la lluvia de 26 días, con fW acotado a ±15 %', () => {
  const ag = agregadosDia(serieSintetica({ precip: () => 2 }), 59);   // P26 = 52; BOLETUS: pmin 30, pfull 90
  const fW = (a, x = ag, sp = BOLETUS) => indiceDesdeAgregados(x, sp, { ajusteHumedad: a }).factores.fW;
  assert.ok(Math.abs(fW(1) - 22 / 60) < 1e-12);
  assert.ok(Math.abs(fW(1.15) - (22 / 60) * 1.15) < 1e-12);   // lluvia efectiva 59,8 mm daría 29,8 / 60: tope +15 %
  assert.ok(Math.abs(fW(0.85) - (22 / 60) * 0.85) < 1e-12);   // 44,2 mm daría 14,2 / 60: tope −15 %
  assert.ok(Math.abs(fW(1.05) - (52 * 1.05 - 30) / 60) < 1e-12);   // dentro del tope manda la lluvia efectiva
  // La umbría llega antes a fW = 1: con 85 mm, 97,75 mm efectivos y 55 / 60 × 1,15 ≥ 1; sin ajuste, 55 / 60.
  const casiLleno = { ...ag, P26: 85 };
  assert.equal(fW(1.15, casiLleno), 1);
  assert.ok(fW(1, casiLleno) < 1);
  // Con lluvia abundante N y S dan fW = 1; con lluvia 0, 0 en cualquier ladera.
  const humedo = agregadosDia(serieSintetica({ precip: lluviaBuena }), 59);
  assert.equal(fW(1.15, humedo), 1);
  assert.equal(fW(0.85, humedo), 1);
  for (const a of [0.85, 1, 1.15]) assert.equal(fW(a, { ...ag, P26: 0 }), 0);
});

test('indiceDesdeAgregados: cerca del mínimo de lluvia la orientación mueve la nota como mucho un 5,5 %', () => {
  const ag = agregadosDia(serieSintetica({ precip: () => 2 }), 59);
  const conLluvia = (sp, pmin, pfull) => ({ ...sp, indice: { ...sp.indice, pmin, pfull } });   // tolerancia: ±5,5 % más 1 punto por los dos redondeos
  const casos = [[conLluvia(BOLETUS, 40, 100), 47], [conLluvia(BOLETUS, 25, 60), 26], [conLluvia(BOLETUS, 25, 60), 25]];   // níscalo y parasol
  for (const [sp, P26] of casos) {
    const x = { ...ag, P26 }, nota = (a) => indiceDesdeAgregados(x, sp, { ajusteHumedad: a }).valor;
    const v0 = nota(1);
    for (const a of [0.85, 1.15]) assert.ok(Math.abs(nota(a) - v0) <= 0.055 * v0 + 1, `${sp.indice.pmin}/${P26} mm, ${a}: ${nota(a)} frente a ${v0}`);
  }
});

test('indiceDesdeAgregados: sin temperatura del suelo falla Morchella pero no el boletus', () => {
  const ag = { ...agregadosDia(serieSintetica({ inicio: '2026-02-15', precip: lluviaBuena, lluviaAntes: null }), 59), T20suelo: null };
  assert.throws(() => indiceDesdeAgregados(ag, MORCHELLA), DatosIncompletos);
  assert.doesNotThrow(() => indiceDesdeAgregados({ ...agregadosDia(serieSintetica({ precip: lluviaBuena }), 59), T20suelo: null }, BOLETUS));
});

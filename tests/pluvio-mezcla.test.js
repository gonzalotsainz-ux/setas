// tests/pluvio-mezcla.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pesoEstacion, cercanas, mezclarDia, seriesMedidas, paresSesgo, factorSesgo, aplicarMedida, validarPluvio, VERSION_PLUVIO, validosDe, distanciaKm, MEZCLA } from '../supabase/functions/_shared/pluvio.js';
import { calcularIndice } from '../supabase/functions/_shared/indice.js';
import { serieSintetica, BOLETUS, lluviaBuena } from './ayudas.js';

const est = (codigo, lat, altitud = 1200) => ({ fuente: 'tajo', codigo, nombre: codigo, lat, lon: -4, altitud });
const LUGAR = { id: 'p', lat: 40, lon: -4, altitud: 1200 };
const mapa = (o) => new Map(Object.entries(o));

test('peso: inverso del cuadrado de la distancia (desde 1 km) y menor con el desnivel; 0 fuera de 20 km o de 600 m', () => {
  assert.equal(pesoEstacion(2, 0), 0.25);
  assert.equal(pesoEstacion(4, 300), 0.03125);
  assert.equal(pesoEstacion(0.3, 0), 1);
  assert.equal(pesoEstacion(21, 0), 0);
  assert.equal(pesoEstacion(5, 601), 0);
  assert.equal(pesoEstacion(5, -601), 0);
});

test('cercanas: por distancia, con su clave y su km; fuera las lejanas y las de mucho desnivel', () => {
  const l = cercanas(LUGAR, [est('B', 40.1, 1500), est('A', 40.018), est('C', 40.3), est('D', 40.01, 1900)]);
  assert.deepEqual(l.map((c) => [c.clave, c.km]), [['tajo:A', 2], ['tajo:B', 11.1]]);
  assert.ok(Math.abs(l[0].peso - 1 / (0.018 * 111.195) ** 2) < 1e-3);
});

test('mezclarDia: media ponderada de las que tienen dato ese día', () => {
  const cerca = [{ clave: 'a', peso: 0.25 }, { clave: 'b', peso: 0.03125 }];
  assert.deepEqual(mezclarDia(cerca, mapa({ a: 10, b: 20 })), { mm: 11.1, n: 2 });
  assert.deepEqual(mezclarDia(cerca, mapa({ b: 20 })), { mm: 20, n: 1 });
  assert.equal(mezclarDia(cerca, new Map()), null);
});

test('seriesMedidas: un valor por día con las estaciones que lo dan; sin estación en radio, el lugar no sale', () => {
  const estaciones = [est('S1', 40.018), est('S2', 39.982), est('R', 40.51)];
  const validos = new Map([['tajo:S1', mapa({ '2026-09-28': 4, '2026-09-29': 0 })], ['tajo:S2', mapa({ '2026-09-28': 10, '2026-09-30': 6 })]]);
  const lugares = [LUGAR, { id: 'lejos', lat: 41.5, lon: -4, altitud: 1200 }, { id: 'roto', lat: 40.5, lon: -4, altitud: 1200 }];
  const r = seriesMedidas(lugares, estaciones, validos, '2026-09-28', '2026-09-30');
  assert.deepEqual(r.p, { mm: [7, 0, 6], n: [2, 1, 1], estaciones: [{ nombre: 'S1', fuente: 'tajo', km: 2 }, { nombre: 'S2', fuente: 'tajo', km: 2 }], cercanas: 2 });
  assert.equal(r.lejos, undefined);
  // Review Focus 5: con estación cerca pero sin ningún día válido sale, sin estaciones que aporten.
  assert.deepEqual(r.roto, { mm: [null, null, null], n: [0, 0, 0], estaciones: [], cercanas: 1 });
});

test('sesgo: cociente de 30 días acotado entre 0,5 y 2; con pocos datos, 1', () => {
  const pares = (n, medida, modelo) => Array.from({ length: n }, () => ({ medida, modelo }));
  assert.equal(factorSesgo(pares(10, 3, 2)), 1.5);
  assert.equal(factorSesgo(pares(9, 3, 2)), 1);       // menos de 10 días
  assert.equal(factorSesgo(pares(10, 1, 0.9)), 1);    // el modelo casi seco: 9 mm, no se corrige
  assert.equal(factorSesgo(pares(10, 10, 2)), 2);
  assert.equal(factorSesgo(pares(10, 0.1, 2)), 0.5);
  assert.equal(factorSesgo([]), 1);
});

// Serie de 60 días del 03/08 al 01/10 (hoy = 01/10) y medida del 01/08 al 30/09 (61 días).
const DESDE = '2026-08-01', HASTA = '2026-09-30';
const medidaCon = (valores) => { const mm = Array(61).fill(null); for (const [k, v] of Object.entries(valores)) mm[k] = v; return { mm, n: mm.map((v) => (v == null ? 0 : 1)), estaciones: [], cercanas: 1 }; };

test('paresSesgo: solo los últimos 30 días hasta «hasta» con medida y modelo', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: () => 2 });
  const m = medidaCon(Object.fromEntries(Array.from({ length: 12 }, (_, k) => [60 - k, 1])));   // del 19/09 al 30/09
  const p = paresSesgo(s, m, DESDE, HASTA);
  assert.equal(p.length, 12);
  assert.deepEqual(p[0], { medida: 1, modelo: 2 });
  assert.equal(paresSesgo(s, medidaCon({ 2: 5 }), DESDE, HASTA).length, 0);   // el 03/08 queda fuera de los 30 días
});

test('aplicarMedida: medido donde lo hay, el modelo corregido en el resto del tramo, hoy y la previsión intactos', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: () => 2 });
  const r = aplicarMedida(s, medidaCon({ 59: 0, 60: 5 }), { desde: DESDE, hasta: HASTA, factor: 1.5 });
  assert.equal(r.fechas[57], '2026-09-29');
  assert.deepEqual([r.precip[57], r.origenPrecip[57]], [0, 'medida']);
  assert.deepEqual([r.precip[58], r.origenPrecip[58]], [5, 'medida']);
  assert.deepEqual([r.precip[0], r.origenPrecip[0]], [3, 'estimada']);
  assert.deepEqual([r.precip[59], r.origenPrecip[59]], [2, 'modelo']);   // hoy
  assert.equal(s.precip[57], 2, 'no se toca la serie de entrada');
});

test('aplicarMedida: sin medida y sin corrección devuelve la misma serie; la lluvia antes de la serie, medida si está entera', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: () => 2 });
  assert.equal(aplicarMedida(s, null, { desde: DESDE, hasta: HASTA }), s);
  const r = aplicarMedida(s, medidaCon({ 0: 1, 1: 2 }), { desde: DESDE, hasta: HASTA });
  assert.deepEqual(r.lluviaAntesDeSerie, { desde: '2026-08-01', mm: 3, origen: 'medida' });
  assert.equal(aplicarMedida(s, medidaCon({ 0: 1 }), { desde: DESDE, hasta: HASTA }), s, 'falta el 02/08: no se sustituye y nada cambia');
});

test('validarPluvio: versión, fechas y lugares bien formados', () => {
  const bueno = { version: VERSION_PLUVIO, generado: '2026-10-02T04:10:00.000Z', desde: '2026-09-29', hasta: '2026-09-30',
    lugares: { p: { mm: [1.2, null], n: [1, 0], estaciones: [{ nombre: 'S1', fuente: 'tajo', km: 2 }], cercanas: 1 } }, aemet: { '3104Y': { '2026-09-29': 0.4 } } };
  assert.deepEqual(validarPluvio(bueno), []);
  assert.deepEqual(validarPluvio({ ...bueno, version: 2 }), ['versión desconocida']);
  assert.deepEqual(validarPluvio({ ...bueno, lugares: { p: { ...bueno.lugares.p, mm: [1] } } }), ['lugar p mal formado']);
  assert.deepEqual(validarPluvio({ ...bueno, lugares: { p: { ...bueno.lugares.p, mm: [-1, 0] } } }), ['lugar p mal formado']);
  assert.deepEqual(validarPluvio({ ...bueno, aemet: { x: { ayer: 1 } } }), ['aemet mal formado']);
  assert.deepEqual(validarPluvio(null), ['versión desconocida', 'desde/hasta mal formados', 'sin lugares']);
});

test('el módulo compartido no usa el DOM (Deno no tiene document)', () => {
  for (const n of ['pluvio', 'pluvio-fuentes']) assert.doesNotMatch(readFileSync(`supabase/functions/_shared/${n}.js`, 'utf8'), /\bdocument\.|\bwindow\./, n);
});

// Carry de la tarea 7: la misma estación publicada por dos fuentes (C010/C076, 9178X/C00A, 8210Y/5N03, 3319D/PN34, a
// menos de 1,3 km) cuenta como un solo sitio: media del grupo con el peso medio de las que dan dato ese día.
test('duplicadas entre fuentes (< 1,5 km): un solo sitio en la mezcla, no pesan doble', () => {
  const dup = { fuente: 'aemet', codigo: 'D', nombre: 'D', lat: 40.0225, lon: -4, altitud: 1200 };   // a 0,5 km de S1
  const estaciones = [est('S1', 40.018), dup, est('S2', 39.982)];
  const l = cercanas(LUGAR, estaciones);
  assert.deepEqual(l.map((c) => [c.clave, c.grupo]), [['tajo:S1', 'tajo:S1'], ['tajo:S2', 'tajo:S2'], ['aemet:D', 'tajo:S1']]);
  // S1 = 10 (peso 0,25), D = 20 (peso 0,16) → sitio 15 con peso 0,205; S2 = 0 (peso 0,25) → 3,075 / 0,455 = 6,8 (sin agrupar, 8,6).
  assert.deepEqual(mezclarDia(l, mapa({ 'tajo:S1': 10, 'aemet:D': 20, 'tajo:S2': 0 })), { mm: 6.8, n: 2 });
  assert.deepEqual(mezclarDia(l, mapa({ 'aemet:D': 20, 'tajo:S2': 0 })), { mm: 7.8, n: 2 });   // 0,16·20 / 0,41
  assert.deepEqual(mezclarDia(l, mapa({ 'tajo:S1': 10, 'aemet:D': 20 })), { mm: 15, n: 1 });
  const validos = new Map([['tajo:S1', mapa({ '2026-09-28': 10 })], ['aemet:D', mapa({ '2026-09-28': 20 })], ['tajo:S2', mapa({ '2026-09-28': 0 })]]);
  const r = seriesMedidas([LUGAR], estaciones, validos, '2026-09-28', '2026-09-28');
  assert.deepEqual([r.p.mm, r.p.n, r.p.estaciones.map((e) => e.nombre), r.p.cercanas], [[6.8], [2], ['S1', 'S2', 'D'], 3]);
});

test('validosDe: solo los días con calidad «ok» y mm válido entran en la mezcla', () => {
  const v = validosDe([
    { fuente: 'tajo', estacion: 'S1', fecha: '2026-09-28', mm: 4, calidad: 'ok' },
    { fuente: 'tajo', estacion: 'S1', fecha: '2026-09-29', mm: 144.8, calidad: 'sospechoso' },
    { fuente: 'tajo', estacion: 'S1', fecha: '2026-09-30', mm: 3, calidad: 'incompleto' },
    { fuente: 'aemet', estacion: '3104Y', fecha: '2026-09-28', mm: 0, calidad: 'ok' },
    { fuente: 'aemet', estacion: '3104Y', fecha: '2026-09-29', mm: null, calidad: 'ok' },
    { fuente: 'aemet', estacion: 'X', fecha: '2026-09-29', mm: 2, calidad: 'sin-dato' },
  ]);
  assert.deepEqual([...v].map(([k, m]) => [k, Object.fromEntries(m)]), [['tajo:S1', { '2026-09-28': 4 }], ['aemet:3104Y', { '2026-09-28': 0 }]]);
});

test('equivalencia: sin días válidos y sin corrección, la serie y la nota son las de hoy', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena });
  const sinDias = seriesMedidas([LUGAR], [est('S1', 40.018)], new Map(), DESDE, HASTA).p;
  assert.equal(sinDias.mm.every((v) => v === null), true);
  const factor = factorSesgo(paresSesgo(s, sinDias, DESDE, HASTA));
  assert.equal(factor, 1);
  const r = aplicarMedida(s, sinDias, { desde: DESDE, hasta: HASTA, factor });
  assert.equal(r, s);
  assert.deepEqual(calcularIndice(r, r.hoy, BOLETUS), calcularIndice(s, s.hoy, BOLETUS));
  assert.equal(aplicarMedida(s, null, { desde: DESDE, hasta: HASTA, factor: 1 }), s);
});

test('lista blanca real: las únicas estaciones a menos de 1,5 km entre sí son las cuatro parejas duplicadas', () => {
  const j = JSON.parse(readFileSync('supabase/functions/pluvio/estaciones.json', 'utf8'));
  const l = Array.isArray(j) ? j : j.estaciones;
  const pares = [];
  for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) {
    if (distanciaKm(l[a], l[b]) < MEZCLA.duplicadaKm) pares.push([l[a].codigo, l[b].codigo].sort().join('/'));
  }
  assert.deepEqual(pares.sort(), ['3319D/PN34', '5N03/8210Y', '9178X/C00A', 'C010/C076']);
});

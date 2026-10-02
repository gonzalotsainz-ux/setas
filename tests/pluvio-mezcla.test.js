// tests/pluvio-mezcla.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pesoEstacion, cercanas, mezclarDia, seriesMedidas, paresSesgo, factorSesgo, aplicarMedida, validarPluvio, VERSION_PLUVIO, validosDe, distanciaKm, MEZCLA, estacionesDesde } from '../supabase/functions/_shared/pluvio.js';
import { calcularIndice } from '../supabase/functions/_shared/indice.js';
import { serieSintetica, BOLETUS, lluviaBuena } from './ayudas.js';
import { sumarDias } from '../supabase/functions/_shared/meteo.js';

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
  assert.deepEqual(r.p, { mm: [7, 0, 6], n: [2, 1, 1], estaciones: [{ nombre: 'S1', fuente: 'tajo', km: 2, ultimo: '2026-09-29' }, { nombre: 'S2', fuente: 'tajo', km: 2, ultimo: '2026-09-30' }], cercanas: 2 });
  assert.equal(r.lejos, undefined);
  // Review Focus 5: con estación cerca pero sin ningún día válido sale, sin estaciones que aporten.
  assert.deepEqual(r.roto, { mm: [null, null, null], n: [0, 0, 0], estaciones: [], cercanas: 1 });
});

// Ruling (tareas 9 y 12): por fecha la media de los lugares, (medido + 5) / (modelo + 5), acotado 0,67-1,5; sin corregir
// con menos de 10 fechas, menos de 10 mm de modelo o menos de 5 días mojados (≥ 1 mm).
const dia = (k) => sumarDias('2026-09-01', k);
const pares = (n, medida, modelo, desde = 0) => Array.from({ length: n }, (_, k) => ({ fecha: dia(desde + k), medida, modelo }));
test('sesgo: cociente suavizado de 30 días acotado entre 0,67 y 1,5; con pocos datos, 1', () => {
  assert.equal(factorSesgo(pares(10, 3, 2)), 1.4);       // (30 + 5) / (20 + 5)
  assert.equal(factorSesgo(pares(9, 3, 2)), 1);          // menos de 10 fechas
  assert.equal(factorSesgo(pares(10, 1, 0.9)), 1);       // el modelo casi seco: 9 mm, no se corrige
  assert.equal(factorSesgo(pares(10, 10, 2)), 1.5);      // 105 / 25, acotado
  assert.equal(factorSesgo(pares(10, 0.1, 2)), 0.67);    // 6 / 25, acotado
  assert.equal(factorSesgo([]), 1);
});
test('sesgo robusto: una tormenta sola, muchos puntos de pocos días o medida rota no corrigen', () => {
  assert.equal(factorSesgo([...pares(9, 0, 0), { fecha: dia(9), medida: 20, modelo: 10 }]), 1);   // un solo día mojado
  assert.equal(factorSesgo([...pares(9, 0, 0), { fecha: dia(9), medida: 0, modelo: 10.1 }]), 1);
  const cincoPuntos = [0, 1].flatMap((k) => Array.from({ length: 5 }, () => ({ fecha: dia(k), medida: 3, modelo: 1 })));
  assert.equal(cincoPuntos.length, 10);
  assert.equal(factorSesgo(cincoPuntos), 1);                                                       // 10 pares, 2 fechas
  assert.equal(factorSesgo([...pares(8, 0, 0), ...pares(2, 12, 6, 8)]), 1);                        // 2 días mojados
  assert.equal(factorSesgo([...pares(6, 0, 0), ...pares(4, 8, 4, 6)]), 1);                         // 4 días mojados
  assert.equal(factorSesgo([...pares(5, 0, 0), ...pares(5, 4, 3, 5)]), 1.25);                      // 5 mojados: 25 / 20
  assert.equal(factorSesgo(pares(10, NaN, 2)), 1);
  assert.equal(factorSesgo([...pares(10, 3, 2), { fecha: dia(3), medida: Infinity, modelo: 2 }]), 1.4);   // el par roto se ignora
});
test('sesgo: cinco días mojados repartidos y dos puntos por fecha, cociente de las medias por fecha', () => {
  const mojado = (k) => [{ fecha: dia(k), medida: 6, modelo: 5 }, { fecha: dia(k), medida: 8, modelo: 5 }];   // media 7 / 5
  const secos = [0, 2, 4, 6, 8].flatMap((k) => [{ fecha: dia(k), medida: 0, modelo: 0 }, { fecha: dia(k), medida: 0, modelo: 0 }]);
  assert.equal(factorSesgo([...secos, ...[1, 3, 5, 7, 9].flatMap(mojado)]), 1.33);   // (35 + 5) / (25 + 5)
});

// Serie de 60 días del 03/08 al 01/10 (hoy = 01/10) y medida del 01/08 al 30/09 (61 días).
const DESDE = '2026-08-01', HASTA = '2026-09-30';
const medidaCon = (valores) => { const mm = Array(61).fill(null); for (const [k, v] of Object.entries(valores)) mm[k] = v; return { mm, n: mm.map((v) => (v == null ? 0 : 1)), estaciones: [], cercanas: 1 }; };

test('paresSesgo: solo los últimos 30 días hasta «hasta» con medida y modelo', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: () => 2 });
  const m = medidaCon(Object.fromEntries(Array.from({ length: 12 }, (_, k) => [60 - k, 1])));   // del 19/09 al 30/09
  const p = paresSesgo(s, m, DESDE, HASTA);
  assert.equal(p.length, 12);
  assert.deepEqual(p[0], { fecha: '2026-09-19', medida: 1, modelo: 2 });
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
  assert.deepEqual(r.lluviaAntesDeSerie, { desde: '2026-08-01', mm: 30, origen: 'estimada' });   // 01-02/08 sin medir: 20 × 1,5
  assert.equal(s.precip[57], 2, 'no se toca la serie de entrada');
  const s3 = serieSintetica({ inicio: '2026-08-03', precip: () => 0.3, lluviaAntes: { mm: 7.3 } });
  const r3 = aplicarMedida(s3, null, { desde: DESDE, hasta: HASTA, factor: 1.37 });
  assert.deepEqual([r3.precip[0], r3.lluviaAntesDeSerie.mm, r3.precip[59]], [0.4, 10, 0.3]);   // estimados en décimas: 0,411 y 10,001
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

// Revisión final 2: `ultimo` (último día con aporte de cada estación) es nuevo; un archivo anterior sin él sigue valiendo.
test('validarPluvio: el último día con aporte de cada estación, opcional pero con fecha si viene', () => {
  const con = (s) => ({ version: VERSION_PLUVIO, generado: '2026-10-02T04:10:00.000Z', desde: '2026-09-29', hasta: '2026-09-30',
    lugares: { p: { mm: [1.2, null], n: [1, 0], estaciones: [{ nombre: 'S1', fuente: 'tajo', km: 2, ...s }], cercanas: 1 } } });
  assert.deepEqual(validarPluvio(con({ ultimo: '2026-09-29' })), []);
  assert.deepEqual(validarPluvio(con({})), []);
  assert.deepEqual(validarPluvio(con({ ultimo: 'ayer' })), ['lugar p mal formado']);
  assert.deepEqual(validarPluvio(con({ ultimo: null })), ['lugar p mal formado']);
});

test('estacionesDesde: las que aportaron desde una fecha, en su orden; sin `ultimo` en alguna, null (no se sabe)', () => {
  const lista = [{ nombre: 'A', km: 1, ultimo: '2026-09-01' }, { nombre: 'B', km: 2, ultimo: '2026-09-20' }, { nombre: 'C', km: 3, ultimo: '2026-09-06' }];
  assert.deepEqual(estacionesDesde(lista, '2026-09-06').map((e) => e.nombre), ['B', 'C']);
  assert.deepEqual(estacionesDesde([], '2026-09-06'), []);
  assert.equal(estacionesDesde([{ nombre: 'A', km: 1 }, ...lista], '2026-09-06'), null);
  assert.deepEqual(estacionesDesde(undefined, '2026-09-06'), []);
});

test('el módulo compartido no usa el DOM (Deno no tiene document)', () => {
  for (const n of ['pluvio', 'pluvio-fuentes']) assert.doesNotMatch(readFileSync(`supabase/functions/_shared/${n}.js`, 'utf8'), /\bdocument\.|\bwindow\./, n);
});

// Carry de la tarea 7: la misma estación publicada por dos fuentes (C010/C076, 9178X/C00A, 8210Y/5N03, 3319D/PN34, a
// menos de 1,3 km) cuenta como un solo sitio: media de las que dan dato ese día, con el peso fijo del representante.
test('duplicadas entre fuentes (< 1,5 km): un solo sitio en la mezcla, no pesan doble', () => {
  const dup = { fuente: 'aemet', codigo: 'D', nombre: 'D', lat: 40.0225, lon: -4, altitud: 1200 };   // a 0,5 km de S1
  const estaciones = [est('S1', 40.018), dup, est('S2', 39.982)];
  const l = cercanas(LUGAR, estaciones);
  assert.deepEqual(l.map((c) => [c.clave, c.grupo]), [['tajo:S1', 'tajo:S1'], ['tajo:S2', 'tajo:S2'], ['aemet:D', 'tajo:S1']]);
  assert.equal(l[2].pesoSitio, l[0].peso);
  // S1 = 10, D = 20 → sitio 15 con el peso de S1; S2 = 0 con el mismo peso → 7,5 (sin agrupar, 8,6).
  assert.deepEqual(mezclarDia(l, mapa({ 'tajo:S1': 10, 'aemet:D': 20, 'tajo:S2': 0 })), { mm: 7.5, n: 2 });
  assert.deepEqual(mezclarDia(l, mapa({ 'aemet:D': 20, 'tajo:S2': 0 })), { mm: 10, n: 2 });   // el sitio pesa lo mismo con un solo miembro
  assert.deepEqual(mezclarDia(l, mapa({ 'tajo:S1': 10, 'aemet:D': 20 })), { mm: 15, n: 1 });
  const validos = new Map([['tajo:S1', mapa({ '2026-09-28': 10 })], ['aemet:D', mapa({ '2026-09-28': 20 })], ['tajo:S2', mapa({ '2026-09-28': 0 })]]);
  const r = seriesMedidas([LUGAR], estaciones, validos, '2026-09-28', '2026-09-28');
  assert.deepEqual([r.p.mm, r.p.n, r.p.estaciones.map((e) => e.nombre), r.p.cercanas], [[7.5], [2], ['S1', 'S2', 'D'], 3]);
});

test('duplicadas: el peso del sitio no depende de qué miembro da dato, y no se encadenan', () => {
  const e = (c, lat) => ({ fuente: 't', codigo: c, nombre: c, lat, lon: -4, altitud: 1200 });
  const l = cercanas(LUGAR, [e('A', 40.0045), e('B', 40.017), e('Z', 40.05)]);   // A a 0,5 km, B a 1,9 (1,4 de A), Z a 5,6
  assert.deepEqual(l.map((c) => c.grupo), ['t:A', 't:A', 't:Z']);
  const tres = [mezclarDia(l, mapa({ 't:A': 10, 't:B': 10, 't:Z': 0 })), mezclarDia(l, mapa({ 't:B': 10, 't:Z': 0 })), mezclarDia(l, mapa({ 't:A': 10, 't:Z': 0 }))];
  assert.deepEqual(tres, Array(3).fill({ mm: 9.7, n: 2 }));   // 10 · 1 / (1 + 1 / 5,56²)
  const cadena = cercanas(LUGAR, [e('A', 40.05), e('B', 40.0608), e('C', 40.0716)]);   // cada 1,2 km
  assert.deepEqual(cadena.map((c) => c.grupo), ['t:A', 't:A', 't:C']);
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

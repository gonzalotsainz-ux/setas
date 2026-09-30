// Estado de la nota de zona: especies sin datos (faltan / incompleta) y fuera de temporada (C1 b y c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indiceZona, enTemporada } from '../js/indice.js';
import { calcularZona } from '../js/pantallas/hoy.js';
import { notaPunto } from '../js/mapa.js';
import { serieSintetica, BOLETUS, NISCALO, MORCHELLA, lluviaBuena } from './ayudas.js';

// Desde el 1-oct-2026 la serie empieza el 2-ago: sin la lluvia anterior, las de otoño no se pueden calcular.
const sinAgosto = () => serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena, lluviaAntes: null });   // i = 59 → 1-oct
const TODO_EL_ANO = { id: 'todo', temporada: { meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], tipo: 'todo' }, indice: { ...BOLETUS.indice } };

test('enTemporada: calendario > 0 (meses contiguos cuentan)', () => {
  assert.equal(enTemporada('2026-10-01', BOLETUS), true);
  assert.equal(enTemporada('2026-10-01', MORCHELLA), false);
  assert.equal(enTemporada('2026-08-15', BOLETUS), true);   // agosto, contiguo a septiembre
});

test('indiceZona: especies de otoño sin datos + una fuera de temporada → sin datos, nunca «0 Nulo»', () => {
  const s = sinAgosto();
  assert.equal(s.fechas[59], '2026-10-01');
  const z = indiceZona({ a: s }, 59, [BOLETUS, NISCALO, MORCHELLA]);
  assert.equal(z.sinDatos, true);
  assert.equal(z.valor, null);
  assert.equal(z.incompleta, true);
  assert.deepEqual(z.faltan.sort(), ['boletus-edulis', 'lactarius-deliciosus']);
  assert.equal(z.fueraDeTemporada, false);
});

test('indiceZona: solo especies fuera de temporada → «Fuera de temporada», sin nota ni sin datos', () => {
  const z = indiceZona({ a: serieSintetica({ precip: lluviaBuena }) }, 59, [MORCHELLA]);
  assert.equal(z.fueraDeTemporada, true);
  assert.equal(z.valor, null);
  assert.equal(z.sinDatos, false);
  assert.deepEqual(z.especies, []);
  assert.deepEqual(z.faltan, []);
});

test('indiceZona: las de fuera de temporada no entran en la nota (no dan un 0)', () => {
  const z = indiceZona({ a: serieSintetica({ precip: () => 0 }) }, 59, [BOLETUS, MORCHELLA]);
  assert.deepEqual(z.especies.map((e) => e.id), ['boletus-edulis']);
  assert.equal(z.fueraDeTemporada, false);
});

test('indiceZona: una en temporada sin datos y otra con nota → nota de la otra e incompleta', () => {
  const z = indiceZona({ a: sinAgosto() }, 59, [BOLETUS, TODO_EL_ANO]);
  assert.equal(z.sinDatos, false);
  assert.equal(typeof z.valor, 'number');
  assert.deepEqual(z.especies.map((e) => e.id), ['todo']);
  assert.deepEqual(z.faltan, ['boletus-edulis']);
  assert.equal(z.incompleta, true);
});

test('indiceZona: todo calculado → incompleta false y faltan vacío', () => {
  const z = indiceZona({ a: serieSintetica({ precip: lluviaBuena }) }, 59, [BOLETUS]);
  assert.equal(z.incompleta, false);
  assert.deepEqual(z.faltan, []);
});

const zona = { id: 'z', habitats: ['pinar'], puntos: [{ id: 'a' }] };
const conHabitat = (e) => ({ ...e, categoria: 'comestible', habitats: ['pinar'], zonas: { z: { presencia: 'frecuente' } } });
const datosCon = (...es) => ({ especies: es.map(conHabitat), porId: Object.fromEntries(es.map((e) => [e.id, conHabitat(e)])) });

test('calcularZona: otoño sin datos + fuera de temporada → sin nota («Sin datos»), no 0', () => {
  const f = calcularZona(zona, datosCon(BOLETUS, NISCALO, MORCHELLA), { series: { a: sinAgosto() } }, 0, '');
  assert.equal(f.res.valor, null);
  assert.equal(f.res.sinDatos, true);
  assert.equal(f.mejor, null);
  assert.match(f.motivo, /2 especies sin datos suficientes/);
});

test('calcularZona: zona con solo especies fuera de temporada → «Fuera de temporada»', () => {
  const f = calcularZona(zona, datosCon(MORCHELLA), { series: { a: serieSintetica({ precip: lluviaBuena }) } }, 0, '');
  assert.equal(f.res.valor, null);
  assert.equal(f.res.fueraDeTemporada, true);
  assert.match(f.motivo, /fuera de temporada/i);
});

test('calcularZona: la previsión incierta solo cuenta en días > 0', () => {
  const meteo = { series: { a: serieSintetica({ precip: lluviaBuena, dias: 70 }) }, dispersion: { a: { incierta: true, horizonte: 5 } } };
  assert.equal(calcularZona(zona, datosCon(BOLETUS), meteo, 0, '').incierta, false);
  assert.equal(calcularZona(zona, datosCon(BOLETUS), meteo, 2, '').incierta, true);
});

test('notaPunto: sin datos de otoño + fuera de temporada → valor null, incompleta y cuántas faltan', () => {
  const r = notaPunto(zona, { id: 'a' }, datosCon(BOLETUS, MORCHELLA), { series: { a: sinAgosto() } }, {});
  assert.equal(r.valor, null);
  assert.equal(r.incompleta, true);
  assert.equal(r.faltan, 1);
  const f = notaPunto(zona, { id: 'a' }, datosCon(MORCHELLA), { series: { a: serieSintetica({ precip: lluviaBuena }) } }, {});
  assert.equal(f.fueraDeTemporada, true);
});

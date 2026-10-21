import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularZona, ordenarZonas, textoFaltan, haceCuanto, desplazamientoDia, notaPuntoDia } from '../js/notas-zona.js';
import { nivelDe } from '../js/ui/semaforo.js';
import { serieSintetica, BOLETUS as B0, NISCALO as N0, lluviaBuena } from './ayudas.js';

const comunes = { habitats: ['pinar-silvestre'], categoria: 'comestible', zonas: { z: { presencia: 'si' } } };
const BOLETUS = { ...B0, ...comunes, nombre: 'Boletus edulis' };
const NISCALO = { ...N0, ...comunes, nombre: 'Lactarius deliciosus' };
const zona = { id: 'z', habitats: ['pinar-silvestre'], puntos: [{ id: 'p1', habitat: 'pinar-silvestre' }] };
const meteo = { series: { p1: serieSintetica({ precip: lluviaBuena }) } };
const datos = { especies: [BOLETUS, NISCALO], porId: { [BOLETUS.id]: BOLETUS, [NISCALO.id]: NISCALO } };

test('calcularZona acepta un conjunto de ids (chip de grupo), un array y una sola id (compatibilidad)', () => {
  const grupo = calcularZona(zona, datos, meteo, 0, new Set([BOLETUS.id, NISCALO.id]));
  const array = calcularZona(zona, datos, meteo, 0, [BOLETUS.id, NISCALO.id]);
  const una = calcularZona(zona, datos, meteo, 0, BOLETUS.id);
  const todas = calcularZona(zona, datos, meteo, 0, null);
  assert.equal(grupo.res.especies.length, 2);
  assert.equal(array.res.especies.length, 2);
  assert.equal(todas.res.especies.length, 2);
  assert.deepEqual(una.res.especies.map((e) => e.id), [BOLETUS.id]);
});

test('calcularZona sin ninguna especie del filtro en la zona no calcula nota', () => {
  const f = calcularZona(zona, datos, meteo, 0, new Set(['otra']));
  assert.equal(f.res.valor, null);
  assert.match(f.motivo, /Sin registros/);
});

test('desplazamientoDia: hoy con tanda de hoy es 0; con tanda de ayer es 1; fuera de 0..7 es null', () => {
  assert.equal(desplazamientoDia('2026-10-21', '2026-10-21'), 0);
  assert.equal(desplazamientoDia('2026-10-21', '2026-10-20'), 1);
  assert.equal(desplazamientoDia('2026-10-20', '2026-10-21'), null);
  assert.equal(desplazamientoDia('2026-10-29', '2026-10-21'), null);
  assert.equal(desplazamientoDia('2026-10-28', '2026-10-21'), 7);
});

test('notaPuntoDia: sin serie no hay nota ni nivel inventado; con serie, nota y especie que la da', () => {
  const sin = notaPuntoDia(zona, { id: 'nada' }, datos, meteo, 0, null);
  assert.equal(sin.valor, null);
  assert.ok(sin.motivo.length > 0);
  const n = notaPuntoDia(zona, zona.puntos[0], datos, meteo, 0, null);
  assert.ok(n.valor >= 0 && n.valor <= 100);
  assert.equal(n.nivel, nivelDe(n.valor));
  assert.equal(n.mejor.id, n.especies[0].id);
  assert.equal(n.mejor.especie, datos.porId[n.mejor.id]);
});

test('notaPuntoDia respeta el filtro de especies', () => {
  const n = notaPuntoDia(zona, zona.puntos[0], datos, meteo, 0, new Set([NISCALO.id]));
  assert.deepEqual(n.especies.map((e) => e.id), [NISCALO.id]);
});

test('notaPuntoDia con d null (fecha fuera del horizonte) devuelve sin datos', () => {
  const n = notaPuntoDia(zona, zona.puntos[0], datos, meteo, null, null);
  assert.equal(n.valor, null);
  assert.ok(n.motivo.length > 0);
});

test('textoFaltan, haceCuanto y ordenarZonas siguen igual', () => {
  assert.equal(textoFaltan(1), '1 especie sin datos suficientes');
  assert.equal(textoFaltan(3), '3 especies sin datos suficientes');
  assert.equal(haceCuanto('2026-10-21T10:00:00Z', new Date('2026-10-21T10:30:00Z')), 'hace menos de 1 h');
  assert.equal(haceCuanto('2026-10-21T10:00:00Z', new Date('2026-10-21T13:00:00Z')), 'hace 3 h');
  assert.deepEqual(ordenarZonas([{ res: { valor: 10 } }, { res: { valor: null } }, { res: { valor: 50 } }]).map((f) => f.res.valor), [50, 10, null]);
});

test('notaPuntoDia: un punto NO IR nunca tiene nota, aunque tenga serie de meteo', () => {
  const noIr = { id: 'p1', habitat: 'pinar-silvestre', noIr: true };
  const n = notaPuntoDia(zona, noIr, datos, meteo, 0, null);
  assert.equal(n.valor, null);
  assert.equal(n.nivel, 'sin-datos');
  assert.equal(n.mejor, null);
  assert.equal(n.motivo, 'NO IR (solo meteo): no se calcula nota.');
});

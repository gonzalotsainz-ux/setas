import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarEspecies } from '../js/pantallas/especies.js';
const L = [{ id: 'collybia-nuda', nombre: 'Collybia nuda', sinonimos: ['Lepista nuda'], comunes: { es: ['pie azul'], eu: ['ubel'] } },
  { id: 'lactarius-deliciosus', nombre: 'Lactarius deliciosus', sinonimos: [], comunes: { es: ['níscalo', 'rovellón'], eu: ['esne-gorri'] } }];
test('busca por sinónimo antiguo', () => assert.deepEqual(buscarEspecies('lepista', L).map((e) => e.id), ['collybia-nuda']));
test('ignora tildes y mayúsculas', () => assert.deepEqual(buscarEspecies('NISCALO', L).map((e) => e.id), ['lactarius-deliciosus']));
test('busca en euskera', () => assert.deepEqual(buscarEspecies('esne', L).map((e) => e.id), ['lactarius-deliciosus']));
test('vacío → todas', () => assert.equal(buscarEspecies('', L).length, 2));
test('espacios solos → todas', () => assert.equal(buscarEspecies('   ', L).length, 2));
test('sin coincidencias → vacío', () => assert.deepEqual(buscarEspecies('zzz', L), []));
test('tolera especies sin comunes ni sinónimos', () => assert.deepEqual(buscarEspecies('amanita', [{ id: 'a', nombre: 'Amanita x' }]).map((e) => e.id), ['a']));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { especiesDeZona, nombreCorto } from '../js/datos.js';
const zona = { id: 'soria', habitats: ['pinar-silvestre'] };
const e = (id, extra) => ({ id, categoria: 'comestible', habitats: ['pinar-silvestre'], zonas: { soria: { presencia: 'orientativa' } },
  indice: { topt: 13, trango: [10, 15], pmin: 30, pfull: 90, desfase: [7, 21] }, temporada: { meses: [10] }, ...extra });
test('filtra por categoría, índice, presencia y hábitat', () => {
  const lista = [e('a'), e('b', { categoria: 'mortal', indice: null }), e('c', { indice: null, sinIndice: 'x' }),
    e('d', { zonas: { soria: { presencia: 'sin-registros' } } }), e('f', { habitats: ['encinar'] }), e('g', { zonas: {} })];
  assert.deepEqual(especiesDeZona(zona, lista).map((x) => x.id), ['a']);
});
test('aplica los umbrales editados', () => {
  const r = especiesDeZona(zona, [e('a')], { a: { topt: 11 } });
  assert.equal(r[0].indice.topt, 11);
});
test('nombreCorto quita el paréntesis final', () => {
  assert.equal(nombreCorto({ nombre: 'Soria (Pinar Grande, Tierras Altas)' }), 'Soria');
  assert.equal(nombreCorto({ nombre: 'Gredos y Valle del Tiétar' }), 'Gredos y Valle del Tiétar');
});

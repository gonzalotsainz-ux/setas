import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { especiesDeZona, nombreCorto } from '../js/datos.js';
import { comprobarCortos } from '../scripts/validar-datos.mjs';
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
test('todos los puntos tienen nombre corto (2 a 18 caracteres) y es único en su zona', () => {
  const zonas = JSON.parse(readFileSync(new URL('../data/zonas.json', import.meta.url), 'utf8')).zonas;
  for (const z of zonas) {
    const cortos = z.puntos.map((p) => p.corto);
    for (const c of cortos) assert.ok(typeof c === 'string' && c.length >= 2 && c.length <= 18, `${z.id}: «${c}»`);
    assert.equal(new Set(cortos).size, cortos.length, `${z.id}: corto repetido`);
  }
});
test('comprobarCortos: rechaza un punto sin corto, uno largo y dos iguales en la misma zona', () => {
  const zona = (puntos) => ({ id: 'z', puntos: puntos.map((corto, k) => ({ id: `p${k}`, corto })) });
  assert.deepEqual(comprobarCortos(zona(['Valsaín', 'Morcuera'])), []);
  assert.deepEqual(comprobarCortos(zona([undefined])), ['punto p0: sin corto']);
  assert.deepEqual(comprobarCortos(zona(['Pinar de repoblación de pino'])), ['punto p0: corto de más de 18 caracteres']);
  assert.deepEqual(comprobarCortos(zona(['Valsaín', 'Valsaín'])), ['zona z: corto repetido «Valsaín»']);
});

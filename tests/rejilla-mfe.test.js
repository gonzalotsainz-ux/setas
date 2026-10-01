// tests/rejilla-mfe.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { habitatDeTesela, habitatDeEspecie, leerTeselaMfe, ESPECIE_A_HABITAT, FCC_MINIMA } from '../scripts/rejilla/mfe-habitat.mjs';
import { HABITATS } from '../scripts/validar-datos.mjs';
import { CONFIG } from '../scripts/rejilla/config.mjs';

const arbolado = (especies, fcc = 60) => ({ tipo: 'arbolado', especies, fcc });

test('arbolado: la especie dominante da el hábitat si cubre lo bastante', () => {
  assert.equal(habitatDeTesela(arbolado(['Pinus sylvestris']), 1500), 'pinar-silvestre');
  assert.equal(habitatDeTesela(arbolado(['Quercus pyrenaica']), 1100), 'melojar');
  assert.equal(habitatDeTesela(arbolado(['Pinus sylvestris'], FCC_MINIMA - 1), 1500), null);
  assert.equal(habitatDeTesela(arbolado(['Pinus sylvestris'], null), 1500), null);   // sin cabida cubierta: no se colorea
});

test('arbolado: si la primera especie no tiene hábitat, vale la segunda; si ninguna, sin monte', () => {
  assert.equal(habitatDeTesela(arbolado(['Pinus halepensis', 'Quercus ilex']), 900), 'encinar');
  assert.equal(habitatDeTesela(arbolado(['Pinus halepensis']), 900), null);
  assert.equal(habitatDeTesela(arbolado(['Eucalyptus globulus', 'Pinus halepensis', 'Fagus sylvatica']), 900), null);   // solo las dos primeras
});

test('nombres con subespecie, híbridos y géneros', () => {
  assert.equal(habitatDeEspecie('Quercus ilex subsp. ballota'), 'encinar');
  assert.equal(habitatDeEspecie('Populus x canadensis'), 'chopera');
  assert.equal(habitatDeEspecie('Betula celtiberica'), 'abedular');
  assert.equal(habitatDeEspecie('Pinus uncinata'), null);
});

test('herbazal según la altitud, matorral solo si es jaral, lo demás sin monte', () => {
  assert.equal(habitatDeTesela({ tipo: 'herbazal', especies: [], fcc: null }, 1400), 'pastizal-montana');
  assert.equal(habitatDeTesela({ tipo: 'herbazal', especies: [], fcc: null }, 999), 'prado');
  assert.equal(habitatDeTesela({ tipo: 'herbazal', especies: [], fcc: null }, NaN), null);
  assert.equal(habitatDeTesela({ tipo: 'matorral', especies: ['Cistus ladanifer'], fcc: null }, 600, { matorralJaral: ['Cistus ladanifer'] }), 'jaral');
  assert.equal(habitatDeTesela({ tipo: 'matorral', especies: ['Cistus ladanifer'], fcc: null }, 600), null);
  assert.equal(habitatDeTesela({ tipo: 'otro', especies: ['Pinus sylvestris'], fcc: 80 }, 1500), null);
});

test('todos los hábitats de la tabla existen en especies.json', () => {
  for (const h of Object.values(ESPECIE_A_HABITAT)) assert.ok(HABITATS.includes(h), h);
});

test('leerTeselaMfe traduce campos, códigos y tipos', () => {
  const conf = { campos: { especies: ['SP1', 'SP2'], fcc: 'FCCARB', tipo: 'TIPO' }, tipos: { arbolado: ['1'], herbazal: ['4'], matorral: ['3'] } };
  assert.deepEqual(leerTeselaMfe({ SP1: 21, SP2: '', FCCARB: '65', TIPO: 1 }, conf, { 21: 'Pinus sylvestris' }), { tipo: 'arbolado', especies: ['Pinus sylvestris'], fcc: 65 });
  assert.deepEqual(leerTeselaMfe({ SP1: null, FCCARB: null, TIPO: 9 }, conf, {}), { tipo: 'otro', especies: [], fcc: null });
});

test('leerTeselaMfe: el código 0 de SP1/SP2 (sin especie en el MFE50) no entra en la lista', () => {
  const conf = { campos: { especies: ['SP1', 'SP2'], fcc: 'FCCARB', tipo: 'TIPO' }, tipos: { arbolado: ['1'], herbazal: ['4'], matorral: ['3'] } };
  assert.deepEqual(leerTeselaMfe({ SP1: 21, SP2: 0, FCCARB: 65, TIPO: 1 }, conf, { 21: 'Pinus sylvestris' }).especies, ['Pinus sylvestris']);
  assert.deepEqual(leerTeselaMfe({ SP1: '0', SP2: 0, FCCARB: 0, TIPO: 3 }, conf, {}), { tipo: 'matorral', especies: [], fcc: 0 });
});

test('la muestra real del MFE50 (tarea 0) se lee con la configuración del sondeo', () => {
  const muestra = JSON.parse(readFileSync('scripts/rejilla/mfe-muestra.json', 'utf8'));
  const diccionario = JSON.parse(readFileSync('scripts/rejilla/mfe-diccionario.json', 'utf8'));
  assert.ok(muestra.length >= 20);
  const leidas = muestra.map((m) => leerTeselaMfe(m.properties, CONFIG.mfe, diccionario));
  for (const t of leidas) assert.ok(['arbolado', 'herbazal', 'matorral', 'otro'].includes(t.tipo));
  assert.ok(leidas.some((t) => habitatDeTesela(t, 1200, CONFIG.mfe)), 'ninguna tesela de la muestra da hábitat: revisa CONFIG.mfe');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { leerRutaMapa, rutaMapa, leerRutaZona, rutaZona } from '../js/mapa/ruta.js';

test('rutaMapa y leerRutaMapa son inversas, con ids codificados', () => {
  for (const s of [{ zona: null, punto: null }, { zona: 'guadarrama', punto: null }, { zona: 'guadarrama', punto: 'guadarrama-valsain-pinar' }]) {
    assert.deepEqual(leerRutaMapa(rutaMapa(s)), s);
  }
  assert.equal(rutaMapa({}), '#mapa');
  assert.deepEqual(leerRutaMapa('#hoy'), { zona: null, punto: null });
  assert.deepEqual(leerRutaMapa('#mapa/sierra%20norte'), { zona: 'sierra norte', punto: null });
});

test('leerRutaZona admite punto opcional', () => {
  assert.deepEqual(leerRutaZona('#zona/soria'), { zona: 'soria', punto: null });
  assert.deepEqual(leerRutaZona('#zona/soria/soria-covaleda-pinar'), { zona: 'soria', punto: 'soria-covaleda-pinar' });
  assert.equal(rutaZona('soria', 'soria-covaleda-pinar'), '#zona/soria/soria-covaleda-pinar');
  assert.equal(rutaZona('soria'), '#zona/soria');
  assert.deepEqual(leerRutaZona('#mapa/soria'), { zona: null, punto: null });
});

test('un hash mal codificado no lanza', () => {
  assert.deepEqual(leerRutaMapa('#mapa/%'), { zona: '%', punto: null });
  assert.deepEqual(leerRutaZona('#zona/soria/%E0%A4%A'), { zona: 'soria', punto: '%E0%A4%A' });
});

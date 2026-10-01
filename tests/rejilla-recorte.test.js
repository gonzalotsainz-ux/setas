// tests/rejilla-recorte.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cubre, bboxRecorte, recorteVale, provinciasDeZona } from '../scripts/rejilla/recortar-mfe.mjs';
import { bboxDeVentana } from '../scripts/rejilla/generar.mjs';
import { ventanaBbox } from '../js/rejilla/geo.js';

const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;

test('cubre: un bbox dentro de otro, bordes incluidos', () => {
  assert.ok(cubre([0, 0, 2, 2], [0, 0, 2, 2]));
  assert.ok(cubre([0, 0, 2, 2], [0.5, 0.5, 1, 1]));
  assert.ok(!cubre([0, 0, 2, 2], [-0.1, 0.5, 1, 1]));
  assert.ok(!cubre([0, 0, 2, 2], [0.5, 0.5, 1, 2.1]));
  assert.ok(!cubre(undefined, [0, 0, 1, 1]));
});

test('un recorte vale si su bbox cubre el que pide la zona; si la zona crece o falta el .recorte.json, se rehace', () => {
  const zona = { id: 'x', bbox: [-4, 40, -3, 41], provincias: [] };
  assert.ok(recorteVale({ bbox: bboxRecorte(zona.bbox) }, zona));
  assert.ok(!recorteVale({ bbox: bboxRecorte(zona.bbox) }, { ...zona, bbox: [-4.2, 40, -3, 41] }));
  assert.ok(!recorteVale(null, zona));
  assert.ok(!recorteVale({ bbox: [-4, 40, -3, 41] }, zona));   // sin el margen no basta
});

test('el recorte de cada zona (con su margen) cubre la ventana de celdas finas', () => {
  for (const z of zonas) assert.ok(cubre(bboxRecorte(z.bbox), bboxDeVentana(ventanaBbox(z.bbox))), z.id);
});

test('provinciasDeZona: primero las de la zona, después las vecinas marcadas «fuera», sin repetir', () => {
  const zona = { id: 'z', provincias: ['Madrid', 'Segovia'] };
  assert.deepEqual(provinciasDeZona(zona, { z: ['Ávila', 'Madrid'] }), [
    { provincia: 'Madrid', fuera: false }, { provincia: 'Segovia', fuera: false }, { provincia: 'Ávila', fuera: true }]);
  assert.deepEqual(provinciasDeZona(zona, {}).map((p) => p.fuera), [false, false]);
});

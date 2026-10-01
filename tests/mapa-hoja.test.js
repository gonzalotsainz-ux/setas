// tests/mapa-hoja.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlComoLlegar, textoCoto, modeloHoja, clasesHoja, estadoTrasArrastre, NOMBRE_HABITAT, AVISO_FUERA_PROVINCIAS, AVISO_PRADO } from '../js/mapa/hoja.js';
import { HABITATS } from '../scripts/validar-datos.mjs';

const nbsp = '\u00a0';
const celda = { habitat: 'pinar-silvestre', altitud: 1560, orientacion: 1, tramo: 2, lat: 40.853, lon: -3.9943 };
const ag = { P26: 106.2, pct: 63.4, T20aire: 11.66 };
const boletus = { id: 'boletus-edulis', nombre: 'Boletus edulis', comunes: { es: ['hongo blanco'] } };
const niscalo = { id: 'lactarius-deliciosus', nombre: 'Lactarius deliciosus', comunes: { es: ['níscalo'] } };
const nota = { sinEspecies: false, valor: 92, especie: boletus, resultado: {}, otras: [{ especie: niscalo, valor: 70 }], faltan: [] };
const zona = { id: 'guadarrama' };

test('«Cómo llegar» abre la ruta de Google Maps hasta la celda', () => {
  assert.equal(urlComoLlegar(40.853, -3.9943), 'https://www.google.com/maps/dir/?api=1&destination=40.85300,-3.99430');
});

test('hoja de monte: bosque, altitud, orientación, pendiente, meteo, coto y tres botones', () => {
  const m = modeloHoja({ celda, nota, ag, zona, coto: { nombre: 'Valsaín', tipo: 'acotado', permisoUrl: 'https://x.es/permiso' } });
  assert.equal(m.tipo, 'monte');
  assert.equal(m.titulo, 'Pinar silvestre');
  assert.equal(m.valor, 92);
  assert.equal(m.nivel, 'muy-bueno');
  assert.deepEqual(m.especie, { id: 'boletus-edulis', nombre: 'hongo blanco', latin: 'Boletus edulis' });
  // número y unidad con espacio duro (docs/diseno.md)
  assert.deepEqual(m.filas.map((f) => [f.etiqueta, f.valor]), [
    ['Bosque', 'Pinar silvestre'], ['Altitud', `1560${nbsp}m`], ['Orientación', 'Norte (umbría)'], ['Pendiente', `del 15 al 30${nbsp}%`],
    ['Lluvia en 26 días', `106${nbsp}mm`], ['Humedad del suelo', 'percentil 63'], ['Temperatura', `11,7${nbsp}°C de media en 20 días`]]);
  assert.deepEqual(m.coto, { texto: 'Valsaín: pide permiso.', url: 'https://x.es/permiso' });
  assert.deepEqual(m.acciones, { comoLlegar: urlComoLlegar(40.853, -3.9943), detalle: '#zona/guadarrama', diario: '#diario/nueva?lat=40.85300&lon=-3.99430&zona=guadarrama' });
  assert.deepEqual(m.otras, [{ nombre: 'níscalo', valor: 70 }]);
  assert.equal(m.orientativo, true);   // umbría: el ajuste por orientación no está calibrado
  assert.deepEqual(m.avisos, []);
  assert.equal(clasesHoja(m), 'hoja hoja--mapa');
});

test('orientación llana no lleva la marca «Orientativo»', () => {
  assert.equal(modeloHoja({ celda: { ...celda, orientacion: 0 }, nota, ag, zona }).orientativo, false);
});

test('hoja sin datos suficientes: gris, sin nota inventada', () => {
  const m = modeloHoja({ celda, nota: { ...nota, valor: null, especie: null, otras: [], faltan: ['boletus-edulis'] }, ag: null, zona });
  assert.equal(m.tipo, 'sinDatos');
  assert.equal(m.texto, 'Sin datos suficientes para este día.');
  assert.equal(m.valor, undefined);
  assert.deepEqual(m.avisos, [{ texto: '1 especie sin datos suficientes.', peligro: false }]);
});

test('especies del hábitat sin datos: la hoja lo dice aunque haya nota', () => {
  const m = modeloHoja({ celda, nota: { ...nota, faltan: ['a', 'b'] }, ag, zona });
  assert.equal(m.tipo, 'monte');
  assert.deepEqual(m.avisos, [{ texto: '2 especies sin datos suficientes: la nota sale solo con las demás.', peligro: false }]);
});

test('celda fuera de las provincias de la zona: aviso de normativa no revisada', () => {
  const m = modeloHoja({ celda: { ...celda, fueraProvincias: true }, nota, ag, zona });
  assert.equal(AVISO_FUERA_PROVINCIAS, 'Fuera de las provincias de la zona: normativa no revisada en la app.');
  assert.deepEqual(m.avisos, [{ texto: AVISO_FUERA_PROVINCIAS, peligro: true }]);
});

test('prado: no se presenta como monte libre', () => {
  const m = modeloHoja({ celda: { ...celda, habitat: 'prado' }, nota, ag, zona });
  assert.match(AVISO_PRADO, /suele ser finca privada/);
  assert.deepEqual(m.avisos, [{ texto: AVISO_PRADO, peligro: true }]);
  assert.equal(modeloHoja({ celda: { ...celda, habitat: 'prado', fueraProvincias: true }, nota: { ...nota, faltan: ['x'] }, ag, zona }).avisos.length, 3);
});

test('zona prohibida: hoja roja con la norma y sin botón de ruta', () => {
  const normas = new Map([['pn-guadarrama-prug', { titulo: 'PRUG del Parque Nacional', url: 'https://boe.es/x' }]]);
  const m = modeloHoja({ prohibido: { nombre: 'Macizo de Peñalara', nota: 'Prohibida por el PRUG.', normas: ['pn-guadarrama-prug', 'otra'] }, normas, celda });
  assert.equal(m.tipo, 'prohibido');
  assert.equal(m.titulo, 'Macizo de Peñalara');
  assert.deepEqual(m.normas, [{ titulo: 'PRUG del Parque Nacional', url: 'https://boe.es/x' }, { titulo: 'otra', url: null }]);
  assert.equal(m.acciones, undefined);
  assert.equal(clasesHoja(m), 'hoja hoja--mapa hoja--prohibido');
});

test('textos de coto y nombres de todos los hábitats', () => {
  assert.equal(textoCoto(null).texto, 'Fuera de los cotos conocidos: comprueba la normativa de la zona.');
  assert.deepEqual(textoCoto({ nombre: 'Coto X', tipo: 'regulado' }), { texto: 'Coto X: recolección regulada, consulta la norma.', url: null });
  assert.equal(textoCoto({ nombre: 'P', tipo: 'parque-micologico', permisoUrl: 'javascript:alert(1)' }).url, null);
  for (const h of HABITATS) assert.ok(NOMBRE_HABITAT[h], h);
});

test('arrastre de la hoja', () => {
  assert.equal(estadoTrasArrastre('resumen', -80), 'completa');
  assert.equal(estadoTrasArrastre('resumen', 80), 'cerrada');
  assert.equal(estadoTrasArrastre('resumen', 20), 'resumen');
  assert.equal(estadoTrasArrastre('completa', 80), 'resumen');
  assert.equal(estadoTrasArrastre('completa', -80), 'completa');
});

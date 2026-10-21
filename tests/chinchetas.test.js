import test from 'node:test';
import assert from 'node:assert/strict';
import { queChinchetas, centroide, chinchetasZonas, chinchetasMontes, textoAria, ZOOM_MONTES, ZOOM_ETIQUETAS } from '../js/mapa/chinchetas.js';
import { serieSintetica, BOLETUS as B0, lluviaBuena } from './ayudas.js';

const BOLETUS = { ...B0, habitats: ['pinar-silvestre'], categoria: 'comestible', zonas: { z: { presencia: 'si' } }, nombre: 'Boletus edulis' };
const datos = { especies: [BOLETUS], porId: { [BOLETUS.id]: BOLETUS } };
const zonaA = { id: 'a', nombre: 'A (Sierra)', puntos: [{ id: 'p1', lat: 40, lon: -4 }, { id: 'p2', lat: 42, lon: -6 }, { id: 'p3', lat: 50, lon: 0, noIr: true }] };
const zonaB = { id: 'b', nombre: 'B', puntos: [{ id: 'q1', lat: 1, lon: 2, noIr: true }, { id: 'q2', lat: 3, lon: 4, noIr: true }] };

test('constantes y queChinchetas: zonas por debajo del zoom 9, montes desde 9', () => {
  assert.equal(ZOOM_MONTES, 9);
  assert.equal(ZOOM_ETIQUETAS, 13);
  assert.equal(queChinchetas(8.9), 'zonas');
  assert.equal(queChinchetas(9), 'montes');
  assert.equal(queChinchetas(14), 'montes');
});

test('centroide: media de los puntos recogibles; sin recogibles, de todos', () => {
  assert.deepEqual(centroide(zonaA), { lat: 41, lon: -5 });
  assert.deepEqual(centroide(zonaB), { lat: 2, lon: 3 });
});

test('chinchetasZonas: nota y nivel de la fila, «?» sin datos, orden de la lista', () => {
  const filas = [{ zona: zonaA, res: { valor: 82 } }, { zona: zonaB, res: { valor: null } }];
  const c = chinchetasZonas(filas);
  assert.deepEqual(c.map((x) => [x.tipo, x.id, x.pos, x.valor, x.nivel, x.texto]),
    [['zona', 'a', 1, 82, 'muy-bueno', 'A'], ['zona', 'b', 2, null, 'sin-datos', 'B']]);
  assert.deepEqual([c[0].lat, c[0].lon], [41, -5]);
  assert.equal(textoAria(c[0]), 'A, 82, muy bueno');
  assert.equal(c[0].aria, 'A, 82, muy bueno');
  assert.equal(textoAria(c[1]), 'B, sin datos');
});

test('chinchetasMontes: usa corto, marca NO IR y nunca inventa nota sin serie', () => {
  const zona = { id: 'z', nombre: 'Zona Z (X)', habitats: ['pinar-silvestre'], puntos: [
    { id: 'p1', nombre: 'Valsaín', corto: 'Valsaín', lat: 40.1, lon: -4.1, habitat: 'pinar-silvestre' },
    { id: 'p2', nombre: 'Sin serie', corto: 'Sinser', lat: 40.2, lon: -4.2, habitat: 'pinar-silvestre' },
    { id: 'p3', nombre: 'Abantos', corto: 'Abantos', lat: 40.3, lon: -4.3, habitat: 'pinar-silvestre', noIr: true }] };
  const meteo = { series: { p1: serieSintetica({ precip: lluviaBuena }), p3: serieSintetica({ precip: lluviaBuena }) } };
  const [a, b, n] = chinchetasMontes([zona], datos, meteo, 0, null, {});
  assert.equal(a.tipo, 'punto'); assert.equal(a.zona, 'z'); assert.equal(a.id, 'p1');
  assert.equal(a.texto, 'Valsaín'); assert.equal(a.noIr, false);
  assert.ok(a.valor >= 0 && a.valor <= 100);
  assert.match(a.aria, /^Valsaín, \d+, /);
  assert.equal(b.valor, null); assert.equal(b.nivel, 'sin-datos'); assert.equal(b.aria, 'Sinser, sin datos');
  assert.equal(n.noIr, true); assert.equal(n.valor, null); assert.equal(n.nivel, 'sin-datos');
  assert.equal(n.rotulo.texto, 'NO IR (solo meteo)');
  assert.equal(textoAria(n), 'Abantos, NO IR (solo meteo)');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverSeleccion, claveSeleccion, encuadreDe, migasDe, rutaSubir, estadoHistorial, volverConAtras, rutaNormal, zonasQueCortan, filasZonas, filtroDeChip, limitesZona, ZOOM_MONTE, MOTIVO_FUERA_DE_PREVISION } from '../js/mapa/seleccion.js';
import { calcularZona } from '../js/notas-zona.js';
import { serieSintetica, BOLETUS as B0, lluviaBuena } from './ayudas.js';

const BOLETUS = { ...B0, habitats: ['pinar-silvestre'], categoria: 'comestible', zonas: { z: { presencia: 'si' } }, nombre: 'Boletus edulis' };
const datosNota = { especies: [BOLETUS], porId: { [BOLETUS.id]: BOLETUS } };
const guad = { id: 'guadarrama', nombre: 'Guadarrama (Madrid)', bbox: [-4.2, 40.7, -3.6, 41.0], habitats: ['pinar-silvestre'],
  puntos: [{ id: 'valsain', corto: 'Valsaín', nombre: 'Pinar de Valsaín (Segovia)', lat: 40.85, lon: -4.03 }, { id: 'morcuera', corto: 'Morcuera', nombre: 'Pinar de la Morcuera', lat: 40.83, lon: -3.83 }] };
const merin = { id: 'merindades', nombre: 'Merindades', bbox: [-3.9, 42.8, -3.3, 43.1], puntos: [{ id: 'unico', corto: 'Único', nombre: 'Monte único', lat: 42.95, lon: -3.6 }] };
const zonas = [guad, merin];

test('resolverSeleccion: zona y punto de la ruta; punto desconocido deja la zona; zona desconocida, nada', () => {
  assert.deepEqual(resolverSeleccion({ zona: null, punto: null }, zonas), { zona: null, punto: null });
  assert.deepEqual(resolverSeleccion({ zona: 'guadarrama', punto: null }, zonas), { zona: guad, punto: null });
  assert.deepEqual(resolverSeleccion({ zona: 'guadarrama', punto: 'valsain' }, zonas), { zona: guad, punto: guad.puntos[0] });
  assert.deepEqual(resolverSeleccion({ zona: 'guadarrama', punto: 'unico' }, zonas), { zona: guad, punto: null });   // punto de otra zona
  assert.deepEqual(resolverSeleccion({ zona: 'nada', punto: 'valsain' }, zonas), { zona: null, punto: null });
});

test('claveSeleccion distingue nada, zona y monte', () => {
  const k = (r) => claveSeleccion(resolverSeleccion(r, zonas));
  assert.equal(k({ zona: null }), '');
  assert.equal(k({ zona: 'guadarrama' }), 'guadarrama');
  assert.equal(k({ zona: 'guadarrama', punto: 'valsain' }), 'guadarrama/valsain');
});

test('encuadreDe: zona → su bbox (también con un solo monte); monte → vista cercana; nada → sin encuadre', () => {
  assert.equal(encuadreDe({ zona: null, punto: null }), null);
  assert.deepEqual(encuadreDe({ zona: guad, punto: null }), { tipo: 'zona', limites: [[40.7, -4.2], [41.0, -3.6]] });
  assert.deepEqual(encuadreDe({ zona: merin, punto: null }), { tipo: 'zona', limites: limitesZona(merin) });   // bbox, nunca un punto
  assert.deepEqual(encuadreDe({ zona: guad, punto: guad.puntos[0] }), { tipo: 'punto', centro: [40.85, -4.03], zoom: ZOOM_MONTE });
  assert.equal(ZOOM_MONTE, 13);
});

test('migas: ‹ que sube un nivel, la zona por su nombre corto y el monte por su corto', () => {
  assert.deepEqual(migasDe({ zona: null, punto: null }), []);
  assert.deepEqual(migasDe({ zona: guad, punto: null }), [
    { texto: '‹', href: '#mapa', aria: 'Volver a todas las zonas', subir: true },
    { texto: 'Guadarrama', href: '#mapa/guadarrama' }]);
  assert.deepEqual(migasDe({ zona: guad, punto: guad.puntos[0] }), [
    { texto: '‹', href: '#mapa/guadarrama', aria: 'Volver a Guadarrama', subir: true },
    { texto: 'Guadarrama', href: '#mapa/guadarrama' },
    { texto: 'Valsaín', href: '#mapa/guadarrama/valsain' }]);
  assert.equal(rutaSubir({ zona: guad, punto: guad.puntos[0] }), '#mapa/guadarrama');
  assert.equal(rutaSubir({ zona: guad, punto: null }), '#mapa');
});

test('rutaNormal: la portada sin hash y #hoy son #mapa; las demás, tal cual las escribe rutaMapa', () => {
  assert.equal(rutaNormal(''), '#mapa');
  assert.equal(rutaNormal('#hoy'), '#mapa');
  assert.equal(rutaNormal('#mapa/guadarrama'), '#mapa/guadarrama');
  assert.equal(rutaNormal('#mapa/guadarrama/valsain'), '#mapa/guadarrama/valsain');
});

test('estadoHistorial: solo marca una entrada nueva (sin estado) y recuerda de qué ruta del mapa se llegó', () => {
  assert.deepEqual(estadoHistorial({ estado: null, ruta: '#mapa/guadarrama', anterior: '#mapa' }), { setas: true, ruta: '#mapa/guadarrama', anterior: '#mapa' });
  assert.deepEqual(estadoHistorial({ estado: null, ruta: '#mapa', anterior: null }), { setas: true, ruta: '#mapa', anterior: null });
  // al volver atrás a una entrada ya marcada no se pisa su «anterior» con la ruta de la que se viene
  assert.equal(estadoHistorial({ estado: { setas: true, ruta: '#mapa/guadarrama', anterior: '#mapa' }, ruta: '#mapa/guadarrama', anterior: '#mapa/guadarrama/valsain' }), null);
  // una entrada con estado ajeno tampoco se toca
  assert.equal(estadoHistorial({ estado: { otro: 1 }, ruta: '#mapa', anterior: null }), null);
});

test('volverConAtras: «‹» usa el atrás del historial solo si la entrada anterior es justo el destino', () => {
  assert.equal(volverConAtras({ setas: true, ruta: '#mapa/guadarrama/valsain', anterior: '#mapa/guadarrama' }, '#mapa/guadarrama'), true);
  assert.equal(volverConAtras({ setas: true, ruta: '#mapa/guadarrama/valsain', anterior: '#mapa' }, '#mapa/guadarrama'), false);   // se llegó desde el buscador
  assert.equal(volverConAtras({ setas: true, ruta: '#mapa/guadarrama', anterior: null }, '#mapa'), false);   // se entró directo con el enlace
  assert.equal(volverConAtras(null, '#mapa'), false);
});

test('zonasQueCortan: las zonas cuyo bbox toca la vista [o, s, e, n]', () => {
  assert.deepEqual(zonasQueCortan(zonas, [-4.0, 40.8, -3.9, 40.9]).map((z) => z.id), ['guadarrama']);
  assert.deepEqual(zonasQueCortan(zonas, [-5, 40, -3, 44]).map((z) => z.id), ['guadarrama', 'merindades']);
  assert.deepEqual(zonasQueCortan(zonas, [0, 0, 1, 1]), []);
});

test('filasZonas: con d válido, las de calcularZona ordenadas; con d null o sin meteo, «sin datos», nunca la nota de otro día', () => {
  const z = { id: 'z', nombre: 'Z', habitats: ['pinar-silvestre'], puntos: [{ id: 'p1', habitat: 'pinar-silvestre', lat: 1, lon: 1 }] };
  const vacia = { id: 'v', nombre: 'V', habitats: ['pinar-silvestre'], puntos: [{ id: 'p9', habitat: 'pinar-silvestre', lat: 1, lon: 1 }] };
  const datos = { ...datosNota, zonas: [vacia, z] };
  const meteo = { hoy: '2026-10-18', series: { p1: serieSintetica({ precip: lluviaBuena }) } };
  const con = filasZonas({ datos, meteo, d: 0, filtro: null });
  assert.deepEqual(con.map((f) => f.zona.id), ['z', 'v']);
  assert.equal(con[0].res.valor, calcularZona(z, datos, meteo, 0, null).res.valor);
  assert.ok(con[0].res.valor != null);
  const fuera = filasZonas({ datos, meteo, d: null, filtro: null });
  assert.ok(fuera.every((f) => f.res.valor == null && f.mejor == null));
  assert.equal(fuera.find((f) => f.zona.id === 'z').motivo, MOTIVO_FUERA_DE_PREVISION);
  const sinMeteo = filasZonas({ datos, meteo: null, d: 0, filtro: null });
  assert.ok(sinMeteo.every((f) => f.res.valor == null));
});

test('filtroDeChip: el conjunto de especies del chip; «Mejor hoy» o chip desconocido, sin filtro', () => {
  const chips = [{ id: 'mejor', especies: null }, { id: 'boletus', especies: ['a', 'b'] }];
  assert.deepEqual(filtroDeChip(chips, 'boletus'), new Set(['a', 'b']));
  assert.equal(filtroDeChip(chips, 'mejor'), null);
  assert.equal(filtroDeChip(chips, 'otro'), null);
});

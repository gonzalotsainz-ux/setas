// tests/mapa-contenido-hoja.test.js — qué enseña la hoja fija según la selección (decisiones 13, 14 y 15).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contenidoHoja, COTO_COMPROBANDO, COTO_SIN_CARGAR } from '../js/mapa/contenido-hoja.js';
import { filasZonas } from '../js/mapa/seleccion.js';
import { serieSintetica, BOLETUS as B0, lluviaBuena } from './ayudas.js';

const BOLETUS = { ...B0, habitats: ['pinar-silvestre'], categoria: 'comestible', zonas: { z: { presencia: 'si' } }, nombre: 'Boletus edulis', comunes: { es: ['hongo blanco'] } };
const punto = { id: 'p1', corto: 'Valsaín', nombre: 'Pinar de Valsaín (Segovia)', habitat: 'pinar-silvestre', lat: 40.85, lon: -4.03 };
const z = { id: 'z', nombre: 'Guadarrama (Madrid)', habitats: ['pinar-silvestre'], bbox: [-4.2, 40.7, -3.6, 41.0], puntos: [punto] };
const lejos = { id: 'lejos', nombre: 'Álava', habitats: ['pinar-silvestre'], bbox: [-3, 42.5, -2.5, 43], puntos: [{ id: 'p9', corto: 'Gorbeia', nombre: 'Gorbeia', habitat: 'pinar-silvestre', lat: 42.9, lon: -2.8 }] };
const datos = { especies: [BOLETUS], porId: { [BOLETUS.id]: BOLETUS }, zonas: [z, lejos] };
const meteo = { hoy: '2026-10-18', series: { p1: serieSintetica({ precip: lluviaBuena }) } };
const notasCon = (d) => ({ filas: filasZonas({ datos, meteo, d, filtro: null }), d, filtro: null });
const base = { datos, meteo, fecha: '2026-10-18', hoy: '2026-10-18' };

test('sin selección, «Dónde ir» con todas las zonas; con zona, la zona y sus montes; con monte, su ficha', () => {
  const lista = contenidoHoja({ ...base, sel: { zona: null, punto: null }, notas: notasCon(0) }).modelo;
  assert.equal(lista.tipo, 'listaZonas');
  assert.equal(lista.filas.length, 2);
  const zona = contenidoHoja({ ...base, sel: { zona: z, punto: null }, notas: notasCon(0) }).modelo;
  assert.equal(zona.tipo, 'zona');
  assert.deepEqual(zona.montes.map((m) => m.id), ['p1']);
  assert.equal(zona.montes[0].valor, zona.valor);   // un solo monte: la nota de la zona es la suya
  const { modelo, extra } = contenidoHoja({ ...base, sel: { zona: z, punto }, notas: notasCon(0), cotos: new Map([['p1', null]]) });
  assert.equal(modelo.tipo, 'monte');
  assert.ok(modelo.valor != null);
  assert.equal(typeof extra.desglose, 'function');
  assert.equal(typeof extra.grafico, 'function');
});

test('con la fecha fuera de la meteo (d null), ni la zona ni el monte llevan nota de otro día', () => {
  const zona = contenidoHoja({ ...base, sel: { zona: z, punto: null }, notas: notasCon(null) }).modelo;
  assert.equal(zona.valor, null);
  assert.ok(zona.montes.every((m) => m.valor == null));
  const monte = contenidoHoja({ ...base, sel: { zona: z, punto }, notas: notasCon(null), cotos: new Map() }).modelo;
  assert.equal(monte.valor, null);
  assert.match(monte.texto, /fuera de la previsión/);
});

test('ficha del monte: sin cotos cargados no se afirma que esté fuera de ellos', () => {
  const sin = contenidoHoja({ ...base, sel: { zona: z, punto }, notas: notasCon(0), cotos: null }).modelo;
  assert.equal(sin.coto.texto, COTO_COMPROBANDO);
  const fallo = contenidoHoja({ ...base, sel: { zona: z, punto }, notas: notasCon(0), cotos: 'error' }).modelo;
  assert.equal(fallo.coto.texto, COTO_SIN_CARGAR);
  const con = contenidoHoja({ ...base, sel: { zona: z, punto }, notas: notasCon(0), cotos: new Map([['p1', { nombre: 'Valsaín', tipo: 'acotado' }]]) }).modelo;
  assert.equal(con.coto.texto, 'Valsaín: pide permiso.');
});

test('lugar fuera de las zonas: aviso con las zonas más cercanas, aunque haya una zona elegida', () => {
  const m = contenidoHoja({ ...base, sel: { zona: z, punto: null }, fuera: { nombre: 'Sevilla', lat: 37.38, lon: -5.97 }, notas: notasCon(0) }).modelo;
  assert.equal(m.tipo, 'fuera');
  assert.equal(m.titulo, 'Sevilla');
  assert.deepEqual(m.filas.map((f) => f.id).sort(), ['lejos', 'z']);
});

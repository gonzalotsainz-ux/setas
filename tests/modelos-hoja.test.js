// tests/modelos-hoja.test.js — modelos de la hoja del mapa: datos puros, sin DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tituloDia, modeloListaZonas, modeloZona, modeloMonte, modeloFueraDeZonas } from '../js/mapa/modelos-hoja.js';
import { urlComoLlegar } from '../js/mapa/hoja.js';

const nbsp = ' ';
const boletus = { id: 'boletus-edulis', nombre: 'Boletus edulis', comunes: { es: ['hongo blanco'] } };
const niscalo = { id: 'lactarius-deliciosus', nombre: 'Lactarius deliciosus', comunes: { es: ['níscalo'] } };
const datos = { especies: [boletus, niscalo], porId: { [boletus.id]: boletus, [niscalo.id]: niscalo } };
const resultado = (confianza = 'alta') => ({ confianza, etiqueta: 'muy bueno', explicacion: ['x'], datos: { P26: 48.4, P3: 12, lag: 3, T20: 11.2 } });
const fila = (id, nombre, valor, extra = {}) => ({
  zona: { id, nombre },
  res: { valor, fueraDeTemporada: false, incompleta: false, faltan: [], especies: [] },
  mejor: valor == null ? null : { id: boletus.id, resultado: resultado() },
  incierta: false, discrepa: false, rotulo: null, motivo: 'Sin datos de lluvia.', ...extra,
});
const guadarrama = fila('guadarrama', 'Guadarrama (Sierra de Madrid)', 82);
const soria = fila('soria', 'Soria (Pinares)', 55);

test('tituloDia: hoy, mañana y día de la semana con número', () => {
  assert.equal(tituloDia('2026-10-21', '2026-10-21'), 'hoy');
  assert.equal(tituloDia('2026-10-22', '2026-10-21'), 'mañana');
  assert.equal(tituloDia('2026-10-23', '2026-10-21'), 'el viernes 23');
});

test('modeloListaZonas: filas ordenadas con enlace a su zona, nota o sin datos, y aviso con meteo caducada', () => {
  const sinDatos = fila('gredos', 'Gredos (Ávila)', null);
  const m = modeloListaZonas({ filas: [sinDatos, soria, guadarrama], datos, fecha: '2026-10-21', hoy: '2026-10-21', caducado: false });
  assert.equal(m.tipo, 'listaZonas');
  assert.equal(m.titulo, 'Dónde ir hoy');
  assert.equal(m.corto, 'Dónde ir hoy · 3 zonas');
  assert.equal(m.aviso, null);
  assert.deepEqual(m.filas.map((f) => [f.pos, f.id, f.nombre, f.valor, f.nivel]),
    [[1, 'guadarrama', 'Guadarrama', 82, 'muy-bueno'], [2, 'soria', 'Soria', 55, 'posible'], [3, 'gredos', 'Gredos', null, 'sin-datos']]);
  assert.equal(m.filas[0].href, '#mapa/guadarrama');
  assert.deepEqual(m.filas[0].etiquetas, [{ texto: 'Confianza alta', variante: null }]);
  assert.equal(m.filas[0].frase[0].texto, `48${nbsp}mm`);   // datos de fraseZona, no nodos
  assert.deepEqual(m.filas[2].frase, [{ texto: 'Sin datos de lluvia.', estilo: null }]);
  const c = modeloListaZonas({ filas: [guadarrama], datos, fecha: '2026-10-23', hoy: '2026-10-21', caducado: true });
  assert.equal(c.titulo, 'Dónde ir el viernes 23');
  assert.equal(c.corto, 'Dónde ir el viernes 23 · 1 zona');
  assert.equal(c.aviso, 'Con los últimos datos, del 23 de octubre');
  assert.deepEqual(c.filas[0].etiquetas.map((e) => e.texto), ['Confianza alta', 'Previsión']);
});

test('modeloListaZonas: etiquetas de incompleta, incierta, discrepancia y rótulo del punto', () => {
  const f = fila('z', 'Z', 60, { incierta: true, discrepa: true, rotulo: { texto: 'Restricciones', variante: 'ocre' },
    res: { valor: 60, fueraDeTemporada: false, incompleta: true, faltan: ['a', 'b'], especies: [] } });
  const [r] = modeloListaZonas({ filas: [f], datos, fecha: '2026-10-21', hoy: '2026-10-21' }).filas;
  assert.deepEqual(r.etiquetas, [
    { texto: 'Confianza alta', variante: null }, { texto: '2 especies sin datos suficientes', variante: 'ocre' },
    { texto: 'Previsión incierta', variante: 'ocre' }, { texto: 'Estación y modelo no coinciden', variante: 'ocre' }, { texto: 'Restricciones', variante: 'ocre' }]);
});

const montePrimero = { id: 'p-a', nombre: 'Pinar A (Real Sitio)', corto: 'Pinar A', proteccion: 'Parque Nacional: recolección solo con permiso (Orden X).' };
const monteSegundo = { id: 'p-b', nombre: 'Hayedo B', corto: 'Hayedo B', proteccion: null };
const monteSin = { id: 'p-c', nombre: 'Sin serie', corto: 'Sin serie' };
const monteNoIr = { id: 'p-d', nombre: 'Prohibido D', corto: 'Prohibido D', noIr: true, proteccion: 'Sin confirmar: NO IR.' };
const nota = (valor, mejor = boletus) => ({ valor, nivel: 'x', etiqueta: 'e', mejor: valor == null ? null : { id: mejor.id, especie: mejor, resultado: resultado() },
  especies: valor == null ? [] : [{ id: mejor.id, valor }, { id: niscalo.id, valor: 61 }], fueraDeTemporada: false, incompleta: false, faltan: [],
  motivo: valor == null ? 'No hay datos meteorológicos de este punto. No se calcula nota.' : null });

test('modeloZona: montes con nota primero, luego sin datos, luego NO IR; detalle a #zona/<id>', () => {
  const m = modeloZona({ fila: guadarrama, datos, d: 0, fecha: '2026-10-21', hoy: '2026-10-21',
    montes: [{ punto: monteNoIr, nota: nota(70) }, { punto: monteSin, nota: nota(null) },
      { punto: monteSegundo, nota: nota(40), coto: { nombre: 'Coto B', tipo: 'regulado' } }, { punto: montePrimero, nota: nota(90) }] });
  assert.equal(m.tipo, 'zona');
  assert.equal(m.id, 'guadarrama');
  assert.equal(m.titulo, 'Guadarrama');
  assert.equal(m.corto, 'Guadarrama · Muy bueno 82');
  assert.equal(m.detalle, '#zona/guadarrama');
  assert.equal(m.valor, 82);
  assert.deepEqual(m.montes.map((x) => x.id), ['p-a', 'p-b', 'p-c', 'p-d']);
  assert.equal(m.montes[0].nombre, 'Pinar A');
  assert.equal(m.montes[0].href, '#mapa/guadarrama/p-a');
  assert.equal(m.montes[0].nivel, 'muy-bueno');
  assert.match(m.montes[0].linea, /^hongo blanco · Parque Nacional/);
  assert.equal(m.montes[1].linea, 'hongo blanco · Coto B');
  assert.equal(m.montes[2].valor, null);
  assert.equal(m.montes[2].nivel, 'sin-datos');
  assert.deepEqual(m.montes[3].rotulo, { texto: 'NO IR (solo meteo)', variante: 'peligro' });
  assert.equal(m.montes[0].rotulo.texto, 'Restricciones');
});

test('modeloMonte: especie, también, porqué, día de previsión y tres acciones (Más con el punto)', () => {
  const zona = { id: 'guadarrama' };
  const punto = { id: 'guadarrama-valsain-pinar', nombre: 'Pinar de Valsaín (Real Sitio de San Ildefonso)', lat: 40.853, lon: -3.9943,
    proteccion: 'Recolección solo con permiso de Valsaín.' };
  const m = modeloMonte({ zona, punto, nota: nota(82), datos, d: 2, coto: { nombre: 'Valsaín', tipo: 'acotado', permisoUrl: 'https://x.es/p' } });
  assert.equal(m.tipo, 'monte');
  assert.equal(m.id, 'guadarrama-valsain-pinar');
  assert.equal(m.zona, 'guadarrama');
  assert.equal(m.titulo, 'Pinar de Valsaín');
  assert.equal(m.corto, 'Pinar de Valsaín · 82');
  assert.equal(m.valor, 82);
  assert.equal(m.nivel, 'muy-bueno');
  assert.deepEqual(m.especie, { nombre: 'hongo blanco', latin: 'Boletus edulis' });
  assert.equal(m.tambien, 'níscalo (61)');
  assert.equal(m.porque, `48${nbsp}mm en 26 días, lo más fuerte hace 3 días · 11${nbsp}°C de media`);
  assert.equal(m.dia, 'Previsión a +2 días');
  assert.deepEqual(m.coto, { texto: 'Valsaín: pide permiso.', url: 'https://x.es/p' });
  assert.deepEqual(m.avisos, [{ texto: 'Recolección solo con permiso de Valsaín.', peligro: true }]);
  assert.deepEqual(m.acciones, {
    comoLlegar: urlComoLlegar(40.853, -3.9943),
    diario: '#diario/nueva?lat=40.85300&lon=-3.99430&zona=guadarrama&punto=guadarrama-valsain-pinar',
    mas: '#zona/guadarrama/guadarrama-valsain-pinar' });
  assert.equal(modeloMonte({ zona, punto, nota: nota(82), datos, d: 0, coto: null }).dia, null);
  assert.equal(modeloMonte({ zona, punto, nota: nota(82), datos, d: 1, coto: null }).dia, 'Previsión a +1 día');
});

test('modeloMonte sin nota: valor null y motivo, sin nivel inventado', () => {
  const zona = { id: 'guadarrama' };
  const punto = { id: 'p', nombre: 'Monte sin serie', lat: 40.1, lon: -3.1 };
  const m = modeloMonte({ zona, punto, nota: nota(null), datos, d: 0, coto: null });
  assert.equal(m.valor, null);
  assert.equal(m.nivel, 'sin-datos');
  assert.equal(m.texto, 'No hay datos meteorológicos de este punto. No se calcula nota.');
  assert.equal(m.especie, null);
  assert.equal(m.tambien, null);
  assert.equal(m.porque, null);
  assert.equal(m.corto, 'Monte sin serie · sin datos');
  assert.deepEqual(m.avisos, []);
});

test('modeloFueraDeZonas: título, texto fijo y las zonas más cercanas', () => {
  const filas = modeloListaZonas({ filas: [guadarrama], datos, fecha: '2026-10-21', hoy: '2026-10-21' }).filas;
  const m = modeloFueraDeZonas({ nombre: 'Torrelodones', cercanas: filas });
  assert.deepEqual({ ...m, filas: undefined }, { tipo: 'fuera', titulo: 'Torrelodones', corto: 'Torrelodones',
    texto: 'La app no tiene datos de monte aquí. Las zonas más cercanas:', filas: undefined });
  assert.equal(m.filas, filas);
});

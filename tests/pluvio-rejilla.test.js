// tests/pluvio-rejilla.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar } from '../supabase/functions/rejilla/manejador.js';
import { factoresPorZona } from '../supabase/functions/rejilla/nucleo.js';
import { validarSalida, serieLluvia } from '../js/rejilla/salida.js';
import { VERSION_PLUVIO } from '../supabase/functions/_shared/pluvio.js';
import { entreDias } from '../js/meteo.js';
import { openMeteoFalso, almacenMemoria } from './dobles-rejilla.js';
import { serieSintetica } from './ayudas.js';

const MANANA = new Date('2026-10-01T05:00:00Z');   // 07:00 en Madrid
const gruesa = (n) => ({ celdas: Array.from({ length: n }, (_, k) => ({ id: `z:${k}:0`, zona: 'z', lat: 40 + k * 0.01, lon: -4, altRef: 1000 + k })) });
const DESDE = '2026-08-01', HASTA = '2026-09-30', LARGO = entreDias(DESDE, HASTA) + 1;
const pluvioCon = (lugares, extra = {}) => ({ version: VERSION_PLUVIO, generado: '2026-10-01T04:10:00.000Z', desde: DESDE, hasta: HASTA, lugares, ...extra });
const seco = (nombre = 'Covaleda', ultimo = HASTA) => ({ mm: Array(LARGO).fill(0), n: Array(LARGO).fill(1), estaciones: [{ nombre, fuente: 'duero', km: 2, ultimo }], cercanas: 1 });
const r1 = (x) => Math.round(x * 10) / 10;
async function indice(archivoPluvio) {
  const almacen = almacenMemoria();
  if (archivoPluvio !== undefined) almacen.archivos.set('pluvio/celdas.json', archivoPluvio);
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(3), esperar: async () => {}, trozo: 5 });
  assert.equal(r.estado, 'publicado');
  assert.ok(almacen.archivos.has('pluvio/celdas.json') === (archivoPluvio !== undefined), 'la limpieza de rejilla no borra pluvio/');
  return almacen.archivos.get('2026-10-01T07.json');
}

test('equivalencia: sin pluvio/celdas.json (o con uno que no valida, viejo o del futuro) el índice es el de siempre', async () => {
  const sin = await indice();
  assert.deepEqual(Object.keys(sin.celdas['z:0:0'].lluvia).sort(), ['desde', 'hoy', 'mm']);
  assert.deepEqual((await indice(pluvioCon({}, { version: 2 }))).celdas, sin.celdas);
  assert.deepEqual((await indice({ basura: true })).celdas, sin.celdas);
  // Más de 36 h: la función «pluvio» dejó de publicar; mejor el modelo que una medida que no llega a los últimos días.
  assert.deepEqual((await indice(pluvioCon({ 'z:0:0': seco() }, { generado: '2026-09-29T16:59:00.000Z' }))).celdas, sin.celdas);
  assert.deepEqual((await indice(pluvioCon({ 'z:0:0': seco() }, { generado: 'ayer' }))).celdas, sin.celdas);
  // Posterior a la ejecución (más de 10 min): un reloj o un archivo mal fechado.
  assert.deepEqual((await indice(pluvioCon({ 'z:0:0': seco() }, { generado: '2026-10-01T06:00:00.000Z' }))).celdas, sin.celdas);
});

test('con archivo pero sin estaciones en la zona: las notas no cambian y la lluvia dice que es del modelo', async () => {
  const sin = await indice(), con = await indice(pluvioCon({}));
  for (const id of Object.keys(sin.celdas)) {
    assert.deepEqual(con.celdas[id].dias, sin.celdas[id].dias, id);
    assert.deepEqual(con.celdas[id].lluvia.mm, sin.celdas[id].lluvia.mm, id);
    assert.ok(con.celdas[id].lluvia.origen.every((o) => o === 0), id);
    assert.deepEqual(con.celdas[id].lluvia.estaciones, []);
    assert.equal(con.celdas[id].lluvia.cercanas, 0);
  }
  assert.deepEqual(validarSalida(con), []);
});

test('con lluvia medida en una sola estación de la zona: la celda pasa a medida y las demás siguen con el modelo', async () => {
  const sin = await indice(), con = await indice(pluvioCon({ 'z:0:0': seco() }));
  const a = con.celdas['z:0:0'], b = con.celdas['z:1:0'], h = a.lluvia.hoy;
  assert.ok(a.lluvia.mm.slice(0, h).every((v) => v === 0));
  assert.ok(b.lluvia.origen.every((o) => o === 0), 'sin 2 estaciones no hay factor de zona');
  assert.deepEqual(b.lluvia.mm, sin.celdas['z:1:0'].lluvia.mm);
  assert.deepEqual(b.dias, sin.celdas['z:1:0'].dias);
});

test('con lluvia medida en dos estaciones: sus celdas pasan a medida y las demás de la zona, a estimada con el sesgo', async () => {
  const sin = await indice(), con = await indice(pluvioCon({ 'z:0:0': seco(), 'z:2:0': seco('Duruelo') }));
  const a = con.celdas['z:0:0'], b = con.celdas['z:1:0'], h = a.lluvia.hoy;
  assert.equal(h, 59);
  assert.ok(a.lluvia.mm.slice(0, h).every((v) => v === 0), 'del 03/08 a ayer, lo medido');
  assert.deepEqual([a.lluvia.origen[h - 1], a.lluvia.origen[h]], [1, 0]);   // ayer medido; hoy, del modelo
  assert.deepEqual(a.lluvia.estaciones, ['Covaleda']);
  assert.ok(a.dias[0][0] < sin.celdas['z:0:0'].dias[0][0], 'menos lluvia en 26 días');
  // La zona midió 0 frente a un modelo con lluvia: cociente (0 + 5)/(modelo + 5) → acotado a 0,67 en las celdas sin estación.
  assert.equal(b.lluvia.origen[h - 1], 2);
  assert.equal(b.lluvia.mm[h - 1], r1(sin.celdas['z:1:0'].lluvia.mm[h - 1] * 0.67));
  // Revisión final 3: el factor va en el índice para que la hoja lo diga.
  assert.equal(b.lluvia.factor, 0.67);
  assert.equal(a.lluvia.factor, 0.67);
  assert.deepEqual([b.lluvia.estaciones, b.lluvia.aportan], [[], 0]);
  assert.deepEqual(validarSalida(con), []);
});

// Revisión final 2: la hoja nombra solo las estaciones que aportaron en los 26 días de la ventana (del 06/09 al 01/10).
test('el índice nombra solo las estaciones que aportaron en la ventana; un pluvio/celdas.json sin `ultimo`, ninguna', async () => {
  const varias = { ...seco(), estaciones: [
    { nombre: 'Navarrete', fuente: 'euskalmet', km: 5.5, ultimo: '2026-08-20' }, { nombre: 'Kapildui', fuente: 'euskalmet', km: 10.2, ultimo: '2026-09-05' },
    { nombre: 'Campezo', fuente: 'euskalmet', km: 12.2, ultimo: '2026-09-30' }, { nombre: 'Arkauti', fuente: 'euskalmet', km: 14, ultimo: '2026-09-06' },
    { nombre: 'Gasteiz', fuente: 'euskalmet', km: 15.2, ultimo: '2026-09-12' }, { nombre: 'Agurain', fuente: 'euskalmet', km: 19.7, ultimo: '2026-09-29' }], cercanas: 9 };
  const con = await indice(pluvioCon({ 'z:0:0': varias }));
  const l = con.celdas['z:0:0'].lluvia;
  assert.deepEqual([l.estaciones, l.km, l.aportan, l.cercanas], [['Campezo', 'Arkauti', 'Gasteiz'], [12.2, 14, 15.2], 4, 9]);
  assert.deepEqual(validarSalida(con), []);
  const viejo = (await indice(pluvioCon({ 'z:0:0': { ...varias, estaciones: varias.estaciones.map(({ ultimo, ...e }) => e) } }))).celdas['z:0:0'].lluvia;
  assert.deepEqual([viejo.estaciones, viejo.km, 'aportan' in viejo], [[], [], false]);
});

test('factoresPorZona: cada estación de la zona cuenta una vez por fecha; con una sola estación, sin factor', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: () => 2 });
  const m = (mm, nombre) => ({ mm: Array(LARGO).fill(mm), n: Array(LARGO).fill(1), estaciones: [{ nombre, fuente: 'tajo', km: 3 }], cercanas: 1 });
  const celdas = [['x1', 'a'], ['x2', 'a'], ['x3', 'a'], ['w', 'a'], ['y', 'b'], ['y2', 'b']].map(([id, zona]) => ({ id, zona }));
  const series = new Map(celdas.map((c) => [c.id, s]));
  // Zona a: la estación A cubre tres celdas (4 mm/día) y B una (2 mm/día); por fecha (4 + 2)/2 = 3 frente a 2 del modelo:
  // (90 + 5)/(60 + 5) = 1,46. Contando por celda saldría (3,5 × 30 + 5)/65 = 1,69 → 1,5.
  // Zona b: dos celdas, pero la misma estación → sin factor.
  const f = factoresPorZona(celdas, series, pluvioCon({ x1: m(4, 'A'), x2: m(4, 'A'), x3: m(4, 'A'), w: m(2, 'B'), y: m(3, 'C'), y2: m(3, 'C') }));
  assert.deepEqual([...f], [['a', 1.46]]);
});

test('serieLluvia trae el origen de cada día si la celda lo tiene; validarSalida lo comprueba', () => {
  const lluvia = { desde: '2026-09-29', hoy: 1, mm: [1, 2, 3] };
  assert.equal(serieLluvia({ lluvia }).origenPrecip, undefined);
  assert.deepEqual(serieLluvia({ lluvia: { ...lluvia, origen: [1, 2, 0] } }).origenPrecip, ['medida', 'estimada', 'modelo']);
  const salida = (l) => ({ version: 1, sello: '2026-09-30T07', fechas: ['2026-09-30'], hoy: '2026-09-30', celdas: { c: { altRef: 1000, dias: [null], lluvia: l } } });
  assert.deepEqual(validarSalida(salida({ ...lluvia, origen: [1, 2, 0], estaciones: ['A'], cercanas: 1 })), []);
  assert.deepEqual(validarSalida(salida({ ...lluvia, origen: [1, 2] })), ['celda c mal formada']);
  assert.deepEqual(validarSalida(salida({ ...lluvia, origen: [1, 2, 3] })), ['celda c mal formada']);
  assert.deepEqual(validarSalida(salida({ ...lluvia, estaciones: [7] })), ['celda c mal formada']);
});

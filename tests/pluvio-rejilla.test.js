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
const seco = () => ({ mm: Array(LARGO).fill(0), n: Array(LARGO).fill(1), estaciones: [{ nombre: 'Covaleda', fuente: 'duero', km: 2 }], cercanas: 1 });
async function indice(archivoPluvio) {
  const almacen = almacenMemoria();
  if (archivoPluvio !== undefined) almacen.archivos.set('pluvio/celdas.json', archivoPluvio);
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(3), esperar: async () => {}, trozo: 5 });
  assert.equal(r.estado, 'publicado');
  assert.ok(almacen.archivos.has('pluvio/celdas.json') === (archivoPluvio !== undefined), 'la limpieza de rejilla no borra pluvio/');
  return almacen.archivos.get('2026-10-01T07.json');
}

test('equivalencia: sin pluvio/celdas.json (o con uno que no valida o viejo) el índice es el de siempre', async () => {
  const sin = await indice();
  assert.deepEqual(Object.keys(sin.celdas['z:0:0'].lluvia).sort(), ['desde', 'hoy', 'mm']);
  assert.deepEqual((await indice(pluvioCon({}, { version: 2 }))).celdas, sin.celdas);
  assert.deepEqual((await indice({ basura: true })).celdas, sin.celdas);
  // Más de 36 h: la función «pluvio» dejó de publicar; mejor el modelo que una medida que no llega a los últimos días.
  assert.deepEqual((await indice(pluvioCon({ 'z:0:0': seco() }, { generado: '2026-09-29T16:59:00.000Z' }))).celdas, sin.celdas);
  assert.deepEqual((await indice(pluvioCon({ 'z:0:0': seco() }, { generado: 'ayer' }))).celdas, sin.celdas);
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

test('con lluvia medida en una celda: la suya pasa a medida y las demás de la zona, a estimada con el sesgo', async () => {
  const sin = await indice(), con = await indice(pluvioCon({ 'z:0:0': seco() }));
  const a = con.celdas['z:0:0'], b = con.celdas['z:1:0'], h = a.lluvia.hoy;
  assert.equal(h, 59);
  assert.ok(a.lluvia.mm.slice(0, h).every((v) => v === 0), 'del 03/08 a ayer, lo medido');
  assert.deepEqual([a.lluvia.origen[h - 1], a.lluvia.origen[h]], [1, 0]);   // ayer medido; hoy, del modelo
  assert.deepEqual(a.lluvia.estaciones, ['Covaleda']);
  assert.ok(a.dias[0][0] < sin.celdas['z:0:0'].dias[0][0], 'menos lluvia en 26 días');
  // La zona midió 0 frente a un modelo con lluvia: cociente (0 + 5)/(modelo + 5) → acotado a 0,5 en las celdas sin estación.
  assert.equal(b.lluvia.origen[h - 1], 2);
  assert.equal(b.lluvia.mm[h - 1], sin.celdas['z:1:0'].lluvia.mm[h - 1] * 0.5);
  assert.deepEqual(validarSalida(con), []);
});

test('factoresPorZona: con los pares medido/modelo de las celdas con estación de cada zona', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: () => 2 });
  const m = { mm: Array(LARGO).fill(3), n: Array(LARGO).fill(1), estaciones: [], cercanas: 1 };
  const f = factoresPorZona([{ id: 'x', zona: 'a' }, { id: 'y', zona: 'b' }], new Map([['x', s], ['y', s]]), pluvioCon({ x: m }));
  // Sesgo suavizado (ruling de la tarea 9): 30 días de 3 mm medidos frente a 2 del modelo → (90 + 5)/(60 + 5) = 1,46.
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

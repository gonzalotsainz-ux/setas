// tests/pluvio-jucar.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlDiaJucar, filasDeDiaJucar, estacionesDeJucar, fechasJucar, leerJucar } from '../supabase/functions/pluvio/lectores/jucar.js';
import { crearPedir } from '../supabase/functions/pluvio/red.js';
import { ejecutar, fuentesQueTocan } from '../supabase/functions/pluvio/manejador.js';
import { fixture, fixtureJson, respuesta, servidorFalso, almacenPluvioMemoria } from './dobles-pluvio.js';

const sinEspera = async () => {};
const rutasJucar = [
  [(u) => u === urlDiaJucar('2026-09-30'), () => respuesta(200, fixture('jucar-2026-09-30.json'))],
  [(u) => u === urlDiaJucar('2026-10-01'), () => respuesta(503, 'ocupado')],
  [(u) => u.includes('/lluviasIntervalo/'), () => respuesta(200, fixture('jucar-2026-10-02.json'))],
];

test('un día del SAIH Júcar: total diario por estación, apuntado al fin del día de Madrid y redondeado', () => {
  const filas = filasDeDiaJucar(fixtureJson('jucar-2026-09-30.json'), '2026-09-30', new Set(['5N02', '4N05', '6P01']))
    .sort((a, b) => a.estacion.localeCompare(b.estacion));
  assert.deepEqual(filas, [
    { estacion: '4N05', hora: '2026-09-30T22:00:00.000Z', horas: 24, mm: 0 },
    { estacion: '5N02', hora: '2026-09-30T22:00:00.000Z', horas: 24, mm: 0 },
    { estacion: '6P01', hora: '2026-09-30T22:00:00.000Z', horas: 24, mm: 1.6 }]);
  assert.deepEqual(filasDeDiaJucar(fixtureJson('jucar-2026-10-02.json'), '2026-10-02', new Set(['5N02'])), []);   // hoy: vacío
});

test('listado del Júcar: código, nombre y UTM 30 (los campos «Lat» y «Lon» son X e Y)', () => {
  const l = estacionesDeJucar(fixtureJson('jucar-2026-09-30.json'));
  assert.equal(l.length, 22);
  assert.deepEqual(l.find((e) => e.codigo === '5N02'), { codigo: '5N02', nombre: 'CUERDA', x: 615422.0231001107, y: 4422197.005116356, provincia: 'Cuenca' });
});

test('qué días pedir: ayer y anteayer siempre; después, los que faltan desde el 1 de agosto, hasta 20', () => {
  const f = fechasJucar('2026-10-02', new Set(['2026-10-01', '2026-09-30', '2026-08-01']));
  assert.equal(f.length, 20);
  assert.deepEqual(f.slice(0, 4), ['2026-10-01', '2026-09-30', '2026-08-02', '2026-08-03']);
  assert.equal(f.at(-1), '2026-08-19');
  const todos = new Set(Array.from({ length: 62 }, (_, k) => new Date(Date.UTC(2026, 7, 1 + k)).toISOString().slice(0, 10)));
  assert.deepEqual(fechasJucar('2026-10-02', todos), ['2026-10-01', '2026-09-30']);
});

test('leerJucar: un día que falla es un error de ese día y se sigue', async () => {
  const r = await leerJucar({ pedir: crearPedir({ fetchFn: servidorFalso(rutasJucar), esperar: sinEspera }),
    estaciones: [{ codigo: '6P01' }], fechas: ['2026-10-01', '2026-09-30'] });
  assert.deepEqual(r.errores, ['2026-10-01: saih.chj.es respondió 503']);
  assert.deepEqual(r.filas, [{ estacion: '6P01', hora: '2026-09-30T22:00:00.000Z', horas: 24, mm: 1.6 }]);
});

test('qué toca: Júcar a las 3 y 15 UTC, una hora antes de publicar', () => {
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T03:10:00Z')), ['aemet', 'duero', 'jucar']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T15:10:00Z')), ['aemet', 'duero', 'jucar']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T04:10:00Z')), ['tajo', 'publicar']);
});

test('ejecutar: Júcar rellena días que faltan y el total diario cuenta como día completo', async () => {
  const almacen = almacenPluvioMemoria(), registro = [];
  const est = [{ fuente: 'jucar', codigo: '6P01' }];
  const r = await ejecutar({ almacen, fetchFn: servidorFalso(rutasJucar, registro), esperar: sinEspera, ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: est, pedidas: ['jucar', 'publicar'] });
  assert.equal(registro.length, 21);   // 20 días (ayer, anteayer y 18 de agosto) + el reintento del 503
  assert.deepEqual(r.filas, { jucar: 1 });
  assert.deepEqual(r.errores, ['jucar: 2026-10-01: saih.chj.es respondió 503']);
  assert.deepEqual({ ...almacen.dias.get('jucar|6P01|2026-09-30'), actualizado: null },
    { fuente: 'jucar', estacion: '6P01', fecha: '2026-09-30', mm: 1.6, horas: 24, maximo: null, calidad: 'ok', motivo: null, actualizado: null });
});

const pedirCon = (rutas) => crearPedir({ fetchFn: servidorFalso(rutas), esperar: sinEspera });

test('respuesta que no es la esperada: error del día («formato inesperado») y se sigue', async () => {
  for (const cuerpo of [{}, [{ foo: 1 }], null, 'texto']) {
    const rutas = [[(u) => u === urlDiaJucar('2026-10-01'), () => respuesta(200, JSON.stringify(cuerpo))],
      [(u) => u === urlDiaJucar('2026-09-30'), () => respuesta(200, fixture('jucar-2026-09-30.json'))]];
    const r = await leerJucar({ pedir: pedirCon(rutas), estaciones: [{ codigo: '6P01' }], fechas: ['2026-10-01', '2026-09-30'] });
    assert.deepEqual(r.errores, ['2026-10-01: formato inesperado']);
    assert.equal(r.filas.length, 1);
  }
  assert.throws(() => filasDeDiaJucar({}, '2026-10-01', new Set(['6P01'])), /formato inesperado/);
});

test('valores descartados: sin días con dato, lluvia nula, de texto o negativa', () => {
  const x = (cod, o) => ({ fldTCodigo: cod, lluvia_int: 1, valores: 1, ...o });
  const lista = [x('A', { valores: 0 }), x('B', { lluvia_int: null }), x('C', { lluvia_int: '2.5' }), x('D', { lluvia_int: -1 }),
    x('E', { lluvia_int: NaN }), x('F', { lluvia_int: 0 })];
  assert.deepEqual(filasDeDiaJucar(lista, '2026-09-30', new Set('ABCDEF')).map((f) => f.estacion), ['F']);
});

test('servidor caído: se corta tras 3 días fallidos seguidos; un acierto reinicia la cuenta', async () => {
  const registro = [];
  const caido = crearPedir({ fetchFn: servidorFalso([[() => true, () => respuesta(503, 'x')]], registro), esperar: sinEspera });
  const r = await leerJucar({ pedir: caido, estaciones: [{ codigo: '6P01' }], fechas: ['2026-10-01', '2026-09-30', '2026-09-29', '2026-09-28', '2026-09-27'] });
  assert.equal(r.errores.length, 4);
  assert.match(r.errores[3], /cortada tras 3 días/);
  const intermitente = [[(u) => u === urlDiaJucar('2026-09-29'), () => respuesta(200, '[]')], [() => true, () => respuesta(503, 'x')]];
  const r2 = await leerJucar({ pedir: pedirCon(intermitente), estaciones: [{ codigo: '6P01' }],
    fechas: ['2026-10-01', '2026-09-30', '2026-09-29', '2026-09-28', '2026-09-27'] });
  assert.equal(r2.errores.filter((e) => /503/.test(e)).length, 4);   // fallan 2, acierta 1, fallan 2: no se corta
  assert.equal(r2.errores.some((e) => /cortada/.test(e)), false);
});

test('ejecutar: una segunda ejecución no vuelve a pedir los días ya guardados', async () => {
  const almacen = almacenPluvioMemoria(), est = [{ fuente: 'jucar', codigo: '6P01' }], ok = [[(u) => u.includes('/lluviasIntervalo/'), () => respuesta(200, fixture('jucar-2026-09-30.json'))]];
  const a = { almacen, esperar: sinEspera, estaciones: est, pedidas: ['jucar', 'publicar'] };
  const reg1 = [], reg2 = [];
  await ejecutar({ ...a, fetchFn: servidorFalso(ok, reg1), ahora: new Date('2026-10-02T04:10:00Z') });
  await ejecutar({ ...a, fetchFn: servidorFalso(ok, reg2), ahora: new Date('2026-10-02T16:10:00Z') });
  const f = (reg) => reg.map((x) => x.url.split('/').at(-1));
  assert.equal(reg1.length, 20);
  assert.equal(reg2.length, 20);
  assert.ok(!f(reg2).some((d) => f(reg1).slice(2).includes(d)), 'repite días de relleno ya guardados');
  assert.deepEqual(f(reg2).slice(0, 2), ['2026-10-01', '2026-09-30']);
});

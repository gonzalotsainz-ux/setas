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

test('qué toca: Júcar a las 4 y 16 UTC, antes de publicar', () => {
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T04:10:00Z')), ['tajo', 'jucar', 'publicar']);
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

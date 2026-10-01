// tests/rejilla-salida.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empaquetarDia, desempaquetarDia, diaConDatos, resumirCelda, agregadosDeCelda, serieLluvia, validarSalida } from '../js/rejilla/salida.js';
import { agregadosDia, indiceDesdeAgregados, DatosIncompletos } from '../js/indice.js';
import { serieSintetica, lluviaBuena, BOLETUS } from './ayudas.js';

test('empaquetar y desempaquetar un día: ida y vuelta exacta', () => {
  const ag = agregadosDia(serieSintetica({ precip: lluviaBuena }), 59);
  const lista = empaquetarDia(ag);
  assert.deepEqual(lista, [106, 60, 17, 60, 194, 0, 13, 13, 6, 6, 6, 6, 6, 6, 6]);
  assert.deepStrictEqual(desempaquetarDia(JSON.parse(JSON.stringify(lista)), ag.fecha, ag.prevision), ag);
  assert.equal(empaquetarDia(null), null);
  assert.equal(desempaquetarDia(null, '2026-10-01', false), null);
  assert.equal(desempaquetarDia([1, 2, 3], '2026-10-01', false), null);
});

test('redondeo a 2 decimales y huecos como null', () => {
  const ag = { ...agregadosDia(serieSintetica({ precip: lluviaBuena }), 59), P26: 80.123456, T20suelo: null, secante: true };
  const l = empaquetarDia(ag);
  assert.equal(l[0], 80.12);
  assert.equal(l[5], 1);
  assert.equal(l[7], null);
  assert.equal(diaConDatos(l), true);
  assert.equal(diaConDatos([null, ...l.slice(1)]), false);
  assert.equal(diaConDatos(null), false);
});

test('resumirCelda: 10 días desde hoy y la lluvia de 60 días + previsión', () => {
  const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
  const fechas = serie.fechas.slice(59, 69);
  const c = resumirCelda({ altRef: 1480, serie, fechas });
  assert.equal(c.altRef, 1480);
  assert.equal(c.dias.length, 10);
  assert.equal(c.incompleta, false);
  assert.equal(c.lluvia.desde, serie.fechas[0]);
  assert.equal(c.lluvia.hoy, 59);
  assert.equal(c.lluvia.mm.length, 69);
  const s = serieLluvia(c);
  assert.equal(s.fechas[59], serie.fechas[59]);
  assert.equal(s.precip[40], 20);
});

test('resumirCelda: un día que no se puede calcular queda null y marca la celda incompleta', () => {
  const serie = serieSintetica({ dias: 70, hoy: 59, precip: (k) => (k === 62 ? null : 2) });
  const c = resumirCelda({ altRef: 1000, serie, fechas: serie.fechas.slice(59, 69) });
  assert.equal(c.incompleta, true);
  assert.equal(c.dias[0][0], 52);
  assert.equal(c.dias[3][0], null);   // la ventana de 26 días incluye el hueco: sin P26
});

test('agregadosDeCelda y validarSalida', () => {
  const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
  const fechas = serie.fechas.slice(59, 69);
  const salida = { version: 1, sello: '2026-10-18T07', generado: '2026-10-18T05:00:00.000Z', hoy: fechas[0], fechas,
    celdas: { 'z:1:1': resumirCelda({ altRef: 1000, serie, fechas }) } };
  assert.deepEqual(validarSalida(salida), []);
  assert.equal(agregadosDeCelda(salida, 'z:1:1', fechas[0]).P26, 106);
  assert.equal(agregadosDeCelda(salida, 'z:1:1', fechas[2]).prevision, true);
  assert.equal(agregadosDeCelda(salida, 'z:9:9', fechas[0]), null);
  assert.equal(agregadosDeCelda(salida, 'z:1:1', '2026-01-01'), null);
  assert.match(validarSalida({ ...salida, version: 2 }).join(), /versión/);
  assert.match(validarSalida({ ...salida, sello: '2026-10-18' }).join(), /sello/);
  assert.match(validarSalida({ ...salida, celdas: { a: { altRef: 1, dias: [] } } }).join(), /celda a/);
});

test('día parcialmente nulo: ida y vuelta y DatosIncompletos aguas abajo', () => {
  const ag = { ...agregadosDia(serieSintetica({ precip: lluviaBuena }), 59), Pagosto: null, T20suelo: null };
  const l = JSON.parse(JSON.stringify(empaquetarDia(ag)));
  assert.deepStrictEqual(desempaquetarDia(l, ag.fecha, ag.prevision), ag);
  assert.equal(diaConDatos(l), true);
  assert.equal(desempaquetarDia([...l.slice(0, 5), 7, ...l.slice(6)], ag.fecha, false).secante, null);
  const sinP3 = desempaquetarDia([l[0], null, ...l.slice(2)], ag.fecha, false);
  assert.throws(() => indiceDesdeAgregados(sinP3, BOLETUS), DatosIncompletos);
  assert.equal(diaConDatos([l[0], null, ...l.slice(2)]), false);
  assert.equal(diaConDatos([...l.slice(0, 5), null, ...l.slice(6)]), false);
});

test('archivo de ayer: prevision según su propio hoy; ids heredados no cuentan', () => {
  const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
  const fechas = serie.fechas.slice(58, 68);
  const salida = { version: 1, sello: '2026-10-17T07', generado: '2026-10-17T05:00:00.000Z', hoy: fechas[0], fechas,
    celdas: { 'z:1:1': resumirCelda({ altRef: 1000, serie: { ...serie, hoy: 58 }, fechas }) } };
  assert.equal(agregadosDeCelda(salida, 'z:1:1', fechas[0]).prevision, false);
  assert.equal(agregadosDeCelda(salida, 'z:1:1', fechas[1]).prevision, true);
  assert.equal(agregadosDeCelda(salida, 'toString', fechas[0]), null);
  assert.deepEqual(validarSalida(salida), []);
});

test('validarSalida rechaza archivos sin hoy, sin lluvia, sin celdas o con días mal formados', () => {
  const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
  const fechas = serie.fechas.slice(59, 69);
  const c = resumirCelda({ altRef: 1000, serie, fechas });
  const base = { version: 1, sello: '2026-10-18T07', hoy: fechas[0], fechas, celdas: { a: c, b: c } };
  assert.deepEqual(validarSalida(base), []);
  const { hoy, ...sinHoy } = base;
  assert.match(validarSalida(sinHoy).join(), /hoy/);
  assert.match(validarSalida({ ...base, hoy: '2020-01-01' }).join(), /hoy/);
  assert.match(validarSalida({ ...base, fechas: [fechas[1], fechas[0], ...fechas.slice(2)] }).join(), /fechas/);
  assert.match(validarSalida({ ...base, fechas: [fechas[0], fechas[0], ...fechas.slice(2)] }).join(), /fechas/);
  assert.match(validarSalida({ ...base, celdas: {} }).join(), /sin celdas/);
  const { lluvia, ...sinLluvia } = c;
  assert.match(validarSalida({ ...base, celdas: { a: sinLluvia } }).join(), /celda a/);
  assert.match(validarSalida({ ...base, celdas: { a: { ...c, dias: [[1, 2], ...c.dias.slice(1)] } } }).join(), /celda a/);
  assert.match(validarSalida({ ...base, celdas: { a: { ...c, dias: [['x', ...c.dias[0].slice(1)], ...c.dias.slice(1)] } } }).join(), /celda a/);
  const malas = validarSalida({ ...base, celdas: { a: sinLluvia, b: sinLluvia } });
  assert.equal(malas.length, 2);
});

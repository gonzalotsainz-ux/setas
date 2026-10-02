// tests/pluvio-duero.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estacionesDeRisr, historicoDeFicha, altitudDeFicha, esHistoricoDeLluvia, horasDeHistorico, leerDuero } from '../supabase/functions/pluvio/lectores/duero.js';
import { crearPedir, PlazoAgotado } from '../supabase/functions/pluvio/red.js';
import { fechaMadridDeFin } from '../supabase/functions/pluvio/tiempo.js';
import { fuentesQueTocan, ejecutar } from '../supabase/functions/pluvio/manejador.js';
import { fixture, respuesta, servidorFalso, almacenPluvioMemoria } from './dobles-pluvio.js';

const sinEspera = async () => {};
const r1 = (x) => Math.round(x * 10) / 10;
const delDia = (filas, fecha) => {
  const f = filas.filter((h) => fechaMadridDeFin(h.hora) === fecha && h.mm != null);
  return { mm: r1(f.reduce((t, h) => t + h.mm, 0)), horas: f.length };
};
const PL002 = { fuente: 'duero', codigo: 'PL002', token: 'xADTQNURfJDMwwEU' };
const PL031 = { fuente: 'duero', codigo: 'PL031', token: 'xADTQNURfFzMwwEU' };
const rutasDuero = (antes = []) => [...antes,
  [(u) => u.endsWith('/risr/PL002/historico/xADTQNURfJDMwwEU'), () => respuesta(200, fixture('duero-historico-PL002.html'))],
  [(u) => u.endsWith('/risr/PL031/historico/xADTQNURfFzMwwEU'), () => respuesta(200, fixture('duero-historico-PL031.html'))],
  [(u) => u.endsWith('/risr/PL002'), () => respuesta(200, fixture('duero-ficha-PL002.html'))],
  [(u) => u.endsWith('/risr/PL031'), () => respuesta(200, fixture('duero-ficha-PL031.html'))],
];
const pedirCon = (rutas) => crearPedir({ fetchFn: servidorFalso(rutas), esperar: sinEspera });

test('tiempo real: 221 estaciones (71 pluviómetros PL) con coordenadas', () => {
  const l = estacionesDeRisr(fixture('duero-risr.html'));
  assert.equal(l.length, 221);
  assert.equal(l.filter((e) => e.codigo.startsWith('PL')).length, 71);
  assert.deepEqual(l.find((e) => e.codigo === 'PL002'), { codigo: 'PL002', nombre: 'Covaleda, PL-47', lat: 41.95236236, lon: -2.87212741 });
  assert.throws(() => estacionesDeRisr('<html></html>'), /datosPL/);
});

test('ficha: el token del histórico de LLUVIA (no el de temperatura) y la altitud; una estación caída no los trae', () => {
  const f = fixture('duero-ficha-PL002.html');
  assert.equal(historicoDeFicha(f, 'PL002'), 'xADTQNURfJDMwwEU');
  assert.equal(altitudDeFicha(f), 1445);
  assert.equal(historicoDeFicha(fixture('duero-ficha-PL031.html'), 'PL031'), null);
  assert.equal(altitudDeFicha(fixture('duero-ficha-PL031.html')), null);
});

test('histórico: valores horarios en hora de Madrid pasados a UTC (fin de la hora)', () => {
  const filas = horasDeHistorico(fixture('duero-historico-PL002.html'), 'PL002');
  assert.equal(filas.length, 2121);
  assert.deepEqual(filas[0], { estacion: 'PL002', hora: '2026-07-03T22:00:00.000Z', mm: 120 });   // valor de mantenimiento: lo marca la tarea 8
  assert.deepEqual(delDia(filas, '2026-08-27'), { mm: 3.8, horas: 24 });
  assert.deepEqual(delDia(filas, '2026-09-17'), { mm: 0, horas: 15 });
  const q = horasDeHistorico(fixture('duero-historico-PL031.html'), 'PL031');
  assert.deepEqual(delDia(q, '2026-08-27'), { mm: 551.9, horas: 24 });   // Quintanar de la Sierra: el pico falso del informe 09
  assert.deepEqual(delDia(q, '2026-09-30'), { mm: 186.6, horas: 16 });
});

// Review Focus 2: una página con otra gráfica (temperatura) o sin gráfica no es un histórico de lluvia.
test('una página sin el título de pluviometría no es un histórico de lluvia', () => {
  assert.equal(esHistoricoDeLluvia(fixture('duero-historico-PL002.html')), true);
  assert.equal(esHistoricoDeLluvia("<script>// title: 'Temperatura ambiente'\nvar chartData = [{d:\"01/10/2026 10:00\", v:12.3}];</script>"), false);
  assert.equal(esHistoricoDeLluvia('<html>mantenimiento</html>'), false);
});

test('leerDuero: con el token guardado y solo desde la fecha pedida', async () => {
  const r = await leerDuero({ pedir: pedirCon(rutasDuero()), estaciones: [PL002, PL031], desde: '2026-09-28' });
  assert.deepEqual(r.errores, []);
  assert.ok(r.filas.every((f) => fechaMadridDeFin(f.hora) >= '2026-09-28'));
  assert.equal(r.filas.filter((f) => f.estacion === 'PL002').length, 76);
  assert.equal(r.filas.filter((f) => f.estacion === 'PL031').length, 64);
});

test('leerDuero: si el token guardado ya no vale lo busca en la ficha; sin histórico, error y sigue', async () => {
  const r = await leerDuero({ pedir: pedirCon(rutasDuero()), estaciones: [{ ...PL031, token: 'viejo' }, { ...PL002, token: 'viejo' }], desde: '2026-09-28' });
  assert.deepEqual(r.errores, ['PL031: sin histórico de lluvia en la ficha', 'PL002: token renovado (xADTQNURfJDMwwEU)']);
  assert.equal(r.filas.length, 76);
});

test('Review Focus 2: el histórico contesta 200 con la gráfica de temperatura → error, ni una fila', async () => {
  const temperatura = "<script>// title: 'Temperatura ambiente'\nvar chartData = [{d:\"01/10/2026 10:00\", v:12.3}];</script>";
  const rutas = rutasDuero([[(u) => u.endsWith('/historico/xADTQNURfJDMwwEU'), () => respuesta(200, temperatura)]]);
  const r = await leerDuero({ pedir: pedirCon(rutas), estaciones: [PL002], desde: '2026-09-28' });
  assert.deepEqual(r.filas, []);
  assert.deepEqual(r.errores, ['PL002: sin histórico de lluvia']);
});

test('qué toca: Duero a las 3 y a las 15 UTC; los 90 días, el domingo a la 1', () => {
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T03:10:00Z')), ['aemet', 'duero']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T15:10:00Z')), ['aemet', 'duero']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-04T01:10:00Z')), ['tajo', 'duero90']);   // domingo
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-05T01:10:00Z')), ['tajo']);
});

test('ejecutar: duero guarda desde hace 4 días; duero90, desde el 1 de agosto', async () => {
  const ahora = new Date('2026-10-02T03:10:00Z');
  const a = almacenPluvioMemoria();
  const r = await ejecutar({ almacen: a, fetchFn: servidorFalso(rutasDuero()), esperar: sinEspera, ahora, estaciones: [PL002], pedidas: ['duero'] });
  assert.deepEqual(r.filas, { duero: 76 });
  const b = almacenPluvioMemoria();
  await ejecutar({ almacen: b, fetchFn: servidorFalso(rutasDuero()), esperar: sinEspera, ahora, estaciones: [PL002], pedidas: ['duero90'] });
  assert.equal(b.obs.size, 1448);
  assert.equal(b.obs.get('duero|PL002|2026-08-27T11:00:00.000Z').fuente, 'duero');
});

test('ejecutar: si falla el guardado se conservan los errores de lectura', async () => {
  const ahora = new Date('2026-10-02T03:10:00Z');
  const a = { ...almacenPluvioMemoria(), async guardarObs() { throw new Error('base caída'); } };
  const r = await ejecutar({ almacen: a, fetchFn: servidorFalso(rutasDuero()), esperar: sinEspera, ahora, estaciones: [PL002, { ...PL031, codigo: 'PL999', token: null }], pedidas: ['duero'] });
  assert.ok(r.errores.includes('duero: base caída'));
  assert.ok(r.errores.some((e) => e.startsWith('duero: PL999:')));
});

test('ejecutar: lector con plazo agotado y guardado fallido → el bucle para (no lee duero90)', async () => {
  const ahora = new Date('2026-10-02T03:10:00Z');
  const a = { ...almacenPluvioMemoria(), async guardarObs() { throw new Error('base caída'); } };
  const rutas = rutasDuero([[(u) => u.endsWith('/risr/PL999'), () => { throw new PlazoAgotado(); }]]);
  const r = await ejecutar({ almacen: a, fetchFn: servidorFalso(rutas), esperar: sinEspera, ahora, estaciones: [PL002, { ...PL031, codigo: 'PL999', token: null }], pedidas: ['duero', 'duero90'] });
  assert.equal(r.estado, 'plazo-agotado');
  assert.ok(r.errores.includes('duero: base caída'));
  assert.ok(r.errores.includes('duero: plazo agotado'));
  assert.ok(!r.errores.some((e) => e.startsWith('duero90')));
});

test('histórico: valor vacío, null o solo espacios es un hueco (mm null), nunca 0, y no se guarda', async () => {
  const html = "<script>// title: 'Pluviometría'\nvar chartData = [{d:\"01/10/2026 10:00\", v:}, {d:\"01/10/2026 11:00\", v:null}, {d:\"01/10/2026 12:00\", v:  }, {d:\"01/10/2026 13:00\", v:0.0}, {d:\"01/10/2026 14:00\", v:1.2}];</script>";
  const filas = horasDeHistorico(html, 'PL002');
  assert.deepEqual(filas.map((f) => f.mm), [null, null, null, 0, 1.2]);
  const pedir = pedirCon([[(u) => u.includes('/historico/'), () => respuesta(200, html)]]);
  const r = await leerDuero({ pedir, estaciones: [PL002], desde: '2026-10-01' });
  assert.deepEqual(r.filas.map((f) => f.mm), [0, 1.2]);
});

test('histórico: en el cambio de hora del 25/10 la segunda 02:00 va una hora UTC más tarde', () => {
  const html = "<script>// title: 'Pluviometría'\nvar chartData = [" + ['01:00', '02:00', '02:00', '03:00'].map((h, k) => `{d:"25/10/2026 ${h}", v:${k}}`).join(',') + '];</script>';
  assert.deepEqual(horasDeHistorico(html, 'PL002').map((f) => f.hora),
    ['2026-10-24T23:00:00.000Z', '2026-10-25T00:00:00.000Z', '2026-10-25T01:00:00.000Z', '2026-10-25T02:00:00.000Z']);
});

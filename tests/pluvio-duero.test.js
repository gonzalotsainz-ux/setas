// tests/pluvio-duero.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estacionesDeRisr, historicoDeFicha, altitudDeFicha, esHistoricoDeLluvia, horasDeHistorico, leerDuero } from '../supabase/functions/pluvio/lectores/duero.js';
import { crearPedir, PlazoAgotado } from '../supabase/functions/pluvio/red.js';
import { fechaMadridDeFin } from '../supabase/functions/pluvio/tiempo.js';
import { fuentesQueTocan, ejecutar, TAREAS, LOTES_DUERO, DIAS_DUERO, estacionesDeLote, horaDeLote } from '../supabase/functions/pluvio/manejador.js';
import { fixture, respuesta, servidorFalso, almacenPluvioMemoria } from './dobles-pluvio.js';
import ESTACIONES from '../supabase/functions/pluvio/estaciones.json' with { type: 'json' };

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

test('qué toca: Duero, un lote en cada hora de AEMET (0, 3, …, 21 UTC); ya no hay duero90', () => {
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T00:10:00Z')), ['aemet', 'duero']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T18:10:00Z')), ['aemet', 'duero']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-04T01:10:00Z')), ['tajo']);   // domingo: el relleno ya no va en la función
  assert.ok(!('duero90' in TAREAS));
  const horas = Array.from({ length: 24 }, (_, h) => h).filter((h) => TAREAS.duero.toca(h));
  assert.deepEqual(horas, [0, 3, 6, 9, 12, 15, 18, 21]);
  assert.deepEqual(horas.map((h) => TAREAS.duero.lote(h)), [0, 1, 2, 3, 0, 1, 2, 3]);
  assert.deepEqual([0, 1, 2, 3].map((l) => horaDeLote('duero', l)), [0, 3, 6, 9]);
});

test('rotación: lotes disjuntos que cubren la lista blanca; cada estación del Duero, 2 veces al día y cada 12 h', () => {
  const duero = ESTACIONES.filter((e) => e.fuente === 'duero');
  const lotes = Array.from({ length: LOTES_DUERO }, (_, l) => estacionesDeLote(duero, l, LOTES_DUERO).map((e) => e.codigo));
  const todas = lotes.flat();
  assert.equal(new Set(todas).size, todas.length, 'lotes disjuntos');
  assert.deepEqual([...todas].sort(), duero.map((e) => e.codigo).sort(), 'entre todos, todas las estaciones');
  assert.ok(lotes.every((l) => l.length <= Math.ceil(duero.length / LOTES_DUERO)), 'lotes del mismo tamaño');
  const horas = new Map(duero.map((e) => [e.codigo, []]));
  for (let h = 0; h < 24; h++) if (TAREAS.duero.toca(h)) for (const c of lotes[TAREAS.duero.lote(h)]) horas.get(c).push(h);
  for (const [c, hs] of horas) {
    assert.ok(hs.length >= 2, `${c}: ${hs.length} lecturas al día`);
    const huecos = hs.map((h, k) => ((hs[(k + 1) % hs.length] - h + 24) % 24) || 24);
    assert.ok(Math.max(...huecos) <= 12, `${c}: ${Math.max(...huecos)} h sin leer`);
  }
  assert.ok(DIAS_DUERO * 24 >= 3 * 12, 'el histórico de 4 días cubre dos lecturas fallidas seguidas');
  // El lote no depende del orden en que vengan las estaciones.
  assert.deepEqual(estacionesDeLote([{ codigo: 'B' }, { codigo: 'A' }, { codigo: 'C' }], 0, 2).map((e) => e.codigo), ['A', 'C']);
});

test('ejecutar: duero lee solo el lote de la hora y guarda desde hace 4 días', async () => {
  const a = almacenPluvioMemoria(), registro = [];
  const r = await ejecutar({ almacen: a, fetchFn: servidorFalso(rutasDuero(), registro), esperar: sinEspera, ahora: new Date('2026-10-02T00:10:00Z'),
    estaciones: [PL031, PL002], pedidas: ['duero'] });
  assert.deepEqual(r.filas, { duero: 76 });   // lote 0: PL002
  assert.ok(registro.length && registro.every((x) => x.url.includes('/PL002/')));
  assert.equal(a.obs.get('duero|PL002|2026-09-30T11:00:00.000Z').fuente, 'duero');
  const s = await ejecutar({ almacen: almacenPluvioMemoria(), fetchFn: servidorFalso(rutasDuero()), esperar: sinEspera, ahora: new Date('2026-10-02T03:10:00Z'),
    estaciones: [PL031, PL002], pedidas: ['duero'] });
  assert.deepEqual(s.filas, { duero: 64 });   // lote 1: PL031
});

// Con 4 lotes, PL002 (1.ª por código) y PL999 (5.ª) van en el mismo lote, el 0 (00:10 UTC).
const conRelleno = (otra) => [PL002, ...['PL003', 'PL004', 'PL005'].map((codigo) => ({ fuente: 'duero', codigo, token: null })), otra];

test('ejecutar: si falla el guardado se conservan los errores de lectura', async () => {
  const ahora = new Date('2026-10-02T00:10:00Z');
  const a = { ...almacenPluvioMemoria(), async guardarObs() { throw new Error('base caída'); } };
  const r = await ejecutar({ almacen: a, fetchFn: servidorFalso(rutasDuero()), esperar: sinEspera, ahora, estaciones: conRelleno({ ...PL031, codigo: 'PL999', token: null }), pedidas: ['duero'] });
  assert.ok(r.errores.includes('duero: base caída'));
  assert.ok(r.errores.some((e) => e.startsWith('duero: PL999:')));
});

test('ejecutar: lector con plazo agotado y guardado fallido → el bucle para (no lee jucar)', async () => {
  const ahora = new Date('2026-10-02T00:10:00Z');
  const a = { ...almacenPluvioMemoria(), async guardarObs() { throw new Error('base caída'); } };
  const rutas = rutasDuero([[(u) => u.endsWith('/risr/PL999'), () => { throw new PlazoAgotado(); }]]);
  const r = await ejecutar({ almacen: a, fetchFn: servidorFalso(rutas), esperar: sinEspera, ahora,
    estaciones: [...conRelleno({ ...PL031, codigo: 'PL999', token: null }), { fuente: 'jucar', codigo: '4N01' }], pedidas: ['duero', 'jucar'] });
  assert.equal(r.estado, 'plazo-agotado');
  assert.ok(r.errores.includes('duero: base caída'));
  assert.ok(r.errores.includes('duero: plazo agotado'));
  assert.ok(!r.errores.some((e) => e.startsWith('jucar')));
  assert.ok(!('jucar' in r.leidas));
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

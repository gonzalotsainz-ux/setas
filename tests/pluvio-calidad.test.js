// tests/pluvio-calidad.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calidadHora, revisarDia, revisarDias } from '../supabase/functions/pluvio/calidad.js';
import { celdasCercanas } from '../supabase/functions/pluvio/publicar.js';
import { agregarHoras } from '../supabase/functions/pluvio/dias.js';
import { horasDeHistorico, estacionesDeRisr } from '../supabase/functions/pluvio/lectores/duero.js';
import { filaObs, ejecutar } from '../supabase/functions/pluvio/manejador.js';
import { fixture, servidorFalso, almacenPluvioMemoria } from './dobles-pluvio.js';

const risr = estacionesDeRisr(fixture('duero-risr.html'));
const EST = [['PL002', 'Covaleda', 1445], ['PL031', 'Quintanar de la Sierra', 1343]].map(([codigo, nombre, altitud]) => {
  const e = risr.find((x) => x.codigo === codigo);
  return { fuente: 'duero', codigo, nombre, lat: e.lat, lon: e.lon, altitud };
});
const horas = (codigo) => horasDeHistorico(fixture(`duero-historico-${codigo}.html`), codigo).map((h) => filaObs('duero', h));
const DIAS = agregarHoras([...horas('PL002'), ...horas('PL031')], '2026-08-01');
const de = (r, estacion, fecha) => r.find((d) => d.estacion === estacion && d.fecha === fecha);
const CELDA = { id: 'soria:1:1', zona: 'soria', lat: 42.0, lon: -2.95, altRef: 1300 };

test('una hora: negativo → descartado; más de 60 mm → sospechoso; sin número → sin dato; un total diario no es una hora', () => {
  assert.equal(calidadHora(-0.1), 'descartado');
  assert.equal(calidadHora(60), 'ok');
  assert.equal(calidadHora(60.1), 'sospechoso');
  assert.equal(calidadHora(null), 'sin-dato');
  assert.equal(calidadHora(Number.NaN), 'sin-dato');
  assert.equal(calidadHora(70, 24), 'ok');
  assert.equal(filaObs('duero', { estacion: 'PL031', hora: '2026-08-27T11:00:00.000Z', mm: 120 }).calidad, 'sospechoso');
});

test('Quintanar de la Sierra (casos reales): 551,9 mm el 27/08, pico aislado el 28/08, 186,6 mm en 16 horas el 30/09', () => {
  const r = revisarDias(DIAS, EST, () => 0.4);
  assert.deepEqual(de(r, 'PL031', '2026-08-27').calidad, 'sospechoso');
  assert.equal(de(r, 'PL031', '2026-08-27').motivo, 'una hora con 120 mm (más de 60)');
  assert.equal(de(r, 'PL031', '2026-08-28').calidad, 'sospechoso');
  assert.equal(de(r, 'PL031', '2026-08-28').motivo, 'pico aislado: 144.8 mm frente a 0 de sus vecinas y 0.4 del modelo');
  assert.equal(de(r, 'PL031', '2026-09-30').calidad, 'sospechoso');   // una hora de 81,9 mm (y además incompleto)
  assert.equal(de(r, 'PL002', '2026-09-17').calidad, 'incompleto');
  assert.deepEqual({ ...de(r, 'PL002', '2026-08-27') }, { fuente: 'duero', estacion: 'PL002', fecha: '2026-08-27', mm: 3.8, horas: 24, maximo: 1.7, calidad: 'ok', motivo: null });
});

test('sin modelo no se aplica la regla del pico: el 28/08 de Quintanar pasaría (por eso se usa el de la celda gruesa)', () => {
  assert.equal(de(revisarDias(DIAS, EST), 'PL031', '2026-08-28').calidad, 'ok');
});

test('una tormenta de verdad (como La Cierva en septiembre) no es un pico aislado', () => {
  assert.deepEqual(revisarDia({ mm: 40, horas: 24, maximo: 18 }, { vecinas: [12, 15], modelo: 3 }), { calidad: 'ok', motivo: null });
});

// Review Focus 3: báscula atascada en 0 mientras llueve alrededor.
test('pluviómetro atascado: 0 mm con vecinas de 25 y 31 y modelo de 18 → sospechoso; con el modelo seco, no', () => {
  assert.deepEqual(revisarDia({ mm: 0, horas: 24, maximo: 0 }, { vecinas: [25, 31], modelo: 18 }),
    { calidad: 'sospechoso', motivo: 'seco aislado: 0 mm frente a 28 de sus vecinas y 18 del modelo' });
  assert.equal(revisarDia({ mm: 0, horas: 24, maximo: 0 }, { vecinas: [25, 31], modelo: 4 }).calidad, 'ok');
});

test('límite del día: más de 200 mm', () => {
  assert.deepEqual(revisarDia({ mm: 210, horas: 24, maximo: 30 }), { calidad: 'sospechoso', motivo: '210 mm en el día (más de 200)' });
});

test('la celda gruesa más cercana a cada estación (a menos de 15 km)', () => {
  const m = celdasCercanas(EST, [CELDA, { id: 'lejos', lat: 41, lon: -4 }]);
  assert.deepEqual([...m], [['duero:PL002', 'soria:1:1'], ['duero:PL031', 'soria:1:1']]);
  assert.equal(celdasCercanas(EST, [{ id: 'lejos', lat: 41, lon: -4 }]).size, 0);
});

test('publicar marca en lluvia_dia el pico de Quintanar con el modelo de meteo_celdas', async () => {
  const almacen = almacenPluvioMemoria();
  await almacen.guardarObs([...horas('PL002'), ...horas('PL031')]);
  almacen.modelo.set('soria:1:1', new Map([['2026-08-28', 0.4]]));
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([]), esperar: async () => {}, ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: EST, gruesa: { celdas: [CELDA] }, pedidas: ['publicar'] });
  assert.deepEqual(r.errores, []);
  assert.equal(almacen.dias.get('duero|PL031|2026-08-28').calidad, 'sospechoso');
  assert.match(almacen.dias.get('duero|PL031|2026-08-28').motivo, /^pico aislado/);
  assert.equal(almacen.dias.get('duero|PL031|2026-08-27').calidad, 'sospechoso');
  assert.equal(almacen.dias.get('duero|PL002|2026-08-28').calidad, 'ok');
});

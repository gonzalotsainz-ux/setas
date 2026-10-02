// tests/pluvio-dias.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agregarHoras, diasDeFilas } from '../supabase/functions/pluvio/dias.js';
import { revisarDia } from '../supabase/functions/pluvio/calidad.js';
import { horaDeTexto, finDeDia } from '../supabase/functions/pluvio/tiempo.js';
import { horasDeHistorico } from '../supabase/functions/pluvio/lectores/duero.js';
import { ejecutar, fuentesQueTocan, filaObs, unicas } from '../supabase/functions/pluvio/manejador.js';
import { fixture, servidorFalso, respuesta, rutasTajo, almacenPluvioMemoria } from './dobles-pluvio.js';

const duero = (codigo) => horasDeHistorico(fixture(`duero-historico-${codigo}.html`), codigo).map((h) => filaObs('duero', h));
const delDia = (dias, estacion, fecha) => dias.find((d) => d.estacion === estacion && d.fecha === fecha);
const sinEspera = async () => {};

test('agregación por día de Madrid: Quintanar, el 27/08 y el 30/09 (casos reales)', () => {
  const dias = agregarHoras(duero('PL031'), '2026-08-01');
  assert.deepEqual(delDia(dias, 'PL031', '2026-08-27'), { fuente: 'duero', estacion: 'PL031', fecha: '2026-08-27', mm: 551.9, horas: 24, maximo: 120 });
  assert.deepEqual(delDia(dias, 'PL031', '2026-09-30'), { fuente: 'duero', estacion: 'PL031', fecha: '2026-09-30', mm: 186.6, horas: 16, maximo: 81.9 });
  assert.ok(dias.every((d) => d.fecha >= '2026-08-01'));
});

test('agregación: un negativo o un nulo no suman ni cuentan; un total diario (Júcar) vale 24 horas y no da máximo horario', () => {
  const h = (hora, mm, horas = 1) => ({ fuente: 'f', estacion: 'e', hora, horas, mm });
  const dias = agregarHoras([h('2026-09-29T08:00:00.000Z', -1), h('2026-09-29T09:00:00.000Z', null), h('2026-09-29T10:00:00.000Z', 2),
    { fuente: 'jucar', estacion: '5N02', hora: finDeDia('2026-09-30'), horas: 24, mm: 1.6 }], '2026-09-01');
  assert.deepEqual(delDia(dias, 'e', '2026-09-29'), { fuente: 'f', estacion: 'e', fecha: '2026-09-29', mm: 2, horas: 1, maximo: 2 });
  assert.deepEqual(delDia(dias, '5N02', '2026-09-30'), { fuente: 'jucar', estacion: '5N02', fecha: '2026-09-30', mm: 1.6, horas: 24, maximo: null });
});

test('diasDeFilas: de un array por columna (lluvia_por_dia) a una fila por día', () => {
  assert.deepEqual(diasDeFilas([{ fuente: 'duero', estacion: 'PL002', fechas: ['2026-09-29', '2026-09-30'], mm: [0, 0.30000000000000004], horas: [24, 23], maximo: [0, 0.2] }]), [
    { fuente: 'duero', estacion: 'PL002', fecha: '2026-09-29', mm: 0, horas: 24, maximo: 0 },
    { fuente: 'duero', estacion: 'PL002', fecha: '2026-09-30', mm: 0.3, horas: 23, maximo: 0.2 }]);
});

test('revisarDia: día completo, incompleto (menos de 20 horas) y sin dato', () => {
  assert.deepEqual(revisarDia({ mm: 3.8, horas: 24, maximo: 1.7 }), { calidad: 'ok', motivo: null });
  assert.deepEqual(revisarDia({ mm: 0, horas: 15, maximo: 0 }), { calidad: 'incompleto', motivo: 'solo 15 horas con dato' });
  assert.deepEqual(revisarDia({ mm: null, horas: 0, maximo: null }), { calidad: 'sin-dato', motivo: 'ninguna hora con dato' });
});

// Review Focus 1: el 25 de octubre tiene 25 horas en Madrid; la repetida se queda en una y el día cuenta entero.
test('cambio de hora: el 25/10 con la hora 02:00 repetida queda completo', () => {
  const textos = Array.from({ length: 23 }, (_, k) => `25/10/2026 ${String(k + 1).padStart(2, '0')}:00`).concat(['25/10/2026 02:00', '26/10/2026 00:00']);
  const filas = unicas(textos.map((t) => filaObs('tajo', { estacion: 'P_26', hora: horaDeTexto(t), mm: 0.1 })));
  assert.equal(filas.length, 24);
  const [dia] = agregarHoras(filas, '2026-10-25');
  assert.equal(dia.fecha, '2026-10-25');
  assert.equal(revisarDia(dia).calidad, 'ok');
});

test('qué toca: el paso publicar a las 4 y a las 16 UTC, después de las lecturas', () => {
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T04:10:00Z')), ['tajo', 'jucar', 'publicar']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T16:10:00Z')), ['tajo', 'jucar', 'publicar']);
});

test('publicar: guarda lluvia_dia desde el 1 de agosto hasta ayer, solo de la lista blanca', async () => {
  const almacen = almacenPluvioMemoria();
  await almacen.guardarObs([...duero('PL002'), filaObs('duero', { estacion: 'FUERA', hora: '2026-09-29T10:00:00.000Z', mm: 5 })]);
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([]), esperar: sinEspera, ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: [{ fuente: 'duero', codigo: 'PL002' }], pedidas: ['publicar'] });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.pasos.publicar, { dias: 61 });   // del 01/08 al 30/09: el 01/10 PL002 no tiene datos y el 02/10 es hoy
  assert.equal(almacen.dias.get('duero|PL002|2026-09-17').calidad, 'incompleto');
  assert.equal(almacen.dias.get('duero|PL002|2026-08-27').mm, 3.8);
  assert.equal(almacen.dias.get('duero|PL002|2026-08-27').actualizado, '2026-10-02T04:10:00.000Z');
  assert.equal(almacen.dias.has('duero|FUERA|2026-09-29'), false);
});

test('si las lecturas agotan su plazo, el paso publicar se hace igual con el tiempo que queda', async () => {
  let t = 0;
  const fetchFn = async (url) => { t += 60000; return servidorFalso(rutasTajo())(url); };
  const est = ['A', 'B', 'C'].map((c) => ({ fuente: 'tajo', codigo: c, url: 'index.php?w=get-estacion&x=ok' }));
  const r = await ejecutar({ almacen: almacenPluvioMemoria(), fetchFn, esperar: sinEspera, reloj: () => t, estaciones: est,
    ahora: new Date('2026-10-02T04:10:00Z'), pedidas: ['tajo', 'publicar'] });
  assert.equal(r.estado, 'plazo-agotado');
  assert.ok(r.pasos.publicar, 'quedan 20 s: da para agregar y guardar');
});

test('la migración: lluvia_dia cerrada, la función SQL con el día de Madrid y solo para service_role', () => {
  const sql = readFileSync('supabase/migrations/20261004000000_lluvia_dia.sql', 'utf8');
  assert.match(sql, /alter table public\.lluvia_dia enable row level security/);
  assert.doesNotMatch(sql, /create policy/);
  assert.match(sql, /revoke all on public\.lluvia_dia from anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on public\.lluvia_dia to service_role/);
  assert.match(sql, /\(o\.hora - interval '1 minute'\) at time zone 'Europe\/Madrid'/);
  assert.match(sql, /filter \(where o\.mm >= 0\)/);
  assert.match(sql, /grant execute on function public\.lluvia_por_dia\(date\) to service_role/);
  assert.match(sql, /cron\.schedule\('pluvio-limpieza'/);
  assert.doesNotMatch(sql, /sb_secret|eyJ/);
});

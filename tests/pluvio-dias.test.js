// tests/pluvio-dias.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agregarHoras, diasDeFilas } from '../supabase/functions/pluvio/dias.js';
import { revisarDia } from '../supabase/functions/pluvio/calidad.js';
import { horaDeTexto, finDeDia, utcDeMadrid, fechaMadridDeFin } from '../supabase/functions/pluvio/tiempo.js';
import { hoyMadrid } from '../supabase/functions/_shared/meteo.js';
import { horasDeHistorico } from '../supabase/functions/pluvio/lectores/duero.js';
import { ejecutar, fuentesQueTocan, filaObs, unicas } from '../supabase/functions/pluvio/manejador.js';
import { fixture, servidorFalso, respuesta, rutasTajo, almacenPluvioMemoria } from './dobles-pluvio.js';

const duero = (codigo) => horasDeHistorico(fixture(`duero-historico-${codigo}.html`), codigo).map((h) => filaObs('duero', h));
const delDia = (dias, estacion, fecha) => dias.find((d) => d.estacion === estacion && d.fecha === fecha);
const sinEspera = async () => {};

test('agregación por día de Madrid: Quintanar, el 27/08 y el 30/09 (casos reales)', () => {
  const dias = agregarHoras(duero('PL031'), '2026-08-01');
  assert.deepEqual(delDia(dias, 'PL031', '2026-08-27'), { fuente: 'duero', estacion: 'PL031', fecha: '2026-08-27', mm: 551.9, horas: 24, maximo: 120, ultima: true });
  assert.deepEqual(delDia(dias, 'PL031', '2026-09-30'), { fuente: 'duero', estacion: 'PL031', fecha: '2026-09-30', mm: 186.6, horas: 16, maximo: 81.9, ultima: false });
  assert.ok(dias.every((d) => d.fecha >= '2026-08-01'));
});

test('agregación: un negativo o un nulo no suman ni cuentan; un total diario (Júcar) vale 24 horas y no da máximo horario', () => {
  const h = (hora, mm, horas = 1) => ({ fuente: 'f', estacion: 'e', hora, horas, mm });
  const dias = agregarHoras([h('2026-09-29T08:00:00.000Z', -1), h('2026-09-29T09:00:00.000Z', null), h('2026-09-29T10:00:00.000Z', 2),
    { fuente: 'jucar', estacion: '5N02', hora: finDeDia('2026-09-30'), horas: 24, mm: 1.6 }], '2026-09-01');
  assert.deepEqual(delDia(dias, 'e', '2026-09-29'), { fuente: 'f', estacion: 'e', fecha: '2026-09-29', mm: 2, horas: 1, maximo: 2, ultima: false });
  assert.deepEqual(delDia(dias, '5N02', '2026-09-30'), { fuente: 'jucar', estacion: '5N02', fecha: '2026-09-30', mm: 1.6, horas: 24, maximo: null, ultima: true });
});

test('diasDeFilas: de un array por columna (lluvia_por_dia) a una fila por día', () => {
  assert.deepEqual(diasDeFilas([{ fuente: 'duero', estacion: 'PL002', fechas: ['2026-09-29', '2026-09-30'], mm: [0, 0.30000000000000004], horas: [24, 23], maximo: [0, 0.2], ultima: [true, false] }]), [
    { fuente: 'duero', estacion: 'PL002', fecha: '2026-09-29', mm: 0, horas: 24, maximo: 0, ultima: true },
    { fuente: 'duero', estacion: 'PL002', fecha: '2026-09-30', mm: 0.3, horas: 23, maximo: 0.2, ultima: false }]);
});

// Revisión final 1: sin la columna `ultima` (la función SQL anterior a la migración 20261004000100) no se sabe si el día
// tiene su última hora: no cuenta como medido.
test('diasDeFilas: sin la columna ultima, el día no tiene la última hora', () => {
  const [d] = diasDeFilas([{ fuente: 'duero', estacion: 'PL002', fechas: ['2026-09-29'], mm: [3], horas: [24], maximo: [1] }]);
  assert.equal(d.ultima, false);
  assert.deepEqual(revisarDia(d), { calidad: 'incompleto', motivo: 'falta la hora que acaba a medianoche' });
});

// Revisión final 1: con lotes, a las 4 UTC el Duero puede tener ayer leído hasta las 20 h de Madrid; las horas de 20 a 24
// (las de tormenta) no pueden contar como 0 mm.
test('un día con 20 horas pero sin la que acaba a medianoche es incompleto; con ella, bueno', () => {
  // 01/10/2026 en Madrid (UTC+2): de 00-01 h (fin 30/09 23:00Z) a 19-20 h (fin 01/10 18:00Z), 20 horas de 0,5 mm.
  const veinte = Array.from({ length: 20 }, (_, k) => filaObs('duero', { estacion: 'PL002', hora: new Date(Date.UTC(2026, 8, 30, 23 + k)).toISOString(), mm: 0.5 }));
  const [dia] = agregarHoras(veinte, '2026-10-01');
  assert.deepEqual(dia, { fuente: 'duero', estacion: 'PL002', fecha: '2026-10-01', mm: 10, horas: 20, maximo: 0.5, ultima: false });
  assert.deepEqual(revisarDia(dia), { calidad: 'incompleto', motivo: 'falta la hora que acaba a medianoche' });
  // La de 23-24 h de Madrid acaba el 01/10 a las 22:00Z (00:00 del 02/10 en Madrid).
  const [conUltima] = agregarHoras([...veinte, filaObs('duero', { estacion: 'PL002', hora: '2026-10-01T22:00:00.000Z', mm: 4 })], '2026-10-01');
  assert.deepEqual(conUltima, { fuente: 'duero', estacion: 'PL002', fecha: '2026-10-01', mm: 14, horas: 21, maximo: 4, ultima: true });
  assert.deepEqual(revisarDia(conUltima), { calidad: 'ok', motivo: null });
  // Un nulo en esa hora no cuenta como tenerla.
  const [nula] = agregarHoras([...veinte, filaObs('duero', { estacion: 'PL002', hora: '2026-10-01T22:00:00.000Z', mm: null })], '2026-10-01');
  assert.equal(nula.ultima, false);
  // En invierno (UTC+1) la última hora del 01/12 acaba a las 23:00Z.
  assert.equal(agregarHoras([filaObs('aemet', { estacion: 'X', hora: '2026-12-01T23:00:00.000Z', mm: 0 })], '2026-12-01')[0].ultima, true);
  assert.equal(agregarHoras([filaObs('aemet', { estacion: 'X', hora: '2026-12-01T22:00:00.000Z', mm: 0 })], '2026-12-01')[0].ultima, false);
});

test('publicar: ayer con 20 horas sin la última no entra en ultimo.json (y queda incompleto en lluvia_dia)', async () => {
  const almacen = almacenPluvioMemoria();
  const est = [{ fuente: 'duero', codigo: 'PL002', nombre: 'Covaleda', lat: 41.95, lon: -2.87, altitud: 1450 }];
  await almacen.guardarObs(Array.from({ length: 20 }, (_, k) => filaObs('duero', { estacion: 'PL002', hora: new Date(Date.UTC(2026, 8, 30, 23 + k)).toISOString(), mm: 0.5 })));
  await ejecutar({ almacen, fetchFn: servidorFalso([]), esperar: sinEspera, ahora: new Date('2026-10-02T04:10:00Z'), estaciones: est,
    puntos: [{ id: 'p', lat: 41.95, lon: -2.87, altitud: 1450 }], pedidas: ['publicar'] });
  assert.equal(almacen.dias.get('duero|PL002|2026-10-01').calidad, 'incompleto');
  assert.equal('ultima' in almacen.dias.get('duero|PL002|2026-10-01'), false);   // lluvia_dia no tiene esa columna
  const p = almacen.archivos.get('pluvio/ultimo.json').lugares.p;
  assert.equal(p.mm.at(-1), null);   // el 01/10, sin medir: queda el modelo
  assert.deepEqual(p.estaciones, []);
});

test('la migración de la última hora: lluvia_por_dia devuelve si cada día tiene la hora que acaba a medianoche', () => {
  const sql = readFileSync('supabase/migrations/20261004000100_lluvia_ultima_hora.sql', 'utf8');
  assert.match(sql, /drop function public\.lluvia_por_dia\(date\)/);
  assert.match(sql, /ultima boolean\[\]/);
  assert.match(sql, /\(o\.hora at time zone 'Europe\/Madrid'\)::time = time '00:00'/);
  assert.match(sql, /revoke all on function public\.lluvia_por_dia\(date\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.lluvia_por_dia\(date\) to service_role/);
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
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T04:10:00Z')), ['tajo', 'publicar']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T16:10:00Z')), ['tajo', 'publicar']);
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

// El desfase de Madrid se guarda por hora UTC (Intl es caro en la Edge Function): debe dar lo mismo que Intl en cada
// hora del año, con los dos cambios de hora.
test('tiempo: día y hora de Madrid sin Intl por llamada, iguales a Intl todo el año', () => {
  const ref = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const local = (ms) => { const p = Object.fromEntries(ref.formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return [`${p.year}-${p.month}-${p.day}`, `${p.hour}:${p.minute}`]; };
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 3600e3) {
    const iso = new Date(ms).toISOString();
    assert.equal(fechaMadridDeFin(iso), hoyMadrid(new Date(ms - 60e3)), iso);
    const [fecha, hhmm] = local(ms), vuelta = utcDeMadrid(fecha, hhmm);
    // En la hora repetida de octubre se toma la primera (verano): la segunda 02:00 vuelve a la 00:00Z.
    assert.ok(vuelta === iso || (Date.parse(iso) - Date.parse(vuelta) === 3600e3 && fecha === '2026-10-25'), `${iso} → ${fecha} ${hhmm} → ${vuelta}`);
  }
  assert.equal(utcDeMadrid('2026-03-29', '02:00'), null);   // no existe
  assert.equal(utcDeMadrid('2026-03-29', '03:00'), '2026-03-29T01:00:00.000Z');
  assert.equal(utcDeMadrid('2026-10-25', '02:00'), '2026-10-25T00:00:00.000Z');
  assert.equal(utcDeMadrid('2026-10-25', '03:00'), '2026-10-25T02:00:00.000Z');
  assert.equal(fechaMadridDeFin('2026-10-01T22:00:00.000Z'), '2026-10-01');   // la hora que acaba a las 00:00 de Madrid
});

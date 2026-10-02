// tests/pluvio-recolector.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { utcDeMadrid, horaDeTexto, fechaMadridDeFin, finDeDia, esHoraEnPunto } from '../supabase/functions/pluvio/tiempo.js';
import { crearPedir, PlazoAgotado, PAUSA_MS, ESPERA_REINTENTO_MS } from '../supabase/functions/pluvio/red.js';
import { horasDeEstacionTajo, horasDeGraficoTajo, cadenaTajo, enlacesDeTablaTajo, estacionesDeTablaTajo, leerTajo } from '../supabase/functions/pluvio/lectores/tajo.js';
import { horaDeFint, horasDeAemet, leerAemet } from '../supabase/functions/pluvio/lectores/aemet.js';
import { ejecutar, fuentesQueTocan, unicas, filaObs } from '../supabase/functions/pluvio/manejador.js';
import { claveValida } from '../supabase/functions/_shared/clave.js';
import { claveValida as claveRejilla } from '../supabase/functions/rejilla/manejador.js';
import { fixture, fixtureJson, respuesta, servidorFalso, rutasTajo, rutasAemet, almacenPluvioMemoria } from './dobles-pluvio.js';

const leer = (r) => readFileSync(r, 'utf8');
const r1 = (x) => Math.round(x * 10) / 10;
const suma = (filas) => r1(filas.reduce((t, f) => t + (f.mm ?? 0), 0));
const sinEspera = async () => {};
const pedirCon = (rutas, registro) => crearPedir({ fetchFn: servidorFalso(rutas, registro), esperar: sinEspera });
const P26 = { fuente: 'tajo', codigo: 'P_26', url: 'index.php?w=get-estacion&x=guardada' };

// ---- tiempo ----
test('hora de Madrid a UTC: verano, invierno, hora repetida y hora que no existe', () => {
  assert.equal(horaDeTexto('01/10/2026 10:00'), '2026-10-01T08:00:00.000Z');
  assert.equal(horaDeTexto('15/11/2026 10:00'), '2026-11-15T09:00:00.000Z');
  assert.equal(utcDeMadrid('2026-10-25', '02:00'), '2026-10-25T00:00:00.000Z');   // la primera de las dos (verano)
  assert.equal(utcDeMadrid('2026-03-29', '02:30'), null);
  assert.equal(horaDeTexto('2026-10-01 10:00'), null);
  assert.equal(horaDeTexto(undefined), null);
});

test('el día de un valor es el de Madrid de su fin menos un minuto; fin del día de Madrid', () => {
  assert.equal(fechaMadridDeFin('2026-10-01T22:00:00.000Z'), '2026-10-01');   // la hora que acaba a las 00:00 es del día anterior
  assert.equal(fechaMadridDeFin('2026-10-01T23:00:00.000Z'), '2026-10-02');
  assert.equal(finDeDia('2026-09-30'), '2026-09-30T22:00:00.000Z');
  assert.equal(esHoraEnPunto('2026-10-01T08:00:00.000Z'), true);
  assert.equal(esHoraEnPunto('2026-10-01T08:15:00.000Z'), false);
  assert.equal(esHoraEnPunto('ayer'), false);
});

// ---- red ----
test('red: un 503 se reintenta una vez tras esperar; un 404, no', async () => {
  let n = 0;
  const esperas = [];
  const pedir = crearPedir({ fetchFn: async () => (++n === 1 ? respuesta(503, 'ocupado') : respuesta(200, { ok: 1 })), esperar: async (ms) => esperas.push(ms) });
  assert.deepEqual(await pedir('https://a.es/x'), { ok: 1 });
  assert.deepEqual(esperas, [ESPERA_REINTENTO_MS, PAUSA_MS]);
  const pedir404 = crearPedir({ fetchFn: async () => respuesta(404, 'no'), esperar: sinEspera });
  await assert.rejects(pedir404('https://a.es/y'), /a\.es respondió 404/);
});

test('red: cortesía (pausa entre peticiones al mismo servidor, no entre servidores) y agente identificado', async () => {
  const esperas = [], registro = [];
  const pedir = crearPedir({ fetchFn: servidorFalso([[() => true, () => respuesta(200, 'x')]], registro), esperar: async (ms) => esperas.push(ms) });
  await pedir('https://a.es/1', { como: 'texto' });
  await pedir('https://b.es/1', { como: 'texto' });
  await pedir('https://a.es/2', { como: 'texto' });
  assert.deepEqual(esperas, [PAUSA_MS]);
  assert.match(registro[0].cabeceras['User-Agent'], /^setas-app\/1\.0/);
});

test('red: sin margen no se pide (PlazoAgotado)', async () => {
  const registro = [];
  const pedir = crearPedir({ fetchFn: servidorFalso([], registro), esperar: sinEspera, margen: () => 1000 });
  await assert.rejects(pedir('https://a.es/'), PlazoAgotado);
  assert.equal(registro.length, 0);
});

// ---- SAIH Tajo (respuestas reales del 02/10/2026) ----
test('Tajo, ficha de estación: las 23 horas en punto de las últimas 24 h (el registro vacío final se ignora)', () => {
  const filas = horasDeEstacionTajo(fixtureJson('tajo-estacion-P_26.json'), 'P_26');
  assert.equal(filas.length, 23);
  assert.deepEqual(filas[0], { estacion: 'P_26', hora: '2026-10-01T08:00:00.000Z', mm: 0 });
  assert.deepEqual(filas.at(-1), { estacion: 'P_26', hora: '2026-10-02T06:00:00.000Z', mm: 10 });
  assert.equal(suma(filas), 14.6);
});

test('Tajo, 10 días: solo se suman las horas en punto (la señal es «última hora» cada 15 min)', () => {
  const json = fixtureJson('tajo-grafico-P_26.json');
  const valores = json.response.senal.valores;
  assert.equal(valores.length, 963);
  const filas = horasDeGraficoTajo(json, 'P_26');
  assert.equal(filas.length, 241);
  assert.equal(filas[0].hora, '2026-09-22T07:00:00.000Z');
  assert.equal(filas.at(-1).hora, '2026-10-02T07:00:00.000Z');
  assert.equal(suma(filas), 28.2);
  assert.equal(r1(valores.reduce((t, v) => t + v.valor, 0)), 115.8, 'sumar los cuatro valores de cada hora daría cuatro veces más');
});

test('Tajo: la cadena portada → entorno → menú → tabla, y los enlaces de cada estación', async () => {
  const registro = [];
  const tabla = await cadenaTajo(pedirCon(rutasTajo(), registro));
  assert.deepEqual(registro.map((r) => r.url.match(/w=([a-z-]+)/)?.[1] ?? 'portada'), ['portada', 'get-wrapperentorno', 'get-menu', 'get-pluviometria']);
  const enlaces = enlacesDeTablaTajo(tabla);
  assert.match(enlaces.get('P_26'), /^index\.php\?w=get-estacion&x=/);
  const est = estacionesDeTablaTajo(tabla);
  assert.deepEqual(est.find((e) => e.codigo === 'P_26'), { codigo: 'P_26', nombre: 'OLLA DEL QUIÑON EN BUSTARVIEJO', tipo: 'pluviometro',
    x: 435403.9, y: 4522055.4, altitud: 1279, url: enlaces.get('P_26') });
});

test('Tajo: usa la URL guardada; si falla, rehace la cadena una vez y sigue con las demás', async () => {
  const registro = [];
  const rutas = [[(u) => u.includes('x=guardada'), () => respuesta(200, { response: { ok: 0 } })], ...rutasTajo()];
  const r = await leerTajo({ pedir: pedirCon(rutas, registro), estaciones: [P26, { ...P26, codigo: 'PN24' }, { ...P26, codigo: 'NOEXISTE' }] });
  assert.equal(r.filas.filter((f) => f.estacion === 'P_26').length, 23);
  assert.equal(r.filas.filter((f) => f.estacion === 'PN24').length, 23);
  assert.deepEqual(r.errores, ['NOEXISTE: no está en la tabla del SAIH Tajo']);
  assert.equal(registro.filter((x) => x.url.includes('get-pluviometria')).length, 1, 'la tabla (2 MB) se pide una sola vez');
});

test('Tajo: con la tabla ya cargada va directo a su enlace; si la cadena falla, no se repite por estación', async () => {
  const registro = [];
  const rutas = [[(u) => u.includes('x=guardada'), () => respuesta(200, { response: { ok: 0 } })], ...rutasTajo()];
  await leerTajo({ pedir: pedirCon(rutas, registro), estaciones: [P26, { ...P26, codigo: 'PN24' }] });
  assert.equal(registro.filter((x) => x.url.includes('x=guardada')).length, 1, 'PN24 ya no prueba la URL guardada');
  const registro2 = [];
  const rotas = [[(u) => u.includes('x=guardada'), () => respuesta(200, { response: { ok: 0 } })], [(u) => u === 'https://saihtajo.chtajo.es/', () => respuesta(404, 'no')]];
  const r = await leerTajo({ pedir: pedirCon(rotas, registro2), estaciones: ['A', 'B', 'C'].map((codigo) => ({ ...P26, codigo })) });
  assert.deepEqual(r.errores, ['A', 'B', 'C'].map((c) => `${c}: saihtajo.chtajo.es respondió 404`));
  assert.equal(registro2.filter((x) => x.url === 'https://saihtajo.chtajo.es/').length, 1, 'la portada se pide una sola vez');
});

// Review Focus 2: el portal contesta 200 con otra cosa.
test('Tajo: una respuesta sin la señal de lluvia es un error, no ceros', async () => {
  const rutas = [[() => true, () => respuesta(200, { response: { ok: 1, senales: [{ tiposenal: 'T', valores: [{ tiempo: '02/10/2026 08:00', valor: 0 }] }] } })]];
  const r = await leerTajo({ pedir: pedirCon(rutas), estaciones: [P26] });
  assert.deepEqual(r.filas, []);
  assert.deepEqual(r.errores, ['P_26: sin señal de lluvia (P1)']);
});

// ---- AEMET horario ----
test('AEMET: fint con +0000, solo la lista blanca, sin prec no hay fila', () => {
  assert.equal(horaDeFint('2026-10-02T06:00:00+0000'), '2026-10-02T06:00:00.000Z');
  assert.equal(horaDeFint('2026-10-02T06:00:00'), '2026-10-02T06:00:00.000Z');
  assert.equal(horaDeFint('2026-10-02T06:30:00+0000'), null);
  assert.deepEqual(horasDeAemet([{ idema: '2462', fint: '2026-10-02T06:00:00', prec: 0.5 }], new Set(['2462'])),
    [{ estacion: '2462', hora: '2026-10-02T06:00:00.000Z', mm: 0.5 }]);
  const filas = horasDeAemet(fixtureJson('aemet-convencional.json'), new Set(['3104Y', '2462']));   // fixture SINTÉTICA, fint sin zona
  assert.deepEqual(filas, [
    { estacion: '3104Y', hora: '2026-10-02T05:00:00.000Z', mm: 0 },
    { estacion: '3104Y', hora: '2026-10-02T06:00:00.000Z', mm: 1.2 },
    { estacion: '2462', hora: '2026-10-02T06:00:00.000Z', mm: 3.4 }]);
});

test('AEMET: dos pasos con la clave en la cabecera; un estado distinto de 200 es un error', async () => {
  const registro = [];
  const r = await leerAemet({ pedir: pedirCon(rutasAemet(), registro), clave: 'clave-falsa', estaciones: [{ codigo: '3104Y' }] });
  assert.equal(r.filas.length, 2);
  assert.equal(registro[0].cabeceras.api_key, 'clave-falsa');
  await assert.rejects(leerAemet({ pedir: pedirCon(rutasAemet(401)), clave: 'x', estaciones: [] }), /AEMET 401/);
  await assert.rejects(leerAemet({ pedir: pedirCon(rutasAemet()), clave: null, estaciones: [] }), /sin clave/);
  const noLista = [rutasAemet()[0], [(u) => u.includes('/opendata/sh/datos-falsos'), () => respuesta(200, { estado: 404, descripcion: 'No hay datos' })]];
  await assert.rejects(leerAemet({ pedir: pedirCon(noLista), clave: 'x', estaciones: [{ codigo: '3104Y' }] }), /no son una lista/);
});

// ---- manejador ----
test('qué toca a cada hora UTC (minuto 10) y las pedidas a mano', () => {
  const a = (h) => new Date(`2026-10-02T${String(h).padStart(2, '0')}:10:00Z`);
  assert.deepEqual(fuentesQueTocan(a(0)), ['aemet']);
  assert.deepEqual(fuentesQueTocan(a(1)), ['tajo']);
  assert.deepEqual(fuentesQueTocan(a(2)), ['tajo10']);
  assert.deepEqual(fuentesQueTocan(a(5)), []);
  assert.deepEqual(fuentesQueTocan(a(5), ['tajo10', 'aemet', 'nada']), ['aemet', 'tajo10']);
});

test('ejecutar: guarda cada hora con su fuente y su calidad; tajo10 se guarda como tajo; sin clave de AEMET, Tajo sigue', async () => {
  const almacen = almacenPluvioMemoria();
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([...rutasTajo(), ...rutasAemet()]), esperar: sinEspera,
    estaciones: [P26, { fuente: 'aemet', codigo: '3104Y' }], pedidas: ['aemet', 'tajo10'] });
  assert.equal(r.estado, 'hecho');
  assert.deepEqual(r.filas, { tajo10: 241 });
  assert.deepEqual(r.errores, ['aemet: sin clave (falta el secreto AEMET_API_KEY)']);
  const una = almacen.obs.get('tajo|P_26|2026-10-02T06:00:00.000Z');
  assert.deepEqual(una, { fuente: 'tajo', estacion: 'P_26', hora: '2026-10-02T06:00:00.000Z', horas: 1, mm: 10, calidad: 'ok' });
});

test('cambio de hora: la noche del 25/10/2026, la segunda 02:00 de Madrid es 01:00Z', () => {
  const valores = ['00:00', '01:00', '02:00', '02:00', '03:00', '04:00'].map((h, k) => ({ tiempo: `25/10/2026 ${h}`, valor: k / 10 }));
  const filas = horasDeGraficoTajo({ response: { senal: { valores } } }, 'P_26');
  assert.deepEqual(filas.map((x) => x.hora), ['2026-10-24T22:00:00.000Z', '2026-10-24T23:00:00.000Z', '2026-10-25T00:00:00.000Z',
    '2026-10-25T01:00:00.000Z', '2026-10-25T02:00:00.000Z', '2026-10-25T03:00:00.000Z']);
  assert.deepEqual(filas.map((x) => x.mm), [0, 0.1, 0.2, 0.3, 0.4, 0.5]);
});

test('ejecutar: si falla el guardado de una tarea, se apunta y sigue con la siguiente', async () => {
  const almacen = almacenPluvioMemoria();
  const guardar = almacen.guardarObs;
  let n = 0;
  almacen.guardarObs = async (filas) => { if (++n === 1) throw new Error('base caída'); return guardar(filas); };
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([...rutasTajo(), ...rutasAemet()]), esperar: sinEspera, claveAemet: 'clave-falsa',
    estaciones: [P26, { fuente: 'aemet', codigo: '3104Y' }], pedidas: ['aemet', 'tajo'] });
  assert.equal(r.estado, 'hecho');
  assert.deepEqual(r.errores, ['aemet: base caída']);
  assert.deepEqual(r.filas, { tajo: 23 });
  assert.equal(almacen.obs.size, 23);
});

// Review Focus 1: 25 de octubre, la misma hora local dos veces en un lote.
test('cambio de hora: la hora repetida se guarda como la siguiente UTC y el lote no se rompe', async () => {
  const valores = [{ tiempo: '25/10/2026 01:00', valor: 0.2 }, { tiempo: '25/10/2026 02:00', valor: 0.4 }, { tiempo: '25/10/2026 02:00', valor: 0.6 }, { tiempo: '25/10/2026 03:00', valor: 0 }];
  const grafico = { response: { senal: { valores } } };
  const estacion = { response: { ok: 1, senales: [{ tiposenal: 'P1', url: 'index.php?w=get-estacion-grafico-grande&x=g', valores: [] }] } };
  const rutas = [[(u) => u.includes('grafico-grande'), () => respuesta(200, grafico)], [() => true, () => respuesta(200, estacion)]];
  const almacen = almacenPluvioMemoria();
  const r = await ejecutar({ almacen, fetchFn: servidorFalso(rutas), esperar: sinEspera, estaciones: [P26], pedidas: ['tajo10'] });
  assert.deepEqual(r.errores, []);
  assert.equal(almacen.obs.size, 4);
  assert.equal(almacen.obs.get('tajo|P_26|2026-10-25T00:00:00.000Z').mm, 0.4);
  assert.equal(almacen.obs.get('tajo|P_26|2026-10-25T01:00:00.000Z').mm, 0.6);
  assert.equal(unicas([filaObs('tajo', { estacion: 'a', hora: 'h', mm: 1 }), filaObs('tajo', { estacion: 'a', hora: 'h', mm: 2 })])[0].mm, 2);
});

test('plazo agotado a mitad: guarda lo leído y para', async () => {
  let t = 0;
  const reloj = () => t;
  const fetchFn = async (url) => { t += 60000; return servidorFalso(rutasTajo())(url); };
  const almacen = almacenPluvioMemoria();
  const est = ['A', 'B', 'C', 'D'].map((c) => ({ ...P26, codigo: c, url: 'index.php?w=get-estacion&x=ok' }));
  const r = await ejecutar({ almacen, fetchFn, esperar: sinEspera, reloj, estaciones: est, pedidas: ['tajo'] });
  assert.equal(r.estado, 'plazo-agotado');
  assert.equal(r.filas.tajo, 23 * 2);   // A y B antes del plazo; C ya no cabe
  assert.equal(almacen.obs.size, 46);
});

// ---- piezas de Deno, migraciones y lista blanca ----
test('clave: la misma función en _shared y en rejilla; index.ts la usa con x-pluvio-clave', () => {
  assert.equal(claveValida, claveRejilla);
  assert.equal(claveValida('abcdefghijklmnopqrstuvwxyz012345', 'abcdefghijklmnopqrstuvwxyz012345'), true);
  assert.equal(claveValida(null, undefined), false);
  const index = leer('supabase/functions/pluvio/index.ts');
  assert.match(index, /claveValida\(req\.headers\.get\('x-pluvio-clave'\), Deno\.env\.get\('PLUVIO_CLAVE'\)\)/);
  assert.match(index, /req\.method !== 'POST'/);
});

test('migraciones: lluvia_obs cerrada, limpieza y pg_cron cada hora en el minuto 10, sin claves', () => {
  const sql = leer('supabase/migrations/20261003000000_pluvio.sql');
  assert.match(sql, /alter table public\.lluvia_obs enable row level security/);
  assert.doesNotMatch(sql, /create policy/);
  assert.match(sql, /revoke all on public\.lluvia_obs from anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on public\.lluvia_obs to service_role/);
  assert.match(sql, /primary key \(fuente, estacion, hora\)/);
  const cron = leer('supabase/migrations/20261003000100_pluvio_cron.sql');
  assert.match(cron, /cron\.schedule\('pluvio-hora', '10 \* \* \* \*'/);
  assert.match(cron, /name = 'pluvio_clave'/);
  for (const t of [sql, cron]) assert.doesNotMatch(t, /sb_secret|eyJ|sb_publishable/);
});

test('lista blanca: AEMET = la de la función aemet; las de Tajo, con su URL', () => {
  const lista = JSON.parse(leer('supabase/functions/pluvio/estaciones.json'));
  const aemet = JSON.parse(leer('supabase/functions/aemet/estaciones.json'));
  assert.deepEqual(lista.filter((e) => e.fuente === 'aemet').map((e) => e.codigo).sort(), [...aemet].sort());
  for (const e of lista.filter((x) => x.fuente === 'tajo')) assert.match(e.url, /^index\.php\?w=get-estacion&x=/, e.codigo);
});

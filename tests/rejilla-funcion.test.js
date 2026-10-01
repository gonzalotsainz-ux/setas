// tests/rejilla-funcion.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ejecutar, claveValida, PLAZO_EJECUCION, RESERVA_PUBLICAR } from '../supabase/functions/rejilla/manejador.js';
import { openMeteoFalso, almacenMemoria } from './dobles-rejilla.js';
import { validarSalida, diaConDatos } from '../js/rejilla/salida.js';

const MANANA = new Date('2026-10-01T05:00:00Z'), TARDE = new Date('2026-10-01T17:00:00Z');   // 07:00 y 19:00 en Madrid
const gruesa = (n) => ({ celdas: Array.from({ length: n }, (_, k) => ({ id: `z:${k}:0`, zona: 'z', lat: 40 + k * 0.01, lon: -4, altRef: 1000 + k })) });
const esperar = async () => {};
const leer = (ruta) => readFileSync(ruta, 'utf8');

test('fuera de hora no hace nada', async () => {
  const registro = [], almacen = almacenMemoria();
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01', registro }), ahora: new Date('2026-10-01T06:00:00Z'), gruesa: gruesa(3), esperar });
  assert.equal(r.estado, 'fuera-de-hora');
  assert.equal(registro.length, 0);
  assert.equal(almacen.ejecuciones.size, 0, 'fuera de hora no gasta el sello');
});

test('primera ejecución: rellena, calcula y publica el índice y el puntero', async () => {
  const almacen = almacenMemoria();
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(10), esperar, trozo: 5 });
  assert.equal(r.estado, 'publicado');
  assert.equal(r.conDatos, 10);
  const ultimo = await almacen.leerJson('ultimo.json');
  assert.deepEqual({ ...ultimo, generado: null }, { version: 1, sello: '2026-10-01T07', archivo: '2026-10-01T07.json', generado: null, conDatos: 10, total: 10 });
  const salida = await almacen.leerJson('2026-10-01T07.json');
  assert.deepEqual(validarSalida(salida), []);
  assert.equal(salida.fechas[0], '2026-10-01');
  assert.equal(salida.fechas.length, 10);
  assert.equal(Object.keys(salida.celdas).length, 10);
  assert.equal(salida.celdas['z:3:0'].altRef, 1003);
  assert.ok(salida.celdas['z:0:0'].dias[0][3] != null, 'con climatología, percentil del suelo');
});

test('segunda ejecución del día: solo pide 2 días atrás y la previsión', async () => {
  const almacen = almacenMemoria();
  await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(10), esperar, trozo: 5 });
  const registro = [];
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01', registro }), ahora: TARDE, gruesa: gruesa(10), esperar, trozo: 5 });
  assert.equal(r.estado, 'publicado');
  const principales = registro.filter((u) => u.includes('api.open-meteo.com/v1/forecast'));
  assert.ok(principales.length > 0);
  for (const u of principales) assert.equal(new URL(u).searchParams.get('past_days'), '2');
  assert.ok(!registro.some((u) => u.includes('archive-api')), 'la climatología ya estaba');
  assert.equal(r.peso, 10);
});

test('presupuesto corto: rellena las que caben y, bajo el 90 %, no publica', async () => {
  const almacen = almacenMemoria();
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(20), esperar, presupuesto: 30 });
  assert.equal(r.estado, 'sin-publicar');
  assert.equal(r.conDatos, 5);   // 30 / (71 / 14)
  assert.ok(r.peso <= 30);
  assert.equal(await almacen.leerJson('ultimo.json'), null);
});

// Review Focus 2: Open-Meteo responde 429 o falla en un trozo.
test('429 persistente en un trozo: esas celdas sin datos, no se publica y queda el índice anterior', async () => {
  const almacen = almacenMemoria();
  await almacen.subir('ultimo.json', { version: 1, sello: '2026-09-30T19', archivo: '2026-09-30T19.json' });
  const primeras = '40,40.01,40.02,40.03,40.04';
  const r = await ejecutar({ almacen, ahora: MANANA, gruesa: gruesa(10), esperar, trozo: 5,
    fetchFn: openMeteoFalso({ hoy: '2026-10-01', fallos: (u) => u.searchParams.get('latitude') === primeras && !u.hostname.startsWith('archive') }) });
  assert.equal(r.estado, 'sin-publicar');
  assert.equal(r.conDatos, 5);
  assert.ok(r.errores.some((e) => /429/.test(e)));
  assert.equal((await almacen.leerJson('ultimo.json')).sello, '2026-09-30T19');
  assert.deepEqual(await almacen.listar(''), ['ultimo.json'], 'no se sube ningún índice nuevo');
});

test('429 persistente por la tarde: la previsión de la mañana guardada no cuenta como dato de esta ejecución', async () => {
  const almacen = almacenMemoria();
  await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(10), esperar, trozo: 5 });
  const primeras = '40,40.01,40.02,40.03,40.04';
  const r = await ejecutar({ almacen, ahora: TARDE, gruesa: gruesa(10), esperar, trozo: 5,
    fetchFn: openMeteoFalso({ hoy: '2026-10-01', fallos: (u) => u.searchParams.get('latitude') === primeras }) });
  assert.equal(r.estado, 'sin-publicar');
  assert.equal(r.conDatos, 5, 'las 5 celdas que fallaron no cuentan aunque tengan filas de la mañana');
  assert.equal((await almacen.leerJson('ultimo.json')).sello, '2026-10-01T07', 'sigue valiendo el índice de la mañana');
});

test('una celda que falla por la tarde no sale en el índice aunque se publique con las demás', async () => {
  const almacen = almacenMemoria();
  await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(10), esperar, trozo: 1 });
  const r = await ejecutar({ almacen, ahora: TARDE, gruesa: gruesa(10), esperar, trozo: 1,
    fetchFn: openMeteoFalso({ hoy: '2026-10-01', fallos: (u) => u.searchParams.get('latitude') === '40' }) });
  assert.equal(r.estado, 'publicado');
  assert.equal(r.conDatos, 9);
  const salida = await almacen.leerJson('2026-10-01T19.json');
  assert.ok(!('z:0:0' in salida.celdas), 'sin petición principal buena en esta ejecución: fuera (el móvil la pinta en gris)');
  assert.equal(Object.keys(salida.celdas).length, 9);
});

test('un 429 suelto se reintenta tras esperar y se publica', async () => {
  const esperas = [];
  const r = await ejecutar({ almacen: almacenMemoria(), ahora: MANANA, gruesa: gruesa(4), trozo: 5, esperar: async (ms) => { esperas.push(ms); },
    fetchFn: openMeteoFalso({ hoy: '2026-10-01', fallos: (u, n) => n === 1 }) });
  assert.equal(r.estado, 'publicado');
  assert.deepEqual(esperas, [5000]);
});

test('en dos lotes: el primero deja su parte y el segundo junta y publica', async () => {
  const almacen = almacenMemoria(), fetchFn = openMeteoFalso({ hoy: '2026-10-01' });
  const r0 = await ejecutar({ almacen, fetchFn, ahora: MANANA, gruesa: gruesa(10), esperar, lote: 0, lotes: 2 });
  assert.equal(r0.estado, 'parcial');
  assert.equal(await almacen.leerJson('ultimo.json'), null);
  const r1 = await ejecutar({ almacen, fetchFn, ahora: MANANA, gruesa: gruesa(10), esperar, lote: 1, lotes: 2 });
  assert.equal(r1.estado, 'publicado');
  assert.equal(r1.conDatos, 10);
  assert.equal(Object.keys((await almacen.leerJson('2026-10-01T07.json')).celdas).length, 10);
  assert.deepEqual(await almacen.listar('parcial/2026-10-01T07'), []);
});

test('celdas repetidas entre zonas: se publica la altitud con la que se pidió la meteo', async () => {
  const registro = [], almacen = almacenMemoria();
  const g = { celdas: [
    { id: 'a:1:1', zona: 'a', lat: 40, lon: -4, altRef: 1000, nFinas: 30 },
    { id: 'b:1:1', zona: 'b', lat: 40, lon: -4, altRef: 1400, nFinas: 10 },
    { id: 'a:2:1', zona: 'a', lat: 40.1, lon: -4, altRef: 900 },
  ] };
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01', registro }), ahora: MANANA, gruesa: g, esperar });
  assert.equal(r.estado, 'publicado');
  const principal = registro.find((u) => u.includes('/v1/forecast'));
  assert.equal(new URL(principal).searchParams.get('elevation'), '1100,900');   // (1000·30 + 1400·10) / 40
  const salida = await almacen.leerJson('2026-10-01T07.json');
  assert.equal(salida.celdas['a:1:1'].altRef, 1100);
  assert.equal(salida.celdas['b:1:1'].altRef, 1100);
  assert.equal(salida.celdas['a:2:1'].altRef, 900);
});

test('una previsión vieja guardada no rellena los días que la de hoy no trae', async () => {
  const almacen = almacenMemoria();
  await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(4), esperar });
  // Al día siguiente Open-Meteo solo devuelve 3 días de previsión: del 5 en adelante solo hay la del día 1.
  const corta = openMeteoFalso({ hoy: '2026-10-02' });
  const fetchFn = (url, o) => { const u = new URL(url); if (u.searchParams.has('forecast_days')) u.searchParams.set('forecast_days', '3'); return corta(u.toString(), o); };
  const r = await ejecutar({ almacen, fetchFn, ahora: new Date('2026-10-02T05:00:00Z'), gruesa: gruesa(4), esperar });
  assert.equal(r.estado, 'publicado');
  const c = (await almacen.leerJson('2026-10-02T07.json')).celdas['z:0:0'];
  assert.ok(diaConDatos(c.dias[0]));
  for (let k = 3; k < 10; k++) assert.ok(!c.dias[k]?.slice(0, 8).some((v) => v != null), `día ${k}: sin previsión renovada`);
});

test('un sello no se ejecuta dos veces, tampoco con forzar; otro lote sí', async () => {
  const almacen = almacenMemoria();
  const r0 = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(4), esperar });
  assert.equal(r0.estado, 'publicado');
  for (const forzar of [false, true]) {
    const registro = [];
    const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01', registro }), ahora: new Date('2026-10-01T05:40:00Z'), gruesa: gruesa(4), esperar, forzar });
    assert.equal(r.estado, 'repetido');
    assert.equal(r.sello, '2026-10-01T07');
    assert.equal(registro.length, 0);
  }
  const r2 = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(4), esperar, lote: 1, lotes: 2 });
  assert.equal(r2.estado, 'parcial');
  const rf = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: new Date('2026-10-01T08:00:00Z'), gruesa: gruesa(4), esperar, forzar: true });
  assert.equal(rf.estado, 'publicado', 'forzar fuera de hora usa su propio sello');
  assert.equal(rf.sello, '2026-10-01T10');
});

// Plazo global: la ejecución tiene que acabar antes de los 150 s de reloj de Supabase, reintentos incluidos.
const relojFalso = () => { let t = 0; return { reloj: () => t, avanzar: (ms) => { t += ms; } }; };

test('el plazo se agota: deja de pedir con margen para publicar, no publica y queda el índice anterior', async () => {
  assert.ok(PLAZO_EJECUCION < 150000 && RESERVA_PUBLICAR > 0);
  const almacen = almacenMemoria(), { reloj, avanzar } = relojFalso(), base = openMeteoFalso({ hoy: '2026-10-01' }), tramos = [];
  await almacen.subir('ultimo.json', { version: 1, sello: '2026-09-30T19', archivo: '2026-09-30T19.json' });
  const fetchFn = async (url, o) => { const t0 = reloj(); avanzar(30000); tramos.push([t0, reloj()]); return base(url, o); };
  const r = await ejecutar({ almacen, fetchFn, ahora: MANANA, gruesa: gruesa(10), trozo: 2, esperar, reloj });
  assert.equal(r.estado, 'sin-publicar');
  assert.ok(r.errores.some((e) => /plazo/.test(e)));
  assert.ok(tramos.length < 15, 'no se hacen todas las peticiones');
  for (const [t0] of tramos) assert.ok(t0 < PLAZO_EJECUCION - RESERVA_PUBLICAR, `petición empezada a los ${t0} ms`);
  assert.ok(Math.max(...tramos.map(([, t1]) => t1)) < 150000);
  assert.equal((await almacen.leerJson('ultimo.json')).sello, '2026-09-30T19');
});

test('el plazo se agota: una espera de reintento que no cabe no se hace', async () => {
  const almacen = almacenMemoria(), { reloj, avanzar } = relojFalso(), esperas = [];
  const fetchFn = async () => { avanzar(70000); return { ok: false, status: 429, headers: new Map([['retry-after', '60']]), json: async () => ({}) }; };
  const r = await ejecutar({ almacen, fetchFn, ahora: MANANA, gruesa: gruesa(1), reloj,
    esperar: async (ms) => { esperas.push(ms); avanzar(ms); } });
  assert.equal(r.estado, 'sin-publicar');
  assert.deepEqual(esperas, []);
  assert.ok(reloj() < 150000);
  assert.equal(await almacen.leerJson('ultimo.json'), null);
});

// Review Focus 3: cambio de hora del 25/10/2026. pg_cron lanza a las 05 y 06 UTC; solo trabaja la de las 07 de Madrid.
test('25 de octubre: a las 05 UTC (06 en Madrid) no hace nada; a las 06 UTC publica el sello de las 07', async () => {
  const almacen = almacenMemoria(), registro = [];
  const r5 = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-25', registro }), ahora: new Date('2026-10-25T05:00:00Z'), gruesa: gruesa(3), esperar });
  assert.equal(r5.estado, 'fuera-de-hora');
  assert.equal(registro.length, 0);
  const r6 = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-25' }), ahora: new Date('2026-10-25T06:00:00Z'), gruesa: gruesa(3), esperar });
  assert.equal(r6.estado, 'publicado');
  assert.equal(r6.sello, '2026-10-25T07');
  const salida = await almacen.leerJson('2026-10-25T07.json');
  assert.equal(salida.hoy, '2026-10-25');
  assert.equal(salida.fechas[0], '2026-10-25');
  assert.equal(new Date(salida.generado).toISOString(), '2026-10-25T06:00:00.000Z');
  const r24 = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-24' }), ahora: new Date('2026-10-24T06:00:00Z'), gruesa: gruesa(3), esperar });
  assert.equal(r24.estado, 'fuera-de-hora', 'el 24 aún es verano: a las 06 UTC son las 08');
});

// Review Focus 5: una fila mala en ajustes_umbrales no puede llegar al índice publicado.
test('la función no lee umbrales: publica agregados de meteo, sin notas de especie', async () => {
  for (const n of readdirSync('supabase/functions/rejilla')) {
    if (!/\.(js|ts)$/.test(n)) continue;
    const src = leer(`supabase/functions/rejilla/${n}`);
    assert.doesNotMatch(src, /umbrales|ajustes_umbrales|especies/, n);
  }
  const almacen = almacenMemoria();
  await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(2), esperar });
  const c = (await almacen.leerJson('2026-10-01T07.json')).celdas['z:0:0'];
  assert.deepEqual(Object.keys(c).sort(), ['altRef', 'dias', 'incompleta', 'lluvia']);
  assert.ok(c.dias.every((d) => d === null || (d.length === 15 && d.every((v) => v === null || Number.isFinite(v)))));
});

test('clave: solo vale la del secreto, y sin secreto nadie entra', () => {
  assert.equal(claveValida('abcdefghijklmnopqrstuvwxyz012345', 'abcdefghijklmnopqrstuvwxyz012345'), true);
  assert.equal(claveValida('abcdefghijklmnopqrstuvwxyz012346', 'abcdefghijklmnopqrstuvwxyz012345'), false);
  assert.equal(claveValida('abc', 'abcdefghijklmnopqrstuvwxyz012345'), false);
  assert.equal(claveValida(null, 'abcdefghijklmnopqrstuvwxyz012345'), false);
  assert.equal(claveValida('', ''), false);
  assert.equal(claveValida(undefined, undefined), false);
  const index = leer('supabase/functions/rejilla/index.ts');
  assert.match(index, /claveValida\(req\.headers\.get\('x-rejilla-clave'\), Deno\.env\.get\('REJILLA_CLAVE'\)\)/);
  assert.doesNotMatch(index, /presupuesto/, 'sin relleno rápido (Ruling D3): el presupuesto no se cambia desde fuera');
});

test('la migración deja las tablas cerradas y el bucket del índice público', () => {
  const sql = leer('supabase/migrations/20261002000000_rejilla.sql');
  for (const t of ['meteo_celdas', 'clima_celdas', 'rejilla_ejecuciones']) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
    assert.doesNotMatch(sql, new RegExp(`create policy[^;]*on public\\.${t}`));
  }
  assert.match(sql, /revoke all on public\.meteo_celdas, public\.clima_celdas, public\.rejilla_ejecuciones from anon, authenticated/);
  assert.match(sql, /values \('indice', 'indice', true/);
  assert.match(sql, /previsto boolean\[\], actualizado timestamptz\[\]/, 'series_celdas devuelve previsto y actualizado');
  for (const archivo of ['20261002000000_rejilla.sql', '20261002000100_rejilla_cron.sql']) {
    assert.doesNotMatch(leer(`supabase/migrations/${archivo}`), /sb_secret|service_role|eyJ/);
  }
});

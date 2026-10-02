// tests/pluvio-app.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarPluvio, combinarObs, cargarPluvio, URL_PLUVIO, PLUVIO_MAX_HORAS } from '../js/pluvio.js';
import { aplicarContraste, aplicarEstacion, distanciaKm, avisoViejo } from '../js/aemet.js';
import { calcularZona } from '../js/pantallas/hoy.js';
import { guardar } from '../js/cache.js';
import { VERSION_PLUVIO, distanciaKm as distanciaCompartida, factoresPorZona as factoresCompartidos } from '../supabase/functions/_shared/pluvio.js';
import { factoresPorZona } from '../supabase/functions/rejilla/nucleo.js';
import { entreDias } from '../js/meteo.js';
import { serieSintetica, BOLETUS, NISCALO, lluviaBuena, almacenFalso } from './ayudas.js';

const ZONA = { id: 'z', habitats: ['pinar-silvestre'], puntos: [{ id: 'a', altitud: 1500 }, { id: 'b', altitud: 1100 }], estacionesAemet: [{ id: 'E1', nombre: 'Uno', altitud: 1450 }] };
// Zona con dos puntos medidos por estaciones distintas y uno sin estación (Ruling de la tarea 12: hacen falta 2 estaciones).
const ZONA3 = { id: 'z3', habitats: ['pinar-silvestre'], puntos: [{ id: 'a', altitud: 1500 }, { id: 'b', altitud: 1100 }, { id: 'd', altitud: 1200 }], estacionesAemet: [] };
const OTRA = { id: 'o', habitats: ['pinar-silvestre'], puntos: [{ id: 'c', altitud: 1300 }], estacionesAemet: [] };
const especie = (e) => ({ ...e, nombre: e.id, categoria: 'comestible', habitats: ['pinar-silvestre'], zonas: { z: { presencia: 'comun' }, z3: { presencia: 'comun' }, o: { presencia: 'comun' } } });
const DATOS = { especies: [especie(BOLETUS), especie(NISCALO)] };
const meteoDe = () => { const s = serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena }); return { hoy: s.fechas[s.hoy], series: { a: s, b: s, c: s, d: s } }; };
const DESDE = '2026-08-01', HASTA = '2026-09-30', LARGO = entreDias(DESDE, HASTA) + 1;
const lugar = (v, nombre = 'Covaleda') => ({ mm: Array(LARGO).fill(v), n: Array(LARGO).fill(1), estaciones: [{ nombre, fuente: 'duero', km: 2 }], cercanas: 1 });
const GENERADO = '2026-10-01T04:10:00.000Z';
const pluvioCon = (lugares, extra = {}) => ({ version: VERSION_PLUVIO, generado: GENERADO, desde: DESDE, hasta: HASTA, lugares, ...extra });
const nota = (meteo, zona = ZONA) => calcularZona(zona, DATOS, meteo, 0, '', {}).res;
const obsE1 = (s, v) => ({ E1: Object.fromEntries(s.fechas.slice(34, 58).map((f) => [f, v])) });
const respuesta = (status, cuerpo) => ({ ok: status === 200, status, json: async () => cuerpo });

test('equivalencia: sin pluvio/ultimo.json, la meteo, las notas y el contraste AEMET son los de hoy', () => {
  const meteo = meteoDe(), obs = obsE1(meteo.series.a, 9);
  assert.equal(aplicarPluvio([ZONA], meteo, null), meteo);
  assert.deepEqual(nota(aplicarPluvio([ZONA], meteo, null)), nota(meteo));
  assert.equal(combinarObs(obs, null), obs);
  assert.deepEqual(aplicarContraste([ZONA], aplicarPluvio([ZONA], meteo, null), combinarObs(obs, null)), aplicarContraste([ZONA], meteo, obs));
  assert.ok(nota(meteo).valor != null, 'la prueba compara una nota de verdad');
});

test('equivalencia también con la copia vieja de AEMET (AEMET no responde): mismos datos y el mismo aviso', () => {
  const meteo = meteoDe(), obs = { ...obsE1(meteo.series.a, 9), __viejo: { creado: '2026-10-01T06:00:00.000Z' } };
  const c = combinarObs(obs, null);
  assert.equal(c, obs);
  assert.deepEqual(aplicarContraste([ZONA], aplicarPluvio([ZONA], meteo, null), c), aplicarContraste([ZONA], meteo, obs));
  assert.equal(avisoViejo(c, Date.parse('2026-10-01T12:00:00Z')), 'Datos de AEMET de hace 6 h (AEMET no responde)');
  // con pluviómetros, la copia vieja conserva su marca (el aviso sigue saliendo)
  const conHoraria = combinarObs(obs, pluvioCon({}, { aemet: { E1: { '2026-09-30': 4 } } }));
  assert.deepEqual(conHoraria.__viejo, obs.__viejo);
});

test('con archivo pero sin estaciones para la zona: series y notas idénticas', () => {
  const meteo = meteoDe(), m = aplicarPluvio([ZONA, OTRA], meteo, pluvioCon({ c: lugar(0) }));
  assert.equal(m.series.a, meteo.series.a);
  assert.equal(m.series.b, meteo.series.b);
  assert.deepEqual(nota(m), nota(meteo));
  assert.deepEqual({ ...m.pluvio.porPunto.a, nDia: null }, { estaciones: [], cercanas: 0, factor: 1, nDia: null });
  assert.ok(m.pluvio.porPunto.a.nDia.every((n) => n === 0));   // sin estaciones, ningún día con medida
});

test('medida en un punto: ese punto con lo medido; con una sola estación en la zona, el otro sigue con el modelo', () => {
  const meteo = meteoDe(), m = aplicarPluvio([ZONA], meteo, pluvioCon({ a: lugar(0) }));
  const a = m.series.a, b = m.series.b;
  assert.ok(a.precip.slice(0, 59).every((v) => v === 0));
  assert.deepEqual([a.origenPrecip[58], a.origenPrecip[59]], ['medida', 'modelo']);   // 30/09 medido; hoy, del modelo
  assert.deepEqual(a.lluviaAntesDeSerie, { desde: '2026-08-01', mm: 0, origen: 'medida' });
  assert.equal(b, meteo.series.b);                       // una estación sola no corrige la zona (Ruling tarea 12)
  assert.equal(m.pluvio.porPunto.b.factor, 1);
  assert.equal(m.seriesModelo, meteo.series);
  assert.ok(nota(m).valor <= nota(meteo).valor);
});

test('dos estaciones distintas en la zona: el punto sin estación, estimado con el sesgo (acotado a 0,67); la nota baja', () => {
  const meteo = meteoDe(), m = aplicarPluvio([ZONA3], meteo, pluvioCon({ a: lugar(0, 'Covaleda'), d: lugar(0, 'Duruelo') }));
  const b = m.series.b;
  assert.deepEqual([b.precip[58], b.origenPrecip[58]], [1.3, 'estimada']);   // 2 mm del modelo × 0,67
  assert.deepEqual([b.precip[59], b.origenPrecip[59]], [2, 'modelo']);       // hoy no se toca
  assert.equal(m.pluvio.porPunto.b.factor, 0.67);
  assert.deepEqual({ ...m.pluvio.porPunto.a, nDia: null }, { estaciones: [{ nombre: 'Covaleda', fuente: 'duero', km: 2 }], cercanas: 1, factor: 0.67, nDia: null });
  assert.equal(m.pluvio.porPunto.a.nDia.length, meteo.series.a.fechas.length);
  assert.equal(m.pluvio.porPunto.a.nDia[58], 1);
  assert.equal(m.pluvio.porPunto.a.nDia[59], 0);   // hoy, fuera del periodo   // los días del periodo medido llevan su número de sitios
  assert.deepEqual([m.pluvio.desde, m.pluvio.hasta], [DESDE, HASTA]);
  assert.ok(nota(m, ZONA3).valor < nota(meteo, ZONA3).valor);
});

test('el sesgo es el mismo cálculo que el de la rejilla (una sola copia) y se hace sobre las series del modelo', () => {
  assert.equal(factoresPorZona, factoresCompartidos);
  const meteo = meteoDe(), p = pluvioCon({ a: lugar(0, 'Covaleda'), d: lugar(0, 'Covaleda') });   // misma estación dos veces
  assert.equal(aplicarPluvio([ZONA3], meteo, p).pluvio.porPunto.b.factor, 1);
});

test('los puntos NO IR (solo meteo) también reciben la lluvia medida', () => {
  const zona = { ...ZONA, puntos: [{ id: 'a', altitud: 1500, noIr: true }, { id: 'b', altitud: 1100 }] };
  const m = aplicarPluvio([zona], meteoDe(), pluvioCon({ a: lugar(0) }));
  assert.equal(m.series.a.origenPrecip[58], 'medida');
});

test('el contraste AEMET compara con el modelo y no pisa los días medidos', () => {
  const meteo = meteoDe(), obs = obsE1(meteo.series.a, 9);
  const m = aplicarContraste([ZONA], aplicarPluvio([ZONA], meteo, pluvioCon({ a: lugar(0) })), obs);
  assert.equal(m.contrastePuntos.a.comparacion.P26modelo, 106);   // 23 días de 2 mm y 3 de 20 en el modelo
  assert.deepEqual([m.series.a.precip[40], m.series.a.origenPrecip[40]], [0, 'medida']);
  assert.deepEqual([m.series.b.precip[40], m.series.b.origenPrecip[40]], [9, 'estacion:E1']);   // lo del modelo, sí
});

test('el contraste AEMET también pisa los días estimados con el sesgo', () => {
  const meteo = meteoDe(), zona = { ...ZONA3, estacionesAemet: ZONA.estacionesAemet };
  const m = aplicarContraste([zona], aplicarPluvio([zona], meteo, pluvioCon({ a: lugar(0, 'Covaleda'), d: lugar(0, 'Duruelo') })), obsE1(meteo.series.a, 9));
  assert.equal(aplicarPluvio([zona], meteo, pluvioCon({ a: lugar(0, 'Covaleda'), d: lugar(0, 'Duruelo') })).series.b.origenPrecip[40], 'estimada');
  assert.deepEqual([m.series.b.precip[40], m.series.b.origenPrecip[40]], [9, 'estacion:E1']);
});

test('aplicarEstacion deja los días medidos; distanciaKm es la compartida', () => {
  const s = serieSintetica({ precip: () => 2 });
  const medida = { ...s, origenPrecip: s.origenPrecip.map((o, k) => (k === 50 ? 'medida' : o)) };
  const r = aplicarEstacion(medida, { [s.fechas[50]]: 7, [s.fechas[51]]: 7 }, 'E1');
  assert.deepEqual([r.precip[50], r.precip[51]], [2, 7]);
  assert.equal(distanciaKm, distanciaCompartida);
});

test('combinarObs: los días que AEMET aún no ha validado salen de su horaria; lo validado manda', () => {
  const obs = { E1: { '2026-09-28': 1, '2026-09-29': null } };
  const p = pluvioCon({}, { aemet: { E1: { '2026-09-28': 5, '2026-09-29': 3, '2026-09-30': 4 }, E2: { '2026-09-30': 5 } } });
  assert.deepEqual(combinarObs(obs, p), { E1: { '2026-09-28': 1, '2026-09-29': 3, '2026-09-30': 4 }, E2: { '2026-09-30': 5 } });
  assert.deepEqual(obs, { E1: { '2026-09-28': 1, '2026-09-29': null } }, 'no modifica las observaciones');
  assert.deepEqual(combinarObs(null, p), { E1: { '2026-09-28': 5, '2026-09-29': 3, '2026-09-30': 4 }, E2: { '2026-09-30': 5 } });
  assert.equal(combinarObs(null, null), null);
});

test('cargarPluvio: lo pide, lo guarda 3 h y, si falla, usa lo guardado; sin nada, null', async () => {
  const almacen = almacenFalso(), p = pluvioCon({ a: lugar(1) }), urls = [];
  const ok = async (u) => { urls.push(u); return respuesta(200, p); };
  const ahora = new Date('2026-10-01T08:00:00Z');
  assert.deepEqual(await cargarPluvio({ fetchFn: ok, ahora, almacen }), p);
  assert.ok(urls[0].startsWith(`${URL_PLUVIO}?t=`));
  await cargarPluvio({ fetchFn: ok, ahora: new Date('2026-10-01T09:00:00Z'), almacen });
  assert.equal(urls.length, 1, 'dentro de las 3 h no se vuelve a pedir');
  const cae = async () => { throw new Error('sin red'); };
  assert.deepEqual(await cargarPluvio({ fetchFn: cae, ahora: new Date('2026-10-01T14:00:00Z'), almacen }), p);
  assert.equal(await cargarPluvio({ fetchFn: async () => respuesta(400, { error: 'not_found' }), almacen: almacenFalso() }), null);
});

test('cargarPluvio: un archivo de otra versión no se usa, ni del servidor ni de la caché', async () => {
  const ahora = new Date('2026-10-01T08:00:00Z');
  assert.equal(await cargarPluvio({ fetchFn: async () => respuesta(200, { ...pluvioCon({}), version: 2 }), ahora, almacen: almacenFalso() }), null);
  const almacen = almacenFalso();
  guardar('pluvio', { ...pluvioCon({}), version: 2 }, ahora.toISOString(), almacen);
  let pedidas = 0;
  const r = await cargarPluvio({ fetchFn: async () => { pedidas++; return respuesta(200, pluvioCon({})); }, ahora, almacen });
  assert.equal(pedidas, 1);
  assert.equal(r.version, VERSION_PLUVIO);
});

test(`cargarPluvio: un archivo de más de ${PLUVIO_MAX_HORAS} h o del futuro no se usa (Hoy y Zona como sin archivo)`, async () => {
  const p = pluvioCon({ a: lugar(1) }), sirve = async () => respuesta(200, p);
  const enHoras = (h) => new Date(Date.parse(GENERADO) + h * 3600e3);
  assert.deepEqual(await cargarPluvio({ fetchFn: sirve, ahora: enHoras(35.9), almacen: almacenFalso() }), p);
  assert.equal(await cargarPluvio({ fetchFn: sirve, ahora: enHoras(36.1), almacen: almacenFalso() }), null);
  assert.equal(await cargarPluvio({ fetchFn: sirve, ahora: enHoras(-1), almacen: almacenFalso() }), null);
  assert.deepEqual(await cargarPluvio({ fetchFn: sirve, ahora: enHoras(-0.1), almacen: almacenFalso() }), p, 'unos minutos de reloj se toleran');
  // guardado bueno que envejece: pasadas las 36 h deja de valer aunque la red falle
  const almacen = almacenFalso(), cae = async () => { throw new Error('sin red'); };
  await cargarPluvio({ fetchFn: sirve, ahora: enHoras(4), almacen });
  assert.deepEqual(await cargarPluvio({ fetchFn: cae, ahora: enHoras(30), almacen }), p);
  assert.equal(await cargarPluvio({ fetchFn: cae, ahora: enHoras(37), almacen }), null);
  // el servidor da uno viejo y hay uno guardado aún vigente: se queda el guardado
  const viejo = { ...p, generado: '2026-09-28T04:10:00.000Z' };
  assert.deepEqual(await cargarPluvio({ fetchFn: async () => respuesta(200, viejo), ahora: enHoras(30), almacen }), p);
});

test('cargarPluvio nunca lanza (JSON roto, almacén que falla)', async () => {
  const roto = { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } };
  const almacen = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  assert.equal(await cargarPluvio({ fetchFn: async () => roto, almacen }), null);
  const p = pluvioCon({});
  assert.deepEqual(await cargarPluvio({ fetchFn: async () => respuesta(200, p), ahora: new Date('2026-10-01T08:00:00Z'), almacen }), p);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoyMadrid, urlPrincipal, parsearPrincipal, dispersion, resumirArchivo, aplicarClimatologia, obtenerMeteo, lluviaAntes, ESPERA_ARCHIVO_MS, REINTENTO_MS } from '../js/meteo.js';
import { calcularZona } from '../js/pantallas/hoy.js';
import { BOLETUS, NISCALO, MORCHELLA } from './ayudas.js';

const PUNTOS = [{ id: 'a', lat: 41.87, lon: -2.72, altitud: 1250 }, { id: 'b', lat: 40.87, lon: -4.03, altitud: 1300 }];

function respuesta({ dias = 3, desde = '2026-09-29', precip = 1 } = {}) {
  const t0 = Date.parse(`${desde}T00:00:00Z`);
  const time = Array.from({ length: dias }, (_, k) => new Date(t0 + k * 864e5).toISOString().slice(0, 10));
  const horas = time.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
  const n = (v) => time.map(() => v);
  return { elevation: 1250,
    daily: { time, precipitation_sum: n(precip), temperature_2m_mean: n(12), temperature_2m_min: n(5), temperature_2m_max: n(18),
      et0_fao_evapotranspiration: n(1.2), wind_speed_10m_max: n(14), relative_humidity_2m_mean: n(80) },
    hourly: { time: horas, soil_moisture_0_to_7cm: horas.map(() => 0.25), soil_temperature_0_to_7cm: horas.map(() => 11) } };
}

test('hoyMadrid usa la hora peninsular, no UTC', () => {
  assert.equal(hoyMadrid(new Date('2026-10-01T23:30:00Z')), '2026-10-02');   // 01:30 en Madrid
  assert.equal(hoyMadrid(new Date('2026-12-31T22:59:00Z')), '2026-12-31');   // 23:59 en invierno
});

test('urlPrincipal lleva elevación, zona horaria y ventanas', () => {
  const u = new URL(urlPrincipal(PUNTOS));
  assert.equal(u.searchParams.get('elevation'), '1250,1300');
  assert.equal(u.searchParams.get('timezone'), 'Europe/Madrid');
  assert.equal(u.searchParams.get('past_days'), '60');
  assert.equal(u.searchParams.get('forecast_days'), '10');
});

test('parsea respuesta múltiple (array) y de un punto (objeto)', () => {
  const s = parsearPrincipal([respuesta(), respuesta({ precip: 3 })], PUNTOS, '2026-09-30');
  assert.deepEqual(Object.keys(s), ['a', 'b']);
  assert.equal(s.a.hoy, 1);
  assert.deepEqual(s.b.precip, [3, 3, 3]);
  assert.equal(s.a.hsuelo[0], 0.25);
  assert.equal(s.a.tsuelo[2], 11);
  const uno = parsearPrincipal(respuesta(), [PUNTOS[0]], '2026-09-30');
  assert.deepEqual(Object.keys(uno), ['a']);
});

test('media diaria de suelo con menos de 20 horas válidas → null', () => {
  const r = respuesta();
  r.hourly.soil_moisture_0_to_7cm = r.hourly.soil_moisture_0_to_7cm.map((v, k) => (k < 10 ? null : v));
  const s = parsearPrincipal(r, [PUNTOS[0]], '2026-09-30');
  assert.equal(s.a.hsuelo[0], null);
  assert.equal(s.a.hsuelo[1], 0.25);
});

test('hoy fuera de la serie → error', () => {
  assert.throws(() => parsearPrincipal(respuesta(), [PUNTOS[0]], '2027-01-01'), /hoy/);
});

test('dispersión entre modelos', () => {
  const time = Array.from({ length: 8 }, (_, k) => `2026-10-0${k + 1}`);
  const r = { daily: { time, precipitation_sum_ecmwf_ifs: time.map(() => 5), precipitation_sum_icon_seamless: time.map(() => 1),
    precipitation_sum_gfs_seamless: time.map(() => 3) } };
  const d = dispersion(r, '2026-10-01');
  assert.deepEqual(d.modelos, { ecmwf_ifs: 35, icon_seamless: 7, gfs_seamless: 21 });
  assert.equal(d.media, 21);
  assert.equal(d.rango, 28);
  assert.equal(d.incierta, true);
  assert.equal(d.horizonte, 7);
  assert.deepEqual(d.excluidos, []);
  const parecidos = { daily: { time, precipitation_sum_ecmwf_ifs: time.map(() => 2), precipitation_sum_icon_seamless: time.map(() => 2.2) } };
  assert.equal(dispersion(parecidos, '2026-10-01').incierta, false);
});

// Serie de 8 días (hoy = 2026-10-01 en el índice 0; hoy+1…hoy+7 = índices 1…7). `alcance` = días consecutivos con valor desde hoy+1.
const serieModelo = (alcance, v) => Array.from({ length: 8 }, (_, k) => (k === 0 ? 0 : k <= alcance ? v : null));
const conAlcances = (a) => ({ daily: { time: Array.from({ length: 8 }, (_, k) => `2026-10-0${k + 1}`),
  ...Object.fromEntries(Object.entries(a).map(([m, [al, v]]) => [`precipitation_sum_${m}`, serieModelo(al, v)])) } });

test('dispersión: caso real, contraste sobre el horizonte común (ICON hasta +6, tercer modelo cortado en +3)', () => {
  const d = dispersion(conAlcances({ ecmwf_ifs: [7, 2], icon_seamless: [6, 1], gfs_seamless: [3, 4] }), '2026-10-01');
  assert.equal(d.horizonte, 6);
  assert.deepEqual(d.modelos, { ecmwf_ifs: 12, icon_seamless: 6 });
  assert.deepEqual(d.excluidos, ['gfs_seamless']);
  assert.equal(d.media, 9);
  assert.equal(d.rango, 6);
});

test('dispersión: un solo modelo con alcance ≥ 3 → sin contraste', () => {
  const d = dispersion(conAlcances({ ecmwf_ifs: [7, 2], icon_seamless: [2, 1], gfs_seamless: [1, 4] }), '2026-10-01');
  assert.deepEqual(d.modelos, {});
  assert.equal(d.horizonte, null);
  assert.equal(d.media, null);
  assert.equal(d.rango, null);
  assert.equal(d.incierta, null);
});

test('dispersión: dos modelos con alcance 3 y uno con 7 → horizonte 3 con los tres', () => {
  const d = dispersion(conAlcances({ ecmwf_ifs: [7, 2], icon_seamless: [3, 1], gfs_seamless: [3, 4] }), '2026-10-01');
  assert.equal(d.horizonte, 3);
  assert.deepEqual(d.modelos, { ecmwf_ifs: 6, icon_seamless: 3, gfs_seamless: 12 });
  assert.deepEqual(d.excluidos, []);
});

test('resumen de archivo: muestras de humedad del suelo por mes', () => {
  const time = ['2026-07-31', '2026-08-01', '2026-08-02', '2026-09-10'];
  const r = { daily: { time, soil_moisture_0_to_7cm_mean: [0.1, 0.2, 0.25, 0.3] } };
  const res = resumirArchivo(r);
  assert.deepEqual(res.porMes[8], [0.2, 0.25]);
  assert.deepEqual(res.porMes[7], [0.1]);
});

test('lluviaAntes: suma del 1-ago al día anterior a la serie; hueco o archivo corto → null', () => {
  const time = ['2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03'];
  const r = { daily: { time, precipitation_sum: [9, 4, 6, 1] } };
  assert.deepEqual(lluviaAntes(r, '2026-08-01', '2026-08-02'), { desde: '2026-08-01', hasta: '2026-08-02', mm: 10 });
  assert.equal(lluviaAntes({ daily: { time, precipitation_sum: [9, null, 6, 1] } }, '2026-08-01', '2026-08-02'), null);
  assert.equal(lluviaAntes(r, '2026-08-01', '2026-08-05'), null);   // el archivo no llega hasta el día pedido (retraso de ERA5)
  assert.equal(lluviaAntes(null, '2026-08-01', '2026-08-02'), null);
});

test('percentil de suelo con meses contiguos; muestra corta → null', () => {
  const serie = { fechas: ['2026-10-05'], hsuelo: [0.3] };
  const muestra = Array.from({ length: 40 }, (_, k) => k / 100);       // 0,00 … 0,39
  const conMuestra = aplicarClimatologia(serie, { porMes: { 9: muestra.slice(0, 20), 11: muestra.slice(20) }, lluviaAntesDeSerie: null });
  assert.equal(conMuestra.hsueloPct[0], 77.5);                         // 31 de 40 ≤ 0,3
  const corta = aplicarClimatologia(serie, { porMes: { 10: [0.1, 0.2] }, lluviaAntesDeSerie: null });
  assert.equal(corta.hsueloPct[0], null);
});

test('obtenerMeteo: Open-Meteo caído sin caché → series null y error', async () => {
  const falla = async () => ({ ok: false, status: 503 });
  const r = await obtenerMeteo(PUNTOS, { fetchFn: falla, ahora: new Date('2026-09-30T10:00:00Z'), almacen: null });
  assert.equal(r.series, null);
  assert.match(r.error, /503/);
});

test('obtenerMeteo: usa la caché reciente sin pedir nada', async () => {
  const m = new Map();
  const almacen = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i], get length() { return m.size; } };
  let llamadas = 0;
  const ok = async (url) => { llamadas++; const multi = url.includes('models=') ? [{ daily: { time: [] } }, { daily: { time: [] } }] : url.includes('archive') ? [respuesta(), respuesta()] : [respuesta(), respuesta()];
    return { ok: true, json: async () => multi }; };
  const ahora = new Date('2026-09-30T10:00:00Z');
  const r1 = await obtenerMeteo(PUNTOS, { fetchFn: ok, ahora, almacen });
  assert.equal(r1.desdeCache, false);
  const antes = llamadas;
  // a los 10 min (antes del reintento de lo que faltase, REINTENTO_MS = 20 min): ni una petición
  const r2 = await obtenerMeteo(PUNTOS, { fetchFn: ok, ahora: new Date('2026-09-30T10:10:00Z'), almacen });
  assert.equal(r2.desdeCache, true);
  assert.equal(llamadas, antes);
  const r3 = await obtenerMeteo(PUNTOS, { fetchFn: async () => { throw new Error('sin red'); }, ahora: new Date('2026-09-30T15:00:00Z'), almacen });
  assert.equal(r3.desdeCache, true);
  assert.match(r3.error, /sin red/);
  assert.ok(r3.series.a);
});

test('obtenerMeteo: una caché que no tiene todos los puntos (se añadió uno) no se sirve', async () => {
  const m = new Map();
  const almacen = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i], get length() { return m.size; } };
  const mas = [...PUNTOS, { ...PUNTOS[0], id: 'nuevo' }];
  let llamadas = 0;
  const ok = async (url) => { llamadas++; const n = decodeURIComponent(url.match(/latitude=([^&]*)/)?.[1] ?? '').split(',').length;
    return { ok: true, json: async () => Array.from({ length: n }, () => (url.includes('models=') ? { daily: { time: [] } } : respuesta())) }; };
  const ahora = new Date('2026-09-30T10:00:00Z');
  await obtenerMeteo(PUNTOS, { fetchFn: ok, ahora, almacen });
  const antes = llamadas;
  const r = await obtenerMeteo(mas, { fetchFn: ok, ahora: new Date('2026-09-30T11:00:00Z'), almacen });
  assert.ok(llamadas > antes, 'debe volver a pedir');
  assert.equal(r.desdeCache, false);
  assert.ok(r.series.nuevo && r.series.a);
});

test('obtenerMeteo: una entrada de caché corrupta o antigua no lanza', async () => {
  for (const basura of ['{"datos":null,"hora":"x"}', '{"hora":"2026-09-30T08:00:00Z"}', '[1,2]', 'no es json']) {
    const almacen = { getItem: (k) => (k === 'setas:meteo' ? basura : null), setItem() {}, removeItem() {}, key: () => null, length: 0 };
    const r = await obtenerMeteo(PUNTOS, { fetchFn: async () => { throw new Error('sin red'); }, ahora: new Date('2026-09-30T10:00:00Z'), almacen });
    assert.equal(r.series, null);
    assert.match(r.error, /sin red/);
  }
});

test('obtenerMeteo: cada petición lleva un límite de tiempo (AbortSignal)', async () => {
  const opciones = [];
  const fetchFn = async (url, op) => { opciones.push(op); return { ok: false, status: 500 }; };
  await obtenerMeteo(PUNTOS, { fetchFn, ahora: new Date('2026-09-30T10:00:00Z'), almacen: null });
  assert.ok(opciones.length >= 1);
  for (const op of opciones) assert.ok(op?.signal instanceof AbortSignal);
});

// ---- Corrección final: C1 (lluvia desde el 1-ago sin la climatología) e I1 (climatología ligera y reintento) ----
const almacenMapa = () => {
  const m = new Map();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i], get length() { return m.size; } };
};
const UN_OCTUBRE = new Date('2026-10-01T10:00:00Z');   // hoy = 2026-10-01 → la serie empieza el 2026-08-02
const esClima = (u) => u.includes('archive-api') && u.includes('soil_moisture');
const esLluviaArchivo = (u) => u.includes('archive-api') && !u.includes('soil_moisture');
const esLluviaPrevision = (u) => u.includes('api.open-meteo.com/v1/forecast') && u.includes('start_date');

// Open-Meteo falso: forecast de 70 días hasta hoy+9; el archivo, según las opciones.
function openMeteoFalso({ clima = 'ok', lluvia = 'ok', prevision = 'falla', ahora = UN_OCTUBRE } = {}) {
  const llamadas = [];
  const inicio = new Date(Date.parse(`${hoyMadrid(ahora)}T00:00:00Z`) - 60 * 864e5).toISOString().slice(0, 10);
  const fetchFn = async (url) => {
    const u = decodeURIComponent(url);
    llamadas.push(u);
    const n = u.match(/latitude=([^&]*)/)[1].split(',').length;
    const varios = (f) => ({ ok: true, json: async () => Array.from({ length: n }, f) });
    const q = new URL(url).searchParams;
    const rango = () => { const t = []; for (let d = Date.parse(`${q.get('start_date')}T00:00:00Z`); d <= Date.parse(`${q.get('end_date')}T00:00:00Z`); d += 864e5) t.push(new Date(d).toISOString().slice(0, 10)); return t; };
    if (esClima(u)) {
      if (clima !== 'ok') return { ok: false, status: 429 };
      const time = rango();
      return varios(() => ({ daily: { time, soil_moisture_0_to_7cm_mean: time.map((_, k) => 0.1 + (k % 30) / 100) } }));
    }
    if (esLluviaArchivo(u)) {
      if (lluvia === 'falla') throw new Error('archivo caído');
      if (lluvia === 'corto') return varios(() => ({ daily: { time: [], precipitation_sum: [] } }));
      const time = rango();
      return varios(() => ({ daily: { time, precipitation_sum: time.map(() => 7) } }));
    }
    if (esLluviaPrevision(u)) {
      if (prevision === 'falla') return { ok: false, status: 400 };
      const time = rango();
      return varios(() => ({ daily: { time, precipitation_sum: time.map(() => 5) } }));
    }
    if (u.includes('models=')) return varios(() => ({ daily: { time: [] } }));
    return varios(() => respuesta({ dias: 70, desde: inicio, precip: 3 }));
  };
  return { fetchFn, llamadas };
}
const zonaAB = { id: 'z', habitats: ['pinar'], puntos: [{ id: 'a' }, { id: 'b' }] };
const conHabitat = (e) => ({ ...e, categoria: 'comestible', habitats: ['pinar'], zonas: { z: { presencia: 'frecuente' } } });
const datosZ = { especies: [BOLETUS, NISCALO, MORCHELLA].map(conHabitat) };

test('obtenerMeteo el 1-oct con la climatología caída: la lluvia desde el 1-ago llega por la petición ligera y las de otoño se calculan', async () => {
  const { fetchFn, llamadas } = openMeteoFalso({ clima: 'falla' });
  const r = await obtenerMeteo(PUNTOS, { fetchFn, ahora: UN_OCTUBRE, almacen: null });
  assert.equal(r.series.a.fechas[0], '2026-08-02');
  assert.deepEqual(r.series.a.lluviaAntesDeSerie, { desde: '2026-08-01', hasta: '2026-08-01', mm: 7 });
  const ligera = new URL(llamadas.find(esLluviaArchivo));
  assert.equal(ligera.searchParams.get('daily'), 'precipitation_sum');
  assert.equal(ligera.searchParams.get('start_date'), '2026-08-01');
  assert.equal(ligera.searchParams.get('end_date'), '2026-08-01');
  assert.equal(r.pendiente?.clim, true);   // sin climatología: se reintenta, no se da por completa
  const f = calcularZona(zonaAB, datosZ, r, 0, '');
  assert.equal(typeof f.res.valor, 'number');
  assert.deepEqual(f.res.faltan, []);
  assert.ok(f.res.especies.some((e) => e.id === 'boletus-edulis'));
  assert.ok(f.res.especies.every((e) => e.id !== 'morchella'));   // fuera de temporada: no entra en la nota
});

test('obtenerMeteo el 1-oct con todo el archivo caído: la lluvia del 1-ago sale del forecast si lo tiene', async () => {
  const { fetchFn } = openMeteoFalso({ clima: 'falla', lluvia: 'falla', prevision: 'ok' });
  const r = await obtenerMeteo(PUNTOS, { fetchFn, ahora: UN_OCTUBRE, almacen: null });
  assert.deepEqual(r.series.b.lluviaAntesDeSerie, { desde: '2026-08-01', hasta: '2026-08-01', mm: 5 });
});

test('obtenerMeteo el 1-oct sin la lluvia del 1-ago en ningún sitio: la zona sale sin datos e incompleta, nunca «0 Nulo» ni en silencio', async () => {
  const { fetchFn } = openMeteoFalso({ clima: 'falla', lluvia: 'corto' });
  const r = await obtenerMeteo(PUNTOS, { fetchFn, ahora: UN_OCTUBRE, almacen: null });
  assert.equal(r.series.a.lluviaAntesDeSerie, null);
  assert.equal(r.pendiente?.lluvia, true);
  const f = calcularZona(zonaAB, datosZ, r, 0, '');
  assert.equal(f.res.valor, null);
  assert.equal(f.res.sinDatos, true);
  assert.equal(f.res.incompleta, true);
  assert.deepEqual([...f.res.faltan].sort(), ['boletus-edulis', 'lactarius-deliciosus']);
});

test('el 30-sep (la serie empieza el 1-ago) no hace falta la petición de lluvia', async () => {
  const ahora = new Date('2026-09-30T10:00:00Z');
  const { fetchFn, llamadas } = openMeteoFalso({ ahora });
  const r = await obtenerMeteo(PUNTOS, { fetchFn, ahora, almacen: null });
  assert.equal(r.series.a.fechas[0], '2026-08-01');
  assert.equal(llamadas.filter(esLluviaArchivo).length, 0);
  assert.equal(r.pendiente, null);
});

test('climatología: solo humedad del suelo, 2 años hasta el día anterior a la serie, límite de 45 s', async () => {
  const { fetchFn, llamadas } = openMeteoFalso();
  const r = await obtenerMeteo(PUNTOS, { fetchFn, ahora: UN_OCTUBRE, almacen: null });
  const u = new URL(llamadas.find(esClima));
  assert.equal(u.searchParams.get('daily'), 'soil_moisture_0_to_7cm_mean');
  assert.equal(u.searchParams.get('end_date'), '2026-08-01');
  const dias = (Date.parse(u.searchParams.get('end_date')) - Date.parse(u.searchParams.get('start_date'))) / 864e5 + 1;
  assert.ok(dias <= 731 && dias >= 700, `pide ${dias} días`);
  assert.equal(ESPERA_ARCHIVO_MS, 45000);
  assert.equal(r.pendiente, null);
  assert.ok(r.series.a.hsueloPct.some((v) => v != null));
});

test('climatología en caché 30 días con clave solo de los puntos (no del día)', async () => {
  const almacen = almacenMapa();
  const f1 = openMeteoFalso();
  await obtenerMeteo(PUNTOS, { fetchFn: f1.fetchFn, ahora: UN_OCTUBRE, almacen });
  assert.equal(f1.llamadas.filter(esClima).length, 1);
  const a14 = new Date('2026-10-15T10:00:00Z');
  const f2 = openMeteoFalso({ ahora: a14 });
  const r2 = await obtenerMeteo(PUNTOS, { fetchFn: f2.fetchFn, ahora: a14, almacen });
  assert.equal(f2.llamadas.filter(esClima).length, 0, 'a los 14 días no se vuelve a pedir');
  assert.ok(r2.series.a.hsueloPct.some((v) => v != null));
  const a35 = new Date('2026-11-05T10:00:00Z');
  const f3 = openMeteoFalso({ ahora: a35 });
  await obtenerMeteo(PUNTOS, { fetchFn: f3.fetchFn, ahora: a35, almacen });
  assert.equal(f3.llamadas.filter(esClima).length, 1, 'a los 35 días se vuelve a pedir');
  assert.equal([...almacen.m.keys()].filter((k) => k.startsWith('setas:clim:')).length, 1);
});

test('climatología caída: se reintenta solo ella a los 20 min, no cada vez ni a las 3 h', async () => {
  const almacen = almacenMapa();
  await obtenerMeteo(PUNTOS, { fetchFn: openMeteoFalso({ clima: 'falla' }).fetchFn, ahora: UN_OCTUBRE, almacen });
  const pronto = openMeteoFalso();
  const r1 = await obtenerMeteo(PUNTOS, { fetchFn: pronto.fetchFn, ahora: new Date(UN_OCTUBRE.getTime() + 5 * 60e3), almacen });
  assert.equal(pronto.llamadas.length, 0, 'a los 5 min no se pide nada');
  assert.equal(r1.pendiente.clim, true);
  const luego = openMeteoFalso();
  const r2 = await obtenerMeteo(PUNTOS, { fetchFn: luego.fetchFn, ahora: new Date(UN_OCTUBRE.getTime() + REINTENTO_MS + 60e3), almacen });
  assert.deepEqual(luego.llamadas.map((u) => (esClima(u) ? 'clima' : 'otra')), ['clima'], 'solo la climatología');
  assert.equal(r2.pendiente, null);
  assert.equal(r2.desdeCache, true);
  assert.ok(r2.series.a.hsueloPct.some((v) => v != null));
  assert.deepEqual(r2.series.a.lluviaAntesDeSerie, { desde: '2026-08-01', hasta: '2026-08-01', mm: 7 });
});

// ---- Residuales: espera creciente de la climatología y orden de las peticiones ----
test('la serie principal se pide antes que el archivo (no en paralelo)', async () => {
  const orden = [];
  const base = openMeteoFalso({ clima: 'falla' });
  let principalHecha = false;
  const fetchFn = async (url) => {
    const u = decodeURIComponent(url);
    if (u.includes('archive-api')) orden.push(principalHecha ? 'archivo-tras-principal' : 'archivo-antes');
    const r = await base.fetchFn(url);
    if (!u.includes('archive-api') && !u.includes('models=') && !u.includes('start_date')) principalHecha = true;
    return r;
  };
  await obtenerMeteo(PUNTOS, { fetchFn, ahora: UN_OCTUBRE, almacen: null });
  assert.ok(orden.length >= 2);
  assert.deepEqual([...new Set(orden)], ['archivo-tras-principal']);
});

test('climatología caída: espera 20 min → 1 h → 6 h → 24 h (guardada), sin pedirla en el refresco de 3 h; un éxito la reinicia', async () => {
  const almacen = almacenMapa();
  const t0 = new Date('2026-10-01T04:00:00Z').getTime();   // 06:00 en Madrid
  const en = (min) => new Date(t0 + min * 60e3);
  const pedirEn = async (min, clima = 'falla') => {
    const f = openMeteoFalso({ clima, ahora: en(min) });
    const r = await obtenerMeteo(PUNTOS, { fetchFn: f.fetchFn, ahora: en(min), almacen });
    return { r, clima: f.llamadas.filter(esClima).length, principal: f.llamadas.filter((u) => !u.includes('archive-api') && !u.includes('models=') && !u.includes('start_date')).length };
  };
  const espera = () => JSON.parse(almacen.m.get('setas:clim-espera')).datos;
  let x = await pedirEn(0);                        // fallo 1 → espera 20 min
  assert.equal(x.clima, 1);
  assert.equal(espera().fallos, 1);
  assert.equal(x.r.proximoReintento, en(20).toISOString());
  x = await pedirEn(15); assert.equal(x.clima, 0, 'a los 15 min, todavía no');
  x = await pedirEn(21); assert.equal(x.clima, 1, 'a los 21 min se reintenta');   // fallo 2 → 1 h
  assert.equal(x.principal, 0, 'solo la climatología');
  assert.equal(espera().proximo, en(81).toISOString());
  x = await pedirEn(60); assert.equal(x.clima, 0);
  x = await pedirEn(82); assert.equal(x.clima, 1);   // fallo 3 → 6 h
  assert.equal(espera().proximo, en(82 + 360).toISOString());
  x = await pedirEn(200);                          // refresco de 3 h: serie nueva, pero sin climatología
  assert.equal(x.principal, 1);
  assert.equal(x.clima, 0, 'el refresco de 3 h no la pide mientras dura la espera');
  assert.equal(x.r.pendiente.clim, true);
  x = await pedirEn(82 + 361); assert.equal(x.clima, 1);   // fallo 4 → 24 h
  assert.equal(espera().proximo, en(82 + 361 + 1440).toISOString());
  x = await pedirEn(82 + 361 + 1441, 'ok');        // al día siguiente: vuelve a pedirla y sale bien
  assert.equal(x.clima, 1);
  assert.equal(x.r.pendiente, null);
  assert.equal(almacen.m.has('setas:clim-espera'), false, 'un éxito reinicia la espera');
});

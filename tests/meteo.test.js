import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoyMadrid, urlPrincipal, parsearPrincipal, dispersion, resumirArchivo, aplicarClimatologia, obtenerMeteo } from '../js/meteo.js';

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
    precipitation_sum_meteofrance_seamless: time.map(() => 3) } };
  const d = dispersion(r, '2026-10-01');
  assert.deepEqual(d.modelos, { ecmwf_ifs: 35, icon_seamless: 7, meteofrance_seamless: 21 });
  assert.equal(d.media, 21);
  assert.equal(d.rango, 28);
  assert.equal(d.incierta, true);
  const parecidos = { daily: { time, precipitation_sum_ecmwf_ifs: time.map(() => 2), precipitation_sum_icon_seamless: time.map(() => 2.2) } };
  assert.equal(dispersion(parecidos, '2026-10-01').incierta, false);
});

test('resumen de archivo: lluvia desde agosto y muestras por mes', () => {
  const time = ['2026-07-31', '2026-08-01', '2026-08-02', '2026-09-10'];
  const r = { daily: { time, precipitation_sum: [9, 4, 6, 1], soil_moisture_0_to_7cm_mean: [0.1, 0.2, 0.25, 0.3] } };
  const res = resumirArchivo(r, '2026-09-10');
  assert.deepEqual(res.lluviaAntesDeSerie, { desde: '2026-08-01', mm: 10 });
  assert.deepEqual(res.porMes[8], [0.2, 0.25]);
  const hueco = resumirArchivo({ daily: { ...r.daily, precipitation_sum: [9, null, 6, 1] } }, '2026-09-10');
  assert.equal(hueco.lluviaAntesDeSerie, null);
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
  const r2 = await obtenerMeteo(PUNTOS, { fetchFn: ok, ahora: new Date('2026-09-30T11:00:00Z'), almacen });
  assert.equal(r2.desdeCache, true);
  assert.equal(llamadas, antes);
  const r3 = await obtenerMeteo(PUNTOS, { fetchFn: async () => { throw new Error('sin red'); }, ahora: new Date('2026-09-30T15:00:00Z'), almacen });
  assert.equal(r3.desdeCache, true);
  assert.match(r3.error, /sin red/);
  assert.ok(r3.series.a);
});

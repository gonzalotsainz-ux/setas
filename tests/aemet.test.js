import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsearPrec, compararLluvia, aplicarEstacion, aplicarContraste } from '../js/aemet.js';
import { serieSintetica } from './ayudas.js';

test('precipitación de AEMET', () => {
  assert.equal(parsearPrec('2,4'), 2.4);
  assert.equal(parsearPrec('0,0'), 0);
  assert.equal(parsearPrec('Ip'), 0);
  assert.equal(parsearPrec('Acum'), null);
  assert.equal(parsearPrec(''), null);
  assert.equal(parsearPrec(undefined), null);
});

test('comparación: discrepa si difiere > 30 % y > 10 mm', () => {
  const s = serieSintetica({ precip: () => 2 });            // P26 modelo = 52
  const obs = Object.fromEntries(s.fechas.slice(34, 60).map((f) => [f, 1]));   // P26 estación = 26
  const c = compararLluvia(s, obs);
  assert.equal(c.P26modelo, 52);
  assert.equal(c.P26estacion, 26);
  assert.equal(c.diasCubiertos, 26);
  assert.equal(c.discrepa, true);
});

test('estación incompleta (< 24 de 26 días) → no se compara', () => {
  const s = serieSintetica();
  const obs = Object.fromEntries(s.fechas.slice(40, 60).map((f) => [f, 1]));
  assert.equal(compararLluvia(s, obs).P26estacion, null);
});

test('aplicarEstacion sustituye solo días observados y no toca la previsión', () => {
  const s = serieSintetica({ hoy: 55, precip: () => 2 });
  const obs = { [s.fechas[50]]: 7, [s.fechas[58]]: 9, [s.fechas[51]]: null };
  const r = aplicarEstacion(s, obs, '2030');
  assert.equal(r.precip[50], 7);
  assert.equal(r.origenPrecip[50], 'estacion:2030');
  assert.equal(r.precip[51], 2);
  assert.equal(r.precip[58], 2);           // día previsto: no se sustituye
  assert.equal(s.precip[50], 2);           // no muta la original
});

// ---- aplicarContraste ----
const zona = (estaciones) => ({ id: 'z', puntos: [{ id: 'a', altitud: 1500 }, { id: 'b', altitud: 1100 }], estacionesAemet: estaciones });
const meteoDe = (s) => ({ series: { a: s, b: s }, hoy: s.fechas[s.hoy] });
const obsDe = (s, v, desde = 34, hasta = 57) => Object.fromEntries(s.fechas.slice(desde, hasta).map((f) => [f, v]));

test('contraste: aplica la estación con ≥ 22 días medidos (retraso de 3 días) y deja el modelo en los últimos', () => {
  const s = serieSintetica({ precip: () => 2 });
  const m = aplicarContraste([zona([{ id: 'E1', nombre: 'Uno', altitud: 1450 }])], meteoDe(s), { E1: obsDe(s, 1) });
  assert.equal(m.contraste.z.aplicada, true);
  assert.equal(m.contraste.z.comparacion.diasCubiertos, 23);
  assert.equal(m.series.a.precip[56], 1);
  assert.equal(m.series.a.origenPrecip[56], 'estacion:E1');
  assert.equal(m.series.a.precip[57], 2);              // día sin observación (retraso de AEMET): modelo
  assert.equal(m.series.a.origenPrecip[57], 'modelo');
  assert.equal(m.series.b.origenPrecip[56], 'estacion:E1');   // todos los puntos de la zona
});

test('contraste: «Usar modelo» con discrepancia no sustituye nada', () => {
  const s = serieSintetica({ precip: () => 2 });
  const m = aplicarContraste([zona([{ id: 'E1', nombre: 'Uno', altitud: 1450 }])], meteoDe(s), { E1: obsDe(s, 0.5) }, () => true);
  assert.equal(m.contraste.z.discrepa, true);
  assert.equal(m.contraste.z.usaModelo, true);
  assert.equal(m.series.a.precip[56], 2);
  assert.equal(m.series.a.origenPrecip[56], 'modelo');
});

test('contraste: sin discrepancia «Usar modelo» no cuenta; estación incompleta se salta a la siguiente', () => {
  const s = serieSintetica({ precip: () => 2 });
  const obs = { E1: obsDe(s, 1, 50, 57), E2: obsDe(s, 2) };
  const m = aplicarContraste([zona([{ id: 'E1', altitud: 1450 }, { id: 'E2', altitud: 1450 }])], meteoDe(s), obs, () => true);
  assert.equal(m.contraste.z.estacion.id, 'E2');
  assert.equal(m.contraste.z.discrepa, false);
  assert.equal(m.contraste.z.aplicada, true);
});

test('contraste: sin observaciones devuelve la meteo tal cual', () => {
  const s = serieSintetica();
  const meteo = meteoDe(s);
  assert.equal(aplicarContraste([zona([{ id: 'E1', altitud: 1450 }])], meteo, null), meteo);
  assert.equal(aplicarContraste([zona([{ id: 'E1', altitud: 1450 }])], meteo, {}).contraste.z, undefined);
});

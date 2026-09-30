import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsearPrec, compararLluvia, aplicarEstacion, aplicarContraste } from '../js/aemet.js';
import { serieSintetica } from './ayudas.js';

const zona = (estaciones) => ({ id: 'z', puntos: [{ id: 'a', altitud: 1500 }, { id: 'b', altitud: 1100 }], estacionesAemet: estaciones });
const meteoDe = (s) => ({ series: { a: s, b: s }, hoy: s.fechas[s.hoy] });
const obsDe = (s, v, desde = 34, hasta = 57) => Object.fromEntries(s.fechas.slice(desde, hasta).map((f) => [f, v]));

test('precipitación de AEMET', () => {
  assert.equal(parsearPrec('2,4'), 2.4);
  assert.equal(parsearPrec('0,0'), 0);
  assert.equal(parsearPrec('Ip'), 0);
  assert.equal(parsearPrec('Acum'), null);
  assert.equal(parsearPrec(''), null);
  assert.equal(parsearPrec(undefined), null);
  assert.equal(parsearPrec(' 2,4 '), 2.4);
  assert.equal(parsearPrec(' Ip '), 0);
  assert.equal(parsearPrec(3.5), 3.5);
  assert.equal(parsearPrec('abc'), null);
  assert.equal(parsearPrec(NaN), null);
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

test('estación incompleta (< 22 de 26 días) → no se compara', () => {
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

test('discrepa compara los mismos días: la cola sin medida (húmeda o seca) no la decide', () => {
  // estación 1 mm/día y modelo 1 mm/día en los 23 días medidos (34..56): coinciden
  for (const cola of [0, 30]) {
    const s = serieSintetica({ precip: (k) => (k >= 57 ? cola : 1) });
    const c = compararLluvia(s, obsDe(s, 1));
    assert.equal(c.diasCubiertos, 23);
    assert.equal(c.estacionCubierta, 23);
    assert.equal(c.modeloCubierto, 23);
    assert.equal(c.discrepa, false);
    assert.equal(c.P26estacion, 23 + cola * 3);   // definición del índice: estación + modelo en la cola
    assert.equal(c.P26modelo, 23 + cola * 3);
  }
  // si en los días medidos sí difieren (estación 3, modelo 1), discrepa con cualquier cola
  for (const cola of [0, 30]) {
    const s = serieSintetica({ precip: (k) => (k >= 57 ? cola : 1) });
    const c = compararLluvia(s, obsDe(s, 3));
    assert.equal(c.discrepa, true);
    assert.equal(c.P26estacion, 69 + cola * 3);
  }
});

test('límite de cobertura: 21 días no compara, 22 sí', () => {
  const s = serieSintetica({ precip: () => 1 });
  assert.equal(compararLluvia(s, obsDe(s, 1, 36, 57)).P26estacion, null);       // 21 días
  assert.equal(compararLluvia(s, obsDe(s, 1, 35, 57)).P26estacion, 26);         // 22 días: 22 + 4 del modelo
  assert.equal(compararLluvia(s, obsDe(s, 1, 36, 57)).discrepa, false);
});

// ---- aplicarContraste ----

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

// ---- estación más cercana a cada punto ----

const zonaCoord = (estaciones) => ({ id: 'z', puntos: [{ id: 'a', lat: 40.83, lon: -3.85, altitud: 1580 }, { id: 'b', lat: 40.92, lon: -3.76, altitud: 1336 }], estacionesAemet: estaciones });
const cerca = { A: { id: 'EA', nombre: 'Cerca de a', altitud: 1159, lat: 40.85, lon: -3.88 }, B: { id: 'EB', nombre: 'Cerca de b', altitud: 1100, lat: 40.94, lon: -3.74 } };

test('contraste: cada punto usa su estación más cercana, aunque sean de la misma zona', () => {
  const s = serieSintetica({ precip: () => 2 });
  const obs = { EA: obsDe(s, 1), EB: obsDe(s, 1.5) };
  // la lista va en orden inverso a propósito: manda la distancia, no el orden
  const m = aplicarContraste([zonaCoord([cerca.B, cerca.A])], meteoDe(s), obs);
  assert.equal(m.contrastePuntos.a.estacion.id, 'EA');
  assert.equal(m.contrastePuntos.b.estacion.id, 'EB');
  assert.equal(m.series.a.origenPrecip[56], 'estacion:EA');
  assert.equal(m.series.b.origenPrecip[56], 'estacion:EB');
  assert.equal(m.series.a.precip[56], 1);
  assert.equal(m.series.b.precip[56], 1.5);
  assert.ok(m.contrastePuntos.a.estacion.distanciaKm < 5 && m.contrastePuntos.b.estacion.distanciaKm < 5);   // distancia al punto, no a la zona
  assert.equal(m.contrastePuntos.a.aplicada, true);
});

test('contraste: si la más cercana no tiene datos suficientes se usa la siguiente; sin ninguna, modelo', () => {
  const s = serieSintetica({ precip: () => 2 });
  const incompleta = obsDe(s, 1, 50, 57);
  const m = aplicarContraste([zonaCoord([cerca.A, cerca.B])], meteoDe(s), { EA: obsDe(s, 1), EB: incompleta });
  assert.equal(m.contrastePuntos.b.estacion.id, 'EA');   // EB está más cerca de b pero no llega al mínimo
  const sinNinguna = aplicarContraste([zonaCoord([cerca.A, cerca.B])], meteoDe(s), { EA: incompleta, EB: incompleta });
  assert.equal(sinNinguna.contrastePuntos.a, undefined);
  assert.equal(sinNinguna.contrastePuntos.b, undefined);
  assert.equal(sinNinguna.series.a.origenPrecip[56], 'modelo');
  assert.equal(sinNinguna.contraste.z, undefined);
});

test('contraste: «Usar modelo» solo quita la estación a los puntos que discrepan', () => {
  const s = serieSintetica({ precip: () => 2 });
  const obs = { EA: obsDe(s, 0.5), EB: obsDe(s, 2) };           // a discrepa (0,5 frente a 2), b no
  const m = aplicarContraste([zonaCoord([cerca.A, cerca.B])], meteoDe(s), obs, () => true);
  assert.equal(m.contrastePuntos.a.discrepa, true);
  assert.equal(m.contrastePuntos.a.usaModelo, true);
  assert.equal(m.series.a.origenPrecip[56], 'modelo');
  assert.equal(m.contrastePuntos.b.discrepa, false);
  assert.equal(m.series.b.origenPrecip[56], 'estacion:EB');
  assert.equal(m.contraste.z.discrepa, true);                    // la zona avisa si algún punto discrepa
  assert.equal(m.contraste.z.estacion.id, 'EA');
});

test('compararLluvia: un nulo del modelo no cuenta como 0 en la P26 mostrada', () => {
  const s = serieSintetica({ precip: () => 2 });
  s.precip[45] = null;                                   // día sin medida en la estación y sin modelo
  const obs = obsDe(s, 2, 34, 45);                       // 11 días: estación incompleta
  const c = compararLluvia(s, obs);
  assert.equal(c.P26modelo, null);
  assert.equal(c.P26estacion, null);
  // con la estación cubriendo el día sin modelo, la P26 de estación sí existe; la del modelo no
  const s2 = serieSintetica({ precip: () => 2 });
  s2.precip[40] = null;
  const c2 = compararLluvia(s2, obsDe(s2, 2));
  assert.equal(c2.P26modelo, null);
  assert.equal(c2.P26estacion, 52);
  assert.equal(c2.discrepa, false);                      // el día sin modelo no se compara (no es 2 contra 0)
  assert.equal(c2.diasComparados, 22);
});

// tests/pluvio-publicar.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirPublicacion, publicar } from '../supabase/functions/pluvio/publicar.js';
import { validarPluvio } from '../supabase/functions/_shared/pluvio.js';
import { entreDias } from '../supabase/functions/_shared/meteo.js';
import { horasDeHistorico, estacionesDeRisr } from '../supabase/functions/pluvio/lectores/duero.js';
import { filaObs, ejecutar, fuentesQueTocan } from '../supabase/functions/pluvio/manejador.js';
import { fixture, servidorFalso, almacenPluvioMemoria } from './dobles-pluvio.js';

const risr = estacionesDeRisr(fixture('duero-risr.html'));
const EST = [['PL002', 'Covaleda', 1445], ['PL031', 'Quintanar de la Sierra', 1343]].map(([codigo, nombre, altitud]) => {
  const e = risr.find((x) => x.codigo === codigo);
  return { fuente: 'duero', codigo, nombre, lat: e.lat, lon: e.lon, altitud };
});
const PUNTO = { id: 'soria-pinar-grande-covaleda', zona: 'soria', lat: 41.95, lon: -2.87, altitud: 1450 };
const CELDA = { id: 'soria:1:1', zona: 'soria', lat: 42.0, lon: -2.95, altRef: 1300 };
const horas = (codigo) => horasDeHistorico(fixture(`duero-historico-${codigo}.html`), codigo).map((h) => filaObs('duero', h));
const el = (lugar, fecha) => lugar.mm[entreDias('2026-08-01', fecha)];

test('construirPublicacion: solo los días buenos; AEMET por estación; última fecha con dato por fuente', () => {
  const d = (fuente, estacion, fecha, mm, calidad = 'ok') => ({ fuente, estacion, fecha, mm, horas: 24, maximo: 1, calidad, motivo: null });
  const estaciones = [{ fuente: 'aemet', codigo: 'X', nombre: 'Equis', lat: 40.018, lon: -4, altitud: 1200 }, { fuente: 'duero', codigo: 'PL1', nombre: 'Uno', lat: 39.982, lon: -4, altitud: 1200 }];
  const revisados = [d('aemet', 'X', '2026-09-29', 2), d('duero', 'PL1', '2026-09-29', 4), d('duero', 'PL1', '2026-09-30', 150, 'sospechoso')];
  const { ultimo, celdas } = construirPublicacion({ revisados, estaciones, puntos: [{ id: 'p', lat: 40, lon: -4, altitud: 1200 }],
    celdas: [], desde: '2026-09-29', hasta: '2026-09-30', generado: '2026-10-01T04:10:00.000Z' });
  assert.deepEqual(ultimo.lugares.p.mm, [3, null]);
  assert.deepEqual(ultimo.lugares.p.estaciones.map((e) => e.nombre).sort(), ['Equis', 'Uno']);
  assert.deepEqual(ultimo.aemet, { X: { '2026-09-29': 2 } });
  assert.deepEqual(ultimo.fuentes, { aemet: '2026-09-29', duero: '2026-09-30' });
  assert.deepEqual(validarPluvio(ultimo), []);
  assert.deepEqual(celdas.lugares, {});
});

test('qué toca: publicar no corre fuera de las 4 y las 16 UTC', () => {
  assert.ok(!fuentesQueTocan(new Date('2026-10-02T05:10:00Z')).includes('publicar'));
});

test('publicar sube celdas.json y ultimo.json: Covaleda medida, Quintanar fuera los días sospechosos', async () => {
  const almacen = almacenPluvioMemoria();
  await almacen.guardarObs([...horas('PL002'), ...horas('PL031')]);
  almacen.modelo.set('soria:1:1', new Map([['2026-08-28', 0.4]]));
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([]), esperar: async () => {}, ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: EST, puntos: [PUNTO], gruesa: { celdas: [CELDA] }, pedidas: ['publicar'] });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.pasos.publicar, { dias: 122, puntos: 1, celdas: 1 });
  const ultimo = almacen.archivos.get('pluvio/ultimo.json'), celdas = almacen.archivos.get('pluvio/celdas.json');
  assert.deepEqual(validarPluvio(ultimo), []);
  assert.deepEqual(validarPluvio(celdas), []);
  assert.deepEqual([ultimo.desde, ultimo.hasta], ['2026-08-01', '2026-10-01']);
  const p = ultimo.lugares[PUNTO.id];
  assert.equal(el(p, '2026-08-27'), 3.8);    // Quintanar (551,9) descartado: solo Covaleda
  assert.equal(el(p, '2026-08-28'), 0);      // el pico aislado de Quintanar, fuera
  assert.equal(el(p, '2026-09-17'), null);   // los dos incompletos
  assert.equal(el(p, '2026-08-15'), 6.4);    // 6,415: Covaleda (6,4, a 0,3 km) pesa casi todo; Quintanar (10,8, a 14,7 km) apenas
  assert.equal(p.n[entreDias('2026-08-01', '2026-08-15')], 2);
  assert.deepEqual(p.estaciones.map((e) => e.nombre), ['Covaleda', 'Quintanar de la Sierra']);
  assert.ok(celdas.lugares['soria:1:1']);
  assert.deepEqual(ultimo.fuentes, { duero: '2026-09-30' });
});

// Revisión final 4: lluvia_obs se limpia a los 200 días y la temporada va del 1 de agosto al 31 de julio. El 10/03/2027
// los días anteriores al 24/08/2026 (hoy − 198) se toman de lluvia_dia, con su calidad, y no se reescriben.
test('final de temporada: los días que ya no están enteros en lluvia_obs salen de lluvia_dia; sin ella, sin medir', async () => {
  const almacen = almacenPluvioMemoria();
  const est = [{ fuente: 'duero', codigo: 'PL1', nombre: 'Uno', lat: 41.95, lon: -2.87, altitud: 1450 }];
  const viejo = '2026-08-30T04:10:00.000Z';
  const dia = (fecha, mm, calidad) => ({ fuente: 'duero', estacion: 'PL1', fecha, mm, horas: 24, maximo: 1, calidad, motivo: calidad === 'ok' ? null : 'x', actualizado: viejo });
  await almacen.guardarDias([dia('2026-08-10', 6.4, 'ok'), dia('2026-08-11', 150, 'sospechoso'), dia('2026-08-23', 3.2, 'ok'),
    { ...dia('2026-08-10', 9, 'ok'), estacion: 'FUERA' }]);
  // El 23/08 ya está a medias en lluvia_obs (la limpieza va por horas): 5 horas. El 25/08, entero (24 horas de 0,1 mm).
  const hora = (iso, mm) => filaObs('duero', { estacion: 'PL1', hora: iso, mm });
  await almacen.guardarObs([...Array.from({ length: 5 }, (_, k) => hora(new Date(Date.UTC(2026, 7, 23, 17 + k)).toISOString(), 1)),
    ...Array.from({ length: 24 }, (_, k) => hora(new Date(Date.UTC(2026, 7, 24, 23 + k)).toISOString(), 0.1))]);
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([]), esperar: async () => {}, ahora: new Date('2027-03-10T04:10:00Z'),
    estaciones: est, puntos: [{ id: 'p', lat: 41.95, lon: -2.87, altitud: 1450 }], pedidas: ['publicar'] });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.pasos.publicar, { dias: 1, guardados: 2, puntos: 1, celdas: 0 });
  const p = almacen.archivos.get('pluvio/ultimo.json').lugares.p;
  assert.equal(el(p, '2026-08-10'), 6.4);    // de lluvia_dia
  assert.equal(el(p, '2026-08-11'), null);   // sospechoso en lluvia_dia: fuera
  assert.equal(el(p, '2026-08-12'), null);   // en ninguna de las dos: sin medir, no se inventa
  assert.equal(el(p, '2026-08-23'), 3.2);    // el bueno de lluvia_dia, no las 5 horas que quedan en lluvia_obs
  assert.equal(el(p, '2026-08-25'), 2.4);    // de lluvia_obs, como siempre
  assert.deepEqual(p.estaciones.map((e) => [e.nombre, e.ultimo]), [['Uno', '2026-08-25']]);
  assert.deepEqual({ ...almacen.dias.get('duero|PL1|2026-08-23') }, dia('2026-08-23', 3.2, 'ok'));   // no se reescribe
  assert.equal(almacen.dias.get('duero|PL1|2026-08-25').calidad, 'ok');
  // Sin lluvia_dia para esos días, quedan sin medir.
  const vacio = almacenPluvioMemoria();
  await vacio.guardarObs([...almacen.obs.values()]);
  await ejecutar({ almacen: vacio, fetchFn: servidorFalso([]), esperar: async () => {}, ahora: new Date('2027-03-10T04:10:00Z'),
    estaciones: est, puntos: [{ id: 'p', lat: 41.95, lon: -2.87, altitud: 1450 }], pedidas: ['publicar'] });
  const q = vacio.archivos.get('pluvio/ultimo.json').lugares.p;
  assert.deepEqual([el(q, '2026-08-10'), el(q, '2026-08-23'), el(q, '2026-08-25')], [null, null, 2.4]);
});

// Almacén cuyo reloj avanza al guardar o subir, para probar el tope duro de tiempo.
async function conTiempo(avanza) {
  const almacen = almacenPluvioMemoria();
  await almacen.guardarObs([...horas('PL002'), ...horas('PL031')]);
  let t = 0;
  for (const m of Object.keys(avanza)) { const f = almacen[m]; almacen[m] = async (...a) => { await f(...a); t += avanza[m]; }; }
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([]), esperar: async () => {}, reloj: () => t, plazo: 60000, ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: EST, puntos: [PUNTO], gruesa: { celdas: [CELDA] }, pedidas: ['publicar'] });
  return { r, almacen };
}

test('sin tiempo para el paso: no se guarda ni se sube nada', async () => {
  const almacen = almacenPluvioMemoria();
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([]), esperar: async () => {}, reloj: () => 0, plazo: 1000, ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: EST, puntos: [PUNTO], pedidas: ['publicar'] });
  assert.deepEqual(r.errores, ['publicar: sin tiempo para el paso']);
  assert.equal(almacen.archivos.size, 0);
});

test('tope duro: si el guardado se come el tiempo no se sube nada; si las celdas se lo comen, ultimo.json no sale', async () => {
  const a = await conTiempo({ guardarDias: 58000 });
  assert.deepEqual(a.r.errores, ['publicar: sin tiempo para subir celdas.json']);
  assert.equal(a.almacen.archivos.size, 0);
  const b = await conTiempo({ subir: 58000 });
  assert.deepEqual(b.r.errores, ['publicar: sin tiempo para subir ultimo.json']);
  assert.deepEqual([...b.almacen.archivos.keys()], ['pluvio/celdas.json']);
});

test('tope duro entre trozos de lluvia_dia: no se empieza un trozo sin tiempo', async () => {
  const guardados = [];
  const fechas = Array.from({ length: 2500 }, (_, k) => `2026-${String(8 + Math.floor(k / 28) % 3).padStart(2, '0')}-${String(1 + k % 28).padStart(2, '0')}`);
  const almacen = { precipCeldas: async () => new Map(), guardarDias: async (f) => { guardados.push(f.length); },
    diasPorEstacion: async () => [{ fuente: 'duero', estacion: 'PL002', fechas, mm: fechas.map(() => 0), horas: fechas.map(() => 24), maximo: fechas.map(() => 0) }] };
  let llamadas = 0;
  const quedan = () => (++llamadas <= 1 ? 60000 : 100);
  await assert.rejects(publicar({ almacen, hoy: '2027-01-01', ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: [{ fuente: 'duero', codigo: 'PL002', lat: 41, lon: -3, altitud: 1000 }], quedan }), /sin tiempo para guardar los días/);
  assert.deepEqual(guardados, [1000]);
});

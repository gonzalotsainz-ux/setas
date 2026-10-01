// tests/rejilla-nucleo.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selloDe, tocaEjecutar, pesoPeticion, inicioSerie, estadoCelda, ventanasClima, climaUtil, planificar, serieDesdeFilas,
  aplicarClimaCelda, decidirPublicacion, archivosABorrar, celdasDelLote, pedirConReintento, PlazoAgotado, filasDePrincipal, filasDeArchivoLluvia,
  filasDeClima, altitudConsulta, TROZO, MAX_PASADOS, PRESUPUESTO_EJECUCION, PRESUPUESTO_DIA, HORAS } from '../supabase/functions/rejilla/nucleo.js';
import { horaMadrid, sumarDias } from '../supabase/functions/_shared/meteo.js';
import { CONFIG } from '../scripts/rejilla/config.mjs';

const celdas = (n) => Array.from({ length: n }, (_, k) => ({ id: `z:${k}:0`, zona: 'z', lat: 40 + k * 0.001, lon: -4, altRef: 1000 }));
const completo = (ids, hasta = '2026-09-30') => new Map(ids.map((c) => [c.id, { celda: c.id, desde: '2026-08-01', hasta, dias: 61 }]));
const cerca = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`);

test('las constantes de Open-Meteo son las del sondeo', () => {
  assert.equal(TROZO, CONFIG.openMeteo.trozo);
  assert.equal(MAX_PASADOS, CONFIG.openMeteo.maxPasados);
  assert.equal(PRESUPUESTO_EJECUCION, 500);
});

test('horario: solo a las 07 y 19 de Madrid, también el día del cambio de hora', () => {
  assert.equal(tocaEjecutar(new Date('2026-10-01T05:00:00Z')), '2026-10-01T07');   // verano, UTC+2
  assert.equal(tocaEjecutar(new Date('2026-10-01T06:00:00Z')), null);
  assert.equal(tocaEjecutar(new Date('2026-10-01T17:00:00Z')), '2026-10-01T19');
  assert.equal(tocaEjecutar(new Date('2026-10-25T05:00:00Z')), null);              // 25-oct: ya es UTC+1, son las 06
  assert.equal(tocaEjecutar(new Date('2026-10-25T06:00:00Z')), '2026-10-25T07');
  assert.equal(tocaEjecutar(new Date('2026-11-02T18:00:00Z')), '2026-11-02T19');
  assert.equal(selloDe(new Date('2026-10-01T09:30:00Z')), '2026-10-01T11');
});

test('horario: cada día de los cambios de hora hay exactamente dos ejecuciones (07 y 19), nunca cuatro ni una', () => {
  const lanzamientos = (dia) => [5, 6, 17, 18].map((h) => tocaEjecutar(new Date(`${dia}T${String(h).padStart(2, '0')}:00:00Z`))).filter(Boolean);
  assert.deepEqual(lanzamientos('2026-10-24'), ['2026-10-24T07', '2026-10-24T19']);   // último día de verano
  assert.deepEqual(lanzamientos('2026-10-25'), ['2026-10-25T07', '2026-10-25T19']);   // cambio a las 03:00 → 02:00
  assert.deepEqual(lanzamientos('2027-03-28'), ['2027-03-28T07', '2027-03-28T19']);   // vuelta al horario de verano
  assert.deepEqual(HORAS, [7, 19]);
  assert.equal(selloDe(new Date('2026-10-25T00:30:00Z')), '2026-10-25T02');           // primera vez que son las 02
  assert.equal(selloDe(new Date('2026-10-25T01:30:00Z')), '2026-10-25T02');           // segunda vez (ya UTC+1)
  assert.equal(selloDe(new Date('2026-10-01T09:30:00Z')), horaMadrid(new Date('2026-10-01T09:30:00Z')));
});

test('peso de las peticiones', () => {
  assert.equal(pesoPeticion(100, 9, 12), 100);
  cerca(pesoPeticion(1, 9, 71), 71 / 14);
  cerca(pesoPeticion(1, 1, 122), 122 / 14);
  assert.equal(pesoPeticion(10, 12, 7), 12);
});

test('inicio de la serie: el 1 de agosto de la temporada o 60 días atrás, lo que sea antes', () => {
  assert.equal(inicioSerie('2026-10-01'), '2026-08-01');
  assert.equal(inicioSerie('2026-09-15'), '2026-07-18');
  assert.equal(inicioSerie('2027-03-10'), '2026-08-01');
});

test('estado de cada celda: diaria, relleno corto, relleno desde el inicio y relleno con archivo', () => {
  assert.deepEqual(estadoCelda(undefined, '2026-10-01'), { tipo: 'relleno', pasados: 61 });
  assert.deepEqual(estadoCelda({ desde: '2026-08-01', hasta: '2026-09-30', dias: 61 }, '2026-10-01'), { tipo: 'diaria', pasados: 2 });
  assert.deepEqual(estadoCelda({ desde: '2026-08-01', hasta: '2026-09-28', dias: 59 }, '2026-10-01'), { tipo: 'diaria', pasados: 2 });
  assert.deepEqual(estadoCelda({ desde: '2026-08-01', hasta: '2026-09-27', dias: 58 }, '2026-10-01'), { tipo: 'relleno', pasados: 3 });
  assert.deepEqual(estadoCelda({ desde: '2026-08-01', hasta: '2026-09-30', dias: 50 }, '2026-10-01'), { tipo: 'relleno', pasados: 61 });   // huecos
  assert.deepEqual(estadoCelda({ desde: '2026-08-20', hasta: '2026-09-30', dias: 42 }, '2026-10-01'), { tipo: 'relleno', pasados: 61 });
  assert.deepEqual(estadoCelda(undefined, '2027-03-10', 92), { tipo: 'relleno', pasados: 92, archivo: { desde: '2026-08-01', hasta: '2026-12-07' } });
});

test('ventanas de climatología: del mes anterior al segundo siguiente, en los dos años anteriores', () => {
  assert.deepEqual(ventanasClima('2026-10-01'), { meses: [9, 10, 11, 12], ventanas: [{ desde: '2025-09-01', hasta: '2025-12-31' }, { desde: '2024-09-01', hasta: '2024-12-31' }] });
  assert.deepEqual(ventanasClima('2027-01-15'), { meses: [12, 1, 2, 3], ventanas: [{ desde: '2025-12-01', hasta: '2026-03-31' }, { desde: '2024-12-01', hasta: '2025-03-31' }] });
  assert.equal(climaUtil({ meses: [9, 10, 11, 12] }, '2026-10-10'), true);
  assert.equal(climaUtil({ meses: [9, 10, 11, 12] }, '2026-12-04'), false);
  assert.equal(climaUtil(undefined, '2026-10-10'), false);
});

test('planificar: primera ejecución sin histórico, dentro del presupuesto', () => {
  const p = planificar({ celdas: celdas(350), resumen: new Map(), clima: new Map(), hoy: '2026-10-01', trozo: 100 });
  const enPrincipal = p.peticiones.filter((x) => x.tipo === 'principal').flatMap((x) => x.celdas);
  assert.equal(enPrincipal.length, 98);   // 500 / (71 / 14)
  assert.ok(p.peso <= 500);
  for (const x of p.peticiones.filter((y) => y.tipo === 'principal')) assert.equal(new URL(x.url).searchParams.get('past_days'), '61');
});

test('planificar: el relleno inicial se reparte en varios días sin pasar de 1.000 ponderadas al día (ruling D3)', () => {
  const cs = celdas(350), resumen = new Map();
  let hoy = '2026-10-01', ejecuciones = 0;
  const pesoPorDia = new Map();
  while (cs.some((c) => !resumen.has(c.id)) && ejecuciones < 20) {
    const p = planificar({ celdas: cs, resumen, clima: new Map(cs.map((c) => [c.id, { meses: [9, 10, 11, 12] }])), hoy, trozo: 100 });
    assert.ok(p.peso <= PRESUPUESTO_EJECUCION);
    pesoPorDia.set(hoy, (pesoPorDia.get(hoy) ?? 0) + p.peso);
    // Lo pedido queda completo hasta ayer (simulación de lo que guardará el manejador).
    for (const x of p.peticiones) if (x.tipo === 'principal') for (const c of x.celdas) resumen.set(c.id, { desde: '2026-08-01', hasta: sumarDias(hoy, -1), dias: 0 });
    for (const [id, r] of resumen) resumen.set(id, { ...r, dias: Math.round((Date.parse(r.hasta) - Date.parse(r.desde)) / 864e5) + 1 });
    ejecuciones++;
    if (ejecuciones % 2 === 0) hoy = sumarDias(hoy, 1);
  }
  assert.equal(PRESUPUESTO_DIA, 2 * PRESUPUESTO_EJECUCION);
  assert.ok(ejecuciones >= 4 && ejecuciones <= 6, `${ejecuciones} ejecuciones`);   // ~2-3 días, nunca de golpe
  for (const [dia, peso] of pesoPorDia) assert.ok(peso <= PRESUPUESTO_DIA, `${dia}: ${peso}`);
});

test('planificar: con histórico solo se pide lo nuevo (2 días atrás + 10) y sobra para la climatología', () => {
  const cs = celdas(350);
  const sinClima = planificar({ celdas: cs, resumen: completo(cs), clima: new Map(), hoy: '2026-10-01', trozo: 100 });
  const principales = sinClima.peticiones.filter((x) => x.tipo === 'principal');
  assert.equal(principales.length, 4);
  for (const x of principales) { const q = new URL(x.url).searchParams; assert.equal(q.get('past_days'), '2'); assert.equal(q.get('forecast_days'), '10'); }
  const clima = sinClima.peticiones.filter((x) => x.tipo === 'clima');
  assert.equal(clima.length, 2);                 // un trozo × dos ventanas
  assert.equal(clima[0].celdas.length, 8);       // 150 / (2 × 122 / 14)
  cerca(sinClima.peso, 350 + 8 * (2 * 122) / 14);
  const conClima = new Map(cs.map((c) => [c.id, { celda: c.id, meses: [9, 10, 11, 12], actualizado: '2026-09-20T05:00:00Z' }]));
  const p2 = planificar({ celdas: cs, resumen: completo(cs), clima: conClima, hoy: '2026-10-01', trozo: 100 });
  assert.equal(p2.peticiones.filter((x) => x.tipo === 'clima').length, 0);
  assert.equal(p2.peso, 350);
});

test('planificar: la climatología se renueva de la más vieja a la más nueva', () => {
  const cs = celdas(20);
  const clima = new Map(cs.map((c, k) => [c.id, { meses: [7, 8, 9, 10], actualizado: `2026-09-${String(30 - k).padStart(2, '0')}T05:00:00Z` }]));
  const p = planificar({ celdas: cs, resumen: completo(cs), clima, hoy: '2026-10-01', presupuesto: 20 + 2 * 2 * 122 / 14 + 0.01, trozo: 100 });
  assert.deepEqual(p.peticiones.find((x) => x.tipo === 'clima').celdas.map((c) => c.id), ['z:19:0', 'z:18:0']);
});

test('planificar: las celdas gruesas repetidas entre zonas (misma posición) se piden una sola vez', () => {
  const cs = [
    { id: 'a:34:32', zona: 'a', lat: 40.85, lon: -3.79, altRef: 1360, nFinas: 3000 },
    { id: 'b:34:32', zona: 'b', lat: 40.85, lon: -3.79, altRef: 1240, nFinas: 1000 },
    { id: 'a:35:32', zona: 'a', lat: 40.85, lon: -3.61, altRef: 1100 },
  ];
  const p = planificar({ celdas: cs, resumen: new Map(), clima: new Map(), hoy: '2026-10-01', trozo: 100 });
  const pr = p.peticiones.filter((x) => x.tipo === 'principal');
  assert.equal(pr.length, 1);
  assert.equal(pr[0].celdas.length, 2);
  const q = new URL(pr[0].url).searchParams;
  assert.equal(q.get('latitude'), '40.85,40.85');
  assert.equal(q.get('longitude'), '-3.79,-3.61');
  assert.equal(q.get('elevation'), '1330,1100');   // altitud media de las finas de las dos zonas (3000 × 1360 + 1000 × 1240) / 4000
  assert.deepEqual(pr[0].celdas[0].iguales, ['b:34:32']);
  cerca(p.peso, 2 * 71 / 14 + 2 * 2 * 122 / 14);
  const clima = p.peticiones.filter((x) => x.tipo === 'clima');
  assert.equal(clima.length, 2);
  assert.equal(clima[0].celdas.length, 2);
  // Si una de las dos ya tiene histórico y la otra no, se pide lo que necesita la más atrasada.
  const r = new Map([['a:34:32', { desde: '2026-08-01', hasta: '2026-09-30', dias: 61 }]]);
  const p2 = planificar({ celdas: cs, resumen: r, clima: new Map(), hoy: '2026-10-01', trozo: 100 });
  const urls = p2.peticiones.filter((x) => x.tipo === 'principal').map((x) => new URL(x.url).searchParams.get('past_days'));
  assert.deepEqual(urls, ['61']);
});

test('altitudConsulta: la altitud publicada de cada celda repetida es la misma con la que se pidió la meteo', () => {
  const cs = [
    { id: 'a:34:32', zona: 'a', lat: 40.85, lon: -3.79, altRef: 1360, nFinas: 3000 },
    { id: 'b:34:32', zona: 'b', lat: 40.85, lon: -3.79, altRef: 1240, nFinas: 1000 },
    { id: 'a:35:32', zona: 'a', lat: 40.85, lon: -3.61, altRef: 1100 },
  ];
  const alt = altitudConsulta(cs);
  assert.deepEqual([...alt], [['a:34:32', 1330], ['b:34:32', 1330], ['a:35:32', 1100]]);
  const pr = planificar({ celdas: cs, resumen: new Map(), clima: new Map(), hoy: '2026-10-01' }).peticiones.find((x) => x.tipo === 'principal');
  const elev = new URL(pr.url).searchParams.get('elevation').split(',').map(Number);
  pr.celdas.forEach((c, k) => { for (const id of [c.id, ...(c.iguales ?? [])]) assert.equal(alt.get(id), elev[k], id); });
});

test('planificar: un grupo repetido pide los pasados máximos de sus miembros, en cualquier orden', () => {
  const a = { id: 'a:1:1', lat: 40, lon: -4, altRef: 1000 }, b = { id: 'b:1:1', lat: 40, lon: -4, altRef: 1000 };
  const r = new Map([['a:1:1', { desde: '2026-08-01', hasta: '2026-09-30', dias: 61 }], ['b:1:1', { desde: '2026-08-01', hasta: '2026-09-27', dias: 58 }]]);
  const clima = new Map([a, b].map((c) => [c.id, { meses: [9, 10, 11, 12] }]));
  for (const orden of [[a, b], [b, a]]) {
    const p = planificar({ celdas: orden, resumen: r, clima, hoy: '2026-10-01' });
    assert.deepEqual(p.peticiones.map((x) => new URL(x.url).searchParams.get('past_days')), ['3']);
  }
  // Con archivo (marzo): el archivo empieza en lo más antiguo de los dos.
  const r2 = new Map([['a:1:1', { desde: '2026-08-01', hasta: '2026-08-31', dias: 31 }]]);
  for (const orden of [[a, b], [b, a]]) {
    const ar = planificar({ celdas: orden, resumen: r2, clima, hoy: '2027-03-10', maxPasados: 92 }).peticiones.find((x) => x.tipo === 'archivo');
    assert.equal(ar.desde, '2026-08-01');
    assert.equal(ar.hasta, '2026-12-07');
  }
});

test('serie: una previsión vieja no cuenta como dato (días pasados previstos; hoy y después sin renovar)', () => {
  const fila = { celda: 'a', fechas: ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'], precip: [5, 12, 8, 0, 1],
    previsto: [false, true, true, true, true], actualizado: Array(5).fill('2026-09-28T05:00:00Z') };
  const s = serieDesdeFilas(fila, '2026-09-28', '2026-10-02', '2026-10-01', '2026-10-01T05:00:00Z');
  assert.deepEqual(s.precip, [5, null, null, null, null]);
  const nueva = { ...fila, actualizado: [...Array(3).fill('2026-09-28T05:00:00Z'), '2026-10-01T05:00:12Z', '2026-10-01T05:00:12Z'] };
  assert.deepEqual(serieDesdeFilas(nueva, '2026-09-28', '2026-10-02', '2026-10-01', '2026-10-01T05:00:00Z').precip, [5, null, null, 0, 1]);
  assert.deepEqual(serieDesdeFilas(fila, '2026-09-28', '2026-10-02', '2026-10-01').precip, [5, null, null, 0, 1]);   // sin inicio: solo la regla de los días pasados
  assert.throws(() => serieDesdeFilas({ fechas: [] }, '2026-09-01', '2026-09-03', '2026-10-01'), /hoy/);
});

const respuestaPrincipal = (hoy, n) => {
  const fechas = [sumarDias(hoy, -1), hoy];
  const horas = fechas.flatMap((f) => Array.from({ length: 24 }, (_, h) => `${f}T${String(h).padStart(2, '0')}:00`));
  return Array.from({ length: n }, (_, k) => ({ elevation: 1000 + k, daily: { time: fechas, precipitation_sum: [1 + k, 2 + k], temperature_2m_mean: [10, 11],
    temperature_2m_min: [5, 6], temperature_2m_max: [15, 16], et0_fao_evapotranspiration: [2, 2], wind_speed_10m_max: [10, 12], relative_humidity_2m_mean: [70, 80] },
  hourly: { time: horas, soil_moisture_0_to_7cm: horas.map(() => 0.3), soil_temperature_0_to_7cm: horas.map(() => 12) } }));
};

test('filas de una respuesta: cada celda repetida recibe las mismas filas que su representante', () => {
  const p = planificar({ celdas: [{ id: 'a:1:1', lat: 40, lon: -4, altRef: 1000 }, { id: 'b:1:1', lat: 40, lon: -4, altRef: 1000 }, { id: 'a:2:1', lat: 40.2, lon: -4, altRef: 900 }],
    resumen: new Map(), clima: new Map(), hoy: '2026-10-01' });
  const pr = p.peticiones.find((x) => x.tipo === 'principal');
  const ahora = new Date('2026-10-01T05:00:00Z');
  const filas = filasDePrincipal(respuestaPrincipal('2026-10-01', 2), pr.celdas, '2026-10-01', ahora);
  assert.equal(filas.length, 6);
  const de = (id) => filas.filter((f) => f.celda === id);
  assert.deepEqual(de('a:1:1').map((f) => f.precip), [1, 2]);
  assert.deepEqual(de('b:1:1').map((f) => f.precip), [1, 2]);
  assert.deepEqual(de('a:2:1').map((f) => f.precip), [2, 3]);
  assert.deepEqual(de('a:1:1').map((f) => f.previsto), [false, true]);
  cerca(de('a:1:1')[0].hsuelo, 0.3);
  assert.equal(de('a:1:1')[0].actualizado, '2026-10-01T05:00:00.000Z');
  const lluvia = filasDeArchivoLluvia([{ daily: { time: ['2026-08-01', '2026-08-02'], precipitation_sum: [4, null] } }, { daily: { time: ['2026-08-01'], precipitation_sum: [7] } }],
    pr.celdas, '2026-08-01', '2026-08-02', ahora);
  assert.deepEqual(lluvia.map((f) => [f.celda, f.fecha, f.precip]), [['a:1:1', '2026-08-01', 4], ['b:1:1', '2026-08-01', 4], ['a:2:1', '2026-08-01', 7]]);
  const muestra = (n) => ({ daily: { time: ['2025-09-15', '2025-10-15', '2025-11-15', '2025-12-15'].slice(0, n), soil_moisture_0_to_7cm_mean: [0.1, 0.2, 0.3, 0.4].slice(0, n) } });
  const clima = filasDeClima([[muestra(4), muestra(3)], [muestra(4), muestra(3)]], pr.celdas, '2026-10-01', ahora);
  assert.deepEqual(clima.map((f) => f.celda), ['a:1:1', 'b:1:1']);   // la tercera no tiene diciembre
  assert.deepEqual(clima[1].por_mes[9], [0.1, 0.1]);
});

test('serie desde las filas: días seguidos, null donde falta, hoy en su sitio', () => {
  const s = serieDesdeFilas({ celda: 'a', fechas: ['2026-08-01', '2026-08-03'], precip: [1, 3], tmedia: [10, 12] }, '2026-08-01', '2026-08-04', '2026-08-03');
  assert.deepEqual(s.fechas, ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']);
  assert.deepEqual(s.precip, [1, null, 3, null]);
  assert.deepEqual(s.tmedia, [10, null, 12, null]);
  assert.deepEqual(s.tmin, [null, null, null, null]);
  assert.equal(s.hoy, 2);
  assert.equal(s.lluviaAntesDeSerie, null);
});

test('climatología de una celda: percentil donde la ventana cubre el mes; null donde no', () => {
  const s = serieDesdeFilas({ celda: 'a', fechas: ['2026-10-01', '2027-01-10'], hsuelo: [0.3, 0.3] }, '2026-10-01', '2027-01-10', '2026-10-01');
  const muestra = Array.from({ length: 60 }, (_, k) => 0.2 + k / 300);
  const fila = { celda: 'a', meses: [9, 10, 11, 12], por_mes: { 9: muestra, 10: muestra, 11: muestra, 12: muestra } };
  const c = aplicarClimaCelda(s, fila);
  assert.ok(c.hsueloPct[0] > 0 && c.hsueloPct[0] < 100);
  assert.equal(c.hsueloPct.at(-1), null);   // enero necesita diciembre, enero y febrero
  assert.equal(aplicarClimaCelda(s, undefined), s);
});

test('regla del 90 %, limpieza de archivos viejos y lotes', () => {
  assert.equal(decidirPublicacion(315, 350), true);
  assert.equal(decidirPublicacion(314, 350), false);
  assert.equal(decidirPublicacion(0, 0), false);
  const nombres = ['ultimo.json', ...['01T07', '01T19', '02T07', '02T19', '03T07', '03T19', '04T07', '04T19'].map((s) => `2026-10-${s}.json`)];
  assert.deepEqual(archivosABorrar(nombres), ['2026-10-01T19.json', '2026-10-01T07.json']);
  assert.deepEqual(celdasDelLote(celdas(5), 1, 2).map((c) => c.id), ['z:1:0', 'z:3:0']);
});

test('pedirConReintento: espera y reintenta los 429; con Retry-After, lo respeta; al tercer fallo, error', async () => {
  const respuestas = (lista) => { let n = 0; return async () => lista[n++]; };
  const ok = { ok: true, status: 200, headers: new Map(), json: async () => ({ daily: {} }) };
  const no = (h = []) => ({ ok: false, status: 429, headers: new Map(h), json: async () => ({}) });
  const esperas = [];
  const esperar = async (ms) => { esperas.push(ms); };
  assert.deepEqual(await pedirConReintento(respuestas([no(), no(), ok]), 'u', { esperar }), { daily: {} });
  assert.deepEqual(esperas, [5000, 20000]);
  esperas.length = 0;
  await pedirConReintento(respuestas([no([['retry-after', '2']]), ok]), 'u', { esperar });
  assert.deepEqual(esperas, [2000]);
  await assert.rejects(pedirConReintento(respuestas([no(), no(), no()]), 'u', { esperar }), /429/);
  await assert.rejects(pedirConReintento(respuestas([{ ok: false, status: 400, headers: new Map(), json: async () => ({}) }]), 'u', { esperar }), /400/);
});

test('pedirConReintento: Retry-After enorme se acota a 60 s; fallo de red se reintenta; error de Open-Meteo en el cuerpo, no', async () => {
  const esperas = [];
  const esperar = async (ms) => { esperas.push(ms); };
  const ok = { ok: true, status: 200, headers: new Map(), json: async () => ({ daily: {} }) };
  let n = 0;
  await pedirConReintento(async () => (n++ === 0 ? { ok: false, status: 429, headers: new Map([['retry-after', '3600']]), json: async () => ({}) } : ok), 'u', { esperar });
  assert.deepEqual(esperas, [60000]);
  n = 0; esperas.length = 0;
  await pedirConReintento(async () => { if (n++ === 0) throw new TypeError('fetch failed'); return ok; }, 'u', { esperar });
  assert.deepEqual(esperas, [5000]);
  await assert.rejects(pedirConReintento(async () => ({ ok: true, status: 200, headers: new Map(), json: async () => ({ error: true, reason: 'Parameter x' }) }), 'u', { esperar }), /Parameter x/);
});

test('pedirConReintento: límite como función, recalculado en cada intento; sin mínimo útil no empieza', async () => {
  let queda = 50000;
  const limites = [];
  const colgada = async (url, { signal }) => { limites.push(signal); queda -= signal; throw new Error('aborted'); };
  const opciones = { esperar: async (ms) => { queda -= ms; }, limite: () => queda, minimo: 5000, senal: (ms) => ms };
  await assert.rejects(pedirConReintento(colgada, 'u', opciones), (e) => e instanceof PlazoAgotado);
  assert.deepEqual(limites, [50000], 'tras 50 s y 5 s de espera no quedan 5 s útiles');
  queda = 100000; limites.length = 0;
  await assert.rejects(pedirConReintento(colgada, 'u', { ...opciones, limite: () => Math.min(60000, queda) }), /aborted|plazo/);
  assert.deepEqual(limites, [60000, 35000]);
  limites.length = 0;
  await assert.rejects(pedirConReintento(colgada, 'u', { ...opciones, limite: () => 3000 }), (e) => e instanceof PlazoAgotado);
  assert.deepEqual(limites, []);
});

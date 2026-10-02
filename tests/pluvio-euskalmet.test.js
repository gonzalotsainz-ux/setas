// tests/pluvio-euskalmet.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { horasDeXmlEuskalmet, lecturasDeXml, horasDeLecturas, estacionesDeEuskalmet, altitudDeXmlDatos } from '../supabase/functions/pluvio/lectores/euskalmet.js';
import { entradasZip, leerEntrada } from '../scripts/pluvio/zip.mjs';
import { filasDeZipEuskalmet, conLluviaEnZip } from '../scripts/pluvio/euskalmet-zip.mjs';
import { agregarHoras } from '../supabase/functions/pluvio/dias.js';
import { cargarFilas, leerCuerpoCarga, MAX_FILAS_CARGA } from '../supabase/functions/pluvio/manejador.js';
import { fixture, fixtureJson, crearZip, almacenPluvioMemoria } from './dobles-pluvio.js';

const xml = () => fixture('euskalmet-C025-2026-8.xml', 'latin1');
const delDia = (dias, fecha) => { const d = dias.find((x) => x.fecha === fecha); return d && { mm: d.mm, horas: d.horas }; };
const EST = [{ fuente: 'euskalmet', codigo: 'C025' }, { fuente: 'duero', codigo: 'PL002' }];

test('Euskalmet: lecturas de 10 min (UTC) a horas; una hora vale con sus 6 lecturas', () => {
  assert.equal(lecturasDeXml(xml()).length, 432);   // 3 días × 144
  const filas = horasDeXmlEuskalmet(xml(), 'C025');
  assert.equal(filas.length, 71);   // la primera hora (1 lectura) y la última (5) no valen
  assert.deepEqual(filas.find((f) => f.hora === '2026-08-20T13:00:00.000Z'), { estacion: 'C025', hora: '2026-08-20T13:00:00.000Z', mm: 8.4 });
  const dias = agregarHoras(filas.map((f) => ({ ...f, fuente: 'euskalmet' })), '2026-08-01');
  assert.deepEqual(delDia(dias, '2026-08-20'), { mm: 13.1, horas: 24 });
  assert.deepEqual(delDia(dias, '2026-08-21'), { mm: 2.7, horas: 24 });
  assert.deepEqual(delDia(dias, '2026-08-19'), { mm: 0.2, horas: 22 });
});

test('Euskalmet: una lectura no numérica o negativa deja esa hora sin dato', () => {
  const t0 = Date.parse('2026-08-20T12:10:00Z');
  const seis = Array.from({ length: 6 }, (_, k) => ({ t: t0 + k * 600e3, mm: 0.1 }));
  assert.equal(horasDeLecturas(seis, 'X').length, 1);
  assert.equal(horasDeLecturas([...seis.slice(0, 5), { t: t0 + 5 * 600e3, mm: null }], 'X').length, 0);
});

test('Euskalmet: lista de estaciones (sin boyas ni bajas) y altitud del XMLdatos', () => {
  const l = estacionesDeEuskalmet(fixtureJson('euskalmet-estaciones.json'));
  assert.deepEqual(l.map((e) => e.codigo), ['C024', 'C025', 'C035']);
  assert.deepEqual({ ...l.find((e) => e.codigo === 'C025'), xmlDatos: null }, { codigo: 'C025', nombre: 'Beluntza', lat: 42.9615782, lon: -2.89361, xmlDatos: null });
  assert.equal(altitudDeXmlDatos(fixture('euskalmet-datos-C025.xml', 'latin1')), 687);
});

test('zip de zips: el lector mínimo saca el XML de agosto y las horas desde la fecha pedida', () => {
  const interno = crearZip({ 'C025/C025_2026_8.xml': Buffer.from(xml(), 'latin1'), 'C025/C025_2026_8.xsd': Buffer.from('<xs:schema/>') });
  const zip = crearZip({ '2026/C025_2026.zip': interno });
  const ent = entradasZip(zip);
  assert.deepEqual([...ent.keys()], ['2026/C025_2026.zip']);
  assert.equal(entradasZip(leerEntrada(zip, ent.get('2026/C025_2026.zip'))).size, 2);
  const { filas, avisos } = filasDeZipEuskalmet(zip, [{ codigo: 'C025' }, { codigo: 'C999' }], '2026-08-20');
  assert.equal(filas.length, 49);   // 24 del 20, 24 del 21 y 1 del 22 (día de Madrid)
  assert.ok(filas.every((f) => f.fuente === 'euskalmet' && f.estacion === 'C025'));
  assert.deepEqual(avisos, ['C999: no está en el zip']);
  assert.deepEqual([...conLluviaEnZip(zip, ['C025', 'C999'])], ['C025']);
  assert.throws(() => entradasZip(Buffer.from('no es un zip, es un texto cualquiera')), /no es un zip/);
});

test('cargarFilas: solo estaciones de la lista blanca, horas en punto y mm numéricos o nulos', async () => {
  const almacen = almacenPluvioMemoria();
  const buena = { fuente: 'euskalmet', estacion: 'C025', hora: '2026-08-20T13:00:00.000Z', mm: 8.4 };
  assert.deepEqual(await cargarFilas({ almacen, estaciones: EST, cuerpo: { filas: [buena, { ...buena, mm: 9 }, { ...buena, hora: '2026-08-20T14:00:00.000Z', mm: null }] } }),
    { ok: true, guardadas: 2 });
  assert.equal(almacen.obs.get('euskalmet|C025|2026-08-20T13:00:00.000Z').mm, 9);   // repetida: gana la última
  for (const mala of [{ ...buena, estacion: 'C999' }, { ...buena, hora: '2026-08-20T13:10:00.000Z' }, { ...buena, mm: 'ocho' }, { ...buena, fuente: 'tajo' }]) {
    const r = await cargarFilas({ almacen, estaciones: EST, cuerpo: { filas: [mala] } });
    assert.equal(r.ok, false, JSON.stringify(mala));
    assert.match(r.error, /no válidas/);
  }
  assert.equal((await cargarFilas({ almacen, estaciones: EST, cuerpo: { filas: [] } })).ok, false);
  assert.equal((await cargarFilas({ almacen, estaciones: EST, cuerpo: { filas: Array(MAX_FILAS_CARGA + 1).fill(buena) } })).ok, false);
  assert.equal((await cargarFilas({ almacen, estaciones: EST, cuerpo: null })).ok, false);
});

test('index.ts: ?accion=cargar pasa por la misma clave y por cargarFilas', () => {
  const index = readFileSync('supabase/functions/pluvio/index.ts', 'utf8');
  assert.match(index, /searchParams\.get\('accion'\) === 'cargar'/);
  assert.match(index, /cargarFilas\(/);
  assert.ok(index.indexOf('claveValida(') < index.indexOf("=== 'cargar'"), 'la clave se comprueba antes');
});

// --- Ronda de arreglos 1 ---
const FIN = Date.parse('2026-08-20T13:00:00Z');
const ranuras = (fin = FIN) => Array.from({ length: 6 }, (_, k) => fin - 3000e3 + k * 600e3);   // :10 … :00
const xmlDeLecturas = (lista) => lista.map(([t, p]) => { const d = new Date(t).toISOString();
  return `<dia Dia="${d.slice(0, 10)}"><hora Hora="${d.slice(11, 16)}">${p}</hora></dia>`; }).join('');
const precip = (v) => `<Precip>${v}</Precip>`;

test('Euskalmet: Precip vacío, en blanco, autocerrado, ausente o con texto es lectura inválida, no 0 mm', () => {
  for (const p of ['<Precip></Precip>', '<Precip> </Precip>', '<Precip/>', '<Precip />', '', '<Precip>n/d</Precip>', '<Precip>-0.1</Precip>']) {
    assert.equal(lecturasDeXml(xmlDeLecturas([[FIN, p]]))[0].mm, null, p);
  }
  assert.equal(lecturasDeXml(xmlDeLecturas([[FIN, '<Precip> 0.25 </Precip>']]))[0].mm, 0.25);
  const seis = ranuras().map((t, k) => [t, k === 2 ? '<Precip/>' : precip('0.1')]);
  assert.equal(horasDeXmlEuskalmet(xmlDeLecturas(seis), 'X').length, 0);
});

test('Euskalmet: una ranura repetida no cuenta doble y una ausente invalida la hora', () => {
  const seis = ranuras().map((t) => ({ t, mm: 0.1 }));
  assert.equal(horasDeLecturas([...seis, seis[0]], 'X')[0].mm, 0.6);   // 7 lecturas, 6 ranuras
  assert.equal(horasDeLecturas([seis[0], seis[0], ...seis.slice(2), seis[5]], 'X').length, 0);   // falta una ranura aunque haya 6 lecturas
  assert.equal(horasDeLecturas([...seis, { ...seis[0], mm: 0.3 }], 'X').length, 0);   // repetida con otro valor
});

test('Euskalmet: la hora no se redondea a 0,1: 24 × 0,04 mm suman 0,96 y el día sale 1,0', () => {
  const lecturas = [];
  for (let k = 0; k < 24; k++) ranuras(Date.parse('2026-08-19T23:00:00Z') + k * 3600e3).forEach((t, j) => lecturas.push({ t, mm: j === 0 ? 0.04 : 0 }));
  const filas = horasDeLecturas(lecturas, 'C025');
  assert.equal(filas.length, 24);
  assert.ok(filas.every((f) => f.mm === 0.04));
  assert.deepEqual(delDia(agregarHoras(filas.map((f) => ({ ...f, fuente: 'euskalmet' })), '2026-08-01'), '2026-08-20'), { mm: 1, horas: 24 });
});

test('zip: la hora de las 00:00 UTC del día 1 junta lecturas de dos meses; un mes vacío da aviso', () => {
  const jul = xmlDeLecturas(ranuras(Date.parse('2026-08-01T00:00:00Z')).slice(0, 5).map((t) => [t, precip('0.2')]));
  const ago = xmlDeLecturas([[Date.parse('2026-08-01T00:00:00Z'), precip('0.2')]]);
  const interno = crearZip({ 'C025/C025_2026_7.xml': Buffer.from(jul), 'C025/C025_2026_8.xml': Buffer.from(ago) });
  const { filas, avisos } = filasDeZipEuskalmet(crearZip({ '2026/C025_2026.zip': interno }), [{ codigo: 'C025' }], '2026-07-01');
  assert.deepEqual(filas, [{ fuente: 'euskalmet', estacion: 'C025', hora: '2026-08-01T00:00:00.000Z', mm: 1.2 }]);
  assert.deepEqual(avisos, []);
  const vacio = crearZip({ '2026/C025_2026.zip': crearZip({ 'C025/C025_2026_9.xml': Buffer.from('<datos/>') }) });
  assert.deepEqual(filasDeZipEuskalmet(vacio, [{ codigo: 'C025' }], '2026-07-01').avisos, ['C025: el mes 9 no trae lecturas']);
});

test('cargarFilas: solo Euskalmet, mm >= 0 y fechas dentro de la ventana', async () => {
  const almacen = almacenPluvioMemoria();
  const ahora = new Date('2026-10-02T12:00:00Z');
  const buena = { fuente: 'euskalmet', estacion: 'C025', hora: '2026-08-20T13:00:00.000Z', mm: 8.4 };
  const malas = [{ ...buena, fuente: 'duero', estacion: 'PL002' }, { ...buena, mm: -1 }, { ...buena, hora: '2025-08-20T13:00:00.000Z' },
    { ...buena, hora: '2026-10-04T13:00:00.000Z' }];
  for (const mala of malas) {
    const r = await cargarFilas({ almacen, estaciones: EST, cuerpo: { filas: [mala] }, ahora });
    assert.equal(r.ok, false, JSON.stringify(mala));
  }
  assert.equal((await cargarFilas({ almacen, estaciones: EST, cuerpo: { filas: [{ ...buena, hora: '2026-10-03T00:00:00.000Z' }] }, ahora })).ok, true);
});

test('leerCuerpoCarga: JSON malo da 400 y un cuerpo demasiado grande, 413 sin leerlo', async () => {
  assert.deepEqual(await leerCuerpoCarga(new Request('http://x', { method: 'POST', body: '{mal' })), { error: 'cuerpo no válido', status: 400 });
  assert.deepEqual(await leerCuerpoCarga(new Request('http://x', { method: 'POST', body: '{"filas":[]}' })), { cuerpo: { filas: [] } });
  const grande = { headers: { get: () => '2000000' }, text: async () => { throw new Error('no debía leerse'); } };
  assert.equal((await leerCuerpoCarga(grande)).status, 413);
});

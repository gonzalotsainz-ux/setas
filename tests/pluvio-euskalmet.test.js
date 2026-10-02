// tests/pluvio-euskalmet.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { horasDeXmlEuskalmet, lecturasDeXml, horasDeLecturas, estacionesDeEuskalmet, altitudDeXmlDatos } from '../supabase/functions/pluvio/lectores/euskalmet.js';
import { entradasZip, leerEntrada } from '../scripts/pluvio/zip.mjs';
import { filasDeZipEuskalmet, conLluviaEnZip } from '../scripts/pluvio/euskalmet-zip.mjs';
import { agregarHoras } from '../supabase/functions/pluvio/dias.js';
import { cargarFilas, MAX_FILAS_CARGA } from '../supabase/functions/pluvio/manejador.js';
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

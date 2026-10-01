// tests/rejilla-generar.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirZona, gruesasDeZona, elegirPaso, partirEnBandas, indiceEspacial, compactar, puntoEnCompacta, leerFeaturesPorLineas } from '../scripts/rejilla/generar.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodificarRejilla, PROHIBIDO, ORIENTACIONES } from '../js/rejilla/formato.js';
import { HABITATS } from '../scripts/validar-datos.mjs';

const zona = { id: 'guadarrama', bbox: [-4.25, 40.65, -3.7701, 41.05] };
const ventana = { col0: 78361, fila0: 60161, ancho: 4, alto: 3 };   // celdas alrededor del centro de guadarrama:66:65
const altitudes = Float32Array.from({ length: 12 }, (_, k) => 1500 + Math.floor(k / 4) * 25);   // sube 25 m por fila hacia el sur
// Bordes de la ventana: columnas en −4,017790 / −4,015544 / −4,013298 / …; filas en 40,897661 / 40,895963 / 40,894266 / …
const k = (c, f) => f * 4 + c;

test('construirZona: prohibido con marca y sin hábitat; sin monte, todo a 0; con monte, hábitat, terreno y altitud', () => {
  const p = construirZona({ zona, ventana, altitudes,
    mfeEn: (lon, lat, alt) => (alt > 0 ? 'pinar-silvestre' : null),
    prohibidoEn: (lon, lat) => lon < -4.0156 && lat > 40.896 });   // solo la celda (0, 0): centro −4,0167, 40,8968
  assert.equal(p.habitat[k(0, 0)], PROHIBIDO);
  assert.equal(p.altitud[k(0, 0)], 0);
  assert.equal(p.habitat[k(1, 0)], HABITATS.indexOf('pinar-silvestre') + 1);
  assert.equal(p.habitat[k(1, 1)], HABITATS.indexOf('pinar-silvestre') + 1);
  assert.equal(ORIENTACIONES[p.terreno[k(1, 1)] & 0x0f], 'N');   // 25 m cada 189 m reales: 13 %, umbría
  assert.equal(p.terreno[k(1, 1)] >> 4, 1);
  assert.equal(p.altitud[k(1, 1)], 1525);
  const sinMonte = construirZona({ zona, ventana, altitudes, mfeEn: () => null, prohibidoEn: () => false });
  assert.ok(sinMonte.habitat.every((h) => h === 0) && sinMonte.terreno.every((t) => t === 0) && sinMonte.altitud.every((a) => a === 0));
});

test('construirZona: una celda es prohibida si cualquiera de sus esquinas cae en un prohibido (aunque no su centro)', () => {
  // El polígono llega a −4,0155: toca las esquinas oeste de la columna 1 (−4,015544), no su centro (−4,0144).
  const p = construirZona({ zona, ventana, altitudes, mfeEn: () => 'pinar-silvestre', prohibidoEn: (lon, lat) => lon < -4.0155 && lat > 40.896 });
  assert.equal(p.habitat[k(0, 0)], PROHIBIDO);
  assert.equal(p.habitat[k(1, 0)], PROHIBIDO);                  // por sus esquinas noroeste y suroeste
  assert.equal(p.habitat[k(2, 0)], HABITATS.indexOf('pinar-silvestre') + 1);
  assert.equal(p.habitat[k(1, 1)], HABITATS.indexOf('pinar-silvestre') + 1);   // su esquina más al norte está en 40,895963
  // Esquina sureste de la celda (0, 0) = esquina noroeste de la (1, 1): un punto ahí marca las cuatro celdas que la comparten.
  const e = construirZona({ zona, ventana, altitudes, mfeEn: () => 'pinar-silvestre',
    prohibidoEn: (lon, lat) => Math.abs(lon - -4.015544) < 2e-6 && Math.abs(lat - 40.895963) < 2e-6 });
  assert.deepEqual([k(0, 0), k(1, 0), k(0, 1), k(1, 1), k(2, 1)].map((i) => e.habitat[i] === PROHIBIDO), [true, true, true, true, false]);
});

test('gruesasDeZona: altitud de referencia = media de las celdas con monte; las prohibidas no cuentan', () => {
  const planos = construirZona({ zona, ventana, altitudes, mfeEn: () => 'pinar-silvestre', prohibidoEn: (lon) => lon < -4.0156 });   // la columna 0
  const g = gruesasDeZona(zona, ventana, planos, 0.09);
  assert.equal(g.length, 1);
  assert.equal(g[0].id, 'guadarrama:66:65');
  assert.deepEqual(g[0].habitats, ['pinar-silvestre']);
  assert.equal(planos.habitat.filter((h) => h & PROHIBIDO).length, 3);
  assert.equal(g[0].nFinas, 12 - 3);
  const conMonte = [...planos.altitud].filter((a, i) => !(planos.habitat[i] & PROHIBIDO));
  assert.equal(g[0].altRef, Math.round(conMonte.reduce((a, b) => a + b, 0) / conMonte.length));
  assert.ok(Math.abs(g[0].lon - -4.015) < 1e-9 && Math.abs(g[0].lat - 40.895) < 1e-9);
});

test('elegirPaso: el más fino que no pase del máximo', () => {
  const cuenta = { 0.09: 1190, 0.12: 670, 0.15: 430, 0.18: 300 };
  assert.equal(elegirPaso((p) => cuenta[p], [0.09, 0.12, 0.15, 0.18], 350), 0.18);
  assert.equal(elegirPaso((p) => cuenta[p], [0.09, 0.12, 0.15, 0.18], 700), 0.12);
  assert.equal(elegirPaso(() => 5000, [0.09, 0.12], 350), 0.12);
});

test('partirEnBandas: parte por filas hasta que cada archivo cabe, y las bandas juntas son la zona', async () => {
  const ancho = 60, alto = 40, n = ancho * alto;
  let s = 7; const azar = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const planos = { habitat: Uint8Array.from({ length: n }, () => Math.floor(azar() * 17)), terreno: Uint8Array.from({ length: n }, () => Math.floor(azar() * 64)),
    altitud: Int16Array.from({ length: n }, () => Math.floor(azar() * 3000)) };
  const fuente = { nombre: 'x', url: 'https://x.es', fecha: '2026-10-01' };
  const cab = { version: 1, zona: 'soria', tam: 250, col0: 0, fila0: 100, ancho, alto, habitats: HABITATS, fuentes: { mfe: fuente, mdt: fuente }, generado: '2026-10-01' };
  const entera = await partirEnBandas(cab, planos, 1e9);
  assert.deepEqual(entera.map((b) => b.archivo), ['soria.bin']);
  const max = Math.ceil(entera[0].bytes.length / 2.5);
  const bandas = await partirEnBandas(cab, planos, max);
  assert.ok(bandas.length >= 3);
  assert.deepEqual(bandas.map((b) => b.archivo), bandas.map((_, i) => `soria-${i + 1}.bin`));
  assert.ok(bandas.every((b) => b.bytes.length <= max));
  const altos = [];
  for (const b of bandas) { const r = await decodificarRejilla(b.bytes); altos.push(...r.altitud); assert.equal(r.cabecera.fila0, 100 + bandas.slice(0, bandas.indexOf(b)).reduce((t, x) => t + x.cabecera.alto, 0)); }
  assert.deepStrictEqual(Int16Array.from(altos), planos.altitud);
});

test('indiceEspacial: encuentra el polígono que contiene el punto', () => {
  const f = { type: 'Feature', properties: { id: 'a' }, geometry: { type: 'Polygon', coordinates: [[[-4, 40], [-3.9, 40], [-3.9, 40.1], [-4, 40.1], [-4, 40]]] } };
  const i = indiceEspacial([f]);
  assert.equal(i.buscar(-3.95, 40.05)?.properties.id, 'a');
  assert.equal(i.buscar(-3.85, 40.05), null);
});

test('geometría compacta: mismo resultado que el GeoJSON, huecos incluidos, y sirve al índice', () => {
  const g = { type: 'MultiPolygon', coordinates: [
    [[[-4, 40], [-3.9, 40], [-3.9, 40.1], [-4, 40.1], [-4, 40]], [[-3.97, 40.03], [-3.93, 40.03], [-3.93, 40.07], [-3.97, 40.07], [-3.97, 40.03]]],
    [[[-3.8, 40], [-3.7, 40], [-3.75, 40.1], [-3.8, 40]]]] };
  const c = compactar(g);
  assert.deepEqual(c.bbox, [-4, 40, -3.7, 40.1]);
  for (const [lon, lat, esperado] of [[-3.99, 40.01, true], [-3.95, 40.05, false], [-3.75, 40.05, true], [-3.85, 40.05, false], [-3.72, 40.08, false]]) {
    assert.equal(puntoEnCompacta(lon, lat, c), esperado, `${lon}, ${lat}`);
  }
  const i = indiceEspacial([{ id: 'a', ...c }], 0.02, { bbox: (f) => f.bbox, contiene: (lon, lat, f) => puntoEnCompacta(lon, lat, f) });
  assert.equal(i.buscar(-3.99, 40.01)?.id, 'a');
  assert.equal(i.buscar(-3.95, 40.05), null);
});

test('leerFeaturesPorLineas: lee el GeoJSON de mapshaper feature a feature (con CRLF)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'setas-'));
  const ruta = join(dir, 'x.geojson');
  const f = (n) => `{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]},"properties":{"SP1":${n}}}`;
  writeFileSync(ruta, `{"type":"FeatureCollection", "features": [
${f(1)},
${f(2)},
${f(3)}
]}
`);
  try {
    const r = await leerFeaturesPorLineas(ruta, (x) => (x.properties.SP1 === 2 ? null : x.properties.SP1));
    assert.deepEqual(r, [1, 3]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

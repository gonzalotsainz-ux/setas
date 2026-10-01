// tests/rejilla-config.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CONFIG } from '../scripts/rejilla/config.mjs';

const lleno = (v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

test('el sondeo dejó elegido el MDT con licencia, atribución y fecha', () => {
  assert.ok(['ign-wcs', 'glo30', 'terrarium'].includes(CONFIG.mdt.fuente));
  for (const k of ['nombre', 'url', 'licencia', 'atribucion']) assert.ok(lleno(CONFIG.mdt[k]), `mdt.${k}`);
  assert.match(CONFIG.mdt.fecha ?? '', FECHA);
});

test('el sondeo dejó el MFE50 con campos, tipos y un ZIP por provincia de las zonas y de sus vecinas', () => {
  for (const k of ['nombre', 'url', 'licencia', 'atribucion', 'carpeta']) assert.ok(lleno(CONFIG.mfe[k]), `mfe.${k}`);
  assert.match(CONFIG.mfe.fecha ?? '', FECHA);
  assert.ok(lleno(CONFIG.mfe.campos.especies) && lleno(CONFIG.mfe.campos.fcc) && lleno(CONFIG.mfe.campos.tipo));
  for (const t of ['arbolado', 'herbazal', 'matorral']) assert.ok(Array.isArray(CONFIG.mfe.tipos[t]), `tipos.${t}`);
  const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;
  const provincias = new Set(zonas.flatMap((z) => [...z.provincias, ...(CONFIG.mfe.vecinas[z.id] ?? [])]));
  for (const p of provincias) assert.match(CONFIG.mfe.zips[p] ?? '', /^MFE50_\d{2}_tcm30-\d+\.zip$/, `falta el ZIP del MFE50 de ${p}`);
  for (const z of zonas) for (const p of CONFIG.mfe.vecinas[z.id] ?? []) assert.ok(!z.provincias.includes(p), `${z.id}: ${p} ya es provincia de la zona`);
  assert.ok(existsSync('scripts/rejilla/mfe-diccionario.json') && existsSync('scripts/rejilla/mfe-muestra.json'));
});

test('el sondeo dejó Open-Meteo, Supabase, pueblos y límites', () => {
  assert.ok(Number.isInteger(CONFIG.openMeteo.trozo) && CONFIG.openMeteo.trozo >= 10);
  assert.ok(Number.isInteger(CONFIG.openMeteo.maxPasados) && CONFIG.openMeteo.maxPasados >= 61);
  assert.ok(Number.isInteger(CONFIG.supabase.lotes) && CONFIG.supabase.lotes >= 1 && CONFIG.supabase.lotes <= 10);
  for (const k of ['nombre', 'url', 'licencia', 'archivo']) assert.ok(lleno(CONFIG.pueblos[k]), `pueblos.${k}`);
  for (const k of ['nombre', 'provincia', 'lat', 'lon']) assert.ok(lleno(CONFIG.pueblos.columnas[k]), `pueblos.columnas.${k}`);
  assert.deepEqual(CONFIG.gruesa.candidatos, [0.09, 0.12, 0.15, 0.18]);
  assert.equal(CONFIG.maxBytesArchivo, 300 * 1024);
});

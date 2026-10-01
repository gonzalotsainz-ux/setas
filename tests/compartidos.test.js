import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as indiceApp from '../js/indice.js';
import * as indiceFuncion from '../supabase/functions/_shared/indice.js';
import * as meteoApp from '../js/meteo.js';
import * as meteoFuncion from '../supabase/functions/_shared/meteo.js';
import * as umbralesApp from '../js/umbrales.js';
import * as umbralesFuncion from '../supabase/functions/_shared/umbrales.js';

test('la app y la función usan el mismo módulo (una sola copia de la fórmula)', () => {
  assert.equal(indiceApp.calcularIndice, indiceFuncion.calcularIndice);
  assert.equal(indiceApp.agregadosDia, indiceFuncion.agregadosDia);
  assert.equal(indiceApp.DatosIncompletos, indiceFuncion.DatosIncompletos);
  assert.equal(meteoApp.parsearPrincipal, meteoFuncion.parsearPrincipal);
  assert.equal(umbralesApp.umbralEfectivo, umbralesFuncion.umbralEfectivo);
});

test('GitHub Pages sirve las carpetas con guion bajo (.nojekyll)', () => assert.ok(existsSync('.nojekyll')));

test('las reexportaciones de js/ son de una línea y apuntan a _shared', () => {
  for (const n of ['indice', 'meteo', 'cache', 'umbrales']) {
    const t = readFileSync(`js/${n}.js`, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
    assert.deepEqual(t, [`export * from '../supabase/functions/_shared/${n}.js';`], n);
  }
});

test('los módulos compartidos no usan el DOM al cargarse (Deno no tiene document)', () => {
  for (const n of ['indice', 'meteo', 'cache', 'umbrales']) {
    assert.doesNotMatch(readFileSync(`supabase/functions/_shared/${n}.js`, 'utf8'), /\bdocument\.|\bwindow\./, n);
  }
});

test('urlPrincipal: por defecto 60 + 10 días; la función puede pedir 2 + 10 con las mismas variables', () => {
  const p = [{ id: 'a', lat: 40.85, lon: -3.99, altitud: 1500 }];
  const def = new URL(meteoApp.urlPrincipal(p)).searchParams;
  const corta = new URL(meteoApp.urlPrincipal(p, { pasados: 2, futuros: 10 })).searchParams;
  assert.equal(def.get('past_days'), '60');
  assert.equal(def.get('forecast_days'), '10');
  assert.equal(corta.get('past_days'), '2');
  assert.equal(corta.get('daily'), def.get('daily'));
  assert.equal(corta.get('hourly'), def.get('hourly'));
});

test('sumarDias y entreDias', () => {
  assert.equal(meteoApp.sumarDias('2026-10-01', -59), '2026-08-03');
  assert.equal(meteoApp.entreDias('2026-08-01', '2026-10-01'), 61);
});

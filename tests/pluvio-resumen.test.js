// tests/pluvio-resumen.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resumenEjecucion, ejecutar } from '../supabase/functions/pluvio/manejador.js';
import { almacenPluvioMemoria } from './dobles-pluvio.js';

test('resumen: por tarea leídas, guardadas, nº de errores y solo los 10 primeros mensajes', () => {
  const errores = Array.from({ length: 14 }, (_, k) => `duero: fallo ${k}`).concat(['tajo10: uno']);
  const r = { estado: 'plazo-agotado', tareas: ['duero', 'tajo10'], filas: { duero: 5 }, leidas: { duero: 8 }, pasos: { x: 1 }, errores };
  const s = resumenEjecucion(r, 1234.6);
  assert.equal(s.estado, 'plazo-agotado');
  assert.deepEqual(s.tareas.duero, { leidas: 8, guardadas: 5, errores: 14, mensajes: errores.slice(0, 10) });
  assert.deepEqual(s.tareas.tajo10, { leidas: 0, guardadas: 0, errores: 1, mensajes: ['tajo10: uno'] });
  assert.equal(s.errores_total, 15);
  assert.equal(s.duracion_ms, 1235);
  assert.deepEqual(s.pasos, { x: 1 });
});

test('resumen: no deja pasar claves de URL y acorta mensajes largos', () => {
  const r = { estado: 'hecho', tareas: ['aemet'], filas: {}, leidas: {}, pasos: {}, errores: ['aemet: GET https://x/y?api_key=SECRETO123&z=1 falló', 'aemet: ' + 'a'.repeat(900)] };
  const s = resumenEjecucion(r, 0);
  assert.ok(!JSON.stringify(s).includes('SECRETO123'));
  assert.ok(s.tareas.aemet.mensajes[1].length <= 300);
});

test('ejecutar anota las filas leídas además de las guardadas', async () => {
  const r = await ejecutar({ almacen: almacenPluvioMemoria(), fetchFn: async () => { throw new Error('sin red'); }, estaciones: [], pedidas: ['tajo10'], esperar: async () => {} });
  assert.ok('leidas' in r);
  assert.equal(resumenEjecucion(r).estado, r.estado);
});

test('index.ts: «sincrono» solo se atiende tras comprobar la clave, y cada ejecución se registra', () => {
  const t = readFileSync(new URL('../supabase/functions/pluvio/index.ts', import.meta.url), 'utf8');
  const iClave = t.indexOf('claveValida(');
  const iSinc = t.indexOf("'sincrono'");
  assert.ok(iClave > 0 && iSinc > iClave);
  assert.match(t.slice(iClave, iSinc), /401/);
  assert.match(t, /console\.log\(JSON\.stringify\(resumen\)\)/);
  assert.match(t, /Response\.json\(await trabajo\)/);
});

test('resumen: los errores de los pasos salen en pasos_errores (limpios, los 10 primeros)', async () => {
  const r = await ejecutar({ almacen: almacenPluvioMemoria(), fetchFn: async () => { throw new Error('sin red'); }, estaciones: [], pedidas: ['publicar'],
    esperar: async () => {}, reloj: () => 0, plazo: 1000 });
  assert.deepEqual(r.errores, ['publicar: sin tiempo para el paso']);
  const s = resumenEjecucion(r);
  assert.deepEqual(s.pasos_errores, { publicar: ['publicar: sin tiempo para el paso'] });
  assert.ok(!('publicar' in s.tareas));
  const muchos = { estado: 'hecho', tareas: ['publicar'], errores: Array.from({ length: 12 }, (_, k) => `publicar: fallo ${k} token=SECRETO`) };
  const m = resumenEjecucion(muchos).pasos_errores.publicar;
  assert.equal(m.length, 10);
  assert.ok(!m.join().includes('SECRETO'));
  assert.deepEqual(resumenEjecucion({ estado: 'hecho', tareas: ['publicar'], errores: [] }).pasos_errores, {});
});

test('index.ts: el error general también pasa por limpiarMensaje', () => {
  const t = readFileSync(new URL('../supabase/functions/pluvio/index.ts', import.meta.url), 'utf8');
  assert.match(t.slice(t.indexOf('.catch(')), /^\.catch\(\(e\) => \{ const m = limpiarMensaje\(/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificarRejilla, decodificarRejilla, leerCabecera, PROHIBIDO, TRAMOS_PENDIENTE } from '../js/rejilla/formato.js';

const fuente = { nombre: 'x', url: 'https://x.es', fecha: '2026-10-01' };
export const cabeceraPrueba = (extra = {}) => ({ version: 1, zona: 'soria', tam: 250, col0: 10, fila0: 20, ancho: 3, alto: 2,
  habitats: ['pinar-silvestre', 'hayedo'], fuentes: { mfe: fuente, mdt: fuente }, generado: '2026-10-01', ...extra });
const planos = () => ({ habitat: Uint8Array.from([1, 0, PROHIBIDO, 2, 1, 0]), terreno: Uint8Array.from([0x11, 0, 0, 0x25, 0x38, 0]),
  altitud: Int16Array.from([1500, 0, 0, 1210, 1185, 0]) });

test('ida y vuelta: cabecera y los tres planos salen idénticos', async () => {
  const bytes = await codificarRejilla(cabeceraPrueba(), planos());
  const r = await decodificarRejilla(bytes);
  assert.deepStrictEqual(r.cabecera, cabeceraPrueba());
  assert.deepStrictEqual(r.habitat, planos().habitat);
  assert.deepStrictEqual(r.terreno, planos().terreno);
  assert.deepStrictEqual(r.altitud, planos().altitud);
  const desdeBuffer = await decodificarRejilla(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.deepStrictEqual(desdeBuffer.altitud, planos().altitud);
});

test('leerCabecera no descomprime y dice dónde empieza la carga', async () => {
  const bytes = await codificarRejilla(cabeceraPrueba(), planos());
  const { cabecera, inicio } = leerCabecera(bytes);
  assert.equal(cabecera.zona, 'soria');
  assert.equal(bytes[inicio], 0x1f);   // primer byte de gzip
});

test('errores: no es una rejilla, versión desconocida, planos de otro tamaño, cabecera incompleta', async () => {
  assert.throws(() => leerCabecera(new TextEncoder().encode('XXXX\u0001\u0000\u0000\u0000\u0000')), /no es una rejilla/);
  const b = await codificarRejilla(cabeceraPrueba(), planos()); b[4] = 9;
  assert.throws(() => leerCabecera(b), /versión de rejilla 9/);
  await assert.rejects(codificarRejilla(cabeceraPrueba({ ancho: 4 }), planos()), /8 celdas/);
  const { fuentes, ...sinFuentes } = cabeceraPrueba();
  await assert.rejects(codificarRejilla(sinFuentes, planos()), /cabecera sin fuentes/);
});

test('una zona vacía de 1000 × 1000 celdas ocupa muy poco', async () => {
  const n = 1e6;
  const bytes = await codificarRejilla(cabeceraPrueba({ ancho: 1000, alto: 1000 }), { habitat: new Uint8Array(n), terreno: new Uint8Array(n), altitud: new Int16Array(n) });
  assert.ok(bytes.length < 12000, `${bytes.length} bytes`);
});

test('los tramos de pendiente llevan espacio duro entre número y unidad', () => {
  assert.equal(TRAMOS_PENDIENTE.length, 4);
  assert.deepEqual(TRAMOS_PENDIENTE, ['menos del 5\u00a0%', 'del 5 al 15\u00a0%', 'del 15 al 30\u00a0%', '30\u00a0% o más']);
});

test('archivos rotos: cabecera cortada o ilegible, cabecera inválida, carga cortada, byte alterado y código de hábitat inválido', async () => {
  const bytes = await codificarRejilla(cabeceraPrueba(), planos());
  const { inicio } = leerCabecera(bytes);
  assert.throws(() => leerCabecera(bytes.slice(0, 20)), /rejilla dañada: cabecera incompleta/);
  const ilegible = bytes.slice(); ilegible[9] = 0x7b; ilegible[10] = 0x7b;
  assert.throws(() => leerCabecera(ilegible), /rejilla dañada: cabecera ilegible/);
  await assert.rejects(codificarRejilla(cabeceraPrueba({ ancho: 0, alto: 0 }), { habitat: new Uint8Array(0), terreno: new Uint8Array(0), altitud: new Int16Array(0) }).then(decodificarRejilla), /rejilla dañada: cabecera con ancho/);
  await assert.rejects(decodificarRejilla(bytes.slice(0, bytes.length - 5)), /rejilla dañada: carga ilegible o incompleta/);
  const alterado = bytes.slice(); alterado[inicio + 12] ^= 0xff;
  await assert.rejects(decodificarRejilla(alterado), /rejilla dañada/);
  const p = planos(); p.habitat[0] = 7;
  await assert.rejects(decodificarRejilla(await codificarRejilla(cabeceraPrueba(), p)), /código de hábitat 7 fuera de la cabecera/);
  const q = planos(); q.habitat[0] = 0x21;
  await assert.rejects(decodificarRejilla(await codificarRejilla(cabeceraPrueba(), q)), /código de hábitat 33 fuera de la cabecera/);
});

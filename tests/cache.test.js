import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leer, guardar, borrarPrefijo } from '../js/cache.js';

function almacenFalso() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
}

test('guarda y lee con hora', () => {
  const a = almacenFalso();
  assert.equal(guardar('x', { n: 1 }, '2026-10-01T10:00:00Z', a), true);
  assert.deepEqual(leer('x', a), { datos: { n: 1 }, hora: '2026-10-01T10:00:00Z' });
});

test('almacén que lanza (Safari privado, cuota llena) → no rompe', () => {
  const malo = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('QuotaExceededError'); } };
  assert.equal(leer('x', malo), null);
  assert.equal(guardar('x', 1, undefined, malo), false);
  assert.doesNotThrow(() => borrarPrefijo('clim:', 'clim:hoy', malo));
});

test('sin almacén (null) → null y guardar false', () => { assert.equal(leer('x', null), null); assert.equal(guardar('x', 1, undefined, null), false); });

test('borrarPrefijo conserva la excepción', () => {
  const a = almacenFalso();
  guardar('clim:2026-08-01', 1, undefined, a); guardar('clim:2026-08-02', 2, undefined, a); guardar('meteo', 3, undefined, a);
  borrarPrefijo('clim:', 'clim:2026-08-02', a);
  assert.equal(leer('clim:2026-08-01', a), null);
  assert.ok(leer('clim:2026-08-02', a));
  assert.ok(leer('meteo', a));
});

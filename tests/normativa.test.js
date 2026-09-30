import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisarVigencia, permisoTexto, anioTexto, precioTexto } from '../js/ui/normativa.js';

test('revisión de más de 12 meses pide revisar la vigencia', () => {
  assert.equal(revisarVigencia({ revisado: '2025-09-30' }, '2026-09-30'), false);
  assert.equal(revisarVigencia({ revisado: '2025-09-29' }, '2026-09-30'), true);
  assert.equal(revisarVigencia({ revisado: '2026-01-01' }, '2026-09-30'), false);
  assert.equal(revisarVigencia({}, '2026-09-30'), true);
});
test('permiso: sí, no o sin confirmar; tarifa sin año lo dice', () => {
  assert.equal(permisoTexto({ permiso: { obligatorio: true } }), 'Hace falta permiso');
  assert.equal(permisoTexto({ permiso: { obligatorio: false } }), 'No hace falta permiso');
  assert.equal(permisoTexto({ permiso: null }), 'Permiso: sin confirmar');
  assert.equal(anioTexto({ anio: null }), 'año de vigencia no publicado');
  assert.equal(anioTexto({ anio: 2016 }), 'tarifa de 2016');
  assert.equal(precioTexto({ precio: 7.5 }), '7,5 €');
});

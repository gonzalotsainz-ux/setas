import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisarVigencia, permisoTexto, anioTexto, precioTexto, tarifaTexto, cupoTexto, urlSegura } from '../js/ui/normativa.js';

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

test('fila de tarifa: nada de «null» y dice lo que no se publica', () => {
  assert.equal(tarifaTexto({ precio: 10, cupoKgDia: 5, anio: 2016, verificado: true }), '10 € · hasta 5 kg/día · tarifa de 2016');
  const sinCupo = tarifaTexto({ precio: 40, cupoKgDia: null, anio: 2024, verificado: true });
  assert.match(sinCupo, /cupo no indicado/);
  assert.doesNotMatch(sinCupo, /null/);
  assert.match(tarifaTexto({ precio: null, cupoKgDia: 5, anio: 2024 }), /^precio no publicado/);
  assert.match(tarifaTexto({ precio: 5, cupoKgDia: 5, anio: null }), /año de vigencia no publicado/);
  assert.match(tarifaTexto({ precio: 5, cupoKgDia: 5, anio: 2020, verificado: false }), /Sin confirmar$/);
  assert.equal(cupoTexto({}), 'cupo no indicado');
  assert.equal(precioTexto({}), 'precio no publicado');
});
test('solo se enlazan URLs http(s)', () => {
  assert.equal(urlSegura('https://boe.es/x'), true);
  assert.equal(urlSegura('javascript:alert(1)'), false);
  assert.equal(urlSegura(null), false);
});

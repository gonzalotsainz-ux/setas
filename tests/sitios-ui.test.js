import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoMeses, sitiosDeZona, fuentesTexto, urlSegura, LEGAL } from '../js/ui/sitios.js';

test('rangoMeses agrupa tramos seguidos', () => {
  assert.equal(rangoMeses([9, 10, 11]), 'septiembre a noviembre');
  assert.equal(rangoMeses([1, 2, 3, 4, 5, 9, 10, 11]), 'enero a mayo y septiembre a noviembre');
  assert.equal(rangoMeses([5]), 'mayo');
  assert.equal(rangoMeses([]), '');
});
test('sitiosDeZona filtra por zona y tolera sitios sin cargar', () => {
  assert.deepEqual(sitiosDeZona('soria', [{ zona: 'soria', id: 'a' }, { zona: 'cuenca', id: 'b' }]).map((s) => s.id), ['a']);
  assert.deepEqual(sitiosDeZona('soria', null), []);
});
test('la confianza se dice con palabras claras', () => {
  assert.equal(fuentesTexto(3), '3 fuentes');
  assert.equal(fuentesTexto(1), 'Una sola fuente');
});
test('solo se enlazan URLs http(s) y todos los estados legales tienen rótulo', () => {
  assert.ok(urlSegura('https://x.es')); assert.ok(!urlSegura('javascript:alert(1)')); assert.ok(!urlSegura(null));
  for (const e of ['permiso', 'libre', 'prohibido', 'privado', 'sin-confirmar']) assert.ok(LEGAL[e].texto, e);
});

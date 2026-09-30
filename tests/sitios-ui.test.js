import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoMeses, sitiosDeZona, fuentesTexto, urlSegura, LEGAL, AVISO_FUERA_ZONA, seccionDondeBuscar } from '../js/ui/sitios.js';

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

// DOM mínimo: solo lo que usa js/ui/dom.js para pintar la sección.
const nodo = (tag) => ({ tag, hijos: [], attrs: {}, className: '', textContent: '',
  setAttribute(k, v) { this.attrs[k] = v; }, append(...h) { this.hijos.push(...h); } });
const textos = (n) => (typeof n === 'string' ? [n] : [n.textContent, ...n.hijos.flatMap(textos)]);
test('los sitios fuera del bbox de su zona avisan de que el índice es orientativo', () => {
  globalThis.document = { createElement: nodo };
  try {
    assert.equal(AVISO_FUERA_ZONA, 'El índice de la zona se calcula lejos de aquí: tómalo como orientativo.');
    const s = (id, extra = {}) => ({ id, zona: 'soria', nombre: id, municipio: 'X (Soria)', tipo: 'sitio', especies: [], epoca: [], consejo: 'c',
      legal: { estado: 'libre', normas: [], texto: 'l' }, fuentes: [{ url: 'https://x.es', consultado: '2026-09-30' }], nFuentes: 1, confianza: 'baja', ...extra });
    const pinta = (sitio) => textos(seccionDondeBuscar({ id: 'soria' }, { sitios: [sitio], normativa: [], porId: {} }));
    assert.ok(pinta(s('lejos', { fueraDeZonaMeteo: true })).includes(AVISO_FUERA_ZONA));
    assert.ok(!pinta(s('cerca')).includes(AVISO_FUERA_ZONA));
    assert.ok(!pinta(s('falso', { fueraDeZonaMeteo: false })).includes(AVISO_FUERA_ZONA));
  } finally { delete globalThis.document; }
});

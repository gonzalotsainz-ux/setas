import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estiloCoto, estiloHalo, radioLluvia, notaPunto, COLOR, ESTILO_COTO } from '../js/mapa.js';
import { serieSintetica, lluviaBuena } from './ayudas.js';

test('estiloCoto: color fijo por tipo y trazo según la precisión', () => {
  assert.equal(estiloCoto({ tipo: 'prohibido', precision: 'oficial' }).color, COLOR.peligro);
  assert.equal(estiloCoto({ tipo: 'prohibido', precision: 'oficial' }).dashArray, undefined);
  assert.equal(estiloCoto({ tipo: 'acotado', precision: 'derivado' }).dashArray, '6 4');
  assert.equal(estiloCoto({ tipo: 'acotado', precision: 'aproximado' }).dashArray, '2 6');
  assert.equal(estiloCoto({ tipo: 'desconocido', precision: 'oficial' }).color, ESTILO_COTO.regulado.color);
  assert.doesNotMatch(estiloCoto({ tipo: 'acotado', precision: 'oficial' }).color, /var\(/);
});

test('estiloHalo: blanco, más ancho que el trazo, sin relleno ni punteado', () => {
  const h = estiloHalo({ tipo: 'acotado', precision: 'derivado' });
  assert.equal(h.color, '#ffffff');
  assert.equal(h.weight, ESTILO_COTO.acotado.weight + 3);
  assert.equal(h.fill, false);
  assert.equal(h.dashArray, undefined);
});

test('radioLluvia: siempre fuera del marcador de 9 px y creciente', () => {
  assert.ok(radioLluvia(0) > 9);
  assert.equal(radioLluvia(100), 37);
  assert.ok(radioLluvia(50) > radioLluvia(10));
});

test('notaPunto: sin serie no hay nota; con serie, nota y lluvia de 26 días', () => {
  const zona = { id: 'z', habitats: ['pinar'] };
  const punto = { id: 'p' };
  const datos = { especies: [], porId: {} };
  assert.deepEqual(notaPunto(zona, punto, datos, null, {}), { valor: null, mejor: null, mm: null });
  assert.deepEqual(notaPunto(zona, punto, datos, { series: {} }, {}), { valor: null, mejor: null, mm: null });
  const serie = serieSintetica({ precip: lluviaBuena });
  const r = notaPunto(zona, punto, datos, { series: { p: serie } }, {});
  assert.equal(r.mm, 106);
  assert.equal(r.valor, null);   // sin especies no hay nota
});

test('notaPunto: si falta un día de lluvia, mm es null', () => {
  const serie = serieSintetica();
  serie.precip[50] = null;
  const r = notaPunto({ id: 'z', habitats: [] }, { id: 'p' }, { especies: [], porId: {} }, { series: { p: serie } }, {});
  assert.equal(r.mm, null);
});


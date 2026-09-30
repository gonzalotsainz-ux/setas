import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { especies, sindromes } = JSON.parse(readFileSync('data/especies.json', 'utf8'));
const porId = Object.fromEntries(especies.map((e) => [e.id, e]));

test('hay al menos 38 comestibles y 20 tóxicas o mortales', () => {
  assert.ok(especies.filter((e) => e.categoria.startsWith('comestible')).length >= 38);
  assert.ok(especies.filter((e) => ['toxica', 'mortal'].includes(e.categoria)).length >= 20);
});
test('ninguna especie de la Parte D del RD 30/2009 es comestible', () => {
  for (const e of especies) if (e.rd30_2009 === 'D') assert.ok(!e.categoria.startsWith('comestible'), e.id);
});
// La investigación declara explícitamente «ninguna peligrosa» / «inconfundible» en 4 fichas (sinConfusiones) y
// en otras solo cita confusiones sin ficha propia (confusionesMenores): nunca se inventa una confusión.
test('toda comestible documenta sus confusiones (o declara que no hay)', () => {
  for (const e of especies) if (e.categoria === 'comestible') {
    const n = e.confusiones.length + (e.confusionesMenores?.length ?? 0);
    assert.ok(n >= 1 || e.sinConfusiones, e.id);
  }
});
test('las amanitas mortales blancas existen y tienen síndrome faloidiano', () => {
  for (const id of ['amanita-phalloides', 'amanita-verna', 'amanita-virosa', 'amanita-vidua']) {
    assert.equal(porId[id]?.categoria, 'mortal', id);
    assert.equal(porId[id].sindrome, 'faloidiano', id);
  }
  assert.ok(sindromes.some((s) => s.id === 'faloidiano'));
});
test('solo comestibles llevan índice y ninguna precaución lo lleva', () => {
  for (const e of especies) if (e.indice) assert.equal(e.categoria, 'comestible', e.id);
});
test('Morchella avisa de que cruda es tóxica', () => {
  assert.match(porId['morchella'].precauciones.join(' '), /crud/i);
});

// --- comprobaciones añadidas (seguridad) ---
test('comestible-precaucion lleva el aviso en precauciones[0] y no tiene índice', () => {
  for (const id of ['neoboletus-erythropus', 'amanita-ponderosa']) {
    assert.equal(porId[id].categoria, 'comestible-precaucion', id);
    assert.ok(porId[id].precauciones[0], id);
    assert.equal(porId[id].indice, null, id);
  }
  assert.match(porId['amanita-ponderosa'].precauciones[0], /NO recomendar/);
});
test('las no recomendadas llevan el motivo en precauciones[0]', () => {
  for (const e of especies) if (e.categoria === 'no-recomendada') assert.ok(e.precauciones[0], e.id);
});
test('Tuber no lleva índice y explica por qué', () => {
  assert.equal(porId['tuber-melanosporum'].indice, null);
  assert.match(porId['tuber-melanosporum'].sinIndice, /hipogeo/i);
});
test('las tóxicas y mortales citadas por el encargo tienen ficha', () => {
  const ids = ['amanita-phalloides', 'amanita-verna', 'amanita-virosa', 'amanita-vidua', 'amanita-proxima', 'amanita-pantherina',
    'amanita-muscaria', 'cortinarius-orellanus', 'cortinarius-rubellus', 'galerina-marginata', 'lepiota-brunneoincarnata',
    'gyromitra-esculenta', 'entoloma-sinuatum', 'omphalotus-olearius', 'rubroboletus-satanas', 'tylopilus-felleus',
    'hypholoma-fasciculare', 'tricholoma-equestre', 'tricholoma-pardinum', 'clitocybe-nebularis', 'inosperma-erubescens',
    'paxillus-involutus'];
  for (const id of ids) assert.ok(porId[id], id);
});
test('todo lo que el informe marca NO VERIFICADO en altitud sigue marcado', () => {
  for (const id of ['boletus-edulis', 'boletus-pinophilus', 'boletus-aereus', 'amanita-caesarea']) assert.equal(porId[id].altitud.verificado, false, id);
});
test('los índices heurísticos por análogo son de confianza baja y citan su análogo', () => {
  for (const e of especies) if (e.indice?.analogo) {
    assert.equal(e.indice.confianza, 'baja', e.id);
    assert.equal(e.indice.base, 'heuristica', e.id);
    assert.ok(porId[e.indice.analogo]?.indice, `${e.id}: análogo ${e.indice.analogo}`);
  }
});

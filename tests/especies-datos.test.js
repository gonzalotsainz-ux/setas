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

// --- ronda de correcciones 1 ---
const NIVEL = ['bajo', 'medio', 'alto', 'mortal'];
const GRAV = { mortal: 'mortal', grave: 'alto', moderada: 'medio', leve: 'bajo' };
const nivel = (e) => NIVEL.indexOf(e.sindrome ? GRAV[sindromes.find((s) => s.id === e.sindrome).gravedad]
  : ['toxica', 'no-recomendada'].includes(e.categoria) ? 'medio' : e.categoria === 'mortal' ? 'mortal' : 'bajo');
test('el riesgo de cada confusión con ficha con síndrome sigue la gravedad del síndrome (el peor de los dos)', () => {
  let n = 0;
  for (const e of especies) for (const c of e.confusiones) {
    const t = porId[c.especie];
    if (!t.sindrome) continue;
    n++;
    assert.equal(c.riesgo, NIVEL[Math.max(nivel(e), nivel(t))], `${e.id} -> ${c.especie}`);
    assert.ok(NIVEL.indexOf(c.riesgo) >= NIVEL.indexOf(GRAV[sindromes.find((s) => s.id === t.sindrome).gravedad]), `${e.id} -> ${c.especie}`);
  }
  assert.ok(n > 20);
});
test('la senderuela y la platera frente a Clitocybe muscarínica son riesgo alto, no medio', () => {
  for (const id of ['marasmius-oreades', 'infundibulicybe-geotropa', 'pleurotus-eryngii'])
    assert.ok(porId[id].confusiones.filter((c) => c.especie.startsWith('clitocybe')).every((c) => c.riesgo === 'alto'), id);
});
test('los cortinarios naranjas y su síndrome son mortales (sección C del informe)', () => {
  for (const id of ['cortinarius-orellanus', 'cortinarius-rubellus']) assert.equal(porId[id].categoria, 'mortal', id);
  assert.equal(sindromes.find((s) => s.id === 'orellanico').gravedad, 'mortal');
});
test('galerina cubre los 12 meses e Inosperma incluye prado', () => {
  assert.equal(porId['galerina-marginata'].temporada.meses.length, 12);
  assert.ok(porId['inosperma-erubescens'].habitats.includes('prado'));
});
test('precauciones no lleva descripciones de hábitat', () => {
  for (const e of especies) for (const p of e.precauciones) assert.doesNotMatch(p, /^(Crece|Sale|Coníferas|Frondosas|Tocones|Pinares)\b/, `${e.id}: ${p}`);
});

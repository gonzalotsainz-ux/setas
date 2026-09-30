import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
const { sitios } = leer('data/sitios.json');
const { especies } = leer('data/especies.json');
const { zonas } = leer('data/zonas.json');
const porId = Object.fromEntries(sitios.map((s) => [s.id, s]));

test('todas las zonas tienen sitios y nunca se inventan coordenadas', () => {
  for (const z of zonas) assert.ok(sitios.some((s) => s.zona === z.id), `zona sin sitios: ${z.id}`);
  // Ninguna fuente de la investigación da coordenadas de setales: todas son null.
  for (const s of sitios) assert.ok(s.lat === null && s.lon === null, s.id);
});

test('lo prohibido por la investigación es «no-ir» y cita su norma', () => {
  for (const id of ['siete-picos-valsain', 'penalara-cotos-lagunas', 'reservas-paular-purgatorio', 'hayedo-de-montejo']) {
    assert.equal(porId[id]?.tipo, 'no-ir', id);
    assert.equal(porId[id].legal.estado, 'prohibido', id);
    assert.ok(porId[id].legal.normas.length >= 1, id);
  }
  assert.equal(porId['hayedo-de-montejo'].zona, 'sierra-norte');
  assert.equal(porId['cabaneros-parque-nacional'].tipo, 'no-ir');
  assert.notEqual(porId['cabaneros-parque-nacional'].legal.estado, 'libre');
  assert.equal(porId['quinto-de-la-mata'].legal.estado, 'privado');
});

test('ningún sitio recomendable está en zona reservada del Parque Nacional ni en Montejo', () => {
  for (const s of sitios.filter((x) => x.tipo !== 'no-ir')) {
    assert.ok(!/Siete Picos|Peñalara|Hayedo de Montejo/i.test(s.nombre), s.id);
    assert.ok(!['prohibido', 'privado'].includes(s.legal.estado), s.id);
  }
});

test('cuando un blog contradice la norma, manda la norma y la contradicción va en notas', () => {
  const s = porId['puerto-navafria-camino-horizontal'];
  assert.equal(s.legal.estado, 'permiso');
  assert.ok(s.legal.normas.includes('madrid-lozoya'));
  assert.match(s.notas, /CONTRADICCIÓN/);
});

test('los datos oficiales útiles están: parte de Micocyl y La Quesera', () => {
  assert.match(porId['guadarrama-segoviano-micocyl-2024'].consejo, /3 kg por hora/);
  assert.ok(porId['guadarrama-segoviano-micocyl-2024'].fuentes.some((f) => f.url.includes('parte_mico_20241028')));
  assert.match(porId['la-quesera-pedrosa'].consejo, /5\/11\/2023/);
});

test('los trucos con cifras van marcados como orientativos (04d se leyó con resúmenes automáticos)', () => {
  let con = 0;
  for (const e of especies) for (const t of e.trucos ?? []) {
    if (/\d/.test(t.texto.replace(/\b(19|20)\d{2}\b/g, ''))) { con++; assert.equal(t.cifrasOrientativas, true, `${e.id}: ${t.texto}`); }
  }
  assert.ok(con > 10);
});

test('solo comestibles llevan trucos y las creencias van rotuladas como tales', () => {
  const conTrucos = especies.filter((e) => e.trucos?.length);
  assert.ok(conTrucos.length >= 20);
  for (const e of conTrucos) assert.equal(e.categoria, 'comestible', e.id);
  const creencias = conTrucos.flatMap((e) => e.trucos.filter((t) => t.tipo === 'creencia'));
  assert.ok(creencias.length >= 2);
  for (const t of creencias) assert.equal(t.confianza, 'baja');
});

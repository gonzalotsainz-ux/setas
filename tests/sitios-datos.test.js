import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
const { sitios } = leer('data/sitios.json');
const { especies } = leer('data/especies.json');
const { zonas } = leer('data/zonas.json');
const cotos = leer('data/cotos.geojson');
const porId = Object.fromEntries(sitios.map((s) => [s.id, s]));

test('todas las zonas tienen sitios y las coordenadas solo salen de una fuente que las da', () => {
  for (const z of zonas) assert.ok(sitios.some((s) => s.zona === z.id), `zona sin sitios: ${z.id}`);
  // Ninguna fuente micológica da coordenadas de setales. Solo hay coordenadas en los 11 aparcamientos oficiales del coto
  // La Engaña (web del coto, ETRS89 UTM 30 convertido a WGS84) y en la entrada de Berzocana, cuya fuente las da; cada una lo dice en `notas`.
  const con = sitios.filter((s) => s.lat !== null || s.lon !== null);
  for (const s of con) {
    assert.ok(/^merindades-engana-/.test(s.id) || s.id === 'extremadura-berzocana-dehesa', s.id);
    assert.equal(typeof s.lat, 'number', s.id); assert.equal(typeof s.lon, 'number', s.id);
    assert.match(s.notas, /Coordenadas de la fuente/, s.id);
  }
  assert.equal(con.length, 12);
  assert.equal(con.filter((s) => /^merindades-engana-/.test(s.id)).length, 11);
});

test('segunda pasada: sitios nuevos con fuente, zona por provincia y NO IR donde toca', () => {
  assert.ok(sitios.length >= 170, String(sitios.length));
  for (const id of ['el-negredo-segovia', 'hoyocasero-pinar-mup-43', 'guadalajara-orea-ordenanza', 'soria-moncayo-soriano', 'burgos-neila-lagunas', 'extremadura-tentudia', 'alava-kuartango-perretxiko']) assert.ok(porId[id], id);
  assert.equal(porId['la-barranca-fuenfria-cotos-no-ir'].tipo, 'no-ir');
  assert.equal(porId['la-barranca-fuenfria-cotos-no-ir'].legal.estado, 'prohibido');
  // Las dehesas privadas y los montes dentro de espacios protegidos no se recomiendan
  assert.equal(porId['extremadura-criadillas-dehesas'].tipo, 'no-ir');
  assert.equal(porId['extremadura-criadillas-dehesas'].legal.estado, 'privado');
  for (const id of ['extremadura-monte-valcorchero', 'extremadura-monte-castanar-gallego', 'extremadura-monte-baldio-de-la-umbria']) assert.equal(porId[id].tipo, 'no-ir', id);
  // Honrubia de la Cuesta es de Segovia (el informe lo situaba en Cuenca)
  assert.equal(porId['honrubia-de-la-cuesta-mup-279-280'].zona, 'sierra-norte');
  assert.match(porId['honrubia-de-la-cuesta-mup-279-280'].municipio, /Segovia/);
  // Los montes públicos de Extremadura solo dan hábitat: ninguna fuente micológica les asigna especies
  for (const s of sitios.filter((x) => /^extremadura-monte-/.test(x.id))) assert.deepEqual(s.especies, [], s.id);
});

test('Monfragüe: prohibido salvo autorización del Parque, con la única excepción del PRUG', () => {
  const frase = /^Prohibido salvo autorización del Parque; el PRUG solo prevé setas sin fines comerciales en el monte Dehesa Boyal y Cuarto de los Arroyos \(Serradilla\)/;
  const s = porId['extremadura-monfrague'];
  assert.equal(s.legal.estado, 'prohibido');
  assert.match(s.legal.texto, frase);
  const f = cotos.features.find((x) => x.properties.id === 'ex-monfrague-parque-nacional');
  assert.equal(f.properties.tipo, 'prohibido');
  assert.match(f.properties.nota, frase);
});

test('Mirabel: el número de MUP se deduce por nombre y municipio y el polígono no da el régimen por confirmado', () => {
  const f = cotos.features.find((x) => x.properties.id === 'ex-mirabel-mup-132');
  assert.equal(f.properties.regimenConfirmado, false);
  assert.match(f.properties.nota, /se deduce por nombre y municipio/);
  assert.match(porId['extremadura-mirabel-dehesa-boyal'].notas, /nombre y término/);
});

test('trucos de la segunda pasada: alta solo con varias fuentes, avisos de confusión y creencias rotuladas', () => {
  const t = (id) => especies.find((e) => e.id === id).trucos;
  // Hygrophorus latitabundus: antes sin trucos; ahora pinar calizo y época con 4 fuentes
  const lat = t('hygrophorus-latitabundus');
  assert.ok(lat.length >= 4);
  assert.ok(lat.filter((x) => x.confianza === 'alta').every((x) => x.fuentes.length >= 3));
  // Marzuelo: la secuencia de altitud está confirmada; «solana antes que umbría» sigue como una sola fuente y baja
  const mz = t('hygrophorus-marzuolus');
  assert.equal(mz.find((x) => x.texto.startsWith('La altitud sube con la temporada')).confianza, 'alta');
  assert.equal(mz.find((x) => x.texto.startsWith('Una sola fuente (Cesta y Setas, 2025)')).confianza, 'baja');
  // Perretxiko: «corro de hierba quemada» baja y anotada como señal de la senderuela
  const pg = t('calocybe-gambosa').find((x) => /hierba quemada/.test(x.texto));
  assert.equal(pg.confianza, 'baja'); assert.match(pg.texto, /senderuela/);
  // Negrilla: Micocyl la desaconseja; capuchina y pie azul llevan su aviso de confusión
  assert.match(t('tricholoma-terreum')[0].texto, /Micocyl desaconseja/);
  assert.ok(t('tricholoma-portentosum').some((x) => /phalloides/.test(x.texto)));
  assert.ok(t('collybia-nuda').some((x) => /Cortinarius/.test(x.texto)));
  assert.ok(t('morchella').some((x) => /Gyromitra/.test(x.texto) && x.tipo === 'creencia'));
  assert.ok(t('agaricus-campestris').some((x) => /xanthodermus/.test(x.texto)));
  assert.ok(t('infundibulicybe-geotropa').some((x) => /rivulosa/.test(x.texto)));
  // Oronja: unas tres semanas (18 a 22 días) con rango ancho
  assert.match(t('amanita-caesarea').find((x) => /tres semanas/.test(x.texto)).texto, /50 días/);
  // Toda fuente de un truco lleva url y consultado
  for (const e of especies) for (const x of e.trucos ?? []) for (const f of x.fuentes) { assert.match(f.url, /^https?:\/\//); assert.match(f.consultado, /^\d{4}-\d{2}-\d{2}$/); }
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

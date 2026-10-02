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
  for (const id of ['extremadura-monte-valcorchero', 'extremadura-monte-castanar-gallego', 'extremadura-monte-baldio-de-la-umbria', 'hoyocasero-pinar-mup-43']) {
    assert.equal(porId[id].tipo, 'no-ir', id);
    assert.equal(porId[id].legal.estado, 'sin-confirmar', id);
    assert.match(porId[id].legal.texto, /^Espacio protegido/, id);
  }
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
  assert.equal(f.properties.nota.match(/se deduce/g).length, 1, 'la frase no se repite');
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
  // Capuchina y pie azul llevan su aviso de confusión (la negrilla ya no lleva trucos: ver su prueba)
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

test('negrilla: Micocyl la desaconseja (rabdomiólisis); sin índice ni trucos, y el aviso va en el banner', () => {
  const n = especies.find((e) => e.id === 'tricholoma-terreum');
  assert.equal(n.categoria, 'comestible-precaucion');
  assert.equal(n.indice, null);
  assert.equal(n.trucos, undefined);
  const p0 = n.precauciones[0];
  assert.match(p0, /Micocyl desaconseja/);
  assert.ok(p0.includes('https://www.micocyl.es/noticias/puente-de-setas'));
  assert.ok(p0.includes('02/12/2022'));
  assert.match(p0, /rabdomiólisis/);
  assert.ok(p0.includes('RD 30/2009 (Parte A) todavía permite comercializarla'));
  assert.ok(!n.precauciones.some((p) => /NO VERIFICADO/.test(p)));
  // Ningún sitio la propone
  for (const s of sitios) assert.ok(!(s.especies ?? []).includes('tricholoma-terreum'), s.id);
});

test('sitios fuera del bbox de su zona: marcados con fueraDeZonaMeteo', () => {
  const bbox = Object.fromEntries(zonas.map((z) => [z.id, z.bbox]));
  const dentro = (s) => { const [x0, y0, x1, y1] = bbox[s.zona]; return s.lon >= x0 && s.lon <= x1 && s.lat >= y0 && s.lat <= y1; };
  // Los 12 puntos con coordenadas caen dentro del bbox de su zona o llevan la marca
  const con = sitios.filter((s) => s.lat != null);
  assert.equal(con.length, 12);
  for (const s of con) assert.ok(dentro(s) || s.fueraDeZonaMeteo === true, s.id);
  // Todo sitio cuyas notas dicen que queda fuera del bbox (o en el de otra zona) lleva la marca
  for (const s of sitios.filter((x) => /fuera del bbox|al este del bbox|cae (geográficamente )?en el bbox de (?!su)/.test(x.notas ?? ''))) assert.equal(s.fueraDeZonaMeteo, true, s.id);
  for (const id of ['soria-moncayo-soriano', 'cuenca-landete-niscalo-boletus', 'cuenca-moya-niscalo-boletus', 'cuenca-talayuelas-niscalo-boletus',
    'solana-de-avila-hoya-rana', 'bohoyo-ruta-micologica', 'las-navas-del-marques-amagredos', 'honrubia-de-la-cuesta-mup-279-280']) assert.equal(porId[id].fueraDeZonaMeteo, true, id);
  // La marca es booleana y solo se pone a true
  for (const s of sitios) assert.ok(s.fueraDeZonaMeteo === undefined || s.fueraDeZonaMeteo === true, s.id);
});

test('ronda 1: avisos de confusión en colmenilla, carbonera y perretxiko; Alustante sin «ante la duda»', () => {
  const t = (id) => especies.find((e) => e.id === id).trucos;
  const mor = t('morchella').filter((x) => /quemad|ribera/i.test(x.texto) && x.tipo !== 'creencia');
  assert.ok(mor.length >= 4);
  for (const x of mor) assert.match(x.texto, /No confundir con Gyromitra; nunca cruda./, x.texto);
  assert.ok(t('russula-cyanoxantha').some((x) => /Amanita phalloides/.test(x.texto) && /volva/.test(x.texto) && /anillo/.test(x.texto)));
  const cg = t('calocybe-gambosa').find((x) => /setas tóxicas muy parecidas/.test(x.texto));
  assert.match(cg.texto, /Entoloma sinuatum/); assert.match(cg.texto, /Inocybe erubescens/);
  assert.equal(t('hygrophorus-latitabundus').find((x) => x.tipo === 'microhabitat').cifrasOrientativas, true);
  const n = leer('data/normativa.json').normas.find((x) => x.id === 'guadalajara-alustante-2017');
  assert.equal(n.cupoKgDia, 10);
  assert.ok(!/ante la duda/i.test(n.notas));
  assert.ok(!/si dudas, no pases de 5 kg/.test(porId['guadalajara-alustante-ordenanza'].legal.texto));
});

test('fase 1 de Madrid: los montes públicos fuera del Parque sin ordenanza siguen NO IR hasta que se confirme el PORN', () => {
  const pendiente = /Decreto 96\/2009, ap\. 4\.4\.2\.6\) podría autorizar la recogida libre de setas para uso individual .*pendiente de confirmación oficial/;
  // Decisión de la usuaria (02/10/2026): no cambia su estado; solo se añade la nota del PORN
  for (const id of ['pn-monte-sin-plan', 'la-barranca-fuenfria-cotos-no-ir', 'guadarrama-mup-39-pinar', 'cercedilla-mup-32-fuera-parque', 'alameda-pinilla-fuera-parque']) {
    assert.equal(porId[id].tipo, 'no-ir', id);
    assert.equal(porId[id].legal.estado, 'prohibido', id);
    assert.match(porId[id].legal.texto, pendiente, id);
    assert.match(porId[id].legal.texto, /se mantiene la prohibición/, id);
    assert.ok(porId[id].legal.normas.includes('madrid-porn-guadarrama-96-2009'), id);
    assert.deepEqual(porId[id].especies, [], id);
  }
  assert.equal(porId['sierra-norte-pueblos-sin-ordenanza'].legal.estado, 'sin-confirmar');
  assert.match(porId['sierra-norte-pueblos-sin-ordenanza'].legal.texto, pendiente);
  // Ningún sitio que cite el PORN se presenta como libre o con permiso
  for (const s of sitios.filter((x) => x.legal.normas.includes('madrid-porn-guadarrama-96-2009'))) assert.ok(['prohibido', 'sin-confirmar'].includes(s.legal.estado), s.id);
  // Braojos: ordenanza registrada como pendiente de la resolución de acotamiento
  const braojos = leer('data/normativa.json').normas.find((n) => n.id === 'madrid-braojos');
  assert.equal(braojos.vigente, false);
  assert.match(braojos.resumen[0], /^PENDIENTE DE RESOLUCIÓN DE ACOTAMIENTO/);
  const porn = leer('data/normativa.json').normas.find((n) => n.id === 'madrid-porn-guadarrama-96-2009');
  assert.equal(porn.verificado, false);
  assert.match(porn.resumen[0], /^PENDIENTE DE CONFIRMACIÓN OFICIAL/);
});

test('fase 1 de Madrid: sitios nuevos con su número de fuentes y la Dehesa de Somosierra a 3 fuentes', () => {
  const esperado = { 'abantos-mup-46-pinar': 3, 'santa-maria-alameda-pinares': 2, 'navahonda-robledo-de-chavela': 2, 'san-martin-valdeiglesias-pinares': 2,
    'valdemaqueda-mup-185': 1, 'herreria-patrimonio-nacional-no-ir': 1, 'guadarrama-mup-39-pinar': 2, 'cercedilla-mup-32-fuera-parque': 3, 'alameda-pinilla-fuera-parque': 1,
    'montejo-mup-202-91-fuera-hayedo': 2, 'pradena-la-morra-mup-155': 2, 'hiruela-dehesa-boyal-mup-79': 1, 'somosierra-dehesa': 3, 'lozoya-coto-micologico': 3 };
  for (const [id, n] of Object.entries(esperado)) {
    assert.equal(porId[id]?.nFuentes, n, id);
    assert.equal(porId[id].confianza, n >= 3 ? 'alta' : n === 2 ? 'media' : 'baja', id);
  }
  for (const id of ['abantos-mup-46-pinar', 'santa-maria-alameda-pinares', 'navahonda-robledo-de-chavela', 'san-martin-valdeiglesias-pinares', 'valdemaqueda-mup-185', 'herreria-patrimonio-nacional-no-ir']) assert.equal(porId[id].zona, 'sierra-oeste', id);
  assert.equal(porId['herreria-patrimonio-nacional-no-ir'].tipo, 'no-ir');
  // Valdemaqueda: las observaciones de níscalo caen en Ávila, así que no se listan especies
  assert.deepEqual(porId['valdemaqueda-mup-185'].especies, []);
  // El níscalo cuenta ya el pinar piñonero, con el parte de Micocyl de 20/11/2024
  const niscalo = especies.find((e) => e.id === 'lactarius-deliciosus');
  assert.ok(niscalo.habitats.includes('pinar-pinonero'));
  assert.ok(niscalo.fuentes.some((f) => f.url.endsWith('parte_mico_20241121.pdf') && f.consultado === '2026-10-02'));
});

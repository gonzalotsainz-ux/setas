// tests/mapa-controles.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chipsDelDia, chipVigente, barraDias, buscarEnMapa, GRUPOS } from '../js/mapa/controles.js';
import { diasDisponibles } from '../js/rejilla/carga.js';
import { leerCsv, filtrarPueblos, leerLugares, leerProvincias, provinciaDe, unirMismoPunto } from '../scripts/rejilla/pueblos.mjs';

const especies = JSON.parse(readFileSync('data/especies.json', 'utf8')).especies;
const diez = (desde) => Array.from({ length: 10 }, (_, k) => new Date(Date.parse(`${desde}T00:00:00Z`) + k * 864e5).toISOString().slice(0, 10));

test('los grupos solo nombran especies comestibles con índice', () => {
  const porId = new Map(especies.map((e) => [e.id, e]));
  for (const g of GRUPOS) for (const id of g.especies) {
    const e = porId.get(id);
    assert.ok(e && e.categoria === 'comestible' && e.indice, `${g.id}: ${id}`);
  }
});

test('chips del 1 de octubre: Mejor hoy, Boletus, Níscalos y Rebozuelos; sin Perretxiko ni Colmenillas', () => {
  const chips = chipsDelDia(especies, '2026-10-01');
  assert.deepEqual(chips[0], { id: 'mejor', texto: 'Mejor hoy', especies: null });
  const ids = chips.map((c) => c.id);
  for (const id of ['boletus', 'niscalos', 'rebozuelos']) assert.ok(ids.includes(id), id);
  for (const id of ['perretxiko', 'colmenillas']) assert.ok(!ids.includes(id), id);
  assert.deepEqual(chips.find((c) => c.id === 'boletus').especies.sort(), ['boletus-aereus', 'boletus-edulis', 'boletus-pinophilus', 'boletus-reticulatus']);
  assert.ok(!ids.includes('lactarius-deliciosus'), 'las agrupadas no repiten chip propio');
  assert.ok(chips.slice(1).every((c) => c.especies.length > 0));
});

test('chips del 15 de abril: Perretxiko y Colmenillas sí; Níscalos no', () => {
  const ids = chipsDelDia(especies, '2026-04-15').map((c) => c.id);
  assert.ok(ids.includes('perretxiko') && ids.includes('colmenillas'));
  assert.ok(!ids.includes('niscalos'));
});

test('un chip que deja de estar en temporada vuelve a «Mejor hoy»', () => {
  assert.equal(chipVigente('perretxiko', chipsDelDia(especies, '2026-10-01')), 'mejor');
  assert.equal(chipVigente('boletus', chipsDelDia(especies, '2026-10-01')), 'boletus');
});

test('barra de días: Hoy, Mañana, día de la semana; «menos fiable» desde el cuarto día', () => {
  const b = barraDias(diez('2026-10-01'), '2026-10-01', '2026-10-03');
  assert.deepEqual(b.slice(0, 5).map((d) => d.texto), ['Hoy', 'Mañana', 'Sáb 3', 'Dom 4', 'Lun 5']);
  assert.deepEqual(b.map((d) => d.menosFiable), [false, false, false, false, true, true, true, true, true, true]);
  assert.deepEqual(b.map((d) => d.pulsado).indexOf(true), 2);
});

test('con un índice de ayer, el primer día de la barra es hoy y se llama «Hoy»; la fecha indexa dias[] por indexOf', () => {
  const fechas = diez('2026-09-30');
  const dias = diasDisponibles({ fechas }, '2026-10-01');
  const b = barraDias(dias, '2026-10-01', '2026-10-01');
  assert.equal(b[0].fecha, '2026-10-01');
  assert.equal(b[0].texto, 'Hoy');
  assert.equal(b.length, 9);
  assert.equal(fechas.indexOf(b[0].fecha), 1, 'el día «Hoy» es la posición 1 del índice de ayer, no la 0');
});

test('buscador: especies (que eligen su chip), sitios y pueblos, sin tildes', () => {
  const chips = chipsDelDia(especies, '2026-10-01');
  const pueblos = [{ n: 'Rascafría', p: 'Madrid', lat: 40.905, lon: -3.88 }, { n: 'Espinosa de los Monteros', p: 'Burgos', lat: 43.077, lon: -3.554 }];
  const sitios = [{ id: 's1', nombre: 'Pinar de la Acebeda', municipio: 'Rascafría (Madrid)', zona: 'guadarrama' },
    { id: 's2', nombre: 'Alto el Caballo', municipio: 'Espinosa de los Monteros (Burgos)', zona: 'merindades', lat: 43.127, lon: -3.536 }];
  const r = (t) => buscarEnMapa(t, { pueblos, sitios, especies, chips });
  assert.deepEqual(r('niscalo')[0], { tipo: 'chip', id: 'niscalos', texto: 'níscalo', sub: 'Níscalos' });
  assert.equal(r('rascafria').find((x) => x.tipo === 'pueblo').lat, 40.905);
  const acebeda = r('acebeda')[0];
  assert.deepEqual([acebeda.tipo, acebeda.lat, acebeda.zoom], ['sitio', 40.905, 13]);   // sin coordenadas: las de su pueblo
  assert.equal(r('caballo')[0].lat, 43.127);
  assert.deepEqual(r('x'), []);
  const bilingue = buscarEnMapa('salvatierra', { pueblos: [{ n: 'Agurain / Salvatierra', p: 'Araba/Álava', lat: 42.85, lon: -2.38874 }],
    sitios: [{ id: 's3', nombre: 'Robledal de prueba', municipio: 'Salvatierra (Álava)', zona: 'alava' }], especies, chips });
  assert.deepEqual(bilingue.map((x) => [x.tipo, x.lat]), [['sitio', 42.85], ['pueblo', 42.85]]);
});

test('buscador: como mucho 8 resultados', () => {
  const pueblos = Array.from({ length: 12 }, (_, k) => ({ n: `Villa ${k}`, p: 'Soria', lat: 41.8 + k / 100, lon: -2.8 }));
  const r = buscarEnMapa('vi', { pueblos, sitios: [], especies: [], chips: [] });
  assert.equal(r.length, 8);
  assert.ok(r.every((x) => x.tipo === 'pueblo'));
});

test('pueblos: CSV con ; y comas decimales, filtrado por los bbox de las zonas y sin repetidos', () => {
  const csv = '﻿NOMBRE;PROVINCIA;LATITUD;LONGITUD\nRascafría;Madrid;40,9050;-3,8800\nRascafría;Madrid;40,9050;-3,8800\n"Lejos, del todo";Cádiz;36,5;-6,2\n';
  const filas = leerCsv(csv);
  assert.equal(filas.length, 3);
  assert.equal(filas[2].NOMBRE, 'Lejos, del todo');
  const zonas = [{ bbox: [-4.25, 40.65, -3.7701, 41.05] }];
  assert.deepEqual(filtrarPueblos(filas, zonas, { nombre: 'NOMBRE', provincia: 'PROVINCIA', lat: 'LATITUD', lon: 'LONGITUD' }), [{ n: 'Rascafría', p: 'Madrid', lat: 40.905, lon: -3.88 }]);
});

// Trozos reales (recortados) de las respuestas GML 3.2 de los WFS del IGN (NGBE y unidades administrativas), 01/10/2026.
const LUGAR = (id, tipo, nombre, pos) => `<wfs:member><gn:NamedPlace gml:id="ES.IGN.NGBE.${id}"><gn:geometry><gml:Point><gml:pos>${pos}</gml:pos></gml:Point></gn:geometry>
<gn:localType><gmd:LocalisedCharacterString locale="es-ES">${tipo}</gmd:LocalisedCharacterString></gn:localType>
<gn:name><gn:GeographicalName><gn:language>spa</gn:language><gn:spelling><gn:SpellingOfName><gn:text>${nombre}</gn:text></gn:SpellingOfName></gn:spelling></gn:GeographicalName></gn:name>
<gn:type xlink:href="https://inspire.ec.europa.eu/codelist/NamedPlaceTypeValue/populatedPlace"/></gn:NamedPlace></wfs:member>`;

test('pueblos: lee los lugares del NGBE (lat lon en ETRS89) y las provincias del IGN', () => {
  const gml = `<wfs:FeatureCollection>${LUGAR(1, 'Entidad singular', 'Rascafría', '40.904049 -3.880406')}${LUGAR(2, 'Barrio', 'Cascajales', '40.901123 -3.874999')}${LUGAR(3, 'Entidad singular', 'Agurain</gn:text></gn:SpellingOfName></gn:spelling></gn:GeographicalName><gn:GeographicalName><gn:spelling><gn:SpellingOfName><gn:text>Salvatierra', '42.85 -2.38874')}</wfs:FeatureCollection>`;
  assert.deepEqual(leerLugares(gml), [{ id: '1', tipo: 'Entidad singular', nombre: 'Rascafría', lat: 40.904049, lon: -3.880406 },
    { id: '2', tipo: 'Barrio', nombre: 'Cascajales', lat: 40.901123, lon: -3.874999 },
    { id: '3', tipo: 'Entidad singular', nombre: 'Agurain / Salvatierra', lat: 42.85, lon: -2.38874 }]);
  const prov = `<wfs:member><au:AdministrativeUnit><au:geometry><gml:MultiSurface><gml:surfaceMember><gml:Polygon><gml:exterior><gml:LinearRing>
<gml:posList>40.0 -4.5 41.5 -4.5 41.5 -3.0 40.0 -3.0 40.0 -4.5</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></gml:surfaceMember></gml:MultiSurface></au:geometry>
<au:name><gn:GeographicalName><gn:spelling><gn:SpellingOfName><gn:text>Madrid</gn:text></gn:SpellingOfName></gn:spelling></gn:GeographicalName></au:name></au:AdministrativeUnit></wfs:member>`;
  const provincias = leerProvincias(prov);
  assert.equal(provincias.length, 1);
  assert.equal(provincias[0].nombre, 'Madrid');
  assert.equal(provinciaDe(-3.88, 40.904, provincias), 'Madrid');
  assert.equal(provinciaDe(-5, 40.9, provincias), '');
});

test('pueblos: un núcleo repetido en el mismo punto queda una vez con todos sus nombres', () => {
  const u = unirMismoPunto([{ id: '1', tipo: 'Entidad singular', nombre: 'Acosta / Okoizta', lat: 42.9, lon: -2.6 },
    { id: '2', tipo: 'Núcleos de población', nombre: 'Acosta / Akosta / Okoizta', lat: 42.9, lon: -2.6 },
    { id: '3', tipo: 'Entidad singular', nombre: 'Acosta', lat: 41.1, lon: -3.5 }]);
  assert.deepEqual(u.map((l) => l.nombre), ['Acosta / Okoizta / Akosta', 'Acosta']);
});

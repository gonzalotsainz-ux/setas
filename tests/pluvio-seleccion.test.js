// tests/pluvio-seleccion.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { utmALatLon } from '../scripts/pluvio/utm.mjs';
import { nombreBonito, nombreDuero, elegir, puntoCercano, resumenPorZona } from '../scripts/pluvio/seleccion.mjs';
import { distanciaKm, MEZCLA } from '../supabase/functions/_shared/pluvio.js';
import { FUENTES_LLUVIA, LICENCIAS } from '../supabase/functions/_shared/pluvio-fuentes.js';

const leerJson = (r) => JSON.parse(readFileSync(r, 'utf8'));
const cerca = (a, b) => Math.abs(a - b) < 1e-4;

test('UTM 30 a grados: Bustarviejo (SAIH Tajo) y Cuerda (SAIH Júcar)', () => {
  const p = utmALatLon(435403.9, 4522055.4, 30);
  assert.ok(cerca(p.lat, 40.847) && cerca(p.lon, -3.7663), JSON.stringify(p));
  const c = utmALatLon(615422.0231001107, 4422197.005116356, 30);
  assert.ok(cerca(c.lat, 39.94203) && cerca(c.lon, -1.64898), JSON.stringify(c));
});

test('distancia en km (haversine) y nula si falta una coordenada', () => {
  assert.equal(Math.round(distanciaKm({ lat: 42.03715928, lon: -3.00451858 }, { lat: 41.95236236, lon: -2.87212741 }) * 10) / 10, 14.4);
  assert.equal(distanciaKm({ lat: 40 }, { lat: 40, lon: -4 }), null);
});

test('nombres: mayúsculas de las fuentes a nombre propio; el código de Duero fuera', () => {
  assert.equal(nombreBonito('OLLA DEL QUIÑON EN BUSTARVIEJO'), 'Olla del Quiñon en Bustarviejo');
  assert.equal(nombreBonito('DEPÓSITOS (LA DEHESA) RASCAFRIA'), 'Depósitos (La Dehesa) Rascafria');
  assert.equal(nombreBonito('LA CIERVA'), 'La Cierva');
  assert.equal(nombreBonito('CASAS VENEROS-VILLANUEVA DEAVILA'), 'Casas Veneros-Villanueva Deavila');
  assert.equal(nombreDuero('Covaleda, PL-47'), 'Covaleda');
  assert.equal(nombreDuero('Quintanar de la Sierra, PL-45a'), 'Quintanar de la Sierra');
});

test('elegir: a menos de 20 km de algún punto y con menos de 600 m de desnivel (o sin mirar la altitud)', () => {
  const puntos = [{ id: 'p', zona: 'z', lat: 40, lon: -4, altitud: 1200 }];
  const a = { fuente: 'tajo', codigo: 'A', lat: 40.05, lon: -4, altitud: 1300 };
  const b = { fuente: 'tajo', codigo: 'B', lat: 40.25, lon: -4, altitud: 1200 };
  const c = { fuente: 'tajo', codigo: 'C', lat: 40.05, lon: -4, altitud: 1900 };
  assert.deepEqual(elegir([a, b, c], puntos).map((e) => e.codigo), ['A']);
  assert.deepEqual(elegir([a, b, c], puntos, { sinAltitud: true }).map((e) => e.codigo), ['A', 'C']);
  assert.equal(Math.round(puntoCercano(a, puntos).km * 10) / 10, 5.6);
  assert.deepEqual(resumenPorZona([a], puntos), { z: { tajo: 1 } });
  assert.equal(MEZCLA.radioKm, 20);
});

test('fuentes y licencias: cada fuente con nombre, enlace y una licencia conocida', () => {
  assert.deepEqual(Object.keys(FUENTES_LLUVIA).sort(), ['aemet', 'duero', 'euskalmet', 'jucar', 'tajo']);
  for (const f of Object.values(FUENTES_LLUVIA)) {
    assert.ok(f.nombre && /^https:\/\//.test(f.url) && LICENCIAS[f.licencia], f.nombre);
  }
  assert.equal(FUENTES_LLUVIA.euskalmet.licencia, 'cc-by-4.0');
});

test('lista blanca generada: fuentes conocidas, licencia de su fuente, URL en Tajo, token en Duero, sin repetidos', () => {
  const lista = leerJson('supabase/functions/pluvio/estaciones.json');
  const puntos = leerJson('supabase/functions/pluvio/puntos.json');
  for (const f of ['tajo', 'duero', 'jucar', 'euskalmet', 'aemet']) assert.ok(lista.some((e) => e.fuente === f), `sin estaciones de ${f}`);
  for (const e of lista) {
    const id = `${e.fuente}:${e.codigo}`;
    assert.ok(FUENTES_LLUVIA[e.fuente], id);
    assert.equal(e.licencia, FUENTES_LLUVIA[e.fuente].licencia, id);
    assert.ok(e.nombre && Number.isFinite(e.lat) && Number.isFinite(e.lon) && Number.isInteger(e.altitud), id);
    if (e.fuente === 'tajo') assert.match(e.url, /^index\.php\?w=get-estacion&x=/, id);
    if (e.fuente === 'duero') assert.match(e.token, /^[A-Za-z0-9]+$/, id);
    if (e.fuente !== 'aemet') assert.ok(puntoCercano(e, puntos).km < MEZCLA.radioKm, `${id} lejos de todos los puntos`);
  }
  assert.equal(new Set(lista.map((e) => `${e.fuente}:${e.codigo}`)).size, lista.length);
  const aemet = leerJson('supabase/functions/aemet/estaciones.json');
  assert.deepEqual(lista.filter((e) => e.fuente === 'aemet').map((e) => e.codigo).sort(), [...aemet].sort());
});

test('puntos.json es copia de los puntos de data/zonas.json', () => {
  const zonas = leerJson('data/zonas.json').zonas;
  assert.deepEqual(leerJson('supabase/functions/pluvio/puntos.json'),
    zonas.flatMap((z) => z.puntos.map((p) => ({ id: p.id, zona: z.id, lat: p.lat, lon: p.lon, altitud: p.altitud }))));
});

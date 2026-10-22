// tests/geocodificador.test.js: el fetch es falso; las fixtures son respuestas reales de CartoCiudad (sonda del 21/10/2026) recortadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { candidatosCartoCiudad, coordenadasCartoCiudad, crearGeocodificador, mezclarResultados, fueraDeZonas, zonasMasCercanas, zonaDeLugar,
  URL_CANDIDATOS, URL_FIND, EXCLUIDOS, MINIMO_LETRAS, RETARDO_MS } from '../js/mapa/geocodificador.js';

const candidatosRascafria = JSON.parse(readFileSync('tests/fixtures/cartociudad-rascafria.json', 'utf8'));
const respuesta = (cuerpo) => ({ ok: true, json: async () => cuerpo });
const esperar = () => new Promise((ok) => setImmediate(ok));

test('constantes', () => {
  assert.equal(URL_CANDIDATOS, 'https://www.cartociudad.es/geocoder/api/geocoder/candidates');
  assert.equal(URL_FIND, 'https://www.cartociudad.es/geocoder/api/geocoder/find');
  assert.deepEqual(EXCLUIDOS, ['callejero', 'portal', 'carretera']);
  assert.equal(MINIMO_LETRAS, 3);
  assert.equal(RETARDO_MS, 300);
});

test('candidatos: pide no_process con calles y portales y devuelve pueblos, topónimos y parajes con texto y sub', async () => {
  const pedidas = [];
  const fetchFn = async (url) => { pedidas.push(url); return respuesta(candidatosRascafria); };
  const r = await candidatosCartoCiudad('Rascafr', { fetchFn });
  assert.match(pedidas[0], /no_process=callejero%2Cportal%2Ccarretera/);
  assert.match(pedidas[0], /q=Rascafr/);
  assert.match(pedidas[0], /limit=8/);
  assert.ok(r.every((x) => x.tipo === 'lugar' && !['callejero', 'portal', 'carretera'].includes(x.type)), 'las calles y portales se descartan aunque vengan');
  assert.equal(r.length, 4);
  assert.deepEqual(r[0], { tipo: 'lugar', texto: 'Rascafría', sub: 'Rascafría, Madrid', id: '1300000303', type: 'poblacion' });
  assert.equal(r[1].texto, 'Rascafría');
  assert.equal(r[2].texto, 'Refugio de la Morcuera');
  assert.equal(r[3].texto, 'Pinar de Valsaín (Paraje)', 'solo se quita el paréntesis que repite el municipio');
  assert.equal(r[3].sub, 'Real Sitio de San Ildefonso, Segovia');
  assert.ok(r.every((x) => !('lat' in x) && !('lng' in x)), 'los candidatos no llevan coordenadas');
});

test('candidatos: la señal y el límite viajan en la petición y un fallo HTTP lanza', async () => {
  const senal = new AbortController().signal;
  let recibido;
  await candidatosCartoCiudad('Morcuera', { limite: 5, senal, fetchFn: async (url, op) => { recibido = [url, op]; return respuesta([]); } });
  assert.match(recibido[0], /limit=5/);
  assert.equal(recibido[1].signal, senal);
  await assert.rejects(candidatosCartoCiudad('Morcuera', { fetchFn: async () => ({ ok: false, status: 500 }) }), /500/);
});

test('coordenadas: lat/lng del find; si vienen a 0, el primer vértice de geom', async () => {
  const urls = [];
  const conLatLng = await coordenadasCartoCiudad({ id: 'ngbe_333552', type: 'ngbe' }, { fetchFn: async (u) => { urls.push(u); return respuesta({ lat: 40.85, lng: -3.99 }); } });
  assert.deepEqual(conLatLng, { lat: 40.85, lon: -3.99 });
  assert.match(urls[0], /find\?/); assert.match(urls[0], /id=ngbe_333552/); assert.match(urls[0], /type=ngbe/);
  const porGeom = await coordenadasCartoCiudad({ id: 'x', type: 'callejero' }, { fetchFn: async () => respuesta({ lat: 0, lng: 0, geom: 'MULTILINESTRING((-3.66851 40.38440,-3.66803 40.38413))' }) });
  assert.deepEqual(porGeom, { lat: 40.3844, lon: -3.66851 });
  await assert.rejects(coordenadasCartoCiudad({ id: 'y', type: 'ngbe' }, { fetchFn: async () => respuesta({ lat: null, lng: null, geom: null }) }), /Sin coordenadas/);
});

test('sugerir: espera el retardo, no pide con menos de 3 letras, descarta respuestas de textos viejos y cachea', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pedidas = [], pendientes = {};
  const fetchFn = (url) => { pedidas.push(url); return new Promise((ok) => { pendientes[/q=([^&]*)/.exec(url)[1]] = () => ok(respuesta(candidatosRascafria)); }); };
  const g = crearGeocodificador({ fetchFn });
  const llegadas = [];
  g.sugerir('ra', (l) => llegadas.push(['ra', l]));
  t.mock.timers.tick(300);
  assert.equal(pedidas.length, 0, 'con menos de 3 letras no se pide');
  assert.deepEqual(llegadas, [['ra', []]]);
  g.sugerir('Rasc', (l) => llegadas.push(['Rasc', l]));
  t.mock.timers.tick(299);
  assert.equal(pedidas.length, 0, 'espera el retardo');
  t.mock.timers.tick(1);
  assert.equal(pedidas.length, 1);
  g.sugerir('Rascafr', (l) => llegadas.push(['Rascafr', l]));   // el texto cambia con «Rasc» en vuelo
  t.mock.timers.tick(300);
  assert.equal(pedidas.length, 2);
  pendientes.Rasc(); pendientes.Rascafr();
  await esperar();
  assert.deepEqual(llegadas.map((x) => x[0]), ['ra', 'Rascafr'], 'la respuesta de «Rasc» se descarta');
  assert.equal(llegadas[1][1].length, 4);
  g.sugerir('RASCAFR', (l) => llegadas.push(['cache', l]));   // misma consulta normalizada: sale de la caché, sin pedir
  t.mock.timers.tick(300);
  await esperar();
  assert.equal(pedidas.length, 2);
  assert.equal(llegadas.at(-1)[0], 'cache');
});

test('sugerir: aborta la petición anterior y un fallo de red entrega lista vacía solo si es el último texto', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const senales = [];
  const g = crearGeocodificador({ fetchFn: (url, op) => { senales.push(op.signal); return Promise.reject(new Error('sin red')); } });
  const llegadas = [];
  g.sugerir('Morcu', (l) => llegadas.push(l));
  t.mock.timers.tick(300);
  g.sugerir('Morcuera', (l) => llegadas.push(l));
  t.mock.timers.tick(300);
  assert.equal(senales[0].aborted, true);
  assert.equal(senales[1].aborted, false);
  await esperar();
  assert.deepEqual(llegadas, [[]]);
});

test('mezclarResultados: locales primero, sin repetir texto (sin tildes ni mayúsculas), 8 como mucho', () => {
  const locales = [{ tipo: 'pueblo', texto: 'Rascafría' }, { tipo: 'zona', texto: 'Guadarrama' }];
  const externos = [{ tipo: 'lugar', texto: 'RASCAFRIA' }, { tipo: 'lugar', texto: 'Morcuera' }, { tipo: 'lugar', texto: 'morcuera' }];
  assert.deepEqual(mezclarResultados(locales, externos).map((x) => x.texto), ['Rascafría', 'Guadarrama', 'Morcuera']);
  const muchos = Array.from({ length: 12 }, (_, k) => ({ tipo: 'lugar', texto: `Sitio ${k}` }));
  assert.equal(mezclarResultados(locales, muchos).length, 8);
  assert.equal(mezclarResultados(locales, muchos, 3).length, 3);
});

test('fueraDeZonas y zonasMasCercanas', () => {
  const zonas = [{ id: 'a', bbox: [-4, 40, -3, 41] }, { id: 'b', bbox: [-2, 41, -1, 42] }];
  assert.equal(fueraDeZonas(40.5, -3.5, zonas), false);
  assert.equal(fueraDeZonas(37, -6, zonas), true);
  assert.deepEqual(zonasMasCercanas(37, -6, zonas, 1).map((z) => z.id), ['a']);
  assert.deepEqual(zonasMasCercanas(41.5, -1.2, zonas, 2).map((z) => z.id), ['b', 'a']);
});

test('zonaDeLugar: la zona cuyo bbox contiene el lugar (la de centro más cercano si se solapan); fuera, null', () => {
  const zonas = [{ id: 'a', bbox: [-4, 40, -3, 41] }, { id: 'b', bbox: [-3.2, 40, -2.8, 41] }];
  assert.equal(zonaDeLugar(40.5, -3.8, zonas).id, 'a');
  assert.equal(zonaDeLugar(40.5, -2.9, zonas).id, 'b');
  assert.equal(zonaDeLugar(40.5, -3.1, zonas).id, 'b');   // en las dos: la de centro más cercano
  assert.equal(zonaDeLugar(37, -6, zonas), null);
});

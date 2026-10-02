// scripts/pluvio/estaciones.mjs
//   node scripts/pluvio/estaciones.mjs [--seco]
// Elige los pluviómetros de montaña de cada zona (spec §3.1) y escribe la lista blanca de la función «pluvio»
// (supabase/functions/pluvio/estaciones.json) y la copia de los puntos de zona (puntos.json). Criterio: a menos de 20 km de
// algún punto de data/zonas.json y con menos de 600 m de desnivel con el más cercano; solo pluviómetros (Tajo: pluviómetro
// y pluvionivómetro; Duero: PL; Júcar: P y N; Euskalmet: KM y KA de alta y, si está _fuentes/euskalmet-2026.zip, solo las
// que miden lluvia). AEMET: las de data/zonas.json, que ya están en la lista blanca de la función «aemet».
// Cortesía: unas 80 peticiones en total, con pausa entre las del mismo servidor. --seco solo resume, no escribe.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { crearPedir } from '../../supabase/functions/pluvio/red.js';
import { cadenaTajo, estacionesDeTablaTajo } from '../../supabase/functions/pluvio/lectores/tajo.js';
import { BASE_DUERO, estacionesDeRisr, historicoDeFicha, altitudDeFicha } from '../../supabase/functions/pluvio/lectores/duero.js';
import { urlDiaJucar, estacionesDeJucar } from '../../supabase/functions/pluvio/lectores/jucar.js';
import { URL_ESTACIONES_EUSKALMET, estacionesDeEuskalmet, altitudDeXmlDatos } from '../../supabase/functions/pluvio/lectores/euskalmet.js';
import { FUENTES_LLUVIA } from '../../supabase/functions/_shared/pluvio-fuentes.js';
import { hoyMadrid, sumarDias } from '../../supabase/functions/_shared/meteo.js';
import { conLluviaEnZip } from './euskalmet-zip.mjs';
import { utmALatLon } from './utm.mjs';
import { nombreBonito, nombreDuero, elegir, resumenPorZona } from './seleccion.mjs';

const RAIZ = new URL('../../', import.meta.url);
const seco = process.argv.includes('--seco');
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const licencia = (fuente) => FUENTES_LLUVIA[fuente].licencia;
const zonas = JSON.parse(readFileSync(new URL('data/zonas.json', RAIZ), 'utf8')).zonas;
const puntos = zonas.flatMap((z) => z.puntos.map((p) => ({ id: p.id, zona: z.id, lat: p.lat, lon: p.lon, altitud: p.altitud })));
const pedir = crearPedir({ fetchFn: fetch });

// SAIH Tajo: la tabla trae tipo, UTM y altitud.
const tajo = elegir(estacionesDeTablaTajo(await cadenaTajo(pedir)).filter((e) => e.tipo === 'pluviometro' || e.tipo === 'pluvionivometro')
  .map((e) => { const { lat, lon } = utmALatLon(e.x, e.y, 30); return { fuente: 'tajo', codigo: e.codigo, nombre: nombreBonito(e.nombre), lat: r4(lat), lon: r4(lon), altitud: e.altitud, licencia: licencia('tajo'), url: e.url }; }), puntos);

// SAIH Duero: PL de la página de tiempo real; token y altitud de la ficha, solo de las que están cerca.
const dueroCerca = elegir(estacionesDeRisr(await pedir(`${BASE_DUERO}datos-tiempo-real/risr`, { como: 'texto' })).filter((e) => /^PL\d{3}$/.test(e.codigo)), puntos, { sinAltitud: true });
const dueroConFicha = [];
for (const e of dueroCerca) {
  const ficha = await pedir(`${BASE_DUERO}risr/${e.codigo}`, { como: 'texto' });
  const token = historicoDeFicha(ficha, e.codigo), altitud = altitudDeFicha(ficha);
  if (!token || altitud == null) { console.warn(`duero ${e.codigo} (${e.nombre}): la ficha no trae histórico de lluvia o altitud; se deja fuera`); continue; }
  dueroConFicha.push({ fuente: 'duero', codigo: e.codigo, nombre: nombreDuero(e.nombre), lat: r4(e.lat), lon: r4(e.lon), altitud, licencia: licencia('duero'), token });
}
const duero = elegir(dueroConFicha, puntos);

// SAIH Júcar: listado del día anterior (UTM 30) y altitud del MDT de Open-Meteo (unos 90 m), como en el informe 09.
const jucarCerca = elegir(estacionesDeJucar(await pedir(urlDiaJucar(sumarDias(hoyMadrid(), -1)))).filter((e) => /^\d[PN]\d\d$/.test(e.codigo))
  .map((e) => { const { lat, lon } = utmALatLon(e.x, e.y, 30); return { ...e, lat: r4(lat), lon: r4(lon) }; }), puntos, { sinAltitud: true });
const alturas = jucarCerca.length
  ? (await pedir(`https://api.open-meteo.com/v1/elevation?latitude=${jucarCerca.map((e) => e.lat).join(',')}&longitude=${jucarCerca.map((e) => e.lon).join(',')}`)).elevation : [];
const jucar = elegir(jucarCerca.map((e, k) => ({ fuente: 'jucar', codigo: e.codigo, nombre: nombreBonito(e.nombre), lat: e.lat, lon: e.lon,
  altitud: Math.round(alturas[k]), licencia: licencia('jucar') })), puntos);

// Euskalmet: altitud del XMLdatos de cada candidata.
const eusCerca = elegir(estacionesDeEuskalmet(await pedir(URL_ESTACIONES_EUSKALMET)), puntos, { sinAltitud: true });
const eusConAltitud = [];
for (const e of eusCerca) {
  const altitud = altitudDeXmlDatos(await pedir(e.xmlDatos, { como: 'texto' }));
  if (altitud != null) eusConAltitud.push({ fuente: 'euskalmet', codigo: e.codigo, nombre: e.nombre, lat: r4(e.lat), lon: r4(e.lon), altitud, licencia: licencia('euskalmet') });
}
const zip = new URL('_fuentes/euskalmet-2026.zip', RAIZ);
const conLluvia = existsSync(zip) ? conLluviaEnZip(readFileSync(zip), eusConAltitud.map((e) => e.codigo)) : null;
if (!conLluvia) console.warn('sin _fuentes/euskalmet-2026.zip: no se comprueba qué estaciones de Euskalmet miden lluvia');
const euskalmet = elegir(conLluvia ? eusConAltitud.filter((e) => conLluvia.has(e.codigo)) : eusConAltitud, puntos);

// AEMET: las de data/zonas.json.
const aemet = [...new Map(zonas.flatMap((z) => z.estacionesAemet ?? []).map((e) => [e.id,
  { fuente: 'aemet', codigo: e.id, nombre: e.nombre, lat: e.lat, lon: e.lon, altitud: e.altitud, licencia: licencia('aemet') }])).values()];

const lista = [...aemet, ...tajo, ...duero, ...jucar, ...euskalmet].sort((a, b) => a.fuente.localeCompare(b.fuente) || a.codigo.localeCompare(b.codigo));
console.log(JSON.stringify(resumenPorZona(lista, puntos), null, 1));
console.log(`${lista.length} estaciones: ${['tajo', 'duero', 'jucar', 'euskalmet', 'aemet'].map((f) => `${f} ${lista.filter((e) => e.fuente === f).length}`).join(', ')}`);
if (!seco) {
  writeFileSync(new URL('supabase/functions/pluvio/estaciones.json', RAIZ), `[\n${lista.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n]\n`);
  writeFileSync(new URL('supabase/functions/pluvio/puntos.json', RAIZ), `${JSON.stringify(puntos, null, 1)}\n`);
  console.log('escritos estaciones.json y puntos.json');
}

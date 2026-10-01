// scripts/rejilla/pueblos.mjs
// Genera data/pueblos.json (nombre, provincia y coordenadas de los núcleos de población dentro de los bbox de las
// zonas, con 0,05° de margen) para el buscador del mapa. Fuente y columnas: CONFIG.pueblos.
// El NGMEP del CNIG exige reCAPTCHA (tarea 0, D5), así que se usan dos servicios WFS del IGN sin captcha, CC BY 4.0:
// el Nomenclátor Geográfico Básico (NGBE, lugares de tipo populatedPlace) y las unidades administrativas (provincias,
// para poner a cada lugar su provincia por punto en polígono). La descarga se guarda en CONFIG.pueblos.archivo
// (_fuentes/, fuera del repo) como CSV y de ahí sale el JSON; con --descargar se vuelve a bajar.
// Uso: node scripts/rejilla/pueblos.mjs [--descargar]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './config.mjs';
import { puntoEnGeometria, bboxDe } from '../../js/rejilla/geo.js';

export function leerCsv(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const cuenta = (c) => (lineas[0].match(new RegExp(`\\${c}`, 'g')) ?? []).length;
  const sep = cuenta(';') >= cuenta(',') ? ';' : ',';
  const partir = (l) => {
    const r = []; let actual = '', comillas = false;
    for (let k = 0; k < l.length; k++) {
      const ch = l[k];
      if (ch === '"') { if (comillas && l[k + 1] === '"') { actual += '"'; k++; } else comillas = !comillas; }
      else if (ch === sep && !comillas) { r.push(actual.trim()); actual = ''; }
      else actual += ch;
    }
    r.push(actual.trim());
    return r;
  };
  const cab = partir(lineas[0]);
  return lineas.slice(1).map((l) => Object.fromEntries(partir(l).map((v, k) => [cab[k], v])));
}

const numero = (v) => Number(String(v ?? '').replace(',', '.'));
export function filtrarPueblos(filas, zonas, columnas, margen = 0.05) {
  const dentro = (lon, lat) => zonas.some(({ bbox: [o, s, e, n] }) => lon >= o - margen && lon <= e + margen && lat >= s - margen && lat <= n + margen);
  const vistos = new Set(), r = [];
  for (const f of filas) {
    const n = f[columnas.nombre]?.trim(), p = f[columnas.provincia]?.trim() ?? '', lat = numero(f[columnas.lat]), lon = numero(f[columnas.lon]);
    if (!n || !Number.isFinite(lat) || !Number.isFinite(lon) || !dentro(lon, lat)) continue;
    const clave = `${n}|${p}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    r.push({ n, p, lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 });
  }
  return r.sort((a, b) => a.n.localeCompare(b.n, 'es'));
}

// ---- Lectura de las respuestas GML 3.2 del IGN (EPSG:4258, orden de ejes lat lon) ----
const entidades = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e]);
const miembros = (gml) => gml.split('<wfs:member>').slice(1);
const textoDe = (m) => { const x = /<gn:text>([^<]*)<\/gn:text>/.exec(m); return x ? entidades(x[1]).trim() : ''; };
// Un lugar puede tener varios nombres (bilingües, como «Agurain» y «Salvatierra»): se guardan todos, separados por « / ».
const nombresDe = (m) => [...new Set([...m.matchAll(/<gn:text>([^<]*)<\/gn:text>/g)].map((x) => entidades(x[1]).trim()).filter(Boolean))].join(' / ');

export function leerLugares(gml) {
  return miembros(gml).map((m) => {
    const [lat, lon] = (/<gml:pos>([^<]*)<\/gml:pos>/.exec(m)?.[1] ?? '').trim().split(/\s+/).map(Number);
    return { id: /gml:id="ES\.IGN\.NGBE\.([^"]+)"/.exec(m)?.[1] ?? '', tipo: entidades(/<gn:localType>\s*<gmd:LocalisedCharacterString[^>]*>([^<]*)</.exec(m)?.[1] ?? ''),
      nombre: nombresDe(m), lat, lon };
  }).filter((l) => l.nombre && Number.isFinite(l.lat) && Number.isFinite(l.lon));
}

const anillo = (posList) => { const v = posList.trim().split(/\s+/).map(Number), r = []; for (let k = 0; k + 1 < v.length; k += 2) r.push([v[k + 1], v[k]]); return r; };
export function leerProvincias(gml) {
  return miembros(gml).map((m) => {
    const poligonos = m.split('<gml:Polygon').slice(1).map((p) => {
      const ext = /<gml:exterior>[\s\S]*?<gml:posList[^>]*>([^<]*)<\/gml:posList>/.exec(p);
      const huecos = [...p.matchAll(/<gml:interior>[\s\S]*?<gml:posList[^>]*>([^<]*)<\/gml:posList>/g)].map((x) => anillo(x[1]));
      return ext ? [anillo(ext[1]), ...huecos] : null;
    }).filter(Boolean);
    const geometria = { type: 'MultiPolygon', coordinates: poligonos };
    return { nombre: /<au:name>([\s\S]*?)<\/au:name>/.exec(m)?.[1] ? textoDe(/<au:name>([\s\S]*?)<\/au:name>/.exec(m)[1]) : '', geometria, bbox: poligonos.length ? bboxDe(geometria) : null };
  }).filter((p) => p.nombre && p.bbox);
}
export const provinciaDe = (lon, lat, provincias) => provincias.find(({ bbox: [o, s, e, n], geometria }) => lon >= o && lon <= e && lat >= s && lat <= n
  && puntoEnGeometria(lon, lat, geometria))?.nombre ?? '';

// ---- Descarga ----
const WFS_LUGARES = 'https://www.ign.es/wfs-inspire/ngbe';
const WFS_PROVINCIAS = 'https://www.ign.es/wfs-inspire/unidades-administrativas';
// Tipos del NGBE que son núcleos (los «Barrio» de dentro de un pueblo, no: el buscador lleva al pueblo).
export const TIPOS_NUCLEO = ['Entidad singular', 'Núcleos de población', 'Capital de municipio'];
const NS = 'xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xlink="http://www.w3.org/1999/xlink" '
  + 'xmlns:gn="http://inspire.ec.europa.eu/schemas/gn/4.0" xmlns:au="http://inspire.ec.europa.eu/schemas/au/4.0"';
const filtro = (campo, [o, s, e, n], ref, valor) => `<fes:Filter ${NS}><fes:And><fes:BBOX><fes:ValueReference>${campo}</fes:ValueReference>`
  + `<gml:Envelope srsName="urn:ogc:def:crs:EPSG::4258"><gml:lowerCorner>${s} ${o}</gml:lowerCorner><gml:upperCorner>${n} ${e}</gml:upperCorner></gml:Envelope></fes:BBOX>`
  + `<fes:PropertyIsEqualTo><fes:ValueReference>${ref}</fes:ValueReference><fes:Literal>${valor}</fes:Literal></fes:PropertyIsEqualTo></fes:And></fes:Filter>`;

async function pedir(base, tipo, f, inicio = 0, cuantos = 1000) {
  const q = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: tipo, count: String(cuantos), startIndex: String(inicio), FILTER: f });
  for (let intento = 1; ; intento++) {
    try {
      const r = await fetch(`${base}?${q}`, { signal: AbortSignal.timeout(180_000) });
      const t = await r.text();
      if (!r.ok || /ExceptionReport/.test(t)) throw new Error(`${base}: ${r.status} ${t.slice(0, 200)}`);
      return t;
    } catch (e) { if (intento >= 3) throw e; await new Promise((ok) => setTimeout(ok, 5000 * intento)); }
  }
}

// El NGBE repite un núcleo en el mismo punto como «Entidad singular», «Capital de municipio» y «Núcleos de población»,
// a veces con nombres distintos: se queda uno por punto con todos sus nombres.
export function unirMismoPunto(lugares) {
  const porPunto = new Map();
  for (const l of lugares) {
    const k = `${l.lat},${l.lon}`, ya = porPunto.get(k);
    if (!ya) porPunto.set(k, { ...l });
    else ya.nombre = [...new Set([...ya.nombre.split(' / '), ...l.nombre.split(' / ')])].join(' / ');
  }
  return [...porPunto.values()];
}

async function descargar(zonas, margen = 0.05) {
  const provincias = new Map(), lugares = new Map();
  for (const z of zonas) {
    const [o, s, e, n] = z.bbox, caja = [o - margen, s - margen, e + margen, n + margen];
    for (const p of leerProvincias(await pedir(WFS_PROVINCIAS, 'AU:AdministrativeUnit',
      filtro('au:geometry', caja, 'au:nationalLevel/@xlink:href', 'https://inspire.ec.europa.eu/codelist/AdministrativeHierarchyLevel/3rdOrder')))) provincias.set(p.nombre, p);
    for (let inicio = 0; ; inicio += 1000) {
      const gml = await pedir(WFS_LUGARES, 'GN:NamedPlace', filtro('gn:geometry', caja, 'gn:type/@xlink:href', 'https://inspire.ec.europa.eu/codelist/NamedPlaceTypeValue/populatedPlace'), inicio);
      const trozo = leerLugares(gml);
      for (const l of trozo) lugares.set(l.id, l);
      if (Number(/numberReturned="(\d+)"/.exec(gml)?.[1] ?? 0) < 1000) break;
    }
    console.log(`${z.id}: ${lugares.size} lugares, ${provincias.size} provincias`);
  }
  const lista = [...provincias.values()];
  return unirMismoPunto([...lugares.values()].filter((l) => TIPOS_NUCLEO.includes(l.tipo))).map((l) => ({ ...l, provincia: provinciaDe(l.lon, l.lat, lista) }));
}

const campoCsv = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const aCsv = (filas) => `NOMBRE;PROVINCIA;LATITUD;LONGITUD;TIPO;ID_NGBE\n${filas.map((l) => [l.nombre, l.provincia, l.lat, l.lon, l.tipo, l.id].map(campoCsv).join(';')).join('\n')}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;
  const { archivo, columnas, nombre, url, licencia, fecha } = CONFIG.pueblos;
  if (!existsSync(archivo) || process.argv.includes('--descargar')) {
    const filas = await descargar(zonas);
    mkdirSync(dirname(archivo), { recursive: true });
    writeFileSync(archivo, aCsv(filas));
    const sin = filas.filter((l) => !l.provincia).length;
    console.log(`${filas.length} núcleos guardados en ${archivo}${sin ? ` (${sin} sin provincia)` : ''}`);
  }
  const pueblos = filtrarPueblos(leerCsv(readFileSync(archivo, 'utf8')), zonas, columnas);
  writeFileSync('data/pueblos.json', `${JSON.stringify({ version: 1, fuente: { nombre, url, licencia, fecha }, pueblos })}\n`);
  console.log(`${pueblos.length} pueblos en data/pueblos.json`);
}

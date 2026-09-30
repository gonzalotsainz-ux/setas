// Extrae del GeoJSON de montes de utilidad pública del MITECO (1,2 GB, una feature por línea) los de las
// provincias que interesan, sin cargarlo entero en memoria. Salida en UTM 30N (EPSG:25830), como el original.
import { createReadStream, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
const ENTRADA = '_fuentes/mup/IEPF_CMUP_pb.geojson';
const SALIDA = '_fuentes/mup-provincias.geojson';
const PROVINCIAS = new Set(['Cuenca', 'Guadalajara', 'Toledo', 'Madrid', 'Araba/Álava']);
if (!existsSync(ENTRADA)) { console.error(`Falta ${ENTRADA}: descomprime IEPF_CMUP_GeoJson.zip en _fuentes/mup/`); process.exit(1); }
const out = [];
let total = 0;
for await (const linea of createInterface({ input: createReadStream(ENTRADA, { encoding: 'utf8' }), crlfDelay: Infinity })) {
  if (!linea.startsWith('{ "type": "Feature"')) continue;
  total++;
  const f = JSON.parse(linea.replace(/,\s*$/, ''));
  if (PROVINCIAS.has(f.properties.NUT3_NOM)) out.push(f);
}
const crs = { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::25830' } };
writeFileSync(SALIDA, JSON.stringify({ type: 'FeatureCollection', crs, features: out }));
console.log(`MUP leídos: ${total}; en ${[...PROVINCIAS].join(', ')}: ${out.length}`);

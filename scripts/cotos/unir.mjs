// Junta en data/cotos.geojson los orígenes: CyL, Parque Nacional (+Hayedo de Montejo), Castilla-La Mancha y Álava.
// Antes hay que ejecutar cyl.mjs, parque-nacional.mjs, clm.mjs y alava.mjs (los intermedios quedan en _fuentes/).
import { readFileSync, writeFileSync, statSync } from 'node:fs';
const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
const features = [
  ...leer('_fuentes/cotos-cyl.json'),
  ...leer('_fuentes/cotos-pn.json'),
  ...leer('_fuentes/cotos-clm.json'),
  ...leer('data/fuentes-cotos/alava.geojson').features,
  ...leer('_fuentes/cotos-alava-mup.json'),
];
const vistos = new Set();
for (const f of features) {
  if (vistos.has(f.properties.id)) throw new Error(`id duplicado: ${f.properties.id}`);
  vistos.add(f.properties.id);
}
// Las prohibiciones van al final para que se pinten encima de los cotos.
const orden = { prohibido: 1 };
features.sort((a, b) => (orden[a.properties.tipo] ?? 0) - (orden[b.properties.tipo] ?? 0));
writeFileSync('data/cotos.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
const kb = statSync('data/cotos.geojson').size / 1024;
const por = {};
for (const f of features) por[f.properties.tipo] = (por[f.properties.tipo] ?? 0) + 1;
console.log(`${features.length} elementos`, por, `· ${kb.toFixed(0)} KB (${(kb / 1024).toFixed(2)} MB)`);
if (kb > 3 * 1024) { console.error('Supera los 3 MB'); process.exit(1); }

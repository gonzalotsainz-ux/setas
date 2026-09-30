// Cotos municipales de Castilla-La Mancha: se dibujan con los montes de utilidad pública (MITECO) que cita cada ordenanza.
// Requiere _fuentes/mup-provincias.geojson (se genera con scripts/cotos/extraer-mup.mjs).
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const MUP = '_fuentes/mup-provincias.geojson';
const { montes, sinMapa } = JSON.parse(readFileSync('data/fuentes-cotos/clm-montes.json', 'utf8'));
const normas = Object.fromEntries(JSON.parse(readFileSync('data/normativa.json', 'utf8')).normas.map((n) => [n.id, n]));
const mup = JSON.parse(readFileSync(MUP, 'utf8'));
const crs = mup.crs;
const elegidos = [];
for (const [id, c] of Object.entries(montes)) {
  const fs = mup.features.filter((f) => f.properties.NUT3_NOM === c.provincia && c.montes.includes(String(f.properties.cmup)));
  if (fs.length !== c.montes.length) { console.error(`${id}: esperaba ${c.montes.length} montes y hay ${fs.length}; no se mapea`); continue; }
  for (const f of fs) elegidos.push({ type: 'Feature', geometry: f.geometry, properties: { coto: id } });
}
writeFileSync('_fuentes/clm-montes.geojson', JSON.stringify({ type: 'FeatureCollection', crs, features: elegidos }));
execFileSync('npx', ['mapshaper', '_fuentes/clm-montes.geojson', '-proj', 'wgs84', 'from="+proj=utm +zone=30 +ellps=GRS80 +units=m +no_defs"',
  '-dissolve', 'coto', '-simplify', 'dp', '15%', 'keep-shapes', '-o', 'precision=0.00001', '_fuentes/clm-simple.geojson', 'force'], { stdio: 'inherit', shell: true });
const fc = JSON.parse(readFileSync('_fuentes/clm-simple.geojson', 'utf8'));
const features = fc.features.map((f) => {
  const c = montes[f.properties.coto];
  return { type: 'Feature', geometry: f.geometry, properties: {
    id: `clm-${f.properties.coto}`, nombre: c.nombre, tipo: 'acotado', precision: 'derivado', zona: c.zona, normas: c.normas,
    permisoUrl: c.permisoUrl, regimenConfirmado: normas[c.normas[0]]?.verificado === true, nota: c.nota,
    fuente: c.fuente, revisado: '2026-09-30' } };
});
writeFileSync('_fuentes/cotos-clm.json', JSON.stringify(features));
console.log(`CLM: ${features.length} cotos mapeados; sin mapa: ${Object.keys(sinMapa).join(', ')}`);

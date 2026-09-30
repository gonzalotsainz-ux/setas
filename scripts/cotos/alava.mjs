// Cotos de Álava derivados de montes de utilidad pública (Asparrena-Apota y Gordoa).
// Los de Arraia y Árcena están digitalizados a mano en data/fuentes-cotos/alava.geojson (ver scripts/cotos/digitalizar-alava).
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const { montes } = JSON.parse(readFileSync('data/fuentes-cotos/alava-montes.json', 'utf8'));
const mup = JSON.parse(readFileSync('_fuentes/mup-provincias.geojson', 'utf8'));
const elegidos = [];
for (const [id, c] of Object.entries(montes)) {
  const fs = mup.features.filter((f) => f.properties.NUT3_NOM === 'Araba/Álava' && c.montes.includes(String(f.properties.cmup)) && f.properties.sup_carto > 5);
  if (!fs.length) { console.error(`${id}: sin montes`); continue; }
  console.log(id, fs.map((f) => `${f.properties.cmup} ${f.properties.monte}`).join(' | '));
  for (const f of fs) elegidos.push({ type: 'Feature', geometry: f.geometry, properties: { coto: id } });
}
writeFileSync('_fuentes/alava-montes.geojson', JSON.stringify({ type: 'FeatureCollection', crs: mup.crs, features: elegidos }));
execFileSync('npx', ['mapshaper', '_fuentes/alava-montes.geojson', '-proj', 'wgs84', 'from="+proj=utm +zone=30 +ellps=GRS80 +units=m +no_defs"',
  '-dissolve', 'coto', '-simplify', 'dp', '15%', 'keep-shapes', '-o', 'precision=0.00001', '_fuentes/alava-simple.geojson', 'force'], { stdio: 'inherit', shell: true });
const fc = JSON.parse(readFileSync('_fuentes/alava-simple.geojson', 'utf8'));
const features = fc.features.map((f) => {
  const c = montes[f.properties.coto];
  return { type: 'Feature', geometry: f.geometry, properties: { id: `alava-${f.properties.coto}`, nombre: c.nombre, tipo: c.tipo ?? 'acotado', precision: 'derivado',
    zona: 'alava', normas: c.normas, permisoUrl: c.permisoUrl, regimenConfirmado: false, nota: c.nota, fuente: c.fuente, revisado: '2026-09-30' } };
});
writeFileSync('_fuentes/cotos-alava-mup.json', JSON.stringify(features));
console.log(`Álava (MUP): ${features.length} cotos`);

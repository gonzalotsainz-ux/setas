// Zonas donde el PRUG del Parque Nacional de Guadarrama prohíbe la recogida (Reserva y Uso Restringido A).
// Art. 59.b del Decreto 18/2020 (Madrid) y del Decreto 16/2019 (CyL).
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const ORIGEN = '_fuentes/datos/oapn_zonificacion_prug_ppnn_EPSG4326_20260930.geojson';
const FUENTE = 'http://sigred.oapn.es/geoserverOAPN/ZonificacionPRUG/ows';
const origen = JSON.parse(readFileSync(ORIGEN, 'utf8'));
const limpio = (s) => s.replace(/\s+/g, ' ').trim();
const slug = (s) => limpio(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const elegidos = [];
for (const f of origen.features) {
  const p = f.properties;
  if (!/Sierra de Guadarrama/.test(p['Nombre Parque'] ?? '')) continue;
  const reserva = /Reserva/.test(p.Zona ?? '');
  const ura = /Uso Restringido/.test(p.Zona ?? '') && p['Subzona PRUG'] === 'A';
  if (!reserva && !ura) continue;
  const categoria = reserva ? 'Zona de Reserva' : 'Zona de Uso Restringido A';
  elegidos.push({ type: 'Feature', geometry: f.geometry, properties: { categoria, lugar: limpio(p.Nombre), cat: reserva ? 'reserva' : 'ura' } });
}
writeFileSync('_fuentes/pnsg-recorte.geojson', JSON.stringify({ type: 'FeatureCollection', features: elegidos }));
execFileSync('npx', ['mapshaper', '_fuentes/pnsg-recorte.geojson', '-simplify', 'dp', '15%', 'keep-shapes',
  '-o', 'precision=0.00001', '_fuentes/pnsg-simple.geojson', 'force'], { stdio: 'inherit', shell: true });
const fc = JSON.parse(readFileSync('_fuentes/pnsg-simple.geojson', 'utf8'));
const usados = new Set();
const features = fc.features.map((f) => {
  const { categoria, lugar, cat } = f.properties;
  let id = `pnsg-${cat}-${slug(lugar)}`.slice(0, 80);
  for (let i = 2; usados.has(id); i++) id = `${id.replace(/-\d+$/, '')}-${i}`;
  usados.add(id);
  return { type: 'Feature', geometry: f.geometry, properties: {
    id, nombre: `${lugar} (${categoria})`, tipo: 'prohibido', precision: 'oficial', zona: 'guadarrama',
    normas: ['pn-guadarrama-prug'], regimenConfirmado: true,
    nota: 'Recogida de setas prohibida por el PRUG del Parque Nacional (art. 59.b de los Decretos 18/2020 de Madrid y 16/2019 de Castilla y León).',
    fuente: FUENTE, revisado: '2026-09-30' } };
});

// Hayedo de Montejo: MUP n.º 89 de Madrid (campo cmup del IEPF), donde la Resolución 2213/2025 prohíbe recolectar hongos.
const mup = JSON.parse(readFileSync('_fuentes/mup-provincias.geojson', 'utf8'));
const hayedo = mup.features.filter((f) => f.properties.NUT3_NOM === 'Madrid' && String(f.properties.cmup) === '89');
if (hayedo.length !== 1) throw new Error(`MUP 89 de Madrid: esperaba 1 y hay ${hayedo.length}`);
writeFileSync('_fuentes/montejo.geojson', JSON.stringify({ type: 'FeatureCollection', crs: mup.crs, features: [{ type: 'Feature', geometry: hayedo[0].geometry, properties: { id: 'montejo' } }] }));
execFileSync('npx', ['mapshaper', '_fuentes/montejo.geojson', '-proj', 'wgs84', 'from="+proj=utm +zone=30 +ellps=GRS80 +units=m +no_defs"',
  '-simplify', 'dp', '25%', 'keep-shapes', '-o', 'precision=0.00001', '_fuentes/montejo-simple.geojson', 'force'], { stdio: 'inherit', shell: true });
const montejo = JSON.parse(readFileSync('_fuentes/montejo-simple.geojson', 'utf8')).features[0];
features.push({ type: 'Feature', geometry: montejo.geometry, properties: {
  id: 'montejo-hayedo', nombre: 'Hayedo de Montejo (MUP 89 «El Chaparral y La Solana»)', tipo: 'prohibido', precision: 'derivado', zona: 'sierra-norte',
  normas: ['montejo-prohibicion'], regimenConfirmado: true,
  nota: 'La Resolución 2213/2025 no permite recolectar plantas, hongos ni minerales en el Hayedo. Límite tomado del monte de utilidad pública n.º 89 del catálogo de Madrid (MITECO), que coincide en lugar y extensión (251 ha); no es el límite oficial del espacio visitable.',
  fuente: 'https://www.sierradelrincon.org/wp-content/uploads/2025/11/022Resolucion-2213_2025-DG-Biodiversidad-y-Gestion-Forestal.pdf', revisado: '2026-09-30' } });
writeFileSync('_fuentes/cotos-pn.json', JSON.stringify(features));
console.log(`Parque Nacional: ${features.length} polígonos prohibidos (${features.filter((f) => f.properties.id.includes('-reserva-')).length} de Reserva, ${features.filter((f) => f.properties.id.includes('-ura-')).length} de Uso Restringido A); ${(JSON.stringify(features).length / 1024).toFixed(0)} KB`);

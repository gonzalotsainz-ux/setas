// Recorta la capa oficial de zonas micológicas reguladas de CyL a las zonas de la app y le añade los nombres.
// Diferencia con el guion del plan: la zona se asigna por el reparto de vértices dentro de cada bbox (y no por el
// centroide del primer anillo), porque el centroide dejaba fuera polígonos enormes como el PMSO-50001.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const ORIGEN = '_fuentes/datos/cyl_zonas_micologicas_reguladas_EPSG4326_20260930.geojson';
const FUENTE = 'https://idecyl.jcyl.es/geonetwork/docs/api/records/SPAGOBCYLMNADTSAMMZR';
const MIN_REPARTO = 0.10; // fracción mínima de vértices dentro de la bbox de una zona
const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;
const normas = Object.fromEntries(JSON.parse(readFileSync('data/normativa.json', 'utf8')).normas.map((n) => [n.id, n]));
const nombres = JSON.parse(readFileSync('data/fuentes-cotos/cyl-nombres.json', 'utf8'));

const vertices = (g) => { const o = []; const r = (a) => (typeof a[0] === 'number' ? o.push(a) : a.forEach(r)); r(g.coordinates); return o; };
const dentro = ([x, y], [a, b, c, d]) => x >= a && x <= c && y >= b && y <= d;
const asignar = (g) => {
  const v = vertices(g);
  let mejor = null;
  for (const z of zonas) {
    const k = v.filter((p) => dentro(p, z.bbox)).length;
    if (k / v.length >= MIN_REPARTO && (!mejor || k > mejor.k)) mejor = { id: z.id, k };
  }
  return mejor?.id ?? null;
};

const origen = JSON.parse(readFileSync(ORIGEN, 'utf8'));
const elegidos = [], sinZona = [];
for (const f of origen.features) {
  const z = asignar(f.geometry);
  if (z) elegidos.push({ ...f, properties: { c_clave_id: f.properties.c_clave_id, n_tip_terreno: f.properties.n_tip_terreno, zona: z } });
  else sinZona.push(f.properties.c_clave_id);
}
writeFileSync('_fuentes/cyl-recorte.geojson', JSON.stringify({ type: 'FeatureCollection', features: elegidos }));
execFileSync('npx', ['mapshaper', '_fuentes/cyl-recorte.geojson', '-simplify', 'dp', '8%', 'keep-shapes',
  '-o', 'precision=0.00001', '_fuentes/cyl-simple.geojson', 'force'], { stdio: 'inherit', shell: true });
const fc = JSON.parse(readFileSync('_fuentes/cyl-simple.geojson', 'utf8'));

const features = fc.features.map((f) => {
  const { c_clave_id: clave, n_tip_terreno: tt, zona } = f.properties;
  const n = nombres[clave];
  const especificas = (n?.normas ?? []).filter((id) => id !== 'cyl-decreto-31-2017' && id !== 'pn-guadarrama-prug');
  const properties = {
    id: clave, nombre: n?.nombre ?? `Zona regulada ${clave}`,
    tipo: tt === 'Parque' ? 'parque-micologico' : 'acotado', precision: 'oficial', zona,
    normas: n?.normas ?? ['cyl-decreto-31-2017'], permisoUrl: n?.permisoUrl ?? 'https://micologiacyl.es/acotados',
    // Solo se da el régimen por confirmado si hay nombre y una norma específica leída del coto.
    regimenConfirmado: Boolean(n) && especificas.length > 0 && especificas.every((id) => normas[id]?.verificado === true),
    fuente: FUENTE, revisado: '2026-09-30',
  };
  if (!n && tt === 'Parque') properties.nota = 'Polígono de tipo «Parque» en la capa oficial sin nombre ni estado publicados (no figura en la Red de Parques Micológicos). Régimen no confirmado; consulta https://micologiacyl.es/acotados.';
  else if (!n) properties.nota = 'Polígono de la capa oficial sin nombre en el portal; aplica el Decreto 31/2017 (terreno regulado: hace falta permiso).';
  if (clave === 'PMSG-50001') properties.nota += ' Hipótesis sin verificar: podría ser la geometría del acotado SG-50002 «Montes de Segovia» (norma cyl-montes-de-segovia).';
  return { type: 'Feature', geometry: f.geometry, properties };
});
writeFileSync('_fuentes/cotos-cyl.json', JSON.stringify(features));
const por = {}; for (const f of features) (por[f.properties.zona] ??= []).push(f.properties.id);
console.log(`CyL: ${features.length} cotos. Por zona:`, por);
console.log('Sin nombre:', features.filter((f) => !nombres[f.properties.id]).map((f) => f.properties.id).join(', '));
console.log('Sin zona (no entran en la capa):', sinZona.length, 'polígonos; ej.', sinZona.slice(0, 8).join(', '));
console.log('Tamaño:', (JSON.stringify(features).length / 1024).toFixed(0), 'KB');

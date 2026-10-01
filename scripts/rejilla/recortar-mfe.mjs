// scripts/rejilla/recortar-mfe.mjs
// Recorta el MFE50 de cada provincia al bbox de CADA zona que lo usa (no a la unión: en Burgos, burgos y merindades
// dejan un hueco grande entre medias) y lo guarda en _fuentes/mfe50-recorte/<zona>/<provincia>.geojson, que es lo que
// lee generar.mjs. Parte del shapefile original (como la tarea 0: docs/investigacion/08-rejilla-fuentes.md, D1) y
// lanza mapshaper en un proceso aparte por recorte, uno detrás de otro, para no juntar en memoria dos provincias.
// Margen: MARGEN grados alrededor del bbox de la zona; basta con cubrir la ventana de celdas finas (sobresale como
// mucho una celda de 250 m, unos 0,003°), porque las celdas gruesas solo agregan celdas finas de la ventana.
// Uso: node scripts/rejilla/recortar-mfe.mjs   (no repite los recortes que ya existen; bórralos para rehacerlos)
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { CONFIG } from './config.mjs';

export const MARGEN = 0.01;
export const rutaRecorte = (zona, provincia) => `${CONFIG.mfe.recortes}/${zona}/${provincia}.geojson`;
export const bboxRecorte = (bbox, margen = MARGEN) => [bbox[0] - margen, bbox[1] - margen, bbox[2] + margen, bbox[3] + margen]
  .map((v) => Math.round(v * 1e4) / 1e4);

const shpDe = (provincia) => {
  const carpeta = `${CONFIG.mfe.carpeta}/${provincia}`;
  const shp = readdirSync(carpeta).find((f) => /^mfe50_\d+\.shp$/i.test(f));
  if (!shp) throw new Error(`no hay shapefile del MFE50 en ${carpeta}`);
  return `${carpeta}/${shp}`;
};

function main() {
  const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;
  const campos = [...CONFIG.mfe.campos.especies, ...CONFIG.mfe.campos.ocupacion, CONFIG.mfe.campos.fcc, CONFIG.mfe.campos.tipo].join(',');
  for (const zona of zonas) for (const provincia of zona.provincias) {
    const salida = rutaRecorte(zona.id, provincia);
    if (existsSync(salida)) { console.log(`${salida}: ya está`); continue; }
    mkdirSync(`${CONFIG.mfe.recortes}/${zona.id}`, { recursive: true });
    const temporal = `${salida}.tmp.geojson`;
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ['--max-old-space-size=4096', 'node_modules/mapshaper/bin/mapshaper',
      '-i', shpDe(provincia), '-proj', 'wgs84', '-clip', `bbox=${bboxRecorte(zona.bbox).join(',')}`,
      '-filter-fields', campos, '-o', 'format=geojson', 'precision=0.00001', temporal], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`mapshaper falló recortando ${provincia} para ${zona.id} (código ${r.status ?? r.signal})`);
    renameSync(temporal, salida);   // solo queda el archivo final si mapshaper terminó bien
    console.log(`${salida}: ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}

if (process.argv[1]?.endsWith('recortar-mfe.mjs')) main();

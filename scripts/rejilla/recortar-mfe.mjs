// scripts/rejilla/recortar-mfe.mjs
// Recorta el MFE50 de cada provincia al bbox de CADA zona que la usa (sus provincias y las vecinas de CONFIG.mfe.vecinas)
// y lo guarda en _fuentes/mfe50-recorte/<zona>/<provincia>.geojson, que es lo que lee generar.mjs. Junto a cada recorte
// queda <provincia>.recorte.json con el bbox usado y el número de teselas: si no cubre el bbox que pide la zona, se rehace.
// Parte del shapefile original (como la tarea 0: docs/investigacion/08-rejilla-fuentes.md, D1); si falta, baja el ZIP del
// MITECO (CONFIG.mfe.zips) y lo descomprime. Lanza mapshaper en un proceso aparte por recorte, uno detrás de otro.
// Margen: MARGEN grados alrededor del bbox de la zona; basta con cubrir la ventana de celdas finas (sobresale como
// mucho una celda de 250 m, unos 0,003°), porque las celdas gruesas solo agregan celdas finas de la ventana.
// Uso: node scripts/rejilla/recortar-mfe.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './config.mjs';

export const MARGEN = 0.01;
export const rutaRecorte = (zona, provincia) => `${CONFIG.mfe.recortes}/${zona}/${provincia}.geojson`;
export const rutaMetaRecorte = (zona, provincia) => `${CONFIG.mfe.recortes}/${zona}/${provincia}.recorte.json`;
export const bboxRecorte = (bbox, margen = MARGEN) => [bbox[0] - margen, bbox[1] - margen, bbox[2] + margen, bbox[3] + margen]
  .map((v) => Math.round(v * 1e4) / 1e4);
// ¿El bbox `a` [o, s, e, n] contiene entero al `b`?
export const cubre = (a, b) => Array.isArray(a) && a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
// Provincias que lee una zona: las suyas primero (ganan si dos teselas se solapan en la raya) y luego las vecinas.
export const provinciasDeZona = (zona, vecinas = CONFIG.mfe.vecinas) => [
  ...zona.provincias.map((p) => ({ provincia: p, fuera: false })),
  ...(vecinas[zona.id] ?? []).filter((p) => !zona.provincias.includes(p)).map((p) => ({ provincia: p, fuera: true })),
];
// Lo que hay que rehacer: falta el recorte o su bbox no cubre el que pide la zona.
export function recorteVale(meta, zona) {
  return !!meta && cubre(meta.bbox, bboxRecorte(zona.bbox));
}

const leerJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
const TAR = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar';   // el tar de Windows abre ZIP

async function shpDe(provincia) {
  const carpeta = `${CONFIG.mfe.carpeta}/${provincia}`;
  const buscar = () => (existsSync(carpeta) ? readdirSync(carpeta).find((f) => /^mfe50_\d+\.shp$/i.test(f)) : null);
  if (!buscar()) {
    const zip = CONFIG.mfe.zips[provincia];
    if (!zip) throw new Error(`no hay ZIP del MFE50 para ${provincia} en CONFIG.mfe.zips`);
    mkdirSync(carpeta, { recursive: true });
    const ruta = `${carpeta}/${zip}`;
    if (!existsSync(ruta)) {
      console.log(`bajando ${zip} (${provincia})`);
      const r = await fetch(CONFIG.mfe.zipBase + zip, { signal: AbortSignal.timeout(600000) });
      if (!r.ok) throw new Error(`${zip}: ${r.status}`);
      writeFileSync(`${ruta}.tmp`, Buffer.from(await r.arrayBuffer()));
      renameSync(`${ruta}.tmp`, ruta);
      await new Promise((fin) => setTimeout(fin, 2000));   // pausa entre descargas: el servidor es del MITECO
    }
    const x = spawnSync(TAR, ['-xf', zip], { cwd: carpeta, stdio: 'inherit' });
    if (x.status !== 0) throw new Error(`no se pudo descomprimir ${ruta}`);
  }
  const shp = buscar();
  if (!shp) throw new Error(`no hay shapefile del MFE50 en ${carpeta}`);
  return `${carpeta}/${shp}`;
}

const contarFeatures = (ruta) => (readFileSync(ruta, 'utf8').match(/\{"type":"Feature"/g) ?? []).length;

async function main() {
  const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;
  const campos = [...CONFIG.mfe.campos.especies, ...CONFIG.mfe.campos.ocupacion, CONFIG.mfe.campos.fcc, CONFIG.mfe.campos.tipo].join(',');
  for (const zona of zonas) for (const { provincia } of provinciasDeZona(zona)) {
    const salida = rutaRecorte(zona.id, provincia), meta = rutaMetaRecorte(zona.id, provincia);
    if (recorteVale(leerJson(meta), zona) && existsSync(salida)) { console.log(`${salida}: ya está`); continue; }
    mkdirSync(`${CONFIG.mfe.recortes}/${zona.id}`, { recursive: true });
    rmSync(meta, { force: true });
    const temporal = `${salida}.tmp.geojson`, bbox = bboxRecorte(zona.bbox);
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ['--max-old-space-size=4096', 'node_modules/mapshaper/bin/mapshaper',
      '-i', await shpDe(provincia), '-filter-fields', campos, '-proj', 'wgs84', '-clip', `bbox=${bbox.join(',')}`,
      '-o', 'format=geojson', 'precision=0.00001', temporal], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`mapshaper falló recortando ${provincia} para ${zona.id} (código ${r.status ?? r.signal})`);
    // Sin teselas dentro del bbox, mapshaper puede no escribir nada: se deja un recorte vacío (la provincia no entra).
    if (!existsSync(temporal)) writeFileSync(temporal, '{"type":"FeatureCollection", "features": [\n]}\n');
    renameSync(temporal, salida);   // solo queda el archivo final si mapshaper terminó bien
    const teselas = contarFeatures(salida);
    writeFileSync(meta, `${JSON.stringify({ bbox, provincia, zona: zona.id, teselas, fecha: new Date().toISOString().slice(0, 10) })}\n`);
    console.log(`${salida}: ${teselas} teselas, ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

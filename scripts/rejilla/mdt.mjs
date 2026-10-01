// scripts/rejilla/mdt.mjs
// Modelo digital del terreno elegido en el sondeo (CONFIG.mdt) → altitud media de cada celda fina de 250 m.
// Las descargas se guardan en _fuentes/ (no van al repo) y no se repiten.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ORIGEN, TAM_FINA, aMercator, aGrados } from '../../js/rejilla/geo.js';

export const nuevoAcumulador = (n) => ({ suma: new Float64Array(n), cuenta: new Uint32Array(n) });
// `ceroSinDato`: el WCS del IGN devuelve 0 fuera de España (lado portugués de Extremadura); ahí el 0 exacto no es altitud, es sin dato.
export function acumularPunto(acc, ventana, x, y, alt, tam = TAM_FINA, { ceroSinDato = false } = {}) {
  if (!Number.isFinite(alt) || alt < -100 || alt > 4000) return;   // sin dato o valor de relleno
  if (ceroSinDato && alt === 0) return;
  const col = Math.floor((x + ORIGEN) / tam) - ventana.col0, fila = Math.floor((ORIGEN - y) / tam) - ventana.fila0;
  if (col < 0 || fila < 0 || col >= ventana.ancho || fila >= ventana.alto) return;
  const k = fila * ventana.ancho + col;
  acc.suma[k] += alt; acc.cuenta[k]++;
}
export const mediasDe = (acc) => Float32Array.from(acc.suma, (s, k) => (acc.cuenta[k] ? s / acc.cuenta[k] : NaN));

async function descargar(url, ruta, fetchFn) {
  if (existsSync(ruta)) return readFileSync(ruta);
  let r;
  for (let intento = 1; intento <= 3; intento++) {   // el WCS del IGN devuelve algún 500 suelto: se repite
    r = await fetchFn(url, { signal: AbortSignal.timeout(120000) });
    if (r.ok || r.status < 500) break;
    await new Promise((fin) => setTimeout(fin, 2000 * intento));
  }
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  mkdirSync(ruta.slice(0, ruta.lastIndexOf('/')), { recursive: true });
  writeFileSync(ruta, b);
  return b;
}

// --- Terrarium (AWS Terrain Tiles): PNG 256 × 256 en EPSG:3857; altitud = R·256 + G + B/256 − 32768 ---
export const altitudTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;
export const ladoTesela = (z) => (2 * ORIGEN) / 2 ** z;
export function teselasDeVentana(ventana, z, tam = TAM_FINA) {
  const l = ladoTesela(z);
  const x0 = Math.floor((ventana.col0 * tam) / l), x1 = Math.floor(((ventana.col0 + ventana.ancho) * tam - 1e-6) / l);
  const y0 = Math.floor((ventana.fila0 * tam) / l), y1 = Math.floor(((ventana.fila0 + ventana.alto) * tam - 1e-6) / l);
  const r = [];
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) r.push({ tx, ty });
  return r;
}
export function acumularTesela(acc, ventana, { z, tx, ty, datos, canales = 4, lado = 256 }, tam = TAM_FINA) {
  const px = ladoTesela(z) / lado;
  for (let py = 0; py < lado; py++) {
    const y = ORIGEN - (ty * lado + py + 0.5) * px;
    for (let qx = 0; qx < lado; qx++) {
      const o = (py * lado + qx) * canales;
      acumularPunto(acc, ventana, (tx * lado + qx + 0.5) * px - ORIGEN, y, altitudTerrarium(datos[o], datos[o + 1], datos[o + 2]), tam);
    }
  }
}
async function altitudesTerrarium(ventana, { z = 12, carpeta = '_fuentes/terrarium', fetchFn = fetch } = {}) {
  const { default: sharp } = await import('sharp');
  const acc = nuevoAcumulador(ventana.ancho * ventana.alto);
  for (const { tx, ty } of teselasDeVentana(ventana, z)) {
    const png = await descargar(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`, `${carpeta}/${z}/${tx}/${ty}.png`, fetchFn);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    acumularTesela(acc, ventana, { z, tx, ty, datos: data, canales: info.channels, lado: info.width });
  }
  return mediasDe(acc);
}

// --- GeoTIFF (IGN WCS en EPSG:3857 por bloques, o teselas GLO-30 de 1° en EPSG:4326). Requiere `npm i -D geotiff`. ---
const BLOQUE = 400;   // celdas por lado de cada petición WCS (100 km)
async function leerTiff(buffer) {
  const { fromArrayBuffer } = await import('geotiff');
  const img = await (await fromArrayBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))).getImage();
  return { img, valores: (await img.readRasters({ interleave: true })), ancho: img.getWidth(), alto: img.getHeight(), bbox: img.getBoundingBox() };
}
async function altitudesGeoTiff(ventana, { fuente, plantillaUrl, carpeta = '_fuentes/mdt', fetchFn = fetch }) {
  const acc = nuevoAcumulador(ventana.ancho * ventana.alto);
  if (fuente === 'ign-wcs') {
    for (let f0 = 0; f0 < ventana.alto; f0 += BLOQUE) for (let c0 = 0; c0 < ventana.ancho; c0 += BLOQUE) {
      const an = Math.min(BLOQUE, ventana.ancho - c0), al = Math.min(BLOQUE, ventana.alto - f0);
      const oeste = (ventana.col0 + c0) * TAM_FINA - ORIGEN, norte = ORIGEN - (ventana.fila0 + f0) * TAM_FINA;
      const vals = { oeste, norte, este: oeste + an * TAM_FINA, sur: norte - al * TAM_FINA, ancho: an * 4, alto: al * 4 };
      const url = plantillaUrl.replace(/\{(\w+)\}/g, (_, k) => String(vals[k]));
      const t = await leerTiff(await descargar(url, `${carpeta}/wcs/${ventana.col0 + c0}_${ventana.fila0 + f0}.tif`, fetchFn));
      const [x0, y0, x1, y1] = t.bbox, dx = (x1 - x0) / t.ancho, dy = (y1 - y0) / t.alto;
      for (let py = 0; py < t.alto; py++) for (let qx = 0; qx < t.ancho; qx++) acumularPunto(acc, ventana, x0 + (qx + 0.5) * dx, y1 - (py + 0.5) * dy, t.valores[py * t.ancho + qx], TAM_FINA, { ceroSinDato: true });
    }
  } else {
    // Teselas GLO-30 de 1°: nombre con la esquina suroeste, p. ej. N40_00_W004_00.
    const nombre = (v, pos, neg, n) => `${v >= 0 ? pos : neg}${String(Math.abs(v)).padStart(n, '0')}_00`;
    const no = aGrados(ventana.col0 * TAM_FINA - ORIGEN, ORIGEN - ventana.fila0 * TAM_FINA);
    const se = aGrados((ventana.col0 + ventana.ancho) * TAM_FINA - ORIGEN, ORIGEN - (ventana.fila0 + ventana.alto) * TAM_FINA);
    for (let lat = Math.floor(se.lat); lat <= Math.floor(no.lat); lat++) for (let lon = Math.floor(no.lon); lon <= Math.floor(se.lon); lon++) {
      const url = plantillaUrl.replaceAll('{lat}', nombre(lat, 'N', 'S', 2)).replaceAll('{lon}', nombre(lon, 'E', 'W', 3));
      const t = await leerTiff(await descargar(url, `${carpeta}/glo30/${lat}_${lon}.tif`, fetchFn));
      const [x0, y0, x1, y1] = t.bbox, dx = (x1 - x0) / t.ancho, dy = (y1 - y0) / t.alto;
      for (let py = 0; py < t.alto; py++) for (let qx = 0; qx < t.ancho; qx++) {
        const m = aMercator(x0 + (qx + 0.5) * dx, y1 - (py + 0.5) * dy);
        acumularPunto(acc, ventana, m.x, m.y, t.valores[py * t.ancho + qx]);
      }
    }
  }
  return mediasDe(acc);
}

export async function leerAltitudes(ventana, conf, opciones = {}) {
  if (conf.fuente === 'terrarium') return altitudesTerrarium(ventana, { z: conf.z ?? 12, ...opciones });
  if (conf.fuente === 'ign-wcs' || conf.fuente === 'glo30') return altitudesGeoTiff(ventana, { fuente: conf.fuente, plantillaUrl: conf.plantillaUrl, ...opciones });
  throw new Error(`MDT desconocido: ${conf.fuente}`);
}

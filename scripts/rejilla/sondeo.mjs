// scripts/rejilla/sondeo.mjs
// Sondeo de la tarea 0: comprueba en vivo qué responde, cuánto tarda y cuánto pesa. No guarda nada en el repo.
// Uso: node scripts/rejilla/sondeo.mjs > _fuentes/sondeo.md   (se copia lo relevante al informe 08)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DIARIAS, HORARIAS } from '../../js/meteo.js';

const ZONA = 'Europe/Madrid';
const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;

// Puntos repartidos de forma determinista por los bbox de las zonas.
export function puntosDePrueba(zs, n) {
  const r = [];
  for (let k = 0; r.length < n; k++) {
    const z = zs[k % zs.length], t = (k * 0.618034) % 1, u = (k * 0.414214) % 1;
    r.push({ lat: +(z.bbox[1] + t * (z.bbox[3] - z.bbox[1])).toFixed(3), lon: +(z.bbox[0] + u * (z.bbox[2] - z.bbox[0])).toFixed(3), altitud: 1000 });
  }
  return r;
}
const lista = (ps, k) => ps.map((p) => p[k]).join(',');
const principal = (ps, pasados, futuros = 10) => `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
  latitude: lista(ps, 'lat'), longitude: lista(ps, 'lon'), elevation: lista(ps, 'altitud'), timezone: ZONA,
  daily: DIARIAS.join(','), hourly: HORARIAS.join(','), past_days: pasados, forecast_days: futuros })}`;
const archivoSuelo = (ps, desde, hasta) => `https://archive-api.open-meteo.com/v1/archive?${new URLSearchParams({
  latitude: lista(ps, 'lat'), longitude: lista(ps, 'lon'), elevation: lista(ps, 'altitud'), timezone: ZONA,
  daily: 'soil_moisture_0_to_7cm_mean', start_date: desde, end_date: hasta })}`;
const tesela = (lon, lat, z) => {
  const n = 2 ** z, x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
  return { x, y };
};

async function medir(nombre, url, { metodo = 'GET', leer = null } = {}) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { method: metodo, signal: AbortSignal.timeout(90000) });
    const cuerpo = metodo === 'HEAD' ? '' : await r.text();
    return { nombre, estado: r.status, ms: Math.round(performance.now() - t0), bytes: Number(r.headers.get('content-length')) || cuerpo.length,
      tipo: r.headers.get('content-type') ?? '', urlLen: url.length, extra: leer ? leer(cuerpo, r) : '' };
  } catch (e) {
    return { nombre, estado: 'error', ms: Math.round(performance.now() - t0), bytes: 0, tipo: '', urlLen: url.length, extra: e.message };
  }
}
const cuantos = (t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? `${j.length} ubicaciones` : j.error ? `error: ${j.reason}` : '1 ubicación'; } catch { return ''; } };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const filas = [];
  for (const n of [50, 100, 200, 500]) filas.push(await medir(`Open-Meteo forecast, ${n} puntos, 2+10 días`, principal(puntosDePrueba(zonas, n), 2), { leer: cuantos }));
  const uno = puntosDePrueba(zonas, 1);
  for (const p of [61, 92, 93]) filas.push(await medir(`Open-Meteo forecast, 1 punto, past_days=${p}`, principal(uno, p), { leer: cuantos }));
  filas.push(await medir('Open-Meteo archivo, 50 puntos, suelo 122 días', archivoSuelo(puntosDePrueba(zonas, 50), '2025-09-01', '2025-12-31'), { leer: cuantos }));
  const t = tesela(-3.9943, 40.853, 12);
  filas.push(await medir('Terrarium z12 (Valsaín)', `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/${t.x}/${t.y}.png`));
  filas.push(await medir('Copernicus GLO-30 N40 W004 (HEAD)', 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N40_00_W004_00_DEM/Copernicus_DSM_COG_10_N40_00_W004_00_DEM.tif', { metodo: 'HEAD' }));
  filas.push(await medir('IGN WCS mdt GetCapabilities', 'https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&REQUEST=GetCapabilities',
    { leer: (c) => [...c.matchAll(/<wcs:CoverageId>([^<]+)<\/wcs:CoverageId>/g)].map((m) => m[1]).join(', ').slice(0, 300) }));
  filas.push(await medir('IDEE mdt Relieve z16 (WMTS)', `https://servicios.idee.es/wmts/mdt?service=WMTS&request=GetTile&version=1.0.0&layer=Relieve&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&tilematrix=16&tilerow=${tesela(-3.9943, 40.853, 16).y}&tilecol=${tesela(-3.9943, 40.853, 16).x}`));
  filas.push(await medir('CARTO Voyager z12', `https://a.basemaps.cartocdn.com/rastertiles/voyager/12/${t.x}/${t.y}.png`));
  console.log('| Prueba | Estado | ms | Bytes | Tipo | Long. URL | Detalle |\n|---|---|---|---|---|---|---|');
  for (const f of filas) console.log(`| ${f.nombre} | ${f.estado} | ${f.ms} | ${f.bytes} | ${f.tipo} | ${f.urlLen} | ${String(f.extra).replace(/\|/g, '/')} |`);
}

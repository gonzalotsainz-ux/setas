// Elige estaciones AEMET por zona. El inventario se pide a la Edge Function (?inventario=1): la clave de AEMET
// solo vive en Supabase.
//   node scripts/estaciones-aemet.mjs propuestas [N=6]      → candidatas por zona (< 30 km y < 400 m de desnivel)
//   node scripts/estaciones-aemet.mjs sonda ID,ID,…         → qué días recientes tiene cada estación (hay que tenerlas
//                                                              en supabase/functions/aemet/estaciones.json)
//   node scripts/estaciones-aemet.mjs aplicar zona=ID,ID …  → escribe data/zonas.json (con lat/lon de cada estación, para elegir la
//                                                              más cercana a cada punto) y la lista blanca de la función
import { readFileSync, writeFileSync } from 'node:fs';

const RAIZ = new URL('../', import.meta.url);
const SUPABASE_URL = 'https://ctgedeunquvmcfqsufjj.supabase.co';
const ANON = readFileSync(new URL('js/supabase.js', RAIZ), 'utf8').match(/SUPABASE_ANON = '([^']+)'/)[1];
const FUNCION = `${SUPABASE_URL}/functions/v1/aemet`;
const MAX_KM = 30, MAX_DESNIVEL = 400;

const grados = (t) => { const m = t.match(/^(\d{2})(\d{2})(\d{2})([NSEW])$/); const v = +m[1] + m[2] / 60 + m[3] / 3600; return 'SW'.includes(m[4]) ? -v : v; };
const km = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;

async function llamar(qs) {
  const r = await fetch(`${FUNCION}?${qs}`, { headers: { apikey: ANON } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
const leerZonas = () => JSON.parse(readFileSync(new URL('data/zonas.json', RAIZ), 'utf8'));

async function inventario() {
  return (await llamar('inventario=1')).map((e) => ({ id: e.indicativo, nombre: e.nombre, provincia: e.provincia,
    altitud: Number(e.altitud), lat: grados(e.latitud), lon: grados(e.longitud) })).filter((e) => Number.isFinite(e.altitud));
}

const [, , modo, ...args] = process.argv;

if (modo === 'propuestas') {
  const n = Number(args[0] ?? 6);
  const inv = await inventario();
  const salida = {};
  for (const z of leerZonas().zonas) {
    const c = { lat: media(z.puntos.map((p) => p.lat)), lon: media(z.puntos.map((p) => p.lon)) };
    const alt = media(z.puntos.map((p) => p.altitud));
    salida[z.id] = inv.map((e) => ({ ...e, distanciaKm: Math.round(km(c, e) * 10) / 10, desnivel: Math.round(e.altitud - alt) }))
      .filter((e) => e.distanciaKm < MAX_KM && Math.abs(e.desnivel) < MAX_DESNIVEL)
      .sort((a, b) => a.distanciaKm - b.distanciaKm).slice(0, n)
      .map(({ id, nombre, provincia, altitud, distanciaKm, desnivel }) => ({ id, nombre, provincia, altitud, distanciaKm, desnivel }));
  }
  console.log(JSON.stringify(salida, null, 1));
} else if (modo === 'sonda') {
  const hoy = new Date(), iso = (d) => d.toISOString().slice(0, 10);
  const hasta = iso(hoy), desde = iso(new Date(hoy - 29 * 864e5));
  for (const id of args[0].split(',')) {
    try {
      const d = (await llamar(new URLSearchParams({ estaciones: id, desde, hasta }).toString()))[id] ?? {};
      const dias = Object.keys(d).sort(), conP = dias.filter((f) => d[f] != null);
      console.log(`${id}: ${dias.length} días, ${conP.length} con lluvia, último ${dias.at(-1) ?? '—'}, último con lluvia ${conP.at(-1) ?? '—'}`);
    } catch (e) { console.log(`${id}: ${e.message}`); }
  }
} else if (modo === 'aplicar') {
  const elegidas = Object.fromEntries(args.map((a) => a.split('=')).map(([z, ids]) => [z, ids.split(',').filter(Boolean)]));
  const inv = Object.fromEntries((await inventario()).map((e) => [e.id, e]));
  const datos = leerZonas();
  const todas = new Set();
  for (const z of datos.zonas) {
    const c = { lat: media(z.puntos.map((p) => p.lat)), lon: media(z.puntos.map((p) => p.lon)) };
    z.estacionesAemet = (elegidas[z.id] ?? []).map((id) => {
      const e = inv[id]; if (!e) throw new Error(`${id} no está en el inventario`);
      todas.add(id);
      return { id, nombre: e.nombre.replace(/\b(\p{L})(\p{L}*)/gu, (_, a, b) => a + b.toLowerCase()).replace(/ (Del|De|Las|La|Los|El|Y)(?= )/g, (m) => m.toLowerCase()), altitud: e.altitud, distanciaKm: Math.round(km(c, e) * 10) / 10, lat: Math.round(e.lat * 1e4) / 1e4, lon: Math.round(e.lon * 1e4) / 1e4 };
    });
  }
  writeFileSync(new URL('data/zonas.json', RAIZ), `${JSON.stringify(datos, null, 2)}\n`);
  writeFileSync(new URL('supabase/functions/aemet/estaciones.json', RAIZ), `${JSON.stringify([...todas].sort())}\n`);
  console.log(`escritas ${todas.size} estaciones`);
} else {
  console.error('uso: propuestas [N] | sonda ID,ID | aplicar zona=ID,ID …'); process.exit(1);
}

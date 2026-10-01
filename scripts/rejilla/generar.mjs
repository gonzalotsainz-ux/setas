// scripts/rejilla/generar.mjs
// Genera la rejilla fina estática (data/rejilla/) desde el MFE50, el MDT y las zonas prohibidas de data/cotos.geojson.
// Uso (en local, nunca en el navegador): node scripts/rejilla/recortar-mfe.mjs && node scripts/rejilla/generar.mjs
// (o una sola zona con --zona <id> y luego --unir). Necesita las descargas de la tarea 0 en _fuentes/.
// Apunta en la consola el tamaño de cada archivo y las celdas por hábitat (docs/datos.md).
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HABITATS, puntoEnGeometria } from '../validar-datos.mjs';
import { ventanaBbox, centroFina, aGrados, idGruesa, centroGruesa, metrosSuelo, bboxDe, TAM_FINA, ORIGEN, ANCLA } from '../../js/rejilla/geo.js';
import { codificarRejilla, PROHIBIDO } from '../../js/rejilla/formato.js';
import { orientacionPendiente } from './terreno.mjs';
import { habitatDeTesela, leerTeselaMfe } from './mfe-habitat.mjs';
import { leerAltitudes } from './mdt.mjs';
import { CONFIG } from './config.mjs';
import { rutaRecorte } from './recortar-mfe.mjs';

// Cubos de `paso` grados con las geometrías cuyo bbox los toca; buscar() prueba solo las de su cubo.
// Por defecto, features GeoJSON; `bbox` y `contiene` permiten otra forma de guardar la geometría (ver teselasCompactas).
export function indiceEspacial(features, paso = 0.02, { bbox = (f) => bboxDe(f.geometry), contiene = (lon, lat, f) => puntoEnGeometria(lon, lat, f.geometry) } = {}) {
  const cubos = new Map(), clave = (i, j) => `${i}:${j}`;
  features.forEach((f, n) => {
    const [o, s, e, no] = bbox(f);
    for (let i = Math.floor(o / paso); i <= Math.floor(e / paso); i++) for (let j = Math.floor(s / paso); j <= Math.floor(no / paso); j++) {
      const k = clave(i, j);
      if (!cubos.has(k)) cubos.set(k, []);
      cubos.get(k).push(n);
    }
  });
  return {
    buscar(lon, lat) {
      for (const n of cubos.get(clave(Math.floor(lon / paso), Math.floor(lat / paso))) ?? []) if (contiene(lon, lat, features[n])) return features[n];
      return null;
    },
  };
}

// Geometría compacta: lista de polígonos, cada uno [exterior, ...huecos] con los anillos en Float64Array [x0, y0, x1, y1, …].
// Ocupa unas 3 veces menos que los arrays de GeoJSON; el MFE50 de Álava no cabe holgado en memoria de otro modo.
export function compactar(g) {
  const poligonos = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  let o = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const anillos = poligonos.map((p) => p.map((a) => {
    const r = new Float64Array(a.length * 2);
    a.forEach(([x, y], i) => { r[2 * i] = x; r[2 * i + 1] = y; if (x < o) o = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; });
    return r;
  }));
  return { poligonos: anillos, bbox: [o, s, e, n] };
}
const enAnilloCompacto = (lon, lat, r) => {
  let dentro = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};
export const puntoEnCompacta = (lon, lat, { poligonos }) =>
  poligonos.some(([exterior, ...huecos]) => enAnilloCompacto(lon, lat, exterior) && !huecos.some((h) => enAnilloCompacto(lon, lat, h)));

// Lee un GeoJSON de mapshaper (una feature por línea) sin cargar el texto entero: cada feature pasa por `convertir`
// y se suelta. Devuelve lo que devuelva `convertir` (null = se descarta).
export async function leerFeaturesPorLineas(ruta, convertir) {
  const { createReadStream } = await import('node:fs');
  const { createInterface } = await import('node:readline');
  const r = [];
  for await (const linea of createInterface({ input: createReadStream(ruta, 'utf8'), crlfDelay: Infinity })) {
    const t = linea.trim().replace(/,$/, '');
    if (!t.startsWith('{"type":"Feature"')) continue;
    const x = convertir(JSON.parse(t));
    if (x) r.push(x);
  }
  return r;
}

// Latitud del centro de una fila fina global.
const latDeFila = (fila) => aGrados(0, ORIGEN - (fila + 0.5) * TAM_FINA).lat;

// Planos de una zona. mfeEn(lon, lat, altitud) → hábitat o null; prohibidoEn(lon, lat) → booleano.
// Prohibido (criterio conservador): si el centro o cualquiera de las 4 esquinas de la celda cae en un polígono
// prohibido; hábitat 0 con la marca, nunca mancha. Sin monte: todo a 0 (también terreno y altitud, para que comprima).
export function construirZona({ zona, ventana, altitudes, mfeEn, prohibidoEn }) {
  const { col0, fila0, ancho, alto } = ventana, n = ancho * alto;
  const habitat = new Uint8Array(n), terreno = new Uint8Array(n), altitud = new Int16Array(n);
  const { orientacion, tramo } = orientacionPendiente(altitudes, ancho, alto, (f) => metrosSuelo(TAM_FINA, latDeFila(fila0 + f)));
  // Esquinas: (alto + 1) × (ancho + 1) puntos compartidos entre celdas vecinas.
  const esquinas = new Uint8Array((alto + 1) * (ancho + 1));
  for (let f = 0; f <= alto; f++) for (let c = 0; c <= ancho; c++) {
    const p = aGrados((col0 + c) * TAM_FINA - ORIGEN, ORIGEN - (fila0 + f) * TAM_FINA);
    esquinas[f * (ancho + 1) + c] = prohibidoEn(p.lon, p.lat) ? 1 : 0;
  }
  const esquinaProhibida = (c, f) => esquinas[f * (ancho + 1) + c] || esquinas[f * (ancho + 1) + c + 1]
    || esquinas[(f + 1) * (ancho + 1) + c] || esquinas[(f + 1) * (ancho + 1) + c + 1];
  for (let f = 0; f < alto; f++) for (let c = 0; c < ancho; c++) {
    const k = f * ancho + c;
    const { x, y } = centroFina(col0 + c, fila0 + f);
    const p = aGrados(x, y);
    if (esquinaProhibida(c, f) || prohibidoEn(p.lon, p.lat)) { habitat[k] = PROHIBIDO; continue; }
    const alt = altitudes[k];
    if (!Number.isFinite(alt)) continue;
    const h = mfeEn(p.lon, p.lat, alt);
    const codigo = h ? HABITATS.indexOf(h) + 1 : 0;
    if (!codigo) continue;
    habitat[k] = codigo;
    terreno[k] = orientacion[k] | (tramo[k] << 4);
    altitud[k] = Math.round(alt);
  }
  return { habitat, terreno, altitud };
}

export function gruesasDeZona(zona, ventana, planos, paso) {
  const acc = new Map();
  for (let f = 0; f < ventana.alto; f++) for (let c = 0; c < ventana.ancho; c++) {
    const k = f * ventana.ancho + c, h = planos.habitat[k];
    if (h === 0 || h & PROHIBIDO) continue;
    const { x, y } = centroFina(ventana.col0 + c, ventana.fila0 + f), p = aGrados(x, y);
    const id = idGruesa(zona.id, p.lon, p.lat, paso);
    const g = acc.get(id) ?? { suma: 0, n: 0, habitats: new Set() };
    g.suma += planos.altitud[k]; g.n++; g.habitats.add(HABITATS[h - 1]);
    acc.set(id, g);
  }
  return [...acc].map(([id, g]) => {
    const { lon, lat } = centroGruesa(id, paso);
    return { id, zona: zona.id, lon: Math.round(lon * 1e4) / 1e4, lat: Math.round(lat * 1e4) / 1e4, altRef: Math.round(g.suma / g.n), habitats: [...g.habitats].sort(), nFinas: g.n };
  }).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function elegirPaso(contar, candidatos, maximo) {
  for (const p of candidatos) if (contar(p) <= maximo) return p;
  return candidatos.at(-1);
}

export async function partirEnBandas(cabecera, planos, maxBytes) {
  const { ancho, alto } = cabecera;
  for (let intento = 1; intento <= alto; intento++) {
    const altoBanda = Math.ceil(alto / intento), partes = Math.ceil(alto / altoBanda), r = [];
    for (let p = 0; p < partes; p++) {
      const f0 = p * altoBanda, f1 = Math.min(alto, f0 + altoBanda);
      const corte = (a) => a.slice(f0 * ancho, f1 * ancho);
      const cab = partes === 1 ? cabecera : { ...cabecera, fila0: cabecera.fila0 + f0, alto: f1 - f0, parte: p + 1, partes };
      const bytes = await codificarRejilla(cab, { habitat: corte(planos.habitat), terreno: corte(planos.terreno), altitud: corte(planos.altitud) });
      if (bytes.length > maxBytes) break;
      r.push({ archivo: partes === 1 ? `${cabecera.zona}.bin` : `${cabecera.zona}-${p + 1}.bin`, cabecera: cab, bytes });
    }
    if (r.length === partes) return r;
  }
  throw new Error(`${cabecera.zona}: ni fila a fila cabe en ${maxBytes} bytes`);
}

// --- Ejecución -------------------------------------------------------------------------------------------------
// Sin argumentos: una zona por proceso (`--zona <id>`, uno detrás de otro y con un tope de memoria de Node, para que un
// exceso sea un error de Node y no deje la máquina sin memoria) y al final `--unir`, que junta indice.json y gruesa.json.
// Cada zona deja sus .bin en data/rejilla/ y su resumen (archivos y celdas gruesas de cada paso candidato) en
// _fuentes/rejilla/<zona>.json. Necesita los recortes de scripts/rejilla/recortar-mfe.mjs.
const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
const RESUMENES = '_fuentes/rejilla';
const MEMORIA_ZONA = '--max-old-space-size=3072';
const fuentesDe = () => ({ mfe: { nombre: CONFIG.mfe.nombre, url: CONFIG.mfe.url, fecha: CONFIG.mfe.fecha }, mdt: { nombre: CONFIG.mdt.nombre, url: CONFIG.mdt.url, fecha: CONFIG.mdt.fecha } });
const hoy = () => new Date().toISOString().slice(0, 10);

async function generarZona(id) {
  const zona = leer('data/zonas.json').zonas.find((z) => z.id === id);
  if (!zona) throw new Error(`zona desconocida: ${id}`);
  const t0 = Date.now();
  const prohibidos = indiceEspacial(leer('data/cotos.geojson').features.filter((f) => f.properties.tipo === 'prohibido'));
  const diccionario = leer('scripts/rejilla/mfe-diccionario.json');
  const habitatsConIndice = new Set(leer('data/especies.json').especies.filter((s) => s.indice).flatMap((s) => s.habitats));
  const confMfe = { ...CONFIG.mfe, habitatsConIndice };
  const ventana = ventanaBbox(zona.bbox);
  // Cada tesela se queda solo con su geometría compacta y sus atributos ya normalizados.
  const teselas = [];
  for (const p of zona.provincias) {
    const ruta = rutaRecorte(zona.id, p);
    if (!existsSync(ruta)) throw new Error(`falta ${ruta}: ejecuta antes node scripts/rejilla/recortar-mfe.mjs`);
    teselas.push(...await leerFeaturesPorLineas(ruta, (f) => (f.geometry ? { ...compactar(f.geometry), tesela: leerTeselaMfe(f.properties, CONFIG.mfe, diccionario) } : null)));
  }
  const mfe = indiceEspacial(teselas, 0.02, { bbox: (f) => f.bbox, contiene: (lon, lat, f) => puntoEnCompacta(lon, lat, f) });
  const altitudes = await leerAltitudes(ventana, CONFIG.mdt);
  const planos = construirZona({ zona, ventana, altitudes,
    mfeEn: (lon, lat, alt) => { const f = mfe.buscar(lon, lat); return f ? habitatDeTesela(f.tesela, alt, confMfe) : null; },
    prohibidoEn: (lon, lat) => !!prohibidos.buscar(lon, lat) });
  mkdirSync('data/rejilla', { recursive: true });
  const suyo = new RegExp(`^${id}(-\\d+)?\\.bin$`);
  for (const f of readdirSync('data/rejilla')) if (suyo.test(f)) unlinkSync(`data/rejilla/${f}`);   // sin restos de bandas viejas
  const cabecera = { version: 1, zona: zona.id, tam: TAM_FINA, ...ventana, habitats: HABITATS, fuentes: fuentesDe(), generado: hoy() };
  const archivos = [];
  for (const b of await partirEnBandas(cabecera, planos, CONFIG.maxBytesArchivo)) {
    writeFileSync(`data/rejilla/${b.archivo}`, b.bytes);
    const { col0, fila0, ancho, alto } = b.cabecera;
    archivos.push({ zona: zona.id, archivo: b.archivo, col0, fila0, ancho, alto, bytes: b.bytes.length });
  }
  const porHabitat = {};
  for (const h of planos.habitat) if (h && !(h & PROHIBIDO)) porHabitat[HABITATS[h - 1]] = (porHabitat[HABITATS[h - 1]] ?? 0) + 1;
  const resumen = { celdas: ventana.ancho * ventana.alto, conMonte: Object.values(porHabitat).reduce((a, b) => a + b, 0),
    prohibidas: planos.habitat.filter((h) => h & PROHIBIDO).length, sinAltitud: altitudes.filter((a) => !Number.isFinite(a)).length,
    porHabitat: Object.fromEntries(Object.entries(porHabitat).sort((a, b) => b[1] - a[1])) };
  const gruesas = Object.fromEntries(CONFIG.gruesa.candidatos.map((paso) => [paso, gruesasDeZona(zona, ventana, planos, paso)]));
  mkdirSync(RESUMENES, { recursive: true });
  writeFileSync(`${RESUMENES}/${id}.json`, JSON.stringify({ zona: id, archivos, resumen, gruesas }));
  console.log(`${id}: ${ventana.ancho} × ${ventana.alto} celdas, ${resumen.conMonte} con monte, ${resumen.prohibidas} prohibidas, ${resumen.sinAltitud} sin altitud (${Math.round((Date.now() - t0) / 1000)} s, ${Math.round(process.memoryUsage().rss / 2 ** 20)} MB)`);
  console.log(`  ${Object.entries(resumen.porHabitat).map(([h, c]) => `${h} ${c}`).join(', ')}`);
  console.log(`  ${archivos.map((a) => `${a.archivo} ${Math.round(a.bytes / 1024)} KB`).join(', ')}`);
}

function unir() {
  const zonas = leer('data/zonas.json').zonas;
  const res = zonas.map((z) => {
    const ruta = `${RESUMENES}/${z.id}.json`;
    if (!existsSync(ruta)) throw new Error(`falta ${ruta}: genera antes la zona ${z.id}`);
    return leer(ruta);
  });
  const contar = (paso) => res.reduce((t, r) => t + r.gruesas[paso].length, 0);
  const paso = elegirPaso(contar, CONFIG.gruesa.candidatos, CONFIG.gruesa.maximo);
  const generado = hoy(), fuentes = fuentesDe(), archivos = res.flatMap((r) => r.archivos);
  const celdas = res.flatMap((r) => r.gruesas[paso]);
  const gruesa = { version: 1, generado, ancla: ANCLA, pasos: Object.fromEntries(zonas.map((z) => [z.id, paso])), celdas };
  const texto = `${JSON.stringify(gruesa)}\n`;
  mkdirSync('supabase/functions/rejilla', { recursive: true });
  writeFileSync('data/rejilla/gruesa.json', texto);
  writeFileSync('supabase/functions/rejilla/gruesa.json', texto);   // la Edge Function la importa (mismo patrón que aemet/estaciones.json)
  writeFileSync('data/rejilla/indice.json', `${JSON.stringify({ version: 1, generado, tam: TAM_FINA, fuentes, archivos }, null, 1)}\n`);
  console.log(`\nCeldas gruesas: ${celdas.length} con paso ${paso}° (candidatos: ${CONFIG.gruesa.candidatos.map((p) => `${p}° → ${contar(p)}`).join(', ')})`);
  console.log('\n| Zona | Celdas | Con monte | Prohibidas | Gruesas |\n|---|---|---|---|---|');
  for (const r of res) console.log(`| ${r.zona} | ${r.resumen.celdas} | ${r.resumen.conMonte} | ${r.resumen.prohibidas} | ${r.gruesas[paso].length} |`);
  console.log('\n| Archivo | Celdas | KB |\n|---|---|---|');
  for (const a of archivos) console.log(`| ${a.archivo} | ${a.ancho} × ${a.alto} | ${Math.round(a.bytes / 1024)} |`);
}

async function main(args) {
  const z = args.indexOf('--zona');
  if (z >= 0) return generarZona(args[z + 1]);
  if (args.includes('--unir')) return unir();
  const { spawnSync } = await import('node:child_process');
  for (const zona of leer('data/zonas.json').zonas) {
    const r = spawnSync(process.execPath, [MEMORIA_ZONA, fileURLToPath(import.meta.url), '--zona', zona.id], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`la zona ${zona.id} falló (código ${r.status ?? r.signal}); se para aquí`);
  }
  unir();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));

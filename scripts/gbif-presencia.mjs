// Cuenta registros GBIF con coordenadas de cada especie dentro del bbox de cada zona y marca la presencia.
// ≥ 3 registros → confirmada; 1–2 → orientativa; 0 → orientativa si el hábitat encaja, si no sin-registros.
// Solo se cuenta si GBIF devuelve coincidencia EXACTA a rango especie; si no, se registra y no se confirma nada.
import { readFileSync, writeFileSync } from 'node:fs';
const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;
const datos = JSON.parse(readFileSync('data/especies.json', 'utf8'));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hoy = new Date().toISOString().slice(0, 10);

async function pedir(url) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await esperar(1000 * 2 ** i); continue; }
    throw new Error(`${r.status} ${url}`);
  }
  throw new Error(`reintentos agotados ${url}`);
}
async function clave(nombre) {
  return pedir(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(nombre)}&kingdom=Fungi`);
}
const wkt = ([a, b, c, d]) => `POLYGON((${a} ${b},${c} ${b},${c} ${d},${a} ${d},${a} ${b}))`;
const raros = [];

for (const e of datos.especies.filter((x) => x.categoria.startsWith('comestible'))) {
  // Candidatos de búsqueda: binomio del nombre y sinónimos con género completo (p. ej. Collybia nuda -> Lepista nuda).
  const binomio = (t) => /^[A-Z][a-z]+ [a-z]+/.exec(t)?.[0];
  const candidatos = [...new Set([e.nombre, ...e.sinonimos].map(binomio).filter((t) => t && !/ spp$/.test(t)))];
  let m = {};
  let taxonBuscado = null;
  for (const c of candidatos) {
    m = await clave(c);
    if (m.matchType === 'EXACT' && m.rank === 'SPECIES') {
      if (c !== binomio(e.nombre)) taxonBuscado = c;
      if (c !== binomio(e.nombre)) raros.push(`${e.id}: se busca por el sinónimo ${c} -> ${m.scientificName}`);
      break;
    }
  }
  const k = m.usageKey ?? null;
  if (!k || m.matchType !== 'EXACT' || m.rank !== 'SPECIES') {
    raros.push(`${e.id}: match ${m.matchType}/${m.rank}/${m.status} -> ${m.scientificName ?? '-'} (no se cuenta)`);
    console.warn(`match dudoso, se omite: ${e.nombre} -> ${m.matchType} ${m.rank} ${m.scientificName}`);
    continue;
  }
  if (m.status !== 'ACCEPTED') raros.push(`${e.id}: GBIF lo trata como ${m.status} -> ${m.species ?? m.scientificName}`);
  for (const z of zonas) {
    const q = new URLSearchParams({ taxonKey: k, geometry: wkt(z.bbox), hasCoordinate: 'true', occurrenceStatus: 'PRESENT', country: 'ES' });
    const n = (await pedir(`https://api.gbif.org/v1/occurrence/search?${q}&limit=0`)).count;
    const encaja = e.habitats.some((h) => z.habitats.includes(h));
    const presencia = n >= 3 ? 'confirmada' : n > 0 || encaja ? 'orientativa' : 'sin-registros';
    const previo = e.zonas[z.id];
    if (presencia === 'sin-registros' && !previo) { await esperar(150); continue; }
    const nuevo = { ...previo, presencia, gbif: n, fuente: `https://www.gbif.org/occurrence/search?${q}`, consultado: hoy };
    if (taxonBuscado) nuevo.taxonGbif = taxonBuscado; else delete nuevo.taxonGbif;
    if (e.id === "lactarius-sanguifluus") nuevo.nota = "Recuento GBIF solo de L. sanguifluus; el grupo incluye L. semisanguifluus y L. vinosus";
    if (previo?.fuente && !previo.fuente.startsWith('http')) nuevo.fuenteInvestigacion = previo.fuenteInvestigacion ?? previo.fuente;
    e.zonas[z.id] = nuevo;
    await esperar(150);
  }
  console.log(e.id, Object.entries(e.zonas).map(([z, v]) => `${z}:${v.gbif}`).join(' '));
}
writeFileSync('data/especies.json', JSON.stringify(datos, null, 2) + '\n');
console.log('\nCASOS RAROS DE MATCH');
raros.forEach((r) => console.log(r));

// Descarga de 1 a 3 fotos con licencia libre por especie (iNaturalist en España → Wikimedia Commons de reserva).
// Uso: node scripts/fotos.mjs [--faltan]   (--faltan salta las especies que ya tienen fotos)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { licenciaPermitida } from './validar-datos.mjs';

const datos = JSON.parse(readFileSync('data/especies.json', 'utf8'));
mkdirSync('img/especies', { recursive: true });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const LIC = { 'cc0': 'CC0', 'cc-by': 'CC BY 4.0', 'cc-by-sa': 'CC BY-SA 4.0' };
const soloFaltan = process.argv.includes('--faltan');
const UA = { 'User-Agent': 'setas-app/1.0 (uso personal)' };
// Fichas de género: se fotografía una especie representativa del propio género.
const REPRESENTANTE = {
  // T. flavovirens y T. equestre son el mismo taxón en iNaturalist
  'tricholoma-flavovirens': ['Tricholoma equestre'],
  morchella: ['Morchella esculenta'], helvella: ['Helvella crispa', 'Helvella lacunosa'], scleroderma: ['Scleroderma citrinum'] };

async function json(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: UA }); if (r.ok) return await r.json(); } catch {}
    await esperar(3000);
  }
  return {};
}

async function inat(nombre, mundo = false) {
  const q = new URLSearchParams({ taxon_name: nombre, photo_license: 'cc-by,cc-by-sa,cc0', quality_grade: 'research',
    order_by: 'votes', per_page: '10' });
  if (!mundo) q.set('place_id', '6774');   // España; con mundo=true se busca en todo el mundo
  const r = await json(`https://api.inaturalist.org/v1/observations?${q}`);
  await esperar(1100);   // menos de 60 peticiones por minuto a iNaturalist
  const fotos = [];
  for (const o of r.results ?? []) for (const p of o.photos ?? []) {
    // iNaturalist puede devolver observaciones de otro taxón: exige que coincida con el nombre buscado
    if (!coincide(o.taxon?.name, nombre)) continue;
    const lic = LIC[p.license_code];
    if (lic && fotos.length < 3 && !fotos.some((f) => f.obs === o.id))
      fotos.push({ src: p.url.replace('square', 'large'), autor: p.attribution, licencia: lic, url: `https://www.inaturalist.org/observations/${o.id}`, obs: o.id });
  }
  return fotos;
}

async function commons(nombre) {
  const q = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${nombre} filetype:bitmap`, gsrnamespace: '6',
    gsrlimit: '5', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1200', format: 'json', origin: '*' });
  const r = await json(`https://commons.wikimedia.org/w/api.php?${q}`);
  const binomio = nombre.split(' ').slice(0, 2).join('_').toLowerCase();
  const MALO = /spore|spores|microscop|drawing|illustration|plate|map|cooked|dish|recipe|table|lamina|tafel|icon|flora/i;
  return Object.values(r.query?.pages ?? {}).filter((p) => p.title.replace(/ /g, '_').toLowerCase().includes(binomio) && !MALO.test(p.title))
    .map((p) => p.imageinfo?.[0]).filter(Boolean).map((ii) => ({
    src: ii.thumburl, licencia: ii.extmetadata?.LicenseShortName?.value?.replace(/^Public domain$/i, 'PD'),
    autor: (ii.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim(), url: ii.descriptionurl,
  })).filter((f) => licenciaPermitida(f.licencia) && f.autor).slice(0, 3);
}

const coincide = (taxon, n) => !!taxon && (taxon === n || taxon.startsWith(n + ' ') || (n.split(' ').length === 1 && taxon.startsWith(n + ' ')));
async function descargar(src) {
  for (let i = 1; i <= 6; i++) {
    const r = await fetch(src, { headers: UA });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    await esperar(2000 * i);   // Wikimedia limita el ritmo (429)
  }
  throw new Error('descarga fallida');
}

const limpio = (n) => { const w = n.replace(/\s+spp?\.$/, '').trim().split(/\s+/); return /^[a-z-]+$/.test(w[1] ?? '') ? w.slice(0, 2).join(' ') : w[0]; };

for (const e of datos.especies) {
  if (soloFaltan && e.fotos?.length) continue;
  const nombres = REPRESENTANTE[e.id] ?? [limpio(e.nombre), ...(e.sinonimos ?? []).map((s) => limpio(typeof s === 'string' ? s : s.nombre ?? ''))].filter(Boolean);
  let fotos = [], usado = '';
  for (const n of nombres) { fotos = await inat(n); if (fotos.length) { usado = `iNaturalist: ${n}`; break; } }
  if (!fotos.length) for (const n of nombres) { fotos = await commons(n); if (fotos.length) { usado = `Commons: ${n}`; break; } }
  if (!fotos.length) for (const n of nombres) { fotos = await inat(n, true); if (fotos.length) { usado = `iNaturalist (mundo): ${n}`; break; } }
  e.fotos = [];
  for (const [k, f] of fotos.entries()) {
    const archivo = `img/especies/${e.id}-${k + 1}.webp`;
    try {
      const buf = await descargar(f.src);
      await sharp(buf).resize({ width: 1100, withoutEnlargement: true }).webp({ quality: 70 }).toFile(archivo);
      e.fotos.push({ archivo, autor: f.autor, licencia: f.licencia, url: f.url });
      await esperar(700);
    } catch (err) { console.log(`  ${e.id}: fallo al descargar ${f.src}`); }
  }
  console.log(`${e.id}: ${e.fotos.length} foto(s) [${usado}]`);
}
writeFileSync('data/especies.json', JSON.stringify(datos, null, 2) + '\n');

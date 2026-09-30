// Descarga de 1 a 3 fotos con licencia libre por especie (iNaturalist en España → Wikimedia Commons de reserva).
//
// USO SEGURO
//   node scripts/fotos.mjs --faltan          solo las especies sin fotos
//   node scripts/fotos.mjs --solo=id1,id2    solo esas especies
//   node scripts/fotos.mjs                   todas (vuelve a descargar). Las fotos ya revisadas a ojo están protegidas por
//                                            RECHAZADAS y MANUAL, pero cualquier foto nueva que aparezca hay que REVISARLA a ojo.
// Si una búsqueda no devuelve nada (p. ej. error de la API) se conservan las fotos que la especie ya tenía.
// Tras revisar fotos nuevas: añade las malas a RECHAZADAS (URL de origen) antes de volver a ejecutar.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { licenciaPermitida } from './validar-datos.mjs';

const datos = JSON.parse(readFileSync('data/especies.json', 'utf8'));
mkdirSync('img/especies', { recursive: true });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const LIC = { 'cc0': 'CC0', 'cc-by': 'CC BY 4.0', 'cc-by-sa': 'CC BY-SA 4.0' };
const soloFaltan = process.argv.includes('--faltan');
const solo = process.argv.find((a) => a.startsWith('--solo='))?.slice(7).split(',');
const UA = { 'User-Agent': 'setas-app/1.0 (uso personal)' };
// Fichas de género o sinónimo: se fotografía una especie representativa / el nombre con que iNaturalist las conoce.
const REPRESENTANTE = {
  'tricholoma-flavovirens': ['Tricholoma equestre'],   // mismo taxón en iNaturalist
  morchella: ['Morchella esculenta'], helvella: ['Helvella crispa', 'Helvella lacunosa'], scleroderma: ['Scleroderma citrinum'] };
// Taxón realmente fotografiado cuando no coincide con `nombre` de la ficha (campo `taxonFoto` de cada foto).
const TAXON_FOTO = { morchella: 'Morchella esculenta', helvella: 'Helvella crispa', scleroderma: 'Scleroderma citrinum',
  'tricholoma-flavovirens': 'Tricholoma equestre (mismo taxón en iNaturalist)' };
// Misma foto que otra ficha: se reutiliza el archivo en vez de duplicarlo.
const COMPARTE = { 'tricholoma-flavovirens': 'tricholoma-equestre' };
// Fotos revisadas a ojo y rechazadas (URL de origen): nunca se vuelven a incluir.
const RECHAZADAS = new Set([
  "https://www.inaturalist.org/observations/221390338",
  "https://www.inaturalist.org/observations/329973801",
  "https://www.inaturalist.org/observations/99879159",
  "https://www.inaturalist.org/observations/53048358",
  "https://www.inaturalist.org/observations/291795239",
  "https://www.inaturalist.org/observations/65950183",
  "https://www.inaturalist.org/observations/340570548",
  "https://commons.wikimedia.org/wiki/File:Amanita_ponderosa_covered_in_dirt.jpg",
  "https://www.inaturalist.org/observations/245352823",
  "https://www.inaturalist.org/observations/330743641",
  "https://www.inaturalist.org/observations/3250840",
  "https://www.inaturalist.org/observations/2509911",
  "https://www.inaturalist.org/observations/143510645",
  "https://www.inaturalist.org/observations/13168882",
  "https://www.inaturalist.org/observations/190600421",
  "https://www.inaturalist.org/observations/95968691",
  "https://commons.wikimedia.org/wiki/File:Hygrophorus_marzuolus_486299308.jpg",
  "https://commons.wikimedia.org/wiki/File:Hygrophorus_latitabundus1a.JPG",
  "https://www.inaturalist.org/observations/63837242",
  "https://www.inaturalist.org/observations/53831626",
  "https://www.inaturalist.org/observations/304207094",
  "https://www.inaturalist.org/observations/134091395",
  "https://www.inaturalist.org/observations/62709835",
  "https://commons.wikimedia.org/wiki/File:Amanita_virosa_10099047.jpg",
  "https://commons.wikimedia.org/wiki/File:Amanita_virosa_10099268.jpg",
  "https://www.inaturalist.org/observations/191492286",
  "https://commons.wikimedia.org/wiki/File:Lepiota_helveola,_Soci%C3%A9t%C3%A9_des_sciences_naturelles_de_l%27Ouest_de_la_France,_M%C3%A9nier,_1892.jpg",
  "https://commons.wikimedia.org/wiki/File:Bresadola_-_Lepiota_helveola.png",
  "https://commons.wikimedia.org/wiki/File:Gyromitra_infula_Sasata.jpg",
  "https://www.inaturalist.org/observations/100962038",
  "https://www.inaturalist.org/observations/189226022",
  "https://www.inaturalist.org/observations/334008490",
  "https://www.inaturalist.org/observations/82676914",
  "https://commons.wikimedia.org/wiki/File:Mycena_pura_167599169.jpg",
  "https://www.inaturalist.org/observations/100536836",
  "https://www.inaturalist.org/observations/265864538",
  "https://www.inaturalist.org/observations/100530088",
  "https://commons.wikimedia.org/wiki/File:Boletus_lupinus_cropped.jpg",
  "https://www.inaturalist.org/observations/244796024",
  "https://www.inaturalist.org/observations/69611693",
  "https://www.inaturalist.org/observations/266399117",
  "https://www.inaturalist.org/observations/144553745",
  "https://www.inaturalist.org/observations/254302571",
  "https://www.inaturalist.org/observations/248326577",
  "https://www.inaturalist.org/observations/397404684",
  "https://www.inaturalist.org/observations/53713620",
  "https://www.inaturalist.org/observations/169133355",
  "https://www.inaturalist.org/observations/171738886",
  "https://commons.wikimedia.org/wiki/File:2015-10-11_Lepiota_brunneoincarnata_Chodat_%26_C._Mart%C3%ADn_564314.jpg",
  "https://commons.wikimedia.org/wiki/File:Amanita_virosa_UL_01.jpg"
]);
// Selección manual (revisada a ojo): sustituye a la búsqueda automática. Número = observación de iNaturalist;
// texto = fichero de Wikimedia Commons.
const MANUAL = {
  'tuber-melanosporum': ['Tuber melanosporum - trufa negra, Ágreda, España.jpg', 'Mélanosporum du Ventoux.jpg'],
  'macrolepiota-venenata': ['Chlorophyllum venenatum.jpg'],   // Macrolepiota venenata = Chlorophyllum venenatum
  'amanita-caesarea': [327362312, 245905155],
  'amanita-virosa': ['Amanita virosa a1 (7).JPG', 'Amanita virosa albotik.jpg'],   // ejemplares europeos
};

async function json(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: UA }); if (r.ok) return await r.json(); } catch {}
    await esperar(3000);
  }
  return {};
}

// Autor: para CC0 iNaturalist devuelve «no rights reserved»; se usa el nombre del observador.
const autorInat = (o, p) => (/^no rights reserved/i.test(p.attribution ?? '') ? (o.user?.name || o.user?.login) : p.attribution);

function fotoDeObservacion(o) {
  const url = `https://www.inaturalist.org/observations/${o.id}`;
  if (RECHAZADAS.has(url)) return null;
  for (const p of o.photos ?? []) {
    const lic = LIC[p.license_code];
    if (lic) return { src: p.url.replace('square', 'large'), autor: autorInat(o, p), licencia: lic, url };
  }
  return null;
}

async function inat(nombre, mundo = false) {
  const q = new URLSearchParams({ taxon_name: nombre, photo_license: 'cc-by,cc-by-sa,cc0', quality_grade: 'research',
    order_by: 'votes', per_page: '10' });
  if (!mundo) q.set('place_id', '6774');   // España; con mundo=true se busca en todo el mundo
  const r = await json(`https://api.inaturalist.org/v1/observations?${q}`);
  await esperar(1100);   // menos de 60 peticiones por minuto a iNaturalist
  const fotos = [];
  for (const o of r.results ?? []) {
    // iNaturalist puede devolver observaciones de otro taxón: exige que coincida con el nombre buscado
    if (!coincide(o.taxon?.name, nombre) || fotos.length >= 3) continue;
    const f = fotoDeObservacion(o);
    if (f) fotos.push(f);
  }
  return fotos;
}

async function inatObs(id) {
  const r = await json(`https://api.inaturalist.org/v1/observations/${id}`);
  await esperar(1100);
  const f = r.results?.[0] && fotoDeObservacion(r.results[0]);
  return f ? [f] : [];
}

const MALO = /spore|spores|microscop|drawing|illustration|plate|map|cooked|dish|recipe|table|lamina|tafel|icon|flora/i;
const deCommons = (ii) => ({
  src: ii.thumburl, licencia: ii.extmetadata?.LicenseShortName?.value?.replace(/^Public domain$/i, 'PD'),
  autor: (ii.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim(), url: ii.descriptionurl });
const valida = (f) => licenciaPermitida(f.licencia) && f.autor && !RECHAZADAS.has(f.url);

async function commons(nombre) {
  const q = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${nombre} filetype:bitmap`, gsrnamespace: '6',
    gsrlimit: '5', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1200', format: 'json', origin: '*' });
  const r = await json(`https://commons.wikimedia.org/w/api.php?${q}`);
  const binomio = nombre.split(' ').slice(0, 2).join('_').toLowerCase();
  return Object.values(r.query?.pages ?? {}).filter((p) => p.title.replace(/ /g, '_').toLowerCase().includes(binomio) && !MALO.test(p.title))
    .map((p) => p.imageinfo?.[0]).filter(Boolean).map(deCommons).filter(valida).slice(0, 3);
}

async function commonsTitulo(titulo) {
  const q = new URLSearchParams({ action: 'query', titles: `File:${titulo}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1200', format: 'json' });
  const r = await json(`https://commons.wikimedia.org/w/api.php?${q}`);
  const ii = Object.values(r.query?.pages ?? {})[0]?.imageinfo?.[0];
  return ii ? [deCommons(ii)].filter(valida) : [];
}

const coincide = (taxon, n) => !!taxon && (taxon === n || taxon.startsWith(n + ' '));
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
  if (solo && !solo.includes(e.id)) continue;
  let fotos = [], usado = '';
  if (MANUAL[e.id]) {
    for (const m of MANUAL[e.id]) fotos.push(...(typeof m === 'number' ? await inatObs(m) : await commonsTitulo(m)));
    usado = 'manual';
  } else {
    const nombres = REPRESENTANTE[e.id] ?? [limpio(e.nombre), ...(e.sinonimos ?? []).map((s) => limpio(typeof s === 'string' ? s : s.nombre ?? ''))].filter(Boolean);
    for (const n of nombres) { fotos = await inat(n); if (fotos.length) { usado = `iNaturalist: ${n}`; break; } }
    if (!fotos.length) for (const n of nombres) { fotos = await commons(n); if (fotos.length) { usado = `Commons: ${n}`; break; } }
    if (!fotos.length) for (const n of nombres) { fotos = await inat(n, true); if (fotos.length) { usado = `iNaturalist (mundo): ${n}`; break; } }
  }
  if (!fotos.length) { console.log(`${e.id}: sin resultados, se conservan ${e.fotos?.length ?? 0} foto(s) existentes`); continue; }
  const nuevas = [];
  if (COMPARTE[e.id]) {
    const otra = datos.especies.find((x) => x.id === COMPARTE[e.id]);
    for (const f of otra.fotos) nuevas.push({ archivo: f.archivo, autor: f.autor, licencia: f.licencia, url: f.url });
  } else for (const [k, f] of fotos.entries()) {
    const archivo = `img/especies/${e.id}-${k + 1}.webp`;
    try {
      const buf = await descargar(f.src);
      await sharp(buf).resize({ width: 1100, withoutEnlargement: true }).webp({ quality: 70 }).toFile(archivo);
      nuevas.push({ archivo, autor: f.autor, licencia: f.licencia, url: f.url });
      await esperar(700);
    } catch (err) { console.log(`  ${e.id}: fallo al descargar ${f.src}`); }
  }
  if (!nuevas.length) { console.log(`${e.id}: descargas fallidas, se conservan las existentes`); continue; }
  if (TAXON_FOTO[e.id]) for (const f of nuevas) f.taxonFoto = TAXON_FOTO[e.id];
  e.fotos = nuevas;
  console.log(`${e.id}: ${e.fotos.length} foto(s) [${usado}]`);
}
writeFileSync('data/especies.json', JSON.stringify(datos, null, 2) + '\n');

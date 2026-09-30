// Valida que todo dato tenga fuente y fecha y que las referencias cruzadas existan.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const HABITATS = ['pinar-silvestre', 'pinar-negral', 'pinar-resinero', 'pinar-pinonero', 'hayedo', 'melojar',
  'robledal-albar', 'quejigar', 'castanar', 'encinar', 'alcornocal', 'jaral', 'sabinar', 'abedular', 'chopera',
  'pastizal-montana', 'prado'];
export const CATEGORIAS = ['comestible', 'comestible-precaucion', 'no-recomendada', 'toxica', 'mortal'];
export const PRESENCIAS = ['confirmada', 'orientativa', 'sin-registros'];
export const TIPOS_COTO = ['acotado', 'parque-micologico', 'regulado', 'prohibido'];
export const PRECISIONES = ['oficial', 'derivado', 'aproximado'];
const CONFIANZAS = ['alta', 'media', 'baja'];
export const BASES = ['evidencia', 'cualitativo', 'heuristica'];
export const TIPOS_TEMPORADA = ['otono', 'primavera', 'verano'];
const HELADAS = ['nula', 'baja', 'media', 'alta'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const URL_OK = /^https?:\/\//;

export const licenciaPermitida = (t) => /^(CC0( 1\.0)?|PD|CC BY(-SA)?( \d\.\d)?)$/.test(t ?? '');

export function validar({ zonas, especies, normativa, cotos, existe = existsSync }) {
  const e = [];
  const err = (msg) => e.push(msg);
  const unicos = (lista, que) => { const vistos = new Set(); for (const x of lista) { if (vistos.has(x.id)) err(`${que} duplicado: ${x.id}`); vistos.add(x.id); } return vistos; };

  const idsNormas = unicos(normativa.normas, 'norma');
  const idsZonas = unicos(zonas.zonas, 'zona');
  const idsEspecies = unicos(especies.especies, 'especie');
  const idsSindromes = unicos(especies.sindromes ?? [], 'síndrome');

  for (const x of especies.sindromes ?? []) {
    if (!x.fuentes?.length || x.fuentes.some((f) => !URL_OK.test(f.url ?? '') || !FECHA.test(f.consultado ?? ''))) err(`síndrome ${x.id}: falta fuente con url y consultado`);
  }

  for (const z of zonas.zonas) {
    if (!Array.isArray(z.bbox) || z.bbox.length !== 4) err(`zona ${z.id}: bbox inválido`);
    if (!z.puntos?.length) err(`zona ${z.id}: sin puntos`);
    for (const p of z.puntos ?? []) {
      for (const k of ['lat', 'lon', 'altitud']) if (typeof p[k] !== 'number') err(`punto ${p.id}: ${k} no numérico`);
      if (!HABITATS.includes(p.habitat)) err(`punto ${p.id}: hábitat desconocido ${p.habitat}`);
      if (!URL_OK.test(p.fuente ?? '')) err(`punto ${p.id}: sin fuente`);
      if (!FECHA.test(p.revisado ?? '')) err(`punto ${p.id}: revisado mal formado`);
    }
    for (const h of z.habitats ?? []) if (!HABITATS.includes(h)) err(`zona ${z.id}: hábitat desconocido ${h}`);
    for (const n of z.normas ?? []) if (!idsNormas.has(n)) err(`zona ${z.id}: norma inexistente ${n}`);
    if (!z.fuentes?.length) err(`zona ${z.id}: sin fuentes`);
  }

  for (const s of especies.especies) {
    const q = `especie ${s.id}`;
    if (!CATEGORIAS.includes(s.categoria)) err(`${q}: categoría desconocida ${s.categoria}`);
    if (!s.fuentes?.length || s.fuentes.some((f) => !URL_OK.test(f.url ?? '') || !FECHA.test(f.consultado ?? ''))) err(`${q}: falta fuente con url y consultado`);
    for (const h of s.habitats ?? []) if (!HABITATS.includes(h)) err(`${q}: hábitat desconocido ${h}`);
    if (s.sindrome && !idsSindromes.has(s.sindrome)) err(`${q}: síndrome inexistente ${s.sindrome}`);
    if (['toxica', 'mortal'].includes(s.categoria) && !s.sindrome) err(`${q}: ${s.categoria} sin síndrome`);
    for (const [zid, v] of Object.entries(s.zonas ?? {})) {
      if (!idsZonas.has(zid)) err(`${q}: zona inexistente ${zid}`);
      if (!PRESENCIAS.includes(v.presencia)) err(`${q}: presencia desconocida en ${zid}`);
    }
    for (const c of s.confusiones ?? []) if (!idsEspecies.has(c.especie)) err(`${q}: confusión con ficha inexistente ${c.especie}`);
    for (const f of s.fotos ?? []) {
      if (!licenciaPermitida(f.licencia)) err(`${q}: foto con licencia no permitida (${f.licencia})`);
      if (!f.autor || !URL_OK.test(f.url ?? '')) err(`${q}: foto sin autor o sin url de origen`);
      if (!existe(f.archivo)) err(`${q}: falta el archivo ${f.archivo}`);
    }
    if (s.categoria === 'comestible') {
      if (!s.indice && !s.sinIndice) err(`${q}: comestible sin índice ni motivo sinIndice`);
      if (s.indice) {
        const i = s.indice;
        for (const k of ['topt', 'pmin', 'pfull']) if (typeof i[k] !== 'number') err(`${q}: índice.${k} no numérico`);
        if (!(i.pfull > i.pmin)) err(`${q}: índice.pfull debe ser mayor que pmin`);
        if (!Array.isArray(i.trango) || !(i.trango[1] > i.trango[0])) err(`${q}: índice.trango inválido`);
        if (!Array.isArray(i.desfase) || !(i.desfase[1] >= i.desfase[0])) err(`${q}: índice.desfase inválido`);
        if (!HELADAS.includes(i.helada)) err(`${q}: índice.helada desconocida`);
        if (!CONFIANZAS.includes(i.confianza)) err(`${q}: índice.confianza desconocida`);
        if (!BASES.includes(i.base)) err(`${q}: índice.base desconocida ${i.base}`);
        if (!i.fuente) err(`${q}: índice sin fuente`);
      }
    } else if (s.indice) err(`${q}: solo las comestibles llevan índice`);
    if (!s.temporada?.meses?.every((m) => m >= 1 && m <= 12)) err(`${q}: temporada.meses inválido`);
    if (s.temporada?.meses?.length && !TIPOS_TEMPORADA.includes(s.temporada?.tipo)) err(`${q}: temporada.tipo desconocido ${s.temporada?.tipo}`);
  }

  for (const n of normativa.normas) {
    if (!URL_OK.test(n.url ?? '')) err(`norma ${n.id}: sin url`);
    if (!FECHA.test(n.revisado ?? '')) err(`norma ${n.id}: revisado mal formado`);
    for (const z of n.ambito?.zonas ?? []) if (!idsZonas.has(z)) err(`norma ${n.id}: zona inexistente ${z}`);
    for (const t of n.permiso?.tarifas ?? []) if (!URL_OK.test(t.fuente ?? '')) err(`norma ${n.id}: tarifa sin fuente`);
  }

  if (cotos.type !== 'FeatureCollection') err('cotos: no es FeatureCollection');
  for (const f of cotos.features ?? []) {
    const p = f.properties ?? {};
    const q = `coto ${p.id}`;
    if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) err(`${q}: geometría ${f.geometry?.type}`);
    if (!TIPOS_COTO.includes(p.tipo)) err(`${q}: tipo desconocido ${p.tipo}`);
    if (!PRECISIONES.includes(p.precision)) err(`${q}: precision desconocida ${p.precision}`);
    if (!idsZonas.has(p.zona)) err(`${q}: zona inexistente ${p.zona}`);
    for (const n of p.normas ?? []) if (!idsNormas.has(n)) err(`${q}: norma inexistente ${n}`);
    if (!URL_OK.test(p.fuente ?? '') || !FECHA.test(p.revisado ?? '')) err(`${q}: sin fuente o revisado`);
  }
  return e;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
  const errores = validar({ zonas: leer('data/zonas.json'), especies: leer('data/especies.json'),
    normativa: leer('data/normativa.json'), cotos: leer('data/cotos.geojson') });
  if (errores.length) { console.error(errores.map((x) => `✗ ${x}`).join('\n')); process.exit(1); }
  console.log('✓ Datos válidos');
}

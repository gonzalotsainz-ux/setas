// Valida que todo dato tenga fuente y fecha y que las referencias cruzadas existan.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { puntoEnGeometria } from '../js/rejilla/geo.js';
import { leerCabecera, decodificarRejilla } from '../js/rejilla/formato.js';
export { puntoEnGeometria };

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
export const TIPOS_SITIO = ['sitio', 'ruta', 'no-ir'];
export const ESTADOS_LEGALES = ['permiso', 'libre', 'prohibido', 'privado', 'sin-confirmar'];
export const TIPOS_TRUCO = ['orientacion', 'altitud', 'microhabitat', 'indicador', 'tiempo', 'recoleccion', 'creencia'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const URL_OK = /^https?:\/\//;

export const licenciaPermitida = (t) => /^(CC0( 1\.0)?|PD|CC BY(-SA)?( \d\.\d)?)$/.test(t ?? '');

const fuentesOk = (fs) => Array.isArray(fs) && fs.length > 0 && fs.every((f) => URL_OK.test(f.url ?? '') && FECHA.test(f.consultado ?? '')
  && (f.fecha == null || FECHA.test(f.fecha)));

export function validar({ zonas, especies, normativa, cotos, sitios = { sitios: [] }, existe = existsSync }) {
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
      if (p.noIr !== undefined && p.noIr !== true) err(`punto ${p.id}: noIr solo puede ser true`);
      if (p.noIr && !/NO IR/.test(p.proteccion ?? '')) err(`punto ${p.id}: un punto noIr debe explicar en proteccion por qué es NO IR`);
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
    for (const [k, t] of (s.trucos ?? []).entries()) {
      const qt = `${q}: truco ${k + 1}`;
      if (s.categoria !== 'comestible') err(`${q}: solo las comestibles llevan trucos`);
      if (!t.texto) err(`${qt}: sin texto`);
      if (!TIPOS_TRUCO.includes(t.tipo)) err(`${qt}: tipo desconocido ${t.tipo}`);
      if (!CONFIANZAS.includes(t.confianza)) err(`${qt}: confianza desconocida ${t.confianza}`);
      if (!fuentesOk(t.fuentes)) err(`${qt}: falta fuente con url y consultado`);
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
  const prohibidos = (cotos.features ?? []).filter((f) => f.properties?.tipo === 'prohibido');
  unicos(sitios.sitios, 'sitio');
  for (const x of sitios.sitios) {
    const q = `sitio ${x.id}`;
    if (!idsZonas.has(x.zona)) err(`${q}: zona inexistente ${x.zona}`);
    if (!x.nombre || !x.consejo) err(`${q}: falta nombre o consejo`);
    if (!TIPOS_SITIO.includes(x.tipo)) err(`${q}: tipo desconocido ${x.tipo}`);
    if (!CONFIANZAS.includes(x.confianza)) err(`${q}: confianza desconocida ${x.confianza}`);
    for (const id of x.especies ?? []) if (!idsEspecies.has(id)) err(`${q}: especie inexistente ${id}`);
    for (const h of x.habitat ?? []) if (!HABITATS.includes(h)) err(`${q}: hábitat desconocido ${h}`);
    if (!Array.isArray(x.epoca) || !x.epoca.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)) err(`${q}: epoca inválida`);
    if (!ESTADOS_LEGALES.includes(x.legal?.estado)) err(`${q}: legal.estado desconocido ${x.legal?.estado}`);
    if (!x.legal?.texto) err(`${q}: legal sin texto`);
    for (const n of x.legal?.normas ?? []) if (!idsNormas.has(n)) err(`${q}: norma inexistente ${n}`);
    if (x.tipo !== 'no-ir' && ['prohibido', 'privado'].includes(x.legal?.estado)) err(`${q}: un sitio ${x.legal.estado} solo puede ser de tipo no-ir`);
    if (!fuentesOk(x.fuentes)) err(`${q}: falta fuente con url y consultado`);
    if (x.fueraDeZonaMeteo !== undefined && typeof x.fueraDeZonaMeteo !== 'boolean') err(`${q}: fueraDeZonaMeteo debe ser booleano`);
    const n = x.nFuentes;
    if (!Number.isInteger(n) || n < 0) err(`${q}: nFuentes inválido`);
    else if ((x.confianza === 'alta' && n < 3) || (x.confianza === 'media' && n !== 2) || (x.confianza === 'baja' && n > 1)) {
      err(`${q}: confianza ${x.confianza} no casa con ${n} fuentes (alta: 3 o más, media: 2, baja: 1 o menos)`);
    }
    if ((x.lat == null) !== (x.lon == null)) err(`${q}: coordenadas incompletas (lat y lon juntas o ninguna)`);
    else if (x.lat != null) {
      if (typeof x.lat !== 'number' || typeof x.lon !== 'number' || Math.abs(x.lat) > 90 || Math.abs(x.lon) > 180) err(`${q}: lat/lon inválidas`);
      else for (const f of prohibidos) if (puntoEnGeometria(x.lon, x.lat, f.geometry)) err(`${q}: cae dentro de la zona prohibida ${f.properties.id}`);
    }
  }
  return e;
}

// Rejilla fina (data/rejilla/): cada archivo existe, es un «SETR» v1 de una zona conocida, cita sus fuentes y no pasa de
// maxBytes (ya va comprimido: es lo que se descarga). Los bytes de hábitat los comprueba decodificarRejilla: código dentro
// de la cabecera, bit 5 (FUERA_PROVINCIAS) solo con hábitat y bit 6 reservado a 0. gruesa.json: zona, posición, altitud de
// referencia y hábitats de cada celda.
export async function validarRejillas({ indice, gruesa, zonas, leer, maxBytes = 300 * 1024 }) {
  const e = [];
  const ids = new Set(zonas.zonas.map((z) => z.id));
  if (indice?.version !== 1 || !Array.isArray(indice.archivos)) return ['rejilla: data/rejilla/indice.json sin versión 1 o sin archivos'];
  for (const a of indice.archivos) {
    const q = `rejilla ${a.archivo}`;
    const b = leer(`data/rejilla/${a.archivo}`);
    if (!b) { e.push(`${q}: falta el archivo`); continue; }
    if (b.length > maxBytes) e.push(`${q}: ${Math.round(b.length / 1024)} KB, más de ${Math.round(maxBytes / 1024)} KB`);
    if (a.bytes !== b.length) e.push(`${q}: indice.json dice ${a.bytes} bytes y el archivo tiene ${b.length}`);
    let cab;
    try { cab = leerCabecera(b).cabecera; } catch (x) { e.push(`${q}: ${x.message}`); continue; }
    try { await decodificarRejilla(b); } catch (x) { e.push(`${q}: ${x.message}`); continue; }
    if (!ids.has(cab.zona)) e.push(`${q}: zona inexistente ${cab.zona}`);
    if (cab.tam !== 250) e.push(`${q}: celdas de ${cab.tam} m, se esperaban 250`);
    if (!(cab.ancho > 0 && cab.alto > 0)) e.push(`${q}: ancho o alto inválido`);
    if (!Array.isArray(cab.habitats) || !cab.habitats.every((h) => HABITATS.includes(h))) e.push(`${q}: hábitat desconocido en la cabecera`);
    for (const k of ['mfe', 'mdt']) {
      const f = cab.fuentes?.[k];
      if (!f?.nombre || !URL_OK.test(f.url ?? '') || !FECHA.test(f.fecha ?? '')) e.push(`${q}: fuente ${k} sin nombre, url o fecha`);
    }
    if (a.zona !== cab.zona || a.col0 !== cab.col0 || a.fila0 !== cab.fila0 || a.ancho !== cab.ancho || a.alto !== cab.alto) e.push(`${q}: indice.json no coincide con la cabecera`);
  }
  for (const c of gruesa?.celdas ?? []) {
    if (!ids.has(c.zona)) e.push(`celda gruesa ${c.id}: zona inexistente ${c.zona}`);
    if (![c.altRef, c.lat, c.lon].every((v) => typeof v === 'number' && Number.isFinite(v))) e.push(`celda gruesa ${c.id}: sin altRef, lat o lon`);
    if (!Array.isArray(c.habitats) || !c.habitats.length || !c.habitats.every((h) => HABITATS.includes(h))) e.push(`celda gruesa ${c.id}: hábitats vacíos o desconocidos`);
  }
  if (gruesa && !Object.values(gruesa.pasos ?? {}).every((p) => p > 0)) e.push('gruesa.json: pasos inválidos');
  return e;
}

export function validarPueblos(d) {
  const e = [];
  if (d?.version !== 1 || !URL_OK.test(d.fuente?.url ?? '') || !FECHA.test(d.fuente?.fecha ?? '') || !d.fuente?.licencia) e.push('pueblos: sin versión 1 o sin fuente con url, fecha y licencia');
  for (const p of d?.pueblos ?? []) if (!p.n || typeof p.lat !== 'number' || typeof p.lon !== 'number') { e.push(`pueblos: «${p.n}» sin nombre o coordenadas`); break; }
  return e;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
  const errores = validar({ zonas: leer('data/zonas.json'), especies: leer('data/especies.json'),
    normativa: leer('data/normativa.json'), cotos: leer('data/cotos.geojson'),
    sitios: existsSync('data/sitios.json') ? leer('data/sitios.json') : undefined });
  if (existsSync('data/rejilla/indice.json')) {
    errores.push(...await validarRejillas({ indice: leer('data/rejilla/indice.json'),
      gruesa: existsSync('data/rejilla/gruesa.json') ? leer('data/rejilla/gruesa.json') : null, zonas: leer('data/zonas.json'),
      leer: (f) => (existsSync(f) ? new Uint8Array(readFileSync(f)) : null) }));
  }
  if (existsSync('data/pueblos.json')) errores.push(...validarPueblos(leer('data/pueblos.json')));
  if (errores.length) { console.error(errores.map((x) => `✗ ${x}`).join('\n')); process.exit(1); }
  console.log('✓ Datos válidos');
}

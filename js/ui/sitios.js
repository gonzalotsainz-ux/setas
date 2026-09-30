// Sitios conocidos y trucos de búsqueda (tarea 15b).
// - seccionDondeBuscar(zona, datos): sección «Dónde buscar» de la pantalla Zona, con un recuadro rojo «No ir».
// - trucosEspecie(especie, datos): sección «Trucos para encontrarla» de la ficha (se engancha en ficha.js).
// Todo texto de los datos entra con textContent; los enlaces solo si son http(s).
import { el, etiqueta, mayus } from './dom.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const urlSegura = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
const comun = (e) => e.comunes?.es?.[0] ?? e.nombre;

export const AVISO_SITIOS = 'Recopilado de blogs, prensa y webs oficiales; comprueba siempre el permiso y respeta las propiedades privadas.';
export const AVISO_FUERA_ZONA = 'Este pueblo queda fuera del área donde se calcula el índice de la zona: tómalo como orientativo.';
export const AVISO_TRUCOS = 'Recopilados de blogs, guías divulgativas y webs de micología, no de estudios revisados. Las cifras se leyeron con resúmenes automáticos: tómalas como orientación y contrástalas.';

// [1,2,3,4,5,9,10,11] → «enero a mayo y septiembre a noviembre»
export function rangoMeses(meses) {
  const ms = [...new Set(meses ?? [])].sort((a, b) => a - b);
  const tramos = [];
  for (const m of ms) {
    const t = tramos.at(-1);
    if (t && m === t[1] + 1) t[1] = m; else tramos.push([m, m]);
  }
  return tramos.map(([a, b]) => (a === b ? MESES[a - 1] : `${MESES[a - 1]} a ${MESES[b - 1]}`)).join(' y ');
}

export const LEGAL = {
  permiso: { texto: 'Hace falta permiso', variante: 'ocre' },
  libre: { texto: 'Libre (con cupo)', variante: 'acento' },
  'sin-confirmar': { texto: 'Permiso sin confirmar', variante: 'ocre' },
  prohibido: { texto: 'Prohibido', variante: 'peligro' },
  privado: { texto: 'Propiedad privada', variante: 'peligro' },
};

export const fuentesTexto = (n) => (n >= 2 ? `${n} fuentes` : n === 1 ? 'Una sola fuente' : 'Sin fuente directa');

const tituloCorto = (n) => {
  const t = n.titulo.replace(/\s*\(BO[^)]*\)\s*$/, '');
  return t.length > 90 ? `${t.slice(0, 87).trimEnd()}…` : t;
};

const enlace = (href, texto, extra = {}) => (urlSegura(href) ? el('a', { texto, href, rel: 'noopener', target: '_blank', ...extra }) : el('span', { texto }));

function normasDe(sitio, datos) {
  const normas = (sitio.legal.normas ?? []).map((id) => datos.normativa.find((n) => n.id === id)).filter(Boolean);
  if (!normas.length) return null;
  const ul = el('ul', { clase: 'sitio__normas' });
  for (const n of normas) ul.append(el('li', {}, enlace(n.url, tituloCorto(n)), n.verificado === false ? [' ', etiqueta('sin confirmar', 'ocre')] : null));
  return el('div', {}, el('p', { clase: 'texto-2 texto-s', texto: normas.length > 1 ? 'Normas:' : 'Norma:' }), ul);
}

function fuentesDe(sitio) {
  const ul = el('ul', { clase: 'sitio__fuentes' });
  for (const f of sitio.fuentes) {
    ul.append(el('li', {}, enlace(f.url, f.titulo ?? f.url), f.fecha ? el('span', { clase: 'texto-2 texto-s', texto: ` (${f.fecha})` }) : null));
  }
  return ul;
}

function detalles(sitio) {
  const cuerpo = [el('h4', { texto: 'Fuentes' }), fuentesDe(sitio)];
  if (sitio.notas) cuerpo.push(el('h4', { texto: 'Notas de la investigación' }), el('p', { texto: sitio.notas }));
  if (sitio.verificado === false) cuerpo.push(el('p', { clase: 'texto-2 texto-s', texto: 'Sin verificar contra el original.' }));
  return el('details', { clase: 'sitio__detalle' }, el('summary', { texto: `Fuentes y notas (${sitio.fuentes.length})` }), el('div', { clase: 'sitio__detalle-cuerpo' }, cuerpo));
}

function especiesDe(sitio, datos) {
  const hijos = (sitio.especies ?? []).map((id) => datos.porId[id]).filter(Boolean);
  if (!hijos.length && !sitio.epoca?.length) return null;
  const p = el('p', { clase: 'sitio__especies' });
  hijos.forEach((e, i) => {
    if (i) p.append(', ');
    p.append(el('a', { href: `#especie/${encodeURIComponent(e.id)}`, texto: comun(e) }));
  });
  if (hijos.length && sitio.epoca?.length) p.append(' · ');
  if (sitio.epoca?.length) p.append(el('span', { clase: 'texto-2', texto: mayus(rangoMeses(sitio.epoca)) }));
  return p;
}

function tarjetaSitio(s, datos) {
  const chips = el('div', { clase: 'etiquetas' },
    s.tipo === 'ruta' ? etiqueta('Ruta') : null,
    etiqueta(LEGAL[s.legal.estado].texto, LEGAL[s.legal.estado].variante),
    etiqueta(fuentesTexto(s.nFuentes), s.confianza === 'alta' ? 'acento' : s.confianza === 'baja' ? 'ocre' : null));
  return el('li', { clase: 'sitio' },
    el('h3', { clase: 'sitio__nombre', texto: s.nombre }),
    el('p', { clase: 'texto-2 texto-s', texto: s.municipio }),
    chips, especiesDe(s, datos),
    el('p', { texto: s.consejo }),
    s.fueraDeZonaMeteo === true ? el('p', { clase: 'sitio__meteo texto-2 texto-s', texto: AVISO_FUERA_ZONA }) : null,
    el('p', { clase: 'sitio__legal texto-s', texto: s.legal.texto }),
    normasDe(s, datos), detalles(s));
}

function recuadroNoIr(lista, datos) {
  const ul = el('ul', { clase: 'no-ir__lista' });
  for (const s of lista) {
    ul.append(el('li', {},
      el('strong', { texto: s.nombre }),
      el('div', { clase: 'etiquetas' }, etiqueta(LEGAL[s.legal.estado].texto, LEGAL[s.legal.estado].variante)),
      el('p', { texto: s.consejo }),
      el('p', { clase: 'texto-s', texto: s.legal.texto }),
      normasDe(s, datos), detalles(s)));
  }
  return el('div', { clase: 'no-ir', attrs: { role: 'note', 'aria-labelledby': 'titulo-no-ir' } },
    el('h3', { id: 'titulo-no-ir', texto: 'No ir' }),
    el('p', { texto: 'Aquí no se recogen setas: está prohibido, es propiedad privada o no consta que se pueda.' }), ul);
}

export const sitiosDeZona = (zonaId, sitios) => (sitios ?? []).filter((s) => s.zona === zonaId);

export function seccionDondeBuscar(zona, datos) {
  const todos = sitiosDeZona(zona.id, datos.sitios);
  const buenos = todos.filter((s) => s.tipo !== 'no-ir');
  const noIr = todos.filter((s) => s.tipo === 'no-ir');
  const cuerpo = [el('p', { clase: 'aviso-fijo', texto: AVISO_SITIOS })];
  if (datos.sitios == null) cuerpo.push(el('p', { texto: 'No se han podido cargar los sitios conocidos.' }));
  else if (!todos.length) cuerpo.push(el('p', { texto: 'Sin sitios conocidos registrados para esta zona.' }));
  if (buenos.length) cuerpo.push(el('ul', { clase: 'sitios' }, buenos.map((s) => tarjetaSitio(s, datos))));
  if (noIr.length) cuerpo.push(recuadroNoIr(noIr, datos));
  return el('section', { clase: 'tarjeta', attrs: { 'aria-labelledby': 'titulo-donde' } },
    el('div', { clase: 'permiso__fila' }, el('h2', { id: 'titulo-donde', texto: 'Dónde buscar' }), etiqueta('Orientativo', 'ocre')),
    el('p', { clase: 'texto-2 texto-s', texto: `${buenos.length} ${buenos.length === 1 ? 'sitio' : 'sitios'}${noIr.length ? ` y ${noIr.length} ${noIr.length === 1 ? 'lugar' : 'lugares'} donde no ir` : ''}.` }),
    ...cuerpo);
}

// ---------------- Trucos de la ficha de especie ----------------
const GRUPOS = [
  ['microhabitat', 'Dónde mirar'], ['orientacion', 'Orientación'], ['altitud', 'Altitud'],
  ['indicador', 'Indicadores'], ['tiempo', 'Tiempo y meteorología'], ['recoleccion', 'Al recolectar'],
];
const CONFIANZA = { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja' };

function fuentesTruco(t) {
  const ol = el('span', { clase: 'truco__fuentes' });
  t.fuentes.forEach((f, i) => {
    if (i) ol.append(' ');
    let host = f.url;
    try { host = new URL(f.url).hostname.replace(/^www\./, ''); } catch { /* se deja la URL tal cual */ }
    ol.append(enlace(f.url, `[${i + 1}]`, { attrs: { 'aria-label': `Fuente ${i + 1}: ${host}` }, title: host }));
  });
  return ol;
}

function truco(t) {
  return el('li', { clase: 'truco' },
    el('span', { texto: t.texto }), ' ',
    el('span', { clase: 'etiquetas truco__chips' },
      etiqueta(CONFIANZA[t.confianza] ?? t.confianza, t.confianza === 'alta' ? 'acento' : t.confianza === 'baja' ? 'ocre' : null),
      t.cifrasOrientativas ? etiqueta('cifras orientativas', 'ocre') : null), ' ',
    fuentesTruco(t));
}

export function trucosEspecie(e) {
  const trucos = e.trucos ?? [];
  if (!trucos.length) return null;
  const partes = [];
  for (const [tipo, titulo] of GRUPOS) {
    const lista = trucos.filter((t) => t.tipo === tipo);
    if (lista.length) partes.push(el('div', {}, el('h3', { texto: titulo }), el('ul', { clase: 'ficha-lista truco-lista' }, lista.map(truco))));
  }
  const creencias = trucos.filter((t) => t.tipo === 'creencia');
  if (creencias.length) {
    partes.push(el('div', { clase: 'trucos__creencias' }, el('h3', { texto: 'Creencia popular (sin base)' }),
      el('p', { clase: 'texto-2 texto-s', texto: 'Lo cuenta un solo autor como observación de campo, sin datos que lo respalden. No te fíes de ello.' }),
      el('ul', { clase: 'ficha-lista truco-lista' }, creencias.map(truco))));
  }
  return el('section', { clase: 'tarjeta ficha-seccion', attrs: { 'aria-labelledby': 'titulo-trucos' } },
    el('h2', { id: 'titulo-trucos', clase: 'ficha-seccion__titulo', texto: 'Trucos para encontrarla' }),
    el('p', { clase: 'texto-2 texto-s', texto: AVISO_TRUCOS }),
    ...partes);
}

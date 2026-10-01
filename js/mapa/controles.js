// js/mapa/controles.js
// Controles del mapa a pantalla completa: chips de especie en temporada, barra de días y buscador de pueblos,
// sitios y especies (spec §2). Lo que decide es puro (se prueba con Node); crearBuscador monta el DOM.
import { el, icono, mayus } from '../ui/dom.js';
import { comun } from '../ui/ficha.js';
import { enTemporada, pesoPrevision } from '../indice.js';
import { entreDias } from '../meteo.js';
import { buscarEspecies } from '../pantallas/especies.js';

export const GRUPOS = [
  { id: 'boletus', texto: 'Boletus', especies: ['boletus-edulis', 'boletus-pinophilus', 'boletus-aereus', 'boletus-reticulatus'] },
  { id: 'niscalos', texto: 'Níscalos', especies: ['lactarius-deliciosus', 'lactarius-sanguifluus'] },
  { id: 'rebozuelos', texto: 'Rebozuelos', especies: ['cantharellus-cibarius'] },
  { id: 'perretxiko', texto: 'Perretxiko', especies: ['calocybe-gambosa'] },
  { id: 'colmenillas', texto: 'Colmenillas', especies: ['morchella'] },
];
const AGRUPADAS = new Set(GRUPOS.flatMap((g) => g.especies));

// Primero «Mejor hoy» (sin filtro: la mejor comestible de cada bosque); luego los grupos y las demás comestibles en
// temporada ese día, por orden alfabético.
export function chipsDelDia(especies, fecha) {
  const comestibles = especies.filter((e) => e.categoria === 'comestible' && e.indice);
  const en = new Set(comestibles.filter((e) => enTemporada(fecha, e)).map((e) => e.id));
  const chips = [{ id: 'mejor', texto: 'Mejor hoy', especies: null }];
  for (const g of GRUPOS) { const ids = g.especies.filter((id) => en.has(id)); if (ids.length) chips.push({ id: g.id, texto: g.texto, especies: ids }); }
  const sueltas = comestibles.filter((e) => en.has(e.id) && !AGRUPADAS.has(e.id)).map((e) => ({ id: e.id, texto: mayus(comun(e)), especies: [e.id] }))
    .sort((a, b) => a.texto.localeCompare(b.texto, 'es'));
  return [...chips, ...sueltas];
}
// Un chip que deja de estar en temporada al cambiar de día vuelve a «Mejor hoy».
export const chipVigente = (id, chips) => (chips.some((c) => c.id === id) ? id : 'mejor');

// Cada botón lleva su fecha: quien la use indexa dias[] con fechas.indexOf(fecha), nunca por posición (un índice de
// ayer empieza un día antes; ver diasDisponibles en js/rejilla/carga.js).
const DIA = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
export function barraDias(fechas, hoy, seleccion) {
  return fechas.map((fecha) => {
    const d = entreDias(hoy, fecha);
    return { fecha, texto: d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : mayus(DIA.format(new Date(`${fecha}T12:00:00Z`))),
      menosFiable: pesoPrevision(d) < 0.8, pulsado: fecha === seleccion };
  });
}

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const nombrePueblo = (municipio) => { const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(municipio ?? ''); return m ? { n: m[1], p: m[2] } : { n: municipio ?? '', p: '' }; };

// Especies (eligen su chip), sitios (con sus coordenadas o, si no tienen, las de su pueblo) y pueblos; 8 como mucho.
export function buscarEnMapa(texto, { pueblos = [], sitios = [], especies = [], chips = [] }) {
  const q = normalizar(texto).trim();
  if (q.length < 2) return [];
  const r = [], ya = new Set();
  const poner = (x, clave) => { if (!ya.has(clave)) { ya.add(clave); r.push(x); } };
  for (const e of buscarEspecies(texto, especies.filter((x) => x.categoria === 'comestible' && x.indice))) {
    const ch = chips.find((c) => c.especies?.includes(e.id));
    if (ch) poner({ tipo: 'chip', id: ch.id, texto: comun(e), sub: ch.texto }, `chip:${ch.id}`);
  }
  const deMunicipio = (m) => { const { n, p } = nombrePueblo(m); return pueblos.find((x) => x.n.split(' / ').some((k) => normalizar(k) === normalizar(n)) && (!p || normalizar(p).includes(normalizar(x.p)) || normalizar(x.p).includes(normalizar(p)))); };
  for (const s of sitios) {
    if (!normalizar(s.nombre).includes(q) && !normalizar(s.municipio).includes(q)) continue;
    const donde = typeof s.lat === 'number' ? s : deMunicipio(s.municipio);
    if (donde) poner({ tipo: 'sitio', texto: s.nombre, sub: s.municipio ?? '', lat: donde.lat, lon: donde.lon, zoom: typeof s.lat === 'number' ? 15 : 13 }, `sitio:${s.id}`);
  }
  for (const p of pueblos) {
    const n = normalizar(p.n);
    if (n.startsWith(q) || n.includes(` ${q}`)) poner({ tipo: 'pueblo', texto: p.n, sub: p.p, lat: p.lat, lon: p.lon, zoom: 13 }, `pueblo:${p.n}|${p.p}`);
  }
  return r.slice(0, 8);
}

export async function cargarPueblos(fetchFn = globalThis.fetch?.bind(globalThis)) {
  const r = await fetchFn('data/pueblos.json');
  if (!r.ok) throw new Error(`No se pudo cargar data/pueblos.json (${r.status})`);
  return (await r.json()).pueblos ?? [];
}

// Combobox accesible: flechas para moverse, Intro para elegir, Escape para cerrar la lista.
export function crearBuscador({ buscar, alElegir }) {
  const id = 'mapa-buscar-lista';
  const input = el('input', { type: 'search', placeholder: 'Pueblo, sitio o especie', attrs: { role: 'combobox', 'aria-expanded': 'false', 'aria-controls': id,
    'aria-autocomplete': 'list', 'aria-label': 'Buscar pueblo, sitio o especie', autocomplete: 'off', enterkeyhint: 'search' } });
  const lista = el('ul', { id, clase: 'mapa-buscador__lista', hidden: true, attrs: { role: 'listbox', 'aria-label': 'Resultados' } });
  let resultados = [], activo = -1;
  const pintar = () => {
    lista.replaceChildren(...resultados.map((r, k) => {
      const li = el('li', { id: `${id}-${k}`, attrs: { role: 'option', 'aria-selected': String(k === activo) } }, el('span', { texto: r.texto }), r.sub ? el('span', { clase: 'texto-2 texto-s', texto: ` · ${r.sub}` }) : null);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); elegir(k); });
      return li;
    }));
    lista.hidden = !resultados.length;
    input.setAttribute('aria-expanded', String(resultados.length > 0));
    if (activo >= 0) input.setAttribute('aria-activedescendant', `${id}-${activo}`); else input.removeAttribute('aria-activedescendant');
  };
  const elegir = (k) => { const r = resultados[k]; if (!r) return; input.value = r.texto; resultados = []; activo = -1; pintar(); alElegir(r); };
  input.addEventListener('input', () => { resultados = buscar(input.value); activo = -1; pintar(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && resultados.length) { e.preventDefault(); activo = (activo + 1) % resultados.length; pintar(); }
    else if (e.key === 'ArrowUp' && resultados.length) { e.preventDefault(); activo = (activo - 1 + resultados.length) % resultados.length; pintar(); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(activo >= 0 ? activo : 0); }
    else if (e.key === 'Escape' && resultados.length) { e.stopPropagation(); resultados = []; activo = -1; pintar(); }
  });
  input.addEventListener('blur', () => { resultados = []; activo = -1; pintar(); });
  return { nodo: el('div', { clase: 'mapa-buscador', attrs: { role: 'search' } }, icono('i-buscar'), input, lista), input };
}

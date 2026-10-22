// js/mapa/controles.js
// Controles del mapa a pantalla completa: chips de especie en temporada, la fecha que enseña (siempre hoy), el buscador
// de pueblos, sitios y especies y la línea de avisos. Lo que decide es puro (se prueba con Node); crearBuscador monta el DOM.
import { el, icono, mayus, claveFoco, nodoEquivalente } from '../ui/dom.js';
import { comun } from '../ui/ficha.js';
import { enTemporada } from '../indice.js';
import { buscarEspecies } from '../pantallas/especies.js';
import { nombreCorto } from '../datos.js';
import { mezclarResultados } from './geocodificador.js';
import { AVISO_SIN_DESCOMPRESION, diasDisponibles } from '../rejilla/carga.js';

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

// El mapa no tiene barra de días: enseña hoy. Con un índice de ayer, su primer día desde hoy (que es hoy); sin índice o
// con uno ya pasado, hoy igualmente (sin manchas: lo dice AVISO_FECHA_SIN_INDICE).
export const fechaDelMapa = ({ salida = null, hoy }) => diasDisponibles(salida, hoy)[0] ?? hoy;

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const nombrePueblo = (municipio) => { const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(municipio ?? ''); return m ? { n: m[1], p: m[2] } : { n: municipio ?? '', p: '' }; };

// Orden: especies (eligen su chip), zonas, montes (puntos), sitios (con sus coordenadas o, si no tienen, las de su pueblo)
// y pueblos; 8 como mucho.
export function buscarEnMapa(texto, { pueblos = [], sitios = [], especies = [], chips = [], zonas = [], puntos = [] }) {
  const q = normalizar(texto).trim();
  if (q.length < 2) return [];
  const r = [], ya = new Set();
  const poner = (x, clave) => { if (!ya.has(clave)) { ya.add(clave); r.push(x); } };
  for (const e of buscarEspecies(texto, especies.filter((x) => x.categoria === 'comestible' && x.indice))) {
    const ch = chips.find((c) => c.especies?.includes(e.id));
    if (ch) poner({ tipo: 'chip', id: ch.id, texto: comun(e), sub: ch.texto }, `chip:${ch.id}`);
  }
  const zonaDe = new Map(zonas.map((z) => [z.id, z]));
  for (const z of zonas) {
    if (normalizar(nombreCorto(z)).includes(q) || normalizar(z.nombre).includes(q)) poner({ tipo: 'zona', id: z.id, texto: nombreCorto(z), sub: 'Zona' }, `zona:${z.id}`);
  }
  for (const p of puntos) {
    const z = zonaDe.get(p.zona);
    if (!z || !(normalizar(p.corto).includes(q) || normalizar(p.nombre).includes(q))) continue;
    poner({ tipo: 'punto', zona: z.id, id: p.id, texto: p.corto ?? p.nombre, sub: nombreCorto(z), lat: p.lat, lon: p.lon }, `punto:${p.id}`);
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

// Combobox accesible: flechas para moverse, Intro para elegir, Escape para cerrar la lista. `buscar` es local y síncrono
// (pinta al instante); `buscarLejos(texto, cb)` añade después lugares de fuera (CartoCiudad) sin quitar los locales.
// Las migas son los chips de lo elegido (zona > monte…) que se pintan antes del campo, en un <nav>; `aria` (opcional) les pone
// aria-label y `subir` marca la de «‹» (data-subir).
// Reductor puro de la respuesta lejana: ignora la de un turno viejo (devuelve null) y, si no, mezcla locales y externos
// conservando la opción activa por identidad (si ya no está, o no había, queda -1).
export function fundirResultados({ locales, externos, resultados, activo, turno, turnoRespuesta }) {
  if (turnoRespuesta !== turno) return null;
  const elegido = activo >= 0 ? resultados[activo] : null;
  const nuevos = mezclarResultados(locales, externos);
  return { resultados: nuevos, activo: elegido ? nuevos.indexOf(elegido) : -1 };
}

export function crearBuscador({ buscar, buscarLejos = null, alElegir, alLimpiar = () => {} }) {
  const id = 'mapa-buscar-lista';
  const marcador = 'Pueblo, monte, zona o lugar';
  const input = el('input', { type: 'search', placeholder: marcador, attrs: { role: 'combobox', 'aria-expanded': 'false', 'aria-controls': id,
    'aria-autocomplete': 'list', 'aria-label': 'Buscar pueblo, monte, zona, lugar o especie', autocomplete: 'off', enterkeyhint: 'search' } });
  const lista = el('ul', { id, clase: 'mapa-buscador__lista', hidden: true, attrs: { role: 'listbox', 'aria-label': 'Resultados' } });
  const migas = el('nav', { clase: 'mapa-buscador__migas', hidden: true, attrs: { 'aria-label': 'Ruta del mapa' } });
  let resultados = [], activo = -1, turno = 0;
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
  const cerrar = () => { turno++; resultados = []; activo = -1; pintar(); };   // turno++: una respuesta lejana tardía ya no reabre la lista
  const elegir = (k) => { const r = resultados[k]; if (!r) return; input.value = r.texto; cerrar(); alElegir(r); };
  const escribir = () => {
    const texto = input.value, mio = ++turno, locales = buscar(texto);
    resultados = locales; activo = -1; pintar();
    if (!texto.trim()) alLimpiar();
    else buscarLejos?.(texto, (externos) => {
      const f = fundirResultados({ locales, externos, resultados, activo, turno, turnoRespuesta: mio });
      if (!f) return;
      ({ resultados, activo } = f); pintar();
    });
  };
  input.addEventListener('input', escribir);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && resultados.length) { e.preventDefault(); activo = (activo + 1) % resultados.length; pintar(); }
    else if (e.key === 'ArrowUp' && resultados.length) { e.preventDefault(); activo = (activo - 1 + resultados.length) % resultados.length; pintar(); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(activo >= 0 ? activo : 0); }
    else if (e.key === 'Escape' && resultados.length) { e.stopPropagation(); cerrar(); }
  });
  input.addEventListener('blur', cerrar);
  // Si el foco estaba en una miga, vuelve a la del mismo href (o a la primera, o al campo si ya no hay migas).
  const ponerMigas = (items) => {
    const enfocada = migas.contains(document.activeElement) ? claveFoco(document.activeElement) : null;
    migas.replaceChildren(...items.map((m) => el('a', { clase: 'chip mapa-buscador__miga', href: m.href, texto: m.texto,
      attrs: { ...(m.aria ? { 'aria-label': m.aria } : {}), ...(m.subir ? { 'data-subir': 'true' } : {}) } })));
    migas.hidden = !items.length;
    input.value = '';
    if (enfocada != null) (nodoEquivalente(migas.children, enfocada) ?? migas.querySelector('a') ?? input).focus({ preventScroll: true });
  };
  const limpiarMigas = () => ponerMigas([]);
  return { nodo: el('div', { clase: 'mapa-buscador', attrs: { role: 'search' } }, migas, el('div', { clase: 'mapa-buscador__campo' }, icono('i-buscar'), input), lista), input, ponerMigas, limpiarMigas };
}

// Avisos del mapa, en orden: primero lo que responde a lo que acaba de hacer la usuaria (un error, un lugar buscado fuera
// de las zonas); luego el modo (sin índice o navegador sin descompresión), la antigüedad del índice, el estado de la
// previsión y el día sin índice o sin meteo. El mapa enseña solo el primero (primerAviso), en una línea.
// Cada aviso es [icono, texto]. `viejo` es avisoIndice(salida) y `otroDia`, el de la meteo caducada: se calculan fuera.
export const AVISO_SIN_INDICE = 'No hay mapa por laderas ahora mismo: se ven las zonas y sus montes con su nota.';
export const AVISO_CARGANDO = 'Cargando el mapa por laderas: mientras, se ven las zonas y sus montes.';
export const AVISO_FECHA_SIN_INDICE = 'El mapa por laderas aún no tiene el día de hoy: solo chinchetas.';
export const AVISO_FECHA_SIN_METEO = 'La previsión no llega a hoy: chinchetas sin nota.';
export const AVISO_FUERA_DE_ZONAS = 'La app no tiene datos de monte aquí; las zonas más cercanas están en el mapa.';
export function avisosMapa({ salida, sinDescompresion = false, cargando = false, meteo = null, otroDia = null, viejo = null, error = null,
  fechaSinIndice = false, fechaSinMeteo = false, fuera = false }) {
  const lista = [];
  if (error) lista.push(['i-aviso', error]);
  if (fuera) lista.push(['i-info', AVISO_FUERA_DE_ZONAS]);
  if (!salida) {
    lista.push(cargando ? ['i-info', AVISO_CARGANDO] : ['i-aviso', sinDescompresion ? AVISO_SIN_DESCOMPRESION : AVISO_SIN_INDICE]);
  } else {
    if (viejo) lista.push(['i-info', viejo]);
    if (fechaSinIndice) lista.push(['i-info', AVISO_FECHA_SIN_INDICE]);
  }
  if (!meteo?.series) lista.push(['i-aviso', meteo?.error ? 'No hay previsión: las chinchetas salen sin nota.' : 'Esperando la previsión: las chinchetas saldrán con su nota en unos segundos.']);
  else {
    if (otroDia) lista.push(['i-info', otroDia]);
    if (fechaSinMeteo) lista.push(['i-info', AVISO_FECHA_SIN_METEO]);
  }
  return lista;
}
export const primerAviso = (lista) => lista[0] ?? null;

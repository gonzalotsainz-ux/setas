// Mapa base IGN (topográfico y ortofoto) + OSM, con capas de zonas, cotos, lluvia y salidas.
import { el } from './ui/dom.js';
import { nivelDe, semaforo, palabraDe } from './ui/semaforo.js';
import { indiceZona } from './indice.js';
import { especiesDeZona, nombreCorto } from './datos.js';
import { urlSegura } from './ui/normativa.js';

const IGN = (capa, fmt) => `https://www.ign.es/wmts/${capa.servicio}?service=WMTS&request=GetTile&version=1.0.0&layer=${capa.layer}&style=default&format=image/${fmt}&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}`;
const ATR_IGN = '© <a href="https://www.scne.es">Instituto Geográfico Nacional</a> CC BY 4.0';
export const BASES = {
  'Topográfico IGN': [IGN({ servicio: 'mapa-raster', layer: 'MTN' }, 'jpeg'), ATR_IGN],
  'Ortofoto PNOA': [IGN({ servicio: 'pnoa-ma', layer: 'OI.OrthoimageCoverage' }, 'jpeg'), `PNOA cedido por ${ATR_IGN}`],
  'OpenStreetMap': ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'],
};
export const ESTILO_COTO = {
  prohibido: { color: 'var(--c-peligro)', fillOpacity: 0.25, weight: 2 },
  acotado: { color: 'var(--c-acento)', fillOpacity: 0.12, weight: 1.5 },
  'parque-micologico': { color: 'var(--c-acento)', fillOpacity: 0.18, weight: 2 },
  regulado: { color: 'var(--c-texto-2)', fillOpacity: 0.08, weight: 1 },
};
export const ESTILO_PRECISION = { oficial: {}, derivado: { dashArray: '6 4' }, aproximado: { dashArray: '2 6' } };

export const TIPOS = {
  prohibido: 'Recolección prohibida',
  acotado: 'Coto acotado',
  'parque-micologico': 'Parque micológico',
  regulado: 'Recolección regulada',
};
export const PRECISION_TEXTO = { derivado: 'Derivado de montes públicos', aproximado: 'Límite aproximado' };
const PRECISION_LEYENDA = { oficial: 'Límite oficial', derivado: 'Derivado de montes públicos', aproximado: 'Límite aproximado' };
// Popups: estrechos y con margen para no quedar bajo los controles de zoom y capas.
const POPUP = { minWidth: 200, maxWidth: 250, autoPanPaddingTopLeft: [60, 16], autoPanPaddingBottomRight: [16, 16] };
const PANE_LLUVIA = 'lluvia', PANE_PUNTOS = 'puntos';
const MM_POR_PX = 6;   // radio del círculo de lluvia = mm de los últimos 26 días / 6, en píxeles
const radioLluvia = (mm) => Math.max(3, mm / MM_POR_PX);

// Leaflet no lee var(--…) en atributos SVG: se resuelven los tokens con getComputedStyle.
function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    peligro: v('--c-peligro'), acento: v('--c-acento'), texto2: v('--c-texto-2'), superficie: v('--c-superficie'),
    lluvia: v('--c-lluvia'), sinDatos: v('--c-sin-datos'), borde: v('--c-borde-fuerte'),
    nivel: (n) => v(`--c-sem-${n}`) || v('--c-sin-datos'),
  };
}
const colorToken = (t, valor) => {
  const m = /^var\(--c-([a-z0-9-]+)\)$/.exec(valor);
  return m ? ({ peligro: t.peligro, acento: t.acento, 'texto-2': t.texto2 }[m[1]] ?? valor) : valor;
};
// Con t = null se deja el var(--…) tal cual (para DOM normal); con tokens se resuelve (para capas de Leaflet).
export function estiloCoto(props, t = tokens()) {
  const base = ESTILO_COTO[props.tipo] ?? ESTILO_COTO.regulado;
  const color = t ? colorToken(t, base.color) : base.color;
  return { ...base, color, fillColor: color, ...(ESTILO_PRECISION[props.precision] ?? {}) };
}

// Leaflet se carga con <script>: la URL ESM de cdnjs no existe (404).
let cargaLeaflet = null;
export function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  cargaLeaflet ??= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = () => ok(window.L);
    s.onerror = () => { cargaLeaflet = null; ko(new Error('No se ha podido cargar el mapa (Leaflet). Comprueba la conexión.')); };
    document.head.append(s);
  });
  return cargaLeaflet;
}

let cacheCotos = null;
const cargarCotos = () => (cacheCotos ??= fetch('data/cotos.geojson').then((r) => {
  if (!r.ok) { cacheCotos = null; throw new Error(`No se pudo cargar data/cotos.geojson (${r.status})`); }
  return r.json();
}).catch((e) => { cacheCotos = null; throw e; }));

// Nota del día de un punto: mejor especie de la zona con la serie de ese punto.
function notaPunto(zona, punto, datos, meteo, umbrales) {
  const serie = meteo?.series?.[punto.id];
  if (!serie) return { valor: null, mejor: null, mm: null };
  const especies = especiesDeZona(zona, datos.especies, umbrales);
  const res = indiceZona({ [punto.id]: serie }, serie.hoy, especies);
  let mm = 0;
  for (let j = serie.hoy - 25; j <= serie.hoy; j++) {
    const p = serie.precip?.[j];
    if (p == null || Number.isNaN(p)) { mm = null; break; }
    mm += p;
  }
  return { valor: res.valor, mejor: res.especies[0] ? datos.porId[res.especies[0].id] : null, mm };
}

const enlaceA = (href, texto, clase) => (urlSegura(href) ? el('a', { texto, href, rel: 'noopener', clase }) : el('span', { texto }));

function popupCoto(p, normas) {
  const raiz = el('div', { clase: 'mapa-popup' }, el('h3', { texto: p.nombre }));
  const etiquetas = el('p', { clase: 'mapa-popup__etiquetas' }, el('span', { clase: `etiqueta${p.tipo === 'prohibido' ? ' etiqueta--peligro' : ' etiqueta--acento'}`, texto: TIPOS[p.tipo] ?? p.tipo }));
  if (PRECISION_TEXTO[p.precision]) etiquetas.append(el('span', { clase: 'etiqueta', texto: PRECISION_TEXTO[p.precision] }));
  if (p.regimenConfirmado === false) etiquetas.append(el('span', { clase: 'etiqueta etiqueta--ocre', texto: 'Régimen sin confirmar' }));
  raiz.append(etiquetas);
  if (p.tipo === 'prohibido' && p.precision !== 'oficial') {
    raiz.append(el('p', { clase: 'mapa-popup__aviso', texto: 'Límite aproximado: la prohibición rige en todo el espacio protegido.' }));
  }
  if (p.nota) raiz.append(el('p', { clase: 'texto-2 texto-s', texto: p.nota }));
  const lista = (p.normas ?? []).map((id) => {
    const n = normas.get(id);
    return el('li', {}, n ? enlaceA(n.url, n.titulo) : id);
  });
  if (lista.length) raiz.append(el('h4', { texto: 'Normas' }), el('ul', { clase: 'mapa-popup__normas' }, lista));
  const acciones = el('p', { clase: 'mapa-popup__acciones' });
  if (p.tipo !== 'prohibido' && urlSegura(p.permisoUrl)) acciones.append(el('a', { clase: 'boton boton--compacto', href: p.permisoUrl, rel: 'noopener', texto: 'Sacar permiso' }));
  if (p.zona) acciones.append(el('a', { clase: 'boton boton--suave boton--compacto', href: `#zona/${encodeURIComponent(p.zona)}`, texto: 'Ver zona' }));
  if (acciones.childNodes.length) raiz.append(acciones);
  raiz.append(el('p', { clase: 'texto-2 texto-s', texto: `Revisado el ${p.revisado ?? 'sin fecha'}.` }));
  return raiz;
}

function popupPunto(zona, punto, nota) {
  const raiz = el('div', { clase: 'mapa-popup' }, el('h3', { texto: punto.nombre }), el('p', { clase: 'texto-2 texto-s', texto: zona.nombre }));
  const fila = el('p', { clase: 'mapa-popup__etiquetas' }, semaforo(nota.valor));
  if (nota.valor != null) fila.append(el('b', { clase: 'tabular', texto: `${nota.valor}/100` }));
  raiz.append(fila);
  if (nota.mejor) raiz.append(el('p', { clase: 'texto-s' }, 'Mejor: ', el('span', { clase: 'latin', texto: nota.mejor.nombre })));
  if (nota.mm != null) raiz.append(el('p', { clase: 'texto-s tabular', texto: `Lluvia en 26 días: ${Math.round(nota.mm)} mm` }));
  if (punto.altitud != null) raiz.append(el('p', { clase: 'texto-2 texto-s', texto: `Altitud: ${punto.altitud} m` }));
  if (punto.proteccion) raiz.append(el('h4', { texto: 'Protección' }), el('p', { clase: 'texto-s', texto: punto.proteccion }));
  if (punto.nota) raiz.append(el('p', { clase: 'texto-2 texto-s', texto: punto.nota }));
  raiz.append(el('p', { clase: 'mapa-popup__acciones' }, el('a', { clase: 'boton boton--compacto', href: `#zona/${encodeURIComponent(zona.id)}`, texto: `Ver ${nombreCorto(zona)}` })));
  return raiz;
}

// crearMapa(elemento, { capas, datos, meteo, umbrales, vista, base, onVista }) → { mapa, enfocarZona, capaSalidas, destruir }
export async function crearMapa(elemento, opciones = {}) {
  const { capas = ['zonas', 'cotos', 'lluvia', 'salidas'], datos, meteo = null, umbrales = {}, vista = null, base = null, activas = null, onCambio = () => {} } = opciones;
  const L = await cargarLeaflet();
  const mapa = L.map(elemento, { zoomControl: true, worldCopyJump: false, minZoom: 5, maxZoom: 18 });
  const limitesZona = (z) => [[z.bbox[1], z.bbox[0]], [z.bbox[3], z.bbox[2]]];

  // Capas base
  const bases = {};
  for (const [nombre, [url, atr]] of Object.entries(BASES)) {
    bases[nombre] = L.tileLayer(url, { attribution: atr, maxNativeZoom: nombre === 'OpenStreetMap' ? 19 : 18, maxZoom: 18 });
  }
  const nombreBase = base in bases ? base : 'Topográfico IGN';
  bases[nombreBase].addTo(mapa);

  // Capas superpuestas
  const zonas = L.layerGroup();
  const rectangulos = [], marcadores = [], circulos = [];
  mapa.createPane(PANE_LLUVIA).style.zIndex = 420;   // sobre los polígonos de coto (400)
  mapa.createPane(PANE_PUNTOS).style.zIndex = 450;    // y los puntos, sobre la lluvia
  const lluvia = L.layerGroup();
  const cotos = L.layerGroup();
  const salidas = L.layerGroup();   // la rellena la tarea 17 (diario)
  const normas = new Map((datos?.normativa ?? []).map((n) => [n.id, n]));
  let t = tokens();

  for (const z of datos?.zonas ?? []) {
    const rect = L.rectangle(limitesZona(z), { fill: false, weight: 1.5, dashArray: '1 0', interactive: true, bubblingMouseEvents: false });
    rect.bindTooltip(nombreCorto(z), { sticky: true });
    rect.bindPopup(() => el('div', { clase: 'mapa-popup' }, el('h3', { texto: z.nombre }),
      el('p', { clase: 'mapa-popup__acciones' }, el('a', { clase: 'boton boton--compacto', href: `#zona/${encodeURIComponent(z.id)}`, texto: `Ver ${nombreCorto(z)}` }))), POPUP);
    rectangulos.push(rect); rect.addTo(zonas);
    for (const p of z.puntos) {
      const nota = notaPunto(z, p, datos, meteo, umbrales);
      const m = L.circleMarker([p.lat, p.lon], { pane: PANE_PUNTOS, radius: 9, weight: 2, fillOpacity: 1 });
      m.bindPopup(() => popupPunto(z, p, nota), POPUP);
      marcadores.push({ m, nota }); m.addTo(zonas);
      if (nota.mm != null) {
        const c = L.circleMarker([p.lat, p.lon], { pane: PANE_LLUVIA, radius: radioLluvia(nota.mm), weight: 1, fillOpacity: 0.35, interactive: false });
        circulos.push(c); c.addTo(lluvia);
      }
    }
  }

  // Cotos: perezoso; el GeoJSON (1 MB) se pide al activar la capa o al llegar a zoom ≥ 9
  let geojson = null, cargando = false;
  const pintarCotos = (capa) => { capa.setStyle((f) => estiloCoto(f.properties, t)); };
  async function asegurarCotos() {
    if (geojson || cargando || !mapa.hasLayer(cotos)) return;
    cargando = true;
    try {
      const datosCotos = await cargarCotos();
      const feats = [...datosCotos.features].sort((a, b) => (a.properties.tipo === 'prohibido') - (b.properties.tipo === 'prohibido'));   // los prohibidos, encima
      geojson = L.geoJSON({ type: 'FeatureCollection', features: feats }, {
        style: (f) => estiloCoto(f.properties, t),
        onEachFeature: (f, capa) => {
          capa.bindPopup(() => popupCoto(f.properties, normas), POPUP);
          capa.bindTooltip(f.properties.nombre, { sticky: true });
        },
      });
      cotos.addLayer(geojson);
    } catch (e) {
      elemento.dispatchEvent(new CustomEvent('mapa-error', { detail: e.message }));
    } finally { cargando = false; }
  }
  const cotosPorZoom = () => { if (mapa.getZoom() >= 9) asegurarCotos(); };

  function reaplicar() {
    t = tokens();
    rectangulos.forEach((r) => r.setStyle({ color: t.acento }));
    marcadores.forEach(({ m, nota }) => m.setStyle({ color: t.superficie, fillColor: nota.valor == null ? t.sinDatos : t.nivel(nivelDe(nota.valor)) }));
    circulos.forEach((c) => c.setStyle({ color: t.lluvia, fillColor: t.lluvia }));
    if (geojson) pintarCotos(geojson);
  }
  reaplicar();

  // Control de capas
  const superpuestas = {};
  const ofrecidas = { zonas: ['Zonas y puntos', zonas], cotos: ['Cotos y prohibiciones', cotos], lluvia: ['Lluvia de 26 días', lluvia] };
  for (const c of capas) if (ofrecidas[c]) superpuestas[ofrecidas[c][0]] = ofrecidas[c][1];
  L.control.layers(bases, superpuestas, { collapsed: true }).addTo(mapa);
  const porNombre = Object.fromEntries(Object.entries(ofrecidas).map(([id, [n, g]]) => [id, g]));
  for (const c of capas) {
    if (!porNombre[c]) continue;
    const por = activas ? activas.includes(c) : c !== 'lluvia';   // por defecto: zonas y cotos encendidas, lluvia apagada
    if (por) porNombre[c].addTo(mapa);
  }
  if (capas.includes('salidas')) salidas.addTo(mapa);

  mapa.on('overlayadd', (e) => { if (e.layer === cotos) asegurarCotos(); });
  mapa.on('zoomend', cotosPorZoom);
  mapa.on('baselayerchange', () => onCambio({ base: Object.keys(bases).find((n) => mapa.hasLayer(bases[n])) }));
  const estadoCapas = () => onCambio({ activas: Object.keys(porNombre).filter((id) => mapa.hasLayer(porNombre[id])) });
  mapa.on('overlayadd overlayremove', estadoCapas);
  mapa.on('moveend', () => { if (encuadre || !dimensionado()) return; const c = mapa.getCenter(); onCambio({ vista: { lat: c.lat, lon: c.lng, zoom: mapa.getZoom() } }); });

  // Vista inicial: la guardada, o todas las zonas. Un fitBounds con el contenedor aún sin medir
  // (se inserta en la página después) daría el zoom máximo, así que se aplica al primer tamaño real.
  const limites = datos?.zonas?.length ? L.latLngBounds(datos.zonas.map(limitesZona).flat()) : null;
  const dimensionado = () => elemento.clientWidth > 0 && elemento.clientHeight > 0;
  let encuadre = vista ? null : () => (limites ? mapa.fitBounds(limites, { padding: [20, 20], animate: false }) : mapa.setView([40.4, -3.7], 6));
  if (vista) mapa.setView([vista.lat, vista.lon], vista.zoom); else mapa.setView([40.4, -3.7], 6);
  const enfocar = (z) => mapa.fitBounds(limitesZona(z), { padding: [20, 20], animate: false });
  function encuadrar(fn) { if (dimensionado()) { encuadre = null; fn(); } else encuadre = fn; }
  if (encuadre) encuadrar(encuadre);
  asegurarCotos();
  cotosPorZoom();

  // Cambio de tema: los colores ya resueltos se vuelven a leer
  const oscuro = matchMedia('(prefers-color-scheme: dark)');
  const alCambiarTema = () => requestAnimationFrame(reaplicar);
  oscuro.addEventListener('change', alCambiarTema);
  const observador = new MutationObserver(alCambiarTema);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  // El contenedor se mide al insertarlo en la página
  const medida = new ResizeObserver(() => { mapa.invalidateSize(); if (encuadre && dimensionado()) { const f = encuadre; encuadre = null; f(); } });
  medida.observe(elemento);

  return {
    mapa, capaSalidas: salidas,
    enfocarZona(id) {
      const z = datos?.zonas?.find((x) => x.id === id);
      if (z) encuadrar(() => enfocar(z));
      return !!z;
    },
    destruir() {
      oscuro.removeEventListener('change', alCambiarTema);
      observador.disconnect(); medida.disconnect();
      // Leaflet 1.9: remove() en mitad de una animación de zoom deja un temporizador que falla al terminar.
      mapa._animatingZoom = false;
      mapa.remove();
    },
  };
}

// Leyenda fija: tipos de coto, precisión del límite, semáforo de los puntos y círculo de lluvia.
export function leyenda() {
  const muestra = (tipo, precision = 'oficial') => {
    const e = estiloCoto({ tipo, precision }, null);
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'mapa-leyenda__muestra'); s.setAttribute('viewBox', '0 0 28 18'); s.setAttribute('aria-hidden', 'true');
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    for (const [k, v] of Object.entries({ x: 2, y: 2, width: 24, height: 14, rx: 3 })) r.setAttribute(k, v);
    // Es DOM, no capa de Leaflet: aquí var(--…) sí se resuelve y sigue al tema solo.
    Object.assign(r.style, { stroke: e.color, strokeWidth: e.weight, fill: e.fillColor, fillOpacity: e.fillOpacity + 0.1, strokeDasharray: e.dashArray ?? 'none' });
    s.append(r);
    return s;
  };
  const item = (nodo, texto) => el('li', { clase: 'mapa-leyenda__item' }, nodo, el('span', { texto }));
  const punto = (nivel) => {
    const s = el('span', { clase: 'mapa-leyenda__punto', attrs: { 'aria-hidden': 'true' } });
    s.style.background = `var(--c-sem-${nivel})`;
    return s;
  };
  return el('section', { clase: 'tarjeta mapa-leyenda', attrs: { 'aria-labelledby': 'mapa-leyenda-titulo' } },
    el('h2', { clase: 'mapa-leyenda__titulo', texto: 'Leyenda', id: 'mapa-leyenda-titulo' }),
    el('h3', { texto: 'Cotos' }),
    el('ul', { clase: 'mapa-leyenda__lista' }, ['prohibido', 'acotado', 'parque-micologico', 'regulado'].map((k) => item(muestra(k), TIPOS[k]))),
    el('h3', { texto: 'Precisión del límite' }),
    el('ul', { clase: 'mapa-leyenda__lista' }, Object.keys(PRECISION_LEYENDA).map((k) => item(muestra('acotado', k), PRECISION_LEYENDA[k]))),
    el('h3', { texto: 'Nota de hoy en cada punto' }),
    el('ul', { clase: 'mapa-leyenda__lista' }, ['nulo', 'bajo', 'posible', 'bueno', 'muy-bueno'].map((n) => item(punto(n), palabraDe(n)))),
    el('h3', { texto: 'Círculo de lluvia' }),
    el('p', { clase: 'texto-2 texto-s', texto: `Radio proporcional a la lluvia de los últimos 26 días (25 mm = ${Math.round(radioLluvia(25))} px, 100 mm = ${Math.round(radioLluvia(100))} px). Actívalo en el control de capas.` }));
}

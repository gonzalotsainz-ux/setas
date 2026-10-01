// js/mapa/fondos.js
// Fondos del mapa (spec §2, comprobados el 01/10/2026) y capas superpuestas, con la elección guardada en el dispositivo.
import { el } from '../ui/dom.js';
import { leer, guardar, almacenPorDefecto } from '../cache.js';
import { NIVELES, palabraDe } from '../ui/semaforo.js';
import { NIVEL_COLOR } from './colores.js';
import { WMTS, ATR_IGN, IGN_BASE, IGN_TOPOGRAFICO, IGN_PNOA } from './wmts.js';

// El mapa claro de CARTO pide clave desde 2026 (sin ella, cada tesela es un «API KEY REQUIRED»): tarea 0, D7.
// Con null el fondo claro es la Base IGN. Si algún día hay clave publicable, basta poner aquí la plantilla completa
// (con {s}, {z}, {x}, {y}, {r} y la clave) y el fondo claro pasa a ser el de CARTO, con su atribución obligatoria.
export const CARTO_URL = null;
const CLARO = CARTO_URL
  ? { url: CARTO_URL, opciones: { subdomains: 'abcd', maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>' } }
  : { url: IGN_BASE.url, opciones: { maxNativeZoom: 18, maxZoom: 18, attribution: IGN_BASE.atribucion } };

// Relieve del IDEE: el servicio responde 200 hasta el zoom 19 (01/10/2026), pero por encima del 16 es remuestreo del
// servidor; se pide nativo hasta el 16 y Leaflet amplía el resto.
export const FONDOS = {
  mapa: { nombre: 'Mapa', capas: [CLARO] },
  relieve: { nombre: 'Relieve', capas: [CLARO, { url: WMTS('https://servicios.idee.es/wmts/mdt', 'Relieve', 'jpeg'),
    opciones: { className: 'capa-multiply', maxNativeZoom: 16, maxZoom: 18, attribution: `Relieve IDEE: ${ATR_IGN}` } }] },
  topografico: { nombre: 'Topográfico IGN', capas: [{ url: IGN_TOPOGRAFICO.url, opciones: { maxNativeZoom: 18, maxZoom: 18, attribution: IGN_TOPOGRAFICO.atribucion } }] },
  satelite: { nombre: 'Satélite PNOA', capas: [{ url: IGN_PNOA.url, opciones: { maxNativeZoom: 18, maxZoom: 18, attribution: IGN_PNOA.atribucion } }] },
};
export const FONDO_POR_DEFECTO = 'mapa';
export const SUPERPUESTAS = { cotos: 'Cotos', prohibido: 'Prohibido', lluvia: 'Lluvia', sitios: 'Sitios', diario: 'Diario' };
export const ACTIVAS_POR_DEFECTO = ['prohibido', 'sitios'];

export const textoAtribucion = (fondo) => fondo.capas.map((c) => c.opciones.attribution.replace(/<[^>]+>/g, '')).filter((t, k, a) => a.indexOf(t) === k).join(' · ');
export const crearFondo = (L, id) => L.layerGroup((FONDOS[id] ?? FONDOS[FONDO_POR_DEFECTO]).capas.map((c) => L.tileLayer(c.url, c.opciones)));

// Preferencias en localStorage: leer y guardar (js/cache.js) nunca lanzan, y lo guardado se valida al leer.
const CLAVE = 'mapa-capas';
export function leerPreferencias(almacen = almacenPorDefecto()) {
  const p = leer(CLAVE, almacen)?.datos;
  return {
    fondo: typeof p?.fondo === 'string' && Object.hasOwn(FONDOS, p.fondo) ? p.fondo : FONDO_POR_DEFECTO,
    activas: Array.isArray(p?.activas) ? p.activas.filter((x) => Object.hasOwn(SUPERPUESTAS, x)) : [...ACTIVAS_POR_DEFECTO],
  };
}
export const guardarPreferencias = (p, almacen = almacenPorDefecto()) => guardar(CLAVE, { fondo: p.fondo, activas: p.activas }, undefined, almacen);

function leyendaManchas() {
  // «Sin datos», en damero como en el mapa (js/rejilla/pintor.js): no se confunde con el gris liso de «Nulo».
  const punto = (nivel) => { const s = el('span', { clase: 'mapa-leyenda__punto', attrs: { 'aria-hidden': 'true' } });
    s.style.background = nivel === 'sin-datos' ? `repeating-conic-gradient(${NIVEL_COLOR[nivel]} 0 25%, transparent 0 50%) 0 0 / 6px 6px` : NIVEL_COLOR[nivel]; return s; };
  return el('div', { clase: 'mapa-panel__leyenda' },
    el('h3', { texto: 'Manchas' }),
    el('ul', { clase: 'mapa-leyenda__lista' }, [...NIVELES, 'sin-datos'].map((n) => el('li', { clase: 'mapa-leyenda__item' }, punto(n), el('span', { texto: n === 'sin-datos' ? 'Sin datos suficientes' : palabraDe(n) })))),
    el('p', { clase: 'texto-2 texto-s', texto: 'Solo se colorea el monte apropiado. Las zonas prohibidas nunca llevan mancha.' }));
}

// Panel de fondos y capas, con su botón «Cerrar» de 44 px. Escape y «Cerrar» llaman a alCerrar, que DEBE quitar el panel
// del DOM, y el foco vuelve a donde estaba al abrirlo. El foco inicial (a la opción marcada) se da en un microtask:
// exige insertar el panel en el documento de forma síncrona, justo tras crearlo.
export function panelCapas({ fondo, activas, alCambiar, alCerrar }) {
  const anterior = globalThis.document?.activeElement;
  const fondos = el('fieldset', { clase: 'mapa-panel__grupo' }, el('legend', { texto: 'Fondo' }));
  for (const [id, f] of Object.entries(FONDOS)) {
    const input = el('input', { type: 'radio', name: 'mapa-fondo', value: id, checked: id === fondo });
    input.addEventListener('change', () => alCambiar({ fondo: id }));
    fondos.append(el('label', { clase: 'mapa-panel__opcion' }, input, el('span', { texto: f.nombre })));
  }
  const capas = el('fieldset', { clase: 'mapa-panel__grupo' }, el('legend', { texto: 'Capas' }));
  for (const [id, nombre] of Object.entries(SUPERPUESTAS)) {
    const input = el('input', { type: 'checkbox', value: id, checked: activas.includes(id) });
    input.addEventListener('change', () => alCambiar({ capa: id, activa: input.checked }));
    capas.append(el('label', { clase: 'mapa-panel__opcion' }, input, el('span', { texto: nombre })));
  }
  const panel = el('div', { clase: 'mapa-panel', attrs: { role: 'dialog', 'aria-label': 'Capas del mapa' } }, fondos, capas, leyendaManchas());
  const cerrar = () => { alCerrar?.(); anterior?.focus?.(); };
  const botonCerrar = el('button', { clase: 'boton boton--compacto mapa-panel__cerrar', type: 'button', texto: 'Cerrar' });
  botonCerrar.addEventListener('click', cerrar);
  panel.append(botonCerrar);
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    cerrar();
  });
  queueMicrotask(() => panel.querySelector?.('input:checked')?.focus?.());
  return panel;
}

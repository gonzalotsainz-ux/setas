// js/mapa/fondos.js
// Fondos del mapa (spec §2, comprobados el 01/10/2026) y capas superpuestas, con la elección guardada en el dispositivo.
import { el } from '../ui/dom.js';
import { leer, guardar, almacenPorDefecto } from '../cache.js';
import { NIVELES, palabraDe } from '../ui/semaforo.js';
import { NIVEL_COLOR } from './colores.js';

const WMTS = (base, capa, fmt) => `${base}?service=WMTS&request=GetTile&version=1.0.0&layer=${capa}&style=default&format=image/${fmt}&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}`;
const ATR_IGN = '© <a href="https://www.scne.es">Instituto Geográfico Nacional</a> CC BY 4.0';
// El mapa claro de CARTO pide clave desde 2026 (sin ella, cada tesela es un «API KEY REQUIRED»): tarea 0, D7.
// Con null el fondo claro es la Base IGN. Si algún día hay clave publicable, basta poner aquí la plantilla completa
// (con {s}, {z}, {x}, {y}, {r} y la clave) y el fondo claro pasa a ser el de CARTO, con su atribución obligatoria.
export const CARTO_URL = null;
const CLARO = CARTO_URL
  ? { url: CARTO_URL, opciones: { subdomains: 'abcd', maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>' } }
  : { url: WMTS('https://www.ign.es/wmts/ign-base', 'IGNBaseTodo', 'jpeg'), opciones: { maxNativeZoom: 18, maxZoom: 18, attribution: ATR_IGN } };

// Relieve del IDEE: el servicio respondió 200 con teselas de más de 1 KB del zoom 15 al 19 (comprobado el 01/10/2026);
// se pide nativo hasta el 17, el mayor de los tres que fija la comprobación del plan (15, 16 y 17).
export const FONDOS = {
  mapa: { nombre: 'Mapa', capas: [CLARO] },
  relieve: { nombre: 'Relieve', capas: [CLARO, { url: WMTS('https://servicios.idee.es/wmts/mdt', 'Relieve', 'jpeg'),
    opciones: { className: 'capa-multiply', maxNativeZoom: 17, maxZoom: 18, attribution: `Relieve: ${ATR_IGN}` } }] },
  topografico: { nombre: 'Topográfico IGN', capas: [{ url: WMTS('https://www.ign.es/wmts/mapa-raster', 'MTN', 'jpeg'), opciones: { maxNativeZoom: 18, maxZoom: 18, attribution: ATR_IGN } }] },
  satelite: { nombre: 'Satélite PNOA', capas: [{ url: WMTS('https://www.ign.es/wmts/pnoa-ma', 'OI.OrthoimageCoverage', 'jpeg'), opciones: { maxNativeZoom: 18, maxZoom: 18, attribution: `PNOA cedido por ${ATR_IGN}` } }] },
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
  const punto = (nivel) => { const s = el('span', { clase: 'mapa-leyenda__punto', attrs: { 'aria-hidden': 'true' } }); s.style.background = NIVEL_COLOR[nivel]; return s; };
  return el('div', { clase: 'mapa-panel__leyenda' },
    el('h3', { texto: 'Manchas' }),
    el('ul', { clase: 'mapa-leyenda__lista' }, [...NIVELES, 'sin-datos'].map((n) => el('li', { clase: 'mapa-leyenda__item' }, punto(n), el('span', { texto: n === 'sin-datos' ? 'Sin datos suficientes' : palabraDe(n) })))),
    el('p', { clase: 'texto-2 texto-s', texto: 'Solo se colorea el monte apropiado. Las zonas prohibidas nunca llevan mancha.' }));
}

// Panel de fondos y capas. Escape lo cierra (llama a alCerrar) y el foco vuelve a donde estaba al abrirlo; al abrirse,
// el foco pasa a la opción marcada. alCerrar es opcional: quien monta el panel decide cómo se quita de la pantalla.
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
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    alCerrar?.();
    anterior?.focus?.();
  });
  queueMicrotask(() => panel.querySelector?.('input:checked')?.focus?.());
  return panel;
}

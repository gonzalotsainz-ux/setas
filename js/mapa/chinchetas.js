// Chinchetas del mapa: una por zona (lejos) y una por monte (cerca), con la nota y el nombre corto.
import { nombreCorto, puntosRecogibles, rotuloPunto } from '../datos.js';
import { notaPuntoDia } from '../notas-zona.js';
import { nivelDe, palabraDe } from '../ui/semaforo.js';
import { ZOOM_MIN_FINA } from '../rejilla/carga.js';

export const ZOOM_MONTES = ZOOM_MIN_FINA;
export const ZOOM_ETIQUETAS = 13;
// La chincheta (44 px y la punta) queda encima de su ancla: tanto sube sobre el punto (iconAnchor).
export const ALTO_CHINCHETA = 52;
const ANCHO_CHINCHETA = 64;

export const queChinchetas = (zoom) => (zoom < ZOOM_MONTES ? 'zonas' : 'montes');

export function centroide(zona) {
  const r = puntosRecogibles(zona);
  const ps = r.length ? r : zona.puntos;
  const media = (k) => ps.reduce((s, p) => s + p[k], 0) / ps.length;
  return { lat: media('lat'), lon: media('lon') };
}

const minuscula = (t) => t.charAt(0).toLowerCase() + t.slice(1);

export function textoAria(c) {
  if (c.noIr) return `${c.texto}, ${c.rotulo.texto}`;
  if (c.valor == null) return `${c.texto}, sin datos`;
  return `${c.texto}, ${c.valor}, ${minuscula(palabraDe(c.nivel))}`;
}

// Lo que se lee en grande: la nota, «?» sin datos o «NO IR» (gris con borde de peligro: no es «sin datos»).
export const textoChincheta = (c) => (c.noIr ? 'NO IR' : String(c.valor ?? '?'));

export function chinchetasZonas(filas) {
  return filas.map((f, i) => {
    const valor = f.res?.valor ?? null;
    const c = { tipo: 'zona', id: f.zona.id, ...centroide(f.zona), valor, nivel: nivelDe(valor), texto: nombreCorto(f.zona), pos: i + 1 };
    return { ...c, aria: textoAria(c) };
  });
}

export function chinchetasMontes(zonas, datos, meteo, d, filtro, umbrales) {
  return zonas.flatMap((zona) => zona.puntos.map((punto) => {
    const noIr = punto.noIr === true;
    const valor = noIr ? null : (notaPuntoDia(zona, punto, datos, meteo, d, filtro, umbrales).valor ?? null);
    const c = { tipo: 'punto', zona: zona.id, id: punto.id, lat: punto.lat, lon: punto.lon, valor, nivel: nivelDe(valor),
      texto: punto.corto, noIr, rotulo: rotuloPunto(punto) };
    return { ...c, aria: textoAria(c) };
  }));
}

// ---- Solo DOM (Leaflet): sin lógica de datos ----
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function crearCapaChinchetas(L, { alTocar }) {
  const capa = L.layerGroup();
  // seleccionada = { tipo, id } (una zona y un monte pueden llamarse igual): va encima de las demás.
  const poner = (lista, seleccionada = null) => {
    capa.clearLayers();
    for (const c of lista) {
      const elegida = seleccionada != null && c.tipo === seleccionada.tipo && c.id === seleccionada.id;
      const sel = elegida ? ' data-seleccionada="true"' : '', noIr = c.noIr ? ' data-no-ir="true"' : '';
      const html = `<button type="button" class="chincheta" data-nivel="${c.nivel}"${sel}${noIr} aria-label="${esc(c.aria)}"><b>${esc(textoChincheta(c))}</b><small>${esc(c.texto)}</small></button>`;
      const icon = L.divIcon({ className: '', html, iconSize: [ANCHO_CHINCHETA, 48], iconAnchor: [ANCHO_CHINCHETA / 2, ALTO_CHINCHETA] });
      const m = L.marker([c.lat, c.lon], { icon, zIndexOffset: elegida ? 1000 : (c.valor ?? -1), keyboard: false });
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); alTocar(c); });
      capa.addLayer(m);
    }
  };
  return { capa, poner, limpiar: () => capa.clearLayers() };
}

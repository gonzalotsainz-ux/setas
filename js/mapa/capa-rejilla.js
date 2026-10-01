// js/mapa/capa-rejilla.js
// Capa de Leaflet que dibuja en un canvas las imágenes de la rejilla (1 celda = 1 píxel) escaladas sin suavizado.
// Se redibuja al mover o hacer zoom; durante la animación de zoom se oculta para no desencajarse.
// Lleva la atribución del MFE50 y del MDT (CC BY: se cita donde se muestran los derivados). Los textos son los de
// scripts/rejilla/config.mjs (una prueba lo comprueba).
import { aGrados, ORIGEN } from '../rejilla/geo.js';

export const ATRIBUCION_REJILLA = 'Laderas: <a href="https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/mfe50.html">'
  + 'Mapa Forestal de España 1:50.000 (MFE50) © Ministerio para la Transición Ecológica y el Reto Demográfico</a>; '
  + '<a href="https://servicios.idee.es/wcs-inspire/mdt">Obra derivada de MDT25 CC BY 4.0 scne.es</a>';

export function crearCapaRejilla(L) {
  return L.Layer.extend({
    options: { attribution: ATRIBUCION_REJILLA },
    initialize(opciones) { L.setOptions(this, opciones); this._imagenes = new Map(); },
    onAdd(mapa) {
      this._mapa = mapa;
      this._canvas = L.DomUtil.create('canvas', 'capa-rejilla');
      this._canvas.setAttribute('aria-hidden', 'true');
      this._canvas.style.pointerEvents = 'none';   // los toques van al mapa y a los marcadores
      mapa.getPane('rejilla').append(this._canvas);
      mapa.on('moveend zoomend resize viewreset', this._dibujar, this);
      mapa.on('zoomstart', this._ocultar, this);
      this._dibujar();
    },
    onRemove(mapa) {
      mapa.off('moveend zoomend resize viewreset', this._dibujar, this);
      mapa.off('zoomstart', this._ocultar, this);
      this._canvas.remove();
      this._canvas = null; this._mapa = null;
    },
    // `clave` (p. ej. archivo + día + chip + sello): si coincide con la de la imagen guardada, no se rehace el lienzo.
    // Sin clave se usa el propio `rgba`. tieneImagen permite saltarse el cálculo de las notas.
    tieneImagen(archivo, clave) { return clave != null && this._imagenes.get(archivo)?.clave === clave; },
    ponerImagen(archivo, cabecera, rgba, clave = rgba) {
      if (this._imagenes.get(archivo)?.clave === clave) return;
      const lienzo = document.createElement('canvas');
      lienzo.width = cabecera.ancho; lienzo.height = cabecera.alto;
      lienzo.getContext('2d').putImageData(new ImageData(rgba, cabecera.ancho, cabecera.alto), 0, 0);
      const no = aGrados(cabecera.col0 * cabecera.tam - ORIGEN, ORIGEN - cabecera.fila0 * cabecera.tam);
      const se = aGrados((cabecera.col0 + cabecera.ancho) * cabecera.tam - ORIGEN, ORIGEN - (cabecera.fila0 + cabecera.alto) * cabecera.tam);
      this._imagenes.set(archivo, { clave, lienzo, limites: L.latLngBounds([se.lat, no.lon], [no.lat, se.lon]) });
      this._dibujar();
    },
    quitarTodo() { this._imagenes.clear(); this._dibujar(); },
    _ocultar() { if (this._canvas) this._canvas.style.visibility = 'hidden'; },
    _dibujar() {
      const m = this._mapa, c = this._canvas;
      if (!m || !c) return;
      const tam = m.getSize(), dpr = window.devicePixelRatio || 1;
      const ancho = Math.round(tam.x * dpr), alto = Math.round(tam.y * dpr);
      if (c.width !== ancho || c.height !== alto) {
        c.width = ancho; c.height = alto;
        c.style.width = `${tam.x}px`; c.style.height = `${tam.y}px`;
      }
      L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
      const ctx = c.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ancho, alto);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const vista = m.getBounds();
      for (const { lienzo, limites } of this._imagenes.values()) {
        if (!vista.intersects(limites)) continue;
        const a = m.latLngToContainerPoint(limites.getNorthWest()), b = m.latLngToContainerPoint(limites.getSouthEast());
        ctx.drawImage(lienzo, a.x, a.y, b.x - a.x, b.y - a.y);
      }
      c.style.visibility = 'visible';
    },
  });
}

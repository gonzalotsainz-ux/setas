// js/mapa/capa-etiquetas.js
// Etiquetas flotantes de las mejores manchas de la vista (nivel 3): hasta tres, con la especie, la nota y umbría, solana o altitud.
// Elige entre las notas que la pantalla ya tiene (sin recalcular nada) y pone los marcadores; tocar uno es tocar esa celda.
import { aGrados, aMercator, celdaFina, centroFina } from '../rejilla/geo.js';
import { PROHIBIDO, CODIGO } from '../rejilla/formato.js';
import { SIN_COLOR } from '../rejilla/pintor.js';
import { elegirEtiquetas, separar, textoEtiqueta } from '../rejilla/etiquetas.js';
import { notaDeLadera } from './toque-celda.js';
import { nivelDe } from '../ui/semaforo.js';
import { comun } from '../ui/ficha.js';
import { mayus } from '../ui/dom.js';

const MAX = 3, SEPARACION = 12;
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// Las notas de `archivo` que caen dentro de `bounds` ([o, s, e, n]); el resto, SIN_COLOR.
function recortar(notas, a, bounds) {
  const nw = celdaFina(...Object.values(aMercator(bounds[0], bounds[3]))), se = celdaFina(...Object.values(aMercator(bounds[2], bounds[1])));
  const dentro = new Uint8Array(notas.length).fill(SIN_COLOR), alto = Math.floor(notas.length / a.ancho);
  for (let f = Math.max(0, nw.fila - a.fila0); f <= Math.min(alto - 1, se.fila - a.fila0); f++) {
    for (let c = Math.max(0, nw.col - a.col0); c <= Math.min(a.ancho - 1, se.col - a.col0); c++) dentro[f * a.ancho + c] = notas[f * a.ancho + c];
  }
  return dentro;
}

// archivos = [{ a (del índice), r (rejilla cargada), notas }] → [{ lat, lon, texto, valor, nivel }] (como mucho 3).
export function etiquetasDeVista({ archivos, bounds, ctx }) {
  const candidatas = [];
  for (const { a, r, notas } of archivos) {
    for (const e of elegirEtiquetas({ notas: recortar(notas, a, bounds), ancho: a.ancho, max: MAX, separacion: SEPARACION })) {
      candidatas.push({ ...e, archivo: a, r, col: e.col + a.col0, fila: e.fila + a.fila0 });   // col y fila globales
    }
  }
  const salida = [];
  for (const c of separar(candidatas, { max: candidatas.length, separacion: SEPARACION })) {
    if (salida.length >= MAX) break;
    const h = c.r.habitat[c.k];
    if ((h & PROHIBIDO) || !(h & CODIGO)) continue;   // nunca sobre una zona prohibida (el índice ya las deja sin color)
    const m = centroFina(c.col, c.fila), { lat, lon } = aGrados(m.x, m.y);
    const { nota, celda, altitud } = notaDeLadera({ r: c.r, archivo: c.archivo.archivo, k: c.k, lat, lon, ctx });
    if (nota.sinEspecies || nota.valor == null || !nota.especie) continue;
    salida.push({ lat, lon, valor: nota.valor, nivel: nivelDe(nota.valor),
      texto: textoEtiqueta({ especie: mayus(comun(nota.especie)), valor: nota.valor, orientacion: celda.orientacion, altitud }) });
  }
  return salida;
}

export function crearCapaEtiquetas(L, { pane = 'puntos', alTocar }) {
  const capa = L.layerGroup();
  const poner = (lista) => {
    capa.clearLayers();
    for (const e of lista) {
      const icon = L.divIcon({ className: '', html: `<span class="etiqueta-mancha" data-nivel="${e.nivel}">${esc(e.texto)}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] });
      const m = L.marker([e.lat, e.lon], { icon, pane, interactive: true, title: e.texto, zIndexOffset: e.valor });
      m.on('click', (ev) => { L.DomEvent.stopPropagation(ev); alTocar(L.latLng(e.lat, e.lon)); });
      capa.addLayer(m);
    }
  };
  return { capa, poner, limpiar: () => capa.clearLayers() };
}

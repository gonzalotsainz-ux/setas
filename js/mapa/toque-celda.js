// js/mapa/toque-celda.js
// Qué hay bajo un toque en el mapa (nivel 3): zona prohibida (por el polígono o por la marca de la rejilla), una
// ladera con su nota del día y del chip, o nada (sin mancha). Sin estado propio: la pantalla le pasa lo que tiene.
import { aMercator, celdaFina } from '../rejilla/geo.js';
import { PROHIBIDO, CODIGO, FUERA_PROVINCIAS } from '../rejilla/formato.js';
import { archivoDeCelda, ZOOM_MIN_FINA } from '../rejilla/carga.js';
import { gruesasDeArchivo } from '../rejilla/pintor.js';
import { notaCelda, corregirAltitud } from '../rejilla/nota.js';
import { agregadosDeCelda, serieLluvia } from '../rejilla/salida.js';
import { modeloHoja } from './hoja.js';
import { desglose } from '../ui/desglose.js';
import { origenDeCelda } from '../ui/origen-lluvia.js';
import { graficoLluvia } from '../ui/grafico-lluvia.js';
import { el } from '../ui/dom.js';

const grafico = (celdaSalida) => () => { const fig = el('figure', { clase: 'grafico' }); fig.innerHTML = graficoLluvia({ serie: serieLluvia(celdaSalida), altura: 220 }); return fig; };

// → { modelo, extra } (prohibido o ladera) | null (sin mancha: la hoja vuelve a lo elegido).
// ctx = { datos, normas, rej, salida, cargador, gruesasPorArchivo, especiesZona, fecha, filtro, zoom, conManchas, poligonoEn }
export async function resolverToque({ lat, lng: lon }, ctx) {
  const { datos, normas, rej, salida, cargador, gruesasPorArchivo, especiesZona, fecha, filtro, zoom, conManchas, poligonoEn } = ctx;
  const prohibido = await poligonoEn(lon, lat, (p) => p.tipo === 'prohibido');
  if (prohibido) return { modelo: modeloHoja({ prohibido: prohibido.properties, normas }), extra: {} };
  if (!conManchas || zoom < ZOOM_MIN_FINA) return null;
  const m = aMercator(lon, lat), c = celdaFina(m.x, m.y), a = archivoDeCelda(rej.indice, c.col, c.fila);
  if (!a) return null;
  const r = await cargador.cargar(a.archivo);
  const k = (c.fila - a.fila0) * a.ancho + (c.col - a.col0), h = r.habitat[k];
  // Marca de prohibido de la rejilla (centro o esquina dentro de un prohibido): hoja roja, nunca la de monte.
  if (h & PROHIBIDO) return { modelo: modeloHoja({ prohibido: { nombre: 'Zona prohibida' }, normas }), extra: {} };
  if (!(h & CODIGO)) return null;   // sin monte apropiado: no hay hoja de ladera
  if (!gruesasPorArchivo.has(a.archivo)) gruesasPorArchivo.set(a.archivo, gruesasDeArchivo(r, rej.gruesa));
  const g = rej.gruesa.celdas[gruesasPorArchivo.get(a.archivo)[k]] ?? null;
  const celda = { habitat: r.cabecera.habitats[(h & CODIGO) - 1], altitud: r.altitud[k], orientacion: r.terreno[k] & 0x0f, tramo: r.terreno[k] >> 4,
    lat, lon, fueraProvincias: Boolean(h & FUERA_PROVINCIAS) };
  const enSalida = g && Object.hasOwn(salida.celdas, g.id) ? salida.celdas[g.id] : null;
  const ag = enSalida ? agregadosDeCelda(salida, g.id, fecha) : null;
  const altRef = enSalida?.altRef;   // sin ella, la nota queda «sin datos», igual que la mancha gris
  const zona = datos.zonas.find((z) => z.id === r.cabecera.zona) ?? null;
  // La nota con la altitud en tramos de 10 m, igual que el pintor (así hoja y mancha coinciden); la exacta, en «Altitud».
  const altitud = Math.round(celda.altitud / 10) * 10;
  const nota = notaCelda({ ag, ...celda, altitud, altRef, especies: especiesZona.get(zona?.id) ?? [], fecha, filtro });
  if (nota.sinEspecies) return null;
  const coto = await poligonoEn(lon, lat, (p) => p.tipo !== 'prohibido');
  let agHoja = null;
  try { agHoja = ag && corregirAltitud(ag, altitud - altRef); } catch { agHoja = null; }
  const modelo = modeloHoja({ celda, nota, ag: agHoja, coto: coto?.properties ?? null, zona, lluvia: origenDeCelda(enSalida) });
  if (!modelo) return null;
  return { modelo, extra: { desglose: nota.resultado ? () => desglose(nota.resultado) : null, grafico: enSalida?.lluvia ? grafico(enSalida) : null } };
}

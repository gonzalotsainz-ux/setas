// js/rejilla/trabajador.js
// Web Worker del pintado del mapa: calcula las notas de un archivo de rejilla fuera del hilo principal.
// `gruesa` y `salida` llegan aparte ({ fijos }) y solo cuando cambian; cada cálculo usa los últimos recibidos.
// `rejilla` y `gruesas` de cada archivo llegan una vez ({ archivo }) y se guardan por nombre.
import { notasDeArchivo } from './pintor.js';
import { MAX_ARCHIVOS } from './notas-async.js';

const fijos = {}, archivos = new Map();
// LRU: cada uso (guardar o calcular) pasa el archivo al final; pasado el tope se expulsa el más antiguo.
function guardar(nombre, datos) {
  archivos.delete(nombre); archivos.set(nombre, datos);
  if (archivos.size > MAX_ARCHIVOS) archivos.delete(archivos.keys().next().value);
}
function usar(nombre) {
  const d = archivos.get(nombre);
  if (d) { archivos.delete(nombre); archivos.set(nombre, d); }
  return d;
}
self.onmessage = (e) => {
  if (e.data.fijos) { Object.assign(fijos, e.data.fijos); return; }
  if (e.data.archivo) { const { nombre, rejilla, gruesas } = e.data.archivo; guardar(nombre, { rejilla, gruesas }); return; }
  const { id, args } = e.data;
  try {
    const notas = notasDeArchivo({ ...fijos, ...(args.archivo != null ? usar(args.archivo) : null), ...args });
    self.postMessage({ id, notas }, [notas.buffer]);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};

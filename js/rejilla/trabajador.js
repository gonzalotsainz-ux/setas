// js/rejilla/trabajador.js
// Web Worker del pintado del mapa: calcula las notas de un archivo de rejilla fuera del hilo principal.
// `gruesa` y `salida` llegan aparte ({ fijos }) y solo cuando cambian; cada cálculo usa los últimos recibidos.
// `rejilla` y `gruesas` de cada archivo llegan una vez ({ archivo }) y se guardan por nombre.
import { notasDeArchivo } from './pintor.js';

const fijos = {}, archivos = new Map();
self.onmessage = (e) => {
  if (e.data.fijos) { Object.assign(fijos, e.data.fijos); return; }
  if (e.data.archivo) { const { nombre, rejilla, gruesas } = e.data.archivo; archivos.set(nombre, { rejilla, gruesas }); return; }
  const { id, args } = e.data;
  try {
    const notas = notasDeArchivo({ ...fijos, ...(args.archivo != null ? archivos.get(args.archivo) : null), ...args });
    self.postMessage({ id, notas }, [notas.buffer]);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};

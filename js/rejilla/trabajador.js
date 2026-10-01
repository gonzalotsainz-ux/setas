// js/rejilla/trabajador.js
// Web Worker del pintado del mapa: calcula las notas de un archivo de rejilla fuera del hilo principal.
// `gruesa` y `salida` llegan aparte ({ fijos }) y solo cuando cambian; cada cálculo usa los últimos recibidos.
import { notasDeArchivo } from './pintor.js';

const fijos = {};
self.onmessage = (e) => {
  if (e.data.fijos) { Object.assign(fijos, e.data.fijos); return; }
  const { id, args } = e.data;
  try {
    const notas = notasDeArchivo({ ...fijos, ...args });
    self.postMessage({ id, notas }, [notas.buffer]);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};

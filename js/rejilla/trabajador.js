// js/rejilla/trabajador.js
// Web Worker del pintado del mapa: calcula las notas de un archivo de rejilla fuera del hilo principal.
import { notasDeArchivo } from './pintor.js';

self.onmessage = (e) => {
  const { id, args } = e.data;
  try {
    const notas = notasDeArchivo(args);
    self.postMessage({ id, notas }, [notas.buffer]);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};

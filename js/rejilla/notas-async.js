// js/rejilla/notas-async.js
// Cálculo de las notas de un archivo, en el hilo principal o en un Web Worker (tarea 15: se activa si la medida
// de scripts/rejilla/medir-pintado.mjs, en Node × 4, pasa de 200 ms; la medida está en docs/datos.md).
import { notasDeArchivo } from './pintor.js';

export const USAR_TRABAJADOR = true;
let trabajador = null, siguiente = 0;
const pendientes = new Map();

function crearTrabajador() {
  const w = new Worker(new URL('./trabajador.js', import.meta.url), { type: 'module' });
  w.onmessage = (e) => { const p = pendientes.get(e.data.id); pendientes.delete(e.data.id); if (e.data.error) p?.ko(new Error(e.data.error)); else p?.ok(e.data.notas); };
  w.onerror = (e) => { for (const p of pendientes.values()) p.ko(new Error(e.message || 'Error en el cálculo del mapa')); pendientes.clear(); trabajador = null; };
  return w;
}

export function calcularNotas(args) {
  if (!USAR_TRABAJADOR || typeof Worker === 'undefined') return Promise.resolve(notasDeArchivo(args));
  trabajador ??= crearTrabajador();
  const id = ++siguiente;
  return new Promise((ok, ko) => { pendientes.set(id, { ok, ko }); trabajador.postMessage({ id, args }); });
}

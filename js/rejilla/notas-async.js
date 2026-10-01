// js/rejilla/notas-async.js
// Cálculo de las notas de un archivo, en el hilo principal o en un Web Worker (tarea 15: se activa si la medida
// de scripts/rejilla/medir-pintado.mjs, en Node × 4, pasa de 200 ms; la medida está en docs/datos.md).
// Si el Worker falla (no se puede crear, error de carga, mensaje ilegible, error en el cálculo o no contesta en
// PLAZO_MS), se descarta para el resto de la sesión y las peticiones pendientes y las siguientes se calculan en el hilo
// principal: ninguna promesa se queda pendiente para siempre.
// `gruesa` y `salida` (grandes y casi fijos) se mandan al Worker solo cuando cambian, no en cada llamada.
import { notasDeArchivo } from './pintor.js';

export const USAR_TRABAJADOR = true;
export const PLAZO_MS = 20000;
const FIJOS = ['gruesa', 'salida'];

const enHilo = (args) => new Promise((ok) => ok(notasDeArchivo(args)));   // un error del cálculo rechaza, no lanza

export function crearCalculador({ crearWorker = () => new Worker(new URL('./trabajador.js', import.meta.url), { type: 'module' }),
  usar = USAR_TRABAJADOR, plazo = PLAZO_MS } = {}) {
  let trabajador = null, roto = !usar, siguiente = 0;
  const pendientes = new Map(), enviados = {};

  function descartar() {
    roto = true;
    try { trabajador?.terminate?.(); } catch { /* ya no importa */ }
    trabajador = null;
    const quedan = [...pendientes.values()];
    pendientes.clear();
    for (const p of quedan) { clearTimeout(p.reloj); enHilo(p.args).then(p.ok, p.ko); }
  }

  function arrancar() {
    try { trabajador = crearWorker(); } catch { roto = true; return false; }
    trabajador.onmessage = (e) => {
      const p = pendientes.get(e.data?.id);
      if (!p) return;
      if (e.data.error != null || !(e.data.notas instanceof Uint8Array)) { descartar(); return; }
      pendientes.delete(e.data.id); clearTimeout(p.reloj); p.ok(e.data.notas);
    };
    trabajador.onerror = (e) => { e?.preventDefault?.(); descartar(); };
    trabajador.onmessageerror = () => descartar();
    for (const k of FIJOS) delete enviados[k];
    return true;
  }

  return function calcularNotas(args) {
    if (roto || (!trabajador && !arrancar())) return enHilo(args);
    const id = ++siguiente, resto = { ...args }, fijos = {};
    for (const k of FIJOS) {
      if (enviados[k] !== args[k]) { fijos[k] = args[k]; enviados[k] = args[k]; }
      delete resto[k];
    }
    return new Promise((ok, ko) => {
      const reloj = setTimeout(descartar, plazo);
      pendientes.set(id, { ok, ko, args, reloj });
      try {
        if (Object.keys(fijos).length) trabajador.postMessage({ fijos });
        trabajador.postMessage({ id, args: resto });
      } catch { descartar(); }   // p. ej. datos que no se pueden clonar
    });
  };
}

export const calcularNotas = crearCalculador();

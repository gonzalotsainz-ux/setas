// supabase/functions/pluvio/dias.js
// Lluvia por día de Madrid de cada estación. La función SQL lluvia_por_dia (migración 20261004000000) hace lo mismo en la
// base de datos; agregarHoras es su referencia en JS (la usan las pruebas y el almacén en memoria) y diasDeFilas pasa su
// salida (un array por columna y estación) a una fila por día.
import { fechaMadridDeFin } from './tiempo.js';

const r1 = (x) => Math.round(x * 10) / 10;

export function agregarHoras(filas, desde) {
  const dias = new Map();
  for (const f of filas) {
    const fecha = fechaMadridDeFin(f.hora);
    if (fecha < desde) continue;
    const k = `${f.fuente}|${f.estacion}|${fecha}`;
    const d = dias.get(k) ?? { fuente: f.fuente, estacion: f.estacion, fecha, mm: null, horas: 0, maximo: null };
    if (typeof f.mm === 'number' && Number.isFinite(f.mm) && f.mm >= 0) {
      const horas = f.horas ?? 1;
      d.mm = r1((d.mm ?? 0) + f.mm);
      d.horas += horas;
      if (horas === 1) d.maximo = Math.max(d.maximo ?? 0, f.mm);
    }
    dias.set(k, d);
  }
  return [...dias.values()].sort((a, b) => a.fuente.localeCompare(b.fuente) || a.estacion.localeCompare(b.estacion) || a.fecha.localeCompare(b.fecha));
}
export function diasDeFilas(filas) {
  return (filas ?? []).flatMap((f) => (f.fechas ?? []).map((fecha, k) => ({ fuente: f.fuente, estacion: f.estacion, fecha: String(fecha).slice(0, 10),
    mm: f.mm?.[k] == null ? null : r1(f.mm[k]), horas: f.horas?.[k] ?? 0, maximo: f.maximo?.[k] ?? null })));
}

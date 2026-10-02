// supabase/functions/pluvio/calidad.js
// Control de calidad de la lluvia medida (spec §3.2): todos los umbrales viven aquí. Por ahora, el día incompleto.
export const UMBRALES = Object.freeze({ horasMinimas: 20 });

export function revisarDia(dia, u = UMBRALES) {
  if (dia.mm == null || !dia.horas) return { calidad: 'sin-dato', motivo: 'ninguna hora con dato' };
  if (dia.horas < u.horasMinimas) return { calidad: 'incompleto', motivo: `solo ${dia.horas} horas con dato` };
  return { calidad: 'ok', motivo: null };
}
export const revisarDias = (dias) => dias.map((d) => ({ ...d, ...revisarDia(d) }));

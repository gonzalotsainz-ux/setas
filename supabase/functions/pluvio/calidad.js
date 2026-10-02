// supabase/functions/pluvio/calidad.js
// Control de calidad de la lluvia medida (spec §3.2). Todos los umbrales viven aquí. Lo sospechoso no entra en la nota:
// queda guardado en lluvia_dia con su motivo.
//  - Una hora: negativa → descartada; más de 60 mm → sospechosa (un total diario, como el del Júcar, no es una hora).
//  - Un día: alguna hora de más de 60 mm o más de 200 mm en el día → sospechoso; menos de 20 horas con dato → incompleto.
//  - Pico aislado: mucho más que la mediana de sus vecinas (< 25 km) Y el modelo casi seco → sospechoso (Quintanar 28/08).
//  - Seco aislado (Review Focus 3): casi nada cuando sus vecinas y el modelo dicen que llovió mucho → sospechoso.
//  Las dos últimas solo con modelo: sin él no se sabe si fue una tormenta local.
import { distanciaKm } from '../_shared/pluvio.js';

export const UMBRALES = Object.freeze({
  horaMax: 60, diaMax: 200, horasMinimas: 20,
  vecinasKm: 25, picoVeces: 5, picoMm: 25, modeloSeco: 5,
  secoMediana: 20, secoFraccion: 0.1, secoModelo: 10,
});
const r1 = (x) => Math.round(x * 10) / 10;
const mediana = (v) => { const s = [...v].sort((a, b) => a - b), k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

export function calidadHora(mm, horas = 1, u = UMBRALES) {
  if (typeof mm !== 'number' || !Number.isFinite(mm)) return 'sin-dato';
  if (mm < 0) return 'descartado';
  if (horas === 1 && mm > u.horaMax) return 'sospechoso';
  return 'ok';
}

export function revisarDia(dia, { vecinas = [], modelo = null } = {}, u = UMBRALES) {
  if (dia.mm == null || !dia.horas) return { calidad: 'sin-dato', motivo: 'ninguna hora con dato' };
  if (dia.maximo != null && dia.maximo > u.horaMax) return { calidad: 'sospechoso', motivo: `una hora con ${r1(dia.maximo)} mm (más de ${u.horaMax})` };
  if (dia.mm > u.diaMax) return { calidad: 'sospechoso', motivo: `${r1(dia.mm)} mm en el día (más de ${u.diaMax})` };
  if (dia.horas < u.horasMinimas) return { calidad: 'incompleto', motivo: `solo ${dia.horas} horas con dato` };
  if (vecinas.length && modelo != null) {
    const med = mediana(vecinas), frente = `frente a ${r1(med)} de sus vecinas y ${r1(modelo)} del modelo`;
    if (modelo < u.modeloSeco && dia.mm > u.picoVeces * med && dia.mm - med > u.picoMm) return { calidad: 'sospechoso', motivo: `pico aislado: ${r1(dia.mm)} mm ${frente}` };
    if (modelo >= u.secoModelo && med >= u.secoMediana && dia.mm < u.secoFraccion * med) return { calidad: 'sospechoso', motivo: `seco aislado: ${r1(dia.mm)} mm ${frente}` };
  }
  return { calidad: 'ok', motivo: null };
}

// Dos pasadas: primero los límites y el día incompleto; después, entre los días buenos, vecinas y modelo.
export function revisarDias(dias, estaciones = [], modeloDe = () => null, u = UMBRALES) {
  const pos = new Map(estaciones.map((e) => [`${e.fuente}:${e.codigo}`, e]));
  const primera = dias.map((d) => ({ ...d, ...revisarDia(d, {}, u) }));
  const buenas = new Map();
  for (const d of primera) if (d.calidad === 'ok') {
    if (!buenas.has(d.fecha)) buenas.set(d.fecha, []);
    buenas.get(d.fecha).push({ clave: `${d.fuente}:${d.estacion}`, mm: d.mm });
  }
  return primera.map((d) => {
    if (d.calidad !== 'ok') return d;
    const clave = `${d.fuente}:${d.estacion}`, yo = pos.get(clave);
    const vecinas = yo ? (buenas.get(d.fecha) ?? []).filter((v) => {
      if (v.clave === clave) return false;
      const km = distanciaKm(yo, pos.get(v.clave));
      return km != null && km < u.vecinasKm;
    }).map((v) => v.mm) : [];
    return { ...d, ...revisarDia(d, { vecinas, modelo: modeloDe(clave, d.fecha) }, u) };
  });
}

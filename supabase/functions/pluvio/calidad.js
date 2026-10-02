// supabase/functions/pluvio/calidad.js
// Control de calidad de la lluvia medida (spec §3.2). Todos los umbrales viven aquí. Lo sospechoso no entra en la nota:
// queda guardado en lluvia_dia con su motivo.
//  - Una hora: negativa → descartada; más de 60 mm → sospechosa (un total diario, como el del Júcar, no es una hora).
//  - Un día: alguna hora de más de 60 mm o más de 200 mm en el día → sospechoso; menos de 20 horas con dato → incompleto.
//  - Pico aislado: sus vecinas (< 25 km) secas (mediana ≤ 1 mm), el día más de 50 mm por encima y 5 veces su mediana, y el
//    modelo casi seco → sospechoso (Quintanar 28/08). Con vecinas mojadas no: puede ser una tormenta local de verdad.
//  - Pico sin vecinas: ninguna vecina, más de 100 mm y el modelo casi seco → sospechoso.
//  - Seco aislado (Review Focus 3): casi nada cuando sus vecinas y el modelo dicen que llovió mucho → sospechoso.
//  Las reglas de pico y seco solo se aplican con modelo: sin él no se sabe si fue una tormenta local.
import { distanciaKm } from '../_shared/pluvio.js';

export const UMBRALES = Object.freeze({
  horaMax: 60, diaMax: 200, horasMinimas: 20,
  vecinasKm: 25, picoVeces: 5, picoMm: 50, picoVecinasSecas: 1, modeloSeco: 5, picoSinVecinas: 100,
  secoMediana: 20, secoFraccion: 0.1, secoModelo: 10,
});
const OK = Object.freeze({ calidad: 'ok', motivo: null });
const r1 = (x) => Math.round(x * 10) / 10;
const mediana = (v) => { const s = [...v].sort((a, b) => a - b), k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const frente = (med, modelo) => `frente a ${r1(med)} de sus vecinas y ${r1(modelo)} del modelo`;

export function calidadHora(mm, horas = 1, u = UMBRALES) {
  if (typeof mm !== 'number' || !Number.isFinite(mm)) return 'sin-dato';
  if (mm < 0) return 'descartado';
  if (horas === 1 && mm > u.horaMax) return 'sospechoso';
  return 'ok';
}

// Límites del propio día, sin mirar alrededor.
function limites(dia, u) {
  if (dia.mm == null || !dia.horas) return { calidad: 'sin-dato', motivo: 'ninguna hora con dato' };
  if (dia.maximo != null && dia.maximo > u.horaMax) return { calidad: 'sospechoso', motivo: `una hora con ${r1(dia.maximo)} mm (más de ${u.horaMax})` };
  if (dia.mm > u.diaMax) return { calidad: 'sospechoso', motivo: `${r1(dia.mm)} mm en el día (más de ${u.diaMax})` };
  if (dia.horas < u.horasMinimas) return { calidad: 'incompleto', motivo: `solo ${dia.horas} horas con dato` };
  return OK;
}
function pico(dia, vecinas, modelo, u) {
  if (modelo == null || modelo >= u.modeloSeco) return OK;
  if (!vecinas.length) {
    return dia.mm > u.picoSinVecinas ? { calidad: 'sospechoso', motivo: `pico sin vecinas: ${r1(dia.mm)} mm frente a ${r1(modelo)} del modelo` } : OK;
  }
  const med = mediana(vecinas);
  if (med <= u.picoVecinasSecas && dia.mm > u.picoVeces * med && dia.mm - med > u.picoMm) return { calidad: 'sospechoso', motivo: `pico aislado: ${r1(dia.mm)} mm ${frente(med, modelo)}` };
  return OK;
}
function seco(dia, vecinas, modelo, u) {
  if (modelo == null || !vecinas.length || modelo < u.secoModelo) return OK;
  const med = mediana(vecinas);
  if (med >= u.secoMediana && dia.mm < u.secoFraccion * med) return { calidad: 'sospechoso', motivo: `seco aislado: ${r1(dia.mm)} mm ${frente(med, modelo)}` };
  return OK;
}

export function revisarDia(dia, { vecinas = [], modelo = null } = {}, u = UMBRALES) {
  for (const regla of [() => limites(dia, u), () => pico(dia, vecinas, modelo, u), () => seco(dia, vecinas, modelo, u)]) {
    const r = regla();
    if (r.calidad !== 'ok') return r;
  }
  return OK;
}

// Tres pasadas: los límites de cada día; el pico, con las vecinas que pasaron los límites; el seco, con las vecinas que
// además no son pico (un pico falso de una vecina no debe hacer parecer seca a una estación que marca bien).
export function revisarDias(dias, estaciones = [], modeloDe = () => null, u = UMBRALES) {
  const pos = new Map(estaciones.map((e) => [`${e.fuente}:${e.codigo}`, e]));
  const clave = (d) => `${d.fuente}:${d.estacion}`;
  const vecinasEn = (lista) => {
    const buenas = new Map();
    for (const d of lista) if (d.calidad === 'ok') {
      if (!buenas.has(d.fecha)) buenas.set(d.fecha, []);
      buenas.get(d.fecha).push({ clave: clave(d), mm: d.mm });
    }
    return (d) => {
      const yo = pos.get(clave(d));
      if (!yo) return [];
      return (buenas.get(d.fecha) ?? []).filter((v) => {
        if (v.clave === clave(d)) return false;
        const km = distanciaKm(yo, pos.get(v.clave));
        return km != null && km < u.vecinasKm;
      }).map((v) => v.mm);
    };
  };
  const pasada = (lista, regla) => {
    const vecinas = vecinasEn(lista);
    return lista.map((d) => (d.calidad !== 'ok' ? d : { ...d, ...regla(d, vecinas(d), modeloDe(clave(d), d.fecha), u) }));
  };
  const primera = dias.map((d) => ({ ...d, ...limites(d, u) }));
  return pasada(pasada(primera, pico), seco);
}

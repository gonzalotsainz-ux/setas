// supabase/functions/pluvio/tiempo.js
// Horas de las fuentes. Los SAIH publican en hora de Madrid («02/10/2026 09:00»); se guarda en UTC y cada valor se apunta
// al FIN de su hora (la lluvia de 08:00 a 09:00 lleva la hora 09:00). El día de Madrid de un valor es el de su fin menos un
// minuto: la hora que acaba a las 00:00 es del día anterior.
import { sumarDias } from '../_shared/meteo.js';

const ZONA = 'Europe/Madrid';
const FORMATO = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
// Intl es caro (decenas de µs por llamada y memoria fuera del montón): un histórico del Duero son 2.000 horas y el plan
// gratuito corta hacia los 2 s de CPU. El desfase de Madrid solo cambia en una hora en punto UTC (01:00Z), así que se
// calcula una vez por hora UTC y se guarda.
const desfases = new Map();
const MAX_DESFASES = 50000;
function desfaseMs(ms) {
  const h = Math.floor(ms / 3600e3);
  let d = desfases.get(h);
  if (d === undefined) {
    const p = Object.fromEntries(FORMATO.formatToParts(new Date(h * 3600e3)).map((x) => [x.type, x.value]));
    d = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - h * 3600e3;
    if (desfases.size >= MAX_DESFASES) desfases.clear();
    desfases.set(h, d);
  }
  return d;
}
const enMadrid = (ms) => new Date(ms + desfaseMs(ms)).toISOString();   // la hora de Madrid escrita como si fuera UTC
const local = (ms) => { const s = enMadrid(ms); return `${s.slice(0, 10)} ${s.slice(11, 16)}`; };

// Instante UTC de una hora de Madrid. En el cambio de octubre las 02:xx existen dos veces: se toma la primera (verano; la
// segunda la corrige quien lee una serie ordenada, ver horasDe en lectores/tajo.js); en el de marzo no existen: null.
export function utcDeMadrid(fecha, hhmm) {
  const [a, m, d] = fecha.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  const base = Date.UTC(a, m - 1, d, h, mi);
  for (const desfase of [2, 1]) {
    const ms = base - desfase * 3600e3;
    if (local(ms) === `${fecha} ${hhmm}`) return new Date(ms).toISOString();
  }
  return null;
}
export function horaDeTexto(t) {
  const m = typeof t === 'string' ? t.trim().match(/^(\d\d)\/(\d\d)\/(\d{4}) (\d\d:\d\d)$/) : null;
  return m ? utcDeMadrid(`${m[3]}-${m[2]}-${m[1]}`, m[4]) : null;
}
export const fechaMadridDeFin = (iso) => enMadrid(Date.parse(iso) - 60e3).slice(0, 10);
// La hora acaba a las 00:00 de Madrid: es la última del día anterior (fechaMadridDeFin).
export const acabaAMedianoche = (iso) => enMadrid(Date.parse(iso)).slice(11, 16) === '00:00';
export const finDeDia = (fecha) => utcDeMadrid(sumarDias(fecha, 1), '00:00');
export const esHoraEnPunto = (iso) => typeof iso === 'string' && Number.isFinite(Date.parse(iso)) && Date.parse(iso) % 3600e3 === 0;

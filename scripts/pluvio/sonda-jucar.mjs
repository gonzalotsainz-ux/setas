// scripts/pluvio/sonda-jucar.mjs
// Aclara si el «día D» de /lluviasIntervalo del SAIH Júcar es el día UTC o el de Madrid. Solo trae días cerrados: D sale
// vacío mientras está abierto. Se ejecuta una noche (arrancar antes de las 21:45 UTC): cada 15 min, hasta las 00:30 UTC,
// pide D (la fecha de Madrid al empezar) y D-1 (control, siempre con datos) y apunta si D ya trae datos.
//   - D trae datos a las ~22:00 UTC (verano) o 23:00 UTC (invierno), al acabar el día de Madrid  -> día de Madrid.
//   - D sigue vacío hasta las 00:00 UTC y entonces aparece                                       -> día UTC.
// Uso: node scripts/pluvio/sonda-jucar.mjs            (bucle de la noche)
//      node scripts/pluvio/sonda-jucar.mjs --una      (una sola sonda ahora)
import { hoyMadrid, sumarDias } from '../../supabase/functions/_shared/meteo.js';

const BASE = 'https://saih.chj.es/lluviasIntervalo/';
const una = process.argv.includes('--una');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const D = hoyMadrid(new Date()), control = sumarDias(D, -1);
const hhmm = (d) => d.toISOString().slice(11, 16);
const pedir = async (f) => { const r = await fetch(`${BASE}${f}/${f}`); if (!r.ok) throw new Error(`HTTP ${r.status}`); const l = await r.json(); return Array.isArray(l) ? l.length : -1; };
const parar = new Date(`${sumarDias(D, 1)}T00:30:00Z`);
const resultados = [];
for (;;) {
  const ahora = new Date();
  try {
    const [d, c] = [await pedir(D), await pedir(control)];
    resultados.push({ hora: hhmm(ahora), d });
    console.log(`${hhmm(ahora)}Z  ${D}: ${d} estaciones   ${control} (control): ${c}`);
  } catch (e) { console.log(`${hhmm(ahora)}Z  error: ${e.message}`); }
  if (una || ahora >= parar) break;
  await dormir(15 * 60e3);
}
const primera = resultados.find((x) => x.d > 0);
if (!una) console.log(primera ? `${D} apareció a las ${primera.hora}Z: ${primera.hora < '23:30' && primera.hora >= '21:45' ? 'DÍA DE MADRID' : 'DÍA UTC (apareció pasadas las 00:00Z)'}` : `${D} no apareció: repetir la sonda`);

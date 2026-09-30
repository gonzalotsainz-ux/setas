// Pide la meteo real de todos los puntos y muestra P26 y la temperatura media de 20 días, para revisar a ojo.
import { readFileSync } from 'node:fs';
import { obtenerMeteo } from '../js/meteo.js';
const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;
const puntos = zonas.flatMap((z) => z.puntos);
const r = await obtenerMeteo(puntos, { almacen: null });
if (!r.series) { console.error('✗', r.error); process.exit(1); }
for (const p of puntos) {
  const s = r.series[p.id], i = s.hoy;
  const p26 = s.precip.slice(i - 25, i + 1).reduce((a, b) => a + b, 0);
  const t20 = s.tmedia.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20;
  console.log(`${p.id.padEnd(28)} celda ${String(s.celdaAltitud).padStart(5)} m · P26 ${p26.toFixed(1).padStart(6)} mm · T20 ${t20.toFixed(1)} °C · suelo pct ${s.hsueloPct[i]?.toFixed(0) ?? '—'}`);
}
console.log('Dispersión (horizonte común):', JSON.stringify(r.dispersion?.[puntos[0].id]));

// scripts/rejilla/medir-pintado.mjs
// Mide notasDeArchivo + colorear en el archivo de rejilla con más celdas, con un índice sintético (todas las celdas
// gruesas con la misma meteo húmeda) y las especies reales de su zona. Criterio del plan: el tiempo en el portátil × 4
// (la ralentización de CPU con la que Lighthouse simula un móvil medio); si pasa de 200 ms, se usa el Web Worker.
import { readFileSync } from 'node:fs';
import { decodificarRejilla } from '../../js/rejilla/formato.js';
import { gruesasDeArchivo, notasDeArchivo, colorear } from '../../js/rejilla/pintor.js';
import { resumirCelda } from '../../js/rejilla/salida.js';
import { especiesDeZona } from '../../js/datos.js';
import { serieSintetica, lluviaBuena } from '../../tests/ayudas.js';

const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
const indice = leer('data/rejilla/indice.json'), gruesa = leer('data/rejilla/gruesa.json');
const zonas = leer('data/zonas.json').zonas, especies = leer('data/especies.json').especies;
const mayor = [...indice.archivos].sort((a, b) => b.ancho * b.alto - a.ancho * a.alto)[0];
const r = await decodificarRejilla(readFileSync(`data/rejilla/${mayor.archivo}`));
const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena }), fechas = serie.fechas.slice(59, 69);
const resumen = resumirCelda({ altRef: 1000, serie, fechas });
const salida = { version: 1, sello: '2026-10-18T07', hoy: fechas[0], fechas, celdas: Object.fromEntries(gruesa.celdas.map((g) => [g.id, { ...resumen, altRef: g.altRef }])) };
const esp = especiesDeZona(zonas.find((z) => z.id === r.cabecera.zona), especies);
const gru = gruesasDeArchivo(r, gruesa);
const veces = [];
for (let k = 0; k < 5; k++) {
  const t0 = performance.now();
  colorear(notasDeArchivo({ rejilla: r, gruesas: gru, gruesa, salida, fecha: fechas[0], especies: esp }));
  veces.push(performance.now() - t0);
}
const ms = Math.min(...veces);
console.log(`${mayor.archivo}: ${r.cabecera.ancho} × ${r.cabecera.alto} celdas, ${Math.round(ms)} ms en este equipo, ~${Math.round(ms * 4)} ms en un móvil medio → ${ms * 4 > 200 ? 'Web Worker' : 'hilo principal'}`);

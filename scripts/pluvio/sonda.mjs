// scripts/pluvio/sonda.mjs
//   node scripts/pluvio/sonda.mjs
// Prueba en vivo de cada fuente con la primera estación de la lista blanca, para saber a tiempo si una web cambia de
// formato (fuera de npm test: usa la red). AEMET solo si hay AEMET_API_KEY en el entorno. Sale con 1 si algo falla.
import { readFileSync } from 'node:fs';
import { crearPedir } from '../../supabase/functions/pluvio/red.js';
import { leerTajo } from '../../supabase/functions/pluvio/lectores/tajo.js';
import { leerDuero } from '../../supabase/functions/pluvio/lectores/duero.js';
import { leerJucar } from '../../supabase/functions/pluvio/lectores/jucar.js';
import { leerAemet } from '../../supabase/functions/pluvio/lectores/aemet.js';
import { URL_ESTACIONES_EUSKALMET, estacionesDeEuskalmet } from '../../supabase/functions/pluvio/lectores/euskalmet.js';
import { hoyMadrid, sumarDias } from '../../supabase/functions/_shared/meteo.js';

const lista = JSON.parse(readFileSync(new URL('../../supabase/functions/pluvio/estaciones.json', import.meta.url), 'utf8'));
const pedir = crearPedir({ fetchFn: fetch });
const hoy = hoyMadrid(), primera = (f) => lista.filter((e) => e.fuente === f).slice(0, 1);
const pruebas = {
  tajo: () => leerTajo({ pedir, estaciones: primera('tajo') }),
  duero: () => leerDuero({ pedir, estaciones: primera('duero'), desde: sumarDias(hoy, -2) }),
  jucar: () => leerJucar({ pedir, estaciones: primera('jucar'), fechas: [sumarDias(hoy, -1)] }),
  aemet: () => (process.env.AEMET_API_KEY ? leerAemet({ pedir, clave: process.env.AEMET_API_KEY, estaciones: primera('aemet') }) : null),
  euskalmet: async () => ({ filas: estacionesDeEuskalmet(await pedir(URL_ESTACIONES_EUSKALMET)), errores: [] }),
};
let fallos = 0;
for (const [fuente, probar] of Object.entries(pruebas)) {
  try {
    const r = await probar();
    if (!r) { console.log(`${fuente}: sin probar (falta AEMET_API_KEY)`); continue; }
    const bien = r.filas.length > 0 && !r.errores.length;
    if (!bien) fallos++;
    console.log(`${fuente}: ${bien ? 'bien' : 'FALLA'} · ${r.filas.length} filas${r.errores.length ? ` · ${r.errores.join('; ')}` : ''}`);
  } catch (e) { fallos++; console.log(`${fuente}: FALLA · ${e.message}`); }
}
process.exit(fallos ? 1 : 0);

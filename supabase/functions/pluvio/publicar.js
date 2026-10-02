// supabase/functions/pluvio/publicar.js
// Paso de «pluvio» a las 4 y a las 16 UTC, tras las lecturas: agrega las horas por día de Madrid desde el 1 de agosto,
// aplica el control de calidad (con las vecinas y el modelo de la celda gruesa más cercana, de meteo_celdas) y guarda
// lluvia_dia. Solo días ya cerrados (hasta ayer) y estaciones de la lista blanca.
import { agostoDe, sumarDias } from '../_shared/meteo.js';
import { distanciaKm } from '../_shared/pluvio.js';
import { diasDeFilas } from './dias.js';
import { revisarDias } from './calidad.js';

export const KM_MODELO = 15;   // más lejos, el modelo de la celda ya no representa a la estación

export function celdasCercanas(estaciones, celdas, maxKm = KM_MODELO) {
  const r = new Map();
  for (const e of estaciones) {
    let mejor = null;
    for (const c of celdas) { const km = distanciaKm(e, c); if (km != null && km <= maxKm && (!mejor || km < mejor.km)) mejor = { id: c.id, km }; }
    if (mejor) r.set(`${e.fuente}:${e.codigo}`, mejor.id);
  }
  return r;
}

export async function publicar({ almacen, hoy, ahora, estaciones, gruesa = { celdas: [] } }) {
  const desde = agostoDe(hoy), hasta = sumarDias(hoy, -1);
  const conocidas = new Set(estaciones.map((e) => `${e.fuente}:${e.codigo}`));
  const dias = diasDeFilas(await almacen.diasPorEstacion(desde)).filter((d) => d.fecha <= hasta && conocidas.has(`${d.fuente}:${d.estacion}`));
  const cercana = celdasCercanas(estaciones, gruesa.celdas);
  const modelo = cercana.size ? await almacen.precipCeldas([...new Set(cercana.values())], desde) : new Map();
  const modeloDe = (clave, fecha) => modelo.get(cercana.get(clave))?.get(fecha) ?? null;
  const revisados = revisarDias(dias, estaciones, modeloDe);
  await almacen.guardarDias(revisados.map((d) => ({ ...d, actualizado: ahora.toISOString() })));
  return { dias: revisados.length };
}

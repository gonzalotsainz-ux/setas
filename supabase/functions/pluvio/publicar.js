// supabase/functions/pluvio/publicar.js
// Paso de «pluvio» a las 4 y a las 16 UTC, tras las lecturas: agrega las horas por día de Madrid desde el 1 de agosto,
// aplica el control de calidad y guarda lluvia_dia. Solo días ya cerrados (hasta ayer) y estaciones de la lista blanca.
import { agostoDe, sumarDias } from '../_shared/meteo.js';
import { diasDeFilas } from './dias.js';
import { revisarDias } from './calidad.js';

export async function publicar({ almacen, hoy, ahora, estaciones }) {
  const desde = agostoDe(hoy), hasta = sumarDias(hoy, -1);
  const conocidas = new Set(estaciones.map((e) => `${e.fuente}:${e.codigo}`));
  const dias = diasDeFilas(await almacen.diasPorEstacion(desde)).filter((d) => d.fecha <= hasta && conocidas.has(`${d.fuente}:${d.estacion}`));
  const revisados = revisarDias(dias);
  await almacen.guardarDias(revisados.map((d) => ({ ...d, actualizado: ahora.toISOString() })));
  return { dias: revisados.length };
}

// supabase/functions/pluvio/publicar.js
// Paso de «pluvio» a las 4 y a las 16 UTC, tras las lecturas: agrega las horas por día de Madrid desde el 1 de agosto,
// aplica el control de calidad (con las vecinas y el modelo de la celda gruesa más cercana, de meteo_celdas) y guarda
// lluvia_dia. Solo días ya cerrados (hasta ayer) y estaciones de la lista blanca.
// lluvia_obs se limpia a los DIAS_OBS días y la temporada va del 1 de agosto al 31 de julio: los días anteriores a
// `corte` (hoy − DIAS_OBS + 2, con margen por la hora de la limpieza y el desfase de Madrid) pueden estar a medias en
// lluvia_obs. Esos se toman de lluvia_dia (400 días), ya revisados: solo los «ok», tal cual, sin revisarlos ni reescribirlos.
// Si lluvia_dia no los tiene, quedan sin medir.
import { agostoDe, sumarDias } from '../_shared/meteo.js';
import { distanciaKm, seriesMedidas, validarPluvio, validosDe, VERSION_PLUVIO } from '../_shared/pluvio.js';
import { diasDeFilas } from './dias.js';
import { revisarDias } from './calidad.js';

export const KM_MODELO = 15;   // más lejos, el modelo de la celda ya no representa a la estación
export const DIAS_OBS = 200;   // = la limpieza de lluvia_obs (migración 20261004000000_lluvia_dia.sql)
export const corteObs = (hoy) => sumarDias(hoy, -(DIAS_OBS - 2));

export function celdasCercanas(estaciones, celdas, maxKm = KM_MODELO) {
  const r = new Map();
  for (const e of estaciones) {
    let mejor = null;
    for (const c of celdas) { const km = distanciaKm(e, c); if (km != null && km <= maxKm && (!mejor || km < mejor.km)) mejor = { id: c.id, km }; }
    if (mejor) r.set(`${e.fuente}:${e.codigo}`, mejor.id);
  }
  return r;
}

export const MINIMO_TROZO_MS = 5000;   // un trozo de guardado o una subida que no tiene esto por delante no empieza (tope duro)
const sinTiempo = (quedan, que) => { if (quedan() < MINIMO_TROZO_MS) throw new Error(`sin tiempo para ${que}`); };

// Los dos archivos públicos (formato en _shared/pluvio.js y docs/datos.md). Solo cuentan los días buenos (validosDe);
// «n» cuenta sitios (estaciones agrupadas a menos de 1,5 km) y «estaciones» da los nombres que aportan a cada lugar.
export function construirPublicacion({ revisados, estaciones, puntos, celdas, desde, hasta, generado }) {
  const validos = validosDe(revisados);
  const aemet = {};
  for (const [k, m] of validos) if (k.startsWith('aemet:')) aemet[k.slice('aemet:'.length)] = Object.fromEntries(m);
  const fuentes = {};
  for (const d of revisados) if (d.horas > 0 && (fuentes[d.fuente] ?? '') < d.fecha) fuentes[d.fuente] = d.fecha;
  const base = { version: VERSION_PLUVIO, generado, desde, hasta };
  return {
    ultimo: { ...base, fuentes, lugares: seriesMedidas(puntos, estaciones, validos, desde, hasta), aemet },
    celdas: { ...base, lugares: seriesMedidas(celdas.map((c) => ({ id: c.id, lat: c.lat, lon: c.lon, altitud: c.altRef })), estaciones, validos, desde, hasta) },
  };
}

export async function publicar({ almacen, hoy, ahora, estaciones, puntos = [], gruesa = { celdas: [] }, quedan = () => Infinity }) {
  const desde = agostoDe(hoy), hasta = sumarDias(hoy, -1), corte = corteObs(hoy);
  const conocidas = new Set(estaciones.map((e) => `${e.fuente}:${e.codigo}`));
  const propia = (d) => conocidas.has(`${d.fuente}:${d.estacion}`);
  const dias = diasDeFilas(await almacen.diasPorEstacion(desde)).filter((d) => d.fecha >= corte && d.fecha <= hasta && propia(d));
  const guardados = corte > desde && almacen.diasGuardados
    ? (await almacen.diasGuardados(desde, sumarDias(corte, -1))).map((d) => ({ ...d, fecha: String(d.fecha).slice(0, 10) })).filter(propia) : [];
  const cercana = celdasCercanas(estaciones, gruesa.celdas);
  const modelo = cercana.size ? await almacen.precipCeldas([...new Set(cercana.values())], desde) : new Map();
  const modeloDe = (clave, fecha) => modelo.get(cercana.get(clave))?.get(fecha) ?? null;
  const revisados = revisarDias(dias, estaciones, modeloDe);
  const filas = revisados.map(({ ultima, ...d }) => ({ ...d, actualizado: ahora.toISOString() }));   // lluvia_dia no guarda `ultima`
  for (let k = 0; k < filas.length; k += 1000) { sinTiempo(quedan, 'guardar los días'); await almacen.guardarDias(filas.slice(k, k + 1000)); }
  const extra = guardados.length ? { guardados: guardados.length } : {};
  if (!puntos.length) return { dias: revisados.length, ...extra };
  const { ultimo, celdas } = construirPublicacion({ revisados: [...guardados, ...revisados], estaciones, puntos, celdas: gruesa.celdas, desde, hasta, generado: ahora.toISOString() });
  const malas = [...validarPluvio(ultimo), ...validarPluvio(celdas)];
  if (malas.length) throw new Error(`salida mal formada, no se sube: ${malas[0]}`);
  // Primero las celdas (las lee «rejilla») y después, lo último, el puntero de Hoy y Zona.
  sinTiempo(quedan, 'subir celdas.json');
  await almacen.subir('pluvio/celdas.json', celdas, '3600');
  sinTiempo(quedan, 'subir ultimo.json');
  await almacen.subir('pluvio/ultimo.json', ultimo, '600');
  return { dias: revisados.length, ...extra, puntos: Object.keys(ultimo.lugares).length, celdas: Object.keys(celdas.lugares).length };
}

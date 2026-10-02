// supabase/functions/pluvio/lectores/jucar.js
// SAIH Júcar (CHJ), sin clave y con CORS abierto (informe 09 §3.3). /lluviasIntervalo/D/D da, por estación, la lluvia del
// día D (`lluvia_int`; `valores` = días con dato) y su posición en UTM 30 (los campos «Lat» y «Lon» son X e Y). Solo trae
// días cerrados: hoy sale vacío. El portal avisa: datos provisionales, sin depurar. Se guarda como un valor que cubre 24 h
// apuntado al fin del día de Madrid.
// SIN VERIFICAR: si el «día D» del portal es el día UTC o el de Madrid. La respuesta solo lleva fecha_desde/fecha_hasta a
// medianoche UTC y no hay serie horaria con la que contrastarlo (comprobado con peticiones en vivo el 02/10/2026); se asume
// el día de Madrid, que es lo que la tarea 4 espera de un valor de 24 h.
import { finDeDia } from '../tiempo.js';
import { PlazoAgotado } from '../red.js';
import { sumarDias, agostoDe } from '../../_shared/meteo.js';

export const BASE_JUCAR = 'https://saih.chj.es/';
export const LOTE_JUCAR = 20;
export const urlDiaJucar = (fecha) => `${BASE_JUCAR}lluviasIntervalo/${fecha}/${fecha}`;
const r1 = (x) => Math.round(x * 10) / 10;

export function filasDeDiaJucar(lista, fecha, codigos) {
  const hora = finDeDia(fecha);
  return (Array.isArray(lista) ? lista : []).flatMap((x) => (codigos.has(x?.fldTCodigo) && x.valores >= 1
    && typeof x.lluvia_int === 'number' && Number.isFinite(x.lluvia_int) ? [{ estacion: x.fldTCodigo, hora, horas: 24, mm: r1(x.lluvia_int) }] : []));
}
export const estacionesDeJucar = (lista) => (Array.isArray(lista) ? lista : []).map((x) => ({
  codigo: x.fldTCodigo, nombre: x.fldTNombre, x: x.fldNCoordGPSLat, y: x.fldNCoordGPSLon, provincia: x.fldTProvincia }));

// Ayer y anteayer siempre (son provisionales y pueden corregirse); después, los que faltan desde el 1 de agosto, de los más
// antiguos a los más nuevos, hasta `lote` peticiones por ejecución (una por día: el relleno tarda unas 4 ejecuciones).
export function fechasJucar(hoy, presentes, lote = LOTE_JUCAR) {
  const anteayer = sumarDias(hoy, -2), fechas = [sumarDias(hoy, -1), anteayer];
  for (let f = agostoDe(hoy); f < anteayer && fechas.length < lote; f = sumarDias(f, 1)) if (!presentes.has(f)) fechas.push(f);
  return fechas;
}

export async function leerJucar({ pedir, estaciones, fechas }) {
  const codigos = new Set(estaciones.map((e) => e.codigo)), filas = [], errores = [];
  if (!codigos.size) return { filas, errores, agotado: false };
  for (const f of fechas) {
    try { filas.push(...filasDeDiaJucar(await pedir(urlDiaJucar(f)), f, codigos)); } catch (e) {
      if (e instanceof PlazoAgotado) return { filas, errores, agotado: true };
      errores.push(`${f}: ${e.message}`);
    }
  }
  return { filas, errores, agotado: false };
}

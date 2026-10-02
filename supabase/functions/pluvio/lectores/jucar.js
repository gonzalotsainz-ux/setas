// supabase/functions/pluvio/lectores/jucar.js
// SAIH Júcar (CHJ), sin clave y con CORS abierto (informe 09 §3.3). /lluviasIntervalo/D/D da, por estación, la lluvia del
// día D (`lluvia_int`; `valores` = días con dato) y su posición en UTM 30 (los campos «Lat» y «Lon» son X e Y). Solo trae
// días cerrados: hoy sale vacío. El portal avisa: datos provisionales, sin depurar. Se guarda como un valor que cubre 24 h
// apuntado al fin del día de Madrid.
// SIN VERIFICAR (contraste del 02/10/2026): si el «día D» del portal es el día UTC o el de Madrid. fecha_desde/fecha_hasta
// salen a medianoche UTC en ambos casos. Se contrastó con SAIH Tajo (P_06 Valsalobre y PN02 Checa, horario) y Cuenca (4N01,
// 4N04, 4E01, 5N01, 5A04) del 22/09 al 01/10: la única lluvia en las horas que separan los dos criterios (22-24 UTC) fue
// 3 mm en Checa el 28/09 hacia las 00:00 de Madrid, y las estaciones están a 41-48 km, así que no decide. El 29/09 el Júcar
// dio 0,2-2 mm en todas mientras el Tajo solo anotó esa lluvia de madrugada: apunta débilmente al día de Madrid, nada más.
// Se asume el día de Madrid. Para aclararlo, scripts/pluvio/sonda-jucar.mjs sondea una noche entera.
import { finDeDia } from '../tiempo.js';
import { PlazoAgotado } from '../red.js';
import { sumarDias, agostoDe } from '../../_shared/meteo.js';

export const BASE_JUCAR = 'https://saih.chj.es/';
export const LOTE_JUCAR = 20;
export const FALLOS_SEGUIDOS = 3;   // con tantos días fallidos seguidos se da el servidor por caído y se corta
export const urlDiaJucar = (fecha) => `${BASE_JUCAR}lluviasIntervalo/${fecha}/${fecha}`;
const r1 = (x) => Math.round(x * 10) / 10;

export function filasDeDiaJucar(lista, fecha, codigos) {
  if (!Array.isArray(lista) || lista.some((x) => typeof x?.fldTCodigo !== 'string')) throw new Error('formato inesperado');
  const hora = finDeDia(fecha);
  return lista.flatMap((x) => (codigos.has(x.fldTCodigo) && x.valores >= 1
    && typeof x.lluvia_int === 'number' && Number.isFinite(x.lluvia_int) && x.lluvia_int >= 0 ? [{ estacion: x.fldTCodigo, hora, horas: 24, mm: r1(x.lluvia_int) }] : []));
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
  let seguidos = 0;
  for (const f of fechas) {
    try { filas.push(...filasDeDiaJucar(await pedir(urlDiaJucar(f)), f, codigos)); seguidos = 0; } catch (e) {
      if (e instanceof PlazoAgotado) return { filas, errores, agotado: true };
      errores.push(`${f}: ${e.message}`);
      if (++seguidos >= FALLOS_SEGUIDOS) { errores.push(`lectura cortada tras ${seguidos} días fallidos seguidos`); break; }
    }
  }
  return { filas, errores, agotado: false };
}

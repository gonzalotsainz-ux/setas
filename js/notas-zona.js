// Notas por zona y por punto, sin DOM: las usan el mapa y la pantalla «Hoy».
import { indiceZona } from './indice.js';
import { entreDias } from './meteo.js';
import { especiesDeZona, puntosRecogibles, rotuloPunto } from './datos.js';
import { nivelDe } from './ui/semaforo.js';

const nbsp = ' ';
const comun = (e) => e.comunes?.es?.[0] ?? e.nombre;

export function haceCuanto(iso, ahora = new Date()) {
  const h = Math.floor((ahora - new Date(iso)) / 3600e3);
  return h < 1 ? 'hace menos de 1 h' : `hace ${h} h`;
}

const vacio = { valor: null, etiqueta: null, sinDatos: true, fueraDeTemporada: false, incompleta: false, faltan: [], especies: [] };
function sinDatosZona(zona, motivo, incierta = false, res = vacio) {
  return { zona, res, mejor: null, incierta, motivo };
}
export const textoFaltan = (n) => `${n} ${n === 1 ? 'especie' : 'especies'} sin datos suficientes`;

// null (todas) | id | Set de ids | array de ids → Set o null
function normalizarFiltro(filtro) {
  if (filtro == null || filtro === '') return null;
  if (typeof filtro === 'string') return new Set([filtro]);
  const s = new Set(filtro);
  return s.size ? s : null;
}

// Cálculo de una zona para el día i (hoy + d), opcionalmente limitado a una o varias especies.
export function calcularZona(zona, datos, meteo, d, filtro, umbrales = {}) {
  const ids = normalizarFiltro(filtro);
  // Los puntos NO IR (solo meteo) no entran: nunca pueden salir como mejor punto de la zona.
  const recogibles = puntosRecogibles(zona);
  if (!recogibles.length) return sinDatosZona(zona, 'Todos los puntos de esta zona son NO IR (solo meteo). No se calcula nota.');
  const series = Object.fromEntries(recogibles.map((p) => [p.id, meteo.series?.[p.id]]).filter(([, s]) => s));
  const primera = Object.values(series)[0];
  if (!primera) return sinDatosZona(zona, 'No hay datos meteorológicos de esta zona. No se calcula nota.');
  let especies = especiesDeZona(zona, datos.especies, umbrales);
  if (ids) {
    especies = especies.filter((e) => ids.has(e.id));
    if (!especies.length) return sinDatosZona(zona, 'Sin registros de esta especie en la zona. No se calcula nota.');
  }
  const res = indiceZona(series, primera.hoy + d, especies);
  // el contraste de modelos es de la lluvia de los próximos días: no afecta a la nota de hoy
  const incierta = d > 0 && zona.puntos.some((p) => meteo.dispersion?.[p.id]?.incierta);
  if (res.fueraDeTemporada) {
    return sinDatosZona(zona, ids ? 'Fuera de temporada en esas fechas. No se calcula nota.' : 'Fuera de temporada: ninguna especie de la zona lo está. No se calcula nota.', incierta, res);
  }
  if (res.sinDatos) {
    return sinDatosZona(zona, `Faltan datos para calcular la nota${res.faltan.length ? ` (${textoFaltan(res.faltan.length)})` : ''}.`, incierta, res);
  }
  const mejor = res.especies[0];
  const discrepa = !!meteo.contraste?.[zona.id]?.discrepa;
  return { zona, res, mejor, incierta, discrepa, rotulo: rotuloPunto(zona.puntos.find((p) => p.id === mejor.punto)) };
}

export const ordenarZonas = (filas) => [...filas].sort((a, b) => (b.res.valor ?? -1) - (a.res.valor ?? -1));

// La frase de la fila como datos: [{ texto, estilo: 'negrita' | 'latin' | null }]. El nodo lo hace pintarFrase (mapa/hoja.js).
export function fraseZona(fila, datos) {
  if (!fila.mejor) return [{ texto: fila.motivo, estilo: null }];
  const r = fila.mejor.resultado, e = datos.porId[fila.mejor.id];
  if (r.datos.P26 == null) return [{ texto: `${r.explicacion[0]}: ${comun(e)}.`, estilo: null }];   // fuera de temporada: no hay datos que citar
  const { P26, P3, lag, T20 } = r.datos;
  const cuando = P3 < 1 ? 'sin tandas de lluvia' : lag === 0 ? 'lo más fuerte, hoy' : lag === 1 ? 'lo más fuerte, ayer' : `lo más fuerte hace ${lag} días`;
  return [
    { texto: `${Math.round(P26)}${nbsp}mm`, estilo: 'negrita' },
    { texto: ` en 26 días, ${cuando} · `, estilo: null },
    { texto: `${Math.round(T20)}${nbsp}°C`, estilo: 'negrita' },
    { texto: ' → ', estilo: null },
    { texto: e.nombre, estilo: 'latin' },
    { texto: ` ${r.etiqueta}`, estilo: null },
  ];
}

// Días de la tanda de datos que separan `fecha` de hoy (0..7); null si cae fuera del horizonte o antes de la tanda.
export function desplazamientoDia(fecha, meteoHoy) {
  const d = entreDias(meteoHoy, fecha);
  return Number.isInteger(d) && d >= 0 && d <= 7 ? d : null;
}

const sinNota = (motivo) => ({ valor: null, nivel: nivelDe(null), etiqueta: null, mejor: null, especies: [], fueraDeTemporada: false, incompleta: false, faltan: [], motivo });

export const MOTIVO_NO_IR = 'NO IR (solo meteo): no se calcula nota.';

// Nota de un punto concreto para el día hoy + d, con las especies del filtro. Un punto NO IR nunca tiene nota (ni en su
// chincheta, ni en su fila, ni en su ficha), aunque tenga serie de meteo.
export function notaPuntoDia(zona, punto, datos, meteo, d, filtro, umbrales = {}) {
  if (punto.noIr) return sinNota(MOTIVO_NO_IR);
  const serie = meteo?.series?.[punto.id];
  if (!serie) return sinNota('No hay datos meteorológicos de este punto. No se calcula nota.');
  if (d == null) return sinNota('Esa fecha queda fuera de la previsión. No se calcula nota.');
  const ids = normalizarFiltro(filtro);
  let especies = especiesDeZona(zona, datos.especies, umbrales);
  if (ids) especies = especies.filter((e) => ids.has(e.id));
  if (!especies.length) return sinNota('Sin registros de esta especie en la zona. No se calcula nota.');
  const res = indiceZona({ [punto.id]: serie }, serie.hoy + d, especies);
  const base = { etiqueta: res.etiqueta ?? null, especies: res.especies ?? [], fueraDeTemporada: !!res.fueraDeTemporada, incompleta: !!res.incompleta, faltan: res.faltan ?? [] };
  if (res.fueraDeTemporada) return { valor: null, nivel: nivelDe(null), mejor: null, ...base, motivo: 'Fuera de temporada en esas fechas. No se calcula nota.' };
  if (res.sinDatos || res.valor == null) {
    return { valor: null, nivel: nivelDe(null), mejor: null, ...base, motivo: `Faltan datos para calcular la nota${base.faltan.length ? ` (${textoFaltan(base.faltan.length)})` : ''}.` };
  }
  const m = res.especies[0];
  return { valor: res.valor, nivel: nivelDe(res.valor), mejor: { id: m.id, especie: datos.porId?.[m.id], resultado: m.resultado }, ...base, motivo: null };
}

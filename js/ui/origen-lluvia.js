// js/ui/origen-lluvia.js
// De dónde sale la lluvia de los últimos 26 días (spec de pluviómetros §3.4). Una sola estación puede mover la nota, así
// que el texto dice siempre cuántas estaciones y a qué distancia: «Lluvia medida en 1 estación (Casillas, a 19,6 km)» o
// «Lluvia medida en 3 estaciones (Covaleda 2 km, Duruelo 5 km, Quintanar 9 km)». Se cuentan las estaciones de la lista (las
// que aportan algún día), no los «sitios» de la mezcla (dos estaciones a menos de 1,5 km pesan como una, pero son dos
// estaciones y así se dicen). Sin DOM: lo usan Zona y la hoja del mapa.
import { esMedida } from './grafico-lluvia.js';

const nbsp = ' ';
const MUESTRA = 3;   // estaciones nombradas; el resto, «y N más»
const coma = (x) => String(x).replace('.', ',');
const km = (x) => coma(Math.round(x * 10) / 10);
const nombreDe = (e) => (typeof e === 'string' ? e : e.nombre);
const kmDe = (e) => (typeof e === 'string' || !Number.isFinite(e.km) ? null : e.km);

// Nombres con su distancia si se conoce. Una sola estación: «Casillas, a 19,6 km»; varias: «A 2 km, B 5 km y 1 más».
export function listaEstaciones(estaciones) {
  const vistas = estaciones.slice(0, MUESTRA), resto = estaciones.length - vistas.length;
  if (vistas.length === 1 && !resto) {
    const d = kmDe(vistas[0]);
    return d == null ? nombreDe(vistas[0]) : `${nombreDe(vistas[0])}, a ${km(d)}${nbsp}km`;
  }
  const items = vistas.map((e) => (kmDe(e) == null ? nombreDe(e) : `${nombreDe(e)} ${km(kmDe(e))}${nbsp}km`));
  if (resto) return `${items.join(', ')} y ${resto} más`;
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items.join('');
}

// estaciones: nombres o { nombre, km }; medidos: días medidos en pluviómetros de la ventana; aemet: días de una estación
// AEMET (no pisan los medidos); total: días de la ventana; truncada: la lista es solo «las más cercanas» (el índice del
// mapa guarda tres nombres).
export function textoOrigenLluvia({ estaciones = [], medidos = 0, total = 0, aemet = 0, factor = 1, cercanas = 0, truncada = false }) {
  const n = estaciones.length;
  const corr = factor !== 1 ? ` (corregido ×${coma(factor)} con las estaciones de la zona)` : '';
  if (n && medidos) {
    const resto = total - medidos - aemet;
    const cuantas = truncada ? 'estaciones cercanas, las más próximas' : `${n} ${n === 1 ? 'estación' : 'estaciones'}`;
    const detalle = resto > 0 || aemet > 0
      ? `: ${medidos} de ${total} días medidos${aemet ? ` y ${aemet} con una estación AEMET` : ''}${resto > 0 ? `; el resto, estimado con el modelo${corr}` : ''}` : '';
    return `Lluvia medida en ${cuantas} (${listaEstaciones(estaciones)})${detalle}`;
  }
  const motivo = cercanas > 0 ? 'las estaciones cercanas no tienen datos válidos' : 'sin estación cercana';
  return `Lluvia estimada con el modelo (${motivo})${factor !== 1 ? `, corregida ×${coma(factor)} con las estaciones de la zona` : ''}`;
}

// Punto de Zona: la ventana de 26 días de su serie y lo que dejó aplicarPluvio (meteo.pluvio.porPunto[id]). Si ningún día de
// la ventana lo midió un pluviómetro pero sí una estación AEMET, devuelve null (Zona cuenta ese caso con su texto de AEMET).
export function textoOrigenPunto(serie, porPunto) {
  const dias = serie.origenPrecip?.slice(Math.max(0, serie.hoy - 25), serie.hoy + 1) ?? [];
  const medidos = dias.filter((o) => o === 'medida').length, aemet = dias.filter((o) => esMedida(o) && o !== 'medida').length;
  if (!medidos && aemet) return null;
  return textoOrigenLluvia({ estaciones: porPunto.estaciones, medidos, total: dias.length, aemet, factor: porPunto.factor, cercanas: porPunto.cercanas });
}

// Celda del índice del mapa: solo si el índice trae el origen (función «rejilla» con pluviómetros). `lluvia.km` (opcional)
// lleva la distancia de cada estación nombrada.
export function origenDeCelda(celda) {
  const l = celda?.lluvia;
  if (!Array.isArray(l?.estaciones) || !Array.isArray(l.origen)) return null;
  const dias = l.origen.slice(Math.max(0, l.hoy - 25), l.hoy + 1), cercanas = l.cercanas ?? 0;
  const estaciones = Array.isArray(l.km) ? l.estaciones.map((nombre, i) => ({ nombre, km: l.km[i] })) : l.estaciones;
  return { estaciones, medidos: dias.filter((c) => c === 1).length, total: dias.length, cercanas, truncada: estaciones.length >= MUESTRA && cercanas > estaciones.length };
}

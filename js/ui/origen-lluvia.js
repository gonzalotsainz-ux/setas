// js/ui/origen-lluvia.js
// De dónde sale la lluvia de los últimos 26 días (spec de pluviómetros §3.4). Una sola estación puede mover la nota, así
// que el texto dice siempre qué estaciones y a qué distancia. Dos niveles: `principal` (qué estaciones) y `detalle` (cuántos
// días medidos y de qué otro origen es el resto). Sin DOM: lo usan Zona y la hoja del mapa.
//  - Solo se nombran las estaciones que aportaron algún día de esos 26 (su `ultimo`, estacionesDesde), por cercanía y con
//    su distancia. Con un archivo anterior, sin `ultimo`, no se sabe cuáles: se dice que se midió, sin nombrar ninguna.
//  - Zona sabe cuántos sitios dieron dato cada día (`porDia`): «entre 1 y 3 estaciones por día (A 1 km, B 6,7 km y 4
//    más)»; no dice «6 estaciones» si en los 26 días midieron menos. Una estación a menos de 1,5 km de otra pesa como una
//    sola (un «sitio»); en la lista salen las dos.
//  - La hoja del mapa no sabe el dato por día: «Lluvia medida en estaciones próximas: A a ~1 km, B a ~2 km…».
import { esMedida } from './grafico-lluvia.js';
import { estacionesDesde } from '../../supabase/functions/_shared/pluvio.js';

const nbsp = ' ';
export const LEJOS_KM = 20;   // a partir de aquí una estación AEMET «es lejana» (el mismo umbral que Zona)
const coma = (x) => String(x).replace('.', ',');
const km = (x) => coma(Math.round(x * 10) / 10);
const nombreDe = (e) => (typeof e === 'string' ? e : e.nombre);
const kmDe = (e) => (typeof e === 'string' || !Number.isFinite(e.km) ? null : e.km);
// «Casas de la Garganta - Cruz Roja» → «Casas de la Garganta»
export const nombreCorto = (n) => String(n).split(/\s[-–]\s/)[0];

// Nombres con su distancia si se conoce. Una sola: «Casillas, a 19,6 km»; varias: «A 2 km, B 5 km y 1 más desde agosto».
// `aprox`: «a ~X km» (la hoja redondea la distancia de la celda); `muestra`: cuántas se nombran; `otras`: cuántas más hay
// fuera de la lista (el índice del mapa guarda tres nombres).
export function listaEstaciones(estaciones, { muestra = 3, aprox = false, corto = false, restoTexto = 'más', otras = 0 } = {}) {
  const vistas = estaciones.slice(0, muestra), resto = estaciones.length - vistas.length + otras;
  const nom = (e) => (corto ? nombreCorto(nombreDe(e)) : nombreDe(e));
  if (vistas.length === 1 && !resto) {
    const d = kmDe(vistas[0]);
    return d == null ? nom(vistas[0]) : `${nom(vistas[0])}, a ${aprox ? '~' : ''}${km(d)}${nbsp}km`;
  }
  const items = vistas.map((e) => (kmDe(e) == null ? nom(e) : `${nom(e)} ${aprox ? 'a ~' : ''}${km(kmDe(e))}${nbsp}km`));
  if (resto) return `${items.join(', ')} y ${resto} ${restoTexto}`;
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items.join('');
}

const estacion = (n) => (n === 1 ? 'estación' : 'estaciones');

// estaciones: nombres o { nombre, km } de las que aportaron en la ventana ([] si no se sabe cuáles); otras: cuántas más
// aportaron sin estar en la lista; medidos: días medidos en pluviómetros de la ventana; aemet: días de una estación AEMET
// (no pisan los medidos) y `aemetEstacion` ({ nombre, km }) cuál; total: días de la ventana; porDia: { min, max } sitios con
// dato por día medido (si se sabe). Devuelve { corto, principal, detalle }: `corto` cabe en media columna; `detalle` es ''
// si todo el periodo está medido.
export function partesOrigenLluvia({ estaciones = [], otras = 0, medidos = 0, total = 0, aemet = 0, aemetEstacion = null, factor = 1, cercanas = 0,
  porDia = null, muestra = 3, aprox = false, cortarNombres = false }) {
  const n = estaciones.length;
  if (medidos) {
    const resto = total - medidos - aemet;
    const lista = () => listaEstaciones(estaciones, { muestra, aprox, corto: cortarNombres, otras });
    let principal;
    if (porDia) {
      const { min, max } = porDia;
      const cuantas = min === max ? `${max} ${estacion(max)} por día` : `entre ${min} y ${max} estaciones por día`;
      if (!n) principal = `Lluvia medida: ${cuantas}`;
      else if (n === 1 && !otras) principal = `Lluvia medida con 1 estación (${lista()})`;
      else principal = `Lluvia medida: ${cuantas} (${lista()})`;
    } else if (!n) principal = 'Lluvia medida en estaciones próximas';
    else if (n === 1 && !otras) principal = `Lluvia medida en 1 estación próxima (${lista()})`;
    else principal = `Lluvia medida en estaciones próximas: ${lista()}`;
    const lejos = aemetEstacion && aemetEstacion.km > LEJOS_KM ? ', estación lejana' : '';
    const deAemet = aemet ? `${aemetEstacion?.nombre ? `${aemet} con AEMET (${aemetEstacion.nombre}${Number.isFinite(aemetEstacion.km) ? `, a ${km(aemetEstacion.km)}${nbsp}km` : ''}${lejos})` : `${aemet} con AEMET`}` : '';
    const modelo = `el resto, modelo${factor !== 1 ? ` ×${coma(factor)}` : ''}`;
    const detalle = resto > 0 || aemet > 0
      ? `${medidos} de ${total} días medidos${deAemet ? `, ${deAemet}` : ''}${resto > 0 ? `; ${modelo}` : ''}` : '';
    return { corto: 'Medida en estaciones', principal, detalle };
  }
  const motivo = n ? 'sin datos de estaciones en los últimos 26 días'
    : cercanas > 0 ? 'las estaciones cercanas no tienen datos válidos' : 'sin estación cercana';
  return { corto: 'Estimada con el modelo', principal: `Lluvia estimada con el modelo (${motivo})`,
    detalle: factor !== 1 ? `Corregida ×${coma(factor)} con las estaciones de la zona` : '' };
}

// Una sola frase (hoja del mapa): principal y detalle.
export function textoOrigenLluvia(args) {
  const { principal, detalle } = partesOrigenLluvia(args);
  return detalle ? `${principal}. ${detalle[0].toUpperCase()}${detalle.slice(1)}` : principal;
}

// Punto de Zona: la ventana de 26 días de su serie y lo que dejó aplicarPluvio (meteo.pluvio.porPunto[id]). Si ningún día de
// la ventana lo midió un pluviómetro pero sí una estación AEMET, devuelve null (Zona cuenta ese caso con su texto de AEMET).
// `aemetEstacion`: { nombre, km } de la estación AEMET elegida para el punto (meteo.contrastePuntos[id].estacion).
// Sin días medidos se pasan todas las del archivo: solo deciden el motivo («sin datos en los últimos 26 días»).
export function textoOrigenPunto(serie, porPunto, aemetEstacion = null) {
  const ini = Math.max(0, serie.hoy - 25), orig = serie.origenPrecip?.slice(ini, serie.hoy + 1) ?? [];
  const medidos = orig.filter((o) => o === 'medida').length, aemet = orig.filter((o) => esMedida(o) && o !== 'medida').length;
  if (!medidos && aemet) return null;
  const ns = orig.flatMap((o, k) => (o === 'medida' ? [porPunto.nDia?.[ini + k] ?? 0] : [])).filter((x) => x > 0);
  const todas = porPunto.estaciones ?? [];
  const estaciones = medidos ? estacionesDesde(todas, serie.fechas[ini]) ?? [] : todas;
  return partesOrigenLluvia({ estaciones, medidos, total: orig.length, aemet,
    aemetEstacion: aemetEstacion ? { nombre: aemetEstacion.nombre, km: aemetEstacion.distanciaKm } : null,
    factor: porPunto.factor, cercanas: porPunto.cercanas, muestra: 2, cortarNombres: true,
    porDia: ns.length ? { min: Math.min(...ns), max: Math.max(...ns) } : null });
}

// Celda del índice del mapa: solo si el índice trae el origen (función «rejilla» con pluviómetros). `lluvia.km` (opcional)
// lleva la distancia de cada estación nombrada; `lluvia.aportan`, cuántas aportaron en los 26 días (los nombres son las
// tres más cercanas de ellas). Sin `aportan` (índice anterior) los nombres pueden ser de estaciones que no midieron en la
// ventana: no se nombran. `lluvia.factor`: el sesgo con que se corrigió el modelo (días 2).
export function origenDeCelda(celda) {
  const l = celda?.lluvia;
  if (!Array.isArray(l?.estaciones) || !Array.isArray(l.origen)) return null;
  const orig = l.origen.slice(Math.max(0, l.hoy - 25), l.hoy + 1), cercanas = l.cercanas ?? 0;
  const conocidas = Number.isInteger(l.aportan);
  const estaciones = !conocidas ? [] : Array.isArray(l.km) ? l.estaciones.map((nombre, i) => ({ nombre, km: l.km[i] })) : l.estaciones;
  return { estaciones, medidos: orig.filter((c) => c === 1).length, total: orig.length, cercanas, aprox: true,
    otras: conocidas ? Math.max(0, l.aportan - estaciones.length) : 0, factor: Number.isFinite(l.factor) ? l.factor : 1 };
}

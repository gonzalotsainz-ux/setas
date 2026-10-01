// js/rejilla/nota.js
// Nota de una celda fina (spec §3.3): temperatura corregida por altitud respecto a la de referencia de su celda
// gruesa (−0,65 °C cada 100 m), ajuste orientativo de humedad por orientación y la misma fórmula de indice.js.
// `altRef` es la altitud a la que se pidió la meteo de la celda gruesa (altitudConsulta, la publicada).
// El ajuste por orientación lo aplica indiceDesdeAgregados (lluvia de 26 días × ajuste, fW acotado); aquí solo se le pasa.
// Solo cuentan las especies cuyo hábitat encaja con la celda y que están en temporada ese día.
import { indiceDesdeAgregados, enTemporada, DatosIncompletos } from '../indice.js';
import { ajusteHumedad } from './orientacion.js';

export const GRADIENTE = -0.0065;   // °C por metro

// Una diferencia de altitud que no es un número (altitud de la celda o de referencia sin dato) no se corrige ni se
// omite: DatosIncompletos, y la celda queda en gris.
export function corregirAltitud(ag, dAlt) {
  if (!Number.isFinite(dAlt)) throw new DatosIncompletos(`diferencia de altitud sin dato (${dAlt})`);
  if (dAlt === 0) return ag;
  const d = GRADIENTE * dAlt, mas = (v) => (v == null ? null : v + d);
  return { ...ag, T20aire: mas(ag.T20aire), T20suelo: mas(ag.T20suelo), tmin7: ag.tmin7.map(mas) };
}

export function notaEspecie(ag, especie, { altitud, altRef, orientacion = 0, explicar = true }) {
  if (!Number.isFinite(altitud) || !Number.isFinite(altRef)) return null;   // null − 1500 sería «finito»: se mira cada una
  try {
    return indiceDesdeAgregados(corregirAltitud(ag, altitud - altRef), especie, { ajusteHumedad: ajusteHumedad(orientacion), explicar });
  } catch (e) {
    if (e instanceof DatosIncompletos) return null;
    throw e;
  }
}

export const especiesDeCelda = (habitat, especies, fecha, filtro = null) =>
  especies.filter((e) => e.habitats.includes(habitat) && enTemporada(fecha, e) && (!filtro || filtro.has(e.id)));

const vacia = (sinEspecies, faltan = []) => ({ sinEspecies, valor: null, especie: null, resultado: null, otras: [], faltan });

export function notaCelda({ ag, habitat, altitud, altRef, orientacion = 0, especies, fecha, filtro = null, explicar = true }) {
  // La temporada se mira en la fecha de los agregados (la del día publicado) si la traen.
  const candidatas = especiesDeCelda(habitat, especies, ag?.fecha ?? fecha, filtro);
  if (!candidatas.length) return vacia(true);
  if (!ag) return vacia(false, candidatas.map((e) => e.id));
  const calculadas = candidatas.map((e) => ({ especie: e, resultado: notaEspecie(ag, e, { altitud, altRef, orientacion, explicar }) }));
  // `faltan`: especies del hábitat en temporada sin datos para calcularlas (la hoja lo dice; nunca un 0 inventado).
  const faltan = calculadas.filter((x) => !x.resultado).map((x) => x.especie.id);
  const notas = calculadas.filter((x) => x.resultado).sort((a, b) => b.resultado.valor - a.resultado.valor);
  if (!notas.length) return vacia(false, faltan);
  return { sinEspecies: false, valor: notas[0].resultado.valor, especie: notas[0].especie, resultado: notas[0].resultado,
    otras: notas.slice(1).map((x) => ({ especie: x.especie, valor: x.resultado.valor })), faltan };
}

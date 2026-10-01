// js/rejilla/orientacion.js
// Ajuste ORIENTATIVO de la humedad (multiplica fW) según la orientación de la ladera: umbría frente a solana.
// No hay calibración local. Valores y fuentes: docs/datos.md («Ajuste por orientación») y
// docs/investigacion/08-rejilla-fuentes.md, apartado D8. Sin fuente, todo vale 1.
// N y S son el punto medio entre 1 y la razón publicada, recortado al tope 0,85–1,15; las diagonales llevan
// la mitad del efecto de su rumbo principal; E, O y llano (código 0) quedan neutros.
import { ORIENTACIONES } from './formato.js';

export const AJUSTE_ORIENTACION = Object.freeze({
  llano: 1, N: 1.15, NE: 1.075, E: 1, SE: 0.925, S: 0.85, SO: 0.925, O: 1, NO: 1.075,
});

export const FUENTES_ORIENTACION = Object.freeze([
  Object.freeze({
    url: 'https://hal.science/hal-00884160v1',
    titulo: 'Bonet et al. (2008). Empirical models for predicting the production of wild mushrooms in Scots pine (Pinus sylvestris L.) forests in the Central Pyrenees. Annals of Forest Science 65: 206. doi:10.1051/forest:2007089',
    consultado: '2026-10-01',
    que: 'Producción total de setas (kg/ha, 24 parcelas de pino silvestre del Prepirineo, 1995-1997): ln(y) = 0,981 + 2,483 ln(G) − 0,128 G + 0,934 cos(Asp) − 0,0135 Slo^1,5 (ec. 8). Norte frente a este u oeste: e^0,934 ≈ 2,54; sur: e^−0,934 ≈ 0,39. Punto medio con 1: 1,77 y 0,70, recortados al tope: 1,15 y 0,85.',
  }),
]);

export const ajusteHumedad = (codigo) => AJUSTE_ORIENTACION[ORIENTACIONES[codigo]] ?? 1;
export const esOrientativo = (codigo) => ajusteHumedad(codigo) !== 1;

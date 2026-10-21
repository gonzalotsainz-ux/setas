// Contorno suave de la zona seleccionada: una superelipse inscrita en su bbox. Sin DOM.
import { COLOR } from '../mapa.js';

const EXPONENTE = 2.5;

// bbox = [oeste, sur, este, norte]. Devuelve n pares [lat, lon] recorridos en sentido horario desde el norte.
// Los parámetros t arrancan en el norte (π/2) y decrecen: N → E → S → O. Con n múltiplo de 4 el norte, el sur,
// el este y el oeste caen exactamente sobre los lados del bbox.
export function contornoZona(bbox, n = 64) {
  const [oeste, sur, este, norte] = bbox;
  const cx = (oeste + este) / 2;
  const cy = (sur + norte) / 2;
  const rx = (este - oeste) / 2;
  const ry = (norte - sur) / 2;
  const potencia = 2 / EXPONENTE;
  const puntos = [];
  for (let k = 0; k < n; k++) {
    const t = Math.PI / 2 - (2 * Math.PI * k) / n;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = cx + rx * Math.sign(c) * Math.abs(c) ** potencia;
    const y = cy + ry * Math.sign(s) * Math.abs(s) ** potencia;
    puntos.push([y, x]);
  }
  return puntos;
}

export const ESTILO_CONTORNO = { color: COLOR.acento, weight: 1.5, dashArray: '6 6', fill: false, interactive: false };

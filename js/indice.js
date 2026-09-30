// Índice de condiciones 0–100 por especie. Función pura: sin DOM ni red.
// Fundamento: docs/investigacion/03-fructificacion-datos.md §1.5.

export class DatosIncompletos extends Error {}

export const HISTORIA_MINIMA = 30;
const PESOS = { fW: 0.35, fT: 0.25, fS: 0.20, fR: 0.20 };
const CORTES = [[80, 'muy bueno'], [60, 'bueno'], [40, 'posible'], [20, 'bajo'], [0, 'nulo']];

export const etiqueta = (v) => CORTES.find(([m]) => v >= m)[1];
export const pesoPrevision = (d) => (d <= 0 ? 1 : d <= 3 ? 0.8 : d <= 7 ? 0.6 : 0.4);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const r1 = (x) => Math.round(x * 10) / 10;

function dato(serie, campo, j) {
  const v = serie[campo]?.[j];
  if (v == null || Number.isNaN(v)) throw new DatosIncompletos(`${campo} sin dato el ${serie.fechas[j] ?? j}`);
  return v;
}
const lluvia = (s, j) => dato(s, 'precip', j) * pesoPrevision(j - s.hoy);
function sumaLluvia(s, desde, hasta) { let t = 0; for (let j = desde; j <= hasta; j++) t += lluvia(s, j); return t; }
function media(s, campo, desde, hasta) { let t = 0; for (let j = desde; j <= hasta; j++) t += dato(s, campo, j); return t / (hasta - desde + 1); }

function calendario(fecha, meses) {
  const m = Number(fecha.slice(5, 7));
  if (meses.includes(m)) return 1;
  const siguiente = (m % 12) + 1, anterior = ((m + 10) % 12) + 1;
  return meses.includes(siguiente) || meses.includes(anterior) ? 0.5 : 0;
}

function lluviaDesdeAgosto(s, i) {
  const f = s.fechas[i], m = Number(f.slice(5, 7)), a = Number(f.slice(0, 4));
  const agosto = `${m >= 8 ? a : a - 1}-08-01`;
  let mm = 0, j0 = s.fechas.indexOf(agosto);
  if (j0 === -1) {
    if (s.fechas[0] < agosto) j0 = 0;
    else {
      if (s.lluviaAntesDeSerie?.desde !== agosto) throw new DatosIncompletos('falta la lluvia desde el 1 de agosto');
      mm = s.lluviaAntesDeSerie.mm; j0 = 0;
    }
  }
  return mm + sumaLluvia(s, j0, i);
}

export function calcularIndice(serie, i, especie) {
  const sp = especie.indice;
  if (i < HISTORIA_MINIMA - 1 || i >= serie.fechas.length) throw new DatosIncompletos(`faltan días de historia para ${serie.fechas[i] ?? i}`);
  const fecha = serie.fechas[i];
  const explicacion = [];
  const base = { confianza: sp.confianza, prevision: i > serie.hoy };

  const fC = calendario(fecha, especie.temporada.meses);
  if (fC === 0) {
    return { ...base, valor: 0, etiqueta: 'nulo', factores: { fW: null, fR: null, fT: null, fS: null, fA: null, fC, pen: null },
      datos: {}, explicacion: ['Fuera de temporada'] };
  }

  const P26 = sumaLluvia(serie, i - 25, i);
  const fW = clamp01((P26 - sp.pmin) / (sp.pfull - sp.pmin));
  explicacion.push(`${Math.round(P26)} mm en 26 días (mínimo ${sp.pmin}, pleno ${sp.pfull})`);

  let P3 = 0, lag = 99;
  for (let k = 0; k < 28; k++) { const j = i - k, p = sumaLluvia(serie, j - 2, j); if (p > P3) { P3 = p; lag = k; } }
  const [d0, d1] = sp.desfase;
  const dist = lag < d0 ? d0 - lag : lag > d1 ? lag - d1 : 0;
  const fR = clamp01(P3 / 30) * Math.exp(-((dist / 5) ** 2) / 2);
  explicacion.push(P3 > 0 ? `Mayor tanda de lluvia: ${Math.round(P3)} mm hace ${lag} días (ideal ${d0}–${d1})` : 'Sin tandas de lluvia en el último mes');

  const T20 = media(serie, sp.usarSuelo ? 'tsuelo' : 'tmedia', i - 19, i);
  const sigma = (sp.trango[1] - sp.trango[0]) / 2;
  const fT = Math.exp(-(((T20 - sp.topt) / sigma) ** 2) / 2);
  explicacion.push(`${sp.usarSuelo ? 'Suelo' : 'Aire'} a ${r1(T20)} °C de media en 20 días (óptimo ${sp.topt} °C)`);

  const pct = serie.hsueloPct?.[i] ?? null;
  const fS = pct == null ? null : clamp01((pct - 20) / 50);
  explicacion.push(pct == null ? 'Sin climatología: no se ha tenido en cuenta la humedad del suelo' : `Humedad del suelo en el percentil ${Math.round(pct)}`);

  let fA = 1, Pagosto = null;
  if (especie.temporada.tipo === 'otono') {
    Pagosto = lluviaDesdeAgosto(serie, i);
    fA = Pagosto >= 50 ? 1 : 0.3;
    if (fA < 1) explicacion.push(`Temporada sin arrancar: ${Math.round(Pagosto)} mm desde el 1 de agosto (hacen falta 50)`);
  }

  let pen = 1;
  if (sp.helada !== 'alta') {
    let noches = 0, fuerte = false;
    for (let j = i - 6; j <= i; j++) { const t = dato(serie, 'tmin', j); if (t <= 0) noches++; if (t < -3) fuerte = true; }
    if (noches) { pen *= 0.85 ** noches; explicacion.push(`${noches} noche(s) de helada en 7 días`); }
    if (fuerte) { pen *= sp.helada === 'media' ? 0.5 : 0.2; explicacion.push('Helada fuerte (< −3 °C): corta la fructificación'); }
  }
  let et7 = 0, p7 = 0, hr7 = 0, ventosos = 0;
  for (let j = i - 6; j <= i; j++) {
    et7 += dato(serie, 'et0', j); p7 += lluvia(serie, j); hr7 += dato(serie, 'hr', j) / 7;
    if (dato(serie, 'viento', j) > 35) ventosos++;
  }
  if (et7 - p7 > 15 && (hr7 < 55 || ventosos >= 3)) { pen *= 0.75; explicacion.push('Ambiente secante: evaporación alta, aire seco o viento'); }
  if (T20 > sp.trango[1] + 4) { pen *= 0.6; explicacion.push('Demasiado calor para la especie'); }

  const factores = { fW, fT, fS, fR };
  const usados = Object.keys(PESOS).filter((k) => factores[k] != null);
  const total = usados.reduce((t, k) => t + PESOS[k], 0);
  const geo = usados.reduce((b, k) => b * factores[k] ** (PESOS[k] / total), 1);
  const valor = Math.round(100 * geo * fA * fC * pen);

  return { ...base, valor, etiqueta: etiqueta(valor), factores: { fW, fR, fT, fS, fA, fC, pen },
    datos: { P26, P3, lag, T20, pct, Pagosto }, explicacion };
}

export function indiceZona(seriesPorPunto, i, especies) {
  const res = [];
  for (const sp of especies) {
    let mejor = null, min = Infinity, max = -Infinity;
    for (const [punto, serie] of Object.entries(seriesPorPunto)) {
      let r;
      try { r = calcularIndice(serie, i, sp); } catch (e) { if (e instanceof DatosIncompletos) continue; throw e; }
      min = Math.min(min, r.valor); max = Math.max(max, r.valor);
      if (!mejor || r.valor > mejor.valor) mejor = { id: sp.id, valor: r.valor, punto, resultado: r };
    }
    if (mejor) res.push({ ...mejor, min, max });
  }
  res.sort((a, b) => b.valor - a.valor);
  if (!res.length) return { valor: null, etiqueta: null, sinDatos: true, especies: [] };
  return { valor: res[0].valor, etiqueta: etiqueta(res[0].valor), sinDatos: false, especies: res };
}

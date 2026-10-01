// Índice de condiciones 0–100 por especie. Función pura: sin DOM ni red.
// Fundamento: docs/investigacion/03-fructificacion-datos.md §1.5.

export class DatosIncompletos extends Error {}

export const HISTORIA_MINIMA = 30;
export const PESOS = { fW: 0.35, fT: 0.25, fS: 0.20, fR: 0.20 };
const CORTES = [[80, 'muy bueno'], [60, 'bueno'], [40, 'posible'], [20, 'bajo'], [0, 'nulo']];

export const etiqueta = (v) => CORTES.find(([m]) => v >= m)[1];
export const pesoPrevision = (d) => (d <= 0 ? 1 : d <= 3 ? 0.8 : d <= 7 ? 0.6 : 0.4);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Tope del ajuste por orientación (js/rejilla/orientacion.js toma de aquí sus extremos): el ajuste multiplica la
// lluvia de 26 días, pero fW nunca se aparta más de este factor del fW sin ajuste (≈ ±5 % en la nota, con el peso 0,35).
export const TOPE_AJUSTE_HUMEDAD = Object.freeze({ min: 0.85, max: 1.15 });
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
// «En temporada» (spec §5): el calendario de la especie da algo (> 0) ese día; los meses contiguos cuentan.
export const enTemporada = (fecha, especie) => calendario(fecha, especie.temporada.meses) > 0;
const diaAnterior = (f) => new Date(Date.parse(`${f}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);

function lluviaDesdeAgosto(s, i) {
  const f = s.fechas[i], m = Number(f.slice(5, 7)), a = Number(f.slice(0, 4));
  const agosto = `${m >= 8 ? a : a - 1}-08-01`;
  let mm = 0, j0 = s.fechas.indexOf(agosto);
  if (j0 === -1) {
    if (s.fechas[0] < agosto) j0 = 0;
    else {
      const antes = s.lluviaAntesDeSerie;
      // la suma tiene que empezar el 1-ago y acabar justo el día antes de la serie (si trae `hasta`)
      if (antes?.desde !== agosto || antes.mm == null || (antes.hasta && antes.hasta !== diaAnterior(s.fechas[0]))) throw new DatosIncompletos('falta la lluvia desde el 1 de agosto');
      mm = s.lluviaAntesDeSerie.mm; j0 = 0;
    }
  }
  return mm + sumaLluvia(s, j0, i);
}

const intento = (f) => { try { return f(); } catch (e) { if (e instanceof DatosIncompletos) return null; throw e; } };

// Paso 1 (no depende de la especie): agregados del día i. Cada uno es null si le faltan datos; la especie que lo
// necesite dará DatosIncompletos en el paso 2. Es lo que publica el precálculo de Supabase por celda gruesa.
export function agregadosDia(serie, i) {
  if (i < HISTORIA_MINIMA - 1 || i >= serie.fechas.length) throw new DatosIncompletos(`faltan días de historia para ${serie.fechas[i] ?? i}`);
  const P26 = intento(() => sumaLluvia(serie, i - 25, i));
  const tanda = intento(() => {
    let P3 = 0, lag = 99;
    for (let k = 0; k < 28; k++) { const j = i - k, p = sumaLluvia(serie, j - 2, j); if (p > P3) { P3 = p; lag = k; } }
    return { P3, lag };
  });
  const secante = intento(() => {
    let et7 = 0, p7 = 0, hr7 = 0, ventosos = 0;
    for (let j = i - 6; j <= i; j++) {
      et7 += dato(serie, 'et0', j); p7 += lluvia(serie, j); hr7 += dato(serie, 'hr', j) / 7;
      if (dato(serie, 'viento', j) > 35) ventosos++;
    }
    return et7 - p7 > 15 && (hr7 < 55 || ventosos >= 3);
  });
  const tmin7 = [];
  for (let j = i - 6; j <= i; j++) { const v = serie.tmin?.[j]; tmin7.push(v == null || Number.isNaN(v) ? null : v); }
  return {
    fecha: serie.fechas[i], prevision: i > serie.hoy,
    P26, P3: tanda?.P3 ?? null, lag: tanda?.lag ?? null, pct: serie.hsueloPct?.[i] ?? null,
    Pagosto: intento(() => lluviaDesdeAgosto(serie, i)), secante,
    T20aire: intento(() => media(serie, 'tmedia', i - 19, i)), T20suelo: intento(() => media(serie, 'tsuelo', i - 19, i)), tmin7,
  };
}

// Paso 2: la nota de una especie a partir de los agregados. `ajusteHumedad` (orientación de la ladera, orientativo)
// multiplica la lluvia de 26 días antes de calcular fW, con fW acotado a ±15 % del fW sin ajuste
// (TOPE_AJUSTE_HUMEDAD); 1 = sin ajuste, como en Hoy y Zona. `explicar: false` no construye las frases (pintado del mapa).
export function indiceDesdeAgregados(ag, especie, { ajusteHumedad = 1, explicar = true } = {}) {
  const sp = especie.indice;
  const base = { confianza: sp.confianza, prevision: ag.prevision };
  const fC = calendario(ag.fecha, especie.temporada.meses);
  if (fC === 0) {
    return { ...base, valor: 0, etiqueta: 'nulo', factores: { fW: null, fR: null, fT: null, fS: null, fA: null, fC, pen: null },
      datos: {}, explicacion: ['Fuera de temporada'] };
  }
  const falta = (campo) => { throw new DatosIncompletos(`${campo} sin dato el ${ag.fecha}`); };
  const explicacion = [];
  const decir = (f) => { if (explicar) explicacion.push(f()); };

  if (ag.P26 == null || ag.P3 == null) falta('precip');
  const P26 = ag.P26, rangoW = sp.pfull - sp.pmin;
  const fW0 = (P26 - sp.pmin) / rangoW, fWef = (P26 * ajusteHumedad - sp.pmin) / rangoW;   // sin recortar a 0–1
  const fW = clamp01(Math.min(Math.max(fWef, fW0 * TOPE_AJUSTE_HUMEDAD.min), fW0 * TOPE_AJUSTE_HUMEDAD.max));
  decir(() => `${Math.round(P26)} mm en 26 días (mínimo ${sp.pmin}, pleno ${sp.pfull})`);

  const { P3, lag } = ag;
  const [d0, d1] = sp.desfase;
  const dist = lag < d0 ? d0 - lag : lag > d1 ? lag - d1 : 0;
  const fR = clamp01(P3 / 30) * Math.exp(-((dist / 5) ** 2) / 2);
  decir(() => (P3 > 0 ? `Mayor tanda de lluvia: ${Math.round(P3)} mm hace ${lag} días (ideal ${d0}–${d1})` : 'Sin tandas de lluvia en el último mes'));

  const T20 = sp.usarSuelo ? ag.T20suelo : ag.T20aire;
  if (T20 == null) falta(sp.usarSuelo ? 'tsuelo' : 'tmedia');
  const sigma = (sp.trango[1] - sp.trango[0]) / 2;
  const fT = Math.exp(-(((T20 - sp.topt) / sigma) ** 2) / 2);
  decir(() => `${sp.usarSuelo ? 'Suelo' : 'Aire'} a ${r1(T20)} °C de media en 20 días (óptimo ${sp.topt} °C)`);

  const pct = ag.pct;
  const fS = pct == null ? null : clamp01((pct - 20) / 50);
  decir(() => (pct == null ? 'Sin climatología: no se ha tenido en cuenta la humedad del suelo' : `Humedad del suelo en el percentil ${Math.round(pct)}`));

  let fA = 1, Pagosto = null;
  if (especie.temporada.tipo === 'otono') {
    if (ag.Pagosto == null) throw new DatosIncompletos('falta la lluvia desde el 1 de agosto');
    Pagosto = ag.Pagosto;
    fA = Pagosto >= 50 ? 1 : 0.3;
    if (fA < 1) decir(() => `Temporada sin arrancar: ${Math.round(Pagosto)} mm desde el 1 de agosto (hacen falta 50)`);
  }

  let pen = 1;
  if (sp.helada !== 'alta') {
    if (ag.tmin7.some((t) => t == null)) falta('tmin');
    let noches = 0, fuerte = false;
    for (const t of ag.tmin7) { if (t <= 0) noches++; if (t < -3) fuerte = true; }
    if (noches) { pen *= 0.85 ** noches; decir(() => `${noches} noche(s) de helada en 7 días`); }
    if (fuerte) { pen *= sp.helada === 'media' ? 0.5 : 0.2; decir(() => 'Helada fuerte (< −3 °C): corta la fructificación'); }
  }
  if (ag.secante == null) falta('et0');
  if (ag.secante) { pen *= 0.75; decir(() => 'Ambiente secante: evaporación alta, aire seco o viento'); }
  if (T20 > sp.trango[1] + 4) { pen *= 0.6; decir(() => 'Demasiado calor para la especie'); }

  const factores = { fW, fT, fS, fR };
  const usados = Object.keys(PESOS).filter((k) => factores[k] != null);
  const total = usados.reduce((t, k) => t + PESOS[k], 0);
  const geo = usados.reduce((b, k) => b * factores[k] ** (PESOS[k] / total), 1);
  const valor = Math.round(100 * geo * fA * fC * pen);

  return { ...base, valor, etiqueta: etiqueta(valor), factores: { fW, fR, fT, fS, fA, fC, pen },
    datos: { P26, P3, lag, T20, pct, Pagosto }, explicacion };
}

export function calcularIndice(serie, i, especie) {
  return indiceDesdeAgregados(agregadosDia(serie, i), especie);
}

// Nota de zona (spec §5): el máximo de las especies EN TEMPORADA, con el mejor punto de cada una.
// - Las de fuera de temporada (fC = 0) no entran en la nota: si solo hay de esas, `fueraDeTemporada` y sin nota.
// - `faltan`: especies en temporada que no se han podido calcular en ningún punto (DatosIncompletos). Si falta
//   alguna, la zona es `incompleta`; si además no queda ninguna calculada, `sinDatos` (nunca un 0 inventado).
export function indiceZona(seriesPorPunto, i, especies) {
  const res = [], faltan = [];
  let fuera = 0;
  const fecha = Object.values(seriesPorPunto).map((s) => s?.fechas?.[i]).find(Boolean);
  for (const sp of especies) {
    let mejor = null, min = Infinity, max = -Infinity, esFuera = false;
    for (const [punto, serie] of Object.entries(seriesPorPunto)) {
      let r;
      try { r = calcularIndice(serie, i, sp); } catch (e) { if (e instanceof DatosIncompletos) continue; throw e; }
      if (r.factores.fC === 0) { esFuera = true; break; }
      min = Math.min(min, r.valor); max = Math.max(max, r.valor);
      if (!mejor || r.valor > mejor.valor) mejor = { id: sp.id, valor: r.valor, punto, resultado: r };
    }
    if (esFuera) fuera++;
    else if (mejor) res.push({ ...mejor, min, max });
    else if (!fecha || enTemporada(fecha, sp)) faltan.push(sp.id);   // sin fecha no se sabe: cuenta como faltante
  }
  res.sort((a, b) => b.valor - a.valor);
  const incompleta = faltan.length > 0;
  if (!res.length) {
    const soloFuera = fuera > 0 && !incompleta;
    return { valor: null, etiqueta: null, sinDatos: !soloFuera, fueraDeTemporada: soloFuera, incompleta, faltan, especies: [] };
  }
  return { valor: res[0].valor, etiqueta: etiqueta(res[0].valor), sinDatos: false, fueraDeTemporada: false, incompleta, faltan, especies: res };
}

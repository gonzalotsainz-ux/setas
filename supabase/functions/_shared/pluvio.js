// supabase/functions/_shared/pluvio.js
// Lluvia medida en pluviómetros (spec §3.3), compartido por la función «pluvio», la función «rejilla» y el navegador
// (vía .nojekyll). Sin DOM ni red.
//  - Mezcla: para un lugar (punto de zona o celda gruesa), la lluvia de un día es la media ponderada de las estaciones
//    válidas a menos de 20 km y 600 m de desnivel; peso = 1/km² (desde 1 km) / (1 + |desnivel| / 300). [CRITERIO PROPIO]
//    Solo entran los días con calidad «ok» (validosDe). Una estación a menos de 1,5 km de otra más cercana al lugar (la
//    misma publicada por dos fuentes: C010/C076, 9178X/C00A, 8210Y/5N03, 3319D/PN34) se une a su sitio, sin encadenar:
//    el sitio vale la media de las que dan dato, con el peso fijo de la más cercana; `n` cuenta sitios, no estaciones.
//  - Sesgo: en los días sin estación válida, el modelo se multiplica por el cociente medido/modelo de los últimos 30 días
//    en los lugares de la zona que sí tienen estación: por fecha la media de los lugares, (medido + 5) / (modelo + 5) y
//    acotado entre 0,5 y 2. No se corrige con menos de 10 fechas, menos de 10 mm de modelo o menos de 3 días mojados
//    (≥ 1 mm): una sola tormenta mal situada no debe doblar ni partir la lluvia. Corrige también la lluvia anterior a la
//    serie si no está medida entera.
//  - Archivos publicados (pluvio/ultimo.json por punto de zona, pluvio/celdas.json por celda gruesa):
//    { version, generado, desde, hasta, lugares: { id: { mm, n, estaciones, cercanas } }, fuentes?, aemet? } (docs/datos.md).
import { sumarDias, entreDias } from './meteo.js';

export const VERSION_PLUVIO = 1;
export const MEZCLA = Object.freeze({ radioKm: 20, desnivelMax: 600, escalaDesnivel: 300, kmMin: 1, duplicadaKm: 1.5 });
export const SESGO = Object.freeze({ dias: 30, min: 0.5, max: 2, modeloMinimo: 10, fechasMinimas: 10, diasMojados: 3, mojadoMm: 1, suavizado: 5 });
const r1 = (x) => Math.round(x * 10) / 10;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Distancia en km entre dos coordenadas (haversine); null si falta alguna.
export function distanciaKm(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every(Number.isFinite)) return null;
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function pesoEstacion(km, desnivel, m = MEZCLA) {
  if (!(km <= m.radioKm) || !(Math.abs(desnivel) <= m.desnivelMax)) return 0;
  return 1 / Math.max(km, m.kmMin) ** 2 / (1 + Math.abs(desnivel) / m.escalaDesnivel);
}
// Las estaciones en radio, de la más cercana a la más lejana. `grupo` es la clave del representante de su sitio (la más
// cercana al lugar) y `pesoSitio` su peso: una estación a menos de `duplicadaKm` de un representante anterior se une a él;
// solo se compara con representantes, para que una cadena de estaciones a 1,2 km no acabe en un sitio de 3 km.
export function cercanas(lugar, estaciones, m = MEZCLA) {
  const lista = estaciones.flatMap((e) => {
    const km = distanciaKm(lugar, e);
    if (km == null || !Number.isFinite(e.altitud) || !Number.isFinite(lugar.altitud)) return [];
    const peso = pesoEstacion(km, e.altitud - lugar.altitud, m);
    return peso > 0 ? [{ e, c: { clave: `${e.fuente}:${e.codigo}`, nombre: e.nombre, fuente: e.fuente, km: r1(km), peso } }] : [];
  }).sort((a, b) => a.c.km - b.c.km);
  const reps = [];
  return lista.map(({ e, c }) => {
    const rep = reps.find((o) => distanciaKm(o.e, e) < m.duplicadaKm);
    if (!rep) reps.push({ e, c });
    return Object.assign(c, { grupo: rep ? rep.c.clave : c.clave, pesoSitio: rep ? rep.c.peso : c.peso });
  });
}
// Media ponderada por sitio: el sitio vale la media de sus estaciones con dato y pesa lo de su representante.
export function mezclarDia(cerca, valores) {
  const sitios = new Map();
  for (const c of cerca) if (valores.has(c.clave)) {
    const g = c.grupo ?? c.clave, t = sitios.get(g) ?? { s: 0, k: 0, w: c.pesoSitio ?? c.peso };
    t.s += valores.get(c.clave); t.k++;
    sitios.set(g, t);
  }
  let s = 0, w = 0;
  for (const t of sitios.values()) { s += t.w * (t.s / t.k); w += t.w; }
  return sitios.size ? { mm: r1(s / w), n: sitios.size } : null;
}
// De los días revisados (calidad.js) a Map<'fuente:codigo', Map<fecha, mm>>: solo los de calidad «ok».
export function validosDe(dias) {
  const r = new Map();
  for (const d of dias) if (d.calidad === 'ok' && typeof d.mm === 'number' && Number.isFinite(d.mm) && d.mm >= 0) {
    const k = `${d.fuente}:${d.estacion}`;
    if (!r.has(k)) r.set(k, new Map());
    r.get(k).set(d.fecha, d.mm);
  }
  return r;
}
export function seriesMedidas(lugares, estaciones, validos, desde, hasta) {
  const fechas = Array.from({ length: entreDias(desde, hasta) + 1 }, (_, k) => sumarDias(desde, k));
  const r = {};
  for (const l of lugares) {
    const cerca = cercanas(l, estaciones);
    if (!cerca.length) continue;
    const usadas = new Set(), mm = [], n = [];
    for (const f of fechas) {
      const valores = new Map();
      for (const c of cerca) { const v = validos.get(c.clave)?.get(f); if (Number.isFinite(v) && v >= 0) valores.set(c.clave, v); }
      const d = mezclarDia(cerca, valores);
      mm.push(d?.mm ?? null);
      n.push(d?.n ?? 0);
      for (const k of valores.keys()) usadas.add(k);
    }
    r[l.id] = { mm, n, estaciones: cerca.filter((c) => usadas.has(c.clave)).map(({ nombre, fuente, km }) => ({ nombre, fuente, km })), cercanas: cerca.length };
  }
  return r;
}

// Pares (medido, modelo) de los últimos `dias` días hasta `hasta`, de una serie del MODELO (antes de aplicar la medida).
export function paresSesgo(serie, medida, desde, hasta, dias = SESGO.dias) {
  if (!medida?.mm) return [];
  const inicio = sumarDias(hasta, -(dias - 1));
  return serie.fechas.flatMap((f, j) => {
    if (j >= serie.hoy || f < inicio || f > hasta || f < desde) return [];
    const m = medida.mm[entreDias(desde, f)], p = serie.precip[j];
    return Number.isFinite(m) && Number.isFinite(p) ? [{ fecha: f, medida: m, modelo: p }] : [];
  });
}
// Pares de todos los lugares de una zona con estación: por fecha, la media de los lugares; luego la suma del periodo.
export function factorSesgo(pares, s = SESGO) {
  const porFecha = new Map();
  for (const p of pares) {
    if (!Number.isFinite(p?.medida) || !Number.isFinite(p?.modelo)) continue;
    const t = porFecha.get(p.fecha) ?? { medida: 0, modelo: 0, k: 0 };
    t.medida += p.medida; t.modelo += p.modelo; t.k++;
    porFecha.set(p.fecha, t);
  }
  if (porFecha.size < s.fechasMinimas) return 1;
  let med = 0, mod = 0, mojados = 0;
  for (const t of porFecha.values()) {
    const me = t.medida / t.k, mo = t.modelo / t.k;
    med += me; mod += mo;
    if (me >= s.mojadoMm || mo >= s.mojadoMm) mojados++;
  }
  if (mod < s.modeloMinimo || mojados < s.diasMojados) return 1;
  const f = Math.round(Math.min(s.max, Math.max(s.min, (med + s.suavizado) / (mod + s.suavizado))) * 100) / 100;
  return Number.isFinite(f) ? f : 1;
}

// La serie con la lluvia medida en los días del tramo [desde, hasta] que la tienen ('medida') y el modelo corregido por
// `factor` en los demás días pasados del tramo ('estimada'). Hoy y la previsión siguen siendo del modelo. Si la medida
// cubre entera la lluvia anterior a la serie (del 1 de agosto al día antes de su primera fecha), la sustituye; si no, la
// corrige también por `factor` ('estimada').
export function aplicarMedida(serie, medida, { desde, hasta, factor = 1 }) {
  if (!medida && factor === 1) return serie;
  const precip = [...serie.precip], origenPrecip = serie.origenPrecip ? [...serie.origenPrecip] : serie.fechas.map(() => 'modelo');
  let cambia = false;
  serie.fechas.forEach((f, j) => {
    if (j >= serie.hoy || f < desde || f > hasta) return;
    const v = medida?.mm?.[entreDias(desde, f)];
    if (v != null) { precip[j] = v; origenPrecip[j] = 'medida'; cambia = true; }
    else if (factor !== 1 && precip[j] != null && !Number.isNaN(precip[j])) { precip[j] = r1(precip[j] * factor); origenPrecip[j] = 'estimada'; cambia = true; }
  });
  let lluviaAntesDeSerie = serie.lluviaAntesDeSerie;
  const antes = serie.lluviaAntesDeSerie;
  let medidaEntera = false;
  if (medida?.mm && antes?.desde && antes.desde >= desde) {
    const n = entreDias(antes.desde, serie.fechas[0]), k0 = entreDias(desde, antes.desde);
    const vals = Array.from({ length: n }, (_, k) => medida.mm[k0 + k]);
    if (n > 0 && vals.every((v) => v != null)) { lluviaAntesDeSerie = { ...antes, mm: r1(vals.reduce((a, b) => a + b, 0)), origen: 'medida' }; cambia = medidaEntera = true; }
  }
  if (!medidaEntera && factor !== 1 && Number.isFinite(antes?.mm)) {
    lluviaAntesDeSerie = { ...antes, mm: r1(antes.mm * factor), origen: 'estimada' }; cambia = true;
  }
  return cambia ? { ...serie, precip, origenPrecip, lluviaAntesDeSerie } : serie;
}

const num0 = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function validarPluvio(p) {
  const e = [];
  if (p?.version !== VERSION_PLUVIO) e.push('versión desconocida');
  const fechasBien = FECHA.test(p?.desde ?? '') && FECHA.test(p?.hasta ?? '') && p.hasta >= p.desde;
  if (!fechasBien) e.push('desde/hasta mal formados');
  if (!p?.lugares || typeof p.lugares !== 'object') { e.push('sin lugares'); return e; }
  const largo = fechasBien ? entreDias(p.desde, p.hasta) + 1 : -1;
  for (const [id, l] of Object.entries(p.lugares)) {
    const bien = Array.isArray(l?.mm) && l.mm.length === largo && l.mm.every((v) => v === null || num0(v))
      && Array.isArray(l.n) && l.n.length === largo && l.n.every(Number.isInteger)
      && Array.isArray(l.estaciones) && l.estaciones.every((s) => typeof s?.nombre === 'string') && Number.isInteger(l.cercanas);
    if (!bien) e.push(`lugar ${id} mal formado`);
  }
  if (p.aemet != null && (typeof p.aemet !== 'object' || !Object.values(p.aemet).every((d) => d && typeof d === 'object'
    && Object.entries(d).every(([f, v]) => FECHA.test(f) && num0(v))))) e.push('aemet mal formado');
  return e;
}

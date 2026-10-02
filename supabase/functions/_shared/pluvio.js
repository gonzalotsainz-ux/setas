// supabase/functions/_shared/pluvio.js
// Lluvia medida en pluviómetros (spec §3.3), compartido por la función «pluvio», la función «rejilla» y el navegador
// (vía .nojekyll). Sin DOM ni red.
//  - Mezcla: para un lugar (punto de zona o celda gruesa), la lluvia de un día es la media ponderada de las estaciones
//    válidas a menos de 20 km y 600 m de desnivel; peso = 1/km² (desde 1 km) / (1 + |desnivel| / 300). [CRITERIO PROPIO]
//    Solo entran los días con calidad «ok» (validosDe). Las estaciones a menos de 1,5 km entre sí (la misma publicada por
//    dos fuentes: C010/C076, 9178X/C00A, 8210Y/5N03, 3319D/PN34) son un solo sitio: la media de las que dan dato, con el
//    peso medio de ellas; `n` cuenta sitios, no estaciones.
//  - Sesgo: en los días sin estación válida, el modelo se multiplica por el cociente medido/modelo de los últimos 30 días
//    en los lugares de la zona que sí tienen estación, acotado entre 0,5 y 2; con menos de 10 días o menos de 10 mm del
//    modelo no se corrige.
//  - Archivos publicados (pluvio/ultimo.json por punto de zona, pluvio/celdas.json por celda gruesa):
//    { version, generado, desde, hasta, lugares: { id: { mm, n, estaciones, cercanas } }, fuentes?, aemet? } (docs/datos.md).
import { sumarDias, entreDias } from './meteo.js';

export const VERSION_PLUVIO = 1;
export const MEZCLA = Object.freeze({ radioKm: 20, desnivelMax: 600, escalaDesnivel: 300, kmMin: 1, duplicadaKm: 1.5 });
export const SESGO = Object.freeze({ dias: 30, min: 0.5, max: 2, modeloMinimo: 10, paresMinimos: 10 });
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
// Las estaciones en radio, de la más cercana a la más lejana; `grupo` es la clave de la más cercana de su sitio (las que
// están a menos de `duplicadaKm` de otra anterior comparten su grupo).
export function cercanas(lugar, estaciones, m = MEZCLA) {
  const lista = estaciones.flatMap((e) => {
    const km = distanciaKm(lugar, e);
    if (km == null || !Number.isFinite(e.altitud) || !Number.isFinite(lugar.altitud)) return [];
    const peso = pesoEstacion(km, e.altitud - lugar.altitud, m);
    return peso > 0 ? [{ e, c: { clave: `${e.fuente}:${e.codigo}`, nombre: e.nombre, fuente: e.fuente, km: r1(km), peso } }] : [];
  }).sort((a, b) => a.c.km - b.c.km);
  return lista.map(({ e, c }, k) => {
    const igual = lista.slice(0, k).find((o) => distanciaKm(o.e, e) < m.duplicadaKm);
    c.grupo = igual ? igual.c.grupo : c.clave;
    return c;
  });
}
// Media ponderada por sitio: dentro de un sitio, la media de sus estaciones con dato y el peso medio de ellas.
export function mezclarDia(cerca, valores) {
  const sitios = new Map();
  for (const c of cerca) if (valores.has(c.clave)) {
    const g = c.grupo ?? c.clave, t = sitios.get(g) ?? { s: 0, w: 0, k: 0 };
    t.s += valores.get(c.clave); t.w += c.peso; t.k++;
    sitios.set(g, t);
  }
  let s = 0, w = 0;
  for (const t of sitios.values()) { s += (t.w / t.k) * (t.s / t.k); w += t.w / t.k; }
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
    return m != null && p != null && !Number.isNaN(p) ? [{ medida: m, modelo: p }] : [];
  });
}
export function factorSesgo(pares, s = SESGO) {
  if (pares.length < s.paresMinimos) return 1;
  const med = pares.reduce((t, p) => t + p.medida, 0), mod = pares.reduce((t, p) => t + p.modelo, 0);
  if (mod < s.modeloMinimo) return 1;
  return Math.round(Math.min(s.max, Math.max(s.min, med / mod)) * 100) / 100;
}

// La serie con la lluvia medida en los días del tramo [desde, hasta] que la tienen ('medida') y el modelo corregido por
// `factor` en los demás días pasados del tramo ('estimada'). Hoy y la previsión siguen siendo del modelo. Si la medida
// cubre entera la lluvia anterior a la serie (del 1 de agosto al día antes de su primera fecha), la sustituye.
export function aplicarMedida(serie, medida, { desde, hasta, factor = 1 }) {
  if (!medida && factor === 1) return serie;
  const precip = [...serie.precip], origenPrecip = serie.origenPrecip ? [...serie.origenPrecip] : serie.fechas.map(() => 'modelo');
  let cambia = false;
  serie.fechas.forEach((f, j) => {
    if (j >= serie.hoy || f < desde || f > hasta) return;
    const v = medida?.mm?.[entreDias(desde, f)];
    if (v != null) { precip[j] = v; origenPrecip[j] = 'medida'; cambia = true; }
    else if (factor !== 1 && precip[j] != null && !Number.isNaN(precip[j])) { precip[j] = precip[j] * factor; origenPrecip[j] = 'estimada'; cambia = true; }
  });
  let lluviaAntesDeSerie = serie.lluviaAntesDeSerie;
  const antes = serie.lluviaAntesDeSerie;
  if (medida?.mm && antes?.desde && antes.desde >= desde) {
    const n = entreDias(antes.desde, serie.fechas[0]), k0 = entreDias(desde, antes.desde);
    const vals = Array.from({ length: n }, (_, k) => medida.mm[k0 + k]);
    if (n > 0 && vals.every((v) => v != null)) { lluviaAntesDeSerie = { ...antes, mm: r1(vals.reduce((a, b) => a + b, 0)), origen: 'medida' }; cambia = true; }
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

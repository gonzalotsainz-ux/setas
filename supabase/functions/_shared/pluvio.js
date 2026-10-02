// supabase/functions/_shared/pluvio.js
// Lluvia medida en pluviómetros (spec §3.3), compartido por la función «pluvio», la función «rejilla» y el navegador
// (vía .nojekyll). Sin DOM ni red. Radio y desnivel máximos de una estación respecto a un punto o una celda: los usa la
// selección de estaciones (scripts/pluvio/) y la mezcla (tarea 9).
export const MEZCLA = Object.freeze({ radioKm: 20, desnivelMax: 600, escalaDesnivel: 300, kmMin: 1 });

// Distancia en km entre dos coordenadas (haversine); null si falta alguna.
export function distanciaKm(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every(Number.isFinite)) return null;
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

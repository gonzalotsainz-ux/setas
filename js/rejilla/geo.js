// js/rejilla/geo.js
// Rejilla fina de 250 m en EPSG:3857 (Web Mercator, el de Leaflet y las teselas) y rejilla gruesa en grados.
// Funciones puras: las usan el generador (Node), la Edge Function no y el móvil sí.
export const R = 6378137;
export const ORIGEN = Math.PI * R;             // 20 037 508,34 m: esquina noroeste de la malla de teselas
export const TAM_FINA = 250;
export const ANCLA = { lon: -10, lat: 35 };    // esquina suroeste de la rejilla gruesa (al oeste y al sur de todas las zonas)

const RAD = Math.PI / 180;
export const aMercator = (lon, lat) => ({ x: R * lon * RAD, y: R * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) });
export const aGrados = (x, y) => ({ lon: x / R / RAD, lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / RAD });

// Columna y fila globales de la celda fina que contiene (x, y). La fila crece hacia el sur, como en las teselas.
export const celdaFina = (x, y, tam = TAM_FINA) => ({ col: Math.floor((x + ORIGEN) / tam), fila: Math.floor((ORIGEN - y) / tam) });
export const centroFina = (col, fila, tam = TAM_FINA) => ({ x: (col + 0.5) * tam - ORIGEN, y: ORIGEN - (fila + 0.5) * tam });

// Ventana de celdas finas que cubre un bbox [oeste, sur, este, norte] en grados.
export function ventanaBbox([o, s, e, n], tam = TAM_FINA) {
  const a = aMercator(o, n), b = aMercator(e, s);
  const c0 = celdaFina(a.x, a.y, tam), c1 = celdaFina(b.x, b.y, tam);
  return { col0: c0.col, fila0: c0.fila, ancho: c1.col - c0.col + 1, alto: c1.fila - c0.fila + 1 };
}

// Celda gruesa: cuadrado de `paso` grados; el id lleva la zona porque cada zona tiene su propia lista.
export const idGruesa = (zona, lon, lat, paso) => `${zona}:${Math.floor((lon - ANCLA.lon) / paso)}:${Math.floor((lat - ANCLA.lat) / paso)}`;
const partes = (id) => { const [, c, f] = id.split(':'); return [Number(c), Number(f)]; };
export function centroGruesa(id, paso) { const [c, f] = partes(id); return { lon: ANCLA.lon + (c + 0.5) * paso, lat: ANCLA.lat + (f + 0.5) * paso }; }
export function limitesGruesa(id, paso) { const [c, f] = partes(id); return [ANCLA.lon + c * paso, ANCLA.lat + f * paso, ANCLA.lon + (c + 1) * paso, ANCLA.lat + (f + 1) * paso]; }

// Un metro de Mercator mide cos(lat) metros sobre el terreno.
export const metrosSuelo = (tam, lat) => tam * Math.cos(lat * RAD);

// Punto dentro de un anillo (trazado de rayos); [lon, lat]. Movido tal cual desde scripts/validar-datos.mjs.
const enAnillo = (lon, lat, anillo) => {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};
const enPoligono = (lon, lat, [exterior, ...huecos]) => enAnillo(lon, lat, exterior) && !huecos.some((h) => enAnillo(lon, lat, h));
export const puntoEnGeometria = (lon, lat, g) => (g?.type === 'Polygon' ? enPoligono(lon, lat, g.coordinates)
  : g?.type === 'MultiPolygon' ? g.coordinates.some((p) => enPoligono(lon, lat, p)) : false);

export function bboxDe(g) {
  let o = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const anillos = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
  for (const a of anillos) for (const [x, y] of a) { if (x < o) o = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [o, s, e, n];
}

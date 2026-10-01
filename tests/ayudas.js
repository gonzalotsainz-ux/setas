// Genera una serie diaria sintética para las pruebas del índice.
export function serieSintetica({ dias = 60, hoy = 59, inicio = '2026-08-20', precip = () => 2, tmedia = () => 13,
  tmin = () => 6, tsuelo = () => 13, pct = () => 60, et0 = () => 1.5, hr = () => 75, viento = () => 15,
  lluviaAntes = { mm: 20 } } = {}) {
  const t0 = Date.parse(`${inicio}T00:00:00Z`);
  const fechas = Array.from({ length: dias }, (_, k) => new Date(t0 + k * 864e5).toISOString().slice(0, 10));
  const gen = (f) => fechas.map((_, k) => f(k));
  const anio = Number(inicio.slice(0, 4)), mes = Number(inicio.slice(5, 7));
  const agosto = `${mes >= 8 ? anio : anio - 1}-08-01`;
  return { fechas, hoy, precip: gen(precip), tmedia: gen(tmedia), tmin: gen(tmin), tmax: gen((k) => tmedia(k) + 6),
    et0: gen(et0), viento: gen(viento), hr: gen(hr), hsuelo: gen(() => 0.3), tsuelo: gen(tsuelo), hsueloPct: gen(pct),
    lluviaAntesDeSerie: lluviaAntes ? { desde: agosto, ...lluviaAntes } : null, origenPrecip: gen(() => 'modelo') };
}

export const BOLETUS = { id: 'boletus-edulis', temporada: { meses: [9, 10, 11], tipo: 'otono' },
  indice: { topt: 13, trango: [10, 15], usarSuelo: false, pmin: 30, pfull: 90, desfase: [7, 21], helada: 'baja', confianza: 'alta' } };
export const NISCALO = { id: 'lactarius-deliciosus', temporada: { meses: [10, 11, 12], tipo: 'otono' },
  indice: { topt: 10, trango: [6, 14], usarSuelo: false, pmin: 40, pfull: 100, desfase: [10, 25], helada: 'media', confianza: 'media' } };
export const MORCHELLA = { id: 'morchella', temporada: { meses: [3, 4, 5], tipo: 'primavera' },
  indice: { topt: 12, trango: [10, 15.5], usarSuelo: true, pmin: 20, pfull: 50, desfase: [5, 15], helada: 'media', confianza: 'alta' } };
// Tormenta de 20 mm/día los días 40–42 sobre una base de 2 mm/día: P26 = 106 mm; el mayor P3 es de 60 mm, a 17 días de i = 59.
export const lluviaBuena = (k) => (k >= 40 && k <= 42 ? 20 : 2);

// Almacén en memoria con la forma de localStorage.
export function almacenFalso() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
}

// js/mapa/geocodificador.js
// Buscar cualquier lugar de España con CartoCiudad (IGN): primero las sugerencias (sin coordenadas) y, al elegir una,
// sus coordenadas con un segundo paso. Todo pasa por `fetchFn`, así que las pruebas no tocan la red.
export const URL_CANDIDATOS = 'https://www.cartociudad.es/geocoder/api/geocoder/candidates';
export const URL_FIND = 'https://www.cartociudad.es/geocoder/api/geocoder/find';
export const EXCLUIDOS = ['callejero', 'portal', 'carretera'];
export const MINIMO_LETRAS = 3;
export const RETARDO_MS = 300;
const TOPE_CACHE = 50;

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const predeterminado = () => globalThis.fetch?.bind(globalThis);
// Los `type` no vienen siempre con la misma capitalización («poblacion», «Municipio»).
const excluido = (type) => EXCLUIDOS.includes(String(type ?? '').toLowerCase());

// «Rascafría, Rascafría» → «Rascafría»: lo que va antes de la primera coma; y se quita un « (<municipio>)» final
// que repite el municipio («Refugio de la Morcuera (Rascafría)» → «Refugio de la Morcuera»), pero no otros paréntesis («(Paraje)»).
const textoDe = (c) => {
  const t = String(c.address ?? '').split(',')[0].trim();
  const m = /^(.*\S)\s*\(([^()]*)\)$/.exec(t);
  return m && c.muni && normalizar(m[2]) === normalizar(c.muni) ? m[1] : t;
};
const subDe = (c) => [c.muni, c.province].filter(Boolean).join(', ');

export async function candidatosCartoCiudad(texto, { fetchFn = predeterminado(), limite = 8, senal } = {}) {
  const url = `${URL_CANDIDATOS}?${new URLSearchParams({ q: texto, limit: String(limite), no_process: EXCLUIDOS.join(',') })}`;
  const r = await fetchFn(url, { signal: senal });
  if (!r.ok) throw new Error(`CartoCiudad respondió ${r.status}`);
  const lista = await r.json();
  return (Array.isArray(lista) ? lista : []).filter((c) => !excluido(c.type) && c.address)
    .map((c) => ({ tipo: 'lugar', texto: textoDe(c), sub: subDe(c), id: c.id, type: c.type }));
}

const valido = (n) => typeof n === 'number' && Number.isFinite(n) && n !== 0;
export async function coordenadasCartoCiudad({ id, type }, { fetchFn = predeterminado() } = {}) {
  const r = await fetchFn(`${URL_FIND}?${new URLSearchParams({ id, type })}`);
  if (!r.ok) throw new Error(`CartoCiudad respondió ${r.status}`);
  const d = await r.json();
  if (valido(d?.lat) && valido(d?.lng)) return { lat: d.lat, lon: d.lng };
  // Primer vértice del WKT: «MULTILINESTRING((lon lat,lon lat…))».
  const m = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/.exec(String(d?.geom ?? ''));
  if (m) return { lat: Number(m[2]), lon: Number(m[1]) };
  throw new Error('Sin coordenadas');
}

// Sugerencias con espera, una sola petición en vuelo y caché; solo se entrega la respuesta del último texto pedido.
export function crearGeocodificador({ fetchFn = predeterminado(), retardo = RETARDO_MS, minimo = MINIMO_LETRAS } = {}) {
  const cache = new Map();
  let temporizador = null, control = null, ultimo = null;
  const guardar = (clave, lista) => { cache.set(clave, lista); if (cache.size > TOPE_CACHE) cache.delete(cache.keys().next().value); };
  async function pedir(texto, clave, alLlegar) {
    control = new AbortController();
    const { signal } = control;
    try {
      const lista = await candidatosCartoCiudad(texto, { fetchFn, senal: signal });
      guardar(clave, lista);
      if (ultimo === clave) alLlegar(lista);
    } catch {
      if (ultimo === clave && !signal.aborted) alLlegar([]);
    }
  }
  return {
    sugerir(texto, alLlegar) {
      clearTimeout(temporizador);
      control?.abort();
      const limpio = String(texto ?? '').trim(), clave = normalizar(limpio);
      ultimo = clave;
      if (clave.length < minimo) { alLlegar([]); return; }
      if (cache.has(clave)) { alLlegar(cache.get(clave)); return; }
      temporizador = setTimeout(() => pedir(limpio, clave, alLlegar), retardo);
    },
  };
}

// Locales primero; de los externos, solo los que no repiten texto (sin tildes ni mayúsculas).
export function mezclarResultados(locales, externos, max = 8) {
  const vistos = new Set(locales.map((x) => normalizar(x.texto)));
  const nuevos = [];
  for (const x of externos) { const k = normalizar(x.texto); if (vistos.has(k)) continue; vistos.add(k); nuevos.push(x); }
  return [...locales, ...nuevos].slice(0, max);
}

export const fueraDeZonas = (lat, lon, zonas) => !zonas.some(({ bbox: [o, s, e, n] }) => lon >= o && lon <= e && lat >= s && lat <= n);

export function zonasMasCercanas(lat, lon, zonas, n = 3) {
  const k = Math.cos(lat * Math.PI / 180);
  const dist = ({ bbox: [o, s, e, no] }) => Math.hypot(((o + e) / 2 - lon) * k, (s + no) / 2 - lat);
  return [...zonas].sort((a, b) => dist(a) - dist(b)).slice(0, n);
}

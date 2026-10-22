// Rutas del mapa y de Zona por hash. Puro (sin DOM) para poder probarlo con Node.
export const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const partes = (hash, nombre) => {
  const [n, a, b] = String(hash ?? '').replace(/^#/, '').split('/');
  return n === nombre ? { zona: a ? dec(a) : null, punto: a && b ? dec(b) : null } : { zona: null, punto: null };
};

export const leerRutaMapa = (hash) => partes(hash, 'mapa');
export const leerRutaZona = (hash) => partes(hash, 'zona');

export function rutaMapa({ zona = null, punto = null } = {}) {
  if (!zona) return '#mapa';
  return `#mapa/${encodeURIComponent(zona)}${punto ? `/${encodeURIComponent(punto)}` : ''}`;
}
export const rutaZona = (zona, punto = null) => `#zona/${encodeURIComponent(zona)}${punto ? `/${encodeURIComponent(punto)}` : ''}`;
// ¿Abre esta ruta la pantalla del mapa? Sin hash (portada), #mapa… y el antiguo #hoy.
export function esRutaMapa(hash) {
  const n = (String(hash ?? '').replace(/^#/, '') || 'mapa').split('/')[0];
  return n === 'mapa' || n === 'hoy';
}

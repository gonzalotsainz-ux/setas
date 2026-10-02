// Lógica pura de la Edge Function (sin Deno ni red, se prueba desde Node): leer respuestas de AEMET con mensajes
// claros y elegir una copia buena y vieja de la caché cuando AEMET no responde.
export const CUARENTA_Y_OCHO_H = 48 * 3600e3;

// Lee el cuerpo de una respuesta de AEMET como JSON. Si no lo es (p. ej. la página HTML de un 503) lanza un error legible.
export function leerJsonAemet(status, texto) {
  const t = String(texto ?? '').trim();
  const html = t.startsWith('<');
  if (!(status >= 200 && status < 300) && (html || !t.startsWith('{'))) throw new Error(`AEMET no disponible (${status})`);
  try { return JSON.parse(t); } catch {
    throw new Error(html ? `AEMET no disponible (${status})` : `AEMET respondió algo que no es JSON (${status})`);
  }
}

// Una entrada de caché «buena»: con datos, sin __error y vacía no.
export function esBuena(d) {
  if (!d || typeof d !== 'object') return false;
  if ('__error' in d || '__viejo' in d) return false;
  return Array.isArray(d) ? d.length > 0 : Object.keys(d).length > 0;
}

const dentro = (f, desde, hasta) => f >= desde && f <= hasta;

// Recorta datos {estacion: {fecha: mm}} al rango; null si no queda ningún día.
export function recortar(datos, desde, hasta) {
  const out = {}; let n = 0;
  for (const [est, dias] of Object.entries(datos)) {
    const d = {};
    for (const [f, v] of Object.entries(dias ?? {})) if (dentro(f, desde, hasta)) { d[f] = v; n++; }
    out[est] = d;
  }
  return n ? out : null;
}

// Elige la copia vieja. `entradas`: [{clave, datos, creado}] de la caché. Primero la misma clave; si no, la entrada buena
// más reciente de las MISMAS estaciones (clave `est|desde|hasta`) recortada al rango pedido. Máximo 48 h.
// Devuelve { datos, creado } o null.
export function elegirViejo(entradas, { estaciones, desde, hasta, ahora = Date.now(), maxEdad = CUARENTA_Y_OCHO_H }) {
  const clave = `${estaciones.join(',')}|${desde}|${hasta}`;
  const validas = (entradas ?? []).filter((e) => e && esBuena(e.datos) && ahora - Date.parse(e.creado) <= maxEdad)
    .sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado));
  const misma = validas.find((e) => e.clave === clave);
  if (misma) return { datos: misma.datos, creado: misma.creado };
  for (const e of validas) {
    const p = e.clave.split('|');
    if (p.length !== 3 || p[0] !== estaciones.join(',')) continue;
    const r = recortar(e.datos, desde, hasta);
    if (r) return { datos: r, creado: e.creado };
  }
  return null;
}

// Marca los datos como viejos sin romper a los clientes: la clave __viejo no es una estación.
export const marcarViejo = (datos, creado) => (Array.isArray(datos) ? datos : { ...datos, __viejo: { creado } });

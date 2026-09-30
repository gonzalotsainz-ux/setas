// Diario compartido: salidas en Supabase, con cola de borradores local para no perder nada sin red.
// Sin login: el autor es solo un nombre elegido en el dispositivo (js/supabase.js).
import { indiceZona } from './indice.js';
import { especiesDeZona } from './datos.js';

const CLAVE = 'setas:borradores';
const BUCKET = 'fotos';
// Campos que solo existen en el móvil y no deben viajar a la tabla `salidas`.
const LOCALES = ['id', 'fotos', 'remotoId', 'fotosSubidas'];

function almacenPorDefecto() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

// Cola persistente y a prueba de fallos del almacén: si localStorage no va (lleno, bloqueado), sigue en memoria
// y `persistente` pasa a false para que la pantalla avise.
export function colaBorradores(almacen = almacenPorDefecto()) {
  let memoria = [], persistente = true;
  const leer = () => {
    try { memoria = JSON.parse(almacen.getItem(CLAVE) ?? '[]'); } catch { persistente = false; }
    return memoria;
  };
  const escribir = (l) => { memoria = l; try { almacen.setItem(CLAVE, JSON.stringify(l)); } catch { persistente = false; } };
  leer();
  return {
    get persistente() { return persistente; },
    todos: () => (persistente ? leer() : memoria),
    anadir: (b) => escribir([...(persistente ? leer() : memoria).filter((x) => x.id !== b.id), b]),
    quitar: (id) => escribir((persistente ? leer() : memoria).filter((x) => x.id !== id)),
  };
}

// Una sola sincronización a la vez por cola: la carga, `online` y `visibilitychange` pueden coincidir y,
// sin este cerrojo, subirían dos veces el mismo borrador.
const enCurso = new WeakMap();
export function sincronizar({ cola, subir }) {
  if (enCurso.has(cola)) return enCurso.get(cola);
  const p = (async () => {
    let subidas = 0, fallidas = 0;
    for (const b of cola.todos()) {
      try { await subir(b); cola.quitar(b.id); subidas++; } catch { fallidas++; }   // sin red o 5xx: el borrador se queda
    }
    return { subidas, fallidas };
  })().finally(() => enCurso.delete(cola));
  enCurso.set(cola, p);
  return p;
}

// Idempotente: tras el insert guarda `remotoId` en el borrador (vía `persistir`) y, si ya existe, no vuelve a
// insertar; las fotos ya subidas (`fotosSubidas`) tampoco se repiten.
export async function crearSalida(b, { supabase, persistir }) {
  const marcar = (cambios) => { Object.assign(b, cambios); persistir?.(b); };
  if (!b.remotoId) {
    const fila = Object.fromEntries(Object.entries(b).filter(([k]) => !LOCALES.includes(k)));
    const { data, error } = await supabase.from('salidas').insert(fila).select('id').single();
    if (error) throw error;
    marcar({ remotoId: data.id });
  }
  const fotos = b.fotos ?? [];
  for (let k = b.fotosSubidas ?? 0; k < fotos.length; k++) {
    const f = fotos[k];
    const ruta = `${b.remotoId}/${k + 1}.jpg`;
    const blob = await (await fetch(f.dataUrl)).blob();
    const up = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw up.error;
    const ins = await supabase.from('fotos').insert({ salida_id: b.remotoId, ruta, ancho: f.ancho, alto: f.alto });
    if (ins.error) throw ins.error;
    marcar({ fotosSubidas: k + 1 });
  }
  return b.remotoId;
}

export async function listarSalidas({ supabase }) {
  const { data, error } = await supabase.from('salidas').select('*, fotos(ruta, ancho, alto)').order('fecha', { ascending: false });
  if (error) throw error;
  return data;
}

// `on delete cascade` solo borra filas: los objetos de Storage hay que quitarlos aparte, y antes que la fila
// (si fallase a medias, la salida sigue ahí y se puede reintentar). Incluye objetos huérfanos de la carpeta.
export async function borrarSalida(id, { supabase }) {
  const almacen = supabase.storage.from(BUCKET);
  const filas = await supabase.from('fotos').select('ruta').eq('salida_id', id);
  if (filas.error) throw filas.error;
  const carpeta = await almacen.list(id);
  if (carpeta.error) throw carpeta.error;
  const rutas = [...new Set([...(filas.data ?? []).map((f) => f.ruta), ...(carpeta.data ?? []).map((o) => `${id}/${o.name}`)])];
  if (rutas.length) {
    const r = await almacen.remove(rutas);
    if (r.error) throw r.error;
  }
  const { error } = await supabase.from('salidas').delete().eq('id', id);
  if (error) throw error;
}

export const urlFoto = (ruta, { supabase }) => supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;

export const totalKg = (especies) => (especies ?? []).reduce((t, e) => {
  const n = Number(String(e?.kg ?? '').replace(',', '.'));
  return t + (Number.isFinite(n) ? n : 0);
}, 0);

// Reduce calidad y, si hace falta, tamaño hasta que la foto quepa en el límite (el bucket admite 2 MB).
// `codificar({ lado, calidad })` devuelve un resultado con `size`.
export async function ajustarATamano(codificar, { max = 1600, calidad = 0.8, limite = 1_900_000 } = {}) {
  let r = await codificar({ lado: max, calidad });
  for (const q of [0.65, 0.5]) { if (r.size <= limite) return r; r = await codificar({ lado: max, calidad: q }); }
  let lado = max;
  for (let i = 0; i < 8 && r.size > limite; i++) { lado = Math.round(lado * 0.8); r = await codificar({ lado, calidad: 0.6 }); }
  if (r.size > limite) throw new Error('La foto es demasiado grande incluso reducida.');
  return r;
}

// Serie de un punto recortada a los últimos 30 días y los próximos 3 (foto fija para el diario).
export function recortarSerie(serie, antes = 30, despues = 3) {
  const n = serie.fechas.length;
  const a = Math.max(0, serie.hoy - antes), z = Math.min(n, serie.hoy + despues + 1);
  const r = { hoy: serie.hoy - a };
  for (const [k, v] of Object.entries(serie)) if (Array.isArray(v) && v.length === n) r[k] = v.slice(a, z);
  return r;
}

export function puntoMasCercano(zona, lat, lon) {
  const ps = zona?.puntos ?? [];
  if (!ps.length) return null;
  if (lat == null || lon == null) return ps[0];
  const d = (p) => (p.lat - lat) ** 2 + ((p.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
  return ps.reduce((m, p) => (d(p) < d(m) ? p : m));
}

// Meteo e índice de ese día para guardarlos junto a la salida: del punto de la zona más cercano al sitio.
export function fotoFijaDelDia({ zona, lat, lon, datos, meteo, umbrales = {} }) {
  const punto = puntoMasCercano(zona, lat, lon);
  const serie = punto && meteo?.series?.[punto.id];
  if (!serie) return { meteo: null, indice: null };
  const res = indiceZona({ [punto.id]: serie }, serie.hoy, especiesDeZona(zona, datos.especies, umbrales));
  return {
    meteo: { punto: punto.id, serie: recortarSerie(serie) },
    indice: { punto: punto.id, valor: res.valor, etiqueta: res.etiqueta, especies: res.especies.slice(0, 3).map((e) => ({ id: e.id, valor: e.valor })) },
  };
}

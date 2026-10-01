// Diario compartido: salidas en Supabase, con cola de borradores local para no perder nada sin red.
// Sin login: el autor es solo un nombre elegido en el dispositivo (js/supabase.js).
import { indiceZona, HISTORIA_MINIMA } from './indice.js';
import { especiesDeZona } from './datos.js';

const CLAVE = 'setas:borradores';
const BUCKET = 'fotos';
// Columnas de `salidas` que viajan desde el borrador; lo demás (fotos, remotoId, ultimoError…) es solo del móvil.
const COLUMNAS = ['fecha', 'zona_id', 'lat', 'lon', 'especies', 'notas', 'meteo', 'indice', 'autor'];

function almacenPorDefecto() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

// Cola de borradores en localStorage (solo metadatos; las fotos van a IndexedDB, ver prepararFotosBorrador).
// A prueba de fallos del almacén: `persistente` es el resultado de la ÚLTIMA escritura, así que se recupera solo
// en cuanto una escritura vuelve a funcionar. Mientras la última escritura falló, la verdad es la memoria
// (el almacén tendría datos viejos que podrían resucitar). JSON corrupto no fija nada: se sigue con la memoria.
export function colaBorradores(almacen = almacenPorDefecto()) {
  let memoria = [], persistente = true;
  const leerAlmacen = () => {
    try { const v = JSON.parse(almacen.getItem(CLAVE) ?? '[]'); return Array.isArray(v) ? v : null; } catch { return null; }
  };
  const actual = () => {
    if (!persistente) return memoria;
    const l = leerAlmacen();
    if (l) memoria = l;
    return memoria;
  };
  const escribir = (l) => {
    memoria = l;
    try { almacen.setItem(CLAVE, JSON.stringify(l)); persistente = true; } catch { persistente = false; }
    return persistente;
  };
  memoria = leerAlmacen() ?? [];
  return {
    get persistente() { return persistente; },
    todos: () => actual(),
    // devuelve si quedó guardado en el almacén (false = solo en memoria: hay que avisar)
    anadir: (b) => escribir([...actual().filter((x) => x.id !== b.id), b]),
    // solo reemplaza un borrador que sigue en la cola (otra pestaña pudo subirlo y quitarlo ya)
    actualizar: (b) => { const l = actual(); return l.some((x) => x.id === b.id) ? escribir(l.map((x) => (x.id === b.id ? b : x))) : persistente; },
    quitar: (id) => escribir(actual().filter((x) => x.id !== id)),
  };
}

export const nuevaId = () => globalThis.crypto?.randomUUID?.()
  ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });

// Guarda las fotos de un borrador fuera de localStorage: en IndexedDB (clave `<idBorrador>/<n>`) si hay almacén;
// si no, como dataUrl dentro del borrador con un presupuesto total (~3 MB) para no reventar la cuota.
// Devuelve los metadatos que van en el borrador. Las fotos de entrada son { blob, dataUrl, ancho, alto }.
export const PRESUPUESTO = 3_000_000;
export async function prepararFotosBorrador(id, fotos, { almacen = null, presupuesto = PRESUPUESTO } = {}) {
  if (almacen && await almacen.disponible().catch(() => false)) {
    const puestas = [];
    try {
      for (const [k, f] of fotos.entries()) { const clave = `${id}/${k + 1}`; await almacen.put(clave, f.blob); puestas.push(clave); }
      return { fotos: fotos.map((f, k) => ({ clave: `${id}/${k + 1}`, ancho: f.ancho, alto: f.alto })), enAlmacen: true };
    } catch { await Promise.all(puestas.map((c) => almacen.borrar(c).catch(() => {}))); }
  }
  const total = fotos.reduce((t, f) => t + f.dataUrl.length, 0);
  if (total > presupuesto) throw new Error('Las fotos no caben en la memoria de este dispositivo: quita alguna.');
  return { fotos: fotos.map((f) => ({ dataUrl: f.dataUrl, ancho: f.ancho, alto: f.alto })), enAlmacen: false };
}
export const cabeEnPresupuesto = (fotos, nueva, presupuesto = PRESUPUESTO) => fotos.reduce((t, f) => t + f.dataUrl.length, 0) + nueva.dataUrl.length <= presupuesto;

// Una sola sincronización a la vez: por cola (la carga, `online` y `visibilitychange` coinciden) y entre
// pestañas (Web Locks, si hay). Un borrador añadido mientras se sube se sube en la misma tanda, y una llamada
// que llega durante una tanda espera a que acabe y vuelve a mirar.
const enCurso = new WeakMap();
export function sincronizar({ cola, subir }) {
  if (enCurso.has(cola)) return enCurso.get(cola).then(() => sincronizar({ cola, subir }));
  const trabajo = async () => {
    let subidas = 0, fallidas = 0;
    const vistos = new Set();
    for (;;) {
      const pendientes = cola.todos().filter((b) => !vistos.has(b.id));
      if (!pendientes.length) break;
      for (const b of pendientes) {
        vistos.add(b.id);
        try { await subir(b); cola.quitar(b.id); subidas++; } catch (e) {   // sin red o 5xx: el borrador se queda
          fallidas++;
          cola.actualizar?.({ ...b, ultimoError: String(e?.message ?? e).slice(0, 200) });
        }
      }
    }
    return { subidas, fallidas };
  };
  const locks = globalThis.navigator?.locks;
  const p = (locks?.request ? locks.request('setas-sync', trabajo) : trabajo()).finally(() => enCurso.delete(cola));
  enCurso.set(cola, p);
  return p;
}

// Idempotente de verdad: el `id` del borrador (uuid) es la clave primaria de la salida y el alta ignora duplicados,
// así que una respuesta perdida no crea una segunda salida. Tras el alta guarda `remotoId` (vía `persistir`) y las
// fotos ya subidas (`fotosSubidas`) no se repiten; la fila de `fotos` se comprueba antes de insertarla.
export async function crearSalida(b, { supabase, persistir, almacenFotos = null }) {
  const marcar = (cambios) => { Object.assign(b, cambios); persistir?.(b); };
  if (!b.remotoId) {
    const fila = Object.fromEntries(Object.entries(b).filter(([k]) => COLUMNAS.includes(k)));
    const { error } = await supabase.from('salidas').upsert({ ...fila, id: b.id }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
    marcar({ remotoId: b.id });
  }
  const fotos = b.fotos ?? [];
  if (fotos.length && (b.fotosSubidas ?? 0) < fotos.length) {
    const previas = await supabase.from('fotos').select('ruta').eq('salida_id', b.remotoId);
    if (previas.error) throw previas.error;
    const hechas = new Set((previas.data ?? []).map((f) => f.ruta));
    for (let k = b.fotosSubidas ?? 0; k < fotos.length; k++) {
      const f = fotos[k];
      const ruta = `${b.remotoId}/${k + 1}.jpg`;
      let blob;
      if (f.clave) {
        blob = await almacenFotos?.get(f.clave);
        if (!blob) throw new Error('Falta una foto guardada en el móvil');
      } else blob = await (await fetch(f.dataUrl)).blob();
      const up = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      if (!hechas.has(ruta)) {
        const ins = await supabase.from('fotos').insert({ salida_id: b.remotoId, ruta, ancho: f.ancho, alto: f.alto });
        if (ins.error) throw ins.error;
      }
      marcar({ fotosSubidas: k + 1 });
    }
  }
  for (const f of fotos) if (f.clave) await almacenFotos?.borrar(f.clave).catch(() => {});
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

export const totalKg = (especies) => (Array.isArray(especies) ? especies : []).reduce((t, e) => {
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

// Serie de un punto recortada a los 30 días anteriores y los 3 siguientes a `centro` (por defecto, hoy): foto fija
// para el diario. En el recorte, `hoy` es la posición de `centro` (el día de la salida).
export function recortarSerie(serie, antes = 30, despues = 3, centro = serie.hoy) {
  const n = serie.fechas.length;
  const a = Math.max(0, centro - antes), z = Math.min(n, centro + despues + 1);
  const r = { hoy: centro - a };
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

// Meteo e índice del DÍA DE LA SALIDA (`fecha`, AAAA-MM-DD; por defecto, hoy) para guardarlos junto a ella: del punto
// de la zona más cercano al sitio. Si ese día no está en la serie o le faltan los 30 días de historia, no se guarda nada.
export function fotoFijaDelDia({ zona, lat, lon, fecha, datos, meteo, umbrales = {} }) {
  const nada = { meteo: null, indice: null };
  const punto = puntoMasCercano(zona, lat, lon);
  const serie = punto && meteo?.series?.[punto.id];
  if (!serie) return nada;
  const j = fecha ? serie.fechas.indexOf(fecha) : serie.hoy;
  if (j === -1 || j < HISTORIA_MINIMA - 1) return nada;
  const res = indiceZona({ [punto.id]: serie }, j, especiesDeZona(zona, datos.especies, umbrales));
  return {
    meteo: { punto: punto.id, serie: recortarSerie(serie, 30, 3, j) },
    indice: { punto: punto.id, fecha: serie.fechas[j], valor: res.valor, etiqueta: res.etiqueta, especies: res.especies.slice(0, 3).map((e) => ({ id: e.id, valor: e.valor })),
      ...(res.fueraDeTemporada ? { fueraDeTemporada: true } : {}), ...(res.incompleta ? { faltan: res.faltan } : {}) },
  };
}

// «Guardar en el diario» desde el mapa: #diario/nueva?lat=…&lon=…&zona=… abre la hoja «Nueva salida» rellena.
export const urlNuevaSalida = ({ lat, lon, zona }) => `#diario/nueva?${new URLSearchParams({
  ...(Number.isFinite(lat) && Number.isFinite(lon) ? { lat: lat.toFixed(5), lon: lon.toFixed(5) } : {}), ...(zona ? { zona } : {}) })}`;
export function leerNuevaSalida(param) {
  if (typeof param !== 'string' || !(param === 'nueva' || param.startsWith('nueva?'))) return null;
  const q = new URLSearchParams(param.slice('nueva?'.length));
  const zona = q.get('zona') || null;
  if (!q.has('lat') && !q.has('lon')) return { lat: null, lon: null, zona };
  // Las dos, en decimal (nada de «0x10», «1e2» ni vacías) y dentro de rango; si no, no se rellena nada.
  const decimal = /^-?\d+(\.\d+)?$/;
  const tLat = q.get('lat'), tLon = q.get('lon');
  if (!decimal.test(tLat ?? '') || !decimal.test(tLon ?? '')) return null;
  const lat = Number(tLat), lon = Number(tLon);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, zona };
}

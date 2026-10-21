// js/mapa/seleccion.js
// Lo que decide la selección del mapa (spec §4, decisión 13), sin DOM ni Leaflet: qué zona y qué monte nombra la ruta,
// cómo se encuadra, las migas y las filas de zonas del día. La pantalla (js/pantallas/mapa.js) solo lo aplica.
import { nombreCorto } from '../datos.js';
import { calcularZona, ordenarZonas } from '../notas-zona.js';
import { rutaMapa } from './ruta.js';

export const ZOOM_MONTE = 13;   // vista cercana de un monte (nivel 3)
export const MOTIVO_FUERA_DE_PREVISION = 'Esa fecha queda fuera de la previsión. No se calcula nota.';

export const limitesZona = (z) => [[z.bbox[1], z.bbox[0]], [z.bbox[3], z.bbox[2]]];

// ruta = leerRutaMapa(hash). Un punto que no es de esa zona se ignora; una zona desconocida es «nada».
export function resolverSeleccion(ruta, zonas) {
  const zona = (ruta?.zona && zonas.find((z) => z.id === ruta.zona)) || null;
  const punto = (zona && ruta.punto && zona.puntos.find((p) => p.id === ruta.punto)) || null;
  return { zona, punto };
}
export const claveSeleccion = ({ zona, punto }) => [zona?.id, punto?.id].filter(Boolean).join('/');

// Zona: su bbox (aunque tenga un solo monte, nunca un punto); monte: vista cercana; nada: no se mueve.
export function encuadreDe({ zona, punto }) {
  if (punto) return { tipo: 'punto', centro: [punto.lat, punto.lon], zoom: ZOOM_MONTE };
  if (zona) return { tipo: 'zona', limites: limitesZona(zona) };
  return null;
}

export const rutaSubir = ({ zona, punto }) => rutaMapa({ zona: punto ? zona.id : null });

// «‹» sube un nivel (zona → todas; monte → su zona); luego la zona y, si lo hay, el monte.
export function migasDe({ zona, punto }) {
  if (!zona) return [];
  const migas = [{ texto: '‹', href: rutaSubir({ zona, punto }), aria: punto ? `Volver a ${nombreCorto(zona)}` : 'Volver a todas las zonas' },
    { texto: nombreCorto(zona), href: rutaMapa({ zona: zona.id }) }];
  if (punto) migas.push({ texto: punto.corto ?? punto.nombre, href: rutaMapa({ zona: zona.id, punto: punto.id }) });
  return migas;
}

// vista = [oeste, sur, este, norte]
export const zonasQueCortan = (zonas, [o, s, e, n]) => zonas.filter(({ bbox: [zo, zs, ze, zn] }) => zo <= e && ze >= o && zs <= n && zn >= s);

const filaSinDatos = (zona, motivo) => ({ zona, res: { valor: null, fueraDeTemporada: false, incompleta: false, faltan: [], especies: [] }, mejor: null, incierta: false, motivo });

// Filas de todas las zonas para el desplazamiento d (desplazamientoDia), ordenadas de mejor a peor. Con d null la fecha
// cae fuera de la meteo: «sin datos», nunca la nota de otro día (decisión 14). Sin meteo, calcularZona ya da «sin datos».
export function filasZonas({ datos, meteo, d, filtro, umbrales = {} }) {
  return ordenarZonas(datos.zonas.map((z) => (d == null && meteo?.series
    ? filaSinDatos(z, MOTIVO_FUERA_DE_PREVISION)
    : calcularZona(z, datos, meteo ?? {}, d ?? 0, filtro, umbrales))));
}

export function filtroDeChip(chips, id) {
  const c = chips.find((x) => x.id === id);
  return c?.especies ? new Set(c.especies) : null;
}

import { umbralEfectivo } from './umbrales.js';
// Carga del conocimiento investigado y utilidades de consulta.
let cache = null;
export async function cargarDatos() {
  if (cache) return cache;
  const [zonas, especies, normativa] = await Promise.all(['zonas', 'especies', 'normativa'].map((n) => fetch(`data/${n}.json`).then((r) => {
    if (!r.ok) throw new Error(`No se pudo cargar data/${n}.json (${r.status})`);
    return r.json();
  })));
  // Los sitios conocidos son un complemento: si no cargan, la app sigue y las secciones lo dicen (sitios: null).
  const sitios = await fetch('data/sitios.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const porId = Object.fromEntries(especies.especies.map((e) => [e.id, e]));
  cache = { zonas: zonas.zonas, especies: especies.especies, sindromes: especies.sindromes, normativa: normativa.normas, sitios: sitios?.sitios ?? null, porId };
  return cache;
}
export const puntosDe = (zonas) => zonas.flatMap((z) => z.puntos);
// Puntos NO IR (`noIr: true`): solo sirven para la meteo; nunca son el «mejor punto» de una zona.
export const puntosRecogibles = (zona) => zona.puntos.filter((p) => !p.noIr);
// Rótulo de un punto: NO IR en rojo; con `proteccion`, «Restricciones» en ocre; si no, nada.
export const rotuloPunto = (p) => (p?.noIr ? { texto: 'NO IR (solo meteo)', variante: 'peligro' }
  : p?.proteccion ? { texto: 'Restricciones', variante: 'ocre' } : null);
export function especiesDeZona(zona, especies, umbrales = {}) {
  return especies
    .filter((e) => e.categoria === 'comestible' && e.indice && e.zonas[zona.id] && e.zonas[zona.id].presencia !== 'sin-registros'
      && e.habitats.some((h) => zona.habitats.includes(h)))
    .map((e) => {
      const fila = umbrales?.[e.id];
      if (!fila) return e;
      const { efectivo: indice, filaMala, errores } = umbralEfectivo(e.indice, fila);   // RLS abierto: una fila a mano no puede romper el índice
      if (filaMala) { console.warn(`Umbral de ${e.id} ignorado: ${errores.join('; ')}`); return e; }
      return { ...e, indice };
    });
}
// «Soria (Pinar Grande, Tierras Altas)» → «Soria»: el nombre sin el paréntesis de detalle.
export const nombreCorto = (zona) => zona.nombre.replace(/\s*\([^)]*\)\s*$/, '');

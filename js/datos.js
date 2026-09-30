// Carga del conocimiento investigado y utilidades de consulta.
let cache = null;
export async function cargarDatos() {
  if (cache) return cache;
  const [zonas, especies, normativa] = await Promise.all(['zonas', 'especies', 'normativa'].map((n) => fetch(`data/${n}.json`).then((r) => {
    if (!r.ok) throw new Error(`No se pudo cargar data/${n}.json (${r.status})`);
    return r.json();
  })));
  const porId = Object.fromEntries(especies.especies.map((e) => [e.id, e]));
  cache = { zonas: zonas.zonas, especies: especies.especies, sindromes: especies.sindromes, normativa: normativa.normas, porId };
  return cache;
}
export const puntosDe = (zonas) => zonas.flatMap((z) => z.puntos);
export function especiesDeZona(zona, especies, umbrales = {}) {
  return especies
    .filter((e) => e.categoria === 'comestible' && e.indice && e.zonas[zona.id] && e.zonas[zona.id].presencia !== 'sin-registros'
      && e.habitats.some((h) => zona.habitats.includes(h)))
    .map((e) => (umbrales[e.id] ? { ...e, indice: { ...e.indice, ...umbrales[e.id] } } : e));
}
// «Soria (Pinar Grande, Tierras Altas)» → «Soria»: el nombre sin el paréntesis de detalle.
export const nombreCorto = (zona) => zona.nombre.replace(/\s*\([^)]*\)\s*$/, '');

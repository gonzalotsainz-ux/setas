// supabase/functions/pluvio/lectores/aemet.js
// AEMET OpenData, observación convencional (informe 09 §3.7): datos horarios SIN VALIDAR de las últimas 12 h de todas las
// estaciones; `prec` es la lluvia de los 60 minutos anteriores a `fint` (UTC). Dos llamadas, como la función «aemet», y
// la clave del secreto AEMET_API_KEY. Se filtra por la lista blanca.
export const URL_AEMET_TODAS = 'https://opendata.aemet.es/opendata/api/observacion/convencional/todas';

export function horaDeFint(t) {
  if (typeof t !== 'string') return null;
  const s = t.trim().replace(/\+0000$/, 'Z');
  const ms = Date.parse(/(Z|[+-]\d\d:\d\d)$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(ms) && ms % 3600e3 === 0 ? new Date(ms).toISOString() : null;
}
export function horasDeAemet(lista, codigos) {
  return (Array.isArray(lista) ? lista : []).flatMap((o) => {
    if (!codigos.has(o?.idema) || typeof o.prec !== 'number' || !Number.isFinite(o.prec)) return [];
    const hora = horaDeFint(o.fint);
    return hora ? [{ estacion: o.idema, hora, mm: o.prec }] : [];
  });
}
export async function leerAemet({ pedir, clave, estaciones }) {
  if (!clave) throw new Error('sin clave (falta el secreto AEMET_API_KEY)');
  const j1 = await pedir(URL_AEMET_TODAS, { cabeceras: { api_key: clave } });
  if (j1?.estado !== 200 || typeof j1.datos !== 'string') throw new Error(`AEMET ${j1?.estado}: ${j1?.descripcion ?? 'sin datos'}`);
  const lista = JSON.parse(new TextDecoder('iso-8859-15').decode(await pedir(j1.datos, { como: 'bytes' })));
  if (!Array.isArray(lista)) throw new Error('AEMET: los datos no son una lista de observaciones');
  return { filas: horasDeAemet(lista, new Set(estaciones.map((e) => e.codigo))), errores: [], agotado: false };
}

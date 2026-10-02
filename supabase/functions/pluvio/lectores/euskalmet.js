// supabase/functions/pluvio/lectores/euskalmet.js
// Euskalmet / Open Data Euskadi (CC BY 4.0; informe 09 §3.6). El histórico anual (zip con un zip por estación y un XML por
// mes) trae lecturas cada 10 minutos en UTC: comprobado con el ciclo diario de temperatura de Beluntza en agosto (mínima
// a las 05 y máxima a las 13 y 14). Cada lectura se toma como los 10 minutos que ACABAN a su hora; una hora vale si tiene
// sus 6 lecturas válidas. La API en tiempo real pide un JWT firmado con la clave privada de la usuaria (registro pendiente):
// cuando la haya, será otra tarea de «pluvio» que entregue lecturas a horasDeLecturas (docs/supabase.md).
export const URL_ESTACIONES_EUSKALMET = 'https://opendata.euskadi.eus/contenidos/ds_meteorologicos/estaciones_meteorologicas/opendata/estaciones.json';
export const urlZipEuskalmet = (anio) => `https://opendata.euskadi.eus/contenidos/ds_meteorologicos/met_stations_ds_${anio}/opendata/${anio}.zip`;
const r1 = (x) => Math.round(x * 10) / 10;

export function lecturasDeXml(xml) {
  const lecturas = [];
  for (const d of xml.matchAll(/<dia Dia="(\d{4})-(\d{1,2})-(\d{1,2})">([\s\S]*?)<\/dia>/g)) {
    const fecha = `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
    for (const h of d[4].matchAll(/<hora Hora="(\d\d):(\d\d)">([\s\S]*?)<\/hora>/g)) {
      const v = Number(h[3].match(/<Precip[^>]*>([^<]*)</)?.[1] ?? NaN);
      lecturas.push({ t: Date.parse(`${fecha}T${h[1]}:${h[2]}:00Z`), mm: Number.isFinite(v) && v >= 0 ? v : null });
    }
  }
  return lecturas;
}
export function horasDeLecturas(lecturas, codigo) {
  const horas = new Map();
  for (const l of lecturas) {
    const fin = Math.ceil(l.t / 3600e3) * 3600e3;
    const h = horas.get(fin) ?? { n: 0, mm: 0, mala: false };
    if (l.mm == null) h.mala = true; else { h.n++; h.mm += l.mm; }
    horas.set(fin, h);
  }
  return [...horas].sort((a, b) => a[0] - b[0]).filter(([, h]) => h.n === 6 && !h.mala)
    .map(([fin, h]) => ({ estacion: codigo, hora: new Date(fin).toISOString(), mm: r1(h.mm) }));
}
export const horasDeXmlEuskalmet = (xml, codigo) => horasDeLecturas(lecturasDeXml(xml), codigo);
export const estacionesDeEuskalmet = (lista) => (Array.isArray(lista) ? lista : []).filter((e) => (e.Tipo === 'KM' || e.Tipo === 'KA') && !e.Fechabaja)
  .map((e) => ({ codigo: e.Codigo, nombre: e.Nombre, lat: Number(e.LATWGS84), lon: Number(e.LONWGS84), xmlDatos: e.XMLdatos }));
export function altitudDeXmlDatos(xml) {
  const m = xml.match(/<altitude>([\d.]+)<\/altitude>/);
  return m ? Math.round(Number(m[1])) : null;
}

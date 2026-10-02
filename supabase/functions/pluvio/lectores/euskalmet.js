// supabase/functions/pluvio/lectores/euskalmet.js
// Euskalmet / Open Data Euskadi (CC BY 4.0; informe 09 §3.6). El histórico anual (zip con un zip por estación y un XML por
// mes) trae lecturas cada 10 minutos en UTC: comprobado con el ciclo diario de temperatura de Beluntza en agosto (mínima
// a las 04-05 y máxima a las 14-15 UTC; UTC es lo plausible, no está probado contra otra fuente). Cada lectura se toma como los 10 minutos que ACABAN a su hora; una hora vale si tiene
// sus 6 lecturas válidas. La API en tiempo real pide un JWT firmado con la clave privada de la usuaria (registro pendiente):
// cuando la haya, será otra tarea de «pluvio» que entregue lecturas a horasDeLecturas (docs/supabase.md).
export const URL_ESTACIONES_EUSKALMET = 'https://opendata.euskadi.eus/contenidos/ds_meteorologicos/estaciones_meteorologicas/opendata/estaciones.json';
export const urlZipEuskalmet = (anio) => `https://opendata.euskadi.eus/contenidos/ds_meteorologicos/met_stations_ds_${anio}/opendata/${anio}.zip`;
// Solo se quita el ruido de coma flotante (3 decimales); el redondeo a 0,1 mm lo hace agregarHoras al sumar el día.
const r3 = (x) => Math.round(x * 1000) / 1000;
const PRECIP = /<(Precip[^\s>\/]*)[^>]*?(?:\/>|>([^<]*)<\/\1>)/;   // el real es <Precip.._a_11cm>
const NUMERO = /^\d+(\.\d+)?$/;

export function lecturasDeXml(xml) {
  const lecturas = [];
  for (const d of xml.matchAll(/<dia Dia="(\d{4})-(\d{1,2})-(\d{1,2})">([\s\S]*?)<\/dia>/g)) {
    const fecha = `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
    for (const h of d[4].matchAll(/<hora Hora="(\d\d):(\d\d)">([\s\S]*?)<\/hora>/g)) {
      // Solo un número escrito tal cual vale: vacío, en blanco o <Precip/> es lectura inválida, no 0 mm.
      const texto = h[3].match(PRECIP)?.[2]?.trim();
      lecturas.push({ t: Date.parse(`${fecha}T${h[1]}:${h[2]}:00Z`), mm: texto !== undefined && NUMERO.test(texto) ? Number(texto) : null });
    }
  }
  return lecturas;
}
// Una hora vale si tiene las 6 ranuras :10…:00 (cada una una vez) con lectura válida; una ranura repetida con otro valor la anula.
export function horasDeLecturas(lecturas, codigo) {
  const horas = new Map();
  for (const l of lecturas) {
    if (!Number.isFinite(l.t) || l.t % 600e3 !== 0) continue;
    const fin = Math.ceil(l.t / 3600e3) * 3600e3;
    const h = horas.get(fin) ?? { ranuras: new Map(), mala: false };
    if (l.mm == null) h.mala = true;
    else if (h.ranuras.has(l.t) && h.ranuras.get(l.t) !== l.mm) h.mala = true;
    else h.ranuras.set(l.t, l.mm);
    horas.set(fin, h);
  }
  return [...horas].sort((a, b) => a[0] - b[0]).filter(([, h]) => h.ranuras.size === 6 && !h.mala)
    .map(([fin, h]) => ({ estacion: codigo, hora: new Date(fin).toISOString(), mm: r3([...h.ranuras.values()].reduce((x, y) => x + y, 0)) }));
}
export const horasDeXmlEuskalmet = (xml, codigo) => horasDeLecturas(lecturasDeXml(xml), codigo);
export const estacionesDeEuskalmet = (lista) => (Array.isArray(lista) ? lista : []).filter((e) => (e.Tipo === 'KM' || e.Tipo === 'KA') && !e.Fechabaja)
  .map((e) => ({ codigo: e.Codigo, nombre: e.Nombre, lat: Number(e.LATWGS84), lon: Number(e.LONWGS84), xmlDatos: e.XMLdatos }));
export function altitudDeXmlDatos(xml) {
  const m = xml.match(/<altitude>([\d.]+)<\/altitude>/);
  return m ? Math.round(Number(m[1])) : null;
}

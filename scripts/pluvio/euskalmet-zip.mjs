// scripts/pluvio/euskalmet-zip.mjs
// Del zip anual de Euskalmet (2026/Cxxx_2026.zip → Cxxx/Cxxx_2026_M.xml) a horas de lluvia de las estaciones pedidas.
import { entradasZip, leerEntrada } from './zip.mjs';
import { horasDeXmlEuskalmet } from '../../supabase/functions/pluvio/lectores/euskalmet.js';
import { fechaMadridDeFin } from '../../supabase/functions/pluvio/tiempo.js';

const latin1 = new TextDecoder('latin1');
// La entrada exterior de cada estación se llama siempre AAAA/CODIGO_AAAA.zip.
function xmlsDe(zip, externas, codigo) {
  const ent = [...externas].find(([n]) => new RegExp(`/${codigo}_\\d{4}\\.zip$`).test(n));
  if (!ent) return null;
  const interno = leerEntrada(zip, ent[1]);
  return [...entradasZip(interno)].filter(([n]) => /_\d{4}_\d{1,2}\.xml$/.test(n))
    .map(([n, e]) => ({ mes: Number(n.match(/_(\d{1,2})\.xml$/)[1]), xml: latin1.decode(leerEntrada(interno, e)) }));
}
export function filasDeZipEuskalmet(zip, estaciones, desde) {
  const externas = entradasZip(zip), filas = [], avisos = [];
  const mesDesde = Number(desde.slice(5, 7));
  for (const e of estaciones) {
    const xmls = xmlsDe(zip, externas, e.codigo);
    if (!xmls) { avisos.push(`${e.codigo}: no está en el zip`); continue; }
    for (const { mes, xml } of xmls) {
      if (mes < mesDesde) continue;
      filas.push(...horasDeXmlEuskalmet(xml, e.codigo).filter((h) => fechaMadridDeFin(h.hora) >= desde).map((h) => ({ fuente: 'euskalmet', ...h })));
    }
  }
  return { filas, avisos };
}
// Estaciones cuyo último mes del zip mide lluvia (algunas de la red son de calidad del aire o de aforo).
export function conLluviaEnZip(zip, codigos) {
  const externas = entradasZip(zip), r = new Set();
  for (const c of codigos) {
    const xmls = xmlsDe(zip, externas, c);
    if (xmls?.length && /<Precip/.test(xmls.sort((a, b) => a.mes - b.mes).at(-1).xml)) r.add(c);
  }
  return r;
}

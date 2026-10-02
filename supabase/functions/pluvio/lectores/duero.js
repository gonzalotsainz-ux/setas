// supabase/functions/pluvio/lectores/duero.js
// SAIH Duero (CHD), sin clave (informe 09 §3.1). La página de tiempo real (array JS `datosPL`) da código, nombre y
// coordenadas; la ficha de cada estación, la altitud (Z) y el enlace a su histórico, con un token por sensor; el histórico
// es una gráfica amCharts con unos 90 días de valores HORARIOS en hora de Madrid ({d:"02/07/2026 11:00", v:0.0}).
// La red no filtra los datos (picos de mantenimiento de 120 mm): los marca el control de calidad (tarea 8).
import { horaDeTexto, fechaMadridDeFin } from '../tiempo.js';
import { PlazoAgotado } from '../red.js';

export const BASE_DUERO = 'https://www.saihduero.es/';

export function estacionesDeRisr(html) {
  const ini = html.indexOf('datosPL = new Array(');
  if (ini === -1) throw new Error('SAIH Duero: la página de tiempo real no trae datosPL');
  const cuerpo = html.slice(ini, html.indexOf(');', ini));
  return [...cuerpo.matchAll(/\{\s*id:\s*'([A-Z]{2}\d{3})',\s*station:\s*'((?:[^'\\]|\\.)*)',[^}]*?lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)/g)]
    .map((m) => ({ codigo: m[1], nombre: m[2].replace(/\\'/g, "'"), lat: Number(m[3]), lon: Number(m[4]) }));
}
// En la ficha, la fila «Pluviometría» de la tabla de tiempo real enlaza su histórico (la de temperatura va antes).
export function historicoDeFicha(html, codigo) {
  return html.match(new RegExp(`<td>Pluviometr[^<]*</td>[\\s\\S]*?risr/${codigo}/historico/([A-Za-z0-9]+)`))?.[1] ?? null;
}
export function altitudDeFicha(html) {
  const z = html.match(/<strong>Z<\/strong>\s*<br>\s*<p class="text-muted">([\d.]+)<\/p>/)?.[1];
  return z ? Number(z.replace(/\./g, '')) : null;   // «1.445» → 1445
}
export const esHistoricoDeLluvia = (html) => /title: 'Pluviometr/.test(html) && html.includes('chartData');
// Dos filas de la misma hora local (la segunda 02:00 del 25/10) salen con la misma hora UTC: si una hora no avanza
// respecto a la anterior de la serie es la segunda y va una hora UTC más tarde (como en Tajo).
export function horasDeHistorico(html, codigo) {
  let previa = -Infinity;
  return [...html.matchAll(/\{d:"(\d\d\/\d\d\/\d{4} \d\d:\d\d)",\s*v:([^}]*)\}/g)].flatMap((m) => {
    let hora = horaDeTexto(m[1]);
    if (!hora) return [];
    if (Date.parse(hora) <= previa) hora = new Date(Date.parse(hora) + 3600e3).toISOString();
    previa = Date.parse(hora);
    const txt = m[2].trim();   // vacío o «null» no es 0 mm: es un hueco
    const v = txt === '' ? NaN : Number(txt);
    return [{ estacion: codigo, hora, mm: Number.isFinite(v) ? v : null }];
  });
}

const intento = async (f) => { try { return await f(); } catch (e) { if (e instanceof PlazoAgotado) throw e; return null; } };
const urlHistorico = (codigo, token) => `${BASE_DUERO}risr/${codigo}/historico/${token}`;

// Una petición por estación (dos si el token guardado ya no vale: la ficha y el histórico nuevo).
export async function leerDuero({ pedir, estaciones, desde }) {
  const filas = [], errores = [];
  const horasCon = async (codigo, token) => {
    const html = await intento(() => pedir(urlHistorico(codigo, token), { como: 'texto' }));
    return html && esHistoricoDeLluvia(html) ? horasDeHistorico(html, codigo) : [];
  };
  for (const e of estaciones) {
    try {
      let horas = e.token ? await horasCon(e.codigo, e.token) : [];
      if (!horas.length) {
        const token = historicoDeFicha(await pedir(`${BASE_DUERO}risr/${e.codigo}`, { como: 'texto' }), e.codigo);
        if (!token) throw new Error('sin histórico de lluvia en la ficha');
        if (token === e.token) throw new Error('sin histórico de lluvia');
        horas = await horasCon(e.codigo, token);
        if (!horas.length) throw new Error('sin histórico de lluvia');
        if (e.token) errores.push(`${e.codigo}: token renovado (${token})`);   // para actualizar estaciones.json
      }
      // Los huecos (mm null) no se guardan: no deben pisar un valor bueno ya registrado.
      filas.push(...horas.filter((h) => h.mm != null && fechaMadridDeFin(h.hora) >= desde));
    } catch (err) {
      if (err instanceof PlazoAgotado) return { filas, errores, agotado: true };
      errores.push(`${e.codigo}: ${err.message}`);
    }
  }
  return { filas, errores, agotado: false };
}

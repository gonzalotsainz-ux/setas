// js/mapa/hoja.js
// Ficha de una ladera (mancha) o de una zona prohibida tocada en el mapa: modeloHoja (datos puros, se prueba con Node) y
// pintarLadera, que la convierte en nodos para el popup de Leaflet (en rojo si es prohibida). El nombre viene de la hoja
// fija que tuvo el mapa; la ficha del monte es la pantalla Zona.
// `celda` = { habitat, altitud, orientacion, tramo, lat, lon, fueraProvincias? } (fueraProvincias = bit 0x20 del hábitat).
import { el, icono } from '../ui/dom.js';
import { semaforo, nivelDe } from '../ui/semaforo.js';
import { comun } from '../ui/ficha.js';
import { urlSegura } from '../ui/normativa.js';
import { ORIENTACIONES, TRAMOS_PENDIENTE } from '../rejilla/formato.js';
import { esOrientativo } from '../rejilla/orientacion.js';
import { urlNuevaSalida } from '../diario.js';
import { rutaZona } from './ruta.js';
import { textoFaltan } from '../notas-zona.js';
import { textoOrigenLluvia } from '../ui/origen-lluvia.js';

const nbsp = '\u00a0';   // espacio duro entre número y unidad (docs/diseno.md)
const r1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
export const NOMBRE_HABITAT = {
  'pinar-silvestre': 'Pinar silvestre', 'pinar-negral': 'Pinar negral', 'pinar-resinero': 'Pinar resinero', 'pinar-pinonero': 'Pinar piñonero',
  hayedo: 'Hayedo', melojar: 'Melojar (rebollar)', 'robledal-albar': 'Robledal', quejigar: 'Quejigar', castanar: 'Castañar', encinar: 'Encinar',
  alcornocal: 'Alcornocal', jaral: 'Jaral', sabinar: 'Sabinar', abedular: 'Abedular', chopera: 'Chopera', 'pastizal-montana': 'Pastizal de montaña', prado: 'Prado',
};
export const TEXTO_ORIENTACION = { llano: 'Llano', N: 'Norte (umbría)', NE: 'Noreste (umbría)', E: 'Este', SE: 'Sureste (solana)', S: 'Sur (solana)', SO: 'Suroeste (solana)', O: 'Oeste', NO: 'Noroeste (umbría)' };

// Monte de una provincia vecina (bit FUERA_PROVINCIAS): sus normas no están en la app.
export const AVISO_FUERA_PROVINCIAS = 'Fuera de las provincias de la zona: la app no conoce sus prohibiciones ni sus cotos. Compruébalos antes de recoger.';
// MFE 24/34: los prados suelen ser fincas de siega cerradas, no monte libre.
export const AVISO_PRADO = 'Prado: suele ser finca privada (prado de siega cerrado), no monte libre. Entra solo con permiso del dueño.';

export const urlComoLlegar = (lat, lon) => `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lon.toFixed(5)}`;

export function textoCoto(p) {
  if (!p) return { texto: 'Fuera de los cotos conocidos: comprueba la normativa de la zona.', url: null };
  if (p.tipo === 'acotado' || p.tipo === 'parque-micologico') return { texto: `${p.nombre}: pide permiso.`, url: urlSegura(p.permisoUrl) ? p.permisoUrl : null };
  return { texto: `${p.nombre}: recolección regulada, consulta la norma.`, url: null };
}

function avisosDe(celda, nota) {
  const avisos = [];
  if (celda.fueraProvincias) avisos.push({ texto: AVISO_FUERA_PROVINCIAS, peligro: true });
  if (celda.habitat === 'prado') avisos.push({ texto: AVISO_PRADO, peligro: true });
  const n = nota?.faltan?.length ?? 0;
  if (n) avisos.push({ texto: `${textoFaltan(n)}${nota.valor != null ? ': la nota sale solo con las demás' : ''}.`, peligro: false });
  return avisos;
}

export function modeloHoja({ prohibido = null, normas = new Map(), celda = null, nota = null, ag = null, coto = null, zona = null, lluvia = null }) {
  if (prohibido) {
    return { tipo: 'prohibido', titulo: prohibido.nombre ?? 'Zona prohibida', texto: prohibido.nota ?? 'Esta celda está dentro o en el borde de una zona prohibida: no recojas aquí.',
      normas: (prohibido.normas ?? []).map((id) => { const n = normas.get(id); return { titulo: n?.titulo ?? id, url: urlSegura(n?.url) ? n.url : null }; }) };
  }
  if (!celda || !NOMBRE_HABITAT[celda.habitat]) return null;   // sin hábitat conocido no hay hoja de monte
  const filas = [
    { etiqueta: 'Bosque', valor: NOMBRE_HABITAT[celda.habitat] },
    { etiqueta: 'Altitud', valor: `${celda.altitud}${nbsp}m` },
    { etiqueta: 'Orientación', valor: TEXTO_ORIENTACION[ORIENTACIONES[celda.orientacion]] ?? 'Llano' },
    { etiqueta: 'Pendiente', valor: TRAMOS_PENDIENTE[celda.tramo] ?? 'sin dato' },
  ];
  if (ag) {
    filas.push(
      { etiqueta: 'Lluvia en 26 días', valor: ag.P26 == null ? 'sin dato' : `${Math.round(ag.P26)}${nbsp}mm` },
      { etiqueta: 'Humedad del suelo', valor: ag.pct == null ? 'sin climatología' : `percentil ${Math.round(ag.pct)}` },
      { etiqueta: 'Temperatura', valor: ag.T20aire == null ? 'sin dato' : `${r1(ag.T20aire)}${nbsp}°C de media en 20 días` });
  }
  const base = { titulo: NOMBRE_HABITAT[celda.habitat], filas, coto: textoCoto(coto), orientativo: esOrientativo(celda.orientacion),
    avisos: avisosDe(celda, nota), origenLluvia: lluvia ? textoOrigenLluvia(lluvia) : null,
    acciones: { comoLlegar: urlComoLlegar(celda.lat, celda.lon), detalle: zona ? rutaZona(zona.id) : null, diario: urlNuevaSalida({ lat: celda.lat, lon: celda.lon, zona: zona?.id ?? null }) } };
  if (!nota || nota.valor == null) return { tipo: 'sinDatos', ...base, texto: 'Sin datos suficientes para este día.' };
  return { tipo: 'ladera', ...base, valor: nota.valor, nivel: nivelDe(nota.valor),
    especie: { id: nota.especie.id, nombre: comun(nota.especie), latin: nota.especie.nombre } };
}

const enlace = (href, texto, clase) => el('a', { clase, href, rel: 'noopener', target: '_blank', texto });
const avisoNodo = (texto, peligro) => el('div', { clase: peligro ? 'aviso-peligro' : 'aviso', attrs: { role: 'note' } }, icono(peligro ? 'i-aviso' : 'i-info'), el('p', { texto }));

const pintarProhibido = (m) => [el('div', { clase: 'aviso-peligro', attrs: { role: 'note' } }, icono('i-aviso'), el('p', {}, el('strong', { texto: 'Recogida de setas prohibida. ' }), m.texto)),
  m.normas.length ? el('ul', { clase: 'mapa-popup__normas' }, m.normas.map((n) => el('li', {}, n.url ? enlace(n.url, n.titulo) : n.titulo))) : null];

// Modelo de modeloHoja → nodos del popup (título incluido): nota y especie, avisos, bosque, altitud, orientación y meteo,
// coto y los botones «Cómo llegar», «Ver detalle» y «Guardar en el diario». La zona prohibida, solo el aviso y sus normas.
export function pintarLadera(m) {
  const titulo = el('h3', { texto: m.titulo });
  if (m.tipo === 'prohibido') return [titulo, ...pintarProhibido(m)].filter(Boolean);
  const nodos = [titulo, m.valor != null
    ? el('div', { clase: 'hoja__nota', attrs: { 'data-nivel': m.nivel } }, el('span', { clase: 'indice indice--grande tabular', texto: String(m.valor) }), semaforo(m.valor),
      el('p', {}, 'Por ', el('span', { clase: 'latin', texto: m.especie.latin }), ` (${m.especie.nombre})`))
    : el('p', { clase: 'texto-2', texto: m.texto })];
  nodos.push(...m.avisos.map((a) => avisoNodo(a.texto, a.peligro)));
  if (m.orientativo) nodos.push(el('p', { clase: 'texto-s' }, el('span', { clase: 'etiqueta etiqueta--ocre', texto: 'Orientativo' }), ' La orientación ajusta la humedad sin calibración local.'));
  nodos.push(el('dl', { clase: 'hoja__filas' }, m.filas.flatMap((f) => [el('dt', { texto: f.etiqueta }), el('dd', { texto: f.valor })])),
    m.origenLluvia ? el('p', { clase: 'texto-2 texto-s', texto: m.origenLluvia }) : null,
    el('p', { clase: 'texto-s' }, m.coto.url ? enlace(m.coto.url, m.coto.texto) : m.coto.texto),
    el('div', { clase: 'hoja__acciones' }, enlace(m.acciones.comoLlegar, 'Cómo llegar', 'boton boton--compacto'),
      m.acciones.detalle ? el('a', { clase: 'boton boton--suave boton--compacto', href: m.acciones.detalle, texto: 'Ver detalle' }) : null,
      el('a', { clase: 'boton boton--suave boton--compacto', href: m.acciones.diario, texto: 'Guardar en el diario' })));
  return nodos.filter(Boolean);
}

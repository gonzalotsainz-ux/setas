// js/mapa/hoja.js
// Hoja inferior del mapa al tocar una mancha (spec §2): bosque, altitud, orientación, nota y especie, meteo, coto y
// tres botones; arrastrada hacia arriba, el desglose, las otras especies y la gráfica de lluvia. Zona prohibida: roja,
// con la norma y nunca mancha. No es modal (el mapa sigue usable): mueve el foco al título y lo devuelve al cerrar.
// `celda` = { habitat, altitud, orientacion, tramo, lat, lon, fueraProvincias? } (fueraProvincias = bit 0x20 del hábitat).
import { el, icono } from '../ui/dom.js';
import { semaforo, nivelDe } from '../ui/semaforo.js';
import { comun } from '../ui/ficha.js';
import { urlSegura } from '../ui/normativa.js';
import { ORIENTACIONES, TRAMOS_PENDIENTE } from '../rejilla/formato.js';
import { esOrientativo } from '../rejilla/orientacion.js';
import { urlNuevaSalida } from '../diario.js';
import { textoFaltan } from '../pantallas/hoy.js';
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
    acciones: { comoLlegar: urlComoLlegar(celda.lat, celda.lon), detalle: zona ? `#zona/${encodeURIComponent(zona.id)}` : null, diario: urlNuevaSalida({ lat: celda.lat, lon: celda.lon, zona: zona?.id ?? null }) } };
  if (!nota || nota.valor == null) return { tipo: 'sinDatos', ...base, texto: 'Sin datos suficientes para este día.' };
  return { tipo: 'monte', ...base, valor: nota.valor, nivel: nivelDe(nota.valor),
    especie: { id: nota.especie.id, nombre: comun(nota.especie), latin: nota.especie.nombre },
    otras: nota.otras.map((o) => ({ nombre: comun(o.especie), valor: o.valor })) };
}

export const clasesHoja = (m) => `hoja hoja--mapa${m?.tipo === 'prohibido' ? ' hoja--prohibido' : ''}`;

export function estadoTrasArrastre(estado, dy, umbral = 60) {
  if (estado === 'resumen') return dy < -umbral ? 'completa' : dy > umbral ? 'cerrada' : 'resumen';
  if (estado === 'completa') return dy > umbral ? 'resumen' : 'completa';
  return estado;
}

const enlace = (href, texto, clase) => el('a', { clase, href, rel: 'noopener', target: '_blank', texto });
const avisoNodo = (texto, peligro) => el('div', { clase: peligro ? 'aviso-peligro' : 'aviso', attrs: { role: 'note' } }, icono(peligro ? 'i-aviso' : 'i-info'), el('p', { texto }));
function contenido(m, extra) {
  if (m.tipo === 'prohibido') {
    return [el('div', { clase: 'aviso-peligro', attrs: { role: 'note' } }, icono('i-aviso'), el('p', {}, el('strong', { texto: 'Recogida de setas prohibida. ' }), m.texto)),
      m.normas.length ? el('ul', { clase: 'mapa-popup__normas' }, m.normas.map((n) => el('li', {}, n.url ? enlace(n.url, n.titulo) : n.titulo))) : null];
  }
  const nodos = [m.tipo === 'monte'
    ? el('div', { clase: 'hoja__nota', attrs: { 'data-nivel': m.nivel } }, el('span', { clase: 'indice indice--grande tabular', texto: String(m.valor) }), semaforo(m.valor),
      el('p', {}, 'Por ', el('span', { clase: 'latin', texto: m.especie.latin }), ` (${m.especie.nombre})`))
    : el('p', { clase: 'texto-2', texto: m.texto })];
  nodos.push(...m.avisos.map((a) => avisoNodo(a.texto, a.peligro)));
  if (m.orientativo) nodos.push(el('p', { clase: 'texto-s' }, el('span', { clase: 'etiqueta etiqueta--ocre', texto: 'Orientativo' }), ' La orientación ajusta la humedad sin calibración local.'));
  nodos.push(el('dl', { clase: 'hoja__filas' }, m.filas.flatMap((f) => [el('dt', { texto: f.etiqueta }), el('dd', { texto: f.valor })])),
    m.origenLluvia ? el('p', { clase: 'texto-2 texto-s', texto: m.origenLluvia }) : null,
    el('p', { clase: 'texto-s' }, m.coto.url ? enlace(m.coto.url, m.coto.texto) : m.coto.texto),
    el('div', { clase: 'hoja__acciones' }, enlace(m.acciones.comoLlegar, 'Cómo llegar', 'boton'),
      m.acciones.detalle ? el('a', { clase: 'boton boton--suave', href: m.acciones.detalle, texto: 'Ver detalle' }) : null,
      el('a', { clase: 'boton boton--suave', href: m.acciones.diario, texto: 'Guardar en el diario' })));
  if (extra.desglose) nodos.push(extra.desglose());
  if (extra.completa && m.otras?.length) nodos.push(el('h3', { texto: 'Otras especies posibles' }), el('ul', {}, m.otras.map((o) => el('li', { texto: `${o.nombre}: ${o.valor}/100` }))));
  if (extra.grafico) nodos.push(extra.grafico());
  return nodos;
}

export function abrirHojaMapa({ modelo, desglose = null, grafico = null, alCerrar = () => {} }) {
  const previo = document.activeElement;
  const titulo = el('h2', { id: 'hoja-mapa-titulo', attrs: { tabindex: '-1' } });
  const asa = el('button', { type: 'button', clase: 'hoja__asa', attrs: { 'aria-expanded': 'false', 'aria-label': 'Ver más' } });
  const cerrar = el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Cerrar' });
  const cuerpo = el('div', { clase: 'hoja__cuerpo' });
  const hoja = el('section', { attrs: { role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'hoja-mapa-titulo' } },
    asa, el('div', { clase: 'hoja__cabeza' }, titulo, cerrar), cuerpo);
  let estado = 'resumen', extra = { desglose, grafico }, arrastrado = false, y0 = null;
  const pintar = () => {
    hoja.className = clasesHoja(modelo);
    hoja.dataset.estado = estado;
    titulo.textContent = modelo.titulo;
    asa.setAttribute('aria-expanded', String(estado === 'completa'));
    asa.setAttribute('aria-label', estado === 'completa' ? 'Ver menos' : 'Ver más');
    const completa = estado === 'completa';
    cuerpo.replaceChildren(...contenido(modelo, completa ? { ...extra, completa } : {}).filter(Boolean));
  };
  const poner = (e) => { if (e === 'cerrada') { api.cerrar(); return; } estado = e; pintar(); };
  asa.addEventListener('click', () => { if (arrastrado) { arrastrado = false; return; } poner(estado === 'completa' ? 'resumen' : 'completa'); });
  asa.addEventListener('pointerdown', (e) => { arrastrado = false; y0 = e.clientY; asa.setPointerCapture?.(e.pointerId); });
  asa.addEventListener('pointerup', (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0; y0 = null;
    if (Math.abs(dy) > 10) {
      arrastrado = true;   // el «click» que sigue al arrastre no cuenta; el siguiente toque, sí
      setTimeout(() => { arrastrado = false; }, 0);
      poner(estadoTrasArrastre(estado, dy));
    }
  });
  asa.addEventListener('pointercancel', () => { y0 = null; });
  cerrar.addEventListener('click', () => api.cerrar());
  // Escape ya atendido por otro (o pulsado dentro del panel de capas del mapa) no cierra la hoja.
  const tecla = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || document.activeElement?.closest?.('.mapa-panel')) return;
    api.cerrar();
  };
  document.addEventListener('keydown', tecla);
  const api = {
    actualizar(m, x = {}) { modelo = m; extra = { desglose: x.desglose ?? null, grafico: x.grafico ?? null }; estado = 'resumen'; pintar(); titulo.focus({ preventScroll: true }); },
    cerrar() {
      if (!hoja.isConnected) return;
      document.removeEventListener('keydown', tecla);
      hoja.remove();
      if (previo?.isConnected) previo.focus({ preventScroll: true });
      alCerrar();
    },
  };
  pintar();
  document.body.append(hoja);
  requestAnimationFrame(() => { hoja.dataset.abierta = 'true'; titulo.focus({ preventScroll: true }); });
  return api;
}

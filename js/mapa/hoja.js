// js/mapa/hoja.js
// Hoja fija del mapa (spec §2): región permanente con tres estados (recogida / resumen / completa) que nunca se cierra.
// Su contenido sigue a la selección: lista de zonas, zona y sus montes, ficha de monte, mancha (ladera) o zona prohibida
// (variante roja). Los modelos puros están en modelos-hoja.js; aquí solo se pintan. El foco se mueve solo con `enfocar: true`.
// `celda` = { habitat, altitud, orientacion, tramo, lat, lon, fueraProvincias? } (fueraProvincias = bit 0x20 del hábitat).
import { el, icono, etiqueta } from '../ui/dom.js';
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

// Frase de fraseZona (partes { texto, estilo }) como nodos: <b> para negrita, <span class="latin"> para latín.
export function pintarFrase(partes) {
  return partes.map(({ texto, estilo }) => (estilo === 'negrita' ? el('b', { clase: 'tabular', texto })
    : estilo === 'latin' ? el('span', { clase: 'latin', texto }) : texto));
}

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
    especie: { id: nota.especie.id, nombre: comun(nota.especie), latin: nota.especie.nombre },
    otras: nota.otras.map((o) => ({ nombre: comun(o.especie), valor: o.valor })) };
}

export const clasesHoja = (m) => `hoja hoja--mapa${m?.tipo === 'prohibido' ? ' hoja--prohibido' : ''}`;

export function estadoTrasArrastre(estado, dy, umbral = 60) {
  if (estado === 'recogida') return dy < -umbral ? 'resumen' : 'recogida';
  if (estado === 'resumen') return dy < -umbral ? 'completa' : dy > umbral ? 'recogida' : 'resumen';
  if (estado === 'completa') return dy > umbral ? 'resumen' : 'completa';
  return estado;
}

const enlace = (href, texto, clase) => el('a', { clase, href, rel: 'noopener', target: '_blank', texto });
const avisoNodo = (texto, peligro) => el('div', { clase: peligro ? 'aviso-peligro' : 'aviso', attrs: { role: 'note' } }, icono(peligro ? 'i-aviso' : 'i-info'), el('p', { texto }));
// ---------- Pintores: cada modelo → Node[] ----------
const pintarProhibido = (m) => [el('div', { clase: 'aviso-peligro', attrs: { role: 'note' } }, icono('i-aviso'), el('p', {}, el('strong', { texto: 'Recogida de setas prohibida. ' }), m.texto)),
  m.normas.length ? el('ul', { clase: 'mapa-popup__normas' }, m.normas.map((n) => el('li', {}, n.url ? enlace(n.url, n.titulo) : n.titulo))) : null];

const notaGrande = (valor) => el('span', { clase: 'indice indice--grande tabular', texto: String(valor) });
const etiquetas = (lista) => lista.map((e) => etiqueta(e.texto, e.variante));

function filaZonaNodo(f) {
  return el('li', {}, el('a', { clase: 'fila-zona', href: f.href, attrs: { 'data-nivel': f.nivel } },
    el('span', { clase: 'fila-zona__nombre-linea' }, el('span', { clase: 'fila-zona__pos', texto: String(f.pos) }), el('span', { clase: 'fila-zona__nombre', texto: f.nombre })),
    f.valor != null ? el('p', { clase: 'indice' }, String(f.valor)) : null,
    el('span', { clase: 'fila-zona__estado' }, semaforo(f.valor, f.fueraDeTemporada ? 'Fuera de temporada' : null), etiquetas(f.etiquetas)),
    el('span', { clase: 'fila-zona__frase' }, pintarFrase(f.frase))));
}
const listaFilas = (filas) => el('ol', { clase: 'lista-zonas' }, filas.map(filaZonaNodo));

const pintarListaZonas = (m) => [m.aviso ? avisoNodo(m.aviso, false) : null, listaFilas(m.filas)];
const pintarFuera = (m) => [el('p', { clase: 'texto-2', texto: m.texto }), listaFilas(m.filas)];

function filaMonteNodo(x) {
  return el('li', {}, el('a', { clase: 'fila-zona', href: x.href, attrs: { 'data-nivel': x.nivel } },
    el('span', { clase: 'fila-zona__nombre-linea' }, el('span', { clase: 'fila-zona__nombre', texto: x.nombre })),
    x.valor != null ? el('p', { clase: 'indice' }, String(x.valor)) : null,
    el('span', { clase: 'fila-zona__estado' }, semaforo(x.valor), x.rotulo ? etiqueta(x.rotulo.texto, x.rotulo.variante) : null),
    x.linea ? el('span', { clase: 'fila-zona__frase', texto: x.linea }) : null));
}

const pintarZona = (m) => [
  el('div', { clase: 'hoja__nota', attrs: { 'data-nivel': m.nivel } }, m.valor != null ? notaGrande(m.valor) : null, semaforo(m.valor), etiquetas(m.etiquetas),
    el('p', {}, pintarFrase(m.frase))),
  m.montes.length ? el('ol', { clase: 'lista-zonas' }, m.montes.map(filaMonteNodo)) : null,
  el('div', { clase: 'hoja__acciones' }, el('a', { clase: 'boton boton--suave', href: m.detalle, texto: 'Ver la zona' }))];

function pintarMonte(m, extra) {
  const nodos = [m.valor != null
    ? el('div', { clase: 'hoja__nota', attrs: { 'data-nivel': m.nivel } }, notaGrande(m.valor), semaforo(m.valor), m.dia ? etiqueta(m.dia, 'ocre') : null,
      m.especie ? el('p', {}, 'Por ', el('span', { clase: 'latin', texto: m.especie.latin }), ` (${m.especie.nombre})`) : null)
    : el('p', { clase: 'texto-2', texto: m.texto })];
  if (m.tambien) nodos.push(el('p', { clase: 'texto-2 texto-s', texto: `También: ${m.tambien}` }));
  if (m.porque) nodos.push(el('p', { clase: 'texto-s', texto: m.porque }));
  nodos.push(...m.avisos.map((a) => avisoNodo(a.texto, a.peligro)),
    el('p', { clase: 'texto-s' }, m.coto.url ? enlace(m.coto.url, m.coto.texto) : m.coto.texto),
    el('div', { clase: 'hoja__acciones' }, enlace(m.acciones.comoLlegar, 'Cómo llegar', 'boton'),
      el('a', { clase: 'boton boton--suave', href: m.acciones.diario, texto: 'Guardar en el diario' }),
      el('a', { clase: 'boton boton--suave', href: m.acciones.mas, texto: 'Más' })));
  if (extra.desglose) nodos.push(extra.desglose());
  if (extra.grafico) nodos.push(extra.grafico());
  return nodos;
}

// Mancha tocada: la ficha de la celda (bosque, altitud, meteo, coto y botones).
function pintarLadera(m, extra) {
  const nodos = [m.valor != null
    ? el('div', { clase: 'hoja__nota', attrs: { 'data-nivel': m.nivel } }, notaGrande(m.valor), semaforo(m.valor),
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

const PINTORES = { prohibido: pintarProhibido, listaZonas: pintarListaZonas, fuera: pintarFuera, zona: pintarZona, monte: pintarMonte, ladera: pintarLadera, sinDatos: pintarLadera };
const contenido = (m, extra = {}) => (PINTORES[m.tipo] ?? pintarLadera)(m, extra);
const familia = (m) => (m.tipo === 'listaZonas' || m.tipo === 'fuera' ? 'lista' : 'ficha');
const ESTADOS = ['recogida', 'resumen', 'completa'];
const SIGUIENTE = { recogida: 'resumen', resumen: 'completa', completa: 'resumen' };
const ETIQUETA_ASA = { recogida: 'Subir la hoja', resumen: 'Ver más', completa: 'Ver menos' };

// Hoja permanente del mapa: se monta una vez dentro de la pantalla (hereda --alto-nav) y solo cambia de contenido y de estado.
export function crearHojaMapa({ alElegir = () => {}, alCambiarDia = () => {} } = {}) {
  const asa = el('button', { type: 'button', clase: 'hoja__asa', attrs: { 'aria-expanded': 'true', 'aria-label': ETIQUETA_ASA.resumen } });
  const dias = el('div', { clase: 'chips hoja-mapa__dias', attrs: { role: 'group', 'aria-label': 'Día' } });
  const corto = el('p', { clase: 'hoja-mapa__corto' });
  const titulo = el('h2', { id: 'hoja-mapa-titulo', attrs: { tabindex: '-1' } });
  const cuerpo = el('div', { clase: 'hoja-mapa__cuerpo' });
  const nodo = el('section', { clase: 'hoja-mapa', attrs: { 'data-estado': 'resumen', role: 'region', 'aria-labelledby': 'hoja-mapa-titulo' } },
    el('div', { clase: 'hoja-mapa__nucleo' }, asa, dias, corto, titulo, cuerpo));
  let estado = 'resumen', modelo = null, extra = {}, arrastrado = false, y0 = null;
  function pintar() {
    if (modelo.tipo === 'prohibido') nodo.dataset.variante = 'prohibido'; else delete nodo.dataset.variante;
    titulo.textContent = modelo.titulo;
    corto.textContent = modelo.corto ?? modelo.titulo;
    cuerpo.replaceChildren(...contenido(modelo, { ...extra, completa: estado === 'completa' }).filter(Boolean));
    cuerpo.scrollTop = 0;
  }
  const ponerEstado = (e) => {
    if (!ESTADOS.includes(e) || e === estado) return;
    estado = e;
    nodo.dataset.estado = e;
    asa.setAttribute('aria-expanded', String(e !== 'recogida'));
    asa.setAttribute('aria-label', ETIQUETA_ASA[e]);
    if (modelo) pintar();   // «Otras especies posibles» solo se ven en completa
  };
  asa.addEventListener('click', () => { if (arrastrado) { arrastrado = false; return; } ponerEstado(SIGUIENTE[estado]); });
  asa.addEventListener('pointerdown', (e) => { arrastrado = false; y0 = e.clientY; asa.setPointerCapture?.(e.pointerId); });
  asa.addEventListener('pointerup', (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0; y0 = null;
    if (Math.abs(dy) > 10) {
      arrastrado = true;   // el «click» que sigue al arrastre no cuenta; el siguiente toque, sí
      setTimeout(() => { arrastrado = false; }, 0);
      ponerEstado(estadoTrasArrastre(estado, dy));
    }
  });
  asa.addEventListener('pointercancel', () => { y0 = null; });
  return {
    nodo,
    // Repinta sin cambiar de estado, salvo que cambie la familia del modelo (lista ↔ ficha): entonces vuelve a «resumen».
    poner(m, x = {}, { enfocar = false } = {}) {
      const otraFamilia = !modelo || familia(m) !== familia(modelo);
      modelo = m; extra = { desglose: x.desglose ?? null, grafico: x.grafico ?? null };
      if (otraFamilia) ponerEstado('resumen');
      pintar();
      if (enfocar) titulo.focus({ preventScroll: true });
    },
    // items = [{ clave, texto, pulsado, alPulsar? }]; sin alPulsar se avisa a alCambiarDia(clave).
    ponerDias(items = []) {
      dias.hidden = !items.length;
      dias.replaceChildren(...items.map((x) => {
        const b = el('button', { type: 'button', clase: 'chip', attrs: { 'aria-pressed': String(!!x.pulsado), 'data-clave': x.clave } }, x.texto);
        b.addEventListener('click', () => (x.alPulsar ? x.alPulsar() : alCambiarDia(x.clave)));
        return b;
      }));
    },
    estado: () => estado,
    ponerEstado,
    alElegir,
  };
}

// Hoja antigua (role=dialog, se abre al tocar una mancha). Se retira en la integración (Tarea 8), cuando mapa.js use crearHojaMapa.
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

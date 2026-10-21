// js/pantallas/mapa.js
// Pantalla «Mapa», la portada (docs/superpowers/specs/2026-10-21-mapa-niveles-design.md): mapa a pantalla completa con
// tres niveles (zonas → montes → laderas). Manda la selección de la ruta (#mapa, #mapa/<zona>, #mapa/<zona>/<punto>), que
// solo cambia con toques explícitos; el zoom decide qué chinchetas se ven (decisiones 1 y 13). La hoja fija dice lo elegido
// y lleva la barra de días (14, 15). Las manchas por ladera salen de la rejilla y del índice; sin ellos, los niveles 1 y 2
// siguen con la meteo de los puntos.
import { el, icono } from '../ui/dom.js';
import { cargarLeaflet, cargarCotos, popupCoto, NIVEL_COLOR, COLOR, estiloCoto, estiloHalo, pintarSalidas, radioLluvia, lluvia26 } from '../mapa.js';
import { especiesDeZona } from '../datos.js';
import { hoyMadrid, entreDias } from '../meteo.js';
import { limitesGruesa, puntoEnGeometria, bboxDe } from '../rejilla/geo.js';
import { cargarIndice, avisoIndice, cargarDatosRejilla, archivosVisibles, crearCargadorRejillas,
  rejillasSoportadas, ZOOM_MIN_FINA } from '../rejilla/carga.js';
import { gruesasDeArchivo, colorear, notaGruesa, colorDeNota, ALFA, ALFA_TRAMA } from '../rejilla/pintor.js';
import { calcularNotas } from '../rejilla/notas-async.js';
import { agregadosDeCelda } from '../rejilla/salida.js';
import { crearCapaRejilla } from '../mapa/capa-rejilla.js';
import { crearFondo, leerPreferencias, guardarPreferencias, panelCapas, SUPERPUESTAS } from '../mapa/fondos.js';
import { crearHojaMapa, urlComoLlegar } from '../mapa/hoja.js';
import { contenidoHoja } from '../mapa/contenido-hoja.js';
import { resolverToque } from '../mapa/toque-celda.js';
import { chipsDelDia, chipVigente, barraDias, fechasBarra, avisosMapa } from '../mapa/controles.js';
import { crearBusquedaMapa } from '../mapa/busqueda-mapa.js';
import { queChinchetas, chinchetasZonas, chinchetasMontes, crearCapaChinchetas, ZOOM_MONTES, ZOOM_ETIQUETAS, ALTO_CHINCHETA } from '../mapa/chinchetas.js';
import { crearCapaEtiquetas, etiquetasDeVista, MEDIA_ANCHURA_ETIQUETA } from '../mapa/capa-etiquetas.js';
import { contornoZona, ESTILO_CONTORNO } from '../mapa/contorno.js';
import { leerRutaMapa, rutaMapa, esRutaMapa } from '../mapa/ruta.js';
import { resolverSeleccion, claveSeleccion, encuadreDe, migasDe, zonasQueCortan, filasZonas, filtroDeChip, limitesZona,
  rutaNormal, estadoHistorial, volverConAtras } from '../mapa/seleccion.js';
import { zonasMasCercanas, zonaDeLugar } from '../mapa/geocodificador.js';
import { desplazamientoDia } from '../notas-zona.js';

const MAX_IMAGENES = 12;             // imágenes coloreadas que se guardan (día × chip × archivo)
const TRES_HORAS = 3 * 3600e3;       // el índice se vuelve a pedir con el mapa abierto (misma caché que cargarIndice)
const POPUP = { minWidth: 200, maxWidth: 250, autoPanPaddingTopLeft: [16, 140], autoPanPaddingBottomRight: [72, 180] };
const FECHA_DIA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
// vista = { lat, lon, zoom, clave }: la vista y la selección que tenía; se conserva al salir y volver (p. ej. desde Zona).
const ui = { fecha: null, chip: 'mejor', vista: null };
let montaje = null;

window.addEventListener('hashchange', () => {
  if (esRutaMapa(location.hash)) return;   // la portada sin hash y #hoy también son el mapa: no se desmonta
  document.body.classList.remove('en-mapa');
  const m = montaje;
  montaje = null;
  m?.then((v) => v.destruir()).catch(() => {});
});

export async function pintar({ estado, param }) {
  document.body.classList.add('en-mapa');
  montaje ??= montar(estado).catch((e) => { montaje = null; document.body.classList.remove('en-mapa'); throw e; });
  const v = await montaje;
  v.actualizar(estado, param);
  return v.raiz;
}

// --alto-arriba: hasta dónde llegan buscador, migas y chips (Capas y Mi ubicación van debajo); --alto-hoja: lo que ocupa
// la hoja; --alto-abajo: hoja + avisos (los controles de Leaflet van encima).
function medirBarras(raiz) {
  const cab = document.querySelector('.cabecera'), nav = document.querySelector('.barra-nav'), arriba = raiz.querySelector('.mapa-completo__arriba');
  const altoArriba = arriba?.offsetHeight ? arriba.offsetTop + arriba.offsetHeight : (cab?.offsetHeight ?? 64) + 116;
  raiz.style.setProperty('--alto-arriba', `${altoArriba}px`);
  const hoja = raiz.querySelector('.hoja-mapa')?.offsetHeight || 148, avisos = raiz.querySelector('.mapa-completo__abajo')?.offsetHeight || 0;
  raiz.style.setProperty('--alto-cabecera', `${cab?.offsetHeight ?? 64}px`);
  raiz.style.setProperty('--alto-nav', `${(nav?.offsetHeight ?? 100) + 12}px`);
  raiz.style.setProperty('--alto-hoja', `${hoja}px`);
  if (raiz.querySelector('.hoja-mapa')?.dataset.estado === 'resumen') raiz.style.setProperty('--alto-hoja-resumen', `${hoja}px`);
  raiz.style.setProperty('--alto-abajo', `${hoja + (avisos ? avisos + 8 : 0)}px`);
}

async function montar(estadoInicial) {
  let estado = estadoInicial;
  const datos = estado.datos;
  const normas = new Map((datos.normativa ?? []).map((n) => [n.id, n]));
  const L = await cargarLeaflet();
  const prefs = leerPreferencias();
  let vivo = true;   // false tras destruir(): lo que aún esté en curso (un toque, una descarga) ya no toca nada

  // ---------- DOM ----------
  // Orden (y tabulación): buscador y chips, Capas y Mi ubicación, panel, avisos y hoja, y al final el lienzo (decisión 10).
  const lienzo = el('div', { clase: 'mapa-completo__lienzo', attrs: { role: 'region', 'aria-label': 'Mapa con las zonas, sus montes y las manchas donde es más probable encontrar setas' } });
  const anuncio = el('p', { clase: 'solo-lector', attrs: { 'aria-live': 'polite' } });
  const avisos = el('div', { clase: 'mapa-completo__avisos' });
  const chips = el('div', { clase: 'chips mapa-completo__chips', attrs: { role: 'group', 'aria-label': 'Especie' } });
  const panel = el('div', { id: 'mapa-panel-capas', clase: 'mapa-completo__panel', hidden: true });
  const botonCapas = el('button', { type: 'button', clase: 'boton boton--suave boton--icono mapa-completo__boton', attrs: { 'aria-label': 'Capas', 'aria-expanded': 'false', 'aria-controls': 'mapa-panel-capas' } }, icono('i-capas'));
  const botonYo = el('button', { type: 'button', clase: 'boton boton--suave boton--icono mapa-completo__boton', attrs: { 'aria-label': 'Mi ubicación' } }, icono('i-ubicacion'));
  const hoja = crearHojaMapa({ alCambiarDia: (f) => { ui.fecha = f; cambio(); } });
  const mapa = L.map(lienzo, { zoomControl: false, minZoom: 6, maxZoom: 18 });
  const busqueda = crearBusquedaMapa({ L, mapa, datos, chips: () => listaChips(), alChip: (id) => { ui.chip = id; cambio(); },
    alRuta: (r) => irARuta(r, { enfocar: true }), alLugar: alElegirLugar, alError: (t) => avisar(t), vivo: () => vivo });
  const arriba = el('div', { clase: 'mapa-completo__arriba' }, busqueda.nodo, chips);
  const raiz = el('div', { clase: 'mapa-completo' }, arriba,
    el('div', { clase: 'mapa-completo__botones' }, botonCapas, botonYo), panel,
    el('div', { clase: 'mapa-completo__abajo' }, avisos), hoja.nodo, anuncio, lienzo);
  medirBarras(raiz);

  // ---------- Mapa ----------
  mapa.setView([40.4, -3.7], 6);
  L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(mapa);
  // La atribución va en una línea; tocarla (fuera de sus enlaces) la enseña entera o la vuelve a recoger.
  const atribucion = lienzo.querySelector('.leaflet-control-attribution');
  atribucion?.addEventListener('click', (e) => { if (!e.target.closest('a')) atribucion.classList.toggle('atribucion--entera'); });
  for (const [nombre, z] of [['rejilla', 350], ['lluvia', 420], ['puntos', 450]]) mapa.createPane(nombre).style.zIndex = z;
  let fondo = crearFondo(L, prefs.fondo).addTo(mapa);
  const capas = Object.fromEntries(Object.keys(SUPERPUESTAS).map((k) => [k, L.layerGroup()]));
  const contorno = L.layerGroup().addTo(mapa);
  const chinchetas = crearCapaChinchetas(L, { alTocar: (c) => irARuta(c.tipo === 'zona' ? rutaMapa({ zona: c.id }) : rutaMapa({ zona: c.zona, punto: c.id }), { enfocar: true }) });
  chinchetas.capa.addTo(mapa);
  const etiquetas = crearCapaEtiquetas(L, { alTocar: (ll) => { tocar(ll).catch((err) => avisar(err.message)); } });   // las mejores manchas de la vista (nivel 3)
  etiquetas.capa.addTo(mapa);
  const todas = L.latLngBounds(datos.zonas.map(limitesZona).flat());
  const medido = () => lienzo.clientWidth > 0 && lienzo.clientHeight > 0;
  // Encuadre sin dejar nada bajo el buscador ni bajo la hoja (en «resumen» como mucho: la completa no cuenta).
  const margenes = () => { const v = (n, d) => parseFloat(raiz.style.getPropertyValue(n)) || d;
    // La hoja cuenta lo que mide; en «completa», lo que medía en «resumen» (si no, no quedaría mapa que encuadrar).
    const hojaAlta = v('--alto-hoja', 148), cuenta = hoja.estado() === 'completa' ? v('--alto-hoja-resumen', hojaAlta) : hojaAlta;
    const abajo = cuenta + v('--alto-abajo', 148) - hojaAlta;
    const tapa = lienzo.querySelector('.leaflet-bottom.leaflet-right')?.offsetHeight || 0;   // la atribución tapa el mapa encima de la hoja
    return { paddingTopLeft: [16, v('--alto-arriba', 180) + 8], paddingBottomRight: [16, v('--alto-nav', 112) + abajo + tapa + 8], animate: false }; };
  // Para encuadrar chinchetas: suben ALTO_CHINCHETA sobre su punto, así que arriba hace falta ese margen de más.
  const margenesChinchetas = () => { const m = margenes(); return { ...m, paddingTopLeft: [m.paddingTopLeft[0], m.paddingTopLeft[1] + ALTO_CHINCHETA] }; };
  // Centra un punto en el hueco que dejan el buscador y la hoja.
  function centrar([lat, lon], zoom) {
    const m = margenes(), desfase = (m.paddingBottomRight[1] - m.paddingTopLeft[1]) / 2;
    mapa.setView(mapa.unproject(mapa.project([lat, lon], zoom).add([0, desfase]), zoom), zoom, { animate: false });
  }
  // Zona: su bbox entera; si en el hueco del móvil eso deja el zoom por debajo del de los montes, se acerca hasta él
  // (centrado en la zona) para que se vean sus montes, que es lo que promete el nivel 2.
  function encuadrarZona(limites) {
    mapa.fitBounds(limites, margenesChinchetas());
    if (mapa.getZoom() < ZOOM_MONTES) { const c = L.latLngBounds(limites).getCenter(); centrar([c.lat, c.lng], ZOOM_MONTES); }
  }
  let encuadre = null;
  const encuadrar = (f) => { if (medido()) { encuadre = null; f(); } else encuadre = f; };
  // El hueco libre cambia con la hoja (abierta, completa, recogida): se recolocan las etiquetas, una vez por fotograma.
  const recolocarEtiquetas = () => { cancelAnimationFrame(pideEtiquetas); pideEtiquetas = requestAnimationFrame(() => colocarEtiquetas()); };
  const medida = new ResizeObserver(() => { medirBarras(raiz); mapa.invalidateSize(); recolocarEtiquetas(); if (encuadre && medido()) { const f = encuadre; encuadre = null; f(); } });
  medida.observe(lienzo);
  medida.observe(hoja.nodo);
  medida.observe(avisos);
  medida.observe(arriba);   // las migas lo hacen más alto

  // ---------- Datos ----------
  // Sin DecompressionStream (Safari < 16.4) no se leen las rejillas: ni se pide el índice; chinchetas con su aviso.
  const sinDescompresion = !rejillasSoportadas();
  const cargador = crearCargadorRejillas();
  // El mapa se monta con las chinchetas; la rejilla y el índice llegan después (con mala cobertura pueden tardar
  // decenas de segundos) y, al llegar, se ven las manchas. Ver la carga al final de montar().
  let rej = null, salida = null, cargadoEn = Date.now(), recargando = false, cargandoLaderas = !sinDescompresion;
  const CapaRejilla = crearCapaRejilla(L);
  let capaRejilla = null;   // se crea al llegar la rejilla y se añade al mapa solo con índice (lleva la atribución del MFE50 y del MDT)
  const capaGruesa = L.layerGroup().addTo(mapa);
  const contornos = L.layerGroup();   // contorno de los prohibidos en la vista lejana, aunque la capa Prohibido esté apagada
  let contornosPedidos = null;
  const imagenes = new Map(), notasPor = new Map(), gruesasPorArchivo = new Map();   // notasPor: las notas de cada imagen, para las etiquetas
  let turno = 0, toque = 0, version = 0, claveGruesas = null, cotos = null, error = null;

  const especiesPorZona = () => { const m = new Map(); for (const z of datos.zonas) m.set(z.id, especiesDeZona(z, datos.especies, estado.umbrales ?? {})); return m; };
  let especiesZona = especiesPorZona();
  const hoy = () => hoyMadrid();
  const fechas = () => fechasBarra({ salida, meteo: estado.meteo, hoy: hoy() });
  const listaChips = () => chipsDelDia(datos.especies, ui.fecha ?? hoy());
  const filtro = () => filtroDeChip(listaChips(), ui.chip);
  const fechaSinIndice = () => !!salida && !(salida.fechas ?? []).includes(ui.fecha);
  function ponerModo() {
    if (salida && capaRejilla && !mapa.hasLayer(capaRejilla)) capaRejilla.addTo(mapa);
    if (!salida && capaRejilla && mapa.hasLayer(capaRejilla)) mapa.removeLayer(capaRejilla);
  }

  // Notas del día (fecha × chip × meteo × umbrales): las mismas para chinchetas, lista y fichas.
  let delDia = null;
  function notasDelDia() {
    const clave = `${ui.fecha}|${ui.chip}|${version}`;
    if (delDia?.clave === clave && delDia.meteo === estado.meteo) return delDia;
    const d = desplazamientoDia(ui.fecha, estado.meteo?.hoy), f = filtro(), u = estado.umbrales ?? {};
    const filas = filasZonas({ datos, meteo: estado.meteo, d, filtro: f, umbrales: u });
    delDia = { clave, meteo: estado.meteo, d, filtro: f, filas, zonas: chinchetasZonas(filas), montes: chinchetasMontes(datos.zonas, datos, estado.meteo, d, f, u) };
    return delDia;
  }
  const diasDesdeHoy = () => Math.max(0, entreDias(hoy(), ui.fecha) || 0);

  // ---------- Selección (la ruta) ----------
  let sel = { zona: null, punto: null }, claveSel = null, enfocarPendiente = false, hashVisto = null;
  let rutaAplicada = null;     // la ruta de la última selección aplicada (para el historial de «‹»)
  let lugarPendiente = null;   // lugar del buscador dentro de una zona: al aplicar su zona se centra en él (y su gota)
  let cotosPuntos = null, pidiendoCotos = null;   // cotos de los montes (ver pedirCotosPuntos)
  // Contenido que tapa al de la selección hasta el siguiente cambio: { tipo: 'celda', modelo, extra, latlng } | { tipo: 'fuera', nombre, lat, lon }.
  let sobrepuesto = null;
  // Un toque explícito (chincheta, fila, sugerencia) cambia la ruta y enfoca la hoja; si la ruta ya es esa, se reencuadra igual.
  function irARuta(ruta, { enfocar = false } = {}) {
    if (!vivo) return;
    if (ruta === (location.hash || '#mapa')) { aplicarSeleccion(true); cambio({ enfocar }); return; }
    enfocarPendiente = enfocar;
    location.hash = ruta;
  }
  hoja.nodo.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#mapa"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    irARuta(a.getAttribute('href'), { enfocar: true });
  });
  // Migas: tocar una vuelve a encuadrar aunque sea la ruta actual; «‹» usa el atrás del historial si la entrada anterior
  // es justo su destino (así el atrás del móvil no vuelve a bajar de nivel) y, si no, navega como un enlace.
  busqueda.nodo.addEventListener('click', (e) => {
    const a = e.target.closest?.('.mapa-buscador__migas a[href^="#mapa"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    if (a.dataset.subir === 'true' && volverConAtras(history.state, href)) history.back(); else irARuta(href);
  });
  // Lee la ruta; si la selección cambió (o se fuerza), migas, contorno y encuadre. Devuelve si cambió.
  function aplicarSeleccion(forzar = false) {
    const nueva = resolverSeleccion(leerRutaMapa(location.hash), datos.zonas), clave = claveSeleccion(nueva);
    if (clave === claveSel && !forzar && !lugarPendiente) return false;
    const primera = claveSel === null;
    if (clave !== claveSel) busqueda.ponerMigas(migasDe(nueva));   // ponerMigas vacía el campo: solo al cambiar
    sel = nueva; claveSel = clave; sobrepuesto = null; toque++;
    const ruta = rutaNormal(location.hash), hist = estadoHistorial({ estado: history.state, ruta, anterior: primera ? null : rutaAplicada });
    if (hist) history.replaceState(hist, '');
    rutaAplicada = ruta;
    const lugar = lugarPendiente;
    lugarPendiente = null;
    if (lugar?.gota) busqueda.ponerChincheta(lugar.lat, lugar.lon, lugar.nombre); else busqueda.quitarChincheta();
    busqueda.invalidar();   // una elección de CartoCiudad que llegue tarde ya no reencuadra ni tapa la hoja
    if (cotosPuntos === 'error') cotosPuntos = null;   // otra selección: se reintentan los cotos
    mapa.closePopup();
    contorno.clearLayers();
    if (sel.zona) L.polygon(contornoZona(sel.zona.bbox), ESTILO_CONTORNO).addTo(contorno);
    const e = encuadreDe(sel);
    if (lugar) encuadrar(() => centrar([lugar.lat, lugar.lon], lugar.zoom));
    else if (primera && ui.vista && ui.vista.clave === clave) mapa.setView([ui.vista.lat, ui.vista.lon], ui.vista.zoom, { animate: false });
    else if (e?.tipo === 'zona') encuadrar(() => encuadrarZona(e.limites));
    else if (e?.tipo === 'punto') encuadrar(() => centrar(e.centro, e.zoom));
    else if (primera) encuadrar(() => mapa.fitBounds(todas, margenesChinchetas()));
    return true;
  }

  // ---------- Controles ----------
  const chip = (clave, texto, pulsado, alPulsar) => {
    const b = el('button', { type: 'button', clase: 'chip', attrs: { 'aria-pressed': String(pulsado), 'data-clave': clave } }, texto);
    b.addEventListener('click', alPulsar);
    return b;
  };
  // Una fila de chips solo se rehace si cambia su contenido o el pulsado; si se rehace con el foco dentro, el foco pasa
  // al chip equivalente (misma especie o mismo día).
  function ponerFila(fila, items, pintarFila) {
    const firma = JSON.stringify(items.map((x) => [x.clave, x.texto, x.pulsado]));
    if (fila.dataset.firma === firma) return;
    fila.dataset.firma = firma;
    const enfocado = fila.contains(document.activeElement) ? document.activeElement.dataset.clave : null;
    pintarFila(items);
    if (enfocado != null) [...fila.children].find((b) => b.dataset.clave === enfocado)?.focus({ preventScroll: true });
  }
  const filaDias = hoja.nodo.querySelector('.hoja-mapa__dias');
  function pintarControles() {
    const fs = fechas();
    if (!fs.includes(ui.fecha)) ui.fecha = fs[0];
    const lista = listaChips();
    ui.chip = chipVigente(ui.chip, lista);
    // Los chips filtran chinchetas, listas y manchas: se enseñan también sin índice.
    ponerFila(chips, lista.map((c) => ({ clave: c.id, texto: c.texto, pulsado: c.id === ui.chip, alPulsar: () => { ui.chip = c.id; cambio(); } })),
      (items) => chips.replaceChildren(...items.map((x) => chip(x.clave, x.texto, x.pulsado, x.alPulsar))));
    ponerFila(filaDias, barraDias(fs, hoy(), ui.fecha).map((d) => ({ clave: d.fecha, texto: d.menosFiable ? `${d.texto} · menos fiable` : d.texto, pulsado: d.pulsado })),
      (items) => hoja.ponerDias(items));
  }
  function pintarAvisos() {
    const meteo = estado.meteo;
    // La lista de zonas ya dice «Con los últimos datos»: el aviso del mapa sale en los demás contenidos.
    const otroDia = meteo?.series && meteo.hoy && meteo.hoy !== hoy() && (sel.zona || sobrepuesto)
      ? `Con los últimos datos, del ${FECHA_DIA.format(new Date(`${meteo.hoy}T12:00:00Z`))}: no se ha podido actualizar la previsión.` : null;
    const lista = avisosMapa({ salida, sinDescompresion, cargando: cargandoLaderas, meteo, otroDia, viejo: salida && avisoIndice(salida),
      diasDesdeHoy: diasDesdeHoy(), zoom: mapa.getZoom(), error, fechaSinIndice: fechaSinIndice(), fechaSinMeteo: !!meteo?.series && notasDelDia().d == null });
    const firma = JSON.stringify(lista);
    if (avisos.dataset.firma === firma) return;
    avisos.dataset.firma = firma;
    avisos.replaceChildren(...lista.map(([i, t]) => el('div', { clase: 'aviso', attrs: { role: 'note' } }, icono(i), el('p', { texto: t }))));
    medirBarras(raiz);
  }
  const avisar = (t) => { if (!vivo) return; error = t; pintarAvisos(); };
  let claveVista = null;
  // Repinta todo con la selección, el día y el chip actuales. Solo enfoca la hoja tras un toque explícito.
  function cambio({ enfocar = false } = {}) {
    if (!vivo) return;
    error = null;
    pintarControles();
    // Las rejillas fuera de la vista no se quedan con el día o la especie de antes; si nada de eso cambia (llega la
    // meteo), no se vacían: así no parpadean.
    const clave = `${ui.fecha}|${ui.chip}|${salida?.sello}|${version}`;
    const otroDiaOChip = clave !== claveVista;
    if (otroDiaOChip) { claveVista = clave; capaRejilla?.quitarTodo(); etiquetas.limpiar(); vistasEtiquetas = null; }
    pintarAvisos(); repintar(); pintarChinchetas();
    if (mapa.hasLayer(capas.lluvia)) pintarLluvia();
    // Una ladera tocada se recalcula con el día y el chip nuevos (sin mover el foco); lo demás se repinta.
    if (otroDiaOChip && sobrepuesto?.tipo === 'celda' && sobrepuesto.latlng) tocar(sobrepuesto.latlng, { enfocar: false }).catch((e) => avisar(e.message));
    pintarHoja({ enfocar });
    const c = listaChips().find((x) => x.id === ui.chip), d = barraDias(fechas(), hoy(), ui.fecha).find((x) => x.pulsado);
    const texto = `Mapa: ${c?.texto ?? 'Mejor hoy'}, ${d?.texto ?? 'hoy'}.`;
    if (anuncio.textContent !== texto) anuncio.textContent = texto;   // el lector no lo repite en cada llegada de la meteo
  }

  // ---------- Chinchetas: el zoom decide cuáles ----------
  let firmaChinchetas = null;
  function pintarChinchetas() {
    const n = notasDelDia();
    let lista, elegida = null;
    if (queChinchetas(mapa.getZoom()) === 'zonas') {
      lista = n.zonas;
      if (sel.zona) elegida = { tipo: 'zona', id: sel.zona.id };
    } else {
      const b = mapa.getBounds(), visibles = new Set(zonasQueCortan(datos.zonas, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]).map((z) => z.id));
      lista = n.montes.filter((c) => visibles.has(c.zona));
      if (sel.punto) elegida = { tipo: 'punto', id: sel.punto.id };
    }
    const firma = JSON.stringify([lista.map((c) => [c.tipo, c.id, c.valor]), elegida]);
    if (firma === firmaChinchetas) return;   // rehacerlas le quitaría el foco a una chincheta enfocada
    firmaChinchetas = firma;
    chinchetas.poner(lista, elegida);
  }

  // ---------- Hoja: lo elegido ----------
  // Cotos de los puntos (1 MB la primera vez): se piden al elegir una zona y, al llegar, se repinta la hoja. Si fallan, se
  // vuelven a pedir al cambiar de selección (no en cada repintado: sin red sería un bucle).
  function pedirCotosPuntos() {
    pidiendoCotos ??= (async () => {
      const m = new Map();
      for (const z of datos.zonas) for (const p of z.puntos) m.set(p.id, (await poligonoEn(p.lon, p.lat, (q) => q.tipo !== 'prohibido'))?.properties ?? null);
      cotosPuntos = m;
    })().catch(() => { cotosPuntos = 'error'; pidiendoCotos = null; }).finally(() => { if (vivo && sel.zona && !sobrepuesto) pintarHoja(); });
  }
  function pintarHoja({ enfocar = false } = {}) {
    if (!vivo) return;
    if (sobrepuesto?.tipo === 'celda') { hoja.poner(sobrepuesto.modelo, sobrepuesto.extra, { enfocar }); return; }
    if (sel.zona && !sobrepuesto && cotosPuntos !== 'error') pedirCotosPuntos();   // tras un fallo, hasta la siguiente selección
    const { modelo, extra } = contenidoHoja({ sel, fuera: sobrepuesto?.tipo === 'fuera' ? sobrepuesto : null, notas: notasDelDia(), datos, meteo: estado.meteo,
      umbrales: estado.umbrales ?? {}, fecha: ui.fecha, hoy: hoy(), dHoy: diasDesdeHoy(), cotos: cotosPuntos });
    hoja.poner(modelo, extra, { enfocar });
  }
  // Lugar elegido en el buscador. Dentro de las zonas: se elige la zona que lo contiene (migas y hoja pasan a ella, sin
  // monte), y al aplicarla el mapa se centra en el lugar con su gota. Fuera: la hoja lo dice y el mapa enseña también las
  // zonas más cercanas. Cualquier contenido sobrepuesto (ladera tocada, otro lugar) se quita.
  function alElegirLugar({ nombre, lat, lon, zoom = 13, fuera, gota = true }) {
    if (!vivo) return;
    if (!fuera) {
      const zona = zonaDeLugar(lat, lon, datos.zonas);
      sobrepuesto = null;
      lugarPendiente = { nombre, lat, lon, zoom, gota };
      irARuta(rutaMapa({ zona: zona.id }), { enfocar: true });
      return;
    }
    sobrepuesto = { tipo: 'fuera', nombre, lat, lon };
    const cerca = zonasMasCercanas(lat, lon, datos.zonas, 3);
    encuadrar(() => {
      const caja = L.latLngBounds([[lat, lon], ...cerca.flatMap(limitesZona)]), m = margenesChinchetas();
      const z0 = mapa.getMinZoom(), hueco0 = mapa.getSize().subtract(L.point(m.paddingTopLeft).add(m.paddingBottomRight));
      const tam = mapa.project(caja.getSouthEast(), z0).subtract(mapa.project(caja.getNorthWest(), z0));
      if (tam.x <= hueco0.x && tam.y <= hueco0.y) { mapa.fitBounds(caja, m); return; }
      // No cabe ni en el zoom mínimo: el lugar abajo del hueco visible y, por encima, lo que quepa de las zonas cercanas.
      const z = mapa.getMinZoom(), hueco = window.innerHeight - m.paddingBottomRight[1] - m.paddingTopLeft[1];
      const centro = mapa.unproject(mapa.project([lat, lon], z).subtract([0, Math.max(0, hueco / 2 - 40)]), z);
      centrar([centro.lat, centro.lng], z);
    });
    cambio({ enfocar: true });
  }

  // ---------- Pintado de las manchas ----------
  function ponerContornos() {
    const ver = salida && mapa.getZoom() < ZOOM_MIN_FINA && !mapa.hasLayer(capas.prohibido);
    if (!ver) { if (mapa.hasLayer(contornos)) mapa.removeLayer(contornos); return; }
    if (!mapa.hasLayer(contornos)) contornos.addTo(mapa);
    contornosPedidos ??= cargarCotos().then((g) => {
      const col = { type: 'FeatureCollection', features: g.features.filter((x) => x.properties.tipo === 'prohibido') };
      contornos.addLayer(L.geoJSON(col, { style: (x) => ({ ...estiloHalo(x.properties), weight: 3 }), interactive: false }));
      contornos.addLayer(L.geoJSON(col, { style: (x) => ({ ...estiloCoto(x.properties), weight: 1.5, fill: false }), interactive: false }));
    }).catch(() => { contornosPedidos = null; });
  }
  async function repintar() {
    const mia = ++turno;
    ponerContornos();
    // Sin índice, o con un día que el índice no tiene, no hay manchas (lo dice el aviso).
    if (!salida || fechaSinIndice()) { capaGruesa.clearLayers(); claveGruesas = null; capaRejilla?.quitarTodo(); etiquetas.limpiar(); vistasEtiquetas = null; return; }
    const zoom = mapa.getZoom();
    if (zoom < ZOOM_MIN_FINA) { capaRejilla.quitarTodo(); etiquetas.limpiar(); vistasEtiquetas = null; pintarGruesas(); return; }
    if (zoom < ZOOM_ETIQUETAS) { etiquetas.limpiar(); vistasEtiquetas = null; }
    capaGruesa.clearLayers(); claveGruesas = null;
    const b = mapa.getBounds(), f = filtro(), fecha = ui.fecha, chipActual = ui.chip;
    const vistos = [];
    for (const a of archivosVisibles(rej.indice, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom)) {
      const clave = `${a.archivo}|${fecha}|${chipActual}|${salida.sello}|${version}`;
      vistos.push({ a, clave });
      if (capaRejilla.tieneImagen(a.archivo, clave)) continue;
      let r;
      try { r = await cargador.cargar(a.archivo); } catch (e) { if (mia === turno) avisar(e.message); continue; }
      if (mia !== turno) return;
      let rgba = imagenes.get(clave);
      if (!rgba) {
        if (!gruesasPorArchivo.has(a.archivo)) gruesasPorArchivo.set(a.archivo, gruesasDeArchivo(r, rej.gruesa));
        let notas;
        try {
          notas = await calcularNotas({ archivo: a.archivo, rejilla: r, gruesas: gruesasPorArchivo.get(a.archivo), gruesa: rej.gruesa, salida, fecha,
            especies: especiesZona.get(r.cabecera.zona) ?? [], filtro: f });
        } catch (e) {
          if (mia === turno) avisar(`No se ha podido calcular el mapa por laderas (${e.message}).`);
          continue;
        }
        if (mia !== turno) return;   // resultado de un día, una especie o una vista que ya no se ven
        rgba = colorear(notas, r.cabecera.ancho);   // «sin datos» en damero
        imagenes.set(clave, rgba); notasPor.set(clave, notas);
        if (imagenes.size > MAX_IMAGENES) { imagenes.delete(imagenes.keys().next().value); notasPor.delete(notasPor.keys().next().value); }
      }
      capaRejilla.ponerImagen(a.archivo, r.cabecera, rgba, clave);
    }
    if (zoom >= ZOOM_ETIQUETAS) await ponerEtiquetas(mia, vistos, f, fecha);
  }
  // Hasta tres etiquetas sobre las mejores manchas de la vista, con las notas ya calculadas; sustituyen a las de antes de golpe.
  let vistasEtiquetas = null, pideEtiquetas = 0;   // { archivos, ctx } de la última vista, para recolocar sin recalcular notas
  async function ponerEtiquetas(mia, vistos, filtroActual, fecha) {
    const archivos = [];
    for (const { a, clave } of vistos) {
      const notas = notasPor.get(clave);
      if (!notas) continue;
      try { archivos.push({ a, r: await cargador.cargar(a.archivo), notas }); } catch { /* sin esa rejilla no hay etiquetas de ese archivo */ }
    }
    if (mia !== turno || !vivo) return;
    vistasEtiquetas = { archivos, ctx: { datos, rej, salida, gruesasPorArchivo, especiesZona, fecha, filtro: filtroActual } };
    colocarEtiquetas();
  }
  // Elige y pone las etiquetas con lo último calculado; se repite al cambiar el hueco libre (la hoja se abre o se recoge).
  function colocarEtiquetas() {
    if (!vistasEtiquetas || !vivo || mapa.getZoom() < ZOOM_ETIQUETAS) return;
    // Solo el hueco que dejan buscador, chips y hoja (y media etiqueta a los lados, para que quepa entera).
    const m = margenes(), tam = mapa.getSize(), no = mapa.containerPointToLatLng([m.paddingTopLeft[0] + MEDIA_ANCHURA_ETIQUETA, m.paddingTopLeft[1]]),
      se = mapa.containerPointToLatLng([tam.x - m.paddingBottomRight[0] - MEDIA_ANCHURA_ETIQUETA, tam.y - m.paddingBottomRight[1]]);
    etiquetas.poner(etiquetasDeVista({ archivos: vistasEtiquetas.archivos, bounds: [no.lng, se.lat, se.lng, no.lat], ctx: vistasEtiquetas.ctx }));
  }
  function pintarGruesas() {
    const clave = `${ui.fecha}|${ui.chip}|${salida.sello}|${version}`;
    if (clave === claveGruesas) return;   // mover el mapa lejos no cambia las celdas gruesas
    claveGruesas = clave;
    capaGruesa.clearLayers();
    const f = filtro();
    for (const g of rej.gruesa.celdas) {
      const color = colorDeNota(notaGruesa(g, { salida, fecha: ui.fecha, especies: especiesZona.get(g.zona) ?? [], filtro: f }));
      if (!color) continue;
      const [o, s, e, n] = limitesGruesa(g.id, rej.gruesa.pasos[g.zona]);
      // «Sin datos»: más claro y con borde punteado, para no confundirlo con «Nulo».
      const sinDatos = color === NIVEL_COLOR['sin-datos'];
      L.rectangle([[s, o], [n, e]], { pane: 'rejilla', stroke: sinDatos, color, weight: 1, dashArray: '3 3', fillColor: color,
        fillOpacity: (sinDatos ? ALFA_TRAMA : ALFA) / 255, interactive: false }).addTo(capaGruesa);
    }
  }

  // ---------- Capas superpuestas ----------
  const rellenas = new Set();
  async function rellenar(id) {
    if (id === 'lluvia') { pintarLluvia(); return; }
    if (rellenas.has(id)) return;
    rellenas.add(id);
    try {
      if (id === 'cotos' || id === 'prohibido') {
        const g = await cargarCotos();
        const col = { type: 'FeatureCollection', features: g.features.filter((f) => (f.properties.tipo === 'prohibido') === (id === 'prohibido')) };
        capas[id].addLayer(L.geoJSON(col, { style: (f) => estiloHalo(f.properties), interactive: false }));
        // El toque sigue al mapa (bubbling): dentro de un prohibido abre la hoja roja; en un coto, la hoja o su ficha.
        capas[id].addLayer(L.geoJSON(col, { style: (f) => estiloCoto(f.properties), onEachFeature: (f, c) => c.bindTooltip(el('span', { texto: f.properties.nombre }), { sticky: true }) }));
      } else if (id === 'sitios') pintarSitios();
      else if (id === 'diario') {
        const [{ supabase }, { listarSalidas }] = await Promise.all([import('../supabase.js'), import('../diario.js')]);
        pintarSalidas(capas.diario, await listarSalidas({ supabase }), datos);
      }
    } catch (e) {
      rellenas.delete(id);
      avisar(id === 'diario' ? 'No se han podido cargar las salidas del diario.' : e.message);
    }
  }
  function pintarLluvia() {
    capas.lluvia.clearLayers();
    if (salida) {
      for (const g of rej.gruesa.celdas) {
        const ag = agregadosDeCelda(salida, g.id, ui.fecha);
        if (ag?.P26 == null) continue;
        const [o, s, e, n] = limitesGruesa(g.id, rej.gruesa.pasos[g.zona]);
        // Interactivos para que el tooltip enseñe los mm; el toque sigue hasta el mapa (bubbling) y abre la hoja igual.
        L.rectangle([[s, o], [n, e]], { pane: 'lluvia', stroke: false, fillColor: COLOR.lluvia, fillOpacity: Math.min(0.45, ag.P26 / 200) })
          .bindTooltip(`${Math.round(ag.P26)} mm en 26 días`).addTo(capas.lluvia);
      }
      return;
    }
    for (const z of datos.zonas) for (const p of z.puntos) {
      const mm = lluvia26(estado.meteo?.series?.[p.id]);
      if (mm != null) L.circleMarker([p.lat, p.lon], { pane: 'lluvia', radius: radioLluvia(mm), weight: 2, color: COLOR.lluvia, fillColor: COLOR.lluvia, fillOpacity: 0.22, interactive: false }).addTo(capas.lluvia);
    }
  }
  function pintarSitios() {
    for (const s of datos.sitios ?? []) {
      if (typeof s.lat !== 'number' || typeof s.lon !== 'number') continue;
      const icon = L.divIcon({ className: '', html: '<span class="marcador-sitio"></span>', iconSize: [28, 28], iconAnchor: [14, 26], popupAnchor: [0, -24] });
      L.marker([s.lat, s.lon], { icon, title: s.nombre, keyboard: true })
        .bindPopup(() => el('div', { clase: 'mapa-popup' }, el('h3', { texto: s.nombre }), el('p', { clase: 'texto-2 texto-s', texto: s.municipio ?? '' }),
          el('p', { clase: 'mapa-popup__acciones' }, el('a', { clase: 'boton boton--compacto', href: urlComoLlegar(s.lat, s.lon), rel: 'noopener', target: '_blank', texto: 'Cómo llegar' }),
            el('a', { clase: 'boton boton--suave boton--compacto', href: `#zona/${encodeURIComponent(s.zona)}`, texto: 'Ver zona' }))), POPUP)
        .addTo(capas.sitios);
    }
  }
  async function activar(id, si) {
    if (!si) mapa.removeLayer(capas[id]); else capas[id].addTo(mapa);
    if (id === 'prohibido') ponerContornos();
    if (si) await rellenar(id);
  }
  function alCambiar(c) {
    if (c.fondo) { mapa.removeLayer(fondo); fondo = crearFondo(L, c.fondo).addTo(mapa); prefs.fondo = c.fondo; }
    if (c.capa) { prefs.activas = c.activa ? [...new Set([...prefs.activas, c.capa])] : prefs.activas.filter((x) => x !== c.capa); activar(c.capa, c.activa); }
    guardarPreferencias(prefs);
  }
  // panelCapas devuelve el foco a donde estaba (el botón Capas) al cerrarse con Escape o «Cerrar».
  function cerrarPanel() { panel.hidden = true; panel.replaceChildren(); botonCapas.setAttribute('aria-expanded', 'false'); }
  function abrirPanel() {
    panel.hidden = false;
    botonCapas.setAttribute('aria-expanded', 'true');
    panel.replaceChildren(panelCapas({ fondo: prefs.fondo, activas: prefs.activas, alCambiar, alCerrar: cerrarPanel }));
  }
  botonCapas.addEventListener('click', () => { if (panel.hidden) abrirPanel(); else { cerrarPanel(); botonCapas.focus(); } });
  for (const id of prefs.activas) activar(id, true);

  // ---------- Toque en el mapa: mancha, prohibido o vuelta a lo elegido ----------
  async function poligonoEn(lon, lat, cumple) {
    cotos ??= cargarCotos().then((g) => g.features.map((f) => ({ f, b: bboxDe(f.geometry) }))).catch((e) => { cotos = null; throw e; });
    for (const { f, b: [o, s, e, n] } of await cotos) if (lon >= o && lon <= e && lat >= s && lat <= n && cumple(f.properties) && puntoEnGeometria(lon, lat, f.geometry)) return f;
    return null;
  }
  function sobreponer(modelo, extra, latlng, enfocar) {
    if (!vivo) return;
    mapa.closePopup();
    sobrepuesto = { tipo: 'celda', modelo, extra, latlng };
    pintarAvisos();
    hoja.poner(modelo, extra, { enfocar });
  }
  // Fuera de una mancha (sin índice, lejos o sin monte apropiado), la hoja vuelve a lo elegido; con la capa Cotos
  // encendida, además, la ficha del coto en un popup.
  async function sinMancha(latlng, enfocar) {
    if (!vivo) return;
    if (sobrepuesto) { sobrepuesto = null; pintarAvisos(); pintarHoja(); }
    if (!enfocar || !mapa.hasLayer(capas.cotos)) return;
    const coto = await poligonoEn(latlng.lng, latlng.lat, (p) => p.tipo !== 'prohibido');
    if (coto && vivo) L.popup(POPUP).setLatLng(latlng).setContent(popupCoto(coto.properties, normas)).openOn(mapa);
  }
  async function tocar(latlng, { enfocar = true } = {}) {
    const mio = ++toque;
    const r = await resolverToque(latlng, { datos, normas, rej, salida, cargador, gruesasPorArchivo, especiesZona, fecha: ui.fecha, filtro: filtro(),
      zoom: mapa.getZoom(), conManchas: !!salida && !fechaSinIndice(), poligonoEn });
    if (mio !== toque || !vivo) return;   // otro toque, otra selección o la pantalla ya cerrada
    if (r) sobreponer(r.modelo, r.extra, latlng, enfocar); else await sinMancha(latlng, enfocar);
  }
  mapa.on('click', (e) => { tocar(e.latlng).catch((err) => avisar(err.message)); });

  // ---------- Ubicación ----------
  let yo = null;
  botonYo.addEventListener('click', () => {
    if (!navigator.geolocation) { avisar('Este dispositivo no da la ubicación.'); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      const ll = [p.coords.latitude, p.coords.longitude];
      yo?.remove();
      yo = L.circleMarker(ll, { pane: 'puntos', radius: 8, weight: 3, color: COLOR.halo, fillColor: COLOR.lluvia, fillOpacity: 1, interactive: false }).addTo(mapa);
      centrar(ll, Math.max(mapa.getZoom(), 13));
    }, () => avisar('No se pudo obtener la ubicación (¿permiso denegado?).'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
  // Mover o acercar el mapa nunca cambia la selección: solo qué chinchetas y qué manchas se ven.
  mapa.on('moveend', () => {
    if (encuadre || !medido()) return;
    const c = mapa.getCenter();
    ui.vista = { lat: c.lat, lon: c.lng, zoom: mapa.getZoom(), clave: claveSel };
    pintarAvisos();
    repintar();
    pintarChinchetas();
  });

  // El índice se publica a las 07 y a las 19: con el mapa abierto mucho rato se vuelve a pedir (cargarIndice usa su caché de 3 h).
  async function refrescarIndice() {
    if (!vivo || !rej || recargando || Date.now() - cargadoEn < TRES_HORAS) return;
    recargando = true;
    try {
      const nuevo = await cargarIndice();
      cargadoEn = Date.now();
      if (vivo && nuevo.salida && nuevo.salida.sello !== salida?.sello) { salida = nuevo.salida; imagenes.clear(); notasPor.clear(); ponerModo(); cambio(); }
    } finally { recargando = false; }
  }
  // Carga de la rejilla y del índice sin bloquear el montaje.
  if (!sinDescompresion) {
    Promise.all([cargarDatosRejilla().catch(() => null), cargarIndice()]).then(([r, ind]) => {
      cargandoLaderas = false; cargadoEn = Date.now();
      if (!vivo) return;
      if (r) { rej = r; capaRejilla = new CapaRejilla(); salida = ind?.salida ?? null; imagenes.clear(); notasPor.clear(); ponerModo(); }
      cambio();
    }).catch(() => { cargandoLaderas = false; if (vivo) cambio(); });
  }
  const reloj = setInterval(() => { refrescarIndice().catch(() => {}); }, 10 * 60e3);

  return {
    raiz,
    // Lo llama app.js al cambiar la ruta y al llegar la meteo, el contraste o los umbrales: solo un cambio de selección
    // encuadra, y solo un toque explícito previo enfoca la hoja.
    actualizar(nuevo) {
      if (nuevo.umbrales !== estado.umbrales) { imagenes.clear(); notasPor.clear(); version++; estado = nuevo; especiesZona = especiesPorZona(); } else estado = nuevo;
      const enfocar = enfocarPendiente;
      const cambiada = aplicarSeleccion();
      // El toque explícito pendiente se gasta con su ruta: también si resuelve a la misma selección (p. ej. un monte
      // desconocido), para que no enfoque más tarde, al llegar la meteo.
      const otraRuta = location.hash !== hashVisto;
      hashVisto = location.hash;
      if (cambiada || otraRuta) enfocarPendiente = false;
      cambio({ enfocar: enfocar && (cambiada || otraRuta) });
      refrescarIndice().catch(() => {});
    },
    destruir() {
      vivo = false; toque++; turno++;
      clearInterval(reloj);
      medida.disconnect();
      cerrarPanel();
      mapa._animatingZoom = false;   // Leaflet 1.9: remove() en mitad de una animación de zoom deja un temporizador que falla
      mapa.remove();
    },
  };
}

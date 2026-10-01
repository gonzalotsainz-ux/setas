// js/pantallas/mapa.js
// Pantalla «Mapa» (docs/superpowers/specs/2026-10-01-mapa-indice-design.md): pantalla completa al estilo de Google
// Maps. Manchas solo sobre monte apropiado con la nota por ladera (rejilla fina + índice precalculado en Supabase).
// Sin índice, sin red o sin DecompressionStream, los puntos de siempre con la nota de zona y un aviso (§3.4).
// Hoy, Zona y las fichas no cambian.
import { el, icono } from '../ui/dom.js';
import { cargarLeaflet, cargarCotos, popupCoto, notaPunto, estiloPunto, avisoOtroDia, NIVEL_COLOR, COLOR, estiloCoto, estiloHalo, pintarSalidas, radioLluvia } from '../mapa.js';
import { nivelDe, semaforo } from '../ui/semaforo.js';
import { especiesDeZona, nombreCorto } from '../datos.js';
import { hoyMadrid } from '../meteo.js';
import { aMercator, celdaFina, limitesGruesa, puntoEnGeometria, bboxDe } from '../rejilla/geo.js';
import { PROHIBIDO, CODIGO, FUERA_PROVINCIAS } from '../rejilla/formato.js';
import { cargarIndice, avisoIndice, diasDisponibles, cargarDatosRejilla, archivosVisibles, archivoDeCelda, crearCargadorRejillas,
  rejillasSoportadas, ZOOM_MIN_FINA } from '../rejilla/carga.js';
import { gruesasDeArchivo, colorear, notaGruesa, colorDeNota, ALFA, ALFA_TRAMA } from '../rejilla/pintor.js';
import { calcularNotas } from '../rejilla/notas-async.js';
import { notaCelda, corregirAltitud } from '../rejilla/nota.js';
import { agregadosDeCelda, serieLluvia } from '../rejilla/salida.js';
import { crearCapaRejilla } from '../mapa/capa-rejilla.js';
import { crearFondo, leerPreferencias, guardarPreferencias, panelCapas, SUPERPUESTAS } from '../mapa/fondos.js';
import { modeloHoja, abrirHojaMapa, urlComoLlegar } from '../mapa/hoja.js';
import { chipsDelDia, chipVigente, barraDias, buscarEnMapa, crearBuscador, cargarPueblos, avisosMapa } from '../mapa/controles.js';
import { desglose } from '../ui/desglose.js';
import { graficoLluvia } from '../ui/grafico-lluvia.js';

const MAX_IMAGENES = 12;             // imágenes coloreadas que se guardan (día × chip × archivo)
const TRES_HORAS = 3 * 3600e3;       // el índice se vuelve a pedir con el mapa abierto (misma caché que cargarIndice)
const POPUP = { minWidth: 200, maxWidth: 250, autoPanPaddingTopLeft: [16, 140], autoPanPaddingBottomRight: [72, 180] };
const ui = { fecha: null, chip: 'mejor', vista: null };   // se conserva al salir y volver
let montaje = null;

window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#mapa')) return;
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

function medirBarras(raiz) {
  const cab = document.querySelector('.cabecera'), nav = document.querySelector('.barra-nav');
  raiz.style.setProperty('--alto-cabecera', `${cab?.offsetHeight ?? 64}px`);
  raiz.style.setProperty('--alto-nav', `${(nav?.offsetHeight ?? 100) + 12}px`);
  raiz.style.setProperty('--alto-abajo', `${raiz.querySelector('.mapa-completo__abajo')?.offsetHeight ?? 56}px`);   // avisos + días: los controles de Leaflet van encima
}

async function montar(estadoInicial) {
  let estado = estadoInicial;
  const datos = estado.datos;
  const normas = new Map((datos.normativa ?? []).map((n) => [n.id, n]));
  const L = await cargarLeaflet();
  const prefs = leerPreferencias();

  // ---------- DOM ----------
  const lienzo = el('div', { clase: 'mapa-completo__lienzo', attrs: { role: 'region', 'aria-label': 'Mapa con las manchas donde es más probable encontrar setas' } });
  const anuncio = el('p', { clase: 'solo-lector', attrs: { 'aria-live': 'polite' } });
  const avisos = el('div', { clase: 'mapa-completo__avisos' });
  const chips = el('div', { clase: 'chips mapa-completo__chips', attrs: { role: 'group', 'aria-label': 'Especie' } });
  const dias = el('div', { clase: 'chips mapa-completo__dias', attrs: { role: 'group', 'aria-label': 'Día' } });
  const panel = el('div', { id: 'mapa-panel-capas', clase: 'mapa-completo__panel', hidden: true });
  const botonCapas = el('button', { type: 'button', clase: 'boton boton--suave boton--icono mapa-completo__boton', attrs: { 'aria-label': 'Capas', 'aria-expanded': 'false', 'aria-controls': 'mapa-panel-capas' } }, icono('i-capas'));
  const botonYo = el('button', { type: 'button', clase: 'boton boton--suave boton--icono mapa-completo__boton', attrs: { 'aria-label': 'Mi ubicación' } }, icono('i-ubicacion'));
  const buscador = crearBuscador({ buscar: (t) => buscarEnMapa(t, fuentesBusqueda()), alElegir: elegirResultado });
  // El lienzo va al final: el tabulador pasa antes por el buscador, los chips, Capas, Mi ubicación y los días que por
  // los polígonos del mapa (Leaflet hace enfocables los que llevan tooltip). Encima lo ponen los z-index.
  const raiz = el('div', { clase: 'mapa-completo' },
    el('div', { clase: 'mapa-completo__arriba' }, buscador.nodo, chips),
    el('div', { clase: 'mapa-completo__botones' }, botonCapas, botonYo), panel,
    el('div', { clase: 'mapa-completo__abajo' }, avisos, dias), anuncio, lienzo);
  medirBarras(raiz);

  // ---------- Mapa ----------
  const mapa = L.map(lienzo, { zoomControl: false, minZoom: 6, maxZoom: 18 });
  mapa.setView([40.4, -3.7], 6);
  L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(mapa);
  for (const [nombre, z] of [['rejilla', 350], ['lluvia', 420], ['puntos', 450]]) mapa.createPane(nombre).style.zIndex = z;
  let fondo = crearFondo(L, prefs.fondo).addTo(mapa);
  const capas = Object.fromEntries(Object.keys(SUPERPUESTAS).map((k) => [k, L.layerGroup()]));
  const puntos = L.layerGroup().addTo(mapa);
  const limitesZona = (z) => [[z.bbox[1], z.bbox[0]], [z.bbox[3], z.bbox[2]]];
  const todas = L.latLngBounds(datos.zonas.map(limitesZona).flat());
  const medido = () => lienzo.clientWidth > 0 && lienzo.clientHeight > 0;
  // Encuadre sin dejar nada bajo el buscador ni bajo los avisos y la barra inferior.
  const margenes = () => { const v = (n, d) => parseFloat(raiz.style.getPropertyValue(n)) || d;
    return { paddingTopLeft: [16, v('--alto-cabecera', 64) + 64], paddingBottomRight: [16, v('--alto-nav', 112) + v('--alto-abajo', 56) + 8], animate: false }; };
  let encuadre = ui.vista ? null : () => mapa.fitBounds(todas, margenes());
  if (ui.vista) mapa.setView([ui.vista.lat, ui.vista.lon], ui.vista.zoom);
  const encuadrar = (f) => { if (medido()) { encuadre = null; f(); } else encuadre = f; };
  const medida = new ResizeObserver(() => { medirBarras(raiz); mapa.invalidateSize(); if (encuadre && medido()) { const f = encuadre; encuadre = null; f(); } });
  medida.observe(lienzo);

  // ---------- Datos ----------
  // Sin DecompressionStream (Safari < 16.4) no se leen las rejillas: ni se pide el índice, modo de puntos con su aviso.
  const sinDescompresion = !rejillasSoportadas();
  const cargador = crearCargadorRejillas();
  // El mapa se monta ya en modo de puntos; la rejilla y el índice llegan después (con mala cobertura pueden tardar
  // decenas de segundos) y, al llegar, pasa a manchas. Ver la carga al final de montar().
  let rej = null, salida = null, cargadoEn = Date.now(), recargando = false, cargandoLaderas = !sinDescompresion;
  const CapaRejilla = crearCapaRejilla(L);
  let capaRejilla = null;   // se crea al llegar la rejilla y se añade al mapa solo con índice (lleva la atribución del MFE50 y del MDT)
  const capaGruesa = L.layerGroup().addTo(mapa);
  const contornos = L.layerGroup();   // contorno de los prohibidos en la vista lejana, aunque la capa Prohibido esté apagada
  let contornosPedidos = null;
  const imagenes = new Map(), gruesasPorArchivo = new Map();
  let vivo = true;   // false tras destruir(): lo que aún esté en curso (un toque, una descarga) ya no toca nada
  let turno = 0, toque = 0, version = 0, claveGruesas = null, enfocada = null, hoja = null, pueblos = [], cotos = null, error = null;
  // Los pueblos (data/pueblos.json) se piden al usar el buscador, no al abrir el mapa.
  let pidiendoPueblos = null;
  function pedirPueblos() {
    pidiendoPueblos ??= cargarPueblos().then((p) => {
      pueblos = p;
      if (vivo && document.activeElement === buscador.input && buscador.input.value) buscador.input.dispatchEvent(new Event('input'));
    }).catch(() => { pidiendoPueblos = null; });
  }
  buscador.input.addEventListener('focus', pedirPueblos);
  buscador.input.addEventListener('input', pedirPueblos);

  const especiesPorZona = () => { const m = new Map(); for (const z of datos.zonas) m.set(z.id, especiesDeZona(z, datos.especies, estado.umbrales ?? {})); return m; };
  let especiesZona = especiesPorZona();
  const hoy = () => hoyMadrid();
  const fechas = () => (salida ? diasDisponibles(salida, hoy()) : [hoy()]);
  const listaChips = () => chipsDelDia(datos.especies, ui.fecha ?? hoy());
  const filtro = () => { const c = listaChips().find((x) => x.id === ui.chip); return c?.especies ? new Set(c.especies) : null; };
  function ponerModo() {
    if (salida && capaRejilla && !mapa.hasLayer(capaRejilla)) capaRejilla.addTo(mapa);
    if (!salida && capaRejilla && mapa.hasLayer(capaRejilla)) mapa.removeLayer(capaRejilla);
  }
  ponerModo();

  // ---------- Controles ----------
  const chip = (clave, texto, pulsado, alPulsar, nota = null) => {
    const b = el('button', { type: 'button', clase: 'chip', attrs: { 'aria-pressed': String(pulsado), 'data-clave': clave } }, texto, nota ? el('span', { clase: 'chip__nota', texto: ` · ${nota}` }) : null);
    b.addEventListener('click', alPulsar);
    return b;
  };
  // Una fila de chips solo se rehace si cambia su contenido o el pulsado; si se rehace con el foco dentro, el foco pasa
  // al chip equivalente (misma especie o mismo día).
  function ponerFila(fila, items) {
    const firma = JSON.stringify(items.map((x) => [x.clave, x.texto, x.pulsado, x.nota]));
    if (fila.dataset.firma === firma) return;
    fila.dataset.firma = firma;
    const enfocado = fila.contains(document.activeElement) ? document.activeElement.dataset.clave : null;
    fila.replaceChildren(...items.map((x) => chip(x.clave, x.texto, x.pulsado, x.alPulsar, x.nota)));
    if (enfocado != null) [...fila.children].find((b) => b.dataset.clave === enfocado)?.focus({ preventScroll: true });
  }
  function pintarControles() {
    const fs = fechas();
    if (!fs.includes(ui.fecha)) ui.fecha = fs[0] ?? hoy();
    const lista = listaChips();
    ui.chip = chipVigente(ui.chip, lista);
    // Sin índice los puntos llevan la nota de zona (todas las especies): los chips no cambiarían nada y no se enseñan.
    ponerFila(chips, (salida ? lista : []).map((c) => ({ clave: c.id, texto: c.texto, pulsado: c.id === ui.chip, alPulsar: () => { ui.chip = c.id; cambio(); } })));
    chips.hidden = !salida;
    ponerFila(dias, (salida ? barraDias(fs, hoy(), ui.fecha) : []).map((d) => ({ clave: d.fecha, texto: d.texto, pulsado: d.pulsado,
      alPulsar: () => { ui.fecha = d.fecha; cambio(); }, nota: d.menosFiable ? 'menos fiable' : null })));
    dias.hidden = !salida;
  }
  // Puntos en «Nulo» (sin índice): su gris casi no se distingue del de «Sin datos» y el aviso lo explica.
  const puntosNulos = () => (salida ? 0 : datos.zonas.reduce((n, z) => n + z.puntos.filter((p) => nivelDe(notaPunto(z, p, datos, estado.meteo, estado.umbrales ?? {}).valor) === 'nulo').length, 0));
  function pintarAvisos() {
    const lista = avisosMapa({ puntosNulos: puntosNulos(), salida, sinDescompresion, cargando: cargandoLaderas, meteo: estado.meteo, otroDia: avisoOtroDia(estado.meteo), viejo: salida && avisoIndice(salida),
      diasDesdeHoy: fechas().indexOf(ui.fecha), zoom: mapa.getZoom(), error });
    avisos.replaceChildren(...lista.map(([i, t]) => el('div', { clase: 'aviso', attrs: { role: 'note' } }, icono(i), el('p', { texto: t }))));
    medirBarras(raiz);
  }
  const avisar = (t) => { if (!vivo) return; error = t; pintarAvisos(); };
  let claveVista = null;
  function cambio() {
    if (!vivo) return;
    error = null;
    pintarControles();
    // Las rejillas fuera de la vista no se quedan con el día o la especie de antes; si nada de eso cambia (llega la
    // meteo), no se vacían: así no parpadean.
    const clave = `${ui.fecha}|${ui.chip}|${salida?.sello}|${version}`;
    if (clave !== claveVista) { claveVista = clave; capaRejilla?.quitarTodo(); }
    pintarAvisos(); repintar();
    if (!salida) pintarPuntos(); else puntos.clearLayers();   // los puntos solo aquí: repintarlos al mover cerraría su popup
    if (mapa.hasLayer(capas.lluvia)) pintarLluvia();
    const c = listaChips().find((x) => x.id === ui.chip), d = barraDias(fechas(), hoy(), ui.fecha).find((x) => x.pulsado);
    const texto = salida ? `Mapa: ${c?.texto ?? 'Mejor hoy'}, ${d?.texto ?? 'hoy'}.` : 'Mapa: puntos de cada zona con su nota de hoy.';
    if (anuncio.textContent !== texto) anuncio.textContent = texto;   // el lector no lo repite en cada llegada de la meteo
  }

  // ---------- Pintado ----------
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
    if (!salida) { capaGruesa.clearLayers(); return; }
    const zoom = mapa.getZoom();
    if (zoom < ZOOM_MIN_FINA) { capaRejilla.quitarTodo(); pintarGruesas(); return; }
    capaGruesa.clearLayers(); claveGruesas = null;
    const b = mapa.getBounds(), f = filtro(), fecha = ui.fecha, chipActual = ui.chip;
    for (const a of archivosVisibles(rej.indice, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom)) {
      const clave = `${a.archivo}|${fecha}|${chipActual}|${salida.sello}|${version}`;
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
        imagenes.set(clave, rgba);
        if (imagenes.size > MAX_IMAGENES) imagenes.delete(imagenes.keys().next().value);
      }
      capaRejilla.ponerImagen(a.archivo, r.cabecera, rgba, clave);
    }
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
  // Si un popup de punto estaba abierto, se vuelve a abrir tras repintar (llega la meteo o cambian los umbrales).
  let puntoAbierto = null;
  function pintarPuntos() {
    const abierto = puntoAbierto;
    puntos.clearLayers();
    for (const z of datos.zonas) for (const p of z.puntos) {
      const nota = notaPunto(z, p, datos, estado.meteo, estado.umbrales ?? {});
      const marca = L.circleMarker([p.lat, p.lon], { pane: 'puntos', ...estiloPunto(nota.valor), bubblingMouseEvents: false });
      marca.bindPopup(() => el('div', { clase: 'mapa-popup' }, el('h3', { texto: p.nombre }), el('p', { clase: 'texto-2 texto-s', texto: nombreCorto(z) }),
          el('p', { clase: 'mapa-popup__etiquetas' }, semaforo(nota.valor, nota.fueraDeTemporada ? 'Fuera de temporada' : null),
            nota.valor == null ? null : el('b', { clase: 'tabular', texto: `${nota.valor}/100` })),
          el('p', { clase: 'mapa-popup__acciones' }, el('a', { clase: 'boton boton--compacto', href: `#zona/${encodeURIComponent(z.id)}`, texto: `Ver ${nombreCorto(z)}` }))), POPUP)
        .on('popupopen', () => { puntoAbierto = p.id; }).on('popupclose', () => { if (puntoAbierto === p.id) puntoAbierto = null; })
        .addTo(puntos);
      if (abierto === p.id) { puntoAbierto = p.id; marca.openPopup(); }
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
          .bindTooltip(`${Math.round(ag.P26)} mm en 26 días`).addTo(capas.lluvia);
      }
      return;
    }
    for (const z of datos.zonas) for (const p of z.puntos) {
      const nota = notaPunto(z, p, datos, estado.meteo, estado.umbrales ?? {});
      if (nota.mm != null) L.circleMarker([p.lat, p.lon], { pane: 'lluvia', radius: radioLluvia(nota.mm), weight: 2, color: COLOR.lluvia, fillColor: COLOR.lluvia, fillOpacity: 0.22, interactive: false }).addTo(capas.lluvia);
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

  // ---------- Toque en el mapa: hoja inferior ----------
  async function poligonoEn(lon, lat, cumple) {
    cotos ??= cargarCotos().then((g) => g.features.map((f) => ({ f, b: bboxDe(f.geometry) }))).catch((e) => { cotos = null; throw e; });
    for (const { f, b: [o, s, e, n] } of await cotos) if (lon >= o && lon <= e && lat >= s && lat <= n && cumple(f.properties) && puntoEnGeometria(lon, lat, f.geometry)) return f;
    return null;
  }
  const cerrarHoja = () => hoja?.cerrar();
  function abrir(modelo, extra = {}) {
    if (!vivo) return;
    if (!modelo) { cerrarHoja(); return; }
    mapa.closePopup();
    if (hoja) hoja.actualizar(modelo, extra);
    else hoja = abrirHojaMapa({ modelo, ...extra, alCerrar: () => { hoja = null; } });
  }
  const grafico = (celdaSalida) => () => { const fig = el('figure', { clase: 'grafico' }); fig.innerHTML = graficoLluvia({ serie: serieLluvia(celdaSalida), altura: 220 }); return fig; };
  // Fuera de una mancha (sin índice, lejos o sin monte apropiado) se ve la ficha del coto si la capa Cotos está encendida.
  async function sinMancha(latlng) {
    if (!vivo) return;
    cerrarHoja();
    if (!mapa.hasLayer(capas.cotos)) return;
    const coto = await poligonoEn(latlng.lng, latlng.lat, (p) => p.tipo !== 'prohibido');
    if (coto && vivo) L.popup(POPUP).setLatLng(latlng).setContent(popupCoto(coto.properties, normas)).openOn(mapa);
  }
  async function tocar(latlng) {
    const mio = ++toque, vigente = () => mio === toque;
    const lon = latlng.lng, lat = latlng.lat;
    const prohibido = await poligonoEn(lon, lat, (p) => p.tipo === 'prohibido');
    if (!vigente()) return;
    if (prohibido) { abrir(modeloHoja({ prohibido: prohibido.properties, normas })); return; }
    if (!salida || mapa.getZoom() < ZOOM_MIN_FINA) { await sinMancha(latlng); return; }
    const m = aMercator(lon, lat), c = celdaFina(m.x, m.y), a = archivoDeCelda(rej.indice, c.col, c.fila);
    if (!a) { await sinMancha(latlng); return; }
    const r = await cargador.cargar(a.archivo);
    if (!vigente()) return;
    const k = (c.fila - a.fila0) * a.ancho + (c.col - a.col0), h = r.habitat[k];
    // Marca de prohibido de la rejilla (centro o esquina dentro de un prohibido): hoja roja, nunca la de monte.
    if (h & PROHIBIDO) { abrir(modeloHoja({ prohibido: { nombre: 'Zona prohibida' }, normas })); return; }
    if (!(h & CODIGO)) { await sinMancha(latlng); return; }   // sin monte apropiado: no hay hoja de monte
    if (!gruesasPorArchivo.has(a.archivo)) gruesasPorArchivo.set(a.archivo, gruesasDeArchivo(r, rej.gruesa));
    const g = rej.gruesa.celdas[gruesasPorArchivo.get(a.archivo)[k]] ?? null;
    const celda = { habitat: r.cabecera.habitats[(h & CODIGO) - 1], altitud: r.altitud[k], orientacion: r.terreno[k] & 0x0f, tramo: r.terreno[k] >> 4,
      lat, lon, fueraProvincias: Boolean(h & FUERA_PROVINCIAS) };
    const enSalida = g && Object.hasOwn(salida.celdas, g.id) ? salida.celdas[g.id] : null;
    const ag = enSalida ? agregadosDeCelda(salida, g.id, ui.fecha) : null;
    const altRef = enSalida?.altRef;   // sin ella, la nota queda «sin datos», igual que la mancha gris
    const zona = datos.zonas.find((z) => z.id === r.cabecera.zona) ?? null;
    // La nota con la altitud en tramos de 10 m, igual que el pintor (así hoja y mancha coinciden); la exacta, en «Altitud».
    const altitud = Math.round(celda.altitud / 10) * 10;
    const nota = notaCelda({ ag, ...celda, altitud, altRef, especies: especiesZona.get(zona?.id) ?? [], fecha: ui.fecha, filtro: filtro() });
    if (nota.sinEspecies) { await sinMancha(latlng); return; }
    const coto = await poligonoEn(lon, lat, (p) => p.tipo !== 'prohibido');
    if (!vigente()) return;
    let agHoja = null;
    try { agHoja = ag && corregirAltitud(ag, altitud - altRef); } catch { agHoja = null; }
    abrir(modeloHoja({ celda, nota, ag: agHoja, coto: coto?.properties ?? null, zona }),
      { desglose: nota.resultado ? () => desglose(nota.resultado) : null, grafico: enSalida?.lluvia ? grafico(enSalida) : null });
  }
  mapa.on('click', (e) => { tocar(e.latlng).catch((err) => avisar(err.message)); });

  // ---------- Buscador y ubicación ----------
  function fuentesBusqueda() { return { pueblos, sitios: datos.sitios ?? [], especies: datos.especies, chips: salida ? listaChips() : [] }; }
  function elegirResultado(r) {
    if (r.tipo === 'chip') { ui.chip = r.id; cambio(); return; }
    mapa.setView([r.lat, r.lon], r.zoom);
  }
  let yo = null;
  botonYo.addEventListener('click', () => {
    if (!navigator.geolocation) { avisar('Este dispositivo no da la ubicación.'); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      const ll = [p.coords.latitude, p.coords.longitude];
      yo?.remove();
      yo = L.circleMarker(ll, { pane: 'puntos', radius: 8, weight: 3, color: COLOR.halo, fillColor: COLOR.lluvia, fillOpacity: 1, interactive: false }).addTo(mapa);
      mapa.setView(ll, Math.max(mapa.getZoom(), 13));
    }, () => avisar('No se pudo obtener la ubicación (¿permiso denegado?).'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
  mapa.on('moveend', () => {
    if (encuadre || !medido()) return;
    const c = mapa.getCenter();
    ui.vista = { lat: c.lat, lon: c.lng, zoom: mapa.getZoom() };
    pintarAvisos();
    repintar();
  });
  if (encuadre) encuadrar(encuadre);

  // El índice se publica a las 07 y a las 19: con el mapa abierto mucho rato se vuelve a pedir (cargarIndice usa su caché de 3 h).
  async function refrescarIndice() {
    if (!vivo || !rej || recargando || Date.now() - cargadoEn < TRES_HORAS) return;
    recargando = true;
    try {
      const nuevo = await cargarIndice();
      cargadoEn = Date.now();
      if (vivo && nuevo.salida && nuevo.salida.sello !== salida?.sello) { salida = nuevo.salida; imagenes.clear(); ponerModo(); cambio(); }
    } finally { recargando = false; }
  }
  // Carga de la rejilla y del índice sin bloquear el montaje.
  if (!sinDescompresion) {
    Promise.all([cargarDatosRejilla().catch(() => null), cargarIndice()]).then(([r, ind]) => {
      cargandoLaderas = false; cargadoEn = Date.now();
      if (!vivo) return;
      if (r) { rej = r; capaRejilla = new CapaRejilla(); salida = ind?.salida ?? null; imagenes.clear(); ponerModo(); }
      cambio();
    }).catch(() => { cargandoLaderas = false; if (vivo) cambio(); });
  }
  const reloj = setInterval(() => { refrescarIndice().catch(() => {}); }, 10 * 60e3);

  return {
    raiz,
    actualizar(nuevo, param) {
      if (nuevo.umbrales !== estado.umbrales) { imagenes.clear(); version++; estado = nuevo; especiesZona = especiesPorZona(); } else estado = nuevo;
      if (param && param !== enfocada) {
        const z = datos.zonas.find((x) => x.id === param);
        if (z) { enfocada = param; encuadrar(() => mapa.fitBounds(limitesZona(z), margenes())); }
      }
      cambio();
      refrescarIndice().catch(() => {});
    },
    destruir() {
      vivo = false; toque++; turno++;
      clearInterval(reloj);
      medida.disconnect();
      cerrarHoja();
      cerrarPanel();
      mapa._animatingZoom = false;   // Leaflet 1.9: remove() en mitad de una animación de zoom deja un temporizador que falla
      mapa.remove();
    },
  };
}

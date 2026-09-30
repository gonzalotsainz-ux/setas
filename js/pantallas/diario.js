// Pantalla «Diario»: salidas compartidas (sin login), alta con fotos y cola de borradores sin conexión.
import { el, icono } from '../ui/dom.js';
import { semaforo } from '../ui/semaforo.js';
import { comun } from '../ui/ficha.js';
import { nombreCorto } from '../datos.js';
import { hoyMadrid } from '../meteo.js';
import { crearMapa, fechaLarga } from '../mapa.js';
import { supabase, autorActual, elegirAutor } from '../supabase.js';
import { buscarEspecies } from './especies.js';
import { reducirFoto, aDataUrl } from '../fotos.js';
import { colaBorradores, sincronizar, crearSalida, borrarSalida, listarSalidas, urlFoto, totalKg, fotoFijaDelDia } from '../diario.js';

const MAX_FOTOS = 6;   // los borradores llevan las fotos en localStorage (~300 KB cada una)
const cola = colaBorradores();
const nombreEspecie = (datos, id) => { const e = datos.porId[id]; return e ? comun(e) : id; };
const nombreZona = (datos, id) => { const z = datos.zonas.find((x) => x.id === id); return z ? nombreCorto(z) : id; };
const kgTexto = (n) => `${String(Math.round(n * 100) / 100).replace('.', ',')} kg`;
const nuevaId = () => globalThis.crypto?.randomUUID?.() ?? `b${Date.now()}${Math.random().toString(16).slice(2)}`;

// ---------- Sincronización (carga, online, visibilitychange) ----------
const avisarCambio = () => window.dispatchEvent(new CustomEvent('diario-cambio'));
export async function sincronizarYa() {
  if (!cola.todos().length) return { subidas: 0, fallidas: 0 };
  const r = await sincronizar({ cola, subir: (b) => crearSalida(b, { supabase, persistir: (x) => cola.anadir(x) }) });
  if (r.subidas) avisarCambio();
  return r;
}
let iniciada = false;
export function iniciarSincronizacion() {
  if (iniciada) return;
  iniciada = true;
  window.addEventListener('online', sincronizarYa);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizarYa(); });
  sincronizarYa();
}

// ---------- Hojas inferiores ----------
const abiertas = new Set();
window.addEventListener('hashchange', () => { for (const h of [...abiertas]) h.cerrar(); });

function abrirHoja(titulo, { encima = false } = {}) {
  const previo = document.activeElement;
  const idTitulo = `hoja-${nuevaId()}`;
  const cuerpo = el('div', { clase: 'hoja__cuerpo' });
  const velo = el('div', { clase: `velo${encima ? ' velo--encima' : ''}` });
  const hoja = el('section', { clase: `hoja${encima ? ' hoja--encima' : ''}`, attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo } },
    el('div', { clase: 'hoja__cabeza' }, el('h2', { id: idTitulo, texto: titulo }),
      el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Cerrar', onclick: () => api.cerrar() })),
    cuerpo);
  const api = {
    cuerpo,
    cerrar() {
      if (!abiertas.delete(api)) return;
      document.removeEventListener('keydown', tecla);
      velo.remove(); hoja.remove();
      if (previo?.isConnected) previo.focus({ preventScroll: true });
      api.alCerrar?.();
    },
  };
  const tecla = (e) => { if (e.key === 'Escape' && [...abiertas].pop() === api) api.cerrar(); };
  document.addEventListener('keydown', tecla);
  velo.addEventListener('click', () => api.cerrar());
  document.body.append(velo, hoja);
  abiertas.add(api);
  requestAnimationFrame(() => { hoja.dataset.abierta = 'true'; hoja.querySelector('input, select, textarea, button:not(.boton--suave)')?.focus({ preventScroll: true }); });
  return api;
}

// «¿Quién eres?»: dos botones grandes y «Otro nombre». Devuelve el nombre elegido, o null si se cierra.
function preguntarAutor() {
  return new Promise((resolver) => {
    const hoja = abrirHoja('¿Quién eres?', { encima: true });
    let elegido = false;
    const elegir = (nombre) => {
      const n = elegirAutor(nombre);
      if (!n) return;
      elegido = true; resolver(n); hoja.cerrar();
    };
    hoja.alCerrar = () => { if (!elegido) resolver(null); };
    const otro = el('input', { type: 'text', id: 'otro-nombre', attrs: { autocomplete: 'given-name', maxlength: '40', enterkeyhint: 'done' } });
    const usar = () => elegir(otro.value);
    otro.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); usar(); } });
    hoja.cuerpo.append(
      el('p', { clase: 'texto-2', texto: 'Así se sabrá quién apuntó cada salida. Se guarda solo en este dispositivo.' }),
      el('div', { clase: 'autor-botones' },
        el('button', { type: 'button', clase: 'boton autor-boton', texto: 'Alejandra', onclick: () => elegir('Alejandra') }),
        el('button', { type: 'button', clase: 'boton autor-boton', texto: 'Gonzalo', onclick: () => elegir('Gonzalo') })),
      el('div', { clase: 'campo' }, el('label', { htmlFor: 'otro-nombre', texto: 'Otro nombre' }), otro),
      el('button', { type: 'button', clase: 'boton boton--suave', texto: 'Usar este nombre', onclick: usar }));
  });
}

// ---------- Hoja «Nueva salida» ----------
function hojaNuevaSalida({ estado, alGuardar }) {
  const datos = estado.datos;
  const hoja = abrirHoja('Nueva salida');
  let punto = null, mapaElegir = null, marcador = null;
  const especies = [];   // [{ especie_id, kg }]
  const fotos = [];      // [{ dataUrl, ancho, alto }]
  hoja.alCerrar = () => { mapaElegir?.destruir(); mapaElegir = null; };

  const fecha = el('input', { type: 'date', id: 'sal-fecha', value: hoyMadrid(), max: hoyMadrid(), required: true });
  const zona = el('select', { id: 'sal-zona', required: true },
    el('option', { value: '', texto: 'Elige la zona' }),
    datos.zonas.map((z) => el('option', { value: z.id, texto: nombreCorto(z) })));

  // Punto en el mapa
  const textoPunto = el('p', { clase: 'texto-2 texto-s', attrs: { 'aria-live': 'polite' } });
  const contenedorMapa = el('div', { clase: 'mapa mapa--elegir', hidden: true, attrs: { role: 'region', 'aria-label': 'Toca el mapa para marcar dónde fue la salida' } });
  const pintarPunto = () => {
    textoPunto.textContent = punto ? `Punto marcado: ${punto.lat.toFixed(4)}, ${punto.lon.toFixed(4)}` : 'Sin punto marcado: se usará la meteo del punto más cercano de la zona.';
    quitarPunto.hidden = !punto;
  };
  const ponerPunto = (lat, lon) => {
    punto = { lat, lon };
    if (mapaElegir && window.L) {
      if (marcador) marcador.setLatLng([lat, lon]); else marcador = window.L.marker([lat, lon]).addTo(mapaElegir.mapa);
    }
    pintarPunto();
  };
  const quitarPunto = el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Quitar punto', hidden: true, onclick: () => { punto = null; marcador?.remove(); marcador = null; pintarPunto(); } });
  const botonMapa = el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Marcar en el mapa', attrs: { 'aria-expanded': 'false' } });
  botonMapa.addEventListener('click', async () => {
    const abrir = contenedorMapa.hidden;
    contenedorMapa.hidden = !abrir;
    botonMapa.setAttribute('aria-expanded', String(abrir));
    if (!abrir || mapaElegir) { if (abrir) enfocarZona(); return; }
    try {
      mapaElegir = await crearMapa(contenedorMapa, { capas: [], datos, meteo: null });
      mapaElegir.mapa.on('click', (e) => ponerPunto(e.latlng.lat, e.latlng.lng));
      enfocarZona();
      if (punto) ponerPunto(punto.lat, punto.lon);
    } catch (e) { textoPunto.textContent = e.message; }
  });
  const enfocarZona = () => { if (punto && mapaElegir) mapaElegir.mapa.setView([punto.lat, punto.lon], 13); else if (zona.value) mapaElegir?.enfocarZona(zona.value); };
  zona.addEventListener('change', () => { if (!punto) enfocarZona(); });
  const botonUbicacion = el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Usar mi ubicación' });
  botonUbicacion.addEventListener('click', () => {
    if (!navigator.geolocation) { textoPunto.textContent = 'Este dispositivo no da la ubicación.'; return; }
    textoPunto.textContent = 'Buscando tu ubicación…';
    navigator.geolocation.getCurrentPosition(
      (p) => { ponerPunto(p.coords.latitude, p.coords.longitude); if (mapaElegir) mapaElegir.mapa.setView([p.coords.latitude, p.coords.longitude], 13); },
      () => { textoPunto.textContent = 'No se pudo obtener la ubicación (¿permiso denegado?). Puedes marcarla en el mapa.'; },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });

  // Especies: buscador + kg por especie
  const busca = el('input', { type: 'search', id: 'sal-buscar', placeholder: 'Nombre, sinónimo o euskera', attrs: { autocomplete: 'off', enterkeyhint: 'search' } });
  const resultados = el('ul', { clase: 'diario-resultados', attrs: { 'aria-label': 'Resultados de la búsqueda' } });
  const elegidas = el('ul', { clase: 'diario-elegidas' });
  const pintarElegidas = () => elegidas.replaceChildren(...especies.map((s) => {
    const kg = el('input', { type: 'number', inputMode: 'decimal', min: '0', step: '0.1', value: s.kg ?? '', placeholder: 'kg', attrs: { 'aria-label': `Kilos de ${nombreEspecie(datos, s.especie_id)}` } });
    kg.addEventListener('input', () => { s.kg = kg.value === '' ? null : Number(kg.value); });
    return el('li', {}, el('span', { clase: 'diario-elegidas__nombre', texto: nombreEspecie(datos, s.especie_id) }), kg, el('span', { texto: 'kg' }),
      el('button', { type: 'button', clase: 'boton boton--suave boton--icono', attrs: { 'aria-label': `Quitar ${nombreEspecie(datos, s.especie_id)}` }, onclick: () => { especies.splice(especies.indexOf(s), 1); pintarElegidas(); } }, '×'));
  }));
  busca.addEventListener('input', () => {
    const q = busca.value.trim();
    if (!q) { resultados.replaceChildren(); return; }
    const libres = buscarEspecies(q, datos.especies).filter((e) => !especies.some((s) => s.especie_id === e.id)).slice(0, 6);
    resultados.replaceChildren(...(libres.length ? libres.map((e) => el('li', {}, el('button', { type: 'button', clase: 'diario-resultado', onclick: () => {
      especies.push({ especie_id: e.id, kg: null }); busca.value = ''; resultados.replaceChildren(); pintarElegidas();
      elegidas.querySelector('li:last-child input')?.focus();
    } }, el('span', { texto: comun(e) }), el('span', { clase: 'latin texto-2', texto: e.nombre })))) : [el('li', { clase: 'texto-2 texto-s', texto: 'Sin resultados' })]));
  });

  // Fotos
  const estadoFotos = el('p', { clase: 'texto-2 texto-s', attrs: { 'aria-live': 'polite' } });
  const miniaturas = el('ul', { clase: 'diario-miniaturas' });
  const pintarMiniaturas = () => miniaturas.replaceChildren(...fotos.map((f, k) => el('li', {},
    el('img', { src: f.dataUrl, alt: `Foto ${k + 1} de la salida`, width: f.ancho, height: f.alto }),
    el('button', { type: 'button', clase: 'diario-miniaturas__quitar', attrs: { 'aria-label': `Quitar la foto ${k + 1}` }, onclick: () => { fotos.splice(k, 1); pintarMiniaturas(); } }, '×'))));
  async function anadirFotos(archivos) {
    for (const f of archivos) {
      if (fotos.length >= MAX_FOTOS) { estadoFotos.textContent = `Máximo ${MAX_FOTOS} fotos por salida.`; break; }
      estadoFotos.textContent = 'Preparando foto…';
      try {
        const r = await reducirFoto(f);
        fotos.push({ dataUrl: await aDataUrl(r.blob), ancho: r.ancho, alto: r.alto });
        estadoFotos.textContent = '';
      } catch (e) { estadoFotos.textContent = `No se pudo preparar una foto: ${e.message}`; }
    }
    pintarMiniaturas();
  }
  const entrada = (capture) => {
    const i = el('input', { type: 'file', multiple: true, accept: 'image/*', hidden: true, attrs: capture ? { capture: 'environment' } : {} });
    i.addEventListener('change', async () => { const a = [...i.files]; i.value = ''; await anadirFotos(a); });
    return i;
  };
  const dePhoto = entrada(true), deGaleria = entrada(false);

  const notas = el('textarea', { id: 'sal-notas', rows: 3, attrs: { maxlength: '2000' } });
  const estadoGuardar = el('p', { clase: 'texto-s', attrs: { role: 'alert' } });
  const guardar = el('button', { type: 'submit', clase: 'boton', texto: 'Guardar salida' });

  const form = el('form', { clase: 'diario-form', noValidate: true },
    el('div', { clase: 'campo' }, el('label', { htmlFor: 'sal-fecha', texto: 'Fecha' }), fecha),
    el('div', { clase: 'campo' }, el('label', { htmlFor: 'sal-zona', texto: 'Zona' }), zona),
    el('fieldset', { clase: 'diario-grupo' }, el('legend', { texto: 'Dónde (opcional)' }),
      el('div', { clase: 'diario-fila' }, botonUbicacion, botonMapa, quitarPunto), textoPunto, contenedorMapa),
    el('fieldset', { clase: 'diario-grupo' }, el('legend', { texto: 'Qué encontraste' }),
      el('div', { clase: 'campo' }, el('label', { htmlFor: 'sal-buscar', texto: 'Buscar especie' }), busca), resultados, elegidas),
    el('fieldset', { clase: 'diario-grupo' }, el('legend', { texto: 'Fotos' }),
      el('div', { clase: 'diario-fila' },
        el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Hacer foto', onclick: () => dePhoto.click() }),
        el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Desde la galería', onclick: () => deGaleria.click() })),
      dePhoto, deGaleria, estadoFotos, miniaturas),
    el('div', { clase: 'campo' }, el('label', { htmlFor: 'sal-notas', texto: 'Notas' }), notas),
    estadoGuardar, guardar);
  pintarPunto();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!fecha.value || !zona.value) { estadoGuardar.textContent = 'Indica la fecha y la zona.'; (fecha.value ? zona : fecha).focus(); return; }
    guardar.disabled = true;
    try {
      const autor = autorActual() ?? await preguntarAutor();
      if (!autor) { estadoGuardar.textContent = 'Di quién eres para guardar la salida.'; return; }
      const z = datos.zonas.find((x) => x.id === zona.value);
      const foto = fotoFijaDelDia({ zona: z, lat: punto?.lat, lon: punto?.lon, datos, meteo: estado.meteo, umbrales: estado.umbrales ?? {} });
      const borrador = {
        id: nuevaId(), fecha: fecha.value, zona_id: zona.value, lat: punto?.lat ?? null, lon: punto?.lon ?? null,
        especies: especies.map((s) => ({ especie_id: s.especie_id, kg: s.kg })), notas: notas.value.trim(), autor,
        meteo: foto.meteo, indice: foto.indice, fotos: fotos.map((f) => ({ ...f })),
      };
      cola.anadir(borrador);
      hoja.cerrar();
      alGuardar(borrador);
    } catch (e) { estadoGuardar.textContent = `No se pudo guardar: ${e.message}`; } finally { guardar.disabled = false; }
  });
  hoja.cuerpo.append(form);
}

// ---------- Lista ----------
function miniaturasDe(urls, etiqueta) {
  if (!urls.length) return null;
  return el('ul', { clase: 'diario-miniaturas diario-miniaturas--lista' }, urls.map((u, k) => el('li', {},
    el('a', { href: u.grande, target: '_blank', rel: 'noopener', attrs: { 'aria-label': `${etiqueta}: foto ${k + 1} (se abre ampliada)` } },
      el('img', { src: u.mini, alt: '', loading: 'lazy', decoding: 'async' })))));
}
function listaEspecies(datos, especies) {
  if (!especies?.length) return el('p', { clase: 'texto-2 texto-s', texto: 'Sin especies apuntadas.' });
  return el('ul', { clase: 'diario-especies' }, especies.map((e) => el('li', {}, el('span', { texto: nombreEspecie(datos, e.especie_id) }),
    e.kg != null && e.kg !== '' ? el('span', { clase: 'tabular', texto: kgTexto(Number(e.kg)) }) : null)));
}

function tarjetaPendiente(b, datos, { reintentar, descartar }) {
  return el('li', { clase: 'tarjeta diario-salida diario-salida--pendiente' },
    el('div', { clase: 'diario-salida__cabeza' }, el('h3', { texto: fechaLarga(b.fecha) }), el('span', { clase: 'etiqueta etiqueta--ocre', texto: 'Pendiente de subir' })),
    el('p', { clase: 'texto-2 texto-s', texto: `${nombreZona(datos, b.zona_id)} · ${b.fotos?.length ?? 0} foto${b.fotos?.length === 1 ? '' : 's'}${b.remotoId ? ' · subida a medias' : ''}` }),
    listaEspecies(datos, b.especies),
    miniaturasDe((b.fotos ?? []).map((f) => ({ mini: f.dataUrl, grande: f.dataUrl })), 'Borrador'),
    el('div', { clase: 'diario-fila' },
      el('button', { type: 'button', clase: 'boton boton--compacto', texto: 'Subir ahora', onclick: reintentar }),
      el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Descartar', onclick: () => { if (confirm('¿Descartar este borrador? No se ha subido y se perderá.')) descartar(); } })));
}

function comparacionIndice(s) {
  const v = s.indice?.valor;
  const kg = totalKg(s.especies);
  if (v == null) return el('p', { clase: 'texto-2 texto-s', texto: `Ese día no hubo previsión guardada.${kg ? ` Recogisteis ${kgTexto(kg)}.` : ''}` });
  return el('p', { clase: 'diario-indice texto-s' }, 'Nota del índice ese día: ', semaforo(v), el('b', { clase: 'tabular', texto: ` ${v}/100` }),
    kg ? ` · recogido: ${kgTexto(kg)}` : ' · sin kilos apuntados');
}

function tarjetaSalida(s, datos, { borrar }) {
  const yo = autorActual();
  const autor = !s.autor ? null : (yo && s.autor === yo ? 'Tú' : s.autor);
  const urls = (s.fotos ?? []).slice().sort((a, b) => a.ruta.localeCompare(b.ruta, 'es', { numeric: true })).map((f) => { const u = urlFoto(f.ruta, { supabase }); return { mini: u, grande: u }; });
  return el('li', { clase: 'tarjeta diario-salida' },
    el('div', { clase: 'diario-salida__cabeza' }, el('h3', { texto: fechaLarga(s.fecha) }), autor ? el('span', { clase: 'etiqueta', texto: autor }) : null),
    el('p', { clase: 'texto-2 texto-s', texto: nombreZona(datos, s.zona_id) }),
    listaEspecies(datos, s.especies),
    miniaturasDe(urls, `Salida del ${fechaLarga(s.fecha)}`),
    s.notas ? el('p', { clase: 'diario-notas', texto: s.notas }) : null,
    comparacionIndice(s),
    el('div', { clase: 'diario-fila' },
      typeof s.lat === 'number' && typeof s.lon === 'number' ? el('a', { clase: 'boton boton--suave boton--compacto', href: '#mapa', texto: 'Ver en el mapa' }) : null,
      el('button', { type: 'button', clase: 'boton boton--suave boton--compacto boton--borrar', texto: 'Borrar', onclick: () => { if (confirm('¿Borrar esta salida y sus fotos? No se puede deshacer.')) borrar(); } })));
}

// ---------- Pantalla ----------
// La app repinta la pantalla cuando llega la previsión: el mensaje de resultado y las tareas en vuelo
// deben sobrevivir, así que se guardan fuera del pintado y siempre apuntan a la pantalla viva.
let viva = null, ultimoMensaje = null;
function mensaje(texto, { peligro = false } = {}) {
  ultimoMensaje = { texto, peligro, hasta: Date.now() + 20000 };
  viva?.mostrarMensaje();
}
async function alGuardar(borrador) {
  mensaje('Guardando…');
  viva?.pintarPendientes(); viva?.pintarAutor();
  await sincronizarYa();
  const sigue = cola.todos().some((b) => b.id === borrador.id);
  if (!cola.persistente && sigue) mensaje('Sin espacio local: no cierres la app hasta que se suba.', { peligro: true });
  else mensaje(sigue ? 'Guardada en el móvil; se subirá al recuperar conexión.' : 'Subida ✓');
  viva?.refrescar();
}

export function pintar({ estado }) {
  iniciarSincronizacion();
  const datos = estado.datos;
  const raiz = el('div', { clase: 'pila diario' });
  const autorLinea = el('p', { clase: 'diario-autor' });
  const pintarAutor = () => {
    const a = autorActual();
    autorLinea.replaceChildren(a ? el('span', {}, 'Apuntas como ', el('b', { texto: a })) : el('span', { clase: 'texto-2', texto: 'Aún no has dicho quién eres.' }),
      el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: a ? 'Cambiar' : 'Elegir', onclick: async () => { await preguntarAutor(); pintarAutor(); refrescar(); } }));
  };
  const resultado = el('div', { attrs: { role: 'status', 'aria-live': 'polite' } });
  const listaPend = el('ul', { clase: 'diario-lista' });
  const listaSal = el('ul', { clase: 'diario-lista' });
  const vacio = el('p', { clase: 'tarjeta texto-2', texto: 'Aún no hay salidas. Pulsa «Nueva salida» para apuntar la primera.', hidden: true });
  const actualizarVacio = () => { vacio.hidden = !(cache && !cache.length && !cola.todos().length); };
  const cargando = el('div', { clase: 'esqueleto', attrs: { 'aria-label': 'Cargando salidas' } });
  const avisoRed = el('div');
  let cache = null, ficha = 0;

  const mostrarMensaje = () => {
    if (!ultimoMensaje || ultimoMensaje.hasta < Date.now()) { resultado.replaceChildren(); return; }
    const { texto, peligro } = ultimoMensaje;
    resultado.replaceChildren(el('div', { clase: peligro ? 'aviso-peligro' : 'aviso' }, icono('i-aviso'), el('p', { texto })));
  };

  async function subirPendientes() {
    const r = await sincronizarYa();
    refrescar();
    return r;
  }
  function pintarPendientes() {
    const pend = cola.todos();
    listaPend.replaceChildren(...pend.map((b) => tarjetaPendiente(b, datos, {
      reintentar: async () => { const r = await subirPendientes(); mensaje(r.fallidas ? 'Sigue sin conexión: se subirá al recuperarla.' : 'Subida ✓'); },
      descartar: () => { cola.quitar(b.id); pintarPendientes(); },
    })));
    actualizarVacio();
    if (!cola.persistente) mensaje('Sin espacio local: no cierres la app hasta que se suba.', { peligro: true });
  }
  function pintarSalidas() {
    listaSal.replaceChildren(...(cache ?? []).map((s) => tarjetaSalida(s, datos, {
      borrar: async () => {
        try { await borrarSalida(s.id, { supabase }); mensaje('Salida borrada.'); await refrescar(); }
        catch (e) { mensaje(`No se pudo borrar: ${e.message}`, { peligro: true }); }
      },
    })));
    actualizarVacio();
  }
  async function refrescar() {
    const mi = ++ficha;
    pintarPendientes();
    try {
      const salidas = await listarSalidas({ supabase });
      if (mi !== ficha) return;
      cache = salidas; avisoRed.replaceChildren();
    } catch (e) {
      if (mi !== ficha) return;
      avisoRed.replaceChildren(el('div', { clase: 'aviso' }, icono('i-aviso'),
        el('div', {}, el('p', { texto: `No se pudo cargar el diario (${e.message}). Comprueba la conexión.` }),
          el('button', { type: 'button', clase: 'boton boton--compacto', texto: 'Reintentar', onclick: refrescar }))));
    }
    cargando.remove();
    pintarSalidas();
  }

  const alCambio = () => { if (!raiz.isConnected) window.removeEventListener('diario-cambio', alCambio); else refrescar(); };
  window.addEventListener('diario-cambio', alCambio);

  viva = { mostrarMensaje, pintarPendientes, pintarAutor, refrescar };
  pintarAutor();
  mostrarMensaje();
  raiz.append(
    el('div', { clase: 'diario-cabeza' }, el('h1', { texto: 'Diario' }),
      el('button', { type: 'button', clase: 'boton', texto: 'Nueva salida', onclick: () => hojaNuevaSalida({ estado, alGuardar }) })),
    autorLinea, resultado, avisoRed, listaPend, cargando, listaSal, vacio);
  refrescar();
  return raiz;
}

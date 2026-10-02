// Pantalla «Diario»: mis salidas (cada una es de su dueño, con perfil), alta con fotos, compartir con grupos,
// reclamo de las salidas anteriores a los perfiles y cola de borradores sin conexión.
import { el, icono } from '../ui/dom.js';
import { semaforo } from '../ui/semaforo.js';
import { comun } from '../ui/ficha.js';
import { nombreCorto } from '../datos.js';
import { hoyMadrid } from '../meteo.js';
import { crearMapa, fechaLarga } from '../mapa.js';
import { supabase, autorActual } from '../supabase.js';
import { buscarEspecies } from './especies.js';
import { reducirFoto, aDataUrl } from '../fotos.js';
import { colaBorradores, sincronizar, crearSalida, borrarSalida, listarSalidas, guardarComparticion, totalKg, fotoFijaDelDia, nuevaId, prepararFotosBorrador, cabeEnPresupuesto, leerNuevaSalida } from '../diario.js';
import { almacenIndexedDB } from '../almacen-fotos.js';
import { abrirHoja } from '../ui/hoja.js';
import { selectorGrupos } from '../ui/compartir.js';
import { cuentaActual, requerirCuenta, errorDeCuenta } from './cuenta-ui.js';
import { misGrupos, salidasSinDueno, reclamarSalidas } from '../grupos.js';
import { textoError } from '../cuenta.js';

const MAX_FOTOS = 6;
const cola = colaBorradores();
const almacenFotos = almacenIndexedDB();   // las fotos de los borradores van a IndexedDB; en localStorage solo metadatos
const nombreEspecie = (datos, id) => { const e = datos.porId[id]; return e ? comun(e) : id; };
const nombreZona = (datos, id) => { const z = datos.zonas.find((x) => x.id === id); return z ? nombreCorto(z) : id; };
const kgTexto = (n) => `${String(Math.round(n * 100) / 100).replace('.', ',')} kg`;
const AVISO_SIN_ESPACIO = 'Sin espacio local: no cierres la app hasta que se suba.';
const quitarFotosLocales = (b) => Promise.all((b.fotos ?? []).filter((f) => f.clave).map((f) => almacenFotos.borrar(f.clave).catch(() => {})));

// ---------- Sincronización (carga, online, visibilitychange) ----------
const avisarCambio = () => window.dispatchEvent(new CustomEvent('diario-cambio'));
export async function sincronizarYa() {
  if (!cola.todos().length) return { subidas: 0, fallidas: 0 };
  const cuenta = await cuentaActual();
  if (!cuenta) return { subidas: 0, fallidas: 0, sinPerfil: true };   // borradores anteriores a las cuentas: esperan a que haya perfil
  const r = await sincronizar({ cola, subir: (b) => crearSalida(b, { supabase, persistir: (x) => cola.actualizar(x), almacenFotos, usuarioId: cuenta.id }) });
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

// ---------- Hoja «Nueva salida» ----------
function hojaNuevaSalida({ estado, alGuardar, inicial = null }) {
  const datos = estado.datos;
  const hoja = abrirHoja('Nueva salida');
  let punto = null, mapaElegir = null, marcador = null;
  const especies = [];   // [{ especie_id, kg }]
  const fotos = [];      // [{ blob, dataUrl, ancho, alto }]
  let hayAlmacen = false, preparando = 0, guardando = false;
  almacenFotos.disponible().then((v) => { hayAlmacen = v; });
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
  const actualizarBoton = () => { guardar.disabled = guardando || preparando > 0; };
  async function anadirFotos(archivos) {
    preparando++; actualizarBoton();
    try {
      for (const f of archivos) {
        if (fotos.length >= MAX_FOTOS) { estadoFotos.textContent = `Máximo ${MAX_FOTOS} fotos por salida.`; break; }
        estadoFotos.textContent = 'Preparando foto…';
        try {
          const r = await reducirFoto(f);
          const nueva = { blob: r.blob, dataUrl: await aDataUrl(r.blob), ancho: r.ancho, alto: r.alto };
          if (!hayAlmacen && !cabeEnPresupuesto(fotos, nueva)) { estadoFotos.textContent = 'No caben más fotos en la memoria de este dispositivo.'; break; }
          fotos.push(nueva);
          estadoFotos.textContent = '';
        } catch (e) { estadoFotos.textContent = `No se pudo preparar una foto: ${e.message}`; }
      }
    } finally { preparando--; actualizarBoton(); pintarMiniaturas(); }
  }
  const entrada = (capture) => {
    const i = el('input', { type: 'file', multiple: true, accept: 'image/*', hidden: true, attrs: capture ? { capture: 'environment' } : {} });
    i.addEventListener('change', async () => { const a = [...i.files]; i.value = ''; await anadirFotos(a); });
    return i;
  };
  const dePhoto = entrada(true), deGaleria = entrada(false);

  // Compartir con grupos (opcional): se cargan los grupos del perfil.
  const compartirCaja = el('fieldset', { clase: 'diario-grupo' }, el('legend', { texto: 'Compartir con tus grupos (opcional)' }));
  let selector = null;
  (async () => {
    try {
      if (!(await cuentaActual())) {
        const sinRed = !!errorDeCuenta();
        compartirCaja.append(el('p', { clase: 'texto-2 texto-s', texto: sinRed ? 'Sin conexión: la salida se guardará privada y se subirá al volver la red.' : 'Al guardar te pediremos crear tu perfil; después podrás compartir con grupos.' }));
        return;
      }
      const grupos = await misGrupos({ supabase });
      if (!grupos.length) { compartirCaja.append(el('p', { clase: 'texto-2 texto-s' }, 'No estás en ningún grupo. ', el('a', { href: '#grupos', texto: 'Crear o unirme a uno' }))); return; }
      selector = selectorGrupos({ grupos });
      compartirCaja.append(selector.nodo);
    } catch { compartirCaja.append(el('p', { clase: 'texto-2 texto-s', texto: 'No se pudieron cargar tus grupos: la salida se guardará privada.' })); }
  })();

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
    compartirCaja,
    el('div', { clase: 'campo' }, el('label', { htmlFor: 'sal-notas', texto: 'Notas' }), notas),
    estadoGuardar, guardar);
  pintarPunto();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!fecha.value || !zona.value) { estadoGuardar.textContent = 'Indica la fecha y la zona.'; (fecha.value ? zona : fecha).focus(); return; }
    if (guardando || preparando) return;
    guardando = true; actualizarBoton();
    try {
      let cuenta = null, sinVerificar = false;
      try { cuenta = await requerirCuenta(); } catch (e) {
        // Sin red no se puede comprobar el perfil: con un nombre ya guardado en el móvil la salida se apunta igualmente
        // (privada); el dueño se toma de la sesión al subirla y los borradores esperan a que el perfil esté confirmado.
        if (!autorActual()) { estadoGuardar.textContent = e.message; return; }
        sinVerificar = true;
      }
      if (!cuenta && !sinVerificar) { estadoGuardar.textContent = 'Crea tu perfil para guardar la salida.'; return; }
      const z = datos.zonas.find((x) => x.id === zona.value);
      const foto = fotoFijaDelDia({ zona: z, lat: punto?.lat, lon: punto?.lon, fecha: fecha.value, datos, meteo: estado.meteo, umbrales: estado.umbrales ?? {} });
      const id = nuevaId();
      let prep;
      try { prep = await prepararFotosBorrador(id, fotos, { almacen: almacenFotos }); } catch (e) { estadoGuardar.textContent = e.message; return; }
      const borrador = {
        id, fecha: fecha.value, zona_id: zona.value, lat: punto?.lat ?? null, lon: punto?.lon ?? null,
        especies: especies.map((s) => ({ especie_id: s.especie_id, kg: s.kg })), notas: notas.value.trim(), autor: cuenta ? cuenta.nombre : autorActual(), grupos: cuenta ? (selector?.valor() ?? []) : [],
        meteo: foto.meteo, indice: foto.indice, fotos: prep.fotos,
      };
      const guardado = cola.anadir(borrador);
      alGuardar(borrador);
      if (guardado) { hoja.cerrar(); return; }
      // No se pudo guardar en el móvil: el aviso se ve ANTES de cerrar la hoja
      estadoGuardar.textContent = AVISO_SIN_ESPACIO;
      estadoGuardar.className = 'texto-s aviso-peligro';
      guardar.textContent = 'Entendido';
      guardar.type = 'button';
      guardar.onclick = () => hoja.cerrar();
      return;
    } catch (e) { estadoGuardar.textContent = `No se pudo guardar: ${e.message}`; } finally { guardando = false; actualizarBoton(); }
  });
  // Abierta desde el mapa («Guardar en el diario»): zona y punto ya elegidos.
  if (inicial?.zona && datos.zonas.some((z) => z.id === inicial.zona)) zona.value = inicial.zona;
  if (inicial?.lat != null) ponerPunto(inicial.lat, inicial.lon);
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
  if (!Array.isArray(especies) || !especies.length) return el('p', { clase: 'texto-2 texto-s', texto: 'Sin especies apuntadas.' });
  return el('ul', { clase: 'diario-especies' }, especies.map((e) => el('li', {}, el('span', { texto: nombreEspecie(datos, e.especie_id) }),
    e.kg != null && e.kg !== '' ? el('span', { clase: 'tabular', texto: kgTexto(Number(e.kg)) }) : null)));
}

// Miniaturas de un borrador: dataUrl en línea, o el blob guardado en IndexedDB (se carga después).
function miniaturasPendientes(b) {
  const fotos = b.fotos ?? [];
  if (!fotos.length) return null;
  return el('ul', { clase: 'diario-miniaturas diario-miniaturas--lista' }, fotos.map((f, k) => {
    const img = el('img', { alt: `Foto ${k + 1} del borrador` });
    if (f.dataUrl) img.src = f.dataUrl;
    else almacenFotos.get(f.clave).then((bl) => { if (bl) { img.src = URL.createObjectURL(bl); img.onload = () => URL.revokeObjectURL(img.src); } }).catch(() => {});
    return el('li', {}, img);
  }));
}

function tarjetaPendiente(b, datos, { reintentar, descartar }) {
  return el('li', { clase: 'tarjeta diario-salida diario-salida--pendiente' },
    el('div', { clase: 'diario-salida__cabeza' }, el('h3', { texto: fechaLarga(b.fecha) }), el('span', { clase: 'etiqueta etiqueta--ocre', texto: 'Pendiente de subir' })),
    el('p', { clase: 'texto-2 texto-s', texto: `${nombreZona(datos, b.zona_id)} · ${b.fotos?.length ?? 0} foto${b.fotos?.length === 1 ? '' : 's'}${b.remotoId ? ' · subida a medias' : ''}` }),
    listaEspecies(datos, b.especies),
    b.ultimoError ? el('p', { clase: 'texto-s', texto: `Último intento: ${b.ultimoError}` }) : null,
    miniaturasPendientes(b),
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

function tarjetaSalida(s, datos, { borrar, compartir, nombresGrupos }) {
  const urls = (s.fotos ?? []).filter((f) => f.url).slice().sort((a, b) => a.ruta.localeCompare(b.ruta, 'es', { numeric: true })).map((f) => ({ mini: f.url, grande: f.url }));
  const con = (s.salida_grupos ?? []).map((c) => `${nombresGrupos.get(c.grupo_id) ?? 'un grupo'}${c.ubicacion_exacta ? '' : ' (solo la zona)'}`);
  return el('li', { clase: 'tarjeta diario-salida' },
    el('div', { clase: 'diario-salida__cabeza' }, el('h3', { texto: fechaLarga(s.fecha) }),
      con.length ? el('span', { clase: 'etiqueta etiqueta--acento', texto: `Compartida con ${con.join(', ')}` }) : el('span', { clase: 'etiqueta', texto: 'Privada' })),
    el('p', { clase: 'texto-2 texto-s', texto: nombreZona(datos, s.zona_id) }),
    listaEspecies(datos, s.especies),
    miniaturasDe(urls, `Salida del ${fechaLarga(s.fecha)}`),
    s.notas ? el('p', { clase: 'diario-notas', texto: s.notas }) : null,
    comparacionIndice(s),
    el('div', { clase: 'diario-fila' },
      typeof s.lat === 'number' && typeof s.lon === 'number' ? el('a', { clase: 'boton boton--suave boton--compacto', href: '#mapa', texto: 'Ver en el mapa' }) : null,
      el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Compartir…', onclick: compartir }),
      el('button', { type: 'button', clase: 'boton boton--suave boton--compacto boton--borrar', texto: 'Borrar', onclick: () => { if (confirm('¿Borrar esta salida y sus fotos? No se puede deshacer.')) borrar(); } })));
}

// «Compartir…» en una salida ya subida: elegir (o quitar) los grupos y la precisión de la ubicación.
async function hojaCompartirSalida(s, { alGuardar }) {
  const hoja = abrirHoja('Compartir esta salida');
  const estadoHoja = el('p', { clase: 'texto-s', attrs: { role: 'alert' } });
  try {
    const grupos = await misGrupos({ supabase });
    if (!grupos.length) { hoja.cuerpo.append(el('p', {}, 'No estás en ningún grupo. ', el('a', { href: '#grupos', texto: 'Crear o unirme a uno' }))); return; }
    const actual = new Map((s.salida_grupos ?? []).map((c) => [c.grupo_id, c.ubicacion_exacta]));
    const selector = selectorGrupos({ grupos, seleccion: actual });
    const guardar = el('button', { type: 'button', clase: 'boton', texto: 'Guardar', onclick: async () => {
      guardar.disabled = true;
      try { await guardarComparticion(s.id, selector.valor(), { supabase }); hoja.cerrar(); alGuardar(); } catch (e) { estadoHoja.textContent = textoError(e); guardar.disabled = false; }
    } });
    hoja.cuerpo.append(
      el('p', { clase: 'texto-2', texto: 'Los miembros de cada grupo marcado verán esta salida. Con «solo la zona» no verán el punto exacto ni los datos del punto.' }),
      selector.nodo, estadoHoja, guardar);
  } catch (e) { hoja.cuerpo.append(el('p', { clase: 'aviso-peligro', texto: textoError(e) })); }
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
  if (!cola.persistente && sigue) mensaje(AVISO_SIN_ESPACIO, { peligro: true });
  else mensaje(sigue ? 'Guardada en el móvil; se subirá al recuperar conexión.' : 'Subida ✓');
  viva?.refrescar();
}

export function pintar({ estado, param }) {
  iniciarSincronizacion();
  const datos = estado.datos;
  const raiz = el('div', { clase: 'pila diario' });
  const autorLinea = el('p', { clase: 'diario-autor' });
  const pintarAutor = async () => {
    const c = await cuentaActual();
    const sinRed = !c && !!errorDeCuenta();
    autorLinea.replaceChildren(
      c ? el('span', {}, 'Apuntas como ', el('b', { texto: c.nombre })) : el('span', { clase: 'texto-2', texto: sinRed ? 'Sin conexión: no se puede comprobar tu perfil.' : (cola.todos().length ? 'Crea tu perfil para subir tus salidas pendientes.' : 'Aún no tienes perfil.') }),
      el('span', { clase: 'diario-fila' },
        c || sinRed ? null : el('button', { type: 'button', clase: 'boton boton--compacto', texto: 'Crear perfil', onclick: async () => {
          try { if (await requerirCuenta()) { await pintarAutor(); await sincronizarYa(); refrescar(); } } catch (e) { mensaje(e.message, { peligro: true }); }
        } }),
        el('a', { clase: 'boton boton--suave boton--compacto', href: '#grupos', texto: 'Grupos' })));
    pintarReclamo();
  };
  // Salidas anteriores a las cuentas (sin dueño): quien tiene perfil puede reclamar las que llevan su nombre.
  const reclamo = el('div');
  async function pintarReclamo() {
    reclamo.replaceChildren();
    try {
      if (!(await cuentaActual())) return;
      const sin = await salidasSinDueno({ supabase });
      if (!sin.length) return;
      reclamo.append(el('div', { clase: 'aviso' }, icono('i-aviso'), el('div', { clase: 'pila' },
        el('p', { texto: 'Hay salidas de antes de los perfiles. ¿Cuáles son tuyas?' }),
        el('div', { clase: 'diario-fila' }, sin.map((f) => el('button', { type: 'button', clase: 'boton boton--compacto', texto: `${f.autor || 'Sin nombre'} (${f.n})`, onclick: async () => {
          if (!confirm(`¿Quedarte con las ${f.n} salidas de «${f.autor || 'Sin nombre'}»? Pasarán a ser tuyas y privadas.`)) return;
          try { const n = await reclamarSalidas(f.autor, { supabase }); mensaje(Number(n) === 0 ? 'No quedaban salidas por reclamar.' : 'Salidas reclamadas.'); await refrescar(); pintarReclamo(); } catch (e) { mensaje(textoError(e), { peligro: true }); }
        } }))))));
    } catch { /* sin conexión: se verá al volver */ }
  }
  const resultado = el('div', { attrs: { role: 'status', 'aria-live': 'polite' } });
  const listaPend = el('ul', { clase: 'diario-lista' });
  const listaSal = el('ul', { clase: 'diario-lista' });
  const vacio = el('p', { clase: 'tarjeta texto-2', texto: 'Aún no hay salidas. Pulsa «Nueva salida» para apuntar la primera.', hidden: true });
  const actualizarVacio = () => { vacio.hidden = !(cache && !cache.length && !cola.todos().length); };
  const cargando = el('div', { clase: 'esqueleto', attrs: { 'aria-label': 'Cargando salidas' } });
  const avisoRed = el('div');
  let cache = null, ficha = 0, nombresGrupos = new Map();

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
      reintentar: async () => {
        const r = await subirPendientes();
        if (r.sinPerfil) mensaje(errorDeCuenta() ? 'Sin conexión: se subirá al recuperarla.' : 'Crea tu perfil para subir tus salidas.');
        else mensaje(r.fallidas ? 'Sigue sin conexión: se subirá al recuperarla.' : 'Subida ✓');
      },
      descartar: () => { cola.quitar(b.id); quitarFotosLocales(b); pintarPendientes(); },
    })));
    actualizarVacio();
    if (!cola.persistente) mensaje(AVISO_SIN_ESPACIO, { peligro: true });
  }
  function pintarSalidas() {
    listaSal.replaceChildren(...(cache ?? []).map((s) => tarjetaSalida(s, datos, {
      nombresGrupos,
      compartir: () => hojaCompartirSalida(s, { alGuardar: () => { mensaje('Cambios de compartir guardados.'); refrescar(); } }),
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
      const cuenta = await cuentaActual();
      if (!cuenta && errorDeCuenta()) throw new Error(textoError(errorDeCuenta()));
      const [salidas, grupos] = await Promise.all([
        cuenta ? listarSalidas({ supabase, usuarioId: cuenta.id }) : Promise.resolve([]),
        cuenta ? misGrupos({ supabase }).catch(() => []) : Promise.resolve([]),
      ]);
      if (mi !== ficha) return;
      nombresGrupos = new Map(grupos.map((g) => [g.grupo_id, g.nombre]));
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
    autorLinea, reclamo, resultado, avisoRed, listaPend, cargando, listaSal, vacio);
  const nueva = leerNuevaSalida(param);
  if (nueva) {
    history.replaceState(null, '', '#diario');   // al repintar no se vuelve a abrir
    requestAnimationFrame(() => hojaNuevaSalida({ estado, alGuardar, inicial: nueva }));
  }
  refrescar();
  return raiz;
}

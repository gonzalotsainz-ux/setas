// Pantalla «Ajustes»: este dispositivo, umbrales compartidos, calibración con el diario y créditos. Sin login.
import { el } from '../ui/dom.js';
import { comun } from '../ui/ficha.js';
import { nombreCorto } from '../datos.js';
import { supabase, autorActual, elegirAutor } from '../supabase.js';
import { colaBorradores, listarSalidas } from '../diario.js';
import { validarUmbral, umbralEfectivo, cargarFilasUmbrales, guardarUmbral, restablecerUmbral } from '../umbrales.js';

const esUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
const enlace = (texto, href) => (esUrl(href) ? el('a', { texto, href, target: '_blank', rel: 'noopener noreferrer' }) : el('span', { texto }));
const coma = (n) => String(n).replace('.', ',');
const fechaCorta = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso ?? '') : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};
const seccion = (titulo, ...hijos) => el('section', { clase: 'tarjeta ajustes-seccion' }, el('h2', { clase: 'tarjeta__titulo', texto: titulo }), ...hijos);

// Fecha más reciente de cualquier campo `revisado` en los datos cargados (zonas, sitios, normativa, especies).
export function fechaDatos(datos) {
  let max = '';
  const ver = (o) => {
    if (Array.isArray(o)) { o.forEach(ver); return; }
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'revisado' && typeof v === 'string' && v > max) max = v; else ver(v); }
  };
  ver([datos.zonas, datos.sitios, datos.normativa, datos.especies]);
  return max || null;
}

// ---------- Este dispositivo ----------
function bloqueDispositivo() {
  const nombre = el('b');
  const cambiar = el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Cambiar' });
  const linea = el('p', { clase: 'ajustes-linea' }, 'Apuntas como ', nombre, ' ', cambiar);
  const formulario = el('form', { clase: 'ajustes-autor', hidden: true });
  const campo = el('input', { type: 'text', id: 'ajustes-autor', maxLength: 40, autocomplete: 'off' });
  formulario.append(el('div', { clase: 'campo' }, el('label', { texto: 'Tu nombre en este dispositivo', htmlFor: 'ajustes-autor' }), campo),
    el('div', { clase: 'ajustes-botones' }, el('button', { type: 'submit', clase: 'boton boton--compacto', texto: 'Guardar nombre' }),
      el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Cancelar', onclick: () => { formulario.hidden = true; } })));
  const pintarNombre = () => { nombre.textContent = autorActual() ?? 'nadie (aún no has dicho quién eres)'; };
  cambiar.onclick = () => { campo.value = autorActual() ?? ''; formulario.hidden = false; campo.focus(); };
  formulario.onsubmit = (ev) => { ev.preventDefault(); elegirAutor(campo.value); pintarNombre(); formulario.hidden = true; };
  pintarNombre();

  const cola = colaBorradores();
  const estadoCola = el('p', { clase: 'ajustes-linea', role: 'status' });
  const reintentar = el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Reintentar subida' });
  const resultado = el('p', { clase: 'texto-2', role: 'status' });
  const pintarCola = () => {
    const pend = cola.todos();
    const fallo = pend.map((b) => b.ultimoError).filter(Boolean).pop();
    estadoCola.replaceChildren(pend.length
      ? el('span', {}, el('b', { texto: `${pend.length} ${pend.length === 1 ? 'salida pendiente' : 'salidas pendientes'}` }), ' de subir desde este dispositivo', fallo ? ` · último error: ${fallo}` : '')
      : el('span', { clase: 'texto-2', texto: 'No hay salidas pendientes de subir.' }));
    reintentar.hidden = !pend.length;
  };
  reintentar.onclick = async () => {
    reintentar.disabled = true; resultado.textContent = 'Subiendo…';
    try {
      const { sincronizarYa } = await import('./diario.js');
      const r = await sincronizarYa();
      resultado.textContent = r.fallidas ? `Se subieron ${r.subidas}; ${r.fallidas} siguen pendientes.` : `Se subieron ${r.subidas}.`;
    } catch (e) { resultado.textContent = `No se pudo subir: ${e.message}`; }
    reintentar.disabled = false; pintarCola();
  };
  pintarCola();
  return seccion('Este dispositivo', linea, formulario, estadoCola, reintentar, resultado);
}

// ---------- Umbrales ----------
const CAMPOS = [
  ['topt', 'Temperatura óptima (°C)', (i) => i.topt],
  ['tmin', 'Rango de temperatura, mínima (°C)', (i) => i.trango[0]],
  ['tmax', 'Rango de temperatura, máxima (°C)', (i) => i.trango[1]],
  ['pmin', 'Lluvia mínima (mm)', (i) => i.pmin],
  ['pfull', 'Lluvia de pleno (mm)', (i) => i.pfull],
  ['dmin', 'Desfase, mínimo (días)', (i) => i.desfase[0]],
  ['dmax', 'Desfase, máximo (días)', (i) => i.desfase[1]],
];
const CONFIANZA = { alta: 'confianza alta', media: 'confianza media', baja: 'confianza baja' };

function filaUmbral({ estado, especie, fila, alCambiar }) {
  const orig = especie.indice;
  // Solo las claves editables, y validada: una fila mal formada (RLS abierto) no rompe la pantalla ni quita «Restablecer».
  const { efectivo, filaMala } = umbralEfectivo(orig, estado.umbrales[especie.id]);
  const editado = Object.hasOwn(estado.umbrales, especie.id) || !!fila;
  const entradas = {};
  const campos = CAMPOS.map(([k, rotulo, leer]) => {
    const id = `umbral-${especie.id}-${k}`;
    entradas[k] = el('input', { type: 'number', id, step: 'any', inputMode: 'decimal', value: String(leer(efectivo)) });
    return el('div', { clase: 'campo' }, el('label', { texto: rotulo, htmlFor: id }), entradas[k]);
  });
  const mensajes = el('ul', { clase: 'ajustes-errores', role: 'alert', hidden: true });
  const avisoEstado = el('p', { clase: 'texto-2', role: 'status' });
  const leer = () => {
    const n = (k) => (entradas[k].value.trim() === '' ? NaN : Number(entradas[k].value.replace(',', '.')));
    return { topt: n('topt'), trango: [n('tmin'), n('tmax')], pmin: n('pmin'), pfull: n('pfull'), desfase: [n('dmin'), n('dmax')] };
  };
  const errores = (l) => { mensajes.replaceChildren(...l.map((t) => el('li', { texto: t }))); mensajes.hidden = !l.length; };
  const guardar = el('button', { type: 'submit', clase: 'boton boton--compacto', texto: 'Guardar' });
  const restablecer = el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Restablecer', hidden: !editado });
  const formulario = el('form', { clase: 'ajustes-umbral', noValidate: true }, el('div', { clase: 'ajustes-campos' }, ...campos), mensajes,
    el('div', { clase: 'ajustes-botones' }, guardar, restablecer), avisoEstado);
  const ocupado = (v) => { guardar.disabled = v; restablecer.disabled = v; };
  formulario.onsubmit = async (ev) => {
    ev.preventDefault();
    const p = leer();
    const e = validarUmbral(p);
    errores(e);
    if (e.length) { avisoEstado.textContent = ''; return; }
    ocupado(true); avisoEstado.textContent = 'Guardando…';
    try {
      await guardarUmbral(supabase, especie.id, p, autorActual());
      estado.umbrales = { ...estado.umbrales, [especie.id]: p };
      alCambiar({ especie_id: especie.id, autor: autorActual() ?? 'desconocido', actualizado: new Date().toISOString() });
    } catch (x) { avisoEstado.textContent = `No se pudo guardar: ${x.message}`; ocupado(false); }
  };
  restablecer.onclick = async () => {
    ocupado(true); avisoEstado.textContent = 'Restableciendo…';
    try {
      await restablecerUmbral(supabase, especie.id);
      const { [especie.id]: _quitado, ...resto } = estado.umbrales;
      estado.umbrales = resto;
      alCambiar(null);
    } catch (x) { avisoEstado.textContent = `No se pudo restablecer: ${x.message}`; ocupado(false); }
  };
  const origen = el('p', { clase: 'texto-2 ajustes-origen' },
    `Valores de la investigación: ${coma(orig.topt)} °C (${coma(orig.trango[0])}–${coma(orig.trango[1])}), lluvia ${coma(orig.pmin)}–${coma(orig.pfull)} mm, desfase ${orig.desfase[0]}–${orig.desfase[1]} días · ${CONFIANZA[orig.confianza] ?? 'sin confianza indicada'} · fuente: `,
    enlace(orig.fuente ?? 'sin fuente', orig.fuente));
  const editor = fila?.autor ?? 'desconocido';
  const cuerpo = [origen];
  if (editado) cuerpo.push(el('p', { clase: 'ajustes-editado', texto: `Editado por ${editor}${fila?.actualizado ? ` el ${fechaCorta(fila.actualizado)}` : ''}` }));
  if (editado && filaMala) cuerpo.push(el('p', { clase: 'aviso-peligro', role: 'note', texto: 'El umbral guardado no es válido y no se usa: el índice sigue con los valores de la investigación. Guarda unos nuevos o pulsa «Restablecer».' }));
  cuerpo.push(formulario);
  return el('details', { clase: 'ajustes-especie', attrs: { 'data-id': especie.id } },
    el('summary', {}, el('span', { clase: 'ajustes-especie__nombre', texto: comun(especie) }), editado ? el('span', { clase: 'etiqueta etiqueta--ocre', texto: `Editado por ${editor}` }) : null),
    ...cuerpo);
}

function bloqueUmbrales(estado) {
  const especies = estado.datos.especies.filter((e) => e.categoria === 'comestible' && e.indice);
  const lista = el('div', { clase: 'ajustes-lista' });
  const aviso = el('p', { clase: 'texto-2', texto: 'Cargando quién editó cada umbral…', role: 'status' });
  let filas = {};
  const pintarLista = (abierta) => {
    lista.replaceChildren(...especies.map((e) => {
      const d = filaUmbral({ estado, especie: e, fila: filas[e.id], alCambiar: (f) => { if (f) filas[e.id] = f; else delete filas[e.id]; pintarLista(e.id); } });
      if (e.id === abierta) d.open = true;
      return d;
    }));
    if (abierta) lista.querySelector('details[open] summary')?.focus();
  };
  pintarLista();
  cargarFilasUmbrales(supabase).then((r) => {
    filas = Object.fromEntries(r.map((f) => [f.especie_id, f]));
    aviso.remove();
    const abierta = lista.querySelector('details[open]')?.dataset.id;
    pintarLista(abierta);
  }).catch(() => { aviso.textContent = 'No se pudo consultar quién editó los umbrales (sin conexión).'; });
  return seccion('Umbrales del índice',
    el('p', { clase: 'texto-2', texto: 'Se comparten con quien abra la web: lo que cambies aquí cambia las notas en todos los móviles. «Restablecer» vuelve a los valores de la investigación.' }),
    aviso, lista);
}

// ---------- Calibración ----------
function bloqueCalibracion(estado) {
  const cuerpo = el('div', { clase: 'ajustes-lista' }, el('p', { clase: 'texto-2', texto: 'Cargando el diario…', role: 'status' }));
  listarSalidas({ supabase }).then((salidas) => {
    const porEspecie = new Map();
    for (const s of [...salidas].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) {
      for (const e of Array.isArray(s.especies) ? s.especies : []) {
        const kg = Number(String(e.kg ?? '').replace(',', '.'));
        const v = s.indice?.especies?.find((x) => x.id === e.especie_id)?.valor;
        const z = estado.datos.zonas.find((x) => x.id === s.zona_id);
        if (!porEspecie.has(e.especie_id)) porEspecie.set(e.especie_id, []);
        porEspecie.get(e.especie_id).push({ fecha: s.fecha, zona: z ? nombreCorto(z) : (s.zona_id ?? '—'), valor: Number.isFinite(v) ? Math.round(v) : null, kg: Number.isFinite(kg) && e.kg !== '' && e.kg != null ? kg : null });
      }
    }
    if (!porEspecie.size) { cuerpo.replaceChildren(el('p', { clase: 'texto-2', texto: 'Aún no hay salidas en el diario con especies recogidas. Cuando las haya, aquí verás la nota del índice frente a los kg.' })); return; }
    cuerpo.replaceChildren(...[...porEspecie].map(([id, filas]) => {
      const esp = estado.datos.porId[id];
      return el('div', { clase: 'ajustes-calib' }, el('h3', { texto: esp ? comun(esp) : id }),
        el('table', { clase: 'ajustes-tabla' },
          el('thead', {}, el('tr', {}, ...['Fecha', 'Zona', 'Índice', 'Kg'].map((t) => el('th', { texto: t, scope: 'col' })))),
          el('tbody', {}, ...filas.map((f) => el('tr', {}, el('td', { texto: fechaCorta(f.fecha) }), el('td', { texto: f.zona }),
            el('td', { texto: f.valor == null ? 'sin dato' : String(f.valor) }), el('td', { texto: f.kg == null ? '—' : coma(f.kg) }))))));
    }));
  }).catch((e) => cuerpo.replaceChildren(el('p', { clase: 'texto-2', texto: `No se pudo leer el diario: ${e.message}` })));
  return seccion('Calibración con el diario',
    el('p', { clase: 'texto-2', texto: 'La nota que dio el índice el día de la salida (guardada con ella) frente a lo recogido. Sirve para decidir si subir o bajar un umbral. «Sin dato»: la especie no estaba entre las tres primeras del índice ese día.' }), cuerpo);
}

// ---------- Créditos ----------
function creditosFotos(datos) {
  const items = datos.especies.flatMap((e) => (e.fotos ?? []).map((f) => el('li', {},
    el('b', { texto: `${comun(e)}: ` }), `${f.autor ?? 'autor desconocido'} · ${f.licencia ?? 'licencia sin indicar'} · `, enlace('origen', f.url))));
  return el('details', { clase: 'ajustes-especie' }, el('summary', {}, el('span', { clase: 'ajustes-especie__nombre', texto: `Créditos de las fotos (${items.length})` })),
    el('ul', { clase: 'ajustes-creditos' }, ...items));
}
function bloqueCreditos(datos) {
  const li = (...h) => el('li', {}, ...h);
  return seccion('Créditos y licencias', el('ul', { clase: 'ajustes-creditos' },
    li(enlace('Open-Meteo', 'https://open-meteo.com/'), ': datos meteorológicos de modelos, licencia CC BY 4.0.'),
    li(enlace('AEMET', 'https://www.aemet.es/'), ': «Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma».'),
    li(enlace('IGN / CNIG', 'https://www.ign.es/'), ': cartografía y capas base (Base IGN, fondo «Mapa»; Mapa Topográfico Nacional; ortofoto PNOA), licencia CC BY 4.0 (© Instituto Geográfico Nacional de España).'),
    li(enlace('IDEE', 'https://www.idee.es/'), ': relieve sombreado del modelo digital del terreno (© Instituto Geográfico Nacional, CC BY 4.0).'),
    li(enlace('OpenStreetMap', 'https://www.openstreetmap.org/copyright'), ': © colaboradores de OpenStreetMap, ODbL (mapa para situar una salida del diario).'),
    // Mapa por laderas: textos de scripts/rejilla/config.mjs (CONFIG.mfe, CONFIG.mdt y CONFIG.pueblos; una prueba lo comprueba).
    li(enlace('Mapa Forestal de España 1:50.000 (MFE50)', 'https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/mfe50.html'),
      ': Mapa Forestal de España 1:50.000 (MFE50) © Ministerio para la Transición Ecológica y el Reto Demográfico. Base de los bosques del mapa por laderas. Fuente de los datos: Ministerio para la Transición Ecológica y el Reto Demográfico; proyecto realizado entre 1997 y 2006 (archivos de 2013). Reutilización con cita de la fuente (Real Decreto 1495/2011).'),
    li(enlace('Modelo Digital del Terreno MDT25 (IGN, PNOA-LiDAR), servicio WCS', 'https://servicios.idee.es/wcs-inspire/mdt'), ': Obra derivada de MDT25 CC BY 4.0 scne.es. Altitud, orientación y pendiente del mapa por laderas.'),
    li(enlace('Nomenclátor Geográfico Básico de España (NGBE) y unidades administrativas, IGN (servicios WFS)', 'https://www.ign.es/wfs-inspire/ngbe'), ': CC BY 4.0 (Obra derivada de NGBE CC-BY 4.0 ign.es). Pueblos del buscador del mapa.'),
    li(enlace('iNaturalist', 'https://www.inaturalist.org/'), ' y ', enlace('Wikimedia Commons', 'https://commons.wikimedia.org/'), ': fotos de especies, cada una con su autor y licencia (lista más abajo).'),
    li(enlace('Junta de Castilla y León', 'https://micocyl.es/'), ': cartografía micológica y regulación de cotos.'),
    li(enlace('OAPN', 'https://www.miteco.gob.es/es/parques-nacionales-oapn/'), ': zonificación del PRUG del Parque Nacional de la Sierra de Guadarrama.'),
    li(enlace('MITECO', 'https://www.miteco.gob.es/'), ': Mapa Forestal de España (MFE) y montes públicos.'),
    li(enlace('Comunidad de Madrid, IDEM', 'https://idem.madrid.org/'), ': montes de utilidad pública (MUP).'),
    li(enlace('GBIF', 'https://www.gbif.org/'), ': GBIF.org (2026) GBIF Occurrence Download/Search, ', enlace('gbif.org/occurrence/search', 'https://www.gbif.org/occurrence/search'), '.'),
    li('Investigación propia de la app: ', enlace('documentos de investigación', 'https://github.com/gonzalotsainz-ux/setas/tree/main/docs/investigacion'), ' (normativa, especies, fructificación y sitios), con fuente y fecha de consulta en cada dato.')),
  creditosFotos(datos));
}

export function pintar({ estado }) {
  estado.umbrales ??= {};
  const v = fechaDatos(estado.datos);
  return el('div', { clase: 'ajustes' }, el('h1', { texto: 'Ajustes' }),
    bloqueDispositivo(), bloqueUmbrales(estado), bloqueCalibracion(estado), bloqueCreditos(estado.datos),
    el('p', { clase: 'texto-2 ajustes-pie', texto: `Versión de los datos: ${v ? fechaCorta(`${v}T12:00:00`) : 'sin fecha'}` }));
}

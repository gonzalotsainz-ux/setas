// Pantalla «Hoy»: una nota por zona, la mejor destacada y un filtro por especie y día.
import { indiceZona } from '../indice.js';
import { hoyMadrid } from '../meteo.js';
import { especiesDeZona, nombreCorto, puntosRecogibles, rotuloPunto } from '../datos.js';
import { semaforo, nivelDe } from '../ui/semaforo.js';
import { urlSegura } from '../ui/normativa.js';
import { avisoViejo, textoSinLluvia } from '../aemet.js';

const ZONA_HORARIA = 'Europe/Madrid';
const ui = { dia: 0, especie: '' };   // la elección se conserva al repintar
const nbsp = ' ';

function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  const { clase, texto, attrs, ...resto } = props;
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  for (const [k, v] of Object.entries(attrs ?? {})) e.setAttribute(k, v);
  Object.assign(e, resto);
  e.append(...hijos.flat().filter((h) => h != null));
  return e;
}
const icono = (id) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'icono');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<use href="img/iconos.svg#${id}"/>`;
  return s;
};
const etiqueta = (texto, variante) => el('span', { clase: `etiqueta${variante ? ` etiqueta--${variante}` : ''}`, texto });
const negrita = (t) => el('b', { clase: 'tabular', texto: t });
const latin = (t) => el('span', { clase: 'latin', texto: t });
const comun = (e) => e.comunes?.es?.[0] ?? e.nombre;
const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const fechaLarga = (f) => mayus(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA_HORARIA }).format(new Date(`${f}T12:00:00Z`)));
const fechaCorta = (f) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: ZONA_HORARIA }).format(new Date(`${f}T12:00:00Z`));
const horaDe = (iso) => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: ZONA_HORARIA }).format(new Date(iso));

export function haceCuanto(iso, ahora = new Date()) {
  const h = Math.floor((ahora - new Date(iso)) / 3600e3);
  return h < 1 ? 'hace menos de 1 h' : `hace ${h} h`;
}

const vacio = { valor: null, etiqueta: null, sinDatos: true, fueraDeTemporada: false, incompleta: false, faltan: [], especies: [] };
function sinDatosZona(zona, motivo, incierta = false, res = vacio) {
  return { zona, res, mejor: null, incierta, motivo };
}
export const textoFaltan = (n) => `${n} ${n === 1 ? 'especie' : 'especies'} sin datos suficientes`;

// Cálculo de una zona para el día i (hoy + d), opcionalmente limitado a una especie.
export function calcularZona(zona, datos, meteo, d, especieId, umbrales = {}) {
  // Los puntos NO IR (solo meteo) no entran: nunca pueden salir como mejor punto de la zona.
  const recogibles = puntosRecogibles(zona);
  if (!recogibles.length) return sinDatosZona(zona, 'Todos los puntos de esta zona son NO IR (solo meteo). No se calcula nota.');
  const series = Object.fromEntries(recogibles.map((p) => [p.id, meteo.series?.[p.id]]).filter(([, s]) => s));
  const primera = Object.values(series)[0];
  if (!primera) return sinDatosZona(zona, 'No hay datos meteorológicos de esta zona. No se calcula nota.');
  let especies = especiesDeZona(zona, datos.especies, umbrales);
  if (especieId) {
    especies = especies.filter((e) => e.id === especieId);
    if (!especies.length) return sinDatosZona(zona, 'Sin registros de esta especie en la zona. No se calcula nota.');
  }
  const res = indiceZona(series, primera.hoy + d, especies);
  // el contraste de modelos es de la lluvia de los próximos días: no afecta a la nota de hoy
  const incierta = d > 0 && zona.puntos.some((p) => meteo.dispersion?.[p.id]?.incierta);
  if (res.fueraDeTemporada) {
    return sinDatosZona(zona, especieId ? 'Fuera de temporada en esas fechas. No se calcula nota.' : 'Fuera de temporada: ninguna especie de la zona lo está. No se calcula nota.', incierta, res);
  }
  if (res.sinDatos) {
    return sinDatosZona(zona, `Faltan datos para calcular la nota${res.faltan.length ? ` (${textoFaltan(res.faltan.length)})` : ''}.`, incierta, res);
  }
  const mejor = res.especies[0];
  const discrepa = !!meteo.contraste?.[zona.id]?.discrepa;
  return { zona, res, mejor, incierta, discrepa, rotulo: rotuloPunto(zona.puntos.find((p) => p.id === mejor.punto)) };
}

export const ordenarZonas = (filas) => [...filas].sort((a, b) => (b.res.valor ?? -1) - (a.res.valor ?? -1));

function frase(fila, datos) {
  if (!fila.mejor) return fila.motivo;
  const r = fila.mejor.resultado, e = datos.porId[fila.mejor.id];
  if (r.datos.P26 == null) return `${r.explicacion[0]}: ${comun(e)}.`;   // fuera de temporada: no hay datos que citar
  const { P26, P3, lag, T20 } = r.datos;
  const cuando = P3 < 1 ? 'sin tandas de lluvia' : lag === 0 ? 'lo más fuerte, hoy' : lag === 1 ? 'lo más fuerte, ayer' : `lo más fuerte hace ${lag} días`;
  return [negrita(`${Math.round(P26)}${nbsp}mm`), ` en 26 días, ${cuando} · `, negrita(`${Math.round(T20)}${nbsp}°C`),
    ' → ', latin(e.nombre), ` ${r.etiqueta}`];
}

const notaGrande = (valor, grande) => el('p', { clase: `indice${grande ? ' indice--grande' : ''}` }, String(valor), grande ? el('span', { clase: 'indice__max', texto: '/100' }) : null);

function filaZona(fila, pos, datos, d) {
  const nivel = nivelDe(fila.res.valor);
  const estado = el('span', { clase: 'fila-zona__estado' }, semaforo(fila.res.valor, fila.res.fueraDeTemporada ? 'Fuera de temporada' : null));
  if (fila.mejor) estado.append(etiqueta(`Confianza ${fila.mejor.resultado.confianza}`));
  if (fila.mejor && fila.res.incompleta) estado.append(etiqueta(textoFaltan(fila.res.faltan.length), 'ocre'));
  if (d > 0 && fila.mejor) estado.append(etiqueta('Previsión', 'ocre'));
  if (fila.incierta) estado.append(etiqueta('Previsión incierta', 'ocre'));
  if (fila.discrepa) estado.append(etiqueta('Estación y modelo no coinciden', 'ocre'));
  if (fila.rotulo) estado.append(etiqueta(fila.rotulo.texto, fila.rotulo.variante));
  const a = el('a', { clase: 'fila-zona', href: `#zona/${fila.zona.id}`, attrs: { 'data-nivel': nivel } },
    el('span', { clase: 'fila-zona__nombre-linea' }, el('span', { clase: 'fila-zona__pos', texto: String(pos) }), el('span', { clase: 'fila-zona__nombre', texto: nombreCorto(fila.zona) })),
    fila.res.valor != null ? notaGrande(fila.res.valor) : null,
    estado,
    el('span', { clase: 'fila-zona__frase' }, frase(fila, datos)));
  return el('li', {}, a);
}

function destacada(fila, datos, caducado, d) {
  const e = datos.porId[fila.mejor.id];
  const nivel = nivelDe(fila.res.valor);
  const foto = e.fotos?.[0];
  const autor = foto?.autor?.replace(/^\(c\)\s*/, '').replace(/,?\s*some rights reserved.*$/, '');
  const rotulo = caducado ? 'La mejor zona con los últimos datos' : d > 0 ? `La mejor zona, previsión a +${d} días` : 'La mejor zona ahora';
  const meta = el('div', { clase: 'destacada__meta' }, semaforo(fila.res.valor));
  if (fila.res.incompleta) meta.append(etiqueta(textoFaltan(fila.res.faltan.length), 'ocre'));
  if (fila.mejor.min !== fila.mejor.max) meta.append(etiqueta(`${fila.mejor.min} a ${fila.mejor.max} según el punto`));
  meta.append(etiqueta(`Confianza ${fila.mejor.resultado.confianza}`));
  if (d > 0) meta.append(etiqueta('Previsión', 'ocre'));
  if (fila.rotulo) meta.append(etiqueta(fila.rotulo.texto, fila.rotulo.variante));
  const top = fila.res.especies.slice(0, 3).map((s) => {
    const se = datos.porId[s.id];
    return el('li', {}, el('span', {}, latin(se.nombre), ' ', el('span', { clase: 'texto-2', texto: comun(se) })),
      el('span', {}, semaforo(s.valor), ' ', el('span', { clase: 'tabular', texto: String(s.valor) })));
  });
  return el('article', { clase: 'tarjeta tarjeta--bisel destacada', attrs: { 'data-nivel': nivel, 'aria-labelledby': 'destacada-nombre' } },
    el('div', { clase: 'tarjeta__nucleo' },
      foto ? el('div', { clase: 'destacada__foto' },
        el('img', { src: foto.archivo, alt: `Foto de ${e.nombre}`, width: 1024, height: 768 }),
        el('span', { clase: 'credito-foto' }, 'Foto: ', urlSegura(foto.url) ? el('a', { href: foto.url, texto: autor }) : el('span', { texto: autor }), `, ${foto.licencia}`)) : null,
      el('div', { clase: 'destacada__cuerpo' },
        el('div', { clase: 'destacada__cabeza' },
          el('div', {}, el('p', { clase: 'destacada__rotulo', texto: rotulo }), el('h2', { texto: nombreCorto(fila.zona), id: 'destacada-nombre' })),
          el('div', { clase: 'destacada__nota' }, notaGrande(fila.res.valor, true))),
        meta,
        el('p', { clase: 'destacada__frase' }, frase(fila, datos)),
        el('ul', { clase: 'destacada__especies', attrs: { 'aria-label': 'Especies con mejor índice' } }, top),
        el('div', { clase: 'destacada__acciones' },
          el('a', { clase: 'boton', href: `#zona/${fila.zona.id}` }, `Ver ${nombreCorto(fila.zona)} `, el('span', { clase: 'boton__nido', attrs: { 'aria-hidden': 'true' } }, icono('i-flecha'))),
          el('a', { clase: 'boton boton--suave boton--icono', href: '#mapa', attrs: { 'aria-label': `Ver ${nombreCorto(fila.zona)} en el mapa` } }, icono('i-mapa'))))));
}

function avisoIncierta(filas, meteo) {
  const inciertas = filas.filter((f) => f.incierta);
  if (!inciertas.length) return null;
  const horizontes = inciertas.flatMap((f) => f.zona.puntos.map((p) => meteo.dispersion?.[p.id])).filter((x) => x?.incierta && x.horizonte).map((x) => x.horizonte);
  const h = horizontes.length ? Math.min(...horizontes) : null;
  const nombres = inciertas.map((f) => nombreCorto(f.zona)).join(', ').replace(/, ([^,]*)$/, ' y $1');
  return el('div', { clase: 'aviso', attrs: { role: 'note' } }, icono('i-lluvia'),
    el('p', {}, el('strong', { texto: `Previsión incierta en ${nombres}. ` }),
      h ? `Los modelos no se ponen de acuerdo en la lluvia de los próximos ${h} días.` : 'Los modelos no se ponen de acuerdo en la lluvia de los próximos días.'));
}

function leyenda() {
  return el('section', { clase: 'tarjeta', attrs: { 'aria-labelledby': 'titulo-leyenda' } },
    el('h2', { id: 'titulo-leyenda', texto: 'Cómo leer el semáforo' }),
    el('div', { clase: 'semaforos' }, [5, 25, 45, 65, 85].map((v) => semaforo(v)), semaforo(null)),
    el('p', { clase: 'leyenda-rangos', texto: 'Cada barra llena son 20 puntos más: 0 a 20 nulo, 20 a 40 bajo, 40 a 60 posible, 60 a 80 bueno y 80 a 100 muy bueno.' }));
}

function esqueleto() {
  return el('div', { attrs: { 'aria-busy': 'true' } }, el('p', { clase: 'solo-lector', texto: 'Cargando la previsión…', attrs: { role: 'status' } }),
    el('div', { clase: 'portada' }, el('h1', { texto: '¿Adónde vamos?' })), el('div', { clase: 'esqueleto' }), el('div', { clase: 'esqueleto' }), el('div', { clase: 'esqueleto' }));
}

function errorMeteo(meteo, refrescarMeteo) {
  const boton = el('button', { clase: 'boton boton--suave', type: 'button', texto: 'Reintentar' });
  boton.addEventListener('click', async () => { boton.disabled = true; boton.textContent = 'Reintentando…'; await refrescarMeteo(); });
  return el('div', {}, el('section', { clase: 'portada' }, el('h1', { texto: '¿Adónde vamos?' })),
    el('div', { clase: 'tarjeta', attrs: { role: 'alert' } }, el('h2', { texto: 'No se han podido cargar los datos meteorológicos' }),
      el('p', { clase: 'texto-2', texto: meteo.error ?? 'Sin respuesta de Open-Meteo.' }),
      el('p', { texto: 'Sin datos no se calcula ninguna nota. Comprueba la conexión e inténtalo de nuevo.' }),
      el('div', { clase: 'destacada__acciones' }, boton)));
}

export function pintar({ estado, refrescarMeteo }) {
  const { meteo, datos } = estado;
  if (!meteo) return esqueleto();
  if (!meteo.series) return errorMeteo(meteo, refrescarMeteo);

  const hoy = hoyMadrid();
  const caducado = meteo.hoy !== hoy;   // datos guardados de otro día: no son el índice de hoy
  if (caducado) ui.dia = 0;
  const umbrales = estado.umbrales ?? {};

  const sub = el('p', { clase: 'portada__sub' });
  if (caducado) sub.append(`Datos del ${fechaCorta(meteo.hoy)}. No se ha podido actualizar; las notas son de ese día.`);
  else if (meteo.desdeCache) sub.append(`Datos de ${haceCuanto(meteo.hora)}`, meteo.error ? '. No se ha podido actualizar.' : '.');
  else sub.append('Actualizado a las ', el('time', { clase: 'tabular', dateTime: meteo.hora, texto: horaDe(meteo.hora) }), '. Previsión de Open-Meteo.');
  if (!estado.obs && estado.obsError && datos.zonas.some((z) => z.estacionesAemet?.length)) sub.append(` ${textoSinLluvia(estado.obsError)}.`);
  else if (avisoViejo(estado.obs) && datos.zonas.some((z) => z.estacionesAemet?.length)) sub.append(` ${avisoViejo(estado.obs)}.`);

  const portada = el('section', { clase: 'portada', attrs: { 'aria-labelledby': 'titulo-hoy' } },
    el('p', { clase: 'portada__fecha' }, el('time', { dateTime: hoy, texto: fechaLarga(hoy) })),
    el('h1', { id: 'titulo-hoy', texto: caducado ? 'Datos de un día anterior' : '¿Adónde vamos?' }), sub);

  const resultados = el('div', { clase: 'pila-l' });
  const cabeceraLista = el('div', { clase: 'seccion-cabeza' });

  function calcular() {
    const filas = ordenarZonas(datos.zonas.map((z) => calcularZona(z, datos, meteo, ui.dia, ui.especie, umbrales)));
    const mejor = filas[0]?.mejor ? filas[0] : null;
    cabeceraLista.replaceChildren(el('h2', { id: 'titulo-zonas', texto: `Las ${filas.length} zonas` }),
      el('span', { clase: 'texto-2 texto-s', texto: ui.dia > 0 ? `previsión a +${ui.dia} días` : 'de mejor a peor' }));
    resultados.replaceChildren(
      ...[mejor ? destacada(mejor, datos, caducado, ui.dia) : null,
        avisoIncierta(filas, meteo),
        el('section', { attrs: { 'aria-labelledby': 'titulo-zonas' } }, cabeceraLista,
          el('div', { clase: 'tarjeta lista' }, el('ol', { clase: 'lista-zonas' }, filas.map((f, k) => filaZona(f, k + 1, datos, ui.dia))))),
        leyenda()].filter(Boolean));
  }

  // Controles: especie y día
  const comestibles = [...new Map(datos.zonas.flatMap((z) => especiesDeZona(z, datos.especies, umbrales)).map((e) => [e.id, e])).values()]
    .sort((a, b) => comun(a).localeCompare(comun(b), 'es'));
  const select = el('select', { id: 'filtro-especie' }, el('option', { value: '', texto: 'Todas las especies' }),
    comestibles.map((e) => el('option', { value: e.id, texto: `${mayus(comun(e))} (${e.nombre})` })));
  select.value = ui.especie;
  select.addEventListener('change', () => { ui.especie = select.value; calcular(); });

  const controles = el('div', { clase: 'controles' }, el('label', { clase: 'campo', htmlFor: 'filtro-especie' }, 'Especie', select));
  if (!caducado) {
    const grupo = el('div', { clase: 'chips', attrs: { role: 'group', 'aria-label': 'Día de la previsión' } });
    for (let d = 0; d <= 7; d++) {
      const b = el('button', { clase: 'chip', type: 'button', texto: d === 0 ? 'Hoy' : `+${d}`, attrs: { 'aria-pressed': String(d === ui.dia), ...(d ? { 'aria-label': `Previsión a ${d} ${d === 1 ? 'día' : 'días'}` } : {}) } });
      b.addEventListener('click', () => { ui.dia = d; grupo.querySelectorAll('.chip').forEach((c, k) => c.setAttribute('aria-pressed', String(k === d))); calcular(); });
      grupo.append(b);
    }
    controles.append(grupo);
  }
  calcular();
  return el('div', {}, portada, el('div', { clase: 'pila-l' }, controles, resultados));
}

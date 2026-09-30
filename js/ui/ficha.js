// Ficha de una especie. Seguridad primero: ningún aviso de los datos se omite ni se suaviza.
// Todo texto de los datos entra con textContent; los enlaces solo si son http(s).
import { el, icono, etiqueta, mayus } from './dom.js';
import { avisoDuda, botonToxicologia } from './seguridad.js';
import { nombreCorto } from '../datos.js';

const nbsp = ' ';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const CATEGORIAS = {
  comestible: { nombre: 'Comestible', peligro: false },
  'comestible-precaucion': { nombre: 'Comestible con precaución', peligro: false, precaucion: true },
  'no-recomendada': { nombre: 'No recomendada', peligro: false, precaucion: true },
  toxica: { nombre: 'Tóxica', peligro: true },
  mortal: { nombre: 'MORTAL', peligro: true },
};
export const RIESGOS = { bajo: 'Riesgo bajo', medio: 'Riesgo medio', alto: 'Riesgo alto', mortal: 'RIESGO MORTAL' };
const BASES = {
  evidencia: 'umbrales publicados',
  cualitativo: 'solo descripción cualitativa, sin umbrales publicados',
  heuristica: 'estimación propia, sin umbrales publicados',
};

// Gancho para la sección «Trucos para encontrarla» (tarea 15b): asignar
// `ganchos.trucos = (especie, datos) => Node | null`. La ficha lo llama si existe y pinta el nodo en
// el punto de montaje `#trucos-especie` (`data-montaje="trucos"`), entre los datos de campo y las confusiones.
export const ganchos = { trucos: null };

export const urlSegura = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
export const comun = (e) => e.comunes?.es?.[0] ?? e.nombre;
const enlace = (href, texto) => (urlSegura(href) ? el('a', { texto, href, rel: 'noopener', target: '_blank' }) : el('span', { texto }));
const lista = (items, clase) => el('ul', { clase: clase ?? 'ficha-lista' }, items.map((t) => el('li', { texto: t })));
const seccion = (titulo, ...hijos) => el('section', { clase: 'tarjeta ficha-seccion' }, el('h2', { clase: 'ficha-seccion__titulo', texto: titulo }), ...hijos);
const latin = (t) => el('span', { clase: 'latin', texto: t });

export function chipCategoria(categoria) {
  const c = CATEGORIAS[categoria] ?? { nombre: categoria, peligro: true };
  return el('span', { clase: 'chip-cat', attrs: { 'data-categoria': categoria } }, categoria === 'mortal' ? icono('i-aviso') : null, c.nombre);
}

// «Foto de X» si el taxón fotografiado difiere; autor · licencia · enlace siempre.
export function credito(f) {
  return el('figcaption', { clase: 'foto__credito texto-s' },
    f.taxonFoto ? el('span', { clase: 'foto__taxon' }, 'Foto de ', latin(f.taxonFoto)) : null,
    f.nota ? el('span', { clase: 'foto__nota', texto: f.nota }) : null,
    el('span', {}, `${f.autor ?? 'Autor desconocido'} · ${f.licencia ?? 'licencia no indicada'}`, ' · ', enlace(f.url, 'ver original')));
}
// Crédito compacto para miniaturas: «Foto de X» si el taxón difiere, autor · licencia · enlace.
export function creditoCompacto(f) {
  return el('p', { clase: 'credito-mini texto-s' },
    f.taxonFoto ? el('span', { clase: 'foto__taxon' }, 'Foto de ', latin(f.taxonFoto), '. ') : null,
    f.nota ? el('span', { clase: 'foto__nota', texto: `${f.nota} ` }) : null,
    `${f.autor ?? 'Autor desconocido'} · ${f.licencia ?? 'licencia no indicada'} · `, enlace(f.url, 'original'));
}
export function imagen(f, alt, eager = false) {
  return el('img', { clase: 'foto__img', src: f.archivo, alt, loading: eager ? 'eager' : 'lazy', decoding: 'async' });
}

function galeria(e) {
  if (!e.fotos?.length) return el('p', { clase: 'foto-vacia texto-2', texto: 'Sin foto con licencia libre' });
  return el('div', { clase: 'galeria', attrs: { role: 'group', 'aria-label': `Fotos de ${e.nombre}` } },
    e.fotos.map((f, i) => el('figure', { clase: 'foto' }, imagen(f, `${e.nombre}${f.taxonFoto ? ` (foto de ${f.taxonFoto})` : ''}, foto ${i + 1}`, i === 0), credito(f))));
}

function nombres(e) {
  const es = e.comunes?.es ?? [], eu = e.comunes?.eu ?? [];
  return el('div', { clase: 'ficha-nombres' },
    el('p', { clase: 'ficha-cientifico' }, latin(e.nombre), e.autor ? ` ${e.autor}` : ''),
    e.sinonimos?.length ? el('p', { clase: 'texto-2' }, 'antes: ', ...e.sinonimos.flatMap((s, i) => [i ? ', ' : null, latin(s)])) : null,
    es.length ? el('p', {}, el('b', { texto: 'Castellano: ' }), es.join(', ')) : null,
    eu.length ? el('p', {}, el('b', { texto: 'Euskera: ' }), eu.join(', ')) : null);
}

function cabecera(e) {
  return el('header', { clase: 'ficha-cabecera' },
    el('h1', { id: 'titulo-especie', texto: mayus(comun(e)) }),
    nombres(e),
    el('div', { clase: 'portada__meta' }, chipCategoria(e.categoria),
      etiqueta(e.rd30_2009 ? `RD 30/2009 · Parte ${e.rd30_2009}` : 'RD 30/2009: no citada en el informe')));
}

// Comestible con algo que advertir: precaución, no recomendada, síndrome o Partes C/D del RD 30/2009.
export const hayAlerta = (e) => Boolean(CATEGORIAS[e.categoria]?.precaucion || e.sindrome || ['C', 'D'].includes(e.rd30_2009));
const aviso = (clase, ...hijos) => el('div', { clase, attrs: { role: 'note' } }, ...hijos);

// Banner rojo al principio. Comestible con precaución y no recomendada: precauciones[0] tal cual.
// Mortal y tóxica: el rótulo de su categoría (nunca menos que lo que dicen los datos).
function banner(e) {
  const c = CATEGORIAS[e.categoria];
  if (e.categoria !== 'mortal' && e.categoria !== 'toxica' && hayAlerta(e) && e.precauciones?.length) {
    return aviso('aviso-peligro', icono('i-aviso'), el('p', {}, c?.precaucion ? el('strong', { texto: `${c.nombre}. ` }) : null, e.precauciones[0]));
  }
  if (e.categoria === 'mortal') return aviso('aviso-peligro', icono('i-aviso'), el('p', {}, el('strong', { texto: 'MORTAL. ' }), 'Puede matar. No la comas nunca ni la mezcles con otras setas en la cesta.'));
  if (e.categoria === 'toxica') return aviso('aviso-peligro', icono('i-aviso'), el('p', {}, el('strong', { texto: 'Tóxica. ' }), 'No se debe comer.'));
  return null;
}

function precauciones(e) {
  const c = CATEGORIAS[e.categoria];
  const promovida = e.categoria !== 'mortal' && e.categoria !== 'toxica' && hayAlerta(e);
  const resto = promovida ? (e.precauciones ?? []).slice(1) : (e.precauciones ?? []);   // la [0] ya está en el banner
  if (!resto.length) return null;
  return aviso(c?.peligro || hayAlerta(e) ? 'aviso-peligro' : 'aviso', icono('i-aviso'), el('div', {}, el('strong', { texto: 'Precauciones' }), lista(resto)));
}

const presenciaTexto = (z) => {
  const n = z.gbif > 0 ? `${z.gbif} ${z.gbif === 1 ? 'registro' : 'registros'} GBIF` : null;
  const como = z.taxonGbif ? ` (registros como ${z.taxonGbif})` : '';
  if (z.presencia === 'confirmada') return `confirmada con ${n ?? 'registros GBIF'}${como}`;
  if (z.presencia === 'sin-registros') return `sin registros en GBIF${como}`;
  return n ? `orientativa; ${n}${como}` : `orientativa${como}`;
};

function temporada(e) {
  const t = e.temporada;
  if (!t?.meses?.length) return el('p', { clase: 'texto-2', texto: 'Temporada: el informe no la indica.' });
  const fila = el('ol', { clase: 'meses', attrs: { 'aria-label': `Meses de temporada: ${t.meses.map((m) => MESES_LARGOS[m - 1]).join(', ')}` } },
    MESES.map((m, i) => el('li', { clase: t.meses.includes(i + 1) ? 'mes mes--si' : 'mes', attrs: { 'aria-hidden': 'true' }, texto: m[0].toUpperCase() })));
  return el('div', {}, el('h3', { texto: 'Temporada' }), fila, el('p', { clase: 'texto-2 texto-s', texto: t.meses.map((m) => MESES_LARGOS[m - 1]).join(', ') }));
}

function zonas(e, datos) {
  const ids = Object.keys(e.zonas ?? {});
  if (!ids.length) return null;
  const ul = el('ul', { clase: 'ficha-lista ficha-zonas' });
  for (const id of ids) {
    const z = e.zonas[id], zona = datos.zonas.find((x) => x.id === id);
    ul.append(el('li', {}, el('b', { texto: `${zona ? nombreCorto(zona) : id}: ` }), presenciaTexto(z),
      z.verificado === false ? [' ', etiqueta('sin verificar', 'ocre')] : null,
      z.nota ? el('span', { clase: 'texto-2 texto-s ficha-nota', texto: z.nota }) : null));
  }
  return el('div', {}, el('h3', { texto: 'Dónde' }), ul);
}

function datosDeCampo(e, datos) {
  const alt = e.altitud;
  return seccion('Datos de campo',
    e.identificacion?.length ? el('div', {}, el('h3', { texto: 'Cómo reconocerla' }), lista(e.identificacion)) : null,
    e.habitats?.length ? el('p', {}, el('b', { texto: 'Hábitat: ' }), e.habitats.map((h) => mayus(h.replaceAll('-', ' '))).join(', ')) : null,
    alt ? el('p', {}, el('b', { texto: 'Altitud: ' }), `${alt.min}–${alt.max}${nbsp}m`, alt.verificado === false ? [' ', etiqueta('orientativo', 'ocre')] : null) : null,
    temporada(e), zonas(e, datos),
    e.valor ? el('p', {}, el('b', { texto: 'Valor culinario: ' }), e.valor) : null);
}

const fotoDe = (datos, id) => datos.porId[id]?.fotos?.[0] ?? null;

function confusion(c, datos) {
  const otra = datos.porId[c.especie];
  const f = fotoDe(datos, c.especie);
  const nombre = latin(otra ? otra.nombre : c.especie);
  const cuerpo = el('div', { clase: 'confusion__texto' },
    el('p', { clase: 'confusion__nombre' }, nombre, otra ? el('span', { clase: 'texto-2', texto: ` · ${comun(otra)}` }) : null),
    el('p', {}, el('span', { clase: 'chip-riesgo', attrs: { 'data-riesgo': c.riesgo }, texto: RIESGOS[c.riesgo] ?? c.riesgo }), otra ? [' ', chipCategoria(otra.categoria)] : null),
    el('p', { texto: c.diferencias }),
    f ? creditoCompacto(f) : null,
    otra ? el('a', { clase: 'confusion__enlace', href: `#especie/${encodeURIComponent(c.especie)}`, texto: 'Ver su ficha' }) : null);
  return el('li', { clase: 'confusion' },
    f ? el('img', { clase: 'confusion__foto', src: f.archivo, alt: `${otra.nombre}${f.taxonFoto ? ` (foto de ${f.taxonFoto})` : ''}`, loading: 'lazy', decoding: 'async' })
      : el('span', { clase: 'confusion__foto confusion__foto--vacia texto-s', texto: 'Sin foto' }),
    cuerpo);
}

function confusionMenor(c) {
  return el('li', { clase: 'confusion confusion--menor' }, el('div', { clase: 'confusion__texto' },
    el('p', { clase: 'confusion__nombre' }, latin(c.nombre)),
    el('p', {}, el('span', { clase: 'chip-riesgo', attrs: { 'data-riesgo': c.riesgo }, texto: RIESGOS[c.riesgo] ?? c.riesgo })),
    el('p', { texto: c.diferencias })));
}

function confusiones(e, datos) {
  const cuerpo = [];
  if (e.confusiones?.length) cuerpo.push(el('ul', { clase: 'confusiones' }, e.confusiones.map((c) => confusion(c, datos))));
  if (e.confusionesMenores?.length) {
    cuerpo.push(el('h3', { clase: 'confusiones__sub', texto: 'Otros parecidos sin ficha propia' }), el('ul', { clase: 'confusiones' }, e.confusionesMenores.map(confusionMenor)));
  }
  if (e.sinConfusiones) {
    cuerpo.push(el('p', {}, el('strong', { texto: 'Sin confusiones peligrosas documentadas en las fuentes. ' }), el('span', { texto: e.sinConfusiones })),
      el('p', { clase: 'texto-2 texto-s', texto: 'Que no haya confusiones documentadas no significa que no existan: ante la duda, no la comas.' }));
  }
  if (!cuerpo.length) cuerpo.push(el('p', { texto: 'Las fuentes consultadas no recogen confusiones para esta especie. Ante la duda, no la comas.' }));
  return el('section', { clase: 'aviso-peligro confusiones-caja', attrs: { 'aria-labelledby': 'titulo-confusiones' } },
    icono('i-aviso'), el('div', {}, el('h2', { id: 'titulo-confusiones', texto: 'Puede confundirse con' }), ...cuerpo));
}

export function fraseIndice(ix) {
  if (!ix) return null;
  let s = `Sale con ${ix.pmin}–${ix.pfull}${nbsp}mm en unas 4 semanas y unos ${ix.topt}${nbsp}°C`;
  if (ix.trango) s += ` (entre ${ix.trango[0]} y ${ix.trango[1]}${nbsp}°C)`;
  if (ix.desfase) s += `. Le sienta mejor la lluvia fuerte de hace ${ix.desfase[0]} a ${ix.desfase[1]} días`;
  return `${s}. Confianza ${ix.confianza}: ${BASES[ix.base] ?? ix.base}.`;
}
function indice(e, datos) {
  const ix = e.indice;
  if (!ix) return e.sinIndice ? seccion('Índice de fructificación', el('p', { clase: 'texto-2', texto: `Sin índice: ${e.sinIndice}` })) : null;
  const a = ix.analogo ? datos.porId[ix.analogo] : null;
  return seccion('Índice de fructificación',
    el('p', { texto: fraseIndice(ix) }),
    a ? el('p', { clase: 'texto-2' }, 'Parámetros copiados de ', el('a', { href: `#especie/${encodeURIComponent(a.id)}` }, latin(a.nombre)), '; la temporada es la suya.') : null,
    el('p', { clase: 'texto-2 texto-s', texto: 'El índice mide la oportunidad meteorológica, no la producción del monte.' }));
}

const REGLA_6H = 'Si los síntomas empezaron más de 6 horas después de comer, es una URGENCIA GRAVE, aunque luego te encuentres mejor. No esperes: llama al 112.';
function sindrome(e, datos) {
  if (!e.sindrome) return null;
  const s = datos.sindromes?.find((x) => x.id === e.sindrome);
  const partes = [];
  if (s) {
    const riesgo = s.gravedad === 'grave' ? 'alto' : s.gravedad === 'moderada' ? 'medio' : s.gravedad;
    partes.push(el('h3', { texto: s.nombre }),
      el('p', { clase: 'etiquetas' }, el('span', { clase: 'chip-riesgo', attrs: { 'data-riesgo': riesgo }, texto: `Gravedad ${s.gravedad}` }),
        etiqueta(`${s.latencia ? `Latencia: ${s.latencia}` : 'Latencia: no indicada'}${s.verificado === false ? ' (sin verificar)' : ''}`, s.verificado === false ? 'ocre' : null)),
      el('p', { texto: s.texto }),
      s.fuentes?.length ? el('p', { clase: 'texto-2 texto-s' }, 'Fuentes: ', ...s.fuentes.flatMap((f, i) => [i ? ' · ' : null, enlace(f.url, f.titulo ?? f.id ?? 'fuente'), f.consultado ? ` (${f.consultado})` : null])) : null);
  }
  const grave = e.categoria === 'toxica' || e.categoria === 'mortal' || s?.gravedad === 'grave' || s?.gravedad === 'mortal';
  return seccion('Síntomas e intoxicación', ...partes,
    grave ? aviso('aviso-peligro', icono('i-aviso'), el('p', {}, el('strong', { texto: 'Regla de las 6 horas. ' }), REGLA_6H)) : null,
    el('p', {}, el('a', { href: '#seguridad', texto: 'Qué hacer si hay síntomas' })));
}

function fuentes(e) {
  if (!e.fuentes?.length) return null;
  const ul = el('ul', { clase: 'ficha-lista' });
  for (const f of e.fuentes) {
    const li = el('li', {});
    if (f.urlVerificada === false || !urlSegura(f.url)) li.append(el('span', { texto: f.titulo ?? f.id }), ' (enlace no verificado)');
    else li.append(enlace(f.url, f.titulo ?? f.id));
    if (f.consultado) li.append(el('span', { clase: 'texto-2', texto: ` · consultado el ${f.consultado}` }));
    ul.append(li);
  }
  return seccion('Fuentes', ul);
}

const notas = (e) => (e.notas?.length ? seccion('Notas de las fuentes', lista(e.notas)) : null);

export function fichaEspecie(e, datos) {
  const trucos = el('div', { id: 'trucos-especie', attrs: { 'data-montaje': 'trucos' } });
  const t = ganchos.trucos?.(e, datos);
  if (t) trucos.append(t);
  return el('article', { clase: 'ficha', attrs: { 'aria-labelledby': 'titulo-especie' } },
    el('a', { clase: 'volver', href: '#especies' }, icono('i-atras'), 'Especies'),
    el('div', { clase: 'pila-l' },
      el('div', { clase: 'pila' }, cabecera(e), banner(e), galeria(e), precauciones(e)),
      datosDeCampo(e, datos), trucos, confusiones(e, datos), sindrome(e, datos), indice(e, datos), notas(e), fuentes(e),
      el('p', {}, el('a', { href: '#seguridad', texto: 'Reglas de seguridad' })),
      el('footer', { clase: 'ficha-pie' }, avisoDuda(), botonToxicologia())));
}

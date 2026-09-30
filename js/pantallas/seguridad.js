// Pantalla «Seguridad»: texto completo del bloque C de docs/investigacion/02-especies.md.
// No se resume ni se suaviza nada: si se cambia el texto, hay que cambiarlo primero en la investigación.
import { el, icono } from '../ui/dom.js';
import { TOXICOLOGIA } from '../ui/seguridad.js';

const nbsp = ' ';
const fuerte = (t) => el('strong', { texto: t });
const latin = (t) => el('span', { clase: 'latin', texto: t });
const lista = (items, ordenada = false, inicio = 1) => el(ordenada ? 'ol' : 'ul', { clase: 'seguridad-lista', ...(ordenada ? { start: inicio } : {}) }, items.map((i) => el('li', {}, ...[i].flat())));

const ANTES = [
  [fuerte('Esta app no identifica setas.'), ' Es una ayuda de campo. Nunca comas una seta porque la app, una foto o una web la dé por comestible. Si no estás ', fuerte('absolutamente seguro'), ', déjala en el monte o llévala a una sociedad micológica.'],
  ['Aprende primero ', fuerte('las mortales'), ' (amanitas blancas y verdes, lepiotas pequeñas, galerinas, cortinarios naranjas, giromitra). Conocer las comestibles no basta.'],
  [fuerte('Mira la normativa del monte.'), ` Muchas zonas exigen permiso: los montes Micocyl en Castilla y León, Valsaín (Orden AAA/1681/2016), el Parque Nacional de Guadarrama (prohibido en zonas de Reserva y de Uso Restringido A) y municipios de Madrid como Rascafría, Miraflores o Lozoya. Recoger sin permiso en el Parque Nacional se sanciona con `, fuerte(`1.001–3.000${nbsp}€`), '. ', fuerte('En el Hayedo de Montejo está prohibido recolectar hongos'), '. En Castilla-La Mancha rige la Orden de 15/11/2016.'],
];
const MONTE = [
  ['Recoge ', fuerte('el ejemplar entero'), ' (sin arrancar a lo bruto: excava con cuidado) para ver la ', fuerte('base del pie'), ' (volva). Muchas regulaciones exigen ', fuerte('cortar y no arrancar'), ', así que primero comprueba qué pide el monte.'],
  ['Usa ', fuerte('cesta'), ', nunca bolsa de plástico.'],
  [fuerte('No mezcles'), ' especies dudosas con las seguras en la misma cesta. Un trozo de ', latin('Amanita phalloides'), ' basta para intoxicar.'],
  ['No recojas ejemplares ', fuerte('viejos, agusanados, helados o empapados'), ', ni en ', fuerte('cunetas, carreteras o zonas industriales'), ' (metales pesados).'],
  ['No recojas ', fuerte('huevos cerrados de '), latin('Amanita'), ' ni ', fuerte('parasoles cerrados o de menos de 10 cm'), '.'],
  ['Prohibido recoger de noche en montes Micocyl y en días de cacerías colectivas.'],
];
const DESCARTE = [
  [fuerte('Láminas blancas + anillo + volva → NUNCA.'), ' (', latin('Amanita'), ')'],
  [fuerte('«Champiñón» con láminas blancas → NUNCA.')],
  [fuerte('«Parasol» de menos de 10 cm o con escamas rosadas → NUNCA.'), ' (', latin('Lepiota'), ')'],
  [fuerte('Seta pequeña parda con anillo sobre madera → NUNCA.'), ' (', latin('Galerina'), ')'],
  [fuerte('Cortina (telaraña) + esporada herrumbre → NUNCA.'), ' (', latin('Cortinarius'), ')'],
  [fuerte('«Níscalo» con látex blanco → NUNCA.')],
  [fuerte('«Colmenilla» que no es hueca de arriba abajo → NUNCA.'), ' (', latin('Gyromitra'), ')'],
  [fuerte('Toda seta amarilla de pinar con láminas amarillas → NUNCA.'), ' (', latin('T. equestre'), ')'],
  [fuerte('Boleto con poros rojos o carne que azulea → no recomendado.')],
  [fuerte('Seta blanca de primavera en prado que enrojece → NUNCA.'), ' (', latin('Inosperma'), ')'],
];
const CASA = [
  [fuerte('Cocina siempre las setas silvestres'), '; ninguna se come cruda (', latin('Morchella'), ', ', latin('Amanita rubescens'), ', pie azul…).'],
  ['Come ', fuerte('cantidades moderadas'), ' y ', fuerte('no durante varios días seguidos'), ' (rabdomiólisis, ', latin('Morchella'), ').'],
  [fuerte('Guarda uno o dos ejemplares crudos'), ' de cada especie en la nevera, ', fuerte('al menos 72 horas'), ', por si hubiera que identificarlos. Hay síntomas que aparecen hasta 3 días después.'],
  ['No des setas silvestres a niños, embarazadas, ancianos ni personas con enfermedad hepática o renal.'],
  ['No tomes ', fuerte('alcohol'), ' con setas que no conozcas bien (síndrome coprínico).'],
];
const SINTOMAS = [
  [fuerte('Llama al 112 o ve a urgencias'), ', y consulta al ', fuerte(`SIT: ${TOXICOLOGIA.telVisible}`), '.'],
  [fuerte('Lleva los restos'), ': setas crudas, restos cocinados, peladuras e incluso vómito.'],
  [fuerte('Si los síntomas empezaron más de 6 horas después de comer, es una URGENCIA GRAVE'), ', aunque luego te encuentres mejor (amatoxinas, orellanina). ', fuerte('No esperes.')],
  ['Avisa a todas las personas que comieron del mismo plato, aunque no tengan síntomas.'],
  ['No tomes remedios caseros (leche, vinagre, ajo…) ni te provoques el vómito sin indicación médica.'],
];
const FUENTES = [
  ['Ministerio de Justicia, INTCF: Servicio de Información Toxicológica', 'https://www.mjusticia.gob.es/es/institucional/organismos/instituto-nacional/servicios/servicio-informacion/servicio-informacion1'],
  ['Micocyl: condiciones generales de recolección', 'https://www.micocyl.es/print/788'],
  ['Comunidad de Madrid: normativa ambiental en actividades micológicas', 'https://www.comunidad.madrid/node/67110'],
  ['Orden AAA/1681/2016 (Valsaín) y PRUG del Parque Nacional de Guadarrama', 'https://boe.es/boe/dias/2016/10/22/pdfs/BOE-A-2016-9680.pdf'],
  ['Normas de visita del Hayedo de Montejo (sept. 2024)', 'https://sierradelrincon.org/wp-content/uploads/2024/09/2409NormasSeptiembre2024Maquetadas.pdf'],
  ['Castilla-La Mancha: Orden de 15/11/2016, recolección de setas silvestres', 'https://vlex.es/vid/orden-15-11-2016-653557269'],
  ['Kalač (2010), metales pesados en setas comestibles europeas', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9505289/'],
  ['Santé publique France: morillas y síndrome neurológico', 'https://www.santepubliquefrance.fr/docs/can-morels-morchella-sp.-induce-a-toxic-neurological-syndrome'],
  ['Revista Nefrología: fracaso renal agudo tras la ingesta de setas', 'https://revistanefrologia.com/es-acute-renal-failure-after-intake-articulo-X2013251408005787'],
];

const bloque = (titulo, ...hijos) => el('section', { clase: 'tarjeta ficha-seccion' }, el('h2', { clase: 'ficha-seccion__titulo', texto: titulo }), ...hijos);

export function pintar() {
  const telefonos = el('section', { clase: 'aviso-peligro seguridad-telefonos', attrs: { 'aria-labelledby': 'titulo-telefonos' } }, icono('i-aviso'),
    el('div', {}, el('h2', { id: 'titulo-telefonos', texto: 'Teléfonos de urgencia' }),
      el('ul', { clase: 'seguridad-lista seguridad-lista--sin' },
        el('li', {}, fuerte('Emergencias: '), el('a', { clase: 'tabular', href: 'tel:112', texto: '112' }), '.'),
        el('li', {}, fuerte('Servicio de Información Toxicológica (INTCF): '), el('a', { clase: 'tabular', href: `tel:+34${TOXICOLOGIA.tel}`, texto: TOXICOLOGIA.telVisible }),
          '. Atiende las 24 horas, todos los días del año, al público general. Las consultas urgentes solo se atienden por teléfono, no por correo.'),
        el('li', {}, fuerte('91 411 26 76: solo para profesionales sanitarios'), ', no es para el público.'))));

  // Las reglas de «en el monte» continúan la numeración de «antes de salir» (1 a 3, 4 a 9), y las de «en casa», la 10.
  let n = 1;
  const continuar = (items) => { const inicio = n; n += items.length; return lista(items, true, inicio); };
  const antes = continuar(ANTES), monte = continuar(MONTE);
  const descarte = el('ul', { clase: 'seguridad-lista seguridad-lista--descarte' }, DESCARTE.map((i) => el('li', {}, ...i)));
  const casa = continuar(CASA), sintomas = continuar(SINTOMAS);

  return el('article', { clase: 'ficha', attrs: { 'aria-labelledby': 'titulo-seguridad' } },
    el('a', { clase: 'volver', href: '#especies' }, icono('i-atras'), 'Especies'),
    el('div', { clase: 'pila-l' },
      el('header', { clase: 'portada' }, el('h1', { id: 'titulo-seguridad', texto: 'Seguridad' }),
        el('p', { clase: 'portada__sub', texto: 'Ante la duda, no la comas. Esta app es una ayuda de campo y no identifica setas.' })),
      telefonos,
      bloque('Antes de salir', antes),
      bloque('En el monte', monte),
      el('section', { clase: 'aviso-peligro', attrs: { 'aria-labelledby': 'titulo-descarte' } }, icono('i-aviso'),
        el('div', {}, el('h2', { id: 'titulo-descarte', texto: 'Reglas de descarte' }), descarte)),
      bloque('En casa', casa),
      bloque('Si hay síntomas', sintomas),
      bloque('Fuentes', el('ul', { clase: 'ficha-lista' }, FUENTES.map(([t, u]) => el('li', {}, el('a', { href: u, rel: 'noopener', target: '_blank', texto: t }))))),
      el('p', { clase: 'texto-2 texto-s', texto: 'Texto de la investigación (sección C de docs/investigacion/02-especies.md), fuentes consultadas el 30 de septiembre de 2026.' })));
}

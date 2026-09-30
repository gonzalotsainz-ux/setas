// Lista de especies: buscador, pestañas por categoría, filtros de zona y «Sale este mes».
import { el, icono, mayus } from '../ui/dom.js';
import { chipCategoria, comun, imagen, creditoCompacto } from '../ui/ficha.js';
import { nombreCorto } from '../datos.js';
import { hoyMadrid } from '../meteo.js';

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// Busca por nombre científico, sinónimos y nombres comunes (castellano y euskera), sin tildes ni mayúsculas.
export function buscarEspecies(texto, especies) {
  const q = normalizar(texto).trim();
  if (!q) return especies;
  return especies.filter((e) => [e.nombre, ...(e.sinonimos ?? []), ...Object.values(e.comunes ?? {}).flat()].some((n) => normalizar(n).includes(q)));
}

const PESTANAS = [
  { id: 'comestibles', texto: 'Comestibles', categorias: ['comestible'] },
  { id: 'precaucion', texto: 'Precaución y no recomendadas', categorias: ['comestible-precaucion', 'no-recomendada'] },
  { id: 'toxicas', texto: 'Tóxicas y mortales', categorias: ['toxica', 'mortal'] },
];
const ORDEN_CAT = { mortal: 0, toxica: 1, 'no-recomendada': 2, 'comestible-precaucion': 3, comestible: 4 };
const ui = { texto: '', pestana: 'comestibles', zona: '', mes: false };   // se conserva al repintar

export function filtrar(especies, { texto, pestana, zona, mes }, mesActual) {
  const buscando = normalizar(texto).trim() !== '';
  const cats = PESTANAS.find((p) => p.id === pestana)?.categorias;
  return buscarEspecies(texto, especies)
    .filter((e) => buscando || cats.includes(e.categoria))   // al buscar se mira en todas las categorías
    .filter((e) => !zona || (e.zonas?.[zona] && e.zonas[zona].presencia !== 'sin-registros'))
    .filter((e) => !mes || e.temporada?.meses?.includes(mesActual))
    .sort((a, b) => ORDEN_CAT[a.categoria] - ORDEN_CAT[b.categoria] || comun(a).localeCompare(comun(b), 'es'));
}

function tarjeta(e) {
  const f = e.fotos?.[0];
  const mortal = e.categoria === 'mortal';
  return el('li', { clase: `especie-item${mortal ? ' especie-item--mortal' : ''}` }, el('a', { clase: 'especie-tarjeta', href: `#especie/${encodeURIComponent(e.id)}`, attrs: { 'data-categoria': e.categoria } },
    f ? imagen(f, `${e.nombre}${f.taxonFoto ? ` (foto de ${f.taxonFoto})` : ''}`) : el('span', { clase: 'especie-tarjeta__foto especie-tarjeta__foto--vacia texto-s', texto: 'Sin foto' }),
    el('span', { clase: 'especie-tarjeta__texto' },
      el('span', { clase: 'especie-tarjeta__comun', texto: mayus(comun(e)) }),
      el('span', { clase: 'latin especie-tarjeta__latin', texto: e.nombre }),
      chipCategoria(e.categoria))), f ? creditoCompacto(f) : null);
}

export function pintar({ estado }) {
  const datos = estado.datos;
  const mesActual = Number(hoyMadrid().slice(5, 7));
  const resultados = el('div', { attrs: { 'aria-live': 'polite' } });

  function calcular() {
    const lista = filtrar(datos.especies, ui, mesActual);
    const buscando = normalizar(ui.texto).trim() !== '';
    resultados.replaceChildren(
      el('p', { clase: 'texto-2 texto-s', texto: `${lista.length} ${lista.length === 1 ? 'especie' : 'especies'}${buscando ? ' en todas las categorías' : ''}` }),
      lista.length
        ? el('ul', { clase: 'especies-rejilla' }, lista.map(tarjeta))
        : el('p', { clase: 'tarjeta texto-2', texto: 'Ninguna especie coincide con estos filtros.' }));
  }

  const buscador = el('input', { id: 'buscar-especie', type: 'search', value: ui.texto, placeholder: 'Nombre, sinónimo o euskera', attrs: { autocomplete: 'off', enterkeyhint: 'search' } });
  buscador.addEventListener('input', () => { ui.texto = buscador.value; pestanas.classList.toggle('chips--inactivas', normalizar(ui.texto).trim() !== ''); calcular(); });

  const zonaSel = el('select', { id: 'filtro-zona' }, el('option', { value: '', texto: 'Todas las zonas' }),
    datos.zonas.map((z) => el('option', { value: z.id, texto: nombreCorto(z) })));
  zonaSel.value = ui.zona;
  zonaSel.addEventListener('change', () => { ui.zona = zonaSel.value; calcular(); });

  const pestanas = el('div', { clase: 'chips', attrs: { role: 'group', 'aria-label': 'Categoría' } });
  for (const p of PESTANAS) {
    const b = el('button', { clase: 'chip', type: 'button', texto: p.texto, attrs: { 'aria-pressed': String(p.id === ui.pestana) } });
    b.addEventListener('click', () => { ui.pestana = p.id; ui.texto = ''; buscador.value = ''; pestanas.classList.remove('chips--inactivas'); pestanas.querySelectorAll('.chip').forEach((c, k) => c.setAttribute('aria-pressed', String(PESTANAS[k].id === ui.pestana))); calcular(); });
    pestanas.append(b);
  }
  const mes = el('button', { clase: 'chip', type: 'button', texto: 'Sale este mes', attrs: { 'aria-pressed': String(ui.mes) } });
  mes.addEventListener('click', () => { ui.mes = !ui.mes; mes.setAttribute('aria-pressed', String(ui.mes)); calcular(); });

  pestanas.classList.toggle('chips--inactivas', normalizar(ui.texto).trim() !== '');
  calcular();
  return el('div', {},
    el('section', { clase: 'portada' }, el('h1', { texto: 'Especies' }),
      el('p', { clase: 'portada__sub' }, 'Fichas con sus confusiones peligrosas. ', el('a', { href: '#seguridad', texto: 'Reglas de seguridad' }))),
    el('div', { clase: 'pila-l' },
      el('div', { clase: 'controles' },
        el('label', { clase: 'campo', htmlFor: 'buscar-especie' }, 'Buscar', buscador),
        pestanas,
        el('div', { clase: 'controles__fila' }, el('label', { clase: 'campo', htmlFor: 'filtro-zona' }, 'Zona', zonaSel), mes)),
      resultados));
}

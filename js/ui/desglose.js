// Desglose del índice: cada factor con su valor, una barra y una frase clara, y la fórmula con los números reales.
import { PESOS } from '../indice.js';
import { el } from './dom.js';

const NOMBRES = {
  fW: ['fW', 'Lluvia de 26 días'], fR: ['fR', 'Episodio de lluvia'], fT: ['fT', 'Temperatura'], fS: ['fS', 'Humedad del suelo'],
  fA: ['fA', 'Arranque de temporada'], fC: ['fC', 'Calendario'], pen: ['pen', 'Penalizaciones'],
};
const ORDEN = ['fW', 'fR', 'fT', 'fS', 'fA', 'fC', 'pen'];
const num = (x) => x.toFixed(2).replace('.', ',');
const nbsp = ' ';

// Reparte las frases de `explicacion` entre los factores. Su orden es fijo: lluvia, episodio, temperatura y suelo;
// después, opcionalmente, «Temporada sin arrancar»; y el resto son penalizaciones.
function frases(r) {
  const e = r.explicacion, f = r.factores, resto = e.slice(4);
  const arranque = resto.find((x) => x.startsWith('Temporada sin arrancar'));
  const pens = resto.filter((x) => x !== arranque);
  const { Pagosto } = r.datos;
  return {
    fW: e[0], fR: e[1], fT: e[2], fS: e[3],
    fA: arranque ?? (Pagosto != null ? `${Math.round(Pagosto)}${nbsp}mm desde el 1 de agosto: la temporada ya ha arrancado.` : 'Especie de primavera: no depende del arranque de otoño.'),
    fC: f.fC === 1 ? 'Estamos en su temporada.' : 'Al borde de su temporada: cuenta a medias.',
    pen: pens.length ? pens.join('. ') : 'Ni heladas, ni ambiente secante, ni calor persistente.',
  };
}

// Datos puros (sin DOM): factores, fórmula y comprobación de que salen los puntos de la nota.
export function filasDesglose(r) {
  if (r.datos && Object.keys(r.datos).length === 0) {
    return { fueraDeTemporada: true, filas: [], formula: null, calculado: r.valor, valor: r.valor, frase: r.explicacion[0] };
  }
  const f = r.factores, txt = frases(r);
  const filas = ORDEN.map((k) => ({ clave: k, codigo: NOMBRES[k][0], nombre: NOMBRES[k][1], valor: f[k], frase: f[k] == null && k === 'fS' ? txt.fS : txt[k] }));
  const usados = ['fW', 'fT', 'fS', 'fR'].filter((k) => f[k] != null), total = usados.reduce((t, k) => t + PESOS[k], 0);
  const exps = Object.fromEntries(usados.map((k) => [k, PESOS[k] / total]));
  const geo = usados.reduce((b, k) => b * f[k] ** exps[k], 1);
  const calculado = Math.round(100 * geo * f.fA * f.fC * f.pen);
  const partes = usados.map((k) => `${k}${nbsp}${num(f[k])}^${num(exps[k])}`);
  const formula = `I = 100 · ${partes.join(' · ')} · fA ${num(f.fA)} · fC ${num(f.fC)} · pen ${num(f.pen)} = ${calculado}`;
  return { fueraDeTemporada: false, filas, formula, calculado, valor: r.valor, sinSuelo: f.fS == null };
}


export function desglose(r) {
  const d = filasDesglose(r), raiz = el('div', { clase: 'desglose' });
  if (d.fueraDeTemporada) { raiz.append(el('p', { clase: 'texto-2', texto: `${d.frase}: el índice es 0 hasta que empiece su temporada.` })); return raiz; }
  raiz.append(el('h4', { clase: 'desglose__titulo', texto: `Por qué sale ${r.valor}` }));
  const ul = el('ul', { clase: 'factores' });
  for (const fila of d.filas) {
    const li = el('li', { clase: 'factor' });
    const cod = el('span', { clase: 'factor__codigo' });
    if (fila.codigo === 'pen') cod.textContent = 'pen'; else cod.append('f', el('sub', { texto: fila.codigo[1] }));
    li.append(cod, el('span', { clase: 'factor__nombre', texto: fila.nombre }),
      el('span', { clase: 'factor__valor', texto: fila.valor == null ? 'sin dato' : num(fila.valor) }), el('span', { clase: 'factor__frase', texto: fila.frase }));
    if (fila.valor != null) { const b = el('span', { clase: 'factor__barra' }); b.style.setProperty('--v', String(Math.max(0, Math.min(1, fila.valor)))); b.setAttribute('aria-hidden', 'true'); li.append(b); }
    ul.append(li);
  }
  raiz.append(ul, el('p', { clase: 'formula', texto: d.formula }));
  if (d.sinSuelo) raiz.append(el('p', { clase: 'texto-2 texto-s', texto: 'Sin climatología del suelo: los otros tres pesos se reparten el suyo.' }));
  return raiz;
}

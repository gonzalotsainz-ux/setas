// Desglose del índice: cada factor con su valor, una barra y una frase clara, y la fórmula con los números reales.
import { PESOS } from '../indice.js';

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

function el(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; }

export function desglose(r) {
  const d = filasDesglose(r), raiz = el('div', 'desglose');
  if (d.fueraDeTemporada) { raiz.append(el('p', 'texto-2', `${d.frase}: el índice es 0 hasta que empiece su temporada.`)); return raiz; }
  raiz.append(el('h4', 'desglose__titulo', `Por qué sale ${r.valor}`));
  const ul = el('ul', 'factores');
  for (const fila of d.filas) {
    const li = el('li', 'factor');
    const cod = el('span', 'factor__codigo');
    cod.innerHTML = fila.codigo === 'pen' ? 'pen' : `f<sub>${fila.codigo[1]}</sub>`;
    li.append(cod, el('span', 'factor__nombre', fila.nombre),
      el('span', 'factor__valor', fila.valor == null ? 'sin dato' : num(fila.valor)), el('span', 'factor__frase', fila.frase));
    if (fila.valor != null) { const b = el('span', 'factor__barra'); b.style.setProperty('--v', String(Math.max(0, Math.min(1, fila.valor)))); b.setAttribute('aria-hidden', 'true'); li.append(b); }
    ul.append(li);
  }
  raiz.append(ul, el('p', 'formula', d.formula));
  if (d.sinSuelo) raiz.append(el('p', 'texto-2 texto-s', 'Sin climatología del suelo: los otros tres pesos se reparten el suyo.'));
  return raiz;
}

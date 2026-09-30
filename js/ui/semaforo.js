// Semáforo del índice. El nivel se deriva del valor numérico en UN solo sitio: nivelDe.
export const NIVELES = ['nulo', 'bajo', 'posible', 'bueno', 'muy-bueno'];
const PALABRA = { nulo: 'Nulo', bajo: 'Bajo', posible: 'Posible', bueno: 'Bueno', 'muy-bueno': 'Muy bueno', 'sin-datos': 'Sin datos' };

export function nivelDe(valor) {
  if (valor == null || Number.isNaN(valor)) return 'sin-datos';
  return NIVELES[Math.min(4, Math.max(0, Math.floor(valor / 20)))];
}
export const palabraDe = (nivel) => PALABRA[nivel];

// semaforo(valor|null, etiqueta?) → <span class="semaforo" data-nivel>. Sin valor: «Sin datos», sin número.
export function semaforo(valor, etiqueta = null) {
  const nivel = nivelDe(valor);
  const el = document.createElement('span');
  el.className = `semaforo semaforo--${nivel}`;
  el.dataset.nivel = nivel;
  const barras = document.createElement('span');
  barras.className = 'semaforo__icono';
  barras.setAttribute('aria-hidden', 'true');
  barras.innerHTML = '<i></i><i></i><i></i><i></i>';
  el.append(barras, nivel === 'sin-datos' ? 'Sin datos' : (etiqueta ?? PALABRA[nivel]));
  return el;
}

// Hojas inferiores (diálogos modales): una pila; Escape cierra la de encima y cambiar de pantalla las cierra todas.
import { el } from './dom.js';
import { nuevaId } from '../diario.js';

const abiertas = new Set();
window.addEventListener('hashchange', () => { for (const h of [...abiertas]) h.cerrar(); });

export function abrirHoja(titulo, { encima = false } = {}) {
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

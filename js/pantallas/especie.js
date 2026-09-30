// Pantalla «Especie»: ficha completa de #especie/<id>.
import { fichaEspecie, ganchos } from '../ui/ficha.js';
import { trucosEspecie } from '../ui/sitios.js';
import { el, icono } from '../ui/dom.js';

ganchos.trucos = trucosEspecie;   // sección «Trucos para encontrarla» (tarea 15b)

export function pintar({ estado, param }) {
  const e = estado.datos.porId[param];
  if (!e) {
    return el('section', { clase: 'tarjeta', attrs: { style: 'margin-top: var(--esp-6)' } },
      el('h2', { texto: 'Especie no encontrada' }), el('p', { texto: 'No hay ninguna ficha con ese nombre.' }),
      el('a', { clase: 'volver', href: '#especies' }, icono('i-atras'), 'Volver a Especies'));
  }
  return fichaEspecie(e, estado.datos);
}

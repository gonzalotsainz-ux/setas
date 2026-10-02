// Casillas «Compartir con…» de una salida: un grupo por fila, con la opción «solo la zona» (sin el punto exacto).
import { el } from './dom.js';
import { comparticionesDesdeMapa } from '../grupos.js';

// `grupos`: filas de mis_grupos(). `seleccion`: Map grupo_id → ubicacion_exacta (los grupos ya marcados).
export function selectorGrupos({ grupos, seleccion = new Map() }) {
  const estado = new Map(seleccion);
  const filas = grupos.map((g) => {
    const marca = el('input', { type: 'checkbox', id: `comp-${g.grupo_id}`, checked: estado.has(g.grupo_id) });
    const soloZona = el('input', { type: 'checkbox', id: `comp-z-${g.grupo_id}`, checked: estado.get(g.grupo_id) === false });
    const sub = el('label', { clase: 'diario-comp__zona', htmlFor: soloZona.id, hidden: !marca.checked }, soloZona, ' Solo la zona (sin el punto exacto)');
    marca.addEventListener('change', () => {
      if (marca.checked) estado.set(g.grupo_id, !soloZona.checked); else estado.delete(g.grupo_id);
      sub.hidden = !marca.checked;
    });
    soloZona.addEventListener('change', () => { if (marca.checked) estado.set(g.grupo_id, !soloZona.checked); });
    return el('li', { clase: 'diario-comp' }, el('label', { htmlFor: marca.id }, marca, ` ${g.nombre}`), sub);
  });
  return { nodo: el('ul', { clase: 'diario-lista' }, ...filas), valor: () => comparticionesDesdeMapa(estado) };
}

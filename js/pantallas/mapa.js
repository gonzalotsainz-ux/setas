// Pantalla «Mapa»: IGN + cotos por precisión, zonas prohibidas, lluvia por punto y leyenda.
import { crearMapa, leyenda } from '../mapa.js';
import { el, icono } from '../ui/dom.js';

// Lo que la usuaria toca se conserva al repintar (la previsión llega después del primer pintado).
const guardado = { vista: null, base: null, activas: null, enfocada: null };
let actual = null;

function cerrar() { actual?.destruir(); actual = null; }
window.addEventListener('hashchange', () => {
  if (!location.hash.startsWith('#mapa')) { cerrar(); guardado.enfocada = null; }
});

export async function pintar({ estado, param }) {
  const datos = estado.datos, meteo = estado.meteo;
  const lienzo = el('div', { clase: 'mapa', attrs: { role: 'region', 'aria-label': 'Mapa de zonas, cotos y prohibiciones' } });
  const avisos = el('div', { clase: 'mapa-avisos' });
  lienzo.addEventListener('mapa-error', (e) => avisos.replaceChildren(el('div', { clase: 'aviso' }, icono('i-aviso'), el('p', { texto: e.detail }))));
  if (!meteo?.series) {
    avisos.append(el('div', { clase: 'aviso' }, icono('i-aviso'), el('p', { texto: meteo?.error ? 'No hay previsión: los puntos salen sin nota.' : 'Esperando la previsión: los puntos saldrán con su nota en unos segundos.' })));
  }
  const nuevo = await crearMapa(lienzo, {
    datos, meteo, umbrales: estado.umbrales ?? {}, ...guardado,
    onCambio: (c) => Object.assign(guardado, c),
  });
  cerrar();
  actual = nuevo;
  if (param && param !== guardado.enfocada && nuevo.enfocarZona(param)) guardado.enfocada = param;

  return el('div', { clase: 'pila' },
    el('h1', { clase: 'mapa-titulo', texto: 'Mapa' }),
    lienzo, avisos, leyenda());
}

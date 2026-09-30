// Arranque, estado y router por hash.
import { cargarDatos, puntosDe } from './datos.js';
import { obtenerMeteo } from './meteo.js';
import { botonToxicologia, avisoDuda } from './ui/seguridad.js';
import { guardia } from './ui/carrera.js';

export const estado = { datos: null, meteo: null, sesion: null };
const pantallas = {
  hoy: () => import('./pantallas/hoy.js'), zona: () => import('./pantallas/zona.js'), mapa: () => import('./pantallas/mapa.js'),
  especies: () => import('./pantallas/especies.js'), especie: () => import('./pantallas/especie.js'),
  seguridad: () => import('./pantallas/seguridad.js'), diario: () => import('./pantallas/diario.js'), ajustes: () => import('./pantallas/ajustes.js'),
};
const carrera = guardia();   // un pintado asíncrono antiguo no puede pisar a uno más nuevo
const SECCION = { zona: 'mapa', especie: 'especies', seguridad: 'especies' };   // la sección de la barra que queda marcada

function error(raiz, titulo, detalle) {
  const t = document.createElement('div');
  t.className = 'tarjeta';
  t.style.marginTop = 'var(--esp-6)';
  t.append(Object.assign(document.createElement('h2'), { textContent: titulo }), Object.assign(document.createElement('p'), { textContent: detalle }));
  raiz.replaceChildren(t);
}

async function pintar(cambioDePantalla = false) {
  const ficha = carrera.nueva();
  const [nombre, param] = (location.hash.slice(1) || 'hoy').split('/');
  const cargar = pantallas[nombre] ?? pantallas.hoy;
  const raiz = document.getElementById('app');
  try {
    const m = await cargar();
    const nodo = await m.pintar({ estado, param: param && decodeURIComponent(param), refrescarMeteo });
    if (!carrera.vigente(ficha)) return;
    raiz.replaceChildren(nodo);
  } catch (e) {
    if (!carrera.vigente(ficha)) return;
    error(raiz, 'No se ha podido abrir esta pantalla', e.message);
  }
  const actual = SECCION[nombre] ?? nombre;
  document.querySelectorAll('.barra-nav a').forEach((a) => {
    if (a.hash === `#${actual}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (cambioDePantalla === true) { window.scrollTo(0, 0); raiz.focus({ preventScroll: true }); }
}

export async function refrescarMeteo() {
  try {
    estado.meteo = await obtenerMeteo(puntosDe(estado.datos.zonas));
  } catch (e) {
    estado.meteo = { hoy: null, series: null, dispersion: null, hora: null, desdeCache: false, error: e.message };
  }
  window.dispatchEvent(new Event('meteo'));
}

document.querySelector('[data-toxicologia]')?.replaceWith(botonToxicologia());
document.querySelector('[data-aviso-duda]')?.replaceWith(avisoDuda());
window.addEventListener('hashchange', () => pintar(true));
window.addEventListener('meteo', () => pintar(false));
try {
  estado.datos = await cargarDatos();
} catch (e) {
  error(document.getElementById('app'), 'No se han podido cargar los datos de la app', e.message);
  throw e;
}
await pintar();
refrescarMeteo();

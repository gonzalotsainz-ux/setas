// Arranque, estado y router por hash.
import { cargarDatos, puntosDe } from './datos.js';
import { obtenerMeteo, hoyMadrid } from './meteo.js';
import { pedirObservaciones, aplicarContraste, usarModeloDe } from './aemet.js';
import { botonToxicologia, avisoDuda } from './ui/seguridad.js';
import { guardia } from './ui/carrera.js';

// meteoBruta: lo que dice el modelo; meteo: lo mismo con la lluvia medida en estaciones AEMET donde la hay.
export const estado = { datos: null, meteo: null, meteoBruta: null, obs: null, obsError: null };
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

// Recalcula la meteo «efectiva» (con estaciones) a partir de la del modelo y las observaciones.
export function recalcularContraste() {
  estado.meteo = estado.datos && estado.meteoBruta
    ? aplicarContraste(estado.datos.zonas, estado.meteoBruta, estado.obs, usarModeloDe) : estado.meteoBruta;
}

// Lluvia medida en estaciones: 30 días hasta hoy, una sola llamada para todas las estaciones. Si falla, solo modelos.
async function cargarObservaciones() {
  const estaciones = [...new Set(estado.datos.zonas.flatMap((z) => (z.estacionesAemet ?? []).map((e) => e.id)))];
  if (!estaciones.length) return;
  const hasta = hoyMadrid(), desde = new Date(Date.parse(`${hasta}T12:00:00Z`) - 29 * 864e5).toISOString().slice(0, 10);
  try {
    estado.obs = await pedirObservaciones(estaciones, desde, hasta);
    estado.obsError = null;
  } catch (e) {
    estado.obs = null;
    estado.obsError = e.message;
  }
  recalcularContraste();
  window.dispatchEvent(new Event('meteo'));
}

export async function refrescarMeteo() {
  try {
    estado.meteoBruta = await obtenerMeteo(puntosDe(estado.datos.zonas));
  } catch (e) {
    estado.meteoBruta = { hoy: null, series: null, dispersion: null, hora: null, desdeCache: false, error: e.message };
  }
  recalcularContraste();
  window.dispatchEvent(new Event('meteo'));
  if (estado.meteoBruta.series) await cargarObservaciones();
}

document.querySelector('[data-toxicologia]')?.replaceWith(botonToxicologia());
document.querySelector('[data-aviso-duda]')?.replaceWith(avisoDuda());
window.addEventListener('hashchange', () => pintar(true));
window.addEventListener('meteo', () => pintar(false));
window.addEventListener('contraste', () => { recalcularContraste(); pintar(false); });   // «Usar modelo» cambiado en Zona
try {
  estado.datos = await cargarDatos();
} catch (e) {
  error(document.getElementById('app'), 'No se han podido cargar los datos de la app', e.message);
  throw e;
}
await pintar();
refrescarMeteo();

// Borradores del diario pendientes: se suben al cargar y, desde ahí, en los eventos online y visibilitychange.
try {
  const { colaBorradores } = await import('./diario.js');
  if (colaBorradores().todos().length) (await import('./pantallas/diario.js')).iniciarSincronizacion();
} catch { /* sin diario no se rompe la app */ }

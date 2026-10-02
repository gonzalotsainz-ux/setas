// Arranque, estado y router por hash.
import { cargarDatos, puntosDe } from './datos.js';
import { obtenerMeteo, hoyMadrid } from './meteo.js';
import { pedirObservaciones, aplicarContraste, usarModeloDe } from './aemet.js';
import { cargarPluvio, aplicarPluvio, combinarObs } from './pluvio.js';
import { botonToxicologia, avisoDuda } from './ui/seguridad.js';
import { guardia } from './ui/carrera.js';

// meteoBruta: lo que dice el modelo; meteo: lo mismo con la lluvia medida (pluviómetros y estaciones AEMET) donde la hay.
// obs: lo que devuelve la función «aemet» tal cual (con su marca __viejo); pluvio: pluvio/ultimo.json vigente o null.
export const estado = { datos: null, meteo: null, meteoBruta: null, obs: null, obsError: null, pluvio: null, umbrales: {} };
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
    // El mapa devuelve siempre el mismo nodo: volver a insertarlo le quitaría el foco (buscador) y cerraría sus popups.
    if (raiz.childNodes.length !== 1 || raiz.firstChild !== nodo) raiz.replaceChildren(nodo);
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

// Recalcula la meteo «efectiva»: la del modelo con la lluvia medida en pluviómetros y, encima, la de las estaciones AEMET.
export function recalcularContraste() {
  if (!estado.datos || !estado.meteoBruta) { estado.meteo = estado.meteoBruta; return; }
  const conPluvio = aplicarPluvio(estado.datos.zonas, estado.meteoBruta, estado.pluvio);
  estado.meteo = aplicarContraste(estado.datos.zonas, conPluvio, combinarObs(estado.obs, estado.pluvio), usarModeloDe);
}

// Lluvia medida: estaciones AEMET (30 días hasta hoy, una sola llamada) y pluviómetros (pluvio/ultimo.json), a la vez.
// Si algo falla, se sigue con lo que haya (en el peor caso, solo modelos).
async function cargarObservaciones() {
  const estaciones = [...new Set(estado.datos.zonas.flatMap((z) => (z.estacionesAemet ?? []).map((e) => e.id)))];
  const hasta = hoyMadrid(), desde = new Date(Date.parse(`${hasta}T12:00:00Z`) - 29 * 864e5).toISOString().slice(0, 10);
  const [obs, pluvio] = await Promise.allSettled([estaciones.length ? pedirObservaciones(estaciones, desde, hasta) : Promise.resolve(null), cargarPluvio()]);
  if (obs.status === 'fulfilled') { if (obs.value) { estado.obs = obs.value; estado.obsError = null; } }
  else estado.obsError = obs.reason?.message ?? String(obs.reason);   // se conservan las observaciones anteriores, si las hay
  // cargarPluvio no lanza y ya cae a la copia guardada si sigue vigente: null = sin archivo vigente (como antes)
  if (pluvio.status === 'fulfilled') estado.pluvio = pluvio.value;
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
  // Si faltó la climatología o la lluvia desde agosto, se reintenta solo eso cuando toque (obtenerMeteo lleva la
  // espera creciente de la climatología y no repite lo demás).
  clearTimeout(reintento);
  const cuando = Date.parse(estado.meteoBruta.proximoReintento ?? '');
  if (estado.meteoBruta.pendiente && Number.isFinite(cuando)) reintento = setTimeout(refrescarMeteo, Math.min(Math.max(0, cuando - Date.now()) + 30e3, 2 ** 31 - 1));
  if (estado.meteoBruta.series) await cargarObservaciones();
}
let reintento = null;

document.querySelector('[data-toxicologia]')?.replaceWith(botonToxicologia());
document.querySelector('[data-aviso-duda]')?.replaceWith(avisoDuda());
window.addEventListener('hashchange', () => pintar(true));
// La meteo solo cambia lo que enseñan Hoy, Zona y Mapa: en Ajustes, Especies o Diario no se repinta (se perdería lo escrito).
const PINTAN_METEO = new Set(['hoy', 'zona', 'mapa']);
window.addEventListener('meteo', () => {
  const nombre = (location.hash.slice(1) || 'hoy').split('/')[0];
  if (PINTAN_METEO.has(nombre in pantallas ? nombre : 'hoy')) pintar(false);
});
window.addEventListener('contraste', () => { recalcularContraste(); pintar(false); });   // «Usar modelo» cambiado en Zona
try {
  estado.datos = await cargarDatos();
} catch (e) {
  error(document.getElementById('app'), 'No se han podido cargar los datos de la app', e.message);
  throw e;
}
await pintar();
refrescarMeteo();

// Umbrales editados (compartidos): no bloquean el primer pintado; al llegar (aunque tarden) se repinta.
(async () => {
  try {
    const [{ supabase }, { cargarUmbrales }] = await Promise.all([import('./supabase.js'), import('./umbrales.js')]);
    const u = await cargarUmbrales(supabase);
    if (Object.keys(u).length) { estado.umbrales = u; pintar(false); }
  } catch { /* sin red: valen los de la investigación */ }
})();

// Borradores del diario pendientes: se suben al cargar y, desde ahí, en los eventos online y visibilitychange.
try {
  const { colaBorradores } = await import('./diario.js');
  if (colaBorradores().todos().length) (await import('./pantallas/diario.js')).iniciarSincronizacion();
} catch { /* sin diario no se rompe la app */ }

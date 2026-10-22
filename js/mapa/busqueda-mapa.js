// js/mapa/busqueda-mapa.js
// El buscador de la pantalla del mapa «como Google Maps» (spec §2): lo local (especies, zonas, montes, sitios y pueblos)
// al instante y cualquier lugar de España con CartoCiudad después. Elegir una zona o un monte cambia la ruta; un pueblo o
// un lugar lleva el mapa allí con una chincheta de búsqueda temporal y, si cae fuera de las zonas, lo dice la línea de aviso.
import { buscarEnMapa, crearBuscador, cargarPueblos } from './controles.js';
import { crearGeocodificador, coordenadasCartoCiudad, fueraDeZonas } from './geocodificador.js';
import { rutaMapa } from './ruta.js';

const ZOOM_LUGAR = 13;

// alChip(id) · alRuta(hash) (toque explícito: la pantalla lleva el foco a las migas) ·
// alLugar({ nombre, lat, lon, zoom, fuera, gota }) · alError(texto) · chips() = chips del día.
// Un lugar dentro de las zonas lo resuelve la pantalla (pasa a la zona que lo contiene, centra y pone la gota con
// ponerChincheta); fuera de ellas, aquí se pone la gota y la pantalla lo dice en la línea de aviso.
export function crearBusquedaMapa({ L, mapa, datos, chips, alChip, alRuta, alLugar, alError, vivo = () => true }) {
  const puntos = datos.zonas.flatMap((z) => z.puntos.map((p) => ({ ...p, zona: z.id })));
  let pueblos = [], pidiendoPueblos = null, chincheta = null, turno = 0;
  const geocodificador = crearGeocodificador();
  const fuentes = () => ({ pueblos, sitios: datos.sitios ?? [], especies: datos.especies, chips: chips(), zonas: datos.zonas, puntos });
  const quitarChincheta = () => { chincheta?.remove(); chincheta = null; };
  function ponerChincheta(lat, lon, nombre) {
    quitarChincheta();
    const icon = L.divIcon({ className: '', html: '<span class="chincheta chincheta--busqueda" aria-hidden="true"></span>', iconSize: [28, 36], iconAnchor: [14, 34] });
    chincheta = L.marker([lat, lon], { icon, title: nombre, keyboard: false, interactive: false, zIndexOffset: 2000 }).addTo(mapa);
  }
  // gota = false para los sitios (tienen su propia capa).
  function irALugar(nombre, lat, lon, zoom = ZOOM_LUGAR, gota = true) {
    const fuera = fueraDeZonas(lat, lon, datos.zonas);
    if (fuera && gota) ponerChincheta(lat, lon, nombre); else quitarChincheta();
    alLugar({ nombre, lat, lon, zoom, fuera, gota });
  }
  async function elegir(r) {
    const mio = ++turno;
    if (r.tipo === 'chip') { alChip(r.id); return; }
    if (r.tipo === 'zona') { alRuta(rutaMapa({ zona: r.id })); return; }
    if (r.tipo === 'punto') { alRuta(rutaMapa({ zona: r.zona, punto: r.id })); return; }
    if (r.tipo === 'sitio') { irALugar(r.texto, r.lat, r.lon, r.zoom, false); return; }
    if (r.tipo === 'pueblo') { irALugar(r.texto, r.lat, r.lon, r.zoom); return; }
    if (r.tipo !== 'lugar') return;
    try {
      const { lat, lon } = await coordenadasCartoCiudad(r);
      if (mio === turno && vivo()) irALugar(r.texto, lat, lon);
    } catch {
      if (mio === turno && vivo()) alError(`No se ha podido situar «${r.texto}» en el mapa (CartoCiudad no responde).`);
    }
  }
  const buscador = crearBuscador({ buscar: (t) => buscarEnMapa(t, fuentes()), buscarLejos: geocodificador.sugerir, alElegir: (r) => { elegir(r); } });
  // Los pueblos (data/pueblos.json) se piden al usar el buscador, no al abrir el mapa.
  function pedirPueblos() {
    pidiendoPueblos ??= cargarPueblos().then((p) => {
      pueblos = p;
      if (vivo() && document.activeElement === buscador.input && buscador.input.value) buscador.input.dispatchEvent(new Event('input'));
    }).catch(() => { pidiendoPueblos = null; });
  }
  buscador.input.addEventListener('focus', pedirPueblos);
  buscador.input.addEventListener('input', pedirPueblos);
  // invalidar(): la pantalla lo llama al cambiar la selección; una respuesta de CartoCiudad pendiente se descarta.
  return { ...buscador, ponerChincheta, quitarChincheta, invalidar: () => { turno++; } };
}

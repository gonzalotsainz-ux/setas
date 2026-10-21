// js/mapa/contenido-hoja.js
// Qué enseña la hoja fija según la selección (decisiones 13 y 15): sin selección, «Dónde ir»; con zona, la zona y sus
// montes; con monte, su ficha; un lugar buscado fuera de las zonas, el aviso con las más cercanas. Devuelve
// { modelo, extra } para crearHojaMapa().poner; las notas salen de las mismas filas que las chinchetas (sin DOM salvo
// los constructores perezosos del desglose y la gráfica).
import { modeloListaZonas, modeloZona, modeloMonte, modeloFueraDeZonas } from './modelos-hoja.js';
import { zonasMasCercanas } from './geocodificador.js';
import { notaPuntoDia } from '../notas-zona.js';
import { desglose } from '../ui/desglose.js';
import { graficoLluvia } from '../ui/grafico-lluvia.js';
import { el } from '../ui/dom.js';

export const COTO_COMPROBANDO = 'Comprobando los cotos de este monte…';
export const COTO_SIN_CARGAR = 'No se han podido cargar los cotos: comprueba la normativa de la zona.';

const graficoPunto = (serie, disp) => () => { const fig = el('figure', { clase: 'grafico' }); fig.innerHTML = graficoLluvia({ serie, dispersionPunto: disp, altura: 220 }); return fig; };

// sel = { zona, punto } (objetos); fuera = { nombre, lat, lon } | null; notas = { filas, d, filtro } del día;
// cotos = Map(punto.id → propiedades | null) | null (aún no) | 'error'; dHoy = días desde hoy (para «Previsión a +d»).
export function contenidoHoja({ sel, fuera = null, notas, datos, meteo, umbrales = {}, fecha, hoy, dHoy = 0, cotos = null }) {
  if (fuera) {
    const cerca = zonasMasCercanas(fuera.lat, fuera.lon, datos.zonas, 3).map((z) => z.id);
    const filas = notas.filas.filter((f) => cerca.includes(f.zona.id));
    return { modelo: modeloFueraDeZonas({ nombre: fuera.nombre, cercanas: modeloListaZonas({ filas, datos, fecha, hoy }).filas }), extra: {} };
  }
  if (!sel.zona) {
    const caducado = meteo?.series && meteo.hoy && meteo.hoy !== hoy ? meteo.hoy : null;
    return { modelo: modeloListaZonas({ filas: notas.filas, datos, fecha, hoy, caducado }), extra: {} };
  }
  const nota = (punto) => notaPuntoDia(sel.zona, punto, datos, meteo, notas.d, notas.filtro, umbrales);
  const cotoDe = (p) => (cotos instanceof Map ? cotos.get(p.id) ?? null : null);
  if (!sel.punto) {
    const fila = notas.filas.find((f) => f.zona.id === sel.zona.id);
    const montes = sel.zona.puntos.map((punto) => ({ punto, nota: nota(punto), coto: cotoDe(punto) }));
    return { modelo: modeloZona({ fila, montes, datos, d: dHoy }), extra: {} };
  }
  const { zona, punto } = sel, n = nota(punto);
  const modelo = modeloMonte({ zona, punto, nota: n, datos, d: dHoy, coto: cotoDe(punto) });
  // Sin los cotos cargados no se afirma que el monte esté fuera de ellos.
  if (cotos == null) modelo.coto = { texto: COTO_COMPROBANDO, url: null };
  else if (cotos === 'error') modelo.coto = { texto: COTO_SIN_CARGAR, url: null };
  const serie = meteo?.series?.[punto.id];
  return { modelo, extra: { desglose: n.mejor ? () => desglose(n.mejor.resultado) : null, grafico: serie ? graficoPunto(serie, meteo?.dispersion?.[punto.id] ?? null) : null } };
}

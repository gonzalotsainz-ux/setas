// Pantalla «Zona»: índice por punto, gráfico de lluvia, contraste de modelos, desglose por especie,
// calendario y normativa. Todo lo numérico pasa por semaforo()/nivelDe(); nada se inventa sin datos.
import { indiceZona, calcularIndice, DatosIncompletos } from '../indice.js';
import { hoyMadrid } from '../meteo.js';
import { fijarUsarModelo, avisoViejo } from '../aemet.js';
import { especiesDeZona, nombreCorto, puntosRecogibles, rotuloPunto } from '../datos.js';
import { semaforo, nivelDe } from '../ui/semaforo.js';
import { graficoLluvia } from '../ui/grafico-lluvia.js';
import { desglose } from '../ui/desglose.js';
import { fichaNormativa } from '../ui/normativa.js';
import { seccionDondeBuscar } from '../ui/sitios.js';
import { el, icono, etiqueta, mayus } from '../ui/dom.js';

const ZONA_HORARIA = 'Europe/Madrid';
const nbsp = ' ';
const ui = { punto: {}, abierta: {}, enfocarModelo: null };   // punto elegido y especie desplegada, por zona; se conservan al repintar
const MODELOS = { ecmwf_ifs: 'ECMWF', icon_seamless: 'ICON', gfs_seamless: 'GFS (NOAA)' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const comun = (e) => e.comunes?.es?.[0] ?? e.nombre;
const habitat = (h) => mayus(h.replaceAll('-', ' '));
const nombrePunto = (p) => p.nombre.replace(/\s*\([^)]*\)\s*$/, '');
const detalleNombre = (z) => z.nombre.match(/\(([^)]*)\)\s*$/)?.[1] ?? '';
const miles = (n) => Math.round(n).toLocaleString('es-ES');
const fecha = (f) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: ZONA_HORARIA }).format(new Date(`${f}T12:00:00Z`));
const hora = (iso) => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: ZONA_HORARIA }).format(new Date(iso));

const PELIGRO = /mortal|letal|phalloides|tóxic|toxic|envenen/i;
export const RESTRINGIDO = /prohib|solo con|exige|requiere|autorizaci|restring|vedad|reserva|no se han? (podido|encontrado|localizado)|sin (comprobar|verificar)|sin confirmar|pendiente de confirmaci|no consta/i;

const aviso = (texto, peligro) => el('div', { clase: peligro ? 'aviso-peligro' : 'aviso', attrs: { role: 'note' } }, icono(peligro ? 'i-aviso' : 'i-info'), el('p', { texto }));

// ---- Cálculo ----
function calcular(zona, datos, meteo, umbrales) {
  const series = Object.fromEntries(zona.puntos.map((p) => [p.id, meteo.series?.[p.id]]).filter(([, s]) => s));
  const primera = Object.values(series)[0];
  const especies = especiesDeZona(zona, datos.especies, umbrales);
  if (!primera) return { series, especies, res: null, porPunto: {} };
  // La nota de la zona sale solo de los puntos donde se puede ir; los NO IR tienen su nota propia (porPunto).
  const recogibles = Object.fromEntries(puntosRecogibles(zona).filter((p) => series[p.id]).map((p) => [p.id, series[p.id]]));
  const res = Object.keys(recogibles).length ? indiceZona(recogibles, primera.hoy, especies) : null;
  const porPunto = Object.fromEntries(Object.entries(series).map(([id, s]) => [id, indiceZona({ [id]: s }, s.hoy, especies)]));
  return { series, especies, res, porPunto };
}

// ---- Piezas ----
const textoFaltan = (n) => `${n} ${n === 1 ? 'especie' : 'especies'} sin datos suficientes`;
const rotulo = (res) => (res?.fueraDeTemporada ? 'Fuera de temporada' : null);

function cabecera(zona, res) {
  const valor = res?.valor ?? null;
  const detalle = detalleNombre(zona);
  const alts = zona.puntos.map((p) => p.altitud);
  const meta = el('div', { clase: 'portada__meta' }, etiqueta(zona.provincias.join(' y ')),
    etiqueta(`${zona.puntos.length} ${zona.puntos.length === 1 ? 'punto' : 'puntos'}, ${miles(Math.min(...alts))} a ${miles(Math.max(...alts))}${nbsp}m`));
  const avisos = (zona.avisos ?? []).map((a) => aviso(a, PELIGRO.test(a)));
  return el('div', { attrs: { 'data-nivel': nivelDe(valor) } },
    el('a', { clase: 'volver', href: '#hoy' }, icono('i-atras'), 'Hoy'),
    el('section', { clase: 'portada', attrs: { 'aria-labelledby': 'titulo-zona' } },
      el('div', { clase: 'zona-cabeza' },
        el('div', {}, el('h1', { id: 'titulo-zona', texto: nombreCorto(zona) }), detalle ? el('p', { clase: 'portada__sub', texto: detalle }) : null),
        el('div', { clase: 'zona-cabeza__nota' },
          valor != null ? el('p', { clase: 'indice indice--grande' }, String(valor), el('span', { clase: 'indice__max', texto: '/100' })) : null,
          semaforo(valor, rotulo(res)))),
      meta),
    res?.incompleta ? el('div', { clase: 'pila' }, aviso(`${textoFaltan(res.faltan.length)} para calcular su nota${valor != null ? ': la nota de la zona sale solo con las demás' : ''}.`, false)) : null,
    avisos.length ? el('div', { clase: 'pila' }, avisos) : null);
}

function selectorPuntos(zona, sel, porPunto, alElegir) {
  const grupo = el('div', { clase: 'puntos', attrs: { role: 'group', 'aria-label': 'Punto de referencia' } });
  for (const p of zona.puntos) {
    const rp = porPunto[p.id] ?? null, v = rp?.valor ?? null;
    const b = el('button', { clase: 'punto', type: 'button', attrs: { 'aria-pressed': String(p.id === sel), 'data-nivel': nivelDe(v) } },
      el('span', { clase: 'punto__nombre', texto: nombrePunto(p) }),
      el('span', { clase: 'punto__meta texto-2', texto: `${habitat(p.habitat)} · ${miles(p.altitud)}${nbsp}m` }),
      el('span', { clase: 'punto__nota' }, semaforo(v, rotulo(rp)), v != null ? el('b', { clase: 'tabular', texto: String(v) }) : null),
      rotuloPunto(p) ? etiqueta(rotuloPunto(p).texto, rotuloPunto(p).variante) : null);
    b.addEventListener('click', () => alElegir(p.id));
    grupo.append(b);
  }
  return grupo;
}

function detallePunto(p) {
  const partes = [];
  if (p.proteccion) partes.push(aviso(p.proteccion, p.noIr || RESTRINGIDO.test(p.proteccion)));
  if (p.nota) partes.push(el('details', { clase: 'detalle-punto' }, el('summary', { texto: 'Detalle técnico del punto' }), el('p', { clase: 'texto-2 texto-s', texto: p.nota })));
  return partes.length ? el('div', { clase: 'pila' }, partes) : null;
}

const LEJOS_KM = 20;   // a partir de aquí la estación «es lejana» y se avisa
const lejana = (est) => est?.distanciaKm != null && est.distanciaKm > LEJOS_KM ? ` · estación lejana (${Math.round(est.distanciaKm)}${nbsp}km)` : '';
const lugarEstacion = (est) => (est?.distanciaKm != null && est?.altitud != null ? ` (a ${est.distanciaKm.toLocaleString('es-ES')}${nbsp}km, ${miles(est.altitud)}${nbsp}m)` : '');

// Origen de la cifra de 26 días: cuántos días vienen de la estación y cuántos del modelo.
function origenLluvia(serie, meteo, zona, id) {
  const dias = serie.origenPrecip?.slice(serie.hoy - 25, serie.hoy + 1) ?? [];
  const deEstacion = dias.filter((o) => o?.startsWith('estacion:'));
  if (deEstacion.length) {
    const idEstacion = deEstacion[0].slice('estacion:'.length);
    const est = meteo.contrastePuntos?.[id]?.estacion ?? zona.estacionesAemet?.find((e) => e.id === idEstacion);
    const nombre = est?.nombre ?? idEstacion;
    const resto = dias.length - deEstacion.length;
    return `Estación AEMET ${nombre}${lugarEstacion(est)}${lejana(est)}: ${deEstacion.length} días${resto ? ` de estación + ${resto} de modelo (AEMET publica con unos 3 días de retraso)` : ''}`;
  }
  const sinEstacion = meteo.contrastePuntos && zona.estacionesAemet?.length && !meteo.contrastePuntos[id];
  return `Modelo: Open-Meteo best_match · actualizado a las ${hora(meteo.hora)}${sinEstacion ? ' · ninguna estación AEMET cercana con datos suficientes' : ''}`;
}

function cifrasLluvia(serie, disp, meteo, zona, id) {
  const t = serie.precip.slice(serie.hoy - 25, serie.hoy + 1);
  const p26 = t.length === 26 && t.every((v) => v != null) ? t.reduce((a, b) => a + b, 0) : null;
  const bloque = (valor, rotulo, origen) => el('div', {},
    el('p', { clase: 'cifras__valor' }, valor == null ? 'Sin datos' : String(valor), valor == null ? null : el('small', { texto: `${nbsp}mm` })),
    el('p', { clase: 'cifras__rotulo', texto: rotulo }), el('p', { clase: 'cifras__origen', texto: origen }));
  const n = Object.keys(disp?.modelos ?? {}).length;
  return el('div', { clase: 'cifras' },
    bloque(p26 == null ? null : Math.round(p26), 'Últimos 26 días', origenLluvia(serie, meteo, zona, id)),
    bloque(disp?.media == null ? null : Math.round(disp.media), disp?.horizonte ? `Próximos ${disp.horizonte} días` : 'Próximos días',
      disp?.media == null ? 'Sin previsión de varios modelos' : `Media de ${n} modelos`));
}

function cajaModelos(disp) {
  if (!disp?.horizonte || disp.media == null) return null;
  const nombres = Object.entries(disp.modelos);
  const escala = Math.max(25, Math.ceil(Math.max(...Object.values(disp.modelos)) / 5) * 5);
  const excluidos = (disp.excluidos ?? []).map((m) => `${MODELOS[m] ?? m}: sin datos a ${disp.horizonte} días`);
  const resumen = nombres.map(([m, mm]) => `${MODELOS[m] ?? m} ${Math.round(mm)}${nbsp}mm`).join(' · ');
  if (!disp.incierta) {
    return el('p', { clase: 'texto-2 texto-s' }, `Modelos, próximos ${disp.horizonte} días: ${resumen}.${excluidos.length ? ` ${excluidos.join('. ')}.` : ''}`);
  }
  const filas = el('ul', { clase: 'modelos' }, nombres.map(([m, mm]) => {
    const media = el('span', { clase: 'modelo__media' }), punto = el('span', { clase: 'modelo__punto' });
    media.style.setProperty('--v', String(Math.min(1, disp.media / escala)));
    punto.style.setProperty('--v', String(Math.min(1, mm / escala)));
    return el('li', { clase: 'modelo' }, el('span', { clase: 'modelo__nombre', texto: MODELOS[m] ?? m }),
      el('span', { clase: 'modelo__eje', attrs: { 'aria-hidden': 'true' } }, media, punto),
      el('span', { clase: 'modelo__valor', texto: `${Math.round(mm)}${nbsp}mm` }));
  }));
  return el('section', { clase: 'tarjeta desacuerdo', attrs: { 'aria-labelledby': 'titulo-modelos' } },
    el('div', { clase: 'desacuerdo__cabeza' }, icono('i-aviso'),
      el('div', {}, el('h2', { id: 'titulo-modelos', texto: 'Los modelos no coinciden' }), el('p', { clase: 'texto-2', texto: `Lluvia de los próximos ${disp.horizonte} días` }))),
    filas,
    el('p', { clase: 'desacuerdo__escala', attrs: { 'aria-hidden': 'true' } }, el('span'), el('span', {}, el('span', { texto: '0' }), el('span', { texto: `${escala}${nbsp}mm` })), el('span')),
    el('p', { clase: 'desacuerdo__nota' }, `La raya vertical es la media (${Math.round(disp.media)}${nbsp}mm). Entre el que más y el que menos hay ${Math.round(disp.rango)}${nbsp}mm: es una previsión `,
      el('strong', { texto: 'incierta' }), `.${excluidos.length ? ` ${excluidos.join('. ')}.` : ''}`));
}

// Estación y modelo discrepan en la lluvia de 26 días: se muestran las dos cifras y se puede elegir el modelo.
function cajaContraste(zona, meteo, id) {
  const c = meteo.contrastePuntos?.[id];
  if (!c?.discrepa) return null;
  const { P26estacion, P26modelo, diasCubiertos, estacionCubierta, modeloCubierto } = c.comparacion;
  const diasComparados = c.comparacion.diasComparados ?? diasCubiertos;
  const mm = (v) => (v == null ? 'sin datos' : `${Math.round(v)}${nbsp}mm`);   // un día sin modelo no se cuenta como 0
  const boton = el('button', { clase: 'chip', type: 'button', texto: 'Usar modelo', attrs: { 'aria-pressed': String(c.usaModelo) } });
  if (ui.enfocarModelo === zona.id) { ui.enfocarModelo = null; setTimeout(() => boton.focus({ preventScroll: true }), 50); }   // el repintado recrea el botón
  boton.addEventListener('click', () => {
    ui.enfocarModelo = zona.id;
    fijarUsarModelo(zona.id, boton.getAttribute('aria-pressed') !== 'true');
    window.dispatchEvent(new Event('contraste'));
  });
  return el('section', { clase: 'tarjeta desacuerdo', attrs: { 'aria-labelledby': 'titulo-contraste' } },
    el('div', { clase: 'desacuerdo__cabeza' }, icono('i-aviso'),
      el('div', {}, el('h2', { id: 'titulo-contraste', texto: 'Estación y modelo no coinciden' }),
        el('p', { clase: 'texto-2', texto: `Estación ${c.estacion.nombre}: ${mm(P26estacion)} · Modelo: ${mm(P26modelo)}` }))),
    el('p', { clase: 'desacuerdo__nota', texto: `Lluvia de los últimos 26 días; la cifra de la estación suma ${diasCubiertos} días de estación + ${26 - diasCubiertos} de modelo. En los ${diasComparados} días medidos${diasComparados < diasCubiertos ? ' con dato del modelo' : ''}: estación ${mm(estacionCubierta)}, modelo ${mm(modeloCubierto)}. Estación ${c.estacion.nombre ?? c.estacion.id}${lugarEstacion(c.estacion)}${lejana(c.estacion)}. ${c.usaModelo ? 'El índice usa ahora el modelo.' : 'El índice usa la estación.'}` }),
    el('div', { clase: 'chips' }, boton));
}

function seccionLluvia(zona, meteo, serie, id, disp, obsError, avisoObs = null) {
  const futuros = serie.fechas.length - 1 - serie.hoy;
  const fig = el('figure', { clase: 'grafico' });
  fig.style.marginBlock = '0';
  fig.innerHTML = graficoLluvia({ serie, dispersionPunto: disp, altura: 250 });
  return el('section', { clase: 'tarjeta', attrs: { 'aria-labelledby': 'titulo-lluvia' } },
    el('div', { clase: 'tarjeta__titulo' }, el('h2', { id: 'titulo-lluvia', texto: 'Lluvia' }), el('span', { clase: 'texto-2 texto-s', texto: `${serie.hoy + 1} días y ${futuros} de previsión` })),
    cifrasLluvia(serie, disp, meteo, zona, id), fig,
    obsError && zona.estacionesAemet?.length ? el('p', { clase: 'texto-2 texto-s', texto: 'Lluvia medida en estaciones: no disponible ahora' }) : null,
    avisoObs && zona.estacionesAemet?.length ? el('p', { clase: 'texto-2 texto-s', texto: avisoObs }) : null,
    el('ul', { clase: 'leyenda' },
      el('li', {}, el('span', { clase: 'muestra muestra--pasada' }), 'Lluvia medida'),
      el('li', {}, el('span', { clase: 'muestra muestra--prevista' }), 'Prevista, con horquilla'),
      el('li', {}, el('span', { clase: 'muestra muestra--acumulado' }), 'Acumulado (discontinuo: con previsión)')));
}

// Resultado de una especie en el punto elegido (null si le faltan datos).
function enPunto(serie, especie) {
  try { return calcularIndice(serie, serie.hoy, especie); } catch (e) { if (e instanceof DatosIncompletos) return null; throw e; }
}

function filaEspecie(e, r, rango, abierta, alAbrir) {
  const foto = e.fotos?.[0];
  const fuera = r?.factores?.fC === 0;   // fuera de temporada: se enseña rotulada, sin nota
  const valor = fuera ? null : r?.valor ?? null;
  const idDetalle = `desglose-${e.id}`;
  const fila = el('button', { clase: 'especie-fila', type: 'button', attrs: { 'aria-expanded': String(abierta), 'aria-controls': idDetalle, 'data-nivel': nivelDe(valor) } },
    foto ? el('img', { clase: 'especie-fila__foto', src: foto.archivo, alt: '', width: 56, height: 56, loading: 'lazy' }) : el('span', { clase: 'especie-fila__foto' }),
    el('span', { clase: 'especie-fila__nombre' }, el('span', { clase: 'latin', texto: e.nombre }), el('span', { clase: 'texto-2 texto-s', texto: comun(e) })),
    valor != null ? el('span', { clase: 'indice', texto: String(valor) }) : null,
    el('span', { clase: 'especie-fila__estado' }, semaforo(valor, fuera ? 'Fuera de temporada' : null),
      r && !fuera ? etiqueta(`Confianza ${r.confianza}`) : null,
      rango && rango.min !== rango.max ? el('span', { clase: 'texto-2 texto-s tabular', texto: `${rango.min}–${rango.max} entre puntos` }) : null,
      !r ? el('span', { clase: 'texto-2 texto-s', texto: 'Faltan datos en este punto' }) : null),
    el('span', { clase: 'especie-fila__abrir', attrs: { 'aria-hidden': 'true' } }, icono('i-abrir')));
  const detalle = el('div', { clase: 'especie-detalle', id: idDetalle, hidden: !abierta, attrs: { 'data-nivel': nivelDe(valor) } },
    r ? desglose(r) : el('p', { clase: 'texto-2', texto: 'Sin datos suficientes en este punto para calcular la nota.' }),
    el('a', { clase: 'boton boton--suave', href: `#especie/${e.id}` }, `Ver ficha de ${comun(e)}`));
  fila.addEventListener('click', () => {
    const ahora = fila.getAttribute('aria-expanded') !== 'true';
    fila.setAttribute('aria-expanded', String(ahora));
    detalle.hidden = !ahora;
    alAbrir(ahora ? e.id : null);
  });
  return el('li', {}, fila, detalle);
}

function listaEspecies(zona, especies, res, serie, sel) {
  const cabeza = (sub) => el('div', { clase: 'tarjeta__titulo' }, el('h2', { id: 'titulo-especies', texto: 'Índice por especie' }), sub ? el('span', { clase: 'texto-2 texto-s', texto: sub }) : null);
  if (!especies.length) {
    return el('section', { attrs: { 'aria-labelledby': 'titulo-especies' } }, cabeza(),
      el('div', { clase: 'tarjeta' }, el('p', { texto: 'Sin registros' }), el('p', { clase: 'texto-2 texto-s', texto: 'No consta ninguna especie comestible con índice en esta zona.' })));
  }
  const rangos = Object.fromEntries((res?.especies ?? []).map((s) => [s.id, s]));
  const orden = (r) => (r == null ? -1 : r.factores?.fC === 0 ? -2 : r.valor);   // sin datos, y al final las de fuera de temporada
  const filas = especies.map((e) => ({ e, r: serie ? enPunto(serie, e) : null })).sort((a, b) => orden(b.r) - orden(a.r));
  return el('section', { attrs: { 'aria-labelledby': 'titulo-especies' } }, cabeza(`en ${sel}`),
    el('div', { clase: 'tarjeta lista' }, el('ul', { clase: 'lista-especies', attrs: { 'aria-label': 'Especies de la zona, de mayor a menor nota' } },
      filas.map(({ e, r }) => filaEspecie(e, r, rangos[e.id], ui.abierta[zona.id] === e.id, (id) => { ui.abierta[zona.id] = id; })))));
}


function seccionNormativa(zona, datos) {
  const hoy = hoyMadrid();
  const normas = zona.normas.map((id) => datos.normativa.find((n) => n.id === id)).filter(Boolean);
  const sinConfirmar = normas.filter((n) => n.verificado === false).length;
  return el('section', { clase: 'tarjeta permiso', attrs: { 'aria-labelledby': 'titulo-permiso' } },
    el('div', { clase: 'permiso__fila' }, el('h2', { id: 'titulo-permiso', texto: 'Normativa y permisos' }), etiqueta('Orientativo', 'ocre')),
    normas.length
      ? el('div', {}, el('p', { clase: 'texto-2 texto-s', texto: `${normas.length} normas${sinConfirmar ? `, ${sinConfirmar} sin confirmar` : ''}. Comprueba siempre el permiso vigente en la fuente oficial antes de salir.` }),
        el('div', { clase: 'normas' }, normas.map((n) => fichaNormativa(n, hoy))))
      : el('p', { texto: 'Sin normativa registrada para esta zona.' }));
}

function seccionHabitats(zona, punto) {
  const orden = punto ? [punto.habitat, ...zona.habitats.filter((h) => h !== punto.habitat)] : zona.habitats;
  return el('section', { clase: 'tarjeta', attrs: { 'aria-labelledby': 'titulo-habitats' } },
    el('h2', { id: 'titulo-habitats', texto: 'Hábitats' }),
    el('p', { clase: 'texto-2 texto-s', texto: punto ? `En verde, el del punto elegido: ${nombrePunto(punto)}` : 'De la zona' }),
    el('div', { clase: 'portada__meta' }, orden.map((h, k) => etiqueta(habitat(h), punto && k === 0 ? 'acento' : null))),
    el('p', { clase: 'aviso-fijo', texto: 'El índice mide la oportunidad meteorológica, no la producción del monte.' }));
}

function errorMeteo(meteo, refrescarMeteo) {
  const boton = el('button', { clase: 'boton boton--suave', type: 'button', texto: 'Reintentar' });
  boton.addEventListener('click', async () => { boton.disabled = true; boton.textContent = 'Reintentando…'; await refrescarMeteo?.(); });
  return el('div', { clase: 'tarjeta', attrs: { role: 'alert' } }, el('h2', { texto: 'No se han podido cargar los datos meteorológicos' }),
    el('p', { clase: 'texto-2', texto: meteo.error ?? 'Sin respuesta de Open-Meteo.' }), el('p', { texto: 'Sin datos no se calcula ninguna nota.' }), boton);
}

export function pintar({ estado, param, refrescarMeteo }) {
  const { datos, meteo } = estado;
  const zona = datos.zonas.find((z) => z.id === param);
  if (!zona) {
    return el('div', { clase: 'tarjeta', style: 'margin-top: var(--esp-6)' }, el('h2', { texto: 'Zona no encontrada' }),
      el('p', { texto: 'No conozco esa zona.' }), el('a', { clase: 'boton', href: '#hoy' }, 'Volver a Hoy'));
  }
  const umbrales = estado.umbrales ?? {};
  const c = meteo?.series ? calcular(zona, datos, meteo, umbrales)
    : { series: {}, especies: especiesDeZona(zona, datos.especies, umbrales), res: null, porPunto: {} };
  const recogibles = puntosRecogibles(zona);
  const mejorPunto = c.res?.especies?.[0]?.punto ?? recogibles.find((p) => c.series[p.id])?.id ?? (recogibles[0] ?? zona.puntos[0]).id;
  if (!zona.puntos.some((p) => p.id === ui.punto[zona.id])) delete ui.punto[zona.id];
  const idElegido = () => ui.punto[zona.id] ?? mejorPunto;
  const dinamico = el('div', { clase: 'pila-l' });
  const habitats = el('div');

  function pintarDinamico() {
    const id = idElegido(), punto = zona.puntos.find((p) => p.id === id), serie = c.series[id];
    const partes = [el('div', { clase: 'pila' }, selectorPuntos(zona, id, c.porPunto, (nuevo) => { ui.punto[zona.id] = nuevo; pintarDinamico(); }), detallePunto(punto))];
    if (!meteo) partes.push(el('div', { attrs: { 'aria-busy': 'true' } }, el('p', { clase: 'solo-lector', texto: 'Cargando la previsión…', attrs: { role: 'status' } }), el('div', { clase: 'esqueleto' })));
    else if (!meteo.series) partes.push(errorMeteo(meteo, refrescarMeteo));
    else if (!serie) partes.push(el('div', { clase: 'tarjeta' }, el('h2', { texto: 'Lluvia' }), el('p', { texto: 'Sin datos meteorológicos de este punto. No se calcula nota.' })));
    else {
      const disp = meteo.dispersion?.[id] ?? null;
      if (meteo.hoy !== hoyMadrid()) partes.push(aviso(`Datos del ${fecha(meteo.hoy)}. No se ha podido actualizar; las notas son de ese día.`, false));
      partes.push(seccionLluvia(zona, meteo, serie, id, disp, estado.obs ? null : estado.obsError, avisoViejo(estado.obs)), cajaContraste(zona, meteo, id), cajaModelos(disp));
    }
    partes.push(listaEspecies(zona, c.especies, c.res, serie, nombrePunto(punto)));
    dinamico.replaceChildren(...partes.filter(Boolean));
    habitats.replaceChildren(seccionHabitats(zona, punto));
  }
  pintarDinamico();

  return el('div', {}, cabecera(zona, c.res),
    el('div', { clase: 'pila-l', style: 'margin-top: var(--esp-5)' }, dinamico, seccionDondeBuscar(zona, datos), seccionNormativa(zona, datos), habitats));
}

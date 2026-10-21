// js/mapa/modelos-hoja.js
// Modelos de la hoja fija del mapa según lo seleccionado (nada → lista de zonas, zona, monte, fuera de zonas).
// Datos puros, sin DOM: se prueban con Node. El pintado vive en hoja.js (crearHojaMapa).
// La frase de cada fila es la de fraseZona (partes { texto, estilo }), no nodos.
import { nombreCorto, rotuloPunto, RESTRINGIDO } from '../datos.js';
import { fraseZona, textoFaltan, ordenarZonas } from '../notas-zona.js';
import { nivelDe, palabraDe } from '../ui/semaforo.js';
import { comun } from '../ui/ficha.js';
import { rutaMapa, rutaZona } from './ruta.js';
import { urlNuevaSalida } from '../diario.js';
import { textoCoto, urlComoLlegar } from './hoja.js';

const nbsp = ' ';
const FORMATO = { weekday: 'long', day: 'numeric', timeZone: 'UTC' };
const utc = (f) => new Date(`${f}T12:00:00Z`);
const nombrePunto = (p) => p.nombre.replace(/\s*\([^)]*\)\s*$/, '');
const diasEntre = (fecha, hoy) => Math.round((utc(fecha) - utc(hoy)) / 86400000);

// 'hoy' | 'mañana' | 'el jueves 23'
export function tituloDia(fecha, hoy) {
  const n = diasEntre(fecha, hoy);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `el ${new Intl.DateTimeFormat('es-ES', FORMATO).format(utc(fecha))}`;
}

// Las etiquetas de la fila de Hoy (filaZona de pantallas/hoy.js), como datos.
function etiquetasDe(fila, d) {
  const e = [];
  if (fila.mejor) e.push({ texto: `Confianza ${fila.mejor.resultado.confianza}`, variante: null });
  if (fila.mejor && fila.res.incompleta) e.push({ texto: textoFaltan(fila.res.faltan.length), variante: 'ocre' });
  if (d > 0 && fila.mejor) e.push({ texto: 'Previsión', variante: 'ocre' });
  if (fila.incierta) e.push({ texto: 'Previsión incierta', variante: 'ocre' });
  if (fila.discrepa) e.push({ texto: 'Estación y modelo no coinciden', variante: 'ocre' });
  if (fila.rotulo) e.push({ texto: fila.rotulo.texto, variante: fila.rotulo.variante ?? null });
  return e;
}

function filasZona(filas, datos, d) {
  return ordenarZonas(filas).map((f, k) => {
    const valor = f.res.valor ?? null;
    return { id: f.zona.id, pos: k + 1, nombre: nombreCorto(f.zona), valor, nivel: nivelDe(valor), fueraDeTemporada: !!f.res.fueraDeTemporada,
      frase: fraseZona(f, datos), etiquetas: etiquetasDe(f, d), href: rutaMapa({ zona: f.zona.id }) };
  });
}

// caducado = fecha (AAAA-MM-DD) de la última meteo disponible si está caducada, o null.
export function modeloListaZonas({ filas, datos, fecha, hoy, caducado = null }) {
  const titulo = `Dónde ir ${tituloDia(fecha, hoy)}`;
  const lista = filasZona(filas, datos, Math.max(0, diasEntre(fecha, hoy)));
  const fechaCorta = caducado ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(utc(caducado)) : null;
  return { tipo: 'listaZonas', titulo, corto: `${titulo} · ${lista.length} ${lista.length === 1 ? 'zona' : 'zonas'}`,
    aviso: fechaCorta ? `Con los últimos datos, del ${fechaCorta}` : null, filas: lista };
}

// Protección en pocas palabras: hasta el primer paréntesis, punto o dos puntos, y recortada.
const MAX_CORTA = 56;
function proteccionCorta(t) {
  const c = t.split(/\s*[(:.;]/)[0].trim();
  return c.length > MAX_CORTA ? `${c.slice(0, MAX_CORTA - 1).trimEnd()}…` : c;
}
const orden = (m) => (m.punto.noIr ? 2 : m.nota?.valor == null ? 1 : 0);

// montes = [{ punto, nota (notaPuntoDia), coto? (propiedades del coto o null) }]
export function modeloZona({ fila, montes, datos, d = 0 }) {
  const valor = fila.res.valor ?? null, nivel = nivelDe(valor), titulo = nombreCorto(fila.zona);
  const ordenados = montes.map((m, i) => ({ ...m, i }))
    .sort((a, b) => orden(a) - orden(b) || (orden(a) === 0 ? b.nota.valor - a.nota.valor : 0) || a.i - b.i);
  return { tipo: 'zona', id: fila.zona.id, titulo, corto: `${titulo} · ${palabraDe(nivel)}${valor != null ? ` ${valor}` : ''}`,
    valor, nivel, frase: fraseZona(fila, datos), etiquetas: etiquetasDe(fila, d), detalle: rutaZona(fila.zona.id),
    montes: ordenados.map(({ punto, nota, coto }) => {
      const v = nota?.valor ?? null;
      const lugar = coto?.nombre ?? (punto.proteccion ? proteccionCorta(punto.proteccion) : null);
      const linea = [v != null && nota.mejor?.especie ? comun(nota.mejor.especie) : null, lugar].filter(Boolean).join(' · ') || (nota?.motivo ?? '');
      return { id: punto.id, nombre: punto.corto ?? nombrePunto(punto), valor: v, nivel: nivelDe(v), linea, rotulo: rotuloPunto(punto),
        href: rutaMapa({ zona: fila.zona.id, punto: punto.id }) };
    }) };
}

function porqueDe(nota) {
  const r = nota.mejor?.resultado?.datos;
  if (!r || r.P26 == null) return null;
  const { P26, P3, lag, T20 } = r;
  const cuando = P3 < 1 ? 'sin tandas de lluvia' : lag === 0 ? 'lo más fuerte, hoy' : lag === 1 ? 'lo más fuerte, ayer' : `lo más fuerte hace ${lag} días`;
  return `${Math.round(P26)}${nbsp}mm en 26 días, ${cuando} · ${Math.round(T20)}${nbsp}°C de media`;
}

export function modeloMonte({ zona, punto, nota, datos, d = 0, coto = null }) {
  const valor = nota?.valor ?? null, titulo = nombrePunto(punto);
  const otra = valor != null ? nota.especies?.[1] : null;
  const e = valor != null ? nota.mejor?.especie : null;
  const base = { tipo: 'monte', id: punto.id, zona: zona.id, titulo, corto: `${titulo} · ${valor ?? 'sin datos'}`, valor, nivel: nivelDe(valor),
    especie: e ? { nombre: comun(e), latin: e.nombre } : null,
    tambien: otra && datos.porId[otra.id] ? `${comun(datos.porId[otra.id])} (${otra.valor})` : null,
    porque: valor != null ? porqueDe(nota) : null,
    dia: d > 0 ? `Previsión a +${d} ${d === 1 ? 'día' : 'días'}` : null,
    coto: textoCoto(coto),
    avisos: punto.proteccion ? [{ texto: punto.proteccion, peligro: !!punto.noIr || RESTRINGIDO.test(punto.proteccion) }] : [],
    acciones: { comoLlegar: urlComoLlegar(punto.lat, punto.lon), diario: urlNuevaSalida({ lat: punto.lat, lon: punto.lon, zona: zona.id, punto: punto.id }),
      mas: rutaZona(zona.id, punto.id) } };
  return valor == null ? { ...base, texto: nota?.motivo ?? 'Sin datos suficientes para este día.' } : base;
}

// cercanas = filas ya modeladas (las de modeloListaZonas().filas)
export const modeloFueraDeZonas = ({ nombre, cercanas }) => ({ tipo: 'fuera', titulo: nombre, corto: nombre,
  texto: 'La app no tiene datos de monte aquí. Las zonas más cercanas:', filas: cercanas });

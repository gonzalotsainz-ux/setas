// supabase/functions/pluvio/lectores/tajo.js
// SAIH Tajo (CHT), sin clave (informe 09 §3.2). La tabla de pluviometría (2 MB) da la URL cifrada de cada estación; la
// ficha de la estación trae la señal P1 («PRECIPITACIÓN ÚLTIMA HORA») de las últimas 24 h con un valor por hora, y su
// gráfico grande, 10 días con un valor cada 15 min. La señal se solapa: solo valen los valores de las horas en punto.
// Las URLs guardadas en la lista blanca se usan tal cual; si una falla, se rehace la cadena portada → menú → tabla.
import { horaDeTexto } from '../tiempo.js';
import { PlazoAgotado } from '../red.js';

export const BASE_TAJO = 'https://saihtajo.chtajo.es/';

export const senalP1 = (json) => (json?.response?.senales ?? []).find((s) => s?.tiposenal === 'P1') ?? null;
function horasDe(valores, estacion) {
  const filas = [];
  for (const v of valores ?? []) {
    if (typeof v?.tiempo !== 'string' || !v.tiempo.endsWith(':00')) continue;   // solo las horas en punto
    const hora = horaDeTexto(v.tiempo);
    if (!hora) continue;
    filas.push({ estacion, hora, mm: typeof v.valor === 'number' && Number.isFinite(v.valor) ? v.valor : null });
  }
  return filas;
}
export const horasDeEstacionTajo = (json, codigo) => horasDe(senalP1(json)?.valores, codigo);
export const horasDeGraficoTajo = (json, codigo) => horasDe(json?.response?.senal?.valores, codigo);

export const estacionesDeTablaTajo = (json) => (json?.response?.pluviometria ?? []).map((x) => ({
  codigo: x.idestacion, nombre: x.estacion?.nombre ?? x.idestacion, tipo: x.estacion?.tipoestacion ?? null,
  x: Number(x.estacion?.utm?.x), y: Number(x.estacion?.utm?.y), altitud: Math.round(Number(x.estacion?.utm?.z)), url: x.url }));
export const enlacesDeTablaTajo = (json) => new Map(estacionesDeTablaTajo(json).map((e) => [e.codigo, e.url]));

function buscarEnlace(o, trozo) {
  if (typeof o === 'string') return o.includes(trozo) ? o : null;
  if (o && typeof o === 'object') for (const v of Object.values(o)) { const r = buscarEnlace(v, trozo); if (r) return r; }
  return null;
}
export async function cadenaTajo(pedir) {
  const portada = await pedir(BASE_TAJO, { como: 'texto' });
  const entorno = portada.match(/index\.php\?w=get-wrapperentorno&x=[^'"\s]+/)?.[0];
  if (!entorno) throw new Error('SAIH Tajo: la portada no trae get-wrapperentorno');
  const menu = (await pedir(BASE_TAJO + entorno))?.response?.urlmenu;
  if (!menu) throw new Error('SAIH Tajo: sin urlmenu');
  const tabla = buscarEnlace(await pedir(BASE_TAJO + menu), 'w=get-pluviometria&');
  if (!tabla) throw new Error('SAIH Tajo: el menú no trae la pluviometría');
  return pedir(BASE_TAJO + tabla);
}

// Lo que falle (salvo el plazo) queda como error de esa estación y se sigue con las demás.
const intento = async (f) => { try { return await f(); } catch (e) { if (e instanceof PlazoAgotado) throw e; return null; } };

export async function leerTajo({ pedir, estaciones, diezDias = false }) {
  const filas = [], errores = [];
  let enlaces = null;   // la tabla (2 MB) solo si alguna URL guardada falla, y una vez
  for (const e of estaciones) {
    try {
      let ficha = await intento(() => pedir(BASE_TAJO + e.url));
      if (ficha?.response?.ok !== 1) {
        enlaces ??= enlacesDeTablaTajo(await cadenaTajo(pedir));
        const url = enlaces.get(e.codigo);
        if (!url) throw new Error('no está en la tabla del SAIH Tajo');
        ficha = await pedir(BASE_TAJO + url);
      }
      const p1 = senalP1(ficha);
      if (!p1) throw new Error('sin señal de lluvia (P1)');
      const horas = diezDias ? (p1.url ? horasDeGraficoTajo(await pedir(BASE_TAJO + p1.url), e.codigo) : []) : horasDeEstacionTajo(ficha, e.codigo);
      if (!horas.length) throw new Error('sin valores en hora en punto');
      filas.push(...horas);
    } catch (err) {
      if (err instanceof PlazoAgotado) return { filas, errores, agotado: true };
      errores.push(`${e.codigo}: ${err.message}`);
    }
  }
  return { filas, errores, agotado: false };
}

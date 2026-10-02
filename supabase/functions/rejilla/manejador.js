// supabase/functions/rejilla/manejador.js
// Una ejecución de la Edge Function «rejilla» con dependencias inyectadas (almacén, fetch, reloj): planifica las
// peticiones a Open-Meteo dentro del presupuesto, guarda la meteo y la climatología, reconstruye la serie de cada
// celda gruesa, resume sus agregados y publica el índice si hay datos en el 90 % de las celdas.
import { hoyMadrid, FUTUROS, sumarDias } from '../_shared/meteo.js';
import { resumirCelda, diaConDatos, validarSalida, VERSION_SALIDA } from '../_shared/salida-indice.js';
import { selloDe, tocaEjecutar, inicioSerie, planificar, filasDePrincipal, filasDeArchivoLluvia, filasDeClima, serieDesdeFilas,
  aplicarClimaCelda, decidirPublicacion, archivosABorrar, celdasDelLote, pedirConReintento, PlazoAgotado, altitudConsulta, TROZO, PRESUPUESTO_EJECUCION,
  factoresPorZona } from './nucleo.js';
import { aplicarMedida, pluvioVigente, VIGENCIA_PLUVIO } from '../_shared/pluvio.js';

// Supabase corta una función a los 150 s de reloj (plan gratuito, informe 08 D4), también en segundo plano. La ejecución
// entera tiene que acabar antes de PLAZO_EJECUCION; las peticiones (con sus reintentos y esperas) dejan
// RESERVA_PUBLICAR para leer las series, resumir y subir. Si el plazo no alcanza, no se publica.
export const PLAZO_EJECUCION = 140000;
export const RESERVA_PUBLICAR = 20000;
export const MINIMO_UTIL = 5000;   // un intento (o una espera) que deja menos de esto para pedir no se hace
const MAX_ESPERA_FETCH = 60000;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const idsDe = (c) => [c.id, ...(c.iguales ?? [])];

export async function ejecutar({ almacen, fetchFn, ahora = new Date(), gruesa, lote = 0, lotes = 1, forzar = false, esperar = dormir,
  trozo = TROZO, presupuesto = PRESUPUESTO_EJECUCION, reloj = () => Date.now(), plazo = PLAZO_EJECUCION, senal }) {
  const limite = reloj() + plazo;
  const sello = forzar ? selloDe(ahora) : tocaEjecutar(ahora);
  if (!sello) return { estado: 'fuera-de-hora' };
  // Un sello (y lote) se ejecuta una vez: una llamada repetida a mano, un «forzar» con el mismo sello o dos llamadas
  // solapadas salen aquí (pg_net no reintenta por sí solo).
  if (!(await almacen.reservarEjecucion(sello, lote))) return { estado: 'repetido', sello, lote };

  const hoy = hoyMadrid(ahora);
  const celdas = celdasDelLote(gruesa.celdas, lote, lotes), ids = celdas.map((c) => c.id);
  const altitud = altitudConsulta(celdas);
  const [resumen, climaAntes] = await Promise.all([almacen.resumen(ids), almacen.clima(ids)]);
  const plan = planificar({ celdas, resumen, clima: climaAntes, hoy, presupuesto: presupuesto / lotes, trozo });

  // Margen para pedir: lo que queda hasta el límite menos la reserva de publicación.
  const margen = () => limite - RESERVA_PUBLICAR - reloj();
  const esperarConPlazo = async (ms) => { if (!(ms + MINIMO_UTIL < margen())) throw new PlazoAgotado(); await esperar(ms); };
  const opciones = { esperar: esperarConPlazo, limite: () => Math.min(MAX_ESPERA_FETCH, margen()), minimo: MINIMO_UTIL, ...(senal ? { senal } : {}) };
  const errores = [], climaPorTrozo = new Map(), frescas = new Set();
  let agotado = false;
  for (const p of plan.peticiones) {
    if (margen() < MINIMO_UTIL) { agotado = true; break; }
    try {
      const json = await pedirConReintento(fetchFn, p.url, opciones);
      if (p.tipo === 'principal') {
        await almacen.guardarFilas(filasDePrincipal(json, p.celdas, hoy, ahora));
        for (const c of p.celdas) for (const id of idsDe(c)) frescas.add(id);
      } else if (p.tipo === 'archivo') await almacen.guardarFilas(filasDeArchivoLluvia(json, p.celdas, p.desde, p.hasta, ahora));
      else {
        if (!climaPorTrozo.has(p.trozo)) climaPorTrozo.set(p.trozo, { celdas: p.celdas, partes: [] });
        climaPorTrozo.get(p.trozo).partes.push(json);
      }
    } catch (e) {
      if (e instanceof PlazoAgotado) { agotado = true; break; }
      errores.push(`${p.tipo}: ${e.message}`);
    }
  }
  for (const { celdas: cs, partes } of climaPorTrozo.values()) if (partes.length === 2) await almacen.guardarClima(filasDeClima(partes, cs, hoy, ahora));
  if (agotado) {
    errores.push('plazo agotado: no se publica');
    return { estado: 'sin-publicar', sello, conDatos: 0, total: gruesa.celdas.length, peso: plan.peso, errores };
  }

  // Solo salen en el índice las celdas cuya petición principal fue bien en esta ejecución; de las demás no hay previsión
  // renovada (el móvil las pinta en gris) y no cuentan para el 90 %.
  const desde = inicioSerie(hoy), hasta = sumarDias(hoy, FUTUROS - 1);
  const fechas = Array.from({ length: FUTUROS }, (_, k) => sumarDias(hoy, k));
  const [filas, clima, pluvio] = await Promise.all([almacen.series(ids, desde), almacen.clima(ids), leerPluvioCeldas(almacen, ahora)]);
  const series = new Map();
  for (const c of celdas) {
    const fila = filas.get(c.id);
    if (!fila || !frescas.has(c.id)) continue;
    series.set(c.id, aplicarClimaCelda(serieDesdeFilas(fila, desde, hasta, hoy, ahora), clima.get(c.id)));
  }
  // Lluvia medida en pluviómetros (pluvio/celdas.json, de la función «pluvio»): sin archivo, todo como antes. El sesgo
  // se calcula con las series del modelo, antes de mezclar nada.
  const factores = pluvio ? factoresPorZona(celdas, series, pluvio) : new Map();
  const parte = {};
  for (const c of celdas) {
    const s = series.get(c.id);
    if (!s) continue;
    const m = pluvio?.lugares?.[c.id] ?? null;
    const serie = pluvio ? aplicarMedida(s, m, { desde: pluvio.desde, hasta: pluvio.hasta, factor: factores.get(c.zona) ?? 1 }) : s;
    parte[c.id] = resumirCelda({ altRef: altitud.get(c.id), serie, fechas,
      pluvio: pluvio ? { estaciones: (m?.estaciones ?? []).slice(0, 3).map((e) => e.nombre), cercanas: m?.cercanas ?? 0 } : null });
  }

  let todas = parte;
  if (lotes > 1) {
    await almacen.subir(`parcial/${sello}/${lote}.json`, parte, '3600');
    const hechos = await almacen.listar(`parcial/${sello}`);
    if (hechos.length < lotes) return { estado: 'parcial', sello, lote, peso: plan.peso, errores };
    todas = {};
    for (const n of hechos) Object.assign(todas, await almacen.leerJson(`parcial/${sello}/${n}`));
    await almacen.borrar(hechos.map((n) => `parcial/${sello}/${n}`));
  }
  const total = gruesa.celdas.length;
  const conDatos = Object.values(todas).filter((c) => diaConDatos(c.dias[0])).length;
  if (!decidirPublicacion(conDatos, total)) return { estado: 'sin-publicar', sello, conDatos, total, peso: plan.peso, errores };
  if (reloj() >= limite) {
    errores.push('plazo agotado al resumir: no se publica');
    return { estado: 'sin-publicar', sello, conDatos, total, peso: plan.peso, errores };
  }
  const generado = ahora.toISOString(), archivo = `${sello}.json`;
  const salida = { version: VERSION_SALIDA, sello, generado, hoy, fechas, celdas: todas };
  // Lo mismo que comprueba el móvil al leerlo: un archivo que no pasaría no se sube y queda el anterior.
  const malas = validarSalida(salida);
  if (malas.length) return { estado: 'sin-publicar', sello, conDatos, total, peso: plan.peso, errores: [...errores, ...malas.map((m) => `salida: ${m}`)] };
  await almacen.subir(archivo, salida, '86400');
  await almacen.subir('ultimo.json', { version: VERSION_SALIDA, sello, archivo, generado, conDatos, total }, '60');
  await almacen.borrar(archivosABorrar(await almacen.listar('')));
  return { estado: 'publicado', sello, conDatos, total, peso: plan.peso, errores };
}

// La comparación de la clave vive en _shared (la usa también «pluvio»); se reexporta para index.ts y las pruebas.
export { claveValida } from '../_shared/clave.js';

// pluvio/celdas.json del mismo bucket (la función «pluvio» lo publica a las 4 y a las 16 UTC). Si falta, falla, no pasa
// validarPluvio, tiene más de PLUVIO_MAX_HORAS o es posterior a la ejecución (más de PLUVIO_ADELANTO_MIN, por relojes),
// null: el índice sale sin pluviómetros, exactamente como antes.
export const PLUVIO_MAX_HORAS = VIGENCIA_PLUVIO.maxHoras, PLUVIO_ADELANTO_MIN = VIGENCIA_PLUVIO.adelantoMin;
export async function leerPluvioCeldas(almacen, ahora = new Date()) {
  try {
    const p = await almacen.leerJson('pluvio/celdas.json');
    return pluvioVigente(p, ahora) ? p : null;
  } catch { return null; }
}

// Almacén real: tablas meteo_celdas, clima_celdas y rejilla_ejecuciones, la vista meteo_celdas_resumen, la función
// series_celdas y el bucket público «indice». Se lee todo (son unas 350 filas) para no meter cientos de ids en la URL.
export function almacenSupabase(admin) {
  const datos = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const bucket = () => admin.storage.from('indice');
  return {
    async reservarEjecucion(sello, lote) {
      const { error } = await admin.from('rejilla_ejecuciones').insert({ sello, lote });
      if (!error) return true;
      if (error.code === '23505') return false;   // ya existía: otra llamada tiene (o tuvo) este sello
      throw new Error(error.message);
    },
    async resumen(ids) { const s = new Set(ids); return new Map(datos(await admin.from('meteo_celdas_resumen').select('celda, desde, hasta, dias')).filter((r) => s.has(r.celda)).map((r) => [r.celda, r])); },
    async clima(ids) { const s = new Set(ids); return new Map(datos(await admin.from('clima_celdas').select('celda, por_mes, meses, actualizado')).filter((r) => s.has(r.celda)).map((r) => [r.celda, r])); },
    async guardarFilas(filas) { for (let k = 0; k < filas.length; k += 1000) datos(await admin.from('meteo_celdas').upsert(filas.slice(k, k + 1000), { onConflict: 'celda,fecha,modelo' })); },
    async guardarClima(filas) { if (filas.length) datos(await admin.from('clima_celdas').upsert(filas)); },
    async series(ids, desde) { return new Map(datos(await admin.rpc('series_celdas', { p_celdas: ids, p_desde: desde })).map((r) => [r.celda, r])); },
    async subir(nombre, json, cacheControl) {
      datos(await bucket().upload(nombre, new Blob([JSON.stringify(json)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl }));
    },
    async leerJson(nombre) { const { data, error } = await bucket().download(nombre); return error ? null : JSON.parse(await data.text()); },
    async listar(prefijo) { return datos(await bucket().list(prefijo, { limit: 1000 })).filter((f) => f.id).map((f) => f.name); },
    async borrar(nombres) { if (nombres.length) datos(await bucket().remove(nombres)); },
  };
}

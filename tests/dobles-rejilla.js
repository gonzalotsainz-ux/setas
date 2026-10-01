// tests/dobles-rejilla.js
// Dobles de la Edge Function «rejilla»: Open-Meteo falso (forecast y archivo, varios puntos) y almacén en memoria con
// la misma interfaz que almacenSupabase (supabase/functions/rejilla/manejador.js).
import { sumarDias, entreDias } from '../js/meteo.js';

const VALORES = {
  precipitation_sum: (j) => (j % 9 === 0 ? 15 : 2), temperature_2m_mean: () => 13, temperature_2m_min: () => 6, temperature_2m_max: () => 19,
  et0_fao_evapotranspiration: () => 1.5, wind_speed_10m_max: () => 15, relative_humidity_2m_mean: () => 75,
  soil_moisture_0_to_7cm_mean: (j) => 0.2 + (j % 20) / 100,
};
const respuesta = (status, cuerpo) => ({ ok: status === 200, status, headers: new Map(), json: async () => cuerpo });

export function openMeteoFalso({ hoy, fallos = () => false, registro = [] } = {}) {
  return async (url) => {
    registro.push(url);
    const u = new URL(url), p = u.searchParams;
    if (fallos(u, registro.length)) return respuesta(429, { error: true, reason: 'Too many requests' });
    const n = p.get('latitude').split(',').length;
    let fechas;
    if (u.hostname.startsWith('archive')) {
      const d0 = p.get('start_date'), d1 = p.get('end_date');
      fechas = Array.from({ length: entreDias(d0, d1) + 1 }, (_, k) => sumarDias(d0, k));
    } else {
      const pas = Number(p.get('past_days')), fut = Number(p.get('forecast_days'));
      fechas = Array.from({ length: pas + fut }, (_, k) => sumarDias(hoy, k - pas));
    }
    const uno = () => {
      const daily = { time: fechas };
      for (const v of p.get('daily').split(',')) daily[v] = fechas.map((_, j) => (VALORES[v] ? VALORES[v](j) : 1));
      const r = { latitude: 40, longitude: -4, elevation: 1000, daily };
      if (p.get('hourly')) {
        const time = fechas.flatMap((f) => Array.from({ length: 24 }, (_, h) => `${f}T${String(h).padStart(2, '0')}:00`));
        r.hourly = { time, soil_moisture_0_to_7cm: time.map(() => 0.3), soil_temperature_0_to_7cm: time.map(() => 13) };
      }
      return r;
    };
    return respuesta(200, n === 1 ? uno() : Array.from({ length: n }, uno));
  };
}

// Como series_celdas de la migración: un array por columna, con `previsto` y `actualizado` paralelos a `fechas`.
const COLUMNAS = ['precip', 'tmedia', 'tmin', 'tmax', 'et0', 'viento', 'hr', 'hsuelo', 'tsuelo', 'previsto', 'actualizado'];
export function almacenMemoria() {
  const filas = new Map(), clima = new Map(), archivos = new Map(), ejecuciones = new Set();
  return {
    filas, archivos, ejecuciones,
    async reservarEjecucion(sello, lote) {
      const k = `${sello}|${lote}`;
      if (ejecuciones.has(k)) return false;
      ejecuciones.add(k);
      return true;
    },
    async resumen() {
      const r = new Map();
      for (const f of filas.values()) {
        const x = r.get(f.celda) ?? { celda: f.celda, desde: f.fecha, hasta: null, dias: 0 };
        if (f.fecha < x.desde) x.desde = f.fecha;
        if (!f.previsto) { x.dias++; if (!x.hasta || f.fecha > x.hasta) x.hasta = f.fecha; }
        r.set(f.celda, x);
      }
      return r;
    },
    async clima() { return new Map(clima); },
    async guardarFilas(lista) { for (const f of lista) filas.set(`${f.celda}|${f.fecha}`, { ...filas.get(`${f.celda}|${f.fecha}`), ...f }); },
    async guardarClima(lista) { for (const f of lista) clima.set(f.celda, f); },
    async series(ids, desde) {
      const r = new Map();
      for (const f of [...filas.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))) {
        if (!ids.includes(f.celda) || f.fecha < desde) continue;
        const s = r.get(f.celda) ?? { celda: f.celda, fechas: [], ...Object.fromEntries(COLUMNAS.map((c) => [c, []])) };
        s.fechas.push(f.fecha);
        for (const c of COLUMNAS) s[c].push(f[c] ?? null);
        r.set(f.celda, s);
      }
      return r;
    },
    async subir(nombre, json) { archivos.set(nombre, JSON.parse(JSON.stringify(json))); },
    async leerJson(nombre) { return archivos.get(nombre) ?? null; },
    async listar(prefijo) {
      const p = prefijo ? `${prefijo.replace(/\/$/, '')}/` : '';
      return [...archivos.keys()].filter((k) => k.startsWith(p) && !k.slice(p.length).includes('/')).map((k) => k.slice(p.length));
    },
    async borrar(nombres) { for (const n of nombres) archivos.delete(n); },
  };
}

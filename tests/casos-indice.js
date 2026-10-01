// Casos fijos del índice: series sintéticas × especies × días. La referencia (fixtures/indice-referencia.json) se
// generó con el código ANTERIOR a la división en agregados; cualquier cambio de nota hace fallar la prueba.
import { calcularIndice } from '../js/indice.js';
import { serieSintetica, BOLETUS, NISCALO, MORCHELLA, lluviaBuena } from './ayudas.js';

const VERANO = { id: 'verano-prueba', temporada: { meses: [6, 7, 8, 9, 10], tipo: 'verano' },
  indice: { topt: 16, trango: [12, 20], usarSuelo: false, pmin: 40, pfull: 100, desfase: [5, 15], helada: 'nula', confianza: 'media' } };
const ALTA = { ...NISCALO, id: 'helada-alta', indice: { ...NISCALO.indice, helada: 'alta' } };
export const ESPECIES_CASO = [BOLETUS, NISCALO, MORCHELLA, VERANO, ALTA];

export const SERIES_CASO = {
  humeda: () => serieSintetica({ precip: lluviaBuena }),
  sequia: () => serieSintetica({ precip: () => 0 }),
  constante: () => serieSintetica({ precip: () => 2 }),
  helada: () => serieSintetica({ precip: lluviaBuena, tmin: (k) => (k === 57 ? -4 : k === 55 ? -1 : 6) }),
  calor: () => serieSintetica({ precip: lluviaBuena, tmedia: () => 22 }),
  secante: () => serieSintetica({ precip: lluviaBuena, et0: () => 6, hr: () => 40 }),
  sinSuelo: () => serieSintetica({ precip: lluviaBuena, pct: () => null }),
  sinAgosto: () => serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena, lluviaAntes: null }),
  sinTsuelo: () => serieSintetica({ precip: lluviaBuena, tsuelo: (k) => (k === 50 ? null : 13) }),
  primavera: () => serieSintetica({ inicio: '2026-02-15', precip: lluviaBuena, tmedia: () => 9, tsuelo: () => 12, lluviaAntes: null }),
  prevision: () => serieSintetica({ dias: 70, hoy: 59, precip: (k) => (k >= 60 ? 8 : lluviaBuena(k)) }),
  huecoTmin: () => serieSintetica({ precip: lluviaBuena, tmin: (k) => (k === 58 ? null : 6) }),
  ventoso: () => serieSintetica({ precip: lluviaBuena, viento: () => 40, et0: () => 6, hr: () => 75 }),
  sinEt0: () => serieSintetica({ precip: lluviaBuena, et0: (k) => (k === 57 ? null : 1.5) }),
  heladaCero: () => serieSintetica({ precip: lluviaBuena, tmin: (k) => (k === 57 || k === 55 ? 0 : 6) }),
  calorLimite: () => serieSintetica({ precip: lluviaBuena, tmedia: () => 19 }), // trango[1] + 4 de Boletus (15)
  calorLimiteVerano: () => serieSintetica({ precip: lluviaBuena, tmedia: () => 24 }), // trango[1] + 4 de la especie de verano (20)
  primaveraSinTsuelo: () => serieSintetica({ inicio: '2026-02-15', precip: lluviaBuena, tmedia: () => 9,
    tsuelo: (k) => (k === 50 ? null : 12), lluviaAntes: null }),
};
export const DIAS_CASO = [10, 29, 45, 59, 66];

export function casosIndice() {
  const r = [];
  for (const [nombre, fabrica] of Object.entries(SERIES_CASO)) {
    for (const especie of ESPECIES_CASO) for (const i of DIAS_CASO) r.push({ clave: `${nombre}|${especie.id}|${i}`, serie: fabrica(), especie, i });
  }
  return r;
}

// Resultado comparable de un caso: el del índice, o el nombre del error que lanza.
export function resultadoCaso({ serie, i, especie }) {
  try { return JSON.parse(JSON.stringify(calcularIndice(serie, i, especie))); } catch (e) { return { error: e.constructor.name }; }
}

// supabase/functions/pluvio/red.js
// Peticiones a las fuentes con cortesía (spec §3.1): agente identificado, pausa entre peticiones al mismo servidor, un
// reintento tras esperar si contesta 429/5xx o falla la red, y nunca más allá del plazo de la ejecución (`margen`).
export const AGENTE = 'setas-app/1.0 (+https://gonzalotsainz-ux.github.io/setas/)';
export const PAUSA_MS = 400;
export const ESPERA_REINTENTO_MS = 3000;
export const LIMITE_PETICION_MS = 25000;
export const MINIMO_UTIL_MS = 4000;
export class PlazoAgotado extends Error { constructor() { super('plazo agotado'); this.name = 'PlazoAgotado'; } }
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function crearPedir({ fetchFn, esperar = dormir, margen = () => Infinity, senal = (ms) => AbortSignal.timeout(ms) }) {
  const usados = new Set();
  return async function pedir(url, { como = 'json', cabeceras = {}, intentos = 2 } = {}) {
    const host = new URL(url).host;
    for (let n = 1; ; n++) {
      if (usados.has(host)) await esperar(PAUSA_MS);
      usados.add(host);
      const ms = Math.min(LIMITE_PETICION_MS, margen());
      if (!(ms >= MINIMO_UTIL_MS)) throw new PlazoAgotado();
      const reintentar = n < intentos && margen() >= ESPERA_REINTENTO_MS + MINIMO_UTIL_MS;
      let r;
      try {
        r = await fetchFn(url, { headers: { 'User-Agent': AGENTE, ...cabeceras }, signal: senal(ms) });
      } catch (e) {
        if (!reintentar) throw e;
        await esperar(ESPERA_REINTENTO_MS);
        continue;
      }
      if (r.ok) {
        if (como === 'texto') return r.text();
        if (como === 'bytes') return new Uint8Array(await r.arrayBuffer());
        return r.json();
      }
      if ((r.status === 429 || r.status >= 500) && reintentar) { await esperar(ESPERA_REINTENTO_MS); continue; }
      throw new Error(`${host} respondió ${r.status}`);
    }
  };
}

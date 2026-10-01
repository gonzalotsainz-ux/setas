// scripts/rejilla/terreno.mjs
// Orientación y pendiente de cada celda fina por el método de Horn sobre la rejilla de altitudes medias (250 m).
// Orientación = hacia dónde baja la ladera (N = umbría, S = solana). Tramos y «llano» (< 5 %): criterio propio, docs/datos.md.
export const tramoDe = (pct) => (pct < 5 ? 0 : pct < 15 ? 1 : pct < 30 ? 2 : 3);

// `pasoSuelo`: lado de celda en metros de SUELO (metrosSuelo(TAM_FINA, lat)), no en metros Mercator; un número o una
// función fila → paso, para usar la latitud de cada fila (en una zona grande cambia hasta un 12 %).
// Si falta cualquiera de los 8 vecinos (borde de la ventana o sin dato), la celda queda en llano (orientación 0, tramo 0).
export function orientacionPendiente(alt, ancho, alto, pasoSuelo) {
  const n = ancho * alto, orientacion = new Uint8Array(n), tramo = new Uint8Array(n);
  const pasoDe = typeof pasoSuelo === 'function' ? pasoSuelo : () => pasoSuelo;
  for (let f = 1; f < alto - 1; f++) for (let c = 1, paso = pasoDe(f); c < ancho - 1; c++) {
    const k = f * ancho + c;
    const z = (dc, df) => alt[k + df * ancho + dc];
    const a = z(-1, -1), b = z(0, -1), d = z(1, -1), iz = z(-1, 0), e = z(0, 0), de = z(1, 0), g = z(-1, 1), h = z(0, 1), i = z(1, 1);
    if (![a, b, d, iz, e, de, g, h, i].every(Number.isFinite)) continue;
    const dzEste = ((d + 2 * de + i) - (a + 2 * iz + g)) / (8 * paso);
    const dzSur = ((g + 2 * h + i) - (a + 2 * b + d)) / (8 * paso);
    tramo[k] = tramoDe(100 * Math.hypot(dzEste, dzSur));
    if (tramo[k] === 0) continue;   // llano: sin orientación
    const az = ((Math.atan2(-dzEste, dzSur) * 180) / Math.PI + 360) % 360;   // rumbo de bajada desde el norte
    orientacion[k] = 1 + (Math.round(az / 45) % 8);
  }
  return { orientacion, tramo };
}

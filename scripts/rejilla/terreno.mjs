// scripts/rejilla/terreno.mjs
// Orientación y pendiente de cada celda fina por el método de Horn sobre la rejilla de altitudes medias (250 m).
// Orientación = hacia dónde baja la ladera (N = umbría, S = solana). Tramos y «llano» (< 5 %): criterio propio, docs/datos.md.
export const tramoDe = (pct) => (pct < 5 ? 0 : pct < 15 ? 1 : pct < 30 ? 2 : 3);

export function orientacionPendiente(alt, ancho, alto, paso) {
  const n = ancho * alto, orientacion = new Uint8Array(n), tramo = new Uint8Array(n);
  for (let f = 0; f < alto; f++) for (let c = 0; c < ancho; c++) {
    const k = f * ancho + c, e = alt[k];
    if (!Number.isFinite(e)) continue;
    const z = (dc, df) => {   // vecina, repitiendo el borde; sin dato, la propia celda
      const cc = Math.min(ancho - 1, Math.max(0, c + dc)), ff = Math.min(alto - 1, Math.max(0, f + df));
      const v = alt[ff * ancho + cc];
      return Number.isFinite(v) ? v : e;
    };
    const a = z(-1, -1), b = z(0, -1), d = z(1, -1), iz = z(-1, 0), de = z(1, 0), g = z(-1, 1), h = z(0, 1), i = z(1, 1);
    const dzEste = ((d + 2 * de + i) - (a + 2 * iz + g)) / (8 * paso);
    const dzSur = ((g + 2 * h + i) - (a + 2 * b + d)) / (8 * paso);
    tramo[k] = tramoDe(100 * Math.hypot(dzEste, dzSur));
    if (tramo[k] === 0) continue;   // llano: sin orientación
    const az = ((Math.atan2(-dzEste, dzSur) * 180) / Math.PI + 360) % 360;   // rumbo de bajada desde el norte
    orientacion[k] = 1 + (Math.round(az / 45) % 8);
  }
  return { orientacion, tramo };
}

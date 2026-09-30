// Precipitación diaria de AEMET («2,4», «Ip» = inapreciable, «Acum» = acumulada en otro día, vacío = sin dato).
// Una sola fuente: la usan la Edge Function y el cliente (js/aemet.js).
export function parsearPrec(t) {
  if (t == null) return null;
  if (typeof t === 'number') return Number.isFinite(t) ? t : null;
  const s = String(t).trim();
  if (s === '' || s === 'Acum') return null;
  if (s === 'Ip') return 0;
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

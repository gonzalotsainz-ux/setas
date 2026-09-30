// Gráfico SVG de lluvia en dos paneles con el mismo eje horizontal (60 días pasados + previsión):
// arriba el acumulado de 26 días, abajo la lluvia diaria. La previsión va rayada en ocre, con la
// horquilla entre modelos y una raya en «hoy». Los colores salen de clases CSS (.grafico en componentes.css).
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (f) => (/^\d{4}-\d{2}-\d{2}$/.test(f) ? `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}` : '');
// Las fechas llegan de datos externos y el SVG se inyecta con innerHTML: se escapan.
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const r1 = (x) => Math.round(x * 10) / 10;
const nbsp = ' ';

export function graficoLluvia({ serie, dispersionPunto = null, altura = 250 }) {
  const n = serie.fechas.length, W = 340, X0 = 26, X1 = 332, paso = (X1 - X0) / n, ancho = paso * 0.78;
  const cx = (k) => r1(X0 + paso * (k + 0.5));
  const vals = serie.precip.filter((v) => v != null);

  // Geometría de los dos paneles
  const hA = Math.round((altura - 70) * 0.38), yA1 = 22 + hA, yBrot = yA1 + 18, yB0 = yA1 + 26, yB1 = altura - 24;
  const hB = yB1 - yB0;

  // Acumulado de 26 días (null si la ventana tiene un hueco)
  const acum = serie.precip.map((_, k) => {
    if (k < 25) return null;
    const t = serie.precip.slice(k - 25, k + 1);
    return t.some((v) => v == null) ? null : t.reduce((a, b) => a + b, 0);
  });
  const maxA = Math.max(50, Math.ceil(Math.max(0, ...acum.filter((v) => v != null)) / 50) * 50);
  const maxB = Math.max(10, Math.ceil(Math.max(0, ...vals) / 10) * 10);
  const yA = (mm) => r1(yA1 - (mm / maxA) * (yA1 - 22));
  const yB = (mm) => r1(yB1 - (mm / maxB) * hB);

  // Barras diarias
  const barras = serie.fechas.map((f, k) => {
    const v = serie.precip[k];
    if (v == null) return `<g class="sin-dato"><title>${esc(f)}: sin dato</title><circle class="sin-dato-punto" cx="${cx(k)}" cy="${yB1 - 2}" r="1.6"/></g>`;
    const prev = k > serie.hoy;
    const h = Math.max(v > 0 ? 1 : 0, yB1 - yB(v));
    return `<rect class="${prev ? 'barra prevista barra-prevista' : 'barra barra-pasada'}" x="${r1(cx(k) - ancho / 2)}" y="${r1(yB1 - h)}" width="${r1(ancho)}" height="${r1(h)}" rx="1"><title>${esc(f)}: ${v.toFixed(1)} mm${prev ? ' (previsión)' : ''}</title></rect>`;
  }).join('');

  // Acumulado: tramo pasado continuo y tramo previsto discontinuo, cortados en los huecos
  let lineas = '', tramo = [];
  const cerrar = () => {
    const pas = tramo.filter((k) => k <= serie.hoy), fut = tramo.filter((k) => k >= serie.hoy);
    const pts = (ks) => ks.map((k) => `${cx(k)},${yA(acum[k])}`).join(' ');
    if (pas.length > 1) lineas += `<polyline class="acumulado" points="${pts(pas)}"/>`;
    if (fut.length > 1) lineas += `<polyline class="acumulado-previsto" points="${pts(fut)}"/>`;
    tramo = [];
  };
  acum.forEach((v, k) => { if (v == null) cerrar(); else tramo.push(k); });
  cerrar();

  const hoyOk = serie.hoy >= 0 && serie.hoy < n;
  const xHoy = hoyOk ? cx(serie.hoy) : null;
  const acumHoy = hoyOk ? acum[serie.hoy] : null;
  const zonaPrev = hoyOk && serie.hoy < n - 1
    ? `<rect class="zona-prevision" x="${r1(xHoy + paso / 2)}" y="12" width="${r1(X1 - xHoy - paso / 2)}" height="${yB1 - 12}" rx="4"/>` : '';

  // Horquilla entre modelos: el acumulado al final del horizonte ± la mitad del rango
  let horquilla = '';
  const dp = dispersionPunto;
  if (dp?.media != null && dp.horizonte && hoyOk) {
    const kh = Math.min(n - 1, serie.hoy + dp.horizonte), base = acum[kh];
    if (base != null) {
      const x = cx(kh), lo = Math.max(0, base - dp.rango / 2), hi = base + dp.rango / 2;
      horquilla = `<line class="horquilla" x1="${x}" x2="${x}" y1="${yA(lo)}" y2="${yA(hi)}"/><line class="horquilla" x1="${x - 2.5}" x2="${x + 2.5}" y1="${yA(lo)}" y2="${yA(lo)}"/><line class="horquilla" x1="${x - 2.5}" x2="${x + 2.5}" y1="${yA(hi)}" y2="${yA(hi)}"/>`;
    }
  }

  // Ejes
  const rejilla = (ys, ms) => ms.map((m, i) => `<line class="rejilla" x1="${X0}" x2="${X1}" y1="${ys[i]}" y2="${ys[i]}"/><text x="${X0 - 6}" y="${ys[i] + 4}" text-anchor="end">${m}</text>`).join('');
  const ejes = rejilla([yA(0), yA(maxA / 2), yA(maxA)], [0, maxA / 2, maxA]) + rejilla([yB(0), yB(maxB / 2), yB(maxB)], [0, maxB / 2, maxB]);
  const fechas = [];
  serie.fechas.forEach((f, k) => {
    const primero = k === 0, mes = f.endsWith('-01') && k > 0;
    if (!primero && !mes) return;
    if (xHoy != null && Math.abs(cx(k) - xHoy) < 28) return;
    fechas.push(`<text x="${cx(k)}" y="${altura - 6}" text-anchor="${primero ? 'start' : 'middle'}">${fechaCorta(f)}</text>`);
  });
  const rotulos = `<text class="rotulo-fuerte" x="${X0}" y="14">Acumulado de 26 días, mm</text><text class="rotulo-fuerte" x="${X0}" y="${yBrot}">Lluvia diaria, mm</text>`
    + (hoyOk ? `<text class="rotulo-fuerte" x="${xHoy}" y="${altura - 6}" text-anchor="middle">hoy</text>` : '')
    + (zonaPrev ? `<text class="rotulo-fuerte" x="${X1}" y="14" text-anchor="end">previsión</text>` : '');
  const marca = hoyOk ? `<line class="hoy" x1="${xHoy}" x2="${xHoy}" y1="12" y2="${yB1 + 4}"/>` : '';
  const punto = acumHoy != null ? `<circle class="punto-acumulado" cx="${xHoy}" cy="${yA(acumHoy)}" r="3.5"/><text class="rotulo-fuerte" x="${r1(xHoy - 7)}" y="${r1(yA(acumHoy) - 6)}" text-anchor="end">${Math.round(acumHoy)}${nbsp}mm</text>` : '';

  const desc = [`Arriba, lluvia acumulada en 26 días${acumHoy != null ? `: hoy ${Math.round(acumHoy)} mm` : ''}. Abajo, lluvia diaria.`,
    dp?.media != null && dp.horizonte ? `Previsión a ${dp.horizonte} días: media de ${Math.round(dp.media)} mm entre modelos, con ${Math.round(dp.rango)} mm de diferencia entre el que más y el que menos.` : ''].filter(Boolean).join(' ');
  const trama = '<defs><pattern id="rayado" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="rayado-linea" x1="0" y1="0" x2="0" y2="4"/></pattern></defs>';
  return `<svg class="grafico-lluvia" viewBox="0 0 ${W} ${altura}" role="img" aria-labelledby="graf-titulo graf-desc"><title id="graf-titulo">Lluvia de los últimos ${hoyOk ? serie.hoy + 1 : n} días${hoyOk && serie.hoy < n - 1 ? ` y previsión de ${n - 1 - serie.hoy}` : ''}</title><desc id="graf-desc">${desc}</desc>${trama}${zonaPrev}${ejes}${rotulos}${lineas}${horquilla}${punto}${barras}${marca}${fechas.join('')}</svg>`;
}

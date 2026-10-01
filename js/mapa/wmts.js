// Teselas WMTS del IGN/IDEE y sus atribuciones: una sola copia, sin dependencias (la usan js/mapa.js y js/mapa/fondos.js).
export const WMTS = (base, capa, fmt) => `${base}?service=WMTS&request=GetTile&version=1.0.0&layer=${capa}&style=default&format=image/${fmt}&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}`;
export const ATR_IGN = '© <a href="https://www.scne.es">Instituto Geográfico Nacional</a> CC BY 4.0';
export const ATR_PNOA = `PNOA cedido por ${ATR_IGN}`;
export const IGN_TOPOGRAFICO = { url: WMTS('https://www.ign.es/wmts/mapa-raster', 'MTN', 'jpeg'), atribucion: ATR_IGN };
export const IGN_PNOA = { url: WMTS('https://www.ign.es/wmts/pnoa-ma', 'OI.OrthoimageCoverage', 'jpeg'), atribucion: ATR_PNOA };
export const IGN_BASE = { url: WMTS('https://www.ign.es/wmts/ign-base', 'IGNBaseTodo', 'jpeg'), atribucion: ATR_IGN };

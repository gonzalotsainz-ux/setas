// Reduce una foto del móvil a 1.600 px como máximo y JPEG de calidad 0,8 (respetando la orientación EXIF).
// El bucket solo admite 2 MB por foto: si no cabe, baja la calidad y luego el tamaño (ajustarATamano).
// Motor preferido: OffscreenCanvas; si el navegador no lo tiene, canvas normal + toBlob.
import { ajustarATamano } from './diario.js';

// Qué motor de codificación usar según lo que ofrezca el entorno (función pura, probada).
export function elegirMotor(entorno = globalThis) {
  const off = typeof entorno.OffscreenCanvas === 'function' && typeof entorno.OffscreenCanvas.prototype?.convertToBlob === 'function';
  if (off) return 'offscreen';
  if (typeof entorno.document?.createElement === 'function') return 'canvas';
  return null;
}

// Decodifica la foto: createImageBitmap con orientación EXIF; sin opciones si no las admite; y <img> como último recurso.
async function decodificar(file) {
  if (typeof createImageBitmap === 'function') {
    for (const opciones of [{ imageOrientation: 'from-image' }, undefined]) {
      try { const b = await (opciones ? createImageBitmap(file, opciones) : createImageBitmap(file)); return { fuente: b, ancho: b.width, alto: b.height, cerrar: () => b.close?.() }; } catch { /* siguiente */ }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();   // los navegadores actuales aplican la orientación EXIF al dibujar un <img>
    return { fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
  } catch (e) { URL.revokeObjectURL(url); throw new Error('No se pudo leer la foto'); }
}

export async function reducirFoto(file, max = 1600, calidad = 0.8) {
  const motor = elegirMotor();
  if (!motor) throw new Error('Este navegador no puede preparar fotos.');
  const im = await decodificar(file);
  try {
    const r = await ajustarATamano(async ({ lado, calidad: q }) => {
      const k = Math.min(1, lado / Math.max(im.ancho, im.alto));
      const w = Math.max(1, Math.round(im.ancho * k)), h = Math.max(1, Math.round(im.alto * k));
      let blob;
      if (motor === 'offscreen') {
        const c = new OffscreenCanvas(w, h);
        c.getContext('2d').drawImage(im.fuente, 0, 0, w, h);
        blob = await c.convertToBlob({ type: 'image/jpeg', quality: q });
      } else {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(im.fuente, 0, 0, w, h);
        blob = await new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('No se pudo codificar la foto'))), 'image/jpeg', q));
      }
      return { blob, size: blob.size, ancho: w, alto: h };
    }, { max, calidad });
    return { blob: r.blob, ancho: r.ancho, alto: r.alto };
  } finally { im.cerrar(); }
}

export const aDataUrl = (blob) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = () => mal(r.error);
  r.readAsDataURL(blob);
});

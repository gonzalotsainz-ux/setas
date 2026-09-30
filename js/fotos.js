// Reduce una foto del móvil a 1.600 px como máximo y JPEG de calidad 0,8 (respetando la orientación EXIF).
// El bucket solo admite 2 MB por foto: si no cabe, baja la calidad y luego el tamaño (ajustarATamano).
import { ajustarATamano } from './diario.js';

export async function reducirFoto(file, max = 1600, calidad = 0.8) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const r = await ajustarATamano(async ({ lado, calidad: q }) => {
      const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
      const c = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * k)), Math.max(1, Math.round(bmp.height * k)));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await c.convertToBlob({ type: 'image/jpeg', quality: q });
      return { blob, size: blob.size, ancho: c.width, alto: c.height };
    }, { max, calidad });
    return { blob: r.blob, ancho: r.ancho, alto: r.alto };
  } finally { bmp.close?.(); }
}

export const aDataUrl = (blob) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = () => mal(r.error);
  r.readAsDataURL(blob);
});

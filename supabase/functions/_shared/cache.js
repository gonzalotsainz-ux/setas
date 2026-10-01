// Caché en localStorage que nunca rompe la app (Safari privado, cuota llena, sin almacén).
const PREFIJO = 'setas:';
export const almacenPorDefecto = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const def = almacenPorDefecto;

export function leer(clave, almacen = def()) {
  try { const t = almacen?.getItem(PREFIJO + clave); return t ? JSON.parse(t) : null; } catch { return null; }
}
export function guardar(clave, datos, hora = new Date().toISOString(), almacen = def()) {
  try { if (!almacen) return false; almacen.setItem(PREFIJO + clave, JSON.stringify({ datos, hora })); return true; } catch { return false; }
}
export function borrarPrefijo(prefijo, excepto, almacen = def()) {
  try {
    for (let k = almacen.length - 1; k >= 0; k--) {
      const c = almacen.key(k);
      if (c?.startsWith(PREFIJO + prefijo) && c !== PREFIJO + excepto) almacen.removeItem(c);
    }
  } catch { /* sin almacén: nada que limpiar */ }
}

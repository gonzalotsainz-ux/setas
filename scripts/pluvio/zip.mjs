// scripts/pluvio/zip.mjs
// Lector mínimo de zip, sin dependencias: directorio central y entradas guardadas (0) o con deflate (8). Basta para el
// histórico de Euskalmet (un zip de zips, sin ZIP64).
import { inflateRawSync } from 'node:zlib';

export function entradasZip(buf) {
  const tope = Math.max(0, buf.length - 65557);
  let i = buf.length - 22;
  while (i >= tope && buf.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < tope) throw new Error('no es un zip (sin fin de directorio)');
  const n = buf.readUInt16LE(i + 10);
  let p = buf.readUInt32LE(i + 16);
  const entradas = new Map();
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: directorio central dañado');
    const metodo = buf.readUInt16LE(p + 10), comprimido = buf.readUInt32LE(p + 20), largo = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30), comentario = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    entradas.set(buf.toString('utf8', p + 46, p + 46 + largo), { metodo, comprimido, local });
    p += 46 + largo + extra + comentario;
  }
  return entradas;
}
export function leerEntrada(buf, e) {
  if (buf.readUInt32LE(e.local) !== 0x04034b50) throw new Error('zip: cabecera local dañada');
  const ini = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
  const datos = buf.subarray(ini, ini + e.comprimido);
  if (e.metodo === 0) return Buffer.from(datos);
  if (e.metodo === 8) return inflateRawSync(datos);
  throw new Error(`zip: método ${e.metodo} no admitido`);
}

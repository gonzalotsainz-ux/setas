// Formato binario de la rejilla fina (data/rejilla/<zona>.bin), descrito en docs/datos.md («Formato de la rejilla»):
// «SETR» + versión (u8) + longitud de la cabecera (u32 LE) + cabecera JSON + carga gzip con tres planos
// (hábitat u8, terreno u8, altitud i16 LE en diferencias por fila). Usa CompressionStream: vale en Node 24 y en el móvil.
export const MAGIA = 'SETR';
export const VERSION = 1;
// Byte de hábitat: bits 0-4 = código (índice en cabecera.habitats + 1; 0 = sin monte), bit 5 = fuera de las provincias de
// la zona (monte de una provincia vecina: normativa no revisada), bit 6 = reservado (siempre 0), bit 7 = prohibido.
export const PROHIBIDO = 0x80;
export const FUERA_PROVINCIAS = 0x20;
export const RESERVADO = 0x40;
export const CODIGO = 0x1f;
export const ORIENTACIONES = ['llano', 'N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
// Espacio duro (U+00A0) entre número y unidad, como pide docs/diseno.md.
export const TRAMOS_PENDIENTE = ['menos del 5\u00a0%', 'del 5 al 15\u00a0%', 'del 15 al 30\u00a0%', '30\u00a0% o más'];
const CAMPOS = ['version', 'zona', 'tam', 'col0', 'fila0', 'ancho', 'alto', 'habitats', 'fuentes', 'generado'];

const pasar = async (bytes, transformacion) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transformacion)).arrayBuffer());
const comoBytes = (e) => (e instanceof Uint8Array ? e : new Uint8Array(e));

export async function codificarRejilla(cabecera, { habitat, terreno, altitud }) {
  const faltan = CAMPOS.filter((k) => cabecera[k] == null);
  if (faltan.length) throw new Error(`cabecera sin ${faltan.join(', ')}`);
  const { ancho, alto } = cabecera, n = ancho * alto;
  if (habitat.length !== n || terreno.length !== n || altitud.length !== n) throw new Error(`los planos deben tener ${n} celdas`);
  const carga = new Uint8Array(n * 4), vista = new DataView(carga.buffer);
  carga.set(habitat, 0);
  carga.set(terreno, n);
  for (let f = 0; f < alto; f++) {
    let previo = 0;
    for (let c = 0; c < ancho; c++) { const k = f * ancho + c; vista.setInt16(2 * n + 2 * k, altitud[k] - previo, true); previo = altitud[k]; }
  }
  const comprimida = await pasar(carga, new CompressionStream('gzip'));
  const cab = new TextEncoder().encode(JSON.stringify(cabecera));
  const salida = new Uint8Array(9 + cab.length + comprimida.length);
  salida.set(new TextEncoder().encode(MAGIA), 0);
  salida[4] = VERSION;
  new DataView(salida.buffer).setUint32(5, cab.length, true);
  salida.set(cab, 9);
  salida.set(comprimida, 9 + cab.length);
  return salida;
}

export function leerCabecera(entrada) {
  const b = comoBytes(entrada);
  if (b.length < 9 || new TextDecoder().decode(b.subarray(0, 4)) !== MAGIA) throw new Error('no es una rejilla de Setas');
  if (b[4] !== VERSION) throw new Error(`versión de rejilla ${b[4]} desconocida`);
  const largo = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(5, true);
  if (9 + largo > b.length) throw new Error('rejilla dañada: cabecera incompleta');
  let cabecera;
  try { cabecera = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(9, 9 + largo))); }
  catch { throw new Error('rejilla dañada: cabecera ilegible'); }
  const entero = (v, min) => Number.isInteger(v) && v >= min;
  if (!cabecera || !entero(cabecera.ancho, 1) || !entero(cabecera.alto, 1) || !entero(cabecera.tam, 1)
    || !entero(cabecera.col0, 0) || !entero(cabecera.fila0, 0) || !Array.isArray(cabecera.habitats)) {
    throw new Error('rejilla dañada: cabecera con ancho, alto, tam, col0, fila0 o hábitats inválidos');
  }
  return { cabecera, inicio: 9 + largo };
}

export async function decodificarRejilla(entrada) {
  const b = comoBytes(entrada);
  const { cabecera, inicio } = leerCabecera(b);
  const { ancho, alto } = cabecera, n = ancho * alto;
  let carga;
  try { carga = await pasar(b.subarray(inicio), new DecompressionStream('gzip')); }
  catch { throw new Error('rejilla dañada: carga ilegible o incompleta'); }
  if (carga.length !== n * 4) throw new Error('rejilla dañada: la carga no tiene el tamaño de la cabecera');
  for (let k = 0; k < n; k++) {
    const v = carga[k];
    const raro = v & RESERVADO || (v & FUERA_PROVINCIAS && !(v & CODIGO));   // «fuera» solo tiene sentido con hábitat
    if (raro || (v & CODIGO) > cabecera.habitats.length) {
      throw new Error(`rejilla dañada: código de hábitat ${raro ? v : v & CODIGO} fuera de la cabecera`);
    }
  }
  const vista = new DataView(carga.buffer, carga.byteOffset, carga.byteLength);
  const altitud = new Int16Array(n);
  for (let f = 0; f < alto; f++) {
    let previo = 0;
    for (let c = 0; c < ancho; c++) { const k = f * ancho + c; previo += vista.getInt16(2 * n + 2 * k, true); altitud[k] = previo; }
  }
  return { cabecera, habitat: carga.slice(0, n), terreno: carga.slice(n, 2 * n), altitud };
}

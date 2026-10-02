// tests/dobles-pluvio.js
// Dobles de la función «pluvio»: respuestas reales guardadas del SAIH Tajo (tests/fixtures/pluvio/tajo-*, capturadas el
// 02/10/2026), un servidor falso que las sirve por URL y un almacén en memoria con la interfaz de almacenSupabase.
// OJO: aemet-convencional.json es SINTÉTICA (no capturada): sigue el formato de la especificación oficial de
// /observacion/convencional/todas, con `fint` sin zona («2026-10-02T06:00:00», UTC).
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { agregarHoras } from '../supabase/functions/pluvio/dias.js';

export const fixture = (nombre, enc = 'utf8') => readFileSync(new URL(`./fixtures/pluvio/${nombre}`, import.meta.url), enc);
export const fixtureJson = (nombre) => JSON.parse(fixture(nombre));

export function respuesta(status, cuerpo, cabeceras = {}) {
  const bytes = Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), 'utf8');
  return { ok: status >= 200 && status < 300, status, headers: new Map(Object.entries(cabeceras)),
    json: async () => JSON.parse(bytes.toString('utf8')), text: async () => bytes.toString('utf8'),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

// rutas: [[(url) => boolean, (url, opciones) => respuesta], …]; responde la primera que encaja; si ninguna, 404.
export function servidorFalso(rutas, registro = []) {
  return async (url, opciones = {}) => {
    registro.push({ url, cabeceras: opciones.headers ?? {} });
    for (const [encaja, responder] of rutas) if (encaja(url)) return responder(url, opciones);
    return respuesta(404, 'no encontrado');
  };
}

// SAIH Tajo con las capturas reales: la estación P_26 contesta por todas.
export const rutasTajo = () => [
  [(u) => u.includes('get-estacion-grafico-grande'), () => respuesta(200, fixture('tajo-grafico-P_26.json'))],
  [(u) => u.includes('w=get-estacion&'), () => respuesta(200, fixture('tajo-estacion-P_26.json'))],
  [(u) => u.includes('get-wrapperentorno'), () => respuesta(200, fixture('tajo-wrapper.json'))],
  [(u) => u.includes('w=get-menu'), () => respuesta(200, fixture('tajo-menu.json'))],
  [(u) => u.includes('w=get-pluviometria&'), () => respuesta(200, fixture('tajo-pluviometria.json'))],
  [(u) => u === 'https://saihtajo.chtajo.es/', () => respuesta(200, fixture('tajo-inicio.html'))],
];
// AEMET en dos pasos: la primera llamada da la URL de los datos; la segunda, los datos en ISO-8859-15.
// Los datos son SINTÉTICOS (aemet-convencional.json, formato de la especificación oficial), no una respuesta capturada.
export const rutasAemet = (estado = 200) => [
  [(u) => u.includes('/observacion/convencional/todas'), () => respuesta(200, estado === 200
    ? { descripcion: 'exito', estado: 200, datos: 'https://opendata.aemet.es/opendata/sh/datos-falsos' }
    : { descripcion: 'API key invalido', estado })],
  [(u) => u.includes('/opendata/sh/datos-falsos'), () => respuesta(200, Buffer.from(fixture('aemet-convencional.json'), 'latin1'))],
];

// Almacén en memoria con la interfaz de almacenSupabase. Como Postgres, un upsert que toca dos veces la misma fila falla.
// diasPorEstacion devuelve lo mismo que la función SQL lluvia_por_dia (un array por columna y estación).
export function almacenPluvioMemoria() {
  const obs = new Map(), dias = new Map(), modelo = new Map(), archivos = new Map();
  return {
    obs, dias, modelo, archivos,
    async guardarObs(filas) {
      const claves = filas.map((f) => `${f.fuente}|${f.estacion}|${f.hora}`);
      if (new Set(claves).size !== claves.length) throw new Error('ON CONFLICT DO UPDATE command cannot affect row a second time');
      filas.forEach((f, k) => obs.set(claves[k], { ...f }));
    },
    async diasPorEstacion(desde) {
      const r = new Map();
      for (const d of agregarHoras([...obs.values()], desde)) {
        const k = `${d.fuente}|${d.estacion}`;
        if (!r.has(k)) r.set(k, { fuente: d.fuente, estacion: d.estacion, fechas: [], mm: [], horas: [], maximo: [] });
        const x = r.get(k);
        x.fechas.push(d.fecha); x.mm.push(d.mm); x.horas.push(d.horas); x.maximo.push(d.maximo);
      }
      return [...r.values()];
    },
    async guardarDias(filas) { for (const f of filas) dias.set(`${f.fuente}|${f.estacion}|${f.fecha}`, { ...f }); },
    async subir(nombre, json) { archivos.set(nombre, JSON.parse(JSON.stringify(json))); },
    async precipCeldas(ids) { return new Map(ids.filter((id) => modelo.has(id)).map((id) => [id, modelo.get(id)])); },
  };
}

// Zip mínimo (deflate, sin CRC: el lector no lo comprueba) para probar el lector del histórico de Euskalmet.
export function crearZip(archivos) {
  const locales = [], centrales = [];
  let pos = 0;
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const n = Buffer.from(nombre), datos = deflateRawSync(contenido);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(8, 8); l.writeUInt32LE(datos.length, 18); l.writeUInt32LE(contenido.length, 22); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(datos.length, 20); c.writeUInt32LE(contenido.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(pos, 42);
    locales.push(l, n, datos);
    centrales.push(c, n);
    pos += 30 + n.length + datos.length;
  }
  const cd = Buffer.concat(centrales), fin = Buffer.alloc(22), total = centrales.length / 2;
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(total, 8); fin.writeUInt16LE(total, 10); fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(pos, 16);
  return Buffer.concat([...locales, cd, fin]);
}

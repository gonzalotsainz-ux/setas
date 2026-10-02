// tests/dobles-pluvio.js
// Dobles de la función «pluvio»: respuestas reales guardadas (tests/fixtures/pluvio/, capturadas el 02/10/2026), un
// servidor falso que las sirve por URL y un almacén en memoria con la interfaz de almacenSupabase.
import { readFileSync } from 'node:fs';

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
export const rutasAemet = (estado = 200) => [
  [(u) => u.includes('/observacion/convencional/todas'), () => respuesta(200, estado === 200
    ? { descripcion: 'exito', estado: 200, datos: 'https://opendata.aemet.es/opendata/sh/datos-falsos' }
    : { descripcion: 'API key invalido', estado })],
  [(u) => u.includes('/opendata/sh/datos-falsos'), () => respuesta(200, Buffer.from(fixture('aemet-convencional.json'), 'latin1'))],
];

// Almacén en memoria con la interfaz de almacenSupabase. Como Postgres, un upsert que toca dos veces la misma fila falla.
export function almacenPluvioMemoria() {
  const obs = new Map();
  return {
    obs,
    async guardarObs(filas) {
      const claves = filas.map((f) => `${f.fuente}|${f.estacion}|${f.hora}`);
      if (new Set(claves).size !== claves.length) throw new Error('ON CONFLICT DO UPDATE command cannot affect row a second time');
      filas.forEach((f, k) => obs.set(claves[k], { ...f }));
    },
  };
}

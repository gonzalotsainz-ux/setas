// tests/rejilla-carga.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarIndice, avisoIndice, selloEsperado, diasDisponibles, archivosVisibles, archivoDeCelda, crearCargadorRejillas, rejillasSoportadas, cargarDatosRejilla, ZOOM_MIN_FINA, BASE_INDICE } from '../js/rejilla/carga.js';
import { codificarRejilla } from '../js/rejilla/formato.js';
import { almacenFalso } from './ayudas.js';

const fechas = (desde) => Array.from({ length: 10 }, (_, k) => new Date(Date.parse(`${desde}T00:00:00Z`) + k * 864e5).toISOString().slice(0, 10));
const salidaDe = (sello) => ({ version: 1, sello, generado: '2026-10-01T05:03:00.000Z', hoy: sello.slice(0, 10), fechas: fechas(sello.slice(0, 10)),
  celdas: { 'z:1:1': { altRef: 1000, incompleta: false, lluvia: { desde: '2026-08-03', hoy: 59, mm: [] }, dias: Array(10).fill(null) } } });
function servidor(sello) {
  const registro = [];
  const fetchFn = async (url) => {
    registro.push(url);
    if (url.startsWith(`${BASE_INDICE}/ultimo.json`)) return { ok: true, json: async () => ({ version: 1, sello: sello.actual, archivo: `${sello.actual}.json` }) };
    if (url === `${BASE_INDICE}/${sello.actual}.json`) return { ok: true, json: async () => salidaDe(sello.actual) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchFn, registro };
}
const T0 = new Date('2026-10-01T06:00:00Z');

test('cargarIndice: baja el puntero y el archivo; en 3 h, de la caché; luego, solo el puntero si no cambió', async () => {
  const sello = { actual: '2026-10-01T07' }, { fetchFn, registro } = servidor(sello), almacen = almacenFalso();
  const a = await cargarIndice({ fetchFn, ahora: T0, almacen });
  assert.equal(a.salida.sello, '2026-10-01T07');
  assert.equal(a.desdeCache, false);
  assert.equal(registro.length, 2);
  const b = await cargarIndice({ fetchFn, ahora: new Date(T0.getTime() + 2 * 3600e3), almacen });
  assert.equal(b.desdeCache, true);
  assert.equal(registro.length, 2);
  const c = await cargarIndice({ fetchFn, ahora: new Date(T0.getTime() + 4 * 3600e3), almacen });
  assert.equal(c.salida.sello, '2026-10-01T07');
  assert.equal(registro.length, 3);
  sello.actual = '2026-10-01T19';
  const d = await cargarIndice({ fetchFn, ahora: new Date(T0.getTime() + 8 * 3600e3), almacen });
  assert.equal(d.salida.sello, '2026-10-01T19');
  assert.equal(registro.length, 5);
});

test('cargarIndice: sin red, el guardado con aviso de error; sin nada guardado, sin índice', async () => {
  const almacen = almacenFalso();
  await cargarIndice({ fetchFn: servidor({ actual: '2026-10-01T07' }).fetchFn, ahora: T0, almacen });
  const caido = async () => { throw new Error('sin red'); };
  const r = await cargarIndice({ fetchFn: caido, ahora: new Date(T0.getTime() + 5 * 3600e3), almacen });
  assert.equal(r.salida.sello, '2026-10-01T07');
  assert.match(r.error, /sin red/);
  const nada = await cargarIndice({ fetchFn: caido, ahora: T0, almacen: almacenFalso() });
  assert.equal(nada.salida, null);
  assert.match(nada.error, /sin red/);
});

test('cargarIndice: con el almacén lleno o bloqueado el índice llega igual (sin caché)', async () => {
  const lleno = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem() {}, key: () => null, length: 0 };
  const r = await cargarIndice({ fetchFn: servidor({ actual: '2026-10-01T07' }).fetchFn, ahora: T0, almacen: lleno });
  assert.equal(r.salida.sello, '2026-10-01T07');
  assert.equal(r.error, undefined);
  const bloqueado = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  assert.equal((await cargarIndice({ fetchFn: servidor({ actual: '2026-10-01T07' }).fetchFn, ahora: T0, almacen: bloqueado })).salida.sello, '2026-10-01T07');
});

test('cargarIndice: un archivo mal formado no se usa', async () => {
  const fetchFn = async (url) => ({ ok: true, json: async () => (url.includes('ultimo.json') ? { sello: '2026-10-01T07', archivo: '2026-10-01T07.json' } : { version: 9 }) });
  const r = await cargarIndice({ fetchFn, ahora: T0, almacen: almacenFalso() });
  assert.equal(r.salida, null);
  assert.match(r.error, /mal formado/);
});

test('avisos de antigüedad: «Datos de ayer a las 19:00» y compañía, con 45 min de margen y cambio de hora', () => {
  const s = (sello) => ({ sello });
  assert.equal(avisoIndice(s('2026-10-01T07'), new Date('2026-10-01T06:00:00Z')), null);
  assert.equal(avisoIndice(s('2026-09-30T19'), new Date('2026-10-01T06:00:00Z')), 'Datos de ayer a las 19:00. No se ha podido actualizar el mapa; las manchas son de entonces.');
  assert.equal(avisoIndice(s('2026-09-30T19'), new Date('2026-10-01T05:20:00Z')), null);   // 07:20: aún dentro del margen
  assert.match(avisoIndice(s('2026-10-01T07'), new Date('2026-10-01T20:00:00Z')), /^Datos de hoy a las 07:00\./);
  assert.match(avisoIndice(s('2026-09-30T19'), new Date('2026-10-03T10:00:00Z')), /^Datos del 30 de septiembre a las 19:00\./);
  assert.equal(avisoIndice(s('2026-10-24T19'), new Date('2026-10-25T06:30:00Z')), null);   // 07:30 de invierno
  assert.match(avisoIndice(s('2026-10-24T19'), new Date('2026-10-25T07:00:00Z')), /^Datos de ayer a las 19:00\./);
  assert.equal(selloEsperado(new Date('2026-10-01T03:00:00Z')), '2026-09-30T19');
  assert.equal(avisoIndice(null), null);
});

test('días disponibles: con un índice de ayer, la barra empieza hoy', () => {
  const salida = salidaDe('2026-09-30T19');
  const d = diasDisponibles(salida, '2026-10-01');
  assert.equal(d[0], '2026-10-01');
  assert.equal(d.length, 9);
  assert.deepEqual(diasDisponibles(null, '2026-10-01'), []);
});

test('archivos visibles y archivo de una celda', () => {
  const indice = { archivos: [{ zona: 'guadarrama', archivo: 'guadarrama.bin', col0: 78257, fila0: 60071, ancho: 215, alto: 236 },
    { zona: 'toledo', archivo: 'toledo.bin', col0: 78300, fila0: 63400, ancho: 468, alto: 260 }] };
  assert.deepEqual(archivosVisibles(indice, [-4.0, 40.84, -3.98, 40.86]).map((a) => a.archivo), ['guadarrama.bin']);
  assert.deepEqual(archivosVisibles(indice, [10, 50, 11, 51]), []);
  assert.equal(archivoDeCelda(indice, 78371, 60187).archivo, 'guadarrama.bin');
  assert.equal(archivoDeCelda(indice, 1, 1), null);
});

test('cargador de rejillas: una descarga por archivo; si falla, se reintenta la próxima vez', async () => {
  const fuente = { nombre: 'x', url: 'https://x.es', fecha: '2026-10-01' };
  const bytes = await codificarRejilla({ version: 1, zona: 'soria', tam: 250, col0: 1, fila0: 1, ancho: 1, alto: 1, habitats: ['hayedo'], fuentes: { mfe: fuente, mdt: fuente }, generado: '2026-10-01' },
    { habitat: Uint8Array.of(1), terreno: Uint8Array.of(0), altitud: Int16Array.of(1300) });
  let n = 0, falla = true;
  const fetchFn = async () => { n++; if (falla) return { ok: false, status: 500 }; return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; };
  const c = crearCargadorRejillas({ fetchFn, base: 'data/rejilla/' });
  await assert.rejects(c.cargar('soria.bin'), /500/);
  falla = false;
  const [a, b] = await Promise.all([c.cargar('soria.bin'), c.cargar('soria.bin')]);
  assert.equal(a, b);
  assert.equal(a.altitud[0], 1300);
  assert.equal(n, 2);
});

test('rejillas partidas en bandas (indice.json real): cada celda cae en su banda y un bbox pequeño no baja las demás', async () => {
  const { readFile } = await import('node:fs/promises');
  const indice = JSON.parse(await readFile(new URL('../data/rejilla/indice.json', import.meta.url), 'utf8'));
  const bandas = indice.archivos.filter((a) => a.zona === 'extremadura');
  assert.ok(bandas.length > 1);
  const b = bandas[1];
  assert.equal(archivoDeCelda(indice, b.col0 + 10, b.fila0 + 10).archivo, b.archivo);
  assert.equal(archivoDeCelda(indice, b.col0 + 10, b.fila0 + b.alto + 5000), null);
  const { centroFina, aGrados } = await import('../js/rejilla/geo.js');
  const { x, y } = centroFina(b.col0 + 100, b.fila0 + 100), { lon, lat } = aGrados(x, y);
  assert.deepEqual(archivosVisibles(indice, [lon - 0.001, lat - 0.001, lon + 0.001, lat + 0.001]).map((a) => a.archivo), [b.archivo]);
});

test('sin DecompressionStream (Safari < 16.4) el cargador avisa sin romper y no descarga nada', async () => {
  const guardada = globalThis.DecompressionStream;
  let n = 0;
  try {
    delete globalThis.DecompressionStream;
    assert.equal(rejillasSoportadas(), false);
    const c = crearCargadorRejillas({ fetchFn: async () => { n++; return { ok: true }; }, base: 'x/' });
    await assert.rejects(c.cargar('soria.bin'), /no puede leer el mapa por laderas/);
    assert.equal(n, 0);
  } finally { globalThis.DecompressionStream = guardada; }
  assert.equal(rejillasSoportadas(), true);
});

test('avisos: el 25/10 el cambio de hora no adelanta ni retrasa el aviso (se usa la hora de Madrid, no la UTC)', () => {
  const s = { sello: '2026-10-24T19' };
  assert.equal(selloEsperado(new Date('2026-10-25T06:30:00Z')), '2026-10-24T19');   // 07:30 CET
  assert.equal(selloEsperado(new Date('2026-10-25T06:45:00Z')), '2026-10-25T07');   // 07:45 CET -> margen cumplido
  assert.equal(selloEsperado(new Date('2026-10-24T05:45:00Z')), '2026-10-24T07');   // 07:45 CEST
  assert.equal(avisoIndice(s, new Date('2026-10-25T06:30:00Z')), null);
  assert.equal(avisoIndice({ sello: '2026-10-25T07' }, new Date('2026-10-25T18:30:00Z')), null);   // 19:30 CET, margen de 45 min
});

const esperaConSenal = (ms) => (url, { signal } = {}) => new Promise((_, rechazar) => {
  signal?.addEventListener('abort', () => rechazar(new Error('abortado')));
});

test('zoom bajo: sin rejillas finas; Guadalupe (39,4528 N; 5,3278 O) a zoom 9 baja solo las bandas 2 y 3', async () => {
  const { readFile } = await import('node:fs/promises');
  const indice = JSON.parse(await readFile(new URL('../data/rejilla/indice.json', import.meta.url), 'utf8'));
  assert.equal(ZOOM_MIN_FINA, 9);
  const entera = [-7.6, 38.0, -4.6, 40.5];
  assert.ok(archivosVisibles(indice, entera, 9).length > 1);
  assert.deepEqual(archivosVisibles(indice, entera, 7), []);
  assert.deepEqual(archivosVisibles(indice, entera, 8.99), []);
  const guadalupe = [-5.4278, 39.3528, -5.2278, 39.5528];   // ±0,1° alrededor del monasterio
  assert.deepEqual(archivosVisibles(indice, guadalupe, 9).map((a) => a.archivo).sort(), ['extremadura-2.bin', 'extremadura-3.bin']);
});

test('caché: más vieja que la ejecución esperada, del futuro, corrupta o de otra versión, no se sirve sin mirar', async () => {
  const mk = () => servidor({ actual: '2026-10-01T19' });
  // sello 07 guardado a las 10:00 Madrid; a las 19:50 (3 h no cumplidas desde las 17:00) ya debería haber otro
  const almacen = almacenFalso();
  const guardado = (hora, sello) => almacen.setItem('setas:indice', JSON.stringify({ datos: salidaDe(sello), hora }));
  guardado('2026-10-01T17:00:00.000Z', '2026-10-01T07');
  let s = mk();
  const r = await cargarIndice({ fetchFn: s.fetchFn, ahora: new Date('2026-10-01T18:30:00Z'), almacen });   // 20:30 Madrid
  assert.equal(r.salida.sello, '2026-10-01T19');
  assert.equal(s.registro.length, 2);
  // reloj adelantado: hora guardada en el futuro
  guardado('2026-10-02T10:00:00.000Z', '2026-10-01T19');
  s = mk();
  await cargarIndice({ fetchFn: s.fetchFn, ahora: new Date('2026-10-01T18:30:00Z'), almacen });
  assert.ok(s.registro.length >= 1);
  // caché corrupta y de versión antigua
  for (const crudo of ['{no es json', JSON.stringify({ datos: { ...salidaDe('2026-10-01T19'), version: 0 }, hora: '2026-10-01T18:00:00.000Z' })]) {
    const alm = almacenFalso(); alm.setItem('setas:indice', crudo);
    s = mk();
    const o = await cargarIndice({ fetchFn: s.fetchFn, ahora: new Date('2026-10-01T18:30:00Z'), almacen: alm });
    assert.equal(o.salida.sello, '2026-10-01T19');
    assert.equal(o.desdeCache, false);
    assert.equal(s.registro.length, 2);
  }
});

test('cambio de hora de primavera (28/03/2027, CEST desde las 02:00 locales)', () => {
  assert.equal(selloEsperado(new Date('2027-03-28T05:30:00Z')), '2027-03-27T19');   // 07:30 CEST
  assert.equal(selloEsperado(new Date('2027-03-28T05:45:00Z')), '2027-03-28T07');   // 07:45 CEST
  assert.equal(avisoIndice({ sello: '2027-03-27T19' }, new Date('2027-03-28T05:30:00Z')), null);
  assert.match(avisoIndice({ sello: '2027-03-27T19' }, new Date('2027-03-28T05:45:00Z')), /^Datos de ayer a las 19:00\./);
});

test('plazo de descarga: una rejilla que no llega se aborta y se puede reintentar; igual con indice/gruesa', async () => {
  const fuente = { nombre: 'x', url: 'https://x.es', fecha: '2026-10-01' };
  const bytes = await codificarRejilla({ version: 1, zona: 'soria', tam: 250, col0: 1, fila0: 1, ancho: 1, alto: 1, habitats: ['hayedo'], fuentes: { mfe: fuente, mdt: fuente }, generado: '2026-10-01' },
    { habitat: Uint8Array.of(1), terreno: Uint8Array.of(0), altitud: Int16Array.of(1300) });
  let colgar = true, n = 0;
  const fetchFn = (url, o) => { n++; return colgar ? esperaConSenal()(url, o) : Promise.resolve({ ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }); };
  const c = crearCargadorRejillas({ fetchFn, base: 'x/', espera: 20 });
  await assert.rejects(c.cargar('soria.bin'), /abortado/);
  colgar = false;
  assert.equal((await c.cargar('soria.bin')).altitud[0], 1300);
  assert.equal(n, 2);
  await assert.rejects(cargarDatosRejilla({ fetchFn: esperaConSenal(), base: 'x/', espera: 20 }), /abortado/);
});

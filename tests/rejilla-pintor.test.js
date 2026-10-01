// tests/rejilla-pintor.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gruesasDeArchivo, notasDeArchivo, colorear, notaGruesa, colorDeNota, SIN_COLOR, SIN_DATOS, ALFA_GRIS, ALFA_TRAMA } from '../js/rejilla/pintor.js';
import { resumirCelda } from '../js/rejilla/salida.js';
import { PROHIBIDO, FUERA_PROVINCIAS } from '../js/rejilla/formato.js';
import { NIVEL_COLOR as NIVEL_COLOR_MAPA, COLOR as COLOR_MAPA } from '../js/mapa.js';
import { NIVEL_COLOR, COLOR } from '../js/mapa/colores.js';
import { ATRIBUCION_REJILLA, crearCapaRejilla } from '../js/mapa/capa-rejilla.js';
import { crearCalculador } from '../js/rejilla/notas-async.js';
import { CONFIG } from '../scripts/rejilla/config.mjs';
import { HABITATS } from '../scripts/validar-datos.mjs';
import { serieSintetica, BOLETUS, lluviaBuena } from './ayudas.js';

const fuente = { nombre: 'x', url: 'https://x.es', fecha: '2026-10-01' };
const rejilla = { cabecera: { version: 1, zona: 'guadarrama', tam: 250, col0: 78361, fila0: 60161, ancho: 4, alto: 1, habitats: HABITATS, fuentes: { mfe: fuente, mdt: fuente }, generado: '2026-10-01' },
  habitat: Uint8Array.from([HABITATS.indexOf('pinar-silvestre') + 1, PROHIBIDO, 0, HABITATS.indexOf('chopera') + 1]),
  terreno: new Uint8Array(4), altitud: Int16Array.from([1500, 0, 0, 1500]) };
const gruesa = { pasos: { guadarrama: 0.09 }, celdas: [{ id: 'guadarrama:66:65', zona: 'guadarrama', lon: -4.015, lat: 40.895, altRef: 1500, habitats: ['chopera', 'pinar-silvestre'], nFinas: 2 }] };
const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
const fechas = serie.fechas.slice(59, 69);
const salida = { version: 1, sello: '2026-10-18T07', generado: '2026-10-18T05:00:00.000Z', hoy: fechas[0], fechas,
  celdas: { 'guadarrama:66:65': resumirCelda({ altRef: 1500, serie, fechas }) } };
const especies = [{ ...BOLETUS, habitats: ['pinar-silvestre'] }];
const pixel = (rgba, k) => [...rgba.slice(4 * k, 4 * k + 4)];

test('celda gruesa de cada celda fina (solo las que tienen hábitat)', () => {
  assert.deepEqual([...gruesasDeArchivo(rejilla, gruesa)], [0, -1, -1, 0]);
});

test('notas y colores: monte con especie, prohibido, sin monte y hábitat sin especies en temporada', () => {
  const notas = notasDeArchivo({ rejilla, gruesas: gruesasDeArchivo(rejilla, gruesa), gruesa, salida, fecha: fechas[0], especies });
  assert.deepEqual([...notas], [96, SIN_COLOR, SIN_COLOR, SIN_COLOR]);
  const rgba = colorear(notas);
  assert.deepEqual(pixel(rgba, 0), [29, 94, 58, 150]);   // muy bueno, #1d5e3a
  for (const k of [1, 2, 3]) assert.equal(pixel(rgba, k)[3], 0, `celda ${k} sin color`);
});

test('celda gruesa sin datos en el índice: gris, nunca un color inventado', () => {
  const notas = notasDeArchivo({ rejilla, gruesas: gruesasDeArchivo(rejilla, gruesa), gruesa, salida: { ...salida, celdas: {} }, fecha: fechas[0], especies });
  assert.equal(notas[0], SIN_DATOS);
  assert.deepEqual(pixel(colorear(notas), 0), [125, 130, 126, 110]);   // #7d827e
});

test('celda gruesa sin altitud de referencia en el índice: gris, sin suponer la de la celda fina', () => {
  const sinAlt = { ...salida, celdas: { 'guadarrama:66:65': { ...salida.celdas['guadarrama:66:65'], altRef: null } } };
  const notas = notasDeArchivo({ rejilla, gruesas: gruesasDeArchivo(rejilla, gruesa), gruesa, salida: sinAlt, fecha: fechas[0], especies });
  assert.equal(notas[0], SIN_DATOS);
  assert.equal(notaGruesa(gruesa.celdas[0], { salida: sinAlt, fecha: fechas[0], especies }), SIN_DATOS);
});

test('celda fina con hábitat pero fuera de toda celda gruesa: gris', () => {
  const notas = notasDeArchivo({ rejilla, gruesas: Int32Array.from([-1, -1, -1, -1]), gruesa, salida, fecha: fechas[0], especies });
  assert.equal(notas[0], SIN_DATOS);
});

test('el bit de provincia vecina no cambia la nota ni el color (la marca la pone la hoja)', () => {
  const vecina = { ...rejilla, habitat: Uint8Array.from([rejilla.habitat[0] | FUERA_PROVINCIAS, PROHIBIDO, 0, rejilla.habitat[3]]) };
  const notas = notasDeArchivo({ rejilla: vecina, gruesas: gruesasDeArchivo(vecina, gruesa), gruesa, salida, fecha: fechas[0], especies });
  assert.deepEqual([...notas], [96, SIN_COLOR, SIN_COLOR, SIN_COLOR]);
});

test('una celda con la marca de prohibido nunca recibe hábitat ni color, aunque traiga un código', () => {
  const rara = { ...rejilla, habitat: Uint8Array.from([rejilla.habitat[0] | PROHIBIDO, PROHIBIDO, 0, 0]) };
  assert.equal(gruesasDeArchivo(rara, gruesa)[0], -1);
  const notas = notasDeArchivo({ rejilla: rara, gruesas: Int32Array.from([0, 0, 0, 0]), gruesa, salida, fecha: fechas[0], especies });
  assert.equal(notas[0], SIN_COLOR);
  assert.equal(pixel(colorear(notas), 0)[3], 0);
});

test('con chip de otra especie, el pinar no se colorea', () => {
  const notas = notasDeArchivo({ rejilla, gruesas: gruesasDeArchivo(rejilla, gruesa), gruesa, salida, fecha: fechas[0], especies, filtro: new Set(['lactarius-deliciosus']) });
  assert.equal(notas[0], SIN_COLOR);
});

test('vista lejana: una nota por celda gruesa', () => {
  const g = gruesa.celdas[0];
  assert.equal(notaGruesa(g, { salida, fecha: fechas[0], especies }), 96);
  assert.equal(notaGruesa(g, { salida: { ...salida, celdas: {} }, fecha: fechas[0], especies }), SIN_DATOS);
  assert.equal(notaGruesa(g, { salida, fecha: fechas[0], especies: [] }), SIN_COLOR);
  assert.equal(colorDeNota(96), '#1d5e3a');
  assert.equal(colorDeNota(SIN_COLOR), null);
  assert.equal(colorDeNota(SIN_DATOS), '#7d827e');
});

test('los colores del mapa viven en js/mapa/colores.js y js/mapa.js los reexporta', () => {
  assert.equal(NIVEL_COLOR_MAPA, NIVEL_COLOR);
  assert.equal(COLOR_MAPA, COLOR);
});

test('la capa de la rejilla cita el MFE50 y el MDT con el texto de la configuración', () => {
  assert.ok(ATRIBUCION_REJILLA.includes(CONFIG.mfe.atribucion));
  assert.ok(ATRIBUCION_REJILLA.includes(CONFIG.mdt.atribucion));
  assert.ok(ATRIBUCION_REJILLA.includes(`href="${CONFIG.mfe.url}"`));
  assert.ok(ATRIBUCION_REJILLA.includes(`href="${CONFIG.mdt.url}"`));
});

test('el Web Worker carga sin DOM y devuelve las mismas notas que el hilo principal', async () => {
  const enviados = [];
  globalThis.self = { postMessage: (m, transferir) => enviados.push({ m, transferir }) };
  try {
    await import('../js/rejilla/trabajador.js');
    const args = { rejilla, gruesas: gruesasDeArchivo(rejilla, gruesa), gruesa, salida, fecha: fechas[0], especies };
    globalThis.self.onmessage({ data: { id: 7, args } });
    globalThis.self.onmessage({ data: { id: 8, args: { ...args, rejilla: null } } });
    assert.equal(enviados[0].m.id, 7);
    assert.deepEqual([...enviados[0].m.notas], [...notasDeArchivo(args)]);
    assert.deepEqual(enviados[0].transferir, [enviados[0].m.notas.buffer]);
    assert.equal(enviados[1].m.id, 8);
    assert.match(enviados[1].m.error, /./);
  } finally {
    delete globalThis.self;
  }
});

// Worker falso: `fallo` = 'crear' (el constructor lanza), 'onerror', 'onmessageerror', 'calculo' o 'mudo' (no contesta).
function workerFalso(fallo = null) {
  const w = { recibidos: [], terminado: false, postMessage(m) {
    w.recibidos.push(m);
    if (m.fijos) { w.fijos = { ...w.fijos, ...m.fijos }; return; }
    if (m.archivo) { (w.archivos ??= new Map()).set(m.archivo.nombre, { rejilla: m.archivo.rejilla, gruesas: m.archivo.gruesas }); return; }
    queueMicrotask(() => {
      if (fallo === 'onerror') w.onerror({ message: 'módulo no encontrado', preventDefault() {} });
      else if (fallo === 'onmessageerror') w.onmessageerror({});
      else if (fallo === 'calculo') w.onmessage({ data: { id: m.id, error: 'roto' } });
      else if (fallo !== 'mudo') w.onmessage({ data: { id: m.id, notas: notasDeArchivo({ ...w.fijos, ...w.archivos?.get(m.args.archivo), ...m.args }) } });
    });
  }, terminate() { w.terminado = true; } };
  return w;
}
const argsWorker = () => ({ rejilla, gruesas: gruesasDeArchivo(rejilla, gruesa), gruesa, salida, fecha: fechas[0], especies });
const esperadas = () => [...notasDeArchivo(argsWorker())];

test('calcularNotas con Worker: mismas notas, y gruesa y salida se mandan solo una vez', async () => {
  const w = workerFalso();
  const calcular = crearCalculador({ crearWorker: () => w });
  assert.deepEqual([...await calcular(argsWorker())], esperadas());
  assert.deepEqual([...await calcular(argsWorker())], esperadas());
  const fijos = w.recibidos.filter((m) => m.fijos);
  assert.equal(fijos.length, 1);
  assert.ok(w.recibidos.filter((m) => m.args).every((m) => !('gruesa' in m.args) && !('salida' in m.args)));
  const otra = { ...salida };
  await calcular({ ...argsWorker(), salida: otra });
  assert.equal(w.recibidos.filter((m) => m.fijos).length, 2);
  assert.equal(w.recibidos.at(-2).fijos.salida, otra);
  assert.equal('gruesa' in w.recibidos.at(-2).fijos, false);
});

test('calcularNotas con Worker: la rejilla y las gruesas de un archivo se mandan una sola vez', async () => {
  const w = workerFalso(), args = { ...argsWorker(), archivo: 'guadarrama.bin' };
  const calcular = crearCalculador({ crearWorker: () => w });
  assert.deepEqual([...await calcular(args)], esperadas());
  assert.deepEqual([...await calcular({ ...args, fecha: fechas[0] })], esperadas());
  assert.equal(w.recibidos.filter((m) => m.archivo).length, 1);
  assert.ok(w.recibidos.filter((m) => m.args).every((m) => !('rejilla' in m.args) && !('gruesas' in m.args)));
  await calcular({ ...args, gruesas: gruesasDeArchivo(rejilla, gruesa) });   // otras gruesas (objeto nuevo): se vuelven a mandar
  assert.equal(w.recibidos.filter((m) => m.archivo).length, 2);
});

test('el Worker guarda la rejilla de cada archivo y calcula con ella', async () => {
  const enviados = [];
  globalThis.self = { postMessage: (m) => enviados.push(m) };
  try {
    await import('../js/rejilla/trabajador.js?archivo');
    const { rejilla: r, gruesas, ...resto } = argsWorker();
    globalThis.self.onmessage({ data: { fijos: { gruesa: resto.gruesa, salida: resto.salida } } });
    globalThis.self.onmessage({ data: { archivo: { nombre: 'a.bin', rejilla: r, gruesas } } });
    globalThis.self.onmessage({ data: { id: 1, args: { archivo: 'a.bin', fecha: resto.fecha, especies: resto.especies } } });
    assert.deepEqual([...enviados[0].notas], esperadas());
  } finally { delete globalThis.self; }
});

for (const fallo of ['crear', 'onerror', 'onmessageerror', 'calculo', 'mudo']) {
  test(`si el Worker falla (${fallo}), se calcula en el hilo principal y no se vuelve a usar`, async () => {
    let creados = 0;
    const w = workerFalso(fallo);
    const calcular = crearCalculador({ plazo: 30, crearWorker: () => { creados++; if (fallo === 'crear') throw new Error('sin Worker'); return w; } });
    const [a, b] = await Promise.all([calcular(argsWorker()), calcular(argsWorker())]);   // dos pendientes a la vez
    assert.deepEqual([...a], esperadas());
    assert.deepEqual([...b], esperadas());
    const enviados = w.recibidos.length;
    assert.deepEqual([...await calcular(argsWorker())], esperadas());
    assert.equal(creados, 1);
    assert.equal(w.recibidos.length, enviados, 'tras el fallo no se manda nada más al Worker');
    if (fallo !== 'crear') assert.equal(w.terminado, true);
  });
}

test('si el cálculo falla también en el hilo principal, la promesa se rechaza (no queda pendiente)', async () => {
  const calcular = crearCalculador({ crearWorker: () => workerFalso('calculo') });
  await assert.rejects(calcular({ ...argsWorker(), rejilla: null }));
});

test('la capa no rehace el lienzo si la clave de la imagen no cambia, y no captura los toques', () => {
  let lienzos = 0;
  const lienzo = () => ({ style: {}, setAttribute() {}, remove() {}, getContext: () => ({ putImageData() {}, setTransform() {}, clearRect() {}, drawImage() {} }) });
  globalThis.document = { createElement: () => { lienzos++; return lienzo(); } };
  globalThis.ImageData = class {};
  globalThis.window = { devicePixelRatio: 1 };
  const canvas = lienzo();
  const L = { Layer: { extend: (o) => function Capa(op) { Object.assign(this, o); this.initialize(op); } }, setOptions() {},
    DomUtil: { create: () => canvas, setPosition() {} },
    latLngBounds: () => ({ getNorthWest: () => ({}), getSouthEast: () => ({}) }) };
  const mapa = { getPane: () => ({ append() {} }), on() {}, off() {}, getSize: () => ({ x: 10, y: 10 }), containerPointToLayerPoint: () => ({}),
    getBounds: () => ({ intersects: () => true }), latLngToContainerPoint: () => ({ x: 0, y: 0 }) };
  try {
    const capa = new (crearCapaRejilla(L))();
    capa.onAdd(mapa);
    assert.equal(canvas.style.pointerEvents, 'none');
    const cab = rejilla.cabecera, rgba = new Uint8ClampedArray(16);
    capa.ponerImagen('a.bin', cab, rgba, 'a|d1');
    capa.ponerImagen('a.bin', cab, rgba, 'a|d1');
    assert.equal(lienzos, 1);
    assert.equal(capa.tieneImagen('a.bin', 'a|d1'), true);
    capa.ponerImagen('a.bin', cab, rgba, 'a|d2');
    assert.equal(lienzos, 2);
    assert.equal(capa.tieneImagen('a.bin', 'a|d1'), false);
  } finally {
    delete globalThis.document; delete globalThis.ImageData; delete globalThis.window;
  }
});

test('«sin datos» va en damero con el ancho del archivo (no se confunde con «Nulo», liso); las notas, lisas', () => {
  const notas = Uint8Array.from([SIN_DATOS, SIN_DATOS, SIN_DATOS, SIN_DATOS, 0, 0]);   // 3 columnas × 2 filas
  const alfa = (px) => Array.from({ length: notas.length }, (_, k) => px[4 * k + 3]);
  assert.deepEqual(alfa(colorear(notas, 3)), [ALFA_GRIS, ALFA_TRAMA, ALFA_GRIS, ALFA_TRAMA, 150, 150]);
  assert.deepEqual(alfa(colorear(notas)), [ALFA_GRIS, ALFA_GRIS, ALFA_GRIS, ALFA_GRIS, 150, 150]);   // sin ancho, como antes
});

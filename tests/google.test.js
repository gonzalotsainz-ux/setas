import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { nonceNuevo, cargarGis, botonGoogle } from '../js/google.js';

// Documento falso: cada script creado guarda sus oyentes como propiedades (scripts[0].load()).
function docFalso(scripts) {
  return {
    createElement: () => ({ addEventListener(ev, fn) { this[ev] = fn; } }),
    head: { append: (s) => scripts.push(s) },
  };
}

test('nonceNuevo: 32 hex en claro y su SHA-256 en hex', async () => {
  const n = await nonceNuevo();
  assert.match(n.bruto, /^[0-9a-f]{32}$/);
  assert.equal(n.hash, createHash('sha256').update(n.bruto).digest('hex'));
});

test('cargarGis inserta el script una sola vez y resuelve con google.accounts.id', async () => {
  const scripts = [];
  const doc = docFalso(scripts);
  try {
    const p1 = cargarGis({ doc }), p2 = cargarGis({ doc });
    // El script de Google define el global al cargarse, no antes.
    globalThis.google = { accounts: { id: { initialize() {}, renderButton() {} } } };
    scripts[0].load();
    assert.equal(await p1, globalThis.google.accounts.id);
    assert.equal(await p2, await p1);
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, 'https://accounts.google.com/gsi/client');
    assert.equal(scripts[0].async, true);
    assert.equal(scripts[0].defer, true);
  } finally { delete globalThis.google; }
});

test('cargarGis rechaza si el script no carga a tiempo y después vuelve a intentarlo', async () => {
  const scripts = [];
  const doc = docFalso(scripts);
  delete globalThis.google;
  await assert.rejects(cargarGis({ doc, espera: 5 }), { message: 'No se pudo cargar Google' });
  assert.equal(scripts.length, 1);
  await assert.rejects(cargarGis({ doc, espera: 5 }), { message: 'No se pudo cargar Google' });
  assert.equal(scripts.length, 2);
});

test('cargarGis rechaza si el script da error y reintenta después', async () => {
  const scripts = [];
  const doc = docFalso(scripts);
  delete globalThis.google;
  const p = cargarGis({ doc, espera: 1000 });
  scripts[0].error();
  await assert.rejects(p, { message: 'No se pudo cargar Google' });
  const p2 = cargarGis({ doc, espera: 1000 });
  assert.equal(scripts.length, 2);
  globalThis.google = { accounts: { id: {} } };
  try { scripts[1].load(); assert.equal(await p2, globalThis.google.accounts.id); } finally { delete globalThis.google; }
});

test('cargarGis resuelve sin insertar script si Google ya está cargado', async () => {
  const scripts = [];
  globalThis.google = { accounts: { id: { initialize() {} } } };
  try {
    assert.equal(await cargarGis({ doc: docFalso(scripts) }), globalThis.google.accounts.id);
    assert.equal(scripts.length, 0);
  } finally { delete globalThis.google; }
});

test('botonGoogle pasa el hash del nonce a initialize y el contenedor a renderButton', () => {
  const llamadas = {};
  const gis = { initialize: (o) => { llamadas.init = o; }, renderButton: (c, o) => { llamadas.render = [c, o]; } };
  const cont = {};
  botonGoogle(cont, { clientId: 'id-x', nonce: { bruto: 'b', hash: 'h' }, alCredencial: () => {}, gis });
  assert.equal(llamadas.init.client_id, 'id-x');
  assert.equal(llamadas.init.nonce, 'h');
  assert.equal(llamadas.init.ux_mode, 'popup');
  assert.equal(llamadas.init.itp_support, true);
  assert.equal(llamadas.render[0], cont);
  assert.equal(llamadas.render[1].locale, 'es');
  assert.deepEqual(llamadas.render[1], { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'es', width: 280 });
});

test('botonGoogle: el callback entrega solo la credencial', () => {
  const llamadas = {};
  const recibido = [];
  const gis = { initialize: (o) => { llamadas.init = o; }, renderButton() {} };
  botonGoogle({}, { clientId: 'x', nonce: { bruto: 'b', hash: 'h' }, alCredencial: (...a) => recibido.push(a), gis });
  llamadas.init.callback({ credential: 'tok', select_by: 'btn' });
  assert.deepEqual(recibido, [['tok']]);
});

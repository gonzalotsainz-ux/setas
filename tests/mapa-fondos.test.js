// tests/mapa-fondos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FONDOS, FONDO_POR_DEFECTO, SUPERPUESTAS, ACTIVAS_POR_DEFECTO, CARTO_URL, textoAtribucion, leerPreferencias, guardarPreferencias, panelCapas } from '../js/mapa/fondos.js';
import { almacenFalso } from './ayudas.js';

const leerRepo = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8').split(/\r?\n/).join('\n');

test('cuatro fondos; el de por defecto es el mapa claro: sin clave de CARTO, la Base IGN con su atribución', () => {
  assert.deepEqual(Object.keys(FONDOS), ['mapa', 'relieve', 'topografico', 'satelite']);
  assert.equal(FONDO_POR_DEFECTO, 'mapa');
  assert.equal(CARTO_URL, null);
  assert.match(FONDOS.mapa.capas[0].url, /ign\.es\/wmts\/ign-base\?.*layer=IGNBaseTodo/);
  assert.equal(textoAtribucion(FONDOS.mapa), '© Instituto Geográfico Nacional CC BY 4.0');
});

test('relieve = fondo claro + relieve del IDEE en multiply; topográfico MTN y satélite PNOA del IGN', () => {
  assert.equal(FONDOS.relieve.capas.length, 2);
  assert.equal(FONDOS.relieve.capas[0].url, FONDOS.mapa.capas[0].url);
  assert.match(FONDOS.relieve.capas[1].url, /servicios\.idee\.es\/wmts\/mdt\?.*layer=Relieve/);
  assert.equal(FONDOS.relieve.capas[1].opciones.className, 'capa-multiply');
  assert.equal(FONDOS.relieve.capas[1].opciones.maxNativeZoom, 16);
  assert.match(textoAtribucion(FONDOS.relieve), /Relieve IDEE/);
  assert.match(FONDOS.topografico.capas[0].url, /ign\.es\/wmts\/mapa-raster\?.*layer=MTN/);
  assert.match(FONDOS.satelite.capas[0].url, /ign\.es\/wmts\/pnoa-ma\?.*layer=OI\.OrthoimageCoverage/);
  for (const f of Object.values(FONDOS)) for (const c of f.capas) assert.ok(c.opciones.attribution, f.nombre);
});

test('capas superpuestas', () => {
  assert.deepEqual(Object.values(SUPERPUESTAS), ['Cotos', 'Prohibido', 'Lluvia', 'Sitios', 'Diario']);
  assert.deepEqual(ACTIVAS_POR_DEFECTO, ['prohibido', 'sitios']);
});

test('preferencias: por defecto, ida y vuelta, valores raros fuera y almacén roto', () => {
  const a = almacenFalso();
  assert.deepEqual(leerPreferencias(a), { fondo: 'mapa', activas: ['prohibido', 'sitios'] });
  guardarPreferencias({ fondo: 'satelite', activas: ['lluvia'] }, a);
  assert.deepEqual(leerPreferencias(a), { fondo: 'satelite', activas: ['lluvia'] });
  guardarPreferencias({ fondo: 'marte', activas: ['lluvia', 'ovnis'] }, a);
  assert.deepEqual(leerPreferencias(a), { fondo: 'mapa', activas: ['lluvia'] });
  const roto = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.deepEqual(leerPreferencias(roto), { fondo: 'mapa', activas: ['prohibido', 'sitios'] });
  assert.doesNotThrow(() => guardarPreferencias({ fondo: 'mapa', activas: [] }, roto));
  assert.deepEqual(leerPreferencias(null), { fondo: 'mapa', activas: ['prohibido', 'sitios'] });
});

// DOM mínimo con eventos, suficiente para js/ui/dom.js y panelCapas.
const nodo = (tag) => ({ tag, hijos: [], attrs: {}, style: {}, className: '', textContent: '', oyentes: {},
  setAttribute(k, v) { this.attrs[k] = v; }, append(...h) { this.hijos.push(...h); },
  addEventListener(t, f) { (this.oyentes[t] ??= []).push(f); },
  emitir(t, ev = {}) { for (const f of this.oyentes[t] ?? []) f(ev); } });
const todos = (n) => (typeof n === 'string' ? [] : [n, ...n.hijos.flatMap(todos)]);
const conDom = (f) => { globalThis.document = { createElement: nodo, createElementNS: nodo }; try { f(); } finally { delete globalThis.document; } };

test('panel de capas: un radio por fondo, una casilla por capa, leyenda de manchas y avisos de cambio', () => conDom(() => {
  const cambios = [];
  const p = panelCapas({ fondo: 'relieve', activas: ['lluvia'], alCambiar: (c) => cambios.push(c) });
  assert.equal(p.attrs.role, 'dialog');
  assert.equal(p.attrs['aria-label'], 'Capas del mapa');
  const radios = todos(p).filter((n) => n.type === 'radio'), casillas = todos(p).filter((n) => n.type === 'checkbox');
  assert.deepEqual(radios.map((r) => r.value), Object.keys(FONDOS));
  assert.deepEqual(radios.filter((r) => r.checked).map((r) => r.value), ['relieve']);
  assert.deepEqual(casillas.filter((c) => c.checked).map((c) => c.value), ['lluvia']);
  assert.ok(todos(p).some((n) => n.textContent === 'Sin datos suficientes'));
  radios[2].emitir('change');
  casillas[0].checked = true; casillas[0].emitir('change');
  assert.deepEqual(cambios, [{ fondo: 'topografico' }, { capa: 'cotos', activa: true }]);
}));

test('panel de capas: Escape lo cierra (alCerrar) y solo Escape', () => conDom(() => {
  let cerrado = 0, previnido = 0;
  const p = panelCapas({ fondo: 'mapa', activas: [], alCambiar() {}, alCerrar: () => { cerrado++; } });
  p.emitir('keydown', { key: 'Enter', preventDefault() { previnido++; } });
  assert.equal(cerrado, 0);
  p.emitir('keydown', { key: 'Escape', preventDefault() { previnido++; } });
  assert.equal(cerrado, 1);
  assert.equal(previnido, 1);
  assert.doesNotThrow(() => panelCapas({ fondo: 'mapa', activas: [], alCambiar() {} }).emitir('keydown', { key: 'Escape', preventDefault() {} }));
}));

test('panel de capas: botón Cerrar propio que llama a alCerrar', () => conDom(() => {
  let cerrado = 0;
  const p = panelCapas({ fondo: 'mapa', activas: [], alCambiar() {}, alCerrar: () => { cerrado++; } });
  const b = todos(p).find((n) => n.tag === 'button');
  assert.equal(b.textContent, 'Cerrar');
  assert.equal(b.type, 'button');
  b.emitir('click');
  assert.equal(cerrado, 1);
}));

test('js/mapa.js y fondos.js comparten las capas del IGN (una sola copia)', async () => {
  const { BASES } = await import('../js/mapa.js');
  assert.equal(BASES['Topográfico IGN'][0], FONDOS.topografico.capas[0].url);
  assert.equal(BASES['Ortofoto PNOA'][0], FONDOS.satelite.capas[0].url);
  assert.equal(BASES['Ortofoto PNOA'][1], FONDOS.satelite.capas[0].opciones.attribution);
  for (const f of ['../js/mapa.js', '../js/mapa/fondos.js']) assert.ok(!/const (WMTS|ATR_IGN|IGN) =/.test(leerRepo(f)), f);
});

test('estilos: opciones del panel de 44 px, multiply del relieve, sin animación propia; foco visible y reduced-motion globales', () => {
  const css = leerRepo('../css/componentes.css');
  const regla = (sel) => css.match(new RegExp(`^${sel.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
  assert.match(regla('.mapa-panel__opcion'), /min-height:\s*44px/);
  assert.match(css, /\.boton--compacto\s*\{[^}]*min-height:\s*44px/);
  assert.match(regla('.capa-multiply'), /mix-blend-mode:\s*multiply/);
  const bloque = css.slice(css.indexOf('/* ---------- Panel de capas'), css.indexOf('/* ---------- Especies y seguridad'));
  assert.ok(bloque.length > 100);
  assert.doesNotMatch(bloque, /(animation|transition)\s*:/);
  const base = leerRepo('../css/base.css');
  assert.match(base, /:focus-visible\s*\{[^}]*outline:\s*3px/);
  assert.match(base, /prefers-reduced-motion:\s*reduce/);
});

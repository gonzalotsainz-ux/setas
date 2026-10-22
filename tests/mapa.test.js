import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estiloCoto, estiloHalo, radioLluvia, lluvia26, COLOR, ESTILO_COTO } from '../js/mapa.js';
import { readFileSync } from 'node:fs';
import { serieSintetica, lluviaBuena } from './ayudas.js';

test('estiloCoto: color fijo por tipo y trazo según la precisión', () => {
  assert.equal(estiloCoto({ tipo: 'prohibido', precision: 'oficial' }).color, COLOR.peligro);
  assert.equal(estiloCoto({ tipo: 'prohibido', precision: 'oficial' }).dashArray, undefined);
  assert.equal(estiloCoto({ tipo: 'acotado', precision: 'derivado' }).dashArray, '6 4');
  assert.equal(estiloCoto({ tipo: 'acotado', precision: 'aproximado' }).dashArray, '2 6');
  assert.equal(estiloCoto({ tipo: 'desconocido', precision: 'oficial' }).color, ESTILO_COTO.regulado.color);
  assert.doesNotMatch(estiloCoto({ tipo: 'acotado', precision: 'oficial' }).color, /var\(/);
});

test('estiloHalo: blanco, más ancho que el trazo, sin relleno ni punteado', () => {
  const h = estiloHalo({ tipo: 'acotado', precision: 'derivado' });
  assert.equal(h.color, '#ffffff');
  assert.equal(h.weight, ESTILO_COTO.acotado.weight + 3);
  assert.equal(h.fill, false);
  assert.equal(h.dashArray, undefined);
});

test('radioLluvia: siempre fuera del marcador de 9 px y creciente', () => {
  assert.ok(radioLluvia(0) > 9);
  assert.equal(radioLluvia(100), 37);
  assert.ok(radioLluvia(50) > radioLluvia(10));
});

test('lluvia26: suma de los 26 días hasta hoy; sin serie o con un día sin dato, null', () => {
  assert.equal(lluvia26(null), null);
  assert.equal(lluvia26(serieSintetica({ precip: lluviaBuena })), 106);
  const serie = serieSintetica();
  serie.precip[50] = null;
  assert.equal(lluvia26(serie), null);
});

test('js/mapa.js ya no pinta rectángulos de zona ni el modo de puntos', async () => {
  const m = await import('../js/mapa.js');
  assert.equal(m.estiloPunto, undefined);
  assert.equal(m.notaPunto, undefined);
  assert.doesNotMatch(readFileSync('js/mapa.js', 'utf8'), /L\.rectangle/);
});

import { avisoOtroDia } from '../js/mapa.js';
test('avisoOtroDia: «Datos del …» solo si la meteo guardada es de otro día', () => {
  const s = { a: {} };
  assert.equal(avisoOtroDia({ hoy: '2026-10-01', series: s }, '2026-10-01'), null);
  assert.match(avisoOtroDia({ hoy: '2026-09-30', series: s }, '2026-10-01'), /^Datos del 30 de septiembre\./);
  assert.equal(avisoOtroDia({ hoy: '2026-09-30', series: null }, '2026-10-01'), null);   // sin datos ya se avisa aparte
  assert.equal(avisoOtroDia(null, '2026-10-01'), null);
});

import { cargarCotos, popupCoto } from '../js/mapa.js';
test('el mapa nuevo reutiliza la carga de cotos y su ficha', () => {
  assert.equal(typeof cargarCotos, 'function');
  assert.equal(typeof popupCoto, 'function');
});

import { CONFIG } from '../scripts/rejilla/config.mjs';
test('créditos de Ajustes: MFE50 con su actualización, MDT25 y pueblos del NGBE, con los textos de CONFIG', () => {
  const src = readFileSync('js/pantallas/ajustes.js', 'utf8');
  for (const t of [CONFIG.mfe.atribucion, CONFIG.mfe.url, CONFIG.mdt.atribucion, CONFIG.mdt.nombre, CONFIG.mdt.url, CONFIG.pueblos.nombre, CONFIG.pueblos.url, CONFIG.pueblos.licencia, CONFIG.geocodificador.nombre, CONFIG.geocodificador.url, CONFIG.geocodificador.licencia]) {
    assert.ok(src.includes(t), t);
  }
  assert.match(src, /entre 1997 y 2006 \(archivos de 2013\)/);
  assert.doesNotMatch(src, /NGMEP|CARTO/);   // pueblos del NGBE; CARTO no se usa mientras CARTO_URL sea null
});

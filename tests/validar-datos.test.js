import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar, licenciaPermitida } from '../scripts/validar-datos.mjs';

const zona = () => ({ id: 'soria', nombre: 'Soria', comunidad: 'castilla-y-leon', provincias: ['Soria'],
  bbox: [-3.2, 41.6, -2.2, 42.1], habitats: ['pinar-silvestre'],
  puntos: [{ id: 'p1', nombre: 'P', lat: 41.8, lon: -2.7, altitud: 1200, habitat: 'pinar-silvestre',
             fuente: 'https://x.es', revisado: '2026-09-30' }],
  estacionesAemet: [], normas: ['n1'], avisos: [], fuentes: [{ url: 'https://x.es', titulo: 't', consultado: '2026-09-30' }] });
const norma = () => ({ id: 'n1', titulo: 'N', tipo: 'decreto', ambito: { comunidad: 'castilla-y-leon', zonas: ['soria'] },
  url: 'https://x.es', vigente: true, resumen: [], permiso: null, prohibiciones: [], revisado: '2026-09-30', verificado: true });
const especie = () => ({ id: 'boletus-edulis', nombre: 'Boletus edulis', categoria: 'comestible', rd30_2009: 'A',
  habitats: ['pinar-silvestre'], zonas: { soria: { presencia: 'orientativa', fuente: 'F7' } },
  temporada: { meses: [9, 10, 11], tipo: 'otono' }, identificacion: ['x'], confusiones: [],
  indice: { topt: 13, trango: [10, 15], usarSuelo: false, pmin: 30, pfull: 90, desfase: [7, 21], helada: 'baja',
            confianza: 'alta', base: 'evidencia', fuente: 'x' },
  fotos: [], fuentes: [{ id: 'F2', url: 'https://x.es', consultado: '2026-09-30' }] });
const base = () => ({ zonas: { zonas: [zona()] }, especies: { especies: [especie()], sindromes: [] },
  normativa: { normas: [norma()] }, cotos: { type: 'FeatureCollection', features: [] }, existe: () => true });

test('datos válidos → sin errores', () => { assert.deepEqual(validar(base()), []); });

test('especie sin fuentes → error', () => {
  const d = base(); d.especies.especies[0].fuentes = [];
  assert.match(validar(d).join('\n'), /boletus-edulis.*fuente/);
});

test('confusión que apunta a ficha inexistente → error', () => {
  const d = base(); d.especies.especies[0].confusiones = [{ especie: 'amanita-inventada', riesgo: 'mortal', diferencias: 'x' }];
  assert.match(validar(d).join('\n'), /amanita-inventada/);
});

test('comestible sin índice ni motivo → error; con sinIndice → válido', () => {
  const d = base(); d.especies.especies[0].indice = null;
  assert.match(validar(d).join('\n'), /índice/);
  d.especies.especies[0].sinIndice = 'Hipogeo: se busca con perro';
  assert.deepEqual(validar(d), []);
});

test('foto con licencia NC → error', () => {
  const d = base(); d.especies.especies[0].fotos = [{ archivo: 'img/x.webp', autor: 'a', licencia: 'CC BY-NC 4.0', url: 'https://x' }];
  assert.match(validar(d).join('\n'), /licencia/);
});

test('zona de especie inexistente → error', () => {
  const d = base(); d.especies.especies[0].zonas.marte = { presencia: 'confirmada', fuente: 'x' };
  assert.match(validar(d).join('\n'), /marte/);
});

test('punto con fecha mal formada → error', () => {
  const d = base(); d.zonas.zonas[0].puntos[0].revisado = '30/09/2026';
  assert.match(validar(d).join('\n'), /revisado/);
});

test('coto con precisión desconocida → error', () => {
  const d = base(); d.cotos.features = [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] },
    properties: { id: 'c1', nombre: 'C', tipo: 'acotado', precision: 'a ojo', zona: 'soria', normas: ['n1'], fuente: 'https://x', revisado: '2026-09-30' } }];
  assert.match(validar(d).join('\n'), /precision/);
});

test('licencias', () => {
  for (const ok of ['CC0', 'CC0 1.0', 'PD', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC BY']) assert.ok(licenciaPermitida(ok), ok);
  for (const no of ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'All rights reserved', '']) assert.ok(!licenciaPermitida(no), no);
});

// tests/pluvio-textos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textoOrigenLluvia, textoOrigenPunto, origenDeCelda, listaEstaciones } from '../js/ui/origen-lluvia.js';
import { graficoLluvia, esMedida } from '../js/ui/grafico-lluvia.js';
import { modeloHoja } from '../js/mapa/hoja.js';
import { aplicarPluvio } from '../js/pluvio.js';
import { VERSION_PLUVIO } from '../supabase/functions/_shared/pluvio.js';
import { validarSalida } from '../supabase/functions/_shared/salida-indice.js';
import { entreDias } from '../js/meteo.js';
import { serieSintetica, lluviaBuena } from './ayudas.js';

const LARGO = entreDias('2026-08-01', '2026-09-30') + 1;
const celda = { habitat: 'pinar-silvestre', altitud: 1560, orientacion: 0, tramo: 1, lat: 40.853, lon: -3.9943 };
const NB = ' ';
const est = (nombre, km) => ({ nombre, km });

test('lista de estaciones: siempre con la distancia si se conoce, y «y N más» pasadas tres', () => {
  assert.equal(listaEstaciones(['Covaleda']), 'Covaleda');
  assert.equal(listaEstaciones([est('Casillas', 19.6)]), `Casillas, a 19,6${NB}km`);
  assert.equal(listaEstaciones([est('Covaleda', 2), est('Duruelo', 5)]), `Covaleda 2${NB}km y Duruelo 5${NB}km`);
  assert.equal(listaEstaciones([est('Covaleda', 2), est('Duruelo', 5), est('Quintanar', 9.04)]), `Covaleda 2${NB}km, Duruelo 5${NB}km y Quintanar 9${NB}km`);
  assert.equal(listaEstaciones([est('A', 1), est('B', 2), est('C', 3), est('D', 4), est('E', 5)]), `A 1${NB}km, B 2${NB}km, C 3${NB}km y 2 más`);
});

test('texto del origen: cuántas estaciones y a qué distancia, o estimada con el modelo', () => {
  assert.equal(textoOrigenLluvia({ estaciones: [est('Casillas', 19.6)], medidos: 26, total: 26 }), `Lluvia medida en 1 estación (Casillas, a 19,6${NB}km)`);
  assert.equal(textoOrigenLluvia({ estaciones: [est('Covaleda', 2), est('Duruelo', 5), est('Quintanar', 9)], medidos: 26, total: 26 }),
    `Lluvia medida en 3 estaciones (Covaleda 2${NB}km, Duruelo 5${NB}km y Quintanar 9${NB}km)`);
  // Dos estaciones a menos de 1,5 km son un solo «sitio» en la mezcla, pero se dicen como lo que son: dos estaciones.
  assert.equal(textoOrigenLluvia({ estaciones: [est('Cercedilla', 0.7), est('Cercedilla II', 1.2)], medidos: 26, total: 26 }),
    `Lluvia medida en 2 estaciones (Cercedilla 0,7${NB}km y Cercedilla II 1,2${NB}km)`);
  assert.equal(textoOrigenLluvia({ estaciones: [est('Covaleda', 2)], medidos: 25, total: 26 }), `Lluvia medida en 1 estación (Covaleda, a 2${NB}km): 25 de 26 días medidos; el resto, estimado con el modelo`);
  assert.equal(textoOrigenLluvia({ estaciones: [est('Covaleda', 2)], medidos: 20, aemet: 3, total: 26, factor: 0.8 }),
    `Lluvia medida en 1 estación (Covaleda, a 2${NB}km): 20 de 26 días medidos y 3 con una estación AEMET; el resto, estimado con el modelo (corregido ×0,8 con las estaciones de la zona)`);
  assert.equal(textoOrigenLluvia({ estaciones: [], medidos: 0, total: 26 }), 'Lluvia estimada con el modelo (sin estación cercana)');
  assert.equal(textoOrigenLluvia({ estaciones: [], medidos: 0, total: 26, factor: 0.8 }), 'Lluvia estimada con el modelo (sin estación cercana), corregida ×0,8 con las estaciones de la zona');
  // Hay estaciones cerca, pero todas descartadas; o con estación en la lista pero sin ningún día medido en la ventana.
  assert.equal(textoOrigenLluvia({ estaciones: [], medidos: 0, total: 26, cercanas: 2 }), 'Lluvia estimada con el modelo (las estaciones cercanas no tienen datos válidos)');
  assert.equal(textoOrigenLluvia({ estaciones: [est('Covaleda', 2)], medidos: 0, total: 26 }), 'Lluvia estimada con el modelo (sin estación cercana)');
  // Lista truncada a las más cercanas (el índice del mapa guarda tres): no se dice «3 estaciones».
  assert.equal(textoOrigenLluvia({ estaciones: [est('A', 1), est('B', 2), est('C', 3)], medidos: 26, total: 26, truncada: true }),
    `Lluvia medida en estaciones cercanas, las más próximas (A 1${NB}km, B 2${NB}km y C 3${NB}km)`);
});

test('texto de un punto de Zona a partir de aplicarPluvio', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena });
  const lugar = { mm: Array(LARGO).fill(0), n: Array(LARGO).fill(1), estaciones: [{ nombre: 'Casillas', fuente: 'duero', km: 19.6 }], cercanas: 1 };
  const m = aplicarPluvio([{ id: 'z', puntos: [{ id: 'a' }, { id: 'b' }] }], { hoy: s.fechas[59], series: { a: s, b: s } },
    { version: VERSION_PLUVIO, generado: 'x', desde: '2026-08-01', hasta: '2026-09-30', lugares: { a: lugar } });
  assert.equal(textoOrigenPunto(m.series.a, m.pluvio.porPunto.a), `Lluvia medida en 1 estación (Casillas, a 19,6${NB}km): 25 de 26 días medidos; el resto, estimado con el modelo`);
  // Con una sola estación en la zona no hay factor de sesgo (hacen falta 2): el punto sin estación, modelo a secas.
  assert.equal(m.pluvio.porPunto.b.factor, 1);
  assert.equal(textoOrigenPunto(m.series.b, m.pluvio.porPunto.b), 'Lluvia estimada con el modelo (sin estación cercana)');
});

test('punto con días de AEMET y ninguno de pluviómetros: el texto de Zona es el de AEMET (null aquí)', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena });
  const base = s.origenPrecip ?? s.fechas.map(() => 'modelo');
  const aemet = { ...s, origenPrecip: base.map((o, k) => (k > s.hoy - 10 && k <= s.hoy ? 'estacion:3104Y' : o)) };
  assert.equal(textoOrigenPunto(aemet, { estaciones: [], cercanas: 0, factor: 1 }), null);
  // Con días de los dos orígenes se dicen los dos, sin atribuir a AEMET lo que midieron los pluviómetros.
  const mixta = { ...aemet, origenPrecip: aemet.origenPrecip.map((o, k) => (k > s.hoy - 20 && k <= s.hoy - 10 ? 'medida' : o)) };
  assert.match(textoOrigenPunto(mixta, { estaciones: [est('Covaleda', 2)], cercanas: 1, factor: 1 }), /10 de 26 días medidos y 10 con una estación AEMET; el resto, estimado con el modelo$/);
});

test('origen de una celda del índice; un índice sin pluviómetros no da texto', () => {
  const lluvia = { desde: '2026-08-03', hoy: 59, mm: Array(60).fill(0), origen: [...Array(59).fill(1), 0], estaciones: ['Covaleda'], cercanas: 1 };
  assert.deepEqual(origenDeCelda({ lluvia }), { estaciones: ['Covaleda'], medidos: 25, total: 26, cercanas: 1, truncada: false });
  // Con las distancias (lluvia.km) el texto dice a cuántos km está cada una; con tres nombres y más cerca, es la lista truncada.
  const con = origenDeCelda({ lluvia: { ...lluvia, estaciones: ['A', 'B', 'C'], km: [1, 2, 3], cercanas: 5 } });
  assert.deepEqual(con.estaciones, [est('A', 1), est('B', 2), est('C', 3)]);
  assert.equal(con.truncada, true);
  assert.equal(origenDeCelda({ lluvia: { desde: '2026-08-03', hoy: 59, mm: Array(60).fill(0) } }), null);
});

test('el índice valida `km`: mismos elementos que `estaciones`, números', () => {
  const salida = (l) => ({ version: 1, sello: '2026-09-30T07', fechas: ['2026-09-30'], hoy: '2026-09-30', celdas: { c: { altRef: 1000, dias: [null], lluvia: { desde: '2026-09-29', hoy: 1, mm: [1, 2, 3], ...l } } } });
  assert.deepEqual(validarSalida(salida({ origen: [1, 2, 0], estaciones: ['A'], km: [3.4], cercanas: 1 })), []);
  assert.deepEqual(validarSalida(salida({ estaciones: ['A'], km: [3.4, 5] })), ['celda c mal formada']);
  assert.deepEqual(validarSalida(salida({ estaciones: ['A'], km: ['x'] })), ['celda c mal formada']);
});

test('hoja del mapa: el texto del origen de la lluvia, solo si el índice lo trae', () => {
  const nota = { sinEspecies: false, valor: 70, especie: { id: 'x', nombre: 'X', comunes: { es: ['equis'] } }, resultado: {}, otras: [], faltan: [] };
  const con = modeloHoja({ celda, nota, ag: { P26: 40, pct: 50, T20aire: 12 }, lluvia: { estaciones: [est('Casillas', 19.6)], medidos: 26, total: 26, cercanas: 1 } });
  assert.equal(con.origenLluvia, `Lluvia medida en 1 estación (Casillas, a 19,6${NB}km)`);
  assert.equal(modeloHoja({ celda, nota, ag: { P26: 40, pct: 50, T20aire: 12 } }).origenLluvia, null);
});

test('gráfica: los días medidos (pluviómetros o AEMET) se distinguen de los del modelo', () => {
  assert.equal(esMedida('medida'), true);
  assert.equal(esMedida('estacion:3104Y'), true);
  assert.equal(esMedida('estimada'), false);
  assert.equal(esMedida(undefined), false);
  const s = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
  s.origenPrecip = s.fechas.map((_, k) => (k < 20 ? 'medida' : k < 30 ? 'estacion:3104Y' : 'modelo'));
  const svg = graficoLluvia({ serie: s });
  assert.equal((svg.match(/class="barra barra-medida"/g) ?? []).length, 30);
  assert.equal((svg.match(/class="barra barra-pasada"/g) ?? []).length, 30);
  assert.equal((svg.match(/<rect class="barra/g) ?? []).length, 70);
  assert.match(svg, /\(medida\)<\/title>/);
  // Sin color: el texto alternativo de la gráfica cuenta los días medidos y dice cómo se reconocen.
  assert.match(svg, /Las barras con contorno son 30 días medidos en estaciones/);
  assert.doesNotMatch(graficoLluvia({ serie: serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena }) }), /barras con contorno/);
});

test('los colores de lo medido salen de tokens (claro y los dos oscuros)', () => {
  const tokens = readFileSync('css/tokens.css', 'utf8');
  assert.equal((tokens.match(/--c-lluvia-medida:/g) ?? []).length, 3);
  const css = readFileSync('css/componentes.css', 'utf8');
  assert.match(css, /\.grafico \.barra-medida \{ fill: var\(--c-lluvia-medida\); \}/);
  assert.match(css, /\.muestra--medida \{ background: var\(--c-lluvia-medida\);/);
});

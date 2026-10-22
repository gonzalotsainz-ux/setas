// tests/pluvio-textos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textoOrigenLluvia, partesOrigenLluvia, textoOrigenPunto, origenDeCelda, listaEstaciones, nombreCorto } from '../js/ui/origen-lluvia.js';
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

test('lista de estaciones: con la distancia, «y N más» pasado el máximo y nombres cortos', () => {
  assert.equal(listaEstaciones(['Covaleda']), 'Covaleda');
  assert.equal(listaEstaciones([est('Casillas', 19.6)]), `Casillas, a 19,6${NB}km`);
  assert.equal(listaEstaciones([est('Casillas', 19.6)], { aprox: true }), `Casillas, a ~19,6${NB}km`);
  assert.equal(listaEstaciones([est('Covaleda', 2), est('Duruelo', 5)]), `Covaleda 2${NB}km y Duruelo 5${NB}km`);
  assert.equal(listaEstaciones([est('A', 1), est('B', 2), est('C', 3), est('D', 4), est('E', 5)], { muestra: 2, restoTexto: 'más desde agosto' }), `A 1${NB}km, B 2${NB}km y 3 más desde agosto`);
  assert.equal(listaEstaciones([est('Casas de la Garganta - Cruz Roja', 1)], { corto: true }), `Casas de la Garganta, a 1${NB}km`);
  assert.equal(nombreCorto('Cerro Hornillo – Cercedilla'), 'Cerro Hornillo');
  assert.equal(nombreCorto('Ciudad Encantada'), 'Ciudad Encantada');
});

test('texto del origen (Zona, con estaciones por día): honesto con cuántas midieron de verdad', () => {
  const una = partesOrigenLluvia({ estaciones: [est('Casillas', 19.6)], medidos: 26, total: 26, porDia: { min: 1, max: 1 } });
  assert.equal(una.principal, `Lluvia medida con 1 estación (Casillas, a 19,6${NB}km)`);
  assert.equal(una.detalle, '');
  const varias = partesOrigenLluvia({ estaciones: [est('A', 1), est('B', 6.7), est('C', 9), est('D', 12), est('E', 13), est('F', 14)], medidos: 9, total: 26, porDia: { min: 1, max: 3 }, muestra: 2 });
  assert.equal(varias.principal, `Lluvia medida: entre 1 y 3 estaciones por día (A 1${NB}km, B 6,7${NB}km y 4 más)`);
  assert.equal(varias.detalle, '9 de 26 días medidos; el resto, modelo');
  assert.equal(varias.corto, 'Medida en estaciones');
  assert.ok(!/6 estaciones/.test(varias.principal));
  assert.equal(partesOrigenLluvia({ estaciones: [est('A', 1), est('B', 2), est('C', 3), est('D', 4)], medidos: 26, total: 26, porDia: { min: 4, max: 4 }, muestra: 2 }).principal,
    `Lluvia medida: 4 estaciones por día (A 1${NB}km, B 2${NB}km y 2 más)`);
  assert.equal(partesOrigenLluvia({ estaciones: [est('A', 1), est('B', 2)], medidos: 26, total: 26, porDia: { min: 2, max: 2 } }).principal,
    `Lluvia medida: 2 estaciones por día (A 1${NB}km y B 2${NB}km)`);
  assert.equal(partesOrigenLluvia({ estaciones: [est('La Cierva', 12.6)], medidos: 25, total: 26, factor: 1.5, porDia: { min: 1, max: 1 } }).detalle, '25 de 26 días medidos; el resto, modelo ×1,5');
});

test('texto del origen: días de AEMET con el nombre y la distancia de su estación; y estimada con el modelo', () => {
  const con = partesOrigenLluvia({ estaciones: [est('Covaleda', 2)], medidos: 10, aemet: 3, aemetEstacion: { nombre: 'San Roque', km: 22 }, total: 26, porDia: { min: 1, max: 1 } });
  assert.equal(con.detalle, `10 de 26 días medidos, 3 con AEMET (San Roque, a 22${NB}km, estación lejana); el resto, modelo`);
  assert.equal(partesOrigenLluvia({ estaciones: [est('Covaleda', 2)], medidos: 10, aemet: 3, aemetEstacion: { nombre: 'Rascafría', km: 8.2 }, total: 26 }).detalle,
    `10 de 26 días medidos, 3 con AEMET (Rascafría, a 8,2${NB}km); el resto, modelo`);
  assert.equal(partesOrigenLluvia({ estaciones: [], medidos: 0, total: 26 }).principal, 'Lluvia estimada con el modelo (sin estación cercana)');
  assert.equal(partesOrigenLluvia({ estaciones: [], medidos: 0, total: 26, factor: 0.8 }).detalle, 'Corregida ×0,8 con las estaciones de la zona');
  assert.equal(partesOrigenLluvia({ estaciones: [], medidos: 0, total: 26, cercanas: 2 }).principal, 'Lluvia estimada con el modelo (las estaciones cercanas no tienen datos válidos)');
  // Estación en la lista (midió en agosto) pero ningún día de los últimos 26.
  assert.equal(partesOrigenLluvia({ estaciones: [est('Covaleda', 2)], medidos: 0, total: 26 }).principal, 'Lluvia estimada con el modelo (sin datos de estaciones en los últimos 26 días)');
});

test('texto de la hoja del mapa (sin dato por día): estaciones próximas, con «a ~X km»', () => {
  assert.equal(textoOrigenLluvia({ estaciones: [est('Casillas', 19.6)], medidos: 26, total: 26, aprox: true }), `Lluvia medida en 1 estación próxima (Casillas, a ~19,6${NB}km)`);
  // El índice guarda tres nombres; `otras`: cuántas más aportaron en los 26 días.
  assert.equal(textoOrigenLluvia({ estaciones: [est('A', 1), est('B', 2), est('C', 3)], otras: 2, medidos: 19, total: 26, aprox: true }),
    `Lluvia medida en estaciones próximas: A a ~1${NB}km, B a ~2${NB}km, C a ~3${NB}km y 2 más. 19 de 26 días medidos; el resto, modelo`);
  assert.equal(textoOrigenLluvia({ estaciones: [est('A', 1)], otras: 1, medidos: 19, total: 26, aprox: true }),
    `Lluvia medida en estaciones próximas: A a ~1${NB}km y 1 más. 19 de 26 días medidos; el resto, modelo`);
  // Días medidos sin saber qué estaciones (archivo anterior): se dice que se midió, sin nombrar ninguna.
  assert.equal(textoOrigenLluvia({ estaciones: [], medidos: 19, total: 26, cercanas: 4, aprox: true }),
    'Lluvia medida en estaciones próximas. 19 de 26 días medidos; el resto, modelo');
  assert.equal(textoOrigenLluvia({ estaciones: [], medidos: 0, total: 26 }), 'Lluvia estimada con el modelo (sin estación cercana)');
});

test('texto de un punto de Zona a partir de aplicarPluvio', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena });
  const lugar = { mm: Array(LARGO).fill(0), n: Array(LARGO).fill(1), estaciones: [{ nombre: 'Casillas - Alto', fuente: 'duero', km: 19.6, ultimo: '2026-09-30' }], cercanas: 1 };
  const m = aplicarPluvio([{ id: 'z', puntos: [{ id: 'a' }, { id: 'b' }] }], { hoy: s.fechas[59], series: { a: s, b: s } },
    { version: VERSION_PLUVIO, generado: 'x', desde: '2026-08-01', hasta: '2026-09-30', lugares: { a: lugar } });
  const a = textoOrigenPunto(m.series.a, m.pluvio.porPunto.a);
  assert.equal(a.principal, `Lluvia medida con 1 estación (Casillas, a 19,6${NB}km)`);
  assert.equal(a.detalle, '25 de 26 días medidos; el resto, modelo');
  // Con una sola estación en la zona no hay factor de sesgo (hacen falta 2): el punto sin estación, modelo a secas.
  assert.equal(m.pluvio.porPunto.b.factor, 1);
  assert.equal(textoOrigenPunto(m.series.b, m.pluvio.porPunto.b).principal, 'Lluvia estimada con el modelo (sin estación cercana)');
});

// Revisión final 2, caso real (alava-izki-marojal, 02/10/2026): el archivo lista las 11 estaciones que aportaron desde
// agosto, pero los 25 días medidos de los últimos 26 salen de Campezo (12,2 km) y Agurain (19,7 km). Antes: «Navarrete
// 5,5 km, Kapildui 10,2 km y 9 más desde agosto».
test('Zona nombra solo las estaciones que aportaron en la ventana de 26 días, por cercanía y con su distancia', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena });   // hoy = 01/10; la ventana, del 06/09 al 01/10
  const e = (nombre, km, ultimo) => ({ nombre, fuente: 'euskalmet', km, ultimo });
  const estaciones = [e('Navarrete', 5.5, '2026-08-20'), e('Kapildui', 10.2, '2026-09-05'), e('Campezo', 12.2, '2026-09-30'), e('Iturrieta', 13.1, '2026-08-11'),
    e('Arkauti', 14, '2026-08-30'), e('Gasteiz', 15.2, '2026-08-12'), e('Ozaeta', 16, '2026-08-02'), e('Egino', 17.4, '2026-08-09'), e('Opakua', 18, '2026-08-25'),
    e('Agurain', 19.7, '2026-09-29'), e('Zambrana', 19.9, '2026-08-21')];
  const n = Array.from({ length: LARGO }, (_, k) => (k >= entreDias('2026-08-01', '2026-09-06') ? (k === LARGO - 1 ? 1 : 2) : 3));
  const pluvio = { version: VERSION_PLUVIO, generado: 'x', desde: '2026-08-01', hasta: '2026-09-30', lugares: { a: { mm: Array(LARGO).fill(1), n, estaciones, cercanas: 14 } } };
  const m = aplicarPluvio([{ id: 'z', puntos: [{ id: 'a' }] }], { hoy: s.fechas[59], series: { a: s } }, pluvio);
  const t = textoOrigenPunto(m.series.a, m.pluvio.porPunto.a);
  assert.equal(t.principal, `Lluvia medida: entre 1 y 2 estaciones por día (Campezo 12,2${NB}km y Agurain 19,7${NB}km)`);
  assert.equal(t.detalle, '25 de 26 días medidos; el resto, modelo');
  // Un archivo anterior, sin `ultimo`: no se sabe cuáles midieron en la ventana y no se nombra ninguna.
  const viejo = { ...pluvio, lugares: { a: { ...pluvio.lugares.a, estaciones: estaciones.map(({ ultimo, ...x }) => x) } } };
  const mv = aplicarPluvio([{ id: 'z', puntos: [{ id: 'a' }] }], { hoy: s.fechas[59], series: { a: s } }, viejo);
  assert.equal(textoOrigenPunto(mv.series.a, mv.pluvio.porPunto.a).principal, 'Lluvia medida: entre 1 y 2 estaciones por día');
  // Ningún día medido en la ventana: modelo, con el motivo de siempre.
  const antes = { ...pluvio, lugares: { a: { ...pluvio.lugares.a, mm: Array.from({ length: LARGO }, (_, k) => (k < 30 ? 1 : null)), estaciones: [estaciones[0]] } } };
  const ma = aplicarPluvio([{ id: 'z', puntos: [{ id: 'a' }] }], { hoy: s.fechas[59], series: { a: s } }, antes);
  assert.equal(textoOrigenPunto(ma.series.a, ma.pluvio.porPunto.a).principal, 'Lluvia estimada con el modelo (sin datos de estaciones en los últimos 26 días)');
});

test('punto con días de AEMET y ninguno de pluviómetros: el texto de Zona es el de AEMET (null aquí)', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena });
  const base = s.origenPrecip ?? s.fechas.map(() => 'modelo');
  const aemet = { ...s, origenPrecip: base.map((o, k) => (k > s.hoy - 10 && k <= s.hoy ? 'estacion:3104Y' : o)) };
  assert.equal(textoOrigenPunto(aemet, { estaciones: [], cercanas: 0, factor: 1 }), null);
  // Con días de los dos orígenes se dicen los dos, sin atribuir a AEMET lo que midieron los pluviómetros.
  const mixta = { ...aemet, origenPrecip: aemet.origenPrecip.map((o, k) => (k > s.hoy - 20 && k <= s.hoy - 10 ? 'medida' : o)) };
  const t = textoOrigenPunto(mixta, { estaciones: [{ ...est('Covaleda', 2), ultimo: s.fechas[s.hoy - 11] }], cercanas: 1, factor: 1, nDia: mixta.fechas.map(() => 2) }, { nombre: 'Rascafría', distanciaKm: 8.2 });
  assert.equal(t.principal, `Lluvia medida con 1 estación (Covaleda, a 2${NB}km)`);
  assert.equal(t.detalle, `10 de 26 días medidos, 10 con AEMET (Rascafría, a 8,2${NB}km); el resto, modelo`);
});

test('origen de una celda del índice; un índice sin pluviómetros no da texto', () => {
  const lluvia = { desde: '2026-08-03', hoy: 59, mm: Array(60).fill(0), origen: [...Array(59).fill(1), 0], estaciones: ['Covaleda'], aportan: 1, cercanas: 1 };
  assert.deepEqual(origenDeCelda({ lluvia }), { estaciones: ['Covaleda'], medidos: 25, total: 26, cercanas: 1, aprox: true, otras: 0, factor: 1 });
  // Con las distancias (lluvia.km) el texto dice a cuántos km está cada una; `aportan` dice cuántas más midieron en la ventana.
  const con = origenDeCelda({ lluvia: { ...lluvia, estaciones: ['A', 'B', 'C'], km: [1, 2, 3], aportan: 5, cercanas: 8 } });
  assert.deepEqual(con.estaciones, [est('A', 1), est('B', 2), est('C', 3)]);
  assert.equal(con.otras, 2);
  // Un índice anterior (sin `aportan`) puede nombrar estaciones que no midieron en la ventana: no se nombran.
  const viejo = origenDeCelda({ lluvia: { ...lluvia, estaciones: ['Navarrete', 'Kapildui'], km: [5.5, 10.2], aportan: undefined } });
  assert.deepEqual([viejo.estaciones, viejo.otras], [[], 0]);
  assert.equal(textoOrigenLluvia(viejo), 'Lluvia medida en estaciones próximas. 25 de 26 días medidos; el resto, modelo');
  assert.equal(origenDeCelda({ lluvia: { desde: '2026-08-03', hoy: 59, mm: Array(60).fill(0) } }), null);
});

// Revisión final 3: la hoja del mapa dice, como Zona, que el modelo está corregido.
test('origen de una celda con el modelo corregido por el sesgo de la zona: «modelo ×f»', () => {
  const lluvia = { desde: '2026-08-03', hoy: 59, mm: Array(60).fill(0), origen: [...Array(40).fill(2), ...Array(19).fill(1), 0], estaciones: ['Covaleda'], km: [2], aportan: 1, cercanas: 1, factor: 0.67 };
  assert.equal(textoOrigenLluvia(origenDeCelda({ lluvia })), `Lluvia medida en 1 estación próxima (Covaleda, a ~2${NB}km). 19 de 26 días medidos; el resto, modelo ×0,67`);
  const sin = { ...lluvia, origen: [...Array(59).fill(2), 0], estaciones: [], km: [], aportan: 0 };
  assert.equal(textoOrigenLluvia(origenDeCelda({ lluvia: sin })), 'Lluvia estimada con el modelo (las estaciones cercanas no tienen datos válidos). Corregida ×0,67 con las estaciones de la zona');
});

test('el índice valida `km`: mismos elementos que `estaciones`, números', () => {
  const salida = (l) => ({ version: 1, sello: '2026-09-30T07', fechas: ['2026-09-30'], hoy: '2026-09-30', celdas: { c: { altRef: 1000, dias: [null], lluvia: { desde: '2026-09-29', hoy: 1, mm: [1, 2, 3], ...l } } } });
  assert.deepEqual(validarSalida(salida({ origen: [1, 2, 0], estaciones: ['A'], km: [3.4], cercanas: 1 })), []);
  assert.deepEqual(validarSalida(salida({ estaciones: ['A'], km: [3.4, 5] })), ['celda c mal formada']);
  assert.deepEqual(validarSalida(salida({ estaciones: ['A'], km: ['x'] })), ['celda c mal formada']);
  // `aportan` (entero) y `factor` (número positivo), opcionales.
  assert.deepEqual(validarSalida(salida({ origen: [1, 2, 0], estaciones: ['A'], km: [3.4], aportan: 4, cercanas: 6, factor: 0.67 })), []);
  assert.deepEqual(validarSalida(salida({ estaciones: ['A'], aportan: 1.5 })), ['celda c mal formada']);
  assert.deepEqual(validarSalida(salida({ estaciones: ['A'], factor: 0 })), ['celda c mal formada']);
  assert.deepEqual(validarSalida(salida({ estaciones: ['A'], factor: 'x' })), ['celda c mal formada']);
});

test('hoja del mapa: el texto del origen de la lluvia, solo si el índice lo trae', () => {
  const nota = { sinEspecies: false, valor: 70, especie: { id: 'x', nombre: 'X', comunes: { es: ['equis'] } }, resultado: {}, otras: [], faltan: [] };
  const con = modeloHoja({ celda, nota, ag: { P26: 40, pct: 50, T20aire: 12 }, lluvia: { estaciones: [est('Casillas', 19.6)], medidos: 26, total: 26, cercanas: 1, aprox: true } });
  assert.equal(con.origenLluvia, `Lluvia medida en 1 estación próxima (Casillas, a ~19,6${NB}km)`);
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
  assert.match(svg, /Las barras con una rayita debajo son 30 días medidos en estaciones/);
  assert.doesNotMatch(graficoLluvia({ serie: serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena }) }), /barras con una rayita debajo/);
});

test('los colores de lo medido salen de tokens (claro y los dos oscuros)', () => {
  const tokens = readFileSync('css/tokens.css', 'utf8');
  assert.equal((tokens.match(/--c-lluvia-medida:/g) ?? []).length, 3);
  const css = readFileSync('css/componentes.css', 'utf8');
  assert.match(css, /\.grafico \.barra-medida \{ fill: var\(--c-lluvia-medida\); \}/);
  assert.match(css, /\.muestra--medida \{ background: var\(--c-lluvia-medida\);/);
  assert.equal((css.match(/^\.grafico \.barra-medida \{/gm) ?? []).length, 1);   // un solo selector
  assert.match(css, /\.grafico \.marca-medida \{ fill: var\(--c-texto\); \}/);
});

// tests/rejilla-nota.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRADIENTE, corregirAltitud, notaEspecie, notaCelda } from '../js/rejilla/nota.js';
import { agregadosDia, indiceZona } from '../js/indice.js';
import { empaquetarDia, desempaquetarDia } from '../js/rejilla/salida.js';
import { especiesDeZona } from '../js/datos.js';
import { ajusteHumedad } from '../js/rejilla/orientacion.js';
import { serieSintetica, BOLETUS, NISCALO, lluviaBuena } from './ayudas.js';

const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;
const especies = JSON.parse(readFileSync('data/especies.json', 'utf8')).especies;
const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
const humeda = () => agregadosDia(serieSintetica({ precip: lluviaBuena }), 59);   // 18-oct-2026, aire 13 °C, mínimas 6 °C

test('corrección por altitud: −0,65 °C cada 100 m en las medias y en las mínimas', () => {
  const c = corregirAltitud(humeda(), 200);
  cerca(c.T20aire, 11.7); cerca(c.T20suelo, 11.7);
  c.tmin7.forEach((t) => cerca(t, 4.7));
  assert.equal(GRADIENTE, -0.0065);
  assert.equal(corregirAltitud(humeda(), 0).T20aire, 13);
  assert.equal(corregirAltitud({ ...humeda(), T20suelo: null }, 100).T20suelo, null);
});

test('altitud sin dato: ni se omite la corrección ni se aplica una enorme; la celda queda sin nota', () => {
  for (const [altitud, altRef] of [[NaN, 1500], [1500, undefined], [Infinity, 1500], [null, 1500]]) {
    assert.equal(notaEspecie(humeda(), BOLETUS, { altitud, altRef }), null, `${altitud} / ${altRef}`);
  }
  const B = { ...BOLETUS, habitats: ['pinar-silvestre'] };
  const r = notaCelda({ ag: humeda(), habitat: 'pinar-silvestre', altitud: NaN, altRef: 1500, especies: [B], fecha: '2026-10-18' });
  assert.equal(r.sinEspecies, false);
  assert.equal(r.valor, null);
  assert.deepEqual(r.faltan, ['boletus-edulis']);
});

test('notaEspecie con números exactos: 200 m más arriba el boletus baja de 96 a 92; 500 m, a 77 y el níscalo sube a 96', () => {
  assert.equal(notaEspecie(humeda(), BOLETUS, { altitud: 1500, altRef: 1500 }).valor, 96);
  assert.equal(notaEspecie(humeda(), BOLETUS, { altitud: 1700, altRef: 1500 }).valor, 92);
  assert.equal(notaEspecie(humeda(), BOLETUS, { altitud: 2000, altRef: 1500 }).valor, 77);
  assert.equal(notaEspecie(humeda(), NISCALO, { altitud: 2000, altRef: 1500 }).valor, 96);
  assert.equal(notaEspecie({ ...humeda(), P26: null }, BOLETUS, { altitud: 1500, altRef: 1500 }), null);
});

// El ajuste vive en indiceDesdeAgregados (Ruling tarea 7, ronda 2: lluvia de 26 días × ajuste, fW acotado a ±15 %);
// aquí solo se comprueba que notaEspecie se lo pasa: con P26 = 52 mm, la umbría (N, 1,15) da fW0 × 1,15 y el llano, fW0.
test('notaEspecie pasa el ajuste de la orientación (orientativo) a la fórmula y el llano es neutro', () => {
  const ag = agregadosDia(serieSintetica({ precip: () => 2 }), 59);
  const umbria = notaEspecie(ag, BOLETUS, { altitud: 1500, altRef: 1500, orientacion: 1 });
  const llano = notaEspecie(ag, BOLETUS, { altitud: 1500, altRef: 1500, orientacion: 0 });
  assert.equal(ajusteHumedad(1), 1.15);
  assert.ok(Math.abs(umbria.factores.fW - Math.min(1, (22 / 60) * ajusteHumedad(1))) < 1e-12);
  assert.equal(llano.factores.fW, 22 / 60);
  assert.ok(umbria.valor > llano.valor);
  assert.ok(notaEspecie(ag, BOLETUS, { altitud: 1500, altRef: 1500, orientacion: 5 }).valor < llano.valor);   // solana
});

test('notaCelda: mejor especie del hábitat en temporada; con chip, solo esas; sin especies o sin datos, sin nota', () => {
  const fecha = '2026-10-18', ag = humeda();
  const B = { ...BOLETUS, habitats: ['pinar-silvestre'] }, N = { ...NISCALO, habitats: ['pinar-silvestre'] };
  const r = notaCelda({ ag, habitat: 'pinar-silvestre', altitud: 1500, altRef: 1500, especies: [B, N], fecha });
  assert.equal(r.sinEspecies, false);
  assert.equal(r.valor, 96);
  assert.equal(r.especie.id, 'boletus-edulis');
  assert.deepEqual(r.otras.map((x) => x.especie.id), ['lactarius-deliciosus']);
  const soloNiscalo = notaCelda({ ag, habitat: 'pinar-silvestre', altitud: 1500, altRef: 1500, especies: [B, N], fecha, filtro: new Set(['lactarius-deliciosus']) });
  assert.equal(soloNiscalo.especie.id, 'lactarius-deliciosus');
  const otroHabitat = notaCelda({ ag, habitat: 'chopera', altitud: 1500, altRef: 1500, especies: [B, N], fecha });
  assert.equal(otroHabitat.sinEspecies, true);
  assert.equal(otroHabitat.valor, null);
  const sinDatos = notaCelda({ ag: null, habitat: 'pinar-silvestre', altitud: 1500, altRef: 1500, especies: [B], fecha });
  assert.equal(sinDatos.sinEspecies, false);
  assert.equal(sinDatos.valor, null);   // gris, nunca un 0 inventado
  assert.deepEqual(sinDatos.faltan, ['boletus-edulis']);
  assert.deepEqual(r.faltan, []);
});

test('«Mejor hoy»: gana la de nota más alta sea cual sea el orden, y una especie sin datos no entra ni en otras', () => {
  const fecha = '2026-10-18', ag = humeda(), celda = { habitat: 'pinar-silvestre', altitud: 1500, altRef: 1500, fecha };
  const B = { ...BOLETUS, habitats: ['pinar-silvestre'] }, N = { ...NISCALO, habitats: ['pinar-silvestre'] };
  const alReves = notaCelda({ ...celda, ag, especies: [N, B] });
  assert.equal(alReves.especie.id, 'boletus-edulis');
  assert.equal(alReves.valor, 96);
  assert.deepEqual(alReves.otras.map((x) => x.especie.id), ['lactarius-deliciosus']);
  assert.ok(alReves.otras[0].valor < 96);
  // Una de suelo (como el boletus, pero con la temperatura del suelo) puntúa más que el níscalo de aire...
  const S = { ...B, id: 'de-suelo', indice: { ...B.indice, usarSuelo: true } };
  const conSuelo = notaCelda({ ...celda, ag, especies: [N, S] });
  assert.equal(conSuelo.especie.id, 'de-suelo');
  assert.ok(conSuelo.valor > conSuelo.otras[0].valor);
  // ...pero sin temperatura del suelo no se calcula: gana la de aire, la de suelo no sale en otras y queda en faltan.
  const sinSuelo = notaCelda({ ...celda, ag: { ...ag, T20suelo: null }, especies: [S, N] });
  assert.equal(sinSuelo.especie.id, 'lactarius-deliciosus');
  assert.deepEqual(sinSuelo.otras, []);
  assert.deepEqual(sinSuelo.faltan, ['de-suelo']);
});

test('la temporada se mira en la fecha de los agregados si la traen', () => {
  const ag = humeda(), M = { id: 'morchella', habitats: ['pinar-silvestre'], temporada: { meses: [3, 4, 5], tipo: 'primavera' }, indice: BOLETUS.indice };
  const celda = { habitat: 'pinar-silvestre', altitud: 1500, altRef: 1500, especies: [M] };
  assert.equal(notaCelda({ ...celda, ag, fecha: '2026-04-10' }).sinEspecies, true);   // ag.fecha = 18-oct: fuera de temporada
  assert.equal(notaCelda({ ...celda, ag: null, fecha: '2026-04-10' }).sinEspecies, false);   // sin agregados, la fecha pedida
});

test('notaCelda en hábitats que pueden no tener especies con índice: sinEspecies, sin romperse', () => {
  const fecha = '2026-10-18', ag = humeda();
  for (const z of zonas) {
    const esps = especiesDeZona(z, especies);
    for (const habitat of ['sabinar', 'quejigar', 'pinar-pinonero', 'abedular']) {
      const r = notaCelda({ ag, habitat, altitud: 1000, altRef: 1000, orientacion: 3, especies: esps, fecha });
      if (!esps.some((e) => e.habitats.includes(habitat))) assert.equal(r.sinEspecies, true, `${z.id} ${habitat}`);
      if (r.sinEspecies) assert.equal(r.valor, null);
    }
  }
});

// Spec §4 y Ruling D1: la equivalencia se comprueba POR ESPECIE. En cada punto de zonas.json, para cada especie del
// hábitat del punto, con el ajuste de orientación neutro y la misma meteo, la nota por rejilla es la de indiceZona.
// La meteo de la celda gruesa está a su altitud de referencia; la que Open-Meteo daría en el punto es esa misma
// desplazada por el gradiente. El filtro por hábitat de la rejilla es intencionado (spec §3.3). Tolerancia 0: los
// agregados publicados van redondeados a centésimas y eso no ha movido ninguna nota entera en estos escenarios.
// Dos escenarios: templado (mínimas de 6 °C) y frío (mínimas de 1,5 a −1,5 °C en la celda gruesa: con el desplazamiento
// de altitud hay noches de helada y, a −250 m de la referencia, helada fuerte < −3 °C, así que la penalización cuenta).
// Ninguna especie con usarSuelo tiene hoy el hábitat de algún punto (morchella: chopera); el suelo se prueba arriba.
const desplazar = (s, d) => ({ ...s, tmedia: s.tmedia.map((v) => v + d), tmin: s.tmin.map((v) => v + d), tmax: s.tmax.map((v) => v + d), tsuelo: s.tsuelo.map((v) => v + d) });
const ESCENARIOS = { templado: {}, frio: { tmin: (k) => 1.5 - (k % 4) } };
test('equivalencia por especie con indiceZona en todos los puntos de zonas.json (exacta), templado y con heladas', () => {
  let comparados = 0, conHelada = 0;
  for (const [nombre, extra] of Object.entries(ESCENARIOS)) for (const z of zonas) for (const p of z.puntos) for (const dif of [0, 300, -250]) {
    const altRef = p.altitud + dif;
    const S = serieSintetica({ precip: lluviaBuena, ...extra });
    const Sp = desplazar(S, GRADIENTE * (p.altitud - altRef));
    const ag = desempaquetarDia(JSON.parse(JSON.stringify(empaquetarDia(agregadosDia(S, 59)))), S.fechas[59], false);
    for (const esp of especiesDeZona(z, especies).filter((e) => e.habitats.includes(p.habitat))) {
      const zona = indiceZona({ [p.id]: Sp }, 59, [esp]), esperado = zona.valor;
      const r = notaCelda({ ag, habitat: p.habitat, altitud: p.altitud, altRef, orientacion: 0, especies: [esp], fecha: S.fechas[59] });
      if (esperado == null) { assert.equal(r.valor, null, `${p.id} ${esp.id}`); continue; }
      assert.equal(r.especie.id, esp.id);
      assert.equal(r.valor, esperado, `${nombre} ${p.id} ${esp.id} (${dif} m): rejilla ${r.valor}, zona ${esperado}`);
      if (r.resultado.factores.pen < 1 && nombre === 'frio') conHelada++;
      comparados++;
    }
  }
  assert.ok(comparados > 50, `solo ${comparados} comparaciones`);
  assert.ok(conHelada > 50, `solo ${conHelada} comparaciones con helada`);
});

test('una fila mala de ajustes_umbrales se ignora igual que en Hoy y Zona; una buena se aplica', (t) => {
  const aviso = t.mock.method(console, 'warn', () => {});
  const soria = zonas.find((z) => z.id === 'soria'), fecha = '2026-10-18', ag = humeda();
  const nota = (umbrales) => notaCelda({ ag, habitat: 'pinar-silvestre', altitud: 1200, altRef: 1200, fecha,
    especies: especiesDeZona(soria, especies, umbrales), filtro: new Set(['boletus-edulis']) }).valor;
  const base = nota({});
  assert.ok(base != null);
  assert.equal(nota({ 'boletus-edulis': { pmin: 'mucho', pfull: -3 } }), base);
  assert.equal(aviso.mock.callCount(), 1);
  assert.ok(nota({ 'boletus-edulis': { pmin: 100, pfull: 160 } }) < base);
});

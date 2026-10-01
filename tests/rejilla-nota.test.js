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
// hábitat del punto, con el ajuste de orientación neutro y la misma meteo, la nota por rejilla es la de indiceZona
// (tolerancia de 1 punto). La meteo de la celda gruesa está a su altitud de referencia; la que Open-Meteo daría en el
// punto es esa misma desplazada por el gradiente. El filtro por hábitat de la rejilla es intencionado (spec §3.3).
const desplazar = (s, d) => ({ ...s, tmedia: s.tmedia.map((v) => v + d), tmin: s.tmin.map((v) => v + d), tmax: s.tmax.map((v) => v + d), tsuelo: s.tsuelo.map((v) => v + d) });
test('equivalencia por especie con indiceZona en todos los puntos de zonas.json (±1)', () => {
  let comparados = 0;
  for (const z of zonas) for (const p of z.puntos) for (const dif of [0, 300, -250]) {
    const altRef = p.altitud + dif;
    const S = serieSintetica({ precip: lluviaBuena });
    const Sp = desplazar(S, GRADIENTE * (p.altitud - altRef));
    const ag = desempaquetarDia(JSON.parse(JSON.stringify(empaquetarDia(agregadosDia(S, 59)))), S.fechas[59], false);
    for (const esp of especiesDeZona(z, especies).filter((e) => e.habitats.includes(p.habitat))) {
      const esperado = indiceZona({ [p.id]: Sp }, 59, [esp]).valor;
      const r = notaCelda({ ag, habitat: p.habitat, altitud: p.altitud, altRef, orientacion: 0, especies: [esp], fecha: S.fechas[59] });
      if (esperado == null) { assert.equal(r.valor, null, `${p.id} ${esp.id}`); continue; }
      assert.equal(r.especie.id, esp.id);
      assert.ok(Math.abs(r.valor - esperado) <= 1, `${p.id} ${esp.id} (${dif} m): rejilla ${r.valor}, zona ${esperado}`);
      comparados++;
    }
  }
  assert.ok(comparados > 50, `solo ${comparados} comparaciones`);
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

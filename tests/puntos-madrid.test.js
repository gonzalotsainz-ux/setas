import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { puntoEnGeometria } from '../scripts/validar-datos.mjs';
const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
const { zonas } = leer('data/zonas.json');
const cotos = leer('data/cotos.geojson');
const estaciones = new Set(leer('supabase/functions/aemet/estaciones.json'));
const prohibidos = cotos.features.filter((f) => f.properties.tipo === 'prohibido');
const madrid = ['guadarrama-morcuera-pinar', 'guadarrama-miraflores-pinar', 'guadarrama-canencia-pinar', 'sierra-norte-canencia-melojar', 'sierra-norte-bustarviejo-melojar'];

test('ningún punto meteorológico cae en una zona prohibida (Reserva o Uso Restringido A)', () => {
  for (const z of zonas) for (const p of z.puntos) {
    for (const f of prohibidos) assert.ok(!puntoEnGeometria(p.lon, p.lat, f.geometry), `${p.id} dentro de ${f.properties.id}`);
  }
});

test('los puntos de la vertiente madrileña están en su zona, con verificación y hábitat', () => {
  for (const id of madrid) {
    const z = zonas.find((q) => q.puntos.some((p) => p.id === id));
    assert.ok(z, id);
    const p = z.puntos.find((q) => q.id === id);
    const [x0, y0, x1, y1] = z.bbox;
    assert.ok(p.lon >= x0 && p.lon <= x1 && p.lat >= y0 && p.lat <= y1, `${id} fuera del bbox de ${z.id}`);
    assert.match(p.nota, /MFE50/);
    assert.match(p.nota, /MUP/);
    assert.ok(z.habitats.includes(p.habitat), id);
  }
});

test('Rascafría (3104Y) está en las zonas madrileñas y en la lista blanca; toda estación lleva coordenadas', () => {
  for (const id of ['guadarrama', 'sierra-norte']) assert.ok(zonas.find((z) => z.id === id).estacionesAemet.some((e) => e.id === '3104Y'), id);
  assert.ok(estaciones.has('3104Y'));
  for (const z of zonas) for (const e of z.estacionesAemet) {
    assert.ok(Number.isFinite(e.lat) && Number.isFinite(e.lon), `${z.id}/${e.id} sin lat/lon`);
    assert.ok(estaciones.has(e.id), `${e.id} no está en la lista blanca de la función`);
  }
});

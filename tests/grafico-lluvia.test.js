import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graficoLluvia } from '../js/ui/grafico-lluvia.js';
import { serieSintetica, lluviaBuena } from './ayudas.js';

test('una barra por día, previstas en trama y nulos sin barra', () => {
  const s = serieSintetica({ dias: 70, hoy: 59, precip: (k) => (k === 30 ? null : lluviaBuena(k)) });
  const svg = graficoLluvia({ serie: s, altura: 160 });
  assert.equal((svg.match(/<rect class="barra/g) ?? []).length, 69);
  assert.equal((svg.match(/barra prevista/g) ?? []).length, 10);
  assert.match(svg, /<title>.*sin dato/);
  assert.match(svg, /class="hoy"/);
});

test('dos paneles: acumulado de 26 días arriba y lluvia diaria abajo', () => {
  const s = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
  const svg = graficoLluvia({ serie: s });
  assert.match(svg, /Acumulado de 26 días/);
  assert.match(svg, /Lluvia diaria/);
  assert.match(svg, /class="acumulado"/);
  assert.match(svg, /class="acumulado-previsto"/);
  assert.match(svg, /id="rayado"/);
});

test('con dispersión entre modelos dibuja la horquilla y el horizonte real, no un 7 fijo', () => {
  const s = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
  const d = { modelos: { ecmwf_ifs: 20, icon_seamless: 4 }, media: 12, rango: 16, incierta: true, horizonte: 4, excluidos: [] };
  const svg = graficoLluvia({ serie: s, dispersionPunto: d });
  assert.match(svg, /class="horquilla"/);
  assert.match(svg, /4 días/);
  assert.doesNotMatch(svg, /7 días/);
  assert.doesNotMatch(graficoLluvia({ serie: s }), /class="horquilla"/);
});

test('una serie sin previsión no rompe el gráfico', () => {
  const s = serieSintetica({ dias: 60, hoy: 59, precip: lluviaBuena });
  const svg = graficoLluvia({ serie: s });
  assert.equal((svg.match(/barra prevista/g) ?? []).length, 0);
  assert.equal((svg.match(/<rect class="barra/g) ?? []).length, 60);
});

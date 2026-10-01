// tests/rejilla-datos.test.js
// Sobre los datos generados: ninguna celda que toque un polígono prohibido (centro o cualquiera de sus 4 esquinas)
// tiene hábitat, y la copia de la función es idéntica. Se salta si todavía no se ha generado data/rejilla/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { decodificarRejilla, PROHIBIDO, CODIGO } from '../js/rejilla/formato.js';
import { centroFina, aGrados, ORIGEN, TAM_FINA } from '../js/rejilla/geo.js';
import { indiceEspacial } from '../scripts/rejilla/generar.mjs';
import { HABITATS } from '../scripts/validar-datos.mjs';
import { gruesasDeArchivo, notasDeArchivo, colorear } from '../js/rejilla/pintor.js';
import { resumirCelda } from '../js/rejilla/salida.js';
import { especiesDeZona } from '../js/datos.js';
import { serieSintetica, lluviaBuena } from './ayudas.js';

const hay = existsSync('data/rejilla/indice.json');
const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));

test('ninguna celda que toque un polígono prohibido tiene hábitat (y todas llevan la marca)', { skip: !hay }, async () => {
  const prohibidos = indiceEspacial(leer('data/cotos.geojson').features.filter((f) => f.properties.tipo === 'prohibido'));
  const dentro = (col, fila) => {
    const { x, y } = centroFina(col, fila), p = aGrados(x, y);
    if (prohibidos.buscar(p.lon, p.lat)) return true;
    for (const [dc, df] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const q = aGrados((col + dc) * TAM_FINA - ORIGEN, ORIGEN - (fila + df) * TAM_FINA);
      if (prohibidos.buscar(q.lon, q.lat)) return true;
    }
    return false;
  };
  let tocan = 0, coloreadas = 0;
  for (const a of leer('data/rejilla/indice.json').archivos) {
    const r = await decodificarRejilla(readFileSync(`data/rejilla/${a.archivo}`));
    const c = r.cabecera;
    for (let f = 0; f < c.alto; f++) for (let col = 0; col < c.ancho; col++) {
      const k = f * c.ancho + col, h = r.habitat[k];
      assert.ok((h & CODIGO) <= HABITATS.length, `${a.archivo}: código ${h & CODIGO}`);
      if (h & CODIGO) coloreadas++;
      if (!dentro(c.col0 + col, c.fila0 + f)) continue;
      tocan++;
      assert.equal(h & CODIGO, 0, `${a.archivo} celda ${k}: hábitat dentro de un prohibido`);
      assert.ok(h & PROHIBIDO, `${a.archivo} celda ${k}: sin marca de prohibido`);
    }
  }
  assert.ok(tocan > 0, 'ninguna celda cae en un prohibido: revisa la generación');
  assert.ok(coloreadas > 0, 'ninguna celda con hábitat: revisa la generación');
});

test('la Edge Function lleva la misma lista de celdas gruesas', { skip: !hay }, () => {
  assert.equal(readFileSync('supabase/functions/rejilla/gruesa.json', 'utf8'), readFileSync('data/rejilla/gruesa.json', 'utf8'));
});

test('con los datos reales, ninguna celda prohibida o sin hábitat sale con color', { skip: !hay }, async () => {
  const gruesa = leer('data/rejilla/gruesa.json'), zonas = leer('data/zonas.json').zonas, especies = leer('data/especies.json').especies;
  const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena }), fechas = serie.fechas.slice(59, 69);
  const resumen = resumirCelda({ altRef: 1200, serie, fechas });
  const salida = { version: 1, sello: '2026-10-18T07', hoy: fechas[0], fechas, celdas: Object.fromEntries(gruesa.celdas.map((g) => [g.id, { ...resumen, altRef: g.altRef }])) };
  let coloreadas = 0, prohibidasGuadarrama = 0;
  for (const a of leer('data/rejilla/indice.json').archivos) {
    const r = await decodificarRejilla(readFileSync(`data/rejilla/${a.archivo}`));
    const zona = zonas.find((z) => z.id === r.cabecera.zona);
    const rgba = colorear(notasDeArchivo({ rejilla: r, gruesas: gruesasDeArchivo(r, gruesa), gruesa, salida, fecha: fechas[0], especies: especiesDeZona(zona, especies) }));
    for (let k = 0; k < r.habitat.length; k++) {
      const h = r.habitat[k], alfa = rgba[4 * k + 3];
      if (h & PROHIBIDO && r.cabecera.zona === 'guadarrama') prohibidasGuadarrama++;
      if (h & PROHIBIDO || !(h & CODIGO)) assert.equal(alfa, 0, `${a.archivo} celda ${k}: color sin monte apropiado o en prohibido`);
      else if (alfa) coloreadas++;
    }
  }
  assert.ok(prohibidasGuadarrama > 0, 'guadarrama debería tener celdas prohibidas con las que probar');
  assert.ok(coloreadas > 0);
});

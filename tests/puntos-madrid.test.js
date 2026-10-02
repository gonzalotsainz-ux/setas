import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { puntoEnGeometria } from '../scripts/validar-datos.mjs';
const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
const { zonas } = leer('data/zonas.json');
const cotos = leer('data/cotos.geojson');
const estaciones = new Set(leer('supabase/functions/aemet/estaciones.json'));
const prohibidos = cotos.features.filter((f) => f.properties.tipo === 'prohibido');
const madrid = ['guadarrama-morcuera-pinar', 'guadarrama-miraflores-pinar', 'guadarrama-canencia-pinar', 'sierra-norte-canencia-melojar', 'sierra-norte-bustarviejo-melojar',
  // Fase 1 de Madrid (02/10/2026): 6 puntos en guadarrama, 5 en sierra-norte y los 4 de sierra-oeste
  'guadarrama-guadarrama-resinero', 'guadarrama-cercedilla-silvestre', 'guadarrama-camorza-resinero', 'guadarrama-sanblas-silvestre', 'guadarrama-alameda-melojar',
  'guadarrama-pinilla-melojar', 'sierra-norte-braojos-silvestre', 'sierra-norte-robregordo-silvestre', 'sierra-norte-hiruela-melojar', 'sierra-norte-pradena-silvestre',
  'sierra-norte-pradena-melojar', 'sierra-oeste-abantos-silvestre', 'sierra-oeste-sanmartin-resinero', 'sierra-oeste-valdemaqueda-resinero', 'sierra-oeste-robledo-encinar'];

test('ningún punto meteorológico cae en una zona prohibida (Reserva o Uso Restringido A)', () => {
  // Excepción: los puntos NO IR (`noIr: true`, solo meteo) pueden caer en los montes públicos NO IR (`mad-mup-*`), nunca
  // en una Reserva ni en un Uso Restringido A del Parque.
  for (const z of zonas) for (const p of z.puntos) {
    for (const f of prohibidos) {
      if (p.noIr && /^mad-mup-/.test(f.properties.id)) continue;
      assert.ok(!puntoEnGeometria(p.lon, p.lat, f.geometry), `${p.id} dentro de ${f.properties.id}`);
    }
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

test('los bbox de las zonas no se solapan y guadarrama y sierra-norte contienen sus cotos pequeños', () => {
  const cruza = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  for (const [i, a] of zonas.entries()) for (const b of zonas.slice(i + 1)) assert.ok(!cruza(a.bbox, b.bbox), `${a.id} y ${b.id} se solapan`);
  const ext = (g) => { const v = []; const r = (x) => (typeof x[0] === 'number' ? v.push(x) : x.forEach(r)); r(g.coordinates); return [Math.min(...v.map((p) => p[0])), Math.min(...v.map((p) => p[1])), Math.max(...v.map((p) => p[0])), Math.max(...v.map((p) => p[1]))]; };
  // SG-50005 y PMSG-50001 son enormes y salen de cualquier bbox; pnsg-ura-los-reajos-reajo-alto asoma 250 m (conocido, ver docs/datos.md).
  // mad-mup-39-guadarrama (MUP 39, polígono oficial de la IDEM) baja hasta lat 40,6479, 230 m por debajo del bbox de guadarrama.
  const conocidos = new Set(['SG-50005', 'PMSG-50001', 'pnsg-ura-los-reajos-reajo-alto', 'mad-mup-39-guadarrama']);
  for (const f of cotos.features) {
    const z = zonas.find((q) => q.id === f.properties.zona);
    if (!z || !['guadarrama', 'sierra-norte'].includes(z.id) || conocidos.has(f.properties.id)) continue;
    const e = ext(f.geometry);
    assert.ok(e[0] >= z.bbox[0] && e[1] >= z.bbox[1] && e[2] <= z.bbox[2] && e[3] <= z.bbox[3], `${f.properties.id} fuera del bbox de ${z.id}`);
  }
});

test('zonas nuevas (Burgos, norte de Burgos y Extremadura): cada punto dentro de su bbox, con nota y hábitat de la zona', () => {
  for (const id of ['burgos', 'merindades', 'extremadura']) {
    const z = zonas.find((q) => q.id === id);
    assert.ok(z?.puntos.length, id);
    const [x0, y0, x1, y1] = z.bbox;
    for (const p of z.puntos) {
      assert.ok(p.lon >= x0 && p.lon <= x1 && p.lat >= y0 && p.lat <= y1, `${p.id} fuera del bbox de ${id}`);
      assert.ok(z.habitats.includes(p.habitat), p.id);
      assert.match(p.nota, id === 'extremadura' ? /MFE50/ : /IDECyL/);
      assert.match(p.nota, /ENP 2025/);
    }
  }
  // Los acotados de Burgos ya no cuelgan de soria (el bbox de soria se recortó en lon -3,04).
  for (const f of cotos.features) if (/^P?M?BU-/.test(f.properties.id)) assert.notEqual(f.properties.zona, 'soria', f.properties.id);
  assert.ok(zonas.find((z) => z.id === 'soria').bbox[0] >= -3.04);
});

test('extremadura incluye Badajoz: el bbox llega al sur hasta Tentudía (lat 38,0) sin solapar otra zona', () => {
  const ex = zonas.find((z) => z.id === 'extremadura');
  assert.deepEqual(ex.provincias, ['Cáceres', 'Badajoz']);
  assert.ok(ex.bbox[1] <= 38.0 && ex.bbox[3] >= 40.3);
  // Tentudía (Fuentes de León 38,07 N, Monesterio 38,09 N) queda dentro
  assert.ok(ex.bbox[1] < 38.07 && 38.09 < ex.bbox[3]);
  for (const z of zonas.filter((q) => q.id !== 'extremadura')) assert.ok(!(ex.bbox[0] < z.bbox[2] && z.bbox[0] < ex.bbox[2] && ex.bbox[1] < z.bbox[3] && z.bbox[1] < ex.bbox[3]), z.id);
});

test('fase 1 de Madrid: zona sierra-oeste sin solapes, con sus 4 puntos, sus estaciones en la lista blanca y su rejilla', () => {
  const so = zonas.find((z) => z.id === 'sierra-oeste');
  assert.deepEqual(so.bbox, [-4.3999, 40.22, -3.9601, 40.6499]);
  assert.deepEqual(so.provincias, ['Madrid']);
  assert.deepEqual(so.puntos.map((p) => p.id), ['sierra-oeste-abantos-silvestre', 'sierra-oeste-sanmartin-resinero', 'sierra-oeste-valdemaqueda-resinero', 'sierra-oeste-robledo-encinar']);
  assert.deepEqual(so.estacionesAemet.map((e) => e.id).sort(), ['3266A', '3330Y', '3338']);
  for (const e of so.estacionesAemet) assert.ok(estaciones.has(e.id), e.id);
  // Los bbox de guadarrama y sierra-norte no cambian en la fase 1
  assert.deepEqual(zonas.find((z) => z.id === 'guadarrama').bbox, [-4.25, 40.65, -3.7701, 41.05]);
  assert.deepEqual(zonas.find((z) => z.id === 'sierra-norte').bbox, [-3.77, 40.8, -3.3, 41.35]);
  const indice = leer('data/rejilla/indice.json');
  assert.ok(indice.archivos.some((a) => a.zona === 'sierra-oeste'), 'falta la rejilla fina de sierra-oeste');
  assert.ok(leer('data/rejilla/gruesa.json').pasos['sierra-oeste'] > 0);
});

test('fase 1 de Madrid: los puntos en montes fuera del Parque sin ordenanza no se presentan como recogida permitida', () => {
  const punto = (id) => zonas.flatMap((z) => z.puntos).find((p) => p.id === id);
  // Decisión de la usuaria (02/10/2026): siguen como NO IR hasta que la Comunidad confirme el ap. 4.4.2.6 del PORN
  for (const id of ['guadarrama-guadarrama-resinero', 'guadarrama-cercedilla-silvestre', 'guadarrama-alameda-melojar', 'guadarrama-pinilla-melojar', 'sierra-oeste-abantos-silvestre']) {
    const p = punto(id);
    assert.equal(p.noIr, true, id);
    assert.match(p.proteccion, /NO IR/, id);
    assert.match(p.proteccion, /4\.4\.2\.6/, id);
    assert.match(p.proteccion, /pendiente de confirmación oficial/, id);
  }
  // Los demás puntos nuevos fuera de cotos con permiso: régimen sin confirmar
  for (const id of ['sierra-norte-braojos-silvestre', 'sierra-norte-robregordo-silvestre', 'sierra-norte-hiruela-melojar', 'sierra-norte-pradena-silvestre', 'sierra-norte-pradena-melojar']) {
    assert.match(punto(id).proteccion, /^Régimen de recogida sin confirmar/, id);
  }
  assert.match(punto('sierra-norte-braojos-silvestre').proteccion, /pendiente de esa resolución/);
  for (const id of ['sierra-oeste-sanmartin-resinero', 'sierra-oeste-valdemaqueda-resinero', 'sierra-oeste-robledo-encinar']) assert.match(punto(id).proteccion, /^Régimen de recogida sin confirmar/, id);
  assert.match(punto('sierra-oeste-abantos-silvestre').proteccion, /Paraje Pintoresco/);
  assert.match(punto('guadarrama-camorza-resinero').proteccion, /zona A2, Reserva Natural Educativa/);
  // Solo los puntos NO IR llevan la marca, y siempre a true
  const conMarca = zonas.flatMap((z) => z.puntos).filter((p) => 'noIr' in p).map((p) => p.id).sort();
  assert.deepEqual(conMarca, ['guadarrama-alameda-melojar', 'guadarrama-cercedilla-silvestre', 'guadarrama-guadarrama-resinero', 'guadarrama-pinilla-melojar', 'sierra-oeste-abantos-silvestre']);
});

test('montes públicos NO IR fuera del Parque: polígonos prohibido oficiales de la IDEM y sin color en la rejilla', async () => {
  const mup = cotos.features.filter((f) => /^mad-mup-/.test(f.properties.id));
  // 23 MUP de Guadarrama, Cercedilla, Navacerrada, Los Molinos, Alameda del Valle y Pinilla del Valle, y el 46 de Abantos
  assert.equal(mup.length, 24);
  for (const id of ['mad-mup-39-guadarrama', 'mad-mup-32-cercedilla', 'mad-mup-60-alameda-del-valle', 'mad-mup-101-pinilla-del-valle', 'mad-mup-102-pinilla-del-valle', 'mad-mup-24-navacerrada', 'mad-mup-46-san-lorenzo-de-el-escorial']) assert.ok(mup.some((f) => f.properties.id === id), id);
  for (const f of mup) {
    const p = f.properties;
    assert.equal(p.tipo, 'prohibido', p.id);
    assert.equal(p.precision, 'oficial', p.id);
    assert.equal(p.regimenConfirmado, false, p.id);
    assert.match(p.fuente, /^https:\/\/idem\.comunidad\.madrid\/geoidem\/wfs\?.*IDEM_MA_MONTES_UP/, p.id);
    assert.match(p.nota, /4\.4\.2\.6.*pendiente de confirmación oficial/, p.id);
    assert.ok(p.normas.includes('madrid-porn-guadarrama-96-2009'), p.id);
  }
  // Las celdas de la rejilla en el centro de cada punto NO IR quedan prohibidas y sin hábitat
  const { decodificarRejilla, PROHIBIDO, CODIGO } = await import('../js/rejilla/formato.js');
  const { aMercator, celdaFina } = await import('../js/rejilla/geo.js');
  const indice = leer('data/rejilla/indice.json').archivos;
  for (const z of zonas) for (const p of z.puntos.filter((q) => q.noIr)) {
    const { x, y } = aMercator(p.lon, p.lat), { col, fila } = celdaFina(x, y);
    const a = indice.find((q) => q.zona === z.id && col >= q.col0 && col < q.col0 + q.ancho && fila >= q.fila0 && fila < q.fila0 + q.alto);
    const r = await decodificarRejilla(readFileSync(`data/rejilla/${a.archivo}`));
    const h = r.habitat[(fila - a.fila0) * a.ancho + (col - a.col0)];
    assert.ok(h & PROHIBIDO, `${p.id}: su celda no está marcada como prohibida`);
    assert.equal(h & CODIGO, 0, `${p.id}: su celda tiene hábitat`);
  }
});

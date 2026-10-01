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

const sindrome = () => ({ id: 'faloidiano', nombre: 'Síndrome faloidiano', latencia: '6–24 h', gravedad: 'mortal', texto: 'x',
  fuentes: [{ url: 'https://x.es', consultado: '2026-09-30' }] });
const mortal = () => ({ id: 'amanita-phalloides', nombre: 'Amanita phalloides', categoria: 'mortal', rd30_2009: null,
  habitats: [], zonas: {}, temporada: { meses: [9, 10], tipo: 'otono' }, identificacion: ['x'], confusiones: [],
  sindrome: 'faloidiano', indice: null, fotos: [], fuentes: [{ id: 'F2', url: 'https://x.es', consultado: '2026-09-30' }] });
const conSindromes = () => { const d = base(); d.especies.especies.push(mortal()); d.especies.sindromes = [sindrome()]; return d; };

test('síndromes y tóxica con síndrome → válido', () => { assert.deepEqual(validar(conSindromes()), []); });

test('síndrome duplicado → error', () => {
  const d = conSindromes(); d.especies.sindromes.push(sindrome());
  assert.match(validar(d).join('\n'), /síndrome duplicado: faloidiano/);
});

test('síndrome sin fuente con url y consultado → error', () => {
  const d = conSindromes(); d.especies.sindromes[0].fuentes = [{ url: 'https://x.es' }];
  assert.match(validar(d).join('\n'), /síndrome faloidiano.*fuente/);
  d.especies.sindromes[0].fuentes = [];
  assert.match(validar(d).join('\n'), /síndrome faloidiano.*fuente/);
});

test('especie con síndrome inexistente → error', () => {
  const d = conSindromes(); d.especies.especies[1].sindrome = 'inventado';
  assert.match(validar(d).join('\n'), /amanita-phalloides.*síndrome inexistente inventado/);
});

test('tóxica o mortal sin síndrome → error', () => {
  for (const cat of ['toxica', 'mortal']) {
    const d = conSindromes(); d.especies.especies[1].categoria = cat; d.especies.especies[1].sindrome = null;
    assert.match(validar(d).join('\n'), /amanita-phalloides.*síndrome/, cat);
  }
});

test('índice.base y temporada.tipo fuera de la lista → error', () => {
  const d = base(); d.especies.especies[0].indice.base = 'analogia';
  assert.match(validar(d).join('\n'), /índice\.base desconocida/);
  const e = base(); e.especies.especies[0].temporada.tipo = 'invierno';
  assert.match(validar(e).join('\n'), /temporada\.tipo desconocido/);
});

// ---- Sitios conocidos y trucos (tarea 15b) ----
const sitio = () => ({ id: 's1', zona: 'soria', nombre: 'Pinar', municipio: 'Covaleda (Soria)', tipo: 'sitio',
  especies: ['boletus-edulis'], habitat: ['pinar-silvestre'], epoca: [10, 11], consejo: 'Busca en umbrías.',
  legal: { estado: 'permiso', normas: ['n1'], texto: 'Permiso de la asociación.' }, lat: null, lon: null,
  fuentes: [{ url: 'https://x.es', titulo: 't', fecha: null, consultado: '2026-09-30' }],
  nFuentes: 1, confianza: 'baja', verificado: false, notas: '' });
const conSitios = (...s) => ({ ...base(), sitios: { version: 1, sitios: s } });

test('sitio válido → sin errores; sin sitios.json también', () => {
  assert.deepEqual(validar(conSitios(sitio())), []);
  assert.deepEqual(validar(base()), []);
});

test('sitio sin fuentes o sin consultado → error', () => {
  const s = sitio(); s.fuentes = [];
  assert.match(validar(conSitios(s)).join('\n'), /s1.*fuente/);
  const t = sitio(); delete t.fuentes[0].consultado;
  assert.match(validar(conSitios(t)).join('\n'), /s1.*fuente/);
});

test('sitio con zona, especie, hábitat o norma inexistentes → error', () => {
  const a = sitio(); a.zona = 'marte';
  assert.match(validar(conSitios(a)).join('\n'), /s1.*zona/);
  const b = sitio(); b.especies = ['seta-inventada'];
  assert.match(validar(conSitios(b)).join('\n'), /seta-inventada/);
  const c = sitio(); c.legal.normas = ['norma-inventada'];
  assert.match(validar(conSitios(c)).join('\n'), /norma-inventada/);
  const d = sitio(); d.habitat = ['selva'];
  assert.match(validar(conSitios(d)).join('\n'), /selva/);
});

test('enums de tipo, confianza y estado legal', () => {
  const a = sitio(); a.tipo = 'mirador';
  assert.match(validar(conSitios(a)).join('\n'), /tipo/);
  const b = sitio(); b.confianza = 'total';
  assert.match(validar(conSitios(b)).join('\n'), /confianza/);
  const c = sitio(); c.legal.estado = 'quizá';
  assert.match(validar(conSitios(c)).join('\n'), /legal\.estado/);
});

test('un sitio recomendable no puede ser prohibido ni privado; un no-ir sí', () => {
  const a = sitio(); a.legal.estado = 'prohibido';
  assert.match(validar(conSitios(a)).join('\n'), /no-ir/);
  const b = sitio(); b.legal.estado = 'privado';
  assert.match(validar(conSitios(b)).join('\n'), /no-ir/);
  const c = sitio(); c.tipo = 'no-ir'; c.legal.estado = 'prohibido';
  assert.deepEqual(validar(conSitios(c)), []);
});

test('la confianza tiene que casar con el número de fuentes', () => {
  const a = sitio(); a.confianza = 'alta'; a.nFuentes = 1;
  assert.match(validar(conSitios(a)).join('\n'), /confianza/);
  const b = sitio(); b.confianza = 'alta'; b.nFuentes = 3;
  assert.deepEqual(validar(conSitios(b)), []);
  const c = sitio(); c.confianza = 'media'; c.nFuentes = 2;
  assert.deepEqual(validar(conSitios(c)), []);
  const d = sitio(); d.confianza = 'baja'; d.nFuentes = 2;
  assert.match(validar(conSitios(d)).join('\n'), /confianza/);
});

test('coordenadas: ambas o ninguna; fuera de un polígono prohibido', () => {
  const a = sitio(); a.lat = 40.5;
  assert.match(validar(conSitios(a)).join('\n'), /lat.*lon|coordenadas/);
  const cuadrado = { type: 'Feature', properties: { id: 'res', tipo: 'prohibido', precision: 'oficial', zona: 'soria', normas: [], fuente: 'https://x.es', revisado: '2026-09-30' },
    geometry: { type: 'Polygon', coordinates: [[[-3, 41], [-2, 41], [-2, 42], [-3, 42], [-3, 41]]] } };
  const dentro = sitio(); dentro.lat = 41.5; dentro.lon = -2.5;
  const d = conSitios(dentro); d.cotos = { type: 'FeatureCollection', features: [cuadrado] };
  assert.match(validar(d).join('\n'), /zona prohibida res/);
  const fuera = sitio(); fuera.lat = 41.5; fuera.lon = -1.5;
  const f = conSitios(fuera); f.cotos = d.cotos;
  assert.deepEqual(validar(f), []);
});

test('point-in-polygon de sitios: MultiPolygon y polígono con hueco', () => {
  const props = { id: 'res', tipo: 'prohibido', precision: 'oficial', zona: 'soria', normas: [], fuente: 'https://x.es', revisado: '2026-09-30' };
  const con = (geometry, lon, lat) => {
    const s = sitio(); s.lat = lat; s.lon = lon;
    const d = conSitios(s); d.cotos = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: props, geometry }] };
    return validar(d).join('\n');
  };
  const cuadro = (x, y, l) => [[x, y], [x + l, y], [x + l, y + l], [x, y + l], [x, y]];
  // MultiPolygon: dos cuadrados separados; vale el punto dentro de cualquiera, no el de en medio
  const multi = { type: 'MultiPolygon', coordinates: [[cuadro(-3, 41, 1)], [cuadro(0, 41, 1)]] };
  assert.match(con(multi, -2.5, 41.5), /zona prohibida res/);
  assert.match(con(multi, 0.5, 41.5), /zona prohibida res/);
  assert.doesNotMatch(con(multi, -1.5, 41.5), /zona prohibida/);
  // Polígono con hueco: dentro del anillo exterior pero dentro del hueco no cuenta
  const hueco = { type: 'Polygon', coordinates: [cuadro(-3, 41, 3), cuadro(-2, 42, 1)] };
  assert.match(con(hueco, -2.8, 41.2), /zona prohibida res/);
  assert.doesNotMatch(con(hueco, -1.5, 42.5), /zona prohibida/);
});

const truco = () => ({ texto: 'Mira en umbrías.', tipo: 'orientacion', fuentes: [{ url: 'https://x.es', fecha: null, consultado: '2026-09-30' }], confianza: 'media', cifrasOrientativas: false });

test('trucos: con fuentes, tipo y confianza válidos; solo comestibles', () => {
  const d = base(); d.especies.especies[0].trucos = [truco()];
  assert.deepEqual(validar(d), []);
  const a = base(); a.especies.especies[0].trucos = [{ ...truco(), fuentes: [] }];
  assert.match(validar(a).join('\n'), /boletus-edulis.*truco.*fuente/);
  const b = base(); b.especies.especies[0].trucos = [{ ...truco(), tipo: 'magia' }];
  assert.match(validar(b).join('\n'), /truco.*tipo/);
  const c = base(); c.especies.especies[0].trucos = [{ ...truco(), confianza: 'enorme' }];
  assert.match(validar(c).join('\n'), /truco.*confianza/);
  const e = base(); e.especies.especies[0].categoria = 'mortal'; e.especies.especies[0].sindrome = 's'; e.especies.sindromes = [{ id: 's', fuentes: [{ url: 'https://x.es', consultado: '2026-09-30' }] }];
  e.especies.especies[0].indice = null; e.especies.especies[0].trucos = [truco()];
  assert.match(validar(e).join('\n'), /comestibles llevan trucos/);
});

test('fueraDeZonaMeteo es opcional y, si está, booleano', () => {
  const a = sitio(); a.fueraDeZonaMeteo = true;
  assert.deepEqual(validar(conSitios(a)), []);
  const b = sitio(); b.fueraDeZonaMeteo = false;
  assert.deepEqual(validar(conSitios(b)), []);
  const c = sitio(); c.fueraDeZonaMeteo = 'sí';
  assert.match(validar(conSitios(c)).join('\n'), /fueraDeZonaMeteo debe ser booleano/);
});

import { validarRejillas } from '../scripts/validar-datos.mjs';
import { codificarRejilla, PROHIBIDO } from '../js/rejilla/formato.js';

const fuenteR = { nombre: 'x', url: 'https://x.es', fecha: '2026-10-01' };
const cabR = { version: 1, zona: 'soria', tam: 250, col0: 10, fila0: 20, ancho: 2, alto: 1, habitats: ['pinar-silvestre'],
  fuentes: { mfe: fuenteR, mdt: fuenteR }, generado: '2026-10-01' };
async function casoRejilla() {
  const bytes = await codificarRejilla(cabR, { habitat: Uint8Array.from([1, PROHIBIDO]), terreno: new Uint8Array(2), altitud: Int16Array.from([1200, 0]) });
  return { indice: { version: 1, archivos: [{ zona: 'soria', archivo: 'soria.bin', col0: 10, fila0: 20, ancho: 2, alto: 1, bytes: bytes.length }] },
    gruesa: { version: 1, pasos: { soria: 0.09 }, celdas: [{ id: 'soria:80:75', zona: 'soria', lon: -2.755, lat: 41.795, altRef: 1200, habitats: ['pinar-silvestre'], nFinas: 1 }] },
    zonas: { zonas: [zona()] }, bytes };
}

test('validarRejillas: una rejilla bien hecha no da errores', async () => {
  const c = await casoRejilla();
  assert.deepEqual(await validarRejillas({ ...c, leer: () => c.bytes }), []);
});

test('validarRejillas: archivo que falta, que pesa demasiado o que no es una rejilla', async () => {
  const c = await casoRejilla();
  assert.match((await validarRejillas({ ...c, leer: () => null })).join('\n'), /falta el archivo/);
  assert.match((await validarRejillas({ ...c, leer: () => c.bytes, maxBytes: 20 })).join('\n'), /KB, más de/);
  assert.match((await validarRejillas({ ...c, leer: () => new TextEncoder().encode('no soy una rejilla') })).join('\n'), /no es una rejilla/);
});

test('validarRejillas: zona inexistente en la cabecera y celda gruesa sin altitud de referencia', async () => {
  const c = await casoRejilla();
  c.zonas.zonas[0].id = 'cuenca';
  c.gruesa.celdas[0].altRef = null;
  const e = (await validarRejillas({ ...c, leer: () => c.bytes })).join('\n');
  assert.match(e, /zona inexistente soria/);
  assert.match(e, /sin altRef/);
});

test('validarRejillas: carga truncada, código de hábitat inválido y tamaño distinto del de indice.json', async () => {
  const c = await casoRejilla();
  const cortado = c.bytes.slice(0, c.bytes.length - 6);
  assert.match((await validarRejillas({ ...c, leer: () => cortado })).join('\n'), /rejilla dañada: carga ilegible o incompleta/);
  const malo = await codificarRejilla(cabR, { habitat: Uint8Array.from([7, 0]), terreno: new Uint8Array(2), altitud: new Int16Array(2) });
  assert.match((await validarRejillas({ ...c, leer: () => malo })).join('\n'), /código de hábitat 7 fuera de la cabecera/);
  c.indice.archivos[0].bytes += 1;
  assert.match((await validarRejillas({ ...c, leer: () => c.bytes })).join('\n'), /indice\.json dice \d+ bytes y el archivo tiene/);
});

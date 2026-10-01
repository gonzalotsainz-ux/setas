# Mapa con índice por ladera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un mapa a pantalla completa, al estilo de Google Maps, que colorea solo el monte apropiado de cada zona según la nota de las setas comestibles de hoy y de los próximos días, calculada por celda de 250 m con su bosque, altitud y orientación.

**Architecture:** Una rejilla fina estática (`data/rejilla/*.bin`: hábitat, altitud, orientación y pendiente cada 250 m en EPSG:3857) se genera una vez en local desde el MFE50 y un MDT. Una Edge Function `rejilla` de Supabase, lanzada por pg_cron a las 07:00 y a las 19:00 de Madrid, pide la meteo de unas 350 celdas gruesas (~0,09°) a Open-Meteo, guarda el histórico en `meteo_celdas` y publica en un bucket público los **agregados diarios del índice** de cada celda gruesa (lluvia de 26 días, tanda de lluvia, humedad del suelo, arranque, ambiente secante, temperaturas). El móvil corrige la temperatura por altitud y aplica el ajuste por orientación en cada celda fina, calcula la nota con el mismo `js/indice.js` (que pasa a vivir en `supabase/functions/_shared/` para que Deno lo importe) y la pinta en un canvas sobre Leaflet.

**Tech Stack:** HTML, CSS y JS sin framework (módulos ES, sin paso de compilación), Leaflet 1.9.4 (cdnjs con SRI), Node 24 (`node --test`), Supabase (Edge Functions en Deno, Postgres, Storage, pg_cron, pg_net, Vault), Open-Meteo, MFE50 (MITECO), MDT (IGN, Copernicus GLO-30 o Terrarium, según la tarea 0), `sharp` y `mapshaper` (ya en devDependencies) para los scripts locales.

**Spec:** `docs/superpowers/specs/2026-10-01-mapa-indice-design.md` (es la autoridad; este plan argumenta desde ella).

## Global Constraints

- Vanilla JS con módulos ES y sin paso de compilación; GitHub Pages publica `main` tal cual. Ninguna dependencia nueva en el navegador.
- Pruebas: Node 24, `node --test tests/*.test.js`. Gancho pre-push: `npm run comprobar` (pruebas + `scripts/validar-datos.mjs`); el validador comprueba también la cabecera y el tamaño de cada rejilla.
- Leaflet 1.9.4 de cdnjs con SRI, cargado con `cargarLeaflet()` de `js/mapa.js` (la URL ESM de cdnjs no existe).
- Celdas finas de **250 m en EPSG:3857** alineadas a la malla de teselas; celdas gruesas de **~0,09°** (la tarea 8 puede subir el paso si hay más de 350, ver criterio).
- Ejecuciones a las **07:00 y 19:00 Europe/Madrid**; **a lo sumo unas 1.000 llamadas ponderadas al día** a Open-Meteo (límite gratuito 10.000).
- **No se publica** un archivo nuevo si menos del **90 %** de las celdas gruesas tiene datos; se queda el anterior.
- Corrección por altitud: **−0,65 °C por cada 100 m** respecto a la altitud de referencia de la celda gruesa.
- El índice diario descargado se **cachea 3 h** igual que `js/cache.js`.
- Objetivo de tamaño: **menos de 300 KB por archivo de rejilla** (el archivo ya va comprimido con gzip).
- Pintado en un **Web Worker** si medirlo en un móvil medio da **más de unos 200 ms**.
- Fondos: Mapa = **CARTO Voyager** con la atribución obligatoria **«© OpenStreetMap © CARTO»** (fondo por defecto); Relieve = Voyager + IDEE `mdt` capa `Relieve` en *multiply*; **Topográfico IGN** (`mapa-raster` MTN); **Satélite PNOA** (`pnoa-ma` OI.OrthoimageCoverage). **Ojo:** CARTO pide ya una clave (tarea 0, D7); sin clave, el fondo claro es la Base IGN (`ign-base` `IGNBaseTodo`) hasta que la usuaria decida.
- Nunca se colorea una celda con `habitat = 0` ni dentro de un polígono `prohibido` de `data/cotos.geojson`.
- Hoy, Zona y las fichas no cambian.
- Textos de la interfaz en español, sin guiones largos; objetivos táctiles de 44 px o más; foco visible; `prefers-reduced-motion` respetado; las hojas mueven el foco al abrirse y lo devuelven al cerrarse, y se cierran con Escape.
- Colores de la interfaz con tokens de `css/tokens.css`; las capas del mapa usan los colores fijos de `NIVEL_COLOR` y `COLOR` de `js/mapa.js` (regla ya vigente para capas sobre teselas).
- `MODELOS` de `js/meteo.js` es `['ecmwf_ifs', 'icon_seamless', 'gfs_seamless']` (solo para el contraste de lluvia de Hoy y Zona). La nota sale de la serie principal (`best_match`), igual en la app y en la función.
- Supabase: ningún token ni clave en el repo, en documentos ni en commits. **Toda tarea que despliegue (migración, secretos, función, pg_cron) necesita un token nuevo de Supabase y la autorización explícita de la usuaria en ese momento: el controlador se para ahí y pregunta.**
- Cada tarea termina con un commit en español cuyo mensaje acaba con estas dos líneas exactas:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo`
- Se trabaja en una rama (no en `main`): Pages publica `main` al instante y las tareas intermedias dejan el mapa a medias. La integración la decide el controlador al final.

## Review Focus

1. **Índice de ayer** (la función no pudo publicar): sus `fechas` empiezan ayer; la barra de días tiene que elegir por fecha, no por posición, y nunca enseñar ayer como «Hoy».
2. **Open-Meteo responde 429 o falla en un trozo** (IP de salida compartida): reintento con espera; si sigue fallando, esas celdas se quedan como estaban y, bajo el 90 %, no se publica y sigue valiendo el archivo anterior.
3. **Cambio de hora** (25/10/2026): pg_cron trabaja en UTC; la función solo debe ejecutar a las 07:00 y 19:00 de Madrid, y el aviso «Datos de ayer a las 19:00» no debe saltar por error esa mañana.
4. **Almacenamiento local lleno o bloqueado** (Safari privado, cuota): el índice no cabe en la caché; el mapa tiene que pintarse igual sin caché.
5. **Fila mala en `ajustes_umbrales`** (RLS abierto, se puede escribir a mano): las manchas tienen que ignorarla igual que Hoy y Zona (vía `especiesDeZona`), no romperse ni pintar notas absurdas.

---

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `supabase/functions/_shared/indice.js` | Índice (antes `js/indice.js`), dividido en `agregadosDia` + `indiceDesdeAgregados` |
| `supabase/functions/_shared/meteo.js`, `cache.js`, `umbrales.js` | Movidos desde `js/` para que Deno los importe |
| `supabase/functions/_shared/salida-indice.js` | Formato del índice diario publicado (empaquetar y desempaquetar) |
| `js/indice.js`, `js/meteo.js`, `js/cache.js`, `js/umbrales.js`, `js/rejilla/salida.js` | Reexportaciones de una línea hacia `_shared` |
| `.nojekyll` | Para que GitHub Pages sirva `supabase/functions/_shared/` (Jekyll ignora las carpetas con `_`) |
| `js/rejilla/geo.js` | EPSG:3857, celdas finas y gruesas |
| `js/rejilla/formato.js` | Codificador y decodificador binario de la rejilla fina |
| `js/rejilla/orientacion.js` | Ajuste orientativo de humedad por orientación |
| `js/rejilla/nota.js` | Corrección por altitud y nota por celda fina |
| `js/rejilla/carga.js` | Descarga del índice diario y de las rejillas visibles, avisos de antigüedad |
| `js/rejilla/pintor.js` | Notas por celda y colores (sin DOM) |
| `js/rejilla/notas-async.js`, `js/rejilla/trabajador.js` | Cálculo de notas en el hilo principal o en un Web Worker (si la medida lo pide) |
| `js/mapa/capa-rejilla.js` | Capa canvas de Leaflet |
| `js/mapa/fondos.js` | Fondos, capas superpuestas, preferencias y panel de capas |
| `js/mapa/hoja.js` | Hoja inferior arrastrable de una celda |
| `js/mapa/controles.js` | Buscador, chips de temporada y barra de días |
| `js/pantallas/mapa.js` | Pantalla completa (se reescribe) |
| `scripts/rejilla/config.mjs` | Decisiones del sondeo (fuentes, campos, trozos, lotes) |
| `scripts/rejilla/sondeo.mjs` | Sondeo en vivo de la tarea 0 |
| `scripts/rejilla/mfe-habitat.mjs` | Del MFE50 al hábitat |
| `scripts/rejilla/terreno.mjs`, `scripts/rejilla/mdt.mjs` | Altitud media, orientación, pendiente y lectura del MDT |
| `scripts/rejilla/generar.mjs` | Genera `data/rejilla/` |
| `scripts/rejilla/pueblos.mjs` | Genera `data/pueblos.json` |
| `scripts/rejilla/medir-pintado.mjs` | Mide el pintado del archivo más grande |
| `data/rejilla/indice.json`, `gruesa.json`, `*.bin`; `data/pueblos.json` | Datos estáticos generados |
| `supabase/functions/rejilla/nucleo.js` | Lógica pura: horario, presupuesto, planificador, series, regla del 90 % |
| `supabase/functions/rejilla/manejador.js` | Una ejecución completa con dependencias inyectadas |
| `supabase/functions/rejilla/index.ts` | Entrada de Deno |
| `supabase/functions/rejilla/gruesa.json` | Copia generada de `data/rejilla/gruesa.json` |
| `supabase/migrations/20261002000000_rejilla.sql` | Tablas, vista, función SQL, bucket y limpieza |
| `docs/investigacion/08-rejilla-fuentes.md` | Informe del sondeo |
| `docs/datos.md` | Tabla MFE → hábitat, ajuste por orientación, formato de la rejilla y del índice, tamaños |

---

### Task 0: Sondeo de fuentes y límites

Sondeo documentado: no se escribe código de producto. Fija las decisiones que el resto del plan lee de `scripts/rejilla/config.mjs`. Las tareas 5, 6, 8, 11, 12 y 18 tienen una prueba que falla mientras la configuración siga sin rellenar.

**Files:**
- Create: `scripts/rejilla/sondeo.mjs`
- Create: `scripts/rejilla/config.mjs`
- Create: `docs/investigacion/08-rejilla-fuentes.md`
- Create: `scripts/rejilla/mfe-diccionario.json`, `scripts/rejilla/mfe-muestra.json`
- Test: `tests/rejilla-config.test.js`

**Interfaces:**
- Consumes: `data/zonas.json` (`zonas[].bbox`, `zonas[].provincias`); `DIARIAS`, `HORARIAS` de `js/meteo.js`.
- Produces: `CONFIG` exportado por `scripts/rejilla/config.mjs` con esta forma exacta (las tareas siguientes leen estas claves):
  `CONFIG.mdt = { fuente: 'ign-wcs'|'glo30'|'terrarium', z, plantillaUrl, nombre, url, licencia, atribucion, fecha }`,
  `CONFIG.mfe = { nombre, url, licencia, atribucion, fecha, carpeta, archivos: { [provincia]: ruta }, campos: { especies: string[], fcc: string, tipo: string }, tipos: { arbolado: string[], herbazal: string[], matorral: string[] }, matorralJaral: string[] }`,
  `CONFIG.pueblos = { nombre, url, licencia, fecha, archivo, columnas: { nombre, provincia, lat, lon } }`,
  `CONFIG.openMeteo = { trozo, maxPasados }`, `CONFIG.supabase = { lotes }`,
  `CONFIG.gruesa = { candidatos: [0.09, 0.12, 0.15, 0.18], maximo: 350 }`, `CONFIG.maxBytesArchivo = 307200`.

- [ ] **Step 1: Escribir la prueba que exige la configuración completa**

```js
// tests/rejilla-config.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CONFIG } from '../scripts/rejilla/config.mjs';

const lleno = (v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

test('el sondeo dejó elegido el MDT con licencia, atribución y fecha', () => {
  assert.ok(['ign-wcs', 'glo30', 'terrarium'].includes(CONFIG.mdt.fuente));
  for (const k of ['nombre', 'url', 'licencia', 'atribucion']) assert.ok(lleno(CONFIG.mdt[k]), `mdt.${k}`);
  assert.match(CONFIG.mdt.fecha ?? '', FECHA);
});

test('el sondeo dejó el MFE50 con campos, tipos y un archivo por provincia de las zonas', () => {
  for (const k of ['nombre', 'url', 'licencia', 'atribucion', 'carpeta']) assert.ok(lleno(CONFIG.mfe[k]), `mfe.${k}`);
  assert.match(CONFIG.mfe.fecha ?? '', FECHA);
  assert.ok(lleno(CONFIG.mfe.campos.especies) && lleno(CONFIG.mfe.campos.fcc) && lleno(CONFIG.mfe.campos.tipo));
  for (const t of ['arbolado', 'herbazal', 'matorral']) assert.ok(Array.isArray(CONFIG.mfe.tipos[t]), `tipos.${t}`);
  const provincias = new Set(JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas.flatMap((z) => z.provincias));
  for (const p of provincias) assert.ok(lleno(CONFIG.mfe.archivos[p]), `falta el archivo del MFE50 de ${p}`);
  assert.ok(existsSync('scripts/rejilla/mfe-diccionario.json') && existsSync('scripts/rejilla/mfe-muestra.json'));
});

test('el sondeo dejó Open-Meteo, Supabase, pueblos y límites', () => {
  assert.ok(Number.isInteger(CONFIG.openMeteo.trozo) && CONFIG.openMeteo.trozo >= 10);
  assert.ok(Number.isInteger(CONFIG.openMeteo.maxPasados) && CONFIG.openMeteo.maxPasados >= 61);
  assert.ok(Number.isInteger(CONFIG.supabase.lotes) && CONFIG.supabase.lotes >= 1 && CONFIG.supabase.lotes <= 10);
  for (const k of ['nombre', 'url', 'licencia', 'archivo']) assert.ok(lleno(CONFIG.pueblos[k]), `pueblos.${k}`);
  for (const k of ['nombre', 'provincia', 'lat', 'lon']) assert.ok(lleno(CONFIG.pueblos.columnas[k]), `pueblos.columnas.${k}`);
  assert.deepEqual(CONFIG.gruesa.candidatos, [0.09, 0.12, 0.15, 0.18]);
  assert.equal(CONFIG.maxBytesArchivo, 300 * 1024);
});
```

- [ ] **Step 2: Crear la configuración vacía y comprobar que la prueba falla**

```js
// scripts/rejilla/config.mjs
// Decisiones del sondeo (docs/investigacion/08-rejilla-fuentes.md, tarea 0). Se cambian aquí, no en el código.
// Las rutas de `_fuentes/` son descargas locales en bruto (no van al repo).
export const CONFIG = {
  mdt: { fuente: null, z: null, plantillaUrl: null, nombre: null, url: null, licencia: null, atribucion: null, fecha: null },
  mfe: {
    nombre: null, url: null, licencia: null, atribucion: null, fecha: null, carpeta: '_fuentes/mfe50', archivos: {},
    campos: { especies: [], fcc: null, tipo: null }, tipos: { arbolado: [], herbazal: [], matorral: [] }, matorralJaral: [],
  },
  pueblos: { nombre: null, url: null, licencia: null, fecha: null, archivo: null, columnas: { nombre: null, provincia: null, lat: null, lon: null } },
  openMeteo: { trozo: null, maxPasados: null },
  supabase: { lotes: null },
  gruesa: { candidatos: [0.09, 0.12, 0.15, 0.18], maximo: 350 },
  maxBytesArchivo: 300 * 1024,
};
```

Run: `node --test tests/rejilla-config.test.js`
Expected: FAIL en los tres casos (`mdt`, `mfe`, `openMeteo`).

- [ ] **Step 3: Escribir el script de sondeo en vivo**

```js
// scripts/rejilla/sondeo.mjs
// Sondeo de la tarea 0: comprueba en vivo qué responde, cuánto tarda y cuánto pesa. No guarda nada en el repo.
// Uso: node scripts/rejilla/sondeo.mjs > _fuentes/sondeo.md   (se copia lo relevante al informe 08)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DIARIAS, HORARIAS } from '../../js/meteo.js';

const ZONA = 'Europe/Madrid';
const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;

// Puntos repartidos de forma determinista por los bbox de las zonas.
export function puntosDePrueba(zs, n) {
  const r = [];
  for (let k = 0; r.length < n; k++) {
    const z = zs[k % zs.length], t = (k * 0.618034) % 1, u = (k * 0.414214) % 1;
    r.push({ lat: +(z.bbox[1] + t * (z.bbox[3] - z.bbox[1])).toFixed(3), lon: +(z.bbox[0] + u * (z.bbox[2] - z.bbox[0])).toFixed(3), altitud: 1000 });
  }
  return r;
}
const lista = (ps, k) => ps.map((p) => p[k]).join(',');
const principal = (ps, pasados, futuros = 10) => `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
  latitude: lista(ps, 'lat'), longitude: lista(ps, 'lon'), elevation: lista(ps, 'altitud'), timezone: ZONA,
  daily: DIARIAS.join(','), hourly: HORARIAS.join(','), past_days: pasados, forecast_days: futuros })}`;
const archivoSuelo = (ps, desde, hasta) => `https://archive-api.open-meteo.com/v1/archive?${new URLSearchParams({
  latitude: lista(ps, 'lat'), longitude: lista(ps, 'lon'), elevation: lista(ps, 'altitud'), timezone: ZONA,
  daily: 'soil_moisture_0_to_7cm_mean', start_date: desde, end_date: hasta })}`;
const tesela = (lon, lat, z) => {
  const n = 2 ** z, x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
  return { x, y };
};

async function medir(nombre, url, { metodo = 'GET', leer = null } = {}) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { method: metodo, signal: AbortSignal.timeout(90000) });
    const cuerpo = metodo === 'HEAD' ? '' : await r.text();
    return { nombre, estado: r.status, ms: Math.round(performance.now() - t0), bytes: Number(r.headers.get('content-length')) || cuerpo.length,
      tipo: r.headers.get('content-type') ?? '', urlLen: url.length, extra: leer ? leer(cuerpo, r) : '' };
  } catch (e) {
    return { nombre, estado: 'error', ms: Math.round(performance.now() - t0), bytes: 0, tipo: '', urlLen: url.length, extra: e.message };
  }
}
const cuantos = (t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? `${j.length} ubicaciones` : j.error ? `error: ${j.reason}` : '1 ubicación'; } catch { return ''; } };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const filas = [];
  for (const n of [50, 100, 200, 500]) filas.push(await medir(`Open-Meteo forecast, ${n} puntos, 2+10 días`, principal(puntosDePrueba(zonas, n), 2), { leer: cuantos }));
  const uno = puntosDePrueba(zonas, 1);
  for (const p of [61, 92, 93]) filas.push(await medir(`Open-Meteo forecast, 1 punto, past_days=${p}`, principal(uno, p), { leer: cuantos }));
  filas.push(await medir('Open-Meteo archivo, 50 puntos, suelo 122 días', archivoSuelo(puntosDePrueba(zonas, 50), '2025-09-01', '2025-12-31'), { leer: cuantos }));
  const t = tesela(-3.9943, 40.853, 12);
  filas.push(await medir('Terrarium z12 (Valsaín)', `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/${t.x}/${t.y}.png`));
  filas.push(await medir('Copernicus GLO-30 N40 W004 (HEAD)', 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N40_00_W004_00_DEM/Copernicus_DSM_COG_10_N40_00_W004_00_DEM.tif', { metodo: 'HEAD' }));
  filas.push(await medir('IGN WCS mdt GetCapabilities', 'https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&REQUEST=GetCapabilities',
    { leer: (c) => [...c.matchAll(/<wcs:CoverageId>([^<]+)<\/wcs:CoverageId>/g)].map((m) => m[1]).join(', ').slice(0, 300) }));
  filas.push(await medir('IDEE mdt Relieve z16 (WMTS)', `https://servicios.idee.es/wmts/mdt?service=WMTS&request=GetTile&version=1.0.0&layer=Relieve&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&tilematrix=16&tilerow=${tesela(-3.9943, 40.853, 16).y}&tilecol=${tesela(-3.9943, 40.853, 16).x}`));
  filas.push(await medir('CARTO Voyager z12', `https://a.basemaps.cartocdn.com/rastertiles/voyager/12/${t.x}/${t.y}.png`));
  console.log('| Prueba | Estado | ms | Bytes | Tipo | Long. URL | Detalle |\n|---|---|---|---|---|---|---|');
  for (const f of filas) console.log(`| ${f.nombre} | ${f.estado} | ${f.ms} | ${f.bytes} | ${f.tipo} | ${f.urlLen} | ${String(f.extra).replace(/\|/g, '/')} |`);
}
```

- [ ] **Step 4: Ejecutar el sondeo y guardar el resultado en bruto**

Run: `mkdir -p _fuentes && node scripts/rejilla/sondeo.mjs > _fuentes/sondeo.md && cat _fuentes/sondeo.md`
Expected: una tabla con una fila por prueba. Si una petición de Open-Meteo devuelve 429, esperar 2 minutos y repetir solo esa (no insistir: la IP es la de la usuaria).

- [ ] **Step 5: Investigar lo que no se mide con una petición y escribir el informe**

Escribir `docs/investigacion/08-rejilla-fuentes.md` con estas secciones, cada afirmación con su URL y la fecha de consulta (formato de los informes 01 a 07 de la carpeta: «[EVIDENCIA]», «[NO VERIFICADO]»). Cada sección acaba con una línea **Decisión:** que copia lo que va a `config.mjs`.

1. **D1. MFE50 por provincia.** Página de descarga de MITECO (Banco de Datos de la Naturaleza) para Madrid, Segovia, Ávila, Soria, Burgos, Guadalajara, Cuenca, Toledo, Álava, Cáceres y Badajoz: formato (shapefile en ZIP), sistema de referencia, tamaño de cada ZIP, si la descarga es un enlace directo o pide formulario, licencia de reutilización y texto de atribución. Abrir un ZIP (Soria, por ejemplo) con `npx mapshaper -i <archivo>.shp -info` y anotar los nombres reales de los campos de especie dominante (y segunda), fracción de cabida cubierta arbolada y tipo de estructura o formación. Guardar el diccionario de códigos de especie → nombre científico (del documento de descripción de campos del MFE) en `scripts/rejilla/mfe-diccionario.json` como `{ "<código>": "<Nombre científico>" }`, y una muestra de 20 teselas reales (sus `properties`, de al menos 3 provincias) en `scripts/rejilla/mfe-muestra.json` como `[{ "provincia": "Soria", "properties": { … } }]`. Anotar si existe el MFE25 para alguna provincia (solo como dato; la spec manda el MFE50).
   **Criterio:** se usa la descarga que se pueda automatizar. Si MITECO solo da la descarga con pasos manuales, se escriben en el informe paso a paso para que la usuaria los haga una vez y deje los ZIP en `_fuentes/mfe50/<provincia>/` (el controlador se para y se lo pide). Cada ZIP se convierte con `npx mapshaper -i <shp> -proj wgs84 -filter-fields <campos> -o format=geojson _fuentes/mfe50/<provincia>.geojson` y esa ruta va a `CONFIG.mfe.archivos[<provincia>]`. Los valores de `CONFIG.mfe.tipos` son los valores reales del campo de tipo que corresponden a arbolado, a herbazal o pastizal y a matorral; `CONFIG.mfe.matorralJaral` es la lista de especies de matorral del diccionario que son jaras (*Cistus*), vacía si el MFE50 no detalla el matorral.
2. **D2. Modelo digital del terreno.** Comparar IGN/CNIG (MDT25 o MDT05 por descarga, y el servicio WCS `servicios.idee.es/wcs-inspire/mdt`: si `GetCoverage` devuelve un GeoTIFF por bbox desde un script), Copernicus DEM GLO-30 en AWS (teselas COG de 1°) y Terrarium (AWS Terrain Tiles, PNG en EPSG:3857). Por cada una: si se automatiza, resolución, licencia, atribución exacta y volumen para los bbox de las 11 zonas.
   **Criterio:** (1) se puede bajar con un script, sin formularios; (2) la licencia permite publicar datos derivados en un repo público con atribución; (3) resolución de 90 m o mejor. Entre las que cumplen, por este orden: IGN (oficial, CC BY 4.0), GLO-30, Terrarium. **Decisión:** `CONFIG.mdt.fuente` y, para IGN o GLO-30, `CONFIG.mdt.plantillaUrl` con `{oeste}`, `{sur}`, `{este}`, `{norte}` (IGN WCS, bbox en EPSG:3857) o `{lat}`, `{lon}` (nombre de tesela GLO-30). Para Terrarium, `z: 12`.
3. **D3. Open-Meteo multipunto.** Con la tabla del paso 4: cuántas ubicaciones admite una petición (y si falla por longitud de URL), el máximo real de `past_days` (92 si `past_days=93` da error) y si Open-Meteo publica cómo pondera las peticiones de varios puntos (si no, se mantiene la estimación de `docs/datos.md`: `puntos × max(1, variables/10) × max(1, días/14)`).
   **Decisión:** `CONFIG.openMeteo.trozo` = el mayor de 50, 100 o 200 que respondió 200 en menos de 30 s; `CONFIG.openMeteo.maxPasados` = el máximo de `past_days` comprobado.
4. **D4. Supabase, plan gratuito.** De la documentación oficial (con URL): límites de las Edge Functions (tiempo de CPU por petición, tiempo de reloj, memoria), tareas en segundo plano con `EdgeRuntime.waitUntil` y su límite, disponibilidad de `pg_cron`, `pg_net` y Vault en el plan gratuito y cómo se activan, límites de Storage (tamaño por archivo, total) y de la base de datos (500 MB). Estimar el tamaño de `meteo_celdas` (350 celdas × 400 días × 1 fila de unos 100 bytes). Medir la CPU de una ejecución: con Node, calcular `calcularIndice` de `js/indice.js` sobre 350 series sintéticas (`serieSintetica` de `tests/ayudas.js`) × 12 especies × 10 días y anotar los milisegundos.
   **Criterio:** `CONFIG.supabase.lotes` = 1 si la medida en Node es menor de la mitad del límite de CPU; si no, `Math.ceil(2 × ms / límite)` (cada lote es una invocación de pg_cron a otro minuto).
5. **D5. Pueblos para el buscador.** Fuente descargable de núcleos de población con coordenadas (por ejemplo, el Nomenclátor Geográfico de Municipios y Entidades de Población del CNIG): URL, formato, licencia, nombres de columnas de nombre, provincia, latitud y longitud. Guardar la descarga en `_fuentes/pueblos/`.
   **Decisión:** `CONFIG.pueblos` completo, con `archivo` = la ruta local del CSV.
6. **D6. Atribuciones.** Texto exacto que debe verse en el mapa y en Ajustes para CARTO, IGN, IDEE, el MDT elegido, el MFE50 y la fuente de pueblos.
7. **D7. Fondo claro (CARTO).** Comprobado al escribir este plan (01/10/2026): `https://a.basemaps.cartocdn.com/rastertiles/voyager/12/2002/1537.png` responde **200 pero con una imagen de 2.049 bytes que dice «API KEY REQUIRED»** (con y sin `Referer`, también con el de `gonzalotsainz-ux.github.io`): el «responden 200» de la spec no basta. Leer `https://carto.com/basemaps/apikey` y anotar si hay clave gratuita para una web personal, si puede ir pública en el cliente, cómo se pasa en la URL de las teselas y qué atribución pide. La fila «CARTO Voyager z12» de la tabla del paso 4 tiene que pesar más de 5 KB para valer.
   **Decisión (la toma la usuaria; el controlador se lo pregunta):** CARTO con clave (si es gratuita y se puede publicar) o la **Base IGN** (`https://www.ign.es/wmts/ign-base`, capa `IGNBaseTodo`, CC BY 4.0, sin clave; comprobada el 01/10/2026 hasta z18) como fondo «Mapa». La tarea 16 la aplica con la constante `CARTO_URL` de `js/mapa/fondos.js` (`null` = Base IGN).

- [ ] **Step 6: Rellenar `scripts/rejilla/config.mjs` con las decisiones**

Copiar cada línea **Decisión:** del informe a su clave de `CONFIG` (misma forma que en el paso 2; solo cambian los valores `null`, `[]` y `{}`). Ninguna clave nueva.

- [ ] **Step 7: Ejecutar la prueba**

Run: `node --test tests/rejilla-config.test.js`
Expected: PASS (3 pruebas).

- [ ] **Step 8: Commit**

```bash
git add scripts/rejilla/sondeo.mjs scripts/rejilla/config.mjs scripts/rejilla/mfe-diccionario.json scripts/rejilla/mfe-muestra.json docs/investigacion/08-rejilla-fuentes.md tests/rejilla-config.test.js
git commit -m "$(cat <<'EOF'
Rejilla: sondeo de fuentes (MFE50, MDT, Open-Meteo, Supabase, pueblos) y decisiones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 1: Índice en dos pasos (agregados del día y nota por especie), con la nota actual fijada

La fórmula se divide sin cambiar ningún resultado: `agregadosDia(serie, i)` calcula lo que no depende de la especie (lluvia de 26 días, mayor tanda de 3 días y su desfase, percentil del suelo, lluvia desde el 1 de agosto, ambiente secante, temperaturas medias de 20 días y mínimas de 7 días) e `indiceDesdeAgregados(ag, especie)` hace el resto. Así la función de Supabase publica solo agregados (son los mismos para todas las especies) y el móvil corrige la temperatura por altitud antes del segundo paso. Una referencia JSON, generada **con el código de antes**, fija las notas actuales.

**Files:**
- Create: `tests/casos-indice.js`
- Create: `scripts/fijar-referencia-indice.mjs`
- Create: `tests/fixtures/indice-referencia.json` (generado)
- Create: `tests/indice-referencia.test.js`
- Modify: `js/indice.js` (todo el archivo a partir de la línea 50, `calcularIndice`)
- Modify: `tests/indice.test.js` (añadir al final)

**Interfaces:**
- Consumes: `serieSintetica`, `BOLETUS`, `NISCALO`, `MORCHELLA`, `lluviaBuena` de `tests/ayudas.js`.
- Produces (en `js/indice.js`, y desde la tarea 2 en `supabase/functions/_shared/indice.js`):
  - `agregadosDia(serie, i) → { fecha, prevision, P26, P3, lag, pct, Pagosto, secante, T20aire, T20suelo, tmin7 }` (números o `null`; `secante` booleano o `null`; `tmin7` es un array de 7 números o `null`). Lanza `DatosIncompletos` solo si `i` está fuera de la serie o le faltan 30 días de historia.
  - `indiceDesdeAgregados(ag, especie, { ajusteHumedad = 1, explicar = true } = {}) → resultado` con la misma forma que `calcularIndice`. Lanza `DatosIncompletos` si falta un agregado que la especie necesita. `ajusteHumedad` multiplica `fW` (recortado a 0–1); `explicar: false` deja `explicacion: []` (pintado rápido).
  - `calcularIndice(serie, i, especie)` sigue con la misma firma y el mismo resultado.

- [ ] **Step 1: Escribir los casos de referencia**

```js
// tests/casos-indice.js
// Casos fijos del índice: series sintéticas × especies × días. La referencia (fixtures/indice-referencia.json) se
// generó con el código ANTERIOR a la división en agregados; cualquier cambio de nota hace fallar la prueba.
import { calcularIndice } from '../js/indice.js';
import { serieSintetica, BOLETUS, NISCALO, MORCHELLA, lluviaBuena } from './ayudas.js';

const VERANO = { id: 'verano-prueba', temporada: { meses: [6, 7, 8, 9, 10], tipo: 'verano' },
  indice: { topt: 16, trango: [12, 20], usarSuelo: false, pmin: 40, pfull: 100, desfase: [5, 15], helada: 'nula', confianza: 'media' } };
const ALTA = { ...NISCALO, id: 'helada-alta', indice: { ...NISCALO.indice, helada: 'alta' } };
export const ESPECIES_CASO = [BOLETUS, NISCALO, MORCHELLA, VERANO, ALTA];

export const SERIES_CASO = {
  humeda: () => serieSintetica({ precip: lluviaBuena }),
  sequia: () => serieSintetica({ precip: () => 0 }),
  constante: () => serieSintetica({ precip: () => 2 }),
  helada: () => serieSintetica({ precip: lluviaBuena, tmin: (k) => (k === 57 ? -4 : k === 55 ? -1 : 6) }),
  calor: () => serieSintetica({ precip: lluviaBuena, tmedia: () => 22 }),
  secante: () => serieSintetica({ precip: lluviaBuena, et0: () => 6, hr: () => 40 }),
  sinSuelo: () => serieSintetica({ precip: lluviaBuena, pct: () => null }),
  sinAgosto: () => serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena, lluviaAntes: null }),
  sinTsuelo: () => serieSintetica({ precip: lluviaBuena, tsuelo: (k) => (k === 50 ? null : 13) }),
  primavera: () => serieSintetica({ inicio: '2026-02-15', precip: lluviaBuena, tmedia: () => 9, tsuelo: () => 12, lluviaAntes: null }),
  prevision: () => serieSintetica({ dias: 70, hoy: 59, precip: (k) => (k >= 60 ? 8 : lluviaBuena(k)) }),
  huecoTmin: () => serieSintetica({ precip: lluviaBuena, tmin: (k) => (k === 58 ? null : 6) }),
};
export const DIAS_CASO = [10, 29, 45, 59, 66];

export function casosIndice() {
  const r = [];
  for (const [nombre, fabrica] of Object.entries(SERIES_CASO)) {
    for (const especie of ESPECIES_CASO) for (const i of DIAS_CASO) r.push({ clave: `${nombre}|${especie.id}|${i}`, serie: fabrica(), especie, i });
  }
  return r;
}

// Resultado comparable de un caso: el del índice, o el nombre del error que lanza.
export function resultadoCaso({ serie, i, especie }) {
  try { return JSON.parse(JSON.stringify(calcularIndice(serie, i, especie))); } catch (e) { return { error: e.constructor.name }; }
}
```

- [ ] **Step 2: Escribir el script que guarda la referencia**

```js
// scripts/fijar-referencia-indice.mjs
// Guarda en tests/fixtures/indice-referencia.json el resultado de cada caso de tests/casos-indice.js con el índice ACTUAL.
// Solo se ejecuta para fijar una referencia nueva a propósito (p. ej. antes de reorganizar js/indice.js).
import { writeFileSync, mkdirSync } from 'node:fs';
import { casosIndice, resultadoCaso } from '../tests/casos-indice.js';

const salida = Object.fromEntries(casosIndice().map((c) => [c.clave, resultadoCaso(c)]));
mkdirSync('tests/fixtures', { recursive: true });
writeFileSync('tests/fixtures/indice-referencia.json', `${JSON.stringify(salida, null, 1)}\n`);
console.log(`${Object.keys(salida).length} casos guardados en tests/fixtures/indice-referencia.json`);
```

- [ ] **Step 3: Generar la referencia con el código actual (sin tocar todavía `js/indice.js`)**

Run: `git diff --quiet js/indice.js && node scripts/fijar-referencia-indice.mjs`
Expected: `300 casos guardados en tests/fixtures/indice-referencia.json` (12 series × 5 especies × 5 días). Si `git diff` no está limpio, parar: la referencia tiene que salir del código de `main`.

- [ ] **Step 4: Escribir la prueba de no regresión y comprobar que pasa con el código actual**

```js
// tests/indice-referencia.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { casosIndice, resultadoCaso } from './casos-indice.js';

const referencia = JSON.parse(readFileSync(new URL('./fixtures/indice-referencia.json', import.meta.url), 'utf8'));

test('las notas, factores, datos y frases del índice no cambian (referencia fijada antes de dividirlo)', () => {
  const casos = casosIndice();
  assert.equal(casos.length, Object.keys(referencia).length);
  for (const c of casos) assert.deepStrictEqual(resultadoCaso(c), referencia[c.clave], c.clave);
});
```

Run: `node --test tests/indice-referencia.test.js`
Expected: PASS.

- [ ] **Step 5: Escribir las pruebas nuevas de los dos pasos (fallan: las funciones no existen)**

Añadir al final de `tests/indice.test.js`:

```js
import { agregadosDia, indiceDesdeAgregados } from '../js/indice.js';

test('agregadosDia: lo que no depende de la especie, con números exactos', () => {
  const ag = agregadosDia(serieSintetica({ precip: lluviaBuena }), 59);
  assert.equal(ag.fecha, '2026-10-18');
  assert.equal(ag.prevision, false);
  assert.equal(ag.P26, 106);
  assert.equal(ag.P3, 60);
  assert.equal(ag.lag, 17);
  assert.equal(ag.pct, 60);
  assert.equal(ag.Pagosto, 194);            // 20 mm antes de la serie + 57 × 2 + 3 × 20
  assert.equal(ag.secante, false);
  assert.equal(ag.T20aire, 13);
  assert.equal(ag.T20suelo, 13);
  assert.deepEqual(ag.tmin7, [6, 6, 6, 6, 6, 6, 6]);
});

test('agregadosDia: un hueco deja null en lo que lo usa, sin lanzar', () => {
  const ag = agregadosDia(serieSintetica({ precip: lluviaBuena, tsuelo: (k) => (k === 50 ? null : 13), tmin: (k) => (k === 58 ? null : 6) }), 59);
  assert.equal(ag.T20suelo, null);
  assert.equal(ag.T20aire, 13);
  assert.equal(ag.tmin7[5], null);
  assert.throws(() => agregadosDia(serieSintetica(), 10), DatosIncompletos);
});

test('indiceDesdeAgregados da lo mismo que calcularIndice', () => {
  const s = serieSintetica({ precip: lluviaBuena });
  for (const sp of [BOLETUS, NISCALO]) assert.deepStrictEqual(indiceDesdeAgregados(agregadosDia(s, 59), sp), calcularIndice(s, 59, sp));
});

test('indiceDesdeAgregados: explicar=false da la misma nota sin frases', () => {
  const ag = agregadosDia(serieSintetica({ precip: lluviaBuena }), 59);
  const r = indiceDesdeAgregados(ag, BOLETUS, { explicar: false });
  assert.equal(r.valor, 96);
  assert.deepEqual(r.explicacion, []);
});

test('indiceDesdeAgregados: el ajuste de humedad multiplica fW y lo recorta a 1', () => {
  const ag = agregadosDia(serieSintetica({ precip: () => 2 }), 59);   // P26 = 52 → fW = (52 − 30) / 60
  const sin = indiceDesdeAgregados(ag, BOLETUS), con = indiceDesdeAgregados(ag, BOLETUS, { ajusteHumedad: 1.1 });
  assert.ok(Math.abs(sin.factores.fW - 22 / 60) < 1e-12);
  assert.ok(Math.abs(con.factores.fW - (22 / 60) * 1.1) < 1e-12);
  assert.ok(con.valor > sin.valor);
  const humedo = agregadosDia(serieSintetica({ precip: lluviaBuena }), 59);
  assert.equal(indiceDesdeAgregados(humedo, BOLETUS, { ajusteHumedad: 1.15 }).factores.fW, 1);
});

test('indiceDesdeAgregados: sin temperatura del suelo falla Morchella pero no el boletus', () => {
  const ag = { ...agregadosDia(serieSintetica({ inicio: '2026-02-15', precip: lluviaBuena, lluviaAntes: null }), 59), T20suelo: null };
  assert.throws(() => indiceDesdeAgregados(ag, MORCHELLA), DatosIncompletos);
  assert.doesNotThrow(() => indiceDesdeAgregados({ ...agregadosDia(serieSintetica({ precip: lluviaBuena }), 59), T20suelo: null }, BOLETUS));
});
```

Run: `node --test tests/indice.test.js`
Expected: FAIL con `SyntaxError: The requested module '../js/indice.js' does not provide an export named 'agregadosDia'`.

- [ ] **Step 6: Dividir `calcularIndice` en `agregadosDia` + `indiceDesdeAgregados`**

En `js/indice.js`, sustituir desde `export function calcularIndice(serie, i, especie) {` hasta su llave de cierre (líneas 50 a 113) por el bloque siguiente. El resto del archivo (constantes, `dato`, `lluvia`, `sumaLluvia`, `media`, `calendario`, `enTemporada`, `diaAnterior`, `lluviaDesdeAgosto` e `indiceZona`) no cambia.

```js
const intento = (f) => { try { return f(); } catch (e) { if (e instanceof DatosIncompletos) return null; throw e; } };

// Paso 1 (no depende de la especie): agregados del día i. Cada uno es null si le faltan datos; la especie que lo
// necesite dará DatosIncompletos en el paso 2. Es lo que publica el precálculo de Supabase por celda gruesa.
export function agregadosDia(serie, i) {
  if (i < HISTORIA_MINIMA - 1 || i >= serie.fechas.length) throw new DatosIncompletos(`faltan días de historia para ${serie.fechas[i] ?? i}`);
  const P26 = intento(() => sumaLluvia(serie, i - 25, i));
  const tanda = intento(() => {
    let P3 = 0, lag = 99;
    for (let k = 0; k < 28; k++) { const j = i - k, p = sumaLluvia(serie, j - 2, j); if (p > P3) { P3 = p; lag = k; } }
    return { P3, lag };
  });
  const secante = intento(() => {
    let et7 = 0, p7 = 0, hr7 = 0, ventosos = 0;
    for (let j = i - 6; j <= i; j++) {
      et7 += dato(serie, 'et0', j); p7 += lluvia(serie, j); hr7 += dato(serie, 'hr', j) / 7;
      if (dato(serie, 'viento', j) > 35) ventosos++;
    }
    return et7 - p7 > 15 && (hr7 < 55 || ventosos >= 3);
  });
  const tmin7 = [];
  for (let j = i - 6; j <= i; j++) { const v = serie.tmin?.[j]; tmin7.push(v == null || Number.isNaN(v) ? null : v); }
  return {
    fecha: serie.fechas[i], prevision: i > serie.hoy,
    P26, P3: tanda?.P3 ?? null, lag: tanda?.lag ?? null, pct: serie.hsueloPct?.[i] ?? null,
    Pagosto: intento(() => lluviaDesdeAgosto(serie, i)), secante,
    T20aire: intento(() => media(serie, 'tmedia', i - 19, i)), T20suelo: intento(() => media(serie, 'tsuelo', i - 19, i)), tmin7,
  };
}

// Paso 2: la nota de una especie a partir de los agregados. `ajusteHumedad` (orientación de la ladera, orientativo)
// multiplica fW; 1 = sin ajuste, como en Hoy y Zona. `explicar: false` no construye las frases (pintado del mapa).
export function indiceDesdeAgregados(ag, especie, { ajusteHumedad = 1, explicar = true } = {}) {
  const sp = especie.indice;
  const base = { confianza: sp.confianza, prevision: ag.prevision };
  const fC = calendario(ag.fecha, especie.temporada.meses);
  if (fC === 0) {
    return { ...base, valor: 0, etiqueta: 'nulo', factores: { fW: null, fR: null, fT: null, fS: null, fA: null, fC, pen: null },
      datos: {}, explicacion: ['Fuera de temporada'] };
  }
  const falta = (campo) => { throw new DatosIncompletos(`${campo} sin dato el ${ag.fecha}`); };
  const explicacion = [];
  const decir = (f) => { if (explicar) explicacion.push(f()); };

  if (ag.P26 == null || ag.P3 == null) falta('precip');
  const P26 = ag.P26, fW0 = clamp01((P26 - sp.pmin) / (sp.pfull - sp.pmin));
  const fW = ajusteHumedad === 1 ? fW0 : clamp01(fW0 * ajusteHumedad);
  decir(() => `${Math.round(P26)} mm en 26 días (mínimo ${sp.pmin}, pleno ${sp.pfull})`);

  const { P3, lag } = ag;
  const [d0, d1] = sp.desfase;
  const dist = lag < d0 ? d0 - lag : lag > d1 ? lag - d1 : 0;
  const fR = clamp01(P3 / 30) * Math.exp(-((dist / 5) ** 2) / 2);
  decir(() => (P3 > 0 ? `Mayor tanda de lluvia: ${Math.round(P3)} mm hace ${lag} días (ideal ${d0}–${d1})` : 'Sin tandas de lluvia en el último mes'));

  const T20 = sp.usarSuelo ? ag.T20suelo : ag.T20aire;
  if (T20 == null) falta(sp.usarSuelo ? 'tsuelo' : 'tmedia');
  const sigma = (sp.trango[1] - sp.trango[0]) / 2;
  const fT = Math.exp(-(((T20 - sp.topt) / sigma) ** 2) / 2);
  decir(() => `${sp.usarSuelo ? 'Suelo' : 'Aire'} a ${r1(T20)} °C de media en 20 días (óptimo ${sp.topt} °C)`);

  const pct = ag.pct;
  const fS = pct == null ? null : clamp01((pct - 20) / 50);
  decir(() => (pct == null ? 'Sin climatología: no se ha tenido en cuenta la humedad del suelo' : `Humedad del suelo en el percentil ${Math.round(pct)}`));

  let fA = 1, Pagosto = null;
  if (especie.temporada.tipo === 'otono') {
    if (ag.Pagosto == null) throw new DatosIncompletos('falta la lluvia desde el 1 de agosto');
    Pagosto = ag.Pagosto;
    fA = Pagosto >= 50 ? 1 : 0.3;
    if (fA < 1) decir(() => `Temporada sin arrancar: ${Math.round(Pagosto)} mm desde el 1 de agosto (hacen falta 50)`);
  }

  let pen = 1;
  if (sp.helada !== 'alta') {
    if (ag.tmin7.some((t) => t == null)) falta('tmin');
    let noches = 0, fuerte = false;
    for (const t of ag.tmin7) { if (t <= 0) noches++; if (t < -3) fuerte = true; }
    if (noches) { pen *= 0.85 ** noches; decir(() => `${noches} noche(s) de helada en 7 días`); }
    if (fuerte) { pen *= sp.helada === 'media' ? 0.5 : 0.2; decir(() => 'Helada fuerte (< −3 °C): corta la fructificación'); }
  }
  if (ag.secante == null) falta('et0');
  if (ag.secante) { pen *= 0.75; decir(() => 'Ambiente secante: evaporación alta, aire seco o viento'); }
  if (T20 > sp.trango[1] + 4) { pen *= 0.6; decir(() => 'Demasiado calor para la especie'); }

  const factores = { fW, fT, fS, fR };
  const usados = Object.keys(PESOS).filter((k) => factores[k] != null);
  const total = usados.reduce((t, k) => t + PESOS[k], 0);
  const geo = usados.reduce((b, k) => b * factores[k] ** (PESOS[k] / total), 1);
  const valor = Math.round(100 * geo * fA * fC * pen);

  return { ...base, valor, etiqueta: etiqueta(valor), factores: { fW, fR, fT, fS, fA, fC, pen },
    datos: { P26, P3, lag, T20, pct, Pagosto }, explicacion };
}

export function calcularIndice(serie, i, especie) {
  return indiceDesdeAgregados(agregadosDia(serie, i), especie);
}
```

- [ ] **Step 7: Ejecutar todas las pruebas**

Run: `npm test`
Expected: PASS, incluidas `tests/indice-referencia.test.js` (300 casos idénticos) y las 6 pruebas nuevas de `tests/indice.test.js`. Si un caso de referencia falla, no se toca la referencia: se corrige la división (el orden de las frases y de las multiplicaciones de `pen` tiene que ser el de antes).

- [ ] **Step 8: Commit**

```bash
git add js/indice.js tests/casos-indice.js tests/fixtures/indice-referencia.json tests/indice-referencia.test.js tests/indice.test.js scripts/fijar-referencia-indice.mjs
git commit -m "$(cat <<'EOF'
Índice: agregados del día y nota por especie, con la nota actual fijada en una referencia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 2: Módulos compartidos con la Edge Function

Deno empaqueta sin problemas las importaciones de `supabase/functions/_shared/` (es la convención de Supabase); las de fuera de `supabase/functions` no están garantizadas. Así que el índice, la meteo, la caché y los umbrales pasan a `_shared/` y `js/` conserva reexportaciones de una línea: la app, las pruebas y la función importan **el mismo archivo**. Se añade `.nojekyll` porque GitHub Pages (Jekyll) no sirve carpetas que empiezan por `_`; el patrón de importar desde `supabase/functions/` ya existe en la app (`js/aemet.js` importa `supabase/functions/aemet/prec.js`).

**Files:**
- Move: `js/indice.js` → `supabase/functions/_shared/indice.js`; `js/meteo.js` → `supabase/functions/_shared/meteo.js`; `js/cache.js` → `supabase/functions/_shared/cache.js`; `js/umbrales.js` → `supabase/functions/_shared/umbrales.js`
- Create: `js/indice.js`, `js/meteo.js`, `js/cache.js`, `js/umbrales.js` (reexportaciones)
- Create: `.nojekyll` (vacío)
- Modify: `supabase/functions/_shared/meteo.js` (`urlPrincipal` con opciones; exportar `sumarDias` y `entreDias`)
- Test: `tests/compartidos.test.js`

**Interfaces:**
- Consumes: todo lo de la tarea 1.
- Produces: `urlPrincipal(puntos, { pasados = PASADOS, futuros = FUTUROS } = {})` (sin opciones, la URL de siempre); `sumarDias(fecha, n) → 'YYYY-MM-DD'`; `entreDias(a, b) → número de días de a a b`. Las rutas `js/*.js` siguen valiendo para la app y las pruebas.

- [ ] **Step 1: Escribir la prueba (falla: no existe `_shared`)**

```js
// tests/compartidos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as indiceApp from '../js/indice.js';
import * as indiceFuncion from '../supabase/functions/_shared/indice.js';
import * as meteoApp from '../js/meteo.js';
import * as meteoFuncion from '../supabase/functions/_shared/meteo.js';
import * as umbralesApp from '../js/umbrales.js';
import * as umbralesFuncion from '../supabase/functions/_shared/umbrales.js';

test('la app y la función usan el mismo módulo (una sola copia de la fórmula)', () => {
  assert.equal(indiceApp.calcularIndice, indiceFuncion.calcularIndice);
  assert.equal(indiceApp.agregadosDia, indiceFuncion.agregadosDia);
  assert.equal(indiceApp.DatosIncompletos, indiceFuncion.DatosIncompletos);
  assert.equal(meteoApp.parsearPrincipal, meteoFuncion.parsearPrincipal);
  assert.equal(umbralesApp.umbralEfectivo, umbralesFuncion.umbralEfectivo);
});

test('GitHub Pages sirve las carpetas con guion bajo (.nojekyll)', () => assert.ok(existsSync('.nojekyll')));

test('las reexportaciones de js/ son de una línea y apuntan a _shared', () => {
  for (const n of ['indice', 'meteo', 'cache', 'umbrales']) {
    const t = readFileSync(`js/${n}.js`, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('//'));
    assert.deepEqual(t, [`export * from '../supabase/functions/_shared/${n}.js';`], n);
  }
});

test('los módulos compartidos no usan el DOM al cargarse (Deno no tiene document)', () => {
  for (const n of ['indice', 'meteo', 'cache', 'umbrales']) {
    assert.doesNotMatch(readFileSync(`supabase/functions/_shared/${n}.js`, 'utf8'), /\bdocument\.|\bwindow\./, n);
  }
});

test('urlPrincipal: por defecto 60 + 10 días; la función puede pedir 2 + 10 con las mismas variables', () => {
  const p = [{ id: 'a', lat: 40.85, lon: -3.99, altitud: 1500 }];
  const def = new URL(meteoApp.urlPrincipal(p)).searchParams;
  const corta = new URL(meteoApp.urlPrincipal(p, { pasados: 2, futuros: 10 })).searchParams;
  assert.equal(def.get('past_days'), '60');
  assert.equal(def.get('forecast_days'), '10');
  assert.equal(corta.get('past_days'), '2');
  assert.equal(corta.get('daily'), def.get('daily'));
  assert.equal(corta.get('hourly'), def.get('hourly'));
});

test('sumarDias y entreDias', () => {
  assert.equal(meteoApp.sumarDias('2026-10-01', -59), '2026-08-03');
  assert.equal(meteoApp.entreDias('2026-08-01', '2026-10-01'), 61);
});
```

Run: `node --test tests/compartidos.test.js`
Expected: FAIL con `Cannot find module '…/supabase/functions/_shared/indice.js'`.

- [ ] **Step 2: Mover los módulos y crear las reexportaciones**

```bash
mkdir -p supabase/functions/_shared
git mv js/indice.js supabase/functions/_shared/indice.js
git mv js/meteo.js supabase/functions/_shared/meteo.js
git mv js/cache.js supabase/functions/_shared/cache.js
git mv js/umbrales.js supabase/functions/_shared/umbrales.js
for n in indice meteo cache umbrales; do
  printf "// Reexporta el módulo compartido con la Edge Function «rejilla» (una sola copia, ver tests/compartidos.test.js).\nexport * from '../supabase/functions/_shared/%s.js';\n" "$n" > "js/$n.js"
done
: > .nojekyll
```

`supabase/functions/_shared/meteo.js` importa `./cache.js`, que ahora está a su lado: no cambia.

- [ ] **Step 3: Dar opciones a `urlPrincipal` y exportar las ayudas de fechas**

En `supabase/functions/_shared/meteo.js`:

```js
export const urlPrincipal = (puntos, { pasados = PASADOS, futuros = FUTUROS } = {}) => `${PREVISION}?${new URLSearchParams({ ...coords(puntos),
  daily: DIARIAS.join(','), hourly: HORARIAS.join(','), past_days: pasados, forecast_days: futuros })}`;
```

y cambiar las dos constantes privadas de fechas por exportaciones (misma definición):

```js
export const sumarDias = (f, n) => new Date(Date.parse(`${f}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);
export const entreDias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA);
```

(`sumarDias` se usa antes de su definición en `urlClimatologia`, pero solo dentro de una función flecha: sigue funcionando.)

- [ ] **Step 4: Ejecutar todas las pruebas**

Run: `npm run comprobar`
Expected: PASS (todas, incluidas las de `tests/meteo.test.js`, `tests/indice-referencia.test.js` y `tests/compartidos.test.js`) y `✓ Datos válidos`.

- [ ] **Step 5: Comprobar en el navegador que Hoy, Zona y Mapa cargan igual**

Run: `npx --yes http-server -p 8080 -c-1 .` y abrir `http://localhost:8080/#hoy`, `#zona/soria` y `#mapa`.
Expected: las tres pantallas como antes; en la consola, sin 404 de `supabase/functions/_shared/*.js`. Anotar para el controlador: tras integrar en `main`, comprobar que `https://gonzalotsainz-ux.github.io/setas/supabase/functions/_shared/indice.js` responde 200 (si no, `.nojekyll` no ha surtido efecto y Hoy se rompe).

- [ ] **Step 6: Commit**

```bash
git add -A js/indice.js js/meteo.js js/cache.js js/umbrales.js supabase/functions/_shared .nojekyll tests/compartidos.test.js
git commit -m "$(cat <<'EOF'
Índice y meteo en supabase/functions/_shared para que la Edge Function use el mismo módulo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 3: Geometría de la rejilla

**Files:**
- Create: `js/rejilla/geo.js`
- Modify: `scripts/validar-datos.mjs:24-35` (el punto en polígono pasa a `js/rejilla/geo.js`; el validador lo reexporta)
- Test: `tests/rejilla-geo.test.js`

**Interfaces:**
- Produces: `R`, `ORIGEN`, `TAM_FINA = 250`, `ANCLA = { lon: -10, lat: 35 }`; `aMercator(lon, lat) → { x, y }`; `aGrados(x, y) → { lon, lat }`; `celdaFina(x, y, tam?) → { col, fila }` (fila crece hacia el sur, como las teselas); `centroFina(col, fila, tam?) → { x, y }`; `ventanaBbox([o, s, e, n], tam?) → { col0, fila0, ancho, alto }`; `idGruesa(zona, lon, lat, paso) → 'zona:col:fila'`; `centroGruesa(id, paso) → { lon, lat }`; `limitesGruesa(id, paso) → [o, s, e, n]`; `metrosSuelo(tam, lat) → metros reales`; `puntoEnGeometria(lon, lat, geometria) → booleano` (Polygon y MultiPolygon, con huecos; el mismo de siempre, ahora usable en el navegador); `bboxDe(geometria) → [o, s, e, n]`. `scripts/validar-datos.mjs` sigue exportando `puntoEnGeometria` (lo usan `tests/puntos-madrid.test.js` y el generador).

- [ ] **Step 1: Escribir la prueba**

```js
// tests/rejilla-geo.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aMercator, aGrados, celdaFina, centroFina, ventanaBbox, idGruesa, centroGruesa, limitesGruesa, metrosSuelo, ORIGEN } from '../js/rejilla/geo.js';

const cerca = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`);

test('Mercator ida y vuelta', () => {
  const p = aMercator(-3.9943, 40.853);
  cerca(p.x, -444643.4420755727, 1e-6);
  cerca(p.y, 4990683.316688638, 1e-6);
  const g = aGrados(p.x, p.y);
  cerca(g.lon, -3.9943); cerca(g.lat, 40.853);
});

test('celdas finas de 250 m alineadas con el origen de las teselas', () => {
  assert.deepEqual(celdaFina(0, 0), { col: 80150, fila: 80150 });
  const p = aMercator(-3.9943, 40.853);
  assert.deepEqual(celdaFina(p.x, p.y), { col: 78371, fila: 60187 });
  const c = centroFina(78371, 60187);
  cerca(c.x, 78371.5 * 250 - ORIGEN, 1e-6);
  cerca(c.y, ORIGEN - 60187.5 * 250, 1e-6);
});

test('ventana del bbox de Guadarrama', () => {
  assert.deepEqual(ventanaBbox([-4.25, 40.65, -3.7701, 41.05]), { col0: 78257, fila0: 60071, ancho: 215, alto: 236 });
});

test('celdas gruesas en grados, ancladas en 10° O y 35° N', () => {
  assert.equal(idGruesa('guadarrama', -3.9943, 40.853, 0.09), 'guadarrama:66:65');
  const c = centroGruesa('guadarrama:66:65', 0.09);
  cerca(c.lon, -4.015); cerca(c.lat, 40.895);
  const [o, s, e, n] = limitesGruesa('guadarrama:66:65', 0.09);
  cerca(o, -4.06); cerca(s, 40.85); cerca(e, -3.97); cerca(n, 40.94);
});

test('un metro de Mercator mide cos(lat) metros reales', () => cerca(metrosSuelo(250, 60), 125, 1e-9));

test('punto en polígono con hueco y multipolígono; bbox', () => {
  const conHueco = { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]] };
  assert.equal(puntoEnGeometria(0.5, 0.5, conHueco), true);
  assert.equal(puntoEnGeometria(2, 2, conHueco), false);
  assert.equal(puntoEnGeometria(5, 5, conHueco), false);
  const multi = { type: 'MultiPolygon', coordinates: [conHueco.coordinates, [[[10, 10], [11, 10], [11, 11], [10, 10]]]] };
  assert.equal(puntoEnGeometria(10.8, 10.2, multi), true);
  assert.equal(puntoEnGeometria(0, 0, { type: 'Point', coordinates: [0, 0] }), false);
  assert.deepEqual(bboxDe(multi), [0, 0, 11, 11]);
});
```

Y cambiar la primera línea de importaciones de la prueba por:

```js
import { aMercator, aGrados, celdaFina, centroFina, ventanaBbox, idGruesa, centroGruesa, limitesGruesa, metrosSuelo, puntoEnGeometria, bboxDe, ORIGEN } from '../js/rejilla/geo.js';
```

Run: `node --test tests/rejilla-geo.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir el módulo**

```js
// js/rejilla/geo.js
// Rejilla fina de 250 m en EPSG:3857 (Web Mercator, el de Leaflet y las teselas) y rejilla gruesa en grados.
// Funciones puras: las usan el generador (Node), la Edge Function no y el móvil sí.
export const R = 6378137;
export const ORIGEN = Math.PI * R;             // 20 037 508,34 m: esquina noroeste de la malla de teselas
export const TAM_FINA = 250;
export const ANCLA = { lon: -10, lat: 35 };    // esquina suroeste de la rejilla gruesa (al oeste y al sur de todas las zonas)

const RAD = Math.PI / 180;
export const aMercator = (lon, lat) => ({ x: R * lon * RAD, y: R * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) });
export const aGrados = (x, y) => ({ lon: x / R / RAD, lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / RAD });

// Columna y fila globales de la celda fina que contiene (x, y). La fila crece hacia el sur, como en las teselas.
export const celdaFina = (x, y, tam = TAM_FINA) => ({ col: Math.floor((x + ORIGEN) / tam), fila: Math.floor((ORIGEN - y) / tam) });
export const centroFina = (col, fila, tam = TAM_FINA) => ({ x: (col + 0.5) * tam - ORIGEN, y: ORIGEN - (fila + 0.5) * tam });

// Ventana de celdas finas que cubre un bbox [oeste, sur, este, norte] en grados.
export function ventanaBbox([o, s, e, n], tam = TAM_FINA) {
  const a = aMercator(o, n), b = aMercator(e, s);
  const c0 = celdaFina(a.x, a.y, tam), c1 = celdaFina(b.x, b.y, tam);
  return { col0: c0.col, fila0: c0.fila, ancho: c1.col - c0.col + 1, alto: c1.fila - c0.fila + 1 };
}

// Celda gruesa: cuadrado de `paso` grados; el id lleva la zona porque cada zona tiene su propia lista.
export const idGruesa = (zona, lon, lat, paso) => `${zona}:${Math.floor((lon - ANCLA.lon) / paso)}:${Math.floor((lat - ANCLA.lat) / paso)}`;
const partes = (id) => { const [, c, f] = id.split(':'); return [Number(c), Number(f)]; };
export function centroGruesa(id, paso) { const [c, f] = partes(id); return { lon: ANCLA.lon + (c + 0.5) * paso, lat: ANCLA.lat + (f + 0.5) * paso }; }
export function limitesGruesa(id, paso) { const [c, f] = partes(id); return [ANCLA.lon + c * paso, ANCLA.lat + f * paso, ANCLA.lon + (c + 1) * paso, ANCLA.lat + (f + 1) * paso]; }

// Un metro de Mercator mide cos(lat) metros sobre el terreno.
export const metrosSuelo = (tam, lat) => tam * Math.cos(lat * RAD);

// Punto dentro de un anillo (trazado de rayos); [lon, lat]. Movido tal cual desde scripts/validar-datos.mjs.
const enAnillo = (lon, lat, anillo) => {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};
const enPoligono = (lon, lat, [exterior, ...huecos]) => enAnillo(lon, lat, exterior) && !huecos.some((h) => enAnillo(lon, lat, h));
export const puntoEnGeometria = (lon, lat, g) => (g?.type === 'Polygon' ? enPoligono(lon, lat, g.coordinates)
  : g?.type === 'MultiPolygon' ? g.coordinates.some((p) => enPoligono(lon, lat, p)) : false);

export function bboxDe(g) {
  let o = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const anillos = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
  for (const a of anillos) for (const [x, y] of a) { if (x < o) o = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [o, s, e, n];
}
```

- [ ] **Step 3: Quitar la copia del validador**

En `scripts/validar-datos.mjs`, borrar las líneas de `// Punto dentro de un anillo` hasta la definición de `puntoEnGeometria` (líneas 24 a 35) y añadir junto a las importaciones del principio:

```js
import { puntoEnGeometria } from '../js/rejilla/geo.js';
export { puntoEnGeometria };
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `npm run comprobar`
Expected: PASS (las 6 de `tests/rejilla-geo.test.js` y las de siempre, incluida `tests/puntos-madrid.test.js`) y `✓ Datos válidos`.

- [ ] **Step 5: Commit**

```bash
git add js/rejilla/geo.js tests/rejilla-geo.test.js scripts/validar-datos.mjs
git commit -m "$(cat <<'EOF'
Rejilla: geometría de celdas finas (250 m, EPSG:3857) y gruesas (grados)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 4: Formato binario de la rejilla y su validación

Formato `SETR` v1: 4 bytes `SETR`, 1 byte de versión, 4 bytes (u32 LE) con la longitud de la cabecera, la cabecera JSON en UTF-8 y una carga **gzip** con tres planos de `ancho × alto` celdas, fila a fila de norte a sur. El archivo va ya comprimido porque GitHub Pages no comprime los binarios: su tamaño en disco es el que se descarga.

| Plano | Tipo | Contenido |
|---|---|---|
| hábitat | u8 | bits 0–4: código (0 = sin monte apropiado; n = `cabecera.habitats[n − 1]`); bit 7: prohibido |
| terreno | u8 | bits 0–3: orientación (0 llano, 1 N, 2 NE, 3 E, 4 SE, 5 S, 6 SO, 7 O, 8 NO); bits 4–7: tramo de pendiente (0 a 3) |
| altitud | i16 LE | metros, guardados como diferencia con la celda de la izquierda (la primera de cada fila, con 0), para que gzip comprima |

**Files:**
- Create: `js/rejilla/formato.js`
- Modify: `scripts/validar-datos.mjs` (nueva `validarRejillas` y su llamada en el bloque final)
- Test: `tests/rejilla-formato.test.js`, `tests/validar-datos.test.js` (añadir al final)

**Interfaces:**
- Produces: `MAGIA = 'SETR'`, `VERSION = 1`, `PROHIBIDO = 0x80`, `CODIGO = 0x1f`, `ORIENTACIONES = ['llano', 'N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']`, `TRAMOS_PENDIENTE` (4 textos); `async codificarRejilla(cabecera, { habitat: Uint8Array, terreno: Uint8Array, altitud: Int16Array }) → Uint8Array`; `leerCabecera(bytes) → { cabecera, inicio }` (síncrona, sin descomprimir); `async decodificarRejilla(bytes | ArrayBuffer) → { cabecera, habitat, terreno, altitud: Int16Array }`. Cabecera: `{ version, zona, tam, col0, fila0, ancho, alto, habitats: string[], fuentes: { mfe: { nombre, url, fecha }, mdt: { nombre, url, fecha } }, generado, parte?, partes? }`.
- Produces (validador): `validarRejillas({ indice, gruesa, zonas, leer, maxBytes = 307200 }) → string[]`.

- [ ] **Step 1: Escribir la prueba del formato**

```js
// tests/rejilla-formato.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificarRejilla, decodificarRejilla, leerCabecera, PROHIBIDO } from '../js/rejilla/formato.js';

const fuente = { nombre: 'x', url: 'https://x.es', fecha: '2026-10-01' };
export const cabeceraPrueba = (extra = {}) => ({ version: 1, zona: 'soria', tam: 250, col0: 10, fila0: 20, ancho: 3, alto: 2,
  habitats: ['pinar-silvestre', 'hayedo'], fuentes: { mfe: fuente, mdt: fuente }, generado: '2026-10-01', ...extra });
const planos = () => ({ habitat: Uint8Array.from([1, 0, PROHIBIDO, 2, 1, 0]), terreno: Uint8Array.from([0x11, 0, 0, 0x25, 0x38, 0]),
  altitud: Int16Array.from([1500, 0, 0, 1210, 1185, 0]) });

test('ida y vuelta: cabecera y los tres planos salen idénticos', async () => {
  const bytes = await codificarRejilla(cabeceraPrueba(), planos());
  const r = await decodificarRejilla(bytes);
  assert.deepStrictEqual(r.cabecera, cabeceraPrueba());
  assert.deepStrictEqual(r.habitat, planos().habitat);
  assert.deepStrictEqual(r.terreno, planos().terreno);
  assert.deepStrictEqual(r.altitud, planos().altitud);
  const desdeBuffer = await decodificarRejilla(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.deepStrictEqual(desdeBuffer.altitud, planos().altitud);
});

test('leerCabecera no descomprime y dice dónde empieza la carga', async () => {
  const bytes = await codificarRejilla(cabeceraPrueba(), planos());
  const { cabecera, inicio } = leerCabecera(bytes);
  assert.equal(cabecera.zona, 'soria');
  assert.equal(bytes[inicio], 0x1f);   // primer byte de gzip
});

test('errores: no es una rejilla, versión desconocida, planos de otro tamaño, cabecera incompleta', async () => {
  assert.throws(() => leerCabecera(new TextEncoder().encode('XXXX\u0001\u0000\u0000\u0000\u0000')), /no es una rejilla/);
  const b = await codificarRejilla(cabeceraPrueba(), planos()); b[4] = 9;
  assert.throws(() => leerCabecera(b), /versión de rejilla 9/);
  await assert.rejects(codificarRejilla(cabeceraPrueba({ ancho: 4 }), planos()), /8 celdas/);
  const { fuentes, ...sinFuentes } = cabeceraPrueba();
  await assert.rejects(codificarRejilla(sinFuentes, planos()), /cabecera sin fuentes/);
});

test('una zona vacía de 1000 × 1000 celdas ocupa muy poco', async () => {
  const n = 1e6;
  const bytes = await codificarRejilla(cabeceraPrueba({ ancho: 1000, alto: 1000 }), { habitat: new Uint8Array(n), terreno: new Uint8Array(n), altitud: new Int16Array(n) });
  assert.ok(bytes.length < 12000, `${bytes.length} bytes`);
});
```

Run: `node --test tests/rejilla-formato.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir el codificador y el decodificador**

```js
// js/rejilla/formato.js
// Formato binario de la rejilla fina (data/rejilla/<zona>.bin), descrito en docs/datos.md («Formato de la rejilla»):
// «SETR» + versión (u8) + longitud de la cabecera (u32 LE) + cabecera JSON + carga gzip con tres planos
// (hábitat u8, terreno u8, altitud i16 LE en diferencias por fila). Usa CompressionStream: vale en Node 24 y en el móvil.
export const MAGIA = 'SETR';
export const VERSION = 1;
export const PROHIBIDO = 0x80;
export const CODIGO = 0x1f;
export const ORIENTACIONES = ['llano', 'N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export const TRAMOS_PENDIENTE = ['menos del 5 %', 'del 5 al 15 %', 'del 15 al 30 %', '30 % o más'];
const CAMPOS = ['version', 'zona', 'tam', 'col0', 'fila0', 'ancho', 'alto', 'habitats', 'fuentes', 'generado'];

const pasar = async (bytes, transformacion) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transformacion)).arrayBuffer());
const comoBytes = (e) => (e instanceof Uint8Array ? e : new Uint8Array(e));

export async function codificarRejilla(cabecera, { habitat, terreno, altitud }) {
  const faltan = CAMPOS.filter((k) => cabecera[k] == null);
  if (faltan.length) throw new Error(`cabecera sin ${faltan.join(', ')}`);
  const { ancho, alto } = cabecera, n = ancho * alto;
  if (habitat.length !== n || terreno.length !== n || altitud.length !== n) throw new Error(`los planos deben tener ${n} celdas`);
  const carga = new Uint8Array(n * 4), vista = new DataView(carga.buffer);
  carga.set(habitat, 0);
  carga.set(terreno, n);
  for (let f = 0; f < alto; f++) {
    let previo = 0;
    for (let c = 0; c < ancho; c++) { const k = f * ancho + c; vista.setInt16(2 * n + 2 * k, altitud[k] - previo, true); previo = altitud[k]; }
  }
  const comprimida = await pasar(carga, new CompressionStream('gzip'));
  const cab = new TextEncoder().encode(JSON.stringify(cabecera));
  const salida = new Uint8Array(9 + cab.length + comprimida.length);
  salida.set(new TextEncoder().encode(MAGIA), 0);
  salida[4] = VERSION;
  new DataView(salida.buffer).setUint32(5, cab.length, true);
  salida.set(cab, 9);
  salida.set(comprimida, 9 + cab.length);
  return salida;
}

export function leerCabecera(entrada) {
  const b = comoBytes(entrada);
  if (b.length < 9 || new TextDecoder().decode(b.subarray(0, 4)) !== MAGIA) throw new Error('no es una rejilla de Setas');
  if (b[4] !== VERSION) throw new Error(`versión de rejilla ${b[4]} desconocida`);
  const largo = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(5, true);
  return { cabecera: JSON.parse(new TextDecoder().decode(b.subarray(9, 9 + largo))), inicio: 9 + largo };
}

export async function decodificarRejilla(entrada) {
  const b = comoBytes(entrada);
  const { cabecera, inicio } = leerCabecera(b);
  const { ancho, alto } = cabecera, n = ancho * alto;
  const carga = await pasar(b.subarray(inicio), new DecompressionStream('gzip'));
  if (carga.length !== n * 4) throw new Error('rejilla dañada: la carga no tiene el tamaño de la cabecera');
  const vista = new DataView(carga.buffer, carga.byteOffset, carga.byteLength);
  const altitud = new Int16Array(n);
  for (let f = 0; f < alto; f++) {
    let previo = 0;
    for (let c = 0; c < ancho; c++) { const k = f * ancho + c; previo += vista.getInt16(2 * n + 2 * k, true); altitud[k] = previo; }
  }
  return { cabecera, habitat: carga.slice(0, n), terreno: carga.slice(n, 2 * n), altitud };
}
```

- [ ] **Step 3: Ejecutar la prueba**

Run: `node --test tests/rejilla-formato.test.js`
Expected: PASS (4 pruebas).

- [ ] **Step 4: Escribir la prueba del validador (falla: no existe `validarRejillas`)**

Añadir al final de `tests/validar-datos.test.js`:

```js
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
  assert.deepEqual(validarRejillas({ ...c, leer: () => c.bytes }), []);
});

test('validarRejillas: archivo que falta, que pesa demasiado o que no es una rejilla', async () => {
  const c = await casoRejilla();
  assert.match(validarRejillas({ ...c, leer: () => null }).join('\n'), /falta el archivo/);
  assert.match(validarRejillas({ ...c, leer: () => c.bytes, maxBytes: 20 }).join('\n'), /KB, más de/);
  assert.match(validarRejillas({ ...c, leer: () => new TextEncoder().encode('no soy una rejilla') }).join('\n'), /no es una rejilla/);
});

test('validarRejillas: zona inexistente en la cabecera y celda gruesa sin altitud de referencia', async () => {
  const c = await casoRejilla();
  c.zonas.zonas[0].id = 'cuenca';
  c.gruesa.celdas[0].altRef = null;
  const e = validarRejillas({ ...c, leer: () => c.bytes }).join('\n');
  assert.match(e, /zona inexistente soria/);
  assert.match(e, /sin altRef/);
});
```

Run: `node --test tests/validar-datos.test.js`
Expected: FAIL (`does not provide an export named 'validarRejillas'`).

- [ ] **Step 5: Escribir `validarRejillas` y llamarla desde el validador**

En `scripts/validar-datos.mjs`, añadir la importación y la función:

```js
import { leerCabecera } from '../js/rejilla/formato.js';

// Rejilla fina (data/rejilla/): cada archivo existe, es un «SETR» v1 de una zona conocida, cita sus fuentes y no pasa de
// maxBytes (ya va comprimido: es lo que se descarga). gruesa.json: zona, posición y altitud de referencia de cada celda.
export function validarRejillas({ indice, gruesa, zonas, leer, maxBytes = 300 * 1024 }) {
  const e = [];
  const ids = new Set(zonas.zonas.map((z) => z.id));
  if (indice?.version !== 1 || !Array.isArray(indice.archivos)) return ['rejilla: data/rejilla/indice.json sin versión 1 o sin archivos'];
  for (const a of indice.archivos) {
    const q = `rejilla ${a.archivo}`;
    const b = leer(`data/rejilla/${a.archivo}`);
    if (!b) { e.push(`${q}: falta el archivo`); continue; }
    if (b.length > maxBytes) e.push(`${q}: ${Math.round(b.length / 1024)} KB, más de ${Math.round(maxBytes / 1024)} KB`);
    let cab;
    try { cab = leerCabecera(b).cabecera; } catch (x) { e.push(`${q}: ${x.message}`); continue; }
    if (!ids.has(cab.zona)) e.push(`${q}: zona inexistente ${cab.zona}`);
    if (cab.tam !== 250) e.push(`${q}: celdas de ${cab.tam} m, se esperaban 250`);
    if (!(cab.ancho > 0 && cab.alto > 0)) e.push(`${q}: ancho o alto inválido`);
    if (!Array.isArray(cab.habitats) || !cab.habitats.every((h) => HABITATS.includes(h))) e.push(`${q}: hábitat desconocido en la cabecera`);
    for (const k of ['mfe', 'mdt']) {
      const f = cab.fuentes?.[k];
      if (!f?.nombre || !URL_OK.test(f.url ?? '') || !FECHA.test(f.fecha ?? '')) e.push(`${q}: fuente ${k} sin nombre, url o fecha`);
    }
    if (a.zona !== cab.zona || a.col0 !== cab.col0 || a.fila0 !== cab.fila0 || a.ancho !== cab.ancho || a.alto !== cab.alto) e.push(`${q}: indice.json no coincide con la cabecera`);
  }
  for (const c of gruesa?.celdas ?? []) {
    if (!ids.has(c.zona)) e.push(`celda gruesa ${c.id}: zona inexistente ${c.zona}`);
    if (![c.altRef, c.lat, c.lon].every((v) => typeof v === 'number' && Number.isFinite(v))) e.push(`celda gruesa ${c.id}: sin altRef, lat o lon`);
  }
  if (gruesa && !Object.values(gruesa.pasos ?? {}).every((p) => p > 0)) e.push('gruesa.json: pasos inválidos');
  return e;
}
```

y en el bloque `if (process.argv[1] === fileURLToPath(import.meta.url)) {`, justo después de calcular `errores` (que pasa de `const` a `let` si hiciera falta; `push` vale con `const`):

```js
  if (existsSync('data/rejilla/indice.json')) {
    errores.push(...validarRejillas({ indice: leer('data/rejilla/indice.json'),
      gruesa: existsSync('data/rejilla/gruesa.json') ? leer('data/rejilla/gruesa.json') : null, zonas: leer('data/zonas.json'),
      leer: (f) => (existsSync(f) ? new Uint8Array(readFileSync(f)) : null) }));
  }
```

- [ ] **Step 6: Ejecutar las pruebas y el validador**

Run: `npm run comprobar`
Expected: PASS y `✓ Datos válidos` (todavía no hay `data/rejilla/`, así que el validador no la mira).

- [ ] **Step 7: Commit**

```bash
git add js/rejilla/formato.js tests/rejilla-formato.test.js scripts/validar-datos.mjs tests/validar-datos.test.js
git commit -m "$(cat <<'EOF'
Rejilla: formato binario SETR (cabecera JSON + planos gzip) y su validación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 5: Del MFE50 al hábitat

La tabla va keyed por **nombre científico** (no por código), así no depende de la codificación del MFE50: el código se traduce con `scripts/rejilla/mfe-diccionario.json` (tarea 0). Los criterios propios (cabida cubierta mínima, umbral de altitud del pastizal de montaña) quedan como constantes con nombre y se explican en `docs/datos.md`.

**Files:**
- Create: `scripts/rejilla/mfe-habitat.mjs`
- Modify: `docs/datos.md` (sección nueva «Rejilla fina: del MFE50 al hábitat», tras «data/cotos.geojson»)
- Test: `tests/rejilla-mfe.test.js`

**Interfaces:**
- Consumes: `CONFIG.mfe` (tarea 0), `HABITATS` de `scripts/validar-datos.mjs`.
- Produces: `FCC_MINIMA = 20`, `ALTITUD_PASTIZAL_MONTANA = 1000`, `ESPECIE_A_HABITAT`; `habitatDeEspecie(nombreCientifico) → string|null`; `habitatDeTesela({ tipo, especies, fcc }, altitud, { matorralJaral }) → string|null`; `leerTeselaMfe(properties, { campos, tipos }, diccionario) → { tipo: 'arbolado'|'herbazal'|'matorral'|'otro', especies: string[], fcc: number|null }`.

- [ ] **Step 1: Escribir la prueba**

```js
// tests/rejilla-mfe.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { habitatDeTesela, habitatDeEspecie, leerTeselaMfe, ESPECIE_A_HABITAT, FCC_MINIMA } from '../scripts/rejilla/mfe-habitat.mjs';
import { HABITATS } from '../scripts/validar-datos.mjs';
import { CONFIG } from '../scripts/rejilla/config.mjs';

const arbolado = (especies, fcc = 60) => ({ tipo: 'arbolado', especies, fcc });

test('arbolado: la especie dominante da el hábitat si cubre lo bastante', () => {
  assert.equal(habitatDeTesela(arbolado(['Pinus sylvestris']), 1500), 'pinar-silvestre');
  assert.equal(habitatDeTesela(arbolado(['Quercus pyrenaica']), 1100), 'melojar');
  assert.equal(habitatDeTesela(arbolado(['Pinus sylvestris'], FCC_MINIMA - 1), 1500), null);
  assert.equal(habitatDeTesela(arbolado(['Pinus sylvestris'], null), 1500), null);   // sin cabida cubierta: no se colorea
});

test('arbolado: si la primera especie no tiene hábitat, vale la segunda; si ninguna, sin monte', () => {
  assert.equal(habitatDeTesela(arbolado(['Pinus halepensis', 'Quercus ilex']), 900), 'encinar');
  assert.equal(habitatDeTesela(arbolado(['Pinus halepensis']), 900), null);
  assert.equal(habitatDeTesela(arbolado(['Eucalyptus globulus', 'Pinus halepensis', 'Fagus sylvatica']), 900), null);   // solo las dos primeras
});

test('nombres con subespecie, híbridos y géneros', () => {
  assert.equal(habitatDeEspecie('Quercus ilex subsp. ballota'), 'encinar');
  assert.equal(habitatDeEspecie('Populus x canadensis'), 'chopera');
  assert.equal(habitatDeEspecie('Betula celtiberica'), 'abedular');
  assert.equal(habitatDeEspecie('Pinus uncinata'), null);
});

test('herbazal según la altitud, matorral solo si es jaral, lo demás sin monte', () => {
  assert.equal(habitatDeTesela({ tipo: 'herbazal', especies: [], fcc: null }, 1400), 'pastizal-montana');
  assert.equal(habitatDeTesela({ tipo: 'herbazal', especies: [], fcc: null }, 999), 'prado');
  assert.equal(habitatDeTesela({ tipo: 'herbazal', especies: [], fcc: null }, NaN), null);
  assert.equal(habitatDeTesela({ tipo: 'matorral', especies: ['Cistus ladanifer'], fcc: null }, 600, { matorralJaral: ['Cistus ladanifer'] }), 'jaral');
  assert.equal(habitatDeTesela({ tipo: 'matorral', especies: ['Cistus ladanifer'], fcc: null }, 600), null);
  assert.equal(habitatDeTesela({ tipo: 'otro', especies: ['Pinus sylvestris'], fcc: 80 }, 1500), null);
});

test('todos los hábitats de la tabla existen en especies.json', () => {
  for (const h of Object.values(ESPECIE_A_HABITAT)) assert.ok(HABITATS.includes(h), h);
});

test('leerTeselaMfe traduce campos, códigos y tipos', () => {
  const conf = { campos: { especies: ['SP1', 'SP2'], fcc: 'FCCARB', tipo: 'TIPO' }, tipos: { arbolado: ['1'], herbazal: ['4'], matorral: ['3'] } };
  assert.deepEqual(leerTeselaMfe({ SP1: 21, SP2: '', FCCARB: '65', TIPO: 1 }, conf, { 21: 'Pinus sylvestris' }), { tipo: 'arbolado', especies: ['Pinus sylvestris'], fcc: 65 });
  assert.deepEqual(leerTeselaMfe({ SP1: null, FCCARB: null, TIPO: 9 }, conf, {}), { tipo: 'otro', especies: [], fcc: null });
});

test('la muestra real del MFE50 (tarea 0) se lee con la configuración del sondeo', () => {
  const muestra = JSON.parse(readFileSync('scripts/rejilla/mfe-muestra.json', 'utf8'));
  const diccionario = JSON.parse(readFileSync('scripts/rejilla/mfe-diccionario.json', 'utf8'));
  assert.ok(muestra.length >= 20);
  const leidas = muestra.map((m) => leerTeselaMfe(m.properties, CONFIG.mfe, diccionario));
  for (const t of leidas) assert.ok(['arbolado', 'herbazal', 'matorral', 'otro'].includes(t.tipo));
  assert.ok(leidas.some((t) => habitatDeTesela(t, 1200, CONFIG.mfe)), 'ninguna tesela de la muestra da hábitat: revisa CONFIG.mfe');
});
```

Run: `node --test tests/rejilla-mfe.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir el módulo**

```js
// scripts/rejilla/mfe-habitat.mjs
// Del Mapa Forestal de España (MFE50, MITECO) al hábitat de data/especies.json. Tabla y criterios: docs/datos.md
// («Rejilla fina: del MFE50 al hábitat»). Nombres de campos y valores reales del MFE50: CONFIG.mfe (tarea 0).
export const FCC_MINIMA = 20;                  // % de cabida cubierta arbórea para contar como bosque (criterio propio)
export const ALTITUD_PASTIZAL_MONTANA = 1000;  // herbazal desde esta altitud: pastizal de montaña; por debajo, prado (criterio propio)

export const ESPECIE_A_HABITAT = {
  'Pinus sylvestris': 'pinar-silvestre',
  'Pinus nigra': 'pinar-negral',
  'Pinus pinaster': 'pinar-resinero',
  'Pinus pinea': 'pinar-pinonero',
  'Fagus sylvatica': 'hayedo',
  'Quercus pyrenaica': 'melojar',
  'Quercus petraea': 'robledal-albar',
  'Quercus robur': 'robledal-albar',          // aproximación: no hay hábitat «robledal pedunculado» en especies.json
  'Quercus faginea': 'quejigar',
  'Quercus ilex': 'encinar',
  'Quercus rotundifolia': 'encinar',
  'Quercus suber': 'alcornocal',
  'Castanea sativa': 'castanar',
  'Juniperus thurifera': 'sabinar',
  'Betula spp.': 'abedular',
  'Populus spp.': 'chopera',
  'Populus x canadensis': 'chopera',
};

const limpio = (n) => String(n ?? '').trim().replace(/\s+/g, ' ');
// Nombre exacto, luego género + especie (quita subespecies y variedades), luego «Género spp.».
export function habitatDeEspecie(nombre) {
  const t = limpio(nombre);
  if (!t) return null;
  const dos = t.split(' ').slice(0, 2).join(' ');
  return ESPECIE_A_HABITAT[t] ?? ESPECIE_A_HABITAT[dos] ?? ESPECIE_A_HABITAT[`${t.split(' ')[0]} spp.`] ?? null;
}

// Tesela normalizada → hábitat o null (sin monte apropiado). Arbolado: la primera de las dos especies dominantes que
// tenga hábitat, si la cabida cubierta llega a FCC_MINIMA. Herbazal: por altitud. Matorral: solo si es de jara.
export function habitatDeTesela({ tipo, especies = [], fcc = null }, altitud, { matorralJaral = [] } = {}) {
  if (tipo === 'arbolado') {
    if (fcc == null || fcc < FCC_MINIMA) return null;
    for (const e of especies.slice(0, 2)) { const h = habitatDeEspecie(e); if (h) return h; }
    return null;
  }
  if (tipo === 'herbazal') return Number.isFinite(altitud) ? (altitud >= ALTITUD_PASTIZAL_MONTANA ? 'pastizal-montana' : 'prado') : null;
  if (tipo === 'matorral') return especies.some((e) => matorralJaral.includes(limpio(e))) ? 'jaral' : null;
  return null;
}

// properties de una tesela del MFE50 → tesela normalizada, con los nombres de campos y valores del sondeo.
export function leerTeselaMfe(props, { campos, tipos }, diccionario) {
  const v = String(props[campos.tipo] ?? '');
  const es = (lista) => lista.map(String).includes(v);
  const tipo = es(tipos.arbolado) ? 'arbolado' : es(tipos.herbazal) ? 'herbazal' : es(tipos.matorral) ? 'matorral' : 'otro';
  const especies = campos.especies.map((c) => props[c]).filter((x) => x != null && x !== '').map((x) => diccionario[String(x)] ?? String(x));
  const f = props[campos.fcc] == null || props[campos.fcc] === '' ? NaN : Number(props[campos.fcc]);
  return { tipo, especies, fcc: Number.isFinite(f) ? f : null };
}
```

- [ ] **Step 3: Ejecutar la prueba**

Run: `node --test tests/rejilla-mfe.test.js`
Expected: PASS (7 pruebas). Si falla la de la muestra real, se corrige `CONFIG.mfe` (campos o valores de tipo), no la prueba.

- [ ] **Step 4: Documentar la tabla en `docs/datos.md`**

Añadir tras la sección `## data/cotos.geojson` (y sus notas):

```markdown
## Rejilla fina: del MFE50 al hábitat

Fuente: Mapa Forestal de España 1:50.000 (MFE50), MITECO, por provincia (detalles, licencia y campos en
`docs/investigacion/08-rejilla-fuentes.md`). Código: `scripts/rejilla/mfe-habitat.mjs`.

| Especie dominante (MFE50) | Hábitat |
|---|---|
| *Pinus sylvestris* | pinar-silvestre |
| *Pinus nigra* | pinar-negral |
| *Pinus pinaster* | pinar-resinero |
| *Pinus pinea* | pinar-pinonero |
| *Fagus sylvatica* | hayedo |
| *Quercus pyrenaica* | melojar |
| *Quercus petraea*, *Q. robur* (aproximación) | robledal-albar |
| *Quercus faginea* | quejigar |
| *Quercus ilex*, *Q. rotundifolia* | encinar |
| *Quercus suber* | alcornocal |
| *Castanea sativa* | castanar |
| *Juniperus thurifera* | sabinar |
| *Betula* spp. | abedular |
| *Populus* spp. | chopera |

Reglas (criterios propios, no de la fuente):
- **Arbolado:** hábitat de la primera de las dos especies dominantes que esté en la tabla, si la fracción de cabida
  cubierta arbórea es de al menos el 20 % (`FCC_MINIMA`). Sin cabida cubierta: sin monte (nunca se colorea a ciegas).
- **Herbazal o pastizal:** `pastizal-montana` desde 1.000 m (`ALTITUD_PASTIZAL_MONTANA`) y `prado` por debajo.
- **Matorral:** `jaral` solo si su especie es una jara de `CONFIG.mfe.matorralJaral`; si el MFE50 no detalla el
  matorral, el jaral no sale en la rejilla.
- Sin hábitat (código 0): *Pinus halepensis*, *P. uncinata*, eucaliptos, otras sabinas y enebros, cultivos,
  improductivo y agua. Ninguna comestible con índice vive en ellos según `data/especies.json`.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/rejilla/mfe-habitat.mjs tests/rejilla-mfe.test.js docs/datos.md
git commit -m "$(cat <<'EOF'
Rejilla: del MFE50 al hábitat de especies.json, con la tabla documentada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 6: Terreno: MDT, altitud media, orientación y pendiente

**Files:**
- Create: `scripts/rejilla/terreno.mjs`
- Create: `scripts/rejilla/mdt.mjs`
- Test: `tests/rejilla-terreno.test.js`

**Interfaces:**
- Consumes: `ORIGEN`, `TAM_FINA`, `aMercator` de `js/rejilla/geo.js`; `CONFIG.mdt`.
- Produces (`terreno.mjs`): `tramoDe(pct) → 0..3` (cortes en 5, 15 y 30 %); `orientacionPendiente(alt: Float32Array, ancho, alto, pasoSuelo) → { orientacion: Uint8Array, tramo: Uint8Array }` (método de Horn; orientación = hacia dónde baja la ladera; tramo 0 = llano y orientación 0).
- Produces (`mdt.mjs`): `nuevoAcumulador(n)`, `acumularPunto(acc, ventana, x, y, alt)`, `mediasDe(acc) → Float32Array` (NaN sin muestras); `altitudTerrarium(r, g, b)`, `ladoTesela(z)`, `teselasDeVentana(ventana, z) → [{ tx, ty }]`, `acumularTesela(acc, ventana, { z, tx, ty, datos, canales, lado })`; `async leerAltitudes(ventana, configMdt) → Float32Array` (altitud media de cada celda fina).

- [ ] **Step 1: Escribir la prueba**

```js
// tests/rejilla-terreno.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orientacionPendiente, tramoDe } from '../scripts/rejilla/terreno.mjs';
import { altitudTerrarium, teselasDeVentana, acumularTesela, nuevoAcumulador, mediasDe, ladoTesela } from '../scripts/rejilla/mdt.mjs';
import { ORIENTACIONES } from '../js/rejilla/formato.js';

const plano = (ancho, alto, f) => Float32Array.from({ length: ancho * alto }, (_, k) => f(k % ancho, Math.floor(k / ancho)));
const centro = (r, ancho = 5) => ({ o: ORIENTACIONES[r.orientacion[2 * ancho + 2]], t: r.tramo[2 * ancho + 2] });

test('tramos de pendiente', () => assert.deepEqual([0, 4.9, 5, 14.9, 15, 29.9, 30, 80].map(tramoDe), [0, 0, 1, 1, 2, 2, 3, 3]));

test('orientación: la ladera mira hacia donde baja', () => {
  assert.deepEqual(centro(orientacionPendiente(plano(5, 5, (c, f) => 1000 + f * 25), 5, 5, 250)), { o: 'N', t: 1 });   // sube hacia el sur: umbría
  assert.deepEqual(centro(orientacionPendiente(plano(5, 5, (c, f) => 1000 - f * 25), 5, 5, 250)), { o: 'S', t: 1 });
  assert.deepEqual(centro(orientacionPendiente(plano(5, 5, (c) => 1000 + c * 50), 5, 5, 250)), { o: 'O', t: 2 });       // 20 %
  assert.deepEqual(centro(orientacionPendiente(plano(5, 5, (c, f) => 1000 + (c + f) * 40), 5, 5, 250)), { o: 'NO', t: 2 });
  assert.deepEqual(centro(orientacionPendiente(plano(5, 5, () => 1000), 5, 5, 250)), { o: 'llano', t: 0 });
});

test('orientación: una celda sin dato no rompe a sus vecinas', () => {
  const a = plano(5, 5, (c, f) => 1000 + f * 25);
  a[2 * 5 + 1] = NaN;
  const r = orientacionPendiente(a, 5, 5, 250);
  assert.equal(ORIENTACIONES[r.orientacion[2 * 5 + 2]], 'N');
  assert.equal(r.orientacion[2 * 5 + 1], 0);
});

test('Terrarium: decodificación y teselas de una ventana de una celda (Valsaín, z12)', () => {
  assert.equal(altitudTerrarium(131, 232, 0), 1000);
  assert.deepEqual(teselasDeVentana({ col0: 78371, fila0: 60187, ancho: 1, alto: 1 }, 12), [{ tx: 2002, ty: 1537 }]);
});

test('Terrarium: una tesela uniforme da su altitud a las celdas que cubre', () => {
  const l = ladoTesela(12), tx = 2002, ty = 1537;
  const ventana = { col0: Math.floor((tx * l) / 250), fila0: Math.floor((ty * l) / 250), ancho: 42, alto: 42 };   // la tesela cubre ~39 celdas por lado
  const acc = nuevoAcumulador(ventana.ancho * ventana.alto);
  const datos = new Uint8Array(256 * 256 * 3);
  for (let k = 0; k < 256 * 256; k++) { datos[3 * k] = 131; datos[3 * k + 1] = 232; }
  acumularTesela(acc, ventana, { z: 12, tx, ty, datos, canales: 3, lado: 256 });
  const m = mediasDe(acc), con = [...m].filter(Number.isFinite);
  assert.ok(con.length > 1400, `${con.length} celdas con muestras`);
  assert.ok(con.every((v) => v === 1000));
  assert.ok(m.some(Number.isNaN));   // las de fuera de la tesela, sin dato
});
```

Run: `node --test tests/rejilla-terreno.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir `terreno.mjs`**

```js
// scripts/rejilla/terreno.mjs
// Orientación y pendiente de cada celda fina por el método de Horn sobre la rejilla de altitudes medias (250 m).
// Orientación = hacia dónde baja la ladera (N = umbría, S = solana). Tramos y «llano» (< 5 %): criterio propio, docs/datos.md.
export const tramoDe = (pct) => (pct < 5 ? 0 : pct < 15 ? 1 : pct < 30 ? 2 : 3);

export function orientacionPendiente(alt, ancho, alto, paso) {
  const n = ancho * alto, orientacion = new Uint8Array(n), tramo = new Uint8Array(n);
  for (let f = 0; f < alto; f++) for (let c = 0; c < ancho; c++) {
    const k = f * ancho + c, e = alt[k];
    if (!Number.isFinite(e)) continue;
    const z = (dc, df) => {   // vecina, repitiendo el borde; sin dato, la propia celda
      const cc = Math.min(ancho - 1, Math.max(0, c + dc)), ff = Math.min(alto - 1, Math.max(0, f + df));
      const v = alt[ff * ancho + cc];
      return Number.isFinite(v) ? v : e;
    };
    const a = z(-1, -1), b = z(0, -1), d = z(1, -1), iz = z(-1, 0), de = z(1, 0), g = z(-1, 1), h = z(0, 1), i = z(1, 1);
    const dzEste = ((d + 2 * de + i) - (a + 2 * iz + g)) / (8 * paso);
    const dzSur = ((g + 2 * h + i) - (a + 2 * b + d)) / (8 * paso);
    tramo[k] = tramoDe(100 * Math.hypot(dzEste, dzSur));
    if (tramo[k] === 0) continue;   // llano: sin orientación
    const az = ((Math.atan2(-dzEste, dzSur) * 180) / Math.PI + 360) % 360;   // rumbo de bajada desde el norte
    orientacion[k] = 1 + (Math.round(az / 45) % 8);
  }
  return { orientacion, tramo };
}
```

- [ ] **Step 3: Escribir `mdt.mjs` (Terrarium siempre; GeoTIFF si el sondeo eligió IGN o GLO-30)**

```js
// scripts/rejilla/mdt.mjs
// Modelo digital del terreno elegido en el sondeo (CONFIG.mdt) → altitud media de cada celda fina de 250 m.
// Las descargas se guardan en _fuentes/ (no van al repo) y no se repiten.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ORIGEN, TAM_FINA, aMercator, aGrados } from '../../js/rejilla/geo.js';

export const nuevoAcumulador = (n) => ({ suma: new Float64Array(n), cuenta: new Uint32Array(n) });
export function acumularPunto(acc, ventana, x, y, alt, tam = TAM_FINA) {
  if (!Number.isFinite(alt) || alt < -100 || alt > 4000) return;   // sin dato o valor de relleno
  const col = Math.floor((x + ORIGEN) / tam) - ventana.col0, fila = Math.floor((ORIGEN - y) / tam) - ventana.fila0;
  if (col < 0 || fila < 0 || col >= ventana.ancho || fila >= ventana.alto) return;
  const k = fila * ventana.ancho + col;
  acc.suma[k] += alt; acc.cuenta[k]++;
}
export const mediasDe = (acc) => Float32Array.from(acc.suma, (s, k) => (acc.cuenta[k] ? s / acc.cuenta[k] : NaN));

async function descargar(url, ruta, fetchFn) {
  if (existsSync(ruta)) return readFileSync(ruta);
  const r = await fetchFn(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  mkdirSync(ruta.slice(0, ruta.lastIndexOf('/')), { recursive: true });
  writeFileSync(ruta, b);
  return b;
}

// --- Terrarium (AWS Terrain Tiles): PNG 256 × 256 en EPSG:3857; altitud = R·256 + G + B/256 − 32768 ---
export const altitudTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;
export const ladoTesela = (z) => (2 * ORIGEN) / 2 ** z;
export function teselasDeVentana(ventana, z, tam = TAM_FINA) {
  const l = ladoTesela(z);
  const x0 = Math.floor((ventana.col0 * tam) / l), x1 = Math.floor(((ventana.col0 + ventana.ancho) * tam - 1e-6) / l);
  const y0 = Math.floor((ventana.fila0 * tam) / l), y1 = Math.floor(((ventana.fila0 + ventana.alto) * tam - 1e-6) / l);
  const r = [];
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) r.push({ tx, ty });
  return r;
}
export function acumularTesela(acc, ventana, { z, tx, ty, datos, canales = 4, lado = 256 }, tam = TAM_FINA) {
  const px = ladoTesela(z) / lado;
  for (let py = 0; py < lado; py++) {
    const y = ORIGEN - (ty * lado + py + 0.5) * px;
    for (let qx = 0; qx < lado; qx++) {
      const o = (py * lado + qx) * canales;
      acumularPunto(acc, ventana, (tx * lado + qx + 0.5) * px - ORIGEN, y, altitudTerrarium(datos[o], datos[o + 1], datos[o + 2]), tam);
    }
  }
}
async function altitudesTerrarium(ventana, { z = 12, carpeta = '_fuentes/terrarium', fetchFn = fetch } = {}) {
  const { default: sharp } = await import('sharp');
  const acc = nuevoAcumulador(ventana.ancho * ventana.alto);
  for (const { tx, ty } of teselasDeVentana(ventana, z)) {
    const png = await descargar(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`, `${carpeta}/${z}/${tx}/${ty}.png`, fetchFn);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    acumularTesela(acc, ventana, { z, tx, ty, datos: data, canales: info.channels, lado: info.width });
  }
  return mediasDe(acc);
}

// --- GeoTIFF (IGN WCS en EPSG:3857 por bloques, o teselas GLO-30 de 1° en EPSG:4326). Requiere `npm i -D geotiff`. ---
const BLOQUE = 400;   // celdas por lado de cada petición WCS (100 km)
async function leerTiff(buffer) {
  const { fromArrayBuffer } = await import('geotiff');
  const img = await (await fromArrayBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))).getImage();
  return { img, valores: (await img.readRasters({ interleave: true })), ancho: img.getWidth(), alto: img.getHeight(), bbox: img.getBoundingBox() };
}
async function altitudesGeoTiff(ventana, { fuente, plantillaUrl, carpeta = '_fuentes/mdt', fetchFn = fetch }) {
  const acc = nuevoAcumulador(ventana.ancho * ventana.alto);
  if (fuente === 'ign-wcs') {
    for (let f0 = 0; f0 < ventana.alto; f0 += BLOQUE) for (let c0 = 0; c0 < ventana.ancho; c0 += BLOQUE) {
      const an = Math.min(BLOQUE, ventana.ancho - c0), al = Math.min(BLOQUE, ventana.alto - f0);
      const oeste = (ventana.col0 + c0) * TAM_FINA - ORIGEN, norte = ORIGEN - (ventana.fila0 + f0) * TAM_FINA;
      const vals = { oeste, norte, este: oeste + an * TAM_FINA, sur: norte - al * TAM_FINA, ancho: an * 4, alto: al * 4 };
      const url = plantillaUrl.replace(/\{(\w+)\}/g, (_, k) => String(vals[k]));
      const t = await leerTiff(await descargar(url, `${carpeta}/wcs/${ventana.col0 + c0}_${ventana.fila0 + f0}.tif`, fetchFn));
      const [x0, y0, x1, y1] = t.bbox, dx = (x1 - x0) / t.ancho, dy = (y1 - y0) / t.alto;
      for (let py = 0; py < t.alto; py++) for (let qx = 0; qx < t.ancho; qx++) acumularPunto(acc, ventana, x0 + (qx + 0.5) * dx, y1 - (py + 0.5) * dy, t.valores[py * t.ancho + qx]);
    }
  } else {
    // Teselas GLO-30 de 1°: nombre con la esquina suroeste, p. ej. N40_00_W004_00.
    const nombre = (v, pos, neg, n) => `${v >= 0 ? pos : neg}${String(Math.abs(v)).padStart(n, '0')}_00`;
    const no = aGrados(ventana.col0 * TAM_FINA - ORIGEN, ORIGEN - ventana.fila0 * TAM_FINA);
    const se = aGrados((ventana.col0 + ventana.ancho) * TAM_FINA - ORIGEN, ORIGEN - (ventana.fila0 + ventana.alto) * TAM_FINA);
    for (let lat = Math.floor(se.lat); lat <= Math.floor(no.lat); lat++) for (let lon = Math.floor(no.lon); lon <= Math.floor(se.lon); lon++) {
      const url = plantillaUrl.replaceAll('{lat}', nombre(lat, 'N', 'S', 2)).replaceAll('{lon}', nombre(lon, 'E', 'W', 3));
      const t = await leerTiff(await descargar(url, `${carpeta}/glo30/${lat}_${lon}.tif`, fetchFn));
      const [x0, y0, x1, y1] = t.bbox, dx = (x1 - x0) / t.ancho, dy = (y1 - y0) / t.alto;
      for (let py = 0; py < t.alto; py++) for (let qx = 0; qx < t.ancho; qx++) {
        const m = aMercator(x0 + (qx + 0.5) * dx, y1 - (py + 0.5) * dy);
        acumularPunto(acc, ventana, m.x, m.y, t.valores[py * t.ancho + qx]);
      }
    }
  }
  return mediasDe(acc);
}

export async function leerAltitudes(ventana, conf, opciones = {}) {
  if (conf.fuente === 'terrarium') return altitudesTerrarium(ventana, { z: conf.z ?? 12, ...opciones });
  if (conf.fuente === 'ign-wcs' || conf.fuente === 'glo30') return altitudesGeoTiff(ventana, { fuente: conf.fuente, plantillaUrl: conf.plantillaUrl, ...opciones });
  throw new Error(`MDT desconocido: ${conf.fuente}`);
}
```

Si `CONFIG.mdt.fuente` es `ign-wcs` o `glo30`, instalar el lector: `npm i -D geotiff` (solo para este script; el navegador no lo carga). Con `terrarium` no hace falta. En GLO-30 la plantilla del sondeo puede llevar `{lat}` y `{lon}` más de una vez (carpeta y archivo): `replaceAll` los cambia todos. La plantilla de IGN WCS usa `{oeste}`, `{sur}`, `{este}`, `{norte}` (metros EPSG:3857) y `{ancho}`, `{alto}` (píxeles: 4 por celda, unos 62 m).

- [ ] **Step 4: Ejecutar la prueba**

Run: `node --test tests/rejilla-terreno.test.js`
Expected: PASS (5 pruebas).

- [ ] **Step 5: Probar la lectura real en una ventana pequeña**

Run: `node -e "import('./scripts/rejilla/mdt.mjs').then(async (m) => { const { CONFIG } = await import('./scripts/rejilla/config.mjs'); const a = await m.leerAltitudes({ col0: 78371, fila0: 60187, ancho: 4, alto: 4 }, CONFIG.mdt); console.log([...a].map(Math.round)); })"`
Expected: 16 altitudes entre 1.400 y 1.700 m (Pinar de Valsaín: el punto `guadarrama-valsain-pinar` de `data/zonas.json` está a 1.561 m). Si salen `NaN` o valores absurdos, revisar la fuente antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add scripts/rejilla/terreno.mjs scripts/rejilla/mdt.mjs tests/rejilla-terreno.test.js package.json package-lock.json
git commit -m "$(cat <<'EOF'
Rejilla: altitud media por celda desde el MDT, orientación y pendiente (Horn)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 7: Ajuste de humedad por orientación (orientativo, investigado)

La spec pide un modificador umbría frente a solana **orientativo**, con valores y fuentes en `docs/datos.md`. No se inventan cifras: el implementador investiga; si no encuentra una fuente con un número utilizable, el ajuste se queda **neutro (1 en todas)** y así se documenta. El valor multiplica `fW` (lluvia de 26 días) en `indiceDesdeAgregados` (tarea 1).

**Files:**
- Create: `js/rejilla/orientacion.js`
- Modify: `docs/datos.md` (sección «Ajuste por orientación»), `docs/investigacion/08-rejilla-fuentes.md` (apartado D7)
- Test: `tests/rejilla-orientacion.test.js`

**Interfaces:**
- Consumes: `ORIENTACIONES` de `js/rejilla/formato.js`.
- Produces: `AJUSTE_ORIENTACION` (objeto congelado `{ llano, N, NE, E, SE, S, SO, O, NO }` → número), `FUENTES_ORIENTACION` (`[{ url, titulo, consultado, que }]`), `ajusteHumedad(codigo 0..8) → número` (1 para códigos desconocidos), `esOrientativo(codigo) → booleano` (ajuste distinto de 1).

- [ ] **Step 1: Escribir la prueba**

```js
// tests/rejilla-orientacion.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AJUSTE_ORIENTACION, FUENTES_ORIENTACION, ajusteHumedad, esOrientativo } from '../js/rejilla/orientacion.js';
import { ORIENTACIONES } from '../js/rejilla/formato.js';

test('ajuste por orientación: una entrada por rumbo, llano neutro', () => {
  assert.deepEqual(Object.keys(AJUSTE_ORIENTACION).sort(), [...ORIENTACIONES].sort());
  assert.equal(AJUSTE_ORIENTACION.llano, 1);
  assert.equal(ajusteHumedad(0), 1);
  assert.equal(ajusteHumedad(99), 1);
  assert.equal(esOrientativo(0), false);
});

test('ajuste por orientación: conservador (entre 0,85 y 1,15) y, si no es neutro, con fuente citada', () => {
  for (const [k, v] of Object.entries(AJUSTE_ORIENTACION)) assert.ok(v >= 0.85 && v <= 1.15, `${k}: ${v}`);
  if (Object.values(AJUSTE_ORIENTACION).some((v) => v !== 1)) {
    assert.ok(FUENTES_ORIENTACION.length > 0, 'hay valores distintos de 1 sin fuente');
    for (const f of FUENTES_ORIENTACION) {
      assert.match(f.url, /^https?:\/\//);
      assert.match(f.consultado, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(f.titulo && f.que);
    }
  }
});
```

Run: `node --test tests/rejilla-orientacion.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir el módulo con el valor neutro**

```js
// js/rejilla/orientacion.js
// Ajuste ORIENTATIVO de la humedad (multiplica fW) según la orientación de la ladera: umbría frente a solana.
// No hay calibración local. Valores y fuentes: docs/datos.md («Ajuste por orientación»). Sin fuente, todo vale 1.
import { ORIENTACIONES } from './formato.js';

export const AJUSTE_ORIENTACION = Object.freeze({ llano: 1, N: 1, NE: 1, E: 1, SE: 1, S: 1, SO: 1, O: 1, NO: 1 });
export const FUENTES_ORIENTACION = Object.freeze([]);
export const ajusteHumedad = (codigo) => AJUSTE_ORIENTACION[ORIENTACIONES[codigo]] ?? 1;
export const esOrientativo = (codigo) => ajusteHumedad(codigo) !== 1;
```

Run: `node --test tests/rejilla-orientacion.test.js`
Expected: PASS (2 pruebas).

- [ ] **Step 3: Investigar y, solo si hay fuente, fijar valores**

Buscar (con WebSearch y leyendo el texto de la fuente, no solo resúmenes) estudios que midan el efecto de la orientación en la fructificación o en la humedad del suelo de bosques ibéricos o mediterráneos de montaña. Términos: «orientación umbría solana producción setas», «aspect sporocarp production Mediterranean pine forest», «north-facing slope mushroom yield Spain», «exposición norte producción micológica Castilla y León», «soil moisture north south facing slopes Mediterranean mountains». Candidatos a comprobar (sin dar por buenas sus cifras hasta leerlas): trabajos del CTFC y la Universidad de Lleida sobre producción micológica en pinares del Prepirineo y de Cataluña, trabajos de Cesefor/Micocyl en Soria, y estudios de humedad del suelo por orientación en sierras ibéricas.

Criterio, escrito en el apartado **D7. Orientación** del informe 08:
- Vale una fuente revisada por pares o un informe técnico oficial con un número (razón de producción, de humedad del suelo o de días con setas entre umbría y solana) en bosques comparables.
- **Valor conservador:** el punto medio entre 1 y la razón publicada, dentro de 0,85 y 1,15 (la prueba lo exige). Las diagonales (NE, NO, SE, SO) llevan la mitad del efecto de su rumbo principal; E, O y llano se quedan en 1.
- Si no hay ninguna fuente que cumpla, se deja el valor neutro y se escribe así en el informe y en `docs/datos.md`.

Si hay fuente, cambiar en `js/rejilla/orientacion.js` los valores de `AJUSTE_ORIENTACION` y añadir cada fuente a `FUENTES_ORIENTACION` como `{ url, titulo, consultado: 'AAAA-MM-DD', que: 'qué mide y qué número da' }`.

- [ ] **Step 4: Documentar en `docs/datos.md`**

Añadir tras la sección de la tarea 5:

```markdown
## Ajuste por orientación (orientativo)

`js/rejilla/orientacion.js` multiplica el factor de lluvia de 26 días (`fW`) según la orientación de la ladera
(umbría N, NE, NO; solana S, SE, SO). **Orientativo:** no hay calibración con datos de estas zonas; la hoja del mapa lo
marca así cuando el ajuste no es 1. Criterio y búsqueda: `docs/investigacion/08-rejilla-fuentes.md`, apartado D7.

| Orientación | Ajuste de fW | Fuente |
|---|---|---|
| Llano | 1 | neutro por definición |
| N | 1 | sin fuente con cifra: neutro |
| NE | 1 | sin fuente con cifra: neutro |
| E | 1 | neutro por definición |
| SE | 1 | sin fuente con cifra: neutro |
| S | 1 | sin fuente con cifra: neutro |
| SO | 1 | sin fuente con cifra: neutro |
| O | 1 | neutro por definición |
| NO | 1 | sin fuente con cifra: neutro |
```

Si el paso 3 fijó valores, cambiar en esta tabla el número de cada fila por el de `AJUSTE_ORIENTACION` y la columna «Fuente» por el título y la URL de la entrada de `FUENTES_ORIENTACION` de la que sale.

- [ ] **Step 5: Ejecutar la prueba y commit**

Run: `node --test tests/rejilla-orientacion.test.js`
Expected: PASS.

```bash
git add js/rejilla/orientacion.js tests/rejilla-orientacion.test.js docs/datos.md docs/investigacion/08-rejilla-fuentes.md
git commit -m "$(cat <<'EOF'
Rejilla: ajuste orientativo de humedad por orientación, con su búsqueda de fuentes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 8: Generador de la rejilla y datos reales

**Files:**
- Create: `scripts/rejilla/generar.mjs`
- Create (generados): `data/rejilla/indice.json`, `data/rejilla/gruesa.json`, `data/rejilla/*.bin`, `supabase/functions/rejilla/gruesa.json`
- Modify: `docs/datos.md` (sección «Formato de la rejilla» con la tabla de tamaños)
- Test: `tests/rejilla-generar.test.js`, `tests/rejilla-datos.test.js`

**Interfaces:**
- Consumes: tareas 3 a 6; `CONFIG`; `HABITATS`, `puntoEnGeometria` de `scripts/validar-datos.mjs`; `bboxDe` de `js/rejilla/geo.js`.
- Produces: `indiceEspacial(features, paso?) → { buscar(lon, lat) → feature|null }`; `construirZona({ zona, ventana, altitudes, mfeEn, prohibidoEn }) → { habitat, terreno, altitud }`; `gruesasDeZona(zona, ventana, planos, paso) → [{ id, zona, lon, lat, altRef, habitats, nFinas }]`; `elegirPaso(contar, candidatos, maximo) → paso`; `async partirEnBandas(cabecera, planos, maxBytes) → [{ archivo, cabecera, bytes }]`.
- Produces (datos): `data/rejilla/indice.json = { version: 1, generado, tam: 250, fuentes, archivos: [{ zona, archivo, col0, fila0, ancho, alto, bytes }] }`; `data/rejilla/gruesa.json = { version: 1, generado, ancla, pasos: { [zona]: paso }, celdas: [{ id, zona, lon, lat, altRef, habitats, nFinas }] }` (copia idéntica en `supabase/functions/rejilla/gruesa.json`).

- [ ] **Step 1: Escribir la prueba del generador**

```js
// tests/rejilla-generar.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirZona, gruesasDeZona, elegirPaso, partirEnBandas, indiceEspacial } from '../scripts/rejilla/generar.mjs';
import { decodificarRejilla, PROHIBIDO, ORIENTACIONES } from '../js/rejilla/formato.js';
import { HABITATS } from '../scripts/validar-datos.mjs';

const zona = { id: 'guadarrama', bbox: [-4.25, 40.65, -3.7701, 41.05] };
const ventana = { col0: 78361, fila0: 60161, ancho: 4, alto: 3 };   // celdas alrededor del centro de guadarrama:66:65
const altitudes = Float32Array.from({ length: 12 }, (_, k) => 1500 + Math.floor(k / 4) * 25);   // sube 25 m por fila hacia el sur

test('construirZona: prohibido con marca y sin hábitat; sin monte, todo a 0; con monte, hábitat, terreno y altitud', () => {
  const p = construirZona({ zona, ventana, altitudes,
    mfeEn: (lon, lat, alt) => (alt > 0 ? 'pinar-silvestre' : null),
    prohibidoEn: (lon, lat) => lon < -4.0155 && lat > 40.896 });   // solo la celda (0, 0): -4,0167, 40,8968
  const k = (c, f) => f * 4 + c;
  assert.equal(p.habitat[k(0, 0)], PROHIBIDO);
  assert.equal(p.altitud[k(0, 0)], 0);
  assert.equal(p.habitat[k(1, 1)], HABITATS.indexOf('pinar-silvestre') + 1);
  assert.equal(ORIENTACIONES[p.terreno[k(1, 1)] & 0x0f], 'N');   // 25 m cada 189 m reales: 13 %, umbría
  assert.equal(p.terreno[k(1, 1)] >> 4, 1);
  assert.equal(p.altitud[k(1, 1)], 1525);
  const sinMonte = construirZona({ zona, ventana, altitudes, mfeEn: () => null, prohibidoEn: () => false });
  assert.ok(sinMonte.habitat.every((h) => h === 0) && sinMonte.terreno.every((t) => t === 0) && sinMonte.altitud.every((a) => a === 0));
});

test('gruesasDeZona: altitud de referencia = media de las celdas con monte; las prohibidas no cuentan', () => {
  const planos = construirZona({ zona, ventana, altitudes, mfeEn: () => 'pinar-silvestre', prohibidoEn: (lon) => lon < -4.0155 });   // la columna 0
  const g = gruesasDeZona(zona, ventana, planos, 0.09);
  assert.equal(g.length, 1);
  assert.equal(g[0].id, 'guadarrama:66:65');
  assert.deepEqual(g[0].habitats, ['pinar-silvestre']);
  assert.equal(g[0].nFinas, 12 - planos.habitat.filter((h) => h & PROHIBIDO).length);
  const conMonte = [...planos.altitud].filter((a, k) => !(planos.habitat[k] & PROHIBIDO));
  assert.equal(g[0].altRef, Math.round(conMonte.reduce((a, b) => a + b, 0) / conMonte.length));
  assert.ok(Math.abs(g[0].lon - -4.015) < 1e-9 && Math.abs(g[0].lat - 40.895) < 1e-9);
});

test('elegirPaso: el más fino que no pase del máximo', () => {
  const cuenta = { 0.09: 1190, 0.12: 670, 0.15: 430, 0.18: 300 };
  assert.equal(elegirPaso((p) => cuenta[p], [0.09, 0.12, 0.15, 0.18], 350), 0.18);
  assert.equal(elegirPaso((p) => cuenta[p], [0.09, 0.12, 0.15, 0.18], 700), 0.12);
  assert.equal(elegirPaso(() => 5000, [0.09, 0.12], 350), 0.12);
});

test('partirEnBandas: parte por filas hasta que cada archivo cabe, y las bandas juntas son la zona', async () => {
  const ancho = 60, alto = 40, n = ancho * alto;
  let s = 7; const azar = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const planos = { habitat: Uint8Array.from({ length: n }, () => Math.floor(azar() * 17)), terreno: Uint8Array.from({ length: n }, () => Math.floor(azar() * 64)),
    altitud: Int16Array.from({ length: n }, () => Math.floor(azar() * 3000)) };
  const fuente = { nombre: 'x', url: 'https://x.es', fecha: '2026-10-01' };
  const cab = { version: 1, zona: 'soria', tam: 250, col0: 0, fila0: 100, ancho, alto, habitats: HABITATS, fuentes: { mfe: fuente, mdt: fuente }, generado: '2026-10-01' };
  const entera = await partirEnBandas(cab, planos, 1e9);
  assert.deepEqual(entera.map((b) => b.archivo), ['soria.bin']);
  const max = Math.ceil(entera[0].bytes.length / 2.5);
  const bandas = await partirEnBandas(cab, planos, max);
  assert.ok(bandas.length >= 3);
  assert.deepEqual(bandas.map((b) => b.archivo), bandas.map((_, k) => `soria-${k + 1}.bin`));
  assert.ok(bandas.every((b) => b.bytes.length <= max));
  const altos = [];
  for (const b of bandas) { const r = await decodificarRejilla(b.bytes); altos.push(...r.altitud); assert.equal(r.cabecera.fila0, 100 + bandas.slice(0, bandas.indexOf(b)).reduce((t, x) => t + x.cabecera.alto, 0)); }
  assert.deepStrictEqual(Int16Array.from(altos), planos.altitud);
});

test('indiceEspacial: encuentra el polígono que contiene el punto', () => {
  const f = { type: 'Feature', properties: { id: 'a' }, geometry: { type: 'Polygon', coordinates: [[[-4, 40], [-3.9, 40], [-3.9, 40.1], [-4, 40.1], [-4, 40]]] } };
  const i = indiceEspacial([f]);
  assert.equal(i.buscar(-3.95, 40.05)?.properties.id, 'a');
  assert.equal(i.buscar(-3.85, 40.05), null);
});
```

Run: `node --test tests/rejilla-generar.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir el generador**

```js
// scripts/rejilla/generar.mjs
// Genera la rejilla fina estática (data/rejilla/) desde el MFE50, el MDT y las zonas prohibidas de data/cotos.geojson.
// Uso (en local, nunca en el navegador): node --max-old-space-size=8192 scripts/rejilla/generar.mjs
// Necesita las descargas de la tarea 0 en _fuentes/. Apunta en la consola el tamaño de cada archivo (docs/datos.md).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HABITATS, puntoEnGeometria } from '../validar-datos.mjs';
import { ventanaBbox, centroFina, aGrados, idGruesa, centroGruesa, metrosSuelo, bboxDe, TAM_FINA, ANCLA } from '../../js/rejilla/geo.js';
import { codificarRejilla, PROHIBIDO } from '../../js/rejilla/formato.js';
import { orientacionPendiente } from './terreno.mjs';
import { habitatDeTesela, leerTeselaMfe } from './mfe-habitat.mjs';
import { leerAltitudes } from './mdt.mjs';
import { CONFIG } from './config.mjs';

// Cubos de `paso` grados con las geometrías cuyo bbox los toca; buscar() prueba solo las de su cubo.
export function indiceEspacial(features, paso = 0.02) {
  const cubos = new Map(), clave = (i, j) => `${i}:${j}`;
  features.forEach((f, n) => {
    const [o, s, e, no] = bboxDe(f.geometry);
    for (let i = Math.floor(o / paso); i <= Math.floor(e / paso); i++) for (let j = Math.floor(s / paso); j <= Math.floor(no / paso); j++) {
      const k = clave(i, j);
      if (!cubos.has(k)) cubos.set(k, []);
      cubos.get(k).push(n);
    }
  });
  return {
    buscar(lon, lat) {
      for (const n of cubos.get(clave(Math.floor(lon / paso), Math.floor(lat / paso))) ?? []) if (puntoEnGeometria(lon, lat, features[n].geometry)) return features[n];
      return null;
    },
  };
}

// Planos de una zona. mfeEn(lon, lat, altitud) → hábitat o null; prohibidoEn(lon, lat) → booleano.
// Prohibido: hábitat 0 con la marca, nunca mancha. Sin monte: todo a 0 (también terreno y altitud, para que comprima).
export function construirZona({ zona, ventana, altitudes, mfeEn, prohibidoEn }) {
  const n = ventana.ancho * ventana.alto;
  const habitat = new Uint8Array(n), terreno = new Uint8Array(n), altitud = new Int16Array(n);
  const lat = (zona.bbox[1] + zona.bbox[3]) / 2;
  const { orientacion, tramo } = orientacionPendiente(altitudes, ventana.ancho, ventana.alto, metrosSuelo(TAM_FINA, lat));
  for (let f = 0; f < ventana.alto; f++) for (let c = 0; c < ventana.ancho; c++) {
    const k = f * ventana.ancho + c;
    const { x, y } = centroFina(ventana.col0 + c, ventana.fila0 + f);
    const p = aGrados(x, y);
    if (prohibidoEn(p.lon, p.lat)) { habitat[k] = PROHIBIDO; continue; }
    const alt = altitudes[k];
    if (!Number.isFinite(alt)) continue;
    const h = mfeEn(p.lon, p.lat, alt);
    const codigo = h ? HABITATS.indexOf(h) + 1 : 0;
    if (!codigo) continue;
    habitat[k] = codigo;
    terreno[k] = orientacion[k] | (tramo[k] << 4);
    altitud[k] = Math.round(alt);
  }
  return { habitat, terreno, altitud };
}

export function gruesasDeZona(zona, ventana, planos, paso) {
  const acc = new Map();
  for (let f = 0; f < ventana.alto; f++) for (let c = 0; c < ventana.ancho; c++) {
    const k = f * ventana.ancho + c, h = planos.habitat[k];
    if (h === 0 || h & PROHIBIDO) continue;
    const { x, y } = centroFina(ventana.col0 + c, ventana.fila0 + f), p = aGrados(x, y);
    const id = idGruesa(zona.id, p.lon, p.lat, paso);
    const g = acc.get(id) ?? { suma: 0, n: 0, habitats: new Set() };
    g.suma += planos.altitud[k]; g.n++; g.habitats.add(HABITATS[h - 1]);
    acc.set(id, g);
  }
  return [...acc].map(([id, g]) => {
    const { lon, lat } = centroGruesa(id, paso);
    return { id, zona: zona.id, lon: Math.round(lon * 1e4) / 1e4, lat: Math.round(lat * 1e4) / 1e4, altRef: Math.round(g.suma / g.n), habitats: [...g.habitats].sort(), nFinas: g.n };
  }).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function elegirPaso(contar, candidatos, maximo) {
  for (const p of candidatos) if (contar(p) <= maximo) return p;
  return candidatos.at(-1);
}

export async function partirEnBandas(cabecera, planos, maxBytes) {
  const { ancho, alto } = cabecera;
  for (let intento = 1; intento <= alto; intento++) {
    const altoBanda = Math.ceil(alto / intento), partes = Math.ceil(alto / altoBanda), r = [];
    for (let p = 0; p < partes; p++) {
      const f0 = p * altoBanda, f1 = Math.min(alto, f0 + altoBanda);
      const corte = (a) => a.slice(f0 * ancho, f1 * ancho);
      const cab = partes === 1 ? cabecera : { ...cabecera, fila0: cabecera.fila0 + f0, alto: f1 - f0, parte: p + 1, partes };
      const bytes = await codificarRejilla(cab, { habitat: corte(planos.habitat), terreno: corte(planos.terreno), altitud: corte(planos.altitud) });
      if (bytes.length > maxBytes) break;
      r.push({ archivo: partes === 1 ? `${cabecera.zona}.bin` : `${cabecera.zona}-${p + 1}.bin`, cabecera: cab, bytes });
    }
    if (r.length === partes) return r;
  }
  throw new Error(`${cabecera.zona}: ni fila a fila cabe en ${maxBytes} bytes`);
}

async function main() {
  const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
  const zonas = leer('data/zonas.json').zonas;
  const prohibidos = indiceEspacial(leer('data/cotos.geojson').features.filter((f) => f.properties.tipo === 'prohibido'));
  const diccionario = leer('scripts/rejilla/mfe-diccionario.json');
  const fuentes = { mfe: { nombre: CONFIG.mfe.nombre, url: CONFIG.mfe.url, fecha: CONFIG.mfe.fecha }, mdt: { nombre: CONFIG.mdt.nombre, url: CONFIG.mdt.url, fecha: CONFIG.mdt.fecha } };
  const generado = new Date().toISOString().slice(0, 10);
  mkdirSync('data/rejilla', { recursive: true });
  mkdirSync('supabase/functions/rejilla', { recursive: true });
  const archivos = [], porZona = [];
  for (const zona of zonas) {
    const ventana = ventanaBbox(zona.bbox);
    const mfe = indiceEspacial(zona.provincias.flatMap((p) => leer(CONFIG.mfe.archivos[p]).features));
    const altitudes = await leerAltitudes(ventana, CONFIG.mdt);
    const planos = construirZona({ zona, ventana, altitudes,
      mfeEn: (lon, lat, alt) => { const f = mfe.buscar(lon, lat); return f ? habitatDeTesela(leerTeselaMfe(f.properties, CONFIG.mfe, diccionario), alt, CONFIG.mfe) : null; },
      prohibidoEn: (lon, lat) => !!prohibidos.buscar(lon, lat) });
    const cabecera = { version: 1, zona: zona.id, tam: TAM_FINA, ...ventana, habitats: HABITATS, fuentes, generado };
    for (const b of await partirEnBandas(cabecera, planos, CONFIG.maxBytesArchivo)) {
      writeFileSync(`data/rejilla/${b.archivo}`, b.bytes);
      const { col0, fila0, ancho, alto } = b.cabecera;
      archivos.push({ zona: zona.id, archivo: b.archivo, col0, fila0, ancho, alto, bytes: b.bytes.length });
    }
    porZona.push({ zona, ventana, planos });
    const conMonte = planos.habitat.filter((h) => h && !(h & PROHIBIDO)).length;
    console.log(`${zona.id}: ${ventana.ancho} × ${ventana.alto} celdas, ${conMonte} con monte, ${planos.habitat.filter((h) => h & PROHIBIDO).length} prohibidas`);
  }
  const contar = (paso) => porZona.reduce((t, z) => t + gruesasDeZona(z.zona, z.ventana, z.planos, paso).length, 0);
  const paso = elegirPaso(contar, CONFIG.gruesa.candidatos, CONFIG.gruesa.maximo);
  const celdas = porZona.flatMap((z) => gruesasDeZona(z.zona, z.ventana, z.planos, paso));
  const gruesa = { version: 1, generado, ancla: ANCLA, pasos: Object.fromEntries(porZona.map((z) => [z.zona.id, paso])), celdas };
  const texto = `${JSON.stringify(gruesa)}\n`;
  writeFileSync('data/rejilla/gruesa.json', texto);
  writeFileSync('supabase/functions/rejilla/gruesa.json', texto);   // la Edge Function la importa (mismo patrón que aemet/estaciones.json)
  writeFileSync('data/rejilla/indice.json', `${JSON.stringify({ version: 1, generado, tam: TAM_FINA, fuentes, archivos }, null, 1)}\n`);
  console.log(`\nCeldas gruesas: ${celdas.length} con paso ${paso}° (candidatos: ${CONFIG.gruesa.candidatos.map((p) => `${p}° → ${contar(p)}`).join(', ')})`);
  console.log('\n| Archivo | Celdas | KB |\n|---|---|---|');
  for (const a of archivos) console.log(`| ${a.archivo} | ${a.ancho} × ${a.alto} | ${Math.round(a.bytes / 1024)} |`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
```

- [ ] **Step 3: Ejecutar la prueba**

Run: `node --test tests/rejilla-generar.test.js`
Expected: PASS (5 pruebas).

- [ ] **Step 4: Escribir la prueba de los datos reales (se salta si aún no hay datos)**

```js
// tests/rejilla-datos.test.js
// Sobre los datos generados: ninguna celda dentro de un polígono prohibido tiene hábitat, y la copia de la función
// es idéntica. Se salta si todavía no se ha generado data/rejilla/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { decodificarRejilla, PROHIBIDO, CODIGO } from '../js/rejilla/formato.js';
import { centroFina, aGrados } from '../js/rejilla/geo.js';
import { indiceEspacial } from '../scripts/rejilla/generar.mjs';
import { HABITATS } from '../scripts/validar-datos.mjs';

const hay = existsSync('data/rejilla/indice.json');
const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));

test('ninguna celda dentro de un polígono prohibido tiene hábitat (y todas llevan la marca)', { skip: !hay }, async () => {
  const prohibidos = indiceEspacial(leer('data/cotos.geojson').features.filter((f) => f.properties.tipo === 'prohibido'));
  let dentro = 0;
  for (const a of leer('data/rejilla/indice.json').archivos) {
    const r = await decodificarRejilla(readFileSync(`data/rejilla/${a.archivo}`));
    const c = r.cabecera;
    for (let f = 0; f < c.alto; f++) for (let col = 0; col < c.ancho; col++) {
      const k = f * c.ancho + col, h = r.habitat[k];
      assert.ok((h & CODIGO) <= HABITATS.length, `${a.archivo}: código ${h & CODIGO}`);
      const { x, y } = centroFina(c.col0 + col, c.fila0 + f), p = aGrados(x, y);
      if (!prohibidos.buscar(p.lon, p.lat)) continue;
      dentro++;
      assert.equal(h & CODIGO, 0, `${a.archivo} celda ${k}: hábitat dentro de un prohibido`);
      assert.ok(h & PROHIBIDO, `${a.archivo} celda ${k}: sin marca de prohibido`);
    }
  }
  assert.ok(dentro > 0, 'ninguna celda cae en un prohibido: revisa la generación');
});

test('la Edge Function lleva la misma lista de celdas gruesas', { skip: !hay }, () => {
  assert.equal(readFileSync('supabase/functions/rejilla/gruesa.json', 'utf8'), readFileSync('data/rejilla/gruesa.json', 'utf8'));
});
```

- [ ] **Step 5: Generar los datos reales**

Run: `node --max-old-space-size=8192 scripts/rejilla/generar.mjs | tee _fuentes/generar.log`
Expected: una línea por zona, el paso elegido con el recuento de celdas gruesas por candidato y la tabla de archivos, cada uno de 300 KB o menos. Tarda (descargas del MDT la primera vez); se puede relanzar porque las descargas quedan en `_fuentes/`.

- [ ] **Step 6: Contrastar con los puntos conocidos**

Run: `node -e "import('./js/rejilla/formato.js').then(async ({ decodificarRejilla, CODIGO, PROHIBIDO }) => { const { aMercator, celdaFina } = await import('./js/rejilla/geo.js'); const fs = await import('node:fs'); const ind = JSON.parse(fs.readFileSync('data/rejilla/indice.json')); for (const z of JSON.parse(fs.readFileSync('data/zonas.json')).zonas) for (const p of z.puntos) { const m = aMercator(p.lon, p.lat), c = celdaFina(m.x, m.y); const a = ind.archivos.find((x) => x.zona === z.id && c.col >= x.col0 && c.col < x.col0 + x.ancho && c.fila >= x.fila0 && c.fila < x.fila0 + x.alto); if (!a) { console.log(p.id, 'fuera'); continue; } const r = await decodificarRejilla(fs.readFileSync('data/rejilla/' + a.archivo)); const k = (c.fila - a.fila0) * a.ancho + (c.col - a.col0), h = r.habitat[k]; console.log(p.id, p.habitat, '→', h & PROHIBIDO ? 'prohibido' : (h & CODIGO) ? r.cabecera.habitats[(h & CODIGO) - 1] : 'sin monte', r.altitud[k], 'm (punto:', p.altitud, 'm)'); } })"`
Expected: una línea por punto. Copiar la salida a `docs/datos.md` (sección de abajo) y comentar las discrepancias de hábitat o de más de 100 m de altitud: no se corrigen a mano (la rejilla manda lo que dice el MFE50), pero si más de la mitad de los puntos sale «sin monte», parar y revisar `CONFIG.mfe` o `FCC_MINIMA` con la usuaria.

- [ ] **Step 7: Documentar el formato y los tamaños en `docs/datos.md`**

```markdown
## Formato de la rejilla (data/rejilla/)

- `indice.json`: lista de archivos (`zona`, `archivo`, `col0`, `fila0`, `ancho`, `alto`, `bytes`), fuentes y fecha.
- `<zona>.bin` o `<zona>-<n>.bin`: formato `SETR` v1 (`js/rejilla/formato.js`). Celdas de 250 m de Web Mercator
  (EPSG:3857; en estas latitudes, unos 190 m sobre el terreno) alineadas con la malla de teselas; columna y fila
  globales desde la esquina noroeste del mundo. Una zona se parte en bandas de filas si pasa de 300 KB.
- `gruesa.json`: celdas gruesas con monte (id `zona:col:fila` en pasos de `pasos[zona]` grados desde 10° O y 35° N),
  su centro (donde se pide la meteo) y su altitud de referencia (media de sus celdas finas con monte). La Edge Function
  lleva una copia idéntica (`supabase/functions/rejilla/gruesa.json`, una prueba lo comprueba).
- Orientación por el método de Horn sobre la rejilla de 250 m; «llano» si la pendiente es menor del 5 %. Tramos de
  pendiente: menos del 5 %, del 5 al 15 %, del 15 al 30 % y 30 % o más (criterio propio).

Generado el AAAA-MM-DD con `scripts/rejilla/generar.mjs` (MFE50 de AAAA-MM-DD, MDT: CONFIG.mdt.nombre):

(pegar aquí la tabla de archivos y el recuento de celdas gruesas de `_fuentes/generar.log`, y la comprobación de puntos del paso 6)
```

Sustituir las tres marcas `AAAA-MM-DD`, el nombre del MDT y el párrafo entre paréntesis por los datos reales del log.

- [ ] **Step 8: Ejecutar todo**

Run: `npm run comprobar`
Expected: PASS, incluidas las dos pruebas de `tests/rejilla-datos.test.js` (ya no se saltan) y `✓ Datos válidos` con la validación de `data/rejilla/`.

- [ ] **Step 9: Commit**

```bash
git add scripts/rejilla/generar.mjs tests/rejilla-generar.test.js tests/rejilla-datos.test.js data/rejilla supabase/functions/rejilla/gruesa.json docs/datos.md
git commit -m "$(cat <<'EOF'
Rejilla: generador y rejilla fina de las 11 zonas (MFE50 + MDT, prohibidos sin hábitat)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 9: Formato del índice diario publicado

La spec (§3.2) pide que el archivo publicado lleve, por celda gruesa, especie y día, los factores que no dependen de la ladera. Esos factores (fW, fR, fS, fA, fC y el ambiente secante) salen de unos pocos **agregados que son los mismos para todas las especies** (tarea 1): se publican los agregados y el móvil aplica `indiceDesdeAgregados` con los umbrales de cada especie. Mismo resultado, un archivo unas 30 veces menor, y los umbrales editados en `ajustes_umbrales` se aplican al instante, igual que en Hoy y Zona.

Archivo `indice/<sello>.json` (bucket `indice`; `sello` = `AAAA-MM-DDTHH`, hora de Madrid):

```json
{ "version": 1, "sello": "2026-10-01T07", "generado": "2026-10-01T05:03:12.000Z", "hoy": "2026-10-01",
  "fechas": ["2026-10-01", "…10 días…"],
  "celdas": { "guadarrama:66:65": { "altRef": 1480, "incompleta": false,
      "lluvia": { "desde": "2026-08-03", "hoy": 59, "mm": [2, 0, "…"] },
      "dias": [[106, 60, 17, 60, 194, 0, 13, 13, 6, 6, 6, 6, 6, 6, 6], null, "…"] } } }
```

Cada día es `[P26, P3, lag, pct, Pagosto, secante (0/1), T20aire, T20suelo, tmin × 7]` a la altitud de referencia, redondeado a 2 decimales; `null` si ese día no se pudo calcular. `indice/ultimo.json = { version, sello, archivo, generado, conDatos, total }`.

**Files:**
- Create: `supabase/functions/_shared/salida-indice.js`
- Create: `js/rejilla/salida.js` (reexportación)
- Test: `tests/rejilla-salida.test.js`

**Interfaces:**
- Consumes: `agregadosDia`, `DatosIncompletos` (tarea 1); `sumarDias` (tarea 2).
- Produces: `VERSION_SALIDA = 1`, `CAMPOS_DIA`; `empaquetarDia(ag) → number[]|null`; `desempaquetarDia(lista, fecha, prevision) → ag|null`; `diaConDatos(lista) → booleano` (tiene P26 y T20aire); `resumirCelda({ altRef, serie, fechas }) → { altRef, incompleta, lluvia: { desde, hoy, mm }, dias }`; `agregadosDeCelda(salida, id, fecha) → ag|null`; `serieLluvia(celda) → { fechas, precip, hoy }` (para `graficoLluvia`); `validarSalida(salida) → string[]`.

- [ ] **Step 1: Escribir la prueba**

```js
// tests/rejilla-salida.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empaquetarDia, desempaquetarDia, diaConDatos, resumirCelda, agregadosDeCelda, serieLluvia, validarSalida } from '../js/rejilla/salida.js';
import { agregadosDia } from '../js/indice.js';
import { serieSintetica, lluviaBuena } from './ayudas.js';

test('empaquetar y desempaquetar un día: ida y vuelta exacta', () => {
  const ag = agregadosDia(serieSintetica({ precip: lluviaBuena }), 59);
  const lista = empaquetarDia(ag);
  assert.deepEqual(lista, [106, 60, 17, 60, 194, 0, 13, 13, 6, 6, 6, 6, 6, 6, 6]);
  assert.deepStrictEqual(desempaquetarDia(JSON.parse(JSON.stringify(lista)), ag.fecha, ag.prevision), ag);
  assert.equal(empaquetarDia(null), null);
  assert.equal(desempaquetarDia(null, '2026-10-01', false), null);
  assert.equal(desempaquetarDia([1, 2, 3], '2026-10-01', false), null);
});

test('redondeo a 2 decimales y huecos como null', () => {
  const ag = { ...agregadosDia(serieSintetica({ precip: lluviaBuena }), 59), P26: 80.123456, T20suelo: null, secante: true };
  const l = empaquetarDia(ag);
  assert.equal(l[0], 80.12);
  assert.equal(l[5], 1);
  assert.equal(l[7], null);
  assert.equal(diaConDatos(l), true);
  assert.equal(diaConDatos([null, ...l.slice(1)]), false);
  assert.equal(diaConDatos(null), false);
});

test('resumirCelda: 10 días desde hoy y la lluvia de 60 días + previsión', () => {
  const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
  const fechas = serie.fechas.slice(59, 69);
  const c = resumirCelda({ altRef: 1480, serie, fechas });
  assert.equal(c.altRef, 1480);
  assert.equal(c.dias.length, 10);
  assert.equal(c.incompleta, false);
  assert.equal(c.lluvia.desde, serie.fechas[0]);
  assert.equal(c.lluvia.hoy, 59);
  assert.equal(c.lluvia.mm.length, 69);
  const s = serieLluvia(c);
  assert.equal(s.fechas[59], serie.fechas[59]);
  assert.equal(s.precip[40], 20);
});

test('resumirCelda: un día que no se puede calcular queda null y marca la celda incompleta', () => {
  const serie = serieSintetica({ dias: 70, hoy: 59, precip: (k) => (k === 62 ? null : 2) });
  const c = resumirCelda({ altRef: 1000, serie, fechas: serie.fechas.slice(59, 69) });
  assert.equal(c.incompleta, true);
  assert.equal(c.dias[0][0], 52);
  assert.equal(c.dias[3][0], null);   // la ventana de 26 días incluye el hueco: sin P26
});

test('agregadosDeCelda y validarSalida', () => {
  const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
  const fechas = serie.fechas.slice(59, 69);
  const salida = { version: 1, sello: '2026-10-18T07', generado: '2026-10-18T05:00:00.000Z', hoy: fechas[0], fechas,
    celdas: { 'z:1:1': resumirCelda({ altRef: 1000, serie, fechas }) } };
  assert.deepEqual(validarSalida(salida), []);
  assert.equal(agregadosDeCelda(salida, 'z:1:1', fechas[0]).P26, 106);
  assert.equal(agregadosDeCelda(salida, 'z:1:1', fechas[2]).prevision, true);
  assert.equal(agregadosDeCelda(salida, 'z:9:9', fechas[0]), null);
  assert.equal(agregadosDeCelda(salida, 'z:1:1', '2026-01-01'), null);
  assert.match(validarSalida({ ...salida, version: 2 }).join(), /versión/);
  assert.match(validarSalida({ ...salida, sello: '2026-10-18' }).join(), /sello/);
  assert.match(validarSalida({ ...salida, celdas: { a: { altRef: 1, dias: [] } } }).join(), /celda a/);
});
```

Run: `node --test tests/rejilla-salida.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir el módulo compartido y su reexportación**

```js
// supabase/functions/_shared/salida-indice.js
// Índice diario que publica la Edge Function «rejilla» (bucket público `indice`, `<sello>.json`) y que lee el móvil.
// Por celda gruesa: altitud de referencia, lluvia diaria (para la gráfica) y, por día, los agregados de indice.js
// (agregadosDia) en una lista fija de 15 números; null = ese día no se pudo calcular. Formato: docs/datos.md.
import { agregadosDia, DatosIncompletos } from './indice.js';
import { sumarDias } from './meteo.js';

export const VERSION_SALIDA = 1;
export const CAMPOS_DIA = ['P26', 'P3', 'lag', 'pct', 'Pagosto', 'secante', 'T20aire', 'T20suelo'];
const LARGO = CAMPOS_DIA.length + 7;
const r2 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 100) / 100);

export function empaquetarDia(ag) {
  if (!ag) return null;
  return [...CAMPOS_DIA.map((k) => (k === 'secante' ? (ag.secante == null ? null : ag.secante ? 1 : 0) : r2(ag[k]))), ...ag.tmin7.map(r2)];
}
export function desempaquetarDia(lista, fecha, prevision) {
  if (!Array.isArray(lista) || lista.length !== LARGO) return null;
  const ag = { fecha, prevision };
  CAMPOS_DIA.forEach((k, j) => { ag[k] = k === 'secante' ? (lista[j] == null ? null : lista[j] === 1) : lista[j]; });
  ag.tmin7 = lista.slice(CAMPOS_DIA.length);
  return ag;
}
// Lo mínimo para casi todas las especies: lluvia de 26 días y temperatura del aire.
export const diaConDatos = (lista) => Array.isArray(lista) && lista[0] != null && lista[6] != null;

export function resumirCelda({ altRef, serie, fechas }) {
  const dias = fechas.map((f) => {
    const i = serie.fechas.indexOf(f);
    if (i === -1) return null;
    try { return empaquetarDia(agregadosDia(serie, i)); } catch (e) { if (e instanceof DatosIncompletos) return null; throw e; }
  });
  const i0 = Math.max(0, serie.hoy - 59), i1 = Math.min(serie.fechas.length, serie.hoy + fechas.length);
  return { altRef, incompleta: !dias.every(diaConDatos), lluvia: { desde: serie.fechas[i0], hoy: serie.hoy - i0, mm: serie.precip.slice(i0, i1).map(r2) }, dias };
}

export function agregadosDeCelda(salida, id, fecha) {
  const c = salida?.celdas?.[id], k = salida?.fechas?.indexOf(fecha) ?? -1;
  if (!c || k === -1) return null;
  return desempaquetarDia(c.dias[k], fecha, fecha > salida.hoy);
}

export function serieLluvia(celda) {
  const { desde, hoy, mm } = celda.lluvia;
  return { fechas: mm.map((_, k) => sumarDias(desde, k)), precip: mm, hoy };
}

export function validarSalida(s) {
  const e = [];
  if (s?.version !== VERSION_SALIDA) e.push('versión desconocida');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(s?.sello ?? '')) e.push('sello mal formado');
  if (!Array.isArray(s?.fechas) || !s.fechas.length) e.push('sin fechas');
  if (!s?.celdas || typeof s.celdas !== 'object') e.push('sin celdas');
  else for (const [id, c] of Object.entries(s.celdas)) {
    if (typeof c?.altRef !== 'number' || !Array.isArray(c.dias) || c.dias.length !== s.fechas?.length) { e.push(`celda ${id} mal formada`); break; }
  }
  return e;
}
```

```js
// js/rejilla/salida.js
// Reexporta el formato compartido con la Edge Function «rejilla».
export * from '../../supabase/functions/_shared/salida-indice.js';
```

- [ ] **Step 3: Ejecutar la prueba**

Run: `node --test tests/rejilla-salida.test.js`
Expected: PASS (5 pruebas).

- [ ] **Step 4: Documentar el formato en `docs/datos.md`**

Añadir tras «Formato de la rejilla» una sección «Índice diario precalculado (bucket `indice`)» con el ejemplo JSON de arriba, la lista de los 15 números de cada día y esta nota: «Se publican los agregados (iguales para todas las especies) en vez de los factores por especie: el móvil aplica `indiceDesdeAgregados` con los umbrales vigentes, así que una edición en Ajustes se ve sin esperar a la siguiente ejecución.»

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/salida-indice.js js/rejilla/salida.js tests/rejilla-salida.test.js docs/datos.md
git commit -m "$(cat <<'EOF'
Rejilla: formato del índice diario publicado (agregados por celda gruesa y día)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 10: Nota por celda fina y prueba de equivalencia

**Files:**
- Create: `js/rejilla/nota.js`
- Test: `tests/rejilla-nota.test.js`

**Interfaces:**
- Consumes: `indiceDesdeAgregados`, `enTemporada`, `DatosIncompletos`, `indiceZona` (tarea 1); `ajusteHumedad` (tarea 7); `empaquetarDia`, `desempaquetarDia` (tarea 9); `especiesDeZona` de `js/datos.js`.
- Produces: `GRADIENTE = -0.0065` (°C por metro); `corregirAltitud(ag, dAlt) → ag`; `notaEspecie(ag, especie, { altitud, altRef, orientacion = 0, explicar = true }) → resultado|null`; `especiesDeCelda(habitat, especies, fecha, filtro?) → especie[]`; `notaCelda({ ag, habitat, altitud, altRef, orientacion, especies, fecha, filtro = null, explicar = true }) → { sinEspecies, valor, especie, resultado, otras: [{ especie, valor }] }`. `especies` es la lista de `especiesDeZona(zona, datos.especies, umbrales)` (ya filtrada por zona y con los umbrales efectivos); `filtro` es un `Set` de ids o `null`.

- [ ] **Step 1: Escribir la prueba**

```js
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

test('notaEspecie aplica el ajuste de la orientación (orientativo) y el llano es neutro', () => {
  const ag = agregadosDia(serieSintetica({ precip: () => 2 }), 59);
  const umbria = notaEspecie(ag, BOLETUS, { altitud: 1500, altRef: 1500, orientacion: 1 });
  assert.ok(Math.abs(umbria.factores.fW - Math.min(1, (22 / 60) * ajusteHumedad(1))) < 1e-12);
  assert.equal(notaEspecie(ag, BOLETUS, { altitud: 1500, altRef: 1500, orientacion: 0 }).factores.fW, 22 / 60);
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

// Spec §4: en cada punto de zonas.json, con el ajuste de orientación neutro y la misma meteo, la nota por rejilla es
// la de indiceZona (tolerancia de 1 punto). La meteo de la celda gruesa está a su altitud de referencia; la que
// Open-Meteo daría en el punto es esa misma desplazada por el gradiente. Se comparan las especies del hábitat del punto.
const desplazar = (s, d) => ({ ...s, tmedia: s.tmedia.map((v) => v + d), tmin: s.tmin.map((v) => v + d), tmax: s.tmax.map((v) => v + d), tsuelo: s.tsuelo.map((v) => v + d) });
test('equivalencia con indiceZona en todos los puntos de zonas.json (±1)', () => {
  let comparados = 0;
  for (const z of zonas) for (const p of z.puntos) for (const dif of [0, 300, -250]) {
    const altRef = p.altitud + dif;
    const S = serieSintetica({ precip: lluviaBuena });
    const Sp = desplazar(S, GRADIENTE * (p.altitud - altRef));
    const esps = especiesDeZona(z, especies).filter((e) => e.habitats.includes(p.habitat));
    const esperado = indiceZona({ [p.id]: Sp }, 59, esps).valor;
    const ag = desempaquetarDia(JSON.parse(JSON.stringify(empaquetarDia(agregadosDia(S, 59)))), S.fechas[59], false);
    const r = notaCelda({ ag, habitat: p.habitat, altitud: p.altitud, altRef, orientacion: 0, especies: esps, fecha: S.fechas[59] });
    if (esperado == null) { assert.equal(r.valor, null, p.id); continue; }
    assert.ok(Math.abs(r.valor - esperado) <= 1, `${p.id} (${dif} m): rejilla ${r.valor}, zona ${esperado}`);
    comparados++;
  }
  assert.ok(comparados > 50, `solo ${comparados} comparaciones`);
});

test('una fila mala de ajustes_umbrales se ignora igual que en Hoy y Zona; una buena se aplica', () => {
  const soria = zonas.find((z) => z.id === 'soria'), fecha = '2026-10-18', ag = humeda();
  const nota = (umbrales) => notaCelda({ ag, habitat: 'pinar-silvestre', altitud: 1200, altRef: 1200, fecha,
    especies: especiesDeZona(soria, especies, umbrales), filtro: new Set(['boletus-edulis']) }).valor;
  const base = nota({});
  assert.equal(nota({ 'boletus-edulis': { pmin: 'mucho', pfull: -3 } }), base);
  assert.ok(nota({ 'boletus-edulis': { pmin: 100, pfull: 160 } }) < base);
});
```

Run: `node --test tests/rejilla-nota.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir el módulo**

```js
// js/rejilla/nota.js
// Nota de una celda fina (spec §3.3): temperatura corregida por altitud respecto a la de referencia de su celda
// gruesa (−0,65 °C cada 100 m), ajuste orientativo de humedad por orientación y la misma fórmula de indice.js.
// Solo cuentan las especies cuyo hábitat encaja con la celda y que están en temporada ese día.
import { indiceDesdeAgregados, enTemporada, DatosIncompletos } from '../indice.js';
import { ajusteHumedad } from './orientacion.js';

export const GRADIENTE = -0.0065;

export function corregirAltitud(ag, dAlt) {
  if (!dAlt) return ag;
  const d = GRADIENTE * dAlt, mas = (v) => (v == null ? null : v + d);
  return { ...ag, T20aire: mas(ag.T20aire), T20suelo: mas(ag.T20suelo), tmin7: ag.tmin7.map(mas) };
}

export function notaEspecie(ag, especie, { altitud, altRef, orientacion = 0, explicar = true }) {
  try {
    return indiceDesdeAgregados(corregirAltitud(ag, altitud - altRef), especie, { ajusteHumedad: ajusteHumedad(orientacion), explicar });
  } catch (e) {
    if (e instanceof DatosIncompletos) return null;
    throw e;
  }
}

export const especiesDeCelda = (habitat, especies, fecha, filtro = null) =>
  especies.filter((e) => e.habitats.includes(habitat) && enTemporada(fecha, e) && (!filtro || filtro.has(e.id)));

const vacia = (sinEspecies) => ({ sinEspecies, valor: null, especie: null, resultado: null, otras: [] });

export function notaCelda({ ag, habitat, altitud, altRef, orientacion = 0, especies, fecha, filtro = null, explicar = true }) {
  const candidatas = especiesDeCelda(habitat, especies, fecha, filtro);
  if (!candidatas.length) return vacia(true);
  if (!ag) return vacia(false);
  const notas = candidatas.map((e) => ({ especie: e, resultado: notaEspecie(ag, e, { altitud, altRef, orientacion, explicar }) }))
    .filter((x) => x.resultado).sort((a, b) => b.resultado.valor - a.resultado.valor);
  if (!notas.length) return vacia(false);
  return { sinEspecies: false, valor: notas[0].resultado.valor, especie: notas[0].especie, resultado: notas[0].resultado,
    otras: notas.slice(1).map((x) => ({ especie: x.especie, valor: x.resultado.valor })) };
}
```

- [ ] **Step 3: Ejecutar la prueba**

Run: `node --test tests/rejilla-nota.test.js`
Expected: PASS (6 pruebas). Si la de equivalencia falla en un punto, no se sube la tolerancia: se busca la diferencia (suele ser una especie que `especiesDeZona` incluye y el filtro de hábitat no, o al revés).

- [ ] **Step 4: Commit**

```bash
git add js/rejilla/nota.js tests/rejilla-nota.test.js
git commit -m "$(cat <<'EOF'
Rejilla: nota por celda fina (altitud y orientación) con la prueba de equivalencia con indiceZona

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 11: Núcleo de la función `rejilla` (horario, presupuesto, planificador, series, regla del 90 %)

Todo lo que decide la función, sin red ni base de datos. Reglas:
- **Horario:** pg_cron trabaja en UTC y se lanza a las 05, 06, 17 y 18 UTC; la función solo trabaja si en Madrid son las 07 o las 19 (`tocaEjecutar`), así cubre el horario de verano y el de invierno.
- **Presupuesto:** 1.000 llamadas ponderadas al día, 500 por ejecución, repartidas entre lotes. Peso estimado de una petición: `ubicaciones × max(1, variables / 10) × max(1, días / 14)` (`docs/datos.md`).
- **Prioridad:** (1) celdas con histórico completo: solo `past_days=2` + 10 días de previsión (peso 1 por celda); (2) celdas sin histórico o con huecos: relleno desde `inicioSerie(hoy)` (el 1 de agosto de la temporada, o 60 días atrás si es antes), con `past_days` hasta `CONFIG.openMeteo.maxPasados` y lo más antiguo de la API de archivo (solo lluvia); (3) climatología del suelo de las celdas que no la tienen para el final del horizonte, de la más vieja a la más nueva.
- **Climatología:** en vez de 2 años enteros (52 de peso por celda), las dos ventanas del mes anterior al segundo siguiente de los dos últimos años (unos 17 de peso por celda); cubre los tres meses que usa `aplicarClimatologia` para cada día del horizonte. Con lo que sobra del presupuesto se renuevan unas 8 celdas por ejecución; mientras una celda no la tenga, su índice va sin `fS` (igual que la app sin climatología).

**Files:**
- Create: `supabase/functions/rejilla/nucleo.js`
- Test: `tests/rejilla-nucleo.test.js`

**Interfaces:**
- Consumes: `DIARIAS`, `HORARIAS`, `FUTUROS`, `PASADOS`, `urlPrincipal`, `urlArchivo`, `urlLluviaArchivo`, `parsearPrincipal`, `resumirArchivo`, `aplicarClimatologia`, `agostoDe`, `sumarDias`, `entreDias` de `../_shared/meteo.js`; `CONFIG.openMeteo` (solo en la prueba, para comprobar que las constantes coinciden).
- Produces: `PRESUPUESTO_DIA = 1000`, `PRESUPUESTO_EJECUCION = 500`, `HORAS = [7, 19]`, `MODELO = 'best_match'`, `TROZO`, `MAX_PASADOS`, `CONSERVAR = 6`; `selloDe(ahora) → 'AAAA-MM-DDTHH'`; `tocaEjecutar(ahora) → sello|null`; `pesoPeticion(ubicaciones, variables, dias)`; `inicioSerie(hoy)`; `estadoCelda(resumen|undefined, hoy, maxPasados?) → { tipo: 'diaria'|'relleno', pasados, archivo?: { desde, hasta } }`; `ventanasClima(fecha) → { meses, ventanas: [{ desde, hasta }] }`; `climaUtil(filaClima, fecha) → booleano`; `planificar({ celdas, resumen: Map, clima: Map, hoy, presupuesto?, trozo?, maxPasados? }) → { peticiones: [{ tipo: 'principal'|'archivo'|'clima', celdas, url, desde?, hasta?, trozo? }], peso }`; `filasDePrincipal(json, celdas, hoy, ahora) → fila[]`; `filasDeArchivoLluvia(json, celdas, desde, hasta, ahora) → fila[]`; `filasDeClima(partes, celdas, hoy, ahora) → filaClima[]`; `serieDesdeFilas(filaRpc, desde, hasta, hoy) → serie`; `aplicarClimaCelda(serie, filaClima) → serie`; `decidirPublicacion(conDatos, total) → booleano`; `archivosABorrar(nombres, conservar?) → string[]`; `celdasDelLote(celdas, lote, lotes)`; `async pedirConReintento(fetchFn, url, { intentos = 3, esperas = [5000, 20000], esperar }) → json`.
  Una celda es `{ id, zona, lat, lon, altRef }` (de `gruesa.json`); una fila de `meteo_celdas` es `{ celda, fecha, modelo, precip, tmedia, tmin, tmax, et0, viento, hr, hsuelo, tsuelo, previsto, actualizado }`; una de `clima_celdas`, `{ celda, por_mes: { [mes]: number[] }, meses: number[], actualizado }`; el resumen, `{ celda, desde, hasta, dias }`.

- [ ] **Step 1: Escribir la prueba**

```js
// tests/rejilla-nucleo.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selloDe, tocaEjecutar, pesoPeticion, inicioSerie, estadoCelda, ventanasClima, climaUtil, planificar, serieDesdeFilas,
  aplicarClimaCelda, decidirPublicacion, archivosABorrar, celdasDelLote, pedirConReintento, TROZO, MAX_PASADOS, PRESUPUESTO_EJECUCION } from '../supabase/functions/rejilla/nucleo.js';
import { CONFIG } from '../scripts/rejilla/config.mjs';

const celdas = (n) => Array.from({ length: n }, (_, k) => ({ id: `z:${k}:0`, zona: 'z', lat: 40 + k * 0.001, lon: -4, altRef: 1000 }));
const completo = (ids, hasta = '2026-09-30') => new Map(ids.map((c) => [c.id, { celda: c.id, desde: '2026-08-01', hasta, dias: 61 }]));
const cerca = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`);

test('las constantes de Open-Meteo son las del sondeo', () => {
  assert.equal(TROZO, CONFIG.openMeteo.trozo);
  assert.equal(MAX_PASADOS, CONFIG.openMeteo.maxPasados);
  assert.equal(PRESUPUESTO_EJECUCION, 500);
});

test('horario: solo a las 07 y 19 de Madrid, también el día del cambio de hora', () => {
  assert.equal(tocaEjecutar(new Date('2026-10-01T05:00:00Z')), '2026-10-01T07');   // verano, UTC+2
  assert.equal(tocaEjecutar(new Date('2026-10-01T06:00:00Z')), null);
  assert.equal(tocaEjecutar(new Date('2026-10-01T17:00:00Z')), '2026-10-01T19');
  assert.equal(tocaEjecutar(new Date('2026-10-25T05:00:00Z')), null);              // 25-oct: ya es UTC+1, son las 06
  assert.equal(tocaEjecutar(new Date('2026-10-25T06:00:00Z')), '2026-10-25T07');
  assert.equal(tocaEjecutar(new Date('2026-11-02T18:00:00Z')), '2026-11-02T19');
  assert.equal(selloDe(new Date('2026-10-01T09:30:00Z')), '2026-10-01T11');
});

test('peso de las peticiones', () => {
  assert.equal(pesoPeticion(100, 9, 12), 100);
  cerca(pesoPeticion(1, 9, 71), 71 / 14);
  cerca(pesoPeticion(1, 1, 122), 122 / 14);
  assert.equal(pesoPeticion(10, 12, 7), 12);
});

test('inicio de la serie: el 1 de agosto de la temporada o 60 días atrás, lo que sea antes', () => {
  assert.equal(inicioSerie('2026-10-01'), '2026-08-01');
  assert.equal(inicioSerie('2026-09-15'), '2026-07-18');
  assert.equal(inicioSerie('2027-03-10'), '2026-08-01');
});

test('estado de cada celda: diaria, relleno corto, relleno desde el inicio y relleno con archivo', () => {
  assert.deepEqual(estadoCelda(undefined, '2026-10-01'), { tipo: 'relleno', pasados: 61 });
  assert.deepEqual(estadoCelda({ desde: '2026-08-01', hasta: '2026-09-30', dias: 61 }, '2026-10-01'), { tipo: 'diaria', pasados: 2 });
  assert.deepEqual(estadoCelda({ desde: '2026-08-01', hasta: '2026-09-28', dias: 59 }, '2026-10-01'), { tipo: 'diaria', pasados: 2 });
  assert.deepEqual(estadoCelda({ desde: '2026-08-01', hasta: '2026-09-27', dias: 58 }, '2026-10-01'), { tipo: 'relleno', pasados: 3 });
  assert.deepEqual(estadoCelda({ desde: '2026-08-01', hasta: '2026-09-30', dias: 50 }, '2026-10-01'), { tipo: 'relleno', pasados: 61 });   // huecos
  assert.deepEqual(estadoCelda({ desde: '2026-08-20', hasta: '2026-09-30', dias: 42 }, '2026-10-01'), { tipo: 'relleno', pasados: 61 });
  assert.deepEqual(estadoCelda(undefined, '2027-03-10', 92), { tipo: 'relleno', pasados: 92, archivo: { desde: '2026-08-01', hasta: '2026-12-07' } });
});

test('ventanas de climatología: del mes anterior al segundo siguiente, en los dos años anteriores', () => {
  assert.deepEqual(ventanasClima('2026-10-01'), { meses: [9, 10, 11, 12], ventanas: [{ desde: '2025-09-01', hasta: '2025-12-31' }, { desde: '2024-09-01', hasta: '2024-12-31' }] });
  assert.deepEqual(ventanasClima('2027-01-15'), { meses: [12, 1, 2, 3], ventanas: [{ desde: '2025-12-01', hasta: '2026-03-31' }, { desde: '2024-12-01', hasta: '2025-03-31' }] });
  assert.equal(climaUtil({ meses: [9, 10, 11, 12] }, '2026-10-10'), true);
  assert.equal(climaUtil({ meses: [9, 10, 11, 12] }, '2026-12-04'), false);
  assert.equal(climaUtil(undefined, '2026-10-10'), false);
});

test('planificar: primera ejecución sin histórico, dentro del presupuesto', () => {
  const p = planificar({ celdas: celdas(350), resumen: new Map(), clima: new Map(), hoy: '2026-10-01', trozo: 100 });
  const enPrincipal = p.peticiones.filter((x) => x.tipo === 'principal').flatMap((x) => x.celdas);
  assert.equal(enPrincipal.length, 98);   // 500 / (71 / 14)
  assert.ok(p.peso <= 500);
  for (const x of p.peticiones.filter((y) => y.tipo === 'principal')) assert.equal(new URL(x.url).searchParams.get('past_days'), '61');
});

test('planificar: con histórico solo se pide lo nuevo (2 días atrás + 10) y sobra para la climatología', () => {
  const cs = celdas(350);
  const sinClima = planificar({ celdas: cs, resumen: completo(cs), clima: new Map(), hoy: '2026-10-01', trozo: 100 });
  const principales = sinClima.peticiones.filter((x) => x.tipo === 'principal');
  assert.equal(principales.length, 4);
  for (const x of principales) { const q = new URL(x.url).searchParams; assert.equal(q.get('past_days'), '2'); assert.equal(q.get('forecast_days'), '10'); }
  const clima = sinClima.peticiones.filter((x) => x.tipo === 'clima');
  assert.equal(clima.length, 2);                 // un trozo × dos ventanas
  assert.equal(clima[0].celdas.length, 8);       // 150 / (2 × 122 / 14)
  cerca(sinClima.peso, 350 + 8 * (2 * 122) / 14);
  const conClima = new Map(cs.map((c) => [c.id, { celda: c.id, meses: [9, 10, 11, 12], actualizado: '2026-09-20T05:00:00Z' }]));
  const p2 = planificar({ celdas: cs, resumen: completo(cs), clima: conClima, hoy: '2026-10-01', trozo: 100 });
  assert.equal(p2.peticiones.filter((x) => x.tipo === 'clima').length, 0);
  assert.equal(p2.peso, 350);
});

test('serie desde las filas: días seguidos, null donde falta, hoy en su sitio', () => {
  const s = serieDesdeFilas({ celda: 'a', fechas: ['2026-08-01', '2026-08-03'], precip: [1, 3], tmedia: [10, 12] }, '2026-08-01', '2026-08-04', '2026-08-03');
  assert.deepEqual(s.fechas, ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']);
  assert.deepEqual(s.precip, [1, null, 3, null]);
  assert.deepEqual(s.tmedia, [10, null, 12, null]);
  assert.deepEqual(s.tmin, [null, null, null, null]);
  assert.equal(s.hoy, 2);
  assert.equal(s.lluviaAntesDeSerie, null);
});

test('climatología de una celda: percentil donde la ventana cubre el mes; null donde no', () => {
  const s = serieDesdeFilas({ celda: 'a', fechas: ['2026-10-01', '2027-01-10'], hsuelo: [0.3, 0.3] }, '2026-10-01', '2027-01-10', '2026-10-01');
  const muestra = Array.from({ length: 60 }, (_, k) => 0.2 + k / 300);
  const fila = { celda: 'a', meses: [9, 10, 11, 12], por_mes: { 9: muestra, 10: muestra, 11: muestra, 12: muestra } };
  const c = aplicarClimaCelda(s, fila);
  assert.ok(c.hsueloPct[0] > 0 && c.hsueloPct[0] < 100);
  assert.equal(c.hsueloPct.at(-1), null);   // enero necesita diciembre, enero y febrero
  assert.equal(aplicarClimaCelda(s, undefined), s);
});

test('regla del 90 %, limpieza de archivos viejos y lotes', () => {
  assert.equal(decidirPublicacion(315, 350), true);
  assert.equal(decidirPublicacion(314, 350), false);
  assert.equal(decidirPublicacion(0, 0), false);
  const nombres = ['ultimo.json', ...['01T07', '01T19', '02T07', '02T19', '03T07', '03T19', '04T07', '04T19'].map((s) => `2026-10-${s}.json`)];
  assert.deepEqual(archivosABorrar(nombres), ['2026-10-01T19.json', '2026-10-01T07.json']);
  assert.deepEqual(celdasDelLote(celdas(5), 1, 2).map((c) => c.id), ['z:1:0', 'z:3:0']);
});

test('pedirConReintento: espera y reintenta los 429; con Retry-After, lo respeta; al tercer fallo, error', async () => {
  const respuestas = (lista) => { let n = 0; return async () => lista[n++]; };
  const ok = { ok: true, status: 200, headers: new Map(), json: async () => ({ daily: {} }) };
  const no = (h = []) => ({ ok: false, status: 429, headers: new Map(h), json: async () => ({}) });
  const esperas = [];
  const esperar = async (ms) => { esperas.push(ms); };
  assert.deepEqual(await pedirConReintento(respuestas([no(), no(), ok]), 'u', { esperar }), { daily: {} });
  assert.deepEqual(esperas, [5000, 20000]);
  esperas.length = 0;
  await pedirConReintento(respuestas([no([['retry-after', '2']]), ok]), 'u', { esperar });
  assert.deepEqual(esperas, [2000]);
  await assert.rejects(pedirConReintento(respuestas([no(), no(), no()]), 'u', { esperar }), /429/);
  await assert.rejects(pedirConReintento(respuestas([{ ok: false, status: 400, headers: new Map(), json: async () => ({}) }]), 'u', { esperar }), /400/);
});
```

Run: `node --test tests/rejilla-nucleo.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir el núcleo**

Copiar en `TROZO` y `MAX_PASADOS` los valores de `CONFIG.openMeteo` (la Edge Function no puede importar `scripts/`; la prueba comprueba que coinciden).

```js
// supabase/functions/rejilla/nucleo.js
// Lógica pura de la Edge Function «rejilla» (spec §3.2): cuándo toca, cuánto se gasta en Open-Meteo, qué se pide,
// cómo se reconstruyen las series y cuándo se publica. Sin red ni base de datos: se prueba con Node.
import { DIARIAS, HORARIAS, FUTUROS, PASADOS, urlPrincipal, urlArchivo, urlLluviaArchivo, parsearPrincipal, resumirArchivo,
  aplicarClimatologia, agostoDe, sumarDias, entreDias } from '../_shared/meteo.js';

const ZONA = 'Europe/Madrid';
export const PRESUPUESTO_DIA = 1000;                       // llamadas ponderadas a Open-Meteo al día (límite gratuito: 10.000)
export const EJECUCIONES_DIA = 2;
export const PRESUPUESTO_EJECUCION = PRESUPUESTO_DIA / EJECUCIONES_DIA;
export const HORAS = [7, 19];                              // hora de Madrid
export const MODELO = 'best_match';                        // la misma serie principal que js/meteo.js
export const TROZO = 100;                                  // = CONFIG.openMeteo.trozo (tarea 0)
export const MAX_PASADOS = 92;                             // = CONFIG.openMeteo.maxPasados (tarea 0)
export const CONSERVAR = 6;                                // índices publicados que se guardan (3 días)
const VARIABLES = DIARIAS.length + HORARIAS.length;
const SUELO = 'soil_moisture_0_to_7cm_mean';
const COLUMNAS = ['precip', 'tmedia', 'tmin', 'tmax', 'et0', 'viento', 'hr', 'hsuelo', 'tsuelo'];

const partesMadrid = (ahora) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(ahora).map((p) => [p.type, p.value]));
export function selloDe(ahora) { const p = partesMadrid(ahora); return `${p.year}-${p.month}-${p.day}T${p.hour}`; }
export function tocaEjecutar(ahora) { const s = selloDe(ahora); return HORAS.includes(Number(s.slice(11))) ? s : null; }

export const pesoPeticion = (ubicaciones, variables, dias) => ubicaciones * Math.max(1, variables / 10) * Math.max(1, dias / 14);
export const inicioSerie = (hoy) => { const a = agostoDe(hoy), b = sumarDias(hoy, -(PASADOS - 1)); return a < b ? a : b; };

// Qué hay que pedir de una celda según su resumen en meteo_celdas ({ desde, hasta, dias } de días ya observados).
export function estadoCelda(res, hoy, maxPasados = MAX_PASADOS) {
  const inicio = inicioSerie(hoy);
  const completo = !!res && res.desde <= inicio && !!res.hasta && res.dias === entreDias(res.desde, res.hasta) + 1;
  if (completo && res.hasta >= sumarDias(hoy, -3)) return { tipo: 'diaria', pasados: 2 };
  const desde = completo ? sumarDias(res.hasta, 1) : inicio;
  const pasados = entreDias(desde, hoy);
  if (pasados <= maxPasados) return { tipo: 'relleno', pasados };
  return { tipo: 'relleno', pasados: maxPasados, archivo: { desde, hasta: sumarDias(hoy, -(maxPasados + 1)) } };
}

const mesDe = (f) => Number(f.slice(5, 7));
const normal = (m) => ((m - 1 + 12) % 12) + 1;
const dia = (d) => d.toISOString().slice(0, 10);
export function ventanasClima(fecha) {
  const a = Number(fecha.slice(0, 4)), m = mesDe(fecha);
  return { meses: [m - 1, m, m + 1, m + 2].map(normal),
    ventanas: [1, 2].map((k) => ({ desde: dia(new Date(Date.UTC(a - k, m - 2, 1))), hasta: dia(new Date(Date.UTC(a - k, m + 2, 0))) })) };
}
export const climaUtil = (fila, fecha) => { const m = mesDe(fecha); return Array.isArray(fila?.meses) && [m - 1, m, m + 1].map(normal).every((x) => fila.meses.includes(x)); };

const puntos = (cs) => cs.map((c) => ({ id: c.id, lat: c.lat, lon: c.lon, altitud: c.altRef }));
const trocear = (lista, n) => { const r = []; for (let k = 0; k < lista.length; k += n) r.push(lista.slice(k, k + n)); return r; };

export function planificar({ celdas, resumen, clima, hoy, presupuesto = PRESUPUESTO_EJECUCION, trozo = TROZO, maxPasados = MAX_PASADOS }) {
  const peticiones = [];
  let peso = 0;
  const pesoDe = (e) => pesoPeticion(1, VARIABLES, e.pasados + FUTUROS) + (e.archivo ? pesoPeticion(1, 1, entreDias(e.archivo.desde, e.archivo.hasta) + 1) : 0);
  const estados = celdas.map((c) => ({ c, e: estadoCelda(resumen.get(c.id), hoy, maxPasados) }));
  const grupos = new Map();
  for (const tipo of ['diaria', 'relleno']) for (const { c, e } of estados) {
    if (e.tipo !== tipo) continue;
    const p = pesoDe(e);
    if (peso + p > presupuesto) continue;
    peso += p;
    const clave = `${e.pasados}|${e.archivo?.desde ?? ''}|${e.archivo?.hasta ?? ''}`;
    if (!grupos.has(clave)) grupos.set(clave, { e, celdas: [] });
    grupos.get(clave).celdas.push(c);
  }
  for (const { e, celdas: cs } of grupos.values()) for (const t of trocear(cs, trozo)) {
    peticiones.push({ tipo: 'principal', celdas: t, url: urlPrincipal(puntos(t), { pasados: e.pasados, futuros: FUTUROS }) });
    if (e.archivo) peticiones.push({ tipo: 'archivo', celdas: t, desde: e.archivo.desde, hasta: e.archivo.hasta, url: urlLluviaArchivo(puntos(t), e.archivo.desde, e.archivo.hasta) });
  }
  const fin = sumarDias(hoy, FUTUROS - 1);
  const { ventanas } = ventanasClima(hoy);
  const pClima = ventanas.reduce((t, v) => t + pesoPeticion(1, 1, entreDias(v.desde, v.hasta) + 1), 0);
  const viejas = celdas.filter((c) => !climaUtil(clima.get(c.id), fin))
    .sort((a, b) => String(clima.get(a.id)?.actualizado ?? '').localeCompare(String(clima.get(b.id)?.actualizado ?? '')));
  const elegidas = [];
  for (const c of viejas) { if (peso + pClima > presupuesto) break; peso += pClima; elegidas.push(c); }
  trocear(elegidas, trozo).forEach((t, n) => { for (const v of ventanas) peticiones.push({ tipo: 'clima', trozo: n, celdas: t, url: urlArchivo(puntos(t), v.desde, v.hasta, SUELO) }); });
  return { peticiones, peso };
}

const comoLista = (j) => (Array.isArray(j) ? j : [j]);
export function filasDePrincipal(json, celdas, hoy, ahora = new Date()) {
  const series = parsearPrincipal(json, puntos(celdas), hoy), cuando = ahora.toISOString();
  return celdas.flatMap((c) => {
    const s = series[c.id];
    return s.fechas.map((fecha, k) => ({ celda: c.id, fecha, modelo: MODELO, ...Object.fromEntries(COLUMNAS.map((col) => [col, s[col][k] ?? null])),
      previsto: fecha >= hoy, actualizado: cuando }));
  });
}
export function filasDeArchivoLluvia(json, celdas, desde, hasta, ahora = new Date()) {
  const lista = comoLista(json), cuando = ahora.toISOString();
  return celdas.flatMap((c, k) => {
    const d = lista[k]?.daily;
    if (!d?.time) return [];
    return d.time.flatMap((fecha, j) => (fecha >= desde && fecha <= hasta && d.precipitation_sum?.[j] != null
      ? [{ celda: c.id, fecha, modelo: MODELO, precip: d.precipitation_sum[j], previsto: false, actualizado: cuando }] : []));
  });
}
// Climatología de un trozo de celdas a partir de las dos ventanas; solo las celdas con todos los meses.
export function filasDeClima(partes, celdas, hoy, ahora = new Date()) {
  const { meses } = ventanasClima(hoy);
  return celdas.map((c, k) => {
    const porMes = {};
    for (const json of partes) for (const [m, v] of Object.entries(resumirArchivo(comoLista(json)[k]).porMes)) (porMes[m] ??= []).push(...v);
    return { celda: c.id, por_mes: porMes, meses, actualizado: ahora.toISOString() };
  }).filter((f) => meses.every((m) => f.por_mes[m]?.length));
}

// Serie con la forma de parsearPrincipal (js/meteo.js) a partir de la fila de series_celdas (arrays por columna).
export function serieDesdeFilas(fila, desde, hasta, hoy) {
  const fechas = Array.from({ length: entreDias(desde, hasta) + 1 }, (_, k) => sumarDias(desde, k));
  const pos = new Map((fila?.fechas ?? []).map((f, j) => [String(f).slice(0, 10), j]));
  const columna = (col) => fechas.map((f) => { const j = pos.get(f), v = j == null ? null : fila[col]?.[j]; return v == null || Number.isNaN(v) ? null : v; });
  return { fechas, hoy: fechas.indexOf(hoy), ...Object.fromEntries(COLUMNAS.map((c) => [c, columna(c)])),
    hsueloPct: fechas.map(() => null), lluviaAntesDeSerie: null, origenPrecip: fechas.map(() => 'modelo') };
}
export function aplicarClimaCelda(serie, fila) {
  if (!fila?.por_mes) return serie;
  const s = aplicarClimatologia(serie, { porMes: fila.por_mes });
  return { ...s, hsueloPct: s.hsueloPct.map((v, k) => (climaUtil(fila, serie.fechas[k]) ? v : null)) };
}

export const decidirPublicacion = (conDatos, total) => total > 0 && conDatos / total >= 0.9;
export const archivosABorrar = (nombres, conservar = CONSERVAR) =>
  nombres.filter((n) => /^\d{4}-\d{2}-\d{2}T\d{2}\.json$/.test(n)).sort().reverse().slice(conservar);
export const celdasDelLote = (celdas, lote, lotes) => celdas.filter((_, k) => k % lotes === lote);

// Las IPs de salida de Supabase son compartidas: un 429 se espera (Retry-After si viene) y se reintenta.
export async function pedirConReintento(fetchFn, url, { intentos = 3, esperas = [5000, 20000], esperar = (ms) => new Promise((r) => setTimeout(r, ms)), limite = 60000 } = {}) {
  for (let n = 1; ; n++) {
    let r;
    try { r = await fetchFn(url, { signal: AbortSignal.timeout(limite) }); } catch (e) {
      if (n >= intentos) throw e;
      await esperar(esperas[Math.min(n, esperas.length) - 1]);
      continue;
    }
    if (r.ok) { const j = await r.json(); if (j?.error) throw new Error(`Open-Meteo: ${j.reason}`); return j; }
    if ((r.status === 429 || r.status >= 500) && n < intentos) {
      const ra = Number(r.headers?.get?.('retry-after'));
      await esperar(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 60000) : esperas[Math.min(n, esperas.length) - 1]);
      continue;
    }
    throw new Error(`Open-Meteo respondió ${r.status}`);
  }
}
```

- [ ] **Step 3: Ejecutar la prueba**

Run: `node --test tests/rejilla-nucleo.test.js`
Expected: PASS (12 pruebas). Si el sondeo dio un `maxPasados` distinto de 92 o un `trozo` distinto de 100, la prueba de constantes obliga a copiarlos en `TROZO` y `MAX_PASADOS`; las demás pruebas pasan `trozo` y `maxPasados` explícitos donde importan.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/rejilla/nucleo.js tests/rejilla-nucleo.test.js
git commit -m "$(cat <<'EOF'
Función rejilla: horario, presupuesto de Open-Meteo, planificador, series y regla del 90 %

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 12: Manejador, Edge Function y migración (probados en local con dobles)

Nada de esta tarea toca Supabase: el manejador recibe un `almacen` (interfaz pequeña) y un `fetchFn`; las pruebas usan un almacén en memoria y un Open-Meteo falso. `index.ts` solo conecta Deno, el cliente de Supabase y la clave.

**Files:**
- Create: `supabase/functions/rejilla/manejador.js`
- Create: `supabase/functions/rejilla/index.ts`
- Create: `supabase/migrations/20261002000000_rejilla.sql`
- Create: `supabase/migrations/20261002000100_rejilla_cron.sql`
- Create: `tests/dobles-rejilla.js`
- Test: `tests/rejilla-funcion.test.js`

**Interfaces:**
- Consumes: todo `nucleo.js` (tarea 11); `resumirCelda`, `diaConDatos`, `VERSION_SALIDA` (tarea 9); `hoyMadrid`, `FUTUROS`, `sumarDias` de `_shared/meteo.js`.
- Produces: `async ejecutar({ almacen, fetchFn, ahora, gruesa, lote = 0, lotes = 1, forzar = false, esperar, trozo = TROZO, presupuesto = PRESUPUESTO_EJECUCION }) → { estado: 'fuera-de-hora'|'parcial'|'sin-publicar'|'publicado', sello?, conDatos?, total?, peso?, errores? }`; `almacenSupabase(admin)` con la interfaz `{ resumen(ids) → Map, clima(ids) → Map, guardarFilas(filas), guardarClima(filas), series(ids, desde) → Map, subir(nombre, json, cacheControl), leerJson(nombre) → json|null, listar(prefijo) → string[], borrar(nombres) }`.
- Produces (tests): `openMeteoFalso({ hoy, fallos, registro })`, `almacenMemoria()` con la misma interfaz.

- [ ] **Step 1: Escribir los dobles**

```js
// tests/dobles-rejilla.js
// Dobles de la Edge Function «rejilla»: Open-Meteo falso (forecast y archivo, varios puntos) y almacén en memoria con
// la misma interfaz que almacenSupabase (supabase/functions/rejilla/manejador.js).
import { sumarDias, entreDias } from '../js/meteo.js';

const VALORES = {
  precipitation_sum: (j) => (j % 9 === 0 ? 15 : 2), temperature_2m_mean: () => 13, temperature_2m_min: () => 6, temperature_2m_max: () => 19,
  et0_fao_evapotranspiration: () => 1.5, wind_speed_10m_max: () => 15, relative_humidity_2m_mean: () => 75,
  soil_moisture_0_to_7cm_mean: (j) => 0.2 + (j % 20) / 100,
};
const respuesta = (status, cuerpo) => ({ ok: status === 200, status, headers: new Map(), json: async () => cuerpo });

export function openMeteoFalso({ hoy, fallos = () => false, registro = [] } = {}) {
  return async (url) => {
    registro.push(url);
    const u = new URL(url), p = u.searchParams;
    if (fallos(u, registro.length)) return respuesta(429, { error: true, reason: 'Too many requests' });
    const n = p.get('latitude').split(',').length;
    let fechas;
    if (u.hostname.startsWith('archive')) {
      const d0 = p.get('start_date'), d1 = p.get('end_date');
      fechas = Array.from({ length: entreDias(d0, d1) + 1 }, (_, k) => sumarDias(d0, k));
    } else {
      const pas = Number(p.get('past_days')), fut = Number(p.get('forecast_days'));
      fechas = Array.from({ length: pas + fut }, (_, k) => sumarDias(hoy, k - pas));
    }
    const uno = () => {
      const daily = { time: fechas };
      for (const v of p.get('daily').split(',')) daily[v] = fechas.map((_, j) => (VALORES[v] ? VALORES[v](j) : 1));
      const r = { latitude: 40, longitude: -4, elevation: 1000, daily };
      if (p.get('hourly')) {
        const time = fechas.flatMap((f) => Array.from({ length: 24 }, (_, h) => `${f}T${String(h).padStart(2, '0')}:00`));
        r.hourly = { time, soil_moisture_0_to_7cm: time.map(() => 0.3), soil_temperature_0_to_7cm: time.map(() => 13) };
      }
      return r;
    };
    return respuesta(200, n === 1 ? uno() : Array.from({ length: n }, uno));
  };
}

const COLUMNAS = ['precip', 'tmedia', 'tmin', 'tmax', 'et0', 'viento', 'hr', 'hsuelo', 'tsuelo'];
export function almacenMemoria() {
  const filas = new Map(), clima = new Map(), archivos = new Map();
  return {
    filas, archivos,
    async resumen() {
      const r = new Map();
      for (const f of filas.values()) {
        const x = r.get(f.celda) ?? { celda: f.celda, desde: f.fecha, hasta: null, dias: 0 };
        if (f.fecha < x.desde) x.desde = f.fecha;
        if (!f.previsto) { x.dias++; if (!x.hasta || f.fecha > x.hasta) x.hasta = f.fecha; }
        r.set(f.celda, x);
      }
      return r;
    },
    async clima() { return new Map(clima); },
    async guardarFilas(lista) { for (const f of lista) filas.set(`${f.celda}|${f.fecha}`, { ...filas.get(`${f.celda}|${f.fecha}`), ...f }); },
    async guardarClima(lista) { for (const f of lista) clima.set(f.celda, f); },
    async series(ids, desde) {
      const r = new Map();
      for (const f of [...filas.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))) {
        if (!ids.includes(f.celda) || f.fecha < desde) continue;
        const s = r.get(f.celda) ?? { celda: f.celda, fechas: [], ...Object.fromEntries(COLUMNAS.map((c) => [c, []])) };
        s.fechas.push(f.fecha);
        for (const c of COLUMNAS) s[c].push(f[c] ?? null);
        r.set(f.celda, s);
      }
      return r;
    },
    async subir(nombre, json) { archivos.set(nombre, JSON.parse(JSON.stringify(json))); },
    async leerJson(nombre) { return archivos.get(nombre) ?? null; },
    async listar(prefijo) {
      const p = prefijo ? `${prefijo.replace(/\/$/, '')}/` : '';
      return [...archivos.keys()].filter((k) => k.startsWith(p) && !k.slice(p.length).includes('/')).map((k) => k.slice(p.length));
    },
    async borrar(nombres) { for (const n of nombres) archivos.delete(n); },
  };
}
```

- [ ] **Step 2: Escribir la prueba del manejador**

```js
// tests/rejilla-funcion.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ejecutar } from '../supabase/functions/rejilla/manejador.js';
import { openMeteoFalso, almacenMemoria } from './dobles-rejilla.js';
import { validarSalida } from '../js/rejilla/salida.js';

const MANANA = new Date('2026-10-01T05:00:00Z'), TARDE = new Date('2026-10-01T17:00:00Z');   // 07:00 y 19:00 en Madrid
const gruesa = (n) => ({ celdas: Array.from({ length: n }, (_, k) => ({ id: `z:${k}:0`, zona: 'z', lat: 40 + k * 0.01, lon: -4, altRef: 1000 + k })) });
const esperar = async () => {};

test('fuera de hora no hace nada', async () => {
  const registro = [], almacen = almacenMemoria();
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01', registro }), ahora: new Date('2026-10-01T06:00:00Z'), gruesa: gruesa(3), esperar });
  assert.equal(r.estado, 'fuera-de-hora');
  assert.equal(registro.length, 0);
});

test('primera ejecución: rellena, calcula y publica el índice y el puntero', async () => {
  const almacen = almacenMemoria();
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(10), esperar, trozo: 5 });
  assert.equal(r.estado, 'publicado');
  assert.equal(r.conDatos, 10);
  const ultimo = await almacen.leerJson('ultimo.json');
  assert.deepEqual({ ...ultimo, generado: null }, { version: 1, sello: '2026-10-01T07', archivo: '2026-10-01T07.json', generado: null, conDatos: 10, total: 10 });
  const salida = await almacen.leerJson('2026-10-01T07.json');
  assert.deepEqual(validarSalida(salida), []);
  assert.equal(salida.fechas[0], '2026-10-01');
  assert.equal(salida.fechas.length, 10);
  assert.equal(Object.keys(salida.celdas).length, 10);
  assert.equal(salida.celdas['z:3:0'].altRef, 1003);
  assert.ok(salida.celdas['z:0:0'].dias[0][3] != null, 'con climatología, percentil del suelo');
});

test('segunda ejecución del día: solo pide 2 días atrás y la previsión', async () => {
  const almacen = almacenMemoria();
  await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(10), esperar, trozo: 5 });
  const registro = [];
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01', registro }), ahora: TARDE, gruesa: gruesa(10), esperar, trozo: 5 });
  assert.equal(r.estado, 'publicado');
  const principales = registro.filter((u) => u.includes('api.open-meteo.com/v1/forecast'));
  assert.ok(principales.length > 0);
  for (const u of principales) assert.equal(new URL(u).searchParams.get('past_days'), '2');
  assert.ok(!registro.some((u) => u.includes('archive-api')), 'la climatología ya estaba');
  assert.equal(r.peso, 10);
});

test('presupuesto corto: rellena las que caben y, bajo el 90 %, no publica', async () => {
  const almacen = almacenMemoria();
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(20), esperar, presupuesto: 30 });
  assert.equal(r.estado, 'sin-publicar');
  assert.equal(r.conDatos, 5);   // 30 / (71 / 14)
  assert.ok(r.peso <= 30);
  assert.equal(await almacen.leerJson('ultimo.json'), null);
});

test('429 persistente en un trozo: esas celdas sin datos, no se publica y queda el índice anterior', async () => {
  const almacen = almacenMemoria();
  await almacen.subir('ultimo.json', { version: 1, sello: '2026-09-30T19', archivo: '2026-09-30T19.json' });
  const primeras = '40,40.01,40.02,40.03,40.04';
  const r = await ejecutar({ almacen, ahora: MANANA, gruesa: gruesa(10), esperar, trozo: 5,
    fetchFn: openMeteoFalso({ hoy: '2026-10-01', fallos: (u) => u.searchParams.get('latitude') === primeras && !u.hostname.startsWith('archive') }) });
  assert.equal(r.estado, 'sin-publicar');
  assert.equal(r.conDatos, 5);
  assert.ok(r.errores.some((e) => /429/.test(e)));
  assert.equal((await almacen.leerJson('ultimo.json')).sello, '2026-09-30T19');
});

test('un 429 suelto se reintenta tras esperar y se publica', async () => {
  const esperas = [];
  const r = await ejecutar({ almacen: almacenMemoria(), ahora: MANANA, gruesa: gruesa(4), trozo: 5, esperar: async (ms) => { esperas.push(ms); },
    fetchFn: openMeteoFalso({ hoy: '2026-10-01', fallos: (u, n) => n === 1 }) });
  assert.equal(r.estado, 'publicado');
  assert.deepEqual(esperas, [5000]);
});

test('en dos lotes: el primero deja su parte y el segundo junta y publica', async () => {
  const almacen = almacenMemoria(), fetchFn = openMeteoFalso({ hoy: '2026-10-01' });
  const r0 = await ejecutar({ almacen, fetchFn, ahora: MANANA, gruesa: gruesa(10), esperar, lote: 0, lotes: 2 });
  assert.equal(r0.estado, 'parcial');
  assert.equal(await almacen.leerJson('ultimo.json'), null);
  const r1 = await ejecutar({ almacen, fetchFn, ahora: MANANA, gruesa: gruesa(10), esperar, lote: 1, lotes: 2 });
  assert.equal(r1.estado, 'publicado');
  assert.equal(Object.keys((await almacen.leerJson('2026-10-01T07.json')).celdas).length, 10);
  assert.deepEqual(await almacen.listar('parcial/2026-10-01T07'), []);
});

test('la migración deja las tablas cerradas y el bucket del índice público', () => {
  const sql = readFileSync('supabase/migrations/20261002000000_rejilla.sql', 'utf8');
  for (const t of ['meteo_celdas', 'clima_celdas']) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
    assert.doesNotMatch(sql, new RegExp(`create policy[^;]*on public\\.${t}`));
  }
  assert.match(sql, /revoke all on public\.meteo_celdas, public\.clima_celdas from anon, authenticated/);
  assert.match(sql, /values \('indice', 'indice', true/);
  assert.doesNotMatch(readFileSync('supabase/migrations/20261002000100_rejilla_cron.sql', 'utf8'), /sb_secret|service_role|eyJ/);
});
```

Run: `node --test tests/rejilla-funcion.test.js`
Expected: FAIL (`Cannot find module '../supabase/functions/rejilla/manejador.js'`).

- [ ] **Step 3: Escribir el manejador**

```js
// supabase/functions/rejilla/manejador.js
// Una ejecución de la Edge Function «rejilla» con dependencias inyectadas (almacén, fetch, reloj): planifica las
// peticiones a Open-Meteo dentro del presupuesto, guarda la meteo y la climatología, reconstruye la serie de cada
// celda gruesa, resume sus agregados y publica el índice si hay datos en el 90 % de las celdas.
import { hoyMadrid, FUTUROS, sumarDias } from '../_shared/meteo.js';
import { resumirCelda, diaConDatos, VERSION_SALIDA } from '../_shared/salida-indice.js';
import { selloDe, tocaEjecutar, inicioSerie, planificar, filasDePrincipal, filasDeArchivoLluvia, filasDeClima, serieDesdeFilas,
  aplicarClimaCelda, decidirPublicacion, archivosABorrar, celdasDelLote, pedirConReintento, TROZO, PRESUPUESTO_EJECUCION } from './nucleo.js';

export async function ejecutar({ almacen, fetchFn, ahora = new Date(), gruesa, lote = 0, lotes = 1, forzar = false, esperar, trozo = TROZO, presupuesto = PRESUPUESTO_EJECUCION }) {
  const sello = forzar ? selloDe(ahora) : tocaEjecutar(ahora);
  if (!sello) return { estado: 'fuera-de-hora' };
  const hoy = hoyMadrid(ahora);
  const celdas = celdasDelLote(gruesa.celdas, lote, lotes), ids = celdas.map((c) => c.id);
  const [resumen, climaAntes] = await Promise.all([almacen.resumen(ids), almacen.clima(ids)]);
  const plan = planificar({ celdas, resumen, clima: climaAntes, hoy, presupuesto: presupuesto / lotes, trozo });
  const errores = [], climaPorTrozo = new Map();
  for (const p of plan.peticiones) {
    try {
      const json = await pedirConReintento(fetchFn, p.url, esperar ? { esperar } : {});
      if (p.tipo === 'principal') await almacen.guardarFilas(filasDePrincipal(json, p.celdas, hoy, ahora));
      else if (p.tipo === 'archivo') await almacen.guardarFilas(filasDeArchivoLluvia(json, p.celdas, p.desde, p.hasta, ahora));
      else {
        if (!climaPorTrozo.has(p.trozo)) climaPorTrozo.set(p.trozo, { celdas: p.celdas, partes: [] });
        climaPorTrozo.get(p.trozo).partes.push(json);
      }
    } catch (e) { errores.push(`${p.tipo}: ${e.message}`); }
  }
  for (const { celdas: cs, partes } of climaPorTrozo.values()) if (partes.length === 2) await almacen.guardarClima(filasDeClima(partes, cs, hoy, ahora));

  const desde = inicioSerie(hoy), hasta = sumarDias(hoy, FUTUROS - 1);
  const fechas = Array.from({ length: FUTUROS }, (_, k) => sumarDias(hoy, k));
  const [filas, clima] = await Promise.all([almacen.series(ids, desde), almacen.clima(ids)]);
  const parte = {};
  for (const c of celdas) {
    const fila = filas.get(c.id);
    if (!fila) continue;   // sin meteo: no sale en el índice (el móvil la pinta en gris)
    parte[c.id] = resumirCelda({ altRef: c.altRef, serie: aplicarClimaCelda(serieDesdeFilas(fila, desde, hasta, hoy), clima.get(c.id)), fechas });
  }

  let todas = parte;
  if (lotes > 1) {
    await almacen.subir(`parcial/${sello}/${lote}.json`, parte, '3600');
    const hechos = await almacen.listar(`parcial/${sello}`);
    if (hechos.length < lotes) return { estado: 'parcial', sello, lote, peso: plan.peso, errores };
    todas = {};
    for (const n of hechos) Object.assign(todas, await almacen.leerJson(`parcial/${sello}/${n}`));
    await almacen.borrar(hechos.map((n) => `parcial/${sello}/${n}`));
  }
  const total = gruesa.celdas.length;
  const conDatos = Object.values(todas).filter((c) => diaConDatos(c.dias[0])).length;
  if (!decidirPublicacion(conDatos, total)) return { estado: 'sin-publicar', sello, conDatos, total, peso: plan.peso, errores };
  const generado = ahora.toISOString(), archivo = `${sello}.json`;
  await almacen.subir(archivo, { version: VERSION_SALIDA, sello, generado, hoy, fechas, celdas: todas }, '86400');
  await almacen.subir('ultimo.json', { version: VERSION_SALIDA, sello, archivo, generado, conDatos, total }, '60');
  await almacen.borrar(archivosABorrar(await almacen.listar('')));
  return { estado: 'publicado', sello, conDatos, total, peso: plan.peso, errores };
}

// Almacén real: tablas meteo_celdas y clima_celdas, la vista meteo_celdas_resumen, la función series_celdas y el
// bucket público «indice». Se lee todo (son unas 350 filas) para no meter cientos de ids en la URL.
export function almacenSupabase(admin) {
  const datos = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const bucket = () => admin.storage.from('indice');
  return {
    async resumen(ids) { const s = new Set(ids); return new Map(datos(await admin.from('meteo_celdas_resumen').select('celda, desde, hasta, dias')).filter((r) => s.has(r.celda)).map((r) => [r.celda, r])); },
    async clima(ids) { const s = new Set(ids); return new Map(datos(await admin.from('clima_celdas').select('celda, por_mes, meses, actualizado')).filter((r) => s.has(r.celda)).map((r) => [r.celda, r])); },
    async guardarFilas(filas) { for (let k = 0; k < filas.length; k += 1000) datos(await admin.from('meteo_celdas').upsert(filas.slice(k, k + 1000), { onConflict: 'celda,fecha,modelo' })); },
    async guardarClima(filas) { if (filas.length) datos(await admin.from('clima_celdas').upsert(filas)); },
    async series(ids, desde) { return new Map(datos(await admin.rpc('series_celdas', { p_celdas: ids, p_desde: desde })).map((r) => [r.celda, r])); },
    async subir(nombre, json, cacheControl) {
      datos(await bucket().upload(nombre, new Blob([JSON.stringify(json)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl }));
    },
    async leerJson(nombre) { const { data, error } = await bucket().download(nombre); return error ? null : JSON.parse(await data.text()); },
    async listar(prefijo) { return datos(await bucket().list(prefijo, { limit: 1000 })).filter((f) => f.id).map((f) => f.name); },
    async borrar(nombres) { if (nombres.length) datos(await bucket().remove(nombres)); },
  };
}
```

(`list()` de Storage devuelve también las «carpetas» con `id: null`; por eso el filtro `f.id`.)

- [ ] **Step 4: Escribir la entrada de Deno**

```ts
// supabase/functions/rejilla/index.ts
// Edge Function «rejilla» (spec §3.2): la lanza pg_cron con pg_net a las 05, 06, 17 y 18 UTC; solo trabaja a las 07:00 y
// 19:00 de Madrid. Protegida con la cabecera x-rejilla-clave (secreto REJILLA_CLAVE; se despliega con --no-verify-jwt).
// Contesta 202 enseguida y sigue en segundo plano (EdgeRuntime.waitUntil).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import GRUESA from './gruesa.json' with { type: 'json' };
import { ejecutar, almacenSupabase } from './manejador.js';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('método no permitido', { status: 405 });
  const clave = Deno.env.get('REJILLA_CLAVE');
  if (!clave || req.headers.get('x-rejilla-clave') !== clave) return new Response('no autorizado', { status: 401 });
  const u = new URL(req.url);
  const lote = Number(u.searchParams.get('lote') ?? 0), lotes = Number(u.searchParams.get('lotes') ?? 1);
  if (!(Number.isInteger(lotes) && lotes >= 1 && lotes <= 10 && Number.isInteger(lote) && lote >= 0 && lote < lotes)) return new Response('lote inválido', { status: 400 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const trabajo = ejecutar({ almacen: almacenSupabase(admin), fetchFn: fetch, gruesa: GRUESA, lote, lotes, forzar: u.searchParams.get('forzar') === '1' })
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => console.error(`rejilla: ${(e as Error).message}`));
  if (typeof EdgeRuntime !== 'undefined') { EdgeRuntime.waitUntil(trabajo); return new Response('en marcha', { status: 202 }); }
  await trabajo;
  return new Response('hecho');
});
```

- [ ] **Step 5: Escribir las migraciones**

```sql
-- supabase/migrations/20261002000000_rejilla.sql
-- Mapa por laderas (docs/superpowers/specs/2026-10-01-mapa-indice-design.md §3.2): meteo diaria por celda gruesa,
-- climatología del suelo y bucket público con el índice precalculado. Solo escribe la Edge Function «rejilla» con la
-- clave de servicio; anon no ve las tablas. El índice publicado es público (lo lee el móvil sin login).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.meteo_celdas (
  celda text not null,
  fecha date not null,
  modelo text not null default 'best_match',
  precip double precision, tmedia double precision, tmin double precision, tmax double precision, et0 double precision,
  viento double precision, hr double precision, hsuelo double precision, tsuelo double precision,
  previsto boolean not null default false,
  actualizado timestamptz not null default now(),
  primary key (celda, fecha, modelo)
);
create table public.clima_celdas (
  celda text primary key,
  por_mes jsonb not null,                 -- { "9": [0.21, …], "10": […] }: humedad del suelo diaria por mes
  meses smallint[] not null,              -- meses que cubre (del anterior al segundo siguiente)
  actualizado timestamptz not null default now()
);
alter table public.meteo_celdas enable row level security;
alter table public.clima_celdas enable row level security;
revoke all on public.meteo_celdas, public.clima_celdas from anon, authenticated;

-- Días observados de cada celda (desde, último no previsto y cuántos): el planificador decide si basta con 2 días.
create view public.meteo_celdas_resumen with (security_invoker = true) as
  select celda, min(fecha) as desde, max(fecha) filter (where not previsto) as hasta, count(*) filter (where not previsto) as dias
  from public.meteo_celdas where modelo = 'best_match' group by celda;
revoke all on public.meteo_celdas_resumen from anon, authenticated;

-- Series de varias celdas en una sola llamada, con un array por columna.
create function public.series_celdas(p_celdas text[], p_desde date)
returns table (celda text, fechas date[], precip double precision[], tmedia double precision[], tmin double precision[], tmax double precision[],
  et0 double precision[], viento double precision[], hr double precision[], hsuelo double precision[], tsuelo double precision[])
language sql stable set search_path = public as $$
  select m.celda, array_agg(m.fecha order by m.fecha), array_agg(m.precip order by m.fecha), array_agg(m.tmedia order by m.fecha),
    array_agg(m.tmin order by m.fecha), array_agg(m.tmax order by m.fecha), array_agg(m.et0 order by m.fecha),
    array_agg(m.viento order by m.fecha), array_agg(m.hr order by m.fecha), array_agg(m.hsuelo order by m.fecha), array_agg(m.tsuelo order by m.fecha)
  from public.meteo_celdas m
  where m.celda = any(p_celdas) and m.fecha >= p_desde and m.modelo = 'best_match'
  group by m.celda;
$$;
revoke all on function public.series_celdas(text[], date) from public, anon, authenticated;

-- Bucket público de lectura con el índice (JSON, hasta 5 MB). Sin políticas de escritura: solo la clave de servicio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('indice', 'indice', true, 5242880, array['application/json'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['application/json'];

-- La serie más larga va del 1 de agosto del año anterior: lo de más de 400 días sobra.
select cron.schedule('rejilla-limpieza', '30 3 * * *', $$delete from public.meteo_celdas where fecha < current_date - 400$$);
```

```sql
-- supabase/migrations/20261002000100_rejilla_cron.sql
-- pg_cron trabaja en UTC: 05, 06, 17 y 18 UTC cubren las 07:00 y 19:00 de Madrid en verano (UTC+2) y en invierno (UTC+1).
-- La función solo trabaja cuando en Madrid son las 07 o las 19 (tocaEjecutar); en las otras dos horas sale enseguida.
-- La clave se lee de Vault al ejecutar (se crea en el despliegue, tarea 13): nunca va en este archivo.
-- Con CONFIG.supabase.lotes = N > 1, un trabajo por lote: 'rejilla-lote-k' a los minutos 2·k ('2 5,6,17,18 * * *' para k = 1…)
-- y la URL con lote=k&lotes=N.
select cron.schedule('rejilla-lote-0', '0 5,6,17,18 * * *', $$
  select net.http_post(
    url := 'https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/rejilla?lote=0&lotes=1',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-rejilla-clave', (select decrypted_secret from vault.decrypted_secrets where name = 'rejilla_clave')),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000);
$$);
```

Si `CONFIG.supabase.lotes` es mayor que 1, añadir en este mismo archivo un `select cron.schedule('rejilla-lote-1', '2 5,6,17,18 * * *', …)` con `lote=1&lotes=N`, y así hasta `N − 1`, cambiando `lotes=1` por `lotes=N` en el del lote 0.

- [ ] **Step 6: Ejecutar la prueba**

Run: `node --test tests/rejilla-funcion.test.js`
Expected: PASS (8 pruebas).

- [ ] **Step 7: Medir la CPU de una ejecución completa en local**

Run: `node -e "import('./supabase/functions/rejilla/manejador.js').then(async ({ ejecutar }) => { const { openMeteoFalso, almacenMemoria } = await import('./tests/dobles-rejilla.js'); const fs = await import('node:fs'); const gruesa = JSON.parse(fs.readFileSync('data/rejilla/gruesa.json')); const almacen = almacenMemoria(); const fetchFn = openMeteoFalso({ hoy: '2026-10-01' }); await ejecutar({ almacen, fetchFn, ahora: new Date('2026-10-01T05:00:00Z'), gruesa, esperar: async () => {}, presupuesto: 1e9 }); const t0 = performance.now(); const r = await ejecutar({ almacen, fetchFn, ahora: new Date('2026-10-01T17:00:00Z'), gruesa, esperar: async () => {} }); console.log(r.estado, r.conDatos, '/', r.total, Math.round(performance.now() - t0), 'ms'); })"`
Expected: `publicado` y un tiempo. Anotarlo en el informe 08 (D4). Si pasa de la mitad del límite de CPU de Supabase que se anotó en el sondeo, subir `CONFIG.supabase.lotes` según el criterio de la tarea 0 y añadir los trabajos de pg_cron del paso 5.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/rejilla/manejador.js supabase/functions/rejilla/index.ts supabase/migrations/20261002000000_rejilla.sql supabase/migrations/20261002000100_rejilla_cron.sql tests/dobles-rejilla.js tests/rejilla-funcion.test.js docs/investigacion/08-rejilla-fuentes.md
git commit -m "$(cat <<'EOF'
Función rejilla: manejador, entrada de Deno y migraciones (tablas, bucket, pg_cron), probados con dobles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 13: Despliegue en Supabase  ⚠️ requiere token y autorización

> **El controlador se para al empezar esta tarea.** Hace falta un *access token* nuevo de Supabase (el `setas-claude` debía revocarse) y la **autorización explícita de la usuaria en ese momento** para: aplicar las migraciones, crear el secreto, guardar la clave en Vault, desplegar la función y programar pg_cron. Sin las dos cosas, no se ejecuta ningún paso y se sigue con la tarea 14 (la app funciona sin índice: §3.4). El token solo vive en la variable de entorno de esa terminal; nunca en el repo, en documentos ni en commits.

**Files:**
- Modify: `docs/supabase.md` (sección nueva «Edge Function `rejilla`»)

**Interfaces:**
- Consumes: tareas 8, 11 y 12.
- Produces: tablas, vista, función SQL, bucket `indice` y pg_cron en el proyecto `ctgedeunquvmcfqsufjj`; la función `rejilla` desplegada; `https://ctgedeunquvmcfqsufjj.supabase.co/storage/v1/object/public/indice/ultimo.json`.

- [ ] **Step 1: Preguntar a la usuaria y esperar**

Mensaje (en español): qué se va a crear (dos tablas privadas, una vista, una función SQL, un bucket público de solo lectura, un secreto, una función programada dos veces al día), el gasto en Open-Meteo (unas 1.000 llamadas ponderadas al día, de 10.000 gratuitas) y que hace falta un token nuevo. Preguntar también si quiere el **relleno inicial rápido** (3 o 4 ejecuciones forzadas seguidas, unas 1.800 ponderadas una sola vez) o esperar unos 2 días a que lo haga pg_cron.

- [ ] **Step 2: Aplicar las migraciones**

```bash
export SUPABASE_ACCESS_TOKEN=<token nuevo que da la usuaria, solo en esta terminal>
npx --yes supabase@2.118.0 link --project-ref ctgedeunquvmcfqsufjj
npx --yes supabase@2.118.0 db push
```

Expected: las dos migraciones aplicadas. Si `create extension pg_cron` falla, activar `pg_cron` y `pg_net` en el panel (Database → Extensions, como dijo el sondeo D4) y repetir `db push`.

- [ ] **Step 3: Crear la clave, guardarla como secreto y en Vault**

```bash
CLAVE=$(node -e "console.log(crypto.randomUUID())")
npx --yes supabase@2.118.0 secrets set REJILLA_CLAVE="$CLAVE" --project-ref ctgedeunquvmcfqsufjj
npx --yes supabase@2.118.0 db query --linked "select vault.create_secret('$CLAVE', 'rejilla_clave', 'Clave de la Edge Function rejilla para pg_cron')"
```

La clave no se imprime ni se apunta: si se pierde, se crea otra y se actualizan las dos copias.

- [ ] **Step 4: Desplegar la función**

```bash
npx --yes supabase@2.118.0 functions deploy rejilla --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj
```

Expected: `Deployed Functions on project ctgedeunquvmcfqsufjj: rejilla`. Si el empaquetado no encuentra `../_shared/*.js` o `./gruesa.json`, parar y anotar el error (no copiar archivos a mano).

- [ ] **Step 5: Primera ejecución forzada y comprobación**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "x-rejilla-clave: $CLAVE" "https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/rejilla?forzar=1"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/rejilla?forzar=1"
npx --yes supabase@2.118.0 db query --linked "select count(distinct celda) as celdas, count(*) as filas from public.meteo_celdas"
```

Expected: `202`, luego `401` (sin clave no entra) y, tras un minuto, unas 98 celdas con meteo. Si la usuaria aceptó el relleno rápido, repetir la primera orden cada 2 minutos hasta que `curl -s https://ctgedeunquvmcfqsufjj.supabase.co/storage/v1/object/public/indice/ultimo.json` devuelva el puntero (3 o 4 veces). Si no, esperar a pg_cron.

- [ ] **Step 6: Comprobar pg_cron**

```bash
npx --yes supabase@2.118.0 db query --linked "select jobname, schedule, active from cron.job"
```

Expected: `rejilla-limpieza` y `rejilla-lote-0` (y los demás lotes si los hay), activos. Al día siguiente: `select status_code, created from net._http_response order by created desc limit 4` muestra 202 a las 05 o 06 UTC.

- [ ] **Step 7: Documentar en `docs/supabase.md`**

```markdown
## Edge Function `rejilla` (índice por ladera)

- Calcula a las 07:00 y 19:00 de Madrid los agregados del índice de cada celda gruesa (`data/rejilla/gruesa.json`) y los
  publica en el bucket público `indice` (`<sello>.json` y `ultimo.json`). Diseño: `docs/superpowers/specs/2026-10-01-mapa-indice-design.md`.
- La lanza pg_cron (`rejilla-lote-0`, a las 05, 06, 17 y 18 UTC) con pg_net y la cabecera `x-rejilla-clave`, que se lee
  de Vault (`rejilla_clave`) y coincide con el secreto `REJILLA_CLAVE`. Desplegada con `--no-verify-jwt`.
- Tablas privadas `meteo_celdas` (meteo diaria, 400 días) y `clima_celdas` (climatología del suelo por mes); vista
  `meteo_celdas_resumen`; función SQL `series_celdas`. Limpieza diaria `rejilla-limpieza`.
- Presupuesto: 500 llamadas ponderadas a Open-Meteo por ejecución (1.000 al día). Si menos del 90 % de las celdas tiene
  datos, no publica y sigue valiendo el índice anterior (el móvil avisa «Datos de ayer a las 19:00»).
- Forzar una ejecución: `curl -X POST -H "x-rejilla-clave: <clave>" ".../functions/v1/rejilla?forzar=1"`.
- Despliegue: `npx --yes supabase@2.118.0 functions deploy rejilla --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj`.
- Desplegada el AAAA-MM-DD; primera publicación el AAAA-MM-DD (rellenar con las fechas reales).
```

Sustituir las dos fechas por las reales antes del commit. Recordar a la usuaria que revoque el token al terminar.

- [ ] **Step 8: Commit**

```bash
git add docs/supabase.md
git commit -m "$(cat <<'EOF'
Supabase: función rejilla desplegada, tablas, bucket del índice y pg_cron documentados

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 14: Carga en el móvil: índice diario, rejillas visibles y avisos

**Files:**
- Create: `js/rejilla/carga.js`
- Test: `tests/rejilla-carga.test.js`

**Interfaces:**
- Consumes: `leer`, `guardar`, `almacenPorDefecto` (`js/cache.js`); `SUPABASE_URL` (`js/config.js`); `validarSalida` (tarea 9); `decodificarRejilla` (tarea 4); `ventanaBbox` (tarea 3); `hoyMadrid`, `sumarDias` (`js/meteo.js`).
- Produces: `BASE_INDICE`; `async cargarIndice({ fetchFn, ahora, almacen }) → { salida|null, desdeCache, error? }` (caché 3 h en la clave `indice`; si el puntero no ha cambiado, no baja el archivo otra vez); `selloEsperado(ahora) → 'AAAA-MM-DDTHH'`; `avisoIndice(salida, ahora) → texto|null`; `diasDisponibles(salida, hoy) → fechas ≥ hoy`; `async cargarDatosRejilla({ fetchFn, base }) → { indice, gruesa }`; `archivosVisibles(indiceRejilla, [o, s, e, n]) → archivo[]`; `archivoDeCelda(indiceRejilla, col, fila) → archivo|null`; `crearCargadorRejillas({ fetchFn, base }) → { cargar(archivo) → Promise<rejilla decodificada> }`.

- [ ] **Step 1: Escribir la prueba**

```js
// tests/rejilla-carga.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarIndice, avisoIndice, selloEsperado, diasDisponibles, archivosVisibles, archivoDeCelda, crearCargadorRejillas, BASE_INDICE } from '../js/rejilla/carga.js';
import { codificarRejilla } from '../js/rejilla/formato.js';

function almacenFalso() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
}
const fechas = (desde) => Array.from({ length: 10 }, (_, k) => new Date(Date.parse(`${desde}T00:00:00Z`) + k * 864e5).toISOString().slice(0, 10));
const salidaDe = (sello) => ({ version: 1, sello, generado: '2026-10-01T05:03:00.000Z', hoy: sello.slice(0, 10), fechas: fechas(sello.slice(0, 10)),
  celdas: { 'z:1:1': { altRef: 1000, incompleta: false, lluvia: { desde: '2026-08-03', hoy: 59, mm: [] }, dias: Array(10).fill(null) } } });
function servidor(sello) {
  const registro = [];
  const fetchFn = async (url) => {
    registro.push(url);
    if (url.startsWith(`${BASE_INDICE}/ultimo.json`)) return { ok: true, json: async () => ({ version: 1, sello: sello.actual, archivo: `${sello.actual}.json` }) };
    if (url === `${BASE_INDICE}/${sello.actual}.json`) return { ok: true, json: async () => salidaDe(sello.actual) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchFn, registro };
}
const T0 = new Date('2026-10-01T06:00:00Z');

test('cargarIndice: baja el puntero y el archivo; en 3 h, de la caché; luego, solo el puntero si no cambió', async () => {
  const sello = { actual: '2026-10-01T07' }, { fetchFn, registro } = servidor(sello), almacen = almacenFalso();
  const a = await cargarIndice({ fetchFn, ahora: T0, almacen });
  assert.equal(a.salida.sello, '2026-10-01T07');
  assert.equal(a.desdeCache, false);
  assert.equal(registro.length, 2);
  const b = await cargarIndice({ fetchFn, ahora: new Date(T0.getTime() + 2 * 3600e3), almacen });
  assert.equal(b.desdeCache, true);
  assert.equal(registro.length, 2);
  const c = await cargarIndice({ fetchFn, ahora: new Date(T0.getTime() + 4 * 3600e3), almacen });
  assert.equal(c.salida.sello, '2026-10-01T07');
  assert.equal(registro.length, 3);
  sello.actual = '2026-10-01T19';
  const d = await cargarIndice({ fetchFn, ahora: new Date(T0.getTime() + 8 * 3600e3), almacen });
  assert.equal(d.salida.sello, '2026-10-01T19');
  assert.equal(registro.length, 5);
});

test('cargarIndice: sin red, el guardado con aviso de error; sin nada guardado, sin índice', async () => {
  const almacen = almacenFalso();
  await cargarIndice({ fetchFn: servidor({ actual: '2026-10-01T07' }).fetchFn, ahora: T0, almacen });
  const caido = async () => { throw new Error('sin red'); };
  const r = await cargarIndice({ fetchFn: caido, ahora: new Date(T0.getTime() + 5 * 3600e3), almacen });
  assert.equal(r.salida.sello, '2026-10-01T07');
  assert.match(r.error, /sin red/);
  const nada = await cargarIndice({ fetchFn: caido, ahora: T0, almacen: almacenFalso() });
  assert.equal(nada.salida, null);
  assert.match(nada.error, /sin red/);
});

test('cargarIndice: con el almacén lleno o bloqueado el índice llega igual (sin caché)', async () => {
  const lleno = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem() {}, key: () => null, length: 0 };
  const r = await cargarIndice({ fetchFn: servidor({ actual: '2026-10-01T07' }).fetchFn, ahora: T0, almacen: lleno });
  assert.equal(r.salida.sello, '2026-10-01T07');
  assert.equal(r.error, undefined);
  const bloqueado = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  assert.equal((await cargarIndice({ fetchFn: servidor({ actual: '2026-10-01T07' }).fetchFn, ahora: T0, almacen: bloqueado })).salida.sello, '2026-10-01T07');
});

test('cargarIndice: un archivo mal formado no se usa', async () => {
  const fetchFn = async (url) => ({ ok: true, json: async () => (url.includes('ultimo.json') ? { sello: '2026-10-01T07', archivo: '2026-10-01T07.json' } : { version: 9 }) });
  const r = await cargarIndice({ fetchFn, ahora: T0, almacen: almacenFalso() });
  assert.equal(r.salida, null);
  assert.match(r.error, /mal formado/);
});

test('avisos de antigüedad: «Datos de ayer a las 19:00» y compañía, con 45 min de margen y cambio de hora', () => {
  const s = (sello) => ({ sello });
  assert.equal(avisoIndice(s('2026-10-01T07'), new Date('2026-10-01T06:00:00Z')), null);
  assert.equal(avisoIndice(s('2026-09-30T19'), new Date('2026-10-01T06:00:00Z')), 'Datos de ayer a las 19:00. No se ha podido actualizar el mapa; las manchas son de entonces.');
  assert.equal(avisoIndice(s('2026-09-30T19'), new Date('2026-10-01T05:20:00Z')), null);   // 07:20: aún dentro del margen
  assert.match(avisoIndice(s('2026-10-01T07'), new Date('2026-10-01T20:00:00Z')), /^Datos de hoy a las 07:00\./);
  assert.match(avisoIndice(s('2026-09-30T19'), new Date('2026-10-03T10:00:00Z')), /^Datos del 30 de septiembre a las 19:00\./);
  assert.equal(avisoIndice(s('2026-10-24T19'), new Date('2026-10-25T06:30:00Z')), null);   // 07:30 de invierno
  assert.match(avisoIndice(s('2026-10-24T19'), new Date('2026-10-25T07:00:00Z')), /^Datos de ayer a las 19:00\./);
  assert.equal(selloEsperado(new Date('2026-10-01T03:00:00Z')), '2026-09-30T19');
  assert.equal(avisoIndice(null), null);
});

test('días disponibles: con un índice de ayer, la barra empieza hoy', () => {
  const salida = salidaDe('2026-09-30T19');
  const d = diasDisponibles(salida, '2026-10-01');
  assert.equal(d[0], '2026-10-01');
  assert.equal(d.length, 9);
  assert.deepEqual(diasDisponibles(null, '2026-10-01'), []);
});

test('archivos visibles y archivo de una celda', () => {
  const indice = { archivos: [{ zona: 'guadarrama', archivo: 'guadarrama.bin', col0: 78257, fila0: 60071, ancho: 215, alto: 236 },
    { zona: 'toledo', archivo: 'toledo.bin', col0: 78300, fila0: 63400, ancho: 468, alto: 260 }] };
  assert.deepEqual(archivosVisibles(indice, [-4.0, 40.84, -3.98, 40.86]).map((a) => a.archivo), ['guadarrama.bin']);
  assert.deepEqual(archivosVisibles(indice, [10, 50, 11, 51]), []);
  assert.equal(archivoDeCelda(indice, 78371, 60187).archivo, 'guadarrama.bin');
  assert.equal(archivoDeCelda(indice, 1, 1), null);
});

test('cargador de rejillas: una descarga por archivo; si falla, se reintenta la próxima vez', async () => {
  const fuente = { nombre: 'x', url: 'https://x.es', fecha: '2026-10-01' };
  const bytes = await codificarRejilla({ version: 1, zona: 'soria', tam: 250, col0: 1, fila0: 1, ancho: 1, alto: 1, habitats: ['hayedo'], fuentes: { mfe: fuente, mdt: fuente }, generado: '2026-10-01' },
    { habitat: Uint8Array.of(1), terreno: Uint8Array.of(0), altitud: Int16Array.of(1300) });
  let n = 0, falla = true;
  const fetchFn = async () => { n++; if (falla) return { ok: false, status: 500 }; return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; };
  const c = crearCargadorRejillas({ fetchFn, base: 'data/rejilla/' });
  await assert.rejects(c.cargar('soria.bin'), /500/);
  falla = false;
  const [a, b] = await Promise.all([c.cargar('soria.bin'), c.cargar('soria.bin')]);
  assert.equal(a, b);
  assert.equal(a.altitud[0], 1300);
  assert.equal(n, 2);
});
```

Run: `node --test tests/rejilla-carga.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir el módulo**

```js
// js/rejilla/carga.js
// Descarga del índice diario (bucket público «indice» de Supabase; caché 3 h como js/cache.js) y de las rejillas
// finas que se ven (perezosa, una vez por archivo). Avisos de antigüedad (spec §3.4).
import { leer, guardar, almacenPorDefecto } from '../cache.js';
import { SUPABASE_URL } from '../config.js';
import { hoyMadrid, sumarDias } from '../meteo.js';
import { validarSalida } from './salida.js';
import { decodificarRejilla } from './formato.js';
import { ventanaBbox } from './geo.js';

export const BASE_INDICE = `${SUPABASE_URL}/storage/v1/object/public/indice`;
const TRES_HORAS = 3 * 3600e3, MARGEN_MS = 45 * 60e3, ESPERA_MS = 20000;
const ZONA = 'Europe/Madrid';

async function pedirJson(fetchFn, url) {
  const r = await fetchFn(url, { signal: AbortSignal.timeout(ESPERA_MS) });
  if (!r.ok) throw new Error(`Índice del mapa: ${r.status}`);
  return r.json();
}

export async function cargarIndice({ fetchFn = globalThis.fetch?.bind(globalThis), ahora = new Date(), almacen = almacenPorDefecto() } = {}) {
  const previo = leer('indice', almacen);
  const valido = previo?.datos && !validarSalida(previo.datos).length ? previo : null;
  if (valido && ahora - new Date(valido.hora) < TRES_HORAS) return { salida: valido.datos, desdeCache: true };
  try {
    const puntero = await pedirJson(fetchFn, `${BASE_INDICE}/ultimo.json?t=${Math.floor(ahora / 6e5)}`);
    let salida = valido?.datos?.sello === puntero.sello ? valido.datos : null;
    if (!salida) {
      salida = await pedirJson(fetchFn, `${BASE_INDICE}/${encodeURIComponent(puntero.archivo)}`);
      const errores = validarSalida(salida);
      if (errores.length) throw new Error(`índice del mapa mal formado: ${errores[0]}`);
    }
    guardar('indice', salida, ahora.toISOString(), almacen);   // si no cabe, guardar devuelve false y se sigue sin caché
    return { salida, desdeCache: salida === valido?.datos };
  } catch (e) {
    if (valido) return { salida: valido.datos, desdeCache: true, error: e.message };
    return { salida: null, desdeCache: false, error: e.message };
  }
}

const partes = (d) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((p) => [p.type, p.value]));
// La última ejecución (07 o 19 de Madrid) que ya debería estar publicada, con 45 minutos de margen.
export function selloEsperado(ahora = new Date()) {
  const p = partes(new Date(ahora.getTime() - MARGEN_MS)), dia = `${p.year}-${p.month}-${p.day}`, h = Number(p.hour);
  return h >= 19 ? `${dia}T19` : h >= 7 ? `${dia}T07` : `${sumarDias(dia, -1)}T19`;
}
const FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
export function avisoIndice(salida, ahora = new Date()) {
  if (!salida?.sello || salida.sello >= selloEsperado(ahora)) return null;
  const hoy = hoyMadrid(ahora), dia = salida.sello.slice(0, 10), hora = `${salida.sello.slice(11)}:00`;
  const cuando = dia === hoy ? 'de hoy' : dia === sumarDias(hoy, -1) ? 'de ayer' : `del ${FECHA.format(new Date(`${dia}T12:00:00Z`))}`;
  return `Datos ${cuando} a las ${hora}. No se ha podido actualizar el mapa; las manchas son de entonces.`;
}
// Días que se pueden elegir en la barra: los del índice desde hoy (un índice de ayer empieza ayer).
export const diasDisponibles = (salida, hoy) => (salida?.fechas ?? []).filter((f) => f >= hoy);

export async function cargarDatosRejilla({ fetchFn = globalThis.fetch?.bind(globalThis), base = 'data/rejilla/' } = {}) {
  const [indice, gruesa] = await Promise.all(['indice.json', 'gruesa.json'].map(async (n) => {
    const r = await fetchFn(`${base}${n}`);
    if (!r.ok) throw new Error(`No se pudo cargar ${base}${n} (${r.status})`);
    return r.json();
  }));
  return { indice, gruesa };
}
export function archivosVisibles(indiceRejilla, bbox) {
  const v = ventanaBbox(bbox);
  return (indiceRejilla?.archivos ?? []).filter((a) => a.col0 < v.col0 + v.ancho && a.col0 + a.ancho > v.col0 && a.fila0 < v.fila0 + v.alto && a.fila0 + a.alto > v.fila0);
}
export const archivoDeCelda = (indiceRejilla, col, fila) =>
  (indiceRejilla?.archivos ?? []).find((a) => col >= a.col0 && col < a.col0 + a.ancho && fila >= a.fila0 && fila < a.fila0 + a.alto) ?? null;

export function crearCargadorRejillas({ fetchFn = globalThis.fetch?.bind(globalThis), base = 'data/rejilla/' } = {}) {
  const cache = new Map();
  return {
    cargar(archivo) {
      if (!cache.has(archivo)) {
        cache.set(archivo, fetchFn(`${base}${archivo}`).then(async (r) => {
          if (!r.ok) throw new Error(`No se pudo cargar ${archivo} (${r.status})`);
          return decodificarRejilla(await r.arrayBuffer());
        }).catch((e) => { cache.delete(archivo); throw e; }));
      }
      return cache.get(archivo);
    },
  };
}
```

- [ ] **Step 3: Ejecutar la prueba**

Run: `node --test tests/rejilla-carga.test.js`
Expected: PASS (8 pruebas).

- [ ] **Step 4: Commit**

```bash
git add js/rejilla/carga.js tests/rejilla-carga.test.js
git commit -m "$(cat <<'EOF'
Mapa: carga del índice diario (caché 3 h), rejillas visibles y avisos de antigüedad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 15: Pintado en canvas (con medición y Web Worker si hace falta)

Cada archivo de rejilla se colorea una vez por día y chip en una imagen de `ancho × alto` píxeles (1 celda = 1 píxel) que la capa dibuja escalada sin suavizado sobre el mapa. Las notas se memorizan por (celda gruesa, hábitat, altitud en tramos de 10 m, orientación): dentro de una celda gruesa hay pocas combinaciones. Lejos (zoom menor de 9) se pintan las celdas gruesas, una nota por celda (la mejor de sus hábitats a su altitud de referencia).

**Files:**
- Create: `js/rejilla/pintor.js`
- Create: `js/rejilla/notas-async.js`
- Create: `js/rejilla/trabajador.js`
- Create: `js/mapa/capa-rejilla.js`
- Create: `scripts/rejilla/medir-pintado.mjs`
- Test: `tests/rejilla-pintor.test.js`, `tests/rejilla-datos.test.js` (añadir una prueba)

**Interfaces:**
- Consumes: `notaCelda` (tarea 10); `agregadosDeCelda` (tarea 9); `idGruesa`, `centroFina`, `aGrados`, `ORIGEN` (tarea 3); `PROHIBIDO`, `CODIGO` (tarea 4); `NIVEL_COLOR` (`js/mapa.js`); `nivelDe` (`js/ui/semaforo.js`).
- Produces: `SIN_COLOR = 255`, `SIN_DATOS = 254`, `ALFA = 150`, `ALFA_GRIS = 110`; `gruesasDeArchivo(rejilla, gruesa) → Int32Array` (índice en `gruesa.celdas` de cada celda fina, −1 si no hay); `notasDeArchivo({ rejilla, gruesas, gruesa, salida, fecha, especies, filtro }) → Uint8Array` (0–100, `SIN_DATOS` o `SIN_COLOR`); `colorear(notas) → Uint8ClampedArray` RGBA; `notaGruesa(celdaGruesa, { salida, fecha, especies, filtro }) → número`; `colorDeNota(v) → hex|null`; `calcularNotas(args) → Promise<Uint8Array>` y `USAR_TRABAJADOR` (`notas-async.js`); `crearCapaRejilla(L) → clase de capa` con `ponerImagen(archivo, cabecera, rgba)` y `quitarTodo()`.

- [ ] **Step 1: Escribir la prueba**

```js
// tests/rejilla-pintor.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gruesasDeArchivo, notasDeArchivo, colorear, notaGruesa, colorDeNota, SIN_COLOR, SIN_DATOS } from '../js/rejilla/pintor.js';
import { resumirCelda } from '../js/rejilla/salida.js';
import { PROHIBIDO } from '../js/rejilla/formato.js';
import { HABITATS } from '../scripts/validar-datos.mjs';
import { serieSintetica, BOLETUS, lluviaBuena } from './ayudas.js';

const fuente = { nombre: 'x', url: 'https://x.es', fecha: '2026-10-01' };
const rejilla = { cabecera: { version: 1, zona: 'guadarrama', tam: 250, col0: 78361, fila0: 60161, ancho: 4, alto: 1, habitats: HABITATS, fuentes: { mfe: fuente, mdt: fuente }, generado: '2026-10-01' },
  habitat: Uint8Array.from([HABITATS.indexOf('pinar-silvestre') + 1, PROHIBIDO, 0, HABITATS.indexOf('chopera') + 1]),
  terreno: new Uint8Array(4), altitud: Int16Array.from([1500, 0, 0, 1500]) };
const gruesa = { pasos: { guadarrama: 0.09 }, celdas: [{ id: 'guadarrama:66:65', zona: 'guadarrama', lon: -4.015, lat: 40.895, altRef: 1500, habitats: ['chopera', 'pinar-silvestre'], nFinas: 2 }] };
const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena });
const fechas = serie.fechas.slice(59, 69);
const salida = { version: 1, sello: '2026-10-18T07', generado: '2026-10-18T05:00:00.000Z', hoy: fechas[0], fechas,
  celdas: { 'guadarrama:66:65': resumirCelda({ altRef: 1500, serie, fechas }) } };
const especies = [{ ...BOLETUS, habitats: ['pinar-silvestre'] }];
const pixel = (rgba, k) => [...rgba.slice(4 * k, 4 * k + 4)];

test('celda gruesa de cada celda fina (solo las que tienen hábitat)', () => {
  assert.deepEqual([...gruesasDeArchivo(rejilla, gruesa)], [0, -1, -1, 0]);
});

test('notas y colores: monte con especie, prohibido, sin monte y hábitat sin especies en temporada', () => {
  const notas = notasDeArchivo({ rejilla, gruesas: gruesasDeArchivo(rejilla, gruesa), gruesa, salida, fecha: fechas[0], especies });
  assert.deepEqual([...notas], [96, SIN_COLOR, SIN_COLOR, SIN_COLOR]);
  const rgba = colorear(notas);
  assert.deepEqual(pixel(rgba, 0), [29, 94, 58, 150]);   // muy bueno, #1d5e3a
  for (const k of [1, 2, 3]) assert.equal(pixel(rgba, k)[3], 0, `celda ${k} sin color`);
});

test('celda gruesa sin datos en el índice: gris, nunca un color inventado', () => {
  const notas = notasDeArchivo({ rejilla, gruesas: gruesasDeArchivo(rejilla, gruesa), gruesa, salida: { ...salida, celdas: {} }, fecha: fechas[0], especies });
  assert.equal(notas[0], SIN_DATOS);
  assert.deepEqual(pixel(colorear(notas), 0), [125, 130, 126, 110]);   // #7d827e
});

test('con chip de otra especie, el pinar no se colorea', () => {
  const notas = notasDeArchivo({ rejilla, gruesas: gruesasDeArchivo(rejilla, gruesa), gruesa, salida, fecha: fechas[0], especies, filtro: new Set(['lactarius-deliciosus']) });
  assert.equal(notas[0], SIN_COLOR);
});

test('vista lejana: una nota por celda gruesa', () => {
  const g = gruesa.celdas[0];
  assert.equal(notaGruesa(g, { salida, fecha: fechas[0], especies }), 96);
  assert.equal(notaGruesa(g, { salida: { ...salida, celdas: {} }, fecha: fechas[0], especies }), SIN_DATOS);
  assert.equal(notaGruesa(g, { salida, fecha: fechas[0], especies: [] }), SIN_COLOR);
  assert.equal(colorDeNota(96), '#1d5e3a');
  assert.equal(colorDeNota(SIN_COLOR), null);
  assert.equal(colorDeNota(SIN_DATOS), '#7d827e');
});
```

Y añadir a `tests/rejilla-datos.test.js`:

```js
import { gruesasDeArchivo, notasDeArchivo, colorear } from '../js/rejilla/pintor.js';
import { resumirCelda } from '../js/rejilla/salida.js';
import { especiesDeZona } from '../js/datos.js';
import { serieSintetica, lluviaBuena } from './ayudas.js';

test('con los datos reales, ninguna celda prohibida o sin hábitat sale con color', { skip: !hay }, async () => {
  const gruesa = leer('data/rejilla/gruesa.json'), zonas = leer('data/zonas.json').zonas, especies = leer('data/especies.json').especies;
  const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena }), fechas = serie.fechas.slice(59, 69);
  const resumen = resumirCelda({ altRef: 1200, serie, fechas });
  const salida = { version: 1, sello: '2026-10-18T07', hoy: fechas[0], fechas, celdas: Object.fromEntries(gruesa.celdas.map((g) => [g.id, { ...resumen, altRef: g.altRef }])) };
  let coloreadas = 0;
  for (const a of leer('data/rejilla/indice.json').archivos) {
    const r = await decodificarRejilla(readFileSync(`data/rejilla/${a.archivo}`));
    const zona = zonas.find((z) => z.id === r.cabecera.zona);
    const rgba = colorear(notasDeArchivo({ rejilla: r, gruesas: gruesasDeArchivo(r, gruesa), gruesa, salida, fecha: fechas[0], especies: especiesDeZona(zona, especies) }));
    for (let k = 0; k < r.habitat.length; k++) {
      const h = r.habitat[k], alfa = rgba[4 * k + 3];
      if (h & PROHIBIDO || !(h & CODIGO)) assert.equal(alfa, 0, `${a.archivo} celda ${k}: color sin monte apropiado o en prohibido`);
      else if (alfa) coloreadas++;
    }
  }
  assert.ok(coloreadas > 0);
});
```

Run: `node --test tests/rejilla-pintor.test.js tests/rejilla-datos.test.js`
Expected: FAIL (`Cannot find module '../js/rejilla/pintor.js'`).

- [ ] **Step 2: Escribir el pintor**

```js
// js/rejilla/pintor.js
// Notas por celda fina y colores del semáforo (sin DOM: vale en un Web Worker). La nota se memoriza por celda gruesa,
// hábitat, altitud en tramos de 10 m y orientación. Sin monte apropiado o prohibido: SIN_COLOR (transparente);
// celda gruesa sin datos: SIN_DATOS (gris, «sin datos suficientes»). Nunca un color inventado.
import { notaCelda } from './nota.js';
import { agregadosDeCelda } from './salida.js';
import { idGruesa, centroFina, aGrados } from './geo.js';
import { PROHIBIDO, CODIGO } from './formato.js';
import { NIVEL_COLOR } from '../mapa.js';
import { nivelDe } from '../ui/semaforo.js';

export const SIN_COLOR = 255, SIN_DATOS = 254;
export const ALFA = 150, ALFA_GRIS = 110;

export function gruesasDeArchivo(rejilla, gruesa) {
  const c = rejilla.cabecera, n = c.ancho * c.alto, idx = new Int32Array(n).fill(-1);
  const pos = new Map(gruesa.celdas.map((g, k) => [g.id, k])), paso = gruesa.pasos[c.zona];
  for (let f = 0; f < c.alto; f++) for (let col = 0; col < c.ancho; col++) {
    const k = f * c.ancho + col;
    if (!(rejilla.habitat[k] & CODIGO) || rejilla.habitat[k] & PROHIBIDO) continue;
    const { x, y } = centroFina(c.col0 + col, c.fila0 + f, c.tam), p = aGrados(x, y);
    idx[k] = pos.get(idGruesa(c.zona, p.lon, p.lat, paso)) ?? -1;
  }
  return idx;
}

export function notasDeArchivo({ rejilla, gruesas, gruesa, salida, fecha, especies, filtro = null }) {
  const c = rejilla.cabecera, n = c.ancho * c.alto, notas = new Uint8Array(n).fill(SIN_COLOR), memo = new Map();
  for (let k = 0; k < n; k++) {
    const h = rejilla.habitat[k], codigo = h & CODIGO;
    if (!codigo || h & PROHIBIDO) continue;
    const g = gruesas[k], banda = Math.round(rejilla.altitud[k] / 10), ori = rejilla.terreno[k] & 0x0f;
    const clave = (((g + 1) * 32 + codigo) * 1024 + (banda + 100)) * 16 + ori;
    let v = memo.get(clave);
    if (v === undefined) {
      const cg = g >= 0 ? gruesa.celdas[g] : null;
      const ag = cg ? agregadosDeCelda(salida, cg.id, fecha) : null;
      const r = notaCelda({ ag, habitat: c.habitats[codigo - 1], altitud: banda * 10, altRef: salida?.celdas?.[cg?.id]?.altRef ?? banda * 10,
        orientacion: ori, especies, fecha, filtro, explicar: false });
      v = r.sinEspecies ? SIN_COLOR : r.valor == null ? SIN_DATOS : r.valor;
      memo.set(clave, v);
    }
    notas[k] = v;
  }
  return notas;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const PALETA = (() => {
  const p = new Uint8ClampedArray(256 * 4);
  for (let v = 0; v <= 100; v++) p.set([...rgb(NIVEL_COLOR[nivelDe(v)]), ALFA], v * 4);
  p.set([...rgb(NIVEL_COLOR['sin-datos']), ALFA_GRIS], SIN_DATOS * 4);
  return p;
})();
export function colorear(notas) {
  const px = new Uint8ClampedArray(notas.length * 4);
  for (let k = 0; k < notas.length; k++) { const o = notas[k] * 4; px[4 * k] = PALETA[o]; px[4 * k + 1] = PALETA[o + 1]; px[4 * k + 2] = PALETA[o + 2]; px[4 * k + 3] = PALETA[o + 3]; }
  return px;
}

export function notaGruesa(celda, { salida, fecha, especies, filtro = null }) {
  const ag = agregadosDeCelda(salida, celda.id, fecha);
  let hay = false, mejor = null;
  for (const habitat of celda.habitats) {
    const r = notaCelda({ ag, habitat, altitud: celda.altRef, altRef: celda.altRef, orientacion: 0, especies, fecha, filtro, explicar: false });
    if (r.sinEspecies) continue;
    hay = true;
    if (r.valor != null && (mejor == null || r.valor > mejor)) mejor = r.valor;
  }
  return !hay ? SIN_COLOR : mejor ?? SIN_DATOS;
}
export const colorDeNota = (v) => (v === SIN_COLOR ? null : v === SIN_DATOS ? NIVEL_COLOR['sin-datos'] : NIVEL_COLOR[nivelDe(v)]);
```

- [ ] **Step 3: Ejecutar las pruebas**

Run: `node --test tests/rejilla-pintor.test.js tests/rejilla-datos.test.js`
Expected: PASS (5 + 3 pruebas).

- [ ] **Step 4: Escribir la capa de Leaflet y el cálculo asíncrono**

```js
// js/mapa/capa-rejilla.js
// Capa de Leaflet que dibuja en un canvas las imágenes de la rejilla (1 celda = 1 píxel) escaladas sin suavizado.
// Se redibuja al mover o hacer zoom; durante la animación de zoom se oculta para no desencajarse.
import { aGrados, ORIGEN } from '../rejilla/geo.js';

export function crearCapaRejilla(L) {
  return L.Layer.extend({
    initialize() { this._imagenes = new Map(); },
    onAdd(mapa) {
      this._mapa = mapa;
      this._canvas = L.DomUtil.create('canvas', 'capa-rejilla');
      this._canvas.setAttribute('aria-hidden', 'true');
      mapa.getPane('rejilla').append(this._canvas);
      mapa.on('moveend zoomend resize viewreset', this._dibujar, this);
      mapa.on('zoomstart', this._ocultar, this);
      this._dibujar();
    },
    onRemove(mapa) {
      mapa.off('moveend zoomend resize viewreset', this._dibujar, this);
      mapa.off('zoomstart', this._ocultar, this);
      this._canvas.remove();
    },
    ponerImagen(archivo, cabecera, rgba) {
      const lienzo = document.createElement('canvas');
      lienzo.width = cabecera.ancho; lienzo.height = cabecera.alto;
      lienzo.getContext('2d').putImageData(new ImageData(rgba, cabecera.ancho, cabecera.alto), 0, 0);
      const no = aGrados(cabecera.col0 * cabecera.tam - ORIGEN, ORIGEN - cabecera.fila0 * cabecera.tam);
      const se = aGrados((cabecera.col0 + cabecera.ancho) * cabecera.tam - ORIGEN, ORIGEN - (cabecera.fila0 + cabecera.alto) * cabecera.tam);
      this._imagenes.set(archivo, { lienzo, limites: L.latLngBounds([se.lat, no.lon], [no.lat, se.lon]) });
      this._dibujar();
    },
    quitarTodo() { this._imagenes.clear(); this._dibujar(); },
    _ocultar() { if (this._canvas) this._canvas.style.visibility = 'hidden'; },
    _dibujar() {
      const m = this._mapa, c = this._canvas;
      if (!m || !c) return;
      const tam = m.getSize(), dpr = window.devicePixelRatio || 1;
      c.width = Math.round(tam.x * dpr); c.height = Math.round(tam.y * dpr);
      c.style.width = `${tam.x}px`; c.style.height = `${tam.y}px`;
      L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const vista = m.getBounds();
      for (const { lienzo, limites } of this._imagenes.values()) {
        if (!vista.intersects(limites)) continue;
        const a = m.latLngToContainerPoint(limites.getNorthWest()), b = m.latLngToContainerPoint(limites.getSouthEast());
        ctx.drawImage(lienzo, a.x, a.y, b.x - a.x, b.y - a.y);
      }
      c.style.visibility = 'visible';
    },
  });
}
```

```js
// js/rejilla/notas-async.js
// Cálculo de las notas de un archivo, en el hilo principal o en un Web Worker (tarea 15: se activa si la medida
// en un móvil medio pasa de unos 200 ms).
import { notasDeArchivo } from './pintor.js';

export const USAR_TRABAJADOR = false;
let trabajador = null, siguiente = 0;
const pendientes = new Map();

function crearTrabajador() {
  const w = new Worker(new URL('./trabajador.js', import.meta.url), { type: 'module' });
  w.onmessage = (e) => { const p = pendientes.get(e.data.id); pendientes.delete(e.data.id); if (e.data.error) p?.ko(new Error(e.data.error)); else p?.ok(e.data.notas); };
  w.onerror = (e) => { for (const p of pendientes.values()) p.ko(new Error(e.message || 'Error en el cálculo del mapa')); pendientes.clear(); trabajador = null; };
  return w;
}

export function calcularNotas(args) {
  if (!USAR_TRABAJADOR || typeof Worker === 'undefined') return Promise.resolve(notasDeArchivo(args));
  trabajador ??= crearTrabajador();
  const id = ++siguiente;
  return new Promise((ok, ko) => { pendientes.set(id, { ok, ko }); trabajador.postMessage({ id, args }); });
}
```

```js
// js/rejilla/trabajador.js
// Web Worker del pintado del mapa: calcula las notas de un archivo de rejilla fuera del hilo principal.
import { notasDeArchivo } from './pintor.js';

self.onmessage = (e) => {
  const { id, args } = e.data;
  try {
    const notas = notasDeArchivo(args);
    self.postMessage({ id, notas }, [notas.buffer]);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
```

- [ ] **Step 5: Medir el pintado del archivo más grande**

```js
// scripts/rejilla/medir-pintado.mjs
// Mide notasDeArchivo + colorear en el archivo de rejilla con más celdas, con un índice sintético (todas las celdas
// gruesas con la misma meteo húmeda) y las especies reales de su zona. Criterio del plan: el tiempo en el portátil × 4
// (la ralentización de CPU con la que Lighthouse simula un móvil medio); si pasa de 200 ms, se usa el Web Worker.
import { readFileSync } from 'node:fs';
import { decodificarRejilla } from '../../js/rejilla/formato.js';
import { gruesasDeArchivo, notasDeArchivo, colorear } from '../../js/rejilla/pintor.js';
import { resumirCelda } from '../../js/rejilla/salida.js';
import { especiesDeZona } from '../../js/datos.js';
import { serieSintetica, lluviaBuena } from '../../tests/ayudas.js';

const leer = (f) => JSON.parse(readFileSync(f, 'utf8'));
const indice = leer('data/rejilla/indice.json'), gruesa = leer('data/rejilla/gruesa.json');
const zonas = leer('data/zonas.json').zonas, especies = leer('data/especies.json').especies;
const mayor = [...indice.archivos].sort((a, b) => b.ancho * b.alto - a.ancho * a.alto)[0];
const r = await decodificarRejilla(readFileSync(`data/rejilla/${mayor.archivo}`));
const serie = serieSintetica({ dias: 70, hoy: 59, precip: lluviaBuena }), fechas = serie.fechas.slice(59, 69);
const resumen = resumirCelda({ altRef: 1000, serie, fechas });
const salida = { version: 1, sello: '2026-10-18T07', hoy: fechas[0], fechas, celdas: Object.fromEntries(gruesa.celdas.map((g) => [g.id, { ...resumen, altRef: g.altRef }])) };
const esp = especiesDeZona(zonas.find((z) => z.id === r.cabecera.zona), especies);
const gru = gruesasDeArchivo(r, gruesa);
const veces = [];
for (let k = 0; k < 5; k++) {
  const t0 = performance.now();
  colorear(notasDeArchivo({ rejilla: r, gruesas: gru, gruesa, salida, fecha: fechas[0], especies: esp }));
  veces.push(performance.now() - t0);
}
const ms = Math.min(...veces);
console.log(`${mayor.archivo}: ${r.cabecera.ancho} × ${r.cabecera.alto} celdas, ${Math.round(ms)} ms en este equipo, ~${Math.round(ms * 4)} ms en un móvil medio → ${ms * 4 > 200 ? 'Web Worker' : 'hilo principal'}`);
```

Run: `node scripts/rejilla/medir-pintado.mjs`
Expected: una línea con el archivo, los milisegundos y la decisión. Si dice «Web Worker», cambiar en `js/rejilla/notas-async.js` `export const USAR_TRABAJADOR = false;` por `true`. Anotar la medida en `docs/datos.md` (sección «Formato de la rejilla»).

- [ ] **Step 6: Ejecutar todas las pruebas y commit**

Run: `npm run comprobar`
Expected: PASS y `✓ Datos válidos`.

```bash
git add js/rejilla/pintor.js js/rejilla/notas-async.js js/rejilla/trabajador.js js/mapa/capa-rejilla.js scripts/rejilla/medir-pintado.mjs tests/rejilla-pintor.test.js tests/rejilla-datos.test.js docs/datos.md
git commit -m "$(cat <<'EOF'
Mapa: pintado de la rejilla en canvas (colores del semáforo, gris sin datos) con medida y Web Worker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 16: Fondos y panel de capas

**Files:**
- Create: `js/mapa/fondos.js`
- Modify: `img/iconos.svg` (iconos `i-capas`, `i-ubicacion`, `i-buscar`)
- Test: `tests/mapa-fondos.test.js`

**Interfaces:**
- Consumes: `el` (`js/ui/dom.js`); `leer`, `guardar`, `almacenPorDefecto` (`js/cache.js`); `NIVELES`, `palabraDe` (`js/ui/semaforo.js`); `NIVEL_COLOR` (`js/mapa.js`).
- Produces: `CARTO_URL` (plantilla de Voyager con su clave, o `null` para la Base IGN, según la decisión D7 de la tarea 0); `FONDOS = { mapa, relieve, topografico, satelite }` (cada uno `{ nombre, capas: [{ url, opciones }] }`), `FONDO_POR_DEFECTO = 'mapa'`, `SUPERPUESTAS = { cotos: 'Cotos', prohibido: 'Prohibido', lluvia: 'Lluvia', sitios: 'Sitios', diario: 'Diario' }`, `ACTIVAS_POR_DEFECTO = ['prohibido', 'sitios']`; `textoAtribucion(fondo) → texto sin etiquetas`; `crearFondo(L, id) → L.LayerGroup`; `leerPreferencias(almacen?) → { fondo, activas }`; `guardarPreferencias(p, almacen?)`; `panelCapas({ fondo, activas, alCambiar })` (DOM; `alCambiar({ fondo })` o `alCambiar({ capa, activa })`).

- [ ] **Step 0: Aplicar la decisión del fondo claro**

Si la usuaria eligió CARTO con clave (tarea 0, D7), poner en `CARTO_URL` la plantilla exacta que dio el sondeo (con `{s}`, `{z}`, `{x}`, `{y}`, `{r}` y la clave) y comprobar con `curl` que una tesela pesa más de 5 KB. Si no, `CARTO_URL` se queda en `null` (Base IGN).

- [ ] **Step 1: Comprobar el zoom máximo del relieve del IDEE**

Run: `for z in 15 16 17; do x=$(node -e "console.log(Math.floor((-3.9943+180)/360*2**$z))"); y=$(node -e "const l=40.853*Math.PI/180;console.log(Math.floor((1-Math.log(Math.tan(l)+1/Math.cos(l))/Math.PI)/2*2**$z))"); curl -s -o /dev/null -w "z$z %{http_code} %{size_download}\n" "https://servicios.idee.es/wmts/mdt?service=WMTS&request=GetTile&version=1.0.0&layer=Relieve&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&tilematrix=$z&tilerow=$y&tilecol=$x"; done`
Expected: una línea por zoom. El mayor con 200 y más de 1 KB es el `maxNativeZoom` del relieve; si no es 16, cambiarlo en el código del paso 3.

- [ ] **Step 2: Escribir la prueba**

```js
// tests/mapa-fondos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FONDOS, FONDO_POR_DEFECTO, SUPERPUESTAS, ACTIVAS_POR_DEFECTO, CARTO_URL, textoAtribucion, leerPreferencias, guardarPreferencias } from '../js/mapa/fondos.js';

function almacenFalso() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
}

test('cuatro fondos; el de por defecto es el mapa claro: CARTO con su atribución obligatoria o, sin clave, la Base IGN', () => {
  assert.deepEqual(Object.keys(FONDOS), ['mapa', 'relieve', 'topografico', 'satelite']);
  assert.equal(FONDO_POR_DEFECTO, 'mapa');
  if (CARTO_URL) {
    assert.match(FONDOS.mapa.capas[0].url, /basemaps\.cartocdn\.com\/rastertiles\/voyager/);
    assert.equal(textoAtribucion(FONDOS.mapa), '© OpenStreetMap © CARTO');
  } else {
    assert.match(FONDOS.mapa.capas[0].url, /ign\.es\/wmts\/ign-base\?.*layer=IGNBaseTodo/);
    assert.equal(textoAtribucion(FONDOS.mapa), '© Instituto Geográfico Nacional CC BY 4.0');
  }
});

test('relieve = fondo claro + relieve del IDEE en multiply; topográfico MTN y satélite PNOA del IGN', () => {
  assert.equal(FONDOS.relieve.capas.length, 2);
  assert.equal(FONDOS.relieve.capas[0].url, FONDOS.mapa.capas[0].url);
  assert.match(FONDOS.relieve.capas[1].url, /servicios\.idee\.es\/wmts\/mdt\?.*layer=Relieve/);
  assert.equal(FONDOS.relieve.capas[1].opciones.className, 'capa-multiply');
  assert.match(FONDOS.topografico.capas[0].url, /ign\.es\/wmts\/mapa-raster\?.*layer=MTN/);
  assert.match(FONDOS.satelite.capas[0].url, /ign\.es\/wmts\/pnoa-ma\?.*layer=OI\.OrthoimageCoverage/);
  for (const f of Object.values(FONDOS)) for (const c of f.capas) assert.ok(c.opciones.attribution, f.nombre);
});

test('capas superpuestas', () => {
  assert.deepEqual(Object.values(SUPERPUESTAS), ['Cotos', 'Prohibido', 'Lluvia', 'Sitios', 'Diario']);
  assert.deepEqual(ACTIVAS_POR_DEFECTO, ['prohibido', 'sitios']);
});

test('preferencias: por defecto, ida y vuelta, valores raros fuera y almacén roto', () => {
  const a = almacenFalso();
  assert.deepEqual(leerPreferencias(a), { fondo: 'mapa', activas: ['prohibido', 'sitios'] });
  guardarPreferencias({ fondo: 'satelite', activas: ['lluvia'] }, a);
  assert.deepEqual(leerPreferencias(a), { fondo: 'satelite', activas: ['lluvia'] });
  guardarPreferencias({ fondo: 'marte', activas: ['lluvia', 'ovnis'] }, a);
  assert.deepEqual(leerPreferencias(a), { fondo: 'mapa', activas: ['lluvia'] });
  const roto = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.deepEqual(leerPreferencias(roto), { fondo: 'mapa', activas: ['prohibido', 'sitios'] });
  assert.doesNotThrow(() => guardarPreferencias({ fondo: 'mapa', activas: [] }, roto));
});
```

Run: `node --test tests/mapa-fondos.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 3: Escribir el módulo**

```js
// js/mapa/fondos.js
// Fondos del mapa (spec §2, comprobados el 01/10/2026) y capas superpuestas, con la elección guardada en el dispositivo.
import { el } from '../ui/dom.js';
import { leer, guardar, almacenPorDefecto } from '../cache.js';
import { NIVELES, palabraDe } from '../ui/semaforo.js';
import { NIVEL_COLOR } from '../mapa.js';

const WMTS = (base, capa, fmt) => `${base}?service=WMTS&request=GetTile&version=1.0.0&layer=${capa}&style=default&format=image/${fmt}&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}`;
const ATR_IGN = '© <a href="https://www.scne.es">Instituto Geográfico Nacional</a> CC BY 4.0';
// CARTO Voyager pide clave desde 2026 (sin ella, cada tesela es un «API KEY REQUIRED»): tarea 0, D7. Con la URL completa
// (con la clave, si la usuaria la consigue y se puede publicar) el fondo claro es Voyager; con null, la Base IGN.
export const CARTO_URL = null;
const CLARO = CARTO_URL
  ? { url: CARTO_URL, opciones: { subdomains: 'abcd', maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>' } }
  : { url: WMTS('https://www.ign.es/wmts/ign-base', 'IGNBaseTodo', 'jpeg'), opciones: { maxNativeZoom: 18, maxZoom: 18, attribution: ATR_IGN } };

export const FONDOS = {
  mapa: { nombre: 'Mapa', capas: [CLARO] },
  relieve: { nombre: 'Relieve', capas: [CLARO, { url: WMTS('https://servicios.idee.es/wmts/mdt', 'Relieve', 'jpeg'),
    opciones: { className: 'capa-multiply', maxNativeZoom: 16, maxZoom: 18, attribution: `Relieve: ${ATR_IGN}` } }] },
  topografico: { nombre: 'Topográfico IGN', capas: [{ url: WMTS('https://www.ign.es/wmts/mapa-raster', 'MTN', 'jpeg'), opciones: { maxNativeZoom: 18, maxZoom: 18, attribution: ATR_IGN } }] },
  satelite: { nombre: 'Satélite PNOA', capas: [{ url: WMTS('https://www.ign.es/wmts/pnoa-ma', 'OI.OrthoimageCoverage', 'jpeg'), opciones: { maxNativeZoom: 18, maxZoom: 18, attribution: `PNOA cedido por ${ATR_IGN}` } }] },
};
export const FONDO_POR_DEFECTO = 'mapa';
export const SUPERPUESTAS = { cotos: 'Cotos', prohibido: 'Prohibido', lluvia: 'Lluvia', sitios: 'Sitios', diario: 'Diario' };
export const ACTIVAS_POR_DEFECTO = ['prohibido', 'sitios'];

export const textoAtribucion = (fondo) => fondo.capas.map((c) => c.opciones.attribution.replace(/<[^>]+>/g, '')).filter((t, k, a) => a.indexOf(t) === k).join(' · ');
export const crearFondo = (L, id) => L.layerGroup((FONDOS[id] ?? FONDOS[FONDO_POR_DEFECTO]).capas.map((c) => L.tileLayer(c.url, c.opciones)));

const CLAVE = 'mapa-capas';
export function leerPreferencias(almacen = almacenPorDefecto()) {
  const p = leer(CLAVE, almacen)?.datos;
  return {
    fondo: p?.fondo in FONDOS ? p.fondo : FONDO_POR_DEFECTO,
    activas: Array.isArray(p?.activas) ? p.activas.filter((x) => x in SUPERPUESTAS) : [...ACTIVAS_POR_DEFECTO],
  };
}
export const guardarPreferencias = (p, almacen = almacenPorDefecto()) => guardar(CLAVE, { fondo: p.fondo, activas: p.activas }, undefined, almacen);

function leyendaManchas() {
  const punto = (nivel) => { const s = el('span', { clase: 'mapa-leyenda__punto', attrs: { 'aria-hidden': 'true' } }); s.style.background = NIVEL_COLOR[nivel]; return s; };
  return el('div', { clase: 'mapa-panel__leyenda' },
    el('h3', { texto: 'Manchas' }),
    el('ul', { clase: 'mapa-leyenda__lista' }, [...NIVELES, 'sin-datos'].map((n) => el('li', { clase: 'mapa-leyenda__item' }, punto(n), el('span', { texto: n === 'sin-datos' ? 'Sin datos suficientes' : palabraDe(n) })))),
    el('p', { clase: 'texto-2 texto-s', texto: 'Solo se colorea el monte apropiado. Las zonas prohibidas nunca llevan mancha.' }));
}

export function panelCapas({ fondo, activas, alCambiar }) {
  const fondos = el('fieldset', { clase: 'mapa-panel__grupo' }, el('legend', { texto: 'Fondo' }));
  for (const [id, f] of Object.entries(FONDOS)) {
    const input = el('input', { type: 'radio', name: 'mapa-fondo', value: id, checked: id === fondo });
    input.addEventListener('change', () => alCambiar({ fondo: id }));
    fondos.append(el('label', { clase: 'mapa-panel__opcion' }, input, el('span', { texto: f.nombre })));
  }
  const capas = el('fieldset', { clase: 'mapa-panel__grupo' }, el('legend', { texto: 'Capas' }));
  for (const [id, nombre] of Object.entries(SUPERPUESTAS)) {
    const input = el('input', { type: 'checkbox', value: id, checked: activas.includes(id) });
    input.addEventListener('change', () => alCambiar({ capa: id, activa: input.checked }));
    capas.append(el('label', { clase: 'mapa-panel__opcion' }, input, el('span', { texto: nombre })));
  }
  return el('div', { clase: 'mapa-panel', attrs: { role: 'dialog', 'aria-label': 'Capas del mapa' } }, fondos, capas, leyendaManchas());
}
```

- [ ] **Step 4: Añadir los iconos**

Copiar de Phosphor Icons, estilo *regular* (licencia MIT, la misma del sprite actual; https://phosphoricons.com, botón «SVG») los iconos `stack`, `crosshair` y `magnifying-glass`, y añadirlos a `img/iconos.svg` antes de `</svg>` con el mismo formato que los demás: `<symbol id="i-capas" viewBox="0 0 256 256"><path d="…"/></symbol>`, `<symbol id="i-ubicacion" …>` y `<symbol id="i-buscar" …>`, con el `d` exacto del SVG descargado. Añadir los tres ids a la lista de iconos de `docs/diseno.md` («Iconos»).

- [ ] **Step 5: Ejecutar la prueba y commit**

Run: `node --test tests/mapa-fondos.test.js`
Expected: PASS (4 pruebas).

```bash
git add js/mapa/fondos.js tests/mapa-fondos.test.js img/iconos.svg docs/diseno.md
git commit -m "$(cat <<'EOF'
Mapa: fondos CARTO Voyager, relieve IDEE, MTN y PNOA, capas superpuestas y panel de capas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 17: Hoja inferior de una celda y «Guardar en el diario»

**Files:**
- Create: `js/mapa/hoja.js`
- Modify: `js/diario.js` (añadir `urlNuevaSalida` y `leerNuevaSalida`)
- Modify: `js/pantallas/diario.js` (`pintar` lee el parámetro; `hojaNuevaSalida` acepta `inicial`)
- Test: `tests/mapa-hoja.test.js`, `tests/diario.test.js` (añadir al final)

**Interfaces:**
- Consumes: `el` (`js/ui/dom.js`); `semaforo`, `nivelDe`; `comun` (`js/ui/ficha.js`); `urlSegura` (`js/ui/normativa.js`); `ORIENTACIONES`, `TRAMOS_PENDIENTE` (tarea 4); `esOrientativo` (tarea 7); resultado de `notaCelda` (tarea 10).
- Produces (`js/diario.js`): `urlNuevaSalida({ lat, lon, zona }) → '#diario/nueva?lat=…&lon=…&zona=…'`; `leerNuevaSalida(param) → { lat, lon, zona }|null`.
- Produces (`js/mapa/hoja.js`): `NOMBRE_HABITAT`, `TEXTO_ORIENTACION`; `urlComoLlegar(lat, lon) → URL de ruta de Google Maps`; `textoCoto(props|null) → { texto, url }`; `modeloHoja({ prohibido, normas, celda, nota, ag, coto, zona }) → modelo|null` (`tipo`: `'prohibido'`, `'sinDatos'` o `'monte'`); `clasesHoja(modelo) → string`; `estadoTrasArrastre(estado, dy, umbral?) → 'cerrada'|'resumen'|'completa'`; `abrirHojaMapa({ modelo, desglose, grafico, alCerrar }) → { actualizar(modelo, { desglose, grafico }), cerrar() }`. `celda` = `{ habitat, altitud, orientacion, tramo, lat, lon }`; `ag` = agregados **ya corregidos** a la altitud de la celda.

- [ ] **Step 1: Escribir las pruebas**

```js
// tests/mapa-hoja.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlComoLlegar, textoCoto, modeloHoja, clasesHoja, estadoTrasArrastre, NOMBRE_HABITAT } from '../js/mapa/hoja.js';
import { HABITATS } from '../scripts/validar-datos.mjs';

const celda = { habitat: 'pinar-silvestre', altitud: 1560, orientacion: 1, tramo: 2, lat: 40.853, lon: -3.9943 };
const ag = { P26: 106.2, pct: 63.4, T20aire: 11.66 };
const boletus = { id: 'boletus-edulis', nombre: 'Boletus edulis', comunes: { es: ['hongo blanco'] } };
const niscalo = { id: 'lactarius-deliciosus', nombre: 'Lactarius deliciosus', comunes: { es: ['níscalo'] } };
const nota = { sinEspecies: false, valor: 92, especie: boletus, resultado: {}, otras: [{ especie: niscalo, valor: 70 }] };
const zona = { id: 'guadarrama' };

test('«Cómo llegar» abre la ruta de Google Maps hasta la celda', () => {
  assert.equal(urlComoLlegar(40.853, -3.9943), 'https://www.google.com/maps/dir/?api=1&destination=40.85300,-3.99430');
});

test('hoja de monte: bosque, altitud, orientación, pendiente, meteo, coto y tres botones', () => {
  const m = modeloHoja({ celda, nota, ag, zona, coto: { nombre: 'Valsaín', tipo: 'acotado', permisoUrl: 'https://x.es/permiso' } });
  assert.equal(m.tipo, 'monte');
  assert.equal(m.titulo, 'Pinar silvestre');
  assert.equal(m.valor, 92);
  assert.equal(m.nivel, 'muy-bueno');
  assert.deepEqual(m.especie, { id: 'boletus-edulis', nombre: 'hongo blanco', latin: 'Boletus edulis' });
  assert.deepEqual(m.filas.map((f) => [f.etiqueta, f.valor]), [
    ['Bosque', 'Pinar silvestre'], ['Altitud', '1560 m'], ['Orientación', 'Norte (umbría)'], ['Pendiente', 'del 15 al 30 %'],
    ['Lluvia en 26 días', '106 mm'], ['Humedad del suelo', 'percentil 63'], ['Temperatura', '11,7 °C de media en 20 días']]);   // número y unidad con espacio duro (docs/diseno.md)
  assert.deepEqual(m.coto, { texto: 'Valsaín: pide permiso.', url: 'https://x.es/permiso' });
  assert.deepEqual(m.acciones, { comoLlegar: urlComoLlegar(40.853, -3.9943), detalle: '#zona/guadarrama', diario: '#diario/nueva?lat=40.85300&lon=-3.99430&zona=guadarrama' });
  assert.deepEqual(m.otras, [{ nombre: 'níscalo', valor: 70 }]);
  assert.equal(clasesHoja(m), 'hoja hoja--mapa');
});

test('hoja sin datos suficientes: gris, sin nota inventada', () => {
  const m = modeloHoja({ celda, nota: { ...nota, valor: null, especie: null, otras: [] }, ag: null, zona });
  assert.equal(m.tipo, 'sinDatos');
  assert.equal(m.texto, 'Sin datos suficientes para este día.');
  assert.equal(m.valor, undefined);
});

test('zona prohibida: hoja roja con la norma y sin botón de ruta', () => {
  const normas = new Map([['pn-guadarrama-prug', { titulo: 'PRUG del Parque Nacional', url: 'https://boe.es/x' }]]);
  const m = modeloHoja({ prohibido: { nombre: 'Macizo de Peñalara', nota: 'Prohibida por el PRUG.', normas: ['pn-guadarrama-prug', 'otra'] }, normas, celda });
  assert.equal(m.tipo, 'prohibido');
  assert.equal(m.titulo, 'Macizo de Peñalara');
  assert.deepEqual(m.normas, [{ titulo: 'PRUG del Parque Nacional', url: 'https://boe.es/x' }, { titulo: 'otra', url: null }]);
  assert.equal(m.acciones, undefined);
  assert.equal(clasesHoja(m), 'hoja hoja--mapa hoja--prohibido');
});

test('textos de coto y nombres de todos los hábitats', () => {
  assert.equal(textoCoto(null).texto, 'Fuera de los cotos conocidos: comprueba la normativa de la zona.');
  assert.deepEqual(textoCoto({ nombre: 'Coto X', tipo: 'regulado' }), { texto: 'Coto X: recolección regulada, consulta la norma.', url: null });
  assert.equal(textoCoto({ nombre: 'P', tipo: 'parque-micologico', permisoUrl: 'javascript:alert(1)' }).url, null);
  for (const h of HABITATS) assert.ok(NOMBRE_HABITAT[h], h);
});

test('arrastre de la hoja', () => {
  assert.equal(estadoTrasArrastre('resumen', -80), 'completa');
  assert.equal(estadoTrasArrastre('resumen', 80), 'cerrada');
  assert.equal(estadoTrasArrastre('resumen', 20), 'resumen');
  assert.equal(estadoTrasArrastre('completa', 80), 'resumen');
  assert.equal(estadoTrasArrastre('completa', -80), 'completa');
});
```

Añadir al final de `tests/diario.test.js`:

```js
import { urlNuevaSalida, leerNuevaSalida } from '../js/diario.js';

test('«Guardar en el diario» desde el mapa: ida y vuelta del parámetro', () => {
  const u = urlNuevaSalida({ lat: 40.853, lon: -3.9943, zona: 'guadarrama' });
  assert.equal(u, '#diario/nueva?lat=40.85300&lon=-3.99430&zona=guadarrama');
  assert.deepEqual(leerNuevaSalida(decodeURIComponent(u.split('/')[1])), { lat: 40.853, lon: -3.9943, zona: 'guadarrama' });
  assert.deepEqual(leerNuevaSalida('nueva?zona=soria'), { lat: null, lon: null, zona: 'soria' });
  assert.equal(leerNuevaSalida('nueva?lat=abc&lon=1'), null);
  assert.equal(leerNuevaSalida('nueva?lat=95&lon=1'), null);
  assert.equal(leerNuevaSalida(undefined), null);
  assert.equal(leerNuevaSalida('otra'), null);
});
```

Run: `node --test tests/mapa-hoja.test.js tests/diario.test.js`
Expected: FAIL (`Cannot find module '../js/mapa/hoja.js'` y `does not provide an export named 'urlNuevaSalida'`).

- [ ] **Step 2: Añadir el parámetro del diario**

Al final de `js/diario.js`:

```js
// «Guardar en el diario» desde el mapa: #diario/nueva?lat=…&lon=…&zona=… abre la hoja «Nueva salida» rellena.
export const urlNuevaSalida = ({ lat, lon, zona }) => `#diario/nueva?${new URLSearchParams({
  ...(Number.isFinite(lat) && Number.isFinite(lon) ? { lat: lat.toFixed(5), lon: lon.toFixed(5) } : {}), ...(zona ? { zona } : {}) })}`;
export function leerNuevaSalida(param) {
  if (typeof param !== 'string' || !param.startsWith('nueva')) return null;
  const q = new URLSearchParams(param.slice(param.indexOf('?') + 1));
  const zona = q.get('zona') || null;
  if (!q.has('lat') && !q.has('lon')) return { lat: null, lon: null, zona };
  const lat = Number(q.get('lat')), lon = Number(q.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, zona };
}
```

(`leerNuevaSalida('nueva')` sin `?`: `param.indexOf('?')` es −1 y `slice(0)` da `'nueva'`, sin claves: devuelve `{ lat: null, lon: null, zona: null }`.)

En `js/pantallas/diario.js`:
1. Importar `leerNuevaSalida` en la línea de `from '../diario.js'`.
2. Cambiar la firma `function hojaNuevaSalida({ estado, alGuardar }) {` por `function hojaNuevaSalida({ estado, alGuardar, inicial = null }) {`.
3. Justo antes de `hoja.cuerpo.append(form);` (al final de `hojaNuevaSalida`), añadir:

```js
  if (inicial?.zona && datos.zonas.some((z) => z.id === inicial.zona)) zona.value = inicial.zona;
  if (inicial?.lat != null) ponerPunto(inicial.lat, inicial.lon); else pintarPunto();
```

4. Cambiar `export function pintar({ estado }) {` por `export function pintar({ estado, param }) {` y, justo antes de `refrescar();\n  return raiz;` al final, añadir:

```js
  const nueva = leerNuevaSalida(param);
  if (nueva) {
    history.replaceState(null, '', '#diario');   // al repintar no se vuelve a abrir
    requestAnimationFrame(() => hojaNuevaSalida({ estado, alGuardar, inicial: nueva }));
  }
```

- [ ] **Step 3: Escribir la hoja**

```js
// js/mapa/hoja.js
// Hoja inferior del mapa al tocar una mancha (spec §2): bosque, altitud, orientación, nota y especie, meteo, coto y
// tres botones; arrastrada hacia arriba, el desglose, las otras especies y la gráfica de lluvia. Zona prohibida: roja,
// con la norma y nunca mancha. No es modal (el mapa sigue usable): mueve el foco al título y lo devuelve al cerrar.
import { el } from '../ui/dom.js';
import { semaforo, nivelDe } from '../ui/semaforo.js';
import { comun } from '../ui/ficha.js';
import { urlSegura } from '../ui/normativa.js';
import { ORIENTACIONES, TRAMOS_PENDIENTE } from '../rejilla/formato.js';
import { esOrientativo } from '../rejilla/orientacion.js';
import { urlNuevaSalida } from '../diario.js';

const nbsp = ' ';
const r1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
export const NOMBRE_HABITAT = {
  'pinar-silvestre': 'Pinar silvestre', 'pinar-negral': 'Pinar negral', 'pinar-resinero': 'Pinar resinero', 'pinar-pinonero': 'Pinar piñonero',
  hayedo: 'Hayedo', melojar: 'Melojar (rebollar)', 'robledal-albar': 'Robledal', quejigar: 'Quejigar', castanar: 'Castañar', encinar: 'Encinar',
  alcornocal: 'Alcornocal', jaral: 'Jaral', sabinar: 'Sabinar', abedular: 'Abedular', chopera: 'Chopera', 'pastizal-montana': 'Pastizal de montaña', prado: 'Prado',
};
export const TEXTO_ORIENTACION = { llano: 'Llano', N: 'Norte (umbría)', NE: 'Noreste (umbría)', E: 'Este', SE: 'Sureste (solana)', S: 'Sur (solana)', SO: 'Suroeste (solana)', O: 'Oeste', NO: 'Noroeste (umbría)' };

export const urlComoLlegar = (lat, lon) => `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lon.toFixed(5)}`;

export function textoCoto(p) {
  if (!p) return { texto: 'Fuera de los cotos conocidos: comprueba la normativa de la zona.', url: null };
  if (p.tipo === 'acotado' || p.tipo === 'parque-micologico') return { texto: `${p.nombre}: pide permiso.`, url: urlSegura(p.permisoUrl) ? p.permisoUrl : null };
  return { texto: `${p.nombre}: recolección regulada, consulta la norma.`, url: null };
}

export function modeloHoja({ prohibido = null, normas = new Map(), celda = null, nota = null, ag = null, coto = null, zona = null }) {
  if (prohibido) {
    return { tipo: 'prohibido', titulo: prohibido.nombre ?? 'Zona prohibida', texto: prohibido.nota ?? 'Recogida de setas prohibida.',
      normas: (prohibido.normas ?? []).map((id) => { const n = normas.get(id); return { titulo: n?.titulo ?? id, url: urlSegura(n?.url) ? n.url : null }; }) };
  }
  if (!celda) return null;
  const filas = [
    { etiqueta: 'Bosque', valor: NOMBRE_HABITAT[celda.habitat] ?? celda.habitat },
    { etiqueta: 'Altitud', valor: `${celda.altitud}${nbsp}m` },
    { etiqueta: 'Orientación', valor: TEXTO_ORIENTACION[ORIENTACIONES[celda.orientacion]] ?? 'Llano' },
    { etiqueta: 'Pendiente', valor: TRAMOS_PENDIENTE[celda.tramo] ?? 'sin dato' },
  ];
  if (ag) {
    filas.push(
      { etiqueta: 'Lluvia en 26 días', valor: ag.P26 == null ? 'sin dato' : `${Math.round(ag.P26)}${nbsp}mm` },
      { etiqueta: 'Humedad del suelo', valor: ag.pct == null ? 'sin climatología' : `percentil ${Math.round(ag.pct)}` },
      { etiqueta: 'Temperatura', valor: ag.T20aire == null ? 'sin dato' : `${r1(ag.T20aire)}${nbsp}°C de media en 20 días` });
  }
  const base = { titulo: NOMBRE_HABITAT[celda.habitat] ?? 'Monte', filas, coto: textoCoto(coto), orientativo: esOrientativo(celda.orientacion),
    acciones: { comoLlegar: urlComoLlegar(celda.lat, celda.lon), detalle: zona ? `#zona/${encodeURIComponent(zona.id)}` : null, diario: urlNuevaSalida({ lat: celda.lat, lon: celda.lon, zona: zona?.id ?? null }) } };
  if (!nota || nota.valor == null) return { tipo: 'sinDatos', ...base, texto: 'Sin datos suficientes para este día.' };
  return { tipo: 'monte', ...base, valor: nota.valor, nivel: nivelDe(nota.valor),
    especie: { id: nota.especie.id, nombre: comun(nota.especie), latin: nota.especie.nombre },
    otras: nota.otras.map((o) => ({ nombre: comun(o.especie), valor: o.valor })) };
}

export const clasesHoja = (m) => `hoja hoja--mapa${m?.tipo === 'prohibido' ? ' hoja--prohibido' : ''}`;

export function estadoTrasArrastre(estado, dy, umbral = 60) {
  if (estado === 'resumen') return dy < -umbral ? 'completa' : dy > umbral ? 'cerrada' : 'resumen';
  if (estado === 'completa') return dy > umbral ? 'resumen' : 'completa';
  return estado;
}

const enlace = (href, texto, clase) => el('a', { clase, href, rel: 'noopener', target: '_blank', texto });
function contenido(m, extra) {
  if (m.tipo === 'prohibido') {
    return [el('div', { clase: 'aviso-peligro' }, el('p', {}, el('strong', { texto: 'Recogida de setas prohibida. ' }), m.texto)),
      m.normas.length ? el('ul', { clase: 'mapa-popup__normas' }, m.normas.map((n) => el('li', {}, n.url ? enlace(n.url, n.titulo) : n.titulo))) : null];
  }
  const nodos = [m.tipo === 'monte'
    ? el('div', { clase: 'hoja__nota', attrs: { 'data-nivel': m.nivel } }, el('span', { clase: 'indice indice--grande tabular', texto: String(m.valor) }), semaforo(m.valor),
      el('p', {}, 'Por ', el('span', { clase: 'latin', texto: m.especie.latin }), ` (${m.especie.nombre})`))
    : el('p', { clase: 'texto-2', texto: m.texto })];
  if (m.orientativo) nodos.push(el('p', { clase: 'texto-s' }, el('span', { clase: 'etiqueta etiqueta--ocre', texto: 'Orientativo' }), ' La orientación ajusta la humedad sin calibración local.'));
  nodos.push(el('dl', { clase: 'hoja__filas' }, m.filas.flatMap((f) => [el('dt', { texto: f.etiqueta }), el('dd', { texto: f.valor })])),
    el('p', { clase: 'texto-s' }, m.coto.url ? enlace(m.coto.url, m.coto.texto) : m.coto.texto),
    el('div', { clase: 'hoja__acciones' }, enlace(m.acciones.comoLlegar, 'Cómo llegar', 'boton'),
      m.acciones.detalle ? el('a', { clase: 'boton boton--suave', href: m.acciones.detalle, texto: 'Ver detalle' }) : null,
      el('a', { clase: 'boton boton--suave', href: m.acciones.diario, texto: 'Guardar en el diario' })));
  if (extra.desglose) nodos.push(extra.desglose());
  if (extra.completa && m.otras?.length) nodos.push(el('h3', { texto: 'Otras especies posibles' }), el('ul', {}, m.otras.map((o) => el('li', { texto: `${o.nombre}: ${o.valor}/100` }))));
  if (extra.grafico) nodos.push(extra.grafico());
  return nodos;
}

export function abrirHojaMapa({ modelo, desglose = null, grafico = null, alCerrar = () => {} }) {
  const previo = document.activeElement;
  const titulo = el('h2', { id: 'hoja-mapa-titulo', attrs: { tabindex: '-1' } });
  const asa = el('button', { type: 'button', clase: 'hoja__asa', attrs: { 'aria-expanded': 'false', 'aria-label': 'Ver más' } });
  const cerrar = el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Cerrar' });
  const cuerpo = el('div', { clase: 'hoja__cuerpo' });
  const hoja = el('section', { attrs: { role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'hoja-mapa-titulo' } },
    asa, el('div', { clase: 'hoja__cabeza' }, titulo, cerrar), cuerpo);
  let estado = 'resumen', extra = { desglose, grafico }, arrastrado = false, y0 = null;
  const pintar = () => {
    hoja.className = clasesHoja(modelo);
    hoja.dataset.estado = estado;
    titulo.textContent = modelo.titulo;
    asa.setAttribute('aria-expanded', String(estado === 'completa'));
    asa.setAttribute('aria-label', estado === 'completa' ? 'Ver menos' : 'Ver más');
    const completa = estado === 'completa';
    cuerpo.replaceChildren(...contenido(modelo, completa ? { ...extra, completa } : {}).filter(Boolean));
  };
  const poner = (e) => { if (e === 'cerrada') { api.cerrar(); return; } estado = e; pintar(); };
  asa.addEventListener('click', () => { if (arrastrado) { arrastrado = false; return; } poner(estado === 'completa' ? 'resumen' : 'completa'); });
  asa.addEventListener('pointerdown', (e) => { y0 = e.clientY; asa.setPointerCapture?.(e.pointerId); });
  asa.addEventListener('pointerup', (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0; y0 = null;
    if (Math.abs(dy) > 10) { arrastrado = true; poner(estadoTrasArrastre(estado, dy)); }
  });
  cerrar.addEventListener('click', () => api.cerrar());
  const tecla = (e) => { if (e.key === 'Escape') api.cerrar(); };
  document.addEventListener('keydown', tecla);
  const api = {
    actualizar(m, x = {}) { modelo = m; extra = { desglose: x.desglose ?? null, grafico: x.grafico ?? null }; estado = 'resumen'; pintar(); titulo.focus({ preventScroll: true }); },
    cerrar() {
      if (!hoja.isConnected) return;
      document.removeEventListener('keydown', tecla);
      hoja.remove();
      if (previo?.isConnected) previo.focus({ preventScroll: true });
      alCerrar();
    },
  };
  pintar();
  document.body.append(hoja);
  requestAnimationFrame(() => { hoja.dataset.abierta = 'true'; titulo.focus({ preventScroll: true }); });
  return api;
}
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `node --test tests/mapa-hoja.test.js tests/diario.test.js`
Expected: PASS (6 pruebas nuevas en `mapa-hoja` y la nueva de `diario`, más las de siempre).

- [ ] **Step 5: Probar «Guardar en el diario» en el navegador**

Run: `npx --yes http-server -p 8080 -c-1 .` y abrir `http://localhost:8080/#diario/nueva?lat=40.85300&lon=-3.99430&zona=guadarrama`.
Expected: se abre «Nueva salida» con la zona Guadarrama elegida y «Punto marcado: 40.8530, -3.9943»; la barra de direcciones queda en `#diario`; al cerrar la hoja y repintar no vuelve a abrirse.

- [ ] **Step 6: Commit**

```bash
git add js/mapa/hoja.js js/diario.js js/pantallas/diario.js tests/mapa-hoja.test.js tests/diario.test.js
git commit -m "$(cat <<'EOF'
Mapa: hoja inferior de una celda (nota, meteo, coto, Cómo llegar, prohibido en rojo) y alta en el diario desde el mapa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 18: Buscador, chips de temporada y barra de días (y la lista de pueblos)

Chips: «Mejor hoy» (sin filtro: la mejor comestible de cada bosque) y las comestibles en temporada ese día. Las que la spec nombra por grupo van juntas (Boletus: los cuatro boletos; Níscalos: las dos *Lactarius*; Rebozuelos; Perretxiko; Colmenillas); las demás, un chip por especie con su nombre común. Un chip que deja de estar en temporada al cambiar de día vuelve a «Mejor hoy».

**Files:**
- Create: `js/mapa/controles.js`
- Create: `scripts/rejilla/pueblos.mjs`
- Create (generado): `data/pueblos.json`
- Modify: `scripts/validar-datos.mjs` (comprobación de `data/pueblos.json`)
- Test: `tests/mapa-controles.test.js`

**Interfaces:**
- Consumes: `enTemporada`, `pesoPrevision` (tarea 1); `entreDias` (tarea 2); `buscarEspecies` (`js/pantallas/especies.js`); `comun` (`js/ui/ficha.js`); `el`, `icono`, `mayus` (`js/ui/dom.js`); `CONFIG.pueblos`.
- Produces: `GRUPOS`; `chipsDelDia(especies, fecha) → [{ id, texto, especies: string[]|null }]` (primero `{ id: 'mejor', texto: 'Mejor hoy', especies: null }`); `chipVigente(id, chips) → id`; `barraDias(fechas, hoy, seleccion) → [{ fecha, texto, menosFiable, pulsado }]`; `buscarEnMapa(texto, { pueblos, sitios, especies, chips }) → [{ tipo: 'chip', id, texto, sub } | { tipo: 'pueblo'|'sitio', texto, sub, lat, lon, zoom }]` (8 como mucho); `crearBuscador({ buscar, alElegir }) → { nodo, input }`; `cargarPueblos(fetchFn?) → Promise<pueblo[]>`. En `pueblos.mjs`: `leerCsv(texto) → fila[]`, `filtrarPueblos(filas, zonas, columnas, margen?) → [{ n, p, lat, lon }]`.

- [ ] **Step 1: Escribir la prueba**

```js
// tests/mapa-controles.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chipsDelDia, chipVigente, barraDias, buscarEnMapa } from '../js/mapa/controles.js';
import { diasDisponibles } from '../js/rejilla/carga.js';
import { leerCsv, filtrarPueblos } from '../scripts/rejilla/pueblos.mjs';

const especies = JSON.parse(readFileSync('data/especies.json', 'utf8')).especies;
const diez = (desde) => Array.from({ length: 10 }, (_, k) => new Date(Date.parse(`${desde}T00:00:00Z`) + k * 864e5).toISOString().slice(0, 10));

test('chips del 1 de octubre: Mejor hoy, Boletus, Níscalos y Rebozuelos; sin Perretxiko ni Colmenillas', () => {
  const chips = chipsDelDia(especies, '2026-10-01');
  assert.deepEqual(chips[0], { id: 'mejor', texto: 'Mejor hoy', especies: null });
  const ids = chips.map((c) => c.id);
  for (const id of ['boletus', 'niscalos', 'rebozuelos']) assert.ok(ids.includes(id), id);
  for (const id of ['perretxiko', 'colmenillas']) assert.ok(!ids.includes(id), id);
  assert.deepEqual(chips.find((c) => c.id === 'boletus').especies.sort(), ['boletus-aereus', 'boletus-edulis', 'boletus-pinophilus', 'boletus-reticulatus']);
  assert.ok(!ids.includes('lactarius-deliciosus'), 'las agrupadas no repiten chip propio');
  assert.ok(chips.slice(1).every((c) => c.especies.length > 0));
});

test('chips del 15 de abril: Perretxiko y Colmenillas sí; Níscalos no', () => {
  const ids = chipsDelDia(especies, '2026-04-15').map((c) => c.id);
  assert.ok(ids.includes('perretxiko') && ids.includes('colmenillas'));
  assert.ok(!ids.includes('niscalos'));
});

test('un chip que deja de estar en temporada vuelve a «Mejor hoy»', () => {
  assert.equal(chipVigente('perretxiko', chipsDelDia(especies, '2026-10-01')), 'mejor');
  assert.equal(chipVigente('boletus', chipsDelDia(especies, '2026-10-01')), 'boletus');
});

test('barra de días: Hoy, Mañana, día de la semana; «menos fiable» desde el cuarto día', () => {
  const b = barraDias(diez('2026-10-01'), '2026-10-01', '2026-10-03');
  assert.deepEqual(b.slice(0, 5).map((d) => d.texto), ['Hoy', 'Mañana', 'Sáb 3', 'Dom 4', 'Lun 5']);
  assert.deepEqual(b.map((d) => d.menosFiable), [false, false, false, false, true, true, true, true, true, true]);
  assert.deepEqual(b.map((d) => d.pulsado).indexOf(true), 2);
});

test('con un índice de ayer, el primer día de la barra es hoy y se llama «Hoy»', () => {
  const dias = diasDisponibles({ fechas: diez('2026-09-30') }, '2026-10-01');
  const b = barraDias(dias, '2026-10-01', '2026-10-01');
  assert.equal(b[0].fecha, '2026-10-01');
  assert.equal(b[0].texto, 'Hoy');
  assert.equal(b.length, 9);
});

test('buscador: especies (que eligen su chip), sitios y pueblos, sin tildes', () => {
  const chips = chipsDelDia(especies, '2026-10-01');
  const pueblos = [{ n: 'Rascafría', p: 'Madrid', lat: 40.905, lon: -3.88 }, { n: 'Espinosa de los Monteros', p: 'Burgos', lat: 43.077, lon: -3.554 }];
  const sitios = [{ id: 's1', nombre: 'Pinar de la Acebeda', municipio: 'Rascafría (Madrid)', zona: 'guadarrama' },
    { id: 's2', nombre: 'Alto el Caballo', municipio: 'Espinosa de los Monteros (Burgos)', zona: 'merindades', lat: 43.127, lon: -3.536 }];
  const r = (t) => buscarEnMapa(t, { pueblos, sitios, especies, chips });
  assert.deepEqual(r('niscalo')[0], { tipo: 'chip', id: 'niscalos', texto: 'níscalo', sub: 'Níscalos' });
  assert.equal(r('rascafria').find((x) => x.tipo === 'pueblo').lat, 40.905);
  const acebeda = r('acebeda')[0];
  assert.deepEqual([acebeda.tipo, acebeda.lat, acebeda.zoom], ['sitio', 40.905, 13]);   // sin coordenadas: las de su pueblo
  assert.equal(r('caballo')[0].lat, 43.127);
  assert.deepEqual(r('x'), []);
  assert.ok(r('a').length <= 8);
});

test('pueblos: CSV con ; y comas decimales, filtrado por los bbox de las zonas y sin repetidos', () => {
  const csv = '﻿NOMBRE;PROVINCIA;LATITUD;LONGITUD\nRascafría;Madrid;40,9050;-3,8800\nRascafría;Madrid;40,9050;-3,8800\n"Lejos, del todo";Cádiz;36,5;-6,2\n';
  const filas = leerCsv(csv);
  assert.equal(filas.length, 3);
  assert.equal(filas[2].NOMBRE, 'Lejos, del todo');
  const zonas = [{ bbox: [-4.25, 40.65, -3.7701, 41.05] }];
  assert.deepEqual(filtrarPueblos(filas, zonas, { nombre: 'NOMBRE', provincia: 'PROVINCIA', lat: 'LATITUD', lon: 'LONGITUD' }), [{ n: 'Rascafría', p: 'Madrid', lat: 40.905, lon: -3.88 }]);
});
```

Run: `node --test tests/mapa-controles.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Escribir los controles**

```js
// js/mapa/controles.js
// Controles del mapa a pantalla completa: chips de especie en temporada, barra de días y buscador de pueblos,
// sitios y especies (spec §2). Lo que decide es puro (se prueba con Node); crearBuscador monta el DOM.
import { el, icono, mayus } from '../ui/dom.js';
import { comun } from '../ui/ficha.js';
import { enTemporada, pesoPrevision } from '../indice.js';
import { entreDias } from '../meteo.js';
import { buscarEspecies } from '../pantallas/especies.js';

export const GRUPOS = [
  { id: 'boletus', texto: 'Boletus', especies: ['boletus-edulis', 'boletus-pinophilus', 'boletus-aereus', 'boletus-reticulatus'] },
  { id: 'niscalos', texto: 'Níscalos', especies: ['lactarius-deliciosus', 'lactarius-sanguifluus'] },
  { id: 'rebozuelos', texto: 'Rebozuelos', especies: ['cantharellus-cibarius'] },
  { id: 'perretxiko', texto: 'Perretxiko', especies: ['calocybe-gambosa'] },
  { id: 'colmenillas', texto: 'Colmenillas', especies: ['morchella'] },
];
const AGRUPADAS = new Set(GRUPOS.flatMap((g) => g.especies));

export function chipsDelDia(especies, fecha) {
  const comestibles = especies.filter((e) => e.categoria === 'comestible' && e.indice);
  const en = new Set(comestibles.filter((e) => enTemporada(fecha, e)).map((e) => e.id));
  const chips = [{ id: 'mejor', texto: 'Mejor hoy', especies: null }];
  for (const g of GRUPOS) { const ids = g.especies.filter((id) => en.has(id)); if (ids.length) chips.push({ id: g.id, texto: g.texto, especies: ids }); }
  const sueltas = comestibles.filter((e) => en.has(e.id) && !AGRUPADAS.has(e.id)).map((e) => ({ id: e.id, texto: mayus(comun(e)), especies: [e.id] }))
    .sort((a, b) => a.texto.localeCompare(b.texto, 'es'));
  return [...chips, ...sueltas];
}
export const chipVigente = (id, chips) => (chips.some((c) => c.id === id) ? id : 'mejor');

const DIA = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
export function barraDias(fechas, hoy, seleccion) {
  return fechas.map((fecha) => {
    const d = entreDias(hoy, fecha);
    return { fecha, texto: d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : mayus(DIA.format(new Date(`${fecha}T12:00:00Z`))),
      menosFiable: pesoPrevision(d) < 0.8, pulsado: fecha === seleccion };
  });
}

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const nombrePueblo = (municipio) => { const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(municipio ?? ''); return m ? { n: m[1], p: m[2] } : { n: municipio ?? '', p: '' }; };

export function buscarEnMapa(texto, { pueblos = [], sitios = [], especies = [], chips = [] }) {
  const q = normalizar(texto).trim();
  if (q.length < 2) return [];
  const r = [], ya = new Set();
  const poner = (x, clave) => { if (!ya.has(clave)) { ya.add(clave); r.push(x); } };
  for (const e of buscarEspecies(texto, especies.filter((x) => x.categoria === 'comestible' && x.indice))) {
    const ch = chips.find((c) => c.especies?.includes(e.id));
    if (ch) poner({ tipo: 'chip', id: ch.id, texto: comun(e), sub: ch.texto }, `chip:${ch.id}`);
  }
  const deMunicipio = (m) => { const { n, p } = nombrePueblo(m); return pueblos.find((x) => normalizar(x.n) === normalizar(n) && (!p || normalizar(p).includes(normalizar(x.p)) || normalizar(x.p).includes(normalizar(p)))); };
  for (const s of sitios) {
    if (!normalizar(s.nombre).includes(q) && !normalizar(s.municipio).includes(q)) continue;
    const donde = typeof s.lat === 'number' ? s : deMunicipio(s.municipio);
    if (donde) poner({ tipo: 'sitio', texto: s.nombre, sub: s.municipio ?? '', lat: donde.lat, lon: donde.lon, zoom: typeof s.lat === 'number' ? 15 : 13 }, `sitio:${s.id}`);
  }
  for (const p of pueblos) {
    const n = normalizar(p.n);
    if (n.startsWith(q) || n.includes(` ${q}`)) poner({ tipo: 'pueblo', texto: p.n, sub: p.p, lat: p.lat, lon: p.lon, zoom: 13 }, `pueblo:${p.n}|${p.p}`);
  }
  return r.slice(0, 8);
}

export async function cargarPueblos(fetchFn = globalThis.fetch?.bind(globalThis)) {
  const r = await fetchFn('data/pueblos.json');
  if (!r.ok) throw new Error(`No se pudo cargar data/pueblos.json (${r.status})`);
  return (await r.json()).pueblos ?? [];
}

// Combobox accesible: flechas para moverse, Intro para elegir, Escape para cerrar la lista.
export function crearBuscador({ buscar, alElegir }) {
  const id = 'mapa-buscar-lista';
  const input = el('input', { type: 'search', placeholder: 'Pueblo, sitio o especie', attrs: { role: 'combobox', 'aria-expanded': 'false', 'aria-controls': id,
    'aria-autocomplete': 'list', 'aria-label': 'Buscar pueblo, sitio o especie', autocomplete: 'off', enterkeyhint: 'search' } });
  const lista = el('ul', { id, clase: 'mapa-buscador__lista', hidden: true, attrs: { role: 'listbox', 'aria-label': 'Resultados' } });
  let resultados = [], activo = -1;
  const pintar = () => {
    lista.replaceChildren(...resultados.map((r, k) => {
      const li = el('li', { id: `${id}-${k}`, attrs: { role: 'option', 'aria-selected': String(k === activo) } }, el('span', { texto: r.texto }), r.sub ? el('span', { clase: 'texto-2 texto-s', texto: ` · ${r.sub}` }) : null);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); elegir(k); });
      return li;
    }));
    lista.hidden = !resultados.length;
    input.setAttribute('aria-expanded', String(resultados.length > 0));
    if (activo >= 0) input.setAttribute('aria-activedescendant', `${id}-${activo}`); else input.removeAttribute('aria-activedescendant');
  };
  const elegir = (k) => { const r = resultados[k]; if (!r) return; input.value = r.texto; resultados = []; activo = -1; pintar(); alElegir(r); };
  input.addEventListener('input', () => { resultados = buscar(input.value); activo = -1; pintar(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && resultados.length) { e.preventDefault(); activo = (activo + 1) % resultados.length; pintar(); }
    else if (e.key === 'ArrowUp' && resultados.length) { e.preventDefault(); activo = (activo - 1 + resultados.length) % resultados.length; pintar(); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(activo >= 0 ? activo : 0); }
    else if (e.key === 'Escape') { resultados = []; activo = -1; pintar(); }
  });
  input.addEventListener('blur', () => { resultados = []; activo = -1; pintar(); });
  return { nodo: el('div', { clase: 'mapa-buscador', attrs: { role: 'search' } }, icono('i-buscar'), input, lista), input };
}
```

- [ ] **Step 3: Escribir el generador de pueblos**

```js
// scripts/rejilla/pueblos.mjs
// Genera data/pueblos.json (nombre, provincia y coordenadas de los núcleos de población dentro de los bbox de las
// zonas, con 0,05° de margen) para el buscador del mapa. Fuente y columnas: CONFIG.pueblos (tarea 0).
// Uso: node scripts/rejilla/pueblos.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './config.mjs';

export function leerCsv(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const cuenta = (c) => (lineas[0].match(new RegExp(`\\${c}`, 'g')) ?? []).length;
  const sep = cuenta(';') >= cuenta(',') ? ';' : ',';
  const partir = (l) => {
    const r = []; let actual = '', comillas = false;
    for (let k = 0; k < l.length; k++) {
      const ch = l[k];
      if (ch === '"') { if (comillas && l[k + 1] === '"') { actual += '"'; k++; } else comillas = !comillas; }
      else if (ch === sep && !comillas) { r.push(actual.trim()); actual = ''; }
      else actual += ch;
    }
    r.push(actual.trim());
    return r;
  };
  const cab = partir(lineas[0]);
  return lineas.slice(1).map((l) => Object.fromEntries(partir(l).map((v, k) => [cab[k], v])));
}

const numero = (v) => Number(String(v ?? '').replace(',', '.'));
export function filtrarPueblos(filas, zonas, columnas, margen = 0.05) {
  const dentro = (lon, lat) => zonas.some(({ bbox: [o, s, e, n] }) => lon >= o - margen && lon <= e + margen && lat >= s - margen && lat <= n + margen);
  const vistos = new Set(), r = [];
  for (const f of filas) {
    const n = f[columnas.nombre]?.trim(), p = f[columnas.provincia]?.trim() ?? '', lat = numero(f[columnas.lat]), lon = numero(f[columnas.lon]);
    if (!n || !Number.isFinite(lat) || !Number.isFinite(lon) || !dentro(lon, lat)) continue;
    const clave = `${n}|${p}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    r.push({ n, p, lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 });
  }
  return r.sort((a, b) => a.n.localeCompare(b.n, 'es'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bruto = readFileSync(CONFIG.pueblos.archivo);
  let texto = new TextDecoder('utf-8').decode(bruto);
  if (texto.includes('�')) texto = new TextDecoder('latin1').decode(bruto);   // los CSV del CNIG pueden venir en Latin-1
  const zonas = JSON.parse(readFileSync('data/zonas.json', 'utf8')).zonas;
  const pueblos = filtrarPueblos(leerCsv(texto), zonas, CONFIG.pueblos.columnas);
  const { nombre, url, licencia, fecha } = CONFIG.pueblos;
  writeFileSync('data/pueblos.json', `${JSON.stringify({ version: 1, fuente: { nombre, url, licencia, fecha }, pueblos })}\n`);
  console.log(`${pueblos.length} pueblos en data/pueblos.json`);
}
```

- [ ] **Step 4: Validar `data/pueblos.json`**

En `scripts/validar-datos.mjs`, añadir:

```js
export function validarPueblos(d) {
  const e = [];
  if (d?.version !== 1 || !URL_OK.test(d.fuente?.url ?? '') || !FECHA.test(d.fuente?.fecha ?? '') || !d.fuente?.licencia) e.push('pueblos: sin versión 1 o sin fuente con url, fecha y licencia');
  for (const p of d?.pueblos ?? []) if (!p.n || typeof p.lat !== 'number' || typeof p.lon !== 'number') { e.push(`pueblos: «${p.n}» sin nombre o coordenadas`); break; }
  return e;
}
```

y en el bloque final, junto a la llamada de `validarRejillas`:

```js
  if (existsSync('data/pueblos.json')) errores.push(...validarPueblos(leer('data/pueblos.json')));
```

- [ ] **Step 5: Ejecutar la prueba y generar los pueblos**

Run: `node --test tests/mapa-controles.test.js && node scripts/rejilla/pueblos.mjs && npm run comprobar`
Expected: PASS (7 pruebas), `N pueblos en data/pueblos.json` (unos cientos a pocos miles) y `✓ Datos válidos`. Comprobar a mano que salen Rascafría, Covaleda y Espinosa de los Monteros: `node -e "const p=require('./data/pueblos.json').pueblos;for(const n of ['Rascafría','Covaleda','Espinosa de los Monteros'])console.log(n, p.some(x=>x.n===n))"`.

- [ ] **Step 6: Commit**

```bash
git add js/mapa/controles.js scripts/rejilla/pueblos.mjs data/pueblos.json scripts/validar-datos.mjs tests/mapa-controles.test.js
git commit -m "$(cat <<'EOF'
Mapa: buscador de pueblos, sitios y especies, chips de temporada y barra de días

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 19: Pantalla completa: ensamblaje, retrocesos, estilos, créditos y verificación

**Files:**
- Modify: `js/pantallas/mapa.js` (se reescribe entero)
- Modify: `js/mapa.js` (exportar `popupCoto` y `cargarCotos`; nada más cambia)
- Modify: `css/componentes.css` (sección «Mapa a pantalla completa»)
- Modify: `js/pantallas/ajustes.js` (`bloqueCreditos`)
- Modify: `README.md`, `docs/diseno.md`
- Test: `tests/mapa.test.js` (añadir al final)

**Interfaces:**
- Consumes: todas las tareas 3 a 18; `cargarLeaflet`, `notaPunto`, `NIVEL_COLOR`, `COLOR`, `estiloCoto`, `estiloHalo`, `pintarSalidas`, `radioLluvia` de `js/mapa.js`; `desglose` (`js/ui/desglose.js`); `graficoLluvia` (`js/ui/grafico-lluvia.js`); `especiesDeZona`, `nombreCorto` (`js/datos.js`).
- Produces: `pintar({ estado, param })` de `js/pantallas/mapa.js` (mismo contrato que las demás pantallas: devuelve un nodo). Ruta `#mapa` y `#mapa/<zona>` (encuadra la zona).

- [ ] **Step 1: Exportar lo que el mapa nuevo reutiliza de `js/mapa.js`**

En `js/mapa.js`, cambiar `const cargarCotos = () =>` por `export const cargarCotos = () =>` y `function popupCoto(p, normas) {` por `export function popupCoto(p, normas) {`. Añadir al final de `tests/mapa.test.js`:

```js
import { cargarCotos, popupCoto } from '../js/mapa.js';
test('el mapa nuevo reutiliza la carga de cotos y su ficha', () => {
  assert.equal(typeof cargarCotos, 'function');
  assert.equal(typeof popupCoto, 'function');
});
```

Run: `node --test tests/mapa.test.js`
Expected: PASS.

- [ ] **Step 2: Reescribir la pantalla**

```js
// js/pantallas/mapa.js
// Pantalla «Mapa» (docs/superpowers/specs/2026-10-01-mapa-indice-design.md): pantalla completa al estilo de Google
// Maps. Manchas solo sobre monte apropiado con la nota por ladera (rejilla fina + índice precalculado en Supabase).
// Sin índice o sin red, los puntos de siempre con la nota de zona y un aviso (§3.4). Hoy, Zona y las fichas no cambian.
import { el, icono } from '../ui/dom.js';
import { cargarLeaflet, cargarCotos, notaPunto, NIVEL_COLOR, COLOR, estiloCoto, estiloHalo, pintarSalidas, radioLluvia } from '../mapa.js';
import { nivelDe } from '../ui/semaforo.js';
import { especiesDeZona, nombreCorto } from '../datos.js';
import { hoyMadrid } from '../meteo.js';
import { pesoPrevision } from '../indice.js';
import { aMercator, celdaFina, limitesGruesa, puntoEnGeometria, bboxDe } from '../rejilla/geo.js';
import { PROHIBIDO, CODIGO } from '../rejilla/formato.js';
import { cargarIndice, avisoIndice, diasDisponibles, cargarDatosRejilla, archivosVisibles, archivoDeCelda, crearCargadorRejillas } from '../rejilla/carga.js';
import { gruesasDeArchivo, colorear, notaGruesa, colorDeNota } from '../rejilla/pintor.js';
import { calcularNotas } from '../rejilla/notas-async.js';
import { notaCelda, corregirAltitud } from '../rejilla/nota.js';
import { agregadosDeCelda, serieLluvia } from '../rejilla/salida.js';
import { crearCapaRejilla } from '../mapa/capa-rejilla.js';
import { crearFondo, leerPreferencias, guardarPreferencias, panelCapas, SUPERPUESTAS } from '../mapa/fondos.js';
import { modeloHoja, abrirHojaMapa, urlComoLlegar } from '../mapa/hoja.js';
import { chipsDelDia, chipVigente, barraDias, buscarEnMapa, crearBuscador, cargarPueblos } from '../mapa/controles.js';
import { desglose } from '../ui/desglose.js';
import { graficoLluvia } from '../ui/grafico-lluvia.js';

const ZOOM_FINO = 9;                 // desde aquí, rejilla de 250 m; más lejos, celdas gruesas
const MAX_IMAGENES = 12;             // imágenes coloreadas que se guardan (día × chip × archivo)
const POPUP = { minWidth: 200, maxWidth: 250 };
const ui = { fecha: null, chip: 'mejor', vista: null };   // se conserva al salir y volver
let montaje = null;

window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#mapa')) return;
  document.body.classList.remove('en-mapa');
  const m = montaje;
  montaje = null;
  m?.then((v) => v.destruir()).catch(() => {});
});

export async function pintar({ estado, param }) {
  document.body.classList.add('en-mapa');
  montaje ??= montar(estado).catch((e) => { montaje = null; document.body.classList.remove('en-mapa'); throw e; });
  const v = await montaje;
  v.actualizar(estado, param);
  return v.raiz;
}

function medirBarras(raiz) {
  const cab = document.querySelector('.cabecera'), nav = document.querySelector('.barra-nav');
  raiz.style.setProperty('--alto-cabecera', `${cab?.offsetHeight ?? 64}px`);
  raiz.style.setProperty('--alto-nav', `${(nav?.offsetHeight ?? 100) + 12}px`);
  raiz.style.setProperty('--alto-abajo', `${raiz.querySelector('.mapa-completo__abajo')?.offsetHeight ?? 56}px`);   // avisos + días: los controles de Leaflet van encima
}

async function montar(estadoInicial) {
  let estado = estadoInicial;
  const datos = estado.datos;
  const normas = new Map((datos.normativa ?? []).map((n) => [n.id, n]));
  const L = await cargarLeaflet();
  const prefs = leerPreferencias();

  // ---------- DOM ----------
  const lienzo = el('div', { clase: 'mapa-completo__lienzo', attrs: { role: 'region', 'aria-label': 'Mapa con las manchas donde es más probable encontrar setas' } });
  const anuncio = el('p', { clase: 'solo-lector', attrs: { 'aria-live': 'polite' } });
  const avisos = el('div', { clase: 'mapa-completo__avisos' });
  const chips = el('div', { clase: 'chips mapa-completo__chips', attrs: { role: 'group', 'aria-label': 'Especie' } });
  const dias = el('div', { clase: 'chips mapa-completo__dias', attrs: { role: 'group', 'aria-label': 'Día' } });
  const panel = el('div', { id: 'mapa-panel-capas', clase: 'mapa-completo__panel', hidden: true });
  const botonCapas = el('button', { type: 'button', clase: 'boton boton--suave boton--icono mapa-completo__boton', attrs: { 'aria-label': 'Capas', 'aria-expanded': 'false', 'aria-controls': 'mapa-panel-capas' } }, icono('i-capas'));
  const botonYo = el('button', { type: 'button', clase: 'boton boton--suave boton--icono mapa-completo__boton', attrs: { 'aria-label': 'Mi ubicación' } }, icono('i-ubicacion'));
  const buscador = crearBuscador({ buscar: (t) => buscarEnMapa(t, fuentesBusqueda()), alElegir: elegirResultado });
  const raiz = el('div', { clase: 'mapa-completo' }, lienzo,
    el('div', { clase: 'mapa-completo__arriba' }, buscador.nodo, chips),
    el('div', { clase: 'mapa-completo__botones' }, botonCapas, botonYo), panel,
    el('div', { clase: 'mapa-completo__abajo' }, avisos, dias), anuncio);
  medirBarras(raiz);

  // ---------- Mapa ----------
  const mapa = L.map(lienzo, { zoomControl: false, minZoom: 6, maxZoom: 18 });
  mapa.setView([40.4, -3.7], 6);
  L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(mapa);
  for (const [nombre, z] of [['rejilla', 350], ['lluvia', 420], ['puntos', 450]]) mapa.createPane(nombre).style.zIndex = z;
  let fondo = crearFondo(L, prefs.fondo).addTo(mapa);
  const capas = Object.fromEntries(Object.keys(SUPERPUESTAS).map((k) => [k, L.layerGroup()]));
  const puntos = L.layerGroup().addTo(mapa);
  const limitesZona = (z) => [[z.bbox[1], z.bbox[0]], [z.bbox[3], z.bbox[2]]];
  const todas = L.latLngBounds(datos.zonas.map(limitesZona).flat());
  const medido = () => lienzo.clientWidth > 0 && lienzo.clientHeight > 0;
  let encuadre = ui.vista ? null : () => mapa.fitBounds(todas, { padding: [20, 20], animate: false });
  if (ui.vista) mapa.setView([ui.vista.lat, ui.vista.lon], ui.vista.zoom);
  const encuadrar = (f) => { if (medido()) { encuadre = null; f(); } else encuadre = f; };
  const medida = new ResizeObserver(() => { medirBarras(raiz); mapa.invalidateSize(); if (encuadre && medido()) { const f = encuadre; encuadre = null; f(); } });
  medida.observe(lienzo);

  // ---------- Datos ----------
  const cargador = crearCargadorRejillas();
  const [rej, ind] = await Promise.all([cargarDatosRejilla().catch(() => null), cargarIndice()]);
  const salida = rej ? ind.salida : null;
  const CapaRejilla = crearCapaRejilla(L);
  const capaRejilla = salida ? new CapaRejilla().addTo(mapa) : null;
  const capaGruesa = L.layerGroup().addTo(mapa);
  const imagenes = new Map(), gruesasPorArchivo = new Map();
  let turno = 0, enfocada = null, hoja = null, pueblos = [], cotos = null, error = null;
  cargarPueblos().then((p) => { pueblos = p; }).catch(() => {});

  const especiesPorZona = () => { const m = new Map(); for (const z of datos.zonas) m.set(z.id, especiesDeZona(z, datos.especies, estado.umbrales ?? {})); return m; };
  let especiesZona = especiesPorZona();
  const hoy = () => hoyMadrid();
  const fechas = () => (salida ? diasDisponibles(salida, hoy()) : [hoy()]);
  const listaChips = () => chipsDelDia(datos.especies, ui.fecha);
  const filtro = () => { const c = listaChips().find((x) => x.id === ui.chip); return c?.especies ? new Set(c.especies) : null; };

  // ---------- Controles ----------
  const chip = (texto, pulsado, alPulsar, nota = null) => {
    const b = el('button', { type: 'button', clase: 'chip', attrs: { 'aria-pressed': String(pulsado) } }, texto, nota ? el('span', { clase: 'chip__nota', texto: ` · ${nota}` }) : null);
    b.addEventListener('click', alPulsar);
    return b;
  };
  function pintarControles() {
    const fs = fechas();
    if (!fs.includes(ui.fecha)) ui.fecha = fs[0];
    const lista = listaChips();
    ui.chip = chipVigente(ui.chip, lista);
    chips.replaceChildren(...lista.map((c) => chip(c.texto, c.id === ui.chip, () => { ui.chip = c.id; cambio(); })));
    dias.replaceChildren(...(salida ? barraDias(fs, hoy(), ui.fecha) : []).map((d) => chip(d.texto, d.pulsado, () => { ui.fecha = d.fecha; cambio(); }, d.menosFiable ? 'menos fiable' : null)));
    dias.hidden = !salida;
  }
  function pintarAvisos() {
    const lista = [];
    if (!salida) lista.push(['i-aviso', 'No hay mapa por laderas ahora mismo: se ven los puntos de cada zona con su nota.']);
    const viejo = salida && avisoIndice(salida);
    if (viejo) lista.push(['i-info', viejo]);
    const d = fechas().indexOf(ui.fecha);
    if (salida && d > 0 && pesoPrevision(d) < 0.8) lista.push(['i-info', `Previsión a ${d} días: menos fiable.`]);
    if (salida && mapa.getZoom() < ZOOM_FINO) lista.push(['i-info', 'Acércate para ver cada ladera.']);
    if (error) lista.push(['i-aviso', error]);
    avisos.replaceChildren(...lista.map(([i, t]) => el('div', { clase: 'aviso', attrs: { role: 'note' } }, icono(i), el('p', { texto: t }))));
    medirBarras(raiz);
  }
  const avisar = (t) => { error = t; pintarAvisos(); };
  function cambio() {
    error = null;
    pintarControles(); pintarAvisos(); repintar();
    if (mapa.hasLayer(capas.lluvia)) pintarLluvia();
    const c = listaChips().find((x) => x.id === ui.chip), d = barraDias(fechas(), hoy(), ui.fecha).find((x) => x.pulsado);
    anuncio.textContent = `Mapa: ${c?.texto ?? 'Mejor hoy'}, ${d?.texto ?? 'hoy'}.`;
  }

  // ---------- Pintado ----------
  async function repintar() {
    const mia = ++turno;
    if (!salida) { pintarPuntos(); return; }
    capaGruesa.clearLayers();
    if (mapa.getZoom() < ZOOM_FINO) { capaRejilla.quitarTodo(); pintarGruesas(); return; }
    const b = mapa.getBounds(), f = filtro();
    for (const a of archivosVisibles(rej.indice, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])) {
      const clave = `${a.archivo}|${ui.fecha}|${ui.chip}`;
      let rgba = imagenes.get(clave);
      let r;
      try { r = await cargador.cargar(a.archivo); } catch (e) { avisar(e.message); continue; }
      if (mia !== turno) return;
      if (!rgba) {
        if (!gruesasPorArchivo.has(a.archivo)) gruesasPorArchivo.set(a.archivo, gruesasDeArchivo(r, rej.gruesa));
        const notas = await calcularNotas({ rejilla: r, gruesas: gruesasPorArchivo.get(a.archivo), gruesa: rej.gruesa, salida, fecha: ui.fecha, especies: especiesZona.get(r.cabecera.zona) ?? [], filtro: f });
        if (mia !== turno) return;
        rgba = colorear(notas);
        imagenes.set(clave, rgba);
        if (imagenes.size > MAX_IMAGENES) imagenes.delete(imagenes.keys().next().value);
      }
      capaRejilla.ponerImagen(a.archivo, r.cabecera, rgba);
    }
  }
  function pintarGruesas() {
    const f = filtro();
    for (const g of rej.gruesa.celdas) {
      const color = colorDeNota(notaGruesa(g, { salida, fecha: ui.fecha, especies: especiesZona.get(g.zona) ?? [], filtro: f }));
      if (!color) continue;
      const [o, s, e, n] = limitesGruesa(g.id, rej.gruesa.pasos[g.zona]);
      L.rectangle([[s, o], [n, e]], { pane: 'rejilla', stroke: false, fillColor: color, fillOpacity: 0.45, interactive: false }).addTo(capaGruesa);
    }
  }
  function pintarPuntos() {
    puntos.clearLayers();
    for (const z of datos.zonas) for (const p of z.puntos) {
      const nota = notaPunto(z, p, datos, estado.meteo, estado.umbrales ?? {});
      L.circleMarker([p.lat, p.lon], { pane: 'puntos', radius: 9, weight: 2.5, fillOpacity: 1, color: COLOR.halo, fillColor: NIVEL_COLOR[nivelDe(nota.valor)] })
        .bindPopup(() => el('div', { clase: 'mapa-popup' }, el('h3', { texto: p.nombre }), el('p', { clase: 'texto-2 texto-s', texto: nombreCorto(z) }),
          el('p', { texto: nota.valor == null ? 'Sin nota' : `Nota de hoy: ${nota.valor}/100` }),
          el('p', { clase: 'mapa-popup__acciones' }, el('a', { clase: 'boton boton--compacto', href: `#zona/${encodeURIComponent(z.id)}`, texto: `Ver ${nombreCorto(z)}` }))), POPUP)
        .addTo(puntos);
    }
  }

  // ---------- Capas superpuestas ----------
  const rellenas = new Set();
  async function rellenar(id) {
    if (id === 'lluvia') { pintarLluvia(); return; }
    if (rellenas.has(id)) return;
    rellenas.add(id);
    try {
      if (id === 'cotos' || id === 'prohibido') {
        const g = await cargarCotos();
        const col = { type: 'FeatureCollection', features: g.features.filter((f) => (f.properties.tipo === 'prohibido') === (id === 'prohibido')) };
        capas[id].addLayer(L.geoJSON(col, { style: (f) => estiloHalo(f.properties), interactive: false }));
        capas[id].addLayer(L.geoJSON(col, { style: (f) => estiloCoto(f.properties), onEachFeature: (f, c) => c.bindTooltip(el('span', { texto: f.properties.nombre }), { sticky: true }) }));
      } else if (id === 'sitios') pintarSitios();
      else if (id === 'diario') {
        const [{ supabase }, { listarSalidas }] = await Promise.all([import('../supabase.js'), import('../diario.js')]);
        pintarSalidas(capas.diario, await listarSalidas({ supabase }), datos);
      }
    } catch (e) {
      rellenas.delete(id);
      avisar(id === 'diario' ? 'No se han podido cargar las salidas del diario.' : e.message);
    }
  }
  function pintarLluvia() {
    capas.lluvia.clearLayers();
    if (salida) {
      for (const g of rej.gruesa.celdas) {
        const ag = agregadosDeCelda(salida, g.id, ui.fecha);
        if (ag?.P26 == null) continue;
        const [o, s, e, n] = limitesGruesa(g.id, rej.gruesa.pasos[g.zona]);
        L.rectangle([[s, o], [n, e]], { pane: 'lluvia', stroke: false, fillColor: COLOR.lluvia, fillOpacity: Math.min(0.45, ag.P26 / 200), interactive: false })
          .bindTooltip(`${Math.round(ag.P26)} mm en 26 días`).addTo(capas.lluvia);
      }
      return;
    }
    for (const z of datos.zonas) for (const p of z.puntos) {
      const nota = notaPunto(z, p, datos, estado.meteo, estado.umbrales ?? {});
      if (nota.mm != null) L.circleMarker([p.lat, p.lon], { pane: 'lluvia', radius: radioLluvia(nota.mm), weight: 2, color: COLOR.lluvia, fillColor: COLOR.lluvia, fillOpacity: 0.22, interactive: false }).addTo(capas.lluvia);
    }
  }
  function pintarSitios() {
    for (const s of datos.sitios ?? []) {
      if (typeof s.lat !== 'number' || typeof s.lon !== 'number') continue;
      const icon = L.divIcon({ className: '', html: '<span class="marcador-sitio"></span>', iconSize: [28, 28], iconAnchor: [14, 26], popupAnchor: [0, -24] });
      L.marker([s.lat, s.lon], { icon, title: s.nombre, keyboard: true })
        .bindPopup(() => el('div', { clase: 'mapa-popup' }, el('h3', { texto: s.nombre }), el('p', { clase: 'texto-2 texto-s', texto: s.municipio ?? '' }),
          el('p', { clase: 'mapa-popup__acciones' }, el('a', { clase: 'boton boton--compacto', href: urlComoLlegar(s.lat, s.lon), rel: 'noopener', target: '_blank', texto: 'Cómo llegar' }),
            el('a', { clase: 'boton boton--suave boton--compacto', href: `#zona/${encodeURIComponent(s.zona)}`, texto: 'Ver zona' }))), POPUP)
        .addTo(capas.sitios);
    }
  }
  async function activar(id, si) { if (!si) { mapa.removeLayer(capas[id]); return; } capas[id].addTo(mapa); await rellenar(id); }
  function alCambiar(c) {
    if (c.fondo) { mapa.removeLayer(fondo); fondo = crearFondo(L, c.fondo).addTo(mapa); prefs.fondo = c.fondo; }
    if (c.capa) { prefs.activas = c.activa ? [...new Set([...prefs.activas, c.capa])] : prefs.activas.filter((x) => x !== c.capa); activar(c.capa, c.activa); }
    guardarPreferencias(prefs);
  }
  function alternarPanel(abrir = panel.hidden) {
    panel.hidden = !abrir;
    botonCapas.setAttribute('aria-expanded', String(abrir));
    if (abrir) { panel.replaceChildren(panelCapas({ fondo: prefs.fondo, activas: prefs.activas, alCambiar })); panel.querySelector('input')?.focus(); }
    else botonCapas.focus();
  }
  botonCapas.addEventListener('click', () => alternarPanel());
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') alternarPanel(false); });
  for (const id of prefs.activas) activar(id, true);

  // ---------- Toque en el mapa: hoja inferior ----------
  async function poligonoEn(lon, lat, cumple) {
    cotos ??= cargarCotos().then((g) => g.features.map((f) => ({ f, b: bboxDe(f.geometry) }))).catch((e) => { cotos = null; throw e; });
    for (const { f, b: [o, s, e, n] } of await cotos) if (lon >= o && lon <= e && lat >= s && lat <= n && cumple(f.properties) && puntoEnGeometria(lon, lat, f.geometry)) return f;
    return null;
  }
  const cerrarHoja = () => hoja?.cerrar();
  function abrir(modelo, extra = {}) {
    if (!modelo) { cerrarHoja(); return; }
    if (hoja) hoja.actualizar(modelo, extra);
    else hoja = abrirHojaMapa({ modelo, ...extra, alCerrar: () => { hoja = null; } });
  }
  const grafico = (celdaSalida) => () => { const fig = el('figure', { clase: 'grafico' }); fig.innerHTML = graficoLluvia({ serie: serieLluvia(celdaSalida), altura: 220 }); return fig; };
  async function tocar(latlng) {
    const lon = latlng.lng, lat = latlng.lat;
    const prohibido = await poligonoEn(lon, lat, (p) => p.tipo === 'prohibido');
    if (prohibido) { abrir(modeloHoja({ prohibido: prohibido.properties, normas })); return; }
    if (!salida || mapa.getZoom() < ZOOM_FINO) { cerrarHoja(); return; }
    const m = aMercator(lon, lat), c = celdaFina(m.x, m.y), a = archivoDeCelda(rej.indice, c.col, c.fila);
    if (!a) { cerrarHoja(); return; }
    const r = await cargador.cargar(a.archivo);
    const k = (c.fila - a.fila0) * a.ancho + (c.col - a.col0), h = r.habitat[k];
    if (h & PROHIBIDO) { abrir(modeloHoja({ prohibido: { nombre: 'Zona prohibida' }, normas })); return; }
    if (!(h & CODIGO)) { cerrarHoja(); return; }
    if (!gruesasPorArchivo.has(a.archivo)) gruesasPorArchivo.set(a.archivo, gruesasDeArchivo(r, rej.gruesa));
    const g = rej.gruesa.celdas[gruesasPorArchivo.get(a.archivo)[k]] ?? null;
    const celda = { habitat: r.cabecera.habitats[(h & CODIGO) - 1], altitud: r.altitud[k], orientacion: r.terreno[k] & 0x0f, tramo: r.terreno[k] >> 4, lat, lon };
    const ag = g ? agregadosDeCelda(salida, g.id, ui.fecha) : null;
    const altRef = salida.celdas[g?.id]?.altRef ?? celda.altitud;
    const zona = datos.zonas.find((z) => z.id === r.cabecera.zona);
    const nota = notaCelda({ ag, ...celda, altRef, especies: especiesZona.get(zona.id) ?? [], fecha: ui.fecha, filtro: filtro() });
    if (nota.sinEspecies) { cerrarHoja(); return; }
    const coto = await poligonoEn(lon, lat, (p) => p.tipo !== 'prohibido');
    abrir(modeloHoja({ celda, nota, ag: ag && corregirAltitud(ag, celda.altitud - altRef), coto: coto?.properties ?? null, zona }),
      { desglose: nota.resultado ? () => desglose(nota.resultado) : null, grafico: g && salida.celdas[g.id] ? grafico(salida.celdas[g.id]) : null });
  }
  mapa.on('click', (e) => { tocar(e.latlng).catch((err) => avisar(err.message)); });

  // ---------- Buscador y ubicación ----------
  function fuentesBusqueda() { return { pueblos, sitios: datos.sitios ?? [], especies: datos.especies, chips: listaChips() }; }
  function elegirResultado(r) {
    if (r.tipo === 'chip') { ui.chip = r.id; cambio(); return; }
    mapa.setView([r.lat, r.lon], r.zoom);
  }
  let yo = null;
  botonYo.addEventListener('click', () => {
    if (!navigator.geolocation) { avisar('Este dispositivo no da la ubicación.'); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      const ll = [p.coords.latitude, p.coords.longitude];
      yo?.remove();
      yo = L.circleMarker(ll, { pane: 'puntos', radius: 8, weight: 3, color: COLOR.halo, fillColor: COLOR.lluvia, fillOpacity: 1, interactive: false }).addTo(mapa);
      mapa.setView(ll, Math.max(mapa.getZoom(), 13));
    }, () => avisar('No se pudo obtener la ubicación (¿permiso denegado?).'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
  mapa.on('moveend', () => {
    if (encuadre || !medido()) return;
    const c = mapa.getCenter();
    ui.vista = { lat: c.lat, lon: c.lng, zoom: mapa.getZoom() };
    pintarAvisos();
    repintar();
  });
  if (encuadre) encuadrar(encuadre);

  return {
    raiz,
    actualizar(nuevo, param) {
      if (nuevo.umbrales !== estado.umbrales) { imagenes.clear(); estado = nuevo; especiesZona = especiesPorZona(); } else estado = nuevo;
      if (param && param !== enfocada) {
        const z = datos.zonas.find((x) => x.id === param);
        if (z) { enfocada = param; encuadrar(() => mapa.fitBounds(limitesZona(z), { padding: [20, 20], animate: false })); }
      }
      cambio();
    },
    destruir() {
      medida.disconnect();
      cerrarHoja();
      mapa._animatingZoom = false;   // Leaflet 1.9: remove() en mitad de una animación de zoom deja un temporizador que falla
      mapa.remove();
    },
  };
}
```

- [ ] **Step 3: Estilos**

Añadir al final de `css/componentes.css` (los colores de los marcadores son fijos porque van sobre teselas claras, como `.marcador-salida`):

```css
/* ---------- Mapa a pantalla completa (spec 2026-10-01-mapa-indice) ---------- */
.en-mapa .pie { display: none; }
.en-mapa .pantalla { padding-bottom: 0; }
.mapa-completo { position: fixed; inset: 0; z-index: 0; background: var(--c-superficie-2); }
.mapa-completo__lienzo { position: absolute; inset: 0; width: 100%; height: 100%; font-family: var(--fuente-texto); }   /* Leaflet le pone position: relative en línea: el alto sale de height */
.mapa-completo__lienzo .leaflet-pane > svg { max-width: none !important; max-height: none !important; }
.mapa-completo .leaflet-bottom { bottom: calc(var(--alto-nav, 112px) + var(--alto-abajo, 56px) + var(--esp-2)); }
.mapa-completo .leaflet-bar a { width: 44px; height: 44px; line-height: 44px; font-size: 22px; background: var(--c-superficie); color: var(--c-texto); }
.mapa-completo .leaflet-control-attribution { background: color-mix(in srgb, var(--c-superficie) 88%, transparent); color: var(--c-texto-2); font-size: 11px; border-radius: var(--r-s); }
.capa-multiply { mix-blend-mode: multiply; }
.capa-rejilla { position: absolute; top: 0; left: 0; pointer-events: none; }
.mapa-completo__arriba, .mapa-completo__abajo { position: absolute; left: var(--esp-4); right: var(--esp-4); z-index: 1000; display: grid; gap: var(--esp-2); max-width: 560px; margin-inline: auto; }
.mapa-completo__arriba { top: calc(var(--alto-cabecera, 64px) + var(--esp-2)); }
.mapa-completo__abajo { bottom: calc(var(--alto-nav, 112px) + var(--esp-2)); }
.mapa-completo__chips, .mapa-completo__dias { margin-inline: 0; padding-inline: 0; }
.mapa-completo__chips .chip, .mapa-completo__dias .chip { box-shadow: inset 0 0 0 1.5px var(--chip-borde), var(--tarjeta-sombra); }
.mapa-completo__chips .chip[aria-pressed="true"], .mapa-completo__dias .chip[aria-pressed="true"] { box-shadow: var(--tarjeta-sombra); }
.chip__nota { font-weight: 400; font-size: var(--t-xs); color: var(--c-ocre-texto); }
.chip[aria-pressed="true"] .chip__nota { color: inherit; }
.mapa-completo__avisos:empty { display: none; }
.mapa-completo__botones { position: absolute; right: var(--esp-4); top: calc(var(--alto-cabecera, 64px) + 124px); z-index: 1000; display: grid; gap: var(--esp-2); }
.mapa-completo__boton { background: var(--c-superficie); box-shadow: var(--tarjeta-sombra); }
.mapa-completo__panel { position: absolute; right: calc(var(--esp-4) + 56px); top: calc(var(--alto-cabecera, 64px) + 124px); z-index: 1001;
  width: min(300px, calc(100vw - 104px)); max-height: 60dvh; overflow-y: auto; padding: var(--esp-4); border-radius: var(--r-m);
  background: var(--c-superficie); color: var(--c-texto); box-shadow: var(--tarjeta-sombra); }
.mapa-panel { display: grid; gap: var(--esp-3); }
.mapa-panel__grupo { border: 0; margin: 0; padding: 0; display: grid; gap: 2px; }
.mapa-panel__grupo legend { font-weight: 700; margin-bottom: var(--esp-1); }
.mapa-panel__opcion { display: flex; align-items: center; gap: var(--esp-2); min-height: 44px; }
.mapa-buscador { position: relative; }
.mapa-buscador > .icono { position: absolute; left: 14px; top: 14px; color: var(--c-texto-3); pointer-events: none; }
.mapa-buscador input { width: 100%; min-height: 48px; padding: 0 var(--esp-4) 0 44px; border: 1px solid var(--c-borde-fuerte); border-radius: var(--r-pildora);
  background: var(--c-superficie); color: var(--c-texto); box-shadow: var(--tarjeta-sombra); font: inherit; }
.mapa-buscador__lista { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 1002; margin: 0; padding: var(--esp-1) 0; list-style: none;
  max-height: 50dvh; overflow-y: auto; border-radius: var(--r-m); background: var(--c-superficie); box-shadow: var(--tarjeta-sombra); }
.mapa-buscador__lista [role="option"] { display: flex; align-items: center; min-height: 44px; padding: 0 var(--esp-4); cursor: pointer; }
.mapa-buscador__lista [aria-selected="true"] { background: var(--c-acento-suave); }
.hoja--mapa { max-height: 42dvh; transition: max-height var(--dur-media) var(--curva), transform var(--dur-media) var(--curva), visibility 0s linear var(--dur-media); }
.hoja--mapa[data-estado="completa"] { max-height: 88dvh; }
.hoja--mapa::before { display: none; }
.hoja__asa { display: block; width: 100%; min-height: 44px; margin: calc(var(--esp-3) * -1) 0 var(--esp-2); border: 0; background: none; cursor: grab; touch-action: none; }
.hoja__asa::before { content: ""; display: block; width: 44px; height: 5px; margin: 0 auto; border-radius: 3px; background: var(--c-borde-fuerte); }
.hoja--prohibido { border-top: 6px solid var(--c-peligro); }
.hoja--prohibido h2 { color: var(--c-peligro-fuerte); }
.hoja__nota { display: flex; flex-wrap: wrap; align-items: center; gap: var(--esp-3); }
.hoja__filas { display: grid; grid-template-columns: auto 1fr; gap: var(--esp-1) var(--esp-3); margin: 0; }
.hoja__filas dt { color: var(--c-texto-2); }
.hoja__filas dd { margin: 0; }
.hoja__acciones { display: flex; flex-wrap: wrap; gap: var(--esp-2); }
.marcador-sitio { display: block; width: 22px; height: 22px; margin: 3px; transform: rotate(-45deg); border-radius: 50% 50% 50% 0;
  background: #1f4a33; border: 3px solid #ffffff; box-shadow: 0 1px 4px rgb(0 0 0 / 0.5); }
@media (prefers-reduced-motion: reduce) { .hoja--mapa { transition: none; } }
```

- [ ] **Step 4: Créditos en Ajustes**

En `js/pantallas/ajustes.js`, dentro de `bloqueCreditos`, sustituir la línea de OpenStreetMap por estas (los textos exactos de licencia y atribución del MDT y de los pueblos son los de `CONFIG.mdt.atribucion` y `CONFIG.pueblos.licencia`, tarea 0, apartado D6):

```js
    li(enlace('OpenStreetMap', 'https://www.openstreetmap.org/copyright'), ': © colaboradores de OpenStreetMap, ODbL.'),
    li(enlace('CARTO', 'https://carto.com/attributions'), ': mapa base Voyager, © OpenStreetMap © CARTO.'),   // solo si CARTO_URL no es null (tarea 16)
    li(enlace('IDEE', 'https://www.idee.es/'), ': relieve sombreado del modelo digital del terreno (© Instituto Geográfico Nacional, CC BY 4.0).'),
    li(enlace('MITECO', 'https://www.miteco.gob.es/'), ': Mapa Forestal de España 1:50.000, base de los bosques del mapa por laderas.'),
```

y añadir dos líneas más con el MDT y la fuente de pueblos, copiando nombre, URL y texto de atribución de `CONFIG.mdt` y `CONFIG.pueblos` con el mismo formato `li(enlace(nombre, url), ': texto.')`.

- [ ] **Step 5: Documentación**

- `README.md`: cambiar la viñeta **Mapa** por: «**Mapa:** a pantalla completa, con manchas de color solo sobre el monte apropiado según la nota por ladera (bosque, altitud y orientación cada 250 m) de hoy y de los próximos días; buscador, chips de especie, capas (mapa, relieve, topográfico, satélite, cotos, prohibido, lluvia, sitios y diario) y hoja con «Cómo llegar».» En «Arquitectura», añadir `js/rejilla/`, `js/mapa/`, `data/rejilla/` y la Edge Function `rejilla`.
- `docs/diseno.md`: sección «Mapa a pantalla completa» con las clases nuevas (`.mapa-completo`, `.mapa-buscador`, `.mapa-panel`, `.hoja--mapa`, `.hoja--prohibido`, `.marcador-sitio`), la regla de que las manchas usan `NIVEL_COLOR` con alfa 150/255 y el gris de «sin datos» con alfa 110/255, y los textos de los avisos.

- [ ] **Step 6: Pruebas y contraste**

Run: `npm run comprobar && node scripts/contraste.mjs`
Expected: PASS, `✓ Datos válidos` y 0 fallos de contraste (no se han tocado tokens; si el script avisa, corregir antes de seguir).

- [ ] **Step 7: Verificación en el navegador (390 × 844, claro y oscuro)**

Run: `npx --yes http-server -p 8080 -c-1 .` y, con Playwright (herramientas `browser_*`), abrir `http://localhost:8080/#mapa` a 390 × 844. Comprobar y hacer captura de cada punto en `capturas/mapa-indice-*.png`:
1. Arriba el buscador y los chips («Mejor hoy» pulsado); abajo la barra de días con «Hoy» pulsado y «menos fiable» desde el cuarto día; a la derecha Capas y Mi ubicación con sus iconos; la atribución del fondo visible («© OpenStreetMap © CARTO» con CARTO, la del IGN con la Base IGN) y **ninguna tesela con «API KEY REQUIRED»**; los controles de zoom y la atribución no quedan tapados por los avisos ni por la barra de días.
2. Con zoom 8: celdas gruesas y el aviso «Acércate para ver cada ladera.». Con zoom 12 sobre Valsaín: manchas solo sobre el pinar (nada en prados, embalses ni pueblos).
3. Tocar una mancha: hoja con bosque, altitud, orientación, nota y especie, lluvia, humedad, temperatura, coto y los tres botones; «Cómo llegar» abre `https://www.google.com/maps/dir/?api=1&destination=…`; arrastrar el asa hacia arriba muestra el desglose, otras especies y la gráfica; Escape la cierra y el foco vuelve al mapa.
4. Tocar dentro de Peñalara (Zona de Uso Restringido A): hoja roja con la norma y sin mancha debajo.
5. Elegir «Níscalos»: cambian las manchas; buscar «covaleda»: centra en el pueblo; buscar «boletus»: elige su chip.
6. Capas: los cuatro fondos (Relieve se ve sombreado en multiply) y las cinco capas; la elección se recuerda al volver al mapa.
7. Retroceso: con la red de `*.supabase.co/storage/**` bloqueada (`browser_run_code_unsafe` con `page.route(..., r => r.abort())`), recargar: puntos de siempre con su nota y el aviso «No hay mapa por laderas ahora mismo…».
8. Índice antiguo: con un `ultimo.json` servido por `page.route` que apunte a un sello de ayer a las 19, el aviso «Datos de ayer a las 19:00…».
9. Hoy, Zona (Soria) y una ficha se ven igual que antes; ningún error propio en la consola.
10. Teclado: Tab llega al buscador, a los chips, a los días, a Capas y a Mi ubicación con el foco visible; en el buscador, flechas e Intro eligen un resultado.

- [ ] **Step 8: Commit**

```bash
git add js/pantallas/mapa.js js/mapa.js tests/mapa.test.js css/componentes.css js/pantallas/ajustes.js README.md docs/diseno.md capturas/mapa-indice-*.png
git commit -m "$(cat <<'EOF'
Mapa nuevo a pantalla completa: manchas por ladera, buscador, chips, días, capas, hoja y retrocesos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

## Autorrevisión (hecha al escribir el plan)

**Cobertura de la spec:**
- §2 pantalla completa, buscador, chips «Mejor hoy» + temporada, capas (4 fondos y 5 superpuestas), Mi ubicación, barra de días con «menos fiable», manchas solo sobre monte apropiado, hoja (bosque, altitud, orientación, nota, especie, lluvia, humedad, temperatura, coto, tres botones; desglose, otras especies y gráfica al subirla), prohibido en rojo, sitios con coordenadas como chinchetas y el resto por pueblo, Hoy/Zona/fichas sin cambios: tareas 16, 17, 18 y 19.
- §3.1 rejilla de 250 m en EPSG:3857, hábitat/altitud/orientación/pendiente, MFE50 con tabla en `docs/datos.md`, MDT con elección por sondeo, prohibidos con marca, `generar.mjs`, tamaño < 300 KB: tareas 0, 3 a 6 y 8.
- §3.2 rejilla gruesa ~0,09° con altitud de referencia, Edge Function con pg_cron/pg_net a las 07 y 19, `meteo_celdas`, solo `past_days=2` con histórico, relleno desde el 1 de agosto troceado, presupuesto de 1.000, salida `indice/<sello>.json` + `ultimo.json` en bucket público, mismo `js/indice.js` en Deno, umbrales aplicados como en la app, regla del 90 %: tareas 1, 2, 9, 11, 12 y 13.
- §3.3 caché 3 h, rejillas visibles, corrección −0,65 °C/100 m, fT con esa temperatura, ajuste orientativo de humedad, misma `calcularIndice`/`nivelDe`, solo especies del hábitat y en temporada, canvas, Worker si > 200 ms: tareas 7, 10, 14 y 15.
- §3.4 aviso de otro día o de la ejecución anterior, retroceso a puntos sin archivo o sin red, gris en celdas sin datos: tareas 14, 15 y 19.
- §4 equivalencia (tarea 10), sin color en prohibidos ni con hábitat 0 (tareas 8 y 15), altitud y orientación con números exactos (tareas 6, 7 y 10), ida y vuelta del binario (tarea 4), presupuesto, 90 % y solo lo nuevo (tareas 11 y 12), «Cómo llegar», chips por temporada y hoja roja (tareas 17 y 18), validador de cabecera y tamaño (tarea 4).
- §6 sondeo de fuentes, 429 con reintento y archivo anterior, límites de Supabase medidos, orientación orientativa y conservadora, despliegue con token y autorización: tareas 0, 7, 11, 12 y 13.

**Desviaciones conscientes de la spec (para la revisión de la usuaria):**
- **Fondo claro:** CARTO Voyager exige ya una clave (comprobado el 01/10/2026: 200 con una imagen «API KEY REQUIRED»). La usuaria decide en la tarea 0 entre CARTO con clave y la Base IGN; mientras, el código usa la Base IGN (tarea 16).
- El archivo publicado lleva los **agregados** de cada día (iguales para todas las especies) y no los factores por especie: mismo resultado con la misma fórmula, unas 30 veces menos datos y los umbrales editados se ven al momento (tarea 9).
- **Celdas gruesas:** con 0,09° los bbox de las 11 zonas suman 1.190 celdas (Extremadura, 648), no ~200. Solo cuentan las que tienen monte, y la tarea 8 sube el paso (0,12 / 0,15 / 0,18°) hasta quedarse en 350 o menos, para no pasar del presupuesto.
- **Climatología del suelo** por ventanas de 4 meses en 2 años, renovada poco a poco (tarea 11); mientras una celda no la tiene, su nota va sin `fS`, como la app sin climatología.
- **Vista lejana** (zoom < 9): celdas gruesas en vez de la rejilla fina (no se descargan 3 MB para pintar píxeles de menos de un punto).

**Revisión de nombres:** `agregadosDia`, `indiceDesdeAgregados`, `resumirCelda`, `agregadosDeCelda`, `notaCelda`, `notasDeArchivo`, `gruesasDeArchivo`, `colorear`, `modeloHoja`, `chipsDelDia`, `barraDias`, `cargarIndice`, `avisoIndice`, `diasDisponibles`, `archivoDeCelda` y `ejecutar` se usan con la misma firma en todas las tareas.


# Lluvia medida en pluviómetros de montaña Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la lluvia ya caída que entra en la nota (P26, P3, tanda, lluvia desde el 1 de agosto) salga de pluviómetros de montaña cercanos, con control de calidad, y que donde no haya estación válida se use el modelo corregido por su sesgo reciente, diciendo siempre de dónde sale.

**Architecture:** Una Edge Function nueva `pluvio` (Supabase), lanzada por pg_cron cada hora en el minuto 10, lee con cortesía SAIH Tajo, AEMET horario, SAIH Duero y SAIH Júcar (Euskalmet entra por un relleno local desde su zip anual) solo para una lista blanca de estaciones, guarda las horas en `lluvia_obs`, agrega por día de Madrid en `lluvia_dia` con control de calidad y publica dos veces al día en el bucket público `indice` dos archivos pequeños: `pluvio/ultimo.json` (por punto de zona) y `pluvio/celdas.json` (por celda gruesa). La mezcla por distancia y altitud y el sesgo del modelo viven en `supabase/functions/_shared/pluvio.js`, que usan a la vez la función `rejilla` (series de las celdas gruesas del mapa) y el navegador (Hoy y Zona). Si falta el archivo, todo funciona exactamente como hoy.

**Tech Stack:** HTML, CSS y JS sin framework (módulos ES, sin paso de compilación, GitHub Pages), Node 24 (`node --test tests/*.test.js`), Supabase (Edge Functions en Deno, Postgres, Storage, pg_cron, pg_net, Vault), fuentes: SAIH Tajo, SAIH Duero, SAIH Júcar, Euskalmet (Open Data Euskadi), AEMET OpenData.

**Spec:** `docs/superpowers/specs/2026-10-01-pluviometros-design.md` (es la autoridad; este plan argumenta desde ella). Informe de fuentes con peticiones reales: `docs/investigacion/09-pluviometros.md`.

## Global Constraints

- Vanilla JS con módulos ES y sin paso de compilación; GitHub Pages publica `main` tal cual. Ninguna dependencia nueva, ni en el navegador ni en `package.json`.
- Pruebas: Node 24, `node --test tests/*.test.js`, **sin red**: toda respuesta de una fuente sale de `tests/fixtures/pluvio/` (respuestas reales capturadas el 02/10/2026). Gancho pre-push: `npm run comprobar`.
- Función `pluvio` separada de `aemet` y `rejilla`; la lanza pg_cron **cada hora (minuto 10)** con la misma protección que `rejilla`: cabecera `x-pluvio-clave`, secreto `PLUVIO_CLAVE`, copia en Vault `pluvio_clave`, desplegada con `--no-verify-jwt`.
- **Plazo global < 150 s**: la ejecución entera acaba antes de 140 s (`PLAZO_EJECUCION`); las lecturas paran con 25 s de reserva.
- Cortesía: agente identificado (`setas-app/1.0 (+https://gonzalotsainz-ux.github.io/setas/)`), **una lectura por estación y hora como mucho** (una petición; dos encadenadas solo cuando la URL o el token guardados ya no valen, y en la lectura diaria de 10 días de Tajo, que necesita la ficha y su gráfico), 400 ms entre peticiones al mismo servidor, **un reintento con espera** (3 s) si hay 429, 5xx o fallo de red.
- SAIH Tajo publica «PRECIPITACIÓN ÚLTIMA HORA» cada 15 minutos: **solo se suman los valores de las horas en punto** (:00).
- Cada valor horario se guarda en UTC y apuntado al **fin de su hora**; su día es el de Madrid de ese fin menos un minuto.
- Tablas `lluvia_obs` y `lluvia_dia` privadas como las de `rejilla`: RLS sin políticas, `revoke all … from anon, authenticated`, permisos explícitos a `service_role`.
- Control de calidad (spec §3.2), umbrales en un único módulo con pruebas (`supabase/functions/pluvio/calidad.js`): hora > 60 mm o día > 200 mm → sospechoso; negativo o no numérico → descartado; pico aislado frente a vecinas (< 25 km) **y** al modelo → sospechoso; menos de 20 horas válidas → no cuenta como día medido. Lo sospechoso no entra en la nota; queda guardado y marcado.
- Mezcla: media ponderada por distancia y por diferencia de altitud con radio máximo de **20 km**; sesgo del modelo de los **últimos 30 días** con cociente acotado **0,5–2**.
- La previsión (días de hoy en adelante) sigue saliendo del modelo, sin cambios.
- **Si falta `pluvio/ultimo.json` (o `pluvio/celdas.json`), las notas de Hoy, Zona y el mapa son idénticas a las actuales** (prueba de equivalencia).
- Ningún secreto en el repo, en documentos ni en commits (claves de Supabase, de AEMET, `PLUVIO_CLAVE`, tokens). **Toda tarea de despliegue necesita un access token nuevo de Supabase y la autorización explícita de la usuaria en ese momento: el controlador se para ahí y pregunta.**
- Textos de la interfaz en español, sin guiones largos; número y unidad con espacio duro (`docs/diseno.md`); colores con tokens de `css/tokens.css`.
- Cada tarea termina con un commit en español cuyo mensaje acaba con estas dos líneas exactas:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo`
- **Ramas:** se trabaja en una rama `pluviometros` en un worktree (skill `superpowers:using-git-worktrees`), no en `main`. **Excepción explícita:** la tarea 1 (recolector mínimo) y la tarea 2 (su despliegue) pueden ir a `main` en cuanto la tarea 1 pase su revisión, porque no tocan nada que cargue el navegador y el histórico de Tajo se pierde a los 10 días. El controlador integra la tarea 1 en `main` (avance rápido), sube con el ayudante de credenciales local del repo (nunca `gh auth switch`) y despliega desde `main`; el resto de tareas sigue en la rama, que ya la contiene.

## Review Focus

1. **Cambio de hora del 25/10/2026**: las 02:00 de Madrid salen dos veces en Tajo y Duero y caen en el mismo instante UTC dentro del mismo lote; Postgres rechaza un upsert que toca dos veces la misma fila y se perdería la lectura entera. Lo esperable: se deduplica (gana la última), se guarda el lote y el día cuenta como completo. (Pruebas en las tareas 1 y 4.)
2. **Una fuente cambia de formato o devuelve una página de error con estado 200** (portal en mantenimiento, sensor de temperatura en lugar del de lluvia): lo esperable es que esa fuente dé error, que no se guarden ceros inventados y que las demás fuentes sigan. (Pruebas en las tareas 1 y 3.)
3. **Pluviómetro atascado en 0 mientras llueve alrededor** (báscula bloqueada): la spec solo habla de picos altos, pero un 0 falso hunde la nota igual. Lo esperable: si las vecinas miden mucho y el modelo también, ese día es sospechoso y no entra. (Prueba en la tarea 8.)
4. **`pluvio/ultimo.json` de otra versión, mal formado o guardado en una caché vieja**: lo esperable es ignorarlo y que la app haga lo de hoy, sin romper Hoy ni Zona. (Prueba en la tarea 13.)
5. **Punto con estaciones cerca pero todas descartadas por el control de calidad** (caso Quintanar): lo esperable es que use el modelo corregido y que el texto no diga «sin estación cercana» sino que las cercanas no tienen datos válidos. (Pruebas en las tareas 9 y 14.)

---

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `supabase/functions/_shared/clave.js` | `claveValida` (sale de `rejilla/manejador.js`, que la reexporta) |
| `supabase/functions/pluvio/index.ts` | Entrada de Deno: clave, `?fuentes=`, `?accion=cargar` |
| `supabase/functions/pluvio/manejador.js` | Una ejecución con dependencias inyectadas: tareas por hora, guardado, carga de relleno |
| `supabase/functions/pluvio/red.js` | Peticiones con cortesía, reintento y plazo |
| `supabase/functions/pluvio/tiempo.js` | Hora de Madrid → UTC, día de Madrid de un fin de hora |
| `supabase/functions/pluvio/lectores/tajo.js`, `aemet.js`, `duero.js`, `jucar.js`, `euskalmet.js` | Un lector aislado por fuente (análisis puro + lectura) |
| `supabase/functions/pluvio/dias.js` | Agregación por día de Madrid (referencia JS de la función SQL) |
| `supabase/functions/pluvio/calidad.js` | Umbrales y reglas del control de calidad |
| `supabase/functions/pluvio/publicar.js` | Agrega, revisa, guarda `lluvia_dia` y publica `pluvio/*.json` |
| `supabase/functions/pluvio/estaciones.json` | Lista blanca (fuente, código, nombre, lat, lon, altitud, licencia; `url` en Tajo, `token` en Duero) |
| `supabase/functions/pluvio/puntos.json` | Puntos de zona (copia generada de `data/zonas.json`) |
| `supabase/functions/_shared/pluvio.js` | Mezcla por distancia y altitud, sesgo, aplicación a una serie, validación del archivo |
| `supabase/functions/_shared/pluvio-fuentes.js` | Nombres, enlaces y licencias de cada fuente |
| `supabase/functions/rejilla/manejador.js` | Toma `pluvio/celdas.json` al construir las series de las celdas gruesas |
| `supabase/functions/_shared/salida-indice.js` | `lluvia.origen` y `lluvia.estaciones` opcionales en el índice publicado |
| `supabase/migrations/20261003000000_pluvio.sql`, `20261003000100_pluvio_cron.sql` | `lluvia_obs`, limpieza y pg_cron horario |
| `supabase/migrations/20261004000000_lluvia_dia.sql` | `lluvia_dia` y la función SQL `lluvia_por_dia` |
| `scripts/pluvio/estaciones.mjs`, `seleccion.mjs`, `utm.mjs` | Selección local de estaciones y lista blanca |
| `scripts/pluvio/zip.mjs`, `relleno-euskalmet.mjs` | Lector de zip y relleno de Euskalmet desde el zip anual |
| `scripts/pluvio/sonda.mjs` | Prueba en vivo de cada fuente (manual, fuera de `npm test`) |
| `js/pluvio.js` | Carga de `pluvio/ultimo.json`, aplicación a la meteo, textos de origen, estado de las fuentes |
| `js/app.js`, `js/aemet.js`, `js/pantallas/zona.js`, `js/pantallas/mapa.js`, `js/mapa/hoja.js`, `js/ui/grafico-lluvia.js`, `js/pantallas/ajustes.js`, `js/rejilla/carga.js` | Integración en la app |
| `css/tokens.css`, `css/componentes.css` | Color de los días medidos |
| `tests/dobles-pluvio.js`, `tests/fixtures/pluvio/*` | Dobles y respuestas reales |
| `tests/pluvio-*.test.js` | Pruebas nuevas |
| `docs/supabase.md`, `docs/datos.md` | Documentación |

**Respuestas reales para los dobles.** Se capturaron el 02/10/2026 entre las 09:55 y las 10:10 de Madrid y están en
`C:/Users/ALEJAN~1.ALE/AppData/Local/Temp/claude/C--Users-Alejandra-ALEJANDRA-P-Las-Gordillas/34bb25e7-93eb-4527-9cc6-e4b60f2fcfa8/scratchpad/pluvio/fixtures/`
(en adelante, `$CAPTURAS`). Cada tarea copia las que usa a `tests/fixtures/pluvio/`. Las cifras de las pruebas son de esas
capturas: **si la carpeta ya no existe, la tarea se para y avisa al controlador** (no se recapturan: las cifras cambiarían).
La respuesta de AEMET es la única que no es real (no hay clave en local): va escrita en la tarea 1 con el formato de la
especificación oficial y la tarea 2 la sustituye por una real si la usuaria aporta la clave.

---

### Task 1: Recolector mínimo: función `pluvio` con SAIH Tajo y AEMET horario, tabla `lluvia_obs` y pg_cron horario

Urgente: el SAIH Tajo solo guarda 10 días. Guarda en bruto (calidad `bruto`) con su fuente; el control de calidad llega en la tarea 8.

**Files:**
- Create: `supabase/functions/_shared/clave.js`
- Modify: `supabase/functions/rejilla/manejador.js:105-113` (la función `claveValida` pasa a `_shared/clave.js` y se reexporta)
- Create: `supabase/functions/pluvio/tiempo.js`, `red.js`, `lectores/tajo.js`, `lectores/aemet.js`, `manejador.js`, `index.ts`, `estaciones.json`
- Create: `supabase/migrations/20261003000000_pluvio.sql`, `supabase/migrations/20261003000100_pluvio_cron.sql`
- Create: `tests/dobles-pluvio.js`, `tests/pluvio-recolector.test.js`, `tests/fixtures/pluvio/` (6 archivos de Tajo + `aemet-convencional.json`)
- Modify: `.gitattributes` (las respuestas guardadas, byte a byte)

**Interfaces:**
- Consumes: `hoyMadrid`, `sumarDias` de `supabase/functions/_shared/meteo.js`.
- Produces:
  - `claveValida(recibida: string|null, secreto: string|undefined): boolean` en `_shared/clave.js`.
  - `tiempo.js`: `utcDeMadrid(fecha: 'AAAA-MM-DD', hhmm: 'HH:MM'): string|null`, `horaDeTexto('DD/MM/AAAA HH:MM'): string|null`, `fechaMadridDeFin(iso): 'AAAA-MM-DD'`, `finDeDia(fecha): string`, `esHoraEnPunto(iso): boolean`.
  - `red.js`: `AGENTE`, `PAUSA_MS = 400`, `ESPERA_REINTENTO_MS = 3000`, `LIMITE_PETICION_MS = 25000`, `MINIMO_UTIL_MS = 4000`, `class PlazoAgotado`, `crearPedir({ fetchFn, esperar?, margen?, senal? }) → pedir(url, { como?: 'json'|'texto'|'bytes', cabeceras?, intentos? })`.
  - `lectores/tajo.js`: `BASE_TAJO`, `senalP1(json)`, `horasDeEstacionTajo(json, codigo)`, `horasDeGraficoTajo(json, codigo)`, `estacionesDeTablaTajo(json) → [{ codigo, nombre, tipo, x, y, altitud, url }]`, `enlacesDeTablaTajo(json) → Map<codigo, url>`, `cadenaTajo(pedir) → json de la tabla`, `leerTajo({ pedir, estaciones, diezDias? }) → { filas, errores, agotado }`.
  - `lectores/aemet.js`: `URL_AEMET_TODAS`, `horaDeFint(t)`, `horasDeAemet(lista, codigos: Set)`, `leerAemet({ pedir, clave, estaciones })`.
  - Una fila leída es `{ estacion, hora (ISO, fin de la hora), mm (number|null), horas? (1 por defecto) }`.
  - `manejador.js`: `PLAZO_EJECUCION = 140000`, `RESERVA_MS = 25000`, `TAREAS` (`{ clave: { fuente, toca(horaUTC, diaSemanaUTC), leer(ctx) } }`), `fuentesQueTocan(ahora, pedidas = [])`, `filaObs(fuente, fila)`, `unicas(filas)`, `ejecutar({ almacen, fetchFn, ahora?, estaciones, pedidas?, claveAemet?, esperar?, reloj?, plazo?, senal? }) → { estado, tareas, filas, errores }`, `almacenSupabase(admin)` con `guardarObs(filas)`.
  - Tabla `lluvia_obs(fuente, estacion, hora, horas, mm, calidad, leido)`, clave `(fuente, estacion, hora)`.
  - Dobles: `fixture(nombre, enc?)`, `fixtureJson(nombre)`, `respuesta(status, cuerpo, cabeceras?)`, `servidorFalso(rutas, registro?)`, `rutasTajo()`, `rutasAemet(estado?)`, `almacenPluvioMemoria()`.

- [ ] **Step 1: Copiar las respuestas reales**

```bash
CAPTURAS="C:/Users/ALEJAN~1.ALE/AppData/Local/Temp/claude/C--Users-Alejandra-ALEJANDRA-P-Las-Gordillas/34bb25e7-93eb-4527-9cc6-e4b60f2fcfa8/scratchpad/pluvio/fixtures"
mkdir -p tests/fixtures/pluvio
cp "$CAPTURAS"/tajo-estacion-P_26.json "$CAPTURAS"/tajo-grafico-P_26.json "$CAPTURAS"/tajo-pluviometria.json \
   "$CAPTURAS"/tajo-wrapper.json "$CAPTURAS"/tajo-menu.json "$CAPTURAS"/tajo-inicio.html tests/fixtures/pluvio/
printf '\n# Respuestas reales de las fuentes de lluvia: byte a byte (algunas en ISO-8859-1)\ntests/fixtures/pluvio/** -text\n' >> .gitattributes
```

Crear `tests/fixtures/pluvio/aemet-convencional.json` (formato de `/observacion/convencional/todas` según la
especificación oficial; `prec` es la lluvia de los 60 minutos anteriores a `fint`; una fila sin `prec` y una estación fuera
de la lista blanca):

```json
[
  {"idema":"3104Y","lon":-3.8883,"fint":"2026-10-02T05:00:00+0000","prec":0.0,"alt":1159.0,"lat":40.8897,"ubi":"RASCAFRIA","ta":8.3,"hr":95.0},
  {"idema":"3104Y","lon":-3.8883,"fint":"2026-10-02T06:00:00+0000","prec":1.2,"alt":1159.0,"lat":40.8897,"ubi":"RASCAFRIA","ta":8.1,"hr":97.0},
  {"idema":"2462","lon":-4.0108,"fint":"2026-10-02T06:00:00+0000","prec":3.4,"alt":1892.0,"lat":40.7933,"ubi":"PUERTO DE NAVACERRADA","ta":3.2,"hr":100.0},
  {"idema":"2462","lon":-4.0108,"fint":"2026-10-02T07:00:00+0000","alt":1892.0,"lat":40.7933,"ubi":"PUERTO DE NAVACERRADA","ta":3.0,"hr":100.0},
  {"idema":"3195","lon":-3.6781,"fint":"2026-10-02T06:00:00+0000","prec":0.4,"alt":667.0,"lat":40.4117,"ubi":"MADRID, RETIRO","ta":14.1,"hr":80.0}
]
```

- [ ] **Step 2: Escribir los dobles**

`tests/dobles-pluvio.js`:

```js
// tests/dobles-pluvio.js
// Dobles de la función «pluvio»: respuestas reales guardadas (tests/fixtures/pluvio/, capturadas el 02/10/2026), un
// servidor falso que las sirve por URL y un almacén en memoria con la interfaz de almacenSupabase.
import { readFileSync } from 'node:fs';

export const fixture = (nombre, enc = 'utf8') => readFileSync(new URL(`./fixtures/pluvio/${nombre}`, import.meta.url), enc);
export const fixtureJson = (nombre) => JSON.parse(fixture(nombre));

export function respuesta(status, cuerpo, cabeceras = {}) {
  const bytes = Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), 'utf8');
  return { ok: status >= 200 && status < 300, status, headers: new Map(Object.entries(cabeceras)),
    json: async () => JSON.parse(bytes.toString('utf8')), text: async () => bytes.toString('utf8'),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

// rutas: [[(url) => boolean, (url, opciones) => respuesta], …]; responde la primera que encaja; si ninguna, 404.
export function servidorFalso(rutas, registro = []) {
  return async (url, opciones = {}) => {
    registro.push({ url, cabeceras: opciones.headers ?? {} });
    for (const [encaja, responder] of rutas) if (encaja(url)) return responder(url, opciones);
    return respuesta(404, 'no encontrado');
  };
}

// SAIH Tajo con las capturas reales: la estación P_26 contesta por todas.
export const rutasTajo = () => [
  [(u) => u.includes('get-estacion-grafico-grande'), () => respuesta(200, fixture('tajo-grafico-P_26.json'))],
  [(u) => u.includes('w=get-estacion&'), () => respuesta(200, fixture('tajo-estacion-P_26.json'))],
  [(u) => u.includes('get-wrapperentorno'), () => respuesta(200, fixture('tajo-wrapper.json'))],
  [(u) => u.includes('w=get-menu'), () => respuesta(200, fixture('tajo-menu.json'))],
  [(u) => u.includes('w=get-pluviometria&'), () => respuesta(200, fixture('tajo-pluviometria.json'))],
  [(u) => u === 'https://saihtajo.chtajo.es/', () => respuesta(200, fixture('tajo-inicio.html'))],
];
// AEMET en dos pasos: la primera llamada da la URL de los datos; la segunda, los datos en ISO-8859-15.
export const rutasAemet = (estado = 200) => [
  [(u) => u.includes('/observacion/convencional/todas'), () => respuesta(200, estado === 200
    ? { descripcion: 'exito', estado: 200, datos: 'https://opendata.aemet.es/opendata/sh/datos-falsos' }
    : { descripcion: 'API key invalido', estado })],
  [(u) => u.includes('/opendata/sh/datos-falsos'), () => respuesta(200, Buffer.from(fixture('aemet-convencional.json'), 'latin1'))],
];

// Almacén en memoria con la interfaz de almacenSupabase. Como Postgres, un upsert que toca dos veces la misma fila falla.
export function almacenPluvioMemoria() {
  const obs = new Map();
  return {
    obs,
    async guardarObs(filas) {
      const claves = filas.map((f) => `${f.fuente}|${f.estacion}|${f.hora}`);
      if (new Set(claves).size !== claves.length) throw new Error('ON CONFLICT DO UPDATE command cannot affect row a second time');
      filas.forEach((f, k) => obs.set(claves[k], { ...f }));
    },
  };
}
```

- [ ] **Step 3: Escribir las pruebas que fallan**

`tests/pluvio-recolector.test.js`:

```js
// tests/pluvio-recolector.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { utcDeMadrid, horaDeTexto, fechaMadridDeFin, finDeDia, esHoraEnPunto } from '../supabase/functions/pluvio/tiempo.js';
import { crearPedir, PlazoAgotado, PAUSA_MS, ESPERA_REINTENTO_MS } from '../supabase/functions/pluvio/red.js';
import { horasDeEstacionTajo, horasDeGraficoTajo, cadenaTajo, enlacesDeTablaTajo, estacionesDeTablaTajo, leerTajo } from '../supabase/functions/pluvio/lectores/tajo.js';
import { horaDeFint, horasDeAemet, leerAemet } from '../supabase/functions/pluvio/lectores/aemet.js';
import { ejecutar, fuentesQueTocan, unicas, filaObs } from '../supabase/functions/pluvio/manejador.js';
import { claveValida } from '../supabase/functions/_shared/clave.js';
import { claveValida as claveRejilla } from '../supabase/functions/rejilla/manejador.js';
import { fixture, fixtureJson, respuesta, servidorFalso, rutasTajo, rutasAemet, almacenPluvioMemoria } from './dobles-pluvio.js';

const leer = (r) => readFileSync(r, 'utf8');
const r1 = (x) => Math.round(x * 10) / 10;
const suma = (filas) => r1(filas.reduce((t, f) => t + (f.mm ?? 0), 0));
const sinEspera = async () => {};
const pedirCon = (rutas, registro) => crearPedir({ fetchFn: servidorFalso(rutas, registro), esperar: sinEspera });
const P26 = { fuente: 'tajo', codigo: 'P_26', url: 'index.php?w=get-estacion&x=guardada' };

// ---- tiempo ----
test('hora de Madrid a UTC: verano, invierno, hora repetida y hora que no existe', () => {
  assert.equal(horaDeTexto('01/10/2026 10:00'), '2026-10-01T08:00:00.000Z');
  assert.equal(horaDeTexto('15/11/2026 10:00'), '2026-11-15T09:00:00.000Z');
  assert.equal(utcDeMadrid('2026-10-25', '02:00'), '2026-10-25T00:00:00.000Z');   // la primera de las dos (verano)
  assert.equal(utcDeMadrid('2026-03-29', '02:30'), null);
  assert.equal(horaDeTexto('2026-10-01 10:00'), null);
  assert.equal(horaDeTexto(undefined), null);
});

test('el día de un valor es el de Madrid de su fin menos un minuto; fin del día de Madrid', () => {
  assert.equal(fechaMadridDeFin('2026-10-01T22:00:00.000Z'), '2026-10-01');   // la hora que acaba a las 00:00 es del día anterior
  assert.equal(fechaMadridDeFin('2026-10-01T23:00:00.000Z'), '2026-10-02');
  assert.equal(finDeDia('2026-09-30'), '2026-09-30T22:00:00.000Z');
  assert.equal(esHoraEnPunto('2026-10-01T08:00:00.000Z'), true);
  assert.equal(esHoraEnPunto('2026-10-01T08:15:00.000Z'), false);
  assert.equal(esHoraEnPunto('ayer'), false);
});

// ---- red ----
test('red: un 503 se reintenta una vez tras esperar; un 404, no', async () => {
  let n = 0;
  const esperas = [];
  const pedir = crearPedir({ fetchFn: async () => (++n === 1 ? respuesta(503, 'ocupado') : respuesta(200, { ok: 1 })), esperar: async (ms) => esperas.push(ms) });
  assert.deepEqual(await pedir('https://a.es/x'), { ok: 1 });
  assert.deepEqual(esperas, [ESPERA_REINTENTO_MS, PAUSA_MS]);
  const pedir404 = crearPedir({ fetchFn: async () => respuesta(404, 'no'), esperar: sinEspera });
  await assert.rejects(pedir404('https://a.es/y'), /a\.es respondió 404/);
});

test('red: cortesía (pausa entre peticiones al mismo servidor, no entre servidores) y agente identificado', async () => {
  const esperas = [], registro = [];
  const pedir = crearPedir({ fetchFn: servidorFalso([[() => true, () => respuesta(200, 'x')]], registro), esperar: async (ms) => esperas.push(ms) });
  await pedir('https://a.es/1', { como: 'texto' });
  await pedir('https://b.es/1', { como: 'texto' });
  await pedir('https://a.es/2', { como: 'texto' });
  assert.deepEqual(esperas, [PAUSA_MS]);
  assert.match(registro[0].cabeceras['User-Agent'], /^setas-app\/1\.0/);
});

test('red: sin margen no se pide (PlazoAgotado)', async () => {
  const registro = [];
  const pedir = crearPedir({ fetchFn: servidorFalso([], registro), esperar: sinEspera, margen: () => 1000 });
  await assert.rejects(pedir('https://a.es/'), PlazoAgotado);
  assert.equal(registro.length, 0);
});

// ---- SAIH Tajo (respuestas reales del 02/10/2026) ----
test('Tajo, ficha de estación: las 23 horas en punto de las últimas 24 h (el registro vacío final se ignora)', () => {
  const filas = horasDeEstacionTajo(fixtureJson('tajo-estacion-P_26.json'), 'P_26');
  assert.equal(filas.length, 23);
  assert.deepEqual(filas[0], { estacion: 'P_26', hora: '2026-10-01T08:00:00.000Z', mm: 0 });
  assert.deepEqual(filas.at(-1), { estacion: 'P_26', hora: '2026-10-02T06:00:00.000Z', mm: 10 });
  assert.equal(suma(filas), 14.6);
});

test('Tajo, 10 días: solo se suman las horas en punto (la señal es «última hora» cada 15 min)', () => {
  const json = fixtureJson('tajo-grafico-P_26.json');
  const valores = json.response.senal.valores;
  assert.equal(valores.length, 963);
  const filas = horasDeGraficoTajo(json, 'P_26');
  assert.equal(filas.length, 241);
  assert.equal(filas[0].hora, '2026-09-22T07:00:00.000Z');
  assert.equal(filas.at(-1).hora, '2026-10-02T07:00:00.000Z');
  assert.equal(suma(filas), 28.2);
  assert.equal(r1(valores.reduce((t, v) => t + v.valor, 0)), 115.8, 'sumar los cuatro valores de cada hora daría cuatro veces más');
});

test('Tajo: la cadena portada → entorno → menú → tabla, y los enlaces de cada estación', async () => {
  const registro = [];
  const tabla = await cadenaTajo(pedirCon(rutasTajo(), registro));
  assert.deepEqual(registro.map((r) => r.url.match(/w=([a-z-]+)/)?.[1] ?? 'portada'), ['portada', 'get-wrapperentorno', 'get-menu', 'get-pluviometria']);
  const enlaces = enlacesDeTablaTajo(tabla);
  assert.match(enlaces.get('P_26'), /^index\.php\?w=get-estacion&x=/);
  const est = estacionesDeTablaTajo(tabla);
  assert.deepEqual(est.find((e) => e.codigo === 'P_26'), { codigo: 'P_26', nombre: 'OLLA DEL QUIÑON EN BUSTARVIEJO', tipo: 'pluviometro',
    x: 435403.9, y: 4522055.4, altitud: 1279, url: enlaces.get('P_26') });
});

test('Tajo: usa la URL guardada; si falla, rehace la cadena una vez y sigue con las demás', async () => {
  const registro = [];
  const rutas = [[(u) => u.includes('x=guardada'), () => respuesta(200, { response: { ok: 0 } })], ...rutasTajo()];
  const r = await leerTajo({ pedir: pedirCon(rutas, registro), estaciones: [P26, { ...P26, codigo: 'PN24' }, { ...P26, codigo: 'NOEXISTE' }] });
  assert.equal(r.filas.filter((f) => f.estacion === 'P_26').length, 23);
  assert.equal(r.filas.filter((f) => f.estacion === 'PN24').length, 23);
  assert.deepEqual(r.errores, ['NOEXISTE: no está en la tabla del SAIH Tajo']);
  assert.equal(registro.filter((x) => x.url.includes('get-pluviometria')).length, 1, 'la tabla (2 MB) se pide una sola vez');
});

// Review Focus 2: el portal contesta 200 con otra cosa.
test('Tajo: una respuesta sin la señal de lluvia es un error, no ceros', async () => {
  const rutas = [[() => true, () => respuesta(200, { response: { ok: 1, senales: [{ tiposenal: 'T', valores: [{ tiempo: '02/10/2026 08:00', valor: 0 }] }] } })]];
  const r = await leerTajo({ pedir: pedirCon(rutas), estaciones: [P26] });
  assert.deepEqual(r.filas, []);
  assert.deepEqual(r.errores, ['P_26: sin señal de lluvia (P1)']);
});

// ---- AEMET horario ----
test('AEMET: fint con +0000, solo la lista blanca, sin prec no hay fila', () => {
  assert.equal(horaDeFint('2026-10-02T06:00:00+0000'), '2026-10-02T06:00:00.000Z');
  assert.equal(horaDeFint('2026-10-02T06:00:00'), '2026-10-02T06:00:00.000Z');
  assert.equal(horaDeFint('2026-10-02T06:30:00+0000'), null);
  const filas = horasDeAemet(fixtureJson('aemet-convencional.json'), new Set(['3104Y', '2462']));
  assert.deepEqual(filas, [
    { estacion: '3104Y', hora: '2026-10-02T05:00:00.000Z', mm: 0 },
    { estacion: '3104Y', hora: '2026-10-02T06:00:00.000Z', mm: 1.2 },
    { estacion: '2462', hora: '2026-10-02T06:00:00.000Z', mm: 3.4 }]);
});

test('AEMET: dos pasos con la clave en la cabecera; un estado distinto de 200 es un error', async () => {
  const registro = [];
  const r = await leerAemet({ pedir: pedirCon(rutasAemet(), registro), clave: 'clave-falsa', estaciones: [{ codigo: '3104Y' }] });
  assert.equal(r.filas.length, 2);
  assert.equal(registro[0].cabeceras.api_key, 'clave-falsa');
  await assert.rejects(leerAemet({ pedir: pedirCon(rutasAemet(401)), clave: 'x', estaciones: [] }), /AEMET 401/);
  await assert.rejects(leerAemet({ pedir: pedirCon(rutasAemet()), clave: null, estaciones: [] }), /sin clave/);
});

// ---- manejador ----
test('qué toca a cada hora UTC (minuto 10) y las pedidas a mano', () => {
  const a = (h) => new Date(`2026-10-02T${String(h).padStart(2, '0')}:10:00Z`);
  assert.deepEqual(fuentesQueTocan(a(0)), ['aemet']);
  assert.deepEqual(fuentesQueTocan(a(1)), ['tajo']);
  assert.deepEqual(fuentesQueTocan(a(2)), ['tajo10']);
  assert.deepEqual(fuentesQueTocan(a(5)), []);
  assert.deepEqual(fuentesQueTocan(a(5), ['tajo10', 'aemet', 'nada']), ['aemet', 'tajo10']);
});

test('ejecutar: guarda en bruto con su fuente; tajo10 se guarda como tajo; sin clave de AEMET, Tajo sigue', async () => {
  const almacen = almacenPluvioMemoria();
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([...rutasTajo(), ...rutasAemet()]), esperar: sinEspera,
    estaciones: [P26, { fuente: 'aemet', codigo: '3104Y' }], pedidas: ['aemet', 'tajo10'] });
  assert.equal(r.estado, 'hecho');
  assert.deepEqual(r.filas, { tajo10: 241 });
  assert.deepEqual(r.errores, ['aemet: sin clave (falta el secreto AEMET_API_KEY)']);
  const una = almacen.obs.get('tajo|P_26|2026-10-02T06:00:00.000Z');
  assert.deepEqual(una, { fuente: 'tajo', estacion: 'P_26', hora: '2026-10-02T06:00:00.000Z', horas: 1, mm: 10, calidad: 'bruto' });
});

// Review Focus 1: 25 de octubre, la misma hora local dos veces en un lote.
test('cambio de hora: dos valores de la misma hora UTC no rompen el lote (gana el último)', async () => {
  const valores = [{ tiempo: '25/10/2026 01:00', valor: 0.2 }, { tiempo: '25/10/2026 02:00', valor: 0.4 }, { tiempo: '25/10/2026 02:00', valor: 0.6 }, { tiempo: '25/10/2026 03:00', valor: 0 }];
  const grafico = { response: { senal: { valores } } };
  const estacion = { response: { ok: 1, senales: [{ tiposenal: 'P1', url: 'index.php?w=get-estacion-grafico-grande&x=g', valores: [] }] } };
  const rutas = [[(u) => u.includes('grafico-grande'), () => respuesta(200, grafico)], [() => true, () => respuesta(200, estacion)]];
  const almacen = almacenPluvioMemoria();
  const r = await ejecutar({ almacen, fetchFn: servidorFalso(rutas), esperar: sinEspera, estaciones: [P26], pedidas: ['tajo10'] });
  assert.deepEqual(r.errores, []);
  assert.equal(almacen.obs.size, 3);
  assert.equal(almacen.obs.get('tajo|P_26|2026-10-25T00:00:00.000Z').mm, 0.6);
  assert.equal(unicas([filaObs('tajo', { estacion: 'a', hora: 'h', mm: 1 }), filaObs('tajo', { estacion: 'a', hora: 'h', mm: 2 })])[0].mm, 2);
});

test('plazo agotado a mitad: guarda lo leído y para', async () => {
  let t = 0;
  const reloj = () => t;
  const fetchFn = async (url) => { t += 60000; return servidorFalso(rutasTajo())(url); };
  const almacen = almacenPluvioMemoria();
  const est = ['A', 'B', 'C', 'D'].map((c) => ({ ...P26, codigo: c, url: 'index.php?w=get-estacion&x=ok' }));
  const r = await ejecutar({ almacen, fetchFn, esperar: sinEspera, reloj, estaciones: est, pedidas: ['tajo'] });
  assert.equal(r.estado, 'plazo-agotado');
  assert.equal(r.filas.tajo, 23 * 2);   // A y B antes del plazo; C ya no cabe
  assert.equal(almacen.obs.size, 46);
});

// ---- piezas de Deno, migraciones y lista blanca ----
test('clave: la misma función en _shared y en rejilla; index.ts la usa con x-pluvio-clave', () => {
  assert.equal(claveValida, claveRejilla);
  assert.equal(claveValida('abcdefghijklmnopqrstuvwxyz012345', 'abcdefghijklmnopqrstuvwxyz012345'), true);
  assert.equal(claveValida(null, undefined), false);
  const index = leer('supabase/functions/pluvio/index.ts');
  assert.match(index, /claveValida\(req\.headers\.get\('x-pluvio-clave'\), Deno\.env\.get\('PLUVIO_CLAVE'\)\)/);
  assert.match(index, /req\.method !== 'POST'/);
});

test('migraciones: lluvia_obs cerrada, limpieza y pg_cron cada hora en el minuto 10, sin claves', () => {
  const sql = leer('supabase/migrations/20261003000000_pluvio.sql');
  assert.match(sql, /alter table public\.lluvia_obs enable row level security/);
  assert.doesNotMatch(sql, /create policy/);
  assert.match(sql, /revoke all on public\.lluvia_obs from anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on public\.lluvia_obs to service_role/);
  assert.match(sql, /primary key \(fuente, estacion, hora\)/);
  const cron = leer('supabase/migrations/20261003000100_pluvio_cron.sql');
  assert.match(cron, /cron\.schedule\('pluvio-hora', '10 \* \* \* \*'/);
  assert.match(cron, /name = 'pluvio_clave'/);
  for (const t of [sql, cron]) assert.doesNotMatch(t, /sb_secret|eyJ|sb_publishable/);
});

test('lista blanca inicial: AEMET = la de la función aemet; Tajo con su URL; campos completos y sin repetidos', () => {
  const lista = JSON.parse(leer('supabase/functions/pluvio/estaciones.json'));
  const aemet = JSON.parse(leer('supabase/functions/aemet/estaciones.json'));
  assert.deepEqual(lista.filter((e) => e.fuente === 'aemet').map((e) => e.codigo).sort(), [...aemet].sort());
  const tajo = lista.filter((e) => e.fuente === 'tajo');
  assert.equal(tajo.length, 28);
  for (const e of tajo) assert.match(e.url, /^index\.php\?w=get-estacion&x=/, e.codigo);
  for (const e of lista) {
    assert.ok(['tajo', 'aemet'].includes(e.fuente), e.codigo);
    assert.ok(Number.isFinite(e.lat) && Number.isFinite(e.lon) && Number.isInteger(e.altitud) && e.nombre, e.codigo);
    assert.ok(['reutilizacion-sector-publico', 'aemet'].includes(e.licencia), e.codigo);
  }
  assert.equal(new Set(lista.map((e) => `${e.fuente}:${e.codigo}`)).size, lista.length);
});
```

- [ ] **Step 4: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-recolector.test.js`
Expected: FAIL con `Cannot find module …/supabase/functions/pluvio/tiempo.js`.

- [ ] **Step 5: `claveValida` a `_shared/clave.js`**

`supabase/functions/_shared/clave.js`:

```js
// Comparación de una cabecera de clave con su secreto sin cortar en el primer carácter distinto. Sin secreto (o con uno
// corto) no entra nadie. La usan las funciones «rejilla» y «pluvio».
export function claveValida(recibida, secreto) {
  if (typeof secreto !== 'string' || secreto.length < 32 || typeof recibida !== 'string') return false;
  const a = new TextEncoder().encode(recibida), b = new TextEncoder().encode(secreto);
  let distinto = a.length ^ b.length;
  for (let k = 0; k < b.length; k++) distinto |= (a[k] ?? 0) ^ b[k];
  return distinto === 0;
}
```

En `supabase/functions/rejilla/manejador.js`, sustituir el bloque de las líneas 105-113 (el comentario y la función
`claveValida`) por:

```js
// La comparación de la clave vive en _shared (la usa también «pluvio»); se reexporta para index.ts y las pruebas.
export { claveValida } from '../_shared/clave.js';
```

(`rejilla/index.ts` sigue importando `claveValida` de `./manejador.js`: no cambia. La función desplegada no hace falta
volver a desplegarla por esto.)

- [ ] **Step 6: `tiempo.js` y `red.js`**

`supabase/functions/pluvio/tiempo.js`:

```js
// supabase/functions/pluvio/tiempo.js
// Horas de las fuentes. Los SAIH publican en hora de Madrid («02/10/2026 09:00»); se guarda en UTC y cada valor se apunta
// al FIN de su hora (la lluvia de 08:00 a 09:00 lleva la hora 09:00). El día de Madrid de un valor es el de su fin menos un
// minuto: la hora que acaba a las 00:00 es del día anterior.
import { hoyMadrid, sumarDias } from '../_shared/meteo.js';

const ZONA = 'Europe/Madrid';
const FORMATO = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const local = (ms) => {
  const p = Object.fromEntries(FORMATO.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};

// Instante UTC de una hora de Madrid. En el cambio de octubre las 02:xx existen dos veces: se toma la primera (verano); en
// el de marzo no existen: null.
export function utcDeMadrid(fecha, hhmm) {
  const [a, m, d] = fecha.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  const base = Date.UTC(a, m - 1, d, h, mi);
  for (const desfase of [2, 1]) {
    const ms = base - desfase * 3600e3;
    if (local(ms) === `${fecha} ${hhmm}`) return new Date(ms).toISOString();
  }
  return null;
}
export function horaDeTexto(t) {
  const m = typeof t === 'string' ? t.trim().match(/^(\d\d)\/(\d\d)\/(\d{4}) (\d\d:\d\d)$/) : null;
  return m ? utcDeMadrid(`${m[3]}-${m[2]}-${m[1]}`, m[4]) : null;
}
export const fechaMadridDeFin = (iso) => hoyMadrid(new Date(Date.parse(iso) - 60e3));
export const finDeDia = (fecha) => utcDeMadrid(sumarDias(fecha, 1), '00:00');
export const esHoraEnPunto = (iso) => typeof iso === 'string' && Number.isFinite(Date.parse(iso)) && Date.parse(iso) % 3600e3 === 0;
```

`supabase/functions/pluvio/red.js`:

```js
// supabase/functions/pluvio/red.js
// Peticiones a las fuentes con cortesía (spec §3.1): agente identificado, pausa entre peticiones al mismo servidor, un
// reintento tras esperar si contesta 429/5xx o falla la red, y nunca más allá del plazo de la ejecución (`margen`).
export const AGENTE = 'setas-app/1.0 (+https://gonzalotsainz-ux.github.io/setas/)';
export const PAUSA_MS = 400;
export const ESPERA_REINTENTO_MS = 3000;
export const LIMITE_PETICION_MS = 25000;
export const MINIMO_UTIL_MS = 4000;
export class PlazoAgotado extends Error { constructor() { super('plazo agotado'); this.name = 'PlazoAgotado'; } }
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function crearPedir({ fetchFn, esperar = dormir, margen = () => Infinity, senal = (ms) => AbortSignal.timeout(ms) }) {
  const usados = new Set();
  return async function pedir(url, { como = 'json', cabeceras = {}, intentos = 2 } = {}) {
    const host = new URL(url).host;
    for (let n = 1; ; n++) {
      if (usados.has(host)) await esperar(PAUSA_MS);
      usados.add(host);
      const ms = Math.min(LIMITE_PETICION_MS, margen());
      if (!(ms >= MINIMO_UTIL_MS)) throw new PlazoAgotado();
      const reintentar = n < intentos && margen() >= ESPERA_REINTENTO_MS + MINIMO_UTIL_MS;
      let r;
      try {
        r = await fetchFn(url, { headers: { 'User-Agent': AGENTE, ...cabeceras }, signal: senal(ms) });
      } catch (e) {
        if (!reintentar) throw e;
        await esperar(ESPERA_REINTENTO_MS);
        continue;
      }
      if (r.ok) {
        if (como === 'texto') return r.text();
        if (como === 'bytes') return new Uint8Array(await r.arrayBuffer());
        return r.json();
      }
      if ((r.status === 429 || r.status >= 500) && reintentar) { await esperar(ESPERA_REINTENTO_MS); continue; }
      throw new Error(`${host} respondió ${r.status}`);
    }
  };
}
```

- [ ] **Step 7: Lectores de Tajo y AEMET**

`supabase/functions/pluvio/lectores/tajo.js`:

```js
// supabase/functions/pluvio/lectores/tajo.js
// SAIH Tajo (CHT), sin clave (informe 09 §3.2). La tabla de pluviometría (2 MB) da la URL cifrada de cada estación; la
// ficha de la estación trae la señal P1 («PRECIPITACIÓN ÚLTIMA HORA») de las últimas 24 h con un valor por hora, y su
// gráfico grande, 10 días con un valor cada 15 min. La señal se solapa: solo valen los valores de las horas en punto.
// Las URLs guardadas en la lista blanca se usan tal cual; si una falla, se rehace la cadena portada → menú → tabla.
import { horaDeTexto } from '../tiempo.js';
import { PlazoAgotado } from '../red.js';

export const BASE_TAJO = 'https://saihtajo.chtajo.es/';

export const senalP1 = (json) => (json?.response?.senales ?? []).find((s) => s?.tiposenal === 'P1') ?? null;
function horasDe(valores, estacion) {
  const filas = [];
  for (const v of valores ?? []) {
    if (typeof v?.tiempo !== 'string' || !v.tiempo.endsWith(':00')) continue;   // solo las horas en punto
    const hora = horaDeTexto(v.tiempo);
    if (!hora) continue;
    filas.push({ estacion, hora, mm: typeof v.valor === 'number' && Number.isFinite(v.valor) ? v.valor : null });
  }
  return filas;
}
export const horasDeEstacionTajo = (json, codigo) => horasDe(senalP1(json)?.valores, codigo);
export const horasDeGraficoTajo = (json, codigo) => horasDe(json?.response?.senal?.valores, codigo);

export const estacionesDeTablaTajo = (json) => (json?.response?.pluviometria ?? []).map((x) => ({
  codigo: x.idestacion, nombre: x.estacion?.nombre ?? x.idestacion, tipo: x.estacion?.tipoestacion ?? null,
  x: Number(x.estacion?.utm?.x), y: Number(x.estacion?.utm?.y), altitud: Math.round(Number(x.estacion?.utm?.z)), url: x.url }));
export const enlacesDeTablaTajo = (json) => new Map(estacionesDeTablaTajo(json).map((e) => [e.codigo, e.url]));

function buscarEnlace(o, trozo) {
  if (typeof o === 'string') return o.includes(trozo) ? o : null;
  if (o && typeof o === 'object') for (const v of Object.values(o)) { const r = buscarEnlace(v, trozo); if (r) return r; }
  return null;
}
export async function cadenaTajo(pedir) {
  const portada = await pedir(BASE_TAJO, { como: 'texto' });
  const entorno = portada.match(/index\.php\?w=get-wrapperentorno&x=[^'"\s]+/)?.[0];
  if (!entorno) throw new Error('SAIH Tajo: la portada no trae get-wrapperentorno');
  const menu = (await pedir(BASE_TAJO + entorno))?.response?.urlmenu;
  if (!menu) throw new Error('SAIH Tajo: sin urlmenu');
  const tabla = buscarEnlace(await pedir(BASE_TAJO + menu), 'w=get-pluviometria&');
  if (!tabla) throw new Error('SAIH Tajo: el menú no trae la pluviometría');
  return pedir(BASE_TAJO + tabla);
}

// Lo que falle (salvo el plazo) queda como error de esa estación y se sigue con las demás.
const intento = async (f) => { try { return await f(); } catch (e) { if (e instanceof PlazoAgotado) throw e; return null; } };

export async function leerTajo({ pedir, estaciones, diezDias = false }) {
  const filas = [], errores = [];
  let enlaces = null;   // la tabla (2 MB) solo si alguna URL guardada falla, y una vez
  for (const e of estaciones) {
    try {
      let ficha = await intento(() => pedir(BASE_TAJO + e.url));
      if (ficha?.response?.ok !== 1) {
        enlaces ??= enlacesDeTablaTajo(await cadenaTajo(pedir));
        const url = enlaces.get(e.codigo);
        if (!url) throw new Error('no está en la tabla del SAIH Tajo');
        ficha = await pedir(BASE_TAJO + url);
      }
      const p1 = senalP1(ficha);
      if (!p1) throw new Error('sin señal de lluvia (P1)');
      const horas = diezDias ? (p1.url ? horasDeGraficoTajo(await pedir(BASE_TAJO + p1.url), e.codigo) : []) : horasDeEstacionTajo(ficha, e.codigo);
      if (!horas.length) throw new Error('sin valores en hora en punto');
      filas.push(...horas);
    } catch (err) {
      if (err instanceof PlazoAgotado) return { filas, errores, agotado: true };
      errores.push(`${e.codigo}: ${err.message}`);
    }
  }
  return { filas, errores, agotado: false };
}
```

Nota para la prueba «sin la señal de lluvia»: la respuesta tiene `ok: 1` pero ninguna señal `P1`, así que el error es
`sin señal de lluvia (P1)`. En la prueba del cambio de hora la ficha trae `P1` con `url` y `valores: []`; con
`diezDias` se leen los valores del gráfico.

`supabase/functions/pluvio/lectores/aemet.js`:

```js
// supabase/functions/pluvio/lectores/aemet.js
// AEMET OpenData, observación convencional (informe 09 §3.7): datos horarios SIN VALIDAR de las últimas 12 h de todas las
// estaciones; `prec` es la lluvia de los 60 minutos anteriores a `fint` (UTC). Dos llamadas, como la función «aemet», y
// la clave del secreto AEMET_API_KEY. Se filtra por la lista blanca.
export const URL_AEMET_TODAS = 'https://opendata.aemet.es/opendata/api/observacion/convencional/todas';

export function horaDeFint(t) {
  if (typeof t !== 'string') return null;
  const s = t.trim().replace(/\+0000$/, 'Z');
  const ms = Date.parse(/(Z|[+-]\d\d:\d\d)$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(ms) && ms % 3600e3 === 0 ? new Date(ms).toISOString() : null;
}
export function horasDeAemet(lista, codigos) {
  return (Array.isArray(lista) ? lista : []).flatMap((o) => {
    if (!codigos.has(o?.idema) || typeof o.prec !== 'number' || !Number.isFinite(o.prec)) return [];
    const hora = horaDeFint(o.fint);
    return hora ? [{ estacion: o.idema, hora, mm: o.prec }] : [];
  });
}
export async function leerAemet({ pedir, clave, estaciones }) {
  if (!clave) throw new Error('sin clave (falta el secreto AEMET_API_KEY)');
  const j1 = await pedir(URL_AEMET_TODAS, { cabeceras: { api_key: clave } });
  if (j1?.estado !== 200 || typeof j1.datos !== 'string') throw new Error(`AEMET ${j1?.estado}: ${j1?.descripcion ?? 'sin datos'}`);
  const lista = JSON.parse(new TextDecoder('iso-8859-15').decode(await pedir(j1.datos, { como: 'bytes' })));
  return { filas: horasDeAemet(lista, new Set(estaciones.map((e) => e.codigo))), errores: [], agotado: false };
}
```

- [ ] **Step 8: Manejador, entrada de Deno y lista blanca inicial**

`supabase/functions/pluvio/manejador.js`:

```js
// supabase/functions/pluvio/manejador.js
// Una ejecución de la Edge Function «pluvio» (spec §3.1) con dependencias inyectadas: qué toca a esta hora (UTC), leer con
// cortesía y guardar las horas en lluvia_obs con su fuente.
import { hoyMadrid } from '../_shared/meteo.js';
import { crearPedir, PlazoAgotado } from './red.js';
import { leerTajo } from './lectores/tajo.js';
import { leerAemet } from './lectores/aemet.js';

// Supabase corta a los 150 s: la ejecución acaba antes de PLAZO_EJECUCION y las lecturas dejan RESERVA_MS para guardar.
export const PLAZO_EJECUCION = 140000;
export const RESERVA_MS = 25000;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Qué se lee y cuándo (hora UTC de la llamada de pg_cron, minuto 10). AEMET guarda 12 h: cada 3 h da 4 ocasiones.
// Tajo: las últimas 24 h cada 3 h y, una vez al día, los 10 días que guarda sin registrarse.
export const TAREAS = {
  aemet: { fuente: 'aemet', toca: (h) => h % 3 === 0, leer: (c) => leerAemet({ ...c, clave: c.claveAemet }) },
  tajo: { fuente: 'tajo', toca: (h) => h % 3 === 1, leer: (c) => leerTajo(c) },
  tajo10: { fuente: 'tajo', toca: (h) => h === 2, leer: (c) => leerTajo({ ...c, diezDias: true }) },
};
export function fuentesQueTocan(ahora, pedidas = []) {
  const claves = Object.keys(TAREAS);
  if (pedidas.length) return claves.filter((t) => pedidas.includes(t));
  return claves.filter((t) => TAREAS[t].toca(ahora.getUTCHours(), ahora.getUTCDay()));
}
export const filaObs = (fuente, f) => ({ fuente, estacion: f.estacion, hora: f.hora, horas: f.horas ?? 1, mm: f.mm, calidad: 'bruto' });
// Postgres no deja que un upsert toque dos veces la misma fila (la hora 02:00 repetida el 25 de octubre): gana la última.
export function unicas(filas) {
  const m = new Map();
  for (const f of filas) m.set(`${f.fuente}|${f.estacion}|${f.hora}`, f);
  return [...m.values()];
}

export async function ejecutar({ almacen, fetchFn, ahora = new Date(), estaciones, pedidas = [], claveAemet = null,
  esperar = dormir, reloj = () => Date.now(), plazo = PLAZO_EJECUCION, senal }) {
  const limite = reloj() + plazo;
  const pedir = crearPedir({ fetchFn, esperar, margen: () => limite - RESERVA_MS - reloj(), ...(senal ? { senal } : {}) });
  const hoy = hoyMadrid(ahora);
  const tareas = fuentesQueTocan(ahora, pedidas);
  const r = { estado: 'hecho', tareas, filas: {}, errores: [] };
  for (const t of tareas) {
    const { fuente, leer } = TAREAS[t];
    let res;
    try {
      res = await leer({ pedir, estaciones: estaciones.filter((e) => e.fuente === fuente), claveAemet, hoy, almacen });
    } catch (e) {
      if (e instanceof PlazoAgotado) { r.estado = 'plazo-agotado'; r.errores.push(`${t}: plazo agotado`); break; }
      r.errores.push(`${t}: ${e.message}`);
      continue;
    }
    const filas = unicas(res.filas.map((f) => filaObs(fuente, f)));
    if (filas.length) await almacen.guardarObs(filas);
    r.filas[t] = filas.length;
    r.errores.push(...res.errores.map((e) => `${t}: ${e}`));
    if (res.agotado) { r.estado = 'plazo-agotado'; r.errores.push(`${t}: plazo agotado`); break; }
  }
  return r;
}

// Almacén real: tabla lluvia_obs (upsert por fuente, estación y hora, en trozos de 1.000).
export function almacenSupabase(admin) {
  const datos = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  return {
    async guardarObs(filas) {
      for (let k = 0; k < filas.length; k += 1000) datos(await admin.from('lluvia_obs').upsert(filas.slice(k, k + 1000), { onConflict: 'fuente,estacion,hora' }));
    },
  };
}
```

Comprobación de la prueba del plazo: con `reloj` que avanza 60 s por petición y `plazo` 140 s, el margen de lectura es
115 s − t. La petición de A empieza con 115 s de margen y la de B con 55 s; la de C, con −5 s → `PlazoAgotado`, y se guardan
las 46 horas de A y B.

`supabase/functions/pluvio/index.ts`:

```ts
// supabase/functions/pluvio/index.ts
// Edge Function «pluvio» (spec §3.1): la lanza pg_cron cada hora (minuto 10) con pg_net y la cabecera x-pluvio-clave
// (secreto PLUVIO_CLAVE; se despliega con --no-verify-jwt). ?fuentes=tajo10,aemet fuerza tareas concretas.
// Contesta 202 enseguida y sigue en segundo plano (EdgeRuntime.waitUntil); el plazo lo vigila el manejador.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';   // la misma versión que js/supabase.js
import ESTACIONES from './estaciones.json' with { type: 'json' };
import { ejecutar, almacenSupabase } from './manejador.js';
import { claveValida } from '../_shared/clave.js';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('método no permitido', { status: 405 });
  if (!claveValida(req.headers.get('x-pluvio-clave'), Deno.env.get('PLUVIO_CLAVE'))) return new Response('no autorizado', { status: 401 });
  const u = new URL(req.url);
  const pedidas = (u.searchParams.get('fuentes') ?? '').split(',').filter(Boolean);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const trabajo = ejecutar({ almacen: almacenSupabase(admin), fetchFn: fetch, estaciones: ESTACIONES, pedidas, claveAemet: Deno.env.get('AEMET_API_KEY') ?? null })
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => console.error(`pluvio: ${(e as Error).message}`));
  if (typeof EdgeRuntime !== 'undefined') { EdgeRuntime.waitUntil(trabajo); return new Response('en marcha', { status: 202 }); }
  await trabajo;
  return new Response('hecho');
});
```

`supabase/functions/pluvio/estaciones.json` (lista blanca inicial: las 23 de AEMET de `data/zonas.json` y los 28
pluviómetros y pluvionivómetros del SAIH Tajo a menos de 20 km de algún punto y con menos de 600 m de desnivel; la tarea 7
la regenera con todas las fuentes):

```json
[
  {"fuente":"aemet","codigo":"1103X","nombre":"San Roque de Riomiera","lat":43.2275,"lon":-3.7211,"altitud":849,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"2005Y","nombre":"Vinuesa, Quintanarejo","lat":41.9678,"lon":-2.7828,"altitud":1197,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"2182C","nombre":"Pedraza","lat":41.1339,"lon":-3.7903,"altitud":1107,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"2298","nombre":"Palacios de la Sierra","lat":41.9597,"lon":-3.1317,"altitud":1080,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"2302N","nombre":"Monterrubio de la Demanda","lat":42.1464,"lon":-3.1097,"altitud":1197,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"2430Y","nombre":"Muñotello","lat":40.5433,"lon":-5.0442,"altitud":1178,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"2462","nombre":"Puerto de Navacerrada","lat":40.7933,"lon":-4.0108,"altitud":1892,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"2930Y","nombre":"Navasfrías","lat":40.2967,"lon":-6.8128,"altitud":880,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"3013","nombre":"Molina de Aragón","lat":40.8417,"lon":-1.8789,"altitud":1062,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"3021Y","nombre":"Zaorejas","lat":40.7583,"lon":-2.1997,"altitud":1250,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"3104Y","nombre":"Rascafría","lat":40.8897,"lon":-3.8883,"altitud":1159,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"3111D","nombre":"Somosierra","lat":41.1358,"lon":-3.5803,"altitud":1454,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"3266A","nombre":"Puerto Alto del León","lat":40.7064,"lon":-4.1414,"altitud":1530,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"3305Y","nombre":"Navahermosa","lat":39.6306,"lon":-4.4769,"altitud":750,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"3319D","nombre":"Puerto del Pico","lat":40.3397,"lon":-5.0128,"altitud":1285,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"3504X","nombre":"Hervás","lat":40.265,"lon":-5.8611,"altitud":724,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"3576X","nombre":"Valencia de Alcántara","lat":39.4147,"lon":-7.2311,"altitud":444,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"4245X","nombre":"Guadalupe","lat":39.4553,"lon":-5.3333,"altitud":660,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"8096","nombre":"Cuenca","lat":40.0672,"lon":-2.1319,"altitud":949,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"8210Y","nombre":"Salvacañete","lat":40.1031,"lon":-1.5036,"altitud":1160,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"9051","nombre":"Medina de Pomar","lat":42.92,"lon":-3.4828,"altitud":580,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"9073X","nombre":"Agurain/Salvatierra, Opakua","lat":42.8297,"lon":-2.3597,"altitud":660,"licencia":"aemet"},
  {"fuente":"aemet","codigo":"9178X","nombre":"Campezo/Kanpezu","lat":42.6706,"lon":-2.3461,"altitud":570,"licencia":"aemet"},
  {"fuente":"tajo","codigo":"P_06","nombre":"Valsalobre - Peñalen","lat":40.6282,"lon":-2.0866,"altitud":1380,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhX18loXU22Nv%2FIPuYTXYDwYbw0HH4wbzsUEmPdEsm0gexjQQbZhHlppfR2ufNYjLwFVTw3Wm1irNSaur9h%2Fu%2B4s%3D"},
  {"fuente":"tajo","codigo":"P_19","nombre":"Majaelrayo","lat":41.1207,"lon":-3.2978,"altitud":1224,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbheHv4whYC%2BiBIHDNgX%2FOurMXZ%2FxKvnj6ppNvjuutNz3DcFQ4AEjXk%2BFUZqtNjBDA5edju8dM4U3DxBhlfXs99sU%3D"},
  {"fuente":"tajo","codigo":"P_25","nombre":"Navalmojada-Villavieja de Lozoya","lat":41.0226,"lon":-3.7012,"altitud":1196,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhVqI821vJrqMjoo3jwdYr9znB0PpzwOaJXrQd5OxKkGu1CeRy4Er8H0bYEq6yQOAngH72WJzXVf4JQyMGsz608A%3D"},
  {"fuente":"tajo","codigo":"P_26","nombre":"Olla del Quiñon en Bustarviejo","lat":40.847,"lon":-3.7663,"altitud":1279,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhboJeRb3QIHtW99loSIspCKNTFojbqo1rWZtKNWU7SO8GxRMZYPvYvix4vfpLCT3VtMGvORJuDzIGP5cUOg9J68%3D"},
  {"fuente":"tajo","codigo":"P_27","nombre":"Casas de la Garganta - Cruz Roja","lat":40.7559,"lon":-3.9027,"altitud":1072,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhafFM10mZoUQV3nXJ%2BjgU8LVvzBqaV2OIq6thg8NoH%2F%2Bk367rWcSKpOa8yMTCGRhiSY9epGsbq3rcoomdDxk5dk%3D"},
  {"fuente":"tajo","codigo":"P_30","nombre":"Cerro Hornillo - Cercedilla","lat":40.7378,"lon":-4.074,"altitud":1242,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhWECVaQ4ZF%2BelLEbHp0wpu1vKY7kcFMtBH7S9e2mU18qyLWQXwRvKAQ9hA9P6n8bRaQZ%2BW8g58RJTbaOmpN2E18%3D"},
  {"fuente":"tajo","codigo":"P_32","nombre":"San Pablo de los Montes","lat":39.5515,"lon":-4.3479,"altitud":911,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhSaXO1SOtJJOfe4LpMUaSEf1Z47W5BUndesBCbXNemYJ7%2BLSdho1hD4Cv6xwagp5rtn7S%2BizhlLogQiwljWtVl8%3D"},
  {"fuente":"tajo","codigo":"P_33","nombre":"Cepeda de la Mora","lat":40.4626,"lon":-5.0381,"altitud":1535,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhYUPqByo9FF8Bp2z3NwZdKZSqJGz1czj0o8gqc3nXUC9CKMT%2B5IWvuaUtsc3nYj67aCgT5tJ3mnmLoCWv8SYmRM%3D"},
  {"fuente":"tajo","codigo":"P_35","nombre":"Casas Veneros-Villanueva Deavila","lat":40.3697,"lon":-4.831,"altitud":1154,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhdITlnH%2B9aZuCqj7F145Tw41Y79ITGs0ovbwPIV9uXBQ4YzWFaEDMV9nXhziYz8BXWA3bevvI816OIgUR1ttYyo%3D"},
  {"fuente":"tajo","codigo":"P_40","nombre":"Casillas","lat":40.3238,"lon":-4.5867,"altitud":1131,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2Fyxpbhbolhc35Gs4wK7SucxVcxoY1jeorG3eZrZfZJcp08M3o5QMEivhKF77uCQUnjfIfXRmO%2Fq7p81E47CXsJPNo57Y%3D"},
  {"fuente":"tajo","codigo":"P_41","nombre":"Roblehermoso en Casavieja","lat":40.3017,"lon":-4.8015,"altitud":1259,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhXHULsqfhvQGiYidv0u%2Fe3OCPFwbV7%2B5T6nXxisq7lpdPn%2FXAWSABoASv%2B4AfMM3DnRYa4cpS5COoiHmoMMnh%2Bo%3D"},
  {"fuente":"tajo","codigo":"P_42","nombre":"El Navajo en Villarejo del Valle","lat":40.3054,"lon":-4.9904,"altitud":1145,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhbvD49FDz%2BvMDnZLBZ%2FYof8zqnB7rDBK%2BNIxjV5JbOMV5il%2FLiwe7915fr3k%2BIkV0WJF3AyCVHdKhFLex5dn7gE%3D"},
  {"fuente":"tajo","codigo":"P_43","nombre":"Fuente-Refugio en el Hornillo","lat":40.2683,"lon":-5.1228,"altitud":1145,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhQCWB%2B5RROR%2FTeeJXVQnsCkiutgFcUVwL7ZI05fjzwhW9Gnfh6gA6O25lN3xdqenfoQfjDlTYIOgAwNeMkC3D%2Bg%3D"},
  {"fuente":"tajo","codigo":"P_48","nombre":"Las Becillas - Piornal","lat":40.0996,"lon":-5.846,"altitud":1118,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhUeUcVvNoV84HD1PqBIbAs1RirIFw6Kw%2FRDZJjZ7g%2FfqD7hqmmSINivpSVxXjmNKYsAykG%2FxTFqC8dLx6gG1CkY%3D"},
  {"fuente":"tajo","codigo":"P_50","nombre":"Casas de Mindaño en Tornavacas","lat":40.2482,"lon":-5.6777,"altitud":983,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhQXD6XGWrclfzWP35DZqJWlmxX30tQFHNm2%2FifXdRX6sfiKzue%2Fs%2FTYkvZtpPszs2A1V20ukFfSKkTX03UHvvLY%3D"},
  {"fuente":"tajo","codigo":"P_52","nombre":"Eªcalvario-Baños de Montemayor","lat":40.3235,"lon":-5.8648,"altitud":807,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhZ1yGH8nqlFocFnOU3FBYd0LXEDbIWVkXZ1d8rhijQ3m681vu5FS4z4HIsqJvDA0rtBIJVn%2B%2Bqc0A5holf6cF9w%3D"},
  {"fuente":"tajo","codigo":"P_53","nombre":"Valdesangil en Bejar","lat":40.4119,"lon":-5.7672,"altitud":1048,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhXB8ClQuEnr2s7Xq8KDBIH6gaw0Ka22%2FiRUDipO272rnIhIzACX8%2F%2FAsznWDXa%2F%2FKKVaqN2LGOA9e59pgHIjUew%3D"},
  {"fuente":"tajo","codigo":"P_60","nombre":"Sierra del Salio en Gata","lat":40.2252,"lon":-6.6064,"altitud":562,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhXcarB6EwJGzHPDs1QRuWyihAMojsD5gFfWqDQrwpYVxPRzAsTnUGX3MefXNCxai0AO%2Fq%2FgmmaNSKvgvsYbVg6k%3D"},
  {"fuente":"tajo","codigo":"P_61","nombre":"Alto del Rey en Acebo","lat":40.2208,"lon":-6.6988,"altitud":572,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhXGVVhkC3HAaiBIYRgzLP3%2FenaDgpKbwG52YXhIc5Tcaq6ay78xuk%2BnfkHQnIf1VjF9SwqeljrJ67sfQ7NPcqDQ%3D"},
  {"fuente":"tajo","codigo":"PN02","nombre":"Fuente de Hocinillo en Checa","lat":40.6079,"lon":-1.7748,"altitud":1396,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhV%2FOm%2FQ5jN5vQdpQmVI2KdMdhMLqHgQLUB5u1%2F99JGd%2BH3oh0OKqy6%2BKjZ9hvJpbaBj89VOj5s%2F%2B0Al8XRbrWS4%3D"},
  {"fuente":"tajo","codigo":"PN17","nombre":"Cantalojas","lat":41.2393,"lon":-3.2578,"altitud":1320,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhbOEQkehIDlWV%2F%2FUAZ326%2FdmlrlAKfbFUCaaOrqrTVy13wJKOXEbP04RAjGXMWLcmLUhF7xC7epmSOoVXmN9Zw4%3D"},
  {"fuente":"tajo","codigo":"PN20","nombre":"Cabida - Colmenar de la Sierra","lat":41.1114,"lon":-3.3924,"altitud":1352,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhW%2BXAvCbdZCwMDJHboViZ%2Bih3GjH8fpsU9HZzTkt2KOX10%2By6OajcEL37Rmq8eQjTF6xn5WItCILxY2GeAKarrI%3D"},
  {"fuente":"tajo","codigo":"PN22","nombre":"Robregordo","lat":41.1075,"lon":-3.5782,"altitud":1428,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhXw9q6gjL9rFGH2nkw2c5%2BwSkH8bOuHFQeYv58VvxwAJvICIUwtdywWnhGBA%2BPgkUwBkMkGB5XH2SPeV0cOg1b8%3D"},
  {"fuente":"tajo","codigo":"PN23","nombre":"Depósitos (La Dehesa) Rascafria","lat":40.9106,"lon":-3.8892,"altitud":1218,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhZfevIOPgFRFT%2B9uH0wbcKM4jzSst1Gui%2F7wuLN7eTaBFrgYPrHBHYHH61drQQr2%2FfttTdEI4mvhT%2F5zZKLkwSI%3D"},
  {"fuente":"tajo","codigo":"PN24","nombre":"Albergue de la Lobera Rascafría","lat":40.8826,"lon":-3.8458,"altitud":1372,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhVz4gXvnB6vpViWa%2BqZiLr6Y7nOyRlrVqjmKwXYCVWP22cW9uLu5rHoo7FtPDSQVAgIwguiSOhe2Udp2buHYKHk%3D"},
  {"fuente":"tajo","codigo":"PN28","nombre":"La Barranca - Navacerrada","lat":40.7551,"lon":-3.9933,"altitud":1396,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhVSDGm%2BvTdAQr%2BLfXS7NxhoiwUHfLBhcYZaIxUM4gBEYTW0SF8ewoNGUi%2Bz9NjQUeVPviWS1UiWhjJxtIzdKHpc%3D"},
  {"fuente":"tajo","codigo":"PN34","nombre":"Puerto del Pico en S.martin Pimp","lat":40.3323,"lon":-5.0236,"altitud":1490,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhXxe1RN4TjrOTwkB4X7BpMWQ8sr09LiFYx6MMIQVqZCLMTHoiMESs306twfMu8QzgHWEE7%2FyBhcWWoJ0dxbnxEg%3D"},
  {"fuente":"tajo","codigo":"PN51","nombre":"Cabezuela del Valle","lat":40.2241,"lon":-5.8331,"altitud":1350,"licencia":"reutilizacion-sector-publico","url":"index.php?w=get-estacion&x=%2F4ZGs%2B6M%2BZWfvq6%2FyxpbhS5JBlfnQiA2ezSyVNiZtE4qvV5zeuM%2FfBW8t9khU8db1FnjAyr6sobegIj46dHhWQ7p0G8lwscMfIKOLQ%2B7VMM%3D"}
]
```

(El mismo contenido está en `$CAPTURAS/estaciones-tarea1.json`; si se copia de ahí, comprobar que tiene 51 entradas.)

- [ ] **Step 9: Migraciones**

`supabase/migrations/20261003000000_pluvio.sql`:

```sql
-- supabase/migrations/20261003000000_pluvio.sql
-- Lluvia medida en pluviómetros (docs/superpowers/specs/2026-10-01-pluviometros-design.md §3.1): las horas leídas de cada
-- fuente, en bruto y con su fuente. Solo escribe la Edge Function «pluvio» con la clave de servicio; anon no ve la tabla.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.lluvia_obs (
  fuente text not null,                       -- 'tajo' | 'aemet' | 'duero' | 'jucar' | 'euskalmet'
  estacion text not null,                     -- código de la estación en su fuente
  hora timestamptz not null,                  -- FIN del intervalo, en UTC
  horas smallint not null default 1,          -- horas que cubre el valor (24 = total del día, SAIH Júcar)
  mm double precision,                        -- null: sin dato
  calidad text not null default 'bruto',
  leido timestamptz not null default now(),
  primary key (fuente, estacion, hora)
);
alter table public.lluvia_obs enable row level security;
revoke all on public.lluvia_obs from anon, authenticated;
-- La Edge Function entra como service_role: permisos explícitos, sin depender de los privilegios por defecto del esquema.
grant select, insert, update, delete on public.lluvia_obs to service_role;

-- Se guardan 200 días: cubren la lluvia desde el 1 de agosto hasta el final de la temporada de otoño.
select cron.schedule('pluvio-limpieza', '40 3 * * *', $$
  delete from public.lluvia_obs where hora < now() - interval '200 days';
$$);
```

`supabase/migrations/20261003000100_pluvio_cron.sql`:

```sql
-- supabase/migrations/20261003000100_pluvio_cron.sql
-- Cada hora en el minuto 10 (UTC): la función decide qué fuentes tocan. La clave se lee de Vault al ejecutar (se crea en
-- el despliegue, tarea 2, antes de esta migración): nunca va en este archivo.
select cron.schedule('pluvio-hora', '10 * * * *', $$
  select net.http_post(
    url := 'https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/pluvio',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-pluvio-clave', (select decrypted_secret from vault.decrypted_secrets where name = 'pluvio_clave')),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000);
$$);
```

- [ ] **Step 10: Ejecutar las pruebas y verlas pasar**

Run: `node --test tests/pluvio-recolector.test.js`
Expected: PASS (19 pruebas).

Run: `npm run comprobar`
Expected: PASS (las de `rejilla` siguen pasando con `claveValida` reexportada).

- [ ] **Step 11: Commit**

```bash
git add .gitattributes supabase/functions/_shared/clave.js supabase/functions/rejilla/manejador.js supabase/functions/pluvio \
  supabase/migrations/20261003000000_pluvio.sql supabase/migrations/20261003000100_pluvio_cron.sql \
  tests/dobles-pluvio.js tests/pluvio-recolector.test.js tests/fixtures/pluvio
git commit -m "$(cat <<'EOF'
Pluviómetros: recolector mínimo (SAIH Tajo y AEMET horario) con lluvia_obs y pg_cron horario

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

Tras la revisión de esta tarea, el controlador la lleva a `main` (Global Constraints, «Ramas») antes de la tarea 2.

---

### Task 2: Despliegue del recolector mínimo  ⚠️ requiere token y autorización

> **El controlador se para al empezar esta tarea.** Hace falta un *access token* nuevo de Supabase y la **autorización explícita de la usuaria en ese momento** para: aplicar las dos migraciones, crear el secreto `PLUVIO_CLAVE` y su copia en Vault, desplegar la función `pluvio` y programar pg_cron. Sin las dos cosas no se ejecuta ningún paso y se sigue con la tarea 3 en la rama (pero se avisa: cada día que pasa se pierde un día del histórico de Tajo). El token solo vive en la variable de entorno de esa terminal; nunca en el repo, en documentos ni en commits. Se despliega desde `main`, ya con la tarea 1 integrada.

**Files:**
- Modify: `docs/supabase.md` (sección nueva «Edge Function `pluvio`»)
- Modify (solo si la usuaria aporta la clave de AEMET): `tests/fixtures/pluvio/aemet-convencional.json`

**Interfaces:**
- Consumes: tarea 1.
- Produces: tabla `lluvia_obs` y trabajos `pluvio-hora` y `pluvio-limpieza` en `ctgedeunquvmcfqsufjj`; función `pluvio` desplegada; secreto `PLUVIO_CLAVE` y Vault `pluvio_clave`.

- [ ] **Step 1: Preguntar a la usuaria y esperar**

Mensaje (en español): qué se va a crear (una tabla privada, una función programada cada hora que lee el SAIH Tajo y AEMET,
un secreto nuevo), qué gasta (unas 280 peticiones al día al SAIH Tajo y 16 a AEMET; nada de Open-Meteo), que hace falta un
token nuevo y que el SAIH Tajo solo guarda 10 días, así que cuanto antes, mejor. Preguntar también si tiene a mano la clave
de AEMET para capturar una respuesta real (paso 6; es opcional).

- [ ] **Step 2: Aplicar las migraciones**

```bash
export SUPABASE_ACCESS_TOKEN=<token nuevo que da la usuaria, solo en esta terminal>
npx --yes supabase@2.118.0 link --project-ref ctgedeunquvmcfqsufjj
npx --yes supabase@2.118.0 db push --dry-run
npx --yes supabase@2.118.0 db push
```

Expected: el `--dry-run` lista solo `20261003000000_pluvio.sql` y `20261003000100_pluvio_cron.sql`. Si lista otras, parar
y preguntar. Si `create extension` falla, activar `pg_cron` y `pg_net` en el panel (Database → Extensions) y repetir.

- [ ] **Step 3: Crear la clave, guardarla como secreto y en Vault**

```bash
CLAVE=$(node -e "console.log(crypto.randomUUID() + crypto.randomUUID())")
npx --yes supabase@2.118.0 secrets set PLUVIO_CLAVE="$CLAVE" --project-ref ctgedeunquvmcfqsufjj
npx --yes supabase@2.118.0 db query --linked "select vault.create_secret('$CLAVE', 'pluvio_clave', 'Clave de la Edge Function pluvio para pg_cron')"
```

La clave no se imprime ni se apunta; vive en `$CLAVE` mientras dure la terminal. Si se pierde, se crea otra y se
actualizan las dos copias (`select vault.update_secret(id, '<nueva>') from vault.secrets where name = 'pluvio_clave'`).

- [ ] **Step 4: Desplegar la función**

```bash
npx --yes supabase@2.118.0 functions deploy pluvio --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj
```

Expected: `Deployed Functions on project ctgedeunquvmcfqsufjj: pluvio`. Si el empaquetado no encuentra `../_shared/*.js`,
parar y anotar el error (no copiar archivos a mano).

- [ ] **Step 5: Primera lectura forzada (los 10 días de Tajo y AEMET) y comprobación**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "x-pluvio-clave: $CLAVE" "https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/pluvio?fuentes=tajo10,aemet"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/pluvio"
curl -s -o /dev/null -w "%{http_code}\n" "https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/pluvio"
npx --yes supabase@2.118.0 db query --linked "select fuente, count(distinct estacion) as estaciones, count(*) as horas, min(hora), max(hora) from public.lluvia_obs group by fuente"
```

Expected: `202`, `401`, `405` y, tras un minuto, `tajo` con unas 28 estaciones y unas 6.700 horas desde hace 10 días, y
`aemet` con unas 23 estaciones y unas 270 horas de las últimas 12 h. Si `aemet` falta, mirar el registro de la función
(`npx --yes supabase@2.118.0 functions logs pluvio --project-ref ctgedeunquvmcfqsufjj` o el panel) y anotar el error.

- [ ] **Step 6 (opcional): Respuesta real de AEMET para el doble**

Solo si la usuaria da la clave de AEMET en esta terminal (`export AEMET_API_KEY=…`):

```bash
node --input-type=module -e "
const r1 = await (await fetch('https://opendata.aemet.es/opendata/api/observacion/convencional/todas', { headers: { api_key: process.env.AEMET_API_KEY } })).json();
const l = JSON.parse(new TextDecoder('iso-8859-15').decode(await (await fetch(r1.datos)).arrayBuffer()));
const elegidas = l.filter((o) => ['3104Y', '2462', '3195'].includes(o.idema)).slice(0, 8);
console.log(JSON.stringify(elegidas, null, 1));
" > /tmp/aemet-real.json
```

Comparar los campos con `tests/fixtures/pluvio/aemet-convencional.json` (`idema`, `fint`, `prec`). Si `fint` o `prec`
tienen otro formato, adaptar `horaDeFint`/`horasDeAemet` y su prueba con la respuesta real (sustituyendo la del doble) en
un commit aparte en la rama. Si coinciden, no cambiar nada. La clave no se guarda.

- [ ] **Step 7: Comprobar pg_cron al cabo de una hora**

```bash
npx --yes supabase@2.118.0 db query --linked "select jobname, schedule, active from cron.job where jobname like 'pluvio%'"
npx --yes supabase@2.118.0 db query --linked "select status_code, created from net._http_response order by created desc limit 3"
```

Expected: `pluvio-hora` (`10 * * * *`) y `pluvio-limpieza`, activos; respuestas 202.

- [ ] **Step 8: Documentar en `docs/supabase.md`**

Añadir al final:

```markdown
## Edge Function `pluvio` (lluvia medida en pluviómetros)

- Diseño: `docs/superpowers/specs/2026-10-01-pluviometros-design.md`; plan: `docs/superpowers/plans/2026-10-02-pluviometros.md`.
- La lanza pg_cron (`pluvio-hora`, cada hora en el minuto 10 UTC) con pg_net y la cabecera `x-pluvio-clave`, que se lee de
  Vault (`pluvio_clave`) y coincide con el secreto `PLUVIO_CLAVE`. Desplegada con `--no-verify-jwt`; sin la clave responde
  401 y a un GET, 405. Usa también el secreto `AEMET_API_KEY` (el mismo de la función `aemet`).
- Qué lee y cuándo (hora UTC): AEMET horario (`/observacion/convencional/todas`, 12 h) a las 0, 3, 6…; SAIH Tajo (últimas
  24 h por estación) a la 1, 4, 7…; SAIH Tajo 10 días a las 2. Lista blanca: `supabase/functions/pluvio/estaciones.json`.
- Tabla privada `lluvia_obs` (fuente, estación, hora UTC del fin del intervalo, mm, calidad); se guardan 200 días
  (`pluvio-limpieza`, 03:40 UTC).
- Forzar una lectura: `curl -X POST -H "x-pluvio-clave: <clave>" ".../functions/v1/pluvio?fuentes=tajo10,aemet"`.
- Despliegue: `npx --yes supabase@2.118.0 functions deploy pluvio --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj`.
- Desplegada el AAAA-MM-DD; primer dato de Tajo: AAAA-MM-DD (rellenar con las fechas reales).
```

Sustituir las dos fechas por las reales antes del commit. Recordar a la usuaria que revoque el token al terminar.

- [ ] **Step 9: Commit (en `main`) y subir**

```bash
git add docs/supabase.md
git commit -m "$(cat <<'EOF'
Supabase: función pluvio desplegada (SAIH Tajo y AEMET horario cada hora) y documentada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
git push origin main
```

El gancho pre-push ejecuta `npm run comprobar`. Después, en el worktree: `git merge main` (avance rápido) para que la rama
tenga el commit de documentación.

---

### Task 3: Lector del SAIH Duero (histórico horario de unos 90 días)

Se trabaja ya en la rama `pluviometros` del worktree.

**Files:**
- Create: `supabase/functions/pluvio/lectores/duero.js`
- Modify: `supabase/functions/pluvio/manejador.js` (tareas `duero` y `duero90`)
- Create: `tests/pluvio-duero.test.js`, `tests/fixtures/pluvio/duero-*.html` (5 archivos)

**Interfaces:**
- Consumes: `horaDeTexto`, `fechaMadridDeFin` (tarea 1); `PlazoAgotado`, `pedir` (tarea 1); `agostoDe`, `sumarDias` de `_shared/meteo.js`.
- Produces: `BASE_DUERO`, `estacionesDeRisr(html) → [{ codigo, nombre, lat, lon }]`, `historicoDeFicha(html, codigo) → token|null`, `altitudDeFicha(html) → number|null`, `esHistoricoDeLluvia(html) → boolean`, `horasDeHistorico(html, codigo) → filas`, `leerDuero({ pedir, estaciones, desde }) → { filas, errores, agotado }`. Una estación de Duero en la lista blanca lleva `token`. `DIAS_DUERO = 4`. Tareas nuevas: `duero` (3 y 15 UTC, desde hoy − 4 días) y `duero90` (domingo a la 1 UTC, desde el 1 de agosto).

- [ ] **Step 1: Copiar las respuestas reales**

```bash
CAPTURAS="C:/Users/ALEJAN~1.ALE/AppData/Local/Temp/claude/C--Users-Alejandra-ALEJANDRA-P-Las-Gordillas/34bb25e7-93eb-4527-9cc6-e4b60f2fcfa8/scratchpad/pluvio/fixtures"
cp "$CAPTURAS"/duero-risr.html "$CAPTURAS"/duero-ficha-PL002.html "$CAPTURAS"/duero-ficha-PL031.html \
   "$CAPTURAS"/duero-historico-PL002.html "$CAPTURAS"/duero-historico-PL031.html tests/fixtures/pluvio/
```

(`duero-risr.html` es el bloque `datosPL` de la página de tiempo real; los dos `duero-historico-*` son el bloque
`chartData` de la página del histórico con sus títulos; las fichas, enteras. PL002 es Covaleda y PL031, Quintanar de la
Sierra, que el 02/10 estaba sin servicio: su ficha ya no trae el histórico.)

- [ ] **Step 2: Escribir las pruebas que fallan**

`tests/pluvio-duero.test.js`:

```js
// tests/pluvio-duero.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estacionesDeRisr, historicoDeFicha, altitudDeFicha, esHistoricoDeLluvia, horasDeHistorico, leerDuero } from '../supabase/functions/pluvio/lectores/duero.js';
import { crearPedir } from '../supabase/functions/pluvio/red.js';
import { fechaMadridDeFin } from '../supabase/functions/pluvio/tiempo.js';
import { fuentesQueTocan, ejecutar } from '../supabase/functions/pluvio/manejador.js';
import { fixture, respuesta, servidorFalso, almacenPluvioMemoria } from './dobles-pluvio.js';

const sinEspera = async () => {};
const r1 = (x) => Math.round(x * 10) / 10;
const delDia = (filas, fecha) => {
  const f = filas.filter((h) => fechaMadridDeFin(h.hora) === fecha && h.mm != null);
  return { mm: r1(f.reduce((t, h) => t + h.mm, 0)), horas: f.length };
};
const PL002 = { fuente: 'duero', codigo: 'PL002', token: 'xADTQNURfJDMwwEU' };
const PL031 = { fuente: 'duero', codigo: 'PL031', token: 'xADTQNURfFzMwwEU' };
const rutasDuero = (antes = []) => [...antes,
  [(u) => u.endsWith('/risr/PL002/historico/xADTQNURfJDMwwEU'), () => respuesta(200, fixture('duero-historico-PL002.html'))],
  [(u) => u.endsWith('/risr/PL031/historico/xADTQNURfFzMwwEU'), () => respuesta(200, fixture('duero-historico-PL031.html'))],
  [(u) => u.endsWith('/risr/PL002'), () => respuesta(200, fixture('duero-ficha-PL002.html'))],
  [(u) => u.endsWith('/risr/PL031'), () => respuesta(200, fixture('duero-ficha-PL031.html'))],
];
const pedirCon = (rutas) => crearPedir({ fetchFn: servidorFalso(rutas), esperar: sinEspera });

test('tiempo real: 221 estaciones (71 pluviómetros PL) con coordenadas', () => {
  const l = estacionesDeRisr(fixture('duero-risr.html'));
  assert.equal(l.length, 221);
  assert.equal(l.filter((e) => e.codigo.startsWith('PL')).length, 71);
  assert.deepEqual(l.find((e) => e.codigo === 'PL002'), { codigo: 'PL002', nombre: 'Covaleda, PL-47', lat: 41.95236236, lon: -2.87212741 });
  assert.throws(() => estacionesDeRisr('<html></html>'), /datosPL/);
});

test('ficha: el token del histórico de LLUVIA (no el de temperatura) y la altitud; una estación caída no los trae', () => {
  const f = fixture('duero-ficha-PL002.html');
  assert.equal(historicoDeFicha(f, 'PL002'), 'xADTQNURfJDMwwEU');
  assert.equal(altitudDeFicha(f), 1445);
  assert.equal(historicoDeFicha(fixture('duero-ficha-PL031.html'), 'PL031'), null);
  assert.equal(altitudDeFicha(fixture('duero-ficha-PL031.html')), null);
});

test('histórico: valores horarios en hora de Madrid pasados a UTC (fin de la hora)', () => {
  const filas = horasDeHistorico(fixture('duero-historico-PL002.html'), 'PL002');
  assert.equal(filas.length, 2121);
  assert.deepEqual(filas[0], { estacion: 'PL002', hora: '2026-07-03T22:00:00.000Z', mm: 120 });   // valor de mantenimiento: lo marca la tarea 8
  assert.deepEqual(delDia(filas, '2026-08-27'), { mm: 3.8, horas: 24 });
  assert.deepEqual(delDia(filas, '2026-09-17'), { mm: 0, horas: 15 });
  const q = horasDeHistorico(fixture('duero-historico-PL031.html'), 'PL031');
  assert.deepEqual(delDia(q, '2026-08-27'), { mm: 551.9, horas: 24 });   // Quintanar de la Sierra: el pico falso del informe 09
  assert.deepEqual(delDia(q, '2026-09-30'), { mm: 186.6, horas: 16 });
});

// Review Focus 2: una página con otra gráfica (temperatura) o sin gráfica no es un histórico de lluvia.
test('una página sin el título de pluviometría no es un histórico de lluvia', () => {
  assert.equal(esHistoricoDeLluvia(fixture('duero-historico-PL002.html')), true);
  assert.equal(esHistoricoDeLluvia("<script>// title: 'Temperatura ambiente'\nvar chartData = [{d:\"01/10/2026 10:00\", v:12.3}];</script>"), false);
  assert.equal(esHistoricoDeLluvia('<html>mantenimiento</html>'), false);
});

test('leerDuero: con el token guardado y solo desde la fecha pedida', async () => {
  const r = await leerDuero({ pedir: pedirCon(rutasDuero()), estaciones: [PL002, PL031], desde: '2026-09-28' });
  assert.deepEqual(r.errores, []);
  assert.ok(r.filas.every((f) => fechaMadridDeFin(f.hora) >= '2026-09-28'));
  assert.equal(r.filas.filter((f) => f.estacion === 'PL002').length, 76);
  assert.equal(r.filas.filter((f) => f.estacion === 'PL031').length, 64);
});

test('leerDuero: si el token guardado ya no vale lo busca en la ficha; sin histórico, error y sigue', async () => {
  const r = await leerDuero({ pedir: pedirCon(rutasDuero()), estaciones: [{ ...PL031, token: 'viejo' }, { ...PL002, token: 'viejo' }], desde: '2026-09-28' });
  assert.deepEqual(r.errores, ['PL031: sin histórico de lluvia en la ficha']);
  assert.equal(r.filas.length, 76);
});

test('Review Focus 2: el histórico contesta 200 con la gráfica de temperatura → error, ni una fila', async () => {
  const temperatura = "<script>// title: 'Temperatura ambiente'\nvar chartData = [{d:\"01/10/2026 10:00\", v:12.3}];</script>";
  const rutas = rutasDuero([[(u) => u.endsWith('/historico/xADTQNURfJDMwwEU'), () => respuesta(200, temperatura)]]);
  const r = await leerDuero({ pedir: pedirCon(rutas), estaciones: [PL002], desde: '2026-09-28' });
  assert.deepEqual(r.filas, []);
  assert.deepEqual(r.errores, ['PL002: sin histórico de lluvia']);
});

test('qué toca: Duero a las 3 y a las 15 UTC; los 90 días, el domingo a la 1', () => {
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T03:10:00Z')), ['aemet', 'duero']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T15:10:00Z')), ['aemet', 'duero']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-04T01:10:00Z')), ['tajo', 'duero90']);   // domingo
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-05T01:10:00Z')), ['tajo']);
});

test('ejecutar: duero guarda desde hace 4 días; duero90, desde el 1 de agosto', async () => {
  const ahora = new Date('2026-10-02T03:10:00Z');
  const a = almacenPluvioMemoria();
  const r = await ejecutar({ almacen: a, fetchFn: servidorFalso(rutasDuero()), esperar: sinEspera, ahora, estaciones: [PL002], pedidas: ['duero'] });
  assert.deepEqual(r.filas, { duero: 76 });
  const b = almacenPluvioMemoria();
  await ejecutar({ almacen: b, fetchFn: servidorFalso(rutasDuero()), esperar: sinEspera, ahora, estaciones: [PL002], pedidas: ['duero90'] });
  assert.equal(b.obs.size, 1448);
  assert.equal(b.obs.get('duero|PL002|2026-08-27T11:00:00.000Z').fuente, 'duero');
});
```

Comprobación: `2026-08-27T11:00:00.000Z` es «27/08/2026 13:00» de Madrid, una hora que existe en el histórico de PL002.

- [ ] **Step 3: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-duero.test.js`
Expected: FAIL con `Cannot find module …/lectores/duero.js`.

- [ ] **Step 4: Escribir el lector**

`supabase/functions/pluvio/lectores/duero.js`:

```js
// supabase/functions/pluvio/lectores/duero.js
// SAIH Duero (CHD), sin clave (informe 09 §3.1). La página de tiempo real (array JS `datosPL`) da código, nombre y
// coordenadas; la ficha de cada estación, la altitud (Z) y el enlace a su histórico, con un token por sensor; el histórico
// es una gráfica amCharts con unos 90 días de valores HORARIOS en hora de Madrid ({d:"02/07/2026 11:00", v:0.0}).
// La red no filtra los datos (picos de mantenimiento de 120 mm): los marca el control de calidad (tarea 8).
import { horaDeTexto, fechaMadridDeFin } from '../tiempo.js';
import { PlazoAgotado } from '../red.js';

export const BASE_DUERO = 'https://www.saihduero.es/';

export function estacionesDeRisr(html) {
  const ini = html.indexOf('datosPL = new Array(');
  if (ini === -1) throw new Error('SAIH Duero: la página de tiempo real no trae datosPL');
  const cuerpo = html.slice(ini, html.indexOf(');', ini));
  return [...cuerpo.matchAll(/\{\s*id:\s*'([A-Z]{2}\d{3})',\s*station:\s*'((?:[^'\\]|\\.)*)',[^}]*?lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)/g)]
    .map((m) => ({ codigo: m[1], nombre: m[2].replace(/\\'/g, "'"), lat: Number(m[3]), lon: Number(m[4]) }));
}
// En la ficha, la fila «Pluviometría» de la tabla de tiempo real enlaza su histórico (la de temperatura va antes).
export function historicoDeFicha(html, codigo) {
  return html.match(new RegExp(`<td>Pluviometr[^<]*</td>[\\s\\S]*?risr/${codigo}/historico/([A-Za-z0-9]+)`))?.[1] ?? null;
}
export function altitudDeFicha(html) {
  const z = html.match(/<strong>Z<\/strong>\s*<br>\s*<p class="text-muted">([\d.]+)<\/p>/)?.[1];
  return z ? Number(z.replace(/\./g, '')) : null;   // «1.445» → 1445
}
export const esHistoricoDeLluvia = (html) => /title: 'Pluviometr/.test(html) && html.includes('chartData');
export function horasDeHistorico(html, codigo) {
  return [...html.matchAll(/\{d:"(\d\d\/\d\d\/\d{4} \d\d:\d\d)",\s*v:([^}]*)\}/g)].flatMap((m) => {
    const hora = horaDeTexto(m[1]);
    if (!hora) return [];
    const v = Number(m[2]);
    return [{ estacion: codigo, hora, mm: Number.isFinite(v) ? v : null }];
  });
}

const intento = async (f) => { try { return await f(); } catch (e) { if (e instanceof PlazoAgotado) throw e; return null; } };
const urlHistorico = (codigo, token) => `${BASE_DUERO}risr/${codigo}/historico/${token}`;

// Una petición por estación (dos si el token guardado ya no vale: la ficha y el histórico nuevo).
export async function leerDuero({ pedir, estaciones, desde }) {
  const filas = [], errores = [];
  const horasCon = async (codigo, token) => {
    const html = await intento(() => pedir(urlHistorico(codigo, token), { como: 'texto' }));
    return html && esHistoricoDeLluvia(html) ? horasDeHistorico(html, codigo) : [];
  };
  for (const e of estaciones) {
    try {
      let horas = e.token ? await horasCon(e.codigo, e.token) : [];
      if (!horas.length) {
        const token = historicoDeFicha(await pedir(`${BASE_DUERO}risr/${e.codigo}`, { como: 'texto' }), e.codigo);
        if (!token) throw new Error('sin histórico de lluvia en la ficha');
        if (token === e.token) throw new Error('sin histórico de lluvia');
        horas = await horasCon(e.codigo, token);
        if (!horas.length) throw new Error('sin histórico de lluvia');
      }
      filas.push(...horas.filter((h) => fechaMadridDeFin(h.hora) >= desde));
    } catch (err) {
      if (err instanceof PlazoAgotado) return { filas, errores, agotado: true };
      errores.push(`${e.codigo}: ${err.message}`);
    }
  }
  return { filas, errores, agotado: false };
}
```

- [ ] **Step 5: Añadir las tareas al manejador**

En `supabase/functions/pluvio/manejador.js`, cambiar los imports y `TAREAS`:

```js
import { hoyMadrid, agostoDe, sumarDias } from '../_shared/meteo.js';
import { crearPedir, PlazoAgotado } from './red.js';
import { leerTajo } from './lectores/tajo.js';
import { leerAemet } from './lectores/aemet.js';
import { leerDuero } from './lectores/duero.js';
```

```js
// Duero guarda unos 90 días: dos lecturas al día de los últimos DIAS_DUERO bastan, y una vez a la semana se repasa desde
// el 1 de agosto (por si una caída larga dejó huecos).
export const DIAS_DUERO = 4;

// Qué se lee y cuándo (hora UTC de la llamada de pg_cron, minuto 10). AEMET guarda 12 h: cada 3 h da 4 ocasiones.
// Tajo: las últimas 24 h cada 3 h y, una vez al día, los 10 días que guarda sin registrarse.
export const TAREAS = {
  aemet: { fuente: 'aemet', toca: (h) => h % 3 === 0, leer: (c) => leerAemet({ ...c, clave: c.claveAemet }) },
  tajo: { fuente: 'tajo', toca: (h) => h % 3 === 1, leer: (c) => leerTajo(c) },
  tajo10: { fuente: 'tajo', toca: (h) => h === 2, leer: (c) => leerTajo({ ...c, diezDias: true }) },
  duero: { fuente: 'duero', toca: (h) => h === 3 || h === 15, leer: (c) => leerDuero({ ...c, desde: sumarDias(c.hoy, -DIAS_DUERO) }) },
  duero90: { fuente: 'duero', toca: (h, d) => h === 1 && d === 0, leer: (c) => leerDuero({ ...c, desde: agostoDe(c.hoy) }) },
};
```

- [ ] **Step 6: Ejecutar las pruebas y verlas pasar**

Run: `node --test tests/pluvio-duero.test.js tests/pluvio-recolector.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/pluvio/lectores/duero.js supabase/functions/pluvio/manejador.js tests/pluvio-duero.test.js tests/fixtures/pluvio/duero-*.html
git commit -m "$(cat <<'EOF'
Pluviómetros: lector del SAIH Duero (histórico horario, token de la ficha) y sus tareas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 4: Lluvia por día: tabla `lluvia_dia`, función SQL `lluvia_por_dia` y paso `publicar` (primera parte)

**Files:**
- Create: `supabase/migrations/20261004000000_lluvia_dia.sql`
- Create: `supabase/functions/pluvio/dias.js`, `supabase/functions/pluvio/calidad.js`, `supabase/functions/pluvio/publicar.js`
- Modify: `supabase/functions/pluvio/manejador.js` (paso `publicar`, bucle de tareas y almacén)
- Modify: `tests/dobles-pluvio.js` (`almacenPluvioMemoria`: `dias`, `diasPorEstacion`, `guardarDias`)
- Create: `tests/pluvio-dias.test.js`

**Interfaces:**
- Consumes: `fechaMadridDeFin`, `horaDeTexto` (tarea 1); `filaObs`, `unicas` (tarea 1); `horasDeHistorico` (tarea 3).
- Produces:
  - SQL `public.lluvia_por_dia(p_desde date) → (fuente, estacion, fechas date[], mm double precision[], horas smallint[], maximo double precision[])`.
  - Tabla `lluvia_dia(fuente, estacion, fecha, mm, horas, maximo, calidad, motivo, actualizado)`.
  - `dias.js`: `agregarHoras(filas, desde) → [{ fuente, estacion, fecha, mm, horas, maximo }]` (referencia JS de la SQL), `diasDeFilas(filasRpc) → igual`.
  - `calidad.js` (primera versión): `UMBRALES = { horasMinimas: 20 }`, `revisarDia(dia) → { calidad: 'ok'|'incompleto'|'sin-dato', motivo }`, `revisarDias(dias)`.
  - `publicar.js` (primera versión): `publicar({ almacen, hoy, ahora, estaciones }) → { dias }`.
  - Manejador: una entrada de `TAREAS` puede tener `paso(ctx)` en lugar de `leer`; `MINIMO_PASO_MS = 15000`; el resultado de `ejecutar` lleva `pasos`. Tarea `publicar` a las 4 y 16 UTC. Almacén: `diasPorEstacion(desde)`, `guardarDias(filas)`.

- [ ] **Step 1: Ampliar el almacén en memoria**

En `tests/dobles-pluvio.js`, sustituir `almacenPluvioMemoria` por:

```js
// Almacén en memoria con la interfaz de almacenSupabase. Como Postgres, un upsert que toca dos veces la misma fila falla.
// diasPorEstacion devuelve lo mismo que la función SQL lluvia_por_dia (un array por columna y estación).
export function almacenPluvioMemoria() {
  const obs = new Map(), dias = new Map();
  return {
    obs, dias,
    async guardarObs(filas) {
      const claves = filas.map((f) => `${f.fuente}|${f.estacion}|${f.hora}`);
      if (new Set(claves).size !== claves.length) throw new Error('ON CONFLICT DO UPDATE command cannot affect row a second time');
      filas.forEach((f, k) => obs.set(claves[k], { ...f }));
    },
    async diasPorEstacion(desde) {
      const r = new Map();
      for (const d of agregarHoras([...obs.values()], desde)) {
        const k = `${d.fuente}|${d.estacion}`;
        if (!r.has(k)) r.set(k, { fuente: d.fuente, estacion: d.estacion, fechas: [], mm: [], horas: [], maximo: [] });
        const x = r.get(k);
        x.fechas.push(d.fecha); x.mm.push(d.mm); x.horas.push(d.horas); x.maximo.push(d.maximo);
      }
      return [...r.values()];
    },
    async guardarDias(filas) { for (const f of filas) dias.set(`${f.fuente}|${f.estacion}|${f.fecha}`, { ...f }); },
  };
}
```

y añadir arriba: `import { agregarHoras } from '../supabase/functions/pluvio/dias.js';`

- [ ] **Step 2: Escribir las pruebas que fallan**

`tests/pluvio-dias.test.js`:

```js
// tests/pluvio-dias.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agregarHoras, diasDeFilas } from '../supabase/functions/pluvio/dias.js';
import { revisarDia } from '../supabase/functions/pluvio/calidad.js';
import { horaDeTexto, finDeDia } from '../supabase/functions/pluvio/tiempo.js';
import { horasDeHistorico } from '../supabase/functions/pluvio/lectores/duero.js';
import { ejecutar, fuentesQueTocan, filaObs, unicas } from '../supabase/functions/pluvio/manejador.js';
import { fixture, servidorFalso, respuesta, rutasTajo, almacenPluvioMemoria } from './dobles-pluvio.js';

const duero = (codigo) => horasDeHistorico(fixture(`duero-historico-${codigo}.html`), codigo).map((h) => filaObs('duero', h));
const delDia = (dias, estacion, fecha) => dias.find((d) => d.estacion === estacion && d.fecha === fecha);
const sinEspera = async () => {};

test('agregación por día de Madrid: Quintanar, el 27/08 y el 30/09 (casos reales)', () => {
  const dias = agregarHoras(duero('PL031'), '2026-08-01');
  assert.deepEqual(delDia(dias, 'PL031', '2026-08-27'), { fuente: 'duero', estacion: 'PL031', fecha: '2026-08-27', mm: 551.9, horas: 24, maximo: 120 });
  assert.deepEqual(delDia(dias, 'PL031', '2026-09-30'), { fuente: 'duero', estacion: 'PL031', fecha: '2026-09-30', mm: 186.6, horas: 16, maximo: 81.9 });
  assert.ok(dias.every((d) => d.fecha >= '2026-08-01'));
});

test('agregación: un negativo o un nulo no suman ni cuentan; un total diario (Júcar) vale 24 horas y no da máximo horario', () => {
  const h = (hora, mm, horas = 1) => ({ fuente: 'f', estacion: 'e', hora, horas, mm });
  const dias = agregarHoras([h('2026-09-29T08:00:00.000Z', -1), h('2026-09-29T09:00:00.000Z', null), h('2026-09-29T10:00:00.000Z', 2),
    { fuente: 'jucar', estacion: '5N02', hora: finDeDia('2026-09-30'), horas: 24, mm: 1.6 }], '2026-09-01');
  assert.deepEqual(delDia(dias, 'e', '2026-09-29'), { fuente: 'f', estacion: 'e', fecha: '2026-09-29', mm: 2, horas: 1, maximo: 2 });
  assert.deepEqual(delDia(dias, '5N02', '2026-09-30'), { fuente: 'jucar', estacion: '5N02', fecha: '2026-09-30', mm: 1.6, horas: 24, maximo: null });
});

test('diasDeFilas: de un array por columna (lluvia_por_dia) a una fila por día', () => {
  assert.deepEqual(diasDeFilas([{ fuente: 'duero', estacion: 'PL002', fechas: ['2026-09-29', '2026-09-30'], mm: [0, 0.30000000000000004], horas: [24, 23], maximo: [0, 0.2] }]), [
    { fuente: 'duero', estacion: 'PL002', fecha: '2026-09-29', mm: 0, horas: 24, maximo: 0 },
    { fuente: 'duero', estacion: 'PL002', fecha: '2026-09-30', mm: 0.3, horas: 23, maximo: 0.2 }]);
});

test('revisarDia: día completo, incompleto (menos de 20 horas) y sin dato', () => {
  assert.deepEqual(revisarDia({ mm: 3.8, horas: 24, maximo: 1.7 }), { calidad: 'ok', motivo: null });
  assert.deepEqual(revisarDia({ mm: 0, horas: 15, maximo: 0 }), { calidad: 'incompleto', motivo: 'solo 15 horas con dato' });
  assert.deepEqual(revisarDia({ mm: null, horas: 0, maximo: null }), { calidad: 'sin-dato', motivo: 'ninguna hora con dato' });
});

// Review Focus 1: el 25 de octubre tiene 25 horas en Madrid; la repetida se queda en una y el día cuenta entero.
test('cambio de hora: el 25/10 con la hora 02:00 repetida queda completo', () => {
  const textos = Array.from({ length: 23 }, (_, k) => `25/10/2026 ${String(k + 1).padStart(2, '0')}:00`).concat(['25/10/2026 02:00', '26/10/2026 00:00']);
  const filas = unicas(textos.map((t) => filaObs('tajo', { estacion: 'P_26', hora: horaDeTexto(t), mm: 0.1 })));
  assert.equal(filas.length, 24);
  const [dia] = agregarHoras(filas, '2026-10-25');
  assert.equal(dia.fecha, '2026-10-25');
  assert.equal(revisarDia(dia).calidad, 'ok');
});

test('qué toca: el paso publicar a las 4 y a las 16 UTC, después de las lecturas', () => {
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T04:10:00Z')), ['tajo', 'publicar']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T16:10:00Z')), ['tajo', 'publicar']);
});

test('publicar: guarda lluvia_dia desde el 1 de agosto hasta ayer, solo de la lista blanca', async () => {
  const almacen = almacenPluvioMemoria();
  await almacen.guardarObs([...duero('PL002'), filaObs('duero', { estacion: 'FUERA', hora: '2026-09-29T10:00:00.000Z', mm: 5 })]);
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([]), esperar: sinEspera, ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: [{ fuente: 'duero', codigo: 'PL002' }], pedidas: ['publicar'] });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.pasos.publicar, { dias: 61 });   // del 01/08 al 30/09: el 01/10 PL002 no tiene datos y el 02/10 es hoy
  assert.equal(almacen.dias.get('duero|PL002|2026-09-17').calidad, 'incompleto');
  assert.equal(almacen.dias.get('duero|PL002|2026-08-27').mm, 3.8);
  assert.equal(almacen.dias.get('duero|PL002|2026-08-27').actualizado, '2026-10-02T04:10:00.000Z');
  assert.equal(almacen.dias.has('duero|FUERA|2026-09-29'), false);
});

test('si las lecturas agotan su plazo, el paso publicar se hace igual con el tiempo que queda', async () => {
  let t = 0;
  const fetchFn = async (url) => { t += 60000; return servidorFalso(rutasTajo())(url); };
  const est = ['A', 'B', 'C'].map((c) => ({ fuente: 'tajo', codigo: c, url: 'index.php?w=get-estacion&x=ok' }));
  const r = await ejecutar({ almacen: almacenPluvioMemoria(), fetchFn, esperar: sinEspera, reloj: () => t, estaciones: est,
    ahora: new Date('2026-10-02T04:10:00Z'), pedidas: ['tajo', 'publicar'] });
  assert.equal(r.estado, 'plazo-agotado');
  assert.ok(r.pasos.publicar, 'quedan 20 s: da para agregar y guardar');
});

test('la migración: lluvia_dia cerrada, la función SQL con el día de Madrid y solo para service_role', () => {
  const sql = readFileSync('supabase/migrations/20261004000000_lluvia_dia.sql', 'utf8');
  assert.match(sql, /alter table public\.lluvia_dia enable row level security/);
  assert.doesNotMatch(sql, /create policy/);
  assert.match(sql, /revoke all on public\.lluvia_dia from anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on public\.lluvia_dia to service_role/);
  assert.match(sql, /\(o\.hora - interval '1 minute'\) at time zone 'Europe\/Madrid'/);
  assert.match(sql, /filter \(where o\.mm >= 0\)/);
  assert.match(sql, /grant execute on function public\.lluvia_por_dia\(date\) to service_role/);
  assert.match(sql, /cron\.schedule\('pluvio-limpieza'/);
  assert.doesNotMatch(sql, /sb_secret|eyJ/);
});
```

- [ ] **Step 3: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-dias.test.js`
Expected: FAIL con `Cannot find module …/pluvio/dias.js`.

- [ ] **Step 4: Migración**

`supabase/migrations/20261004000000_lluvia_dia.sql`:

```sql
-- supabase/migrations/20261004000000_lluvia_dia.sql
-- Lluvia por día de Madrid de cada estación, con su control de calidad (spec §3.1 y §3.2). Privada como lluvia_obs.
create table public.lluvia_dia (
  fuente text not null,
  estacion text not null,
  fecha date not null,                        -- día de Madrid
  mm double precision,
  horas smallint not null default 0,          -- horas con dato (un total diario vale 24)
  maximo double precision,                    -- mayor lluvia horaria
  calidad text not null,                      -- 'ok' | 'incompleto' | 'sospechoso' | 'sin-dato'
  motivo text,
  actualizado timestamptz not null default now(),
  primary key (fuente, estacion, fecha)
);
alter table public.lluvia_dia enable row level security;
revoke all on public.lluvia_dia from anon, authenticated;
grant select, insert, update, delete on public.lluvia_dia to service_role;

-- Lluvia por día de Madrid de cada estación desde p_desde, con un array por columna (una fila por estación, para no topar
-- con el máximo de filas de la API). Igual que agregarHoras de supabase/functions/pluvio/dias.js: cada valor es del día de
-- su fin menos un minuto; solo suman los valores >= 0; `horas` suma las horas que cubre cada valor; `maximo`, la mayor
-- lluvia horaria.
create function public.lluvia_por_dia(p_desde date)
returns table (fuente text, estacion text, fechas date[], mm double precision[], horas smallint[], maximo double precision[])
language sql stable set search_path = public as $$
  with d as (
    select o.fuente as f, o.estacion as e, ((o.hora - interval '1 minute') at time zone 'Europe/Madrid')::date as dia,
      sum(o.mm) filter (where o.mm >= 0) as total,
      coalesce(sum(o.horas) filter (where o.mm >= 0), 0)::smallint as n,
      max(o.mm) filter (where o.mm >= 0 and o.horas = 1) as pico
    from public.lluvia_obs o
    where o.hora > (p_desde::timestamp at time zone 'Europe/Madrid')
    group by 1, 2, 3)
  select d.f, d.e, array_agg(d.dia order by d.dia), array_agg(d.total order by d.dia), array_agg(d.n order by d.dia), array_agg(d.pico order by d.dia)
  from d group by d.f, d.e;
$$;
revoke all on function public.lluvia_por_dia(date) from public, anon, authenticated;
grant execute on function public.lluvia_por_dia(date) to service_role;

-- La limpieza cubre también lluvia_dia (400 días). cron.schedule con el mismo nombre sustituye el trabajo.
select cron.schedule('pluvio-limpieza', '40 3 * * *', $$
  delete from public.lluvia_obs where hora < now() - interval '200 days';
  delete from public.lluvia_dia where fecha < current_date - 400;
$$);
```

- [ ] **Step 5: `dias.js`, `calidad.js` y `publicar.js`**

`supabase/functions/pluvio/dias.js`:

```js
// supabase/functions/pluvio/dias.js
// Lluvia por día de Madrid de cada estación. La función SQL lluvia_por_dia (migración 20261004000000) hace lo mismo en la
// base de datos; agregarHoras es su referencia en JS (la usan las pruebas y el almacén en memoria) y diasDeFilas pasa su
// salida (un array por columna y estación) a una fila por día.
import { fechaMadridDeFin } from './tiempo.js';

const r1 = (x) => Math.round(x * 10) / 10;

export function agregarHoras(filas, desde) {
  const dias = new Map();
  for (const f of filas) {
    const fecha = fechaMadridDeFin(f.hora);
    if (fecha < desde) continue;
    const k = `${f.fuente}|${f.estacion}|${fecha}`;
    const d = dias.get(k) ?? { fuente: f.fuente, estacion: f.estacion, fecha, mm: null, horas: 0, maximo: null };
    if (typeof f.mm === 'number' && Number.isFinite(f.mm) && f.mm >= 0) {
      const horas = f.horas ?? 1;
      d.mm = r1((d.mm ?? 0) + f.mm);
      d.horas += horas;
      if (horas === 1) d.maximo = Math.max(d.maximo ?? 0, f.mm);
    }
    dias.set(k, d);
  }
  return [...dias.values()].sort((a, b) => a.fuente.localeCompare(b.fuente) || a.estacion.localeCompare(b.estacion) || a.fecha.localeCompare(b.fecha));
}
export function diasDeFilas(filas) {
  return (filas ?? []).flatMap((f) => (f.fechas ?? []).map((fecha, k) => ({ fuente: f.fuente, estacion: f.estacion, fecha: String(fecha).slice(0, 10),
    mm: f.mm?.[k] == null ? null : r1(f.mm[k]), horas: f.horas?.[k] ?? 0, maximo: f.maximo?.[k] ?? null })));
}
```

`supabase/functions/pluvio/calidad.js` (primera versión; la tarea 8 la completa):

```js
// supabase/functions/pluvio/calidad.js
// Control de calidad de la lluvia medida (spec §3.2): todos los umbrales viven aquí. Por ahora, el día incompleto.
export const UMBRALES = Object.freeze({ horasMinimas: 20 });

export function revisarDia(dia, u = UMBRALES) {
  if (dia.mm == null || !dia.horas) return { calidad: 'sin-dato', motivo: 'ninguna hora con dato' };
  if (dia.horas < u.horasMinimas) return { calidad: 'incompleto', motivo: `solo ${dia.horas} horas con dato` };
  return { calidad: 'ok', motivo: null };
}
export const revisarDias = (dias) => dias.map((d) => ({ ...d, ...revisarDia(d) }));
```

`supabase/functions/pluvio/publicar.js` (primera versión; las tareas 8 y 10 la completan):

```js
// supabase/functions/pluvio/publicar.js
// Paso de «pluvio» a las 4 y a las 16 UTC, tras las lecturas: agrega las horas por día de Madrid desde el 1 de agosto,
// aplica el control de calidad y guarda lluvia_dia. Solo días ya cerrados (hasta ayer) y estaciones de la lista blanca.
import { agostoDe, sumarDias } from '../_shared/meteo.js';
import { diasDeFilas } from './dias.js';
import { revisarDias } from './calidad.js';

export async function publicar({ almacen, hoy, ahora, estaciones }) {
  const desde = agostoDe(hoy), hasta = sumarDias(hoy, -1);
  const conocidas = new Set(estaciones.map((e) => `${e.fuente}:${e.codigo}`));
  const dias = diasDeFilas(await almacen.diasPorEstacion(desde)).filter((d) => d.fecha <= hasta && conocidas.has(`${d.fuente}:${d.estacion}`));
  const revisados = revisarDias(dias);
  await almacen.guardarDias(revisados.map((d) => ({ ...d, actualizado: ahora.toISOString() })));
  return { dias: revisados.length };
}
```

- [ ] **Step 6: El manejador con pasos**

En `supabase/functions/pluvio/manejador.js`:

1. Añadir el import `import { publicar } from './publicar.js';` y, junto a `RESERVA_MS`:

```js
export const MINIMO_PASO_MS = 15000;   // un paso (agregar, revisar, publicar) que no tiene esto por delante no empieza
```

2. Añadir al final de `TAREAS` (después de `duero90`):

```js
  publicar: { toca: (h) => h === 4 || h === 16, paso: (c) => publicar(c) },
```

3. Sustituir `ejecutar` por:

```js
export async function ejecutar({ almacen, fetchFn, ahora = new Date(), estaciones, pedidas = [], claveAemet = null,
  esperar = dormir, reloj = () => Date.now(), plazo = PLAZO_EJECUCION, senal }) {
  const limite = reloj() + plazo;
  const pedir = crearPedir({ fetchFn, esperar, margen: () => limite - RESERVA_MS - reloj(), ...(senal ? { senal } : {}) });
  const hoy = hoyMadrid(ahora);
  const tareas = fuentesQueTocan(ahora, pedidas);
  const r = { estado: 'hecho', tareas, filas: {}, pasos: {}, errores: [] };
  let agotado = false;
  for (const t of tareas) {
    const tarea = TAREAS[t];
    if (tarea.paso) {   // los pasos van después de las lecturas y se hacen aunque estas agotaran su plazo
      if (limite - reloj() < MINIMO_PASO_MS) { r.errores.push(`${t}: sin tiempo para el paso`); continue; }
      try { r.pasos[t] = await tarea.paso({ almacen, hoy, ahora, estaciones }); } catch (e) { r.errores.push(`${t}: ${e.message}`); }
      continue;
    }
    if (agotado) continue;
    let res;
    try {
      res = await tarea.leer({ pedir, estaciones: estaciones.filter((e) => e.fuente === tarea.fuente), claveAemet, hoy, almacen });
    } catch (e) {
      if (e instanceof PlazoAgotado) { agotado = true; r.estado = 'plazo-agotado'; r.errores.push(`${t}: plazo agotado`); continue; }
      r.errores.push(`${t}: ${e.message}`);
      continue;
    }
    const filas = unicas(res.filas.map((f) => filaObs(tarea.fuente, f)));
    if (filas.length) await almacen.guardarObs(filas);
    r.filas[t] = filas.length;
    r.errores.push(...res.errores.map((e) => `${t}: ${e}`));
    if (res.agotado) { agotado = true; r.estado = 'plazo-agotado'; r.errores.push(`${t}: plazo agotado`); }
  }
  return r;
}
```

4. En `almacenSupabase`, añadir:

```js
    async diasPorEstacion(desde) { return datos(await admin.rpc('lluvia_por_dia', { p_desde: desde })); },
    async guardarDias(filas) {
      for (let k = 0; k < filas.length; k += 1000) datos(await admin.from('lluvia_dia').upsert(filas.slice(k, k + 1000), { onConflict: 'fuente,estacion,fecha' }));
    },
```

Comprobación de la prueba «plazo»: A y B leen (t = 120 s), C agota el margen; quedan 140 − 120 = 20 s ≥ 15 s para
`publicar`.

- [ ] **Step 7: Ejecutar las pruebas y verlas pasar**

Run: `node --test tests/pluvio-dias.test.js tests/pluvio-duero.test.js tests/pluvio-recolector.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261004000000_lluvia_dia.sql supabase/functions/pluvio tests/dobles-pluvio.js tests/pluvio-dias.test.js
git commit -m "$(cat <<'EOF'
Pluviómetros: lluvia por día de Madrid (lluvia_dia y lluvia_por_dia) y paso publicar a las 4 y 16 UTC

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 5: Lector del SAIH Júcar (total diario y relleno automático desde el 1 de agosto)

**Files:**
- Create: `supabase/functions/pluvio/lectores/jucar.js`
- Modify: `supabase/functions/pluvio/manejador.js` (tarea `jucar`), `tests/pluvio-dias.test.js` (la prueba «qué toca» de la tarea 4)
- Create: `tests/pluvio-jucar.test.js`, `tests/fixtures/pluvio/jucar-2026-09-30.json`, `tests/fixtures/pluvio/jucar-2026-10-02.json`

**Interfaces:**
- Consumes: `finDeDia` (tarea 1), `diasDeFilas` y `almacen.diasPorEstacion` (tarea 4), `agostoDe`, `sumarDias`.
- Produces: `BASE_JUCAR`, `LOTE_JUCAR = 20`, `urlDiaJucar(fecha)`, `filasDeDiaJucar(lista, fecha, codigos: Set) → [{ estacion, hora: finDeDia(fecha), horas: 24, mm }]`, `estacionesDeJucar(lista) → [{ codigo, nombre, x, y, provincia }]`, `fechasJucar(hoy, presentes: Set, lote?) → fechas`, `leerJucar({ pedir, estaciones, fechas })`. Tarea `jucar` a las 4 y 16 UTC (antes de `publicar`).

- [ ] **Step 1: Copiar las respuestas reales**

```bash
CAPTURAS="C:/Users/ALEJAN~1.ALE/AppData/Local/Temp/claude/C--Users-Alejandra-ALEJANDRA-P-Las-Gordillas/34bb25e7-93eb-4527-9cc6-e4b60f2fcfa8/scratchpad/pluvio/fixtures"
cp "$CAPTURAS"/jucar-2026-09-30.json "$CAPTURAS"/jucar-2026-10-02.json tests/fixtures/pluvio/
```

(`/lluviasIntervalo/2026-09-30/2026-09-30`, recortada a las 22 estaciones de Cuenca, y el día de hoy, que sale vacío.)

- [ ] **Step 2: Escribir las pruebas que fallan**

`tests/pluvio-jucar.test.js`:

```js
// tests/pluvio-jucar.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlDiaJucar, filasDeDiaJucar, estacionesDeJucar, fechasJucar, leerJucar } from '../supabase/functions/pluvio/lectores/jucar.js';
import { crearPedir } from '../supabase/functions/pluvio/red.js';
import { ejecutar, fuentesQueTocan } from '../supabase/functions/pluvio/manejador.js';
import { fixture, fixtureJson, respuesta, servidorFalso, almacenPluvioMemoria } from './dobles-pluvio.js';

const sinEspera = async () => {};
const rutasJucar = [
  [(u) => u === urlDiaJucar('2026-09-30'), () => respuesta(200, fixture('jucar-2026-09-30.json'))],
  [(u) => u === urlDiaJucar('2026-10-01'), () => respuesta(503, 'ocupado')],
  [(u) => u.includes('/lluviasIntervalo/'), () => respuesta(200, fixture('jucar-2026-10-02.json'))],
];

test('un día del SAIH Júcar: total diario por estación, apuntado al fin del día de Madrid y redondeado', () => {
  const filas = filasDeDiaJucar(fixtureJson('jucar-2026-09-30.json'), '2026-09-30', new Set(['5N02', '4N05', '6P01']))
    .sort((a, b) => a.estacion.localeCompare(b.estacion));
  assert.deepEqual(filas, [
    { estacion: '4N05', hora: '2026-09-30T22:00:00.000Z', horas: 24, mm: 0 },
    { estacion: '5N02', hora: '2026-09-30T22:00:00.000Z', horas: 24, mm: 0 },
    { estacion: '6P01', hora: '2026-09-30T22:00:00.000Z', horas: 24, mm: 1.6 }]);
  assert.deepEqual(filasDeDiaJucar(fixtureJson('jucar-2026-10-02.json'), '2026-10-02', new Set(['5N02'])), []);   // hoy: vacío
});

test('listado del Júcar: código, nombre y UTM 30 (los campos «Lat» y «Lon» son X e Y)', () => {
  const l = estacionesDeJucar(fixtureJson('jucar-2026-09-30.json'));
  assert.equal(l.length, 22);
  assert.deepEqual(l.find((e) => e.codigo === '5N02'), { codigo: '5N02', nombre: 'CUERDA', x: 615422.0231001107, y: 4422197.005116356, provincia: 'Cuenca' });
});

test('qué días pedir: ayer y anteayer siempre; después, los que faltan desde el 1 de agosto, hasta 20', () => {
  const f = fechasJucar('2026-10-02', new Set(['2026-10-01', '2026-09-30', '2026-08-01']));
  assert.equal(f.length, 20);
  assert.deepEqual(f.slice(0, 4), ['2026-10-01', '2026-09-30', '2026-08-02', '2026-08-03']);
  assert.equal(f.at(-1), '2026-08-19');
  const todos = new Set(Array.from({ length: 62 }, (_, k) => new Date(Date.UTC(2026, 7, 1 + k)).toISOString().slice(0, 10)));
  assert.deepEqual(fechasJucar('2026-10-02', todos), ['2026-10-01', '2026-09-30']);
});

test('leerJucar: un día que falla es un error de ese día y se sigue', async () => {
  const r = await leerJucar({ pedir: crearPedir({ fetchFn: servidorFalso(rutasJucar), esperar: sinEspera }),
    estaciones: [{ codigo: '6P01' }], fechas: ['2026-10-01', '2026-09-30'] });
  assert.deepEqual(r.errores, ['2026-10-01: saih.chj.es respondió 503']);
  assert.deepEqual(r.filas, [{ estacion: '6P01', hora: '2026-09-30T22:00:00.000Z', horas: 24, mm: 1.6 }]);
});

test('qué toca: Júcar a las 4 y 16 UTC, antes de publicar', () => {
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T04:10:00Z')), ['tajo', 'jucar', 'publicar']);
});

test('ejecutar: Júcar rellena días que faltan y el total diario cuenta como día completo', async () => {
  const almacen = almacenPluvioMemoria(), registro = [];
  const est = [{ fuente: 'jucar', codigo: '6P01' }];
  const r = await ejecutar({ almacen, fetchFn: servidorFalso(rutasJucar, registro), esperar: sinEspera, ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: est, pedidas: ['jucar', 'publicar'] });
  assert.equal(registro.length, 21);   // 20 días (ayer, anteayer y 18 de agosto) + el reintento del 503
  assert.deepEqual(r.filas, { jucar: 1 });
  assert.deepEqual(r.errores, ['jucar: 2026-10-01: saih.chj.es respondió 503']);
  assert.deepEqual({ ...almacen.dias.get('jucar|6P01|2026-09-30'), actualizado: null },
    { fuente: 'jucar', estacion: '6P01', fecha: '2026-09-30', mm: 1.6, horas: 24, maximo: null, calidad: 'ok', motivo: null, actualizado: null });
});
```

Además, en `tests/pluvio-dias.test.js`, la prueba «qué toca: el paso publicar…» pasa a esperar el Júcar delante:

```js
test('qué toca: el paso publicar a las 4 y a las 16 UTC, después de las lecturas', () => {
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T04:10:00Z')), ['tajo', 'jucar', 'publicar']);
  assert.deepEqual(fuentesQueTocan(new Date('2026-10-02T16:10:00Z')), ['tajo', 'jucar', 'publicar']);
});
```

- [ ] **Step 3: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-jucar.test.js`
Expected: FAIL con `Cannot find module …/lectores/jucar.js`.

- [ ] **Step 4: Escribir el lector**

`supabase/functions/pluvio/lectores/jucar.js`:

```js
// supabase/functions/pluvio/lectores/jucar.js
// SAIH Júcar (CHJ), sin clave y con CORS abierto (informe 09 §3.3). /lluviasIntervalo/D/D da, por estación, la lluvia del
// día D (`lluvia_int`; `valores` = días con dato) y su posición en UTM 30 (los campos «Lat» y «Lon» son X e Y). Solo trae
// días cerrados: hoy sale vacío. El portal avisa: datos provisionales, sin depurar. Se guarda como un valor que cubre 24 h
// apuntado al fin del día de Madrid.
import { finDeDia } from '../tiempo.js';
import { PlazoAgotado } from '../red.js';
import { sumarDias, agostoDe } from '../../_shared/meteo.js';

export const BASE_JUCAR = 'https://saih.chj.es/';
export const LOTE_JUCAR = 20;
export const urlDiaJucar = (fecha) => `${BASE_JUCAR}lluviasIntervalo/${fecha}/${fecha}`;
const r1 = (x) => Math.round(x * 10) / 10;

export function filasDeDiaJucar(lista, fecha, codigos) {
  const hora = finDeDia(fecha);
  return (Array.isArray(lista) ? lista : []).flatMap((x) => (codigos.has(x?.fldTCodigo) && x.valores >= 1
    && typeof x.lluvia_int === 'number' && Number.isFinite(x.lluvia_int) ? [{ estacion: x.fldTCodigo, hora, horas: 24, mm: r1(x.lluvia_int) }] : []));
}
export const estacionesDeJucar = (lista) => (Array.isArray(lista) ? lista : []).map((x) => ({
  codigo: x.fldTCodigo, nombre: x.fldTNombre, x: x.fldNCoordGPSLat, y: x.fldNCoordGPSLon, provincia: x.fldTProvincia }));

// Ayer y anteayer siempre (son provisionales y pueden corregirse); después, los que faltan desde el 1 de agosto, de los más
// antiguos a los más nuevos, hasta `lote` peticiones por ejecución (una por día: el relleno tarda unas 4 ejecuciones).
export function fechasJucar(hoy, presentes, lote = LOTE_JUCAR) {
  const anteayer = sumarDias(hoy, -2), fechas = [sumarDias(hoy, -1), anteayer];
  for (let f = agostoDe(hoy); f < anteayer && fechas.length < lote; f = sumarDias(f, 1)) if (!presentes.has(f)) fechas.push(f);
  return fechas;
}

export async function leerJucar({ pedir, estaciones, fechas }) {
  const codigos = new Set(estaciones.map((e) => e.codigo)), filas = [], errores = [];
  if (!codigos.size) return { filas, errores, agotado: false };
  for (const f of fechas) {
    try { filas.push(...filasDeDiaJucar(await pedir(urlDiaJucar(f)), f, codigos)); } catch (e) {
      if (e instanceof PlazoAgotado) return { filas, errores, agotado: true };
      errores.push(`${f}: ${e.message}`);
    }
  }
  return { filas, errores, agotado: false };
}
```

- [ ] **Step 5: Añadir la tarea al manejador**

En `supabase/functions/pluvio/manejador.js`, añadir los imports `import { leerJucar, fechasJucar } from './lectores/jucar.js';`
y `import { diasDeFilas } from './dias.js';`, y en `TAREAS`, entre `duero90` y `publicar`:

```js
  // Días que ya tienen dato de alguna estación del Júcar desde el 1 de agosto (de lluvia_por_dia): no se vuelven a pedir.
  jucar: { fuente: 'jucar', toca: (h) => h === 4 || h === 16, leer: async (c) => {
    const presentes = new Set(diasDeFilas((await c.almacen.diasPorEstacion(agostoDe(c.hoy))).filter((f) => f.fuente === 'jucar'))
      .filter((d) => d.horas > 0).map((d) => d.fecha));
    return leerJucar({ ...c, fechas: fechasJucar(c.hoy, presentes) });
  } },
```

- [ ] **Step 6: Ejecutar las pruebas y verlas pasar**

Run: `node --test tests/pluvio-jucar.test.js tests/pluvio-dias.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/pluvio/lectores/jucar.js supabase/functions/pluvio/manejador.js tests/pluvio-jucar.test.js tests/pluvio-dias.test.js tests/fixtures/pluvio/jucar-*.json
git commit -m "$(cat <<'EOF'
Pluviómetros: lector del SAIH Júcar (total diario) con relleno automático desde el 1 de agosto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 6: Euskalmet: lector del histórico anual, carga del relleno y tiempo real preparado

El zip anual (100 MB) no cabe en una Edge Function: se lee en local y se sube por `?accion=cargar`, protegida con la
misma clave. El tiempo real queda preparado (el paso de lecturas de 10 minutos a horas es común) y documentado; se activa
cuando la usuaria tenga la clave de la API.

**Files:**
- Create: `supabase/functions/pluvio/lectores/euskalmet.js`
- Create: `scripts/pluvio/zip.mjs`, `scripts/pluvio/euskalmet-zip.mjs`, `scripts/pluvio/relleno-euskalmet.mjs`
- Modify: `supabase/functions/pluvio/manejador.js` (`cargarFilas`, `MAX_FILAS_CARGA`), `supabase/functions/pluvio/index.ts` (`?accion=cargar`)
- Modify: `tests/dobles-pluvio.js` (`crearZip`)
- Create: `tests/pluvio-euskalmet.test.js`, `tests/fixtures/pluvio/euskalmet-C025-2026-8.xml`, `euskalmet-estaciones.json`, `euskalmet-datos-C025.xml`
- Modify: `docs/supabase.md` (Euskalmet: relleno y tiempo real pendiente de clave)

**Interfaces:**
- Consumes: `esHoraEnPunto`, `fechaMadridDeFin` (tarea 1); `filaObs`, `unicas` (tarea 1); `agregarHoras` (tarea 4).
- Produces:
  - `lectores/euskalmet.js`: `URL_ESTACIONES_EUSKALMET`, `urlZipEuskalmet(anio)`, `lecturasDeXml(xml) → [{ t (ms UTC), mm }]`, `horasDeLecturas(lecturas, codigo) → filas` (hora válida con sus 6 lecturas), `horasDeXmlEuskalmet(xml, codigo)`, `estacionesDeEuskalmet(lista) → [{ codigo, nombre, lat, lon, xmlDatos }]`, `altitudDeXmlDatos(xml) → number|null`.
  - `scripts/pluvio/zip.mjs`: `entradasZip(buf) → Map<nombre, { metodo, comprimido, local }>`, `leerEntrada(buf, entrada) → Buffer`.
  - `scripts/pluvio/euskalmet-zip.mjs`: `filasDeZipEuskalmet(zip, estaciones, desde) → { filas, avisos }`, `conLluviaEnZip(zip, codigos) → Set`.
  - `manejador.js`: `MAX_FILAS_CARGA = 5000`, `cargarFilas({ almacen, estaciones, cuerpo }) → { ok, guardadas? , error? }`.
  - Dobles: `crearZip({ nombre: Buffer }) → Buffer`.

- [ ] **Step 1: Copiar las respuestas reales**

```bash
CAPTURAS="C:/Users/ALEJAN~1.ALE/AppData/Local/Temp/claude/C--Users-Alejandra-ALEJANDRA-P-Las-Gordillas/34bb25e7-93eb-4527-9cc6-e4b60f2fcfa8/scratchpad/pluvio/fixtures"
cp "$CAPTURAS"/euskalmet-C025-2026-8.xml "$CAPTURAS"/euskalmet-estaciones.json "$CAPTURAS"/euskalmet-datos-C025.xml tests/fixtures/pluvio/
```

(Tres días reales de Beluntza, C025, del XML de agosto del zip de 2026, en ISO-8859-1; la lista de estaciones recortada a
B090, C024, C025 y C035; el `XMLdatos` de C025.)

- [ ] **Step 2: `crearZip` en los dobles**

Añadir a `tests/dobles-pluvio.js` (con `import { deflateRawSync } from 'node:zlib';` arriba):

```js
// Zip mínimo (deflate, sin CRC: el lector no lo comprueba) para probar el lector del histórico de Euskalmet.
export function crearZip(archivos) {
  const locales = [], centrales = [];
  let pos = 0;
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const n = Buffer.from(nombre), datos = deflateRawSync(contenido);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(8, 8); l.writeUInt32LE(datos.length, 18); l.writeUInt32LE(contenido.length, 22); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(datos.length, 20); c.writeUInt32LE(contenido.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(pos, 42);
    locales.push(l, n, datos);
    centrales.push(c, n);
    pos += 30 + n.length + datos.length;
  }
  const cd = Buffer.concat(centrales), fin = Buffer.alloc(22), total = centrales.length / 2;
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(total, 8); fin.writeUInt16LE(total, 10); fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(pos, 16);
  return Buffer.concat([...locales, cd, fin]);
}
```

- [ ] **Step 3: Escribir las pruebas que fallan**

`tests/pluvio-euskalmet.test.js`:

```js
// tests/pluvio-euskalmet.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { horasDeXmlEuskalmet, lecturasDeXml, horasDeLecturas, estacionesDeEuskalmet, altitudDeXmlDatos } from '../supabase/functions/pluvio/lectores/euskalmet.js';
import { entradasZip, leerEntrada } from '../scripts/pluvio/zip.mjs';
import { filasDeZipEuskalmet, conLluviaEnZip } from '../scripts/pluvio/euskalmet-zip.mjs';
import { agregarHoras } from '../supabase/functions/pluvio/dias.js';
import { cargarFilas, MAX_FILAS_CARGA } from '../supabase/functions/pluvio/manejador.js';
import { fixture, fixtureJson, crearZip, almacenPluvioMemoria } from './dobles-pluvio.js';

const xml = () => fixture('euskalmet-C025-2026-8.xml', 'latin1');
const delDia = (dias, fecha) => { const d = dias.find((x) => x.fecha === fecha); return d && { mm: d.mm, horas: d.horas }; };
const EST = [{ fuente: 'euskalmet', codigo: 'C025' }, { fuente: 'duero', codigo: 'PL002' }];

test('Euskalmet: lecturas de 10 min (UTC) a horas; una hora vale con sus 6 lecturas', () => {
  assert.equal(lecturasDeXml(xml()).length, 432);   // 3 días × 144
  const filas = horasDeXmlEuskalmet(xml(), 'C025');
  assert.equal(filas.length, 71);   // la primera hora (1 lectura) y la última (5) no valen
  assert.deepEqual(filas.find((f) => f.hora === '2026-08-20T13:00:00.000Z'), { estacion: 'C025', hora: '2026-08-20T13:00:00.000Z', mm: 8.4 });
  const dias = agregarHoras(filas.map((f) => ({ ...f, fuente: 'euskalmet' })), '2026-08-01');
  assert.deepEqual(delDia(dias, '2026-08-20'), { mm: 13.1, horas: 24 });
  assert.deepEqual(delDia(dias, '2026-08-21'), { mm: 2.7, horas: 24 });
  assert.deepEqual(delDia(dias, '2026-08-19'), { mm: 0.2, horas: 22 });
});

test('Euskalmet: una lectura no numérica o negativa deja esa hora sin dato', () => {
  const t0 = Date.parse('2026-08-20T12:10:00Z');
  const seis = Array.from({ length: 6 }, (_, k) => ({ t: t0 + k * 600e3, mm: 0.1 }));
  assert.equal(horasDeLecturas(seis, 'X').length, 1);
  assert.equal(horasDeLecturas([...seis.slice(0, 5), { t: t0 + 5 * 600e3, mm: null }], 'X').length, 0);
});

test('Euskalmet: lista de estaciones (sin boyas ni bajas) y altitud del XMLdatos', () => {
  const l = estacionesDeEuskalmet(fixtureJson('euskalmet-estaciones.json'));
  assert.deepEqual(l.map((e) => e.codigo), ['C024', 'C025', 'C035']);
  assert.deepEqual({ ...l.find((e) => e.codigo === 'C025'), xmlDatos: null }, { codigo: 'C025', nombre: 'Beluntza', lat: 42.9615782, lon: -2.89361, xmlDatos: null });
  assert.equal(altitudDeXmlDatos(fixture('euskalmet-datos-C025.xml', 'latin1')), 687);
});

test('zip de zips: el lector mínimo saca el XML de agosto y las horas desde la fecha pedida', () => {
  const interno = crearZip({ 'C025/C025_2026_8.xml': Buffer.from(xml(), 'latin1'), 'C025/C025_2026_8.xsd': Buffer.from('<xs:schema/>') });
  const zip = crearZip({ '2026/C025_2026.zip': interno });
  const ent = entradasZip(zip);
  assert.deepEqual([...ent.keys()], ['2026/C025_2026.zip']);
  assert.equal(entradasZip(leerEntrada(zip, ent.get('2026/C025_2026.zip'))).size, 2);
  const { filas, avisos } = filasDeZipEuskalmet(zip, [{ codigo: 'C025' }, { codigo: 'C999' }], '2026-08-20');
  assert.equal(filas.length, 49);   // 24 del 20, 24 del 21 y 1 del 22 (día de Madrid)
  assert.ok(filas.every((f) => f.fuente === 'euskalmet' && f.estacion === 'C025'));
  assert.deepEqual(avisos, ['C999: no está en el zip']);
  assert.deepEqual([...conLluviaEnZip(zip, ['C025', 'C999'])], ['C025']);
  assert.throws(() => entradasZip(Buffer.from('no es un zip, es un texto cualquiera')), /no es un zip/);
});

test('cargarFilas: solo estaciones de la lista blanca, horas en punto y mm numéricos o nulos', async () => {
  const almacen = almacenPluvioMemoria();
  const buena = { fuente: 'euskalmet', estacion: 'C025', hora: '2026-08-20T13:00:00.000Z', mm: 8.4 };
  assert.deepEqual(await cargarFilas({ almacen, estaciones: EST, cuerpo: { filas: [buena, { ...buena, mm: 9 }, { ...buena, hora: '2026-08-20T14:00:00.000Z', mm: null }] } }),
    { ok: true, guardadas: 2 });
  assert.equal(almacen.obs.get('euskalmet|C025|2026-08-20T13:00:00.000Z').mm, 9);   // repetida: gana la última
  for (const mala of [{ ...buena, estacion: 'C999' }, { ...buena, hora: '2026-08-20T13:10:00.000Z' }, { ...buena, mm: 'ocho' }, { ...buena, fuente: 'tajo' }]) {
    const r = await cargarFilas({ almacen, estaciones: EST, cuerpo: { filas: [mala] } });
    assert.equal(r.ok, false, JSON.stringify(mala));
    assert.match(r.error, /no válidas/);
  }
  assert.equal((await cargarFilas({ almacen, estaciones: EST, cuerpo: { filas: [] } })).ok, false);
  assert.equal((await cargarFilas({ almacen, estaciones: EST, cuerpo: { filas: Array(MAX_FILAS_CARGA + 1).fill(buena) } })).ok, false);
  assert.equal((await cargarFilas({ almacen, estaciones: EST, cuerpo: null })).ok, false);
});

test('index.ts: ?accion=cargar pasa por la misma clave y por cargarFilas', () => {
  const index = readFileSync('supabase/functions/pluvio/index.ts', 'utf8');
  assert.match(index, /searchParams\.get\('accion'\) === 'cargar'/);
  assert.match(index, /cargarFilas\(/);
  assert.ok(index.indexOf('claveValida(') < index.indexOf("=== 'cargar'"), 'la clave se comprueba antes');
});
```

Nota: `fixture(nombre, 'latin1')` lee el XML como ISO-8859-1; `Buffer.from(xml(), 'latin1')` recupera sus bytes.

- [ ] **Step 4: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-euskalmet.test.js`
Expected: FAIL con `Cannot find module …/lectores/euskalmet.js`.

- [ ] **Step 5: Lector, zip y carga**

`supabase/functions/pluvio/lectores/euskalmet.js`:

```js
// supabase/functions/pluvio/lectores/euskalmet.js
// Euskalmet / Open Data Euskadi (CC BY 4.0; informe 09 §3.6). El histórico anual (zip con un zip por estación y un XML por
// mes) trae lecturas cada 10 minutos en UTC: comprobado con el ciclo diario de temperatura de Beluntza en agosto (mínima
// a las 05 y máxima a las 13 y 14). Cada lectura se toma como los 10 minutos que ACABAN a su hora; una hora vale si tiene
// sus 6 lecturas válidas. La API en tiempo real pide un JWT firmado con la clave privada de la usuaria (registro pendiente):
// cuando la haya, será otra tarea de «pluvio» que entregue lecturas a horasDeLecturas (docs/supabase.md).
export const URL_ESTACIONES_EUSKALMET = 'https://opendata.euskadi.eus/contenidos/ds_meteorologicos/estaciones_meteorologicas/opendata/estaciones.json';
export const urlZipEuskalmet = (anio) => `https://opendata.euskadi.eus/contenidos/ds_meteorologicos/met_stations_ds_${anio}/opendata/${anio}.zip`;
const r1 = (x) => Math.round(x * 10) / 10;

export function lecturasDeXml(xml) {
  const lecturas = [];
  for (const d of xml.matchAll(/<dia Dia="(\d{4})-(\d{1,2})-(\d{1,2})">([\s\S]*?)<\/dia>/g)) {
    const fecha = `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
    for (const h of d[4].matchAll(/<hora Hora="(\d\d):(\d\d)">([\s\S]*?)<\/hora>/g)) {
      const v = Number(h[3].match(/<Precip[^>]*>([^<]*)</)?.[1] ?? NaN);
      lecturas.push({ t: Date.parse(`${fecha}T${h[1]}:${h[2]}:00Z`), mm: Number.isFinite(v) && v >= 0 ? v : null });
    }
  }
  return lecturas;
}
export function horasDeLecturas(lecturas, codigo) {
  const horas = new Map();
  for (const l of lecturas) {
    const fin = Math.ceil(l.t / 3600e3) * 3600e3;
    const h = horas.get(fin) ?? { n: 0, mm: 0, mala: false };
    if (l.mm == null) h.mala = true; else { h.n++; h.mm += l.mm; }
    horas.set(fin, h);
  }
  return [...horas].sort((a, b) => a[0] - b[0]).filter(([, h]) => h.n === 6 && !h.mala)
    .map(([fin, h]) => ({ estacion: codigo, hora: new Date(fin).toISOString(), mm: r1(h.mm) }));
}
export const horasDeXmlEuskalmet = (xml, codigo) => horasDeLecturas(lecturasDeXml(xml), codigo);
export const estacionesDeEuskalmet = (lista) => (Array.isArray(lista) ? lista : []).filter((e) => (e.Tipo === 'KM' || e.Tipo === 'KA') && !e.Fechabaja)
  .map((e) => ({ codigo: e.Codigo, nombre: e.Nombre, lat: Number(e.LATWGS84), lon: Number(e.LONWGS84), xmlDatos: e.XMLdatos }));
export function altitudDeXmlDatos(xml) {
  const m = xml.match(/<altitude>([\d.]+)<\/altitude>/);
  return m ? Math.round(Number(m[1])) : null;
}
```

`scripts/pluvio/zip.mjs`:

```js
// scripts/pluvio/zip.mjs
// Lector mínimo de zip, sin dependencias: directorio central y entradas guardadas (0) o con deflate (8). Basta para el
// histórico de Euskalmet (un zip de zips, sin ZIP64).
import { inflateRawSync } from 'node:zlib';

export function entradasZip(buf) {
  const tope = Math.max(0, buf.length - 65557);
  let i = buf.length - 22;
  while (i >= tope && buf.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < tope) throw new Error('no es un zip (sin fin de directorio)');
  const n = buf.readUInt16LE(i + 10);
  let p = buf.readUInt32LE(i + 16);
  const entradas = new Map();
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: directorio central dañado');
    const metodo = buf.readUInt16LE(p + 10), comprimido = buf.readUInt32LE(p + 20), largo = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30), comentario = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    entradas.set(buf.toString('utf8', p + 46, p + 46 + largo), { metodo, comprimido, local });
    p += 46 + largo + extra + comentario;
  }
  return entradas;
}
export function leerEntrada(buf, e) {
  if (buf.readUInt32LE(e.local) !== 0x04034b50) throw new Error('zip: cabecera local dañada');
  const ini = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
  const datos = buf.subarray(ini, ini + e.comprimido);
  if (e.metodo === 0) return Buffer.from(datos);
  if (e.metodo === 8) return inflateRawSync(datos);
  throw new Error(`zip: método ${e.metodo} no admitido`);
}
```

Nota: `entradasZip` de un texto de menos de 22 bytes lanzaría `RangeError` al leer; el texto de la prueba tiene 36 bytes
y no contiene la firma, así que sale por «no es un zip».

`scripts/pluvio/euskalmet-zip.mjs`:

```js
// scripts/pluvio/euskalmet-zip.mjs
// Del zip anual de Euskalmet (2026/Cxxx_2026.zip → Cxxx/Cxxx_2026_M.xml) a horas de lluvia de las estaciones pedidas.
import { entradasZip, leerEntrada } from './zip.mjs';
import { horasDeXmlEuskalmet } from '../../supabase/functions/pluvio/lectores/euskalmet.js';
import { fechaMadridDeFin } from '../../supabase/functions/pluvio/tiempo.js';

const latin1 = new TextDecoder('latin1');
// La entrada exterior de cada estación se llama siempre AAAA/CODIGO_AAAA.zip.
function xmlsDe(zip, externas, codigo) {
  const ent = [...externas].find(([n]) => new RegExp(`/${codigo}_\\d{4}\\.zip$`).test(n));
  if (!ent) return null;
  const interno = leerEntrada(zip, ent[1]);
  return [...entradasZip(interno)].filter(([n]) => /_\d{4}_\d{1,2}\.xml$/.test(n))
    .map(([n, e]) => ({ mes: Number(n.match(/_(\d{1,2})\.xml$/)[1]), xml: latin1.decode(leerEntrada(interno, e)) }));
}
export function filasDeZipEuskalmet(zip, estaciones, desde) {
  const externas = entradasZip(zip), filas = [], avisos = [];
  const mesDesde = Number(desde.slice(5, 7));
  for (const e of estaciones) {
    const xmls = xmlsDe(zip, externas, e.codigo);
    if (!xmls) { avisos.push(`${e.codigo}: no está en el zip`); continue; }
    for (const { mes, xml } of xmls) {
      if (mes < mesDesde) continue;
      filas.push(...horasDeXmlEuskalmet(xml, e.codigo).filter((h) => fechaMadridDeFin(h.hora) >= desde).map((h) => ({ fuente: 'euskalmet', ...h })));
    }
  }
  return { filas, avisos };
}
// Estaciones cuyo último mes del zip mide lluvia (algunas de la red son de calidad del aire o de aforo).
export function conLluviaEnZip(zip, codigos) {
  const externas = entradasZip(zip), r = new Set();
  for (const c of codigos) {
    const xmls = xmlsDe(zip, externas, c);
    if (xmls?.length && /<Precip/.test(xmls.sort((a, b) => a.mes - b.mes).at(-1).xml)) r.add(c);
  }
  return r;
}
```

`scripts/pluvio/relleno-euskalmet.mjs`:

```js
// scripts/pluvio/relleno-euskalmet.mjs
//   node scripts/pluvio/relleno-euskalmet.mjs [--seco] [--desde=2026-08-01] [--anio=2026]
// Lee _fuentes/euskalmet-AAAA.zip (lo descarga si no está; unos 100 MB, CC BY 4.0), saca las horas de lluvia de las
// estaciones de Euskalmet de la lista blanca desde --desde y las sube a la función «pluvio» (?accion=cargar) con la
// cabecera x-pluvio-clave, que se lee de la variable de entorno PLUVIO_CLAVE (nunca de un archivo). --seco solo cuenta.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { filasDeZipEuskalmet } from './euskalmet-zip.mjs';
import { urlZipEuskalmet } from '../../supabase/functions/pluvio/lectores/euskalmet.js';
import { AGENTE } from '../../supabase/functions/pluvio/red.js';

const RAIZ = new URL('../../', import.meta.url);
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const seco = process.argv.includes('--seco'), desde = arg('desde', '2026-08-01'), anio = arg('anio', desde.slice(0, 4));
const FUNCION = 'https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/pluvio?accion=cargar';
const TROZO = 2000;

const estaciones = JSON.parse(readFileSync(new URL('supabase/functions/pluvio/estaciones.json', RAIZ), 'utf8')).filter((e) => e.fuente === 'euskalmet');
const ruta = new URL(`_fuentes/euskalmet-${anio}.zip`, RAIZ);
if (!existsSync(ruta)) {
  mkdirSync(new URL('_fuentes/', RAIZ), { recursive: true });
  console.log(`descargando ${urlZipEuskalmet(anio)} …`);
  const r = await fetch(urlZipEuskalmet(anio), { headers: { 'User-Agent': AGENTE } });
  if (!r.ok) throw new Error(`Euskalmet respondió ${r.status}`);
  writeFileSync(ruta, Buffer.from(await r.arrayBuffer()));
}
const { filas, avisos } = filasDeZipEuskalmet(readFileSync(ruta), estaciones, desde);
for (const a of avisos) console.warn(a);
const ultima = filas.map((f) => f.hora).sort().at(-1) ?? '—';
console.log(`${filas.length} horas de ${new Set(filas.map((f) => f.estacion)).size} de ${estaciones.length} estaciones, hasta ${ultima}`);
if (!seco) {
  const clave = process.env.PLUVIO_CLAVE;
  if (!clave) throw new Error('falta PLUVIO_CLAVE en el entorno');
  for (let k = 0; k < filas.length; k += TROZO) {
    const r = await fetch(FUNCION, { method: 'POST', headers: { 'content-type': 'application/json', 'x-pluvio-clave': clave, 'User-Agent': AGENTE },
      body: JSON.stringify({ filas: filas.slice(k, k + TROZO) }) });
    const texto = await r.text();
    if (!r.ok) throw new Error(`carga ${k}: ${r.status} ${texto}`);
    console.log(`${Math.min(k + TROZO, filas.length)}/${filas.length}: ${texto}`);
  }
}
```

En `supabase/functions/pluvio/manejador.js`, añadir `import { esHoraEnPunto } from './tiempo.js';` y, después de `unicas`:

```js
// Carga de horas leídas fuera (relleno de Euskalmet desde su zip anual): solo estaciones de la lista blanca, horas en
// punto y mm numéricos o nulos; como mucho MAX_FILAS_CARGA por llamada.
export const MAX_FILAS_CARGA = 5000;
const mmValido = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));
export async function cargarFilas({ almacen, estaciones, cuerpo }) {
  const lista = cuerpo?.filas;
  if (!Array.isArray(lista) || !lista.length || lista.length > MAX_FILAS_CARGA) return { ok: false, error: `hacen falta entre 1 y ${MAX_FILAS_CARGA} filas` };
  const conocidas = new Set(estaciones.map((e) => `${e.fuente}:${e.codigo}`));
  const malas = lista.filter((f) => !conocidas.has(`${f?.fuente}:${f?.estacion}`) || !esHoraEnPunto(f.hora) || !mmValido(f.mm));
  if (malas.length) return { ok: false, error: `${malas.length} filas no válidas; la primera: ${JSON.stringify(malas[0]).slice(0, 120)}` };
  const filas = unicas(lista.map((f) => filaObs(f.fuente, { estacion: f.estacion, hora: new Date(f.hora).toISOString(), mm: f.mm })));
  await almacen.guardarObs(filas);
  return { ok: true, guardadas: filas.length };
}
```

En `supabase/functions/pluvio/index.ts`, importar `cargarFilas` (`import { ejecutar, almacenSupabase, cargarFilas } from './manejador.js';`)
y, justo después de crear `admin`:

```ts
  if (u.searchParams.get('accion') === 'cargar') {
    let cuerpo: unknown = null;
    try { cuerpo = await req.json(); } catch { return new Response('cuerpo no válido', { status: 400 }); }
    const r = await cargarFilas({ almacen: almacenSupabase(admin), estaciones: ESTACIONES, cuerpo });
    return Response.json(r, { status: r.ok ? 200 : 400 });
  }
```

(Para eso, mover la línea `const pedidas = …` debajo de este bloque; la comprobación de la clave ya está antes.)

- [ ] **Step 6: Documentar Euskalmet en `docs/supabase.md`**

Añadir a la sección «Edge Function `pluvio`»:

```markdown
- **Euskalmet (Álava).** Relleno desde el histórico anual (zip de unos 100 MB, CC BY 4.0, publicado con 2 a 6 semanas de
  retraso): `PLUVIO_CLAVE=<clave> node scripts/pluvio/relleno-euskalmet.mjs --desde=2026-08-01` (sube por `?accion=cargar`;
  `--seco` solo cuenta). Repetirlo cuando Euskalmet publique un mes nuevo (se puede borrar `_fuentes/euskalmet-AAAA.zip`
  para que lo vuelva a bajar).
- **Euskalmet en tiempo real: pendiente de clave.** La API (`https://api.euskadi.eus/euskalmet/…`) pide un JWT RS256 firmado
  con la clave privada de la usuaria (claims `aud: "met01.apikey"`, `iss`, `exp`, `iat`, `version: "1.0.0"`, `email`;
  alta en `https://api.euskadi.eus/opendata-apikey/`). Cuando la haya: guardarla como secreto (`EUSKALMET_CLAVE_PRIVADA`,
  nunca en el repo), probar las rutas de lecturas, y añadir en `manejador.js` una tarea `euskalmet` que firme el JWT y
  entregue las lecturas de 10 minutos a `horasDeLecturas` (`lectores/euskalmet.js`); el resto no cambia.
```

- [ ] **Step 7: Ejecutar las pruebas y verlas pasar**

Run: `node --test tests/pluvio-euskalmet.test.js tests/pluvio-recolector.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/pluvio scripts/pluvio tests/dobles-pluvio.js tests/pluvio-euskalmet.test.js tests/fixtures/pluvio/euskalmet-* docs/supabase.md
git commit -m "$(cat <<'EOF'
Pluviómetros: Euskalmet desde el zip anual (relleno local por ?accion=cargar) y tiempo real preparado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 7: Selección de estaciones: script local, lista blanca completa, `puntos.json` y sonda en vivo

**Files:**
- Create: `supabase/functions/_shared/pluvio.js` (primera parte: `MEZCLA` y `distanciaKm`; la tarea 9 la completa)
- Create: `supabase/functions/_shared/pluvio-fuentes.js`
- Create: `scripts/pluvio/utm.mjs`, `scripts/pluvio/seleccion.mjs`, `scripts/pluvio/estaciones.mjs`, `scripts/pluvio/sonda.mjs`
- Modify (generado): `supabase/functions/pluvio/estaciones.json`
- Create (generado): `supabase/functions/pluvio/puntos.json`
- Create: `tests/pluvio-seleccion.test.js`

**Interfaces:**
- Consumes: `cadenaTajo`, `estacionesDeTablaTajo` (tarea 1); `BASE_DUERO`, `estacionesDeRisr`, `historicoDeFicha`, `altitudDeFicha` (tarea 3); `urlDiaJucar`, `estacionesDeJucar` (tarea 5); `estacionesDeEuskalmet`, `altitudDeXmlDatos`, `URL_ESTACIONES_EUSKALMET` (tarea 6); `conLluviaEnZip` (tarea 6); `crearPedir` (tarea 1).
- Produces:
  - `_shared/pluvio.js`: `MEZCLA = { radioKm: 20, desnivelMax: 600, escalaDesnivel: 300, kmMin: 1 }`, `distanciaKm(a, b) → number|null`.
  - `_shared/pluvio-fuentes.js`: `LICENCIAS` (`'reutilizacion-sector-publico'`, `'cc-by-4.0'`, `'aemet'` → texto), `FUENTES_LLUVIA` (`tajo`, `duero`, `jucar`, `euskalmet`, `aemet` → `{ nombre, url, licencia }`).
  - `scripts/pluvio/utm.mjs`: `utmALatLon(x, y, huso) → { lat, lon }`.
  - `scripts/pluvio/seleccion.mjs`: `nombreBonito(texto)`, `nombreDuero(texto)`, `puntoCercano(e, puntos) → { p, km }|null`, `elegir(candidatas, puntos, { maxKm?, maxDesnivel?, sinAltitud? })`, `resumenPorZona(lista, puntos)`.
  - `estaciones.json`: `{ fuente, codigo, nombre, lat, lon, altitud, licencia, url? (tajo), token? (duero) }`; `puntos.json`: `[{ id, zona, lat, lon, altitud }]`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/pluvio-seleccion.test.js`:

```js
// tests/pluvio-seleccion.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { utmALatLon } from '../scripts/pluvio/utm.mjs';
import { nombreBonito, nombreDuero, elegir, puntoCercano, resumenPorZona } from '../scripts/pluvio/seleccion.mjs';
import { distanciaKm, MEZCLA } from '../supabase/functions/_shared/pluvio.js';
import { FUENTES_LLUVIA, LICENCIAS } from '../supabase/functions/_shared/pluvio-fuentes.js';

const leerJson = (r) => JSON.parse(readFileSync(r, 'utf8'));
const cerca = (a, b) => Math.abs(a - b) < 1e-4;

test('UTM 30 a grados: Bustarviejo (SAIH Tajo) y Cuerda (SAIH Júcar)', () => {
  const p = utmALatLon(435403.9, 4522055.4, 30);
  assert.ok(cerca(p.lat, 40.847) && cerca(p.lon, -3.7663), JSON.stringify(p));
  const c = utmALatLon(615422.0231001107, 4422197.005116356, 30);
  assert.ok(cerca(c.lat, 39.94203) && cerca(c.lon, -1.64898), JSON.stringify(c));
});

test('distancia en km (haversine) y nula si falta una coordenada', () => {
  assert.equal(Math.round(distanciaKm({ lat: 42.03715928, lon: -3.00451858 }, { lat: 41.95236236, lon: -2.87212741 }) * 10) / 10, 14.4);
  assert.equal(distanciaKm({ lat: 40 }, { lat: 40, lon: -4 }), null);
});

test('nombres: mayúsculas de las fuentes a nombre propio; el código de Duero fuera', () => {
  assert.equal(nombreBonito('OLLA DEL QUIÑON EN BUSTARVIEJO'), 'Olla del Quiñon en Bustarviejo');
  assert.equal(nombreBonito('DEPÓSITOS (LA DEHESA) RASCAFRIA'), 'Depósitos (La Dehesa) Rascafria');
  assert.equal(nombreBonito('LA CIERVA'), 'La Cierva');
  assert.equal(nombreBonito('CASAS VENEROS-VILLANUEVA DEAVILA'), 'Casas Veneros-Villanueva Deavila');
  assert.equal(nombreDuero('Covaleda, PL-47'), 'Covaleda');
  assert.equal(nombreDuero('Quintanar de la Sierra, PL-45a'), 'Quintanar de la Sierra');
});

test('elegir: a menos de 20 km de algún punto y con menos de 600 m de desnivel (o sin mirar la altitud)', () => {
  const puntos = [{ id: 'p', zona: 'z', lat: 40, lon: -4, altitud: 1200 }];
  const a = { fuente: 'tajo', codigo: 'A', lat: 40.05, lon: -4, altitud: 1300 };
  const b = { fuente: 'tajo', codigo: 'B', lat: 40.25, lon: -4, altitud: 1200 };
  const c = { fuente: 'tajo', codigo: 'C', lat: 40.05, lon: -4, altitud: 1900 };
  assert.deepEqual(elegir([a, b, c], puntos).map((e) => e.codigo), ['A']);
  assert.deepEqual(elegir([a, b, c], puntos, { sinAltitud: true }).map((e) => e.codigo), ['A', 'C']);
  assert.equal(Math.round(puntoCercano(a, puntos).km * 10) / 10, 5.6);
  assert.deepEqual(resumenPorZona([a], puntos), { z: { tajo: 1 } });
  assert.equal(MEZCLA.radioKm, 20);
});

test('fuentes y licencias: cada fuente con nombre, enlace y una licencia conocida', () => {
  assert.deepEqual(Object.keys(FUENTES_LLUVIA).sort(), ['aemet', 'duero', 'euskalmet', 'jucar', 'tajo']);
  for (const f of Object.values(FUENTES_LLUVIA)) {
    assert.ok(f.nombre && /^https:\/\//.test(f.url) && LICENCIAS[f.licencia], f.nombre);
  }
  assert.equal(FUENTES_LLUVIA.euskalmet.licencia, 'cc-by-4.0');
});

test('lista blanca generada: fuentes conocidas, licencia de su fuente, URL en Tajo, token en Duero, sin repetidos', () => {
  const lista = leerJson('supabase/functions/pluvio/estaciones.json');
  const puntos = leerJson('supabase/functions/pluvio/puntos.json');
  for (const f of ['tajo', 'duero', 'jucar', 'euskalmet', 'aemet']) assert.ok(lista.some((e) => e.fuente === f), `sin estaciones de ${f}`);
  for (const e of lista) {
    const id = `${e.fuente}:${e.codigo}`;
    assert.ok(FUENTES_LLUVIA[e.fuente], id);
    assert.equal(e.licencia, FUENTES_LLUVIA[e.fuente].licencia, id);
    assert.ok(e.nombre && Number.isFinite(e.lat) && Number.isFinite(e.lon) && Number.isInteger(e.altitud), id);
    if (e.fuente === 'tajo') assert.match(e.url, /^index\.php\?w=get-estacion&x=/, id);
    if (e.fuente === 'duero') assert.match(e.token, /^[A-Za-z0-9]+$/, id);
    if (e.fuente !== 'aemet') assert.ok(puntoCercano(e, puntos).km < MEZCLA.radioKm, `${id} lejos de todos los puntos`);
  }
  assert.equal(new Set(lista.map((e) => `${e.fuente}:${e.codigo}`)).size, lista.length);
  const aemet = leerJson('supabase/functions/aemet/estaciones.json');
  assert.deepEqual(lista.filter((e) => e.fuente === 'aemet').map((e) => e.codigo).sort(), [...aemet].sort());
});

test('puntos.json es copia de los puntos de data/zonas.json', () => {
  const zonas = leerJson('data/zonas.json').zonas;
  assert.deepEqual(leerJson('supabase/functions/pluvio/puntos.json'),
    zonas.flatMap((z) => z.puntos.map((p) => ({ id: p.id, zona: z.id, lat: p.lat, lon: p.lon, altitud: p.altitud }))));
});
```

Y en `tests/pluvio-recolector.test.js`, la prueba «lista blanca inicial…» deja de valer tal cual (ya no son solo Tajo y
AEMET): sustituirla por esta, que comprueba solo lo de las tareas 1 y 2:

```js
test('lista blanca: AEMET = la de la función aemet; las de Tajo, con su URL', () => {
  const lista = JSON.parse(leer('supabase/functions/pluvio/estaciones.json'));
  const aemet = JSON.parse(leer('supabase/functions/aemet/estaciones.json'));
  assert.deepEqual(lista.filter((e) => e.fuente === 'aemet').map((e) => e.codigo).sort(), [...aemet].sort());
  for (const e of lista.filter((x) => x.fuente === 'tajo')) assert.match(e.url, /^index\.php\?w=get-estacion&x=/, e.codigo);
});
```

- [ ] **Step 2: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-seleccion.test.js`
Expected: FAIL con `Cannot find module …/scripts/pluvio/utm.mjs`.

- [ ] **Step 3: Piezas puras**

`supabase/functions/_shared/pluvio.js` (primera parte):

```js
// supabase/functions/_shared/pluvio.js
// Lluvia medida en pluviómetros (spec §3.3), compartido por la función «pluvio», la función «rejilla» y el navegador
// (vía .nojekyll). Sin DOM ni red. Radio y desnivel máximos de una estación respecto a un punto o una celda: los usa la
// selección de estaciones (scripts/pluvio/) y la mezcla (tarea 9).
export const MEZCLA = Object.freeze({ radioKm: 20, desnivelMax: 600, escalaDesnivel: 300, kmMin: 1 });

// Distancia en km entre dos coordenadas (haversine); null si falta alguna.
export function distanciaKm(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every(Number.isFinite)) return null;
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
```

`supabase/functions/_shared/pluvio-fuentes.js`:

```js
// supabase/functions/_shared/pluvio-fuentes.js
// Fuentes de la lluvia medida: nombre, enlace y licencia (informe 09 §2). Las usan la lista blanca (cada estación lleva la
// licencia de su fuente) y los créditos de Ajustes.
export const LICENCIAS = Object.freeze({
  'reutilizacion-sector-publico': 'Información del sector público reutilizable citando la fuente (Ley 37/2007). Datos provisionales en tiempo real, sin depurar.',
  'cc-by-4.0': 'Licencia CC BY 4.0.',
  aemet: '«Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma».',
});
export const FUENTES_LLUVIA = Object.freeze({
  tajo: { nombre: 'SAIH Tajo (Confederación Hidrográfica del Tajo)', url: 'https://saihtajo.chtajo.es/', licencia: 'reutilizacion-sector-publico' },
  duero: { nombre: 'SAIH Duero (Confederación Hidrográfica del Duero)', url: 'https://www.saihduero.es/', licencia: 'reutilizacion-sector-publico' },
  jucar: { nombre: 'SAIH Júcar (Confederación Hidrográfica del Júcar)', url: 'https://saih.chj.es/', licencia: 'reutilizacion-sector-publico' },
  euskalmet: { nombre: 'Euskalmet, Gobierno Vasco (Open Data Euskadi)', url: 'https://opendata.euskadi.eus/', licencia: 'cc-by-4.0' },
  aemet: { nombre: 'AEMET, observación horaria', url: 'https://www.aemet.es/', licencia: 'aemet' },
});
```

`scripts/pluvio/utm.mjs`:

```js
// scripts/pluvio/utm.mjs
// UTM (WGS84/ETRS89, hemisferio norte) a latitud y longitud. Las coordenadas del SAIH Tajo y del SAIH Júcar vienen en UTM 30.
export function utmALatLon(x, y, huso) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const xx = x - 500000, M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), T1 = Math.tan(p1) ** 2, C1 = ep2 * Math.cos(p1) ** 2;
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(p1) ** 2, 1.5), D = xx / (N1 * k0);
  const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(p1);
  return { lat: lat * 180 / Math.PI, lon: (huso * 6 - 183) + lon * 180 / Math.PI };
}
```

`scripts/pluvio/seleccion.mjs`:

```js
// scripts/pluvio/seleccion.mjs
// Piezas puras de la selección de estaciones (scripts/pluvio/estaciones.mjs), con pruebas.
import { distanciaKm, MEZCLA } from '../../supabase/functions/_shared/pluvio.js';

const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'y']);
// «OLLA DEL QUIÑON EN BUSTARVIEJO» → «Olla del Quiñon en Bustarviejo» (tras un paréntesis, siempre mayúscula).
export function nombreBonito(texto) {
  const partes = String(texto).toLowerCase().split(/(\s+|-|\()/);
  return partes.map((p, k) => (k > 0 && partes[k - 1] !== '(' && MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
}
export const nombreDuero = (texto) => String(texto).replace(/,\s*PL-[\w.]+$/, '');

export function puntoCercano(e, puntos) {
  let mejor = null;
  for (const p of puntos) { const km = distanciaKm(e, p); if (km != null && (!mejor || km < mejor.km)) mejor = { p, km }; }
  return mejor;
}
export function elegir(candidatas, puntos, { maxKm = MEZCLA.radioKm, maxDesnivel = MEZCLA.desnivelMax, sinAltitud = false } = {}) {
  return candidatas.filter((e) => {
    const c = puntoCercano(e, puntos);
    return !!c && c.km < maxKm && (sinAltitud || (Number.isFinite(e.altitud) && Math.abs(e.altitud - c.p.altitud) <= maxDesnivel));
  });
}
export function resumenPorZona(lista, puntos) {
  const r = {};
  for (const e of lista) { const z = puntoCercano(e, puntos)?.p.zona ?? 'sin zona'; (r[z] ??= {})[e.fuente] = (r[z][e.fuente] ?? 0) + 1; }
  return r;
}
```

- [ ] **Step 4: El script de selección y la sonda**

`scripts/pluvio/estaciones.mjs`:

```js
// scripts/pluvio/estaciones.mjs
//   node scripts/pluvio/estaciones.mjs [--seco]
// Elige los pluviómetros de montaña de cada zona (spec §3.1) y escribe la lista blanca de la función «pluvio»
// (supabase/functions/pluvio/estaciones.json) y la copia de los puntos de zona (puntos.json). Criterio: a menos de 20 km de
// algún punto de data/zonas.json y con menos de 600 m de desnivel con el más cercano; solo pluviómetros (Tajo: pluviómetro
// y pluvionivómetro; Duero: PL; Júcar: P y N; Euskalmet: KM y KA de alta y, si está _fuentes/euskalmet-2026.zip, solo las
// que miden lluvia). AEMET: las de data/zonas.json, que ya están en la lista blanca de la función «aemet».
// Cortesía: unas 80 peticiones en total, con pausa entre las del mismo servidor. --seco solo resume, no escribe.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { crearPedir } from '../../supabase/functions/pluvio/red.js';
import { cadenaTajo, estacionesDeTablaTajo } from '../../supabase/functions/pluvio/lectores/tajo.js';
import { BASE_DUERO, estacionesDeRisr, historicoDeFicha, altitudDeFicha } from '../../supabase/functions/pluvio/lectores/duero.js';
import { urlDiaJucar, estacionesDeJucar } from '../../supabase/functions/pluvio/lectores/jucar.js';
import { URL_ESTACIONES_EUSKALMET, estacionesDeEuskalmet, altitudDeXmlDatos } from '../../supabase/functions/pluvio/lectores/euskalmet.js';
import { FUENTES_LLUVIA } from '../../supabase/functions/_shared/pluvio-fuentes.js';
import { hoyMadrid, sumarDias } from '../../supabase/functions/_shared/meteo.js';
import { conLluviaEnZip } from './euskalmet-zip.mjs';
import { utmALatLon } from './utm.mjs';
import { nombreBonito, nombreDuero, elegir, resumenPorZona } from './seleccion.mjs';

const RAIZ = new URL('../../', import.meta.url);
const seco = process.argv.includes('--seco');
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const licencia = (fuente) => FUENTES_LLUVIA[fuente].licencia;
const zonas = JSON.parse(readFileSync(new URL('data/zonas.json', RAIZ), 'utf8')).zonas;
const puntos = zonas.flatMap((z) => z.puntos.map((p) => ({ id: p.id, zona: z.id, lat: p.lat, lon: p.lon, altitud: p.altitud })));
const pedir = crearPedir({ fetchFn: fetch });

// SAIH Tajo: la tabla trae tipo, UTM y altitud.
const tajo = elegir(estacionesDeTablaTajo(await cadenaTajo(pedir)).filter((e) => e.tipo === 'pluviometro' || e.tipo === 'pluvionivometro')
  .map((e) => { const { lat, lon } = utmALatLon(e.x, e.y, 30); return { fuente: 'tajo', codigo: e.codigo, nombre: nombreBonito(e.nombre), lat: r4(lat), lon: r4(lon), altitud: e.altitud, licencia: licencia('tajo'), url: e.url }; }), puntos);

// SAIH Duero: PL de la página de tiempo real; token y altitud de la ficha, solo de las que están cerca.
const dueroCerca = elegir(estacionesDeRisr(await pedir(`${BASE_DUERO}datos-tiempo-real/risr`, { como: 'texto' })).filter((e) => /^PL\d{3}$/.test(e.codigo)), puntos, { sinAltitud: true });
const dueroConFicha = [];
for (const e of dueroCerca) {
  const ficha = await pedir(`${BASE_DUERO}risr/${e.codigo}`, { como: 'texto' });
  const token = historicoDeFicha(ficha, e.codigo), altitud = altitudDeFicha(ficha);
  if (!token || altitud == null) { console.warn(`duero ${e.codigo} (${e.nombre}): la ficha no trae histórico de lluvia o altitud; se deja fuera`); continue; }
  dueroConFicha.push({ fuente: 'duero', codigo: e.codigo, nombre: nombreDuero(e.nombre), lat: r4(e.lat), lon: r4(e.lon), altitud, licencia: licencia('duero'), token });
}
const duero = elegir(dueroConFicha, puntos);

// SAIH Júcar: listado del día anterior (UTM 30) y altitud del MDT de Open-Meteo (unos 90 m), como en el informe 09.
const jucarCerca = elegir(estacionesDeJucar(await pedir(urlDiaJucar(sumarDias(hoyMadrid(), -1)))).filter((e) => /^\d[PN]\d\d$/.test(e.codigo))
  .map((e) => { const { lat, lon } = utmALatLon(e.x, e.y, 30); return { ...e, lat: r4(lat), lon: r4(lon) }; }), puntos, { sinAltitud: true });
const alturas = jucarCerca.length
  ? (await pedir(`https://api.open-meteo.com/v1/elevation?latitude=${jucarCerca.map((e) => e.lat).join(',')}&longitude=${jucarCerca.map((e) => e.lon).join(',')}`)).elevation : [];
const jucar = elegir(jucarCerca.map((e, k) => ({ fuente: 'jucar', codigo: e.codigo, nombre: nombreBonito(e.nombre), lat: e.lat, lon: e.lon,
  altitud: Math.round(alturas[k]), licencia: licencia('jucar') })), puntos);

// Euskalmet: altitud del XMLdatos de cada candidata.
const eusCerca = elegir(estacionesDeEuskalmet(await pedir(URL_ESTACIONES_EUSKALMET)), puntos, { sinAltitud: true });
const eusConAltitud = [];
for (const e of eusCerca) {
  const altitud = altitudDeXmlDatos(await pedir(e.xmlDatos, { como: 'texto' }));
  if (altitud != null) eusConAltitud.push({ fuente: 'euskalmet', codigo: e.codigo, nombre: e.nombre, lat: r4(e.lat), lon: r4(e.lon), altitud, licencia: licencia('euskalmet') });
}
const zip = new URL('_fuentes/euskalmet-2026.zip', RAIZ);
const conLluvia = existsSync(zip) ? conLluviaEnZip(readFileSync(zip), eusConAltitud.map((e) => e.codigo)) : null;
if (!conLluvia) console.warn('sin _fuentes/euskalmet-2026.zip: no se comprueba qué estaciones de Euskalmet miden lluvia');
const euskalmet = elegir(conLluvia ? eusConAltitud.filter((e) => conLluvia.has(e.codigo)) : eusConAltitud, puntos);

// AEMET: las de data/zonas.json.
const aemet = [...new Map(zonas.flatMap((z) => z.estacionesAemet ?? []).map((e) => [e.id,
  { fuente: 'aemet', codigo: e.id, nombre: e.nombre, lat: e.lat, lon: e.lon, altitud: e.altitud, licencia: licencia('aemet') }])).values()];

const lista = [...aemet, ...tajo, ...duero, ...jucar, ...euskalmet].sort((a, b) => a.fuente.localeCompare(b.fuente) || a.codigo.localeCompare(b.codigo));
console.log(JSON.stringify(resumenPorZona(lista, puntos), null, 1));
console.log(`${lista.length} estaciones: ${['tajo', 'duero', 'jucar', 'euskalmet', 'aemet'].map((f) => `${f} ${lista.filter((e) => e.fuente === f).length}`).join(', ')}`);
if (!seco) {
  writeFileSync(new URL('supabase/functions/pluvio/estaciones.json', RAIZ), `[\n${lista.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n]\n`);
  writeFileSync(new URL('supabase/functions/pluvio/puntos.json', RAIZ), `${JSON.stringify(puntos, null, 1)}\n`);
  console.log('escritos estaciones.json y puntos.json');
}
```

`scripts/pluvio/sonda.mjs`:

```js
// scripts/pluvio/sonda.mjs
//   node scripts/pluvio/sonda.mjs
// Prueba en vivo de cada fuente con la primera estación de la lista blanca, para saber a tiempo si una web cambia de
// formato (fuera de npm test: usa la red). AEMET solo si hay AEMET_API_KEY en el entorno. Sale con 1 si algo falla.
import { readFileSync } from 'node:fs';
import { crearPedir } from '../../supabase/functions/pluvio/red.js';
import { leerTajo } from '../../supabase/functions/pluvio/lectores/tajo.js';
import { leerDuero } from '../../supabase/functions/pluvio/lectores/duero.js';
import { leerJucar } from '../../supabase/functions/pluvio/lectores/jucar.js';
import { leerAemet } from '../../supabase/functions/pluvio/lectores/aemet.js';
import { URL_ESTACIONES_EUSKALMET, estacionesDeEuskalmet } from '../../supabase/functions/pluvio/lectores/euskalmet.js';
import { hoyMadrid, sumarDias } from '../../supabase/functions/_shared/meteo.js';

const lista = JSON.parse(readFileSync(new URL('../../supabase/functions/pluvio/estaciones.json', import.meta.url), 'utf8'));
const pedir = crearPedir({ fetchFn: fetch });
const hoy = hoyMadrid(), primera = (f) => lista.filter((e) => e.fuente === f).slice(0, 1);
const pruebas = {
  tajo: () => leerTajo({ pedir, estaciones: primera('tajo') }),
  duero: () => leerDuero({ pedir, estaciones: primera('duero'), desde: sumarDias(hoy, -2) }),
  jucar: () => leerJucar({ pedir, estaciones: primera('jucar'), fechas: [sumarDias(hoy, -1)] }),
  aemet: () => (process.env.AEMET_API_KEY ? leerAemet({ pedir, clave: process.env.AEMET_API_KEY, estaciones: primera('aemet') }) : null),
  euskalmet: async () => ({ filas: estacionesDeEuskalmet(await pedir(URL_ESTACIONES_EUSKALMET)), errores: [] }),
};
let fallos = 0;
for (const [fuente, probar] of Object.entries(pruebas)) {
  try {
    const r = await probar();
    if (!r) { console.log(`${fuente}: sin probar (falta AEMET_API_KEY)`); continue; }
    const bien = r.filas.length > 0 && !r.errores.length;
    if (!bien) fallos++;
    console.log(`${fuente}: ${bien ? 'bien' : 'FALLA'} · ${r.filas.length} filas${r.errores.length ? ` · ${r.errores.join('; ')}` : ''}`);
  } catch (e) { fallos++; console.log(`${fuente}: FALLA · ${e.message}`); }
}
process.exit(fallos ? 1 : 0);
```

- [ ] **Step 5: Descargar el zip de Euskalmet y generar la lista blanca (en local, con red)**

```bash
mkdir -p _fuentes
curl -s -A "setas-app/1.0 (+https://gonzalotsainz-ux.github.io/setas/)" -o _fuentes/euskalmet-2026.zip \
  https://opendata.euskadi.eus/contenidos/ds_meteorologicos/met_stations_ds_2026/opendata/2026.zip
node scripts/pluvio/estaciones.mjs --seco
node scripts/pluvio/estaciones.mjs
node scripts/pluvio/sonda.mjs
```

Expected: el `--seco` resume por zona (orientativo, del informe 09: Guadarrama unas 10, Sierra Norte unas 10, Soria y
Burgos varias de Duero, Gredos unas 15, Cuenca unas 5 del Júcar, Álava unas 25 de Euskalmet, Montes de Toledo 1 o 2) y
en total unas 80 a 110 estaciones. Si sale un número muy distinto, parar y mirar el resumen antes de escribir. La sonda
dice `bien` para tajo, duero, jucar y euskalmet (aemet, «sin probar»). `_fuentes/` está en `.gitignore`: el zip no se sube.
El zip se queda para la tarea 11.

- [ ] **Step 6: Ejecutar las pruebas y verlas pasar**

Run: `node --test tests/pluvio-seleccion.test.js tests/pluvio-recolector.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/pluvio.js supabase/functions/_shared/pluvio-fuentes.js scripts/pluvio supabase/functions/pluvio/estaciones.json \
  supabase/functions/pluvio/puntos.json tests/pluvio-seleccion.test.js tests/pluvio-recolector.test.js
git commit -m "$(cat <<'EOF'
Pluviómetros: selección de estaciones de montaña por zona (lista blanca de las cinco fuentes) y sonda en vivo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 8: Control de calidad

**Files:**
- Modify: `supabase/functions/pluvio/calidad.js` (versión completa)
- Modify: `supabase/functions/pluvio/publicar.js` (vecinas y modelo de la celda gruesa más cercana)
- Modify: `supabase/functions/pluvio/manejador.js` (`filaObs` con `calidadHora`, `gruesa` en el contexto, `precipCeldas` en el almacén)
- Modify: `supabase/functions/pluvio/index.ts` (importa `../rejilla/gruesa.json`)
- Modify: `tests/dobles-pluvio.js` (`modelo` y `precipCeldas`), `tests/pluvio-recolector.test.js` (calidad de una hora)
- Create: `tests/pluvio-calidad.test.js`

**Interfaces:**
- Consumes: `distanciaKm` (tarea 7); `agregarHoras`, `diasDeFilas` (tarea 4); la función SQL `series_celdas` de la migración de `rejilla` (ya desplegada; `service_role` tiene `execute`).
- Produces:
  - `calidad.js`: `UMBRALES = { horaMax: 60, diaMax: 200, horasMinimas: 20, vecinasKm: 25, picoVeces: 5, picoMm: 25, modeloSeco: 5, secoMediana: 20, secoFraccion: 0.1, secoModelo: 10 }`, `calidadHora(mm, horas = 1) → 'ok'|'sospechoso'|'descartado'|'sin-dato'`, `revisarDia(dia, { vecinas?, modelo? }?, u?) → { calidad, motivo }`, `revisarDias(dias, estaciones?, modeloDe?, u?)`.
  - `publicar.js`: `KM_MODELO = 15`, `celdasCercanas(estaciones, celdas, maxKm?) → Map<'fuente:codigo', idCelda>`; `publicar({ almacen, hoy, ahora, estaciones, gruesa })`.
  - Almacén: `precipCeldas(ids, desde) → Map<idCelda, Map<fecha, mm>>` (solo días observados, no previstos).
  - `ejecutar({ …, gruesa = { celdas: [] } })`.

- [ ] **Step 1: Ampliar los dobles**

En `tests/dobles-pluvio.js`, dentro de `almacenPluvioMemoria`: declarar `const modelo = new Map();` junto a `obs` y
`dias`, devolverlo (`obs, dias, modelo,`) y añadir el método:

```js
    async precipCeldas(ids) { return new Map(ids.filter((id) => modelo.has(id)).map((id) => [id, modelo.get(id)])); },
```

- [ ] **Step 2: Escribir las pruebas que fallan**

`tests/pluvio-calidad.test.js`:

```js
// tests/pluvio-calidad.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calidadHora, revisarDia, revisarDias } from '../supabase/functions/pluvio/calidad.js';
import { celdasCercanas } from '../supabase/functions/pluvio/publicar.js';
import { agregarHoras } from '../supabase/functions/pluvio/dias.js';
import { horasDeHistorico, estacionesDeRisr } from '../supabase/functions/pluvio/lectores/duero.js';
import { filaObs, ejecutar } from '../supabase/functions/pluvio/manejador.js';
import { fixture, servidorFalso, almacenPluvioMemoria } from './dobles-pluvio.js';

const risr = estacionesDeRisr(fixture('duero-risr.html'));
const EST = [['PL002', 'Covaleda', 1445], ['PL031', 'Quintanar de la Sierra', 1343]].map(([codigo, nombre, altitud]) => {
  const e = risr.find((x) => x.codigo === codigo);
  return { fuente: 'duero', codigo, nombre, lat: e.lat, lon: e.lon, altitud };
});
const horas = (codigo) => horasDeHistorico(fixture(`duero-historico-${codigo}.html`), codigo).map((h) => filaObs('duero', h));
const DIAS = agregarHoras([...horas('PL002'), ...horas('PL031')], '2026-08-01');
const de = (r, estacion, fecha) => r.find((d) => d.estacion === estacion && d.fecha === fecha);
const CELDA = { id: 'soria:1:1', zona: 'soria', lat: 42.0, lon: -2.95, altRef: 1300 };

test('una hora: negativo → descartado; más de 60 mm → sospechoso; sin número → sin dato; un total diario no es una hora', () => {
  assert.equal(calidadHora(-0.1), 'descartado');
  assert.equal(calidadHora(60), 'ok');
  assert.equal(calidadHora(60.1), 'sospechoso');
  assert.equal(calidadHora(null), 'sin-dato');
  assert.equal(calidadHora(Number.NaN), 'sin-dato');
  assert.equal(calidadHora(70, 24), 'ok');
  assert.equal(filaObs('duero', { estacion: 'PL031', hora: '2026-08-27T11:00:00.000Z', mm: 120 }).calidad, 'sospechoso');
});

test('Quintanar de la Sierra (casos reales): 551,9 mm el 27/08, pico aislado el 28/08, 186,6 mm en 16 horas el 30/09', () => {
  const r = revisarDias(DIAS, EST, () => 0.4);
  assert.deepEqual(de(r, 'PL031', '2026-08-27').calidad, 'sospechoso');
  assert.equal(de(r, 'PL031', '2026-08-27').motivo, 'una hora con 120 mm (más de 60)');
  assert.equal(de(r, 'PL031', '2026-08-28').calidad, 'sospechoso');
  assert.equal(de(r, 'PL031', '2026-08-28').motivo, 'pico aislado: 144.8 mm frente a 0 de sus vecinas y 0.4 del modelo');
  assert.equal(de(r, 'PL031', '2026-09-30').calidad, 'sospechoso');   // una hora de 81,9 mm (y además incompleto)
  assert.equal(de(r, 'PL002', '2026-09-17').calidad, 'incompleto');
  assert.deepEqual({ ...de(r, 'PL002', '2026-08-27') }, { fuente: 'duero', estacion: 'PL002', fecha: '2026-08-27', mm: 3.8, horas: 24, maximo: 1.7, calidad: 'ok', motivo: null });
});

test('sin modelo no se aplica la regla del pico: el 28/08 de Quintanar pasaría (por eso se usa el de la celda gruesa)', () => {
  assert.equal(de(revisarDias(DIAS, EST), 'PL031', '2026-08-28').calidad, 'ok');
});

test('una tormenta de verdad (como La Cierva en septiembre) no es un pico aislado', () => {
  assert.deepEqual(revisarDia({ mm: 40, horas: 24, maximo: 18 }, { vecinas: [12, 15], modelo: 3 }), { calidad: 'ok', motivo: null });
});

// Review Focus 3: báscula atascada en 0 mientras llueve alrededor.
test('pluviómetro atascado: 0 mm con vecinas de 25 y 31 y modelo de 18 → sospechoso; con el modelo seco, no', () => {
  assert.deepEqual(revisarDia({ mm: 0, horas: 24, maximo: 0 }, { vecinas: [25, 31], modelo: 18 }),
    { calidad: 'sospechoso', motivo: 'seco aislado: 0 mm frente a 28 de sus vecinas y 18 del modelo' });
  assert.equal(revisarDia({ mm: 0, horas: 24, maximo: 0 }, { vecinas: [25, 31], modelo: 4 }).calidad, 'ok');
});

test('límite del día: más de 200 mm', () => {
  assert.deepEqual(revisarDia({ mm: 210, horas: 24, maximo: 30 }), { calidad: 'sospechoso', motivo: '210 mm en el día (más de 200)' });
});

test('la celda gruesa más cercana a cada estación (a menos de 15 km)', () => {
  const m = celdasCercanas(EST, [CELDA, { id: 'lejos', lat: 41, lon: -4 }]);
  assert.deepEqual([...m], [['duero:PL002', 'soria:1:1'], ['duero:PL031', 'soria:1:1']]);
  assert.equal(celdasCercanas(EST, [{ id: 'lejos', lat: 41, lon: -4 }]).size, 0);
});

test('publicar marca en lluvia_dia el pico de Quintanar con el modelo de meteo_celdas', async () => {
  const almacen = almacenPluvioMemoria();
  await almacen.guardarObs([...horas('PL002'), ...horas('PL031')]);
  almacen.modelo.set('soria:1:1', new Map([['2026-08-28', 0.4]]));
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([]), esperar: async () => {}, ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: EST, gruesa: { celdas: [CELDA] }, pedidas: ['publicar'] });
  assert.deepEqual(r.errores, []);
  assert.equal(almacen.dias.get('duero|PL031|2026-08-28').calidad, 'sospechoso');
  assert.match(almacen.dias.get('duero|PL031|2026-08-28').motivo, /^pico aislado/);
  assert.equal(almacen.dias.get('duero|PL031|2026-08-27').calidad, 'sospechoso');
  assert.equal(almacen.dias.get('duero|PL002|2026-08-28').calidad, 'ok');
});
```

En `tests/pluvio-recolector.test.js`, en la prueba «ejecutar: guarda en bruto con su fuente…», cambiar el título por
`'ejecutar: guarda cada hora con su fuente y su calidad; tajo10 se guarda como tajo; sin clave de AEMET, Tajo sigue'` y,
en el `deepEqual` de `una`, `calidad: 'bruto'` por `calidad: 'ok'`.

- [ ] **Step 3: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-calidad.test.js`
Expected: FAIL con `calidadHora is not a function` (o `does not provide an export named 'calidadHora'`).

- [ ] **Step 4: `calidad.js` completo**

Sustituir `supabase/functions/pluvio/calidad.js` por:

```js
// supabase/functions/pluvio/calidad.js
// Control de calidad de la lluvia medida (spec §3.2). Todos los umbrales viven aquí. Lo sospechoso no entra en la nota:
// queda guardado en lluvia_dia con su motivo.
//  - Una hora: negativa → descartada; más de 60 mm → sospechosa (un total diario, como el del Júcar, no es una hora).
//  - Un día: alguna hora de más de 60 mm o más de 200 mm en el día → sospechoso; menos de 20 horas con dato → incompleto.
//  - Pico aislado: mucho más que la mediana de sus vecinas (< 25 km) Y el modelo casi seco → sospechoso (Quintanar 28/08).
//  - Seco aislado (Review Focus 3): casi nada cuando sus vecinas y el modelo dicen que llovió mucho → sospechoso.
//  Las dos últimas solo con modelo: sin él no se sabe si fue una tormenta local.
import { distanciaKm } from '../_shared/pluvio.js';

export const UMBRALES = Object.freeze({
  horaMax: 60, diaMax: 200, horasMinimas: 20,
  vecinasKm: 25, picoVeces: 5, picoMm: 25, modeloSeco: 5,
  secoMediana: 20, secoFraccion: 0.1, secoModelo: 10,
});
const r1 = (x) => Math.round(x * 10) / 10;
const mediana = (v) => { const s = [...v].sort((a, b) => a - b), k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

export function calidadHora(mm, horas = 1, u = UMBRALES) {
  if (typeof mm !== 'number' || !Number.isFinite(mm)) return 'sin-dato';
  if (mm < 0) return 'descartado';
  if (horas === 1 && mm > u.horaMax) return 'sospechoso';
  return 'ok';
}

export function revisarDia(dia, { vecinas = [], modelo = null } = {}, u = UMBRALES) {
  if (dia.mm == null || !dia.horas) return { calidad: 'sin-dato', motivo: 'ninguna hora con dato' };
  if (dia.maximo != null && dia.maximo > u.horaMax) return { calidad: 'sospechoso', motivo: `una hora con ${r1(dia.maximo)} mm (más de ${u.horaMax})` };
  if (dia.mm > u.diaMax) return { calidad: 'sospechoso', motivo: `${r1(dia.mm)} mm en el día (más de ${u.diaMax})` };
  if (dia.horas < u.horasMinimas) return { calidad: 'incompleto', motivo: `solo ${dia.horas} horas con dato` };
  if (vecinas.length && modelo != null) {
    const med = mediana(vecinas), frente = `frente a ${r1(med)} de sus vecinas y ${r1(modelo)} del modelo`;
    if (modelo < u.modeloSeco && dia.mm > u.picoVeces * med && dia.mm - med > u.picoMm) return { calidad: 'sospechoso', motivo: `pico aislado: ${r1(dia.mm)} mm ${frente}` };
    if (modelo >= u.secoModelo && med >= u.secoMediana && dia.mm < u.secoFraccion * med) return { calidad: 'sospechoso', motivo: `seco aislado: ${r1(dia.mm)} mm ${frente}` };
  }
  return { calidad: 'ok', motivo: null };
}

// Dos pasadas: primero los límites y el día incompleto; después, entre los días buenos, vecinas y modelo.
export function revisarDias(dias, estaciones = [], modeloDe = () => null, u = UMBRALES) {
  const pos = new Map(estaciones.map((e) => [`${e.fuente}:${e.codigo}`, e]));
  const primera = dias.map((d) => ({ ...d, ...revisarDia(d, {}, u) }));
  const buenas = new Map();
  for (const d of primera) if (d.calidad === 'ok') {
    if (!buenas.has(d.fecha)) buenas.set(d.fecha, []);
    buenas.get(d.fecha).push({ clave: `${d.fuente}:${d.estacion}`, mm: d.mm });
  }
  return primera.map((d) => {
    if (d.calidad !== 'ok') return d;
    const clave = `${d.fuente}:${d.estacion}`, yo = pos.get(clave);
    const vecinas = yo ? (buenas.get(d.fecha) ?? []).filter((v) => {
      if (v.clave === clave) return false;
      const km = distanciaKm(yo, pos.get(v.clave));
      return km != null && km < u.vecinasKm;
    }).map((v) => v.mm) : [];
    return { ...d, ...revisarDia(d, { vecinas, modelo: modeloDe(clave, d.fecha) }, u) };
  });
}
```

- [ ] **Step 5: Publicar con vecinas y modelo; calidad de cada hora**

Sustituir `supabase/functions/pluvio/publicar.js` por:

```js
// supabase/functions/pluvio/publicar.js
// Paso de «pluvio» a las 4 y a las 16 UTC, tras las lecturas: agrega las horas por día de Madrid desde el 1 de agosto,
// aplica el control de calidad (con las vecinas y el modelo de la celda gruesa más cercana, de meteo_celdas) y guarda
// lluvia_dia. Solo días ya cerrados (hasta ayer) y estaciones de la lista blanca.
import { agostoDe, sumarDias } from '../_shared/meteo.js';
import { distanciaKm } from '../_shared/pluvio.js';
import { diasDeFilas } from './dias.js';
import { revisarDias } from './calidad.js';

export const KM_MODELO = 15;   // más lejos, el modelo de la celda ya no representa a la estación

export function celdasCercanas(estaciones, celdas, maxKm = KM_MODELO) {
  const r = new Map();
  for (const e of estaciones) {
    let mejor = null;
    for (const c of celdas) { const km = distanciaKm(e, c); if (km != null && km <= maxKm && (!mejor || km < mejor.km)) mejor = { id: c.id, km }; }
    if (mejor) r.set(`${e.fuente}:${e.codigo}`, mejor.id);
  }
  return r;
}

export async function publicar({ almacen, hoy, ahora, estaciones, gruesa = { celdas: [] } }) {
  const desde = agostoDe(hoy), hasta = sumarDias(hoy, -1);
  const conocidas = new Set(estaciones.map((e) => `${e.fuente}:${e.codigo}`));
  const dias = diasDeFilas(await almacen.diasPorEstacion(desde)).filter((d) => d.fecha <= hasta && conocidas.has(`${d.fuente}:${d.estacion}`));
  const cercana = celdasCercanas(estaciones, gruesa.celdas);
  const modelo = cercana.size ? await almacen.precipCeldas([...new Set(cercana.values())], desde) : new Map();
  const modeloDe = (clave, fecha) => modelo.get(cercana.get(clave))?.get(fecha) ?? null;
  const revisados = revisarDias(dias, estaciones, modeloDe);
  await almacen.guardarDias(revisados.map((d) => ({ ...d, actualizado: ahora.toISOString() })));
  return { dias: revisados.length };
}
```

En `supabase/functions/pluvio/manejador.js`:

1. `import { calidadHora } from './calidad.js';` y cambiar `filaObs` por:

```js
export const filaObs = (fuente, f) => ({ fuente, estacion: f.estacion, hora: f.hora, horas: f.horas ?? 1, mm: f.mm, calidad: calidadHora(f.mm, f.horas ?? 1) });
```

2. En la firma de `ejecutar`, añadir `gruesa = { celdas: [] }` (después de `claveAemet = null`) y pasarlo al paso:
`r.pasos[t] = await tarea.paso({ almacen, hoy, ahora, estaciones, gruesa });`

3. En `almacenSupabase`, añadir:

```js
    // Lluvia del modelo (best_match) de unas celdas gruesas, de la función SQL de «rejilla»; solo los días observados.
    async precipCeldas(ids, desde) {
      const filas = datos(await admin.rpc('series_celdas', { p_celdas: ids, p_desde: desde }));
      return new Map(filas.map((f) => [f.celda, new Map(f.fechas.map((d, k) => [String(d).slice(0, 10), f.previsto[k] ? null : f.precip[k]]).filter(([, v]) => v != null))]));
    },
```

En `supabase/functions/pluvio/index.ts`, añadir `import GRUESA from '../rejilla/gruesa.json' with { type: 'json' };` y pasar
`gruesa: GRUESA` a `ejecutar`.

- [ ] **Step 6: Ejecutar las pruebas y verlas pasar**

Run: `npm test`
Expected: PASS (todas, también las de las tareas 1 a 7).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/pluvio tests/dobles-pluvio.js tests/pluvio-calidad.test.js tests/pluvio-recolector.test.js
git commit -m "$(cat <<'EOF'
Pluviómetros: control de calidad (límites, día incompleto, pico y seco aislados con vecinas y modelo)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 9: Mezcla por distancia y altitud, sesgo del modelo y aplicación a una serie

**Files:**
- Modify: `supabase/functions/_shared/pluvio.js` (versión completa)
- Create: `tests/pluvio-mezcla.test.js`

**Interfaces:**
- Consumes: `MEZCLA`, `distanciaKm` (tarea 7); `sumarDias`, `entreDias` de `_shared/meteo.js`; `serieSintetica` de `tests/ayudas.js`.
- Produces (en `_shared/pluvio.js`):
  - `VERSION_PLUVIO = 1`, `SESGO = { dias: 30, min: 0.5, max: 2, modeloMinimo: 10, paresMinimos: 10 }`.
  - `pesoEstacion(km, desnivel, m?) → number` (0 fuera del radio o del desnivel).
  - `cercanas(lugar, estaciones, m?) → [{ clave: 'fuente:codigo', nombre, fuente, km, peso }]` por distancia.
  - `mezclarDia(cerca, valores: Map<clave, mm>) → { mm, n } | null`.
  - `seriesMedidas(lugares, estaciones, validos: Map<clave, Map<fecha, mm>>, desde, hasta) → { [id]: { mm: (number|null)[], n: number[], estaciones: [{ nombre, fuente, km }], cercanas: number } }` (lugar sin ninguna estación en radio: no sale).
  - `paresSesgo(serieModelo, medida, desde, hasta, dias?) → [{ medida, modelo }]`.
  - `factorSesgo(pares, s?) → number` (1 si no hay datos bastantes).
  - `aplicarMedida(serie, medida|null, { desde, hasta, factor? }) → serie` (`origenPrecip` `'medida'` o `'estimada'`; la misma serie si nada cambia).
  - `validarPluvio(p) → string[]`.
  - Formato de `pluvio/ultimo.json` y `pluvio/celdas.json`: `{ version, generado, desde, hasta, lugares, fuentes?, aemet? }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/pluvio-mezcla.test.js`:

```js
// tests/pluvio-mezcla.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pesoEstacion, cercanas, mezclarDia, seriesMedidas, paresSesgo, factorSesgo, aplicarMedida, validarPluvio, VERSION_PLUVIO } from '../supabase/functions/_shared/pluvio.js';
import { serieSintetica } from './ayudas.js';

const est = (codigo, lat, altitud = 1200) => ({ fuente: 'tajo', codigo, nombre: codigo, lat, lon: -4, altitud });
const LUGAR = { id: 'p', lat: 40, lon: -4, altitud: 1200 };
const mapa = (o) => new Map(Object.entries(o));

test('peso: inverso del cuadrado de la distancia (desde 1 km) y menor con el desnivel; 0 fuera de 20 km o de 600 m', () => {
  assert.equal(pesoEstacion(2, 0), 0.25);
  assert.equal(pesoEstacion(4, 300), 0.03125);
  assert.equal(pesoEstacion(0.3, 0), 1);
  assert.equal(pesoEstacion(21, 0), 0);
  assert.equal(pesoEstacion(5, 601), 0);
  assert.equal(pesoEstacion(5, -601), 0);
});

test('cercanas: por distancia, con su clave y su km; fuera las lejanas y las de mucho desnivel', () => {
  const l = cercanas(LUGAR, [est('B', 40.1, 1500), est('A', 40.018), est('C', 40.3), est('D', 40.01, 1900)]);
  assert.deepEqual(l.map((c) => [c.clave, c.km]), [['tajo:A', 2], ['tajo:B', 11.1]]);
  assert.ok(Math.abs(l[0].peso - 1 / (0.018 * 111.195) ** 2) < 1e-3);
});

test('mezclarDia: media ponderada de las que tienen dato ese día', () => {
  const cerca = [{ clave: 'a', peso: 0.25 }, { clave: 'b', peso: 0.03125 }];
  assert.deepEqual(mezclarDia(cerca, mapa({ a: 10, b: 20 })), { mm: 11.1, n: 2 });
  assert.deepEqual(mezclarDia(cerca, mapa({ b: 20 })), { mm: 20, n: 1 });
  assert.equal(mezclarDia(cerca, new Map()), null);
});

test('seriesMedidas: un valor por día con las estaciones que lo dan; sin estación en radio, el lugar no sale', () => {
  const estaciones = [est('S1', 40.018), est('S2', 39.982), est('R', 40.51)];
  const validos = new Map([['tajo:S1', mapa({ '2026-09-28': 4, '2026-09-29': 0 })], ['tajo:S2', mapa({ '2026-09-28': 10, '2026-09-30': 6 })]]);
  const lugares = [LUGAR, { id: 'lejos', lat: 41.5, lon: -4, altitud: 1200 }, { id: 'roto', lat: 40.5, lon: -4, altitud: 1200 }];
  const r = seriesMedidas(lugares, estaciones, validos, '2026-09-28', '2026-09-30');
  assert.deepEqual(r.p, { mm: [7, 0, 6], n: [2, 1, 1], estaciones: [{ nombre: 'S1', fuente: 'tajo', km: 2 }, { nombre: 'S2', fuente: 'tajo', km: 2 }], cercanas: 2 });
  assert.equal(r.lejos, undefined);
  // Review Focus 5: con estación cerca pero sin ningún día válido sale, sin estaciones que aporten.
  assert.deepEqual(r.roto, { mm: [null, null, null], n: [0, 0, 0], estaciones: [], cercanas: 1 });
});

test('sesgo: cociente de 30 días acotado entre 0,5 y 2; con pocos datos, 1', () => {
  const pares = (n, medida, modelo) => Array.from({ length: n }, () => ({ medida, modelo }));
  assert.equal(factorSesgo(pares(10, 3, 2)), 1.5);
  assert.equal(factorSesgo(pares(9, 3, 2)), 1);       // menos de 10 días
  assert.equal(factorSesgo(pares(10, 1, 0.9)), 1);    // el modelo casi seco: 9 mm, no se corrige
  assert.equal(factorSesgo(pares(10, 10, 2)), 2);
  assert.equal(factorSesgo(pares(10, 0.1, 2)), 0.5);
  assert.equal(factorSesgo([]), 1);
});

// Serie de 60 días del 03/08 al 01/10 (hoy = 01/10) y medida del 01/08 al 30/09 (61 días).
const DESDE = '2026-08-01', HASTA = '2026-09-30';
const medidaCon = (valores) => { const mm = Array(61).fill(null); for (const [k, v] of Object.entries(valores)) mm[k] = v; return { mm, n: mm.map((v) => (v == null ? 0 : 1)), estaciones: [], cercanas: 1 }; };

test('paresSesgo: solo los últimos 30 días hasta «hasta» con medida y modelo', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: () => 2 });
  const m = medidaCon(Object.fromEntries(Array.from({ length: 12 }, (_, k) => [60 - k, 1])));   // del 19/09 al 30/09
  const p = paresSesgo(s, m, DESDE, HASTA);
  assert.equal(p.length, 12);
  assert.deepEqual(p[0], { medida: 1, modelo: 2 });
  assert.equal(paresSesgo(s, medidaCon({ 2: 5 }), DESDE, HASTA).length, 0);   // el 03/08 queda fuera de los 30 días
});

test('aplicarMedida: medido donde lo hay, el modelo corregido en el resto del tramo, hoy y la previsión intactos', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: () => 2 });
  const r = aplicarMedida(s, medidaCon({ 59: 0, 60: 5 }), { desde: DESDE, hasta: HASTA, factor: 1.5 });
  assert.equal(r.fechas[57], '2026-09-29');
  assert.deepEqual([r.precip[57], r.origenPrecip[57]], [0, 'medida']);
  assert.deepEqual([r.precip[58], r.origenPrecip[58]], [5, 'medida']);
  assert.deepEqual([r.precip[0], r.origenPrecip[0]], [3, 'estimada']);
  assert.deepEqual([r.precip[59], r.origenPrecip[59]], [2, 'modelo']);   // hoy
  assert.equal(s.precip[57], 2, 'no se toca la serie de entrada');
});

test('aplicarMedida: sin medida y sin corrección devuelve la misma serie; la lluvia antes de la serie, medida si está entera', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: () => 2 });
  assert.equal(aplicarMedida(s, null, { desde: DESDE, hasta: HASTA }), s);
  const r = aplicarMedida(s, medidaCon({ 0: 1, 1: 2 }), { desde: DESDE, hasta: HASTA });
  assert.deepEqual(r.lluviaAntesDeSerie, { desde: '2026-08-01', mm: 3, origen: 'medida' });
  assert.equal(aplicarMedida(s, medidaCon({ 0: 1 }), { desde: DESDE, hasta: HASTA }), s, 'falta el 02/08: no se sustituye y nada cambia');
});

test('validarPluvio: versión, fechas y lugares bien formados', () => {
  const bueno = { version: VERSION_PLUVIO, generado: '2026-10-02T04:10:00.000Z', desde: '2026-09-29', hasta: '2026-09-30',
    lugares: { p: { mm: [1.2, null], n: [1, 0], estaciones: [{ nombre: 'S1', fuente: 'tajo', km: 2 }], cercanas: 1 } }, aemet: { '3104Y': { '2026-09-29': 0.4 } } };
  assert.deepEqual(validarPluvio(bueno), []);
  assert.deepEqual(validarPluvio({ ...bueno, version: 2 }), ['versión desconocida']);
  assert.deepEqual(validarPluvio({ ...bueno, lugares: { p: { ...bueno.lugares.p, mm: [1] } } }), ['lugar p mal formado']);
  assert.deepEqual(validarPluvio({ ...bueno, lugares: { p: { ...bueno.lugares.p, mm: [-1, 0] } } }), ['lugar p mal formado']);
  assert.deepEqual(validarPluvio({ ...bueno, aemet: { x: { ayer: 1 } } }), ['aemet mal formado']);
  assert.deepEqual(validarPluvio(null), ['versión desconocida', 'desde/hasta mal formados', 'sin lugares']);
});

test('el módulo compartido no usa el DOM (Deno no tiene document)', () => {
  for (const n of ['pluvio', 'pluvio-fuentes']) assert.doesNotMatch(readFileSync(`supabase/functions/_shared/${n}.js`, 'utf8'), /\bdocument\.|\bwindow\./, n);
});
```

Comprobación de `paresSesgo`: la medida tiene índice `k` = días desde el 01/08; 60 es el 30/09 y 49 el 19/09; los 12
están dentro de los 30 días (del 01/09 al 30/09) y antes de hoy. El índice 2 es el 03/08.

- [ ] **Step 2: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-mezcla.test.js`
Expected: FAIL con `does not provide an export named 'pesoEstacion'`.

- [ ] **Step 3: Completar `_shared/pluvio.js`**

Sustituir `supabase/functions/_shared/pluvio.js` por:

```js
// supabase/functions/_shared/pluvio.js
// Lluvia medida en pluviómetros (spec §3.3), compartido por la función «pluvio», la función «rejilla» y el navegador
// (vía .nojekyll). Sin DOM ni red.
//  - Mezcla: para un lugar (punto de zona o celda gruesa), la lluvia de un día es la media ponderada de las estaciones
//    válidas a menos de 20 km y 600 m de desnivel; peso = 1/km² (desde 1 km) / (1 + |desnivel| / 300). [CRITERIO PROPIO]
//  - Sesgo: en los días sin estación válida, el modelo se multiplica por el cociente medido/modelo de los últimos 30 días
//    en los lugares de la zona que sí tienen estación, acotado entre 0,5 y 2; con menos de 10 días o menos de 10 mm del
//    modelo no se corrige.
//  - Archivos publicados (pluvio/ultimo.json por punto de zona, pluvio/celdas.json por celda gruesa):
//    { version, generado, desde, hasta, lugares: { id: { mm, n, estaciones, cercanas } }, fuentes?, aemet? } (docs/datos.md).
import { sumarDias, entreDias } from './meteo.js';

export const VERSION_PLUVIO = 1;
export const MEZCLA = Object.freeze({ radioKm: 20, desnivelMax: 600, escalaDesnivel: 300, kmMin: 1 });
export const SESGO = Object.freeze({ dias: 30, min: 0.5, max: 2, modeloMinimo: 10, paresMinimos: 10 });
const r1 = (x) => Math.round(x * 10) / 10;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Distancia en km entre dos coordenadas (haversine); null si falta alguna.
export function distanciaKm(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every(Number.isFinite)) return null;
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function pesoEstacion(km, desnivel, m = MEZCLA) {
  if (!(km <= m.radioKm) || !(Math.abs(desnivel) <= m.desnivelMax)) return 0;
  return 1 / Math.max(km, m.kmMin) ** 2 / (1 + Math.abs(desnivel) / m.escalaDesnivel);
}
export function cercanas(lugar, estaciones, m = MEZCLA) {
  return estaciones.flatMap((e) => {
    const km = distanciaKm(lugar, e);
    if (km == null || !Number.isFinite(e.altitud) || !Number.isFinite(lugar.altitud)) return [];
    const peso = pesoEstacion(km, e.altitud - lugar.altitud, m);
    return peso > 0 ? [{ clave: `${e.fuente}:${e.codigo}`, nombre: e.nombre, fuente: e.fuente, km: r1(km), peso }] : [];
  }).sort((a, b) => a.km - b.km);
}
export function mezclarDia(cerca, valores) {
  let s = 0, w = 0, n = 0;
  for (const c of cerca) if (valores.has(c.clave)) { s += c.peso * valores.get(c.clave); w += c.peso; n++; }
  return n ? { mm: r1(s / w), n } : null;
}
export function seriesMedidas(lugares, estaciones, validos, desde, hasta) {
  const fechas = Array.from({ length: entreDias(desde, hasta) + 1 }, (_, k) => sumarDias(desde, k));
  const r = {};
  for (const l of lugares) {
    const cerca = cercanas(l, estaciones);
    if (!cerca.length) continue;
    const usadas = new Set(), mm = [], n = [];
    for (const f of fechas) {
      const valores = new Map();
      for (const c of cerca) { const v = validos.get(c.clave)?.get(f); if (v != null) valores.set(c.clave, v); }
      const d = mezclarDia(cerca, valores);
      mm.push(d?.mm ?? null);
      n.push(d?.n ?? 0);
      for (const k of valores.keys()) usadas.add(k);
    }
    r[l.id] = { mm, n, estaciones: cerca.filter((c) => usadas.has(c.clave)).map(({ nombre, fuente, km }) => ({ nombre, fuente, km })), cercanas: cerca.length };
  }
  return r;
}

// Pares (medido, modelo) de los últimos `dias` días hasta `hasta`, de una serie del MODELO (antes de aplicar la medida).
export function paresSesgo(serie, medida, desde, hasta, dias = SESGO.dias) {
  if (!medida?.mm) return [];
  const inicio = sumarDias(hasta, -(dias - 1));
  return serie.fechas.flatMap((f, j) => {
    if (j >= serie.hoy || f < inicio || f > hasta || f < desde) return [];
    const m = medida.mm[entreDias(desde, f)], p = serie.precip[j];
    return m != null && p != null && !Number.isNaN(p) ? [{ medida: m, modelo: p }] : [];
  });
}
export function factorSesgo(pares, s = SESGO) {
  if (pares.length < s.paresMinimos) return 1;
  const med = pares.reduce((t, p) => t + p.medida, 0), mod = pares.reduce((t, p) => t + p.modelo, 0);
  if (mod < s.modeloMinimo) return 1;
  return Math.round(Math.min(s.max, Math.max(s.min, med / mod)) * 100) / 100;
}

// La serie con la lluvia medida en los días del tramo [desde, hasta] que la tienen ('medida') y el modelo corregido por
// `factor` en los demás días pasados del tramo ('estimada'). Hoy y la previsión siguen siendo del modelo. Si la medida
// cubre entera la lluvia anterior a la serie (del 1 de agosto al día antes de su primera fecha), la sustituye.
export function aplicarMedida(serie, medida, { desde, hasta, factor = 1 }) {
  if (!medida && factor === 1) return serie;
  const precip = [...serie.precip], origenPrecip = serie.origenPrecip ? [...serie.origenPrecip] : serie.fechas.map(() => 'modelo');
  let cambia = false;
  serie.fechas.forEach((f, j) => {
    if (j >= serie.hoy || f < desde || f > hasta) return;
    const v = medida?.mm?.[entreDias(desde, f)];
    if (v != null) { precip[j] = v; origenPrecip[j] = 'medida'; cambia = true; }
    else if (factor !== 1 && precip[j] != null && !Number.isNaN(precip[j])) { precip[j] = precip[j] * factor; origenPrecip[j] = 'estimada'; cambia = true; }
  });
  let lluviaAntesDeSerie = serie.lluviaAntesDeSerie;
  const antes = serie.lluviaAntesDeSerie;
  if (medida?.mm && antes?.desde && antes.desde >= desde) {
    const n = entreDias(antes.desde, serie.fechas[0]), k0 = entreDias(desde, antes.desde);
    const vals = Array.from({ length: n }, (_, k) => medida.mm[k0 + k]);
    if (n > 0 && vals.every((v) => v != null)) { lluviaAntesDeSerie = { ...antes, mm: r1(vals.reduce((a, b) => a + b, 0)), origen: 'medida' }; cambia = true; }
  }
  return cambia ? { ...serie, precip, origenPrecip, lluviaAntesDeSerie } : serie;
}

const num0 = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function validarPluvio(p) {
  const e = [];
  if (p?.version !== VERSION_PLUVIO) e.push('versión desconocida');
  const fechasBien = FECHA.test(p?.desde ?? '') && FECHA.test(p?.hasta ?? '') && p.hasta >= p.desde;
  if (!fechasBien) e.push('desde/hasta mal formados');
  if (!p?.lugares || typeof p.lugares !== 'object') { e.push('sin lugares'); return e; }
  const largo = fechasBien ? entreDias(p.desde, p.hasta) + 1 : -1;
  for (const [id, l] of Object.entries(p.lugares)) {
    const bien = Array.isArray(l?.mm) && l.mm.length === largo && l.mm.every((v) => v === null || num0(v))
      && Array.isArray(l.n) && l.n.length === largo && l.n.every(Number.isInteger)
      && Array.isArray(l.estaciones) && l.estaciones.every((s) => typeof s?.nombre === 'string') && Number.isInteger(l.cercanas);
    if (!bien) e.push(`lugar ${id} mal formado`);
  }
  if (p.aemet != null && (typeof p.aemet !== 'object' || !Object.values(p.aemet).every((d) => d && typeof d === 'object'
    && Object.entries(d).every(([f, v]) => FECHA.test(f) && num0(v))))) e.push('aemet mal formado');
  return e;
}
```

Comprobaciones: `seriesMedidas` del 28/09: S1 y S2 a 2,0 km y sin desnivel pesan igual → (4 + 10) / 2 = 7. `cercanas`
de `B`: 0,1° de latitud son 11,1 km y 300 m de desnivel, dentro de 20 km y 600 m. `aplicarMedida`: la serie sintética
empieza el 03/08, así que `lluviaAntesDeSerie` cubre el 01/08 y el 02/08 (índices 0 y 1 de la medida).

- [ ] **Step 4: Ejecutar las pruebas y verlas pasar**

Run: `node --test tests/pluvio-mezcla.test.js tests/pluvio-seleccion.test.js tests/pluvio-calidad.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/pluvio.js tests/pluvio-mezcla.test.js
git commit -m "$(cat <<'EOF'
Pluviómetros: mezcla por distancia y altitud, sesgo de 30 días del modelo y aplicación a una serie

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 10: Publicación de `pluvio/ultimo.json` y `pluvio/celdas.json`

**Files:**
- Modify: `supabase/functions/pluvio/publicar.js` (`construirPublicacion` y subida)
- Modify: `supabase/functions/pluvio/manejador.js` (`puntos` en `ejecutar` y el contexto; `subir` en el almacén)
- Modify: `supabase/functions/pluvio/index.ts` (importa `./puntos.json`)
- Modify: `tests/dobles-pluvio.js` (`archivos` y `subir`)
- Create: `tests/pluvio-publicar.test.js`

**Interfaces:**
- Consumes: `seriesMedidas`, `validarPluvio`, `VERSION_PLUVIO` (tarea 9); `revisarDias` (tarea 8); `puntos.json` (tarea 7).
- Produces: `construirPublicacion({ revisados, estaciones, puntos, celdas, desde, hasta, generado }) → { ultimo, celdas }`; `publicar` sube `pluvio/celdas.json` (caché 3.600 s) y después `pluvio/ultimo.json` (caché 600 s) al bucket `indice`, y devuelve `{ dias, puntos, celdas }` (sin `puntos` en el contexto, solo `{ dias }`). URL pública: `https://ctgedeunquvmcfqsufjj.supabase.co/storage/v1/object/public/indice/pluvio/ultimo.json`. Almacén: `subir(nombre, json, cacheControl)`.

- [ ] **Step 1: Ampliar los dobles**

En `almacenPluvioMemoria`: `const archivos = new Map();`, devolverlo (`obs, dias, modelo, archivos,`) y añadir:

```js
    async subir(nombre, json) { archivos.set(nombre, JSON.parse(JSON.stringify(json))); },
```

- [ ] **Step 2: Escribir las pruebas que fallan**

`tests/pluvio-publicar.test.js`:

```js
// tests/pluvio-publicar.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirPublicacion } from '../supabase/functions/pluvio/publicar.js';
import { validarPluvio } from '../supabase/functions/_shared/pluvio.js';
import { entreDias } from '../supabase/functions/_shared/meteo.js';
import { horasDeHistorico, estacionesDeRisr } from '../supabase/functions/pluvio/lectores/duero.js';
import { filaObs, ejecutar, fuentesQueTocan } from '../supabase/functions/pluvio/manejador.js';
import { fixture, servidorFalso, almacenPluvioMemoria } from './dobles-pluvio.js';

const risr = estacionesDeRisr(fixture('duero-risr.html'));
const EST = [['PL002', 'Covaleda', 1445], ['PL031', 'Quintanar de la Sierra', 1343]].map(([codigo, nombre, altitud]) => {
  const e = risr.find((x) => x.codigo === codigo);
  return { fuente: 'duero', codigo, nombre, lat: e.lat, lon: e.lon, altitud };
});
const PUNTO = { id: 'soria-pinar-grande-covaleda', zona: 'soria', lat: 41.95, lon: -2.87, altitud: 1450 };
const CELDA = { id: 'soria:1:1', zona: 'soria', lat: 42.0, lon: -2.95, altRef: 1300 };
const horas = (codigo) => horasDeHistorico(fixture(`duero-historico-${codigo}.html`), codigo).map((h) => filaObs('duero', h));
const el = (lugar, fecha) => lugar.mm[entreDias('2026-08-01', fecha)];

test('construirPublicacion: solo los días buenos; AEMET por estación; última fecha con dato por fuente', () => {
  const d = (fuente, estacion, fecha, mm, calidad = 'ok') => ({ fuente, estacion, fecha, mm, horas: 24, maximo: 1, calidad, motivo: null });
  const estaciones = [{ fuente: 'aemet', codigo: 'X', nombre: 'Equis', lat: 40.018, lon: -4, altitud: 1200 }, { fuente: 'duero', codigo: 'PL1', nombre: 'Uno', lat: 39.982, lon: -4, altitud: 1200 }];
  const revisados = [d('aemet', 'X', '2026-09-29', 2), d('duero', 'PL1', '2026-09-29', 4), d('duero', 'PL1', '2026-09-30', 150, 'sospechoso')];
  const { ultimo, celdas } = construirPublicacion({ revisados, estaciones, puntos: [{ id: 'p', lat: 40, lon: -4, altitud: 1200 }],
    celdas: [], desde: '2026-09-29', hasta: '2026-09-30', generado: '2026-10-01T04:10:00.000Z' });
  assert.deepEqual(ultimo.lugares.p.mm, [3, null]);
  assert.deepEqual(ultimo.aemet, { X: { '2026-09-29': 2 } });
  assert.deepEqual(ultimo.fuentes, { aemet: '2026-09-29', duero: '2026-09-30' });
  assert.deepEqual(validarPluvio(ultimo), []);
  assert.deepEqual(celdas.lugares, {});
});

test('qué toca: publicar no corre fuera de las 4 y las 16 UTC', () => {
  assert.ok(!fuentesQueTocan(new Date('2026-10-02T05:10:00Z')).includes('publicar'));
});

test('publicar sube celdas.json y ultimo.json: Covaleda medida, Quintanar fuera los días sospechosos', async () => {
  const almacen = almacenPluvioMemoria();
  await almacen.guardarObs([...horas('PL002'), ...horas('PL031')]);
  almacen.modelo.set('soria:1:1', new Map([['2026-08-28', 0.4]]));
  const r = await ejecutar({ almacen, fetchFn: servidorFalso([]), esperar: async () => {}, ahora: new Date('2026-10-02T04:10:00Z'),
    estaciones: EST, puntos: [PUNTO], gruesa: { celdas: [CELDA] }, pedidas: ['publicar'] });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.pasos.publicar, { dias: 122, puntos: 1, celdas: 1 });
  const ultimo = almacen.archivos.get('pluvio/ultimo.json'), celdas = almacen.archivos.get('pluvio/celdas.json');
  assert.deepEqual(validarPluvio(ultimo), []);
  assert.deepEqual(validarPluvio(celdas), []);
  assert.deepEqual([ultimo.desde, ultimo.hasta], ['2026-08-01', '2026-10-01']);
  const p = ultimo.lugares[PUNTO.id];
  assert.equal(el(p, '2026-08-27'), 3.8);    // Quintanar (551,9) descartado: solo Covaleda
  assert.equal(el(p, '2026-08-28'), 0);      // el pico aislado de Quintanar, fuera
  assert.equal(el(p, '2026-09-17'), null);   // los dos incompletos
  assert.equal(el(p, '2026-08-15'), 6.4);    // 6,415: Covaleda (6,4, a 0,3 km) pesa casi todo; Quintanar (10,8, a 14,7 km) apenas
  assert.equal(p.n[entreDias('2026-08-01', '2026-08-15')], 2);
  assert.deepEqual(p.estaciones.map((e) => e.nombre), ['Covaleda', 'Quintanar de la Sierra']);
  assert.ok(celdas.lugares['soria:1:1']);
  assert.deepEqual(ultimo.fuentes, { duero: '2026-09-30' });
});
```

Comprobaciones: 61 días de PL002 y 61 de PL031 entre el 01/08 y el 01/10 (ninguna de las dos tiene datos el 01/10):
`dias: 122`. Covaleda está a 0,3 km del punto (peso 0,984) y Quintanar a 14,7 km con 107 m de desnivel (peso 0,0034);
la celda `soria:1:1` queda a 8,3 km de Covaleda y a 6,1 km de Quintanar, dentro de los 15 km del modelo.

- [ ] **Step 3: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-publicar.test.js`
Expected: FAIL con `does not provide an export named 'construirPublicacion'`.

- [ ] **Step 4: Publicación**

En `supabase/functions/pluvio/publicar.js`, cambiar el import de `_shared/pluvio.js` por
`import { distanciaKm, seriesMedidas, validarPluvio, VERSION_PLUVIO } from '../_shared/pluvio.js';`, añadir
`construirPublicacion` y sustituir `publicar`:

```js
// Los dos archivos públicos (formato en _shared/pluvio.js y docs/datos.md). Solo cuentan los días buenos.
export function construirPublicacion({ revisados, estaciones, puntos, celdas, desde, hasta, generado }) {
  const validos = new Map();
  for (const d of revisados) if (d.calidad === 'ok') {
    const k = `${d.fuente}:${d.estacion}`;
    if (!validos.has(k)) validos.set(k, new Map());
    validos.get(k).set(d.fecha, d.mm);
  }
  const aemet = {};
  for (const [k, m] of validos) if (k.startsWith('aemet:')) aemet[k.slice('aemet:'.length)] = Object.fromEntries(m);
  const fuentes = {};
  for (const d of revisados) if (d.horas > 0 && (fuentes[d.fuente] ?? '') < d.fecha) fuentes[d.fuente] = d.fecha;
  const base = { version: VERSION_PLUVIO, generado, desde, hasta };
  return {
    ultimo: { ...base, fuentes, lugares: seriesMedidas(puntos, estaciones, validos, desde, hasta), aemet },
    celdas: { ...base, lugares: seriesMedidas(celdas.map((c) => ({ id: c.id, lat: c.lat, lon: c.lon, altitud: c.altRef })), estaciones, validos, desde, hasta) },
  };
}

export async function publicar({ almacen, hoy, ahora, estaciones, puntos = [], gruesa = { celdas: [] } }) {
  const desde = agostoDe(hoy), hasta = sumarDias(hoy, -1);
  const conocidas = new Set(estaciones.map((e) => `${e.fuente}:${e.codigo}`));
  const dias = diasDeFilas(await almacen.diasPorEstacion(desde)).filter((d) => d.fecha <= hasta && conocidas.has(`${d.fuente}:${d.estacion}`));
  const cercana = celdasCercanas(estaciones, gruesa.celdas);
  const modelo = cercana.size ? await almacen.precipCeldas([...new Set(cercana.values())], desde) : new Map();
  const modeloDe = (clave, fecha) => modelo.get(cercana.get(clave))?.get(fecha) ?? null;
  const revisados = revisarDias(dias, estaciones, modeloDe);
  await almacen.guardarDias(revisados.map((d) => ({ ...d, actualizado: ahora.toISOString() })));
  if (!puntos.length) return { dias: revisados.length };
  const { ultimo, celdas } = construirPublicacion({ revisados, estaciones, puntos, celdas: gruesa.celdas, desde, hasta, generado: ahora.toISOString() });
  const malas = [...validarPluvio(ultimo), ...validarPluvio(celdas)];
  if (malas.length) throw new Error(`salida mal formada, no se sube: ${malas[0]}`);
  // Primero las celdas (las lee «rejilla») y después el puntero de Hoy y Zona.
  await almacen.subir('pluvio/celdas.json', celdas, '3600');
  await almacen.subir('pluvio/ultimo.json', ultimo, '600');
  return { dias: revisados.length, puntos: Object.keys(ultimo.lugares).length, celdas: Object.keys(celdas.lugares).length };
}
```

En `supabase/functions/pluvio/manejador.js`: añadir `puntos = []` a la firma de `ejecutar` (junto a `gruesa`) y pasarlo
al paso (`tarea.paso({ almacen, hoy, ahora, estaciones, puntos, gruesa })`); en `almacenSupabase`, añadir:

```js
    // Bucket público «indice» (el de «rejilla»): pluvio/ultimo.json y pluvio/celdas.json. Las limpiezas de «rejilla»
    // solo tocan los <sello>.json de la raíz.
    async subir(nombre, json, cacheControl) {
      datos(await admin.storage.from('indice').upload(nombre, new Blob([JSON.stringify(json)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl }));
    },
```

En `supabase/functions/pluvio/index.ts`: `import PUNTOS from './puntos.json' with { type: 'json' };` y pasar `puntos: PUNTOS`.

- [ ] **Step 5: Ejecutar las pruebas y verlas pasar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Documentar el formato en `docs/datos.md`**

Añadir después de la sección «Índice diario precalculado (bucket `indice`)»:

````markdown
## Lluvia medida en pluviómetros (bucket `indice`, carpeta `pluvio/`)

La publica la función `pluvio` a las 4 y a las 16 UTC (spec `docs/superpowers/specs/2026-10-01-pluviometros-design.md`).
Dos archivos con el mismo formato (`supabase/functions/_shared/pluvio.js`, `validarPluvio`):

```json
{
  "version": 1, "generado": "2026-10-02T04:10:12.000Z", "desde": "2026-08-01", "hasta": "2026-10-01",
  "lugares": {
    "soria-pinar-grande-covaleda": { "mm": [0, 6.4, null, "…"], "n": [1, 2, 0, "…"],
      "estaciones": [{ "nombre": "Covaleda", "fuente": "duero", "km": 0.3 }], "cercanas": 2 }
  },
  "fuentes": { "duero": "2026-10-01", "tajo": "2026-10-01" },
  "aemet": { "3104Y": { "2026-09-30": 0.4 } }
}
```

- `pluvio/ultimo.json`: `lugares` por punto de zona (`data/zonas.json`); lo leen Hoy y Zona. `fuentes` (última fecha con
  dato de cada fuente) y `aemet` (lluvia diaria de las estaciones AEMET de la lista blanca, sumada de la horaria, solo días
  buenos) solo van aquí.
- `pluvio/celdas.json`: `lugares` por celda gruesa (`data/rejilla/gruesa.json`); lo lee la función `rejilla`.
- `mm[k]` es la lluvia medida del día `desde + k` (media ponderada de las estaciones válidas; `null` = ningún dato bueno) y
  `n[k]`, cuántas estaciones la dan. `estaciones`: las que aportan algún día, por distancia; `cercanas`: cuántas hay en
  el radio aunque no aporten. Un lugar sin ninguna estación a menos de 20 km no sale.
- Si falta el archivo (o no pasa `validarPluvio`), la app y `rejilla` funcionan como antes, solo con el modelo.
````

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/pluvio tests/dobles-pluvio.js tests/pluvio-publicar.test.js docs/datos.md
git commit -m "$(cat <<'EOF'
Pluviómetros: publicación de pluvio/ultimo.json (puntos de zona) y pluvio/celdas.json (celdas gruesas)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 11: Despliegue de la función completa y relleno desde el 1 de agosto  ⚠️ requiere token y autorización

> **El controlador se para al empezar esta tarea.** Hace falta un *access token* nuevo de Supabase y la **autorización explícita de la usuaria en ese momento** para: aplicar la migración de `lluvia_dia`, renovar la clave `PLUVIO_CLAVE` (la de la tarea 2 no se guardó), volver a desplegar `pluvio` con todas las fuentes, lanzar el relleno (Duero, Júcar y Euskalmet desde el 1 de agosto) y publicar por primera vez. Sin las dos cosas no se ejecuta ningún paso: la rama sigue con la tarea 12 (la app no cambia sin el archivo). El token solo vive en la variable de entorno de esa terminal. La función se despliega desde el worktree de la rama: el navegador no carga nada de `supabase/functions/pluvio/`, así que no hace falta integrar en `main` para esto.

**Files:**
- Modify: `docs/supabase.md` (sección `pluvio`: fuentes, horario, relleno, publicación)

**Interfaces:**
- Consumes: tareas 3 a 10.
- Produces: `lluvia_dia` y `lluvia_por_dia` en el proyecto; `pluvio` desplegada con las cinco fuentes; `indice/pluvio/ultimo.json` e `indice/pluvio/celdas.json` públicos.

- [ ] **Step 1: Preguntar a la usuaria y esperar**

Mensaje (en español): qué se crea (una tabla privada más y una función SQL), qué gasta cada día (unas 280 peticiones al
SAIH Tajo, unas 60 al SAIH Duero, unas 40 al SAIH Júcar los primeros días y 4 después, 16 a AEMET; ninguna a Open-Meteo),
que el relleno de Euskalmet usa el zip de 100 MB ya descargado en la tarea 7 y sube unas 20.000 horas, y que hace falta un
token nuevo.

- [ ] **Step 2: Migración, clave nueva y despliegue**

```bash
export SUPABASE_ACCESS_TOKEN=<token nuevo que da la usuaria, solo en esta terminal>
npx --yes supabase@2.118.0 link --project-ref ctgedeunquvmcfqsufjj
npx --yes supabase@2.118.0 db push --dry-run
npx --yes supabase@2.118.0 db push
CLAVE=$(node -e "console.log(crypto.randomUUID() + crypto.randomUUID())")
npx --yes supabase@2.118.0 secrets set PLUVIO_CLAVE="$CLAVE" --project-ref ctgedeunquvmcfqsufjj
npx --yes supabase@2.118.0 db query --linked "select vault.update_secret((select id from vault.secrets where name = 'pluvio_clave'), '$CLAVE')"
npx --yes supabase@2.118.0 functions deploy pluvio --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj
```

Expected: el `--dry-run` lista solo `20261004000000_lluvia_dia.sql`; `Deployed Functions … pluvio`. Si el empaquetado no
encuentra `../rejilla/gruesa.json` o `../_shared/pluvio.js`, parar y anotar el error.

- [ ] **Step 3: Relleno automático (Duero y Júcar) y lecturas del día**

```bash
F="https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/pluvio"
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "x-pluvio-clave: $CLAVE" "$F?fuentes=duero90"
# esperar 2 minutos entre llamadas (cada una puede tardar hasta 140 s)
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "x-pluvio-clave: $CLAVE" "$F?fuentes=jucar,tajo,aemet"
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "x-pluvio-clave: $CLAVE" "$F?fuentes=jucar"
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "x-pluvio-clave: $CLAVE" "$F?fuentes=jucar"
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "x-pluvio-clave: $CLAVE" "$F?fuentes=jucar"
npx --yes supabase@2.118.0 db query --linked "select fuente, count(distinct estacion) as estaciones, count(*) as horas, min(hora), max(hora) from public.lluvia_obs group by fuente order by fuente"
```

Expected: `202` en cada llamada; `duero` con sus estaciones desde el 01/08 (unas 1.450 horas por estación); `jucar` con un
valor por estación y día desde el 01/08 tras las cuatro llamadas (20 días por llamada). Si en el registro de la función sale
`plazo agotado` en `duero90`, repetir esa llamada: cada lectura es un upsert y no duplica nada.

- [ ] **Step 4: Relleno de Euskalmet desde el zip anual (en local)**

```bash
node scripts/pluvio/relleno-euskalmet.mjs --seco --desde=2026-08-01
PLUVIO_CLAVE="$CLAVE" node scripts/pluvio/relleno-euskalmet.mjs --desde=2026-08-01
```

Expected: el `--seco` dice unas 700 horas por estación (agosto entero; el zip llega hasta el 31/08) y avisa de las que no
estén en el zip; la carga, `{"ok":true,"guardadas":2000}` por trozo. Si alguna sale `ok: false`, parar y anotar el mensaje.

- [ ] **Step 5: Primera publicación y comprobación**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "x-pluvio-clave: $CLAVE" "$F?fuentes=publicar"
npx --yes supabase@2.118.0 db query --linked "select fuente, calidad, count(*) from public.lluvia_dia group by 1, 2 order by 1, 2"
npx --yes supabase@2.118.0 db query --linked "select estacion, fecha, mm, motivo from public.lluvia_dia where calidad = 'sospechoso' order by mm desc limit 10"
curl -s "https://ctgedeunquvmcfqsufjj.supabase.co/storage/v1/object/public/indice/pluvio/ultimo.json" | node -e "
let t = ''; process.stdin.on('data', (d) => (t += d)).on('end', async () => {
  const { validarPluvio } = await import('./supabase/functions/_shared/pluvio.js');
  const p = JSON.parse(t); console.log(validarPluvio(p), p.desde, p.hasta, Object.keys(p.lugares).length, 'puntos', p.fuentes);
});"
```

Expected: `202`; la mayoría de los días `ok`; entre los sospechosos, Quintanar de la Sierra (`PL031`) el 27/08, el 28/08 y
el 30/09 si está en la lista blanca; `[]` (sin errores), `2026-08-01`, ayer, unos 30 puntos de los 35 (los de Montes de
Toledo y el sur de Extremadura pueden faltar) y las fechas de cada fuente. **Contraste con el informe 09 §4:** mirar en
`ultimo.json` la suma de septiembre de los puntos de Cuenca (debe reflejar la tormenta de La Cierva) y de Álava en agosto
(Euskalmet: unos 17 mm cerca de Beluntza, no los 52 de ECMWF).

- [ ] **Step 6: Documentar en `docs/supabase.md`**

Sustituir la línea «Qué lee y cuándo…» de la sección `pluvio` por:

```markdown
- Qué lee y cuándo (hora UTC, minuto 10): AEMET horario a las 0, 3, 6, 9, 12, 15, 18 y 21; SAIH Tajo (últimas 24 h) a la
  1, 4, 7, 10, 13, 16, 19 y 22, y sus 10 días a las 2; SAIH Duero (últimos 4 días) a las 3 y 15, y desde el 1 de agosto los
  domingos a la 1; SAIH Júcar (ayer, anteayer y hasta 18 días que falten desde el 1 de agosto) a las 4 y 16; Euskalmet, por
  relleno local desde su zip anual. Después de las lecturas de las 4 y las 16, `publicar`: agrega por día de Madrid
  (`lluvia_por_dia`), pasa el control de calidad, guarda `lluvia_dia` (privada, 400 días) y publica
  `indice/pluvio/celdas.json` e `indice/pluvio/ultimo.json` (formato en `docs/datos.md`).
- Lista blanca: `node scripts/pluvio/estaciones.mjs` (con `_fuentes/euskalmet-2026.zip` para filtrar Euskalmet) y volver
  a desplegar. Prueba en vivo de las fuentes: `node scripts/pluvio/sonda.mjs`.
- Ver los sospechosos: `select estacion, fecha, mm, motivo from public.lluvia_dia where calidad = 'sospechoso' order by fecha desc`.
- Relleno y primera publicación: AAAA-MM-DD (rellenar).
```

Recordar a la usuaria que revoque el token al terminar.

- [ ] **Step 7: Commit**

```bash
git add docs/supabase.md
git commit -m "$(cat <<'EOF'
Supabase: pluvio con las cinco fuentes, relleno desde el 1 de agosto y primera publicación documentados

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 12: La función `rejilla` toma la lluvia medida para las series de las celdas gruesas

**Files:**
- Modify: `supabase/functions/_shared/salida-indice.js` (`resumirCelda`, `serieLluvia`, `validarSalida`)
- Modify: `supabase/functions/rejilla/nucleo.js` (`factoresPorZona`)
- Modify: `supabase/functions/rejilla/manejador.js:65-76` (lee `pluvio/celdas.json` y aplica la medida)
- Create: `tests/pluvio-rejilla.test.js`

**Interfaces:**
- Consumes: `aplicarMedida`, `paresSesgo`, `factorSesgo`, `validarPluvio`, `VERSION_PLUVIO` (tarea 9); el formato de `pluvio/celdas.json` (tarea 10); `almacen.leerJson` de `rejilla` (ya existe).
- Produces:
  - `resumirCelda({ altRef, serie, fechas, pluvio = null })`: con `pluvio = { estaciones: string[], cercanas: number }`, `lluvia` lleva además `origen` (un número por día de `mm`: 0 modelo, 1 medida, 2 estimada), `estaciones` (hasta 3 nombres) y `cercanas`. Sin `pluvio`, exactamente como antes. `VERSION_SALIDA` sigue en 1 (los campos son opcionales).
  - `serieLluvia(celda)` devuelve `origenPrecip` (`'modelo'|'medida'|'estimada'`) si la celda trae `origen`.
  - `factoresPorZona(celdas, series: Map<id, serie>, pluvio) → Map<zona, factor>` en `nucleo.js`.
  - `leerPluvioCeldas(almacen) → pluvio|null` en `rejilla/manejador.js`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/pluvio-rejilla.test.js`:

```js
// tests/pluvio-rejilla.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar } from '../supabase/functions/rejilla/manejador.js';
import { factoresPorZona } from '../supabase/functions/rejilla/nucleo.js';
import { validarSalida, serieLluvia } from '../js/rejilla/salida.js';
import { VERSION_PLUVIO } from '../supabase/functions/_shared/pluvio.js';
import { entreDias } from '../js/meteo.js';
import { openMeteoFalso, almacenMemoria } from './dobles-rejilla.js';
import { serieSintetica } from './ayudas.js';

const MANANA = new Date('2026-10-01T05:00:00Z');   // 07:00 en Madrid
const gruesa = (n) => ({ celdas: Array.from({ length: n }, (_, k) => ({ id: `z:${k}:0`, zona: 'z', lat: 40 + k * 0.01, lon: -4, altRef: 1000 + k })) });
const DESDE = '2026-08-01', HASTA = '2026-09-30', LARGO = entreDias(DESDE, HASTA) + 1;
const pluvioCon = (lugares, extra = {}) => ({ version: VERSION_PLUVIO, generado: '2026-10-01T04:10:00.000Z', desde: DESDE, hasta: HASTA, lugares, ...extra });
const seco = () => ({ mm: Array(LARGO).fill(0), n: Array(LARGO).fill(1), estaciones: [{ nombre: 'Covaleda', fuente: 'duero', km: 2 }], cercanas: 1 });
async function indice(archivoPluvio) {
  const almacen = almacenMemoria();
  if (archivoPluvio !== undefined) almacen.archivos.set('pluvio/celdas.json', archivoPluvio);
  const r = await ejecutar({ almacen, fetchFn: openMeteoFalso({ hoy: '2026-10-01' }), ahora: MANANA, gruesa: gruesa(3), esperar: async () => {}, trozo: 5 });
  assert.equal(r.estado, 'publicado');
  assert.ok(almacen.archivos.has('pluvio/celdas.json') === (archivoPluvio !== undefined), 'la limpieza de rejilla no borra pluvio/');
  return almacen.archivos.get('2026-10-01T07.json');
}

test('equivalencia: sin pluvio/celdas.json (o con uno que no valida) el índice es el de siempre', async () => {
  const sin = await indice();
  assert.deepEqual(Object.keys(sin.celdas['z:0:0'].lluvia).sort(), ['desde', 'hoy', 'mm']);
  assert.deepEqual((await indice(pluvioCon({}, { version: 2 }))).celdas, sin.celdas);
  assert.deepEqual((await indice({ basura: true })).celdas, sin.celdas);
});

test('con archivo pero sin estaciones en la zona: las notas no cambian y la lluvia dice que es del modelo', async () => {
  const sin = await indice(), con = await indice(pluvioCon({}));
  for (const id of Object.keys(sin.celdas)) {
    assert.deepEqual(con.celdas[id].dias, sin.celdas[id].dias, id);
    assert.deepEqual(con.celdas[id].lluvia.mm, sin.celdas[id].lluvia.mm, id);
    assert.ok(con.celdas[id].lluvia.origen.every((o) => o === 0), id);
    assert.deepEqual(con.celdas[id].lluvia.estaciones, []);
    assert.equal(con.celdas[id].lluvia.cercanas, 0);
  }
  assert.deepEqual(validarSalida(con), []);
});

test('con lluvia medida en una celda: la suya pasa a medida y las demás de la zona, a estimada con el sesgo', async () => {
  const sin = await indice(), con = await indice(pluvioCon({ 'z:0:0': seco() }));
  const a = con.celdas['z:0:0'], b = con.celdas['z:1:0'], h = a.lluvia.hoy;
  assert.equal(h, 59);
  assert.ok(a.lluvia.mm.slice(0, h).every((v) => v === 0), 'del 03/08 a ayer, lo medido');
  assert.deepEqual([a.lluvia.origen[h - 1], a.lluvia.origen[h]], [1, 0]);   // ayer medido; hoy, del modelo
  assert.deepEqual(a.lluvia.estaciones, ['Covaleda']);
  assert.ok(a.dias[0][0] < sin.celdas['z:0:0'].dias[0][0], 'menos lluvia en 26 días');
  // La zona midió 0 frente a un modelo con lluvia: cociente 0 → acotado a 0,5 en las celdas sin estación.
  assert.equal(b.lluvia.origen[h - 1], 2);
  assert.equal(b.lluvia.mm[h - 1], sin.celdas['z:1:0'].lluvia.mm[h - 1] * 0.5);
  assert.deepEqual(validarSalida(con), []);
});

test('factoresPorZona: con los pares medido/modelo de las celdas con estación de cada zona', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: () => 2 });
  const m = { mm: Array(LARGO).fill(3), n: Array(LARGO).fill(1), estaciones: [], cercanas: 1 };
  const f = factoresPorZona([{ id: 'x', zona: 'a' }, { id: 'y', zona: 'b' }], new Map([['x', s], ['y', s]]), pluvioCon({ x: m }));
  assert.deepEqual([...f], [['a', 1.5]]);
});

test('serieLluvia trae el origen de cada día si la celda lo tiene; validarSalida lo comprueba', () => {
  const lluvia = { desde: '2026-09-29', hoy: 1, mm: [1, 2, 3] };
  assert.equal(serieLluvia({ lluvia }).origenPrecip, undefined);
  assert.deepEqual(serieLluvia({ lluvia: { ...lluvia, origen: [1, 2, 0] } }).origenPrecip, ['medida', 'estimada', 'modelo']);
  const salida = (l) => ({ version: 1, sello: '2026-09-30T07', fechas: ['2026-09-30'], hoy: '2026-09-30', celdas: { c: { altRef: 1000, dias: [null], lluvia: l } } });
  assert.deepEqual(validarSalida(salida({ ...lluvia, origen: [1, 2, 0], estaciones: ['A'], cercanas: 1 })), []);
  assert.deepEqual(validarSalida(salida({ ...lluvia, origen: [1, 2] })), ['celda c mal formada']);
  assert.deepEqual(validarSalida(salida({ ...lluvia, origen: [1, 2, 3] })), ['celda c mal formada']);
  assert.deepEqual(validarSalida(salida({ ...lluvia, estaciones: [7] })), ['celda c mal formada']);
});
```

- [ ] **Step 2: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-rejilla.test.js`
Expected: FAIL con `does not provide an export named 'factoresPorZona'`.

- [ ] **Step 3: El formato del índice con el origen de la lluvia**

En `supabase/functions/_shared/salida-indice.js`:

1. Debajo de `const r2 = …`, añadir:

```js
// Origen de la lluvia de cada día en `lluvia.origen` (solo si había lluvia medida publicada, tarea 12 del plan de
// pluviómetros): 0 modelo, 1 medida en pluviómetros, 2 modelo corregido por su sesgo.
const ORIGEN = { modelo: 0, medida: 1, estimada: 2 };
const ORIGEN_TEXTO = ['modelo', 'medida', 'estimada'];
```

2. Sustituir `resumirCelda` por:

```js
export function resumirCelda({ altRef, serie, fechas, pluvio = null }) {
  const dias = fechas.map((f) => {
    const i = serie.fechas.indexOf(f);
    if (i === -1) return null;
    try { return empaquetarDia(agregadosDia(serie, i)); } catch (e) { if (e instanceof DatosIncompletos) return null; throw e; }
  });
  const i0 = Math.max(0, serie.hoy - 59), i1 = Math.min(serie.fechas.length, serie.hoy + fechas.length);
  const lluvia = { desde: serie.fechas[i0], hoy: serie.hoy - i0, mm: serie.precip.slice(i0, i1).map(r2) };
  if (pluvio) {
    lluvia.origen = serie.fechas.slice(i0, i1).map((_, k) => ORIGEN[serie.origenPrecip?.[i0 + k]] ?? 0);
    lluvia.estaciones = pluvio.estaciones;
    lluvia.cercanas = pluvio.cercanas;
  }
  return { altRef, incompleta: !dias.every(diaConDatos), lluvia, dias };
}
```

3. Sustituir `serieLluvia` por:

```js
export function serieLluvia(celda) {
  const { desde, hoy, mm, origen } = celda.lluvia;
  const serie = { fechas: mm.map((_, k) => sumarDias(desde, k)), precip: mm, hoy };
  return Array.isArray(origen) ? { ...serie, origenPrecip: origen.map((c) => ORIGEN_TEXTO[c] ?? 'modelo') } : serie;
}
```

4. En `validarSalida`, añadir al final de la expresión `bien` (después de `&& l.mm.every(num)`):

```js
      && (!('origen' in l) || (Array.isArray(l.origen) && l.origen.length === l.mm.length && l.origen.every((c) => c === 0 || c === 1 || c === 2)))
      && (!('estaciones' in l) || (Array.isArray(l.estaciones) && l.estaciones.every((n) => typeof n === 'string')))
      && (!('cercanas' in l) || Number.isInteger(l.cercanas))
```

- [ ] **Step 4: La función `rejilla` con la lluvia medida**

En `supabase/functions/rejilla/nucleo.js`, añadir el import `import { paresSesgo, factorSesgo } from '../_shared/pluvio.js';` y:

```js
// Sesgo del modelo por zona (spec de pluviómetros §3.3): los pares medido/modelo de las celdas de la zona que tienen
// estación, con las series del MODELO. Con lotes > 1 cada lote lo calcula con sus celdas.
export function factoresPorZona(celdas, series, pluvio) {
  const pares = new Map();
  for (const c of celdas) {
    const s = series.get(c.id), m = pluvio.lugares?.[c.id];
    if (!s || !m) continue;
    if (!pares.has(c.zona)) pares.set(c.zona, []);
    pares.get(c.zona).push(...paresSesgo(s, m, pluvio.desde, pluvio.hasta));
  }
  return new Map([...pares].map(([zona, p]) => [zona, factorSesgo(p)]));
}
```

En `supabase/functions/rejilla/manejador.js`:

1. Imports: añadir `factoresPorZona` a los de `./nucleo.js` y `import { aplicarMedida, validarPluvio } from '../_shared/pluvio.js';`.

2. Sustituir el bloque de las líneas 65-76 (desde el comentario «Solo salen en el índice…» hasta el cierre del `for`
que llena `parte`) por:

```js
  // Solo salen en el índice las celdas cuya petición principal fue bien en esta ejecución; de las demás no hay previsión
  // renovada (el móvil las pinta en gris) y no cuentan para el 90 %.
  const desde = inicioSerie(hoy), hasta = sumarDias(hoy, FUTUROS - 1);
  const fechas = Array.from({ length: FUTUROS }, (_, k) => sumarDias(hoy, k));
  const [filas, clima, pluvio] = await Promise.all([almacen.series(ids, desde), almacen.clima(ids), leerPluvioCeldas(almacen)]);
  const series = new Map();
  for (const c of celdas) {
    const fila = filas.get(c.id);
    if (!fila || !frescas.has(c.id)) continue;
    series.set(c.id, aplicarClimaCelda(serieDesdeFilas(fila, desde, hasta, hoy, ahora), clima.get(c.id)));
  }
  // Lluvia medida en pluviómetros (pluvio/celdas.json, de la función «pluvio»): sin archivo, todo como antes.
  const factores = pluvio ? factoresPorZona(celdas, series, pluvio) : new Map();
  const parte = {};
  for (const c of celdas) {
    const s = series.get(c.id);
    if (!s) continue;
    const m = pluvio?.lugares?.[c.id] ?? null;
    const serie = pluvio ? aplicarMedida(s, m, { desde: pluvio.desde, hasta: pluvio.hasta, factor: factores.get(c.zona) ?? 1 }) : s;
    parte[c.id] = resumirCelda({ altRef: altitud.get(c.id), serie, fechas,
      pluvio: pluvio ? { estaciones: (m?.estaciones ?? []).slice(0, 3).map((e) => e.nombre), cercanas: m?.cercanas ?? 0 } : null });
  }
```

3. Después de `claveValida` (la reexportación), añadir:

```js
// pluvio/celdas.json del mismo bucket; si falta, falla o no pasa validarPluvio, null (el índice sale sin pluviómetros).
export async function leerPluvioCeldas(almacen) {
  try { const p = await almacen.leerJson('pluvio/celdas.json'); return p && !validarPluvio(p).length ? p : null; } catch { return null; }
}
```

(El resto de `ejecutar` no cambia: `archivosABorrar` solo mira los `<sello>.json` de la raíz del bucket.)

- [ ] **Step 5: Ejecutar las pruebas y verlas pasar**

Run: `npm test`
Expected: PASS, también `tests/rejilla-funcion.test.js` (sin archivo de pluviómetros, el índice no cambia) y
`tests/rejilla-salida.test.js`.

- [ ] **Step 6: Documentar en `docs/datos.md`**

En la sección «Índice diario precalculado (bucket `indice`)», añadir al final:

```markdown
- Si la función `rejilla` encuentra `pluvio/celdas.json` (sección siguiente), la lluvia pasada de cada celda gruesa es la
  medida en pluviómetros donde la hay y el modelo corregido por su sesgo de 30 días en las demás celdas de la zona; y
  `lluvia` lleva además `origen` (un número por día de `mm`: 0 modelo, 1 medida, 2 estimada), `estaciones` (hasta tres
  nombres) y `cercanas`. Sin ese archivo, el índice es exactamente el de antes.
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/salida-indice.js supabase/functions/rejilla/nucleo.js supabase/functions/rejilla/manejador.js tests/pluvio-rejilla.test.js docs/datos.md
git commit -m "$(cat <<'EOF'
Mapa: la función rejilla usa la lluvia medida en pluviómetros en las series de las celdas gruesas (sin archivo, igual que antes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 13: Hoy y Zona con la lluvia medida (`pluvio/ultimo.json`) y el contraste AEMET con la horaria

**Files:**
- Create: `js/pluvio.js`
- Modify: `js/rejilla/carga.js:14` (`conPlazo` exportada)
- Modify: `js/aemet.js` (`distanciaKm` de `_shared/pluvio.js`; `aplicarEstacion` no pisa lo medido; `aplicarContraste` compara con el modelo)
- Modify: `js/app.js` (`estado.pluvio`, carga y aplicación)
- Create: `tests/pluvio-app.test.js`

**Interfaces:**
- Consumes: `aplicarMedida`, `paresSesgo`, `factorSesgo`, `validarPluvio`, `distanciaKm` (tarea 9); `FUENTES_LLUVIA`, `LICENCIAS` (tarea 7); `leer`, `guardar`, `almacenPorDefecto` de `js/cache.js`; `SUPABASE_URL` de `js/config.js`.
- Produces (`js/pluvio.js`):
  - `URL_PLUVIO`; `cargarPluvio({ fetchFn?, ahora?, almacen? }) → pluvio|null` (caché 3 h; si falla, la guardada aunque sea vieja; nunca lanza).
  - `aplicarPluvio(zonas, meteo, pluvio) → meteo` (sin `pluvio`, la misma `meteo`); con él añade `seriesModelo` (las del modelo) y `pluvio: { porPunto: { id: { estaciones, cercanas, factor } }, desde, hasta }`.
  - `combinarObs(obs, pluvio) → obs` (rellena los días que AEMET aún no ha validado con la suma de su horaria).
  - Reexporta `FUENTES_LLUVIA` y `LICENCIAS`.
  - `estado.pluvio` en `js/app.js`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/pluvio-app.test.js`:

```js
// tests/pluvio-app.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarPluvio, combinarObs, cargarPluvio, URL_PLUVIO } from '../js/pluvio.js';
import { aplicarContraste, aplicarEstacion, distanciaKm } from '../js/aemet.js';
import { calcularZona } from '../js/pantallas/hoy.js';
import { guardar } from '../js/cache.js';
import { VERSION_PLUVIO, distanciaKm as distanciaCompartida } from '../supabase/functions/_shared/pluvio.js';
import { entreDias } from '../js/meteo.js';
import { serieSintetica, BOLETUS, NISCALO, lluviaBuena, almacenFalso } from './ayudas.js';

const ZONA = { id: 'z', habitats: ['pinar-silvestre'], puntos: [{ id: 'a', altitud: 1500 }, { id: 'b', altitud: 1100 }], estacionesAemet: [{ id: 'E1', nombre: 'Uno', altitud: 1450 }] };
const OTRA = { id: 'o', habitats: ['pinar-silvestre'], puntos: [{ id: 'c', altitud: 1300 }], estacionesAemet: [] };
const especie = (e) => ({ ...e, nombre: e.id, categoria: 'comestible', habitats: ['pinar-silvestre'], zonas: { z: { presencia: 'comun' }, o: { presencia: 'comun' } } });
const DATOS = { especies: [especie(BOLETUS), especie(NISCALO)] };
const meteoDe = () => { const s = serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena }); return { hoy: s.fechas[s.hoy], series: { a: s, b: s, c: s } }; };
const DESDE = '2026-08-01', HASTA = '2026-09-30', LARGO = entreDias(DESDE, HASTA) + 1;
const lugar = (v) => ({ mm: Array(LARGO).fill(v), n: Array(LARGO).fill(1), estaciones: [{ nombre: 'Covaleda', fuente: 'duero', km: 2 }], cercanas: 1 });
const pluvioCon = (lugares, extra = {}) => ({ version: VERSION_PLUVIO, generado: '2026-10-01T04:10:00.000Z', desde: DESDE, hasta: HASTA, lugares, ...extra });
const nota = (meteo, zona = ZONA) => calcularZona(zona, DATOS, meteo, 0, '', {}).res;
const obsE1 = (s, v) => ({ E1: Object.fromEntries(s.fechas.slice(34, 58).map((f) => [f, v])) });
const respuesta = (status, cuerpo) => ({ ok: status === 200, status, json: async () => cuerpo });

test('equivalencia: sin pluvio/ultimo.json, la meteo, las notas y el contraste AEMET son los de hoy', () => {
  const meteo = meteoDe(), obs = obsE1(meteo.series.a, 9);
  assert.equal(aplicarPluvio([ZONA], meteo, null), meteo);
  assert.deepEqual(nota(aplicarPluvio([ZONA], meteo, null)), nota(meteo));
  assert.equal(combinarObs(obs, null), obs);
  assert.deepEqual(aplicarContraste([ZONA], aplicarPluvio([ZONA], meteo, null), combinarObs(obs, null)), aplicarContraste([ZONA], meteo, obs));
  assert.ok(nota(meteo).valor != null, 'la prueba compara una nota de verdad');
});

test('con archivo pero sin estaciones para la zona: series y notas idénticas', () => {
  const meteo = meteoDe(), m = aplicarPluvio([ZONA, OTRA], meteo, pluvioCon({ c: lugar(0) }));
  assert.equal(m.series.a, meteo.series.a);
  assert.equal(m.series.b, meteo.series.b);
  assert.deepEqual(nota(m), nota(meteo));
  assert.deepEqual(m.pluvio.porPunto.a, { estaciones: [], cercanas: 0, factor: 1 });
});

test('medida en un punto: ese punto con lo medido; el otro de la zona, estimado con el sesgo; la nota baja', () => {
  const meteo = meteoDe(), m = aplicarPluvio([ZONA], meteo, pluvioCon({ a: lugar(0) }));
  const a = m.series.a, b = m.series.b;
  assert.ok(a.precip.slice(0, 59).every((v) => v === 0));
  assert.deepEqual([a.origenPrecip[58], a.origenPrecip[59]], ['medida', 'modelo']);   // 30/09 medido; hoy, del modelo
  assert.deepEqual(a.lluviaAntesDeSerie, { desde: '2026-08-01', mm: 0, origen: 'medida' });
  assert.deepEqual([b.precip[58], b.origenPrecip[58]], [1, 'estimada']);   // 2 mm del modelo × 0,5
  assert.equal(m.pluvio.porPunto.b.factor, 0.5);
  assert.equal(m.seriesModelo, meteo.series);
  assert.ok(nota(m).valor <= nota(meteo).valor);
});

test('el contraste AEMET compara con el modelo y no pisa los días medidos', () => {
  const meteo = meteoDe(), obs = obsE1(meteo.series.a, 9);
  const m = aplicarContraste([ZONA], aplicarPluvio([ZONA], meteo, pluvioCon({ a: lugar(0) })), obs);
  assert.equal(m.contrastePuntos.a.comparacion.P26modelo, 106);   // 23 días de 2 mm y 3 de 20 en el modelo
  assert.deepEqual([m.series.a.precip[40], m.series.a.origenPrecip[40]], [0, 'medida']);
  assert.deepEqual([m.series.b.precip[40], m.series.b.origenPrecip[40]], [9, 'estacion:E1']);   // lo estimado, sí
});

test('aplicarEstacion deja los días medidos; distanciaKm es la compartida', () => {
  const s = serieSintetica({ precip: () => 2 });
  const medida = { ...s, origenPrecip: s.origenPrecip.map((o, k) => (k === 50 ? 'medida' : o)) };
  const r = aplicarEstacion(medida, { [s.fechas[50]]: 7, [s.fechas[51]]: 7 }, 'E1');
  assert.deepEqual([r.precip[50], r.precip[51]], [2, 7]);
  assert.equal(distanciaKm, distanciaCompartida);
});

test('combinarObs: los días que AEMET aún no ha validado salen de su horaria; lo validado manda', () => {
  const obs = { E1: { '2026-09-28': 1, '2026-09-29': null } };
  const p = pluvioCon({}, { aemet: { E1: { '2026-09-28': 5, '2026-09-29': 3, '2026-09-30': 4 }, E2: { '2026-09-30': 5 } } });
  assert.deepEqual(combinarObs(obs, p), { E1: { '2026-09-28': 1, '2026-09-29': 3, '2026-09-30': 4 }, E2: { '2026-09-30': 5 } });
  assert.deepEqual(combinarObs(null, p), { E1: { '2026-09-28': 5, '2026-09-29': 3, '2026-09-30': 4 }, E2: { '2026-09-30': 5 } });
  assert.equal(combinarObs(null, null), null);
});

test('cargarPluvio: lo pide, lo guarda 3 h y, si falla, usa lo guardado; sin nada, null', async () => {
  const almacen = almacenFalso(), p = pluvioCon({ a: lugar(1) }), urls = [];
  const ok = async (u) => { urls.push(u); return respuesta(200, p); };
  const ahora = new Date('2026-10-01T08:00:00Z');
  assert.deepEqual(await cargarPluvio({ fetchFn: ok, ahora, almacen }), p);
  assert.ok(urls[0].startsWith(`${URL_PLUVIO}?t=`));
  await cargarPluvio({ fetchFn: ok, ahora: new Date('2026-10-01T09:00:00Z'), almacen });
  assert.equal(urls.length, 1, 'dentro de las 3 h no se vuelve a pedir');
  const cae = async () => { throw new Error('sin red'); };
  assert.deepEqual(await cargarPluvio({ fetchFn: cae, ahora: new Date('2026-10-01T14:00:00Z'), almacen }), p);
  assert.equal(await cargarPluvio({ fetchFn: async () => respuesta(400, { error: 'not_found' }), almacen: almacenFalso() }), null);
});

// Review Focus 4: archivo de otra versión, o una versión vieja en la caché.
test('cargarPluvio: un archivo de otra versión no se usa, ni del servidor ni de la caché', async () => {
  assert.equal(await cargarPluvio({ fetchFn: async () => respuesta(200, { ...pluvioCon({}), version: 2 }), almacen: almacenFalso() }), null);
  const almacen = almacenFalso(), ahora = new Date('2026-10-01T08:00:00Z');
  guardar('pluvio', { ...pluvioCon({}), version: 2 }, ahora.toISOString(), almacen);
  let pedidas = 0;
  const r = await cargarPluvio({ fetchFn: async () => { pedidas++; return respuesta(200, pluvioCon({})); }, ahora, almacen });
  assert.equal(pedidas, 1);
  assert.equal(r.version, VERSION_PLUVIO);
});
```

Comprobaciones: la serie sintética va del 03/08 (índice 0) al 01/10 (59, hoy); el 30/09 es el índice 58. `obsE1` cubre
los índices 34 a 57 (24 días, ≥ 22), así que AEMET se aplica. `P26modelo`: de 34 a 59 hay 23 días de 2 mm y los tres de 20
(40 a 42) → 106. El sesgo de la zona: 30 días medidos a 0 frente a un modelo de al menos 60 mm → 0, acotado a 0,5.

- [ ] **Step 2: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-app.test.js`
Expected: FAIL con `Cannot find module …/js/pluvio.js`.

- [ ] **Step 3: `js/pluvio.js` y `conPlazo`**

En `js/rejilla/carga.js`, línea 14: `function conPlazo(ms) {` → `export function conPlazo(ms) {`.

`js/pluvio.js`:

```js
// js/pluvio.js
// Lluvia medida en pluviómetros en Hoy y Zona (spec de pluviómetros §3.3): carga de pluvio/ultimo.json (bucket público
// «indice», caché 3 h como js/cache.js) y su aplicación a la meteo de los puntos de zona. Sin archivo, la meteo queda tal
// cual (prueba de equivalencia en tests/pluvio-app.test.js).
import { leer, guardar, almacenPorDefecto } from './cache.js';
import { SUPABASE_URL } from './config.js';
import { conPlazo } from './rejilla/carga.js';
import { aplicarMedida, factorSesgo, paresSesgo, validarPluvio } from '../supabase/functions/_shared/pluvio.js';
export { FUENTES_LLUVIA, LICENCIAS } from '../supabase/functions/_shared/pluvio-fuentes.js';

export const URL_PLUVIO = `${SUPABASE_URL}/storage/v1/object/public/indice/pluvio/ultimo.json`;
const TRES_HORAS = 3 * 3600e3, ESPERA_MS = 15000;

export async function cargarPluvio({ fetchFn = globalThis.fetch?.bind(globalThis), ahora = new Date(), almacen = almacenPorDefecto() } = {}) {
  const previo = leer('pluvio', almacen);   // leer nunca lanza
  const valido = previo?.datos && !validarPluvio(previo.datos).length ? previo.datos : null;
  const edad = valido ? ahora - new Date(previo.hora) : NaN;
  if (valido && edad >= 0 && edad < TRES_HORAS) return valido;
  const plazo = conPlazo(ESPERA_MS);
  try {
    const r = await fetchFn(`${URL_PLUVIO}?t=${Math.floor(ahora / 6e5)}`, { signal: plazo.signal });
    if (!r.ok) throw new Error(`lluvia medida: ${r.status}`);
    const p = await r.json();
    if (validarPluvio(p).length) throw new Error('lluvia medida mal formada');
    guardar('pluvio', p, ahora.toISOString(), almacen);   // si no cabe, se sigue sin caché
    return p;
  } catch {
    return valido;   // sin archivo o caído: el guardado aunque tenga más de 3 h; si no hay, null (la app hace lo de siempre)
  } finally { plazo.fin(); }
}

// La meteo con la lluvia medida en cada punto que la tiene y, en los demás puntos de la misma zona, el modelo corregido por
// su sesgo de 30 días frente a los puntos medidos. `seriesModelo` guarda las del modelo (el contraste AEMET compara con ellas).
export function aplicarPluvio(zonas, meteo, pluvio) {
  if (!meteo?.series || !pluvio?.lugares) return meteo;
  const series = { ...meteo.series }, porPunto = {};
  for (const z of zonas) {
    const ids = z.puntos.map((p) => p.id).filter((id) => meteo.series[id]);
    const factor = factorSesgo(ids.flatMap((id) => paresSesgo(meteo.series[id], pluvio.lugares[id], pluvio.desde, pluvio.hasta)));
    for (const id of ids) {
      const m = pluvio.lugares[id] ?? null;
      series[id] = aplicarMedida(meteo.series[id], m, { desde: pluvio.desde, hasta: pluvio.hasta, factor });
      porPunto[id] = { estaciones: m?.estaciones ?? [], cercanas: m?.cercanas ?? 0, factor };
    }
  }
  return { ...meteo, series, seriesModelo: meteo.series, pluvio: { porPunto, desde: pluvio.desde, hasta: pluvio.hasta } };
}

// Lluvia AEMET por estación y día: la validada (función «aemet», unos 3 días de retraso) y, en los días que aún no trae, la
// suma de la horaria que publica «pluvio» (solo días completos y buenos).
export function combinarObs(obs, pluvio) {
  const horaria = pluvio?.aemet;
  if (!horaria || !Object.keys(horaria).length) return obs;
  const r = { ...(obs ?? {}) };
  for (const [id, dias] of Object.entries(horaria)) {
    const d = { ...(r[id] ?? {}) };
    for (const [f, mm] of Object.entries(dias)) if (d[f] == null) d[f] = mm;
    r[id] = d;
  }
  return r;
}
```

- [ ] **Step 4: `js/aemet.js`**

1. Sustituir la función `distanciaKm` (líneas 43-49, con su comentario) por:

```js
// Distancia en km entre dos coordenadas: la misma que usan los pluviómetros (una sola copia).
import { distanciaKm } from '../supabase/functions/_shared/pluvio.js';
export { distanciaKm };
```

(Mover esa línea `import` arriba del todo, junto a las otras dos; el `export { distanciaKm };` se queda donde estaba la función.)

2. En `aplicarEstacion`, la condición del `forEach` pasa a no pisar lo medido en pluviómetros:

```js
export function aplicarEstacion(serie, obs, id) {
  const precip = [...serie.precip], origenPrecip = [...serie.origenPrecip];
  serie.fechas.forEach((f, j) => {
    if (j <= serie.hoy && obs[f] != null && origenPrecip[j] !== 'medida') { precip[j] = obs[f]; origenPrecip[j] = `estacion:${id}`; }
  });
  return { ...serie, precip, origenPrecip };
}
```

3. En `aplicarContraste`, comparar con la serie del modelo:

```js
export function aplicarContraste(zonas, meteo, obs, usarModelo = () => false) {
  if (!meteo?.series || !obs) return meteo;
  const base = meteo.seriesModelo ?? meteo.series;   // con pluviómetros, la comparación sigue siendo estación frente a modelo
  const series = { ...meteo.series }, contraste = {}, contrastePuntos = {};
  for (const z of zonas) {
    const entradas = [];
    for (const p of z.puntos.filter((q) => meteo.series[q.id])) {
      for (const est of estacionesPorCercania(p, z.estacionesAemet)) {
        const o = obs[est.id];
        if (!o) continue;
        const comparacion = compararLluvia(base[p.id], o);
        if (comparacion.P26estacion == null) continue;
        const usaModelo = comparacion.discrepa && usarModelo(z.id);
        if (!usaModelo) series[p.id] = aplicarEstacion(meteo.series[p.id], o, est.id);
        const entrada = { estacion: est, comparacion, discrepa: comparacion.discrepa, usaModelo, aplicada: !usaModelo };
        contrastePuntos[p.id] = entrada;
        entradas.push(entrada);
        break;
      }
    }
    const resumen = entradas.find((x) => x.discrepa) ?? entradas[0];
    if (resumen) contraste[z.id] = resumen;
  }
  return { ...meteo, series, contraste, contrastePuntos };
}
```

Ojo: «Usar modelo» (botón de Zona) sigue significando «no aplicar la estación AEMET»; lo medido en pluviómetros no se
desactiva con él (spec §3.3: la nota usa lo medido donde lo hay).

- [ ] **Step 5: `js/app.js`**

1. Imports: añadir `import { cargarPluvio, aplicarPluvio, combinarObs } from './pluvio.js';`.

2. `estado`: `export const estado = { datos: null, meteo: null, meteoBruta: null, obs: null, obsError: null, pluvio: null, umbrales: {} };`
y su comentario: `// meteoBruta: lo que dice el modelo; meteo: lo mismo con la lluvia medida (pluviómetros y estaciones AEMET) donde la hay.`

3. Sustituir `recalcularContraste` y `cargarObservaciones` por:

```js
// Recalcula la meteo «efectiva»: la del modelo con la lluvia medida en pluviómetros y, encima, la de las estaciones AEMET.
export function recalcularContraste() {
  if (!estado.datos || !estado.meteoBruta) { estado.meteo = estado.meteoBruta; return; }
  const conPluvio = aplicarPluvio(estado.datos.zonas, estado.meteoBruta, estado.pluvio);
  estado.meteo = aplicarContraste(estado.datos.zonas, conPluvio, combinarObs(estado.obs, estado.pluvio), usarModeloDe);
}

// Lluvia medida: estaciones AEMET (30 días hasta hoy, una sola llamada) y pluviómetros (pluvio/ultimo.json), a la vez.
// Si algo falla, se sigue con lo que haya (en el peor caso, solo modelos).
async function cargarObservaciones() {
  const estaciones = [...new Set(estado.datos.zonas.flatMap((z) => (z.estacionesAemet ?? []).map((e) => e.id)))];
  const hasta = hoyMadrid(), desde = new Date(Date.parse(`${hasta}T12:00:00Z`) - 29 * 864e5).toISOString().slice(0, 10);
  const [obs, pluvio] = await Promise.allSettled([estaciones.length ? pedirObservaciones(estaciones, desde, hasta) : Promise.resolve(null), cargarPluvio()]);
  if (obs.status === 'fulfilled') { if (obs.value) { estado.obs = obs.value; estado.obsError = null; } }
  else estado.obsError = obs.reason?.message ?? String(obs.reason);   // se conservan las observaciones anteriores, si las hay
  if (pluvio.status === 'fulfilled' && pluvio.value) estado.pluvio = pluvio.value;
  recalcularContraste();
  window.dispatchEvent(new Event('meteo'));
}
```

- [ ] **Step 6: Ejecutar las pruebas y verlas pasar**

Run: `npm test`
Expected: PASS, también `tests/aemet.test.js`, `tests/meteo.test.js` y `tests/zona-estado.test.js` sin cambios.

- [ ] **Step 7: Probar en local**

```bash
npx --yes http-server -p 8080 -c-1 .
```

Abrir `http://localhost:8080/#hoy` y `#zona/soria`: con `pluvio/ultimo.json` publicado (tarea 11), las notas cargan sin
errores en la consola; con la red de Supabase bloqueada en las herramientas del navegador (`*supabase.co*`), la app
funciona como antes. (Cualquier servidor estático vale; el puerto 8080 es el que la función `aemet` admite en CORS. El
archivo `pluvio/ultimo.json` está en Storage público y no tiene esa restricción.)

- [ ] **Step 8: Commit**

```bash
git add js/pluvio.js js/rejilla/carga.js js/aemet.js js/app.js tests/pluvio-app.test.js
git commit -m "$(cat <<'EOF'
Hoy y Zona: lluvia medida en pluviómetros (pluvio/ultimo.json) con sesgo del modelo; AEMET completa con su horaria

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 14: Textos «medida en N estaciones» o «estimada con el modelo» y gráfica con los días medidos

**Files:**
- Create: `js/ui/origen-lluvia.js`
- Modify: `js/ui/grafico-lluvia.js` (`esMedida` y clase de las barras medidas)
- Modify: `js/pantallas/zona.js` (`origenLluvia` y leyenda de `seccionLluvia`)
- Modify: `js/mapa/hoja.js` (`modeloHoja` con `lluvia`; texto en `contenido`)
- Modify: `js/pantallas/mapa.js:396` (pasa el origen de la celda a la hoja)
- Modify: `css/tokens.css`, `css/componentes.css`
- Create: `tests/pluvio-textos.test.js`

**Interfaces:**
- Consumes: `meteo.pluvio.porPunto` (tarea 13); `lluvia.origen`, `lluvia.estaciones`, `lluvia.cercanas` del índice (tarea 12).
- Produces:
  - `js/ui/grafico-lluvia.js`: `esMedida(origen) → boolean` (`'medida'` o `'estacion:…'`); barras pasadas medidas con clase `barra barra-medida` y título «(medida)».
  - `js/ui/origen-lluvia.js`: `listaEstaciones(nombres)`, `textoOrigenLluvia({ estaciones: string[], medidos, total, factor?, cercanas? }) → string`, `textoOrigenPunto(serie, porPunto) → string`, `origenDeCelda(celdaSalida) → { estaciones, medidos, total, cercanas } | null`.
  - `modeloHoja({ …, lluvia = null })` añade `origenLluvia: string|null`.
  - Tokens `--c-lluvia-medida`; clases `.grafico .barra-medida` y `.muestra--medida`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/pluvio-textos.test.js`:

```js
// tests/pluvio-textos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textoOrigenLluvia, textoOrigenPunto, origenDeCelda, listaEstaciones } from '../js/ui/origen-lluvia.js';
import { graficoLluvia, esMedida } from '../js/ui/grafico-lluvia.js';
import { modeloHoja } from '../js/mapa/hoja.js';
import { aplicarPluvio } from '../js/pluvio.js';
import { VERSION_PLUVIO } from '../supabase/functions/_shared/pluvio.js';
import { entreDias } from '../js/meteo.js';
import { serieSintetica, lluviaBuena } from './ayudas.js';

const LARGO = entreDias('2026-08-01', '2026-09-30') + 1;
const celda = { habitat: 'pinar-silvestre', altitud: 1560, orientacion: 0, tramo: 1, lat: 40.853, lon: -3.9943 };

test('lista de estaciones: una, «A y B», o «A, B…»', () => {
  assert.equal(listaEstaciones(['Covaleda']), 'Covaleda');
  assert.equal(listaEstaciones(['Covaleda', 'Duruelo']), 'Covaleda y Duruelo');
  assert.equal(listaEstaciones(['Covaleda', 'Duruelo', 'Navaleno']), 'Covaleda, Duruelo…');
});

test('texto del origen: medida en N estaciones (con los días del modelo si los hay) o estimada con el modelo', () => {
  assert.equal(textoOrigenLluvia({ estaciones: ['Covaleda', 'Duruelo', 'Navaleno'], medidos: 26, total: 26 }), 'Lluvia medida en 3 estaciones (Covaleda, Duruelo…)');
  assert.equal(textoOrigenLluvia({ estaciones: ['Covaleda'], medidos: 25, total: 26 }), 'Lluvia medida en 1 estación (Covaleda): 25 de 26 días medidos; el resto, estimado con el modelo');
  assert.equal(textoOrigenLluvia({ estaciones: [], medidos: 0, total: 26 }), 'Lluvia estimada con el modelo (sin estación cercana)');
  assert.equal(textoOrigenLluvia({ estaciones: [], medidos: 0, total: 26, factor: 0.8 }), 'Lluvia estimada con el modelo (sin estación cercana), corregida ×0,8 con las estaciones de la zona');
  // Review Focus 5: hay estaciones cerca, pero todas descartadas.
  assert.equal(textoOrigenLluvia({ estaciones: [], medidos: 0, total: 26, cercanas: 2 }), 'Lluvia estimada con el modelo (las estaciones cercanas no tienen datos válidos)');
});

test('texto de un punto de Zona a partir de aplicarPluvio', () => {
  const s = serieSintetica({ inicio: '2026-08-03', precip: lluviaBuena });
  const lugar = { mm: Array(LARGO).fill(0), n: Array(LARGO).fill(1), estaciones: [{ nombre: 'Covaleda', fuente: 'duero', km: 2 }], cercanas: 1 };
  const m = aplicarPluvio([{ id: 'z', puntos: [{ id: 'a' }, { id: 'b' }] }], { hoy: s.fechas[59], series: { a: s, b: s } },
    { version: VERSION_PLUVIO, generado: 'x', desde: '2026-08-01', hasta: '2026-09-30', lugares: { a: lugar } });
  assert.equal(textoOrigenPunto(m.series.a, m.pluvio.porPunto.a), 'Lluvia medida en 1 estación (Covaleda): 25 de 26 días medidos; el resto, estimado con el modelo');
  assert.equal(textoOrigenPunto(m.series.b, m.pluvio.porPunto.b), 'Lluvia estimada con el modelo (sin estación cercana), corregida ×0,5 con las estaciones de la zona');
});

test('origen de una celda del índice; un índice sin pluviómetros no da texto', () => {
  const lluvia = { desde: '2026-08-03', hoy: 59, mm: Array(60).fill(0), origen: [...Array(59).fill(1), 0], estaciones: ['Covaleda'], cercanas: 1 };
  assert.deepEqual(origenDeCelda({ lluvia }), { estaciones: ['Covaleda'], medidos: 25, total: 26, cercanas: 1 });
  assert.equal(origenDeCelda({ lluvia: { desde: '2026-08-03', hoy: 59, mm: Array(60).fill(0) } }), null);
});

test('hoja del mapa: el texto del origen de la lluvia, solo si el índice lo trae', () => {
  const nota = { sinEspecies: false, valor: 70, especie: { id: 'x', nombre: 'X', comunes: { es: ['equis'] } }, resultado: {}, otras: [], faltan: [] };
  const con = modeloHoja({ celda, nota, ag: { P26: 40, pct: 50, T20aire: 12 }, lluvia: { estaciones: ['Covaleda'], medidos: 26, total: 26, cercanas: 1 } });
  assert.equal(con.origenLluvia, 'Lluvia medida en 1 estación (Covaleda)');
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
});

test('los colores de lo medido salen de tokens (claro y los dos oscuros)', () => {
  const tokens = readFileSync('css/tokens.css', 'utf8');
  assert.equal((tokens.match(/--c-lluvia-medida:/g) ?? []).length, 3);
  const css = readFileSync('css/componentes.css', 'utf8');
  assert.match(css, /\.grafico \.barra-medida \{ fill: var\(--c-lluvia-medida\); \}/);
  assert.match(css, /\.muestra--medida \{ background: var\(--c-lluvia-medida\); \}/);
});
```

- [ ] **Step 2: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-textos.test.js`
Expected: FAIL con `Cannot find module …/js/ui/origen-lluvia.js`.

- [ ] **Step 3: Gráfica**

En `js/ui/grafico-lluvia.js`, después de `const nbsp = …`, añadir:

```js
// Día medido: en pluviómetros (aplicarPluvio) o en una estación AEMET (aplicarEstacion).
export const esMedida = (o) => o === 'medida' || (typeof o === 'string' && o.startsWith('estacion:'));
```

y sustituir la línea del `return` de cada barra (la del `<rect class="${prev ? …`) por:

```js
    const medida = !prev && esMedida(serie.origenPrecip?.[k]);
    const clase = prev ? 'barra prevista barra-prevista' : medida ? 'barra barra-medida' : 'barra barra-pasada';
    return `<rect class="${clase}" x="${r1(cx(k) - ancho / 2)}" y="${r1(yB1 - h)}" width="${r1(ancho)}" height="${r1(h)}" rx="1"><title>${esc(f)}: ${v.toFixed(1)} mm${prev ? ' (previsión)' : medida ? ' (medida)' : ''}</title></rect>`;
```

- [ ] **Step 4: Textos del origen**

`js/ui/origen-lluvia.js`:

```js
// js/ui/origen-lluvia.js
// De dónde sale la lluvia de los últimos 26 días (spec de pluviómetros §3.4): «Lluvia medida en 3 estaciones (Covaleda,
// Duruelo…)» o «Lluvia estimada con el modelo (sin estación cercana)». Sin DOM: lo usan Zona y la hoja del mapa.
import { esMedida } from './grafico-lluvia.js';

const coma = (x) => String(x).replace('.', ',');
export function listaEstaciones(nombres) {
  if (nombres.length <= 1) return nombres.join('');
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  return `${nombres[0]}, ${nombres[1]}…`;
}
export function textoOrigenLluvia({ estaciones = [], medidos = 0, total = 0, factor = 1, cercanas = 0 }) {
  const n = estaciones.length;
  if (n && medidos) {
    const resto = total - medidos;
    return `Lluvia medida en ${n} ${n === 1 ? 'estación' : 'estaciones'} (${listaEstaciones(estaciones)})${resto > 0 ? `: ${medidos} de ${total} días medidos; el resto, estimado con el modelo` : ''}`;
  }
  const motivo = cercanas > 0 ? 'las estaciones cercanas no tienen datos válidos' : 'sin estación cercana';
  return `Lluvia estimada con el modelo (${motivo})${factor !== 1 ? `, corregida ×${coma(factor)} con las estaciones de la zona` : ''}`;
}
// Punto de Zona: la ventana de 26 días de su serie y lo que dejó aplicarPluvio (meteo.pluvio.porPunto[id]).
export function textoOrigenPunto(serie, porPunto) {
  const dias = serie.origenPrecip?.slice(Math.max(0, serie.hoy - 25), serie.hoy + 1) ?? [];
  return textoOrigenLluvia({ estaciones: porPunto.estaciones.map((e) => e.nombre), medidos: dias.filter(esMedida).length, total: dias.length,
    factor: porPunto.factor, cercanas: porPunto.cercanas });
}
// Celda del índice del mapa: solo si el índice trae el origen (función «rejilla» con pluviómetros).
export function origenDeCelda(celda) {
  const l = celda?.lluvia;
  if (!Array.isArray(l?.estaciones) || !Array.isArray(l.origen)) return null;
  const dias = l.origen.slice(Math.max(0, l.hoy - 25), l.hoy + 1);
  return { estaciones: l.estaciones, medidos: dias.filter((c) => c === 1).length, total: dias.length, cercanas: l.cercanas ?? 0 };
}
```

- [ ] **Step 5: Zona, hoja y mapa**

En `js/pantallas/zona.js`:

1. Imports: `import { textoOrigenPunto } from '../ui/origen-lluvia.js';` y cambiar el de la gráfica a
`import { graficoLluvia, esMedida } from '../ui/grafico-lluvia.js';`.

2. Al principio de `origenLluvia(serie, meteo, zona, id)`:

```js
  const pp = meteo.pluvio?.porPunto?.[id];
  if (pp) return textoOrigenPunto(serie, pp);   // con pluvio/ultimo.json; sin él, lo de siempre (AEMET o modelo)
```

3. En `seccionLluvia`, sustituir el `el('ul', { clase: 'leyenda' }, …)` por:

```js
    el('ul', { clase: 'leyenda' },
      ...(serie.origenPrecip?.some((o, k) => k <= serie.hoy && esMedida(o))
        ? [el('li', {}, el('span', { clase: 'muestra muestra--medida' }), 'Medida en estaciones'),
          el('li', {}, el('span', { clase: 'muestra muestra--pasada' }), 'Estimada con el modelo')]
        : [el('li', {}, el('span', { clase: 'muestra muestra--pasada' }), 'Lluvia medida')]),
      el('li', {}, el('span', { clase: 'muestra muestra--prevista' }), 'Prevista, con horquilla'),
      el('li', {}, el('span', { clase: 'muestra muestra--acumulado' }), 'Acumulado (discontinuo: con previsión)')));
```

(Sin ningún día medido, la leyenda queda exactamente como hoy.)

En `js/mapa/hoja.js`:

1. Import: `import { textoOrigenLluvia } from '../ui/origen-lluvia.js';`.

2. Firma: `export function modeloHoja({ prohibido = null, normas = new Map(), celda = null, nota = null, ag = null, coto = null, zona = null, lluvia = null }) {`

3. En `base`, añadir el campo `origenLluvia: lluvia ? textoOrigenLluvia(lluvia) : null,` (después de `avisos`).

4. En `contenido`, justo después del `el('dl', { clase: 'hoja__filas' }, …)`, añadir el párrafo (el `nodos.push(...)` de
esa línea pasa a ser):

```js
  nodos.push(el('dl', { clase: 'hoja__filas' }, m.filas.flatMap((f) => [el('dt', { texto: f.etiqueta }), el('dd', { texto: f.valor })])),
    m.origenLluvia ? el('p', { clase: 'texto-2 texto-s', texto: m.origenLluvia }) : null,
    el('p', { clase: 'texto-s' }, m.coto.url ? enlace(m.coto.url, m.coto.texto) : m.coto.texto),
    el('div', { clase: 'hoja__acciones' }, enlace(m.acciones.comoLlegar, 'Cómo llegar', 'boton'),
      m.acciones.detalle ? el('a', { clase: 'boton boton--suave', href: m.acciones.detalle, texto: 'Ver detalle' }) : null,
      el('a', { clase: 'boton boton--suave', href: m.acciones.diario, texto: 'Guardar en el diario' })));
```

(`contenido` ya filtra los `null` con `.filter(Boolean)` al pintar; `el` también los quita.)

En `js/pantallas/mapa.js`: import `import { origenDeCelda } from '../ui/origen-lluvia.js';` y, en `tocar`, la llamada a
`modeloHoja` (línea 396) pasa a:

```js
    abrir(modeloHoja({ celda, nota, ag: agHoja, coto: coto?.properties ?? null, zona, lluvia: origenDeCelda(enSalida) }),
```

- [ ] **Step 6: Colores**

En `css/tokens.css`: después de `  --c-lluvia: var(--p-bosque-500);` añadir `  --c-lluvia-medida: var(--p-bosque-700);`; después de
`    --c-lluvia: var(--p-bosque-300);` (bloque `@media (prefers-color-scheme: dark)`) añadir
`    --c-lluvia-medida: var(--p-bosque-100);`; y después de `  --c-lluvia: var(--p-bosque-300);` (bloque del tema oscuro
forzado) añadir `  --c-lluvia-medida: var(--p-bosque-100);`.

En `css/componentes.css`, después de `.grafico .barra-pasada { fill: var(--c-lluvia); }` añadir
`.grafico .barra-medida { fill: var(--c-lluvia-medida); }`, y después de `.muestra--pasada { background: var(--c-lluvia); }`
añadir `.muestra--medida { background: var(--c-lluvia-medida); }`.

- [ ] **Step 7: Ejecutar las pruebas y verlas pasar**

Run: `npm test`
Expected: PASS, también `tests/grafico-lluvia.test.js` y `tests/mapa-hoja.test.js` sin cambios.

- [ ] **Step 8: Probar en local**

Con el servidor de la tarea 13: en `#zona/soria`, la cifra «Últimos 26 días» dice «Lluvia medida en N estaciones (…)» y la
gráfica tiene las barras de los días medidos más oscuras, con la leyenda «Medida en estaciones» y «Estimada con el modelo»;
en `#zona/toledo` (Montes de Toledo, casi sin estaciones), «Lluvia estimada con el modelo…». Comprobar en claro y en oscuro
que se distinguen las dos barras. En el mapa (`#mapa`, zum ≥ 9), la hoja de una mancha de Soria trae el texto bajo las filas
(solo cuando la función `rejilla` ya publique con pluviómetros, tarea 16).

- [ ] **Step 9: Commit**

```bash
git add js/ui/origen-lluvia.js js/ui/grafico-lluvia.js js/pantallas/zona.js js/mapa/hoja.js js/pantallas/mapa.js css/tokens.css css/componentes.css tests/pluvio-textos.test.js
git commit -m "$(cat <<'EOF'
Zona y mapa: «Lluvia medida en N estaciones» o «estimada con el modelo», y días medidos en la gráfica

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 15: Créditos y licencias de las fuentes y estado de las lecturas en Ajustes; documentación

**Files:**
- Modify: `js/pluvio.js` (`estadoFuentesLluvia`)
- Modify: `js/pantallas/ajustes.js` (`bloqueCreditos` con las fuentes de lluvia y su estado)
- Modify: `docs/supabase.md`, `README.md` (si menciona las fuentes de datos)
- Create: `tests/pluvio-ajustes.test.js`

**Interfaces:**
- Consumes: `FUENTES_LLUVIA`, `LICENCIAS` (tarea 7); `pluvio.fuentes` (tarea 10); `estado.pluvio` (tarea 13).
- Produces: `estadoFuentesLluvia(pluvio, hoy, diasAviso = 2) → [{ fuente, nombre, url, licencia: texto, ultima: fecha|null, aviso: boolean }]` (lista vacía sin `pluvio`).

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/pluvio-ajustes.test.js`:

```js
// tests/pluvio-ajustes.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estadoFuentesLluvia, FUENTES_LLUVIA } from '../js/pluvio.js';

test('estado de las fuentes: último día con dato y aviso si pasan más de 2 días', () => {
  const l = estadoFuentesLluvia({ fuentes: { duero: '2026-10-01', tajo: '2026-09-28' } }, '2026-10-02');
  assert.deepEqual(l.map((f) => [f.fuente, f.ultima, f.aviso]), [
    ['tajo', '2026-09-28', true], ['duero', '2026-10-01', false], ['jucar', null, true], ['euskalmet', null, false], ['aemet', null, true]]);
  assert.equal(l[0].nombre, FUENTES_LLUVIA.tajo.nombre);
  assert.match(l[3].licencia, /CC BY 4\.0/);
  assert.deepEqual(estadoFuentesLluvia(null, '2026-10-02'), []);
});

test('Ajustes da crédito a cada fuente de lluvia con su licencia y enseña su estado', () => {
  const src = readFileSync('js/pantallas/ajustes.js', 'utf8');
  assert.match(src, /estadoFuentesLluvia\(estado\.pluvio, hoyMadrid\(\)\)/);
  assert.match(src, /Lluvia medida en pluviómetros/);
});
```

Euskalmet no avisa aunque no tenga fecha: se rellena a mano desde su zip mensual (tarea 6), con semanas de retraso
(`RETRASO_CONOCIDO`).

- [ ] **Step 2: Ejecutarlas y ver que fallan**

Run: `node --test tests/pluvio-ajustes.test.js`
Expected: FAIL con `does not provide an export named 'estadoFuentesLluvia'`.

- [ ] **Step 3: `estadoFuentesLluvia`**

Añadir a `js/pluvio.js` (con `import { sumarDias } from './meteo.js';` arriba y `FUENTES_LLUVIA`, `LICENCIAS` también
importados para uso local: `import { FUENTES_LLUVIA, LICENCIAS } from '../supabase/functions/_shared/pluvio-fuentes.js';`):

```js
// Fuentes que se rellenan a mano con semanas de retraso (Euskalmet, zip mensual): sin aviso por antigüedad.
const RETRASO_CONOCIDO = new Set(['euskalmet']);
// Estado de cada fuente para Ajustes: último día con dato (pluvio.fuentes) y aviso si hace más de `diasAviso` días.
export function estadoFuentesLluvia(pluvio, hoy, diasAviso = 2) {
  if (!pluvio) return [];
  const limite = sumarDias(hoy, -diasAviso);
  return ['tajo', 'duero', 'jucar', 'euskalmet', 'aemet'].map((fuente) => {
    const f = FUENTES_LLUVIA[fuente], ultima = pluvio.fuentes?.[fuente] ?? null;
    return { fuente, nombre: f.nombre, url: f.url, licencia: LICENCIAS[f.licencia], ultima,
      aviso: !RETRASO_CONOCIDO.has(fuente) && (ultima == null || ultima < limite) };
  });
}
```

(La reexportación `export { FUENTES_LLUVIA, LICENCIAS } from …` de la tarea 13 se queda; el `import` es para usarlas aquí.)

Comprobación: con hoy 02/10 y 2 días, el límite es el 30/09: Tajo (28/09) avisa, Duero (01/10) no.

- [ ] **Step 4: Ajustes**

En `js/pantallas/ajustes.js`:

1. Imports: `import { estadoFuentesLluvia } from '../pluvio.js';` y `import { hoyMadrid } from '../meteo.js';`.

2. Añadir, antes de `bloqueCreditos`:

```js
// Lluvia medida en pluviómetros: crédito y licencia de cada fuente y, si ya se ha cargado pluvio/ultimo.json, su último
// día con datos (con aviso si una fuente lleva más de 2 días sin dar nada).
const FECHA_LARGA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
function creditosLluvia(estado) {
  const filas = estadoFuentesLluvia(estado.pluvio, hoyMadrid());
  if (!filas.length) return null;
  return el('details', { clase: 'ajustes-especie' },
    el('summary', {}, el('span', { clase: 'ajustes-especie__nombre', texto: 'Lluvia medida en pluviómetros' })),
    el('ul', { clase: 'ajustes-creditos' }, ...filas.map((f) => el('li', {},
      enlace(f.nombre, f.url), `: ${f.licencia} `,
      el('span', { clase: f.aviso ? 'etiqueta etiqueta--ocre' : 'texto-2', texto: f.ultima ? `Último día con datos: ${FECHA_LARGA.format(new Date(`${f.ultima}T12:00:00Z`))}.` : 'Sin datos todavía.' })))));
}
```

3. En `bloqueCreditos(datos)`: la firma pasa a `bloqueCreditos(datos, estado)`; añadir a la lista, después de la línea de
AEMET:

```js
    li('Pluviómetros de montaña: ', enlace('SAIH Tajo', 'https://saihtajo.chtajo.es/'), ', ', enlace('SAIH Duero', 'https://www.saihduero.es/'), ' y ',
      enlace('SAIH Júcar', 'https://saih.chj.es/'), ' (confederaciones hidrográficas; información del sector público reutilizable citando la fuente, datos provisionales sin depurar) y ',
      enlace('Euskalmet, Gobierno Vasco', 'https://opendata.euskadi.eus/'), ' (CC BY 4.0). La app les aplica su propio control de calidad.'),
```

y, al final de la sección (junto a `creditosFotos(datos)`), `creditosLluvia(estado)`:

```js
  creditosLluvia(estado), creditosFotos(datos));
```

4. En `pintar`: `bloqueCreditos(estado.datos, estado)`.

- [ ] **Step 5: Documentación**

En `docs/supabase.md`, sección `pluvio`, añadir:

```markdown
- La app lee `indice/pluvio/ultimo.json` (Hoy y Zona, `js/pluvio.js`) y la función `rejilla` lee `indice/pluvio/celdas.json`
  al construir las series de las celdas gruesas. Si faltan, todo funciona como antes, solo con el modelo.
- Avisos: Ajustes → Créditos → «Lluvia medida en pluviómetros» dice el último día con datos de cada fuente y marca en ocre
  las que llevan más de 2 días sin dar nada (Euskalmet no, porque se rellena a mano). Si una fuente falla seguido, mirar
  `node scripts/pluvio/sonda.mjs` y el registro de la función.
- Licencias: SAIH Tajo, Duero y Júcar, información del sector público reutilizable citando la fuente (Ley 37/2007), datos
  provisionales; Euskalmet, CC BY 4.0; AEMET, citando a AEMET. Detalle: `supabase/functions/_shared/pluvio-fuentes.js`.
```

Si `README.md` tiene una lista de fuentes de datos, añadir una línea con «Lluvia medida: SAIH Tajo, Duero y Júcar,
Euskalmet y AEMET horario (función `pluvio`)».

- [ ] **Step 6: Ejecutar las pruebas y verlas pasar**

Run: `npm run comprobar`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/pluvio.js js/pantallas/ajustes.js docs/supabase.md README.md tests/pluvio-ajustes.test.js
git commit -m "$(cat <<'EOF'
Ajustes: créditos y licencias de los pluviómetros y estado de cada fuente; documentación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
```

---

### Task 16: Despliegue de `rejilla` con pluviómetros, verificación e integración de la rama  ⚠️ requiere token y autorización

> **El controlador se para al empezar esta tarea.** Hace falta un *access token* nuevo de Supabase y la **autorización explícita de la usuaria** para volver a desplegar la función `rejilla` (y `pluvio`, si cambió desde la tarea 11), y su visto bueno para integrar la rama en `main` (GitHub Pages publica `main` al instante: Hoy, Zona y el mapa cambian para todos). Sin token, se puede integrar igualmente la parte del navegador si la usuaria lo autoriza: sin `celdas.json` aplicado por `rejilla`, el mapa sigue como hoy y Hoy y Zona ya usan `ultimo.json`.

**Files:**
- Modify: `docs/supabase.md` (fechas reales)

**Interfaces:**
- Consumes: tareas 11 a 15.
- Produces: `rejilla` desplegada leyendo `pluvio/celdas.json`; rama `pluviometros` integrada en `main`.

- [ ] **Step 1: Preguntar a la usuaria y esperar**

Mensaje (en español): qué cambia para ella (la lluvia de las notas pasa a ser la medida donde hay pluviómetros, se dice de
dónde sale y la gráfica lo distingue; en el mapa, a partir de la siguiente ejecución de las 07:00 o las 19:00), que se
despliega `rejilla` y que se integra la rama en `main`. Pedir el token.

- [ ] **Step 2: Comprobar todo antes de desplegar**

```bash
npm run comprobar
git log --oneline main..pluviometros
```

Expected: PASS; los commits de las tareas 3 a 15.

- [ ] **Step 3: Desplegar `rejilla` (y `pluvio` si hace falta) desde la rama**

```bash
export SUPABASE_ACCESS_TOKEN=<token nuevo que da la usuaria, solo en esta terminal>
npx --yes supabase@2.118.0 functions deploy rejilla --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj
git diff --stat <commit de la tarea 11>..HEAD -- supabase/functions/pluvio supabase/functions/_shared/pluvio.js
```

Si el `diff` muestra cambios en `pluvio` o en `_shared/pluvio.js` desde la tarea 11, desplegar también
`npx --yes supabase@2.118.0 functions deploy pluvio --no-verify-jwt --use-api --project-ref ctgedeunquvmcfqsufjj`.

- [ ] **Step 4: Verificar la siguiente publicación del índice**

Tras la ejecución de las 07:00 o las 19:00 de Madrid (o forzando en otra hora, ver `docs/supabase.md`):

```bash
curl -s "https://ctgedeunquvmcfqsufjj.supabase.co/storage/v1/object/public/indice/ultimo.json"
curl -s "https://ctgedeunquvmcfqsufjj.supabase.co/storage/v1/object/public/indice/<archivo del puntero>" | node -e "
let t = ''; process.stdin.on('data', (d) => (t += d)).on('end', async () => {
  const { validarSalida } = await import('./supabase/functions/_shared/salida-indice.js');
  const s = JSON.parse(t), celdas = Object.values(s.celdas);
  console.log(validarSalida(s), celdas.length, 'celdas;', celdas.filter((c) => c.lluvia.origen?.includes(1)).length, 'con lluvia medida');
});"
```

Expected: `[]`, unas 355 celdas y bastantes con lluvia medida (las de las zonas con estaciones).

- [ ] **Step 5: Integrar la rama (con el visto bueno de la usuaria)**

Usar la skill `superpowers:finishing-a-development-branch`. Integración en `main` por avance rápido o merge, subida con el
ayudante de credenciales local del repo (nunca `gh auth switch`); el gancho pre-push ejecuta `npm run comprobar`. Después,
abrir `https://gonzalotsainz-ux.github.io/setas/#zona/soria` en el móvil y comprobar el texto «Lluvia medida en…», la
gráfica y que nada se rompe sin conexión.

- [ ] **Step 6: Documentar y cerrar**

En `docs/supabase.md`, sustituir las fechas «AAAA-MM-DD» que queden por las reales y añadir a la sección de `rejilla`:
«Desde el AAAA-MM-DD, `rejilla` toma `pluvio/celdas.json` (si está y valida) para la lluvia pasada de cada celda gruesa.».
Recordar a la usuaria que revoque el token.

```bash
git add docs/supabase.md
git commit -m "$(cat <<'EOF'
Supabase: rejilla desplegada con la lluvia de los pluviómetros; fechas reales documentadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019HgszeG4SvXAvszybRvUZo
EOF
)"
git push origin main
```

---

## Autorrevisión

**1. Cobertura de la spec.**
- §1 lluvia de la nota medida con control de calidad → tareas 8, 9, 12 y 13; modelo corregido por su sesgo donde no hay estación, y se dice → 9, 13 y 14; la usuaria ve el origen → 14; las notas no se vuelven locas por un pluviómetro averiado → 8 (Quintanar); si la función falla, la app sigue como hoy → 12 y 13 (equivalencia).
- §2 fuentes: SAIH Tajo → 1; AEMET horario → 1; SAIH Duero → 3; SAIH Júcar → 5; Euskalmet zip, y tiempo real preparado → 6. Las descartadas no entran.
- §3.1 función separada, pg_cron cada hora en el minuto 10, misma protección de clave → 1 y 2; lista blanca con script local (distancia < 20 km, altitud parecida; fuente, código, nombre, lat, lon, altitud, licencia) → 7; `lluvia_obs` y `lluvia_dia` privadas → 1 y 4; relleno desde el 1 de agosto (Duero, Júcar, Euskalmet) y Tajo cuanto antes → 2, 3, 5, 6 y 11; cortesía y plazo < 150 s → 1 (`red.js`, `PLAZO_EJECUCION`).
- §3.2 control de calidad con sus cuatro reglas, umbrales en un módulo → 4 y 8.
- §3.3 mezcla por distancia y altitud con radio → 9; sesgo de 30 días acotado 0,5–2 → 9; la previsión, sin cambios → `aplicarMedida` no toca hoy ni los días futuros (9); `rejilla` toma la lluvia de las celdas gruesas → 12; Hoy y Zona leen `pluvio/ultimo.json`, cacheado → 13; si falta, todo como hoy → 12 y 13; el contraste AEMET se mantiene y usa la horaria → 13 (`combinarObs`).
- §3.4 textos en Zona y en la hoja, gráfica que distingue los días medidos → 14; créditos con licencia en Ajustes → 15.
- §4 pruebas: lectores con respuestas reales guardadas, incluida la suma de Tajo solo en horas en punto → 1, 3, 5 y 6; control de calidad con casos reales → 8; mezcla y sesgo con números exactos; sin estaciones, igual que hoy → 9, 12 y 13; equivalencia → 12 y 13; `npm run comprobar` sigue siendo el gancho → todas.
- §6 riesgos: lectores aislados por fuente, prueba en vivo (sonda) y aviso si una fuente deja de responder → 7 y 15; licencias documentadas → 7 y 15; despliegue con token y autorización → 2, 11 y 16; urgencia de Tajo → tareas 1 y 2 primero, con su excepción de rama.

**2. Marcadores.** Revisado: no quedan «TBD», «implementar después» ni pasos sin código; las fechas «AAAA-MM-DD» de
`docs/supabase.md` son datos que solo existen al desplegar y cada tarea de despliegue dice que se sustituyan.

**3. Coherencia de tipos y nombres.** `filaObs` y `unicas` (1) se usan en 4, 6 y 8; `calidadHora` sustituye a `'bruto'` en 8
y la prueba de la tarea 1 se actualiza ahí. `TAREAS` crece en 3 (`duero`, `duero90`), 4 (`publicar`, paso), 5 (`jucar`,
antes de `publicar`). `publicar` pasa por tres versiones (4, 8 y 10) y cada una se da entera. El contexto de los pasos
(`almacen, hoy, ahora, estaciones, puntos, gruesa`) crece en 8 y 10. `lugares` (no `puntos`) es la clave de los archivos
publicados en 9, 10, 12 y 13. `distanciaKm` vive en `_shared/pluvio.js` desde la 7 y la reexporta `js/aemet.js` en la 13.
`esMedida` (14) cubre `'medida'` y `'estacion:…'`; `origenPrecip` usa `'modelo'`, `'medida'`, `'estimada'` y `'estacion:ID'`.

**4. Review Focus.** Cada línea tiene su prueba: (1) cambio de hora → tareas 1 y 4; (2) formato cambiado o página de error
→ tareas 1 (Tajo sin P1) y 3 (Duero con la gráfica de temperatura); (3) pluviómetro atascado en 0 → tarea 8 (regla «seco
aislado», umbrales en `calidad.js`); (4) archivo de otra versión o caché vieja → tarea 13; (5) estaciones cercanas todas
descartadas → tareas 9 (`cercanas`) y 14 (texto).




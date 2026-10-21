# Mapa por niveles — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la app gire en torno al mapa: una sola vista por niveles (zonas → montes → laderas) con chinchetas, hoja fija con la lista «Dónde ir» y buscador de cualquier sitio de España; «Hoy» desaparece de la barra.

**Architecture:** La pantalla `js/pantallas/mapa.js` pasa a tener una **selección** (zona, monte) leída del hash y un **nivel visual** derivado del zoom. Las piezas nuevas son módulos puros sin DOM (notas por zona y por punto, rutas, chinchetas, contorno, modelos de la hoja, geocodificador, etiquetas) probados con `node --test`, y tres piezas con DOM (capa de chinchetas, hoja fija, buscador asíncrono) que la pantalla monta. Lo que hacía `js/pantallas/hoy.js` se mueve a un módulo compartido y la pantalla desaparece.

**Tech Stack:** Vanilla JS (módulos ES, sin empaquetador), Leaflet 1.9.4 (cdnjs), CSS con tokens propios, `node --test`, GitHub Pages (`git push` a `main` con gancho pre-push `npm run comprobar`). Geocodificador: CartoCiudad (IGN).

**Spec:** `docs/superpowers/specs/2026-10-21-mapa-niveles-design.md` (maquetas: `maqueta/mapa-niveles.html`).

## Global Constraints

- Vanilla JS con módulos, sin empaquetador; Leaflet 1.9.4 desde cdnjs; nada numérico sin `semaforo()`/`nivelDe()`; nunca una nota sin datos (sale «?» / «sin datos»).
- Tokens y componentes de `docs/diseno.md`: cuaderno de campo, semáforo con palabra y barras, bisel doble en la pieza principal, isla de navegación, `prefers-reduced-motion`. Cualquier color nuevo pasa por `node scripts/contraste.mjs` (0 fallos).
- Nunca rectángulos de zona ni halos rellenos («los cuadraditos»). El contorno de zona: fino, discontinuo, sin relleno, solo para la zona seleccionada.
- Toxicología y la franja «Ante la duda, no la comas.» siguen visibles en todo momento; la cabecera no cambia.
- Pellizcar y arrastrar **nunca** cambian la ruta; solo los toques explícitos (chincheta, fila, miga, sugerencia, atrás).
- Idioma de UI, código, pruebas y documentación: español. Número y unidad con espacio duro (` `).
- Pruebas con `node --test tests/*.test.js`; antes de cada push, `npm run comprobar` (pruebas + validador de datos) debe pasar.
- Despliegue: commit y `git push origin main` (GitHub Pages). Usar el ayudante de credenciales local del repo; nunca `gh auth switch`.

## Review Focus

1. **Zona sin ningún punto recogible con serie (p. ej. todos NO IR o sin meteo):** la chincheta y la fila salen «?»/«sin datos», nunca con una nota; el orden la pone al final. Prueba en la Tarea 5 (`chinchetasZonas` con `valor: null`) y en la Tarea 2 (`calcularZona` → `res.valor === null`).
2. **Meteo caducada (tanda de ayer) con índice de hoy:** la barra enseña «Hoy» y las chinchetas usan el día de la tanda vieja que corresponde a hoy (`d = 1`), no el día 0. Prueba en la Tarea 2 (`desplazamientoDia`) y en la Tarea 8 (`fechasBarra`).
3. **Sitio buscado fuera de las 12 zonas:** el mapa va allí, hay chincheta de búsqueda y la hoja avisa con las tres zonas más cercanas; no se pinta ninguna mancha ni se inventa nota. Prueba en la Tarea 4 (`fueraDeZonas`, `zonasMasCercanas`).
4. **Botón atrás tras varios toques:** cada toque es una entrada de historial (`location.hash = …`), «‹» hace `history.back()`, y arrastrar el mapa lejos de la zona elegida no la deselecciona. Prueba en la Tarea 3 (`rutaMapa`/`leerRutaMapa` ida y vuelta) y en la Tarea 8 (la selección no cambia en `moveend`).
5. **Fecha que existe en el índice pero no en la meteo (o al revés):** chincheta y fila «sin datos» para esa fecha; las manchas de una fecha que no está en el índice no se pintan y el aviso lo dice. Prueba en la Tarea 8 (`fechasBarra` y `desplazamientoDia` fuera de 0..7).
6. **Zona con un solo monte (Merindades) o con el nombre corto repetido:** el validador rechaza `corto` repetido en la misma zona; el nivel 2 con una sola chincheta se encuadra con `setView` y no con `fitBounds` de un punto. Prueba en la Tarea 1 (validador) y nota en la Tarea 8.

---

### Task 1: Nombre corto de los montes en los datos

**Files:**
- Modify: `data/zonas.json` (campo `corto` en los 50 puntos)
- Modify: `scripts/validar-datos.mjs:47-54`
- Test: `tests/datos.test.js`

**Interfaces:**
- Produces: `punto.corto: string` (2 a 18 caracteres, único dentro de su zona) en todos los puntos de `data/zonas.json`.

- [ ] **Step 1: Escribir la prueba que falla**

```js
test('todos los puntos tienen nombre corto (2 a 18 caracteres) y es único en su zona', () => {
  const zonas = JSON.parse(readFileSync(new URL('../data/zonas.json', import.meta.url), 'utf8')).zonas;
  for (const z of zonas) {
    const cortos = z.puntos.map((p) => p.corto);
    for (const c of cortos) assert.ok(typeof c === 'string' && c.length >= 2 && c.length <= 18, `${z.id}: «${c}»`);
    assert.equal(new Set(cortos).size, cortos.length, `${z.id}: corto repetido`);
  }
});
test('comprobarCortos: rechaza un punto sin corto, uno largo y dos iguales en la misma zona', () => {
  const zona = (puntos) => ({ id: 'z', puntos: puntos.map((corto, k) => ({ id: `p${k}`, corto })) });
  assert.deepEqual(comprobarCortos(zona(['Valsaín', 'Morcuera'])), []);
  assert.deepEqual(comprobarCortos(zona([undefined])), ['punto p0: sin corto']);
  assert.deepEqual(comprobarCortos(zona(['Pinar de repoblación de pino'])), ['punto p0: corto de más de 18 caracteres']);
  assert.deepEqual(comprobarCortos(zona(['Valsaín', 'Valsaín'])), ['zona z: corto repetido «Valsaín»']);
});
```

(`comprobarCortos(zona)` → `string[]` se exporta de `scripts/validar-datos.mjs`, como ya se exporta `HABITATS`, y el validador la llama dentro del bucle de zonas.)

- [ ] **Step 2: Ejecutar la prueba y ver que falla**

Run: `node --test tests/datos.test.js`
Expected: FAIL (los puntos no tienen `corto`).

- [ ] **Step 3: Añadir `corto` a los 50 puntos y las reglas al validador**

Regla para rellenarlo: el nombre del monte o del paraje, no el del pueblo, salvo que el monte solo se conozca por el pueblo («Valsaín», «Morcuera», «Canencia», «Miraflores», «Cercedilla», «La Camorza», «Hueco San Blas», «Moroviejo», «Villanadillas», «Riaza», «Pinar Grande», «Navaleno», «Cidones», «Hontoria», «Monte Agudo», «Cerneja», «Navahondilla», «El Arenal», «Palomera», «Boniches», «Poveda», «Tierzo», «Gorbeia», «Entzia», «Izki», «San Pedro», «Villuercas», «Ambroz», «Trevejo»…). Validador: `export function comprobarCortos(zona)` → `string[]` con los mensajes `punto ${p.id}: sin corto` (no es `string`), `punto ${p.id}: corto de más de 18 caracteres` (también si tiene menos de 2) y `zona ${z.id}: corto repetido «…»`; el bucle de zonas pasa cada mensaje a `err`.

- [ ] **Step 4: Ejecutar pruebas y validador**

Run: `node --test tests/datos.test.js && npm run validar`
Expected: PASS y «Datos válidos».

- [ ] **Step 5: Commit**

```bash
git add data/zonas.json scripts/validar-datos.mjs tests/datos.test.js
git commit -m "Datos: nombre corto de cada monte (corto) con validación"
```

---

### Task 2: Módulo compartido de notas por zona y por punto (sale de «Hoy»)

**Files:**
- Create: `js/notas-zona.js`
- Modify: `js/pantallas/hoy.js` (importa del módulo nuevo; la pantalla se borra en la Tarea 10)
- Modify: `js/mapa/hoja.js:13` (importa `textoFaltan` de `../notas-zona.js`)
- Modify: `tests/meteo.test.js`, `tests/pluvio-app.test.js`, `tests/zona-estado.test.js` (cambian el import de `../js/pantallas/hoy.js` a `../js/notas-zona.js`)
- Test: `tests/notas-zona.test.js`

**Interfaces:**
- Consumes: `indiceZona(seriesPorPunto, i, especies)` y `entreDias(a, b)` de `js/indice.js` / `js/meteo.js`; `especiesDeZona`, `puntosRecogibles`, `rotuloPunto` de `js/datos.js`; `serieSintetica`, `BOLETUS`, `NISCALO`, `lluviaBuena` de `tests/ayudas.js`.
- Produces (todo exportado de `js/notas-zona.js`):
  - `calcularZona(zona, datos, meteo, d, filtro, umbrales = {})` → la fila de siempre `{ zona, res, mejor, incierta, discrepa, rotulo, motivo }`. `filtro` es `null` (todas), un `string` (una especie, compatibilidad) o un `Set<string>`/`string[]` de ids (chip de grupo).
  - `ordenarZonas(filas)`, `textoFaltan(n)`, `haceCuanto(iso, ahora)`, `fraseZona(fila, datos)` (la antigua `frase`: nodos DOM).
  - `desplazamientoDia(fecha, meteoHoy)` → entero `0..7` o `null` (fecha fuera del horizonte o anterior a la tanda).
  - `notaPuntoDia(zona, punto, datos, meteo, d, filtro, umbrales = {})` → `{ valor, nivel, etiqueta, mejor: { id, especie, resultado } | null, especies, fueraDeTemporada, incompleta, faltan, motivo }`; sin serie o `d === null` → `valor: null`, `motivo` con texto.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
test('calcularZona acepta un conjunto de ids (chip de grupo) y una sola id (compatibilidad)', () => {
  const zona = { id: 'z', habitats: ['pinar-silvestre'], puntos: [{ id: 'p1', habitat: 'pinar-silvestre' }] };
  const meteo = { series: { p1: serieSintetica({ precip: lluviaBuena }) } };
  const datos = { especies: [BOLETUS, NISCALO], porId: { [BOLETUS.id]: BOLETUS, [NISCALO.id]: NISCALO } };
  const grupo = calcularZona(zona, datos, meteo, 0, new Set([BOLETUS.id, NISCALO.id]));
  const una = calcularZona(zona, datos, meteo, 0, BOLETUS.id);
  assert.equal(grupo.res.especies.length, 2);
  assert.deepEqual(una.res.especies.map((e) => e.id), [BOLETUS.id]);
});
test('desplazamientoDia: hoy con tanda de hoy es 0; con tanda de ayer es 1; fuera de 0..7 es null', () => {
  assert.equal(desplazamientoDia('2026-10-21', '2026-10-21'), 0);
  assert.equal(desplazamientoDia('2026-10-21', '2026-10-20'), 1);
  assert.equal(desplazamientoDia('2026-10-20', '2026-10-21'), null);
  assert.equal(desplazamientoDia('2026-10-29', '2026-10-21'), null);
  assert.equal(desplazamientoDia('2026-10-28', '2026-10-21'), 7);
});
test('notaPuntoDia: sin serie no hay nota ni nivel inventado; con serie, nota y especie que la da', () => {
  assert.equal(notaPuntoDia(zona, { id: 'nada' }, datos, meteo, 0, null).valor, null);
  const n = notaPuntoDia(zona, zona.puntos[0], datos, meteo, 0, null);
  assert.ok(n.valor >= 0 && n.valor <= 100);
  assert.equal(n.nivel, nivelDe(n.valor));
  assert.equal(n.mejor.id, n.especies[0].id);
});
test('notaPuntoDia con d null (fecha fuera del horizonte) devuelve sin datos', () => {
  assert.equal(notaPuntoDia(zona, zona.puntos[0], datos, meteo, null, null).valor, null);
});
```

(Las especies de `tests/ayudas.js` necesitan `habitats: ['pinar-silvestre']`, `categoria: 'comestible'` y `zonas: { z: { presencia: 'si' } }` para pasar `especiesDeZona`: construir copias en la prueba.)

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `node --test tests/notas-zona.test.js`
Expected: FAIL con «Cannot find module».

- [ ] **Step 3: Crear `js/notas-zona.js` moviendo de `hoy.js` `calcularZona`, `ordenarZonas`, `frase` (renombrada `fraseZona`), `textoFaltan`, `haceCuanto` y sus ayudas (`negrita`, `latin`, `nbsp`, `sinDatosZona`); añadir `desplazamientoDia` y `notaPuntoDia`**

`desplazamientoDia` usa `entreDias(meteoHoy, fecha)` y devuelve `null` fuera de `0..7`. `notaPuntoDia` llama a `indiceZona({ [punto.id]: serie }, serie.hoy + d, especies filtradas)`; `nivel` con `nivelDe`. `calcularZona` normaliza `filtro` a `Set` al principio. `hoy.js` pasa a importar todo esto (sin lógica duplicada).

- [ ] **Step 4: Ejecutar toda la batería**

Run: `npm test`
Expected: PASS (los tres tests que importaban de `hoy.js` ya apuntan al módulo nuevo).

- [ ] **Step 5: Commit**

```bash
git add js/notas-zona.js js/pantallas/hoy.js js/mapa/hoja.js tests/notas-zona.test.js tests/meteo.test.js tests/pluvio-app.test.js tests/zona-estado.test.js
git commit -m "Notas por zona y por punto en un módulo compartido (sale de la pantalla Hoy)"
```

---

### Task 3: Rutas: el mapa es la portada, «Hoy» desaparece, Zona admite punto

**Files:**
- Create: `js/mapa/ruta.js`
- Modify: `js/app.js:11-14, 27-46` (ruta por defecto, `#hoy` → `#mapa`, `SECCION`, foco dentro del mapa)
- Modify: `index.html:28, 53-61` (logo a `#mapa`; barra con Mapa, Especies, Diario, Ajustes)
- Modify: `js/pantallas/zona.js:58, 284, 279-290` («‹ Mapa», ruta con punto)
- Test: `tests/ruta.test.js`

**Interfaces:**
- Produces (`js/mapa/ruta.js`):
  - `leerRutaMapa(hash)` → `{ zona: string|null, punto: string|null }` (`'#mapa'`, `'#mapa/guadarrama'`, `'#mapa/guadarrama/guadarrama-valsain-pinar'`; ids con `decodeURIComponent`; cualquier otro hash → ambos `null`).
  - `rutaMapa({ zona = null, punto = null })` → `'#mapa' | '#mapa/<zona>' | '#mapa/<zona>/<punto>'` (ids con `encodeURIComponent`).
  - `leerRutaZona(hash)` → `{ zona, punto }` para `#zona/<zona>[/<punto>]`; `rutaZona(zona, punto = null)`.
- `js/app.js`: exporta nada nuevo; la ruta por defecto y `#hoy` cargan `pantallas.mapa`; `SECCION = { zona: 'mapa', especie: 'especies', seguridad: 'especies' }`; cuando el hash anterior y el nuevo empiezan por `#mapa`, no hace `scrollTo` ni `raiz.focus`.
- `js/pantallas/zona.js`: `pintar` lee `leerRutaZona(location.hash)`; si trae `punto` válido, `ui.punto[zona.id] = punto` antes de pintar; el enlace «volver» es `{ href: '#mapa', texto: 'Mapa' }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
test('rutaMapa y leerRutaMapa son inversas, con ids codificados', () => {
  for (const s of [{ zona: null, punto: null }, { zona: 'guadarrama', punto: null }, { zona: 'guadarrama', punto: 'guadarrama-valsain-pinar' }]) {
    assert.deepEqual(leerRutaMapa(rutaMapa(s)), s);
  }
  assert.equal(rutaMapa({}), '#mapa');
  assert.deepEqual(leerRutaMapa('#hoy'), { zona: null, punto: null });
  assert.deepEqual(leerRutaMapa('#mapa/sierra%20norte'), { zona: 'sierra norte', punto: null });
});
test('leerRutaZona admite punto opcional', () => {
  assert.deepEqual(leerRutaZona('#zona/soria'), { zona: 'soria', punto: null });
  assert.deepEqual(leerRutaZona('#zona/soria/soria-covaleda-pinar'), { zona: 'soria', punto: 'soria-covaleda-pinar' });
  assert.equal(rutaZona('soria', 'soria-covaleda-pinar'), '#zona/soria/soria-covaleda-pinar');
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `node --test tests/ruta.test.js`
Expected: FAIL con «Cannot find module».

- [ ] **Step 3: Crear `js/mapa/ruta.js` y cambiar `app.js`, `index.html` y `zona.js` como dice Interfaces**

En `app.js`: `const [nombre0, param] = …; const nombre = nombre0 === 'hoy' ? 'mapa' : nombre0; const cargar = pantallas[nombre] ?? pantallas.mapa;` y guardar `hashAnterior` para la regla del foco. En `index.html` quitar el `<li>` de Hoy. Quitar el icono `i-hoy` de `img/iconos.svg` solo si no lo usa nadie más (`grep`).

- [ ] **Step 4: Ejecutar pruebas y comprobar a mano**

Run: `npm test` y abrir la app en local (`npx serve .` o similar): la app abre en el mapa, el logo lleva al mapa, `#hoy` lleva al mapa, Zona vuelve a «Mapa».
Expected: PASS y comportamiento descrito.

- [ ] **Step 5: Commit**

```bash
git add js/mapa/ruta.js js/app.js index.html js/pantallas/zona.js tests/ruta.test.js img/iconos.svg
git commit -m "Rutas: el mapa es la portada; Zona admite punto en la ruta; barra sin Hoy"
```

---

### Task 4: Buscador como el de Google Maps (zonas, montes y CartoCiudad)

**Files:**
- Create: `js/mapa/geocodificador.js`
- Modify: `js/mapa/controles.js:48-70, 78-110` (`buscarEnMapa` con zonas y montes; `crearBuscador` asíncrono)
- Modify: `js/config.js` (`CONFIG.geocodificador = { nombre: 'CartoCiudad (IGN)', url: 'https://www.cartociudad.es/', licencia: 'CC BY 4.0' }`) y `js/pantallas/ajustes.js:229` (un `li` más, junto al del NGBE: «Lugares del buscador del mapa.»); `tests/mapa.test.js:66-74` comprueba también esos tres textos (el `doesNotMatch(/CARTO/)` sigue valiendo: es sensible a mayúsculas)
- Test: `tests/geocodificador.test.js`, `tests/mapa-controles.test.js`

**Interfaces:**
- Produces (`js/mapa/geocodificador.js`):
  - `URL_CANDIDATOS = 'https://www.cartociudad.es/geocoder/api/geocoder/candidates'`, `URL_FIND = 'https://www.cartociudad.es/geocoder/api/geocoder/find'`, `EXCLUIDOS = ['callejero', 'portal', 'carretera']`, `MINIMO_LETRAS = 3`, `RETARDO_MS = 300`.
  - `candidatosCartoCiudad(texto, { fetchFn, limite = 8, senal } = {})` → `Promise<Array<{ tipo: 'lugar', texto, sub, id, type }>>`. Pide `q`, `limit`, `no_process=callejero,portal,carretera`; `texto` = `address` sin el sufijo repetido del municipio; `sub` = `muni` y `province` («Rascafría, Madrid»); descarta `type` en `EXCLUIDOS` aunque vengan.
  - `coordenadasCartoCiudad({ id, type }, { fetchFn } = {})` → `Promise<{ lat, lon }>`: `find?id=&type=`; usa `lat`/`lng`; si son 0 o nulos, el primer vértice de `geom` (WKT); si no hay nada, lanza `Error('Sin coordenadas')`.
  - `crearGeocodificador({ fetchFn, retardo = RETARDO_MS, minimo = MINIMO_LETRAS } = {})` → `{ sugerir(texto, alLlegar) }`: espera `retardo` ms desde la última llamada, aborta la petición anterior (`AbortController`), cachea por texto normalizado (Map, tope 50) y llama a `alLlegar(lista)` solo si el texto sigue siendo el último pedido.
  - `mezclarResultados(locales, externos, max = 8)` → locales primero, luego externos sin repetir `texto` (sin tildes ni mayúsculas), `max` como mucho.
  - `fueraDeZonas(lat, lon, zonas)` → `true` si no cae en ningún `bbox`; `zonasMasCercanas(lat, lon, zonas, n = 3)` → zonas ordenadas por distancia al centro del bbox.
- `js/mapa/controles.js`:
  - `buscarEnMapa(texto, { pueblos, sitios, especies, chips, zonas = [], puntos = [] })`: además, `{ tipo: 'zona', id, texto: nombreCorto(z), sub: 'Zona' }` y `{ tipo: 'punto', zona: z.id, id: p.id, texto: p.corto, sub: nombreCorto(z), lat, lon }` cuando el texto (sin tildes) está en `corto`, en `nombre` o en `nombreCorto(z)`. Orden: chips, zonas, puntos, sitios, pueblos.
  - `crearBuscador({ buscar, buscarLejos = null, alElegir, alLimpiar = () => {} })`: `buscar` es síncrono (local) y pinta al instante; `buscarLejos(texto, cb)` añade con `mezclarResultados`; cada `<li>` lleva el `sub`. Devuelve además `ponerMigas(lista)` (`[{ texto, href }]`, se pintan como chips antes del campo; el campo se vacía y muestra el placeholder) y `limpiarMigas()`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
// tests/geocodificador.test.js — fetch falso con los JSON reales de la sonda del 21/10/2026 recortados (fixtures en tests/fixtures/cartociudad-*.json)
test('candidatos: pide no_process con calles y portales y devuelve pueblos, topónimos y parajes con texto y sub', async () => {
  const pedidas = [];
  const fetchFn = async (url) => { pedidas.push(url); return { ok: true, json: async () => candidatosRascafria }; };
  const r = await candidatosCartoCiudad('Rascafr', { fetchFn });
  assert.match(pedidas[0], /no_process=callejero%2Cportal%2Ccarretera/);
  assert.ok(r.every((x) => x.tipo === 'lugar' && !['callejero', 'portal', 'carretera'].includes(x.type)));
  assert.deepEqual(r[0], { tipo: 'lugar', texto: 'Rascafría', sub: 'Rascafría, Madrid', id: '1300000303', type: 'poblacion' });
});
test('coordenadas: lat/lng del find; si vienen a 0, el primer vértice de geom', async () => {
  const conLatLng = await coordenadasCartoCiudad({ id: 'ngbe_333552', type: 'ngbe' }, { fetchFn: async () => ({ ok: true, json: async () => ({ lat: 40.85, lng: -3.99 }) }) });
  assert.deepEqual(conLatLng, { lat: 40.85, lon: -3.99 });
  const porGeom = await coordenadasCartoCiudad({ id: 'x', type: 'callejero' }, { fetchFn: async () => ({ ok: true, json: async () => ({ lat: 0, lng: 0, geom: 'MULTILINESTRING((-3.66851 40.38440,-3.66803 40.38413))' }) }) });
  assert.deepEqual(porGeom, { lat: 40.3844, lon: -3.66851 });
});
test('sugerir: espera el retardo, no pide con menos de 3 letras, descarta respuestas de textos viejos y cachea', async () => { /* temporizadores falsos con mock.timers de node:test */ });
test('mezclarResultados: locales primero, sin repetir texto, 8 como mucho', () => { … });
test('fueraDeZonas y zonasMasCercanas', () => {
  const zonas = [{ id: 'a', bbox: [-4, 40, -3, 41] }, { id: 'b', bbox: [-2, 41, -1, 42] }];
  assert.equal(fueraDeZonas(40.5, -3.5, zonas), false);
  assert.equal(fueraDeZonas(37, -6, zonas), true);
  assert.deepEqual(zonasMasCercanas(37, -6, zonas, 1).map((z) => z.id), ['a']);
});
// tests/mapa-controles.test.js (añadir)
test('buscador: encuentra zonas por nombre corto y montes por su corto, antes que sitios y pueblos', () => { … 'vals' → punto Valsaín; 'guada' → zona Guadarrama … });
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `node --test tests/geocodificador.test.js tests/mapa-controles.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `js/mapa/geocodificador.js`, ampliar `buscarEnMapa` y `crearBuscador`, y añadir el crédito**

Guardar las fixtures recortadas (máximo 6 candidatos cada una) en `tests/fixtures/`. El WKT se lee con una expresión regular sobre el primer par `lon lat`.

- [ ] **Step 4: Ejecutar pruebas**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/mapa/geocodificador.js js/mapa/controles.js js/config.js tests/geocodificador.test.js tests/mapa-controles.test.js tests/fixtures
git commit -m "Buscador: zonas, montes y cualquier lugar de España con CartoCiudad"
```

---

### Task 5: Chinchetas de zona y de monte

**Files:**
- Create: `js/mapa/chinchetas.js`
- Modify: `css/componentes.css` (`.chincheta`)
- Test: `tests/chinchetas.test.js`

**Interfaces:**
- Consumes: `calcularZona`, `ordenarZonas`, `notaPuntoDia` (Tarea 2); `nombreCorto`, `puntosRecogibles`, `rotuloPunto` (`js/datos.js`); `nivelDe`, `palabraDe` (`js/ui/semaforo.js`); `ZOOM_MIN_FINA` (`js/rejilla/carga.js`).
- Produces (`js/mapa/chinchetas.js`):
  - `ZOOM_MONTES = ZOOM_MIN_FINA` (9), `ZOOM_ETIQUETAS = 13`.
  - `queChinchetas(zoom)` → `'zonas'` si `zoom < ZOOM_MONTES`, si no `'montes'`.
  - `centroide(zona)` → `{ lat, lon }` media de `puntosRecogibles(zona)` (si no hay, de todos los puntos).
  - `chinchetasZonas(filas)` (filas de `ordenarZonas`) → `[{ tipo: 'zona', id, lat, lon, valor, nivel, texto: nombreCorto(zona), pos (1..n), aria }]`.
  - `chinchetasMontes(zonas, datos, meteo, d, filtro, umbrales)` → `[{ tipo: 'punto', zona, id, lat, lon, valor, nivel, texto: punto.corto, noIr, rotulo, aria }]`.
  - `textoAria(c)` → `'Guadarrama, 82, muy bueno'`; sin nota, `'Cuenca, sin datos'`; NO IR, `'Abantos, NO IR (solo meteo)'`.
  - `crearCapaChinchetas(L, { alTocar })` → `{ capa: L.LayerGroup, poner(lista, seleccionadaId = null), limpiar() }`: `L.marker` con `L.divIcon({ className: '', html: '<button type="button" class="chincheta" data-nivel="…" aria-label="…"><b>82</b><small>Valsaín</small></button>' })`, `iconAnchor` en la punta, `zIndexOffset = valor ?? -1`, pulsar llama `alTocar(c)`; la seleccionada lleva `data-seleccionada="true"`.
- CSS: `.chincheta` con color de fondo `var(--sem)` por `data-nivel` (herencia del semáforo), texto blanco (`--c-sem-X-texto` no: comprobar contraste con `scripts/contraste.mjs` y, si falla, usar el fondo del nivel con texto `--c-texto`), punta con `::after`, mínimo 44 px de alto tocable; `[data-nivel="sin-datos"]` gris con «?».

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
test('queChinchetas: zonas por debajo del zoom 9, montes desde 9', () => {
  assert.equal(queChinchetas(8.9), 'zonas'); assert.equal(queChinchetas(9), 'montes'); assert.equal(queChinchetas(14), 'montes');
});
test('centroide: media de los puntos recogibles; sin recogibles, de todos', () => { … });
test('chinchetasZonas: nota y nivel de la fila, «?» sin datos, orden de la lista', () => {
  const filas = [{ zona: zonaA, res: { valor: 82 } }, { zona: zonaB, res: { valor: null } }];
  const c = chinchetasZonas(filas);
  assert.deepEqual(c.map((x) => [x.pos, x.valor, x.nivel]), [[1, 82, 'muy-bueno'], [2, null, 'sin-datos']]);
  assert.equal(textoAria(c[0]), 'A, 82, muy bueno');
  assert.equal(textoAria(c[1]), 'B, sin datos');
});
test('chinchetasMontes: usa corto, marca NO IR y nunca inventa nota sin serie', () => { … });
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `node --test tests/chinchetas.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `js/mapa/chinchetas.js` y el CSS**

`crearCapaChinchetas` no se prueba con Node (DOM); mantenerla al final del archivo y sin lógica de datos.

- [ ] **Step 4: Ejecutar pruebas y contraste**

Run: `node --test tests/chinchetas.test.js && node scripts/contraste.mjs`
Expected: PASS y 0 fallos.

- [ ] **Step 5: Commit**

```bash
git add js/mapa/chinchetas.js css/componentes.css tests/chinchetas.test.js
git commit -m "Chinchetas de zona y de monte con la nota y el nombre corto"
```

---

### Task 6: Contorno suave de la zona seleccionada

**Files:**
- Create: `js/mapa/contorno.js`
- Test: `tests/contorno.test.js`

**Interfaces:**
- Produces: `contornoZona(bbox, n = 64)` → `Array<[lat, lon]>` de una superelipse (exponente 2.5) inscrita en el bbox `[oeste, sur, este, norte]`, recorrida en sentido horario desde el norte; `ESTILO_CONTORNO = { color: COLOR.acento, weight: 1.5, dashArray: '6 6', fill: false, interactive: false }` (importar `COLOR` de `js/mapa.js`).

- [ ] **Step 1: Escribir la prueba que falla**

```js
test('contornoZona: n puntos dentro del bbox, toca sus cuatro lados y no es un rectángulo', () => {
  const b = [-4, 40, -3, 41];
  const c = contornoZona(b, 64);
  assert.equal(c.length, 64);
  for (const [lat, lon] of c) assert.ok(lat >= 40 && lat <= 41 && lon >= -4 && lon <= -3);
  assert.ok(Math.abs(Math.max(...c.map((p) => p[0])) - 41) < 1e-9);
  assert.ok(Math.abs(Math.min(...c.map((p) => p[1])) + 4) < 1e-9);
  const esquinas = c.filter(([lat, lon]) => (lat === 41 || lat === 40) && (lon === -4 || lon === -3));
  assert.equal(esquinas.length, 0);
});
```

- [ ] **Step 2: Ejecutar y ver que falla** — Run: `node --test tests/contorno.test.js` · Expected: FAIL.

- [ ] **Step 3: Implementar `contornoZona`**

Superelipse: para `t` en `[0, 2π)`, `x = cx + rx·sign(cos t)·|cos t|^(2/e)`, `y = cy + ry·sign(sin t)·|sin t|^(2/e)` con `e = 2.5`.

- [ ] **Step 4: Ejecutar** — Run: `node --test tests/contorno.test.js` · Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/mapa/contorno.js tests/contorno.test.js
git commit -m "Contorno suave y discontinuo de la zona seleccionada"
```

---

### Task 7: Hoja fija con tres estados y modelos por nivel

**Files:**
- Create: `js/mapa/modelos-hoja.js`
- Modify: `js/mapa/hoja.js` (sustituir `abrirHojaMapa` por `crearHojaMapa`; `modeloHoja` de celda pasa a `tipo: 'ladera'`; `estadoTrasArrastre` con `recogida`)
- Modify: `css/componentes.css:933-949` (`.hoja-mapa` nueva, independiente de `.hoja`)
- Modify: `docs/diseno.md:118, 148-149` (componente `.hoja-mapa`)
- Test: `tests/modelos-hoja.test.js`, `tests/mapa-hoja.test.js`

**Interfaces:**
- Consumes: `fraseZona`, `textoFaltan` (Tarea 2); `rutaMapa`, `rutaZona` (Tarea 3); `urlNuevaSalida` (`js/diario.js`, ampliada aquí con `punto`); `textoCoto`, `urlComoLlegar` (`js/mapa/hoja.js`); `comun` (`js/ui/ficha.js`); `nivelDe`, `palabraDe`.
- Produces (`js/mapa/modelos-hoja.js`):
  - `tituloDia(fecha, hoy)` → `'hoy' | 'mañana' | 'el jueves 23'`.
  - `modeloListaZonas({ filas, datos, fecha, hoy, caducado })` → `{ tipo: 'listaZonas', titulo: 'Dónde ir hoy', corto: 'Dónde ir hoy · 12 zonas', aviso: caducado ? 'Con los últimos datos, del <fecha>' : null, filas: [{ id, pos, nombre, valor, nivel, frase: Node[], etiquetas: [{ texto, variante }], href: rutaMapa({ zona: id }) }] }`. Etiquetas = las de `filaZona` de Hoy (Confianza, N especies sin datos, Previsión, Previsión incierta, Estación y modelo no coinciden, rótulo del punto).
  - `modeloZona({ fila, montes, datos, d, fecha, hoy })` → `{ tipo: 'zona', id, titulo: nombreCorto, corto: 'Guadarrama · Muy bueno 82', valor, nivel, frase, etiquetas, detalle: rutaZona(id), montes: [{ id, nombre: corto, valor, nivel, linea, rotulo, href: rutaMapa({ zona, punto }) }] }`; `montes` ya ordenados: con nota de mayor a menor, luego sin datos, luego NO IR; `linea` = `'<especie común> · <coto o proteccion corta>'`.
  - `modeloMonte({ zona, punto, nota, datos, d, coto })` → `{ tipo: 'monte', id, zona: zona.id, titulo: nombre sin paréntesis, corto: 'Pinar de Valsaín · 82', valor, nivel, especie: { nombre, latin } | null, tambien: 'Boletus (61)' | null, porque: '48 mm en 26 días, lo más fuerte hace 3 días · 11 °C de media' | null, dia: d > 0 ? 'Previsión a +d días' : null, coto: textoCoto(coto), avisos: [{ texto, peligro }] (proteccion con RESTRINGIDO/NO IR), acciones: { comoLlegar: urlComoLlegar(lat, lon), diario: urlNuevaSalida({ lat, lon, zona: zona.id, punto: punto.id }), mas: rutaZona(zona.id, punto.id) } }`. Sin nota: `valor: null`, `texto: nota.motivo`.
  - `modeloFueraDeZonas({ nombre, cercanas })` → `{ tipo: 'fuera', titulo: nombre, corto: nombre, texto: 'La app no tiene datos de monte aquí. Las zonas más cercanas:', filas: [...como listaZonas] }`.
- `js/mapa/hoja.js`:
  - `modeloHoja(...)` (celda): igual, pero `tipo: 'ladera'` en vez de `'monte'`, y `acciones.detalle` = `rutaZona(zona.id)`.
  - `estadoTrasArrastre(estado, dy, umbral = 60)`: `recogida` → `resumen` si `dy < -umbral`; `resumen` → `completa` si `dy < -umbral`, `recogida` si `dy > umbral`; `completa` → `resumen` si `dy > umbral`. Nunca `'cerrada'`.
  - `crearHojaMapa({ alElegir, alCambiarDia })` → `{ nodo, poner(modelo, extra = {}, { enfocar = false } = {}), ponerDias(items), estado(), ponerEstado(e) }`. `nodo` es `<section class="hoja-mapa" data-estado="resumen" role="region" aria-labelledby="hoja-mapa-titulo">` con asa (arrastre y clic como hoy), la barra de días (`.chips`), la línea corta (`.hoja-mapa__corto`, visible solo en `recogida`), el título `h2` y el cuerpo. `poner` repinta sin cambiar el estado salvo que `modelo.tipo` cambie de familia (lista ↔ ficha), en cuyo caso vuelve a `resumen`; mueve el foco al título solo con `enfocar: true`. Las filas son `<a href>`; `alElegir` no hace falta (la navegación es por hash). `prohibido` se pinta como hoy, con `data-variante="prohibido"`.
- `js/diario.js`: `urlNuevaSalida({ lat, lon, zona, punto })` añade `punto` a la query; `leerNuevaSalida` lo devuelve (`punto: string|null`).
- CSS `.hoja-mapa`: fija abajo sobre la barra de navegación (`bottom: calc(var(--alto-nav) + var(--esp-2))`), bisel doble como pieza principal, `max-height` por estado: `recogida` ≈ 96 px (asa + días + corto), `resumen` 42dvh, `completa` 88dvh; cuerpo con `overflow-y: auto`; sin animación con `prefers-reduced-motion`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
// tests/modelos-hoja.test.js
test('tituloDia: hoy, mañana y día de la semana con número', () => {
  assert.equal(tituloDia('2026-10-21', '2026-10-21'), 'hoy');
  assert.equal(tituloDia('2026-10-22', '2026-10-21'), 'mañana');
  assert.equal(tituloDia('2026-10-23', '2026-10-21'), 'el viernes 23');
});
test('modeloListaZonas: filas ordenadas con enlace a su zona, nota o sin datos, y aviso con meteo caducada', () => { … assert.equal(m.filas[0].href, '#mapa/guadarrama'); assert.equal(m.corto, 'Dónde ir hoy · 2 zonas'); … });
test('modeloZona: montes con nota primero, luego sin datos, luego NO IR; detalle a #zona/<id>', () => { … });
test('modeloMonte: especie, también, porqué, día de previsión y tres acciones (Más con el punto)', () => {
  assert.equal(m.acciones.mas, '#zona/guadarrama/guadarrama-valsain-pinar');
  assert.equal(m.acciones.diario, '#diario/nueva?lat=40.85300&lon=-3.99430&zona=guadarrama&punto=guadarrama-valsain-pinar');
  assert.equal(m.dia, 'Previsión a +2 días');
});
test('modeloMonte sin nota: valor null y motivo, sin nivel inventado', () => { … });
// tests/mapa-hoja.test.js (actualizar)
test('estadoTrasArrastre: recogida ↔ resumen ↔ completa, nunca cerrada', () => {
  assert.equal(estadoTrasArrastre('recogida', -80), 'resumen');
  assert.equal(estadoTrasArrastre('resumen', 80), 'recogida');
  assert.equal(estadoTrasArrastre('resumen', -80), 'completa');
  assert.equal(estadoTrasArrastre('completa', 80), 'resumen');
  assert.equal(estadoTrasArrastre('recogida', 80), 'recogida');
});
// y `m.tipo === 'ladera'` donde antes era 'monte'
// tests/diario.test.js (añadir): urlNuevaSalida con punto y leerNuevaSalida lo devuelve
```

- [ ] **Step 2: Ejecutar y ver que falla** — Run: `node --test tests/modelos-hoja.test.js tests/mapa-hoja.test.js tests/diario.test.js` · Expected: FAIL.

- [ ] **Step 3: Implementar `modelos-hoja.js`, reescribir `crearHojaMapa` en `hoja.js`, ampliar `urlNuevaSalida`, el CSS y `docs/diseno.md`**

El pintado de cada tipo de modelo va en funciones `pintarListaZonas`, `pintarZona`, `pintarMonte`, `pintarLadera` (el `contenido` actual), `pintarProhibido`, `pintarFuera` dentro de `hoja.js`, todas devolviendo `Node[]`. Las filas de zona reutilizan las clases `.fila-zona*` que ya existen en CSS.

- [ ] **Step 4: Ejecutar pruebas y contraste** — Run: `npm test && node scripts/contraste.mjs` · Expected: PASS, 0 fallos.

- [ ] **Step 5: Commit**

```bash
git add js/mapa/modelos-hoja.js js/mapa/hoja.js js/diario.js css/componentes.css docs/diseno.md tests/modelos-hoja.test.js tests/mapa-hoja.test.js tests/diario.test.js
git commit -m "Hoja fija del mapa con tres estados y modelos por nivel (lista, zona, monte, ladera)"
```

---

### Task 8: La pantalla del mapa por niveles (integración)

**Files:**
- Modify: `js/pantallas/mapa.js` (casi entero: selección por hash, chinchetas, contorno, hoja fija, barra de días en la hoja, buscador con geocodificador y migas, sin modo de puntos)
- Modify: `js/mapa/controles.js` (`fechasBarra`, avisos sin modo de puntos)
- Modify: `js/mapa.js:70-93, 190-215` (quitar `estiloPunto`, `notaPunto`, los rectángulos y el popup de punto de `crearMapa`; `crearMapa` sigue sirviendo al diario con `capas: []`)
- Modify: `css/componentes.css:904-918` (sin `.mapa-completo__abajo` de días; avisos sobre la hoja)
- Test: `tests/mapa-controles.test.js`, `tests/mapa.test.js`

**Interfaces:**
- Consumes: Tareas 2 a 7.
- Produces (`js/mapa/controles.js`):
  - `fechasBarra({ salida, meteo, hoy })` → `string[]`: `diasDisponibles(salida, hoy)` si hay `salida`; si no y hay `meteo?.hoy`, las fechas `meteo.hoy + d` para `d` en `0..7` filtradas `>= hoy`; si no hay nada, `[hoy]`.
  - `avisosMapa({ salida, sinDescompresion, cargando, meteo, otroDia, viejo, diasDesdeHoy, zoom, error, fechaSinIndice = false, fechaSinMeteo = false })`: `AVISO_SIN_INDICE = 'No hay mapa por laderas ahora mismo: se ven las zonas y sus montes con su nota.'`, `AVISO_CARGANDO = 'Cargando el mapa por laderas: mientras, se ven las zonas y sus montes.'`; se elimina `AVISO_GRIS` y `puntosNulos`; nuevos: `fechaSinIndice` → `'El mapa por laderas no tiene este día: solo chinchetas.'`; `fechaSinMeteo` → `'La previsión no llega a este día: chinchetas sin nota.'`; `AVISO_ACERCATE` solo con `salida`.
- `js/pantallas/mapa.js` (comportamiento, sin exportaciones nuevas):
  - Estado: `sel = leerRutaMapa(location.hash)`; `ui = { fecha, chip, vista }` como hoy. `actualizar(estado, param)` relee el hash; si cambió la selección: zona → `fitBounds(limitesZona(z), margenes())`; punto → `setView([p.lat, p.lon], 13)`; nada → sin encuadre (la primera vez, `fitBounds(todas)`).
  - Chinchetas: en `moveend`/`zoomend`, `queChinchetas(zoom)` decide la lista (`chinchetasZonas` sobre `ordenarZonas(datos.zonas.map(calcularZona…))` con `d = desplazamientoDia(ui.fecha, estado.meteo?.hoy)` y `filtro = especies del chip`, o `chinchetasMontes` de las zonas cuyo bbox corta la vista); tocar una → `location.hash = rutaMapa(...)` (con `enfocar` en la hoja tras repintar).
  - Contorno: polígono `contornoZona(z.bbox)` con `ESTILO_CONTORNO` solo para `sel.zona`.
  - Hoja: `crearHojaMapa` montada en `raiz`; contenido según `sel`: nada → `modeloListaZonas`; zona → `modeloZona`; punto → `modeloMonte` con `notaPuntoDia` y el coto por `poligonoEn`; ladera tocada → `modeloHoja` (vuelve a la selección al tocar fuera de una mancha); prohibido → como hoy; sitio buscado fuera → `modeloFueraDeZonas`. Días: `hoja.ponerDias(barraDias(fechasBarra(...), hoy, ui.fecha))`.
  - Migas: `buscador.ponerMigas([{ texto: nombreCorto(z), href: rutaMapa({ zona }) }, { texto: p.corto, href: rutaMapa({ zona, punto }) }])` con un botón «‹» que hace `history.back()` si el historial es nuestro (`history.state?.setas`) y, si no, `location.hash = rutaMapa({ zona: sel.punto ? sel.zona : null })`.
  - Buscador: `buscarLejos` = `crearGeocodificador().sugerir`; elegir `lugar` → `coordenadasCartoCiudad` → chincheta de búsqueda (`L.marker` con `divIcon` `.chincheta.chincheta--busqueda`) y `setView(…, 13)`; si `fueraDeZonas` → hoja `modeloFueraDeZonas` con `zonasMasCercanas(…, 3)`; `zona`/`punto` → su ruta; `chip` → como hoy.
  - Se elimina: `pintarPuntos`, `puntoAbierto`, `estiloPunto`, `notaPunto`, `puntosNulos`, la fila `dias` fuera de la hoja y `encuadre`/`enfocada` antiguos.
  - Carga: montar con chinchetas en cuanto hay `datos` (valor `null` → «?» hasta que llega `meteo`); rejilla e índice después, como hoy.
- `js/mapa.js`: `crearMapa` deja de dibujar rectángulos y popups de zona (la capa `zonas` queda vacía y se quita de `capas` por defecto); se borran `estiloPunto` y `notaPunto` y sus pruebas en `tests/mapa.test.js:29-48, 76-…`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
// tests/mapa-controles.test.js
test('fechasBarra: con índice, sus días desde hoy; sin índice, hoy y 7 días de la meteo; con meteo de ayer, empieza hoy', () => {
  assert.deepEqual(fechasBarra({ salida: { fechas: ['2026-10-20', '2026-10-21', '2026-10-22'] }, meteo: null, hoy: '2026-10-21' }), ['2026-10-21', '2026-10-22']);
  assert.deepEqual(fechasBarra({ salida: null, meteo: { hoy: '2026-10-21' }, hoy: '2026-10-21' }).length, 8);
  assert.deepEqual(fechasBarra({ salida: null, meteo: { hoy: '2026-10-20' }, hoy: '2026-10-21' })[0], '2026-10-21');
  assert.deepEqual(fechasBarra({ salida: null, meteo: null, hoy: '2026-10-21' }), ['2026-10-21']);
});
test('avisos sin índice hablan de zonas y montes, no de puntos; fecha sin índice o sin meteo tienen su aviso', () => { … });
```

- [ ] **Step 2: Ejecutar y ver que falla** — Run: `node --test tests/mapa-controles.test.js` · Expected: FAIL.

- [ ] **Step 3: Implementar `fechasBarra` y los avisos; reescribir `js/pantallas/mapa.js` y podar `js/mapa.js` según Interfaces**

Orden sugerido dentro del paso: (a) quitar modo de puntos y `dias` externa; (b) hoja fija con lista de zonas y barra de días; (c) selección por hash y encuadres; (d) capa de chinchetas y contorno; (e) migas; (f) buscador lejano y «fuera de zonas». Mantener `medirBarras` y `margenes` (la hoja en `resumen` cuenta como `--alto-abajo`).

- [ ] **Step 4: Ejecutar pruebas y recorrido a mano en el móvil o a 390×844**

Run: `npm test`, servir en local y comprobar: abre en el mapa con chinchetas y lista; tocar zona → encuadre, contorno, montes y lista de montes; tocar monte → vista cercana y ficha con Cómo llegar / Diario / Más; «‹» y atrás del móvil vuelven; pellizcar no cambia la ruta; buscar «Rascafría» y «Pinar de Valsaín»; buscar «Sevilla» → aviso fuera de zonas; cambiar de día recalcula chinchetas y lista; con el índice apagado (bloquear `indice/ultimo.json` en las herramientas de red) siguen las chinchetas.
Expected: PASS y recorrido correcto.

- [ ] **Step 5: Commit**

```bash
git add js/pantallas/mapa.js js/mapa/controles.js js/mapa.js css/componentes.css tests/mapa-controles.test.js tests/mapa.test.js
git commit -m "Mapa por niveles: selección por ruta, chinchetas, contorno, hoja fija y buscador de cualquier lugar"
```

---

### Task 9: Etiquetas de las mejores manchas (nivel 3)

**Files:**
- Create: `js/rejilla/etiquetas.js`
- Modify: `js/pantallas/mapa.js` (tras `repintar`, con `zoom >= ZOOM_ETIQUETAS`)
- Modify: `css/componentes.css` (`.etiqueta-mancha`)
- Test: `tests/etiquetas.test.js`

**Interfaces:**
- Consumes: `notas` (`Uint8Array` por archivo que ya devuelve `calcularNotas` en `repintar` de `js/pantallas/mapa.js`; guardarlas en un `Map` con la misma `clave` que `imagenes`, mismo tope `MAX_IMAGENES`), `SIN_COLOR = 255` y `SIN_DATOS = 254` (`js/rejilla/pintor.js`), `notaCelda` (`js/rejilla/nota.js`), `ORIENTACIONES` (`js/rejilla/formato.js`: índices 1, 2 y 8 son N, NE y NO = umbría; 4, 5 y 6 son SE, S y SO = solana).
- Produces (`js/rejilla/etiquetas.js`):
  - `elegirEtiquetas({ notas, ancho, max = 3, minimo = 60, separacion = 12 })` → `[{ k, col, fila, valor }]`: celdas con `valor` entre `minimo` y 100 que son máximo local en su vecindad 3×3, ordenadas de mayor a menor, elegidas con avidez descartando las que estén a menos de `separacion` celdas (distancia de Chebyshev) de una elegida.
  - `textoEtiqueta({ especie, valor, orientacion, altitud })` → `'Níscalos 84 · umbría'`, `'Boletus 66 · solana'`, `'Rebozuelo 62 · 1450 m'` (umbría = N/NE/NO, solana = S/SE/SO; en otro caso la altitud redondeada a 10 m con espacio duro antes de «m», sin separador de miles, como `miles()` en Zona).
- `js/pantallas/mapa.js`: capa `etiquetas` (`L.layerGroup`, pane `puntos`); por cada archivo visible con imagen, `elegirEtiquetas` sobre sus `notas`, `notaCelda` de esas celdas para saber la especie, `L.marker` con `divIcon` `.etiqueta-mancha` (`data-nivel`), `interactive: true` → al tocar, `tocar(latlng)` de la celda; se vacía al cambiar de día, chip o archivo, y por debajo de `ZOOM_ETIQUETAS`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
test('elegirEtiquetas: máximos locales de 60 o más, de mayor a menor, separados y como mucho 3', () => {
  const ancho = 40, notas = new Uint8Array(40 * 40).fill(255);
  const poner = (col, fila, v) => { notas[fila * ancho + col] = v; };
  poner(5, 5, 90); poner(6, 5, 85); poner(30, 30, 70); poner(20, 5, 65); poner(8, 8, 95); poner(35, 2, 50);
  const e = elegirEtiquetas({ notas, ancho, max: 3, minimo: 60, separacion: 12 });
  assert.deepEqual(e.map((x) => [x.col, x.fila, x.valor]), [[8, 8, 95], [30, 30, 70], [20, 5, 65]]);   // 90 y 85 caen por cercanía al 95; 50 por mínimo
});
test('elegirEtiquetas ignora SIN_COLOR y SIN_DATOS', () => { … 254 y 255 nunca salen … });
test('textoEtiqueta: umbría, solana o altitud', () => {
  assert.equal(textoEtiqueta({ especie: 'Níscalos', valor: 84, orientacion: 1, altitud: 1450 }), 'Níscalos 84 · umbría');
  assert.equal(textoEtiqueta({ especie: 'Boletus', valor: 66, orientacion: 5, altitud: 1450 }), 'Boletus 66 · solana');
  assert.equal(textoEtiqueta({ especie: 'Rebozuelo', valor: 62, orientacion: 3, altitud: 1450 }), 'Rebozuelo 62 · 1450 m');
});
```

- [ ] **Step 2: Ejecutar y ver que falla** — Run: `node --test tests/etiquetas.test.js` · Expected: FAIL.

- [ ] **Step 3: Implementar `js/rejilla/etiquetas.js`, la capa en `mapa.js` y el CSS**

- [ ] **Step 4: Ejecutar pruebas y ver las etiquetas en el navegador a zoom 13+** — Run: `npm test` · Expected: PASS; como mucho tres etiquetas por vista, sobre manchas verdes.

- [ ] **Step 5: Commit**

```bash
git add js/rejilla/etiquetas.js js/pantallas/mapa.js css/componentes.css tests/etiquetas.test.js
git commit -m "Etiquetas de las mejores laderas en la vista cercana"
```

---

### Task 10: Limpieza, documentación, capturas y despliegue

**Files:**
- Delete: `js/pantallas/hoy.js`
- Modify: `js/app.js` (quitar `hoy` de `pantallas` y `PINTAN_METEO`), `css/componentes.css` (quitar `.destacada*` y `.portada` solo si no los usa Zona: `grep`), `README.md:7-12`, `docs/diseno.md:109, 180`, `capturas/` (nuevas a 390×844 claro y oscuro: `mapa-niveles-1-zonas.png`, `-2-zona.png`, `-3-monte.png`, `-busqueda-fuera.png`)
- Modify: `docs/superpowers/specs/2026-10-21-mapa-niveles-design.md` (estado: implementado, fecha)

- [ ] **Step 1: Borrar la pantalla Hoy y sus restos; comprobar que nada la importa**

Run: `grep -rn "pantallas/hoy\|#hoy\|i-hoy" js index.html tests docs README.md`
Expected: sin resultados (salvo el redireccionamiento `hoy → mapa` de `app.js` y menciones históricas en `docs/superpowers/specs`).

- [ ] **Step 2: Actualizar README (sección «Mapa» describe los niveles; «Hoy y Zona» pasa a «Zona»), `docs/diseno.md` (barra de 4 secciones; `.hoja-mapa`; recorrido de capturas) y el estado del diseño**

- [ ] **Step 3: Capturas y pase rápido de usabilidad**

Run: el recorrido con Playwright que describe `docs/diseno.md:180` (o `playwright-core` con el Chrome del sistema) a 390×844 en claro y oscuro; guardar en `capturas/`.
Expected: las cuatro capturas nuevas; Toxicología y la franja de seguridad visibles en todas.

- [ ] **Step 4: Comprobación completa y despliegue**

Run: `npm run comprobar && node scripts/contraste.mjs && git push origin main`
Expected: pruebas en verde, «Datos válidos», 0 fallos de contraste, push aceptado por el gancho. Abrir `https://gonzalotsainz-ux.github.io/setas/` en el móvil: abre en el mapa con chinchetas.

- [ ] **Step 5: Commit final (antes del push del paso 4)**

```bash
git add -A
git commit -m "La app gira en torno al mapa: adiós a Hoy, documentación y capturas"
```

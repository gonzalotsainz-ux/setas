# Lluvia ya caída cerca de los montes: fuentes para la app de setas

Fecha de la investigación: 1 de octubre de 2026 (pruebas en vivo entre las 20:45 y las 21:10, hora de Madrid).
Alcance: solo lectura. No se ha tocado ningún repo. Los scripts y datos intermedios están en la carpeta `scratchpad/lluvia/` (junto a este informe).

**Leyenda.** **[EVIDENCIA]** = comprobado hoy con una petición real (curl o Node). **[NO VERIFICADO]** = sale de documentación, de búsquedas o de lo que ya se sabía, sin prueba en vivo.

**Cómo se ha medido la cobertura.** Las estaciones se han comparado con los 35 puntos de muestreo de `data/zonas.json` (unos 3 por zona). Se cuenta una estación si está a menos de 20 km de alguno de esos puntos. Las coordenadas vienen de cada fuente; las de SAIH Tajo y Júcar estaban en UTM 30 y se han convertido. La altitud es la que publica la fuente, salvo en Duero y Júcar, donde se ha sacado del MDT de Open-Meteo (`/v1/elevation`, unos 90 m de resolución). Script: `dist.js`. Resultados: `cobertura.txt`.

---

## 1. Resumen ejecutivo

- **La mayor mejora está en los SAIH de las confederaciones** (Duero, Tajo, Júcar y Ebro). Tienen pluviómetros en cabeceras de montaña entre 1.100 y 1.950 m, datos cada 5–15 minutos y solo unos minutos de retraso. Los cuatro han respondido hoy, sin clave. Juntos cubren 10 de las 11 zonas; solo Montes de Toledo queda floja.
- **Euskalmet (Open Data Euskadi)** es la mejor fuente para Álava: 37 estaciones a menos de 20 km, de las que 28 midieron lluvia en agosto. La licencia es CC BY 4.0. Hay un histórico mensual descargable sin clave (con 2–6 semanas de retraso) y una API en tiempo real que exige un JWT.
- **AEMET OpenData tiene un endpoint horario** (`/observacion/convencional/…`) para las mismas estaciones que ya usamos, con un retraso de aproximadamente 1 hora en lugar de unos 3 días. Pero solo guarda **las últimas 12 horas**, así que hay que leerlo de forma periódica y guardar lo leído. Reaprovecha la clave que ya está en el secret: es la mejora con menos riesgo.
- **Lo que no sirve o no conviene:**
  - Red de calidad del aire de la Comunidad de Madrid: la lluvia sale **siempre 0** en todo 2026. [EVIDENCIA]
  - SAIH Guadiana: caído hoy, con el certificado caducado el 28/09/2026. [EVIDENCIA]
  - ERA5-Land en Open-Meteo: devuelve `null` en agosto y septiembre. [EVIDENCIA]
  - El radar de AEMET solo publica imágenes. [EVIDENCIA, según la especificación]
  - Meteoclimatic: licencia NC-ND, solo da la lluvia del día y no tiene histórico. [EVIDENCIA]
  - Redes agrícolas (InfoRiego, REDAREX, SIAR): estaciones en zonas de regadío del valle, no en el monte.
- **Contraste rápido de agosto y septiembre** (sección 4): los modelos se equivocan mucho en algunos puntos. Ejemplos: La Cierva (Cuenca), 68 mm medidos frente a 10–25 mm de los modelos; Beluntza (Álava), 17 mm medidos frente a 52 mm de ECMWF. Esto justifica el esfuerzo.
- **Hace falta control de calidad.** Quintanar de la Sierra (SAIH Duero, PL031) marca 551 mm el 27/08 y 187 mm el 30/09, que son picos falsos. [EVIDENCIA]

---

## 2. Tabla resumen por fuente

Cobertura: número de estaciones a menos de 20 km de los puntos de cada zona.
Abreviaturas de zona: Gua = Guadarrama, SN = Sierra Norte-Ayllón, So = Soria, Bu = Burgos, Me = Merindades, Gr = Gredos-Tiétar, Cu = Serranía de Cuenca, Gu = Guadalajara, To = Montes de Toledo, Ál = Álava, Ex = Extremadura.

| Fuente | Cobertura (a < 20 km) | Variable y paso | Retraso | Histórico ya disponible | Acceso | CORS | Licencia | Estado hoy |
|---|---|---|---|---|---|---|---|---|
| **SAIH Duero** | Gua 6 · SN 3 · So 11 · Bu 13 · Gr 2 · Ex 4 | Lluvia horaria (y la última hora) | Unos 5–10 min | **Unos 90 días horarios** por estación (desde el 02/07) | Página HTML con los datos en JS; sin clave | No | Información del sector público. Atribución: «SAIH Duero – CHD» [NO VERIFICADO: sin aviso legal propio] | [EVIDENCIA] |
| **SAIH Tajo** | Gua 8 · SN 10 · Gr 14 · Gu 4 · To 2 · Ex 16 | Lluvia de la última hora, publicada cada 15 min | Unos 15 min | **Solo 10 días** sin registrarse | JSON con URLs cifradas que se leen en dos pasos; sin clave | No | Idem (CHT) | [EVIDENCIA] |
| **SAIH Júcar** | Cu 8 | Lluvia de 1, 4, 12 y 24 h, y acumulado por intervalo de fechas | Unos 10 min | **Sí**: la consulta por intervalo da el acumulado desde el 01/08 | JSON sin clave | **Sí (`*`)** | Idem (CHJ). Datos provisionales, según su aviso | [EVIDENCIA] |
| **SAIH Ebro** | Bu 8 · Me 4 · So 1 · Gu 1 · Ál 11 | Última hora, hoy, 24 h, ayer y año (tabla). Cada 15 min con la API oficial | Unos 15 min | Con la API oficial (requiere registro). La tabla pública no tiene serie | Tabla JSON pública, pero `robots.txt` prohíbe `/api/`. API oficial `/datos/apiopendata?…&apikey=` | **Sí (`*`)** | Idem (CHE) | [EVIDENCIA] tabla. [NO VERIFICADO] API con clave. **Problema de TLS** (ver 3.4) |
| SAIH Guadiana | (To sur, Villuercas sur, San Pedro, Tentudía) | — | — | — | — | — | — | **Caído** (certificado caducado el 28/09/2026 y página «Invalid Connection») [EVIDENCIA] |
| SAI Cantábrico | (Me: Valle de Mena) | Lluvia de 1, 12 y 24 h; históricos en CSV desde un formulario | — | Formulario «Descarga de históricos» | WordPress con AJAX; no se ha llegado a sacar un JSON | — | Idem (CHC) | Parcial [EVIDENCIA web] / [NO VERIFICADO datos] |
| **Euskalmet / Open Data Euskadi** | Ál 37 (28 con lluvia) · Me 3 | Lecturas cada 10 min | API: tiempo real [NO VERIFICADO, pide JWT]. Zip anual: con hasta 31/08, publicado el 16/09 | **Sí**: zip anual 2026 (100 MB, de enero a agosto) | Zip y JSON sin clave. La API pide un JWT RS256 | **Sí (`*`)** | **CC BY 4.0** | [EVIDENCIA] zip y lista. [NO VERIFICADO] API |
| **AEMET convencional (horaria)** | Las 23 de la lista blanca y cualquier otra automática | Lluvia horaria (`prec`), sin validar | Unos 1 h | **Solo las últimas 12 h** | Igual que ahora (clave y dos pasos) | No (ya va por la Edge) | AEMET (citar la fuente) | [EVIDENCIA] en la especificación oficial. [NO VERIFICADO] la llamada (no hay clave en local) |
| AEMET diarios (los actuales) | 23 | Lluvia diaria validada | Unos 3 días | Sí | Ya integrado | — | AEMET | Ya en uso |
| AEMET radar | — | **Solo imagen** (`/red/radar/nacional` y `/regional/{radar}`) | 10–30 min | No | — | — | — | [EVIDENCIA] en la especificación |
| **OPERA (EUMETNET, MeteoGate)** | Toda la Península, rejilla de 2 km | `ACRR:comp`, acumulado horario (PT1H) | Unos 15–60 min | API: ventana móvil de 24 h. Archivo en S3 [NO VERIFICADO] | API OGC EDR. Ficheros ODIM HDF5 o **GeoTIFF**; sin clave. Límite de 200 peticiones/h | **Sí (`*`)** | **CC BY 4.0** | [EVIDENCIA] lista de ficheros |
| ERA5 (Open-Meteo) | Rejilla de 0,25° | Diaria | **Unos 5 días** | Sí | API Open-Meteo | Sí | CC BY 4.0 | [EVIDENCIA] (faltan los últimos 5 días) |
| ERA5-Land y CERRA (Open-Meteo) | 0,1° y 5,5 km | Diaria | — | **null en agosto y septiembre** | — | — | — | [EVIDENCIA] (no sirven ahora) |
| IMERG (NASA GPM) | 0,1° (unos 11 km) | 30 min | Early unas 4 h, Late unas 14 h, Final unos 3,5 meses | Sí | Cuenta de Earthdata y descarga HDF5/GeoTIFF | — | Abierta (NASA) | [NO VERIFICADO]. Subestima en montaña |
| Comunidad de Madrid (red de calidad del aire) | 28 estaciones con la magnitud 89 (lluvia), casi todas urbanas | Horaria | Diaria | Sí | CSV/JSON | Sí (`*`) | Abierta | **La lluvia vale 0 en todo 2026** [EVIDENCIA] → descartar |
| Meteoclimatic | Unas 11 en Segovia, por ejemplo Ayllón | Solo el acumulado de hoy | Unos 15 min | No | Feed XML | — | **CC BY-NC-ND 3.0** | [EVIDENCIA]. Aficionados y sin control de calidad |
| InfoRiego (ITACyL) | Zonas regables de CyL [NO VERIFICADO] | Horaria y diaria | 1 día | Sí | API con APIKEY de desarrollador del ITACyL | — | — | [EVIDENCIA] de que pide clave |
| SIAR (MAPA) / REDAREX | Zonas regables de 12 comunidades (incluye CLM, Extremadura y Madrid) | Horaria y diaria | 1 día | Sí | API con clave de 50 caracteres [NO VERIFICADO] | — | — | Estaciones en valles: poco útiles para setas |

**Cobertura combinada de las fuentes viables** (SAIH Duero, Tajo, Júcar y Ebro, más Euskalmet):

| Zona | Estaciones a < 20 km | Ejemplos de montaña (altitud, distancia al punto) |
|---|---|---|
| Guadarrama | 14 | Albergue de La Lobera, Rascafría (Tajo PN24) 1.372 m, 6 km · Olla del Quiñón, Bustarviejo (Tajo P_26) 1.279 m, 3 km · Sotosalbos (Duero PL532) unos 1.139 m, 5 km · Valsaín (Duero EA525) unos 1.122 m, 5 km |
| Sierra Norte-Ayllón | 13 | Riaza (Duero PL512) unos 1.401 m, 1 km · Robregordo (Tajo PN22) 1.428 m, 12 km · El Muyo (Duero PL511) unos 1.242 m, 10 km |
| Soria | 12 | Covaleda (Duero PL002) unos 1.450 m, 4 km · Neila (Ebro P118) 1.230 m, 19 km |
| Burgos (Demanda y Pinares) | 21 | Cabecera del Gatón (Ebro P116) 1.944 m, 5 km · Alarcia (Duero PL041) unos 1.478 m, 10 km · Quintanar de la Sierra (Duero PL031) unos 1.343 m (**defectuoso**, ver 3.1) |
| Merindades | 7 | Brazuelo (Ebro P054) 1.074 m, 8 km · Lunada (Ebro P074) 1.150 m, 13 km · Cerroja (Euskalmet C065) 677 m, 11 km |
| Gredos-Tiétar | 16 | Puerto del Pico (Tajo PN34) 1.490 m, 2 km · Barajas (Duero PL573) unos 1.611 m, 11 km · El Navajo, Villarejo del Valle (Tajo P_42) 1.145 m, 4 km |
| Serranía de Cuenca | 8 | Cuerda, Boniches (Júcar 5N02) unos 1.320 m, 3 km · La Cierva (Júcar 4N05) unos 1.236 m, 13 km |
| Guadalajara | 5 | Valsalobre-Peñalén (Tajo P_06) 1.380 m, 6 km · Fuente de Hocinillo, Checa (Tajo PN02) 1.396 m, 19 km · Cubillejo del Sitio (Ebro P021) 1.180 m, 17 km |
| Montes de Toledo | 2 | San Pablo de los Montes (Tajo P_32) 911 m, 6 km · El Torcón (Tajo E_28) 701 m, 9 km |
| Álava | 37 Euskalmet + 11 Ebro | Roitegi (C021) 980 m, 1 km · Iturrieta (C024) 987 m, 4 km · Beluntza (C025) 687 m, 2 km · San Vicente de Arana (Ebro P009) 800 m, 3 km |
| Extremadura | 20 (todas en el norte) | Cabezuela del Valle (Tajo PN51) 1.350 m, 4 km · Navafrías (Duero PL602) unos 974 m, 4 km · Calvario-Baños de Montemayor (Tajo P_52) 807 m, 8 km |

Lo que queda sin cubrir: Montes de Toledo (solo 2 estaciones), el sur de Extremadura (Villuercas sur, San Pedro, Tentudía), que depende del SAIH Guadiana, ahora caído, y el Valle de Mena (Cantábrico).
Ojo: en el SAIH, los códigos **EA** (aforo) y **EM** (embalse) suelen estar en el fondo del valle o junto a la presa. Los de montaña son los **PL**, **P_**, **PN** y **P0xx**.

---

## 3. Detalle por fuente, con peticiones reales

### 3.1 SAIH Duero (CHD) [EVIDENCIA]

- **Tiempo real.** `GET https://www.saihduero.es/datos-tiempo-real/risr` devuelve 177 KB de HTML con el array JS `datosPL` embebido: **221 estaciones** (71 PL pluviométricas, 133 EA de aforo y 17 EM de embalse). Cada una lleva latitud, longitud, hora, temperatura y la lluvia de la última hora.
  Ejemplo de respuesta: `{ id: 'PL551', station: 'Pradosegar, PL-62', lat: 40.54127060, lng: -5.07625169, date: '01 oct', time: '20:25', p: '0,0 l/m2 en 1h', status: 'normal' }`. Hay 9 estaciones con `n/d`.
- **Ficha de una estación.** `GET https://www.saihduero.es/risr/PL551` da la lluvia de hoy, ayer, el mes actual y el año hidrológico, y enlaza a la página de histórico, que lleva un token por sensor (por ejemplo `risr/PL551/historico/xADTQNURfFTN1wEU`).
- **Histórico.** `GET https://www.saihduero.es/risr/EA525/historico/xADTQNURfVjM1EUR` devuelve el HTML de una gráfica amCharts con 2.153 valores **horarios** del tipo `{d:"02/07/2026 11:00", v:0.0}`, desde el 02/07/2026 hasta las 23:00 del 30/09.
  - El token no se adivina: hay que sacarlo de la ficha (dos peticiones por estación).
  - Totales de agosto y septiembre de varias estaciones (script `duero_hist.mjs`): Valsaín 14,0 / 4,2 mm · Sotosalbos 22,7 / 6,4 · Covaleda 28,0 / 13,2 · Riaza 24,4 / 9,8 · Barajas (Gredos) 13,1 / 6,3 · Navafrías 60,0 / 7,7.
- **Control de calidad.** La red no filtra los datos. PL031 (Quintanar de la Sierra) marca 550,8 mm el 27/08, 145,9 mm el 28/08 y 186,6 mm el 30/09: son picos falsos, seguramente por mantenimiento o vaciado del pluviómetro. Además, hay muchos 0,1 mm sueltos (ruido de la báscula basculante).
- **Acceso.** HTML sin clave ni CORS: hay que leerlo desde el servidor. El `robots.txt` solo prohíbe `/css/`, `/js/` y `/scss/`. El TLS es válido en Node.

### 3.2 SAIH Tajo (CHT) [EVIDENCIA]

- **Tabla de lluvia.** Primero se pide `index.php?w=get-wrapperentorno&x=…`, que devuelve `urlmenu`. El menú (`w=get-menu&x=…`) da la URL de `w=get-pluviometria&x=osLFYnftvll2pF2Gxrqiz1XUSSMAueDK%2B0MeRJHcSlHZ%2B8Ij7xHxQRff7I%2BtsEdaW2ZPJW0yVoN44wQSfbmuwQ%3D%3D`.
  Esa URL devuelve un JSON de 2 MB con **182 estaciones**: 43 pluviómetros, 18 pluvionivómetros, 44 embalses, 46 aforos en río y otras. Cada una lleva UTM x/y/**z (altitud)**, municipio, provincia y `value` (lluvia de la última hora).
  Ejemplo: `{"idestacion":"AC01","fecha":"01/10/2026 20:45","value":0.2,"estacion":{"nombre":"TRASVASE ENTREPEÑAS-BUENDÍA","utm":{"x":"523080.9","y":"4481190.0","z":"731.0","huso":30},"provincia":"Guadalajara"}}`.
- **Serie de una estación.** La URL `w=get-estacion&x=…` viene en cada registro y da las últimas 24 h horarias. Desde ahí, `get-estacion-grafico-grande` (`url10dias`) da **10 días con un registro cada 15 minutos**, por ejemplo para P_26 (Bustarviejo): 964 valores, del 21/09 a las 20:00 al 01/10 a las 20:45. Hay enlaces `urlexportarjson` y `urlexportarexcel`.
- **Cuidado al sumar.** La señal es «PRECIPITACIÓN ÚLTIMA HORA» y se publica cada 15 minutos, así que los valores se solapan. Sumando todos salen 6,4 mm; sumando solo los de las horas en punto (:00), que es lo correcto, salen 1,6 mm.
- **Limitaciones.** Sin registrarse no hay histórico de más de 10 días: rellenar desde el 1 de agosto no es posible y hay que empezar a guardar ya. Las URLs van cifradas: hay que seguir la cadena desde el menú y no fijarlas en el código, porque pueden rotar [NO VERIFICADO]. Usa cookies de sesión. Sin CORS.

### 3.3 SAIH Júcar (CHJ) [EVIDENCIA]: la más cómoda

- **Tiempo real.** `GET https://saih.chj.es/mapa-lluvias` devuelve HTML con un JSON embebido de 182 estaciones: `{"fldTNombre":"ABDET","fldTCodigo":"8P06","fldNCoordGPSLat":738519.99,"fldNCoordGPSLon":4286486.02,"lluvia_1h":0,"lluvia_4h":0,"lluvia_12h":0,"lluvia_24h":0,"fecha_24h":"2026-10-01T18:50:00.000Z"}`.
  Ojo: los campos se llaman «Lat» y «Lon», pero contienen UTM 30 X e Y.
- **Por intervalo.** `GET https://saih.chj.es/lluviasIntervalo/2026-08-01/2026-09-01` devuelve un JSON con `Access-Control-Allow-Origin: *`, un registro por estación con `lluvia_int` y `valores` (el número de días con dato).
  - Agosto: Cuerda (5N02) 9,4 mm (32 valores) · Pajaroncillo 9,2 · La Cierva 4,8.
  - Septiembre (`/2026-09-01/2026-10-01`): 24,4 · 31,6 · 68,2 mm.
  - Pidiendo un día cada vez se rellena la serie diaria desde el 1 de agosto.
- **Detalle.** `/chart-lluvia/{idEstacionRemota}` (enlace del mapa; no se ha probado).
- **Aviso legal.** El propio portal dice que son «datos provisionales… sin filtrarlos ni depurarlos».

### 3.4 SAIH Ebro (CHE) [EVIDENCIA en parte]

- **Tabla pública.** `GET https://www.saihebro.com/api/pluviometrias/getTablaPluviometrias` devuelve 99 KB de JSON con CORS `*` y **331 estaciones**: `{"codigo":"P067",…,"col1":últimaHora,"col2":hoy,"col3":24h,"col4":ayer,"col5":mes,"col6":año}`. El valor -1 significa que no hay dato.
- **Coordenadas.** `GET /api/ficha/procesarTablaInfoGeneral?estacion=A001` devuelve HTML con `data-lat='42.687655' data-lng='-2.955527'` y la UTM con Z. Se han leído las 81 estaciones de Burgos, Álava, Soria, La Rioja, Cantabria y Guadalajara (script `ebro_coords.mjs`).
- **API oficial.** El JS del portal documenta `https://www.saihebro.com/datos/apiopendata?senal={tag}&inicio={dd/mm/aaaa}&apikey={apikey}`, y también `tipo_senal=`. El árbol de señales (`/api/opendata/getListaSenalesArbol`) lista **337 señales `PA24H`, 334 `PACUM` (acumulado del día) y 338 `PQUIN` (cada 15 minutos)**, con nombres como `P067…PACUM`.
  Sin clave contesta: «El parámetro apikey no es de tipo cadena…». La sección `/datos/historicos` redirige a `/usuarios/login`: **hace falta registrarse**.
- **Riesgos.**
  1. `robots.txt` contiene `Disallow: /api/`. Leer la tabla pública de forma automática va contra esa indicación; lo correcto es registrarse y usar `apiopendata`.
  2. **El servidor TLS no envía el certificado intermedio de la FNMT.** Node `fetch` falla con `UNABLE_TO_VERIFY_LEAF_SIGNATURE` y openssl da «verify return code 21». Deno/Supabase seguramente falle igual. Solución: `Deno.createHttpClient({ caCerts: [intermedio FNMT] })` [NO VERIFICADO que funcione en Supabase Edge]. Los navegadores sí suelen completar la cadena.

### 3.5 SAIH Guadiana y SAI Cantábrico

- **Guadiana.** `https://www.saihguadiana.com/` tiene el certificado `*.saihguadiana.com` caducado (notAfter = 28 de septiembre de 2026, 23:59:59 GMT) y con `-k` devuelve una página «Invalid Connection» (cortafuegos). Hoy no se puede usar [EVIDENCIA]. Volver a probar más adelante: cubriría Montes de Toledo sur, Villuercas sur, San Pedro y Tentudía.
- **Cantábrico.** `https://visor.saichcantabrico.es/` es un WordPress con capas «pluvio-1h, 12h, 24h», un informe de «Pluviometría diario» y un formulario de «Descarga de históricos» en CSV [EVIDENCIA web]. No se ha extraído ningún dato legible por programa [NO VERIFICADO]. Solo aportaría el Valle de Mena.

### 3.6 Euskalmet / Open Data Euskadi [EVIDENCIA]

- **Lista de estaciones.** `GET https://opendata.euskadi.eus/contenidos/ds_meteorologicos/estaciones_meteorologicas/opendata/estaciones.json` devuelve **153 estaciones** con coordenadas WGS84 y enlaces `XMLdatos`.
  El `XMLdatos` de cada una (con CORS `*`) da la altitud. Ejemplo: `<stationData stationID='C025'><altitude>687</altitude><stationName>Beluntza</stationName>…`.
- **Histórico.** `GET https://opendata.euskadi.eus/contenidos/ds_meteorologicos/met_stations_ds_2026/opendata/2026.zip` pesa 100.581.676 bytes, tiene `Last-Modified: 16/09/2026` y CORS `*`. Dentro hay un zip por estación con un XML por mes, **de enero a agosto**, y lecturas cada 10 minutos (`<Precip.._a_140cm>`).
  - Totales de agosto: Beluntza 17,4 mm · Altube 16,0 · Iturrieta 3,8.
  - De las 37 estaciones a menos de 20 km de Álava, 28 tienen lluvia (el resto son de calidad o aforo).
  - Licencia CC BY 4.0, según la ficha del catálogo.
- **API en tiempo real.** `GET https://api.euskadi.eus/euskalmet/stations` sin token contesta `403 {"code":"NULL_JWT_BEARER"}` con CORS `*`.
  Según la documentación oficial, el JWT se firma con **RS256 usando la clave privada del usuario**, con los claims `aud: "met01.apikey"`, `iss`, `exp`, `iat`, `version: "1.0.0"` y `email`, y se envía en `Authorization: Bearer …`. Las claves se gestionan en `https://api.euskadi.eus/opendata-apikey/`.
  Como la clave privada no puede ir en el navegador, el token hay que generarlo en el servidor (Edge Function). [NO VERIFICADO: rutas de lecturas y límites]

### 3.7 AEMET

- **Especificación oficial.** Descargada de `https://opendata.aemet.es/AEMET_OpenData_specification.json` [EVIDENCIA]:
  - `/api/observacion/convencional/datos/estacion/{idema}`: «Datos de observación horarios de las **últimas 12 horas**… Frecuencia de actualización: continuamente».
  - `/api/observacion/convencional/todas`: lo mismo para todas las estaciones. Útil para hacer una sola llamada y filtrar por la lista blanca.
  - Son datos horarios **sin validar**, con el campo `prec`, de las mismas estaciones automáticas.
  - **Consecuencia:** para eliminar los unos 3 días de retraso hay que leerlo **cada 3–6 h** y guardarlo. Con el pg_cron actual de 07:00 y 19:00 quedaría justo en el límite de las 12 h, sin margen de error.
- **Radar.** `/api/red/radar/nacional` (cada 30 min) y `/api/red/radar/regional/{radar}` (cada 10 min) son **solo imágenes**. No hay acumulado numérico. Los radares españoles sí llegan a OPERA (ver 3.8).
- **Sin probar.** La llamada real con clave (no hay clave en local; está en el secret de Supabase). La rejilla diaria de lluvia de AEMET no es un producto operativo en OpenData [NO VERIFICADO].

### 3.8 OPERA (EUMETNET) vía MeteoGate [EVIDENCIA]

- **Colección.** `GET https://api.meteogate.eu/eu-eumetnet-weather-radar/collections?f=json` devuelve la colección `observations`, con licencia CC BY 4.0, una ventana temporal **móvil de 24 h** (del 30/09 a las 19:05 al 01/10 a las 19:05) y los parámetros `ACRR`, `RATE`, `DBZH`…
- **Radares.** `…/locations` incluye los radares españoles: Valladolid, Torrejón-Velasco, Sierra Fuentes, San Sebastián, Perdiguera…
- **Acumulado horario.** `GET …/collections/observations/items?platform=0-20010-0-OPERA&parameter-name=ACRR:comp&datetime=2026-10-01T17:00:00Z/2026-10-01T19:00:00Z` devuelve 2 ficheros `ACRR:comp` con `period: PT1H` y `xscale: 2000` (2 km, proyección LAEA), descargables en `format=ODIM` o **`format=GeoTIFF`**. Límite de 200 peticiones por hora.
- **Limitaciones.** La consulta `position` en un punto de Valsaín devolvió 204, sin contenido.
  - Para usarlo hay que descargar un GeoTIFF por hora de unos MB y recortarlo.
  - En el interior de la Península el radar tiene problemas conocidos: bloqueo del haz en Guadarrama y Gredos, subestimación de la lluvia estratiforme lejos del radar y brillo de la capa de fusión. Sin ajustar con pluviómetros es menos fiable que una estación cercana.
  - Su valor está en **rellenar los huecos** entre estaciones, sobre todo en Montes de Toledo y el sur de Extremadura, y en confirmar si llovió o no. [NO VERIFICADO calidad]

### 3.9 Rejillas: ERA5, ERA5-Land, CERRA, IMERG

- **Open-Meteo archive** en Valsaín, del 01/08 al 30/09 [EVIDENCIA]:
  - `era5_land`: 61 de 61 días en `null`.
  - `cerra`: 61 de 61 días en `null`.
  - `era5`: 14,2 mm, con los últimos 5 días en `null`. Retraso de unos 5 días y rejilla de 0,25° (unos 25 km).
  - **Ninguna sirve para lluvia reciente cerca del monte.**
- **IMERG** (NASA): la versión Early sale en unas 4 h y la Late en unas 14 h, a 0,1°. Pide cuenta de Earthdata. Se sabe que subestima la lluvia orográfica y la de poca intensidad en la Península. [NO VERIFICADO]

### 3.10 Otras

- **Comunidad de Madrid, red de calidad del aire** [EVIDENCIA].
  - El CSV del mes en curso (`calidad_aire_datos_meteo_mes.csv`, `Last-Modified 01/10/2026`, CORS `*`) y el de 2026 tienen 28 estaciones con magnitud 89 (lluvia), pero **todas suman 0,0 mm en cada mes de enero a septiembre de 2026**.
  - Hay una nota oficial de «corrección de datos de pluviometría» que solo habla de 2020.
  - Además, las estaciones están en pueblos y ciudades. Descartada.
- **Meteoclimatic** [EVIDENCIA]. `GET https://www.meteoclimatic.net/feed/xml/ESCYL40` devuelve XML con 11 estaciones (por ejemplo Ayllón y Los Ángeles de San Rafael) y `<rain><total>0.0</total></rain>`, que es solo el acumulado del día.
  - El feed no lleva coordenadas, no hay histórico y la licencia es **CC BY-NC-ND 3.0**.
  - Son aficionados con calidad variable (el campo `QOS` va de 0 a 5).
  - Como mucho valdría para confirmar a mano si llovió; no para el índice.
- **InfoRiego** [EVIDENCIA de la página]: «El acceso… requiere la obtención de un APIKEY de desarrollador». Sus estaciones están en zonas regables, así que es poco útil.
- **SIAR (MAPA), que incluye REDAREX e InfoRiego**: API `https://servicio.mapama.gob.es/apisiar/API/v1/datos…` con clave de 50 caracteres [NO VERIFICADO: las rutas probadas daban 404]. Más de 460 estaciones, también en regadíos.
- **Castilla-La Mancha**: no se ha encontrado una red autonómica de montaña aparte de SIAR [NO VERIFICADO]. Para Cuenca y Guadalajara las fuentes son los SAIH Júcar y Tajo.

---

## 4. Contraste: lluvia medida frente a los modelos (agosto / septiembre de 2026, mm)

Modelos sacados de `historical-forecast-api.open-meteo.com` (sumas diarias en el punto de la estación). Script: `comparar.mjs`. Salida: `comparacion.txt`. [EVIDENCIA]

| Estación | Medido (ago / sep) | ECMWF IFS 0,25° | ICON | GFS |
|---|---|---|---|---|
| Valsaín (Duero EA525) | 14,0 / 4,2 | 19 / 10 | 4 / 4 | 16 / 10 |
| Sotosalbos (Duero PL532) | 22,7 / 6,4 | 19 / 10 | 4 / 6 | 28 / 4 |
| Covaleda (Duero PL002) | 28,0 / 13,2 | 35 / 17 | 9 / 9 | 32 / 9 |
| Riaza (Duero PL512) | 24,4 / 9,8 | 31 / 10 | 7 / 19 | 10 / 22 |
| Barajas, Gredos (Duero PL573) | 13,1 / 6,3 | 42 / 14 | 5 / 3 | 10 / 4 |
| Navafrías, Gata (Duero PL602) | 60,0 / 7,7 | 64 / 33 | 45 / 32 | 26 / 13 |
| Cuerda (Júcar 5N02) | 9,4 / 24,4 | 13 / 25 | 4 / 12 | 11 / 20 |
| Pajaroncillo (Júcar 5A01) | 9,2 / 31,6 | 13 / 25 | 4 / 9 | 11 / 17 |
| La Cierva (Júcar 4N05) | 4,8 / **68,2** | 13 / 25 | 3 / 10 | 9 / 19 |
| Beluntza (Euskalmet C025) | **17,4** / — | 52 / 45 | 4 / 8 | 26 / 17 |
| Altube (Euskalmet C035) | 16,0 / — | 46 / 41 | 4 / 8 | 26 / 12 |
| Iturrieta (Euskalmet C024) | 3,8 / — | 24 / 12 | 6 / 15 | 26 / 10 |

Qué se ve:
- Los errores de los modelos llegan con frecuencia a un factor de 2 o 3, y cambian de signo según el modelo y el sitio. ECMWF exagera en Álava y en Gredos; ICON se queda corto casi siempre.
- La tormenta de septiembre en La Cierva (68 mm) no la recoge ningún modelo. Para la fructificación, ese es justo el dato que importa.
- Salvedad: un pluviómetro mide un punto, y la lluvia de tormenta varía mucho en pocos kilómetros. Por eso conviene combinar varias estaciones y aplicar control de calidad.

---

## 5. Recomendación

### Las 2 o 3 fuentes con más mejora y menos riesgo

1. **SAIH Duero + SAIH Tajo + SAIH Júcar (el bloque de los SAIH).**
   - Cubren 9 de las 11 zonas con pluviómetros de cabecera (1.100–1.600 m), con unos minutos de retraso y sin clave.
   - Duero permite rellenar unos 90 días hacia atrás (desde el 1 de agosto) y Júcar cualquier intervalo. Tajo solo 10 días: **empezar a guardarlo ya**.
   - Riesgo: es lectura de páginas no documentadas (formato HTML/JS en Duero, URLs cifradas en Tajo) que puede cambiar. Se mitiga con un analizador defensivo, alertas cuando falle y el modelo como respaldo.
2. **Euskalmet (Álava y norte de Merindades).**
   - CC BY 4.0, 28 pluviómetros en Álava.
   - Ya: zip anual para el relleno (agosto).
   - Después: pedir una clave de la API (gratis, con registro) para el tiempo real, generando el JWT RS256 en la Edge Function.
   - Mientras no haya clave, el SAIH Ebro (11 estaciones en Álava y 4 en Merindades) puede cubrir el día a día, pero tiene el problema del certificado TLS y el `robots.txt`. Lo ideal es registrarse en `apiopendata`.
3. **AEMET convencional horaria.**
   - Mismas 23 estaciones, mismo secret y mismo intermediario. Solo cambia la ruta y la frecuencia.
   - Quita el retraso de unos 3 días con un riesgo casi nulo.
   - Las mismas filas se pueden sustituir después por las diarias validadas cuando lleguen.

Para más adelante, opcional: **OPERA `ACRR` en GeoTIFF** (CC BY 4.0, con CORS) para rellenar huecos (Montes de Toledo, sur de Extremadura) y como indicador de «¿ha llovido o no?» entre estaciones.

### Arquitectura recomendada

- **Nueva Edge Function `pluvio`.** No conviene mezclarla con `aemet` (que es un intermediario bajo demanda con caché) ni con `rejilla` (que hace el cálculo pesado del índice). Se lanza con **pg_cron cada hora**, o como mínimo cada 3 h:
  1. Lee las tablas en tiempo real: Duero `risr`, Tajo `get-pluviometria`, Júcar `mapa-lluvias` o `lluviasIntervalo` del día, Ebro con clave (o vía navegador si no hay solución para el TLS) y AEMET `convencional/todas` filtrado por la lista blanca.
  2. Se limita a una **lista blanca de estaciones de montaña** (unas 80–100, las de la tabla de la sección 2, priorizando PL, P_ y PN frente a EA y EM).
  3. Guarda **valores horarios** en una tabla `lluvia_obs(fuente, estacion, ts_hora, mm, raw jsonb)` con clave primaria `(fuente, estacion, ts_hora)` y upsert, para que repetir la lectura no duplique nada. En Tajo, guardar solo el valor de las horas en punto.
  4. Una vista o un proceso diario hace `lluvia_dia(fuente, estacion, fecha, mm, horas_validas, qc)`.
- **Relleno único** desde el 1 de agosto: Duero (histórico horario por estación), Júcar (`lluviasIntervalo` día a día), Euskalmet (zip de 2026) y Tajo (lo que haya de los últimos 10 días). Un script local o una invocación manual de la función.
- **Control de calidad mínimo** antes de usar el dato en `rejilla`:
  - Rangos: más de 30 mm/h o más de 150 mm/día se marcan como sospechosos.
  - Picos: un valor más de 5 veces superior a la mediana de las vecinas en 25 km, cuando además el modelo da menos de 5 mm, se descarta (caso PL031).
  - Día incompleto: menos de 20 horas válidas.
  - Ruido: un 0,1 mm aislado se pone a 0.
  - Estación caída: el mismo valor durante más de 48 h, o `n/d`.
- **Uso en el índice.** En cada celda o punto de zona, mezclar las estaciones de menos de 20 km ponderando por distancia (IDW) y por diferencia de altitud. Si no hay ninguna válida, usar el modelo con corrección de sesgo: el cociente entre lo medido y el modelo de los últimos 30 días en esa zona. Esto conecta con la «pieza A» del brainstorming (sesgo de modelos).
- **El navegador nunca llama directamente a estas fuentes.** Duero y Tajo no tienen CORS y Euskalmet necesita una clave privada. La app lee `lluvia_dia` de Supabase o el `indice/ultimo.json` que ya publica `rejilla`.
- **Atribución en la app**: «Datos: SAIH Duero (CHD), SAIH Tajo (CHT), SAIH Júcar (CHJ), SAIH Ebro (CHE) – datos provisionales; Euskalmet – Gobierno Vasco (CC BY 4.0); AEMET».

### Siguientes pasos que dependen de la usuaria o de Gonzalo

1. Registrarse en Open Data Euskadi y solicitar la clave de la API de Euskalmet.
2. Registrarse en saihebro.com para obtener la apikey de `apiopendata`.
3. (Opcional) Escribir a la CHD y la CHT para confirmar si hay un servicio de datos para reutilizar o un histórico más largo.
4. Volver a probar el SAIH Guadiana dentro de unas semanas.

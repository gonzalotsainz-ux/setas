# Mapa nuevo con índice por ladera — diseño

Fecha: 01/10/2026 · Estado: aprobado en conversación por la usuaria (pendiente de revisar este documento)

Brainstorming de mejoras con cuatro piezas independientes: A) lluvia más fiable, B) señales de que ya salen, C) índice por punto y D) mapa nuevo. La usuaria eligió hacer **C + D primero**. A y B tendrán su propio diseño más adelante. La revisión automática de normativa no se hará por ahora, y la calibración con el diario quedó descartada.

## 1. Qué se quiere

Un mapa que se use como Google Maps y diga **dónde, dentro de cada zona, es más probable encontrar setas comestibles hoy y los próximos días**. La nota depende del bosque, la altitud y la orientación de cada ladera, no solo de la zona.

Criterios de éxito:
- se abre rápido en el móvil;
- se ve claro dónde ir y cómo llegar;
- nunca se colorea un sitio sin monte apropiado ni una zona prohibida;
- en los puntos actuales, y sin ajuste de ladera, las notas coinciden con las de la app de hoy.

## 2. Lo que ve la usuaria (aprobado)

- **Pantalla completa.** Arriba hay un buscador de pueblos, sitios de la app y especies; buscar una especie selecciona su chip. Debajo va una fila de chips: «Mejor hoy» y las comestibles en temporada (Boletus, Níscalos, Rebozuelos, Perretxiko, Colmenillas…, según el día).
- **Botones a la derecha:**
  - *Capas*: fondo Mapa (claro, como Google; es el que sale por defecto), Relieve (claro con sombreado), Topográfico IGN o Satélite PNOA, y superpuestas Cotos, Prohibido, Lluvia, Sitios y Diario.
  - *Mi ubicación*.
- **Barra de días abajo:** Hoy, Mañana… hasta el horizonte de la previsión. Los días lejanos llevan el aviso «menos fiable», igual que hoy `pesoPrevision`.
- **Manchas de color solo sobre monte apropiado** (opción 1 aprobada). Si no hay chip elegido, el color es la mejor especie comestible de ese bosque para ese día; con un chip, solo esa especie.
- **Al tocar una mancha** sube una hoja con:
  - el bosque, la altitud y la orientación;
  - la nota y la especie que la da;
  - la lluvia de 26 días, la humedad del suelo y la temperatura;
  - el coto y si pide permiso;
  - tres botones: «Cómo llegar» (enlace de ruta a Google Maps), «Ver detalle» y «Guardar en el diario».

  Arrastrada hacia arriba, la hoja muestra el desglose del índice, las otras especies posibles y la gráfica de lluvia.
- **Zona prohibida:** hoja roja con la norma y nunca mancha.
- **Sitios:** chinchetas solo para los que tienen coordenadas de la fuente (hoy 12); el resto se encuentran en el buscador por pueblo.
- Hoy, Zona y las fichas no cambian.

Fondos, comprobados el 01/10/2026 (todos responden 200):
- CARTO Voyager para el fondo claro, con la atribución obligatoria «© OpenStreetMap © CARTO».
- IDEE `mdt` capa `Relieve`, superpuesta en *multiply* para el sombreado.
- IGN `mapa-raster` MTN y `pnoa-ma` OI.OrthoimageCoverage, como ahora.

## 3. Cómo se calcula (aprobado: camino A, precálculo en Supabase)

### 3.1 Rejilla fina estática (va en el repo, se genera una vez)
- **Celdas de 250 m** en EPSG:3857 alineadas a teselas, solo dentro de los bbox de las 11 zonas. Cada zona va en un archivo binario compacto `data/rejilla/<zona>.bin` con cabecera JSON pequeña y se carga perezosamente. Cada celda guarda:
  - `habitat`: un código de los hábitats de `especies.json` (pinar silvestre, pinar negral o resinero, robledal, hayedo, castañar, encinar, alcornocal, pastizal de montaña…), o 0 si no hay monte apropiado;
  - `altitud` en metros;
  - `orientacion` en 8 rumbos más «llano»;
  - `pendiente`, por tramos.
- **Fuentes:**
  - Mapa Forestal de España MFE50 de MITECO, por provincia, con la especie dominante y la fracción de cabida cubierta, mapeadas a hábitat con una tabla documentada en `docs/datos.md`.
  - El modelo de terreno IGN MDT o, si su descarga pide pasos manuales, Copernicus DEM GLO-30 o teselas Terrarium de AWS. Se calculan orientación y pendiente.
  - El script registra la fuente y la fecha.
- **Celdas prohibidas** (polígonos `prohibido` de `cotos.geojson`): `habitat = 0` con una marca de prohibido. Una prueba lo exige.
- Script: `scripts/rejilla/generar.mjs`. Se ejecuta en local, no en el navegador. Se apunta el tamaño final de cada archivo; el objetivo es menos de 300 KB por zona tras gzip.

### 3.2 Precálculo diario en Supabase
- **Rejilla gruesa de unos 10 km** (~0,09° × 0,09°) sobre las zonas, unas 200 celdas. A cada celda se le asigna una altitud de referencia: la media de sus celdas finas con monte.
- **Edge Function `rejilla`**, programada con pg_cron y pg_net a las 07:00 y 19:00 Europe/Madrid. Por celda gruesa:
  - pide a Open-Meteo, en peticiones de varios puntos, los mismos modelos y variables que `js/meteo.js`, con `elevation` igual a la altitud de referencia;
  - el pasado se guarda en una tabla `meteo_celdas` (celda, fecha, modelo y variables), y cada ejecución pide solo `past_days=2` más la previsión;
  - si falta el histórico, el primer relleno se hace desde el 1 de agosto con la API de archivo, troceado en varias ejecuciones si hace falta;
  - **presupuesto**: a lo sumo unas 1.000 llamadas ponderadas al día, frente al límite gratuito de 10.000.
- **Salida:** un archivo `indice/<fecha>T<hora>.json`, más `indice/ultimo.json` como puntero, en un bucket público de Storage. Por celda gruesa, especie y día trae:
  - los factores que no dependen de la ladera: fW, fS, fR, fA, fC y penalizaciones;
  - la temperatura a la altitud de referencia;
  - la marca de dato incompleto.

  Se reutiliza tal cual `js/indice.js`: Deno importa el mismo módulo, así que no hay una segunda copia de la fórmula. Los umbrales editados en `ajustes_umbrales` se aplican igual que en la app.
- La función no publica un archivo nuevo si menos del 90 % de las celdas tienen datos; se queda el anterior.

### 3.3 En el móvil
- Descarga `ultimo.json`, que se cachea 3 h igual que `cache.js`, y la rejilla fina de las zonas visibles.
- Para cada celda fina con hábitat calcula:
  - la temperatura corregida por altitud: −0,65 °C por cada 100 m respecto a la de referencia;
  - fT, con esa temperatura;
  - un modificador de humedad por orientación, umbría frente a solana. Es **orientativo**, sale de la bibliografía, con valores y fuentes en `docs/datos.md`, y se marca así en la hoja;
  - la nota final con la misma `calcularIndice` y `nivelDe`.

  Solo se calculan las especies cuyo `habitat` encaja con la celda y que están en temporada.
- **Pintado** en un canvas superpuesto a Leaflet, con colores de `nivelDe`. Se dibuja en un Web Worker si medirlo en un móvil medio da más de unos 200 ms.

### 3.4 Fallos
- Archivo de otro día o de la ejecución anterior: aviso «Datos de ayer a las 19:00», como hoy `avisoOtroDia`.
- Sin archivo o sin red: el mapa muestra los puntos de siempre con la nota de zona, como ahora, con un aviso.
- Celda gruesa incompleta: sus celdas finas salen en gris, con «sin datos suficientes» en la hoja. No se inventan valores.

## 4. Pruebas
- **Equivalencia:** en cada punto de `zonas.json`, con el ajuste de orientación neutro y la misma meteo, la nota por rejilla es igual a la de `indiceZona` (tolerancia de 1 punto, por la diferencia de altitud).
- No hay ninguna celda con color dentro de un polígono `prohibido` ni con `habitat = 0`.
- Corrección por altitud y modificador de orientación: casos con números exactos.
- Formato de la rejilla binaria: ida y vuelta del codificador y del decodificador.
- Edge Function: presupuesto de llamadas, que no publique por debajo del 90 % y que pida solo lo nuevo si hay histórico.
- UI: la hoja tiene «Cómo llegar» con la URL correcta, los chips reflejan la temporada y en una zona prohibida la hoja sale en rojo.
- `npm run comprobar` sigue siendo el gancho pre-push. El validador comprueba la cabecera y el tamaño de cada rejilla.

## 5. Fuera de alcance
- Lluvia de radar o estaciones autonómicas y corrección de sesgo de modelos: es la pieza A.
- Partes micológicos y avistamientos de iNaturalist o GBIF: es la pieza B.
- Calibración con el diario.
- Revisión automática de normativa.
- Cambios en Hoy, Zona y las fichas.

## 6. Riesgos y decisiones abiertas para el plan
- La descarga de MFE50 y del MDT puede requerir pasos manuales. El plan empieza por un sondeo de fuentes y elige la que se pueda automatizar, con licencia compatible y atribución.
- Las IPs de salida de Supabase son compartidas con otros clientes, así que Open-Meteo puede devolver 429. Hace falta reintento con espera y conservar el archivo anterior; si se repite, se propone una clave de Open-Meteo o se reparten las peticiones.
- Límites del plan gratuito de Supabase (tiempo de Edge Function y almacenamiento): se miden en el sondeo.
- El modificador por orientación no tiene una calibración local. Va marcado como orientativo y con valores conservadores.
- Despliegue: la función y pg_cron necesitan el token de Supabase y la autorización de la usuaria en ese momento. El token `setas-claude` debía revocarse, así que habrá que crear uno nuevo.

# 08. Rejilla por ladera: fuentes y límites (sondeo de la tarea 0)

Consulta realizada el 2026-10-01. Todas las URL se abrieron ese día salvo que se diga otra cosa. **[EVIDENCIA]** = comprobado con una petición o con el documento oficial citado; **[NO VERIFICADO]** = no se ha podido comprobar; **[RESUMEN AUTOMÁTICO]** = página leída con un resumen automático (WebFetch), no con curl. **[CRITERIO PROPIO]** = decisión nuestra, no de la fuente. Cada apartado acaba con la línea **Decisión:**, que es lo que va a `scripts/rejilla/config.mjs`.

Las descargas en bruto están en `_fuentes/` (no van al repo): `_fuentes/sondeo.md` (tabla del sondeo), `_fuentes/mfe50/` (ZIP, shapefiles y GeoJSON por provincia), `_fuentes/mfe50-attr/` (tablas de atributos en JSON, para contar valores).

## Tabla del sondeo en vivo

`node scripts/rejilla/sondeo.mjs > _fuentes/sondeo.md`, 2026-10-01, desde la conexión de la usuaria. Ninguna petición dio 429.

| Prueba | Estado | ms | Bytes | Tipo | Long. URL | Detalle |
|---|---|---|---|---|---|---|
| Open-Meteo forecast, 50 puntos, 2+10 días | 200 | 804 | 498406 | application/json | 1579 | 50 ubicaciones |
| Open-Meteo forecast, 100 puntos, 2+10 días | 200 | 235 | 996887 | application/json | 2813 | 100 ubicaciones |
| Open-Meteo forecast, 200 puntos, 2+10 días | 200 | 450 | 1993813 | application/json | 5290 | 200 ubicaciones |
| Open-Meteo forecast, 500 puntos, 2+10 días | 414 | 57 | 170 | text/html | 12725 | (URI demasiado larga) |
| Open-Meteo forecast, 1 punto, past_days=61 | 200 | 307 | 55147 | application/json | 363 | 1 ubicación |
| Open-Meteo forecast, 1 punto, past_days=92 | 200 | 427 | 78248 | application/json | 363 | 1 ubicación |
| Open-Meteo forecast, 1 punto, past_days=93 | 200 | 63 | 78992 | application/json | 363 | 1 ubicación |
| Open-Meteo archivo, 50 puntos, suelo 122 días | 200 | 644 | 132223 | application/json | 1409 | 50 ubicaciones |
| Terrarium z12 (Valsaín) | 200 | 863 | 125111 | image/png | 72 | |
| Copernicus GLO-30 N40 W004 (HEAD) | 200 | 582 | 40869620 | image/tiff | 129 | |
| IGN WCS mdt GetCapabilities | 200 | 245 | 12162 | text/xml | 77 | Elevacion4258_1000 … Elevacion25830_25, Elevacion25830_5 … (17 coberturas) |
| IDEE mdt Relieve z16 (WMTS) | 200 | 432 | 3059 | image/jpeg | 200 | |
| CARTO Voyager z12 | 200 | 485 | **2049** | image/png | 68 | imagen «API KEY REQUIRED» (< 5 KB: no vale) |

Pruebas a mano añadidas el mismo día (curl):
- `past_days` = 93, 120, 183, 365, 366 con 1 punto: 93 devuelve 103 días (93 + 10); los demás responden `{"error":true,"reason":"Past days is invalid. Allowed range 0 to 93. Given 120."}`. **[EVIDENCIA]**
- IGN WCS `GetCoverage` de 100 × 100 km en EPSG:3857 (1.600 × 1.600 px): 200, 5.126.815 bytes, GeoTIFF Int16, 4 a 8 s. Detalle en D2. **[EVIDENCIA]**
- Base IGN `IGNBaseTodo` z12 (2002/1537): 200, 61.381 bytes, image/png. **[EVIDENCIA]**

---

## D1. MFE50 por provincia

**Fuente.** Mapa Forestal de España 1:50.000 (MFE50), Banco de Datos de la Naturaleza, MITECO. Ficha: https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/mfe50.html («Suministro: Descarga gratuita», «Ámbito: Provincial», «Escala: 1:50.000», «Actualización: Proyecto realizado entre los años 1997 a 2006»). Índice de descargas por comunidad: https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/mfe50_descargas_ccaa.html . **[EVIDENCIA]**

**Descarga: enlace directo, sin formulario.** Cada página de comunidad (`mfe50_descargas_castilla_leon.html`, `…_castilla_la_mancha.html`, `…_comunidad_madrid.html`, `…_pais_vasco.html`, `…_extremadura.html`) enlaza un ZIP por provincia en `https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/servicios/banco-datos-naturaleza/<archivo>`. Se bajaron los 11 con curl (200, `application/zip`) a `_fuentes/mfe50/<provincia>/`. **[EVIDENCIA]**

| Provincia | Archivo | Bytes del ZIP | Teselas |
|---|---|---|---|
| Madrid | MFE50_28_tcm30-200078.zip | 17.384.674 | 10.156 |
| Segovia | MFE50_40_tcm30-200076.zip | 24.700.889 | 11.225 |
| Ávila | MFE50_05_tcm30-200064.zip | 19.959.997 | 9.422 |
| Soria | MFE50_42_tcm30-200072.zip | 61.520.237 | 20.427 |
| Burgos | MFE50_09_tcm30-200105.zip | 52.569.016 | 23.856 |
| Guadalajara | MFE50_19_tcm30-200104.zip | 43.864.787 | 16.135 |
| Cuenca | MFE50_16_tcm30-200071.zip | 48.777.101 | 20.206 |
| Toledo | MFE50_45_tcm30-200089.zip | 36.778.462 | 16.594 |
| Álava | MFE50_01_tcm30-200095.zip | 94.241.585 | 61.929 |
| Cáceres | MFE50_10_tcm30-200099.zip | 39.566.565 | 21.000 |
| Badajoz | MFE50_06_tcm30-200070.zip | 26.550.508 | 15.642 |

**Formato y sistema de referencia.** Shapefile (`mfe50_<cód. INE>.shp/.dbf/.prj/.shx/.sbn/.sbx`) más un XML de metadatos ISO 19139. Los 11 `.prj` dicen `ETRS_1989_UTM_Zone_30N` (EPSG:25830), también Cáceres y Badajoz (huso 29 geográficamente, pero entregados en 30). Texto de los `.dbf` en Latin-1. **[EVIDENCIA]**

**Campos reales** (`npx mapshaper -i _fuentes/mfe50/Soria/mfe50_42.shp -info`; los mismos 33 campos en las 11 provincias): `POLIGON, PROV_MFE50, CCAA_MFE50, TFCCTOT, TFCCARB, FCC_POND, TIPESTR, DISTRIB, FOR_MAN, SP1, O1, E1, SP2, O2, E2, SP3, O3, E3, DEFINICION, CLAS_IFN, USOS_SUELO, CLASMFE_IF, USOS_GENER, TSP1, TSP2, TSP3, TIPO_BOSQU, ID_FORARB, CLA_FORARB, NOM_FORARB, REGBIO, Shape_Leng, Shape_Area`. **[EVIDENCIA]**
- Especie dominante y segunda: `SP1`, `SP2` (códigos numéricos del IFN; `0` = sin especie). `O1`, `O2` son la ocupación («grado de presencia» de cada especie en la tesela, de 0 a 10, tabla 9 del documentador del IFN3; en las 11 provincias `O1 + O2 + O3` nunca pasa de 10) y `E1`, `E2` el estado de cada una. **[EVIDENCIA]** `O1`/`O2` se añadieron a la conversión el 2026-10-01 en la tarea 5 (regla de mezclas). `TSP1…3` vienen vacíos en las 11 provincias.
- Fracción de cabida cubierta arbolada: `TFCCARB` (número, %). `TFCCTOT` es la total y `FCC_POND` la ponderada.
- Tipo de estructura: `TIPESTR` (número), con su texto en `DEFINICION`.

Valores reales de `TIPESTR` (y su `DEFINICION`) en las 11 provincias juntas, con el número de teselas: 1 Bosque (75.265) · 2 Bosque Plantación (23.575) · 3 Dehesa (7.283) · 4 Complementos del bosque (1.025) · 5 T. D. (Talas) (560) · 6 T. D. (Incendio) (178) · 7 T. D. (Fenómenos naturales) (3) · 8 Matorral (25.582) · 9 Herbazal (11.118) · 10 Monte sin vegetación superior (5.320) · 11 A.F.M. (Riberas) (4.913) · 12 A.F.M. (Bosquetes) (5.224) · 13 A.F.M. (Alineaciones) (34) · 15 Agrícola y prados artificiales (27.125) · 16 Artificial (9.078) · 17 Humedal (499) · 18 Agua (2.188) · 21 Autopistas y autovías (184) · 22 Infraestructuras de conducción (253) · 23 Minería, escombreras y vertederos (1.589) · 24 Prado con sebes (676) · 25 Mosaico arbolado sobre cultivo (1.201) · 26 Mosaico arbolado sobre forestal desarbolado (233) · 27 Mosaico desarbolado sobre cultivo (1.257) · 28 Cultivo con arbolado disperso (2.237) · 29 Parque periurbano (36) · 30 Área recreativa (29) · 34 Prado (4.097) · 35 Pastizal-Matorral (15.830). **[EVIDENCIA]**

El significado de los tipos estructurales y su paso a uso del suelo está en el documentador del IFN3 (tabla «Unión del tipo estructural con niveles», anexo 17): https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/documentador_bdsig_ifn3_tcm30-293905.pdf . **[EVIDENCIA]**

**El MFE50 no detalla el matorral.** En las teselas de `TIPESTR` 8 (Matorral), 9, 34 y 35, `SP1` es 0 en todas salvo una (25.581 de 25.582 en Matorral). No hay especie de matorral, así que no se pueden distinguir jarales. **[EVIDENCIA]** En los mosaicos (25 a 27) los campos de especie llevan a veces códigos de ocupación, no de especie: 1500 cultivo, 3400 prado, 3500/8000/9000 forestal desarbolado (documentador IFN3, anexo 17). No están en el diccionario: `leerTeselaMfe` los deja como texto y no dan hábitat.

**Diccionario de especies.** Anexo 4 «Especies arbóreas y arbustivas» del documentador IFN3 citado arriba (códigos 001 a 997). El MFE50 usa esos códigos sin ceros a la izquierda (21 = *Pinus sylvestris*, 43 = *Quercus pyrenaica*, 71 = *Fagus sylvatica*…). Guardado en `scripts/rejilla/mfe-diccionario.json` (185 códigos de árbol, solo el nombre científico, tal cual lo da el anexo; los grupos como «Otras coníferas» o «Mezcla de árboles de ribera» se dejan con su texto oficial). Todos los códigos de especie que aparecen en las 11 provincias están en el diccionario, salvo los de ocupación (1500, 3400, 3500, 8000, 9000). **[EVIDENCIA]** El texto del PDF sale en columnas desalineadas; se copió código y nombre científico, que sí van en la misma línea, y se comprobó a mano la secuencia 050 a 099. Los sinónimos y nombres vulgares no se usan.

**Muestra.** `scripts/rejilla/mfe-muestra.json`: 23 teselas reales con todas sus `properties`, de 6 provincias (Soria, Segovia, Madrid, Álava, Cuenca, Cáceres): pinar silvestre, melojar, laricio de plantación, pinar resinero, encinar, dehesa de encina y de alcornoque, hayedo, quejigar, sabinar, castañar, chopera de ribera, matorral, herbazal, prado, prado con sebes, pastizal-matorral, cultivo, minería, agua y un bosque con cabida cubierta por debajo del 20 %.

**Licencia y atribución.** El MFE50 no lleva una licencia con nombre (no es CC BY). El aviso legal del portal de datos abiertos del MITECO (https://www.datosabiertos.miteco.gob.es/en/aviso-legal.html) [RESUMEN AUTOMÁTICO] autoriza la reutilización, comercial o no, incluida la modificación, adaptación y combinación, según el Real Decreto 1495/2011 (Ley 37/2007), con estas condiciones: citar la fuente («Fuente de los datos: Ministerio para la Transición Ecológica y el Reto Demográfico»), dar la fecha de la última actualización, no desnaturalizar la información y no dar a entender que el Ministerio apoya el uso. El XML de metadatos de cada ZIP dice «Es necesario citar fuente: Ministerio de Agricultura, Alimentación y Medio Ambiente» (el nombre del ministerio en 2013). **[EVIDENCIA]** La ficha de datos.gob.es (https://datos.gob.es/en/catalogo/e05068001-mapa-forestal-de-espana-escala-1-50-000) no trae campo de licencia. Publicar derivados (rejilla de hábitats) en un repo público con esa cita: permitido.

**MFE25.** Existe (cartografía 1:25.000 hecha entre 2007 y 2024, base del IFN4: https://www.miteco.gob.es/es/biodiversidad/temas/inventarios-nacionales/mapa-forestal-espana/mfe_25.html) [RESUMEN AUTOMÁTICO]. Qué provincias de las zonas tienen MFE25 descargable: **[NO VERIFICADO]** (la página de descargas del MFE25 que se probó devolvió «no existe»). La spec manda el MFE50; solo se anota.

**Conversión.** Se convirtieron las 11 con `npx mapshaper -i <shp> -proj wgs84 -clip bbox=<bbox> -filter-fields SP1,SP2,O1,O2,TFCCARB,TIPESTR -o format=geojson precision=0.00001 _fuentes/mfe50/<provincia>.geojson`. Se añadió `-clip bbox=` (hallazgo 21 del preflight: evita leer la provincia entera en el generador) con la unión de los bbox de las zonas de esa provincia más 0,05° de margen (`_fuentes/mfe50/bbox.tsv`). Tamaños: Madrid 14 MB, Segovia 33 MB, Soria 26 MB, Burgos 101 MB, Ávila 20 MB, Cuenca 24 MB, Guadalajara 26 MB, Toledo 30 MB, Álava 191 MB, Cáceres 82 MB, Badajoz 45 MB. Álava, la mayor, queda por debajo del límite de cadena de V8 (unos 512 MB), pero es la que más memoria pedirá en la tarea 8.

**Tipos [CRITERIO PROPIO].**
- Arbolado: 1 Bosque, 2 Bosque Plantación, 3 Dehesa, 11 Riberas, 12 Bosquetes. Son los tipos con especie y cabida cubierta; el filtro `FCC_MINIMA` = 20 % ya descarta el arbolado ralo. Fuera quedan 4 (Complementos del bosque: 1.024 de 1.025 sin especie), 5 a 7 (temporalmente desarbolado), 13 (alineaciones), 25 a 30 (mosaicos con cultivo o desarbolado, parques, áreas recreativas).
- Herbazal o pastizal: 9 Herbazal, 24 Prado con sebes, 34 Prado, 35 Pastizal-Matorral. El 35 es mixto; se cuenta como pastizal porque el matorral del MFE50 no da hábitat y así no se pierde el pastizal de montaña. El 24 y el 34 son prados (en el MFE50 van como uso «Cultivos»). Por altitud dan `prado` o `pastizal-montana`.
- Matorral: 8 Matorral. Sin especie, así que nunca da `jaral`.
- `matorralJaral`: vacío, porque el MFE50 no detalla el matorral.

**Decisión:** `CONFIG.mfe = { nombre: 'Mapa Forestal de España 1:50.000 (MFE50)', url: 'https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/mfe50.html', licencia: 'Reutilización con cita de la fuente (Real Decreto 1495/2011, aviso legal del MITECO)', atribucion: 'Mapa Forestal de España 1:50.000 (MFE50) © Ministerio para la Transición Ecológica y el Reto Demográfico', fecha: '2026-10-01', carpeta: '_fuentes/mfe50', archivos: { <provincia>: '_fuentes/mfe50/<provincia>.geojson' } (las 11), campos: { especies: ['SP1', 'SP2'], ocupacion: ['O1', 'O2'], fcc: 'TFCCARB', tipo: 'TIPESTR' }, tipos: { arbolado: ['1', '2', '3', '11', '12'], herbazal: ['9', '24', '34', '35'], matorral: ['8'] }, matorralJaral: [] }`.

---

## D2. Modelo digital del terreno

Bbox de las 11 zonas en EPSG:3857 con celdas de 250 m: 2.343.993 celdas en total; la mayor es Extremadura (958 × 1.379).

**IGN, servicio WCS `https://servicios.idee.es/wcs-inspire/mdt`** (WCS 2.0.1). `GetCapabilities`: «Modelos Digitales del Terreno de paso de malla de 1000, 500, 200, 25 y 5m procedentes de sensores LiDAR aerotransportados del proyecto PNOA-LiDAR», `AccessConstraints` = «CC BY 4.0 scne.es», `Fees` = «No se aplican condiciones», 17 coberturas, CRS admitidos 25828 a 25831, 3857, 4083, 4258 y 4326. **[EVIDENCIA]** `DescribeCoverage` de `Elevacion25830_25`: malla de 25 m, cubre de x = −19.487 a 1.140.387 m en UTM 30 (llega a Extremadura y a la frontera con Portugal), formato nativo COG. **[EVIDENCIA]**
- `GetCoverage` desde un script, sin clave ni formulario, de un bloque de 100 × 100 km reproyectado a EPSG:3857 con 1.600 × 1.600 px (62,5 m por píxel, 4 por celda de 250 m, como pide la tarea 6):
  `https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=Elevacion25830_25&FORMAT=image/tiff&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/3857&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/3857&SUBSET=x(-445000,-345000)&SUBSET=y(4990000,5090000)&SCALESIZE=x(1600),y(1600)`
  → 200, 5.126.815 bytes, GeoTIFF Int16 (metros enteros), clave `ProjectedCSTypeGeoKey` = 3857, bbox exacto el pedido, valores de 682 a 2.424 m (Guadarrama; Peñalara mide 2.428 m), sin valor nulo declarado. Leído con `geotiff` en Node. **[EVIDENCIA]**
- Fuera de España (bloque sobre la raya de Portugal, x = −835.000…−735.000, y = 4.650.000…4.750.000) devuelve **0** donde no hay datos (819.775 de 2.560.000 píxeles), no un valor nulo. La tarea 6 o la 8 deben tratar el 0 como «sin dato» o recortar a España; la zona `extremadura` llega a lon −7,45 (Portugal). **[EVIDENCIA]**
- Volumen: 26 peticiones de bloque (400 × 400 celdas) para las 11 zonas, ≤ 133 MB en total (los bloques del borde son menores). Cada petición tardó de 4 a 8 s.
- Licencia CC BY 4.0, oficial: cumple los tres criterios y es la primera del orden. Atribución: la fórmula «Obra derivada de <producto> CC-BY 4.0 …» que el Centro de Descargas del CNIG da para los productos del IGN (Orden FOM/2807/2015; vista el 2026-10-01 en la ficha del NGMEP), aplicada al MDT25 con el dominio que da el propio servicio (scne.es): «Obra derivada de MDT25 CC BY 4.0 scne.es» [CRITERIO PROPIO por analogía; la ficha del MDT25 no se abrió].
- MDT25 o MDT05 por descarga del Centro de Descargas del CNIG: no se probó a fondo. El centro pide reCAPTCHA para descargar (ver D5), así que no se automatiza. El WCS lo sustituye.

**Copernicus DEM GLO-30 en AWS.** Teselas COG de 1° (`https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N40_00_W004_00_DEM/…tif`: 200, 40.869.620 bytes). Se automatiza; 30 m («GLO-30 Public provides limited worldwide coverage at 30 meters», https://registry.opendata.aws/copernicus-dem/ [RESUMEN AUTOMÁTICO]). 28 teselas de 1° para las 11 zonas (unos 1,1 GB). Licencia: «available on a free basis for the general public under the terms and conditions of the Licence» de Copernicus; atribución de la ficha: «Copernicus Digital Elevation Model (DEM) was accessed on DATE from https://registry.opendata.aws/copernicus-dem». Es un modelo de superficie (DSM: copas de los árboles incluidas), no del terreno. Segunda opción.

**Terrarium (AWS Terrain Tiles).** PNG en EPSG:3857 (z12 de Valsaín: 200, 125.111 bytes). Se automatiza; 1.702 teselas z12 para las 11 zonas. Atribución obligatoria (https://github.com/tilezen/joerd/blob/master/docs/attribution.md [RESUMEN AUTOMÁTICO]): para Europa «Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers», más el resto de fuentes de la lista. Resolución en España: la de EU-DEM (unos 25 a 30 m) **[NO VERIFICADO]**. Tercera opción.

**Decisión:** `CONFIG.mdt = { fuente: 'ign-wcs', z: null, plantillaUrl: 'https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=Elevacion25830_25&FORMAT=image/tiff&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/3857&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/3857&SUBSET=x({oeste},{este})&SUBSET=y({sur},{norte})&SCALESIZE=x({ancho}),y({alto})', nombre: 'Modelo Digital del Terreno MDT25 (IGN, PNOA-LiDAR), servicio WCS', url: 'https://servicios.idee.es/wcs-inspire/mdt', licencia: 'CC BY 4.0', atribucion: 'Obra derivada de MDT25 CC BY 4.0 scne.es', fecha: '2026-10-01' }`.

---

## D3. Open-Meteo multipunto

- **Ubicaciones por petición:** 50, 100 y 200 puntos responden 200 en menos de 1 s (2 MB de JSON con 200). 500 puntos dan **414** (URI de 12.725 caracteres): el límite es la longitud de la URL, no el número de puntos. Con las variables actuales (7 diarias + 2 horarias) el corte está entre 200 (5.290 caracteres) y 500. **[EVIDENCIA]** La documentación dice: «Multiple coordinates can be comma separated … To return data for multiple locations the JSON output changes to a list of structures» (https://open-meteo.com/en/docs [RESUMEN AUTOMÁTICO]); no habla de POST ni de límite de URL.
- **`past_days`:** el servidor admite hasta **93** («Allowed range 0 to 93»), pero la documentación dice «Integer (0-92)». **[EVIDENCIA de las dos cosas]** Se usa 92, el máximo documentado y comprobado, para no depender de un margen que la documentación no promete. [CRITERIO PROPIO]
- **Ponderación:** «Requests for data covering more than 10 weather variables or extending over a period of more than 2 weeks for a single location are considered multiple API calls … a request for 2 weeks of data with 15 weather variables will be calculated as 1.5 API calls, while 4 weeks of data equals 3.0 API calls» (https://open-meteo.com/en/pricing [RESUMEN AUTOMÁTICO]). No publica cómo cuenta varias ubicaciones: se mantiene la estimación de `docs/datos.md`, `puntos × max(1, variables/10) × max(1, días/14)`. Límites gratuitos: 600/min, 5.000/h, 10.000/día (https://open-meteo.com/en/terms, leído con curl, **[EVIDENCIA]**) y 300.000/mes (página de precios [RESUMEN AUTOMÁTICO]). Licencia de los datos: CC BY 4.0 (mismas condiciones).
- API de archivo, 50 puntos × 122 días de humedad del suelo: 200 en 0,6 s. **[EVIDENCIA]**

**Decisión:** `CONFIG.openMeteo = { trozo: 200, maxPasados: 92 }`.

---

## D4. Supabase, plan gratuito

Documentación oficial, leída con resumen automático el 2026-10-01 **[RESUMEN AUTOMÁTICO]**:
- **Edge Functions** (https://supabase.com/docs/guides/functions/limits): memoria máxima 256 MB; duración (reloj) 150 s en el plan gratuito y 400 s en los de pago; **CPU máxima 2 s por petición** («does not include async I/O»); tiempo de inactividad de la petición 150 s; tamaño de la función 20 MB (subida con la CLI) o 5 MB (desde el panel); 100 funciones en el plan gratuito.
- **Tareas en segundo plano** (https://supabase.com/docs/guides/functions/background-tasks): `EdgeRuntime.waitUntil(promise)` mantiene viva la instancia hasta que acaba la promesa; «The function will shut down when it reaches one of these limits» (reloj, CPU y memoria de arriba). No hay un límite propio aparte.
- **Supabase Cron / pg_cron** (https://supabase.com/docs/guides/cron): «we recommend no more than 8 Jobs run concurrently. Each Job should run no more than 10 minutes»; puede hacer peticiones HTTP a una Edge Function. La página no dice el plan; pg_cron es una extensión de Postgres que se activa con `create extension pg_cron` (o en Database → Extensions) **[NO VERIFICADO para el plan gratuito en la propia página; en este proyecto no hay todavía ninguna migración con pg_cron]**.
- **pg_net** (https://supabase.com/docs/guides/database/extensions/pg_net): `create extension pg_net with schema "extensions";` o desde Extensions; hasta 200 peticiones por segundo; tiempo de espera por defecto 2.000 ms; respuestas guardadas 6 h. Sin restricción de plan mencionada.
- **Vault** (https://supabase.com/docs/guides/database/vault): `select vault.create_secret('…', '<nombre>')` y lectura por la vista `vault.decrypted_secrets` (proteger el acceso a esa vista). La página no dice el plan **[NO VERIFICADO]**.
- **Storage** (https://supabase.com/docs/guides/storage/uploads/file-limits y https://supabase.com/pricing): archivo de 50 MB como máximo en el plan gratuito; 1 GB de almacenamiento; 5 GB de salida al mes. **Base de datos:** 500 MB. 500.000 invocaciones de Edge Functions al mes. Los proyectos gratuitos se pausan tras 1 semana sin actividad.
- **Función `aemet` ya desplegada:** `GET https://ctgedeunquvmcfqsufjj.supabase.co/functions/v1/aemet` con la clave publicable de `js/config.js` y sin parámetros responde 400 en 0,8 s, servida por `supabase-edge-runtime`, región `eu-west-3`. El proyecto y el runtime están vivos. **[EVIDENCIA]** No se usaron ni pidieron tokens de gestión.

**Tamaño de `meteo_celdas`:** 350 celdas × 400 días × unos 100 bytes = 14 MB de datos (con índices y cabeceras de fila, del orden de 30 MB) frente a 500 MB. Cabe con holgura.

**CPU medida en Node 24.14 (esta máquina):** `calcularIndice` de `js/indice.js` sobre 350 series de `serieSintetica` (70 días; lluvia, temperatura y humedad variadas por celda) × 12 especies reales de `data/especies.json` (boletus-edulis … craterellus-cornucopioides) × 10 días = 42.000 cálculos: **131 ms** la primera vez y 112 ms las siguientes. El script está en el scratchpad de la sesión; no va al repo. Es menos de la mitad del límite de 2 s (1.000 ms) incluso con un margen ×4 para la CPU del servidor. **[EVIDENCIA]**

**Decisión:** `CONFIG.supabase = { lotes: 1 }`.

---

## D5. Pueblos para el buscador

**Fuente:** Nomenclátor Geográfico de Municipios y Entidades de Población (NGMEP), IGN/CNIG: https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=NGMEN . Toda España en un archivo «CSV + MDB» de 9,59 MB, edición 2026; coordenadas en ETRS89 (compatibles con WGS84) en longitud y latitud. **[EVIDENCIA]** Memoria (https://centrodedescargas.cnig.es/CentroDescargas/documentos/Memoria_NGMEP.pdf, fecha 31 de marzo de 2026): cinco CSV, uno por tabla (PROVINCIAS, MUNICIPIOS, ENTIDADES, EATIMS, COMUNIDADES JURISDICCIONALES). La tabla ENTIDADES tiene `CODIGOINE, NOMBRE, COD_PROV, PROVINCIA, TIPO, POBLACION, INEMUNI, HOJA_MTN25, LONGITUD_ETRS89_REGCAN95, LATITUD_ETRS89_REGCAN95, ORIGENCOOR, ALTITUD, ORIGENALTITUD, SUPRIMIDA_INE, DISCREPANTE_INE…`; población a 1 de enero de 2025. **[EVIDENCIA de la memoria]** La memoria parte el nombre de las coordenadas en dos líneas («LONGITUD_ETRS89 / _REGCAN95»): el nombre exacto de la columna en el CSV **[NO VERIFICADO]**.

**Licencia:** CC BY 4.0 (Orden FOM/2807/2015, licencia de uso del IGN). Fórmulas de la página: «NGMEP CC-BY 4.0 ign.es» si no se modifica; **«Obra derivada de NGMEP CC-BY 4.0 ign.es»** si se genera un producto nuevo (es nuestro caso: se filtra y se reduce). **[EVIDENCIA]**

**La descarga no se automatiza.** El botón de descarga pide un token de reCAPTCHA (`grecaptcha.execute(…, { action: 'preautorizar_descarga' })` y luego `preAutorizarDescarga`); sin él, `descargaDir` responde «Error en el protocolo de descarga. No está autorizado». Probado con curl y con un navegador automático (que además falla con «Invalid reCAPTCHA client id»). No se intenta saltar el captcha. **[EVIDENCIA]** Pasos para la usuaria, una sola vez:
1. Abrir https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=NGMEN en el navegador.
2. En la fila «Nomenclátor Geográfico de Municipios y Entidades de Población · CSV + MDB · 2026 · 9.59 MB», pulsar el icono de descarga (flecha).
3. Descomprimir el ZIP en `_fuentes/pueblos/` del repo (que quede `_fuentes/pueblos/ENTIDADES.csv`, o el nombre que traiga la tabla de entidades).
4. Avisar: hay que comprobar el nombre del archivo y de las columnas de coordenadas y corregir `CONFIG.pueblos` si no coinciden (antes de la tarea 18).

Alternativa automática (no elegida): el WFS INSPIRE del Nomenclátor Geográfico Básico (`https://www.ign.es/wfs-inspire/ngbe`, CC BY 4.0, sin captcha) da todos los topónimos (también parajes y montes) sin provincia; habría que filtrar por tipo y cruzar con las provincias. Más trabajo y otro formato.

**Decisión:** `CONFIG.pueblos = { nombre: 'Nomenclátor Geográfico de Municipios y Entidades de Población (NGMEP), IGN', url: 'https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=NGMEN', licencia: 'CC BY 4.0 (Obra derivada de NGMEP CC-BY 4.0 ign.es)', fecha: '2026-10-01', archivo: '_fuentes/pueblos/ENTIDADES.csv', columnas: { nombre: 'NOMBRE', provincia: 'PROVINCIA', lat: 'LATITUD_ETRS89_REGCAN95', lon: 'LONGITUD_ETRS89_REGCAN95' } }`. El archivo y los nombres de columna salen de la memoria y faltan por comprobar con la descarga **[NO VERIFICADO]**.

---

## D6. Atribuciones

Texto que debe verse en el mapa (control de atribución de Leaflet) y en Ajustes:
- **Base IGN (fondo «Mapa»):** WMTS `https://www.ign.es/wmts/ign-base`, capa `IGNBaseTodo`, `AccessConstraints` «CC BY 4.0 scne.es». Texto: «Base IGN CC BY 4.0 scne.es» (en Leaflet, la misma `ATR_IGN` de `js/mapa.js`: «© Instituto Geográfico Nacional CC BY 4.0»). **[EVIDENCIA]**
- **IDEE (relieve):** WMTS `https://servicios.idee.es/wmts/mdt`, «Modelo Digital de Terreno de España», «CC BY 4.0 scne.es». Texto: «Relieve: MDT CC BY 4.0 scne.es». **[EVIDENCIA]**
- **IGN (MTN, PNOA):** como hasta ahora en `js/mapa.js` y en Ajustes («IGN / CNIG … CC BY 4.0 (© Instituto Geográfico Nacional de España)»).
- **MDT elegido (rejilla):** «Obra derivada de MDT25 CC BY 4.0 scne.es».
- **MFE50 (rejilla):** «Mapa Forestal de España 1:50.000 (MFE50) © Ministerio para la Transición Ecológica y el Reto Demográfico», con la fecha de los datos (proyecto 1997-2006; archivos de 2013) para cumplir la condición de indicar la última actualización.
- **Pueblos (buscador):** «Obra derivada de NGMEP CC-BY 4.0 ign.es».
- **CARTO:** no se usa (D7). Si algún día se usa: «© OpenStreetMap contributors, © CARTO».
- **Open-Meteo:** se mantiene la línea actual de Ajustes (CC BY 4.0).

---

## D7. Fondo claro (CARTO)

- `https://a.basemaps.cartocdn.com/rastertiles/voyager/12/2002/1537.png` responde 200 con **2.049 bytes**, una imagen que dice «API KEY REQUIRED» (fila del sondeo). No vale. **[EVIDENCIA]**
- https://carto.com/basemaps/apikey [RESUMEN AUTOMÁTICO]: clave gratuita «Free up to 5M requests a month. For non-commercial use: personal projects, research, teaching, non-profits»; «The key is yours: do not share it across unrelated projects» (no prohíbe que vaya en el cliente de un único proyecto, pero en un repo público queda a la vista); se pasa como `?key=YOUR_KEY` en la URL de las teselas; atribución «© OpenStreetMap contributors, © CARTO».
- Base IGN `IGNBaseTodo` responde 200 con 61.381 bytes en z12 (misma tesela) y es CC BY 4.0 sin clave. **[EVIDENCIA]**

**Decisión** (ya tomada; ruling del 01/10/2026 en el ledger): fondo «Mapa» = **Base IGN** (`ign-base`, `IGNBaseTodo`); `CARTO_URL = null` en `js/mapa/fondos.js` (tarea 16). Si un día se quiere CARTO, basta con pedir la clave y cambiar esa constante.

---

## D8. Orientación

Ajuste orientativo de `fW` (lluvia de 26 días) por umbría o solana, en `js/rejilla/orientacion.js` (tarea 7). Búsquedas del 2026-10-01 (WebSearch): «aspect sporocarp production Mediterranean pine forest Spain», «orientación umbría solana producción micológica pinares Soria Cesefor», «soil moisture north-facing south-facing slopes Mediterranean mountain Spain», «Pre-Pyrenees topsoil moisture northern slopes southern slopes», «Martínez-Peña Ágreda Pinar Grande modelo producción setas orientación».

**Criterio** (del plan): vale una fuente revisada por pares o un informe técnico oficial con un número (razón de producción, de humedad del suelo o de días con setas entre umbría y solana) en bosques comparables. Valor = punto medio entre 1 y la razón publicada, dentro de 0,85–1,15; diagonales (NE, NO, SE, SO) con la mitad del efecto de su rumbo principal; E, O y llano (código 0, ruling de la tarea 6) en 1.

**Fuente que cumple:**
- **Bonet, Pukkala, Fischer, Palahí, Martínez de Aragón y Colinas (2008).** «Empirical models for predicting the production of wild mushrooms in Scots pine (*Pinus sylvestris* L.) forests in the Central Pyrenees». *Annals of Forest Science* 65: 206, doi:10.1051/forest:2007089. Texto completo en https://hal.science/hal-00884160v1 (PDF `hal-00884160.pdf`, descargado y leído con `pdftotext` el 2026-10-01). **[EVIDENCIA]**
  - Datos: «mushroom production data from 24 Scots pine plots over 3 years» (1995-1997), Prepirineo, «Elevations ranged from 900–1500 m».
  - Ecuación 8, producción total: «ln(yij) = 0.981 + 2.483ln(G) − 0.128G + 0.934 cos(Asp) − 0.0135Slo1.5 + ui + uj + eij», «Asp is aspect (rad)»; «All the regression coefficients of predictors were significant (p < 0.05)».
  - Ecuación 9, comestibles: «+ 0.636 cos(Asp)»; ecuación 11, *Lactarius* comercializados: «+ 1.489 cos(Asp)». En los comercializados (ec. 10) «the effect of aspect was not statistically significant».
  - Texto: «Aspect is another factor which strongly affects the predicted production so that northern aspects have the highest productions and southern the lowest»; en la discusión: «Elevation, aspect and slope, in the Prepyrenees range, also reflect water availability […] Northern-facing slopes are characteristically more shaded and protected from the intense afternoon solar exposure that south-facing slopes experience in late summer and early autumn months».
  - Cuenta: con la ec. 8, norte (cos = 1) frente a este u oeste (cos = 0) = e^0,934 ≈ **2,54**; sur (cos = −1) = e^−0,934 ≈ **0,39** (norte frente a sur ≈ 6,5). Punto medio con 1: 1,77 y 0,70. **Recortados al tope: N = 1,15, S = 0,85**; NE y NO = 1,075; SE y SO = 0,925. **[CRITERIO PROPIO]** tomar E/O (cos = 0) como referencia 1, que es lo que pide el plan; usar la ecuación de producción total y no la de *Lactarius* (1,489), que es un solo grupo.

**Contexto que no da número pero matiza:**
- **López-Vicente, Navas y Machín (2009).** «Effect of physiographic conditions on the spatial variation of seasonal topsoil moisture in Mediterranean soils». *Soil Research* 47: 498-507, doi:10.1071/SR08250 (resumen leído vía la API de Crossref, `https://api.crossref.org/works/10.1071/SR08250`, 2026-10-01). Cuenca de Estaña (Prepirineo), humedad a 80 mm en 2005-2006: «Steep northern slopes presented the highest values of θR in spring, summer, and winter, and topsoil moisture progressively decreased from steep northern slopes to gentle slopes and from gentle slopes to steep southern slopes […] Any topographical trend was observed in autumn when values of θR were very high within the whole catchment» (el original dice «Any», se entiende «no»). El resumen no da la razón umbría/solana. **[EVIDENCIA]** del resumen, sin texto completo.
- Dehesa de Sierra Morena (Córdoba), 32 sensores en dos laderas opuestas, 2016-2019 (https://helvia.uco.es/xmlui/handle/10396/31679 y nota de prensa https://www.uco.es/ucci/es/noticias-ingles/item/3351-rock-humidity-in-spain-s-forested-pasturelands-dehesas-an-additional-source-of-water-for-vegetation-in-times-of-drought): según el resumen del buscador, «similar moisture dynamics» en ambas laderas y biomasa un 29 % mayor en la de umbría. **[RESUMEN AUTOMÁTICO]** (la página del repositorio no se pudo leer); dehesa, no bosque de setas: no se usa.
- Bonet, Fischer y Colinas (2004), *Forest Ecology and Management* 203: 157-175, doi:10.1016/j.foreco.2004.07.063 («The relationship between forest age and aspect on the production of sporocarps of ectomycorrhizal fungi…»): de pago, no leído. **[NO VERIFICADO]**
- Bonet et al. (2010), *Canadian Journal of Forest Research* 40: 347-356, doi:10.1139/X09-198: de pago (403), no leído. **[NO VERIFICADO]**
- No se encontró ninguna cifra por orientación de Cesefor/Micocyl ni de Pinar Grande (Soria): los modelos de Martínez-Peña et al. hablan de área basimétrica y meteorología.

**Límites** (para que nadie lea más de lo que hay):
- La razón es de **producción de setas**, no de humedad: mezcla agua, temperatura y luz. Se aplica a `fW` porque el artículo lo explica por la disponibilidad de agua y la insolación de final de verano. **[CRITERIO PROPIO]**
- Es un solo bosque (pino silvestre del Prepirineo, 24 parcelas, 3 años). Se aplica igual a todos los hábitats y zonas (también Álava o la sierra de Guadarrama) sin calibrar. Por eso se queda en el tope, una fracción del efecto publicado.
- En otoño húmedo la orientación no cambia la humedad superficial (López-Vicente et al. 2009) y `fW` ya está topado en 1 (`clamp01` en `supabase/functions/_shared/indice.js`): el ajuste solo pesa cuando falta lluvia, que es cuando la umbría aguanta mejor.

**Decisión:** `AJUSTE_ORIENTACION = { llano: 1, N: 1.15, NE: 1.075, E: 1, SE: 0.925, S: 0.85, SO: 0.925, O: 1, NO: 1.075 }`, con Bonet et al. 2008 en `FUENTES_ORIENTACION`. La hoja del mapa lo marca como orientativo (`esOrientativo`).

# Esquemas de datos

## data/zonas.json

```json
{
  "version": 1,
  "zonas": [
    {
      "id": "soria",
      "nombre": "Soria",
      "comunidad": "castilla-y-leon",
      "provincias": ["Soria"],
      "bbox": [-3.2, 41.6, -2.2, 42.1],
      "habitats": ["pinar-silvestre", "pinar-resinero", "melojar"],
      "puntos": [
        {
          "id": "soria-pinar-grande",
          "nombre": "Pinar Grande",
          "lat": 41.87,
          "lon": -2.72,
          "altitud": 1250,
          "habitat": "pinar-silvestre",
          "fuente": "https://…",
          "revisado": "2026-10-01"
        }
      ],
      "estacionesAemet": [
        {
          "id": "2030",
          "nombre": "Soria",
          "altitud": 1082,
          "distanciaKm": 18
        }
      ],
      "normas": ["cyl-decreto-31-2017"],
      "avisos": ["Permiso Micocyl obligatorio"],
      "fuentes": [
        {
          "url": "https://…",
          "titulo": "…",
          "consultado": "2026-09-30"
        }
      ]
    }
  ]
}
```

**Campos:**
- `id`: identificador único de la zona (slug)
- `nombre`: nombre legible de la zona
- `comunidad`: comunidad autónoma (castilla-y-leon, etc.)
- `provincias`: lista de provincias de la zona
- `bbox`: bounding box [min_lon, min_lat, max_lon, max_lat] para mapas
- `habitats`: lista de hábitats presentes (códigos de HABITATS)
- `puntos`: puntos de búsqueda georreferenciados
  - `id`: identificador único del punto
  - `nombre`: nombre legible
  - `lat`, `lon`: coordenadas en WGS84
  - `altitud`: altitud en metros
  - `habitat`: hábitat principal del punto
  - `fuente`: URL de origen del punto
  - `revisado`: fecha de verificación (YYYY-MM-DD)
  - `proteccion` (opcional): estado de protección del punto (espacio natural y qué se sabe de sus normas de recolección); se omite si está fuera de espacios protegidos
  - `nota` (opcional): dato para volver a verificar el punto (polígono y especie/FCC usados) o salvedades
- `estacionesAemet`: estaciones AEMET cercanas para datos meteorológicos
  - `id`: código de la estación AEMET
  - `nombre`: nombre de la estación
  - `altitud`: altitud de la estación
  - `distanciaKm`: distancia aproximada al centro de la zona
  - `lat`, `lon`: coordenadas de la estación (se regeneran con `node scripts/estaciones-aemet.mjs aplicar …`)
- `normas`: referencias a ids de normas regulatorias
- `avisos`: avisos especiales de la zona (permisos, restricciones)
- `fuentes`: referencias bibliográficas de la zona
  - `url`: URL de consulta
  - `titulo`: título de la fuente
  - `consultado`: fecha de consulta (YYYY-MM-DD)

### Notas sobre los datos actuales de `zonas.json`

- `comunidad`: `madrid-castilla-y-leon` (guadarrama y sierra-norte), `castilla-y-leon`, `castilla-la-mancha` o `euskadi`.
- `estacionesAemet` ya está rellena (tarea 18). Cada estación lleva `lat`/`lon` (inventario de AEMET) para que `aplicarContraste` elija, **para cada punto**, la más cercana de las de su zona (`distanciaKm` del inventario es la distancia al centro de la zona; la del punto se calcula al vuelo). `3104Y` Rascafría está en `guadarrama` y en `sierra-norte`.
- `altitud` de cada punto es la del terreno (API de elevación de Open-Meteo); la meteo se pide con `elevation=` igual a ese valor.
- Cómo se comprobó que cada punto está sobre bosque real del hábitat indicado (30/09/2026):
  - **Castilla y León** (guadarrama, sierra-norte, soria, gredos): capa `montes:gesfor_cyl_tipmas` de IDECyL, consulta por punto
    (`GetFeatureInfo`). `fuente` es la URL exacta de esa consulta, con la especie dominante y el porcentaje de ocupación.
  - **Castilla-La Mancha** (cuenca, guadalajara, toledo): Mapa Forestal de España 1:50.000 (MFE50) del MITECO, consulta punto en
    polígono sobre el shapefile provincial; `fuente` es la página de descarga del MFE50.
  - **Álava**: mapa forestal 2010 del Gobierno Vasco (`WMS_NEKAZARITZA`, capa de distribución de especies, o de usos del suelo
    para el pastizal); `fuente` es la URL exacta de la consulta.
  - Además, en todos los puntos: cubierta arbolada densa confirmada sobre la ortofoto PNOA y clase de SIOSE (IGN).
  - El MFE25 del MITECO (`wms.mapama.gob.es/sig/Biodiversidad/MFE`) devolvía un error del servidor ese día y su descarga
    tiene captcha; por eso se usaron las fuentes anteriores.
- **Espacios protegidos** (comprobación punto en polígono, 30/09/2026; campo `proteccion` de cada punto):
  - Parque Nacional de Guadarrama: zonificación del OAPN (`_fuentes/datos/oapn_zonificacion_prug_ppnn_EPSG4326_20260930.geojson`).
    Resultado: solo `guadarrama-valsain-pinar` cae dentro, en Zona de Uso Moderado (no Reserva). Ningún otro punto toca un Parque Nacional.
  - Resto de espacios: capa de Espacios Naturales Protegidos 2025 del MITECO (`https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/servicios/banco-datos-naturaleza/enp/Enp2025_geojson.zip`, EPSG:25830).
    Dentro: `guadarrama-valsain-pinar` y `guadarrama-navas-melojar` (Parque Natural Sierra Norte de Guadarrama), `gredos-arenal-resinero` y
    `gredos-villarejo-silvestre` (Parque Regional de la Sierra de Gredos), `alava-izki-marojal` (Parque Natural de Izki). Fuera: los otros 15 puntos.
    Distancias a los espacios más cercanos: Poveda de la Sierra 2,3 km del Parque Natural del Alto Tajo; Tierzo 3,8 km del Alto Tajo; los puntos de
    Cuenca a más de 2 km del Monumento Natural Palancares y Tierra Muerta.
  - El punto de Cuenca de la primera versión (40.0227, -1.9714) caía dentro del Monumento Natural Palancares y Tierra Muerta y se sustituyó por
    `cuenca-serrania-negral` (Palomera, fuera del monumento).
  - Normas leídas: PORN del Parque Natural Sierra Norte de Guadarrama (Decreto 4/2010, BOCyL 20/01/2010), art. 49.3: la recolección comercial de hongos
    requiere autorización. Sin verificar: PRUG de ese parque, su zonificación interna (la capa IDECyL `ps/ren_cyl_en_sg_porn` ya no existe), normas de
    recolección del Parque Regional de Gredos (PORN Decreto 36/1995, Ley 3/1996) y del Parque Natural de Izki (PRUG Decreto 73/2018). Los tres están
    marcados así en `proteccion`.
  - No se ha cruzado con Red Natura 2000 (ZEC/ZEPA), que por sí sola no suele prohibir la recolección.
- **Vertiente madrileña (tarea 18b, 30/09/2026)**: cinco puntos dentro de bosque real de montes de utilidad pública con licencia municipal:
  `guadarrama-morcuera-pinar` (MUP 151), `guadarrama-miraflores-pinar` (MUP 13), `guadarrama-canencia-pinar` (MUP 72), `sierra-norte-canencia-melojar`
  (MUP 73) y `sierra-norte-bustarviejo-melojar` (MUP 68). Especie dominante y FCC: MFE50 del MITECO, shapefile de la provincia 28
  (`https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/mfe50_descargas_comunidad_madrid.html`), punto en polígono.
  Montes de utilidad pública: WFS de la IDEM de la Comunidad de Madrid (`https://idem.comunidad.madrid/geoidem/ows`, capa `Zonas:IDEM_MA_MONTES_UP`; no hay
  capa pública de MUP con licencia, pero los números 13, 66-70, 72, 73, 140 y 151 existen ahí). Ortofoto PNOA (teselas z17 3x3). Se partió de las anclas de
  `docs/investigacion/04e-sitios-sierra-madrid.md` (puertos y pueblos de Wikipedia) y se movieron a bosque denso. Sin punto en ningún polígono `prohibido`
  (lo fija `tests/puntos-madrid.test.js`). Morcuera cae en el Parque Nacional (Uso Restringido, subzona C) y Miraflores en el Parque Regional de la Cuenca Alta
  del Manzanares: ambos con `proteccion`. No hay punto en Navacerrada (Parque Nacional sin ordenanza) ni abedular de Canencia (nadie lo sitúa).
  Los bbox de `guadarrama` y `sierra-norte` se repartieron sin solaparse, cortando en lon -3,77: `guadarrama` [-4.25, 40.65, -3.7701, 41.05] y `sierra-norte`
  [-3.77, 40.8, -3.3, 41.35], de modo que cada zona contiene todos sus puntos. El acotado SG-50004 (Berrocal de Huebra, lon -3,77 a -3,739) pasó de zona
  `guadarrama` a `sierra-norte` porque cae entero en ésta. Quedan fuera de su bbox, por su tamaño o por cruzar el corte: SG-50005 y PMSG-50001 (ya lo estaban)
  y la cola de 250 m de la URA-A `pnsg-ura-los-reajos-reajo-alto` (lon hasta -3,767), que no se puede meter sin volver a solapar los bbox. El recuento de GBIF de
  esas dos zonas se repitió con los bbox nuevos (`node scripts/gbif-presencia.mjs --zona=guadarrama,sierra-norte`, 30/09/2026; 52 recuentos cambiaron, 4 cambiaron
  de `presencia`: hydnum-repandum y amanita-caesarea bajan a orientativa en guadarrama, y en sierra-norte sube a confirmada imleria-badia, hydnum-repandum,
  agaricus-campestris y collybia-personata); ninguna otra zona cambió. `--zona=` sin valor conocido aborta.
- **Laguna de cobertura en Guadarrama**: no hay melojar de piedemonte verificado. El único melojar comprobado (`guadarrama-navas-melojar`) está a
  1472 m. En el piedemonte de Valsaín, IDECyL da rebollar a 1215 m (40.8684, -4.0332, Q. pyrenaica 55 % con pino silvestre 45 %) y 1104 m, pero la
  ortofoto muestra dehesa abierta junto a embalse, pista o urbanización, sin masa densa; se descartaron. Queda pendiente.
- Límites conocidos: el hábitat «pinar de rodeno» (Cuenca) y la «umbría» (Toledo) no se pueden comprobar con estas fuentes
  (no indican sustrato ni orientación). «Repoblación» en `sierra-norte-sepulveda-pinar` se aprecia en la ortofoto
  (filas de plantación), no en la capa forestal.

## data/especies.json

```json
{
  "version": 1,
  "especies": [
    {
      "id": "boletus-edulis",
      "nombre": "Boletus edulis",
      "autor": "Bull.",
      "sinonimos": [],
      "comunes": {
        "es": ["hongo blanco", "boleto"],
        "eu": ["onddo zuria"]
      },
      "categoria": "comestible",
      "rd30_2009": "A",
      "habitats": ["pinar-silvestre", "hayedo", "melojar"],
      "altitud": {
        "min": 900,
        "max": 1900,
        "verificado": false
      },
      "zonas": {
        "soria": {
          "presencia": "orientativa",
          "gbif": null,
          "fuente": "F7"
        }
      },
      "temporada": {
        "meses": [9, 10, 11],
        "tipo": "otono"
      },
      "identificacion": ["Poros blancos en el joven…"],
      "valor": "excelente",
      "precauciones": ["Desechar ejemplares viejos…"],
      "confusiones": [
        {
          "especie": "tylopilus-felleus",
          "riesgo": "bajo",
          "diferencias": "Poros rosados…"
        }
      ],
      "sindrome": null,
      "indice": {
        "topt": 13,
        "trango": [10, 15],
        "usarSuelo": false,
        "pmin": 30,
        "pfull": 90,
        "desfase": [7, 21],
        "helada": "baja",
        "confianza": "alta",
        "base": "evidencia",
        "analogo": null,
        "fuente": "docs/investigacion/03-fructificacion-datos.md#14"
      },
      "sinIndice": null,
      "fotos": [
        {
          "archivo": "img/especies/boletus-edulis-1.webp",
          "autor": "…",
          "licencia": "CC BY 4.0",
          "url": "https://www.inaturalist.org/observations/…"
        }
      ],
      "fuentes": [
        {
          "id": "F2",
          "url": "https://…",
          "titulo": "Fungipedia",
          "consultado": "2026-09-30"
        }
      ]
    }
  ],
  "sindromes": [
    {
      "id": "faloidiano",
      "nombre": "Síndrome faloidiano",
      "latencia": "6–24 h (normalmente más de 6 h)",
      "gravedad": "mortal",
      "texto": "…",
      "fuentes": [
        {
          "url": "…",
          "consultado": "…"
        }
      ]
    }
  ]
}
```

**Campos de especie:**
- `id`: identificador único (slug)
- `nombre`: nombre científico
- `autor`: autor de la descripción taxonómica
- `sinonimos`: otros nombres científicos aceptados
- `comunes`: nombres comunes por idioma (es, eu, etc.)
- `categoria`: comestible|comestible-precaucion|no-recomendada|toxica|mortal
- `rd30_2009`: parte del anexo del RD 30/2009 que cita el informe: `A`, `B`, `C`, `D` o `null` (si el informe no la cita). **Valores usados; no se comprueban.**
- `habitats`: hábitats donde fructifica
- `altitud`: rango de altitud (min, max, verificado) o `null` si el informe no da rango. Los rangos del informe son orientativos (`verificado: false`).
- `zonas`: presencia por zona {"zoneId": {presencia, gbif, fuente}}
  - `presencia`: confirmada|orientativa|sin-registros
  - `gbif`: nº de registros GBIF con coordenadas (occurrenceStatus=PRESENT, country=ES) dentro del bbox de la zona; `null` si no se consultó
  - `fuente`: URL de la búsqueda GBIF (sin `limit=0`); `consultado`: fecha de la consulta
  - `fuenteInvestigacion`: fuente del informe previa a GBIF (id o ruta), si la había
  - `taxonGbif`: taxón realmente buscado en GBIF, solo si difiere de `nombre` (p. ej. `Lepista nuda` para `Collybia nuda`, cuyo nombre aceptado actual aún no está en el backbone de GBIF)
  - `nota`: aclaración del recuento (p. ej. cuando solo se cuenta un miembro de un grupo de especies)
- `temporada`: {meses: [1-12], tipo}. `tipo` es `otono`, `primavera` o `verano` (**lo comprueba el validador**); si el informe no da temporada, `meses: []` y `tipo: null`. Cuando el informe dice «primavera»/«otoño»/«verano y otoño» sin meses, se usan marzo–mayo, septiembre–noviembre, etc. (convención, anotada en `notas`).
- `identificacion`: características diagnósticas
- `valor`: calidad culinaria, texto del informe (`excelente`, `bueno`, `mediocre o bueno`, `limitado`…) o `null` en tóxicas. **Texto libre: no se comprueba.**
- `precauciones`: advertencias especiales (solo avisos; la interfaz las pinta como aviso. En `comestible-precaucion` y `no-recomendada`, `precauciones[0]` es el texto del banner rojo). Lo descriptivo (hábitat, cómo crece, situación legal) va en `notas`
- `confusiones`: especies confundibles con ficha propia [{especie, riesgo, diferencias}]; `especie` debe ser el id de una ficha existente (**lo comprueba el validador**)
  - `riesgo`: `bajo`, `medio`, `alto` o `mortal` (**valores usados; no se comprueban**, los fija `tests/especies-datos.test.js`). Es el peor de los dos de la pareja, donde el nivel de cada especie es el mayor entre el de su síndrome (`mortal`→`mortal`, `grave`→`alto`, `moderada`→`medio`, `leve`→`bajo`) y el de su categoría (`mortal`→`mortal`, `toxica` y `no-recomendada`→`medio`, `comestible*`→`bajo`). Excepción: toda confusión con *Tylopilus felleus* (*B. edulis*, *B. pinophilus*, *B. reticulatus*) se fuerza a `bajo` (amargo, sin síndrome).
- `confusionesMenores` (opcional): confusiones que el informe cita sin ficha propia [{nombre, riesgo, diferencias}].
- `sinConfusiones` (opcional): texto literal del informe cuando declara que no hay confusión peligrosa.
- `notas` (opcional): avisos del informe sin campo propio, incluidos los `[NO VERIFICADO]`.
- `sindrome`: síndrome tóxico si aplica (id de `sindromes[]`; **lo comprueba el validador**: debe existir, y toda `toxica` o `mortal` debe llevarlo)
- `indice`: índice de fructificación (solo comestibles)
  - `topt`: temperatura óptima (°C)
  - `trango`: rango de temperatura [min, max]
  - `usarSuelo`: usar modelo del suelo (bool)
  - `pmin`, `pfull`: precipitación mínima y de saturación (mm)
  - `desfase`: lag de precipitación [min, max] días
  - `helada`: probabilidad de helada nula|baja|media|alta
  - `confianza`: alta|media|baja
  - `base`: `evidencia`, `cualitativo` o `heuristica` (**lo comprueba el validador**). Va con `confianza`: `alta`/`evidencia` (la tabla 1.4 cita E1, E2 o E14), `media`/`cualitativo` (cita §1.2), `baja`/`heuristica` (HEURÍSTICA o copiada de un análogo)
  - `analogo`: id de la especie cuyos parámetros térmicos y de lluvia se copian (`null` si la especie tiene fila propia); la temporada nunca se copia
  - `fuente`: referencia a investigación
- `sinIndice`: motivo de no llevar índice (hipogeo, etc.)
- `fotos`: fotografías [{archivo, autor, licencia, url, taxonFoto?, nota?}]
  - `licencia`: CC0, PD, CC BY, CC BY-SA (sin NC ni ND)
  - `taxonFoto` (opcional): taxón realmente fotografiado cuando no coincide con `nombre` de la ficha (fichas de género, sinónimos). La interfaz debe mostrarlo junto a la foto. Ej.: morchella → "Morchella esculenta"; tricholoma-flavovirens → "Tricholoma equestre (mismo taxón en iNaturalist)" (comparte archivo con tricholoma-equestre).
  - `nota` (opcional): aviso libre sobre la foto.
- `fuentes`: referencias bibliográficas [{id, url, titulo, consultado}] (**url y consultado obligatorios**). `urlVerificada: false` marca las fichas de Fungipedia que no existen con el patrón de URL del informe (comprobado el 2026-09-30; el informe las cita igualmente).
- `zonas[id].verificado`: `false` si el informe marca la presencia en esa zona como `[NO VERIFICADO]` o si sale solo del hábitat; `presencia` es siempre `orientativa` hasta confirmarla con GBIF (tarea 7).

**Campos de síndrome:**
- `id`: identificador único
- `nombre`: nombre del síndrome
- `latencia`: período entre ingesta y síntomas (texto; `null` si el informe no la da)
- `gravedad`: `moderada`, `grave` o `mortal` (**valores usados; no se comprueban**); criterio: lo peor que dice el informe del síndrome
- `texto`: descripción de síntomas
- `fuentes`: referencias médicas [{id, url, titulo, consultado}]; **al menos una, con url y consultado (lo comprueba el validador)**. `id` único en `sindromes[]`.
- `verificado: false` (opcional): el informe marca la latencia como no verificada.

## data/normativa.json

```json
{
  "version": 1,
  "normas": [
    {
      "id": "cyl-decreto-31-2017",
      "titulo": "Decreto 31/2017 …",
      "tipo": "decreto",
      "ambito": {
        "comunidad": "castilla-y-leon",
        "zonas": ["guadarrama", "sierra-norte", "soria", "gredos"]
      },
      "url": "https://…",
      "vigente": true,
      "resumen": ["…"],
      "permiso": {
        "obligatorio": true,
        "donde": "https://micologiacyl.es/…",
        "tarifas": [
          {
            "nombre": "Recreativo foráneo 2 días",
            "precio": 10,
            "cupoKgDia": 5,
            "anio": 2026,
            "verificado": true,
            "fuente": "https://…"
          }
        ]
      },
      "cupoKgDia": 5,
      "horario": "…",
      "prohibiciones": ["…"],
      "sanciones": "…",
      "revisado": "2026-09-30",
      "verificado": true,
      "notas": ""
    }
  ]
}
```

**Campos:**
- `id`: identificador único (slug)
- `titulo`: título completo de la norma
- `tipo`: ejemplos: decreto, orden, circular, ley (texto libre; no se comprueba)
- `ambito`: {comunidad, zonas} ámbito geográfico de aplicación
- `url`: URL de la norma oficial
- `vigente`: bool, si está en vigor
- `resumen`: lista de puntos clave
- `permiso`: información sobre permisos
  - `obligatorio`: bool, si es obligatorio
  - `donde`: URL para tramitar permisos
  - `tarifas`: [tarifa], lista de tarifas actuales
    - `nombre`: descripción de la tarifa
    - `precio`: precio en euros
    - `cupoKgDia`: cupo de kilos por día
    - `anio`: año de validez
    - `verificado`: bool, si se ha comprobado
    - `fuente`: URL de verificación
- `cupoKgDia`: cupo general en kg/día
- `horario`: restricción horaria de búsqueda
- `prohibiciones`: especies prohibidas
- `sanciones`: descripción de sanciones
- `revisado`: fecha de última revisión (YYYY-MM-DD)
- `verificado`: bool, si la información está verificada
- `notas`: anotaciones adicionales

## data/cotos.geojson

Formato GeoJSON FeatureCollection. Cada Feature es un Polygon o MultiPolygon:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lon, lat], [lon, lat], ...]]
      },
      "properties": {
        "id": "SO-50001",
        "nombre": "…",
        "tipo": "acotado",
        "precision": "oficial",
        "zona": "soria",
        "normas": ["cyl-decreto-31-2017"],
        "permisoUrl": "https://…",
        "regimenConfirmado": true,
        "fuente": "https://idecyl.jcyl.es/…",
        "revisado": "2026-09-30"
      }
    }
  ]
}
```

**Campos de propiedades:**
- `id`: identificador único del coto
- `nombre`: nombre del coto o zona acotada
- `tipo`: acotado|parque-micologico|regulado|prohibido
- `precision`: oficial|derivado|aproximado (calidad del límite)
- `zona`: referencia a zona.id
- `normas`: referencias a norma.id aplicables
- `permisoUrl`: URL para gestionar permisos en este coto
- `regimenConfirmado`: bool, si el régimen se ha verificado
- `fuente`: URL de origen (catastro, IGN, etc.)
- `revisado`: fecha de última revisión (YYYY-MM-DD)

### Nota sobre el bbox de Álava (2026-09-30)

El bbox de `alava` se ensanchó de `lonMin -3.0` a `-3.25` para que contenga el coto de la Sierra de Árcena (lon -3.19…-3.06). Los recuentos GBIF de Álava en `data/especies.json` se calcularon con el bbox antiguo (`-3.0`) y no se han repetido: `scripts/gbif-presencia.mjs` no permite limitarse a una zona.

### Nota sobre el Parque Micológico de Gorbeialdea (2026-09-30)

`alava-gorbeia-altube` (tipo `parque-micologico`, precisión `derivado`) dibuja el MUP 734 «Altube y Gorbeia» del catálogo del MITECO. El plano oficial del parque (https://www.gorbeiamikologia.eus/es/micoturismo/) rotula «OMP / MUP 734 Altube» y traza el borde rojo del parque sobre ese monte, con pequeños enclaves que no se recortan. La norma es `alava-gorbeia-parque-micologico` (ordenanza de Zuia, BOTHA n.º 95, 14/08/2023; tarifas 2026 de la web oficial). La web oficial es ambigua sobre los municipios: la página «Parque Micológico» (https://www.gorbeiamikologia.eus/es/parque-micologico/) dice que actualmente lo forma Zuia, y la portada (https://www.gorbeiamikologia.eus/es/) dice que en 2022 Urkabustaiz, Zigoitia y Zuia pusieron en marcha el proyecto. La ordenanza leída es solo la de Zuia y el polígono es solo el MUP 734; para Urkabustaiz y Zigoitia la app dice «la web oficial se contradice: confirma con el ayuntamiento o con el parque antes de recoger». El bbox de `alava` llega a latMax 43.06 para contener el polígono (sin solaparse con otras zonas). El polígono se añadió a `data/cotos.geojson` a mano (no se regeneró con `scripts/cotos/unir.mjs`, que pisaría ajustes posteriores de otros cotos); su origen está en `data/fuentes-cotos/alava-montes.json`, clave `gorbeia-altube`.

## data/sitios.json (sitios conocidos)

Lugares donde buscar, recogidos de blogs, prensa y webs oficiales (investigación 04a–04c en `docs/investigacion/`). Nunca se inventan coordenadas: `lat` y `lon` son `null` salvo que una fuente las dé (hoy ninguna).

```json
{ "version": 1, "sitios": [ {
  "id": "valsain-matas-pinar", "zona": "guadarrama", "nombre": "…", "municipio": "…",
  "tipo": "sitio | ruta | no-ir",
  "especies": ["boletus-edulis"], "habitat": ["pinar-silvestre"], "epoca": [9, 10, 11],
  "consejo": "Texto breve con palabras propias.",
  "legal": { "estado": "permiso | libre | prohibido | privado | sin-confirmar", "normas": ["id-de-normativa"], "texto": "…" },
  "lat": null, "lon": null,
  "fuentes": [ { "url": "https://…", "titulo": "…", "fecha": "2022-10-24 | null", "consultado": "2026-09-30" } ],
  "nFuentes": 2, "confianza": "alta | media | baja", "verificado": false, "notas": ""
} ] }
```

- `confianza` casa con `nFuentes` (fuentes independientes, no las que se listan): alta = 3 o más, media = 2, baja = 1 o menos.
- `tipo: "no-ir"`: lugares prohibidos, privados o sin regla confirmada; se muestran en un recuadro rojo. Un sitio que no es `no-ir` no puede ser `prohibido` ni `privado` (lo valida `scripts/validar-datos.mjs`).
- Si una fuente contradice la norma oficial, `legal` sigue la norma y la contradicción va en `notas`.
- Si algún día hay `lat`/`lon`, el validador comprueba que no caen dentro de un polígono `prohibido` de `cotos.geojson`.

### `trucos` en `data/especies.json`

Solo las comestibles. `[{ "texto", "tipo": "orientacion | altitud | microhabitat | indicador | tiempo | recoleccion | creencia", "fuentes": [{ "url", "fecha", "consultado" }], "confianza": "alta | media | baja", "cifrasOrientativas": true }]`. Las cifras de 04d (días, metros, °C) se leyeron con resúmenes automáticos: llevan `cifrasOrientativas: true` y la interfaz muestra «cifras orientativas». `creencia` se muestra como «Creencia popular (sin base)».

## Meteorología (Open-Meteo)

Comprobado en vivo el 2026-09-30: con el modelo por defecto (best_match) el suelo horario (`soil_moisture_0_to_7cm`, `soil_temperature_0_to_7cm`) llega relleno (1.680 valores por punto en 70 días), y la humedad de suelo del archivo histórico coincide con la del forecast (sesgo medio < 0,001 m³/m³ en 52 días solapados; rango histórico 0,093–0,429). No se usa `models=ecmwf_ifs` en la serie principal ni en el archivo. `models=` solo se usa en la llamada de contraste de lluvia (`urlModelos`).

### Contraste de modelos: horizonte común

Comprobado en vivo el 2026-09-30 con `models=ecmwf_ifs,icon_seamless,meteofrance_seamless&forecast_days=8`: los modelos no llegan igual de lejos. ECMWF devuelve los 8 días, ICON (`icon_seamless`) devuelve `null` desde el día +7 y Météo-France (`meteofrance_seamless`) desde el +4 (alcance ~4 días). Exigir 7 días completos por modelo dejaba solo a ECMWF y el contraste nunca aparecía.

Regla de `dispersion()`: para cada modelo se cuenta el alcance (días consecutivos con valor desde hoy+1, 0–7). El horizonte `h` es el mayor valor entre 3 y 7 al que llegan al menos 2 modelos; se compara la lluvia acumulada de hoy+1…hoy+h solo entre los modelos con alcance ≥ h, y los demás quedan en `excluidos`. Si menos de 2 modelos llegan a 3 días, no hay contraste (`horizonte: null`). La incertidumbre se mantiene: rango > 0,5·media y rango > 10 mm.

### Peticiones y su peso (estimación, 2026-09-30)

Open-Meteo cuenta como varias llamadas una petición de más de 10 variables o de más de 2 semanas por punto, con fracciones: «Requests for data covering more than 10 weather variables or extending over a period of more than 2 weeks for a single location are considered multiple API calls» ([open-meteo.com/en/pricing](https://open-meteo.com/en/pricing), consultado el 2026-09-30). Estimación usada aquí: `puntos × max(1, variables/10) × max(1, días/14)`, con los **26 puntos** actuales. Límites gratuitos: 600 llamadas/min, 5.000/h, 10.000/día. Es una estimación (Open-Meteo no publica la fórmula exacta para varios puntos).

| Petición | Qué pide | Cuándo | Peso estimado |
|---|---|---|---|
| Serie principal (`urlPrincipal`) | 7 diarias + 2 horarias, 70 días | como mucho cada 3 h | 26 × 1 × 5 ≈ **130** |
| Contraste de modelos (`urlModelos`) | lluvia de 3 modelos, 8 días | con la principal | 26 × 1 × 1 ≈ **26** |
| Lluvia desde el 1-ago (`urlLluviaArchivo`) | solo `precipitation_sum`, del 1-ago de la temporada al día antes de la serie | hace falta de octubre a julio (cuando la serie de 60 días empieza después del 1-ago), una vez al día (caché por día); si falta, se reintenta a los 20 min; nada en agosto y septiembre | crece con los días: 1-oct: 26 × 1 × 1 = **26**; 31-dic ≈ 26 × 6,6 ≈ **170**; finales de julio (1-ago del año anterior a ~31-may, ~304 días) ≈ 26 × 22 ≈ **570** |
| Lluvia desde el 1-ago de respaldo (`urlLluviaPrevision`) | lo mismo al forecast (guarda unos 2 meses atrás) | solo si el archivo falla o no llega | como la anterior, solo con los puntos que falten |
| Climatología del suelo (`urlClimatologia`) | solo `soil_moisture_0_to_7cm_mean`, 2 años hasta el día antes de la serie | una vez cada 30 días (clave: solo el conjunto de puntos), siempre después de la serie principal; si falla, espera creciente guardada en el almacén (20 min → 1 h → 6 h → 24 h, se reinicia con un éxito) y no se pide ni en el refresco de 3 h mientras dura | 26 × 1 × 52 ≈ **1.360** |

Antes (hasta la v1) la climatología pedía 2 variables desde el 1-ene-2023, ≈ 26 × 1 × 93 ≈ **2.430** llamadas, en cada refresco con una clave que cambiaba cada día (causa probable de los 429). La climatología solo alimenta `fS` (humedad del suelo): si no llega, el índice se calcula sin ese factor y lo explica. La lluvia desde el 1-ago, en cambio, es imprescindible para las especies de otoño desde el 1-oct: si no llega ni del archivo ni del forecast, esas especies salen «sin datos» y la zona, «sin datos» o «N especies sin datos suficientes», nunca con una nota inventada.

Límites de tiempo: 15 s la serie principal y los modelos, 20 s la lluvia desde el 1-ago y 45 s la climatología. La climatología y la lluvia desde el 1-ago se piden después de la serie principal, no a la vez, para no competir con ella. Ojo: la climatología (~1.360) sigue pasando del límite por minuto si Open-Meteo lo aplica a una sola petición; como es una vez al mes y solo afecta a `fS`, se acepta; si da 429, entra en la espera creciente y, mientras, el índice va sin humedad del suelo.

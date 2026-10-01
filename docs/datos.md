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

- `comunidad`: `madrid-castilla-y-leon` (guadarrama y sierra-norte), `castilla-y-leon`, `castilla-la-mancha`, `euskadi` o `extremadura`.
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
- **Zonas nuevas `burgos`, `merindades` y `extremadura` (tarea 19, 30/09/2026)**, a partir de `docs/investigacion/07a-zona-burgos.md` y
  `07b-zona-extremadura.md`. Bbox sin solapes (lo fija `tests/puntos-madrid.test.js`):
  - `soria` se recortó a `[-3.04, 41.7, -2.5, 42.15]` (sus 3 puntos siguen dentro) y `burgos` es `[-3.68, 41.7, -3.0401, 42.5]` (Pinares, Demanda y
    Montes de Oca). Las Merindades no caben en `burgos` sin solapar con `alava` (lon ≥ -3,25, lat ≤ 43,06): van en la zona `merindades`
    `[-4.0, 42.6, -3.2501, 43.25]`. El este del Valle de Losa, San Zadornil y Bozoó quedan geográficamente dentro del bbox de `alava`; sus acotados
    llevan `zona: merindades` igualmente. Neila y Regumiel (Burgos) caen al este de -3,04, en el bbox de `soria`: límite del esquema de un bbox por zona.
  - `extremadura` es una sola zona, que empezó como `[-7.45, 39.3, -5.3001, 40.35]` (ampliada al sur en la segunda pasada, ver más abajo). Para que el castañar de las Villuercas (lon -5,35) cupiera sin solapar,
    `gredos` pasó de lon mín. -5,4 a **-5,3** (sus puntos están al este de -5,08; la franja quitada es sobre todo de Cáceres). Los recuentos GBIF de
    `soria` y `gredos` se repitieron con los bbox nuevos.
  - Puntos de Burgos (P1 a P5 de 07a): comprobados de nuevo el 30/09/2026 con IDECyL (`gesfor_cyl_tipmas` y `montes_cyl_mup_vw`), la capa oficial de
    zonas reguladas, la ENP 2025, la ortofoto PNOA y la elevación de Open-Meteo; coinciden con 07a. No se añadió la alternativa P2b (Neila, 1.705 m).
  - Puntos de Extremadura (4 de 07b): MFE50 de Cáceres (`mfe50_10`), ENP 2025, catálogo de MUP del IEPF y ortofoto PNOA. Tres se movieron dentro de su
    mismo polígono del MFE50: Villuercas 90 m (caía en una franja rocosa), Hervás 120 m (borde de un claro) y San Martín de Trevejo 170 m, porque el
    punto de 07b quedaba a 0,7 m del Corredor Ecocultural «Camino de Trevejo a Jálama» (espacio protegido de la ENP 2025). Ninguno cae en un espacio
    protegido ni en un MUP; el de Salorino es, casi seguro, finca privada. Las notas de cada punto guardan el polígono y la especie usados.
  - Estaciones AEMET: `burgos` usa `2298` Palacios de la Sierra (ya estaba en la lista blanca; sigue también en `soria`, porque es la más cercana a
    Navaleno). Las demás que proponen 07a y 07b (`2302N` Monterrubio; `3504X` Hervás, `4245X` Guadalupe, `3536X` Hoyos, `3576X` Valencia de Alcántara)
    **no están dadas de alta**: hay que meterlas en `supabase/functions/aemet/estaciones.json`, redesplegar la función, pasar la sonda y después
    añadirlas a `zonas.json`, en ese orden (la app pide todas las estaciones en una sola llamada y la función devuelve 403 a toda la llamada si una no
    está en la lista blanca). `merindades` no tiene estación útil en la misma vertiente (Medina de Pomar, 9051, está 450 m más baja): va sin AEMET.
  - Cotos de Burgos: los 69 polígonos `BU-`/`PMBU-` de la capa oficial se asignan a `burgos` o `merindades` (por la mayoría de vértices al sur o al norte
    de lat 42,55), salvo `BU-50021` (Treviño), que sigue en `alava`. Los nombres son los del portal micologiacyl.es (07a §2.2). Los cuatro `PMBU` no tienen
    nombre oficial: su relación con los acotados de Micocyl (Montes de Oca, Demanda-San Millán, Valle de Mena y Fresneda) es una inferencia por los MUP
    que contienen; llevan `regimenConfirmado: false` y la inferencia en `nota`. Se añadieron a mano (sin `scripts/cotos/unir.mjs`); los nombres de las
    claves `BU-` también están en `data/fuentes-cotos/cyl-nombres.json` para una futura regeneración.
  - Cotos de Extremadura: 17 montes de utilidad pública de 07b §1.3 dibujados con el catálogo del IEPF (tipo `regulado`, precisión `derivado`, «monte
    público: comprobar si exige licencia»), el MUP «Dehesa Boyal» de Mirabel como `acotado` (el número 132 no viene en la capa: se deduce por nombre y
    término) y el Parque Nacional de Monfragüe como `prohibido` (límite de la ENP 2025; el PRUG solo permite setas con autorización en un monte de
    Serradilla). No se dibujó la Dehesa Boyal de Piornal: no se pudo identificar con seguridad en la capa.
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

## Rejilla fina: del MFE50 al hábitat

Fuente: Mapa Forestal de España 1:50.000 (MFE50), MITECO, por provincia (detalles, licencia y campos en
`docs/investigacion/08-rejilla-fuentes.md`). Código: `scripts/rejilla/mfe-habitat.mjs`.

La tabla va por **nombre científico**, no por código: el código del MFE50 (`SP1`, `SP2`, códigos del IFN) se traduce
con `scripts/rejilla/mfe-diccionario.json`. Se busca el nombre exacto, luego género + especie (sin subespecie ni
variedad) y luego «Género spp.» (así *Betula alba* y *B. pendula* dan `abedular`, y *Populus alba*, *P. nigra* y
*P. tremula*, `chopera`). Un nombre solo de género («Quercus», «Juniperus spp.») o un grupo («Otros quercus»,
«Mezcla de coníferas») no da hábitat.

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

Tipos de estructura (`TIPESTR`, en `CONFIG.mfe.tipos`; justificación en el apartado D1 del informe 08):
- Arbolado: 1 Bosque, 2 Bosque Plantación, 3 Dehesa, 11 Riberas, 12 Bosquetes.
- Herbazal o pastizal: 9 Herbazal, 24 Prado con sebes, 34 Prado, 35 Pastizal-Matorral.
- Matorral: 8 Matorral.
- Todo lo demás cuenta como «otro» y no da hábitat.

Reglas (criterios propios, no de la fuente):
- **Arbolado:** hace falta una fracción de cabida cubierta arbórea (`TFCCARB`) de al menos el 20 % (`FCC_MINIMA`).
  Es el mismo corte que usa el MFE50 entre «Monte arbolado» y «Monte con arbolado ralo» (campo `USOS_SUELO`, en las
  11 provincias: el arbolado ralo va del 10 % al 15 % y el disperso del 5 % al 9 %; el monte arbolado empieza en el
  20 %, salvo 139 teselas de riberas, `TIPESTR` 11, de 75.372). Deja fuera las dehesas con menos del 20 %: en Badajoz,
  56.390 ha de `TIPESTR` 3 (suma de `Shape_Area` de la provincia entera, sin recortar a la zona). Sin cabida cubierta:
  sin monte (nunca se colorea a ciegas). `SP1`/`SP2` = 0 significa «sin especie» y no cuenta.
- **Qué especie manda en el arbolado:** de las dos dominantes (`SP1`, `SP2`), la primera cuyo hábitat tenga alguna
  seta con índice en `data/especies.json`; la segunda solo puede ganar si ocupa al menos 3 décimas de la tesela
  (`O2` ≥ `OCUPACION_MINIMA_SEGUNDA`; `O1`/`O2` son el «grado de presencia» de cada especie en la tesela, de 0 a 10,
  según la tabla 9 del documentador del IFN3). Si ninguna cumple, la primera de las dos que esté en la tabla. Así un
  sabinar con 4 décimas de pino negral cuenta como pinar negral (el sabinar no tiene setas con índice y el pinar
  negral sí), pero uno con 1 décima de pino sigue siendo sabinar. El conjunto de hábitats con índice lo calcula el
  generador: `new Set(especies.filter((s) => s.indice).flatMap((s) => s.habitats))`.
- **Mosaicos fuera:** los `TIPESTR` 25 (arbolado sobre cultivo) y 26 (arbolado sobre forestal desarbolado) no cuentan
  como arbolado aunque traigan especie y cabida cubierta, por prudencia: el arbolado está salpicado entre cultivos o
  raso y la celda no sería de monte.
- **Herbazal o pastizal:** `pastizal-montana` desde 1.000 m (`ALTITUD_PASTIZAL_MONTANA`) y `prado` por debajo. Sin
  altitud: sin monte.
- **Matorral:** `jaral` solo si su especie es una jara de `CONFIG.mfe.matorralJaral`. El MFE50 no detalla el matorral
  (`SP1` = 0 en 25.581 de las 25.582 teselas de matorral de las 11 provincias), así que esa lista está vacía y **el
  jaral no sale en la rejilla**.
- Sin hábitat (código 0): *Pinus halepensis*, *P. uncinata* y demás pinos, abetos, eucaliptos, *Quercus pubescens*,
  *Q. lusitanica*, sabinas y enebros que no son *J. thurifera*, alisos, fresnos, sauces, mezclas, cultivos,
  improductivo y agua. `data/especies.json` no tiene un hábitat que les corresponda, así que se prefiere dejar la
  celda sin monte a colorearla con un bosque que no es. **Hueco conocido:** *Pinus radiata* (pino insigne), con
  13.968 ha en Álava como especie dominante (suma de `Shape_Area` de las teselas con `SP1` = 28), queda sin monte.
- Criterio general: ante la duda, sin monte. Colorear un monte donde no está el bosque del que viven las setas manda a
  la gente al sitio equivocado; dejarlo en blanco solo pierde una celda.

## Ajuste por orientación (orientativo)

`js/rejilla/orientacion.js` multiplica la lluvia de 26 días (`P26`) según la orientación de la ladera (umbría N, NE,
NO; solana S, SE, SO) **antes** de calcular `fW`, y el efecto en `fW` se acota al ±15 % del `fW` sin ajuste
(`indiceDesdeAgregados`, `supabase/functions/_shared/indice.js`):

    fW0  = (P26 − pmin) / (pfull − pmin)              sin ajuste
    fWef = (P26 × ajuste − pmin) / (pfull − pmin)     lluvia efectiva
    fW   = clamp01(min(max(fWef, fW0 × 0,85), fW0 × 1,15))

El tope 0,85–1,15 es `TOPE_AJUSTE_HUMEDAD` del mismo módulo; `AJUSTE_ORIENTACION` toma de ahí sus extremos (N y S).
Así es simétrico: con lluvia abundante las dos laderas llegan a `fW = 1`, con lluvia 0 las dos dan 0, y con ajuste 1
la nota es la de siempre. Con el peso de `fW` (0,35), la nota de una ladera se aparta como mucho un **+5,0 % / −5,5 %**
de la neutra (1,15^0,35 y 0,85^0,35); si falta la climatología (`fS` sin dato, el peso de `fW` sube a 0,44),
+6,3 % / −6,9 %. (Historia: hasta el 2026-10-01 el plan decía «multiplica `fW`»; el ruling de la tarea 7 lo cambió a
«multiplica la lluvia», porque multiplicar `fW` no sumaba en umbría cuando ya estaba en 1, y la ronda 2 del mismo día
añadió el tope, porque sin él la solana podía dejar `fW` en 0 junto a `pmin` y mover la nota hasta 47 puntos.) **Orientativo:** no hay calibración con datos de estas zonas; la hoja del
mapa lo marca así cuando el ajuste no es 1. Criterio y búsqueda: `docs/investigacion/08-rejilla-fuentes.md`, apartado D8.

| Orientación | Ajuste de la lluvia de 26 días | Fuente |
|---|---|---|
| Llano | 1 | neutro por definición (celdas con orientación 0) |
| N | 1,15 | Bonet et al. 2008, *Annals of Forest Science* 65: 206, https://hal.science/hal-00884160v1 (punto medio de 2,54 = 1,77, recortado al tope 1,15) |
| NE | 1,075 | regla del plan (mitad del efecto de N) |
| E | 1 | neutro por definición |
| SE | 0,925 | regla del plan (mitad del efecto de S) |
| S | 0,85 | Bonet et al. 2008, https://hal.science/hal-00884160v1 (punto medio de 0,39 = 0,70, recortado al tope 0,85) |
| SO | 0,925 | regla del plan (mitad del efecto de S) |
| O | 1 | neutro por definición |
| NO | 1,075 | regla del plan (mitad del efecto de N) |

La razón publicada es de **producción total de setas** en pinares de pino silvestre del Prepirineo (24 parcelas, 3
años), no de humedad del suelo; el ajuste se queda en el tope, muy por debajo del efecto del artículo. En una cuenca
del Prepirineo (Estaña, 2005-2006), la humedad superficial no mostró tendencia por orientación en otoño, con el suelo
muy húmedo (López-Vicente et al. 2009, apartado D8); no es un resultado general, pero va en la misma línea: con lluvia
abundante el ajuste no cambia nada, porque las dos laderas llegan a `fW = 1`.

**Efecto real en la nota** (cuenta sobre la fórmula, con los demás factores a 1): *Boletus edulis* con 60 mm pasa de
78 a 82 en umbría y a 74 en solana; con 80 mm, de 94 a 98 y a 89. El tope se cumple también junto al mínimo de lluvia
(`pmin`), donde sin él la solana dejaba `fW` en 0.

## Formato de la rejilla (data/rejilla/)

- `indice.json`: lista de archivos (`zona`, `archivo`, `col0`, `fila0`, `ancho`, `alto`, `bytes`), fuentes y fecha.
- `<zona>.bin` o `<zona>-<n>.bin`: formato `SETR` v1 (`js/rejilla/formato.js`). Celdas de 250 m de Web Mercator
  (EPSG:3857; en estas latitudes, unos 190 m sobre el terreno) alineadas con la malla de teselas; columna y fila
  globales desde la esquina noroeste del mundo. Una zona se parte en bandas de filas si pasa de 300 KB.
- Byte de hábitat de cada celda:
  - bits 0 a 4: código del hábitat (posición en `cabecera.habitats` + 1; 0 = sin monte);
  - bit 5 (`FUERA_PROVINCIAS`, 0x20): el monte es de una **provincia vecina** que entra en el bbox de la zona pero no
    está en `zona.provincias`. Su normativa no está revisada y la hoja del mapa lo avisa. Solo puede ir con un código
    de hábitat;
  - bit 6: reservado, siempre 0 (si no, el decodificador rechaza el archivo);
  - bit 7 (`PROHIBIDO`): celda en zona prohibida, sin hábitat.
- `gruesa.json`: celdas gruesas con monte (id `zona:col:fila` en pasos de `pasos[zona]` grados desde 10° O y 35° N),
  su centro (donde se pide la meteo) y su altitud de referencia (media de sus celdas finas con monte, también las de
  provincias vecinas). La Edge Function lleva una copia idéntica (`supabase/functions/rejilla/gruesa.json`, una prueba
  lo comprueba).
- Orientación por el método de Horn sobre la rejilla de 250 m, con el lado de celda en metros de suelo según la latitud
  de cada fila; «llano» si la pendiente es menor del 5 % o si falta alguno de los 8 vecinos (borde o sin dato). Tramos de
  pendiente: menos del 5 %, del 5 al 15 %, del 15 al 30 % y 30 % o más (criterio propio).
- Prohibido: una celda lleva la marca y se queda sin hábitat si su centro **o cualquiera de sus 4 esquinas** cae en un
  polígono `prohibido` de `data/cotos.geojson` (criterio conservador: no se colorean celdas de borde).
  `tests/rejilla-datos.test.js` lo comprueba sobre los archivos generados.

**Pintado en el mapa** (`js/rejilla/pintor.js`, `js/mapa/capa-rejilla.js`). Cada archivo se colorea en una imagen de
`ancho × alto` píxeles (1 celda = 1 píxel) que la capa dibuja escalada sin suavizado. Solo llevan color las celdas con
código de hábitat y sin el bit `PROHIBIDO`; el bit `FUERA_PROVINCIAS` no cambia el color (la marca la pone la hoja).
Celda gruesa sin datos en el índice, sin altitud de referencia o celda fina fuera de toda celda gruesa: gris
(`#7d827e`), nunca un color de nivel. Hábitat sin especies en temporada (o fuera del chip elegido): transparente. Por
debajo de `ZOOM_MIN_FINA` (9) se pinta una nota por celda gruesa (la mejor de sus hábitats a su altitud media). La capa
lleva la atribución del MFE50 y del MDT con los textos de `scripts/rejilla/config.mjs`.

**Medida del pintado** (`node scripts/rejilla/medir-pintado.mjs`, 2026-10-01, Node 24.14 en el portátil de desarrollo):
el archivo más grande, `extremadura-1.bin` (959 × 276 celdas, unas 99.900 con monte y 21.200 combinaciones distintas de
celda gruesa, hábitat, altitud y orientación), tarda unos 160 ms en `notasDeArchivo` + `colorear` (tres ejecuciones:
159, 160 y 163 ms). Por 4 (la ralentización de CPU con la que Lighthouse simula un móvil medio) son unos 640 ms, más
de los 200 ms del criterio: **el cálculo va en un Web Worker** (`USAR_TRABAJADOR = true` en
`js/rejilla/notas-async.js`). Es una estimación (Node × 4), no una medida en un móvil real. Si el Worker falla
(no carga, error, mensaje ilegible o 20 s sin contestar), se descarta para la sesión y se calcula en el hilo principal.

**Cómo se genera.**

1. `node scripts/rejilla/recortar-mfe.mjs` recorta el shapefile del MFE50 al bbox de cada zona, con 0,01° de margen.
   Recorta las provincias de la zona y las vecinas de `CONFIG.mfe.vecinas`, y deja el resultado en
   `_fuentes/mfe50-recorte/<zona>/<provincia>.geojson`.
   - Junto a cada recorte deja `<provincia>.recorte.json` con el bbox usado y el número de teselas. Si ese bbox no
     cubre el que pide la zona, el recorte se rehace.
   - Si falta el shapefile, baja el ZIP del MITECO (`CONFIG.mfe.zips`, el mismo método de la tarea 0) y lo descomprime.
   - Usa mapshaper en un proceso por recorte.
2. `node scripts/rejilla/generar.mjs` genera una zona por proceso (`--zona <id>`, con un tope de memoria de Node de
   3 GB). Al final junta `indice.json` y `gruesa.json` (`--unir`).
   - Falla si un recorte no cubre la ventana de celdas finas.
   - Lee primero las provincias de la zona: si dos teselas se solapan en la raya, gana la de la zona.
   - Lee el GeoJSON feature a feature y guarda la geometría en forma compacta. El proceso más grande se quedó en unos
     440 MB.

**Provincias vecinas descargadas** (2026-10-01): Ciudad Real, Cantabria, Bizkaia, Gipuzkoa, La Rioja, Navarra, Teruel,
Zaragoza, Palencia, Salamanca, Huelva, Sevilla y Córdoba, además de las 11 de la tarea 0 cuando hacen de vecinas.
Los recortes que quedan vacíos no aportan nada: Soria en sierra-norte, Segovia en burgos, Cáceres en gredos y Ciudad
Real en extremadura. Soria en guadalajara deja 1 tesela sin celdas.

Generado el 2026-10-01 con `scripts/rejilla/generar.mjs` (MFE50 consultado el 2026-10-01, datos del proyecto 1997-2006;
MDT: Modelo Digital del Terreno MDT25 (IGN, PNOA-LiDAR), servicio WCS):

| Archivo | Celdas | KB |
|---|---|---|
| guadarrama.bin | 215 × 236 | 71 |
| sierra-norte.bin | 210 × 326 | 98 |
| soria.bin | 241 × 270 | 104 |
| burgos.bin | 286 × 481 | 165 |
| merindades.bin | 335 × 396 | 176 |
| gredos.bin | 401 × 205 | 114 |
| cuenca.bin | 269 × 380 | 164 |
| guadalajara.bin | 357 × 353 | 187 |
| toledo.bin | 468 × 261 | 145 |
| alava.bin | 447 × 311 | 193 |
| extremadura-1.bin | 959 × 276 | 233 |
| extremadura-2.bin | 959 × 276 | 274 |
| extremadura-3.bin | 959 × 276 | 209 |
| extremadura-4.bin | 959 × 276 | 183 |
| extremadura-5.bin | 959 × 275 | 263 |

Celdas gruesas: **355 con paso 0,18°**. Recuento por candidato: 0,09° → 1245; 0,12° → 729; 0,15° → 494; 0,18° → 355.
El máximo es 350 y ni el paso más grueso baja de ahí: **lo pasa por 5** (el generador lo avisa).
Hay unas pocas gruesas repetidas entre zonas vecinas (mismo `col:fila`), que se pueden pedir una sola vez (tareas 11 y 12).

**Cobertura del MFE50.** Celdas con altitud y fuera de prohibidos que no caen en ninguna tesela del MFE50 descargado:

| Zona | Celdas finas | Con monte | De ellas, de provincias vecinas | Prohibidas | Sin altitud | Con altitud sin tesela | Cobertura MFE50 | Gruesas |
|---|---|---|---|---|---|---|---|---|
| guadarrama | 50.740 | 30.293 | 822 | 2535 | 0 | 0 | 100 % | 12 |
| sierra-norte | 68.460 | 37.098 | 8644 | 118 | 0 | 0 | 100 % | 16 |
| soria | 65.070 | 51.890 | 14.025 | 0 | 0 | 0 | 100 % | 12 |
| burgos | 137.566 | 66.973 | 9019 | 0 | 0 | 0 | 100 % | 20 |
| merindades | 132.660 | 61.331 | 15.519 | 0 | 0 | 0 | 100 % | 20 |
| gredos | 82.205 | 42.830 | 10.116 | 0 | 0 | 0 | 100 % | 18 |
| cuenca | 102.220 | 75.249 | 9395 | 0 | 0 | 0 | 100 % | 25 |
| guadalajara | 126.021 | 85.671 | 21.613 | 0 | 0 | 0 | 100 % | 20 |
| toledo | 122.148 | 49.592 | 14.487 | 0 | 0 | 0 | 100 % | 21 |
| alava | 139.017 | 67.494 | 24.285 | 0 | 0 | 0 | 100 % | 25 |
| extremadura | 1.322.461 | 576.280 | 68.206 | 5205 | 155.243 | 48.768 | 95,8 % | 166 |

Antes de añadir las provincias vecinas faltaba entre el 11 % y el 43 % de cada ventana.

Lo que sigue sin cubrir:

- **Portugal**, en extremadura:
  - 48.768 celdas tienen altitud y no tienen tesela. Están todas al oeste de unos 7,0° O, en el lado
    portugués del bbox, donde no llega el MFE50.
  - 155.243 celdas no tienen altitud: el WCS del IGN devuelve 0 fuera de España y ese 0 cuenta como sin
    dato.
  - Ninguna de las dos lleva color. En el formato son «sin monte» (hábitat 0), igual que una celda española sin bosque.
    El bit 6 no se usa para distinguirlas; si hace falta, el visor puede recortarlas con el contorno de España.
- En las demás zonas no queda ninguna celda con altitud y sin tesela.

Celdas por provincia (celdas de la ventana que caen en una tesela de cada provincia; «vecina» = bit 5 si hay monte):

- guadarrama: Madrid 20.664, Segovia 26.607, Ávila (vecina) 934.
- sierra-norte: Madrid 26.632, Segovia 23.185, Guadalajara (vecina) 18.525.
- soria: Soria 46.043, La Rioja (vecina) 14.522, Burgos (vecina) 4505.
- burgos: Burgos 121.946, Soria (vecina) 10.560, La Rioja (vecina) 5060.
- merindades: Burgos 97.436, Cantabria (vecina) 30.874, Bizkaia (vecina) 3923, Palencia (vecina) 59, Álava (vecina) 368.
- gredos: Ávila 66.970, Toledo (vecina) 10.501, Madrid (vecina) 4734.
- cuenca: Cuenca 88.146, Teruel (vecina) 13.259, Guadalajara (vecina) 815.
- guadalajara: Guadalajara 97.866, Cuenca (vecina) 21.569, Teruel (vecina) 3969, Zaragoza (vecina) 2617.
- toledo: Toledo 86.134, Ciudad Real (vecina) 30.408, Badajoz (vecina) 4151, Cáceres (vecina) 1455.
- alava: Álava 78.867, Burgos (vecina) 32.480, La Rioja (vecina) 7443, Bizkaia (vecina) 2942, Gipuzkoa (vecina) 10.015, Navarra (vecina) 7270.
- extremadura: Cáceres 500.502, Badajoz 496.665, Huelva (vecina) 29.041, Sevilla (vecina) 22.799, Córdoba (vecina) 34.805, Salamanca (vecina) 10.304, Ávila (vecina) 14.329, Toledo (vecina) 4800.

Celdas con monte por hábitat (de la zona y de vecinas):

- guadarrama: pinar-silvestre 11.687, pastizal-montana 8106, melojar 4136, encinar 2975, prado 2059, pinar-resinero 905, chopera 192, pinar-negral 183, pinar-pinonero 25, quejigar 25.
- sierra-norte: melojar 10.405, pastizal-montana 8123, pinar-silvestre 7518, encinar 4295, pinar-resinero 2211, prado 1681, pinar-negral 894, sabinar 856, chopera 606, quejigar 349, hayedo 135, pinar-pinonero 13, robledal-albar 12.
- soria: pinar-silvestre 23.719, melojar 7400, pastizal-montana 6780, sabinar 5087, pinar-resinero 3196, hayedo 2300, encinar 2156, pinar-negral 651, quejigar 312, chopera 138, robledal-albar 108, prado 22, abedular 21.
- burgos: melojar 16.983, pinar-silvestre 13.780, encinar 8655, sabinar 6884, pinar-resinero 5510, pastizal-montana 3953, hayedo 3238, pinar-negral 3201, quejigar 2256, chopera 1288, prado 1009, robledal-albar 166, pinar-pinonero 50.
- merindades: encinar 15.975, prado 8592, pinar-silvestre 6913, hayedo 5737, quejigar 5320, pinar-resinero 5111, melojar 4088, robledal-albar 3917, pastizal-montana 2957, pinar-negral 1322, chopera 1099, castanar 201, sabinar 61, abedular 38.
- gredos: pinar-resinero 11.018, encinar 10.906, pastizal-montana 8361, prado 4158, melojar 3774, pinar-silvestre 2152, pinar-pinonero 1360, castanar 499, chopera 299, pinar-negral 186, alcornocal 117.
- cuenca: pinar-negral 37.431, pinar-silvestre 16.352, encinar 6215, pinar-resinero 5947, sabinar 4110, pastizal-montana 2710, quejigar 1921, chopera 446, pinar-pinonero 67, melojar 33, prado 17.
- guadalajara: pinar-negral 26.222, pinar-silvestre 14.697, encinar 10.184, pastizal-montana 9905, sabinar 9437, pinar-resinero 8639, quejigar 3183, melojar 2793, chopera 481, prado 130.
- toledo: encinar 26.127, pinar-resinero 7235, melojar 5799, prado 4365, alcornocal 2940, quejigar 1535, pinar-pinonero 1227, pastizal-montana 219, chopera 114, pinar-silvestre 12, pinar-negral 12, castanar 7.
- alava: hayedo 14.127, encinar 12.934, prado 11.859, quejigar 9383, pinar-silvestre 8197, melojar 4100, pinar-negral 2968, robledal-albar 1564, pastizal-montana 1287, chopera 668, pinar-resinero 313, castanar 47, pinar-pinonero 26, abedular 21.
- extremadura: encinar 335.917, prado 133.199, alcornocal 42.113, melojar 29.278, pinar-resinero 18.974, pastizal-montana 6108, pinar-pinonero 4549, castanar 2565, chopera 2114, pinar-silvestre 995, quejigar 414, pinar-negral 44, abedular 10.

Notas:

- «prado» (herbazal por debajo de 1.000 m, tipos 24 y 34 del MFE50) suele ser fincas de siega cerradas, sobre todo en
  extremadura, álava y merindades. La hoja del mapa no debe presentarlo como monte libre.

**Comprobación con los puntos de `zonas.json`** (celda de 250 m que contiene cada punto):

```
guadarrama-valsain-pinar pinar-silvestre → pinar-silvestre 1552 m (punto: 1561 m)
guadarrama-navas-melojar melojar → melojar 1452 m (punto: 1472 m)
guadarrama-morcuera-pinar pinar-silvestre → pinar-silvestre 1583 m (punto: 1580 m)
guadarrama-miraflores-pinar pinar-silvestre → pinar-silvestre 1566 m (punto: 1591 m)
guadarrama-canencia-pinar pinar-silvestre → pinar-silvestre 1375 m (punto: 1382 m)
sierra-norte-riaza-melojar melojar → melojar 1494 m (punto: 1505 m)
sierra-norte-sepulveda-pinar pinar-silvestre → pinar-silvestre 1309 m (punto: 1324 m)
sierra-norte-canencia-melojar melojar → melojar 1319 m (punto: 1336 m)
sierra-norte-bustarviejo-melojar melojar → melojar 1258 m (punto: 1271 m)
soria-pinar-grande-covaleda pinar-silvestre → pinar-silvestre 1532 m (punto: 1540 m)
soria-navaleno-resinero pinar-resinero → pinar-resinero 1168 m (punto: 1177 m)
soria-cidones-melojar melojar → melojar 1135 m (punto: 1134 m)
burgos-hontoria-pinar pinar-silvestre → pinar-silvestre 1156 m (punto: 1160 m)
burgos-palacios-pinar pinar-silvestre → pinar-silvestre 1258 m (punto: 1271 m)
burgos-monte-agudo-hayedo hayedo → hayedo 1443 m (punto: 1478 m)
burgos-umbria-rebollar melojar → melojar 1364 m (punto: 1366 m)
merindades-cerneja-hayedo hayedo → hayedo 1016 m (punto: 1031 m)
gredos-navahondilla-castanar castanar → castanar 816 m (punto: 832 m)
gredos-arenal-resinero pinar-resinero → pinar-resinero 1233 m (punto: 1240 m)
gredos-villarejo-silvestre pinar-silvestre → pinar-silvestre 1338 m (punto: 1334 m)
cuenca-serrania-negral pinar-negral → pinar-negral 1247 m (punto: 1250 m)
cuenca-boniches-resinero pinar-resinero → pinar-resinero 1074 m (punto: 1088 m)
guadalajara-poveda-negral pinar-negral → pinar-negral 1386 m (punto: 1360 m)
guadalajara-tierzo-sabinar sabinar → sabinar 1320 m (punto: 1314 m)
toledo-navalucillos-encinar encinar → melojar 999 m (punto: 972 m)
toledo-menasalbas-melojar melojar → melojar 943 m (punto: 941 m)
toledo-sevilleja-alcornocal alcornocal → alcornocal 552 m (punto: 550 m)
alava-gorbeia-hayedo hayedo → hayedo 728 m (punto: 760 m)
alava-entzia-hayedo hayedo → hayedo 939 m (punto: 934 m)
alava-izki-marojal melojar → melojar 751 m (punto: 772 m)
alava-entzia-pastizal pastizal-montana → pastizal-montana 1010 m (punto: 1011 m)
extremadura-salorino-alcornocal alcornocal → alcornocal 447 m (punto: 452 m)
extremadura-villuercas-castanar castanar → castanar 907 m (punto: 914 m)
extremadura-hervas-castanar castanar → castanar 969 m (punto: 968 m)
extremadura-trevejo-castanar castanar → castanar 784 m (punto: 785 m)
```

Coinciden 34 de los 35 puntos y ninguno sale «sin monte». La única discrepancia de hábitat es
`toledo-navalucillos-encinar`, y no es un error del MFE50:

- El punto cae en una tesela de encinar (polígono 574949: *Quercus ilex* 7/10).
- Está a unos 15 m del borde de esa tesela.
- El centro de su celda de 250 m, a unos 47 m del punto, cae ya en la tesela vecina de melojar (*Q. pyrenaica* 8/10).

La rejilla toma el hábitat del centro de la celda. No se corrige a mano. Para que el punto represente bien su encinar
habría que moverlo unos 150 m hacia dentro de la tesela, y eso lo decide la usuaria.

Ninguna diferencia de altitud pasa de 100 m: la mayor es de 35 m (`burgos-monte-agudo-hayedo`). Es la media de una celda
de 250 m frente a un punto.

## Índice diario precalculado (bucket `indice`)

Archivo `indice/<sello>.json` (`sello` = `AAAA-MM-DDTHH`, hora de Madrid), formato en `supabase/functions/_shared/salida-indice.js`:

```json
{ "version": 1, "sello": "2026-10-01T07", "generado": "2026-10-01T05:03:12.000Z", "hoy": "2026-10-01",
  "fechas": ["2026-10-01", "…10 días…"],
  "celdas": { "guadarrama:66:65": { "altRef": 1480, "incompleta": false,
      "lluvia": { "desde": "2026-08-03", "hoy": 59, "mm": [2, 0, "…"] },
      "dias": [[106, 60, 17, 60, 194, 0, 13, 13, 6, 6, 6, 6, 6, 6, 6], null, "…"] } } }
```

Cada día es una lista de 15 números a la altitud de referencia, redondeados a 2 decimales:
`[P26, P3, lag, pct, Pagosto, secante (0/1), T20aire, T20suelo, tmin × 7]`; `null` en un hueco o en todo el día si no se
pudo calcular. `lluvia.mm` es la lluvia diaria desde `lluvia.desde` (índice `lluvia.hoy` = hoy) para la gráfica.
`indice/ultimo.json = { version, sello, archivo, generado, conDatos, total }`.

Se publican los agregados (iguales para todas las especies) en vez de los factores por especie: el móvil aplica `indiceDesdeAgregados` con los umbrales vigentes, así que una edición en Ajustes se ve sin esperar a la siguiente ejecución.

## data/sitios.json (sitios conocidos)

Lugares donde buscar, recogidos de blogs, prensa y webs oficiales (investigación 04a–04c en `docs/investigacion/`). Nunca se inventan coordenadas: `lat` y `lon` son `null` salvo que una fuente las dé (hoy, 12 sitios: los 11 aparcamientos oficiales del coto La Engaña y la entrada de Berzocana; cada uno lo dice en `notas`).

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
- Si hay `lat`/`lon`, el validador comprueba que no caen dentro de un polígono `prohibido` de `cotos.geojson`.
- `zona` se asigna por provincia y administración (qué decreto u ordenanza rige), no por el bbox: el bbox solo sirve para el recuento de GBIF y para contener los puntos meteorológicos. Por eso hay sitios cuyo pueblo queda fuera del bbox de su zona (p. ej. los de Soria al este de lon -2,5, los de Guadalajara en la Sierra Norte, Las Navas del Marqués en `gredos`). Esos sitios llevan `fueraDeZonaMeteo: true` (booleano opcional; lo valida `scripts/validar-datos.mjs`) y su tarjeta muestra la línea «Este pueblo queda fuera del área donde se calcula el índice de la zona: tómalo como orientativo.». Criterio (30/09/2026): el punto del sitio si tiene `lat`/`lon` (los 12 caen dentro de su bbox) y, si no, todos sus pueblos fuera del bbox según el centro del núcleo en OpenStreetMap (Nominatim); los sitios con varios pueblos y alguno dentro, o con un nombre de comarca que no se puede situar, no se marcan. Hoy son 39 sitios; `tests/sitios-datos.test.js` exige la marca en todo sitio cuyas `notas` digan que queda fuera del bbox.

### `trucos` en `data/especies.json`

Solo las comestibles. `[{ "texto", "tipo": "orientacion | altitud | microhabitat | indicador | tiempo | recoleccion | creencia", "fuentes": [{ "url", "fecha", "consultado" }], "confianza": "alta | media | baja", "cifrasOrientativas": true }]`. Las cifras de 04d (días, metros, °C) se leyeron con resúmenes automáticos: llevan `cifrasOrientativas: true` y la interfaz muestra «cifras orientativas». `creencia` se muestra como «Creencia popular (sin base)». Criterio de `confianza` en los trucos de la segunda pasada: `alta` solo con 3 o más fuentes independientes directas; `media` con 2, o con 1 fuente oficial/institucional (Micocyl, MITECO) o con pruebas indirectas; `baja` con 1 fuente no oficial. Los mensajes de más de 10 años lo dicen en el propio texto del truco. `cifrasOrientativas: true` en todo lo que lleva cifras y se leyó con resumen automático.

### Segunda pasada de sitios y trucos (30/09/2026)

A partir de `docs/investigacion/06a` a `06d`, `07a` y `07b`: 98 sitios nuevos (de 80 a 178), 10 sitios existentes completados, 7 normas nuevas, 49 trucos nuevos y 10 ediciones de trucos existentes. Las fuentes y las fechas están en cada sitio o truco.

- **Sitios por zona** (nuevos): guadarrama 1, sierra-norte 3, gredos 7, soria 17, guadalajara 8, cuenca 7, toledo 2, alava 3, burgos 8, merindades 12, extremadura 30. Hay 6 NO IR nuevos: 1 prohibido (La Barranca, Fuenfría y Cotos), 4 montes dentro de espacios protegidos sin norma de setas leída (Valcorchero, Castañar Gallego, Baldío de la Umbría y, desde la ronda de arreglos 1, el Pinar de Hoyocasero, Paisaje Protegido según el catálogo de Studia Botanica de 2000) y 1 privado (dehesas de criadillas).
- **Correcciones a los informes**: *Honrubia de la Cuesta* es de Segovia (BOP de Segovia n.º 133, 04/11/2016), no de Cuenca; su ordenanza (MUP 279 y 280, 8 kg al día, foráneo 10 € al día) está en `segovia-honrubia-de-la-cuesta-2016`. Las tarifas de Traíd y Aldeanueva de Atienza no figuran en su BOP (06b las suponía iguales a las de la Mancomunidad). Micocyl desaconseja recoger *Tricholoma terreum* (parte del 02/12/2022, rabdomiólisis; https://www.micocyl.es/noticias/puente-de-setas): la negrilla pasó a `comestible-precaucion`, sin `indice` ni `trucos`, y el aviso es su `precauciones[0]` (banner rojo de la ficha), con la nota de que el RD 30/2009 (Parte A) todavía permite comercializarla.
- **Normas nuevas** (texto del BOP leído el 30/09/2026): Orea 2018 (con tique turístico de 1 €), Campisábalos 2021, Gascueña de Bornova 2020, Alustante 2017 (cupos de 10 y 12 kg), Traíd 2017, Aldeanueva de Atienza 2018 y Honrubia de la Cuesta 2016. También se leyeron las de Checa, Megina y Tordesilos (2017-2018): tienen las mismas tarifas que la Mancomunidad La Sierra y no se añaden.
- **Coordenadas**: los 11 aparcamientos del coto La Engaña vienen de la web oficial del coto (ETRS89 UTM 30, mapa del 19/07/2017), convertidos a WGS84 y comprobados contra `cotos.geojson`: ninguno cae en una zona prohibida y 10 de 11 caen dentro del polígono BU-50008 (el aparcamiento de Alto el Caballo queda a unos 340 m o menos fuera del polígono derivado). Berzocana: las da su propia fuente. Los demás sitios siguen sin coordenadas.
- **Montes públicos de Extremadura** (16 sitios, `extremadura-monte-*`): son datos derivados del MFE50 y el catálogo de montes del MITECO, sin fuente micológica; por eso no llevan especies y dicen que hay que preguntar al ayuntamiento. No se incluyó la Dehesa Boyal de Piornal (no se pudo identificar en la capa) ni el MUP de Serradilla (ya cubierto por Monfragüe).
- **Extremadura incluye Badajoz**: el bbox de `extremadura` pasó de `[-7.45, 39.3, -5.3001, 40.35]` a `[-7.45, 37.95, -5.3001, 40.35]` para contener Tentudía (Fuentes de León 38,07 N, Monesterio 38,09 N) sin solapar ninguna zona; `provincias` es ahora Cáceres y Badajoz. El recuento de GBIF se repitió solo para esa zona (`node scripts/gbif-presencia.mjs --zona=extremadura`, 30/09/2026): 35 recuentos cambiaron y 4 subieron de orientativa a confirmada (Agaricus arvensis, Pleurotus ostreatus, Cyclocybe cylindracea y Tricholoma terreum); ninguna otra zona cambió. El bbox ampliado incluye también un trozo del norte de Huelva y de Sevilla (GBIF se filtra por país España, así que no cuenta Portugal).
- **Monfragüe**: sigue `prohibido`. El texto legal del sitio y la nota del polígono dicen: «Prohibido salvo autorización del Parque; el PRUG solo prevé setas sin fines comerciales en el monte Dehesa Boyal y Cuarto de los Arroyos (Serradilla)».
- **Mirabel**: el número de MUP (132) lo da la ordenanza, pero la capa de montes del MITECO no lo trae: el polígono `ex-mirabel-mup-132` se asocia por nombre y término. Pasó a `regimenConfirmado: false` y lo dice en la nota.
- **Valle de Losa, San Zadornil y Bozoó**: sus cotos y sitios siguen en `merindades` aunque su geometría cae en el bbox de `alava`. Es lo más coherente: son de Burgos (rige el Decreto 31/2017 de Castilla y León, no el Decreto Foral 89/2008 de Álava) y la zona `alava` muestra las normas y avisos de Álava. El solape es solo de bbox y afecta nada más al recuento de GBIF, no al régimen que se enseña. Es un límite del esquema de un bbox por zona, como el de Neila y Regumiel (Burgos, dentro del bbox de `soria`).
- **Lo que quedó fuera** (motivo en `docs/investigacion/` y en el informe de la tarea): Fuente del Cura (no se pudo situar), Piedralaves y la Sierra Norte sin fuente, los vídeos de YouTube (solo títulos), Puente de Vadillos y Beteta (senderismo, sin setas), El Hosquillo y Ciudad Encantada (sin regla ni fuente de setas), Monterrubio de la Demanda y los Obarenes (sin fuente micológica), Villanueva Tobera (sin enlace verificable), Amurrio, las rutas guiadas de Alegría-Dulantzi y las jornadas de El Royo y El Burgo de Osma (eventos sin paraje).

## Meteorología (Open-Meteo)

Comprobado en vivo el 2026-09-30: con el modelo por defecto (best_match) el suelo horario (`soil_moisture_0_to_7cm`, `soil_temperature_0_to_7cm`) llega relleno (1.680 valores por punto en 70 días), y la humedad de suelo del archivo histórico coincide con la del forecast (sesgo medio < 0,001 m³/m³ en 52 días solapados; rango histórico 0,093–0,429). No se usa `models=ecmwf_ifs` en la serie principal ni en el archivo. `models=` solo se usa en la llamada de contraste de lluvia (`urlModelos`).

### Contraste de modelos: horizonte común

Comprobado en vivo el 2026-09-30 con `models=ecmwf_ifs,icon_seamless,meteofrance_seamless&forecast_days=8`: los modelos no llegan igual de lejos. ECMWF devuelve los 8 días, ICON (`icon_seamless`) devuelve `null` desde el día +7 y Météo-France (`meteofrance_seamless`) desde el +4 (alcance ~4 días). Exigir 7 días completos por modelo dejaba solo a ECMWF y el contraste nunca aparecía.

Regla de `dispersion()`: para cada modelo se cuenta el alcance (días consecutivos con valor desde hoy+1, 0–7). El horizonte `h` es el mayor valor entre 3 y 7 al que llegan al menos 2 modelos; se compara la lluvia acumulada de hoy+1…hoy+h solo entre los modelos con alcance ≥ h, y los demás quedan en `excluidos`. Si menos de 2 modelos llegan a 3 días, no hay contraste (`horizonte: null`). La incertidumbre se mantiene: rango > 0,5·media y rango > 10 mm.

### Peticiones y su peso (estimación, 2026-09-30)

Open-Meteo cuenta como varias llamadas una petición de más de 10 variables o de más de 2 semanas por punto, con fracciones: «Requests for data covering more than 10 weather variables or extending over a period of more than 2 weeks for a single location are considered multiple API calls» ([open-meteo.com/en/pricing](https://open-meteo.com/en/pricing), consultado el 2026-09-30). Estimación usada aquí: `puntos × max(1, variables/10) × max(1, días/14)`, con los **35 puntos** actuales (26 hasta la tarea 19). Límites gratuitos: 600 llamadas/min, 5.000/h, 10.000/día. Es una estimación (Open-Meteo no publica la fórmula exacta para varios puntos).

| Petición | Qué pide | Cuándo | Peso estimado |
|---|---|---|---|
| Serie principal (`urlPrincipal`) | 7 diarias + 2 horarias, 70 días | como mucho cada 3 h | 35 × 1 × 5 ≈ **175** |
| Contraste de modelos (`urlModelos`) | lluvia de 3 modelos, 8 días | con la principal | 35 × 1 × 1 ≈ **35** |
| Lluvia desde el 1-ago (`urlLluviaArchivo`) | solo `precipitation_sum`, del 1-ago de la temporada al día antes de la serie | hace falta de octubre a julio (cuando la serie de 60 días empieza después del 1-ago), una vez al día (caché por día); si falta, se reintenta a los 20 min; nada en agosto y septiembre | crece con los días: 1-oct: 35 × 1 × 1 = **35**; 31-dic ≈ 35 × 6,6 ≈ **231**; finales de julio (1-ago del año anterior a ~31-may, ~304 días) ≈ 35 × 22 ≈ **770** |
| Lluvia desde el 1-ago de respaldo (`urlLluviaPrevision`) | lo mismo al forecast (guarda unos 2 meses atrás) | solo si el archivo falla o no llega | como la anterior, solo con los puntos que falten |
| Climatología del suelo (`urlClimatologia`) | solo `soil_moisture_0_to_7cm_mean`, 2 años hasta el día antes de la serie | una vez cada 30 días (clave: solo el conjunto de puntos), siempre después de la serie principal; si falla, espera creciente guardada en el almacén (20 min → 1 h → 6 h → 24 h, se reinicia con un éxito) y no se pide ni en el refresco de 3 h mientras dura | 35 × 1 × 52 ≈ **1.820** |

Antes (hasta la v1) la climatología pedía 2 variables desde el 1-ene-2023, ≈ 26 × 1 × 93 ≈ **2.430** llamadas, en cada refresco con una clave que cambiaba cada día (causa probable de los 429). La climatología solo alimenta `fS` (humedad del suelo): si no llega, el índice se calcula sin ese factor y lo explica. La lluvia desde el 1-ago, en cambio, es imprescindible para las especies de otoño desde el 1-oct: si no llega ni del archivo ni del forecast, esas especies salen «sin datos» y la zona, «sin datos» o «N especies sin datos suficientes», nunca con una nota inventada.

Límites de tiempo: 15 s la serie principal y los modelos, 20 s la lluvia desde el 1-ago y 45 s la climatología. La climatología y la lluvia desde el 1-ago se piden después de la serie principal, no a la vez, para no competir con ella. Ojo: la climatología (~1.820) sigue pasando del límite por minuto si Open-Meteo lo aplica a una sola petición; como es una vez al mes y solo afecta a `fS`, se acepta; si da 429, entra en la espera creciente y, mientras, el índice va sin humedad del suelo.

**Cambio de modelo (01/10/2026): Météo-France → GFS.** A petición de la usuaria, que lo veía «falsear mucho», el tercer modelo del contraste pasa de `meteofrance_seamless` a `gfs_seamless` (NOAA). Comprobación hecha ese día con la Previous Runs API de Open-Meteo (previsiones hechas 1–4 días antes) frente a la lluvia diaria de las 23 estaciones AEMET de la app, del 05 al 27/09/2026 (510 pares estación-día por modelo y antelación):

| modelo | MAE +1/+2/+3 d (mm/día) | total previsto / real +1/+2/+3 d | alcance |
|---|---|---|---|
| ECMWF IFS | 0,52 / 0,43 / 0,42 | 1,39 / 1,05 / 0,89 | 8 d |
| ICON | 0,37 / 0,32 / 0,31 | 0,57 / 0,48 / 0,28 | ~7 d |
| Météo-France | 0,33 / 0,36 / 0,43 | 0,91 / 0,71 / 0,63 | ~3–4 d |
| GFS | 0,35 / 0,34 / 0,37 | 0,78 / 0,62 / 0,63 | 16 d |
| UKMO | 0,56 / 0,50 / 0,48 | 1,50 / 1,19 / 1,18 | — |

En esta muestra (septiembre seco, 23 días) Météo-France no era el peor a 1 día, pero empeoraba con la antelación y solo llegaba a 3–4 días, así que quedaba fuera del contraste a 7 días. GFS tiene un error parecido o menor a +2/+3 d y cubre los 8 días. DMI y KNMI «seamless» dan en España los mismos números que ECMWF (fuera de su dominio caen a él), así que no aportan. Muestra pequeña: repetir con más semanas (`node scripts/comparar-modelos.mjs ecmwf_ifs,icon_seamless,gfs_seamless,meteofrance_seamless`, cambiando las fechas) antes de sacar conclusiones fuertes.

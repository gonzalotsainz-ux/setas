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
  - `distanciaKm`: distancia aproximada al punto
- `normas`: referencias a ids de normas regulatorias
- `avisos`: avisos especiales de la zona (permisos, restricciones)
- `fuentes`: referencias bibliográficas de la zona
  - `url`: URL de consulta
  - `titulo`: título de la fuente
  - `consultado`: fecha de consulta (YYYY-MM-DD)

### Notas sobre los datos actuales de `zonas.json`

- `comunidad`: `madrid-castilla-y-leon` (guadarrama y sierra-norte), `castilla-y-leon`, `castilla-la-mancha` o `euskadi`.
- `estacionesAemet` está **vacío en las 8 zonas** hasta tener la clave de AEMET OpenData (tarea 16). Se rellena en la tarea 18.
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
- `fotos`: fotografías [{archivo, autor, licencia, url}]
  - `licencia`: CC0, PD, CC BY, CC BY-SA (sin NC ni ND)
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

## Meteorología (Open-Meteo)

Comprobado en vivo el 2026-09-30: con el modelo por defecto (best_match) el suelo horario (`soil_moisture_0_to_7cm`, `soil_temperature_0_to_7cm`) llega relleno (1.680 valores por punto en 70 días), y la humedad de suelo del archivo histórico coincide con la del forecast (sesgo medio < 0,001 m³/m³ en 52 días solapados; rango histórico 0,093–0,429). No se usa `models=ecmwf_ifs` en la serie principal ni en el archivo. `models=` solo se usa en la llamada de contraste de lluvia (`urlModelos`).

### Contraste de modelos: horizonte común

Comprobado en vivo el 2026-09-30 con `models=ecmwf_ifs,icon_seamless,meteofrance_seamless&forecast_days=8`: los modelos no llegan igual de lejos. ECMWF devuelve los 8 días, ICON (`icon_seamless`) devuelve `null` desde el día +7 y Météo-France (`meteofrance_seamless`) desde el +4 (alcance ~4 días). Exigir 7 días completos por modelo dejaba solo a ECMWF y el contraste nunca aparecía.

Regla de `dispersion()`: para cada modelo se cuenta el alcance (días consecutivos con valor desde hoy+1, 0–7). El horizonte `h` es el mayor valor entre 3 y 7 al que llegan al menos 2 modelos; se compara la lluvia acumulada de hoy+1…hoy+h solo entre los modelos con alcance ≥ h, y los demás quedan en `excluidos`. Si menos de 2 modelos llegan a 3 días, no hay contraste (`horizonte: null`). La incertidumbre se mantiene: rango > 0,5·media y rango > 10 mm.

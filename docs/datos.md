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
      "latencia": "6–24 h",
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
- `rd30_2009`: clasificación del RD 30/2009 (A, B, C, D, etc.)
- `habitats`: hábitats donde fructifica
- `altitud`: rango de altitud (min, max, verificado)
- `zonas`: presencia por zona {"zoneId": {presencia, gbif, fuente}}
  - `presencia`: confirmada|orientativa|sin-registros
  - `gbif`: URL o null si sin registros GBIF
  - `fuente`: referencia a fuente (id o URL)
- `temporada`: {meses: [1-12], tipo: "otono"|"primavera"|"verano"|"invierno"|"todo"}
- `identificacion`: características diagnósticas
- `valor`: comestibilidad|excelente|bueno|mediocre|pobre
- `precauciones`: advertencias especiales
- `confusiones`: especies confundibles [{especie, riesgo, diferencias}]
  - `riesgo`: bajo|medio|mortal
- `sindrome`: síndrome tóxico si aplica (referencia a sindromes[].id)
- `indice`: índice de fructificación (solo comestibles)
  - `topt`: temperatura óptima (°C)
  - `trango`: rango de temperatura [min, max]
  - `usarSuelo`: usar modelo del suelo (bool)
  - `pmin`, `pfull`: precipitación mínima y de saturación (mm)
  - `desfase`: lag de precipitación [min, max] días
  - `helada`: probabilidad de helada nula|baja|media|alta
  - `confianza`: alta|media|baja
  - `base`: evidencia|extrapolacion|analogia
  - `analogo`: si base=analogia, especie análoga
  - `fuente`: referencia a investigación
- `sinIndice`: motivo de no llevar índice (hipogeo, etc.)
- `fotos`: fotografías [{archivo, autor, licencia, url}]
  - `licencia`: CC0, PD, CC BY, CC BY-SA (sin NC ni ND)
- `fuentes`: referencias bibliográficas

**Campos de síndrome:**
- `id`: identificador único
- `nombre`: nombre del síndrome
- `latencia`: período entre ingesta y síntomas
- `gravedad`: leve|moderada|grave|mortal
- `texto`: descripción de síntomas
- `fuentes`: referencias médicas

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
- `tipo`: decreto|orden|circular|ley|etc.
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

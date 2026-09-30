# Setas — diseño de la herramienta

Fecha: 2026-09-30 · Estado: borrador para revisión · Repo: `gonzalotsainz-ux/setas` · Web: https://gonzalotsainz-ux.github.io/setas/

## 1. Propósito

Herramienta **personal** (la usuaria y Gonzalo, desde Madrid) para decidir **cuándo y dónde** ir a por setas, y
**qué** buscar en cada sitio. Prioridades, por orden:

1. **Fiabilidad.** Cada dato micológico, normativo o meteorológico lleva su fuente y su fecha. Lo no verificado se muestra
   como tal. Seguridad alimentaria por encima de todo.
2. **Meteo fiable.** Varios modelos, lluvia pasada contrastada con estaciones reales, varios puntos por zona.
3. **Que sea chula.** Cuaderno de campo moderno, móvil primero, legible al sol.

Criterio de éxito: abrir la app un jueves y saber en 10 segundos a qué zona ir el fin de semana, qué especies
esperar, si hace falta permiso y dónde sacarlo; y, con las temporadas, que el diario confirme o corrija el índice.

Fuera de alcance en v1: avisos push, uso sin cobertura (PWA offline), compartir con amigos, identificación de
especies por foto (descartada por seguridad), toda España fuera de las 8 zonas.

## 2. Zonas

| id | Zona | Comunidad |
|---|---|---|
| `guadarrama` | Sierra de Guadarrama (Madrid y Segovia, Valsaín) | Madrid / Castilla y León |
| `sierra-norte` | Sierra Norte de Madrid y Ayllón (Montejo, Somosierra, Riaza) | Madrid / Castilla y León |
| `soria` | Soria (Pinar Grande, Tierras Altas, Montes de Soria) | Castilla y León |
| `gredos` | Gredos y Valle del Tiétar | Castilla y León |
| `cuenca` | Serranía de Cuenca | Castilla-La Mancha |
| `guadalajara` | Guadalajara (Alto Tajo, Sierra Norte) | Castilla-La Mancha |
| `toledo` | Montes de Toledo | Castilla-La Mancha |
| `alava` | Álava (Gorbeia, Montes de Vitoria, Izki, Valderejo, Entzia) | Euskadi |

Cada zona tiene **2–4 puntos de referencia** (lat, lon, **altitud real**, hábitat dominante: pinar silvestre,
pinar negral, robledal de melojo, hayedo, castañar, encinar/jaral, pastizal de montaña). Se eligen sobre
bosque real, no en cumbres. La altitud se pasa a Open-Meteo con `elevation=` porque la celda del modelo puede
estar muy desviada: en una prueba, un punto de Guadarrama cayó a 2.097 m.

## 3. Pantallas

- **Hoy.** Semáforo de las 8 zonas, ordenado de mejor a peor, con una frase por zona («38 mm hace 12 días, suelo
  a 13 °C → boletus probable»), filtro por especie y aviso si la previsión es incierta.
- **Mapa.** Topográfico del IGN (y ortofoto PNOA como alternativa), zonas, cotos (polígono oficial o zona aproximada
  con enlace), salidas del diario y capa de lluvia acumulada en 26 días por punto.
- **Zona.** Gráfico de lluvia de 60 días más 10 de previsión, con la horquilla entre modelos; índice por especie con
  su desglose; hábitats; cotos y permisos; calendario de qué sale cada mes.
- **Especies.** Fichas con fotos, identificación, hábitat, temporada, zonas y un recuadro rojo de **tóxicas
  parecidas** con los rasgos que las distinguen.
- **Diario.** Lista y alta de salidas: fecha, zona, punto en el mapa, especies y kilos, fotos y notas. La meteo y el
  índice de ese día se guardan solos junto a la salida.
- **Ajustes.** Nombre del dispositivo, umbrales del índice por especie (editables, con su valor original y fuente) y créditos y licencias.

Siempre visible: botón de **Toxicología** (teléfono del Servicio de Información Toxicológica) y el aviso
«Ante la duda, no la comas».

## 4. Meteo

Fuente principal: **Open-Meteo** (gratis para uso no comercial, sin clave, CORS abierto, datos CC BY 4.0,
atribución «Weather data by Open-Meteo.com»). Límites: menos de 10.000 llamadas/día; esta app usa unas decenas.

- **Serie principal:** `api.open-meteo.com/v1/forecast` con todos los puntos en **una sola llamada**, más
  `past_days=60`, `forecast_days=10`, `timezone=Europe/Madrid` y `elevation` por punto. Variables diarias:
  `precipitation_sum`, `temperature_2m_mean/min/max`, `et0_fao_evapotranspiration`, `wind_speed_10m_max` y `relative_humidity_2m_mean`. Suelo: horarias
  `soil_moisture_0_to_7cm` y `soil_temperature_0_to_7cm` promediadas por día, la misma capa que usa la
  climatología. Modelo `best_match`.
- **Contraste entre modelos:** una segunda llamada, solo de precipitación, con `models=ecmwf_ifs,icon_seamless,
  meteofrance_seamless`. Se muestra la media y la dispersión. Si la dispersión de la lluvia prevista a 7 días
  supera el 50 % de la media y 10 mm, la previsión se marca como **incierta**. (Open-Meteo **no** ofrece AEMET
  HARMONIE: comprobado.)
- **Climatología para percentiles de humedad del suelo:** `archive-api.open-meteo.com/v1/archive`, con los 3 últimos
  otoños por punto. Se descarga en una sola llamada para todos los puntos, a lo sumo una vez al día, y se guarda resumida en
  `localStorage`. ERA5-Land llega con retraso, así
  que para los últimos 45 días siempre se usa el forecast con `past_days`.
- **Lluvia medida en estaciones (AEMET OpenData):** a cada zona se le asignan 1–2 estaciones AEMET cercanas y
  representativas. La clave de AEMET, gratuita y pedida por Gonzalo, vive como *secret* en una **Supabase Edge
  Function** `aemet` que hace de intermediario (AEMET necesita dos llamadas por dato y la clave no puede ir en el
  navegador). La función devuelve la lluvia diaria observada de los últimos 30 días y la guarda en caché durante
  6 h. La app compara la P26 medida con la del modelo: si difieren más de un 30 % y más de 10 mm, avisa y deja
  elegir cuál usar. Por defecto se usa la estación, si tiene datos completos.
- **Caché y fallos:** la última respuesta de cada fuente se guarda con su hora. Se refresca al abrir la app si
  tiene más de 3 h. Si una fuente falla, se muestran los últimos datos buenos con «datos de hace X h»; si no hay
  ninguno, la zona sale **gris, «sin datos»**. Nunca se calcula un semáforo con datos faltantes.
- **Etiquetado:** cada cifra indica su origen («estación AEMET Navacerrada», «modelo ECMWF», «media de 3
  modelos») y su hora.

## 5. Índice de condiciones (0–100)

Función pura `calcularIndice(serieDiaria, i, parametrosEspecie) → { valor, etiqueta, factores[], confianza }`,
según la investigación `docs/investigacion/03-fructificacion-datos.md` §1.5:

- **Factores (0–1):**
  - `fW`: lluvia acumulada en 26 días, escalada entre el mínimo y el pleno de la especie.
  - `fR`: episodio de lluvia de 3 días dentro del desfase de la especie.
  - `fT`: gaussiana de la temperatura media de 20 días alrededor del óptimo. En *Morchella* se usa la temperatura
    del suelo.
  - `fS`: percentil de la humedad del suelo frente a la climatología del punto.
  - `fA`: arranque de temporada, que exige 50 mm desde el 1 de agosto en las especies de otoño.
  - `fC`: calendario de la especie.
- **Combinación:** `I = 100 · fW^0.35 · fT^0.25 · fS^0.20 · fR^0.20 · fA · fC · Pen`.
- **Penalizaciones (`Pen`):** heladas, desecación (ET0, humedad relativa y viento) y calor persistente.
- **Días de previsión:** la lluvia prevista pesa 0,8 en los días 1–3, 0,6 en los días 4–7 y 0,4 a partir del 8.
- **Etiquetas:** 0–20 nulo · 20–40 bajo · 40–60 posible · 60–80 bueno · 80–100 muy bueno.
- **Confianza por especie:**
  - **alta**: umbrales publicados (*B. edulis*, *Morchella*);
  - **media**: umbrales cualitativos de Cesefor/Micocyl;
  - **baja**: heurística.
  Se muestra junto a la nota.
- **Índice de zona:** el máximo de las especies en temporada presentes en sus hábitats, tomando para cada punto el
  mejor valor y mostrando el rango entre puntos.
- **Desglose:** cada nota se explica en pantalla factor a factor, en lenguaje claro.
- **Aviso fijo:** el índice mide la **oportunidad meteorológica**, no la producción del monte.

Los parámetros por especie viven en `data/especies.json`. Cada uno lleva su `fuente` y su `base` (evidencia,
cualitativo o heurística) y se pueden sobrescribir desde Ajustes. Los valores sobrescritos se guardan en Supabase
y se comparten entre los dos.

## 6. Normativa y cotos

Según la investigación `docs/investigacion/01-normativa-cotos.md`. Para cada comunidad y zona se guarda:

- la norma aplicable, con su enlace;
- si hace falta permiso, dónde se saca y a qué precio;
- cupos, días y horarios;
- herramientas prohibidas;
- restricciones en espacios protegidos (Parque Nacional de Guadarrama);
- sanciones.

Todo va en `data/normativa.json`, con `fuente` y `revisado` en cada entrada.

- **Cotos en el mapa:** en `data/cotos.geojson`. Cada coto lleva `precision`: `oficial`, `derivado` o `aproximado`.
- **Normativa caducada:** si `revisado` tiene más de 12 meses, la entrada muestra «revisar vigencia».

**Cartografía por comunidad** (comprobada el 30-09-2026):

| Ámbito | Fuente | Precisión |
|---|---|---|
| Castilla y León (Segovia, Soria, Ávila) | WFS de IDECyL, capa `mico:mico_cyl_zonas_reguladas_peri` (247 polígonos). Los nombres y precios salen de micologiacyl.es/acotados, cruzados por clave de coto. | `oficial` |
| Parque Nacional de Guadarrama | WFS de zonificación del Organismo Autónomo Parques Nacionales. Las Zonas de Reserva y de Uso Restringido A salen como **prohibido recolectar**. | `oficial` |
| Castilla-La Mancha (Cuenca, Guadalajara, Toledo) | No hay capa de cotos. Se construye cruzando los números de monte público citados en las ordenanzas con el GeoJSON de montes públicos del MITECO, que se recorta a las 3 provincias y se simplifica en `scripts/`. | `derivado` |
| Álava | Solo hay planos en PDF o imagen. Se digitalizan a mano los límites aproximados, con enlace al plano oficial. | `aproximado` |
| Hayedo de Montejo | Recolección **prohibida** (normas de la Sierra del Rincón, 2024). Se marca en rojo. | `oficial` |

**Incoherencias conocidas** (se muestran en la ficha, no se esconden):
- En Castilla y León hay polígonos de «parque» sin nombre (PMSG-50001, PMAV-50009, PMAV-50010…) y cotos del portal
  que no están en la capa (SG-50002, AV-50006). Se cruza lo que coincide; lo demás se etiqueta
  «régimen sin confirmar».
- Datos sin confirmar para 2026, que se marcan como tales:
  - tarifas de Gredos AV-50003 (el portal dice «sin tarifa»);
  - precios de Valsaín (Orden AAA/1681/2016, con un borrador de 2022 que no consta aprobado);
  - precios de los cotos de Álava (prensa de 2023);
  - Covaleda.
- Sin normativa específica encontrada: Montes de Toledo, Cabañeros y el Valle del Tiétar. Rige la regla general de
  su comunidad (Castilla-La Mancha: cupo de 5 kg o 10 l, Orden de 15/11/2016, texto oficial pendiente de leer).
  Se indica expresamente.
- En la construcción se hace una segunda pasada de normativa, dirigida a las lagunas del informe:
  - el boletín provincial de Cuenca;
  - los planes de gestión de los parques naturales;
  - el Decreto 16/2019 (vertiente segoviana del Parque Nacional);
  - las ordenanzas de Montejo y Somosierra.

## 7. Especies

Según la investigación `docs/investigacion/02-especies.md`, con 38 comestibles, 11 síndromes tóxicos y 22 fuentes.
En `data/especies.json` va cada comestible con:

- nombre científico actual y sinónimos;
- nombres comunes;
- hábitats y zonas;
- temporada;
- rasgos de identificación;
- precauciones;
- **confusiones peligrosas** (id de la tóxica y rasgos diferenciadores);
- parámetros del índice;
- fotos con autor y licencia;
- fuentes.

Las tóxicas y mortales de las zonas tienen ficha propia, enlazada desde las confusiones.

**Reglas de inclusión:**
- solo comestibles de consenso en las fuentes;
- nada de especies con comestibilidad discutida o con toxicidad acumulativa conocida sin advertencia explícita;
- sin fuente, no entra.

**Base legal (RD 30/2009, BOE):**
- **Parte D** (prohibidas en cualquier presentación: *Clitocybe nebularis*, *Tricholoma equestre*/*auratum*,
  *Cortinarius*, *Lepiota*, *Inocybe*, *Galerina*, *Gyromitra*…): se marcan en **rojo** y nunca se recomiendan.
- **Parte C** (*Morchella*, *Helvella*): llevan el aviso de que solo se comen bien cocinadas; crudas son tóxicas.

**«Clásicas» que la app no recomienda:** pardilla, seta de los caballeros (rabdomiólisis), *Amanita rubescens*,
*Paxillus*, *Armillaria*, *Kuehneromyces* y gurumelo. Tienen ficha informativa con el motivo, pero sin índice y
sin aparecer como objetivo de salida.

**Aviso específico:** *Amanita vidua* (descrita en 2022) es una amanita blanca mortal de primavera que vive con
encina, melojo y alcornoque y se confunde con el gurumelo. Lleva aviso en Montes de Toledo, Tiétar y Gredos.

**Nomenclatura actual con sinónimos buscables:** *Collybia nuda* (ex *Lepista nuda*), *Imleria badia*,
*Infundibulicybe geotropa*, *Cyclocybe cylindracea*…

**Presencia por zona:** se deduce del árbol, el sustrato y la altitud, y se marca «orientativa». En la construcción
se hace una pasada con GBIF (observaciones por provincia) para confirmar cada especie en cada zona. Si en una zona
no hay registros, se indica.

**Seguridad (textos de la investigación, bloque C):**
- teléfono del **Servicio de Información Toxicológica (INTCF): 91 562 04 20**, 24 h y abierto al público;
  emergencias **112**;
- regla de alarma: **síntomas más de 6 h después de comer = urgencia grave**;
- las 10 reglas de descarte, consejos para antes, durante y después de la salida, guardar un ejemplar 72 h y no
  comer nada crudo.

**Fotos:** de iNaturalist y Wikimedia Commons, solo con licencias CC0, CC BY o CC BY-SA (se excluyen las NC).
Se descargan al repo en `img/especies/` como WebP, en lugar de enlazarlas en directo, para que no dependan de
terceros. Cada foto va con su crédito. Se prefieren observaciones de España.

## 8. Diario compartido (Supabase)

- **Proyecto:** Supabase `ctgedeunquvmcfqsufjj`, en la cuenta de Gonzalo, plan gratuito.
- **Acceso: sin login, abierto por decisión de la usuaria (2026-09-30).** No se usa Supabase Auth. La clave
  publicable va en el código y el rol `anon` puede leer y escribir el diario. **Consecuencia:** cualquiera que
  conozca la URL de la web (y por tanto la clave publicable) puede leer, editar y borrar salidas, fotos y umbrales.
  La usuaria asumió este riesgo tras ser advertida. El «autor» es solo un nombre que se elige en el dispositivo.
- **Tablas:**
  - `salidas`: `id`, `fecha`, `zona_id`, `lat`, `lon`, `especies` (jsonb `[{especie_id, kg}]`), `notas`,
    `meteo` (jsonb, foto fija de la serie de ese día), `indice` (jsonb), `autor` (text), `creado`.
  - `fotos`: `id`, `salida_id`, `ruta`, `ancho`, `alto`, `creado`.
  - `ajustes_umbrales`: `especie_id`, `parametros` (jsonb), `autor` (text), `actualizado`.
  - `aemet_cache`: sin políticas; solo la Edge Function (service role) la toca.
- **RLS:** activado en todas las tablas, con políticas explícitas que permiten todo a `anon` y `authenticated`
  en `salidas`, `fotos` y `ajustes_umbrales`.
- **Storage:** bucket `fotos` de lectura pública, con límite de 2 MB y solo `image/jpeg` y `image/webp`; `anon`
  puede subir, cambiar y borrar (solo rutas `.jpg`, `.jpeg` o `.webp`). En el móvil se reducen a un máximo de
  1.600 px y JPEG de calidad 0,8 (unos 300 KB por foto; en 1 GB caben más de 3.000). Se muestran con URL públicas.
- **Edge Function `aemet`:** intermediario con caché (sección 4).
- **Sin conexión:** el alta de salida se guarda en borrador local y se sube después, con aviso visible.

## 9. Arquitectura del código

HTML, CSS y JS sin framework, con módulos ES y sin paso de compilación, como el resto de apps de la casa.
Se publica en GitHub Pages desde `main`.

```
index.html            estructura y navegación
css/                  tokens (tema claro/oscuro) y componentes
js/app.js             arranque y rutas (#hoy, #mapa, #zona/<id>, #especies, #diario, #ajustes)
js/meteo.js           Open-Meteo (serie principal, contraste de modelos, climatología)
js/cache.js           caché en localStorage a prueba de fallos
js/aemet.js           cliente de la Edge Function
js/indice.js          función pura del índice (sin DOM ni red)
js/mapa.js            Leaflet + capas IGN/OSM + cotos
js/diario.js          Supabase: salidas, fotos, borradores
js/fichas.js          render de especies y normativa
js/ui/*.js            componentes (semáforo, gráfico de lluvia, desglose)
data/*.json|geojson   conocimiento investigado, con fuentes
img/especies/         fotos con licencia libre
supabase/             migraciones SQL + Edge Function aemet
scripts/validar-datos.mjs  comprueba que todo dato tiene fuente y fecha y que las referencias cruzadas existen
tests/                node --test: índice y validación de datos
docs/investigacion/   informes de investigación con fuentes
```

- **Librerías:** Leaflet desde CDN con versión fijada. Los gráficos son SVG propio, sin librería.
- **Mapas:** IGN (MTN y PNOA por WMTS, CC BY 4.0, con atribución) y OSM como alternativa, con atribución. No se
  descargan teselas en masa.
- **Diseño visual:** en la construcción se usan los plugins `ui-ux-pro-max` (estructura, sistema de diseño,
  accesibilidad), `design-taste-frontend` y `high-end-visual-design` (estilo) y `brandkit` (logo). Dirección: cuaderno
  de campo moderno, verdes de bosque, tierra y ocre, tipografía cuidada, fotos grandes, modo oscuro, contraste
  AA como mínimo y objetivos táctiles de 44 px o más.

## 10. Pruebas

- **`indice.js`:** casos sintéticos con resultado esperado:
  - otoño húmedo y templado → bueno;
  - sequía → nulo;
  - buena lluvia más helada de −4 °C → corte en *B. edulis* y no en níscalo;
  - lluvia sin arranque de agosto → penalizado;
  - fuera de temporada → 0;
  - datos incompletos → error, no nota.
- **`validar-datos.mjs`:** comprueba que cada especie, norma y coto tenga fuente y fecha, que las confusiones apunten
  a fichas existentes, que las zonas de cada especie existan, que las fotos tengan licencia permitida y que el
  GeoJSON sea válido.
- **Gancho `pre-push` local:** ejecuta ambas antes de cada subida. No se usa GitHub Actions porque el token de la
  cuenta no tiene el permiso `workflow`.
- **Prueba manual en el móvil** antes de dar la v1 por buena: cargar Hoy, abrir una zona, dar de alta una salida con
  foto y comprobar la caída de Open-Meteo (simulada) y el modo oscuro.

## 11. Riesgos y decisiones abiertas

- **Cotos sin cartografía descargable** en Castilla-La Mancha y Álava: se derivan de los montes públicos o se
  digitalizan de forma aproximada (sección 6). El GeoJSON del MITECO pesa 329 MB, pero se procesa una sola vez y
  no va al repo sin recortar.
- **Normativa con lagunas** (Cuenca, Toledo, parques naturales): se muestra «sin confirmar» con la regla general
  hasta la segunda pasada.
- **Umbrales heurísticos** en la mayoría de especies: se mitiga mostrando la confianza y calibrando con el diario.
- **Clave de AEMET:** la tiene que pedir Gonzalo (gratis, por correo). Sin ella, la app funciona solo con modelos y
  lo indica.
- **Supabase:** si el plan gratuito de Gonzalo ya tiene 2 proyectos activos, se reutiliza uno con un esquema propio
  `setas`.

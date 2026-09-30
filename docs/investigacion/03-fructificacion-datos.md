# 03 · Ciencia de la fructificación, datos meteorológicos, fotos y mapas

Investigación para una app personal de previsión de setas (Guadarrama, Sierra Norte de Madrid/Ayllón, Soria, Gredos/Tiétar, Serranía de Cuenca, Guadalajara, Montes de Toledo, Álava).
Fecha de la consulta: 30-09-2026. Las llamadas a las API se probaron en vivo ese día (con curl): respuestas, cabeceras CORS y cobertura de variables.

Leyenda:
- **[EVIDENCIA]**: dato publicado, con cita.
- **[HEURÍSTICA]**: decisión de diseño razonada, sin respaldo numérico directo.
- **[NO VERIFICADO]**: no he podido confirmarlo en la fuente original.

---

## 1. Ciencia de la fructificación

### 1.1 Qué está bien establecido

| # | Hallazgo | Tipo | Fuente |
|---|---|---|---|
| E1 | En *Boletus edulis* (hayedo, Alemania, 10 años de recuentos diarios), el pico de fructificación se asocia a una **temperatura media de ~13 °C en los 20 días previos**. El efecto es cuadrático: el óptimo varía menos de 0,6 °C entre modelos. La fructificación se concentra con **T20 entre 10 y 15 °C** y apenas aparece con T20 de 5–10 °C. | EVIDENCIA (preprint sin revisión por pares, bosque centroeuropeo) | Brejon Lamartiniere & Hoffman, bioRxiv 2025/2026, doi:10.64898/2025.12.12.693895 – https://www.biorxiv.org/content/10.64898/2025.12.12.693895.full.pdf |
| E2 | En el mismo estudio, la lluvia actúa sobre una **ventana acumulada de 26 días** (26–32 días según la parcela). El efecto es **lineal y no tiene techo**: no se encontró un umbral por encima del cual más lluvia deje de ayudar. En los días con setas, la lluvia media de los días previos fue de **2–4 mm/día**, es decir, **≈52–104 mm en 26 días**. Los autores lo atribuyen al tiempo que tarda en acumularse y mantenerse la humedad del suelo. | EVIDENCIA (ídem) | ídem |
| E3 | En pinares de *P. pinaster* de Cataluña (28 parcelas, 2008–2015), la producción depende del tiempo del **mismo mes**, salvo la lluvia, cuyo efecto llega con **~1 mes de retraso**. El calor frena la producción al principio de la temporada y el frío la frena al final. La humedad del suelo explica menos que la lluvia a escala mensual, aunque los autores advierten que a escala diaria o semanal podría rendir mejor. | EVIDENCIA | Karavani et al. 2018, *Agric. For. Meteorol.* 248:432-440, doi:10.1016/j.agrformet.2017.10.024 (versión de tesis: https://medfor.eu/sites/default/files/editor/karavani_et_al_final.pdf) |
| E4 | En encinares catalanes (13 años), la producción total y la de micorrícicas aumentan con la lluvia de septiembre y octubre y con el **número de días de lluvia**. También influye la **fecha en que se alcanzan los primeros 50 mm acumulados desde el 1 de agosto**: cuanto más tarde llegan, menos setas (efecto negativo). La temperatura mínima de octubre y noviembre favorece la producción. Los autores concluyen que conviene que las lluvias lleguen pronto y se mantengan en otoño. | EVIDENCIA | Ponce et al. 2022, *For. Ecol. Manage.* 524:120523 – https://cris.ctfc.cat/docs/upload/27_1233_forecoman_a2022v524p120523.pdf |
| E5 | Los años récord en España (2006 y 2014, con un +270 % y un +210 % sobre la media) se explican sobre todo por la **lluvia de finales de verano e inicio del otoño**, más que por la temperatura. | EVIDENCIA | Martínez de Aragón et al. 2017, *Fungal Ecology* – https://recercat.cat/handle/10459.1/64847 |
| E6 | En el gradiente altitudinal de pinares de *P. sylvestris* (684–1615 m, Cataluña), el principal motor es la lluvia de agosto a octubre (estimador 6,74 ± 2,80) frente a la temperatura (1,52 ± 0,65). | EVIDENCIA | Alday et al. 2017, *Sci. Rep.* 7:45824 – https://pmc.ncbi.nlm.nih.gov/articles/PMC5382911/ |
| E7 | En el Pinar Grande (Soria), en *P. sylvestris*, *B. edulis* rinde más en **otoños cálidos y húmedos** y menos en otoños fríos y secos. El área basimétrica óptima es de ~40 m²/ha, con una media de ~26 kg/ha/año y máximos de 200 kg/ha. | EVIDENCIA (sin coeficientes públicos accesibles) | Martínez-Peña et al. 2012, *For. Ecol. Manage.* 282:63-69 – https://oppla.eu/casestudy/20556 |
| E8 | Pinar Grande (29 años de datos): la lluvia de **julio a septiembre** alarga la temporada y aumenta la producción; el calor en esos meses reduce la duración y la producción de las micorrícicas. La temporada otoñal se está acortando. | EVIDENCIA | Collado et al. (UdL/CTFC), "Climate change-induced shifts in Mediterranean fungal fruiting phenology and productivity" – https://core.ac.uk/outputs/662020453 |
| E9 | Pinar Grande (1995–2013): la fructificación otoñal se ha retrasado una semana desde 2004. | EVIDENCIA | Büntgen et al. 2015, *Fungal Ecology* 16:6-18, doi:10.1016/j.funeco.2015.03.008 |
| E10 | En *Lactarius* gr. *deliciosus* (*P. pinaster*, NE de España), lo que más explica la producción anual es la intensidad del clareo y la **lluvia de agosto y septiembre**. | EVIDENCIA | Bonet et al. 2012, *For. Ecol. Manage.* 265:211-217 – https://agris.fao.org/search/en/records/65df4c2f0f3e94b9e5d71c15 |
| E11 | *P. pinaster* del centro de España (17 años): la lluvia de finales de verano e inicio del otoño es el principal factor meteorológico, tanto para la aparición como para la producción. | EVIDENCIA | Taye et al. 2016, *Fungal Ecology* 23:30-41, doi:10.1016/j.funeco.2016.05.008 – https://portaldelaciencia.uva.es/documentos/63a75afb9ac45918ff1fa489 |
| E12 | En *L. deliciosus* en Soria se han aplicado modelos de aprendizaje automático (red neuronal) que combinan Landsat, estructura forestal y clima; seleccionaron como variables la lluvia de enero y la humedad de noviembre. Son modelos de producción anual, no de fecha. | EVIDENCIA | Martínez-Rodrigo et al. 2024, *Sustainability* 16:5656 – https://ideas.repec.org/a/gam/jsusta/v16y2024i13p5656-d1427594.html |
| E13 | En encinares de Toscana, el número de carpóforos se correlaciona sobre todo con la **lluvia de los 30 días previos**. Se probaron ventanas de 5, 10, 15 y 30 días. | EVIDENCIA | Salerni et al. 2002, *Isr. J. Plant Sci.* – https://usiena-air.unisi.it/handle/11365/3048 |
| E14 | En *Morchella* (Missouri), el mejor predictor de la primera aparición es el calor acumulado en el suelo por encima de 0 °C durante 20 días: **410 °F·día**, que equivalen a ≈228 °C·día, es decir, una **media de ≈11,4 °C de suelo en 20 días** (conversión propia). Las colmenillas suelen salir con el suelo a 10–15,5 °C, y los inviernos muy suaves retrasan la aparición. | EVIDENCIA (EE. UU.) | Mihail 2014, *McIlvainea* 23:53-60, resumido en https://naturalresources.extension.iastate.edu/post/soil-temperatures-predictors-mushroom-emergence |
| E15 | Aislados de *Amanita caesarea* del SO de España: el micelio crece mejor in vitro a **24–28 °C**. Esto se refiere al micelio, no a la fructificación. | EVIDENCIA (laboratorio) | Daza et al. 2006, *Mycorrhiza* 16:133-136, doi:10.1007/s00572-005-0025-6 |
| E16 | *Pleurotus eryngii* en cultivo: la temperatura óptima de fructificación es de 10–18 °C. | EVIDENCIA (cultivo, no silvestre) | Resultado de búsqueda (ISHS/Korea Science) – https://ishs.org/ishs-article/1123_29/ [NO VERIFICADO en texto completo] |

### 1.2 Observación de campo de Cesefor/Micocyl (Castilla y León)

Son partes semanales que Cesefor elabora a partir de sus parcelas de inventario. No son un modelo, pero sí observación experta:

- «Las abundantes lluvias de los últimos días, **con precipitaciones que han superado los 50 l/m²** en muchos lugares, están provocando la fructificación de nuevos níscalos, aún de forma poco abundante. **Aún tendremos que esperar semanas** para obtener buenas producciones». Del níscalo añaden que soporta temperaturas más bajas y que no es raro recolectarlo «bien entrado el mes de diciembre». De la seta de cardo: «la rapidez con la que se ha activado el micelio … tras la reciente lluvia nos hace pensar que **en pocos días** se incrementará». El parte también dice que la falta de lluvia y el calor de octubre cortaron la continuidad de *B. edulis*, y que las heladas inminentes hacían improbables nuevos picos. Fuente: https://www.micocyl.es/sites/default/files/editor/parte_mico_20211104.pdf
- Con lluvia abundante y temperaturas suaves, «se puede esperar una buena producción de setas en los **próximos 7-10 días**». Sobre *B. edulis*: «descenso en la fructificación … debido al **descenso térmico** y al tratarse de una especie con cierto carácter termófilo». Añade que *A. caesarea* es una «especie más termófila». En Zamora, suelos «muy secos» pese a las lluvias intensas: «si las lluvias continúan, se espera que la campaña comience con fuerza **en dos o tres semanas**», siempre que no haya heladas tempranas. Fuente: https://micocyl.es/sites/default/files/editor/parte_mico_20241010.pdf
- El níscalo sigue produciendo «hasta la llegada de las heladas intensas». Se dan condiciones adecuadas cuando hay «abundante acumulación de humedad en el suelo y … suaves temperaturas, con ausencia de heladas». Los ejemplares aislados de *B. edulis* a finales de noviembre aparecen en zonas «que no han sufrido fuertes heladas y las temperaturas se han mantenido en valores positivos». Fuentes: https://www.micocyl.es/sites/default/files/editor/parte_mico_231118_.pdf y https://www.micocyl.es/sites/default/files/editor/parte_mico_291118_.pdf
- Modelo espacial MICODATA-SIG (Cesefor): combina un modelo descriptivo (IFN3, suelo y clima) con otro predictivo basado en datos climáticos de baja resolución espacial y temporal. Sus coeficientes no son públicos. Fuente: https://redpac.es/sites/default/files/documents/3_1_MIKOGEST.pdf.pdf
- CTFC (Cataluña): hace previsiones de temporada con modelos ajustados a más de 80 parcelas con meteorología propia. En el níscalo (rovelló), la variable que más pesa es la lluvia de septiembre y octubre. La herramienta no está publicada como API. Fuentes: https://naciodigital.cat/osona/societat/el-ctfc-augura-una-fluixa-temporada-de-bolets.html, https://blog.ctfc.cat/?p=10610

### 1.3 Síntesis por variable

- **Lluvia acumulada.** La mejor ventana documentada es de **~26–30 días** (E2, E3, E13). El efecto es monótono y sin techo (E2). En referencia, 52–104 mm en 26 días en los días con setas (E2, clima atlántico-continental). Como disparador puntual, Micocyl habla de **más de 50 l/m² en pocos días** (§1.2). A escala de temporada, los primeros 50 mm desde el 1 de agosto marcan el arranque, y cuanto antes mejor (E4).
- **Desfase entre lluvia y seta.** Saprótrofos rápidos como *Pleurotus eryngii*: «pocos días». Micorrícicos: **7–10 días** si el suelo ya estaba húmedo, y **2–3 semanas o más** si venía seco (§1.2). A escala mensual, ~1 mes (E3). *Lactarius* tras sequía: «semanas».
- **Temperatura del aire.** Óptimo de *B. edulis* en **T20 ≈ 13 °C** (10–15 °C) (E1). El calor persistente frena el inicio de temporada (E3, E8) y el frío la termina (E3). *Lactarius* tolera menos temperatura que *B. edulis* (§1.2). *A. caesarea* y *B. aereus*/*reticulatus* son termófilos (§1.2; E15 solo para micelio).
- **Temperatura del suelo.** Solo hay un umbral numérico sólido para *Morchella*: una media de ≈11 °C en 20 días (E14). Para las especies de otoño no he encontrado umbrales españoles [NO VERIFICADO].
- **Humedad del suelo.** Es el mecanismo intermedio: la lluvia actúa a través de la humedad del suelo (E2, E3). No existen umbrales publicados en m³/m³ que valgan para cualquier suelo, porque dependen de la textura. Hay que normalizarla por punto, por ejemplo con percentiles.
- **Heladas.** Hay evidencia cualitativa de que cortan *B. edulis* y, con heladas «intensas» o «prolongadas», también *Lactarius*, *Cantharellus* y *Tricholoma* (§1.2). La mínima de octubre y noviembre favorece la producción (E4). No he encontrado un umbral numérico publicado (del tipo "−2 °C") [NO VERIFICADO]: cualquier cifra es HEURÍSTICA.
- **Viento y evapotranspiración.** Se citan como causa de la pérdida de humedad del suelo (E3), pero no he encontrado umbrales diarios publicados. Uso de ET0 y viento: HEURÍSTICA.
- **Humedad relativa.** La HR máxima de septiembre entró en uno de los modelos de Karavani (E3); es un indicador débil.

### 1.4 Parámetros por especie

Solo *B. edulis* (T20 y P26) y *Morchella* (suelo) tienen umbrales numéricos publicados. Todo lo demás es heurística calibrable a partir del calendario y de las notas cualitativas de Micocyl. Esta tabla está pensada para configurar la app y ajustarla con tus propias salidas.

| Especie | Temporada (centro peninsular) | T20 óptima (aire) | Lluvia en 26 días: mínimo → pleno | Desfase típico | Tolerancia a helada | Base |
|---|---|---|---|---|---|---|
| *Boletus edulis* | sep–nov (primavera ocasional) | 13 °C (10–15) | 30 → 90 mm | 7–21 d | baja: se corta tras heladas | E1, E2, E7, §1.2 |
| *B. pinophilus* | sep–nov; jun en montaña | 12 °C (9–15) | 30 → 90 mm | 7–21 d | baja | HEURÍSTICA (análoga a *edulis*) |
| *B. aereus*, *B. reticulatus* | jun–oct, con tormentas cálidas | 17 °C (14–21) | 25 → 70 mm | 7–14 d | muy baja | HEURÍSTICA (termófilos, §1.2) |
| *Lactarius deliciosus* | oct–dic | 10 °C (6–14) | 40 → 100 mm | 10–25 d | media: aguanta hasta heladas intensas | E10, E11, §1.2 |
| *L. sanguifluus* | oct–nov | 12 °C (8–15) | 40 → 100 mm | 10–25 d | media | HEURÍSTICA |
| *Cantharellus cibarius* | jun–oct | 15 °C (11–19) | 30 → 80 mm | 7–14 d | baja | HEURÍSTICA |
| *Craterellus* / *C. tubaeformis*, *C. lutescens* | nov–dic | 8 °C (4–12) | 40 → 100 mm | 10–20 d | media: no aguanta heladas «prolongadas pronunciadas» | §1.2 (cualitativo) |
| *Pleurotus eryngii* | oct–dic; mar–may | 13 °C (10–18) | 20 → 60 mm | 3–10 d | media | E16 (cultivo), §1.2 («pocos días») |
| *Amanita caesarea* | jul–oct | 19 °C (16–23) | 25 → 70 mm | 7–14 d | nula | E15 (micelio), §1.2 |
| *Tricholoma* (*portentosum*, *terreum*) | nov–dic | 8 °C (4–12) | 30 → 80 mm | 10–20 d | media | §1.2 (cualitativo) |
| *Hydnum repandum* | oct–dic | 10 °C (6–14) | 30 → 80 mm | 10–20 d | media | §1.2 (cualitativo) |
| *Macrolepiota procera* | sep–nov | 14 °C (10–18) | 25 → 60 mm | 5–12 d | baja | §1.2 (cualitativo) |
| *Morchella* | mar–may | suelo: media en 20 d ≥ 10–11 °C (10–15,5) | 20 → 50 mm | 5–15 d | — (primavera) | E14 |
| *Hygrophorus marzuolus* | feb–abr, tras deshielo | 5 °C (2–9) | 20 → 60 mm | — | alta | HEURÍSTICA |
| *Calocybe gambosa* | abr–jun | 12 °C (9–15) | 20 → 60 mm | 7–14 d | media | HEURÍSTICA (calendario "St George's") |
| *Agaricus campestris* | sep–nov | 14 °C (10–18) | 20 → 60 mm | 3–10 d | baja | §1.2 (cualitativo) |

### 1.5 Propuesta de índice 0–100

El índice es transparente: cada factor se muestra en pantalla por separado.

**Datos por punto de zona y día** (Open-Meteo, §2): `precipitation_sum`, `temperature_2m_mean`, `temperature_2m_min`, `soil_temperature_0_to_7cm_mean`, `soil_moisture_0_to_10cm_mean` (u horario `soil_moisture_0_to_7cm`), `et0_fao_evapotranspiration`, `wind_speed_10m_max` y `relative_humidity_2m_mean`. Se piden `past_days=45` y `forecast_days=10`.

Factores, cada uno entre 0 y 1. Para cada especie se toman los parámetros de la tabla 1.4.

1. **Agua acumulada, `fW`.** P26 es la suma de lluvia de los 26 días anteriores al día evaluado.
   `fW = clamp((P26 − Pmin) / (Pfull − Pmin), 0, 1)`.
   *Evidencia*: ventana de 26 días (E2) y efecto lineal sin techo (E2), de ahí el tramo lineal. *Heurística*: los valores Pmin y Pfull concretos para el clima ibérico.
2. **Disparador reciente, `fR`.** Se busca el mayor episodio de lluvia de 3 días (`P3max`) y el número de días transcurridos desde él (`lag`). Si `lag` cae dentro del desfase de la especie, fR = 1; si no, decae con una gaussiana de σ = 5 días.
   Escala: `fR = clamp(P3max / 30, 0, 1) × ventana(lag)`.
   *Evidencia*: el desfase de 7–10 días a 2–3 semanas y la cifra de 50 l/m² (§1.2). *Heurística*: la escala de 30 mm y la forma de la curva.
3. **Temperatura, `fT`.** T20 es la media de `temperature_2m_mean` de los 20 días previos.
   `fT = exp(−((T20 − Topt)/σT)²/2)`, con σT = la mitad del rango de la tabla.
   *Evidencia*: la ventana de 20 días y el óptimo de 13 °C con respuesta cuadrática en *B. edulis* (E1). *Heurística*: el resto de especies.
   En *Morchella*, fT se sustituye por la media de 20 días de `soil_temperature_0_to_7cm_mean`, con óptimo en 12 °C y rango 10–15,5 °C (E14).
4. **Humedad del suelo, `fS`.** Se calcula el percentil de la humedad actual respecto a la serie del mismo punto en los últimos 2–3 otoños. La serie se descarga una vez del archive y se guarda en caché.
   `fS = clamp((pct − 20) / 50, 0, 1)`: 0 por debajo del percentil 20 y 1 a partir del 70.
   *Evidencia*: la lluvia actúa a través de la humedad del suelo (E2, E3). *Heurística*: el uso de percentiles y los cortes; se eligieron así porque los valores absolutos dependen del modelo y del suelo.
5. **Arranque de temporada, `fA`** (solo especies de otoño). Si desde el 1 de agosto no se han acumulado 50 mm, fA = 0,3; si sí, fA = 1.
   *Evidencia*: E4.
6. **Calendario, `fC`.** Vale 1 dentro de la temporada de la especie, 0,5 en el mes anterior o posterior y 0 fuera.
   *Heurística*: calendario.

**Combinación.** Se usa una media geométrica ponderada, para que un factor cercano a cero hunda el resultado, como ocurre en la biología:

```
base = fW^0.35 · fT^0.25 · fS^0.20 · fR^0.20        (pesos: HEURÍSTICA; W>T coherente con E5, E6)
I    = 100 · base · fA · fC · Pen
```

**Penalizaciones, `Pen`** (se multiplican; todas son HEURÍSTICA, apoyadas en la evidencia cualitativa de §1.2):

- Helada: por cada noche de los últimos 7 días con `temperature_2m_min ≤ 0 °C` se multiplica por 0,85. Si alguna noche baja de −3 °C, por 0,5; en especies de tolerancia "baja" o "nula", por 0,2.
- Desecación: si la ET0 de los últimos 7 días supera en más de 15 mm a la lluvia de esos 7 días, y además la HR media es inferior al 55 % o `wind_speed_10m_max` supera los 35 km/h durante 3 días o más, se multiplica por 0,75.
- Calor persistente al inicio de temporada: si T20 supera el máximo del rango de la especie en más de 4 °C, se multiplica por 0,6 (coherente con E3 y E8).

**Previsión.** El índice de los próximos días se calcula igual, pero la lluvia prevista se multiplica por 0,8 en los días 1–3, por 0,6 en los días 4–7 y por 0,4 a partir del día 8. Esto es HEURÍSTICA para reflejar la incertidumbre. Opcionalmente se muestra la horquilla entre modelos (ECMWF, ICON y AROME, §2).

**Etiquetas.** 0–20 nulo · 20–40 bajo · 40–60 posible · 60–80 bueno · 80–100 muy bueno.

**Calibración.** Guarda tus salidas en un diario (fecha, zona, especie y kg). Con 2–3 temporadas se pueden reajustar Pmin, Pfull, Topt y los pesos, por ejemplo por máxima verosimilitud con una regresión binomial negativa como la de E1.

**Advertencia.** La mayor parte de la varianza entre años y parcelas depende de factores no meteorológicos: área basimétrica, edad y clareos, pH y textura del suelo (E7, E10, E11, Ponce 2022). El índice solo estima la oportunidad meteorológica, no la producción del monte.

```js
// Esbozo (pseudocódigo)
function indice(d /* arrays diarios alineados, i = día evaluado */, i, sp) {
  const sum = (a, n) => a.slice(Math.max(0, i - n + 1), i + 1).reduce((s, x) => s + (x ?? 0), 0);
  const mean = (a, n) => sum(a, n) / n;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const P26 = sum(d.precip, 26), T20 = mean(d.tmean, 20);
  const fW = clamp((P26 - sp.pmin) / (sp.pfull - sp.pmin));
  const fT = Math.exp(-(((sp.soilT ? mean(d.tsoil, 20) : T20) - sp.topt) / sp.sigma) ** 2 / 2);
  // fR: mayor lluvia de 3 días en los últimos 30 y días desde ella
  let best = 0, lag = 99;
  for (let k = 0; k < 30; k++) { const p3 = sum(d.precip.slice(0, i - k + 1), 3); if (p3 > best) { best = p3; lag = k; } }
  const inLag = lag >= sp.lagMin && lag <= sp.lagMax ? 1
    : Math.exp(-((lag < sp.lagMin ? sp.lagMin - lag : lag - sp.lagMax) / 5) ** 2 / 2);
  const fR = clamp(best / 30) * inLag;
  const fS = clamp((d.soilPct[i] - 20) / 50);
  const base = fW ** 0.35 * fT ** 0.25 * fS ** 0.20 * fR ** 0.20;
  return Math.round(100 * base * fA(d, i, sp) * fC(d.date[i], sp) * penalizaciones(d, i, sp));
}
```

---

## 2. Datos meteorológicos

### 2.1 Open-Meteo: endpoints

- **Forecast**: `https://api.open-meteo.com/v1/forecast`. Admite `past_days` de 0 a 92, `forecast_days` de 0 a 16 (7 por defecto), `models` (por defecto `best_match`) y `timezone` (por ejemplo `Europe/Madrid` o `auto`). Documentación: https://open-meteo.com/en/docs
- **Historical Weather (archive)**: `https://archive-api.open-meteo.com/v1/archive` con `start_date` y `end_date`. Fuentes: ERA5 (0,25°, desde 1940), ERA5-Land (0,1° ≈ 11 km), ECMWF IFS (9 km, sin retraso) y CERRA (5 km, Europa, discontinuada en 2021). La documentación indica unos 5 días de retraso para ERA5 y ERA5-Land. Documentación: https://open-meteo.com/en/docs/historical-weather-api
  - **Prueba real, 30-09-2026**: con `models=era5_land` devolvió `null` para todo septiembre de 2026, así que el retraso real era mayor que el documentado. Sin especificar modelo, el archive rellenó hasta el 29-09 (probablemente con IFS).
  - **Conclusión para la app**: para los últimos 45 días, usar el **forecast con `past_days`**, que siempre está al día. El archive solo sirve para la climatología de percentiles.
- **Historical Forecast**: `https://historical-forecast-api.open-meteo.com/v1/forecast`, que guarda las previsiones pasadas enlazadas. Útil para calibrar. Probado con datos de 2025.

### 2.2 Variables relevantes, verificadas en vivo el 30-09-2026 con respuesta HTTP 200

**Diarias** (`daily=`): `precipitation_sum`, `rain_sum`, `temperature_2m_max`, `temperature_2m_min`, `temperature_2m_mean`, `et0_fao_evapotranspiration` (mm), `wind_speed_10m_max` (km/h), `relative_humidity_2m_mean` (%), `soil_moisture_0_to_10cm_mean` (m³/m³) y `soil_temperature_0_to_7cm_mean` (°C). Todas devolvieron datos en el forecast. En el archive probé `soil_moisture_0_to_7cm_mean` y `soil_temperature_0_to_7cm_mean`, que funcionaron.

**Horarias** (`hourly=`):
- **Capas ECMWF, disponibles en forecast y archive**: `soil_temperature_0_to_7cm`, `_7_to_28cm`, `_28_to_100cm`, `_100_to_255cm`, y `soil_moisture_0_to_7cm`, `_7_to_28cm`, `_28_to_100cm`, `_100_to_255cm`.
- **Capas ICON/GFS, solo en forecast**: `soil_temperature_0cm`, `_6cm`, `_18cm`, `_54cm`, y `soil_moisture_0_to_1cm`, `_1_to_3cm`, `_3_to_9cm`, `_9_to_27cm`, `_27_to_81cm`.

**Cobertura del suelo por modelo**, probada en Gredos (40,8 N; −4,0 E) el 30-09-2026:

| models= | precipitación | suelo 0–7 cm (ECMWF) | suelo 1–3 cm / 6 cm (ICON) |
|---|---|---|---|
| `ecmwf_ifs` (9 km) | sí | **sí** | no |
| `ecmwf_ifs025` | sí | **sí** | no |
| `icon_eu` (~7 km) | sí | no | **sí** |
| `meteofrance_arome_france` / `_hd` (el dominio cubre la Península) | sí | no | no |
| `ukmo_global_deterministic_10km`, `gfs_seamless` | sí | no | no |
| `knmi_harmonie_arome_europe`, `dmi_harmonie_arome_europe` | «No data is available for this location» | | |
| `aemet_harmonie` | **no existe**: «Invalid value» | | |

Open-Meteo **no ofrece AEMET HARMONIE**; la página de licencia tampoco cita a AEMET entre sus fuentes (https://open-meteo.com/en/licence). Con `best_match` sí devolvió todas las variables de suelo de ambas familias, combinando modelos. **Recomendación**: pedir la lluvia con `best_match` (o comparar `ecmwf_ifs`, `icon_seamless` y `meteofrance_seamless`) y el suelo con las variables 0–7 cm de ECMWF, que están disponibles de forma coherente en forecast y en archive.

### 2.3 URLs de ejemplo, todas probadas

Las coordenadas son aproximadas; ajústalas a tus montes.

```
# Soria (Pinar Grande aprox.) – 45 días pasados + 10 de previsión, todo lo necesario
https://api.open-meteo.com/v1/forecast?latitude=41.85&longitude=-2.65&daily=precipitation_sum,temperature_2m_mean,temperature_2m_min,temperature_2m_max,soil_temperature_0_to_7cm_mean,soil_moisture_0_to_10cm_mean,et0_fao_evapotranspiration,wind_speed_10m_max,relative_humidity_2m_mean&past_days=45&forecast_days=10&timezone=Europe%2FMadrid

# Varias zonas en una sola llamada (latitude/longitude admiten listas separadas por comas; devuelve un array)
https://api.open-meteo.com/v1/forecast?latitude=40.78,41.25,41.85,40.30,40.35,40.95,39.45,42.65&longitude=-4.03,-3.47,-2.65,-4.95,-1.85,-2.75,-4.05,-2.50&daily=precipitation_sum,temperature_2m_mean,temperature_2m_min&past_days=45&forecast_days=10&timezone=Europe%2FMadrid
#   (Guadarrama, Ayllón/Riaza, Soria, Gredos-Tiétar, Serranía de Cuenca, Guadalajara, Montes de Toledo, Izki-Álava)

# Horario de suelo por modelo
https://api.open-meteo.com/v1/forecast?latitude=40.8&longitude=-4.0&hourly=soil_moisture_0_to_7cm,soil_temperature_0_to_7cm,soil_moisture_1_to_3cm,soil_temperature_6cm&models=ecmwf_ifs,icon_eu&forecast_days=3

# Climatología para percentiles (archive)
https://archive-api.open-meteo.com/v1/archive?latitude=41.85&longitude=-2.65&start_date=2023-08-01&end_date=2025-12-31&daily=precipitation_sum,soil_moisture_0_to_7cm_mean,soil_temperature_0_to_7cm_mean,et0_fao_evapotranspiration&timezone=Europe%2FMadrid

# Previsiones pasadas (calibración)
https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=40.35&longitude=-4.95&start_date=2025-10-01&end_date=2025-10-31&daily=precipitation_sum,soil_moisture_0_to_10cm_mean
```

Todas las URLs se probaron en vivo. La de varias ubicaciones devuelve un **array JSON** con un objeto por punto.

**Atención a la altitud.** El punto de Guadarrama (40,78 N; −4,03 E) cayó en una celda con `elevation` 2097 m, que no representa un pinar a 1300–1500 m. Conviene elegir las coordenadas del monte real y pasar `&elevation=<m>`: Open-Meteo usa ese parámetro para corregir la temperatura por altitud [el parámetro aparece en la documentación del forecast; su efecto exacto está NO VERIFICADO].

### 2.4 Límites, CORS, licencia y atribución

- **CORS**: verificado con cabecera `Origin`. Tanto el forecast como el archive responden `access-control-allow-origin: *`, así que se pueden llamar directamente desde el navegador.
- **Límites gratuitos**: el plan gratuito es solo para **uso no comercial**. Los límites son menos de 10 000 llamadas al día, 5 000 por hora y 600 por minuto, y 300 000 al mes. No hace falta clave. Una llamada con muchas variables o muchos días cuenta como varias llamadas «ponderadas» [NO VERIFICADO: la fórmula exacta está en la web de precios]. Fuente: https://open-meteo.com/en/terms
- **Licencia de los datos**: CC BY 4.0. Hay que dar crédito, enlazar la licencia e indicar si se hicieron cambios. Atribución sugerida: `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>`. Fuente: https://open-meteo.com/en/licence
- **Uso para una app personal**: cabe en el plan gratuito. Con 8 zonas y una llamada múltiple cada 1–3 horas se consume muy poco.

### 2.5 AEMET OpenData, comparación breve

- **Acceso**: requiere una **API key gratuita**, que se obtiene con un correo en https://opendata.aemet.es/centrodedescargas/inicio. Funciona en **dos pasos**: la primera petición devuelve un JSON con una URL temporal en `datos` (y otra en `metadatos`), y la segunda descarga el dato real. El límite es de **50 peticiones por minuto**. Fuente: https://datos.gob.es/es/blog/api-en-las-administraciones-publicas-cuales-hay-y-como-utilizarlas
- **CORS**: una petición sin clave a `https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/42173` respondió 200 con `Access-Control-Allow-Origin: *` y el cuerpo vacío. El CORS parece abierto, pero la clave quedaría expuesta en el cliente. Lo prudente es pasar por un proxy o función serverless.
- **Atribución**: «Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma».
- **Qué ofrece**: predicción por municipio (no por coordenadas), observación convencional de estaciones y valores climatológicos diarios. **No publica humedad ni temperatura del suelo en rejilla** por esta API [NO VERIFICADO de forma exhaustiva]. Tampoco sirve directamente la rejilla HARMONIE-AROME como serie por punto.
- **Veredicto**: Open-Meteo como fuente principal, por coordenadas, con variables de suelo y ET0 y sin clave. AEMET como contraste opcional: la lluvia observada en estaciones cercanas sirve para corregir el sesgo del modelo.

---

## 3. Fotos de especies con licencia libre

### 3.1 iNaturalist API v1

Probada en vivo; responde con `Access-Control-Allow-Origin: *`.

- **Taxón con foto por defecto**: `https://api.inaturalist.org/v1/taxa?q=Boletus%20edulis&rank=species&per_page=1`. Devuelve `default_photo` con `medium_url`, `license_code` y `attribution`. Ojo: la foto por defecto de *B. edulis* tenía licencia **cc-by-nc**, que no es "libre" en sentido estricto.
- **Observaciones de España con licencias libres** (`place_id=6774` = Spain, verificado con `/v1/places/autocomplete?q=Spain`): `https://api.inaturalist.org/v1/observations?taxon_name=Lactarius%20deliciosus&photo_license=cc-by,cc-by-sa,cc0&quality_grade=research&place_id=6774&per_page=5`. Probado: devolvió 67 resultados; la primera foto era cc0.
- **Tamaños**: se cambia `square` por `small`, `medium`, `large` u `original` en la URL `https://inaturalist-open-data.s3.amazonaws.com/photos/{id}/{tamaño}.jpg`.
- **Atribución**: el campo `attribution` ya viene formateado (por ejemplo «(c) autor, some rights reserved (CC BY)»). Se muestra junto con la licencia y un enlace a la observación.
- **Uso razonable**: máximo 100 peticiones por minuto, recomendado 60 o menos por minuto y menos de 10 000 al día. Descargar más de 5 GB por hora o 24 GB al día de medios puede acarrear un bloqueo permanente. Fuente: foros y páginas de desarrolladores de iNaturalist, https://inaturalist.ala.org.au/pages/developers y https://forum.inaturalist.org/t/429-error-from-observations-histogram-api-when-calling-at-60-calls-minute/64709/13. La página oficial https://www.inaturalist.org/pages/api+recommended+practices dio error 403 al consultarla [cifras NO VERIFICADAS en la página oficial].
- **Recomendación**: resolver una sola vez por especie y guardar en caché la URL y la atribución en el propio JSON de la app.

### 3.2 Wikimedia Commons, MediaWiki Action API

Probada; con `origin=*` responde con `access-control-allow-origin: *`.

```
https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=Boletus%20edulis%20filetype:bitmap&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json&origin=*
```

- En `imageinfo[0]` vienen `thumburl` y `extmetadata.LicenseShortName`, `LicenseUrl`, `Artist` (HTML) y `Credit`. En la prueba salió, por ejemplo, «CC BY 3.0 – Holger Krisp».
- `iiurlwidth=640` devolvió una miniatura de 960 px: Wikimedia redondea a tamaños estándar.
- **Alternativa sencilla**, la imagen principal del artículo: `https://es.wikipedia.org/api/rest_v1/page/summary/Boletus_edulis`. Devuelve `thumbnail.source` y `originalimage.source`, con CORS `*`. Esta vía **no trae la licencia**: hay que consultarla aparte en Commons con `titles=File:...`.
- **Cabecera**: desde el navegador no se puede cambiar el `User-Agent`. La política de Wikimedia pide enviar `Api-User-Agent: MiAppSetas/1.0 (contacto)`. Fuente: https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy
- **Atribución**: autor, licencia con enlace y enlace a la página del archivo. Las licencias CC BY-SA obligan a indicar la licencia. Hay que filtrar las que no sean CC0, PD, CC BY o CC BY-SA.

---

## 4. Mapas base

Todos los tiles se probaron el 30-09-2026 con z=14 en Soria y devolvieron HTTP 200 con `Access-Control-Allow-Origin: *`.

| Capa | Plantilla de tiles (XYZ o WMTS KVP, EPSG:3857) | Condiciones |
|---|---|---|
| **IGN PNOA, ortofoto** (máxima actualidad) | WMTS: `https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0&layer=OI.OrthoimageCoverage&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}` · TMS: `https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg` (con Y invertida al estilo TMS) | CC BY 4.0 (Orden FOM/2807/2015). Atribución con el formato «<producto> <fecha> CC-BY 4.0 <productor>», por ejemplo «PNOA cedido por © Instituto Geográfico Nacional – scne.es» [la redacción exacta hay que comprobarla en el PDF] – https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf · catálogo: https://www.idee.es/csw-codsi-idee/srv/api/records/spaignwmts_pnoa-ma |
| **IGN MTN, mapa topográfico ráster** | WMTS: `https://www.ign.es/wmts/mapa-raster?service=WMTS&request=GetTile&version=1.0.0&layer=MTN&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}` · TMS: `https://tms-mapa-raster.ign.es/1.0.0/mapa-raster/{z}/{x}/{-y}.jpeg` | CC BY 4.0 del IGN (ídem) |
| **IGN Base, vectorial rasterizado** | `https://www.ign.es/wmts/ign-base?service=WMTS&request=GetTile&version=1.0.0&layer=IGNBaseTodo&style=default&format=image/png&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}` | CC BY 4.0 del IGN |
| **OpenStreetMap** | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Atribución visible «© OpenStreetMap contributors». Referer válido, caché de al menos 7 días. **Prohibido** precargar, descargar en masa o usar sin conexión. Sin SLA. https://operations.osmfoundation.org/policies/tiles/ |
| **OpenTopoMap** (curvas de nivel, opcional) | `https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png` | CC BY-SA, «© OpenStreetMap contributors, SRTM · © OpenTopoMap» [condiciones NO VERIFICADAS en su web] |

En Leaflet, `L.tileLayer` sirve para los tiles XYZ de OSM. Con la URL WMTS KVP también funciona sustituyendo `{z}/{x}/{y}` en `tilematrix`, `tilecol` y `tilerow`. Otra opción es la URL TMS con `tms: true`.

Para una app personal, lo recomendable es el MTN o la PNOA del IGN como capa principal, que tienen más detalle en montes españoles y no imponen la política restrictiva de OSM, con OSM como alternativa.

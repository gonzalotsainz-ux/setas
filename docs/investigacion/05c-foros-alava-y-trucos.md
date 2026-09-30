# 05c. Foros y comunidades: sitios de Álava y trucos por especie

Consulta realizada el 2026-09-30. Todo en palabras propias. Complementa a `04d-trucos-por-especie.md` y `04c-sitios-toledo-alava.md`. No se ha hecho commit.

## 0. Advertencias (leer primero)

1. **Reddit no se pudo leer.** `reddit.com`, `old.reddit.com` y el espejo `r.jina.ai` están bloqueados para la herramienta (error "unable to fetch" o 403). Tampoco respondieron `api.pullpush.io` (vacío) ni `redlib` (429). No hay ningún dato de r/Setas ni r/mycology en este informe. Queda pendiente hacerlo a mano.
2. **Buscadores:** Brave dio 429 y DuckDuckGo pidió CAPTCHA. Bing funcionó, pero ignora `site:` y con consultas largas devuelve basura (Forocoches, Yahoo...). Solo las consultas cortas con el nombre del foro dieron hilos útiles.
3. **Los foros españoles de micología casi no dan trucos con detalle.** Fungipedia es sobre todo identificación (su buscador interno ignora la consulta) y Foro Micológico (SMF) tiene 664 usuarios y prohíbe por norma dar zonas concretas en público (ver A4). Lo que hay de Álava en foros es escaso y viejo (2010). El resto del material útil viene de blogs, asociaciones, prensa y webs comerciales, y lo marco así.
4. **Las páginas se leyeron con un resumen automático**, no literal. Las cifras pueden tener errores. Ejemplos de fallo ya detectados: la fecha del hilo Foro Micológico 30912 sale como 2021 en el listado y 2017 en los mensajes; un resumen llamó "Rías Baixas" a un mensaje del País Vasco; otro tradujo "perretxicos" como boletus en un mensaje de 2010 (en la zona "perretxiko" es la seta de primavera; ese mensaje es ambiguo). Conviene abrir el original antes de publicar cualquier cifra.
5. **Fechas de Foro Micológico:** los hilos antiguos llevan fecha, pero los mensajes individuales no siempre coinciden con el listado. Todo lo de 2010-2017 va marcado [MENSAJE ANTIGUO >10 años] (lo es, salvo indicación).
6. **No se encontró ninguna evidencia** de la "Arabako Mikologia Elkartea" ni de un foro de Gorbeiako Bazterra. Sí existen Aranzadi (sección de Micología), Gorbeia Mikologia, Micología para Todos y Gorbeiako Bazterra (ya en 04c). Ver A13.

Siglas de fuentes: FM = foromicologico.es (SMF, formato `index.php?topic=ID.0`); FP = Fungipedia; FC = Forocoches; CyS = cestaysetas.com; LCDLS = lacasadelassetas.com; SE = silvestresezcaray.com; GH = gasteizhoy.com.

---

## A. Álava: sitios, permisos y trucos locales

### A1. ALERTA NORMATIVA: Gorbeia (Urkabustaiz, Zigoitia, Zuia) tiene parque micológico con permiso obligatorio
- **Hallazgo:** la web oficial del Parque Micológico de Gorbeialdea dice que en 2022 tres municipios (Urkabustaiz, Zigoitia y Zuia) pusieron en marcha un sistema para regular la recogida. Hace falta permiso. Precios para 2026: **10 € diario, 15 € semanal (lunes a domingo), 50 € temporada (1/01 a 31/12/2026)**, sin distinción de empadronado en lo que se pudo leer. Máximo 2 kg por persona y día. Horario: desde **una hora después del amanecer** hasta la puesta de sol. Puede prohibirse recoger en días de caza, con tiempo adverso y en las fechas que fije la Diputación. Hay que llevar el permiso y enseñarlo. Existen permisos especiales para asociaciones micológicas sin ánimo de lucro.
- **Fuente:** https://www.gorbeiamikologia.eus/es/permisos/ y https://www.gorbeiamikologia.eus/es/parque-micologico/ (sede: Plaza del Ayuntamiento 1, 1º, Murgia; tel. 945 610 733; info@gorbeiamikologia.eus). Web oficial, consultada 2026-09-30. [UNA SOLA FUENTE, pero oficial]
- **Choque con el repo:** `docs/investigacion/04c-sitios-toledo-alava.md` (líneas 65 y 72) dice que Gorbeia es **libre, 2 kg/día** porque el PRUG remite al DF 89/2008. Eso es cierto para el Parque Natural como tal, pero **los hayedos de Urkabustaiz, Zigoitia y Zuia están dentro del parque micológico con permiso**. `data/normativa.json` solo trae `eus-gorbeia-prug` y `data/cotos.geojson` no tiene ningún polígono de Gorbeia (solo arraia, arcena, asparrena-apota, gordoa y el BU-50021 de Burgos). **Acción recomendada:** crear una norma `alava-parque-micologico-gorbeia` (permiso obligatorio, tarifas 2026) y marcar el hayedo de Sarría como permiso necesario. Falta comprobar el mapa exacto del ámbito (MUP incluidos) y si el 2 kg convive con el DF 89/2008. [NO VERIFICADO el polígono]
- Nota de contraste: GH (25/11/2023) y GH (28/09/2024) no mencionan Gorbeia entre las zonas acotadas (hablan de Izki, Arraia y Árcena como "tres permanentes"), aunque el parque de Gorbeia llevaba ya un año. Esas notas de prensa están desfasadas en ese punto.

### A2. Orduña y Valle de Ayala: rebozuelo, mucha gente y zona castigada
- **Hilo:** "ORDUÑA-VALLE DE AYALA", FM, https://www.foromicologico.es/index.php?topic=5956.0 (26/10 a 18/12/2010, 4 mensajes: urretxa, SrHongo, Rubo, salva122). [MENSAJE ANTIGUO >10 años]
- **Trucos:** (a) el rebozuelo sí sale en Orduña, en menos cantidad que en el norte de Burgos; (b) Rubo dice que Orduña "suele estar hasta arriba de gente" y que prefiere pasar el puerto hacia Valdegovía; (c) salva122 cuenta que las zonas estaban esquilmadas de hace años.
- **Coinciden:** 3 usuarios (Rubo, salva122, urretxa) en que Orduña está saturado. Un segundo hilo (A4) repite la misma idea (unai y alacran).
- **Álava:** Orduña pertenece a Bizkaia de hecho, pero administrativamente es un enclave de Bizkaia rodeado de Álava; aquí se cita porque limita con Valdegovía y Gorbeia. Regula la Diputación Foral de Bizkaia, no el DF 89/2008 [NO VERIFICADO el régimen de Orduña].

### A3. Valdegovía y Valderejo: rebozuelos, níscalos de sangre y variedad
- **Hilo:** "valle de valdegobia", FM, https://www.foromicologico.es/index.php?topic=7222.0 (17/11 a 18/12/2010, 11 respuestas; aritza24, Rubo, urretxa, salva122). [MENSAJE ANTIGUO >10 años]
- **Trucos:** aritza24 (17/11/2010) dice que los rebozuelos "salían de forma increíble" en los bosques del valle (pino, haya, roble; "tierra amarilla"). Rubo (19/11/2010) afirma que allí llenó las cestas más grandes de "níscalos sanguinus" (sanguifluus) y cita el Parque de Valderejo al lado. salva122 enumera boletus, lepistas, pardillas, rebozuelos, ramarias y clavarias: lugar para aprender.
- **Lectura práctica:** da apoyo antiguo a que el sanguifluus aparece en el pinar calcáreo de la parte occidental de Álava (coincide con la pauta caliza de CyS en 04d, que entonces estaba [UNA SOLA FUENTE] para el español). Ahora son 2 fuentes: CyS 2015 y Rubo 2010 (testimonio de un usuario).
- **Normativa cruzada:** Valdegovía no tiene coto en `cotos.geojson`. Valderejo: PRUG (Decreto 72/2018) remite al DF 89/2008: libre, 2 kg/día, y la recogida de hongos sin interés culinario necesita autorización. Sierra de Árcena (Sobrón, Nograro, Barrio) sí es coto con permiso.

### A4. Hilo "Pais vasco" (2010) y la regla de no dar zonas concretas
- **Hilo:** FM, https://www.foromicologico.es/index.php?topic=5156.0 (12-17/10/2010, 9 mensajes; alacran, unai, NEXUS, xiquet). [MENSAJE ANTIGUO >10 años]
- **Trucos:** unai (13/10/2010) señala Altube y Arcentales y repite que Orduña rinde pero está lleno. NEXUS cuenta una salida floja por Álava: humedad solo en superficie y seco por debajo (truco: escarba un dedo o dos con la mano, no con herramienta, para ver si el suelo está húmedo de verdad antes de subir). alacran encontró boletus y rebozuelos; corrigió después los "amarillos" como falsos.
- **Regla del foro:** el moderador xiquet (16/10/2010) recuerda que "no se puede decir zonas concretas". Es la razón de que Foro Micológico no tenga mapas de Álava. La norma se aplicó hasta a zonas grandes y se mandó a mensaje privado.
- **Nota:** escarbar con herramienta está prohibido por el DF 89/2008 (art. 6). Hacerlo con la mano para mirar la humedad queda en zona gris, no lo recomiendo como consejo de la app [NO VERIFICADO].

### A5. Sur de Álava: angula de monte (Craterellus cinereus) en 2024
- **Hilo:** FC, "Soy experto micólogo. Micología, setas, hongos...", https://forocoches.com/foro/showthread.php?t=10160993 (usuario comoboyas, 18/11/2024).
- **Dato:** dice que ese año "en el sur de Álava ha salido muchísimo" en haya y en encinar arenoso, y que hay mucha trompeta de la muerte por Navarra, Álava, La Rioja, Zamora, León y Palencia en haya, roble, melojo y encina. También dice que los boletus siguen saliendo "hasta que empiece a helar" y que la oronja es sobre todo de septiembre.
- **Fiabilidad:** un solo usuario (autor del hilo, se presenta como micólogo). Lo de "angula de monte = C. cinereus" es nombre local. [UNA SOLA FUENTE] [NO VERIFICADO] Es una observación de una temporada, no una regla.
- **Coincide con 04d:** trompetas en hayedo y robledal; encinar arenoso es dato nuevo para Álava (Rioja Alavesa / sur).

### A6. Comentarios de lectores en TurismoVasco (2014-2026)
- **Fuente:** https://turismovasco.com/pais-vasco/hongos-en-el-pais-vasco/ (artículo sin fecha; comentarios de 2014 a 2026).
- **Lo que dicen:** Iosu (12/08/2019) preguntó por aereus cerca de Vitoria y le contestaron que Gorbea es "apuesta segura"; marce (07/09/2018) preguntó por setas cerca de Vitoria y le dijeron que en semanas, no ya; María José (09/10/2016) preguntó por noviembre en año de sequía; Txema preguntó cuánto tarda en recuperarse un sitio y se respondió que el clima lo hace impredecible; Inma (18/10/2016) pidió sitios cerca de Bizkaia y se le propuso Karrantza. Un comentario afirma que Gipuzkoa permite 4 kg frente a los 2 kg de Álava. [NO VERIFICADO]
- **Fiabilidad:** respuestas del administrador del blog, no de foristas con historial. [UNA SOLA FUENTE] cada una.
- **Aviso:** el propio artículo dice que los "ciclos lunares" influyen en la salida. Ver B17: [CREENCIA POPULAR, sin base].
- **Normativa:** Gorbea "apuesta segura" choca con A1: los hayedos de Zuia, Zigoitia y Urkabustaiz necesitan permiso.

### A7. Modelo micomapa para Araba: zonas y cotas
- **Fuente (web comercial, modelo de predicción, no foro):** https://www.micomapa.com/eu/probintziak/araba y https://www.micomapa.com/es/especies/calocybe-gambosa (consultado 2026-09-30). [UNA SOLA FUENTE, dato de modelo]
- **Datos:** 133 áreas seguidas en Araba. Perretxiko: 108 zonas entre 500 y 950 m; las más densas cerca de Arana, Villanueva de Valdegovía, Murgia y Agurain/Salvatierra. Níscalo: 86 zonas entre 350 y 950 m. Onddo zuri/beltz y rebozuelo: 110-119 zonas entre 400 y 1.000 m. Oronja: 113 zonas entre 400 y 950 m. Trufa negra: 72 zonas (550-950 m). Zonas que más aparecen: Bernedo, Villanueva de Valdegovía, Amurrio (más Eskoriatza y Oñati, de Gipuzkoa).
- **Aviso:** son áreas con bosque adecuado según modelo, no avistamientos. Útil como filtro de altitud (400-1.000 m en Álava, más bajo que los 700-1.300 m de 04d para el boletus), no como punto de recogida.
- **Para el perretxiko** añade: tras una lluvia que empape bien, sale una o dos semanas después si el suelo sigue húmedo y fresco; helada, exceso de agua o viento seco lo abortan.

### A8. Cotos y precios de prensa (GH 25/11/2023, Borja Triviño)
- https://www.gasteizhoy.com/otono-coger-setas-hongos-alava/
- Confirma los tres cotos permanentes (Arraia-Maeztu/Izki, Asparrena y Sierra de Árcena) y que hay otros con ordenanza aprobada pero inactivos: **Olabarri, Montevite y Nanclares de la Oca**. Árcena: permiso de temporada 75 € y puntos de venta en Barrio, Sobrón (bar Durtzi) y Nograro. Asparrena: temporada 52 € no empadronado, 6 € empadronado. Arraia: 5 €/20 €/80 €.
- **Cruce con `normativa.json`:** coincide en Arraia (5/20/80) y en Asparrena (5 diario, 52 temporada). En Árcena, el repo guarda 100 € de 2014 y la prensa 75 €: diferencia ya anotada en el repo. Olabarri, Montevite y Nanclares no están en el repo (ni norma ni polígono): **[NO VERIFICADO] si siguen inactivos en 2026**.
- Reglas del DF 89/2008 confirmadas por prensa: 2 kg/persona/día, solo navaja, cesta con aireación (bolsas de plástico prohibidas), de amanecer a puesta de sol, muestras científicas máximo 3 ejemplares.

### A9. Zonas que recomienda la prensa local
- InfoVitoria (01/09/2025, sin firma) recomienda Parque Natural de Izki (robledal y hayedo: boletus, níscalos, perretxikos), Sierra de Aizkorri (pino y haya, edulis) y Montaña Alavesa (rovellones). https://infovitoria.es/setas-en-alava-guia-practica-para-disfrutar-de-la-temporada-2025/ [UNA SOLA FUENTE] y genérica.
- Citan a José David Fernández (Micología para Todos): la mayoría solo reconoce boletus y perretxiko e ignora otras comestibles (GH, 28/09/2024, Iera Agote). https://www.gasteizhoy.com/setas-hongos-micologia-alava/
- **Permisos:** Izki y la Montaña Alavesa (Arraia-Maeztu): coto con permiso. Aizkorri (Asparrena-Apota): parque micológico con permiso; tamaño mínimo de sombrero 4 cm (2 cm en rebozuelo, trompeta y senderuela). Coincide con el repo.

### A10. Urbasa y Sakana (Navarra, pegado a Entzia)
- **Hilos FM (ninguno es de Álava, pero Urbasa-Andía limita con el Coto de Arraia-Maeztu y Entzia):**
  - "URBASA", https://www.foromicologico.es/index.php?topic=2684.0 (2010-2011): pese al tiempo variable "algo se ve, sobre todo en las zonas de hayedo". [MENSAJE ANTIGUO >10 años]
  - "Parque Natural Urbasa-Andía", https://www.foromicologico.es/index.php?topic=14951.0 (2012): hayedos y campas; aparece una queja por el exceso de recolección. [MENSAJE ANTIGUO >10 años]
  - "ZONA DE LA SAKANA", https://www.foromicologico.es/index.php?topic=2686.0 (2010): robledal, hayedo, pino de repoblación y espino albar en las campas altas; "un buen brote de boletus" el otoño anterior. [MENSAJE ANTIGUO >10 años]
  - "Una escapada a Urbasa", https://www.foromicologico.es/index.php?topic=33566.0 (23/07/2025, jose luis solano): en pleno julio hubo un B. reticulatus, un rebozuelo (var. pallens) y ostreatus, "muy poca cosa", y gnomo contesta que en julio ya es mucho. Sirve de referencia: en el norte pasa en julio con tormenta, al sur no.
- **Valor:** bajo para Álava. Sirve como orientación del hayedo de la Sierra de Entzia por analogía. [NO VERIFICADO] que el mismo patrón valga en Entzia.

### A11. Perretxiko en campas: lo que dicen foros y webs locales
- perretxikoak.com (guía de Euskal Herria y Navarra, sin autor, copyright 2020): los setales de perretxiko "marcan la hierba" y son siempre el mismo sitio año tras año; los que saben madrugan; los buenos sitios son secreto familiar que pasa de abuelos a nietos. http://www.perretxikoak.com/perretxikoak-2-es/setas-de-primavera/ (Álava, Navarra y Rioja las más aficionadas). Coincide con 04d (Marcos 2024, fiel al sitio). Sube a **3 fuentes** la fidelidad al sitio (CyS, perretxikoak.com, sporas de B2).
- Asociación Desarrollo Valdorba (Navarra, sin fecha; web de un proyecto, no foro): http://www.valdorba.org/micovaldorba2/setas/calocybe_gambosa_seta_primavera.html. Temporada de mediados de marzo a junio, con lo mejor del 20 de abril a finales de mayo; los ejemplares de marzo-abril se pagan más caros. Dos trucos: en días nublados con lluvia fina la hierba se aplasta y el perretxiko se ve mucho mejor [UNA SOLA FUENTE]; y las canteras calizas protegidas y orientadas al sur guardan el calor de la piedra (coincide con SE 2018, que en 04d hablaba de muros y linderos: pasa de 1 a **2 fuentes**). Indicadoras: endrino, majuelo, aulaga (Genista), enebro y primavera (Primula veris). Sobre altitud: los puertos y zonas altas fructifican hasta principios de julio.
- FM, "Perrechicos", https://www.foromicologico.es/index.php?topic=20985.0 (19-21/04/2013, defenestrc y jfbrmtx22): en la costa ya salen y en las Merindades (norte de Burgos, junto a Álava) "ya han salido"; en Castilla, más tarde. [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE] Confirma la secuencia "primero cotas bajas y costa, luego interior".
- **Álava:** el repo guarda el perretxiko de la Llanada y de los Montes de Vitoria; aquí no hay ni un solo nombre de campa concreto de Álava en foros (los foreros no lo dan, ver A4).

### A12. Euskera y folklore
- **perretxikoak.eus** (buscador de setas de Euskal Herria con nombres en euskera: onddo zuri, onddo beltz, ziza hori...) y **Ahotsak.eus** (archivo oral; 152 pasajes sobre "perretxiko bila"; Eibar, Andoain, Tolosa, Zarautz; temas: estaciones, influencia lunar, lugares secretos, transmisión padre-hijo). https://ahotsak.eus/gaiak/050404/. **No hay ningún testimonio de Álava** en el índice. No se leyeron los pasajes uno a uno: la lista de lugares secretos y las menciones a la luna quedan [NO VERIFICADO] y como [CREENCIA POPULAR, sin base].
- Aittu.eus: un relato de Nikolas Zendoia (Diario Vasco) sobre sitios de perretxiko y setas de otoño tras "lluvia templada" (euri-jasa epelaren ondoren) en Gipuzkoa. Es literario. No lo uso como truco.
- En euskera no se halló ningún foro activo de setas. [NO VERIFICADO] que no exista.

### A13. Asociaciones
| Entidad | Qué ofrece | URL / contacto | Nota |
|---|---|---|---|
| Aranzadi, sección de Micología | Salidas de campo, jornadas, buscador micológico (fichas), herbario Aran-Fungi, correo de consultas | https://www.aranzadi.eus/micologia · mikologia@aranzadi.eus | Colabora con micólogos alaveses desde 1983 (nomenclatura en euskera); los proyectos listados son de Gipuzkoa |
| Gorbeia Mikologia (Parque Micológico) | Permisos y gestión (A1) y rutas guiadas | https://www.gorbeiamikologia.eus · 945 610 733 | Ámbito: Urkabustaiz, Zigoitia, Zuia |
| Micología para Todos (José David Fernández) | Rutas guiadas en Gorbea y Álava, cursos y charlas (incluso para el Ayuntamiento de Vitoria-Gasteiz) | https://www.micologiaparatodos.net · 618 391 899 | Servicio, sin blog de trucos |
| Gorbeiako Bazterra (Murgia) | Revisión de setas los lunes (ya en 04c) | sin web localizada | Ver 04c, línea 80 |
| Marasmius Elkarte Mikologikoa | Asociación registrada en Euskadi | https://www.euskadi.eus/gobierno-vasco/-/asociacion/asociacion-micologica-marasmius-elkarte-mikologikoa/ | [NO VERIFICADO] que sea de Álava; no abrí los estatutos |
| Arabako Mikologia Elkartea | No se encontró | (ninguna) | No hay evidencia |
| Sociedad Micológica Barakaldo | Una de las más antiguas del País Vasco, 50 años en 2025 | https://micologica-barakaldo.org | Bizkaia, no Álava |

### A14. NO IR / atención
- **BU-50021** (polígono de `cotos.geojson` junto al límite de Álava): es de Burgos y se rige por el Decreto 31/2017 de Castilla y León, **no** por la normativa alavesa (permiso y 5 kg). No aplicar aquí el 2 kg.
- **Gordoa (MUP 312 Oraneta y Borrinkurutz)**: acotado según Diputación, sin norma propia leída en el repo. Nada nuevo en foros. Mantener "confirmar antes de ir".
- **Gorbeia: berrea.** Zigoitia publica una orden foral de restricciones en la berrea (en 04c). No leída, [NO VERIFICADO].
- **Legutio** (junto a Gorbeia): ordenanza con permiso (5 €/día, 20 €/semana, 80 €/temporada no residentes). No aparece en la lista de acotados de la Diputación; no hay polígono. Sin novedades.
- **Horarios:** el DF 89/2008 prohíbe recoger de noche. Gorbeia añade "desde una hora después del amanecer". Asparrena: de amanecer a puesta del sol. **Para la app, el truco de "ir de madrugada" choca con esos horarios** (ver B19).

---

## B. Trucos prácticos por especie (foristas, blogs con comentarios y webs de la comunidad)

Convenciones: **[CONFIRMA]** = refuerza algo que ya estaba en 04d; **[NUEVO]** = no estaba; **[MATIZA]** = cambia o limita algo de 04d.

### B1. Días tras la lluvia del boletus: el hilo más sólido [CONFIRMA + MATIZA]
- FM, "Ciclo Boletus Edulis", https://www.foromicologico.es/index.php?topic=3719.0 (03-05/09/2010; SrHongo, Lodero, Jfbrmtx22, Sergiob, Marta, Sahueso, Portentosum). [MENSAJE ANTIGUO >10 años]
- Resumen: SrHongo plantea "10-15 días" y Sergiob (moderador global) lo confirma, con la condición de que **no vale cualquier lluvia seguida de calor extremo**. Marta coincide y añade que temperaturas moderadas y humedad que continúe mejoran el resultado. Sahueso da "15-20 días con temperatura media". Portentosum considera excesivos 20 días. Lodero dice haber oído 21 (sin confirmar). Jfbrmtx22 recomienda ir varias veces a un sitio conocido para medirlo uno mismo.
- **Coinciden en 10-15 días:** SrHongo, Sergiob, Marta (3). Discrepan en 15-20 Sahueso y en 21 Lodero (2, con Portentosum en contra).
- **Otras fuentes del mismo rango:** CyS (11/08/2017): 12-15 días para los primeros ejemplares, y abundantes si sigue lloviendo o el suelo sigue húmedo. https://www.cestaysetas.com/cuanto-tardan-los-boletus-en-salir-despues-de-las-lluvias/ · micoaficionados.es: 10-14 días https://www.micoaficionados.es/boletus/.
- **Matiz en contra (comercial):** sporas.io (actualizado 07/08/2026, plataforma de predicción) dice que **no existe una regla fiable de "X días tras la lluvia"** porque depende de lo acumulado, de la temperatura posterior y de la reserva de agua del suelo. https://sporas.io/especies/boletus-edulis
- **Conclusión para la app:** mantener el rango 10-15 días como orientación, con la condición de tiempo templado y suelo que sigue húmedo, y avisar de que cualquier número es solo aproximado. 5 fuentes coinciden en 10-15; 2 piden 15-20 o más.

### B2. Boletus edulis, cómo moverse [NUEVO, fuente comercial]
- sporas.io: "elige el bosque antes que el día"; monte maduro pero abierto, claros, bordes de pista y márgenes; hojarasca suelta con musgo, brezo, arándano y helecho; buscar **pequeños bultos que levantan la hojarasca** antes de salir; **trabajar a fondo 10-15 m alrededor de cada hallazgo** en vez de avanzar rápido; volver a los mismos sitios porque "el micelio es fiel". En otoño seco, umbrías y fondos de valle; con frío, lomas soleadas. Banda de 600-1.800 m, pico en octubre.
- [CONFIRMA] la secuencia solana-umbría y el "si ves uno hay más cerca" de 04d. [NUEVO] la regla de los 10-15 m y el "bulto que levanta la hojarasca" (en 04d solo estaba para marzuelo, capuchina y níscalo). [UNA SOLA FUENTE] y comercial.

### B3. Boletus pinophilus en primavera [CONFIRMA, muy débil]
- FM, "¿SUFICIENTE LLUVIA PARA BOLETUS?", https://www.foromicologico.es/index.php?topic=30912.0 (mayo de 2017 o 2021: el listado y los mensajes discrepan). Ltblue vio solo "primordios pequeños" a 1.300 m en pino silvestre; jose luis solano dijo que el **pinophilus es el primero en salir en pinar**; Iñigo dio 10-15 días tras activar el micelio. [UNA SOLA FUENTE para la precocidad del pinophilus] Coincide con 04d (CyS, Abarca 2019: 10-20 días).

### B4. Boletus aereus: tormenta, calor y suelo [CONFIRMA + NUEVO]
- FM, "Boletus aereus", https://www.foromicologico.es/index.php?topic=1844.0 (sin fecha legible, antiguo): "donde más he cogido ha sido en carrascal y con calor"; sale **unos 10 días tras una buena tormenta de verano** (Jebaspe); la oronja sigue unos 19-21 días después del mismo evento; no todos los encinares valen: donde salía *Rubroboletus satanas* el suelo era básico y por eso no había aereus (truco de pH: **si ves satanas, no busques aereus allí**). [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE para el truco del satanas, sin verificar]
- [CONFIRMA] 7-10 días y oronja después del aereus (Mico Aragón y Marcos). Sube a **2 fuentes** el orden aereus-oronja.
- **Álava:** el aereus es escaso en el norte húmedo; los comentarios de TurismoVasco hablan de Gorbea "apuesta segura" (A6), [UNA SOLA FUENTE] y choca con el permiso de A1.

### B5. Níscalo [CONFIRMA + NUEVO]
- **Mirar el bulto y la grieta** en la pinocha y **trabajar claros, cortafuegos, cunetas de pista y bordes** de pinar joven y aclarado; cortar y mirar el látex antes de recoger; buscar alrededor de cada hallazgo porque salen en grupos y corros (sporas.io, https://sporas.io/especies/lactarius-deliciosus, 11/08/2026). [CONFIRMA] el pinar joven (LCDLS, Escapada Rural) y "si ves uno mira alrededor" (CyS, Benito 2018): **2 fuentes** frente a la [UNA SOLA FUENTE] de 04d.
- **Plan B de altitud (foro):** RobertoC, FM, "A por capuchinas", https://www.foromicologico.es/index.php?topic=23768.0 (25/11/2013): subió a por capuchinas, encontró el monte con nieve, bajó a un pinar de níscalos que conocía y se llevó grandes corros de deliciosus y, de regreso, una capuchina entre rúsulas. Un comentarista avisó de colémbolos en algunos ejemplares (comprobar al cortar). [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE]. Truco: tener **un pinar bajo de reserva**.
- **Tiempo:** sporas no da días, solo "lluvia acumulada suficiente" más bajada de temperatura sin heladas fuertes. Las cifras de 30-40 días de 04d no se han contradicho ni confirmado en foros.
- **Álava:** sanguifluus en Valdegovía (A3).

### B6. Rebozuelo [CONFIRMA + NUEVO]
- **FP, hilo de 15/01/2015**, https://www.fungipedia.org/comunidad/foro/4-consultas-de-micologia/67065-consulta-sobre-rebozuelo-cantharellus.html (Roberto y Alberto Villanueva contestan a zaturr). Ziza-hori en robledal y hayedo, "siempre los he cogido en verano y a finales de primavera", y **tras una tormenta de verano es lo ideal**; los últimos, bajo pino; hasta noviembre. [CONFIRMA] (2 foristas en un mismo hilo, ya estaba en 04d como [UNA SOLA FUENTE, foro]; ahora son 2 usuarios coincidentes, pero en el mismo hilo).
- **Caminar las curvas de nivel** (en vez de subir en recto) porque la seta se reparte en bandas de altitud; **buscar el musgo, no el árbol**; en pleno verano, umbrías y márgenes de arroyo; en otoño, exposiciones más soleadas y cotas bajas; "no hay regla de X días", responde a humedad sostenida (sporas.io, https://sporas.io/especies/cantharellus-cibarius, 10/08/2026). [NUEVO] la marcha por curvas de nivel y el cambio de exposición umbría a solana de verano a otoño. [UNA SOLA FUENTE] comercial. [CONFIRMA] "humedad sostenida" de Mycora (04d).
- **Luna (hilo FM):** lucremo, "Luna nueva setas nuevas", https://www.foromicologico.es/index.php?topic=29391.0 (10-11/03/2016), encontró rebozuelos en luna nueva y otros en cuarto creciente, y dice que las temperaturas y la humedad pudieron influir. Es un anecdotario de un usuario. [CREENCIA POPULAR, sin base] [UNA SOLA FUENTE]

### B7. Trompetas (Craterellus) [NUEVO, local]
- Ver A5: C. cinereus (angula de monte) y C. cornucopioides muy abundantes en 2024 en el sur de Álava, en haya y en encinar arenoso. [UNA SOLA FUENTE] [NO VERIFICADO]

### B8. Hydnum, Macrolepiota, Lepista nuda
- **No se encontró ningún truco nuevo de foristas** para estas tres especies. FM solo tiene hilos de cocina de macrolepiotas (https://www.foromicologico.es/index.php?board=6.0, "Preparación de macrolepiotas?" y "Cómo cocinar macrolepiotas procera?") y uno de identificación de un parasol en un prado de jardín (topic=31120). En FC, comoboyas aconseja desechar setas de cunetas, parques, jardines y huertos por metales pesados (18/11/2024), lo que refuerza el aviso de 04d sobre senderuela y carreteras.
- Mantener las cifras de 04d.

### B9. Oronja [CONFIRMA]
- sporas.io (10/08/2026): no hay regla de días; de 2 a más de 6 semanas según humedad previa; solanas, bordes de dehesa, calveros y orillas de pista; seguir al árbol (roble, alcornoque, castaño) y no al bosque; suelo silíceo con brezal; buscar el **abultamiento de la hojarasca con el naranja asomando**; evitar pinares (allí lo naranja suele ser *A. muscaria*). https://sporas.io/especies/amanita-caesarea [CONFIRMA] solana y suelo ácido (Marcos 2023).
- FM, hilo de 2010 (B1): Sahueso cita oronja con edulis en castañar, 15-21 días. [CONFIRMA] el orden y el rango de 04d (18-50 días, 21 días).
- En Álava: no se halló ningún forista que la cite. FC (comoboyas, 2024) la sitúa en septiembre, en general. [UNA SOLA FUENTE]

### B10. Perretxiko [CONFIRMA + NUEVO]
- Ver A11 y A7. **Nuevo:** ver la seta en días nublados con lluvia fina (hierba aplastada) y canteras calizas orientadas al sur; **el tiempo tras lluvia que empapa es de 1-2 semanas** (micomapa); los buenos sitios son secreto; los corros se repiten año tras año (3 fuentes).
- **Precio como señal de fecha (prensa, no foro):** GH 22/04/2025 (Nagore Lana) da 72 €/kg el perretxiko de Álava una semana antes de San Prudencio (28 de abril). El Correo 17/04/2026 titula precios de hasta 80 € en Vitoria. [NO VERIFICADO] (El Correo no se pudo abrir.) Los ejemplares de marzo y abril son los más caros (Valdorba, 90-102 €/kg).

### B11. Seta de cardo [CONFIRMA + NUEVO]
- **Fruta al año siguiente de que muera el cardo:** Roberto (FP, 28/11/2017, https://www.fungipedia.org/comunidad/foro/5-fotografia-micologica/71359-setas-de-cardo-pleurotus-eryngii.html) dice que los carpóforos salen tras la muerte de la planta, y Jose (comentario en CyS, 03/12/2019, https://www.cestaysetas.com/buscar-setas-de-cardo/) dice que la seta depende de **los cardos caídos de años anteriores, no del cardo verde de este año**, y que hay lugares con cardo de sobra sin setas. **2 usuarios independientes coinciden.** [NUEVO]
- Antonio (CyS, 16/11/2014) confirma desde Toledo (Sonseca) la ficha de 04d.
- LCDLS: terreno soleado y calizo, cultivos abandonados, pastos y bordes de camino; los sitios buenos se reconocen porque hay otros recolectores con la vista en el suelo; navaja de hoja curva. [CONFIRMA] 04d.
- **Álava:** sin aportación (siguen sin fuente para Llanada y Rioja Alavesa).

### B12. Colmenilla [NUEVO, matiz]
- LCDLS (Pablo Martínez): empiezan cuando el suelo está a **8-10 grados**, y pide 15 a mediodía y 5 por la noche como mínimo; buscar tierra removida y ramas, claros con luz y humedad, no bosque cerrado; suelo franco de orilla de río con poca pendiente; boj, enebro, rosales silvestres, abeto y pino; **ciclo de 2-3 semanas por sitio** (volver a mirar a los pocos días si son pequeñas); pasar días después de una lluvia fuerte de primavera. https://lacasadelassetas.com/blog/colmenillas-trucos-encontrarlas/ [UNA SOLA FUENTE] [NUEVO] el umbral térmico y el "volver".
- FC (Senderuelas, marzuelos, perrechicos, colmenillas, https://forocoches.com/foro/showthread.php?t=4940458): colmenillas bajo frondosas de ribera, en pinar y en **zonas quemadas**; aviso de que hay tóxicas parecidas. [CONFIRMA] ribera y quemados (Femturisme). Hilo con seguimiento en febrero de 2025 sobre sequía en Aragón.
- FP, "Colmenillas" (18/05/2012), https://www.fungipedia.org/comunidad/foro/6-foro-general/36123-colmenillas.html: solo identificación por cómo se inserta el pie (Morchella, Mitrophora, Verpa). Sin truco de búsqueda. [MENSAJE ANTIGUO >10 años]

### B13. Marzuelo [CONFIRMA + MATIZA]
- **Secuencia de altitud confirmada por foro (2 hilos, ambos >10 años):**
  - FM, "Hygrophorus marzuolus", https://www.foromicologico.es/index.php?topic=15219.0: empiezan a 600-800 m en pinares a principios o mediados de febrero y **suben hasta 1.400 m a finales de marzo**; en hayedo son difíciles de ver por la hojarasca gruesa, en pinar se ven mejor; en algunos años hay zonas con cosecha y otras al lado sin nada.
  - FM, https://www.foromicologico.es/index.php?topic=9164.0 (26/02/2011): avisan de que **1.500 m son demasiados metros para esas fechas** y que conviene mirar hacia 1.000 m; los hallazgos citados son a 500-800 m en hayedo y pino silvestre, y una cita de alcornocal en Cádiz a 400-500 m.
- **Otros:** LCDLS, https://lacasadelassetas.com/blog/los-secretos-del-marzuelo: buscar unos **10 días tras el deshielo** con 0-15 grados, en el norte (Euskadi, Navarra) a finales de enero o febrero; indicadoras: *Boletus pinicola*, *Entoloma hirtipes* y hepática (*Hepatica nobilis*). **[CONFIRMA + sube a 2 fuentes]** lo de la hepática (antes PU [UNA SOLA FUENTE]). sporas.io (10/08/2026): palpar los bultos (firmes y elásticos = seta, duros = piedra o raíz), mirar donde antes se fundió la nieve, y seguir los agujeros de jabalí, ciervo o ardilla. [CONFIRMA] CyS (animales) y suma "palpar".
- [MATIZA] el "primero solana, luego umbría" de 04d (CyS 2025) sigue en [UNA SOLA FUENTE]: los foros hablan de **altitud**, no de orientación.
- **Álava:** sin aportación local. La cota de 600-1.000 m encaja con Entzia, Gorbeia y Urbasa por analogía [NO VERIFICADO].

### B14. Capuchina y negrilla
- FM, RobertoC, 25/11/2013 (B5): se encontró una capuchina entre rúsulas en el camino de vuelta tras fallar la subida por nieve. Sin cifras. [UNA SOLA FUENTE]
- FC: comoboyas recuerda que la negrilla (T. terreum) se distingue del tóxico T. pardinum porque el pie se deshilacha al apretarlo y el pardinum es mayor y escamoso. Es seguridad, no búsqueda.

### B15. Senderuela
- FM, "Espectacular corro de Marasmius oreades", https://www.foromicologico.es/index.php?topic=33564.0 (17/05/2025, jose luis solano): un corro espectacular; lusan (moderador) comenta que merece **una recogida larga**. Sin más datos. [CONFIRMA] el corro y el hábito de repetir (04d).
- Ya estaba el dato de Álava y Navarra de Tubía (CyS 2015, un solo autor): no apareció ningún forista que lo confirme.

### B16. Nada nuevo
- *Hydnum repandum*, *Macrolepiota procera*, *Lepista nuda*, *Russula*: ningún forista con truco localizado.

### B17. Luna y setas [CREENCIA POPULAR, sin base]
- FM tiene tres hilos con "luna" en el título: "Luna nueva setas nuevas" (topic=29391, 2016), "¡LLuvias, luna y setas!" (topic=30777, 25-26/01/2017, jesulin) y mención en A6 (TurismoVasco). En ninguno hay datos: es la impresión de uno o dos usuarios, con los demás cautos ("muga": incertidumbre). Ahotsak cita "influencia lunar" como tema de los testimonios orales. Sin base medible. **Si se incluye en la app, debe ir como [CREENCIA POPULAR, sin base] y sin consejo de actuación.**

### B18. Suelo húmedo por dentro [NUEVO, una fuente]
- NEXUS (FM, 14/10/2010, A4): humedad solo superficial y suelo seco por debajo = mala salida. [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE] Encaja con sporas ("reserva de agua del suelo") y con la idea de 04d de lluvia "útil" frente a chaparrón. No aconsejar escarbar (DF 89/2008, art. 6).

### B19. Horarios del día [sin base; choca con la ley]
- La única mención de hora es **madrugar para el perretxiko** (perretxikoak.com) porque el ciclo es breve. No hay foros que den horas del día. En Álava, el DF 89/2008 prohíbe de noche y la recogida en Gorbeia empieza **una hora después del amanecer** (A1). **No recomendar horas en la app.** [UNA SOLA FUENTE] [NO VERIFICADO]

---

## C. Verificaciones de los [UNA SOLA FUENTE] de 04d

| Dato de 04d | Antes | Ahora | Fuentes nuevas |
|---|---|---|---|
| Hepática como indicadora del marzuelo | PU | **2 fuentes** | LCDLS (marzuelo) |
| Corro de perretxiko: secreto / fiel al sitio | CyS, SE | **3 fuentes** | perretxikoak.com; sporas (micelio fiel, otras especies) |
| Perretxiko en muros y canteras al sur | SE 2018 | **2 fuentes** | Valdorba (canteras calizas al sur) |
| Níscalo: "si ves uno, mira alrededor" | CyS Benito 2018 | **2 fuentes** | sporas (comercial) |
| Sanguifluus en pinar calcáreo (español) | CyS 2015 | **2 fuentes** (la 2.ª es 1 usuario de 2010) | FM topic 7222, Rubo |
| Orden aereus-oronja | Mico Aragón, Riaza, Díaz 2016 | confirmado | FM topic 1844 (19-21 días), topic 3719 (Sahueso) |
| Boletus: 10-14 días | 4 fuentes | 10-15 días: **5 fuentes** (3 foristas) | FM topic 3719, CyS 2017 |
| Marzuelo: primero solana, luego umbría | CyS 2025 | **sigue [UNA SOLA FUENTE]** | los foros hablan de altitud (A/B13) |
| Oronja: gamón y moscas | Díaz 2016 | **sigue [CREENCIA POPULAR]** | nada |
| Perretxiko: micelio caliente al tacto | Marcos 2024 | **sigue [CREENCIA POPULAR]** | nada |
| Mejores horas del día | sin fuente | **sigue sin fuente** | solo "madrugar" (perretxikoak.com) |
| Luna | sin fuente | **anécdotas de 1-2 foristas, sin datos** | FM 29391 y 30777 |

---

## D. Lista numerada de hallazgos nuevos (para el recuento)

Álava (11): A1 parque micológico de Gorbeia con permiso y tarifas 2026; A2 Orduña saturado; A3 Valdegovía (rebozuelo y sanguifluus); A4 regla de no dar zonas + humedad en profundidad; A5 angula de monte en el sur de Álava 2024; A6 comentarios TurismoVasco; A7 modelo micomapa por cotas y zonas; A8 cotos inactivos Olabarri, Montevite y Nanclares; A9 zonas de prensa; A10 Urbasa y Sakana como analogía; A13 asociaciones y contactos.

Especie (11): B1 rango 10-15/15-20 días con el hilo de 7 usuarios; B2 regla de 10-15 m y bulto; B4 truco del satanas/pH; B5 plan B de pinar bajo; B6 curvas de nivel y cambio de exposición; B9 oronja: 2-6 semanas y bulto; B10 perretxiko nublado y cantera; B11 seta de cardo: cardo caído del año anterior (2 usuarios); B12 colmenilla 8-10 °C y volver; B13 marzuelo: subida de 600-800 m a 1.400 m (2 hilos); B7 trompetas en encinar arenoso.

**Total: 22 hallazgos nuevos**, de ellos 1 de impacto normativo (A1) y 3 confirmaciones de [UNA SOLA FUENTE] (hepática, sanguifluus caliza, cantera al sur). Ninguno de los 22 sale de Reddit.

## E. Pendiente (lo que no se pudo hacer)
1. Reddit (r/Setas, r/mycology): bloqueado. Hacerlo a mano.
2. Abrir los originales de los hilos FM citados para verificar fechas y cifras (resumen automático).
3. Gorbeia: comprobar el ámbito exacto (MUP), si el permiso sustituye o suma al DF 89/2008 y si hay polígono oficial. Añadirlo a `normativa.json` y `cotos.geojson`.
4. Olabarri, Montevite y Nanclares de la Oca: confirmar si siguen inactivos.
5. Fungipedia: su buscador no funcionó; queda una revisión a mano de "perretxikos" (hilos de mayo de 2010 y abril de 2020 citados por Bing sin URL).
6. Hydnum, Macrolepiota, Lepista nuda y Entzia/Urkilla/Montes de Vitoria con nombre propio: no hay foristas con dato.
7. Ahotsak: leer pasajes uno a uno por si hay lugares o trucos (luna, secreto).

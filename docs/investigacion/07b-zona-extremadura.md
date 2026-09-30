# 07b. Zona nueva: Extremadura (boletus bajo alcornoque, castaño, roble y encina)

Investigación del 30/09/2026. Todas las fuentes se consultaron ese día salvo que se indique otra cosa; la fecha entre paréntesis es la de la fuente cuando consta. Lo dudoso va marcado **[NO VERIFICADO]**. Las coordenadas de los puntos meteorológicos salen de capas oficiales (MFE50, MITECO), no de fuentes micológicas: **ninguna fuente micológica que leí da coordenadas de setales**.

Se leyeron antes `docs/datos.md` y `data/normativa.json` para no duplicar. Extremadura no existe todavía en `zonas.json`, `normativa.json` ni `sitios.json`.

## 0. Resumen ejecutivo

1. **Normativa:** no encontré ningún decreto ni orden vigente de Extremadura que regule la recogida de setas. Hubo un borrador (CAFOR, 09/09/2014) que no he visto publicado en el DOE, y la Ley 6/2015 Agraria creó una tasa por «licencias micológicas» sin que haya hallado el reglamento que las haga operativas. Lo que sí rige: Ley 43/2003 de Montes (las setas son del titular del monte), ordenanzas locales en algunos montes (Mirabel), y la normativa de cada espacio protegido. **[NO VERIFICADO que a 30/09/2026 siga sin decreto; confirmar con la Dirección General de Gestión Forestal.]**
2. **Dehesas y alcornocales = fincas privadas casi siempre.** Sin permiso del dueño no se recoge. Para la app, el punto meteorológico de un alcornocal de la Sierra de San Pedro es solo un termómetro del hábitat: hay que decir «privado» en el aviso.
3. **Lo accesible son montes públicos** (MUP): el cruce MFE50 x capa de montes del MITECO da una lista de montes públicos con castañar, melojar, alcornocal y encinar real (sección 1.3). Varios caen dentro de espacios protegidos.
4. **Monfragüe:** no está «prohibido» en bloque, pero el PRUG (Decreto 13/2014) solo prevé recogida de setas sin fines comerciales, con autorización del Parque, en un único monte público (Dehesa Boyal y Cuarto de los Arroyos, Serradilla). Para la app: «no ir» salvo autorización.
5. **Puntos meteorológicos propuestos (4 + 2 alternos)**, todos comprobados en el MFE50 (especie dominante 60-90 %) y con ortofoto PNOA; uno cae en espacio protegido solo en la variante descartada (sección 3).
6. **Aviso propio de Extremadura (SME):** *Amanita ponderosa* (gurumelo) se confunde con *A. verna* (mortal), coinciden en primavera y hábitat, y se come «en huevo». La app no lo recomienda.
7. **«Tana» es ambiguo:** hay fuentes que lo dan para *Amanita caesarea* y el encargo lo toma por *Macrolepiota*. No usar «tana» sin nombre científico.
8. **GBIF apenas tiene registros** en Extremadura (p. ej. *B. aereus*: 0-6 por comarca), así que la presencia será casi siempre «orientativa».

---

## 1. Sitios

Nada de lo siguiente es un «setal» con coordenadas: son comarcas, montes, municipios o rutas. Escala de confianza de `datos.md`: alta = 3 o más fuentes independientes, media = 2, baja = 1 o menos. Con 1 o 2 fuentes y de poca calidad, casi todo queda en **baja**.

### 1.1 Tabla de sitios (formato orientado a `sitios.json`)

| id propuesto | Municipio / paraje | Especies (según la fuente) | Época | Consejo / dato | Legal | Fuentes (URL, fecha) | nFuentes / confianza |
|---|---|---|---|---|---|---|---|
| ex-villuercas-cubero-aguanfria | Sierra de Las Villuercas: «zona del Cubero» (pinos, roble y monte bajo) y «Aguanfría y El Viborejo» (castañares) | Cubero: níscalos (esa jornada no salieron), parasoles (*M. rhacodes*). Castañares: *B. edulis*, *B. aereus*, *B. pinicola*, parasoles; se citan *A. caesarea* y, como tóxicas, *A. pantherina* y *B. satanas* | Octubre (entrada de 2010) | Jornada con poca lluvia: lo más fiable fue el parasol. «Después de la lluvia» | sin-confirmar | Blog Taller Unión, «Un día de setas en Las Villuercas» (2010-10), leído a través de https://alarecercadelboletperdut.wordpress.com/acerca-de/extremadura/localidades/las-villuercas/ (consultado 2026-09-30) | 1 / baja. Nota: «Cubero» coincide en nombre con el MUP «Cubero del Dehesón» (Villar del Pedroso), que además figura en el anexo IV del borrador de 2014; es una coincidencia de nombre **[NO VERIFICADO que sea el mismo lugar]** |
| ex-berzocana-dehesa | Berzocana, Dehesa de Berzocana (Villuercas-Ibores-Jara) | Ruta de setas (especies no detalladas) | 05/11/2006 | La fuente da coordenadas: 39.446027, -5.456871 | sin-confirmar | https://rutasporextremadura.net/2010/12/01/20061105-ruta-de-setas-en-la-dehesa-de-berzocana-villuercas-ibores-jara-extremadura/ (entrada 2010-12-01) | 1 / baja |
| ex-ibores-puerto-rey | Puerto Rey (cerca de Alía), Villuercas-Ibores | *B. aereus*, níscalos, *A. caesarea*, champiñón | Otoño | La frase «mayor oferta de setas de la Península, especialmente boletus» es propaganda turística | sin-confirmar | Extractada en https://alarecercadelboletperdut.wordpress.com/acerca-de/extremadura/localidades/los-ibores/ (original de extremadurate.es, 2010-10-03, **no leído**) | 1 / baja **[NO VERIFICADO el original]** |
| ex-sanpedro-ruta-turismo | «Ruta de la Sierra de San Pedro» (Montánchez, Alcuéscar, Carmonita, Aliseda, San Vicente de Alcántara) | Níscalos, *M. procera*, *B. aereus*, *A. caesarea* | Otoño | Senderos entre encinas, castaños, robles, alcornoques; los pinares, para níscalos. Ojo: Montánchez y Alcuéscar no están en la Sierra de San Pedro propiamente dicha; el texto junta comarcas | sin-confirmar | https://www.turismoenextremadura.es/setas-extremadura/ (2015-08-28) | 1 / baja |
| ex-sanvicente-mayorga | San Vicente de Alcántara: Dehesa de Mayorga (carretera a La Codosera), Museo del Corcho | Setas de la Sierra de San Pedro y Sierra del Naranjal (sin especies) | XV Jornadas: 20-21/11/2021 | La ruta familiar sale de la Dehesa de Mayorga; «salida libre al campo» con recepción de setas en el Museo del Corcho. La noticia no dice dónde se recoge ni si es finca privada | sin-confirmar | https://www.extremadura7dias.com/noticia/jornadas-micologicas-en-san-vicente-de-alcantara-este-fin-de-semana (2021-11-19) | 1 / baja |
| ex-valencia-alcantara-dia-seta | Valencia de Alcántara | «Día de la Seta de Extremadura» XLII (salida al campo, exposición, charla) | 16-17/11/2024 | Lugar exacto de la salida no indicado | sin-confirmar | https://micoex.org/wp-content/uploads/2023/11/Triptico-Sociedad-Micologica-2024-3.pdf (2024) | 1 / baja |
| ex-tentudia-fuentes-monesterio | Tentudía: Fuentes de León (jornadas desde 2003: «XX» en 2023; 21-23/11/2025), Monesterio | *B. edulis*, *B. aereus*, *A. caesarea* (comarca «excepcional»); Fuentes de León también «setas termófilas» (charla 2023) | Noviembre (jornadas) | Día de la Seta: Monesterio 2012, Fuentes de León 2014 y 2023. Zona de sierra con alcornocal y encinar | sin-confirmar | https://micoex.org/dia-de-la-seta-de-extremadura-new/ ; https://micoex.org/wp-content/uploads/2023/11/Triptico-XX-Jornadas-Micologicas.pdf ; https://alarecercadelboletperdut.wordpress.com/acerca-de/extremadura/ (fechas de 2011 a 2025; consultadas 2026-09-30) | 3 (todas de organizadores/recopilación) / **media** por prudencia: ninguna habla de un paraje |
| ex-bodonal-gurumelo | Bodonal de la Sierra: dos fincas privadas, a 16 km de Fregenal de la Sierra | *A. ponderosa* (gurumelo), salida guiada SME | Primavera; salida de 2025 (marzo) | «Por deseo expreso de los propietarios, no se permite la entrada a las fincas de perros sueltos» | **privado** (permiso de los dueños) | https://micoex.org/wp-content/uploads/2025/03/Dia-de-la-Seta-de-Primavera-2025.pdf (2025-03); Día de la Seta de Primavera 2026: https://micoex.org/2026/03/27/dia-de-la-seta-de-primavera-2026/ | 1 / baja. **No recomendada por la app** |
| ex-alor-san-jorge | Sierra de San Jorge, Alor (término de Olivenza) | Primeras jornadas micológicas «Sierra San Jorge de Alor y alrededores» | Otoño | Con miembros de la SME para clasificar | sin-confirmar | https://alarecercadelboletperdut.wordpress.com/acerca-de/extremadura/localidades/sierra-de-alor/ (entrada de 2015-08-09) | 1 / baja |
| ex-gata-ojestos | San Martín de Trevejo: Castañar de los Ojestos (senderos PR-CC 184 y SL-CC 208) | Hábitat de castaño y melojo; **ninguna fuente dice qué setas salen ahí** **[NO VERIFICADO]** | (otoño por hábitat) | «El mayor castañar de Extremadura», árbol singular | sin-confirmar | Folleto comarcal https://redex.org/storage/media/documents/606/01-web-folleto-sierra-de-gata.pdf (s.f.); guía de senderos https://sierradegata.org/wp-content/uploads/2022/10/TRAIL-GUIDE.pdf (2022) | 2 (sobre el castañar, no sobre setas) / baja |
| ex-gata-general | Sierra de Gata (Robledillo de Gata, Hoyos, Acebo…) | Níscalos, *B. aereus*, *M. procera* entre alcornoques, robles, encinas, castaños, pinos | Otoño | Día de la Seta 2011 en Robledillo de Gata. «Algunos municipios tienen permisos y tasas, sobre todo en Sierra de Gata»: no dice cuáles | sin-confirmar | https://www.turismoenextremadura.es/setas-extremadura/ (2015-08-28); https://norteextremadura.es/como-y-donde-recoger-setas-en-el-norte-de-caceres/natural/ (2024-11); https://micoex.org/dia-de-la-seta-de-extremadura-new/ | 3 (dos son turismo) / media |
| ex-ambroz-hervas | Valle del Ambroz: Hervás (Castañar Gallego), Segura de Toro, Baños de Montemayor | Rebozuelos en los castañares; boletus en prados y níscalos en pinar (turismo); jornadas micológicas en «Otoño Mágico» | Octubre-noviembre | La Vera, Ambroz y Las Hurdes se citan como las más abundantes. Un excursionista (12-13/11, año no indicado) vio «menos variedad de la esperada» en el castañar | Castañar Gallego = Paisaje Protegido (ver 2.4) | https://planvex.es/web/2015/10/a-mycological-autumn-at-the-north-of-extremadura/ (2015-10); https://www.turismoenextremadura.es/setas-extremadura/ (2015-08-28); https://alarecercadelboletperdut.wordpress.com/acerca-de/extremadura/localidades/el-valle-de-ambroz/ | 3 / media |
| ex-jerte-eltorno | Valle del Jerte: El Torno (Día de la Seta 2013), laderas del valle | *B. edulis*, *A. caesarea*, champiñón, níscalos, carboneras, lepiotas | Otoño, tras las primeras lluvias | Jornadas micológicas y «Otoñada» | sin-confirmar | http://vcereza.blogspot.com.es/2013/11/micologia-en-el-valle-del-jerte.html (2013-11, republicada 2018-09-15); https://micoex.org/dia-de-la-seta-de-extremadura-new/ | 2 / media |
| ex-vera-cuacos | La Vera: Cuacos de Yuste (jornadas del Centro de Educación Ambiental), Ruta Carlos V (castaños y robles) | Boletus y otras | Noviembre (jornada XVII el 25/11; año no indicado) | Un biólogo de la SME cuenta que «muchas personas han recolectado más de 30 kg al día» en épocas buenas; dato de contexto, no cupo | sin-confirmar | https://www.juntaex.es/w/jornadas-micologicas-centro-de-educacion-ambiental-de-cuacos-de-yuste ; https://alarecercadelboletperdut.wordpress.com/acerca-de/extremadura/ ; https://www.turismoenextremadura.es/setas-extremadura/ (La Vera = «la abundancia de setas… se localiza en La Vera») | 3 / media |
| ex-hurdes | Las Hurdes: pinares, encinares, cerezales, alcornocales | *B. aereus* y *Pleurotus* «todos los meses de otoño e invierno»; *B. pinicola* y colmenillas en primavera; la lista incluye *A. ponderosa* | Otoño-invierno | Texto promocional; sin parajes | sin-confirmar | https://alarecercadelboletperdut.wordpress.com/acerca-de/extremadura/localidades/las-hurdes/ (copia de todohurdes.com, s.f.) | 1 / baja |
| ex-coria-alagon | Coria y Valle del Alagón | «Setas del Valle del Alagón» (charla 22/11/2024) | Noviembre | «Coria Sabor Micológico»: V ed. 19-25/11/2012, XVII ed. con salida al campo el 23/11/2024 | sin-confirmar | https://www.cestaysetas.com/tag/extremadura/ (2012-11); Tríptico SME 2024 (enlace arriba) | 2 / media (solo eventos) |
| ex-campo-arañuelo | Navalmoral de la Mata (jornadas 6-9/11/2024) y Bohonal de Ibor («Bota y merienda» 24/11/2024) | Sin especies | Noviembre | Charla «Algunos hongos de Extremadura de hábitats muy específicos» | sin-confirmar | Tríptico SME 2024 | 1 / baja |
| ex-mirabel-dehesa-boyal | Mirabel, MUP n.º 132 «Dehesa Boyal» | Sin especies; «multitud de especies» | Todo el año (art. 6) | **Sitio con régimen conocido**: ordenanza de 2020 (ver 2.3) | **permiso** (municipal) | https://www.bandomovil.com/userFiles/QJ/QJZ00Ordenanzarecoleccinmicolgica.pdf (BOP Cáceres n.º 58, 24/03/2020) | 1 / baja como sitio de setas, **alta como dato legal** |
| ex-monfrague-serradilla | Serradilla, MUP «Dehesa Boyal y Cuarto de los Arroyos» (dentro del P. N. de Monfragüe) | Sin especies | Según autorización | Único monte donde el PRUG prevé setas sin fines comerciales | **permiso** (autorización del Parque) | https://doe.juntaex.es/pdfs/doe/2014/370o/14040023.pdf (DOE n.º 37, 24/02/2014) | 1 / alta como dato legal |
| ex-criadillas-dehesas | Dehesas de Extremadura (un aficionado de «centro de Extremadura»: «prácticamente no se notan, enterradas y a veces muy profundas») | *Terfezia arenaria* con *Tuberaria guttata* en suelos arenosos o graníticos | Marzo-junio (sobre todo abril-mayo) | Buscar la «madre de las criadillas» y el suelo agrietado o abultado | privado (dehesas) | MITECO, Inventario de Conocimientos Tradicionales, ficha *Terfezia arenaria* (s.f.) https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/temas/inventarios-nacionales/iect_terfezia_arenaria_tcm30-164132.pdf ; Fungipedia, hilo «Criadillas» (2013-03-28) https://www.fungipedia.org/setas-informacion-y-consultas/6-foro-general/54152-criadillas.html | 2 / media. *Terfezia* **no tiene ficha** en `especies.json` |

### 1.2 Lo que dicen los foros (resultado honesto)

- **Fungipedia:** los hilos que hay sobre Extremadura no dan parajes. El más útil es el del gurumelo (https://www.fungipedia.org/setas-informacion-y-consultas/6-foro-general/52597-gurumelos.html, 2013-02-16): un forero opina que en Cáceres hay más gurumelos porque «se cogen menos» y que en los pueblos salen de noche «para que no se los quiten los foráneos». Es opinión, sin lugar.
- **Foro Micológico, Forocoches y otros:** la búsqueda no devolvió nada con parajes de Extremadura (el buscador no indexa bien esos foros). **[NO VERIFICADO]: no se revisaron a mano.**
- **Prensa (Hoy, El Periódico Extremadura):** bloqueados para el buscador y para la descarga (error 406/403). Solo llegué a ellos de segunda mano. **Región Digital, Canal Extremadura:** sin artículo útil en la búsqueda.
- **SME (micoex.org):** muy activa. Publica tres series de jornadas (Lunes Micológicos de Cáceres y Badajoz, Martes de Mérida), el Día de la Seta de Extremadura (otoño, itinerante) y el Día de la Seta de Primavera (gurumelo, en fincas privadas con permiso). No publica setales.

### 1.3 Montes públicos con bosque real de las especies objetivo (dato derivado, no de fuente micológica)

Cruce de dos capas oficiales (consultadas 30/09/2026): **MFE50** del MITECO (Cáceres y Badajoz; polígonos de «Bosque» o «Dehesa» con especie principal castaño, melojo, alcornoque o encina, ocupación ≥ 60 % y FCC ≥ 50 %) y la capa de montes del MITECO (IEPF, `IEPF_CMUP_GeoJson.zip`, ya descargada en `_fuentes/mup/`). Se toman solo los montes con superficie de MUP (`sup_mup > 0`). La leyenda de esa capa no la he verificado: interpreto `id_tipo_af = 1` como monte de utilidad pública y `3` como fincas del P. N. de Monfragüe por los nombres **[NO VERIFICADO]**. «Término» es el que devuelve Nominatim para un punto del monte y puede ser inexacto. Hectáreas aproximadas de la intersección.

| Monte (capa MITECO) | Término (aprox.) | Especie principal MFE50 | ha aprox. | Espacio protegido en el punto |
|---|---|---|---|---|
| Cruces de la Sierra, Forquito y Pinajarro | Hervás | melojo | 817 (+49 castaño) | no |
| Carrascal | Valencia de Alcántara | encina | 758 | no |
| Valcorchero | Plasencia | alcornoque 558, encina 72 | 630 | **Paisaje Protegido Monte Valcorchero** |
| Dehesa Boyal | Piornal | melojo | 477 (+127) | no |
| Valhondo | Berzocana | encina | 447 | no |
| Cotos y Entrecotos | Cabezuela del Valle | melojo | 440 | no |
| Solana, Collado de Paula y Baldío | Barrado | melojo | 423 | no |
| Dehesa Boyal y Cuarto de los Arroyos | Serradilla | alcornoque 298, encina 62 | 360 | **P. N. de Monfragüe** |
| Coto | Villanueva de la Vera | melojo | 286 | no |
| Castañar Gallego | Hervás | **castaño** | 241 | **Paisaje Protegido Castañar de Gallego** |
| Castañar del Duque | Gargantilla | castaño | 75 | no |
| Egidos de Acebo | Acebo (Sierra de Gata) | melojo | 136 | no |
| Baldío de la Umbría | Jerte | melojo | 151 | **Reserva Natural Garganta de los Infiernos** |
| Baldío de Torreseca | Jarandilla de la Vera | melojo | 250 | no |
| Sierras de Pinofranqueado | Pinofranqueado (Las Hurdes) | encina | 186 | no |
| Cubero del Dehesón | Villar del Pedroso | alcornoque | 93 | no |
| Dehesilla Solana | Cabañas del Castillo | melojo 63, encina 47, alcornoque 42 | 150 | no |
| Tudía y sus faldas | Calera de León (Tentudía) | melojo | 49 | no |

Lectura: los **castañares y melojares públicos** están en Ambroz, Jerte, Vera y Gata; los **alcornocales públicos con bosque denso** son escasos (Valcorchero, Serradilla, Cubero del Dehesón, Dehesilla Solana). El resto del alcornocal de la Sierra de San Pedro es dehesa privada.

---

## 2. Normativa

### 2.1 Marco estatal

- **Ley 43/2003, de Montes** (ya en `normativa.json` como `estatal-ley-43-2003-montes`). El borrador extremeño de 2014 recuerda tres piezas: los hongos son aprovechamiento forestal (art. 6), el titular del monte es propietario de los recursos forestales «y por tanto también de los hongos» (art. 36.1) y las comunidades regulan los aprovechamientos no maderables (art. 36.3).

### 2.2 Extremadura: qué hay y qué no hay

| Fecha | Norma o documento | Qué dice | Fuente |
|---|---|---|---|
| 09/09/2014 | **Borrador de decreto CAFOR** «por el que se regula la recolección de especies micológicas en montes de utilidad pública de Extremadura y se establecen recomendaciones para su recolección en montes no catalogados» | Licencia micológica nominativa (1 a 5 años) para montes catalogados; **cupo recreativo 5 kg/persona/día, intensivo 40 kg** (solo en montes de la Junta del anexo IV y en montes locales con regulación propia); prohibido recoger de noche, remover el suelo y usar rastrillos; no se recoge en las manchas de montería o batida; hay que respetar cerramientos y usar cancillas; sin autorización de uso para comercializar en montes catalogados; **en montes no catalogados (privados) solo recomendaciones, sin prohibiciones**; en espacios protegidos se aplica solo si no contradice su norma. Anexo IV, montes de la Junta con recolección intensiva: Valdemoros (Fuenlabrada de los Montes), Utrera Pajosa II (Don Benito), Cubero del Dehesón (Villar del Pedroso) | https://www.fungipedia.org/media/kunena/attachments/1750/BORRADORLEYRECOLECCIONSETAS.pdf (texto leído en local) ; hilo de Fungipedia que lo comparte (2014-09-18) https://www.fungipedia.org/setas-informacion-y-consultas/6-foro-general/65834-ley-regulacion-de-recoleccion-de-especies-micologicas.html |
| 24/03/2015 | **Ley 6/2015, Agraria de Extremadura**, disposición adicional 13.ª | Crea la **tasa por expedición o renovación de licencias micológicas** (montes de la Comunidad o MUP de entidades locales). Cuantías que da Iberley: clase A (mayores de 16, UE) **4,90 €**, B (menores, UE) 2,13 €, C (fuera de la UE) 12,43 €; complemento de recolección intensiva en montes de la Comunidad 457,15 € (50 % de reducción para residentes UE y 66 % para extremeños) | https://www.iberley.es/legislacion/da-13-agraria-extremadura (texto consolidado por un tercero; **no he leído el DOE**; cuantías posiblemente actualizadas) |
| 03/09/2019 | **Decreto 134/2019** (actuaciones forestales) | Su artículo 3.2.c **excluye de su ámbito los aprovechamientos de «hongos»**. No regula setas | https://doe.juntaex.es/pdfs/doe/2019/1740o/19040148C.pdf |
| 24/03/2020 | Ordenanza de Mirabel | Dice que se adapta «al futuro decreto que la Junta de Extremadura prevé sacar»: el decreto seguía sin existir | BOP Cáceres (enlace arriba) |
| s.f. | Somival, «Legislación en el resto de comunidades» | «Extremadura no tiene aprobada una ley que regule la recolecta de setas»; habla de un borrador de 2017 con 15 días de información pública | https://www.somival.org/legislacion/3%20LEGISLACI%C3%93N%20EN%20EL%20RESTO%20DE%20COMUNIDADES%20AUTONOMAS.pdf (PDF leído por la herramienta solo en parte; fecha del documento **[NO VERIFICADO]**) |
| 2016 | SME, conferencia «Comentarios a la Ley Reguladora de aprovechamientos micológicos en montes públicos de Extremadura» | El documento enlazado da 404. Probablemente comenta el borrador **[NO VERIFICADO]** | https://micoex.org/conferencias/ |
| 2023-2026 | Búsquedas de decreto, orden o noticia de aprobación | **Sin resultados** | varias búsquedas el 2026-09-30 |

**Conclusión operativa:**
- **Permiso autonómico:** no he encontrado un sistema operativo (ni web de la Junta para pedirlo, ni decreto, ni cuantías vigentes). La tasa existe en la ley; **[NO VERIFICADO] si se cobra en la práctica**.
- **Cupo general (kg/día):** no hay cupo autonómico en vigor que yo pueda citar. Las cifras 5 y 40 kg son del borrador, no vigentes; el cupo de Mirabel es 7 y 30 kg (2.3). En la app: «sin cupo autonómico confirmado».
- **Zonas reguladas por la comunidad:** ninguna declarada que yo haya hallado (en el borrador, los «vedados micológicos» se declararían por resolución publicada en el DOE).
- **Sanciones:** remite a la legislación de montes (Ley 43/2003, art. 74, ya en `normativa.json`) y, en el borrador, al procedimiento sancionador autonómico.

### 2.3 Regulación local: Mirabel (único ejemplo verificado)

Ordenanza reguladora de la recolección de hongos en el MUP n.º 132 «Dehesa Boyal» (BOP Cáceres n.º 58, 24/03/2020): permiso municipal nominativo; **recreativa 7 kg/persona/día** (todas las especies, para el conjunto de montes recolectados), **intensiva 30 kg/día** y solo especies comercializables según RD 30/2009; tarifas: 3 €/día, 5 € fin de semana, 15 € temporada, 150 € intensiva por temporada; se puede limitar el número de permisos o reservarlos a vecinos; prohibido remover el suelo y usar útiles que levanten el mantillo; sanciones: leves hasta 100 €, graves 101 a 1.000 €, muy graves 1.001 a 3.000 €. Sirve de modelo para `normativa.json` como norma local; **es de un único monte** y no representa a Extremadura.

### 2.4 Espacios protegidos

Fuente de los límites: capa de Espacios Naturales Protegidos 2025 del MITECO (`Enp2025_geojson.zip`, EPSG:25830, consultada 30/09/2026; no incluye Red Natura 2000, reservas de la biosfera ni geoparques). **No he cruzado Red Natura 2000.**

| Espacio | Dónde | Qué encontré sobre setas |
|---|---|---|
| **P. N. de Monfragüe** | Cáceres (Serradilla, Torrejón el Rubio, Villarreal de San Carlos) | PRUG, Decreto 13/2014 (DOE n.º 37, 24/02/2014): está prohibida la recolección de elementos propios del Parque salvo aprovechamientos tradicionales compatibles en fincas públicas y privadas, de la gestión y de investigación autorizada. En Zona de Uso Restringido es actividad autorizable «la recolección de setas sin fines comerciales» **solo en el MUP «Dehesa Boyal y Cuarto de los Arroyos»** y hasta que el Ayuntamiento de Serradilla tenga plan micológico, las condiciones (zonas, fechas, kg por persona y día) las fija el Parque en cada autorización. **[NO VERIFICADO el régimen en otras zonas del PRUG: no se leyó entero.]** Casi todo el entorno son fincas privadas |
| **P. N. Tajo Internacional** | Frontera de Cáceres con Portugal | Sin datos de setas **[NO VERIFICADO]** |
| **Reserva Natural Garganta de los Infiernos** | Valle del Jerte | PORN (Decreto 72/2025, DOE 14/07/2025) sin referencias a la recogida de setas en el texto; PRUG nuevo por Orden de 05/12/2025 (DOE 16/12/2025), **no leído** **[NO VERIFICADO]** |
| **Paisaje Protegido Castañar de Gallego** | Hervás | Decreto 57/2015, de 7 de abril, 263,92 ha, monte público. Norma de setas **no leída** **[NO VERIFICADO]** |
| **Paisaje Protegido Monte Valcorchero** | Plasencia, 1.185 ha | Sin datos de setas **[NO VERIFICADO]** |
| Monumentos naturales (Cuevas de Fuentes de León, Cueva de Castañar…), parques periurbanos (Dehesa Boyal de Montehermoso, Moheda Alta, Sierra de Azuaga…) | varios | Sin datos de setas |
| Sin figura en la capa | Sierra de San Pedro, Villuercas (es Geoparque), Sierra de Gata, Las Hurdes, La Vera, Ambroz (fuera del Castañar Gallego), Tentudía (fuera del monumento) | Son Red Natura, geoparque o reserva de la biosfera; **no hay prohibición de setas conocida por eso** |

Regla general que fija el propio borrador: en un espacio protegido manda su norma específica (y, en general, la Ley 8/1998 de Conservación de la Naturaleza y Espacios Naturales de Extremadura, citada en el DOE 2025). Para la app: **los puntos dentro de un espacio protegido llevan `proteccion` con «norma de setas sin verificar»**, como ya se hace con Izki o Gredos.

### 2.5 Fincas privadas

- **Qué dice la norma:** el titular del monte es dueño de sus hongos (Ley 43/2003, art. 36.1). El borrador extremeño aplica **prohibiciones solo a montes catalogados**; a los privados, recomendaciones. No hay en Extremadura una figura tipo «terreno episódico» de Castilla y León (3 kg sin permiso): **en la práctica, en finca privada la recogida sin permiso del propietario se considera entrar en propiedad ajena**, y el propietario puede cerrar, cobrar o autorizar. **[NO VERIFICADO jurídicamente; no hay norma extremeña que lo diga expresamente.]**
- **Señales del terreno:** la SME pide permiso a los dueños de las fincas donde sale de campo y avisa de que no se admiten perros sueltos (Bodonal de la Sierra, 2025). El borrador de 2014 obligaba a respetar cerramientos y usar cancillas y a no recoger en manchas de montería.
- **Dónde hay montes públicos o acotados accesibles:** los de la tabla 1.3; en todos «sin reglamento autonómico» y con cuidado por si el ayuntamiento tiene ordenanza (como Mirabel). **No hay «cotos micológicos» declarados que yo haya podido localizar**; propuesta: tampoco cargarlos en `cotos.geojson`.
- **Propuesta para el aviso de zona** (texto breve): «En Extremadura no hay un permiso autonómico confirmado, pero la mayor parte de dehesas, alcornocales y castañares son fincas privadas: pide permiso al dueño. En montes públicos pregunta al ayuntamiento por ordenanzas. Monfragüe y otros espacios protegidos tienen sus propias normas.»

---

## 3. Hábitats y puntos meteorológicos

### 3.1 Método (igual que la tarea 18 de `datos.md`, con las fuentes de Extremadura)

- **Especie dominante y FCC:** MFE50 del MITECO, shapefiles provinciales de Badajoz (`MFE50_06`) y Cáceres (`MFE50_10`), descargados de https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/mfe50_descargas_extremadura.html (30/09/2026). Punto en polígono (punto más interior del polígono). Campos leídos: `SP1` (código IFN), `O1` (décimas de ocupación), `FCC_POND`, `DEFINICION`, `NOM_FORARB` (nombre del hábitat que da la propia capa: «Alcornocales», «Castañares», «Melojares»).
- **Bosque real:** además, ortofoto PNOA (WMS del IGN) mirada a ojo en todos los puntos.
- **Protección:** capa ENP 2025 del MITECO (2.4) y capa de montes del MITECO (1.3).
- **Altitud:** API de elevación de Open-Meteo (30/09/2026). Para pedir la meteorología usar `elevation=` igual a ese valor.

### 3.2 Puntos propuestos

Hábitats (códigos que ya existen en `zonas.json`): `alcornocal`, `castanar`, `melojar`, `encinar`.

| id propuesto | Lugar (término por Nominatim) | lat, lon | alt (m) | hábitat | MFE50 (polígono) | Protección | Acceso |
|---|---|---|---|---|---|---|---|
| **ex-sanpedro-alcornocal** | Salorino, Sierra de San Pedro | 39.43489, -7.03565 | 452 | alcornocal | 299234: alcornoque 80 %, FCC 70, «Bosque» / «Alcornocales»; ortofoto: masa cerrada y oscura | Fuera de la capa ENP (Tajo Internacional a 6,5 km) | MUP más cercano a 3,5 km: **privado probable** |
| **ex-villuercas-castanar** | Alía / Castañar de Ibor, Villuercas-Ibores | 39.4801, -5.3527 | 907 | castanar | 275572: castaño 90 %, FCC 80, «Bosque» / «Castañares»; ortofoto: monte cerrado de frondosas | Fuera de la capa (Corredor Río Guadalupejo a 3,7 km) | Sin MUP dentro; **sin confirmar** |
| **ex-ambroz-castanar** | Hervás, Valle del Ambroz | 40.25594, -5.85655 | 936 | castanar | 301589: castaño 80 % (+ alcornoque 10 %), FCC 90, «Bosque» / «Castañares»; ortofoto: dosel cerrado | **A 0,4 km del Paisaje Protegido Castañar de Gallego** (no dentro) | Junto al MUP Castañar Gallego (0,4 km) |
| **ex-gata-castanar** | San Martín de Trevejo (zona de los Ojestos), Sierra de Gata | 40.23195, -6.7863 | 833 | castanar | 307108: castaño 90 %, FCC 85, «Bosque» / «Castañares»; ortofoto: masa continua | Fuera de la capa; a 0,5 km un Árbol Singular (Castaño del Cobijo) | MUP «Jálama» a 0,6 km |
| ex-tentudia-alcornocal (alterno) | Monesterio / Calera de León, Tentudía | 38.03955, -6.31181 | 719 | alcornocal | 402706: alcornoque 80 %, FCC 80, «Bosque» / «Alcornocales»; ortofoto: arbolado muy poblado pero con claros (~70 % de copa) | Fuera de la capa (a 13,5 km las Cuevas de Fuentes de León) | A 0,4 km de los MUP «Tudía y sus faldas» y «Dehesa La Víbora» |
| ex-gata-melojar (alterno) | Acebo, Sierra de Gata | 40.19629, -6.74398 | 799 | melojar | 307330: melojo 90 %, FCC 70, «Bosque» / «Melojares» (1.990 ha) | Fuera de la capa | **Dentro del MUP «Egidos de Acebo»** (monte público) |

Descartados: un punto junto a Valencia de Alcántara (polígono 298007, alcornoque 70 %, FCC 50) porque la ortofoto muestra dehesa abierta y matorral; el castañar dentro del Paisaje Protegido Castañar de Gallego (polígono 301536, FCC 90, 40.2533, -5.8863) que sí está **dentro** del espacio; y el encinar de Tentudía (polígono 315827) porque en la app el objetivo es *B. aereus* y las tres especies de la zona ya se cubren con alcornoque, castaño y melojo.

**Encinar:** el encargo pedía un punto de encinar. El MFE50 da encinares de «Bosque» grandes en Tentudía (3.493 ha, FCC 60, 38.1033, -6.4012; a 2,1 km del Parque Periurbano La Pisá del Caballo y a 9,3 km de las Cuevas de Fuentes de León) y de Sierra de Montánchez con FCC baja (30 %). **Lo dejo como punto opcional: no lo miré en ortofoto** [NO VERIFICADO el bosque denso]. En encinar la fuente del boletus es más débil (la mayor parte son dehesas abiertas).

**Níscalo de repoblación (opcional):** manchas grandes de pino resinero con FCC ≥ 50 según el MFE50: Las Hurdes (40.3324, -6.3135, 737 ha, FCC 75, «Bosque»), Villuercas (39.3572, -5.3045, 1.021 ha, «Plantación», FCC 70) y La Vera (40.0093, -5.6305, 432 ha, «Plantación», FCC 80). No se miraron en ortofoto.

**Zonas propuestas** (bbox sin solaparse con las de `zonas.json`; el bbox más próximo, Gredos, empieza en -5.4):

| id | bbox [lon mín, lat mín, lon máx, lat máx] | puntos |
|---|---|---|
| extremadura-norte | [-6.95, 40.10, -5.70, 40.40] | ex-ambroz-castanar, ex-gata-castanar, (alterno) ex-gata-melojar |
| extremadura-villuercas | [-5.60, 39.30, -5.10, 39.60] | ex-villuercas-castanar |
| extremadura-sanpedro | [-7.40, 39.25, -6.85, 39.60] | ex-sanpedro-alcornocal |
| extremadura-tentudia | [-6.50, 37.95, -6.10, 38.25] | ex-tentudia-alcornocal |

Las cuatro zonas se quedan con un punto cada una (salvo la del norte), que es poco; alternativa: **una sola zona «extremadura» con los 4-5 puntos**, pero el bbox sería enorme (lon -7.4 a -5.1). Decisión pendiente de la persona.

---

## 4. Estaciones AEMET

Inventario pedido a la Edge Function `aemet?inventario=1` el 30/09/2026 (campo `indicativo`). Distancias en línea recta al punto propuesto. **No he comprobado que estas estaciones reporten lluvia diaria reciente** (la función solo admite estaciones de su lista blanca, `supabase/functions/aemet/estaciones.json`; las de Extremadura no están). Antes de usarlas hay que meterlas y pasar `node scripts/estaciones-aemet.mjs sonda ID,ID,…`. Ojo: ese script busca `SUPABASE_ANON` en `js/supabase.js`, pero la clave ahora está en `js/config.js`; `inventario()` no funcionará hasta corregirlo (yo hice la consulta con un script aparte).

| Punto | Estaciones más cercanas (indicativo, altitud, distancia) | Desnivel con el punto |
|---|---|---|
| ex-sanpedro-alcornocal (452 m) | **3576X Valencia de Alcántara** (444 m, 16,9 km); 3562X Aliseda (321 m, 25,7 km); 4464X Alburquerque (283 m, 28,3 km) | +8 m (Valencia) |
| ex-villuercas-castanar (907 m) | **4245X Guadalupe** (660 m, 3,2 km); 3386A Navalvillar de Ibor (923 m, 12,9 km); 4339X Cañamero (590 m, 18,5 km); 4236Y Puerto Rey (689 m, 28,2 km) | -247 m (Guadalupe); -16 m (Navalvillar, más lejos) |
| ex-ambroz-castanar (936 m) | **3504X Hervás** (724 m, 1,1 km); 3514B Tornavacas (991 m, 15,1 km); 3516X Piornal (1.260 m, 15,2 km); 3436D Garganta la Olla (690 m, 17,2 km) | -212 m (Hervás) |
| ex-gata-castanar (833 m) | **3536X Hoyos** (560 m, 8,3 km); 3547X Valverde del Fresno (450 m, 9,7 km) | -273 m |
| ex-gata-melojar (799 m) | **3536X Hoyos** (560 m, 2,9 km) | -239 m |
| ex-tentudia-alcornocal (719 m) | **4499X Monesterio** (771 m, 5,8 km); 4501X Fuente de Cantos (602 m, 18,8 km) | +52 m |

Otras estaciones del inventario por comarca (por si se amplía la zona): Las Hurdes 3494U Nuñomoral (470 m); La Vera 3423I Madrigal de la Vera (464 m); Jerte 3514B Tornavacas; Monfragüe y entorno 3448X Serradilla (406 m), 3475X Cañaveral (373 m), 3463X Trujillo (503 m); Montánchez 4411C Alcuéscar (467 m), 3469A Cáceres (394 m); Sierra de Jerez 4511C Jerez de los Caballeros (381 m), 4520X Fregenal de la Sierra (586 m); Villuercas 4244X Herrera del Duque (447 m).

**Problema:** el desnivel de 200-270 m de Hervás, Guadalupe y Hoyos respecto al bosque es grande para la temperatura; la app ya usa la altitud del terreno con Open-Meteo, y AEMET solo aporta la lluvia, así que el desnivel afecta poco.

---

## 5. Temporada típica

- **Sin cifras extremeñas** específicas para *B. aereus*. Lo que hay:
  - Termófilo: los descensos de temperatura mínima lo cortan (Micocyl, nota de 02/11/2023: «producciones testimoniales» en noviembre en Castilla y León). https://www.micocyl.es/noticias/las-lluvias-y-el-descenso-de-temperaturas-propician-la-fructificacion-de-especies-mas
  - Fructifica de finales de primavera a mediados de otoño, y en el sur de España puede alargarse hasta diciembre o enero (MicoAragón, sin fecha, hablando de *B. reticulatus*, cifras para *B. aereus* **[NO VERIFICADO]**). «Grandes brotes 10 a 15 días tras precipitaciones fuertes» (misma fuente). https://www.micoaragon.es/noticias/setas-de-primavera-y-verano/el-boleto-de-verano-el-rey-de-las-altas-temperaturas
  - Cesta y Setas (15/08/2026): en Andalucía y Extremadura «el otoño micológico suele llegar más tarde»; hay que esperar a que «el calor pierda intensidad». https://www.cestaysetas.com/otono-2026-que-podemos-esperar-de-la-proxima-campana-de-setas-en-espana/
  - Un reportaje recopilado en el blog alarecerca (año **no indicado**): en un «veroño» con lluvias a finales de verano, la recolección «se adelantó de octubre a principios de septiembre en algunas zonas de montaña» de Extremadura. https://alarecercadelboletperdut.wordpress.com/acerca-de/extremadura/
  - Cesta y Setas (16/02/2016, Francisco Camello): tras un episodio de lluvia continua, en alcornocales húmedos con helechos aparecieron en febrero rebozuelo (*Cantharellus pallens*) y trompeta de los muertos: hay actividad fuera de otoño en el alcornocal.
  - Hurdes: *B. aereus* «todos los meses de otoño e invierno», promocional (todohurdes).
  - SME: el Día de la Seta de Extremadura se celebra a mediados de noviembre (2023 y 2024) y el de Primavera a finales de marzo (gurumelo).
- **Consecuencia para el índice:** el `indice` actual de *B. aereus* (temporada 8-10, `topt` 17 °C, rango 14-21, `pmin` 25 mm, `pfull` 70 mm, desfase 7-14 días, helada nula, confianza baja, base heurística, `datos.md`/`03-fructificacion-datos.md`) no contradice nada de lo leído. Extremadura pide dos ajustes que no se pueden apoyar en fuente numérica: (a) que el suroeste da más tarde el primer flujo otoñal, (b) que en noviembre y diciembre hay que tener en cuenta la helada. Dejarlo como está y anotarlo en `notas`; **no inventar umbrales.** Nota: con el índice actual, meses 8-10, la ficha no cubriría la fructificación invernal del suroeste.
- **Primavera:** el *B. aereus* primaveral no lo encontré en ninguna fuente extremeña **[NO VERIFICADO]**; la primavera de Extremadura es de gurumelo (enero-abril, marzo el mejor) y criadilla (marzo-junio, sobre todo abril-mayo), y ambas van fuera del índice (hipogeo o no recomendado).
- **GBIF** (30/09/2026, registros con coordenadas, PRESENT, país ES; bbox aproximados): *B. aereus* 6 en el norte, 3 en Villuercas, 0 en San Pedro y 0 en Tentudía; 60 en un rectángulo que cubre toda Extremadura (incluye trozos de otras regiones y Portugal). *A. caesarea* 45, *M. procera* 121, *A. ponderosa* 39, *A. verna* 14, *A. vidua* 1, *A. phalloides* 75, *Terfezia arenaria* 14 en ese rectángulo. **Con tan pocos datos, `presencia` saldrá «orientativa» casi en todas las especies**, y el gurumelo y la criadilla figurarán solo gracias a GBIF.

---

## 6. Avisos de seguridad propios

- **Gurumelo (*Amanita ponderosa*): la app no lo recomienda.** La propia SME (https://micoex.org/intoxicaciones/, consultada 30/09/2026) avisa: «En Extremadura tenemos que cuidar mucho no confundir *Amanita ponderosa* con *Amanita verna*, ya que coinciden en tiempo (primavera) y en hábitat, además el hecho de consumirlas con mucha frecuencia en fase de huevo hace que sea más difícil distinguir una de la otra». Recogerlo solo como dato (época enero-abril, asociado a jara y encina, según Fungipedia y Cesta y Setas).
- ***Amanita verna* / *A. vidua* (mortales, primavera):** la SME las agrupa en su relación de especies como «tóxica». En el GBIF hay 14 registros de *A. verna* y 1 de *A. vidua* en Extremadura. La app ya tiene las dos fichas (`amanita-verna`: meses 3-5; `amanita-vidua`: 4-6).
- **Cifras propias:** entre 2000 y 2007 hubo **20 intoxicaciones por setas en Extremadura, 7 graves y 2 muertes**; el 35 % no sabía qué había comido y el 40 % confundió setas que creía conocer (SME, https://micoex.org/intoxicaciones/, y Turismo de Extremadura, 2015-08-28). Son datos antiguos.
- **Cuidado con lepiotas pequeñas:** la SME recuerda consumir solo lepiotas con sombrero de más de 10 cm. También cita casos con *A. phalloides* de cutícula clara confundida con champiñón joven.
- **Otras confusiones locales** que citan las fuentes: *A. pantherina* y *B. satanas* junto a los castañares de las Villuercas (blog de 2010); las tres mortales que destaca el turismo extremeño: *A. phalloides*, *A. virosa*, *A. verna*.
- **Dos amanitas con ficha en la app** (`amanita-ovoidea`, `amanita-proxima`) salen bajo encina y alcornoque según la literatura general; no hay fuente extremeña que las relacione con sitios concretos: avisar con la ficha, sin inventar.
- **Regla de la SME:** no recoger sin conocer; el cestillo de mimbre y no bolsa.

### Nombres populares ambiguos

- **«Tana»:** Cesta y Setas (15/08/2026) lo usa para *Amanita caesarea* en el contexto de Extremadura. El encargo lo tomaba por *Macrolepiota*. **[NO VERIFICADO el uso local]:** no hay una fuente extremeña concluyente. La app debería mostrar siempre el nombre científico y no usar «tana» suelto, porque confundir una *Amanita* con una lepiota o con la oronja puede ser peligroso.
- **«Tentullo»:** un resultado lo da para *Boletus reticulatus* **[NO VERIFICADO]**.
- **«Criadilla de tierra»:** en Extremadura se llama así a *Terfezia arenaria*, «patata de tierra».

---

## 7. Huecos y próximos pasos

1. **Confirmar con la Dirección General de Gestión Forestal** si hay decreto o licencia micológica vigente; revisar el DOE por «recolección micológica» en 2026. Es el dato más importante y el menos firme.
2. Leer a mano el PRUG de Monfragüe (zonificación completa), el Decreto 57/2015 (Castañar Gallego) y el PRUG 2025 de Garganta de los Infiernos para ver si regulan las setas.
3. Buscar a mano en el Foro Micológico, Fungipedia y Forocoches hilos con parajes (la búsqueda no los indexó); probar con Hoy y El Periódico Extremadura desde un navegador.
4. Cruzar los puntos con Red Natura 2000 (ZEPA Sierra de San Pedro, ZEC de Gata, Villuercas).
5. Meter las estaciones AEMET en la lista blanca y ejecutar la sonda; corregir `scripts/estaciones-aemet.mjs` (clave en `js/config.js`).
6. Decidir si se mantienen 4 zonas de 1 punto o una sola zona «extremadura».
7. Crear, si se decide, `sitios.json` con las filas de 1.1 (todas `verificado: false`, con `lat`/`lon` a `null` salvo Berzocana, que los da su fuente) y las normas `ex-ley-agraria-6-2015-tasa` (tasa, sin reglamento), `ex-borrador-decreto-2014` (`vigente: false`), `ex-monfrague-prug-decreto-13-2014` y `ex-mirabel-ordenanza-2020`.
8. Añadir ficha de *Terfezia arenaria* (hipogeo, `sinIndice`) si se quiere mostrar la criadilla; hoy no existe.

### Fuentes principales (todas consultadas el 30/09/2026)

- Borrador CAFOR 09/09/2014: https://www.fungipedia.org/media/kunena/attachments/1750/BORRADORLEYRECOLECCIONSETAS.pdf
- Ley 6/2015 Agraria, DA 13.ª (Iberley): https://www.iberley.es/legislacion/da-13-agraria-extremadura
- Decreto 134/2019: https://doe.juntaex.es/pdfs/doe/2019/1740o/19040148C.pdf
- PRUG Monfragüe, Decreto 13/2014: https://doe.juntaex.es/pdfs/doe/2014/370o/14040023.pdf
- PORN Garganta de los Infiernos, Decreto 72/2025: https://doe.juntaex.es/pdfs/doe/2025/1340o/25040123.pdf
- Ordenanza de Mirabel: https://www.bandomovil.com/userFiles/QJ/QJZ00Ordenanzarecoleccinmicolgica.pdf
- SME: https://micoex.org/ (tríptico 2024, Día de la Seta, intoxicaciones, relación de especies)
- MFE50 Extremadura: https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/mfe50_descargas_extremadura.html
- ENP 2025: https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/servicios/banco-datos-naturaleza/enp/Enp2025_geojson.zip
- GBIF: https://api.gbif.org/v1/occurrence/search (consultas del 30/09/2026)

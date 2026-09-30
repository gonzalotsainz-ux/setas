# 04c · Sitios conocidos y trucos locales: Montes de Toledo y Álava

Investigación del 30/09/2026. Cruzada con `docs/investigacion/01-normativa-cotos.md`, `data/normativa.json`, `data/cotos.geojson` y `data/zonas.json` (solo lectura).

## Límites de esta investigación (leer primero)

- El presupuesto de búsquedas web de la sesión (200) se agotó a mitad de trabajo. Después solo pude abrir páginas concretas. Muchas de las que probé no daban texto (PDF sin extraer, 403, errores SSL, El Correo bloqueado) o no mencionaban setas.
- No pude consultar Diario de Noticias de Álava, El Correo, La Tribuna de Toledo, ABC Toledo, ni las webs de la Sociedad Micológica de Álava, Toletum o Sociedad Micológica de Toledo. De Aranzadi solo abrí una ficha de especie.
- **Resultado honesto: hay pocas fuentes con sitios concretos.** Los micólogos no suelen publicar «setales» (el foro Fungipedia lo dice expresamente). Casi todo lo que sigue es a escala de comarca, monte o municipio. **Ninguna fuente que leí da coordenadas de setales.** Las coordenadas de las tablas vienen de `data/zonas.json` (Mapa Forestal MFE50 o WMS de Euskadi): indican un **tipo de bosque**, no un dato de fuente micológica.
- Marcas: **[UNA SOLA FUENTE]**, **[NO VERIFICADO]**. «Fuentes indep.» cuenta solo las que hablan de ese sitio o truco concreto.

---

## 1. Montes de Toledo

### 1.1 Cruce con la normativa (aplica a toda la zona)

- Norma: Orden de 15/11/2016 de Castilla-La Mancha. Recogida libre y episódica de hasta 5 kg o 10 L por persona y día; noche, rastrillo/removido del suelo y bolsas de plástico prohibidos. En `normativa.json` está con `verificado: false` (el DOCM da 404; solo se leyó una copia de vLex).
- **Propiedad privada:** las setas son del titular del monte (Ley 43/2003, art. 36). En los Montes de Toledo predominan las fincas privadas y cinegéticas (`01-normativa-cotos.md`, sección 10). **Hace falta permiso del propietario** y hay que evitar los días de montería. No encontré ordenanzas micológicas municipales en Los Yébenes, Navahermosa, Hontanar, Los Navalucillos ni San Pablo de los Montes [NO VERIFICADO: no consulté el BOP de Toledo]. `data/cotos.geojson` no trae ningún coto en Toledo.
- Cartografía: solo los MUP del MITECO. Hay que cruzar cualquier sitio con esa capa para saber si el monte es público.

### 1.2 Tabla de sitios y trucos

| Sitio / municipio | Coordenadas | Especies citadas | Hábitat / árbol | Época | Consejo concreto | Fuente (URL, fecha) | Fuentes indep. | Situación legal |
|---|---|---|---|---|---|---|---|---|
| **Pinares de repoblación de Navahermosa** (montes públicos de Valcavero, con roble y melojo, y de la Sierra de la Galinda, con encina y pino) | No las da la fuente | Níscalo (*Lactarius deliciosus*): «con las repoblaciones de pino llegó el níscalo, prácticamente desconocido en la zona hasta los años 80» | Pinares de repoblación. La web nombra también Valcavero y la Sierra de la Galinda, pero no dice dónde salen los níscalos | No la da | Busca níscalo en las manchas de pino repoblado, no en el encinar. **Inferencia mía**: el texto solo dice que el níscalo llegó con el pino | Ayuntamiento de Navahermosa, «Patrimonio natural»: https://navahermosa.es/turismo-y-m-ambiente/patrimonio-natural/ (sin fecha visible) | 1 [UNA SOLA FUENTE] | Montes públicos de Navahermosa: sin ordenanza localizada. Linda con Cabañeros |
| **Laderas de los Montes de Toledo** (sin municipio) | No | Boletus edulis, B. aereus, boletus de pino, *Amanita caesarea*, *Tricholoma portentosum*, paraguas, champiñón | Laderas forestales | «Octubre y noviembre, los meses ideales» | Lista genérica del artículo, sin lugar concreto | El Español (El Digital CLM), 26/10/2023: https://www.elespanol.com/eldigitalcastillalamancha/region/20231026/mejores-sitios-recoger-setas-castilla-la-mancha/804919874_0.html | 1 | Hasta 5 kg en monte libre; fincas privadas, con permiso |
| **Jornada micológica en los Montes de Toledo** (oferta comercial guiada, sin municipio) | No | *Amanita caesarea*, *Boletus edulis*, níscalos | No lo dice | No lo dice | Con guía micólogo; acaba con «revisión de los ejemplares recogidos». Es un indicio de que las tres especies se dan, no un sitio | Destination Lab: https://destinationlab.es/destinos/jornada-micologica-en-los-montes-de-toledo/ (sin fecha) | 1 (comercial) | La organización gestiona el permiso |
| **Sierra de San Vicente: Navamorcuende** (noroeste de Toledo; **fuera de tu lista**, la apunto por ser la única con jornadas micológicas oficiales) | No | No cita especies | Robledales, castañares, pinares, encinares y jarales; «una de las zonas más lluviosas y biodiversas de la provincia» | Jornadas del 14 al 16/11/2025 | Las organiza el Servicio Agrario de la Diputación de Toledo con la Asociación Micológica **Toletum**. Buena forma de aprender con gente local | El Debate, 07/11/2025: https://www.eldebate.com/espana/castilla-la-mancha/20251107/este-rincon-escondido-toledo-donde-nacen-setas-buscadas-otono_352922.html | 1 | Actividad guiada |
| **Criadillas de tierra (*Terfezia arenaria*), San Pablo de los Montes** | No | Criadilla (hongo hipogeo, no seta de sombrero) | Bajo jara: «Donde hay jarilla, hay criadilla» (dicho recogido en San Pablo de los Montes) | No la fechan | **Truco local con planta indicadora:** buscar bajo las jaras. El artículo cita también las criadillas en Toledo y Ciudad Real | Fajardo et al. (2010), «Etnomicología en Castilla-La Mancha», *Bol. Soc. Micol. Madrid* 34: 341-360: https://w3.ual.es/GruposInv/myco-ual/textos/EtnomicologiaCLM.pdf | 1 [UNA SOLA FUENTE] | Ver 1.1. No encontré si las criadillas tienen norma propia en CLM [NO VERIFICADO] |
| **Encinar de Los Navalucillos, melojar de Menasalbas, alcornocal de Sevilleja de la Jara** | Navalucillos 39,6101 N, -4,6186 E, 972 m; Menasalbas 39,5501 N, -4,4125 E, 941 m; Sevilleja 39,4552 N, -4,925 E, 550 m | (ninguna cita de setas) | Encinar, melojar, alcornocal | — | **Ninguna fuente los cita como sitios de setas.** Son puntos de tipo de bosque del repo y sirven como hipótesis de hábitat, no como recomendación | `data/zonas.json`, ids `toledo-*` | 0 | Sin datos |
| **Los Yébenes, Ventas con Peña Aguilera, Hontanar, Robledo del Mazo, Sevilleja de la Jara, Los Navalmorales (setas)** | — | — | — | — | **No encontré ninguna fuente con setas en estos municipios.** Las páginas de Hontanar y del sendero La Milagra-El Cabezo que abrí no mencionan setas | — | 0 | Fincas privadas y cinegéticas: permiso del propietario |
| **Toletum / Sociedad Micológica de Toledo** | — | — | — | — | Solo confirmé que Toletum colabora con la Diputación (ver Navamorcuende). No conseguí guías de salidas ni consejos suyos | — | 0 | — |

**Frases generales sin fuente fiable** (salieron en resúmenes de búsqueda y no las pude confirmar en la página): que los Montes de Toledo y Sierra Morena tienen suelos silíceos y bosque de frondosas más ricos en hongos que la llanura manchega, y que *A. caesarea* y *B. aereus* se recogen sobre todo en encinares arenosos y rebollares [NO VERIFICADO].

### 1.3 Aviso de *Amanita vidua / verna / virosa* en primavera

**Ninguna fuente que leí menciona a Toledo ni a los Montes de Toledo para estas especies.** Lo que sí dicen:

| Fuente | Qué dice | Fecha |
|---|---|---|
| eldiario.es (Castilla-La Mancha), sobre el hallazgo de *A. vidua* por un investigador de la Universidad de Alcalá: https://www.eldiario.es/castilla-la-mancha/de-ciencia/amanita-vidua-seta-blanca-sabrosa-mortal-descubierta-investigador-universidad-alcala_132_9085174.html | «Podemos encontrarla en Castilla-La Mancha, también sobre suelos ácidos». Sale **entre marzo y principios de junio**, según lluvias y humedad, **entre alcornoques y encinas sobre suelo ácido**. Tiene las mismas toxinas que *A. phalloides*; dosis mortal estimada de unos 100 g para 60-70 kg. Consejo: consumir solo lo que se conoce con certeza | 23/06/2022 (act. 24/06/2022) |
| Amivall, «Setas tóxicas en Castilla-La Mancha»: https://amivall.com/setas-toxicas-castilla-la-mancha-guia-identificacion-prevencion.php | Cita *A. verna* (cicuta de primavera) y *A. virosa* (oronja cheposa), blancas, con anillo y volva, «menos comunes en algunas zonas de la región que *A. phalloides*». No da mes ni lugar | sin fecha |
| La Casa de las Setas, *A. verna*: https://lacasadelassetas.com/blog/amanita-verna-cuidado-con-la-cicuta-de-primavera/ | Primaveral, «de finales de abril-mayo». Una sola seta puede matar. **La confusión más peligrosa es con el gurumelo (*A. ponderosa*)**: láminas apretadas y sin olor en *verna*; en *ponderosa*, láminas separadas que se ponen rosadas al corte y olor a tierra. Su descripción del hábitat (calcáreo, hayas, robles) no coincide con las otras fuentes: cautela | sin fecha |
| La Casa de las Setas, perrechico: https://lacasadelassetas.com/blog/perrechico-una-seta-muy-especial/ | Cita *A. verna* como tóxica de primavera, junto a *Entoloma sinuatum* (láminas rosadas, esporada rosa) e *Inocybe patouillardii* | sin fecha |

**Conclusión práctica** [inferencia mía, **NO VERIFICADO** en fuente para Toledo]: los Montes de Toledo tienen alcornocal, encinar y suelo silíceo, justo el hábitat que describe la fuente de *A. vidua* (ácido, alcornoque/encina, marzo a principios de junio). En primavera, en esa zona, **no recojas setas blancas con anillo y volva, ni gurumelo ni champiñón silvestre, sin identificación experta.** Fuentes que coinciden en el peligro: 3 (eldiario.es, Amivall, La Casa de las Setas; esta última cuenta como una).

### 1.4 NO IR: prohibido o restringido

| Sitio | Motivo | Fuente legal |
|---|---|---|
| **Parque Nacional de Cabañeros** (Alcoba de los Montes, Horcajo de los Montes, Retuerta del Bullaque…; Navahermosa y Hontanar lindan con él) | **No encontré la regla de setas del PRUG de Cabañeros** (`01-normativa-cotos.md` 14.3; la página del MITECO dio 404 y la de Hontanar no habla de setas) [NO VERIFICADO]. En el único parque nacional cuyo PRUG sí está leído (Guadarrama) hace falta autorización y está prohibida la recolección episódica. **Mientras no se confirme lo contrario, trátalo como NO IR** | Ley 43/2003; zonificación del PRUG en el WFS del OAPN (`http://sigred.oapn.es/geoserverOAPN/ZonificacionPRUG/ows`, filtrar «Cabañeros»; no la he descargado) |
| **Fincas privadas y cotos de caza** (gran parte de la comarca) | Las setas son del propietario. Sanción leve de 100 a 1.000 € (art. 74 Ley 43/2003). Evita las monterías | https://www.boe.es/eli/es/l/2003/11/21/43/con |

---

## 2. Álava

### 2.1 Cruce con la normativa (aplica a toda la zona)

- **Decreto Foral 89/2008** (verificado en `normativa.json`): libre hasta **2 kg por persona y día**; solo cuchillo o navaja; cesta (sin bolsas de plástico ni mochilas); no remover el suelo ni arrancar; prohibido de noche (puesta a salida del sol). Sanciones de 30 a 250 € (según el resumen de la Diputación).
- **Acotados oficiales** (Diputación; en el repo): Parque Micológico **Asparrena-Apota**, coto de **Arraia** (Izki), **Consierra de Árcena** y Junta de **Gordoa** (MUP 312). **Legutio** tiene ordenanza propia, aunque no aparece en la lista de la Diputación. Polígonos aproximados en `data/cotos.geojson` (ids `alava-arraia`, `alava-arcena`, `alava-asparrena-apota`, `alava-gordoa`, todos con `regimenConfirmado: false`; Legutio no tiene polígono).
- **Gorbeia** (PRUG, Decreto 169/2019) y **Valderejo** (PRUG, Decreto 72/2018) remiten al DF 89/2008: 2 kg/día, libre fuera de acotados. **Izki**: el PRUG (Decreto 73/2018) no se pudo leer; por analogía sería lo mismo, pero **no está comprobado**.
- Discrepancia: Gasteiz Hoy (nov. 2023) habla de tres zonas acotadas y de una cuarta «aprobada pero no activa» (Olabarri, Montevite, Nanclares de la Oca); la Diputación lista cuatro (con Gordoa). **[NO VERIFICADO]** cuál es cuál. Mira la Diputación antes de ir.

### 2.2 Tabla de sitios y trucos

| Sitio / municipio | Coordenadas | Especies citadas (euskera) | Hábitat / árbol | Época | Consejo concreto | Fuente (URL, fecha) | Fuentes indep. | Situación legal |
|---|---|---|---|---|---|---|---|---|
| **Gorbeia: hayedos de Urkabustaiz (Sarría, Casa del Parque)** | Hayedo de Gorbeia (Urkabustaiz): 42,954 N, -2,9184 E, 760 m (repo, tipo de bosque) | Boletus edulis, B. pinophilus, níscalo, *A. caesarea*, B. aereus (lista general del artículo, no exclusiva de Gorbeia). *Calocybe gambosa* registrado en Urkabustaiz | Hayedo: «hayas majestuosas y cantidades exageradas de hongos» | Otoño (perretxiko en primavera) | Empieza por la Casa del Parque de Sarría (a 20 km al noroeste de Vitoria), junto a un área recreativa con hayas grandes y una pista asfaltada junto al río Baias | Hola, 24/10/2022: https://www.hola.com/viajes/20221024219639/mejores-bosques-espana-coger-setas/ · Aranzadi, ficha *C. gambosa*: https://www.aranzadi.eus/buscador-micologico/ficha/1-1-003.02.27.00.01.00 | 2 (Hola: hayedo; Aranzadi: perretxiko) | **Libre, 2 kg/día** (PRUG Gorbeia remite al DF 89/2008). Ojo: Orden Foral de restricciones en la berrea en Zigoitia (no la leí) |
| **Izki: Korres, Bernedo, Apellániz, Maeztu** (Arraia-Maeztu, Bernedo y Campezo; Parque Natural de Izki) | Marojal de Izki (Bernedo): 42,6824 N, -2,4941 E, 772 m (repo) | Ninguna fuente lista especies para el coto | **Roble melojo (*Quercus pyrenaica*) 3.498 ha (≈48 % del bosque)**, haya 2.003 ha, quejigo 1.120 ha. «Una de las formaciones de melojo mejor conservadas del mundo» | No la da | El coto abarca 16 pueblos (Apellániz, Azazeta, Korres, Maeztu, Onraita, Aletxa, Arenaza, Cicujano, Ibisate, Leorza, Musitu, Roitegui, Sabando, Virgala Mayor y Menor, Bitigarra de San Vicente de Arana). Aparcar junto a la iglesia de Apellániz, en el Parketxe de Korres o en los pueblos. Permiso en el Ayuntamiento (945 410 033), restaurantes Izki, Los Roturos, Virgala y Obenkun, y Parketxe de Korres | Ayuntamiento de Arraia-Maeztu, ficha del coto (2017): https://www.arraia-maeztu.eus/wp-content/uploads/2017/03/coto-setas-maeztu-17-03-22-Informacion.pdf · web: https://www.arraia-maeztu.eus/servicios/coto-de-setas/ · vegetación: https://es.wikipedia.org/wiki/Parque_natural_de_Izki | 2 (ayuntamiento y Wikipedia; ninguna habla de especies) | **PERMISO NECESARIO** (coto de Arraia): 5 €/día, 20 €/semana, 80 €/temporada (no empadronados). Tarifas oficiales de **2017**; la prensa de 2023 las repite; no consta 2026. Izki es Parque Natural: PRUG sin leer |
| **Entzia / Aizkorri-Aratz: Parque Micológico Asparrena-Apota** (Asparrena; MUP 305, 306, 307, 311 y 632, más Monte Alto de Ametzaga) | Hayedo de Entzia (Iruraiz-Gauna): 42,7985 N, -2,494 E, 934 m; pastizal de Entzia (Arraia-Maeztu): 42,772 N, -2,3836 E, 1.011 m (repo) | No lista especies. Tamaños mínimos: sombrero de **4 cm**, y **2 cm** en trompeta negra, trompetilla amarilla (saltsaperretxiko hori), rebozuelo y senderuela (*Marasmius oreades*, marasmio-jangarri) | Hayedo y pastizal de montaña | Todos los días, de amanecer a puesta del sol | La ordenanza da **17 puntos de acceso** (Fuente de las Latxas, Cuatro Caminos-San Miguel, Txabola de Allarte, Arrazpi, Pagoelorza, Hiru Muga, entrada del parque de La Lece…, «aproximados»). Permiso con tarjeta para el salpicadero si vas en coche. Cesta de mimbre con láminas o poros hacia abajo; tapar los agujeros con la misma tierra. Prohibido llevar rastrillos, ganchos, hoces, azadas y alicates | Extracto de la ordenanza: https://www.arabakolautada.eus/site_media/uploads/84160698391126867.pdf · web municipal: http://www.asparrena.eus/ocio-y-turismo/parque-micologico-asparrena-san-millan (permisos 2026 diarios, semanales y de temporada; guía y mapa 2026) | 2 (ordenanza y web municipal) | **PERMISO NECESARIO.** 2 kg/día. Importes 2026 sin transcribir; prensa de 2023: 5 €/día y 52 €/temporada (no residentes). Dentro del Parque Natural Aizkorri-Aratz rigen además su PORN y su PRUG |
| **Perretxikos (*Calocybe gambosa*) en campas y pastos** (Álava, Navarra, Gipuzkoa) | Sin coordenadas | *C. gambosa*: perretxiko, **udaberriko zizazuria**, motxolon, susa | Pastizales y pastos, a veces coníferas o frondosas; forma corros o filas | Primavera | Busca **corros y filas en el pasto**, en zona **soleada y caliza** y **lejos de la civilización**; ese año (2011) también salieron en pinares. Confusión peligrosa: *Entoloma sinuatum* (láminas rosadas, esporada rosa) y *A. verna* (blanca, con anillo y volva) | Aranzadi (ficha): URL arriba · Fungipedia, foro, 30/04/2011: https://www.fungipedia.org/setas-informacion-y-consultas/4-consultas-de-micologia/12324-ayudarme-a-encontrarlas.html · La Casa de las Setas (cita Álava entre las zonas): https://lacasadelassetas.com/blog/perrechico-una-seta-muy-especial/ | 3 | En campas de monte público acotado, permiso; en campas particulares, del dueño. Fuera de acotado, 2 kg/día |
| **Precio del perretxiko en Vitoria** (dato de mercado) | — | Perretxiko | — | Primavera | 29,95 €/kg a finales de abril de 2011 (foro) y unos 40 €/kg (Gasteiz Hoy, sin fecha visible). Sirve para saber si la temporada está en marcha | Fungipedia (URL arriba) · https://www.gasteizhoy.com/perretxikos-caracoles-precio-san-prudencio/ | 2 | — |
| **Puerto de Herrera (Peñacerrada-Urizaharra)** | Sin coordenadas | Setas sin especificar | Bosque a 1 km de la cima, por un camino parcelario | Octubre (suceso del 11/10/2014) | Un hombre de Bilbao se perdió aquí recogiendo setas y hubo que rescatarlo. **Es un dato de uso, no una recomendación**; lleva GPS y móvil | Gasteiz Hoy, 11/10/2014: https://www.gasteizhoy.com/rescatan-en-herrera-a-un-hombre-que-se-perdio-cuando-recogia-setas/ | 1 [UNA SOLA FUENTE] | Sin acotado conocido: 2 kg/día [NO VERIFICADO el estatus del monte] |
| **Legutio (junto a Gorbeia)** | Sin coordenadas | No lista especies | Montes públicos del ayuntamiento (MUP en el anexo) | Todos los días, de amanecer a puesta del sol | Permiso en el ayuntamiento | Ordenanza: https://www.legutio.eus/sites/default/files/archivos3046a.pdf | 1 | **PERMISO NECESARIO**: 5 €/día, 20 €/semana, 80 €/temporada (no residentes; PDF sin fecha) |
| **Montes de Vitoria (Olarizu, Eskibel), Valderejo, Urkilla, Sierra de Árcena (fuera del acotado), Arraia-Maeztu (fuera de Izki)** | — | — | — | — | **No encontré ninguna fuente con sitios de setas en Olarizu, Eskibel ni Urkilla.** Valderejo y la Sierra de Árcena solo tienen dato normativo | Ver 2.1 | 0 | Sierra de Árcena: **permiso** (ordenanza BOTHA 146, 24/12/2014; 5 €/día y 75 €/temporada según prensa de 2023). Valderejo: 2 kg/día libre (PRUG) |
| **Asociación Gorbeiako Bazterra (Murgia, Zuia)** | — | — | — | — | **Truco útil:** un experto revisa tus setas **cada lunes** en su sede (carretera Domaikia 4, antigua clínica de Murgia). Su presidente, Vicente Blanco, aconseja cesta y no bolsa de plástico, y recoger solo lo que se vaya a consumir. Avisa de que la sequía y el viento del sur frenan la salida | Onda Vasca: https://www.ondavasca.com/una-jornada-dedicada-a-las-setas-en-murgia/ (sin fecha visible) | 1 [UNA SOLA FUENTE] | — |
| **Micología para todos (José David Fernández) y Osakidetza** | — | *Entoloma lividum* y pardilla son las que más intoxican | — | Otoño | Unas 200 intoxicaciones al año en Euskadi. «Nunca cojas una seta sin conocerla»; ve a urgencias con muestras | Gasteiz Hoy: https://www.gasteizhoy.com/setas-hongos-micologia-alava/ (sin fecha visible) | 1 | — |

**Sin aportes en esta pasada:** Sociedad Micológica de Álava / Arabako Mikologia Elkartea, Diario de Noticias de Álava y El Correo. Aranzadi solo dio la ficha de *C. gambosa*.

### 2.3 NO IR: prohibido

| Sitio | Motivo | Fuente legal |
|---|---|---|
| Terrenos acotados **sin permiso** (Asparrena-Apota, Arraia/Izki, Sierra de Árcena, Gordoa, Legutio) | No están prohibidos: **requieren permiso**. Entrar sin él es infracción foral (30 a 250 €, decomiso e indemnización, según la Diputación) | Decreto Foral 89/2008 (copia leída: https://www.arraia-maeztu.eus/wp-content/uploads/2017/03/coto-setas-maeztu-17-03-22-Norma.pdf) y Norma Foral 11/2007, Título VII |
| Cualquier terreno: recogida **de noche**, con bolsas, removiendo el suelo, más de 2 kg | Prohibido en toda Álava | Decreto Foral 89/2008; resumen: https://web.araba.eus/es/montes/aprovechamiento-de-hongos-flores-y-frutos-silvestres |
| Zigoitia (Gorbeia): restricciones por la berrea | **[NO VERIFICADO]**: no leí la Orden Foral; puede limitar accesos en otoño | https://zigoitia.eus/datos/contenido/documents/1784/Orden%20Foral%20de%20restricciones%20durante%20berrea.pdf |

Ningún punto de tu lista de Álava está prohibido por completo según lo que pude verificar. El permiso es obligatorio en Asparrena-Apota (Entzia), Arraia (Izki), Árcena, Gordoa y Legutio.

---

## 3. Fuentes (todas abiertas durante la investigación)

1. Ayuntamiento de Navahermosa, patrimonio natural: https://navahermosa.es/turismo-y-m-ambiente/patrimonio-natural/
2. El Español / El Digital CLM, 26/10/2023: https://www.elespanol.com/eldigitalcastillalamancha/region/20231026/mejores-sitios-recoger-setas-castilla-la-mancha/804919874_0.html
3. El Debate, 07/11/2025 (Navamorcuende): https://www.eldebate.com/espana/castilla-la-mancha/20251107/este-rincon-escondido-toledo-donde-nacen-setas-buscadas-otono_352922.html
4. Destination Lab, jornada micológica: https://destinationlab.es/destinos/jornada-micologica-en-los-montes-de-toledo/
5. Fajardo, Verde, Valdés, Rivera y Obón (2010), *Bol. Soc. Micol. Madrid* 34: https://w3.ual.es/GruposInv/myco-ual/textos/EtnomicologiaCLM.pdf
6. eldiario.es, 23/06/2022 (*A. vidua*): https://www.eldiario.es/castilla-la-mancha/de-ciencia/amanita-vidua-seta-blanca-sabrosa-mortal-descubierta-investigador-universidad-alcala_132_9085174.html
7. Amivall, setas tóxicas CLM: https://amivall.com/setas-toxicas-castilla-la-mancha-guia-identificacion-prevencion.php
8. La Casa de las Setas, *A. verna*: https://lacasadelassetas.com/blog/amanita-verna-cuidado-con-la-cicuta-de-primavera/
9. La Casa de las Setas, perrechico: https://lacasadelassetas.com/blog/perrechico-una-seta-muy-especial/
10. Hola, 24/10/2022: https://www.hola.com/viajes/20221024219639/mejores-bosques-espana-coger-setas/
11. Gasteiz Hoy, coger setas en Álava (nov. 2023): https://www.gasteizhoy.com/otono-coger-setas-hongos-alava/
12. Gasteiz Hoy, «Tiempo de setas en Álava»: https://www.gasteizhoy.com/setas-hongos-micologia-alava/
13. Gasteiz Hoy, rescate en Herrera, 11/10/2014: https://www.gasteizhoy.com/rescatan-en-herrera-a-un-hombre-que-se-perdio-cuando-recogia-setas/
14. Gasteiz Hoy, perretxikos en San Prudencio: https://www.gasteizhoy.com/perretxikos-caracoles-precio-san-prudencio/
15. Aranzadi, ficha *Calocybe gambosa*: https://www.aranzadi.eus/buscador-micologico/ficha/1-1-003.02.27.00.01.00
16. Fungipedia, foro, 30/04/2011: https://www.fungipedia.org/setas-informacion-y-consultas/4-consultas-de-micologia/12324-ayudarme-a-encontrarlas.html
17. Onda Vasca, Gorbeiako Bazterra: https://www.ondavasca.com/una-jornada-dedicada-a-las-setas-en-murgia/
18. Arraia-Maeztu, coto: https://www.arraia-maeztu.eus/servicios/coto-de-setas/ y ficha 2017: https://www.arraia-maeztu.eus/wp-content/uploads/2017/03/coto-setas-maeztu-17-03-22-Informacion.pdf
19. Asparrena, ordenanza (extracto): https://www.arabakolautada.eus/site_media/uploads/84160698391126867.pdf y web: http://www.asparrena.eus/ocio-y-turismo/parque-micologico-asparrena-san-millan
20. Legutio, ordenanza: https://www.legutio.eus/sites/default/files/archivos3046a.pdf
21. Diputación Foral de Álava, resumen: https://web.araba.eus/es/montes/aprovechamiento-de-hongos-flores-y-frutos-silvestres
22. Wikipedia, Parque natural de Izki: https://es.wikipedia.org/wiki/Parque_natural_de_Izki

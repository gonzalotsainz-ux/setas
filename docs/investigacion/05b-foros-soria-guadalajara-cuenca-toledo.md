# 05b · Foros y comunidades: Soria, Guadalajara, Serranía de Cuenca y Montes de Toledo

Investigación del **30/09/2026**. Solo lectura sobre el repo; nada comprometido en git.

## 0. Resumen honesto

- **Los foros dan poco consejo de campo para estas zonas, y casi todo es antiguo.** El único foro con hilos útiles y accesibles fue **Foro Micológico** (foromicologico.es, tablón «Zona Centro», `board=22`). Sus hilos son de **2010 a 2018**, así que casi todos los hallazgos de foro llevan [MENSAJE ANTIGUO >10 años]. Los de 2018 no entran en esa marca, pero son de hace ocho años.
- **No pude usar:** Reddit (WebFetch lo bloquea; la API de Pullpush devolvió vacío), Brave y DuckDuckGo (429 y CAPTCHA), Verema (403), Facebook (grupos privados), el buscador interno de Fungipedia (no localizado) ni el de forosetas.foroactivo.com (0 resultados). Bing solo devolvió guías comerciales, no hilos.
- **Montes de Toledo: cero hallazgos.** No encontré ni un hilo sobre Los Yébenes, Navahermosa, San Pablo de los Montes, Hontanar ni Ventas con Peña Aguilera. Tampoco en Foro Micológico: su tablón «Zona Sur» no tiene nada de Toledo. Lo único cercano es «Piedrabuena» (Ciudad Real, 2010), sobre recolectores comerciales, sin consejo de sitio.
- Donde no hay foro, cito blogs o guías locales y lo marco como **[NO FORO]**. Esos textos no dan «nº de usuarios», solo una fuente.
- Las normas no las he reinterpretado: remiten a `data/normativa.json` y `01-normativa-cotos.md`.
- Los resúmenes de hilos los generó el lector de WebFetch; los recuentos de usuarios son aproximados salvo que se indique.

## 1. Hallazgos nuevos (no están en `data/sitios.json`)

Formato: sitio y municipio · especies · consejo · fecha · URL · coincidencias · marcas · norma.

### Serranía de Cuenca

**C1. Regla de sustrato: el boletus no va en el calizo ni la llanega en el rodeno** · Serranía de Cuenca en general
- Especies: *Boletus edulis* y llanega.
- Consejo: antes de fijar la zona, mira el sustrato. No busques boletus en terreno calizo ni llanegas en rodeno (arenisca roja). Coincide con el rodeno de Cañete y Boniches que ya tenemos.
- Fecha: 03/08/2010, autor «xiquet». 17 respuestas, **11 usuarios** (el último mensaje es de 2012).
- URL: https://www.foromicologico.es/index.php?topic=3183.0
- Marcas: [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE] para la regla de sustrato.
- Norma: no concreta municipio. Aplica la Orden CLM 15/11/2016 y la ordenanza del municipio.

**C2. Lugares nombrados en el hilo «Serranía de Cuenca»** · Talayuelas, Las Torcas, Cañada del Hoyo, Río Cuervo, Beteta, La Cierva, Poyatos
- Especies: trompeta de los muertos («monrabal», 05/08/2010, «una joya»), rebozuelo («Parroco», 12/11/2010), boletus («elsaro», marzo de 2012) y parasol en pinares en primavera («Frans_1», 14/03/2012).
- Consejo: son sitios de ruta, sin coordenadas. **Talayuelas, Las Torcas y Cañada del Hoyo** son de la Serranía Baja, que hoy no tenemos cubierta. Con poca lluvia la cosecha se hunde (SrHongo, 06/08/2010). El hilo habla también de incendios entre Garaballa y Mira.
- URL: https://www.foromicologico.es/index.php?topic=3183.0
- Marcas: [MENSAJE ANTIGUO >10 años] [NO VERIFICADO] (la especie en cada sitio no está comprobada).
- Norma: **[NO VERIFICADO]** el régimen de cada municipio. Solo Tragacete, La Huérguina y Boniches tienen ordenanza leída (`01-normativa-cotos.md`, apartado 8).

**C3. Cardenete: pinares de rodeno y melojares ácidos** · Cardenete y Cañete (Cuenca), con parada en Valdemeca
- Especies: más de 50 especies en una salida, entre ellas níscalo, macrolepiotas, *Lepista nuda*, *Sarcodon imbricatus* y *Sparassis crispa*.
- Consejo: la Sociedad Micológica de Madrid eligió Cardenete para el sábado 15 de noviembre de 2025. **El rodeno da todavía a mediados de noviembre** (Cañete está a 1.075 m). Complementa `cuenca-boniches-caniete-rodeno` y `cuenca-valdemeca-fuente-ardilla` y añade el nombre **Cardenete**, que no está en `sitios.json`.
- Fecha: salida del 14 al 16/11/2025, 24 participantes.
- URL: https://sociedad-micologica-madrid.org/eventos/canete-cuenca/
- Marcas: [UNA SOLA FUENTE] [NO FORO] (reseña de una sociedad micológica). Es reciente.
- Norma: Cañete y Valdemeca siguen sin ordenanza comprobada (`01-normativa-cotos.md`, apartado 8). Comprueba Cardenete antes de ir.

**C4. Municipios de la Serranía que cita un blog local** · Arcos de la Sierra, Beamud, Jábaga, Almodóvar del Pinar, Campichuelo, Sierra de Cabrejas
- Especies: níscalo, boletus, colmenilla, pie violeta, senderuela y seta de cardo.
- Consejo: lista de pueblos sin detalle de campo. **Cabrejas (Cuenca) no es Cabrejas del Pinar (Soria).** Para Valdemeca dice 7 kg y tasa pequeña, y que los permisos se venden en ayuntamientos, bares o tiendas.
- Fecha: 26/10/2022. URL: https://torrejoncilleros.blogspot.com/2022/10/donde-buscar-setas-en-cuenca.html
- Marcas: [UNA SOLA FUENTE] [NO FORO] [NO VERIFICADO] (sin comentarios de lectores).
- Norma: el «7 kg» contradice la regla general de CLM (5 kg o 10 L) y no lo pude contrastar. **[NO VERIFICADO]**.

### Guadalajara

**G1. Orea como punto de encuentro de los foreros** · Orea y Checa (Alto Tajo)
- Consejo: «SrHongo» (administrador) dice que en Orea suelen hacer la quedada anual y que es término colindante con Checa. Un incendio de unas 2.000 ha en Checa y Chequilla (02/08/2012) y casi dos años de sequía hundieron las cosechas; se recordaban 2009 y 2010 como años buenos. **Orea y Checa son zona seria para aficionados**, pero el incendio de 2012 puede haber cambiado el pinar.
- Fecha: 02/08/2012. 15 respuestas; moderadores lusan, Loreto y jebaspe.
- URL: https://www.foromicologico.es/index.php?topic=16726.0
- Marcas: [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE].
- Norma: Orea **no está claro** en la Mancomunidad La Sierra (una página lista 14 municipios y otra 17). Discrepancia sin resolver en `04b`.

**G2. «Orea ya es coto» y el problema de la señalización** · Orea y zona del río Pelagallinas
- Consejo: en mayo y junio de 2016 los foreros dudaban de la legitimidad de las tablillas de coto («una tablilla que has podido poner tú o yo»), citaban carteles parecidos en la zona del **río Pelagallinas** y se quejaban de la falta de guarda y de regulación clara. Práctica: **no te fíes solo del cartel; pide el permiso oficial del municipio o de la Mancomunidad y guárdalo**.
- Fecha: 15/05/2016. 9 respuestas, **6 usuarios** (SrHongo, javivi, Félix, Loreto, CANTARELUS, muga).
- URL: https://www.foromicologico.es/index.php?topic=29563.0
- Marcas: [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE] [NO VERIFICADO] (estado actual).
- Norma: permiso de la Mancomunidad La Sierra, 5 € al día y 5 kg (`normativa.json`, id `guadalajara-mancomunidad-la-sierra`).

**G3. Peralejos y «Guadalajara sin cotos»** · Peralejos de las Truchas
- Consejo: en octubre de 2015 un moderador decía «de momento Guadalajara parece que no tiene cotos para las setas», y otro forero mencionaba que el coto de Peralejos se había comentado ya. Prueba de que el régimen **cambió en pocos años**: hoy manda la Mancomunidad.
- Fecha: 18 al 21/10/2015. 6 respuestas, 5 usuarios (tajo20, jebaspe, csrin, maxinny, castillejo).
- URL: https://www.foromicologico.es/index.php?topic=28439.0
- Marcas: [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE]. La parte «no hay cotos» está **desactualizada** (`01-normativa-cotos.md`, apartado 9).

**G4. Tejera Negra: el parque prohíbe la recogida y hay tablillas en el perímetro** · Cantalojas
- Consejo: según un hilo de 2010, dentro del Parque Natural la recogida estaba **prohibida**; los límites se marcan con tablillas pequeñas a intervalos regulares, como las de coto de caza. Un forero contó que le llamaron la atención en otro parque natural. Se apuntó que fuera de los límites podría permitirse.
- Acceso que da el hilo: CM-101 por Cogolludo, CM-1006 hacia Veguillas y Galve de Sorbe, desvío a Cantalojas. Ríos Lillas y Zarzas; valle de la Buitrera. Hay pinares de repoblación y brezal además del hayedo.
- Fecha: 25 y 26/01/2010. 28 respuestas, **7 usuarios** (SrHongo, lepista nuda, portentosum, monrabal, bolet, marta, divehunter).
- URL: https://www.foromicologico.es/index.php?topic=1483.0
- Marcas: [MENSAJE ANTIGUO >10 años] [NO VERIFICADO] (PRUG actual sin localizar).
- **NO IR a recoger dentro del Parque de Tejera Negra** hasta confirmar el PRUG. Endurece la ficha `hayedo-tejera-negra`, hoy «sin-confirmar».

**G5. Capuchina en Guadalajara, y arroyos en año seco** · Guadalajara sin municipio concreto
- Especies: capuchina o carbonera (*Tricholoma portentosum*), boletus edulis, níscalo.
- Consejo: en un hilo sobre la zona de Madrid, un usuario habla de sus «setales de portentosum de Guadalajara» (sin decir dónde), y varios coinciden en que, **en un año seco, los mejores ejemplares salían junto a regatos húmedos de arroyos y ríos**. La época discutida es noviembre y diciembre.
- Fecha: noviembre de 2009. 41 respuestas, **9 usuarios**.
- URL: https://www.foromicologico.es/index.php?topic=1020.0
- Marcas: [MENSAJE ANTIGUO >10 años] [NO VERIFICADO] (el lugar no se nombra). El truco del arroyo vale para todas las zonas.

**G6. Marzuelo: ni rastro en Guadalajara en abril de 2010** · Guadalajara, Cuenca y Guadarrama
- Especie: marzuelo (*Hygrophorus marzuolus*).
- Consejo: «iGuOk» no lo encontró en Guadalajara; otro usuario lo halló hacia **1.600 m en cara norte, en mezcla de roble y pino**, en Guadarrama. El administrador aconsejó estudiar vegetación y suelo antes de salir. Ese año la temporada se retrasó.
- Fecha: 08 al 28/04/2010. 31 respuestas, unos 5 usuarios (iGuOk, Alfonso, biwisin, Angelopin, Capuchino).
- URL: https://www.foromicologico.es/index.php?topic=2039.0
- Marcas: [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE]. Es un resultado negativo: no prueba que no haya marzuelo en Guadalajara.

### Soria

**S1. Mapa potencial de *Hygrophorus marzuolus* en Soria** · Soria, hayedos
- Consejo: «antuan» elaboró (02/02/2013) un mapa teórico según vegetación, altitud y geología, sin marcar pueblos para evitar la masificación. **Hubo debate**: tres usuarios criticaron que un mapa atrae gente; el autor respondió que la escala no permite ubicar sitios y que «la realidad no coincide siempre con la teoría». El marzuelo de Soria se asocia con hayedos (Urbión, Cebollera, Tierras Altas).
- 13 respuestas, **5 usuarios** (antuan, marta, javivi, SrHongo, jfbrmtx22).
- URL: https://www.foromicologico.es/index.php?topic=20168.0
- Marcas: [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE].
- Norma: los hayedos de Urbión están dentro del Parque Micológico Montes de Soria (permiso; `normativa.json`).

**S2. Sarnago, Puerto de Piqueras y Alto del Ayedo** · Tierras Altas de Soria (San Pedro Manrique, Santa Cruz de Yanguas, Taniñe)
- Especies: rúsulas y níscalos (Piqueras), colmenillas en primavera y setas de pastizal (Sarnago).
- Consejo: tres rutas locales de un artículo de turismo.
  - Puerto de Piqueras (Santa Cruz de Yanguas): pista forestal que sube, pinar albar, hayedos, praderas y bosque de ribera; itinerario micológico señalizado.
  - Taniñe: pino laricio abajo, albar con roble en medio y albar arriba; Alto del Ayedo y ermita de San Fructuoso.
  - Sarnago: pastizales y repoblaciones de pino albar; pista sin asfaltar a 1,5 km de San Pedro Manrique, por la SO-630 hacia Magaña.
  - **Nuevos respecto a `sitios.json`**: Sarnago, Puerto de Piqueras y Alto del Ayedo.
- Fecha: 23/09/2021 (Alberto Abad).
- URL: https://www.sorianitelaimaginas.com/blog/tiempo-de-micologia-tres-senderos-donde-coger-setas-en-tierras-altas/
- Marcas: [UNA SOLA FUENTE] [NO FORO] (turismo).
- Norma: Tierras Altas queda dentro o a menos de 2 km de PMSO-50001 y SO-50003 (`01-normativa-cotos.md`, apartado 5): **permiso de Montes de Soria o de la Junta**. Comprueba el mapa de zonas reguladas 2025.

**S3. Níscalo de noviembre en los pinares de llanura de Soria** · pinares de llanura de Soria (también Segovia y Valladolid)
- Consejo: el parte de Micocyl del 29/11/2018 decía que los pinares de llanura de Segovia, Soria y Valladolid seguían con níscalo «abundante o muy abundante», que el boletus había terminado y que la seta de cardo daba mucho en yermos. Sirve para el **final de temporada**: en noviembre, baja a los pinares de llanura.
- URL: http://micocyl.es/noticias/consulta-aqui-el-ultimo-parte-micologico-de-micocyl
- Marcas: [UNA SOLA FUENTE] (un solo parte, de 2018). No localicé el parte de esta semana: `/partes-micologicos` da 404.
- Norma: si el pinar está en acotado o parque micológico, permiso (Decreto 31/2017).

**S4. Garrapatas en Soria y La Rioja** · Soria
- Consejo: aviso del 17/09/2018 de «marta»: hay garrapatas activas en zonas de Soria y La Rioja. Protégete bien y **no dejes entrar a los perros en hierba y brezo**.
- URL: https://www.foromicologico.es/index.php?topic=31530.0
- Marcas: [UNA SOLA FUENTE]. Hilo sin respuestas.

**S5. Montes privados de ASFOSO: no pasar** · Soria
- Consejo: en mayo de 2014 los propietarios privados de ASFOSO (Asociación Forestal de Soria) fijaron normas propias. Cada dueño decidía: solo familia, solo vecinos o a su criterio, y en general **los de fuera no podían recoger**. Conviene saber qué monte es regulado antes de entrar.
- Fecha: 31/05/2014. 7 respuestas, **5 usuarios** (marta, Loreto, Félix, jebaspe, lusan).
- URL: https://www.foromicologico.es/index.php?topic=24850.0
- Marcas: [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE] [NO VERIFICADO] (hoy).
- **NO IR** a montes privados de asociaciones forestales sin su permiso. Quinto de la Mata ya figura como privado en `sitios.json`.

**S6. Humedad y altitud en un hilo antiguo de Soria** · Comarca de Pinares (Soria)
- Consejo: en un hilo de octubre de 2010 («Boletus, níscalos, setas», unos 15 usuarios) se aconseja, **cuando hace seco, mirar en barrancos y zonas que retienen humedad**; se insiste en que sin lluvia no hay nada; se dice que **a 1.200 m o más** en pinar sale el boletus; y se recomienda ir con alguien que sepa identificar.
- Fecha: 04/10/2010. 25 mensajes.
- URL: https://www.webcampista.com/foro/threads/boletus-niscalos-setas.42214/
- Marcas: [MENSAJE ANTIGUO >10 años] [UNA SOLA FUENTE]. Resumen automático; el recuento de usuarios es aproximado.

### Consejos generales de campo de blogs [NO FORO]

**B1. Boletus: solana, bordes y pendiente suave** · válido para Pinar Grande y otros pinares
- Consejo: el boletus es «heliófilo». Busca **solanas, bordes del bosque y terreno llano o de pendiente suave (5 a 10 %)**, que retiene la humedad; en pendiente del 30 % el agua se escurre. Los pinares **limpios de matorral** dan más. Un pinar joven de silvestre da níscalos; al envejecer pasa a dar boletus.
- Fecha: 14/10/2019 (2 comentarios sin datos). URL: https://www.cotosdesetas.es/2019/10/claves-encontrar-boletus.html
- Marcas: [UNA SOLA FUENTE] [NO FORO].

**B2. Boletus a los 10 o 14 días de una lluvia fuerte** · Sierra Norte de Guadalajara («Pueblos Negros»)
- Consejo: el boletus aparece unos 10 a 14 días después de una lluvia abundante; los níscalos, de octubre a enero. Recoge girando la seta 360° por el pie. Cita los Pueblos Negros (Valverde de los Arroyos, Campillejo, Roblelacasa, Majaelrayo, Zarzuela de Galve, Campillo de Ranas) y Cogolludo.
- URL: https://todosloshechos.es/donde-coger-setas-por-guadalajara
- Marcas: [UNA SOLA FUENTE] [NO FORO] [NO VERIFICADO] (sin autor ni fecha clara). El foro solo habla de «lluvia», sin días.

## 2. Normativa y cruce con el repo

| Zona | Lo que dicen los hilos | Lo que dice el repo | Acción |
|---|---|---|---|
| Pinar Grande, Covaleda, Duruelo, Vinuesa | En 2013, «Coto Vinuesa»: 20 € por 2 días y 5 kg para foráneos | Acotado SO-50001 de Covaleda (Pinares de Urbión) y PMSO-50001 Montes de Soria; **precios sin fecha y en dos tablas distintas** (`01-normativa-cotos.md`) | Permiso. Llamar al 975 37 00 00 antes de ir |
| Navaleno, San Leonardo | En 2011 «no se han adherido todavía» | Hoy en Montes de Soria | Permiso. El hilo está superado |
| Tierras Altas, Moncayo, Cabrejas del Pinar | Sin hilos | Tierras Altas dentro o a menos de 2 km de PMSO-50001 y SO-50003 | Permiso |
| Montes privados ASFOSO, Quinto de la Mata | Solo vecinos y familia | `quinto-de-la-mata` = privado | **NO IR** |
| Orea, Checa, Peralejos | Dudas sobre carteles (2016) | Mancomunidad La Sierra: 5 €/día y 5 kg; Orea sin aclarar | Permiso; confirmar Orea |
| Tejera Negra | Prohibido dentro del parque (2010) | PRUG sin localizar | **NO IR** dentro del parque hasta confirmar |
| Serranía de Cuenca | Sin cifras en los hilos | Ordenanza leída solo en Tragacete, La Huérguina y Boniches | Permiso si hay ordenanza; fuera, 5 kg o 10 L |
| Montes de Toledo | Sin hilos | Sin ordenanzas halladas; predomina la finca privada | **NO IR** a fincas y cotos de caza sin permiso del dueño |

El cupo, el permiso y el horario los manda el repo, no los foros.

## 3. Coincidencias entre fuentes

| Consejo | Fuentes que coinciden |
|---|---|
| En año seco, busca arroyos, regatos y barrancos | 2 hilos (Madrid 2009, Soria 2010) |
| Sin lluvia no hay setas; el retraso de temporada es normal | 3 hilos (Cuenca 2010, Alto Tajo 2012, marzuelo 2010) |
| Comprueba el permiso; no te fíes del cartel | 2 hilos (Orea 2016, ASFOSO 2014) |
| Comprueba el sustrato (calizo contra rodeno) | 1 hilo (Cuenca 2010) |

Ningún otro consejo de campo tiene dos fuentes independientes.

## 4. Huecos y siguientes pasos

- Reddit y los grupos de Facebook («Setas y hongos en España», «Setas y Hongos de Soria») existen, pero no fueron accesibles.
- Micocyl: localizar el PDF del parte micológico de esta semana (`blog.micocyl.es/sites/default/files/editor/parte_mico_AAAAMMDD.pdf`).
- Hilos de Foro Micológico vistos solo por título: «Decomisan 556 kilos de setas en montes de San Pedro Manrique» (topic=26002), «Desalojadas dos acampadas ilegales de recolectores de setas en Soria» (topic=23055, útil para aparcamiento y acampada), «Decreto micológico de Castilla y León» (topic=31162) e «Info castilla y león» (topic=25196).
- Montes de Toledo: probablemente solo hay información en Facebook o en foros de caza. Pendiente.

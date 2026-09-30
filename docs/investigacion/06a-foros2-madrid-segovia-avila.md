# 06a. Segunda pasada por foros y comunidades: Guadarrama (Madrid y Segovia), Sierra Norte/Ayllón, Gredos y Tiétar

Fecha: 30/09/2026. Solo lectura sobre `data/` y `docs/`. Sin commit. Complementa 04a, 04e y 05a; no repite lo que ya está en ellos ni en `data/sitios.json` (61 sitios).

## 0. Resumen honesto (leer primero)

**Los foros siguen rindiendo poco.** WebSearch funciona, pero casi todo lo que devuelve son páginas de turismo (Terranostrum, Escapada Rural, Trendencias), no conversaciones de foristas. Unas 45 búsquedas y 55 lecturas después:

- **Reddit:** ni una sola página de r/Setas ni r/spain aparece en el buscador para estas zonas. Cero datos. No lo invento.
- **Foro Micológico** (foromicologico.es): el tablón de Zona Centro da «el foro no existe» sin sesión; solo abre hilos sueltos. Releído el hilo 1020 (2009), ya citado en 05a; saco 3 datos nuevos.
- **Fungipedia:** el hilo «Parte micológico en Madrid» solo tiene 4 mensajes útiles (ya en 05a). El buscador interno devuelve solo hilos de identificación.
- **Forocoches** (hilo `t=3422306`): releídas ahora las páginas 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13 y 14 (2013-2015), que 05a no había leído. Salen 6 menciones útiles. En las demás no hay una sola de estas zonas. Nota: la lectura la hace un resumidor automático, así que puede haberse dejado algún mensaje.
- **Blogs personales, crónicas de la Sociedad Micológica de Madrid, AMC Madrid, Sociedad Micológica Segoviana, Asociación Micológica de Ávila, El Norte de Castilla, El Adelantado, Diario de Ávila, El Faro del Guadarrama, sierramadrid, YouTube:** el buscador no devuelve ninguna crónica de salida con sitio. Lo único que aparece es la asociación **Amagredos** (Gredos) con jornadas en Las Navas del Marqués y Hoyos del Espino (ver 2.3). No he encontrado nada de la Asociación Micológica de Ávila como tal.
- **Sierra Norte (La Hiruela, Montejo fuera del Hayedo, Puebla de la Sierra, Horcajuelo, Prádena del Rincón, Robregordo, Braojos, Gascones):** **ningún mensaje, blog ni noticia de setas para estos pueblos.** Solo turismo general. Un único dato científico para Somosierra (2.2). No propongo sitios inventados.
- **Cercedilla y Navacerrada:** ningún forista los recomienda. Solo listados turísticos (La Barranca, Fuenfría). Siguen siendo **NO IR** (`pn-monte-sin-plan`).
- Para compensar, he ido a **fuentes oficiales y científicas** con sitios con nombre (catálogo micológico del Pinar de Hoyocasero, partes de Micocyl, Comunidad de Madrid, folleto de Valsaín, rutas del Desarrollo Turístico Gredos-Iruelas). Las marco como lo que son: **no son foristas**.

**Etiquetas:** [UNA SOLA FUENTE], [ANTIGUO >10 años] (mensaje anterior al 30/09/2016), [NO VERIFICADO], [CREENCIA POPULAR]. Ningún hallazgo trae coordenadas de la fuente; `cotos.geojson` no se puede cruzar espacialmente con ellos. El cruce legal es por nombre de municipio/monte.

**Cruce con `cotos.geojson`:** los únicos polígonos que tocan estos sitios por nombre son `SG-50011 El Espinar` (acotado), `AV-50001 El Tiemblo` (acotado), los `pnsg-ura-*` (prohibido) y `montejo-hayedo` (prohibido). No hay polígono para Gredos (AV-50003 no aparece en el WFS según la ficha), ni para Hoyocasero, Navaluenga, Bohoyo, Solana de Ávila, El Barraco ni Las Navas. En esos casos el régimen queda [NO VERIFICADO] y hay que consultar https://permisos.micologiacyl.es o llamar a Micocyl (975 23 96 70).

## 1. Hallazgos de foros (foristas)

### F1. Vertiente segoviana: «nueva tasa» y mudanza a Madrid (2013)
- Sitio: lado segoviano de Guadarrama (Montes de Segovia). Sin municipio.
- Consejo: el 3/10/2013 el forista KrisSenshi dice que **evita la parte de Segovia por la tasa nueva** y buscará en Madrid. Es una prueba independiente de que el permiso de Segovia existe desde la temporada 2013 (en 05a solo había el de Valsaín en 2016).
- Fecha: 3/10/2013, mensaje #15. 1 usuario.
- URL: https://forocoches.com/foro/showthread.php?t=3422306&page=1
- [UNA SOLA FUENTE] [ANTIGUO >10 años]
- Norma: hoy `cyl-montes-de-segovia` (SG-50002), **requiere permiso** (5 €/día foráneo, 5 kg).

### F2. Rascafría: «una semana de lluvias» (4/10/2013)
- Sitio: Rascafría (Madrid). Especie: no la dice.
- Consejo: el forista malkuth escribe el 4/10/2013, tras una semana de lluvia en Madrid, que si a la siguiente hace buen tiempo «el campo va a estar» muy bien. Es el patrón lluvia seguida de tiempo templado (ya en 05a H18), aplicado a Rascafría en la primera semana de octubre.
- Fecha: 4/10/2013, mensaje #44. 1 usuario.
- URL: https://forocoches.com/foro/showthread.php?t=3422306&page=2
- [UNA SOLA FUENTE] [ANTIGUO >10 años]
- Norma: **requiere licencia** de Rascafría (`madrid-rascafria`), solo MUP autorizados; Reserva NO IR. En 2013 aún no existía la ordenanza (2020).

### F3. Tejera Negra y carretera de Cantalojas: unos 30 coches de seteros (20/10/2013)
- Sitio: Hayedo de Tejera Negra y carretera de Cantalojas (Guadalajara, ladera sur de Ayllón). Ya está en `sitios.json` (`hayedo-tejera-negra`), pero sin este dato.
- Consejo: el forista pilgrim vio **unos 30 coches de recolectores** un fin de semana de octubre (20/10/2013). Indica saturación y entrada desde Madrid por la A-1.
- Mensaje #95. 1 usuario. URL: https://forocoches.com/foro/showthread.php?t=3422306&page=4
- [UNA SOLA FUENTE] [ANTIGUO >10 años]
- Norma: fuera de mi ámbito; ver `04b` y `clm-orden-2016-11-15`. El Hayedo de Tejera Negra es parque natural: [NO VERIFICADO] si se puede recoger.

### F4. «Sierra de Guadarrama»: boletus, níscalos y macrolepiotas, final de septiembre (2015)
- Sitio: Sierra de Guadarrama (sin municipio). Especies: *Boletus edulis*, níscalo, *Macrolepiota procera*.
- Consejo: mostro d luffy, 27/9/2015 (#332): salida a la sierra con esas tres especies y aviso de esperar lluvia para mejor resultado. El 18 y 19/10/2015 (#396, #406) escribe que «esta semana va a ser cojonuda, ha llovido mucho» para Madrid.
- URLs: https://forocoches.com/foro/showthread.php?t=3422306&page=12 y `&page=14`. 1 usuario.
- [UNA SOLA FUENTE] [ANTIGUO >10 años] [NO VERIFICADO el sitio]
- Útil solo como fecha: boletus ya el 27/9 en la sierra en un septiembre lluvioso, y segunda oleada tras la lluvia del 18/10/2015. Contrasta con 05a H11 (22/10/2016, níscalos aún pocos).

### F5. Sequía de octubre de 2015 y «norte de Madrid» (2015)
- Sitio: norte de Madrid (sin pueblo).
- Consejo: SWEET_WHITAKER (7/10/2015, #366): «este año en Madrid poquito» por la sequía. Khaliom (7/10/2015, #367) duda entre «el norte de Madrid» y «irse más lejos». Es coherente con Pagafantas III en 05a H5.
- URL: https://forocoches.com/foro/showthread.php?t=3422306&page=13. 2 usuarios.
- [ANTIGUO >10 años]

### F6. «Níscalos en agosto en Madrid» (2014)
- Un usuario (dha, 3/11/2014, #266) menciona que comió **níscalos con ajito en agosto en Madrid**. No dice dónde ni si los cogió él. Por la fecha (verano) es muy improbable en Guadarrama: [NO VERIFICADO] [CREENCIA POPULAR] [UNA SOLA FUENTE]. No lo uso como época.
- URL: https://forocoches.com/foro/showthread.php?t=3422306&page=9 [ANTIGUO >10 años]

### F7. Foro Micológico 2009: «Fuente del Cura» y la capuchina
- Sitio: zona «Fuente del Cura», sierra de Madrid (el forista jfbrmtx22; no da municipio). 13/12/2009: cuatro horas de búsqueda con el campo «extremadamente seco», solo 4 amanitas.
- Capuchino (moderador), 15/11/2009: Sierra de Guadarrama muy seca: *T. equestre*, *Lactarius rufus*, boletus agusanados. Y el 15/12/2009 pone foto de 2007 con abundante *Tricholoma portentosum* y níscalos de la sierra de Madrid (fotos de otra temporada).
- URL: https://www.foromicologico.es/index.php?topic=1020.0
- [UNA SOLA FUENTE cada dato] [ANTIGUO >10 años] [NO VERIFICADO Fuente del Cura: no he podido situarlo]. Patrón en año seco: diciembre ya es tarde para amanitas; la capuchina aguanta el frío (05a H20).

### F8. Lo que NO dicen los foristas (resultado negativo)
- Cercedilla, Navacerrada, Valsaín (trucos), Navafría, Hoyocasero, Navarredonda, El Espinar, Riaza, Riofrío, Candeleda, Arenas, Guisando, El Hornillo, Piedralaves, Casavieja y toda la Sierra Norte: **cero mensajes de foros en las páginas y hilos leídos.**
- Un mensaje de WebCampista (24/10/2014, «picapinos») propone rutas otoñales en La Hiruela (molinos del Jarama), Canencia, Pontón de la Oliva y Hayedo de la Pedrosa, pero **son paseos de paisaje, sin setas**: https://www.webcampista.com/foro/threads/campo-base.18950/post-2770813. No lo cuento como hallazgo.

## 2. Hallazgos de fuentes oficiales, científicas y locales (no foristas)

### 2.1 Segovia

**S1. El Negredo (Segovia), níscalos, 7/10/2023**
- Especie: níscalo. Consejo: el Seprona interceptó a **cinco personas sin permiso** que volvían al coche con **24 kg de níscalos** dentro del acotado SG-50002. Indica níscalo ya abundante a primeros de octubre en esa zona y vigilancia activa en los accesos.
- URL: https://www.agronewscastillayleon.com/la-guardia-civil-interviene-24-kilogramos-de-niscalos-en-recoleccion-ilegal-de-setas-en-segovia
- 1 fuente (noticia). No doy coordenadas ni paraje exacto: [NO VERIFICADO] el punto.
- Norma: **requiere permiso** SG-50002 (`cyl-montes-de-segovia`); sin permiso, decomiso y denuncia (Decreto 31/2017).

**S2. Sierra de Ayllón–Riaza: zona citada por Micocyl para *B. edulis* (29/11/2018)**
- Micocyl (parte del 29/11/2018): con poca producción en Castilla y León, las zonas con más probabilidad de boletus eran «la Sierra de Ayllón–Riaza en Segovia» (en robledal de *Quercus pyrenaica* y castaño), Soria-Burgos y Salamanca, **con menos de ½ kg/hora**. El níscalo ya abundaba en los pinares llanos del oeste y noroeste de Segovia (más de 3 kg/hora).
- URL: https://www.micocyl.es/sites/default/files/editor/parte_mico_291118_.pdf · 1 fuente oficial. Complementa `riaza-ayllon` (sin consejo de época).
- Norma: SG-50002, **requiere permiso**.

**S3. Valsaín: normas del folleto oficial 2017 (trucos prácticos que no estaban)**
- Folleto OAPN (2017) de los montes «Matas» y «Pinar de Valsaín» (Real Sitio de San Ildefonso). Datos útiles para recolectar: **acceso solo a pie**; **prohibidas hoces, rastrillos y azadas**; níscalos, setas de cardo, llanegas, negrillas y capuchinas **se cortan a ras de suelo**, el resto se extrae entero y se rellena el hueco; tamaño mínimo **4 cm en boletus, 2 cm en el resto**; cesáreas abiertas; no recoger de noche ni donde haya cortas de madera; **umbría de Siete Picos excluida** (entre el Camino Schmid, el arroyo del Telégrafo y la cresta); permisos por la Central de Reservas de Parques Nacionales; Centro de Visitantes Boca del Asno, CL-601 km 14,3, tel. 921 12 00 13.
- Precios del folleto de 2017 (foráneo 1 día 10 €, 2 días 15 €; provincial 15 €; local 3 €): **pueden haber cambiado**; comprobar en `valsain-orden-aaa-1681-2016` del repo.
- URL: https://www.miteco.gob.es/content/dam/miteco/es/parques-nacionales-oapn/centros-fincas/valsain/setas-2017_tcm30-432288.pdf (texto leído del PDF descargado).
- Sobre Valsaín, **no hay trucos de foristas**: los dos foros solo confirman la regulación (05a H4).

**S4. Navafría y El Espinar (resultado)**
- Terranostrum repite lo de siempre (Pinar de Navafría 2.687 ha, Comunidad de Pedraza). Un cartel de una marcha BTT (18/7/2026) da datos físicos útiles para orientarse: el pinar va desde **1.200 m hasta por encima de 1.800 m**, con el río Cega y sus arroyos naciendo en él, y la **fuente de la Teja (caño Ortiz)** en el km 4 desde el pueblo; el Puerto de Navafría está a 1.773 m. **Sin setas.** URL: https://montanapegaso.es/carteles/2026/Navafria2026_info.pdf
- Consejo derivado (mío, no de la fuente): el rango 1.200-1.800 m de la misma masa encaja con el patrón de 05a H2 (boletus a 1.400-1.800 m en octubre, bajar con el frío). [NO VERIFICADO]
- Norma: SG-50002 (**permiso**). El Espinar: `SG-50011` en el geojson; no sé cuál rige (04a).

### 2.2 Madrid (Guadarrama y Sierra Norte)

**S5. Dehesa de Somosierra (Madrid): el único dato de setas de la Sierra Norte**
- Estudio micológico de la UCM: expediciones de **abril de 2013 a octubre de 2015** en la Dehesa de Somosierra, a unos **1.450 m**, suelos ácidos, 588 mm de lluvia y 8,6 °C de media, con **abedul, avellano y roble albar**. 96 especies, entre ellas comestibles: *Boletus edulis*, *Cantharellus cibarius*, *Leccinum variicolor* y *Lactarius*. No da fechas de cada hallazgo ni parajes.
- URL: https://docta.ucm.es/bitstreams/79f3c654-02f8-4840-bab8-22ef074b92f1/download · 1 fuente científica.
- Norma: Somosierra (Madrid) sin ordenanza localizada [NO VERIFICADO]; regla general de Madrid (monte público señalizado o permiso del propietario). Puede ser Hayedo/dehesa con restricciones propias: **confirmar con el Ayuntamiento antes de ir**.
- Nota: es un estudio científico; el muestreo no equivale a «se puede recoger».

**S6. Rascafría: los 7 montes municipales con nombre (2020)**
- Nota de la Comunidad de Madrid (21/11/2020) sobre la autorización de 7.286,7 ha: además de los MUP **Morcuera (2.222,7 ha), El Pinganillo (1.160 ha) y Las Calderuelas (1.697 ha)** ya recogidos, nombra siete montes municipales: **Dehesa Boyal y Arroturas; Ladera y Dehesa Boyal; Tercio de Santa Ana; Cantero de la Compuerta; Los Robledos; Soto de Arriba; Tras las Suertes**. No da especies.
- URL: https://www.comunidad.madrid/node/58396 · 1 fuente oficial. Sirve para saber **dónde sí vale** la licencia de Rascafría.
- Norma: **requiere licencia** de Rascafría (`madrid-rascafria`); Reserva y URA-A fuera (NO IR).

**S7. La Barranca (Navacerrada)**
- Listados turísticos (Trendencias 27/10/2025; salir.com sin fecha) la citan como sitio de amanitas, rusulas, lepiotas, níscalos, boletus y cantarelos, en pinar y robledal. **Ningún forista la cita.**
- URLs: https://www.trendencias.com/viajes/mejores-sitios-para-coger-setas-madrid-este-otono-lugares-favoritos-sierra-guadarrama-valle-lozoya y https://www.salir.com/sitios-para-recoger-setas-en-madrid-396.html?print=1
- **NO IR**: Navacerrada es PN sin ordenanza ni plan (`pn-monte-sin-plan`); PRUG art. 59.b. El artículo anima a recoger en un sitio donde hoy no se puede: **no fiarse de listados de turismo**. Lo mismo para Puerto de la Fuenfría (Cercedilla) y Puerto de Cotos.

**S8. Habitats y época en la Sierra de Guadarrama (estudio ADESGAM, UCM; sin fecha)**
- Documento del potencial micológico de la sierra. Datos útiles (resumen mío): pino silvestre da *B. edulis*, *B. pinophilus* y níscalo (este en pinar algo más joven); **melojares** dan *B. aereus*, *B. aestivalis*, *B. erythropus* y rebozuelo **desde primavera hasta la caída de la hoja**; los **abedulares** solo en fondos húmedos y umbrías de mucha altitud; el **castañar** es escaso y está **en el valle del Lozoya y puntualmente en El Escorial** (*B. pinophilus*, *B. aestivalis*, *B. regius*, rebozuelo); encinar en cotas bajas (*B. aereus*, pie azul, trufa); prados con seta de cardo y senderuela.
- URL: https://www.ucm.es/data/cont/media/www/pag-92361/ADESGAM-Potencial%20Micol%C3%B3gico.pdf · 1 fuente. Útil como regla de habitat (también para Sierra Norte, donde predominan rebollares).

### 2.3 Gredos, Alberche y Tiétar (Ávila)

**S9. Pinar de Hoyocasero (Ávila): catálogo de 1998 y quedada de 2014**
- Sitio: Pinar de Hoyocasero, **Monte de Utilidad Pública n.º 43, 370 ha, 1.250-1.415 m**, pino silvestre de repoblación (más de 500 años según el estudio) con melojar joven; 900-1.000 m estimados de lluvia; heladas seguras 7-8 meses al año y solo 2-2,5 meses libres de helada. Paisaje Protegido.
- Fechas de hallazgo en 1998 (año muy seco, 200 mm menos que la media): **níscalo 11/11/1998**; *T. equestre* 13/10/1998; parasol 20/10/1998; pie azul 11/11/1998; *Sparassis crispa* 3/11/1998; rebozuelo 2/7/1998; *Boletus reticulatus* 11/6/1998; *Suillus luteus* 21/5/1998; senderuela 20/5/1998. No cita *B. edulis* ni cesárea.
- Consejo: a esta altitud la temporada del níscalo llega a noviembre y las heladas la cortan pronto. En 1998 no salió boletus otoñal en un año seco. La quedada de bloggers del 18-19/10/2014 (#TuitQuedadaMicológica) fue «en busca de hongos, níscalos y otras setas otoñales» (avilared.com) y pedía el permiso.
- URLs: https://revistas.usal.es/index.php/0211-9714/article/download/6087/6107/0 (Stud. bot. 19, 2000) y https://avilared.com/art/11815/micologia-gastronomia-y-redes-sociales-en-gredos
- 2 fuentes independientes (un estudio botánico y una noticia). [ANTIGUO >10 años] para los hallazgos de 1998.
- Norma: [NO VERIFICADO] el coto. Hoyocasero está junto a Hoyos del Espino (AV-50003 «Gredos»); la noticia de 2014 dice «debe contarse con el permiso preceptivo». **Tratar como permiso de Micocyl** hasta confirmar en micologiacyl.es.

**S10. Navaluenga: La Lobera (valle del Alberche)**
- Ruta micológica de 4,7 km, +242 m, inicio en La Lobera. Robledal con castaños, nogales, pino silvestre y pino resinero. Especies: *B. edulis*, *B. regius*, *B. pinophilus*, *B. reticulatus*, níscalo, rebozuelo (*C. subpruinosus*), parasol, *Agaricus*; también la mortal *A. phalloides*. Otoño y primavera.
- URL: https://www.terranostrum.es/senderismo/ruta-micologica-navaluenga · 1 fuente (Desarrollo Turístico Gredos-Iruelas). No es forista.
- Norma: [NO VERIFICADO] (AV-50001 es El Tiemblo, otro acotado; no sé si Navaluenga tiene el suyo).

**S11. Solana de Ávila: paraje Hoya Rana (ladera norte de Gredos, junto al Aravalle)**
- Ruta de 4,1 km, +95 m. Pino silvestre y resinero, roble y castaño. Especies: *B. pinophilus*, *B. aereus*, níscalo (*L. deliciosus* y *L. semisanguifluus*), *A. phalloides*, parasol, senderuela, *Agaricus*. Otoño.
- URL: https://www.terranostrum.es/senderismo/ruta-micologica-solana-de-avila · 1 fuente.
- Norma: [NO VERIFICADO]. Cerca de AV-50003 pero no consta que esté dentro.

**S12. Bohoyo**
- Ruta circular de 2,9 km, +177 m. Pino silvestre con roble y matorral. Níscalos, *B. edulis*, *B. pinophilus*, *Agaricus campestris* en claros, parasol. Otoño.
- URL: https://www.terranostrum.es/senderismo/ruta-micologica-bohoyo · 1 fuente. Norma [NO VERIFICADO].

**S13. El Barraco (solana, pinar con enebro y jara)**
- Ruta de 3,2 km, +126 m, en ladera sur «bastante térmica y protegida». Seta de cardo, níscalo, senderuela, *Sparassis crispa*, *Boletus*. Terranostrum la presenta como apta casi todo el año.
- URL: https://www.terranostrum.es/senderismo/ruta-micologica-el-barraco · 1 fuente. Norma [NO VERIFICADO].

**S14. Las Navas del Marqués (montes de Las Navas) y Hoyos del Espino: jornadas de Amagredos**
- XVIII Jornadas Micológicas de Las Navas del Marqués, 30/10 a 1/11/2021: la salida de campo del sábado 30/10 en los montes de Las Navas registró **152 especies** con más de 120 participantes (Amagredos, Sociedad Micológica de Gredos). URL: https://avilared.com/archive/58135/una-especia-de-la-zona-cantabrica-recolectada-en-las-jornadas-micologicas-de-las-navas
- Hoyos del Espino: ruta guiada «Busca Setas» del 1/11/2021 (24 personas, guía Juan Francisco Redondo; https://avilared.com/archive/58094/la-jornada-micologica-de-hoyos-del-espino-reune-a-mas-de-un-centenar-de-participantes) y curso básico de Amagredos del 22-23/10/2022 (https://www.micocyl.es/sites/default/files/noticias_docs/curso_amagredos_2022.pdf). La ruta guiada de la Casa del Parque sale los fines de semana a finales de septiembre y hasta principios de diciembre, a las 10:30, 3,5 h, máximo 15 personas (https://guias-viajar.com/turismo-espana/visitar-castilla-y-leon/avila-gredos-rutas-micologicas/).
- No dan sitio ni especies de consumo. Sirve como **contacto para salir acompañado**. Norma: Las Navas [NO VERIFICADO]; Hoyos del Espino = AV-50003.

**S15. Micocyl, primavera de 2025: Alberche y Tiétar**
- Parte del 10/4/2025: marzo muy lluvioso; en Ávila producción escasa, con **colmenillas en el Valle del Alberche y el Valle del Tiétar** tras las lluvias y **marzuelo puntual en pinares húmedos de Gredos**; senderuela en praderas húmedas; *B. pinophilus* en inicio. El marzuelo cae con la subida de temperaturas.
- URL: https://www.micocyl.es/sites/default/files/editor/parte_mico_20250411.pdf · 1 fuente oficial. Complementa 05a H16.

### 2.4 Lo que sigue sin fuente (Gredos sur y Sierra Norte)
- **Piedralaves, Casavieja, Mombeltrán, Lanzahíta, Pedro Bernardo:** nada de setas. Solo hay las cinco rutas de 04a (Arenas, Candeleda, Guisando, El Hornillo, El Arenal). Mombeltrán y el norte del Tiétar quedan cerca de AV-50003, sin confirmar.
- **Rozas de Puerto Real, Cenicientos, Cadalso:** solo hay que hay castañar (el mayor de Madrid en Rozas de Puerto Real, estudio sobre el valle del Tiétar madrileño); ninguna fuente de setas ni de régimen. [NO VERIFICADO]
- **Sierra Norte (La Hiruela, Montejo, Puebla, Horcajuelo, Prádena, Robregordo, Braojos, Gascones):** sin fuente. La única pista es indirecta: Horcajuelo a 1.144 m de media y «extensos pinares y robledales» (turismo), y la clave de habitat de S8 (melojar = *B. aereus*/*aestivalis*/rebozuelo). **No lo convierto en sitio.**

## 3. Trucos por época y altitud (de lo leído)

| Truco | Fuente | Fuentes |
|---|---|---|
| A finales de octubre de 2024 bajaron las especies termófilas (*B. edulis*, *B. aereus*, cesárea) y dominó el níscalo; empezaron las tardías (*Hydnum repandum*, *Clitocybe nebularis*, angula, capuchina). **El orden es: termófilas, níscalo, tardías.** | Micocyl 28/10/2024: https://micocyl.es/sites/default/files/editor/parte_mico_20241028.pdf | 1 (oficial) |
| Con esa misma fecha, el boletus en el Guadarrama segoviano daba más de 3 kg/h y el níscalo hasta 4 kg/h. | Micocyl 28/10/2024 | 1 |
| A 20/11/2024 el descenso de níscalo y boletus fue «especialmente en zonas de mayor altitud y en pino albar»; en **llanuras de pino piñonero y negral** siguió bueno el níscalo. **Bajar de cota y de pino silvestre a pino resinero cuando llega el frío.** | Micocyl 20/11/2024: https://micocyl.es/sites/default/files/editor/parte_mico_20241121.pdf | 1 |
| Ávila 28/10/2024: las lluvias llegaron bien entrado octubre; condiciones ideales con 12-20 °C de día y más de 5 °C de noche. Ávila 20/11/2024: mejores zonas las de más retención de humedad (pinares, robledales, junto a cursos de agua). | Micocyl 28/10 y 20/11/2024 | 1 |
| Altitud del pinar de Hoyocasero (1.250-1.415 m): níscalo hasta mediados de noviembre; heladas seguras 7-8 meses al año. | Estudio USAL (S9) | 1 [ANTIGUO] |
| Melojar (robledal de rebollo): *B. aereus*/*aestivalis*/rebozuelo desde primavera; pinar de silvestre: *B. edulis* y níscalo. Abedul solo en fondos húmedos de mucha altitud. | ADESGAM (S8) | 1 |
| En año seco solo salen setas en arroyos y barrancos húmedos; diciembre es tarde. | 05a H1, H10, H22 y F7 (2009) | 3 foristas, todos [ANTIGUO] |
| Lluvia repetida y luego tiempo templado: «esta semana va a ser cojonuda, ha llovido mucho» (18/10/2015) y la semana de lluvia previa a un buen fin de semana (4/10/2013). | F2, F4 | 2 foristas [ANTIGUO] |
| Níscalos en pinares llanos del oeste y noroeste de Segovia más de 3 kg/h a finales de noviembre de 2018; boletus solo en Ayllón–Riaza y con menos de ½ kg/h. | Micocyl 29/11/2018 | 1 |
| Primavera: marzuelo en pinares húmedos de Gredos hasta abril; colmenillas en Alberche y Tiétar; al subir la temperatura cae el marzuelo. | Micocyl 10/4/2025 | 1 |

**Sobre orientación y altitud por zona:** ningún forista ha dado orientación nueva. Lo que hay son los datos de 05a H2 (cara norte a 1.800 m en octubre de 2019, cara oeste a 1.400 m ya pasada) y el rango del pinar de Navafría (S4) y de Hoyocasero (S9).

## 4. Sitios que piden permiso o son NO IR (este documento)

| Sitio | Norma | Estado |
|---|---|---|
| El Negredo (Segovia) | SG-50002 | **Requiere permiso**; hay controles (7/10/2023) |
| Sierra de Ayllón–Riaza (boletus) | SG-50002 | **Requiere permiso** |
| Valsaín: Matas y Pinar | Orden AAA/1681/2016 | **Requiere permiso OAPN**; umbría de Siete Picos excluida |
| Dehesa de Somosierra (Madrid) | sin ordenanza localizada | [NO VERIFICADO]; confirmar con el Ayuntamiento |
| Rascafría: MUP Morcuera, Pinganillo, Calderuelas y 7 montes municipales | `madrid-rascafria`, PRUG | **Requiere licencia**; Reserva NO IR |
| La Barranca (Navacerrada), Fuenfría (Cercedilla), Cotos, Alameda del Valle | `pn-monte-sin-plan`, PRUG art. 59.b | **NO IR** |
| Hoyocasero, Hoyos del Espino | AV-50003 (Hoyos) | **Requiere permiso Micocyl**; en 2026 el portal no mostraba tarifa [NO VERIFICADO] |
| Navaluenga, Solana de Ávila, Bohoyo, El Barraco, Las Navas del Marqués | sin cruce | [NO VERIFICADO]: comprobar en micologiacyl.es. Fuera de acotado: 3 kg/día sin comercializar (Decreto 31/2017, art. 13.5) y permiso de la propiedad |

## 5. Balance

- **Hallazgos nuevos: 22** numerados (F1-F7 de foristas y S1-S15 de fuentes oficiales, científicas y locales) **más 10 trucos de época/altitud** (tabla 3). F8 es un resultado negativo y no cuenta.
  - **Sitios con nombre nuevos respecto a `sitios.json`** (11): El Negredo, Pinar de Hoyocasero (estaba en 04a pero no en el JSON), Navaluenga (La Lobera), Solana de Ávila (Hoya Rana), Bohoyo, El Barraco, Las Navas del Marqués, Dehesa de Somosierra, La Barranca de Navacerrada (NO IR), los 7 montes municipales de Rascafría (contados como uno) y «Fuente del Cura» (sin situar).
  - **Complementos** de sitios existentes: Tejera Negra (F3), Riaza–Ayllón (S2), Valsaín (S3), Hoyos del Espino (S14), Navafría (S4).
- **Con dos o más fuentes independientes:** solo el Pinar de Hoyocasero (estudio y noticia) y el patrón «lluvia y luego tiempo templado» (2 foristas). **El resto es [UNA SOLA FUENTE].**
- **Antiguos (>10 años):** F1 a F7 (2009-2015) y los hallazgos de 1998 de Hoyocasero.
- **Lo que no he conseguido:** nada de Reddit, nada de blogs ni de crónicas de asociaciones con sitio, nada de Sierra Norte (pueblos pedidos), nada de Piedralaves, Casavieja, Horcajuelo, Puebla de la Sierra. Pendiente: navegador real (el buscador no indexa foros) para r/Setas, Facebook de Arenas y Tiétar, los hilos de Forocoches 15-50 con filtro por municipio y el Foro Micológico con sesión.
- **Petición de la usuaria (más sitios concretos):** la vía con más rendimiento ha sido el Desarrollo Turístico Gredos-Iruelas (fichas de rutas con paraje y especies). Si quiere más sitios de Gredos, hay en Terranostrum más rutas micológicas de Ávila aún sin leer (p. ej. Hoyos del Espino ya está; faltan las de otros pueblos del Tormes y del Alberche).

# 07a. Zona nueva: Burgos (Pinares, Demanda, Merindades, Obarenes)

Consulta realizada el 2026-09-30. Todo en palabras propias; sin commit. Complementa a `data/zonas.json`, `data/normativa.json`, `data/sitios.json` y `data/cotos.geojson` (solo lectura).

## 0. Advertencias (leer primero)

1. **Las páginas se leyeron con un resumen automático** (WebFetch) salvo las que bajé con curl y leí yo (fichas de micologiacyl.es, permisos.micologiacyl.es, micologiamerindadesnorte.es, cotosdesetas.es, PDF del BOPBUR, folletos de Micocyl, capas WFS/WMS). Las cifras de las fuentes que pasaron por resumen llevan la marca [RESUMEN AUTOMÁTICO]; conviene abrir el original antes de publicarlas.
2. **Diario de Burgos** está bloqueado para la herramienta de búsqueda (error 400) y **Reddit** no se consultó. De **Forocoches** solo hay un hilo con setas de Burgos (2013) y no da parajes. De **Fungipedia** y **Foro Micológico** hay hilos viejos (2009-2015) con poca información de sitios; Foro Micológico prohíbe dar zonas concretas en público (ver 05c). Los foros aportan precios y regulación histórica, no parajes.
3. **No existe una «Sociedad Micológica Burgalesa» verificable.** Aparecen la **Sociedad Micológica Bureba** (presidente Antonio Blanco Martínez, en una nota de prensa del Ayuntamiento, sin fecha clara) y la **Asociación Micológica Gatuña** (paseo micológico de UBUVerde el 26/11/2023, https://www.ubu.es/node/94550). [UNA SOLA FUENTE cada una]
4. **Los precios de los cotos no llevan año en casi ninguna fuente.** Solo el coto La Engaña lo dice expresamente («Permiso de Temporada 2026»). El resto de tarifas son las que muestra el portal el 30/09/2026 (pie «© 2026»), sin año en la tabla. Las de fuentes viejas van con su fecha y marcadas como antiguas.
5. **El repo ya tiene 8 polígonos BU** en `data/cotos.geojson` (BU-50004, 50011, 50013, 50021, 50026, 50058, 50059, 50067), todos con «Zona regulada BU-xxxxx» sin nombre y con zona `soria` (salvo BU-50021, en `alava`). Este informe da el **nombre oficial** de los 73 acotados de Burgos (ver 2.2) y abre la duda del solape de bbox con `soria` (ver 1).

---

## 1. Encaje con el repo: zona, bbox y solape con `soria`

- `soria` tiene bbox `[-3.2, 41.7, -2.5, 42.15]`, que **ya contiene** Palacios de la Sierra, Quintanar, Canicosa, Vilviestre, Neila, Regumiel y Huerta de Arriba (todos de Burgos). También contiene la estación AEMET `2298 Palacios de la Sierra`, que está en Burgos. Por eso los 8 polígonos BU quedaron asignados a `soria`.
- El corte que usó el repo para Guadarrama/Sierra Norte (bbox sin solape) se puede repetir aquí. Propuesta (a decidir; no la he aplicado):
  - Recortar `soria` a `[-3.04, 41.7, -2.5, 42.15]`. Sus 3 puntos (Pinar Grande lon -2.83, Navaleno -3.03, Cidones -2.68) siguen dentro. Quedaría fuera de Soria el tramo burgalés al oeste de lon -3.04.
  - `burgos-pinares`: `[-3.45, 41.72, -3.0401, 42.13]` (Hontoria, Rabanera, Palacios, Vilviestre, Huerta de Arriba, Barbadillo del Pez). Habitats: pinar-silvestre, melojar, hayedo.
  - `burgos-demanda`: `[-3.6, 42.13, -3.0401, 42.45]` (Pineda, Barbadillo de Herreros, Monterrubio, Valdelaguna, Pradoluengo, Fresneda de la Sierra Tirón, Villasur, Montes de Oca sur). Habitats: melojar, hayedo, pinar-silvestre.
  - `burgos-merindades`: `[-3.95, 42.85, -3.0, 43.2]` (Espinosa, Sotoscueva, Valdeporres, Montija, Mena, Losa). Habitats: hayedo, pinar-silvestre, melojar, quejigar/encinar.
  - Inconveniente: Neila (lon -2.99 a -3.06) y Regumiel (lon -2.98) quedarían en `soria` por bbox aunque sean de Burgos. Es una limitación del esquema de un solo bbox por zona; se puede compensar con `provincias: ["Burgos"]` en los puntos o con una nota.
  - Alternativa más simple: una sola zona `burgos` con bbox `[-3.5, 41.85, -3.1, 43.15]`; solapa con `soria` y hace que el recuento GBIF de ambas se duplique. No la recomiendo.
- `comunidad`: `castilla-y-leon`. `normas`: `cyl-decreto-31-2017`, `estatal-ley-43-2003-montes` y las nuevas de 2.3.

---

## 2. Normativa y acotados

### 2.1 Marco general (ya en el repo)

- **Decreto 31/2017** (`cyl-decreto-31-2017`): terreno regulado = permiso del titular; recreativo hasta 5 kg/persona y día; terreno episódico (ni acotado ni reservado) sin permiso, sin comercializar y hasta 3 kg; prohibido recoger de noche. Sin cambios respecto a lo que ya hay.
- **Cacerías colectivas**: no se puede recoger donde haya aprovechamientos forestales con maquinaria ni en las zonas y horas de cacerías colectivas autorizadas. El art. 10 del Decreto lo dice según la web de cotosdesetas (https://cotosdesetas.es/coto-micologico-demanda-suroeste, consultada 30/09/2026); la Ley 4/2021 de Caza de Castilla y León les da prioridad. Es responsabilidad del recolector consultarlo en el ayuntamiento.
- **Calendario oficial de cacerías colectivas 2026/27 en la Reserva Regional de Caza Sierra de la Demanda** (afecta a BU-50017 Demanda-San Millán y BU-50073 Fresneda; Micocyl, aviso del 30/09/2026): https://www.micocyl.es/sites/default/files/area/docs/calendario_cacerias_colectivas_autorizadas_2026_demanda.pdf . Fechas y cuartel: 17/10 Pradoluengo; 18/10 Tolbaños de Arriba; 24/10 Huerta de Abajo; 7/11 Tolbaños de Abajo; 21/11 Pradoluengo y Huerta de Abajo; 22/11 Valle de Valdelaguna; 28/11 Tolbaños de Arriba; 5/12 Tolbaños de Abajo; 12/12 Pradoluengo; 13/12 Tolbaños de Arriba; 19/12 Huerta de Abajo; 3/01/2027 Valle de Valdelaguna; 9/01 Tolbaños de Arriba; 16/01 Tolbaños de Abajo. Habría que enseñarlo en la app como aviso de la zona.
- Burgos Conecta (18/10/2023) dice que la provincia exige permiso en unas **31.528 ha** de monte regulado [RESUMEN AUTOMÁTICO]: https://www.burgosconecta.es/provincia/monte-burgales-sufre-presion-recolectores-pese-baja-20231017071736-nt.html

### 2.2 Las 73 claves BU (nombre oficial) y cruce con la capa del repo

Fuente de los nombres y titulares: lista de acotados y una ficha por clave en micologiacyl.es (https://micologiacyl.es/areas y https://micologiacyl.es/areas/bu-500NN, leídas con curl el 30/09/2026). La ficha no trae tarifas. «En capa» = la clave está en `_fuentes/datos/cyl_zonas_micologicas_reguladas_EPSG4326_20260930.geojson`. «En cotos» = ya está en `data/cotos.geojson`. La última columna son los municipios de los montes de utilidad pública (capa MUP de IDECyL `montes_cyl_mup_vw`) cuyo punto interior cae dentro del polígono (cruce propio, 30/09/2026).

| Clave | Nombre en el portal | Titular | En capa | En cotos | Municipios (cruce MUP) |
|---|---|---|---|---|---|
| BU-50001 | J.V de Alarcia | Junta Vecinal de Alarcia | sí | no | Rábanos |
| BU-50002 | Alfoz de Santa Gadea | Ayuntamiento de Alfoz de Santa Gadea | sí | no | Alfoz de Santa Gadea |
| BU-50003 | San Zadornil | Ayuntamiento de San Zadornil | sí | no | Jurisdiccion de San Zadornil |
| BU-50004 | Acotado del Consorcio para la gestión del Coto micológico Pinares Sur de Burgos | Consorcio para la gestión del Coto micológico Pinares Sur de Burgos | sí | sí | Arauzo de Miel, La Gallega, Hontoria del Pinar |
| BU-50005 | Villalacre | Junta Vecinal de Villalacre | sí | no |  |
| BU-50006 | Santo Domingo de Silos | Ayuntamiento de Santo Domingo de Silos | sí | no | Santo Domingo de Silos |
| BU-50007 | Merindad de Cuesta Urria | Ayuntamiento de Merindad de Cuesta Urria | sí | no | Merindad de Cuesta-Urria |
| BU-50008 | Merindad de Montija | Ayuntamiento de Merindad de Montija | sí | no | Espinosa de los Monteros, Merindad de Montija, Merindad de Sotoscueva |
| BU-50009 | Caleruega | Ayuntamiento de Caleruega | sí | no | Caleruega |
| BU-50010 | Espinosa de Cervera | Ayuntamiento de Espinosa de Cervera | sí | no | Espinosa de Cervera |
| BU-50011 | Vilviestre del Pinar | Ayuntamiento de Vilviestre del Pinar | sí | sí | Vilviestre del Pinar |
| BU-50012 | J.V de Montejo de Bricia | Junta Vecinal de Montejo de Bricia | sí | no | Alfoz de Bricia, Valle de Valdebezana |
| BU-50013 | Neila | Ayuntamiento de Neila | sí | sí | Neila |
| BU-50014 | Villanueva de Gumiel | Ayuntamiento Villanueva de Gumiel | sí | no | Villanueva de Gumiel |
| BU-50015 | Montes de Oca | Ayuntamiento de Villafranca Montes de Oca y otros | no | no |  |
| BU-50016 | Villasur de Herreros | Ayuntamiento de Villasur de Herreros | sí | no | Villasur de Herreros |
| BU-50017 | Demanda-San Millán | Ayuntamiento de Arlanzón y otros | no | no |  |
| BU-50018 | Villanueva de Carazo | Ayuntamiento de Villanueva de Carazo | sí | no | Villanueva de Carazo |
| BU-50019 | Valle de Mena | Ayuntamiento de Valle de Mena y Otros | no | no |  |
| BU-50020 | Cabezón de la Sierra | Ayuntamiento de Cabezón de la Sierra | sí | no | Cabezon de la Sierra |
| BU-50021 | Villanueva Tobera | Junta Administrativa de Villanueva Tobera | sí | sí | Condado de Treviño |
| BU-50022 | Monasterio de Rodilla | Ayuntamiento de Monasterio de Rodilla | sí | no | Monasterio de Rodilla |
| BU-50023 | Carazo | Ayuntamiento de Carazo | sí | no | Carazo |
| BU-50024 | J.V de Santa Gadea de Alfoz | Junta Vecinal de Santa Gadea de Alfoz | sí | no | Alfoz de Santa Gadea |
| BU-50025 | Entidad Local Menor de San Llorente de Losa | Entidad Local Menor de San Llorente de Losa | sí | no | Valle de Losa |
| BU-50026 | Junta de Ledanías | Junta de Ledanías | sí | sí | Salas de los Infantes |
| BU-50027 | Entidad Local Menor de Terradillos de Sedano | Entidad Local Menor de Terradillos de Sedano | sí | no | Valle de Sedano |
| BU-50028 | J.V de Castrobarto | Junta Vecinal de Castrobarto | sí | no | Junta de Traslaloma |
| BU-50029 | J.V de Pérex de Losa | Junta Vecinal de Pérex de Losa | sí | no | Medina de Pomar |
| BU-50030 | Valle de Losa | Ayuntamiento de Valle de Losa | sí | no | Valle de Losa |
| BU-50031 | J.V de Villacián de Losa | Junta Vecinal de Villacián de Losa | sí | no | Valle de Losa |
| BU-50032 | J.V de Villabasil de Losa | Junta Vecinal de Villabasil de Losa | sí | no | Valle de Losa |
| BU-50033 | Junta Administrativa de Quincoces de Yuso | Junta Administrativa de Quincoces de Yuso | sí | no | Valle de Losa |
| BU-50034 | Junta Administrativa de  Río de Losa | Junta Administrativa de  Río de Losa | sí | no | Valle de Losa |
| BU-50035 | J.V de Mambliga de Losa | Junta Vecinal de Mambliga de Losa | sí | no | Valle de Losa |
| BU-50036 | J.V de Villaño de Losa | Junta Vecinal de Villaño de Losa | sí | no | Valle de Losa |
| BU-50037 | J.V de Fresno de Losa | Junta Vecinal de Fresno de Losa | sí | no | Valle de Losa |
| BU-50038 | J.V de Castriciones de Losa | Junta Vecinal de Castriciones de Losa | sí | no | Valle de Losa |
| BU-50039 | J.V de Lastras de Teza | Junta Vecinal de Lastras de Teza | sí | no | Valle de Losa |
| BU-50040 | J.V de Teza de Losa | Junta Vecinal de Teza de Losa | sí | no | Valle de Losa |
| BU-50041 | J.V de Barriga de Losa | Junta Vecinal de Barriga de Losa | sí | no | Valle de Losa |
| BU-50042 | Junta de Estrada | Junta de Estrada | sí | no | Valle de Losa |
| BU-50043 | Ciruelos de Cervera | Ayuntamiento de Ciruelos de Cervera | sí | no | Ciruelos de Cervera, Tejada |
| BU-50044 | J.V de Castresana de Losa y otros | Junta Vecinal de Castresana de Losa y otros | sí | no | Valle de Losa |
| BU-50045 | Acotado Criales | Junta Vecinal Criales | sí | no | Medina de Pomar |
| BU-50046 | Junta de Villalba de Losa | Junta de Villalba de Losa | sí | no | Junta de Villalba de Losa |
| BU-50048 | J.V de Hiniestra | Junta Vecinal de Hiniestra | no | no |  |
| BU-50049 | J.V  de Lastras de la Torre y otros | Junta Vecinal de Lastras de la Torre y otros | sí | no | Valle de Losa |
| BU-50050 | J.V de Cubillos del Rojo | Junta Vecinal de Cubillos del Rojo | sí | no | Valle de Valdebezana |
| BU-50051 | Quintanapalla | Ayuntamiento de Quintanapalla | sí | no | Quintanapalla |
| BU-50052 | Junta Administrativa de  Paresotas | Junta Administrativa de  Paresotas | sí | no | Medina de Pomar |
| BU-50053 | J.V de San Martín de Losa | Junta Vecinal de San Martín de Losa | sí | no | Valle de Losa |
| BU-50054 | Bozoó | Ayuntamiento de Bozoó | sí | no | Bozoo |
| BU-50055 | Junta Administrativa de Oteo de Losa | Junta Administrativa de Oteo de Losa | sí | no | Medina de Pomar |
| BU-50056 | Junta Administrativa de  Momediano | Junta Administrativa de  Momediano | sí | no | Medina de Pomar |
| BU-50057 | Covarrubias |  | sí | no |  |
| BU-50058 | Palacios de la Sierra |  | sí | sí |  |
| BU-50059 | Huerta de Arriba | Ayuntamiento de Huerta de Arriba | sí | sí | Huerta de Arriba |
| BU-50060 | Contreras | Ayuntamiento de Contreras | sí | no |  |
| BU-50061 | Torres de Abajo | Junta Vecinal de Torres de Abajo | sí | no | Valle de Valdebezana |
| BU-50062 | Barbadillo del Pez y otros | Ayuntamiento de Barbadillo del Pez y otros | no | no |  |
| BU-50063 | Covarrubias | Ayuntamiento de Covarrubias | sí | no |  |
| BU-50064 | Junta Administrativa de  Arnedo y otros | Junta Administrativa de  Arnedo y otros | sí | no | Valle de Valdebezana |
| BU-50066 | Fresno de Rodilla | Ayuntamiento de Fresno de Rodilla | sí | no |  |
| BU-50067 | Barbadillo de Herreros y otros | Ayuntamiento de Barbadillo de Herreros y otros | sí | sí | Barbadillo de Herreros, Monterrubio de la Demanda, Pineda de la Sierra |
| BU-50068 | J.V de Montoto | Junta Vecinal de Montoto | sí | no | Valle de Valdebezana |
| BU-50069 | J.V de Bezana | Junta Vecinal Bezana | sí | no | Valle de Valdebezana |
| BU-50070 | J.V de Virtus y Cilleruelo de Bezana | Junta Vecinal de Virtus y Cilleruelo de Bezana | sí | no | Valle de Valdebezana |
| BU-50071 | San Millán de Lara | Ayuntamiento de San Millán de Lara | sí | no | San Millán de Lara |
| BU-50072 | Arija | Ayuntamiento de Arija | sí | no | Arija |
| BU-50073 | Fresneda de la Sierra Tirón | Ayuntamiento de Fresneda de la Sierra Tirón | no | no |  |
| BU-50074 | Rabanera del Pinar | Ayuntamiento de Rabanera del Pinar | no | no |  |
| BU-50075 | Merindad de Río Ubierna |  | no | no |  |

**Hallazgos del cruce (importantes):**

1. **Faltan en la capa 8 claves con ficha en el portal:** BU-50015 Montes de Oca, BU-50017 Demanda-San Millán, BU-50019 Valle de Mena, BU-50048 Hiniestra, BU-50062 Barbadillo del Pez y otros, BU-50073 Fresneda de la Sierra Tirón, BU-50074 Rabanera del Pinar y BU-50075 Merindad de Río Ubierna. Además BU-50057 Covarrubias no tiene titular y BU-50058 Palacios de la Sierra tampoco. BU-50015, 50017, 50019 y 50073 (más BU-50003) son los que venden permiso online con Micocyl.
2. **La capa trae 4 polígonos «Parque» `PMBU-50010`, `PMBU-50020`, `PMBU-50040` y `PMBU-50050` que el portal no lista** (micologiacyl.es no tiene ficha de ellos). Por el cruce con los MUP parecen ser el territorio de los acotados de Micocyl:
   - `PMBU-50010` y `PMBU-50040` (mismos 31 montes): Arlanzón, Villafranca Montes de Oca, Rábanos, Barrios de Colina, Belorado, Cerratón de Juarros, Villaescusa la Sombría, Arraya de Oca, Espinosa del Camino, Valle de Oca, Villambistia = **Montes de Oca** (BU-50015).
   - `PMBU-50050` (25 montes): Ibeas de Juarros, San Adrián de Juarros, Valle de Valdelaguna, Villasur de Herreros, Palazuelos de la Sierra, Pradoluengo = **Demanda-San Millán** (BU-50017).
   - `PMBU-50020` (36 montes): 29 de Valle de Mena, 4 de Fresneda de la Sierra Tirón, 2 de Barbadillo del Pez y 1 de Jaramillo de la Fuente = **Valle de Mena + Fresneda + Barbadillo del Pez**. [NO VERIFICADO: la correspondencia PMBU↔BU es una inferencia geométrica; ninguna fuente oficial la declara. Conviene preguntar a Micocyl (micocyl@micocyl.es, 975 23 96 70).]
3. **Confirmados por el cruce:** `BU-50004` = Pinares Sur (18 MUP: 202, 203, 204, 220, 221, 222, 223, 225, 226, 237, 238, 248, 249, 250, 608, 609, 611, 657); `BU-50008` = coto La Engaña–Merindades Norte (24 MUP de Espinosa de los Monteros, Montija, Sotoscueva y Valdeporres); `BU-50067` = Demanda Suroeste (Pineda, Barbadillo de Herreros, Monterrubio, Riocavado); `BU-50013` = Neila (MUP 243); `BU-50011` = Vilviestre (MUP 289 y 290); `BU-50059` = Huerta de Arriba (MUP 274 y 279); `BU-50026` = Salas de los Infantes (MUP 256 «Ledanía», 7.063 ha).
   - Ojo: en el portal BU-50008 figura como «Acotado de Merindad de Montija» (por el titular). Es el coto de La Engaña según micologiamerindadesnorte.es, que lo rotula «BU-50008» y dice 22.621 ha.
4. **Sin polígono BU en la capa aunque hay normativa o práctica de permiso:** Quintanar de la Sierra (MUP 251 «La Dehesa», 253 «Revenga», 252 «La Manga»), Canicosa (MUP 211 y 212) y Regumiel (MUP 213 y 612) —estos dos últimos están en el Parque Micológico Montes de Soria (ver 2.3)—, Palacios de la Sierra (MUP 244, 245, 246, 247, 613; existe BU-50058 en la capa pero sin MUP dentro), Rabanera del Pinar (MUP 254 y 615, BU-50074). Sin polígono, el visor del repo no los marcaría como regulados aunque lo estén.
5. **BU-50021** (Villanueva Tobera, Condado de Treviño; MUP 194 «San Julián») ya estaba señalada en 05c: rige el Decreto 31/2017, no la normativa alavesa.

### 2.3 Fichas por coto (propuesta para `data/normativa.json`)

Cada ficha sugiere un id, el ámbito y las tarifas con su fuente y fecha. Todo lo no verificado lleva la marca.

**a) `cyl-bu-50017-demanda-san-millan` — Demanda-San Millán (BU-50017)** — titular Ayto. de Arlanzón y otros.
- 11.736 ha; producción media sostenible 300.571 kg; máx. 15.631 permisos; producción actualizada el 29/09/2026 (https://www.micocyl.es/areas/demanda-san-millan). Hábitats (Micocyl): rebollares 38 %, robles y hayas 17 %, pinares de montaña 16 %, pinares de llanura 1 %.
- Tarifas (https://permisos.micologiacyl.es/acotado/demanda-san-millan, 30/09/2026, sin año en la tabla): General recreativo 10 € diario, 15 € dos días, 60 € temporada; General comercial 250 € temporada; Local recreativo 5 €; Local comercial 20 €; Local comercial Plus 50 € (50 kg/día); Vinculado recreativo 30 €, Vinculado comercial 250 €.
- Cupos: recreativo 2 kg/día de perretxico o 5 kg/día de setas en total; comercial 10 kg perretxico o 20 kg de setas; Comercial Plus 50 kg (folleto, https://www.micocyl.es/sites/default/files/area/docs/folleto_demanda_san_millan.pdf; ese folleto aún decía «temporada hasta 31/12/2024»).
- Tamaños mínimos (página del acotado): boletus > 4 cm, Lactarius > 2 cm, perretxico > 2 cm. La nota de prensa de Micocyl de abril de 2025 habla de 3 cm mínimo para el perretxico (parte micológico 11/04/2025, https://www.micocyl.es/sites/default/files/editor/parte_mico_20250411.pdf): **contradicción**, vale el cartel del día.
- Obligatorio cortar con navaja níscalos, setas de cardo, llanegas, negrillas y capuchinas (misma página).
- Dónde se saca: online (https://permisos.micologiacyl.es/acotado/demanda-san-millan) y en puntos físicos: Taberna Arlanzón (Arlanzón, 947 421 556), Cantina Mozoncillo (Ibeas de Juarros), Cantina de Salgüero de Juarros (947 421 074). El permiso local lo respalda el ayuntamiento.
- Montes regulados (parajes) según Micocyl (https://www.micocyl.es/print/areas/demanda-san-millan): Acebal–Vizcarra (Pradoluengo); Ahedo y Dehesa, La Dehesa, Río Baraja, Sierra Campiña (Valle de Valdelaguna); Cuevachote, La Cabeza, Sanchimoro, Valderosoldo (Villasur de Herreros); Cuesta Lechal, Dehesa y Valdemorones, La Cuesta, Las Matas, Matanza, Monte Ibeas, Valcabadillo (Ibeas de Juarros); El Granero, El Robledo, La Mata, Valdeplumeras (San Adrián de Juarros); La Dehesa y Majada y Campo de Pubas (Palazuelos de la Sierra); Dehesa Boyal y La Umbría (Villamiel de la Sierra).
- Locales del acotado (folleto 2024): Pradoluengo, Urrez, Ibeas de Juarros, Arlanzón, Palazuelos de la Sierra, Villasur de Herreros, Mozoncillo de Juarros, Tolbaños de Arriba, Salgüero de Juarros, Vallejimeno, San Adrián de Juarros, Huerta de Abajo, Junta de Juarros, Tolbaños de Abajo.
- Aviso: cacerías colectivas 2026/27 (2.1).

**b) `cyl-bu-50015-montes-de-oca` — Montes de Oca (BU-50015)** — titular Ayto. de Villafranca Montes de Oca y otros.
- 12.461 ha; producción media sostenible 47.615 kg; máx. 2.476 permisos; actualizada 5/06/2026 (https://www.micocyl.es/print/areas/montes-de-oca). Hábitats: rebollares 44 %, pinares de montaña 29 %, robles y hayas 3 %, pinares de llanura 2 %, encinares y quejigares 1 %.
- Tarifas en https://permisos.micologiacyl.es/acotado/montes-de-oca (30/09/2026): General recreativo 15 € diario, 25 € dos días, **120 € temporada**; Local recreativo 5 €; Vinculado recreativo 25 €. **No hay permiso comercial.** El folleto de 2024 (https://www.micocyl.es/sites/default/files/area/docs/folleto_montes_de_oca.pdf) decía 10 € diario, 15 € dos días y **60 €** temporada: la tarifa general subió (antigua vs actual). Un foro de 2011 citaba 10 €/día, 15 € fin de semana y 300 € temporada para foráneos en Belorado (Fungipedia, https://www.fungipedia.org/setas-informacion-y-consultas/6-foro-general/21462-coto-burgos.html, 30/10/2011): histórico, no usar.
- Según Burgos Conecta (28/04/2025), el permiso de Montes de Oca se tramita al día siguiente, al revés que en los demás acotados [RESUMEN AUTOMÁTICO].
- Montes regulados (parajes): Aciosa, Bardal de Ahedillo, Carrascal, Casa Olalla, Cuesta de Rebollar, El Bardal de Villamorico, El Hoyo, El Rebollar, Espinales, Fuentefría, La Carrascosa, La Dehesa, La Hoya, La Junta, La Pedraja, La Solana, Laderas del Río, Las Balleneras, Las Tenadas o Las Casetas, Los Balabrucos, Mataterrazos (Atapuerca), Monte Costorrios (Alarzón), Monte Grande (Villambistia), Monte Mayor (Arraya de Oca), Montesuso (Belorado y Villafranca), La Peligrosa (Valle de Oca), Ralda, Santibrián, Santillanes, Tasugueras, Valdefuentes, Valdegados, Valiserrando y Valloca. Puntos de expedición: Nueva Cantina (Alarcia, 643 826 669), Mesón Alba (Villafranca Montes de Oca), Taberna Arlanzón.

**c) `cyl-bu-50019-valle-de-mena` — Valle de Mena (BU-50019)** — titular Ayto. de Valle de Mena y otros.
- 7.331 ha; 25.761 kg/año; 1.340 permisos; actualizada 5/06/2026. Hábitats: robles y hayas 18 %, pinares de montaña 10 %, rebollares 6 %, encinares y quejigares 3 %.
- Tarifas (https://permisos.micologiacyl.es/acotado/valle-de-mena, 30/09/2026): General recreativo 5 € diario, 7 € dos días, 20 € temporada; General comercial 100 €; Local recreativo 5 €, Local comercial 20 €; Vinculado recreativo 15 €, Vinculado comercial 100 €.
- Parajes: Dehesa de Ordunte (MUP 540 a 546), Derecha de Ordunte, Montepeña, Peña y Dehesa (varias), Sierra de Arrate, El Acebal, Carrascal, Entrambasaguas (1.101 ha), Junquera, Horquilla, La Tejera Canales y Llano, Lérdano en Siones, Recuenco y la Torca, Redondo, Sarón en Arceo, Valcarnero, Vallovera de Ciella, Castrejón de Cilieza (https://www.micocyl.es/print/areas/valle-de-mena).
- Turismo micológico de Micocyl destaca «Montes de la Peña» y «Sierra de Ordunte» (https://www.micocyl.es/print/turismo-micologico-valle-de-mena).

**d) `cyl-bu-50073-fresneda-tiron` — Fresneda de la Sierra Tirón (BU-50073)** — Ayto. de Fresneda de la Sierra Tirón; 5.408,35 ha; producción actualizada 5/06/2026; hábitats: pinares de montaña 30 %, robles y hayas 26 % (https://www.micocyl.es/print/areas/fresneda-de-la-sierra-tiron-bu-50073). Tarifas (https://permisos.micologiacyl.es/acotado/fresneda-de-la-sierra-tiron): General recreativo 10 € diario, 15 € dos días, 60 € temporada; General comercial 250 €; Local recreativo 5 €, Local comercial 20 €. Montes: Hondonada (MUP 14), Las Zarras (MUP 16, Alarzón), Monte Agudo (MUP 15), Zarzabala (MUP 17) y parcelas. Afectado por el calendario de cacerías de la Reserva de la Demanda.

**e) `cyl-bu-50003-san-zadornil` — San Zadornil (BU-50003)** — Ayto. de la Jurisdicción de San Zadornil (975 239 670 según la ficha; el teléfono coincide con el del programa Micocyl y puede ser un error de la ficha); 2.234,61 ha: pinares de montaña 50 %, robles y hayas 20 %; única especie destacada Boletus edulis sept-nov; montes Arcena y Valdelosa. Tarifas (https://permisos.micologiacyl.es/acotado/san-zadornil): General recreativo 10 € diario, 15 € dos días, 100 € temporada; Local 5 €; Vinculado 40 €; sin comercial. Según la capa ENP 2025, el 99 % del polígono BU-50003 está dentro del Parque Natural Montes Obarenes-San Zadornil (cruce propio; su norma de recolección [NO VERIFICADO]).

**f) `cyl-bu-50004-pinares-sur` — Coto Pinares Sur de Burgos (BU-50004)**
- Titulares (cotosdesetas, consultada 30/09/2026): ayuntamientos de Huerta del Rey, Hontoria del Pinar, Arauzo de Miel, Pinilla de los Barruecos, La Gallega, Mamolar y la entidad local menor de Hinojar del Rey. **Rabanera del Pinar salió del consorcio a petición propia** (Burgos Conecta 15/12/2023, https://www.burgosconecta.es/provincia/coto-pinares-sur-trabaja-aplicacion-movil-gestionar-20231215105224-nt.html) [RESUMEN AUTOMÁTICO]. Ese artículo da 18 MUP y 18.891,64 ha; la capa del repo da 18 MUP dentro del polígono (lista en 2.2). En 2013 eran 7 ayuntamientos, unas 19.000 ha y 1.615 licencias anuales (El Correo de Burgos, 26/04/2013, https://www.elcorreodeburgos.com/burgos/provincia/130426/101878/siete-ayuntamientos-crean-coto-micologico-pinares-sur-burgos.html).
- Tarifas según https://cotosdesetas.es/coto-micologico-pinares-sur-de-burgos (sin año): local (empadronado) comercial 10 €/temporada; vinculado comercial 20 €; foráneo 10 €/día, 15 €/fin de semana, 80 €/temporada; cupo 20 kg/día (vinculados y foráneos), empadronados sin cupo. [NO VERIFICADO el año: la página dice «compra de permisos temporalmente no disponible».] La copia de la ordenanza que aloja Rabanera (https://rabaneradelpinar.es/sites/rabaneradelpinar/files/normativa_0.pdf; sin fecha, de la época en que Pinilla de los Barruecos gestionaba la tasa) fija 10 € empadronados, 20 € vinculados, 150 € resto con límite de 15 kg/día, tarjeta de día 10 € y de fin de semana 20 €: **antigua**, no usar.
- Dónde se saca: web y app «Cotos de Setas» (https://www.cotosdesetas.es; aviso del Ayuntamiento de Hontoria del Pinar del 18/09/2024: «se han hecho cambios durante 2024 en el procedimiento de obtención del permiso»; teléfono 947 386 141).
- Reglas locales recogidas en la ordenanza vieja (aplican salvo cambio): solo especies del anexo I; prohibido recolectar huevos cerrados de oronja; parasol con sombrero extendido; solo cesta porosa; prohibido recoger de noche; la caza prevalece. [ANTIGUA: verificar con la web actual.]

**g) `cyl-bu-50067-demanda-suroeste` — Coto Demanda-Suroeste (BU-50067)** — ayuntamientos de Barbadillo de Herreros, Pineda de la Sierra, Riocavado de la Sierra y Monterrubio de la Demanda. Según cotosdesetas (https://cotosdesetas.es/coto-micologico-demanda-suroeste, consultada 30/09/2026, sin año): local recreativo 10 €/temporada, comercial 30 €; vinculado recreativo 30 €, comercial 70 €; foráneo recreativo 60 €/temporada, 15 €/dos días, 10 €/día; comercial 300 €; cupos 5 kg/día recreativo y 30 kg/día comercial. Compra online en la misma web; aviso de cacerías colectivas (Decreto 31/2017). Parajes (capa MUP): Ahedo de la Pared, Barranco Malo, Dehesa Boyal, Peguera (Pineda de la Sierra); Lomomediano (5.721 ha, Barbadillo de Herreros); La Dehesa y La Umbría (Monterrubio); La Dehesa (3.903 ha, Riocavado).

**h) `burgos-engana-merindades-norte` — Coto micológico La Engaña–Merindades Norte (BU-50008)**
- Titulares: ayuntamientos de Espinosa de los Monteros, Merindad de Montija, Merindad de Sotoscueva y Merindad de Valdeporres (22.621 ha según su web). Web oficial: https://micologiamerindadesnorte.es (leída el 30/09/2026).
- **Tarifas 2026 (según la web):** diario 10 €; dos días 15 €; temporada 2026 recreativo foráneos 60 €. Empadronados, vinculados y foráneo comercial solo en el ayuntamiento. La web avisa de que los puntos de venta «adicionales» de su lista **no están operativos**. La ordenanza de Espinosa (BOPBUR nº 45, 4/03/2024, https://espinosadelosmonteros.es/wp-content/uploads/2024/03/ANUNCIO-APROBACION-DEFINITIVA-ORDENANZA-APROVECHAMIENTO-MICOLOGICO-BOB-45-DE-4-DE-MARZO-DE-2024.pdf) fija anual recreativo 10 € empadronado, 30 € vinculado, 60 € foráneo; comercial 30 €, 300 € y 300 €; diario 10 € y dos días 15 € para foráneos; +2 € si el foráneo saca el permiso en el ayuntamiento; permisos válidos desde la fecha de expedición hasta el 31/12.
- Cupos: recreativo 2 kg/día de perretxico o 4 kg/día de setas; comercial 10 kg o 20 kg. Exentos los menores de 14 con adulto. La ordenanza de Espinosa no se aplica a la trufa. Prohibido recoger oronja en huevo y parasol cerrado. Prohibido vender, cambiar o regalar dentro del monte.
- Acceso: solo hasta los aparcamientos marcados dentro de los MUP, por las pistas señalizadas y con vehículo adecuado (https://micologiamerindadesnorte.es/areas-reguladas/, mapa de 19/07/2017). Coordenadas ETRS89 UTM 30 en 3.
- Puntos de adquisición en ayuntamientos: Montija (Bercedo, 947 740 736), Espinosa (947 120 002), Sotoscueva (Cornejo, 947 138 681), Valdeporres (Pedrosa, 947 130 010).
- Pluviómetros que enlaza la web para predecir: SAIH Ebro P058 Espinosa de los Monteros y P074 Lunada (http://www.saihebro.com/saihebro/index.php?url=/datos/ficha/estacion:P058 y estacion:P074). No son AEMET.

**i) Acotados pequeños del norte (Losa, Medina de Pomar, Villarcayo, Sedano).** Hay ~35 claves BU-50005 a BU-50056 de juntas vecinales y entidades locales menores del Valle de Losa, Medina de Pomar, Valdebezana y Sedano (tabla 2.2). Tarifas y fichas **no encontradas** salvo un hilo de 2013 en Foro Micológico (https://www.foromicologico.es/index.php?topic=21061.0, 29/04-08/09/2013, defenestrc, SrHongo, Capuchino): 11 localidades de Valle de Losa con autorización; Villalba de Losa ~100 €/temporada para foráneos; Quincoces de Yuso ~50 €/temporada (abril, perretxico); San Llorente de Losa ~500 €/año. [MENSAJE ANTIGUO >10 años] [RESUMEN AUTOMÁTICO] [NO VERIFICADO vigente].

**j) `cotos-bozoo-bu-50054` — Bozoó (BU-50054).** Según cotosdesetas (https://cotosdesetas.es/coto-micologico-de-bozoo, sin año): local y vinculado 5 € temporada y 3 € día; foráneo 60 € temporada, 24 € semana, 8 € dos días, 5 € día; recreativo 5 kg/día; sin comercial. Especies: níscalo, marzuelo, carbonera. Monte: Sierra de Besantes (MUP 690).

**k) Pinares no cubiertos por Micocyl ni por un coto con web:**
- **Neila (BU-50013)**: gestión municipal desde hace años (El Correo de Burgos 25/09/2016, https://www.elcorreodeburgos.com/burgos/provincia/160925/72782/furtivos-condicionan-campana-setas-pinares.html, recaudó 7.000-8.000 € en 2015) [RESUMEN AUTOMÁTICO]. En 2018: 10 € empadronados, 20 € vinculados, 10 €/día visitantes, máx. 15 kg (https://www.tuvozenpinares.com/articulo/sociedad/pinares-gran-coctel-regulaciones-micologicas/20181013202308015375.html, 13/10/2018) [ANTIGUO]. Hoy: [NO VERIFICADO]; teléfono del ayuntamiento 947 395 464 (https://www.neila.es).
- **Vilviestre del Pinar (BU-50011)**: en 2018, 10 € empadronados, 20 € vinculados (10 kg/día) y 10 €/día o 100 €/temporada visitantes (misma fuente) [ANTIGUO]. Teléfono 947 390 651 (https://www.vilviestredelpinar.es). Hoy [NO VERIFICADO].
- **Quintanar de la Sierra**: «sin regulación» en 2016 y «pendiente» en 2018 (mismas fuentes). El MUP 251 «La Dehesa» (5.454 ha) y el 246 figuran como régimen «libre» en 2018 (https://cotosdesetas.es/2018/04/5-montes-superproductores-de-marzuelos-en-burgos-y-soria.html, 6/04/2018). Sin polígono BU en la capa. Si sigue sin regular, sería terreno episódico: 3 kg/día, sin comercializar, sin trufa [NO VERIFICADO vigente; llamar al ayuntamiento].
- **Palacios de la Sierra**: «sin regulación» en 2016 y «pendiente» en 2018; hoy existe la clave BU-50058 sin titular en el portal (régimen [NO VERIFICADO]).
- **Huerta de Arriba (BU-50059)**: Ayuntamiento titular; tarifas no encontradas.
- **Regumiel de la Sierra y Canicosa de la Sierra**: entraron en el **Parque Micológico Montes de Soria** (PMSO-50001: 127.909,88 ha, 64 municipios de Soria y 2 de Burgos). La web de la asociación (https://asociacionmontesdesoria.com/permiso-de-recoleccion-de-setas/, consultada 30/09/2026 [RESUMEN AUTOMÁTICO]) nombra las dos como los municipios de Burgos y da las tarifas 2026 (las mismas de `cyl-montes-de-soria` en el repo: 10 € general, 3 € local, 10 € local comercial, 10 € vinculado, 50 € vinculado comercial). Se compran en los ayuntamientos (locales y vinculados) y en puntos privados (bares, alojamientos, gasolineras). En Canicosa hay 4 puntos (ayuntamiento, telecentro, Casa de la Madera y Bar Cabrero) según https://asociacionmontesdesoria.com/portfolio/canicosa-de-la-sierra/ . **Propuesta: añadir `burgos-pinares` al ámbito de `cyl-montes-de-soria`.**
- **Rabanera del Pinar (BU-50074)**: acotado propio del ayuntamiento desde que salió de Pinares Sur; tarifas no encontradas.
- **Covaleda, Duruelo, Vinuesa, Molinos, Salduero y Montenegro** (Soria) gestionan el coto Pinares de Urbión (SO-50001); no son Burgos. La web de ese coto muestra «Quintanar de la Sierra» y «Palacios de la Sierra» en su menú pero **no** los lista como titulares (https://www.pinaresdeurbion.es, 30/09/2026): [NO VERIFICADO si se integraron].

### 2.4 Dónde se saca el permiso (resumen)

| Coto | Dónde |
|---|---|
| Micocyl (Oca, Demanda-San Millán, Mena, Fresneda, San Zadornil) | https://permisos.micologiacyl.es/acotado/{montes-de-oca, demanda-san-millan, valle-de-mena, fresneda-de-la-sierra-tiron, san-zadornil}; puntos físicos en https://expedicion.permisos.micologiacyl.es/ (solo para establecimientos). Contacto: micocyl@micocyl.es, 975 23 96 70 (laborables 10-13 h). App Micocyl con GPS y puntos de venta. |
| Pinares Sur, Demanda Suroeste, Bozoó | https://www.cotosdesetas.es y app «Cotos de Setas»; locales y vinculados los aprueba el ayuntamiento. |
| La Engaña–Merindades Norte | https://micologiamerindadesnorte.es/permisos/ y ayuntamientos. |
| Montes de Soria (Canicosa, Regumiel) | https://permisos.micologiacyl.es/acotado/montes-de-soria y puntos locales. |
| Neila, Vilviestre, Quintanar, Palacios, Huerta de Arriba, Rabanera | Ayuntamiento (teléfonos arriba); [NO VERIFICADO si hay venta online]. |
| Jornadas y guías | Guías recomendados Micocyl: «Micología para tod@s» (Condado de Treviño, 618 391 899, info@micologiaparatodos.com). |

### 2.5 Espacios protegidos del entorno (capa ENP 2025 del MITECO, cruce propio 30/09/2026)

Ningún punto meteorológico propuesto (apartado 4) cae dentro de un espacio protegido. Sí hay Parques Naturales cerca que conviene marcar en los sitios:

- **Lagunas Glaciares de Neila** (Parque Natural, ES412007): las Lagunas y el entorno de la Laguna Negra de Neila están dentro. A 1,1 km de mi punto P2b. Norma de recolección del parque [NO VERIFICADO].
- **Solape de acotados con Parques Naturales (cruce propio polígono a polígono, % del acotado dentro del parque):** BU-50013 Neila 100 % en Lagunas Glaciares de Neila; BU-50003 San Zadornil 99 % y BU-50054 Bozoó 100 % en Montes Obarenes-San Zadornil; BU-50006 Santo Domingo de Silos 100 %, BU-50060 Contreras 100 %, BU-50023 Carazo 99 %, BU-50063 Covarrubias 97 %, BU-50057 Covarrubias 96 %, BU-50010 Espinosa de Cervera 80 %, BU-50043 Ciruelos de Cervera 60 % y BU-50018 Villanueva de Carazo 43 % en Sabinares del Arlanza-La Yecla; BU-50004 Pinares Sur 22 % en Sabinares del Arlanza-La Yecla y 16 % en Cañón del Río Lobos; BU-50061, 50069 y 50027 en parte (5-46 %) en Hoces del Alto Ebro y Rudrón. Es decir, **Neila, Obarenes y los acotados del Arlanza son Parque Natural casi enteros**: la norma del parque (PORN/PRUG) puede añadir condiciones [NO VERIFICADO; no leídas]. Estos parques son de sabinar/encinar o de pinar; los sitios B05 y B06 de 3.1 y San Zadornil (B26) deberían llevar el campo `proteccion`.
- **Cañón del Río Lobos** (PN), **Sabinares del Arlanza-La Yecla** (PN), **Montes Obarenes-San Zadornil** (PN), **Hoces del Alto Ebro y Rudrón** (PN), **Monte Santiago** y **Ojo Guareña** (Monumentos Naturales), **Alto Najerilla**, **Laguna Negra y Circos Glaciares de Urbión** y **Sierra de Cebollera** (PN de La Rioja y Soria, en el borde) y el espacio Red Natura **«Sierras de Demanda, Urbión, Cebollera y Cameros»** (ES230004). No he leído los PORN/PRUG de ninguno; Red Natura no suele prohibir recoger por sí sola (criterio ya usado en `docs/datos.md`).

---

## 3. Sitios (propuesta para `data/sitios.json`)

Convenciones: `tipo`: sitio, ruta o evento; `epoca` = meses; `nFuentes` = fuentes independientes contadas; `confianza` baja/media/alta como en `docs/datos.md`. Ningún sitio trae coordenadas salvo los aparcamientos de La Engaña (que son oficiales) y los puntos de bosque del apartado 4. Donde «municipio» va con MUP, el número es el del catálogo de montes de utilidad pública en IDECyL.

### 3.1 Pinares (Sierra de la Demanda sur, comarca de Pinares)

| # | Pueblo | Paraje / monte | Especies | Época | Consejo | nº fuentes | Fuentes |
|---|---|---|---|---|---|---|---|
| B01 | Hontoria del Pinar (Pinares Sur, BU-50004) | MUP 223 «El Pinar» (2.676-2.729 ha, pino silvestre, pinaster, pino laricio y sabina) y MUP 222 «La Sierra y Costalago» | Marzuelo (feb-abr), hongo blanco, níscalo, capuchina | Marzuelo feb-abr; hongo y níscalo sept-nov | Marzuelo en las umbrías de pino silvestre sobre suelo silíceo, a menudo en mezcla con haya; se busca dejando que corzos y ardillas marquen los primeros | 5 | cotosdesetas marzuelos (6/04/2018); cotosdesetas ficha Pinares Sur; El Correo 1/11/2025 (Hontoria y Pinilla como ruta «Pinares», permiso obligatorio); Micocyl parte 28/10/2024 (níscalos en pinares de los acotados de Burgos); incautación 2-3/10/2015 (173 kg de hongo y 24 kg de níscalo, Huerta del Rey y Salas, https://www.agronewscastillayleon.com/intervenidos-197-kilos-de-setas-recolectadas-ilegalmente-en-la-demanda-burgalesa, 7/10/2015) |
| B02 | Rabanera del Pinar (BU-50074) | MUP 254 «Las Cuadrillas» (1.925 ha, pino silvestre) y MUP 615 | Marzuelo; níscalo y Suillus luteus (muy abundante) | Marzuelo feb-abr; otoño | Ruta del Boletus (12,5 km, 105 m de desnivel, sale de la pista deportiva hacia Aldea del Pinar): pinar con níscalos y Suillus luteus según Terranostrum | 2 | cotosdesetas marzuelos (6/04/2018); https://www.terranostrum.es/senderismo/ruta-del-boletus-rabanera-del-pinar (sin fecha) [RESUMEN AUTOMÁTICO] |
| B03 | Quintanar de la Sierra | MUP 251 «La Dehesa» (5.454-5.550 ha, pino silvestre), MUP 253 «Revenga» y Comunero de Revenga (unas 3.000 ha compartidas con Canicosa y Regumiel; ermita de Nuestra Señora de Revenga) | Marzuelo; hongo blanco, cesárea, níscalo, pie azul (comarca) | Marzuelo feb-abr; otoño | Régimen «libre» en 2018 [NO VERIFICADO vigente]; Jornadas Micológicas en Quintanar (oct-nov) | 4 | cotosdesetas (6/04/2018); burgos.es Ruta de las Setas (https://www.burgos.es/sites/default/files/file/page/1ruta_de_las_setas.pdf, sin fecha); Terranostrum (burgos-destino-micologico, sin fecha); Fungipedia 24/09/2015 (un usuario pregunta si compensa ir; sin respuestas) |
| B04 | Palacios de la Sierra (BU-50058) | MUP 246 «Guerreado y Abejón» (517 ha, propiedad compartida con Hontoria, Vilviestre y San Leonardo de Yagüe), MUP 244 «La Campiña y Bañuelos», 245, 247 y 613 | Marzuelo | feb-abr | Régimen «libre» en 2018 y hoy clave BU-50058 sin titular [NO VERIFICADO] | 1 | cotosdesetas (6/04/2018) |
| B05 | Vilviestre del Pinar (BU-50011) | MUP 289 «Matarrucha» y 290 «El Monte» (1.814 ha) | Marzuelo | feb-abr | Coto municipal; en 2018 10 €/día (ver 2.3k) | 2 | cotosdesetas (6/04/2018); tuvozenpinares (13/10/2018) |
| B06 | Neila (BU-50013) | MUP 243 «Ahedo o Pinar» (5.535 ha); Lagunas Glaciares de Neila (Parque Natural) y «Las Calderas» | Marzuelo; hongo, níscalo (pinar y ahedo) | Marzuelo feb-abr; otoño | El polígono BU-50013 está entero dentro del Parque Natural Lagunas Glaciares de Neila (cruce propio): norma de recolección del parque [NO VERIFICADO]; la capa IDECyL da pinar de silvestre cerrado a 1.705-1.737 m | 3 | cotosdesetas (6/04/2018); Burgos Conecta 21/11/2025 (lagunas de Neila y Las Calderas en la «escapada micológica»); Forocoches 16/11/2012 (ahedo-pinar; el hilo no habla de setas) |
| B07 | Huerta de Arriba (BU-50059) | MUP 279 «Santa Engracia» (2.042 ha) y 274 «La Dehesa» | Marzuelo | feb-abr | La capa IDECyL da pinar de silvestre 100 %, arbolado cerrado | 1 | cotosdesetas (6/04/2018) |
| B08 | Canicosa de la Sierra (Montes de Soria) | MUP 212 «El Pinar» (2.265 ha), 211 «Montecillo, Pimpollar y la Dehesa»; ruta «por el monte de Canicosa con guías micológicos» | Hongo (blanco, negro, rojo), colmenilla, rebozuelo, níscalo, oronja | Jornadas 28/10-3/11/2024 | Las Jornadas Micológicas (XXIV edición) y la feria Mico-Agroalimentaria (XVII) son el gran evento; ruta con guías el 3/11/2024 | 4 | https://asociacionmontesdesoria.com/portfolio/canicosa-de-la-sierra/; Micocyl díptico 2024 (https://micocyl.es/sites/default/files/noticias_docs/diptico_canicosa_2024.pdf); El Correo 28/10/2024 (1,5 kg/ha en Pinares ese año, cosecha algo tardía); burgos.es Ruta de las Setas |
| B09 | Regumiel de la Sierra (Montes de Soria) | MUP 213 «El Pinar» (1.983 ha) y 612 | Níscalo, boletus | otoño | Entró en Micocyl por los furtivos; la capa IDECyL da pinar de silvestre 100 % cerrado a 1.263 m | 2 | El Correo 25/09/2016; Burgos Conecta 18/10/2023 |
| B10 | Salas de los Infantes (BU-50026) y Hacinas | MUP 256 «Ledanía» (7.063 ha) | Hongo (edulis y pinícola), cesárea, níscalo, pie azul | Jornadas en noviembre desde 1984 | Fuente Sanza y la zona de Cuyacabras son paradas turísticas; no hay dato de mejores parajes | 3 | Terranostrum (sin fecha); burgos.es Ruta de las Setas; tuscasasrurales 18/11/2022 |
| B11 | Hontoria, Pinilla, Huerta del Rey (Pinares Sur) | «Ruta Huerta de Rey» y Cañón del Río Lobos | Hongo, níscalo | otoño | Jornadas Micológicas de Hontoria: en octubre-noviembre, unos 6 días | 2 | Terranostrum Hontoria (sin fecha); terranostrum calendario |

Datos de producción de la zona: Micocyl (parte del 28/10/2024) dice que en Burgos se registraron producciones relevantes de níscalo en pinares de los acotados, con boletus en ligero aumento; el parte del 21/11/2024 habla de descenso de níscalo y boletus con muchos ejemplares parasitados y de lengua de vaca, senderilla, parasol, angula de monte y capuchina que siguen; el de 11/04/2025 (Burgos) anuncia perretxicos en praderas de montaña y las primeras colmenillas. Burgos Conecta (27/09/2024) cita más de 1,5 kg/ha de Boletus edulis y más de 1 kg/hora de níscalo en septiembre de 2024 [RESUMEN AUTOMÁTICO].

### 3.2 Sierra de la Demanda (vertiente burgalesa), Oca y Condado

| # | Pueblo | Paraje / monte | Especies | Época | Consejo | nº fuentes | Fuentes |
|---|---|---|---|---|---|---|---|
| B12 | Valle de Valdelaguna (BU-50017) | MUP 271 «Ahedo y Dehesa» (hayedo 100 %, 1.676 m), Sierra Campiña, Río Baraja, La Dehesa | Hongo blanco, perretxico, llanega, capuchina, marzuelo | Perretxico abr-jun; hongo sept-nov; marzuelo feb-abr; capuchina nov-dic | Cacerías colectivas el 22/11/2026 y 3/01/2027 | 2 | micocyl.es/areas/demanda-san-millan (29/09/2026); calendario de cacerías 2026 |
| B13 | Pradoluengo (BU-50017) | Acebal–Vizcarra; Jornadas Micológicas | Níscalo, hongo | otoño | Cacerías los 17/10, 21/11 y 12/12/2026 | 3 | micocyl.es (idem); Terranostrum; El Correo 1/11/2025 (punto de partida de la ruta «Sierra de la Demanda») |
| B14 | Pineda de la Sierra y Barbadillo de Herreros (BU-50067) | «Ahedo de la Pared», «Barranco Malo», «Peguera», «Lomomediano» (5.721 ha) | Hongo, pinícola, hongo negro, níscalo, cesárea | sept-nov | Coto Demanda Suroeste | 3 | cotosdesetas (sin año); El Correo 1/11/2025; Burgos Conecta 21/11/2025 (Pico San Millán, Peña de la Pastora) |
| B15 | Monterrubio de la Demanda (BU-50067) | MUP 242 «La Umbría» (rebollar, 631 ha) y 241 | Hongo blanco, rebozuelo | sept-nov | Rebollar 100 % a 1.366 m (IDECyL) | 1 | capa IDECyL (30/09/2026) |
| B16 | Villasur de Herreros (BU-50016; antes «La Pedraja») | Cuevachote, La Cabeza, Sanchimoro, Valderosoldo; coto de La Pedraja | Hongo | otoño | En 2011 el permiso de La Pedraja se sacaba en el camping de Villasur (10 €/día, 100 €/año, 5 kg) | 1 | Foro Micológico https://www.foromicologico.es/index.php?topic=11855.0 (19/09-11/10/2011, aritza24 y jfbrmtx22) [MENSAJE ANTIGUO >10 años] [RESUMEN AUTOMÁTICO] |
| B17 | Fresneda de la Sierra Tirón (BU-50073) | Monte Agudo (MUP 15, hayedo 100 % a 1.478 m), Hondonada, Las Zarras, Zarzabala | Capuchina (ene), níscalo, hongo | otoño | 30 % pinar y 26 % robles y hayas; cacerías de la Reserva de la Demanda | 3 | micocyl.es (5/06/2026); Burgos Conecta 21/11/2025; Burgos Conecta 28/04/2025 (Santa Olalla del Valle, Villagalijo, Santa Cruz del Valle Urbión, Valmala) |
| B18 | Villafranca Montes de Oca y pueblos de la Oca (BU-50015) | Monte Mayor (Arraya de Oca), Mataterrazos (Atapuerca), Monte Costorrios (Alarzón), Valdefuentes, La Junta (Arlanzón), Monte Grande (Villambistia) | Perretxico (abr-may), hongo blanco (sept-nov), hongo de verano (jun-sept), hongo rojo (mayo-jun y oct-nov), níscalo (sept-dic), llanega (oct-nov), capuchina (nov-dic), marzuelo (feb-abr), rebozuelo, colmenilla (abr-may), cesárea (jul, sept-oct) | Todo el año según especie | Rebollar 44 % y pinar de montaña 29 %; Micocyl cita Boletus, Lactarius y Cantharellus como predominantes; permiso se activa al día siguiente | 4 | micocyl.es/print/areas/montes-de-oca (5/06/2026); micocyl turismo Montes de Oca; Burgos Conecta 28/04/2025; Fungipedia 30/10/2011 (Belorado, «ausencia de boletus» en 2011 [ANTIGUO]) |
| B19 | Condado de Treviño: Villanueva Tobera (BU-50021) | MUP 194 «San Julián»; robles, hayas y tejos | Perretxico, setas de primavera | primavera | Burgos Conecta lo cita como uno de los cinco lugares de primavera | 1 | Burgos Conecta 28/04/2025 [RESUMEN AUTOMÁTICO] |

### 3.3 Merindades y norte

| # | Pueblo | Paraje / monte | Especies | Época | Consejo | nº fuentes | Fuentes |
|---|---|---|---|---|---|---|---|
| B20 | Espinosa de los Monteros (BU-50008) | «Alto el Caballo» (aparcamiento, 43.127, -3.5361, MUP 388 Valloseda), Lunada (MUP 382, 3.665 ha), El Alar, Hoyo y Bustralama | Perretxico (cupo propio), hongo, níscalo | primavera y otoño | Pluviómetros SAIH P058 y P074 para saber si ha llovido; pistas forestales solo hasta los aparcamientos | 3 | micologiamerindadesnorte.es (áreas reguladas y condiciones, consultada 30/09/2026); BOPBUR 4/03/2024; FM 21061 (2013) |
| B21 | Merindad de Sotoscueva | Aparcamientos «Pico del Ángel» (43.0665, -3.6533, MUP 478), «Fuente el Soto» (43.0778, -3.6431, MUP 486) y «Acceso monte La Cueva» (43.0558, -3.6439); MUP 478 «La Cueva» (1.644 ha), 486 «Montemayor», 493 «Valmayor» | Perretxico, hongo | primavera y otoño | Coordenadas convertidas por mí desde ETRS89 UTM 30 (446812/4768410, etc.) | 2 | micologiamerindadesnorte.es/areas-reguladas (19/07/2017); Terranostrum / tuscasasrurales (Sotoscueva y Valdeporres citadas) |
| B22 | Merindad de Montija | Aparcamientos «La Cubilla» (43.1059, -3.4643, MUP 469 Cerneja), «La Naviciada» (43.1161, -3.4322, MUP 475 Rupando) y «Segundo paso canadiense Cerneja» (43.0991, -3.5186) | Perretxico, hongo | idem | MUP 469 «Cerneja» (2.199 ha): hayedo 100 % semicerrado a 1.031 m en la capa IDECyL | 2 | idem |
| B23 | Merindad de Valdeporres | Aparcamientos «Área recreativa La Engaña» (43.0561, -3.7302, MUP 499), «Manga Ganadera» (43.0752, -3.7146), «Pinar Dosante» (43.0271, -3.7557, MUP 505 «Río Nela», 4.423 ha) y «Parque eólico» (43.0558, -3.809) | Perretxico, hongo | idem | Pinar de silvestre en Dosante [NO VERIFICADO con la capa IDECyL: sin dato] | 2 | idem |
| B24 | Valle de Mena (BU-50019) | Sierra de Ordunte (MUP 540-546 «Dehesa de Ordunte»), Montes de la Peña, Sierra de Arrate, El Acebal | Perretxico (abr-may), níscalo, hongo blanco, colmenilla | abril-mayo y sept-nov | El valle figura como Parque Starlight (Burgos Conecta 28/04/2025); Micocyl destaca su biodiversidad | 4 | micocyl.es/print/areas/valle-de-mena (5/06/2026); micocyl turismo Mena; Burgos Conecta 28/04/2025 y 21/11/2025 (pantano de Ordunte y Montes de la Peña); tuscasasrurales 18/11/2022 |
| B25 | Valle de Losa (11 localidades) | Villalba de Losa (MUP 443-453), Quincoces de Yuso (MUP 403), San Llorente de Losa (BU-50025), Río de Losa, Villabasil, Fresno de Losa | Perretxico (abril), hongo | abril; otoño | Precios de 2013 muy distintos (50 a ~500 €/temporada) [ANTIGUO] | 1 | FM 21061 (29/04-08/09/2013) |
| B26 | Jurisdicción de San Zadornil (BU-50003), dentro del PN Montes Obarenes-San Zadornil | Arcena y Valdelosa | Hongo blanco | sept-nov | Cuatro núcleos rurales de la jurisdicción citados en Burgos Conecta | 2 | permisos.micologiacyl.es/acotado/san-zadornil; Burgos Conecta 21/11/2025 |
| B27 | Bozoó (BU-50054) | Sierra de Besantes (MUP 690) | Níscalo, marzuelo, carbonera | otoño y primavera | Coto municipal barato para locales | 1 | cotosdesetas (sin año) |
| B28 | Montes Obarenes (Pancorbo, Oña, Poza de la Sal) | Hayedos de Obécuri y Bajauri; «Ruta Circular del Hayedo» | Sin datos | - | La búsqueda de la herramienta afirmó que esa ruta se recomienda «para la recogida de setas» en el PDF «Bureba-Ebro» de turismoburgos.org; **no pude abrir el PDF**. | 0 | https://turismoburgos.org/wp-content/uploads/2025/12/Bureba-Ebro-interactivo-_compressed.pdf [NO VERIFICADO: solo resumen del buscador] |

**Sin datos de setas encontrados** (se piden en el enunciado): Sociedad Micológica Burgalesa (no localizada), Parque Micológico (no existe ninguno con clave PMBU en el portal oficial), Fungipedia «Burgos» solo trae el hilo de Quintanar (2015), Forocoches no trae parajes. La búsqueda mostró también un hilo de Forocoches de abril de 2026 («El hilo de las setas y hongos») y otro de octubre de 2019 («¿Dónde hay setas en la zona de Aragón / Soria?») que no abrí a fondo.

Otros lugares nombrados por Burgos Conecta (21/11/2025) sin especie asociada: Belorado, San Miguel de Pedroso, Lezana, Villasana, Cozuela, Maltranilla, La Llana, cascadas de Altuzarra, Pozo Negro, tejo milenario, embalse de Alba, hayedos de Leciñana y de Haedo, Castañar de Arroyo (PRC-BU 100), minas de Puras de Villafranca. Ninguno está localizado ni verificado como sitio de setas.

---

## 4. Hábitats y puntos meteorológicos propuestos (dentro de bosque real)

### 4.1 Método

- Especie dominante y ocupación: capa `montes:gesfor_cyl_tipmas` de IDECyL (`https://idecyl.jcyl.es/geoserver/montes/wms`, GetFeatureInfo punto en polígono, igual que en `docs/datos.md`). Devuelve especie dominante (`d_leyen`), % de ocupación (`n_ocup1`) y clase de cobertura (`d_cubta`).
- Monte de utilidad pública y propietario: capa `montes:montes_cyl_mup_vw` (GetFeatureInfo).
- Altitud: API de elevación de Open-Meteo (valor con el que hay que pedir la meteo).
- Ortofoto PNOA (WMS del IGN, 0,6 km de lado) vista por mí: cubierta arbolada densa en P2, P2b, P3, P4 y P5; **P1 es pinar más abierto, con claros y roca** (aceptable, pero el menos denso).
- Espacios protegidos: capa ENP 2025 del MITECO (punto en polígono): ninguno de los puntos cae dentro de un espacio protegido; el punto P2b queda a 1,1 km del PN Lagunas Glaciares de Neila.
- Acotado: polígono de la capa oficial (`BU-`/`PMBU-`) que contiene el punto.
- **La capa gesfor de IDECyL solo cubre montes con gestión forestal y deja huecos** (muchos polígonos sin `d_cubta`). En los Montes de Oca y el Valle de Mena casi no hay polígonos con especie y cobertura; por eso no propongo punto allí. El MFE25/MFE50 del MITECO sí cubre Burgos, pero no lo consulté. Si se quiere un punto en Mena u Oca, hay que usar el MFE50 de Burgos (https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/mfe50_descargas_castilla_y_leon.html, no comprobada esa URL).

### 4.2 Puntos propuestos

| id | Zona | Nombre | lat | lon | alt. (m) | habitat | Especie dominante (IDECyL) | Monte (MUP) | Acotado / protección |
|---|---|---|---|---|---|---|---|---|---|
| `burgos-pinares-hontoria-pinar` (P1) | burgos-pinares | Pinar de Hontoria del Pinar (Pinares Sur) | 41.8896 | -3.1398 | 1160 | pinar-silvestre | Pinus sylvestris 100 %, sin dato de cobertura; ortofoto semiabierta | MUP 223 «El Pinar» (Hontoria) | BU-50004; fuera de ENP |
| `burgos-pinares-palacios-pinar` (P2) | burgos-pinares | Pinar de Palacios de la Sierra y Vilviestre | 41.9994 | -3.0805 | 1271 | pinar-silvestre | P. sylvestris 75 % + Q. pyrenaica 25 %, arbolado cerrado | MUP 244 «La Campiña y Bañuelos» (Palacios) | sin polígono BU (a 0,8 km de BU-50011); fuera de ENP; régimen [NO VERIFICADO] |
| `burgos-demanda-monte-agudo-hayedo` (P3) | burgos-demanda | Hayedo de Monte Agudo (Fresneda de la Sierra Tirón) | 42.2755 | -3.1525 | 1478 | hayedo | Fagus sylvatica 100 %, ortofoto densa | MUP 15 «Monte Agudo» | `PMBU-50020` (inferencia: Micocyl BU-50073); fuera de ENP |
| `burgos-demanda-umbria-rebollar` (P4) | burgos-demanda | Rebollar de La Umbría (Monterrubio de la Demanda) | 42.173 | -3.1152 | 1366 | melojar | Quercus pyrenaica 100 %, sin dato de cobertura; ortofoto densa | MUP 242 «La Umbría» | BU-50067; a 0,4 km de Alto Najerilla (PN de La Rioja) |
| `burgos-merindades-cerneja-hayedo` (P5) | burgos-merindades | Hayedo de Cerneja (Merindad de Montija, coto La Engaña) | 43.127 | -3.4875 | 1031 | hayedo | Fagus sylvatica 100 %, arbolado semicerrado; ortofoto densa | MUP 469 «Cerneja» | BU-50008; fuera de ENP |
| alternativa P2b | burgos-pinares | Pinar alto de Huerta de Arriba (junto a las Lagunas de Neila) | 42.0637 | -3.0682 | 1705 | pinar-silvestre | P. sylvestris 100 %, arbolado cerrado | MUP 279 «Santa Engracia» | BU-50059; a 1,1 km del PN Lagunas Glaciares de Neila; 1.705 m es alto para el hongo |

Fuentes de la especie dominante (GetFeatureInfo, `bbox` ±20 m en EPSG:25830; `&width=101&height=101&x=50&y=50&info_format=application/json&feature_count=3`, todas con el prefijo `https://idecyl.jcyl.es/geoserver/montes/wms?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=montes:gesfor_cyl_tipmas&query_layers=montes:gesfor_cyl_tipmas&srs=EPSG:25830&`):

- P1: `bbox=488382.1044374584,4637508.204896262,488422.1044374584,4637548.204896262`
- P2: `bbox=493313.11862499994,4649692.741198659,493353.11862499994,4649732.741198659`
- P2b: `bbox=494337.4747035851,4656831.051945302,494377.4747035851,4656871.051945302`
- P3: `bbox=487404.9351818335,4680356.6685716165,487444.9351818335,4680396.6685716165`
- P4: `bbox=490465.294861789,4668970.928846787,490505.294861789,4669010.928846787`
- P5: `bbox=460326.581882359,4775013.411489224,460366.581882359,4775053.411489224`

Notas para `zonas.json`: `revisado` = 2026-09-30; `proteccion` solo en P4 (cerca de Alto Najerilla, sin norma leída) y en P2b si se añade (Parque Natural de las Lagunas, norma [NO VERIFICADO]). **No he cruzado con Red Natura 2000.** Como mínimo la Demanda y Urbión están en el espacio Red Natura ES230004 (capa ENP 2025). No se puede comprobar con estas fuentes la orientación (umbría) ni el sustrato silíceo que se cita para el marzuelo.

Los parajes de La Engaña (Sotoscueva, Valdeporres) **no tienen polígono en la capa gesfor** (la consulta en los aparcamientos no devuelve especie), salvo los de Montija (La Cubilla y La Naviciada, sin leyenda legible). Por eso el punto de las Merindades se movió a Cerneja.

### 4.3 Estaciones AEMET cercanas (inventario AEMET vía la Edge Function del repo, `?inventario=1`, 30/09/2026)

El inventario no dice qué estaciones tienen datos recientes; hay que pasar `node scripts/estaciones-aemet.mjs sonda …` antes de dar de alta. (`scripts/estaciones-aemet.mjs` busca la clave en `js/supabase.js`, pero ahora está en `js/config.js`; para esta consulta usé un script propio en la carpeta temporal y no toqué el repo.) Distancia y desnivel respecto a cada punto:

| Punto | Estaciones cercanas (indicativo, nombre, altitud, km, desnivel) |
|---|---|
| P1 Hontoria | `2298` Palacios de la Sierra, 1080 m, 7,8 km, -80 m (ya está en `soria`); `2084Y` Ucero (Soria), 960 m, 20,2 km; `2106B` Coruña del Conde, 955 m, 25,7 km; `2302N` Monterrubio de la Demanda, 1197 m, 28,7 km |
| P2 Palacios | `2298` Palacios de la Sierra, 1080 m, 6,1 km, -191 m; `2302N` Monterrubio de la Demanda, 1197 m, 16,5 km, -74 m; `2005Y` Vinuesa, Quintanarejo (Soria), 1197 m, 24,9 km |
| P2b Neila | `2302N`, 1197 m, 9,8 km, -508 m (supera el umbral de 400 m del repo); `2298`, 12,7 km, -625 m; `9115X` Valdezcaray (La Rioja), 1630 m, 22,8 km, -75 m |
| P3 Monte Agudo | `2302N`, 14,8 km, -281 m; `9115X` Valdezcaray, 15,3 km, +152 m; `9111` Belorado, 820 m, 16,3 km, -658 m |
| P4 La Umbría | `2302N` Monterrubio de la Demanda, 1197 m, **3,0 km**, -169 m; `9115X`, 15,2 km, +264 m |
| P5 Cerneja | `1089U` Ramales de la Victoria (Cantabria), 80 m, 14,4 km, -951 m (no sirve); `1103X` San Roque de Riomiera (Cantabria), 849 m, 22 km, -182 m; `9051` Medina de Pomar, 580 m, 23 km, -451 m; `1078C` Balmaseda (Bizkaia), 210 m, 23,3 km |

Otras estaciones AEMET en Burgos y alrededores: `2311Y` Villamayor de los Montes (884 m), `2331` Burgos Aeropuerto (891 m), `2285B` Villadiego (869 m), `9031C` Briviesca (730 m), `9069C` Miranda de Ebro (460 m), `9027X` Sargentes de la Lora (1017 m), `9012E` Santa Gadea de Alfoz (915 m), `9060X` Lalastra (Álava, 910 m). **Recomendación:** para `burgos-pinares` y `burgos-demanda` usar `2298` y `2302N`; para `burgos-merindades` AEMET no tiene estación en la zona de La Engaña, el valle de Mena o Espinosa; el dato más útil son los pluviómetros SAIH del Ebro P058 (Espinosa) y P074 (Lunada), que no son AEMET y no caben en `estacionesAemet`. Con `9051` Medina de Pomar (580 m) el desnivel supera el umbral del repo: **hay que aceptar una aproximación o dejar `burgos-merindades` sin estación AEMET fiable [NO VERIFICADO el dato de la estación].**

---

## 5. Especies destacadas de la zona (según las fuentes)

Época según Micocyl por acotado (https://www.micocyl.es/print/areas/montes-de-oca y /valle-de-mena; para Demanda, https://www.micocyl.es/areas/demanda-san-millan, 30/09/2026):

| Especie (id del repo) | Meses | Dónde destaca | Fuentes |
|---|---|---|---|
| Perretxico, lansarón (`calocybe-gambosa`) | abr-may (Demanda abr-jun) | Praderas de montaña: Mena, Oca, Demanda, Merindades; el coto de La Engaña le pone cupo propio (2 kg/día recreativo) | Micocyl; micologiamerindadesnorte.es; parte 11/04/2025; Burgos Conecta 28/04/2025 |
| Marzuelo (`hygrophorus-marzuolus`) | feb-abr | Umbrías de pinar de silvestre de Pinares (Quintanar, Regumiel, Vilviestre, Palacios, Hontoria, Rabanera, Neila, Pinilla, Huerta de Arriba, Valdelaguna); Bozoó | cotosdesetas 6/04/2018; Micocyl; ficha Bozoó |
| Colmenilla (`morchella`) | abr-may | Bosques maduros, vaguadas (Micocyl); primeras en Soria, Burgos y Segovia en abril de 2025 | Micocyl; parte 11/04/2025 |
| Hongo blanco (`boletus-edulis`) | sept-nov | Pinares de Pinares y Demanda, hayedos; 173 kg incautados en octubre de 2015; 1,5 kg/ha en septiembre de 2024 | Micocyl; agronews 7/10/2015; Burgos Conecta 27/09/2024 |
| Hongo de verano (`boletus-aereus`) | jun-sept | Oca, Mena, Demanda | Micocyl |
| Hongo rojo (`boletus-pinophilus`) | mayo-jun y oct-nov | Bosques maduros en laderas y cumbres | Micocyl; Burgos Conecta 28/04/2025 |
| Níscalo (`lactarius-deliciosus`) | sept-dic | Pinares (Pinares Sur, Demanda, Oca, Mena); el parte de Micocyl separa níscalo en pinar de pinaster del hongo en silvestre | Micocyl; parte 28/10/2024 |
| Llanega (`hygrophorus-latitabundus`, Hygrophorus sp.) | oct-nov | Oca, Mena, Demanda | Micocyl |
| Capuchina (`tricholoma-portentosum`) | nov-dic (Fresneda: ene) | Oca, Mena, Demanda | Micocyl; parte 21/11/2024 |
| Senderilla (`marasmius-oreades`), seta de cardo (`pleurotus-eryngii`) | may-jun y oct-nov | Praderas (Oca, Mena, Demanda) | Micocyl; parte 28/10/2024 |
| Rebozuelo (`cantharellus-cibarius`), angula de monte (`craterellus-lutescens`/`cantharellus lutescens`) | jun-nov; angula desde finales de octubre | Oca, Mena, Demanda; Pinares | Micocyl; partes 28/10/2024 y 21/11/2024 |
| Oronja (`amanita-caesarea`) | jul y sept-oct | Mena, Oca, Demanda; Demanda Suroeste; Canicosa | Micocyl; cotosdesetas; Canicosa |
| Lengua de vaca (`hydnum-repandum`), seta de brezo (`clitocybe-nebularis`), parasol (`macrolepiota-procera`), barbuda (`coprinus-comatus`), pie azul (`collybia-nuda`) | oct-nov | Acotados de Burgos | parte 28/10/2024; burgos.es Ruta de las Setas |
| Suillus luteus (`suillus-luteus`) | otoño | Pinar de Rabanera del Pinar (abundante) | Terranostrum [RESUMEN AUTOMÁTICO] |

**Conteo de GBIF** (registros con coordenadas dentro del bbox propuesto, 30/09/2026; los conteos son **muy bajos** porque GBIF apenas tiene datos de hongos de Burgos, por lo que solo sirven para marcar «orientativa» y no «confirmada»): Pinares: Lactarius deliciosus 4, Suillus luteus 3, Hydnum repandum 3, Coprinus comatus 3, Tricholoma terreum 3; Boletus edulis 0; Hygrophorus marzuolus 0. Demanda: Tricholoma portentosum 7, Macrolepiota procera 10, Calocybe gambosa 5, Coprinus comatus 5, L. deliciosus 3, Marasmius oreades 3, B. edulis 2. Merindades: Cantharellus cibarius 16, Macrolepiota procera 16, Coprinus comatus 16, Hydnum repandum 14, Marasmius oreades 12, N. erythropus 9, Craterellus lutescens 8, B. edulis 7, B. aereus 6, L. deliciosus 6. Fallaron por límite de la API `amanita-caesarea` en Pinares y `calocybe-gambosa` en Merindades (None en el recuento). Si se regenera `node scripts/gbif-presencia.mjs --zona=burgos-pinares,burgos-demanda,burgos-merindades`, saldrá lo mismo o más.

---

## 6. Qué haría falta para cerrarlo (pendientes)

1. **Decidir zonas y bbox** (apartado 1) y recortar `soria` si se adopta.
2. **Preguntar a Micocyl** si `PMBU-50010/20/40/50` son los acotados BU-50015/17/19/73 y por qué no están en la capa (micocyl@micocyl.es, 975 23 96 70).
3. **Confirmar con los ayuntamientos** el régimen actual de Quintanar, Palacios, Neila, Vilviestre, Huerta de Arriba y Rabanera (teléfonos en 2.3k).
4. **Leer el PORN/PRUG** del Parque Natural Lagunas Glaciares de Neila y el de Montes Obarenes-San Zadornil.
5. **Abrir los PDF que no se pudieron leer:** el folleto «Bureba-Ebro» de turismoburgos.org (Obarenes) y «Agalsa-Asopiva» (Pinares y Demanda).
6. **Comprobar las estaciones AEMET** con el script `sonda` antes de darlas de alta.
7. **Reddit y Diario de Burgos** siguen sin consultarse.

## 7. Fuentes principales (todas consultadas el 2026-09-30 salvo indicación)

- Portal oficial: https://micologiacyl.es/areas (lista), https://micologiacyl.es/expedicion-de-permisos-micologicos, https://permisos.micologiacyl.es/acotado/…
- Micocyl: https://www.micocyl.es/areas/demanda-san-millan, https://www.micocyl.es/print/areas/{montes-de-oca, valle-de-mena, fresneda-de-la-sierra-tiron-bu-50073, demanda-san-millan, san-zadornil-bu-50003}; partes micológicos 28/10/2024, 21/11/2024 y 11/04/2025; folletos de Oca y Demanda (2024); díptico de Canicosa (2024); calendario de cacerías 2026.
- Coto La Engaña: https://micologiamerindadesnorte.es (permisos, áreas reguladas, condiciones); BOPBUR nº 45 de 4/03/2024.
- Cotos con web: https://cotosdesetas.es (Pinares Sur, Demanda Suroeste, Bozoó, marzuelos 6/04/2018).
- Prensa: Burgos Conecta (18/10/2023, 15/12/2023, 27/09/2024, 12/04/2025, 28/04/2025, 01/11/2025, 21/11/2025), El Correo de Burgos (26/04/2013, 25/09/2016, 28/10/2024, 01/11/2025), agronewscastillayleon.com (07/10/2015), tuvozenpinares.com (13/10/2018).
- Foros: Foro Micológico 21061 (2013) y 11855 (2011); Fungipedia 280 (27/10/2009), 21462 (30/10/2011) y 67982 (24/09/2015); Forocoches 3422306 (2013) y 3008509 (2012, sin setas).
- Turismo: Terranostrum (Burgos destino micológico, Rabanera, Hontoria), burgos.es «Ruta de las Setas», tuscasasrurales (18/11/2022), ubu.es/node/94550 (26/11/2023).
- Capas propias: IDECyL `montes_cyl_mup_vw` y `gesfor_cyl_tipmas`; ENP 2025 del MITECO; PNOA del IGN; inventario AEMET; Open-Meteo (elevación); GBIF.

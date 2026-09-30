# 01 · Normativa y cotos de setas 2026: 8 zonas desde Madrid

Investigación hecha el **30/09/2026**. Cada dato lleva su fuente. Uso estas marcas:
- **[VERIFICADO HOY]**: lo he comprobado hoy directamente (página oficial en vivo, servicio GIS consultado o PDF del boletín leído).
- **[NO VERIFICADO]**: no he podido confirmarlo en una fuente primaria, o la fuente está desactualizada.
- *(fuente secundaria)*: prensa o blog; sirve de orientación, no de norma.

> Aviso general. Casi todos los precios y cupos dependen de **ordenanzas municipales o del titular del coto**, y se revisan cada año. Antes de cada salida, consulta el portal de permisos del coto concreto.

---

## 0. Resumen rápido por zona

| # | Zona | Norma marco | ¿Permiso? | Cupo recreativo típico | Cartografía descargable |
|---|------|-------------|-----------|------------------------|-------------------------|
| 1 | Guadarrama (vertiente de Madrid) | PRUG del Parque Nacional (Decreto 18/2020 de la Comunidad de Madrid, art. 59) + ordenanzas municipales | **Sí**, dentro del Parque Nacional: licencia municipal (Rascafría, Lozoya, Miraflores, Manzanares, Soto del Real…). Sin plan de aprovechamiento no se puede recoger | 10 kg/día (ordenanzas de 2020-2021); **5 kg/día en Soto del Real desde 2024** | Zonificación del PRUG: WFS del OAPN (verificado); montes de utilidad pública: MITECO |
| 1 | Guadarrama (Segovia) y Valsaín | Decreto 31/2017 de Castilla y León + PRUG CyL (Decreto 16/2019) + Orden AAA/1681/2016 (Valsaín) | **Sí** (acotados SG-50001 Valsaín, SG-50002 y SG-50005) | 5 kg/día | **WFS/GeoJSON de IDECyL (verificado)** |
| 2 | Sierra Norte de Madrid y Ayllón/Riaza | Ordenanzas municipales en Madrid; Decreto 31/2017 en Segovia | Madrid: Bustarviejo, Canencia, Miraflores. Segovia: acotado "Montes de Segovia" (Riaza, Ayllón…) | Madrid 10 kg; Segovia 5 kg | IDECyL (Segovia) |
| 3 | Soria | Decreto 31/2017 | **Sí** en el Parque Micológico "Montes de Soria" (PMSO-50001, incluye Pinar Grande), en SO-50002 y SO-50003, y en otros acotados | 5 kg/día | IDECyL + PDF de Montes de Soria |
| 4 | Gredos y Tiétar (Ávila) | Decreto 31/2017 | **Sí** en AV-50003 "Gredos", AV-50006 y otros acotados | 5 kg/día | IDECyL |
| 5 | Serranía de Cuenca | Orden de 15/11/2016 de Castilla-La Mancha + ordenanzas municipales | Solo en los municipios que tienen ordenanza (p. ej. Tragacete, La Huérguina). Fuera de ellas, recogida libre con límite | Libre: 5 kg o 10 L al día; en cotos, 5–7 kg | **No he encontrado cartografía de cotos** |
| 6 | Guadalajara (Alto Tajo y Sierra Norte) | Orden de 15/11/2016 + ordenanzas | Mancomunidad La Sierra (17 municipios del Alto Tajo) y muchas ordenanzas municipales | 5 kg/día | **No he encontrado cartografía de cotos** |
| 7 | Montes de Toledo | Orden de 15/11/2016 | No he encontrado cotos municipales. Predomina la finca privada | 5 kg o 10 L al día | No |
| 8 | Álava | Decreto Foral 89/2008 | Libre hasta 2 kg/día, salvo en terrenos acotados: Asparrena-Apota (Entzia), Arraia (Izki), Sierra de Árcena, Gordoa y Legutio | 2 kg/día | Solo planos en PDF/JPG. **No hay capa GIS de cotos** |

---

## 1. Marco estatal (vale para todas las zonas)

- **Ley 43/2003, de 21 de noviembre, de Montes.** Las setas son un aprovechamiento forestal (art. 6) y pertenecen al titular del monte (art. 36). https://www.boe.es/eli/es/l/2003/11/21/43/con
  - **Sanciones (art. 74)** [VERIFICADO HOY]: leves de 100 a 1.000 €, graves de 1.001 a 100.000 € y muy graves de 100.001 a 1.000.000 €. Castilla y León se remite a este artículo (Ley 3/2009, art. 116).
- **Real Decreto 30/2009.** Condiciones sanitarias para comercializar setas; su anexo A enumera las especies comercializables, y a él se remiten Valsaín y los acotados de CyL. https://www.boe.es/eli/es/rd/2009/01/16/30/con
- **Montes de Utilidad Pública (MUP) de toda España, como capa base para saber qué monte es público.** MITECO, Inventario Español del Patrimonio Forestal (IEPF), Catálogo de MUP:
  - GeoJSON [VERIFICADO HOY: HTTP 200, 329 MB, última modificación 25/06/2025]: https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/iepf/IEPF_CMUP_GeoJson.zip
  - SHP: https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/iepf/IEPF_CMUP_Shp.zip
  - KMZ: https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/iepf/IEPF_CMUP.kmz
  - Página de descargas: https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/iepf_descargas.html
  - WMS `https://wms.mapama.gob.es/sig/Biodiversidad/PropiedadMontes_UP/wms.aspx`: **hoy devuelve un error del servidor (NullReferenceException)**, así que no he podido verificarlo.

---

## 2. Castilla y León: normas comunes (Segovia, Soria y Ávila)

### 2.1 Decreto 31/2017, de 5 de octubre, que regula el Recurso Micológico Silvestre de Castilla y León

- BOCyL n.º 194, de 9/10/2017: http://bocyl.jcyl.es/boletines/2017/10/09/pdf/BOCYL-D-09102017-1.pdf [VERIFICADO HOY: he leído el texto del PDF]

**Tipos de terreno (art. 13):**
- **Regulado (acotado o parque micológico):** hace falta permiso del titular.
- **Reservado:** señalizado por el titular; nadie más puede recoger.
- **Episódico:** terreno ni acotado ni reservado. No requiere permiso, no se puede comercializar y el **máximo es de 3 kg por persona y día** (art. 13.5). Tampoco se pueden recoger trufas.
- **Vedado:** recogida prohibida para todos por resolución de la Dirección General.

**Montes catalogados acotados (art. 18.3):** siempre debe haber permisos de acceso público. **Los permisos recreativos dan derecho, como máximo, a 5 kg por persona y día.**

**Prácticas prohibidas (art. 8.2):**
- remover el suelo o levantar el mantillo;
- **usar o llevar encima hoces, rastrillos, escardillos, azadas** o herramientas parecidas;
- **recoger de noche, "desde el ocaso hasta el orto"**;
- recoger ejemplares por debajo de la talla mínima, o pasados;
- arrancar especies no recolectables;
- recoger en la franja de dominio público de las carreteras o en la de servidumbre del ferrocarril;
- **usar cubos, bolsas de plástico** u otros recipientes no porosos.

**Obligaciones (art. 8.3):**
- recipientes rígidos o semirrígidos y porosos;
- dejar el terreno como estaba.

Según micologiacyl.es, las **únicas herramientas de corte admitidas son cuchillo, navaja o tijera con hoja de menos de 11 cm**, y hay que llevar DNI y permiso. https://micologiacyl.es/tipos-de-aprovechamiento-micologico-0 [VERIFICADO HOY]

**Sanciones (art. 32):**
- Se remite a la Ley 3/2009 de Montes de CyL (arts. 113.d, e y l) y esta, a su vez, a la Ley 43/2003, art. 74 (100 € a 1 M€).
- Recoger **cualquier cantidad** en un monte catalogado acotado **sin licencia** es infracción (art. 32.3).
- En un monte catalogado no acotado, es infracción superar los 3 kg sin licencia (art. 32.2).
- Además caben la incautación y el decomiso (art. 33).
- Ley 3/2009: https://www.boe.es/eli/es-cl/l/2009/04/06/3/con

### 2.2 Portales oficiales

- **Micología CyL** (Junta de CyL y Cesefor): https://micologiacyl.es/
  - Lista de acotados: https://micologiacyl.es/acotados
  - Visor: https://micologiacyl.es/visor
  - Permisos: https://micologiacyl.es/expedicion-de-permisos-micologicos
- **Portal de expedición de permisos:** https://permisos.micologiacyl.es/acotado/<nombre>. El antiguo `permisos.micocyl.es` redirige aquí.
- **Micocyl** (fichas de producción de cada área): https://www.micocyl.es/
- **Normativa recopilada:** https://micologiacyl.es/legislacion
- **Red de Parques Micológicos** declarados, según https://micologiacyl.es/red-de-parques-micologicos-0 [VERIFICADO HOY]: solo figuran cuatro, PMSA-50001 (Salamanca), **PMSO-50001 "Montes de Soria"**, PMZA-50001 (Zamora) y PMPA-50001 (Velilla del Río Carrión, Palencia). Ninguno está en Ávila ni en Segovia.

### 2.3 Cartografía descargable de CyL (la mejor de las 8 zonas) [VERIFICADO HOY]

**Capa "Micología CyL: zonas reguladas"** (IDECyL). Actualización diaria. Licencia de uso libre citando a la "Junta de Castilla y León"; sin validez jurídica.
- Metadatos: https://idecyl.jcyl.es/geonetwork/docs/api/records/SPAGOBCYLMNADTSAMMZR
- **WFS** (lo he consultado hoy: 247 polígonos). Capa: `mico:mico_cyl_zonas_reguladas_peri`.
  - Capabilities: `https://idecyl.jcyl.es/geoapps/mico/wfs?service=WFS&version=2.0.0&request=GetCapabilities`
  - **GeoJSON en WGS84 (funciona):** `https://idecyl.jcyl.es/geoapps/mico/wfs?service=WFS&version=1.1.0&request=GetFeature&typename=mico:mico_cyl_zonas_reguladas_peri&srsName=EPSG:4326&outputFormat=application/json` (unos 37 MB)
  - SHP (zip): `https://idecyl.jcyl.es/geoapps/mico/wfs?service=WFS&version=1.1.0&request=GetFeature&typename=mico:mico_cyl_zonas_reguladas_peri&srsName=EPSG:25830&outputFormat=shape-zip`
  - GeoPackage: el mismo enlace con `outputFormat=gpkg`.
  - Atributos: solo `c_clave_id` (p. ej. SG-50002), `n_tip_terreno` (Acotado/Parque) y `n_estado`. **La capa no trae el nombre**: hay que cruzar la clave con la lista de https://micologiacyl.es/acotados.
- **WMS:** `https://idecyl.jcyl.es/geoapps/mico/wms`, capa `mico:mico_cyl_zonas_reguladas_peri`. Visor: https://idecyl.jcyl.es/vcig/?service=https://idecyl.jcyl.es/geoapps/mico/wms&layer=mico:mico_cyl_zonas_reguladas_peri
- **Réplica en Cesefor**, la que usa el visor de micologiacyl, con los mismos 247 registros: WFS `https://vps24geoserver.cesefor.com/geoserver/micologiacyl/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=mico_cyl_zonas_reguladas&outputFormat=application/json` y WMS `https://vps24geoserver.cesefor.com/geoserver/micologiacyl/wms`.
- **Copia local descargada hoy:** `investigacion/datos/cyl_zonas_micologicas_reguladas_EPSG4326_20260930.geojson`

**⚠ Discrepancia detectada hoy entre la capa y los portales:**
- Los acotados **SG-50002 "Montes de Segovia"** y **AV-50006 "Montes de la Comunidad de CyL en Ávila"** tienen ficha y venta de permisos, pero **no aparecen en el WFS**.
- En cambio, el WFS trae polígonos de tipo "Parque" con claves que no figuran en la lista oficial de parques: **PMSG-50001** (unas 37.974 ha, cubre Riaza, Ayllón, Navafría y El Espinar), **PMSG-50015** (unas 9.958 ha), **PMAV-50009** (unas 11.483 ha, norte de Gredos, Navarredonda y Peguerinos), **PMAV-50010** (unas 14.834 ha, **Valle del Tiétar**: Candeleda, Arenas de San Pedro y Guisando) y **PMSO-50010** (unas 6.429 ha).
- Mi hipótesis es que PMSG-50001 es la geometría de "Montes de Segovia", que declara 40.500 ha en su ficha, en proceso de pasar a parque micológico. **[NO VERIFICADO]**: ni el nombre ni el estado de estos PM* los he encontrado en ninguna página oficial.

**Otras capas útiles:**
- Espacios naturales de CyL: WMS `https://idecyl.jcyl.es/geoserver/espaciosnaturales/wms`, capa `espaciosnaturales:en_cyl_ren_limites_vw` (sale del código del visor de micologiacyl).
- **PRUG de Guadarrama en CyL:** metadatos en https://idecyl.jcyl.es/geonetwork/srv/api/records/SPAGOBCYLMNADTSAMPNG. **Los enlaces de descarga `opendata.jcyl.es/.../am.ren_cyl_pnsg_prug_shp.zip` y `.../gpkg.zip` devuelven hoy "Bad Request"**, y la capa `PRUG_PN_Guadarrama` no aparece en el GetCapabilities de `idecyl.jcyl.es/geoserver/am/wms`. **Usa en su lugar el WFS del OAPN** (apartado 3.3).

---

## 3. Zona 1: Sierra de Guadarrama (vertientes de Madrid y Segovia, Valsaín y Parque Nacional)

### 3.1 Parque Nacional Sierra de Guadarrama: prohibiciones (vale para las dos vertientes)

**PRUG de la Comunidad de Madrid:** Decreto 18/2020, de 11 de febrero (BOCM n.º 51, 29/02/2020). https://www.comunidad.madrid/transparencia/sites/default/files/regulation/documents/bocm_cm_d_18_2020.pdf [VERIFICADO HOY: he leído el art. 59.b]

- La recogida de setas es una **actividad tradicional compatible "para uso propio"**.
- **Prohibida en las Zonas de Reserva y en las Zonas de Uso Restringido tipo A.**
- **Zonas de Uso Restringido tipo B:** solo en la **temporada de otoño**.
- **Zonas de Uso Restringido tipo C y de Uso Moderado:** todo el año.
- Requiere autorización de la propiedad. **"Prohibida la recolección episódica"**, así que en el Parque siempre hace falta permiso.
- **Todo terreno donde se recoja debe tener un plan de aprovechamientos aprobado.**
- Solo los empadronados en el Área de Influencia Socioeconómica pueden comercializar.
- La Administración gestora puede fijar precio, especies, cuantías y número de permisos por día y hectárea.

**PRUG de Castilla y León:** Decreto 16/2019, de 23 de mayo (BOCyL 24/05/2019). http://bocyl.jcyl.es/boletines/2019/05/24/pdf/BOCYL-D-24052019-1.pdf. Tiene el mismo esquema según las fuentes secundarias. **[NO VERIFICADO: no he leído el texto literal del PRUG de CyL]**

**Sanción en el Parque Nacional:** según la Comunidad de Madrid, recoger sin permiso en las zonas reguladas del Parque es **infracción muy grave, con multa de 1.001 a 3.000 €** *(dato tomado del resumen de búsqueda de la nota de prensa del 14/10/2023; en el PDF de esa nota que leí no aparece esta cifra → [NO VERIFICADO])*. Las ordenanzas municipales sí lo recogen expresamente: leves hasta 100 €, graves de 101 a 1.000 € y muy graves de 1.001 a 3.000 € (Rascafría, art. 12; Manzanares, art. 13; Lozoya, art. 13) [VERIFICADO HOY].

### 3.2 Vertiente de Madrid: ordenanzas municipales

**Marco autonómico de Madrid.** No existe un decreto micológico autonómico. La Comunidad cita la Ley 43/2003, la **Ley 16/1995 Forestal y de Protección de la Naturaleza de la Comunidad de Madrid** y la **Orden de 27 de mayo de 1992**, que regula el uso socio-recreativo de los montes (nota del 2/11/2022: https://www.comunidad.madrid/node/64596). Pide recoger solo en montes públicos señalizados o con permiso del propietario.

**Municipios con licencia obligatoria según la Comunidad de Madrid** (nota del **23/10/2024**, https://www.comunidad.madrid/node/70372; PDF: https://www.comunidad.madrid/press-releases/download/81335) [VERIFICADO HOY]:
- dentro del Parque Nacional: **Rascafría, Miraflores de la Sierra y Lozoya**;
- fuera del Parque: **Bustarviejo y Canencia**.

Convenio de 21/11/2020 que autoriza la recogida en 7.286,70 ha del Parque en Rascafría: MUP autonómicos de **Morcuera (2.222,7 ha), El Pinganillo (1.160 ha) y Las Calderuelas (1.697 ha)**, más siete montes municipales (Los Robledos 929 ha, Dehesa Boyal y Arroturas 463 ha…). https://www.comunidad.madrid/node/58396 [VERIFICADO HOY]

| Municipio | Ordenanza (BOCM) | Cupos | Tasas | Estado |
|-----------|------------------|-------|-------|--------|
| **Rascafría** | BOCM 29/12/2020, n.º 316. https://www.bocm.es/boletin/CM_Orden_BOCM/2020/12/29/BOCM-20201229-58.PDF | Local recreativo 10 kg/día e intensivo 30 kg. Vinculado (empadronado en el Área de Influencia Socioeconómica) recreativo 10 kg; intensivo 10 kg de cardo/perrechico, 20 kg de boletus/níscalo y 30 kg en total. **Foráneo: solo recreativo, 10 kg/día, permiso de 1 o 2 días** | Temporada: local intensivo 25 €, local recreativo 3 €, vinculado intensivo 100 €, vinculado recreativo 15 €. **1 día: 3 € / 5 €; 2 días: 7 € / 10 €** (la tabla está mal maquetada; por la posición, los valores menores serían del vinculado recreativo y los mayores del **foráneo**) | Temporada del 15 de julio al 1 de julio. **Prohibido el rastrillo** (art. 4.5.b), **de noche** (art. 4.5.c), las bolsas de plástico y los grupos de más de 3 personas "en paralelo". Solo cuchillo, navaja o tijera de menos de 11 cm [VERIFICADO HOY] |
| **Lozoya** | BOCM 23/04/2021. https://bocm.es/boletin/CM_Orden_BOCM/2021/04/23/BOCM-20210423-57.PDF | Igual que Rascafría (10 kg recreativo) | Hay tabla; no la he transcrito | Nota: el anuncio cita por error "término municipal de Rascafría" [VERIFICADO HOY] |
| **Manzanares el Real** | BOCM 26/01/2021, ordenanza (n.º 57) y tasa (n.º 58). https://www.bocm.es/boletin/CM_Orden_BOCM/2021/01/26/BOCM-20210126-57.PDF · https://www.bocm.es/boletin/CM_Orden_BOCM/2021/01/26/BOCM-20210126-58.PDF | 10 kg recreativo | — | La Comunidad no la cita en su lista de 2024 [NO VERIFICADO si se aplica] |
| **Miraflores de la Sierra** | BOCM 15/01/2021 (n.º 45; tasa en el n.º 46) y modificación en BOCM 16/11/2022 (n.º 87). https://bocm.es/boletin/CM_Orden_BOCM/2021/01/15/BOCM-20210115-45.PDF · https://bocm.es/boletin/CM_Orden_BOCM/2022/11/16/BOCM-20221116-87.PDF | 10 kg recreativo | Tasas no transcritas [NO VERIFICADO] | |
| **Soto del Real** | Modificación en **BOCM 2/12/2024**, n.º 287. https://bocm.es/boletin/CM_Orden_BOCM/2024/12/02/BOCM-20241202-98.PDF | **Cambio reciente:** recreativo **5 kg/día** (local, vinculado y foráneo); intensivo 25 kg | Tasas no transcritas | [VERIFICADO HOY] |

**Hayedo de Montejo** (Montejo de la Sierra): solo se visita con guía y **no se permite recoger ningún elemento vegetal, setas incluidas** *(fuente secundaria; normas de visita de la Comunidad de Madrid en https://www.comunidad.madrid/node/6065)* [NO VERIFICADO el texto normativo].

### 3.3 Cartografía del Parque Nacional (zonificación del PRUG) [VERIFICADO HOY]

- **WFS del OAPN, zonificación del PRUG de todos los parques nacionales:**
  - `http://sigred.oapn.es/geoserverOAPN/ZonificacionPRUG/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ZonificacionPRUG:view_zon_zonificacion_prug&outputFormat=application/json&srsName=EPSG:4326`
  - Atributos: "Nombre Parque", "Zona", "Subzona PRUG", "Normativa" y "Superficie (ha)".
  - Guadarrama tiene **14 polígonos de Zona de Reserva y 18 de Uso Restringido A** (setas prohibidas), 23 de Uso Restringido B (solo otoño), 15 de Uso Restringido C, 33 de Uso Moderado y 59 de Uso Especial.
  - WMS: `http://sigred.oapn.es/geoserverOAPN/ZonificacionPRUG/wms`, capas `view_zon_zonificacion_prug` y `PRUG_visor`.
  - Copia local: `investigacion/datos/oapn_zonificacion_prug_ppnn_EPSG4326_20260930.geojson`
- **Límites del Parque Nacional e incluso el Área de Especial Protección** (MITECO, actualización de febrero de 2023): https://www.miteco.gob.es/content/dam/miteco/es/parques-nacionales-oapn/red-parques-nacionales/sig/pn_sierra_guadarrama_tcm30-63594.rar (RAR con SHP; HTTP 200). WMS `http://sigred.oapn.es/geoserverOAPN/LimitesParquesNacionalesZPP/wms?`. Página: https://www.miteco.gob.es/es/parques-nacionales-oapn/red-parques-nacionales/sig/sig-descargas.html
- **No hay capa de los montes con licencia municipal de Madrid.** Se pueden aproximar con los MUP del MITECO (apartado 1) y los nombres de monte de cada ordenanza.

### 3.4 Vertiente de Segovia (Decreto 31/2017)

**SG-50001 "Valsaín"** (titular: Centro de Montes de Valsaín, OAPN). Está en el WFS de IDECyL.
- **Norma específica:** Orden AAA/1681/2016, de 20 de octubre (BOE n.º 256, 22/10/2016). https://www.boe.es/buscar/act.php?id=BOE-A-2016-9680 [VERIFICADO HOY]
- **Ámbito:** MUP n.º 1 y 2 "Matas" y "Pinar de Valsaín", 10.668 ha: 3.326 ha dentro del Parque Nacional y 7.011 ha en su Zona Periférica de Protección.
- **Excluida la zona entre el Arroyo del Telégrafo, la cumbrera de Siete Picos y el Camino Schmidt**, más las exclusiones que marque el PRUG.
- **Permisos:**
  - recreativo 5 kg/día;
  - "intensivo local" 25 kg/día, solo para empadronados en el Real Sitio de San Ildefonso;
  - **foráneo: diario 10 € y fin de semana 15 €** (solo recreativo);
  - temporada: local 3 € (recreativo) o 25 € (intensivo), vinculado 5 € y provincial 15 €.
- **Condiciones:**
  - prohibido llevar rastrillos, hoces o azadas;
  - prohibido de noche;
  - **prohibido comercializar dentro de Valsaín**;
  - acceso al monte **a pie**;
  - obligatorio cortar el pie con navaja en níscalo, cardo, llanegas, negrillas y capuchinas;
  - tamaños mínimos: Boletus 4 cm y el resto 2 cm.
- **Borrador de nueva orden (MITECO, 09/2022):** https://www.miteco.gob.es/content/dam/miteco/images/es/borradorordenaprovmicologicov01-09-22_tcm30-545719.pdf
  - Cambiaría los precios: diario 5 € y 2 días 8 € para foráneos, provinciales y vinculados; temporada local recreativo 5 €, local intensivo 25 €, vinculado 10 € y provincial 20 €.
  - Se remitiría al Decreto 31/2017.
  - **[NO VERIFICADO] si se llegó a aprobar**: no he encontrado ninguna orden posterior en el BOE, así que **la orden de 2016 sigue siendo la publicada**.
- **Dónde se saca el permiso:**
  - Centro de Visitantes Boca del Asno (Ctra. CL-601, km 14,3; tel. 921 12 00 13; bocadelasno@oapn.es);
  - Centro Montes y Aserradero de Valsaín (C/ Primera 11, La Pradera; tel. 921 47 00 37; cmvalsain@oapn.es).
  - *(fuente: resumen de búsqueda del folleto de MITECO setas-2017, https://www.miteco.gob.es/content/dam/miteco/es/parques-nacionales-oapn/centros-fincas/valsain/setas-2017_tcm30-432288.pdf; [NO VERIFICADO] que siga vigente en 2026).*
  - **Valsaín no está en el portal de permisos de micologiacyl.**

**SG-50002 "Montes de Segovia"** (Ayuntamiento de Segovia y otros; unas 40.500 ha).
- Precios en el portal oficial [VERIFICADO HOY en https://permisos.micologiacyl.es/acotado/montes-de-segovia]:

  | Recolector | Diario | Dos días | Temporada recreativo | Temporada comercial |
  |------------|--------|----------|----------------------|---------------------|
  | **Tarifa general (foráneo)** | **5 €** | **8 €** | **40 €** | 250 € |
  | Vinculado o provincial | 5 € | 8 € | 15 € | 70 € |
  | Local | 5 € | 8 € | 5 € | 25 € |

- **Cupos recreativos:** 5 kg/día de boletus, níscalo y el resto; **3 kg/día de cardo y perrechico**. Comercial: 50 kg, o 10 kg de cardo y perrechico. Fuente: ficha https://www.micocyl.es/print/areas/montes-de-segovia (la ficha menciona una temporada "hasta 31-12-2023", así que el texto no está al día).
- **Municipios incluidos, que pagan tarifa local:** Aldealengua de Pedraza, **Ayllón**, Boceguillas, Casla, Cerezo de Abajo y de Arriba, El Espinar, Matabuena, **Navafría**, Prádena, **Riaza**, Riofrío de Riaza, Santo Tomé del Puerto, entre otros. También las Comunidades de Villa y Tierra de Pedraza, Sepúlveda, Fresno de Cantespino y la de Segovia.
- **Reconocimiento mutuo** con SG-50005. Fuente: https://micologiacyl.es/expedicion-de-permisos-micologicos

**SG-50005 "Montes de la Comunidad de Castilla y León en Segovia"** (Junta; 9.325 ha). Tarifa general: diario 5 €, 2 días 8 €, temporada recreativa 40 € y comercial 250 € [VERIFICADO HOY en https://permisos.micologiacyl.es/acotado/montes-comunidad-castilla-y-leon-en-segovia]. Cupos iguales a SG-50002.

**Otros acotados de Segovia en la lista oficial** (https://micologiacyl.es/acotados; claves verificadas hoy en el WFS):
- SG-50003 Cerezo de Arriba (DS Smith Spain);
- SG-50004 Berrocal de Huebra (DS Smith);
- SG-50006 Acotado de Arcones;
- SG-50007 Aldeasoña;
- SG-50008 Coto de Samboal;
- SG-50009 Villaverde de Montejo y otros;
- SG-50010 Valdevacas de Montejo;
- SG-50011 **El Espinar**;
- SG-50012 Torrecaballeros;
- SG-50013 Maderuelo y Montejo (privado; no está en el WFS).

Cada uno tiene su propio permiso. **[NO VERIFICADO]**: precios y forma de sacar el permiso de estos acotados menores.

---

## 4. Zona 2: Sierra Norte de Madrid y Ayllón (Montejo, Somosierra, Riaza)

- **Parte de Madrid:**
  - Bustarviejo: BOCM 28/04/2021, n.º 72. https://bocm.es/boletin/CM_Orden_BOCM/2021/04/28/BOCM-20210428-72.PDF. Recreativo 10 kg/día y foráneo 10 kg.
  - Canencia: aprobación provisional en BOCM 14/09/2021. https://www.bocm.es/boletin/CM_Orden_BOCM/2021/09/14/BOCM-20210914-50.PDF
  - Ambos exigen licencia según la nota de la Comunidad de 23/10/2024 [VERIFICADO HOY].
  - **Montejo de la Sierra y Somosierra:** no he encontrado ordenanza micológica [NO VERIFICADO si existe]. En los MUP sin ordenanza vale la regla general de Madrid: montes públicos señalizados o permiso del propietario, sin cupo autonómico publicado.
  - Hayedo de Montejo: ver 3.2 (recogida no permitida).
- **Parte de Segovia (Riaza, Ayllón, Riofrío de Riaza…):** acotado **SG-50002 "Montes de Segovia"**, con precios en 3.4. En el WFS, esta zona aparece bajo el polígono **PMSG-50001** (ver 2.3).
- **Guadalajara, Sierra Norte (Cantalojas, Galve…):** ver zona 6.

---

## 5. Zona 3: Soria (Pinar Grande, Tierras Altas, Montes de Soria)

**Parque Micológico "Montes de Soria" (PMSO-50001).**
- Declarado por la **ORDEN FYM/1229/2021, de 11 de octubre**. Titular y gestor: Asociación Montes de Soria. Fuente: https://micologiacyl.es/parque/pmso-50001 [VERIFICADO HOY]
- Extensión: 127.909,88 ha, 84 propietarios, 64 municipios de Soria y 2 de Burgos. La asociación dice ahora gestionar más de 165.500 ha en 97 localidades.
- **Incluye el MUP n.º 172 "Pinar Grande"**, con el área singular "El Amogable", y unas 4.500 ha de los Parques Naturales **Laguna Negra y Circos Glaciares de Urbión** y **Cañón del Río Lobos**.
- Los permisos de Montes de Soria valen para el **PMSO-50001 y los acotados SO-50002 y SO-50003**. Fuente: https://asociacionmontesdesoria.com/permiso-de-recoleccion-de-setas/ (actualizada el 1/04/2026) [VERIFICADO HOY]
- **Tarifas 2026** [VERIFICADO HOY en la web de la asociación y en https://permisos.micologiacyl.es/acotado/montes-de-soria]:

  | Modalidad | Cupo | Duración | Precio |
  |-----------|------|----------|--------|
  | **General recreativo (foráneo)** | **5 kg/día** | **2 días consecutivos** | **10 €** (no hay temporada para foráneos) |
  | Local recreativo | 5 kg/día | Temporada (hasta el 31/12) | 3 € |
  | Local comercial | 30 kg/día | Temporada | 10 € |
  | Vinculado recreativo (IBI o alquiler de más de 1 año) | 5 kg/día | Temporada | 10 € |
  | Vinculado comercial | 30 kg/día | Temporada | 50 € |

- La web dice: "abierta la expedición de permisos válidos para la temporada 2026".
- **Mapa de zonas reguladas en PDF:** https://asociacionmontesdesoria.com/wp-content/uploads/2025/04/Zonas-Reguladas-Montes-Soria-2025.pdf. Es de 2025 y no lo he descargado.
- **Tierras Altas** (Villar del Río, Yanguas, San Pedro Manrique): según el cálculo espacial con el WFS, quedan dentro o a menos de 2 km de **PMSO-50001 y SO-50003**. Es decir, zona regulada con permiso de Montes de Soria o del acotado de la Junta [cálculo propio sobre el WFS; conviene confirmarlo en el PDF].

**Otros acotados de Soria** (lista oficial y WFS):
- **SO-50001 Acotado de Covaleda** (Ayuntamiento de Covaleda y asociación). Cubre **Covaleda, Duruelo y Vinuesa**. Tiene su propio permiso [NO VERIFICADO precio y web].
- SO-50002 "Montes de Soria".
- **SO-50003 "Montes de la Comunidad de Castilla y León en Soria"** (Junta). En el portal: tarifa general de 2 días o temporada, recreativo de 5 kg; **hoy aparece "Actualmente no existe ninguna tarifa disponible"** (https://permisos.micologiacyl.es/acotado/montes-comunidad-y-castilla-leon-en-soria), aunque los permisos de Montes de Soria valen aquí.
- SO-50004 La Póveda.
- SO-50005 Quinto de la Mata (privado).
- **SO-50007 Vinuesa** (DS Smith).
- SO-50008, 50009 y 50010 Arcos de Jalón.
- SO-50011 Aldehuela de Periáñez.
- SO-50012 Ágreda.
- SO-50013 Golmayo.
- SO-50014 Talveila.
- SO-50015 Cubo de la Solana.
- SO-50016 Velilla de la Sierra.
- SO-50017 Matamala de Almazán.
- SO-50018 Torrubia.
- SO-50019 El Royo.
- SO-50020 Pozalmuro.
- SO-50021 Osonilla y SO-50022 Oteruelos (no están en el WFS).
- **PMSO-50010**: "Parque" en el WFS, sin nombre oficial [NO VERIFICADO].

**Cartografía:** el WFS de IDECyL del apartado 2.3, más el PDF de Montes de Soria.

---

## 6. Zona 4: Gredos y Valle del Tiétar (Ávila)

**AV-50003 "Gredos"** (Ayuntamiento de Hoyos del Espino, Becedas y otros).
- 39.900,71 ha; máximo de 12.592 permisos. Producción actualizada el 1/04/2026. Ficha: https://www.micocyl.es/print/areas/gredos
- **Modalidades** según la ficha: local, vinculado, provincial y general; diario, 2 días y temporada; **recreativo 5 kg/día y comercial 50 kg/día**.
- **Precios de la ficha:** diario 5 €, 2 días 10 €; temporada recreativa general 30 €, local 5 €, vinculado 18 € y provincial 28 €; comercial general 150 €. **La ficha habla de la temporada "hasta 31/12/2021", así que los precios son antiguos [NO VERIFICADO para 2026].**
- **⚠ El portal oficial muestra HOY "Actualmente no existe ninguna tarifa disponible"** (https://permisos.micologiacyl.es/acotado/gredos). Puede que el permiso de 2026 aún no esté a la venta o que haya cambiado la gestión [NO VERIFICADO; conviene llamar a Micocyl: 975 23 96 70, micocyl@micocyl.es].
- **Reciprocidad:** el permiso recreativo de Gredos vale en AV-50006 y viceversa.

**AV-50006 "Montes de la Comunidad de Castilla y León en Ávila"** (7.477 ha).
- Tarifa general: **diario 5 €**, **temporada recreativa 30 €** y comercial 150 € [VERIFICADO HOY en https://permisos.micologiacyl.es/acotado/montes-comunidad-castilla-y-leon-en-avila].
- Ficha: https://www.micocyl.es/print/areas/av-50006
- No aparece en el WFS; ver la discrepancia de 2.3.

**Otros acotados de Ávila** (https://micologiacyl.es/acotados):
- **AV-50001 El Tiemblo**, con ordenanza municipal propia: https://sjdavojvyfjrggtiwfsg.supabase.co/storage/v1/object/public/documentos/ordenanzas/ordenanza-regulacion-aprovechamiento-micologico-recmJVtU1Jf4sYUd2.pdf (no la he analizado entera);
- AV-50002 Navarredonda de Gredos (no está en el WFS);
- AV-50004 Casillas;
- AV-50005 y AV-50007 Tornadizos de Ávila;
- AV-50008 (sin nombre en la lista);
- AV-50009 Peguerinos (no está en el WFS);
- AV-50010 Peñalba de Ávila.

**Valle del Tiétar (vertiente sur de Gredos):**
- **No he encontrado ningún acotado con nombre propio del Tiétar.**
- En el WFS, el polígono **PMAV-50010** (tipo "Parque", unas 14.834 ha) queda a menos de 1,3 km de Candeleda, Arenas de San Pedro y Guisando.
- AV-50003 llega a unos 1,2 km de Mombeltrán y a unos 3,7 km de Piedralaves.
- AV-50004 (Casillas) queda a unos 2 km de Sotillo de la Adrada.
- Todo esto es cálculo propio sobre el WFS. **[NO VERIFICADO]**: qué permiso rige en PMAV-50010/50009, porque no figuran en la Red oficial de Parques.
- **Fuera de los terrenos acotados** rige el aprovechamiento episódico: sin permiso, 3 kg/día y sin comercializar (Decreto 31/2017, art. 13.5).

**Cartografía:** el WFS de IDECyL del apartado 2.3.

---

## 7. Castilla-La Mancha: norma común (zonas 5, 6 y 7)

**Orden de 15/11/2016, de la Consejería de Agricultura, Medio Ambiente y Desarrollo Rural, por la que se regula la recolección de setas silvestres en los montes de Castilla-La Mancha.** DOCM n.º 226, de 21/11/2016; en vigor desde el 22/11/2016.
- Referencia: https://vlex.es/vid/orden-15-11-2016-774565357.
- **El PDF oficial que enlazaba la Junta (https://areasprotegidas.castillalamancha.es/sites/areasprotegidas.castillalamancha.es/files/documentos/legislacion/20230929/orden_de_setas_clm.pdf) da hoy error 404.** Borrador de 2016: https://castillalamancha.es/sites/default/files/documentos/pdf/20160819/borradorordensetasclm_2016_08_08_2016.pdf

**Contenido** (según el resumen de vLex, la prensa y las ordenanzas que la reproducen; **[NO VERIFICADO literal]**, porque no he podido leer el DOCM):
- **Recogida libre y episódica** para autoconsumo: **máximo de 5 kg o un volumen aparente de 10 litros por persona y día**, salvo que el plan del monte diga otra cosa (art. 3 según vLex).
- Las setas son del propietario del monte.
- Se prohíbe:
  - **recoger de noche**;
  - **rastrillar o remover el suelo** o el mantillo;
  - usar **bolsas o cubos de plástico** (obligatoria la cesta).
  - Solo se admiten cuchillo o navaja.
  - *(El Español / El Digital CLM, 25/10/2019: https://www.elespanol.com/eldigitalcastillalamancha/sociedad/20191025/arranca-temporada-setas-castilla-la-mancha-evitar-problemas/439457560_0.html)*
- Hay artículo propio para espacios protegidos y Red Natura (art. 8) y otro de régimen sancionador (art. 12). **[NO VERIFICADO]** su contenido.
- **Ley 3/2008**, de 12 de junio, de Montes y Gestión Forestal Sostenible de CLM: la citan las ordenanzas.

**Los cotos en CLM son municipales:** ordenanzas fiscales con tasa sobre los MUP de cada ayuntamiento, publicadas en el BOP de cada provincia.

**Cartografía en CLM:**
- **No he encontrado ninguna capa oficial de cotos ni acotados micológicos** en CLM.
- Solo están los MUP del MITECO (apartado 1) y el Portal de Mapas de CLM (hay que confirmar si publica una capa de MUP propia) [NO VERIFICADO].
- Las ordenanzas identifican el coto por número de MUP (p. ej. MUP 48 en La Huérguina, MUP 150 en Tragacete, MUP 205 en Torrecuadrada), así que **se puede construir la capa cruzando esos números con el GeoJSON de MUP del MITECO**.

---

## 8. Zona 5: Serranía de Cuenca

**Regla general:** fuera de los cotos, recogida libre hasta 5 kg o 10 L al día (Orden de 15/11/2016).

**Cotos municipales confirmados** (todos por prensa que cita el BOP de Cuenca; **el BOP de Cuenca no lo he consultado directamente**):

| Municipio | Monte | Tarifas | Cupos | Fuente |
|-----------|-------|---------|-------|--------|
| **Tragacete** | MUP 150 "La Fuenseca y otros", más las fincas Poyal y Vasallo | Vecinos (más de 6 meses empadronados) 5 €/año; "hijos de Tragacete" 5 €/año; **foráneos 5 €/día o 30 €/año**; ticket turístico de 1 €/día con consumo mínimo de 25 € en el pueblo | 5 kg/día; ticket turístico 2 kg/día | Voces de Cuenca, 08/09/2021: https://www.vocesdecuenca.com/provincia/serrania/tragacete-aprueba-una-tasa-para-la-recogida-de-hongos-de-5-euros-anuales-para-vecinos-y-30-para-foraneos/ · El Español, 12/09/2021: https://www.elespanol.com/eldigitalcastillalamancha/region/cuenca/20210912/pueblo-cuenca-limita-recoleccion-setas-euros-no/611439122_0.html |
| **La Huérguina** | MUP n.º 48 | Empadronados y oriundos 3 €/temporada; **resto de mayores de 16: 5 €/día y pase de temporada de 30 €**; máximo 100 pases al día | **7 kg por persona y día** | Voces de Cuenca, 30/08/2020: https://www.vocesdecuenca.com/provincia/serrania/la-huerguina-aprueba-una-ordenanza-municipal-para-prevenir-los-abusos-en-la-recogida-de-setas-y-hongos/ |

En La Huérguina se prohíben los rastrillos y las hoces, y la cesta es obligatoria (fuente: Voces de Cuenca, 30/08/2020).

- **Boniches** publicó un anuncio en el BOP de Cuenca en 2024: https://www.dipucuenca.es/documents/34525/1514036/29.pdf/7a0f6e25-97f9-18f2-403e-9d1fe66b1117?t=1725430278238. **[NO VERIFICADO] su contenido.**
- **Valdemeca, Beteta, Uña, Huélamo, Cuenca capital y Las Majadas:** una guía comercial (amivall.com) cita a Valdemeca como municipio con ordenanza, pero **[NO VERIFICADO]**. Tampoco he encontrado la regulación de los grandes MUP del Ayuntamiento de Cuenca.
- **Parque Natural de la Serranía de Cuenca:** no he encontrado reglas específicas sobre setas en su PORN o PRUG [NO VERIFICADO].
- **Cartografía:** no hay capa de cotos. Ver la propuesta de 7 (cruzar números de MUP con el GeoJSON del MITECO).

---

## 9. Zona 6: Guadalajara (Alto Tajo y Sierra Norte)

**Mancomunidad "La Sierra"** (Alto Tajo y Señorío de Molina). Página: https://sierraaltotajo.es/micoturismo/condiciones-permisos [VERIFICADO HOY]
- **17 municipios:** Adobes, Alcoroches, Alustante, Baños de Tajo, **Checa, Chequilla**, Megina, Motos, **Orea, Peralejos de las Truchas**, Pinilla de Molina, Piqueras, **Taravilla**, Terzaga, Tordellego, Tordesilos y Traid.
- **Precios:** turista **5 €/día, 7 €/fin de semana o 60 €/temporada**, siempre con **5 kg/día**. Vecinos 5 €/temporada; propietarios o arrendatarios 10 €; comercial 20 € (solo vecinos).
- **Temporada:** del 1 de septiembre al 31 de agosto.
- **Prohibido:** bolsas de plástico, **rastrillos, palas**, recoger **de noche** e ir en grupos de más de 3 personas.
- Menores de 14 años exentos, siempre acompañados.
- Permisos en los ayuntamientos, en comercios adheridos y en www.sierraaltotajo.es (tel. 949 836 266).
- **No ofrece mapas descargables.**

**Ordenanzas municipales en el BOP de Guadalajara** [VERIFICADO HOY; he leído los PDF]:

| Municipio | Publicación | Tarifas y cupos |
|-----------|-------------|-----------------|
| **Cobeta** (Alto Tajo) | BOP n.º 85, 06/05/2025. https://boletin.dguadalajara.es/boletin/pdf/pdf2025_1386.pdf | Recreativo 5 kg/día; intensivo local 25 kg. **Foráneo: solo 1 o 2 días**; la tabla indica 1 día 2/3 € y 2 días 3/5 € (maquetación ambigua; el valor mayor sería el del foráneo). Temporada del 15 de julio al 1 de julio. Prohibidos el rastrillo, la noche y los grupos de más de 3 personas; prohibido recoger en días de caza |
| **Rillo de Gallo** | BOP n.º 146, 03/08/2026 (**modificación provisional de julio de 2026**). https://boletin.dguadalajara.es/boletin/pdf/pdf2026_2086.pdf | Vecinos 10 €/año, vinculados 20 €/año, **foráneos 10 €/día**; 5 kg/día |
| **Herrería** | BOP n.º 146, 03/08/2026 (modificación provisional). https://boletin.dguadalajara.es/boletin/pdf/pdf2026_2077.pdf | Igual que Rillo de Gallo: **foráneo 10 €/día**, 5 kg |
| **Torrecuadrada de Molina** | BOP n.º 67, 10/04/2026. Coto en el MUP 205. https://boletin.dguadalajara.es/boletin/pdf/pdf2026_964.pdf | **Foráneo 25 €/día**, 5 kg; vinculados 1 €/año y 10 kg |
| **Arbancón** (Sierra Norte) | BOP n.º 8, 14/01/2026. https://boletin.dguadalajara.es/boletin/pdf/pdf2026_99.pdf | No residente: **5 €/día y 5 kg**; comercial 50 kg (100 o 200 €); multa de 100 a 1.000 € |
| **Arroyo de las Fraguas** (Sierra Norte) | BOP n.º 246, 27/12/2024. https://boletin.dguadalajara.es/boletin/pdf/pdf2024_4150.pdf | Foráneo **5 €/día, 20 € por 10 días o 50 €/año**, con 5 kg/día. Prohibido de noche, **en días de batida y durante los 5 días anteriores**, en una franja de 500 m. Rastrillos prohibidos. Sombrero mínimo de 4 cm (2 cm en rebozuelos y senderuela). Multa de 100 a 1.000 € |

- **Parque Natural del Alto Tajo:** su PRUG se aprobó por Orden de 4/04/2005 y se revisó el 22/04/2010. **Los PDF oficiales dan hoy error 404**, y **no he podido verificar si limita la recogida de setas** [NO VERIFICADO]. Ojo: un "3 kg en primavera / 10 kg en otoño" que aparece en buscadores viene de una ordenanza de Ansó (Aragón), **no del Alto Tajo**.
- **Parque Natural de la Sierra Norte de Guadalajara** (Cantalojas, Galve de Sorbe, Majaelrayo, Valverde de los Arroyos, Tamajón): **no he encontrado ordenanzas** [NO VERIFICADO]. Si no las hay, rige la regla general de CLM (5 kg o 10 L).
- **Cartografía:** no hay capa de cotos. Las ordenanzas citan los números de MUP; se pueden cruzar con los MUP del MITECO.

---

## 10. Zona 7: Montes de Toledo

- **Norma aplicable:** la Orden CLM de 15/11/2016. Recogida libre hasta 5 kg o 10 L al día en montes donde el titular no la prohíba, y siempre con **permiso del propietario** en fincas privadas.
- **No he encontrado ordenanzas micológicas** en Los Navalucillos, Los Yébenes, Navahermosa, Hontanar ni San Pablo de los Montes [NO VERIFICADO; el BOP de Toledo no lo he consultado directamente].
- En la comarca hay muchas **fincas privadas y cinegéticas**, así que hay que evitar las monterías.
- **Parque Nacional de Cabañeros** (Toledo y Ciudad Real): no he encontrado su regulación de setas [NO VERIFICADO]. Su zonificación está en el WFS del OAPN (3.3) si se filtra "Nombre Parque" = Cabañeros.
- **Cartografía:** los MUP del MITECO. No hay cotos.

---

## 11. Zona 8: Álava (Gorbeia, Montes de Vitoria, Izki, Valderejo, Entzia…)

**Decreto Foral 89/2008, del Consejo de Diputados de 14 de octubre**, que regula los aprovechamientos de hongos, plantas, flores y frutos silvestres (BOTHA n.º 121, 22/10/2008).
- PDF oficial: https://www.araba.eus/botha/Boletines/2008/121/2008_121_06859.pdf (enlazado desde la web de la Diputación; no lo he descargado).
- Desarrolla la **Norma Foral 11/2007, de 26 de marzo, de Montes**.
- Resumen oficial de la Diputación: https://web.araba.eus/es/montes/aprovechamiento-de-hongos-flores-y-frutos-silvestres [VERIFICADO HOY]:
  - **Libre hasta 2 kg por persona y día**, salvo en terreno acotado y señalizado.
  - La Diputación puede limitar días de recogida.
  - **Prohibido remover el suelo o arrancar**; solo **cuchillo o navaja**.
  - **Cesta** obligatoria; **prohibidas las bolsas de plástico y las mochilas**.
  - No se recogen ejemplares inmaduros ni pasados.
  - Con fines científicos, 3 ejemplares.
  - **Prohibido desde la puesta de sol hasta el amanecer.**
  - **Sanciones: 30 a 250 €**, más decomiso e indemnización.

**Terrenos acotados oficiales**, según esa misma página:

1. **Parque Micológico Asparrena-Apota** (Entzia y Aizkorri-Aratz): MUP 305, 306, 307, 311 y 632, más el Monte Alto de Ametzaga.
   - Web: http://www.asparrena.eus/ocio-y-turismo/parque-micologico-asparrena-san-millan
   - Extracto de la ordenanza: https://www.arabakolautada.eus/site_media/uploads/84160698391126867.pdf
   - Autorización del alcalde o de la entidad gestora (en el Museo del Mitxarro o Parketxe).
   - **2 kg/día**, todos los días, del amanecer a la puesta del sol.
   - Prohibido **llevar** rastrillos, ganchos u hoces "aunque no se estén utilizando".
   - Dentro del Parque Natural Aizkorri-Aratz rigen además su PORN y su PRUG. Régimen sancionador: Título VII de la Norma Foral 11/2007.
2. **Coto de setas de Arraia** (Arraia-Maeztu, **Izki**): https://www.arraia-maeztu.eus/servicios/coto-de-setas/
   - Convenio "Coto Arraia" en el BOTHA de 21/10/2016.
   - Plano en JPG: https://www.arraia-maeztu.eus/wp-content/uploads/2019/01/coto-setas-maeztu-17-03-29-Plano.jpg
3. **Consierra de Árcena** (entorno de Valderejo, Sobrón y Árcena): ordenanza en BOTHA n.º 146, 24/12/2014, https://www.araba.eus/botha/Boletines/2014/146/2014_146_05987_C.pdf
   - Plano orientativo en PDF: https://web.araba.eus/documents/1247685/1248298/Sierra+Arcena.pdf/affa9c4a-f370-71c1-b671-4c305e8fba30?t=1570428548587
4. **Junta Administrativa de Gordoa:** MUP 312 "Oraneta". https://www.araba.eus/botha/Boletines/2010/117/2010_117_06437.pdf
5. **Legutio** (junto a Gorbeia): ordenanza municipal sobre los montes públicos del municipio. https://www.legutio.eus/sites/default/files/archivos3046a.pdf
   - No residentes: **5 €/día, 20 €/semana u 80 €/temporada**.
   - Todos los días, del amanecer a la puesta del sol [VERIFICADO HOY en el PDF].
   - No aparece en la lista de terrenos acotados de la Diputación.

**Precios de 2023** *(fuente secundaria: Gasteiz Hoy, https://www.gasteizhoy.com/otono-coger-setas-hongos-alava/)* [NO VERIFICADO para 2026]:
- Arraia: 5 € diario, 80 € temporada para no residentes y 5 € para residentes.
- Asparrena: 5 € diario, 52 € temporada para no residentes y 6 € para residentes.
- Sierra de Árcena: 5 € diario, 75 € temporada para no residentes y 5 € para residentes.

**Gorbeia (parte alavesa), Montes de Vitoria y Valderejo propiamente dicho:** no figuran como terreno acotado en la lista de la Diputación, así que **en principio rige la recogida libre de 2 kg/día** del Decreto Foral 89/2008. Quedan pendientes las limitaciones que puedan fijar los PORN y PRUG de los parques naturales o las ordenanzas de cada concejo [NO VERIFICADO]. Hay una Orden Foral de restricciones durante la berrea en Zigoitia (Gorbeia): https://zigoitia.eus/datos/contenido/documents/1784/Orden%20Foral%20de%20restricciones%20durante%20berrea.pdf (no la he leído).

**Cartografía en Álava:**
- **No existe capa GIS de cotos de setas**; solo hay planos en PDF o JPG.
- geoAraba (IDE de la Diputación, https://datos.gob.es/es/aplicaciones/geoaraba) y geoEuskadi (https://www.geo.euskadi.eus) pueden tener la capa de MUP [NO VERIFICADO la URL exacta de la capa de MUP de Álava]. Como alternativa, los MUP del MITECO del apartado 1.

---

## 12. Cambios recientes detectados

1. **Soto del Real (Madrid), BOCM 02/12/2024:** el cupo recreativo baja a 5 kg/día (en las ordenanzas de 2020-2021 de la zona era de 10 kg).
2. **Montes de Soria 2026:** el foráneo solo puede sacar el permiso de 2 días (10 €, 5 kg); no hay temporada para foráneos. La asociación dice haber crecido a unas 165.500–170.000 ha.
3. **Gredos (AV-50003), 30/09/2026:** el portal de permisos no ofrece ninguna tarifa. Hay que comprobarlo antes de ir.
4. **CyL, WFS de zonas reguladas:** han aparecido polígonos "Parque" nuevos (PMSG-50001, PMAV-50009, PMAV-50010, PMSG-50015, PMSO-50010) que no figuran en la Red oficial de Parques (solo hay 4 declarados). Además SG-50002 y AV-50006 ya no están en la capa. Lo más probable es que haya tramitaciones de parque micológico en Segovia y Ávila [NO VERIFICADO].
5. **Guadalajara:** Rillo de Gallo y Herrería modificaron sus tasas en julio y agosto de 2026 (foráneo 10 €/día), Torrecuadrada aprobó la suya en abril de 2026 (25 €/día) y Arbancón en enero de 2026.
6. **Valsaín:** hay un borrador de 2022 para sustituir la Orden AAA/1681/2016. No consta que se haya aprobado.
7. **Enlaces caídos hoy:**
   - descargas SHP y GPKG del PRUG de Guadarrama en opendata.jcyl.es;
   - PDF de la Orden de setas de CLM y del PRUG del Alto Tajo en areasprotegidas.castillalamancha.es;
   - WMS de MUP de wms.mapama.gob.es.

---

## 13. Fuentes de cartografía: resumen técnico

| Recurso | Tipo | URL | Estado el 30/09/2026 |
|---------|------|-----|----------------------|
| Zonas micológicas reguladas de CyL | WFS/WMS (GeoJSON, SHP, GPKG) | `https://idecyl.jcyl.es/geoapps/mico/wfs` · capa `mico:mico_cyl_zonas_reguladas_peri` | ✅ Funciona (247 polígonos, sin nombres) |
| Réplica de Cesefor (visor micologiacyl) | WFS/WMS | `https://vps24geoserver.cesefor.com/geoserver/micologiacyl/ows` · capa `mico_cyl_zonas_reguladas` | ✅ Funciona |
| Nombres de acotados de CyL | HTML | https://micologiacyl.es/acotados | ✅ |
| Zonificación del PRUG de parques nacionales (Guadarrama, Cabañeros…) | WFS/WMS | `http://sigred.oapn.es/geoserverOAPN/ZonificacionPRUG/ows` · capa `ZonificacionPRUG:view_zon_zonificacion_prug` | ✅ Funciona (1.915 polígonos) |
| Límites del Parque Nacional de Guadarrama y su Área de Especial Protección | SHP (RAR) y WMS | https://www.miteco.gob.es/content/dam/miteco/es/parques-nacionales-oapn/red-parques-nacionales/sig/pn_sierra_guadarrama_tcm30-63594.rar | ✅ HTTP 200 |
| PRUG de Guadarrama (IDECyL) | SHP/GPKG | opendata.jcyl.es/…/am.ren_cyl_pnsg_prug_shp.zip | ❌ Bad Request |
| MUP de España (MITECO, IEPF) | GeoJSON, SHP, KMZ | https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/iepf/IEPF_CMUP_GeoJson.zip | ✅ 329 MB (06/2025) |
| MUP (WMS del MITECO) | WMS | https://wms.mapama.gob.es/sig/Biodiversidad/PropiedadMontes_UP/wms.aspx | ❌ Error del servidor |
| Montes de Soria | PDF | https://asociacionmontesdesoria.com/wp-content/uploads/2025/04/Zonas-Reguladas-Montes-Soria-2025.pdf | No descargado |
| Cotos de Álava | PDF/JPG | Plano de Sierra de Árcena y plano de Arraia (ver 11) | Solo imagen |
| Cotos de CLM (Cuenca, Guadalajara, Toledo) | — | No existe | ❌ Hay que construirla con los MUP |
| Navarra (fuera del ámbito, como referencia) | SHP | https://idena.navarra.es/descargas/FOREST_Pol_AMicologico.zip | No es del ámbito |

**Copias locales guardadas hoy** en `investigacion/datos/`:
- `cyl_zonas_micologicas_reguladas_EPSG4326_20260930.geojson` (37 MB, 247 polígonos, WGS84)
- `oapn_zonificacion_prug_ppnn_EPSG4326_20260930.geojson` (23 MB, 1.915 polígonos, WGS84)

---

## 14. Segunda pasada (30/09/2026): lagunas, hallazgos y callejones sin salida

Método: descarga de los PDF oficiales y lectura del texto, o relectura de las páginas oficiales en vivo. Lo que sigue se ha volcado en `data/normativa.json` (39 normas). **Lo no confirmado queda con `verificado: false` y el motivo en `notas`.**

### 14.1 Confirmado en esta pasada

| Tema | Resultado | Fuente leída |
|------|-----------|--------------|
| PRUG del Parque Nacional (vertiente de Castilla y León) | **Art. 59.b del Decreto 16/2019** (BOCyL n.º 98, 24/05/2019, p. 25610): mismo texto que el de Madrid. Recolección compatible para uso propio salvo en Zonas de Reserva y de Uso Restringido A; tipo B solo en otoño; tipos C y Moderado todo el año; autorización de la propiedad; prohibida la recolección episódica; plan de aprovechamientos obligatorio. Queda resuelto el [NO VERIFICADO] del apartado 3.1. | http://bocyl.jcyl.es/boletines/2019/05/24/pdf/BOCYL-D-24052019-1.pdf |
| Parque Natural Sierra Norte de Guadarrama (punto `guadarrama-navas-melojar`) | **Art. 49.3 del PORN** (Decreto 4/2010, BOCyL n.º 12, 20/01/2010): solo regula el aprovechamiento **comercial** de hongos, que exige autorización de la Administración del Espacio Natural. No hay PRUG con reglas propias para la recolección recreativa. | https://www.miteco.gob.es/content/dam/miteco/es/ceneam/recursos/mini-portales-tematicos/PORN%20DEL%20GUADARRAMA.%20Castilla%20y%20Le%C3%B3n_tcm30-65004.pdf |
| Hayedo de Montejo | **Resolución n.º 2213/2025** de la Dirección General de Biodiversidad y Gestión Forestal, norma 3.6: no se permite recolectar plantas, hongos o minerales. Sustituye a la fuente secundaria de la primera pasada. La Comunidad la fecha el 03/11/2025. | https://www.sierradelrincon.org/wp-content/uploads/2025/11/022Resolucion-2213_2025-DG-Biodiversidad-y-Gestion-Forestal.pdf · https://www.comunidad.madrid/node/6065 |
| Decreto Foral 89/2008 (Álava) | Texto íntegro leído en el BOTHA (copia del Ayuntamiento de Arraia-Maeztu): 2 kg por persona y día (art. 2), herramientas y recipientes (art. 6), prohibido de noche, sanciones por el Título VII de la Norma Foral 11/2007. Las sanciones de 30 a 250 € son del resumen de la Diputación, no del decreto. | https://www.arraia-maeztu.eus/wp-content/uploads/2017/03/coto-setas-maeztu-17-03-22-Norma.pdf |
| PRUG de Gorbeia | **Decreto 169/2019** (BOPV n.º 220, 19/11/2019), apartado 2.7.1.4: en Álava remite al DF 89/2008; en Bizkaia, 2 kg por persona y día. | https://www.euskadi.eus/y22-bopv/es/bopv2/datos/2019/11/1905333a.pdf |
| PRUG de Valderejo | **Decreto 72/2018** (BOPV n.º 98, 23/05/2018): remite al DF 89/2008. | https://www.euskadi.eus/web01-bopv/es/bopv2/datos/2018/05/1802719a.pdf |
| Valsaín | Precios y cupos de la Orden AAA/1681/2016 releídos en el BOE: diario 10 €, fin de semana 15 €, local 3 € o 25 €, vinculado 5 €, provincial 15 €. Sigue sin constar orden posterior. Releída la orden completa: confirma noche, herramientas, compraventa, acceso a pie y tamaños mínimos (diámetro 4 cm Boletus, 2 cm resto); no prohíbe expresamente el vehículo. | https://boe.es/boe/dias/2016/10/22/pdfs/BOE-A-2016-9680.pdf |
| Ordenanzas de Madrid (tasas) | Tablas leídas en el BOCM. Rascafría: foráneo 5 € (1 día) y 10 € (2 días), lo que resuelve la ambigüedad del apartado 3.2. Lozoya: foráneo 5 €. Miraflores y Manzanares: foráneo 80 € temporada, 5 € día, 10 € dos días. Bustarviejo: foráneo 100 € temporada con **5 kg**, 5 € día. Soto del Real: sin tasas en la modificación de 2024 (recreativo 5 kg). | BOCM-20201229-58, BOCM-20210423-57, BOCM-20210115-46, BOCM-20210126-58, BOCM-20210428-72 y BOCM-20241202-98 (enlaces en el apartado 3.2) |
| Ordenanzas de Guadalajara (tasas) | Cobeta: foráneo 3 € (1 día) y 5 € (2 días), lo que resuelve la ambigüedad del apartado 9. Torrecuadrada: foráneo 25 € al día. Arbancón: no residente 5 € al día, 5 kg. Arroyo de las Fraguas: 5 € al día, 20 € por 10 días, 50 € al año. Rillo de Gallo y Herrería: foráneo 10 € al día (modificación **provisional**). | Enlaces del apartado 9 |
| **Boniches (Cuenca)** | Ordenanza en el **BOP de Cuenca n.º 103, 04/09/2024**: foráneo 3 € al día o 20 € al año, 5 kg o 10 L. Es la primera ordenanza oficial de la provincia que se ha leído. | https://www.dipucuenca.es/documents/34525/1514036/29.pdf/7a0f6e25-97f9-18f2-403e-9d1fe66b1117?t=1725430278238 |
| Acotados de CyL (precios del portal) | Montes de Segovia SG-50002 (general: 5 €, 8 € y 40 €), SG-50005 (igual), AV-50006 (5 € y 30 €) y Montes de Soria (foráneo 10 € por 2 días) releídos en el portal oficial. Gredos AV-50003: sigue sin tarifa. | https://permisos.micologiacyl.es/acotado/montes-de-segovia · https://permisos.micologiacyl.es/acotado/montes-comunidad-castilla-y-leon-en-segovia · https://permisos.micologiacyl.es/acotado/montes-comunidad-castilla-y-leon-en-avila · https://permisos.micologiacyl.es/acotado/montes-de-soria · https://permisos.micologiacyl.es/acotado/gredos |
| Mancomunidad La Sierra | Releída: turista 5 € día, 7 € fin de semana, 60 € temporada; 5 kg. | https://sierraaltotajo.es/micoturismo/condiciones-permisos |
| Castilla-La Mancha, art. 3.3 | «5 kg de setas, o un volumen aparente de 10 litros» por persona y día, leído en el texto que reproduce vLex. La cláusula de sanciones (Ley 3/2008 y Ley 43/2003, decomiso) está en la ordenanza de Boniches. | https://vlex.es/vid/orden-15-11-2016-653557269 (copia del texto; `normativa.json` enlaza la otra copia de vLex, …774565357) |

### 14.2 Hallazgos parciales o inciertos (quedan `verificado: false`)

- **Covaleda (SO-50001).** Dos tablas de precios que no coinciden y ninguna con fecha: la ficha de micologiacyl (2 días 10 €, 7 días 30 €) y la web de Pinares de Urbión (2 días 5 €, 7 días 15 €). Fuentes: https://micologiacyl.es/areas/so-50001 · https://www.pinaresdeurbion.es/licencias/
- **Coto de Arraia (Izki).** Las tarifas oficiales del Ayuntamiento son de **2017** (diario 5 €, semanal 20 €, anual 80 € para no empadronados); no hay tarifa de 2026. Fuentes: https://www.arraia-maeztu.eus/wp-content/uploads/2017/03/coto-setas-maeztu-17-03-22-Informacion.pdf · https://www.arraia-maeztu.eus/wp-content/uploads/2017/03/coto-setas-maeztu-17-03-29-kartela.pdf
- **Sierra de Árcena.** La ordenanza de 2014 trae una tabla mal maquetada (5 €, 20 €, 100 €) que no coincide con los 75 € de temporada de la prensa de 2023, así que los importes cambiaron. Sin tarifa de 2026. https://www.araba.eus/botha/Boletines/2014/146/2014_146_05987_C.pdf
- **Asparrena-Apota.** La web municipal confirma permisos diarios, semanales y de temporada **de 2026** vendidos en Entradium, pero el texto no da importes; el extracto de la ordenanza tampoco. Quedan los 5 € y 52 € de la prensa de 2023. https://www.asparrena.eus/ocio-y-turismo/parque-micologico-asparrena-san-millan · https://www.arabakolautada.eus/site_media/uploads/84160698391126867.pdf
- **Legutio.** Importes leídos (5 €, 20 €, 80 €), pero el PDF no lleva fecha. https://www.legutio.eus/sites/default/files/archivos3046a.pdf
- **Miraflores de la Sierra.** Existe una modificación de la ordenanza (BOCM 16/11/2022) que no se ha leído: https://bocm.es/boletin/CM_Orden_BOCM/2022/11/16/BOCM-20221116-87.PDF
- **Canencia.** Solo el anuncio de aprobación provisional (BOCM 14/09/2021), sin texto ni tasas: https://www.bocm.es/boletin/CM_Orden_BOCM/2021/09/14/BOCM-20210914-50.PDF
- **Tragacete y La Huérguina.** Solo prensa (2021 y 2020); no se ha encontrado el BOP.
- **Gredos AV-50003.** Precios de la ficha de 2021 y portal sin tarifa hoy.

### 14.3 Lo que no se ha encontrado

- **Orden de 15/11/2016 (DOCM).** El PDF oficial sigue dando 404: https://areasprotegidas.castillalamancha.es/sites/areasprotegidas.castillalamancha.es/files/documentos/legislacion/20230929/orden_de_setas_clm.pdf redirige a https://medionatural.castillalamancha.es/sites/areasprotegidas.castillalamancha.es/files/documentos/legislacion/20230929/orden_de_setas_clm.pdf, que también da 404. No he localizado el enlace del DOCM: probé una URL de descarga con un número de fichero supuesto (docm.castillalamancha.es/portaldocm/descargarArchivo.do?ruta=2016/11/21/pdf/2016_11181.pdf, que redirige a docm.jccm.es y responde «No se ha encontrado el fichero»). La orden sigue con `verificado: false`.
- **PRUG de Izki (Decreto 73/2018).** El PDF del BOPV (https://www.euskadi.eus/y22-bopv/es/bopv2/datos/2018/06/1802901a.pdf) y el ePub (https://www.euskadi.eus/web01-bopv/es/bopv2/datos/2018/06/1802901a.epub) publican el anexo como imagen o con una fuente ilegible: no se puede leer el apartado de setas. Por analogía con Gorbeia y Valderejo remitiría al DF 89/2008, pero no está comprobado.
- **Parque Regional de Gredos.** La Ley 3/1996 (https://boe.es/boe/dias/1996/07/22/pdfs/A22901-22902.pdf) no contiene reglas de setas; el texto del PORN (Decreto 36/1995) no aparece en los buscadores; fuentes de las Cortes de Castilla y León hasta 2019 dicen que el PRUG seguía sin aprobar (https://sirdoc.ccyl.es/SIRDOC/PDF/PUBLOFI/BO/CCL/9L/BOCCL0900297/BOCCL-09-018569.pdf, no descargado).
- **Parques naturales de Castilla-La Mancha (Alto Tajo, Serranía de Cuenca, Sierra Norte de Guadalajara).** Las búsquedas del PORN y del PRUG no dieron resultados útiles, y las páginas de areasprotegidas.castillalamancha.es ya redirigen a medionatural.castillalamancha.es, donde las que probé dan 404 (p. ej. https://medionatural.castillalamancha.es/print/57).
- **Parque Nacional de Cabañeros.** Una búsqueda del PRUG y las normas de uso público sin resultado; no hay regla de setas localizada.
- **Ordenanzas de Valdemeca, Beteta y Cuenca capital en el BOP de Cuenca.** Las búsquedas (Valdemeca, Beteta, Cuenca capital, Tragacete y La Huérguina) solo devuelven ordenanzas de Guadalajara, Ávila y Burgos. No he podido usar el buscador de bop.dipucuenca.es. La única ordenanza de Cuenca hallada es la de Boniches.
- **Montejo de la Sierra (fuera del Hayedo) y Somosierra.** Ninguna ordenanza micológica en el BOCM (búsqueda «ordenanza micológica Montejo de la Sierra Somosierra BOCM»).
- **Tarifas 2026 de Álava** (Arraia, Asparrena, Árcena) **y de Covaleda.** Ver 14.2.

### 14.4 Direcciones comprobadas y descartadas

- `https://www.boe.es/buscar/doc.php?id=DOCM-2016-...`: 404 (el DOCM no está en el BOE).
- `https://vlex.es/vid/orden-15-11-2016-774565357` y `https://vlex.es/vid/orden-15-11-2016-653557269`: sirven el texto parcial (el art. 12 requiere suscripción).
- `https://boletin.dguadalajara.es/boletin/pdf/pdf2025_1386.pdf` (Cobeta): el lector web no extrae las tablas; se leyó descargando el PDF.
- `https://www.arraia-maeztu.eus/wp-content/uploads/2024/07/240712-ordenanza-precios-publicos-servicios-actividades.pdf` (BOTHA n.º 78, 12/07/2024): precios públicos del ayuntamiento, sin coto de setas.
- `https://www.arraia-maeztu.eus/wp-content/uploads/2026/01/2026_010_00125_C.pdf`: padrón del impuesto de vehículos, sin relación.
- `https://web.araba.eus/es/montes/aprovechamiento-de-hongos-flores-y-frutos-silvestres`: lista los cuatro acotados oficiales (Asparrena-Apota, Arraia, Árcena y Gordoa), sin tarifas.
- `https://permisos.micologiacyl.es/acotado/acotado-de-covaleda`: HTTP 400 (la ficha correcta es https://micologiacyl.es/areas/so-50001).
- `https://www.dipucuenca.es/documents/34525/1514036/29.pdf/...` (Boniches): el acceso directo con curl da 403; se leyó a través del lector web.
- `https://www.euskadi.eus/y22-bopv/es/bopv2/datos/2018/06/1802901a.shtml`: solo contiene el decreto de aprobación; el PRUG está en el PDF ilegible.
- `https://www.boe.es/buscar/act.php?id=BOE-A-1996-16688`: no es la Ley 3/1996 de Gredos (es una resolución de lotería); la ley se leyó en `https://boe.es/boe/dias/1996/07/22/pdfs/A22901-22902.pdf`.
- `https://www.comunidad.madrid/sites/default/files/doc/medio-ambiente/cma_consejoma_01_prug_informefavorable_propuesta.pdf`: no es un PDF válido al descargarlo.

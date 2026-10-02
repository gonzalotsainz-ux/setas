# Setas

Previsión y cuaderno de campo para salir a por setas en once zonas del centro, norte y oeste de la península
(Guadarrama, Sierra Norte, Soria, Burgos, norte de Burgos, Gredos, Cuenca, Guadalajara, Toledo, Álava y Extremadura). Web personal en HTML, CSS y JS
sin framework (módulos ES), publicada en GitHub Pages desde `main`: https://gonzalotsainz-ux.github.io/setas/

- **Hoy y Zona:** índice 0 a 100 por zona y especie a partir de la lluvia (modelos de Open-Meteo contrastados con
  estaciones de AEMET), temperatura y hábitat. Mide la **oportunidad meteorológica**, no la producción del monte.
- **Mapa:** a pantalla completa, con manchas de color solo sobre el monte apropiado según la nota por ladera (bosque,
  altitud y orientación cada 250 m) de hoy y de los próximos días; buscador, chips de especie, capas (mapa, relieve,
  topográfico, satélite, cotos, prohibido, lluvia, sitios y diario; el fondo «Mapa» es la Base IGN mientras CARTO pida clave) y hoja con «Cómo llegar». Sin índice publicado (o sin
  red), los puntos de cada zona con su nota y un aviso.
- **Especies:** fichas con fotos de licencia libre, toxicidad y confusiones peligrosas.
- **Diario:** salidas con foto, compartidas en Supabase, con borrador local si no hay cobertura.
- **Ajustes:** dispositivo, umbrales, calibración con el diario y **créditos completos** de datos, fotos y mapas.

## Aviso de seguridad

La app no identifica setas ni garantiza que una sea comestible. **Ante la duda, no la comas.** Síntomas más de 6 h
después de comer son una urgencia grave: llama al 112. Servicio de Información Toxicológica (INTCF, 24 h):
**91 562 04 20**. El botón Toxicología está siempre en la cabecera y el aviso, en el pie y en la barra inferior.

## Ejecutar en local

```bash
npm ci
npx --yes http-server -p 8080 -c-1 .     # http://localhost:8080
npm run comprobar                        # pruebas + validación de datos (también en el gancho pre-push)
npm run gancho                           # instala el gancho pre-push
```

## Arquitectura

- **Sin login, abierto por decisión de la usuaria.** Cualquiera que tenga la URL puede ver y editar el diario.
  No guardes nada que no quieras compartir.
- **Supabase** (proyecto `ctgedeunquvmcfqsufjj`): diario, fotos y umbrales. La clave publicable está en
  `js/config.js` y es pública por diseño. Migraciones en `supabase/migrations/`.
- **Edge Function `aemet`:** lluvia medida en estaciones AEMET con caché de 6 h y lista blanca de estaciones.
  Detalles, despliegue y retrasos reales de AEMET en [docs/supabase.md](docs/supabase.md).
- **Edge Function `pluvio`:** lluvia medida: SAIH Tajo, Duero y Júcar, Euskalmet y AEMET horario; licencias y estado de cada fuente en Ajustes. Detalles en [docs/supabase.md](docs/supabase.md).
- **Open-Meteo:** se llama desde el navegador con caché de 3 h (evita los 429).
- **Mapa por laderas:** `js/rejilla/` (formato binario, geometría, nota por celda, carga del índice y pintor, con Web
  Worker), `js/mapa/` (capa de la rejilla, fondos y panel de capas, hoja inferior, buscador, chips y barra de días) y
  `data/rejilla/` (rejillas finas de 250 m por zona, `indice.json` y `gruesa.json`, generadas con
  `scripts/rejilla/generar.mjs`). La **Edge Function `rejilla`** (pg_cron a las 07:00 y 19:00 de Madrid) pide la meteo
  de las celdas gruesas y publica el índice diario en el bucket público `indice` (`<sello>.json` + `ultimo.json`).
- Esquemas de datos en [docs/datos.md](docs/datos.md); diseño visual en [docs/diseno.md](docs/diseno.md);
  investigación (normativa, especies, fructificación, sitios) en `docs/investigacion/`.

**Importante:** el *access token* personal de Supabase usado en la puesta en marcha **debe revocarlo la propietaria**
(Supabase → Account → Access Tokens). La clave de servicio solo vive como secreto de la Edge Function.

## Actualizar los datos

Todos los datos están en `data/`; cada dato lleva fuente y fecha y lo no verificado va con `verificado: false`.
Tras cualquier cambio: `npm run comprobar`.

| Qué | Cómo |
|---|---|
| Presencia por zona (GBIF) | `node scripts/gbif-presencia.mjs` (todas) o `--zona=soria,cuenca` (solo esas; las demás no se tocan) |
| Fotos | `node scripts/fotos.mjs --faltan` (solo las que no tienen) o `--solo=id1,id2`. Sin opciones vuelve a descargar todas: evítalo. Revisa a ojo las fotos nuevas y añade las malas a `RECHAZADAS` |
| Cotos | `scripts/cotos/`: `cyl.mjs`, `clm.mjs`, `alava.mjs`, `parque-nacional.mjs`, `unir.mjs` (`extraer-mup.mjs` prepara los montes de utilidad pública). Las fuentes pesadas van a `_fuentes/` (no se versiona) |
| Estaciones AEMET | `node scripts/estaciones-aemet.mjs` usa el modo `?inventario=1` de la función; `aplicar zona=ID,ID …` regenera `supabase/functions/aemet/estaciones.json` |

## Lista de revisión cada temporada

1. **Normativa:** en `data/normativa.json`, revisar toda norma con `revisado` de más de 12 meses contra su fuente
   oficial (permisos, cupos, fechas, prohibiciones) y actualizar `revisado`.
2. **Tarifas y permisos** de cotos y espacios (los marcados «sin confirmar» siguen así hasta comprobarlos).
3. **GBIF:** volver a ejecutar `gbif-presencia.mjs`.
4. **Fotos:** `fotos.mjs --faltan` y revisión a ojo de las nuevas.
5. **Estaciones AEMET:** comprobar que siguen dando datos recientes.
6. `npm run comprobar` y publicar con `git push origin main`.

## Créditos

Open-Meteo (CC BY 4.0), AEMET OpenData, SAIH Tajo, Duero y Júcar, Euskalmet (CC BY 4.0), GBIF, iNaturalist y Wikimedia Commons (fotos con su autor y licencia
en cada ficha), IGN/CNIG, OpenStreetMap, Junta de Castilla y León, OAPN, MITECO, Phosphor Icons (MIT) y las
fuentes tipográficas de Google Fonts. La lista completa y vigente está en **Ajustes**.

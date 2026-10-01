# Lluvia medida en pluviómetros de montaña — diseño

Fecha: 01/10/2026 · Estado: diseño aprobado en conversación por la usuaria («Sí»); pendiente de revisar este documento.

Pieza A del brainstorming de mejoras: lluvia **ya caída** más fiable. La pieza B (previsión corregida) y la pieza «señales
de que ya salen» quedan para después. Investigación de fuentes, con pruebas en vivo y ejemplos de petición:
`docs/investigacion/09-pluviometros.md` (copia del informe del 01/10/2026).

## 1. Qué se quiere

Que la lluvia de las últimas semanas que entra en la nota (P26, P3, tanda, lluvia desde el 1 de agosto) salga de
**pluviómetros de montaña** cercanos y no solo de los modelos, que en septiembre de 2026 fallaron mucho en las zonas
(La Cierva, Cuenca: 68 mm medidos frente a 10-25 de los modelos; Beluntza, Álava: 17 mm frente a 52 de ECMWF).

Criterios de éxito:
- en las zonas con estaciones, la lluvia de la nota es la medida, con control de calidad;
- donde no hay estación válida, se usa el modelo corregido con su sesgo reciente, y se dice;
- la usuaria ve de dónde sale la lluvia («medida en N estaciones» / «estimada con el modelo»);
- las notas no se vuelven locas por un pluviómetro averiado (control de calidad que lo descarta);
- no cambia nada para quien no tenga datos nuevos: si la función falla, la app sigue como hoy.

## 2. Fuentes (de la investigación)

| Fuente | Zonas | Acceso | Notas |
|---|---|---|---|
| SAIH Duero | Guadarrama (vertiente segoviana), Sierra Norte (Riaza), Soria, Burgos (Pinares, Demanda), Gredos (Ávila) | sin clave; ~90 días horarios | Covaleda 1.450 m, Riaza 1.401 m, Puerto del Pico 1.490 m… |
| SAIH Tajo | Guadarrama (vertiente madrileña), Sierra Norte (Madrid, Guadalajara), Gredos sur, Cuenca (cabecera), Guadalajara, Toledo | sin clave; **solo 10 días** sin registro | publica «última hora» cada 15 min: sumar solo las horas en punto |
| SAIH Júcar | Serranía de Cuenca | sin clave; cualquier intervalo; CORS abierto | Cuerda 1.320 m |
| Euskalmet | Álava | relleno con zip anual (CC BY 4.0); tiempo real con clave de su API (registro pendiente) | 28 pluviómetros < 20 km |
| AEMET horario (`/observacion/convencional`) | las 23 estaciones actuales | clave actual (secreto de Supabase) | quita los ~3 días de retraso; solo últimas 12 h → leer cada ≤ 6 h |

Descartadas o aplazadas (motivo en el informe): SAIH Guadiana (caído, certificado caducado), SAIH Ebro (registro y
`robots.txt`), ERA5-Land/CERRA (vacíos o con 5 días de retraso), radar AEMET (solo imágenes), Meteoclimatic (licencia
NC-ND), redes de regadío (valles), OPERA (opcional más adelante).

## 3. Arquitectura

### 3.1 Edge Function `pluvio` (Supabase, nueva)
- Separada de `aemet` y `rejilla`. La lanza pg_cron **cada hora** (minuto 10), con la misma protección de clave en
  cabecera que `rejilla` (Vault + secreto).
- Lee una **lista blanca** de estaciones de montaña (`supabase/functions/pluvio/estaciones.json`, ~80-100), elegidas por
  zona con un script local (distancia < 20 km a los puntos y montes de la zona, altitud parecida), con fuente, código,
  nombre, lat, lon, altitud y licencia.
- Guarda en `lluvia_obs` (estación, hora UTC, mm, fuente, calidad) y agrega a `lluvia_dia` (estación, fecha de Madrid,
  mm, horas válidas, calidad). Tablas privadas como las de `rejilla` (RLS sin políticas, solo `service_role`).
- **Relleno** desde el 1 de agosto una sola vez donde la fuente lo permita (Duero, Júcar, Euskalmet zip). Tajo: empezar
  a guardar **cuanto antes**; el histórico de Tajo empieza el día del despliegue menos 10 días.
- Cortesía con los servidores: una petición por estación y hora como mucho, reintento con espera, plazo global < 150 s.

### 3.2 Control de calidad
- Límites: hora > 60 mm o día > 200 mm → sospechoso; negativo o no numérico → descartado.
- Pico aislado: día que supera mucho a sus vecinas (< 25 km) y al modelo a la vez → sospechoso (p. ej. Quintanar de la
  Sierra 551 mm en un día).
- Día incompleto: menos de 20 horas válidas → no cuenta como día medido.
- Lo sospechoso no entra en la nota; queda guardado y marcado. Umbrales en un único módulo con pruebas.

### 3.3 Uso en la nota
- Para cada punto de zona (Hoy, Zona) y cada celda gruesa (mapa): lluvia diaria **medida** = media ponderada de las
  estaciones válidas cercanas (por distancia y por diferencia de altitud, con radio máximo), en los días en que la hay.
- Días sin estación válida: lluvia del modelo **corregida** por su sesgo de los últimos 30 días frente a las estaciones de
  la zona (cociente acotado, p. ej. 0,5-2), marcado como «estimada».
- La previsión (días futuros) sigue saliendo del modelo, sin cambios (pieza B).
- La función `rejilla` toma esta lluvia al construir las series de cada celda gruesa; Hoy y Zona la leen de un archivo
  público pequeño `pluvio/ultimo.json` (por punto de zona: serie diaria medida/estimada desde el 1 de agosto y nº de
  estaciones), cacheado como el resto. Si falta el archivo, todo funciona como hoy.
- El contraste con AEMET de la pantalla Zona se mantiene y pasa a usar también la lluvia horaria (sin 3 días de retraso).

### 3.4 Lo que ve la usuaria
- En Zona y en la hoja del mapa: «Lluvia medida en 3 estaciones (Covaleda, Duruelo…)» o «Lluvia estimada con el modelo
  (sin estación cercana)», y en la gráfica de lluvia los días medidos se distinguen de los estimados.
- En Ajustes, créditos de cada fuente con su licencia.

## 4. Pruebas
- Lectores de cada fuente con respuestas reales guardadas (dobles), incluida la suma de Tajo solo en horas en punto.
- Control de calidad con casos reales (Quintanar 551 mm, día incompleto, vecinas).
- Mezcla por distancia/altitud y sesgo con números exactos; sin estaciones → igual que hoy.
- Equivalencia: si `pluvio/ultimo.json` no existe, las notas de Hoy/Zona y del mapa son idénticas a las actuales.
- `npm run comprobar` sigue siendo el gancho pre-push.

## 5. Fuera de alcance
- Previsión corregida (pieza B) más allá del sesgo para días sin estación.
- Partes micológicos e iNaturalist (otra pieza).
- SAIH Ebro y Euskalmet en tiempo real hasta que haya claves (se añaden después sin cambiar el diseño).

## 6. Riesgos y decisiones abiertas
- Las webs de los SAIH no son APIs documentadas: pueden cambiar. Lectores aislados por fuente, con prueba en vivo
  diaria y aviso si una fuente deja de responder; la nota nunca depende de una sola fuente.
- Licencias de los SAIH: reutilización de información del sector público con cita; se documenta cada una.
- Despliegue: migraciones, secreto y función nuevos → token de Supabase y autorización de la usuaria en ese momento.
- Urgencia: el histórico de Tajo se pierde a los 10 días; el plan debe poner primero un recolector mínimo de Tajo/AEMET.

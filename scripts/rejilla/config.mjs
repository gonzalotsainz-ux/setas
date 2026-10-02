// Decisiones del sondeo (docs/investigacion/08-rejilla-fuentes.md, tarea 0). Se cambian aquí, no en el código.
// Las rutas de `_fuentes/` son descargas locales en bruto (no van al repo).
export const CONFIG = {
  mdt: {
    fuente: 'ign-wcs', z: null,
    plantillaUrl: 'https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=Elevacion25830_25&FORMAT=image/tiff&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/3857&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/3857&SUBSET=x({oeste},{este})&SUBSET=y({sur},{norte})&SCALESIZE=x({ancho}),y({alto})',
    nombre: 'Modelo Digital del Terreno MDT25 (IGN, PNOA-LiDAR), servicio WCS', url: 'https://servicios.idee.es/wcs-inspire/mdt',
    licencia: 'CC BY 4.0', atribucion: 'Obra derivada de MDT25 CC BY 4.0 scne.es', fecha: '2026-10-01',
  },
  mfe: {
    nombre: 'Mapa Forestal de España 1:50.000 (MFE50)',
    url: 'https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/mfe50.html',
    licencia: 'Reutilización con cita de la fuente (Real Decreto 1495/2011, aviso legal del MITECO)',
    atribucion: 'Mapa Forestal de España 1:50.000 (MFE50) © Ministerio para la Transición Ecológica y el Reto Demográfico',
    fecha: '2026-10-01', carpeta: '_fuentes/mfe50',
    // Recortes por zona del shapefile (scripts/rejilla/recortar-mfe.mjs): es lo que lee generar.mjs.
    recortes: '_fuentes/mfe50-recorte',
    // ZIP de cada provincia en el MITECO (páginas mfe50_descargas_<comunidad>.html, consultadas el 2026-10-01). Se bajan
    // a `carpeta`/<provincia>/ si falta el shapefile.
    zipBase: 'https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/servicios/banco-datos-naturaleza/',
    zips: {
      Madrid: 'MFE50_28_tcm30-200078.zip', Segovia: 'MFE50_40_tcm30-200076.zip', 'Ávila': 'MFE50_05_tcm30-200064.zip',
      Soria: 'MFE50_42_tcm30-200072.zip', Burgos: 'MFE50_09_tcm30-200105.zip', Guadalajara: 'MFE50_19_tcm30-200104.zip',
      Cuenca: 'MFE50_16_tcm30-200071.zip', Toledo: 'MFE50_45_tcm30-200089.zip', 'Álava': 'MFE50_01_tcm30-200095.zip',
      'Cáceres': 'MFE50_10_tcm30-200099.zip', Badajoz: 'MFE50_06_tcm30-200070.zip',
      'Ciudad Real': 'MFE50_13_tcm30-200068.zip', Cantabria: 'MFE50_39_tcm30-200066.zip', Bizkaia: 'MFE50_48_tcm30-200088.zip',
      Gipuzkoa: 'MFE50_20_tcm30-200109.zip', 'La Rioja': 'MFE50_26_tcm30-200085.zip', Navarra: 'MFE50_31_tcm30-200103.zip',
      Teruel: 'MFE50_44_tcm30-200094.zip', Zaragoza: 'MFE50_50_tcm30-200075.zip', Palencia: 'MFE50_34_tcm30-200087.zip',
      Salamanca: 'MFE50_37_tcm30-200100.zip', Huelva: 'MFE50_21_tcm30-200102.zip', Sevilla: 'MFE50_41_tcm30-200065.zip',
      'Córdoba': 'MFE50_14_tcm30-200074.zip',
    },
    // Provincias vecinas que entran en el bbox de cada zona (además de zona.provincias). Su monte se pinta con la marca
    // «fuera de las provincias de la zona» (normativa no revisada). Un recorte vacío se ignora.
    vecinas: {
      guadarrama: ['Ávila'], 'sierra-norte': ['Guadalajara', 'Soria'], 'sierra-oeste': ['Ávila', 'Toledo', 'Segovia'], soria: ['La Rioja', 'Burgos'], burgos: ['Soria', 'Segovia', 'La Rioja'],
      merindades: ['Cantabria', 'Bizkaia', 'Palencia', 'Álava'], gredos: ['Toledo', 'Madrid', 'Cáceres'],
      cuenca: ['Teruel', 'Guadalajara'], guadalajara: ['Cuenca', 'Teruel', 'Zaragoza', 'Soria'], toledo: ['Ciudad Real', 'Badajoz', 'Cáceres'],
      alava: ['Burgos', 'La Rioja', 'Bizkaia', 'Gipuzkoa', 'Navarra'],
      extremadura: ['Huelva', 'Sevilla', 'Córdoba', 'Salamanca', 'Ávila', 'Toledo', 'Ciudad Real'],
    },
    campos: { especies: ['SP1', 'SP2'], ocupacion: ['O1', 'O2'], fcc: 'TFCCARB', tipo: 'TIPESTR' },
    tipos: { arbolado: ['1', '2', '3', '11', '12'], herbazal: ['9', '24', '34', '35'], matorral: ['8'] }, matorralJaral: [],
  },
  pueblos: {
    // Tarea 18: el NGMEP del CNIG exige reCAPTCHA (tarea 0, D5); se usa el WFS del Nomenclátor Geográfico Básico del IGN
    // (núcleos de población) y el WFS de unidades administrativas del IGN (provincia por punto en polígono), sin captcha.
    // scripts/rejilla/pueblos.mjs los baja a `archivo` (CSV propio, fuera del repo) y de ahí genera data/pueblos.json.
    nombre: 'Nomenclátor Geográfico Básico de España (NGBE) y unidades administrativas, IGN (servicios WFS)',
    url: 'https://www.ign.es/wfs-inspire/ngbe',
    licencia: 'CC BY 4.0 (Obra derivada de NGBE CC-BY 4.0 ign.es)', fecha: '2026-10-02',
    archivo: '_fuentes/pueblos/ngbe-nucleos.csv',
    columnas: { nombre: 'NOMBRE', provincia: 'PROVINCIA', lat: 'LATITUD', lon: 'LONGITUD' },
  },
  openMeteo: { trozo: 200, maxPasados: 92 },
  supabase: { lotes: 1 },
  gruesa: { candidatos: [0.09, 0.12, 0.15, 0.18], maximo: 350 },
  maxBytesArchivo: 300 * 1024,
};

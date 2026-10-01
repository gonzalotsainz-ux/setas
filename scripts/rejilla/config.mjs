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
    archivos: {
      Madrid: '_fuentes/mfe50/Madrid.geojson', Segovia: '_fuentes/mfe50/Segovia.geojson', Soria: '_fuentes/mfe50/Soria.geojson',
      Burgos: '_fuentes/mfe50/Burgos.geojson', 'Ávila': '_fuentes/mfe50/Ávila.geojson', Cuenca: '_fuentes/mfe50/Cuenca.geojson',
      Guadalajara: '_fuentes/mfe50/Guadalajara.geojson', Toledo: '_fuentes/mfe50/Toledo.geojson', 'Álava': '_fuentes/mfe50/Álava.geojson',
      'Cáceres': '_fuentes/mfe50/Cáceres.geojson', Badajoz: '_fuentes/mfe50/Badajoz.geojson',
    },
    campos: { especies: ['SP1', 'SP2'], fcc: 'TFCCARB', tipo: 'TIPESTR' },
    tipos: { arbolado: ['1', '2', '3', '11', '12'], herbazal: ['9', '24', '34', '35'], matorral: ['8'] }, matorralJaral: [],
  },
  pueblos: {
    nombre: 'Nomenclátor Geográfico de Municipios y Entidades de Población (NGMEP), IGN',
    url: 'https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=NGMEN',
    licencia: 'CC BY 4.0 (Obra derivada de NGMEP CC-BY 4.0 ign.es)', fecha: '2026-10-01',
    // Descarga manual (reCAPTCHA). Archivo y columnas según la memoria del NGMEP: comprobar con el CSV antes de la tarea 18.
    archivo: '_fuentes/pueblos/ENTIDADES.csv',
    columnas: { nombre: 'NOMBRE', provincia: 'PROVINCIA', lat: 'LATITUD_ETRS89_REGCAN95', lon: 'LONGITUD_ETRS89_REGCAN95' },
  },
  openMeteo: { trozo: 200, maxPasados: 92 },
  supabase: { lotes: 1 },
  gruesa: { candidatos: [0.09, 0.12, 0.15, 0.18], maximo: 350 },
  maxBytesArchivo: 300 * 1024,
};

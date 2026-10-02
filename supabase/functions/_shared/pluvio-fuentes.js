// supabase/functions/_shared/pluvio-fuentes.js
// Fuentes de la lluvia medida: nombre, enlace y licencia (informe 09 §2). Las usan la lista blanca (cada estación lleva la
// licencia de su fuente) y los créditos de Ajustes.
export const LICENCIAS = Object.freeze({
  'reutilizacion-sector-publico': 'Información del sector público reutilizable citando la fuente (Ley 37/2007). Datos provisionales en tiempo real, sin depurar.',
  'cc-by-4.0': 'Licencia CC BY 4.0.',
  aemet: '«Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma».',
});
export const FUENTES_LLUVIA = Object.freeze({
  tajo: { nombre: 'SAIH Tajo (Confederación Hidrográfica del Tajo)', url: 'https://saihtajo.chtajo.es/', licencia: 'reutilizacion-sector-publico' },
  duero: { nombre: 'SAIH Duero (Confederación Hidrográfica del Duero)', url: 'https://www.saihduero.es/', licencia: 'reutilizacion-sector-publico' },
  jucar: { nombre: 'SAIH Júcar (Confederación Hidrográfica del Júcar)', url: 'https://saih.chj.es/', licencia: 'reutilizacion-sector-publico' },
  euskalmet: { nombre: 'Euskalmet, Gobierno Vasco (Open Data Euskadi)', url: 'https://opendata.euskadi.eus/', licencia: 'cc-by-4.0' },
  aemet: { nombre: 'AEMET, observación horaria', url: 'https://www.aemet.es/', licencia: 'aemet' },
});

// Colores fijos de las capas del mapa (sin DOM: valen en un Web Worker). Las capas vectoriales y la rejilla van sobre
// teselas IGN/PNOA, siempre claras, en cualquier tema: por eso sus colores son fijos (los primitivos del tema claro,
// oscuros) y no siguen el tema. Cada trazo lleva además un halo blanco. js/mapa.js los reexporta.
export const COLOR = { peligro: '#9e1c16', acento: '#1f4a33', texto: '#3d4a41', lluvia: '#0b5394', halo: '#ffffff' };
export const NIVEL_COLOR = { nulo: '#7a736b', bajo: '#b8542a', posible: '#b27a0e', bueno: '#4c8a37', 'muy-bueno': '#1d5e3a', 'sin-datos': '#7d827e' };

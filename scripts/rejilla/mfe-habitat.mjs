// scripts/rejilla/mfe-habitat.mjs
// Del Mapa Forestal de España (MFE50, MITECO) al hábitat de data/especies.json. Tabla y criterios: docs/datos.md
// («Rejilla fina: del MFE50 al hábitat»). Nombres de campos y valores reales del MFE50: CONFIG.mfe (tarea 0).
export const FCC_MINIMA = 20;                  // % de cabida cubierta arbórea para contar como bosque (criterio propio)
export const ALTITUD_PASTIZAL_MONTANA = 1000;  // herbazal desde esta altitud: pastizal de montaña; por debajo, prado (criterio propio)

export const ESPECIE_A_HABITAT = {
  'Pinus sylvestris': 'pinar-silvestre',
  'Pinus nigra': 'pinar-negral',
  'Pinus pinaster': 'pinar-resinero',
  'Pinus pinea': 'pinar-pinonero',
  'Fagus sylvatica': 'hayedo',
  'Quercus pyrenaica': 'melojar',
  'Quercus petraea': 'robledal-albar',
  'Quercus robur': 'robledal-albar',          // aproximación: no hay hábitat «robledal pedunculado» en especies.json
  'Quercus faginea': 'quejigar',
  'Quercus ilex': 'encinar',
  'Quercus rotundifolia': 'encinar',
  'Quercus suber': 'alcornocal',
  'Castanea sativa': 'castanar',
  'Juniperus thurifera': 'sabinar',
  'Betula spp.': 'abedular',
  'Populus spp.': 'chopera',
  'Populus x canadensis': 'chopera',
};

const limpio = (n) => String(n ?? '').trim().replace(/\s+/g, ' ');
// Nombre exacto, luego género + especie (quita subespecies y variedades), luego «Género spp.».
export function habitatDeEspecie(nombre) {
  const t = limpio(nombre);
  if (!t) return null;
  const dos = t.split(' ').slice(0, 2).join(' ');
  return ESPECIE_A_HABITAT[t] ?? ESPECIE_A_HABITAT[dos] ?? ESPECIE_A_HABITAT[`${t.split(' ')[0]} spp.`] ?? null;
}

// Tesela normalizada → hábitat o null (sin monte apropiado). Arbolado: la primera de las dos especies dominantes que
// tenga hábitat, si la cabida cubierta llega a FCC_MINIMA. Herbazal: por altitud. Matorral: solo si es de jara.
export function habitatDeTesela({ tipo, especies = [], fcc = null }, altitud, { matorralJaral = [] } = {}) {
  if (tipo === 'arbolado') {
    if (fcc == null || fcc < FCC_MINIMA) return null;
    for (const e of especies.slice(0, 2)) { const h = habitatDeEspecie(e); if (h) return h; }
    return null;
  }
  if (tipo === 'herbazal') return Number.isFinite(altitud) ? (altitud >= ALTITUD_PASTIZAL_MONTANA ? 'pastizal-montana' : 'prado') : null;
  if (tipo === 'matorral') return especies.some((e) => matorralJaral.includes(limpio(e))) ? 'jaral' : null;
  return null;
}

// En el MFE50, SP1/SP2 valen 0 cuando no hay especie (docs/investigacion/08-rejilla-fuentes.md, D1).
const sinEspecie = (x) => x == null || String(x).trim() === '' || String(x).trim() === '0';

// properties de una tesela del MFE50 → tesela normalizada, con los nombres de campos y valores del sondeo.
export function leerTeselaMfe(props, { campos, tipos }, diccionario) {
  const v = String(props[campos.tipo] ?? '');
  const es = (lista) => lista.map(String).includes(v);
  const tipo = es(tipos.arbolado) ? 'arbolado' : es(tipos.herbazal) ? 'herbazal' : es(tipos.matorral) ? 'matorral' : 'otro';
  const especies = campos.especies.map((c) => props[c]).filter((x) => !sinEspecie(x)).map((x) => diccionario[String(x)] ?? String(x));
  const f = props[campos.fcc] == null || props[campos.fcc] === '' ? NaN : Number(props[campos.fcc]);
  return { tipo, especies, fcc: Number.isFinite(f) ? f : null };
}

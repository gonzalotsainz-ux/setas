// scripts/rejilla/mfe-habitat.mjs
// Del Mapa Forestal de España (MFE50, MITECO) al hábitat de data/especies.json. Tabla y criterios: docs/datos.md
// («Rejilla fina: del MFE50 al hábitat»). Nombres de campos y valores reales del MFE50: CONFIG.mfe (tarea 0).
export const FCC_MINIMA = 20;                  // % de cabida cubierta arbórea para contar como bosque (criterio propio)
export const ALTITUD_PASTIZAL_MONTANA = 1000;  // herbazal desde esta altitud: pastizal de montaña; por debajo, prado (criterio propio)
export const OCUPACION_MINIMA_SEGUNDA = 3;     // décimas (O2 del MFE50) para que la 2.ª especie desplace a la 1.ª (criterio propio)

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

// Tesela normalizada → hábitat o null (sin monte apropiado). Arbolado, si la cabida cubierta llega a FCC_MINIMA:
// 1) con `habitatsConIndice`, la primera de las dos especies dominantes cuyo hábitat tenga especies con índice (la
//    segunda solo si ocupa al menos OCUPACION_MINIMA_SEGUNDA décimas); 2) si no, la primera que tenga hábitat.
// Herbazal: por altitud. Matorral: solo si es de jara.
export function habitatDeTesela({ tipo, especies = [], fcc = null, ocupacion = [] }, altitud, { matorralJaral = [], habitatsConIndice = null } = {}) {
  if (tipo === 'arbolado') {
    if (fcc == null || fcc < FCC_MINIMA) return null;
    const dos = especies.slice(0, 2).map(habitatDeEspecie);
    if (habitatsConIndice) {
      const conIndice = (h) => h != null && (habitatsConIndice.has ? habitatsConIndice.has(h) : habitatsConIndice.includes(h));
      for (let i = 0; i < dos.length; i++) {
        if (i > 0 && !(ocupacion[i] >= OCUPACION_MINIMA_SEGUNDA)) continue;
        if (conIndice(dos[i])) return dos[i];
      }
    }
    return dos.find((h) => h) ?? null;
  }
  if (tipo === 'herbazal') return Number.isFinite(altitud) ? (altitud >= ALTITUD_PASTIZAL_MONTANA ? 'pastizal-montana' : 'prado') : null;
  if (tipo === 'matorral') return especies.some((e) => matorralJaral.includes(limpio(e))) ? 'jaral' : null;
  return null;
}

// En el MFE50, SP1/SP2 valen 0 cuando no hay especie (docs/investigacion/08-rejilla-fuentes.md, D1).
const sinEspecie = (x) => x == null || String(x).trim() === '' || String(x).trim() === '0';

// properties de una tesela del MFE50 → tesela normalizada, con los nombres de campos y valores del sondeo.
// Si `campos.ocupacion` existe (O1, O2: décimas de la tesela que ocupa cada especie), se añade `ocupacion`, en paralelo
// a `especies` (null si falta el dato).
export function leerTeselaMfe(props, { campos, tipos }, diccionario) {
  const v = String(props[campos.tipo] ?? '');
  const es = (lista) => lista.map(String).includes(v);
  const tipo = es(tipos.arbolado) ? 'arbolado' : es(tipos.herbazal) ? 'herbazal' : es(tipos.matorral) ? 'matorral' : 'otro';
  const num = (x) => { const n = x == null || x === '' ? NaN : Number(x); return Number.isFinite(n) ? n : null; };
  const pares = campos.especies.map((c, i) => [props[c], campos.ocupacion ? props[campos.ocupacion[i]] : undefined]).filter(([x]) => !sinEspecie(x));
  const especies = pares.map(([x]) => diccionario[String(x)] ?? String(x));
  const tesela = { tipo, especies, fcc: num(props[campos.fcc]) };
  if (campos.ocupacion) tesela.ocupacion = pares.map(([, o]) => num(o));
  return tesela;
}

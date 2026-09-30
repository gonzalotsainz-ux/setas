// Comprueba los contrastes WCAG 2.x de los tokens de css/tokens.css en tema claro y oscuro
// (texto >= 4,5:1; trazos, bordes de control y foco >= 3:1) y que los dos bloques del tema
// oscuro (prefers-color-scheme y data-theme="dark") sigan siendo idénticos.
// Uso: node scripts/contraste.mjs [ruta/a/tokens.css]   (sale con código 1 si algo falla)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ruta = process.argv[2] ?? fileURLToPath(new URL('../css/tokens.css', import.meta.url));
const css = readFileSync(ruta, 'utf8');

function bloque(selectorRegex) {
  const m = css.match(selectorRegex);
  return m ? m[1] : '';
}
function vars(txt) {
  const o = {};
  for (const m of txt.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) o[m[1]] = m[2].trim();
  return o;
}
// Todos los :root { ... } sin media (primitivos + claro)
const partes = [...css.matchAll(/(^|\n):root\s*\{([\s\S]*?)\n\}/g)].map(m => m[2]);
const base = Object.assign({}, ...partes.map(vars));
const oscuro = Object.assign({}, base, vars(bloque(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)));

function resolver(t, v, prof = 0) {
  let x = t[v];
  if (!x) throw new Error('falta ' + v);
  const m = x.match(/^var\((--[\w-]+)\)$/);
  return m ? resolver(t, m[1], prof + 1) : x;
}
function lum(hex) {
  hex = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };

const niveles = ['nulo', 'bajo', 'posible', 'bueno', 'muy-bueno'];
const pares = [
  // [texto, fondo, mínimo, descripción]
  ['--c-texto', '--c-fondo', 4.5], ['--c-texto', '--c-superficie', 4.5], ['--c-texto', '--c-superficie-2', 4.5],
  ['--c-texto-2', '--c-fondo', 4.5], ['--c-texto-2', '--c-superficie', 4.5], ['--c-texto-2', '--c-superficie-2', 4.5],
  ['--c-texto-3', '--c-superficie', 4.5], ['--c-texto-3', '--c-fondo', 4.5],
  ['--c-sobre-acento', '--c-acento', 4.5], ['--c-acento', '--c-superficie', 4.5], ['--c-acento', '--c-fondo', 4.5],
  ['--c-acento-fuerte', '--c-acento-suave', 4.5], ['--c-texto', '--c-acento-suave', 4.5],
  ['--c-ocre-texto', '--c-ocre-suave', 4.5], ['--c-ocre-texto', '--c-superficie', 4.5], ['--c-texto', '--c-ocre-suave', 4.5],
  ['--c-sobre-peligro', '--c-peligro', 4.5], ['--c-peligro', '--c-superficie', 4.5], ['--c-peligro', '--c-fondo', 4.5],
  ['--c-peligro-fuerte', '--c-peligro-suave', 4.5], ['--c-texto', '--c-peligro-suave', 4.5],
  ['--c-borde-fuerte', '--c-superficie', 3], ['--c-foco', '--c-superficie', 3], ['--c-foco', '--c-fondo', 3],
  ['--c-lluvia', '--c-superficie', 3], ['--c-lluvia-prevista', '--c-superficie', 3], ['--c-acumulado', '--c-superficie', 4.5],
  ['--c-sin-datos', '--c-sin-datos-fondo', 3], ['--c-sin-datos-texto', '--c-sin-datos-fondo', 4.5], ['--c-sin-datos', '--c-superficie', 3],
  ['--c-sin-datos-texto', '--c-superficie', 4.5], ['--c-sin-datos-texto', '--c-fondo', 4.5],
  ...niveles.flatMap(n => [
    [`--c-sem-${n}`, `--c-sem-${n}-fondo`, 3],
    [`--c-sem-${n}`, '--c-superficie', 3],
    [`--c-sem-${n}-texto`, `--c-sem-${n}-fondo`, 4.5],
    [`--c-sem-${n}-texto`, '--c-superficie', 4.5],
  ]),
];
let fallos = 0;

// Los dos bloques del tema oscuro deben coincidir línea a línea
const lineas = t => t.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('/*'));
const oscuroMedia = css.match(/:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\n  \}/);
const oscuroAttr = css.match(/\n:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
if (!oscuroMedia || !oscuroAttr || JSON.stringify(lineas(oscuroMedia[1])) !== JSON.stringify(lineas(oscuroAttr[1]))) {
  console.log('MAL los dos bloques del tema oscuro no coinciden');
  fallos++;
} else console.log('OK  los dos bloques del tema oscuro coinciden');
for (const [nombre, t] of [['claro', base], ['oscuro', oscuro]]) {
  console.log(`\n## Tema ${nombre}`);
  for (const [a, b, min] of pares) {
    const ca = resolver(t, a), cb = resolver(t, b);
    const r = ratio(ca, cb);
    const ok = r >= min;
    if (!ok) fallos++;
    console.log(`${ok ? 'OK ' : 'MAL'} ${r.toFixed(2).padStart(5)}:1 (mín ${min}) ${a} ${ca} sobre ${b} ${cb}`);
  }
}
console.log(`\nFallos: ${fallos}`);
process.exitCode = fallos ? 1 : 0;

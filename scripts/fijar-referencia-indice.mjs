// scripts/fijar-referencia-indice.mjs
// Guarda en tests/fixtures/indice-referencia.json el resultado de cada caso de tests/casos-indice.js con el índice ACTUAL.
// Solo se ejecuta para fijar una referencia nueva a propósito (p. ej. antes de reorganizar js/indice.js).
import { writeFileSync, mkdirSync } from 'node:fs';
import { casosIndice, resultadoCaso } from '../tests/casos-indice.js';

const salida = Object.fromEntries(casosIndice().map((c) => [c.clave, resultadoCaso(c)]));
mkdirSync('tests/fixtures', { recursive: true });
writeFileSync('tests/fixtures/indice-referencia.json', `${JSON.stringify(salida, null, 1)}\n`);
console.log(`${Object.keys(salida).length} casos guardados en tests/fixtures/indice-referencia.json`);

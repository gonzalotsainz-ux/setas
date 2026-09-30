import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etiqueta } from '../js/indice.js';
import { nivelDe, palabraDe } from '../js/ui/semaforo.js';

test('etiqueta(v) del índice y nivelDe(v) del semáforo coinciden en los cortes', () => {
  for (const v of [0, 19, 20, 39, 40, 59, 60, 79, 80, 100]) {
    assert.equal(palabraDe(nivelDe(v)).toLowerCase(), etiqueta(v), `valor ${v}`);
  }
});

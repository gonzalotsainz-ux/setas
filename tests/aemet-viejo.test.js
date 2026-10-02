import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerJsonAemet, esBuena, recortar, elegirViejo, marcarViejo } from '../supabase/functions/aemet/viejo.js';
import { avisoViejo, pedirObservaciones } from '../js/aemet.js';

const H = 3600e3, ahora = Date.parse('2026-10-02T12:00:00Z');
const hace = (h) => new Date(ahora - h * H).toISOString();
const dias = (d0, n, v = 1) => Object.fromEntries(Array.from({ length: n }, (_, k) => [new Date(Date.parse(`${d0}T00:00:00Z`) + k * 864e5).toISOString().slice(0, 10), v]));

test('HTML de un 503 → mensaje claro, no «Unexpected token»', () => {
  assert.throws(() => leerJsonAemet(503, '<html><body>Service Unavailable</body></html>'), /^Error: AEMET no disponible \(503\)$/);
  assert.throws(() => leerJsonAemet(200, '<!DOCTYPE html>'), /AEMET no disponible \(200\)/);
  assert.throws(() => leerJsonAemet(200, 'basura'), /no es JSON/);
  assert.throws(() => leerJsonAemet(502, ''), /AEMET no disponible \(502\)/);
  assert.deepEqual(leerJsonAemet(200, '{"estado":200}'), { estado: 200 });
  assert.deepEqual(leerJsonAemet(404, '{"estado":404}'), { estado: 404 });   // JSON legítimo con HTTP no OK
  assert.deepEqual(leerJsonAemet(200, '[{"a":1}]'), [{ a: 1 }]);
});

test('solo cuentan como buenas las copias con datos y sin error', () => {
  assert.equal(esBuena({ A: { '2026-10-01': 1 } }), true);
  assert.equal(esBuena({}), false);
  assert.equal(esBuena({ __error: 'x' }), false);
  assert.equal(esBuena(null), false);
});

test('misma clave de ≤ 48 h → se devuelve tal cual', () => {
  const datos = { A: dias('2026-09-03', 30) };
  const e = [{ clave: 'A|2026-09-03|2026-10-02', datos, creado: hace(30) }];
  assert.deepEqual(elegirViejo(e, { estaciones: ['A'], desde: '2026-09-03', hasta: '2026-10-02', ahora }), { datos, creado: hace(30) });
});

test('más de 48 h o con error → nada', () => {
  const args = { estaciones: ['A'], desde: '2026-09-03', hasta: '2026-10-02', ahora };
  assert.equal(elegirViejo([{ clave: 'A|2026-09-03|2026-10-02', datos: { A: dias('2026-09-03', 3) }, creado: hace(49) }], args), null);
  assert.equal(elegirViejo([{ clave: 'A|2026-09-03|2026-10-02', datos: { __error: 'x' }, creado: hace(1) }], args), null);
  assert.equal(elegirViejo([], args), null);
});

test('otra ventana de las mismas estaciones: la más reciente, recortada a los días que solapan', () => {
  const e = [
    { clave: 'A,B|2026-09-01|2026-09-30', datos: { A: dias('2026-09-01', 30, 2), B: dias('2026-09-01', 30, 2) }, creado: hace(40) },
    { clave: 'A,B|2026-09-02|2026-10-01', datos: { A: dias('2026-09-02', 30, 5), B: dias('2026-09-02', 30, 5) }, creado: hace(20) },
    { clave: 'A|2026-09-03|2026-10-02', datos: { A: dias('2026-09-03', 30, 9) }, creado: hace(2) },   // otras estaciones
  ];
  const r = elegirViejo(e, { estaciones: ['A', 'B'], desde: '2026-09-03', hasta: '2026-10-02', ahora });
  assert.equal(r.creado, hace(20));
  assert.equal(Object.keys(r.datos.A).length, 29);               // 3 sep … 1 oct
  assert.equal(r.datos.A['2026-10-01'], 5);
  assert.equal(r.datos.A['2026-10-02'], undefined);
  assert.equal(r.datos.B['2026-09-02'], undefined);
  assert.equal(recortar({ A: { '2026-01-01': 1 } }, '2026-09-03', '2026-10-02'), null);
});

test('si la más reciente no solapa, se prueba la siguiente', () => {
  const e = [
    { clave: 'A|2026-08-01|2026-08-10', datos: { A: dias('2026-08-01', 10) }, creado: hace(1) },
    { clave: 'A|2026-09-20|2026-09-29', datos: { A: dias('2026-09-20', 10) }, creado: hace(5) },
  ];
  assert.equal(elegirViejo(e, { estaciones: ['A'], desde: '2026-09-25', hasta: '2026-10-02', ahora }).creado, hace(5));
});

test('marcarViejo añade __viejo sin tocar las estaciones', () => {
  const m = marcarViejo({ A: { '2026-10-01': 1 } }, hace(3));
  assert.deepEqual(m.A, { '2026-10-01': 1 });
  assert.deepEqual(m.__viejo, { creado: hace(3) });
  assert.deepEqual(marcarViejo([1], 'x'), [1]);
});

test('aviso en pantalla: solo si los datos vienen marcados como viejos', () => {
  assert.equal(avisoViejo({ A: {} }, ahora), null);
  assert.equal(avisoViejo(null, ahora), null);
  assert.equal(avisoViejo({ __viejo: { creado: hace(5) } }, ahora), 'Datos de AEMET de hace 5 h (AEMET no responde)');
  assert.equal(avisoViejo({ __viejo: { creado: hace(0.2) } }, ahora), 'Datos de AEMET de hace menos de 1 h (AEMET no responde)');
});

test('cliente: la copia vieja se guarda pero solo se reutiliza 10 min', async () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k), get length() { return mem.size; } };
  Object.defineProperty(globalThis.localStorage, Symbol.iterator, { value: undefined });
  let llamadas = 0;
  const viejo = { A: { '2026-10-01': 1 }, __viejo: { creado: hace(5) } };
  globalThis.fetch = async () => { llamadas++; return { ok: true, json: async () => (llamadas === 1 ? viejo : { A: { '2026-10-01': 1 } }) }; };
  try {
    const r1 = await pedirObservaciones(['A'], '2026-09-03', '2026-10-02', { ahora });
    assert.ok(r1.__viejo);
    await pedirObservaciones(['A'], '2026-09-03', '2026-10-02', { ahora: ahora + 5 * 60e3 });
    assert.equal(llamadas, 1);                                        // dentro de 10 min: caché local
    const r3 = await pedirObservaciones(['A'], '2026-09-03', '2026-10-02', { ahora: ahora + 11 * 60e3 });
    assert.equal(llamadas, 2);                                        // pasado: vuelve a preguntar y ya no es vieja
    assert.equal(r3.__viejo, undefined);
  } finally { delete globalThis.fetch; delete globalThis.localStorage; }
});

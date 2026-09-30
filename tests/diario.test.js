import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serieSintetica, lluviaBuena, BOLETUS } from './ayudas.js';
import { prepararFotosBorrador, cabeEnPresupuesto, fotoFijaDelDia, colaBorradores, sincronizar, crearSalida, borrarSalida, listarSalidas, urlFoto, ajustarATamano, recortarSerie, puntoMasCercano, totalKg } from '../js/diario.js';

function almacenFalso() { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; }

test('añadir y listar borradores persiste entre instancias', () => {
  const a = almacenFalso();
  colaBorradores(a).anadir({ id: 'b1', fecha: '2026-10-12', zona_id: 'soria', especies: [], fotos: [] });
  assert.equal(colaBorradores(a).todos().length, 1);
});

test('sincronizar sube, quita lo subido y conserva lo fallido', async () => {
  const cola = colaBorradores(almacenFalso());
  cola.anadir({ id: 'ok', fecha: '2026-10-12', zona_id: 'soria', especies: [], fotos: [] });
  cola.anadir({ id: 'mal', fecha: '2026-10-13', zona_id: 'soria', especies: [], fotos: [] });
  const r = await sincronizar({ cola, subir: async (b) => { if (b.id === 'mal') throw new Error('503 sin red'); } });
  assert.deepEqual(r, { subidas: 1, fallidas: 1 });
  assert.deepEqual(cola.todos().map((b) => b.id), ['mal']);
});

test('sincronizar a la vez (carga + online + visibilidad) no sube dos veces', async () => {
  const cola = colaBorradores(almacenFalso());
  cola.anadir({ id: 'b1', fotos: [] });
  let llamadas = 0;
  const subir = async () => { llamadas++; await new Promise((r) => setTimeout(r, 10)); };
  await Promise.all([sincronizar({ cola, subir }), sincronizar({ cola, subir })]);
  assert.equal(llamadas, 1);
});

test('almacén roto → la cola funciona en memoria y avisa', () => {
  const roto = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const cola = colaBorradores(roto);
  cola.anadir({ id: 'b1', fotos: [] });
  assert.equal(cola.todos().length, 1);
  assert.equal(cola.persistente, false);
});

// ---- Supabase falso: tablas y Storage en memoria, con fallos programables ----
function supabaseFalso({ fallaSubidaN = null, pierdeRespuestaUpsert = false } = {}) {
  const bd = { salidas: [], fotos: [] }, objetos = new Map();
  const registro = { inserts: 0, subidas: [] };
  let subidasIntentadas = 0;
  let respuestasPerdidas = pierdeRespuestaUpsert ? 1 : 0;
  const tabla = (nombre) => ({
    upsert(fila, opciones) {
      registro.upserts = (registro.upserts ?? 0) + 1;
      assert.equal(opciones.onConflict, 'id'); assert.equal(opciones.ignoreDuplicates, true);
      if (!bd[nombre].some((f) => f.id === fila.id)) { registro.inserts++; bd[nombre].push({ ...fila }); }
      const r = respuestasPerdidas-- > 0 ? { error: new Error('respuesta perdida') } : { error: null };
      return { then: (ok) => ok(r) };
    },
    insert(fila) {
      if (nombre === 'salidas') registro.inserts++;
      const conId = { id: `${nombre}-${bd[nombre].length + 1}`, ...fila };
      bd[nombre].push(conId);
      const r = { data: null, error: null };
      return { select: () => ({ single: async () => ({ data: { id: conId.id }, error: null }) }), then: (ok) => ok(r) };
    },
    select() {
      return { eq: async (col, v) => ({ data: bd[nombre].filter((f) => f[col] === v), error: null }) };
    },
    delete() {
      return { eq: async (col, v) => {
        bd[nombre] = bd[nombre].filter((f) => f[col] !== v);
        if (nombre === 'salidas') bd.fotos = bd.fotos.filter((f) => f.salida_id !== v);   // cascade de filas
        return { error: null };
      } };
    },
  });
  return {
    bd, objetos, registro,
    from: (n) => tabla(n),
    storage: {
      from: () => ({
        async upload(ruta, blob) {
          subidasIntentadas++;
          if (fallaSubidaN === subidasIntentadas) return { error: new Error('sin red') };
          objetos.set(ruta, blob); registro.subidas.push(ruta); return { error: null };
        },
        async list(carpeta) { return { data: [...objetos.keys()].filter((r) => r.startsWith(`${carpeta}/`)).map((r) => ({ name: r.split('/')[1] })), error: null }; },
        async remove(rutas) { for (const r of rutas) objetos.delete(r); return { data: rutas, error: null }; },
        getPublicUrl: (ruta) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/fotos/${ruta}` } }),
      }),
    },
  };
}
const foto = (n) => ({ dataUrl: `data:image/jpeg;base64,${Buffer.from(`foto${n}`).toString('base64')}`, ancho: 10, alto: 8 });

test('crearSalida: inserta la salida y sube las fotos como <id>/<n>.jpg', async () => {
  const sb = supabaseFalso();
  const id = await crearSalida({ id: 'b1', fecha: '2026-10-12', zona_id: 'soria', fotos: [foto(1), foto(2)] }, { supabase: sb });
  assert.equal(id, 'b1');
  assert.deepEqual(sb.registro.subidas, ['b1/1.jpg', 'b1/2.jpg']);
  assert.equal(sb.bd.fotos.length, 2);
  for (const campo of ['fotos', 'remotoId', 'fotosSubidas']) assert.equal(Object.hasOwn(sb.bd.salidas[0], campo), false, campo);
});

test('crearSalida es idempotente: si falla la 2.ª foto, el reintento no duplica la salida y sube solo las pendientes', async () => {
  const sb = supabaseFalso({ fallaSubidaN: 2 });
  const guardados = [];
  const b = { id: 'b1', fecha: '2026-10-12', zona_id: 'soria', fotos: [foto(1), foto(2), foto(3)] };
  await assert.rejects(() => crearSalida(b, { supabase: sb, persistir: (x) => guardados.push(JSON.parse(JSON.stringify(x))) }));
  assert.equal(sb.registro.inserts, 1);
  assert.deepEqual(sb.registro.subidas, ['b1/1.jpg']);
  const ultimo = guardados.at(-1);
  assert.equal(ultimo.remotoId, 'b1');
  // reintento desde el borrador guardado (como lo leería la cola)
  const id = await crearSalida(ultimo, { supabase: sb });
  assert.equal(id, 'b1');
  assert.equal(sb.registro.inserts, 1, 'no se crea otra salida');
  assert.deepEqual(sb.registro.subidas, ['b1/1.jpg', 'b1/2.jpg', 'b1/3.jpg'], 'la 1.ª no se vuelve a subir');
  assert.equal(sb.bd.fotos.length, 3);
});

test('borrarSalida: quita los objetos de Storage (también huérfanos) y luego la fila', async () => {
  const sb = supabaseFalso();
  const id = await crearSalida({ id: 'b1', fotos: [foto(1), foto(2)] }, { supabase: sb });
  sb.objetos.set(`${id}/9.jpg`, new Blob(['huerfana']));   // subida sin fila en `fotos`
  sb.objetos.set('otra/1.jpg', new Blob(['ajena']));
  await borrarSalida(id, { supabase: sb });
  assert.deepEqual([...sb.objetos.keys()], ['otra/1.jpg']);
  assert.equal(sb.bd.salidas.length, 0);
  assert.equal(sb.bd.fotos.length, 0);
});

test('borrarSalida: si Storage falla no borra la fila (así se puede reintentar)', async () => {
  const sb = supabaseFalso();
  const id = await crearSalida({ id: 'b1', fotos: [foto(1)] }, { supabase: sb });
  sb.storage.from = () => ({ list: async () => ({ data: [], error: null }), remove: async () => ({ error: new Error('sin red') }) });
  await assert.rejects(() => borrarSalida(id, { supabase: sb }));
  assert.equal(sb.bd.salidas.length, 1);
});

test('listarSalidas propaga el error; urlFoto usa la URL pública', async () => {
  const sb = { from: () => ({ select: () => ({ order: async () => ({ data: null, error: new Error('boom') }) }) }) };
  await assert.rejects(() => listarSalidas({ supabase: sb }), /boom/);
  assert.match(urlFoto('a/1.jpg', { supabase: supabaseFalso() }), /public\/fotos\/a\/1\.jpg$/);
});

test('ajustarATamano: baja calidad y luego tamaño hasta caber en el límite', async () => {
  const intentos = [];
  // peso simulado: proporcional al área y a la calidad
  const codificar = async ({ lado, calidad }) => { intentos.push({ lado, calidad }); return { size: lado * lado * calidad * 2, lado }; };
  const r = await ajustarATamano(codificar, { max: 1600, calidad: 0.8, limite: 2_000_000 });
  assert.ok(r.size <= 2_000_000);
  assert.ok(intentos.length > 1);
  assert.ok(intentos.every((i) => i.lado <= 1600));
  const ok = await ajustarATamano(async () => ({ size: 300_000 }), { limite: 2_000_000 });
  assert.equal(ok.size, 300_000);
  await assert.rejects(() => ajustarATamano(async () => ({ size: 9e9 }), { limite: 1 }), /demasiado grande/i);
});

test('recortarSerie: últimos 30 días y próximos 3 alrededor de hoy', () => {
  const n = 71, hoy = 60;
  const serie = { fechas: Array.from({ length: n }, (_, k) => `d${k}`), hoy, precip: Array.from({ length: n }, (_, k) => k), tmedia: Array.from({ length: n }, (_, k) => k), lluviaAntesDeSerie: { mm: 5 } };
  const r = recortarSerie(serie);
  assert.equal(r.fechas.length, 34);
  assert.equal(r.fechas[r.hoy], 'd60');
  assert.equal(r.fechas[0], 'd30');
  assert.equal(r.fechas.at(-1), 'd63');
  assert.deepEqual(r.precip.slice(0, 2), [30, 31]);
  assert.equal(r.lluviaAntesDeSerie, undefined);
  assert.equal(recortarSerie({ fechas: ['a', 'b'], hoy: 1, precip: [1, 2] }).fechas.length, 2);   // serie corta
});

test('puntoMasCercano: el punto de la zona más próximo; sin coordenadas, el primero', () => {
  const zona = { puntos: [{ id: 'a', lat: 41, lon: -2 }, { id: 'b', lat: 42, lon: -3 }] };
  assert.equal(puntoMasCercano(zona, 41.9, -2.9).id, 'b');
  assert.equal(puntoMasCercano(zona, null, null).id, 'a');
  assert.equal(puntoMasCercano({ puntos: [] }, 1, 1), null);
});

test('totalKg suma las especies, ignorando valores no numéricos', () => {
  assert.equal(totalKg([{ kg: 1.2 }, { kg: '0,8' }, { kg: null }, {}]), 2);
  assert.equal(totalKg(undefined), 0);
});

test('fotoFijaDelDia: sin serie no hay foto; con serie, meteo recortada e índice', () => {
  const zona = { id: 'z', habitats: ['pinar'], puntos: [{ id: 'p', lat: 41, lon: -2 }] };
  const datos = { especies: [{ ...BOLETUS, categoria: 'comestible', zonas: { z: { presencia: 'frecuente' } }, habitats: ['pinar'] }] };
  assert.deepEqual(fotoFijaDelDia({ zona, lat: 41, lon: -2, datos, meteo: null }), { meteo: null, indice: null });
  const r = fotoFijaDelDia({ zona, lat: 41, lon: -2, datos, meteo: { series: { p: serieSintetica({ precip: lluviaBuena }) } } });
  assert.equal(r.meteo.punto, 'p');
  assert.equal(r.meteo.serie.fechas.length, 31);   // la serie sintética acaba hoy: 30 días + hoy
  assert.equal(typeof r.indice.valor, 'number');
  assert.equal(r.indice.especies[0].id, 'boletus-edulis');
});

// ---- Ronda de correcciones 1 ----
const almacenMemoria = ({ falla = false, noDisponible = false } = {}) => {
  const m = new Map();
  return { m, disponible: async () => !noDisponible, put: async (k, v) => { if (falla) throw new Error('cuota'); m.set(k, v); }, get: async (k) => m.get(k) ?? null, borrar: async (k) => { m.delete(k); } };
};
const fotoLocal = (n, peso = 10) => ({ blob: new Blob([`foto${n}`]), dataUrl: `data:image/jpeg;base64,${'A'.repeat(peso)}`, ancho: 4, alto: 3 });

test('cola: una escritura fallida deja persistente=false y se recupera en la siguiente que funcione', () => {
  let llena = true; const m = new Map();
  const alm = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { if (llena) throw new Error('QuotaExceeded'); m.set(k, v); }, removeItem: (k) => m.delete(k) };
  const cola = colaBorradores(alm);
  assert.equal(cola.anadir({ id: 'a' }), false);
  assert.equal(cola.persistente, false);
  assert.deepEqual(cola.todos().map((b) => b.id), ['a']);   // la verdad es la memoria
  llena = false;
  assert.equal(cola.anadir({ id: 'b' }), true);
  assert.equal(cola.persistente, true);
  assert.deepEqual(colaBorradores(alm).todos().map((b) => b.id), ['a', 'b']);
});

test('cola: un borrador quitado con el almacén lleno no resucita mientras dure la sesión', () => {
  let llena = false; const m = new Map();
  const alm = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { if (llena) throw new Error('Quota'); m.set(k, v); }, removeItem: (k) => m.delete(k) };
  const cola = colaBorradores(alm);
  cola.anadir({ id: 'a' }); llena = true;
  cola.quitar('a');
  assert.deepEqual(cola.todos(), []);
});

test('cola: JSON corrupto no fija persistente=false y no rompe la cola', () => {
  const alm = almacenFalso(); alm.setItem('setas:borradores', '{no es json');
  const cola = colaBorradores(alm);
  assert.deepEqual(cola.todos(), []);
  assert.equal(cola.anadir({ id: 'a' }), true);
  assert.equal(cola.persistente, true);
  assert.equal(colaBorradores(alm).todos().length, 1);
});

test('cola.actualizar no reañade un borrador que otra pestaña ya subió y quitó', () => {
  const alm = almacenFalso();
  const pestanaA = colaBorradores(alm), pestanaB = colaBorradores(alm);
  pestanaA.anadir({ id: 'a', v: 1 });
  pestanaB.quitar('a');
  pestanaA.actualizar({ id: 'a', v: 2 });
  assert.deepEqual(colaBorradores(alm).todos(), []);
  pestanaA.anadir({ id: 'c', v: 1 }); pestanaA.actualizar({ id: 'c', v: 2 });
  assert.equal(colaBorradores(alm).todos()[0].v, 2);
});

test('sincronizar sube también lo añadido mientras sube y guarda el último error del fallido', async () => {
  const cola = colaBorradores(almacenFalso());
  cola.anadir({ id: 'a', fotos: [] }); cola.anadir({ id: 'mal', fotos: [] });
  const orden = [];
  const r = await sincronizar({ cola, subir: async (b) => {
    orden.push(b.id);
    if (b.id === 'a') cola.anadir({ id: 'tarde', fotos: [] });   // llega a mitad de la tanda
    if (b.id === 'mal') throw new Error('HTTP 503');
  } });
  assert.deepEqual(orden, ['a', 'mal', 'tarde']);
  assert.deepEqual(r, { subidas: 2, fallidas: 1 });
  assert.equal(cola.todos()[0].ultimoError, 'HTTP 503');
});

test('crearSalida: una respuesta perdida del alta no crea una segunda salida (la clave es el id del borrador)', async () => {
  const sb = supabaseFalso({ pierdeRespuestaUpsert: true });
  const b = { id: '0b2f3b9e-0000-4000-8000-000000000001', fecha: '2026-10-12', zona_id: 'soria', fotos: [foto(1)] };
  await assert.rejects(() => crearSalida(b, { supabase: sb }), /respuesta perdida/);
  assert.equal(b.remotoId, undefined);
  await crearSalida(b, { supabase: sb });
  assert.equal(sb.bd.salidas.length, 1);
  assert.equal(sb.bd.salidas[0].id, b.id);
  assert.equal(sb.registro.upserts, 2);
  assert.equal(sb.bd.fotos.length, 1);
});

test('crearSalida no duplica la fila de foto si la subida se repite tras una respuesta perdida', async () => {
  const sb = supabaseFalso();
  sb.bd.fotos.push({ salida_id: 'b1', ruta: 'b1/1.jpg' });   // la fila ya estaba, la respuesta se perdió
  await crearSalida({ id: 'b1', remotoId: 'b1', fotos: [foto(1)] }, { supabase: sb });
  assert.equal(sb.bd.fotos.length, 1);
  assert.deepEqual(sb.registro.subidas, ['b1/1.jpg']);
});

test('prepararFotosBorrador: con IndexedDB guarda los blobs y el borrador solo lleva metadatos', async () => {
  const alm = almacenMemoria();
  const r = await prepararFotosBorrador('d1', [fotoLocal(1), fotoLocal(2)], { almacen: alm });
  assert.equal(r.enAlmacen, true);
  assert.deepEqual(r.fotos.map((f) => f.clave), ['d1/1', 'd1/2']);
  assert.ok(r.fotos.every((f) => f.dataUrl === undefined));
  assert.equal(alm.m.size, 2);
});

test('prepararFotosBorrador: IndexedDB que falla → limpia y cae a dataUrl con presupuesto', async () => {
  const alm = almacenMemoria({ falla: true });
  const r = await prepararFotosBorrador('d1', [fotoLocal(1)], { almacen: alm });
  assert.equal(r.enAlmacen, false);
  assert.ok(r.fotos[0].dataUrl);
  const sinIdb = await prepararFotosBorrador('d2', [fotoLocal(1)], { almacen: null });
  assert.equal(sinIdb.enAlmacen, false);
});

test('prepararFotosBorrador: sin IndexedDB y por encima del presupuesto avisa en vez de perder datos', async () => {
  await assert.rejects(() => prepararFotosBorrador('d1', [fotoLocal(1, 600), fotoLocal(2, 600)], { almacen: null, presupuesto: 1000 }), /no caben/);
  assert.equal(cabeEnPresupuesto([fotoLocal(1, 600)], fotoLocal(2, 300), 1000), true);
  assert.equal(cabeEnPresupuesto([fotoLocal(1, 600)], fotoLocal(2, 600), 1000), false);
});

test('crearSalida con fotos en IndexedDB: las lee del almacén, las sube y las borra del móvil', async () => {
  const sb = supabaseFalso(), alm = almacenMemoria();
  const { fotos } = await prepararFotosBorrador('d1', [fotoLocal(1), fotoLocal(2)], { almacen: alm });
  await crearSalida({ id: 'd1', fecha: '2026-10-12', fotos }, { supabase: sb, almacenFotos: alm });
  assert.deepEqual(sb.registro.subidas, ['d1/1.jpg', 'd1/2.jpg']);
  assert.equal(alm.m.size, 0);
  const b = { id: 'd2', fotos: [{ clave: 'd2/1', ancho: 1, alto: 1 }] };
  await assert.rejects(() => crearSalida(b, { supabase: sb, almacenFotos: alm }), /Falta una foto/);
});

test('crearSalida solo envía columnas reales de salidas (nada de ultimoError ni campos locales)', async () => {
  const sb = supabaseFalso();
  await crearSalida({ id: 'b1', fecha: '2026-10-12', zona_id: 'z', notas: 'x', ultimoError: 'HTTP 503', fotosSubidas: 0, fotos: [] }, { supabase: sb });
  assert.deepEqual(Object.keys(sb.bd.salidas[0]).sort(), ['fecha', 'id', 'notas', 'zona_id']);
});

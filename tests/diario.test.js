import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serieSintetica, lluviaBuena, BOLETUS } from './ayudas.js';
import { fotoFijaDelDia, colaBorradores, sincronizar, crearSalida, borrarSalida, listarSalidas, urlFoto, ajustarATamano, recortarSerie, puntoMasCercano, totalKg } from '../js/diario.js';

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
  const [a, b] = await Promise.all([sincronizar({ cola, subir }), sincronizar({ cola, subir })]);
  assert.equal(llamadas, 1);
  assert.deepEqual(a, b);
});

test('almacén roto → la cola funciona en memoria y avisa', () => {
  const roto = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const cola = colaBorradores(roto);
  cola.anadir({ id: 'b1', fotos: [] });
  assert.equal(cola.todos().length, 1);
  assert.equal(cola.persistente, false);
});

// ---- Supabase falso: tablas y Storage en memoria, con fallos programables ----
function supabaseFalso({ fallaSubidaN = null } = {}) {
  const bd = { salidas: [], fotos: [] }, objetos = new Map();
  const registro = { inserts: 0, subidas: [] };
  let subidasIntentadas = 0;
  const tabla = (nombre) => ({
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
  assert.equal(id, 'salidas-1');
  assert.deepEqual(sb.registro.subidas, ['salidas-1/1.jpg', 'salidas-1/2.jpg']);
  assert.equal(sb.bd.fotos.length, 2);
  for (const campo of ['fotos', 'remotoId', 'fotosSubidas']) assert.equal(Object.hasOwn(sb.bd.salidas[0], campo), false, campo);
});

test('crearSalida es idempotente: si falla la 2.ª foto, el reintento no duplica la salida y sube solo las pendientes', async () => {
  const sb = supabaseFalso({ fallaSubidaN: 2 });
  const guardados = [];
  const b = { id: 'b1', fecha: '2026-10-12', zona_id: 'soria', fotos: [foto(1), foto(2), foto(3)] };
  await assert.rejects(() => crearSalida(b, { supabase: sb, persistir: (x) => guardados.push(JSON.parse(JSON.stringify(x))) }));
  assert.equal(sb.registro.inserts, 1);
  assert.deepEqual(sb.registro.subidas, ['salidas-1/1.jpg']);
  const ultimo = guardados.at(-1);
  assert.equal(ultimo.remotoId, 'salidas-1');
  // reintento desde el borrador guardado (como lo leería la cola)
  const id = await crearSalida(ultimo, { supabase: sb });
  assert.equal(id, 'salidas-1');
  assert.equal(sb.registro.inserts, 1, 'no se crea otra salida');
  assert.deepEqual(sb.registro.subidas, ['salidas-1/1.jpg', 'salidas-1/2.jpg', 'salidas-1/3.jpg'], 'la 1.ª no se vuelve a subir');
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

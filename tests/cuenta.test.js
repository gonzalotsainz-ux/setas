import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizarCodigo, sesionActual, entrarConGoogle, entrarPorRedireccion, salir, cargarPerfil, crearPerfil, renombrarPerfil, borrarCuenta, guardarRutaPendiente, tomarRutaPendiente, textoError } from '../js/cuenta.js';

function sbFalso({ sesion = null, errorSesion = null, perfil = null, errorPerfil = null, rpc = {}, idToken = { data: { user: { id: 'u1' } }, error: null }, salidasIds = [] } = {}) {
  const llamadas = { rpc: [], idToken: [], oauth: [], signOut: 0 };
  return {
    llamadas,
    auth: {
      getSession: async () => ({ data: { session: sesion }, error: errorSesion }),
      signInWithIdToken: async (args) => { llamadas.idToken.push(args); return idToken; },
      signInWithOAuth: async (args) => { llamadas.oauth.push(args); return { data: {}, error: null }; },
      signOut: async () => { llamadas.signOut++; return { error: null }; },
    },
    from: (tabla) => ({
      select: () => ({
        eq: tabla === 'salidas'
          ? async () => ({ data: salidasIds.map((id) => ({ id })), error: null })
          : () => ({ maybeSingle: async () => (errorPerfil ? { data: null, error: errorPerfil } : { data: perfil, error: null }) }),
      }),
    }),
    rpc: async (nombre, args) => { llamadas.rpc.push({ nombre, args }); return rpc[nombre] ?? { data: null, error: null }; },
  };
}

function almacenFalso() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}

test('normalizarCodigo: mayúsculas, sin separadores y O→0, I/L→1', () => {
  assert.equal(normalizarCodigo(' k7qm-4xr9 td2b-wphn '), 'K7QM4XR9TD2BWPHN');
  assert.equal(normalizarCodigo('oil-OIL'), '011011');
  assert.equal(normalizarCodigo(null), '');
});

test('sesionActual: null sin sesión; uid y nombre de Google con ella; el error se propaga', async () => {
  assert.equal(await sesionActual({ supabase: sbFalso() }), null);
  const con = sbFalso({ sesion: { user: { id: 'u1', user_metadata: { full_name: 'Ana Pérez', name: 'otro' } } } });
  assert.deepEqual(await sesionActual({ supabase: con }), { uid: 'u1', nombreGoogle: 'Ana Pérez' });
  const soloName = sbFalso({ sesion: { user: { id: 'u2', user_metadata: { name: 'Luis' } } } });
  assert.deepEqual(await sesionActual({ supabase: soloName }), { uid: 'u2', nombreGoogle: 'Luis' });
  const sinMeta = sbFalso({ sesion: { user: { id: 'u3' } } });
  assert.deepEqual(await sesionActual({ supabase: sinMeta }), { uid: 'u3', nombreGoogle: '' });
  await assert.rejects(() => sesionActual({ supabase: sbFalso({ errorSesion: new Error('refresh fallido') }) }), /refresh fallido/);
});

test('entrarConGoogle manda la credencial y el nonce en claro', async () => {
  const sb = sbFalso({ idToken: { data: { user: { id: 'u1' } }, error: null } });
  assert.equal(await entrarConGoogle({ supabase: sb, credencial: 'tok', nonce: { bruto: 'n', hash: 'h' } }), 'u1');
  assert.deepEqual(sb.llamadas.idToken[0], { provider: 'google', token: 'tok', nonce: 'n' });
});

test('entrarConGoogle propaga el error', async () => {
  const sb = sbFalso({ idToken: { data: null, error: new Error('nonce no válido') } });
  await assert.rejects(() => entrarConGoogle({ supabase: sb, credencial: 'tok', nonce: { bruto: 'n', hash: 'h' } }), /nonce no válido/);
});

test('entrarPorRedireccion pasa redirectTo y propaga el error', async () => {
  const sb = sbFalso();
  await entrarPorRedireccion({ supabase: sb, redirigirA: 'https://x.test/' });
  assert.deepEqual(sb.llamadas.oauth[0], { provider: 'google', options: { redirectTo: 'https://x.test/' } });
  const mal = sbFalso();
  mal.auth.signInWithOAuth = async () => ({ data: null, error: new Error('oauth caído') });
  await assert.rejects(() => entrarPorRedireccion({ supabase: mal, redirigirA: 'https://x.test/' }), /oauth caído/);
});

test('salir cierra la sesión y propaga el error', async () => {
  const sb = sbFalso();
  await salir({ supabase: sb });
  assert.equal(sb.llamadas.signOut, 1);
  sb.auth.signOut = async () => ({ error: new Error('no se pudo salir') });
  await assert.rejects(() => salir({ supabase: sb }), /no se pudo salir/);
});

test('cargarPerfil: sin-sesion, sin-perfil (con nombre de Google), perfil; el error de red se propaga', async () => {
  assert.deepEqual(await cargarPerfil({ supabase: sbFalso() }), { estado: 'sin-sesion' });
  const sesion = { user: { id: 'u1', user_metadata: { full_name: 'Ana Pérez' } } };
  assert.deepEqual(await cargarPerfil({ supabase: sbFalso({ sesion, perfil: null }) }), { estado: 'sin-perfil', uid: 'u1', nombreGoogle: 'Ana Pérez' });
  assert.deepEqual(await cargarPerfil({ supabase: sbFalso({ sesion, perfil: { id: 'u1', nombre: 'Ana' } }) }), { estado: 'perfil', id: 'u1', nombre: 'Ana' });
  await assert.rejects(() => cargarPerfil({ supabase: sbFalso({ sesion, errorPerfil: new Error('Failed to fetch') }) }), /Failed to fetch/);
});

test('crearPerfil y renombrarPerfil llaman a sus funciones', async () => {
  const sb = sbFalso();
  assert.equal(await crearPerfil('Ana', { supabase: sb }), undefined);
  assert.deepEqual(sb.llamadas.rpc[0], { nombre: 'crear_perfil', args: { p_nombre: 'Ana' } });
  await renombrarPerfil('Ana M.', { supabase: sb });
  assert.deepEqual(sb.llamadas.rpc[1], { nombre: 'renombrar_perfil', args: { p_nombre: 'Ana M.' } });
  const mal = sbFalso({ rpc: { crear_perfil: { data: null, error: new Error('perfil_existente') } } });
  await assert.rejects(() => crearPerfil('Ana', { supabase: mal }), /perfil_existente/);
});

test('borrarCuenta pregunta antes al servidor (comprobar_borrar_cuenta), borra cada salida (Storage incluido), llama a borrar_cuenta y cierra la sesión, en ese orden', async () => {
  const orden = [];
  const sb = sbFalso({ salidasIds: ['a', 'b'] });
  sb.rpc = async (n) => { orden.push(n); return { data: null, error: null }; };
  sb.auth.signOut = async () => { orden.push('signOut'); return { error: null }; };
  await borrarCuenta({ supabase: sb, usuarioId: 'u1', borrar: async (id) => { orden.push(`borrar:${id}`); } });
  assert.deepEqual(orden, ['comprobar_borrar_cuenta', 'borrar:a', 'borrar:b', 'borrar_cuenta', 'signOut']);
});

test('borrarCuenta: si el servidor la rechaza de antemano (ultimo_admin) no se borra ninguna salida ni se cierra la sesión', async () => {
  const sb = sbFalso({ salidasIds: ['a', 'b'], rpc: { comprobar_borrar_cuenta: { data: null, error: new Error('ultimo_admin') } } });
  const borradas = [];
  await assert.rejects(() => borrarCuenta({ supabase: sb, usuarioId: 'u1', borrar: async (id) => { borradas.push(id); } }), /ultimo_admin/);
  assert.deepEqual(borradas, []);
  assert.deepEqual(sb.llamadas.rpc.map((r) => r.nombre), ['comprobar_borrar_cuenta']);
  assert.equal(sb.llamadas.signOut, 0);
});

test('el cliente de Supabase usa el flujo PKCE: al volver de Google el código va en la query y no en un hash que la ruta pendiente pisaría', () => {
  const fuente = readFileSync(new URL('../js/supabase.js', import.meta.url), 'utf8');
  assert.match(fuente, /flowType:\s*'pkce'/);
});

test('borrarCuenta: si falla borrar una salida no llama a borrar_cuenta', async () => {
  const sb = sbFalso({ salidasIds: ['a', 'b'] });
  await assert.rejects(() => borrarCuenta({ supabase: sb, usuarioId: 'u1', borrar: async (id) => { if (id === 'b') throw new Error('storage caído'); } }), /storage caído/);
  assert.deepEqual(sb.llamadas.rpc.map((r) => r.nombre), ['comprobar_borrar_cuenta'], 'solo la comprobación previa; borrar_cuenta no se llama');
  assert.equal(sb.llamadas.signOut, 0);
});

test('ruta pendiente: se guarda, se toma una sola vez y se ignora lo que no empieza por #', () => {
  const alm = almacenFalso();
  guardarRutaPendiente('#unirse/ABCD2345', alm); assert.equal(tomarRutaPendiente(alm), '#unirse/ABCD2345'); assert.equal(tomarRutaPendiente(alm), null);
  guardarRutaPendiente('javascript:x', alm); assert.equal(tomarRutaPendiente(alm), null);
  guardarRutaPendiente(undefined, alm); assert.equal(tomarRutaPendiente(alm), null);
  alm.setItem('setas.ruta', 'https://malo.test');
  assert.equal(tomarRutaPendiente(alm), null);
  assert.equal(alm.getItem('setas.ruta'), null);   // se borra aunque no sea válida
});

test('ruta pendiente: un almacén que lanza no rompe nada', () => {
  const roto = { getItem() { throw new Error('privado'); }, setItem() { throw new Error('privado'); }, removeItem() { throw new Error('privado'); } };
  assert.doesNotThrow(() => guardarRutaPendiente('#x', roto));
  assert.equal(tomarRutaPendiente(roto), null);
});

test('textoError: sin_sesion, Failed to fetch y los de grupos', () => {
  assert.equal(textoError(new Error('sin_sesion')), 'Entra con Google para continuar.');
  assert.equal(textoError(new TypeError('Failed to fetch')), 'Sin conexión.');
  assert.match(textoError(new Error('demasiados_intentos')), /Demasiados intentos/);
  assert.equal(textoError(new Error('demasiados_grupos')), 'Has creado demasiados grupos (máximo 10).');
  assert.equal(textoError({ message: 'solo_post' }), 'Petición no válida. Recarga la página y vuelve a probar.');
  assert.match(textoError({ message: 'ultimo_admin' }), /único administrador/);
  assert.match(textoError({ message: 'ultimo_admin' }), /borra el grupo/, 'vale también al borrar la cuenta: ofrece nombrar sucesor o borrar el grupo');
  assert.match(textoError(new Error('perfil_existente')), /ya tiene un perfil/);
  assert.equal(textoError(new Error('algo raro')), 'algo raro');
  assert.equal(textoError(null), 'Algo ha fallado.');
});

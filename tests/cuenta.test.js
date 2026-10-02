import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarCodigo, formatearCodigo, codigoRecuperacionValido, asegurarSesion, cargarPerfil, crearPerfil, regenerarRecuperacion, renombrarPerfil, recuperarCuenta, textoError } from '../js/cuenta.js';

function sbFalso({ sesion = null, perfil = null, errorPerfil = null, rpc = {} } = {}) {
  const llamadas = { rpc: [], signIn: 0 };
  const sb = {
    llamadas,
    auth: {
      getSession: async () => ({ data: { session: sesion } }),
      signInAnonymously: async () => { llamadas.signIn++; await new Promise((r) => setTimeout(r, 5)); return { data: { user: { id: 'u-nuevo' } }, error: null }; },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => (errorPerfil ? { data: null, error: errorPerfil } : { data: perfil, error: null }) }) }) }),
    rpc: async (nombre, args) => { llamadas.rpc.push({ nombre, args }); return rpc[nombre] ?? { data: null, error: null }; },
  };
  return sb;
}

test('normalizarCodigo: mayúsculas, sin separadores y O→0, I/L→1', () => {
  assert.equal(normalizarCodigo(' k7qm-4xr9 td2b-wphn '), 'K7QM4XR9TD2BWPHN');
  assert.equal(normalizarCodigo('oil-OIL'), '011011');
  assert.equal(normalizarCodigo(null), '');
});

test('formatearCodigo agrupa de 4 en 4', () => {
  assert.equal(formatearCodigo('K7QM4XR9TD2BWPHN'), 'K7QM-4XR9-TD2B-WPHN');
  assert.equal(formatearCodigo('k7qm 4xr9'), 'K7QM-4XR9');
  assert.equal(formatearCodigo(''), '');
});

test('codigoRecuperacionValido exige 16 caracteres del alfabeto', () => {
  assert.equal(codigoRecuperacionValido('K7QM-4XR9-TD2B-WPHN'), true);
  assert.equal(codigoRecuperacionValido('k7qm4xr9td2bwphn'), true);
  assert.equal(codigoRecuperacionValido('K7QM-4XR9-TD2B'), false);
  assert.equal(codigoRecuperacionValido('K7QM-4XR9-TD2B-WPH!'), false);
  assert.equal(codigoRecuperacionValido('UUUU-UUUU-UUUU-UUUU'), false);   // la U no está en el alfabeto
  assert.equal(codigoRecuperacionValido(undefined), false);
});

test('asegurarSesion reutiliza la sesión existente y solo entra como anónimo si no la hay', async () => {
  const con = sbFalso({ sesion: { user: { id: 'u1' } } });
  assert.equal(await asegurarSesion({ supabase: con }), 'u1');
  assert.equal(con.llamadas.signIn, 0);
  const sin = sbFalso();
  assert.equal(await asegurarSesion({ supabase: sin }), 'u-nuevo');
  assert.equal(sin.llamadas.signIn, 1);
});

test('asegurarSesion: llamadas simultáneas comparten una sola entrada anónima', async () => {
  const sb = sbFalso();
  const ids = await Promise.all([asegurarSesion({ supabase: sb }), asegurarSesion({ supabase: sb }), asegurarSesion({ supabase: sb })]);
  assert.deepEqual(ids, ['u-nuevo', 'u-nuevo', 'u-nuevo']);
  assert.equal(sb.llamadas.signIn, 1);
});

test('asegurarSesion propaga el error si las cuentas anónimas están desactivadas', async () => {
  const sb = sbFalso();
  sb.auth.signInAnonymously = async () => ({ data: null, error: new Error('Anonymous sign-ins are disabled') });
  await assert.rejects(() => asegurarSesion({ supabase: sb }), /Anonymous sign-ins/);
});

test('cargarPerfil: perfil, sin perfil (null) y error de red (se propaga, NO es «sin perfil»)', async () => {
  const sesion = { user: { id: 'u1' } };
  assert.deepEqual(await cargarPerfil({ supabase: sbFalso({ sesion, perfil: { id: 'u1', nombre: 'Ana' } }) }), { id: 'u1', nombre: 'Ana' });
  assert.equal(await cargarPerfil({ supabase: sbFalso({ sesion, perfil: null }) }), null);
  await assert.rejects(() => cargarPerfil({ supabase: sbFalso({ sesion, errorPerfil: new Error('Failed to fetch') }) }), /Failed to fetch/);
});

test('crearPerfil llama a la función y devuelve el código formateado', async () => {
  const sb = sbFalso({ sesion: { user: { id: 'u1' } }, rpc: { crear_perfil: { data: 'K7QM4XR9TD2BWPHN', error: null } } });
  assert.equal(await crearPerfil('Ana', { supabase: sb }), 'K7QM-4XR9-TD2B-WPHN');
  assert.deepEqual(sb.llamadas.rpc[0], { nombre: 'crear_perfil', args: { p_nombre: 'Ana' } });
});

test('regenerarRecuperacion y renombrarPerfil', async () => {
  const sb = sbFalso({ sesion: { user: { id: 'u1' } }, rpc: { regenerar_recuperacion: { data: 'AAAABBBBCCCCDDDD', error: null } } });
  assert.equal(await regenerarRecuperacion({ supabase: sb }), 'AAAA-BBBB-CCCC-DDDD');
  await renombrarPerfil('Ana M.', { supabase: sb });
  assert.deepEqual(sb.llamadas.rpc.at(-1), { nombre: 'renombrar_perfil', args: { p_nombre: 'Ana M.' } });
});

test('recuperarCuenta: un código mal formado no llega al servidor; uno válido va normalizado', async () => {
  const sb = sbFalso({ sesion: { user: { id: 'u1' } }, rpc: { recuperar_cuenta: { data: true, error: null } } });
  assert.equal(await recuperarCuenta('corto', { supabase: sb }), false);
  assert.equal(sb.llamadas.rpc.length, 0);
  assert.equal(await recuperarCuenta('k7qm-4xr9 td2b-wphn', { supabase: sb }), true);
  assert.deepEqual(sb.llamadas.rpc[0], { nombre: 'recuperar_cuenta', args: { p_codigo: 'K7QM4XR9TD2BWPHN' } });
  const no = sbFalso({ sesion: { user: { id: 'u1' } }, rpc: { recuperar_cuenta: { data: false, error: null } } });
  assert.equal(await recuperarCuenta('K7QM-4XR9-TD2B-WPHN', { supabase: no }), false);
});

test('recuperarCuenta propaga los errores del servidor', async () => {
  const sb = sbFalso({ sesion: { user: { id: 'u1' } }, rpc: { recuperar_cuenta: { data: null, error: new Error('demasiados_intentos') } } });
  await assert.rejects(() => recuperarCuenta('K7QM-4XR9-TD2B-WPHN', { supabase: sb }), /demasiados_intentos/);
});

test('textoError traduce los errores del servidor y deja pasar los demás', () => {
  assert.match(textoError(new Error('demasiados_intentos')), /Demasiados intentos/);
  assert.match(textoError({ message: 'ultimo_admin' }), /único administrador/);
  assert.match(textoError(new Error('Anonymous sign-ins are disabled')), /cuentas anónimas/);
  assert.equal(textoError(new Error('algo raro')), 'algo raro');
  assert.equal(textoError(null), 'Algo ha fallado.');
});

test('textoError traduce demasiados_grupos y solo_post', () => {
  assert.equal(textoError(new Error('demasiados_grupos')), 'Has creado demasiados grupos (máximo 10).');
  assert.equal(textoError({ message: 'solo_post' }), 'Petición no válida. Recarga la página y vuelve a probar.');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MIEMBROS, crearGrupo, misGrupos, unirseAGrupo, regenerarCodigo, renombrarGrupo, miembrosDelGrupo, expulsarMiembro, hacerAdmin, salirDelGrupo, borrarGrupo, salidasSinDueno, reclamarSalidas, enlaceInvitacion, leerCodigoUnirse, salidasDelGrupo } from '../js/grupos.js';

function sbFalso(respuestas = {}, session = { user: { id: 'u1' } }) {
  const llamadas = [];
  return {
    llamadas,
    auth: { getSession: async () => ({ data: { session } }) },
    rpc: async (nombre, args) => { llamadas.push({ nombre, args }); return respuestas[nombre] ?? { data: null, error: null }; },
  };
}

test('MAX_MIEMBROS coincide con el tope del servidor', () => assert.equal(MAX_MIEMBROS, 20));

test('crearGrupo devuelve la primera fila (id y código)', async () => {
  const sb = sbFalso({ crear_grupo: { data: [{ grupo_id: 'g1', codigo: 'ABCD2345' }], error: null } });
  assert.deepEqual(await crearGrupo('Amigos', { supabase: sb }), { grupo_id: 'g1', codigo: 'ABCD2345' });
  assert.deepEqual(sb.llamadas[0], { nombre: 'crear_grupo', args: { p_nombre: 'Amigos' } });
});

test('misGrupos y miembrosDelGrupo devuelven las filas (o lista vacía)', async () => {
  const sb = sbFalso({ mis_grupos: { data: [{ grupo_id: 'g1', nombre: 'A', rol: 'admin', miembros: 2 }], error: null }, miembros_del_grupo: { data: null, error: null } });
  assert.equal((await misGrupos({ supabase: sb })).length, 1);
  assert.deepEqual(await miembrosDelGrupo('g1', { supabase: sb }), []);
  assert.deepEqual(sb.llamadas[1].args, { p_grupo: 'g1' });
});

test('unirseAGrupo normaliza el código y devuelve null si no existe', async () => {
  const sb = sbFalso({ unirse_grupo: { data: null, error: null } });
  assert.equal(await unirseAGrupo(' abcd-2345 ', { supabase: sb }), null);
  assert.deepEqual(sb.llamadas[0].args, { p_codigo: 'ABCD2345' });
  const ok = sbFalso({ unirse_grupo: { data: 'g1', error: null } });
  assert.equal(await unirseAGrupo('ABCD2345', { supabase: ok }), 'g1');
});

test('los errores del servidor se propagan', async () => {
  const sb = sbFalso({ expulsar_miembro: { data: null, error: new Error('no_admin') } });
  await assert.rejects(() => expulsarMiembro('g1', 'u2', { supabase: sb }), /no_admin/);
});

test('administración del grupo: parámetros de cada función', async () => {
  const sb = sbFalso({ regenerar_codigo: { data: 'ZZZZ9999', error: null } });
  assert.equal(await regenerarCodigo('g1', { supabase: sb }), 'ZZZZ9999');
  await renombrarGrupo('g1', 'Nuevo', { supabase: sb });
  await hacerAdmin('g1', 'u2', { supabase: sb });
  await salirDelGrupo('g1', { supabase: sb });
  await borrarGrupo('g1', { supabase: sb });
  assert.deepEqual(sb.llamadas.map((l) => l.nombre), ['regenerar_codigo', 'renombrar_grupo', 'hacer_admin', 'salir_grupo', 'borrar_grupo']);
  assert.deepEqual(sb.llamadas[1].args, { p_grupo: 'g1', p_nombre: 'Nuevo' });
  assert.deepEqual(sb.llamadas[2].args, { p_grupo: 'g1', p_usuario: 'u2' });
});

test('reclamo de salidas antiguas', async () => {
  const sb = sbFalso({ salidas_sin_dueno: { data: [{ autor: 'Ana', n: 3 }], error: null }, reclamar_salidas: { data: 3, error: null } });
  assert.deepEqual(await salidasSinDueno({ supabase: sb }), [{ autor: 'Ana', n: 3 }]);
  assert.equal(await reclamarSalidas('Ana', { supabase: sb }), 3);
  assert.deepEqual(sb.llamadas[1].args, { p_autor: 'Ana' });
});

test('enlaceInvitacion usa #unirse/CODIGO', () => {
  assert.equal(enlaceInvitacion('ABCD2345', 'https://x.github.io/setas/'), 'https://x.github.io/setas/#unirse/ABCD2345');
});

test('leerCodigoUnirse: acepta códigos de 8 caracteres en cualquier formato y rechaza el resto', () => {
  assert.equal(leerCodigoUnirse('abcd2345'), 'ABCD2345');
  assert.equal(leerCodigoUnirse('ABCD-2345'), 'ABCD2345');
  assert.equal(leerCodigoUnirse('ABCD234'), null);
  assert.equal(leerCodigoUnirse('ABCD234U'), null);   // la U no existe en el alfabeto
  assert.equal(leerCodigoUnirse(undefined), null);
  assert.equal(leerCodigoUnirse('../../x'), null);
});

test('sin sesión, llamar rechaza con sin_sesion y no llama al servidor', async () => {
  const sb = sbFalso({}, null);
  await assert.rejects(() => misGrupos({ supabase: sb }), /sin_sesion/);
  assert.equal(sb.llamadas.length, 0);
});

test('salidasDelGrupo: paginación por defecto y explícita', async () => {
  const sb = sbFalso({ salidas_del_grupo: { data: [{ id: 's1', fotos: [] }], error: null } });
  assert.deepEqual(await salidasDelGrupo('g1', { supabase: sb }), [{ id: 's1', fotos: [] }]);
  assert.deepEqual(sb.llamadas[0], { nombre: 'salidas_del_grupo', args: { p_grupo: 'g1', p_antes: null, p_limite: 20 } });
  await salidasDelGrupo('g1', { supabase: sb, antes: '2026-10-01T00:00:00Z', limite: 5 });
  assert.deepEqual(sb.llamadas[1].args, { p_grupo: 'g1', p_antes: '2026-10-01T00:00:00Z', p_limite: 5 });
});

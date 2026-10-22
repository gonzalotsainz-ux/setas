// Grupos de amigos: llamadas a las funciones del servidor (con el cliente inyectado) y utilidades puras.
import { sesionActual, normalizarCodigo } from './cuenta.js';
import { firmarFotos } from './diario.js';

export const MAX_MIEMBROS = 20;   // el tope real lo pone el servidor (max_miembros_grupo()); aquí solo se muestra

async function llamar(nombre, args, { supabase }) {
  if (!await sesionActual({ supabase })) throw new Error('sin_sesion');
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw error;
  return data;
}

export async function crearGrupo(nombre, { supabase }) {
  const filas = await llamar('crear_grupo', { p_nombre: nombre }, { supabase });
  return filas[0];
}
export const misGrupos = async ({ supabase }) => (await llamar('mis_grupos', undefined, { supabase })) ?? [];
// null = el código no existe (o está mal escrito); lanza si el grupo está lleno o hay demasiados intentos.
export const unirseAGrupo = (codigo, { supabase }) => llamar('unirse_grupo', { p_codigo: normalizarCodigo(codigo) }, { supabase });
export const regenerarCodigo = (grupoId, { supabase }) => llamar('regenerar_codigo', { p_grupo: grupoId }, { supabase });
export const renombrarGrupo = (grupoId, nombre, { supabase }) => llamar('renombrar_grupo', { p_grupo: grupoId, p_nombre: nombre }, { supabase });
export const miembrosDelGrupo = async (grupoId, { supabase }) => (await llamar('miembros_del_grupo', { p_grupo: grupoId }, { supabase })) ?? [];
export const expulsarMiembro = (grupoId, usuarioId, { supabase }) => llamar('expulsar_miembro', { p_grupo: grupoId, p_usuario: usuarioId }, { supabase });
export const hacerAdmin = (grupoId, usuarioId, { supabase }) => llamar('hacer_admin', { p_grupo: grupoId, p_usuario: usuarioId }, { supabase });
export const salirDelGrupo = (grupoId, { supabase }) => llamar('salir_grupo', { p_grupo: grupoId }, { supabase });
export const borrarGrupo = (grupoId, { supabase }) => llamar('borrar_grupo', { p_grupo: grupoId }, { supabase });

// Salidas de los miembros del grupo, de la más reciente a la más antigua; `antes` (fecha ISO) pide la página siguiente.
export async function salidasDelGrupo(grupoId, { supabase, antes = null, limite = 20 }) {
  const salidas = (await llamar('salidas_del_grupo', { p_grupo: grupoId, p_antes: antes, p_limite: limite }, { supabase })) ?? [];
  return firmarFotos(salidas, { supabase });
}

export const salidasSinDueno = async ({ supabase }) => (await llamar('salidas_sin_dueno', undefined, { supabase })) ?? [];
export const reclamarSalidas = (autor, { supabase }) => llamar('reclamar_salidas', { p_autor: autor }, { supabase });

export function enlaceInvitacion(codigo, base = globalThis.location ? `${globalThis.location.origin}${globalThis.location.pathname}` : '') {
  return `${base}#unirse/${codigo}`;
}

// Código de grupo (8 caracteres del alfabeto Crockford) leído de la URL `#unirse/CODIGO`; null si no lo es.
export function leerCodigoUnirse(param) {
  const c = normalizarCodigo(param);
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(c) ? c : null;
}

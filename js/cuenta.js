// Cuenta del usuario: sesión de Google (Supabase Auth), perfil y ruta pendiente.
// Todo con el cliente inyectado ({ supabase }) para poder probarlo sin red.
import { borrarSalida } from './diario.js';

// Quita separadores y unifica lo que se confunde al teclear (O→0, I y L→1), igual que el servidor.
// (Lo usa grupos.js para los códigos de invitación.)
export const normalizarCodigo = (t) => String(t ?? '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

const nombreDe = (user) => user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '';

// null = no hay sesión. Un fallo al leerla se propaga: no es lo mismo que «sin sesión».
export async function sesionActual({ supabase }) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const s = data?.session;
  return s ? { uid: s.user.id, nombreGoogle: nombreDe(s.user) } : null;
}

export async function entrarConGoogle({ supabase, credencial, nonce }) {
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credencial, nonce: nonce.bruto });
  if (error) throw error;
  return data.user.id;
}

export async function entrarPorRedireccion({ supabase, redirigirA }) {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirigirA } });
  if (error) throw error;
}

export async function salir({ supabase }) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Un fallo de red se propaga: tomarlo por «sin perfil» haría crear un perfil duplicado.
export async function cargarPerfil({ supabase }) {
  const sesion = await sesionActual({ supabase });
  if (!sesion) return { estado: 'sin-sesion' };
  const { data, error } = await supabase.from('perfiles').select('id, nombre').eq('id', sesion.uid).maybeSingle();
  if (error) throw error;
  return data
    ? { estado: 'perfil', id: data.id, nombre: data.nombre }
    : { estado: 'sin-perfil', uid: sesion.uid, nombreGoogle: sesion.nombreGoogle };
}

export async function crearPerfil(nombre, { supabase }) {
  const { error } = await supabase.rpc('crear_perfil', { p_nombre: nombre });
  if (error) throw error;
}

export async function renombrarPerfil(nombre, { supabase }) {
  const { error } = await supabase.rpc('renombrar_perfil', { p_nombre: nombre });
  if (error) throw error;
}

// Primero los objetos de Storage y las filas de cada salida; solo si todo va bien se borra la cuenta.
export async function borrarCuenta({ supabase, usuarioId, borrar = borrarSalida }) {
  const { data, error } = await supabase.from('salidas').select('id').eq('usuario_id', usuarioId);
  if (error) throw error;
  for (const { id } of data ?? []) await borrar(id, { supabase });
  const r = await supabase.rpc('borrar_cuenta');
  if (r.error) throw r.error;
  await salir({ supabase });
}

// Ruta a la que volver tras el viaje de ida y vuelta a Google (solo hashes internos).
const CLAVE_RUTA = 'setas.ruta';
const almacenPorDefecto = () => { try { return globalThis.sessionStorage; } catch { return undefined; } };

export function guardarRutaPendiente(hash, almacen = almacenPorDefecto()) {
  if (typeof hash !== 'string' || !hash.startsWith('#')) return;
  try { almacen.setItem(CLAVE_RUTA, hash); } catch { /* almacén no disponible (p. ej. Safari privado) */ }
}

export function tomarRutaPendiente(almacen = almacenPorDefecto()) {
  try {
    const v = almacen.getItem(CLAVE_RUTA);
    almacen.removeItem(CLAVE_RUTA);
    return typeof v === 'string' && v.startsWith('#') ? v : null;
  } catch { return null; }
}

const ERRORES = [
  ['demasiados_intentos', 'Demasiados intentos. Espera unos minutos y vuelve a probar.'],
  ['demasiados_grupos', 'Has creado demasiados grupos (máximo 10).'],
  ['solo_post', 'Petición no válida. Recarga la página y vuelve a probar.'],
  ['sin_sesion', 'Entra con Google para continuar.'],
  ['perfil_existente', 'Este dispositivo ya tiene un perfil.'],
  ['sin_perfil', 'Primero crea tu perfil.'],
  ['no_admin', 'Solo un administrador puede hacer eso.'],
  ['no_miembro', 'Ya no formas parte de ese grupo.'],
  ['no_es_tuya', 'Esa salida no es tuya.'],
  ['grupo_lleno', 'El grupo está lleno.'],
  ['ultimo_admin', 'Eres el único administrador: nombra a otro antes de salir.'],
  ['usa_salir', 'Para irte tú, usa «Salir del grupo».'],
  ['Failed to fetch', 'Sin conexión.'],
];
export function textoError(e) {
  const m = String(e?.message ?? e ?? '');
  for (const [clave, texto] of ERRORES) if (m.includes(clave)) return texto;
  return m || 'Algo ha fallado.';
}

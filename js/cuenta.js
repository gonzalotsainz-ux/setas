// Cuenta de este dispositivo: sesión anónima de Supabase, perfil y código de recuperación.
// Todo con el cliente inyectado ({ supabase }) para poder probarlo sin red.
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford base32: sin I, L, O, U

// Quita separadores y unifica lo que se confunde al teclear (O→0, I y L→1), igual que el servidor.
export const normalizarCodigo = (t) => String(t ?? '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
export const formatearCodigo = (c, bloque = 4) => normalizarCodigo(c).match(new RegExp(`.{1,${bloque}}`, 'g'))?.join('-') ?? '';
export function codigoRecuperacionValido(t) {
  const n = normalizarCodigo(t);
  return n.length === 16 && [...n].every((c) => ALFABETO.includes(c));
}

// Una sola entrada anónima aunque varias partes de la app la pidan a la vez.
let enCurso = null;
export function asegurarSesion({ supabase }) {
  enCurso ??= (async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;   // un fallo al leer la sesión NO es «sin sesión»: entrar como anónimo huérfana el perfil
    if (data?.session) return data.session.user.id;
    const r = await supabase.auth.signInAnonymously();
    if (r.error) throw r.error;
    return r.data.user.id;
  })().finally(() => { enCurso = null; });
  return enCurso;
}

// `null` solo si el perfil NO existe; un fallo de red se propaga (no es lo mismo: crear otro perfil duplicaría la cuenta).
export async function cargarPerfil({ supabase }) {
  const uid = await asegurarSesion({ supabase });
  const { data, error } = await supabase.from('perfiles').select('id, nombre').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, nombre: data.nombre } : null;
}

function codigoDevuelto(data) {
  const c = formatearCodigo(data);
  if (!c) throw new Error('El servidor no devolvió el código de recuperación.');
  return c;
}

export async function crearPerfil(nombre, { supabase }) {
  await asegurarSesion({ supabase });
  const { data, error } = await supabase.rpc('crear_perfil', { p_nombre: nombre });
  if (error) throw error;
  return codigoDevuelto(data);
}

export async function regenerarRecuperacion({ supabase }) {
  await asegurarSesion({ supabase });
  const { data, error } = await supabase.rpc('regenerar_recuperacion');
  if (error) throw error;
  return codigoDevuelto(data);
}

export async function renombrarPerfil(nombre, { supabase }) {
  await asegurarSesion({ supabase });
  const { error } = await supabase.rpc('renombrar_perfil', { p_nombre: nombre });
  if (error) throw error;
}

// true = esta sesión es ahora la dueña de la cuenta; false = el código no existe o está mal escrito.
export async function recuperarCuenta(codigo, { supabase }) {
  if (!codigoRecuperacionValido(codigo)) return false;
  await asegurarSesion({ supabase });
  const { data, error } = await supabase.rpc('recuperar_cuenta', { p_codigo: normalizarCodigo(codigo) });
  if (error) throw error;
  return data === true;
}

const ERRORES = [
  ['demasiados_intentos', 'Demasiados intentos. Espera unos minutos y vuelve a probar.'],
  ['demasiados_grupos', 'Has creado demasiados grupos (máximo 10).'],
  ['solo_post', 'Petición no válida. Recarga la página y vuelve a probar.'],
  ['sesion_con_perfil', 'Este dispositivo ya tiene un perfil: no se puede recuperar otra cuenta encima.'],
  ['perfil_existente', 'Este dispositivo ya tiene un perfil.'],
  ['sin_perfil', 'Primero crea tu perfil.'],
  ['no_admin', 'Solo un administrador puede hacer eso.'],
  ['no_miembro', 'Ya no formas parte de ese grupo.'],
  ['no_es_tuya', 'Esa salida no es tuya.'],
  ['grupo_lleno', 'El grupo está lleno.'],
  ['ultimo_admin', 'Eres el único administrador: nombra a otro antes de salir.'],
  ['usa_salir', 'Para irte tú, usa «Salir del grupo».'],
  ['Anonymous sign-ins', 'El servidor aún no admite cuentas anónimas: avisa a quien administra la app.'],
];
export function textoError(e) {
  const m = String(e?.message ?? e ?? '');
  for (const [clave, texto] of ERRORES) if (m.includes(clave)) return texto;
  return m || 'Algo ha fallado.';
}

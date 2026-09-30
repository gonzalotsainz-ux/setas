// Cliente de Supabase SIN LOGIN (decisión de la usuaria, 2026-09-30): la clave publicable es pública por diseño
// y, con RLS abierto a `anon`, cualquiera con la URL puede leer y editar el diario.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

export const SUPABASE_URL = 'https://ctgedeunquvmcfqsufjj.supabase.co';
export const SUPABASE_ANON = 'sb_publishable_IkbuQo3x4etQ6Sr5YXU6yQ_IRTjeERV';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const CLAVE_AUTOR = 'setas.autor';

// Nombre que se muestra como autor de las salidas; se elige en el dispositivo (no es una cuenta).
export function autorActual() {
  try { return localStorage.getItem(CLAVE_AUTOR) || null; } catch { return null; }
}
export function elegirAutor(nombre) {
  const limpio = String(nombre ?? '').trim();
  try {
    if (limpio) localStorage.setItem(CLAVE_AUTOR, limpio); else localStorage.removeItem(CLAVE_AUTOR);
  } catch { /* sin almacenamiento: se queda sin recordar */ }
  return limpio || null;
}

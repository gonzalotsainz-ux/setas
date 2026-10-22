// Cliente de Supabase. La sesión es la de Google (ver js/cuenta.js) y la persiste supabase-js con storageKey «setas.sesion».
// La clave publicable es pública por diseño; lo que protege los datos son las políticas RLS de la base de datos.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

import { SUPABASE_URL, SUPABASE_ANON } from './config.js';

export { SUPABASE_URL, SUPABASE_ANON };
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'setas.sesion' },
});

const CLAVE_AUTOR = 'setas.autor';

// Nombre del perfil, guardado también en el dispositivo para poder leerlo sin red (p. ej. al rotular ediciones de umbrales).
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

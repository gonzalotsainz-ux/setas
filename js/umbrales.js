// Umbrales del índice editados (compartidos en Supabase, sin login: cualquiera con la web puede editarlos).
const num = (v) => typeof v === 'number' && Number.isFinite(v);

// Mismas reglas que scripts/validar-datos.mjs para `indice` (pfull > pmin, trango y desfase crecientes) más los
// límites físicos. Devuelve la lista de mensajes; vacía = válido. Solo mira los campos presentes.
export function validarUmbral(p) {
  const e = [];
  for (const k of ['topt', 'pmin', 'pfull']) if (p[k] != null && !num(p[k])) e.push(`El valor de «${k}» debe ser un número`);
  for (const k of ['trango', 'desfase']) {
    if (p[k] != null && !(Array.isArray(p[k]) && p[k].length === 2 && p[k].every(num))) e.push(`El valor de «${k}» debe ser dos números`);
  }
  if (e.length) return e;
  if (p.topt != null && (p.topt < -5 || p.topt > 35)) e.push('La temperatura óptima debe estar entre −5 y 35 °C');
  if (p.trango && !(p.trango[1] > p.trango[0])) e.push('El rango de temperatura debe ir de menor a mayor');
  if (p.trango && (p.trango[0] < -5 || p.trango[1] > 35)) e.push('El rango de temperatura debe estar entre −5 y 35 °C');
  if (p.pmin != null && p.pfull != null && !(p.pfull > p.pmin)) e.push('La lluvia de pleno debe ser mayor que la mínima');
  if (p.pmin != null && p.pmin < 0) e.push('La lluvia mínima no puede ser negativa');
  if (p.desfase && !(p.desfase[1] >= p.desfase[0] && p.desfase[0] >= 0)) e.push('El desfase debe ir de menor a mayor y ser positivo');
  return e;
}

// Filas completas (con autor y fecha) y mapa { especie_id: parciales }; sin red o con error → vacío.
export async function cargarFilasUmbrales(supabase) {
  const { data, error } = await supabase.from('ajustes_umbrales').select('especie_id, parametros, autor, actualizado');
  if (error) throw error;
  return data ?? [];
}
export async function cargarUmbrales(supabase) {
  try { return Object.fromEntries((await cargarFilasUmbrales(supabase)).map((f) => [f.especie_id, f.parametros])); } catch { return {}; }
}
export async function guardarUmbral(supabase, especie_id, parametros, autor = null) {
  const e = validarUmbral(parametros);
  if (e.length) throw new Error(e.join('. '));
  const { error } = await supabase.from('ajustes_umbrales')
    .upsert({ especie_id, parametros, autor: autor || 'desconocido', actualizado: new Date().toISOString() });
  if (error) throw error;
}
export async function restablecerUmbral(supabase, especie_id) {
  const { error } = await supabase.from('ajustes_umbrales').delete().eq('especie_id', especie_id);
  if (error) throw error;
}

// Enlace de invitación (#unirse/CODIGO): no se entra solo; hay que pulsar «Unirme» (el enlace por sí solo no te mete en nada).
import { el } from '../ui/dom.js';
import { supabase } from '../supabase.js';
import { textoError } from '../cuenta.js';
import { leerCodigoUnirse, unirseAGrupo } from '../grupos.js';
import { requerirCuenta } from './cuenta-ui.js';

export function pintar({ param }) {
  const codigo = leerCodigoUnirse(param);
  const aviso = el('p', { clase: 'texto-s', attrs: { role: 'alert' } });
  if (!codigo) {
    return el('div', { clase: 'pila diario' }, el('h1', { texto: 'Invitación' }),
      el('div', { clase: 'tarjeta' }, el('p', { texto: 'Este enlace de invitación no es válido. Pide que te lo envíen de nuevo.' }), el('a', { href: '#grupos', texto: 'Ir a Grupos' })));
  }
  const unirme = el('button', { type: 'button', clase: 'boton', texto: 'Unirme al grupo' });
  unirme.addEventListener('click', async () => {
    unirme.disabled = true; aviso.textContent = '';
    try {
      const cuenta = await requerirCuenta();
      if (!cuenta) { unirme.disabled = false; return; }
      const id = await unirseAGrupo(codigo, { supabase });
      if (!id) { aviso.textContent = 'Esta invitación ya no vale: el código del grupo ha cambiado. Pide uno nuevo.'; unirme.disabled = false; return; }
      location.hash = `#grupos/${id}`;
    } catch (e) { aviso.textContent = e.message?.startsWith('No se puede comprobar') ? e.message : textoError(e); unirme.disabled = false; }
  });
  return el('div', { clase: 'pila diario' }, el('h1', { texto: 'Invitación' }),
    el('div', { clase: 'tarjeta pila' },
      el('p', { texto: 'Te han invitado a un grupo de Setas. Al unirte, sus miembros verán las salidas que tú decidas compartir con ellos (nunca las demás).' }),
      el('p', { clase: 'grupo-codigo', texto: codigo, attrs: { 'aria-label': 'Código de invitación' } }),
      unirme, aviso));
}

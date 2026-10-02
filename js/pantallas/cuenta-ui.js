// Perfil de este dispositivo: crearlo («Tu perfil»), recuperar una cuenta con el código y enseñar el código de recuperación.
import { el } from '../ui/dom.js';
import { abrirHoja } from '../ui/hoja.js';
import { supabase, elegirAutor } from '../supabase.js';
import { cargarPerfil, crearPerfil, recuperarCuenta, asegurarSesion, codigoRecuperacionValido, textoError } from '../cuenta.js';

let cuenta = null;        // { id, nombre } cuando existe
let ultimoError = null;   // último fallo al comprobar el perfil (sin red, cuentas anónimas desactivadas…)

export const errorDeCuenta = () => ultimoError;   // no null = no se pudo comprobar el perfil (p. ej. sin conexión)

export function fijarCuenta(c) {
  cuenta = c;
  if (c) elegirAutor(c.nombre);
}

let cargando = null;   // consulta del perfil en vuelo: las llamadas simultáneas comparten una sola
export async function cuentaActual({ forzar = false } = {}) {
  if (cuenta && !forzar) return cuenta;
  if (cargando && !forzar) return cargando;
  const p = (async () => {
    try { fijarCuenta(await cargarPerfil({ supabase })); ultimoError = null; } catch (e) { cuenta = null; ultimoError = e; }
    return cuenta;
  })();
  cargando = p;
  try { return await p; } finally { if (cargando === p) cargando = null; }
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

// Enseña el código de recuperación (solo se ve una vez) y espera a que se cierre la hoja.
export function mostrarCodigoRecuperacion(codigo, { titulo = 'Tu código de recuperación' } = {}) {
  return new Promise((resolver) => {
    const hoja = abrirHoja(titulo, { encima: true });
    hoja.alCerrar = () => resolver();
    const estado = el('p', { clase: 'texto-2 texto-s', attrs: { role: 'status', 'aria-live': 'polite' } });
    const guardado = el('input', { type: 'checkbox', id: 'codigo-guardado' });
    const seguir = el('button', { type: 'button', clase: 'boton', texto: 'Continuar', disabled: true, onclick: () => hoja.cerrar() });
    guardado.addEventListener('change', () => { seguir.disabled = !guardado.checked; });
    const botones = [el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Copiar', onclick: async () => {
      estado.textContent = (await copiar(codigo)) ? 'Copiado.' : 'No se pudo copiar: apúntalo a mano.';
    } })];
    if (navigator.share) {
      botones.push(el('button', { type: 'button', clase: 'boton boton--suave boton--compacto', texto: 'Compartir', onclick: () => {
        navigator.share({ text: `Mi código de recuperación de Setas: ${codigo}` }).catch(() => {});
      } }));
    }
    hoja.cuerpo.append(
      el('p', { texto: 'Con este código puedes pasar tu cuenta a otro móvil. Quien lo tenga tiene tu cuenta: guárdalo en un sitio seguro (no en una captura que compartas).' }),
      el('p', { clase: 'recuperacion-codigo', texto: codigo, attrs: { 'aria-label': 'Código de recuperación' } }),
      el('div', { clase: 'diario-fila' }, ...botones), estado,
      el('p', { clase: 'texto-2 texto-s', texto: 'No se vuelve a mostrar. Si lo pierdes, puedes generar uno nuevo desde Ajustes mientras sigas dentro de la app.' }),
      el('div', { clase: 'campo campo--marca' }, guardado, el('label', { htmlFor: 'codigo-guardado', texto: 'Lo he guardado en un sitio seguro' })),
      seguir);
  });
}

// Devuelve el perfil; si no existe abre «Tu perfil» (crear uno o recuperar la cuenta de otro móvil).
// Lanza un Error en español si no se puede comprobar el perfil (p. ej. sin conexión): crear otro duplicaría la cuenta.
// Devuelve null si se cierra la hoja sin terminar.
export async function requerirCuenta() {
  const c = await cuentaActual();
  if (c) return c;
  if (ultimoError) throw new Error(`No se puede comprobar tu perfil (${textoError(ultimoError)}). Comprueba la conexión.`);
  return new Promise((resolver) => {
    const hoja = abrirHoja('Tu perfil', { encima: true });
    let hecho = false;
    let creado = null;   // perfil ya creado cuando se cierra todo (hashchange) durante la hoja del código
    const terminar = (perfil) => { hecho = true; fijarCuenta(perfil); resolver(perfil); hoja.cerrar(); };
    hoja.alCerrar = () => { if (!hecho) resolver(creado); };

    const errorCrear = el('p', { clase: 'texto-s aviso-peligro', attrs: { role: 'alert' }, hidden: true });
    const nombre = el('input', { type: 'text', id: 'perfil-nombre', attrs: { autocomplete: 'given-name', maxlength: '40', enterkeyhint: 'done' } });
    const crear = el('button', { type: 'submit', clase: 'boton', texto: 'Crear mi perfil' });
    const formCrear = el('form', { clase: 'diario-form', noValidate: true },
      el('p', { clase: 'texto-2', texto: 'Así se sabrá quién apuntó cada salida. No hace falta correo ni contraseña.' }),
      el('div', { clase: 'campo' }, el('label', { htmlFor: 'perfil-nombre', texto: 'Tu nombre' }), nombre), errorCrear, crear);
    formCrear.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const n = nombre.value.trim();
      if (!n) { errorCrear.textContent = 'Escribe tu nombre.'; errorCrear.hidden = false; nombre.focus(); return; }
      crear.disabled = true; errorCrear.hidden = true;
      try {
        const codigo = await crearPerfil(n, { supabase });
        const id = await asegurarSesion({ supabase });
        fijarCuenta({ id, nombre: n });
        creado = { id, nombre: n };
        await mostrarCodigoRecuperacion(codigo);
        terminar({ id, nombre: n });
      } catch (e) { errorCrear.textContent = textoError(e); errorCrear.hidden = false; crear.disabled = false; }
    });

    const errorRec = el('p', { clase: 'texto-s aviso-peligro', attrs: { role: 'alert' }, hidden: true });
    const codigo = el('input', { type: 'text', id: 'perfil-codigo', attrs: { autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '24', enterkeyhint: 'done' }, placeholder: 'XXXX-XXXX-XXXX-XXXX' });
    const recuperar = el('button', { type: 'submit', clase: 'boton boton--suave', texto: 'Recuperar mi cuenta' });
    const formRec = el('form', { clase: 'diario-form', noValidate: true },
      el('p', { clase: 'texto-2', texto: 'Si ya tenías cuenta en otro móvil, escribe el código de recuperación que te dieron.' }),
      el('div', { clase: 'campo' }, el('label', { htmlFor: 'perfil-codigo', texto: 'Código de recuperación' }), codigo), errorRec, recuperar);
    formRec.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!codigoRecuperacionValido(codigo.value)) { errorRec.textContent = 'El código tiene 16 caracteres (letras y números).'; errorRec.hidden = false; codigo.focus(); return; }
      recuperar.disabled = true; errorRec.hidden = true;
      try {
        if (!(await recuperarCuenta(codigo.value, { supabase }))) {
          errorRec.textContent = 'Ese código no corresponde a ninguna cuenta.'; errorRec.hidden = false; recuperar.disabled = false; return;
        }
        const perfil = await cargarPerfil({ supabase });
        if (!perfil) throw new Error('No se pudo cargar la cuenta recuperada.');
        terminar(perfil);
      } catch (e) { errorRec.textContent = textoError(e); errorRec.hidden = false; recuperar.disabled = false; }
    });

    hoja.cuerpo.append(formCrear, el('hr'), el('details', {}, el('summary', { texto: 'Ya tengo una cuenta en otro móvil' }), formRec));
  });
}

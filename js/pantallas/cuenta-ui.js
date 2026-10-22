// Cuenta de Google: entrar («Entrar»), elegir el nombre del perfil («Tu nombre») y la tarjeta para quien no ha entrado.
import { el } from '../ui/dom.js';
import { abrirHoja } from '../ui/hoja.js';
import { supabase, elegirAutor } from '../supabase.js';
import { GOOGLE_CLIENT_ID } from '../config.js';
import { nonceNuevo, cargarGis, botonGoogle } from '../google.js';
import { cargarPerfil, crearPerfil, entrarConGoogle, entrarPorRedireccion, guardarRutaPendiente, textoError } from '../cuenta.js';

export const PREFERIR_GIS = true;   // true: botón de Google en la hoja; false: redirección como opción principal

let cuenta = null;        // { id, nombre } cuando existe el perfil
let estado = null;        // último resultado de cargarPerfil
let ultimoError = null;   // último fallo al comprobar la cuenta (sin red…)

export const errorDeCuenta = () => ultimoError;   // no null = no se pudo comprobar la cuenta (p. ej. sin conexión)
export const estadoCuenta = () => estado;

export function fijarCuenta(c) {
  cuenta = c;
  elegirAutor(c ? c.nombre : null);   // sin perfil o sin sesión no queda nombre local: no habría subida posible
}

let cargando = null;   // consulta en vuelo: las llamadas simultáneas comparten una sola
export async function cuentaActual({ forzar = false } = {}) {
  if (cuenta && !forzar) return cuenta;
  if (cargando && !forzar) return cargando;
  const p = (async () => {
    try {
      const r = await cargarPerfil({ supabase });
      estado = r;
      fijarCuenta(r.estado === 'perfil' ? { id: r.id, nombre: r.nombre } : null);
      ultimoError = null;
    } catch (e) { estado = null; cuenta = null; ultimoError = e; }
    return cuenta;
  })();
  cargando = p;
  try { return await p; } finally { if (cargando === p) cargando = null; }
}

// Solo lee el perfil y avisa: no inicia ni cierra sesiones, así que no puede provocar otro cambio de auth.
supabase.auth.onAuthStateChange(() => {
  cuentaActual({ forzar: true }).then(() => window.dispatchEvent(new CustomEvent('cuenta-cambio')));
});

// Hoja «Entrar». Resuelve true al entrar con Google en la propia página; false si se cierra sin entrar
// (la redirección sale de la página y no resuelve nada).
export function hojaEntrar() {
  return new Promise((resolver) => {
    const hoja = abrirHoja('Entrar', { encima: true });
    let hecho = false;
    hoja.alCerrar = () => { if (!hecho) resolver(false); };
    const error = el('p', { clase: 'texto-s aviso-peligro', attrs: { role: 'alert' }, hidden: true });
    const fallo = (e) => { error.textContent = textoError(e); error.hidden = false; };

    const botonRedireccion = (texto, principal) => el('button', {
      type: 'button', clase: principal ? 'boton' : 'boton boton--suave', texto,
      onclick: async (ev) => {
        const b = ev.currentTarget;
        b.disabled = true; error.hidden = true;
        try {
          guardarRutaPendiente(location.hash);
          await entrarPorRedireccion({ supabase, redirigirA: location.origin + location.pathname });
        } catch (e) { fallo(e); b.disabled = false; }
      },
    });

    const contenedorGoogle = el('div', { clase: 'google-boton' });
    let gisListo = false;
    const alCredencial = async (credencial, nonce) => {
      error.hidden = true;
      try {
        await entrarConGoogle({ supabase, credencial, nonce });
        await cuentaActual({ forzar: true });
        hecho = true; resolver(true); hoja.cerrar();
      } catch (e) { fallo(e); }
    };

    const zona = el('div', { clase: 'pila' });
    hoja.cuerpo.append(
      el('p', { texto: 'Con tu cuenta de Google tendrás tu diario y podrás entrar en grupos. Tu correo no se enseña a nadie.' }),
      zona, error);

    const pintarBotones = () => {
      if (!gisListo) zona.replaceChildren(botonRedireccion('Entrar con Google', true));
      else if (PREFERIR_GIS) zona.replaceChildren(contenedorGoogle, botonRedireccion('Entrar de otra forma', false));
      else zona.replaceChildren(botonRedireccion('Entrar con Google', true), contenedorGoogle);
    };
    pintarBotones();

    if (GOOGLE_CLIENT_ID) {
      (async () => {
        try {
          const gis = await cargarGis();
          const nonce = await nonceNuevo();
          if (!hoja.cuerpo.isConnected) return;   // la hoja se cerró mientras cargaba
          botonGoogle(contenedorGoogle, { clientId: GOOGLE_CLIENT_ID, nonce, alCredencial: (c) => alCredencial(c, nonce), gis });
          gisListo = true;
          pintarBotones();
        } catch { /* sin Google en la página: queda la redirección */ }
      })();
    }
  });
}

// Hoja «Tu nombre»: crea el perfil. Resuelve { id, nombre } o null si se cierra sin guardar.
export function hojaNombre(sugerido = '') {
  return new Promise((resolver) => {
    const hoja = abrirHoja('Tu nombre', { encima: true });
    let hecho = false;
    hoja.alCerrar = () => { if (!hecho) resolver(null); };
    const error = el('p', { clase: 'texto-s aviso-peligro', attrs: { role: 'alert' }, hidden: true });
    const nombre = el('input', { type: 'text', id: 'perfil-nombre', value: String(sugerido ?? ''), attrs: { autocomplete: 'given-name', maxlength: '40', enterkeyhint: 'done' } });
    const guardar = el('button', { type: 'submit', clase: 'boton', texto: 'Guardar' });
    const form = el('form', { clase: 'diario-form', noValidate: true },
      el('p', { clase: 'texto-2', texto: 'Así se sabrá quién apuntó cada salida.' }),
      el('div', { clase: 'campo' }, el('label', { htmlFor: 'perfil-nombre', texto: 'Tu nombre' }), nombre), error, guardar);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const n = nombre.value.trim();
      if (!n) { error.textContent = 'Escribe tu nombre.'; error.hidden = false; nombre.focus(); return; }
      guardar.disabled = true; error.hidden = true;
      try {
        await crearPerfil(n, { supabase });
        const c = await cuentaActual({ forzar: true });
        if (!c) throw new Error('No se pudo cargar tu perfil.');
        hecho = true; resolver(c); hoja.cerrar();
      } catch (e) { error.textContent = textoError(e); error.hidden = false; guardar.disabled = false; }
    });
    hoja.cuerpo.append(form);
  });
}

// Devuelve el perfil; si falta, abre «Entrar» y/o «Tu nombre». null si se cierra sin terminar.
// Lanza un Error en español si no se puede comprobar la cuenta (p. ej. sin conexión).
const sinRed = () => new Error(`No se puede comprobar tu cuenta (${textoError(ultimoError)}). Comprueba la conexión.`);
export async function requerirCuenta() {
  const c = await cuentaActual();
  if (c) return c;
  if (ultimoError) throw sinRed();
  if (estado?.estado !== 'sin-perfil') {
    if (!(await hojaEntrar())) return null;
    const tras = await cuentaActual();
    if (tras) return tras;
    if (ultimoError) throw sinRed();
  }
  return hojaNombre(estado?.nombreGoogle ?? '');
}

// Tarjeta para pantallas que necesitan cuenta cuando no se ha entrado.
export function tarjetaSinSesion(texto, alEntrar) {
  return el('div', { clase: 'tarjeta pila' },
    el('p', { texto }),
    el('button', { type: 'button', clase: 'boton', texto: 'Entrar con Google', onclick: async () => {
      if (await hojaEntrar()) alEntrar?.();
    } }));
}

// Entrar con Google sin salir de la página (Google Identity Services). Sin dependencias de Supabase ni del DOM
// global: el documento, la criptografía y el objeto gis llegan inyectados para poder probarlo sin navegador.

const URL_GIS = 'https://accounts.google.com/gsi/client';

const aHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

// Nonce: `bruto` va a Supabase (signInWithIdToken) y `hash` (SHA-256 en hex) va a Google.
export async function nonceNuevo({ cripto = globalThis.crypto } = {}) {
  const bruto = aHex(cripto.getRandomValues(new Uint8Array(16)));
  const resumen = await cripto.subtle.digest('SHA-256', new TextEncoder().encode(bruto));
  return { bruto, hash: aHex(new Uint8Array(resumen)) };
}

// La promesa se comparte solo mientras la carga está en curso; al terminar (bien o mal) se olvida: si fue bien,
// las siguientes llamadas ven google ya definido; si fue mal, reintentan.
let cargando = null;

export function cargarGis({ doc = document, espera = 10000 } = {}) {
  if (globalThis.google?.accounts?.id) return Promise.resolve(globalThis.google.accounts.id);
  if (cargando) return cargando;
  cargando = new Promise((resolver, rechazar) => {
    const temporizador = setTimeout(() => rechazar(new Error('No se pudo cargar Google')), espera);
    const script = doc.createElement('script');
    script.src = URL_GIS;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      clearTimeout(temporizador);
      const gis = globalThis.google?.accounts?.id;
      if (gis) resolver(gis); else rechazar(new Error('No se pudo cargar Google'));
    });
    script.addEventListener('error', () => {
      clearTimeout(temporizador);
      rechazar(new Error('No se pudo cargar Google'));
    });
    doc.head.append(script);
  }).finally(() => { cargando = null; });
  return cargando;
}

export function botonGoogle(contenedor, { clientId, nonce, alCredencial, gis }) {
  gis.initialize({
    client_id: clientId,
    callback: (r) => alCredencial(r.credential),
    nonce: nonce.hash,
    ux_mode: 'popup',
    itp_support: true,
  });
  gis.renderButton(contenedor, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'es', width: 280 });
}

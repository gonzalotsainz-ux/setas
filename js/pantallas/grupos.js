// Pantalla «Grupos»: tus grupos, crear uno, unirte con un código y, dentro de cada uno, miembros, código de invitación y salidas de sus miembros.
import { el, icono } from '../ui/dom.js';
import { comun } from '../ui/ficha.js';
import { nombreCorto } from '../datos.js';
import { fechaLarga } from '../mapa.js';
import { supabase } from '../supabase.js';
import { textoError } from '../cuenta.js';
import { cuentaActual, requerirCuenta, errorDeCuenta, estadoCuenta, tarjetaSinSesion } from './cuenta-ui.js';
import { misGrupos, crearGrupo, unirseAGrupo, regenerarCodigo, renombrarGrupo, miembrosDelGrupo, expulsarMiembro, hacerAdmin, salirDelGrupo, borrarGrupo, salidasDelGrupo, enlaceInvitacion, MAX_MIEMBROS } from '../grupos.js';

const kgTexto = (n) => `${String(Math.round(n * 100) / 100).replace('.', ',')} kg`;
const boton = (texto, onclick, { suave = true, compacto = true } = {}) =>
  el('button', {
    type: 'button', clase: `boton${suave ? ' boton--suave' : ''}${compacto ? ' boton--compacto' : ''}`, texto,
    // Se desactiva mientras corre la acción: un doble toque no la repite.
    onclick: async (ev) => {
      const b = ev.currentTarget;
      if (b.disabled) return;
      b.disabled = true;
      try { await onclick(ev); } finally { b.disabled = false; }
    },
  });
const esNoEncontrado = (e) => /no_miembro/.test(`${e?.message ?? ''}`) || e?.code === '22P02';

function tarjetaSalidaGrupo(s, datos, yo) {
  const zona = datos.zonas.find((z) => z.id === s.zona_id);
  const especies = Array.isArray(s.especies) ? s.especies : [];
  const fotos = (s.fotos ?? []).filter((f) => f.url);
  const conPunto = typeof s.lat === 'number' && typeof s.lon === 'number';
  return el('li', { clase: 'tarjeta diario-salida' },
    el('div', { clase: 'diario-salida__cabeza' }, el('h3', { texto: fechaLarga(s.fecha) }),
      el('span', { clase: 'etiqueta', texto: s.usuario_id === yo ? 'Tú' : s.autor })),
    el('p', { clase: 'texto-2 texto-s', texto: `${zona ? nombreCorto(zona) : s.zona_id}` }),
    especies.length ? el('ul', { clase: 'diario-especies' }, especies.map((e) => {
      const esp = datos.porId[e.especie_id];
      return el('li', {}, el('span', { texto: esp ? comun(esp) : e.especie_id }), e.kg != null && e.kg !== '' ? el('span', { clase: 'tabular', texto: kgTexto(Number(e.kg)) }) : null);
    })) : el('p', { clase: 'texto-2 texto-s', texto: 'Sin especies apuntadas.' }),
    fotos.length ? el('ul', { clase: 'diario-miniaturas diario-miniaturas--lista' }, fotos.map((f, k) => el('li', {},
      el('a', { href: f.url, target: '_blank', rel: 'noopener', attrs: { 'aria-label': `Foto ${k + 1} de ${s.autor} (se abre ampliada)` } },
        el('img', { src: f.url, alt: '', loading: 'lazy', decoding: 'async' }))))) : null,
    s.notas ? el('p', { clase: 'diario-notas', texto: s.notas }) : null,
    conPunto ? el('a', { clase: 'boton boton--suave boton--compacto', target: '_blank', rel: 'noopener',
      href: `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=16/${s.lat}/${s.lon}`, texto: 'Ver el punto en el mapa' }) : null);
}

export function pintar({ estado, param }) {
  const raiz = el('div', { clase: 'pila diario' });
  const aviso = el('div', { attrs: { role: 'status', 'aria-live': 'polite' } });
  const cuerpo = el('div', { clase: 'pila' });
  const decir = (texto, peligro = false) => aviso.replaceChildren(...(texto ? [el('div', { clase: peligro ? 'aviso-peligro' : 'aviso' }, icono('i-aviso'), el('p', { texto }))] : []));
  raiz.append(el('div', { clase: 'diario-cabeza' }, el('h1', { texto: 'Grupos' }), el('a', { clase: 'boton boton--suave boton--compacto', href: '#diario', texto: 'Volver al diario' })), aviso, cuerpo);

  async function vistaLista() {
    const cuenta = await cuentaActual();
    if (!cuenta && errorDeCuenta()) { cuerpo.replaceChildren(); decir(`No se puede comprobar tu perfil (${textoError(errorDeCuenta())}). Comprueba la conexión.`, true); return; }
    if (!cuenta && estadoCuenta()?.estado !== 'sin-perfil') {
      cuerpo.replaceChildren(tarjetaSinSesion('Los grupos sirven para que tu cuadrilla vea tus salidas y tú las suyas. Entra con Google para crear uno o unirte.', vistaLista));
      return;
    }
    if (!cuenta) {
      // Con sesión pero sin perfil: primero el nombre.
      let nueva = null;
      try { nueva = await requerirCuenta(); } catch (e) { decir(e.message, true); }
      if (nueva) { await vistaLista(); return; }
      cuerpo.replaceChildren(el('div', { clase: 'tarjeta pila' },
        el('p', { texto: 'Para usar los grupos necesitas poner tu nombre.' }),
        boton('Poner mi nombre', async () => {
          try { if (await requerirCuenta()) await vistaLista(); } catch (e) { decir(e.message, true); }
        }, { suave: false, compacto: false })));
      return;
    }
    decir('');
    const grupos = await misGrupos({ supabase });
    const nombre = el('input', { type: 'text', id: 'grupo-nombre', attrs: { maxlength: '60', autocomplete: 'off', enterkeyhint: 'done' } });
    const crearBtn = el('button', { type: 'submit', clase: 'boton', texto: 'Crear grupo' });
    const formCrear = el('form', { clase: 'diario-form tarjeta', noValidate: true },
      el('h2', { clase: 'tarjeta__titulo', texto: 'Crear un grupo' }),
      el('div', { clase: 'campo' }, el('label', { htmlFor: 'grupo-nombre', texto: 'Nombre del grupo' }), nombre),
      crearBtn);
    formCrear.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!nombre.value.trim()) { decir('Ponle un nombre al grupo.', true); nombre.focus(); return; }
      if (crearBtn.disabled) return;
      crearBtn.disabled = true;
      try { const g = await crearGrupo(nombre.value, { supabase }); location.hash = `#grupos/${g.grupo_id}`; } catch (e) { decir(textoError(e), true); } finally { crearBtn.disabled = false; }
    });
    const codigo = el('input', { type: 'text', id: 'grupo-codigo', attrs: { autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '12', enterkeyhint: 'done' } });
    const unirBtn = el('button', { type: 'submit', clase: 'boton boton--suave', texto: 'Unirme' });
    const formUnirse = el('form', { clase: 'diario-form tarjeta', noValidate: true },
      el('h2', { clase: 'tarjeta__titulo', texto: 'Unirme con un código' }),
      el('div', { clase: 'campo' }, el('label', { htmlFor: 'grupo-codigo', texto: 'Código de invitación' }), codigo),
      unirBtn);
    formUnirse.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (unirBtn.disabled) return;
      unirBtn.disabled = true;
      try {
        const id = await unirseAGrupo(codigo.value, { supabase });
        if (!id) { decir('Ese código no corresponde a ningún grupo.', true); return; }
        location.hash = `#grupos/${id}`;
      } catch (e) { decir(textoError(e), true); } finally { unirBtn.disabled = false; }
    });
    cuerpo.replaceChildren(
      grupos.length ? el('ul', { clase: 'diario-lista' }, grupos.map((g) => el('li', { clase: 'tarjeta diario-salida' },
        el('div', { clase: 'diario-salida__cabeza' }, el('h3', {}, el('a', { href: `#grupos/${g.grupo_id}`, texto: g.nombre })),
          el('span', { clase: 'etiqueta', texto: g.rol === 'admin' ? 'Administrador' : 'Miembro' })),
        el('p', { clase: 'texto-2 texto-s', texto: `${g.miembros} ${Number(g.miembros) === 1 ? 'miembro' : 'miembros'} (máximo ${MAX_MIEMBROS})` }))))
        : el('p', { clase: 'tarjeta texto-2', texto: 'Aún no estás en ningún grupo.' }),
      formCrear, formUnirse);
  }

  async function vistaGrupo(id) {
    const cuenta = await cuentaActual();
    if (!cuenta) { await vistaLista(); return; }
    const noEncontrado = () => cuerpo.replaceChildren(el('div', { clase: 'tarjeta pila' }, el('p', { texto: 'No encuentras este grupo: puede que ya no formes parte de él.' }), el('a', { href: '#grupos', texto: 'Ver mis grupos' })));
    let grupos, miembros, salidas;
    try {
      [grupos, miembros, salidas] = await Promise.all([misGrupos({ supabase }), miembrosDelGrupo(id, { supabase }), salidasDelGrupo(id, { supabase, limite: 20 })]);
    } catch (e) {
      if (esNoEncontrado(e)) { noEncontrado(); return; }
      throw e;
    }
    const g = grupos.find((x) => x.grupo_id === id);
    if (!g) { noEncontrado(); return; }
    const soyAdmin = g.rol === 'admin';
    const refrescar = () => vistaGrupo(id).catch((e) => decir(textoError(e), true));
    const accion = (fn, ok) => async () => { try { await fn(); decir(ok ?? ''); await refrescar(); } catch (e) { decir(textoError(e), true); } };

    const enlace = enlaceInvitacion(g.codigo_invitacion);
    const invitar = el('div', { clase: 'tarjeta pila' },
      el('h2', { clase: 'tarjeta__titulo', texto: 'Invitar' }),
      el('p', { clase: 'texto-2', texto: 'Comparte este código o el enlace con quien quieras en el grupo:' }),
      el('p', { clase: 'grupo-codigo', texto: g.codigo_invitacion, attrs: { 'aria-label': 'Código de invitación' } }),
      el('div', { clase: 'diario-fila' },
        boton('Copiar enlace', async () => {
          try { await navigator.clipboard.writeText(enlace); decir('Enlace copiado.'); } catch { decir(`Copia el enlace a mano: ${enlace}`); }
        }),
        navigator.share ? boton('Compartir', () => navigator.share({ title: `Únete a «${g.nombre}» en Setas`, text: `Únete a «${g.nombre}» en Setas`, url: enlace }).catch(() => {})) : null,
        soyAdmin ? boton('Nuevo código', async () => {
          if (confirm('El código actual dejará de valer. ¿Generar uno nuevo?')) await accion(() => regenerarCodigo(id, { supabase }), 'Código nuevo generado.')();
        }) : null));

    const filas = miembros.map((m) => el('li', { clase: 'tarjeta diario-salida' },
      el('div', { clase: 'diario-salida__cabeza' }, el('h3', { texto: m.usuario_id === cuenta.id ? `${m.nombre} (tú)` : m.nombre }),
        el('span', { clase: 'etiqueta', texto: m.rol === 'admin' ? 'Administrador' : 'Miembro' })),
      soyAdmin && m.usuario_id !== cuenta.id ? el('div', { clase: 'diario-fila' },
        m.rol !== 'admin' ? boton('Hacer administrador', accion(() => hacerAdmin(id, m.usuario_id, { supabase }), `${m.nombre} es ahora administrador.`)) : null,
        boton('Expulsar', async () => {
          if (confirm(`¿Expulsar a ${m.nombre}? Sus salidas dejarán de verse en el grupo.`)) await accion(() => expulsarMiembro(id, m.usuario_id, { supabase }), `${m.nombre} ya no está en el grupo.`)();
        })) : null));

    const gestion = el('div', { clase: 'diario-fila' },
      soyAdmin ? boton('Cambiar nombre', async () => {
        const n = prompt('Nuevo nombre del grupo', g.nombre);
        if (n && n.trim()) await accion(() => renombrarGrupo(id, n, { supabase }))();
      }) : null,
      boton('Salir del grupo', async () => {
        if (!confirm('¿Salir del grupo? Tus salidas dejarán de verse en este grupo.')) return;
        try { await salirDelGrupo(id, { supabase }); location.hash = '#grupos'; } catch (e) { decir(textoError(e), true); }
      }),
      soyAdmin ? boton('Borrar grupo', async () => {
        if (!confirm('¿Borrar el grupo para todos? No se puede deshacer (las salidas siguen siendo de quien las apuntó).')) return;
        try { await borrarGrupo(id, { supabase }); location.hash = '#grupos'; } catch (e) { decir(textoError(e), true); }
      }) : null);

    cuerpo.replaceChildren(
      el('div', { clase: 'diario-cabeza' }, el('h2', { texto: g.nombre }), el('a', { clase: 'boton boton--suave boton--compacto', href: '#grupos', texto: 'Mis grupos' })),
      invitar,
      el('h2', { texto: `Miembros (${miembros.length}/${MAX_MIEMBROS})` }), el('ul', { clase: 'diario-lista' }, filas), gestion,
      el('h2', { texto: 'Salidas del grupo' }),
      salidas.length ? el('ul', { clase: 'diario-lista' }, salidas.map((s) => tarjetaSalidaGrupo(s, estado.datos, cuenta.id)))
        : el('p', { clase: 'tarjeta texto-2', texto: 'Las salidas de los miembros aparecerán aquí según las vayan apuntando.' }));
  }

  const arrancar = () => (param ? vistaGrupo(param) : vistaLista()).catch((e) => decir(textoError(e), true));
  let idPintado;
  // Al cambiar la sesión (o volver a la pestaña) solo se repinta si cambió quién es la usuaria: no se pierden formularios.
  const alCuenta = async () => {
    if (!raiz.isConnected) { window.removeEventListener('cuenta-cambio', alCuenta); return; }
    const c = await cuentaActual();
    if ((c?.id ?? null) !== idPintado) { idPintado = c?.id ?? null; arrancar(); }
  };
  window.addEventListener('cuenta-cambio', alCuenta);
  cuentaActual().then((c) => { idPintado = c?.id ?? null; }).catch(() => {}).finally(arrancar);
  return raiz;
}

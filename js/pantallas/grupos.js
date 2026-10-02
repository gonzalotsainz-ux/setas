// Pantalla «Grupos»: tus grupos, crear uno, unirte con un código y, dentro de cada uno, miembros, código de invitación y salidas compartidas.
import { el, icono } from '../ui/dom.js';
import { comun } from '../ui/ficha.js';
import { nombreCorto } from '../datos.js';
import { fechaLarga } from '../mapa.js';
import { supabase } from '../supabase.js';
import { textoError, asegurarSesion } from '../cuenta.js';
import { cuentaActual, requerirCuenta } from './cuenta-ui.js';
import { misGrupos, crearGrupo, unirseAGrupo, regenerarCodigo, renombrarGrupo, miembrosDelGrupo, expulsarMiembro, hacerAdmin, salirDelGrupo, borrarGrupo, salidasDelGrupo, enlaceInvitacion, MAX_MIEMBROS } from '../grupos.js';

const kgTexto = (n) => `${String(Math.round(n * 100) / 100).replace('.', ',')} kg`;
const boton = (texto, onclick, { suave = true, compacto = true } = {}) =>
  el('button', { type: 'button', clase: `boton${suave ? ' boton--suave' : ''}${compacto ? ' boton--compacto' : ''}`, texto, onclick });

function tarjetaSalidaGrupo(s, datos, yo) {
  const zona = datos.zonas.find((z) => z.id === s.zona_id);
  const especies = Array.isArray(s.especies) ? s.especies : [];
  const fotos = (s.fotos ?? []).filter((f) => f.url);
  const exacta = typeof s.lat === 'number' && typeof s.lon === 'number';
  return el('li', { clase: 'tarjeta diario-salida' },
    el('div', { clase: 'diario-salida__cabeza' }, el('h3', { texto: fechaLarga(s.fecha) }),
      el('span', { clase: 'etiqueta', texto: s.usuario_id === yo ? 'Tú' : s.autor })),
    el('p', { clase: 'texto-2 texto-s', texto: `${zona ? nombreCorto(zona) : s.zona_id}${exacta ? '' : ' · solo la zona'}` }),
    especies.length ? el('ul', { clase: 'diario-especies' }, especies.map((e) => {
      const esp = datos.porId[e.especie_id];
      return el('li', {}, el('span', { texto: esp ? comun(esp) : e.especie_id }), e.kg != null && e.kg !== '' ? el('span', { clase: 'tabular', texto: kgTexto(Number(e.kg)) }) : null);
    })) : el('p', { clase: 'texto-2 texto-s', texto: 'Sin especies apuntadas.' }),
    fotos.length ? el('ul', { clase: 'diario-miniaturas diario-miniaturas--lista' }, fotos.map((f, k) => el('li', {},
      el('a', { href: f.url, target: '_blank', rel: 'noopener', attrs: { 'aria-label': `Foto ${k + 1} de ${s.autor} (se abre ampliada)` } },
        el('img', { src: f.url, alt: '', loading: 'lazy', decoding: 'async' }))))) : null,
    s.notas ? el('p', { clase: 'diario-notas', texto: s.notas }) : null,
    exacta ? el('a', { clase: 'boton boton--suave boton--compacto', target: '_blank', rel: 'noopener',
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
    if (!cuenta) {
      cuerpo.replaceChildren(el('div', { clase: 'tarjeta pila' },
        el('p', { texto: 'Los grupos sirven para compartir tus salidas solo con tus amigos. Primero crea tu perfil (sin correo ni contraseña).' }),
        boton('Crear mi perfil', async () => {
          try { if (await requerirCuenta()) await vistaLista(); } catch (e) { decir(e.message, true); }
        }, { suave: false, compacto: false })));
      return;
    }
    const grupos = await misGrupos({ supabase });
    const nombre = el('input', { type: 'text', id: 'grupo-nombre', attrs: { maxlength: '60', autocomplete: 'off', enterkeyhint: 'done' } });
    const formCrear = el('form', { clase: 'diario-form tarjeta', noValidate: true },
      el('h2', { clase: 'tarjeta__titulo', texto: 'Crear un grupo' }),
      el('div', { clase: 'campo' }, el('label', { htmlFor: 'grupo-nombre', texto: 'Nombre del grupo' }), nombre),
      el('button', { type: 'submit', clase: 'boton', texto: 'Crear grupo' }));
    formCrear.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!nombre.value.trim()) { decir('Ponle un nombre al grupo.', true); nombre.focus(); return; }
      try { const g = await crearGrupo(nombre.value, { supabase }); location.hash = `#grupos/${g.grupo_id}`; } catch (e) { decir(textoError(e), true); }
    });
    const codigo = el('input', { type: 'text', id: 'grupo-codigo', attrs: { autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '12', enterkeyhint: 'done' } });
    const formUnirse = el('form', { clase: 'diario-form tarjeta', noValidate: true },
      el('h2', { clase: 'tarjeta__titulo', texto: 'Unirme con un código' }),
      el('div', { clase: 'campo' }, el('label', { htmlFor: 'grupo-codigo', texto: 'Código de invitación' }), codigo),
      el('button', { type: 'submit', clase: 'boton boton--suave', texto: 'Unirme' }));
    formUnirse.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        const id = await unirseAGrupo(codigo.value, { supabase });
        if (!id) { decir('Ese código no corresponde a ningún grupo.', true); return; }
        location.hash = `#grupos/${id}`;
      } catch (e) { decir(textoError(e), true); }
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
    const [grupos, miembros, salidas] = await Promise.all([misGrupos({ supabase }), miembrosDelGrupo(id, { supabase }), salidasDelGrupo(id, { supabase })]);
    const g = grupos.find((x) => x.grupo_id === id);
    if (!g) { cuerpo.replaceChildren(el('div', { clase: 'tarjeta' }, el('p', { texto: 'No encuentras este grupo: puede que ya no formes parte de él.' }), el('a', { href: '#grupos', texto: 'Ver mis grupos' }))); return; }
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
          if (confirm(`¿Expulsar a ${m.nombre}? Lo que había compartido dejará de verse en el grupo.`)) await accion(() => expulsarMiembro(id, m.usuario_id, { supabase }), `${m.nombre} ya no está en el grupo.`)();
        })) : null));

    const gestion = el('div', { clase: 'diario-fila' },
      soyAdmin ? boton('Cambiar nombre', async () => {
        const n = prompt('Nuevo nombre del grupo', g.nombre);
        if (n && n.trim()) await accion(() => renombrarGrupo(id, n, { supabase }))();
      }) : null,
      boton('Salir del grupo', async () => {
        if (!confirm('¿Salir del grupo? Lo que habías compartido en él dejará de verse.')) return;
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
      el('h2', { texto: 'Salidas compartidas' }),
      salidas.length ? el('ul', { clase: 'diario-lista' }, salidas.map((s) => tarjetaSalidaGrupo(s, estado.datos, cuenta.id)))
        : el('p', { clase: 'tarjeta texto-2', texto: 'Nadie ha compartido aún una salida en este grupo. Al apuntar una salida en el Diario puedes elegir compartirla aquí.' }));
  }

  // Aviso de conexión antes de intentar: sin sesión anónima no hay nada que mostrar.
  (async () => {
    try { await asegurarSesion({ supabase }); } catch (e) { decir(textoError(e), true); return; }
    try { await (param ? vistaGrupo(param) : vistaLista()); } catch (e) { decir(textoError(e), true); }
  })();
  return raiz;
}

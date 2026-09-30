// Ficha de una norma o permiso: título con enlace, ¿hace falta permiso?, tarifas, cupo y prohibiciones.
// Lo no verificado se dice («Sin confirmar»); una revisión de hace más de 12 meses pide revisar la vigencia.
import { el } from './dom.js';

const nbsp = ' ';

// Hace más de 12 meses: la fecha de revisión es anterior al mismo día del año pasado.
export const haceUnAnio = (hoy) => `${Number(hoy.slice(0, 4)) - 1}${hoy.slice(4)}`;
export const revisarVigencia = (norma, hoy) => !norma.revisado || norma.revisado < haceUnAnio(hoy);
export const permisoTexto = (norma) => {
  const o = norma.permiso?.obligatorio;
  return o === true ? 'Hace falta permiso' : o === false ? 'No hace falta permiso' : 'Permiso: sin confirmar';
};
export const precioTexto = (t) => (t.precio == null ? 'precio no publicado' : `${String(t.precio).replace('.', ',')}${nbsp}€`);
export const cupoTexto = (t) => (t.cupoKgDia == null ? 'cupo no indicado' : `hasta ${t.cupoKgDia}${nbsp}kg/día`);
export const anioTexto = (t) => (t.anio == null ? 'año de vigencia no publicado' : `tarifa de ${t.anio}`);

// Texto de una fila de tarifa, sin inventar lo que no se publica.
export const tarifaTexto = (t) => `${precioTexto(t)} · ${cupoTexto(t)} · ${anioTexto(t)}${t.verificado === false ? ' · Sin confirmar' : ''}`;

const etiqueta = (t, v) => el('span', { clase: `etiqueta${v ? ` etiqueta--${v}` : ''}`, texto: t });
// Solo se enlaza lo que viene de los datos si es http(s).
export const urlSegura = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
const enlace = (href, texto) => (urlSegura(href) ? el('a', { texto, href, rel: 'noopener' }) : el('span', { texto }));

export function fichaNormativa(norma, hoy = new Date().toISOString().slice(0, 10)) {
  const raiz = el('details', { clase: 'norma' });
  const resumen = el('summary', { clase: 'norma__resumen' });
  const etiquetas = el('span', { clase: 'norma__etiquetas' });
  const o = norma.permiso?.obligatorio;
  etiquetas.append(etiqueta(permisoTexto(norma), o === true ? 'acento' : o === false ? null : 'ocre'));
  if (norma.verificado === false) etiquetas.append(etiqueta('Sin confirmar', 'ocre'));
  if (norma.vigente === false) etiquetas.append(etiqueta('No vigente', 'ocre'));
  if (revisarVigencia(norma, hoy)) etiquetas.append(etiqueta('Revisar vigencia', 'ocre'));
  resumen.append(el('span', { clase: 'norma__titulo', texto: norma.titulo }), etiquetas);
  raiz.append(resumen);

  const cuerpo = el('div', { clase: 'norma__cuerpo' });
  if (urlSegura(norma.url)) cuerpo.append(el('a', { clase: 'norma__enlace', texto: 'Texto oficial', href: norma.url, rel: 'noopener' }));
  if (norma.resumen?.length) { const ul = el('ul', { clase: 'norma__lista' }); norma.resumen.forEach((r) => ul.append(el('li', { texto: r }))); cuerpo.append(ul); }

  const p = norma.permiso;
  if (p?.tarifas?.length) {
    cuerpo.append(el('h4', { texto: 'Tarifas' }));
    const ul = el('ul', { clase: 'tarifas' });
    for (const t of p.tarifas) {
      const li = el('li', { clase: 'tarifa' });
      li.append(el('span', { clase: 'tarifa__nombre', texto: t.nombre }), el('b', { clase: 'tabular', texto: precioTexto(t) }),
        el('span', { clase: 'texto-2 texto-s', texto: ` · ${cupoTexto(t)} · ${anioTexto(t)}` }));
      if (t.verificado === false) li.append(' ', etiqueta('Sin confirmar', 'ocre'));
      ul.append(li);
    }
    cuerpo.append(ul);
  }
  if (p?.donde) { const d = el('p', { texto: 'Dónde sacarlo: ' }); d.append(enlace(p.donde, 'página de permisos')); cuerpo.append(d); }
  if (norma.cupoKgDia) cuerpo.append(el('p', { texto: `Cupo general: ${norma.cupoKgDia}${nbsp}kg por persona y día.` }));
  if (norma.horario) cuerpo.append(el('p', { texto: norma.horario }));
  if (norma.prohibiciones?.length) {
    cuerpo.append(el('h4', { texto: 'Prohibiciones' }));
    const ul = el('ul', { clase: 'norma__lista' }); norma.prohibiciones.forEach((r) => ul.append(el('li', { texto: r }))); cuerpo.append(ul);
  }
  if (norma.sanciones) cuerpo.append(el('p', { clase: 'texto-2 texto-s', texto: `Sanciones: ${norma.sanciones}` }));
  cuerpo.append(el('p', { clase: 'texto-2 texto-s', texto: `Revisada el ${norma.revisado ?? 'sin fecha'}.` }));
  raiz.append(cuerpo);
  return raiz;
}

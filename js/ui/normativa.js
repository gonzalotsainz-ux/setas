// Ficha de una norma o permiso: título con enlace, ¿hace falta permiso?, tarifas, cupo y prohibiciones.
// Lo no verificado se dice («Sin confirmar»); una revisión de hace más de 12 meses pide revisar la vigencia.
const nbsp = ' ';

// Hace más de 12 meses: la fecha de revisión es anterior al mismo día del año pasado.
export const haceUnAnio = (hoy) => `${Number(hoy.slice(0, 4)) - 1}${hoy.slice(4)}`;
export const revisarVigencia = (norma, hoy) => !norma.revisado || norma.revisado < haceUnAnio(hoy);
export const permisoTexto = (norma) => {
  const o = norma.permiso?.obligatorio;
  return o === true ? 'Hace falta permiso' : o === false ? 'No hace falta permiso' : 'Permiso: sin confirmar';
};
export const precioTexto = (t) => `${String(t.precio).replace('.', ',')}${nbsp}€`;
export const anioTexto = (t) => (t.anio == null ? 'año de vigencia no publicado' : `tarifa de ${t.anio}`);

function el(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; }
const etiqueta = (t, v) => el('span', `etiqueta${v ? ` etiqueta--${v}` : ''}`, t);
const enlace = (href, texto) => Object.assign(el('a', null, texto), { href, rel: 'noopener' });

export function fichaNormativa(norma, hoy = new Date().toISOString().slice(0, 10)) {
  const raiz = el('details', 'norma');
  const resumen = el('summary', 'norma__resumen');
  const etiquetas = el('span', 'norma__etiquetas');
  const o = norma.permiso?.obligatorio;
  etiquetas.append(etiqueta(permisoTexto(norma), o === true ? 'acento' : o === false ? null : 'ocre'));
  if (norma.verificado === false) etiquetas.append(etiqueta('Sin confirmar', 'ocre'));
  if (norma.vigente === false) etiquetas.append(etiqueta('No vigente', 'ocre'));
  if (revisarVigencia(norma, hoy)) etiquetas.append(etiqueta('Revisar vigencia', 'ocre'));
  resumen.append(el('span', 'norma__titulo', norma.titulo), etiquetas);
  raiz.append(resumen);

  const cuerpo = el('div', 'norma__cuerpo');
  if (norma.url) cuerpo.append(Object.assign(enlace(norma.url, 'Texto oficial'), { className: 'norma__enlace' }));
  if (norma.resumen?.length) { const ul = el('ul', 'norma__lista'); norma.resumen.forEach((r) => ul.append(el('li', null, r))); cuerpo.append(ul); }

  const p = norma.permiso;
  if (p?.tarifas?.length) {
    cuerpo.append(el('h4', null, 'Tarifas'));
    const ul = el('ul', 'tarifas');
    for (const t of p.tarifas) {
      const li = el('li', 'tarifa');
      li.append(el('span', 'tarifa__nombre', t.nombre), el('b', 'tabular', precioTexto(t)),
        el('span', 'texto-2 texto-s', ` · hasta ${t.cupoKgDia}${nbsp}kg/día · ${anioTexto(t)}`));
      if (t.verificado === false) li.append(' ', etiqueta('Sin confirmar', 'ocre'));
      ul.append(li);
    }
    cuerpo.append(ul);
  }
  if (p?.donde) { const d = el('p', null, 'Dónde sacarlo: '); d.append(enlace(p.donde, 'página de permisos')); cuerpo.append(d); }
  if (norma.cupoKgDia) cuerpo.append(el('p', null, `Cupo general: ${norma.cupoKgDia}${nbsp}kg por persona y día.`));
  if (norma.horario) cuerpo.append(el('p', null, norma.horario));
  if (norma.prohibiciones?.length) {
    cuerpo.append(el('h4', null, 'Prohibiciones'));
    const ul = el('ul', 'norma__lista'); norma.prohibiciones.forEach((r) => ul.append(el('li', null, r))); cuerpo.append(ul);
  }
  if (norma.sanciones) cuerpo.append(el('p', 'texto-2 texto-s', `Sanciones: ${norma.sanciones}`));
  cuerpo.append(el('p', 'texto-2 texto-s', `Revisada el ${norma.revisado ?? 'sin fecha'}.`));
  raiz.append(cuerpo);
  return raiz;
}

// Ayudas mínimas para construir DOM sin innerHTML con datos.
export function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  const { clase, texto, attrs, ...resto } = props;
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  for (const [k, v] of Object.entries(attrs ?? {})) e.setAttribute(k, v);
  Object.assign(e, resto);
  e.append(...hijos.flat().filter((h) => h != null));
  return e;
}
export function icono(id) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'icono');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<use href="img/iconos.svg#${id}"/>`;
  return s;
}
export const etiqueta = (texto, variante) => el('span', { clase: `etiqueta${variante ? ` etiqueta--${variante}` : ''}`, texto });
export const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);

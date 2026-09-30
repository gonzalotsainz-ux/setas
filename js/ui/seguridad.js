// Seguridad siempre visible: teléfono de Toxicología y aviso de duda.
export const TOXICOLOGIA = { nombre: 'Servicio de Información Toxicológica (INTCF)', tel: '915620420', telVisible: '91 562 04 20' };
export function botonToxicologia() {
  const a = document.createElement('a');
  a.className = 'boton boton--peligro boton--compacto';
  a.href = `tel:+34${TOXICOLOGIA.tel}`;
  a.setAttribute('aria-label', `Llamar a Toxicología: ${TOXICOLOGIA.telVisible}, 24 horas`);
  a.innerHTML = '<svg class="icono" aria-hidden="true"><use href="img/iconos.svg#i-telefono"/></svg>Toxicología';
  return a;
}
export function avisoDuda() {
  const p = document.createElement('p');
  p.className = 'texto-s';
  p.textContent = 'Ante la duda, no la comas. Síntomas más de 6 h después de comer = urgencia grave: llama al 112.';
  return p;
}

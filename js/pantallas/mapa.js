// Pantalla provisional: la sustituye su tarea correspondiente.
export function pintar() {
  const t = document.createElement('section');
  t.className = 'tarjeta';
  t.innerHTML = '<h2>Mapa</h2><p class="texto-2">Disponible en la siguiente versión</p>';
  t.style.marginTop = 'var(--esp-6)';
  return t;
}

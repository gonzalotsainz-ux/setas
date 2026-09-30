// Guardia contra carreras de pintado: un render asíncrono más antiguo no puede pisar a uno más nuevo.
export function guardia() {
  let ultimo = 0;
  return { nueva: () => ++ultimo, vigente: (t) => t === ultimo };
}

// Comparación de una cabecera de clave con su secreto sin cortar en el primer carácter distinto. Sin secreto (o con uno
// corto) no entra nadie. La usan las funciones «rejilla» y «pluvio».
export function claveValida(recibida, secreto) {
  if (typeof secreto !== 'string' || secreto.length < 32 || typeof recibida !== 'string') return false;
  const a = new TextEncoder().encode(recibida), b = new TextEncoder().encode(secreto);
  let distinto = a.length ^ b.length;
  for (let k = 0; k < b.length; k++) distinto |= (a[k] ?? 0) ^ b[k];
  return distinto === 0;
}

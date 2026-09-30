// Fotos de los borradores en IndexedDB (mucho más espacio que localStorage). Interfaz mínima y asíncrona:
// { disponible(), put(clave, blob), get(clave), borrar(clave) }. Todo con try/catch: si falla, quien llama
// cae al plan B (dataUrl en el borrador, con presupuesto).
const BD = 'setas-fotos', TABLA = 'fotos';

export function almacenIndexedDB(idb = globalThis.indexedDB) {
  let abierta = null;
  const abrir = () => (abierta ??= new Promise((ok, ko) => {
    if (!idb) { ko(new Error('Sin IndexedDB')); return; }
    let r;
    try { r = idb.open(BD, 1); } catch (e) { ko(e); return; }
    r.onupgradeneeded = () => r.result.createObjectStore(TABLA);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error ?? new Error('No se pudo abrir IndexedDB'));
    r.onblocked = () => ko(new Error('IndexedDB bloqueada'));
  }).catch((e) => { abierta = null; throw e; }));
  const op = async (modo, f) => {
    const db = await abrir();
    return new Promise((ok, ko) => {
      let r;
      try {
        const tx = db.transaction(TABLA, modo);
        r = f(tx.objectStore(TABLA));
        tx.oncomplete = () => ok(r?.result);
        tx.onerror = tx.onabort = () => ko(tx.error ?? new Error('IndexedDB falló'));
      } catch (e) { ko(e); }
    });
  };
  return {
    async disponible() {
      try { await op('readwrite', (s) => s.put(1, '__sonda')); await op('readwrite', (s) => s.delete('__sonda')); return true; } catch { return false; }
    },
    put: (clave, blob) => op('readwrite', (s) => s.put(blob, clave)),
    get: async (clave) => (await op('readonly', (s) => s.get(clave))) ?? null,
    borrar: (clave) => op('readwrite', (s) => s.delete(clave)),
  };
}

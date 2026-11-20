import type { Item } from './lib';
// Capa de datos. Hoy usa IndexedDB local; para sumar un servidor, reemplazar estas 3 funciones.
const open = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('memorias', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const run = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => { const db = await open();
  return new Promise<T>((res, rej) => { const q = f(db.transaction('items', mode).objectStore('items')); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
export const dbAll = () => run<Item[]>('readonly', s => s.getAll());
export const dbPut = (i: Item) => run('readwrite', s => s.put(i));
export const dbDel = (id: string) => run('readwrite', s => s.delete(id));
export const dbClear = () => run('readwrite', s => s.clear());

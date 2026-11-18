/**
 * Almacenamiento del dispositivo para datos grandes (la biblioteca, las listas).
 *
 * En la web, localStorage solo guarda unos 5 MB (en iPhone a veces menos): con una biblioteca
 * grande, lo que no cabía se perdía en silencio y los títulos aparecían y desaparecían. Por eso
 * en la web se usa IndexedDB, que guarda cientos de MB. En iPhone y Android sigue AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const useIdb = Platform.OS === 'web' && typeof indexedDB !== 'undefined';
let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('sollar', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getBig(key: string): Promise<string | null> {
  if (!useIdb) return AsyncStorage.getItem(key);
  try {
    const v = await idb<string | undefined>('readonly', (s) => s.get(key));
    if (v != null) return v;
  } catch {
    // Sin IndexedDB (modo privado antiguo): se usa localStorage.
  }
  // Primera vez: lo que estaba en localStorage se pasa a IndexedDB.
  const old = await AsyncStorage.getItem(key);
  if (old != null) {
    await setBig(key, old);
    AsyncStorage.removeItem(key).catch(() => {});
  }
  return old;
}

export async function setBig(key: string, value: string): Promise<void> {
  if (!useIdb) return AsyncStorage.setItem(key, value);
  try {
    await idb('readwrite', (s) => s.put(value, key));
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

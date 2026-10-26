import { namespaced } from '@/src/services/storageNamespace';

// expo-secure-store has no web implementation; IndexedDB keeps the secret out
// of synchronous storage and away from other origins.
const DB_NAME = namespaced('healthy-vault');
const STORE = 'secrets';
const SECRET_KEY = 'root-secret';

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openStore();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveRootSecret(hex: string): Promise<void> {
  await run('readwrite', (store) => store.put(hex, SECRET_KEY));
}

export async function loadRootSecret(): Promise<string | null> {
  return (
    (await run<string | undefined>('readonly', (store) =>
      store.get(SECRET_KEY)
    )) ?? null
  );
}

export async function clearRootSecret(): Promise<void> {
  await run('readwrite', (store) => store.delete(SECRET_KEY));
}

export function openWorkoutStore(factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!factory) {
      reject(new Error('storage'));
      return;
    }
    let settled = false;
    const r = factory.open('vsegiri-workouts', 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore('sessions', { keyPath: 'id' });
    r.onerror = r.onblocked = () => {
      settled = true;
      reject(new Error('storage'));
    };
    r.onsuccess = () => {
      if (settled) {
        r.result.close();
        return;
      }
      const db = r.result;
      db.onversionchange = () => db.close();
      const run = (mode, operation) =>
        new Promise((ok, no) => {
          const tx = db.transaction('sessions', mode),
            request = operation(tx.objectStore('sessions'));
          let result;
          request.onsuccess = () => (result = request.result);
          tx.oncomplete = () => ok(result);
          tx.onerror = tx.onabort = () => no(tx.error || new Error('storage'));
        });
      resolve({
        save: (w) => run('readwrite', (s) => s.put(w)),
        load: (id) => run('readonly', (s) => s.get(id)),
        list: async () => {
          const rows = await run('readonly', (s) => s.getAll());
          return rows.sort((a, b) =>
            String(b.updatedAt).localeCompare(String(a.updatedAt)),
          );
        },
        remove: (id) => run('readwrite', (s) => s.delete(id)),
        close: () => db.close(),
      });
    };
  });
}

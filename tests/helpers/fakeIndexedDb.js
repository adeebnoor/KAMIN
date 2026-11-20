// Task 46: a small in-memory IndexedDB, just enough for src/utils/localProfileStore.js (open with an
// upgrade, one object store, get / put / clear, transaction completion, deleteDatabase). The unit tests
// run in Node, which has no IndexedDB. Values are copied with structuredClone, as a real store does.
// `raw(db, store, key)` returns the stored record itself, so a test can look at exactly what is on disk.

const later = fn => setTimeout(fn, 0)

export function createFakeIndexedDb() {
  const databases = new Map() // name -> { version, stores: Map<storeName, Map<key, value>> }

  const makeTransaction = (data, storeName) => {
    const tx = { oncomplete: null, onerror: null, onabort: null, error: null }
    let pending = 0
    const settle = () => { if (--pending === 0) later(() => tx.oncomplete?.()) }
    const request = run => {
      const req = { onsuccess: null, onerror: null, result: undefined, error: null }
      pending++
      later(() => { req.result = run(); req.onsuccess?.(); settle() })
      return req
    }
    tx.objectStore = name => {
      if (name !== storeName || !data.stores.has(name)) throw new Error(`NotFoundError: ${name}`)
      const store = data.stores.get(name)
      return {
        get: key => request(() => (store.has(key) ? structuredClone(store.get(key)) : undefined)),
        put: (value, key) => request(() => { store.set(key, structuredClone(value)); return key }),
        clear: () => request(() => { store.clear() }),
      }
    }
    // A transaction with no request still completes.
    pending++
    later(settle)
    return tx
  }

  const makeDb = (name, data) => ({
    name,
    objectStoreNames: { contains: storeName => data.stores.has(storeName) },
    createObjectStore: storeName => { if (!data.stores.has(storeName)) data.stores.set(storeName, new Map()) },
    transaction: (storeName, mode = 'readonly') => makeTransaction(data, Array.isArray(storeName) ? storeName[0] : storeName, mode),
    close: () => {},
  })

  return {
    open(name, version = 1) {
      const req = { onupgradeneeded: null, onsuccess: null, onerror: null, result: null, error: null, transaction: null }
      later(() => {
        let data = databases.get(name)
        const upgrade = !data || version > data.version
        if (!data) { data = { version, stores: new Map() }; databases.set(name, data) }
        req.result = makeDb(name, data)
        if (upgrade) { data.version = version; req.onupgradeneeded?.() }
        req.onsuccess?.()
      })
      return req
    },
    deleteDatabase(name) {
      const req = { onsuccess: null, onerror: null, onblocked: null }
      later(() => { databases.delete(name); req.onsuccess?.() })
      return req
    },
    raw(dbName, storeName, key) {
      const value = databases.get(dbName)?.stores.get(storeName)?.get(key)
      return value === undefined ? undefined : structuredClone(value)
    },
    seed(dbName, storeName, key, value, version = 1) {
      databases.set(dbName, { version, stores: new Map([[storeName, new Map([[key, structuredClone(value)]])]]) })
    },
  }
}

// A Map-backed sessionStorage with the methods the app uses.
export function createMemoryStorage() {
  const map = new Map()
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: key => { map.delete(key) },
    clear: () => map.clear(),
    key: index => [...map.keys()][index] ?? null,
    get length() { return map.size },
    dump: () => JSON.stringify(Object.fromEntries(map)),
  }
}

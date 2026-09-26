export const KAMIN_LOCAL_DB = 'kamin-local-profile-v1'
export const KAMIN_LOCAL_STORE = 'profiles'
export const KAMIN_LOCAL_KEY = 'current'
export const KAMIN_LOCAL_VERSION = 1

const idb = () => globalThis.indexedDB

const openDb = () => new Promise((resolve,reject)=>{
  const api=idb()
  if(!api) return reject(new Error('INDEXEDDB_UNAVAILABLE'))
  const request=api.open(KAMIN_LOCAL_DB,KAMIN_LOCAL_VERSION)
  request.onupgradeneeded=()=>{
    const db=request.result
    if(!db.objectStoreNames.contains(KAMIN_LOCAL_STORE)) db.createObjectStore(KAMIN_LOCAL_STORE)
  }
  request.onsuccess=()=>resolve(request.result)
  request.onerror=()=>reject(request.error||new Error('INDEXEDDB_OPEN_FAILED'))
})

const txDone = tx => new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve()
  tx.onerror=()=>reject(tx.error||new Error('INDEXEDDB_TRANSACTION_FAILED'))
  tx.onabort=()=>reject(tx.error||new Error('INDEXEDDB_TRANSACTION_ABORTED'))
})

export async function readLocalProfile(){
  if(!idb()) return null
  const db=await openDb()
  try{
    const tx=db.transaction(KAMIN_LOCAL_STORE,'readonly')
    const request=tx.objectStore(KAMIN_LOCAL_STORE).get(KAMIN_LOCAL_KEY)
    const value=await new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result||null)
      request.onerror=()=>reject(request.error||new Error('INDEXEDDB_READ_FAILED'))
    })
    await txDone(tx)
    if(!value || value.version!==KAMIN_LOCAL_VERSION || !value.state || typeof value.state!=='object') return null
    return value.state
  } finally { db.close() }
}

export async function writeLocalProfile(state){
  if(!state || typeof state!=='object') throw new Error('LOCAL_PROFILE_STATE_REQUIRED')
  const db=await openDb()
  try{
    const tx=db.transaction(KAMIN_LOCAL_STORE,'readwrite')
    tx.objectStore(KAMIN_LOCAL_STORE).put({
      version:KAMIN_LOCAL_VERSION,
      updatedAt:new Date().toISOString(),
      state,
    },KAMIN_LOCAL_KEY)
    await txDone(tx)
  } finally { db.close() }
}

export async function clearLocalProfile(){
  const api=idb()
  if(!api) return
  try{
    const db=await openDb()
    const tx=db.transaction(KAMIN_LOCAL_STORE,'readwrite')
    tx.objectStore(KAMIN_LOCAL_STORE).clear()
    await txDone(tx)
    db.close()
  }catch{}
  await new Promise((resolve,reject)=>{
    const request=api.deleteDatabase(KAMIN_LOCAL_DB)
    request.onsuccess=()=>resolve()
    request.onerror=()=>reject(request.error||new Error('INDEXEDDB_DELETE_FAILED'))
    request.onblocked=()=>reject(new Error('INDEXEDDB_DELETE_BLOCKED'))
  })
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const KAMIN_PORTABLE_FORMAT = 'kamin-portable-profile'
export const KAMIN_ENCRYPTED_FORMAT = 'kamin-encrypted-profile'
export const KAMIN_PORTABLE_VERSION = 1
export const KAMIN_KDF_ITERATIONS = 310000
export const KAMIN_MIN_PASSPHRASE_LENGTH = 12

const aad = encoder.encode(`${KAMIN_ENCRYPTED_FORMAT}|${KAMIN_PORTABLE_VERSION}`)

const cryptoApi = () => {
  const api = globalThis.crypto
  if (!api?.subtle || !api?.getRandomValues) throw new Error('WEB_CRYPTO_UNAVAILABLE')
  return api
}

const toBase64 = bytes => {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let binary = ''
  const chunk = 0x8000
  for (let i=0;i<bytes.length;i+=chunk) binary += String.fromCharCode(...bytes.subarray(i,i+chunk))
  return btoa(binary)
}

const fromBase64 = value => {
  if (typeof value !== 'string' || !value) throw new Error('INVALID_BACKUP_ENCODING')
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value,'base64'))
  const binary=atob(value)
  return Uint8Array.from(binary,ch=>ch.charCodeAt(0))
}

const requirePassphrase = passphrase => {
  if (typeof passphrase !== 'string' || passphrase.length < KAMIN_MIN_PASSPHRASE_LENGTH) {
    throw new Error('PASSPHRASE_TOO_SHORT')
  }
}

async function deriveKey(passphrase,salt,iterations){
  const api=cryptoApi()
  const material=await api.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey'])
  return api.subtle.deriveKey(
    {name:'PBKDF2',salt,iterations,hash:'SHA-256'},
    material,
    {name:'AES-GCM',length:256},
    false,
    ['encrypt','decrypt'],
  )
}

const safeArray = (value,max) => Array.isArray(value) ? value.slice(0,max) : []

export function buildPortableProfile({state,person360,appVersion='1.0.0'}={}){
  if(!state || typeof state!=='object') throw new Error('PROFILE_STATE_REQUIRED')
  return {
    format:KAMIN_PORTABLE_FORMAT,
    version:KAMIN_PORTABLE_VERSION,
    exportedAt:new Date().toISOString(),
    appVersion,
    restorePolicy:{
      derivedJudgments:'recompute-on-import',
      externalSharingConsents:'reset-on-import',
    },
    state:{
      courses:safeArray(state.courses,1000),
      approved:!!state.approved,
      goal:state.goal??null,
      consents:{
        analyze:!!state.approved && !!state.consents?.analyze,
        insight:!!state.consents?.insight,
        advisor:false,
        research:false,
      },
      insight:state.insight && typeof state.insight==='object' ? state.insight : {},
      audit:safeArray(state.audit,100),
    },
    person360:person360 && typeof person360==='object' ? person360 : null,
  }
}

export function normalizePortableState(payload){
  if(!payload || payload.format!==KAMIN_PORTABLE_FORMAT || payload.version!==KAMIN_PORTABLE_VERSION) {
    throw new Error('UNSUPPORTED_PORTABLE_PROFILE')
  }
  const source=payload.state
  if(!source || typeof source!=='object') throw new Error('PORTABLE_STATE_MISSING')
  const courses=safeArray(source.courses,1000).filter(row=>row && typeof row==='object')
  const approved=!!source.approved && courses.length>0
  return {
    courses,
    approved,
    goal:typeof source.goal==='string' ? source.goal : null,
    consents:{
      analyze:approved && !!source.consents?.analyze,
      insight:!!source.consents?.insight,
      advisor:false,
      research:false,
    },
    insight:source.insight && typeof source.insight==='object' ? source.insight : {},
    audit:safeArray(source.audit,100).filter(entry=>entry && typeof entry==='object'),
  }
}

export async function encryptPortableProfile(payload,passphrase,{iterations=KAMIN_KDF_ITERATIONS}={}){
  requirePassphrase(passphrase)
  if(!payload || payload.format!==KAMIN_PORTABLE_FORMAT) throw new Error('INVALID_PORTABLE_PROFILE')
  if(!Number.isInteger(iterations) || iterations<100000) throw new Error('KDF_ITERATIONS_TOO_LOW')
  const api=cryptoApi()
  const salt=api.getRandomValues(new Uint8Array(16))
  const iv=api.getRandomValues(new Uint8Array(12))
  const key=await deriveKey(passphrase,salt,iterations)
  const ciphertext=await api.subtle.encrypt(
    {name:'AES-GCM',iv,additionalData:aad,tagLength:128},
    key,
    encoder.encode(JSON.stringify(payload)),
  )
  return {
    format:KAMIN_ENCRYPTED_FORMAT,
    version:KAMIN_PORTABLE_VERSION,
    createdAt:new Date().toISOString(),
    crypto:{
      cipher:'AES-GCM-256',
      kdf:'PBKDF2-HMAC-SHA-256',
      iterations,
      salt:toBase64(salt),
      iv:toBase64(iv),
      aad:toBase64(aad),
    },
    ciphertext:toBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptPortableProfile(envelope,passphrase){
  requirePassphrase(passphrase)
  if(!envelope || envelope.format!==KAMIN_ENCRYPTED_FORMAT || envelope.version!==KAMIN_PORTABLE_VERSION) {
    throw new Error('UNSUPPORTED_ENCRYPTED_PROFILE')
  }
  const iterations=Number(envelope.crypto?.iterations)
  if(!Number.isInteger(iterations) || iterations<100000 || iterations>2000000) throw new Error('INVALID_KDF_PARAMETERS')
  const salt=fromBase64(envelope.crypto?.salt)
  const iv=fromBase64(envelope.crypto?.iv)
  const ciphertext=fromBase64(envelope.ciphertext)
  if(salt.length!==16 || iv.length!==12) throw new Error('INVALID_KDF_PARAMETERS')
  try{
    const api=cryptoApi()
    const key=await deriveKey(passphrase,salt,iterations)
    const plaintext=await api.subtle.decrypt(
      {name:'AES-GCM',iv,additionalData:aad,tagLength:128},
      key,
      ciphertext,
    )
    const payload=JSON.parse(decoder.decode(plaintext))
    normalizePortableState(payload)
    return payload
  }catch(error){
    if(['PASSPHRASE_TOO_SHORT','UNSUPPORTED_PORTABLE_PROFILE','PORTABLE_STATE_MISSING'].includes(error?.message)) throw error
    throw new Error('BACKUP_DECRYPT_FAILED')
  }
}

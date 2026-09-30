// Import and verify a portable credential (Open Badges 3.0 / CLR 2.0 shaped Verifiable Credential).
//
// Verification means all of: valid structure, an issuer present in the local trusted-issuer
// registry, a Data Integrity proof (eddsa-jcs-2022) whose Ed25519 signature checks against the
// issuer's registered key, a validity window that includes now, and a credential status that can be
// resolved. Anything less is "unverified" or "unresolved". A JSON-LD document, a QR code or a
// visual seal never verifies anything by itself.
export const SUPPORTED_CRYPTOSUITES = ['eddsa-jcs-2022']
export const VERIFY_VERSION = 'kamin-credential-verify-v1'
const encoder = new TextEncoder()

// RFC 8785 JSON Canonicalization Scheme (subset sufficient for VC documents).
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function base58Decode(text) {
  const bytes = [0]
  for (const char of text) {
    let carry = B58.indexOf(char)
    if (carry < 0) throw new Error('INVALID_BASE58')
    for (let i = 0; i < bytes.length; i++) { carry += bytes[i] * 58; bytes[i] = carry & 0xff; carry >>= 8 }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8 }
  }
  for (const char of text) { if (char !== '1') break; bytes.push(0) }
  return Uint8Array.from(bytes.reverse())
}
export function base58Encode(bytes) {
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) { carry += digits[i] << 8; digits[i] = carry % 58; carry = (carry / 58) | 0 }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0 }
  }
  let prefix = ''
  for (const byte of bytes) { if (byte !== 0) break; prefix += '1' }
  return prefix + digits.reverse().map(d => B58[d]).join('')
}
// Multikey Ed25519 public key: multibase 'z' + base58btc(0xed 0x01 + 32 bytes)
export function decodeEd25519Multikey(multibase) {
  if (typeof multibase !== 'string' || !multibase.startsWith('z')) throw new Error('UNSUPPORTED_MULTIBASE')
  const bytes = base58Decode(multibase.slice(1))
  if (bytes.length !== 34 || bytes[0] !== 0xed || bytes[1] !== 0x01) throw new Error('UNSUPPORTED_KEY_TYPE')
  return bytes.slice(2)
}

const sha256 = async data => new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data))
const concat = (a, b) => { const out = new Uint8Array(a.length + b.length); out.set(a); out.set(b, a.length); return out }

// eddsa-jcs-2022: sign( sha256(jcs(proofOptions)) || sha256(jcs(document without proof)) )
export async function hashForProof(document, proof) {
  const { proofValue, ...options } = proof
  const { proof: _omit, ...unsecured } = document
  const context = document['@context']
  const proofOptions = context && !options['@context'] ? { '@context': context, ...options } : options
  return concat(await sha256(encoder.encode(canonicalize(proofOptions))), await sha256(encoder.encode(canonicalize(unsecured))))
}

export async function verifyProofSignature(document, proof, publicKeyMultibase) {
  const key = await globalThis.crypto.subtle.importKey('raw', decodeEd25519Multikey(publicKeyMultibase), { name: 'Ed25519' }, false, ['verify'])
  const signature = base58Decode(String(proof.proofValue || '').replace(/^z/, ''))
  return globalThis.crypto.subtle.verify({ name: 'Ed25519' }, key, signature, await hashForProof(document, proof))
}

const asArray = v => Array.isArray(v) ? v : v ? [v] : []
const issuerId = doc => typeof doc?.issuer === 'string' ? doc.issuer : doc?.issuer?.id || null

export function checkStructure(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['not-an-object'] }
  const types = asArray(doc.type)
  if (!types.includes('VerifiableCredential')) errors.push('type-missing-VerifiableCredential')
  if (!types.some(t => ['AchievementCredential', 'OpenBadgeCredential', 'ClrCredential'].includes(t))) errors.push('type-not-ob3-or-clr')
  if (!asArray(doc['@context']).some(c => /credentials\/v2|credentials\/v1/.test(String(c)))) errors.push('context-missing-vc')
  if (!issuerId(doc)) errors.push('issuer-missing')
  if (!doc.credentialSubject) errors.push('credentialSubject-missing')
  if (!doc.validFrom && !doc.issuanceDate) errors.push('validFrom-missing')
  return { ok: errors.length === 0, errors }
}

export function checkValidity(doc, now = new Date()) {
  const from = Date.parse(doc.validFrom || doc.issuanceDate || '')
  const until = doc.validUntil || doc.expirationDate ? Date.parse(doc.validUntil || doc.expirationDate) : null
  const notYet = Number.isFinite(from) && from > now.getTime()
  const expired = until !== null && (!Number.isFinite(until) || until < now.getTime())
  return { ok: Number.isFinite(from) && !notYet && !expired, validFrom: Number.isFinite(from) ? new Date(from).toISOString() : null, validUntil: until !== null && Number.isFinite(until) ? new Date(until).toISOString() : null, notYet, expired }
}

// Registry entries: { id, name, keys: [{ id, publicKeyMultibase }] , scope }
export async function verifyCredential(doc, { trustedIssuers = [], now = new Date() } = {}) {
  const reasons = []
  const structure = checkStructure(doc)
  if (!structure.ok) reasons.push(...structure.errors.map(e => `structure:${e}`))
  const id = issuerId(doc)
  const registered = trustedIssuers.find(entry => entry.id === id) || null
  const issuer = { id, trusted: !!registered, name: registered?.name || doc?.issuer?.name || null }
  if (!registered) reasons.push('issuer:not-in-trusted-registry')
  const validity = structure.ok ? checkValidity(doc, now) : { ok: false }
  if (structure.ok && !validity.ok) reasons.push(validity.notYet ? 'validity:not-yet-valid' : validity.expired ? 'validity:expired' : 'validity:invalid-dates')
  const proofs = asArray(doc?.proof)
  const proof = { present: proofs.length > 0, type: proofs[0]?.type || null, cryptosuite: proofs[0]?.cryptosuite || null, verified: null, error: null }
  if (!proof.present) reasons.push('proof:missing')
  else if (proof.type !== 'DataIntegrityProof' || !SUPPORTED_CRYPTOSUITES.includes(proof.cryptosuite)) { reasons.push('proof:unsupported-suite'); proof.verified = false }
  else if (registered) {
    const key = registered.keys?.find(k => k.id === proofs[0].verificationMethod) || null
    if (!key) { reasons.push('proof:verification-method-not-registered'); proof.verified = false }
    else {
      try { proof.verified = await verifyProofSignature(doc, proofs[0], key.publicKeyMultibase); if (!proof.verified) reasons.push('proof:signature-invalid') }
      catch (error) { proof.verified = false; proof.error = error.message; reasons.push('proof:verification-failed') }
    }
  } else proof.verified = null
  const status = { present: !!doc?.credentialStatus, resolved: false }
  if (status.present) reasons.push('status:unresolved-no-status-service')
  const outcome = structure.ok && issuer.trusted && validity.ok && proof.verified === true && !status.present ? 'verified'
    : (structure.ok && issuer.trusted && proof.verified === true && status.present) ? 'unresolved' : 'unverified'
  return { version: VERIFY_VERSION, outcome, reasons, structure, issuer, validity, proof, status, evidenceLevel: outcome === 'verified' ? 'institution-verified' : 'declared' }
}

// Test and future-issuer helper: sign a document with eddsa-jcs-2022 (Ed25519 private key as CryptoKey).
export async function signCredential(document, { privateKey, verificationMethod, created = new Date() }) {
  const proof = { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', created: created.toISOString(), verificationMethod, proofPurpose: 'assertionMethod' }
  const signature = new Uint8Array(await globalThis.crypto.subtle.sign({ name: 'Ed25519' }, privateKey, await hashForProof(document, proof)))
  return { ...document, proof: { ...proof, proofValue: `z${base58Encode(signature)}` } }
}
export const ed25519Multikey = rawPublicKey => `z${base58Encode(concat(Uint8Array.from([0xed, 0x01]), new Uint8Array(rawPublicKey)))}`

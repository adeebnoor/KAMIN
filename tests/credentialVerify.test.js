import { describe, it, expect } from 'vitest'
import { webcrypto } from 'node:crypto'
import { verifyCredential, signCredential, ed25519Multikey, canonicalize, base58Encode, base58Decode, checkStructure } from '../src/credentials/verify.js'
import { trustedIssuers } from '../src/credentials/issuers.js'

const now = new Date('2026-10-01T00:00:00Z')
async function issuer() {
  const pair = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const raw = await webcrypto.subtle.exportKey('raw', pair.publicKey)
  const id = 'did:example:kau-fcit'
  return { pair, entry: { id, name: 'Example University (test)', keys: [{ id: `${id}#key-1`, publicKeyMultibase: ed25519Multikey(raw) }] } }
}
const credential = (issuerId) => ({
  '@context': ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'],
  id: 'urn:uuid:test-credential-1', type: ['VerifiableCredential', 'AchievementCredential'],
  issuer: { id: issuerId, type: 'Profile', name: 'Example University' },
  validFrom: '2026-09-01T00:00:00Z', validUntil: '2028-09-01T00:00:00Z',
  credentialSubject: { type: 'AchievementSubject', id: 'did:example:student', achievement: { id: 'urn:kamin:skill:database', type: 'Achievement', name: 'Databases' } },
})

describe('portable credential verification', () => {
  it('ships an empty trusted-issuer registry, so every import stays unverified in the public release', async () => {
    expect(trustedIssuers).toEqual([])
    const { pair, entry } = await issuer()
    const signed = await signCredential(credential(entry.id), { privateKey: pair.privateKey, verificationMethod: entry.keys[0].id })
    const result = await verifyCredential(signed, { trustedIssuers, now })
    expect(result.outcome).toBe('unverified')
    expect(result.reasons).toContain('issuer:not-in-trusted-registry')
    expect(result.evidenceLevel).toBe('declared')
  })

  it('verifies structure, trusted issuer, eddsa-jcs-2022 signature and validity together', async () => {
    const { pair, entry } = await issuer()
    const signed = await signCredential(credential(entry.id), { privateKey: pair.privateKey, verificationMethod: entry.keys[0].id })
    const result = await verifyCredential(signed, { trustedIssuers: [entry], now })
    expect(result.reasons).toEqual([])
    expect(result.outcome).toBe('verified')
    expect(result.proof).toMatchObject({ present: true, cryptosuite: 'eddsa-jcs-2022', verified: true })
    expect(result.evidenceLevel).toBe('institution-verified')
  })

  it('rejects tampering, unknown keys, expiry, missing proofs and unresolved status', async () => {
    const { pair, entry } = await issuer()
    const signed = await signCredential(credential(entry.id), { privateKey: pair.privateKey, verificationMethod: entry.keys[0].id })
    const tampered = { ...signed, credentialSubject: { ...signed.credentialSubject, achievement: { ...signed.credentialSubject.achievement, name: 'Databases (edited)' } } }
    expect((await verifyCredential(tampered, { trustedIssuers: [entry], now })).reasons).toContain('proof:signature-invalid')
    const wrongKey = { ...signed, proof: { ...signed.proof, verificationMethod: `${entry.id}#key-9` } }
    expect((await verifyCredential(wrongKey, { trustedIssuers: [entry], now })).reasons).toContain('proof:verification-method-not-registered')
    const expired = await signCredential({ ...credential(entry.id), validUntil: '2026-09-15T00:00:00Z' }, { privateKey: pair.privateKey, verificationMethod: entry.keys[0].id })
    const expiredResult = await verifyCredential(expired, { trustedIssuers: [entry], now })
    expect(expiredResult.outcome).toBe('unverified')
    expect(expiredResult.reasons).toContain('validity:expired')
    const unsigned = await verifyCredential(credential(entry.id), { trustedIssuers: [entry], now })
    expect(unsigned.reasons).toContain('proof:missing')
    expect(unsigned.outcome).toBe('unverified')
    const withStatus = await signCredential({ ...credential(entry.id), credentialStatus: { id: 'https://example.edu/status/1#3', type: 'BitstringStatusListEntry' } }, { privateKey: pair.privateKey, verificationMethod: entry.keys[0].id })
    const statusResult = await verifyCredential(withStatus, { trustedIssuers: [entry], now })
    expect(statusResult.outcome).toBe('unresolved')
    expect(statusResult.reasons).toContain('status:unresolved-no-status-service')
    const other = { ...signed, proof: { ...signed.proof, cryptosuite: 'eddsa-rdfc-2022' } }
    expect((await verifyCredential(other, { trustedIssuers: [entry], now })).reasons).toContain('proof:unsupported-suite')
  })

  it('does not treat JSON-LD shape, a QR code or a seal as verification', async () => {
    expect(checkStructure({ '@context': ['https://www.w3.org/ns/credentials/v2'], type: ['VerifiableCredential', 'ClrCredential'], issuer: 'urn:kamin:issuer:self', credentialSubject: {}, validFrom: '2026-09-30T00:00:00Z' }).ok).toBe(true)
    const kaminExport = await verifyCredential({ '@context': ['https://www.w3.org/ns/credentials/v2'], type: ['VerifiableCredential', 'ClrCredential'], issuer: 'urn:kamin:issuer:self', credentialSubject: {}, validFrom: '2026-09-30T00:00:00Z', 'kamin:qr': 'https://verify.example.edu/x', 'kamin:seal': 'image' }, { trustedIssuers, now })
    expect(kaminExport.outcome).toBe('unverified')
    expect(kaminExport.reasons).toEqual(expect.arrayContaining(['issuer:not-in-trusted-registry', 'proof:missing']))
    expect(checkStructure({ type: ['VerifiableCredential'] }).errors).toEqual(expect.arrayContaining(['type-not-ob3-or-clr', 'issuer-missing']))
  })

  it('canonicalises deterministically and round-trips base58', () => {
    expect(canonicalize({ b: [1, { z: null, a: 'x' }], a: 2 })).toBe('{"a":2,"b":[1,{"a":"x","z":null}]}')
    const bytes = Uint8Array.from([0, 0, 255, 1, 2, 3])
    expect(base58Decode(base58Encode(bytes))).toEqual(bytes)
  })
})

describe('credential records', () => {
  it('stores only outcome, reasons and achievement ids, and never honours a verified flag without a trusted issuer', async () => {
    const { normalizeCredentialRecords, buildCredentialRecord, verifiedSkillIds, achievementsOf } = await import('../src/credentials/records.js')
    const { verifyCredential } = await import('../src/credentials/verify.js')
    const { pair, entry } = await issuer()
    const doc = await signCredential(credential(entry.id), { privateKey: pair.privateKey, verificationMethod: entry.keys[0].id })
    const verified = buildCredentialRecord(doc, await verifyCredential(doc, { trustedIssuers: [entry], now }), now)
    expect(verified).toMatchObject({ outcome: 'verified', issuerTrusted: true, evidenceLevel: 'institution-verified' })
    expect(verified.achievements).toEqual([{ id: 'urn:kamin:skill:database', name: 'Databases' }])
    expect(Object.keys(verified)).not.toContain('document')
    expect([...verifiedSkillIds(normalizeCredentialRecords([verified]))]).toEqual(['database'])
    const forged = normalizeCredentialRecords([{ ...verified, issuerTrusted: false }])[0]
    expect(forged.outcome).toBe('unverified')
    expect(forged.evidenceLevel).toBe('declared')
    expect(verifiedSkillIds([forged]).size).toBe(0)
    expect(achievementsOf({ credentialSubject: { verifiableCredential: [{ credentialSubject: { achievement: { id: 'urn:kamin:skill:statistics', name: { en: 'Stats' } } } }] } })).toEqual([{ id: 'urn:kamin:skill:statistics', name: 'Stats' }])
  })
})

// Locally stored outcomes of credential verification. Only the outcome, reasons and the
// achievement identifiers are kept; the credential document itself is not stored.
export const MAX_CREDENTIAL_RECORDS = 20
const OUTCOMES = ['verified', 'unverified', 'unresolved']
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const asArray = v => Array.isArray(v) ? v : v ? [v] : []

export function achievementsOf(doc) {
  const subjects = asArray(doc?.credentialSubject)
  const nested = subjects.flatMap(s => asArray(s?.verifiableCredential))
  const all = [...subjects, ...nested.flatMap(c => asArray(c?.credentialSubject))]
  return all.flatMap(s => asArray(s?.achievement)).map(a => ({ id: clean(a?.id, 200), name: clean(typeof a?.name === 'string' ? a.name : a?.name?.en || a?.name?.ar, 120) })).filter(a => a.id)
}

export function buildCredentialRecord(doc, result, now = new Date()) {
  return {
    id: `credential-${globalThis.crypto.randomUUID()}`,
    credentialId: clean(doc?.id, 200) || null,
    issuerId: result.issuer?.id || null, issuerName: result.issuer?.name || null, issuerTrusted: !!result.issuer?.trusted,
    outcome: result.outcome, reasons: result.reasons.slice(0, 20), evidenceLevel: result.evidenceLevel,
    achievements: achievementsOf(doc).slice(0, 50),
    validUntil: result.validity?.validUntil || null,
    importedAt: now.toISOString(), verifierVersion: result.version,
  }
}

export function normalizeCredentialRecords(list) {
  if (!Array.isArray(list)) return []
  const ids = new Set()
  return list.slice(0, MAX_CREDENTIAL_RECORDS).flatMap(r => {
    const id = clean(r?.id, 100)
    if (!/^credential-[a-zA-Z0-9-]{4,90}$/.test(id) || ids.has(id) || !OUTCOMES.includes(r?.outcome) || !Number.isFinite(Date.parse(r?.importedAt))) return []
    ids.add(id)
    // A verified outcome is only honoured when the issuer was trusted at import time.
    const outcome = r.outcome === 'verified' && r.issuerTrusted !== true ? 'unverified' : r.outcome
    return [{
      id, credentialId: clean(r.credentialId, 200) || null,
      issuerId: clean(r.issuerId, 200) || null, issuerName: clean(r.issuerName, 120) || null, issuerTrusted: r.issuerTrusted === true,
      outcome, reasons: (Array.isArray(r.reasons) ? r.reasons : []).map(x => clean(x, 80)).filter(Boolean).slice(0, 20),
      evidenceLevel: outcome === 'verified' ? 'institution-verified' : 'declared',
      achievements: (Array.isArray(r.achievements) ? r.achievements : []).map(a => ({ id: clean(a?.id, 200), name: clean(a?.name, 120) })).filter(a => a.id).slice(0, 50),
      validUntil: Number.isFinite(Date.parse(r.validUntil)) ? new Date(r.validUntil).toISOString() : null,
      importedAt: new Date(r.importedAt).toISOString(), verifierVersion: clean(r.verifierVersion, 60) || null,
    }]
  })
}

// Skill ids covered by a verified credential (urn:kamin:skill:<id>).
export const verifiedSkillIds = records => new Set((records || []).filter(r => r.outcome === 'verified').flatMap(r => r.achievements.map(a => a.id.match(/^urn:kamin:skill:([a-z0-9-]+)$/)?.[1]).filter(Boolean)))

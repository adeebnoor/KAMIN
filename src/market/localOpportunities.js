// Local opportunity data: every entry carries a region, a last-verified date, an expiry and a
// licensed source. The public release ships no entries; a small set of adverts never proves
// demand, so nothing here feeds Fit or ranking.
export const OPPORTUNITY_SCHEMA_VERSION = 'kamin-local-opportunities-v1'
export const REQUIRED_FIELDS = ['id', 'title', 'region', 'verifiedAt', 'expiresAt', 'source', 'pathwayIds']
const iso = v => Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null

export function validateOpportunity(entry) {
  const errors = []
  for (const field of REQUIRED_FIELDS) if (entry?.[field] === undefined || entry?.[field] === null || entry?.[field] === '') errors.push(`missing:${field}`)
  if (entry?.verifiedAt && !iso(entry.verifiedAt)) errors.push('invalid:verifiedAt')
  if (entry?.expiresAt && !iso(entry.expiresAt)) errors.push('invalid:expiresAt')
  if (entry?.source && (!entry.source.name || !entry.source.licence || !/^https:\/\//.test(entry.source.url || ''))) errors.push('invalid:source')
  if (entry?.pathwayIds && (!Array.isArray(entry.pathwayIds) || !entry.pathwayIds.length)) errors.push('invalid:pathwayIds')
  if (entry?.region && typeof entry.region !== 'string') errors.push('invalid:region')
  return { valid: errors.length === 0, errors }
}

// Shipped empty on purpose. Adding entries requires a permitted source and per-entry dates.
export const localOpportunities = Object.freeze([])

export function activeOpportunities(list = localOpportunities, now = new Date()) {
  return list.filter(entry => validateOpportunity(entry).valid && Date.parse(entry.expiresAt) > now.getTime())
}

export function opportunityStatus(list = localOpportunities, now = new Date()) {
  const active = activeOpportunities(list, now)
  return {
    loaded: list.length, active: active.length, schemaVersion: OPPORTUNITY_SCHEMA_VERSION,
    note: {
      ar: active.length ? `${active.length} فرصة محلية نشطة؛ كل واحدة تحمل منطقة وتاريخ تحقق وانتهاء ومصدرًا مرخّصًا. العدد الصغير لا يعني كثرة الطلب.` : 'لا بيانات فرص محلية محمّلة في هذه النسخة. كل فرصة تُضاف لاحقًا يجب أن تحمل منطقة وتاريخ آخر تحقق وتاريخ انتهاء ومصدرًا مسموحًا باستخدامه؛ ولا يُستنتج الطلب من مجموعة صغيرة.',
      en: active.length ? `${active.length} active local opportunities; each carries a region, verification date, expiry and licensed source. A small set does not indicate demand.` : 'No local opportunity data is loaded in this release. Every future entry must carry a region, last-verified date, expiry and a permitted source; demand is never inferred from a small set.',
    },
  }
}

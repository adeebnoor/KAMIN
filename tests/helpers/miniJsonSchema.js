// Task 18 · a small JSON Schema checker for the keywords src/pilot/study-file.schema.json uses
// (type, const, enum, pattern, maxLength, maxItems, items, required, properties, additionalProperties;
// Task 44: minimum and maximum for the suggestion counts).
// Shared by tests/pilotStudy.test.js and e2e/pilot-mode.spec.js; no extra dependency.
export function validate(value, s, at = '$') {
  const errors = []
  const types = s.type ? [].concat(s.type) : null
  const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v
  if ('const' in s && value !== s.const) errors.push(`${at}: must be ${s.const}`)
  if (s.enum && !s.enum.includes(value)) errors.push(`${at}: ${JSON.stringify(value)} not in enum`)
  if (types && !types.some(t => t === typeOf(value) || (t === 'number' && typeof value === 'number'))) errors.push(`${at}: type ${typeOf(value)}`)
  if (typeof value === 'string') {
    if (s.pattern && !new RegExp(s.pattern).test(value)) errors.push(`${at}: pattern`)
    if (s.maxLength !== undefined && value.length > s.maxLength) errors.push(`${at}: too long`)
  }
  if (typeof value === 'number') {
    if (s.minimum !== undefined && value < s.minimum) errors.push(`${at}: below minimum`)
    if (s.maximum !== undefined && value > s.maximum) errors.push(`${at}: above maximum`)
  }
  if (Array.isArray(value)) {
    if (s.maxItems !== undefined && value.length > s.maxItems) errors.push(`${at}: too many items`)
    if (s.items) value.forEach((item, i) => errors.push(...validate(item, s.items, `${at}[${i}]`)))
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && s.properties) {
    for (const key of s.required || []) if (!(key in value)) errors.push(`${at}.${key}: required`)
    for (const key of Object.keys(value)) {
      if (s.properties[key]) errors.push(...validate(value[key], s.properties[key], `${at}.${key}`))
      else if (s.additionalProperties === false) errors.push(`${at}.${key}: not allowed`)
    }
  }
  return errors
}

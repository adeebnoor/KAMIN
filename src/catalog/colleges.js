// Colleges a student can belong to (Task 04). Each college has its own approved course map;
// only FCIT has one today (Task 01). Science and Medicine have none yet, so their courses create
// no capability. Do not invent maps for them. `null` means "not chosen": ask the student and
// never assume FCIT.
//
// Task 53: `aliases` are the ways a transcript prints the college, in the normalised form of
// normalizeCollegeText (they are normalised again when this module loads, so an alias written with a
// short form such as "TECH" still matches). collegeFromText matches an alias exactly; there is no fuzzy
// matching, so a wrong college is never guessed.
export const COLLEGES = Object.freeze([
  { id: 'FCIT', labels: { ar: 'كلية الحاسبات وتقنية المعلومات', en: 'Faculty of Computing and Information Technology' }, hasApprovedMap: true,
    aliases: ['COMPUTING AND INFORMATION TECHNOLOGY', 'COMPUTING AND INFORMATION TECH', 'FCIT'] },
  { id: 'SCI', labels: { ar: 'كلية العلوم', en: 'Faculty of Science' }, hasApprovedMap: false,
    aliases: ['SCIENCE', 'SCIENCES'] },
  { id: 'MED', labels: { ar: 'كلية الطب', en: 'Faculty of Medicine' }, hasApprovedMap: false,
    aliases: ['MEDICINE'] },
])

export const COLLEGE_IDS = COLLEGES.map(c => c.id)
export const normalizeCollege = value => COLLEGE_IDS.includes(value) ? value : null
export const collegeById = id => COLLEGES.find(c => c.id === id) || null
export const collegeHasMap = id => collegeById(id)?.hasApprovedMap === true
export const collegeLabel = (id, lang = 'ar') => collegeById(id)?.labels[lang] || null

// One table of short forms a registrar prints, word → full word (after dots are removed).
export const COLLEGE_ABBREVIATIONS = Object.freeze({
  TECH: 'TECHNOLOGY', TECHNOL: 'TECHNOLOGY',
  INFO: 'INFORMATION', INF: 'INFORMATION',
  COMP: 'COMPUTING', COMPUT: 'COMPUTING',
  SCI: 'SCIENCE', SCIS: 'SCIENCES',
  MED: 'MEDICINE',
  ENG: 'ENGINEERING', ENGG: 'ENGINEERING',
  ADMIN: 'ADMINISTRATION', ADM: 'ADMINISTRATION',
  ECON: 'ECONOMICS',
  BUS: 'BUSINESS',
  MGMT: 'MANAGEMENT',
})

// "Faculty of Computing &amp; Information Tech." → "COMPUTING AND INFORMATION TECHNOLOGY"
export function normalizeCollegeText(raw) {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/&AMP;/g, ' AND ')
    .replace(/&/g, ' AND ')
    .replace(/[.,\-‐‑‒–—]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:THE )?(?:FACULTY|COLLEGE) OF /, '')
    .split(' ')
    .map(word => COLLEGE_ABBREVIATIONS[word] || word)
    .join(' ')
}

const ALIAS_TO_ID = new Map(COLLEGES.flatMap(c => c.aliases.map(alias => [normalizeCollegeText(alias), c.id])))

// The college printed on a transcript → { id: 'FCIT' | 'SCI' | 'MED' | null, raw }. Unknown or empty: id null,
// the printed text kept in `raw`.
export function collegeFromText(raw) {
  const text = raw == null ? null : String(raw).trim()
  const key = normalizeCollegeText(text)
  return { id: key ? ALIAS_TO_ID.get(key) ?? null : null, raw: text }
}

// Task 55: the college and major as the transcript prints them (free text, not personal data), kept on
// the profile as `collegeRaw` and `major`. Anything that is not a short line of text becomes null.
export function cleanTranscriptText(value, max = 120) {
  if (typeof value !== 'string') return null
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

// Grade normalisation shared by the inference engine, provenance and evidence levels.
const ARABIC_GRADES = new Map([
  ['أ+','A+'],['أ','A'],['ب+','B+'],['ب','B'],['ج+','C+'],['ج','C'],['د+','D+'],['د','D'],
  ['هـ','F'],['ه','F'],['ح','W'],['م','I'],
])
export const normalizeGrade = (grade) => {
  const raw=String(grade || '').trim().replace(/\s+/g,'').toUpperCase()
  return ARABIC_GRADES.get(raw) || raw
}

// Task 52 · the letter codes a KAU transcript prints, and what each one says about the course. One
// table; reading only. How TR and P count as evidence is decided in src/evidence/levels.js (Task 54),
// not here. A code that is not in the table is kept on its row with the status 'unknown'.
export const LETTER_STATUS = Object.freeze({
  'A+': 'passed', A: 'passed', 'B+': 'passed', B: 'passed', 'C+': 'passed', C: 'passed', 'D+': 'passed', D: 'passed',
  TR: 'transfer',
  P: 'passed-no-grade',
  F: 'not-passed', NP: 'not-passed', W: 'not-passed', WF: 'not-passed', IC: 'not-passed', IP: 'not-passed', DN: 'not-passed', NF: 'not-passed',
})
export const LETTER_CODES = Object.freeze(Object.keys(LETTER_STATUS))
export const letterStatus = letter => LETTER_STATUS[normalizeGrade(letter)] || 'unknown'

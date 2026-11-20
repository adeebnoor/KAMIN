import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { COURSE_EVIDENCE_PRINCIPLE, courseEvidencePrinciple } from '../src/content/trustCopy.js'

// Task 03 · supervisor wording (10 Nov 2026): a course grade is a clue to an expected learning
// outcome, never a guarantee of mastery. This guard fails when user-facing source text makes a
// grade or course conclusive. It is a short explicit phrase list, not the bare word "guarantee",
// so texts that deny it ("not a guarantee of mastery", "does not prove a skill") stay allowed.
const CONCLUSIVE_PHRASES = [
  'يضمن إتقان', 'تضمن إتقان', 'يضمن الإتقان', 'تضمن الإتقان', 'ضمان للإتقان', 'ضمان الإتقان',
  'يثبت إتقانه', 'تثبت إتقانه', 'دليل قاطع على', 'تؤكد إتقان', 'يؤكد إتقان',
  'guarantees mastery', 'guarantee mastery', 'guaranteed mastery', 'guarantees the skill',
  'proves the skill', 'proves mastery', 'proof of mastery', 'proves the capability',
  'grade proves', 'grade guarantees', 'grades prove', 'grades guarantee',
]

const normalize = text => text.toLowerCase().replace(/\s+/g, ' ')
const findConclusiveWording = text => {
  const plain = normalize(text)
  return CONCLUSIVE_PHRASES.filter(phrase => plain.includes(normalize(phrase)))
}

const SCANNED = ['src', 'scripts', 'public']
const TEXT_FILE = /\.(js|jsx|mjs|cjs|json|html|md|css)$/
const SKIP_DIR = new Set(['node_modules', 'vendor', 'models', 'ort', 'fonts', 'tesseract', 'semantic-index', 'ai-runtime', 'ocr'])
function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return SKIP_DIR.has(name) ? [] : files(path)
    return TEXT_FILE.test(name) && statSync(path).size < 2_000_000 ? [path] : []
  })
}

describe('Task 03 · wording guard: a course grade is a clue, not a guarantee', () => {
  it('COURSE_EVIDENCE_PRINCIPLE holds the approved text in Arabic and English', () => {
    expect(COURSE_EVIDENCE_PRINCIPLE.ar).toBe('درجة المقرر قرينة على مخرج تعلم متوقع، وليست ضمانًا لإتقانه. يختلف مستوى الدليل حسب الدرجة ونوع التقييم.')
    expect(COURSE_EVIDENCE_PRINCIPLE.en).toBe('A course grade is a clue to an expected learning outcome, not a guarantee of mastery. The evidence level depends on the grade and the type of assessment.')
    expect(Object.isFrozen(COURSE_EVIDENCE_PRINCIPLE)).toBe(true)
    expect(courseEvidencePrinciple('en')).toBe(COURSE_EVIDENCE_PRINCIPLE.en)
    expect(courseEvidencePrinciple('fr')).toBe(COURSE_EVIDENCE_PRINCIPLE.ar)
  })

  it('the principle itself is not flagged (it denies the guarantee)', () => {
    expect(findConclusiveWording(COURSE_EVIDENCE_PRINCIPLE.ar)).toEqual([])
    expect(findConclusiveWording(COURSE_EVIDENCE_PRINCIPLE.en)).toEqual([])
  })

  it('the guard catches conclusive wording if someone adds it', () => {
    expect(findConclusiveWording('Your grade guarantees mastery of databases.')).toContain('guarantees mastery')
    expect(findConclusiveWording('The A in CPIT-240 PROVES   the skill.')).toContain('proves the skill')
    expect(findConclusiveWording('الدرجة تضمن الإتقان في قواعد البيانات')).toContain('تضمن الإتقان')
    expect(findConclusiveWording('اجتياز المقرر يضمن إتقان المهارة')).toContain('يضمن إتقان')
  })

  it('no file in src/, scripts/ or public/ makes a grade or course conclusive', () => {
    const hits = SCANNED.flatMap(dir => files(dir).flatMap(path => {
      const found = findConclusiveWording(readFileSync(path, 'utf8'))
      return found.map(phrase => `${relative('.', path)}: "${phrase}"`)
    }))
    // This test file lists the phrases on purpose and lives in tests/, outside the scanned folders.
    expect(hits).toEqual([])
  })

  it('the principle is shown on the review screen, on course capability cards and on the methodology page', () => {
    // Task 11 moved the capability card into src/components/Dashboard.jsx; Task 22 moved the review
    // screen into src/components/CourseReview.jsx.
    const app = readFileSync('src/App.jsx', 'utf8') + readFileSync('src/components/Dashboard.jsx', 'utf8') + readFileSync('src/components/CourseReview.jsx', 'utf8')
    expect(app.match(/data-testid="course-evidence-principle"/g)?.length).toBe(2)
    expect(app).toContain('courseEvidencePrinciple(lang)')
    const methodology = readFileSync('public/methodology.html', 'utf8')
    expect(methodology).toContain(COURSE_EVIDENCE_PRINCIPLE.ar)
    expect(methodology).toContain(COURSE_EVIDENCE_PRINCIPLE.en)
    expect(readFileSync('scripts/build-public-pages.mjs', 'utf8')).toContain('COURSE_EVIDENCE_PRINCIPLE')
  })
})

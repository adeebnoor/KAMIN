// Task 62 · Home and step 1 of the new interface (src/ui2): the approval consent and the "clue, not a guarantee"
// sentence are byte-identical to the old interface (both screens are rendered here), Home is one sentence, no
// percentage, the review's rows and approval rule are the old screen's own, and step 1 loads on its own.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { copy } from '../src/i18n.js'
import { COURSE_EVIDENCE_PRINCIPLE } from '../src/content/trustCopy.js'
import CourseReview, { approvalBlock } from '../src/components/CourseReview.jsx'
import ResultCard from '../src/ui2/components/ResultCard.jsx'
import { homeSummary } from '../src/ui2/screens/Home.jsx'
import { NEXT_COPY, nextCopy, fillIn } from '../src/ui2/copy.js'
import { VIEW_TEXT, mainAction } from '../src/ui2/views.js'
import { blankState, hasMeaningfulProfileState } from '../src/state/profileState.js'

const LANGS = ['ar', 'en']
const read = file => readFileSync(file, 'utf8')
const sourceFiles = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? sourceFiles(p) : [p] })
// Made-up rows (no person): two linked FCIT courses and one with a grade the reader does not know.
const ROWS = [
  { code: 'CPIT-240', name: { ar: 'قواعد البيانات (1)', en: 'Databases (I)' }, grade: 'B+', source: 'document' },
  { code: 'CPIT-250', name: { ar: 'تحليل وتصميم النظم', en: 'Systems Analysis and Design' }, grade: 'A', source: 'document' },
  { code: 'STAT-110', name: { ar: 'الإحصاء', en: 'Statistics' }, grade: 'B', source: 'document' },
]
const noop = () => {}
const draftOf = (over = {}) => ({ rows: ROWS, setRows: noop, college: 'FCIT', setCollege: noop, student: { collegeRaw: 'COMPUTING AND INFORMATION TECHNOLOGY', major: 'INFORMATION TECHNOLOGY' }, consent: false, setConsent: noop, validation: { mode: 'pdf' }, ...over })
const newCard = (lang, over) => renderToStaticMarkup(createElement(ResultCard, { lang, draft: draftOf(over), onApprove: noop, onAnother: noop }))
const oldReview = (lang, over = {}) => { const d = draftOf(over); return renderToStaticMarkup(createElement(CourseReview, { lang, rows: d.rows, setRows: noop, onApprove: noop, consent: d.consent, setConsent: noop, college: d.college, setCollege: noop, student: d.student, validation: d.validation })) }
// The text next to the consent checkbox, and the text of the "clue" line, as rendered.
const consentIn = html => html.match(/<input type="checkbox"[^>]*\/?><span>([^<]*)<\/span>/)?.[1]
const clueIn = html => html.match(/data-testid="course-evidence-principle">[\s\S]*?<span>([^<]*)<\/span>/)?.[1]
const bytes = text => [...Buffer.from(String(text), 'utf8')]
const textOf = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

describe('Task 62 · the approval consent and the "clue" sentence, byte-identical in both interfaces', () => {
  for (const lang of LANGS) it(`${lang}: the new result card and the old review show the same bytes`, () => {
    const now = newCard(lang), before = oldReview(lang)
    expect(bytes(consentIn(now)), 'consent (new)').toEqual(bytes(copy[lang].screens.review.consent))
    expect(bytes(consentIn(before)), 'consent (old)').toEqual(bytes(copy[lang].screens.review.consent))
    expect(bytes(clueIn(now)), 'clue (new)').toEqual(bytes(COURSE_EVIDENCE_PRINCIPLE[lang]))
    expect(bytes(clueIn(before)), 'clue (old)').toEqual(bytes(COURSE_EVIDENCE_PRINCIPLE[lang]))
    expect(consentIn(now)).toBe(consentIn(before))
    expect(clueIn(now)).toBe(clueIn(before))
  })

  it('src/ui2 never copies either sentence: it reads them from src/i18n.js and src/content/trustCopy.js', () => {
    const sentences = LANGS.flatMap(lang => [copy[lang].screens.review.consent, COURSE_EVIDENCE_PRINCIPLE[lang]])
    for (const file of sourceFiles('src/ui2')) for (const sentence of sentences) expect(read(file), `${file} holds a copy`).not.toContain(sentence)
    const card = read('src/ui2/components/ResultCard.jsx')
    expect(card).toMatch(/R\.consent/)
    expect(card).toMatch(/courseEvidencePrinciple\(lang\)/)
  })
})

describe('Task 62 · Home: one sentence and one button', () => {
  it('the sentence has at most 12 words in Arabic and English, and is one sentence', () => {
    for (const lang of LANGS) {
      const sentence = VIEW_TEXT.home.line[lang]
      expect(sentence.trim().split(/\s+/).length, `${lang} words`).toBeLessThanOrEqual(12)
      expect(sentence.split(/[.؛!?؟]\s/).length, `${lang} one sentence`).toBe(1)
    }
    expect(VIEW_TEXT.home.line.en).toBe('Turn your transcript into a clear next step.')
  })

  // Task 75 (Amjd, 2026-11-19): under the heading, KAMIN's idea in three short lines; still one button and nothing else.
  it('Home renders the sentence as its heading, KAMIN\'s idea in three short lines and one button, nothing else (no demo, steps, FAQ or tour)', () => {
    const home = read('src/ui2/screens/Home.jsx').replace(/^\s*\/\/.*$/gm, '')
    expect(home.match(/<button\b/g)).toHaveLength(1)
    expect(home).not.toMatch(/<a\b|Sheet|sample|demo|loadExample|HelpPageLink/i)
    expect(home).toMatch(/<h1 [^>]*>\{VIEW_TEXT\.home\.line\[lang\]\}<\/h1>/)
    expect(home).toMatch(/<ul className="ui2-home-idea" data-testid="ui2-home-idea">\{w\.idea\.map\(line => <li key=\{line\}>\{line\}<\/li>\)\}<\/ul>/)
  })

  it('Task 75 · the three lines are short, plain, in both languages, and come from the How-it-works wording', () => {
    const guide = read('public/guide.html'), i18n = read('src/i18n.js')
    for (const lang of ['ar', 'en']) {
      const idea = NEXT_COPY[lang].home.idea
      expect(idea).toHaveLength(3)
      for (const line of idea) {
        expect(line.trim().split(/\s+/).length, line).toBeLessThanOrEqual(16)
        expect(line, 'plain words: no percentage, no technical term').not.toMatch(/[%٪]|Person 360|SPARQL|RDF|urn:|ontology|أنطولوجيا/i)
      }
    }
    // Their sources: the guide's opening line and step 2's title, and the old landing's "how it works" step 3.
    expect(guide).toContain('From a first interest to a clear next step')
    expect(guide).toContain('من أول اهتمام إلى خطوة واضحة')
    expect(guide).toContain('Add evidence and review it')
    expect(guide).toContain('أضف دليلًا وراجعه')
    expect(i18n).toContain('See why an opportunity fits, what is missing, and the practical action that moves you closer.')
    expect(i18n).toContain('ترى لماذا تناسبك الفرصة، ما الفجوة، وما الإجراء العملي الذي يقربك منها.')
    expect(NEXT_COPY.en.home.idea[0]).toBe('From a first interest to a clear next step.')
    expect(NEXT_COPY.ar.home.idea[0]).toBe('من أول اهتمام إلى خطوة واضحة.')
  })

  it('Continue comes with a one-line summary: approved courses (a count) and where the flow resumes', () => {
    const fresh = { ...blankState }
    expect(homeSummary(fresh, mainAction(fresh, hasMeaningfulProfileState(fresh)), 'en')).toBe(null)
    const approved = { ...blankState, approved: true, courses: ROWS }
    expect(homeSummary(approved, mainAction(approved, true), 'en')).toBe('Approved courses: 3 · Next step: Your projects')
    expect(homeSummary(approved, mainAction(approved, true), 'ar')).toBe('مقرراتك المعتمدة: 3 · الخطوة التالية: مشاريعك')
    const drafted = { ...blankState, courses: ROWS }
    expect(homeSummary(drafted, mainAction(drafted, true), 'en')).toBe('Next step: Your transcript')
  })
})

describe('Task 62 · step 1 words', () => {
  it('the privacy promise is the old start screen\'s sentence, word for word', () => {
    const start = read('src/components/StartScreen.jsx')
    const [, ar, en] = start.match(/tr\(lang, '([^']*يُرفع إلى أي خادم\.)', '([^']*uploaded to any server\.)'\)/)
    expect(NEXT_COPY.ar.upload.privacy).toBe(ar)
    expect(NEXT_COPY.en.upload.privacy).toBe(en)
  })

  it('no percentage anywhere in the new words, and Arabic and English have the same keys', () => {
    const strings = []
    const walk = value => { if (typeof value === 'string') strings.push(value); else if (typeof value === 'function') [1, 2, 5, 41].forEach(n => strings.push(value(n).join(''))); else if (value && typeof value === 'object') Object.values(value).forEach(walk) }
    walk(NEXT_COPY); walk(VIEW_TEXT)
    expect(strings.length).toBeGreaterThan(40)
    expect(strings.filter(s => /[%٪]/.test(s))).toEqual([])
    const keys = value => (value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v).map(sub => `${k}.${sub}`)]) : [])
    expect(keys(NEXT_COPY.ar)).toEqual(keys(NEXT_COPY.en))
  })

  it('"We read N courses" uses the right noun form for the count', () => {
    const line = (lang, n) => nextCopy(lang).result.read(n).join('')
    expect(line('en', 1)).toBe('We read 1 course')
    expect(line('en', 41)).toBe('We read 41 courses')
    expect([1, 2, 3, 10, 11, 41].map(n => line('ar', n))).toEqual(['قرأنا مقررًا واحدًا', 'قرأنا مقررين', 'قرأنا 3 مقررات', 'قرأنا 10 مقررات', 'قرأنا 11 مقررًا', 'قرأنا 41 مقررًا'])
    expect(fillIn('{a} · {b}', { a: 1 })).toBe('1 · {b}')
  })
})

describe('Task 62 · the result card', () => {
  it('one line: "We read N courses · <College> · <Major>", the clue on the card, consent and Approve below', () => {
    const en = newCard('en')
    expect(textOf(en.match(/<h2[^>]*data-testid="ui2-result-line"[^>]*>([\s\S]*?)<\/h2>/)[1])).toBe('We read 3 courses · Faculty of Computing and Information Technology · INFORMATION TECHNOLOGY')
    const ar = newCard('ar')
    expect(textOf(ar.match(/<h2[^>]*data-testid="ui2-result-line"[^>]*>([\s\S]*?)<\/h2>/)[1])).toBe('قرأنا 3 مقررات · كلية الحاسبات وتقنية المعلومات · INFORMATION TECHNOLOGY')
    // No college note when the college is known and has a course map; nothing needs a look here.
    expect(en).not.toMatch(/college-note|college-no-map|review-attention/)
    // Approve is disabled and says why (the consent box), as on the old screen.
    expect(en).toMatch(/<p class="ui2-approve-reason" data-testid="approve-reason">Tick the consent box first<\/p><button type="button" class="ui2-btn ui2-btn-primary" disabled="">/)
    expect(textOf(en)).not.toMatch(/\d\s?[%٪]|[%٪]\s?\d/)
  })

  it('"N need a look" and "Fix 1 course first" when a row has a problem; Approve then waits for the fix', () => {
    const rows = [...ROWS.slice(0, 2), { ...ROWS[2], grade: 'Q' }]
    const html = newCard('en', { rows, consent: true })
    expect(html).toMatch(/data-testid="review-attention">1 needs a look</)
    expect(html).toMatch(/data-testid="approve-reason">Fix 1 course first</)
    expect(html).toMatch(/>Fix something</)
  })

  it('a college that was not recognised: the short note with the printed text and one Fix; a college without a course map says so', () => {
    const unknown = newCard('en', { college: null, student: { collegeRaw: 'FACULTY OF ECONOMICS & ADMIN.', major: 'ACCOUNTING' } })
    expect(textOf(unknown)).toContain('We couldn’t recognise your college: «FACULTY OF ECONOMICS & ADMIN.»')
    expect(unknown).toMatch(/data-testid="college-fix-open">Fix</)
    expect(textOf(unknown.match(/data-testid="ui2-result-line"[^>]*>([\s\S]*?)<\/h2>/)[1])).toBe('We read 3 courses · ACCOUNTING')
    const science = newCard('en', { college: 'SCI', student: { collegeRaw: 'SCIENCE', major: 'MATHEMATICS' } })
    expect(science).toMatch(/data-testid="college-no-map">This college has no approved course map yet/)
    expect(unknown).not.toMatch(/<select/)
  })

  it('courses typed in by hand: the count of added courses, "Add courses", and the one-time college question', () => {
    const html = newCard('en', { rows: [], college: null, student: { collegeRaw: null, major: null }, validation: { mode: 'manual' } })
    expect(html).toMatch(/data-testid="ui2-result-line"[^>]*>Courses you added: 0</)
    expect(html).toMatch(/data-testid="college-question"/)
    expect(html).toMatch(/>Add courses</)
    expect(html).toMatch(/data-testid="approve-reason">Add at least one course</)
  })

  it('the synthetic example says it is synthetic', () => {
    expect(newCard('en', { validation: { mode: 'demo' }, student: { collegeRaw: 'COMPUTING & INFO. TECH.', major: null } })).toMatch(/data-testid="ui2-synthetic">These are synthetic data\. They replace your current record only if you approve them\.</)
  })
})

describe('Task 62 · the old review\'s rows and approval rule, shared', () => {
  it('approvalBlock gives the review\'s reasons: no row, rows to fix (one or more), the consent box', () => {
    const R = lang => copy[lang].screens.review
    expect(approvalBlock({ rows: [], consent: true, lang: 'en' })).toEqual({ blocked: true, reason: R('en').addOne })
    expect(approvalBlock({ rows: ROWS, consent: false, lang: 'ar' })).toEqual({ blocked: true, reason: R('ar').tickConsent })
    expect(approvalBlock({ rows: ROWS, consent: true, lang: 'en' })).toEqual({ blocked: false, reason: '' })
    const two = [{ ...ROWS[0], grade: 'Q' }, { ...ROWS[1], grade: '' }, ROWS[2]]
    expect(approvalBlock({ rows: two, consent: true, lang: 'en' })).toEqual({ blocked: true, reason: 'Fix 2 courses first' })
  })

  it('the old review and the new sheet use the same exported row list, add form and rule (no copy of the review)', () => {
    const review = read('src/components/CourseReview.jsx')
    expect(review).toMatch(/export function ReviewCourseList\(/)
    expect(review).toMatch(/export function AddCourseRow\(/)
    expect(review).toMatch(/export function approvalBlock\(/)
    expect(review).toMatch(/<ReviewCourseList lang=\{lang\} rows=\{rows\} setRows=\{setRows\} order=\{shown\}/)
    expect(review).toMatch(/<AddCourseRow lang=\{lang\} rows=\{rows\} setRows=\{setRows\}\/>/)
    expect(review).toMatch(/approvalBlock\(\{ rows, consent, lang \}\)/)
    const card = read('src/ui2/components/ResultCard.jsx')
    expect(card).toMatch(/import \{ AddCourseRow, ReviewCourseList, approvalBlock, attentionOrder, courseStatus, issuesByRow \} from '\.\.\/\.\.\/components\/CourseReview\.jsx'/)
    expect(card).not.toMatch(/<CourseList\b|<table/)
  })

  it('the old review still renders its rows, the attention line and the add button as before', () => {
    const html = oldReview('en', { rows: [...ROWS.slice(0, 2), { ...ROWS[2], grade: 'Q' }] })
    expect(html).toMatch(/data-testid="review-courses"/)
    expect(html.match(/aria-label="Course code \d"/g)).toHaveLength(3)
    expect(html).toMatch(/aria-label="Grade 3"/)
    expect(html).toMatch(/data-testid="review-attention">3 extracted courses<span aria-hidden="true"> · <\/span>1 needs a look</)
    expect(html).toMatch(/<div class="review-add"><button type="button" class="text-button">/)
    expect(html).toMatch(/data-testid="approve-reason">Fix 1 course first</)
  })
})

describe('Task 62 · step 1 loads on its own; the startup bundle never carries it', () => {
  it('AppNext loads step 1 and the trial layer with lazy(import()); Home is small and comes with the frame', () => {
    const app = read('src/ui2/AppNext.jsx')
    expect(app).toContain("const Upload = lazy(() => import('./screens/Upload.jsx'))")
    expect(app).toContain("const PilotStudy = lazy(() => import('../components/PilotStudy.jsx'))")
    expect(app).not.toMatch(/^import[^\n]*(screens\/Upload|components\/ResultCard|PilotStudy)/m)
    expect(app).toMatch(/^import Home from '\.\/screens\/Home\.jsx'/m)
    // Step 1's styles come with step 1.
    const importers = sourceFiles('src').filter(file => /step1\.css/.test(read(file))).map(file => file.split(path.sep).join('/'))
    expect(importers).toEqual(['src/ui2/screens/Upload.jsx'])
  })

  it('every CSS file of the new interface uses tokens only (theme.css alone holds the dark values)', () => {
    const files = readdirSync('src/ui2').filter(file => file.endsWith('.css') && file !== 'theme.css')
    // Task 63 added step 2's projects.css, Task 64 step 3's interests.css, Task 65 step 4's and My plan's next.css and
    // Task 66 Profile's profile.css and Task 67 Settings' settings.css, and Task 68 Help's help.css and the footer's
    // footer.css, and Task 74 My map's map.css, so the same check covers them. Task 75 deleted map.css (My map is the old
    // graph now) and added look.css (the old interface's look) and legacy-dark.css (dark mode for the reused old parts).
    expect(files.sort()).toEqual(['footer.css', 'help.css', 'interests.css', 'legacy-dark.css', 'look.css', 'next.css', 'profile.css', 'projects.css', 'settings.css', 'step1.css', 'ui2.css'])
    for (const file of files) {
      const css = read(`src/ui2/${file}`).replace(/\/\*[\s\S]*?\*\//g, '')
      expect(css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi), file).toBe(null)
    }
  })

  it('the synthetic example is reachable only at ?start=sample: Home and step 1 never offer it', () => {
    for (const file of ['src/ui2/screens/Home.jsx', 'src/ui2/screens/Upload.jsx', 'src/ui2/components/ResultCard.jsx']) {
      expect(read(file), file).not.toMatch(/loadExample|onDemo|retry\.demo|demoCourses/)
    }
    const app = read('src/ui2/AppNext.jsx')
    expect(app).toMatch(/searchParams\.get\('start'\) === 'sample'/)
    expect(app).toMatch(/entry: sample \? 'sample' : 'default'/)
  })
})

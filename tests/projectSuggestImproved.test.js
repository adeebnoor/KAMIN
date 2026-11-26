import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { suggestCapabilities, normaliseText, PROJECT_SUGGEST_IMPROVED_VERSION, IMPROVED_V2_VERSION, IMPROVED_V3_VERSION, DIALECT_DEFAULT, dialectRewrite, detectVariety, isWish } from '../src/ai/projectSuggestImproved.js'
import { suggestForProject, PROJECT_SUGGEST_METHOD } from '../src/ai/suggestSettings.js'
import { skills } from '../src/data.js'
import { createHash } from 'node:crypto'
import { HYBRID_THRESHOLD, HYBRID_THRESHOLDS, HYBRID_MAX, HYBRID_FALLBACK_VERSION, HYBRID_FALLBACK_V1, HYBRID_FALLBACK_V2, FALLBACK_DEFAULT, EMBEDDING_THRESHOLD, VARIETIES, capabilityPrototypes, createFallback, pickFallback, normaliseForEmbedding, thresholdFor } from '../src/ai/hybridFallback.js'
import { understandInterest } from '../src/interests/freeText.js'
import { activeSuggestMethod, firstEngine, offersLookDeeper } from '../src/ai/activeSuggestMethod.js'
import { hybrid } from '../eval/project-suggest/methods.mjs'
import { nextCopy } from '../src/ui2/copy.js'
import { EMBEDDING_MODEL } from '../src/semantic/config.js'

// Task 08 · improved local matching (no API). Interface is the same as projectSuggest.js.
const ids = text => suggestCapabilities(text).suggestions.map(s => s.skillId)
const lexicon = JSON.parse(readFileSync('src/ai/lexicon/capabilities.json', 'utf8'))

describe('improved project-suggestion engine', () => {
  it('one generic word alone suggests nothing: "Implemented the login" / «نفذت صفحة الدخول»', () => {
    expect(ids('Implemented the login.')).toEqual([])
    expect(ids('نفذت صفحة الدخول.')).toEqual([])
    expect(ids('Called the weather API.')).toEqual([])
    expect(suggestCapabilities('Implemented the login.')).toMatchObject({ version: PROJECT_SUGGEST_IMPROVED_VERSION, abstained: true })
  })

  it('"secured endpoints with JWT" suggests cyber and quotes that sentence (English and Arabic)', () => {
    const en = suggestCapabilities('Built the mobile app. Secured endpoints with JWT.')
    expect(en.suggestions).toEqual([expect.objectContaining({ skillId: 'cyber', snippet: 'Secured endpoints with JWT.', method: 'lexicon-v2' })])
    const ar = suggestCapabilities('بنيت تطبيق الجوال. أمّنت نقاط النهاية باستخدام JWT.')
    expect(ar.suggestions).toEqual([expect.objectContaining({ skillId: 'cyber', snippet: 'أمّنت نقاط النهاية باستخدام JWT.' })])
  })

  it('a text only about meetings and coordination abstains (English and Arabic)', () => {
    expect(suggestCapabilities('Coordinated meetings with the sponsor and followed up with the team.')).toMatchObject({ suggestions: [], abstained: true })
    expect(suggestCapabilities('نسقت الاجتماعات مع الراعي وتابعت مع الفريق.')).toMatchObject({ suggestions: [], abstained: true })
  })

  it('two weak terms of the same capability in one sentence are enough; split across sentences they are not', () => {
    expect(ids('Implemented a parser module.')).toEqual(['software'])
    expect(ids('Implemented it. The module was reviewed.')).toEqual([])
  })

  it('normalises Arabic forms, English inflection and Arabic-Indic digits', () => {
    expect(normaliseText('أُمِّنَتْ الـبيانات ١٢٣')).toBe('امنت البيانات 123')
    expect(ids('كتبتُ اختباراتِ وحدةٍ للتطبيق.')).toEqual(['testing'])
    expect(ids('Wrote several unit tests and tested the edge cases.')).toEqual(['testing'])
    expect(ids('وصممت جداول قاعدة البيانات.')).toEqual(['database'])
    // a single attached letter is tried, not forced: «وثيقة» is not a capability term
    expect(ids('كتبت وثيقة.')).toEqual([])
  })

  it('every snippet is verbatim in the input', () => {
    const texts = [
      'Built a responsive web page in React. Wrote SQL queries for the report!\nThen ran a regression on the survey.',
      'صممت قاعدة بيانات، وكتبت استعلامات. ثم حللت البيانات بالانحدار؟ وأخيرًا كتبت متطلبات النظام.',
    ]
    for (const text of texts) {
      const { suggestions } = suggestCapabilities(text)
      expect(suggestions.length).toBeGreaterThan(1)
      for (const s of suggestions) expect(text.includes(s.snippet), s.snippet).toBe(true)
    }
  })

  it('the lexicon only uses catalog capabilities and gives a reason for every term', () => {
    for (const [id, entry] of Object.entries(lexicon.capabilities)) {
      expect(skills[id], id).toBeTruthy()
      for (const term of [...entry.strong, ...entry.weak]) expect(term.why, `${id}: ${term.t}`).toBeTruthy()
    }
  })

  it('stays local: no fetch, no external host, no model download in the engine or its lexicon', () => {
    // Task 80 adds the dialect word lists and the fallback's example sentences to the lexicon folder; same checks.
    const files = ['src/ai/projectSuggestImproved.js', 'src/ai/suggestSettings.js', 'src/ai/lexicon/capabilities.json', 'src/ai/lexicon/dialect.json', 'src/ai/lexicon/capability-examples.json']
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/fetch\(|https?:\/\/|transformers|XMLHttpRequest/)
    }
    expect(readdirSync('src/ai/lexicon').sort()).toEqual(['capabilities.json', 'capability-examples.json', 'dialect.json'])
  })

  // Changed on 2026-11-11: the supervisor approved the comparison, so the app now uses the improved
  // engine. The lexicon stays available by name as the measured baseline. Task 80 made the default method 'hybrid';
  // Task 80b (team decision 2026-11-22) made it 'improved' again, engine v3.
  it('the UI uses the improved engine since the supervisor approved the comparison; the lexicon stays selectable', async () => {
    expect(PROJECT_SUGGEST_METHOD).toBe('improved')
    expect((await suggestForProject('Wrote SQL queries.', 'improved')).version).toBe(PROJECT_SUGGEST_IMPROVED_VERSION)
    expect((await suggestForProject('Wrote SQL queries.')).version).toBe(PROJECT_SUGGEST_IMPROVED_VERSION)
    expect((await suggestForProject('Wrote SQL queries.', 'lexicon')).version).toBe('kamin-project-suggest-lexicon-v1')
  })
})

// Task 43 · MiniLM only where the rule engine says nothing ("hybrid", not the default). The model itself is not
// loaded here: the fallback takes an `embed` function, so a fake one checks the logic; the real model's numbers
// are in eval/project-suggest/results/2026-11-21-hybrid.md (npm run eval:hybrid).
describe('Task 43 · hybrid: MiniLM fallback only when the improved engine abstains', () => {
  const config = JSON.parse(readFileSync('eval/project-suggest/config.json', 'utf8'))
  const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')

  it('the app threshold is the one tuned on the dev set only, stricter than the embedding method, at most 1 suggestion', () => {
    // Task 80: config.hybrid stays the v1 block; v2's per-variety thresholds are config.hybridV2 (tested below).
    expect(config.hybrid).toMatchObject({ method: HYBRID_FALLBACK_V1, threshold: HYBRID_THRESHOLD, max: HYBRID_MAX, tunedOn: 'dev-set.json' })
    expect(config.hybrid.tunedOnSha256).toBe(sha('eval/project-suggest/dev-set.json'))
    expect(EMBEDDING_THRESHOLD).toBe(config.embedding.threshold)
    expect(HYBRID_THRESHOLD).toBeGreaterThan(EMBEDDING_THRESHOLD)
    expect(HYBRID_MAX).toBe(1)
    for (const file of ['testset.json', 'testset-ai-v2.json']) expect(config.hybrid.tunedOnSha256).not.toBe(sha(`eval/project-suggest/${file}`))
  })

  it('keeps one capability at most, the best at or above the threshold (ties by id), and refuses a threshold that is not stricter', () => {
    const best = new Map([['testing', { score: 0.7, sentence: 'A.' }], ['database', { score: 0.9, sentence: 'B.' }], ['cyber', { score: 0.9, sentence: 'C.' }], ['project', { score: 0.4, sentence: 'D.' }]])
    expect(pickFallback(best)).toEqual([{ skillId: 'cyber', snippet: 'C.', score: 0.9 }])
    expect(pickFallback(new Map([['project', { score: HYBRID_THRESHOLD - 0.001, sentence: 'D.' }]]))).toEqual([])
    expect(pickFallback(new Map([['project', { score: HYBRID_THRESHOLD, sentence: 'D.' }]]))).toHaveLength(1)
    expect(() => pickFallback(best, 0.52)).toThrow('HYBRID_THRESHOLD_NOT_STRICTER')
  })

  it("uses the embedding method's prototypes: each capability's label and short description, in Arabic and English", () => {
    const descriptions = JSON.parse(readFileSync('eval/project-suggest/skill-descriptions.json', 'utf8'))
    const prototypes = capabilityPrototypes()
    expect(prototypes).toHaveLength(Object.keys(skills).length * 2)
    expect(prototypes.find(p => p.id === 'cyber' && p.lang === 'en').text).toBe(`${skills.cyber.labels.en}. ${descriptions.cyber.en}`)
    expect(prototypes.find(p => p.id === 'cyber' && p.lang === 'ar').text).toBe(`${skills.cyber.labels.ar}. ${descriptions.cyber.ar}`)
  })

  it("quotes the student's own sentence verbatim (Arabic diacritics kept), embeds prototypes once, and abstains below the threshold", async () => {
    const prototypes = capabilityPrototypes()
    const calls = []
    // A fake 3-number "model": the cyber prototypes point one way, a sentence that says "حميت" or "protected" mostly the same way.
    const embed = async text => {
      calls.push(text)
      const p = prototypes.find(x => x.text === text)
      if (p) return p.id === 'cyber' ? [1, 0, 0] : [0, 1, 0]
      return /حميت|protected/i.test(text) ? [0.8, 0, 0.6] : [0, 0, 1]
    }
    const fallback = createFallback(embed, { version: 'v1' }) // Task 80: v1 named; v2 is tested below
    const result = await fallback.suggest('بنيتُ الموقع. حميتُ الحسابات من المهاجمين!')
    expect(result).toMatchObject({ version: HYBRID_FALLBACK_V1, abstained: false })
    expect(result.suggestions).toEqual([expect.objectContaining({ skillId: 'cyber', snippet: 'حميتُ الحسابات من المهاجمين!', method: 'minilm-fallback', confidence: 'by-meaning' })])
    expect(calls).toContain(normaliseForEmbedding('حميتُ الحسابات من المهاجمين!'))
    const before = calls.length
    expect(await fallback.suggest('Wrote the report. Met the team.')).toMatchObject({ suggestions: [], abstained: true })
    expect(calls.length - before).toBe(2) // two sentences; no prototype embedded again
  })

  // Task 80 made hybrid the default; Task 80b (team decision 2026-11-22) restored Task 43's switch exactly.
  it('is not the default; ?suggest=hybrid is the only switch, and "Look deeper" is offered only after an abstention', async () => {
    expect(PROJECT_SUGGEST_METHOD).toBe('improved')
    expect(activeSuggestMethod('')).toBe('improved')
    expect(activeSuggestMethod('?suggest=hybrid')).toBe('hybrid')
    for (const other of ['?suggest=improved', '?suggest=embedding', '?suggest=HYBRID', '?suggest=lexicon', '?ui=old']) expect(activeSuggestMethod(other)).toBe('improved')
    // hybrid runs the improved engine first; no model in this step
    expect(firstEngine('hybrid')).toBe('improved')
    expect(firstEngine('improved')).toBe('improved')
    expect((await suggestForProject('Secured endpoints with JWT.', firstEngine('hybrid'))).version).toBe(PROJECT_SUGGEST_IMPROVED_VERSION)
    expect(offersLookDeeper('hybrid', suggestCapabilities('Coordinated meetings with the sponsor.'))).toBe(true)
    expect(offersLookDeeper('hybrid', suggestCapabilities('Secured endpoints with JWT.'))).toBe(false)
    expect(offersLookDeeper('improved', suggestCapabilities('Coordinated meetings with the sponsor.'))).toBe(false)
  })

  it("the harness method: improved's answer when it suggests something; the threshold is required", async () => {
    expect(() => hybrid({})).toThrow('HYBRID_THRESHOLD_REQUIRED')
    const prediction = await hybrid({ threshold: HYBRID_THRESHOLD }).predict('Built the mobile app. Secured endpoints with JWT.')
    expect(prediction.suggestions).toEqual([{ skillId: 'cyber', support: 'Secured endpoints with JWT.' }])
  })

  it('the model loads only from "Look deeper" after consent, in the lazy Projects chunk; the startup files do not import it', () => {
    const deeper = readFileSync('src/ui2/components/LookDeeper.jsx', 'utf8')
    const worker = deeper.indexOf('new Worker('), guard = deeper.indexOf('if (!agreed || busy) return')
    expect(guard).toBeGreaterThan(0)
    expect(worker).toBeGreaterThan(guard)
    expect(deeper.match(/new Worker\(/g)).toHaveLength(1)
    expect(deeper).toContain("current.postMessage({ type: 'project', text: description.trim() })")
    // "Stop and delete model files" deletes the model's own cache (the name is kept in LookDeeper.jsx, not imported).
    expect(deeper).toContain(`export const MODEL_CACHE = '${EMBEDDING_MODEL.cache}'`)
    expect(deeper).toContain('await caches.delete(MODEL_CACHE)')
    expect(readFileSync('src/ui2/screens/Projects.jsx', 'utf8')).toContain("import LookDeeper from '../components/LookDeeper.jsx'")
    for (const file of ['src/ai/suggestSettings.js', 'src/main.jsx']) { // Task 70: App.jsx and ProjectEvidence.jsx are deleted
      expect(readFileSync(file, 'utf8').replace(/^\/\/.*$/gm, ''), file).not.toMatch(/hybridFallback|activeSuggestMethod|LookDeeper/)
    }
    // The worker answers with at most one suggestion and never sends a score to the page.
    const source = readFileSync('src/semantic/recall.worker.js', 'utf8')
    expect(source).toContain("if(data.type==='project')")
    expect(source).toContain('suggestions:result.suggestions.map(({score,...s})=>s)')
  })

  it("the words: the button and the label word for word; the consent and delete sentences are SemanticRecall's", () => {
    const en = nextCopy('en').projects.deeper, ar = nextCopy('ar').projects.deeper
    expect(en.button).toBe('Look deeper (downloads a 118 MB local model once)')
    expect(en.byMeaning).toBe('found by meaning, please check')
    expect(ar.button).toContain('118 MB')
    const recall = readFileSync('src/components/SemanticRecall.jsx', 'utf8')
    for (const words of [en, ar]) for (const key of ['consent', 'remove', 'removed', 'removeFailed', 'cacheNotice']) expect(recall, key).toContain(words[key])
    // no score and no percentage in the words (the download's progress is the <progress> bar)
    for (const words of [en, ar]) for (const [key, text] of Object.entries(words)) expect(text, key).not.toMatch(/[%٪]|score|urn:kamin/i)
  })
})

// Task 77 · a plain description of what a system does (no technical word, typos, dialect) suggests systems analysis
// and requirements, each quoting the student's own text word for word. Paraphrases of Amjd's test of 2026-11-21:
// no real link, no real name. The numbers are in eval/project-suggest/results/2026-11-22-workflow.md.
describe('Task 77 · descriptions of what a system does', () => {
  const HOSPITAL_AR = 'نظام طوارى للمستشفي: يجي اتصال، المشرف يدخل تفاصيل الحاله، النظام يرسلها للوحده المتاحه، الوحده ترد بالموقع وتفاصيل الحاله، وبعد الاستجابه يروح تقرير للمشرف.'
  const HOSPITAL_EN = 'A hospital emergency system: a call comes in, the supervisor enters the case details, the system sends it to the available unit, the unit responds with its location, and after the response a report goes to the supervisor.'
  const lexiconFile = JSON.parse(readFileSync('src/ai/lexicon/capabilities.json', 'utf8'))

  it('the hospital example, Arabic with typos and English, suggests systems analysis and requirements, quoting the whole sentence', () => {
    for (const text of [HOSPITAL_AR, HOSPITAL_EN]) {
      const result = suggestCapabilities(text)
      expect(result.version).toBe(PROJECT_SUGGEST_IMPROVED_VERSION) // v3 since Task 80; the workflow answer is unchanged
      expect(result.suggestions.map(s => s.skillId).sort()).toEqual(['requirements', 'systems-analysis'])
      for (const s of result.suggestions) {
        expect(s.snippet).toBe(text)
        expect(s).toMatchObject({ method: 'workflow-v1', confidence: 'workflow-description' })
        expect(s.matches.length).toBeGreaterThan(3)
      }
    }
  })

  it('Arabic spelling variants give the same answer: ة/ه, ى/ي, أ/إ/ا and a missing hamza', () => {
    const variants = [
      'نظام الطوارئ: يصل استدعاء، فيُدخل المشرف الحالة، ثم يرسلها النظام إلى الوحدة المتاحة.',
      'نظام الطوارى: يصل استدعا، فيدخل المشرف الحاله، ثم يرسلها النظام الى الوحده المتاحه.',
      'نظام الطواري: يصل إستدعاء، فيدخل المشرف الحاله، ثم يرسلها النظام إلي الوحدة المتاحة.',
    ]
    for (const text of variants) expect(ids(text).sort(), text).toEqual(['requirements', 'systems-analysis'])
    expect(normaliseText('استدعاء إنشاء مسؤول')).toBe(normaliseText('استدعا انشا مسوول'))
  })

  it('a person’s own errands abstain: no system is being described', () => {
    for (const text of [
      'I sent the weekly report to my manager.',
      'أرسلت التقرير الأسبوعي إلى مديري.',
      'ارسلت التقرير الاسبوعي للمشرف وتابعت معه.',
      'I was the supervisor: I received calls, assigned volunteers to teams and sent a daily report.',
      'Used the hospital system and saw how it sends reports.',
    ]) expect(suggestCapabilities(text), text).toMatchObject({ suggestions: [], abstained: true })
  })

  it('a list of what the app does (no hand-off between roles) is requirements only', () => {
    expect(ids('Listed what users can do in the app: register, add a request, edit it and check its status.')).toEqual(['requirements'])
    expect(ids('حددت وش يقدر يسوي المستخدم في التطبيق: يسجل، يضيف طلب، يعدل طلبه، ويشوف حالة الطلب.')).toEqual(['requirements'])
  })

  it('across up to three sentences the quote is the verbatim slice of those sentences; four apart is too far', () => {
    const text = 'We built a complaints system. Staff receive each complaint and log it. The system forwards it to the responsible department and tracks its status.'
    const result = suggestCapabilities(text)
    expect(result.suggestions.map(s => s.skillId).sort()).toEqual(['requirements', 'systems-analysis'])
    for (const s of result.suggestions) expect(text.includes(s.snippet), s.snippet).toBe(true)
    const apart = 'We built a system. It was a long project. We met every week. Staff receive each complaint and forward it to the department.'
    expect(ids(apart)).toEqual([])
  })

  it('a technical term still wins: its own sentence is quoted and the workflow rule adds nothing for that capability', () => {
    const text = 'Mapped the as-is workflow with stakeholders. The system receives each request and assigns it to a technician, and the supervisor gets a report.'
    const sa = suggestCapabilities(text).suggestions.find(s => s.skillId === 'systems-analysis')
    expect(sa).toMatchObject({ snippet: 'Mapped the as-is workflow with stakeholders.', method: 'lexicon-v2' })
  })

  it('the workflow vocabulary gives a reason for every group, names only known kinds and counts each concept once', () => {
    const w = lexiconFile.workflow
    expect(lexiconFile.version).toBe('kamin-capability-lexicon-v2')
    expect(Object.keys(w).filter(k => Array.isArray(w[k])).sort()).toEqual(['actions', 'modal', 'roles', 'system'])
    for (const kind of ['actions', 'modal', 'roles', 'system']) {
      const keys = w[kind].map(g => g.k)
      expect(new Set(keys).size, kind).toBe(keys.length)
      for (const g of w[kind]) { expect(g.why, `${kind}.${g.k}`).toBeTruthy(); expect(g.t.length).toBeGreaterThan(0) }
    }
    expect(lexiconFile.builtOn).toMatch(/never testset-workflow\.json/)
  })
})

// Task 80 · Saudi dialect, standard Arabic, English and mixed sentences. Every example is made up and none is a case
// of any test set. The numbers are in eval/project-suggest/results/2026-11-22-dialect.md (npm run eval:dialect).
describe('Task 80 · dialect, MSA, English and mixed sentences', () => {
  const dialectFile = JSON.parse(readFileSync('src/ai/lexicon/dialect.json', 'utf8'))
  const examplesFile = JSON.parse(readFileSync('src/ai/lexicon/capability-examples.json', 'utf8'))
  const config = JSON.parse(readFileSync('eval/project-suggest/config.json', 'utf8'))
  const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')

  it('the brief\'s example: dialect and Arabic-letter English words suggest databases, quoting the sentence word for word', () => {
    const text = 'سويت أبلكيشن للحجوزات وربطته بداتابيس'
    const result = suggestCapabilities(text)
    expect(result.version).toBe(IMPROVED_V3_VERSION)
    expect(result.suggestions).toEqual([expect.objectContaining({ skillId: 'database', snippet: text, method: 'lexicon-v2' })])
    // v2 (before Task 80) understood none of it
    expect(suggestCapabilities(text, { dialect: false })).toMatchObject({ version: IMPROVED_V2_VERSION, suggestions: [] })
  })

  it('a wish, an errand or a party suggests nothing; the same wish is still read as an interest', () => {
    for (const text of ['أبغى أتعلم البرمجة', 'سويت عزومة للشباب', 'ودي أشتغل في الأمن السيبراني', 'I want to learn machine learning.']) expect(ids(text), text).toEqual([])
    expect(isWish('ودي أشتغل في الأمن السيبراني')).toBe(true)
    expect(isWish('ودي أوضح إني صممت الداتابيس')).toBe(false)
    expect(isWish('أبغى أقول إني سويت تستات للكود')).toBe(false)
    expect(understandInterest('ودي أشتغل في الأمن السيبراني').capabilities).toContain('cyber')
  })

  it('reads the brief\'s words as standard forms, with attached prefixes and plural endings, and keeps other text as it is', () => {
    expect(dialectRewrite('سويت أبلكيشن')).toBe('عملت تطبيق')
    expect(dialectRewrite('بالسستم')).toBe('نظام')
    expect(dialectRewrite('أبي')).toBe('أريد')
    expect(dialectRewrite('ودي')).toBe('أريد')
    expect(dialectRewrite('زي كذا')).toBe('مثل عدة')
    expect(dialectRewrite('الكود حقي')).toBe('الكود ')
    expect(dialectRewrite('يشتغل')).toBe('يعمل')
    expect(dialectRewrite('التستات والكلاسات')).toBe('اختبار class')
    expect(dialectRewrite('باك اب للسيرفر')).toBe('نسخ احتياطي خادم')
    expect(dialectRewrite('الباك اند')).toBe('backend')
    expect(dialectRewrite('صممت قاعدة بيانات علائقية.')).toBe('صممت قاعدة بيانات علائقية.')
    // a lone two-letter key never matches by cutting an ending off another word («بقي» is not «بق»)
    expect(dialectRewrite('بقي')).toBe('بقي')
  })

  it('every capability has dialect phrases and dialect/mixed example sentences, each with a reason', () => {
    for (const id of Object.keys(skills)) {
      const entry = dialectFile.capabilities[id]
      expect(entry, id).toBeTruthy()
      expect([...entry.strong, ...entry.weak].length, id).toBeGreaterThan(0)
      for (const term of [...entry.strong, ...entry.weak]) expect(term.why, `${id}: ${term.t}`).toBeTruthy()
      expect(examplesFile.examples[id].dialect, id).toHaveLength(3)
      expect(examplesFile.examples[id].mixed, id).toHaveLength(2)
      for (const text of examplesFile.examples[id].mixed) expect(text, id).toMatch(/[A-Za-z]{2,}/)
    }
    for (const entry of dialectFile.map) { expect(entry.why).toBeTruthy(); expect(entry.from.length).toBeGreaterThan(0) }
  })

  it('no test-set text is copied into the word lists or the examples', () => {
    const tests = ['testset.json', 'testset-ai-v2.json', 'testset-workflow.json', 'testset-dialect.json']
      .flatMap(f => { const raw = JSON.parse(readFileSync(`eval/project-suggest/${f}`, 'utf8')); return (Array.isArray(raw) ? raw : raw.cases).map(c => normaliseText(c.text)) })
    const ours = [...Object.values(examplesFile.examples).flatMap(e => [...e.dialect, ...e.mixed]), ...Object.values(dialectFile.capabilities).flatMap(e => [...e.strong, ...e.weak].map(t => t.t))]
    for (const text of ours) for (const t of tests) expect(t === normaliseText(text), text).toBe(false)
  })

  it('every quote stays the original sentence, character for character, in dialect and mixed text', () => {
    const texts = ['سوّينا ويب سايت للنادي. وكتبت كويريز على الداتابيس حقتنا!', 'سويت unit tests للـ functions وحطيت الكود على الـ server.']
    for (const text of texts) {
      const { suggestions } = suggestCapabilities(text)
      expect(suggestions.length).toBeGreaterThan(0)
      for (const s of suggestions) expect(text.includes(s.snippet), s.snippet).toBe(true)
    }
  })

  it('detects the variety: English, mixed, dialect, standard Arabic', () => {
    expect(detectVariety('Built the backend in Node.')).toBe('en')
    expect(detectVariety('سويت REST API بالـ Express.')).toBe('mixed')
    expect(detectVariety('سويت تطبيق للنادي.')).toBe('dialect')
    expect(detectVariety('اللي سوى التصميم أنا.')).toBe('dialect')
    expect(detectVariety('صممت قاعدة بيانات علائقية للمكتبة.')).toBe('msa')
  })

  it('v3 is the default engine and fallback v2 the default fallback, as rule 7 decided; v2 and v1 stay reproducible', () => {
    expect(DIALECT_DEFAULT).toBe(true)
    expect(PROJECT_SUGGEST_IMPROVED_VERSION).toBe(IMPROVED_V3_VERSION)
    expect(FALLBACK_DEFAULT).toBe('v2')
    expect(HYBRID_FALLBACK_VERSION).toBe(HYBRID_FALLBACK_V2)
    const report = readFileSync('eval/project-suggest/results/2026-11-22-dialect.md', 'utf8')
    expect(report).toContain('**Engine v3 vs v2:** dialect F1 up; varieties that drop: none; unsupported 0 → **met: v3 becomes the default engine**')
    expect(report).toContain('"Look deeper" by default (combination after vs engine after):** dialect F1 up; varieties that drop: none; unsupported 0 → **met**')
    expect(capabilityPrototypes({ version: 'v2' })).toHaveLength(Object.keys(skills).length * 7)
    expect(capabilityPrototypes()).toHaveLength(Object.keys(skills).length * 2)
  })

  it('fallback v2: one threshold per variety, equal to config.json, tuned on the development sets only, each stricter than 0.52', () => {
    expect(config.hybridV2).toMatchObject({ method: HYBRID_FALLBACK_V2, thresholds: { ...HYBRID_THRESHOLDS }, max: 1, tunedOn: ['dev-set.json', 'dev-set-workflow.json', 'dev-set-dialect.json'] })
    expect(Object.keys(HYBRID_THRESHOLDS).sort()).toEqual([...VARIETIES].sort())
    for (const t of Object.values(HYBRID_THRESHOLDS)) expect(t).toBeGreaterThan(EMBEDDING_THRESHOLD)
    // Task 80b: a dev set that grew after tuning (hard negatives) keeps the tuned cases unchanged; tested in the Task 80b block.
    const grown = config.hybridV2.devSetsGrownAfterTuning || {}
    for (const [file, value] of Object.entries(config.hybridV2.tunedOnSha256)) if (!grown[file]) expect(value, file).toBe(sha(`eval/project-suggest/${file}`))
    for (const file of ['testset.json', 'testset-ai-v2.json', 'testset-workflow.json', 'testset-dialect.json']) expect(Object.values(config.hybridV2.tunedOnSha256)).not.toContain(sha(`eval/project-suggest/${file}`))
    expect(thresholdFor('Protected the accounts.')).toBe(HYBRID_THRESHOLDS.en)
    expect(thresholdFor('حميت الحسابات من المهاجمين.')).toBe(HYBRID_THRESHOLDS.msa)
  })

  it('fallback v2 reads the sentence through the dialect layer, skips a wish, and quotes the original sentence', async () => {
    const seen = []
    const embed = async text => { seen.push(text); return /نظام|قاعدة بيانات/.test(text) ? [1, 0] : [0, 1] }
    const fallback = createFallback(embed, { version: 'v2' })
    const result = await fallback.suggest('ودي أتعلم الذكاء الاصطناعي. سويت سستم بداتابيس!')
    expect(seen).toContain(normaliseForEmbedding('عملت نظام قاعدة بيانات!'))
    expect(seen.some(t => t.includes('الذكاء الاصطناعي') && t.includes('أريد'))).toBe(false) // the wish is not embedded
    expect(result.version).toBe(HYBRID_FALLBACK_V2)
    for (const s of result.suggestions) expect(s.snippet).toBe('سويت سستم بداتابيس!')
  })
})

// Task 80b · team decision 2026-11-22: "Look deeper" is not the default. Its dialect gain on testset-dialect.json
// (combination 88.5 → 89.2 F1) is within noise, three of its four per-variety thresholds sit at the 0.53 floor, and it
// suggests skills from ordinary sentences. It is back behind ?suggest=hybrid exactly as after Task 43; engine v3 stays
// the default engine. Nothing was retuned; the frozen sets and the floors are unchanged.
describe('Task 80b · "Look deeper" is opt-in again; engine v3 stays the default', () => {
  const config = JSON.parse(readFileSync('eval/project-suggest/config.json', 'utf8'))
  const devFile = 'eval/project-suggest/dev-set-dialect.json'
  const dev = JSON.parse(readFileSync(devFile, 'utf8'))
  const sha = data => createHash('sha256').update(data).digest('hex')
  const ABSTAINS = { abstained: true, suggestions: [] }

  it('the default method is the improved engine v3; with no switch "Look deeper" is never offered, even after an abstention', async () => {
    expect(PROJECT_SUGGEST_METHOD).toBe('improved')
    expect(DIALECT_DEFAULT).toBe(true)
    expect(PROJECT_SUGGEST_IMPROVED_VERSION).toBe(IMPROVED_V3_VERSION)
    expect((await suggestForProject('سويت أبلكيشن للحجوزات وربطته بداتابيس')).version).toBe(IMPROVED_V3_VERSION)
    const method = activeSuggestMethod('')
    expect(method).toBe('improved')
    expect(offersLookDeeper(method, ABSTAINS)).toBe(false)
    expect(offersLookDeeper(method, suggestCapabilities('رتبت رحلة قصيرة مع زملائي في نهاية الفصل.'))).toBe(false)
  })

  it('?suggest=hybrid is the only switch: it alone offers "Look deeper" after an abstention; Task 80\'s ?suggest=improved is just the default', () => {
    expect(offersLookDeeper(activeSuggestMethod('?start=sample&suggest=hybrid'), ABSTAINS)).toBe(true)
    for (const search of ['?suggest=improved', '?suggest=Hybrid', '?suggest=hybrid-v2', '?suggest=', '?lookDeeper=1']) {
      expect(activeSuggestMethod(search), search).toBe('improved')
      expect(offersLookDeeper(activeSuggestMethod(search), ABSTAINS), search).toBe(false)
    }
  })

  it('the opt-in fallback is still v2 with the thresholds tuned in Task 80 (not retuned)', () => {
    expect(FALLBACK_DEFAULT).toBe('v2')
    expect(HYBRID_THRESHOLDS).toEqual({ dialect: 0.53, msa: 0.58, en: 0.53, mixed: 0.53 })
    expect(config.hybridV2.thresholds).toEqual({ ...HYBRID_THRESHOLDS })
    expect(config.hybridV2.tunedAt).toBe('2026-11-22')
  })

  it('"What runs where" names "Look deeper" as an opt-in reviewers\' trial, off by default, in both languages', async () => {
    const { RUNTIME_MANIFEST } = await import('../src/content/runtimeManifest.js')
    const row = RUNTIME_MANIFEST.find(item => item.id === 'embeddings')
    const text = JSON.stringify(row)
    expect(text).toContain('Look deeper')
    expect(text).toContain('off by default')
    expect(text).toContain('انظر أعمق')
    expect(text).toContain('غير مفعّلة افتراضيًا')
    expect(text).not.toMatch(/by default[^"]*Look deeper|default method/)
  })

  it('the dialect dev set gained 15+ hard negatives (dialect, MSA, English) that must give nothing; the 44 tuned cases are unchanged', () => {
    const added = dev.cases.filter(c => c.addedIn === 'Task 80b')
    expect(added.length).toBeGreaterThanOrEqual(15)
    for (const c of added) {
      expect(c, c.id).toMatchObject({ category: 'should-abstain', expected: [] })
      expect(c.id, c.id).toMatch(/^dev-dl-hn-\d\d$/)
    }
    for (const v of ['dialect', 'msa', 'en']) expect(added.filter(c => c.variety === v).length, v).toBeGreaterThanOrEqual(5)
    expect(dev.additions).toMatch(/^Task 80b/)
    expect(dev.additions).toMatch(/nothing was retuned/)
    // The thresholds were tuned on the 44-case file, recorded by its sha256; those 44 cases are still there, unchanged.
    const grown = config.hybridV2.devSetsGrownAfterTuning['dev-set-dialect.json']
    expect(grown).toMatchObject({ addedCases: added.length, addedIn: 'Task 80b' })
    expect(config.hybridV2.tunedOnSha256['dev-set-dialect.json']).toBe('d533ec1bf17074ee5adcead59fd3f27dde0de35d04df926c518029dab37384f6')
    const tuned = dev.cases.filter(c => !c.addedIn)
    expect(tuned).toHaveLength(44)
    expect(sha(JSON.stringify(tuned))).toBe(grown.tunedCasesSha256)
    // The improved engine v3 (the default) suggests nothing for any of them.
    for (const c of added) expect(ids(c.text), `${c.id} ${c.text}`).toEqual([])
  })

  it('the frozen sets and the floors are untouched by Task 80b', () => {
    const locks = { 'testset-dialect.json': '67010db0ecb5794fceab0313621bc61d831076ac7ee6b2e26bd50fbe9c2681bc' }
    for (const [file, value] of Object.entries(locks)) expect(sha(readFileSync(`eval/project-suggest/${file}`)), file).toBe(value)
    const floors = JSON.parse(readFileSync('eval/project-suggest/score-floors.json', 'utf8'))
    expect(floors.sets['testset-dialect.json'].methods.improved.byVariety.dialect).toMatchObject({ tp: 27, fp: 1, fn: 6, f1: 88.5 })
  })
})

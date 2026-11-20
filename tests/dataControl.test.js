import { describe, it, expect } from 'vitest'
import { deleteItem, withdrawConsent, deleteEverythingPreview, orphanCheck, regrantNotice } from '../src/utils/dataControl.js'
import { profileSkills } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { emptyInsightState } from '../src/insight.js'
import { readFileSync, readdirSync } from 'node:fs'
import { blankState as appBlankState } from '../src/state/profileState.js' // Task 59: the app's own blank state
import { copy } from '../src/i18n.js'
import { MAX_OPEN, PRIVACY_SECTIONS, initialOpen, permissionsOn, sectionFromHash, storedCounts, toggleOpen } from '../src/utils/privacySections.js'

// Task 06 · deletion and consent withdrawal that say exactly what was removed.
const row = (code, grade) => ({ code, name: code, grade, source: 'pdf' })
const insight = () => ({ ...emptyInsightState(), declaredPreferences: { careerInterest: 'data' }, digitalInterests: { noticeVersion: 'digital-interests-consent-2026-09-27', analysisConsent: true, contextConsent: true, grantedAt: '2026-11-01T00:00:00.000Z', confirmed: [{ topicId: 'data', matchedTerms: ['sql'], confirmedAt: '2026-11-01T00:00:00.000Z', methodVersion: 'kamin-topic-keywords-v1', sourceType: 'student-selected-text', reviewStatus: 'student-confirmed' }] } })
const base = () => ({
  approved: true, college: 'FCIT', goal: 'data', consents: { analyze: true, insight: true, advisor: false, research: false },
  courses: [row('CPIT-240', 'B'), row('CPCS-241', 'A'), row('STAT-110', 'A'), row('CPIT-250', 'A')],
  credentials: [{ id: 'cred-1', credentialId: 'cred-1', outcome: 'unverified', issuerTrusted: false, achievements: [{ id: 'urn:kamin:skill:database', name: 'SQL badge' }] }],
  projects: [{ id: 'p1', title: 'SQL dashboard', kind: 'repository', skillIds: ['database'], reviewStatus: 'unreviewed' }],
  tasks: [{ taskId: 'task-sql-analysis', status: 'in-progress' }],
  recommendationReviews: [{ id: 'review-1', kind: 'pathway', targetId: 'job-data-analyst', action: 'accepted', title: { ar: 'محلل بيانات', en: 'Data analyst' } }],
  needsReview: [{ kind: 'project', id: 'p1', title: { ar: 'SQL dashboard', en: 'SQL dashboard' }, skillIds: ['software'], status: 'needs-review', flaggedAt: '2026-11-01T00:00:00.000Z' }],
  insight: insight(), audit: [],
})
const ids = state => profileSkills(state).map(s => s.id).sort()
const text = summary => [...summary.sentences.ar, ...summary.sentences.en].join(' ')

describe('withdrawConsent', () => {
  it("'analyze' leaves no courses, no academic claims and no reviews built on them, and names what was removed", () => {
    const { state, summary } = withdrawConsent(base(), 'analyze', { lang: 'en' })
    expect(state.courses).toEqual([])
    expect(state.approved).toBe(false)
    expect(state.consents.analyze).toBe(false)
    expect(state.recommendationReviews).toEqual([])
    expect(state.projects).toEqual([])
    expect(state.tasks).toEqual([])
    expect(state.credentials).toEqual([])
    expect(state.needsReview).toEqual([])
    const graph = projectStateToPerson360({ state, skills: profileSkills(state) })
    expect(graph.claims.filter(c => ['kamin:studied', 'kamin:demonstrates', 'kamin:verifiedBy'].includes(c.predicate))).toEqual([])
    expect(summary.droppedCapabilities.map(l => l.en).sort()).toEqual(['Databases', 'Quantitative analysis', 'Requirements analysis'])
    expect(summary.sentences.en.join(' ')).toContain('Deleted courses: CPIT-240, CPCS-241, STAT-110, CPIT-250.')
    expect(summary.sentences.en.join(' ')).toContain('“SQL dashboard”')
    expect(summary.sentences.en.join(' ')).toContain('Removed “Databases” — because you withdrew consent to analyze your record.')
    expect(summary.sentences.en.join(' ')).toMatch(/fit judgments were recomputed; changed:/)
    expect(summary.sentences.en.join(' ')).toContain('Kept as they were: your interests, preferences, goal')
    expect(summary.sentences.ar.join(' ')).toContain('أزيل 4 مقررًا و3 قدرة')
    expect(summary.sentences.ar.join(' ')).toContain('فلن تعود البيانات المحذوفة')
    // interests and goal stayed
    expect(state.goal).toBe('data')
    expect(state.insight.declaredPreferences).toEqual({ careerInterest: 'data' })
  })

  it("'insight' removes preferences, goal and interests but keeps academic evidence", () => {
    const before = base()
    const { state, summary } = withdrawConsent(before, 'insight', { lang: 'ar' })
    expect(state.goal).toBe(null)
    expect(state.insight.declaredPreferences).toEqual({})
    expect(state.insight.digitalInterests.confirmed).toEqual([])
    expect(state.consents.insight).toBe(false)
    expect(state.courses).toHaveLength(4)
    expect(ids(state)).toEqual(ids(before))
    expect(summary.droppedCapabilities).toEqual([])
    expect(text(summary)).toContain('الأدلة الأكاديمية بقيت كما هي')
    expect(text(summary)).toContain('Deleted digital interests: “Data analysis”')
  })

  it('advisor/research only switch off and change no data', () => {
    const { state, summary } = withdrawConsent({ ...base(), consents: { ...base().consents, advisor: true } }, 'advisor')
    expect(state.consents.advisor).toBe(false)
    expect(state.courses).toHaveLength(4)
    expect(text(summary)).toContain('No real sharing happens')
    expect(() => withdrawConsent(base(), 'nonsense')).toThrow('UNKNOWN_PURPOSE')
  })
})

describe('deleteItem', () => {
  it('deleting a project does not touch courses or capabilities and clears its needs-review flag', () => {
    const before = base()
    const { state, summary } = deleteItem(before, { kind: 'project', id: 'p1' })
    expect(state.projects).toEqual([])
    expect(state.courses).toEqual(before.courses)
    expect(ids(state)).toEqual(ids(before))
    expect(state.needsReview.some(i => i.kind === 'project' && i.id === 'p1')).toBe(false)
    expect(summary.droppedCapabilities).toEqual([])
    expect(text(summary)).toContain('Deleted the self-declared project “SQL dashboard” from this device.')
  })

  it('deleting a course drops only capabilities for which it was the only evidence', () => {
    // database has CPIT-240 and CPCS-241; statistics has only STAT-110
    const one = deleteItem(base(), { kind: 'course', id: 'cpit240' })
    expect(one.state.courses.map(c => c.code)).toEqual(['CPCS-241', 'STAT-110', 'CPIT-250'])
    expect(ids(one.state)).toContain('database')
    expect(one.summary.droppedCapabilities).toEqual([])
    expect(text(one.summary)).toContain('CPIT-240 no longer counts as evidence for “Databases”')
    const two = deleteItem(base(), { kind: 'course', id: 'STAT-110' })
    expect(ids(two.state)).not.toContain('statistics')
    expect(two.summary.droppedCapabilities.map(l => l.en)).toEqual(['Quantitative analysis'])
    expect(text(two.summary)).toContain('Removed “Quantitative analysis” — because the course was removed from your record.')
    expect(two.state.courses).toHaveLength(3)
  })

  it('a course deletion that removes a capability flags derived items instead of deleting them', () => {
    const before = { ...base(), courses: [row('CPIT-240', 'B'), row('STAT-110', 'A')] }
    const { state } = deleteItem(before, { kind: 'course', id: 'CPIT-240' })
    expect(state.recommendationReviews).toHaveLength(1)
    expect(state.tasks).toHaveLength(1)
    expect(state.needsReview.map(i => `${i.kind}:${i.id}`).sort()).toEqual(['project:p1', 'recommendation-review:review-1', 'task:task-sql-analysis'])
  })

  it('deletes a credential and a confirmed interest', () => {
    const cred = deleteItem(base(), { kind: 'credential', id: 'cred-1' })
    expect(cred.state.credentials).toEqual([])
    expect(text(cred.summary)).toContain('“SQL badge”')
    const interest = deleteItem(base(), { kind: 'interest', id: 'data' }, { lang: 'en' })
    expect(interest.state.insight.digitalInterests.confirmed).toEqual([])
    expect(interest.state.insight.declaredPreferences).toEqual({ careerInterest: 'data' })
    expect(text(interest.summary)).toContain('Deleted the confirmed digital interest “Data analysis”')
    expect(() => deleteItem(base(), { kind: 'course', id: 'CPIT-999' })).toThrow('ITEM_NOT_FOUND')
  })

  it('no claim points to a deleted item after any operation', () => {
    const ops = [
      s => deleteItem(s, { kind: 'course', id: 'CPIT-240' }).state,
      s => deleteItem(s, { kind: 'course', id: 'STAT-110' }).state,
      s => deleteItem(s, { kind: 'project', id: 'p1' }).state,
      s => deleteItem(s, { kind: 'credential', id: 'cred-1' }).state,
      s => withdrawConsent(s, 'analyze').state,
      s => withdrawConsent(s, 'insight').state,
    ]
    for (const op of ops) {
      const state = op(base())
      expect(orphanCheck(state)).toEqual({ removed: [], dangling: [] })
    }
  })
})

describe('audit and copy', () => {
  it('each operation adds one audit line with only the type and counts, never the deleted content', () => {
    const results = [
      deleteItem(base(), { kind: 'course', id: 'STAT-110' }, { lang: 'en' }),
      deleteItem(base(), { kind: 'project', id: 'p1' }, { lang: 'en' }),
      withdrawConsent(base(), 'analyze', { lang: 'en' }),
      withdrawConsent(base(), 'insight', { lang: 'ar' }),
    ]
    for (const { state } of results) {
      expect(state.audit).toHaveLength(1)
      expect(state.audit[0].label).not.toMatch(/STAT-110|CPIT|SQL dashboard|SQL badge|Data analysis|محلل بيانات/)
    }
    expect(results[0].state.audit[0].label).toBe('Item deleted: course (1)')
    expect(results[2].state.audit[0].label).toBe('Transcript-analysis consent withdrawn: 4 course(s), 1 project(s), 1 task(s), 1 credential(s), 1 review(s) deleted')
  })

  it('messages carry no technical IDs or percentages', () => {
    for (const { summary } of [deleteItem(base(), { kind: 'course', id: 'STAT-110' }), withdrawConsent(base(), 'analyze'), withdrawConsent(base(), 'insight')]) {
      expect(text(summary)).not.toMatch(/urn:kamin|%/)
    }
    expect(regrantNotice('insight', 'en')).toContain('the deleted data does not come back')
  })

  it('the delete-everything preview lists counts and warns about copies outside KAMIN', () => {
    const preview = deleteEverythingPreview(base(), 'en')
    expect(preview.items.find(i => i.label === 'courses').count).toBe(4)
    expect(preview.items.find(i => i.label === 'self-declared projects').count).toBe(1)
    expect(preview.outside).toContain('encrypted backups you downloaded earlier')
    expect(preview.outside).toContain('share links')
  })
})

// Task 27 · "Consent, saving & deletion" moved its blocks into sections; no consent or deletion
// wording may change. PRIVACY_SENTENCES is every string a student reads in src/components/Privacy.jsx
// as it was before Task 27 (main at cf13604), found with the scanner below. Each one must still be in
// the privacy sources, character for character. Four heading strings were removed on purpose and are
// not listed: the small label "Data ownership" and the heading "Each purpose has its own permission"
// (it repeated the page intro and the new "Permissions" section heading), in both languages.
const PRIVACY_SENTENCES = [
  'تغيير موافقة: ${t.consentItems[key]}',
  'Consent changed: ${t.consentItems[key]}',
  'استخدم عبارة مرور من 12 حرفًا على الأقل.',
  'Use a passphrase of at least 12 characters.',
  'تعذر فتح النسخة: عبارة المرور خاطئة أو الملف عُدّل/تلف.',
  'Could not open the backup: wrong passphrase or the file was modified/corrupted.',
  'صيغة النسخة غير مدعومة.',
  'Unsupported backup format.',
  'إصدار ملف كامن غير مدعوم.',
  'Unsupported Kamin profile version.',
  'ملف النسخة أكبر من الحد المسموح.',
  'The backup file is larger than allowed.',
  'الملف ليس نسخة كامن مشفّرة صالحة.',
  'This is not a valid encrypted Kamin backup.',
  'تعذر إكمال العملية.',
  'The operation could not be completed.',
  'عبارتا المرور غير متطابقتين.',
  'Passphrases do not match.',
  'تم إنشاء نسخة مشفّرة محلية. احفظها مع عبارة المرور في مكان آمن.',
  'Encrypted local backup created. Keep it and the passphrase in a safe place.',
  'تمت استعادة الملف وإعادة حساب النتائج من الأدلة المحفوظة.',
  'Profile restored and derived results were recomputed from the saved evidence.',
  'ما المخزن عنك الآن؟',
  'What is stored about you now?',
  'محفوظ على هذا الجهاز',
  'Saved on this device',
  'جلسة مؤقتة',
  'Session only',
  'سجلات مقررات',
  'أدلة تطبيقية مصرّح بها',
  'سجلات تقدم في المهام',
  'نتائج تحقق من اعتمادات',
  'اهتمامات رقمية مؤكدة',
  'تفضيلات مصرح بها',
  'هدف/مسار مختار',
  'ملفات الوظائف والتدريب المرجعية ليست نسخة شخصية مخفية؛ المطابقات يعاد حسابها من أدلتك وتفضيلاتك. موافقتا المرشد والبحث أدناه عرض تجريبي فقط حتى اعتماد البنية الخلفية.',
  'Reference job/training profiles are not a hidden personal copy; matches are recomputed from your evidence and preferences. Advisor/research sharing controls below are demonstration-only until backend infrastructure is approved.',
  'إيقاف الحفظ الدائم على هذا الجهاز',
  'Stop persistent saving on this device',
  'الاحتفاظ بملفي على هذا الجهاز',
  'Keep my profile on this device',
  'ضروري فقط بعد اعتماد السجل',
  'Required only after transcript approval',
  'اختياري؛ يبقى محليًا ويتبع اختيارك للحفظ على هذا الجهاز ويمكن سحبه مستقلاً',
  'Optional; stays local, follows your device-persistence choice, and can be withdrawn independently',
  'عرض تجريبي فقط — لا توجد مشاركة فعلية مفعّلة في النسخة العامة',
  'Demonstration only — no operational sharing is enabled in the public release',
  'مصدر النشاط الرقمي',
  'Digital activity source',
  'الغرض: اقتراح اهتمامات تراجعها. لا تُحفظ النصوص الأصلية أو الحسابات. استخدام الاهتمامات لشرح المسارات يحتاج إذنًا مستقلًا داخل شاشة ملفك.',
  'Purpose: suggest interests for your review. Original text and accounts are not saved. Using interests for pathway explanations needs separate permission in your profile.',
  'التحليل: ${digital.analysisConsent?\'مفعّل\':\'غير مفعّل\'} · شرح المسارات: ${digital.contextConsent?\'مفعّل\':\'غير مفعّل\'}',
  'Analysis: ${digital.analysisConsent?\'enabled\':\'off\'} · Pathway explanations: ${digital.contextConsent?\'enabled\':\'off\'}',
  'اسحب الموافقة واحذف الاهتمامات الرقمية',
  'Withdraw consent and delete digital interests',
  'جمع الصحة والمخالفات والتفاصيل المالية وتحليل الشخصية من الحسابات غير مفعّل. الحذف من المتصفح لا يمحو نسخًا احتياطية سبق تنزيلها.',
  'Health, violations, financial details and personality inference from accounts are not enabled. Browser deletion cannot erase backups you previously downloaded.',
  'مراجعات التوصيات تحت سيطرتك',
  'You control recommendation reviews',
  'لديك ${state.recommendationReviews.length} حدث مراجعة محلي. يتضمن الاسم أو الاسم المستعار والسبب والملاحظة والوقت إن اخترت قياسه. يتبع الحفظ اختيار الجلسة أو هذا الجهاز، وتشمله النسخة المشفرة. لا يُرسل ولا يدخل الرسم المعرفي أو رابط مشاركة القدرات.',
  'You have ${state.recommendationReviews.length} local review events. They include a name or alias, reason, note and optional timing. They follow your session/device storage choice and are included in encrypted backups. They are not sent or added to the knowledge graph or capability-sharing links.',
  'سحب موافقة تحليل السجل أو ملف الاهتمامات يحذف المراجعات أيضًا. النسخ التي سبق تنزيلها تبقى عند من يملكها.',
  'Withdrawing transcript-analysis or insight consent also deletes reviews. Previously downloaded copies remain with their holders.',
  'هل تحذف سجل المراجعات المحلي؟ لن تتغير مقرراتك أو قدراتك.',
  'Delete the local review history? Your courses and capabilities will stay as they are.',
  'نعم، احذف المراجعات',
  'Yes, delete reviews',
  'احذف مراجعات التوصيات',
  'Delete recommendation reviews',
  'استمرارية بلا حساب مركزي',
  'Continuity without a central account',
  'نسخة محلية مشفّرة',
  'Encrypted local backup',
  'عبارة المرور',
  '12 حرفًا على الأقل',
  'At least 12 characters',
  'تأكيد العبارة — مطلوب للتصدير فقط',
  'Confirm — export only',
  'أعد كتابة العبارة',
  'Repeat passphrase',
  'تنزيل نسخة مشفّرة',
  'Download encrypted backup',
  'جارٍ تحميل أداة التحقق…',
  'Loading the verifier…',
  'استعادة نسخة محفوظة',
  'Restore a saved backup',
  'عبارة مرور النسخة المستعادة',
  'Passphrase of the backup to restore',
  'العبارة التي استخدمتها عند إنشاء النسخة',
  'The passphrase you used when creating it',
  'اختر ملف النسخة واستعدها',
  'Choose the backup file and restore',
  'ملف النسخة المشفّرة',
  'Encrypted backup file',
  'عند الاستعادة يعيد كامن حساب المهارات والملاءمة من الأدلة؛ ولا يعيد تفعيل موافقات المشاركة مع المرشد/البحث تلقائيًا.',
  'On restore, Kamin recomputes skills and fit from evidence; advisor/research sharing consents are not automatically re-enabled.',
  'جارٍ تحميل خيارات المشاركة…',
  'Loading sharing options…',
  'ملفك تحت سيطرتك',
  'Your profile stays under your control',
  'ما الذي يعمل وأين؟ كل ميزة ومكان بياناتها',
  'What runs where? Every feature and where its data is kept',
  'نعم، احذف كل شيء من هذا الجهاز',
  'Yes, delete everything from this device',
  'سيُحذف من هذا الجهاز:',
  'This will be deleted from this device:',
  'لا توجد بيانات محفوظة سوى إعدادات هذه الجلسة.',
  'Nothing saved except this session’s settings.',
  'من: ',
  'From: ',
  '، ',
]
// The consent, deletion, backup and sharing strings in src/i18n.js that the privacy page uses, as they were.
const PRIVACY_I18N = {
  "ar": {
    "consent": "الموافقات",
    "consentItems": {
      "analyze": "تحليل السجل وبناء ملف المهارات",
      "insight": "بناء بصمة الطالب الذاتية",
      "advisor": "مشاركة ملخص الملف مع المرشد",
      "research": "استخدام بيانات مجهولة الهوية لأغراض التحقق البحثي"
    },
    "privacyNote": "لا يوجد تخزين مركزي لملفك. يبقى للجلسة فقط، أو على هذا الجهاز إن وافقت، مع نسخة مشفّرة اختيارية. لكل طبقة موافقتها؛ مشاركة المرشد والبحث عرض تجريبي فقط.",
    "delete": "حذف بياناتي",
    "deleteConfirm": "سيتم حذف السجل وملف القدرات والمهارات والأحكام وسجل الاستخدام من هذه الجلسة. النسخ المشفّرة التي نزّلتها تبقى لديك. هل تريد المتابعة؟",
    "cancel": "إلغاء",
    "backup": "تُشفَّر النسخة على جهازك بعبارة مرور لا تُرسل ولا تُحفظ؛ لا يستطيع كامن استعادتها إن نسيتها.",
    "share": "الرابط مشفّر على جهازك؛ كل من يحصل عليه يستطيع فتحه وإعادة إرساله، ولا يمكن سحبه بعد الإرسال.",
    "exportFile": "نزّل ملفًا بقدراتك (غير موقّع)",
    "privacyTitle": "أنت صاحب القرار على بياناتك",
    "privacyIntro": "لكل غرض موافقته، والسحب واضح مثل المنح.",
    "technical": {
      "backup": "تحتوي النسخة حالة الاستعادة وملف القدرات بصيغة JSON-LD، وتُشفَّر بـ AES-GCM بمفتاح مشتق من عبارة المرور (PBKDF2).",
      "share": "التشفير AES-GCM. جزء الرابط بعد # يحمل اللقطة ومفتاحها ولا يُرسل ضمن طلب الصفحة، لكن تطبيق المراسلة أو سجل المتصفح أو الإضافات قد يرى الرابط كاملًا.",
      "storage": "الحفظ على هذا الجهاز يستخدم قاعدة IndexedDB في المتصفح؛ الجلسة تستخدم sessionStorage."
    }
  },
  "en": {
    "consent": "Consents",
    "consentItems": {
      "analyze": "Analyze transcript and build skills profile",
      "insight": "Build my self-reported Student Insight profile",
      "advisor": "Share profile summary with an advisor",
      "research": "Use anonymized data for research validation"
    },
    "privacyNote": "No profile is stored centrally. It stays for this session only or, with your consent, on this device, with an optional encrypted backup. Each layer has its own consent; advisor and research sharing are demonstrations only.",
    "delete": "Delete my data",
    "deleteConfirm": "This will delete the transcript, capability profile, skills, judgments, and usage log from this session. Encrypted backups you downloaded remain yours. Continue?",
    "cancel": "Cancel",
    "backup": "The backup is encrypted on your device with a passphrase that is never sent or stored; KAMIN cannot recover it if you forget it.",
    "share": "The link is encrypted on your device; anyone who gets it can open and forward it, and it cannot be withdrawn after sending.",
    "exportFile": "Download a file with your capabilities (unsigned)",
    "privacyTitle": "You control your data",
    "privacyIntro": "Each purpose has its own consent, and withdrawing is as clear as granting.",
    "technical": {
      "backup": "The backup holds the restore state and the capability file as JSON-LD, encrypted with AES-GCM using a key derived from the passphrase (PBKDF2).",
      "share": "AES-GCM encryption. The part of the link after # carries the snapshot and its key and is not sent in the page request, but messaging apps, browser history or extensions may see the full link.",
      "storage": "Saving on this device uses the browser’s IndexedDB; the session uses sessionStorage."
    }
  }
}

// String literals in JS/JSX source ('…', "…" and `…` with ${…} kept as written); comments are skipped.
function stringLiterals(src) {
  const out = []
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue }
    if (c !== "'" && c !== '"' && c !== '`') continue
    let j = i + 1, depth = 0
    for (; j < src.length; j++) {
      if (src[j] === '\\') { j++; continue }
      if (c === '`' && src[j] === '$' && src[j + 1] === '{') { depth++; j++; continue }
      if (c === '`' && depth && src[j] === '}') { depth--; continue }
      if (!depth && src[j] === c) break
    }
    out.push(src.slice(i + 1, j))
    i = j
  }
  return out
}
const privacySources = () => ['src/components/Privacy.jsx', ...readdirSync('src/components/privacy').map(f => `src/components/privacy/${f}`)].map(f => readFileSync(f, 'utf8')).join('\n')
const i18nPick = c => Object.fromEntries(['ar', 'en'].map(l => [l, {
  consent: c[l].app.consent, consentItems: c[l].app.consentItems, privacyNote: c[l].app.privacyNote, delete: c[l].app.delete, deleteConfirm: c[l].app.deleteConfirm, cancel: c[l].app.cancel,
  backup: c[l].screens.myData.backup, share: c[l].screens.myData.share, exportFile: c[l].screens.myData.exportFile, privacyTitle: c[l].screens.myData.privacyTitle, privacyIntro: c[l].screens.myData.privacyIntro,
  technical: { backup: c[l].screens.myData.technical.backup, share: c[l].screens.myData.technical.share, storage: c[l].screens.myData.technical.storage },
}]))

describe('Task 27: the privacy page keeps every consent and deletion sentence', () => {
  it('every sentence of the old page is still in the privacy sources, unchanged', () => {
    const now = new Set(stringLiterals(privacySources()))
    expect(PRIVACY_SENTENCES.length).toBe(111)
    expect(PRIVACY_SENTENCES.filter(s => !now.has(s))).toEqual([])
  })
  it('the consent, deletion, backup and sharing strings in i18n.js are unchanged', () => {
    expect(i18nPick(copy)).toEqual(PRIVACY_I18N)
  })
  it('the scanner finds strings next to comments and inside templates', () => {
    const src = ["a='x' // it's", 'b="y" /* don\'t */ c=`z ${d?\'e\':\'f\'} g`'].join('\n')
    expect(stringLiterals(src)).toEqual(['x', 'y', "z ${d?'e':'f'} g"])
  })
})

describe('Task 27: sections of "Consent, saving & deletion"', () => {
  it('five sections in page order; a fragment names one, anything else (a snapshot link) names none', () => {
    expect(PRIVACY_SECTIONS).toEqual(['permissions', 'save', 'backup', 'share', 'delete'])
    expect(sectionFromHash('#backup')).toBe('backup')
    expect(sectionFromHash('delete')).toBe('delete')
    for (const hash of ['', '#', '#payload=abc&key=def', '#Backup', '#privacy-backup', undefined]) expect(sectionFromHash(hash)).toBeNull()
  })
  it('Permissions opens by default; with no approved record Back up and restore too; a link opens only its section', () => {
    expect(initialOpen({ approved: true })).toEqual(['permissions'])
    expect(initialOpen({ approved: false })).toEqual(['permissions', 'backup'])
    expect(initialOpen({ target: 'delete', approved: true })).toEqual(['delete'])
    expect(initialOpen({ target: 'nonsense', approved: true })).toEqual(['permissions'])
  })
  it('at most two open: opening a third closes the one opened longest ago', () => {
    let open = ['permissions']
    open = toggleOpen(open, 'backup', true); expect(open).toEqual(['permissions', 'backup'])
    open = toggleOpen(open, 'share', true); expect(open).toEqual(['backup', 'share'])
    expect(toggleOpen(open, 'share', true)).toBe(open)
    expect(toggleOpen(open, 'delete', false)).toBe(open)
    expect(toggleOpen(open, 'backup', false)).toEqual(['share'])
    expect(toggleOpen(open, 'unknown', true)).toBe(open)
    expect(MAX_OPEN).toBe(2)
  })
  it('the status card counts permissions and lists only what is stored', () => {
    expect(permissionsOn({ analyze: true, insight: false, advisor: false, research: false })).toEqual({ on: 1, total: 4 })
    expect(permissionsOn({ analyze: true, insight: true, advisor: false, research: false })).toEqual({ on: 2, total: 4 })
    expect(permissionsOn(withdrawConsent(base(), 'insight', { lang: 'en' }).state.consents)).toEqual({ on: 1, total: 4 })
    expect(storedCounts({ courses: 7 })).toEqual({ listed: [{ key: 'courses', count: 7 }], rest: true })
    expect(storedCounts({})).toEqual({ listed: [], rest: true })
    // Task 58 added two kinds (saved steps, "not for me" marks): every kind must hold something for "nothing else" to go.
    expect(storedCounts({ courses: 1, projects: 1, tasks: 1, credentials: 1, digital: 1, preferences: 1, goal: 1, plan: 1, notForMe: 1 }).rest).toBe(false)
    expect(storedCounts({ courses: 1, projects: 1, tasks: 1, credentials: 1, digital: 1, preferences: 1, goal: 1 }).rest).toBe(true)
  })
})

// Task 55 · the college and major printed on the transcript are removed with it.
describe('Task 55 · collegeRaw and major go with the transcript', () => {
  const printed = () => ({ ...base(), collegeRaw: 'COMPUTING & INFO. TECH.', major: 'INFORMATION TECHNOLOGY' })
  it("withdrawing 'analyze' (removing the transcript) removes collegeRaw and major", () => {
    const { state } = withdrawConsent(printed(), 'analyze', { lang: 'en' })
    expect(state.collegeRaw).toBeNull()
    expect(state.major).toBeNull()
    expect(state.courses).toEqual([])
  })
  it('other withdrawals keep them (the transcript stays)', () => {
    for (const purpose of ['insight', 'digital', 'advisor']) {
      const { state } = withdrawConsent(printed(), purpose, { lang: 'en' })
      expect(state.collegeRaw, purpose).toBe('COMPUTING & INFO. TECH.')
      expect(state.major, purpose).toBe('INFORMATION TECHNOLOGY')
    }
  })
  it('delete everything: the app resets to its blankState, which has no collegeRaw and no major', () => {
    // Task 59: blankState and deleteAll moved from src/App.jsx to src/state/profileState.js and src/state/useKaminProfile.js.
    const hook = readFileSync('src/state/useKaminProfile.js', 'utf8').replace(/\r\n/g, '\n')
    expect(appBlankState).toMatchObject({ collegeRaw: null, major: null, college: null, courses: [] })
    expect(hook).toMatch(/setState\(normalizeState\(blankState\)\)[^\n]*setDraftStudent\(\{collegeRaw:null,major:null\}\)/)
  })
})

// Task 58 · goals, the saved steps of My plan and the "not for me" marks: stored and deleted like the
// student's other choices; covered by the interests consent; never evidence.
describe('Task 58 · goals, My plan and "not for me"', () => {
  const step = (itemId, action = 'take-course') => ({ itemId, action, addedAt: '2026-11-18T09:00:00.000Z', status: 'planned' })
  const planned = () => ({ ...base(), goal: 'data', goals: ['data', 'job-cyber-analyst'], plan: [step('fcit-cpit-340'), step('capm', 'get-certificate')], notForMe: ['pmp'] })

  it('withdrawing the interests consent empties plan, notForMe and goals; courses and capabilities unchanged', () => {
    const before = planned()
    const { state, summary } = withdrawConsent(before, 'insight', { lang: 'en' })
    expect(state).toMatchObject({ goal: null, goals: [], plan: [], notForMe: [], planDropped: 0 })
    expect(state.courses).toEqual(before.courses)
    expect(ids(state)).toEqual(ids(before))
    expect(summary.droppedCapabilities).toEqual([])
    expect(summary.sentences.en.join(' ')).toContain('2 selected goals were removed.')
    expect(summary.sentences.en.join(' ')).toContain('2 saved step(s) in My plan were deleted.')
    expect(summary.sentences.en.join(' ')).toContain('1 “not for me” mark(s) were removed.')
    expect(summary.sentences.ar.join(' ')).toContain('حُذفت 2 خطوة محفوظة من خطتي.')
    expect(state.audit[0].label).toBe('Capability Profile 360° consent withdrawn: 1 preference(s), 1 interest(s), 0 free-text interest(s), 2 goal(s), 2 saved step(s), 1 not-for-me mark(s), 1 review(s) deleted')
    expect(text(summary)).not.toMatch(/Database \(II\)|CAPM|urn:kamin|fcit-cpit-340/)
  })

  it('withdrawing transcript analysis keeps the goals, the plan and the marks (they never came from the record)', () => {
    const { state } = withdrawConsent(planned(), 'analyze', { lang: 'en' })
    expect(state.courses).toEqual([])
    expect(state.goals).toEqual(['data', 'job-cyber-analyst'])
    expect(state.plan.map(p => p.itemId)).toEqual(['fcit-cpit-340', 'capm'])
    expect(state.notForMe).toEqual(['pmp'])
  })

  it("deleteItem(kind: 'plan-item') removes one step, recomputes nothing and logs it without its title", () => {
    const before = planned()
    const { state, summary, diff } = deleteItem(before, { kind: 'plan-item', id: 'fcit-cpit-340' }, { lang: 'en' })
    expect(state.plan.map(p => p.itemId)).toEqual(['capm'])
    expect(state.goals).toEqual(before.goals)
    expect(state.notForMe).toEqual(['pmp'])
    expect(state.courses).toBe(before.courses)
    expect(ids(state)).toEqual(ids(before))
    expect(diff).toEqual({ added: [], removed: [], changed: [], droppedEvidence: [], staleDerived: [] })
    expect(summary.operation).toBe('delete-item')
    expect(summary.judgments).toEqual({ total: 0, changed: [] })
    expect(summary.sentences.en[0]).toBe('Deleted the saved step in My plan “Database (II)” from this device.')
    expect(summary.sentences.en.join(' ')).toContain('so nothing was recomputed')
    expect(summary.sentences.ar[0]).toContain('من هذا الجهاز')
    expect(state.audit[0].label).toBe('Next step removed')
    expect(deleteItem(before, { kind: 'plan-item', id: 'capm' }, { lang: 'ar' }).state.audit[0].label).toBe('أُزيلت خطوة تالية')
    for (const { label } of state.audit) expect(label).not.toMatch(/Database|CAPM|fcit-cpit/)
  })

  it('a step whose item left the list can still be deleted (the summary then names no title); an unknown step throws', () => {
    const s = { ...planned(), plan: [step('gone-item')] }
    const { state, summary } = deleteItem(s, { kind: 'plan-item', id: 'gone-item' }, { lang: 'en' })
    expect(state.plan).toEqual([])
    expect(summary.sentences.en[0]).toBe('Deleted a saved step in My plan from this device.')
    expect(() => deleteItem(planned(), { kind: 'plan-item', id: 'nope' })).toThrow('ITEM_NOT_FOUND')
  })

  it('the delete-everything preview and the status card count goals, saved steps and marks', () => {
    const preview = deleteEverythingPreview(planned(), 'en')
    const count = label => preview.items.find(i => i.label === label)?.count
    expect(count('selected goals')).toBe(2)
    expect(count('saved steps in My plan')).toBe(2)
    expect(count('items marked “not for me”')).toBe(1)
    expect(deleteEverythingPreview({ goal: 'data' }, 'en').items.find(i => i.label === 'selected goals').count).toBe(1) // a profile saved before Task 58
    expect(deleteEverythingPreview(planned(), 'ar').items.map(i => i.label)).toEqual(expect.arrayContaining(['أهداف مختارة', 'خطوات محفوظة في خطتي', 'عناصر عُلّمت «ليس لي»']))
    expect(storedCounts({ goal: 2, plan: 2, notForMe: 1 }).listed).toEqual([{ key: 'goal', count: 2 }, { key: 'plan', count: 2 }, { key: 'notForMe', count: 1 }])
    const card = readFileSync('src/components/privacy/StatusSummary.jsx', 'utf8')
    expect(card).toContain('goal: state.goals?.length || (state.goal ? 1 : 0), plan: state.plan?.length || 0, notForMe: state.notForMe?.length || 0')
    expect(card).toContain("plan: ['خطوات محفوظة في خطتي', 'saved steps in My plan']")
  })
})

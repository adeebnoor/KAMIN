// Task 45 · keep-tests: every feature that docs/FEATURE_INVENTORY.md keeps through the rebuild, reached the way
// a student reaches it today and checked with its safeguard, in Arabic and English, on the desktop and phone
// projects. They find nothing themselves: e2e/roles.js reaches each feature (only roles, labels, visible text
// and shared data-testid values) and counts the clicks from Home. A test fails if a feature is gone, its
// safeguard sentence changed by one character, or reaching it needs more clicks than it does today (the same
// rule as e2e/usability-budget.json: clicks may only go down; change a number only with the reason).
//
// Safeguard sentences come from the modules the app shows them from (src/i18n.js, src/content/*) or, where
// a component holds its own sentence, are written here word for word with the file they come from.
// The last tests check that this file and the inventory agree, and record the baseline numbers before the
// rebuild (docs/usability/before-rebuild.json).
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { copy, fill } from '../src/i18n.js'
import { COURSE_EVIDENCE_PRINCIPLE, TRUST_MICROCOPY } from '../src/content/trustCopy.js'
import { LEVEL_MEANINGS, limitLine, sharedLimitLine } from '../src/content/levelReasons.js'
import { levelLabel } from '../src/evidence/levels.js'
import { PILOT_CONSENT, PILOT_COPY } from '../src/content/pilotConsent.js'
import { opportunityStatus } from '../src/market/localOpportunities.js'
import { profileSkills } from '../src/utils/engine.js'
import { demoCourses, skills as catalog } from '../src/data.js'
import { clrExportFilename } from '../src/utils/clrExport.js'
import { buildCapabilitySnapshot, encryptSnapshot, snapshotFragment } from '../src/utils/capabilitySnapshot.js'
import { LANGS, kamin, uisFor } from './roles.js'
import { useOldInterface } from './fixtures.js'
import { documentLength, pageLength, visibleChoices, visibleDocumentChoices, writeResults } from './usability-lib.js'
import { settle } from './nav.js'

test.describe.configure({ mode: 'parallel' })

const tr = (lang, ar, en) => (lang === 'ar' ? ar : en)
const other = lang => (lang === 'ar' ? 'en' : 'ar')
// A percentage written with a digit, in either script (%, ٪).
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const expectNoPercent = async (scope, what) => expect(await scope.innerText(), `${what}: no percentage may be shown`).not.toMatch(PERCENT)
const text = (scope, words) => scope.getByText(words, { exact: true }).filter({ visible: true }).first()

// The approved synthetic example (?start=sample), computed with the app's own engine: what the levels and
// the "because" lines must say.
const SAMPLE = profileSkills({ approved: true, courses: demoCourses.map(row => ({ ...row })), college: 'FCIT', projects: [], tasks: [], credentials: [], insight: {}, consents: { analyze: true } })
const reasonsFor = lang => [sharedLimitLine(SAMPLE, lang)?.text, ...SAMPLE.map(skill => limitLine(skill, lang, { code: (skill.evidence.find(e => e.reasons === skill.reasons) || skill.evidence[0])?.code })?.text)].filter(Boolean)
// A made-up transcript (no person, no real record), as a plain text file.
const TRANSCRIPT = { name: 'made-up-transcript.txt', mimeType: 'text/plain', buffer: Buffer.from('CPIT-240 Database Systems B+\nCPIT-250 Systems Analysis and Design A-\nSTAT-110 Statistics B\n', 'utf8') }
const TRANSCRIPT_CODES = ['CPIT-240', 'CPIT-250', 'STAT-110']

// ---------- One keep-test per inventory row, per language, on every interface that has the row ----------
// `clicks` is the most clicks from Home: one number for every interface, or { old, new } when the new
// interface's route is longer on purpose (the reason is in docs/FEATURE_INVENTORY.md and in the task's log).
// The old interface's number never changes.
const ROWS = new Map()
const clickLimit = (clicks, ui) => (typeof clicks === 'number' ? clicks : clicks[ui])
function keep(id, title, clicks, body) {
  ROWS.set(id, { title, clicks })
  for (const ui of uisFor(id)) for (const lang of LANGS) {
    test(`${id} ${title} (${lang}${ui === 'old' ? '' : `, ${ui} UI`})`, async ({ page, browser, baseURL }, info) => {
      // Task 69: the new interface is the default; the old one opens as after ?ui=old (e2e/fixtures.js).
      if (ui === 'old') await useOldInterface(page.context())
      const app = kamin(page, { ui, lang })
      const more = await body({ app, page, lang, ui, browser, baseURL, info, c: copy[lang] })
      const used = app.clicks + (more?.clicks || 0)
      expect(used, `${id}: ${[...app.steps, ...(more?.steps || [])].join(' → ')}`).toBeLessThanOrEqual(clickLimit(clicks, ui))
    })
  }
}

// ===== Keep, moved into the 4-step flow =====
// Task 62: the new interface confirms the reading in one line and keeps the rows in its "Fix something" sheet, as
// its brief asks. Checking the rows there is one more tap (K01: 3), and correcting one is two (open the sheet,
// "Done"; K02: 6). Approving a clean record from Home needs no more clicks than before (e2e/next-upload.spec.js).
keep('K01', 'upload a transcript', { old: 2, new: 3 }, async ({ app, page, lang }) => {
  await app.home()
  await app.openUpload()
  // StartScreen.jsx (the new interface's step 1 shows the same sentence)
  await expect(text(page, tr(lang, 'يُقرأ ملفك على جهازك فقط ولا يُرفع إلى أي خادم.', 'Your file is read on your device only and is not uploaded to any server.'))).toBeVisible()
  await app.chooseTranscript(TRANSCRIPT)
  await app.showReadRows()
  await expect(app.readCodes()).toHaveCount(TRANSCRIPT_CODES.length)
  expect(await Promise.all((await app.readCodes().all()).map(box => box.inputValue()))).toEqual(TRANSCRIPT_CODES)
})

keep('K02', 'review, correct and approve the transcript', { old: 4, new: 6 }, async ({ app, page, lang, c }) => {
  await app.home()
  await app.openUpload()
  await app.chooseTranscript(TRANSCRIPT)
  await expect(text(page, COURSE_EVIDENCE_PRINCIPLE[lang])).toBeVisible()
  await expect(app.reviewConsent(), 'the consent sentence, word for word').toBeVisible()
  await expect(app.reviewConsent()).not.toBeChecked()
  await expect(app.approveButton(), 'nothing is approved before consent').toBeDisabled()
  await expect(app.approveReason()).toHaveText(c.screens.review.tickConsent)
  await app.showReadRows()
  await app.readGrade(3).fill('B-')
  await expect(app.readGrade(3)).toHaveValue('B-')
  await expectNoPercent(app.readRows(), 'the rows that were read')
  await app.hideReadRows()
  await expectNoPercent(app.main(), 'review')
  await app.approve()
  await expect(app.approvedView()).toBeVisible()
})

// Task 63: the new interface's step 2 asks for a short description and suggests the skills (the old panel lets the
// student tick one); the same four clicks from Home: Continue, Add project, Suggest skills, Save.
keep('K03', 'add project evidence', 4, async ({ app, page, lang }) => {
  await app.sample()
  await app.home()
  await app.openProjects()
  // ProjectEvidence.jsx (since Task 63 from src/content/projectCopy.js; the new interface's step 2 shows the same sentence)
  await expect(text(app.projects(), tr(lang, 'مشروع أو شهادة أو تدريب يغطي فجوة في ملفك. يُسجَّل كتصريح ذاتي بمستوى «تطبيقي مصرّح»، ولا يصبح قدرة أو يغيّر الملاءمة حتى يراجعه مستشار أو تتحقق منه جهة معتمدة.', 'A project, certificate or internship that covers a gap in your profile. It is recorded as self-declared "applied" evidence and never becomes a capability or changes Fit until an advisor reviews it or an authorized issuer verifies it.'))).toBeVisible()
  const before = await app.capabilityLevels()
  expect(before.length, 'the example has capabilities to compare').toBeGreaterThan(0)
  await app.addProject(tr(lang, 'تطبيق ويب لحجز قاعات المذاكرة (مثال مختلق)', 'Study room booking web app (made up)'),
    tr(lang, 'بنيت تطبيق ويب بواجهة أمامية لحجز قاعات المذاكرة مع قاعدة بيانات.', 'A web app to book study rooms with a database.'))
  await expect(app.projects().getByRole('status')).toHaveText(tr(lang, 'سُجّل الدليل محليًا كتصريح ذاتي. لم يُضف قدرة ولم يتغيّر أي حكم؛ يرتفع مستواه فقط بعد مراجعة مستشار أو جهة معتمدة.', 'Recorded locally as self-declared evidence. No capability was added and no judgment changed; the level rises only after an advisor or authorized issuer reviews it.'))
  await expect(text(app.projects(), tr(lang, 'تصريح ذاتي · بانتظار مراجعة', 'Self-declared · awaiting review'))).toBeVisible()
  expect(await app.capabilityLevels(), 'a self-declared project changes no capability or level').toEqual(before)
})

// K04 (the old interests screen with its fixed choices and its own sentences, StudentInsight.jsx) is retired: the team
// decided on 2026-11-19 (Task 74) to drop it, because step 3 of the new interface (Task 64) replaces it. This is a
// planned removal, not a weakened test: the interests consent word for word, "nothing is built before consent" and
// "preferences never become evidence" are checked on step 3 by e2e/next-interests.spec.js, and the row is now D05 under
// "Drop from the student flow" in docs/FEATURE_INVENTORY.md, with the same reason.

keep('K05', 'next-step suggestions: pathways with a reason', 3, async ({ app, lang, c }) => {
  await app.sample()
  await app.home()
  await app.openPathways()
  await expect(app.pathwayReason(0)).not.toBeEmpty()
  await expect(app.opportunityNote()).toHaveText(opportunityStatus().note[lang])
  const details = await app.openPathway(0)
  await expect(text(details, c.screens.matches.supports)).toBeVisible()
  // MatchList.jsx: the pathway's source, then this sentence, in one paragraph.
  await expect(details.getByRole('link', { name: tr(lang, /^مرجع المسار: /, /^Pathway reference: /) })).toBeVisible()
  await expect(details).toContainText(tr(lang, 'متطلبات كامن تجريبية؛ ليست تحققًا مؤسسيًا أو معيار أهلية كاملًا.', 'Kamin requirements are provisional; not institutional verification or a complete eligibility standard.'))
  await expect(details).toContainText(tr(lang, /هذا عدّ وليس درجة|لا توجد درجة رقمية/, /a count, not a score|No score is given/))
  await expectNoPercent(app.main(), 'pathways')
})

keep('K06', 'next-step suggestions: courses and the learning path from the gap', 4, async ({ app, lang, c }) => {
  await app.sample()
  await app.home()
  await app.openCourses()
  await expect(text(app.main(), c.screens.courses.rule)).toBeVisible()
  await expect(app.courseGaps().first(), 'each course says which gap it closes').not.toBeEmpty()
  await app.openLearningPath()
  // LearningPath.jsx
  // Task 65: the new interface shows the path's sentences in a next-step card's Details sheet (app.learningPathScope()).
  await expect(text(app.learningPathScope(), tr(lang, 'هذه نسخة أولية من ميزة مخطط لها للمرحلة القادمة. تأتي الاقتراحات من قائمة صغيرة يبنيها الفريق ويراجعها بنفسه داخل الموقع، ولا يُجلب شيء من أي خدمة خارجية. كل اقتراح يذكر الفجوة التي يسدّها.', 'This is an early version of a feature planned for the next phase. Suggestions come from a small list the team builds and reviews itself, inside the site; nothing is fetched from any outside service. Every suggestion names the gap it closes.'))).toBeVisible()
  await expect(app.learningGap(), 'the gap comes first').toBeVisible()
  await expect(app.learningSteps().first()).toContainText(tr(lang, 'يسدّ:', 'Closes:'))
  await expectNoPercent(app.main(), 'courses')
})

// Task 65: the places are the interface's own (old: the dashboard's "Your next step" card, then Matches with "Your goal:
// Data analytics"; new: My plan's goal chips, then step 4 with the chosen goal at the top), so the test asks the driver.
keep('K07', 'choose a goal', 3, async ({ app }) => {
  await app.sample()
  await app.home()
  await app.openGoals()
  const chip = await app.chooseGoal('data')
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await app.openGoalElsewhere()
  await expect(app.currentGoal('data'), 'the same goal everywhere').toBeVisible()
})

keep('K08', 'my plan: a development plan for a pathway', 5, async ({ app, lang }) => {
  await app.sample()
  await app.home()
  await app.openPlan()
  // DecisionStudio.jsx
  await expect(text(app.plan(), tr(lang, 'الخطة لا تغيّر المهارات أو نتائج المطابقة، ولا تَعِد بقبول أو توظيف.', 'The plan does not change skills or matching results, and does not promise acceptance or employment.'))).toBeVisible()
  await expect(app.plan().getByRole('listitem')).toHaveCount(4)
  const download = await app.downloadPlan()
  expect(download.suggestedFilename()).toBe('kamin-development-plan.txt')
  expect(readFileSync(await download.path(), 'utf8')).toContain(tr(lang, 'هذه الخطة لا تغيّر أدلة الملف أو حكم الملاءمة.', 'This plan does not change profile evidence or fit judgments.'))
  await expectNoPercent(app.main(), 'plan')
})

keep('K09', 'compare pathways', 3, async ({ app, lang }) => {
  await app.sample()
  await app.home()
  await app.openPathwayComparison()
  const compare = app.pathwayComparison()
  await expect(compare.getByRole('table')).toBeVisible()
  // PathwayCompare.jsx
  await expect(text(compare, tr(lang, 'لا نعرض نسبة جاهزية لأن لا معايرة منشورة لها. التفضيلات سياق تختار مشاركته ولا تغيّر الحكم.', 'No readiness percentage is shown because none is calibrated. Preferences are context you choose to include; they change no judgment.'))).toBeVisible()
  await expect(compare.getByRole('checkbox', { name: tr(lang, 'أضف قيودي المصرّح بها (تفضيلاتي) إلى المقارنة', 'Include my declared constraints (preferences) in the comparison') }), 'preferences only if the student adds them').not.toBeChecked()
  await expectNoPercent(compare, 'pathway comparison')
})

// ===== Keep, moved to Profile =====
keep('K10', 'capabilities with level, reasons and sources', 2, async ({ app, page, lang }) => {
  await app.sample()
  await app.home()
  await app.openCapabilities()
  await expect(app.capabilityRows()).toHaveCount(SAMPLE.length)
  for (const [i, skill] of SAMPLE.entries()) {
    await expect(app.capabilityRows().nth(i), 'a level word, never a number').toContainText(levelLabel(skill.evidenceLevel, lang))
    await expect(app.capabilityRows().nth(i), 'every capability names its source').toHaveAccessibleName(new RegExp(tr(lang, 'المصدر: ', 'Source: ')))
  }
  await app.openCapability(0)
  // Dashboard.jsx
  await expect(text(page, tr(lang, 'مستوى الدليل — قرينة لا ضمان', 'Evidence level — a clue, not a guarantee'))).toBeVisible()
  await expect(text(page, COURSE_EVIDENCE_PRINCIPLE[lang])).toBeVisible()
  // Task 66: the new interface shows the course in the capability's reasons sheet (app.capabilityDetails()).
  await expect(app.capabilityDetails().getByText(SAMPLE[0].evidence[0].code).filter({ visible: true }).first(), 'the course behind it').toBeVisible()
  await expectNoPercent(app.main(), 'capabilities')
})

keep('K11', 'why is my level limited, and what the levels mean', 2, async ({ app, lang }) => {
  await app.sample()
  await app.home()
  await app.openCapabilities()
  const reason = await app.levelReason()
  expect(reasonsFor(lang), 'the reason is the one the evidence rules give').toContain((await reason.innerText()).trim())
  await app.openLevelMeanings()
  const meanings = LEVEL_MEANINGS[lang]
  for (const sentence of [meanings.none, meanings.limited, meanings.moderate, meanings.strong, meanings.rule]) await expect(text(app.main(), sentence)).toBeVisible()
  await expect(text(app.main(), COURSE_EVIDENCE_PRINCIPLE[lang]), 'the clue sentence with the levels').toBeVisible()
})

keep('K12', 'import a verifiable credential', 6, async ({ app, lang, c }) => {
  await app.sample()
  await app.home()
  await app.openCredentials()
  await expect(text(app.credentials(), c.screens.myData.credential)).toBeVisible()
  // A made-up, unsigned credential: it can never be "verified".
  const unsigned = { '@context': ['https://www.w3.org/ns/credentials/v2'], type: ['VerifiableCredential', 'AchievementCredential'], issuer: { id: 'urn:kamin:issuer:self', name: 'Self' }, validFrom: '2026-09-01T00:00:00Z', credentialSubject: { achievement: { id: 'urn:kamin:skill:database', name: 'Databases' } } }
  const result = await app.importCredential({ name: 'made-up-credential.jsonld', mimeType: 'application/ld+json', buffer: Buffer.from(JSON.stringify(unsigned)) })
  await expect(result).toContainText(tr(lang, 'غير موثّق', 'Unverified'))
  // CredentialImport.jsx
  await expect(text(result, tr(lang, 'يُحفظ ناتج التحقق ومعرّفات الإنجازات فقط، لا المستند نفسه.', 'Only the verification result and achievement identifiers are stored, not the document.'))).toBeVisible()
  await app.saveCredential()
  await expect(app.credentials().getByRole('listitem').first()).toContainText(tr(lang, 'غير موثّق', 'Unverified'))
})

keep('K13', 'practice tasks', 4, async ({ app, lang }) => {
  await app.sample()
  await app.home()
  await app.openTasks()
  // TaskLoop.jsx
  await expect(text(app.tasks(), tr(lang, 'كل مهمة تنتج مخرجًا يمكن لمراجع فحصه. إكمال المهمة وتقييم المخرج وتوثيق جهة الإصدار ثلاثة أشياء مختلفة، ولا يرفع أي منها مستوى الدليل فوق «تصريح ذاتي» في هذه النسخة.', 'Each task produces an output a reviewer can inspect. Completing the task, evaluating the output and issuer verification are three different things; none raises the evidence level above self-declared in this release.'))).toBeVisible()
  await app.startFirstTask()
  await expect(app.tasks().getByRole('status')).toHaveText(tr(lang, 'بدأت المهمة. يُحفظ تقدمك محليًا.', 'Task started. Progress is saved locally.'))
  await expect(text(app.tasks(), tr(lang, 'توثيق جهة الإصدار: غير متاح في هذه النسخة', 'Issuer verification: not available in this release'))).toBeVisible()
})

// ===== Keep, moved to Settings (from Profile) =====
keep('K14', 'review and correct my data, with undo', 5, async ({ app, lang }) => {
  await app.sample()
  await app.home()
  await app.openMyData()
  // MyData.jsx
  await expect(text(app.main(), tr(lang, 'عدّل الرمز أو الاسم أو الدرجة، أو احذف صفًا. نحتفظ بالقيمة الأصلية من المستند، والتعديل لا يرفع مستوى الدليل.', 'Edit a code, name or grade, or delete a row. The value from your document is kept, and an edit never raises the evidence level.'))).toBeVisible()
  const grade = app.myGrade('CPIT-240')
  const original = await grade.inputValue()
  await grade.fill('C')
  const confirm = await app.saveMyData()
  await expect(text(confirm, tr(lang, 'سيُعاد حساب قدراتك وأحكام الملاءمة، وسنعرض لك ما تغيّر. يمكنك التراجع عن آخر تغيير.', 'This will recompute your capabilities and fit judgments, and we will show you what changed. You can undo the last change.'))).toBeVisible()
  await app.confirmMyData()
  await expect(app.changeSummary(tr(lang, 'ما الذي تغيّر بعد التعديل؟', 'What changed after your edit?'))).toBeVisible()
  await expect(app.myGrade('CPIT-240')).toHaveValue('C')
  await app.undo()
  await expect(app.myGrade('CPIT-240'), 'undo brings the last change back').toHaveValue(original)
})

keep('K15', 'delete one item', 4, async ({ app, lang }) => {
  await app.sample()
  await app.home()
  await app.openMyData()
  const confirm = await app.askDeleteCourse('CPIT-240')
  // MyData.jsx
  await expect(text(confirm, tr(lang, 'سيُحذف من هذا الجهاز ويُعاد حساب قدراتك وأحكام الملاءمة. لا يمكن التراجع عن الحذف.', 'It will be deleted from this device and your capabilities and fit judgments will be recomputed. Deletion cannot be undone.'))).toBeVisible()
  await app.confirmDeleteOne()
  await expect(app.changeSummary(tr(lang, 'ما الذي حُذف؟', 'What was deleted?'))).toBeVisible()
  await expect(app.myGrade('CPIT-240')).toHaveCount(0)
})

keep('K16', 'delete everything', 5, async ({ app, lang, c }) => {
  await app.sample()
  await app.home()
  const confirm = await app.askDeleteEverything()
  await expect(confirm.getByRole('listitem').first(), 'it says what will be deleted').toBeVisible()
  await app.confirmDeleteEverything()
  const done = app.deletedConfirmation()
  await expect(text(done, c.screens.start.deleted.title)).toBeVisible()
  await expect(text(done, `${c.screens.start.deleted.text} ${c.screens.start.deleted.outside}`)).toBeVisible()
  // Nothing comes back: Home, open the app again, it starts empty.
  await app.home()
  await app.openUpload()
  await expect(app.capabilitiesHeading()).toHaveCount(0)
})

keep('K17', 'withdraw each consent', 4, async ({ app, lang, c }) => {
  await app.sample()
  await app.home()
  await app.openConsents()
  await expect(text(app.main(), c.screens.myData.privacyIntro)).toBeVisible()
  for (const key of ['analyze', 'insight', 'advisor', 'research']) await expect(app.consent(key), `the "${c.app.consentItems[key]}" consent, word for word`).toBeVisible()
  await expect(app.consent('analyze')).toBeChecked()
  await app.withdraw('analyze')
  await expect(app.changeSummary(tr(lang, 'ما الذي تغيّر بعد سحب موافقة السجل؟', 'What changed after transcript-consent withdrawal?'))).toBeVisible()
  await expect(app.consent('analyze')).not.toBeChecked()
})

// Task 67: the new interface keeps the profile from Settings (Profile → Settings → "Yes, keep my profile", the same
// sentence and button), one tap more than the old dashboard's offer: the brief puts every data control under Profile →
// Settings and none on Home. The status is on that switch ("Saved on this device"), not in the top bar.
keep('K18', 'save on this device', { old: 3, new: 4 }, async ({ app, page, ui, lang, c }) => {
  await app.sample()
  await app.home()
  // Where the offer is made: the old dashboard; the new interface's Settings (Task 67).
  await app.openSaveOffer()
  // Dashboard.jsx (src/content/saveOfferCopy.js)
  await expect(text(app.main(), tr(lang, 'ملفك مؤقت في هذه الجلسة. هل تريد الاحتفاظ به على هذا الجهاز؟', 'Your profile lasts only for this session. Keep it on this device?'))).toBeVisible()
  await expect(text(app.main(), tr(lang, 'يُحفظ على جهازك فقط بعد موافقتك، ويمكنك حذفه في أي وقت.', 'It is stored on this device only, with your consent, and you can delete it at any time.'))).toBeVisible()
  await app.keepOnDevice()
  // App.jsx
  await expect(app.notices()).toHaveText(tr(lang, 'حُفظ ملفك على هذا الجهاز. احتفظ أيضًا بنسخة احتياطية مشفّرة.', 'Your profile was saved on this device. Keep an encrypted backup too.'))
  await expect(app.saveStatus()).toHaveText(c.app.savedOnDevice)
  // Another tab on the same device (its session is empty): the profile is there.
  const tab = kamin(await page.context().newPage(), { ui, lang })
  await tab.home()
  await tab.openCapabilities()
  await expect(tab.capabilityRows()).toHaveCount(SAMPLE.length)
  return tab
})

keep('K19', 'encrypted backup and restore', 8, async ({ app, browser, baseURL, info, ui, lang, c }) => {
  await app.sample()
  await app.home()
  const passphrase = 'made-up passphrase for tests'
  const download = await app.downloadBackup(passphrase)
  await expect(text(app.main(), c.screens.myData.backup)).toBeVisible()
  // BackupSection.jsx
  await expect(text(app.main(), tr(lang, 'عند الاستعادة يعيد كامن حساب المهارات والملاءمة من الأدلة؛ ولا يعيد تفعيل موافقات المشاركة مع المرشد/البحث تلقائيًا.', 'On restore, Kamin recomputes skills and fit from evidence; advisor/research sharing consents are not automatically re-enabled.'))).toBeVisible()
  expect(download.suggestedFilename()).toMatch(/\.kamin$/)
  const file = await download.path()
  expect(readFileSync(file, 'utf8'), 'the backup is encrypted: no course code inside').not.toContain('CPIT')
  // Another device: a new browser context with this project's settings holds nothing.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = info.project.use
  const device = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL })
  if (ui === 'old') await useOldInterface(device)
  const other = kamin(await device.newPage(), { ui, lang })
  await other.home()
  await other.restoreBackup(file, passphrase)
  await expect(other.notices()).toHaveText(tr(lang, 'تمت استعادة ملفك محليًا. أُعيد حساب النتائج من الأدلة، ولم تُفعّل موافقات المشاركة الخارجية.', 'Your profile was restored locally. Derived results were recomputed from evidence; external sharing consents remain off.'))
  await expect(other.capabilityRows()).toHaveCount(SAMPLE.length)
  await device.close()
  return other
})

keep('K20', 'share a snapshot link', 7, async ({ app, lang, c }) => {
  await app.sample()
  await app.home()
  const link = await app.makeShareLink()
  // CapabilitySnapshot.jsx
  await expect(text(app.main(), tr(lang, 'اختر ما تريد إظهاره للمرشد. لا نضمّن اسمًا أو رقمًا جامعيًا أو مقررات أو درجات أو سجل استخدام.', 'Choose what to show an advisor. Names, student IDs, courses, grades and activity logs are excluded.'))).toBeVisible()
  await expect(text(app.main(), c.screens.myData.share)).toBeVisible()
  await expect(link).toHaveValue(new RegExp(`/${lang}/#payload=[^&]+&key=`))
  expect(await link.inputValue(), 'the link carries no course and no capability in plain text').not.toMatch(/CPIT|STAT|CPIS/)
})

keep('K21', 'usage log', 3, async ({ app, lang, c }) => {
  await app.sample()
  await app.home()
  await app.openUsageLog()
  await expect(text(app.main(), c.screens.myData.auditIntro)).toBeVisible()
  // App.jsx
  await expect(text(app.main(), tr(lang, 'منح موافقة تحليل السجل واعتماده', 'Transcript analysis consent granted and record approved'))).toBeVisible()
})

keep('K22', 'export my capabilities (CLR file)', 5, async ({ app, lang, c }) => {
  await app.sample()
  await app.home()
  const download = await app.downloadCapabilityFile()
  expect(download.suggestedFilename()).toBe(clrExportFilename())
  const file = JSON.parse(readFileSync(await download.path(), 'utf8'))
  expect(file.type).toEqual(['VerifiableCredential', 'ClrCredential'])
  expect(file.proof, 'the file says it is unsigned, and it is').toBeUndefined()
  await expect(text(app.main(), c.screens.myData.exportFile)).toBeVisible()
})

// ===== Keep, moved to Help =====
const HELP = {
  guide: { ar: 'دليل الاستخدام', en: 'User guide' },
  about: { ar: 'عن كامن والفريق', en: 'About Kamin & the team' },
  privacy: { ar: 'سياسة الخصوصية — كامن', en: 'Privacy Policy — Kamin' },
  contact: { ar: 'التواصل والمساعدة', en: 'Contact & help' },
  'runs-where': { ar: 'ما الذي يعمل وأين', en: 'What runs where' },
  tests: { ar: 'نتائج الاختبارات والتغييرات', en: 'Test results and changes' },
}
async function expectHelpPage(page, name, lang) {
  await expect(page).toHaveURL(new RegExp(`/${lang}/${name}(\\.html)?$`))
  await expect(page.getByRole('heading', { name: HELP[name][lang], level: 1 })).toBeVisible()
  expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual([lang, lang === 'ar' ? 'rtl' : 'ltr'])
}

keep('K23', 'how it works', 1, async ({ app, page, lang, ui }) => {
  await app.home()
  if (ui === 'old') {
    for (const step of [tr(lang, 'ارفع كشف درجاتك', 'Upload your transcript'), tr(lang, 'راجع واعتمد', 'Review and approve'), tr(lang, 'شاهد قدراتك وخطوتك التالية', 'See your capabilities and next step')])
      await expect(app.howItWorks().getByRole('heading', { name: step, exact: true })).toBeVisible()
  } else {
    // Task 68: the new interface's Home explains nothing; "How KAMIN works" is one tap away, in the footer and on Help.
    await expect(app.howItWorks(), 'nothing about how it works on Home').toHaveCount(0)
  }
  await app.openHelpPage('guide')
  await expectHelpPage(page, 'guide', lang)
})
keep('K24', 'about', 1, async ({ app, page, lang }) => { await app.home(); await app.openHelpPage('about'); await expectHelpPage(page, 'about', lang) })
keep('K25', 'privacy policy', 1, async ({ app, page, lang }) => { await app.home(); await app.openHelpPage('privacy'); await expectHelpPage(page, 'privacy', lang) })
keep('K26', 'contact', 1, async ({ app, page, lang }) => { await app.home(); await app.openHelpPage('contact'); await expectHelpPage(page, 'contact', lang) })
keep('K27', 'what runs where', 1, async ({ app, page, lang }) => { await app.home(); await app.openHelpPage('runs-where'); await expectHelpPage(page, 'runs-where', lang) })
keep('K28', 'test results page', 1, async ({ app, page, lang }) => { await app.home(); await app.openHelpPage('tests'); await expectHelpPage(page, 'tests', lang) })

keep('K29', 'reviewer tools: knowledge explorer', 1, async ({ app }) => {
  await app.home()
  await app.openKnowledgeExplorer()
  await expect(app.knowledgeExplorer()).toBeVisible()
})

keep('K30', 'reviewer tools: MiniLM pathway search', 5, async ({ app, lang }) => {
  await app.home()
  await app.openPathwaySearch()
  // SemanticRecall.jsx
  await expect(text(app.main(), tr(lang, 'مثل: «أحب اكتشاف الأنماط في الأرقام وشرحها للآخرين». يقترح نموذج متعدد اللغات مسارات قريبة في المعنى؛ ثم يفحص كامن أدلتها ومتطلباتها. لا يتحول النص إلى مهارة أو تفضيل معتمد.', 'Try “I enjoy finding patterns in numbers and explaining them to others.” A multilingual model suggests related pathways; KAMIN then checks evidence and requirements. Your text never becomes an approved skill or preference.'))).toBeVisible()
  await expect(text(app.main(), tr(lang, 'التنزيل الأول نحو 145 MB للنموذج ومشغّل WASM، وقد يحتاج عدة دقائق وذاكرة كافية. يعمل الحساب داخل جهازك؛ الخادم يستقبل طلبات الملفات العامة فقط، ولا يستقبل عبارتك. تُحفظ ملفات النموذج في ذاكرة المتصفح المؤقتة إن أمكن.', 'The first download is about 145 MB for the model and WASM runtime, and may take several minutes and sufficient memory. Computation stays on your device; the server receives only public asset requests, never your phrase. Model files are cached in the browser when available.'))).toBeVisible()
  await expect(app.pathwaySearchLoad(), 'no download before consent').toBeDisabled()
  await app.check(app.pathwaySearchConsent(), 'agree to the local model')
  await expect(app.pathwaySearchLoad()).toBeEnabled()
})

// ===== Keep as is =====
keep('K31', 'pilot mode (?pilot=1)', 4, async ({ app, lang }) => {
  await app.openPilot()
  const consent = app.pilotConsent()
  for (const sentence of [PILOT_CONSENT[lang].intro, ...PILOT_CONSENT[lang].points]) await expect(text(consent, sentence)).toBeVisible()
  await expect(consent.getByTestId('pilot-draft-notice'), 'the approved text, not the draft').toHaveCount(0)
  await app.joinPilot()
  await expect(app.pilotBar().getByRole('button', { name: PILOT_COPY[lang].withdraw })).toBeVisible()
  await app.withdrawFromPilot()
  await expect(app.pilotNotice()).toContainText(PILOT_COPY[lang].withdrawn)
})

keep('K32', 'Back, refresh and links with ?app=<view>', 1, async ({ app, page, lang, ui }) => {
  const appParam = () => new URL(page.url()).searchParams.get('app')
  if (ui === 'new') {
    // Task 69: an old link (Task 27's ?app=privacy#backup) opens the nearest new view, Settings → Back up and restore;
    // only the view id and the section are in the address. A refresh keeps it; Back comes back to it.
    await page.goto(`/${lang}/?app=privacy#backup`)
    await expect(app.sectionHeading('backup')).toBeVisible()
    await expect.poll(() => [appParam(), new URL(page.url()).hash]).toEqual(['settings', '#backup'])
    await page.reload()
    await expect(app.sectionHeading('backup'), 'a refresh keeps the view').toBeVisible()
    await app.tab('plan')
    await expect(app.heading('plan')).toBeVisible()
    await expect.poll(appParam).toBe('plan')
    await page.goBack()
    await expect(app.sectionHeading('backup'), 'Back goes to the previous view').toBeVisible()
    await expect.poll(appParam).toBe('settings')
    return
  }
  await page.goto(`/${lang}/?app=privacy`)
  await expect(app.selectedView('privacy')).toHaveAttribute('aria-selected', 'true')
  await page.reload()
  await expect(app.selectedView('privacy'), 'a refresh keeps the view').toHaveAttribute('aria-selected', 'true')
  await app.openView('audit')
  await expect.poll(appParam).toBe('audit')
  await page.goBack()
  await expect(app.selectedView('privacy'), 'Back goes to the previous view').toHaveAttribute('aria-selected', 'true')
  await expect.poll(appParam).toBe('privacy')
})

// Task 74: the place where the save offer is the one message is the interface's own (old: the dashboard's alert slot;
// new: My plan's offer, the same words from src/content/saveOfferCopy.js), so the test asks the driver.
keep('K33', 'one message at a time', 3, async ({ app, lang }) => {
  await app.sample()
  await app.home()
  await app.openOfferMessage()
  await expect(app.messages(), 'one message: the save offer').toHaveCount(1)
  await app.keepOnDevice()
  await expect(app.messages(), 'the offer is answered; one message says what happened').toHaveCount(1)
  await expect(app.notices()).toBeVisible()
  await app.closeNotice()
  await expect(app.messages()).toHaveCount(0)
})

keep('K34', 'open a shared snapshot link', 1, async ({ app, page, lang }) => {
  const skill = SAMPLE[0]
  const fragment = snapshotFragment(await encryptSnapshot(buildCapabilitySnapshot({ skillIds: [skill.id], goal: null, levels: { [skill.id]: 'synthetic' } })))
  await page.goto(`/${lang}/${fragment}`)
  await expect(app.snapshotHeading()).toBeVisible()
  await expect.poll(() => page.url(), { message: 'the payload and key leave the address bar' }).not.toContain('payload=')
  // CapabilitySnapshot.jsx
  await expect(text(page, tr(lang, 'هذه لقطة أرسلها شخص باختياره. تُفتح محليًا ولا تضاف إلى ملفك أو تخزين كامن. أزلنا الحمولة والمفتاح من شريط العنوان لهذه الصفحة.', 'Someone chose to send this snapshot. It opens locally and is not added to your profile or Kamin storage. The payload and key have been removed from this page’s address bar.'))).toBeVisible()
  await expect(text(page, tr(lang, 'ليست شهادة أو إثبات هوية. التشفير لا يثبت صحة ما اختاره المرسل.', 'This is not a credential or identity check. Encryption does not verify the sender’s claims.'))).toBeVisible()
  await app.openSnapshot()
  await expect(app.snapshotContentsHeading()).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: catalog[skill.id].labels[lang] }).first()).toBeVisible()
  await expect(text(page, tr(lang, 'اختيارات يشاركها صاحب الرابط، وليست شهادة موثّقة أو إثباتًا للجاهزية.', 'Choices shared by the link creator, not a verified credential or proof of readiness.'))).toBeVisible()
})

// ===== Found today, not named in the plan's lists (decisions in docs/FEATURE_INVENTORY.md) =====
keep('K35', 'switch the language without losing my place', 2, async ({ app, page, lang }) => {
  await app.sample()
  await app.home()
  await app.openCapabilities()
  await app.switchLanguage()
  const next = other(lang)
  expect(app.lang).toBe(next)
  await expect(app.capabilitiesHeading(), 'the same view, now in the other language').toBeVisible()
  await expect(app.capabilityRows()).toHaveCount(SAMPLE.length)
  expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual([next, next === 'ar' ? 'rtl' : 'ltr'])
})

keep('K36', 'interests from my digital activity (separate consent)', 8, async ({ app, lang }) => {
  await app.home()
  await app.openDigitalInterests()
  await expect(text(app.main(), TRUST_MICROCOPY.digitalInterests[lang])).toBeVisible()
  // DigitalInterests.jsx
  await expect(text(app.main(), tr(lang, 'التحليل تجريبي بقائمة كلمات عربية وإنجليزية لستة موضوعات تقنية ومهنية. قد يخطئ في فهم النقد أو النفي. لا يقيس الشخصية أو المهارة أو الجاهزية.', 'This experimental analysis uses Arabic and English keywords for six technical and career topics. It may misunderstand criticism or negation. It does not measure personality, skill or readiness.'))).toBeVisible()
  await expect(app.digitalConsent(), 'its own consent, word for word').not.toBeChecked()
  await app.suggestDigitalInterests(tr(lang, 'أستمتع بتعلم SQL وتحليل البيانات.', 'I enjoy learning SQL and data analysis.'))
  await app.confirmDigitalInterest()
  await expect(app.main().getByRole('heading', { name: tr(lang, 'اهتمامات أكدتها بنفسك', 'Interests you confirmed') })).toBeVisible()
})

// Task 74: the recommendation is the interface's own (old: a pathway in Matches; new: a next step's Details sheet, the
// same RecommendationReview.jsx), and so is the way to the history (old: My data → Usage log; new: "See my review
// history" under the review, which opens Settings → Usage log), so the test asks the driver.
keep('K37', 'review or contest a recommendation', 7, async ({ app, lang }) => {
  await app.sample()
  await app.home()
  await app.openRecommendation()
  // RecommendationReview.jsx
  const review = await app.contestRecommendation(tr(lang, 'اسم مستعار للاختبار', 'Test alias'))
  await expect(review.getByRole('status')).toHaveText(tr(lang, 'سُجلت مراجعتك محليًا. لم تُرسل إلى أحد ولم تتغير أدلة قدراتك.', 'Your review was recorded locally. Nothing was sent and your capability evidence did not change.'))
  await app.openReviewHistory()
  await expect(text(app.main(), tr(lang, 'أحداث محلية تاريخية، وليست أدلة مهارة. افتح التوصية لمعرفة صلاحية آخر قرار لمدخلاتك الحالية. تشملها النسخة المشفّرة؛ لا تدخل رابط مشاركة القدرات أو الرسم المعرفي.', 'Historical local events, not skill evidence. Open the recommendation to see whether the latest decision applies to your current inputs. Included in the encrypted backup; excluded from capability-sharing links and the knowledge graph.'))).toBeVisible()
  await expect(app.main().getByRole('listitem').filter({ hasText: tr(lang, 'أعترض على هذا الحكم', 'Contest this judgment') })).toBeVisible()
})

// ===== New in the rebuild (Task 74; the new interface only, e2e/roles.js NEW_ONLY) =====
// My map. Task 75 (Amjd, 2026-11-19): the old interface's "Show connections" graph, the supervisor's map, reused as it was;
// one tap on a capability node opens Profile's reasons sheet (and selects the node, as in the old graph).
keep('K38', 'my map: the old "Show connections" graph; a capability opens its reasons', 3, async ({ app, page, lang }) => {
  await app.sample()
  await app.home()
  await app.openMap()
  await expect(app.myMap().getByRole('heading', { level: 2, name: tr(lang, 'أشخاص. اهتمامات. قدرات. فرص.', 'People. Interests. Capabilities. Opportunities.'), exact: true })).toBeVisible()
  await expect(app.mapNodes('person')).toHaveCount(1)
  await expect(app.mapNodes('evidence').first(), 'a reviewed course of the transcript').toContainText(/[A-Z]{2,5}[\s-]?\d{3}/)
  const capability = app.mapNodes('skill').first()
  const name = (await capability.locator('strong').innerText()).trim()
  expect(SAMPLE.map(skill => skill.labels[lang]), "the capability is one of Profile's").toContain(name)
  // The old graph's safeguard: interests and the catalogue never prove a capability.
  await expect(app.myMap().locator('.relationship-legend')).toContainText(tr(lang, 'تصريح الطالب', 'Student declaration'))
  await app.openMapCapability(0)
  await expect(app.capabilitySheet().getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
  await expect(app.capabilitySheet().getByTestId('capability-why')).not.toBeEmpty()
  await expectNoPercent(app.main(), 'my map')
})

// ---------- The inventory and these tests agree ----------
// Every "Keep" row of docs/FEATURE_INVENTORY.md has a keep-test here (in both languages, see keep()), with the
// same clicks from Home, and every keep-test has its row.
test('every Keep row of docs/FEATURE_INVENTORY.md has its keep-test, with the same clicks from Home', () => {
  const inventory = readFileSync(new URL('../docs/FEATURE_INVENTORY.md', import.meta.url), 'utf8')
  // Columns: ID | what | where today | safeguard | decision | keep-test | clicks from Home (test names in backticks).
  // Clicks: "2", or "2 (new interface: 3)" when the new interface's route is longer on purpose.
  const clicksIn = cell => { const m = cell.match(/^(\d+)(?: \(new interface: (\d+)\))?$/); return !m ? cell : m[2] ? { old: Number(m[1]), new: Number(m[2]) } : Number(m[1]) }
  const rows = [...inventory.matchAll(/^\| (K\d{2}) \|(.+)$/gm)].map(([, id, rest]) => {
    const cells = rest.split('|').map(cell => cell.trim())
    return { id, decision: cells[cells.length - 4], test: cells[cells.length - 3].replace(/`/g, ''), clicks: clicksIn(cells[cells.length - 2]) }
  })
  expect(rows.length, 'Keep rows in the inventory').toBeGreaterThan(30)
  for (const row of rows) {
    expect(row.decision, `${row.id}: a K row is a Keep row`).toMatch(/^\**Keep/)
    expect(ROWS.has(row.id), `${row.id} has a keep-test`).toBe(true)
    expect(row.test, `${row.id}: the inventory names the test`).toBe(`${row.id} ${ROWS.get(row.id).title}`)
    expect(row.clicks, `${row.id}: clicks from Home`).toEqual(ROWS.get(row.id).clicks)
  }
  expect([...ROWS.keys()].sort(), 'every keep-test has its inventory row').toEqual(rows.map(row => row.id).sort())
})

// ---------- Baseline before the rebuild (Task 45) ----------
// Home and every app view of today's interface, reached from Home by the shortest route, with the
// approved synthetic example where the view needs a record: page length in screens, visible controls and
// clicks from Home. 1366×768 in English on the desktop project, 390×844 in Arabic on the phone project.
// Written to test-results/usability.json ("before-rebuild") and attached to the report; committed in
// docs/usability/before-rebuild.json (Windows numbers for now; re-measured on Linux CI at the end).
const BASELINE = { 'desktop-chromium': { lang: 'en', width: 1366, height: 768 }, 'mobile-chromium': { lang: 'ar', width: 390, height: 844 } }
test('baseline before the rebuild: page length, visible controls and clicks from Home for every view', async ({ page }, info) => {
  test.setTimeout(150_000)
  // The baseline is the old interface's (Task 69: it opens as after ?ui=old).
  await useOldInterface(page.context())
  const size = BASELINE[info.project.name]
  await page.setViewportSize({ width: size.width, height: size.height })
  const views = {}
  const measure = async (view, app, inApp = true) => {
    await settle(page)
    const length = inApp ? await pageLength(page) : await documentLength(page)
    views[view] = { screens: length.screens, scrollHeight: length.scrollHeight, clientHeight: length.clientHeight, controls: inApp ? await visibleChoices(page) : await visibleDocumentChoices(page), clicks: app.clicks, route: app.steps }
  }
  const visit = async (view, open, { fresh = false } = {}) => {
    const app = kamin(page, { ui: 'old', lang: size.lang })
    if (fresh) await page.evaluate(() => sessionStorage.clear())
    await app.home()
    await open(app)
    await measure(view, app, view !== 'landing')
  }
  // Before a record: Home, the start screen, the review of the synthetic example.
  await page.goto(`/${size.lang}/`)
  await visit('landing', async () => {}, { fresh: true })
  await visit('start', app => app.openApp(), { fresh: true })
  await visit('review', app => app.openSampleReview(), { fresh: true })
  // With the approved synthetic example.
  await kamin(page, { ui: 'old', lang: size.lang }).sample()
  await visit('dashboard', app => app.openCapabilities())
  await visit('matches', app => app.openPathways())
  await visit('courses', app => app.openCourses())
  await visit('compare', app => app.openPathwayComparison())
  await visit('studio', app => app.openConnections())
  await visit('insight', app => app.openInterests())
  await visit('mydata', app => app.openMyData())
  await visit('privacy', app => app.openConsents())
  await visit('audit', app => app.openUsageLog())
  const result = { size: `${size.width}x${size.height}`, lang: size.lang, views }
  writeResults(info.project.name, { 'before-rebuild': result })
  await info.attach('before-rebuild.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  expect(Object.keys(views)).toEqual(['landing', 'start', 'review', 'dashboard', 'matches', 'courses', 'compare', 'studio', 'insight', 'mydata', 'privacy', 'audit'])
  for (const [view, numbers] of Object.entries(views)) {
    expect(numbers.screens, `${view}: page length`).toBeGreaterThan(0)
    expect(numbers.controls, `${view}: visible controls`).toBeGreaterThan(0)
  }
})

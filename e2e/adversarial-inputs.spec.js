import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { kamin } from './roles.js'

// Red-team inputs for the two places a student can feed the app arbitrary text: transcript upload and the SPARQL lab.
// Each case states the behaviour a reviewer should be able to rely on; a failure here is a defect, not a flaky test.
// Task 70: rewritten on the interface (step 1 with its "Fix something" sheet, Help → the knowledge explorer, Profile,
// My plan, Settings). Two tests of the old interface are deleted because a keep-test or a next-* spec checks the same
// behaviour (project evidence for a gap: K03 and e2e/next-projects.spec.js; suggestions from a project description:
// e2e/next-projects.spec.js); the mapping is in log/task-70.md.

const app = page => kamin(page, { ui: 'new', lang: 'ar' })
async function openStep1(page) {
  await page.goto('/ar/?app=upload')
  await expect(page.locator('#ui2-transcript-file')).toBeAttached()
}
const upload = (page, name, text) => page.locator('#ui2-transcript-file').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') })
// The rows that were read: the Fix sheet's text boxes (the course name is a text area).
async function rowValues(page) {
  const a = app(page)
  await a.showReadRows()
  const values = await a.fixSheet().locator('table input, table textarea').evaluateAll(inputs => inputs.map(i => i.value))
  await a.hideReadRows()
  return values
}

test.describe('transcript upload under hostile input', () => {
  test('markup inside a course title is shown as text, never executed', async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => { errors.push('dialog:' + d.message()); d.dismiss() })
    await openStep1(page)
    await upload(page, 'injection.txt', 'CPIT-260 <img src=x onerror=window.__pwned=1> Databases B\nCPIT-250 <script>window.__pwned=2</script> Software Engineering A')
    await expect(app(page).resultLine()).toBeVisible()
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined()
    await expect(page.locator('img[src="x"]')).toHaveCount(0)
    await expect(page.locator('main script')).toHaveCount(0)
    const values = await rowValues(page)
    expect(values.some(v => v.includes('<img'))).toBe(true)
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined()
    expect(errors).toEqual([])
  })

  test('duplicate course rows block approval until the student resolves them', async ({ page }) => {
    await openStep1(page)
    await upload(page, 'duplicates.txt', 'CPIT-260 Database Systems B\nCPIT-260 Database Systems A\nCPIT-250 Software Engineering B+')
    await expect(app(page).resultLine()).toContainText('3')
    await app(page).reviewConsent().check()
    await expect(app(page).approveButton()).toBeDisabled()
    await expect(app(page).approveReason()).not.toBeEmpty()
    await app(page).showReadRows()
    await expect(page.getByTestId('course-reason').filter({ hasText: 'رمز مقرر مكرر' }).first()).toBeVisible()
  })

  test('an out-of-range numeric grade is not silently accepted as a course', async ({ page }) => {
    await openStep1(page)
    await upload(page, 'bad-grade.txt', 'CPIT-260 Database Systems 45')
    await expect(page.getByTestId('upload-error')).toBeVisible()
    await expect(app(page).resultLine()).toHaveCount(0)
    const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3') || '{}'))
    expect(session.courses || []).toEqual([])
  })

  test('Arabic grades and Arabic-Indic digits normalise to canonical values', async ({ page }) => {
    await openStep1(page)
    await upload(page, 'arabic.txt', 'CPIT-٢٦٠ قواعد البيانات أ\nSTAT-٢٠١ الإحصاء ب+')
    await expect(app(page).resultLine()).toContainText('مقررين')
    expect(await rowValues(page)).toEqual(expect.arrayContaining(['CPIT-260', 'A', 'STAT-201', 'B+']))
  })

  test('a very large text transcript is reviewed without freezing the page', async ({ page }) => {
    test.setTimeout(120_000)
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await openStep1(page)
    const lines = []; for (let i = 0; i < 1500; i++) lines.push(`CPIT-${1000 + i} Course number ${i} B`)
    const started = Date.now()
    await upload(page, 'large.txt', lines.join('\n'))
    await expect(app(page).resultLine()).toContainText('1500', { timeout: 90_000 })
    const elapsed = Date.now() - started
    test.info().annotations.push({ type: 'timing', description: `1500 rows read in ${elapsed} ms` })
    expect(elapsed, 'the result of 1500 rows must appear within 60 s even on a slow CI runner').toBeLessThan(60_000)
    // The page must still respond to input after reading the large file.
    await app(page).reviewConsent().check()
    await expect(app(page).reviewConsent()).toBeChecked()
    expect(errors).toEqual([])
  })
})

// The SPARQL lab is Help → Reviewer tools → the knowledge explorer (?app=help#knowledge), the old component unchanged.
async function openLab(page) {
  await page.goto('/ar/?app=help#knowledge')
  await page.getByRole('tab', { name: 'مختبر SPARQL', exact: true }).click()
}
const runQuery = async (page, query) => { await page.locator('#sparql-query').fill(query); await page.getByRole('button', { name: 'شغّل الاستعلام', exact: true }).click() }

test.describe('SPARQL lab under hostile queries', () => {
  test('a syntax error is reported with its position instead of a blank result', async ({ page }) => {
    await openLab(page)
    await runQuery(page, 'SELECT * WHERE { ?s ?p')
    const error = page.locator('.query-error')
    await expect(error).toContainText('صيغة الاستعلام غير صحيحة')
    await expect(error.locator('.query-location')).toContainText(/\d/)
  })

  test('oversized, remote-dataset and unbounded queries are bounded by policy', async ({ page }) => {
    await openLab(page)
    // The editor itself caps input at the policy limit, so an oversized paste is truncated rather than sent.
    await expect(page.locator('#sparql-query')).toHaveAttribute('maxlength', '6000')
    await page.locator('#sparql-query').fill('SELECT * WHERE { ?s ?p ?o } #' + 'x'.repeat(6100))
    expect(await page.locator('#sparql-query').inputValue()).toHaveLength(6000)
    await runQuery(page, 'SELECT * FROM <urn:kamin:graph:reference> WHERE { ?s ?p ?o }')
    await expect(page.locator('.query-error')).toContainText('SERVICE وFROM غير متاحين')
    await runQuery(page, 'SELECT * WHERE { ?s ?p ?o } LIMIT 100000')
    await expect(page.getByRole('heading', { name: 'نتيجة الاستعلام', exact: true })).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.query-results')).toContainText('عُرض أول 100 صف')
    await expect(page.locator('.query-table tbody tr')).toHaveCount(100)
  })
})

test.describe('field-level provenance', () => {
  test('a grade raised by hand is named on review and travels with the capability', async ({ page }) => {
    const a = app(page)
    await openStep1(page)
    await upload(page, 'honest.txt', 'CPIT-240 Database Systems B\nSTAT-110 General Statistics B+')
    await expect(a.resultLine()).toContainText('مقررين')
    await a.showReadRows()
    const sheet = a.fixSheet()
    await expect(sheet.locator('.provenance-badge.document')).toHaveCount(2)
    const grade = a.readGrade(1)
    await grade.fill('A+')
    // The sentence is on the course's own row.
    const raised = sheet.getByTestId('course-reason').filter({ hasText: 'رفعت درجة' })
    await expect(raised).toContainText('رفعت درجة CPIT-240 من B إلى A+')
    await expect(sheet.locator('.provenance-badge.edited')).toHaveCount(1)
    await expect(sheet.locator('.provenance-badge.edited')).toContainText('درجة مرفوعة')
    // Restoring the extracted value clears the signal: provenance follows the value, not the click.
    await grade.fill('B')
    await expect(raised).toHaveCount(0)
    await grade.fill('A')
    await a.hideReadRows()
    // Task 55: this plain list prints no college, so the note's Fix opens the one-tap list.
    await page.getByTestId('college-note').getByRole('button', { name: 'تصحيح' }).click()
    await page.getByTestId('college-fix').getByRole('button', { name: 'كلية الحاسبات وتقنية المعلومات' }).click()
    await a.approve()
    await expect(a.approvedView()).toBeVisible()
    // The capability built on the edited grade says so (Profile's reasons sheet), the other is from the document.
    const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3') || '{}'))
    const edited = session.courses.find(c => c.code === 'CPIT-240')
    expect(edited).toMatchObject({ grade: 'A', edits: { grade: 'B' } })
    await a.openCapabilities()
    const rows = a.capabilityRows()
    await expect(rows.first()).toBeVisible()
    await rows.filter({ hasText: 'قواعد البيانات' }).first().click()
    const card = a.capabilitySheet().locator('.skill-card[data-provenance="edited"]')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('معدّل بعد الاستخراج')
    await expect(card).toContainText('رُفعت يدويًا')
  })
})

test.describe('document integrity signals', () => {
  test('a QR verification link inside an uploaded image is surfaced without sending anything', async ({ page }) => {
    test.setTimeout(150_000)
    const { default: QRCode } = await import('qrcode')
    const png = await QRCode.toBuffer('https://verify.example-university.edu.sa/t/ABC123', { width: 360, margin: 2 })
    const outbound = []; page.on('request', r => { const url = r.url(); if (!url.startsWith('http://127.0.0.1') && !url.startsWith('blob:') && !url.startsWith('data:')) outbound.push(url) })
    await openStep1(page)
    await page.locator('#ui2-transcript-file').setInputFiles({ name: 'qr-only.png', mimeType: 'image/png', buffer: png })
    const signals = page.getByTestId('document-signals')
    await expect(signals).toBeVisible({ timeout: 120_000 })
    await expect(signals).toContainText('verify.example-university.edu.sa')
    const link = signals.getByRole('link', { name: /تحقق من المصدر/ })
    await expect(link).toHaveAttribute('href', 'https://verify.example-university.edu.sa/t/ABC123')
    await expect(link).toHaveAttribute('rel', /noopener/)
    expect(outbound).toEqual([])
  })
})

test.describe('portable export', () => {
  // Keep-test K22 checks the file name, the type and that there is no proof; this adds the self-asserted status and the
  // provenance level of every achievement.
  test('the CLR-shaped export is unsigned, self-asserted and carries provenance levels', async ({ page }) => {
    const a = app(page)
    await a.sample()
    await a.home()
    const file = await a.downloadCapabilityFile()
    expect(file.suggestedFilename()).toMatch(/^kamin-clr-export-\d{4}-\d{2}-\d{2}\.jsonld$/)
    const body = JSON.parse(readFileSync(await file.path(), 'utf8'))
    expect(body.type).toEqual(['VerifiableCredential', 'ClrCredential'])
    expect(body.proof).toBeUndefined()
    expect(body['kamin:verificationStatus']).toBe('self-asserted')
    expect(body.credentialSubject.verifiableCredential.length).toBeGreaterThan(0)
    expect(body.credentialSubject.verifiableCredential.every(x => x['kamin:provenanceLevel'] === 'synthetic')).toBe(true)
  })
})

test.describe('verifiable credential import', () => {
  // Keep-test K12 imports an unsigned credential; this adds the garbage file and the reasons, and checks that nothing
  // is ever shown as verified.
  test('an unsigned export is reported unverified with plain reasons, and garbage is rejected', async ({ page }) => {
    const a = app(page)
    await a.sample()
    await a.home()
    await a.openCredentials()
    const panel = page.getByTestId('credential-import')
    const input = panel.locator('input[type=file]')
    await input.setInputFiles({ name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from('not json') })
    await expect(panel.getByRole('alert')).toContainText('تعذر قراءة الملف')
    const unsigned = { '@context': ['https://www.w3.org/ns/credentials/v2'], type: ['VerifiableCredential', 'AchievementCredential'], issuer: { id: 'urn:kamin:issuer:self', name: 'Self' }, validFrom: '2026-09-01T00:00:00Z', credentialSubject: { achievement: { id: 'urn:kamin:skill:database', name: 'Databases' } } }
    await input.setInputFiles({ name: 'unsigned.jsonld', mimeType: 'application/ld+json', buffer: Buffer.from(JSON.stringify(unsigned)) })
    const result = panel.getByTestId('credential-result')
    await expect(result).toContainText('غير موثّق')
    await expect(result).toContainText('لا توقيع رقمي')
    await expect(result).toContainText('سجل الجهات المعتمدة')
    await result.getByRole('button', { name: /احفظ نتيجة التحقق/ }).click()
    await expect(panel.locator('.credential-list li')).toHaveCount(1)
    await expect(panel.locator('.credential-list')).toContainText('غير موثّق')
    await expect(page.getByTestId('verified-badge')).toHaveCount(0)
  })
})

test.describe('task → evidence → review loop', () => {
  // Keep-test K13 starts a task; this follows it to the end on Profile → More → practice tasks (TaskLoop.jsx, unchanged):
  // an attached output, the rubric, a local review, a reload, and the level that never rises above self-declared.
  test('a student can start a gap task, attach an output, self-assess and record a local review that never upgrades the level', async ({ page }) => {
    const a = app(page)
    await a.sample()
    await a.home()
    await a.openTasks()
    const loop = page.getByTestId('task-loop')
    await expect(loop.locator('.task-card')).toHaveCount(6)
    const card = loop.locator('[data-task="task-backup-restore"]')
    await card.locator('.task-head').click()
    await card.getByRole('button', { name: 'ابدأ المهمة', exact: true }).click()
    await expect(card).toHaveAttribute('data-status', 'in-progress')
    await card.getByLabel(/وصف المخرج/).fill('نسخ احتياطي ثم إتلاف جدول ثم استعادة مع سجل الأوامر والنتائج')
    await card.getByRole('button', { name: 'احفظ المخرج محليًا', exact: true }).click()
    await expect(card).toHaveAttribute('data-status', 'output-attached')
    await expect(card.getByTestId('task-proof')).toContainText('مخرج مرفق (تصريح ذاتي)')
    await expect(card.getByTestId('task-proof')).toContainText('غير متاح في هذه النسخة')
    await card.getByTestId('task-rubric').getByLabel('مستوفى').first().check()
    await card.getByLabel('اسم المراجع أو اسمه المستعار').fill('د. مستشار')
    await card.getByLabel('صفة المراجع').selectOption('advisor')
    await card.getByRole('button', { name: 'سجّل المراجعة محليًا', exact: true }).click()
    await expect(card).toHaveAttribute('data-status', 'reviewed')
    await expect(card.getByTestId('task-proof')).toContainText('رأي مراجع محلي مصرح به')
    // Reload: progress is reopened, and the record still carries only the declared level.
    await page.reload()
    await a.openTasks()
    await expect(page.getByTestId('task-loop').locator('[data-task="task-backup-restore"]')).toHaveAttribute('data-status', 'reviewed')
    const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3') || '{}'))
    expect(session.tasks[0].level).toBe('declared-applied')
    expect(session.tasks[0].reviews[0]).toMatchObject({ role: 'advisor', level: 'declared' })
    expect(session.tasks[0].issuerVerification).toBeUndefined()
  })
})

test.describe('pathway comparison', () => {
  // Keep-test K09 checks the table, its sentence, the constraints box and no percentage; this checks the rows the
  // constraints add and the limit of three pathways, on My plan → Compare paths (PathwayCompare.jsx, unchanged).
  test('compares pathways on evidence present, missing, work required and opt-in constraints without a readiness percentage', async ({ page }) => {
    const a = app(page)
    await a.sample()
    await a.home()
    await a.openPathwayComparison()
    const compare = page.getByTestId('pathway-compare')
    await expect(compare).toBeVisible()
    await expect(compare.locator('tbody tr')).toHaveCount(4)
    await expect(compare).toContainText('الأدلة المتوفرة')
    await expect(compare).toContainText('العمل المطلوب')
    expect(await compare.innerText()).not.toMatch(/\d+\s*%/)
    await compare.getByRole('checkbox', { name: /قيودي المصرّح بها/ }).check()
    await expect(compare.locator('tbody tr')).toHaveCount(8)
    await expect(compare).toContainText('لم تُحدد')
    // At most three pathways: tick until three are chosen; then every other choice is disabled.
    const unpicked = compare.locator('.compare-picker input:not(:checked)')
    while ((await compare.locator('.compare-picker input:checked').count()) < 3) await unpicked.first().check()
    await expect(compare.locator('thead th')).toHaveCount(4)
    await expect(unpicked.first()).toBeDisabled()
  })
})

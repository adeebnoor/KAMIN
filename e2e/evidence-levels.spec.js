import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { copy } from '../src/i18n.js'
import { kamin } from './roles.js'

// Task 02: capabilities show an ordinal evidence level with reasons, never a percentage, and a hand-typed course waits
// for a document instead of creating a capability. Task 70: rewritten on the interface: step 1 (and its manual entry),
// Profile's capability rows and their reasons sheet (the old SkillCard, unchanged), Profile's "Evidence waiting for a
// document" note (restored from the old dashboard in this task) and Settings → My courses.

const PRINCIPLE = {
  ar: 'درجة المقرر قرينة على مخرج تعلم متوقع، وليست ضمانًا لإتقانه. يختلف مستوى الدليل حسب الدرجة ونوع التقييم.',
  en: 'A course grade is a clue to an expected learning outcome, not a guarantee of mastery. The evidence level depends on the grade and the type of assessment.',
}

test('capability cards show level and why, academic and practical separately, and no percentage', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await page.goto('/ar/?start=sample')
  // Task 03: step 1 states the principle before approval.
  await expect(page.getByTestId('course-evidence-principle')).toHaveText(PRINCIPLE.ar)
  await app.reviewConsent().check()
  await app.approveButton().click()
  await expect(app.approvedView()).toBeVisible()
  await app.openCapabilities()
  const rows = app.capabilityRows()
  await expect(rows).toHaveCount(5)
  for (let i = 0; i < 5; i++) {
    await app.openCapability(i)
    const card = app.capabilitySheet().locator('.skill-card')
    await expect(card).toHaveAttribute('data-evidence-level', /^(strong|moderate|limited)$/)
    await expect(card).toContainText('قرينة لا ضمان')
    await expect(card.getByTestId('course-evidence-principle')).toContainText('وليست ضمانًا لإتقانه')
    await expect(card).toContainText('مدعوم أكاديميًا')
    await expect(card.getByTestId('practical-basis')).toContainText('لا دليل عملي مُراجَع بعد')
    await expect(card.locator('.evidence-why').first()).toContainText(/^قرينة (قوية|متوسطة|محدودة): /)
    // The demo course map is still proposed, so the reason names it.
    await expect(card.locator('.evidence-why').first()).toContainText('ربط المقرر مقترح ولم يعتمده القسم بعد')
    await page.keyboard.press('Escape')
    await expect(app.capabilitySheet()).toHaveCount(0)
  }
  const text = await page.getByTestId('ui2-capabilities').innerText()
  expect(text).not.toMatch(/\d\s*%|٪/)
  expect(text).not.toMatch(/urn:kamin:/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

// Manual entry (step 1, after a file that cannot be read): a hand-typed mapped course creates no capability; Profile
// says it waits for a document, and "Upload your record" opens step 1.
for (const lang of ['ar', 'en']) test(`a hand-typed mapped course creates no capability and waits for a document, with "Upload your record": ${lang}`, async ({ page }) => {
  const t = copy[lang].app
  const app = kamin(page, { ui: 'new', lang })
  await app.goToView('upload')
  await page.locator('#ui2-transcript-file').setInputFiles({ name: 'not-a-transcript.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 1, 2, 3]) })
  await page.getByRole('button', { name: copy[lang].screens.start.retry.manual, exact: true }).click()
  await page.getByTestId('college-question').getByRole('button', { name: lang === 'ar' ? 'كلية الحاسبات وتقنية المعلومات' : 'Faculty of Computing and Information Technology' }).click()
  // With no row yet the card's button says "Add courses" (the same data-testid as "Fix something").
  await page.getByTestId('ui2-fix-open').click()
  await expect(app.fixSheet()).toBeVisible()
  await app.fixSheet().getByRole('button', { name: t.addRow }).click()
  await app.fixSheet().getByLabel(t.courseCode, { exact: true }).fill('CPIT-240')
  await app.fixSheet().getByLabel(t.courseName, { exact: true }).fill('Databases')
  await app.fixSheet().getByLabel(t.grade, { exact: true }).fill('A')
  await app.fixSheet().getByRole('button', { name: t.save, exact: true }).click()
  await expect(app.fixSheet().locator('.mapping-badge.pending')).toContainText(lang === 'ar' ? 'بانتظار مستند أو مراجعة' : 'waiting for a document or review')
  await app.hideReadRows()
  await app.approve()
  await app.goToView('profile')
  await expect(app.capabilityRows()).toHaveCount(0)
  const awaiting = page.getByTestId('awaiting-evidence')
  await expect(awaiting).toContainText('CPIT-240')
  await expect(awaiting).toContainText(lang === 'ar' ? 'قواعد البيانات' : 'Databases')
  const why = awaiting.getByTestId('awaiting-why')
  if (lang === 'en') await expect(why).toContainText('Waiting for a document: you typed this course in.')
  await why.getByRole('button', { name: lang === 'ar' ? 'ارفع سجلك' : 'Upload your record', exact: true }).click()
  await expect(app.heading('upload')).toBeVisible()
})

test('the methodology page states that a course grade is a clue, not a guarantee (Task 03)', async ({ page }) => {
  await page.goto('/en/methodology.html')
  await expect(page.locator('[data-course-evidence-principle]:visible')).toHaveText(PRINCIPLE.en)
  await page.goto('/ar/methodology.html')
  await expect(page.locator('[data-course-evidence-principle]:visible')).toContainText('وليست ضمانًا لإتقانه')
})

// ---------- Task 29 · "why is this level limited?" in one line, and what the levels mean ----------
const T29 = {
  ar: { legend: 'ماذا تعني المستويات؟', limited: 'قرينة محدودة', shared: 'كلها محدودة للأسباب نفسها، وليس بسبب درجاتك: القسم لم يعتمد ربط هذه المقررات بعد، ولا نعرف بعد كيف تُقيَّم هذه المقررات.' },
  en: { legend: 'What do the levels mean?', limited: 'Limited clue', shared: 'All limited for the same reasons, not your grades: the department has not approved these course links yet, and we don’t know yet how these courses are assessed.' },
}

for (const lang of ['ar', 'en']) test(`synthetic profile: the shared reason once above the list, not on the rows; the levels explained (${lang})`, async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.openCapabilities()
  const list = page.getByTestId('ui2-capabilities')
  const shared = list.getByTestId('capability-why-all')
  await expect(shared).toContainText(T29[lang].shared)
  await expect(list.getByTestId('capability-why')).toHaveCount(0)
  // A screen reader hears the reason with each row.
  const describedBy = await app.capabilityRows().first().getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveAttribute('data-testid', 'capability-why-all')
  // Above the list, and the level each row shows is still the one levels.js computes.
  expect((await shared.boundingBox()).y).toBeLessThan((await app.capabilityRows().first().boundingBox()).y)
  await expect(list.locator('.ui2-cap-level')).toHaveText(Array(5).fill(T29[lang].limited))
  // What the levels mean: closed until asked; four levels, the rule, and the approved Task 03 sentence word for word.
  const legend = list.getByTestId('level-legend')
  await expect(legend).not.toHaveAttribute('open', '')
  await legend.getByText(T29[lang].legend, { exact: true }).click()
  await expect(legend.locator('li')).toHaveCount(4)
  await expect(legend).toContainText(PRINCIPLE[lang])
  expect(await list.innerText()).not.toMatch(/\d\s*%|٪/)
  const report = await new AxeBuilder({ page }).include('[data-testid="ui2-capabilities"]').analyze()
  expect(report.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(report.violations)).toEqual([])
})

test('when the reasons differ, each capability names its own: a lowered grade', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.sample()
  await app.home()
  await app.openMyData()
  await app.myGrade('CPIT-240').fill('D')
  await app.saveMyData()
  await app.confirmMyData()
  await app.openCapabilities()
  await expect(page.getByTestId('capability-why-all')).toHaveCount(0)
  const rows = app.capabilityRows()
  const count = await rows.count()
  let changed = 0, notYours = 0
  for (let i = 0; i < count; i++) {
    await app.openCapability(i)
    const why = app.capabilitySheet().getByTestId('capability-why')
    await expect(why).toHaveCount(1)
    const text = await why.innerText()
    if (text.includes('بسبب الدرجة D في CPIT-240')) changed++
    if (text.includes('وليس بسبب درجتك')) notYours++
    await page.keyboard.press('Escape')
    await expect(app.capabilitySheet()).toHaveCount(0)
  }
  expect(changed).toBe(1)
  // The other capabilities still say it is not their grade.
  expect(notYours).toBe(count - 1)
})

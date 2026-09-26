import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function openDemo(page) {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await expect(page).toHaveURL(/#\/app\/start$/)
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  await expect(page).toHaveURL(/#\/app\/review$/)
  await page.getByRole('checkbox', { name: /أوافق على استخدام السجل/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page).toHaveURL(/#\/app\/dashboard$/)
}

async function expectNoBlockingAxe(page) {
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact))
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
}

test('landing communicates value before GPA and shows the fictional evidence example', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('قيمتك فيما تستطيع تحقيقه')
  await expect(page.getByText('مثال توضيحي لطالبة افتراضية')).toBeVisible()
  await expect(page.getByText('تحليل المتطلبات', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('توظيف الذكاء الاصطناعي في العمل', { exact: true })).toBeVisible()
  await expect(page.getByText('PMP', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/بناء تقرير أسبوعي آلي/).first()).toBeVisible()
})

test('Arabic core journey requires explicit consent and produces traceable evidence', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()

  const approve = page.getByRole('button', { name: /أعتمد السجل/ })
  await expect(approve).toBeDisabled()
  await page.getByRole('checkbox', { name: /أوافق على استخدام السجل/ }).check()
  await expect(approve).toBeEnabled()
  await approve.click()

  await expect(page.getByText(/قدراتك كما يدعمها الدليل/)).toBeVisible()
  await expect(page.getByText(/أدلة تطبيق/).first()).toBeVisible()
  await page.getByRole('button', { name: /قدراتي/ }).first().click()
  await expect(page.getByRole('heading', { name: /كل مهارة مرتبطة بدليل ومخرج تعلم/ })).toBeVisible()
  await expect(page.getByText(/مؤشر دليل مبدئي/).first()).toBeVisible()
})

test('student can deny an inferred skill and trigger recalculation', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: /قدراتي/ }).first().click()
  const card = page.locator('.skill-card').filter({ hasText: 'تحليل المتطلبات' }).first()
  await card.getByRole('button', { name: /لا يصفني/ }).click()
  await expect(card).toContainText('نفيتها')
  await expect(page.getByRole('status')).toContainText(/إعادة حساب|سيعاد حساب/)
})

test('goal is not preselected and judgments stay in exploration mode until chosen', async ({ page }) => {
  await openDemo(page)
  await expect(page.getByRole('button', { name: /لا أعرف بعد — أريد الاستكشاف/ })).toBeVisible()
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  await expect(page.getByText(/لن نصدر حكمًا مبنيًا على هدف لم تختره/)).toBeVisible()
  await expect(page.locator('.status.explore').first()).toBeVisible()
})

test('PMP judgment shows not-yet, source and alternative path after management goal', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: /الإدارة والمشاريع/ }).click()
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  const card = page.locator('.fit-card').filter({ hasText: 'PMP' })
  await expect(card).toContainText('لا تناسبك الآن')
  await expect(card).toContainText(/36 شهر/)
  await expect(card.getByRole('link', { name: /المصدر الرسمي/ })).toHaveAttribute('href', /pmi\.org/)
  await expect(card).toContainText(/تحليل الأعمال|CAPM|Scrum/)
})

test('vault exposes the ten-record vision while activating education only', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: /خزنتك/ }).first().click()
  await expect(page.locator('.vault-record')).toHaveCount(10)
  await expect(page.locator('.vault-record.available')).toHaveCount(1)
  await expect(page.locator('.vault-record').filter({ hasText: 'الصحي' })).toBeVisible()
  await expect(page.getByText(/لا يُطلب إلا لهدف تختاره/).first()).toBeVisible()
})

test('temporary session storage is the default and local persistence is opt-in', async ({ page }) => {
  await openDemo(page)
  const storage = await page.evaluate(() => ({
    session: sessionStorage.getItem('kamin-pilot-v2-session'),
    local: localStorage.getItem('kamin-pilot-v2'),
  }))
  expect(storage.session).toContain('"approved":true')
  expect(storage.local).toBeNull()
})

test('app routes support browser back and refresh', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  await expect(page).toHaveURL(/#\/app\/courses$/)
  await page.reload()
  await expect(page).toHaveURL(/#\/app\/courses$/)
  await expect(page.getByText(/الحكم مع السبب والطريق والنتيجة/)).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/#\/app\/dashboard$/)
})

test('dialog closes with Escape and restores focus', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first()
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('language switch sets LTR English value proposition', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('h1')).toContainText('not your GPA alone')
  await expect(page.getByText('Illustrative fictional student')).toBeVisible()
})

test('landing and all primary app screens have no serious or critical axe violations', async ({ page }) => {
  await page.goto('/')
  await expectNoBlockingAxe(page)

  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await expectNoBlockingAxe(page)

  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  await expectNoBlockingAxe(page)

  await page.getByRole('checkbox', { name: /أوافق على استخدام السجل/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()

  for (const id of ['dashboard', 'skills', 'courses', 'vault', 'privacy', 'audit']) {
    await page.evaluate((screen) => { window.location.hash = `#/app/${screen}` }, id)
    await expect(page).toHaveURL(new RegExp(`#/app/${id}import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function openDemo(page) {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await expect(page).toHaveURL(/#\/app\/start$/)
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  await expect(page).toHaveURL(/#\/app\/review$/)
  await page.getByRole('checkbox', { name: /أوافق على استخدام السجل/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page).toHaveURL(/#\/app\/dashboard$/)
}

async function expectNoBlockingAxe(page) {
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact))
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
}

test('landing communicates value before GPA and shows the fictional evidence example', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('قيمتك فيما تستطيع تحقيقه')
  await expect(page.getByText('مثال توضيحي لطالبة افتراضية')).toBeVisible()
  await expect(page.getByText('تحليل المتطلبات', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('توظيف الذكاء الاصطناعي في العمل', { exact: true })).toBeVisible()
  await expect(page.getByText('PMP', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/بناء تقرير أسبوعي آلي/).first()).toBeVisible()
})

test('Arabic core journey requires explicit consent and produces traceable evidence', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()

  const approve = page.getByRole('button', { name: /أعتمد السجل/ })
  await expect(approve).toBeDisabled()
  await page.getByRole('checkbox', { name: /أوافق على استخدام السجل/ }).check()
  await expect(approve).toBeEnabled()
  await approve.click()

  await expect(page.getByText(/قدراتك كما يدعمها الدليل/)).toBeVisible()
  await expect(page.getByText(/أدلة تطبيق/).first()).toBeVisible()
  await page.getByRole('button', { name: /قدراتي/ }).first().click()
  await expect(page.getByRole('heading', { name: /كل مهارة مرتبطة بدليل ومخرج تعلم/ })).toBeVisible()
  await expect(page.getByText(/مؤشر دليل مبدئي/).first()).toBeVisible()
})

test('student can deny an inferred skill and trigger recalculation', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: /قدراتي/ }).first().click()
  const card = page.locator('.skill-card').filter({ hasText: 'تحليل المتطلبات' }).first()
  await card.getByRole('button', { name: /لا يصفني/ }).click()
  await expect(card).toContainText('نفيتها')
  await expect(page.getByRole('status')).toContainText(/إعادة حساب|سيعاد حساب/)
})

test('goal is not preselected and judgments stay in exploration mode until chosen', async ({ page }) => {
  await openDemo(page)
  await expect(page.getByRole('button', { name: /لا أعرف بعد — أريد الاستكشاف/ })).toBeVisible()
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  await expect(page.getByText(/لن نصدر حكمًا مبنيًا على هدف لم تختره/)).toBeVisible()
  await expect(page.locator('.status.explore').first()).toBeVisible()
})

test('PMP judgment shows not-yet, source and alternative path after management goal', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: /الإدارة والمشاريع/ }).click()
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  const card = page.locator('.fit-card').filter({ hasText: 'PMP' })
  await expect(card).toContainText('لا تناسبك الآن')
  await expect(card).toContainText(/36 شهر/)
  await expect(card.getByRole('link', { name: /المصدر الرسمي/ })).toHaveAttribute('href', /pmi\.org/)
  await expect(card).toContainText(/تحليل الأعمال|CAPM|Scrum/)
})

test('vault exposes the ten-record vision while activating education only', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: /خزنتك/ }).first().click()
  await expect(page.locator('.vault-record')).toHaveCount(10)
  await expect(page.locator('.vault-record.available')).toHaveCount(1)
  await expect(page.locator('.vault-record').filter({ hasText: 'الصحي' })).toBeVisible()
  await expect(page.getByText(/لا يُطلب إلا لهدف تختاره/).first()).toBeVisible()
})

test('temporary session storage is the default and local persistence is opt-in', async ({ page }) => {
  await openDemo(page)
  const storage = await page.evaluate(() => ({
    session: sessionStorage.getItem('kamin-pilot-v2-session'),
    local: localStorage.getItem('kamin-pilot-v2'),
  }))
  expect(storage.session).toContain('"approved":true')
  expect(storage.local).toBeNull()
})

test('app routes support browser back and refresh', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  await expect(page).toHaveURL(/#\/app\/courses$/)
  await page.reload()
  await expect(page).toHaveURL(/#\/app\/courses$/)
  await expect(page.getByText(/الحكم مع السبب والطريق والنتيجة/)).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/#\/app\/dashboard$/)
})

test('dialog closes with Escape and restores focus', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first()
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('language switch sets LTR English value proposition', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('h1')).toContainText('not your GPA alone')
  await expect(page.getByText('Illustrative fictional student')).toBeVisible()
})

test('landing and all primary app screens have no serious or critical axe violations', async ({ page }) => {
  await page.goto('/')
  await expectNoBlockingAxe(page)

  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await expectNoBlockingAxe(page)

  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  await expectNoBlockingAxe(page)

  await page.getByRole('checkbox', { name: /أوافق على استخدام السجل/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()

))
    await expectNoBlockingAxe(page)
  }
})

test('mobile navigation includes the usage log and never scrolls horizontally', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile acceptance only')
  await openDemo(page)
  await expect(page.locator('.bottom-nav')).toBeVisible()
  await expect(page.getByRole('button', { name: /سجل الاستخدام/ }).last()).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('launch metadata and public technical assets are present and evidence-accurate', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /كامن/)
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /أدلة/)
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /kamin/)
  await expect(page.locator('img[alt="شعار كامن"]').first()).toBeVisible()

  for (const path of ['/favicon.ico', '/favicon.svg', '/manifest.webmanifest', '/robots.txt', '/sitemap.xml', '/privacy.html']) {
    const response = await request.get(path)
    expect(response.ok(), `${path} should return 2xx`).toBeTruthy()
  }
})

test('public pilot makes no third-party network requests during the demo journey', async ({ page }) => {
  const external = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url())
  })
  await openDemo(page)
  expect(external).toEqual([])
})

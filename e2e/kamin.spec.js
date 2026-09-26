import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('Arabic core journey is usable and explainable', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('قيمتك')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  await expect(page.getByText(/مقررات مستخرجة/)).toBeVisible()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.getByText(/هذه قدراتك/)).toBeVisible()
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  await expect(page.getByText(/لا نرتب الدورات فقط/)).toBeVisible()
  await expect(page.getByText(/PMP/).first()).toBeVisible()
  await expect(page.getByText(/لا تناسبك الآن/).first()).toBeVisible()
})

test('language switch sets LTR English experience', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('h1')).toContainText('not your GPA alone')
})

test('public landing has no serious or critical axe violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter(v => ['serious', 'critical'].includes(v.impact))
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
})


test('launch metadata and public technical assets are present', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /كامن/)
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /kamin/)
  const logo=page.locator('img[src="/kamin-logo-v3.webp"]')
  await expect(logo).toHaveCount(1)
  await expect(logo).toBeVisible()
  await expect(page.locator('img[src*="kamin-logo-fixed"]')).toHaveCount(0)
  await expect(page.locator('link[rel="alternate"][hreflang="ar-SA"]')).toHaveAttribute('href', /lang=ar/)
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /lang=en/)
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', /lang=ar/)
  await expect(page.locator('link[rel="icon"][type="image/png"][sizes="192x192"]')).toHaveAttribute('href', /icon-192\.png$/)
  await expect(page.locator('link[rel="icon"][type="image/png"][sizes="512x512"]')).toHaveAttribute('href', /icon-512\.png$/)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-kamin-1200x630\.jpg$/)

  for (const path of ['/favicon.ico','/favicon.svg','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/og-kamin-1200x630.jpg','/ocr/worker.min.js','/ocr/lang/eng.traineddata.gz','/ocr/lang/ara.traineddata.gz','/robots.txt','/sitemap.xml','/privacy.html']) {
    const response = await request.get(path)
    expect(response.ok(), `${path} should return 2xx`).toBeTruthy()
  }
})

test('approved pilot session gives explicit local-save confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.getByRole('status')).toContainText(/تم اعتماد السجل/)
  const storage = await page.evaluate(() => ({
    session: sessionStorage.getItem('kamin-pilot-session-v2'),
    legacy: localStorage.getItem('kamin-pilot-v1')
  }))
  expect(storage.session).toContain('"approved":true')
  expect(storage.legacy).toBeNull()
})

test('value-first landing includes an explicitly fictional example', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /شاهد مثال/ }).click()
  await expect(page.locator('#example')).toContainText('من سطر في السيرة إلى قيمة لها دليل')
  await expect(page.locator('#example')).toContainText('مثال توضيحي لطالبة افتراضية')
  await expect(page.locator('#example')).toContainText('PMP')
  await expect(page.locator('#example')).toContainText('بعدها ستستطيع')
})

test('analysis consent is off by default and gates approval', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  const consent=page.getByRole('checkbox', { name: /أوافق صراحةً/ })
  await expect(consent).not.toBeChecked()
  await expect(page.getByRole('button', { name: /أعتمد السجل/ })).toBeDisabled()
  await consent.check()
  await expect(page.getByRole('button', { name: /أعتمد السجل/ })).toBeEnabled()
})

test('app dialog supports Escape and mobile usage log navigation', async ({ page }) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await expect(page.getByRole('button', { name: /سجل الاستخدام/ })).toBeVisible()
})


test('manifest uses installable PNG icons and local OCR assets are same-origin', async ({ request }) => {
  const manifestResponse=await request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBeTruthy()
  const manifest=await manifestResponse.json()
  expect(manifest.icons.map(icon=>icon.src)).toEqual(expect.arrayContaining(['/icon-192.png','/icon-512.png']))
  for(const icon of ['/icon-192.png','/icon-512.png']){
    const response=await request.get(icon)
    expect(response.ok()).toBeTruthy()
    expect(response.headers()['content-type']).toContain('image/png')
  }
  for(const asset of ['/ocr/worker.min.js','/ocr/lang/eng.traineddata.gz','/ocr/lang/ara.traineddata.gz']){
    const response=await request.get(asset)
    expect(response.ok(), asset).toBeTruthy()
  }
})

test('a failed upload path never injects demo courses', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  const input=page.locator('#kamin-transcript-file')
  await input.setInputFiles({name:'not-a-transcript.txt',mimeType:'text/plain',buffer:Buffer.from('hello world')})
  await expect(page.getByRole('alert')).toContainText(/لم نتعرف على مقررات/)
  await expect(page.getByText(/6 مقررات مستخرجة/)).toHaveCount(0)
})


test('public pilot does not present heuristic mastery or fit percentages as calibrated measurements', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.locator('.skill-row').first()).toContainText(/مرتفعة|متوسطة|محدودة|مبدئية/)
  await expect(page.locator('.metrics')).not.toContainText(/\d+%/)
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  await expect(page.locator('.fit-card').first()).toContainText(/النسبة مخفية حتى المعايرة البحثية/)
  expect((await page.locator('.fit-card').allTextContents()).join('\n')).not.toMatch(/\d+%/)
})


test('upload validation surfaces a non-binding SASCED academic context candidate', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  const input=page.locator('#kamin-transcript-file')
  await input.setInputFiles({
    name:'it-transcript.txt',
    mimeType:'text/plain',
    buffer:Buffer.from('بكالوريوس تقنية المعلومات\nCPIT 251 Systems Analysis and Design 3 A 15.00')
  })
  await expect(page.getByText(/SASCED-20/)).toBeVisible()
  await expect(page.getByText(/061303/).first()).toBeVisible()
  await expect(page.getByText(/لا يصبح تصنيفًا معتمدًا/)).toBeVisible()
})


test('approved demo surfaces Saudi national classification context without turning it into a skill', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.getByText(/التصنيف السعودي الموحد/)).toBeVisible()
  await expect(page.getByText('061303').first()).toBeVisible()
  await expect(page.getByText(/لا ينتج هذا التصنيف مهارة بحد ذاته/)).toBeVisible()
})


test('Person 360 is optional, structured, and available before transcript approval', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: 'بصمتي' }).first().click()
  await expect(page.getByText(/بصمتك قبل التوصية/)).toBeVisible()
  await expect(page.getByText(/لا يوجد تشخيص نفسي/)).toBeVisible()

  const consent=page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ })
  await expect(consent).not.toBeChecked()
  await consent.check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()

  await page.getByLabel('درجة هيكلة العمل').selectOption('balanced')
  await page.getByLabel('نمط التعاون').selectOption('small-team')
  await page.getByLabel('إيقاع العمل').selectOption('mixed')
  await expect(page.getByText(/مقاييس معيارية/)).toBeVisible()
  await expect(page.getByText(/O\*NET Mini Interest Profiler/)).toBeVisible()
  await expect(page.getByText(/IPIP 50 Big-Five/)).toBeVisible()

  const storage=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-pilot-session-v2')))
  expect(storage.consents.insight).toBe(true)
  expect(storage.insight.declaredPreferences.workStructure).toBe('balanced')
  expect(storage.insight.declaredPreferences.collaboration).toBe('small-team')
})

test('withdrawing Person 360 consent clears only the insight layer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: 'بصمتي' }).first().click()
  await page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ }).check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()
  await page.getByLabel('درجة هيكلة العمل').selectOption('structured')

  await page.getByRole('button', { name: /الخصوصية/ }).first().click()
  const insightConsent=page.getByRole('checkbox', { name: /بناء بصمة الطالب الذاتية/ })
  await expect(insightConsent).toBeChecked()
  await insightConsent.uncheck()

  const storage=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-pilot-session-v2')))
  expect(storage.consents.insight).toBe(false)
  expect(storage.insight.declaredPreferences).toEqual({})
})

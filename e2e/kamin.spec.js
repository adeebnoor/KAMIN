import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('Arabic core journey is usable and explainable', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('حوّل شهادتك ومشاريعك')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات (?:تجريبية|توضيحية)/ }).click()
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
  await expect(page.locator('h1')).toContainText('Turn your degree and projects')
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
  await expect(page.locator('img[src*="kamin-logo-fixed"]')).toHaveCount(0)
  await expect(page.locator('link[rel="alternate"][hreflang="ar-SA"]')).toHaveAttribute('href', /lang=ar/)
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /lang=en/)
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', /lang=ar/)
  await expect(page.locator('link[rel="icon"][type="image/png"][sizes="192x192"]')).toHaveAttribute('href', /icon-192\.png$/)
  await expect(page.locator('link[rel="icon"][type="image/png"][sizes="512x512"]')).toHaveAttribute('href', /icon-512\.png$/)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-kamin-1200x630\.jpg$/)

  for (const path of ['/favicon.ico','/favicon.svg','/manifest.webmanifest','/kamin-logo-v3.webp','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/og-kamin-1200x630.jpg','/ocr/worker.min.js','/ocr/lang/eng.traineddata.gz','/ocr/lang/ara.traineddata.gz','/robots.txt','/sitemap.xml','/privacy.html','/sample-report.html','/methodology.html','/trust.html','/ontology/kamin-context.jsonld']) {
    const response = await request.get(path)
    expect(response.ok(), `${path} should return 2xx`).toBeTruthy()
  }
})

test('approved Kamin session gives explicit local-save confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات (?:تجريبية|توضيحية)/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.getByRole('status')).toContainText(/تم اعتماد السجل/)
  const storage = await page.evaluate(() => ({
    session: sessionStorage.getItem('kamin-session-v3'),
    legacy: localStorage.getItem('kamin-pilot-v1')
  }))
  expect(storage.session).toContain('"approved":true')
  expect(storage.legacy).toBeNull()
})

test('proof-first landing exposes fictional evidence and transparent boundaries', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('#proof')).toContainText('ما الذي يعمل اليوم فعلًا؟')
  await expect(page.locator('#proof')).toContainText('لا ندّعيه بعد')
  await page.locator('#example').scrollIntoViewIfNeeded()
  await expect(page.locator('#example')).toContainText('مثال توضيحي لطالبة افتراضية')
  await expect(page.locator('#example')).toContainText('PMP')

  for (const path of ['/sample-report.html','/methodology.html','/trust.html','/interoperability.html']) {
    const response = await request.get(path)
    expect(response.ok(), `${path} should return 2xx`).toBeTruthy()
  }
})

test('analysis consent is off by default and gates approval', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات (?:تجريبية|توضيحية)/ }).click()
  const consent=page.getByRole('checkbox', { name: /أوافق صراحةً/ })
  await expect(consent).not.toBeChecked()
  await expect(page.getByRole('button', { name: /أعتمد السجل/ })).toBeDisabled()
  await consent.check()
  await expect(page.getByRole('button', { name: /أعتمد السجل/ })).toBeEnabled()
})

test('app dialog supports Escape and mobile usage log navigation', async ({ page }) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
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
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  const input=page.locator('#kamin-transcript-file')
  await input.setInputFiles({name:'not-a-transcript.txt',mimeType:'text/plain',buffer:Buffer.from('hello world')})
  await expect(page.getByRole('alert')).toContainText(/لم نتعرف على مقررات/)
  await expect(page.getByText(/6 مقررات مستخرجة/)).toHaveCount(0)
})


test('Kamin does not present heuristic mastery or fit percentages as calibrated measurements', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات (?:تجريبية|توضيحية)/ }).click()
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
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
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
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات (?:تجريبية|توضيحية)/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.getByText(/التصنيف السعودي الموحد/)).toBeVisible()
  await expect(page.getByText('061303').first()).toBeVisible()
  await expect(page.getByText(/لا ينتج هذا التصنيف مهارة بحد ذاته/)).toBeVisible()
})


test('Person 360 is optional, structured, and available before transcript approval', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
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
  await expect(page.getByText(/أدوات مرشحة للمعايرة السعودية/)).toBeVisible()
  await expect(page.getByText(/O\*NET Mini Interest Profiler/)).toBeVisible()
  await expect(page.getByText(/IPIP 50-item Big-Five/)).toBeVisible()

  const storage=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-session-v3')))
  expect(storage.consents.insight).toBe(true)
  expect(storage.insight.declaredPreferences.workStructure).toBe('balanced')
  expect(storage.insight.declaredPreferences.collaboration).toBe('small-team')
})

test('withdrawing Person 360 consent clears only the insight layer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: 'بصمتي' }).first().click()
  await page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ }).check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()
  await page.getByLabel('درجة هيكلة العمل').selectOption('structured')

  await page.getByRole('button', { name: /الخصوصية/ }).first().click()
  const insightConsent=page.getByRole('checkbox', { name: /بناء بصمة الطالب الذاتية/ })
  await expect(insightConsent).toBeChecked()
  await insightConsent.uncheck()

  const storage=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-session-v3')))
  expect(storage.consents.insight).toBe(false)
  expect(storage.insight.declaredPreferences).toEqual({})
})


test('canonical JSON-LD ontology context is published with verified namespaces', async ({ request }) => {
  const response=await request.get('/ontology/kamin-context.jsonld')
  expect(response.ok()).toBeTruthy()
  const payload=await response.json()
  const context=payload['@context']
  expect(context.ceterms).toBe('https://purl.org/ctdl/terms/')
  expect(context.ceasn).toBe('https://purl.org/ctdlasn/terms/')
  expect(context.elm).toBe('http://data.europa.eu/snb/model/ontology/')
  expect(context.prov).toBe('http://www.w3.org/ns/prov#')
  expect(context.Credential).toBe('ceterms:Credential')
  expect(context.Competency).toBe('ceasn:Competency')
})


test('Person 360 drives explainable job and training matches without a magic score', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: /بصمتي/ }).first().click()
  await page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ }).check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()
  await page.getByLabel('اهتمامي المهني الأقرب').selectOption('investigative')
  await page.getByLabel('قيمة العمل الأهم بالنسبة لي').selectOption('achievement')
  await page.getByLabel('درجة هيكلة العمل').selectOption('balanced')
  await page.getByRole('button', { name: /فرصي/ }).first().click()
  await expect(page.getByText(/فرصك المفسّرة/)).toBeVisible()
  await expect(page.getByText(/محلل بيانات/)).toBeVisible()
  await expect(page.getByText(/فجوات أو حدود/).first()).toBeVisible()
  await expect(page.locator('.match-explorer')).not.toContainText(/\d+%/)
  await expect(page.getByText(/غير معاير رقميًا/).first()).toBeVisible()
})

test('academic evidence can move a reference job from conditional to fits while psychometrics never override gaps', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات (?:تجريبية|توضيحية)/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await page.getByRole('button', { name: /الإدارة والمشاريع/ }).click()
  await page.getByRole('button', { name: /بصمتي/ }).first().click()
  await page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ }).check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()
  await page.getByLabel('اهتمامي المهني الأقرب').selectOption('enterprising')
  await page.getByRole('button', { name: /فرصي/ }).first().click()
  const card=page.locator('.match-card').filter({hasText:'منسق مشاريع تقنية'})
  await expect(card).toContainText(/تناسبك/)
  await expect(card).toContainText(/مهارات أساسية|الهدف الذي اخترته/)
})


test('legacy pilot session migrates once into Kamin 1.0 session storage', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    sessionStorage.clear()
    sessionStorage.setItem('kamin-pilot-session-v2', JSON.stringify({
      courses:[],
      approved:false,
      goal:'data',
      consents:{analyze:false,insight:false,advisor:false,research:false},
      insight:{version:'legacy',declaredPreferences:{workStructure:'balanced'}},
      audit:[]
    }))
  })
  await page.reload()
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  const storage=await page.evaluate(() => ({
    current:sessionStorage.getItem('kamin-session-v3'),
    legacy:sessionStorage.getItem('kamin-pilot-session-v2')
  }))
  expect(storage.current).toContain('"goal":"data"')
  expect(storage.legacy).toBeNull()
})


test('expert-review trust surfaces are honest and navigable', async ({ page }) => {
  await page.goto('/methodology.html?lang=ar')
  await expect(page.locator('h1')).toContainText('كيف ينتقل كامن من الدليل إلى الحكم؟')
  await expect(page.getByText(/Targets وليست Results/)).toBeVisible()
  await expect(page.getByText(/لا توجد أرقام دقة منشورة بعد/)).toBeVisible()

  await page.goto('/sample-report.html?lang=ar')
  await expect(page.locator('h1')).toContainText('سارة')
  await expect(page.getByText(/بيانات وهمية بالكامل/)).toBeVisible()
  await expect(page.getByText(/تناسبك بشروط/)).toBeVisible()
  await expect(page.getByText(/لا يوجد دليل معتمد في الملف الحالي/)).toBeVisible()

  await page.goto('/trust.html?lang=ar')
  await expect(page.locator('h1')).toContainText('الثقة آلية في المنتج')
  await expect(page.getByText(/لا تستخدم بيانات الجلسة لتدريب نموذج مركزي/)).toBeVisible()
})


test('encrypted local backup survives session loss and restores source-of-truth state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات (?:تجريبية|توضيحية)/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await page.getByRole('button', { name: /الخصوصية/ }).first().click()

  const pass='correct horse battery staple'
  await page.getByLabel('عبارة المرور', { exact:true }).fill(pass)
  await page.getByLabel(/تأكيد العبارة/).fill(pass)
  const downloadPromise=page.waitForEvent('download')
  await page.getByRole('button', { name: /تنزيل نسخة مشفّرة/ }).click()
  const download=await downloadPromise
  const backupPath=await download.path()
  expect(backupPath).toBeTruthy()

  await page.evaluate(()=>sessionStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: /استعد ملفك/ }).click()
  await page.getByLabel('عبارة المرور', { exact:true }).fill(pass)
  await page.locator('input[type="file"][accept*=".kamin"]').setInputFiles(backupPath)

  await expect(page.getByText(/هذه قدراتك/)).toBeVisible()
  const restored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-session-v3')))
  expect(restored.approved).toBe(true)
  expect(restored.courses.length).toBeGreaterThan(0)
  expect(restored.consents.analyze).toBe(true)
  expect(restored.consents.advisor).toBe(false)
  expect(restored.consents.research).toBe(false)
  expect(restored.audit[0].label).toMatch(/استعادة نسخة محلية مشفّرة/)
})

test('national positioning is complementary and makes no government integration claim', async ({ page, request }) => {
  const response=await request.get('/interoperability.html')
  expect(response.ok()).toBeTruthy()
  await page.goto('/interoperability.html?lang=ar')
  await expect(page.locator('h1')).toContainText('مكمّل للبنية الوطنية للمهارات')
  await expect(page.getByRole('heading', { name: 'منصة وطنية موازية' })).toBeVisible()
  await expect(page.getByText('لا نبني').first()).toBeVisible()
  await expect(page.getByText(/لا يوجد API أو اعتماد\/شراكة حكومية معلنة/)).toBeVisible()
  await expect(page.getByRole('heading', { name:'KAU-only' })).toBeVisible()
})

test('psychometric instruments are visibly research-only until Saudi validation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب ببيانات وهمية/ }).first().click()
  await page.getByRole('button', { name: 'بصمتي' }).first().click()
  await page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ }).check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()
  await expect(page.getByText(/لا تؤثر على Fit/)).toBeVisible()
  await expect(page.getByText(/research-candidate-saudi-validation-required/).first()).toBeVisible()
})

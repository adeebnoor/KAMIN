import { test, expect } from '@playwright/test'

async function openMoreTools(page){const more=page.getByRole('button',{name:'المزيد',exact:true});if(await more.isVisible())await more.click()}
import AxeBuilder from '@axe-core/playwright'

test('Arabic core journey is usable and explainable', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1:visible')).toContainText('افهم قدراتك.')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
  await expect(page.getByText(/مقررات مستخرجة/)).toBeVisible()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.getByText(/هذه قدراتك/)).toBeVisible()
  await openMoreTools(page)
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  await expect(page.getByText(/لا نرتب الدورات فقط/)).toBeVisible()
  await expect(page.getByText(/PMP/).first()).toBeVisible()
  await expect(page.getByText(/لا تناسبك الآن/).first()).toBeVisible()
})

test('language switch sets LTR English experience', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'التبديل إلى الإنجليزية' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('h1:visible')).toContainText('Understand your capabilities.')
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
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.json$/)
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('type', 'application/manifest+json')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /kamin/)
  await expect(page.locator('img[src*="kamin-logo-fixed"]')).toHaveCount(0)
  await expect(page.locator('link[rel="alternate"][hreflang="ar-SA"]')).toHaveAttribute('href', /\/ar\/$/)
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en\/$/)
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', /onrender\.com\/$/)
  await expect(page.locator('link[rel="icon"][type="image/png"][sizes="192x192"]')).toHaveAttribute('href', /icon-192\.png$/)
  await expect(page.locator('link[rel="icon"][type="image/png"][sizes="512x512"]')).toHaveAttribute('href', /icon-512\.png$/)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-kamin-ar\.jpg$/)

  for (const path of ['/favicon.ico','/favicon.svg','/manifest.json','/kamin-logo-v3.webp','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/og-kamin-1200x630.jpg','/ocr/worker.min.js','/ocr/lang/eng.traineddata.gz','/ocr/lang/ara.traineddata.gz','/robots.txt','/sitemap.xml','/privacy.html','/sample-report.html','/methodology.html','/trust.html','/ontology/kamin-context.jsonld','/knowledge/ict-kg-v1.jsonld','/faq.html','/mapping.html','/mapping/course-skill-map-v1.json','/mapping/course-skill-map.schema.json','/static-i18n.js','/404.html','/advisor.html','/admin.html','/validation.html','/stories.html']) {
    const response = await request.get(path)
    expect(response.ok(), `${path} should return 2xx`).toBeTruthy()
  }
})

test('approved Kamin session gives explicit local-save confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
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
  await expect(page.locator('#proof')).toContainText('ملف واحد. علاقات تكشف أكثر.')
  await expect(page.locator('#proof')).toContainText('المسارات أمثلة مرجعية')
  await page.locator('#home').scrollIntoViewIfNeeded()
  await expect(page.locator('#home')).toContainText('مثال تفاعلي · بيانات وهمية')
  await expect(page.locator('#person360')).toContainText('صلاحية التوصيات هنا تحتاج تحققًا مستقلًا')

  for (const path of ['/sample-report.html','/methodology.html','/trust.html','/interoperability.html']) {
    const response = await request.get(path)
    expect(response.ok(), `${path} should return 2xx`).toBeTruthy()
  }
})

test('analysis consent is off by default and gates approval', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
  const consent=page.getByRole('checkbox', { name: /أوافق صراحةً/ })
  await expect(consent).not.toBeChecked()
  await expect(page.getByRole('button', { name: /أعتمد السجل/ })).toBeDisabled()
  await consent.check()
  await expect(page.getByRole('button', { name: /أعتمد السجل/ })).toBeEnabled()
})

test('app dialog supports Escape and mobile usage log navigation', async ({ page }) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await openMoreTools(page)
  await expect(page.getByRole('button', { name: /سجل الاستخدام/ })).toBeVisible()
})


test('manifest uses installable PNG icons and local OCR assets are same-origin', async ({ request }) => {
  const manifestResponse=await request.get('/manifest.json')
  expect(manifestResponse.ok()).toBeTruthy()
  expect(manifestResponse.headers()['content-type']).not.toContain('octet-stream')
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
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  const input=page.locator('#kamin-transcript-file')
  await input.setInputFiles({name:'not-a-transcript.txt',mimeType:'text/plain',buffer:Buffer.from('hello world')})
  await expect(page.getByRole('alert')).toContainText(/لم نتعرف على مقررات/)
  await expect(page.getByText(/6 مقررات مستخرجة/)).toHaveCount(0)
})


test('Kamin does not present heuristic mastery or fit percentages as calibrated measurements', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.locator('.skill-row').first()).toContainText(/مرتفعة|متوسطة|محدودة|مبدئية/)
  await expect(page.locator('.metrics')).not.toContainText(/\d+%/)
  await openMoreTools(page)
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  await expect(page.locator('.fit-card').first()).toContainText(/النسبة مخفية حتى المعايرة البحثية/)
  expect((await page.locator('.fit-card').allTextContents()).join('\n')).not.toMatch(/\d+%/)
})


test('upload validation surfaces a non-binding SASCED academic context candidate', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
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
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.getByText(/التصنيف السعودي الموحد/)).toBeVisible()
  await expect(page.getByText('061303').first()).toBeVisible()
  await expect(page.getByText(/لا ينتج هذا التصنيف مهارة بحد ذاته/)).toBeVisible()
})


test('Person 360 is optional, structured, and available before transcript approval', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('button', { name: 'اهتماماتي وهدفي' }).first().click()
  await expect(page.getByText(/اهتماماتك بداية الشبكة/)).toBeVisible()
  await expect(page.getByText(/ليست اختبارًا أو تشخيصًا نفسيًا/)).toBeVisible()

  const consent=page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ })
  await expect(consent).not.toBeChecked()
  await consent.check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()

  await page.locator('.optional-preferences > summary').click()
  await page.getByLabel('درجة هيكلة العمل').selectOption('balanced')
  await page.getByLabel('نمط التعاون').selectOption('small-team')
  await page.getByLabel('إيقاع العمل').selectOption('mixed')
  await page.getByText('المقاييس النفسية والبحثية وحدود استخدامها',{exact:true}).click()
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
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('button', { name: 'اهتماماتي وهدفي' }).first().click()
  await page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ }).check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()
  await page.locator('.optional-preferences > summary').click()
  await page.getByLabel('درجة هيكلة العمل').selectOption('structured')
  await page.locator('input[type="radio"][name="goal"][value="data"]').check()

  await page.getByRole('button', { name: /الخصوصية/ }).first().click()
  const insightConsent=page.getByRole('checkbox', { name: /بناء بصمة الطالب الذاتية/ })
  await expect(insightConsent).toBeChecked()
  await insightConsent.uncheck()

  const storage=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-session-v3')))
  expect(storage.consents.insight).toBe(false)
  expect(storage.insight.declaredPreferences).toEqual({})
  expect(storage.goal).toBeNull()
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
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('button', { name: /اهتماماتي وهدفي/ }).first().click()
  await page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ }).check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()
  await page.locator('input[type="radio"][name="careerInterest"][value="investigative"]').check()
  await page.locator('.optional-preferences > summary').click()
  await page.getByLabel('قيمة العمل الأهم بالنسبة لي').selectOption('achievement')
  await page.getByLabel('درجة هيكلة العمل').selectOption('balanced')
  await page.getByRole('button', { name: /فرصي/ }).first().click()
  await expect(page.getByText(/فرصك المفسّرة/)).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('heading',{name:'محلل بيانات',exact:true})).toBeVisible()
  await expect(page.getByText(/فجوات أو حدود/).first()).toBeVisible()
  await expect(page.locator('.match-explorer')).not.toContainText(/\d+%/)
  await expect(page.getByText(/غير معاير رقميًا/).first()).toBeVisible()
})

test('academic evidence can move a reference job from conditional to fits while psychometrics never override gaps', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await page.getByRole('button', { name: /الإدارة والمشاريع/ }).click()
  await page.getByRole('button', { name: /اهتماماتي وهدفي/ }).first().click()
  await page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ }).check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()
  await page.locator('input[type="radio"][name="careerInterest"][value="enterprising"]').check()
  await page.getByRole('button', { name: /فرصي/ }).first().click()
  const card=page.locator('.match-card').filter({hasText:'منسق مشاريع تقنية'})
  await expect(card).toContainText(/تناسبك/)
  await expect(card).toContainText(/مسار دليل صالح|هدفك المصرح به/)
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
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  const storage=await page.evaluate(() => ({
    current:sessionStorage.getItem('kamin-session-v3'),
    legacy:sessionStorage.getItem('kamin-pilot-session-v2')
  }))
  expect(storage.current).toContain('"goal":"data"')
  expect(storage.legacy).toBeNull()
})


test('expert-review trust surfaces are honest and navigable', async ({ page }) => {
  await page.goto('/methodology.html?lang=ar')
  await expect(page.locator('h1:visible')).toContainText('كيف ينتقل كامن من الدليل إلى الحكم؟')
  await expect(page.getByText(/Targets وليست Results/)).toBeVisible()
  await expect(page.getByText(/لا توجد أرقام دقة منشورة بعد/)).toBeVisible()

  await page.goto('/sample-report.html?lang=ar')
  await expect(page.locator('h1:visible')).toContainText('سارة')
  await expect(page.getByText(/بيانات وهمية بالكامل/)).toBeVisible()
  await expect(page.getByText(/تناسبك بشروط/)).toBeVisible()
  await expect(page.getByText(/لا يوجد دليل معتمد في الملف الحالي/)).toBeVisible()

  await page.goto('/trust.html?lang=ar')
  await expect(page.locator('h1:visible')).toContainText('الثقة آلية في المنتج')
  await expect(page.getByText(/حفظ محلي باختيارك/)).toBeVisible()
})


test('encrypted local backup survives session loss and restores source-of-truth state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
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
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
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
  await expect(page.locator('h1:visible')).toContainText('مكمّل للبنية الوطنية للمهارات')
  await expect(page.getByRole('heading', { name: 'منصة وطنية موازية' })).toBeVisible()
  await expect(page.getByText('لا نبني').first()).toBeVisible()
  await expect(page.getByText(/لا يوجد API أو اعتماد\/شراكة حكومية معلنة/)).toBeVisible()
  await expect(page.getByRole('heading', { name:'KAU-only' })).toBeVisible()
})

test('psychometric instruments are visibly research-only until Saudi validation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('button', { name: 'اهتماماتي وهدفي' }).first().click()
  await page.getByRole('checkbox', { name: /أوافق على بناء ملف Person 360/ }).check()
  await page.getByRole('button', { name: /ابدأ بصمتي/ }).click()
  await page.getByText('المقاييس النفسية والبحثية وحدود استخدامها',{exact:true}).click()
  await expect(page.getByText(/لا تؤثر على الملاءمة/)).toBeVisible()
  await expect(page.getByText(/research-candidate-saudi-validation-required/).first()).toBeVisible()
})


test('transcript entry preserves local OCR, inline trust, camera capture and an interests alternative', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()

  await expect(page.locator('.onboarding-upload')).toHaveCount(1)
  await expect(page.locator('.onboarding-upload')).toContainText(/ارفع كشف الدرجات/)
  await expect(page.locator('.inline-trust')).toContainText(/لا يغادر جهازك/)
  await expect(page.getByRole('link', { name:/شاهد التقرير التوضيحي أولًا/ })).toHaveAttribute('href', /sample-report/)
  await expect(page.getByRole('button', { name:/أو أدخل يدويًا/ })).toBeVisible()

  const camera=page.locator('#kamin-transcript-camera')
  await expect(camera).toHaveAttribute('accept','image/*')
  await expect(camera).toHaveAttribute('capture','environment')
})

test('opt-in IndexedDB profile survives session loss and returns on the same device', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()

  await page.getByRole('button', { name:/نعم، احتفظ بملفي/ }).click()
  await expect(page.getByText(/محفوظ محليًا على هذا الجهاز/)).toBeVisible()

  const persisted=await page.evaluate(async()=>{
    const open=indexedDB.open('kamin-local-profile-v1',1)
    const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error)})
    const tx=db.transaction('profiles','readonly')
    const req=tx.objectStore('profiles').get('current')
    const value=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
    db.close()
    return value
  })
  expect(persisted.state.approved).toBe(true)
  expect(persisted.state.localPersistence).toBe(true)

  await page.evaluate(()=>sessionStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await expect(page.getByText(/هذه قدراتك/)).toBeVisible()
  await expect(page.getByText(/أعدنا ملفك المحفوظ محليًا/)).toBeVisible()
})

test('clear my data removes session and IndexedDB profile residue', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await page.getByRole('button', { name:/نعم، احتفظ بملفي/ }).click()

  await page.getByRole('button', { name:/الخصوصية/ }).first().click()
  await expect(page.getByText(/ما المخزن عنك الآن؟/)).toBeVisible()
  await page.getByRole('button', { name:/حذف بياناتي/ }).click()
  await page.getByRole('button', { name:/نعم، احذف/ }).click()
  await expect(page.locator('.onboarding-upload')).toBeVisible()

  const residue=await page.evaluate(async()=>{
    await new Promise(resolve=>setTimeout(resolve,50))
    const dbNames=typeof indexedDB.databases==='function' ? (await indexedDB.databases()).map(db=>db.name) : []
    return {
      session:sessionStorage.getItem('kamin-session-v3'),
      legacySession:sessionStorage.getItem('kamin-pilot-session-v2'),
      legacyLocal:localStorage.getItem('kamin-pilot-v1'),
      hasProfileDb:dbNames.includes('kamin-local-profile-v1'),
    }
  })
  expect(residue.session).toBeNull()
  expect(residue.legacySession).toBeNull()
  expect(residue.legacyLocal).toBeNull()
  expect(residue.hasProfileDb).toBe(false)
})


test('Matches exposes Person360 semantic evidence paths', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await page.getByRole('button', { name: /فرصي/ }).first().click()

  const dataCard=page.locator('article.match-card').filter({hasText:'محلل بيانات'})
  await expect(dataCard).toBeVisible()
  await expect(dataCard).toContainText('مسار الدليل في الشبكة')
  await expect(dataCard).toContainText('CPIT-260')
  await expect(dataCard).toContainText('STAT-201')
  await expect(dataCard).toContainText('kamin-graph-fit-v1')
})


test('Data Analyst golden path exposes external knowledge and learning bridges', async ({ page, request }) => {
  const graphResponse=await request.get('/knowledge/ict-kg-v1.jsonld')
  expect(graphResponse.ok()).toBeTruthy()
  const graph=await graphResponse.json()
  expect(graph.version).toBe('kamin-ict-kg-v1')
  expect(graph.entities.some(entity=>entity['@id']==='http://data.europa.eu/esco/occupation/d3edb8f8-3a06-47a0-8fb9-9b212c006aa2')).toBe(true)

  await page.goto('/')
  await page.getByRole('button', { name: /جرّب المثال التوضيحي/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /جرّب المثال التوضيحي/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await page.getByRole('button', { name: /فرصي/ }).first().click()

  const card=page.locator('article.match-card').filter({hasText:'محلل بيانات'})
  await expect(card).toBeVisible()
  await expect(card).toContainText('CPIT-260')
  await expect(card).toContainText('STAT-201')
  await expect(card).toContainText('ESCO 2511.3')
  await expect(card).toContainText('O*NET-SOC 15-2051.01')
  await expect(card).toContainText('إشارات تطويرية — لا تغيّر حكم الملاءمة')
  await expect(card).toContainText('Python')
  await expect(card).toContainText('Power BI')
  await expect(card).toContainText('الجسر التالي المقترح')
  await expect(card).toContainText('مختبر Python للتحليل')
  await expect(card).not.toContainText(/\d+%/)
})


test('static routes honor URL, stored preference, and bilingual direction', async ({ page }) => {
  const routes=[
    ['/sample-report.html','Sara · Information Systems graduate'],
    ['/methodology.html','How does Kamin move from evidence to judgment?'],
    ['/trust.html','Trust is a product mechanism'],
    ['/interoperability.html','Kamin complements national skills infrastructure'],
    ['/privacy.html','Privacy Policy — Kamin'],
    ['/faq.html','Questions before you trust a recommendation'],
    ['/mapping.html','A course does not become a skill'],
  ]
  for(const [route,heading] of routes){
    await page.goto(route+'?lang=en')
    await expect(page.locator('html')).toHaveAttribute('lang','en')
    await expect(page.locator('html')).toHaveAttribute('dir','ltr')
    await expect(page.locator('h1:visible')).toContainText(heading)
  }

  await page.goto('/?lang=en')
  await page.evaluate(()=>localStorage.setItem('kamin-lang','en'))
  await page.goto('/trust.html')
  await expect(page.locator('html')).toHaveAttribute('lang','en')
  await expect(page.locator('html')).toHaveAttribute('dir','ltr')
  await expect(page.locator('h1:visible').first()).toContainText('Trust is a product mechanism')

  await page.goto('/privacy.html?lang=ar')
  await expect(page.locator('html')).toHaveAttribute('lang','ar')
  await expect(page.locator('html')).toHaveAttribute('dir','rtl')
  await expect(page.locator('h1:visible').first()).toContainText('سياسة الخصوصية')
})

test('static internal links preserve the resolved language', async ({ page }) => {
  await page.goto('/trust.html?lang=en')
  await expect(page.getByRole('link',{name:'Privacy policy'})).toHaveAttribute('href',/privacy\.html\?lang=en/)
  await expect(page.getByRole('link',{name:'Methodology'})).toHaveAttribute('href',/methodology\.html\?lang=en/)

  await page.goto('/?lang=en')
  await expect(page.getByRole('contentinfo').getByRole('link',{name:'Privacy'})).toHaveAttribute('href',/privacy\.html\?lang=en/)
  await expect(page.getByRole('contentinfo').getByRole('link',{name:'FAQ'})).toHaveAttribute('href',/faq\.html\?lang=en/)
})

test('closing the app fully tears down the overlay and the primary CTA immediately works again', async ({ page }) => {
  await page.goto('/')
  const cta=page.getByRole('button',{name:/جرّب المثال التوضيحي/}).first()
  await cta.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(cta).toBeFocused()
  await cta.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('zero-evidence approved profile does not receive a next-decision judgment', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{name:/جرّب المثال التوضيحي/}).first().click()
  await page.getByRole('button',{name:/أو أدخل يدويًا/}).click()
  await page.getByRole('button',{name:/إضافة مقرر يدويًا/}).click()
  await page.getByLabel('رمز المقرر').fill('GEN-999')
  await page.getByLabel('اسم المقرر').fill('Unmapped Seminar')
  await page.getByLabel('الدرجة').fill('A')
  await page.getByRole('button',{name:'حفظ'}).click()
  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await page.getByRole('button',{name:/أعتمد السجل/}).click()

  await expect(page.locator('.decision-locked')).toContainText(/أضف أو اعتمد مقررًا مرتبطًا بقدرة/)
  await expect(page.locator('.decision-locked')).not.toContainText(/تناسبك بشروط|لا تناسبك الآن/)
  await expect(page.locator('.metrics')).toContainText(/أضف دليلًا معتمدًا أولًا/)
})

test('locked navigation explains how to unlock protected sections', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{name:/جرّب المثال التوضيحي/}).first().click()
  await openMoreTools(page)
  const dashboard=page.locator('button[title*="اعتمد سجلًا أولًا"]:visible').first()
  await expect(dashboard).toBeVisible()
  await expect(dashboard).toBeDisabled()
  await expect(dashboard).toHaveAttribute('title',/اعتمد سجلًا أولًا/)
})

test('next decision excludes courses that only repeat already evidenced capability', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{name:/جرّب المثال التوضيحي/}).first().click()
  await page.getByRole('dialog').getByRole('button',{name:/جرّب المثال التوضيحي/}).click()
  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await page.getByRole('button',{name:/أعتمد السجل/}).click()
  await page.getByRole('button',{name:/تحليل البيانات/}).click()
  const decision=page.locator('.decision').filter({hasText:'القرار التالي'})
  await expect(decision).toBeVisible()
  await expect(decision).not.toContainText('SQL للمحللين')
})

test('gap copy uses human capability labels and never leaks the raw cyber token', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{name:/جرّب المثال التوضيحي/}).first().click()
  await page.getByRole('button',{name:/فرصي/}).first().click()
  const card=page.locator('.match-card').filter({hasText:'محلل أمن سيبراني مبتدئ'})
  await expect(card).toContainText('أساسيات الأمن السيبراني')
  await expect(card).not.toContainText(/إلى:\s*cyber\b/)
})

test('mapping coverage and governed adapter artefacts are public and consistent', async ({ page, request }) => {
  const catalogueResponse=await request.get('/mapping/course-skill-map-v1.json')
  const schemaResponse=await request.get('/mapping/course-skill-map.schema.json')
  expect(catalogueResponse.ok()).toBeTruthy()
  expect(schemaResponse.ok()).toBeTruthy()
  const catalogue=await catalogueResponse.json()
  expect(catalogue.version).toBe('kamin-course-skill-map-v1')
  expect(Object.keys(catalogue.mappings)).toEqual(expect.arrayContaining(['CPIT-251','CPIT-260','CPIT-499']))

  await page.goto('/')
  await page.getByRole('button',{name:/جرّب المثال التوضيحي/}).first().click()
  await page.getByRole('dialog').getByRole('button',{name:/جرّب المثال التوضيحي/}).click()
  await expect(page.locator('.mapping-coverage')).toContainText('6/6')
  await expect(page.getByRole('link',{name:'منهجية الربط'})).toHaveAttribute('href',/mapping\.html\?lang=ar/)
})

test('Arabic audit timestamps use Arabic locale formatting', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{name:/جرّب المثال التوضيحي/}).first().click()
  await openMoreTools(page)
  await page.getByRole('button',{name:/سجل الاستخدام/}).first().click()
  const timestamp=page.locator('.audit-item small').first()
  if(await timestamp.count()) await expect(timestamp).toContainText(/[٠-٩]/)
})

test('dedicated FAQ and branded 404 assets are shipped', async ({ page, request }) => {
  expect((await request.get('/faq.html')).ok()).toBeTruthy()
  expect((await request.get('/404.html')).ok()).toBeTruthy()
  await page.goto('/faq.html?lang=en')
  await expect(page.locator('h1:visible')).toContainText('Questions before you trust a recommendation')
  await page.goto('/404.html?lang=ar')
  await expect(page.locator('h1:visible')).toContainText('هذه الصفحة غير موجودة')
})


test('BRD visibility surfaces are public and explicitly non-operational where required', async ({ page, request }) => {
  for(const path of ['/advisor.html','/admin.html','/validation.html','/stories.html']){
    const response=await request.get(path)
    expect(response.ok(), path).toBeTruthy()
  }

  await page.goto('/advisor.html?lang=ar')
  await expect(page.locator('h1:visible')).toContainText('ماذا يرى المرشد')
  await expect(page.getByText(/لا توجد مشاركة فعلية/).first()).toBeVisible()

  await page.goto('/admin.html?lang=ar')
  await expect(page.locator('h1:visible')).toContainText('لوحة الإدارة')
  await expect(page.getByText(/لا توجد cohort analytics حقيقية/)).toBeVisible()

  await page.goto('/stories.html?lang=ar')
  await expect(page.getByText(/0 قصص حقيقية منشورة حاليًا/)).toBeVisible()
  await expect(page.getByText(/لن ننشر قصة حقيقية قبل وجود موافقة حقيقية/)).toBeVisible()
})

test('validation page resolves prototype decisions without inventing research results', async ({ page }) => {
  await page.goto('/validation.html?lang=ar')
  const ar=page.locator('[data-kamin-lang="ar"]:visible')
  await expect(page.locator('h1:visible')).toContainText('ما حُسم، وما بقي بحثيًا')
  await expect(ar.locator('b').filter({hasText:/^D-05$/})).toBeVisible()
  await expect(ar.getByText(/قسم تقنية المعلومات/)).toBeVisible()
  await expect(ar.locator('b').filter({hasText:/^D-01$/})).toBeVisible()
  await expect(ar.getByText(/لا يوجد نموذج عربي توليدي/)).toBeVisible()
  await expect(ar.locator('b').filter({hasText:/^H3$/})).toBeVisible()
  await expect(ar.getByText(/خطة — لا نتائج/).first()).toBeVisible()
  await expect(ar.locator('b').filter({hasText:/^H4$/})).toBeVisible()
  await expect(ar.getByText(/لا تدعي وجود موافقة أخلاقية/)).toBeVisible()
})

test('FR-09 what-changed message appears after deposit and approval', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{name:/جرّب المثال التوضيحي/}).first().click()
  await page.getByRole('dialog').getByRole('button',{name:/جرّب المثال التوضيحي/}).click()
  await expect(page.locator('.what-changed')).toContainText(/ما الذي تغيّر بعد الإيداع/)
  await expect(page.locator('.what-changed')).toContainText(/6 مقرر/)

  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await page.getByRole('button',{name:/أعتمد السجل/}).click()
  await expect(page.locator('.what-changed')).toContainText(/ما الذي تغيّر بعد الاعتماد/)
  await expect(page.locator('.what-changed')).toContainText(/5 قدرة/)
})

test('FR-09 what-changed message appears after transcript consent withdrawal', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{name:/جرّب المثال التوضيحي/}).first().click()
  await page.getByRole('dialog').getByRole('button',{name:/جرّب المثال التوضيحي/}).click()
  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await page.getByRole('button',{name:/أعتمد السجل/}).click()
  await page.getByRole('button',{name:/الخصوصية/}).first().click()
  const analyze=page.getByRole('checkbox',{name:/تحليل السجل وبناء ملف المهارات/})
  await expect(analyze).toBeChecked()
  await analyze.uncheck()
  await expect(page.locator('.what-changed')).toContainText(/ما الذي تغيّر بعد سحب موافقة السجل/)
  await expect(page.locator('.what-changed')).toContainText(/6 مقرر/)
  await expect(page.locator('.what-changed')).toContainText(/5 قدرة/)
})

test('skill cards surface governed evidence level beside evidence strength', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{name:/جرّب المثال التوضيحي/}).first().click()
  await page.getByRole('dialog').getByRole('button',{name:/جرّب المثال التوضيحي/}).click()
  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await page.getByRole('button',{name:/أعتمد السجل/}).click()
  await openMoreTools(page)
  await page.getByRole('button',{name:/مهاراتي/}).first().click()
  const card=page.locator('.skill-card').first()
  await expect(card).toContainText('مستوى الإثبات')
  await expect(card).toContainText('ربط محكوم')
})

test('public sample makes three-course comparison capability discoverable', async ({ page }) => {
  await page.goto('/sample-report.html?lang=ar')
  await expect(page.getByRole('heading',{name:/مقارنة 3 مسارات تعلم/})).toBeVisible()
  await expect(page.getByRole('columnheader',{name:'SQL للمحللين'})).toBeVisible()
  await expect(page.getByRole('columnheader',{name:'Python للتحليل'})).toBeVisible()
  await expect(page.getByRole('columnheader',{name:'BI Dashboard'})).toBeVisible()
})

test('privacy page explains that hosting serves assets but does not receive transcript bytes', async ({ page }) => {
  await page.goto('/privacy.html?lang=ar')
  await expect(page.getByText(/الخادم المستضيف يقدّم ملفات الموقع وJavaScript وملفات OCR فقط/)).toBeVisible()
  await expect(page.getByText(/يُقرأ كـbytes داخل المتصفح/)).toBeVisible()
})

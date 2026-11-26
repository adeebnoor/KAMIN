// Task 70: the old interface (its landing page, workspace window, menu and panels) is deleted. The public-page tests
// below are unchanged; the app tests that check something no other test checks are rewritten on the interface (at the
// end of the file); the others are deleted, each mapped to the test that covers it in log/task-70.md.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { kamin } from './roles.js'

const session = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3')))
const deviceProfile = page => page.evaluate(async () => {
  const open = indexedDB.open('kamin-local-profile-v1', 1)
  const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error) })
  const req = db.transaction('profiles', 'readonly').objectStore('profiles').get('current')
  const value = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
  db.close()
  return value
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

test('ontology 0.4.0 and its SHACL shapes are published, and the 0.3.0 files still resolve', async ({ request }) => {
  for (const [path, version] of [['/ontology/kamin-core.ttl','0.4.0'],['/ontology/0.4.0/kamin-core.ttl','0.4.0'],['/ontology/0.3.0/kamin-core.ttl','0.3.0']]) {
    const response=await request.get(path)
    expect(response.ok(),path).toBeTruthy()
    expect(await response.text(),path).toContain(`owl:versionInfo "${version}"`)
  }
  for (const path of ['/ontology/kamin-shapes.ttl','/ontology/0.4.0/kamin-shapes.ttl','/ontology/0.3.0/kamin-shapes.ttl']) {
    const response=await request.get(path)
    expect(response.ok(),path).toBeTruthy()
    expect(await response.text(),path).toContain('kamin:ClaimShape')
  }
  expect(await (await request.get('/ontology/kamin-shapes.ttl')).text()).toContain('kamin:EvidenceClaimShape')
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
  await expect(page.getByRole('link',{name:'Privacy policy'})).toHaveAttribute('href',/\/en\/privacy\.html/)
  await expect(page.getByRole('main').getByRole('link',{name:'Methodology',exact:true})).toHaveAttribute('href',/\/en\/methodology\.html/)

  await page.goto('/?lang=en')
  await expect(page.getByRole('contentinfo').getByRole('link',{name:'Privacy'})).toHaveAttribute('href',/\/en\/privacy\.html/)
  // Task 70: Home's footer (Task 68) links six public pages; FAQ is not one of them. Every page link keeps /en/.
  const pages=await page.getByRole('contentinfo').locator('a[href$=".html"]').evaluateAll(links=>links.map(a=>new URL(a.href).pathname))
  expect(pages.length).toBeGreaterThan(3)
  for(const path of pages) expect(path).toMatch(/^\/en\//)
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
  await expect(ar.locator('b').filter({hasText:/^01$/})).toBeVisible()
  await expect(ar.getByText(/قسم تقنية المعلومات/)).toBeVisible()
  await expect(ar.locator('b').filter({hasText:/^02$/})).toBeVisible()
  await expect(ar.getByText(/لا يوجد نموذج عربي توليدي/)).toBeVisible()
  await expect(ar.locator('b').filter({hasText:/^03$/})).toBeVisible()
  await expect(ar.getByText(/خطة — لا نتائج/).first()).toBeVisible()
  await expect(ar.locator('b').filter({hasText:/^04$/})).toBeVisible()
  await expect(ar.getByText(/لا تدعي وجود موافقة أخلاقية/)).toBeVisible()
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

test('proof-first landing exposes fictional evidence and transparent boundaries', async ({ page, request }) => {
  // Task 14: the service overview moved to services.html. Task 70: the old landing's quick tour is deleted with it.
  await page.goto('/ar/services.html')
  await expect(page.locator('#services-proof')).toContainText('ملف واحد. علاقات تكشف أكثر.')
  await expect(page.locator('#services-proof')).toContainText('المسارات أمثلة مرجعية')
  // Task 14: the idea behind Kamin moved to about.html#idea.
  await page.goto('/ar/about.html')
  await expect(page.locator('#idea')).toContainText('صلاحية التوصيات هنا تحتاج تحققًا مستقلًا')

  for (const path of ['/sample-report.html','/methodology.html','/trust.html','/interoperability.html']) {
    const response = await request.get(path)
    expect(response.ok(), `${path} should return 2xx`).toBeTruthy()
  }
})

test('the ICT knowledge graph behind the Data Analyst pathway is published', async ({ request }) => {
  // Task 70: the old match card that showed it is deleted; the pathway's evidence is step 4 (K05, K06).
  const graphResponse=await request.get('/knowledge/ict-kg-v1.jsonld')
  expect(graphResponse.ok()).toBeTruthy()
  const graph=await graphResponse.json()
  expect(graph.version).toBe('kamin-ict-kg-v1')
  expect(graph.entities.some(entity=>entity['@id']==='http://data.europa.eu/esco/occupation/d3edb8f8-3a06-47a0-8fb9-9b212c006aa2')).toBe(true)
})

test('mapping coverage and governed adapter artefacts are public and consistent', async ({ request }) => {
  // Task 70: the old upload window's coverage line is deleted with it; step 1 says how many lines were read (K02).
  const catalogueResponse=await request.get('/mapping/course-skill-map-v1.json')
  const schemaResponse=await request.get('/mapping/course-skill-map.schema.json')
  expect(catalogueResponse.ok()).toBeTruthy()
  expect(schemaResponse.ok()).toBeTruthy()
  const catalogue=await catalogueResponse.json()
  expect(catalogue.version).toBe('kamin-course-skill-map-v1')
  expect(Object.keys(catalogue.mappings)).toEqual(expect.arrayContaining(['CPIT-251','CPIT-240','CPIT-499']))
})

// ===== Rewritten on the interface (Task 70) =====

test('language switch sets LTR English experience', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.home()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await app.switchLanguage()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('Home has no serious or critical axe violations', async ({ page }) => {
  await kamin(page, { ui: 'new', lang: 'ar' }).home()
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter(v => ['serious', 'critical'].includes(v.impact))
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
})

test('approved Kamin session gives explicit local-save confirmation', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.sample()
  // Task 25: no toast after approval; the one message on My plan offers to keep the profile on this device.
  await app.openOfferMessage()
  await expect(app.main().getByTestId('ui2-save-offer')).toContainText('ملفك مؤقت في هذه الجلسة. هل تريد الاحتفاظ به على هذا الجهاز؟')
  await expect(app.main().getByRole('button', { name: 'نعم، احتفظ بملفي', exact: true })).toBeVisible()
  const storage = await page.evaluate(() => ({ session: sessionStorage.getItem('kamin-session-v3'), legacy: localStorage.getItem('kamin-pilot-v1') }))
  expect(storage.session).toContain('"approved":true')
  expect(storage.legacy).toBeNull()
})

test('a failed upload path never injects demo courses', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.home()
  await app.openUpload()
  await page.locator('#ui2-transcript-file').setInputFiles({ name: 'not-a-transcript.txt', mimeType: 'text/plain', buffer: Buffer.from('hello world') })
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await session(page))?.courses || []).toEqual([])
  await expect(app.approveButton()).toHaveCount(0)
})

test('withdrawing Person 360 consent clears only the insight layer', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.goToView('interests')
  await app.click(app.interestsConsent(), 'interests consent')
  await app.openGoals()
  await app.chooseGoal('data')
  expect((await session(page)).goals.length).toBeGreaterThan(0)
  await app.openConsents()
  await expect(app.consent('insight')).toBeChecked()
  await app.withdraw('insight')
  const storage = await session(page)
  expect(storage.consents.insight).toBe(false)
  expect(storage.insight.declaredPreferences).toEqual({})
  expect(storage.goal).toBeNull()
})

test('legacy pilot session migrates once into Kamin 1.0 session storage', async ({ page }) => {
  await page.goto('/ar/')
  await page.evaluate(() => {
    sessionStorage.clear()
    sessionStorage.setItem('kamin-pilot-session-v2', JSON.stringify({
      courses:[], approved:false, goal:'data',
      consents:{analyze:false,insight:false,advisor:false,research:false},
      insight:{version:'legacy',declaredPreferences:{workStructure:'balanced'}},
      audit:[],
    }))
  })
  await page.reload()
  await expect(page.getByRole('main')).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('kamin-session-v3'))).toContain('"goal":"data"')
  expect(await page.evaluate(() => sessionStorage.getItem('kamin-pilot-session-v2'))).toBeNull()
})

test('encrypted local backup survives session loss and restores source-of-truth state', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.sample()
  const pass = 'correct horse battery staple'
  const download = await app.downloadBackup(pass)
  const backupPath = await download.path()
  expect(backupPath).toBeTruthy()
  await page.evaluate(() => sessionStorage.clear())
  await app.home()
  await app.restoreBackup(backupPath, pass)
  await expect(app.capabilityRows().first()).toBeVisible()
  const restored = await session(page)
  expect(restored.approved).toBe(true)
  expect(restored.courses.length).toBeGreaterThan(0)
  expect(restored.consents.analyze).toBe(true)
  expect(restored.consents.advisor).toBe(false)
  expect(restored.consents.research).toBe(false)
  expect(restored.audit[0].label).toMatch(/استعادة نسخة محلية مشفّرة/)
})

test('opt-in IndexedDB profile survives session loss and returns on the same device', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.sample()
  await app.openSaveOffer()
  await app.keepOnDevice()
  await expect(app.saveStatus()).toHaveText(app.c.app.savedOnDevice)
  const persisted = await deviceProfile(page)
  expect(persisted.state.approved).toBe(true)
  expect(persisted.state.localPersistence).toBe(true)
  await page.evaluate(() => sessionStorage.clear())
  await app.home()
  await app.openCapabilities()
  await expect(app.capabilityRows().first()).toBeVisible()
  expect((await session(page)).approved).toBe(true)
})

test('clear my data removes session and IndexedDB profile residue', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.sample()
  await app.openSaveOffer()
  await app.keepOnDevice()
  await expect(app.saveStatus()).toHaveText(app.c.app.savedOnDevice)
  await app.askDeleteEverything()
  await app.confirmDeleteEverything()
  await expect(app.deletedConfirmation()).toBeVisible()
  const residue = await page.evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 50))
    const dbNames = typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map(db => db.name) : []
    return {
      session: sessionStorage.getItem('kamin-session-v3'),
      legacySession: sessionStorage.getItem('kamin-pilot-session-v2'),
      legacyLocal: localStorage.getItem('kamin-pilot-v1'),
      hasProfileDb: dbNames.includes('kamin-local-profile-v1'),
    }
  })
  expect(residue.session).toBeNull()
  expect(residue.legacySession).toBeNull()
  expect(residue.legacyLocal).toBeNull()
  expect(residue.hasProfileDb).toBe(false)
})

test('Arabic audit timestamps use Arabic locale formatting', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.sample()
  await app.openUsageLog()
  const timestamp = page.locator('.audit-item small').first()
  await expect(timestamp).toContainText(/[٠-٩]/)
})

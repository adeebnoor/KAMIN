import {test,expect} from '@playwright/test'

// Red-team inputs for the two places a student can feed the app arbitrary text:
// transcript upload and the SPARQL lab. Each case states the behaviour a reviewer
// should be able to rely on; a failure here is a defect, not a flaky test.

async function openWorkspace(page){
 await page.goto('/ar/')
 await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
 await expect(page.locator('#kamin-transcript-file')).toBeAttached()
}
const upload=(page,name,text)=>page.locator('#kamin-transcript-file').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from(text,'utf8')})
const rowValues=page=>page.locator('.app-overlay table input').evaluateAll(inputs=>inputs.map(i=>i.value))

test.describe('transcript upload under hostile input',()=>{
 test('markup inside a course title is shown as text, never executed',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('dialog:'+d.message());d.dismiss()})
  await openWorkspace(page)
  await upload(page,'injection.txt','CPIT-260 <img src=x onerror=window.__pwned=1> Databases B\nCPIT-250 <script>window.__pwned=2</script> Software Engineering A')
  await expect(page.getByText(/مقررات مستخرجة/)).toBeVisible()
  expect(await page.evaluate(()=>window.__pwned)).toBeUndefined()
  await expect(page.locator('.app-overlay img[src="x"]')).toHaveCount(0)
  await expect(page.locator('.app-overlay script')).toHaveCount(0)
  const values=await rowValues(page)
  expect(values.some(v=>v.includes('<img'))).toBe(true)
  expect(errors).toEqual([])
 })

 test('duplicate course rows block approval until the student resolves them',async({page})=>{
  await openWorkspace(page)
  await upload(page,'duplicates.txt','CPIT-260 Database Systems B\nCPIT-260 Database Systems A\nCPIT-250 Software Engineering B+')
  await expect(page.getByText(/3 مقررات مستخرجة/)).toBeVisible()
  await expect(page.locator('.quality-review.has-issues')).toBeVisible()
  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await expect(page.getByRole('button',{name:/أعتمد السجل/}).last()).toBeDisabled()
 })

 test('an out-of-range numeric grade is not silently accepted as a course',async({page})=>{
  await openWorkspace(page)
  await upload(page,'bad-grade.txt','CPIT-260 Database Systems 45')
  await expect(page.getByRole('alert')).toContainText(/لم نتعرف على مقررات/)
  expect(await rowValues(page)).toEqual([])
 })

 test('Arabic grades and Arabic-Indic digits normalise to canonical values',async({page})=>{
  await openWorkspace(page)
  await upload(page,'arabic.txt','CPIT-٢٦٠ قواعد البيانات أ\nSTAT-٢٠١ الإحصاء ب+')
  await expect(page.getByText(/2 مقررات مستخرجة/)).toBeVisible()
  const values=await rowValues(page)
  expect(values).toEqual(expect.arrayContaining(['CPIT-260','A','STAT-201','B+']))
 })

 test('a very large text transcript is reviewed without freezing the page',async({page})=>{
  test.setTimeout(120_000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await openWorkspace(page)
  const lines=[];for(let i=0;i<1500;i++)lines.push(`CPIT-${1000+i} Course number ${i} B`)
  const started=Date.now()
  await upload(page,'large.txt',lines.join('\n'))
  await expect(page.getByText(/1500 مقررات مستخرجة/)).toBeVisible({timeout:90_000})
  const elapsed=Date.now()-started
  test.info().annotations.push({type:'timing',description:`1500 rows reviewed in ${elapsed} ms`})
  expect(elapsed,'review of 1500 rows must appear within 60 s even on a slow CI runner').toBeLessThan(60_000)
  // The page must still respond to input after rendering the large table.
  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await expect(page.getByRole('checkbox',{name:/أوافق صراحةً/})).toBeChecked()
  expect(errors).toEqual([])
 })
})

async function openLab(page){
 await page.goto('/ar/')
 await page.locator('.pilot-advanced > summary').click()
 await page.getByLabel('ابحث في المعرفة المرجعية',{exact:true}).fill('قواعد البيانات')
 await page.getByRole('button',{name:'استكشف',exact:true}).click()
 await expect(page.locator('.knowledge-detail h3')).toHaveText('قواعد البيانات')
 await page.getByRole('tab',{name:'مختبر SPARQL',exact:true}).click()
}
const runQuery=async(page,query)=>{await page.locator('#sparql-query').fill(query);await page.getByRole('button',{name:'شغّل الاستعلام',exact:true}).click()}

test.describe('SPARQL lab under hostile queries',()=>{
 test('a syntax error is reported with its position instead of a blank result',async({page})=>{
  await openLab(page)
  await runQuery(page,'SELECT * WHERE { ?s ?p')
  const error=page.locator('.query-error')
  await expect(error).toContainText('صيغة الاستعلام غير صحيحة')
  await expect(error.locator('.query-location')).toContainText(/\d/)
 })

 test('oversized, remote-dataset and unbounded queries are bounded by policy',async({page})=>{
  await openLab(page)
  // The editor itself caps input at the policy limit, so an oversized paste is truncated rather than sent.
  await expect(page.locator('#sparql-query')).toHaveAttribute('maxlength','6000')
  await page.locator('#sparql-query').fill('SELECT * WHERE { ?s ?p ?o } #'+'x'.repeat(6100))
  expect(await page.locator('#sparql-query').inputValue()).toHaveLength(6000)
  await runQuery(page,'SELECT * FROM <urn:kamin:graph:reference> WHERE { ?s ?p ?o }')
  await expect(page.locator('.query-error')).toContainText('SERVICE وFROM غير متاحين')
  await runQuery(page,'SELECT * WHERE { ?s ?p ?o } LIMIT 100000')
  await expect(page.getByRole('heading',{name:'نتيجة الاستعلام',exact:true})).toBeVisible({timeout:20000})
  await expect(page.locator('.query-results')).toContainText('عُرض أول 100 صف')
  await expect(page.locator('.query-table tbody tr')).toHaveCount(100)
 })
})

test.describe('field-level provenance',()=>{
 test('a grade raised by hand is named on review and travels with the capability',async({page})=>{
  await openWorkspace(page)
  await upload(page,'honest.txt','CPIT-260 Database Systems B\nSTAT-201 Applied Statistics B+')
  await expect(page.getByText(/2 مقررات مستخرجة/)).toBeVisible()
  await expect(page.locator('.provenance-badge.document')).toHaveCount(2)
  const grade=page.getByLabel(/^الدرجة 1$/)
  await grade.fill('A+')
  await expect(page.getByTestId('provenance-signals')).toContainText('رفعت درجة CPIT-260 من B إلى A+')
  await expect(page.locator('.provenance-badge.edited')).toHaveCount(1)
  await expect(page.locator('.provenance-badge.edited')).toContainText('درجة مرفوعة')
  // Restoring the extracted value clears the signal: provenance follows the value, not the click.
  await grade.fill('B')
  await expect(page.getByTestId('provenance-signals')).toHaveCount(0)
  await grade.fill('A')
  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
  await expect(page.getByText(/هذه قدراتك/)).toBeVisible()
  const more=page.getByRole('button',{name:'المزيد',exact:true})
  if(await more.isVisible())await more.click()
  await page.getByRole('button',{name:/مهاراتي/}).first().click()
  const database=page.locator('.skill-card[data-provenance="edited"]')
  await expect(database).toHaveCount(1)
  await expect(database).toContainText('معدّل بعد الاستخراج')
  await expect(database).toContainText('رُفعت يدويًا')
  await expect(page.locator('.skill-card[data-provenance="document"]')).toHaveCount(1)
 })
})

test.describe('document integrity signals',()=>{
 test('a QR verification link inside an uploaded image is surfaced without sending anything',async({page})=>{
  test.setTimeout(150_000)
  const {default:QRCode}=await import('qrcode')
  const png=await QRCode.toBuffer('https://verify.example-university.edu.sa/t/ABC123',{width:360,margin:2})
  const outbound=[];page.on('request',r=>{const url=r.url();if(!url.startsWith('http://127.0.0.1')&&!url.startsWith('blob:')&&!url.startsWith('data:'))outbound.push(url)})
  await openWorkspace(page)
  await page.locator('#kamin-transcript-file').setInputFiles({name:'qr-only.png',mimeType:'image/png',buffer:png})
  const signals=page.getByTestId('document-signals')
  await expect(signals).toBeVisible({timeout:120_000})
  await expect(signals).toContainText('verify.example-university.edu.sa')
  const link=signals.getByRole('link',{name:/تحقق من المصدر/})
  await expect(link).toHaveAttribute('href','https://verify.example-university.edu.sa/t/ABC123')
  await expect(link).toHaveAttribute('rel',/noopener/)
  expect(outbound).toEqual([])
 })
})

test.describe('from gap to evidence',()=>{
 test('a student can attach self-declared project evidence to a gap without changing any judgment',async({page})=>{
  await page.goto('/ar/')
  await page.getByRole('button',{name:'جرّب ببيانات توضيحية',exact:true}).click()
  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
  await expect(page.getByText(/هذه قدراتك/)).toBeVisible()
  const judgmentBefore=await page.locator('.metrics article').nth(2).innerText()
  await page.getByRole('button',{name:/شبكتي ومساعدي/}).first().click()
  await page.getByRole('tab',{name:'مساعد القرار',exact:true}).click()
  await page.getByLabel('اختر سؤالك').selectOption('missing')
  const panel=page.getByTestId('project-evidence')
  await expect(panel).toBeVisible()
  await panel.getByRole('button',{name:'أضف دليل مشروع',exact:true}).click()
  await panel.getByLabel('عنوان الدليل').fill('مختبر Python لتحليل البيانات')
  await panel.getByLabel(/رابط https/).fill('javascript:alert(1)')
  await panel.getByRole('checkbox',{name:/التحليل الكمي/}).check()
  await panel.getByRole('button',{name:'سجّل الدليل محليًا',exact:true}).click()
  await expect(panel.getByRole('status')).toContainText('https://')
  await panel.getByLabel(/رابط https/).fill('https://github.com/example/python-lab')
  await panel.getByRole('button',{name:'سجّل الدليل محليًا',exact:true}).click()
  await expect(panel.locator('.project-evidence-list li')).toHaveCount(1)
  await expect(panel.locator('.project-evidence-list')).toContainText('بانتظار مراجعة')
  await expect(panel.locator('.project-evidence-list a')).toHaveAttribute('rel',/noopener/)
  const more=page.getByRole('button',{name:'المزيد',exact:true})
  if(await more.isVisible())await more.click()
  await page.getByRole('button',{name:/لوحة قدراتي/}).first().click()
  expect(await page.locator('.metrics article').nth(2).innerText()).toBe(judgmentBefore)
  if(await more.isVisible())await more.click()
  await page.getByRole('button',{name:/مهاراتي/}).first().click()
  await expect(page.locator('.skill-projects')).toContainText('مختبر Python لتحليل البيانات')
  const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-session-v3')||'{}'))
  expect(session.projects?.length).toBe(1)
  expect(session.projects[0].level).toBe('declared-applied')
 })
})

test.describe('portable export',()=>{
 test('the CLR-shaped export is unsigned, self-asserted and carries provenance levels',async({page})=>{
  await page.goto('/ar/')
  await page.getByRole('button',{name:'جرّب ببيانات توضيحية',exact:true}).click()
  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
  await expect(page.getByText(/هذه قدراتك/)).toBeVisible()
  await page.getByRole('button',{name:/الخصوصية/}).first().click()
  const download=page.waitForEvent('download')
  await page.getByTestId('export-clr').click()
  const file=await download
  expect(file.suggestedFilename()).toMatch(/^kamin-clr-export-\d{4}-\d{2}-\d{2}\.jsonld$/)
  const body=JSON.parse((await import('node:fs')).readFileSync(await file.path(),'utf8'))
  expect(body.type).toEqual(['VerifiableCredential','ClrCredential'])
  expect(body.proof).toBeUndefined()
  expect(body['kamin:verificationStatus']).toBe('self-asserted')
  expect(body.credentialSubject.verifiableCredential.length).toBeGreaterThan(0)
  expect(body.credentialSubject.verifiableCredential.every(a=>a['kamin:provenanceLevel']==='synthetic')).toBe(true)
 })
})

test.describe('task → evidence → review loop',()=>{
 test('a student can start a gap task, attach an output, self-assess and record a local review that never upgrades the level',async({page})=>{
  await page.goto('/ar/')
  await page.getByRole('button',{name:'جرّب ببيانات توضيحية',exact:true}).click()
  await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
  await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
  await expect(page.getByText(/هذه قدراتك/)).toBeVisible()
  const strip=page.getByTestId('today-strip')
  await expect(strip).toContainText('هدفي الحالي')
  await expect(strip).toContainText('أهم دليل ناقص')
  await expect(strip).toContainText('ما الذي أنفذه الآن')
  const loop=page.getByTestId('task-loop')
  await expect(loop.locator('.task-card')).toHaveCount(6)
  const card=loop.locator('[data-task="task-backup-restore"]')
  await card.locator('.task-head').click()
  await card.getByRole('button',{name:'ابدأ المهمة',exact:true}).click()
  await expect(card).toHaveAttribute('data-status','in-progress')
  await card.getByLabel(/وصف المخرج/).fill('نسخ احتياطي ثم إتلاف جدول ثم استعادة مع سجل الأوامر والنتائج')
  await card.getByRole('button',{name:'احفظ المخرج محليًا',exact:true}).click()
  await expect(card).toHaveAttribute('data-status','output-attached')
  await expect(card.getByTestId('task-proof')).toContainText('مخرج مرفق (تصريح ذاتي)')
  await expect(card.getByTestId('task-proof')).toContainText('غير متاح في هذه النسخة')
  await card.getByTestId('task-rubric').getByLabel('مستوفى').first().check()
  await card.getByLabel('اسم المراجع أو اسمه المستعار').fill('د. مستشار')
  await card.getByLabel('صفة المراجع').selectOption('advisor')
  await card.getByRole('button',{name:'سجّل المراجعة محليًا',exact:true}).click()
  await expect(card).toHaveAttribute('data-status','reviewed')
  await expect(card.getByTestId('task-proof')).toContainText('رأي مراجع محلي مصرح به')
  // Reload: progress is reopened, and the record still carries only the declared level.
  await page.reload()
  await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
  const again=page.getByTestId('task-loop').locator('[data-task="task-backup-restore"]')
  await expect(again).toHaveAttribute('data-status','reviewed')
  const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-session-v3')||'{}'))
  expect(session.tasks[0].level).toBe('declared-applied')
  expect(session.tasks[0].reviews[0]).toMatchObject({role:'advisor',level:'declared'})
  expect(session.tasks[0].issuerVerification).toBeUndefined()
 })
})

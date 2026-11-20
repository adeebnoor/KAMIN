import {test,expect} from './fixtures.js'
import { openView, openOtherOptions } from './nav.js'
import AxeBuilder from '@axe-core/playwright'
import { copy } from '../src/i18n.js'

// Task 02: capabilities show an ordinal evidence level with reasons, never a percentage, and a
// hand-typed course waits for a document instead of creating a capability.

async function openSkills(page){
 await openView(page,'مهاراتي')
}

test('capability cards show level and why, academic and practical separately, and no percentage',async({page})=>{
 await page.goto('/ar/')
 await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
 await page.getByRole('dialog').getByRole('button',{name:/جرّب المثال التوضيحي/}).click()
 // Task 03: the review screen states the principle before approval.
 await expect(page.getByTestId('course-evidence-principle')).toHaveText('درجة المقرر قرينة على مخرج تعلم متوقع، وليست ضمانًا لإتقانه. يختلف مستوى الدليل حسب الدرجة ونوع التقييم.')
 await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
 await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
 await openSkills(page)
 const cards=page.locator('.skill-card')
 await expect(cards.first()).toBeVisible()
 const count=await cards.count()
 expect(count).toBe(5)
 for(let i=0;i<count;i++){
  const card=cards.nth(i)
  await expect(card).toHaveAttribute('data-evidence-level',/^(strong|moderate|limited)$/)
  await expect(card).toContainText('قرينة لا ضمان')
  await expect(card.getByTestId('course-evidence-principle')).toContainText('وليست ضمانًا لإتقانه')
  await expect(card).toContainText('مدعوم أكاديميًا')
  await expect(card.getByTestId('practical-basis')).toContainText('لا دليل عملي مُراجَع بعد')
  await expect(card.locator('.evidence-why').first()).toContainText(/^قرينة (قوية|متوسطة|محدودة): /)
  // The demo course map is still proposed, so the reason names it.
  await expect(card.locator('.evidence-why').first()).toContainText('ربط المقرر مقترح ولم يعتمده القسم بعد')
 }
 const text=await page.locator('.capability-list').innerText()
 expect(text).not.toMatch(/\d\s*%|٪/)
 expect(text).not.toMatch(/urn:kamin:/)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('a hand-typed mapped course creates no capability and waits for a document',async({page})=>{
 await page.goto('/ar/')
 await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
 // Task 10: manual entry is under "Other options".
 await openOtherOptions(page)
 await page.getByRole('button',{name:'أدخل المقررات يدويًا'}).click()
 await page.getByRole('button',{name:/إضافة مقرر يدويًا/}).click()
 await page.getByLabel('رمز المقرر').fill('CPIT-240')
 await page.getByLabel('اسم المقرر').fill('Databases')
 await page.getByLabel('الدرجة').fill('A')
 await page.getByRole('button',{name:'حفظ'}).click()
 await expect(page.locator('.mapping-badge.pending')).toContainText('بانتظار مستند أو مراجعة')
 // Task 04: the college is never assumed. Task 55: with no transcript to read it from, manual entry asks
 // once at the top ("Which college are these courses from?"); one tap chooses.
 await page.getByTestId('college-question').getByRole('button',{name:'كلية الحاسبات وتقنية المعلومات'}).click()
 await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
 await page.getByRole('button',{name:/أعتمد السجل/}).click()
 await expect(page.getByTestId('awaiting-evidence').first()).toContainText('CPIT-240')
 await openSkills(page)
 await expect(page.locator('.skill-card')).toHaveCount(0)
 await expect(page.getByTestId('awaiting-evidence')).toContainText('قواعد البيانات')
})

test('the methodology page states that a course grade is a clue, not a guarantee (Task 03)',async({page})=>{
 await page.goto('/en/methodology.html')
 await expect(page.locator('[data-course-evidence-principle]:visible')).toHaveText('A course grade is a clue to an expected learning outcome, not a guarantee of mastery. The evidence level depends on the grade and the type of assessment.')
 await page.goto('/ar/methodology.html')
 await expect(page.locator('[data-course-evidence-principle]:visible')).toContainText('وليست ضمانًا لإتقانه')
})

// ---------- Task 29 · "why is this level limited?" in one line, and what the levels mean ----------
const T29 = {
 ar: { open: /افتح مساحة العمل/, demo: 'جرّب المثال التوضيحي', consent: /أوافق صراحةً/, approve: /أعتمد السجل/, legend: 'ماذا تعني المستويات؟', limited: 'قرينة محدودة',
  shared: 'كلها محدودة للأسباب نفسها، وليس بسبب درجاتك: القسم لم يعتمد ربط هذه المقررات بعد، ولا نعرف بعد كيف تُقيَّم هذه المقررات.' },
 en: { open: /Open workspace/, demo: 'Try synthetic demo', consent: /I explicitly consent/, approve: /Approve transcript/, legend: 'What do the levels mean?', limited: 'Limited clue',
  shared: 'All limited for the same reasons, not your grades: the department has not approved these course links yet, and we don’t know yet how these courses are assessed.' },
}
async function approvedSample(page,lang){
 await page.goto(`/${lang}/`)
 await page.getByRole('button',{name:T29[lang].open}).first().click()
 await page.getByRole('dialog').getByRole('button',{name:T29[lang].demo,exact:true}).click()
 await page.getByRole('checkbox',{name:T29[lang].consent}).check()
 await page.getByRole('button',{name:T29[lang].approve}).last().click()
 await expect(page.locator('.capability-list')).toBeVisible()
}

for(const lang of ['ar','en'])test(`synthetic profile: the shared reason once above the list, not on the rows; the levels explained (${lang})`,async({page})=>{
 await approvedSample(page,lang)
 const list=page.locator('.capability-list')
 const shared=list.getByTestId('capability-why-all')
 await expect(shared).toHaveText(T29[lang].shared)
 await expect(shared.getByRole('button')).toHaveCount(0) // only the department and the KAMIN team can change these
 await expect(list.getByTestId('capability-why')).toHaveCount(0)
 // A screen reader hears the reason with each row.
 await expect(list.locator('.capability-row').first()).toHaveAttribute('aria-describedby','capability-why-all')
 // Above the list, and the level each row shows is still the one levels.js computes.
 expect((await shared.boundingBox()).y).toBeLessThan((await list.locator('.capability-rows').boundingBox()).y)
 await expect(list.locator('.capability-level')).toHaveText(Array(5).fill(T29[lang].limited))
 // What the levels mean: closed until asked; four levels, the rule, and the approved Task 03 sentence word for word.
 const legend=list.getByTestId('level-legend')
 await expect(legend).not.toHaveAttribute('open','')
 await legend.getByText(T29[lang].legend,{exact:true}).click()
 await expect(legend.locator('li')).toHaveCount(4)
 await expect(legend.locator('li[data-level="limited"]')).toContainText(T29[lang].limited)
 await expect(legend.getByTestId('level-legend-principle')).toHaveText(lang==='ar'
  ?'درجة المقرر قرينة على مخرج تعلم متوقع، وليست ضمانًا لإتقانه. يختلف مستوى الدليل حسب الدرجة ونوع التقييم.'
  :'A course grade is a clue to an expected learning outcome, not a guarantee of mastery. The evidence level depends on the grade and the type of assessment.')
 expect(await list.innerText()).not.toMatch(/\d\s*%|٪/)
 const report=await new AxeBuilder({page}).include('.capability-list').analyze()
 expect(report.violations.filter(v=>['serious','critical'].includes(v.impact)),JSON.stringify(report.violations)).toEqual([])
})

test('a hand-typed course says it waits for a document, with "Upload your record" that opens the upload',async({page})=>{
 await page.goto('/en/')
 await page.getByRole('button',{name:/Open workspace/}).first().click()
 await openOtherOptions(page)
 await page.getByRole('button',{name:'Enter courses manually'}).click()
 await page.getByRole('button',{name:copy.en.app.addRow}).click()
 await page.getByLabel('Course code').fill('CPIT-240')
 await page.getByLabel('Course name').fill('Databases')
 await page.getByLabel('Grade').fill('A')
 await page.getByRole('button',{name:'Save'}).click()
 await page.getByTestId('college-question').getByRole('button',{name:'Faculty of Computing and Information Technology'}).click()
 await page.getByRole('checkbox',{name:/I explicitly consent/}).check()
 await page.getByRole('button',{name:/Approve transcript/}).click()
 const why=page.getByTestId('awaiting-evidence').getByTestId('awaiting-why')
 await expect(why).toContainText('Waiting for a document: you typed this course in.')
 await why.getByRole('button',{name:'Upload your record',exact:true}).click()
 await expect(page.locator('.onboarding-upload')).toBeVisible()
})

test('when the reasons differ, each row names its own: a lowered grade, with "Review my data"',async({page})=>{
 await approvedSample(page,'ar')
 await page.getByTestId('open-my-data').click()
 await page.getByLabel('درجة CPIT-240').fill('D')
 await page.getByRole('button',{name:'احفظ التعديلات'}).click()
 await page.getByRole('alertdialog').getByRole('button',{name:'تأكيد وإعادة الحساب'}).click()
 await openSkills(page)
 const list=page.locator('.capability-list')
 await expect(list.getByTestId('capability-why-all')).toHaveCount(0)
 const rows=list.locator('.capability-rows > li')
 await expect(list.getByTestId('capability-why')).toHaveCount(await rows.count())
 const changed=list.getByTestId('capability-why').filter({hasText:'بسبب الدرجة D في CPIT-240'})
 await expect(changed).toHaveCount(1)
 const describedBy=await list.locator('.capability-row').first().getAttribute('aria-describedby')
 await expect(page.locator('#'+describedBy)).toHaveAttribute('data-testid','capability-why')
 // The other rows still say it is not their grade.
 await expect(list.getByTestId('capability-why').filter({hasText:'وليس بسبب درجتك'})).toHaveCount(await rows.count()-1)
})

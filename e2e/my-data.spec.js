import {test,expect} from './fixtures.js'
import { openView, openPrivacySection, settle } from './nav.js'
import AxeBuilder from '@axe-core/playwright'

// Task 05: "My data" — review and correct everything after approval, see what changed, undo;
// plus the three supervisor UX fixes (separate restore passphrase, no technical IDs, a plain
// message after consent withdrawal).

async function approveDemo(page,lang='ar'){
 await page.goto(`/${lang}/`)
 await page.getByRole('button',{name:lang==='ar'?/افتح مساحة العمل/:/Open workspace/}).first().click()
 await page.getByRole('dialog').getByRole('button',{name:lang==='ar'?'جرّب المثال التوضيحي':'Try synthetic demo',exact:true}).click()
 await page.getByRole('checkbox',{name:lang==='ar'?/أوافق صراحةً/:/I explicitly consent/}).check()
 await page.getByRole('button',{name:lang==='ar'?/أعتمد السجل/:/Approve transcript/}).last().click()
 await expect(page.getByTestId('open-my-data')).toBeVisible()
}
async function skillNames(page){
 await openView(page,'مهاراتي')
 await expect(page.locator('.skill-card').first()).toBeVisible()
 return page.locator('.skill-card h3').allInnerTexts()
}
const save=async page=>{
 await page.getByRole('button',{name:'احفظ التعديلات'}).click()
 const confirm=page.getByRole('alertdialog')
 await expect(confirm).toContainText('سيُعاد حساب قدراتك')
 await confirm.getByRole('button',{name:'تأكيد وإعادة الحساب'}).click()
}

test('"My data" is one click from the dashboard and lists everything entered with its source',async({page})=>{
 await approveDemo(page)
 await page.getByTestId('open-my-data').click()
 const myData=page.getByTestId('my-data')
 await expect(myData.getByRole('heading',{name:'بياناتي: مراجعة وتصحيح'})).toBeVisible()
 await expect(myData.locator('tbody tr')).toHaveCount(7)
 await expect(myData.locator('tr[data-course="CPIT-240"] .provenance-badge')).toHaveText('مثال وهمي')
 await expect(myData).toContainText('كلية الحاسبات وتقنية المعلومات')
 await expect(myData).toContainText('أدلة تطبيقية مصرّح بها')
 await expect(myData).toContainText('اعتمادات مستوردة')
 await expect(myData).toContainText('الاهتمامات والتفضيلات')
 const results=await new AxeBuilder({page}).include('[data-testid="my-data"]').analyze()
 expect(results.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([])
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('changing a grade to F drops the capability with its reason, and undo restores it',async({page})=>{
 await approveDemo(page)
 expect(await skillNames(page)).toContain('قواعد البيانات')
 await openView(page,'لوحة قدراتي')
 await page.getByTestId('open-my-data').click()
 await page.getByLabel('درجة CPIT-240').fill('F')
 await save(page)
 const changed=page.getByTestId('what-changed')
 await expect(changed).toContainText('أُزيلت قدرة «قواعد البيانات»')
 await expect(changed).toContainText('أصبحت الدرجة لا تُعد دليلًا')
 // the edit keeps the value from the record and is logged
 // Task 22: the name is a text area now, so the grade is no longer the third input; read it by its label.
 await expect(page.getByLabel('درجة CPIT-240')).toHaveValue('F')
 await page.getByTestId('undo-last-change').click()
 await expect(changed).toContainText('أُضيفت قدرة «قواعد البيانات»')
 await expect(page.getByTestId('undo-last-change')).toHaveCount(0)
 await expect(page.getByLabel('درجة CPIT-240')).toHaveValue('B')
 expect(await skillNames(page)).toContain('قواعد البيانات')
 await openView(page,'سجل الاستخدام')
 await expect(page.locator('.audit-list')).toContainText('CPIT-240: تغيير الدرجة من «B» إلى «F»')
 await expect(page.locator('.audit-list')).toContainText('التراجع عن آخر تغيير في بياناتي')
})

test('deleting a course row removes it and lists it in what changed',async({page})=>{
 await approveDemo(page)
 await page.getByTestId('open-my-data').click()
 await page.getByRole('button',{name:'حذف STAT-110'}).click()
 // Task 06: deleting a saved row asks for confirmation and is applied at once (dataControl.deleteItem).
 await page.getByTestId('delete-item-confirm').getByRole('button',{name:'احذف نهائيًا'}).click()
 await expect(page.getByTestId('what-changed')).toContainText('أُزيلت قدرة «التحليل الكمي» — السبب: حُذف المقرر من سجلك')
 await expect(page.locator('tr[data-course="STAT-110"]')).toHaveCount(0)
 expect(await skillNames(page)).not.toContain('التحليل الكمي')
})

test('urn:kamin never appears in the visible text of any app screen',async({page})=>{
 await approveDemo(page)
 const views=['لوحة قدراتي','مهاراتي','فرصي','الدورات','اهتماماتي وهدفي','شبكتي ومساعدي','الخصوصية','سجل الاستخدام','مستكشف المعرفة']
 for(const name of views){
  await openView(page,name)
  await settle(page)
  expect(await page.innerText('body'),name).not.toContain('urn:kamin')
 }
 await openView(page,'لوحة قدراتي')
 await page.getByTestId('open-my-data').click()
 await expect(page.getByTestId('my-data')).toBeVisible()
 expect(await page.innerText('body')).not.toContain('urn:kamin')
})

test('restore uses its own passphrase field and shows an error under it on a wrong passphrase',async({page})=>{
 await approveDemo(page)
 await openView(page,'الخصوصية')
 await openPrivacySection(page,'backup') // Task 27
 const pass='correct horse battery staple'
 await page.getByLabel('عبارة المرور',{exact:true}).fill(pass)
 await page.getByLabel(/تأكيد العبارة/).fill(pass)
 const download=page.waitForEvent('download')
 await page.getByRole('button',{name:/تنزيل نسخة مشفّرة/}).click()
 const backup=await (await download).path()
 // export clears its own fields; the restore field is separate and empty
 const restore=page.getByTestId('restore-backup')
 const field=restore.getByLabel('عبارة مرور النسخة المستعادة',{exact:true})
 await expect(field).toHaveValue('')
 await field.fill('a wrong passphrase!!')
 await page.locator('input[type="file"][accept*=".kamin"]').setInputFiles(backup)
 const error=restore.getByRole('alert')
 await expect(error).toContainText('عبارة المرور خاطئة')
 await expect(field).toHaveAttribute('aria-invalid','true')
 await expect(field).toHaveAttribute('aria-describedby','kamin-restore-error')
 // the right passphrase restores
 await field.fill(pass)
 await page.locator('input[type="file"][accept*=".kamin"]').setInputFiles(backup)
 await expect(page.getByText(/هذه قدراتك/)).toBeVisible()
})

test('withdrawing transcript consent says what was removed and what stayed',async({page})=>{
 await approveDemo(page)
 await openView(page,'الخصوصية')
 await page.locator('.consents label').first().getByRole('checkbox').uncheck()
 const changed=page.getByTestId('what-changed')
 await expect(changed).toContainText('ما الذي تغيّر بعد سحب موافقة السجل؟')
 await expect(changed).toContainText('حُذف معها')
 await expect(changed).toContainText('بقي كما هو: اهتماماتك وتفضيلاتك وهدفك')
 await expect(changed).toContainText('أُزيلت قدرة «قواعد البيانات» — السبب: سحبت موافقة تحليل السجل')
})

test('English: My data saves an edit and explains it in English',async({page})=>{
 await approveDemo(page,'en')
 await page.getByTestId('open-my-data').click()
 await page.getByLabel('Grade STAT-110').fill('W')
 await page.getByRole('button',{name:'Save changes'}).click()
 await page.getByRole('alertdialog').getByRole('button',{name:'Confirm and recompute'}).click()
 await expect(page.getByTestId('what-changed')).toContainText('Removed “Quantitative analysis” — because the grade no longer counts as evidence')
})

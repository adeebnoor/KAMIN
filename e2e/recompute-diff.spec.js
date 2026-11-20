import {test,expect} from './fixtures.js'
import { openView } from './nav.js'

// Task 04: after the record or the college changes, capabilities are recomputed and the student
// sees which capability was added, dropped or changed, and why.

async function approveDemo(page){
 await page.goto('/ar/')
 await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
 await page.getByRole('dialog').getByRole('button',{name:/جرّب المثال التوضيحي/}).click()
 // Task 22 / 55: the example's college is one line ("Not right?" opens the one-tap list; no dropdown).
 await expect(page.getByTestId('college-current')).toContainText('كلية الحاسبات وتقنية المعلومات')
 await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
 await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
 await expect(page.getByTestId('open-my-data')).toBeVisible()
}
async function reapprove(page){
 await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
 await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
}
const row=(page,code)=>page.locator('tbody tr').filter({has:page.locator(`input[value="${code}"]`)})

test('editing a grade in an approved record names the dropped capability and the reason',async({page})=>{
 await approveDemo(page)
 await page.getByTestId('open-my-data').click()
 await page.getByRole('button',{name:'أعد مراجعة السجل كاملًا'}).click()
 await row(page,'CPIT-240').getByLabel(/^الدرجة/).fill('F')
 await reapprove(page)
 const panel=page.getByTestId('what-changed')
 await expect(panel).toContainText('ما الذي تغيّر بعد التعديل؟')
 await expect(panel).toContainText('أُزيلت قدرة «قواعد البيانات»')
 await expect(panel).toContainText('أصبحت الدرجة لا تُعد دليلًا')
 await expect(panel).not.toContainText('urn:kamin')
 // the capability is gone from the profile and the audit log records the recompute
 await openView(page,'مهاراتي')
 await expect(page.locator('.skill-card')).not.toContainText(['قواعد البيانات'])
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('switching college to one without an approved map drops capabilities; switching back restores them',async({page})=>{
 await approveDemo(page)
 await page.getByTestId('open-my-data').click()
 await page.getByRole('button',{name:'أعد مراجعة السجل كاملًا'}).click()
 // Task 55: the college is one line; "Not right?" opens the one-tap list of colleges (no dropdown).
 await page.getByTestId('college-current').getByRole('button',{name:'ليست صحيحة؟'}).click()
 await expect(page.getByTestId('college-fix').getByRole('button',{name:'كلية الحاسبات وتقنية المعلومات'})).toHaveAttribute('aria-pressed','true')
 await page.getByTestId('college-fix').getByRole('button',{name:'كلية العلوم'}).click()
 await expect(page.locator('.mapping-badge.unmapped').first()).toContainText('لا خريطة معتمدة لكليتك بعد')
 await reapprove(page)
 const panel=page.getByTestId('what-changed')
 await expect(panel).toContainText('أُزيلت قدرة «قواعد البيانات»')
 await expect(panel).toContainText('لا توجد خريطة مقررات معتمدة لكليتك بعد')
 // the dashboard says why there is no capability and offers the same fix; switching back recomputes
 const prompt=page.getByTestId('college-prompt')
 await expect(prompt).toContainText('كلية العلوم')
 await prompt.getByRole('button',{name:'ليست صحيحة؟'}).click()
 await page.getByTestId('college-fix-dashboard').getByRole('button',{name:'كلية الحاسبات وتقنية المعلومات'}).click()
 await expect(panel).toContainText('أُضيفت قدرة «قواعد البيانات»')
 await expect(panel).toContainText('تغيّرت كليتك')
 await expect(page.getByTestId('college-prompt')).toHaveCount(0)
})

test('an English student sees the change and its reason in English',async({page})=>{
 await page.goto('/en/')
 await page.getByRole('button',{name:/Open workspace/i}).first().click()
 await page.getByRole('dialog').getByRole('button',{name:'Try synthetic demo',exact:true}).click()
 await page.getByRole('checkbox',{name:/explicitly consent/i}).check()
 await page.getByRole('button',{name:/Approve/}).last().click()
 await page.getByTestId('open-my-data').click()
 await page.getByRole('button',{name:'Re-review the whole record'}).click()
 await row(page,'STAT-110').getByRole('button').last().click()
 await page.getByRole('checkbox',{name:/explicitly consent/i}).check()
 await page.getByRole('button',{name:/Approve/}).last().click()
 const panel=page.getByTestId('what-changed')
 await expect(panel).toContainText('What changed after your edit?')
 await expect(panel).toContainText('Removed “Quantitative analysis”')
 await expect(panel).toContainText('the course was removed from your record')
})

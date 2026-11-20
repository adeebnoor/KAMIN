import {test,expect} from './fixtures.js'
import { openDashboardMore } from './nav.js'
import AxeBuilder from '@axe-core/playwright'

// Task 09: four sections, the same on desktop and mobile, nothing disabled, and every old
// function within two clicks of the section menu.
const sections=['قدراتي','خطوتي التالية','اهتماماتي وهدفي','بياناتي']
const menu=page=>page.locator('nav.app-nav:visible, nav.bottom-nav:visible').first()
const section=async(page,name)=>menu(page).getByRole('button',{name,exact:true}).click()

async function openWorkspace(page){
 await page.goto('/ar/')
 await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
}
async function approveDemo(page){
 await openWorkspace(page)
 await page.getByRole('dialog').getByRole('button',{name:'جرّب المثال التوضيحي',exact:true}).click()
 await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
 await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
 await expect(page.getByTestId('open-my-data')).toBeVisible()
}

test('exactly four menu items, none disabled, before and after approval',async({page})=>{
 await openWorkspace(page)
 const items=menu(page).getByRole('button')
 await expect(items).toHaveCount(4)
 await expect(items).toHaveText(sections)
 for(let i=0;i<4;i++)await expect(items.nth(i)).toBeEnabled()
 await expect(page.getByRole('button',{name:/^(المزيد|More)$/})).toHaveCount(0)
 await expect(page.locator('.student-journey')).toHaveCount(0)
 // every section opens before approval and explains what is missing with one action
 await section(page,'قدراتي')
 await expect(page.locator('.onboarding-upload')).toBeVisible()
 await section(page,'خطوتي التالية')
 await page.getByRole('tab',{name:'الدورات'}).click()
 await expect(page.getByTestId('needs-record')).toContainText('يحتاج هذا القسم إلى سجلك الدراسي')
 await page.getByTestId('needs-record').getByRole('button',{name:'أضف سجلك الدراسي'}).click()
 await expect(page.locator('.onboarding-upload')).toBeVisible()
 await section(page,'بياناتي')
 await expect(page.getByRole('tab',{name:'الموافقات والحفظ والحذف'})).toHaveAttribute('aria-selected','true')
 await approveDemo(page)
 await expect(menu(page).getByRole('button')).toHaveCount(4)
 const results=await new AxeBuilder({page}).analyze()
 expect(results.violations.filter(v=>['serious','critical'].includes(v.impact)&&v.id!=='color-contrast')).toEqual([])
})

test('every old function is within two clicks',async({page})=>{
 // upload a transcript: 1 click (My capabilities opens the upload page before approval)
 await openWorkspace(page)
 await section(page,'قدراتي')
 await expect(page.locator('.onboarding-upload')).toBeVisible()
 await approveDemo(page)
 // see a capability and its evidence: 1 click
 await section(page,'خطوتي التالية')
 await section(page,'قدراتي')
 // Task 11: one click opens a capability's evidence inline
 await page.locator('.capability-row').first().click()
 const card=page.locator('.skill-card').first()
 await expect(card).toBeVisible()
 await expect(card.locator('.evidence-item').first()).toBeVisible()
 // compare courses: 2 clicks
 await section(page,'خطوتي التالية')
 await page.getByRole('tab',{name:'المقارنة'}).click()
 await expect(page.getByRole('tab',{name:'المقارنة'})).toHaveAttribute('aria-selected','true')
 await expect(page.getByRole('heading',{name:'نفس الأبعاد. قرار أسهل.'})).toBeVisible()
 // withdraw consent and delete data: 2 clicks
 await section(page,'بياناتي')
 await page.getByRole('tab',{name:'الموافقات والحفظ والحذف'}).click()
 await expect(page.getByRole('checkbox',{name:/تحليل السجل وبناء ملف المهارات/})).toBeVisible()
 // Task 27: on this tab "Delete my data" is inside the Delete section (its heading is visible, the button is
 // one more click); the route of two clicks is My data -> "Delete all my data from this device" (Task 15),
 // which opens that section with the confirmation.
 await expect(page.locator('[data-privacy-section="delete"] > summary')).toBeVisible()
 await page.getByRole('tab',{name:'مراجعة وتصحيح'}).click()
 await page.getByTestId('delete-all-shortcut').click()
 await expect(page.getByTestId('delete-everything-confirm').getByRole('button',{name:/نعم، احذف كل شيء من هذا الجهاز/})).toBeVisible()
 await page.getByTestId('delete-everything-confirm').getByRole('button',{name:'إلغاء'}).click()
 // usage log: 2 clicks
 await page.getByRole('tab',{name:'سجل الاستخدام'}).click()
 await expect(page.locator('.audit-list')).toBeVisible()
 // correct my data: 1 click
 await section(page,'بياناتي')
 await expect(page.getByTestId('my-data')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('an old view opens "My next step" on the right tab, and tabs work with the keyboard',async({page})=>{
 await approveDemo(page)
 // the dashboard still calls the old "studio" view
 await openDashboardMore(page)
 await page.getByRole('button',{name:'افتح شبكتي ومساعدي'}).click()
 await expect(menu(page).getByRole('button',{name:'خطوتي التالية'})).toHaveAttribute('aria-current','page')
 const studio=page.getByRole('tab',{name:'اعرض الروابط'})
 await expect(studio).toHaveAttribute('aria-selected','true')
 await studio.focus()
 await page.keyboard.press('Home')
 await expect(page.getByRole('tab',{name:'فرصي'})).toHaveAttribute('aria-selected','true')
 await expect(page.getByRole('tab',{name:'فرصي'})).toBeFocused()
})

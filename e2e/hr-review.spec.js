// Task 70: the old landing tour and its 'Try a live example' test is deleted with the old interface (inventory D01, D02);
// the sample keeps consent off on step 1 (e2e/next-upload.spec.js, keep-test K02). The public pages' test stays.
import {test,expect} from '@playwright/test'
for(const lang of ['ar','en']){
 const ar=lang==='ar'
 test(`university roadmap and catalog distinguish targets from results: ${lang}`,async({page})=>{
  await page.goto(`/${lang}/business-model.html`)
  await expect(page.locator('main')).toContainText(ar?'ترخيص سنوي':'Annual license')
  await expect(page.locator('main')).toContainText(ar?'التحقق المؤسسي غير مفعّل':'institutional verification is not active')
  await page.goto(`/${lang}/validation.html`)
  await expect(page.locator('#roadmap')).toContainText(ar?'60 مشاركًا':'60 participants')
  await expect(page.locator('#roadmap')).toContainText(ar?'لا نتائج':'no results')
  await page.goto(`/${lang}/catalog.html`)
  await expect(page.locator('#job-qa-tester a')).toHaveAttribute('href','https://www.onetonline.org/link/summary/15-1253.00')
  await expect(page.locator('#training-qa-tester')).toContainText(ar?'ربط تجريبي':'pilot mapping')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 })
}

import {test,expect} from '@playwright/test'

test.use({javaScriptEnabled:false})
for(const lang of ['ar','en'])test(`public reading journey remains available without JavaScript: ${lang}`,async({page})=>{
 await page.goto(`/${lang}/`)
 await expect(page.locator('h1:visible')).toHaveCount(1)
 await expect(page.locator('html')).toHaveAttribute('lang',lang)
 await expect(page.locator('h1:visible')).toContainText(lang==='ar'?'كامن':'Kamin')
 const guide=page.locator(`a[href="/${lang}/guide.html"]`)
 await expect(guide).toBeVisible()
 await guide.click()
 await expect(page.locator('h1:visible')).toContainText(lang==='ar'?'دليل':'guide')
 await expect(page.getByRole('main')).toContainText(lang==='ar'?'السجل':'transcript')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

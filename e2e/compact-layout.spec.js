import {test,expect} from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
// settle(): wait until the fonts are loaded and the view has stopped changing height (lazy parts are in).
// Shared with Task 30's checks; until Task 30 was merged this file held a word-for-word copy.
import { openView, settle } from './nav.js'

// Task 13: compact tokens must not break any screen: no horizontal scroll at 360px on any app
// screen, and contrast passes axe (WCAG 2 AA) on the main screens.
test.use({viewport:{width:360,height:740}})

// Measure the view itself, not its loading placeholder. My data, Privacy and the knowledge explorer
// load lazily, and React keeps their placeholder (data-testid="view-loading") on screen for at least
// 300ms. The old fixed 150ms wait measured that placeholder, so My data's 702px overflow at 360px
// was only caught when CI happened to be slow. Wait until no placeholder is left, then until the
// height stops changing; repeat if a placeholder came back while settling.
const noSideScroll=async(page,label)=>{
 const loading=page.locator('.app-content-wrap [data-testid="view-loading"]')
 do { await expect(loading,`${label}: still loading`).toHaveCount(0); await settle(page) } while (await loading.count())
 const sizes=await page.evaluate(()=>{const wrap=document.querySelector('.app-content-wrap');return {doc:[document.documentElement.scrollWidth,document.documentElement.clientWidth],wrap:wrap?[wrap.scrollWidth,wrap.clientWidth]:[0,0]}})
 expect(sizes.doc[0],`${label}: page`).toBeLessThanOrEqual(sizes.doc[1])
 expect(sizes.wrap[0],`${label}: app content`).toBeLessThanOrEqual(sizes.wrap[1])
}
const contrast=async(page,label)=>{
 const results=await new AxeBuilder({page}).withTags(['wcag2aa']).include('.app-overlay').analyze()
 expect(results.violations.filter(v=>v.id==='color-contrast').flatMap(v=>v.nodes.map(n=>n.target.join(' '))),`${label}: contrast`).toEqual([])
}

test('no horizontal scroll at 360px on any app screen, and contrast passes',async({page})=>{
 await page.goto('/ar/')
 await noSideScroll(page,'landing')
 await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
 await noSideScroll(page,'start'); await contrast(page,'start')
 await page.getByRole('dialog').getByRole('button',{name:'جرّب المثال التوضيحي',exact:true}).click()
 await noSideScroll(page,'review')
 await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
 await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
 await expect(page.locator('.capability-list')).toBeVisible()
 await noSideScroll(page,'dashboard'); await contrast(page,'dashboard')
 await page.locator('.capability-row').first().click()
 await noSideScroll(page,'dashboard with evidence open')
 for(const name of ['فرصي','الدورات','المقارنة','شبكتي ومساعدي','اهتماماتي وهدفي','بياناتي','الخصوصية','سجل الاستخدام','مستكشف المعرفة']){
  await openView(page,name)
  // The My data check must measure the My data page itself.
  if(name==='بياناتي') await expect(page.locator('.my-data')).toBeVisible()
  await noSideScroll(page,name)
 }
 await openView(page,'الخصوصية'); await contrast(page,'privacy')
 await openView(page,'فرصي'); await contrast(page,'matches')
})

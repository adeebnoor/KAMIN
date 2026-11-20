import {test,expect} from './fixtures.js'

// Task 11: a compact "My capabilities" page — at most one alert, the capability list and the
// next-step card above the fold, evidence one click away, no percentages.
const T={
 ar:{open:/افتح مساحة العمل/,demo:'جرّب المثال التوضيحي',consent:/أوافق صراحةً/,approve:/أعتمد السجل/,notNow:'ليس الآن',hide:'فهمت',source:'المصدر: ',keep:'نعم، احتفظ بملفي'},
 en:{open:/Open workspace/,demo:'Try synthetic demo',consent:/I explicitly consent/,approve:/Approve transcript/,notNow:'Not now',hide:'Got it',source:'Source: ',keep:'Yes, keep my profile'},
}
for(const lang of ['ar','en']){
 const t=T[lang]
 test.describe(`dashboard ${lang}`,()=>{
  test.use({viewport:{width:1366,height:768}})
  async function approveDemo(page){
   await page.goto(`/${lang}/`)
   await page.getByRole('button',{name:t.open}).first().click()
   await page.getByRole('dialog').getByRole('button',{name:t.demo,exact:true}).click()
   await page.getByRole('checkbox',{name:t.consent}).check()
   await page.getByRole('button',{name:t.approve}).last().click()
   await expect(page.locator('.capability-list')).toBeVisible()
  }

  test('capabilities and the next-step card are visible without scrolling at 1366×768',async({page})=>{
   await approveDemo(page)
   for(const selector of ['.capability-list','[data-testid="next-step-card"]']){
    const box=await page.locator(selector).boundingBox()
    expect(box.y,`${selector} top`).toBeGreaterThanOrEqual(0)
    expect(box.y+box.height,`${selector} bottom`).toBeLessThanOrEqual(768)
   }
   await expect(page.locator('.capability-row')).toHaveCount(5)
   await expect(page.getByTestId('next-step-card').getByRole('button').last()).toBeInViewport()
   await expect(page.getByTestId('dashboard-more')).not.toHaveAttribute('open','')
  })

  // Task 29: the whole capability card (its bottom edge too) and the next-step card fit the app window's
  // visible area, which ends above the browser viewport (the window is inset). Measured once the page has
  // settled and the student has closed "What changed", as on every later visit.
  test('the capability card and the next-step card fit inside the visible app window at 1366×768',async({page})=>{
   await approveDemo(page)
   await page.getByTestId('dashboard-alert').getByRole('button',{name:t.hide}).click()
   await expect(page.getByTestId('what-changed')).toHaveCount(0)
   await page.evaluate(()=>document.fonts.ready)
   const area=await page.locator('.app-content-wrap').boundingBox()
   const inside=async(locator,name)=>{const box=await locator.boundingBox();expect(box.y,name+' top').toBeGreaterThanOrEqual(area.y);expect(box.y+box.height,name+' bottom').toBeLessThanOrEqual(area.y+area.height)}
   await inside(page.locator('.capability-list'),'capability card')
   await inside(page.getByTestId('next-step-card'),'next-step card')
   const rows=page.locator('.capability-row')
   await expect(rows).toHaveCount(5)
   for(let i=0;i<5;i++)await inside(rows.nth(i),'row '+(i+1))
   await inside(page.locator('.level-legend > summary'),'legend')
  })

  test('never two alerts: what changed (with the save offer inside), then the save offer, then nothing',async({page})=>{
   await approveDemo(page)
   const alerts=page.getByTestId('dashboard-alert')
   await expect(alerts).toHaveCount(1)
   await expect(alerts.getByTestId('what-changed')).toBeVisible()
   await expect(alerts.getByRole('button',{name:t.keep})).toBeVisible()
   await alerts.getByRole('button',{name:t.hide}).click()
   await expect(alerts).toHaveCount(1)
   await expect(alerts.getByTestId('what-changed')).toHaveCount(0)
   await alerts.getByRole('button',{name:t.notNow}).click()
   await expect(alerts).toHaveCount(0)
  })

  test('every capability opens its evidence in one click and names its source; no percentage',async({page})=>{
   await approveDemo(page)
   const rows=page.locator('.capability-row')
   const count=await rows.count()
   for(let i=0;i<count;i++){
    const row=rows.nth(i)
    await expect(row).toHaveAttribute('aria-expanded','false')
    await expect(row.locator('.capability-source .sr-only')).toContainText(t.source)
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded','true')
    const detail=page.locator(`#${await row.getAttribute('aria-controls')}`)
    await expect(detail.locator('.evidence-item').first()).toBeVisible()
    await expect(detail.locator('.evidence-item').first()).toContainText(/[A-Z]{4}-\d{3}/)
    await expect(detail.locator('.evidence-why').first()).toBeVisible()
   }
   const text=await page.locator('.capability-list').innerText()
   expect(text).not.toMatch(/\d\s*%|٪/)
   expect(text).not.toMatch(/urn:kamin/)
  })
 })
}

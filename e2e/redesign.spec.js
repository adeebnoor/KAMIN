import {test,expect} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for(const lang of ['ar','en']){
  const t=(ar,en)=>lang==='ar'?ar:en
  test(`redesign ${lang}: hero and three-pathway comparison remain contained`,async({page},info)=>{
    await page.goto(`/${lang}/`)
    await page.evaluate(()=>document.fonts.ready)
    const graph=page.locator('.k-network-stage')
    await expect(graph).toBeVisible()
    await expect(page.locator('.k-advantage-grid')).toBeVisible()
    await expect(page.locator('.k-ai-principle')).toContainText(t('الإنسان يقرر','Humans decide'))
    const accessibility=await new AxeBuilder({page}).analyze()
    expect(accessibility.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([])
    await page.screenshot({path:`design-review/${info.project.name}/${lang}-home.png`,fullPage:true})
    await page.getByRole('button',{name:t('جرّب مثالًا حيًا','Try a live example'),exact:true}).click()
    await page.getByRole('checkbox',{name:lang==='ar'?/أوافق صراحةً/:/I explicitly consent/}).check()
    await page.getByRole('button',{name:t('أعتمد السجل','Approve transcript'),exact:true}).click()
    await page.getByRole('button',{name:t('فرصي','Matches'),exact:true}).click()
    const panel=page.getByRole('region',{name:t('مقارنة المسارات','Pathway comparison'),exact:true})
    await panel.getByRole('checkbox',{name:t('مسؤول قواعد البيانات','Database Administrator'),exact:true}).check()
    const scroll=page.getByRole('region',{name:t('جدول مقارنة المسارات — قابل للتمرير','Pathway comparison table — scrollable'),exact:true})
    await expect(scroll).toHaveAttribute('tabindex','0')
    await expect(scroll.getByRole('columnheader')).toHaveCount(4)
    const overflow=await panel.evaluate(el=>{
      const content=el.closest('.app-content-wrap')
      const viewport=content.getBoundingClientRect(),bounds=el.getBoundingClientRect()
      const outside=[...content.querySelectorAll('.match-group,.match-card,.app-title,.pathway-compare')].filter(node=>{const r=node.getBoundingClientRect();return r.left<viewport.left-1||r.right>viewport.right+1}).map(node=>node.className)
      return {panelWithin:bounds.left>=viewport.left-1&&bounds.right<=viewport.right+1,extra:content.scrollWidth-content.clientWidth,outside}
    })
    await page.screenshot({path:`design-review/${info.project.name}/${lang}-comparison.png`,fullPage:true})
    expect(overflow.panelWithin).toBe(true)
    expect(overflow.extra,JSON.stringify(overflow)).toBeLessThanOrEqual(1)
    await expect(panel).toContainText(t('تشغيل قواعد البيانات واستعادتها','Database operations and recovery'))
  })
}

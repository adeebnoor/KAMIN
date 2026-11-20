import {test,expect} from './fixtures.js'
import {mkdir,readdir} from 'node:fs/promises'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'

// Discover every built public page: new pages cannot silently escape the gate.
const pages=(await readdir('dist/ar')).filter(file=>file.endsWith('.html')).sort()
// Task 17: tests.html is regenerated from each real test run (counts, dates, the list of changes), so
// a pixel baseline would break on every run by design. It keeps every other check below (one h1,
// fonts, no horizontal scroll); its content is tested in e2e/test-results-page.spec.js.
const GENERATED_EACH_RUN=new Set(['tests.html'])
for(const lang of ['ar','en'])for(const file of pages){
  test(`public design ${lang}/${file}`,async({page},info)=>{
    await page.goto(`/${lang}/${file==='index.html'?'':file}`)
    await page.evaluate(async()=>{
      // Both fonts occur in the shared language switch, including on EN pages.
      await Promise.all([document.fonts.load('400 16px Inter'),document.fonts.load('400 16px "Noto Sans Arabic Variable"')])
      await document.fonts.ready
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
    })
    const title=page.locator('h1:visible')
    await expect(title).toHaveCount(1)
    if(file==='index.html'){
      await expect(page.locator('.k-network-stage')).toBeVisible()
      await expect(page.locator('.k-advantage-grid')).toBeVisible()
    }
    const typography=await title.evaluate(el=>{
      const style=getComputedStyle(el)
      return {family:style.fontFamily,size:style.fontSize,weight:style.fontWeight,synthesis:style.fontSynthesis,color:style.color,faces:[...document.fonts].map(f=>({family:f.family.replace(/["']/g,''),weight:f.weight,status:f.status}))}
    })
    expect(typography.family).toContain(lang==='ar'?'Noto Sans Arabic Variable':'Inter')
    expect(typography.weight).toBe('800')
    expect(typography.synthesis).toBe('none')
    expect(typography.color).toBe(file==='index.html'?'rgb(33, 93, 90)':'rgb(11, 47, 91)')
    expect(typography.faces).toEqual(expect.arrayContaining([expect.objectContaining({family:lang==='ar'?'Noto Sans Arabic Variable':'Inter',weight:'100 900',status:'loaded'})]))
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    // The public pages load app CSS (tokens.css, semantic-tools.css). A var() that is not defined on the page
    // silently becomes 0 or the initial value: after Task 13 every table cell here lost its padding this way.
    // Every var(--x) without a fallback, in a rule that applies on this page, must be defined there.
    const undefinedVars=await page.evaluate(()=>{
      const missing=new Set()
      const visit=rules=>{for(const rule of rules){
        if(!(rule instanceof CSSStyleRule)){if(rule.cssRules)visit(rule.cssRules);continue}
        const used=[...rule.style.cssText.matchAll(/var\((--[\w-]+)\s*\)/g)].map(m=>m[1])
        if(!used.length)continue
        let elements=[];try{elements=[...document.querySelectorAll(rule.selectorText)]}catch{continue}
        for(const el of elements.slice(0,20))for(const name of used)if(!getComputedStyle(el).getPropertyValue(name).trim())missing.add(`${name} in ${rule.selectorText}`)
      }}
      for(const sheet of document.styleSheets){try{visit(sheet.cssRules)}catch{}}
      return [...missing]
    })
    expect(undefinedVars,'CSS custom properties used on this page but not defined').toEqual([])
    if(['guide.html','services.html','404.html','interoperability.html'].includes(file)){
      const result=await new AxeBuilder({page}).analyze()
      expect(result.violations.filter(v=>['serious','critical'].includes(v.impact)),JSON.stringify(result.violations)).toEqual([])
    }
    // Candidates are review artifacts. Missing baselines FAIL; CI never blesses them.
    const destination=path.join('visual-candidates',info.project.name,lang,file.replace('.html','.png'))
    await mkdir(path.dirname(destination),{recursive:true})
    // The matcher settles consecutive full-page captures. Save the candidate
    // afterwards so the proposal is the same settled layout the gate evaluates.
    try{
      if(!GENERATED_EACH_RUN.has(file))await expect(page).toHaveScreenshot([lang,file.replace('.html','.png')],{fullPage:true,scale:'css',timeout:15000})
    }finally{
      await page.screenshot({path:destination,fullPage:true,scale:'css',animations:'disabled',caret:'hide'})
    }
  })
}

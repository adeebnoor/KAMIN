import {test,expect} from '@playwright/test'
import {mkdir,readdir} from 'node:fs/promises'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'

// Discover every built public page: new pages cannot silently escape the gate.
const pages=(await readdir('dist/ar')).filter(file=>file.endsWith('.html')).sort()
for(const lang of ['ar','en'])for(const file of pages){
  test(`public design ${lang}/${file}`,async({page},info)=>{
    await page.goto(`/${lang}/${file==='index.html'?'':file}`)
    await page.evaluate(()=>document.fonts.ready)
    const title=page.locator('h1:visible')
    await expect(title).toHaveCount(1)
    const typography=await title.evaluate(el=>{
      const style=getComputedStyle(el)
      return {family:style.fontFamily,size:style.fontSize,weight:style.fontWeight,synthesis:style.fontSynthesis,color:style.color,faces:[...document.fonts].map(f=>({family:f.family.replace(/["']/g,''),weight:f.weight,status:f.status}))}
    })
    expect(typography.family).toContain(lang==='ar'?'Noto Sans Arabic Variable':'Inter')
    expect(typography.weight).toBe('800')
    expect(typography.synthesis).toBe('none')
    expect(typography.color).toBe(file==='index.html'?'rgb(255, 255, 255)':'rgb(11, 47, 91)')
    expect(typography.faces).toEqual(expect.arrayContaining([expect.objectContaining({family:lang==='ar'?'Noto Sans Arabic Variable':'Inter',weight:'100 900',status:'loaded'})]))
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    if(['guide.html','services.html','404.html','interoperability.html'].includes(file)){
      const result=await new AxeBuilder({page}).analyze()
      expect(result.violations.filter(v=>['serious','critical'].includes(v.impact)),JSON.stringify(result.violations)).toEqual([])
    }
    // Candidates are review artifacts. Missing baselines FAIL; CI never blesses them.
    const destination=path.join('visual-candidates',info.project.name,lang,file.replace('.html','.png'))
    await mkdir(path.dirname(destination),{recursive:true})
    await page.screenshot({path:destination,fullPage:true,scale:'css',animations:'disabled',caret:'hide'})
    await expect(page).toHaveScreenshot([lang,file.replace('.html','.png')],{fullPage:true,scale:'css'})
  })
}

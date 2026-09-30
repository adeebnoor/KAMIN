import {test,expect} from '@playwright/test'

// The product ships one audited light theme (index.html declares color-scheme: light).
// An operating-system dark preference must not degrade readability anywhere in the
// student workspace. This gate measures rendered text against WCAG 2.1 AA contrast
// (4.5:1 body text, 3:1 large text) and fails on the first regression in either scheme.
const sweep=selector=>{
 const root=document.querySelector(selector)
 if(!root)return [{missing:selector}]
 const parse=c=>(c.match(/[\d.]+/g)||[]).slice(0,4).map(Number)
 const channel=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}
 const luminance=([r,g,b])=>0.2126*channel(r)+0.7152*channel(g)+0.0722*channel(b)
 const failures=[]
 for(const el of root.querySelectorAll('h1,h2,h3,h4,h5,p,span,label,th,td,button,a,small,b,strong,li,summary,code,dt,dd')){
  const text=(el.innerText||'').trim()
  if(!text||el.offsetParent===null)continue
  if([...el.children].some(child=>(child.innerText||'').trim()===text))continue
  const style=getComputedStyle(el)
  let background='rgba(0, 0, 0, 0)',node=el,painted=true
  while(node&&(background==='rgba(0, 0, 0, 0)'||background==='transparent')){
   const s=getComputedStyle(node);background=s.backgroundColor
   if(background==='rgba(0, 0, 0, 0)'&&s.backgroundImage!=='none'){painted=false;break}
   node=node.parentElement
  }
  if(!painted)continue
  const fg=parse(style.color),bg=parse(background)
  if(fg.length<3||bg.length<3||(bg[3]!==undefined&&bg[3]<0.9)||(fg[3]!==undefined&&fg[3]<0.9))continue
  const l1=luminance(fg),l2=luminance(bg)
  const ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)
  const size=parseFloat(style.fontSize),weight=parseInt(style.fontWeight,10)
  const large=size>=24||(size>=18.66&&weight>=700)
  if(ratio<(large?3:4.5))failures.push({text:text.slice(0,50),tag:el.tagName,className:String(el.className).slice(0,60),color:style.color,background,ratio:+ratio.toFixed(2)})
  if(failures.length>=12)break
 }
 return failures
}

for(const scheme of ['light','dark'])for(const lang of ['ar','en']){
 const ar=lang==='ar'
 test.describe(`${scheme} scheme · ${lang}`,()=>{
  test.use({colorScheme:scheme})
  test('landing and student workspace keep WCAG AA text contrast',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message))
   await page.goto(`/${lang}/`)
   await page.evaluate(()=>document.fonts.ready)
   expect(await page.evaluate(sweep,'main'),'landing').toEqual([])
   await page.getByRole('button',{name:ar?'جرّب ببيانات توضيحية':'Try with sample data',exact:true}).click()
   await expect(page.locator('.pilot-sample-note')).toBeVisible()
   expect(await page.evaluate(sweep,'.app-overlay'),'transcript review').toEqual([])
   await page.getByRole('checkbox',{name:ar?/أوافق صراحةً/:/I explicitly consent/}).check()
   await page.getByRole('button',{name:ar?/أعتمد السجل/:/Approve/}).last().click()
   await expect(page.getByText(ar?/هذه قدراتك/:/This is how your capabilities look now/)).toBeVisible()
   expect(await page.evaluate(sweep,'.app-overlay'),'dashboard').toEqual([])
   const sections=page.locator('.app-overlay nav button, .app-overlay aside button').filter({visible:true})
   const count=await sections.count()
   for(let index=0;index<count;index++){
    const button=sections.nth(index)
    if(!await button.isVisible())continue
    const name=(await button.innerText()).trim().split('\n')[0]
    await button.click()
    await page.waitForTimeout(150)
    expect(await page.evaluate(sweep,'.app-overlay'),`section: ${name}`).toEqual([])
   }
   expect(errors).toEqual([])
  })
 })
}

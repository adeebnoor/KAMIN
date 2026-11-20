import {test,expect} from './fixtures.js'

// Task 14: the home page has five sections (hero, how it works, why you can trust it, FAQ,
// closing); "Start" is visible without scrolling; moved content lives on public pages.
for(const lang of ['ar','en']){
 const t=lang==='ar'
  ?{start:'ابنِ ملف قدراتك',example:'جرّب مثالًا حيًا',idea:'الفكرة التي بُني عليها كامن',who:'من أين تبدأ؟',proof:'ملف واحد. علاقات تكشف أكثر.',honest:'ابنِ ملفًا يشبهك',clue:'درجة المقرر قرينة على مخرج تعلم متوقع'}
  :{start:'Build your capability profile',example:'Try a live example',idea:'The idea behind Kamin',who:'Where would you like to start?',proof:'One profile. Connections that reveal more.',honest:'Build a profile that reflects you.',clue:'A course grade is a clue to an expected learning outcome'}

 test(`${lang}: five sections, a short collapsed FAQ, and the clue-not-guarantee principle`,async({page})=>{
  await page.goto(`/${lang}/`)
  const sections=page.locator('.landing-v3 > section')
  await expect(sections).toHaveCount(5)
  expect(await sections.evaluateAll(list=>list.map(s=>s.id||s.className.split(' ')[0]))).toEqual(['home','how','trust','home-faq','v2-final'])
  const faq=page.locator('#home-faq > details')
  const n=await faq.count()
  expect(n).toBeGreaterThanOrEqual(4); expect(n).toBeLessThanOrEqual(6)
  for(let i=0;i<n;i++) expect(await faq.nth(i).evaluate(d=>d.open)).toBe(false)
  await expect(page.locator('#trust')).toContainText(t.clue)
  await expect(page.locator('.pilot-advanced')).not.toHaveAttribute('open','')
 })

 for(const viewport of [{width:1366,height:768},{width:360,height:740}]){
  test(`${lang} ${viewport.width}px: "Start" and the example are visible without scrolling`,async({page})=>{
   await page.setViewportSize(viewport)
   await page.goto(`/${lang}/`)
   const hero=page.locator('#home')
   await expect(hero.getByRole('button',{name:t.start,exact:true})).toBeInViewport({ratio:1})
   await expect(hero.getByRole('button',{name:t.example,exact:true})).toBeInViewport({ratio:1})
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true)
  })
 }

 test(`${lang}: "Learn more" links work and the moved content is on its new page`,async({page,request})=>{
  await page.goto(`/${lang}/`)
  const links=await page.locator('#trust .k-learn-more a').evaluateAll(as=>as.map(a=>a.getAttribute('href')))
  expect(links.length).toBe(5)
  for(const href of links){const response=await request.get(href.split('#')[0]);expect(response.ok(),href).toBeTruthy()}
  await page.goto(`/${lang}/about.html`); await expect(page.locator('#idea')).toContainText(t.idea)
  await page.goto(`/${lang}/services.html`); await expect(page.locator('#who-for')).toContainText(t.who); await expect(page.locator('#services-proof')).toContainText(t.proof)
  await page.goto(`/${lang}/trust.html`); await expect(page.locator('#honest-profile')).toContainText(t.honest)
 })
}

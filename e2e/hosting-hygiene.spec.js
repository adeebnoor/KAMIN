import {test,expect} from '@playwright/test'

// Findings from the 30 September 2026 pre-investor audit, each turned into a check.
test('security contact is published as RFC 9116 security.txt',async({request})=>{
 const response=await request.get('/.well-known/security.txt')
 expect(response.status()).toBe(200)
 const body=await response.text()
 expect(body).toMatch(/^Contact: https:\/\//m)
 expect(body).toMatch(/^Expires: 20\d\d-/m)
 expect(body).toMatch(/^Preferred-Languages: ar, en$/m)
})

test('installed app opens on the language the student last used',async({request})=>{
 for(const file of ['/manifest.json','/manifest.webmanifest']){
  const manifest=await (await request.get(file)).json()
  expect(manifest.start_url,file).toBe('/')
  expect(manifest.scope,file).toBe('/')
 }
})

for(const lang of ['ar','en']){
 const ar=lang==='ar'
 test(`dated release notes appear on the changelog only: ${lang}`,async({page})=>{
  const marker=ar?'أدوات البحث والمشاركة الجديدة':'Research and sharing tools'
  await page.goto(`/${lang}/changelog.html`)
  await expect(page.locator('main')).toContainText(marker)
  for(const file of ['privacy.html','trust.html','guide.html','services.html','interoperability.html']){
   await page.goto(`/${lang}/${file}`)
   await expect(page.locator('main'),file).not.toContainText(marker)
   await expect(page.locator('h1:visible')).toHaveCount(1)
  }
 })
}

test('landing does not preload assets it never renders',async({page})=>{
 const warnings=[]
 page.on('console',message=>{if(message.type()==='warning'&&/preload/i.test(message.text()))warnings.push(message.text())})
 await page.goto('/en/')
 await page.waitForTimeout(4000)
 expect(warnings).toEqual([])
 const preloads=await page.locator('link[rel="preload"]').evaluateAll(links=>links.map(link=>link.getAttribute('href')))
 for(const href of preloads)expect(href,'preloaded asset must be used by the landing page').toMatch(/\/fonts\//)
})

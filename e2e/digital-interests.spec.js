import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function start(page,lang='ar'){
  await page.goto(`/?lang=${lang}`)
  await page.getByRole('button',{name:lang==='ar'?'ابدأ بناء ملفك':'Build your profile',exact:true}).first().click()
  await page.getByRole('checkbox',{name:lang==='ar'?/أوافق على بناء ملف Person 360/:/I consent to building my Person 360/}).check()
  await page.getByRole('button',{name:lang==='ar'?'ابدأ بصمتي':'Start my profile',exact:true}).click()
}
async function enable(page){
  await page.getByRole('button',{name:'استكشف هذا المصدر',exact:true}).click()
  await page.getByRole('checkbox',{name:/أوافق على تحليل نصوص أختارها محليًا/}).check()
  await page.getByRole('button',{name:'فعّل التحليل الاختياري',exact:true}).click()
}
const readState=page=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-session-v3')))

test('sample is disposable and no consent or profile topic is silently added',async({page})=>{
  await start(page)
  await page.getByRole('button',{name:'جرّب مثالًا دون بياناتك',exact:true}).click()
  await expect(page.locator('.digital-candidates')).toContainText('تحليل البيانات')
  await expect(page.locator('#digital-posts')).toHaveCount(0)
  const add=page.getByRole('button',{name:'يمثلني — أضفه',exact:true})
  for(const button of await add.all()) await expect(button).toBeDisabled()
  expect((await readState(page)).insight.digitalInterests.analysisConsent).toBe(false)
  expect((await readState(page)).insight.digitalInterests.confirmed).toEqual([])
  await page.getByRole('button',{name:'تخطَّ واستكشف ملفك',exact:true}).click()
  await expect(page.getByRole('heading',{name:'شبكتي ومساعد القرار',exact:true})).toBeVisible()
})

test('review and a separate purpose permission gate semantic inference without posting or storing raw text',async({page})=>{
  await start(page);await enable(page)
  const requests=[]
  page.on('request',request=>requests.push(`${request.method()} ${request.url()} ${request.postData()||''}`))
  await page.getByLabel('نصوص اخترتها عن التعلم أو العمل',{exact:true}).fill('SYNTHETIC-PRIVATE-POST-731 أستمتع بتحليل البيانات وSQL.')
  expect(JSON.stringify(await readState(page))).not.toContain('SYNTHETIC-PRIVATE')
  await page.getByRole('button',{name:'اقترح اهتمامات لأراجعها',exact:true}).click()
  await expect(page.locator('#digital-posts')).toHaveValue('')
  expect((await readState(page)).insight.digitalInterests.confirmed).toEqual([])
  await page.getByRole('button',{name:'يمثلني — أضفه',exact:true}).click()
  let state=await readState(page)
  expect(state.insight.digitalInterests.confirmed).toHaveLength(1)
  expect(state.insight.digitalInterests.contextConsent).toBe(false)
  expect(JSON.stringify(state)).not.toContain('SYNTHETIC-PRIVATE')
  expect(requests.some(request=>request.includes('SYNTHETIC-PRIVATE')||request.startsWith('POST'))).toBe(false)
  await page.getByRole('button',{name:'استكشف شبكتي',exact:true}).click()
  await expect(page.locator('.inference-proof')).not.toContainText('R4')
  await page.getByRole('button',{name:'اهتماماتي وهدفي',exact:true}).first().click()
  await page.getByRole('button',{name:'استكشف هذا المصدر',exact:true}).click()
  await page.getByRole('checkbox',{name:/أسمح باستخدام اهتماماتي المؤكدة/}).check()
  await page.getByRole('button',{name:'استكشف شبكتي',exact:true}).click()
  await expect(page.locator('.inference-proof')).toContainText('R4')
  await expect(page.locator('.inference-limits')).toContainText('لا يوجد في هذا الملف دليل')
})

test('privacy withdrawal removes confirmed topics from persistent storage and the graph',async({page})=>{
  await start(page);await enable(page)
  await page.locator('#digital-posts').fill('أتعلم SQL وتحليل البيانات.')
  await page.getByRole('button',{name:'اقترح اهتمامات لأراجعها',exact:true}).click()
  await page.getByRole('button',{name:'يمثلني — أضفه',exact:true}).click()
  await page.getByRole('checkbox',{name:/أسمح باستخدام اهتماماتي المؤكدة/}).check()
  await page.getByRole('button',{name:/الخصوصية/}).first().click()
  await page.getByRole('button',{name:'الاحتفاظ بملفي على هذا الجهاز',exact:true}).click()
  await page.getByRole('button',{name:'اسحب الموافقة واحذف الاهتمامات الرقمية',exact:true}).click()
  await expect(page.locator('.digital-privacy-control')).toContainText('التحليل: غير مفعّل')
  const persisted=()=>page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('kamin-local-profile-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
    const value=await new Promise((resolve,reject)=>{const request=db.transaction('profiles').objectStore('profiles').get('current');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
    db.close();return value?.state?.insight?.digitalInterests
  })
  await expect.poll(async()=>(await persisted())?.analysisConsent).toBe(false)
  expect((await persisted()).confirmed).toEqual([])
  await page.reload()
  await page.getByRole('button',{name:'ابدأ بناء ملفك',exact:true}).first().click()
  await page.getByRole('button',{name:'استكشف شبكتي',exact:true}).click()
  await expect(page.locator('.inference-proof')).not.toContainText('R4')
})

test('English consent and review controls are accessible with no sensitive-source forms',async({page})=>{
  await start(page,'en')
  await page.getByRole('button',{name:'Explore this source',exact:true}).click()
  await expect(page.getByRole('button',{name:'Enable optional analysis',exact:true})).toBeDisabled()
  await page.getByRole('checkbox',{name:/I consent to local analysis of text I choose/}).check()
  await page.getByRole('button',{name:'Enable optional analysis',exact:true}).click()
  await page.getByLabel('Selected text about learning or work',{exact:true}).fill('I like UX and Figma.')
  await page.getByRole('button',{name:'Suggest interests for review',exact:true}).click()
  await expect(page.locator('.digital-candidates')).toContainText('Product design & user experience')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const accessibility=await new AxeBuilder({page}).analyze()
  expect(accessibility.violations.filter(item=>['serious','critical'].includes(item.impact)),JSON.stringify(accessibility.violations)).toEqual([])
  await page.getByRole('button',{name:'Does not reflect me',exact:true}).click()
  expect((await readState(page)).insight.digitalInterests.confirmed).toEqual([])
  await expect(page.locator('input[type=password]')).toHaveCount(0)
})

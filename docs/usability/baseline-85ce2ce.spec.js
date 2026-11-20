import {test,expect} from '@playwright/test'
import { Journey, writeResults } from './usability-lib.js'

// Task 15 · baseline: the same six journeys on commit 85ce2ce (Task 08, before the Tasks 09-14
// simplification), using that build's own labels and menus. Not part of `npm run e2e`.
// How to rerun: see docs/USABILITY_BASELINE.md.
const results={}
async function openApp(page,{fresh=true}={}){
 if(fresh){await page.goto('/ar/');await page.evaluate(()=>sessionStorage.clear())}
 await page.goto('/ar/')
 await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
 await expect(page.getByRole('dialog')).toBeVisible()
}
async function approvedProfile(page){ // setup, not counted
 await openApp(page)
 await page.getByRole('dialog').getByRole('button',{name:'جرّب المثال التوضيحي',exact:true}).click()
 await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
 await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
 await expect(page.getByTestId('open-my-data')).toBeVisible()
 await openApp(page,{fresh:false})
 await expect(page.getByTestId('open-my-data')).toBeVisible()
}
// The old menu: every item in the desktop sidebar; on phones, 4 items plus "More".
async function menu(j,page,name){
 const direct=page.getByRole('button',{name,exact:true}).filter({visible:true}).first()
 if(!(await direct.isVisible().catch(()=>false))) await j.click(page.getByRole('button',{name:/^المزيد$/}).filter({visible:true}).first(),'more')
 await j.click(page.getByRole('button',{name,exact:true}).filter({visible:true}).first(),name)
}
const keep=r=>{results[r.id]=r.result()}

test.describe.configure({mode:'serial'})

test('1 · build a profile',async({page})=>{
 await openApp(page)
 const reach=new Journey(page,'reach-upload'); await reach.start()
 await expect(page.getByRole('dialog').getByRole('button',{name:'جرّب المثال التوضيحي',exact:true})).toBeVisible()
 keep(reach)
 const j=new Journey(page,'build-profile'); await j.start()
 await j.click(page.getByRole('dialog').getByRole('button',{name:'جرّب المثال التوضيحي',exact:true}),'try the synthetic example')
 await j.check(page.getByRole('checkbox',{name:/أوافق صراحةً/}),'consent')
 await j.click(page.getByRole('button',{name:/أعتمد السجل/}).last(),'approve')
 await expect(page.getByTestId('open-my-data')).toBeVisible()
 keep(j)
})

test('2 · review evidence',async({page})=>{
 await approvedProfile(page)
 const j=new Journey(page,'open-evidence'); await j.start()
 await menu(j,page,'مهاراتي')
 await expect(page.locator('.skill-card .evidence-item').first()).toBeVisible()
 keep(j)
})

test('3 · understand a recommendation',async({page})=>{
 await approvedProfile(page)
 const j=new Journey(page,'understand-recommendation'); await j.start()
 await menu(j,page,'فرصي')
 const details=page.locator('.match-evidence-details').first()
 await j.click(details.locator('summary'),'open the explanation')
 expect(await details.evaluate(d=>d.open)).toBe(true)
 keep(j)
})

test('4 · choose a learning step',async({page})=>{
 await approvedProfile(page)
 const j=new Journey(page,'choose-learning-step'); await j.start()
 await menu(j,page,'الدورات')
 await j.click(page.locator('.fit-card').first().getByRole('button',{name:/قارن/}),'choose a course')
 await expect(page.locator('.fit-card .compare-button.selected').first()).toBeVisible()
 keep(j)
})

test('5 · save and restore',async({page})=>{
 await approvedProfile(page)
 const save=new Journey(page,'save-profile'); await save.start()
 await save.click(page.getByRole('button',{name:'نعم، احتفظ بملفي'}),'keep my profile')
 await expect(page.locator('.local-save-prompt')).toHaveCount(0)
 keep(save)
 const tmp=new Journey(page,'setup'); await menu(tmp,page,'الخصوصية')
 const pass='correct horse battery staple'
 await page.getByLabel('عبارة المرور',{exact:true}).fill(pass); await page.getByLabel(/تأكيد العبارة/).fill(pass)
 const download=page.waitForEvent('download'); await page.getByRole('button',{name:/تنزيل نسخة مشفّرة/}).click()
 const backup=await (await download).path()
 await page.evaluate(async()=>{sessionStorage.clear();await new Promise(r=>{const q=indexedDB.deleteDatabase('kamin-local-profile-v1');q.onsuccess=q.onerror=q.onblocked=()=>r()})})
 await openApp(page)
 const j=new Journey(page,'restore-backup'); await j.start()
 await menu(j,page,'الخصوصية')
 await j.fill(page.getByLabel('عبارة مرور النسخة المستعادة',{exact:true}),pass,'backup passphrase')
 const chooser=page.waitForEvent('filechooser')
 await j.click(page.getByRole('button',{name:'اختر ملف النسخة واستعدها'}),'choose the backup file')
 await (await chooser).setFiles(backup)
 await expect(page.getByTestId('open-my-data')).toBeVisible()
 keep(j)
})

test('6 · correct, withdraw, delete',async({page})=>{
 await approvedProfile(page)
 const fix=new Journey(page,'correct-record'); await fix.start()
 await fix.click(page.getByTestId('open-my-data'),'my data')
 await fix.fill(page.getByLabel('درجة CPIT-240'),'C','new grade')
 await fix.click(page.getByRole('button',{name:'احفظ التعديلات'}),'save')
 await fix.click(page.getByRole('alertdialog').getByRole('button',{name:'تأكيد وإعادة الحساب'}),'confirm')
 await expect(page.getByTestId('what-changed')).toBeVisible()
 keep(fix)

 await approvedProfile(page)
 const withdraw=new Journey(page,'withdraw-transcript-consent'); await withdraw.start()
 await menu(withdraw,page,'الخصوصية')
 await withdraw.uncheck(page.getByRole('checkbox',{name:/تحليل السجل وبناء ملف المهارات/}),'withdraw')
 await expect(page.getByTestId('what-changed')).toContainText('ما الذي تغيّر بعد سحب موافقة السجل؟')
 keep(withdraw)

 await approvedProfile(page)
 const del=new Journey(page,'delete-all-data'); await del.start()
 await menu(del,page,'الخصوصية')
 await del.click(page.getByRole('button',{name:/حذف بياناتي/}),'delete my data')
 await del.click(page.getByRole('button',{name:/نعم، احذف كل شيء من هذا الجهاز/}),'confirm')
 await expect(page.getByTestId('deleted-confirmation')).toContainText('حُذفت بياناتك من هذا الجهاز')
 keep(del)
})

test.afterAll(async({},info)=>{ writeResults(info.project.name,results,'test-results/usability-baseline.json') })

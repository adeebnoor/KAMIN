import {test,expect} from './fixtures.js'
import { readFileSync } from 'node:fs'
import { Journey, visibleChoices, writeResults } from './usability-lib.js'
import { openSection, openTab, openPrivacySection } from './nav.js'

// Task 15 · the six tasks of the 13 Oct usability run, by the shortest route, with a click budget
// (e2e/usability-budget.json). Each journey starts with the app open. Results:
// test-results/usability.json. Baseline and comparison: docs/USABILITY_BASELINE.md.
const BUDGET=JSON.parse(readFileSync(new URL('./usability-budget.json',import.meta.url),'utf8'))
const results={}
const nav=(page,id)=>page.locator(`nav button[data-section="${id}"]:visible`).first()

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
 await expect(page.locator('.capability-list')).toBeVisible()
 await openApp(page,{fresh:false})
 await expect(page.locator('.capability-list')).toBeVisible()
}
function record(id,j){results[id]=j.result();expect(j.clicks,`${id}: ${j.steps.join(' → ')}`).toBeLessThanOrEqual(BUDGET.clicks[id])}

test.describe.configure({mode:'serial'})

test('1 · build a profile (reach upload, then the synthetic example)',async({page})=>{
 await openApp(page)
 const reach=new Journey(page,'reach-upload'); await reach.start()
 await expect(page.locator('.onboarding-upload')).toBeVisible()
 record('reach-upload',reach)
 expect(reach.choicesAtStart,'choices on the start screen').toBeLessThanOrEqual(BUDGET.choices['start-screen'])
 const j=new Journey(page,'build-profile'); await j.start()
 await j.click(page.getByRole('dialog').getByRole('button',{name:'جرّب المثال التوضيحي',exact:true}),'try the synthetic example')
 await j.check(page.getByRole('checkbox',{name:/أوافق صراحةً/}),'consent')
 await j.click(page.getByRole('button',{name:/أعتمد السجل/}).last(),'approve')
 await expect(page.locator('.capability-list')).toBeVisible()
 record('build-profile',j)
})

test('2 · review evidence (open a capability’s evidence)',async({page})=>{
 await approvedProfile(page)
 const j=new Journey(page,'open-evidence'); await j.start()
 expect(j.choicesAtStart,'choices on the dashboard').toBeLessThanOrEqual(BUDGET.choices['dashboard'])
 await j.click(page.locator('.capability-row').first(),'open a capability')
 await expect(page.locator('.capability-detail .evidence-item').first()).toBeVisible()
 record('open-evidence',j)
})

test('3 · understand a recommendation (its evidence, gaps and explanation)',async({page})=>{
 await approvedProfile(page)
 const j=new Journey(page,'understand-recommendation'); await j.start()
 await j.click(nav(page,'next'),'my next step')
 // Task 23: the Matches page at load stays within its choices budget (it had 111 controls).
 await page.locator('.match-row').first().waitFor()
 const matchesChoices=await visibleChoices(page)
 expect(matchesChoices,'choices on the matches page').toBeLessThanOrEqual(BUDGET.choices['matches'])
 // Task 23: opening a row shows its evidence, gaps and explanation (it was a <details> in a long card).
 const row=page.locator('.match-row').first()
 await j.click(row.locator('.match-toggle'),'open the explanation')
 await expect(row.locator('.match-toggle')).toHaveAttribute('aria-expanded','true')
 await expect(row.getByTestId('match-evidence')).toBeVisible()
 record('understand-recommendation',j)
})

test('4 · choose a learning step (add a course to the comparison)',async({page})=>{
 await approvedProfile(page)
 const j=new Journey(page,'choose-learning-step'); await j.start()
 await j.click(nav(page,'next'),'my next step')
 await j.click(page.getByRole('tab',{name:'الدورات'}),'courses')
 await j.click(page.locator('.fit-card').first().getByRole('button',{name:/قارن/}),'choose a course')
 await expect(page.locator('.fit-card').first().getByRole('button',{name:/قارن/}).locator('svg')).toBeVisible()
 record('choose-learning-step',j)
})

test('5 · save on this device, and restore from an encrypted backup',async({page})=>{
 await approvedProfile(page)
 const save=new Journey(page,'save-profile'); await save.start()
 await save.click(page.getByRole('button',{name:'نعم، احتفظ بملفي'}),'keep my profile')
 await expect(page.getByTestId('saved-note')).toBeVisible()
 record('save-profile',save)
 // setup (not counted): make a backup, then start a fresh session
 await openSection(page,'my-data'); await openTab(page,'الموافقات والحفظ والحذف'); await openPrivacySection(page,'backup')
 const pass='correct horse battery staple'
 await page.getByLabel('عبارة المرور',{exact:true}).fill(pass); await page.getByLabel(/تأكيد العبارة/).fill(pass)
 const download=page.waitForEvent('download'); await page.getByRole('button',{name:/تنزيل نسخة مشفّرة/}).click()
 const backup=await (await download).path()
 await page.evaluate(async()=>{sessionStorage.clear();await new Promise(r=>{const q=indexedDB.deleteDatabase('kamin-local-profile-v1');q.onsuccess=q.onerror=q.onblocked=()=>r()})})
 await openApp(page)
 const j=new Journey(page,'restore-backup'); await j.start()
 await j.click(nav(page,'my-data'),'my data')
 await j.fill(page.getByLabel('عبارة مرور النسخة المستعادة',{exact:true}),pass,'backup passphrase')
 const chooser=page.waitForEvent('filechooser')
 await j.click(page.getByRole('button',{name:'اختر ملف النسخة واستعدها'}),'choose the backup file')
 await (await chooser).setFiles(backup)
 await expect(page.locator('.capability-list')).toBeVisible()
 record('restore-backup',j)
})

test('6 · correct the record, withdraw transcript consent, delete all data',async({page})=>{
 await approvedProfile(page)
 const fix=new Journey(page,'correct-record'); await fix.start()
 await fix.click(nav(page,'my-data'),'my data')
 await fix.fill(page.getByLabel('درجة CPIT-240'),'C','new grade')
 await fix.click(page.getByRole('button',{name:'احفظ التعديلات'}),'save')
 await fix.click(page.getByRole('alertdialog').getByRole('button',{name:'تأكيد وإعادة الحساب'}),'confirm')
 await expect(page.getByTestId('what-changed')).toBeVisible()
 record('correct-record',fix)

 await approvedProfile(page)
 const withdraw=new Journey(page,'withdraw-transcript-consent'); await withdraw.start()
 await withdraw.click(nav(page,'my-data'),'my data')
 await withdraw.click(page.getByRole('tab',{name:'الموافقات والحفظ والحذف'}),'consents')
 await withdraw.uncheck(page.getByRole('checkbox',{name:/تحليل السجل وبناء ملف المهارات/}),'withdraw')
 await expect(page.getByTestId('what-changed')).toContainText('ما الذي تغيّر بعد سحب موافقة السجل؟')
 record('withdraw-transcript-consent',withdraw)

 await approvedProfile(page)
 const del=new Journey(page,'delete-all-data'); await del.start()
 await del.click(nav(page,'my-data'),'my data')
 await del.click(page.getByTestId('delete-all-shortcut'),'delete all my data')
 await del.click(page.getByRole('button',{name:/نعم، احذف كل شيء من هذا الجهاز/}),'confirm')
 await expect(page.getByTestId('deleted-confirmation')).toContainText('حُذفت بياناتك من هذا الجهاز')
 record('delete-all-data',del)
})

test.afterAll(async({},info)=>{ writeResults(info.project.name,results) })

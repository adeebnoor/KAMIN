import {test,expect} from './fixtures.js'
import { openView, openPrivacySection } from './nav.js'

// Task 06: deletion and consent withdrawal say exactly what was removed, and the deleted data is
// gone from sessionStorage, localStorage and IndexedDB.

async function approveAndKeep(page){
 await page.goto('/ar/')
 await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
 await page.getByRole('dialog').getByRole('button',{name:'جرّب المثال التوضيحي',exact:true}).click()
 await page.getByRole('checkbox',{name:/أوافق صراحةً/}).check()
 await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
 await page.getByRole('button',{name:/نعم، احتفظ بملفي/}).click()
 await expect(page.getByTestId('open-my-data')).toBeVisible()
}
// Everything KAMIN keeps in this browser, as one string.
const storage=page=>page.evaluate(async()=>{
 const session=Object.keys(sessionStorage).map(k=>`${k}=${sessionStorage.getItem(k)}`).join('\n')
 const local=Object.keys(localStorage).map(k=>`${k}=${localStorage.getItem(k)}`).join('\n')
 const names=typeof indexedDB.databases==='function'?(await indexedDB.databases()).map(d=>d.name):[]
 let idb=''
 if(names.includes('kamin-local-profile-v1')){
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('kamin-local-profile-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
  if(db.objectStoreNames.contains('profiles')) idb=JSON.stringify(await new Promise(resolve=>{const r=db.transaction('profiles').objectStore('profiles').get('current');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null)}))
  db.close()
 }
 return {session,local,idb,all:`${session}\n${local}\n${idb}`,hasDb:names.includes('kamin-local-profile-v1')}
})

test('deleting one course names it, drops only its capability and removes it from every store',async({page})=>{
 await approveAndKeep(page)
 await expect.poll(async()=>(await storage(page)).idb).toContain('STAT-110')
 await page.getByTestId('open-my-data').click()
 await page.getByRole('button',{name:'حذف STAT-110'}).click()
 const confirm=page.getByTestId('delete-item-confirm')
 await expect(confirm).toContainText('لا يمكن التراجع عن الحذف')
 await confirm.getByRole('button',{name:'احذف نهائيًا'}).click()
 const changed=page.getByTestId('what-changed')
 await expect(changed).toContainText('ما الذي حُذف؟')
 await expect(changed).toContainText('حُذف مقرر «STAT-110» من هذا الجهاز')
 await expect(changed).toContainText('أُزيلت قدرة «التحليل الكمي» — السبب: حُذف المقرر من سجلك')
 await expect(changed).toContainText('حكم ملاءمة')
 await expect(changed).toContainText('بقيت مقرراتك الأخرى')
 await expect(changed).not.toContainText('urn:kamin')
 await expect(page.locator('tr[data-course="STAT-110"]')).toHaveCount(0)
 await expect(page.locator('tr[data-course="CPIT-240"]')).toHaveCount(1)
 await expect.poll(async()=>(await storage(page)).all).not.toContain('STAT-110')
 const after=await storage(page)
 expect(after.idb).toContain('CPIT-240')
 // the audit line has the type and count, never the course itself
 expect(after.session).toContain('حذف عنصر: مقرر (1)')
})

test('withdrawing transcript consent names what was deleted and what stayed, and leaves no course in storage',async({page})=>{
 await approveAndKeep(page)
 await openView(page,'الخصوصية')
 await page.getByRole('checkbox',{name:/تحليل السجل وبناء ملف المهارات/}).uncheck()
 const changed=page.getByTestId('what-changed')
 await expect(changed).toContainText('ما الذي تغيّر بعد سحب موافقة السجل؟')
 await expect(changed).toContainText('المقررات المحذوفة: CPIT-250')
 await expect(changed).toContainText('أُزيلت قدرة «قواعد البيانات» — السبب: سحبت موافقة تحليل السجل')
 await expect(changed).toContainText('حكم ملاءمة')
 await expect(changed).toContainText('بقي كما هو: اهتماماتك وتفضيلاتك وهدفك')
 await expect(changed).toContainText('فلن تعود البيانات المحذوفة')
 await expect.poll(async()=>(await storage(page)).all).not.toMatch(/CPIT-|STAT-110|CPIS-334/)
 const after=await storage(page)
 expect(after.idb).toContain('"approved":false')
 // granting again says deleted data does not come back
 await page.getByRole('checkbox',{name:/تحليل السجل وبناء ملف المهارات/}).check()
 await expect(changed).toContainText('مُنحت موافقة')
 await expect(changed).toContainText('فلن تعود البيانات المحذوفة')
})

test('withdrawing profile consent removes goal and preferences but keeps academic evidence',async({page})=>{
 await approveAndKeep(page)
 await openView(page,'الخصوصية')
 await page.getByRole('checkbox',{name:/بناء بصمة الطالب الذاتية/}).check()
 await openView(page,'لوحة قدراتي')
 const goals=page.locator('.panel').filter({has:page.getByRole('heading',{name:'ما الذي تريد الوصول إليه؟'})})
 await goals.getByRole('button',{name:'تحليل البيانات',exact:true}).click()
 await expect.poll(async()=>(await storage(page)).idb).toContain('"goal":"data"')
 await openView(page,'الخصوصية')
 await page.getByRole('checkbox',{name:/بناء بصمة الطالب الذاتية/}).uncheck()
 const changed=page.getByTestId('what-changed')
 await expect(changed).toContainText('ما الذي تغيّر بعد سحب موافقة البصمة؟')
 await expect(changed).toContainText('أُلغي الهدف المختار')
 await expect(changed).toContainText('الأدلة الأكاديمية بقيت كما هي')
 await expect(changed).toContainText('لم تتغير أي قدرة')
 await expect.poll(async()=>(await storage(page)).idb).not.toContain('"goal":"data"')
 const after=await storage(page)
 expect(after.idb).toContain('CPIT-240')
 expect(after.session).not.toContain('"goal":"data"')
})

test('delete everything lists what goes, warns about copies outside KAMIN, then verifies the device is empty',async({page})=>{
 await approveAndKeep(page)
 await openView(page,'الخصوصية')
 await openPrivacySection(page,'delete') // Task 27
 await page.getByRole('button',{name:/حذف بياناتي/}).click()
 const confirm=page.getByTestId('delete-everything-confirm')
 await expect(confirm).toContainText('7 مقررات')
 await expect(confirm).toContainText('IndexedDB')
 await expect(confirm).toContainText('النسخ المشفّرة التي نزّلتها سابقًا')
 await expect(confirm).toContainText('روابط المشاركة')
 await confirm.getByRole('button',{name:/نعم، احذف كل شيء من هذا الجهاز/}).click()
 const done=page.getByTestId('deleted-confirmation')
 await expect(done).toContainText('حُذفت بياناتك من هذا الجهاز')
 await expect(done).toContainText('تحققنا')
 const after=await storage(page)
 expect(after.hasDb).toBe(false)
 expect(after.session).not.toContain('kamin-session')
 // Only interface choices stay: the language and (Task 69) the 'kamin-ui=old' that ?ui=old leaves, which opens the old
 // interface for these tests (e2e/fixtures.js); "delete everything" keeps it by Task 60's rule (KEPT_INTERFACE_KEYS).
 expect(after.local.split('\n').filter(Boolean).every(line=>line.startsWith('kamin-lang=')||line==='kamin-ui=old'),after.local).toBe(true)
 expect(after.all).not.toMatch(/CPIT-|STAT-110/)
})

test('English: deleting a course explains it in English',async({page})=>{
 await page.goto('/en/')
 await page.getByRole('button',{name:/Open workspace/}).first().click()
 await page.getByRole('dialog').getByRole('button',{name:'Try synthetic demo',exact:true}).click()
 await page.getByRole('checkbox',{name:/I explicitly consent/}).check()
 await page.getByRole('button',{name:/Approve transcript/}).last().click()
 await page.getByTestId('open-my-data').click()
 await page.getByRole('button',{name:'Delete STAT-110'}).click()
 await page.getByTestId('delete-item-confirm').getByRole('button',{name:'Delete permanently'}).click()
 const changed=page.getByTestId('what-changed')
 await expect(changed).toContainText('What was deleted?')
 await expect(changed).toContainText('Deleted the course “STAT-110” from this device.')
 await expect(changed).toContainText('Removed “Quantitative analysis” — because the course was removed from your record.')
})

// Task 15: the last two tasks of the 13 Oct run were hard to find. "My data" now ends with a
// shortcut to consents and one to delete everything; the shortcut still asks for confirmation.
test('My data links straight to consents and to delete everything, which still asks first (Arabic and English)',async({page})=>{
 await approveAndKeep(page)
 await page.getByTestId('open-my-data').click()
 await page.getByRole('button',{name:'الموافقات والنسخ الاحتياطي'}).click()
 await expect(page.getByRole('tab',{name:'الموافقات والحفظ والحذف'})).toHaveAttribute('aria-selected','true')
 await expect(page.getByTestId('delete-everything-confirm')).toHaveCount(0)
 await page.getByRole('tab',{name:'مراجعة وتصحيح'}).click()
 await page.getByTestId('delete-all-shortcut').click()
 const confirm=page.getByTestId('delete-everything-confirm')
 await expect(confirm).toBeInViewport()
 await expect(confirm).toContainText('7 مقررات')
 await confirm.getByRole('button',{name:'إلغاء'}).click()
 await expect(confirm).toHaveCount(0)
 expect((await storage(page)).idb).toContain('CPIT-240')

 await page.goto('/en/')
 await page.getByRole('button',{name:/Open workspace/}).first().click()
 await page.getByTestId('open-my-data').click()
 await expect(page.getByRole('button',{name:'Consents and backup'})).toBeVisible()
 await page.getByRole('button',{name:'Delete all my data from this device'}).click()
 await expect(page.getByTestId('delete-everything-confirm')).toContainText(/Yes, delete everything/)
})

// Task 15: the "add project evidence" form starts closed on the dashboard, so it does not add
// 17 controls to a screen the student did not ask to edit; it is one click away.
test('the dashboard project-evidence form starts closed and opens with one click',async({page})=>{
 await approveAndKeep(page)
 const panel=page.getByTestId('project-evidence')
 await expect(panel).toBeVisible()
 await expect(panel.locator('form')).toHaveCount(0)
 await panel.getByRole('button',{name:'أضف دليل مشروع',exact:true}).click()
 await expect(panel.getByLabel('عنوان الدليل')).toBeVisible()
})

// Task 46: the usage log says what happened, never the file name (it often holds the student's name) or a
// project title, and delete / withdraw leave no trace of them. Every name here is made up.
const MADE_UP_FILE='Transcript_TEST-NAME_0000001.txt'
const FILE_PARTS=['TEST-NAME','Transcript_TEST','_0000001']
const MADE_UP_TITLE='TEST PROJECT TITLE'
test('Task 46: no part of an uploaded file name, and no deleted project title, stays in storage or the usage log',async({page})=>{
 await page.goto('/ar/')
 await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
 await page.locator('#kamin-transcript-file').setInputFiles({name:MADE_UP_FILE,mimeType:'text/plain',buffer:Buffer.from('CPIT 251 Systems Analysis and Design 3 A 15.00\nCPIT 240 Database Management 3 B+ 12.00','utf8')})
 const consent=page.getByRole('checkbox',{name:/أوافق صراحةً/})
 await expect(consent).toBeVisible()
 // The upload is in the usage log, without the file name.
 await expect.poll(async()=>(await storage(page)).session).toContain('قُرئ كشف الدرجات على هذا الجهاز')
 const afterUpload=await storage(page)
 for(const part of FILE_PARTS) expect(afterUpload.all).not.toContain(part)

 await consent.check()
 await page.getByRole('button',{name:/أعتمد السجل/}).last().click()
 await page.getByRole('button',{name:/نعم، احتفظ بملفي/}).click()
 const panel=page.getByTestId('project-evidence')
 await panel.getByRole('button',{name:'أضف دليل مشروع',exact:true}).click()
 await panel.getByLabel('عنوان الدليل').fill(MADE_UP_TITLE)
 await panel.getByRole('group',{name:'القدرات التي يخدمها هذا الدليل'}).getByRole('checkbox').first().check()
 await panel.getByRole('button',{name:'سجّل الدليل محليًا',exact:true}).click()
 await expect(panel.locator('.project-evidence-list li')).toHaveCount(1)
 // The project keeps its title (it is the student's evidence); the usage log line does not copy it.
 await expect.poll(async()=>(await storage(page)).idb).toContain(MADE_UP_TITLE)
 const audit=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-session-v3')).audit)
 expect(audit.map(entry=>entry.label)).toContain('أُضيف دليل مشروع')
 expect(JSON.stringify(audit)).not.toContain(MADE_UP_TITLE)

 await panel.locator('.project-evidence-list li').getByRole('button',{name:'حذف',exact:true}).click()
 await expect(panel.locator('.project-evidence-list li')).toHaveCount(0)
 await expect.poll(async()=>(await storage(page)).all).not.toContain(MADE_UP_TITLE)

 await openView(page,'الخصوصية')
 await page.getByRole('checkbox',{name:/تحليل السجل وبناء ملف المهارات/}).uncheck()
 await expect(page.getByTestId('what-changed')).toContainText('ما الذي تغيّر بعد سحب موافقة السجل؟')
 const end=await storage(page)
 for(const text of [...FILE_PARTS,MADE_UP_TITLE]) expect(end.all).not.toContain(text)

 // Still one line per event, with its time.
 await openView(page,'سجل الاستخدام')
 const log=page.locator('.audit-list')
 await expect(log).toContainText('قُرئ كشف الدرجات على هذا الجهاز')
 await expect(log).toContainText('أُضيف دليل مشروع')
 await expect(log).not.toContainText('TEST')
 await expect(log.locator('.audit-item small').first()).not.toBeEmpty()
})

test('Task 46: a session saved before Task 46 loses its file-name and project-title lines when KAMIN opens',async({page})=>{
 await page.goto('/ar/')
 await page.evaluate(()=>{
  sessionStorage.setItem('kamin-session-v3',JSON.stringify({
   courses:[],approved:false,goal:'data',
   consents:{analyze:false,insight:false,advisor:false,research:false},
   audit:[
    {label:'Self-declared applied evidence recorded: TEST PROJECT TITLE',ts:1763380000500},
    {label:'تسجيل دليل تطبيقي مصرّح: TEST PROJECT TITLE',ts:1763380000400},
    {label:'تغيير الهدف',ts:1763380000300},
    {label:'Local file read: Transcript_TEST-NAME_0000001.pdf',ts:1763380000200},
    {label:'قراءة ملف محلي: Transcript_TEST-NAME_0000001.pdf',ts:1763380000100},
   ],
  }))
 })
 await page.reload()
 await page.getByRole('button',{name:/افتح مساحة العمل/}).first().click()
 await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('kamin-session-v3')||'{}').audit)).toEqual([{label:'تغيير الهدف',ts:1763380000300}])
 const session=await page.evaluate(()=>sessionStorage.getItem('kamin-session-v3'))
 expect(session).toContain('"goal":"data"')
 for(const text of ['TEST-NAME','TEST PROJECT TITLE']) expect(session).not.toContain(text)
})

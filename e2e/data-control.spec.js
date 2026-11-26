import { test, expect } from '@playwright/test'
import { kamin } from './roles.js'

// Task 06: deletion and consent withdrawal say exactly what was removed, and the deleted data is gone from
// sessionStorage, localStorage and IndexedDB. Task 46: no file name and no deleted project title is ever kept.
// Task 70: rewritten on the interface (Settings → My courses, Consents, Save on this device, Delete everything,
// Usage log; step 1; step 2; My plan). Two tests of old screens are deleted (My data's shortcuts, the dashboard's
// project form): mapping in log/task-70.md.

async function approveAndKeep(page, lang = 'ar') {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.home()
  await app.openSaveOffer()
  await app.keepOnDevice()
  await expect(app.saveStatus()).toHaveAttribute('data-saved', 'true')
  // The saved message is the one message on the page; close it so the next one ("what changed") can show (Task 25).
  await app.closeNotice()
  return app
}
// Everything KAMIN keeps in this browser, as one string.
const storage = page => page.evaluate(async () => {
  const session = Object.keys(sessionStorage).map(k => `${k}=${sessionStorage.getItem(k)}`).join('\n')
  const local = Object.keys(localStorage).map(k => `${k}=${localStorage.getItem(k)}`).join('\n')
  const names = typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map(d => d.name) : []
  let idb = ''
  if (names.includes('kamin-local-profile-v1')) {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('kamin-local-profile-v1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    if (db.objectStoreNames.contains('profiles')) idb = JSON.stringify(await new Promise(resolve => { const r = db.transaction('profiles').objectStore('profiles').get('current'); r.onsuccess = () => resolve(r.result || null); r.onerror = () => resolve(null) }))
    db.close()
  }
  return { session, local, idb, all: `${session}\n${local}\n${idb}`, hasDb: names.includes('kamin-local-profile-v1') }
})
const sessionState = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3') || '{}'))

test('deleting one course names it, drops only its capability and removes it from every store', async ({ page }) => {
  const app = await approveAndKeep(page)
  await expect.poll(async () => (await storage(page)).idb).toContain('STAT-110')
  await app.openMyData()
  const confirm = await app.askDeleteCourse('STAT-110')
  await expect(page.getByTestId('delete-item-confirm')).toContainText('لا يمكن التراجع عن الحذف')
  await app.confirmDeleteOne()
  const changed = page.getByTestId('what-changed')
  await expect(changed).toContainText('ما الذي حُذف؟')
  await expect(changed).toContainText('حُذف مقرر «STAT-110» من هذا الجهاز')
  await expect(changed).toContainText('أُزيلت قدرة «التحليل الكمي» — السبب: حُذف المقرر من سجلك')
  await expect(changed).toContainText('حكم ملاءمة')
  await expect(changed).toContainText('بقيت مقرراتك الأخرى')
  await expect(changed).not.toContainText('urn:kamin')
  await expect(app.myGrade('STAT-110')).toHaveCount(0)
  await expect(app.myGrade('CPIT-240')).toHaveCount(1)
  await expect.poll(async () => (await storage(page)).all).not.toContain('STAT-110')
  const after = await storage(page)
  expect(after.idb).toContain('CPIT-240')
  // the audit line has the type and count, never the course itself
  expect(after.session).toContain('حذف عنصر: مقرر (1)')
})

test('withdrawing transcript consent names what was deleted and what stayed, and leaves no course in storage', async ({ page }) => {
  const app = await approveAndKeep(page)
  await app.openConsents()
  await app.consent('analyze').uncheck()
  const changed = page.getByTestId('what-changed')
  await expect(changed).toContainText('ما الذي تغيّر بعد سحب موافقة السجل؟')
  await expect(changed).toContainText('المقررات المحذوفة: CPIT-250')
  await expect(changed).toContainText('أُزيلت قدرة «قواعد البيانات» — السبب: سحبت موافقة تحليل السجل')
  await expect(changed).toContainText('حكم ملاءمة')
  await expect(changed).toContainText('بقي كما هو: اهتماماتك وتفضيلاتك وهدفك')
  await expect(changed).toContainText('فلن تعود البيانات المحذوفة')
  await expect.poll(async () => (await storage(page)).all).not.toMatch(/CPIT-|STAT-110|CPIS-334/)
  expect((await storage(page)).idb).toContain('"approved":false')
  // granting again says deleted data does not come back
  await app.consent('analyze').check()
  await expect(changed).toContainText('مُنحت موافقة')
  await expect(changed).toContainText('فلن تعود البيانات المحذوفة')
})

test('withdrawing profile consent removes goals and preferences but keeps academic evidence', async ({ page }) => {
  const app = await approveAndKeep(page)
  await app.openConsents()
  await app.consent('insight').check()
  await app.openGoals()
  await app.chooseGoal('data')
  await expect.poll(async () => (await sessionState(page)).goals?.length || 0).toBeGreaterThan(0)
  await expect.poll(async () => (await storage(page)).idb).toMatch(/"goals":\["[^"]+/)
  await app.openConsents()
  await app.consent('insight').uncheck()
  const changed = page.getByTestId('what-changed')
  await expect(changed).toContainText('ما الذي تغيّر بعد سحب موافقة البصمة؟')
  await expect(changed).toContainText('أُلغي الهدف المختار')
  await expect(changed).toContainText('الأدلة الأكاديمية بقيت كما هي')
  await expect(changed).toContainText('لم تتغير أي قدرة')
  await expect.poll(async () => (await storage(page)).idb).toContain('"goals":[]')
  const after = await storage(page)
  expect(after.idb).toContain('CPIT-240')
  expect((await sessionState(page)).goals).toEqual([])
})

test('delete everything lists what goes, warns about copies outside KAMIN, then verifies the device is empty', async ({ page }) => {
  const app = await approveAndKeep(page)
  const confirm = await app.askDeleteEverything()
  const box = page.getByTestId('delete-everything-confirm')
  await expect(box).toContainText('7 مقررات')
  await expect(box).toContainText('IndexedDB')
  await expect(box).toContainText('النسخ المشفّرة التي نزّلتها سابقًا')
  await expect(box).toContainText('روابط المشاركة')
  await app.confirmDeleteEverything()
  const done = app.deletedConfirmation()
  await expect(done).toContainText('حُذفت بياناتك من هذا الجهاز')
  await expect(done).toContainText('تحققنا')
  const after = await storage(page)
  expect(after.hasDb).toBe(false)
  expect(after.session).not.toContain('kamin-session')
  // Only interface choices stay: the language and the theme (KEPT_INTERFACE_KEYS; Task 70: 'kamin-ui' is retired).
  expect(after.local.split('\n').filter(Boolean).every(line => line.startsWith('kamin-lang=') || line.startsWith('kamin-theme=')), after.local).toBe(true)
  expect(after.all).not.toMatch(/CPIT-|STAT-110/)
})

test('a device that still holds the old interface choice (kamin-ui) is cleared by delete everything', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded-ui')) { localStorage.setItem('kamin-ui', 'old'); sessionStorage.setItem('seeded-ui', '1') } })
  const app = await approveAndKeep(page)
  await app.askDeleteEverything()
  await app.confirmDeleteEverything()
  await expect(app.deletedConfirmation()).toContainText('تحققنا')
  expect((await storage(page)).local).not.toContain('kamin-ui')
})

test('English: deleting a course explains it in English', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'en' })
  await app.sample()
  await app.home()
  await app.openMyData()
  await app.askDeleteCourse('STAT-110')
  await app.confirmDeleteOne()
  const changed = page.getByTestId('what-changed')
  await expect(changed).toContainText('What was deleted?')
  await expect(changed).toContainText('Deleted the course “STAT-110” from this device.')
  await expect(changed).toContainText('Removed “Quantitative analysis” — because the course was removed from your record.')
})

// Task 46: the usage log says what happened, never the file name (it often holds the student's name) or a project
// title, and delete / withdraw leave no trace of them. Every name here is made up.
const MADE_UP_FILE = 'Transcript_TEST-NAME_0000001.txt'
const FILE_PARTS = ['TEST-NAME', 'Transcript_TEST', '_0000001']
const MADE_UP_TITLE = 'TEST PROJECT TITLE'
test('Task 46: no part of an uploaded file name, and no deleted project title, stays in storage or the usage log', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.goToView('upload')
  await page.locator('#ui2-transcript-file').setInputFiles({ name: MADE_UP_FILE, mimeType: 'text/plain', buffer: Buffer.from('CPIT 251 Systems Analysis and Design 3 A 15.00\nCPIT 240 Database Management 3 B+ 12.00', 'utf8') })
  await expect(app.resultLine()).toBeVisible()
  // The upload is in the usage log, without the file name.
  await expect.poll(async () => (await storage(page)).session).toContain('قُرئ كشف الدرجات على هذا الجهاز')
  const afterUpload = await storage(page)
  for (const part of FILE_PARTS) expect(afterUpload.all).not.toContain(part)
  // The plain list prints no college: one tap, then approve and keep on this device.
  await page.getByTestId('college-note').getByRole('button', { name: 'تصحيح' }).click()
  await page.getByTestId('college-fix').getByRole('button', { name: 'كلية الحاسبات وتقنية المعلومات' }).click()
  await app.approve()
  await expect(app.heading('projects')).toBeVisible()
  // Step 2: the project keeps its title (it is the student's evidence); the usage log line does not copy it.
  await app.addProject(MADE_UP_TITLE, 'I designed database tables and wrote SQL queries for the report.')
  await expect(app.projectCards()).toHaveCount(1)
  const audit = (await sessionState(page)).audit
  expect(audit.map(entry => entry.label)).toContain('أُضيف دليل مشروع')
  expect(JSON.stringify(audit)).not.toContain(MADE_UP_TITLE)
  await app.openSaveOffer()
  await app.keepOnDevice()
  await app.closeNotice()
  await expect.poll(async () => (await storage(page)).idb).toContain(MADE_UP_TITLE)
  // Delete the project for good (the message's Undo is not used).
  await app.goToView('projects')
  await app.projectCards().first().getByRole('button', { name: `${app.wp.remove}: ${MADE_UP_TITLE}`, exact: true }).click()
  await expect(app.projectCards()).toHaveCount(0)
  await app.closeNotice() // the message's Undo is not used: the deletion stands
  await expect.poll(async () => (await storage(page)).all).not.toContain(MADE_UP_TITLE)
  await app.openConsents()
  await app.consent('analyze').uncheck()
  await expect(page.getByTestId('what-changed')).toContainText('ما الذي تغيّر بعد سحب موافقة السجل؟')
  const end = await storage(page)
  for (const text of [...FILE_PARTS, MADE_UP_TITLE]) expect(end.all).not.toContain(text)
  // Still one line per event, with its time.
  await app.openUsageLog()
  const log = page.locator('.audit-list')
  await expect(log).toContainText('قُرئ كشف الدرجات على هذا الجهاز')
  await expect(log).toContainText('أُضيف دليل مشروع')
  await expect(log).not.toContainText('TEST')
  await expect(log.locator('.audit-item small').first()).not.toBeEmpty()
})

test('Task 46: a session saved before Task 46 loses its file-name and project-title lines when KAMIN opens', async ({ page }) => {
  await page.goto('/ar/')
  await page.evaluate(() => {
    sessionStorage.setItem('kamin-session-v3', JSON.stringify({
      courses: [], approved: false, goal: 'data',
      consents: { analyze: false, insight: false, advisor: false, research: false },
      audit: [
        { label: 'Self-declared applied evidence recorded: TEST PROJECT TITLE', ts: 1763380000500 },
        { label: 'تسجيل دليل تطبيقي مصرّح: TEST PROJECT TITLE', ts: 1763380000400 },
        { label: 'تغيير الهدف', ts: 1763380000300 },
        { label: 'Local file read: Transcript_TEST-NAME_0000001.pdf', ts: 1763380000200 },
        { label: 'قراءة ملف محلي: Transcript_TEST-NAME_0000001.pdf', ts: 1763380000100 },
      ],
    }))
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3') || '{}').audit)).toEqual([{ label: 'تغيير الهدف', ts: 1763380000300 }])
  const session = await page.evaluate(() => sessionStorage.getItem('kamin-session-v3'))
  expect(session).toContain('"goal":"data"')
  for (const text of ['TEST-NAME', 'TEST PROJECT TITLE']) expect(session).not.toContain(text)
})

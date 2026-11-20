// Task 53 · privacy guard in the real app (the unit twin is tests/transcriptPrivacy.test.js).
// Upload the made-up fcit-it-2p.pdf (Task 50), approve, keep the profile on this device, then search
// sessionStorage, localStorage, every IndexedDB store, the downloaded backup (decrypted) and the downloaded
// capability file for the made-up name, student number, nationality and NID printed in the PDF: none.
import { test, expect } from './fixtures.js'
import { readFileSync } from 'node:fs'
import { MADE_UP_PERSONAL } from '../scripts/make-transcript-fixtures.mjs'
import { decryptPortableProfile } from '../src/utils/portableProfile.js'
import { LANGS, kamin } from './roles.js'

const FIXTURE = 'tests/fixtures/transcripts/fcit-it-2p.pdf'
const PERSONAL = Object.values(MADE_UP_PERSONAL['fcit-it-2p'])
const PASSPHRASE = 'made-up passphrase for tests'

const expectNone = (text, where) => {
  for (const value of PERSONAL) expect(text.toUpperCase(), `${where} contains the made-up value "${value}"`).not.toContain(value.toUpperCase())
}

// Everything the page keeps in the browser: both storages and every record of every IndexedDB store.
async function browserStorage(page) {
  return page.evaluate(async () => {
    const dump = storage => JSON.stringify(Object.fromEntries(Array.from({ length: storage.length }, (_, i) => [storage.key(i), storage.getItem(storage.key(i))])))
    const names = typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map(d => d.name) : ['kamin-local-profile-v1']
    const databases = {}
    for (const name of names) {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      databases[name] = {}
      for (const store of Array.from(db.objectStoreNames)) {
        databases[name][store] = await new Promise((resolve, reject) => { const r = db.transaction(store, 'readonly').objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      }
      db.close()
    }
    return { session: dump(sessionStorage), local: dump(localStorage), indexedDB: JSON.stringify(databases), names }
  })
}

for (const lang of LANGS) {
  test(`no made-up name, student number, nationality or NID in storage, backup or export after approving a KAU transcript: ${lang}`, async ({ page }) => {
    const app = kamin(page, { ui: 'old', lang })
    await app.home()
    await app.openUpload()
    await app.chooseTranscript(FIXTURE)
    await expect(app.readCodes().first()).toBeVisible()
    await app.approve()
    await expect(app.approvedView()).toBeVisible()
    await app.keepOnDevice()
    await expect(app.saveStatus()).toHaveText(app.c.app.savedOnDevice)

    const stored = await browserStorage(page)
    expect(stored.session, 'the profile is in the session copy').toContain('CPIT-')
    expect(stored.names).toContain('kamin-local-profile-v1')
    expect(stored.indexedDB, 'the profile is in the device copy').toContain('CPIT-')
    expectNone(stored.session, 'sessionStorage')
    expectNone(stored.local, 'localStorage')
    expectNone(stored.indexedDB, 'IndexedDB')

    const backup = await app.downloadBackup(PASSPHRASE)
    const envelope = readFileSync(await backup.path(), 'utf8')
    expectNone(envelope, 'backup file')
    const content = JSON.stringify(await decryptPortableProfile(JSON.parse(envelope), PASSPHRASE))
    expect(content, 'the backup holds the approved courses').toContain('CPIT-')
    expectNone(content, 'backup content (decrypted)')

    const exported = await app.downloadCapabilityFile()
    expectNone(readFileSync(await exported.path(), 'utf8'), 'capability file')
  })
}

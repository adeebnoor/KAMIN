// Task 46: the usage log never keeps a file name or a project title, and delete / withdraw remove every
// trace of what was deleted. Every name here is made up (TEST-NAME, TEST PROJECT TITLE).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { copy } from '../src/i18n.js'
import { OLD_AUDIT_PREFIXES, cleanAuditEntries, errorCode, isStudentContentAuditLabel } from '../src/utils/auditPrivacy.js'
import { deleteItem, withdrawConsent } from '../src/utils/dataControl.js'
import { KAMIN_LOCAL_DB, KAMIN_LOCAL_KEY, KAMIN_LOCAL_STORE, KAMIN_LOCAL_VERSION, readLocalProfile, writeLocalProfile } from '../src/utils/localProfileStore.js'
import { KAMIN_PORTABLE_FORMAT, KAMIN_PORTABLE_VERSION, buildPortableProfile, decryptPortableProfile, encryptPortableProfile, normalizePortableState } from '../src/utils/portableProfile.js'
import { createProjectEvidence, normalizeProjectEvidence } from '../src/utils/projectEvidence.js'
import { profileSkills } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { createFakeIndexedDb, createMemoryStorage } from './helpers/fakeIndexedDb.js'
import oldFixture from './fixtures/audit-old-format-profile.json'

const FILE_NAME = 'Transcript_TEST-NAME_0000001.pdf'
const FILE_PARTS = ['TEST-NAME', 'Transcript_TEST']
const TITLE = 'TEST PROJECT TITLE'
const PASSPHRASE = 'made-up test passphrase only'
const SESSION_KEY = 'kamin-session-v3' // src/state/profileState.js STORAGE_KEY (Task 59)

// The label expressions the app really uses. Reading them from the source (instead of copying them
// here) means this guard fails if the file name or the title ever goes back into a log line.
// Task 59: the profile actions moved from src/App.jsx to src/state/useKaminProfile.js (shared by both
// interfaces); the labels are read there, and the line guards below cover App.jsx and both state files.
const hookSource = readFileSync(new URL('../src/state/useKaminProfile.js', import.meta.url), 'utf8')
const appSource = ['../src/App.jsx', '../src/state/useKaminProfile.js', '../src/state/profileState.js'].map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n')
function expressionAfter(anchor, opener) {
  const at = hookSource.indexOf(anchor)
  if (at < 0) throw new Error(`useKaminProfile.js: "${anchor}" not found`)
  const from = hookSource.indexOf(opener, at)
  if (from < 0) throw new Error(`useKaminProfile.js: "${opener}" not found after "${anchor}"`)
  const start = from + opener.length
  const stack = []
  let i = start
  for (; i < hookSource.length; i++) {
    const ch = hookSource[i], top = stack[stack.length - 1]
    if (top === '`') {
      if (ch === '\\') i++
      else if (ch === '`') stack.pop()
      else if (ch === '$' && hookSource[i + 1] === '{') { stack.push('{'); i++ }
      continue
    }
    if (top === "'" || top === '"') { if (ch === '\\') i++; else if (ch === top) stack.pop(); continue }
    if (ch === '`' || ch === "'" || ch === '"' || ch === '(' || ch === '[' || ch === '{') { stack.push(ch); continue }
    if (ch === ')' || ch === ']' || ch === '}') { if (!stack.length) break; stack.pop(); continue }
    if (ch === ',' && !stack.length) break
  }
  return hookSource.slice(start, i).trim()
}
const asLabel = expression => new Function('t', 'lang', 'file', 'record', `return (${expression})`)
const uploadLabel = asLabel(expressionAfter('const upload = async (file, { readPicture = false } = {}) =>', 'log('))
const projectLabel = asLabel(expressionAfter('const saveProject = record =>', 'audit:[{label:'))

// What App.jsx does with state: one line per event, newest first, at most 100.
const appLog = (state, label) => ({ ...state, audit: [{ label, ts: Date.now() }, ...state.audit].slice(0, 100) })
const blank = () => ({
  courses: [], approved: false, goal: null,
  consents: { analyze: false, insight: false, advisor: false, research: false },
  insight: {}, audit: [], recommendationReviews: [], projects: [], tasks: [], credentials: [],
  college: null, needsReview: [], localPersistence: true,
})

let idb, session
beforeEach(() => {
  idb = createFakeIndexedDb()
  session = createMemoryStorage()
  vi.stubGlobal('indexedDB', idb)
  vi.stubGlobal('sessionStorage', session)
})
afterEach(() => vi.unstubAllGlobals())

// App.jsx's storage effect: the session copy, and the device copy when "keep on this device" is on.
async function persist(state) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
  if (state.localPersistence) await writeLocalProfile(state)
}
const deviceRecord = () => JSON.stringify(idb.raw(KAMIN_LOCAL_DB, KAMIN_LOCAL_STORE, KAMIN_LOCAL_KEY) ?? null)
async function decryptedBackup(state) {
  const person360 = projectStateToPerson360({ state, skills: profileSkills(state) })
  const envelope = await encryptPortableProfile(buildPortableProfile({ state, person360 }), PASSPHRASE)
  return JSON.stringify(await decryptPortableProfile(envelope, PASSPHRASE))
}
const expectNone = (text, needles, where) => {
  for (const needle of needles) expect(text, `${where} contains "${needle}"`).not.toContain(needle)
}

describe('Task 46: the usage log keeps no file name and no project title', () => {
  it('the new lines are fixed sentences in both languages', () => {
    expect(copy.en.screens.myData.auditUpload).toBe('Transcript read on this device')
    expect(copy.en.screens.myData.auditProject).toBe('Project evidence added')
    expect(copy.ar.screens.myData.auditUpload).toBe('قُرئ كشف الدرجات على هذا الجهاز')
    expect(copy.ar.screens.myData.auditProject).toBe('أُضيف دليل مشروع')
    for (const lang of ['ar', 'en']) {
      expect(uploadLabel(copy[lang], lang, { name: FILE_NAME }, null)).toBe(copy[lang].screens.myData.auditUpload)
      expect(projectLabel(copy[lang], lang, null, { title: TITLE })).toBe(copy[lang].screens.myData.auditProject)
    }
  })

  for (const lang of ['en', 'ar']) {
    it(`upload, save a project, delete it, withdraw consent (${lang}): state, session, device and backup hold neither string`, async () => {
      const file = new File(['made-up transcript text'], FILE_NAME, { type: 'application/pdf' })
      const t = copy[lang]

      // 1. Upload: the log line is written as soon as the file is read.
      let state = appLog(blank(), uploadLabel(t, lang, file, null))
      await persist(state)
      expectNone(JSON.stringify(state), FILE_PARTS, 'state after upload')
      expectNone(session.dump(), FILE_PARTS, 'sessionStorage after upload')
      expectNone(deviceRecord(), FILE_PARTS, 'IndexedDB after upload')

      // Approve the (made-up) rows.
      state = appLog({ ...state, courses: [{ code: 'CPIT-240', name: 'Database Management', grade: 'B+', source: 'pdf' }], college: 'FCIT', approved: true, consents: { ...state.consents, analyze: true } }, lang === 'ar' ? 'منح موافقة تحليل السجل واعتماده' : 'Transcript analysis consent granted and record approved')

      // 2. Save a project. The project itself holds its title; the usage log must not.
      const record = createProjectEvidence({ title: TITLE, kind: 'project', skillIds: ['database'], url: '', description: '' })
      state = { ...state, projects: normalizeProjectEvidence([record, ...state.projects]), audit: [{ label: projectLabel(t, lang, null, record), ts: Date.now() }, ...state.audit].slice(0, 100) }
      await persist(state)
      expect(state.projects.map(p => p.title)).toEqual([TITLE])
      expectNone(JSON.stringify(state.audit), [TITLE], 'usage log after saving the project')
      expectNone(JSON.stringify(JSON.parse(sessionStorage.getItem(SESSION_KEY)).audit), [TITLE], 'session usage log')
      expectNone(JSON.stringify(JSON.parse(deviceRecord()).state.audit), [TITLE], 'device usage log')

      // 3. Delete the project: no trace of its title anywhere.
      state = deleteItem(state, { kind: 'project', id: record.id }, { lang }).state
      await persist(state)
      expectNone(JSON.stringify(state), [TITLE, ...FILE_PARTS], 'state after delete')
      expectNone(session.dump(), [TITLE, ...FILE_PARTS], 'sessionStorage after delete')
      expectNone(deviceRecord(), [TITLE, ...FILE_PARTS], 'IndexedDB after delete')

      // 4. Withdraw transcript-analysis consent.
      state = withdrawConsent(state, 'analyze', { lang }).state
      await persist(state)
      const all = [TITLE, FILE_NAME, ...FILE_PARTS]
      expectNone(JSON.stringify(state), all, 'state')
      expectNone(session.dump(), all, 'sessionStorage')
      expectNone(deviceRecord(), all, 'IndexedDB record')
      expectNone(await decryptedBackup(state), all, 'decrypted backup')

      // Still one line per event, each with its time.
      expect(state.audit.map(e => e.label)).toEqual([
        state.audit[0].label, // withdrawal (counts only)
        lang === 'ar' ? 'حذف عنصر: دليل تطبيقي مصرّح (1)' : 'Item deleted: self-declared project (1)',
        t.screens.myData.auditProject,
        lang === 'ar' ? 'منح موافقة تحليل السجل واعتماده' : 'Transcript analysis consent granted and record approved',
        t.screens.myData.auditUpload,
      ])
      expect(state.audit[0].label).toMatch(lang === 'ar' ? /^سحب موافقة تحليل السجل/ : /^Transcript-analysis consent withdrawn/)
      for (const entry of state.audit) expect(Number.isFinite(entry.ts)).toBe(true)
    })
  }

  it('App.jsx and the profile state files never put a file name or a title into a log line, and never print a raw error on upload or export', () => {
    for (const line of appSource.split(/\r?\n/).filter(l => /\blog\(|audit:\[/.test(l))) {
      expect(line).not.toMatch(/\$\{[^}]*(file\??\.name|\.title)\b[^}]*\}/)
    }
    expect(appSource).toContain("console.warn('KAMIN upload failed', errorCode(err))")
    expect(appSource).toContain("console.warn('KAMIN export failed', errorCode(error))")
    expect(appSource).not.toMatch(/console\.error\((err|error)\)/)
  })

  it('errorCode keeps a short code and replaces any other message', () => {
    expect(errorCode(new Error('PDF_OPEN_FAILED'))).toBe('PDF_OPEN_FAILED')
    expect(errorCode(new Error('UNSUPPORTED_FILE_TYPE'))).toBe('UNSUPPORTED_FILE_TYPE')
    expect(errorCode(new Error(`Cannot read ${FILE_NAME}`))).toBe('UNEXPECTED_ERROR')
    expect(errorCode({ message: { name: 'TEST-NAME' } })).toBe('UNEXPECTED_ERROR')
    expect(errorCode(null)).toBe('UNEXPECTED_ERROR')
    expect(errorCode('TEST-NAME')).toBe('UNEXPECTED_ERROR')
  })
})

describe('Task 46: a profile saved before this change loads without the old lines and with no other change', () => {
  const { _comment, ...saved } = oldFixture
  const OLD = new Set(saved.audit.filter(e => OLD_AUDIT_PREFIXES.some(p => e.label.startsWith(p))).map(e => e.label))
  const expected = { ...saved, audit: saved.audit.filter(e => !OLD.has(e.label)) }

  it('the fixture really holds the four old lines, in both languages', () => {
    expect(OLD.size).toBe(4)
    expect(JSON.stringify(saved.audit)).toContain('TEST-NAME')
    expect(expected.audit).toHaveLength(2)
    expect(JSON.stringify(expected.audit)).not.toMatch(/TEST-NAME|TEST PROJECT TITLE/)
  })

  it('cleanAuditEntries drops only the old lines and keeps the others exactly, with their times', () => {
    expect(cleanAuditEntries(saved.audit)).toEqual(expected.audit)
    expect(cleanAuditEntries([null, 'text', { label: '  Local file read: x.pdf', ts: 1 }, { label: 'Goal changed', ts: 2 }])).toEqual([{ label: 'Goal changed', ts: 2 }])
    expect(cleanAuditEntries(undefined)).toEqual([])
    expect(isStudentContentAuditLabel('Transcript read on this device')).toBe(false)
    expect(isStudentContentAuditLabel(copy.ar.screens.myData.auditProject)).toBe(false)
  })

  it('readLocalProfile (device copy) returns the profile without the old lines and nothing else changed', async () => {
    idb.seed(KAMIN_LOCAL_DB, KAMIN_LOCAL_STORE, KAMIN_LOCAL_KEY, { version: KAMIN_LOCAL_VERSION, updatedAt: '2026-11-17T10:00:00.000Z', state: saved }, KAMIN_LOCAL_VERSION)
    expect(await readLocalProfile()).toEqual(expected)
  })

  it('normalizePortableState (backup restore) drops the old lines and nothing else changes', async () => {
    const payload = state => ({ format: KAMIN_PORTABLE_FORMAT, version: KAMIN_PORTABLE_VERSION, state })
    expect(normalizePortableState(payload(saved))).toEqual(normalizePortableState(payload(expected)))
    expect(normalizePortableState(payload(saved)).audit).toEqual(expected.audit)
    // A backup written from an old session does not carry the lines either.
    expect(buildPortableProfile({ state: saved }).state.audit).toEqual(expected.audit)
  })

  it('deleteItem and withdrawConsent remove the old lines that named what was deleted', () => {
    const afterDelete = deleteItem(saved, { kind: 'project', id: 'project-0000-test-0001' }, { lang: 'en' }).state
    expectNone(JSON.stringify(afterDelete), ['TEST-NAME', TITLE], 'state after deleting the old project')
    expect(afterDelete.audit.slice(1)).toEqual(expected.audit)
    const afterWithdraw = withdrawConsent(saved, 'insight', { lang: 'ar' }).state
    expect(afterWithdraw.audit.slice(1)).toEqual(expected.audit)
    expectNone(JSON.stringify(afterWithdraw.audit), ['TEST-NAME', TITLE], 'usage log after withdrawing consent')
  })
})

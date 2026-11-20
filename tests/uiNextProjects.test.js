// Task 63 · step 2 of the new interface (src/ui2/screens/Projects.jsx): the self-declared sentences are the old
// panel's, byte for byte (both interfaces are rendered here), a project never changes a capability or its level,
// edit and Undo keep the record self-declared, one main action at a time, and step 2 loads on its own.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PROJECT_COPY, projectCopy } from '../src/content/projectCopy.js'
import ProjectEvidencePanel, { ProjectEvidenceList } from '../src/components/ProjectEvidence.jsx'
import Projects, { saveBlock } from '../src/ui2/screens/Projects.jsx'
import ProjectCard from '../src/ui2/components/ProjectCard.jsx'
import { projectFromDraft, replaceProject, restoreProject } from '../src/ui2/projectsState.js'
import { NEXT_COPY } from '../src/ui2/copy.js'
import { VIEW_TEXT } from '../src/ui2/views.js'
import { createProjectEvidence, MAX_PROJECTS, PROJECT_EVIDENCE_LEVEL } from '../src/utils/projectEvidence.js'
import { profileSkills } from '../src/utils/engine.js'
import { demoCourses, skills as catalog } from '../src/data.js'
import { copy } from '../src/i18n.js'

const LANGS = ['ar', 'en']
const read = file => readFileSync(file, 'utf8')
const sourceFiles = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? sourceFiles(p) : [p] })
const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
const noop = () => {}
// Made-up projects (no person, no real work).
const draftOf = over => ({ title: 'Study room booking web app (made up)', description: 'A web app to book study rooms with a database.', url: '', skillIds: ['web-development', 'database'], ...over })
const A = createProjectEvidence({ ...draftOf(), kind: 'project' }, new Date('2026-11-01T10:00:00Z'))
const B = createProjectEvidence({ ...draftOf({ title: 'Course survey dashboard (made up)', skillIds: ['statistics'] }), kind: 'project', url: 'https://example.org/made-up' }, new Date('2026-11-02T10:00:00Z'))
const profileOf = projects => ({ state: { projects, audit: [] }, actions: { setState: noop, saveProject: noop, removeProject: noop } })
const page = (lang, projects) => renderToStaticMarkup(createElement(Projects, { lang, profile: profileOf(projects), focusHeading: false, onNavigate: noop, notify: noop }))
// The approved synthetic example (FCIT), as the keep-tests use it.
const SAMPLE = { approved: true, courses: demoCourses.map(row => ({ ...row })), college: 'FCIT', tasks: [], credentials: [], insight: {}, consents: { analyze: true } }
// Every capability of the profile, whole (levels, basis, reasons, evidence): what Profile and the old dashboard show.
const levels = state => JSON.parse(JSON.stringify(profileSkills(state)))

describe('Task 63 · the self-declared sentences, the same bytes in both interfaces', () => {
  it('src/content/projectCopy.js holds the old panel\'s sentences word for word', () => {
    expect(PROJECT_COPY.en.badge).toBe('Self-declared · awaiting review')
    expect(PROJECT_COPY.ar.badge).toBe('تصريح ذاتي · بانتظار مراجعة')
    expect(PROJECT_COPY.en.rule).toBe('A project, certificate or internship that covers a gap in your profile. It is recorded as self-declared "applied" evidence and never becomes a capability or changes Fit until an advisor reviews it or an authorized issuer verifies it.')
    expect(PROJECT_COPY.ar.rule).toBe('مشروع أو شهادة أو تدريب يغطي فجوة في ملفك. يُسجَّل كتصريح ذاتي بمستوى «تطبيقي مصرّح»، ولا يصبح قدرة أو يغيّر الملاءمة حتى يراجعه مستشار أو تتحقق منه جهة معتمدة.')
    expect(PROJECT_COPY.en.saved).toBe('Recorded locally as self-declared evidence. No capability was added and no judgment changed; the level rises only after an advisor or authorized issuer reviews it.')
    expect(PROJECT_COPY.ar.saved).toBe('سُجّل الدليل محليًا كتصريح ذاتي. لم يُضف قدرة ولم يتغيّر أي حكم؛ يرتفع مستواه فقط بعد مراجعة مستشار أو جهة معتمدة.')
    expect(Object.keys(PROJECT_COPY.ar).sort()).toEqual(Object.keys(PROJECT_COPY.en).sort())
  })

  for (const lang of LANGS) it(`${lang}: the old panel and step 2 show the same rule and badge`, () => {
    const P = projectCopy(lang)
    const old = textOf(renderToStaticMarkup(createElement(ProjectEvidencePanel, { lang, projects: [A], onSave: noop, onRemove: noop })))
    const oldList = textOf(renderToStaticMarkup(createElement(ProjectEvidenceList, { lang, projects: [A], onRemove: noop })))
    const now = textOf(page(lang, [A]))
    for (const [where, text] of [['old panel', old], ['new step 2', now]]) expect(text, where).toContain(P.rule)
    for (const [where, text] of [['old list', oldList], ['new card', now]]) expect(text, where).toContain(P.badge)
  })

  it('src/ui2 never copies a self-declared sentence: it reads them from src/content/projectCopy.js', () => {
    const sentences = LANGS.flatMap(lang => ['badge', 'rule', 'saved', 'abstain', 'suggestNote', 'urlError', 'invalid'].map(key => PROJECT_COPY[lang][key]))
    for (const file of sourceFiles('src/ui2')) for (const sentence of sentences) expect(read(file), `${file} holds a copy`).not.toContain(sentence)
    for (const sentence of sentences) expect(read('src/components/ProjectEvidence.jsx'), 'the old panel reads them too').not.toContain(sentence)
    expect(read('src/ui2/screens/Projects.jsx')).toMatch(/P\.rule/)
    expect(read('src/ui2/screens/Projects.jsx')).toMatch(/notify\(P\.saved\)/)
    expect(read('src/ui2/components/ProjectCard.jsx')).toMatch(/P\.badge/)
  })
})

describe('Task 63 · a project never changes a capability or its level (the evidence rule is today\'s)', () => {
  it('the capabilities, levels and evidence of the example are identical with no, one or two projects', () => {
    const before = levels({ ...SAMPLE, projects: [] })
    expect(before.length).toBeGreaterThan(0)
    for (const skill of before) expect(['none', 'limited', 'moderate', 'strong'], skill.id).toContain(skill.evidenceLevel)
    // Project A names a capability the example already has (database), so the check is not trivially true.
    expect(before.map(skill => skill.id)).toContain('database')
    expect(levels({ ...SAMPLE, projects: [A] })).toEqual(before)
    expect(levels({ ...SAMPLE, projects: [A, B] })).toEqual(before)
  })

  it('a record from step 2 is self-declared and unreviewed, new or edited; a non-https link is refused', () => {
    const made = projectFromDraft(draftOf(), null, new Date('2026-11-18T09:00:00Z'))
    expect(made).toMatchObject({ kind: 'project', level: PROJECT_EVIDENCE_LEVEL, reviewStatus: 'unreviewed', skillIds: ['web-development', 'database'], url: null })
    const edited = projectFromDraft(draftOf({ title: 'Study rooms app, second version (made up)', skillIds: ['database'] }), { ...B, kind: 'internship' })
    expect(edited).toMatchObject({ id: B.id, createdAt: B.createdAt, kind: 'internship', level: PROJECT_EVIDENCE_LEVEL, reviewStatus: 'unreviewed', skillIds: ['database'] })
    expect(() => projectFromDraft(draftOf({ url: 'http://example.org' }))).toThrow('PROJECT_URL_MUST_BE_HTTPS')
    expect(() => projectFromDraft(draftOf({ skillIds: [] }))).toThrow('INVALID_PROJECT_EVIDENCE')
  })

  it('edit keeps the project in its place and changes nothing else in the profile', () => {
    const state = { ...SAMPLE, projects: [A, B], audit: [] }
    const edited = { ...B, title: 'Course survey dashboard, edited (made up)' }
    const next = replaceProject(state, edited)
    expect(next.projects.map(p => p.id)).toEqual([A.id, B.id])
    expect(next.projects[1].title).toBe('Course survey dashboard, edited (made up)')
    expect(next.courses).toBe(state.courses)
    expect(next.audit).toBe(state.audit)
    expect(levels(next)).toEqual(levels(state))
  })

  it('Undo puts a deleted project back where it was, with a usage-log line that names no title (Task 46)', () => {
    const label = copy.en.screens.myData.auditProject
    const afterDelete = { ...SAMPLE, projects: [A], audit: [{ label: 'deleted', ts: 1 }] }
    const back = restoreProject(afterDelete, B, 1, label)
    expect(back.projects.map(p => p.id)).toEqual([A.id, B.id])
    expect(restoreProject(afterDelete, B, 0, label).projects.map(p => p.id)).toEqual([B.id, A.id])
    expect(restoreProject(afterDelete, B, 99, label).projects.map(p => p.id)).toEqual([A.id, B.id])
    expect(back.audit[0].label).toBe(label)
    expect(JSON.stringify(back.audit)).not.toContain(B.title)
    // Undo twice never makes two copies.
    expect(restoreProject(back, B, 1, label).projects.map(p => p.id)).toEqual([A.id, B.id])
  })
})

describe('Task 63 · step 2: one main action at a time', () => {
  for (const lang of LANGS) it(`${lang}: no project yet → "Add project" is the one main button, with "Skip for now"`, () => {
    const w = NEXT_COPY[lang].projects
    const html = page(lang, [])
    expect(html.match(/ui2-btn-primary/g)).toHaveLength(1)
    expect(textOf(html.match(/<button[^>]*ui2-btn-primary[^>]*>[\s\S]*?<\/button>/)[0])).toBe(w.add)
    expect(textOf(html)).toContain(w.skip)
    expect(textOf(html)).not.toContain(w.next)
    expect(textOf(html)).toContain(VIEW_TEXT.projects.title[lang])
    expect(textOf(html)).toContain(w.line)
  })

  for (const lang of LANGS) it(`${lang}: with projects → compact cards and "Next" as the one main button`, () => {
    const w = NEXT_COPY[lang].projects
    const html = page(lang, [A, B])
    expect(html.match(/ui2-btn-primary/g)).toHaveLength(1)
    expect(textOf(html.match(/<button[^>]*ui2-btn-primary[^>]*>[\s\S]*?<\/button>/)[0])).toBe(w.next)
    expect(html.match(/data-testid="ui2-project"/g)).toHaveLength(2)
    expect(textOf(html)).toContain(w.addAnother)
    // Skill names, never ids; the link only when there is one.
    const card = renderToStaticMarkup(createElement(ProjectCard, { lang, project: B, onEdit: noop, onDelete: noop }))
    expect(textOf(card)).toContain(Object.values(catalog).find(s => s.id === 'statistics').labels[lang])
    expect(textOf(card)).not.toContain('statistics')
    expect(card).toContain('href="https://example.org/made-up"')
    expect(renderToStaticMarkup(createElement(ProjectCard, { lang, project: A, onEdit: noop, onDelete: noop }))).not.toContain('href=')
  })

  it('Save says why it waits: a title first, then at least one skill; a full record says so', () => {
    for (const lang of LANGS) {
      const w = NEXT_COPY[lang].projects
      expect(saveBlock(draftOf({ title: 'ab' }), { lang })).toBe(w.needTitle)
      expect(saveBlock(draftOf({ skillIds: [] }), { lang })).toBe(w.needSkill)
      expect(saveBlock(draftOf(), { lang })).toBe('')
      expect(saveBlock(draftOf(), { lang, full: true })).toBe(projectCopy(lang).limit(MAX_PROJECTS))
    }
  })

  it('step 2\'s words: Arabic and English have the same keys, no percentage, and the line is one sentence', () => {
    const keys = lang => Object.keys(NEXT_COPY[lang].projects).sort()
    expect(keys('ar')).toEqual(keys('en'))
    for (const lang of LANGS) {
      expect(JSON.stringify(NEXT_COPY[lang].projects)).not.toMatch(/\d\s?[%٪]|[%٪]\s?\d/)
      expect(NEXT_COPY[lang].projects.line.split(/[.؛!?؟]\s/)).toHaveLength(1)
    }
  })
})

describe('Task 63 · step 2 loads on its own; the startup bundle never carries it', () => {
  it('AppNext loads step 2 with lazy(import()); nothing else imports the screen, its card, its state or its CSS', () => {
    const app = read('src/ui2/AppNext.jsx')
    expect(app).toMatch(/const Projects = lazy\(\(\) => import\('\.\/screens\/Projects\.jsx'\)\)/)
    expect(app).not.toMatch(/^import .*Projects\.jsx/m)
    const importers = name => sourceFiles('src').filter(file => new RegExp(`from '[./]+(?:[\\w/]+/)?${name}'|import '[./]+(?:[\\w/]+/)?${name}'`).test(read(file))).map(file => file.split(path.sep).join('/'))
    expect(importers('projects\\.css')).toEqual(['src/ui2/screens/Projects.jsx'])
    expect(importers('projectsState\\.js')).toEqual(['src/ui2/screens/Projects.jsx'])
    expect(importers('ProjectCard\\.jsx')).toEqual(['src/ui2/screens/Projects.jsx'])
    expect(read('src/main.jsx')).not.toMatch(/Projects/)
  })

  it('the suggestion engine still loads only when "Suggest skills" is pressed (src/ai/suggestSettings.js unchanged)', () => {
    expect(read('src/ui2/screens/Projects.jsx')).not.toMatch(/projectSuggestImproved/)
    expect(read('src/ai/suggestSettings.js')).toMatch(/import\('\.\/projectSuggestImproved\.js'\)/)
  })
})

// ---------- Task 44 · the trial counts how the project suggestions were used (counts only) ----------
describe('Task 44 · saving a project in the trial records counts, never text', () => {
  const source = () => read('src/ui2/screens/Projects.jsx')
  it('the form keeps the suggested skill ids and the engine version, and records them only after a successful save', () => {
    const s = source()
    expect(s).toContain("import { recordProjectSuggestions } from '../../pilot/studyCounts.js'")
    expect(s).toMatch(/for \(const skillId of ids\) suggested\.current\.ids\.add\(skillId\)/)
    expect(s).toMatch(/suggested\.current\.engine = result\.version/)
    // A failed save (bad link) returns before anything is counted; Suggest never pressed (only possible when editing): nothing.
    const save = s.slice(s.indexOf('const save = event => {'), s.indexOf('const chips = '))
    expect(save).toMatch(/setError\([^\n]*\); return \}/)
    expect(save).toMatch(/if \(engine\) recordProjectSuggestions\(\{ suggested: \[\.\.\.ids\], saved: draft\.skillIds, before: editing\?\.skillIds \|\| \[\], engine \}\)/)
    expect(save.indexOf('onSave(')).toBeLessThan(save.indexOf('recordProjectSuggestions('))
    // Only ids and the version reach the recorder: never the title, the description, the link or a snippet.
    const call = save.match(/recordProjectSuggestions\(\{[^}]*\}\)/)[0]
    expect(call).not.toMatch(/title|description|url|snippet|suggestion\b/)
  })
  it('Cancel records nothing (the counts live only in the save path)', () => {
    const s = source()
    expect(s.match(/recordProjectSuggestions\(/g)).toHaveLength(1)
    expect(s.slice(s.indexOf('const closeForm'), s.indexOf('const save = record'))).not.toMatch(/record/i)
  })
})

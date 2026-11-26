// Task 68 · Help and the footer in the new interface (src/ui2/screens/Help.jsx, src/ui2/Footer.jsx).
// Help is one short page of links: How KAMIN works, About, Privacy policy, What runs where, Test results and Contact
// (the public pages, in the interface's language through pageHref), then Reviewer tools with one line saying they are
// for reviewers: the knowledge explorer and the pathway search by meaning (the local MiniLM model), each a sub-page at
// ?app=help#<tool> holding the old interface's component unchanged. The footer, on Home and Help only, has Help and the
// same links. Nothing on Home or in the four steps explains how KAMIN works; "Why?" sheets link to the matching Help
// page. Every explanation the old landing page linked to has a Help destination (the inventory check).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Help, { toolHref } from '../src/ui2/screens/Help.jsx'
import Footer from '../src/ui2/Footer.jsx'
import HelpPageLink from '../src/ui2/HelpPageLink.jsx'
import { HELP_PAGES, HELP_SECTIONS, NEXT_VIEWS, SETTINGS_SECTIONS, VIEW_TEXT, helpSectionFromHash, sectionFromHash, tabOf } from '../src/ui2/views.js'
import { NEXT_COPY, fillIn } from '../src/ui2/copy.js'
import { footerItems, navItems, pageHref } from '../public/site-content.js'
import { pages as builtPages } from '../scripts/public-page-content.mjs'
import { emptyInsightState } from '../src/insight.js'

const LANGS = ['ar', 'en']
const read = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const sourceFiles = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? sourceFiles(p) : [p] })
const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
const noop = () => {}
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const W = lang => NEXT_COPY[lang].help
const STATE = { approved: false, courses: [], college: null, projects: [], tasks: [], credentials: [], recommendationReviews: [], insight: emptyInsightState(), consents: { analyze: false, insight: false, advisor: false, research: false }, goals: [], plan: [], notForMe: [], audit: [] }
const PROFILE = { state: STATE, derived: { skills: [], matches: [], personGraph: null }, status: {}, actions: {} }
const FILES = Object.fromEntries(HELP_PAGES)

// The screens read the address (urlWithApp): a stand-in for the browser's, on Home of the new interface.
const realLocation = globalThis.location
const at = href => { globalThis.location = new URL(href, 'http://127.0.0.1:4173') }
beforeAll(() => at('/en/?ui=next&app=home'))
afterAll(() => { globalThis.location = realLocation })
const help = (lang, extra = {}) => renderToStaticMarkup(createElement(Help, { lang, profile: PROFILE, focusHeading: false, onNavigate: noop, ...extra }))
const footer = lang => renderToStaticMarkup(createElement(Footer, { lang, onNavigate: noop, onTool: noop }))
const links = html => [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => ({ href: m[1].replace(/&amp;/g, '&'), text: textOf(m[2]), tag: m[0] }))

describe('Task 68 · Help\'s links and the address of a reviewer tool (?app=help#<tool>)', () => {
  it('six public pages in the brief\'s order, each a page the build writes in Arabic and English', () => {
    expect(HELP_PAGES.map(([id]) => id)).toEqual(['guide', 'about', 'privacy', 'runs-where', 'tests', 'contact'])
    expect(HELP_PAGES.map(([, file]) => file)).toEqual(['guide.html', 'about.html', 'privacy.html', 'runs-where.html', 'tests.html', 'contact.html'])
    // scripts/build-public-pages.mjs writes /ar/<file> and /en/<file> for every page in public/ and every generated page.
    for (const [, file] of HELP_PAGES) expect(existsSync(`public/${file}`) || file in builtPages, file).toBe(true)
  })
  it('two reviewer tools; a fragment names one only on Help, and Settings\' sections only on Settings', () => {
    expect(HELP_SECTIONS).toEqual(['knowledge', 'pathways'])
    for (const id of HELP_SECTIONS) expect(helpSectionFromHash(`#${id}`)).toBe(id)
    for (const hash of ['', '#', '#payload=abc&key=def', '#Knowledge', '#courses', '#about', undefined, null]) expect(helpSectionFromHash(hash)).toBeNull()
    expect(sectionFromHash('help', '#knowledge')).toBe('knowledge')
    expect(sectionFromHash('help', '#courses')).toBeNull()
    expect(sectionFromHash('settings', '#courses')).toBe('courses')
    expect(sectionFromHash('settings', '#knowledge')).toBeNull()
    expect(sectionFromHash('home', '#knowledge')).toBeNull()
    expect(HELP_SECTIONS.filter(id => SETTINGS_SECTIONS.includes(id))).toEqual([])
    expect(NEXT_VIEWS).toContain('help')
    expect(tabOf('help')).toBe('profile')
  })
  it('a tool\'s address keeps the language and the switch, names the view and the tool, and nothing else', () => {
    at('/ar/?ui=next&app=profile#courses')
    expect(toolHref('knowledge')).toBe('/ar/?ui=next&app=help#knowledge')
    at('/en/?ui=next&app=home')
    expect(toolHref('pathways')).toBe('/en/?ui=next&app=help#pathways')
  })
})

describe('Task 68 · the Help page', () => {
  for (const lang of LANGS) it(`(${lang}) the heading and its sentence, the six pages in this language, then Reviewer tools with its line`, () => {
    const html = help(lang)
    const text = textOf(html)
    expect(html).toContain(`<h1 id="ui2-page-title" tabindex="-1">${VIEW_TEXT.help.title[lang]}</h1>`)
    expect(text).toContain(VIEW_TEXT.help.line[lang])
    expect(html).toContain(`>${W(lang).pagesTitle}</h2>`)
    expect(html).toContain(`>${W(lang).reviewerTitle}</h2>`)
    expect(text).toContain(W(lang).reviewerLine)
    const all = links(html)
    expect(all.map(link => link.text)).toEqual([...HELP_PAGES.map(([id]) => W(lang).pages[id]), ...HELP_SECTIONS.map(id => W(lang).tools[id])])
    // Each page in the interface's language, in the same tab (Back returns to Help).
    expect(all.slice(0, 6).map(link => link.href)).toEqual(HELP_PAGES.map(([, file]) => `/${lang}/${file}`))
    for (const link of all.slice(0, 6)) expect(link.tag, link.text).not.toContain('target=')
    expect(all.slice(6).map(link => link.href)).toEqual(['/en/?ui=next&app=help#knowledge', '/en/?ui=next&app=help#pathways'])
    // The reviewer line sits with the tools, after every page link.
    expect(html.indexOf(W(lang).reviewerLine)).toBeGreaterThan(html.indexOf(`/${lang}/contact.html`))
    expect(text).not.toMatch(PERCENT)
    expect(html, 'no technical id').not.toMatch(/urn:kamin|MiniLM/)
  })
  for (const lang of LANGS) it(`(${lang}) a reviewer tool: Back to Help, "Reviewer tools" and its line, then the old component (loaded when opened)`, () => {
    for (const [tool, source] of [['knowledge', { hash: '#knowledge' }], ['pathways', { entry: { tool: 'pathways' } }]]) {
      at(`/${lang}/?ui=next&app=help${source.hash || ''}`)
      const html = help(lang, source.entry ? { entry: source.entry } : {})
      const text = textOf(html)
      expect(html, tool).toContain(`data-section="${tool}"`)
      expect(text.startsWith(W(lang).back), tool).toBe(true)
      expect(html, 'the page heading stays for screen readers').toContain(`<h1 id="ui2-page-title" tabindex="-1" class="ui2-vh">${VIEW_TEXT.help.title[lang]}</h1>`)
      expect(html).toMatch(new RegExp(`<h2 id="[^"]+-title" class="ui2-help-title" tabindex="-1">${W(lang).reviewerTitle}</h2>`))
      expect(text).toContain(W(lang).reviewerLine)
      expect(html, 'no list on a tool').not.toContain('ui2-help-row')
      expect(text).toContain(NEXT_COPY[lang].profile.loading)
    }
    at('/en/?ui=next&app=home')
  })
  it('the tools are the old components, unchanged, each loaded with lazy(import()); only Help loads them in the new interface', () => {
    const source = read('src/ui2/screens/Help.jsx')
    expect(source).toContain("const KnowledgeWorkspace = lazy(() => import('../../components/KnowledgeWorkspace.jsx'))")
    expect(source).toContain("const SemanticRecall = lazy(() => import('../../components/SemanticRecall.jsx'))")
    expect(source).not.toMatch(/^import[^\n]*(KnowledgeWorkspace|SemanticRecall)/m)
    const importers = name => sourceFiles('src/ui2').filter(file => read(file).split('\n').some(line => line.includes('import') && line.includes(`components/${name}.jsx'`))).map(file => file.split(path.sep).join('/'))
    expect(importers('KnowledgeWorkspace')).toEqual(['src/ui2/screens/Help.jsx'])
    expect(importers('SemanticRecall')).toEqual(['src/ui2/screens/Help.jsx'])
    // Task 70: the old interface (its knowledge view in src/App.jsx, its interests page StudentInsight.jsx) is deleted;
    // Help is now the only place in the app that loads the two tools.
    const all = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? all(`${dir}/${e.name}`) : /\.jsx?$/.test(e.name) ? [`${dir}/${e.name}`] : [])
    const users = name => all('src').filter(file => read(file).split('\n').some(line => line.includes('import') && line.includes(`${name}.jsx'`)))
    expect(users('KnowledgeWorkspace')).toEqual(['src/ui2/screens/Help.jsx'])
    expect(users('SemanticRecall')).toEqual(['src/ui2/screens/Help.jsx'])
  })
})

describe('Task 68 · the footer', () => {
  for (const lang of LANGS) it(`(${lang}) a footer with a named list: Help, the same six pages in this language, then the two reviewer tools`, () => {
    const html = footer(lang)
    expect(html).toMatch(/^<footer class="ui2-footer" data-testid="ui2-footer"><nav aria-label="[^"]+">/)
    expect(html).toContain(`<nav aria-label="${W(lang).footer}">`)
    const all = links(html)
    expect(all.map(link => link.text)).toEqual([VIEW_TEXT.help.title[lang], ...HELP_PAGES.map(([id]) => W(lang).pages[id]), ...HELP_SECTIONS.map(id => W(lang).tools[id])])
    expect(all[0].href).toBe('/en/?ui=next&app=help')
    expect(all.slice(1, 7).map(link => link.href)).toEqual(HELP_PAGES.map(([, file]) => `/${lang}/${file}`))
    expect(all.slice(7).map(link => link.href)).toEqual(HELP_SECTIONS.map(id => `/en/?ui=next&app=help#${id}`))
    // The same pages and tools as Help, in the same order.
    expect(all.slice(1).map(link => link.text)).toEqual(links(help(lang)).map(link => link.text))
    expect(textOf(html)).toContain(W(lang).reviewerShort)
    expect(html.indexOf(W(lang).reviewerShort)).toBeGreaterThan(html.indexOf(`/${lang}/contact.html`))
    expect(html.indexOf(W(lang).reviewerShort)).toBeLessThan(html.indexOf('#knowledge'))
  })
  it('AppNext: Help is lazy(import()); the footer comes with the frame, outside <main>, on Home and Help only', () => {
    const app = read('src/ui2/AppNext.jsx')
    expect(app).toContain("const Help = lazy(() => import('./screens/Help.jsx'))")
    expect(app).not.toMatch(/^import[^\n]*screens\/Help/m)
    expect(app).toMatch(/^import Footer from '\.\/Footer\.jsx'$/m)
    expect(app).toContain("const footed = view === 'home' || view === 'help'")
    expect(app).toContain('{footed && <Footer lang={lang} onNavigate={navigate} onTool={openTool}/>}')
    expect(app.indexOf('</main>')).toBeLessThan(app.indexOf('{footed && <Footer'))
    // Only the frame imports the footer and its CSS; only Help imports help.css.
    const importers = needle => sourceFiles('src').filter(file => read(file).includes(needle)).map(file => file.split(path.sep).join('/'))
    expect(importers("Footer.jsx'")).toEqual(['src/ui2/AppNext.jsx'])
    expect(importers("footer.css'")).toEqual(['src/ui2/Footer.jsx'])
    expect(importers("help.css'")).toEqual(['src/ui2/screens/Help.jsx'])
  })
  it('Help is one tap from Profile and from the footer; neither is a tab or a top-bar control', () => {
    expect(read('src/ui2/screens/Profile.jsx')).toContain("onClick={() => onNavigate('help')}")
    expect(read('src/ui2/Footer.jsx')).toContain("onClick={event => followLink(event, () => onNavigate('help'))}")
    for (const file of ['src/ui2/TopBar.jsx', 'src/ui2/NavTabs.jsx']) expect(read(file), file).not.toMatch(/'help'|screens\/Help|Footer/)
  })
})

describe('Task 68 · nothing about how it works on Home or in the flow; "Why?" sheets link to Help', () => {
  const FLOW = ['src/ui2/screens/Home.jsx', 'src/ui2/screens/Upload.jsx', 'src/ui2/screens/Projects.jsx', 'src/ui2/screens/Interests.jsx', 'src/ui2/screens/NextSteps.jsx', 'src/ui2/components/ResultCard.jsx', 'src/ui2/components/StepCard.jsx', 'src/ui2/StepChip.jsx']
  it('Home and the four steps hold no "how it works", guide, FAQ, trust or methodology block, and no reviewer tool', () => {
    for (const file of FLOW) {
      const source = read(file)
      expect(source, file).not.toMatch(/LandingExperience|QuickTour|KnowledgeWorkspace|SemanticRecall|faq\.html|trust\.html|methodology\.html|services\.html|How it works|كيف يعمل/)
    }
    // Home is one sentence and one button (Task 62): it links nowhere.
    expect(read('src/ui2/screens/Home.jsx')).not.toMatch(/href=|HelpPageLink|pageHref/)
  })
  it('every "Why?" sheet links to the matching Help page: how skills are suggested, the paths and a capability\'s level → How KAMIN works; how the file is read → Privacy policy', () => {
    expect(read('src/ui2/screens/Projects.jsx')).toMatch(/<HelpPageLink lang=\{lang\} page="guide"\/>\n  <\/div>\n\}/)
    expect(read('src/ui2/components/GoalPicker.jsx')).toMatch(/data-testid="ui2-opportunity-note">[^\n]*\n[^\n]*\n\s*<HelpPageLink lang=\{lang\} page="guide"\/>/)
    expect(read('src/ui2/screens/Profile.jsx')).toMatch(/<LevelLegend lang=\{lang\} testId="level-legend-sheet"\/>\n[^\n]*\n\s*<HelpPageLink lang=\{lang\} page="guide"\/>/)
    expect(read('src/ui2/screens/Upload.jsx')).toContain(`<a href={pageHref('${FILES.privacy}', lang)} target="_blank" rel="noreferrer">{w.privacyPage}</a>`)
  })
  for (const lang of LANGS) it(`(${lang}) a "Why?" sheet's link: "Read more: <the Help page's name>", the page in this language, in a new tab`, () => {
    for (const [page, file] of HELP_PAGES) {
      const html = renderToStaticMarkup(createElement(HelpPageLink, { lang, page }))
      expect(html).toBe(`<p class="ui2-help-link" data-testid="ui2-why-help"><a href="/${lang}/${file}" target="_blank" rel="noreferrer">${fillIn(W(lang).more, { page: W(lang).pages[page] })}</a></p>`)
    }
  })
})

describe('Task 68 · every old landing explanation has a Help destination (inventory check)', () => {
  it('every page the old landing page links to is a Help page, or one tap from every Help page (the public pages\' shared header and footer)', () => {
    // Task 70: the old landing page (src/components/LandingExperience.jsx) is deleted. These are the pages it linked to
    // (its pageHref('….html') calls, read from the file at b443bad before the deletion); every one keeps a destination.
    const linked = ['about.html', 'catalog.html', 'faq.html', 'guide.html', 'sample-report.html', 'services.html', 'trust.html', 'validation.html']
    expect(existsSync('src/components/LandingExperience.jsx')).toBe(false)
    const shared = new Set([...navItems, ...footerItems].map(([file]) => file))
    for (const file of linked) expect(Object.values(FILES).includes(file) || shared.has(file), `${file} has a Help destination`).toBe(true)
    // The landing's own explanation blocks: How it works → the guide (a Help page); Why you can trust it and Before you
    // begin → the trust center and the FAQ, in every public page's header and footer.
    expect(Object.values(FILES)).toContain('guide.html')
    expect(shared.has('trust.html') && shared.has('faq.html') && shared.has('methodology.html')).toBe(true)
    // "Explore further" (the knowledge search) → Help → Reviewer tools → the knowledge explorer.
    expect(HELP_SECTIONS).toContain('knowledge')
  })
  it('the inventory\'s "moved to Help" rows K23–K30 each name their Help destination (Task 68)', () => {
    const inventory = read('docs/FEATURE_INVENTORY.md')
    const row = id => inventory.match(new RegExp(`^\\| ${id} \\|(.+)$`, 'm'))[1]
    const destination = { K23: 'guide', K24: 'about', K25: 'privacy', K26: 'contact', K27: 'runs-where', K28: 'tests' }
    for (const [id, page] of Object.entries(destination)) {
      expect(row(id), id).toContain(FILES[page])
      expect(row(id), id).toMatch(/\| Keep → Help[^|]*\(Task 68: /)
    }
    expect(row('K29')).toContain('?app=help#knowledge')
    expect(row('K30')).toContain('?app=help#pathways')
  })
})

describe('Task 68 · the words', () => {
  it('the same keys in both languages, no percentage, the brief\'s names, no technical term', () => {
    const keys = value => (value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v).map(sub => `${k}.${sub}`)]) : [])
    expect(keys(W('ar'))).toEqual(keys(W('en')))
    expect(JSON.stringify(W('ar')) + JSON.stringify(W('en'))).not.toMatch(/[%٪]|urn:|MiniLM|SPARQL/)
    expect(W('en').pages).toEqual({ guide: 'How KAMIN works', about: 'About', privacy: 'Privacy policy', 'runs-where': 'What runs where', tests: 'Test results', contact: 'Contact' })
    expect(W('en').reviewerTitle).toBe('Reviewer tools')
    expect(W('en').tools).toEqual({ knowledge: 'Knowledge explorer', pathways: 'Pathway search by meaning' })
    for (const lang of LANGS) expect(fillIn(W(lang).more, { page: 'X' })).toMatch(/X$/)
  })
  it('the footer\'s pages are the public site\'s own pages (the old footer named them; pageHref writes the language)', () => {
    for (const lang of LANGS) for (const [, file] of HELP_PAGES) expect(pageHref(file, lang)).toBe(`/${lang}/${file}`)
    const oldFooter = new Set(footerItems.map(([file]) => file))
    for (const page of ['about', 'privacy', 'runs-where', 'tests', 'contact']) expect(oldFooter.has(FILES[page]), page).toBe(true)
  })
})

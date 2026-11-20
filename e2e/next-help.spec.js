// Task 68 · Help and the footer in the new interface (?ui=next). Help is one tap from Profile and from the footer; it
// lists How KAMIN works, About, Privacy policy, What runs where, Test results and Contact (every link answers 200 and is
// the page in the interface's language), then Reviewer tools with its one line: the knowledge explorer and the pathway
// search by meaning open at ?app=help#<tool> (Back returns to the row, a refresh keeps the tool). The footer is on Home
// and Help only, never in the four steps: one line on desktop, a compact list on phones above the tab bar. "Why?" sheets
// link to the matching Help page. No sideways scroll at 360px; axe in both themes. Arabic and English, desktop and phone.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { NEXT_COPY } from '../src/ui2/copy.js'
import { HELP_PAGES, HELP_SECTIONS, VIEW_TEXT } from '../src/ui2/views.js'
import { LANGS, kamin } from './roles.js'

const DESKTOP = { width: 1366, height: 768 }
const PHONE = { width: 390, height: 844 }
const NARROW = { width: 360, height: 780 }
const W = lang => NEXT_COPY[lang].help
const PAGE_NAMES = lang => HELP_PAGES.map(([id]) => W(lang).pages[id])
const TOOL_NAMES = lang => HELP_SECTIONS.map(id => W(lang).tools[id])
const helpRow = (app, name) => app.main().getByRole('link', { name, exact: true })
const linksOf = scope => scope.getByRole('link').evaluateAll(all => all.map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href'), target: a.getAttribute('target') })))
// The SemanticRecall.jsx and KnowledgeWorkspace.jsx headings (the old components, unchanged).
const PATHWAY_HEADING = lang => (lang === 'ar' ? 'صف اهتمامك بكلماتك' : 'Describe your interest in your own words')
const ENABLE = lang => (lang === 'ar' ? 'فعّل الاستكشاف المحلي — اختياري' : 'Enable local exploration — optional')

// Every public page link answers 200 and is that page in the interface's language.
async function expectLocalized(page, links, lang) {
  for (const { href, text } of links) {
    const response = await page.request.get(href)
    expect(response.status(), `${text}: ${href}`).toBe(200)
    expect(await response.text(), `${text}: the page is in ${lang}`).toMatch(new RegExp(`<html[^>]* lang="${lang}"[^>]* dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`))
  }
}

for (const lang of LANGS) test.describe(`Help and the footer (${lang})`, () => {
  test('Help is one tap from Profile: the six pages in this language (each answers 200), then Reviewer tools with its line', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.goToView('profile')
    await app.main().getByRole('button', { name: VIEW_TEXT.help.title[lang], exact: true }).click()
    await expect(app.heading('help')).toBeVisible()
    await expect(app.heading('help')).toBeFocused()
    await expect(page).toHaveURL(/[?&]app=help(&|$)/)
    await expect(app.tabLink('profile')).toHaveAttribute('aria-current', 'true')
    await expect(app.main().getByText(VIEW_TEXT.help.line[lang], { exact: true })).toBeVisible()
    const links = await linksOf(app.main())
    expect(links.map(link => link.text)).toEqual([...PAGE_NAMES(lang), ...TOOL_NAMES(lang)])
    const pages = links.slice(0, HELP_PAGES.length)
    expect(pages.map(link => link.href)).toEqual(HELP_PAGES.map(([, file]) => `/${lang}/${file}`))
    expect(pages.every(link => link.target === null), 'the pages open in the same tab; Back returns to Help').toBe(true)
    await expectLocalized(page, pages, lang)
    // The reviewer tools, under the line that says they are for reviewers.
    const tools = app.main().getByTestId('ui2-reviewer-tools')
    await expect(tools.getByRole('heading', { name: W(lang).reviewerTitle, level: 2 })).toBeVisible()
    await expect(tools.getByText(W(lang).reviewerLine, { exact: true })).toBeVisible()
    expect((await linksOf(tools)).map(link => link.text)).toEqual(TOOL_NAMES(lang))
    // A page opens in the same tab, in this language; Back returns to Help.
    await helpRow(app, W(lang).pages['runs-where']).click()
    await expect(page).toHaveURL(new RegExp(`/${lang}/runs-where(\\.html)?$`))
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(lang)
    await page.goBack()
    await expect(app.heading('help')).toBeVisible()
  })

  test('the reviewer tools open at ?app=help#<tool>: the knowledge explorer and the pathway search (consent first); Back returns to the row', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.goToView('help')
    for (const tool of HELP_SECTIONS) {
      await helpRow(app, W(lang).tools[tool]).click()
      const title = app.main().getByRole('heading', { name: W(lang).reviewerTitle, level: 2, exact: true })
      await expect(title).toBeFocused()
      expect(new URL(page.url()).hash).toBe(`#${tool}`)
      expect(new URL(page.url()).searchParams.get('app')).toBe('help')
      await expect(app.main().getByText(W(lang).reviewerLine, { exact: true })).toBeVisible()
      if (tool === 'knowledge') await expect(app.knowledgeExplorer()).toBeVisible()
      else {
        await expect(app.main().getByRole('heading', { name: PATHWAY_HEADING(lang), exact: true })).toBeVisible()
        await app.main().getByText(ENABLE(lang), { exact: true }).click()
        await expect(app.pathwaySearchLoad(), 'no download before the tool\'s own consent').toBeDisabled()
        await app.pathwaySearchConsent().check()
        await expect(app.pathwaySearchLoad()).toBeEnabled()
      }
      await page.goBack()
      await expect(app.heading('help')).toBeVisible()
      await expect(helpRow(app, W(lang).tools[tool]), 'focus is back on the row').toBeFocused()
      expect(new URL(page.url()).hash).toBe('')
    }
    // A refresh and a link keep the tool; "Back to Help" returns to the list; the fragment never follows to another view.
    await page.goto(`/${lang}/?app=help#knowledge`)
    await expect(app.knowledgeExplorer()).toBeVisible()
    await page.reload()
    await expect(app.knowledgeExplorer()).toBeVisible()
    await app.main().getByRole('button', { name: W(lang).back, exact: true }).click()
    await expect(app.heading('help')).toBeVisible()
    expect(new URL(page.url()).hash).toBe('')
    await helpRow(app, W(lang).tools.pathways).click()
    await app.tab('home')
    await expect(app.heading('home')).toBeVisible()
    expect(new URL(page.url()).hash, 'the tool does not follow to Home').toBe('')
  })

  test('the footer is on Home and Help, never in the flow: Help, the six pages in this language (each 200), then the tools', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    for (const view of ['home', 'help']) {
      await app.goToView(view)
      await expect(app.footer(), view).toBeVisible()
      await expect(app.footer().getByRole('navigation', { name: W(lang).footer, exact: true })).toBeVisible()
      const links = await linksOf(app.footer())
      expect(links.map(link => link.text), view).toEqual([VIEW_TEXT.help.title[lang], ...PAGE_NAMES(lang), ...TOOL_NAMES(lang)])
      expect(links.slice(1, 7).map(link => link.href)).toEqual(HELP_PAGES.map(([, file]) => `/${lang}/${file}`))
      expect(links.slice(7).map(link => new URL(link.href, page.url()).hash)).toEqual(HELP_SECTIONS.map(id => `#${id}`))
      if (view === 'home') await expectLocalized(page, links.slice(1, 7), lang)
      await expect(app.footer().getByText(W(lang).reviewerShort, { exact: true })).toBeVisible()
    }
    // Nothing about how it works in the four steps, My plan, Profile or Settings: no footer there.
    for (const view of ['upload', 'projects', 'interests', 'next', 'plan', 'profile', 'settings']) {
      await app.goToView(view)
      await expect(app.footer(), view).toHaveCount(0)
    }
  })

  test('the footer: one line at 1366×768, a compact list above the tab bar at 390×844; Home stays one screen', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    for (const size of [DESKTOP, PHONE]) {
      await page.setViewportSize(size)
      await app.home()
      const boxes = await app.footer().getByRole('link').evaluateAll(all => all.map(a => { const r = a.getBoundingClientRect(); return { top: Math.round(r.top), height: r.height, bottom: r.bottom } }))
      // The grid's cells (a link is start-aligned in its cell, so its own left edge varies with its length).
      const cells = await app.footer().getByRole('listitem').filter({ has: page.getByRole('link') }).evaluateAll(all => all.map(li => Math.round(li.getBoundingClientRect().left)))
      const length = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollHeight, view: innerHeight }))
      expect(length.scroll, `Home with its footer is one screen at ${size.width}×${size.height}`).toBeLessThanOrEqual(length.view)
      await expect(app.footer()).toBeInViewport({ ratio: 1 })
      if (size === DESKTOP) {
        expect(new Set(boxes.map(box => box.top)).size, 'one line on desktop').toBe(1)
      } else {
        expect(new Set(cells).size, 'two columns on a phone').toBe(2)
        for (const box of boxes) expect(box.height, 'each link is a tap target').toBeGreaterThanOrEqual(40)
        const tabsTop = await app.tabs().evaluate(el => el.getBoundingClientRect().top)
        expect(Math.max(...boxes.map(box => box.bottom)), 'the footer ends above the tab bar').toBeLessThanOrEqual(tabsTop)
      }
    }
  })

  test('by hand: Home → footer → Privacy policy in this language → Back; footer → Help; footer → the knowledge explorer (one tap each)', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.home()
    await app.footer().scrollIntoViewIfNeeded()
    await app.openHelpPage('privacy')
    await expect(page).toHaveURL(new RegExp(`/${lang}/privacy(\\.html)?$`))
    expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual([lang, lang === 'ar' ? 'rtl' : 'ltr'])
    await page.goBack()
    await expect(app.heading('home')).toBeVisible()
    await app.footerLink(VIEW_TEXT.help.title[lang]).click()
    await expect(app.heading('help')).toBeVisible()
    await app.home()
    await app.openKnowledgeExplorer()
    await expect(app.knowledgeExplorer()).toBeVisible()
    expect(new URL(page.url()).hash).toBe('#knowledge')
    await expect(app.heading('help'), 'the page heading stays for screen readers').toHaveCount(1)
    // The footer's other tool, while Help is open on this one: it opens at once, and Back returns to the first.
    await app.footerLink(W(lang).tools.pathways).click()
    await expect(app.main().getByRole('heading', { name: PATHWAY_HEADING(lang), exact: true })).toBeVisible()
    expect(new URL(page.url()).hash).toBe('#pathways')
    await page.goBack()
    await expect(app.knowledgeExplorer()).toBeVisible()
  })

  test('"Why?" sheets link to the matching Help page, in this language, in a new tab', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    const help = async (sheet, helpPage, file) => {
      await expect(sheet).toBeVisible()
      const link = sheet.getByTestId('ui2-why-help').getByRole('link')
      await expect(link).toHaveText(NEXT_COPY[lang].help.more.replace('{page}', W(lang).pages[helpPage]))
      await expect(link).toHaveAttribute('href', `/${lang}/${file}`)
      await expect(link).toHaveAttribute('target', '_blank')
      expect((await page.request.get(`/${lang}/${file}`)).status()).toBe(200)
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
    }
    await app.goToView('projects')
    await app.main().getByRole('button', { name: NEXT_COPY[lang].projects.why, exact: true }).click()
    await help(app.sheet(NEXT_COPY[lang].projects.whyTitle), 'guide', 'guide.html')
    await app.goToView('next')
    await app.main().getByRole('button', { name: NEXT_COPY[lang].next.aboutPaths, exact: true }).click()
    await help(app.sheet(NEXT_COPY[lang].next.pathsTitle), 'guide', 'guide.html')
    await app.goToView('profile')
    // A capability's reasons sheet ("Why this level?", Task 66).
    await app.main().getByTestId('capability-row').first().click()
    const reasons = page.getByRole('dialog').filter({ has: page.getByTestId('ui2-capability-details') })
    await help(reasons, 'guide', 'guide.html')
    // Step 1's "Why?" sheet links to the privacy policy (Task 62).
    await app.goToView('upload')
    await app.main().getByRole('button', { name: NEXT_COPY[lang].upload.why, exact: true }).click()
    const upload = app.sheet(NEXT_COPY[lang].upload.whyTitle)
    await expect(upload.getByRole('link', { name: NEXT_COPY[lang].upload.privacyPage })).toHaveAttribute('href', `/${lang}/privacy.html`)
  })

  test('no sideways scroll at 360px on Home with the footer, Help and both reviewer tools', async ({ page }) => {
    await page.setViewportSize(NARROW)
    const app = kamin(page, { ui: 'new', lang })
    const wide = []
    const check = async label => { const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (overflow > 0) wide.push(`${label}: ${overflow}px`) }
    await app.home(); await check('home')
    await app.goToView('help'); await check('help')
    await helpRow(app, W(lang).tools.knowledge).click(); await expect(app.knowledgeExplorer()).toBeVisible(); await check('knowledge')
    await page.goBack()
    await helpRow(app, W(lang).tools.pathways).click()
    await app.main().getByText(ENABLE(lang), { exact: true }).click(); await check('pathways')
    expect(wide).toEqual([])
  })

  for (const theme of ['light', 'dark']) test(`axe (${theme}): 0 violations on Home with the footer, Help and both reviewer tools`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ colorScheme: theme })
    const app = kamin(page, { ui: 'new', lang })
    const found = {}
    const check = async label => {
      await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity))
      const report = await new AxeBuilder({ page }).analyze()
      if (report.violations.length) found[label] = report.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
    }
    await app.home()
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain(theme)
    await check('home')
    await app.goToView('help'); await check('help')
    await helpRow(app, W(lang).tools.knowledge).click(); await expect(app.knowledgeExplorer()).toBeVisible(); await check('knowledge')
    await page.goBack()
    await helpRow(app, W(lang).tools.pathways).click()
    await app.main().getByText(ENABLE(lang), { exact: true }).click()
    await expect(app.pathwaySearchConsent()).toBeVisible()
    await check('pathways')
    expect(found).toEqual({})
  })
})

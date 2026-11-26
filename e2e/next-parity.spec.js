// Task 74 · the last features that ran on the old interface only, in the new one (the team's decisions of 2026-11-19).
// K08: My plan → "Why these paths?" → a pathway → "Open this pathway’s plan" shows the old development plan (four
// numbered steps, "Download plan", the same file and sentences); step 4's "Why these paths?" does not offer it.
// K37: a next step's Details sheet holds the old review (contest with a reason and an alias, recorded on this device,
// no capability changes), and "See my review history" opens Settings → Usage log with the decision listed.
// K34: a shared snapshot link opens in the new interface (the payload and key leave the address, nothing is added to
// the profile, Close shows the view), also when the link is opened while the page is open; with the retired old-interface address too (Task 70).
// No sideways scroll at 360px and axe 0 violations in both themes on all three. Arabic and English, desktop and phone.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { NEXT_COPY } from '../src/ui2/copy.js'
import { VIEW_TEXT } from '../src/ui2/views.js'
import { profileSkills } from '../src/utils/engine.js'
import { demoCourses, skills as catalog } from '../src/data.js'
import { buildCapabilitySnapshot, encryptSnapshot, snapshotFragment } from '../src/utils/capabilitySnapshot.js'
import { LANGS, kamin } from './roles.js'

const NARROW = { width: 360, height: 780 }
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const tr = (lang, ar, en) => (lang === 'ar' ? ar : en)
const N = lang => NEXT_COPY[lang].next
const SAMPLE = profileSkills({ approved: true, courses: demoCourses.map(row => ({ ...row })), college: 'FCIT', projects: [], tasks: [], credentials: [], insight: {}, consents: { analyze: true } })
const STEPS = { ar: ['راجع نقطة البداية', 'اختر تجربة تطبيقية واحدة', 'وثّق ما فعلته بنفسك', 'راجع الدليل مع مرشد'], en: ['Review your starting point', 'Choose one applied exercise', 'Document your own contribution', 'Review the evidence with an advisor'] }
const NO_CHANGE = { ar: 'الخطة لا تغيّر المهارات أو نتائج المطابقة، ولا تَعِد بقبول أو توظيف.', en: 'The plan does not change skills or matching results, and does not promise acceptance or employment.' }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
async function axe(page) {
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity))
  const report = await new AxeBuilder({ page }).analyze()
  return report.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
}
const fragmentFor = async skill => snapshotFragment(await encryptSnapshot(buildCapabilitySnapshot({ skillIds: [skill.id], goal: null, levels: { [skill.id]: 'synthetic' } })))

for (const lang of LANGS) test.describe(`Task 74 · parity (${lang})`, () => {
  test('K08: the development plan in My plan: four steps, the same download and sentences; not offered on step 4', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    await app.home()
    await app.openPlan()
    expect(app.clicks, 'My plan, Why these paths?, a pathway, Open this pathway’s plan').toBe(4)
    const plan = app.plan()
    const title = (await app.pathway(0).getByRole('heading').first().innerText()).trim()
    await expect(plan.getByRole('heading', { level: 3 })).toHaveText(title)
    await expect(plan.getByRole('listitem')).toHaveCount(4)
    for (const [i, step] of STEPS[lang].entries()) await expect(plan.getByRole('listitem').nth(i).getByRole('heading', { level: 4 })).toHaveText(step)
    // The steps keep their numbers (the sheet's own list layout is undone inside the old panel).
    expect(await plan.locator('ol').evaluate(ol => getComputedStyle(ol).listStyleType)).toBe('decimal')
    await expect(plan.getByText(NO_CHANGE[lang], { exact: true })).toBeVisible()
    await expect(app.pathway(0).getByRole('button', { name: N(lang).openPlan, exact: true })).toHaveAttribute('aria-expanded', 'true')
    const download = await app.downloadPlan()
    expect(download.suggestedFilename()).toBe('kamin-development-plan.txt')
    const file = readFileSync(await download.path(), 'utf8')
    expect(file).toContain(title)
    expect(file).toContain(`1. ${STEPS[lang][0]}`)
    expect(file).toContain(tr(lang, 'هذه الخطة لا تغيّر أدلة الملف أو حكم الملاءمة.', 'This plan does not change profile evidence or fit judgments.'))
    expect(await app.pathwaySheet().innerText(), 'no percentage').not.toMatch(PERCENT)
    // Step 4's "Why these paths?" shows the pathways without the plan (it lives in My plan).
    await page.keyboard.press('Escape')
    await app.goToView('next')
    await app.click(app.goals().getByRole('button', { name: N(lang).aboutPaths, exact: true }), 'why these paths')
    await app.openPathway(0)
    await expect(app.pathway(0).getByRole('button', { name: N(lang).openPlan, exact: true })).toHaveCount(0)
  })

  test('K37: contest a next step in its Details sheet; recorded on this device; no capability changes; the history in Settings', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    const before = await app.capabilityLevels()
    await app.home()
    await app.openRecommendation()
    const review = app.review()
    await expect(review.getByText(tr(lang, 'قرارك ومراجعتك', 'Your decision & review'), { exact: true })).toBeVisible()
    await expect(review.getByText(tr(lang, 'لم تُراجع بعد', 'Not reviewed yet'), { exact: true })).toBeVisible()
    await review.getByRole('button', { name: tr(lang, 'أعترض على هذا الحكم', 'Contest this judgment') }).click()
    // RecommendationReview.jsx: the safeguard sentence of the form, word for word.
    await expect(review.getByText(tr(lang, 'راجع أدلة هذه التوصية وفجواتها أعلاه. غياب الدليل لا يعني غياب القدرة. الاعتراض يبقى على جهازك ولا يُرسل إلى مستشار أو فريق كامن.', 'Review this recommendation’s evidence and gaps above. Missing evidence does not mean missing ability. A contest stays on your device; it is not sent to an advisor or the Kamin team.'), { exact: true })).toBeVisible()
    const save = review.getByRole('button', { name: tr(lang, 'احفظ المراجعة محليًا', 'Save review locally') })
    await expect(save, 'no review without a reviewer name or alias').toBeDisabled()
    await review.getByLabel(tr(lang, 'اسم المراجع أو اسمه المستعار — محلي', 'Reviewer name or alias — local')).fill(tr(lang, 'اسم مستعار للاختبار', 'Test alias'))
    await save.click()
    await expect(review.getByRole('status')).toHaveText(tr(lang, 'سُجلت مراجعتك محليًا. لم تُرسل إلى أحد ولم تتغير أدلة قدراتك.', 'Your review was recorded locally. Nothing was sent and your capability evidence did not change.'))
    await expect(review.getByText(tr(lang, 'أعترض على هذا الحكم', 'Contest this judgment'), { exact: true }).first()).toBeVisible()
    await app.openReviewHistory()
    await expect(app.detailsSheet(), 'the sheet closed').toHaveCount(0)
    await expect.poll(() => [new URL(page.url()).searchParams.get('app'), new URL(page.url()).hash]).toEqual(['settings', '#log'])
    await expect(app.main().getByRole('listitem').filter({ hasText: tr(lang, 'أعترض على هذا الحكم', 'Contest this judgment') })).toBeVisible()
    expect(await app.capabilityLevels(), 'a review changes no capability or level').toEqual(before)
  })

  test('K34: a snapshot link opens in the new interface; Close shows the view; a link opened later is read too', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    const fragment = await fragmentFor(SAMPLE[0])
    await page.goto(`/${lang}/${fragment}`)
    await expect(app.snapshotHeading()).toBeVisible()
    await expect(page.getByTestId('ui2-topbar'), 'the new interface').toBeVisible()
    await expect(page.locator('[data-ui="next"]')).toHaveCount(1)
    await expect.poll(() => page.url(), { message: 'the payload and key leave the address bar' }).not.toContain('payload=')
    expect(page.url()).not.toContain('key=')
    await app.openSnapshot()
    await expect(page.getByRole('listitem').filter({ hasText: catalog[SAMPLE[0].id].labels[lang] }).first()).toBeVisible()
    await page.getByRole('button', { name: tr(lang, 'إغلاق اللقطة والعودة إلى كامن', 'Close snapshot and return to Kamin') }).click()
    await expect(app.snapshotHeading()).toHaveCount(0)
    await expect(app.heading('home')).toBeVisible()
    // A link opened while the page is open (the same tab): read at once, the view's address kept, the secret dropped.
    await app.goToView('plan')
    const second = await fragmentFor(SAMPLE[1] || SAMPLE[0])
    await page.evaluate(hash => { location.hash = hash.replace(/^#/, '') }, second)
    await expect(app.snapshotHeading()).toBeVisible()
    await expect.poll(() => page.url()).not.toContain('payload=')
    expect(new URL(page.url()).searchParams.get('app')).toBe('plan')
  })

  // Task 70: the old reader is deleted with the old interface; its address opens this interface's reader.
  test('K34: with the retired old-interface address a snapshot link opens the interface reader', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    const fragment = await fragmentFor(SAMPLE[0])
    await page.goto(`/${lang}/?${new URLSearchParams({ ui: 'old' })}${fragment}`)
    await expect(app.snapshotHeading()).toBeVisible()
    await expect(page.getByTestId('ui2-topbar'), 'the interface').toBeVisible()
    await expect.poll(() => page.url(), { message: 'the payload and key leave the address bar' }).not.toContain('payload=')
  })

  test('no sideways scroll at 360px: the plan, the review form and the snapshot', async ({ page }) => {
    await page.setViewportSize(NARROW)
    const app = kamin(page, { ui: 'new', lang })
    const wide = []
    const check = async label => { const px = await overflow(page); if (px > 0) wide.push(`${label}: ${px}px`) }
    await app.sample()
    await app.home()
    await app.openPlan(); await check('plan')
    await page.keyboard.press('Escape')
    await app.home()
    await app.openRecommendation()
    await app.review().getByRole('button', { name: tr(lang, 'أعترض على هذا الحكم', 'Contest this judgment') }).click(); await check('review')
    await page.goto(`/${lang}/${await fragmentFor(SAMPLE[0])}`)
    await app.openSnapshot(); await check('snapshot')
    expect(wide).toEqual([])
  })

  for (const theme of ['light', 'dark']) test(`axe (${theme}): 0 violations on the plan, the review form and the snapshot`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ colorScheme: theme })
    const app = kamin(page, { ui: 'new', lang })
    const found = {}
    const check = async label => { const v = await axe(page); if (v.length) found[label] = v }
    await app.sample()
    await app.home()
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain(theme)
    await app.openPlan(); await check('plan')
    await page.keyboard.press('Escape')
    await app.home()
    await app.openRecommendation()
    await app.review().getByRole('button', { name: tr(lang, 'أعترض على هذا الحكم', 'Contest this judgment') }).click(); await check('review')
    await page.goto(`/${lang}/${await fragmentFor(SAMPLE[0])}`)
    await expect(app.snapshotHeading()).toBeVisible(); await check('snapshot')
    await app.openSnapshot(); await check('snapshot open')
    expect(found).toEqual({})
  })
})

// The page heading of a view while a snapshot is open is the reader's own (one h1).
test('K34: one h1 while the snapshot is open, and the title of the view stays', async ({ page }) => {
  await page.goto(`/en/${await fragmentFor(SAMPLE[0])}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page).toHaveTitle(`${VIEW_TEXT.home.title.en} · KAMIN`)
})

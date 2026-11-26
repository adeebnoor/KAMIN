// The inference proof and its RDF export. Until Task 70 this ran on the old landing page's synthetic demo ("Explore
// further", with its own sample inputs); that demo is deleted with the old interface (inventory D01). The proof it showed
// is the one My map shows (Profile → My map, the old "Show connections" graph, src/components/InferenceExplorer.jsx
// InferenceProof): here it is checked on the student's own map, with the approved synthetic example. The JSON-LD file is
// real RDF (parsed with jsonld), names the evidence connection the proof states, and the page passes axe and 360px.
import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import jsonld from 'jsonld'
import { LANGS, kamin } from './roles.js'

for (const lang of LANGS) test(`My map's inference proof states its connection and exports actual RDF (${lang})`, async ({ page }) => {
  const ar = lang === 'ar'
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.home()
  await app.openMap()
  const proof = app.myMap().locator('.inference-proof')
  await expect(proof).toBeVisible()
  await expect(proof.locator('.inference-result')).toContainText(ar ? 'لديه دليل مرتبط بمتطلب في' : 'has evidence for a requirement in')
  await proof.locator('.inference-technical > summary').click()
  const downloadEvent = page.waitForEvent('download')
  await proof.getByRole('button', { name: ar ? 'تنزيل الشبكة بصيغة JSON-LD' : 'Download graph as JSON-LD' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('kamin-inference.jsonld')
  const rdf = await jsonld.toRDF(JSON.parse(await readFile(await download.path(), 'utf8')), { format: 'application/n-quads' })
  expect(rdf).toContain('<urn:kamin:hasCapabilityEvidenceFor>')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([])
})

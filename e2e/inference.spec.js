import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import jsonld from 'jsonld'

for(const lang of ['ar','en'])test(`semantic example changes with inputs and exports actual RDF (${lang})`,async({page})=>{
  const ar=lang==='ar'
  await page.goto(`/?lang=${lang}`)
  await page.getByRole('link',{name:ar?'اكتشف كيف يصل كامن إلى اقتراحه':'See how Kamin reaches a suggestion'}).click()
  const proof=page.locator('.inference-demo .inference-proof')
  await expect(proof.locator('.inference-result')).toContainText(ar?'يرتبط تفضيله':'preference connection')
  await page.getByLabel(ar?'تضمين الأدلة الأكاديمية الوهمية':'Include synthetic academic evidence').uncheck()
  await expect(proof.locator('.inference-limits')).toContainText(ar?'لا يوجد في هذا الملف دليل':'This profile has no evidence')
  await expect(proof.locator('.inference-result')).toContainText(ar?'يرتبط تفضيله':'preference connection')
  await proof.locator('summary').click()
  const downloadEvent=page.waitForEvent('download')
  await proof.getByRole('button',{name:ar?'تنزيل الشبكة بصيغة JSON-LD':'Download graph as JSON-LD'}).click()
  const download=await downloadEvent
  expect(download.suggestedFilename()).toBe('kamin-inference.jsonld')
  const rdf=await jsonld.toRDF(JSON.parse(await readFile(await download.path(),'utf8')),{format:'application/n-quads'})
  expect(rdf).toContain('<urn:kamin:hasPreferenceContextFor>')
  expect(rdf).not.toContain('<urn:kamin:hasCapabilityEvidenceFor>')
  await page.getByLabel(ar?'اهتمام الطالب في المثال':'Sample student’s interest').selectOption('')
  await page.getByLabel(ar?'المسار في المثال':'Sample pathway').selectOption('job-cyber-analyst')
  await expect(proof.locator('.inference-empty')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  const results=await new AxeBuilder({page}).analyze()
  expect(results.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([])
})

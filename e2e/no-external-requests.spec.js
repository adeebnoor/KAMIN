import {test,expect} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { kamin } from './roles.js'
import { RUNTIME_MANIFEST } from '../src/content/runtimeManifest.js'

// Task 16 · the main journey against the production build (`npm run preview` of `npm run build`,
// the same build Render and Vercel publish) makes no request outside the app's own origin, and the
// browser reports no Content-Security-Policy violation (a blocked outside call never shows up as a
// request, so violations are watched too).

// A small synthetic transcript PDF (no real student), so the PDF.js reader and its worker load too.
function syntheticTranscriptPdf(lines){
 const text=lines.map((l,i)=>`BT /F1 11 Tf 50 ${760-i*18} Td (${l.replace(/[()\\]/g,'\\$&')}) Tj ET`).join('\n')
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`]
 let pdf='%PDF-1.4\n';const offsets=[]
 objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`})
 const xref=Buffer.byteLength(pdf)
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
 return Buffer.from(pdf,'latin1')
}

function watchNetwork(page,baseURL){
 const own=new URL(baseURL).origin,outside=[],violations=[],seen=[]
 page.context().on('request',request=>{const url=request.url();if(/^(data|blob):/.test(url))return;if(new URL(url).origin!==own)outside.push(url);else seen.push(url)})
 page.on('console',message=>{if(/Content Security Policy|Refused to connect/i.test(message.text()))violations.push(message.text())})
 return {outside,violations,seen}
}

test('the main journey makes no request outside the app and triggers no CSP violation',async({page,baseURL})=>{
 test.setTimeout(120_000)
 const net=watchNetwork(page,baseURL)
 await page.addInitScript(()=>{window.__cspViolations=[];document.addEventListener('securitypolicyviolation',e=>window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`))})
 // Task 70: the same journey on the interface (the old window, menu and privacy page are deleted).
 const app=kamin(page,{ui:'new',lang:'ar'})
 await app.home()
 await app.openUpload()

 // 1. Upload a synthetic transcript (PDF) and approve it.
 await page.locator('#ui2-transcript-file').setInputFiles({name:'synthetic-transcript.pdf',mimeType:'application/pdf',buffer:syntheticTranscriptPdf([
  'Synthetic transcript - not a real student','CPIT 240 Databases 3 A','CPIT 251 Software Engineering 3 B+','STAT 110 Introduction to Statistics 3 B'])})
 await expect(app.resultLine()).toBeVisible({timeout:30_000})
 // Task 55: no dropdown; this PDF prints no college, so the note's Fix opens the one-tap list.
 await page.getByTestId('college-note').getByRole('button',{name:'تصحيح'}).click()
 await page.getByTestId('college-fix').getByRole('button',{name:'كلية الحاسبات وتقنية المعلومات'}).click()
 await app.approve()
 await expect(app.heading('projects')).toBeVisible()

 // 2. Capabilities (one opened) and the next steps.
 await app.openCapabilities()
 await app.openCapability(0)
 await expect(app.capabilitySheet().locator('.evidence-item').first()).toBeVisible()
 await page.keyboard.press('Escape')
 await app.openGoals()
 await app.chooseGoal('data')
 await app.openGoalElsewhere()
 await expect(app.stepCards().first()).toBeVisible()

 // 3. Save on this device, then 4. download an encrypted backup.
 await app.openSaveOffer()
 await app.keepOnDevice()
 const download=await app.downloadBackup('synthetic passphrase 2026')
 expect(download.suggestedFilename()).toMatch(/\.kamin$/)

 // 5. Delete everything links to "What runs where", next to the storage details.
 await app.openSettingsSection('delete')
 await page.getByTestId('runs-where-link').click()
 await expect(page.getByRole('heading',{level:1,name:'ما الذي يعمل وأين'})).toBeVisible()

 // The watcher really sees traffic: the app's own files, including the PDF reader's worker.
 expect(net.seen.length).toBeGreaterThan(10)
 expect(net.seen.some(url=>/pdf.worker/.test(url)),'PDF.js worker loaded from the app').toBe(true)
 expect(net.outside,'requests outside the app').toEqual([])
 expect(net.violations,'CSP violations (console)').toEqual([])
 expect(await page.evaluate(()=>window.__cspViolations),'CSP violations (events)').toEqual([])
})

for(const lang of ['ar','en']){
 test(`"What runs where" lists every feature in the manifest, with nothing on a server: ${lang}`,async({page,baseURL})=>{
  const net=watchNetwork(page,baseURL)
  await page.goto(`/${lang}/runs-where.html`)
  await expect(page.getByRole('heading',{level:1})).toHaveText(lang==='ar'?'ما الذي يعمل وأين':'What runs where')
  for(const item of RUNTIME_MANIFEST){
   const row=page.locator(`[data-feature="${item.id}"]`)
   await expect(row,item.id).toHaveAttribute('data-runs-in',item.runsIn)
   await expect(row,item.id).toContainText(item.name[lang])
  }
  await expect(page.locator('[data-runs-in="server"]')).toHaveCount(0)
  await expect(page.locator('#not-built')).toContainText(lang==='ar'?'غير مبني':'Not built')
  // Linked from the footer and from the privacy page.
  await expect(page.locator('.k-site-footer a[href*="runs-where"]')).toHaveCount(1)
  await page.goto(`/${lang}/privacy.html`)
  await expect(page.locator('main a[href*="runs-where"]').first()).toBeVisible()
  // Phone width: no horizontal scroll; no accessibility violations.
  await page.setViewportSize({width:360,height:740}); await page.goto(`/${lang}/runs-where.html`)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true)
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()
  expect(axe.violations.map(v=>v.id)).toEqual([])
  expect(net.outside).toEqual([])
 })
}

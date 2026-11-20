import {test,expect} from './fixtures.js'
import { openView, reloadLanding, forEachPrivacySection, openAppWindow, loadSample, approveSample, openAppView, openMatch, settle } from './nav.js'
import { TECHNICAL_TERMS, jargonIn } from '../src/content/plainTerms.js'

// Task 12: the start, review, dashboard and My data screens show no developer terms outside a
// closed "Technical details" block (closed <details> content is not part of innerText).
const visibleText=page=>page.locator('.app-overlay').innerText()
async function expectPlain(page,label){
 await settle(page)
 const text=await visibleText(page)
 for(const term of TECHNICAL_TERMS) expect(text,`${label} shows "${term}"`).not.toContain(term)
}
for(const lang of ['ar','en']){
 const t=lang==='ar'
  ?{open:/افتح مساحة العمل/,demo:'جرّب المثال التوضيحي',consent:/أوافق صراحةً/,approve:/أعتمد السجل/,data:'بياناتي',privacy:'الخصوصية',audit:'سجل الاستخدام',details:'تفاصيل تقنية'}
  :{open:/Open workspace/,demo:'Try synthetic demo',consent:/I explicitly consent/,approve:/Approve transcript/,data:'My data',privacy:'Privacy',audit:'Usage log',details:'Technical details'}
 test(`${lang}: four screens speak plainly; technical terms only inside "Technical details"`,async({page})=>{
  await page.goto(`/${lang}/`)
  await page.getByRole('button',{name:t.open}).first().click()
  await expectPlain(page,'start')
  await page.getByRole('dialog').getByRole('button',{name:t.demo,exact:true}).click()
  await expectPlain(page,'review')
  await page.getByRole('checkbox',{name:t.consent}).check()
  await page.getByRole('button',{name:t.approve}).last().click()
  await expect(page.locator('.capability-list')).toBeVisible()
  await expectPlain(page,'dashboard')
  await openView(page,t.data); await expectPlain(page,'my data')
  // Task 27: the privacy page folds its blocks into five sections; each one is read open, as before the whole page was.
  await openView(page,t.privacy); await forEachPrivacySection(page,async id=>{if(id==='backup')await expect(page.getByTestId('credential-import')).toBeVisible();await expectPlain(page,`privacy: ${id}`)})
  // the technical explanation is still there, one click away
  const details=page.locator('[data-privacy-section][open] .tech-details').first()
  await details.locator('summary').click()
  await expect(details).toContainText(/JSON-LD|AES-GCM|IndexedDB/)
  await reloadLanding(page)
  await page.getByRole('button',{name:t.open}).first().click()
  await openView(page,t.audit); await expectPlain(page,'usage log')
 })
}

// Task 28: Interests & goal (before and after consent), Show connections (all three tabs), Matches (every
// row opened) and Courses. Every <details> that is not "Technical details" is opened first, so what a
// student can reach in one click is checked too; only text inside .tech-details may use the words.
// `reveal`: selectors whose hidden content is read as if shown (Matches keeps every row's panel in the page).
async function plainText(page,{skip=[],reveal=[]}={}){
 await settle(page)
 return page.evaluate(({skip,reveal})=>{
  const root=document.querySelector('.app-content')
  root.querySelectorAll('details:not(.tech-details)').forEach(d=>{d.open=true})
  const clone=root.cloneNode(true)
  clone.querySelectorAll(['.tech-details',...skip].join(',')).forEach(el=>el.remove())
  if(reveal.length)clone.querySelectorAll(reveal.join(',')).forEach(el=>el.removeAttribute('hidden'))
  clone.style.position='absolute';document.body.appendChild(clone)
  const text=clone.innerText;clone.remove();return text
 },{skip,reveal})
}
async function expectNoJargon(page,label,options){
 const text=await plainText(page,options)
 expect(text.length,`${label}: read some text`).toBeGreaterThan(100)
 const found=text.split('\n').flatMap(line=>[...jargonIn(line),...TECHNICAL_TERMS.filter(term=>line.includes(term))].map(term=>`"${term}" in: ${line.trim().slice(0,160)}`))
 expect(found,label).toEqual([])
}
for(const lang of ['ar','en']){
 test(`${lang}: Interests & goal, Show connections, Matches and Courses speak plainly (Task 28)`,async({page})=>{
  test.setTimeout(120_000)
  await openAppWindow(page,lang)
  await openAppView(page,'insight',lang)
  // the unlabeled row of six icons is gone; the three cards' icons are decorative
  await expect(page.locator('.profile-welcome-art')).toHaveCount(0)
  await expect(page.locator('.insight-privacy-grid svg:not([aria-hidden="true"])')).toHaveCount(0)
  await expect(page.locator('.insight-intro h2')).toHaveText(lang==='ar'?'اهتماماتك وهدفك':'Your interests and goal')
  await expectNoJargon(page,'interests before consent')
  await page.locator('.insight-consent input').check()
  await page.locator('.insight-intro .button.primary').click()
  await page.locator('input[type="radio"][name="careerInterest"][value="realistic"]').check()
  await expect(page.locator('.profile-node').filter({hasText:lang==='ar'?'اهتماماتك':'Interests'})).toContainText(lang==='ar'?'بناء الأشياء وإصلاحها':'Building and fixing things')
  await expectNoJargon(page,'interests after consent')
  // the Holland (RIASEC) names are kept for reviewers, one click away
  const codes=page.locator('.student-insight .tech-details').first()
  await codes.locator(':scope > summary').click()
  await expect(codes).toContainText('R · Realistic')
  await expect(codes).toContainText('C · Conventional')

  await page.goto(`/${lang}/`) // a fresh start for the approved example (session storage is per tab)
  await page.evaluate(()=>sessionStorage.clear())
  await openAppWindow(page,lang); await loadSample(page,lang); await approveSample(page,lang)
  await openAppView(page,'insight',lang)
  await expectNoJargon(page,'interests (approved record)')

  await openAppView(page,'studio',lang)
  await expectNoJargon(page,'show connections: network')
  const technical=page.locator('.app-content .inference-proof .inference-technical')
  await technical.locator(':scope > summary').click()
  await expect(technical).toContainText(/R\d · kamin-relations-v\d/)
  await expect(technical.getByRole('button',{name:lang==='ar'?'تنزيل الشبكة بصيغة JSON-LD':'Download graph as JSON-LD'})).toBeVisible()
  for(const tab of [1,2]){await page.locator('.studio-tabs [role=tab]').nth(tab).click();await expectNoJargon(page,`show connections: tab ${tab}`)}

  await openAppView(page,'matches',lang); await page.locator('.match-list').waitFor()
  await expectNoJargon(page,'matches')
  // every row, as if opened: all groups, all rows and all panels (closed rows keep their content in the page)
  await expect(page.locator('.match-row-panel')).not.toHaveCount(0)
  await expectNoJargon(page,'matches: every row opened',{reveal:['.match-rows','.match-row','.match-row-panel']})
  await openMatch(page,'job-data-analyst')
  await expectNoJargon(page,'matches: a row opened')
  const row=page.locator('[data-match-id="job-data-analyst"] .match-technical')
  await row.locator(':scope > summary').click()
  await expect(row).toContainText(/kamin-(graph-)?fit-v\d/)
  await expect(row.locator('.match-governance')).toBeVisible()

  await openAppView(page,'courses',lang)
  await expectNoJargon(page,'courses')
 })
}

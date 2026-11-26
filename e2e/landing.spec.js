import {test,expect} from '@playwright/test'

// Task 14: the home page had five sections and "Start" above the fold; the content it moved lives on public pages.
// Task 70: the old landing page is deleted (its two tests are mapped in log/task-70.md to e2e/next-upload.spec.js and
// e2e/next-look.spec.js); this test keeps checking that the moved content is on its page, and each page answers.
for(const lang of ['ar','en']){
 const t=lang==='ar'
  ?{start:'ابنِ ملف قدراتك',example:'جرّب مثالًا حيًا',idea:'الفكرة التي بُني عليها كامن',who:'من أين تبدأ؟',proof:'ملف واحد. علاقات تكشف أكثر.',honest:'ابنِ ملفًا يشبهك',clue:'درجة المقرر قرينة على مخرج تعلم متوقع'}
  :{start:'Build your capability profile',example:'Try a live example',idea:'The idea behind Kamin',who:'Where would you like to start?',proof:'One profile. Connections that reveal more.',honest:'Build a profile that reflects you.',clue:'A course grade is a clue to an expected learning outcome'}

 test(`${lang}: the content moved off the old home page is on its page, and each page answers`,async({page,request})=>{
  for(const file of ['about.html','services.html','trust.html']){const response=await request.get(`/${lang}/${file}`);expect(response.ok(),file).toBeTruthy()}
  await page.goto(`/${lang}/about.html`); await expect(page.locator('#idea')).toContainText(t.idea)
  await page.goto(`/${lang}/services.html`); await expect(page.locator('#who-for')).toContainText(t.who); await expect(page.locator('#services-proof')).toContainText(t.proof)
  await page.goto(`/${lang}/trust.html`); await expect(page.locator('#honest-profile')).toContainText(t.honest)
 })
}

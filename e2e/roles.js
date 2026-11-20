// Task 45 · how the keep-tests (e2e/keep-features.spec.js) reach and use each feature, per interface.
//
// The keep-tests check that every feature a student relies on is still there, with its safeguard, while
// the interface is rebuilt (Tasks 59–70). They never look for an element themselves: they ask the object
// made by kamin(page, { ui, lang }) to reach a feature by the route a student takes (counting every click
// from Home) and to hand back what must be checked. Everything here is found by role, accessible name,
// label, visible text or a data-testid (docs/FEATURE_INVENTORY.md lists them and which ones the new
// interface carries too): never a CSS class or CSS selector.
//
// `ui` is 'old' (the app window over the landing page, src/App.jsx) or 'new' (the rebuilt interface, src/ui2).
// Task 60 added the NewUI class next to OldUI and put 'new' in UIS; each task that rebuilds a feature then
// implements that feature's methods in NewUI and lists the inventory row in NewUI.FEATURES, so the row's
// keep-test runs on both interfaces (keep-features.spec.js asks uisFor(row)). Rows: docs/FEATURE_INVENTORY.md.
// Task 69: the new interface is the default, so NewUI opens the plain addresses (/ar/, /en/?app=<view>); OldUI
// needs the browser context to open the old interface (useOldInterface in e2e/fixtures.js, as after ?ui=old).
// Task 74: every keep row now runs on the new interface (K04 was dropped by the team on 2026-11-19). K38 (My map) exists on
// the new interface only (NEW_ONLY).
import { expect } from '@playwright/test'
import { copy, fill } from '../src/i18n.js'
import { SECTIONS, TABS } from '../src/navigation.js'
import { LEVEL_MEANINGS } from '../src/content/levelReasons.js'
import { DECLARED_PREFERENCE_SCHEMES } from '../src/insight.js'
import { PILOT_CONSENT, PILOT_COPY } from '../src/content/pilotConsent.js'
import { NEXT_TABS, NEXT_VIEWS, VIEW_TEXT } from '../src/ui2/views.js'
import { NEXT_COPY, fillIn } from '../src/ui2/copy.js'
import { targetProfiles } from '../src/matching/targets.js'

export const LANGS = Object.freeze(['ar', 'en'])
export const UIS = Object.freeze(['old', 'new'])
// Task 60 · every view of the new interface, in walking order (the APP_VIEWS list of e2e/nav.js is the old
// interface's), so page-length and axe checks can walk them all. A new view is added in src/ui2/views.js.
export const NEW_APP_VIEWS = NEXT_VIEWS

const sectionLabel = (id, lang) => SECTIONS.find(s => s.id === id).labels[lang]
const tabLabel = (view, lang) => Object.values(TABS).flat().find(tab => tab.view === view).labels[lang]
const startsWith = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)

// Clicks are counted from Home: every click, tap, tick and untick a test makes. Typing, picking a file in
// the system file picker and opening an address are not clicks. `steps` names them, for failure messages.
class Driver {
  constructor(page, lang) { this.page = page; this.lang = lang; this.clicks = 0; this.steps = [] }
  t(ar, en) { return this.lang === 'ar' ? ar : en }
  counted(step) { this.clicks++; this.steps.push(step) }
  async click(locator, step) { await locator.click(); this.counted(step) }
  async check(locator, step) { await locator.check(); this.counted(step) }
  async uncheck(locator, step) { await locator.uncheck(); this.counted(step) }
  // A click that opens the system file picker, then the file chosen in it (the choice is not a click).
  async chooseFile(locator, step, file) {
    const chooser = this.page.waitForEvent('filechooser')
    await this.click(locator, step)
    await (await chooser).setFiles(file)
  }
  // A click that downloads a file; returns the download.
  async download(locator, step) {
    const download = this.page.waitForEvent('download')
    await this.click(locator, step)
    return download
  }

  // ----- K34 · a shared snapshot link (SnapshotReceiver in CapabilitySnapshot.jsx): the same reader in both interfaces
  // (Task 74 moved it into the new one) -----
  async openSnapshot() { await this.click(this.page.getByRole('button', { name: this.t('فتح اللقطة محليًا', 'Open snapshot locally') }), 'open the snapshot') }
  snapshotHeading() { return this.page.getByRole('heading', { name: this.t('لقطة قدرات مشتركة', 'Shared capability snapshot'), level: 1 }) }
  snapshotContentsHeading() { return this.page.getByRole('heading', { name: this.t('محتوى اللقطة', 'Snapshot contents') }) }

  // ----- K31 · the trial layer (PilotStudy.jsx): the same component in both interfaces -----
  pilotConsent() { return this.page.getByRole('dialog', { name: PILOT_CONSENT[this.lang].title }) }
  async joinPilot() {
    await this.check(this.pilotConsent().getByRole('checkbox', { name: PILOT_CONSENT[this.lang].agree }), 'agree to take part')
    await this.click(this.pilotConsent().getByRole('button', { name: PILOT_CONSENT[this.lang].start }), 'start the session')
  }
  pilotBar() { return this.page.getByTestId('pilot-bar') }
  async withdrawFromPilot() {
    await this.click(this.pilotBar().getByRole('button', { name: PILOT_COPY[this.lang].withdraw }), 'withdraw from the study')
    await this.click(this.page.getByRole('dialog', { name: PILOT_COPY[this.lang].withdraw }).getByRole('button', { name: PILOT_COPY[this.lang].withdrawYes }), 'yes, withdraw')
  }
}

// ---------- Today's interface: the app window over the landing page ----------
class OldUI extends Driver {
  static FEATURES = 'all'

  get c() { return copy[this.lang] }
  // The app window, its scrolling page area and its two navigations (sidebar on desktop, bottom bar on phones).
  app() { return this.page.getByRole('dialog', { name: this.c.app.title }) }
  main() { return this.app().getByRole('main') }
  async section(id) { await this.click(this.app().getByRole('navigation').getByRole('button', { name: sectionLabel(id, this.lang), exact: true }).filter({ visible: true }).first(), `section ${id}`) }
  async tab(view) { await this.click(this.app().getByRole('tab', { name: tabLabel(view, this.lang), exact: true }), `tab ${view}`) }
  footerLink(name) { return this.page.getByRole('navigation', { name: this.t('روابط المساعدة والمشروع', 'Help and project links') }).getByRole('link', { name, exact: true }) }

  // ----- Home and set-up (set-up is never counted) -----
  async home() {
    await this.page.goto(`/${this.lang}/`)
    await expect(this.page.getByRole('button', { name: this.t('افتح مساحة العمل', 'Open workspace'), exact: true }).first()).toBeVisible()
  }
  // An approved synthetic example in this tab's session: the review opened by ?start=sample (kept for tests
  // and reviewers after the demo leaves Home), consent, approve. The test then goes Home.
  async sample() {
    await this.page.goto(`/${this.lang}/?start=sample`)
    await this.reviewConsent().check()
    await this.approveButton().click()
    await expect(this.capabilitiesHeading()).toBeVisible()
  }
  // Opens the app window from Home; inside the window already, it does nothing (and counts nothing).
  async openApp() {
    if (await this.app().isVisible()) return
    await this.click(this.page.getByRole('button', { name: this.t('افتح مساحة العمل', 'Open workspace'), exact: true }).first(), 'open workspace')
    await expect(this.app()).toBeVisible()
  }

  // ----- K01, K02 · upload, review, approve -----
  async openUpload() { await this.openApp(); await expect(this.uploadControl()).toBeVisible() }
  uploadControl() { return this.app().getByRole('button', { name: this.t('ارفع كشف الدرجات', 'Upload your transcript') }) }
  async chooseTranscript(file) {
    await this.chooseFile(this.uploadControl(), 'choose a transcript file', file)
    await expect(this.app().getByRole('heading', { name: this.c.screens.review.title, level: 2 })).toBeVisible()
  }
  // The review screen lists every row that was read: nothing to open or close (Task 62: the new interface keeps
  // them in its "Fix something" sheet).
  async showReadRows() {}
  async hideReadRows() {}
  readRows() { return this.main() }
  readCodes() { return this.app().getByRole('textbox', { name: new RegExp(`^${this.c.app.courseCode} \\d+$`) }) }
  readGrade(n) { return this.app().getByRole('textbox', { name: `${this.c.app.grade} ${n}`, exact: true }) }
  reviewConsent() { return this.app().getByRole('checkbox', { name: this.c.screens.review.consent, exact: true }) }
  approveButton() { return this.app().getByRole('button', { name: this.c.app.approve, exact: true }) }
  approveReason() { return this.app().getByTestId('approve-reason') }
  async approve() {
    await this.check(this.reviewConsent(), 'tick the transcript consent')
    await this.click(this.approveButton(), 'approve')
  }
  // Where the student lands once the record is approved.
  approvedView() { return this.capabilitiesHeading() }

  // ----- K10, K11 · capabilities, levels and reasons -----
  capabilitiesHeading() { return this.app().getByRole('heading', { name: this.c.screens.dashboard.title, level: 2 }) }
  async openCapabilities() { await this.openApp(); await expect(this.capabilitiesHeading()).toBeVisible() }
  capabilityRows() { return this.app().getByTestId('capability-row') }
  // Task 63: every capability row's text, so a keep-test can compare before and after (NewUI reads the same rows).
  async capabilityLevels() { return this.capabilityRows().allInnerTexts() }
  async openCapability(i = 0) { await this.click(this.capabilityRows().nth(i), 'open a capability') }
  // Where an opened capability shows its courses, grades and reasons (Task 66: the new interface's reasons sheet).
  capabilityDetails() { return this.main() }
  // The "because" line: said once above the list when every capability has the same reason, else per row.
  async levelReason() {
    const shared = this.app().getByTestId('capability-why-all')
    return (await shared.count()) ? shared : this.app().getByTestId('capability-why').first()
  }
  async openLevelMeanings() { await this.click(this.app().getByText(LEVEL_MEANINGS[this.lang].title, { exact: true }), 'what do the levels mean') }

  // ----- K03 · project evidence -----
  projects() { return this.app().getByRole('region', { name: this.t('أدلة تطبيقية مصرّح بها', 'Self-declared applied evidence') }) }
  async openProjects() { await this.openApp(); await expect(this.projects()).toBeVisible() }
  async addProject(title) {
    const panel = this.projects()
    await this.click(panel.getByRole('button', { name: this.t('أضف دليل مشروع', 'Add project evidence') }), 'add project evidence')
    await panel.getByLabel(this.t('عنوان الدليل', 'Evidence title')).fill(title)
    await this.check(panel.getByRole('group', { name: this.t('القدرات التي يخدمها هذا الدليل', 'Capabilities this evidence addresses') }).getByRole('checkbox').first(), 'tick a capability')
    await this.click(panel.getByRole('button', { name: this.t('سجّل الدليل محليًا', 'Record evidence locally') }), 'record the evidence')
  }

  // ----- K04 · interests -----
  async openInterests() { await this.click(this.page.getByRole('button', { name: this.t('ابنِ ملف قدراتك', 'Build your capability profile'), exact: true }), 'build your capability profile'); await expect(this.app()).toBeVisible() }
  interestsConsent() { return this.app().getByRole('checkbox', { name: this.c.screens.insight.consent, exact: true }) }
  interestsStart() { return this.app().getByRole('button', { name: this.t('ابدأ بصمتي', 'Start my profile') }) }
  async startInterests() { await this.check(this.interestsConsent(), 'tick the interests consent'); await this.click(this.interestsStart(), 'start my profile') }
  interestChoices() { return this.app().getByRole('group', { name: DECLARED_PREFERENCE_SCHEMES.careerInterest.label[this.lang] }).getByRole('radio') }
  // The first choice is "Undecided"; this picks the first real interest.
  async chooseInterest() { await this.check(this.interestChoices().nth(1), 'choose an interest'); return this.interestChoices().nth(1) }

  // ----- K05, K08, K37 · pathways, their plan and their review -----
  async openPathways() { await this.openApp(); await this.section('next'); await expect(this.main().getByRole('heading', { name: this.c.screens.matches.title, level: 2 })).toBeVisible() }
  pathway(i = 0) { return this.main().getByRole('article').nth(i) }
  pathwayReason(i = 0) { return this.pathway(i).getByTestId('match-reason') }
  opportunityNote() { return this.main().getByTestId('opportunity-status') }
  async openPathway(i = 0) {
    const toggle = this.pathway(i).getByRole('heading').getByRole('button')
    await this.click(toggle, 'open a pathway')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    return this.pathway(i).getByTestId('match-evidence')
  }
  async openPlan() {
    await this.openPathways(); await this.openPathway(0)
    await this.click(this.pathway(0).getByRole('button', { name: this.t('افتح خطة هذا المسار', 'Open this pathway’s plan') }), 'open the pathway plan')
    await expect(this.app().getByRole('tab', { name: this.t('خطة التطوير', 'Development plan') })).toHaveAttribute('aria-selected', 'true')
  }
  plan() { return this.app().getByRole('tabpanel') }
  async downloadPlan() { return this.download(this.plan().getByRole('button', { name: this.t('تنزيل الخطة', 'Download plan') }), 'download the plan') }
  // K37 (Task 74: the new interface reviews a next step in its Details sheet): the recommendation to review, the
  // contest, and where the review history is.
  async openRecommendation() { await this.openPathways(); await this.openPathway(0) }
  async contestRecommendation(alias) { return this.contestPathway(alias) }
  async openReviewHistory() { await this.openUsageLog() }
  async contestPathway(alias) {
    const review = this.pathway(0).getByRole('region', { name: /^(مراجعة توصية|Review recommendation:) / })
    await this.click(review.getByRole('button', { name: this.t('أعترض على هذا الحكم', 'Contest this judgment') }), 'contest this judgment')
    await review.getByLabel(this.t('اسم المراجع أو اسمه المستعار — محلي', 'Reviewer name or alias — local')).fill(alias)
    const save = review.getByRole('button', { name: this.t('احفظ المراجعة محليًا', 'Save review locally') })
    await expect(save).toBeEnabled()
    await this.click(save, 'save the review')
    return review
  }

  // ----- K06 · courses and the learning path -----
  async openCourses() { await this.openApp(); await this.section('next'); await this.tab('courses') }
  courseGaps() { return this.main().getByTestId('course-closes') }
  async openLearningPath() { await this.click(this.main().getByRole('heading', { name: this.t('مسار تعلم مقترح', 'Suggested learning path') }), 'open the learning path') }
  // Where the learning path's own sentences show (Task 65: the new interface shows them in a card's Details sheet).
  learningPathScope() { return this.main() }
  learningGap() { return this.main().getByTestId('path-gap') }
  learningSteps() { return this.main().getByTestId('path-suggestion') }

  // ----- K07 · goal -----
  // Where the goal is chosen (the dashboard's "Your next step" card), and another place it shows (Matches).
  async openGoals() { await this.openCapabilities() }
  async openGoalElsewhere() { await this.openPathways() }
  currentGoal(goal) { return this.main().getByText(fill(this.c.screens.matches.goalCurrent, { goal: this.c.app.goals[goal] }), { exact: true }).filter({ visible: true }).first() }
  async chooseGoal(goal) {
    const chip = this.app().getByTestId('next-step-card').getByRole('button', { name: this.c.app.goals[goal], exact: true })
    await this.click(chip, `choose the goal ${goal}`)
    return chip
  }

  // ----- K09 · pathway comparison -----
  async openPathwayComparison() { await this.openApp(); await this.section('next'); await this.tab('compare') }
  pathwayComparison() { return this.main().getByRole('region', { name: this.t('مقارنة المسارات', 'Pathway comparison'), exact: true }) }

  // ----- K12 · credential import -----
  async openCredentials() { await this.openPrivacySection('backup'); await expect(this.credentials()).toBeVisible() }
  credentials() { return this.app().getByRole('region', { name: this.t('استيراد اعتماد قابل للتحقق', 'Import a verifiable credential') }) }
  async importCredential(file) {
    await this.chooseFile(this.credentials().getByText(this.t('اختر ملف اعتماد (.json / .jsonld)', 'Choose a credential file (.json / .jsonld)'), { exact: true }), 'choose a credential file', file)
    return this.credentials().getByTestId('credential-result')
  }
  async saveCredential() { await this.click(this.credentials().getByRole('button', { name: this.t('احفظ نتيجة التحقق محليًا', 'Save the verification result locally') }), 'save the verification result') }

  // ----- K13 · practice tasks -----
  tasks() { return this.app().getByRole('region', { name: this.t('المهمة والدليل والمراجعة', 'Task, evidence and review') }) }
  async openTasks() {
    await this.openApp()
    await this.click(this.app().getByText(this.t('المزيد: المهام، القرار التالي، الروابط، التصنيف الوطني', 'More: tasks, next decision, connections, national classification'), { exact: true }), 'more')
    await expect(this.tasks()).toBeVisible()
  }
  async startFirstTask() {
    await this.click(this.tasks().getByRole('button', { expanded: false }).first(), 'open a task')
    await this.click(this.tasks().getByRole('button', { name: this.t('ابدأ المهمة', 'Start the task') }), 'start the task')
  }

  // ----- K14, K15, K16 · my data: correct, delete one, delete everything -----
  async openMyData() { await this.openApp(); await this.section('my-data'); await expect(this.main().getByRole('heading', { name: this.c.screens.myData.title, level: 2 })).toBeVisible() }
  myGrade(code) { return this.app().getByRole('textbox', { name: this.t(`درجة ${code}`, `Grade ${code}`), exact: true }) }
  async saveMyData() {
    await this.click(this.app().getByRole('button', { name: this.t('احفظ التعديلات', 'Save changes') }), 'save changes')
    const confirm = this.app().getByRole('alertdialog', { name: this.t('تأكيد التعديلات', 'Confirm your changes') })
    await expect(confirm).toBeVisible()
    return confirm
  }
  async confirmMyData() { await this.click(this.app().getByRole('alertdialog').getByRole('button', { name: this.t('تأكيد وإعادة الحساب', 'Confirm and recompute') }), 'confirm and recompute') }
  async undo() { await this.click(this.app().getByRole('button', { name: this.t('تراجع عن آخر تغيير', 'Undo last change') }), 'undo') }
  changeSummary(title) { return this.app().getByRole('region', { name: title }) }
  async askDeleteCourse(code) {
    await this.click(this.app().getByRole('button', { name: this.t(`حذف ${code}`, `Delete ${code}`), exact: true }), `delete ${code}`)
    const confirm = this.app().getByRole('alertdialog', { name: this.t(`حذف ${code}؟`, `Delete ${code}?`) })
    await expect(confirm).toBeVisible()
    return confirm
  }
  async confirmDeleteOne() { await this.click(this.app().getByRole('alertdialog').getByRole('button', { name: this.t('احذف نهائيًا', 'Delete permanently') }), 'delete permanently') }
  async askDeleteEverything() {
    await this.openMyData()
    await this.click(this.app().getByRole('button', { name: this.t('احذف كل بياناتي من هذا الجهاز', 'Delete all my data from this device') }), 'delete all my data')
    const confirm = this.app().getByRole('alertdialog', { name: this.t('سيُحذف من هذا الجهاز:', 'This will be deleted from this device:') })
    await expect(confirm).toBeVisible()
    return confirm
  }
  async confirmDeleteEverything() { await this.click(this.app().getByRole('alertdialog').getByRole('button', { name: this.t('نعم، احذف كل شيء من هذا الجهاز', 'Yes, delete everything from this device') }), 'yes, delete everything') }
  deletedConfirmation() { return this.app().getByTestId('deleted-confirmation') }

  // ----- K17–K22 · consents, saving, backup, sharing, usage log, export -----
  async openConsents() { await this.openApp(); await this.section('my-data'); await this.tab('privacy'); await expect(this.main().getByRole('heading', { name: this.c.screens.myData.privacyTitle, level: 2 })).toBeVisible() }
  consent(key) { return this.app().getByRole('checkbox', { name: startsWith(this.c.app.consentItems[key]) }) }
  async withdraw(key) { await this.uncheck(this.consent(key), `withdraw ${key}`) }
  // One part of "Consent, saving & deletion" (Permissions starts open; the others open with their heading).
  async openPrivacySection(id) {
    await this.openConsents()
    if (id !== 'permissions') await this.click(this.app().getByRole('heading', { name: this.c.screens.privacy.sections[id], exact: true }), `open ${id}`)
  }
  // K18: where the offer to keep the profile on this device is made (the dashboard's alert; Task 67: Settings).
  async openSaveOffer() { await this.openCapabilities() }
  // K33: where the save offer is a message on the page (the dashboard's alert slot; Task 74: My plan's offer).
  async openOfferMessage() { await this.openCapabilities() }
  async keepOnDevice() { await this.openApp(); await this.click(this.app().getByRole('button', { name: this.t('نعم، احتفظ بملفي', 'Yes, keep my profile') }), 'keep my profile') }
  saveStatus() { return this.app().getByTestId('save-status') }
  notices() { return this.app().getByTestId('notice') }
  // Every message on screen now: notices and the dashboard's alert slot (Task 25: at most one).
  messages() { return this.notices().or(this.main().getByTestId('dashboard-alert')) }
  async closeNotice() { await this.click(this.notices().getByRole('button', { name: this.t('إغلاق الرسالة', 'Close message') }), 'close the message') }
  async downloadBackup(passphrase) {
    await this.openPrivacySection('backup')
    await this.app().getByLabel(this.t('عبارة المرور', 'Passphrase'), { exact: true }).fill(passphrase)
    await this.app().getByLabel(this.t('تأكيد العبارة — مطلوب للتصدير فقط', 'Confirm — export only'), { exact: true }).fill(passphrase)
    return this.download(this.app().getByRole('button', { name: this.t('تنزيل نسخة مشفّرة', 'Download encrypted backup') }), 'download the backup')
  }
  // A returning student on a device that holds nothing: Home, open the app, restore from the backup file.
  async restoreBackup(file, passphrase) {
    await this.openApp()
    await this.section('my-data')
    await this.app().getByLabel(this.t('عبارة مرور النسخة المستعادة', 'Passphrase of the backup to restore'), { exact: true }).fill(passphrase)
    await this.chooseFile(this.app().getByRole('button', { name: this.t('اختر ملف النسخة واستعدها', 'Choose the backup file and restore') }), 'choose the backup file', file)
  }
  async downloadCapabilityFile() {
    await this.openPrivacySection('backup')
    return this.download(this.app().getByRole('button', { name: this.c.screens.myData.exportFile }), 'download the capability file')
  }
  async makeShareLink() {
    await this.openPrivacySection('share')
    await this.check(this.app().getByRole('group', { name: this.t('القدرات التي ستظهر', 'Capabilities to include') }).getByRole('checkbox').first(), 'choose a capability')
    const create = this.app().getByRole('button', { name: this.t('إنشاء رابط مشفّر', 'Create encrypted link'), exact: true })
    await expect(create, 'no link before the student confirms the preview').toBeDisabled()
    await this.check(this.app().getByRole('checkbox', { name: this.t('راجعت محتوى اللقطة وأفهم أن الرابط يمنح حامله إمكانية قراءتها.', 'I reviewed the snapshot and understand that the link grants its holder access.') }), 'confirm the preview')
    await this.click(create, 'create the link')
    return this.app().getByRole('textbox', { name: this.t('الرابط الكامل — عامله كمعلومة خاصة', 'Full link — treat it as private') })
  }
  async openUsageLog() { await this.openApp(); await this.section('my-data'); await this.tab('audit'); await expect(this.main().getByRole('heading', { name: this.c.screens.myData.auditTitle, level: 2 })).toBeVisible() }

  // ----- K23–K28 · help pages; K29, K30 · reviewer tools -----
  howItWorks() { return this.page.getByRole('region', { name: this.t('ثلاث خطوات، وكل خطوة تعرف سببها.', 'Three steps, each with its reason.') }) }
  async openHelpPage(page) {
    const links = {
      guide: () => this.howItWorks().getByRole('link', { name: this.t('دليلك إلى البداية', 'Your guide to getting started') }),
      about: () => this.footerLink(this.t('عن كامن والفريق', 'About & team')),
      privacy: () => this.footerLink(this.t('الخصوصية', 'Privacy')),
      contact: () => this.footerLink(this.t('التواصل والمساعدة', 'Contact & help')),
      'runs-where': () => this.footerLink(this.t('ما الذي يعمل وأين', 'What runs where')),
      tests: () => this.footerLink(this.t('نتائج الاختبارات والتغييرات', 'Test results & changes')),
    }
    await this.click(links[page](), `open ${page}`)
  }
  async openKnowledgeExplorer() { await this.click(this.footerLink(this.t('مستكشف المعرفة', 'Knowledge explorer')), 'knowledge explorer') }
  knowledgeExplorer() { return this.main().getByRole('heading', { name: this.t('مستكشف المعرفة', 'Knowledge explorer'), level: 2 }) }
  async openPathwaySearch() {
    await this.openInterests(); await this.startInterests()
    await this.click(this.app().getByText(this.t('فعّل الاستكشاف المحلي — اختياري', 'Enable local exploration — optional'), { exact: true }), 'enable local exploration')
  }
  pathwaySearchConsent() { return this.app().getByRole('checkbox', { name: this.t('أوافق على التحليل المحلي وتحميل ملفات النموذج وحفظها على هذا الجهاز.', 'I agree to local analysis and downloading/caching model files on this device.') }) }
  pathwaySearchLoad() { return this.app().getByRole('button', { name: this.t('تحميل النموذج المحلي', 'Load local model') }) }

  // ----- K31–K34 · kept as they are: pilot mode, links, one message, snapshot receiver -----
  // (The trial layer's consent, bar and withdrawal are the same component in both interfaces: see Driver.)
  async openPilot() { await this.page.goto(`/${this.lang}/?pilot=1`) }
  pilotNotice() { return this.page.getByTestId('pilot-notice') }
  // The view a link opened, by the name of what the student sees selected.
  selectedView(view) { return this.app().getByRole('tab', { name: tabLabel(view, this.lang), exact: true }) }
  async openView(view) { await this.tab(view) }
  // ----- Only for the baseline numbers of today's views (docs/usability/before-rebuild.json) -----
  // The review of the synthetic example from the start screen, and "Show connections".
  async openSampleReview() {
    await this.openApp()
    await this.click(this.app().getByRole('button', { name: this.t('جرّب المثال التوضيحي', 'Try synthetic demo'), exact: true }), 'try the synthetic demo')
    await expect(this.reviewConsent()).toBeVisible()
  }
  async openConnections() { await this.openApp(); await this.section('next'); await this.tab('studio') }

  // ----- K35 · language; K36 · digital interests -----
  // The driver follows the student: after the switch it reads and names everything in the other language.
  async switchLanguage() {
    await this.click(this.app().getByRole('button', { name: this.t('English', 'العربية'), exact: true }), 'switch the language')
    this.lang = this.lang === 'ar' ? 'en' : 'ar'
  }
  async openDigitalInterests() {
    await this.openInterests(); await this.startInterests()
    await this.click(this.app().getByRole('button', { name: this.t('استكشف هذا المصدر', 'Explore this source') }), 'explore this source')
  }
  digitalConsent() { return this.app().getByRole('checkbox', { name: this.t('أوافق على تحليل نصوص أختارها محليًا لاقتراح اهتمامات أراجعها. تُحفظ فقط الموضوعات التي أؤكدها والكلمات الدالة عليها وتاريخ التأكيد؛ ويمكنني سحب الموافقة وحذفها.', 'I consent to local analysis of text I choose to suggest interests for my review. Only topics I confirm, their matching keywords and confirmation dates are saved. I can withdraw consent and delete them.'), exact: true }) }
  async suggestDigitalInterests(text) {
    await this.check(this.digitalConsent(), 'consent to the analysis')
    await this.click(this.app().getByRole('button', { name: this.t('فعّل التحليل الاختياري', 'Enable optional analysis') }), 'enable the analysis')
    await this.app().getByLabel(this.t('نصوص اخترتها عن التعلم أو العمل', 'Selected text about learning or work')).fill(text)
    await this.click(this.app().getByRole('button', { name: this.t('اقترح اهتمامات لأراجعها', 'Suggest interests for review') }), 'suggest interests')
  }
  async confirmDigitalInterest() { await this.click(this.app().getByRole('button', { name: this.t('يمثلني — أضفه', 'Reflects me — add it') }).first(), 'reflects me') }
}

// ---------- The new interface (Task 60): a full page, the default since Task 69 ----------
// The frame (top bar, tabs, sheet) is Task 60's. Tasks 62–68 implement the feature methods above in this class
// and list their inventory rows in FEATURES. Task 62: Home and step 1 (K01 upload, K02 review and approve) and
// the trial layer (K31). Task 66: Profile (K10, K11) and its More (K12, K13, K36). Task 67: Settings (K14–K22).
// Task 68: Help and the footer (K23–K30). Task 69: K32, the old interface's addresses on the new one.
// Task 74: K08 (the development plan in My plan), K33 (one message, on My plan), K34 (the snapshot reader), K35 (the
// language on Profile), K37 (the review in step 4's Details) and K38 (My map, new).
class NewUI extends Driver {
  static FEATURES = ['K01', 'K02', 'K03', 'K05', 'K06', 'K07', 'K08', 'K09', 'K10', 'K11', 'K12', 'K13', 'K14', 'K15', 'K16', 'K17', 'K18', 'K19', 'K20', 'K21', 'K22', 'K23', 'K24', 'K25', 'K26', 'K27', 'K28', 'K29', 'K30', 'K31', 'K32', 'K33', 'K34', 'K35', 'K36', 'K37', 'K38']

  get c() { return copy[this.lang] }
  get w() { return NEXT_COPY[this.lang] }
  topBar() { return this.page.getByTestId('ui2-topbar') }
  tabs() { return this.page.getByRole('navigation', { name: this.t('الأقسام', 'Sections'), exact: true }) }
  main() { return this.page.getByRole('main') }
  // A view's page heading. Home's heading is its one sentence (Task 62); every other view's is its title.
  heading(view) { return this.main().getByRole('heading', { level: 1, name: (view === 'home' ? VIEW_TEXT.home.line : VIEW_TEXT[view].title)[this.lang], exact: true }) }
  tabLink(id) { return this.tabs().getByRole('link', { name: NEXT_TABS.find(tab => tab.id === id).labels[this.lang], exact: true }) }
  mainAction() { return this.topBar().getByTestId('ui2-main-action') }
  logo() { return this.topBar().getByRole('link', { name: this.t('كامن: الرئيسية', 'KAMIN: Home'), exact: true }) }
  profileButton() { return this.topBar().getByRole('button', { name: VIEW_TEXT.profile.title[this.lang], exact: true }) }
  languageButton() { return this.topBar().getByRole('button', { name: this.t('English', 'العربية'), exact: true }) }
  themeButton() { return this.topBar().getByTestId('ui2-theme') }
  sheet(name) { return this.page.getByRole('dialog', { name, exact: true }) }

  // ----- Home and set-up (set-up is never counted) -----
  async home() { await this.page.goto(`/${this.lang}/`); await expect(this.heading('home')).toBeVisible() }
  // Opens a view by its address (?app=<view>), as a link or a refresh would (set-up, not counted).
  async goToView(view) { await this.page.goto(`/${this.lang}/?app=${view}`); await expect(this.heading(view)).toBeVisible() }
  async tab(id) { await this.click(this.tabLink(id), `tab ${id}`) }
  // Every view once, by its address; visit(view) runs on each.
  async walkViews(visit) { for (const view of NEW_APP_VIEWS) { await this.goToView(view); await visit(view) } }
  async switchLanguage() {
    await this.click(this.languageButton(), 'switch the language')
    this.lang = this.lang === 'ar' ? 'en' : 'ar'
  }

  // ----- K01, K02 · step 1: upload, the result card, the "Fix something" sheet, consent and Approve -----
  // Home's one main button (Start, or Continue).
  homeAction() { return this.main().getByTestId('ui2-home-action') }
  async openUpload() { await this.click(this.homeAction(), 'start'); await expect(this.uploadControl()).toBeVisible() }
  uploadControl() { return this.main().getByRole('button', { name: this.w.upload.choose }) }
  resultLine() { return this.main().getByTestId('ui2-result-line') }
  async chooseTranscript(file) {
    await this.chooseFile(this.uploadControl(), 'choose a transcript file', file)
    await expect(this.resultLine()).toBeVisible()
  }
  fixSheet() { return this.sheet(this.w.result.fixTitle) }
  // The rows that were read are in the "Fix something" sheet: one tap opens it, "Done" closes it.
  async showReadRows() {
    await this.click(this.main().getByRole('button', { name: this.w.result.fix, exact: true }), 'fix something')
    await expect(this.fixSheet()).toBeVisible()
  }
  async hideReadRows() {
    await this.click(this.fixSheet().getByRole('button', { name: this.w.result.done, exact: true }), 'done')
    await expect(this.fixSheet()).toHaveCount(0)
  }
  readRows() { return this.fixSheet() }
  readCodes() { return this.fixSheet().getByRole('textbox', { name: new RegExp(`^${this.c.app.courseCode} \\d+$`) }) }
  readGrade(n) { return this.fixSheet().getByRole('textbox', { name: `${this.c.app.grade} ${n}`, exact: true }) }
  reviewConsent() { return this.main().getByRole('checkbox', { name: this.c.screens.review.consent, exact: true }) }
  approveButton() { return this.main().getByRole('button', { name: this.c.app.approve, exact: true }) }
  approveReason() { return this.main().getByTestId('approve-reason') }
  async approve() {
    await this.check(this.reviewConsent(), 'tick the transcript consent')
    await this.click(this.approveButton(), 'approve')
  }
  // Approving step 1 opens step 2.
  approvedView() { return this.heading('projects') }
  // An approved synthetic example in this tab's session: step 1 opened by ?start=sample, consent, approve (set-up,
  // not counted). Approving opens step 2; the test then goes Home.
  async sample() {
    await this.page.goto(`/${this.lang}/?start=sample`)
    await this.reviewConsent().check()
    await this.approveButton().click()
    await expect(this.approvedView()).toBeVisible()
  }

  // ----- K03 · step 2: projects (Task 63) -----
  get wp() { return this.w.projects }
  // Home's Continue opens the step where the flow stopped: step 2 once the transcript is approved.
  async openProjects() { await this.click(this.homeAction(), 'continue'); await expect(this.heading('projects')).toBeVisible() }
  projects() { return this.main() }
  projectForm() { return this.main().getByTestId('ui2-project-form') }
  projectCards() { return this.main().getByTestId('ui2-project') }
  // The suggested skills: chips (toggle buttons) in the "Skills this project shows" group.
  projectChips() { return this.projectForm().getByRole('group', { name: this.wp.chips, exact: true }).getByRole('button') }
  // Add project, a title and a short description, "Suggest skills", then Save with the suggested skills.
  async addProject(title, description) {
    const add = this.main().getByRole('button', { name: (await this.projectCards().count()) ? this.wp.addAnother : this.wp.add, exact: true })
    await this.click(add, 'add project')
    await this.projectForm().getByLabel(this.wp.title, { exact: true }).fill(title)
    await this.projectForm().getByLabel(this.wp.description, { exact: true }).fill(description)
    await this.click(this.projectForm().getByRole('button', { name: this.wp.suggest, exact: true }), 'suggest skills')
    await expect(this.projectChips().first()).toBeVisible()
    await this.click(this.projectForm().getByRole('button', { name: this.wp.save, exact: true }), 'save the project')
    await expect(this.projectForm()).toHaveCount(0)
  }
  // Every capability row as the student reads it, on Profile (Task 66), from this tab's session (set-up, not
  // counted); the test comes back to the view it was on.
  async capabilityLevels() {
    const view = new URL(this.page.url()).searchParams.get('app') || 'home'
    await this.goToView('profile')
    await expect(this.capabilityRows().first()).toBeVisible()
    const texts = await this.capabilityRows().allInnerTexts()
    if (view !== 'profile') await this.goToView(view)
    return texts
  }

  // ----- Step 3: interests as chips plus the student's own words (Task 64; e2e/next-interests.spec.js) -----
  get wi() { return this.w.interests }
  // The interests consent, word for word (screens.insight.consent), as the old screen's checkbox is named.
  interestsConsent() { return this.main().getByRole('checkbox', { name: this.c.screens.insight.consent, exact: true }) }
  // A chip of one of the two questions ('careerInterest' or 'workValue'), by the old screen's label for that option.
  interestChip(scheme, optionId) {
    const label = DECLARED_PREFERENCE_SCHEMES[scheme].options.find(option => option.id === optionId).label[this.lang]
    return this.main().getByRole('group', { name: scheme === 'careerInterest' ? this.wi.areas : this.wi.values, exact: true }).getByRole('button', { name: label, exact: true })
  }
  freeInterestBox() { return this.main().getByRole('textbox', { name: this.wi.other, exact: true }) }
  freeInterestCards() { return this.main().getByTestId('ui2-free-interest') }
  // The chips understood from one card's sentence (every kind: pathways, skills, topics).
  freeInterestChips(card) { return card.getByRole('group').getByRole('button') }

  // ----- K05, K06, K07, K09 · step 4 (the next-steps feed) and My plan (Task 65; e2e/next-feed.spec.js) -----
  get wn() { return this.w.next }
  get wpl() { return this.w.plan }
  // The new interface's goals are pathways (Task 58). The old interface's four directions are reached through the
  // pathway of the same name: data → Data Analyst, cyber → Junior Cybersecurity Analyst, management → IT Project
  // Coordinator, product → Business Analyst.
  static GOAL_PATHWAY = Object.freeze({ data: 'job-data-analyst', cyber: 'job-cyber-analyst', management: 'job-project-coordinator', product: 'job-business-analyst' })
  goalPathwayName(goal) { return targetProfiles.find(t => t.id === (NewUI.GOAL_PATHWAY[goal] || goal)).title[this.lang] }
  goals() { return this.main().getByTestId('ui2-goals') }
  // A pathway chip of "Where do you want to go?" (a toggle button).
  goalChip(goal) { return this.goals().getByRole('group').getByRole('button', { name: this.goalPathwayName(goal), exact: true }) }
  // A chosen goal at the top (its button removes it).
  currentGoal(goal) { return this.goals().getByRole('button', { name: fillIn(this.wn.removeGoal, { goal: this.goalPathwayName(goal) }), exact: true }) }
  // K07: My plan holds the goals; step 4 shows the same goals ("See your next steps" while the plan is empty).
  async openGoals() { await this.tab('plan'); await expect(this.heading('plan')).toBeVisible() }
  async chooseGoal(goal) { const chip = this.goalChip(goal); await this.click(chip, `choose the goal ${goal}`); return chip }
  async openGoalElsewhere() { await this.click(this.main().getByRole('button', { name: this.wpl.seeSteps, exact: true }), 'see your next steps'); await expect(this.heading('next')).toBeVisible() }
  // K05: the pathways with their reasons, from "Why these paths?" (My plan, or step 4).
  pathwaySheet() { return this.sheet(this.wn.pathsTitle) }
  async openPathways() {
    await this.openGoals()
    await this.click(this.goals().getByRole('button', { name: this.wn.aboutPaths, exact: true }), 'why these paths')
    await expect(this.pathwaySheet()).toBeVisible()
  }
  pathway(i = 0) { return this.pathwaySheet().getByTestId('ui2-path').nth(i) }
  pathwayReason(i = 0) { return this.pathway(i).getByTestId('ui2-path-reason') }
  opportunityNote() { return this.pathwaySheet().getByTestId('ui2-opportunity-note') }
  async openPathway(i = 0) {
    const toggle = this.pathway(i).getByRole('heading').getByRole('button')
    await this.click(toggle, 'open a pathway')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    return this.pathway(i).getByTestId('ui2-path-details')
  }
  // K06: the feed of step 4 needs a goal: My plan, the Data Analyst chip, then "See your next steps".
  stepCards() { return this.main().getByTestId('ui2-step-card') }
  async openCourses() {
    await this.openGoals()
    await this.chooseGoal('data')
    await this.openGoalElsewhere()
    await expect(this.stepCards().first()).toBeVisible()
  }
  courseGaps() { return this.main().getByTestId('ui2-step-why') }
  detailsSheet() { return this.page.getByRole('dialog').filter({ has: this.page.getByTestId('ui2-step-details') }) }
  // The learning path's sentences, the gap and "Closes:" are in the first card's Details sheet.
  async openLearningPath() {
    await this.click(this.stepCards().first().getByRole('button', { name: new RegExp(`^${this.wn.details}: `) }), 'details')
    await expect(this.detailsSheet()).toBeVisible()
  }
  learningPathScope() { return this.detailsSheet() }
  learningGap() { return this.detailsSheet().getByTestId('ui2-step-gap') }
  learningSteps() { return this.detailsSheet().getByTestId('ui2-step-closes') }
  // K09: "Compare paths" on My plan opens the old comparison in a sheet.
  async openPathwayComparison() {
    await this.openGoals()
    await this.click(this.main().getByRole('button', { name: this.wpl.compare, exact: true }), 'compare paths')
    await expect(this.sheet(this.wpl.compare)).toBeVisible()
  }
  pathwayComparison() { return this.sheet(this.wpl.compare).getByRole('region', { name: this.t('مقارنة المسارات', 'Pathway comparison'), exact: true }) }

  // ----- K08 · the development plan (Task 74): My plan → "Why these paths?" → a pathway → "Open this pathway’s plan" -----
  async openPlan() {
    await this.openPathways(); await this.openPathway(0)
    await this.click(this.pathway(0).getByRole('button', { name: this.wn.openPlan, exact: true }), 'open the pathway plan')
    await expect(this.plan()).toBeVisible()
  }
  plan() { return this.pathway(0).getByRole('region', { name: this.wn.planTitle, exact: true }) }
  async downloadPlan() { return this.download(this.plan().getByRole('button', { name: this.t('تنزيل الخطة', 'Download plan') }), 'download the plan') }

  // ----- K37 · review or contest a next step, in its Details sheet (Task 74; the old RecommendationReview.jsx) -----
  async openRecommendation() { await this.openCourses(); await this.openLearningPath() }
  review() { return this.detailsSheet().getByRole('region', { name: /^(مراجعة توصية|Review recommendation:) / }) }
  async contestRecommendation(alias) {
    const review = this.review()
    await this.click(review.getByRole('button', { name: this.t('أعترض على هذا الحكم', 'Contest this judgment') }), 'contest this judgment')
    await review.getByLabel(this.t('اسم المراجع أو اسمه المستعار — محلي', 'Reviewer name or alias — local')).fill(alias)
    const save = review.getByRole('button', { name: this.t('احفظ المراجعة محليًا', 'Save review locally') })
    await expect(save).toBeEnabled()
    await this.click(save, 'save the review')
    return review
  }
  // "See my review history" under the review opens Settings → Usage log.
  async openReviewHistory() {
    await this.click(this.detailsSheet().getByRole('button', { name: this.wn.reviewHistory, exact: true }), 'see my review history')
    await expect(this.sectionHeading('log')).toBeVisible()
  }

  // ----- K10, K11 · Profile: capabilities, their levels and reasons (Task 66; e2e/next-profile.spec.js) -----
  get wpr() { return this.w.profile }
  capabilitiesHeading() { return this.main().getByRole('heading', { name: this.wpr.capabilities, level: 2, exact: true }) }
  async openCapabilities() { await this.tab('profile'); await expect(this.capabilitiesHeading()).toBeVisible() }
  capabilityRows() { return this.main().getByTestId('capability-row') }
  // A tap on a row opens its reasons sheet: why this level, the courses, projects and credentials behind it.
  capabilitySheet() { return this.page.getByRole('dialog').filter({ has: this.page.getByTestId('ui2-capability-details') }) }
  async openCapability(i = 0) { await this.click(this.capabilityRows().nth(i), 'open a capability'); await expect(this.capabilitySheet()).toBeVisible() }
  capabilityDetails() { return this.capabilitySheet() }
  // The "because" line: once above the rows when every capability shares it; otherwise in the first row's sheet.
  async levelReason() {
    const shared = this.main().getByTestId('capability-why-all')
    if (await shared.count()) return shared
    await this.openCapability(0)
    return this.capabilitySheet().getByTestId('capability-why')
  }
  async openLevelMeanings() { await this.click(this.main().getByText(LEVEL_MEANINGS[this.lang].title, { exact: true }), 'what do the levels mean') }

  // ----- K38 · My map on Profile (Task 74; Task 75: the old "Show connections" graph; e2e/next-map.spec.js) -----
  myMap() { return this.main().getByTestId('ui2-map') }
  // The old graph's nodes by kind (RelationshipNetwork.jsx: person, goal, interest, evidence, skill, job, training).
  mapNodes(kind) { return this.myMap().locator(`.relationship-node.relationship-${kind}`) }
  async openMap() {
    await this.tab('profile')
    await this.click(this.main().getByRole('button', { name: this.w.profile.map, exact: true }), 'my map')
    await expect(this.myMap()).toBeVisible()
  }
  // A tap on a capability node opens Profile's reasons sheet.
  async openMapCapability(i = 0) { await this.click(this.mapNodes('skill').nth(i), 'a capability on the map'); await expect(this.capabilitySheet()).toBeVisible() }

  // ----- K12, K13, K36 · Profile → More: the old components, opened in place (Task 66) -----
  async openMore(label) { await this.click(this.main().getByRole('button', { name: label, exact: true }), `more: ${label}`) }
  credentials() { return this.main().getByRole('region', { name: this.t('استيراد اعتماد قابل للتحقق', 'Import a verifiable credential') }) }
  async openCredentials() { await this.tab('profile'); await this.openMore(this.wpr.credential); await expect(this.credentials()).toBeVisible() }
  async importCredential(file) {
    await this.chooseFile(this.credentials().getByText(this.t('اختر ملف اعتماد (.json / .jsonld)', 'Choose a credential file (.json / .jsonld)'), { exact: true }), 'choose a credential file', file)
    return this.credentials().getByTestId('credential-result')
  }
  async saveCredential() { await this.click(this.credentials().getByRole('button', { name: this.t('احفظ نتيجة التحقق محليًا', 'Save the verification result locally') }), 'save the verification result') }
  tasks() { return this.main().getByRole('region', { name: this.t('المهمة والدليل والمراجعة', 'Task, evidence and review') }) }
  async openTasks() { await this.tab('profile'); await this.openMore(this.wpr.tasks); await expect(this.tasks()).toBeVisible() }
  async startFirstTask() {
    await this.click(this.tasks().getByRole('button', { expanded: false }).first(), 'open a task')
    await this.click(this.tasks().getByRole('button', { name: this.t('ابدأ المهمة', 'Start the task') }), 'start the task')
  }
  // "More ways to add interests" asks for the interests consent first (word for word), as the old interface does.
  async openDigitalInterests() {
    await this.tab('profile')
    await this.openMore(this.wpr.moreInterests)
    const consent = this.main().getByRole('checkbox', { name: this.c.screens.insight.consent, exact: true })
    // A tap: the checkbox is replaced by the panel once ticked (as on step 3), so it is clicked, not .check()ed.
    if (await consent.count()) await this.click(consent, 'tick the interests consent')
    await this.click(this.main().getByRole('button', { name: this.t('استكشف هذا المصدر', 'Explore this source') }), 'explore this source')
  }
  digitalConsent() { return this.main().getByRole('checkbox', { name: this.t('أوافق على تحليل نصوص أختارها محليًا لاقتراح اهتمامات أراجعها. تُحفظ فقط الموضوعات التي أؤكدها والكلمات الدالة عليها وتاريخ التأكيد؛ ويمكنني سحب الموافقة وحذفها.', 'I consent to local analysis of text I choose to suggest interests for my review. Only topics I confirm, their matching keywords and confirmation dates are saved. I can withdraw consent and delete them.'), exact: true }) }
  async suggestDigitalInterests(text) {
    await this.check(this.digitalConsent(), 'consent to the analysis')
    await this.click(this.main().getByRole('button', { name: this.t('فعّل التحليل الاختياري', 'Enable optional analysis') }), 'enable the analysis')
    await this.main().getByLabel(this.t('نصوص اخترتها عن التعلم أو العمل', 'Selected text about learning or work')).fill(text)
    await this.click(this.main().getByRole('button', { name: this.t('اقترح اهتمامات لأراجعها', 'Suggest interests for review') }), 'suggest interests')
  }
  async confirmDigitalInterest() { await this.click(this.main().getByRole('button', { name: this.t('يمثلني — أضفه', 'Reflects me — add it') }).first(), 'reflects me') }

  // ----- K14–K22 · Settings (Task 67; e2e/next-settings.spec.js): reached from Profile; each section is a sub-page -----
  get ws() { return this.w.settings }
  // A Settings sub-page's title (the section's name, under the page heading "Settings"), and a row of the list (named by
  // its label and status).
  sectionHeading(id) { return this.main().getByRole('heading', { level: 2, name: this.ws.rows[id], exact: true }) }
  settingsRow(id) { return this.main().getByRole('button', { name: startsWith(this.ws.rows[id]) }) }
  async openSettings() {
    await this.tab('profile')
    await this.click(this.main().getByRole('button', { name: VIEW_TEXT.settings.title[this.lang], exact: true }), 'settings')
    await expect(this.heading('settings')).toBeVisible()
  }
  async openSettingsSection(id) { await this.openSettings(); await this.click(this.settingsRow(id), `settings: ${id}`); await expect(this.sectionHeading(id)).toBeVisible() }
  // K14, K15: Profile's "Correct a course" opens Settings → My courses (the old My data component, unchanged).
  async openMyData() {
    await this.tab('profile')
    await this.click(this.main().getByRole('button', { name: this.wpr.correct, exact: true }), 'correct a course')
    await expect(this.sectionHeading('courses')).toBeVisible()
  }
  myGrade(code) { return this.main().getByRole('textbox', { name: this.t(`درجة ${code}`, `Grade ${code}`), exact: true }) }
  async saveMyData() {
    await this.click(this.main().getByRole('button', { name: this.t('احفظ التعديلات', 'Save changes') }), 'save changes')
    const confirm = this.main().getByRole('alertdialog', { name: this.t('تأكيد التعديلات', 'Confirm your changes') })
    await expect(confirm).toBeVisible()
    return confirm
  }
  async confirmMyData() { await this.click(this.main().getByRole('alertdialog').getByRole('button', { name: this.t('تأكيد وإعادة الحساب', 'Confirm and recompute') }), 'confirm and recompute') }
  async undo() { await this.click(this.main().getByRole('button', { name: this.t('تراجع عن آخر تغيير', 'Undo last change') }), 'undo') }
  changeSummary(title) { return this.main().getByRole('region', { name: title }) }
  async askDeleteCourse(code) {
    await this.click(this.main().getByRole('button', { name: this.t(`حذف ${code}`, `Delete ${code}`), exact: true }), `delete ${code}`)
    const confirm = this.main().getByRole('alertdialog', { name: this.t(`حذف ${code}؟`, `Delete ${code}?`) })
    await expect(confirm).toBeVisible()
    return confirm
  }
  async confirmDeleteOne() { await this.click(this.main().getByRole('alertdialog').getByRole('button', { name: this.t('احذف نهائيًا', 'Delete permanently') }), 'delete permanently') }
  // K16: Settings → Delete everything shows what will be deleted at once (the old Delete section's list).
  async askDeleteEverything() {
    await this.openSettingsSection('delete')
    const confirm = this.main().getByRole('alertdialog', { name: this.t('سيُحذف من هذا الجهاز:', 'This will be deleted from this device:') })
    await expect(confirm).toBeVisible()
    return confirm
  }
  async confirmDeleteEverything() { await this.click(this.main().getByRole('alertdialog').getByRole('button', { name: this.t('نعم، احذف كل شيء من هذا الجهاز', 'Yes, delete everything from this device') }), 'yes, delete everything') }
  deletedConfirmation() { return this.main().getByTestId('deleted-confirmation') }
  // K17: Settings → Consents (the old Permissions list, unchanged).
  async openConsents() { await this.openSettingsSection('consents') }
  consent(key) { return this.main().getByRole('checkbox', { name: startsWith(this.c.app.consentItems[key]) }) }
  async withdraw(key) { await this.uncheck(this.consent(key), `withdraw ${key}`) }
  // K18: the "Save on this device" switch on Settings, with the dashboard's sentence and its status.
  async openSaveOffer() { await this.openSettings() }
  // K33 (Task 74): My plan makes the dashboard's offer (the same words); it is the one message on the page.
  async openOfferMessage() { await this.tab('plan'); await expect(this.main().getByTestId('ui2-save-offer')).toBeVisible() }
  messages() { return this.notices().or(this.main().getByTestId('ui2-save-offer')) }
  async closeNotice() { await this.click(this.notices().getByRole('button', { name: this.t('إغلاق الرسالة', 'Close message') }), 'close the message') }
  async keepOnDevice() { await this.click(this.main().getByRole('button', { name: this.t('نعم، احتفظ بملفي', 'Yes, keep my profile'), exact: true }), 'keep my profile') }
  saveStatus() { return this.main().getByTestId('save-status') }
  notices() { return this.page.getByTestId('notice') }
  // K19, K20, K22: Backup and restore, Share and Export (the old components, unchanged).
  async downloadBackup(passphrase) {
    await this.openSettingsSection('backup')
    await this.main().getByLabel(this.t('عبارة المرور', 'Passphrase'), { exact: true }).fill(passphrase)
    await this.main().getByLabel(this.t('تأكيد العبارة — مطلوب للتصدير فقط', 'Confirm — export only'), { exact: true }).fill(passphrase)
    return this.download(this.main().getByRole('button', { name: this.t('تنزيل نسخة مشفّرة', 'Download encrypted backup') }), 'download the backup')
  }
  async restoreBackup(file, passphrase) {
    await this.openSettingsSection('backup')
    await this.main().getByLabel(this.t('عبارة مرور النسخة المستعادة', 'Passphrase of the backup to restore'), { exact: true }).fill(passphrase)
    await this.chooseFile(this.main().getByRole('button', { name: this.t('اختر ملف النسخة واستعدها', 'Choose the backup file and restore') }), 'choose the backup file', file)
  }
  async downloadCapabilityFile() {
    await this.openSettingsSection('export')
    return this.download(this.main().getByRole('button', { name: this.c.screens.myData.exportFile }), 'download the capability file')
  }
  async makeShareLink() {
    await this.openSettingsSection('share')
    await this.check(this.main().getByRole('group', { name: this.t('القدرات التي ستظهر', 'Capabilities to include') }).getByRole('checkbox').first(), 'choose a capability')
    const create = this.main().getByRole('button', { name: this.t('إنشاء رابط مشفّر', 'Create encrypted link'), exact: true })
    await expect(create, 'no link before the student confirms the preview').toBeDisabled()
    await this.check(this.main().getByRole('checkbox', { name: this.t('راجعت محتوى اللقطة وأفهم أن الرابط يمنح حامله إمكانية قراءتها.', 'I reviewed the snapshot and understand that the link grants its holder access.') }), 'confirm the preview')
    await this.click(create, 'create the link')
    return this.main().getByRole('textbox', { name: this.t('الرابط الكامل — عامله كمعلومة خاصة', 'Full link — treat it as private') })
  }
  // K21: Settings → Usage log.
  async openUsageLog() { await this.openSettingsSection('log') }

  // ----- K23–K30 · Help and the footer (Task 68; e2e/next-help.spec.js) -----
  // The footer is on Home and Help: Help, the six public pages and the two reviewer tools, each one tap away.
  get wh() { return this.w.help }
  footer() { return this.page.getByRole('contentinfo') }
  footerLink(name) { return this.footer().getByRole('link', { name, exact: true }) }
  // The old Home's "How it works" region. Task 68: the new interface's Home and flow explain nothing, so it is absent.
  howItWorks() { return this.page.getByRole('region', { name: this.t('ثلاث خطوات، وكل خطوة تعرف سببها.', 'Three steps, each with its reason.') }) }
  async openHelpPage(page) { await this.click(this.footerLink(this.wh.pages[page]), `open ${page}`) }
  // Help from Profile (one tap from the Profile tab), or from the footer.
  async openHelp() {
    await this.tab('profile')
    await this.click(this.main().getByRole('button', { name: VIEW_TEXT.help.title[this.lang], exact: true }), 'help')
    await expect(this.heading('help')).toBeVisible()
  }
  async openKnowledgeExplorer() { await this.click(this.footerLink(this.wh.tools.knowledge), 'knowledge explorer') }
  // The old KnowledgeWorkspace.jsx's own heading, under Help's "Reviewer tools".
  knowledgeExplorer() { return this.main().getByRole('heading', { name: this.t('مستكشف المعرفة', 'Knowledge explorer'), level: 2, exact: true }) }
  async openPathwaySearch() {
    await this.click(this.footerLink(this.wh.tools.pathways), 'pathway search')
    await this.click(this.main().getByText(this.t('فعّل الاستكشاف المحلي — اختياري', 'Enable local exploration — optional'), { exact: true }), 'enable local exploration')
  }
  pathwaySearchConsent() { return this.main().getByRole('checkbox', { name: this.t('أوافق على التحليل المحلي وتحميل ملفات النموذج وحفظها على هذا الجهاز.', 'I agree to local analysis and downloading/caching model files on this device.') }) }
  pathwaySearchLoad() { return this.main().getByRole('button', { name: this.t('تحميل النموذج المحلي', 'Load local model') }) }

  // ----- K31 · pilot mode: the trial layer of the old interface, reused (the methods are Driver's) -----
  async openPilot() { await this.page.goto(`/${this.lang}/?pilot=1`) }
  // The new interface says it in its one message (Task 25's notice).
  pilotNotice() { return this.page.getByTestId('notice') }
}

const UI_CLASSES = { old: OldUI, new: NewUI }

// The object a keep-test drives. `ui`: one of UIS.
export function kamin(page, { ui = 'old', lang }) {
  const UI = UI_CLASSES[ui]
  if (!UI) throw new Error(`e2e/roles.js: no interface "${ui}" (known: ${UIS.join(', ')})`)
  return new UI(page, lang)
}

// Rows of features that exist on the new interface only (Task 74: K38, My map). The old interface has every other row.
export const NEW_ONLY = Object.freeze(['K38'])
// The interfaces on which an inventory row's keep-test runs: every interface that implements that row.
export const uisFor = row => UIS.filter(ui => (UI_CLASSES[ui].FEATURES === 'all' ? !NEW_ONLY.includes(row) : UI_CLASSES[ui].FEATURES.includes(row)))

// Task 17 · the public page "Test results and changes" (public/tests.html).
// Pure functions only: scripts/test-report.mjs reads the files and git, this module turns them into numbers and HTML.
// Rule: every number on the page comes from a real run. Anything without a run says "not measured yet".

export const REPORT_FILE = 'public/tests.html'
export const NOT_MEASURED = { ar: 'لم يُقَس بعد', en: 'Not measured yet' }

const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const slash = p => String(p).replaceAll('\\', '/')
// A path inside the repo, whatever the absolute prefix was on the machine that ran the tests.
export const repoPath = (file, dir) => { const s = slash(file), i = s.lastIndexOf(`/${dir}/`); return i >= 0 ? s.slice(i + 1) : s.startsWith(`${dir}/`) ? s : `${dir}/${s}` }

// ---------- Vitest JSON (vitest run --reporter=json) ----------
export function summarizeVitest(json, expectedFiles = null) {
  if (!json) return null
  const files = (json.testResults || []).map(r => {
    const tests = r.assertionResults || []
    const count = st => tests.filter(t => st.includes(t.status)).length
    return { file: repoPath(r.name, 'tests'), status: r.status, tests: tests.length, passed: count(['passed']), failed: count(['failed']), skipped: count(['skipped', 'pending', 'todo', 'disabled']), loadError: r.status === 'failed' && tests.length === 0 }
  })
  const sum = k => files.reduce((n, f) => n + f[k], 0)
  const ran = new Set(files.map(f => f.file))
  const missing = expectedFiles ? expectedFiles.map(slash).filter(f => !ran.has(f)) : []
  return {
    startedAt: Number.isFinite(json.startTime) ? new Date(json.startTime).toISOString() : null,
    files: files.length, failedFiles: files.filter(f => f.status === 'failed').length,
    tests: sum('tests'), passed: sum('passed'), failed: sum('failed') + files.filter(f => f.loadError).length, skipped: sum('skipped'),
    missingFiles: missing, partial: missing.length > 0, byFile: files,
  }
}

// ---------- Playwright JSON (reporter "json") ----------
// titles: the describe() titles above the spec (the top-level suite is the file itself, so it is left out).
const walkSpecs = (suite, file = suite.file, titles = []) => [
  ...(suite.specs || []).map(spec => ({ ...spec, file: spec.file || file, titles })),
  ...(suite.suites || []).flatMap(child => walkSpecs(child, child.file || file, child.title && child.title !== child.file ? [...titles, child.title] : titles)),
]
// Task 48: the browser spec files a full run must cover. visual.spec.js runs in its own config, and
// e2e/zz-*.spec.js are local probes (git-ignored, in playwright.config.js testIgnore): neither is counted.
export const isSuiteSpecFile = file => { const f = slash(file), name = f.slice(f.lastIndexOf('/') + 1); return name.endsWith('.spec.js') && name !== 'visual.spec.js' && !name.startsWith('zz-') }
export function summarizePlaywright(json, expectedFiles = null) {
  if (!json) return null
  const tests = (json.suites || []).flatMap(s => walkSpecs(s)).flatMap(spec => (spec.tests || []).map(t => ({ file: repoPath(spec.file, 'e2e'), title: [...spec.titles, spec.title].filter(Boolean).join(' › '), project: t.projectName, status: t.status })))
  const count = (list, st) => list.filter(t => t.status === st).length
  const projectsConfigured = (json.config?.projects || []).map(p => p.name).filter(Boolean)
  const projectsRan = [...new Set(tests.map(t => t.project))]
  const ran = new Set(tests.map(t => t.file))
  const missing = expectedFiles ? expectedFiles.map(slash).filter(f => !ran.has(f)) : []
  const missingProjects = projectsConfigured.filter(p => !projectsRan.includes(p))
  const files = [...ran].sort().map(file => { const list = tests.filter(t => t.file === file); return { file, tests: list.length, passed: count(list, 'expected') + count(list, 'flaky'), failed: count(list, 'unexpected'), flaky: count(list, 'flaky'), skipped: count(list, 'skipped') } })
  return {
    startedAt: json.stats?.startTime ? new Date(json.stats.startTime).toISOString() : null,
    projects: projectsRan,
    files: files.length, tests: tests.length,
    // "flaky" = failed first, passed on the automatic retry. It counts as passed and is also shown on its own.
    passed: count(tests, 'expected') + count(tests, 'flaky'), failed: count(tests, 'unexpected'), flaky: count(tests, 'flaky'), skipped: count(tests, 'skipped'),
    // Task 48: which tests passed only on the retry, so the page and --check-committed can name them.
    flakyTests: tests.filter(t => t.status === 'flaky').map(({ file, title, project }) => ({ file, title, project })),
    missingFiles: missing, missingProjects, partial: missing.length > 0 || missingProjects.length > 0, byFile: files,
  }
}

// Task 48: retries stay at 1, but on main a test that passed only on the retry is not a green run.
export const flakyName = t => `${t.file} › ${t.title || '(untitled)'} [${t.project}]`
export function isMainBranch({ env = {}, gitBranch = null } = {}) {
  if (env.GITHUB_REF_NAME) return env.GITHUB_REF_NAME === 'main'
  return gitBranch === 'main'
}
// null when the run may be committed; otherwise the message --check-committed fails with.
export function flakyGate(e2e, onMain) {
  if (!onMain || !e2e || !e2e.flaky) return null
  const names = (e2e.flakyTests || []).map(flakyName)
  return `${e2e.flaky} browser test${e2e.flaky === 1 ? '' : 's'} passed only on the retry on main (flaky). Make ${e2e.flaky === 1 ? 'it' : 'them'} wait for the screen, not the clock:\n${names.map(n => `- ${n}`).join('\n')}`
}

// ---------- What the suites cover: measured per area from the same runs ----------
export const COVERAGE_AREAS = [
  { id: 'evidence-levels', ar: 'مستويات الأدلة (ترتيبية، بلا نسب)', en: 'Evidence levels (ordinal, no percentages)', unit: ['tests/evidenceLevels.test.js'], e2e: ['e2e/evidence-levels.spec.js'] },
  { id: 'course-map', ar: 'خريطة مقررات الكلية الرسمية', en: 'Official FCIT course map', unit: ['tests/fcitCatalog.test.js'], e2e: [] },
  { id: 'recompute', ar: 'إعادة الحساب بعد تغيير السجل أو الكلية', en: 'Recompute after a record or college change', unit: ['tests/recompute.test.js'], e2e: ['e2e/recompute-diff.spec.js'] },
  { id: 'my-data', ar: 'مراجعة بياناتي وتصحيحها', en: 'Review and correct my data', unit: ['tests/myData.test.js'], e2e: ['e2e/my-data.spec.js'] },
  { id: 'deletion', ar: 'الحذف وسحب الموافقة', en: 'Deletion and consent withdrawal', unit: ['tests/dataControl.test.js'], e2e: ['e2e/data-control.spec.js'] },
  { id: 'network-guard', ar: 'لا اتصال بخدمات خارجية', en: 'No calls to outside services', unit: ['tests/networkGuard.test.js', 'tests/hostingConfig.test.js'], e2e: ['e2e/no-external-requests.spec.js'] },
  { id: 'pilot-mode', ar: 'تجربة الطلاب: الموافقة وملف الدراسة والانسحاب', en: 'Student trial: consent, study file and withdrawal', unit: ['tests/pilotStudy.test.js', 'tests/pilotAnalytics.test.js'], e2e: ['e2e/pilot-mode.spec.js'] },
  { id: 'learning-path', ar: 'مسار التعلم المقترح: الفجوة أولًا وسبب كل اقتراح', en: 'Suggested learning path: gap first, a reason for each suggestion', unit: ['tests/learningPath.test.js'], e2e: ['e2e/learning-path.spec.js'] },
  { id: 'usability-budget', ar: 'حدود النقرات والخيارات وطول الصفحة', en: 'Click, choice and page-length budgets', unit: [], e2e: ['e2e/usability-journeys.spec.js', 'e2e/page-length.spec.js'] },
  { id: 'plain-language', ar: 'لغة واضحة للطالب', en: 'Plain student language', unit: ['tests/plainCopy.test.js', 'tests/wordingGuard.test.js'], e2e: ['e2e/plain-copy.spec.js'] },
  { id: 'accessibility', ar: 'الوصول واللغتان والجوال', en: 'Accessibility, both languages and mobile', unit: [], e2e: ['e2e/audit-remediation.spec.js', 'e2e/color-scheme.spec.js', 'e2e/a11y-all-views.spec.js'] },
  { id: 'evaluation-harness', ar: 'أداة تقييم اقتراح القدرات', en: 'Capability-suggestion evaluation harness', unit: ['tests/evalHarness.test.js'], e2e: [] },
]
export function coverage(unit, e2e) {
  const pick = (summary, files) => {
    if (!files.length) return null
    if (!summary) return { tests: null }
    const rows = summary.byFile.filter(f => files.includes(f.file))
    if (!rows.length) return { tests: null }
    return { tests: rows.reduce((n, r) => n + r.tests, 0), failed: rows.reduce((n, r) => n + r.failed, 0) }
  }
  return COVERAGE_AREAS.map(area => ({ ...area, unitResult: pick(unit, area.unit), e2eResult: pick(e2e, area.e2e) }))
}

// ---------- Task 07 evaluation: latest run per method on the frozen v1 set ----------
export const EVAL_SET = 'testset.json'
export function latestEvaluation(results) {
  const runs = (results || []).filter(r => r?.meta?.set === EVAL_SET && r.metrics?.all)
  if (!runs.length) return null
  const byMethod = new Map()
  for (const r of runs) { const prev = byMethod.get(r.meta.method); if (!prev || String(r.meta.date) > String(prev.meta.date)) byMethod.set(r.meta.method, r) }
  const order = ['lexicon', 'embedding', 'improved']
  const methods = [...byMethod.values()].sort((a, b) => (order.indexOf(a.meta.method) + 99) % 99 - (order.indexOf(b.meta.method) + 99) % 99)
  const first = methods[0].meta
  return {
    set: EVAL_SET, setSha256: first.setSha256, frozenAt: first.frozenAt,
    date: methods.map(m => m.meta.date).sort().at(-1),
    commits: [...new Set(methods.map(m => m.meta.commit))],
    methods: methods.map(m => ({ method: m.meta.method, version: m.meta.methodVersion, threshold: m.meta.threshold, date: m.meta.date, commit: m.meta.commit, cases: m.metrics.all.cases, precision: m.metrics.all.precision, recall: m.metrics.all.recall, f1: m.metrics.all.f1 })),
  }
}

// ---------- The page ----------
const pct = x => Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—'
const when = iso => iso ? `<span dir="ltr">${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC</span>` : null
const shortSha = s => String(s || '').slice(0, 7)
const commitLink = (repo, sha) => { const s = String(sha || ''), clean = s.replace(/-dirty$/, ''); return repo && /^[0-9a-f]{7,40}$/.test(clean) ? `<a href="${esc(repo)}/commit/${esc(clean)}"><code>${esc(shortSha(clean))}</code></a>` : `<code>${esc(s || '?')}</code>` }
const table = (label, head, rows) => `<div class="k-doc-table" role="region" tabindex="0" aria-label="${esc(label)}"><table><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr${r.attrs || ''}>${r.cells.map((c, i) => i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`
const card = (id, title, body) => `<section class="k-doc-card" id="${id}"><h2>${title}</h2>${body}</section>`

export function renderSection(lang, data) {
  const t = (ar, en) => lang === 'ar' ? ar : en
  const nm = `<em data-not-measured>${NOT_MEASURED[lang]}</em>`
  const { unit, e2e, evaluation, changes, commit, dirty, repository, generatedAt, changesSince, appMethod } = data
  const measuredOn = `${commitLink(repository, commit)}${dirty ? t(' مع تغييرات غير محفوظة في git', ' with uncommitted changes') : ''}`

  const unitRows = unit ? [
    { cells: [t('ملفات الاختبار', 'Test files'), `${unit.files}`], attrs: ' data-metric="unit-files"' },
    { cells: [t('الاختبارات', 'Tests'), `${unit.tests}`], attrs: ' data-metric="unit-tests"' },
    { cells: [t('نجح', 'Passed'), `${unit.passed}`], attrs: ' data-metric="unit-passed"' },
    { cells: [t('فشل', 'Failed'), `${unit.failed}`], attrs: ' data-metric="unit-failed"' },
    { cells: [t('متجاوَز', 'Skipped'), `${unit.skipped}`], attrs: ' data-metric="unit-skipped"' },
  ] : []
  const e2eRows = e2e ? [
    { cells: [t('الاختبارات (سطح المكتب والجوال)', 'Tests (desktop and phone)'), `${e2e.tests}`], attrs: ' data-metric="e2e-tests"' },
    { cells: [t('نجح', 'Passed'), `${e2e.passed}`], attrs: ' data-metric="e2e-passed"' },
    { cells: [t('فشل', 'Failed'), `${e2e.failed}`], attrs: ' data-metric="e2e-failed"' },
    { cells: [t('نجح في المحاولة الثانية', 'Passed on the second try'), `${e2e.flaky}`], attrs: ' data-metric="e2e-flaky"' },
    { cells: [t('متجاوَز', 'Skipped'), `${e2e.skipped}`], attrs: ' data-metric="e2e-skipped"' },
  ] : []
  const flakyList = e2e?.flakyTests?.length ? `<p data-flaky-tests>${t('نجحت هذه الاختبارات في المحاولة الثانية فقط:', 'These tests passed only on the second try:')}</p><ul class="k-flaky" lang="en" dir="ltr">${e2e.flakyTests.map(f => `<li>${esc(flakyName(f))}</li>`).join('')}</ul>` : ''
  const partialNote = s => s?.partial ? `<p data-partial-run><strong>${t('تشغيل جزئي:', 'Partial run:')}</strong> ${t('لم تُشغَّل كل ملفات الاختبار، فهذه الأرقام لا تمثل المجموعة كاملة.', 'not every test file ran, so these numbers do not cover the whole suite.')}</p>` : ''

  const summary = card('summary', t('النتيجة', 'Result'),
    `<p>${t('تاريخ التشغيل', 'Run on')}: ${when(unit?.startedAt || e2e?.startedAt) || when(generatedAt)} · ${t('النسخة', 'Version')}: ${measuredOn}</p>` +
    `<h3>${t('اختبارات الوحدة (Vitest)', 'Unit tests (Vitest)')}</h3>${unit ? table(t('اختبارات الوحدة', 'Unit tests'), [t('المقياس', 'Measure'), t('العدد', 'Count')], unitRows) + partialNote(unit) : `<p>${nm}</p>`}` +
    `<h3>${t('اختبارات المتصفح (Playwright)', 'Browser tests (Playwright)')}</h3>${e2e ? `<p>${t('كل اختبار يعمل مرتين: على سطح المكتب وعلى الجوال. الاختبار الذي يفشل يُعاد مرة واحدة تلقائيًا.', 'Each test runs twice: on desktop and on a phone. A test that fails is retried once automatically.')}</p>` + table(t('اختبارات المتصفح', 'Browser tests'), [t('المقياس', 'Measure'), t('العدد', 'Count')], e2eRows) + flakyList + partialNote(e2e) : `<p>${nm}</p>`}`)

  const cell = r => r === null ? '—' : r.tests === null ? nm : r.failed ? `${r.tests} (${t('فشل', 'failed')} ${r.failed})` : `${r.tests} (${t('كلها نجحت', 'all passed')})`
  const covered = card('coverage', t('ماذا تختبر', 'What the tests cover'),
    `<p>${t('عدد الاختبارات في كل مجال من التشغيل نفسه أعلاه. «—» تعني أن المجال لا يُختبر بهذا النوع.', 'Test counts per area come from the same run as above. “—” means the area is not tested by that kind of test.')}</p>` +
    table(t('مجالات الاختبار', 'Areas covered'), [t('المجال', 'Area'), t('اختبارات الوحدة', 'Unit tests'), t('اختبارات المتصفح', 'Browser tests')],
      coverage(unit, e2e).map(a => ({ cells: [esc(a[lang]), cell(a.unitResult), cell(a.e2eResult)], attrs: ` data-area="${a.id}"` }))))

  const methodName = m => `${({ lexicon: t('المعجم', 'Lexicon'), embedding: t('التضمين MiniLM', 'MiniLM embedding'), improved: t('المطابقة المحسّنة', 'Improved matching') })[m.method] || esc(m.method)} ${m.method === appMethod ? t('(المستخدمة في التطبيق الآن)', '(used in the app now)') : t('(غير مستخدمة في التطبيق)', '(not used in the app)')}`
  const evalBody = evaluation
    ? `<p>${t(`كيف يقترح كامن قدرات من وصف مشروع كتبه الطالب، مقيسًا على مجموعة اختبار مجمّدة من ${evaluation.methods[0].cases} حالة بالعربية والإنجليزية لم يُضبط عليها أي شيء.`, `How well Kamin suggests capabilities from a project description a student wrote, measured on a frozen test set of ${evaluation.methods[0].cases} Arabic and English cases that nothing was tuned on.`)}</p>` +
      table(t('بيانات التشغيل', 'Run details'), [t('البند', 'Item'), t('القيمة', 'Value')], [
        { cells: [t('تاريخ التشغيل', 'Run on'), esc(evaluation.date)] },
        { cells: [t('النسخة', 'Version'), evaluation.commits.map(c => commitLink(repository, c)).join(' ')] },
        { cells: [t('مجموعة الاختبار', 'Test set'), `<code>${esc(evaluation.set)}</code> · ${t('مجمّدة في', 'frozen')} ${esc(String(evaluation.frozenAt).slice(0, 10))}`] },
        { cells: [t('بصمة المجموعة (SHA-256)', 'Set fingerprint (SHA-256)'), `<code>${esc(evaluation.setSha256)}</code>`] },
      ]) +
      `<h3>${t('النتائج على المجموعة كلها', 'Results on the whole set')}</h3>` +
      table(t('نتائج التقييم', 'Evaluation results'), [t('الطريقة', 'Method'), t('الحالات', 'Cases'), t('الدقة', 'Precision'), t('الاستدعاء', 'Recall'), 'F1'],
        evaluation.methods.map(m => ({ cells: [methodName(m), `${m.cases}`, pct(m.precision), pct(m.recall), pct(m.f1)], attrs: ` data-method="${esc(m.method)}"` }))) +
      `<p>${t('الدقة: من بين القدرات المقترحة، كم منها صحيح. الاستدعاء: من بين القدرات الصحيحة، كم منها اقتُرح. هذه أرقام أداة على مجموعة اختبار، وليست ثقة في قدرة أي طالب، ولا تُعرض للطلاب.', 'Precision: of the suggested capabilities, how many were right. Recall: of the right capabilities, how many were suggested. These describe a tool on a test set; they are not confidence in any student’s ability and are never shown to students.')}</p>` +
      `<p>${t('توجد أيضًا نتائج على مجموعة ثانية كتبها الذكاء الاصطناعي؛ هي أولية ولا تُعرض هنا كنتيجة. المجموعة الثانية التي يكتبها ويصنّفها شخصان لم تُقَس بعد.', 'Results on a second, AI-written set also exist; they are preliminary and are not shown here as a result. The second set written and labelled by two people is not measured yet.')}</p>`
    : `<p>${nm}</p>`
  const evaluationCard = card('evaluation', t('تقييم اقتراح القدرات', 'Capability-suggestion evaluation'), evalBody)

  const pending = [
    ['usability-study', t('اختبار الاستخدام مع طلاب الكلية (5 طلاب أو أكثر)', 'Usability test with FCIT students (5 or more)'), t('اعتمد المشرف نص الموافقة؛ لم تُعقد أي جلسة بعد.', 'The supervisor approved the consent text; no session has taken place yet.')],
    ['human-test-set', t('مجموعة اختبار ثانية يكتبها ويصنّفها شخصان', 'A second test set written and labelled by two people'), t('لم تُكتب بعد.', 'Not written yet.')],
    ['pilot', t('التجربة الجامعية وعدد المشاركين', 'University pilot and number of participants'), t('لم تبدأ. الأرقام في صفحة التحقق أهداف وليست نتائج.', 'Not started. The numbers on the validation page are targets, not results.')],
  ]
  const notMeasured = card('not-measured', NOT_MEASURED[lang],
    `<p>${t('هذه البنود لم تحدث بعد، فلا نعرض لها أي رقم.', 'These have not happened yet, so we show no number for them.')}</p><ul>${pending.map(([id, what, why]) => `<li data-pending="${id}"><strong>${what}</strong>: ${nm}. ${why}</li>`).join('')}</ul>` +
    `<p><a href="/validation.html">${t('خطة التحقق (أهداف)', 'Validation plan (targets)')}</a></p>`)

  const changeList = changes
    ? `<p>${t(`التغييرات منذ ${'<code>' + esc(changesSince) + '</code>'}: ${changes.length}، الأحدث أولًا. العناوين بالإنجليزية كما كُتبت في git.`, `${changes.length} changes since ${'<code>' + esc(changesSince) + '</code>'}, newest first.`)}</p><ol class="k-changes" lang="en" dir="ltr">${changes.map(c => `<li data-commit="${esc(c.sha)}">${commitLink(repository, c.sha)} · ${esc(c.date)} · ${esc(c.subject)}</li>`).join('')}</ol>`
    : `<p>${t('قائمة التغييرات غير متاحة في هذا البناء.', 'The list of changes is not available in this build.')}</p>`
  const changesCard = card('changes', t('التغييرات', 'Changes'), changeList)

  const links = card('links', t('روابط', 'Links'), `<ul>${repository ? `<li><a href="${esc(repository)}">${t('الشيفرة المصدرية', 'Source code')}</a></li>` : ''}<li><a href="/runs-where.html">${t('ما الذي يعمل وأين', 'What runs where')}</a></li><li><a href="/validation.html">${t('خطة التحقق (أهداف وليست نتائج)', 'Validation plan (targets, not results)')}</a></li></ul>`)

  return [
    t('نتائج الاختبارات والتغييرات', 'Test results and changes'),
    t('أرقام من تشغيل حقيقي للاختبارات الآلية لنسخة محددة من كامن. لا شيء هنا هدف؛ ما لم يُقَس يقول ذلك.', 'Numbers from a real run of Kamin’s automated tests on one version. Nothing here is a target; anything not measured says so.'),
    `<p data-build-stamp data-lang="${lang}"></p>` + summary + covered + evaluationCard + notMeasured + changesCard + links,
  ]
}

export function renderTestsPage(data) {
  const ar = renderSection('ar', data), en = renderSection('en', data)
  const attrs = { 'data-title-ar': `${ar[0]} | كامن`, 'data-title-en': `${en[0]} | Kamin`, 'data-description-ar': ar[1], 'data-description-en': en[1], 'data-report-commit': data.commit, 'data-report-dirty': data.dirty ? 'true' : 'false', 'data-unit-files': data.unit?.files ?? '', 'data-unit-tests': data.unit?.tests ?? '', 'data-e2e-tests': data.e2e?.tests ?? '', 'data-e2e-flaky': data.e2e?.flaky ?? '' }
  const sections = [['ar', ar], ['en', en]].map(([lang, [title, lead, body]]) => `<section data-kamin-lang="${lang}"${lang === 'en' ? ' hidden' : ''}><h1>${title}</h1><p class="k-doc-lead">${lead}</p>${body}</section>`).join('')
  return `<!doctype html>\n<!-- Generated by \`npm run test:report\` (scripts/test-report.mjs). Do not edit by hand. -->\n<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ar[0])} | كامن</title><meta name="description" content="${esc(ar[1])}"><script type="module" src="/static-i18n.js"></script><link rel="stylesheet" href="/brand.css"><link rel="stylesheet" href="/site-layout.css"><link rel="stylesheet" href="/document-pages.css"></head><body class="k-document" ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}><main class="k-doc-main">${sections}</main></body></html>\n`
}

// Read the counts a generated page claims (used by --check-committed and the tests).
export function readPageCounts(html) {
  const get = name => { const m = String(html).match(new RegExp(`${name}="([^"]*)"`)); return m ? m[1] : null }
  const num = v => v === null || v === '' ? null : Number(v)
  return { commit: get('data-report-commit'), unitFiles: num(get('data-unit-files')), unitTests: num(get('data-unit-tests')), e2eTests: num(get('data-e2e-tests')) }
}

// ---------- Build stamp: which version was this site built from, compared with where the tests ran ----------
// sameCode: true when git shows no change outside public/tests.html between the measured and the built commit.
export function buildStamp(lang, { measuredCommit, measuredDirty, buildCommit, sameCode }) {
  const t = (ar, en) => lang === 'ar' ? ar : en
  const m = esc(shortSha(String(measuredCommit || '').replace(/-dirty$/, ''))), b = esc(shortSha(buildCommit))
  if (!measuredCommit) return t('لم تُشغَّل الاختبارات لهذه الصفحة بعد.', 'The tests have not been run for this page yet.')
  const built = buildCommit ? t(`بُني هذا الموقع من النسخة ${b}.`, `This site was built from version ${b}.`) : t('لا نعرف النسخة التي بُني منها هذا الموقع.', 'The version this site was built from is unknown.')
  if (measuredDirty) return t(`شُغّلت الاختبارات على تغييرات غير محفوظة فوق النسخة ${m}. `, `The tests ran on uncommitted changes on top of version ${m}. `) + built + t(' قد لا تطابق الأرقام هذا الموقع تمامًا.', ' The numbers may not match this site exactly.')
  if (!buildCommit) return built + t(` شُغّلت الاختبارات على النسخة ${m}.`, ` The tests ran on version ${m}.`)
  if (b === m) return t(`بُني هذا الموقع من النسخة نفسها التي شُغّلت عليها الاختبارات (${m}).`, `This site was built from the same version the tests ran on (${m}).`)
  if (sameCode) return built + t(` الشيفرة مطابقة للنسخة ${m} التي شُغّلت عليها الاختبارات؛ لم يتغير بعدها إلا هذه الصفحة.`, ` Its code is the same as version ${m}, where the tests ran; only this page changed since.`)
  return built + t(` شُغّلت الاختبارات على النسخة ${m}، فالتغييرات بعدها لا تشملها هذه الأرقام.`, ` The tests ran on version ${m}, so changes after it are not covered by these numbers.`)
}

import { useMemo, useState } from 'react'
import { Check, FileCheck2, FolderGit2, Pencil, Plus, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react'
import { copy } from '../i18n.js'
import { editCourseRow } from '../utils/provenance.js'
import { canonicalCourseCode, reviewProfileQuality } from '../utils/profileQuality.js'
import { collegeLabel } from '../catalog/colleges.js'
import { normalizeDigitalInterests, DIGITAL_TOPICS } from '../digitalInterests.js'
import { CourseList, issuesByRow } from './CourseReview.jsx'
import WhatChanged from './WhatChanged.jsx'
import './MyData.css'
import { deleteItem } from '../utils/dataControl.js'
import { preferenceCount } from '../insight.js'

// Task 05 · "My data: review and correct". One place that lists everything the student entered
// after approval and lets them correct it. Course edits go through editCourseRow, so the value
// extracted from the document is kept and provenance follows the value. Saving asks for a short
// confirmation, then the app recomputes capabilities (Task 04) and shows what changed; the last
// change can be undone. Loaded lazily.
const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.ar || value?.en || ''
const FIELD = { code: ['الرمز', 'code'], name: ['الاسم', 'name'], grade: ['الدرجة', 'grade'] }

// Plain-language lines describing the staged edits; also written to the audit log.
export function describeEdits(before, rows, beforeCollege, college, lang) {
  const lines = []
  for (const row of rows) {
    const original = row.key != null ? before[row.key] : null
    const code = canonicalCourseCode(row.code) || row.code
    if (row.deleted && original) { lines.push(tr(lang, `حذف المقرر ${canonicalCourseCode(original.code)}`, `Deleted course ${canonicalCourseCode(original.code)}`)); continue }
    if (row.deleted) continue
    if (!original) { lines.push(tr(lang, `إضافة المقرر ${code} (أُدخل يدويًا)`, `Added course ${code} (typed by hand)`)); continue }
    for (const key of ['code', 'name', 'grade']) {
      const from = key === 'code' ? canonicalCourseCode(original.code) : localized(original[key], lang)
      const to = key === 'code' ? code : localized(row[key], lang)
      if (String(from).trim() !== String(to).trim()) lines.push(tr(lang, `${canonicalCourseCode(original.code)}: تغيير ${FIELD[key][0]} من «${from}» إلى «${to}»`, `${canonicalCourseCode(original.code)}: ${FIELD[key][1]} changed from “${from}” to “${to}”`))
    }
  }
  if ((beforeCollege || null) !== (college || null)) lines.push(tr(lang, `تغيير الكلية إلى ${collegeLabel(college, 'ar') || 'غير محددة'}`, `College changed to ${collegeLabel(college, 'en') || 'not chosen'}`))
  return lines
}

export default function MyData({ lang, state, change, canUndo, onSave, onUndo, onApplyDelete, onEditInsight, onFullReview, onDeleteAll, onConsents }) {
  const t = copy[lang].app
  const [rows, setRows] = useState(() => (state.courses || []).map((row, key) => ({ ...row, key })))
  // Task 55: the college comes from the transcript; it is not chosen here (no dropdown). A wrong one is
  // fixed on the review screen ("Re-review the whole record" → "Not right?") or from the dashboard note.
  const college = state.college || null
  const [form, setForm] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const live = rows.filter(r => !r.deleted)
  const quality = reviewProfileQuality(live.map(({ key, deleted, ...row }) => row))
  const pending = useMemo(() => ({ ar: describeEdits(state.courses || [], rows, state.college, college, 'ar'), en: describeEdits(state.courses || [], rows, state.college, college, 'en') }), [rows, college, state.courses, state.college])
  // Problems by row index (deleted rows are not checked), shown on the row (Task 22).
  const issues = useMemo(() => { const liveIndex = rows.flatMap((r, i) => r.deleted ? [] : [i]); const byLive = issuesByRow(live.map(({ key, deleted, ...row }) => row)); return Object.fromEntries(Object.entries(byLive).map(([k, v]) => [liveIndex[k], v])) }, [rows])
  const blocked = live.length > 0 && !quality.canApprove
  const digital = normalizeDigitalInterests(state.insight?.digitalInterests)
  const preferences = preferenceCount(state.insight?.declaredPreferences) // Task 78: each chosen chip counts
  const update = (index, key, value) => { setConfirming(false); setRows(list => list.map((row, i) => i === index ? editCourseRow(row, key, value) : row)) }
  // Task 06: deleting a saved item asks for confirmation, then goes through dataControl.deleteItem
  // (recompute, named summary). A row added here but not saved yet is simply dropped.
  const [pendingDelete, setPendingDelete] = useState(null)
  const askDelete = (kind, id, name, key = null) => { setConfirming(false); setPendingDelete({ kind, id, name, key }) }
  const removeUnsaved = index => setRows(list => list.filter((_, i) => i !== index))
  const confirmDelete = () => {
    const item = pendingDelete
    setPendingDelete(null)
    let result
    try { result = deleteItem(state, { kind: item.kind, id: item.id }, { lang }) } catch { return }
    if (item.kind === 'course') setRows(list => list.filter(r => r.key !== item.key).map(r => r.key != null && r.key > item.key ? { ...r, key: r.key - 1 } : r))
    onApplyDelete(result)
  }
  const deleteConfirm = item => pendingDelete && pendingDelete.kind === item.kind && pendingDelete.id === item.id && <div className="my-data-confirm" role="alertdialog" aria-labelledby="my-data-delete-title" data-testid="delete-item-confirm">
    <strong id="my-data-delete-title">{tr(lang, `حذف ${pendingDelete.name}؟`, `Delete ${pendingDelete.name}?`)}</strong>
    <p>{tr(lang, 'سيُحذف من هذا الجهاز ويُعاد حساب قدراتك وأحكام الملاءمة. لا يمكن التراجع عن الحذف.', 'It will be deleted from this device and your capabilities and fit judgments will be recomputed. Deletion cannot be undone.')}</p>
    <div><button className="button danger" onClick={confirmDelete}><Trash2 size={16}/>{tr(lang, 'احذف نهائيًا', 'Delete permanently')}</button><button className="button secondary" onClick={() => setPendingDelete(null)}><X size={16}/>{copy[lang].app.cancel}</button></div>
  </div>
  const addRow = () => {
    if (!form?.code?.trim() || !form?.name?.trim() || !form?.grade?.trim()) return
    setRows(list => [...list, { code: canonicalCourseCode(form.code), name: form.name.trim(), grade: form.grade.trim(), source: 'manual' }])
    setForm(null); setConfirming(false)
  }
  const save = () => {
    const courses = live.map(({ key, deleted, ...row }) => ({ ...row, code: canonicalCourseCode(row.code) }))
    onSave({ courses, college, lines: pending })
    setConfirming(false)
  }

  return <div className="my-data" data-testid="my-data">
    <div className="app-title"><small>{tr(lang, 'بياناتي', 'My data')}</small><h2>{copy[lang].screens.myData.title}</h2><p>{copy[lang].screens.myData.intro}</p><button className="text-button" onClick={onFullReview}>{tr(lang, 'أعد مراجعة السجل كاملًا', 'Re-review the whole record')}</button></div>
    {change && <WhatChanged change={change} lang={lang}/>}
    {canUndo && <div className="my-data-undo"><button className="button secondary" onClick={onUndo} data-testid="undo-last-change"><RotateCcw size={16}/>{tr(lang, 'تراجع عن آخر تغيير', 'Undo last change')}</button></div>}

    <section className="panel" aria-labelledby="my-data-courses"><div className="panel-head"><div><small>{tr(lang, 'السجل المعتمد', 'Approved record')}</small><h3 id="my-data-courses">{tr(lang, 'مقرراتك', 'Your courses')}</h3></div><button className="text-button" onClick={() => setForm(form ? null : { code: '', name: '', grade: '' })}><Plus size={17}/>{t.addRow}</button></div>
      <p className="my-data-hint">{tr(lang, 'عدّل الرمز أو الاسم أو الدرجة، أو احذف صفًا. نحتفظ بالقيمة الأصلية من المستند، والتعديل لا يرفع مستوى الدليل.', 'Edit a code, name or grade, or delete a row. The value from your document is kept, and an edit never raises the evidence level.')}</p>
      {form && <div className="manual-row"><input aria-label={tr(lang, 'رمز المقرر الجديد', 'New course code')} placeholder="CPIT-251" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}/><input aria-label={tr(lang, 'اسم المقرر الجديد', 'New course name')} placeholder={t.courseName} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/><input aria-label={tr(lang, 'درجة المقرر الجديد', 'New course grade')} placeholder="A / B+" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}/><button onClick={addRow}>{t.save}</button></div>}
      {/* Task 22: the same course rows as the review screen (cards on phones, full names everywhere). */}
      <CourseList lang={lang} rows={rows} college={college} issues={issues} testId="my-data-courses"
        label={(field, i, row) => { const code = canonicalCourseCode(row.code) || row.code; return field === 'code' ? tr(lang, `رمز المقرر ${code}`, `Course code ${code}`) : field === 'name' ? tr(lang, `اسم المقرر ${code}`, `Course name ${code}`) : tr(lang, `درجة ${code}`, `Grade ${code}`) }}
        deleteLabel={(i, row) => { const code = canonicalCourseCode(row.code) || row.code; return tr(lang, `حذف ${code}`, `Delete ${code}`) }}
        onEdit={update} isDeleted={row => !!row.deleted} rowKey={(row, i) => row.key ?? `new-${i}`}
        onDelete={(i, row) => row.key == null ? removeUnsaved(i) : askDelete('course', canonicalCourseCode(state.courses[row.key]?.code), canonicalCourseCode(state.courses[row.key]?.code), row.key)}/>
      {pendingDelete?.kind === 'course' && deleteConfirm(pendingDelete)}
      {blocked && <p className="field-error" role="alert">{tr(lang, 'أكمل كل صف بدرجة صحيحة ولا تكرر رمز مقرر قبل الحفظ.', 'Complete every row with a valid grade and avoid repeated course codes before saving.')}</p>}
      {pending[lang].length > 0 && !confirming && <div className="my-data-actions"><span>{tr(lang, `${pending[lang].length} تعديل لم يُحفظ بعد`, `${pending[lang].length} unsaved change(s)`)}</span><button className="button primary" disabled={blocked} onClick={() => setConfirming(true)}><Pencil size={16}/>{tr(lang, 'احفظ التعديلات', 'Save changes')}</button></div>}
      {confirming && <div className="my-data-confirm" role="alertdialog" aria-labelledby="my-data-confirm-title" aria-describedby="my-data-confirm-effect">
        <strong id="my-data-confirm-title">{tr(lang, 'تأكيد التعديلات', 'Confirm your changes')}</strong>
        <ul>{pending[lang].map((line, i) => <li key={i}>{line}</li>)}</ul>
        <p id="my-data-confirm-effect">{tr(lang, 'سيُعاد حساب قدراتك وأحكام الملاءمة، وسنعرض لك ما تغيّر. يمكنك التراجع عن آخر تغيير.', 'This will recompute your capabilities and fit judgments, and we will show you what changed. You can undo the last change.')}</p>
        <div><button className="button primary" onClick={save}><Check size={16}/>{tr(lang, 'تأكيد وإعادة الحساب', 'Confirm and recompute')}</button><button className="button secondary" onClick={() => setConfirming(false)}><X size={16}/>{t.cancel}</button></div>
      </div>}
    </section>

    <section className="panel" aria-labelledby="my-data-other"><h3 id="my-data-other">{tr(lang, 'ما أدخلته أيضًا', 'Everything else you entered')}</h3>
      <dl className="my-data-list">
        <div><dt>{tr(lang, 'الكلية', 'College')}</dt><dd data-testid="my-data-college">{collegeLabel(state.college, lang) || state.collegeRaw || tr(lang, 'لم تُختر بعد', 'Not chosen yet')}</dd></div>
        {state.major && <div><dt>{tr(lang, 'التخصص', 'Major')}</dt><dd data-testid="my-data-major">{state.major}</dd></div>}
        <div><dt>{tr(lang, 'الهدف', 'Goal')}</dt><dd>{state.goal ? (t.goals?.[state.goal] || tr(lang, 'هدف مختار', 'Chosen goal')) : tr(lang, 'لم تختر هدفًا', 'No goal chosen')}</dd></div>
        <div><dt>{tr(lang, 'الاهتمامات والتفضيلات', 'Interests and preferences')}</dt><dd>{digital.confirmed.length ? tr(lang, `${digital.confirmed.length} اهتمام مؤكد`, `${digital.confirmed.length} confirmed interest(s)`) : tr(lang, 'لا اهتمامات مؤكدة', 'No confirmed interests')} · {tr(lang, `${preferences} تفضيلات مصرح بها`, `${preferences} declared preference(s)`)}</dd></div>
      </dl>
      {digital.confirmed.length > 0 && <ul className="my-data-items">{digital.confirmed.map(item => { const name = DIGITAL_TOPICS.find(topic => topic.id === item.topicId)?.label[lang] || item.topicId; return <li key={item.topicId}><span>{name}</span><button className="text-button" onClick={() => askDelete('interest', item.topicId, name)} aria-label={tr(lang, `حذف الاهتمام ${name}`, `Delete interest ${name}`)}><Trash2 size={15}/>{tr(lang, 'حذف', 'Delete')}</button>{deleteConfirm({ kind: 'interest', id: item.topicId })}</li> })}</ul>}
      <button className="text-button" onClick={onEditInsight}>{tr(lang, 'عدّل اهتماماتك وهدفك', 'Edit your interests and goal')}</button>
      <h4><FolderGit2 size={16}/> {tr(lang, 'أدلة تطبيقية مصرّح بها', 'Self-declared projects')}</h4>
      {(state.projects || []).length ? <ul className="my-data-items">{state.projects.map(p => <li key={p.id}><span>{p.title}</span><button className="text-button" onClick={() => askDelete('project', p.id, p.title)} aria-label={tr(lang, `حذف ${p.title}`, `Delete ${p.title}`)}><Trash2 size={15}/>{tr(lang, 'حذف', 'Delete')}</button>{deleteConfirm({ kind: 'project', id: p.id })}</li>)}</ul> : <p className="my-data-empty">{tr(lang, 'لا يوجد.', 'None.')}</p>}
      <h4><ShieldCheck size={16}/> {tr(lang, 'اعتمادات مستوردة', 'Imported credentials')}</h4>
      {(state.credentials || []).length ? <ul className="my-data-items">{state.credentials.map(c => <li key={c.id}><span>{c.achievements?.[0]?.name || tr(lang, 'اعتماد', 'Credential')} · {c.issuerName || tr(lang, 'جهة غير معروفة', 'Unknown issuer')} · {c.outcome === 'verified' ? tr(lang, 'موثّق', 'verified') : tr(lang, 'غير موثّق', 'not verified')}</span><button className="text-button" onClick={() => askDelete('credential', c.id, c.achievements?.[0]?.name || tr(lang, 'الاعتماد', 'the credential'))}><Trash2 size={15}/>{tr(lang, 'حذف', 'Delete')}</button>{deleteConfirm({ kind: 'credential', id: c.id })}</li>)}</ul> : <p className="my-data-empty">{tr(lang, 'لا يوجد.', 'None.')}</p>}
      {/* Task 15: delete everything and consents are one click from here (the confirmation still follows). */}
      <p className="my-data-hint my-data-exit"><FileCheck2 size={15}/><button type="button" className="text-button" onClick={onConsents}>{tr(lang, 'الموافقات والنسخ الاحتياطي', 'Consents and backup')}</button><button type="button" className="text-button danger-link" data-testid="delete-all-shortcut" onClick={onDeleteAll}>{tr(lang, 'احذف كل بياناتي من هذا الجهاز', 'Delete all my data from this device')}</button></p>
    </section>
  </div>
}

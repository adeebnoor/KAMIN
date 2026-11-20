import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Info, Plus, SearchCheck, Trash2 } from 'lucide-react'
import { copy, fill } from '../i18n.js'
import { pageHref } from '../../public/site-content.js'
import { editCourseRow, provenanceLabel } from '../utils/provenance.js'
import { courseStatus, issuesByRow, attentionOrder, isMappedCourse, termLabel } from '../utils/courseStatus.js'
import { canonicalCourseCode, reviewProfileQuality } from '../utils/profileQuality.js'
import { collegeHasMap } from '../catalog/colleges.js'
import { ssceForCourse } from '../reference/ssce.js'
import { courseEvidencePrinciple } from '../content/trustCopy.js'
import TechDetails from './TechDetails.jsx'
import DocumentSignals from './DocumentSignals.jsx'
import { CollegeLine } from './CollegeFix.jsx'
import WhatChanged from './WhatChanged.jsx'

// Task 22 · a review screen you can read and check, phone first. Moved out of src/App.jsx (with the
// validation summary, now the summary card) and loaded only when the review screen opens. The course
// list (CourseList) is shared with "My data", so both screens show courses the same way: a table with
// four columns on wide screens, one card per course below 760px, full codes and names everywhere.

const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.ar || value?.en || ''
export { courseStatus, issuesByRow, attentionOrder, isMappedCourse }

// Task 52: under the name, the term the row sits under; for a retaken course, "Retaken: latest attempt
// shown" and the earlier attempts under "Details".
function CourseMeta({ row, lang }) {
  const R = copy[lang].screens.review
  const term = termLabel(row, lang)
  const earlier = (row.attempts || []).filter(a => a.retaken)
  if (!term && !earlier.length) return null
  return <div className="course-meta">
    {term && <p data-testid="course-term">{term}</p>}
    {earlier.length > 0 && <>
      <p data-testid="course-retaken">{R.retaken}</p>
      <details className="course-attempts"><summary>{R.attemptsDetails}</summary>
        <ul>{earlier.map((a, k) => <li key={k}>{fill(R.attemptLine, { term: termLabel(a, lang) || '—', grade: a.letter })}</li>)}</ul>
      </details>
    </>}
  </div>
}

// A course name is never cut: a one-line text area that grows with its text and wraps. Browsers without
// `field-sizing: content` get the height set from the content.
const AUTO_SIZE = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content')
function NameField({ value, onChange, ...props }) {
  const ref = useRef(null)
  useLayoutEffect(() => { const el = ref.current; if (!el || AUTO_SIZE) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }, [value])
  return <textarea ref={ref} rows={1} dir="auto" className="course-name" value={value} {...props}
    onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}
    onChange={event => onChange(event.target.value.replace(/\s*\n\s*/g, ' '))}/>
}

// The course rows of the review screen and of "My data". `label(field, index, row)` names each field
// (the review screen numbers rows by transcript line; My data names them by course code), `order` is
// the display order (row indices).
export function CourseList({ lang, rows, order = [...rows.keys()], college = null, issues = {}, label, deleteLabel, onEdit, onDelete, isDeleted = () => false, rowKey = (row, i) => i, testId }) {
  const R = copy[lang].screens.review, t = copy[lang].app
  return <div className="course-list-wrap">
    <table className="course-table" data-testid={testId}>
      <thead><tr><th scope="col">{R.courseHead}</th><th scope="col">{t.grade}</th><th scope="col">{R.statusHead}</th><th scope="col"><span className="sr-only">{lang === 'ar' ? 'حذف' : 'Delete'}</span></th></tr></thead>
      <tbody>{order.map(i => {
        const row = rows[i]
        if (!row) return null
        const status = courseStatus(row, { lang, college, issue: issues[i] })
        const deleted = isDeleted(row)
        const code = canonicalCourseCode(row.code) || row.code
        const extracted = status.provenance.edits.length ? (lang === 'ar' ? `القيم المستخرجة: ${status.provenance.edits.map(f => `${f}=${row.edits[f]}`).join('، ')}` : `Extracted values: ${status.provenance.edits.map(f => `${f}=${row.edits[f]}`).join(', ')}`) : undefined
        return <tr key={rowKey(row, i)} data-course={code} data-attention={status.attention ? 'true' : undefined} className={`course-row tone-${status.tone}${deleted ? ' is-deleted' : ''}`}>
          <td className="course-cell">
            <input className="course-code" dir="auto" value={row.code} size={Math.max(8, String(row.code || '').length + 1)} disabled={deleted} aria-label={label('code', i, row)} onChange={e => onEdit(i, 'code', e.target.value)}/>
            <NameField value={localized(row.name, lang)} disabled={deleted} aria-label={label('name', i, row)} onChange={value => onEdit(i, 'name', value)}/>
            <CourseMeta row={row} lang={lang}/>
          </td>
          <td className="grade-cell"><input className="course-grade" dir="auto" value={row.grade} size={Math.max(3, String(row.grade || '').length + 1)} disabled={deleted} aria-label={label('grade', i, row)} onChange={e => onEdit(i, 'grade', e.target.value)}/></td>
          <td className="status-cell">
            <span className={`course-status ${status.tone}`}><span className={`mapping-badge ${status.mapping.kind}`}>{status.mapping.text}</span><span className={`provenance-badge ${status.provenance.level}`} title={extracted}>{provenanceLabel(status.provenance.level, lang)}{status.provenance.gradeRaised && <> · {R.gradeRaised}</>}</span></span>
            {status.reasons.map((reason, k) => <p key={k} className={`course-reason ${reason.tone}`} data-testid="course-reason">{reason.text}</p>)}
          </td>
          <td className="delete-cell"><button type="button" className="icon-danger course-delete" onClick={() => onDelete(i, row)} aria-label={deleteLabel(i, row)}><Trash2 size={16}/></button></td>
        </tr>
      })}</tbody>
    </table>
  </div>
}

// What was read, in one card: the college question, where the courses came from, how many were found and
// linked, the synthetic-data notice, the suggested programme context, unreadable lines, document signals,
// and the technical details (OCR, extraction coverage, national programme context of each course).
function SummaryCard({ lang, rows, validation, college, setCollege, student, linked, change }) {
  const R = copy[lang].screens.review
  const rejected = validation?.rejected || []
  const ssceText = validation?.ssceCandidates?.[0] || null
  const ssceLevel = validation?.ssceLevelCandidates?.[0] || null
  const read = !!validation && validation.mode !== 'manual'
  const national = rows.map(row => [canonicalCourseCode(row.code) || row.code, ssceForCourse(row)])
  const technical = validation?.usedOcr || Number.isFinite(validation?.extractionCoverage) || national.length > 0
  return <div className="panel review-summary" data-testid="review-summary">
    <WhatChanged change={change} lang={lang}/>
    {/* Task 55: the college and major as the transcript prints them; the one-tap fix only when needed. */}
    <CollegeLine lang={lang} college={college} collegeRaw={student?.collegeRaw} major={student?.major} manual={validation?.mode === 'manual'} onChoose={setCollege}/>
    <div className="review-facts-row">
    <p className="review-facts">
      {read && <><span>{fill(R.readFrom, { source: validation.usedOcr ? R.imageRead : R.digitalText })}</span><span aria-hidden="true"> · </span></>}
      {!change && <><span>{fill(R.foundCount, { n: rows.length })}</span><span aria-hidden="true"> · </span></>}
      <span className="mapping-coverage"><strong>{linked}/{rows.length || 0}</strong> <span>{R.coverage}</span></span><span aria-hidden="true"> · </span>
      <a href={pageHref('mapping.html', lang)} target="_blank" rel="noreferrer">{R.mappingMethod}</a>
    </p>
    {technical && <TechDetails lang={lang}>
      {validation?.usedOcr && <p>{R.technical.ocr}</p>}
      {Number.isFinite(validation?.extractionCoverage) && <p>{fill(R.extractionCoverage, { n: Math.round(validation.extractionCoverage * 100) })}</p>}
      {validation?.checkGpa && <p data-testid="transcript-gpa">{fill(R.transcriptGpa, { gpa: validation.checkGpa })}</p>}
      {national.length > 0 && <><strong>{R.nationalHead}</strong><ul className="review-national">{national.map(([code, context], i) => <li key={i}><b>{code}</b> {context ? <span className="ssce-inline">{context.code} · {context.labels[lang]}</span> : <span className="ssce-none">{R.noNational}</span>}</li>)}</ul></>}
    </TechDetails>}
    </div>
    {validation?.mode === 'demo' && <p className="pilot-sample-note" role="status">{lang === 'ar' ? 'هذه بيانات وهمية. لن تستبدل سجلك الحالي إلا عند اعتمادها. يمكنك الإغلاق للاحتفاظ بملفك.' : 'These are synthetic data. They replace your current record only if you approve them. Close to keep your profile.'}</p>}
    {(ssceText || ssceLevel) && <div className="sasced-candidate">
      <div><strong>{R.contextTitle}</strong>
        <span>{[
          ssceLevel ? (lang === 'ar' ? `المستوى ${ssceLevel.code}: ${ssceLevel.labels.ar}` : `Level ${ssceLevel.code}: ${ssceLevel.labels.en}`) : null,
          ssceText ? `${ssceText.code} · ${ssceText.labels[lang]}` : null,
        ].filter(Boolean).join(' · ')}</span>
      </div>
      <small>{R.contextNote}</small><TechDetails lang={lang}>{R.technical.context}</TechDetails>
    </div>}
    {rejected.length > 0 && <details className="review-rejected"><summary>{lang === 'ar' ? 'عرض الأسطر التي تعذر تحليلها' : 'Show rows that could not be parsed'}</summary>{rejected.slice(0, 12).map((r, i) => <code key={i}>{r.line}</code>)}</details>}
    <DocumentSignals lang={lang} document={validation?.document}/>
  </div>
}

// Task 62 · the review's row list, exported so the new interface's "Fix something" sheet
// (src/ui2/components/ResultCard.jsx) shows the very same rows: the Task 22 row/card list with the review's
// own field names ("Course code 1", "Grade 3"), edits that keep their provenance (editCourseRow), deletion,
// and the "Add course manually" form. The review screen below renders the same parts, so the old interface
// does not change.
export function ReviewCourseList({ lang, rows, setRows, order, college = null, issues = issuesByRow(rows), testId = 'review-courses' }) {
  const t = copy[lang].app
  const update = (i, key, value) => setRows(rows.map((r, idx) => idx === i ? editCourseRow(r, key, value) : r))
  return <CourseList lang={lang} rows={rows} order={order} college={college} issues={issues}
    label={(field, i) => `${t[field === 'code' ? 'courseCode' : field === 'name' ? 'courseName' : 'grade']} ${i + 1}`}
    deleteLabel={(i, row) => lang === 'ar' ? `حذف ${row.code}` : `Delete ${row.code}`}
    onEdit={update} onDelete={i => setRows(rows.filter((_, idx) => idx !== i))} testId={testId}/>
}

export function AddCourseRow({ lang, rows, setRows }) {
  const t = copy[lang].app
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', grade: '' })
  const add = () => {
    if (!form.code.trim() || !form.name.trim() || !form.grade.trim()) return
    setRows([...rows, { ...form, code: canonicalCourseCode(form.code), source: 'manual' }]); setForm({ code: '', name: '', grade: '' }); setFormOpen(false)
  }
  return <div className="review-add">
    <button type="button" className="text-button" onClick={() => setFormOpen(v => !v)}><Plus size={17}/>{t.addRow}</button>
    {formOpen && <div className="manual-row"><input aria-label={t.courseCode} placeholder="CPIT-251" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}/><input aria-label={t.courseName} placeholder={t.courseName} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/><input aria-label={t.grade} placeholder="A / B+" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}/><button onClick={add}>{t.save}</button></div>}
  </div>
}

// Whether Approve is disabled, and why, in the review's words: no row yet, rows to fix (a blocking problem
// such as an unknown grade or a missing field), or the consent box. Shared by both interfaces.
export function approvalBlock({ rows, consent, lang }) {
  const R = copy[lang].screens.review
  const quality = reviewProfileQuality(rows)
  const blocked = !quality.canApprove || !consent
  const reason = !rows.length ? R.addOne
    : quality.issues.length ? (new Set(quality.issues.map(i => i.index)).size === 1 ? R.fixFirstOne : fill(R.fixFirst, { n: new Set(quality.issues.map(i => i.index)).size }))
    : !consent ? R.tickConsent : ''
  return { blocked, reason }
}

export default function CourseReview({ lang, rows, setRows, onApprove, consent, setConsent, college, setCollege, student = null, validation = null, change = null }) {
  const t = copy[lang].app
  const R = copy[lang].screens.review
  const [onlyAttention, setOnlyAttention] = useState(false)
  const issues = issuesByRow(rows)
  const statuses = rows.map((row, i) => courseStatus(row, { lang, college, issue: issues[i] }))
  const needLook = statuses.filter(s => s.attention).length
  // The order is set when the list opens or a row is added or removed, not while typing: a row being
  // corrected stays where it is.
  const order = useMemo(() => attentionOrder(rows, { lang, college }), [rows.length, college]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = onlyAttention ? order.filter(i => statuses[i]?.attention) : order
  const linked = rows.filter(row => !(college && !collegeHasMap(college)) && isMappedCourse(row.code)).length
  const { blocked, reason: blockedReason } = approvalBlock({ rows, consent, lang })
  return <div className="course-review" data-testid="course-review">
    <SummaryCard lang={lang} rows={rows} validation={validation} college={college} setCollege={setCollege} student={student} linked={linked} change={change}/>
    <div className="review-attention-row">
      <p className="review-attention" data-testid="review-attention">{fill(R.extractedCount, { n: rows.length })}<span aria-hidden="true"> · </span>{needLook === 0 ? R.allFine : needLook === 1 ? R.needsLookOne : fill(R.needsLook, { n: needLook })}</p>
      <div className="review-check"><p className="review-check-line">{R.checkLine}</p><details className="review-why"><summary>{R.why}</summary><p>{R.qualityText}</p><p>{R.consistencyNote}</p></details></div>
      {rows.length > 8 && <label className="review-filter"><input type="checkbox" checked={onlyAttention} onChange={e => setOnlyAttention(e.target.checked)}/><span>{R.onlyAttention}</span></label>}
    </div>
    {rows.length > 0 && <ReviewCourseList lang={lang} rows={rows} setRows={setRows} order={shown} college={college} issues={issues}/>}
    <p className="evidence-principle" data-testid="course-evidence-principle"><Info size={16} aria-hidden="true"/><span>{courseEvidencePrinciple(lang)}</span></p>
    <AddCourseRow lang={lang} rows={rows} setRows={setRows}/>
    {statuses.some(s => s.mapping.kind === 'unmapped') && <div className="mapping-note"><SearchCheck size={17}/><span>{R.unmappedNote}</span></div>}
    <div className="approval approval-consent review-approve" data-testid="review-approve">
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>{R.consent}</span></label>
      <div className="review-approve-action">
        {blocked && blockedReason && <p className="review-approve-reason" data-testid="approve-reason">{blockedReason}</p>}
        <button className="button primary" disabled={blocked} onClick={onApprove}><Check size={17}/>{t.approve}</button>
      </div>
    </div>
  </div>
}

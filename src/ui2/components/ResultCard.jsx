// Task 62 · step 1's result card: what was read, in one line, and everything needed to approve it.
// "We read N courses · <College> · <Major>" (Tasks 53/55: the college comes from the transcript; the major as it is
// printed), the "we couldn't recognise your college" note and its one-tap fix only when needed, "N need a look"
// when rows are flagged, and "Fix something": a sheet with the review's own rows (src/components/CourseReview.jsx,
// Task 22: attention first, the term, retakes and "Not in the course map" from Task 52, edits, deletion, "Add
// course manually"). The "clue, not a guarantee" sentence is on the card, word for word. Below the card: the
// approval consent, word for word (src/i18n.js), and Approve, the one main action, which says why it is disabled.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Info, SearchCheck } from 'lucide-react'
import { copy, fill } from '../../i18n.js'
import { collegeHasMap, collegeLabel } from '../../catalog/colleges.js'
import { collegeCopy } from '../../content/collegeCopy.js'
import { courseEvidencePrinciple } from '../../content/trustCopy.js'
import CollegeFix from '../../components/CollegeFix.jsx'
import { AddCourseRow, ReviewCourseList, approvalBlock, attentionOrder, courseStatus, issuesByRow } from '../../components/CourseReview.jsx'
import Sheet from '../Sheet.jsx'
import { fillIn, nextCopy } from '../copy.js'

const statusesOf = (rows, lang, college) => { const issues = issuesByRow(rows); return { issues, statuses: rows.map((row, i) => courseStatus(row, { lang, college, issue: issues[i] })) } }

// The sheet's content. The order is set when the sheet opens or a row is added or removed (Task 22's rule), so a
// row being corrected stays where it is.
function FixRows({ lang, draft, onDone }) {
  const { rows, setRows, college } = draft
  const R = copy[lang].screens.review
  const { issues, statuses } = statusesOf(rows, lang, college)
  const order = useMemo(() => attentionOrder(rows, { lang, college }), [rows.length, college]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="ui2-fix" data-testid="ui2-fix">
    <p className="ui2-fix-check">{R.checkLine}</p>
    {rows.length > 0 && <ReviewCourseList lang={lang} rows={rows} setRows={setRows} order={order} college={college} issues={issues}/>}
    <AddCourseRow lang={lang} rows={rows} setRows={setRows}/>
    {statuses.some(s => s.mapping.kind === 'unmapped') && <p className="ui2-fix-note"><SearchCheck size={16} aria-hidden="true"/><span>{R.unmappedNote}</span></p>}
    <button type="button" className="ui2-btn ui2-btn-primary" onClick={onDone}>{nextCopy(lang).result.done}</button>
  </div>
}

// The college, only when something needs saying: a list of courses typed in by hand asks which college once; a
// transcript whose college was not recognised (or printed none) gets the short note and its one-tap fix; a known
// college without an approved course map says so. Never blocks approval.
function CollegeNote({ lang, college, collegeRaw, manual, onChoose }) {
  const C = collegeCopy(lang)
  const [open, setOpen] = useState(false)
  const choose = id => { setOpen(false); onChoose(id) }
  if (manual && !college) return <div className="ui2-college" data-testid="college-question">
    <p><strong>{C.which}</strong></p><CollegeFix lang={lang} college={college} onChoose={choose}/>
  </div>
  // The printed text is isolated (<bdi>), so an English college name keeps its order inside an Arabic sentence.
  const [before, after = ''] = C.unrecognised.split('{raw}')
  if (!college) return <div className="ui2-college" role="note" data-testid="college-note">
    <p><span>{collegeRaw ? <>{before}<bdi>{collegeRaw}</bdi>{after}</> : C.notFound}</span>
      {!open && <button type="button" className="ui2-text-btn" data-testid="college-fix-open" onClick={() => setOpen(true)}>{C.fix}</button>}</p>
    {open && <CollegeFix lang={lang} college={college} onChoose={choose}/>}
  </div>
  if (!collegeHasMap(college)) return <p className="ui2-college" data-testid="college-no-map">{C.noMap}</p>
  return null
}

export default function ResultCard({ lang, draft, focusOnMount = false, onApprove, onAnother }) {
  const { rows, college, setCollege, student, consent, setConsent, validation } = draft
  const R = copy[lang].screens.review
  const w = nextCopy(lang).result
  const manual = validation?.mode === 'manual'
  const { statuses } = statusesOf(rows, lang, college)
  const needLook = statuses.filter(s => s.attention).length
  const { blocked, reason } = approvalBlock({ rows, consent, lang })
  const [fixOpen, setFixOpen] = useState(false)
  const title = useRef(null)
  // Right after a reading the card's line takes focus: the upload area that had it is gone.
  useEffect(() => { if (focusOnMount) title.current?.focus() }, [focusOnMount])
  const [before, count, after] = w.read(rows.length)
  return <>
    <section className="ui2-card ui2-result" aria-labelledby="ui2-result-line" data-testid="ui2-result">
      <h2 id="ui2-result-line" className="ui2-result-line" tabIndex={-1} ref={title} data-testid="ui2-result-line">
        {manual ? fillIn(w.added, { n: rows.length }) : <>{before}<strong>{count}</strong>{after}</>}
        {college && <> · {collegeLabel(college, lang)}</>}
        {student?.major && <> · <bdi>{student.major}</bdi></>}
      </h2>
      <CollegeNote lang={lang} college={college} collegeRaw={student?.collegeRaw} manual={manual} onChoose={setCollege}/>
      {validation?.mode === 'demo' && <p className="ui2-result-note" role="note" data-testid="ui2-synthetic">{w.synthetic}</p>}
      {/* Task 70: lines the reader could not turn into a course are said, as the old review screen said them
          (screens.start.found, word for word); otherwise they would vanish without a word. */}
      {validation?.rejected?.length > 0 && <p className="ui2-result-look" data-testid="review-found">{fill(copy[lang].screens.start.found, { n: validation.recognized ?? rows.length, m: validation.rejected.length })}</p>}
      <div className="ui2-result-fix">
        {needLook > 0 && <p className="ui2-result-look" data-testid="review-attention">{needLook === 1 ? R.needsLookOne : fill(R.needsLook, { n: needLook })}</p>}
        <button type="button" className="ui2-btn" aria-haspopup="dialog" data-testid="ui2-fix-open" onClick={() => setFixOpen(true)}>{rows.length || !manual ? w.fix : w.addCourses}</button>
      </div>
      <p className="evidence-principle" data-testid="course-evidence-principle"><Info size={16} aria-hidden="true"/><span>{courseEvidencePrinciple(lang)}</span></p>
    </section>
    <Sheet open={fixOpen} onClose={() => setFixOpen(false)} title={w.fixTitle} lang={lang}>
      <FixRows lang={lang} draft={draft} onDone={() => setFixOpen(false)}/>
    </Sheet>
    <div className="ui2-approve" data-testid="review-approve">
      <label className="ui2-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/><span>{R.consent}</span></label>
      <div className="ui2-approve-action">
        {blocked && reason && <p className="ui2-approve-reason" data-testid="approve-reason">{reason}</p>}
        <button type="button" className="ui2-btn ui2-btn-primary" disabled={blocked} onClick={onApprove}><Check size={18} aria-hidden="true"/>{copy[lang].app.approve}</button>
      </div>
    </div>
    <button type="button" className="ui2-text-btn ui2-another" onClick={onAnother}>{w.another}</button>
  </>
}

import { useState } from 'react'
import { COLLEGES, collegeHasMap, collegeLabel } from '../catalog/colleges.js'
import { collegeCopy } from '../content/collegeCopy.js'
import { fill } from '../i18n.js'

// Task 55: the college comes from the transcript. There is no college dropdown. This file holds the
// only way to choose one: a short list of the known colleges as buttons (one tap chooses), shown only
// when the transcript's college was not recognised, when there is no transcript (manual entry), or when
// the student taps "Not right?". Loaded lazily (the review screen and the dashboard note).
export default function CollegeFix({ lang, college, onChoose, testId = 'college-fix' }) {
  const C = collegeCopy(lang)
  return <div className="college-fix" role="group" aria-label={C.listLabel} data-testid={testId}>
    {COLLEGES.map(c => <button key={c.id} type="button" className="college-fix-option" aria-pressed={college === c.id} onClick={() => onChoose(c.id)}>{c.labels[lang === 'ar' ? 'ar' : 'en']}</button>)}
  </div>
}

// What the transcript says, in one line: "College: <label> · Major: <as printed>", with "Not right?".
// Not recognised: a short note with the printed text and one "Fix" button. Never blocks approval.
export function CollegeLine({ lang, college, collegeRaw = null, major = null, manual = false, onChoose }) {
  const C = collegeCopy(lang)
  const [open, setOpen] = useState(false)
  const choose = id => { setOpen(false); onChoose(id) }
  const fix = <CollegeFix lang={lang} college={college} onChoose={choose}/>
  // Courses typed in by hand: there is no transcript to read the college from, so ask once.
  if (manual && !college) return <div className="college-line college-question" data-testid="college-question">
    <p><strong>{C.which}</strong></p>{fix}
  </div>
  if (!college) return <div className="college-line college-unknown" data-testid="college-note" role="note">
    <p><span>{collegeRaw ? fill(C.unrecognised, { raw: collegeRaw }) : C.notFound}</span>{!open && <button type="button" className="text-button" data-testid="college-fix-open" onClick={() => setOpen(true)}>{C.fix}</button>}</p>
    {open && fix}
  </div>
  return <div className="college-line" data-testid="college-current">
    <p>
      <span>{C.college}: <strong>{collegeLabel(college, lang)}</strong></span>
      {major && <><span aria-hidden="true"> · </span><span>{C.major}: <strong>{major}</strong></span></>}
      {!open && <button type="button" className="text-button" data-testid="college-not-right" onClick={() => setOpen(true)}>{C.notRight}</button>}
    </p>
    {open && fix}
    {!collegeHasMap(college) && <small className="college-no-map" data-testid="college-no-map">{C.noMap}</small>}
  </div>
}

// The dashboard, when the saved college has no approved course map (or none was recognised): the courses
// are saved; say why there is no capability, and offer the same one-tap fix. A choice recomputes.
export function DashboardCollegeNote({ lang, college, collegeRaw = null, onChoose }) {
  const C = collegeCopy(lang)
  const [open, setOpen] = useState(false)
  const head = college ? `${C.college}: ${collegeLabel(college, lang)}. ${C.noMap}` : collegeRaw ? fill(C.unrecognised, { raw: collegeRaw }) : C.notFound
  return <div className="college-prompt" data-testid="college-prompt" role="note">
    <p>{head}</p>
    <p>{C.saved}</p>
    {open
      ? <CollegeFix lang={lang} college={college} onChoose={id => { setOpen(false); onChoose(id) }} testId="college-fix-dashboard"/>
      : <button type="button" className="text-button" data-testid="college-fix-open" onClick={() => setOpen(true)}>{college ? C.notRight : C.fix}</button>}
  </div>
}

import { useState } from 'react'
import { Check, ChevronDown, Columns3, Plus } from 'lucide-react'
import { copy, fill } from '../i18n.js'
import { COURSE_GROUPS, isIllustrative, courseCloses, groupCourses } from '../utils/courseCards.js'
import RecommendationReview from './RecommendationReview.jsx'
import LearningPath from './LearningPath.jsx'
import { GoalPicker } from './GoalChips.jsx'

// Task 24 · "My next step → Courses" with clear cards. Each card says in one glance whether it suits the
// student now, which gap it closes, how long it takes and what it costs; the rest is behind "Details".
// The "no uncalibrated percentage" rule is said once, under the title, instead of on every card.
// Moved out of src/App.jsx (FitCard and the courses view) and loaded only when the tab opens.

export { COURSE_GROUPS, isIllustrative, courseCloses }

function CourseCard({ item, lang, skills, compared, full, onToggleCompare, state, onSaveReview }) {
  const t = copy[lang].app, C = copy[lang].screens.courses
  const [open, setOpen] = useState(false)
  const closes = courseCloses(item, skills, lang)
  const illustrative = isIllustrative(item)
  const detailsId = `course-details-${item.id}`
  return <article className={`fit-card course-card status-${item.status}`} data-course-id={item.id}>
    <div className="fit-head"><div><small>{illustrative ? C.noProvider : item.provider}</small><h3>{item.title[lang]}</h3></div><span className={`status ${item.status}`}>{t.fit[item.status]}</span></div>
    <p className="course-closes" data-testid="course-closes">{closes.length ? fill(C.closes, { gap: closes.join(lang === 'ar' ? '، ' : ', ') }) : item.gapType}</p>
    <p className="fit-meta course-meta"><span>{item.duration[lang]}</span><span>{item.cost[lang]}</span>{illustrative && <span className="course-tag">{C.illustrative}</span>}</p>
    <p className="course-why" data-testid="course-why">{item.reasons[0] || item.gapType}</p>
    <div className="course-actions">
      <button type="button" className={compared ? 'compare-button selected' : 'compare-button'} aria-pressed={compared} disabled={!compared && full} onClick={() => onToggleCompare(item.id)}>{compared ? <Check size={16}/> : <Plus size={16}/>} {compared ? C.inCompare : full ? C.compareFull : C.addCompare}</button>
      <button type="button" className="text-button course-details-toggle" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen(v => !v)}>{C.details}<ChevronDown size={16} aria-hidden="true"/></button>
    </div>
    <div className="course-details" id={detailsId} hidden={!open}>
      {item.reasons.length > 1 && <div className="why"><h4>{t.why}</h4>{item.reasons.slice(1).map((r, i) => <p key={i}><Check size={15}/>{r}</p>)}</div>}
      <div className="gap"><small>{item.gapType}</small><p><strong>{t.becomes}</strong> {item.becomes}</p></div>
      <RecommendationReview item={item} kind="course" lang={lang} state={state} onSave={onSaveReview}/>
    </div>
  </article>
}

export default function CourseCards({ lang, state, recs, skills, compareIds = [], onToggleCompare, onOpenCompare, onChooseGoal, onSaveReview }) {
  const t = copy[lang].app, C = copy[lang].screens.courses, S = copy[lang].screens.matches
  const [showLater, setShowLater] = useState(false)
  const groups = groupCourses(recs)
  const full = compareIds.length >= 3
  const card = item => <CourseCard key={item.id} item={item} lang={lang} skills={skills} compared={compareIds.includes(item.id)} full={full} onToggleCompare={onToggleCompare} state={state} onSaveReview={onSaveReview}/>
  return <div className="course-cards">
    <div className="app-title"><h2>{C.title}</h2><p>{C.intro}</p>
      <div className="course-rule" data-testid="course-rule"><p>{C.rule}</p><details className="course-rule-why"><summary>{C.ruleWhy}</summary><p>{C.ruleDetail}</p></details></div>
    </div>
    <GoalPicker lang={lang} goal={state.goal} onChoose={onChooseGoal} testId="course-goal" prompt={C.goalPrompt}/>
    <LearningPath lang={lang} skills={skills} goal={state.goal} takenCourses={state.courses.map(c => c.code)}/>
    {['yes', 'conditional'].map(g => groups[g].length > 0 && <section key={g} className="course-group" data-group={g}><div className="fit-grid">{groups[g].map(card)}</div></section>)}
    {groups.no.length > 0 && <section className="course-group course-group-later" data-group="no">
      <button type="button" className="text-button course-later-toggle" aria-expanded={showLater} aria-controls="courses-later" onClick={() => setShowLater(v => !v)}>{showLater ? C.hideLater : fill(C.showLater, { n: groups.no.length })}<ChevronDown size={16} aria-hidden="true"/></button>
      <div className="fit-grid" id="courses-later" hidden={!showLater}>{groups.no.map(card)}</div>
    </section>}
    {compareIds.length > 0 && onOpenCompare && <div className="match-compare-bar"><button type="button" className="button primary" data-testid="open-course-compare" onClick={onOpenCompare}><Columns3 size={16}/>{fill(S.openCompare, { n: compareIds.length })}</button></div>}
  </div>
}

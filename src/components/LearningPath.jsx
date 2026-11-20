// Task 19 · "Suggested learning path" (planned feature, CPIT-498 skeleton). Gap first, then only the
// items that close that gap, each with its reason. The list is local (src/catalog/learning-opportunities.json);
// nothing is fetched. Items not yet approved by two department reviewers carry an "illustrative example" label;
// retired items are never suggested (Task 36, src/path/review.js).
import { useEffect, useMemo, useState } from 'react'
// Task 24: on the Courses tab the path starts as a one-line summary ("Suggested learning path · Planned
// feature · 1 suggested step for Business Analyst · Show"), so the course cards are on the first screen.
// Its content and the "planned" label are unchanged when it is opened.
import { PATH_FIELDS, computeGap } from '../path/gap.js'
import { suggestPath, catalogItem, uncoveredGaps, LEARNING_CATALOG } from '../path/suggest.js'
import { pathReviewStatus } from '../path/review.js'
import { catalogCourses } from '../catalog/fcit.js'
import { levelLabel } from '../evidence/levels.js'
import { LEARNING_PATH_COPY } from '../content/learningPathCopy.js'
import '../path.css'

// Task 65: the words live in src/content/learningPathCopy.js (unchanged), shared with the new interface's step 4.
const T = LEARNING_PATH_COPY

// Task 36: "Planned feature" stays until every capability a university course links to has a reviewed item.
const COURSE_CAPABILITIES = [...new Set(catalogCourses.flatMap(course => course.capabilities))]
const REVIEW = pathReviewStatus(LEARNING_CATALOG.items, COURSE_CAPABILITIES)

// The field for the student's goal. Task 36: with no goal, open on the first field the list has a step for
// (retiring the invented items left some fields with nothing to suggest), else the first field.
const hasSteps = (fieldId, skills, takenCourses) => suggestPath(computeGap(skills, fieldId), undefined, { skills, takenCourses }).length > 0
const fieldForGoal = (goal, skills = [], takenCourses = []) => (PATH_FIELDS.find(field => goal && field.goals?.includes(goal))
  || PATH_FIELDS.find(field => hasSteps(field.id, skills, takenCourses)) || PATH_FIELDS[0]).id

export default function LearningPath({ lang, skills, goal, takenCourses = [] }) {
  const t = T[lang]
  const [fieldId, setFieldId] = useState(() => fieldForGoal(goal, skills, takenCourses))
  useEffect(() => { setFieldId(fieldForGoal(goal, skills, takenCourses)) }, [goal]) // only a new goal moves the field, as before
  const gap = useMemo(() => computeGap(skills, fieldId), [skills, fieldId])
  const suggestions = useMemo(() => suggestPath(gap, undefined, { skills, takenCourses }), [gap, skills, takenCourses])
  const uncovered = uncoveredGaps(gap, suggestions)
  const label = (ids) => ids.map(id => gap.requirements.find(r => r.capability === id)?.labels[lang] || id).join(lang === 'ar' ? '، ' : ', ')
  const [open, setOpen] = useState(false)
  const fieldTitle = PATH_FIELDS.find(field => field.id === fieldId)?.title[lang] || ''
  const summary = suggestions.length ? `${t.stepsFor(suggestions.length)} ${fieldTitle}` : !gap.hasGap ? `${t.noGapShort} ${fieldTitle}` : `${t.nothingShort} ${fieldTitle}`
  return <section className="panel learning-path" data-testid="learning-path" aria-labelledby="learning-path-title">
    <details className="learning-path-details" data-testid="learning-path-details" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="learning-path-head">
      {!REVIEW.complete && <span className="path-badge" data-testid="path-planned">{t.planned}</span>}
      <h3 id="learning-path-title">{t.title}</h3>
      {summary && <span className="path-summary" data-testid="path-summary">{summary}</span>}
      <span className="path-toggle" aria-hidden="true">{open ? t.hide : t.show}</span>
    </summary>
    <p>{REVIEW.complete ? t.introReviewed : t.intro}</p>
    <label className="path-field"><span>{t.field}</span>
      <select value={fieldId} onChange={e => setFieldId(e.target.value)} data-testid="path-field">
        {PATH_FIELDS.map(field => <option key={field.id} value={field.id}>{field.title[lang]}</option>)}
      </select>
    </label>
    <h4>{t.needs}</h4>
    <ul className="path-gap" data-testid="path-gap">
      {gap.requirements.map(r => <li key={r.capability} data-capability={r.capability} data-status={r.status}>
        <strong>{r.labels[lang]}</strong>: {t.status[r.status]}{r.status !== 'missing' ? ` (${levelLabel(r.level, lang)})` : ''}
      </li>)}
    </ul>
    {!gap.hasGap && <p className="path-no-gap" data-testid="path-no-gap" role="status">{t.noGap}</p>}
    {gap.hasGap && uncovered.length > 0 && <p data-testid="path-uncovered">{t.nothing} {uncovered.map(r => r.labels[lang]).join(lang === 'ar' ? '، ' : ', ')}</p>}
    {suggestions.length > 0 && <>
      <h4>{t.steps}</h4>
      <p className="path-order">{t.order}</p>
      <ol className="path-suggestions">
        {suggestions.map(s => {
          const item = catalogItem(s.itemId)
          return <li key={s.itemId} className="path-suggestion" data-testid="path-suggestion" data-item={s.itemId}>
            <div className="path-suggestion-head">
              <strong>{item.title[lang]}</strong>
              {s.status === 'reviewed' ? <span className="path-badge" data-testid="path-reviewed">{t.reviewed}</span> : <span className="path-badge illustrative">{t.illustrative}</span>}
            </div>
            <p className="path-meta">{t.kind[item.kind]}{item.courseCode ? <> · <span dir="ltr">{item.courseCode}</span></> : null} · {/Illustrative pilot/.test(item.provider) ? t.noProvider : item.provider} · {t.level[item.level]}</p>
            <p>{t.closes}: {label(s.closes)}{!s.prerequisitesMet && <> · <span className="path-prereq">{t.needsFirst}: {label(s.missingPrerequisites)}</span></>}</p>
            <details>
              <summary>{t.why}</summary>
              <p>{s.reason[lang]}</p>
              <p className="path-source">{t.source}: <span lang="en" dir="ltr">{['kau-catalog', 'department-offer'].includes(item.source?.type) && item.source.ref ? `${item.source.ref}. ` : ''}{item.sourceNote}</span>{item.providerUrl ? <> · <span dir="ltr">{item.providerUrl}</span></> : null}</p>
            </details>
          </li>
        })}
      </ol>
    </>}
    </details>
  </section>
}

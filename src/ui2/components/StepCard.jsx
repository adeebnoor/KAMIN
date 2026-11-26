// Task 65 · one next step as a short card (step 4, src/ui2/screens/NextSteps.jsx): the kind (Course, Certificate,
// University course) and the title, then three lines: "Builds:" the capabilities it supports, "Improves:" the
// pathways it brings closer, "Why:" the one-sentence gap reason. "Illustrative example" when the item is one
// (Task 36). Four short lines before Details: at most two chips per line, the rest as "+n" (all of them in Details).
// Actions: "Take this course" / "Get this certificate" (into My plan), "Not for me" (hidden), Details (a sheet with the
// outcome, the level, the prerequisites, the gap it closes, where the student's evidence comes from, the item's
// source, the learning list's sentence and the "clue, not a guarantee" sentence). No score, no percentage, no rank.
import { forwardRef, useId } from 'react'
import { capabilityName } from '../capabilityName.js'
import { levelLabel } from '../../evidence/levels.js'
import { COURSE_EVIDENCE_PRINCIPLE } from '../../content/trustCopy.js'
import { LEARNING_PATH_COPY } from '../../content/learningPathCopy.js'
import { fillIn, nextCopy } from '../copy.js'
import { actionFor, firstSentence, pathwayTitle } from '../nextState.js'
import Chip from '../Chip.jsx'

export { capabilityName }
export const CHIPS_PER_LINE = 2
const join = (list, lang) => list.join(lang === 'ar' ? '، ' : ', ')

// At most two chips, then "+n" (its accessible name lists the others, so nothing is hidden from a screen reader).
function ChipLine({ label, names, lang, testId }) {
  const w = nextCopy(lang).next
  const shown = names.slice(0, CHIPS_PER_LINE), rest = names.slice(CHIPS_PER_LINE)
  return <p className="ui2-step-line" data-testid={testId}>
    <span className="ui2-step-label">{label}</span>
    {shown.map(name => <Chip key={name}>{name}</Chip>)}
    {rest.length > 0 && <Chip aria-label={join(rest, lang)} title={join(rest, lang)}>{fillIn(w.more, { n: rest.length })}</Chip>}
  </p>
}

// The pathways a card improves, the student's goals first.
export const improvesInOrder = (card, goals = []) => [...card.improves].sort((a, b) => Number(goals.includes(b)) - Number(goals.includes(a)))

const StepCard = forwardRef(function StepCard({ lang, card, item, goals, onTake, onHide, onDetails }, headingRef) {
  const w = nextCopy(lang).next
  const T = LEARNING_PATH_COPY[lang]
  const id = useId()
  const title = item?.title?.[lang] || card.itemId
  return <article className="ui2-step" aria-labelledby={`${id}-title`} data-testid="ui2-step-card" data-item={card.itemId}>
    <div className="ui2-step-top">
      <span className="ui2-step-kind" data-testid="ui2-step-kind">{T.kind[card.kind]}</span>
      {card.illustrative && <span className="ui2-step-tag" data-testid="ui2-step-illustrative">{T.illustrative}</span>}
      <h3 id={`${id}-title`} tabIndex={-1} ref={headingRef}>{title}</h3>
    </div>
    <ChipLine label={w.builds} names={card.supports.map(cap => capabilityName(cap, lang))} lang={lang} testId="ui2-step-builds"/>
    {card.improves.length > 0 && <ChipLine label={w.improves} names={improvesInOrder(card, goals).map(path => pathwayTitle(path, lang) || path)} lang={lang} testId="ui2-step-improves"/>}
    <p className="ui2-step-line ui2-step-why" data-testid="ui2-step-why"><span className="ui2-step-label">{w.why}</span> {firstSentence(card.why[lang])}</p>
    <div className="ui2-step-actions">
      <button type="button" className="ui2-btn ui2-btn-primary" onClick={onTake}>{actionFor(card.kind) === 'get-certificate' ? w.get : w.take}</button>
      <button type="button" className="ui2-btn" aria-label={fillIn(w.notForMeOf, { title })} onClick={onHide}>{w.notForMe}</button>
      <button type="button" className="ui2-text-btn" aria-haspopup="dialog" aria-label={fillIn(w.detailsOf, { title })} onClick={onDetails}>{w.details}</button>
    </div>
  </article>
})
export default StepCard

// The Details sheet's content. `gaps`: the gap of each goal the card is for (computeGap); `skills`: the student's
// capabilities with their evidence (the profile's own, read only); `reviewed`: the learning list has been checked by
// two department reviewers (Task 36). `onTake`: the card's own "Take this course" / "Get this certificate", repeated at the
// end so the student can decide right after reading.
export function StepDetails({ lang, card, item, gaps = [], skills = [], reviewed = false, onTake = null }) {
  const w = nextCopy(lang).next
  const T = LEARNING_PATH_COPY[lang]
  const statusOf = cap => gaps.flatMap(gap => gap.requirements).find(r => r.capability === cap)
  const closes = card.gapCapabilities.map(cap => { const r = statusOf(cap); return `${capabilityName(cap, lang)} (${T.status[r?.status || 'missing']})` })
  const official = ['kau-catalog', 'department-offer'].includes(item?.source?.type)
  return <div className="ui2-step-details" data-testid="ui2-step-details">
    <p className="ui2-step-meta">{T.kind[card.kind]}{item?.courseCode ? <> · <span dir="ltr">{item.courseCode}</span></> : null}{item?.provider ? <> · {/Illustrative pilot/.test(item.provider) ? T.noProvider : item.provider}</> : null}</p>
    {card.illustrative && <p><span className="ui2-step-tag">{T.illustrative}</span></p>}

    {item?.outcome?.[lang] && <><h3>{w.outcome}</h3><p data-testid="ui2-step-outcome">{item.outcome[lang]}</p></>}
    <h3>{w.levelTitle}</h3>
    <p>{T.level[item?.level] || item?.level}</p>
    <h3>{w.prerequisites}</h3>
    <p data-testid="ui2-step-prereq">{card.prerequisitesMet
      ? ((item?.requires || []).length ? w.prereqMet : w.noPrereq)
      : `${T.needsFirst}: ${join(card.missingPrerequisites.map(cap => capabilityName(cap, lang)), lang)}`}</p>

    <h3>{w.gapTitle}</h3>
    <p data-testid="ui2-step-closes">{T.closes}: {join(closes, lang)}</p>
    <p>{card.why[lang]}</p>
    <div data-testid="ui2-step-gap">{gaps.map(gap => <div key={gap.targetId}>
      <p className="ui2-step-sub">{T.needs} · {gap.targetTitle[lang]}</p>
      <ul>{gap.requirements.map(r => <li key={r.capability} data-status={r.status}><strong>{r.labels[lang]}</strong>: {T.status[r.status]}{r.status !== 'missing' ? ` (${levelLabel(r.level, lang)})` : ''}</li>)}</ul>
    </div>)}</div>

    <h3>{w.evidenceTitle}</h3>
    <ul data-testid="ui2-step-evidence">{card.supports.map(cap => {
      const skill = skills.find(s => s.id === cap)
      const rows = (skill?.evidence || []).filter(e => e.code)
      return <li key={cap}><strong>{fillIn(w.evidenceFor, { capability: capabilityName(cap, lang) })}</strong>{' '}
        {rows.length ? join(rows.map(e => `${e.code}${e.grade ? ` (${e.grade})` : ''}`), lang) : T.status.missing}
        {skill ? ` · ${levelLabel(skill.evidenceLevel, lang)}` : ''}</li>
    })}</ul>
    <p className="ui2-step-clue" data-testid="ui2-step-clue">{COURSE_EVIDENCE_PRINCIPLE[lang]}</p>

    <h3>{T.source}</h3>
    <p className="ui2-step-source"><span lang="en" dir="ltr">{official && item?.source?.ref ? `${item.source.ref}. ` : ''}{item?.sourceNote}</span>{item?.providerUrl ? <> · <span dir="ltr">{item.providerUrl}</span></> : null}</p>
    <p data-testid="ui2-step-list-note">{reviewed ? T.introReviewed : T.intro}</p>
    <p className="ui2-step-sub">{T.order}</p>
    {onTake && <div className="ui2-step-actions"><button type="button" className="ui2-btn ui2-btn-primary" onClick={onTake}>{actionFor(card.kind) === 'get-certificate' ? w.get : w.take}</button></div>}
  </div>
}

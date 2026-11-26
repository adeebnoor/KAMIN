// Task 79 · one pathway's roadmap (src/catalog/roadmaps.json through src/roadmap/roadmap.js): the stages in order, each
// with what to learn and why, the KAMIN capabilities it builds and its free resources; then the certifications that
// matter for the pathway (issuer, why, take it / optional / later, when, the issuer's official page; never a price).
// Shown in My plan for each chosen goal (src/ui2/screens/Plan.jsx) and from step 4 in a sheet (NextSteps.jsx).
// Each resource has a checkbox: a tick is the student's own record (state.roadmapDone), saved with the plan; it can be
// unticked and it is never evidence. Links open the provider's site in a new tab; KAMIN requests nothing.
import { useId, useMemo } from 'react'
import { normalizePlan } from '../../plan/plan.js'
import { roadmapFor, roadmapProgress } from '../../roadmap/roadmap.js'
import { fillIn, nextCopy } from '../copy.js'
import { capabilityName } from '../capabilityName.js'

const join = (list, lang) => list.join(lang === 'ar' ? '، ' : ', ')

function NewTabLink({ href, children, lang }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}<span className="sr-only"> {nextCopy(lang).roadmap.newTab}</span></a>
}

export default function Roadmap({ lang, data, pathwayId, state, onTick, level = 3 }) {
  const r = nextCopy(lang).roadmap
  const id = useId()
  const roadmap = useMemo(() => roadmapFor(data, pathwayId), [data, pathwayId])
  if (!roadmap) return <p className="ui2-roadmap-none" data-testid="ui2-roadmap-none">{r.none}</p>
  const progress = roadmapProgress(roadmap, state)
  const done = new Set(normalizePlan(state).roadmapDone)
  const Heading = `h${Math.min(level, 6)}`
  return <div className="ui2-roadmap" data-testid="ui2-roadmap" data-pathway={pathwayId}>
    <p className="ui2-roadmap-intro">{r.intro}</p>
    <p className="ui2-roadmap-progress" data-testid="ui2-roadmap-progress">{fillIn(r.progress, progress)}</p>
    <ol className="ui2-roadmap-stages">
      {roadmap.stages.map(stage => <li key={stage.id} className="ui2-roadmap-stage" data-testid="ui2-roadmap-stage" data-stage={stage.id}>
        <Heading className="ui2-roadmap-stage-title">{fillIn(r.stage, { n: stage.order })} · {stage.title[lang]}</Heading>
        <p><strong>{r.learn}</strong> {stage.learn[lang]}</p>
        <p><strong>{r.why}</strong> {stage.why[lang]}</p>
        {stage.capabilities.length > 0 && <p data-testid="ui2-roadmap-builds"><strong>{r.builds}</strong> {join(stage.capabilities.map(cap => capabilityName(cap, lang)), lang)}</p>}
        <p className="ui2-roadmap-count">{fillIn(r.progress, progress.stages[stage.id])}</p>
        <ul className="ui2-roadmap-items">{stage.items.map(({ key, resource }) => {
          const box = `${id}-${key}`
          return <li key={key} className="ui2-roadmap-item" data-testid="ui2-roadmap-item" data-key={key} data-done={done.has(key) ? 'true' : 'false'}>
            <input type="checkbox" id={box} checked={done.has(key)} aria-label={fillIn(r.tickOf, { title: resource.title[lang] })}
              onChange={event => onTick(key, event.target.checked)}/>
            <div>
              <NewTabLink href={resource.url} lang={lang}>{resource.title[lang]}</NewTabLink>
              <p className="ui2-roadmap-meta">{r.kind[resource.kind] || resource.kind} · {resource.source} · {r.language[resource.language]}</p>
            </div>
          </li>
        })}</ul>
      </li>)}
    </ol>
    {roadmap.certifications.length > 0 && <section className="ui2-roadmap-certs" aria-labelledby={`${id}-certs`} data-testid="ui2-roadmap-certs">
      <Heading id={`${id}-certs`} className="ui2-roadmap-stage-title">{r.certsTitle}</Heading>
      <ul>{roadmap.certifications.map(c => <li key={c.id} className="ui2-roadmap-cert" data-testid="ui2-roadmap-cert" data-cert={c.id} data-recommendation={c.recommendation}>
        <p><strong>{c.name[lang]}</strong> · <span className="ui2-roadmap-rec">{r.recommendation[c.recommendation]}</span></p>
        <p>{r.issuer} {c.issuer}</p>
        <p>{r.why} {c.why[lang]}</p>
        <p>{r.when} {c.when[lang]}</p>
        <p><NewTabLink href={c.url} lang={lang}>{fillIn(r.official, { name: c.issuer })}</NewTabLink></p>
      </li>)}</ul>
      <p className="ui2-roadmap-note">{r.noPrices}</p>
    </section>}
    <p className="ui2-roadmap-note" data-testid="ui2-roadmap-never-evidence">{r.neverEvidence}</p>
    <p className="ui2-roadmap-note">{r.offline} {fillIn(r.provenance, { date: data?.linksChecked?.date || '—' })}</p>
  </div>
}

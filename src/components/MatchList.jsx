import { useState } from 'react'
import { BookOpen, Check, ChevronDown, Columns3, SearchCheck, Sparkles } from 'lucide-react'
import { copy, fill } from '../i18n.js'
import { pageHref } from '../../public/site-content.js'
import { relationGovernance, governanceLine } from '../catalog/governance.js'
import { opportunityStatus } from '../market/localOpportunities.js'
import RecommendationReview from './RecommendationReview.jsx'
import TechDetails from './TechDetails.jsx'
import { GoalPicker } from './GoalChips.jsx'
import { MATCH_GROUPS, groupMatches, matchReason } from '../utils/matchReason.js'
import { PATHWAY_COPY } from '../content/pathwayCopy.js'

// Task 23 · "My next step → Matches" as a short list you can scan: the goal first, three groups (fits,
// fits with conditions, not for now), one compact row per pathway with one specific reason, and the full
// explanation on demand. Moved out of src/App.jsx (MatchExplorer, KnowledgeMatchContext) and loaded only
// when the view opens. Nothing was removed: everything a card showed is in the opened row.

const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.ar || value?.en || ''
// Task 65: the judgment words and the pathway sentences live in src/content/pathwayCopy.js (unchanged), shared
// with the new interface.
const JUDGMENT = PATHWAY_COPY.judgment
const statusClass = judgment => judgment === 'fits' ? 'yes' : judgment === 'conditional' ? 'conditional' : 'no'
const FIRST_ROWS = 3

export function KnowledgeMatchContext({ item, lang }) {
  const knowledge=item.knowledgeInsights
  if(!knowledge) return null
  const external=knowledge.externalOccupations||[]
  const activities=knowledge.workActivities||[]
  const gaps=knowledge.developmentGaps||[]
  const bridges=knowledge.bridges||[]
  if(!external.length&&!activities.length&&!gaps.length&&!bridges.length) return null
  return <div className="knowledge-context">
    <div className="knowledge-context-head">
      <div><Sparkles size={16}/><span><strong>{copy[lang].screens.matches.related}</strong></span></div>
      <div className="knowledge-source-chips">{external.map(ref=><a key={ref.id} href={ref.sourceUrl||'#'} target="_blank" rel="noreferrer" title={ref.reviewStatus||''}>{ref.conceptScheme} {ref.notation}</a>)}</div>
    </div>
    {activities.length>0&&<div className="knowledge-activity"><SearchCheck size={15}/><span><strong>{lang==='ar'?'نشاط مهني مرجعي':'Reference work activity'}</strong>{activities.slice(0,2).map(activity=><small key={activity.id}>{activity.label}</small>)}</span></div>}
    {gaps.length>0&&<div className="knowledge-development">
      <strong>{lang==='ar'?'إشارات تطويرية — لا تغيّر حكم الملاءمة':'Development signals — do not change Fit'}</strong>
      <div>{gaps.slice(0,4).map(gap=><span key={gap.capabilityId}>{gap.label}</span>)}</div>
      <small>{lang==='ar'?'مأخوذة من سياق O*NET السوقي الحالي؛ نستخدمها لتوجيه التعلم فقط، لا كبوابة توظيف.':'Current O*NET market context; used only to guide development, never as a hiring gate.'}</small>
    </div>}
    {bridges.length>0&&<div className="knowledge-bridges">
      <strong>{lang==='ar'?'الجسر التالي المقترح':'Suggested next bridge'}</strong>
      {bridges.slice(0,3).map(bridge=><div key={bridge.id}><BookOpen size={15}/><span><b>{bridge.label}</b><small>{bridge.develops.map(x=>x.label).join(' · ')}</small></span><em>{bridge.reasons?.includes('required-gap')?(lang==='ar'?'يسد فجوة أساسية':'closes a required gap'):(lang==='ar'?'يقوي ملفك':'strengthens the profile')}</em></div>)}
    </div>}
  </div>
}

// Everything the full card used to show, now inside the opened row (unchanged wording).
function MatchDetails({ item, lang, state, onSaveReview, onPlan, compare }) {
  const S = copy[lang].screens.matches
  return <>
    <p className="match-subtitle">{item.subtitle[lang]}</p>
    <p className="match-outcome">{item.outcome[lang]}</p>
    <div className="match-context"><strong>{lang==='ar'?'لماذا تستكشف هذا المسار؟':'Why explore this pathway?'}</strong><p>{item.semanticPaths?.some(p=>p.kind==='goal-alignment'&&p.status==='supported')?(lang==='ar'?'يرتبط بالهدف الذي اخترته.':'It connects to the goal you chose.'):item.semanticPaths?.some(p=>p.kind==='preference-alignment'&&p.status==='supported')?(lang==='ar'?'يتصل بأحد اهتماماتك أو تفضيلاتك المصرّح بها.':'It connects to one of your declared interests or preferences.'):(lang==='ar'?'مسار من الكتالوج يمكنك استكشافه ومقارنته بما تفضّله.':'A catalog pathway you can explore and compare with your preferences.')}</p></div>
    <div className="match-next"><strong>{lang==='ar'?'خطوتك التالية':'Your next step'}</strong><p>{item.knowledgeInsights?.bridges?.[0]?.label || (lang==='ar'?'راجع متطلبات المسار واختر تجربة تطبيقية واحدة.':'Review the pathway requirements and choose one applied exercise.')}</p>{item.limitingMechanisms[0]&&<small>{item.limitingMechanisms[0]}</small>}
      <div className="match-next-actions">
        <button className="text-button" onClick={()=>onPlan(item.id)}>{lang==='ar'?'افتح خطة هذا المسار':'Open this pathway’s plan'}</button>
        {compare && <button type="button" className="text-button match-compare-toggle" aria-pressed={compare.has} disabled={!compare.has && compare.full} onClick={()=>compare.toggle(item.id)}><Columns3 size={15}/>{compare.has ? S.inCompare : compare.full ? S.compareFull : S.addCompare}</button>}
      </div>
    </div>
    <div className="match-evidence-details" data-testid="match-evidence">
      <strong className="match-evidence-title">{PATHWAY_COPY.details[lang]}</strong>
      {item.source&&<p><a href={item.source.url.startsWith('/')?pageHref(item.source.url,lang):item.source.url}>{PATHWAY_COPY.reference[lang]}: {item.source.title}</a> · {item.source.checked}<br/>{PATHWAY_COPY.provisional[lang]}</p>}
      <div className="mechanism-block"><strong>{S.supports}</strong>{item.supportingMechanisms.map((m,i)=><p key={i}><Check size={15}/>{m}</p>)}</div>
      {item.semanticPaths?.some(path=>path.kind==='capability-match')&&<div className="semantic-path-block"><strong>{S.evidencePaths}</strong>{item.semanticPaths.filter(path=>path.kind==='capability-match').map((path,i)=><div className="semantic-path" key={path.claimId||i}><span>{path.courseCode||S.evidenceFallback}</span><b>→</b><span>{localized(path.capabilityLabel,lang)||path.capabilityKey}</span><b>→</b><span>{item.title[lang]}</span></div>)}</div>}
      <KnowledgeMatchContext item={item} lang={lang}/>
      {item.limitingMechanisms.length>0&&<div className="mechanism-block limits"><strong>{PATHWAY_COPY.limits[lang]}</strong>{item.limitingMechanisms.map((m,i)=><p key={i}><span aria-hidden="true">△</span>{m}</p>)}</div>}
      <footer className="match-meta"><span>{item.graphTrace?fill(S.pathCount,{n:item.graphTrace.evidencePathCount,total:item.graphTrace.requiredCapabilities}):S.noScore}</span></footer>
      {/* Task 28: versions, review owner and scope stay one click away for reviewers. */}
      <TechDetails lang={lang} className="match-technical"><dl><dt>{S.technical.review}</dt><dd className="match-governance">{governanceLine(relationGovernance(item),lang)}</dd><dt>{S.technical.rule}</dt><dd><code dir="ltr">{item.ruleVersion}</code></dd>{item.knowledgeInsights&&<><dt>{S.technical.graph}</dt><dd><code dir="ltr">{item.graphTrace?.knowledgeGraphVersion||'kamin-ict-kg-v1'}</code></dd></>}</dl></TechDetails>
    </div>
    <RecommendationReview item={item} lang={lang} state={state} onSave={onSaveReview}/>
  </>
}

// One compact row: title, type, judgment badge and one reason line. The title button opens the row in
// place (aria-expanded); the whole head is clickable. Closed rows keep their content in the page,
// hidden, so nothing has to be re-computed when a row opens.
function MatchRow({ item, lang, open, onToggle, hidden, ...details }) {
  const S = copy[lang].screens.matches
  const reason = matchReason(item, lang)
  const panelId = `match-panel-${item.id}`
  return <article className={`panel match-card match-row${open ? ' is-open' : ''}`} data-match-id={item.id} data-reason={reason.kind} hidden={hidden}>
    <div className="match-row-head">
      <h4 className="match-row-title"><button type="button" className="match-toggle" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>{item.title[lang]}</button></h4>
      <span className="match-type">{S.type[item.type] || item.subtitle[lang]}</span>
      <span className={`status ${statusClass(item.judgment)}`}>{JUDGMENT[item.judgment][lang]}</span>
      <p className="match-reason" data-testid="match-reason">{reason.text}</p>
      <ChevronDown className="match-chevron" size={18} aria-hidden="true"/>
    </div>
    <div className="match-row-panel" id={panelId} hidden={!open}><MatchDetails item={item} lang={lang} {...details}/></div>
  </article>
}

function MatchGroup({ id, items, lang, openId, setOpenId, details, compareFor }) {
  const S = copy[lang].screens.matches
  const [expanded, setExpanded] = useState(id !== 'later')
  const [showAll, setShowAll] = useState(false)
  if (!items.length) return null
  const headingId = `match-group-${id}`, bodyId = `match-group-body-${id}`
  const label = <>{S.groups[id]} <span className="match-count">({items.length})</span></>
  return <section className={`match-group match-group-${id}`} aria-labelledby={headingId} data-group={id}>
    <h3 id={headingId} className="match-group-head">{id === 'later'
      ? <button type="button" className="match-group-toggle" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(v => !v)}>{label}<ChevronDown size={18} aria-hidden="true"/></button>
      : label}</h3>
    <div className="match-rows" id={bodyId} hidden={!expanded}>
      {items.map((item, i) => <MatchRow key={item.id} item={item} lang={lang} hidden={!showAll && i >= FIRST_ROWS && openId !== item.id}
        open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} {...details} compare={compareFor(item.id)}/>)}
      {!showAll && items.length > FIRST_ROWS && <button type="button" className="text-button match-more" onClick={() => setShowAll(true)}>{fill(S.showMore, { n: items.length - FIRST_ROWS })}</button>}
    </div>
  </section>
}

export default function MatchList({ lang, matches, state, onSaveReview, onPlan, onChooseGoal, compareIds = null, onToggleCompare = null, onOpenCompare = null }) {
  const S = copy[lang].screens.matches
  const [openId, setOpenId] = useState(null)
  const groups = groupMatches(matches)
  const chosen = compareIds || []
  const compareFor = onToggleCompare ? id => ({ has: chosen.includes(id), full: chosen.length >= 3, toggle: onToggleCompare }) : () => null
  const details = { state, onSaveReview, onPlan }
  return <div className="match-explorer match-list">
    <div className="app-title"><small>{S.kicker}</small><h2>{S.title}</h2></div>
    <GoalPicker lang={lang} goal={state.goal} onChoose={onChooseGoal} testId="match-goal"/>
    {MATCH_GROUPS.map(id => <MatchGroup key={id} id={id} items={groups[id]} lang={lang} openId={openId} setOpenId={setOpenId} details={details} compareFor={compareFor}/>)}
    <p className="opportunity-status" data-testid="opportunity-status">{opportunityStatus().note[lang]}</p>
    {chosen.length > 0 && onOpenCompare && <div className="match-compare-bar"><button type="button" className="button primary" data-testid="open-compare" onClick={onOpenCompare}><Columns3 size={16}/>{fill(S.openCompare, { n: chosen.length })}</button></div>}
  </div>
}

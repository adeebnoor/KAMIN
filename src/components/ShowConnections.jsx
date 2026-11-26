// Task 75 · the old "Show connections" → "Capability network" tab (the supervisor's map), one copy for both interfaces.
// Moved word for word out of DecisionStudio.jsx, which imports it, so the old view is unchanged; the new interface shows
// the same parts in Profile → My map (src/ui2/components/ConnectionsMap.jsx). Nothing here changes a profile.
// - PathwayControls: "Pathway to explore" and the line saying what the profile is made of (the studio's controls).
// - ShowConnections: the relationship network (RelationshipNetwork.jsx), the inference proof, "My profile dimensions",
//   the context note with "Edit my interests & goal", and "Academic evidence path to the opportunity".
//   `onCapability` (optional, new interface only): called with a capability's id when its node is tapped.
import KnowledgeNetwork from './KnowledgeNetwork.jsx'
import ProfileNetwork from './ProfileNetwork.jsx'
import RelationshipNetwork from './RelationshipNetwork.jsx'
import { InferenceProof } from './InferenceExplorer.jsx'
import { copy } from '../i18n.js'
import { targetProfiles } from '../matching/targets.js'
const tr = (lang, ar, en) => lang === 'ar' ? ar : en
// Task 79: the goal's plain name for "Academic evidence path to the opportunity": one of the old four directions, or a
// pathway's title when the goal is a pathway (Task 58), never an id; nothing when no goal is chosen.
export const goalLabelOf = (goal, lang) => (goal ? copy[lang].app.goals[goal] || targetProfiles.find(t => t.id === goal)?.title?.[lang] : undefined) || undefined

export function PathwayControls({ lang, matches, match, status, onChange }) {
  const S = copy[lang].screens.studio
  return <div className="studio-controls"><label>{tr(lang, 'المسار الذي أريد استكشافه', 'Pathway to explore')}<select value={match?.id || ''} onChange={e => onChange(e.target.value)}>{matches.map(m => <option key={m.id} value={m.id}>{m.title[lang]}</option>)}</select></label><div><small>{status}</small><span>{S.basis}</span></div></div>
}

export default function ShowConnections({ lang, state, match, graph, onGoal, onCapability }) {
  return <div className="studio-profile-network"><RelationshipNetwork lang={lang} state={state} match={match} onCapability={onCapability}/><InferenceProof match={match} graph={graph} lang={lang} demo={state.courses.some(c=>c.source==='demo')}/><details className="studio-evidence-details"><summary>{tr(lang,'تفاصيل أبعاد ملفي','My profile dimensions')}</summary><ProfileNetwork lang={lang} state={state} demo={state.courses.some(c=>c.source==='demo')}/></details><div className="studio-context-note"><p>{tr(lang,'هذه شبكة معلوماتك الشخصية. افتح مسار الدليل لترى كيف ترتبط المقررات بمتطلبات المسار المختار.','This is your personal information network. Open the evidence path to see how courses connect to the selected pathway.')}</p><button className="text-button" onClick={onGoal}>{tr(lang,'عدّل اهتماماتي وهدفي','Edit my interests & goal')}</button></div><details className="studio-evidence-details"><summary>{tr(lang,'مسار الدليل الأكاديمي إلى الفرصة','Academic evidence path to the opportunity')}</summary><KnowledgeNetwork match={match} lang={lang} goalLabel={goalLabelOf(state.goal, lang)} demo={state.courses.some(c=>c.source==='demo')}/></details></div>
}

// Task 70: the old landing page's synthetic demo (InferenceDemo, the default export) is deleted with it; the proof
// (InferenceProof) stays, shown in My map (src/components/ShowConnections.jsx).
import { useId, useState } from 'react'
import { Download, GitMerge, Link2, ListChecks, Sparkles } from 'lucide-react'
import { INFERENCE_RULES } from '../matching/inference.js'
import { buildInferenceDataset } from '../ontology/rdf.js'
import { buildTargetSemanticGraph } from '../matching/graph.js'
import { skills as skillCatalog } from '../data.js'
import { DECLARED_PREFERENCE_SCHEMES } from '../insight.js'
import { copy, fill } from '../i18n.js'
import TechDetails from './TechDetails.jsx'
import { DIGITAL_TOPICS } from '../digitalInterests.js'
import { targetProfiles } from '../matching/targets.js'

const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const localize = (value,lang) => typeof value === 'string' ? value : value?.[lang] || ''
const capability = (id,lang) => skillCatalog[id]?.labels?.[lang] || id
// Task 78: a goal that is a pathway id (step 4, My plan) is named by the pathway's title, never by its id.
const pathwayTitle = (id,lang) => targetProfiles.find(t=>t.id===id)?.title?.[lang]
const relationLabels = {
  'kamin:demonstrates':['لديه دليل على','has evidence for'],
  'kamin:courseContext':['مرتبط بالمقرر','comes from course'],
  'kamin:requiresCapability':['يتطلب قدرة','requires capability'],
  'kamin:pursuesGoal':['يختار هدف','declares goal'],
  'kamin:supportsGoal':['يدعم هدف','supports goal'],
  'kamin:hasCapabilityEvidenceFor':['لديه دليل مرتبط بمتطلب في','has evidence for a requirement in'],
  'kamin:hasGoalContextFor':['يرتبط هدفه بـ','has a goal connection to'],
  'kamin:hasPreferenceContextFor':['يرتبط تفضيله بـ','has a preference connection to'],
  'kamin:hasConfirmedInterest':['يؤكد اهتمامه بـ','confirms an interest in'],
  'kamin:relatesToTopic':['يرتبط بموضوع','relates to topic'],
  'kamin:hasInterestContextFor':['يرتبط اهتمامه بـ','has an interest connection to'],
}
export function InferenceProof({match, graph, lang, demo=false}) {
  const id=useId()
  const [selected,setSelected]=useState('')
  const [error,setError]=useState('')
  const results=match?.inferences || []
  const result=results.find(r=>r.id===selected) || results.find(r=>r.ruleId==='R3') || results[0]
  const entities=new Map([...graph.entities,...buildTargetSemanticGraph(match).entities].map(e=>[e['@id'],e]))
  const name=iri=>{
    if(iri===graph['@id'])return tr(lang,demo?'الطالب في المثال':'أنت',demo?'Sample student':'You')
    const entity=entities.get(iri)
    if(iri?.startsWith('urn:kamin:goal:')) { const goal=entity?.notation||iri.slice('urn:kamin:goal:'.length); return copy[lang].app.goals[goal] || pathwayTitle(goal,lang) || goal }
    if(entity?.scheme?.startsWith('urn:kamin:preference-scheme:')) {
      const scheme=entity.scheme.slice('urn:kamin:preference-scheme:'.length)
      return DECLARED_PREFERENCE_SCHEMES[scheme]?.options.find(o=>o.id===entity.notation)?.label[lang] || entity.notation
    }
    if(entity?.['@type']==='Evidence')return tr(lang,'مصدر السجل','Record source')
    return localize(entity?.label || entity?.name || entity?.title,lang) || entity?.code || entity?.notation || iri
  }
  const relation=predicate=>{
    if(predicate.startsWith('kamin:prefers:'))return tr(lang,'يصرّح بتفضيل','declares preference')
    if(predicate.startsWith('kamin:compatiblePreference:'))return tr(lang,'يتوافق مع تفضيل','is compatible with preference')
    return relationLabels[predicate]?.[lang==='ar'?0:1] || predicate
  }
  const describe=t=>`${name(t.subject)} · ${relation(t.predicate)} · ${name(t.object)}`
  // Task 28: the rule id is in "Technical details", not in the picker.
  // Task 78: with several chosen values of one scheme (up to 3 interest areas or work values), each connection also names its value.
  const sameScheme=r=>r.ruleId==='R3'&&results.filter(x=>x.ruleId==='R3'&&x.scheme===r.scheme).length>1
  const optionLabel=r=>`${r.topicId?DIGITAL_TOPICS.find(topic=>topic.id===r.topicId)?.label[lang]:r.capabilityKey?capability(r.capabilityKey,lang):r.scheme?DECLARED_PREFERENCE_SCHEMES[r.scheme]?.label[lang]:tr(lang,'هدفك','Your goal')}${sameScheme(r)?` · ${name(r.premises[0].object)}`:''}`
  const download=()=>{
    try {
      const blob=new Blob([JSON.stringify(buildInferenceDataset(graph,match),null,2)],{type:'application/ld+json'})
      const url=URL.createObjectURL(blob)
      const anchor=document.createElement('a');anchor.href=url;anchor.download='kamin-inference.jsonld';anchor.click()
      setTimeout(()=>URL.revokeObjectURL(url),1000);setError('')
    } catch {setError(tr(lang,'تعذر تصدير الشبكة. حاول مرة أخرى.','Could not export the graph. Please try again.'))}
  }
  const S=copy[lang].screens.studio
  return <div className="inference-proof">
    <div className="inference-proof-heading"><div><small><GitMerge size={16}/>{S.linkKicker}</small><h3>{S.linkTitle}</h3></div><span>{tr(lang,demo?'مثال حي · بيانات وهمية':'محسوب من ملفك',demo?'Live example · synthetic data':'Computed from your profile')}</span></div>
    {!!results.length && <div className="inference-picker"><label htmlFor={id}>{tr(lang,'العلاقة التي تريد تفسيرها','Connection to explain')}</label><select id={id} value={result.id} onChange={e=>setSelected(e.target.value)}>{results.map(r=><option key={r.id} value={r.id}>{optionLabel(r)}</option>)}</select></div>}
    {result ? <div className="inference-chain" aria-live="polite">
      <article className="inference-input"><ListChecks size={22}/><small>{tr(lang,'١ · ما نعرفه','1 · WHAT WE KNOW')}</small><h4>{tr(lang,'معلومات لها مصدر','Sourced information')}</h4><ul>{result.premises.map((p,i)=><li key={i}>{describe(p)}</li>)}</ul><p>{result.ruleId==='R1'?tr(lang,'سجل راجعه الطالب + خريطة مقررات تجريبية + متطلبات مرجعية.','Student-reviewed record + pilot course map + reference requirements.'):tr(lang,'اختيار صرّح به الطالب + وصف المسار في الكتالوج المرجعي.','Student declaration + pathway description in the reference catalog.')}</p></article>
      <article className="inference-rule"><GitMerge size={22}/><small>{tr(lang,'٢ · قاعدة الربط','2 · THE RULE')}</small><h4>{INFERENCE_RULES[result.ruleId][lang]}</h4><p>{S.ruleJoin}</p></article>
      <article className="inference-result"><Sparkles size={22}/><small>{S.linkStep}</small><h4>{describe(result.conclusion)}</h4><p>{result.ruleId==='R1'?tr(lang,'هذا دليل على متطلب محدد، وليس حكمًا باكتمال الجاهزية.','This supports a specific requirement; it does not establish overall readiness.'):tr(lang,'ارتباط سياقي من تفضيلاتك، لا يثبت مهارة ولا يلغي نقص الدليل.','This is declared context. It does not prove a skill or remove an evidence gap.')}</p><span>{tr(lang,'مستنتجة بالقواعد','Rule-derived')}</span></article>
    </div> : <div className="inference-empty" role="status"><Link2 size={24}/><p>{S.noLink}</p></div>}
    <div className="inference-limits"><strong>{tr(lang,'حدود النتيجة','Result limits')}</strong><p>{match.missingSkills.length?tr(lang,`لا يوجد في هذا الملف دليل على: ${match.missingSkills.map(k=>capability(k,lang)).join('، ')}. هذا لا يعني غياب القدرة.`,`This profile has no evidence for: ${match.missingSkills.map(k=>capability(k,lang)).join(', ')}. This does not mean the ability is absent.`):tr(lang,'المتطلبات المحدودة لهذا المثال لها أدلة. صلاحية التوصيات تحتاج تحققًا مستقلًا.','This example’s limited requirements have evidence. Recommendation validity still needs independent evaluation.')}</p></div>
    <TechDetails lang={lang} className="inference-technical">{result&&<p><code dir="ltr">{fill(S.technical.rule,{rule:result.ruleId,version:result.ruleVersion})}</code></p>}<p>{S.technical.graphs}</p>{result&&<div className="inference-triples" dir="ltr" tabIndex={0} role="region" aria-label={tr(lang,"ثلاثيات الاستنتاج — قابلة للتمرير","Inference triples — scrollable")}><table><caption>{tr(lang,'المقدمات والنتيجة المختارة','Selected premises and conclusion')}</caption><thead><tr><th>Subject</th><th>Predicate</th><th>Object</th></tr></thead><tbody>{[...result.premises,result.conclusion].map((p,i)=><tr key={i}><td>{p.subject}</td><td>{p.predicate}</td><td>{p.object}</td></tr>)}</tbody></table></div>}<button className="text-button" onClick={download}><Download size={17}/>{S.technical.download}</button><p>{S.technical.engine}</p>{error&&<p role="alert">{error}</p>}</TechDetails>
  </div>
}

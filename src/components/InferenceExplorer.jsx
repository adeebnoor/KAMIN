import { useId, useMemo, useState } from 'react'
import { Braces, Download, GitMerge, Link2, ListChecks, Sparkles } from 'lucide-react'
import { INFERENCE_RULES } from '../matching/inference.js'
import { buildInferenceDataset } from '../ontology/rdf.js'
import { projectStateToPerson360 } from '../ontology/projector.js'
import { buildMatchingProfile, matchTargets } from '../matching/engine.js'
import { buildTargetSemanticGraph } from '../matching/graph.js'
import { demoCourses, skills as skillCatalog } from '../data.js'
import { inferSkills } from '../utils/engine.js'
import { DECLARED_PREFERENCE_SCHEMES } from '../insight.js'
import { copy } from '../i18n.js'

const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const localize = (value,lang) => typeof value === 'string' ? value : value?.[lang] || ''
const capability = (id,lang) => skillCatalog[id]?.labels?.[lang] || id
const relationLabels = {
  'kamin:demonstrates':['لديه دليل على','has evidence for'],
  'kamin:courseContext':['مرتبط بالمقرر','comes from course'],
  'kamin:requiresCapability':['يتطلب قدرة','requires capability'],
  'kamin:pursuesGoal':['يختار هدف','declares goal'],
  'kamin:supportsGoal':['يدعم هدف','supports goal'],
  'kamin:hasCapabilityEvidenceFor':['لديه دليل مرتبط بمتطلب في','has evidence for a requirement in'],
  'kamin:hasGoalContextFor':['يرتبط هدفه بـ','has a goal connection to'],
  'kamin:hasPreferenceContextFor':['يرتبط تفضيله بـ','has a preference connection to'],
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
    if(iri?.startsWith('urn:kamin:goal:')) return copy[lang].app.goals[entity?.notation] || entity?.notation
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
  const optionLabel=r=>`${r.ruleId} · ${r.capabilityKey?capability(r.capabilityKey,lang):r.scheme?DECLARED_PREFERENCE_SCHEMES[r.scheme]?.label[lang]:tr(lang,'هدفك','Your goal')}`
  const download=()=>{
    try {
      const blob=new Blob([JSON.stringify(buildInferenceDataset(graph,match),null,2)],{type:'application/ld+json'})
      const url=URL.createObjectURL(blob)
      const anchor=document.createElement('a');anchor.href=url;anchor.download='kamin-inference.jsonld';anchor.click()
      setTimeout(()=>URL.revokeObjectURL(url),1000);setError('')
    } catch {setError(tr(lang,'تعذر تصدير الشبكة. حاول مرة أخرى.','Could not export the graph. Please try again.'))}
  }
  return <div className="inference-proof">
    <div className="inference-proof-heading"><div><small><GitMerge size={16}/>{tr(lang,'استدلال دلالي قابل للتتبّع','TRACEABLE SEMANTIC INFERENCE')}</small><h3>{tr(lang,'ما الذي استنتجه كامن؟','What did Kamin infer?')}</h3></div><span>{tr(lang,demo?'مثال حي · بيانات وهمية':'محسوب من ملفك',demo?'Live example · synthetic data':'Computed from your profile')}</span></div>
    {!!results.length && <label className="inference-picker" htmlFor={id}>{tr(lang,'العلاقة التي تريد تفسيرها','Connection to explain')}<select id={id} value={result.id} onChange={e=>setSelected(e.target.value)}>{results.map(r=><option key={r.id} value={r.id}>{optionLabel(r)}</option>)}</select></label>}
    {result ? <div className="inference-chain" aria-live="polite">
      <article className="inference-input"><ListChecks size={22}/><small>{tr(lang,'١ · ما نعرفه','1 · WHAT WE KNOW')}</small><h4>{tr(lang,'معلومات لها مصدر','Sourced information')}</h4><ul>{result.premises.map((p,i)=><li key={i}>{describe(p)}</li>)}</ul><p>{result.ruleId==='R1'?tr(lang,'سجل راجعه الطالب + خريطة مقررات تجريبية + متطلبات مرجعية.','Student-reviewed record + pilot course map + reference requirements.'):tr(lang,'اختيار صرّح به الطالب + وصف المسار في الكتالوج المرجعي.','Student declaration + pathway description in the reference catalog.')}</p></article>
      <article className="inference-rule"><GitMerge size={22}/><small>{tr(lang,'٢ · قاعدة الربط','2 · THE RULE')}</small><h4>{INFERENCE_RULES[result.ruleId][lang]}</h4><p>{tr(lang,'يجمع المحرك العلاقتين عبر المفهوم المشترك ليشتق علاقة بالشخص.','The engine joins the relationships through their shared concept to derive a person-to-pathway connection.')}</p><code dir="ltr">{result.ruleId} · {result.ruleVersion}</code></article>
      <article className="inference-result"><Sparkles size={22}/><small>{tr(lang,'٣ · العلاقة المستنتجة','3 · INFERRED CONNECTION')}</small><h4>{describe(result.conclusion)}</h4><p>{result.ruleId==='R1'?tr(lang,'هذا دليل على متطلب محدد، وليس حكمًا باكتمال الجاهزية.','This supports a specific requirement; it does not establish overall readiness.'):tr(lang,'ارتباط سياقي من تفضيلاتك، لا يثبت مهارة ولا يلغي نقص الدليل.','This is declared context. It does not prove a skill or remove an evidence gap.')}</p><span>{tr(lang,'مستنتجة بالقواعد','Rule-derived')}</span></article>
    </div> : <div className="inference-empty" role="status"><Link2 size={24}/><p>{tr(lang,'لا توجد علاقة داعمة مستنتجة لهذا المسار من المدخلات الحالية. أضف اهتمامًا أو هدفًا مناسبًا أو دليلًا قابلًا للمراجعة.','No supporting relationship can be inferred for this pathway from the current inputs. Add a relevant interest, goal or reviewable evidence.')}</p></div>}
    <div className="inference-limits"><strong>{tr(lang,'حدود النتيجة','Result limits')}</strong><p>{match.missingSkills.length?tr(lang,`لا يوجد في هذا الملف دليل على: ${match.missingSkills.map(k=>capability(k,lang)).join('، ')}. هذا لا يعني غياب القدرة.`,`This profile has no evidence for: ${match.missingSkills.map(k=>capability(k,lang)).join(', ')}. This does not mean the ability is absent.`):tr(lang,'المتطلبات المحدودة لهذا المثال لها أدلة. صلاحية التوصيات تحتاج تحققًا مستقلًا.','This example’s limited requirements have evidence. Recommendation validity still needs independent evaluation.')}</p></div>
    <details className="inference-technical"><summary><Braces size={18}/>{tr(lang,'افحص العلاقات بصيغة RDF / JSON-LD','Inspect RDF / JSON-LD relationships')}</summary><p>{tr(lang,'المدخلات، والمعرفة المرجعية، والاستنتاجات في رسوم منفصلة. ملف محلي غير مشفّر يحتوي بيانات الملف المعروض ومصادر العلاقات.','Inputs, reference knowledge and conclusions are separated into named graphs. This unencrypted local file contains the displayed profile and relationship sources.')}</p>{result&&<div className="inference-triples" dir="ltr"><table><caption>{tr(lang,'المقدمات والنتيجة المختارة','Selected premises and conclusion')}</caption><thead><tr><th>Subject</th><th>Predicate</th><th>Object</th></tr></thead><tbody>{[...result.premises,result.conclusion].map((p,i)=><tr key={i}><td>{p.subject}</td><td>{p.predicate}</td><td>{p.object}</td></tr>)}</tbody></table></div>}<button className="text-button" onClick={download}><Download size={17}/>{tr(lang,'تنزيل الشبكة بصيغة JSON-LD','Download graph as JSON-LD')}</button><p>{tr(lang,'المحرك الحالي قواعد JavaScript محددة. لا يشغّل استدلال OWL عامًا أو استعلامات SPARQL، ولا يطابق الأشخاص ببعضهم بعد.','The current engine runs bounded JavaScript rules. It does not run general OWL reasoning, SPARQL queries, or person-to-person matching yet.')}</p>{error&&<p role="alert">{error}</p>}</details>
  </div>
}

export default function InferenceDemo({lang}) {
  const [interest,setInterest]=useState('investigative')
  const [academic,setAcademic]=useState(true)
  const [target,setTarget]=useState('job-data-analyst')
  const graph=useMemo(()=>{
    const courses=academic?demoCourses:[]
    return projectStateToPerson360({state:{approved:academic,courses,goal:'data',consents:{insight:true},insight:{declaredPreferences:interest?{careerInterest:interest}:{}}},skills:inferSkills(courses)})
  },[academic,interest])
  const matches=useMemo(()=>matchTargets(buildMatchingProfile({graph}),{type:'job',lang}),[graph,lang])
  return <section id="semantic-inference" className="v2-section shell inference-demo"><div className="v2-section-heading"><span className="v2-kicker">{tr(lang,'الفكرة الأساسية · شاهدها تعمل','THE CORE IDEA · SEE IT WORK')}</span><h2>{tr(lang,'كيف يستنتج كامن علاقة جديدة؟','How does Kamin infer a new connection?')}</h2><p>{tr(lang,'غيّر مدخلًا في هذا المثال، ثم تتبّع المعلومة والقاعدة والنتيجة. يستخدم المحرك نفسه الذي يحلل ملفك.','Change an input, then follow the information, rule and result. This example uses the same engine that analyzes your profile.')}</p></div><div className="inference-demo-controls"><label>{tr(lang,'اهتمام الطالب في المثال','Sample student’s interest')}<select value={interest} onChange={e=>setInterest(e.target.value)}><option value="">{tr(lang,'لم أحدد بعد','Undecided')}</option>{DECLARED_PREFERENCE_SCHEMES.careerInterest.options.map(o=><option value={o.id} key={o.id}>{o.label[lang]}</option>)}</select></label><label>{tr(lang,'المسار في المثال','Sample pathway')}<select value={target} onChange={e=>setTarget(e.target.value)}>{matches.map(m=><option key={m.id} value={m.id}>{m.title[lang]}</option>)}</select></label><label className="inference-academic-toggle"><input type="checkbox" checked={academic} onChange={e=>setAcademic(e.target.checked)}/>{tr(lang,'تضمين الأدلة الأكاديمية الوهمية','Include synthetic academic evidence')}</label></div><InferenceProof lang={lang} graph={graph} match={matches.find(m=>m.id===target)||matches[0]} demo/></section>
}

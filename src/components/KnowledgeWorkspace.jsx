import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Network, Terminal, Play, X, Download, ShieldCheck, ArrowLeft, ArrowRight, BookOpen, Compass, Route } from 'lucide-react'
import { KNOWLEDGE_VERSION, knowledgeConcepts, referenceEdges, knowledgeLabel, searchKnowledge, buildWorkspaceDataset, QUERY_TEMPLATES } from '../knowledge/workspace.js'
import { startLocalQuery } from '../knowledge/runQuery.js'
const tr=(lang,ar,en)=>lang==='ar'?ar:en
const relationLabel=(id,lang)=>({
  'kamin:requiresCapability':{ar:'يتطلب قدرة',en:'requires capability'},
  'kamin:developsCapability':{ar:'يطوّر قدرة',en:'develops capability'},
  'kamin:relatesToTopic':{ar:'يرتبط بموضوع',en:'relates to topic'},
}[id]?.[lang]||id)
const errors={
  QUERY_EMPTY:['اكتب استعلامًا أو اختر قالبًا.','Enter a query or choose a template.'],
  QUERY_SYNTAX:['صيغة الاستعلام غير صحيحة. راجع الأقواس وأسماء المتغيرات وPREFIX.','Invalid syntax. Check braces, variables and PREFIX declarations.'],
  QUERY_READ_ONLY:['المتاح هنا SELECT وASK للقراءة فقط.','Only read-only SELECT and ASK queries are available.'],
  QUERY_LOCAL_ONLY:['استخدم البيانات المحلية فقط؛ SERVICE وFROM غير متاحين.','Use the local dataset only; SERVICE and FROM are unavailable.'],
  QUERY_TIMEOUT:['توقف الاستعلام بعد 12 ثانية. بسّط العلاقات ثم أعد المحاولة.','Stopped after 12 seconds. Simplify the query and try again.'],
  QUERY_TOO_LONG:['الحد الأقصى 6000 حرف.','Maximum query length is 6,000 characters.'],
  QUERY_TOO_COMPLEX:['الاستعلام معقد جدًا لهذه التجربة.','This query is too complex for this workspace.'],
  DATASET_TOO_LARGE:['الملف أكبر من نطاق هذه التجربة المحلية.','The dataset exceeds this local workspace’s size limit.'],
  QUERY_CANCELLED:['أُلغي الاستعلام.','Query cancelled.'],
  QUERY_FAILED:['تعذر تشغيل الاستعلام محليًا. أعد المحاولة بقالب جاهز أو متصفح أحدث.','Local execution failed. Retry a template or use a newer browser.'],
}
export default function KnowledgeWorkspace({lang,personalGraph,hasProfile,onStudent,initialSearch=''}){
  const [tab,setTab]=useState('browse')
  const [search,setSearch]=useState(initialSearch)
  const [kind,setKind]=useState('all')
  const [selected,setSelected]=useState('urn:kamin:skill:database')
  const [scope,setScope]=useState('reference')
  const [allowPersonal,setAllowPersonal]=useState(false)
  const [template,setTemplate]=useState('requirements')
  const [query,setQuery]=useState(QUERY_TEMPLATES[0].query)
  const [result,setResult]=useState(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const running=useRef(null)
  const runId=useRef(0)
  const Arrow=lang==='ar'?ArrowLeft:ArrowRight
  const concepts=useMemo(()=>searchKnowledge(search,kind),[search,kind])
  const concept=concepts.find(c=>c.id===selected)||concepts[0]
  const edges=referenceEdges.filter(e=>e.subject===concept?.id||e.object===concept?.id)
  const invalidate=()=>{runId.current++;running.current?.cancel();running.current=null;setBusy(false);setResult(null);setError('')}
  useEffect(()=>()=>{runId.current++;running.current?.cancel()},[])
  useEffect(()=>{invalidate();setAllowPersonal(false);setScope('reference')},[personalGraph])
  const run=async()=>{
    invalidate()
    const id=runId.current
    try{
      const dataset=buildWorkspaceDataset(scope,{personalGraph,allowPersonal})
      setBusy(true)
      running.current=startLocalQuery(dataset,query)
      const answer=await running.current.promise
      if(id===runId.current) setResult({...answer,scope})
    }catch(e){if(id===runId.current) setError(e.message)}
    finally{if(id===runId.current){setBusy(false);running.current=null}}
  }
  const chooseConcept=id=>{setSearch('');setKind('all');setSelected(id);setTab('browse')}
  const changeScope=value=>{invalidate();setScope(value);if(value!=='personal')setAllowPersonal(false)}
  const download=()=>{
    const data=JSON.stringify({scope:result.scope,query,result,knowledgeVersion:KNOWLEDGE_VERSION},null,2)
    const url=URL.createObjectURL(new Blob([data],{type:'application/json'}))
    const a=document.createElement('a');a.href=url;a.download='kamin-query-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <div className="knowledge-workspace">
    <div className="knowledge-heading"><div><small><Network size={17}/>{tr(lang,'المعرفة خلف التوصية','THE KNOWLEDGE BEHIND THE GUIDANCE')}</small><h2>{tr(lang,'مستكشف المعرفة','Knowledge explorer')}</h2><p>{tr(lang,'افهم المفاهيم والعلاقات، وافحصها بنفسك. يمكنك استخدام كامن دون هذه الأدوات المتقدمة.','Explore concepts and relationships. These advanced tools are optional when using Kamin.')}</p></div><button className="button secondary" onClick={onStudent}>{tr(lang,'العودة إلى ملفي','Back to my profile')}<Arrow size={17}/></button></div>
    <div className="knowledge-tabs" role="tablist" aria-label={tr(lang,'أدوات المعرفة','Knowledge tools')}>{[['browse',Network,tr(lang,'المفاهيم والعلاقات','Concepts & connections')],['query',Terminal,tr(lang,'مختبر SPARQL','SPARQL lab')]].map(([id,Icon,label],i)=><button key={id} id={`knowledge-tab-${id}`} role="tab" aria-selected={tab===id} aria-controls={`knowledge-panel-${id}`} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'browse':e.key==='End'?'query':i===0?'query':'browse';setTab(next);document.getElementById(`knowledge-tab-${next}`)?.focus()}}}><Icon size={18}/>{label}</button>)}</div>
    <section id="knowledge-panel-browse" role="tabpanel" aria-labelledby="knowledge-tab-browse" hidden={tab!=='browse'}>
      <div className="knowledge-search"><label><Search size={18}/><span>{tr(lang,'ابحث عن قدرة أو اهتمام أو مسار','Search capabilities, interests or pathways')}</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr(lang,'مثل: قواعد البيانات أو SQL','Try databases or SQL')}/></label><label><span>{tr(lang,'نوع المفهوم','Concept type')}</span><select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">{tr(lang,'الكل','All')}</option><option value="skill">{tr(lang,'قدرات','Capabilities')}</option><option value="interest">{tr(lang,'اهتمامات','Interests')}</option><option value="pathway">{tr(lang,'مسارات','Pathways')}</option></select></label></div>
      <p className="knowledge-count" role="status">{concepts.length} {tr(lang,'مفهوم في الكتالوج التجريبي · البحث لا يشمل أشخاصًا','concepts in the pilot catalog · no person search')}</p>
      <div className="knowledge-layout"><div className="knowledge-concepts" aria-label={tr(lang,'نتائج المفاهيم','Concept results')}>{concepts.length?concepts.map(c=>{const Icon={skill:BookOpen,interest:Compass,pathway:Route}[c.kind];return <button key={c.id} aria-pressed={concept?.id===c.id} onClick={()=>setSelected(c.id)}><Icon size={18}/><span>{c.label[lang]}</span><Arrow size={15}/></button>}):<p>{tr(lang,'لا يوجد تطابق. جرّب كلمة أقصر أو اختر «الكل».','No match. Try a shorter term or select All.')}</p>}</div>
        {concept&&<article className="knowledge-detail" aria-live="polite"><span className="knowledge-badge">{tr(lang,'معرفة مرجعية · ليست بيانات طالب','Reference knowledge · not student data')}</span><h3>{concept.label[lang]}</h3><p>{concept.definition[lang]}</p><code dir="ltr">{concept.id}</code><h4>{tr(lang,'علاقات يمكنك تتبعها','Connections you can follow')}</h4>{edges.length?<ul>{edges.map((edge,i)=>{const other=edge.subject===concept.id?edge.object:edge.subject;return <li key={`${other}-${i}`}><span>{edge.subject===concept.id?concept.label[lang]:knowledgeLabel(other,lang)} <strong>{relationLabel(edge.predicate,lang)}</strong> {edge.object===concept.id?concept.label[lang]:knowledgeLabel(other,lang)}</span><button className="text-button" onClick={()=>chooseConcept(other)} disabled={!knowledgeConcepts.some(c=>c.id===other)}>{tr(lang,'افتح المفهوم المرتبط','Open related concept')}<Arrow size={15}/></button></li>})}</ul>:<p>{tr(lang,'لا توجد علاقة منشورة في هذا الكتالوج حتى الآن.','No relationship is published in this catalog yet.')}</p>}<details><summary>{tr(lang,'المصدر وحدود الدليل','Source and evidence limits')}</summary><p>{tr(lang,'هذه علاقات مرجعية مؤلفة في كتالوج كامن التجريبي؛ وليست تحققًا من مهارات طالب أو طلب السوق. العلاقات المستنتجة من الملف وأدلتها تظهر في «شبكتي ومساعدي».','These are authored relationships in Kamin’s pilot catalog, not verification of a student’s skills or market demand. Profile-derived relationships and evidence appear in My network & guide.')}</p><small>{KNOWLEDGE_VERSION}</small></details><button className="button secondary" onClick={()=>setTab('query')}><Terminal size={17}/>{tr(lang,'استعلم عن المعرفة','Query the knowledge')}</button></article>}
      </div>
    </section>
    <section id="knowledge-panel-query" role="tabpanel" aria-labelledby="knowledge-tab-query" hidden={tab!=='query'}>
      <div className="query-intro"><ShieldCheck size={22}/><p>{tr(lang,'استعلام حقيقي داخل متصفحك. اختر نطاق البيانات أولًا. لا توجد نقطة بحث عامة في ملفات الطلاب.','Real queries run inside your browser. Choose the dataset first. There is no public student-profile endpoint.')}</p></div>
      <div className="query-controls"><label>{tr(lang,'نطاق البيانات','Dataset scope')}<select value={scope} onChange={e=>changeScope(e.target.value)}><option value="reference">{tr(lang,'المعرفة المرجعية فقط','Reference knowledge only')}</option><option value="demo">{tr(lang,'مثال طالب وهمي + المعرفة','Synthetic student + knowledge')}</option><option value="personal" disabled={!hasProfile}>{tr(lang,'ملفي على هذا الجهاز','My profile on this device')}</option></select></label><label>{tr(lang,'ابدأ بسؤال جاهز','Start with a question')}<select value={template} onChange={e=>{invalidate();setTemplate(e.target.value);setQuery(QUERY_TEMPLATES.find(t=>t.id===e.target.value).query)}}>{QUERY_TEMPLATES.map(t=><option key={t.id} value={t.id}>{t.label[lang]}</option>)}</select></label></div>
      {scope==='personal'&&<label className="query-consent"><input type="checkbox" checked={allowPersonal} onChange={e=>{invalidate();setAllowPersonal(e.target.checked)}}/><span>{tr(lang,'أسمح بقراءة ملفي محليًا في هذه المساحة حتى أغادرها. لن يُرسل إلى خادم، ويمكنني إيقاف الإذن الآن.','Allow this workspace to read my profile locally until I leave. It is not sent to a server, and I can turn this permission off now.')}</span></label>}
      {scope==='demo'&&<p className="knowledge-badge">{tr(lang,'بيانات وهمية بالكامل؛ لا تدخل في ملفك.','Entirely synthetic data; nothing is added to your profile.')}</p>}
      <label className="query-editor-label" htmlFor="sparql-query">{tr(lang,'استعلام SPARQL — قابل للتعديل','SPARQL query — editable')}</label><textarea id="sparql-query" dir="ltr" spellCheck={false} maxLength={6000} value={query} onChange={e=>{invalidate();setQuery(e.target.value)}}/>
      <div className="query-actions"><button className="button primary" disabled={busy||(scope==='personal'&&!allowPersonal)} onClick={run}><Play size={17}/>{busy?tr(lang,'جارٍ التنفيذ محليًا…','Running locally…'):tr(lang,'شغّل الاستعلام','Run query')}</button>{busy&&<button className="button secondary" onClick={()=>{invalidate();setError('QUERY_CANCELLED')}}><X size={17}/>{tr(lang,'إلغاء','Cancel')}</button>}<small>{tr(lang,'SELECT / ASK · حتى 100 صف · حد التنفيذ 12 ثانية','SELECT / ASK · up to 100 rows · 12-second time limit')}</small></div>
      {error&&<p className="query-error" role="alert">{(errors[error]||errors.QUERY_FAILED)[lang==='ar'?0:1]}</p>}
      <div className="query-results" aria-live="polite">{result&&<><h3>{tr(lang,'نتيجة الاستعلام','Query result')}</h3><p>{tr(lang,'النطاق: ','Scope: ')}{result.scope==='reference'?tr(lang,'معرفة مرجعية','reference knowledge'):result.scope==='demo'?tr(lang,'مثال وهمي','synthetic example'):tr(lang,'ملفك المحلي','your local profile')}</p>{result.kind==='ask'?<p className="query-answer">{result.value?tr(lang,'نعم — يوجد تطابق مع السؤال.','Yes — the pattern has a match.'):tr(lang,'لا — لا يوجد تطابق في البيانات المحددة.','No — there is no match in this dataset.')}</p>:result.rows.length?<><p>{result.rows.length} {tr(lang,'صفًا','rows')}{result.truncated?tr(lang,' · عُرض أول 100 صف فقط؛ ضيّق السؤال لرؤية المزيد.',' · Showing the first 100 rows; narrow your query to see more.') : ''}</p><div className="query-table"><table><thead><tr>{result.columns.map(c=><th key={c} dir="ltr">?{c}</th>)}</tr></thead><tbody>{result.rows.map((row,i)=><tr key={i}>{result.columns.map(c=><td key={c}>{row[c]?<><span>{knowledgeLabel(row[c].value,lang)}</span><code dir="ltr">{row[c].value}</code></>:<span>—</span>}</td>)}</tr>)}</tbody></table></div></>:<p>{tr(lang,'لا توجد نتائج لهذا السؤال ضمن النطاق المحدد. أسئلة الملف تحتاج المثال الوهمي أو إذنك لملفك. غياب الدليل لا يعني غياب القدرة.','No results in this scope. Profile questions need the synthetic example or permission for your profile. Missing evidence does not mean missing ability.')}</p>}<button className="text-button" onClick={download}><Download size={16}/>{tr(lang,'تنزيل النتائج JSON','Download results as JSON')}</button>{result.scope==='personal'&&<small className="query-export-note">{tr(lang,'التنزيل يحتوي بيانات من ملفك بصيغة غير مشفّرة؛ احتفظ به في مكان آمن.','This download contains unencrypted profile results; keep it somewhere safe.')}</small>}</>}</div>
      <details className="query-help"><summary>{tr(lang,'كيف أقرأ النتائج؟','How do I read the results?')}</summary><p>{tr(lang,'reference = المعرفة المرجعية؛ profile-input = المعلومات التي لها مصدر؛ inferred = العلاقات المستنتجة؛ explanations = القواعد والأدلة. الاستعلام يقرأ الشبكة ولا يغيّر بياناتك أو أحكام الملاءمة.','reference = catalog knowledge; profile-input = sourced information; inferred = derived links; explanations = rules and evidence. Queries read the graph without changing your data or fit judgments.')}</p></details>
    </section>
  </div>
}

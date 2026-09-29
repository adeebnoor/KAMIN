import { useId, useMemo, useState } from 'react'
import { UserRound, UsersRound, Compass, Target, GraduationCap, BriefcaseBusiness, BookOpen, FolderKanban, Network, ArrowLeft, ArrowRight, Route, Focus } from 'lucide-react'
import { buildRelationshipNetwork } from '../network/relationships.js'
import { projectStateToPerson360 } from '../ontology/projector.js'
import { buildMatchingProfile, matchTargets } from '../matching/engine.js'
import { inferSkills } from '../utils/engine.js'
import { demoCourses } from '../data.js'
const tr=(lang,ar,en)=>lang==='ar'?ar:en
const icons={person:UserRound,peer:UsersRound,interest:Compass,goal:Target,evidence:BookOpen,skill:GraduationCap,job:BriefcaseBusiness,training:Route,project:FolderKanban}
const kinds={person:['طالب','Student'],peer:['شخص · وهمي','Person · synthetic'],interest:['اهتمام','Interest'],goal:['هدف','Goal'],evidence:['دليل أكاديمي','Academic evidence'],skill:['قدرة','Capability'],job:['مسار وظيفي','Career pathway'],training:['تعلم وتدريب','Learning & training'],project:['مشروع · وهمي','Project · synthetic']}
const sources={declared:['تصريح الطالب','Student declaration'],evidence:['دليل مُراجع','Reviewed evidence'],reference:['علاقة مرجعية','Catalog relationship'],inferred:['استنتاج بالقواعد','Rule-derived'],synthetic:['مثال وهمي','Synthetic example']}
const DEMO_STATE={approved:true,courses:demoCourses,goal:'data',consents:{insight:true},insight:{declaredPreferences:{careerInterest:'investigative'}}}
const fallbackState={approved:false,courses:[],consents:{}}
function curve(edge,from,to){
 if(edge.id==='inference')return `M ${from.x+78} ${from.y+20} C 260 344, 730 344, ${to.x-80} ${to.y+20}`
 if(edge.id==='peer-interest')return `M ${from.x-80} ${from.y} C 228 410, 228 70, ${to.x-80} ${to.y}`
 if(edge.id==='peer-project')return `M ${from.x+80} ${from.y+12} C 740 520, 995 80, ${to.x+80} ${to.y}`
 if(edge.id==='goal-fit')return `M ${from.x-25} ${from.y-38} C 780 7, 180 7, ${to.x+70} ${to.y-25}`
 const dx=to.x-from.x,dy=to.y-from.y
 const sx=from.x+(Math.abs(dx)>Math.abs(dy)?Math.sign(dx)*81:0),sy=from.y+(Math.abs(dx)>Math.abs(dy)?0:Math.sign(dy)*40)
 const tx=to.x-(Math.abs(dx)>Math.abs(dy)?Math.sign(dx)*85:0),ty=to.y-(Math.abs(dx)>Math.abs(dy)?0:Math.sign(dy)*44)
 return `M ${sx} ${sy} C ${(sx+tx)/2} ${sy}, ${(sx+tx)/2} ${ty}, ${tx} ${ty}`
}
export default function RelationshipNetwork({lang,state,match,demo=false,onKnowledge}){
 const uid=useId().replaceAll(':','')
 const [question,setQuestion]=useState('job'),[selected,setSelected]=useState('person'),[academic,setAcademic]=useState(true),[target,setTarget]=useState('job-data-analyst')
 const [tour,setTour]=useState(-1)
 const steps=[['person','job','ابدأ بالطالب','Start with the student','كل عقدة تمثل معلومة أو جهة مرتبطة. اختر الطالب لرؤية علاقاته.','Each node is information or a connected entity. Select the student to inspect links.'],['evidence','job','تتبّع الدليل','Trace the evidence','المقرر يربط الدراسة بقدرة وفق خريطة محددة؛ لا يكفي الاهتمام لإثبات المهارة.','A course connects to a capability through a defined mapping; an interest alone is not skill evidence.'],['job','job','افهم المسار','Understand the pathway','متطلبات المسار ترتبط بالقدرات، ويظهر ما تدعمه الأدلة وما يحتاج مراجعة.','Pathway requirements connect to capabilities, showing what evidence supports and what needs review.'],['training','learning','اختر خطوة تالية','Choose a next step','استكشف التعلم الذي يطوّر القدرة الناقصة، وافحص مصدر العلاقة قبل القرار.','Explore learning linked to missing capabilities and inspect the relationship source before deciding.']]
 const moveTour=i=>{setTour(i);if(i>=0){setSelected(steps[i][0]);setQuestion(steps[i][1])}}
 const context=useMemo(()=>demo?{...DEMO_STATE,approved:academic,courses:academic?demoCourses:[]}:state||fallbackState,[demo,academic,state])
 const matches=useMemo(()=>{if(match)return [match];const graph=projectStateToPerson360({state:context,skills:inferSkills(context.approved?context.courses:[])});return matchTargets(buildMatchingProfile({graph}),{type:'job',lang})},[context,match,lang])
 const current=match||matches.find(m=>m.id===target)||matches[0]
 const graph=useMemo(()=>buildRelationshipNetwork({state:context,match:current,demo}),[context,current,demo])
 const route=graph.routes[question],active=graph.nodes.find(n=>n.id===selected)||graph.nodes[0]
 const connected=graph.edges.filter(e=>e.from===active.id||e.to===active.id)
 const byId=Object.fromEntries(graph.nodes.map(n=>[n.id,n]))
 const Arrow=lang==='ar'?ArrowLeft:ArrowRight
 const choose=q=>{setQuestion(q);setSelected(q==='learning'?'training':q==='people'&&demo?'peer':q==='interests'?'interest':'person')}
 return <div className="relationship-network">
  <div className="relationship-heading"><div><span><Network size={19}/>{tr(lang,'شبكة تفتح مسارات، لا قائمة صفات','A NETWORK OF PATHS, NOT JUST ATTRIBUTES')}</span><h2>{tr(lang,'أشخاص. اهتمامات. قدرات. فرص.','People. Interests. Capabilities. Opportunities.')}</h2></div><small>{demo?tr(lang,'مثال تفاعلي · بيانات وهمية','Interactive demo · synthetic data'):tr(lang,'علاقات من ملفك والكتالوج المرجعي','Your profile + reference catalog')}</small></div>
  {demo&&<div className="network-tour">{tour<0?<button className="text-button" onClick={()=>moveTour(0)}>{tr(lang,'جولة في الشبكة — 4 خطوات','Take a network tour — 4 steps')}</button>:<><strong>{tour+1}/4 · {steps[tour][lang==='ar'?2:3]}</strong><p aria-live="polite">{steps[tour][lang==='ar'?4:5]}</p><div>{tour>0&&<button className="text-button" onClick={()=>moveTour(tour-1)}>{tr(lang,'السابق','Back')}</button>}<button className="text-button" onClick={()=>moveTour(tour===3?-1:tour+1)}>{tour===3?tr(lang,'إنهاء الجولة','Finish tour'):tr(lang,'التالي','Next')}</button><button className="text-button" onClick={()=>moveTour(-1)}>{tr(lang,'إغلاق الجولة','Close tour')}</button></div></>}</div>}
  <div className="relationship-questions" aria-label={tr(lang,'اختر سؤالًا لتتبّع العلاقات','Choose a relationship question')}>{Object.entries(graph.routes).map(([id,r])=><button key={id} aria-pressed={question===id} onClick={()=>choose(id)}>{id==='people'?<UsersRound size={17}/>:id==='interests'?<Compass size={17}/>:id==='learning'?<Route size={17}/>:<BriefcaseBusiness size={17}/>}<span>{r.title[lang]}</span></button>)}</div>
  {demo&&<div className="relationship-demo-controls"><label>{tr(lang,'جرّب مسارًا آخر','Try another pathway')}<select aria-label={tr(lang,'جرّب مسارًا آخر','Try another pathway')} value={current.id} onChange={e=>{setTarget(e.target.value);setSelected('job')}}>{matches.map(m=><option value={m.id} key={m.id}>{m.title[lang]}</option>)}</select></label><label><input type="checkbox" checked={academic} onChange={e=>setAcademic(e.target.checked)}/>{tr(lang,'تضمين دليل أكاديمي وهمي','Include synthetic coursework evidence')}</label></div>}
  <div className="relationship-map-scroll" role="region" aria-label={tr(lang,'شبكة العلاقات التفاعلية؛ يمكن تمريرها أفقيًا','Interactive relationship network; horizontally scrollable')} tabIndex={0}>
   <div className="relationship-map" dir="ltr">
    <svg viewBox="0 0 1000 480" preserveAspectRatio="none" aria-hidden="true"><defs>{Object.keys(sources).map(kind=><marker id={`${uid}-${kind}`} key={kind} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3.5 L0,7" className={`arrow-${kind}`}/></marker>)}</defs>{graph.edges.map(e=>{const on=route.edges.includes(e.id);return <g key={e.id} className={`relation-line relation-${e.kind} ${on?'is-route':''}`}><path d={curve(e,byId[e.from],byId[e.to])} markerEnd={`url(#${uid}-${e.kind})`}/>{on&&['mapping','requires','develops','interest-choice'].includes(e.id)&&<text x={(byId[e.from].x+byId[e.to].x)/2} y={(byId[e.from].y+byId[e.to].y)/2-12} textAnchor="middle" direction={lang==='ar'?'rtl':'ltr'}>{e.title[lang]}</text>}</g>})}</svg>
    {graph.nodes.map(n=>{const Icon=icons[n.kind];return <button key={n.id} className={`relationship-node relationship-${n.kind} ${route.nodes.includes(n.id)?'on-route':''} ${active.id===n.id?'is-selected':''}`} style={{left:`${n.x/10}%`,top:`${n.y/4.8}%`}} aria-pressed={active.id===n.id} onClick={()=>setSelected(n.id)} dir={lang==='ar'?'rtl':'ltr'}><Icon size={20}/><span><small>{kinds[n.kind][lang==='ar'?0:1]}</small><strong>{n.title[lang]}</strong></span></button>})}
   </div>
  </div>
  <p className="relationship-mobile-hint">{tr(lang,'حرّك الشبكة أفقيًا، أو تتبّع المسار المبسّط أدناه.','Scroll the network horizontally, or follow the readable path below.')}</p>
  <div className="relationship-legend">{Object.entries(sources).map(([kind,name])=><span key={kind}><i className={`key-${kind}`}/>{name[lang==='ar'?0:1]}</span>)}</div>
  <div className="relationship-inspector">
   <section className="relationship-path" aria-live="polite"><small><Route size={16}/>{tr(lang,'مسار الربط المختار','SELECTED CONNECTION PATH')}</small><h3>{route.title[lang]}</h3><div className="relationship-trail">{route.nodes.map((id,i)=><span key={id}>{i>0&&<Arrow size={16}/>}<button onClick={()=>setSelected(id)} aria-pressed={selected===id}>{byId[id].title[lang]}</button></span>)}</div><p>{route.explanation[lang]}</p>{!route.supported&&<strong className="relationship-limit">{tr(lang,'لم يُثبت رابط شخصي في هذا المسار','No supported personal connection in this path')}</strong>}<details><summary>{tr(lang,'افحص علاقات المسار ومصادرها','Inspect path relationships and sources')}</summary><ul>{route.edges.map(id=>{const e=graph.edges.find(e=>e.id===id);return <li key={id}><b>{byId[e.from].title[lang]} · {e.title[lang]} · {byId[e.to].title[lang]}</b><span>{e.source[lang]}</span></li>})}</ul></details></section>
   <section className="relationship-node-info" aria-live="polite"><small><Focus size={16}/>{tr(lang,'اختر أي عقدة لتكشف علاقاتها','SELECT ANY NODE TO INSPECT ITS LINKS')}</small><h3>{active.title[lang]}</h3><p>{active.detail[lang]}</p><div className="relationship-adjacent">{connected.map(e=>{const other=byId[e.from===active.id?e.to:e.from];return <button key={e.id} onClick={()=>setSelected(other.id)}><span>{byId[e.from].title[lang]} <b>{e.title[lang]}</b> {byId[e.to].title[lang]}</span><Arrow size={15}/></button>})}</div>{active.iri&&<details><summary>{tr(lang,'تفاصيل تقنية: معرّف العقدة','Technical details: node identifier')}</summary><code dir="ltr">{active.iri}</code></details>}</section>
  </div>
  <div className="relationship-footer"><span>{tr(lang,'الوظائف والتدريبات ملفات مرجعية. روابط الأشخاص والمشروعات في المثال توضيحية فقط.','Jobs and training are reference profiles. People and project links in the demo are illustrative only.')}</span>{onKnowledge&&<button className="text-button" onClick={onKnowledge}>{tr(lang,'افتح مستكشف RDF وSPARQL','Open the RDF & SPARQL explorer')}<Arrow size={16}/></button>}</div>
 </div>
}

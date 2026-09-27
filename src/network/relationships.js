import { skills } from '../data.js'
import { targetProfiles } from '../matching/targets.js'
import { DECLARED_PREFERENCE_SCHEMES } from '../insight.js'
import { copy } from '../i18n.js'
const label=(ar,en)=>({ar,en})
const skillName=id=>Object.values(skills).find(s=>s.id===id)?.labels||label(id,id)
export const RELATIONSHIP_VERSION='kamin-relationship-view-v1'
// A view of existing supported paths. This function never adds claims to a profile.
export function buildRelationshipNetwork({state={},match,demo=false}){
 const nodes=[],edges=[]
 const add=(id,kind,title,x,y,detail,iri=null)=>nodes.push({id,kind,title,x,y,detail,iri})
 const link=(id,from,to,title,kind,source)=>edges.push({id,from,to,title,kind,source})
 const catalog=label('كتالوج كامن التجريبي؛ ليس إعلان فرصة حقيقية.','Kamin pilot catalog; not a live opportunity.')
 const declared=label('اختيار صرّح به الطالب؛ قابل للتعديل.','A student declaration that can be changed.')
 const evidence=label('سجل راجعه الطالب وخريطة مقررات تجريبية؛ المراجعة لا تعني توثيقًا من الجامعة.','Student-reviewed record and pilot course map; review is not institutional verification.')
 const synthetic=label('علاقة مؤلفة في مثال وهمي فقط؛ ليست بيانات أشخاص حقيقيين أو تواصلًا معهم.','An authored synthetic example only; no real person data or contact.')
 const target=match||targetProfiles.find(t=>t.id==='job-data-analyst')
 const paths=state.approved?(match?.semanticPaths||[]).filter(p=>p.kind==='capability-match'&&p.status==='supported'):[]
 const path=paths[0]
 const required=target.requiredSkills||[]
 const first=path?.capabilityKey||required[0]
 const next=(target.missingSkills||[]).find(s=>s!==first)||required.find(s=>s!==first)||first
 const training=targetProfiles.find(t=>t.type==='training'&&t.teachesSkills?.includes(next))
 const pref=state.consents?.insight?state.insight?.declaredPreferences?.careerInterest:null
 const interest=DECLARED_PREFERENCE_SCHEMES.careerInterest.options.find(o=>o.id===pref)
 const interestFit=(match?.inferences||[]).find(i=>i.ruleId==='R3'&&i.scheme==='careerInterest')
 const goal=state.goal
 add('person','person',demo?label('سارة · الحاسبات','Sara · Computing'):label('أنت','You'),100,240,label('هذه نقطة انطلاق المسارات، وليست درجة أو حكمًا على الشخص.','The starting point for connections, not a score or judgment about a person.'))
 add('goal','goal',goal?label(copy.ar.app.goals[goal],copy.en.app.goals[goal]):label('هدف لم تحدده بعد','Goal not set'),100,70,declared,goal?`urn:kamin:goal:${goal}`:null)
 add('interest','interest',interest?.label||label('اهتمام لم تحدده بعد','Interest not set'),350,70,declared,interestFit?.premises?.[0]?.object||null)
 add('record','evidence',path?label(path.courseCode,path.courseCode):label('دليل غير متاح','Evidence unavailable'),350,240,evidence,path?.courseId)
 if(first)add('skill','skill',skillName(first),605,240,label('قدرة يطلبها المسار. اتصالها بسجل يعتمد على وجود دليل فعلي في الملف.','A pathway requirement. Its connection to coursework depends on evidence actually present in the profile.'),`urn:kamin:skill:${first}`)
 if(next&&next!==first)add('next','skill',skillName(next),605,410,label('متطلب آخر يوضح اتساع المسار. التدريب المرتبط فرصة تطوير، ولا يثبت اكتساب القدرة.','Another requirement shows the pathway’s breadth. Related training is a development option, not proof of capability.'),`urn:kamin:skill:${next}`)
 add('job',target.type==='training'?'training':'job',target.title,870,240,catalog,`urn:kamin:target:${target.id}`)
 if(training)add('training','training',training.title,870,410,catalog,`urn:kamin:target:${training.id}`)
 if(goal)link('goal-choice','person','goal',label('يختار هدفًا','declares goal'),'declared',declared)
 if(interest)link('interest-choice','person','interest',label('يصرّح باهتمام','declares interest'),'declared',declared)
 if(path){
  link('reviewed','person','record',label('راجع المقرر','reviewed course'),'evidence',evidence)
  link('mapping','record','skill',label('يدعم دليلًا على','supports evidence for'),'evidence',evidence)
 }
 if(first)link('requires','job','skill',label('يتطلب قدرة','requires capability'),'reference',catalog)
 if(next&&next!==first)link('requires-next','job','next',label('يتطلب أيضًا','also requires'),'reference',catalog)
 if(training)link('develops','training',next===first?'skill':'next',label('يطوّر قدرة','develops capability'),'reference',catalog)
 if(interest&&interestFit)link('interest-fit','job','interest',label('يرتبط بهذا الاهتمام','fits this interest'),'reference',catalog)
 if(goal&&(match?.inferences||[]).some(i=>i.ruleId==='R2'))link('goal-fit','job','goal',label('يدعم الهدف','supports goal'),'reference',catalog)
 const supported=(match?.inferences||[]).find(i=>i.ruleId==='R1')
 if(path&&supported)link('inference','person','job',label('دليل على متطلب · R1','requirement evidence · R1'),'inferred',label(`${supported.ruleId} · ${supported.ruleVersion}؛ نتيجة مشتقة من السجل والخريطة والمتطلب؛ لا تعني الجاهزية الكاملة.`,`${supported.ruleId} · ${supported.ruleVersion}; derived from record, mapping and requirement, not overall readiness.`))
 if(demo){
  add('peer','peer',label('عمر · إدارة الأعمال','Omar · Business'),350,410,synthetic,'urn:kamin:demo:person:omar')
  add('project','project',label('مشروع لوحة بيانات','Dashboard project'),870,70,synthetic,'urn:kamin:demo:project:dashboard')
  if(interest)link('peer-interest','peer','interest',label('اهتمام مشترك','shared interest'),'synthetic',synthetic)
  link('peer-project','peer','project',label('يشارك في','participates in'),'synthetic',synthetic)
  if(first)link('project-skill','project','skill',label('يحتاج قدرة','needs capability'),'synthetic',synthetic)
  if(next&&next!==first)link('peer-skill','peer','next',label('يصرّح بقدرة','declares capability'),'synthetic',synthetic)
 }
 const requirementNode=next===first?'skill':'next'
 const routes={
  job:{nodes:path?['person','record','skill','job']:['skill','job'],edges:path?['reviewed','mapping','requires','inference']:['requires'],supported:!!path,title:label('كيف يرتبط المسار بأدلتي؟','How does this pathway connect to my evidence?'),explanation:path?label('مقرر راجعته ← قدرة مرتبطة به ← متطلب في المسار. القاعدة R1 تستنتج رابطًا بينك وبين هذا المتطلب.','Reviewed course → linked capability → pathway requirement. Rule R1 derives a connection to this requirement.'):label('المتطلب ظاهر، لكن لا يوجد مسار دليل من ملفك إليه. لا نصل الفراغ بعلاقة مخمّنة.','The requirement is visible, but there is no evidence path from your profile. No link is invented to fill the gap.')},
  interests:{nodes:interestFit?['person','interest','job']:interest?['person','interest']:[],edges:['interest-choice','interest-fit'],supported:edges.some(e=>e.id==='interest-fit'),title:label('أين تقودني اهتماماتي؟','Where can my interests lead?'),explanation:interestFit?label('اختيار الطالب ووصف المسار يلتقيان في اهتمام مشترك. هذا سياق للاستكشاف، ولا يتحول إلى مهارة مثبتة.','A student choice and a pathway description meet at a shared interest. This is exploration context, not proven skill.'):label('لا توجد علاقة منشورة بين اهتمامك وهذا المسار في الكتالوج الحالي. يمكنك استكشاف مسار آخر؛ الاهتمام لا يثبت المهارة.','No catalog relationship connects your interest to this pathway. Explore another pathway; an interest does not prove capability.')},
  people:{nodes:demo&&interest?['person','interest','peer','project','skill']:[],edges:demo&&interest?['interest-choice','peer-interest','peer-project','project-skill']:[],supported:demo&&!!interest,title:label('مع من يمكنني التعاون؟','Who could I collaborate with?'),explanation:demo?path?label('سارة وعمر يشتركان في اهتمام؛ عمر يشارك في مشروع يحتاج قدرة مرتبطة بدراسة سارة. مثال متعدد العلاقات لشرح فرصة تعاون، وليس ترشيحًا لشخص حقيقي.','Sara and Omar share an interest; Omar participates in a project needing a capability linked to Sara’s coursework. A multi-hop collaboration example, not a real person recommendation.'):label('عمر ومشروعه مثال وهمي لشرح الربط عبر الاهتمامات. لا يوجد هنا دليل أكاديمي يربط سارة بقدرة المشروع، وليس ترشيحًا لشخص حقيقي.','Omar and his project are synthetic examples of interest-based connections. There is no coursework evidence linking Sara to the project capability here; this is not a real person recommendation.'):label('ملفك خاص. لم نضف أشخاصًا أو نستنتج علاقات اجتماعية عنك. المطابقة مع أشخاص حقيقيين تحتاج خدمة مشاركة اختيارية منفصلة، ولم تُفعّل بعد.','Your profile is private. No people or social relationships have been added. Real person matching needs a separate opt-in sharing service and is not enabled yet.')},
  learning:{nodes:training?['job',requirementNode,'training']:['job'],edges:training?[next===first?'requires':'requires-next','develops']:[],supported:!!training,title:label('ما خطوة التعلم المرتبطة؟','What learning step connects?'),explanation:training?label('المسار والتدريب يلتقيان في قدرة واحدة. افحص المتطلبات قبل الاختيار؛ ظهور التدريب لا يعني إكماله أو اكتساب القدرة.','The pathway and training meet at a shared capability. Check prerequisites; displaying training does not mean completion or mastery.'):label('لا يوجد تدريب مرتبط منشور لهذا المتطلب في الكتالوج الحالي.','No linked training is published for this requirement in the current catalog.')},
 }
 for(const route of Object.values(routes)){route.nodes=route.nodes.filter(id=>nodes.some(n=>n.id===id));route.edges=route.edges.filter(id=>edges.some(e=>e.id===id))}
 return {nodes,edges,routes,version:RELATIONSHIP_VERSION}
}

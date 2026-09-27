import { skills, courseSkillMap, demoCourses } from '../data.js'
import { targetProfiles, TARGET_CATALOG_VERSION } from '../matching/targets.js'
import { buildTargetSemanticGraph } from '../matching/graph.js'
import { buildMatchingProfile, matchTargets } from '../matching/engine.js'
import { projectStateToPerson360 } from '../ontology/projector.js'
import { buildInferenceDataset } from '../ontology/rdf.js'
import { JSON_LD_CONTEXT } from '../ontology/registry.js'
import { inferSkills } from '../utils/engine.js'
import { DIGITAL_TOPICS, DIGITAL_METHOD, DIGITAL_NOTICE } from '../digitalInterests.js'

export const KNOWLEDGE_VERSION = `${TARGET_CATALOG_VERSION} · 2026-09-27`
const ref = id => ({'@id':id})
const targetGraphs = targetProfiles.map(buildTargetSemanticGraph)
export const knowledgeConcepts = [
  ...Object.values(skills).map(s=>({id:`urn:kamin:skill:${s.id}`,kind:'skill',label:s.labels,definition:{ar:'قدرة مرجعية مرتبطة بأدلة مقررات ومتطلبات مسارات. وجود علاقة أكاديمية لا يثبت الجاهزية المهنية.',en:'A reference capability connected to course evidence and pathway requirements. Academic links do not establish professional readiness.'}})),
  ...DIGITAL_TOPICS.map(t=>({id:`urn:kamin:topic:${t.id}`,kind:'interest',label:t.label,definition:{ar:'موضوع يختار الطالب استكشافه. الاهتمام به يضيف سياقًا ولا يثبت إتقان مهارة.',en:'A topic a student chooses to explore. Interest adds context and does not prove skill mastery.'}})),
  ...targetProfiles.map(t=>({id:`urn:kamin:target:${t.id}`,kind:'pathway',label:t.title,definition:{ar:'مسار من الكتالوج التجريبي لشرح المتطلبات والعلاقات؛ ليس فرصة متاحة أو ضمان قبول.',en:'A pilot catalog pathway for exploring requirements and connections; not a live opening or admission guarantee.'}})),
]
export const referenceEdges = targetGraphs.flatMap(g=>g.edges).filter(e=>['kamin:requiresCapability','kamin:developsCapability','kamin:relatesToTopic'].includes(e.predicate))
export const knowledgeLabel=(id,lang)=>knowledgeConcepts.find(c=>c.id===id)?.label[lang]||id.replace('urn:kamin:','')
export function searchKnowledge(text='',kind='all'){
  const normalize=s=>s.toLowerCase().normalize('NFKC').replace(/[أإآ]/g,'ا').replace(/[\u064b-\u065f]/g,'')
  const tokens=normalize(text.trim()).split(/\s+/).filter(Boolean)
  return knowledgeConcepts.filter(c=>(kind==='all'||c.kind===kind)&&tokens.every(t=>normalize(`${c.id} ${c.label.ar} ${c.label.en}`).includes(t)))
}
export function buildReferenceDataset(){
  const nodes=targetGraphs.flatMap(g=>[...g.entities,...g.edges.map(e=>({'@id':e.subject,[e.predicate]:ref(e.object)}))])
  for(const [code,mapping] of Object.entries(courseSkillMap)) nodes.push({'@id':`urn:kamin:course:${code}`,'@type':'Course',code,'kamin:mapsToCapability':mapping.skills.map(s=>ref(`urn:kamin:skill:${s}`))})
  return {'@context':JSON_LD_CONTEXT,'@graph':[{'@id':'urn:kamin:graph:reference','@graph':nodes}]}
}
export function buildSyntheticGraph(){
  const date='2026-09-27T00:00:00.000Z'
  const state={approved:true,courses:demoCourses,goal:'data',consents:{insight:true},insight:{declaredPreferences:{careerInterest:'investigative'},digitalInterests:{noticeVersion:DIGITAL_NOTICE,analysisConsent:true,contextConsent:true,grantedAt:date,confirmed:[{topicId:'data',matchedTerms:['sql'],methodVersion:DIGITAL_METHOD,confirmedAt:date}]}}}
  return projectStateToPerson360({state,skills:inferSkills(demoCourses)})
}
export function buildWorkspaceDataset(scope,{personalGraph=null,allowPersonal=false}={}){
  const reference=buildReferenceDataset()
  if(scope==='reference') return reference
  if(!['demo','personal'].includes(scope)) throw new Error('INVALID_SCOPE')
  if(scope==='personal'&&(!allowPersonal||!personalGraph)) throw new Error('PERSONAL_CONSENT_REQUIRED')
  const graph=scope==='demo'?buildSyntheticGraph():personalGraph
  const matches=matchTargets(buildMatchingProfile({graph}))
  const groups=new Map(reference['@graph'].map(g=>[g['@id'],g['@graph']]))
  for(const match of matches){
    for(const group of buildInferenceDataset(graph,match)['@graph']){
      if(group['@id']==='urn:kamin:graph:reference') continue
      if(group['@id']==='urn:kamin:graph:profile-input'&&groups.has(group['@id'])) continue
      groups.set(group['@id'],[...(groups.get(group['@id'])||[]),...group['@graph']])
    }
  }
  return {'@context':JSON_LD_CONTEXT,'@graph':[...groups].map(([id,nodes])=>({'@id':id,'@graph':nodes}))}
}
export const QUERY_TEMPLATES = [
  {id:'requirements',label:{ar:'ما القدرات التي يتطلبها كل مسار؟',en:'Which capabilities does each pathway require?'},query:`PREFIX k: <urn:kamin:>
SELECT DISTINCT ?pathway ?capability WHERE {
  GRAPH <urn:kamin:graph:reference> {
    ?pathway k:requiresCapability ?capability .
  }
}
LIMIT 50`},
  {id:'interests',label:{ar:'ما المسارات المرتبطة بالاهتمامات؟',en:'Which pathways relate to each interest?'},query:`PREFIX k: <urn:kamin:>
SELECT DISTINCT ?topic ?pathway WHERE {
  GRAPH <urn:kamin:graph:reference> {
    ?pathway k:relatesToTopic ?topic .
  }
}
LIMIT 50`},
  {id:'inferred',label:{ar:'ما العلاقات المستنتجة في الملف؟',en:'Which relationships were inferred for the profile?'},query:`SELECT DISTINCT ?person ?relation ?pathway WHERE {
  GRAPH <urn:kamin:graph:inferred> {
    ?person ?relation ?pathway .
  }
}
LIMIT 50`},
  {id:'evidence',label:{ar:'ما مصدر كل معلومة في الملف؟',en:'What evidence supports each profile claim?'},query:`PREFIX k: <urn:kamin:>
PREFIX prov: <http://www.w3.org/ns/prov#>
SELECT ?relation ?object ?evidence WHERE {
  GRAPH <urn:kamin:graph:profile-input> {
    ?claim k:predicate ?relation ; k:object ?object ;
           prov:wasDerivedFrom ?evidence .
  }
}
LIMIT 50`},
]

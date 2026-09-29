import {targetProfiles} from '../matching/targets.js'
import {skills} from '../data.js'
export const semanticCatalog=targetProfiles.flatMap(target=>['ar','en'].map(lang=>({
 id:target.id,lang,text:[target.title[lang],target.outcome[lang],...[...(target.requiredSkills||[]),...(target.teachesSkills||[])].map(id=>skills[id]?.labels?.[lang]||id)].join('. '),
})))
export function rankSemanticCandidates(vector,index,{limit=3,minScore=.25}={}){
 if(!Array.isArray(vector)||vector.length!==384||vector.some(n=>!Number.isFinite(n)))throw new Error('INVALID_EMBEDDING')
 const known=new Set(targetProfiles.map(t=>t.id)),scores=new Map()
 for(const item of index){
  if(!known.has(item.id)||!Array.isArray(item.vector)||item.vector.length!==384||item.vector.some(n=>!Number.isFinite(n)))throw new Error('INVALID_SEMANTIC_INDEX')
  const dot=vector.reduce((sum,n,i)=>sum+n*item.vector[i],0)
  const denominator=Math.hypot(...vector)*Math.hypot(...item.vector)
  const score=denominator?dot/denominator:0
  scores.set(item.id,Math.max(scores.get(item.id)??-1,score))
 }
 return [...scores].map(([id,score])=>({id,score})).filter(r=>r.score>=minScore).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,limit)
}

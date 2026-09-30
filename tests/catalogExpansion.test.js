import {describe,it,expect} from 'vitest'
import {catalogExtension} from '../src/matching/catalogExtension.js'
import {targetProfiles} from '../src/matching/targets.js'
import {demoCourses,courseSkillMap} from '../src/data.js'
import {inferSkills} from '../src/utils/engine.js'
import {buildMatchingProfile,matchTargets} from '../src/matching/engine.js'
import {buildSyntheticGraph} from '../src/knowledge/workspace.js'
import {buildDevelopmentPlan} from '../src/components/DecisionStudio.jsx'
describe('catalog expansion preserves evidence boundaries',()=>{
 it.each(['ar','en'])('explains specialist gaps and development steps with readable %s names',lang=>{
  const expected=[
   ['db-operations',{ar:'تشغيل قواعد البيانات واستعادتها',en:'Database operations and recovery'}],
   ['web-development',{ar:'تطوير واجهات الويب',en:'Web interface development'}],
   ['systems-analysis',{ar:'تحليل النظم وسير العمل',en:'Systems and workflow analysis'}],
  ]
  for(const profile of [buildMatchingProfile({graph:buildSyntheticGraph()}),buildMatchingProfile({skills:inferSkills(demoCourses)})]){
   const matches=matchTargets(profile,{lang})
   for(const [id,labels] of expected){
    const job=catalogExtension.find(entry=>entry.type==='job'&&entry.requiredSkills.includes(id))
    const match=matches.find(entry=>entry.id===job.id)
    expect(match.missingSkills).toContain(id)
    expect(match.judgment).not.toBe('fits')
    const explanation=match.limitingMechanisms.join(' ')
    expect(explanation).toContain(labels[lang])
    expect(explanation).not.toContain(id)
    const plan=buildDevelopmentPlan(match,lang).map(step=>step.action).join(' ')
    expect(plan).toContain(labels[lang])
    expect(plan).not.toContain(id)
   }
  }
 })
 it('does not grant specialist capabilities from existing coursework',()=>{
  const capabilities=inferSkills(demoCourses).map(x=>x.id)
  for(const id of ['testing','db-operations','web-development','systems-analysis']){
   expect(capabilities).not.toContain(id)
   expect(Object.values(courseSkillMap).some(x=>x.skills.includes(id))).toBe(false)
  }
  const matches=matchTargets(buildMatchingProfile({graph:buildSyntheticGraph()}))
  for(const job of catalogExtension.filter(x=>x.type==='job')){
   const match=matches.find(x=>x.id===job.id)
   expect(match.missingSkills.length).toBeGreaterThan(0)
   expect(match.judgment).not.toBe('fits')
  }
 })
 it('keeps external context separate from provisional mappings and training proposals',()=>{
  for(const entry of catalogExtension){
   const target=targetProfiles.find(x=>x.id===entry.id)
   expect(target.source.checked).toBe('2026-09-30')
   expect(target.mappingStatus).toBe('pilot-authoring-not-institution-verified')
   if(entry.type==='job'){
    expect(target.source.scope).toBe('occupation-context-only')
    expect(target.source.url).toContain('https://www.onetonline.org/link/summary/')
    expect(target.occupationCodes.ssco).toBeNull()
   } else expect(target.source.scope).toBe('pilot-design')
  }
 })
})

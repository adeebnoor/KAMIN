import {describe,it,expect} from 'vitest'
import {buildRelationshipNetwork} from '../src/network/relationships.js'
import {demoCourses} from '../src/data.js'
import {inferSkills} from '../src/utils/engine.js'
import {projectStateToPerson360} from '../src/ontology/projector.js'
import {buildMatchingProfile,matchTargets} from '../src/matching/engine.js'
function graph({approved=true,interest='investigative',demo=false,target='job-data-analyst'}={}){
 const state={approved,courses:approved?demoCourses:[],goal:'data',consents:{insight:true},insight:{declaredPreferences:{careerInterest:interest}}}
 const source=projectStateToPerson360({state,skills:inferSkills(state.courses)})
 const match=matchTargets(buildMatchingProfile({graph:source}),{lang:'ar'}).find(m=>m.id===target)
 const before=JSON.stringify(state)
 const result=buildRelationshipNetwork({state,match,demo})
 expect(JSON.stringify(state)).toBe(before)
 return result
}
describe('sourced relationship map',()=>{
 it('uses supported academic paths and records source on every edge',()=>{
  const g=graph();expect(g.routes.job.supported).toBe(true);expect(g.edges.find(e=>e.id==='inference').source.en).toContain('R1')
  for(const e of g.edges){expect(g.nodes.some(n=>n.id===e.from)).toBe(true);expect(g.nodes.some(n=>n.id===e.to)).toBe(true);expect(e.source.ar).toBeTruthy()}
 })
 it('withdrawal removes academic evidence and inferred readiness links',()=>{
  const g=graph({approved:false});expect(g.routes.job.supported).toBe(false)
  expect(g.edges.filter(e=>['evidence','inferred'].includes(e.kind))).toEqual([])
  expect(g.edges.some(e=>e.id==='interest-fit')).toBe(true)
  expect(g.routes.job.nodes).not.toContain('person')
  expect(graph({approved:false,demo:true}).routes.people.explanation.en).toContain('no coursework evidence')
 })
 it('never creates real person relationships in a personal profile',()=>{
  const personal=graph(),demo=graph({demo:true})
  expect(personal.nodes.some(n=>n.kind==='peer'||n.kind==='project')).toBe(false)
  expect(personal.routes.people.supported).toBe(false)
  expect(demo.routes.people.nodes).toEqual(['person','interest','peer','project','skill'])
  expect(demo.edges.filter(e=>e.from==='peer'||e.from==='project').every(e=>e.kind==='synthetic')).toBe(true)
 })
 it('does not manufacture an interest link when preference is absent or incompatible',()=>{
  for(const interest of ['', 'artistic']) { const g=graph({interest});expect(g.routes.interests.supported).toBe(false);expect(g.routes.interests.nodes).not.toContain('job') }
 })
 it('learning route uses shared capability and stays empty when no matching training exists',()=>{
  const g=graph();expect(g.edges.find(e=>e.id==='develops').to).toBe('next')
  const cyber=graph({target:'job-cyber-analyst'});expect(cyber.routes.job.supported).toBe(false)
  expect(cyber.nodes.find(n=>n.id==='job').title.ar).toContain('سيبراني')
 })
})

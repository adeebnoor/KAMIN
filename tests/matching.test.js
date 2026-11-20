import { describe, expect, it } from 'vitest'
import { MATCH_GROUPS, groupOf, groupMatches, matchReason } from '../src/utils/matchReason.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { emptyInsightState, setDeclaredPreference } from '../src/insight.js'

describe('explainable matching engine', () => {
  it('treats academic skill evidence as the primary capability signal', () => {
    const profile=buildMatchingProfile({
      skills:[{id:'requirements'},{id:'project'}],
      goal:'management',
      insight:{declaredPreferences:{careerInterest:'enterprising',workValue:'achievement',workStructure:'structured',collaboration:'small-team'}},
    })
    const matches=matchTargets(profile,{lang:'en'})
    const project=matches.find(x=>x.id==='job-project-coordinator')
    expect(project.judgment).toBe('fits')
    expect(project.supportingMechanisms.join(' ')).toMatch(/core required skills|aligns with your selected goal/i)
    expect(project.calibrationStatus).toBe('rule-based-uncalibrated')
  })

  it('never lets preference alignment erase a missing required skill', () => {
    const profile=buildMatchingProfile({
      skills:[],
      goal:'data',
      insight:{declaredPreferences:{careerInterest:'investigative',workValue:'achievement',workStructure:'structured'}},
    })
    const matches=matchTargets(profile,{lang:'en'})
    const data=matches.find(x=>x.id==='job-data-analyst')
    expect(data.judgment).toBe('conditional')
    expect(data.missingSkills).toEqual(expect.arrayContaining(['database','statistics']))
    expect(data.supportingMechanisms.join(' ')).toMatch(/interest|goal/i)
  })

  it('keeps out-of-goal opportunities exploratory rather than calling them unsuitable', () => {
    const profile=buildMatchingProfile({
      skills:[{id:'software'}],
      goal:'management',
      insight:{declaredPreferences:{careerInterest:'investigative'}},
    })
    const matches=matchTargets(profile,{lang:'en'})
    const software=matches.find(x=>x.id==='job-software-engineer')
    expect(software.judgment).toBe('exploratory')
    expect(software.limitingMechanisms.join(' ')).toMatch(/outside your current goal/i)
  })

  it('allows training with no hard academic prerequisite to remain accessible', () => {
    const profile=buildMatchingProfile({skills:[],goal:'data',insight:{declaredPreferences:{careerInterest:'investigative'}}})
    const matches=matchTargets(profile,{type:'training',lang:'en'})
    const ai=matches.find(x=>x.id==='training-ai-work')
    expect(ai.judgment).toBe('fits')
    expect(ai.hardGates).toHaveLength(0)
  })
})


describe('Person360 graph-native matching', () => {
  it('traces approved course evidence through capability nodes into a job requirement', () => {
    let insight=emptyInsightState()
    insight=setDeclaredPreference(insight,'careerInterest','investigative')
    insight=setDeclaredPreference(insight,'workStructure','structured')
    const state={
      courses:[
        {code:'CPIT-240',name:'Database (I)',grade:'A',source:'pdf'},
        {code:'STAT-110',name:'Statistics',grade:'B+',source:'pdf'},
      ],
      goal:'data',
      insight,
    }
    const skills=[
      {id:'database',labels:{ar:'قواعد البيانات',en:'Databases'},confidenceLabel:'high',evidence:[{code:'CPIT-240'}]},
      {id:'statistics',labels:{ar:'التحليل الكمي',en:'Quantitative analysis'},confidenceLabel:'medium',evidence:[{code:'STAT-110'}]},
    ]
    const graph=projectStateToPerson360({state,skills,educationClassification:{primary:null}})
    const profile=buildMatchingProfile({graph})
    const data=matchTargets(profile,{lang:'en'}).find(x=>x.id==='job-data-analyst')

    expect(profile.mode).toBe('person360-graph')
    expect(data.judgment).toBe('fits')
    expect(data.decisionBasis).toBe('person360-semantic-graph')
    expect(data.ruleVersion).toBe('kamin-graph-fit-v1')
    expect(data.graphTrace.evidencePathCount).toBe(2)
    expect(data.semanticPaths.filter(path=>path.kind==='capability-match').map(path=>path.courseCode))
      .toEqual(expect.arrayContaining(['CPIT-240','STAT-110']))
    expect(data.semanticPaths.some(path=>path.relationChain.some(edge=>edge.predicate==='kamin:requiresCapability'))).toBe(true)
    expect(data.knowledgeInsights.externalOccupations.map(x=>x.notation)).toEqual(expect.arrayContaining(['2511.3','15-2051.01']))
    expect(data.knowledgeInsights.developmentGaps.map(x=>x.capabilityKey)).toEqual(expect.arrayContaining(['sql','python','power-bi']))
    expect(data.knowledgeInsights.bridges.map(x=>x.targetId)).toEqual(expect.arrayContaining(['training-python-analytics','training-bi-dashboard']))
    expect(data.judgment).toBe('fits')
  })

  it('does not treat a competency entity as evidence unless a demonstrates claim reaches it', () => {
    const state={
      courses:[{code:'CPIT-240',name:'Database (I)',grade:'A',source:'pdf'}],
      goal:'data',
      insight:emptyInsightState(),
    }
    const skills=[
      {id:'database',labels:{ar:'قواعد البيانات',en:'Databases'},confidenceLabel:'high',evidence:[]},
      {id:'statistics',labels:{ar:'التحليل الكمي',en:'Quantitative analysis'},confidenceLabel:'high',evidence:[]},
    ]
    const graph=projectStateToPerson360({state,skills,educationClassification:{primary:null}})
    const data=matchTargets(buildMatchingProfile({graph}),{lang:'en'}).find(x=>x.id==='job-data-analyst')

    expect(data.judgment).toBe('conditional')
    expect(data.graphTrace.evidencePathCount).toBe(0)
    expect(data.missingSkills).toEqual(expect.arrayContaining(['database','statistics']))
  })

  it('uses graph goal and preference claims as context without letting them erase evidence gaps', () => {
    let insight=emptyInsightState()
    insight=setDeclaredPreference(insight,'careerInterest','investigative')
    insight=setDeclaredPreference(insight,'workValue','achievement')
    const graph=projectStateToPerson360({
      state:{courses:[],goal:'data',insight},
      skills:[],
      educationClassification:{primary:null},
    })
    const profile=buildMatchingProfile({graph})
    const data=matchTargets(profile,{lang:'en'}).find(x=>x.id==='job-data-analyst')

    expect(profile.goal).toBe('data')
    expect(profile.preferences.careerInterest).toBe('investigative')
    expect(data.judgment).toBe('conditional')
    expect(data.semanticPaths.some(path=>path.kind==='goal-alignment'&&path.status==='supported')).toBe(true)
    expect(data.semanticPaths.some(path=>path.kind==='preference-alignment'&&path.status==='supported')).toBe(true)
    expect(data.missingSkills.length).toBeGreaterThan(0)
  })

  it('handles an empty Person360 graph without falling back or throwing', () => {
    const graph=projectStateToPerson360({
      state:{courses:[],goal:null,insight:emptyInsightState()},
      skills:[],
      educationClassification:{primary:null},
    })
    const profile=buildMatchingProfile({graph})
    const matches=matchTargets(profile,{lang:'en'})
    expect(profile.mode).toBe('person360-graph')
    expect(matches.length).toBeGreaterThan(0)
    expect(matches.every(item=>item.decisionBasis==='person360-semantic-graph')).toBe(true)
  })

})

// Task 23 · Matches as a short list: groups, order inside a group, one specific reason per row.
describe('matches list: groups and reasons', () => {
  const item = (over = {}) => ({ id: 'x', type: 'job', judgment: 'fits', missingSkills: [], hardGates: [], limitingMechanisms: [], supportingMechanisms: [], semanticPaths: [], requiredSkills: ['database'], ...over })
  it('puts every judgment in one of three groups; outside-goal and not-yet go to "not for now"', () => {
    expect(MATCH_GROUPS).toEqual(['fits', 'conditional', 'later'])
    expect(['fits', 'conditional', 'exploratory', 'not-yet'].map(j => groupOf({ judgment: j }))).toEqual(['fits', 'conditional', 'later', 'later'])
  })
  it('orders jobs before training inside a group and keeps the engine order otherwise', () => {
    const list = [item({ id: 't1', type: 'training' }), item({ id: 'j1' }), item({ id: 'c1', judgment: 'conditional' }), item({ id: 'j2' }), item({ id: 'n1', judgment: 'not-yet' }), item({ id: 'e1', judgment: 'exploratory', type: 'training' })]
    const g = groupMatches(list)
    expect(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map(m => m.id)]))).toEqual({ fits: ['j1', 'j2', 't1'], conditional: ['c1'], later: ['n1', 'e1'] })
  })
  it('prefers what is missing, then the supporting evidence, then the goal link; never a number', () => {
    expect(matchReason(item({ judgment: 'conditional', missingSkills: ['cyber', 'database'] }), 'en')).toEqual({ kind: 'missing', text: 'Missing: Cybersecurity fundamentals' })
    expect(matchReason(item({ judgment: 'conditional', missingSkills: ['cyber'] }), 'ar').text).toBe('ينقصك: أساسيات الأمن السيبراني')
    expect(matchReason(item({ judgment: 'not-yet', hardGates: ['g'], limitingMechanisms: ['A hard gate sentence.'] }), 'en')).toEqual({ kind: 'gate', text: 'A hard gate sentence.' })
    expect(matchReason(item({ judgment: 'exploratory' }), 'en')).toEqual({ kind: 'outside-goal', text: 'Outside your current goal' })
    const evidence = item({ semanticPaths: [{ kind: 'capability-match', courseCode: 'CPIT-240', capabilityLabel: { ar: 'قواعد البيانات', en: 'Databases' } }, { kind: 'goal-alignment', status: 'supported' }] })
    expect(matchReason(evidence, 'en')).toEqual({ kind: 'evidence', text: 'Your CPIT-240 course supports this (Databases)' })
    expect(matchReason(evidence, 'ar').text).toBe('مقررك CPIT-240 يدعم هذا المسار (قواعد البيانات)')
    expect(matchReason(item({ semanticPaths: [{ kind: 'goal-alignment', status: 'supported' }] }), 'en')).toEqual({ kind: 'goal', text: 'It connects to the goal you chose.' })
    expect(matchReason(item({ semanticPaths: [{ kind: 'preference-alignment', status: 'supported' }] }), 'en').kind).toBe('preference')
    expect(matchReason(item({ requiredSkills: [] }), 'en')).toEqual({ kind: 'no-prerequisite', text: 'No academic prerequisite' })
    expect(matchReason(item(), 'en').kind).toBe('catalog')
    for (const lang of ['ar', 'en']) for (const it of [item({ missingSkills: ['cyber'] }), item({ judgment: 'exploratory' }), item({ requiredSkills: [] })]) expect(matchReason(it, lang).text).not.toMatch(/\d+\s*%/)
  })
})

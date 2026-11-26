import { describe, expect, it } from 'vitest'
import { MATCH_GROUPS, groupOf, groupMatches, matchReason } from '../src/utils/matchReason.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { emptyInsightState, setDeclaredPreference } from '../src/insight.js'
import { createHash } from 'node:crypto'
import { demoCourses } from '../src/data.js'
import { profileSkills } from '../src/utils/engine.js'
import { buildInferenceDataset } from '../src/ontology/rdf.js'

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

// Task 78 (Amjd, 2026-11-21): up to 3 interest areas and 3 work values, and one goal claim per chosen goal.
describe('Task 78 · several interest areas, work values and goals', () => {
  const SAMPLE_COURSES = () => demoCourses.map(row => ({ ...row }))
  const stateOf = ({ goal = null, goals = [], prefs = {} } = {}) => ({ approved: true, courses: SAMPLE_COURSES(), goal, goals, consents: { analyze: true, insight: true }, insight: { declaredPreferences: prefs } })
  const graphOf = state => projectStateToPerson360({ state, skills: profileSkills(state) })
  const matchesOf = (state, lang = 'en') => matchTargets(buildMatchingProfile({ graph: graphOf(state), goals: state.goals }), { lang })
  const strip = value => JSON.parse(JSON.stringify(value, (k, v) => (/(At|AtTime|Time)$/.test(k) ? undefined : v)))
  // The canonical output for one state: graph and flat matching in both languages, the inference export, the claims.
  const canonical = state => {
    const graph = graphOf(state)
    const out = {}
    for (const lang of ['ar', 'en']) {
      const matches = matchTargets(buildMatchingProfile({ graph, goals: state.goals }), { lang })
      out[lang] = { matches, inference: matches.map(m => buildInferenceDataset(graph, m)) }
    }
    out.flat = matchTargets(buildMatchingProfile({ skills: profileSkills(state), goal: state.goal, goals: state.goals, insight: state.insight }), { lang: 'en' })
    out.claims = graph.claims
    return JSON.stringify(strip(out))
  }
  const sha = text => createHash('sha256').update(text).digest('hex')
  // Measured with the same function on local main 3a9cbac (before Task 78), the example's courses, one value per
  // question. A deliberate change to the catalog or the engine must measure these again on the commit before it.
  const BEFORE_TASK_78 = {
    'interest+value+direction-goal': [{ goal: 'data', goals: ['data'], prefs: { careerInterest: 'investigative', workValue: 'achievement' } }, '42a256ddd378aac5f9ba543306c2ba78da16806c03d78b2e56e7c4e5e90b0fdc'],
    'interest+value+pathway-goal': [{ goal: 'job-data-analyst', goals: ['job-data-analyst'], prefs: { careerInterest: 'social', workValue: 'support' } }, 'a4ef231064f88b09d82b23b464549a4b08d7597bdab4bcf4cd09feaea8a84c8b'],
    'interest-only-no-goal': [{ goal: null, goals: [], prefs: { careerInterest: 'artistic' } }, '6983b072d189a79a1b0c38062ba6e058f1c63d38edcfd7aadfb975089415c118'],
    'all-single-schemes': [{ goal: 'cyber', goals: ['cyber'], prefs: { careerInterest: 'conventional', workValue: 'independence', workStructure: 'structured', collaboration: 'small-team' } }, 'd2b38ca4287bf3625e0cd5d31851202c201d155bc94eeb1ef1ae0b77e355343f'],
  }
  const asLists = prefs => Object.fromEntries(Object.entries(prefs).map(([k, v]) => [k, ['careerInterest', 'workValue'].includes(k) ? [v] : v]))

  for (const [name, [spec, hash]] of Object.entries(BEFORE_TASK_78)) it(`one value per question gives exactly today's results (${name}): old string shape and one-item list`, () => {
    expect(sha(canonical(stateOf(spec))), 'stored as one string, as before').toBe(hash)
    expect(sha(canonical(stateOf({ ...spec, prefs: asLists(spec.prefs) }))), 'stored as a one-item list').toBe(hash)
  })

  it('every chosen interest area has its own preference claim; the first keeps today\'s id', () => {
    const graph = graphOf(stateOf({ prefs: { careerInterest: ['social', 'investigative', 'artistic'], workValue: ['support', 'achievement'] } }))
    const claims = graph.claims.filter(c => c.predicate.startsWith('kamin:prefers:'))
    expect(claims.map(c => c['@id'])).toEqual([
      'urn:kamin:claim:preference:careerinterest',
      'urn:kamin:claim:preference:careerinterest:investigative',
      'urn:kamin:claim:preference:careerinterest:artistic',
      'urn:kamin:claim:preference:workvalue',
      'urn:kamin:claim:preference:workvalue:achievement',
    ])
    expect(claims.map(c => c.object)).toEqual(['social', 'investigative', 'artistic'].map(id => `urn:kamin:preference:careerinterest:${id}`).concat(['support', 'achievement'].map(id => `urn:kamin:preference:workvalue:${id}`)))
  })

  it('matching reads every value: one R3 per compatible value, both premises on that value; the sentence once; "less connected" only when none fits', () => {
    const several = matchesOf(stateOf({ prefs: { careerInterest: ['social', 'investigative', 'conventional'] } })).find(m => m.id === 'job-data-analyst')
    const r3 = several.inferences.filter(i => i.ruleId === 'R3')
    expect(r3.map(i => i.premises[0].object)).toEqual(['urn:kamin:preference:careerinterest:investigative', 'urn:kamin:preference:careerinterest:conventional'])
    for (const i of r3) expect(i.premises[1].object).toBe(i.premises[0].object)
    expect(new Set(r3.map(i => i.id)).size).toBe(2)
    expect(r3.map(i => i.id)).toEqual(['urn:kamin:inference:job-data-analyst:R3:careerInterest:investigative', 'urn:kamin:inference:job-data-analyst:R3:careerInterest:conventional'])
    expect(several.supportingMechanisms.filter(s => /declared career interest aligns/.test(s))).toHaveLength(1)
    expect(several.limitingMechanisms.join(' ')).not.toMatch(/less connected/)
    expect(several.semanticPaths.filter(p => p.kind === 'preference-alignment').map(p => [p.option, p.status])).toEqual([['social', 'context-only'], ['investigative', 'supported'], ['conventional', 'supported']])
    // Only the first area was chosen before: social alone does not fit, so the old "less connected" sentence stays.
    const one = matchesOf(stateOf({ prefs: { careerInterest: ['social'] } })).find(m => m.id === 'job-data-analyst')
    expect(one.inferences.filter(i => i.ruleId === 'R3')).toEqual([])
    expect(one.limitingMechanisms.join(' ')).toMatch(/less connected/)
    // A second area that fits makes the pathway's interest context supported.
    const flat = matchTargets(buildMatchingProfile({ skills: [], insight: { declaredPreferences: { careerInterest: ['social', 'conventional'], workValue: ['support', 'independence'] } } }), { lang: 'en' }).find(m => m.id === 'job-data-analyst')
    expect(flat.supportingMechanisms.join(' ')).toMatch(/career interest aligns/)
    expect(flat.supportingMechanisms.join(' ')).toMatch(/work value is supported/)
    expect(flat.limitingMechanisms.join(' ')).not.toMatch(/less aligned/)
  })

  it('the person graph holds one goal claim per chosen goal (main first), at most 3', () => {
    const graph = graphOf(stateOf({ goal: 'data', goals: ['data', 'job-cyber-analyst', 'job-project-coordinator', 'job-qa-tester'] }))
    const goals = graph.claims.filter(c => c.predicate === 'kamin:pursuesGoal')
    expect(goals.map(c => c.object)).toEqual(['urn:kamin:goal:data', 'urn:kamin:goal:job-cyber-analyst', 'urn:kamin:goal:job-project-coordinator'])
    expect(goals.every(c => c.evidenceStrength === 'self-reported' && c.consentPurpose === 'urn:kamin:purpose:student-insight')).toBe(true)
    expect(graph.entities.filter(e => e['@type'] === 'Goal').map(e => e.notation)).toEqual(['data', 'job-cyber-analyst', 'job-project-coordinator'])
  })

  it('R2\'s two premises name the same goal for the 2nd and 3rd goals too (Task 76\'s open item)', () => {
    const state = stateOf({ goal: 'data', goals: ['data', 'job-cyber-analyst', 'management'] })
    const graph = graphOf(state)
    const claimOf = goal => graph.claims.find(c => c.predicate === 'kamin:pursuesGoal' && c.object === `urn:kamin:goal:${goal}`)['@id']
    const matches = matchesOf(state)
    const r2 = id => matches.find(m => m.id === id).inferences.find(i => i.ruleId === 'R2')
    for (const [pathway, goal] of [['job-data-analyst', 'data'], ['job-cyber-analyst', 'job-cyber-analyst'], ['job-project-coordinator', 'management']]) {
      const i = r2(pathway)
      expect(i.premises[0], pathway).toEqual({ subject: graph['@id'], predicate: 'kamin:pursuesGoal', object: `urn:kamin:goal:${goal}` })
      expect(i.premises[1].object, pathway).toBe(i.premises[0].object)
      expect(i.claimId, pathway).toBe(claimOf(goal))
    }
    // Every R2 of every pathway: both premises on one goal.
    for (const m of matches) for (const i of m.inferences.filter(x => x.ruleId === 'R2')) expect(i.premises[1].object, m.id).toBe(i.premises[0].object)
  })

  it('interests are never evidence: capabilities, levels and evidence claims are the same with 3 areas, 3 values and 3 goals', () => {
    const plain = stateOf()
    const full = stateOf({ goal: 'data', goals: ['data', 'cyber', 'job-qa-tester'], prefs: { careerInterest: ['investigative', 'social', 'artistic'], workValue: ['achievement', 'support', 'recognition'] } })
    expect(profileSkills(full)).toEqual(profileSkills(plain))
    const evidence = state => strip(graphOf(state).claims.filter(c => ['kamin:demonstrates', 'kamin:verifiedBy', 'kamin:studied'].includes(c.predicate)))
    expect(evidence(full)).toEqual(evidence(plain))
    // By pathway (goals change the order of the list and the judgments, never the evidence).
    const caps = state => matchesOf(state).map(m => [m.id, m.missingSkills, m.semanticPaths.filter(p => p.kind === 'capability-match').map(p => [p.capabilityKey, p.evidenceLevel])]).sort((a, b) => a[0].localeCompare(b[0]))
    expect(caps(full)).toEqual(caps(plain))
  })
})

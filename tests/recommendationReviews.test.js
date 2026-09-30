import { describe, it, expect } from 'vitest'
import cases from './fixtures/recommendation-red-team.json'
import { demoCourses } from '../src/data.js'
import { emptyInsightState } from '../src/insight.js'
import { inferSkills, judgeOpportunities } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { buildPortableProfile, encryptPortableProfile, decryptPortableProfile, normalizePortableState } from '../src/utils/portableProfile.js'
import { buildCapabilitySnapshot } from '../src/utils/capabilitySnapshot.js'
import { describeRecommendation, recommendationSeed, fingerprintRecommendation, createRecommendationReview,
  normalizeRecommendationReviews, appendRecommendationReview, withdrawRecommendationReview, recommendationReviewStatus,
  buildRedTeamCandidate, REVIEW_CHECKS, MAX_REVIEWS } from '../src/review/recommendations.js'

const state = () => ({ courses: structuredClone(demoCourses), approved: true, goal: 'data', consents: { analyze: true, insight: true }, insight: emptyInsightState(), recommendationReviews: [] })
const getMatch = (s, lang='en') => matchTargets(buildMatchingProfile({ graph: projectStateToPerson360({ state: s, skills: s.approved ? inferSkills(s.courses) : [] }) }), { lang }).find(m => m.id === 'job-data-analyst')
const draft = (action='contested') => ({ action, reason: action==='accepted'?'reviewed':'wrong-mapping', reviewer: { label: 'Synthetic reviewer', role: 'student' }, note: 'Synthetic observation only', checks: REVIEW_CHECKS, confidence: 'confident' })
const record = async (s=state(), action='contested') => {
  const item=getMatch(s)
  return createRecommendationReview({ descriptor: describeRecommendation(item,'pathway',s), fingerprint: await fingerprintRecommendation(recommendationSeed(item,'pathway',s)), draft:draft(action) })
}

describe('human review trust boundary', () => {
  it('requires evidence, goal and limits checks for acceptance/rejection but allows unresolved and contested',async()=>{
    const s=state(),item=getMatch(s),descriptor=describeRecommendation(item,'pathway',s),fingerprint=await fingerprintRecommendation(recommendationSeed(item,'pathway',s))
    for(const action of ['accepted','rejected'])expect(()=>createRecommendationReview({descriptor,fingerprint,draft:{...draft(action),checks:['evidence']}})).toThrow('INVALID_REVIEW')
    for(const action of ['unresolved','contested'])expect(createRecommendationReview({descriptor,fingerprint,draft:{...draft(action),checks:[]}}).action).toBe(action)
    expect(()=>createRecommendationReview({descriptor,fingerprint,draft:{...draft(),reviewer:{label:' ',role:'advisor'}}})).toThrow('INVALID_REVIEW')
  })
  it('keeps the same context across languages and review events, but invalidates changed evidence, goal, rule and requirements',async()=>{
    const s=state(),item=getMatch(s),seed=recommendationSeed(item,'pathway',s),fingerprint=await fingerprintRecommendation(seed),r=await record(s,'accepted')
    expect(recommendationSeed(getMatch(s,'ar'),'pathway',s)).toBe(seed)
    const reviewed={...s,recommendationReviews:[r],audit:[{ts:Date.now()}],localPersistence:true}
    expect(recommendationSeed(getMatch(reviewed),'pathway',reviewed)).toBe(seed)
    expect(recommendationReviewStatus(r,fingerprint)).toBe('accepted')
    for(const changed of [{...s,goal:'cyber'},{...s,courses:[]}])expect(recommendationReviewStatus(r,await fingerprintRecommendation(recommendationSeed(getMatch(changed),'pathway',changed)))).toBe('outdated')
    for(const changed of [{...item,ruleVersion:'new-rule'},{...item,requiredSkills:[...item.requiredSkills,'cloud']}])expect(await fingerprintRecommendation(recommendationSeed(changed,'pathway',s))).not.toBe(fingerprint)
  })
  it('never promotes reviewer decisions into capabilities, claims, institutional evidence or matching',async()=>{
    const s=state(),before=getMatch(s),graph=projectStateToPerson360({state:s,skills:inferSkills(s.courses)})
    for(const action of ['accepted','rejected','contested']){
      const r=await record(s,action),reviewed={...s,recommendationReviews:[r]}
      expect(getMatch(reviewed)).toEqual(before)
      const after=projectStateToPerson360({state:reviewed,skills:inferSkills(reviewed.courses)})
      const content = claims => claims.map(({generatedAtTime,...claim})=>claim)
      expect(content(after.claims)).toEqual(content(graph.claims))
      expect(after.entities).toEqual(graph.entities)
      expect(JSON.stringify(after)).not.toContain('Synthetic reviewer')
      const snapshot=buildCapabilitySnapshot({skillIds:inferSkills(reviewed.courses).map(s=>s.id),goal:reviewed.goal,recommendationReviews:reviewed.recommendationReviews})
      expect(JSON.stringify(snapshot)).not.toContain('Synthetic reviewer')
      expect(snapshot).not.toHaveProperty('recommendationReviews')
    }
  })
  it('keeps acceptance current when a session reload normalizes omitted optional insight fields',async()=>{
    const s=state(),r=await record(s,'accepted')
    expect(s.insight).not.toHaveProperty('responses')
    const restored={...JSON.parse(JSON.stringify(s)),insight:{...s.insight,responses:{}}}
    const fingerprint=await fingerprintRecommendation(recommendationSeed(getMatch(restored),'pathway',restored))
    expect(recommendationReviewStatus(r,fingerprint)).toBe('accepted')
    restored.insight.declaredPreferences={workStructure:'structured'}
    expect(await fingerprintRecommendation(recommendationSeed(getMatch(restored),'pathway',restored))).not.toBe(fingerprint)
  })
  it('preserves decisions and their previous event when withdrawing without changing the engine',async()=>{
    const s=state(),r=await record(s,'accepted'),withdrawn=withdrawRecommendationReview(r)
    const history=appendRecommendationReview([r],withdrawn)
    expect(history.map(r=>r.action)).toEqual(['withdrawn','accepted'])
    expect(history[0].previousId).toBe(r.id)
    expect(recommendationReviewStatus(withdrawn,r.fingerprint)).toBe('withdrawn')
    expect(getMatch({...s,recommendationReviews:history})).toEqual(getMatch(s))
  })
  it('preserves private review records in encrypted backups, restores them as historical and excludes them from the graph',async()=>{
    const s=state(),r=await record(s,'accepted');s.recommendationReviews=[r]
    const payload=buildPortableProfile({state:s,person360:projectStateToPerson360({state:s,skills:inferSkills(s.courses)})})
    const encrypted=await encryptPortableProfile(payload,'test review passphrase only')
    expect(JSON.stringify(encrypted)).not.toContain(r.reviewer.label)
    const restored=normalizePortableState(await decryptPortableProfile(encrypted,'test review passphrase only'))
    expect(restored.recommendationReviews[0].reviewer).toEqual(r.reviewer)
    expect(recommendationReviewStatus(restored.recommendationReviews[0],r.fingerprint)).toBe('imported')
    expect(JSON.stringify(payload.person360)).not.toContain('recommendationReviews')
    expect(normalizePortableState(buildPortableProfile({state:{...s,recommendationReviews:undefined}})).recommendationReviews).toEqual([])
  })
  it('rejects malformed or forged records and does not accept string-shaped checklists',async()=>{
    const r=await record(state(),'accepted')
    for(const change of [{fingerprint:'bad'},{action:'institution-verified'},{checks:'evidence-goal-limits'},{reviewer:{label:'Nobody',role:'verified-university'}},{createdAt:'not-a-date'}])expect(normalizeRecommendationReviews([{...r,...change}])).toEqual([])
    const restored=normalizeRecommendationReviews([{...r,verified:true,imported:false,claims:[{skill:'cloud'}]}],{imported:true})[0]
    expect(restored.imported).toBe(true)
    expect(restored).not.toHaveProperty('verified');expect(restored).not.toHaveProperty('claims')
  })
  it('exports an unverified regression candidate without name, note, grades, input fingerprint, duration or judgment',async()=>{
    const r=await record(),candidate=buildRedTeamCandidate({...r,note:'PRIVATE STUDENT ID 123 GRADE A',reviewer:{label:'PRIVATE NAME',role:'advisor'}})
    expect(candidate.status).toBe('unverified-candidate');expect(candidate.confirmedDefect).toBe(false);expect(candidate.automaticSubmission).toBe(false)
    const data=JSON.stringify(candidate)
    for(const value of ['PRIVATE',r.fingerprint])expect(data).not.toContain(value)
    for(const key of ['reviewer','note','elapsedMs','observedJudgment'])expect(candidate).not.toHaveProperty(key)
    expect(()=>buildRedTeamCandidate({...r,action:'accepted'})).toThrow('CONTEST_REQUIRED')
  })
  it('stores timing only with explicit opt-in and bounded duration; interrupted attempts remain identifiable',async()=>{
    const r=await record()
    expect(normalizeRecommendationReviews([{...r,timing:{elapsedMs:1234}}])[0].timing).toBeNull()
    expect(normalizeRecommendationReviews([{...r,timing:{elapsedMs:Infinity,consented:true}}])[0].timing).toBeNull()
    expect(normalizeRecommendationReviews([{...r,timing:{elapsedMs:1234,consented:true,interrupted:true}}])[0].timing.interrupted).toBe(true)
  })
  it('does not export personal text hidden in imported rule/catalog metadata or unknown targets',async()=>{
    const r=await record()
    const candidate=buildRedTeamCandidate({...r,imported:true,ruleVersion:'PRIVATE reviewer name',catalogVersion:'PRIVATE student identifier'})
    expect(candidate.ruleVersion).toBe('unrecognized-version')
    expect(candidate.catalogVersion).toBe('unrecognized-version')
    expect(JSON.stringify(candidate)).not.toContain('PRIVATE')
    for(const change of [{targetId:'private-name'},{reason:'PRIVATE note'},{kind:'PRIVATE kind'}])expect(()=>buildRedTeamCandidate({...r,...change})).toThrow('UNRECOGNIZED_REVIEW_TARGET')
  })
  it('does not silently evict history when the local limit is reached',async()=>{
    const r=await record(),history=Array.from({length:MAX_REVIEWS},(_,i)=>({...r,id:`review-${i}`}))
    expect(()=>appendRecommendationReview(history,{...r,id:'another-review'})).toThrow('REVIEW_LIMIT_REACHED')
    expect(history).toHaveLength(MAX_REVIEWS)
  })
  it('shows course-specific missing requirements instead of treating personal approval as a prerequisite',()=>{
    const s={...state(),courses:[],approved:false},item=judgeOpportunities([],'data','en').find(item=>item.requires?.length)
    const descriptor=describeRecommendation(item,'course',s)
    expect(descriptor.requirements.length).toBeGreaterThan(0)
    expect(descriptor.requirements.every(r=>!r.supported)).toBe(true)
  })
})

describe('synthetic negative recommendation suite (not field results)',()=>{
  for(const c of cases)it(c.id,()=>{
    const s={courses:c.courses,approved:c.approved,goal:c.goal,consents:{analyze:c.approved,insight:true},insight:{...emptyInsightState(),declaredPreferences:c.preferences||{}},recommendationReviews:c.priorReview?[{action:c.priorReview}]:[]}
    const match=getMatch(s)
    expect(match.missingSkills.slice().sort()).toEqual(c.expectedMissing)
    expect(match.judgment).not.toBe('fits')
    expect(match.inferences.some(i=>i.evidenceLevel==='institution-verified')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'

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

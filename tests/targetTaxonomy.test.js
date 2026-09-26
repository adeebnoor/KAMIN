import { describe, expect, it } from 'vitest'
import { targetProfiles } from '../src/matching/targets.js'

describe('target profile occupation taxonomy contract',()=>{
  it('carries taxonomy-neutral nullable occupation identifiers for jobs',()=>{
    const jobs=targetProfiles.filter(target=>target.type==='job')
    expect(jobs.length).toBeGreaterThan(0)
    for(const target of jobs){
      expect(target.occupationCodes).toEqual(expect.objectContaining({onet:null,esco:null,ssco:null}))
    }
  })

  it('does not add occupation identifiers to training targets',()=>{
    expect(targetProfiles.filter(target=>target.type==='training').every(target=>target.occupationCodes===undefined)).toBe(true)
  })
})

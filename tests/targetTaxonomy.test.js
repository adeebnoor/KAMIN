import { describe, expect, it } from 'vitest'
import { targetProfiles } from '../src/matching/targets.js'

describe('target profile occupation taxonomy contract',()=>{
  it('keeps a taxonomy-neutral shape while allowing reviewed external identifiers',()=>{
    const jobs=targetProfiles.filter(target=>target.type==='job')
    expect(jobs.length).toBeGreaterThan(0)
    for(const target of jobs){
      expect(target.occupationCodes).toEqual(expect.objectContaining({
        onet:expect.anything(),
        esco:expect.anything(),
        ssco:expect.anything(),
      }))
      for(const value of Object.values(target.occupationCodes)){
        expect(value===null || typeof value==='string').toBe(true)
      }
    }
  })

  it('pins reviewed Data Analyst ESCO/O*NET identifiers without exposing SSCO logic',()=>{
    const data=targetProfiles.find(target=>target.id==='job-data-analyst')
    expect(data.occupationCodes.esco).toBe('2511.3')
    expect(data.occupationCodes.onet).toBe('15-2051.01')
    expect(data.occupationCodes.ssco).toBeNull()
    expect(data.knowledgeGraph).toBe('kamin-ict-kg-v1')
  })

  it('does not add occupation identifiers to training targets',()=>{
    expect(targetProfiles.filter(target=>target.type==='training').every(target=>target.occupationCodes===undefined)).toBe(true)
  })
})

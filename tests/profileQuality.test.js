import { describe, it, expect } from 'vitest'
import { reviewProfileQuality, canonicalCourseCode, validGrade } from '../src/utils/profileQuality.js'
import { inferSkills } from '../src/utils/engine.js'
const row = {code:'CPIT-260',name:'Database Systems',grade:'B'}
describe('truthful profile review',()=>{
  it('requires a usable record, not just consent',()=>{
    expect(reviewProfileQuality([]).canApprove).toBe(false)
    expect(reviewProfileQuality([{...row,name:''}]).canApprove).toBe(false)
  })
  it('detects duplicate course spellings before claims are created',()=>{
    const result=reviewProfileQuality([row,{...row,code:'cpit260',grade:'A'}])
    expect(result.canApprove).toBe(false)
    expect(result.issues[0].kind).toBe('duplicate')
    expect(canonicalCourseCode('cpit 260')).toBe('CPIT-260')
  })
  it('does not convert malformed high grades into evidence',()=>{
    expect(validGrade('AAA')).toBe(false)
    expect(inferSkills([{...row,grade:'AAA'}])).toEqual([])
    expect(validGrade('110')).toBe(false)
    expect(validGrade('أ+')).toBe(true)
  })
  it('preserves truthful failure and unknown-course records without inferring ability',()=>{
    expect(reviewProfileQuality([{...row,grade:'F'}]).canApprove).toBe(true)
    expect(inferSkills([{...row,grade:'F'}])).toEqual([])
    expect(reviewProfileQuality([{...row,code:'NEW-999'}]).canApprove).toBe(true)
    expect(inferSkills([{...row,code:'NEW-999'}])).toEqual([])
  })
  it('uses the same canonical course identity in review and inference',()=>{
    expect(reviewProfileQuality([{...row,code:'CPIT260'}]).mapped).toBe(1)
    expect(inferSkills([{...row,code:'CPIT260'}])[0].id).toBe('database')
  })
})

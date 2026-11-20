import { describe, it, expect } from 'vitest'
import { reviewProfileQuality, canonicalCourseCode, validGrade } from '../src/utils/profileQuality.js'
import { inferSkills } from '../src/utils/engine.js'
// Task 02: an extracted (document) row; a row with no source is hand-typed and creates no capability.
const row = {code:'CPIT-240',name:'Database (I)',grade:'B',source:'pdf'}
describe('truthful profile review',()=>{
  it('requires a usable record, not just consent',()=>{
    expect(reviewProfileQuality([]).canApprove).toBe(false)
    expect(reviewProfileQuality([{...row,name:''}]).canApprove).toBe(false)
  })
  it('detects duplicate course spellings before claims are created',()=>{
    const result=reviewProfileQuality([row,{...row,code:'cpit240',grade:'A'}])
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
    expect(reviewProfileQuality([{...row,code:'CPIT240'}]).mapped).toBe(1)
    expect(inferSkills([{...row,code:'CPIT240'}])[0].id).toBe('database')
  })
})

// Task 52: KAU letter codes, retakes and transfers never block approval; duplicates only within one term.
describe('KAU rows in the review (Task 52)',()=>{
  const kau={...row,code:'CPIT-240',term:'FALL',year:'2021/2022',system:'semester',section:'term'}
  it('accepts every KAU letter code, and still the numeric and Arabic grades of before',()=>{
    for(const code of ['A+','A','B+','B','C+','C','D+','D','F','NP','TR','W','WF','IC','IP','DN','NF','P']) expect(validGrade(code),code).toBe(true)
    for(const grade of ['A-','I','PASS','0','100','88.5','أ+','هـ']) expect(validGrade(grade),grade).toBe(true)
    expect(validGrade('ZZ')).toBe(false)
  })
  it('a TR row and a transfer section can be approved',()=>{
    const result=reviewProfileQuality([{...kau,grade:'TR',section:'equivalent',term:null,year:null,system:null},{...kau,code:'CPIT-250',grade:'P'},{...kau,code:'CPIS-334',grade:'IC'},{...kau,code:'CPIT-260',grade:'NF'}])
    expect(result.issues).toEqual([])
    expect(result.canApprove).toBe(true)
  })
  it('the same code in another term is a retake, not a duplicate; in the same term it is a duplicate',()=>{
    expect(reviewProfileQuality([{...kau,grade:'F'},{...kau,grade:'B+',year:'2022/2023'}]).canApprove).toBe(true)
    expect(reviewProfileQuality([{...kau,grade:'TR',section:'equivalent',term:null,year:null},{...kau,grade:'B'}]).canApprove).toBe(true)
    const same=reviewProfileQuality([{...kau,grade:'F'},{...kau,grade:'B+'}])
    expect(same.issues).toEqual([{index:1,code:'CPIT-240',kind:'duplicate'}])
    expect(same.canApprove).toBe(false)
  })
  it('an unknown printed letter is a warning on its row, never a blocking issue',()=>{
    const result=reviewProfileQuality([{...kau,grade:'ZZ',letter:'ZZ',letterStatus:'unknown'}])
    expect(result).toMatchObject({issues:[],warnings:[{index:0,code:'CPIT-240',kind:'unknownLetter'}],canApprove:true})
    // A grade typed by hand that we do not know still blocks, as before.
    expect(reviewProfileQuality([{...row,grade:'ZZ'}]).issues.map(i=>i.kind)).toEqual(['grade'])
  })
})

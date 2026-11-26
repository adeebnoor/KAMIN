import { describe, expect, it } from 'vitest'
import legacyBackup from './fixtures/portable-v1-310k.json'
import {
  KAMIN_ENCRYPTED_FORMAT,
  KAMIN_PORTABLE_FORMAT,
  buildPortableProfile,
  decryptPortableProfile,
  encryptPortableProfile,
  normalizePortableState,
} from '../src/utils/portableProfile.js'

const state={
  courses:[{code:'CPIT-251',name:'Systems Analysis',grade:'A',source:'pdf'}],
  approved:true,
  goal:'data',
  consents:{analyze:true,insight:true,advisor:true,research:true},
  insight:{version:'test',declaredPreferences:{workStructure:'balanced'},responses:{}},
  audit:[{label:'approved',ts:1}],
}

describe('encrypted local portability',()=>{
  it('opens the prior release 310k backup without weakening new backups',async()=>{
    const restored=await decryptPortableProfile(legacyBackup,'legacy test passphrase only')
    expect(restored.state.courses[0].code).toBe('CPIT-260')
    await expect(encryptPortableProfile(buildPortableProfile({state}),'correct horse battery staple',{iterations:310000})).rejects.toThrow('KDF_ITERATIONS_TOO_LOW')
  })
  it('round-trips an encrypted profile while resetting external sharing consents', async()=>{
    const payload=buildPortableProfile({state,person360:{'@type':'Person360',claims:[]}})
    expect(payload.format).toBe(KAMIN_PORTABLE_FORMAT)
    expect(payload.state.consents.advisor).toBe(false)
    expect(payload.state.consents.research).toBe(false)

    const envelope=await encryptPortableProfile(payload,'correct horse battery staple')
    expect(envelope.format).toBe(KAMIN_ENCRYPTED_FORMAT)
    expect(envelope.crypto.iterations).toBe(600000)
    expect(envelope.ciphertext).not.toContain('CPIT-251')

    const decrypted=await decryptPortableProfile(envelope,'correct horse battery staple')
    const restored=normalizePortableState(decrypted)
    expect(restored.approved).toBe(true)
    expect(restored.courses[0].code).toBe('CPIT-251')
    expect(restored.goal).toBe('data')
    expect(restored.consents.analyze).toBe(true)
    expect(restored.consents.insight).toBe(true)
    expect(restored.consents.advisor).toBe(false)
    expect(restored.consents.research).toBe(false)
  })

  it('rejects the wrong passphrase', async()=>{
    const envelope=await encryptPortableProfile(buildPortableProfile({state}),'correct horse battery staple')
    await expect(decryptPortableProfile(envelope,'totally wrong passphrase')).rejects.toThrow('BACKUP_DECRYPT_FAILED')
  })

  it('rejects tampered ciphertext', async()=>{
    const envelope=await encryptPortableProfile(buildPortableProfile({state}),'correct horse battery staple')
    const last=envelope.ciphertext.at(-1)
    envelope.ciphertext=envelope.ciphertext.slice(0,-1)+(last==='A'?'B':'A')
    await expect(decryptPortableProfile(envelope,'correct horse battery staple')).rejects.toThrow('BACKUP_DECRYPT_FAILED')
  })

  it('requires a meaningful local passphrase', async()=>{
    await expect(encryptPortableProfile(buildPortableProfile({state}),'short')).rejects.toThrow('PASSPHRASE_TOO_SHORT')
  })
})

// Task 55 · the backup carries the college and major as printed, cleaned; older backups have neither.
describe('Task 55 · collegeRaw and major in the backup', () => {
  const printed = { ...state, college: 'FCIT', collegeRaw: 'COMPUTING & INFO. TECH.', major: 'INFORMATION TECHNOLOGY' }
  it('are written to the backup and restored from it', async () => {
    const payload = buildPortableProfile({ state: printed })
    expect(payload.state).toMatchObject({ college: 'FCIT', collegeRaw: 'COMPUTING & INFO. TECH.', major: 'INFORMATION TECHNOLOGY' })
    const restored = normalizePortableState(await decryptPortableProfile(await encryptPortableProfile(payload, 'correct horse battery staple'), 'correct horse battery staple'))
    expect(restored).toMatchObject({ college: 'FCIT', collegeRaw: 'COMPUTING & INFO. TECH.', major: 'INFORMATION TECHNOLOGY' })
  })
  it('the restore cleans them: not text -> null, spaces collapsed, at most 120 characters; older backups -> null', () => {
    const payload = buildPortableProfile({ state: printed })
    const odd = { ...payload, state: { ...payload.state, collegeRaw: { injected: true }, major: `  MATH\n\n${'X'.repeat(300)}` } }
    const restored = normalizePortableState(odd)
    expect(restored.collegeRaw).toBeNull()
    expect(restored.major.startsWith('MATH X')).toBe(true)
    expect(restored.major).toHaveLength(120)
    const old = { ...payload, state: { ...payload.state } }
    delete old.state.collegeRaw
    delete old.state.major
    expect(normalizePortableState(old)).toMatchObject({ collegeRaw: null, major: null })
  })
})

// Task 58 · goals, the saved steps of My plan and the "not for me" marks in the backup.
describe('Task 58 · goals and My plan in the backup', () => {
  const PASS = 'correct horse battery staple'
  const planned = async () => {
    const { chooseGoal } = await import('../src/plan/plan.js')
    const { addToPlan, notForMe, addGoal } = await import('../src/plan/planEdits.js')
    let s = addToPlan(state, { itemId: 'fcit-cpit-340', action: 'take-course' }, { now: Date.parse('2026-11-18T09:00:00.000Z') })
    s = addToPlan(s, { itemId: 'capm', action: 'get-certificate' }, { now: Date.parse('2026-11-18T09:05:00.000Z') })
    s = notForMe(s, 'pmp')
    return addGoal(chooseGoal(s, 'data'), 'job-cyber-analyst')
  }

  it('round trip: 2 saved steps, 1 "not for me", 2 goals -> backup -> restore -> identical', async () => {
    const s = await planned()
    expect(s.plan).toHaveLength(2)
    expect(s.notForMe).toEqual(['pmp'])
    expect(s.goals).toEqual(['data', 'job-cyber-analyst'])
    const restored = normalizePortableState(await decryptPortableProfile(await encryptPortableProfile(buildPortableProfile({ state: s }), PASS), PASS))
    expect({ goal: restored.goal, goals: restored.goals, plan: restored.plan, notForMe: restored.notForMe }).toEqual({ goal: s.goal, goals: s.goals, plan: s.plan, notForMe: s.notForMe })
    expect(restored.goal).toBe('data') // goal === goals[0] for the old interface
    expect(restored.courses).toEqual(s.courses)
  })

  it('an older backup with one goal restores it as goals [goal]; malformed entries are dropped', () => {
    const payload = buildPortableProfile({ state })
    const old = { ...payload, state: { ...payload.state } }
    delete old.state.goals
    delete old.state.plan
    delete old.state.notForMe
    expect(normalizePortableState(old)).toMatchObject({ goal: 'data', goals: ['data'], plan: [], notForMe: [] })
    const odd = { ...payload, state: { ...payload.state, goals: 'data', plan: [{ itemId: 'capm', action: 'steal', addedAt: 'x' }, { itemId: 'pmp', action: 'get-certificate', addedAt: '2026-11-18T09:00:00.000Z', status: 'done', title: 'injected' }], notForMe: [{ evil: true }, 'sql'] } }
    expect(normalizePortableState(odd)).toMatchObject({ goal: 'data', goals: ['data'], plan: [{ itemId: 'pmp', action: 'get-certificate', addedAt: '2026-11-18T09:00:00.000Z', status: 'done' }], notForMe: ['sql'] })
    expect(normalizePortableState(odd).plan[0]).not.toHaveProperty('title')
  })

  it('the backup holds the plan fields in their stored shape only', async () => {
    const payload = buildPortableProfile({ state: { ...(await planned()), planDropped: 3 } })
    expect(Object.keys(payload.state)).toEqual(expect.arrayContaining(['goal', 'goals', 'plan', 'notForMe']))
    expect(payload.state).not.toHaveProperty('planDropped')
    expect(payload.state.plan.map(p => Object.keys(p).sort().join(','))).toEqual(['action,addedAt,itemId,status', 'action,addedAt,itemId,status'])
  })
})

// Task 78: up to 3 interest areas and 3 work values, stored as lists.
describe('Task 78 · several interest areas and work values in the backup', () => {
  const PASS = 'correct horse battery staple'
  const chosen = { careerInterest: ['social', 'artistic', 'investigative'], workValue: ['support', 'achievement'], workStructure: 'balanced' }

  it('round trip keeps the lists in their order', async () => {
    const s = { ...state, goals: ['data', 'job-cyber-analyst', 'management'], insight: { ...state.insight, declaredPreferences: chosen } }
    const restored = normalizePortableState(await decryptPortableProfile(await encryptPortableProfile(buildPortableProfile({ state: s }), PASS), PASS))
    expect(restored.insight.declaredPreferences).toEqual(chosen)
    expect(restored.goals).toEqual(['data', 'job-cyber-analyst', 'management'])
  })

  it('an older backup with one value per question restores it as a one-item list', () => {
    const payload = buildPortableProfile({ state })
    const old = { ...payload, state: { ...payload.state, insight: { ...payload.state.insight, declaredPreferences: { careerInterest: 'social', workValue: 'support', workStructure: 'balanced' } } } }
    expect(normalizePortableState(old).insight.declaredPreferences).toEqual({ careerInterest: ['social'], workValue: ['support'], workStructure: 'balanced' })
  })

  it('a malformed list keeps known ids only, without repeats, at most 3', () => {
    const payload = buildPortableProfile({ state })
    const odd = { ...payload, state: { ...payload.state, insight: { ...payload.state.insight, declaredPreferences: { careerInterest: ['social', 'social', '<script>', 'artistic', 'realistic', 'enterprising'], workValue: [{ evil: true }], pace: ['stable'] } } } }
    expect(normalizePortableState(odd).insight.declaredPreferences).toEqual({ careerInterest: ['social', 'artistic', 'realistic'], pace: 'stable' })
  })
})

import { describe, expect, it } from 'vitest'
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
  it('round-trips an encrypted profile while resetting external sharing consents', async()=>{
    const payload=buildPortableProfile({state,person360:{'@type':'Person360',claims:[]}})
    expect(payload.format).toBe(KAMIN_PORTABLE_FORMAT)
    expect(payload.state.consents.advisor).toBe(false)
    expect(payload.state.consents.research).toBe(false)

    const envelope=await encryptPortableProfile(payload,'correct horse battery staple')
    expect(envelope.format).toBe(KAMIN_ENCRYPTED_FORMAT)
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

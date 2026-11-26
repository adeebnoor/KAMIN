import {skills} from '../data.js'
import {copy} from '../i18n.js'
import {targetProfiles} from '../matching/targets.js'
import {PROVENANCE_LEVELS} from './provenance.js'
import {SNAPSHOT_LIMIT,encode,decode,parseSnapshotFragment} from './snapshotLink.js'
// Task 76: the fragment reader moved to ./snapshotLink.js (the only part the startup bundle needs); kept here too.
export {SNAPSHOT_LIMIT,parseSnapshotFragment}
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true})
const FORMAT='kamin-capability-snapshot'
export const snapshotSkills=Object.fromEntries(Object.values(skills).map(skill=>[skill.id,skill]))
const AAD=encoder.encode(`${FORMAT}|1`)
const fail=()=>{throw new Error('INVALID_SNAPSHOT')}
// Task 76: a goal is one of the four directions the old interface saved ('data', 'cyber', …) or, from step 4 and My
// plan, a pathway id (src/plan/plan.js). The link carries that id, checked against the catalog, so nothing else can
// travel in it; the preview and the reader show its plain name in the reader's language, never the id.
const PATHWAYS=new Map(targetProfiles.map(target=>[target.id,target]))
export const isSnapshotGoal=goal=>typeof goal==='string'&&(Object.hasOwn(copy.en.app.goals,goal)||PATHWAYS.has(goal))
export const snapshotGoalName=(goal,lang)=>PATHWAYS.get(goal)?.title?.[lang]||(Object.hasOwn(copy.en.app.goals,goal)?copy[lang].app.goals[goal]:null)
export function validateSnapshot(value){
 if(!value||value.format!==FORMAT||value.version!==1||Object.keys(value).some(k=>!['format','version','createdAt','capabilities','goal','levels'].includes(k)))return fail()
 // Optional evidence levels travel with the claims they describe: the holder sees whether a
 // capability rests on document-extracted rows or on the student's own edits and declarations.
 if(value.levels!==undefined){
  if(!value.levels||typeof value.levels!=='object'||Array.isArray(value.levels))return fail()
  for(const [id,level] of Object.entries(value.levels))if(!value.capabilities?.includes?.(id)||!PROVENANCE_LEVELS.includes(level))return fail()
 }
 if(typeof value.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value.createdAt)||!Number.isFinite(Date.parse(value.createdAt)))return fail()
 if(!Array.isArray(value.capabilities)||value.capabilities.length>20||new Set(value.capabilities).size!==value.capabilities.length||value.capabilities.some(id=>typeof id!=='string'||!Object.hasOwn(snapshotSkills,id)))return fail()
 if(value.goal!==null&&!isSnapshotGoal(value.goal))return fail()
 if(!value.capabilities.length&&!value.goal)return fail()
 return value
}
export function buildCapabilitySnapshot({skillIds=[],goal=null,levels=null},now=new Date()){
 const capabilities=[...new Set(skillIds)]
 const snapshot={format:FORMAT,version:1,createdAt:now.toISOString(),capabilities,goal}
 if(levels&&typeof levels==='object'){
  const kept=Object.fromEntries(Object.entries(levels).filter(([id])=>capabilities.includes(id)))
  if(Object.keys(kept).length)snapshot.levels=kept
 }
 return validateSnapshot(snapshot)
}
export async function encryptSnapshot(snapshot){
 validateSnapshot(snapshot)
 const raw=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12))
 const key=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt'])
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD,tagLength:128},key,encoder.encode(JSON.stringify(snapshot))))
 const payload=new Uint8Array(12+ciphertext.length);payload.set(iv);payload.set(ciphertext,12)
 return {payload:encode(payload),key:encode(raw)}
}
export function snapshotFragment(packet){
 const fragment=`#payload=${packet.payload}&key=${packet.key}`
 if(fragment.length>SNAPSHOT_LIMIT)throw new Error('SNAPSHOT_TOO_LARGE')
 return fragment
}
export async function decryptSnapshot(packet){
 try{
  if(packet?.invalid)return fail()
  const payload=decode(packet.payload),raw=decode(packet.key)
  if(raw.length!==32||payload.length<29)return fail()
  const key=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt'])
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:payload.slice(0,12),additionalData:AAD,tagLength:128},key,payload.slice(12))
  return validateSnapshot(JSON.parse(decoder.decode(plaintext)))
 }catch{throw new Error('SNAPSHOT_DECRYPT_FAILED')}
}

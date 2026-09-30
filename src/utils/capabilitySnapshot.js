import {skills} from '../data.js'
import {copy} from '../i18n.js'
import {PROVENANCE_LEVELS} from './provenance.js'
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true})
const FORMAT='kamin-capability-snapshot'
export const snapshotSkills=Object.fromEntries(Object.values(skills).map(skill=>[skill.id,skill]))
const AAD=encoder.encode(`${FORMAT}|1`)
export const SNAPSHOT_LIMIT=12000
const fail=()=>{throw new Error('INVALID_SNAPSHOT')}
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
const decode=value=>{
 if(typeof value!=='string'||!value||value.length>SNAPSHOT_LIMIT||!/^[A-Za-z0-9_-]+$/.test(value))return fail()
 try{const bytes=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));if(encode(bytes)!==value)return fail();return bytes}catch{return fail()}
}
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
 if(value.goal!==null&&(typeof value.goal!=='string'||!Object.hasOwn(copy.en.app.goals,value.goal)))return fail()
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
export function parseSnapshotFragment(hash){
 if(!hash.startsWith('#payload='))return null
 if(hash.length>SNAPSHOT_LIMIT)return {invalid:true}
 const params=new URLSearchParams(hash.slice(1))
 if([...params.keys()].length!==2||!params.has('key'))return {invalid:true}
 const packet={payload:params.get('payload'),key:params.get('key')}
 try{if(decode(packet.key).length!==32||decode(packet.payload).length<29)return {invalid:true};return packet}catch{return {invalid:true}}
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

// Task 76: reading a shared snapshot link's fragment (#payload=…&key=…) is all the startup bundle needs (src/main.jsx
// takes the secret out of the address before the first render). The snapshot's contents, its checks and the catalogs
// they use (capabilities, goals, pathways) live in src/utils/capabilitySnapshot.js, which only lazy screens load.
export const SNAPSHOT_LIMIT=12000
const fail=()=>{throw new Error('INVALID_SNAPSHOT')}
export const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
export const decode=value=>{
 if(typeof value!=='string'||!value||value.length>SNAPSHOT_LIMIT||!/^[A-Za-z0-9_-]+$/.test(value))return fail()
 try{const bytes=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));if(encode(bytes)!==value)return fail();return bytes}catch{return fail()}
}
export function parseSnapshotFragment(hash){
 if(!hash.startsWith('#payload='))return null
 if(hash.length>SNAPSHOT_LIMIT)return {invalid:true}
 const params=new URLSearchParams(hash.slice(1))
 if([...params.keys()].length!==2||!params.has('key'))return {invalid:true}
 const packet={payload:params.get('payload'),key:params.get('key')}
 try{if(decode(packet.key).length!==32||decode(packet.payload).length<29)return {invalid:true};return packet}catch{return {invalid:true}}
}

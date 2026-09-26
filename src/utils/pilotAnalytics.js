const EVENT_ALLOWLIST = new Set([
  'landing',
  'sample_report_viewed',
  'upload_started',
  'upload_completed',
  'profile_returned_to',
  'profile_completed',
  'feedback_submitted',
])

const EVENT_QUEUE_KEY='kamin-pilot-events-v1'
const FEEDBACK_QUEUE_KEY='kamin-pilot-feedback-v1'
const ANON_KEY='kamin-pilot-anon-v1'

export const PILOT_ANALYTICS_ENABLED = String(import.meta.env.VITE_PILOT_ANALYTICS_ENABLED||'').toLowerCase()==='true'
const analyticsEndpoint = () => import.meta.env.VITE_PILOT_ANALYTICS_ENDPOINT||''
const feedbackEndpoint = () => import.meta.env.VITE_PILOT_FEEDBACK_ENDPOINT||''

const randomId = () => globalThis.crypto?.randomUUID?.() || `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`

const anonymousId = () => {
  try{
    const existing=localStorage.getItem(ANON_KEY)
    if(existing) return existing
    const id=randomId()
    localStorage.setItem(ANON_KEY,id)
    return id
  }catch{return randomId()}
}

const sameOriginUrl = raw => {
  if(!raw) return null
  const url=new URL(raw,globalThis.location?.origin||'http://localhost')
  if(globalThis.location?.origin && url.origin!==globalThis.location.origin) throw new Error('PILOT_ENDPOINT_MUST_BE_SAME_ORIGIN')
  return url.toString()
}

const appendLocal = (key,record) => {
  try{
    const rows=JSON.parse(localStorage.getItem(key)||'[]')
    rows.push(record)
    localStorage.setItem(key,JSON.stringify(rows.slice(-200)))
  }catch{}
}

const post = async (rawEndpoint,record) => {
  const endpoint=sameOriginUrl(rawEndpoint)
  if(!endpoint || typeof fetch!=='function') return false
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(record),
    keepalive:true,
    credentials:'same-origin',
  })
  return response.ok
}

export function trackPilotEvent(event){
  if(!EVENT_ALLOWLIST.has(event)) throw new Error('PILOT_EVENT_NOT_ALLOWED')
  if(!PILOT_ANALYTICS_ENABLED) return {recorded:false,record:null}
  const record={
    event,
    at:new Date().toISOString(),
    anonymousId:anonymousId(),
    schema:'kamin-pilot-funnel-v1',
  }
  appendLocal(EVENT_QUEUE_KEY,record)
  void post(analyticsEndpoint(),record).catch(()=>{})
  return {recorded:true,record}
}

export async function submitPilotFeedback({text,consent}={}){
  if(consent!==true) throw new Error('FEEDBACK_CONSENT_REQUIRED')
  const clean=String(text||'').trim().slice(0,1200)
  if(!clean) throw new Error('FEEDBACK_TEXT_REQUIRED')
  if(!PILOT_ANALYTICS_ENABLED) return {submitted:false,storedLocally:false,disabled:true}
  const record={
    feedback:clean,
    consent:true,
    at:new Date().toISOString(),
    anonymousId:anonymousId(),
    schema:'kamin-pilot-feedback-v1',
  }
  appendLocal(FEEDBACK_QUEUE_KEY,record)
  if(!feedbackEndpoint()) return {submitted:false,storedLocally:true}
  const submitted=await post(feedbackEndpoint(),record)
  return {submitted,storedLocally:!submitted}
}

export function clearPilotLocalData(){
  try{
    localStorage.removeItem(EVENT_QUEUE_KEY)
    localStorage.removeItem(FEEDBACK_QUEUE_KEY)
    localStorage.removeItem(ANON_KEY)
  }catch{}
}

export const PILOT_EVENT_NAMES = Object.freeze([...EVENT_ALLOWLIST])

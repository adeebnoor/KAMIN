import { Check, Sparkles } from 'lucide-react'
import { copy, fill } from '../i18n.js'

// Plain-language summary after an upload, approval, edit (Task 04 recompute) or consent
// withdrawal. Moved out of App.jsx (Task 05) and loaded lazily: it only renders after a change.
// Task 25: `dismiss` ({label, onClick}, dashboard only) puts a "Got it" button in the title row.
export default function WhatChanged({change,lang,dismiss=null}){
  if(!change) return null
  const title={
    recompute:{ar:'ما الذي تغيّر بعد التعديل؟',en:'What changed after your edit?'},
    upload:{ar:'ما الذي تغيّر بعد الإيداع؟',en:'What changed after deposit?'},
    approve:{ar:'ما الذي تغيّر بعد الاعتماد؟',en:'What changed after approval?'},
    'withdraw-analyze':{ar:'ما الذي تغيّر بعد سحب موافقة السجل؟',en:'What changed after transcript-consent withdrawal?'},
    'withdraw-insight':{ar:'ما الذي تغيّر بعد سحب موافقة البصمة؟',en:'What changed after profile-consent withdrawal?'},
    'withdraw-digital':{ar:'ما الذي تغيّر بعد سحب موافقة النشاط الرقمي؟',en:'What changed after digital-analysis consent withdrawal?'},
    'withdraw-advisor':{ar:'ما الذي تغيّر بعد سحب الموافقة؟',en:'What changed after withdrawing consent?'},
    'withdraw-research':{ar:'ما الذي تغيّر بعد سحب الموافقة؟',en:'What changed after withdrawing consent?'},
    'delete-item':{ar:'ما الذي حُذف؟',en:'What was deleted?'},
    grant:{ar:'مُنحت الموافقة',en:'Consent granted'},
  }[change.type]||{ar:'ما الذي تغيّر؟',en:'What changed?'}
  const items=[]
  const S=copy[lang].screens.dashboard
  if(change.type==='upload'){
    items.push(fill(S.uploadRecognized,{n:change.recognized,m:change.mapped}))
    if(change.rejected) items.push(fill(S.uploadRejected,{n:change.rejected}))
  }
  if(change.type==='approve'){
    items.push(fill(S.approvedCourses,{n:change.courses}))
    items.push(fill(S.approvedSkills,{n:change.skills}))
  }
  // Recompute (Task 04) and data-control (Task 06) operations carry their own bilingual sentences:
  // what was deleted, which capabilities dropped, which judgments were recomputed, what stayed.
  if(change.sentences) items.push(...(change.sentences[lang]||[]))
  return <div className="what-changed" data-testid="what-changed" role="region" aria-label={title[lang]} aria-live="polite"><div><Sparkles size={18}/><strong>{title[lang]}</strong>{dismiss&&<button type="button" className="button secondary what-changed-dismiss" data-testid="what-changed-got-it" onClick={dismiss.onClick}>{dismiss.label}</button>}</div>{items.map((item,i)=><p key={i}><Check size={15}/>{item}</p>)}</div>
}

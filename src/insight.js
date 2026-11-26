import { emptyPerson360 } from './person360.js'
import { emptyDigitalInterests } from './digitalInterests.js'
import { INTEREST_AREAS } from './content/plainTerms.js'

export const INSIGHT_VERSION='kamin-insight-v2'

/*
 * Declared preferences are structured product inputs, not psychometric scores.
 * They intentionally use controlled lists instead of free text so rules are
 * deterministic and auditable.
 */
export const DECLARED_PREFERENCE_SCHEMES = {
  careerInterest:{
    label:{ar:'اهتمامي المهني الأقرب',en:'Primary career interest'},
    options:[
      // Task 28: plain activity words; the ids stay the RIASEC names (stored data unchanged).
      ...['realistic','investigative','artistic','social','enterprising','conventional'].map(id=>({id,label:{ar:INTEREST_AREAS[id].ar,en:INTEREST_AREAS[id].en}})),
    ],
    source:'O*NET RIASEC construct labels — self-declared, not Interest Profiler scores',
  },
  workValue:{
    label:{ar:'قيمة العمل الأهم بالنسبة لي',en:'Most important work value'},
    options:[
      {id:'achievement',label:{ar:'الإنجاز',en:'Achievement'}},
      {id:'independence',label:{ar:'الاستقلالية',en:'Independence'}},
      {id:'recognition',label:{ar:'التقدير',en:'Recognition'}},
      {id:'relationships',label:{ar:'العلاقات',en:'Relationships'}},
      {id:'support',label:{ar:'الدعم',en:'Support'}},
      {id:'conditions',label:{ar:'ظروف العمل',en:'Working conditions'}},
    ],
    source:'O*NET Work Values semantic dimensions — self-declared',
  },
  workStructure:{
    label:{ar:'درجة هيكلة العمل',en:'Work structure'},
    options:[
      {id:'structured',label:{ar:'هيكلة وخطة واضحة',en:'Highly structured'}},
      {id:'balanced',label:{ar:'مزيج بين الهيكلة والمرونة',en:'Balanced'}},
      {id:'flexible',label:{ar:'مرونة وتجريب',en:'Flexible / exploratory'}},
    ],
  },
  collaboration:{
    label:{ar:'نمط التعاون',en:'Collaboration style'},
    options:[
      {id:'independent',label:{ar:'عمل فردي في الغالب',en:'Mostly independent'}},
      {id:'small-team',label:{ar:'فريق صغير',en:'Small team'}},
      {id:'cross-functional',label:{ar:'فريق متعدد التخصصات',en:'Cross-functional team'}},
      {id:'high-collaboration',label:{ar:'تعاون مكثف',en:'Highly collaborative'}},
    ],
  },
  pace:{
    label:{ar:'إيقاع العمل',en:'Work pace'},
    options:[
      {id:'stable',label:{ar:'مستقر ومتوقع',en:'Stable and predictable'}},
      {id:'mixed',label:{ar:'متنوع',en:'Mixed'}},
      {id:'fast-changing',label:{ar:'سريع التغير',en:'Fast-changing'}},
    ],
  },
  responsibility:{
    label:{ar:'نوع المسؤولية المرغوبة',en:'Preferred responsibility'},
    options:[
      {id:'individual-contributor',label:{ar:'مساهم فردي',en:'Individual contributor'}},
      {id:'project-owner',label:{ar:'مسؤولية مشروع',en:'Project ownership'}},
      {id:'team-lead',label:{ar:'قيادة فريق',en:'Team leadership'}},
      {id:'organizational-leadership',label:{ar:'قيادة تنظيمية',en:'Organizational leadership'}},
    ],
  },
  learningMode:{
    label:{ar:'طريقة التعلم المفضلة',en:'Preferred learning mode'},
    options:[
      {id:'self-paced',label:{ar:'ذاتي السرعة',en:'Self-paced'}},
      {id:'instructor-led',label:{ar:'بإشراف مدرب',en:'Instructor-led'}},
      {id:'project-based',label:{ar:'بالمشاريع',en:'Project-based'}},
      {id:'cohort',label:{ar:'ضمن مجموعة',en:'Cohort-based'}},
    ],
  },
}

export function emptyInsightState(){
  return {
    version:INSIGHT_VERSION,
    personGraph:emptyPerson360(),
    declaredPreferences:{},
    digitalInterests:emptyDigitalInterests(),
    freeInterests:[], // Task 56: interests in the student's own words (src/interests/freeInterestState.js)
    assessments:{},
    completedInstruments:[],
    updatedAt:null,
  }
}

// Task 78 (Amjd, 2026-11-21): step 3's two chip questions take up to 3 choices each. They are stored as lists of option
// ids, in the order chosen; the other schemes keep one value. A profile, backup or session saved with a single value
// (a string) reads as a one-item list. Unknown ids and repeats are dropped; an empty list is not stored.
export const MULTI_CHOICE_SCHEMES=Object.freeze(['careerInterest','workValue'])
export const PREFERENCE_CHOICES_MAX=3
const knownOption=(schemeId,optionId)=>DECLARED_PREFERENCE_SCHEMES[schemeId]?.options.some(option=>option.id===optionId)

/** Every chosen option id of one scheme, as a list (a single stored value gives a one-item list). */
export function preferenceValues(preferences,schemeId){
  const raw=preferences?.[schemeId]
  const list=(Array.isArray(raw)?raw:[raw]).filter(id=>typeof id==='string'&&knownOption(schemeId,id))
  return [...new Set(list)].slice(0,MULTI_CHOICE_SCHEMES.includes(schemeId)?PREFERENCE_CHOICES_MAX:1)
}

/** The stored shape: lists for the multi-choice schemes, one id for the others; unknown schemes and empty choices are dropped. */
export function normalizeDeclaredPreferences(preferences){
  if(!preferences||typeof preferences!=='object'||Array.isArray(preferences)) return {}
  const out={}
  for(const schemeId of Object.keys(DECLARED_PREFERENCE_SCHEMES)){
    const values=preferenceValues(preferences,schemeId)
    if(!values.length) continue
    out[schemeId]=MULTI_CHOICE_SCHEMES.includes(schemeId)?values:values[0]
  }
  return out
}

/** How many choices are stored (a list counts each item; one stored value counts 1, as before): the data summary and the withdrawal count. */
export const preferenceCount=preferences=>Object.values(preferences&&typeof preferences==='object'?preferences:{})
  .reduce((n,value)=>n+(Array.isArray(value)?new Set(value.filter(id=>typeof id==='string')).size:1),0)

/**
 * Task 78: a tap on a chip of a multi-choice scheme. Not chosen → added at the end (a full list of 3 is returned
 * unchanged); chosen → removed. Throws like setDeclaredPreference for an unknown scheme or option.
 */
export function togglePreferenceChoice(insight,schemeId,optionId){
  if(!MULTI_CHOICE_SCHEMES.includes(schemeId)) throw new Error('UNKNOWN_PREFERENCE_SCHEME')
  if(!knownOption(schemeId,optionId)) throw new Error('UNKNOWN_PREFERENCE_OPTION')
  const declaredPreferences=normalizeDeclaredPreferences(insight?.declaredPreferences)
  const current=preferenceValues(declaredPreferences,schemeId)
  const next=current.includes(optionId)?current.filter(id=>id!==optionId):[...current,optionId]
  if(next.length>PREFERENCE_CHOICES_MAX) return insight
  if(next.length) declaredPreferences[schemeId]=next
  else delete declaredPreferences[schemeId]
  return {...insight,version:INSIGHT_VERSION,declaredPreferences,updatedAt:new Date().toISOString()}
}

export function setDeclaredPreference(insight,schemeId,optionId){
  const scheme=DECLARED_PREFERENCE_SCHEMES[schemeId]
  if(!scheme) throw new Error('UNKNOWN_PREFERENCE_SCHEME')
  if(!scheme.options.some(option=>option.id===optionId)) throw new Error('UNKNOWN_PREFERENCE_OPTION')
  return {
    ...insight,
    version:INSIGHT_VERSION,
    declaredPreferences:{...(insight?.declaredPreferences||{}),[schemeId]:optionId},
    updatedAt:new Date().toISOString(),
  }
}

export function clearInsight(){
  return emptyInsightState()
}

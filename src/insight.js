import { PSYCHOMETRIC_INSTRUMENTS } from './psychometrics/registry.js'

export const INSIGHT_VERSION='kamin-insight-v2'

export const DECLARED_PREFERENCE_OPTIONS=Object.freeze({
  workEnvironment:[
    {id:'highly-structured',ar:'منظم جدًا',en:'Highly structured'},
    {id:'moderately-structured',ar:'منظم بدرجة متوسطة',en:'Moderately structured'},
    {id:'flexible',ar:'مرن',en:'Flexible'},
    {id:'exploratory',ar:'استكشافي وتجريبي',en:'Exploratory'},
  ],
  teamMode:[
    {id:'mostly-independent',ar:'عمل فردي غالبًا',en:'Mostly independent'},
    {id:'small-team',ar:'فريق صغير',en:'Small team'},
    {id:'cross-functional',ar:'فريق متعدد التخصصات',en:'Cross-functional team'},
    {id:'highly-collaborative',ar:'تعاون مكثف',en:'Highly collaborative'},
  ],
  workPace:[
    {id:'stable',ar:'إيقاع مستقر',en:'Stable pace'},
    {id:'mixed',ar:'مزيج بين الاستقرار والتغيير',en:'Mixed pace'},
    {id:'fast-changing',ar:'سريع التغيير',en:'Fast-changing'},
  ],
  responsibility:[
    {id:'individual-contributor',ar:'مساهم فردي',en:'Individual contributor'},
    {id:'project-owner',ar:'مالك مشروع',en:'Project ownership'},
    {id:'team-lead',ar:'قيادة فريق',en:'Team leadership'},
    {id:'organizational-leadership',ar:'قيادة تنظيمية',en:'Organizational leadership'},
  ],
  learningFormat:[
    {id:'self-paced',ar:'تعلم ذاتي',en:'Self-paced'},
    {id:'instructor-led',ar:'بقيادة مدرب',en:'Instructor-led'},
    {id:'project-based',ar:'قائم على مشروع',en:'Project-based'},
    {id:'cohort',ar:'مجموعة تعلم',en:'Cohort-based'},
    {id:'blended',ar:'مدمج',en:'Blended'},
  ],
})

export function emptyInsightState(){
  return {
    version:INSIGHT_VERSION,
    declaredPreferences:{},
    observations:[],
    completedInstruments:[],
    updatedAt:null,
  }
}

export function setDeclaredPreference(insight,key,value){
  const allowed=DECLARED_PREFERENCE_OPTIONS[key]
  if(!allowed) throw new Error('UNKNOWN_PREFERENCE')
  const values=Array.isArray(value)?value:[value]
  for(const v of values){
    if(!allowed.some(option=>option.id===v)) throw new Error('INVALID_PREFERENCE_VALUE')
  }
  return {
    ...emptyInsightState(),
    ...insight,
    declaredPreferences:{...(insight?.declaredPreferences||{}),[key]:value},
    updatedAt:Date.now(),
  }
}

export function createPsychometricObservation({
  instrumentId,dimensionId,value,scale=null,source='self-report',consentPurpose='student-insight',
  instrumentVersion=null,timestamp=Date.now(),
}){
  const instrument=PSYCHOMETRIC_INSTRUMENTS[instrumentId]
  if(!instrument) throw new Error('UNKNOWN_INSTRUMENT')
  if(!dimensionId) throw new Error('MISSING_DIMENSION')
  if(value===undefined || value===null) throw new Error('MISSING_VALUE')
  return {
    id:`obs-${instrumentId}-${dimensionId}-${timestamp}`,
    type:'kamin:Observation',
    construct:instrument.construct,
    dimensionId,
    value,
    scale,
    source,
    instrumentId,
    instrumentVersion:instrumentVersion||instrument.sourceVersion||instrument.version||'unspecified',
    consentPurpose,
    generatedAt:timestamp,
    status:'self-reported',
  }
}

export function addPsychometricObservation(insight,observation){
  if(!observation?.instrumentId) throw new Error('INVALID_OBSERVATION')
  return {
    ...emptyInsightState(),
    ...insight,
    observations:[...(insight?.observations||[]),observation],
    updatedAt:Date.now(),
  }
}

export function markInstrumentCompleted(insight,instrumentId,{version=null,timestamp=Date.now()}={}){
  if(!PSYCHOMETRIC_INSTRUMENTS[instrumentId]) throw new Error('UNKNOWN_INSTRUMENT')
  const existing=(insight?.completedInstruments||[]).filter(item=>item.instrumentId!==instrumentId)
  return {
    ...emptyInsightState(),
    ...insight,
    completedInstruments:[...existing,{instrumentId,version,timestamp}],
    updatedAt:timestamp,
  }
}

/*
 * Intentionally absent:
 * - no locally invented psychometric questions
 * - no normative percentiles
 * - no diagnosis labels
 * - no universal Person↔Opportunity score
 *
 * Instruments are loaded only after their exact items/scoring/licensing and
 * Arabic validation status are pinned in the psychometric registry.
 */

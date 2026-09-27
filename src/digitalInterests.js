// Local, bounded topic suggestions. No personality, health or sensitive-trait inference.
export const DIGITAL_METHOD = 'kamin-topic-keywords-v1'
export const DIGITAL_NOTICE = 'digital-interests-consent-2026-09-27'
export const DIGITAL_PURPOSE = 'urn:kamin:purpose:reviewed-interest-context'
export const DIGITAL_TOPICS = [
  {id:'data',label:{ar:'تحليل البيانات',en:'Data analysis'},terms:['تحليل البيانات','علم البيانات','احصاء','statistics','data analysis','data science','sql','power bi'],targets:['job-data-analyst','training-data-portfolio','training-sql-analytics','training-python-analytics','training-bi-dashboard']},
  {id:'ai',label:{ar:'الذكاء الاصطناعي',en:'Artificial intelligence'},terms:['الذكاء الاصطناعي','تعلم الالة','تعلم عميق','artificial intelligence','machine learning','deep learning'],targets:['training-ai-work']},
  {id:'software',label:{ar:'تطوير البرمجيات',en:'Software development'},terms:['برمجة','البرمجة','تطوير البرمجيات','تطوير تطبيقات','software','programming','python','javascript','react'],targets:['job-software-engineer']},
  {id:'cyber',label:{ar:'الأمن السيبراني',en:'Cybersecurity'},terms:['امن سيبراني','الامن السيبراني','امن المعلومات','cybersecurity','cyber security','network security'],targets:['job-cyber-analyst']},
  {id:'product',label:{ar:'تصميم المنتجات وتجربة المستخدم',en:'Product design & user experience'},terms:['تجربة المستخدم','تصميم المنتجات','تحليل المتطلبات','user experience','product design','ux','ui','figma'],targets:['job-business-analyst','training-product-discovery']},
  {id:'projects',label:{ar:'إدارة المشاريع',en:'Project management'},terms:['ادارة المشاريع','ادارة مشروع','project management','scrum','agile'],targets:['job-project-coordinator']},
]
const topicById = id => DIGITAL_TOPICS.find(topic => topic.id === id)
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const normalizeText = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي')
const tokens = value => (normalizeText(value).match(/[\p{L}\p{N}]+/gu) || []).map(token=>token.replace(/^[وفبك](?=ال[\p{L}]{2})/u,'').replace(/^[وفب](?=[a-z])/u,''))

export function emptyDigitalInterests(){
  return {noticeVersion:DIGITAL_NOTICE,analysisConsent:false,contextConsent:false,grantedAt:null,confirmed:[]}
}

// Strict allowlist: original posts, account names and imported extension fields never persist.
export function normalizeDigitalInterests(value){
  const empty = emptyDigitalInterests()
  if(value?.analysisConsent !== true || value?.noticeVersion !== DIGITAL_NOTICE || !validDate(value.grantedAt)) return empty
  const seen = new Set()
  const confirmed = (Array.isArray(value.confirmed) ? value.confirmed : []).flatMap(item => {
    const topic = topicById(item?.topicId)
    if(!topic || seen.has(topic.id) || !validDate(item.confirmedAt) || item.methodVersion !== DIGITAL_METHOD) return []
    const matchedTerms = topic.terms.filter(term => Array.isArray(item.matchedTerms) && item.matchedTerms.includes(term))
    if(!matchedTerms.length) return []
    seen.add(topic.id)
    return [{topicId:topic.id,matchedTerms,confirmedAt:item.confirmedAt,methodVersion:DIGITAL_METHOD,sourceType:'student-selected-text',reviewStatus:'student-confirmed'}]
  })
  return {...empty,analysisConsent:true,contextConsent:value.contextConsent===true,grantedAt:value.grantedAt,confirmed}
}

export function grantDigitalAnalysis(){
  return {...emptyDigitalInterests(),analysisConsent:true,grantedAt:new Date().toISOString()}
}

export function suggestDigitalInterests(text, consent){
  if(!normalizeDigitalInterests(consent).analysisConsent) throw new Error('DIGITAL_CONSENT_REQUIRED')
  if(typeof text !== 'string' || !text.trim()) throw new Error('DIGITAL_TEXT_REQUIRED')
  if(text.length > 4000) throw new Error('DIGITAL_TEXT_TOO_LONG')
  // Whole token sequences avoid matches such as React in "reaction" or AI in "paid".
  const haystack = ` ${tokens(text).join(' ')} `
  return DIGITAL_TOPICS.flatMap(topic => {
    const matchedTerms = topic.terms.filter(term => haystack.includes(` ${tokens(term).join(' ')} `))
    return matchedTerms.length ? [{topicId:topic.id,matchedTerms,methodVersion:DIGITAL_METHOD}] : []
  })
}

export function confirmDigitalInterest(value, candidate){
  const current = normalizeDigitalInterests(value)
  if(!current.analysisConsent) throw new Error('DIGITAL_CONSENT_REQUIRED')
  return normalizeDigitalInterests({...current,confirmed:[
    ...current.confirmed.filter(item => item.topicId !== candidate.topicId),
    {...candidate,confirmedAt:new Date().toISOString()},
  ]})
}

export function removeDigitalInterest(value, topicId){
  const current = normalizeDigitalInterests(value)
  return {...current,confirmed:current.confirmed.filter(item => item.topicId !== topicId)}
}

export function digitalInterestClaims(value){
  const current = normalizeDigitalInterests(value)
  return current.confirmed.map(item => ({
    ...item,topic:topicById(item.topicId),
    topicIri:`urn:kamin:topic:${item.topicId}`,
    evidenceIri:`urn:kamin:evidence:digital-interest:${item.topicId}`,
    claimIri:`urn:kamin:claim:digital-interest:${item.topicId}`,
    consentIri:'urn:kamin:consent:digital-interests',
    contextAllowed:current.contextConsent,
    grantedAt:current.grantedAt,
  }))
}

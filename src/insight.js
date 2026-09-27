import { emptyPerson360 } from './person360.js'
import { emptyDigitalInterests } from './digitalInterests.js'

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
      {id:'realistic',label:{ar:'عملي وتطبيقي',en:'Realistic / hands-on'}},
      {id:'investigative',label:{ar:'تحليلي واستقصائي',en:'Investigative / analytical'}},
      {id:'artistic',label:{ar:'إبداعي وتصميمي',en:'Artistic / creative'}},
      {id:'social',label:{ar:'مساعدة وتطوير الآخرين',en:'Social / helping'}},
      {id:'enterprising',label:{ar:'مبادرة وتأثير وقيادة',en:'Enterprising / influence'}},
      {id:'conventional',label:{ar:'تنظيم ودقة وإجراءات',en:'Conventional / structured'}},
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
    assessments:{},
    completedInstruments:[],
    updatedAt:null,
  }
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

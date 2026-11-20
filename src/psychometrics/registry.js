export const PSYCHOMETRIC_REGISTRY_VERSION = '0.1.0'
// Task 28: the notes are shown on Interests & goal, so they are in plain words (ids and fields unchanged).

export const PSYCHOMETRIC_INSTRUMENTS = {
  onetMiniIp30: {
    id:'onet-mini-ip-30',
    name:{ar:'O*NET Mini Interest Profiler',en:'O*NET Mini Interest Profiler'},
    construct:'RIASEC occupational interests',
    dimensions:['Realistic','Investigative','Artistic','Social','Enterprising','Conventional'],
    items:30,
    responseScale:{min:1,max:5,anchors:['Strongly Dislike','Dislike','Unsure','Like','Strongly Like']},
    officialUrl:'https://www.onetcenter.org/IP.html',
    sourceSystem:'O*NET',
    sourceVersion:'current',
    status:'research-candidate-saudi-validation-required',
    decisionRole:'none-until-saudi-validation',
    productionUse:false,
    localValidationRequired:true,
    notes:{
      ar:'مرشح بحثي فقط. لا تُستخدم درجات الأداة في Fit قبل دراسة سعودية للثبات/البنية/الملاءمة الثقافية، مع حسم الترخيص قبل إعادة توزيع البنود.',
      en:'Research candidate only. Instrument scores do not affect Fit before Saudi reliability/structure/cultural validation, and redistribution licensing must be resolved first.',
    },
  },
  ipip50Arabic: {
    id:'ipip-50-arabic',
    name:{ar:'IPIP 50-item Big-Five markers — Arabic adaptation',en:'IPIP 50-item Big-Five markers — Arabic adaptation'},
    construct:'Big Five personality markers',
    dimensions:['Extraversion','Agreeableness','Conscientiousness','Emotional Stability','Openness/Intellect'],
    items:50,
    responseScale:{min:1,max:5,anchors:['Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree']},
    officialUrl:'https://ipip.ori.org/ArabicBigFiveFactorMarkers2.htm',
    sourceSystem:'IPIP',
    status:'research-candidate-saudi-validation-required',
    decisionRole:'none-until-saudi-validation',
    productionUse:false,
    localValidationRequired:true,
    notes:{
      ar:'البنود العامة في الملكية العامة. النسخة العربية المنشورة اختُبرت في عينة من بلاد الشام؛ لا تُعامل كمعايير سعودية قبل تحقق محلي.',
      en:'IPIP items are public domain. The published Arabic adaptation was evaluated in a Levant sample; do not treat it as Saudi norms before local validation.',
    },
  },
  onetWorkValues: {
    id:'onet-work-values',
    name:{ar:'O*NET Work Values',en:'O*NET Work Values'},
    construct:'Work values',
    dimensions:['Achievement','Independence','Recognition','Relationships','Support','Working Conditions'],
    officialUrl:'https://www.onetcenter.org/database.html',
    sourceSystem:'O*NET',
    status:'reference-model',
    decisionRole:'preference-fit',
    notes:{
      ar:'نستخدم أبعاد القيم لوصف المهن وربطها. أداة القياس الموجهة للطالب تحتاج اختيارًا وتحققًا منفصلين.',
      en:'We use the work-value dimensions to describe and link occupations. A student-facing measurement instrument needs a separate, validated design choice.',
    },
  },
  onetWorkStyles: {
    id:'onet-work-styles',
    name:{ar:'O*NET Work Styles',en:'O*NET Work Styles'},
    construct:'Work-related personality tendencies',
    officialUrl:'https://www.onetcenter.org/database.html',
    sourceSystem:'O*NET',
    sourceVersion:'31.0',
    status:'reference-model',
    decisionRole:'work-environment-fit',
    notes:{
      ar:'O*NET يربط أنماط العمل بالمهن. نستخدم المفاهيم والروابط، ولا نحوّل تقديرات المهن إلى تشخيص للفرد.',
      en:'O*NET links Work Styles to occupations. We reuse its concepts and links, never occupation ratings as a diagnosis of an individual.',
    },
  },
}

export const PSYCHOMETRIC_GOVERNANCE = {
  rules:[
    'No psychometric result may create or delete academic skill evidence.',
    'No personality or interest result may satisfy a formal eligibility gate.',
    'Every observation must retain instrument ID, version, timestamp, response scale, consent purpose, and provenance.',
    'Raw item responses and derived scores are distinct data objects.',
    'Use-case-specific weights must be learned or explicitly governed; never assume equal weights across domains.',
    'Until Saudi validation is complete, instrument scores must not affect Fit judgments or eligibility and must not be presented as Saudi norms.',
    'Self-declared RIASEC/work-value labels are product preferences, not psychometric scores, and must remain clearly separated from validated instruments.',
  ],
  prohibitedLabels:['diagnosis','mental fitness','psychological suitability','normal/abnormal'],
}

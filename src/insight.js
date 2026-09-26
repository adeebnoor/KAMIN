export const INSIGHT_VERSION = 'kamin-insight-v1'

export const INSIGHT_SCALE = {
  ar: ['لا ينطبق إطلاقًا','قليلًا','إلى حد ما','بدرجة كبيرة','ينطبق جدًا'],
  en: ['Not at all','A little','Somewhat','Quite a lot','Very much'],
}

export const INSIGHT_DOMAINS = {
  interests: {
    ar:'الاهتمامات',
    en:'Interests',
    note:{
      ar:'ما نوع الأنشطة التي تستمتع بها أو تنجذب إليها؟',
      en:'What kinds of activities naturally attract you?',
    },
    dimensions:{
      practical:{ar:'عملي وتطبيقي',en:'Hands-on & practical'},
      analytical:{ar:'تحليلي واستقصائي',en:'Analytical & investigative'},
      creative:{ar:'إبداعي وتصميمي',en:'Creative & expressive'},
      people:{ar:'مساعدة وتطوير الآخرين',en:'Helping & developing others'},
      enterprising:{ar:'مبادرة وتأثير',en:'Initiative & influence'},
      organizing:{ar:'تنظيم ودقة',en:'Structure & organization'},
    },
  },
  values: {
    ar:'قيم العمل',
    en:'Work values',
    note:{
      ar:'ما الذي يجب أن توفره لك البيئة حتى تشعر أن العمل يستحق وقتك؟',
      en:'What must an environment provide for work to feel worthwhile?',
    },
    dimensions:{
      achievement:{ar:'الإنجاز',en:'Achievement'},
      independence:{ar:'الاستقلالية',en:'Independence'},
      relationships:{ar:'العلاقات',en:'Relationships'},
      recognition:{ar:'التقدير',en:'Recognition'},
      support:{ar:'الدعم',en:'Support'},
      conditions:{ar:'جودة ظروف العمل',en:'Working conditions'},
    },
  },
  motivations: {
    ar:'الدوافع',
    en:'Motivations',
    note:{
      ar:'ما الذي يدفعك لبذل جهد إضافي والاستمرار؟',
      en:'What makes you invest extra effort and persist?',
    },
    dimensions:{
      mastery:{ar:'التعلم والإتقان',en:'Learning & mastery'},
      impact:{ar:'الأثر والمعنى',en:'Impact & meaning'},
      autonomy:{ar:'حرية الاختيار',en:'Autonomy'},
      leadership:{ar:'القيادة والتأثير',en:'Leadership & influence'},
      security:{ar:'الاستقرار والوضوح',en:'Stability & predictability'},
    },
  },
  workstyle: {
    ar:'أسلوب العمل',
    en:'Work style',
    note:{
      ar:'كيف تفضل أن تنجز العمل يوميًا؟',
      en:'How do you prefer to get work done day to day?',
    },
    dimensions:{
      collaboration:{ar:'تعاون الفريق',en:'Team collaboration'},
      solo:{ar:'التركيز الفردي',en:'Independent focus'},
      structure:{ar:'هيكلة وخطة واضحة',en:'Clear structure & plans'},
      flexibility:{ar:'مرونة وتجريب',en:'Flexibility & experimentation'},
      depth:{ar:'العمق قبل السرعة',en:'Depth before speed'},
    },
  },
  tendencies: {
    ar:'ميول شخصية للعمل',
    en:'Work-related tendencies',
    note:{
      ar:'هذه ميول ذاتية وليست تشخيصًا نفسيًا أو اختبار شخصية سريريًا.',
      en:'These are self-reported work tendencies, not a diagnosis or clinical personality test.',
    },
    dimensions:{
      curiosity:{ar:'الفضول والانفتاح على الجديد',en:'Curiosity & openness'},
      organization:{ar:'التنظيم والالتزام',en:'Organization & follow-through'},
      sociability:{ar:'الارتياح للتفاعل الاجتماعي',en:'Social engagement'},
      cooperation:{ar:'التعاون ومراعاة الآخرين',en:'Cooperation & consideration'},
      composure:{ar:'الهدوء تحت ضغط العمل',en:'Composure under work pressure'},
    },
  },
}

export const INSIGHT_ITEMS = [
  {id:'i_practical',domain:'interests',dimension:'practical',ar:'أستمتع ببناء شيء ملموس أو إصلاحه أو تجربته عمليًا.',en:'I enjoy building, fixing, or testing something hands-on.'},
  {id:'i_analytical',domain:'interests',dimension:'analytical',ar:'أستمتع بحل المشكلات الغامضة وتحليل البيانات أو الأدلة.',en:'I enjoy solving ambiguous problems and analyzing data or evidence.'},
  {id:'i_creative',domain:'interests',dimension:'creative',ar:'أستمتع بابتكار أفكار أو تصاميم أو طرق جديدة للتعبير.',en:'I enjoy creating ideas, designs, or new ways to express something.'},
  {id:'i_people',domain:'interests',dimension:'people',ar:'أستمتع بشرح الأمور للآخرين أو مساعدتهم على التطور.',en:'I enjoy explaining things to others or helping them develop.'},
  {id:'i_enterprising',domain:'interests',dimension:'enterprising',ar:'أستمتع ببدء المبادرات وإقناع الآخرين وتحريك العمل للأمام.',en:'I enjoy starting initiatives, persuading others, and moving work forward.'},
  {id:'i_organizing',domain:'interests',dimension:'organizing',ar:'أستمتع بترتيب المعلومات والعمليات والتأكد من الدقة.',en:'I enjoy organizing information and processes and ensuring accuracy.'},

  {id:'v_achievement',domain:'values',dimension:'achievement',ar:'يهمني أن أرى نتيجة واضحة أستطيع أن أفتخر بها.',en:'It matters to me to produce clear results I can be proud of.'},
  {id:'v_independence',domain:'values',dimension:'independence',ar:'يهمني أن أمتلك مساحة لاتخاذ القرار بطريقتي.',en:'It matters to me to have room to make decisions in my own way.'},
  {id:'v_relationships',domain:'values',dimension:'relationships',ar:'يهمني أن تكون العلاقات والاحترام المتبادل جزءًا قويًا من بيئة العمل.',en:'Strong relationships and mutual respect matter to me at work.'},
  {id:'v_recognition',domain:'values',dimension:'recognition',ar:'يهمني أن يتم تقدير المساهمة الجيدة وإظهارها بوضوح.',en:'It matters to me that good contributions are visibly recognized.'},
  {id:'v_support',domain:'values',dimension:'support',ar:'يهمني وجود مدير أو فريق يقدم التوجيه والدعم عند الحاجة.',en:'It matters to me to have a manager or team that provides support when needed.'},
  {id:'v_conditions',domain:'values',dimension:'conditions',ar:'يهمني أن تكون ساعات العمل والموارد والاستقرار مناسبة للحياة التي أريدها.',en:'Work hours, resources, and stability should fit the life I want.'},

  {id:'m_mastery',domain:'motivations',dimension:'mastery',ar:'أتحمس عندما أشعر أنني أتعلم شيئًا صعبًا وأصبح أفضل فيه.',en:'I am energized by learning something difficult and getting better at it.'},
  {id:'m_impact',domain:'motivations',dimension:'impact',ar:'أتحمس أكثر عندما أفهم من سيستفيد من عملي ولماذا يهم.',en:'I am more motivated when I understand who benefits from my work and why it matters.'},
  {id:'m_autonomy',domain:'motivations',dimension:'autonomy',ar:'يزداد حماسي عندما أستطيع اختيار الطريقة المناسبة لتحقيق الهدف.',en:'I am more motivated when I can choose how to achieve the goal.'},
  {id:'m_leadership',domain:'motivations',dimension:'leadership',ar:'أتحمس عندما أستطيع توجيه فريق أو التأثير في قرار مهم.',en:'I am energized by guiding a team or influencing an important decision.'},
  {id:'m_security',domain:'motivations',dimension:'security',ar:'أعمل بأفضل صورة عندما أعرف التوقعات والمسار القادم بوضوح.',en:'I work best when expectations and the path ahead are clear.'},

  {id:'w_collaboration',domain:'workstyle',dimension:'collaboration',ar:'أفضل إنجاز جزء كبير من عملي بالتعاون والنقاش مع الآخرين.',en:'I prefer to do a substantial part of my work through collaboration and discussion.'},
  {id:'w_solo',domain:'workstyle',dimension:'solo',ar:'أحتاج فترات طويلة من التركيز الفردي لأقدم أفضل ما لدي.',en:'I need long periods of independent focus to do my best work.'},
  {id:'w_structure',domain:'workstyle',dimension:'structure',ar:'أفضل الأهداف والأدوار والخطوات المحددة بوضوح.',en:'I prefer clearly defined goals, roles, and steps.'},
  {id:'w_flexibility',domain:'workstyle',dimension:'flexibility',ar:'أفضل مساحة تسمح بتغيير الخطة والتجريب أثناء العمل.',en:'I prefer room to change the plan and experiment while working.'},
  {id:'w_depth',domain:'workstyle',dimension:'depth',ar:'أفضل التعمق والتحقق حتى لو استغرق العمل وقتًا أطول.',en:'I prefer depth and verification even when it takes longer.'},

  {id:'t_curiosity_1',domain:'tendencies',dimension:'curiosity',ar:'أبحث عادةً عن أفكار أو تجارب جديدة حتى دون أن يطلب مني ذلك.',en:'I usually seek out new ideas or experiences without being asked.'},
  {id:'t_curiosity_2',domain:'tendencies',dimension:'curiosity',ar:'أشعر بالفضول تجاه الطرق المختلفة لحل المشكلة نفسها.',en:'I am curious about different ways to solve the same problem.'},
  {id:'t_organization_1',domain:'tendencies',dimension:'organization',ar:'أحوّل العمل الكبير إلى خطوات وأتابع ما التزمت به.',en:'I break large work into steps and follow through on commitments.'},
  {id:'t_organization_2',domain:'tendencies',dimension:'organization',ar:'أراجع التفاصيل قبل أن أعتبر المهمة مكتملة.',en:'I check details before I consider a task complete.'},
  {id:'t_sociability_1',domain:'tendencies',dimension:'sociability',ar:'أشعر براحة في بدء الحديث والعمل مع أشخاص جدد.',en:'I feel comfortable starting conversations and working with new people.'},
  {id:'t_sociability_2',domain:'tendencies',dimension:'sociability',ar:'أستمد طاقة من النقاش والاجتماعات التفاعلية.',en:'Interactive discussions and meetings tend to energize me.'},
  {id:'t_cooperation_1',domain:'tendencies',dimension:'cooperation',ar:'أحاول فهم وجهة نظر الآخرين قبل تثبيت موقفي.',en:'I try to understand other viewpoints before fixing my position.'},
  {id:'t_cooperation_2',domain:'tendencies',dimension:'cooperation',ar:'أبحث عادةً عن حل يحافظ على العمل والعلاقة معًا.',en:'I usually look for a solution that preserves both the work and the relationship.'},
  {id:'t_composure_1',domain:'tendencies',dimension:'composure',ar:'عندما يرتفع ضغط العمل أستطيع غالبًا ترتيب الأولويات بدل الاندفاع.',en:'When work pressure rises, I can usually prioritize rather than react impulsively.'},
  {id:'t_composure_2',domain:'tendencies',dimension:'composure',ar:'بعد انتكاسة في العمل أستطيع العودة للمهمة دون أن أفقد تركيزي لفترة طويلة.',en:'After a work setback, I can usually return to the task without losing focus for long.'},
]

export function emptyInsightState(){
  return {
    version:INSIGHT_VERSION,
    responses:{},
    completed:false,
    completedAt:null,
  }
}

export function insightCompletion(responses={}){
  const answered=INSIGHT_ITEMS.filter(item=>Number.isFinite(Number(responses[item.id]))).length
  return {
    answered,
    total:INSIGHT_ITEMS.length,
    ratio:INSIGHT_ITEMS.length ? answered/INSIGHT_ITEMS.length : 0,
  }
}

const descriptor=(score,lang)=>{
  if(score>=4) return lang==='ar'?'بارز':'Prominent'
  if(score>=3) return lang==='ar'?'متوازن':'Balanced'
  return lang==='ar'?'أقل بروزًا حاليًا':'Less prominent currently'
}

export function computeInsightProfile(responses={},lang='ar'){
  const domains={}
  for(const [domainId,domain] of Object.entries(INSIGHT_DOMAINS)){
    const dimensions=[]
    for(const [dimensionId,labels] of Object.entries(domain.dimensions)){
      const items=INSIGHT_ITEMS.filter(item=>item.domain===domainId && item.dimension===dimensionId)
      const values=items.map(item=>Number(responses[item.id])).filter(value=>Number.isFinite(value)&&value>=1&&value<=5)
      if(!values.length) continue
      const score=values.reduce((sum,value)=>sum+value,0)/values.length
      dimensions.push({
        id:dimensionId,
        label:labels[lang],
        score,
        descriptor:descriptor(score,lang),
        evidenceCount:values.length,
      })
    }
    dimensions.sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id))
    domains[domainId]={
      id:domainId,
      label:domain[lang],
      note:domain.note[lang],
      dimensions,
      top:dimensions.slice(0,2),
    }
  }
  return {domains,completion:insightCompletion(responses)}
}

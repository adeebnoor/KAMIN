export const PROFILE_DIMENSIONS=Object.freeze({
  academic:{id:'academic',kind:'evidence',description:'Education level, programme context, courses, learning outcomes and verified academic evidence'},
  skills:{id:'skills',kind:'evidence',description:'Evidence-backed competencies and skills'},
  experience:{id:'experience',kind:'evidence',description:'Projects, work, internships and achievements with provenance'},
  interests:{id:'interests',kind:'self-report',description:'RIASEC or other validated occupational-interest observations'},
  personality:{id:'personality',kind:'self-report',description:'Validated personality-marker observations; never a formal gate'},
  values:{id:'values',kind:'declared-or-validated',description:'Work values/preferences with source and instrument status'},
  workStyle:{id:'workStyle',kind:'mixed',description:'Person work-style observations compared with target environment/work-style requirements'},
  goals:{id:'goals',kind:'declared',description:'Declared career, learning or development goals'},
  constraints:{id:'constraints',kind:'declared',description:'Time, location, cost, language, accessibility and other user-owned constraints'},
})

export const MATCHING_USE_CASES=Object.freeze({
  personPersonSimilarity:{
    id:'person-person-similarity',
    targetType:'Person',
    purpose:'Find people with similar evidence/profile patterns',
    dimensions:['academic','skills','experience','interests','personality','values','workStyle','goals'],
    hardGates:[],
    output:'dimension-level similarity + explanations',
    weightPolicy:'learned-or-governed',
  },
  personPersonComplementarity:{
    id:'person-person-complementarity',
    targetType:'Person',
    purpose:'Find people whose evidence/profile patterns complement each other for a defined team goal',
    dimensions:['skills','experience','interests','workStyle','goals'],
    hardGates:['shared-team-goal'],
    output:'coverage gaps + complementary mechanisms',
    weightPolicy:'use-case-specific-learned-or-governed',
  },
  personJobFit:{
    id:'person-job-fit',
    targetType:'Job',
    purpose:'Explain person-to-job suitability without turning personality into an exclusion gate',
    dimensions:['academic','skills','experience','interests','personality','values','workStyle','goals','constraints'],
    hardGates:['formal-eligibility','legally-required-credential'],
    output:'eligibility + mechanisms of fit + bridgeable gaps',
    weightPolicy:'outcome-learned-or-governed',
  },
  personCourseFit:{
    id:'person-course-fit',
    targetType:'Course',
    purpose:'Recommend learning that closes a useful gap rather than merely resembling the learner',
    dimensions:['academic','skills','interests','goals','constraints'],
    hardGates:['course-prerequisite'],
    output:'redundancy check + gap closure + goal relevance + conditions',
    weightPolicy:'outcome-learned-or-governed',
  },
  personTrainingFit:{
    id:'person-training-fit',
    targetType:'Training',
    purpose:'Match training to a verified/declared development need and delivery constraints',
    dimensions:['skills','experience','interests','goals','constraints','workStyle'],
    hardGates:['training-prerequisite'],
    output:'development-gap fit + delivery fit + conditions',
    weightPolicy:'outcome-learned-or-governed',
  },
})

export const FIT_MECHANISM_TYPES=Object.freeze([
  'formal-eligibility',
  'academic-evidence',
  'skill-alignment',
  'experience-alignment',
  'interest-alignment',
  'work-style-alignment',
  'values-alignment',
  'goal-alignment',
  'constraint-compatibility',
  'skill-gap',
  'redundancy',
  'complementarity',
])

export function getMatchingUseCase(id){
  return Object.values(MATCHING_USE_CASES).find(item=>item.id===id)||null
}

export function validateMatchingModel(){
  const errors=[]
  for(const useCase of Object.values(MATCHING_USE_CASES)){
    if(!useCase.dimensions.length) errors.push(`${useCase.id}:DIMENSIONS_REQUIRED`)
    if(/equal/i.test(useCase.weightPolicy)) errors.push(`${useCase.id}:EQUAL_WEIGHT_POLICY_FORBIDDEN`)
    if(useCase.dimensions.some(id=>!PROFILE_DIMENSIONS[id])) errors.push(`${useCase.id}:UNKNOWN_DIMENSION`)
  }
  return {valid:errors.length===0,errors}
}

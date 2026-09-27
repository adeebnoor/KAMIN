// A bounded, versioned rule set over the paths evaluated by the matching engine.
// These conclusions are contextual/evidence links, never employment eligibility.
export const INFERENCE_VERSION = 'kamin-relations-v2'
export const INFERENCE_RULES = {
  'R1': { ar:'دليل على قدرة + مسار يتطلبها ← علاقة دليل بالمسار', en:'Capability evidence + a pathway requiring it → evidence connection' },
  'R2': { ar:'هدف تختاره + مسار يدعمه ← ارتباط بهدفك', en:'Your declared goal + a pathway supporting it → goal connection' },
  'R3': { ar:'تفضيل تختاره + مسار متوافق معه ← ارتباط سياقي', en:'Your declared preference + a compatible pathway → contextual connection' },
  'R4': { ar:'اهتمام تؤكده + مسار مرتبط بالموضوع ← ارتباط باهتمامك', en:'Student-confirmed interest + a pathway about that topic → interest connection' },
}
const edge = (subject, predicate, object) => ({ subject, predicate, object })
export function inferRelations(personId, paths = []) {
  return paths.filter(p => p.status === 'supported').flatMap(p => {
    const target = p.targetNode || `urn:kamin:target:${p.targetId}`
    let ruleId, predicate, premises
    if (p.kind === 'capability-match') {
      ruleId = 'R1'; predicate = 'kamin:hasCapabilityEvidenceFor'
      premises = p.relationChain.map(e => edge(e.from, e.predicate, e.to))
    } else if (p.kind === 'goal-alignment') {
      ruleId = 'R2'; predicate = 'kamin:hasGoalContextFor'
      premises = [edge(personId, 'kamin:pursuesGoal', p.personGoalId), edge(target, 'kamin:supportsGoal', p.targetGoalId)]
    } else if (p.kind === 'preference-alignment') {
      ruleId = 'R3'; predicate = 'kamin:hasPreferenceContextFor'
      premises = [edge(personId, `kamin:prefers:${p.scheme}`, p.personPreferenceId), edge(target, p.targetRelation, p.personPreferenceId)]
    } else if (p.kind === 'digital-interest-alignment') {
      ruleId = 'R4'; predicate = 'kamin:hasInterestContextFor'
      premises = [edge(personId, 'kamin:hasConfirmedInterest', p.personTopicId), edge(target, 'kamin:relatesToTopic', p.personTopicId)]
    } else return []
    return [{
      id:`urn:kamin:inference:${p.targetId}:${ruleId}:${p.capabilityKey || p.scheme || p.goal || p.topicId}`,
      ruleId, ruleVersion:INFERENCE_VERSION, kind:p.kind,
      conclusion:edge(personId, predicate, target), premises,
      claimId:p.claimId || p.personClaimId,
      evidenceId:p.evidenceId || 'urn:kamin:evidence:self-declaration',
      evidenceStrength:p.evidenceStrength || 'self-reported',
      capabilityKey:p.capabilityKey || null, scheme:p.scheme || null,
      topicId:p.topicId || null,
      scope:ruleId === 'R1' ? 'pilot-capability-evidence' : 'self-declared-context',
    }]
  })
}

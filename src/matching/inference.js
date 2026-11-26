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
// Task 04: a capability-evidence conclusion (R1) must rest on a claim and evidence that still
// exist in the person graph; anything else is an orphan and is dropped.
export function sweepOrphanInferences(inferences = [], graph = null) {
  if (!graph) return inferences
  const claims = new Set((graph.claims || []).map(c => c['@id']))
  const entities = new Set((graph.entities || []).map(e => e['@id']))
  return inferences.filter(i => i.ruleId !== 'R1' || (claims.has(i.claimId) && entities.has(i.evidenceId)))
}
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
    // Task 76: a conclusion stands only on whole premises. A premise without a subject or an object (as R2 had for a
    // pathway-id goal before the engine named its goal node) is never exported as {"@id": null}; the conclusion is dropped.
    if (premises.some(e => !e.subject || !e.object)) return []
    return [{
      // Task 78: a 2nd or 3rd chosen value of a scheme has its own id (…:R3:<scheme>:<option>); the first keeps …:R3:<scheme>.
      id:`urn:kamin:inference:${p.targetId}:${ruleId}:${p.capabilityKey || p.choiceKey || p.scheme || p.goal || p.topicId}`,
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

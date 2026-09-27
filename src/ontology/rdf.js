import { JSON_LD_CONTEXT } from './registry.js'
import { buildTargetSemanticGraph } from '../matching/graph.js'
import { INFERENCE_RULES, INFERENCE_VERSION } from '../matching/inference.js'

const ref = id => ({ '@id':id })
const tripleNode = ({subject,predicate,object}) => ({ '@id':subject, [predicate]:ref(object) })
const statement = (id, triple) => ({ '@id':id, '@type':'rdf:Statement', 'rdf:subject':ref(triple.subject), 'rdf:predicate':ref(triple.predicate), 'rdf:object':ref(triple.object) })

// Separate named graphs keep inputs, reference knowledge and inferred links
// distinguishable. The original qualified claims retain their provenance.
export function buildInferenceDataset(personGraph, match) {
  const target = buildTargetSemanticGraph(match)
  const inputGraph = 'urn:kamin:graph:profile-input'
  const referenceGraph = 'urn:kamin:graph:reference'
  const inferredGraph = 'urn:kamin:graph:inferred'
  const claims = (personGraph.claims || []).filter(c => !['inactive','withdrawn'].includes(c.status))
  const profile = {...personGraph,claims}
  delete profile['@context']
  const references = target.edges.map(tripleNode)
  const inferences = match.inferences || []
  const proof = inferences.flatMap(result => [
    {
      ...statement(result.id,result.conclusion),
      '@type':['rdf:Statement','kamin:Inference'],
      'prov:wasDerivedFrom':[ref(result.claimId),ref(result.evidenceId),...result.premises.map((_,i)=>ref(`${result.id}:premise:${i}`))],
      'prov:wasGeneratedBy':ref(`urn:kamin:rule:${INFERENCE_VERSION}:${result.ruleId}`),
      'kamin:scope':result.scope,
      'kamin:evidenceStrength':result.evidenceStrength,
      'kamin:assertedIn':ref(inferredGraph),
    },
    ...result.premises.map((premise,i)=>statement(`${result.id}:premise:${i}`,premise)),
  ])
  return {
    '@context':JSON_LD_CONTEXT,
    '@graph':[
      {'@id':inputGraph,'@graph':[profile,...claims.filter(c=>c.object && c.subject===personGraph['@id']).map(tripleNode),...(personGraph.entities||[]).filter(e=>e.course).map(e=>tripleNode({subject:e['@id'],predicate:'kamin:courseContext',object:e.course}))]},
      {'@id':referenceGraph,'@graph':[...target.entities,...references,{'@id':target['@id'],edges:target.edges,version:target.version}]},
      {'@id':inferredGraph,'@graph':inferences.map(r=>tripleNode(r.conclusion))},
      {'@id':'urn:kamin:graph:explanations','@graph':[
        ...proof,
        ...Object.entries(INFERENCE_RULES).map(([id,label])=>({'@id':`urn:kamin:rule:${INFERENCE_VERSION}:${id}`,'@type':'prov:Activity',label,'kamin:version':INFERENCE_VERSION})),
        {'@id':`${inferredGraph}:assessment`,'@type':'kamin:FitAssessment','kamin:fitTarget':ref(target['@id']),'kamin:judgment':match.judgment,'kamin:calibrationStatus':match.calibrationStatus,'kamin:ruleVersion':match.ruleVersion},
      ]},
    ],
  }
}

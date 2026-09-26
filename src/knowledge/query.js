import { ictKnowledgeGraph, KNOWLEDGE_SOURCES } from './ictKgV1.js'

const entityIndex=new Map(ictKnowledgeGraph.entities.map(entity=>[entity['@id'],entity]))
const sourceIndex=new Map(Object.values(KNOWLEDGE_SOURCES).map(source=>[source.id,source]))

const localSkillKey=id=>{
  const marker='urn:kamin:skill:'
  return String(id||'').startsWith(marker)?String(id).slice(marker.length):String(id||'')
}

const localize=(value,lang='ar')=>{
  if(typeof value==='string') return value
  return value?.[lang]||value?.ar||value?.en||''
}

export function getKnowledgeEntity(id){
  return entityIndex.get(id)||null
}

export function getKnowledgeSource(id){
  return sourceIndex.get(id)||null
}

export function getTargetKnowledgeSlice(targetId){
  const anchor=ictKnowledgeGraph.edges.find(edge=>
    edge.subject===`urn:kamin:target:${targetId}` &&
    edge.predicate==='kamin:knowledgeAnchor'
  )
  if(!anchor) return null

  const occupationId=anchor.object
  const occupation=getKnowledgeEntity(occupationId)
  const occupationEdges=ictKnowledgeGraph.edges.filter(edge=>edge.subject===occupationId)
  const relatedEntityIds=new Set([occupationId,...occupationEdges.map(edge=>edge.object)])

  const learningEdges=ictKnowledgeGraph.edges.filter(edge=>
    edge.predicate==='kamin:developsCapability' &&
    relatedEntityIds.has(edge.object)
  )
  for(const edge of learningEdges) relatedEntityIds.add(edge.subject)

  return {
    version:ictKnowledgeGraph.version,
    occupation,
    anchor,
    edges:[...occupationEdges,...learningEdges],
    entities:[...relatedEntityIds].map(id=>getKnowledgeEntity(id)).filter(Boolean),
  }
}

export function enrichTargetGraph(targetGraph,targetId){
  const slice=getTargetKnowledgeSlice(targetId)
  if(!slice) return {...targetGraph,knowledgeGraph:null}

  const entities=[...(targetGraph.entities||[]),...(slice.entities||[])]
  const edges=[...(targetGraph.edges||[]),slice.anchor,...(slice.edges||[])]
  return {
    ...targetGraph,
    knowledgeGraph:{
      id:ictKnowledgeGraph['@id'],
      version:ictKnowledgeGraph.version,
      reviewedAt:ictKnowledgeGraph.reviewedAt,
      occupationId:slice.occupation?.['@id']||null,
    },
    entities:[...new Map(entities.map(entity=>[entity['@id'],entity])).values()],
    edges:edges.filter((edge,index,array)=>
      array.findIndex(other=>
        other.subject===edge.subject &&
        other.predicate===edge.predicate &&
        other.object===edge.object &&
        other.sourceId===edge.sourceId
      )===index
    ),
  }
}

export function deriveKnowledgeInsights(personIndex,targetId,{lang='ar'}={}){
  const slice=getTargetKnowledgeSlice(targetId)
  if(!slice){
    return {
      sources:[],
      externalOccupations:[],
      marketSignals:[],
      developmentGaps:[],
      bridges:[],
      workActivities:[],
    }
  }

  const capabilities=personIndex?.capabilities||new Map()
  const occupationId=slice.occupation?.['@id']
  const edges=slice.edges||[]

  const externalOccupations=edges
    .filter(edge=>['skos:exactMatch','skos:relatedMatch','skos:closeMatch'].includes(edge.predicate))
    .map(edge=>{
      const entity=getKnowledgeEntity(edge.object)
      return {
        relation:edge.predicate,
        id:edge.object,
        notation:entity?.notation||null,
        label:localize(entity?.label,lang),
        conceptScheme:entity?.conceptScheme||null,
        sourceUrl:entity?.sourceUrl||null,
        reviewStatus:edge.reviewStatus||null,
      }
    })

  const marketSignals=edges
    .filter(edge=>edge.subject===occupationId && edge.predicate==='kamin:marketSignalsCapability')
    .map(edge=>{
      const entity=getKnowledgeEntity(edge.object)
      return {
        capabilityId:edge.object,
        capabilityKey:edge.objectKey||localSkillKey(edge.object),
        label:localize(entity?.label,lang),
        geography:edge.geography||null,
        observationWindow:edge.observationWindow||null,
        observedShare:edge.observedShare??null,
        sourceId:edge.sourceId||null,
        source:getKnowledgeSource(edge.sourceId),
        decisionRole:edge.decisionRole,
        hasEvidence:(capabilities.get(edge.objectKey||localSkillKey(edge.object))||[]).length>0,
      }
    })
    .sort((a,b)=>(b.observedShare||0)-(a.observedShare||0))

  const developmentGaps=marketSignals.filter(signal=>!signal.hasEvidence)

  const bridgeEdges=ictKnowledgeGraph.edges.filter(edge=>
    edge.predicate==='kamin:developsCapability' &&
    developmentGaps.some(gap=>gap.capabilityId===edge.object)
  )
  const bridgeMap=new Map()
  for(const edge of bridgeEdges){
    const entity=getKnowledgeEntity(edge.subject)
    if(!entity || entity['@type']!=='elm:LearningOpportunity') continue
    const current=bridgeMap.get(edge.subject)||{
      id:edge.subject,
      targetId:entity.targetId||null,
      label:localize(entity.label,lang),
      status:entity.status||null,
      develops:[],
      source:getKnowledgeSource(edge.sourceId),
    }
    current.develops.push({
      capabilityId:edge.object,
      capabilityKey:edge.objectKey||localSkillKey(edge.object),
      label:localize(getKnowledgeEntity(edge.object)?.label,lang),
    })
    bridgeMap.set(edge.subject,current)
  }

  const workActivities=edges
    .filter(edge=>edge.subject===occupationId && edge.predicate==='kamin:workActivity')
    .map(edge=>{
      const entity=getKnowledgeEntity(edge.object)
      return {
        id:edge.object,
        label:localize(entity?.label,lang),
        source:getKnowledgeSource(edge.sourceId),
        sourceUrl:entity?.sourceUrl||null,
      }
    })

  const sourceIds=new Set(edges.map(edge=>edge.sourceId).filter(Boolean))
  return {
    sources:[...sourceIds].map(id=>getKnowledgeSource(id)).filter(Boolean),
    externalOccupations,
    marketSignals,
    developmentGaps,
    bridges:[...bridgeMap.values()],
    workActivities,
  }
}

import { describe, expect, it } from 'vitest'
import { ictKnowledgeGraph, ICT_KG_VERSION } from '../src/knowledge/ictKgV1.js'
import { deriveKnowledgeInsights, getTargetKnowledgeSlice } from '../src/knowledge/query.js'

describe('ICT knowledge graph v1', () => {
  it('anchors Data Analyst to reviewed ESCO and O*NET references', () => {
    const slice=getTargetKnowledgeSlice('job-data-analyst')
    expect(slice).toBeTruthy()
    expect(slice.version).toBe(ICT_KG_VERSION)

    const ids=slice.entities.map(entity=>entity['@id'])
    expect(ids).toContain('http://data.europa.eu/esco/occupation/d3edb8f8-3a06-47a0-8fb9-9b212c006aa2')
    expect(ids).toContain('urn:onet:15-2051.01')

    const exact=slice.edges.find(edge=>edge.predicate==='skos:exactMatch')
    const related=slice.edges.find(edge=>edge.predicate==='skos:relatedMatch')
    expect(exact?.object).toContain('data.europa.eu/esco/occupation/')
    expect(related?.object).toBe('urn:onet:15-2051.01')
  })

  it('keeps O*NET software demand as context-only rather than fit gates', () => {
    const signals=ictKnowledgeGraph.edges.filter(edge=>edge.predicate==='kamin:marketSignalsCapability')
    expect(signals.length).toBeGreaterThanOrEqual(4)
    expect(signals.every(edge=>edge.decisionRole==='context-only')).toBe(true)
    expect(signals.every(edge=>edge.geography==='US')).toBe(true)
    expect(signals.find(edge=>edge.objectKey==='sql')?.observedShare).toBe(0.35)
    expect(signals.find(edge=>edge.objectKey==='python')?.observedShare).toBe(0.20)
    expect(signals.find(edge=>edge.objectKey==='power-bi')?.observedShare).toBe(0.20)
  })

  it('turns missing market signals and required capabilities into explicit learning bridges', () => {
    const personIndex={capabilities:new Map()}
    const insights=deriveKnowledgeInsights(personIndex,'job-data-analyst',{
      lang:'en',
      requiredCapabilityKeys:['database','statistics'],
    })

    expect(insights.requiredGaps.map(gap=>gap.capabilityKey))
      .toEqual(expect.arrayContaining(['database','statistics']))
    expect(insights.developmentGaps.map(gap=>gap.capabilityKey))
      .toEqual(expect.arrayContaining(['sql','python','power-bi','tableau']))
    expect(insights.bridges.map(bridge=>bridge.targetId))
      .toEqual(expect.arrayContaining(['training-sql-analytics','training-python-analytics','training-bi-dashboard']))
    expect(insights.bridges.find(bridge=>bridge.targetId==='training-sql-analytics')?.reasons)
      .toContain('required-gap')
  })

  it('removes a development gap when Person360 already has evidence for that capability', () => {
    const personIndex={capabilities:new Map([
      ['python',[{claimId:'claim-python'}]],
      ['power-bi',[{claimId:'claim-powerbi'}]],
    ])}
    const insights=deriveKnowledgeInsights(personIndex,'job-data-analyst',{lang:'en'})
    expect(insights.developmentGaps.map(gap=>gap.capabilityKey)).not.toContain('python')
    expect(insights.developmentGaps.map(gap=>gap.capabilityKey)).not.toContain('power-bi')
    expect(insights.developmentGaps.map(gap=>gap.capabilityKey)).toContain('sql')
  })
})

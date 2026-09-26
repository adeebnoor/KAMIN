export const ICT_KG_VERSION='kamin-ict-kg-v1'
export const ICT_KG_REVIEWED_AT='2026-09-27'

export const KNOWLEDGE_SOURCES={
  esco:{
    id:'source-esco-1.2.1',
    title:'ESCO',
    version:'1.2.1',
    authority:'European Commission',
    sourceUrl:'https://esco.ec.europa.eu/en/use-esco/use-esco-services-api',
    note:'Linked-data occupation identity and persistent concept URIs.',
  },
  onet:{
    id:'source-onet-31.0',
    title:'O*NET',
    version:'31.0',
    authority:'U.S. Department of Labor / O*NET',
    sourceUrl:'https://www.onetcenter.org/database.html',
    note:'Occupation/work-activity context and dated U.S. employer software-demand signals.',
  },
  kaminPilot:{
    id:'source-kamin-pilot-v1',
    title:'Kamin governed pilot mappings',
    version:'pilot-v1',
    authority:'Kamin pilot',
    sourceUrl:'/methodology.html',
    note:'Local pilot capability gates and illustrative learning pathways. Not an external occupational standard.',
  },
}

const E={
  target:'urn:kamin:target:job-data-analyst',
  occupation:'urn:kamin:occupation:data-analyst',
  esco:'http://data.europa.eu/esco/occupation/d3edb8f8-3a06-47a0-8fb9-9b212c006aa2',
  onet:'urn:onet:15-2051.01',
  database:'urn:kamin:skill:database',
  statistics:'urn:kamin:skill:statistics',
  sql:'urn:kamin:skill:sql',
  python:'urn:kamin:skill:python',
  powerbi:'urn:kamin:skill:power-bi',
  tableau:'urn:kamin:skill:tableau',
  visualization:'urn:kamin:skill:data-visualization',
  analyzeActivity:'urn:onet:work-activity:analyzing-data-or-information',
  trainingSql:'urn:kamin:learning:training-sql-analytics',
  trainingPython:'urn:kamin:learning:training-python-analytics',
  trainingBi:'urn:kamin:learning:training-bi-dashboard',
  courseDb:'urn:kamin:course-template:CPIT-260',
  courseStats:'urn:kamin:course-template:STAT-201',
}

export const ictKnowledgeGraph={
  '@context':'/ontology/kamin-context.jsonld',
  '@id':'urn:kamin:knowledge:ict:v1',
  '@type':'kamin:OpportunityKnowledgeGraph',
  version:ICT_KG_VERSION,
  reviewedAt:ICT_KG_REVIEWED_AT,
  scope:'ICT golden-path seed; public standards and governed pilot mappings only',
  entities:[
    {
      '@id':E.occupation,'@type':'Occupation',targetId:'job-data-analyst',
      label:{ar:'محلل بيانات',en:'Data Analyst'},
      knowledgeStatus:'golden-path-v1',
    },
    {
      '@id':E.esco,'@type':'Occupation',notation:'2511.3',
      label:{ar:'محلل بيانات',en:'Data Analyst'},
      conceptScheme:'ESCO',sourceId:KNOWLEDGE_SOURCES.esco.id,
      sourceUrl:'https://esco.ec.europa.eu/en/classification/occupation?uri=http://data.europa.eu/esco/occupation/d3edb8f8-3a06-47a0-8fb9-9b212c006aa2',
    },
    {
      '@id':E.onet,'@type':'Occupation',notation:'15-2051.01',
      label:{ar:'محللو ذكاء الأعمال',en:'Business Intelligence Analysts'},
      conceptScheme:'O*NET-SOC',sourceId:KNOWLEDGE_SOURCES.onet.id,
      sourceUrl:'https://www.onetonline.org/link/summary/15-2051.01',
    },
    {'@id':E.database,'@type':'Competency',notation:'database',label:{ar:'قواعد البيانات',en:'Databases'}},
    {'@id':E.statistics,'@type':'Competency',notation:'statistics',label:{ar:'التحليل الكمي',en:'Quantitative analysis'}},
    {'@id':E.sql,'@type':'Competency',notation:'sql',label:{ar:'SQL',en:'SQL'}},
    {'@id':E.python,'@type':'Competency',notation:'python',label:{ar:'Python للتحليل',en:'Python for analytics'}},
    {'@id':E.powerbi,'@type':'Competency',notation:'power-bi',label:{ar:'Power BI',en:'Power BI'}},
    {'@id':E.tableau,'@type':'Competency',notation:'tableau',label:{ar:'Tableau',en:'Tableau'}},
    {'@id':E.visualization,'@type':'Competency',notation:'data-visualization',label:{ar:'تصور البيانات',en:'Data visualization'}},
    {
      '@id':E.analyzeActivity,'@type':'kamin:WorkActivity',
      label:{ar:'تحليل البيانات أو المعلومات',en:'Analyzing Data or Information'},
      sourceId:KNOWLEDGE_SOURCES.onet.id,
      sourceUrl:'https://www.onetonline.org/link/details/15-2051.01',
    },
    {
      '@id':E.trainingSql,'@type':'elm:LearningOpportunity',targetId:'training-sql-analytics',
      label:{ar:'مختبر SQL للتحليل',en:'SQL for Analytics Lab'},
      status:'illustrative-pilot',sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,
    },
    {
      '@id':E.trainingPython,'@type':'elm:LearningOpportunity',targetId:'training-python-analytics',
      label:{ar:'مختبر Python للتحليل',en:'Python Analytics Lab'},
      status:'illustrative-pilot',sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,
    },
    {
      '@id':E.trainingBi,'@type':'elm:LearningOpportunity',targetId:'training-bi-dashboard',
      label:{ar:'مختبر لوحات ذكاء الأعمال',en:'BI Dashboard Lab'},
      status:'illustrative-pilot',sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,
    },
    {
      '@id':E.courseDb,'@type':'Course',code:'CPIT-260',
      label:{ar:'قواعد البيانات',en:'Database Systems'},status:'institution-pilot-context',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,
    },
    {
      '@id':E.courseStats,'@type':'Course',code:'STAT-201',
      label:{ar:'الإحصاء التطبيقي',en:'Applied Statistics'},status:'institution-pilot-context',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,
    },
  ],
  edges:[
    {
      subject:E.target,predicate:'kamin:knowledgeAnchor',object:E.occupation,
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,decisionRole:'identity',
    },
    {
      subject:E.occupation,predicate:'skos:exactMatch',object:E.esco,
      sourceId:KNOWLEDGE_SOURCES.esco.id,decisionRole:'external-identity',
      reviewStatus:'label-and-URI-reviewed',
    },
    {
      subject:E.occupation,predicate:'skos:relatedMatch',object:E.onet,
      sourceId:KNOWLEDGE_SOURCES.onet.id,decisionRole:'context-only',
      reviewStatus:'related-reference-not-exact-equivalence',
    },
    {
      subject:E.occupation,predicate:'kamin:requiresCapability',object:E.database,objectKey:'database',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,decisionRole:'pilot-core-gate',
    },
    {
      subject:E.occupation,predicate:'kamin:requiresCapability',object:E.statistics,objectKey:'statistics',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,decisionRole:'pilot-core-gate',
    },
    {
      subject:E.occupation,predicate:'kamin:workActivity',object:E.analyzeActivity,
      sourceId:KNOWLEDGE_SOURCES.onet.id,decisionRole:'context-only',
    },
    {
      subject:E.occupation,predicate:'kamin:marketSignalsCapability',object:E.sql,objectKey:'sql',
      sourceId:KNOWLEDGE_SOURCES.onet.id,decisionRole:'context-only',
      geography:'US',observationWindow:'2025-01-01/2025-12-31',observedShare:0.35,
      signal:'employer-job-postings-software-skill',
    },
    {
      subject:E.occupation,predicate:'kamin:marketSignalsCapability',object:E.powerbi,objectKey:'power-bi',
      sourceId:KNOWLEDGE_SOURCES.onet.id,decisionRole:'context-only',
      geography:'US',observationWindow:'2025-01-01/2025-12-31',observedShare:0.20,
      signal:'employer-job-postings-software-skill',
    },
    {
      subject:E.occupation,predicate:'kamin:marketSignalsCapability',object:E.python,objectKey:'python',
      sourceId:KNOWLEDGE_SOURCES.onet.id,decisionRole:'context-only',
      geography:'US',observationWindow:'2025-01-01/2025-12-31',observedShare:0.20,
      signal:'employer-job-postings-software-skill',
    },
    {
      subject:E.occupation,predicate:'kamin:marketSignalsCapability',object:E.tableau,objectKey:'tableau',
      sourceId:KNOWLEDGE_SOURCES.onet.id,decisionRole:'context-only',
      geography:'US',observationWindow:'2025-01-01/2025-12-31',observedShare:0.19,
      signal:'employer-job-postings-software-skill',
    },
    {
      subject:E.trainingSql,predicate:'kamin:developsCapability',object:E.database,objectKey:'database',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,decisionRole:'development-bridge',
    },
    {
      subject:E.trainingSql,predicate:'kamin:developsCapability',object:E.sql,objectKey:'sql',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,decisionRole:'development-bridge',
    },
    {
      subject:E.trainingPython,predicate:'kamin:developsCapability',object:E.python,objectKey:'python',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,decisionRole:'development-bridge',
    },
    {
      subject:E.trainingBi,predicate:'kamin:developsCapability',object:E.visualization,objectKey:'data-visualization',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,decisionRole:'development-bridge',
    },
    {
      subject:E.trainingBi,predicate:'kamin:developsCapability',object:E.powerbi,objectKey:'power-bi',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,decisionRole:'development-bridge',
    },
    {
      subject:E.courseDb,predicate:'kamin:developsCapability',object:E.database,objectKey:'database',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,decisionRole:'academic-context',
    },
    {
      subject:E.courseStats,predicate:'kamin:developsCapability',object:E.statistics,objectKey:'statistics',
      sourceId:KNOWLEDGE_SOURCES.kaminPilot.id,decisionRole:'academic-context',
    },
  ],
}

export const ICT_KG_IDS=E

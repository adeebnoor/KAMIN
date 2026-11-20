# Kamin Person 360 Ontology & Semantic Matching Architecture

Status: **Kamin 1.0 architecture baseline**  
Owner: Kamin  
Date: 2026-09-26

## 1. Design principle

Kamin does not begin with a recommender.

Kamin first builds an evidence-rich semantic model of the person and then computes explainable relationships between that person and opportunities, learning, work, and other people.

```
Person 360 Graph
      ↓
Evidence + Properties + Relations
      ↓
Use-case-specific Matching
      ↓
Mechanisms of Fit
      ↓
Outcome Validation
```

**Similarity is not suitability.**

A target that looks similar to the person may be redundant, blocked by a formal gate, or poor for growth. Every matching use case therefore owns its own rule set, features, and learned/calibrated weights.

## 2. D3 design pattern inherited by Kamin

Kamin intentionally carries forward the architecture pattern of the D3 thesis:

1. Normalize heterogeneous entities into a canonical identity layer.
2. Normalize heterogeneous relations into a smaller, governed relation vocabulary.
3. Keep source identifiers and provenance.
4. Build a multi-dimensional profile for each entity.
5. Compute similarity independently by dimension before aggregation.
6. Use symbolic/graph inference to expose explanatory paths.
7. Separate query/rule inference from probabilistic or learned ranking.
8. Validate inferred relationships against observed outcomes.
9. Learn feature importance instead of assuming equal weights.

Kamin does **not** copy D3's biomedical features or thresholds. It copies the architecture pattern.

## 3. Reuse-first ontology stack

Kamin will not create one monolithic local ontology. It composes existing standards.

| Domain | Standard / vocabulary | Kamin use |
|---|---|---|
| Person | Schema.org Person | canonical person type and basic metadata |
| Learner-owned record | 1EdTech CLR 2.0 | verifiable courses, achievements, competencies and longitudinal learner record |
| Portable achievements | 1EdTech Open Badges 3.0 | issuer, criteria, alignment and evidence for portable achievements |
| Verifiable claims | W3C Verifiable Credentials Data Model 2.0 | machine-verifiable future claims and credentials |
| Competencies / CLOs | 1EdTech CASE 1.1 | learning outcomes, competencies, rubrics and framework associations |
| Learning model | European Learning Model (ELM) 3.3 | learning opportunities, qualifications, outcomes, accreditations and credentials |
| Skills / occupations | ESCO 1.2.1 | multilingual skill and occupation URIs |
| Workforce properties | O*NET 31.0 RDF + Content Model | interests, work styles, abilities, knowledge, activities, context and occupations |
| Credentials / pathways | Credential Engine CTDL + CTDL-ASN | credentials, assessments, pathways and competency framework alignment |
| Taxonomies | W3C SKOS | SASCED, controlled vocabularies, hierarchy and mappings |
| Provenance | W3C PROV-O | evidence lineage, extraction/assessment activity, source agents and timestamps |
| Consent / purpose | W3C Data Privacy Vocabularies and Controls CG — DPV 2.0 | purpose-specific consent and withdrawal lifecycle metadata |
| Graph validation | W3C SHACL 2017 Recommendation | machine-validatable structural and provenance constraints |
| Psychometric instruments | O*NET Interest Profiler + IPIP | assessment instruments; not ontologies themselves |

### 3.1 Why O*NET matters

O*NET is used as a workforce semantic layer, not merely a lookup table. Its current database is available as RDF/JSON-LD and contains machine-addressable occupations, skills/knowledge/abilities, Career Interests, Work Styles, activities, context and relationship metadata.

Kamin will preserve O*NET identifiers when importing those resources.

### 3.2 Why ESCO and O*NET both remain

They serve overlapping but different roles.

- ESCO is preferred for multilingual skill/occupation concepts and European interoperability.
- O*NET is preferred for richer occupation-linked worker/job characteristics such as RIASEC interests, Work Styles, work context and occupational ratings.

Crosswalks are qualified mappings with provenance; they are never silently treated as `owl:sameAs`.

### 3.3 Namespace/version decisions

- CTDL terms use the `ceterms:` shorthand over `https://purl.org/ctdl/terms/`.
- CTDL-ASN uses the `ceasn:` shorthand and canonical term URIs under `https://purl.org/ctdlasn/terms/`.
- ELM uses the current 2026 ontology namespace `http://data.europa.eu/snb/model/ontology/`.
- O*NET is pinned to production database 31.0 (August 2026) when importing workforce RDF.
- ESCO imports must record the selected ESCO release; the current registry target is 1.2.1.
- DPV 2.0 is a W3C Community Group Final Specification, not a W3C Recommendation.
- SHACL 2017 Recommendation is the production constraint baseline; newer SHACL drafts are not used as normative production dependencies yet.

Kamin must record the source version on every imported external concept bundle. No external taxonomy is treated as timeless.

## 4. Kamin local namespace

Kamin 1.0 local terms use `urn:kamin:` identifiers.

This is deliberate. The Render domain is temporary and must **not** become a persistent ontology namespace.

Before external publication, Kamin must provision a stable dereferenceable namespace (custom domain or a persistent redirect service such as w3id). Existing local IDs should then be migrated through versioned mappings.

## 5. Core Person 360 domains

```
Person
├── identity
├── academic
├── capability
├── experience
├── achievement
├── interests
├── personality tendencies
├── work values
├── motivation
├── work style
├── goals
├── declared preferences
├── constraints
└── outcomes
```

Each property is represented as a claim or observation, never as an unqualified raw field when it can influence matching.

## 6. Claim model

A Kamin claim must contain:

- subject
- predicate
- object or value
- source
- source type
- generation activity
- timestamp
- evidence strength/status
- consent purpose where personal data is involved
- model/rule/instrument version where derived

Example:

```json
{
  "@type": "Claim",
  "subject": "urn:kamin:person:local",
  "predicate": "kamin:demonstrates",
  "object": "http://data.europa.eu/esco/skill/...",
  "source": "urn:kamin:evidence:course:cpit-251",
  "sourceType": "approved-course-mapping",
  "generatedBy": "urn:kamin:activity:skill-inference",
  "generatedAtTime": "2026-09-26T15:00:00Z",
  "evidenceStrength": "document-derived",
  "consentPurpose": "urn:kamin:purpose:academic-profile"
}
```

## 7. Evidence hierarchy

Kamin never treats all evidence as equivalent.

Suggested states:

1. `verified-external` — verifiable credential / official institutional assertion.
2. `document-derived` — extracted from an uploaded official-looking document and approved by the student.
3. `approved-mapping-derived` — derived through a department-approved course/CLO mapping.
4. `third-party-endorsed` — self-assertion endorsed by an authorized person/organization.
5. `self-reported` — declared by the person.
6. `model-inferred` — algorithmic hypothesis not yet confirmed.
7. `unknown` — retained but prohibited from decision effects.

The source and state are both preserved.

## 8. Psychometrics

Psychometric results are `Observation` objects, not direct Person facts.

Each observation must preserve:

- construct concept
- raw or derived value
- response scale
- instrument ID
- instrument version
- date
- consent purpose
- source
- scoring implementation version
- local validation status

### 8.1 Initial instrument registry

**Career interests**  
O*NET Mini Interest Profiler (30 items), RIASEC.

**Personality tendencies**  
IPIP 50-item Big-Five markers, Arabic adaptation as a candidate instrument.

**Work values**  
Use the O*NET Work Values content model for semantic alignment. Student-facing measurement must be separately selected/validated.

**Work styles**  
Use O*NET Work Styles as the occupation-side semantic model. Do not infer an individual's Work Style merely from occupational ratings.

### 8.2 Saudi validation rule

No Arabic psychometric result may be presented as a Saudi norm, percentile, clinical interpretation, or diagnostic fact until local validation is completed.

Big Five is initially a low-weight contextual signal. It must never satisfy an eligibility gate or create academic skill evidence.

## 9. Structured declared preferences

Declared preferences are not psychometrics.

They use versioned controlled vocabularies, such as:

- work structure
- collaboration style
- pace
- desired responsibility
- learning mode

These use dropdown/multi-select controls rather than free text when they enter a rule.

Free text may exist as a note for the human reader, but it is excluded from deterministic decision logic unless separately transformed into a reviewed concept.

## 10. SASCED representation

SASCED is a classification, not a skill ontology.

Kamin represents it as a SKOS ConceptScheme.

```
SASCED-20
  skos:ConceptScheme
    06
      061
        0613
          061301
          061302
          061303
          061304
```

Institution-specific programme mappings (for example KAU course namespace mappings) are separate qualified mapping claims with their own source and review date.

## 11. Learning outcomes and competency evidence

Course-to-skill mapping follows this chain:

```
Course
  -> hasLearningOutcome (CASE item)
  -> alignedTo Competency/Skill
  -> evidence from student result
  -> qualified demonstrates claim
```

Semantic similarity may propose an alignment, but only approved mappings enter deterministic skill evidence.

## 12. Matching architecture

### 12.1 Hard gates first

```
Formal eligibility
→ Academic prerequisites
→ Evidence-backed capabilities
→ Goal alignment
→ Interests
→ Values
→ Work style
→ Personality context
→ Constraints
→ Mechanisms of Fit
```

A psychometric match never overrides a failed formal gate.

### 12.2 Use-case-specific feature sets

```
Person ↔ Person
  similarity OR complementarity

Person ↔ Job
  capability + experience + interests + values + work style + constraints

Person ↔ Course
  prerequisites + capability gap + goal + interest + learning preference

Person ↔ Training
  capability gap + goal + learning preference + time + cost
```

### 12.3 No equal weights

Kamin explicitly rejects default equal weighting across all domains.

```
weight(feature | use_case, target_type, evidence_quality, model_version)
```

Initial rules may use governed ordinal priorities. Numeric weights become production claims only after retrospective/ prospective validation.

## 13. Mechanisms of Fit

Every recommendation must expose why it exists.

Example:

```
Person -> Job

supports:
- required skill evidence
- RIASEC alignment
- value alignment
- work-style alignment

limits:
- experience gap
- missing credential

formal gate:
- met / not met
```

The explanation is a path through the graph, not an LLM-generated story detached from evidence.

## 14. Outcomes: the future learning signal

Recommendations do not train the system by themselves.

Observed outcomes do.

Examples:

```
Person -> Course -> completed -> assessment improved
Person -> Internship -> completed -> supervisor endorsement
Person -> Job -> hired -> retained -> performance outcome
Person -> Team -> completed project -> peer/supervisor outcome
```

Outcome records become the analogue of D3's proven interaction set.

They allow Kamin to learn which dimensions and patterns actually predict useful fit.

## 15. Student-project guardrails

Students may:
- add UI/views over the graph
- import a new approved source
- add tests
- add visualization
- implement a documented matching use case
- build graph queries

Students must not without architecture review:
- create duplicate local concepts when a canonical external URI exists
- create skill evidence from course-name keywords
- make psychometrics override formal gates
- add a new numeric fit percentage without calibration
- change consent purpose silently
- store raw personal data outside the approved persistence boundary
- collapse provenance
- treat closeMatch as sameAs
- assign arbitrary equal weights and present them as scientific

## 16. Machine validation artifacts

The repository publishes:

- `ontology/kamin-core.ttl` — the thin Kamin RDF extension vocabulary (version **0.4.0**, `KAMIN_ONTOLOGY_VERSION` in `src/ontology/registry.js`).
- `ontology/kamin-shapes.ttl` — SHACL constraints: `ClaimShape`, `ObservationShape`, `CourseMappingShape`, `EvidenceClaimShape`.
- `public/ontology/kamin-context.jsonld` — JSON-LD context for exported Person 360 graphs.

The JavaScript validator remains an application guardrail, while SHACL defines the interoperable graph contract for future graph stores and external integrations.

### 16.1 Every written term is declared, and the shapes run (Task 33, 2026-11-18)

- **Term check.** `node scripts/ontology-terms.mjs` builds the graphs the app writes (the demo knowledge-workspace graph; a made-up profile that runs every branch of `src/ontology/projector.js`, its inference datasets and its workspace graph; the ICT knowledge graph), loads them with Oxigraph as JSON-LD, and lists every `kamin:` predicate, class and claim relation that is **used but undeclared** and every term **declared but unused**. Because the JSON-LD context has `@vocab: urn:kamin:`, every plain JSON key the projector writes (for example `grade`, `hours`, `sourceDocument`) is a `kamin:` term and is declared too. Result on 2026-11-18: 116 used, 127 declared, **0 used but undeclared**. `tests/ontologyTerms.test.js` fails if a new undeclared term appears.
- **Declarations.** Every term has `rdfs:label` in Arabic and English, an `rdfs:comment`, and a domain and a range. `rdfs:domain`/`rdfs:range` are used when a term is used on one kind of node only; `schema:domainIncludes`/`schema:rangeIncludes` when it is used on several, so no wrong class is inferred. Domains and ranges reuse the classes the registry names (`schema:Person`, `schema:Course`, `schema:Occupation`, `elm:LearningOpportunity`, `elm:LearningOutcome`, `ceasn:Competency`, `skos:Concept`, `prov:Entity`, `dpv:Purpose`). New classes: `kamin:Consent`, `kamin:WorkActivity`, `kamin:OpportunityKnowledgeGraph`, and `kamin:Record` (the untyped nested records: relation records, task outputs, local reviews, self-assessments). Per-scheme predicates are sub-properties: `kamin:prefers:<scheme>` of `kamin:prefers`, `kamin:compatiblePreference:<scheme>` of `kamin:compatiblePreference`. Three 0.3.0 properties used on more than claims (`kamin:subject`, `kamin:predicate`, `kamin:object`) and three used on more than `rdf:Statement` (`kamin:sourceId`, `kamin:decisionRole`, `kamin:reviewedAt`) moved from `rdfs:domain` to `schema:domainIncludes`. No 0.3.0 term was removed.
- **Shapes.** `CourseMappingShape`: every course or learning outcome that maps to something has exactly one `kamin:mappingVersion`, one `kamin:reviewStatus` in {proposed, reviewed} and one `kamin:catalogSource`. `EvidenceClaimShape`: every `kamin:demonstrates` claim has exactly one `kamin:evidenceLevel` in {none, limited, moderate, strong}, one `kamin:evidenceBasis`, one `kamin:evidenceLevelsVersion` and a `prov:wasDerivedFrom` (SHACL Core: the shape targets every claim with "predicate is not `kamin:demonstrates`, or meets `kamin:DemonstratesClaimRules`", so a broken claim gives one violation, on the claim).
- **Validation in `npm test`.** `tests/shacl.test.js` validates, with `rdf-validate-shacl` 0.6.5 (exact-pinned dev dependency, local, no network, not in the app bundle), the demo workspace graph, the frozen demo profile `tests/fixtures/shacl/demo-profile.jsonld`, and the workspace graph of every synthetic KAU transcript (Task 50) after approval: **0 violations**. A `kamin:demonstrates` claim without `evidenceLevel` gives exactly one violation, naming the claim.
- **Published.** `/ontology/kamin-core.ttl` and `/ontology/kamin-shapes.ttl` (current, 0.4.0), `/ontology/0.4.0/…`, and the unchanged `/ontology/0.3.0/…`; `/ontology/kamin-context.jsonld` is unchanged. The ontology header carries `owl:versionIRI <urn:kamin:ontology:0.4.0>` and `owl:priorVersion <urn:kamin:ontology:0.3.0>`.

## 17. Implementation path

### Phase A — now
- ontology registry
- Person 360 JSON-LD-compatible graph
- structured preferences
- psychometric instrument registry
- export with provenance
- unit tests for ontology rules

### Phase B
- ESCO concept importer
- O*NET 31.0 RDF/JSON-LD importer
- CASE framework importer for approved CLOs
- SASCED SKOS serialization
- psychometric scoring modules after instrument/license review

### Phase C
- graph store / query layer
- Person↔Target matching
- mechanisms-of-fit paths
- outcome capture
- learned weighting / calibration

### Phase D
- CLR 2.0 / verifiable achievement export
- institutional integrations
- external identity namespace and persistent URIs
- research-grade validation

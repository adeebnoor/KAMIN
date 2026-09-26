# Kamin Person 360 Ontology Architecture

Version: 0.2.0  
Status: architecture baseline for pilot/research implementation  
Reviewed: 2026-09-26

## 1. Core principle

Kamin does not create a monolithic ontology from scratch. It follows the same architecture pattern used in the D3 thesis:

1. normalize entities and identifiers,
2. integrate heterogeneous sources into a canonical graph,
3. preserve source provenance,
4. model dimensions separately,
5. run use-case-specific inference,
6. validate inferred relationships against real outcomes,
7. learn or govern weights rather than assuming equal importance.

The reusable graph is the product foundation. Course, job, training and person matching are applications over the same graph.

## 2. Standards stack

| Domain | Primary standard | Kamin use |
| --- | --- | --- |
| Person identity shell | Schema.org Person | non-sensitive canonical person node |
| Learner-owned achievements | 1EdTech CLR 2.0 | achievements, courses, skills, evidence-bearing learner assertions |
| Learning outcomes / competencies | 1EdTech CASE 1.1 | framework items, outcomes, associations, rubrics |
| Skills / occupations | ESCO 1.2.1 | multilingual skill and occupation URIs |
| Occupation characteristics | O*NET 31.0 | interests, work styles, skills, activities, work context |
| Credentials / courses / pathways | CTDL / CTDL-ASN | credentials, learning opportunities, assessments, competencies and pathways |
| National classifications | SKOS | SASCED and other controlled concept schemes/crosswalks |
| Provenance | PROV-O | where each claim came from and what generated it |
| Consent / processing purpose | DPV 2.0 | purpose-specific consent metadata and withdrawal |
| Signed credentials | W3C VC 2.0 | externally verifiable credentials and claims |

## 3. Minimal Kamin extensions

Only concepts that are not cleanly represented elsewhere are minted locally:

- `kamin:Claim`
- `kamin:Observation`
- `kamin:Goal`
- `kamin:Constraint`
- `kamin:FitAssessment`
- `kamin:FitMechanism`
- `kamin:Outcome`

The local vocabulary is a bridge, not a replacement for external standards.

## 4. Claim model

Every operational claim must be traceable.

```
Person
  └─ hasClaim → Claim
                 ├─ subject
                 ├─ predicate
                 ├─ object/value
                 ├─ prov:wasDerivedFrom
                 ├─ prov:generatedAtTime
                 ├─ sourceType
                 ├─ evidenceStrength
                 └─ consentPurpose (when applicable)
```

Examples:

```
Person --studied--> CPIT-251
source: transcript
```

```
Person --demonstrated--> Requirements Analysis
source: approved CPIT-251→skill mapping
supportedBy: CPIT-251
```

```
Person --hasObservation--> InvestigativeInterestObservation
source: O*NET Interest Profiler response/result
instrumentVersion: pinned
consentPurpose: student-insight
```

Academic evidence and self-report observations are never treated as the same evidence class.

## 5. Person 360 dimensions

- Academic
- Skills
- Experience / achievements
- Interests
- Personality markers
- Work values / declared preferences
- Work style
- Goals
- Constraints

No global person score is defined.

## 6. Matching is use-case specific

### Person ↔ Person similarity
Similarity by dimension. No claim that similar people are automatically good teammates.

### Person ↔ Person complementarity
Measures gap coverage for a defined team goal.

### Person ↔ Job
Formal gates first, then evidence/experience fit, then interests/work-style/values context, then explainable gaps.

### Person ↔ Course
Prerequisites, redundancy, gap closure, goal relevance and constraints. Personality must not gate access.

### Person ↔ Training
Development need, delivery fit, prerequisite and constraints.

Similarity and suitability are separate functions.

## 7. Psychometrics

Psychometric observations are first-class graph entities with instrument provenance.

Approved architecture rules:

- no locally invented questionnaire may enter production scoring;
- O*NET Mini-IP can model RIASEC, subject to exact license/adaptation handling;
- Arabic Big Five candidates come from published IPIP adaptations;
- no Saudi percentile/norm claim until local validation;
- no psychometric result can create a skill or satisfy a formal gate;
- personality may contribute to explanation/context, never be the sole reason for a negative recommendation;
- raw responses and derived scores have separate retention policies.

## 8. Weighting policy

Kamin explicitly rejects universal equal weighting.

The D3 thesis identified the same limitation: equal feature weights can allow weak dimensions to compensate for more relevant failures. Kamin therefore uses:

```
weight(dimension | use_case, target_type, outcome_definition, evidence_quality)
```

Weights remain unset until they are either:

1. learned from validated outcome data, or
2. explicitly approved by a governed rule with version/source/owner.

The public pilot must not expose uncalibrated numeric fit probabilities.

## 9. Outcome graph

Future supervised learning should be based on observed outcomes rather than clicks alone.

Examples:

```
Person → completed → Course
Course → resultedIn → SkillGain
```

```
Person → entered → Job
JobExperience → outcome → retained/performance/verified milestone
```

```
Person → joined → Training
Training → resultedIn → verified assessment/credential
```

These outcomes are the human-domain equivalent of validated interactions used in D3.

## 10. Student project boundaries

Students may extend:

- UI/visualization
- connectors
- ontology crosswalks
- target profiles
- explainability views
- test fixtures
- graph analytics

Students must not change without review:

- evidence classes
- provenance requirements
- consent semantics
- formal-gate rules
- psychometric instrument versions/scoring
- production weighting
- ontology identity/crosswalk policy

## 11. Current implementation files

- `src/ontology/registry.js`
- `src/ontology/personGraph.js`
- `src/ontology/matching.js`
- `src/psychometrics/registry.js`
- `src/insight.js`

The graph exports JSON-LD-compatible structures while the public pilot remains browser-local.

# SHACL fixture (Task 33)

`demo-profile.jsonld` is the demo student's Person 360 graph (`buildSyntheticGraph()` in
`src/knowledge/workspace.js`, made-up courses, no real person) frozen on 2026-11-18, with every
time set to `2026-11-18T00:00:00.000Z` so the file does not change between runs.
Its `@context` is the published context `/ontology/kamin-context.jsonld`; the test puts the same
context inline before loading it.

`tests/shacl.test.js` validates it against `ontology/kamin-shapes.ttl` and expects **0** violations.

**Check by hand:** delete the line `"evidenceLevel": "limited",` from one `kamin:demonstrates`
claim, then run `npx vitest run tests/shacl.test.js`. The test fails and its message names the
claim (for example `urn:kamin:claim:demonstrates:project:1 · kamin:EvidenceClaimShape`).
Undo the edit afterwards (`git checkout -- tests/fixtures/shacl/demo-profile.jsonld`).

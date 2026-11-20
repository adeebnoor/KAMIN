# Competency questions (Task 01, step 6; Task 34)

`cq01..cq10*.rq` are copied unchanged from the project library
`kamin/competency-questions/queries/`.

`cq11..cq14*.rq` (Task 34) ask about the evidence rules (Task 02) and review status, which the
first ten do not check. `tests/competencyQuestions.test.js` also runs them on a graph after a
recompute (grade A → F on CPIT-250).

`tests/competencyQuestions.test.js` runs every `cqNN*.rq` file here with Oxigraph against
`buildWorkspaceDataset('demo')` and checks it against `expected.json`. All fourteen must be present.

`expected.json` has one entry per file name:

- `rows`: exact row count. `minRows`: at least this many.
- `contains` / `excludes`: per SPARQL variable, values that must / must not appear.
- `ask`: expected boolean for an ASK query.

Results pass through the workspace's 100-row display cap (`QUERY_ROW_LIMIT`), so checks on
large results (cq02, cq10) use `minRows` and `contains`; exact checks on a single relation
live in the chain tests at the top of `competencyQuestions.test.js`.

## Task 34: evidence and review questions

| File | Question (English) | السؤال (عربي) | Expected on the demo today |
|---|---|---|---|
| `cq11-limited-and-why.rq` | Which of my capabilities are not strong, and what limits each one? | ما قدراتي التي ليست قوية، وما الذي يحدّ كل واحدة منها؟ | 10 rows: 5 capabilities, each `limited` by `assessment-unknown` and `mapping-proposed`; the same codes as the dashboard's "Why is this level limited?" line |
| `cq12-unreviewed-mappings.rq` | Which course → capability links has the department not reviewed yet? | ما روابط المقرر بالقدرة التي لم يراجعها القسم بعد؟ | 46 rows (30 courses × 1 + 8 courses × 2); 0 once every mapping is reviewed |
| `cq13-no-claim-without-evidence.rq` | Is there a capability claim with no evidence behind it? | هل توجد قدرة منسوبة للطالب دون دليل تستند إليه؟ | `false`, also after a recompute |
| `cq14-self-report-stays-self-report.rq` | Does any academic capability rest on a course the student typed by hand? | هل تستند أي قدرة أكاديمية إلى مقرر أدخله الطالب يدويًا؟ | 0 rows |

cq11 reads `kamin:limitingFactor`, which Task 34 added to every `kamin:demonstrates` claim that is not
strong (`src/ontology/projector.js`, filled from `limitingReasons()` in `src/evidence/levels.js`;
declared in `ontology/kamin-core.ttl`). A capability's level is the strongest of its claims, and its
factors are those of the claims at that level.

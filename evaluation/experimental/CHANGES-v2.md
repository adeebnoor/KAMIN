# Engine v2 (experimental) — changes from KAMIN's improved engine v1

Lives in `evaluation/experimental/` only. It was built in a standalone copy of this folder and then added to the repository. KAMIN's `src/ai/projectSuggestImproved.js` and `src/ai/lexicon/capabilities.json` were copied here (`*-v1-copy.*`) and **not changed**. The app still uses v1. Porting v2 into `src/` is a separate task.

Every rule below was chosen from general domain vocabulary and the **dev sets only** (`course-dev-set.json`, `dev-set.json`). The held-out set `course-testset-v2.json` was frozen (SHA-256 `631619a520ce8ab6397708a3759b42255ef0072779ea26b99cdb9d350ac81903`, 2026-11-19) before any v2 design or run. No term was taken from `course-testset.json` cases. That set had been seen earlier, so its v2 result is reported as "seen set, not proof".

Files:
- `projectSuggestImproved-v2.js` is the v1 engine plus the R1 guard. It loads `lexicon/capabilities-v2.json`.
- `build-lexicon-v2.mjs` builds `capabilities-v2.json` from `capabilities-v1-copy.json`. Each change is one line and is tagged `[v2]` in its `why`.
- `../eval.mjs`: `LEXICON=improved-v2` loads this engine. It also enables per-capability thresholds (R9). `LEXICON=improved` (v1) is unchanged.
- `run-v2.mjs` runs the v1 vs v2 comparison and writes `results/compare-v1-v2-<date>.md`.

| Rule | Change | Dev cases that motivated it |
|---|---|---|
| R1 · Secondary-mention guard | A strong term marked `generic` doesn't suggest its capability when two things hold: it is the only distinct term of that capability in the whole text, and every sentence holding it is a topic list (2+ commas). The generic terms are `security`/`أمن` (cyber), `database` (database) and `requirement` (requirements). | cd-CPCS-371 and cd-CPCS-372 ("network security" in a list) and cd-CPCS-462 ("security systems and their requirements" in a list) should not get cyber or requirements. cd-CPCS-405 ("Java Security" and "database programming" in a list) and cd-CPIT-305 ("Java Database Connectivity" in a list) are software only. |
| R2 · Cyber domain terms | New strong terms: breach, intrusion, malware, malicious, cipher, cryptography, cryptographic, attack, cyber. A real security text then has 2+ distinct terms and passes R1. | cd-CPCS-464 ("security" + "breach") keeps cyber. |
| R3 · AI by full name | New strong terms: artificial intelligence, intelligent system, intelligent agent. | cd-CPCS-433 and cd-CPCS-432 ("Artificial Intelligence"), cd-CPIS-363 ("intelligent systems"). |
| R4 · Web protocol pairs | New weak terms: http, web service. New strong terms: web application, web development, web programming. | cd-CPCS-474 ("HTTP protocols, Web protocols, … Web services"). |
| R5 · Requirements elicitation | New strong terms: user needs, elicitation, احتياجات المستخدم. | cd-CPCS-381 ("understanding of user needs"). |
| R6 · Systems analysis | Weak `process` removed. `business process` moved from strong to weak. New strong terms: systems/system analysis, systems planning, information system development, current system, process model, business process model. New weak terms: analysis and design, information system, feasibility, process modeling. | cd-CPIT-436 ("updating business processes", e-business) and cd-CPIT-221 ("processes" + "job interviews") should get nothing. The vocabulary list comes from the brief. |
| R7 · Project management | New strong terms: agile (was weak), risk management, cost estimation, effort estimation, project estimation, project planning, team management, project manager. New weak terms: planning, scheduling, estimation, cost, risk, team, iteration, release, budget, stakeholder. | The vocabulary list comes from the brief. No dev case needed it. On dev-set.json en-08, project was already right; it now also matches "scheduling". No dev result changed. |
| R8 · Software wording | New strong terms: software development, software system. New weak terms: implementation, coding. | cd-CPCS-457 ("software systems") and cd-CPIT-499 ("coding … implementation"). |
| R9 · Per-capability thresholds (eval.mjs) | After the global threshold is set, one coordinate pass per capability within [global, 0.95]. A higher value is kept only if it strictly raises dev mean F1. Thresholds are stored in the config as `thresholds`. | Result on 2026-11-19: no change. With R1–R8, dev F1 was already 96–100%, so every capability kept the global threshold. |

Dev effect of the lexicon alone (v2 engine, no model): course-dev-set went from 8/21 cases correct to 20/21. The one still wrong is cd-CPIT-499, which is missing testing. dev-set.json went from 27/27 to 27/27. The dev set is now close to saturated, so only held-out sets can show whether v2 is really better.

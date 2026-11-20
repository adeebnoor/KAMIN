# Evaluation protocol — project description → capability suggestions

Status: in force from Task 07 (CPIT-498). Owner: the evaluation lead; supervisor: Prof. Adeeb Noor.
Harness: [`eval/project-suggest/`](../eval/project-suggest/README.md).

## 1. What is measured and why

KAMIN's project assistant reads a project description a student writes and suggests possible
capabilities, quoting the sentence that supports each suggestion. The student accepts or
rejects each suggestion; a suggestion never changes an evidence level. We measure how often the
suggestions are right, how many right capabilities are missed, how often the assistant suggests
something it cannot support with the student's own words, and whether it stays silent when there
is nothing to suggest.

Methods compared on the **same frozen set**:

| Method | What it is | Version string |
|---|---|---|
| `lexicon` | current engine, `src/ai/projectSuggest.js` (baseline) | `kamin-project-suggest-lexicon-v1` |
| `embedding` | pinned local MiniLM (`src/semantic/config.js`): each sentence vs. each capability's label + short description (`skill-descriptions.json`), AR and EN; best sentence per capability, suggested at or above the threshold, at most 4 | `nazeh-embed-sentence-v1+<revision>` |
| `improved` | Task 08: stronger AR/EN normalisation + strong/weak synonym lexicon (`src/ai/lexicon/capabilities.json`), built on the development set only | `kamin-project-suggest-improved-v1` |

**In the app:** the project assistant uses `improved` since the supervisor approved the comparison in `eval/project-suggest/results/2026-11-10-comparison.md` (approval recorded 2026-11-11; setting in `src/ai/suggestSettings.js`). `lexicon` stays the measured baseline. The human-written `testset-v2.json` is still to be written, frozen and run; until then the improved engine's results on the AI-written set remain preliminary.

Numbers are reported per language (Arabic, English) and overall. **Results that have not been
measured with this harness are never presented.**

## 2. Metric definitions

For each case the method returns suggestions `{capability, supporting text}`.

- **Supported suggestion:** the supporting text appears verbatim in the description. The only
  differences ignored are whitespace runs and Arabic orthographic variants that do not change a
  word (diacritics, tatweel, hamza forms of alef, final ya / alef maqsura).
- **True positive (TP):** a supported suggestion of a capability in the case's expected labels.
- **False positive (FP):** any other suggestion. **An unsupported suggestion is always a false
  positive, even if the capability is in the labels.** Unsupported suggestions are also counted
  on their own line.
- **False negative (FN):** an expected capability without a TP.
- **Precision** = TP / (TP + FP). **Recall** = TP / (TP + FN). **F1** = 2PR / (P + R).
- **Abstention:** the method suggests nothing.
  - *Correct abstention:* expected labels are empty and the method abstained. Reported as
    "correct abstentions / should-abstain cases"; it does not enter precision or recall.
  - *Wrong abstention:* labels not empty, nothing suggested (its misses are already FNs).
  - *False-alarm case:* labels empty, something suggested (its suggestions are already FPs).
- Each capability counts once per case (duplicates are ignored).

No percentage from this protocol is shown to students; the numbers describe the engineering
quality of an assistant, not a student.

## 3. Sets and separation

| Set | Use | Rule |
|---|---|---|
| `dev-set.json` | development and tuning | the **only** set any threshold or rule is tuned on |
| `testset.json` (v1, 40 cases) | baseline comparison | frozen; AI-written and its errors have been seen, so it is treated as **contaminated** for judging improvements made after seeing it |
| `testset-v2.json` | the independent test set | human-written, two reviewers, frozen **before Task 08 starts** |
| `testset-ai-v2.json` | interim set used in Task 08 at the team's request | written and labelled by Claude (AI), single labeller, frozen in its own commit **before** the improved method existed; results on it are preliminary and likely optimistic |

- `freeze` writes `<set>.lock.json` with the file's sha256. The harness **refuses `tune` on a
  frozen set** and **refuses `run` if a frozen set's sha256 changed**. A frozen set is never
  edited; a corrected set is a new version with a new name and lock.
- A v2 text must not repeat any text of the development or v1 set (`check` enforces this).
- The embedding threshold is chosen by `tune` on `dev-set.json`: sweep 0.20–0.80 in steps of 0.01, objective = mean of the Arabic and English F1, first best threshold wins. Current value 0.52 (dev mean F1 72.1%, dev sha256 `22123e75…94c7`). `run` refuses a threshold tuned on the set it measures.
- Results files record the set's sha256, the method version, the commit, and the threshold with
  the set it was tuned on.

## 4. Who writes and reviews labels (v2)

- Texts are written by people (team members or volunteers who agreed), never generated by an AI
  model. Each case records `writtenBy: "human"` and an `author` (initials or pseudonym). No real
  personal data.
- At least 20 Arabic and 20 English cases, including synonym cases (the capability is described
  without its usual keyword), Arabic dialect cases, and should-abstain cases (nothing to suggest),
  at least 2 of each per language (dialect: Arabic).
- Two different reviewers label every case independently (`labels.reviewerA`, `labels.reviewerB`).
  Disagreements are resolved by discussion, written in `labels.adjudication`, and the result
  goes to `labels.agreed` (= `expected`).
- Agreement is computed by `check` on the binary decision *case × capability* — observed agreement
  and Cohen's kappa — and copied into the set's `agreement` field before freezing.
- The capability vocabulary is the catalog in `src/data.js`.

### Changes to this section (Task 38, 2026-11-16)

Recorded here so no rule changes silently. Tooling: [`eval/project-suggest/v2-kit/`](../eval/project-suggest/v2-kit/GUIDE.md).

- **Categories** are `direct`, `synonym`, `tech-name`, `multi`, `should-abstain`, `dialect` (the
  Task 38 list, also used by `testset-ai-v2.json`); `mixed` is still accepted for older files.
- **New rule: every capability in at least 3 positive cases** of
  the official set, Arabic and English together, so that every capability is tested at all. A
  *positive case* for a capability is a case whose **final agreed labels** (`labels.agreed`, equal to
  `expected`) include it; a mention in the text, a label from one reviewer only, an unresolved
  disagreement or a writer's planning target does not count, and a case counts once per capability.
  Decided by the project owner on 2026-11-16 and **approved by the supervisor** (reported by the
  project owner on 2026-11-17); `check --v2` and `freeze` enforce it. At least 1 positive case
  per capability in each language is the aim and only warns. **Limitation:** with 3 positive cases a
  capability's own recall can only be 0, 33, 67 or 100%, and "2 of 3" has a 95% interval of
  roughly 21–94%, so per-capability results are **indicative**; the official claim stays overall
  precision, recall and F1 per language.
- **Copy and language checks** (`check --v2`): a text equal to one in the development, v1 **or
  ai-v2** set after normalising punctuation, letter case and Arabic spelling variants blocks
  freezing (v1 and dev were already checked, on the exact text); a text close to one of them (word
  or character overlap above a fixed threshold) is a warning; a case whose letters are mostly in
  the other language's script blocks freezing.
- **How the set is built:** writers fill `cases-template.csv`; each reviewer labels a separate copy
  of the labels sheet without seeing the other's or the writer's target; `import-v2` records both
  label sets and the agreement (Cohen's kappa, observed and exact-case agreement) and lists the
  disagreements; `resolve-v2` records the agreed labels and the reason. The writers' `target`
  column is used for coverage planning only and is never imported.
- **Claude-drafted cases (approved by the supervisor, as reported by the project owner on
  2026-11-16).** Claude may write, review and evaluate test-case drafts. They are **not** part of
  `testset-v2.json`: they live in their own files with their origin on every case
  (`writtenBy: "ai"`), are validated and labelled by two human reviewers who do not see Claude's
  proposed labels, and are reported separately from the human-only result. They enter the official
  result only with the supervisor's explicit approval; if they ever do, human-only and combined
  results are reported side by side with the origin of each case. A separate AI-written
  **diagnostic** robustness set never enters any metric, tuning, regression floor or decision (Task 38c).
  The supervisor approved this approach as a whole, including the 3-positive-cases rule above
  (reported by the project owner on 2026-11-17).
- **Task 38b files.** `eval/project-suggest/ai-drafts/drafts.json`: 40 drafts (20 Arabic, 20 English),
  text only, `writtenBy: "ai"`, model and method recorded.
  - **Sealed labels.** Claude's proposed labels and full self-review are not in the working tree.
    `drafts.json` records a sha256 commitment to each and the commit that holds them;
    `unseal-proposed` restores them only after both reviewers' confirmed sheets are imported, and only
    if the sha256 matches. `self-review-summary.md` names no capability.
  - **Review.** Reviewers get the text only (no category, no proposed label), each **confirms in
    their sheet that they did not open Claude's labels** (a sheet without the confirmation is
    refused; the confirmation is stored in the set), decides keep / edit / reject and labels
    independently. `import-ai-review` builds **`testset-ai-v3.json`** with both confirmations, both
    reviewers' decisions and labels, and Cohen's kappa on the drafts neither rejected.
  - **Resolution.** `resolve-ai-review` requires Claude's unsealed labels matching the commitment,
    records the final decision, text and labels with a reason, moves rejected drafts to `rejected`
    with their reviews, labels and reason (never evaluated), stores Claude's original labels on
    every draft (`claudeProposed`, rejected ones included), and records the kept / edited / rejected
    counts and Claude-vs-human agreement.
  - **Check and freeze** recompute every rule from the stored reviews instead of trusting stored
    values: whether each draft is settled, the kappa, the counts and the Claude comparison. They
    require every draft exactly once (no missing or duplicate id), the drafts' sha256 and each
    case's origin to match `drafts.json`, and both confirmations.
  - **Safeguards for the human set:** `import-v2` refuses any Claude-drafted text, `check --v2`
    treats one as a copy, and `import-ai-review` refuses to write `testset-v2.json`.
  - **Limitation:** the labels were committed before they were sealed, so they remain in git history.
    Sealing keeps them out of a fresh checkout and out of the review sheets; it cannot erase them
    from history or technically prevent access. Reviewer blindness is therefore **not guaranteed**;
    it rests on each reviewer's recorded confirmation.
  `testset-v2.json` itself stays human-written: rule 1 of this section is unchanged.

## 5. When a set is frozen

`testset-v2.json` is frozen with `eval.mjs freeze` once `check --v2` passes and the agreement is
recorded, and before any Task 08 work is evaluated. After freezing, nobody looks at per-case errors
on it to change a method; per-case output is for the final report.

## 6. What counts as an error

Every false positive (wrong capability, or any unsupported suggestion), every false negative, and
every suggestion on a should-abstain case. A suggestion whose quote is not the student's own
words is an error even when the capability happens to be right.

## 7. Rules for methods

- **No external APIs.** No remote AI models, no external data services, no `fetch` to an outside
  domain, no API keys — in the product and in the harness (`tests/evalHarness.test.js` checks the
  harness for API endpoints, key headers and `fetch(`). Since Task 49, `tests/networkGuard.test.js`
  checks every script in `src/`, `public/`, `scripts/`, `eval/` and `resources/` as well; the only
  outside request left in the repository is the build step that downloads the pinned model files
  (`scripts/prepare-semantic.mjs`, sha256 checked), which sends no text.
- Everything the product runs, runs in the browser. The harness runs under Node **only to
  measure**, importing the same modules and the same pinned model files (sha256 checked).
- Any additional local model (e.g. multilingual-e5-small) needs measurement on the frozen set and
  **course approval** before use.

## 8. Current baseline (frozen v1 set, measured with this harness)

| Method | Language | Precision | Recall | F1 | Unsupported | Correct abstentions |
|---|---|---|---|---|---|---|
| lexicon | Arabic | 93.3% | 60.9% | 73.7% | 0 | 2/2 |
| lexicon | English | 86.7% | 56.5% | 68.4% | 0 | 2/2 |
| embedding (0.52) | Arabic | 100% | 26.1% | 41.4% | 0 | 2/2 |
| embedding (0.52) | English | 100% | 26.1% | 41.4% | 0 | 2/2 |

These equal the 25 Oct report exactly (`eval/project-suggest/results/2026-10-25-original/`). The v1
set is AI-written and its errors have been seen, so it is a baseline only; improvements are judged
on the frozen v2 set. Per-case files: `eval/project-suggest/results/<date>-testset-<method>.{json,csv,md}`.

## 9. How anyone reruns it

```bash
npm ci
npm run build                     # once: fills .model-cache with the pinned model (sha256-checked)
npm run eval:suggest              # lexicon on the frozen v1 set
npm run eval:compare              # baseline vs MiniLM vs improved → results/<date>-comparison.md
node eval/project-suggest/eval.mjs run eval/project-suggest/testset.json --method all
node eval/project-suggest/eval.mjs check eval/project-suggest/testset-v2.json
```

Outputs go to `eval/project-suggest/results/<date>-<set>-<method>.{json,csv,md}`. Running twice
gives identical numbers (the methods are deterministic; `tests/evalHarness.test.js` checks this for
the lexicon method).

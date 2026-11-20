# Claude's self-review of the 40 drafts: summary for reviewers

This summary is safe to read before you review: it names no capability and no proposed label. Generated from `drafts.json` and the harness checks; do not edit by hand.

**Sealed until both reviewers' sheets are imported** (restored with `eval.mjs unseal-proposed`):

- Claude's proposed labels, with a reason and an ambiguity note per draft: `eval/project-suggest/ai-drafts/claude/proposed-labels.json`, sha256 `6493493e3764e0d51e0d23e9e7913ecb4a546bb3335bfe08123849b4f150e135`, in commit `f3db779057e4c808ee81483bfb511f3b00482582`.
- Claude's full self-review (per-draft proposed labels, capability coverage, ambiguity notes): `eval/project-suggest/ai-drafts/claude/self-review.md`, sha256 `40de0ae49d677b69875ae40286f3e5b111a33cb718605d56094f7240bfd2909a`, same commit.

Sealing keeps them out of the working tree and out of your review sheet. It does **not** erase them from git history, so blindness depends on you: do not look them up before your sheet is handed in. Your sheet starts with a confirmation row that records this.

## Checks run by code

- `checkDrafts`: **0 errors, 0 warnings** (language of every draft; exact and near copies of the dev, v1, ai-v2 and human v2 sets; duplicates inside the drafts; origin fields; the sealed commitment).
- Highest word overlap of any draft with any other set: 0.42; between two drafts: 0.25 (near-duplicate threshold 0.70).

## Balance

| Category | ar | en |
|---|---|---|
| direct | 5 | 7 |
| synonym | 4 | 4 |
| tech-name | 3 | 3 |
| multi | 3 | 3 |
| should-abstain | 3 | 3 |
| dialect | 2 | 0 |

Every capability has at least 3 proposed positive drafts and at least 1 in each language (counted on the sealed proposed labels; verified by `tests/evalHarness.test.js` from git history).

## Wording variety

- Average length: Arabic 16.8 words, English 22.8 words.
- Distinct two-word openings: Arabic 20 of 20, English 20 of 20.
- No Arabic draft is a translation of an English one; four Arabic drafts were rewritten while drafting because they mirrored English ones.

## Changes made during Claude's review

- Three synonym drafts (`aid-en-11`, `aid-ar-07`, `aid-ar-09`) were reworded because they still carried a near-keyword, which defeats the synonym category.
- Four drafts were marked as of medium ambiguity in the sealed review; reviewers may fairly disagree on some drafts, and a disagreement is information about the label, not a reviewer error.

// Runs every browser model on the course-text test set (official FCIT catalog descriptions), in four variants:
// old lexicon vs improved local engine, and whole sentences vs phrases. Threshold tuned on course-dev-set.json only.
// Usage (inside evaluation/):  node run-courses.mjs
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const VARIANTS = [
  { LEXICON: 'lexicon', EMBED_SPLIT: 'sentences' },
  { LEXICON: 'lexicon', EMBED_SPLIT: 'phrases' },
  { LEXICON: 'improved', EMBED_SPLIT: 'sentences' },
  { LEXICON: 'improved', EMBED_SPLIT: 'phrases' },
]
for (const v of VARIANTS) {
  console.log(`\n######## ${v.LEXICON} · ${v.EMBED_SPLIT} ########`)
  spawnSync(process.execPath, ['run-all.mjs'], { cwd: HERE, stdio: 'inherit',
    env: { ...process.env, ...v, EVAL_SETS: 'course-testset.json', EVAL_DEV: 'course-dev-set.json', EVAL_TAG: 'courses' } })
}
console.log('\nDone. The four tables are in results\\summary-courses*.md. Send them all.')

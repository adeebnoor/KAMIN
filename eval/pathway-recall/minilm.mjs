// Task 42 · the app's MiniLM search, run in Node: the same pinned model, the same pipeline options
// (mean pooling, normalised) and the same index texts (src/semantic/catalog.js) as the browser worker.
// No network: the model loads only from the local, hash-checked .model-cache folder that
// `npm run build` (scripts/prepare-semantic.mjs) fills.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EMBEDDING_MODEL } from '../../src/semantic/config.js'
import { semanticCatalog } from '../../src/semantic/catalog.js'
import { sha256 } from '../project-suggest/lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const MODEL_DIR = path.join(ROOT, '.model-cache', EMBEDDING_MODEL.revision)

let extractorPromise = null
function extractor() {
  if (!extractorPromise) extractorPromise = (async () => {
    const modelFile = path.join(MODEL_DIR, EMBEDDING_MODEL.filename)
    if (!existsSync(modelFile)) throw new Error(`MODEL_NOT_CACHED: run "npm run build" once (scripts/prepare-semantic.mjs fills ${path.relative(ROOT, MODEL_DIR)})`)
    const bytes = readFileSync(modelFile)
    if (bytes.length !== EMBEDDING_MODEL.bytes || sha256(bytes) !== EMBEDDING_MODEL.sha256) throw new Error('MODEL_INTEGRITY_FAILED: the cached model does not match the pinned sha256')
    const { pipeline, env } = await import('@huggingface/transformers')
    env.allowRemoteModels = false; env.allowLocalModels = true; env.useFSCache = false
    return pipeline('feature-extraction', MODEL_DIR + '/', { dtype: 'q8', device: 'cpu', local_files_only: true })
  })()
  return extractorPromise
}

// Same call as src/semantic/recall.worker.js: extractor(text.trim(), {pooling:'mean', normalize:true}).
export async function embed(text) {
  const tensor = await (await extractor())(String(text).trim(), { pooling: 'mean', normalize: true })
  return Array.from(tensor.data)
}

// The 38 reference vectors, built exactly as scripts/prepare-semantic.mjs builds the shipped index.
// `shipped` says whether they equal the cached index the build wrote (same catalog hash).
export async function buildIndex() {
  const index = []
  for (const item of semanticCatalog) index.push({ id: item.id, lang: item.lang, vector: await embed(item.text) })
  const cacheFile = path.join(MODEL_DIR, 'catalog-index-v1.json')
  let shipped = 'not built yet'
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8'))
    if (cached.catalogHash !== sha256(JSON.stringify(semanticCatalog))) shipped = 'cached index is for another catalog'
    else {
      const maxDiff = Math.max(...cached.index.map((item, i) => Math.max(...item.vector.map((v, j) => Math.abs(v - index[i].vector[j])))))
      shipped = maxDiff === 0 ? 'identical' : `differs by up to ${maxDiff.toExponential(2)}`
    }
  }
  return { index, shipped, catalogSha256: sha256(JSON.stringify(semanticCatalog)), texts: semanticCatalog.length }
}

export async function dispose() {
  if (extractorPromise) { const e = await extractorPromise; await e.dispose(); extractorPromise = null }
}

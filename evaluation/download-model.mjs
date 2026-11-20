// Downloads a browser embedding model (ONNX, quantized) into the models folder, for eval.mjs with EMBED_MODEL_DIR.
// Usage: node download-model.mjs [repo]   default: Xenova/multilingual-e5-small
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const repo = process.argv[2] || 'Xenova/multilingual-e5-small'
const out = path.join(HERE, 'models', repo.split('/').pop())
const files = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx']

for (const f of files) {
  const dest = path.join(out, f)
  if (fs.existsSync(dest)) { console.log(`✓ already there: ${f}`); continue }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const res = await fetch(`https://huggingface.co/${repo}/resolve/main/${f}`)
  if (!res.ok) { console.error(`✗ ${f}: HTTP ${res.status}`); if (f === 'special_tokens_map.json') continue; process.exit(1) }
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  console.log(`✓ ${f} (${(fs.statSync(dest).size / 1e6).toFixed(1)} MB)`)
}
console.log(`\nModel ready in: ${out}`)

import {readFile,stat,readdir} from 'node:fs/promises'
import {gzipSync} from 'node:zlib'
const html=await readFile('dist/index.html','utf8')
const initial=[...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(m=>m[1]))]
let compressed=0
for(const file of initial) compressed+=gzipSync(await readFile(`dist${file}`)).length
const font=(await stat('dist/fonts/noto-sans-arabic.woff2')).size
const inter=(await stat('dist/fonts/inter-latin.woff2')).size
if(inter>60*1024)throw new Error(`Inter subset exceeds 60 KiB: ${inter}`)
// 220 → 224 KiB (Task 01): the official FCIT course map (40 catalog courses with bilingual
// learning outcomes, ~3 KiB gzip) must load with the inference engine. Approved by the supervisor (recorded 2026-11-11).
// 224 → 228 KiB (Task 02): ordinal evidence-level rules with bilingual reasons shown on every
// capability card (~3 KiB gzip). Approved by the supervisor (recorded 2026-11-11).
const INITIAL_LIMIT_KIB=228
if(compressed>INITIAL_LIMIT_KIB*1024)throw new Error(`Initial assets exceed ${INITIAL_LIMIT_KIB} KiB gzip: ${compressed}`)
if(font>180*1024)throw new Error(`Arabic subset font exceeds 180 KiB: ${font}`)
if(initial.some(f=>/tesseract|pdf|sparql|oxigraph/i.test(f)))throw new Error('Heavy optional tools must remain lazy-loaded')
console.log(`Performance budget: ${(compressed/1024).toFixed(1)} KiB initial gzip (limit ${INITIAL_LIMIT_KIB}); ${(font/1024).toFixed(1)} KiB Arabic font (limit 180). OCR/SPARQL stay lazy.`)

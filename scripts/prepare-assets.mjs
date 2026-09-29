import { cp, mkdir, readdir, copyFile, access, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { ictKnowledgeGraph } from '../src/knowledge/ictKgV1.js'
import { courseSkillMap } from '../src/data.js'

const root=process.cwd()
const pub=path.join(root,'public')
const ocr=path.join(pub,'ocr')
const coreOut=path.join(ocr,'core')
const langOut=path.join(ocr,'lang')
const fontsOut=path.join(pub,'fonts')
const knowledgeOut=path.join(pub,'knowledge')
const mappingOut=path.join(pub,'mapping')
await mkdir(coreOut,{recursive:true})
await mkdir(langOut,{recursive:true})
await mkdir(fontsOut,{recursive:true})
await mkdir(knowledgeOut,{recursive:true})
await mkdir(mappingOut,{recursive:true})

const copyIfExists=async(src,dst)=>{
  try{await access(src);await copyFile(src,dst);return true}catch{return false}
}

const worker=path.join(root,'node_modules','tesseract.js','dist','worker.min.js')
if(!(await copyIfExists(worker,path.join(ocr,'worker.min.js')))) throw new Error('Tesseract browser worker not found')

const coreDir=path.join(root,'node_modules','tesseract.js-core')
for(const name of await readdir(coreDir)){
  if(/^tesseract-core.*\.(?:js|wasm)$/.test(name)) await copyFile(path.join(coreDir,name),path.join(coreOut,name))
}

async function findFile(dir,target){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name)
    if(entry.isDirectory()){const found=await findFile(p,target);if(found)return found}
    else if(entry.name===target)return p
  }
  return null
}
for(const lang of ['eng','ara']){
  const dir=path.join(root,'node_modules','@tesseract.js-data',lang)
  const src=await findFile(dir,`${lang}.traineddata.gz`)
  if(!src) throw new Error(`OCR language data missing: ${lang}`)
  await copyFile(src,path.join(langOut,`${lang}.traineddata.gz`))
}

const fontFilesDir=path.join(root,'node_modules','@fontsource-variable','noto-sans-arabic','files')
const fontFiles=await readdir(fontFilesDir)
const arabicVariableFont=fontFiles.find(name=>/arabic.*wght.*normal.*\.woff2$/i.test(name))
if(!arabicVariableFont) throw new Error('Noto Sans Arabic variable font asset not found')
await copyFile(path.join(fontFilesDir,arabicVariableFont),path.join(fontsOut,'noto-sans-arabic.woff2'))
await writeFile(path.join(fontsOut,'noto-sans-arabic.css'),`@font-face{font-family:"Noto Sans Arabic Variable";font-style:normal;font-display:swap;font-weight:100 900;src:url("/fonts/noto-sans-arabic.woff2") format("woff2")}\n`)

await writeFile(path.join(knowledgeOut,'ict-kg-v1.jsonld'),JSON.stringify(ictKnowledgeGraph,null,2)+'\n')
await writeFile(path.join(mappingOut,'course-skill-map-v1.json'),JSON.stringify({
  version:'kamin-course-skill-map-v1',
  namespace:'KAU-FCIT pilot',
  status:'governed-pilot-mapping',
  reviewedAt:'2026-09-27',
  mappings:courseSkillMap,
},null,2)+'\n')

const logo=path.join(pub,'kamin-logo-v3.webp')
for(const size of [192,512]){
  await sharp(logo).resize(size,size,{fit:'contain',background:'#ffffff'}).png({compressionLevel:9}).toFile(path.join(pub,`icon-${size}.png`))
}
await sharp(logo).resize(180,180,{fit:'contain',background:'#ffffff'}).png({compressionLevel:9}).toFile(path.join(pub,'apple-touch-icon.png'))

const overlay=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
<text x="600" y="250" font-family="Arial,sans-serif" font-weight="700" font-size="72" fill="#0b2f5b">Kamin</text>
<text x="600" y="330" font-family="Arial,sans-serif" font-size="34" fill="#334a62">Evidence-backed capability profile</text>
<text x="600" y="380" font-family="Arial,sans-serif" font-size="30" fill="#6b7280">Explainable fit · visible gaps · next steps</text>
<line x1="600" y1="420" x2="1040" y2="420" stroke="#c99a3d" stroke-width="4"/>
</svg>`)
const logoPanel=await sharp(logo).resize(430,540,{fit:'contain',background:{r:247,g:249,b:252,alpha:1}}).toBuffer()
await sharp({create:{width:1200,height:630,channels:3,background:'#f7f9fc'}})
  .composite([{input:logoPanel,left:70,top:45},{input:overlay,left:0,top:0}])
  .jpeg({quality:88,mozjpeg:true})
  .toFile(path.join(pub,'og-kamin-1200x630.jpg'))

console.log('Prepared Kamin icons, self-hosted Arabic font, ICT knowledge graph, governed mapping catalogue, social image, and fully self-hosted OCR assets.')

for (const lang of ['ar','en']) {
 const ar=lang==='ar'
 const words=ar?['كامن','قدراتك أوضح. خطوتك أقرب.','اهتمامات · أهداف · أدلة · مسارات']:['Kamin','Clarity for your next step.','Interests · goals · evidence · pathways']
 const svg=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#f4f8f1"/><rect x="70" y="82" width="8" height="466" rx="4" fill="#ba8b46"/><g fill="#16483e" font-family="DejaVu Sans,Arial,sans-serif" text-anchor="${ar?'end':'start'}"><text x="${ar?1110:120}" y="230" font-size="92" font-weight="700">${words[0]}</text><text x="${ar?1110:120}" y="340" font-size="49">${words[1]}</text><text x="${ar?1110:120}" y="425" font-size="31" fill="#527064">${words[2]}</text></g><text x="120" y="550" font-family="Arial,sans-serif" font-size="23" fill="#527064">KAMIN · RESEARCH RELEASE</text></svg>`)
 await sharp(svg).jpeg({quality:88,mozjpeg:true}).toFile(path.join(pub,`og-kamin-${lang}.jpg`))
}

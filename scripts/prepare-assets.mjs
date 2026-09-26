import { cp, mkdir, readdir, copyFile, access } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root=process.cwd()
const pub=path.join(root,'public')
const ocr=path.join(pub,'ocr')
const coreOut=path.join(ocr,'core')
const langOut=path.join(ocr,'lang')
await mkdir(coreOut,{recursive:true})
await mkdir(langOut,{recursive:true})

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

const logo=path.join(pub,'kamin-logo-v3.webp')
for(const size of [192,512]){
  await sharp(logo).resize(size,size,{fit:'contain',background:'#ffffff'}).png({compressionLevel:9}).toFile(path.join(pub,`icon-${size}.png`))
}
await sharp(logo).resize(180,180,{fit:'contain',background:'#ffffff'}).png({compressionLevel:9}).toFile(path.join(pub,'apple-touch-icon.png'))

const overlay=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
<text x="600" y="250" font-family="Arial,sans-serif" font-weight="700" font-size="72" fill="#0b2f5b">Kamin</text>
<text x="600" y="330" font-family="Arial,sans-serif" font-size="34" fill="#334a62">Evidence-backed capabilities</text>
<text x="600" y="380" font-family="Arial,sans-serif" font-size="30" fill="#6b7280">Explainable learning-fit decisions</text>
<line x1="600" y1="420" x2="1040" y2="420" stroke="#c99a3d" stroke-width="4"/>
</svg>`)
const logoPanel=await sharp(logo).resize(430,540,{fit:'contain',background:{r:247,g:249,b:252,alpha:1}}).toBuffer()
await sharp({create:{width:1200,height:630,channels:3,background:'#f7f9fc'}})
  .composite([{input:logoPanel,left:70,top:45},{input:overlay,left:0,top:0}])
  .jpeg({quality:88,mozjpeg:true})
  .toFile(path.join(pub,'og-kamin-1200x630.jpg'))

console.log('Prepared Kamin icons, social image, and fully self-hosted OCR assets.')

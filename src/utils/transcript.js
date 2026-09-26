const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const GRADE_MAP = new Map([
  ['أ+','A+'],['أ','A'],['ب+','B+'],['ب','B'],['ج+','C+'],['ج','C'],['د+','D+'],['د','D'],
  ['هـ','F'],['ه','F'],['ح','W'],['م','I'],
])
const GRADE_TOKEN = /^(?:A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|W|WF|I|IP|NP|DN|أ\+|أ|ب\+|ب|ج\+|ج|د\+|د|هـ|ه|ح|م)$/i
const COURSE_TOKEN = /\b(?:[A-Z]{2,8}\s*[- ]?\s*\d{2,4}|\d{2,4}\s*[- ]?\s*[A-Z]{2,8})\b/i
const numericGrade = (token) => /^\d{2,3}(?:\.\d+)?$/.test(token) && Number(token) >= 50 && Number(token) <= 100
const normalizeGrade = token => GRADE_MAP.get(String(token||'').trim()) || String(token||'').trim().toUpperCase()

function parseLine(line) {
  const text=normalize(line)
  if (!text) return null
  const forward=text.match(/\b([A-Z]{2,8})\s*[- ]?\s*(\d{2,4})\b/i)
  const reverse=text.match(/\b(\d{2,4})\s*[- ]?\s*([A-Z]{2,8})\b/i)
  const match=forward||reverse
  if (!match) return null
  const dept=(forward?match[1]:match[2]).toUpperCase()
  const number=forward?match[2]:match[1]
  const code=`${dept}-${number}`
  const after=text.slice((match.index||0)+match[0].length).trim()
  const tokens=after.split(/\s+/)
  let gradeIndex=tokens.findIndex((tok,i)=>i>0 && GRADE_TOKEN.test(tok))
  if (gradeIndex < 0) gradeIndex=tokens.findIndex((tok,i)=>i>0 && numericGrade(tok))
  if (gradeIndex < 0) return null
  let nameTokens=tokens.slice(0,gradeIndex)
  let hours=null
  if (nameTokens.length>1 && /^[1-6](?:\.0+)?$/.test(nameTokens.at(-1))) hours=Number(nameTokens.pop())
  const name=normalize(nameTokens.join(' '))
  if (name.length < 2) return null
  return {code,name,grade:normalizeGrade(tokens[gradeIndex]),hours}
}

export function parseTranscriptTextDetailed(text) {
  const lines=String(text||'').split(/\r?\n/).map(normalize).filter(Boolean)
  const courses=[]; const rejected=[]; const seen=new Set()
  for (const line of lines) {
    const row=parseLine(line)
    if (!row) {
      if (COURSE_TOKEN.test(line)) rejected.push({line,reason:'course-like row could not be parsed'})
      continue
    }
    const key=`${row.code}|${row.grade}|${row.name}`
    if (seen.has(key)) continue
    courses.push(row); seen.add(key)
  }
  return {courses,rejected,totalLines:lines.length}
}

export function parseTranscriptText(text) {
  return parseTranscriptTextDetailed(text).courses
}

function reconstructPdfLines(items) {
  const groups=[]
  for (const item of items) {
    const str=normalize(item.str)
    if (!str) continue
    const y=Number(item.transform?.[5]||0), x=Number(item.transform?.[4]||0)
    let group=groups.find(g=>Math.abs(g.y-y)<=2)
    if (!group) { group={y,parts:[]}; groups.push(group) }
    group.parts.push({x,str})
  }
  return groups.sort((a,b)=>b.y-a.y).map(g=>g.parts.sort((a,b)=>a.x-b.x).map(p=>p.str).join(' ')).join('\n')
}

async function createOcrWorker(onProgress){
  const {createWorker}=await import('tesseract.js')
  return createWorker(['eng','ara'],1,{
    workerPath:'/ocr/worker.min.js',
    corePath:'/ocr/core',
    langPath:'/ocr/lang',
    logger:(m)=>{
      if(m.status==='recognizing text') onProgress(Math.max(1,Math.min(99,Math.round((m.progress||0)*100))))
    },
  })
}

async function ocrImage(source,onProgress){
  const worker=await createOcrWorker(onProgress)
  try{
    const result=await worker.recognize(source)
    return result.data.text||''
  }finally{
    await worker.terminate()
  }
}

async function ocrPdf(doc,onProgress){
  const worker=await createOcrWorker(()=>{})
  let text=''
  try{
    for(let i=1;i<=doc.numPages;i+=1){
      const page=await doc.getPage(i)
      const viewport=page.getViewport({scale:2})
      const canvas=document.createElement('canvas')
      canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height)
      const ctx=canvas.getContext('2d',{alpha:false})
      await page.render({canvasContext:ctx,viewport}).promise
      const result=await worker.recognize(canvas)
      text += (result.data.text||'')+'\n'
      onProgress(Math.round((i/doc.numPages)*95))
      canvas.width=1; canvas.height=1
    }
  }finally{
    await worker.terminate()
  }
  return text
}

function finalize(text,source,mode,extra={}){
  const parsed=parseTranscriptTextDetailed(text)
  return {
    text,
    courses:parsed.courses.map(r=>({...r,source})),
    validation:{
      recognized:parsed.courses.length,
      rejected:parsed.rejected,
      totalLines:parsed.totalLines,
      usedOcr:!!extra.usedOcr,
      pages:extra.pages||null,
      mode,
    },
    mode,
  }
}

export async function extractTranscript(file, onProgress = () => {}) {
  if(!file) throw new Error('NO_FILE')
  const type=file.type||''
  const name=file.name?.toLowerCase()||''

  if (type.includes('pdf') || name.endsWith('.pdf')) {
    const [pdfjs,workerModule]=await Promise.all([import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    pdfjs.GlobalWorkerOptions.workerSrc=workerModule.default
    const buffer=await file.arrayBuffer()
    let doc
    try{doc=await pdfjs.getDocument({data:buffer}).promise}catch{throw new Error('PDF_OPEN_FAILED')}
    let text=''
    for(let i=1;i<=doc.numPages;i+=1){
      onProgress(Math.round((i/doc.numPages)*45))
      const page=await doc.getPage(i)
      const content=await page.getTextContent()
      text += reconstructPdfLines(content.items)+'\n'
    }
    const first=finalize(text,'pdf','pdf-text-local',{pages:doc.numPages,usedOcr:false})
    const sparse=text.replace(/\s/g,'').length<80
    if(first.courses.length || !sparse){onProgress(100);return first}

    onProgress(50)
    const ocrText=await ocrPdf(doc,p=>onProgress(50+Math.round(p/2)))
    onProgress(100)
    return finalize(ocrText,'ocr','pdf-ocr-local',{pages:doc.numPages,usedOcr:true})
  }

  if (type.startsWith('image/') || /\.(?:png|jpe?g|webp)$/i.test(name)) {
    const text=await ocrImage(file,onProgress)
    onProgress(100)
    return finalize(text,'ocr','image-ocr-local',{usedOcr:true})
  }

  if (type.startsWith('text/') || name.endsWith('.txt')) {
    const text=await file.text()
    onProgress(100)
    return finalize(text,'text','text-local')
  }

  throw new Error('UNSUPPORTED_FILE_TYPE')
}

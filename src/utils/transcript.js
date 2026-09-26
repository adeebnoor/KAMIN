const ARABIC_DIGITS='٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS='۰۱۲۳۴۵۶۷۸۹'
const normalizeDigits=(value)=>String(value||'')
  .replace(/[٠-٩]/g,d=>String(ARABIC_DIGITS.indexOf(d)))
  .replace(/[۰-۹]/g,d=>String(PERSIAN_DIGITS.indexOf(d)))
const normalize = (s) => normalizeDigits(s)
  .replace(/[‐‑‒–—−]/g,'-')
  .replace(/[\u200e\u200f\u202a-\u202e]/g,' ')
  .replace(/\s+/g, ' ')
  .trim()

const GRADE_MAP = new Map([
  ['أ+','A+'],['ا+','A+'],['أ','A'],['ا','A'],
  ['ب+','B+'],['ب','B'],['ج+','C+'],['ج','C'],['د+','D+'],['د','D'],
  ['هـ','F'],['ه','F'],['ح','W'],['م','I'],
])
const GRADE_TOKEN = /^(?:A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|W|WF|I|IP|NP|DN|P|PASS|أ\+|ا\+|أ|ا|ب\+|ب|ج\+|ج|د\+|د|هـ|ه|ح|م)$/i
const COURSE_FORWARD = /\b([A-Z]{2,10})\s*[-\/:]?\s*(\d{2,4}[A-Z]?)\b/ig
const COURSE_REVERSE = /\b(\d{2,4}[A-Z]?)\s*[-\/:]?\s*([A-Z]{2,10})\b/g
const numericGrade = (token) => /^\d{2,3}(?:\.\d+)?$/.test(token) && Number(token) >= 50 && Number(token) <= 100
const normalizeGrade = token => GRADE_MAP.get(String(token||'').trim()) || String(token||'').trim().toUpperCase()

function findCourseMatches(text){
  const matches=[]
  for(const pattern of [COURSE_FORWARD,COURSE_REVERSE]){
    pattern.lastIndex=0
    let m
    while((m=pattern.exec(text))){
      const reverse=pattern===COURSE_REVERSE
      const dept=(reverse?m[2]:m[1]).toUpperCase()
      const number=(reverse?m[1]:m[2]).toUpperCase()
      matches.push({index:m.index,end:m.index+m[0].length,raw:m[0],code:`${dept}-${number}`})
    }
  }
  return matches.sort((a,b)=>a.index-b.index || (b.end-b.index)-(a.end-a.index))
    .filter((m,i,arr)=>!i || m.index!==arr[i-1].index)
}

const hasCourseToken = (text) => findCourseMatches(text).length>0

function tokenObjects(text){
  const tokens=[]
  const re=/\S+/g
  let m
  while((m=re.exec(text))) tokens.push({value:m[0],start:m.index,end:m.index+m[0].length})
  return tokens
}
const overlaps=(token,span)=>token.start < span.end && token.end > span.index
const cleanNameToken=(value)=>value.replace(/^[,;:|()[\]{}]+|[,;:|()[\]{}]+$/g,'')

function parseLine(line) {
  const text=normalize(line)
  if (!text) return null
  const course=findCourseMatches(text)[0]
  if (!course) return null

  const tokens=tokenObjects(text)
  const codeTokenIndexes=new Set(tokens.map((t,i)=>overlaps(t,course)?i:-1).filter(i=>i>=0))
  const candidates=tokens
    .map((t,i)=>({i,raw:t.value,norm:cleanNameToken(t.value)}))
    .filter(x=>!codeTokenIndexes.has(x.i))

  let gradeCandidate=candidates.find(x=>GRADE_TOKEN.test(x.norm))
  if(!gradeCandidate) gradeCandidate=candidates.find(x=>numericGrade(x.norm))
  if(!gradeCandidate) return null

  const gradeTokenIndex=gradeCandidate.i
  const nearbyHours=tokens
    .map((t,i)=>({i,value:cleanNameToken(t.value)}))
    .filter(x=>!codeTokenIndexes.has(x.i) && x.i!==gradeTokenIndex && /^[1-6](?:\.0+)?$/.test(x.value))
    .sort((a,b)=>Math.abs(a.i-gradeTokenIndex)-Math.abs(b.i-gradeTokenIndex))
  const hoursCandidate=nearbyHours.find(x=>Math.abs(x.i-gradeTokenIndex)<=2) || null

  const nameTokens=[]
  for(let i=0;i<tokens.length;i+=1){
    if(codeTokenIndexes.has(i) || i===gradeTokenIndex || i===hoursCandidate?.i) continue
    let value=cleanNameToken(tokens[i].value)
    if(!value) continue

    // Remove GPA/points-like numeric metadata while preserving title numbers such as "Programming 2".
    if(/^\d+\.\d+$/.test(value)) continue
    if(/^\d{2,3}$/.test(value) && Number(value)>6) continue

    // Ignore a simple row index immediately before the course code.
    if(/^\d{1,2}$/.test(value) && tokens[i].end<=course.index && course.index-tokens[i].end<5) continue

    // Ignore obvious table separators and common column labels that OCR may repeat inline.
    if(/^(?:credits?|hours?|hrs?|points?|grade|الدرجة|الساعات|النقاط)$/i.test(value)) continue
    nameTokens.push(value)
  }

  const name=normalize(nameTokens.join(' '))
  if (name.length < 2) return null
  return {
    code:course.code,
    name,
    grade:normalizeGrade(gradeCandidate.norm),
    hours:hoursCandidate ? Number(hoursCandidate.value) : null,
  }
}

function splitMergedRows(line){
  const text=normalize(line)
  const matches=findCourseMatches(text)
  if(matches.length<=1) return [text]
  return matches.map((match,i)=>text.slice(match.index,matches[i+1]?.index ?? text.length).trim()).filter(Boolean)
}

export function parseTranscriptTextDetailed(text) {
  const rawLines=String(text||'').split(/\r?\n/).map(normalize).filter(Boolean)
  const lines=rawLines.flatMap(splitMergedRows)
  const courses=[]; const rejected=[]; const seen=new Set()

  for(let i=0;i<lines.length;i+=1){
    const line=lines[i]
    let row=parseLine(line)
    let consumed=0

    // Some PDF/OCR layouts wrap the title or grade onto the following line.
    if(!row && hasCourseToken(line)){
      for(let lookahead=1;lookahead<=2 && i+lookahead<lines.length;lookahead+=1){
        if(hasCourseToken(lines[i+lookahead])) break
        const combined=[line,...lines.slice(i+1,i+lookahead+1)].join(' ')
        row=parseLine(combined)
        if(row){consumed=lookahead;break}
      }
    }

    if (!row) {
      if (hasCourseToken(line)) rejected.push({line,reason:'course-like row could not be parsed'})
      continue
    }

    const key=`${row.code}|${row.grade}|${row.name}`
    if (!seen.has(key)) {
      courses.push(row)
      seen.add(key)
    }
    i+=consumed
  }

  return {
    courses,
    rejected,
    totalLines:rawLines.length,
    parsedLines:lines.length,
    coverage:lines.length ? courses.length/(courses.length+rejected.length || 1) : 0,
  }
}

export function parseTranscriptText(text) {
  return parseTranscriptTextDetailed(text).courses
}

function reconstructPdfLines(items) {
  const groups=[]
  const heights=(items||[]).map(item=>Math.abs(Number(item.transform?.[3]||0))).filter(Boolean)
  const medianHeight=heights.length ? heights.sort((a,b)=>a-b)[Math.floor(heights.length/2)] : 2
  const tolerance=Math.max(1.5,Math.min(4,medianHeight*.35))

  for (const item of items) {
    const str=normalize(item.str)
    if (!str) continue
    const y=Number(item.transform?.[5]||0), x=Number(item.transform?.[4]||0)
    let group=groups.find(g=>Math.abs(g.y-y)<=tolerance)
    if (!group) { group={y,parts:[]}; groups.push(group) }
    group.parts.push({x,str})
  }

  return groups
    .sort((a,b)=>b.y-a.y)
    .map(g=>g.parts.sort((a,b)=>a.x-b.x).map(p=>p.str).join(' '))
    .join('\n')
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
      parsedLines:parsed.parsedLines,
      extractionCoverage:parsed.coverage,
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
    const lowCoverage=first.validation.rejected.length>first.validation.recognized

    // OCR scanned/sparse PDFs, and also rescue text PDFs whose reconstructed rows look unreliable.
    if(first.courses.length && !lowCoverage){onProgress(100);return first}
    if(!sparse && !lowCoverage){onProgress(100);return first}

    onProgress(50)
    const ocrText=await ocrPdf(doc,p=>onProgress(50+Math.round(p/2)))
    onProgress(100)
    const ocr=finalize(ocrText,'ocr','pdf-ocr-local',{pages:doc.numPages,usedOcr:true})

    // Keep whichever local extraction produced more recognized rows; never inject demo data.
    return ocr.courses.length>first.courses.length ? ocr : first
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

import { findSsceSpecializationCandidates, findSsceLevelCandidates } from '../reference/ssce.js'
import { analyzePdfBytes, metadataSignals, scanQrFromPdf, scanQrFromImageFile } from './documentIntegrity.js'
import { readLayout, linesToText, textCharacterCount } from '../transcript/layout.js'
import { isKauTranscript, parseKauLines, reviewRows, KAU_FORMAT } from '../transcript/kau.js'
import { readStudentInfo, readStudentInfoFromText, isStudentInfoLine } from '../transcript/studentInfo.js'

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
  const segments=matches.map((match,i)=>text.slice(match.index,matches[i+1]?.index ?? text.length).trim()).filter(Boolean)
  // A segment becomes its own row only when it is a complete row (code + grade); otherwise it
  // stays with the preceding text. A title that merely contains a number, such as
  // "PHYS-101 Physics 101 A", is therefore kept whole instead of being cut in two and lost.
  const parts=[]
  for(const segment of segments){
    if(parts.length && !parseLine(segment)) parts[parts.length-1]+=` ${segment}`
    else parts.push(segment)
  }
  return parts.length>1 ? parts : [text]
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

// Task 51: the PDF text is read by position (src/transcript/layout.js): each column of each page in
// reading order, the STUDENT INFORMATION block apart. A PDF that is not a KAU transcript (Task 52: no
// STUDENT INFORMATION header) still goes to the generic parser above as text: the header block first,
// then the course lines.
export function pdfLayoutText(layout){
  return [linesToText(layout.headerLines),linesToText(layout.lines)].filter(Boolean).join('\n')
}

// Task 52: a KAU transcript is read row by row by src/transcript/kau.js. The review list gets the row of
// each course that is used (a retaken course's latest attempt, with every attempt in `attempts`); the
// grade is the printed letter, the hours the attempted credits (0 kept).
export function kauCourseRow(row){
  return {...row, grade:row.letter, hours:row.credits.ua}
}
export function readKauLayout(layout){
  const parsed=parseKauLines(layout)
  return {...parsed, courses:reviewRows(parsed.rows).map(kauCourseRow)}
}

// Fewer characters than this in the whole text layer: a scanned picture, not a text PDF.
export const SCANNED_TEXT_MIN_CHARS = 80
export const isScannedPdf = pages => textCharacterCount(pages) < SCANNED_TEXT_MIN_CHARS

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

// Task 53: the result never carries the page text (`text` stays inside these functions, for the SSCE
// candidates only). `student` holds only the college, major, degree, status and study mode
// (src/transcript/studentInfo.js); the name, student number, nationality and NID are dropped there.
// `validation.rejected` never holds a line of the STUDENT INFORMATION block.
function finalizeKau(layout,mode,extra={}){
  const text=pdfLayoutText(layout)
  const parsed=readKauLayout(layout)
  const lineCount=parsed.rows.length+parsed.rejected.length
  return {
    student:readStudentInfo(layout.headerLines),
    courses:parsed.courses.map(r=>({...r,source:'pdf'})),
    validation:{
      recognized:parsed.courses.length,
      rejected:parsed.rejected,
      totalLines:layout.lines.length,
      parsedLines:layout.lines.length,
      extractionCoverage:lineCount ? parsed.rows.length/lineCount : 0,
      usedOcr:false,
      scanned:false,
      pages:extra.pages||null,
      mode,
      format:KAU_FORMAT,
      terms:parsed.terms,
      checkGpa:parsed.checkGpa,
      ignored:parsed.ignored,
      ssceCandidates:findSsceSpecializationCandidates(text).slice(0,5),
      ssceLevelCandidates:findSsceLevelCandidates(text).slice(0,3),
      document:extra.document||null,
    },
    mode,
  }
}

// A rejected line that is (part of) a header line, or that starts with a STUDENT INFORMATION label.
function withoutHeaderLines(rejected,headerLines=[]){
  const headers=headerLines.map(line=>normalize(line.text)).filter(Boolean)
  return rejected.filter(r=>!isStudentInfoLine(r.line) && !headers.some(h=>h.includes(r.line)))
}

function finalize(text,source,mode,extra={}){
  const parsed=parseTranscriptTextDetailed(text)
  return {
    student:extra.headerLines?readStudentInfo(extra.headerLines):readStudentInfoFromText(text),
    courses:parsed.courses.map(r=>({...r,source})),
    validation:{
      recognized:parsed.courses.length,
      rejected:withoutHeaderLines(parsed.rejected,extra.headerLines),
      totalLines:parsed.totalLines,
      parsedLines:parsed.parsedLines,
      extractionCoverage:parsed.coverage,
      usedOcr:!!extra.usedOcr,
      scanned:!!extra.scanned,
      pages:extra.pages||null,
      mode,
      ssceCandidates:findSsceSpecializationCandidates(text).slice(0,5),
      ssceLevelCandidates:findSsceLevelCandidates(text).slice(0,3),
      document:extra.document||null,
    },
    mode,
  }
}

// The text pages of a PDF (pdf.js text items, page by page) → the result the app receives. Pure: no DOM,
// no pdf.js, so tests read the Task 50 fixtures through exactly this path. OCR is not run here.
export function readTranscriptPages(pages,{document=null}={}){
  const count=(pages||[]).length
  // No text layer (or almost none): a scanned picture. Say so; never an empty list without a reason.
  if(isScannedPdf(pages)) return finalize('','pdf','pdf-scanned',{pages:count,usedOcr:false,scanned:true,document,headerLines:[]})
  const layout=readLayout(pages)
  return isKauTranscript(layout)
    ? finalizeKau(layout,'pdf-text-local',{pages:count,document})
    : finalize(pdfLayoutText(layout),'pdf','pdf-text-local',{pages:count,usedOcr:false,document,headerLines:layout.headerLines})
}

// Task 21: onProgress(percent, stage) names what is happening, so the start screen can show it. The
// stage is one of READING_STAGES; callers that read only the percentage keep working as before.
export const READING_STAGES = Object.freeze(['open', 'read', 'find'])

// Task 51: a PDF without a text layer (a scan) is not read by OCR on its own: the result says
// `validation.scanned` and the start screen asks. `{ readPicture: true }` (the "Try reading the picture"
// button) reads the pages as images.
export async function extractTranscript(file, onProgress = () => {}, { readPicture = false } = {}) {
  if(!file) throw new Error('NO_FILE')
  onProgress(2,'open')
  const type=file.type||''
  const name=file.name?.toLowerCase()||''

  if (type.includes('pdf') || name.endsWith('.pdf')) {
    const [pdfjs,workerModule]=await Promise.all([import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    pdfjs.GlobalWorkerOptions.workerSrc=workerModule.default
    const buffer=await file.arrayBuffer()
    // Structural signals come from a copy of the raw bytes: pdf.js transfers the buffer to its worker.
    const structure=analyzePdfBytes(new Uint8Array(buffer.slice(0)))
    let doc
    try{doc=await pdfjs.getDocument({data:buffer}).promise}catch{throw new Error('PDF_OPEN_FAILED')}
    const metadata=await doc.getMetadata().catch(()=>({info:{}}))
    const document={kind:'pdf',...structure,...metadataSignals(metadata?.info||{}),qr:await scanQrFromPdf(doc,2)}
    if(readPicture){
      onProgress(5,'read')
      const ocrText=await ocrPdf(doc,p=>onProgress(5+Math.round(p*0.9),'read'))
      onProgress(100,'find')
      return finalize(ocrText,'ocr','pdf-ocr-local',{pages:doc.numPages,usedOcr:true,document})
    }
    const pages=[]
    for(let i=1;i<=doc.numPages;i+=1){
      onProgress(Math.round((i/doc.numPages)*45),'read')
      const page=await doc.getPage(i)
      pages.push((await page.getTextContent()).items)
    }

    onProgress(46,'find')
    const first=readTranscriptPages(pages,{document})
    if(first.validation.scanned){onProgress(100,'find');return first}
    const lowCoverage=first.validation.rejected.length>first.validation.recognized
    if(!lowCoverage){onProgress(100,'find');return first}

    // A text PDF whose rows look unreliable: also read the pages as images (slower) and compare.
    onProgress(50,'read')
    const ocrText=await ocrPdf(doc,p=>onProgress(50+Math.round(p/2),'read'))
    onProgress(100,'find')
    const ocr=finalize(ocrText,'ocr','pdf-ocr-local',{pages:doc.numPages,usedOcr:true,document})

    // Keep whichever local extraction produced more recognized rows; never inject demo data.
    // The STUDENT INFORMATION block is read from the text layer by position (more reliable than OCR text).
    return ocr.courses.length>first.courses.length ? {...ocr,student:first.student} : first
  }

  if (type.startsWith('image/') || /\.(?:png|jpe?g|webp)$/i.test(name)) {
    const qr=await scanQrFromImageFile(file)
    const text=await ocrImage(file,p=>onProgress(p,'read'))
    onProgress(100,'find')
    return finalize(text,'ocr','image-ocr-local',{usedOcr:true,document:{kind:'image',qr}})
  }

  if (type.startsWith('text/') || name.endsWith('.txt')) {
    const text=await file.text()
    onProgress(100,'find')
    return finalize(text,'text','text-local')
  }

  throw new Error('UNSUPPORTED_FILE_TYPE')
}

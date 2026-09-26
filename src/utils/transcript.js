const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const GRADE_MAP = new Map([
  ['أ+','A+'],['أ','A'],['ب+','B+'],['ب','B'],['ج+','C+'],['ج','C'],['د+','D+'],['د','D'],
  ['هـ','F'],['ه','F'],['ح','W'],['م','I'],
])
const GRADE_TOKEN = /^(?:A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|W|WF|I|IP|NP|DN|أ\+|أ|ب\+|ب|ج\+|ج|د\+|د|هـ|ه|ح|م)$/i
const numericGrade = (token) => /^\d{2,3}(?:\.\d+)?$/.test(token) && Number(token) >= 50 && Number(token) <= 100
const normalizeGrade = token => GRADE_MAP.get(String(token||'').trim()) || String(token||'').trim().toUpperCase()

function parseLine(line) {
  const text=normalize(line)
  if (!text) return null
  const forward=text.match(/\b([A-Z]{2,6})\s*[- ]?\s*(\d{2,4})\b/i)
  const reverse=text.match(/\b(\d{2,4})\s*[- ]?\s*([A-Z]{2,6})\b/i)
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

export function parseTranscriptText(text) {
  const lines=String(text||'').split(/\r?\n/).map(normalize).filter(Boolean)
  const results=[]; const seen=new Set()
  for (const line of lines) {
    const row=parseLine(line)
    if (!row) continue
    const key=`${row.code}|${row.grade}|${row.name}`
    if (seen.has(key)) continue
    results.push(row); seen.add(key)
  }
  return results
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

export async function extractTranscript(file, onProgress = () => {}) {
  const type=file.type||''
  if (type.includes('pdf') || file.name?.toLowerCase().endsWith('.pdf')) {
    const [pdfjs,workerModule]=await Promise.all([import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    pdfjs.GlobalWorkerOptions.workerSrc=workerModule.default
    const buffer=await file.arrayBuffer()
    const doc=await pdfjs.getDocument({data:buffer}).promise
    let text=''
    for(let i=1;i<=doc.numPages;i+=1){
      onProgress(Math.round((i/doc.numPages)*90))
      const page=await doc.getPage(i)
      const content=await page.getTextContent()
      text += reconstructPdfLines(content.items)+'\n'
    }
    onProgress(100)
    return {text,courses:parseTranscriptText(text).map(r=>({...r,source:'pdf'})),mode:'pdf-local'}
  }

  if (type.startsWith('image/')) {
    throw new Error('IMAGE_OCR_DISABLED_UNTIL_SELF_HOSTED')
  }

  const text=await file.text()
  return {text,courses:parseTranscriptText(text).map(r=>({...r,source:'text'})),mode:'text-local'}
}

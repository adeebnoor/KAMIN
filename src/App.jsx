import { Component, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Check, ChevronDown, ClipboardCheck,
  Download, FileCheck2, Fingerprint, GraduationCap, Languages, LayoutDashboard,
  LockKeyhole, Menu, Plus, SearchCheck, ShieldCheck, Sparkles, Target, Trash2,
  UploadCloud, X,
} from 'lucide-react'
import { copy } from './i18n.js'
import { courseSkillMap, demoCourses } from './data.js'
import { inferSkills, judgeOpportunities } from './utils/engine.js'
import { extractTranscript } from './utils/transcript.js'

const STORAGE_KEY = 'kamin-pilot-session-v2'
const LEGACY_STORAGE_KEY = 'kamin-pilot-v1'
const blankState = {
  courses: [],
  approved: false,
  goal: null,
  consents: { analyze: false, advisor: false, research: false },
  audit: [],
}

const getSaved = () => {
  try {
    let raw=sessionStorage.getItem(STORAGE_KEY)
    if(!raw){
      const legacy=localStorage.getItem(LEGACY_STORAGE_KEY)
      if(legacy){
        raw=legacy
        sessionStorage.setItem(STORAGE_KEY,legacy)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
      }
    }
    const parsed=JSON.parse(raw||'null')
    return parsed && typeof parsed==='object' ? { ...blankState, ...parsed } : blankState
  } catch {
    return blankState
  }
}

const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.ar || value?.en || ''
const normalizeCourseCode = (code) => String(code||'').trim().toUpperCase().replace(/\s+/g,'-').replace(/^([A-Z]{2,8})-?(\d{2,4})$/,'$1-$2')
const isMappedCourse = (code) => !!courseSkillMap[normalizeCourseCode(code)]
const timeText = (ts, lang) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts))

function setMeta(name, content, attr = 'name') {
  const el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (el) el.setAttribute('content', content)
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">ك</span>
}

function Logo({ lang = 'ar' }) {
  return <span className="logo">
    <img
      src="/kamin-logo-v3.webp"
      alt={lang === 'ar' ? 'شعار كامن' : 'Kamin logo'}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      width="259"
      height="430"
    />
  </span>
}

function Header({ lang, setLang, onTry }) {
  const t = copy[lang]
  const [open, setOpen] = useState(false)
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight
  const go = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setOpen(false) }
  return <header className="site-header">
    <div className="shell header-row">
      <button className="brand" onClick={() => go('home')} aria-label={t.nav.home}>
        <BrandMark/><span><strong>{t.name}</strong><small>{t.tagline}</small></span>
      </button>
      <nav id="mobile-nav" className={open ? 'main-nav open' : 'main-nav'} aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
        <button onClick={() => go('how')}>{t.nav.how}</button>
        <button onClick={() => go('trust')}>{t.nav.trust}</button>
        <button className="nav-primary" onClick={() => { onTry(); setOpen(false) }}>{t.nav.app}<Arrow size={16}/></button>
      </nav>
      <div className="header-tools">
        <button className="language-button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
          <Languages size={18}/><span>{lang === 'ar' ? 'EN' : 'العربية'}</span>
        </button>
        <button className="menu-button" aria-label={lang === 'ar' ? (open ? 'إغلاق القائمة' : 'فتح القائمة') : (open ? 'Close menu' : 'Open menu')} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(v => !v)}>{open ? <X/> : <Menu/>}</button>
      </div>
    </div>
  </header>
}

function Hero({ lang, onTry }) {
  const t = copy[lang]
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight
  return <section id="home" className="hero">
    <div className="shell hero-grid">
      <div className="hero-copy">
        <span className="eyebrow"><Sparkles size={16}/>{t.hero.eyebrow}</span>
        <h1>{t.hero.title}</h1>
        <p>{t.hero.text}</p>
        <div className="hero-actions">
          <button className="button primary" onClick={onTry}>{t.hero.cta}<Arrow size={18}/></button>
          <button className="button secondary" onClick={() => document.getElementById('example')?.scrollIntoView({ behavior:'smooth' })}>{t.hero.secondary}</button>
        </div>
        <div className="privacy-chip"><ShieldCheck size={18}/><span>{t.hero.trust}</span></div>
      </div>
      <div className="hero-preview" aria-label={lang === 'ar' ? 'معاينة ملف كامن' : 'Kamin profile preview'}>
        <div className="logo-panel"><Logo lang={lang}/></div>
        <div className="float-card top"><SearchCheck size={18}/><div><small>{t.hero.cards[0][0]}</small><strong>{t.hero.cards[0][1]}</strong></div></div>
        <div className="float-card bottom"><BadgeCheck size={18}/><div><small>{t.hero.cards[1][0]}</small><strong>{t.hero.cards[1][1]}</strong></div></div>
      </div>
    </div>
  </section>
}

function ValueExample({ lang }) {
  const v = copy[lang].value
  return <section id="example" className="section value-section">
    <div className="shell">
      <div className="section-title"><span>01</span><div><small className="value-kicker">{v.kicker}</small><h2>{v.title}</h2><p>{v.intro}</p></div></div>
      <div className="value-grid">
        <article className="value-card traditional"><small>{v.traditional}</small><h3>{v.traditionalItems[0]}</h3><ul>{v.traditionalItems.slice(1).map(item=><li key={item}>{item}</li>)}</ul></article>
        <article className="value-card kamin-value"><small>{v.kamin}</small><div className="value-signals">{v.signals.map(([type,title,evidence])=><div className="value-signal" key={type+title}><span>{type}</span><div><strong>{title}</strong><small>{evidence}</small></div></div>)}</div></article>
      </div>
      <div className="value-result"><ShieldCheck size={18}/><div><strong>{lang==='ar'?'النتيجة':'Outcome'}</strong><p>{v.result}</p><small>{v.demo}</small></div></div>
    </div>
  </section>
}

function Landing({ lang, onTry }) {
  const t = copy[lang]
  const stepIcons = [UploadCloud, Sparkles, Target]
  const trustIcons = [Fingerprint, FileCheck2, ShieldCheck, SearchCheck]
  return <>
    <Hero lang={lang} onTry={onTry}/>
    <ValueExample lang={lang}/>
    <section id="how" className="section">
      <div className="shell">
        <div className="section-title"><span>01</span><h2>{t.how.title}</h2></div>
        <div className="cards-3">{t.how.steps.map(([title, text], i) => {
          const Icon = stepIcons[i]
          return <article className="info-card" key={title}><div className="icon-box"><Icon/></div><small>0{i+1}</small><h3>{title}</h3><p>{text}</p></article>
        })}</div>
      </div>
    </section>
    <section id="trust" className="section trust">
      <div className="shell trust-grid">
        <div className="trust-copy"><span className="eyebrow"><LockKeyhole size={16}/>Privacy by design</span><h2>{t.trustTitle}</h2><p>{t.compliance.text}</p><div className="compliance-pill"><ShieldCheck size={18}/>{t.compliance.title}</div></div>
        <div className="trust-cards">{t.trustItems.map(([title,text],i) => {
          const Icon = trustIcons[i]
          return <article key={title}><Icon/><h3>{title}</h3><p>{text}</p></article>
        })}</div>
      </div>
    </section>
    <section id="faq" className="section faq-section">
      <div className="shell faq-grid">
        <div className="section-title"><span>03</span><h2>{lang === 'ar' ? 'كيف يستنتج كامن مهاراتك؟' : 'How does Kamin infer your skills?'}</h2></div>
        <div className="faq-list">
          <details>
            <summary>{lang === 'ar' ? 'هل الدرجة وحدها تكفي؟' : 'Is a grade enough on its own?'}</summary>
            <p>{lang === 'ar' ? 'لا. كامن يربط المقرر ومخرجات تعلمه بمهارة معتمدة، ثم يستخدم الدرجة كجزء من قوة الدليل، وليس كحكم منفرد.' : 'No. Kamin links an approved course and its learning outcomes to a skill, then uses the grade as part of the evidence strength—not as a standalone judgment.'}</p>
          </details>
          <details>
            <summary>{lang === 'ar' ? 'هل يستطيع كامن منعي من دورة؟' : 'Can Kamin block me from a course?'}</summary>
            <p>{lang === 'ar' ? 'لا. الحكم مفسّر وغير حاكم. يمكنك فتح أي دورة، وكل حكم سلبي يصاحبه طريق واضح يشرح متى تصبح مناسبة.' : 'No. Judgments are explained and non-binding. You can open any course, and every negative judgment includes a clear path showing what would make it suitable.'}</p>
          </details>
          <details>
            <summary>{lang === 'ar' ? 'أين تُحفظ بيانات النسخة العامة؟' : 'Where is public-pilot data stored?'}</summary>
            <p>{lang === 'ar' ? 'في جهازك ومتصفحك فقط. يمكنك تصدير الجلسة أو حذفها بالكامل. أي انتقال إلى تخزين مؤسسي مركزي يخضع لبوابة امتثال مستقلة.' : 'On your device and in your browser only. You can export or fully delete the session. Any move to centralized institutional storage requires a separate compliance gate.'}</p>
          </details>
        </div>
      </div>
    </section>
    <section className="final-cta"><div className="shell final-cta-row"><div><small>{t.name}</small><h2>{lang === 'ar' ? 'لا تدع مهارة مثبتة تبقى كامنة.' : 'Do not let proven capability stay hidden.'}</h2><p>{lang === 'ar' ? 'ابدأ بسجل واحد. راجع الدليل بنفسك. واتخذ قرارك على أساس واضح.' : 'Start with one record. Review the evidence yourself. Decide on a clearer basis.'}</p></div><button className="button light" onClick={onTry}>{t.hero.cta}{lang === 'ar' ? <ArrowLeft/> : <ArrowRight/>}</button></div></section>
  </>
}

function ValidationSummary({lang,validation}) {
  if(!validation) return null
  const rejected=validation.rejected||[]
  return <div className="validation-summary" role="status" aria-live="polite">
    <div><strong>{lang==='ar'?'ملخص التحقق':'Validation summary'}</strong><span>{lang==='ar'? `${validation.recognized||0} مقرر تم التعرف عليه` : `${validation.recognized||0} courses recognized`}</span></div>
    <div className="validation-badges">
      <span>{validation.usedOcr?(lang==='ar'?'OCR محلي':'Local OCR'):(lang==='ar'?'نص رقمي':'Digital text')}</span>
      <span>{rejected.length ? (lang==='ar'? `${rejected.length} سطر يحتاج مراجعة` : `${rejected.length} rows need review`) : (lang==='ar'?'لا توجد أسطر مشتبهة':'No suspicious rows')}</span>
    </div>
    {rejected.length>0&&<details><summary>{lang==='ar'?'عرض الأسطر التي تعذر تحليلها':'Show rows that could not be parsed'}</summary>{rejected.slice(0,12).map((r,i)=><code key={i}>{r.line}</code>)}</details>}
  </div>
}

function CourseReview({ lang, rows, setRows, onApprove, consent, setConsent }) {
  const t = copy[lang].app
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ code:'', name:'', grade:'' })
  const update = (i,key,value) => setRows(rows.map((r,idx) => idx === i ? { ...r, [key]: value } : r))
  const add = () => {
    if (!form.code.trim() || !form.name.trim() || !form.grade.trim()) return
    setRows([...rows, { ...form, code: form.code.toUpperCase() }]); setForm({code:'',name:'',grade:''}); setFormOpen(false)
  }
  return <div className="panel">
    <div className="panel-head"><div><small>{t.review}</small><h3>{lang === 'ar' ? `${rows.length} مقررات مستخرجة` : `${rows.length} extracted courses`}</h3></div><button className="text-button" onClick={() => setFormOpen(v => !v)}><Plus size={17}/>{t.addRow}</button></div>
    {formOpen && <div className="manual-row"><input aria-label={t.courseCode} placeholder="CPIT-251" value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/><input aria-label={t.courseName} placeholder={t.courseName} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input aria-label={t.grade} placeholder="A / B+" value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}/><button onClick={add}>{t.save}</button></div>}
    <div className="table-scroll"><table><thead><tr><th>{t.courseCode}</th><th>{t.courseName}</th><th>{t.grade}</th><th>{lang==='ar'?'حالة الربط':'Mapping'}</th><th><span className="sr-only">remove</span></th></tr></thead><tbody>
      {rows.map((r,i)=><tr key={i}><td><input value={r.code} aria-label={`${t.courseCode} ${i+1}`} onChange={e=>update(i,'code',e.target.value)}/></td><td><input value={localized(r.name,lang)} aria-label={`${t.courseName} ${i+1}`} onChange={e=>update(i,'name',e.target.value)}/></td><td><input value={r.grade} aria-label={`${t.grade} ${i+1}`} onChange={e=>update(i,'grade',e.target.value)}/></td><td><span className={isMappedCourse(r.code)?'mapping-badge mapped':'mapping-badge unmapped'}>{isMappedCourse(r.code)?(lang==='ar'?'ربط معتمد في التجربة':'Pilot mapping'):(lang==='ar'?'غير مربوط بعد':'Not mapped yet')}</span></td><td><button className="icon-danger" onClick={()=>setRows(rows.filter((_,idx)=>idx!==i))} aria-label={lang==='ar'?`حذف ${r.code}`:`Delete ${r.code}`}><Trash2 size={16}/></button></td></tr>)}
    </tbody></table></div>
    {rows.some(r=>!isMappedCourse(r.code))&&<div className="mapping-note"><SearchCheck size={17}/><span>{lang==='ar'?'المقرر غير المربوط يبقى في سجلك لكنه لا ينتج مهارة أو يؤثر في الحكم حتى يعتمد القسم ربطه بمخرج تعلم ومهارة.':'An unmapped course stays in your record but creates no skill and affects no judgment until the department approves a learning-outcome-to-skill mapping.'}</span></div>}
    <div className="approval approval-consent"><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{lang === 'ar' ? 'أوافق صراحةً على تحليل هذا السجل لبناء ملف مهاراتي بعد مراجعتي له.' : 'I explicitly consent to analyzing this record to build my skills profile after reviewing it.'}</span></label><button className="button primary" disabled={!rows.length || !consent} onClick={onApprove}><Check size={17}/>{t.approve}</button></div>
  </div>
}

function SkillCard({ skill, lang }) {
  const t = copy[lang].app
  return <article className="skill-card"><div className="skill-top"><div><small>{t.confidence}</small><h3>{skill.labels[lang]}</h3></div><strong>{skill.confidence}%</strong></div><div className="meter"><i style={{width:`${skill.confidence}%`}}/></div><div className="evidence"><small>{t.evidence}</small>{skill.evidence.map((e,i)=><p key={i}><BookOpen size={15}/><span>{e.code} · {localized(e.name,lang)}</span><b>{e.grade}</b></p>)}</div></article>
}

function FitCard({ item, lang, compared, toggle }) {
  const t = copy[lang].app
  return <article className="fit-card">
    <div className="fit-head"><div><small>{item.provider}</small><h3>{item.title[lang]}</h3></div><span className={`status ${item.status}`}>{t.fit[item.status]}</span></div>
    <div className="fit-score"><strong>{item.score}%</strong><span>{lang==='ar'?'مؤشر مبدئي مفسّر':'preliminary explained indicator'}</span></div>
    <div className="why"><h4>{t.why}</h4>{item.reasons.map((r,i)=><p key={i}><Check size={15}/>{r}</p>)}</div>
    <div className="gap"><small>{item.gapType}</small><p><strong>{t.becomes}</strong> {item.becomes}</p></div>
    <div className="fit-meta"><span>{item.duration[lang]}</span><span>{item.cost[lang]}</span></div>
    <button className={compared?'compare-button selected':'compare-button'} onClick={()=>toggle(item.id)}>{compared?<Check size={16}/>:<Plus size={16}/>} {lang==='ar'?'قارن':'Compare'}</button>
  </article>
}

function Privacy({ lang, state, setState, log, onExport, onDelete }) {
  const t = copy[lang].app
  const [confirmDelete,setConfirmDelete] = useState(false)
  const toggle = (key) => {
    if (key === 'analyze' && state.approved) {
      setState(s => ({...s,courses:[],approved:false,consents:{...s.consents,analyze:false},audit:[{label:lang==='ar'?'سحب موافقة تحليل السجل ومحو أثره':'Transcript-analysis consent withdrawn and derived effects removed',ts:Date.now()},...s.audit]}))
      return
    }
    setState(s => ({...s,consents:{...s.consents,[key]:!s.consents[key]}}))
    log(lang==='ar'? `تغيير موافقة: ${t.consentItems[key]}` : `Consent changed: ${t.consentItems[key]}`)
  }
  return <div className="privacy-layout">
    <div className="panel"><div className="panel-head"><div><small>{t.consent}</small><h3>{lang==='ar'?'كل غرض له إذنه':'Each purpose has its own permission'}</h3></div></div>
      <div className="consents">{Object.keys(state.consents).map(key=><label key={key}><span><strong>{t.consentItems[key]}</strong><small>{key==='analyze'?(lang==='ar'?'ضروري فقط بعد اعتماد السجل':'Required only after transcript approval'):(lang==='ar'?'اختياري وغير مفعّل تشغيليًا في النسخة العامة':'Optional and not operational in the public pilot')}</small></span><input type="checkbox" checked={!!state.consents[key]} onChange={()=>toggle(key)}/></label>)}</div>
    </div>
    <div className="panel privacy-actions"><ShieldCheck size={30}/><h3>{lang==='ar'?'ملفك تحت سيطرتك':'Your profile stays under your control'}</h3><p>{t.privacyNote}</p><button className="button secondary" onClick={onExport}><Download size={17}/>{t.export}</button>{confirmDelete ? <div className="delete-confirm"><p>{t.deleteConfirm}</p><div><button className="button danger" onClick={onDelete}><Trash2 size={17}/>{lang==='ar'?'نعم، احذف':'Yes, delete'}</button><button className="button secondary" onClick={()=>setConfirmDelete(false)}>{t.cancel}</button></div></div> : <button className="button danger" onClick={()=>setConfirmDelete(true)}><Trash2 size={17}/>{t.delete}</button>}</div>
  </div>
}

function Audit({ lang, entries }) {
  return <div className="panel audit-list">{entries.length ? entries.map((e,i)=><div className="audit-item" key={i}><ClipboardCheck/><div><strong>{e.label}</strong><small>{timeText(e.ts,lang)}</small></div></div>) : <p>{lang==='ar'?'لا توجد أحداث بعد.':'No events yet.'}</p>}</div>
}

function Compare({ lang, items }) {
  const t = copy[lang].app
  if (!items.length) return <div className="empty-state"><SearchCheck/><h3>{lang==='ar'?'اختر حتى ثلاث دورات للمقارنة':'Choose up to three courses to compare'}</h3></div>
  return <div className="compare-table-wrap">
    <table className="compare-table">
      <thead><tr><th>{lang==='ar'?'البعد':'Dimension'}</th>{items.map(item=><th key={item.id}>{item.title[lang]}</th>)}</tr></thead>
      <tbody>
        <tr><th>{lang==='ar'?'الحكم':'Judgment'}</th>{items.map(item=><td key={item.id}><span className={`status ${item.status}`}>{t.fit[item.status]}</span></td>)}</tr>
        <tr><th>{lang==='ar'?'الملاءمة':'Fit'}</th>{items.map(item=><td key={item.id}><strong className="compare-score">{item.score}%</strong></td>)}</tr>
        <tr><th>{lang==='ar'?'الفجوة':'Gap'}</th>{items.map(item=><td key={item.id}>{item.gapType}</td>)}</tr>
        <tr><th>{lang==='ar'?'المدة':'Duration'}</th>{items.map(item=><td key={item.id}>{item.duration[lang]}</td>)}</tr>
        <tr><th>{lang==='ar'?'الكلفة':'Cost'}</th>{items.map(item=><td key={item.id}>{item.cost[lang]}</td>)}</tr>
        <tr><th>{t.becomes}</th>{items.map(item=><td key={item.id}>{item.becomes}</td>)}</tr>
      </tbody>
    </table>
  </div>
}

function KaminApp({ lang, onClose }) {
  const t = copy[lang]
  const [state,setState] = useState(getSaved)
  const [view,setView] = useState(state.approved?'dashboard':'start')
  const [draft,setDraft] = useState([])
  const [processing,setProcessing] = useState(false)
  const [progress,setProgress] = useState(0)
  const [compareIds,setCompareIds] = useState([])
  const [notice,setNotice] = useState('')
  const [reviewConsent,setReviewConsent] = useState(false)
  const [fileError,setFileError] = useState('')
  const [validation,setValidation] = useState(null)
  const fileRef = useRef(null)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const skills = useMemo(()=>state.approved?inferSkills(state.courses):[],[state])
  const recs = useMemo(()=>judgeOpportunities(skills,state.goal,lang),[skills,state.goal,lang])
  const compared = recs.filter(r=>compareIds.includes(r.id))

  useEffect(()=>sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state)),[state])
  useEffect(()=>{
    if (!notice) return undefined
    const timer = setTimeout(()=>setNotice(''), 4200)
    return ()=>clearTimeout(timer)
  },[notice])
  useEffect(()=>{
    closeButtonRef.current?.focus()
    const dialog=dialogRef.current
    const onKey=(event)=>{
      if(event.key==='Escape'){ event.preventDefault(); onClose(); return }
      if(event.key!=='Tab' || !dialog) return
      const focusable=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hasAttribute('hidden'))
      if(!focusable.length) return
      const first=focusable[0], last=focusable[focusable.length-1]
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
    }
    dialog?.addEventListener('keydown',onKey)
    return()=>dialog?.removeEventListener('keydown',onKey)
  },[onClose])
  const log = (label) => setState(s=>({...s,audit:[{label,ts:Date.now()},...s.audit].slice(0,100)}))
  const loadDemo = () => { setDraft(demoCourses); setValidation({recognized:demoCourses.length,rejected:[],usedOcr:false,mode:'demo'}); setReviewConsent(false); setFileError(''); setView('review'); log(lang==='ar'?'تحميل بيانات تجريبية منفصلة':'Separate demo data loaded') }
  const upload = async (file) => {
    if (!file) return
    setProcessing(true); setProgress(2)
    try {
      const result = await extractTranscript(file,setProgress)
      setDraft(result.courses)
      setValidation(result.validation||null)
      setReviewConsent(false)
      setFileError(result.courses.length ? '' : (lang==='ar' ? 'لم نتعرف على مقررات قابلة للاعتماد. لم يتم تحميل أي بيانات تجريبية؛ راجع ملخص التحقق أو أضف المقررات يدويًا.' : 'No approvable courses were recognized. No demo data were loaded; review the validation summary or add courses manually.'))
      setView('review')
      log(lang==='ar'? `قراءة ملف محلي: ${file.name}` : `Local file read: ${file.name}`)
      if (!result.courses.length) setDraft([])
    } catch (err) {
      console.error(err)
      const messages={
        PDF_OPEN_FAILED:lang==='ar'?'تعذر فتح ملف PDF أو أنه تالف.':'The PDF could not be opened or is corrupt.',
        UNSUPPORTED_FILE_TYPE:lang==='ar'?'نوع الملف غير مدعوم. استخدم PDF أو صورة أو TXT.':'Unsupported file type. Use PDF, image, or TXT.',
        NO_FILE:lang==='ar'?'لم يتم اختيار ملف.':'No file was selected.',
      }
      setFileError(messages[err?.message]||(lang==='ar'?'حدث خطأ أثناء المعالجة المحلية. لم تُستخدم بيانات Demo.':'Local processing failed. Demo data were not used.'))
      setDraft([])
      setValidation(null)
      setReviewConsent(false)
      setView('review')
    } finally { setProcessing(false); setProgress(0) }
  }
  const approve = () => {
    if (!reviewConsent) return
    setState(s=>({...s,courses:draft,approved:true,consents:{...s.consents,analyze:true},audit:[{label:lang==='ar'?'منح موافقة تحليل السجل واعتماده':'Transcript analysis consent granted and record approved',ts:Date.now()},...s.audit]}))
    setView('dashboard')
    setNotice(lang==='ar' ? 'تم اعتماد السجل داخل جلسة مؤقتة؛ تُمسح عند إغلاق المتصفح.' : 'Transcript approved in a temporary session that clears when the browser closes.')
  }
  const chooseGoal = goal => { setState(s=>({...s,goal})); log(lang==='ar'?'تغيير الهدف':'Goal changed') }
  const toggleCompare = id => setCompareIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):(ids.length<3?[...ids,id]:ids))
  const exportProfile = () => {
    const payload = { exportedAt:new Date().toISOString(), courses:state.courses, skills, judgments:recs, consents:state.consents, audit:state.audit }
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}))
    const a=document.createElement('a'); a.href=url; a.download='kamin-profile.json'; a.click(); URL.revokeObjectURL(url); log(lang==='ar'?'تصدير الملف':'Profile exported')
  }
  const deleteAll = () => {
    sessionStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_STORAGE_KEY); setState(blankState); setDraft([]); setValidation(null); setCompareIds([]); setReviewConsent(false); setView('start')
  }

  const nav = [
    ['dashboard',LayoutDashboard,t.app.dashboard],
    ['skills',GraduationCap,t.app.skills],
    ['courses',BookOpen,t.app.courses],
    ['compare',SearchCheck,t.app.compare],
    ['privacy',ShieldCheck,t.app.privacy],
    ['audit',ClipboardCheck,t.app.audit],
  ]

  return <div className="app-overlay" role="dialog" aria-modal="true" aria-label={t.app.title} ref={dialogRef}>
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand"><BrandMark/><div><strong>{t.name}</strong><small>{t.tagline}</small></div></div>
        <nav>{nav.map(([id,Icon,label])=><button key={id} disabled={!state.approved && !['privacy','audit'].includes(id)} className={view===id?'active':''} onClick={()=>setView(id)}><Icon size={18}/>{label}</button>)}</nav>
        <div className="sidebar-trust"><ShieldCheck/><span>{lang==='ar'?'المعالجة محلية في النسخة العامة':'Local processing in public pilot'}</span></div>
      </aside>
      <div className="app-main">
        <header className="app-topbar"><div><small>{t.app.title}</small><strong>{state.approved?(lang==='ar'?'ملف معتمد':'Approved profile'):(lang==='ar'?'نسخة إطلاق تجريبية':'Public launch pilot')}</strong></div><div><button ref={closeButtonRef} className="icon-button" onClick={onClose} aria-label={lang==='ar'?'إغلاق':'Close'}><X/></button></div></header>
        {notice&&<div className="toast" role="status" aria-live="polite"><Check size={18}/><span>{notice}</span></div>}
        <div className="app-content-wrap" role="main">
          {view==='start' && <section className="app-content">
            <div className="app-title"><small>01</small><h2>{t.app.title}</h2><p>{t.app.intro}</p></div>
            <div className="start-grid"><button className="start-card" onClick={loadDemo}><div className="start-icon"><Sparkles/></div><h3>{t.app.demo}</h3><p>{lang==='ar'?'شاهد الرحلة كاملة ببيانات غير حقيقية.':'See the full journey with synthetic data.'}</p></button><button className="start-card" onClick={()=>fileRef.current?.click()}><div className="start-icon"><UploadCloud/></div><h3>{t.app.upload}</h3><p>{t.app.uploadHelp}</p></button></div>
            <label className="sr-only" htmlFor="kamin-transcript-file">{lang==='ar'?'اختر ملف كشف الدرجات':'Choose transcript file'}</label><input id="kamin-transcript-file" className="sr-only" ref={fileRef} type="file" accept=".pdf,image/png,image/jpeg,image/webp,.txt" onChange={e=>upload(e.target.files?.[0])}/>
            {processing&&<div className="processing" role="status" aria-live="polite"><div className="processing-row"><div className="spinner"/><strong>{t.app.processing}</strong><b>{progress}%</b></div><div className="progress" aria-label={lang==='ar'?'تقدم قراءة الملف':'File reading progress'}><i style={{width:`${progress}%`}}/></div><small>{t.app.localOnly}</small></div>}
            <div className="privacy-promise"><ShieldCheck/><div><strong>{lang==='ar'?'وعد الخصوصية في النسخة العامة':'Public-pilot privacy promise'}</strong><p>{t.app.localOnly}</p></div></div>
          </section>}
          {view==='review' && <section className="app-content"><div className="app-title"><small>02</small><h2>{t.app.review}</h2><p>{lang==='ar'?'التقنية تستخرج؛ أنت تعتمد. صحح أي سطر قبل أن يصبح دليلًا.':'Technology extracts; you approve. Correct any line before it becomes evidence.'}</p></div>{fileError&&<div className="error-banner" role="alert">{fileError}</div>}<ValidationSummary lang={lang} validation={validation}/><CourseReview lang={lang} rows={draft} setRows={setDraft} onApprove={approve} consent={reviewConsent} setConsent={setReviewConsent}/></section>}
          {state.approved && view==='dashboard' && <section className="app-content">
            <div className="app-title"><small>{t.app.dashboard}</small><h2>{lang==='ar'?'هذه قدراتك كما نراها الآن':'This is how your capabilities look now'}</h2><p>{lang==='ar'?'كل مؤشر هنا مبدئي وقابل للرجوع إلى دليل في سجلك المعتمد.':'Every indicator here is preliminary and traceable to evidence in your approved record.'}</p></div>
            <div className="session-banner"><ShieldCheck size={17}/><span>{lang==='ar'?'هذه جلسة مؤقتة داخل المتصفح وتُمسح عند إغلاقه. لا تُستخدم كسجل مؤسسي أو نسخة احتياطية.':'This is a temporary browser session and clears when the browser closes. It is not an institutional record or backup.'}</span></div>
            <div className="metrics"><article><span>{lang==='ar'?'مهارات مدعومة بالدليل':'Evidence-backed skills'}</span><strong>{skills.length}</strong><small>{lang==='ar'?'من السجل المعتمد':'from approved record'}</small></article><article><span>{lang==='ar'?'أعلى مؤشر مبدئي':'Highest preliminary indicator'}</span><strong>{skills[0]?.confidence||0}%</strong><small>{skills[0]?.labels[lang]||'—'}</small></article><article><span>{lang==='ar'?'أعلى مؤشر ملاءمة مبدئي':'Top preliminary fit'}</span><strong>{recs[0]?.score||0}%</strong><small>{recs[0]?.title[lang]||'—'}</small></article></div>
            <div className="dashboard-grid"><div className="panel"><div className="panel-head"><div><small>{t.app.skills}</small><h3>{lang==='ar'?'الأدلة قبل الادعاء':'Evidence before claims'}</h3></div><button className="text-button" onClick={()=>setView('skills')}>{lang==='ar'?'كل المهارات':'All skills'}</button></div>{skills.slice(0,4).map(s=><div className="skill-row" key={s.id}><span>{s.labels[lang]}</span><div><i style={{width:`${s.confidence}%`}}/></div><b>{s.confidence}%</b></div>)}</div>
            <div className="panel"><div className="panel-head"><div><small>{t.app.goal}</small><h3>{lang==='ar'?'ما الذي تريد الوصول إليه؟':'Where do you want to go?'}</h3></div></div><div className="goal-options">{Object.entries(t.app.goals).map(([id,label])=><button key={id} className={state.goal===id?'active':''} onClick={()=>chooseGoal(id)}><Target size={16}/>{label}</button>)}</div></div></div>
            <div className="panel decision"><div className="decision-head"><div><small>{lang==='ar'?'القرار التالي':'Next decision'}</small><h3>{recs[0]?.title[lang]}</h3></div><span className={`status ${recs[0]?.status}`}>{t.app.fit[recs[0]?.status]}</span></div><div className="decision-body"><div className="decision-score"><strong>{recs[0]?.score}%</strong><small>{lang==='ar'?'ملاءمة مفسّرة':'explained fit'}</small></div><div>{recs[0]?.reasons.map((r,i)=><p key={i}><Check size={15}/>{r}</p>)}<p className="becomes"><strong>{t.app.becomes}</strong> {recs[0]?.becomes}</p></div></div><button className="button primary" onClick={()=>setView('courses')}>{lang==='ar'?'استكشف كل الدورات':'Explore all courses'}</button></div>
          </section>}
          {state.approved && view==='skills' && <section className="app-content"><div className="app-title"><small>{t.app.skills}</small><h2>{lang==='ar'?'كل مهارة مرتبطة بدليل':'Every skill is tied to evidence'}</h2><p>{lang==='ar'?'الثقة هي ثقة النظام في أن سجلك يدعم المهارة، وليست حكمًا عليك.':'Confidence is the system’s confidence in the evidence, not a judgment about you.'}</p></div><div className="skills-grid">{skills.map(s=><SkillCard key={s.id} skill={s} lang={lang}/>)}</div></section>}
          {state.approved && view==='courses' && <section className="app-content"><div className="app-title app-title-row"><div><small>{t.app.courses}</small><h2>{lang==='ar'?'لا نرتب الدورات فقط؛ نشرح القرار':'We do not just rank courses; we explain the decision'}</h2></div><select value={state.goal||''} onChange={e=>chooseGoal(e.target.value||null)} aria-label={t.app.goal}><option value="">{lang==='ar'?'اختر هدفًا أولًا':'Choose a goal first'}</option>{Object.entries(t.app.goals).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div><div className="fit-grid">{recs.map(r=><FitCard key={r.id} item={r} lang={lang} compared={compareIds.includes(r.id)} toggle={toggleCompare}/>)}</div></section>}
          {state.approved && view==='compare' && <section className="app-content"><div className="app-title"><small>{t.app.compare}</small><h2>{lang==='ar'?'نفس الأبعاد. قرار أسهل.':'Same dimensions. Easier decision.'}</h2><p>{lang==='ar'?'اختر حتى ثلاث دورات من صفحة الدورات.':'Choose up to three courses from the courses page.'}</p></div><Compare lang={lang} items={compared}/></section>}
          {view==='privacy' && <section className="app-content"><div className="app-title"><small>{t.app.privacy}</small><h2>{lang==='ar'?'أنت صاحب القرار على بياناتك':'You control your data'}</h2><p>{lang==='ar'?'كل غرض له موافقته، والسحب واضح بقدر المنح.':'Each purpose has its own consent, and withdrawal is as clear as granting it.'}</p></div><Privacy lang={lang} state={state} setState={setState} log={log} onExport={exportProfile} onDelete={deleteAll}/></section>}
          {view==='audit' && <section className="app-content"><div className="app-title"><small>{t.app.audit}</small><h2>{lang==='ar'?'كشف حساب بياناتك':'Your data statement'}</h2><p>{lang==='ar'?'كل تغيير في ملف النسخة العامة يظهر هنا.':'Every change to your public-pilot profile appears here.'}</p></div><Audit lang={lang} entries={state.audit}/></section>}
        </div>
        <nav className="bottom-nav" aria-label={lang==='ar'?'تنقل التطبيق على الجوال':'Mobile app navigation'}>{nav.map(([id,Icon,label])=><button key={id} className={view===id?'active':''} disabled={!state.approved&&!['privacy','audit'].includes(id)} onClick={()=>setView(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      </div>
    </div>
  </div>
}

class AppErrorBoundary extends Component {
  constructor(props){super(props);this.state={failed:false}}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error,info){console.error('Kamin UI error boundary',error,info)}
  render(){
    if(!this.state.failed) return this.props.children
    return <div className="app-overlay" role="alertdialog" aria-modal="true"><div className="error-boundary-card"><ShieldCheck/><h2>{this.props.lang==='ar'?'تعذر إكمال هذه الشاشة بأمان':'This screen could not complete safely'}</h2><p>{this.props.lang==='ar'?'بياناتك لم تُرسل إلى خادم. أغلق التجربة وحاول مرة أخرى أو استخدم الإدخال اليدوي.':'Your data were not sent to a server. Close the pilot and try again or use manual entry.'}</p><button className="button primary" onClick={this.props.onClose}>{this.props.lang==='ar'?'إغلاق التجربة':'Close pilot'}</button></div></div>
  }
}

export default function App() {
  const [lang,setLang] = useState(()=>new URLSearchParams(window.location.search).get('lang')||localStorage.getItem('kamin-lang')||'ar')
  const [appOpen,setAppOpen] = useState(false)
  const t = copy[lang]
  useEffect(()=>{
    const ar = lang === 'ar'
    const title = ar ? 'كامن | خزنة قدراتك' : 'Kamin | Your capability vault'
    const description = ar
      ? 'كامن يحوّل السجل الأكاديمي إلى مهارات مدعومة بأدلة وأحكام ملاءمة مفسّرة تساعد الطالب على اتخاذ قرار تعلم أوضح.'
      : 'Kamin turns academic records into evidence-backed skills and explainable learning-fit judgments for clearer student decisions.'
    const origin = window.location.origin
    const publicOrigin = ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'https://kamin-12mf.onrender.com'
      : origin
    document.documentElement.lang=lang
    document.documentElement.dir=ar?'rtl':'ltr'
    document.title=title
    setMeta('description', description)
    setMeta('og:title', title, 'property')
    setMeta('og:description', description, 'property')
    setMeta('og:locale', ar ? 'ar_SA' : 'en_US', 'property')
    setMeta('twitter:title', title)
    setMeta('twitter:description', description)
    setMeta('og:image', publicOrigin + '/og-kamin-1200x630.jpg', 'property')
    setMeta('twitter:image', publicOrigin + '/og-kamin-1200x630.jpg')
    const canonical = document.head.querySelector('link[rel="canonical"]')
    if (canonical) canonical.setAttribute('href', publicOrigin + '/?lang=' + lang)
    const ld = document.getElementById('kamin-ld')
    if (ld) ld.textContent = JSON.stringify({
      '@context':'https://schema.org',
      '@type':'SoftwareApplication',
      name: ar ? 'كامن' : 'Kamin',
      alternateName: ar ? 'Kamin' : 'كامن',
      applicationCategory:'EducationalApplication',
      operatingSystem:'Web',
      url: publicOrigin + '/',
      description,
      inLanguage: ar ? 'ar-SA' : 'en',
      offers:{'@type':'Offer',price:'0',priceCurrency:'SAR'},
      privacyPolicy: publicOrigin + '/privacy.html'
    })
    localStorage.setItem('kamin-lang',lang)
    const url=new URL(window.location.href)
    url.searchParams.set('lang',lang)
    history.replaceState(null,'',url)
  },[lang])
  useEffect(()=>{ document.body.style.overflow=appOpen?'hidden':''; return()=>{document.body.style.overflow=''} },[appOpen])
  return <>
    <Header lang={lang} setLang={setLang} onTry={()=>setAppOpen(true)}/>
    <main id="main"><Landing lang={lang} onTry={()=>setAppOpen(true)}/></main>
    <footer><div className="shell footer-row"><div><BrandMark/><span>{t.footer}</span></div><div><button onClick={()=>document.getElementById('trust')?.scrollIntoView({behavior:'smooth'})}>{t.nav.trust}</button><a href="./privacy.html">{lang==='ar'?'سياسة الخصوصية':'Privacy policy'}</a><a href="#faq">{lang==='ar'?'الأسئلة الشائعة':'FAQ'}</a><span>PDPL · DGA aligned design</span></div></div></footer>
    {appOpen&&<AppErrorBoundary lang={lang} onClose={()=>setAppOpen(false)}><KaminApp lang={lang} onClose={()=>setAppOpen(false)}/></AppErrorBoundary>}
  </>
}

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
import { inferTranscriptSsces, ssceForCourse, ssceReference } from './reference/ssce.js'
import { DECLARED_PREFERENCE_SCHEMES, emptyInsightState, setDeclaredPreference } from './insight.js'
import { PSYCHOMETRIC_INSTRUMENTS } from './psychometrics/registry.js'
import { buildMatchingProfile, matchTargets } from './matching/engine.js'
import { projectStateToPerson360 } from './ontology/projector.js'
import { clearLocalProfile, readLocalProfile, writeLocalProfile } from './utils/localProfileStore.js'
import { trustMicrocopy } from './content/trustCopy.js'
import { PILOT_ANALYTICS_ENABLED, clearPilotLocalData, submitPilotFeedback, trackPilotEvent } from './utils/pilotAnalytics.js'

const STORAGE_KEY = 'kamin-session-v3'
const LEGACY_SESSION_KEY = 'kamin-pilot-session-v2'
const LEGACY_STORAGE_KEY = 'kamin-pilot-v1'
const blankState = {
  courses: [],
  approved: false,
  goal: null,
  consents: { analyze: false, insight: false, advisor: false, research: false },
  insight: emptyInsightState(),
  audit: [],
  localPersistence: false,
}

const normalizeState = parsed => {
  if(!parsed || typeof parsed!=='object') return {...blankState,consents:{...blankState.consents},insight:emptyInsightState(),audit:[]}
  return {
    ...blankState,
    ...parsed,
    localPersistence:!!parsed.localPersistence,
    consents:{...blankState.consents,...(parsed.consents||{})},
    insight:{...emptyInsightState(),...(parsed.insight||{}),responses:{...(parsed.insight?.responses||{})}},
    audit:Array.isArray(parsed.audit)?parsed.audit.slice(0,100):[],
  }
}

const hasMeaningfulProfileState = state => !!(
  state?.approved ||
  state?.courses?.length ||
  state?.goal ||
  state?.localPersistence ||
  state?.consents?.insight ||
  Object.keys(state?.insight?.declaredPreferences||{}).length ||
  state?.audit?.length
)

const getSaved = () => {
  try {
    let raw=sessionStorage.getItem(STORAGE_KEY)
    if(!raw){
      const legacySession=sessionStorage.getItem(LEGACY_SESSION_KEY)
      const legacyLocal=localStorage.getItem(LEGACY_STORAGE_KEY)
      const legacy=legacySession||legacyLocal
      if(legacy){
        raw=legacy
        sessionStorage.setItem(STORAGE_KEY,legacy)
        sessionStorage.removeItem(LEGACY_SESSION_KEY)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
      }
    }
    const parsed=JSON.parse(raw||'null')
    return normalizeState(parsed)
  } catch {
    return blankState
  }
}

const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.ar || value?.en || ''
const evidenceStrengthText = (level,lang) => ({
  high:{ar:'مرتفعة',en:'High'},
  medium:{ar:'متوسطة',en:'Medium'},
  low:{ar:'محدودة',en:'Limited'},
}[level]?.[lang] || (lang==='ar'?'مبدئية':'Preliminary'))
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
        <button onClick={() => go('proof')}>{lang === 'ar' ? 'شاهد الدليل' : 'See proof'}</button>
        <button onClick={() => go('how')}>{t.nav.how}</button>
        <button onClick={() => go('institutions')}>{lang === 'ar' ? 'للجامعات والشركات' : 'Universities & employers'}</button>
        <a className="nav-link" href={lang === 'ar' ? '/methodology.html?lang=ar' : '/methodology.html?lang=en'}>{lang === 'ar' ? 'المنهجية' : 'Methodology'}</a>
        <button className="nav-primary" onClick={() => { onTry(); setOpen(false) }}>{t.nav.app}<Arrow size={16}/></button>
      </nav>
      <div className="header-tools">
        <button className="language-button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
          <Languages size={18}/><span lang={lang === 'ar' ? 'en' : 'ar'}>{lang === 'ar' ? 'EN' : 'العربية'}</span>
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
        <span className="eyebrow"><GraduationCap size={16}/>{t.hero.eyebrow}</span>
        <h1>{t.hero.title}</h1>
        <p>{t.hero.text}</p>
        <div className="hero-network-line" aria-label={lang === 'ar' ? 'رحلة كامن من الدليل إلى القرار' : 'Kamin journey from evidence to decision'}>
          <span>{lang === 'ar' ? 'سجل + مشاريع' : 'Record + projects'}</span><b>{lang === 'ar' ? '←' : '→'}</b>
          <span>{lang === 'ar' ? 'ملف القدرات 360°' : 'Capability Profile 360°'}</span><b>{lang === 'ar' ? '←' : '→'}</b>
          <span>{lang === 'ar' ? 'ملاءمة مفسّرة' : 'Explainable fit'}</span><b>{lang === 'ar' ? '←' : '→'}</b>
          <span>{lang === 'ar' ? 'خطوة تالية' : 'Next step'}</span>
        </div>
        <div className="hero-actions">
          <button className="button primary" onClick={onTry}>{t.hero.cta}<Arrow size={18}/></button>
          <a className="button secondary" href={lang === 'ar' ? '/sample-report.html?lang=ar' : '/sample-report.html?lang=en'} onClick={()=>trackPilotEvent('sample_report_viewed')}>{t.hero.secondary}</a>
        </div>
        <div className="privacy-chip"><ShieldCheck size={18}/><span>{t.hero.trust}</span></div>
      </div>
      <div className="hero-preview proof-preview" aria-label={lang === 'ar' ? 'معاينة تقرير قدرات كامن' : 'Kamin capability report preview'}>
        <div className="proof-window">
          <div className="proof-window-head"><span>{lang === 'ar' ? 'تقرير تجريبي · سارة' : 'Demo report · Sara'}</span><small>{lang === 'ar' ? 'بيانات وهمية' : 'Synthetic data'}</small></div>
          <div className="proof-role"><small>{lang === 'ar' ? 'الهدف' : 'Target'}</small><strong>Junior Data Analyst</strong><span className="status conditional">{lang === 'ar' ? 'ملاءمة بشروط' : 'Fits with conditions'}</span></div>
          <div className="proof-evidence">
            <div><BadgeCheck size={17}/><span><b>SQL</b><small>{lang === 'ar' ? 'قواعد بيانات · دليل أكاديمي' : 'Database course · academic evidence'}</small></span></div>
            <div><BadgeCheck size={17}/><span><b>Python</b><small>{lang === 'ar' ? 'مشروع تطبيقي' : 'Applied project'}</small></span></div>
            <div className="proof-gap"><Target size={17}/><span><b>Cloud</b><small>{lang === 'ar' ? 'فجوة: لا يوجد دليل معتمد بعد' : 'Gap: no approved evidence yet'}</small></span></div>
          </div>
          <div className="proof-next"><strong>{lang === 'ar' ? 'الخطوة التالية' : 'Next step'}</strong><span>{lang === 'ar' ? 'أضف مشروعًا صغيرًا منشورًا على السحابة ثم أعد التقييم.' : 'Add a small cloud-deployed project, then re-evaluate.'}</span></div>
        </div>
      </div>
    </div>
  </section>
}

function ValueExample({ lang }) {
  const v = copy[lang].value
  return <section id="example" className="section value-section">
    <div className="shell">
      <div className="section-title"><span>03</span><div><small className="value-kicker">{v.kicker}</small><h2>{v.title}</h2><p>{v.intro}</p></div></div>
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
  const stepIcons = [FileCheck2, Fingerprint, Target]
  const trustIcons = [Fingerprint, FileCheck2, ShieldCheck, SearchCheck]
  const personDimensions = lang === 'ar' ? [
    ['01','أدلة أكاديمية','المقررات والنتائج التي راجعتها واعتمدتها أنت.'],
    ['02','قدرات مرتبطة بمصدر','لا تظهر مهارة في الحكم دون أثر يمكن الرجوع إليه.'],
    ['03','تفضيلات وأهداف','إشارات تختارها أنت لتخصيص القرار، ولا تتحول إلى دليل أكاديمي.'],
    ['04','فجوات واضحة','ما لا نملك عليه دليلًا يبقى فجوة، لا استنتاجًا مخفيًا.'],
  ] : [
    ['01','Academic evidence','Courses and results that you reviewed and approved.'],
    ['02','Source-linked capabilities','A skill does not enter a judgment without a traceable source.'],
    ['03','Preferences and goals','Signals you choose for personalization; they do not become academic evidence.'],
    ['04','Visible gaps','What lacks evidence remains a gap, not a hidden inference.'],
  ]
  const liveNow = lang === 'ar' ? [
    ['استخراج السجل محليًا','PDF وصور، مع OCR داخل المتصفح ومراجعة قبل الاعتماد.'],
    ['مهارات مرتبطة بالأدلة','الربط المعتمد فقط يؤثر في الحكم؛ المقرر غير المربوط لا يولد مهارة.'],
    ['قرارات تعلم مفسّرة','لماذا تناسبك الدورة، وما الفجوة، وما الذي يجعلها مناسبة لاحقًا.'],
    ['مطابقة وظائف وتدريب تجريبية','تعرض آليات الملاءمة والحدود دون نسبة رقمية غير معايرة.'],
  ] : [
    ['Local transcript ingestion','PDF and images with in-browser OCR and review before approval.'],
    ['Evidence-linked skills','Only governed mappings affect judgments; unmapped courses create no skills.'],
    ['Explainable learning decisions','Why a course fits, what is missing, and what could make it suitable later.'],
    ['Pilot job & training matching','Shows fit mechanisms and limits without an uncalibrated numeric score.'],
  ]
  const notClaimed = lang === 'ar' ? [
    'لا ننشر دقة نموذج غير مقاسة بعد.',
    'لا ندّعي وجود شبكة شركات أو جامعات متعاقدة ما لم تكن موثقة.',
    'لا توجد قرارات توظيف آلية أو حجب فرص عن المستخدم.',
    'المدارس ومطابقة الأشخاص ليستا ضمن شريحة الإطلاق الأولى.',
  ] : [
    'We do not publish model-accuracy claims before measurement.',
    'We do not imply signed university or employer networks without evidence.',
    'Kamin does not make automated hiring decisions or block opportunities.',
    'Schools and people-matching are outside the first launch wedge.',
  ]
  const institutionCards = lang === 'ar' ? [
    ['الجامعات ومراكز الإرشاد المهني','Pilot لطلاب السنة الأخيرة والخريجين: ملف قدرات مملوك للطالب + فجوات برامج مجمّعة لاحقًا بعد بوابة الامتثال.','المسار الأول'],
    ['أصحاب العمل','Employer-Lite لاحقًا: فتح تقرير بموافقة المرشح، رؤية الدليل، فهم الفجوات، وإرسال feedback.','المسار الثاني'],
  ] : [
    ['Universities & career centers','Pilot for final-year students and recent graduates: student-owned profiles plus aggregate program gaps after the compliance gate.','Primary path'],
    ['Employers','Employer-Lite next: open a candidate report with consent, inspect evidence, understand gaps, and provide feedback.','Second path'],
  ]
  return <>
    <Hero lang={lang} onTry={onTry}/>

    <section className="journey-strip" aria-label={lang === 'ar' ? 'نموذج كامن' : 'Kamin model'}>
      <div className="shell journey-grid">
        {[
          [lang === 'ar' ? 'اجمع' : 'Collect', lang === 'ar' ? 'الأدلة' : 'evidence'],
          [lang === 'ar' ? 'ابنِ' : 'Build', lang === 'ar' ? 'ملف القدرات' : 'capability profile'],
          [lang === 'ar' ? 'قارن' : 'Compare', lang === 'ar' ? 'بمتطلبات الفرصة' : 'to requirements'],
          [lang === 'ar' ? 'افهم' : 'Explain', lang === 'ar' ? 'السبب والفجوة والتالي' : 'why, gap, next'],
        ].map(([verb,noun],i)=><div className="journey-node" key={verb+noun}><span>{String(i+1).padStart(2,'0')}</span><div><small>{verb}</small><strong>{noun}</strong></div></div>)}
      </div>
    </section>

    <section id="proof" className="section proof-section">
      <div className="shell">
        <div className="section-title"><span>01</span><div><small className="value-kicker">{lang === 'ar' ? 'إثبات قبل التوسع' : 'Proof before expansion'}</small><h2>{lang === 'ar' ? 'ما الذي يعمل اليوم فعلًا؟' : 'What actually works today?'}</h2><p className="section-lead">{lang === 'ar' ? 'بدل قائمة وعود واسعة، هذه حدود النسخة العامة الحالية وما نرفض الادعاء به قبل القياس.' : 'Instead of a broad promise list, this is the current public-release boundary—and what we refuse to claim before measurement.'}</p></div></div>
        <div className="proof-grid">
          <div className="proof-live"><div className="proof-label live">{lang === 'ar' ? 'Operational الآن' : 'Operational now'}</div>{liveNow.map(([title,text])=><article key={title}><Check size={18}/><div><strong>{title}</strong><p>{text}</p></div></article>)}</div>
          <div className="proof-boundary"><div className="proof-label boundary">{lang === 'ar' ? 'لا ندّعيه بعد' : 'Not claimed yet'}</div>{notClaimed.map(item=><p key={item}><X size={16}/><span>{item}</span></p>)}</div>
        </div>
        <div className="proof-actions">
          <a className="button primary" href={lang === 'ar' ? '/sample-report.html?lang=ar' : '/sample-report.html?lang=en'}>{lang === 'ar' ? 'افتح تقريرًا تجريبيًا' : 'Open a sample report'}</a>
          <a className="button secondary" href={lang === 'ar' ? '/methodology.html?lang=ar' : '/methodology.html?lang=en'}>{lang === 'ar' ? 'اقرأ المنهجية' : 'Read methodology'}</a>
          <a className="button secondary" href={lang === 'ar' ? '/trust.html?lang=ar' : '/trust.html?lang=en'}>{lang === 'ar' ? 'مركز الثقة' : 'Trust center'}</a>
        </div>
      </div>
    </section>

    <section id="person360" className="section person360-section">
      <div className="shell">
        <div className="section-title"><span>02</span><div><small className="value-kicker">{lang === 'ar' ? 'ملف القدرات 360°' : 'Capability Profile 360°'}</small><h2>{lang === 'ar' ? 'ملف تملكه أنت، وليس “تقييمًا شاملًا” تملكه المؤسسة.' : 'A profile you own—not a 360° assessment owned by an institution.'}</h2><p className="section-lead">{lang === 'ar' ? 'الاسم الداخلي للمعمارية هو Person 360، لكن تجربة المستخدم تركز على ملكيتك لملف القدرات: أدلة، قدرات، تفضيلات، أهداف وفجوات منفصلة وقابلة للمراجعة.' : 'The internal architecture uses Person 360, but the user experience centers ownership: evidence, capabilities, preferences, goals, and gaps remain distinct and reviewable.'}</p></div></div>
        <div className="person360-grid compact">{personDimensions.map(([n,title,text])=><article className="dimension-card" key={n}><span className="dimension-number">{n}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        <div className="network-note"><ShieldCheck size={19}/><div><strong>{lang === 'ar' ? 'الذكاء الاصطناعي يقترح. الدليل يبرر. وأنت تقرر.' : 'AI suggests. Evidence justifies. You decide.'}</strong><span>{lang === 'ar' ? 'في النسخة العامة، البيانات تبقى في جلسة المتصفح ولا تُستخدم لتدريب نموذج مركزي.' : 'In the public release, profile data stays in the browser session and is not used to train a central model.'}</span></div></div>
      </div>
    </section>

    <ValueExample lang={lang}/>

    <section id="how" className="section">
      <div className="shell">
        <div className="section-title"><span>04</span><div><small className="value-kicker">{lang === 'ar' ? 'أول 10 دقائق' : 'The first 10 minutes'}</small><h2>{t.how.title}</h2></div></div>
        <div className="cards-3">{t.how.steps.map(([title, text], i) => {
          const Icon = stepIcons[i]
          return <article className="info-card" key={title}><div className="icon-box"><Icon/></div><small>{String(i+1).padStart(2,'0')}</small><h3>{title}</h3><p>{text}</p></article>
        })}</div>
      </div>
    </section>

    <section id="institutions" className="section institutions-section">
      <div className="shell">
        <div className="section-title"><span>05</span><div><small className="value-kicker">{lang === 'ar' ? 'تركيز الإطلاق' : 'Launch wedge'}</small><h2>{lang === 'ar' ? 'طلاب السنة الأخيرة والخريجون أولًا. الجامعات والشركات ثانيًا.' : 'Final-year students and recent graduates first. Universities and employers second.'}</h2><p className="section-lead">{lang === 'ar' ? 'لا نستهدف المدارس أو كل فئات السوق بنفس القوة في البداية. المسار التجاري الأول هو B2B2C عبر جامعة أو برنامج واضح، ثم Employer-Lite لقياس الثقة والأثر.' : 'We are not targeting schools or every market segment equally at launch. The first commercial path is B2B2C through a focused university/program, followed by Employer-Lite to measure trust and outcomes.'}</p></div></div>
        <div className="institution-grid focused">{institutionCards.map(([title,text,status],i)=>{const Icon=[GraduationCap,SearchCheck][i];return <article className="institution-card" key={title}><div className="institution-head"><span className="institution-badge"><Icon size={20}/></span><small>{status}</small></div><h3>{title}</h3><p>{text}</p></article>})}</div>
        <div className="business-principle">
          <div><small>{lang === 'ar' ? 'نموذج العمل الأول' : 'Initial business model'}</small><strong>{lang === 'ar' ? 'الطالب يبدأ مجانًا. الجامعة تدفع مقابل الـpilot والتشغيل المؤسسي لاحقًا. الشركات تدخل عبر تجربة Employer-Lite بعد إثبات القيمة.' : 'Students start free. Universities fund pilots and later institutional deployment. Employers enter through Employer-Lite after value is proven.'}</strong></div>
          <p>{lang === 'ar' ? 'قاعدة الحياد: أي شراكة أو عمولة أو ظهور مدفوع لا يغير حكم الملاءمة. إذا أضفنا محتوى ممولًا لاحقًا فسيظهر بوضوح خارج محرك Fit.' : 'Neutrality rule: partnership, commission, or paid placement cannot change fit. Any future sponsored content must be clearly disclosed and isolated from the fit engine.'}</p>
        </div>
        <div className="national-positioning">
          <div><small>{lang === 'ar' ? 'التموضع الوطني' : 'National interoperability posture'}</small><h3>{lang === 'ar' ? 'مكمّل للبنية الوطنية للمهارات — لا منصة موازية.' : 'Complement national skills infrastructure — do not duplicate it.'}</h3></div>
          <p>{lang === 'ar'
            ? 'كامن يركز على طبقة الدليل الجامعي المملوكة للفرد: ترجمة السجل والمشاريع إلى أدلة قدرات قابلة للتفسير والنقل. مستقبلًا نصمم للتوافق مع التصنيفات الوطنية والتكامل عبر API إذا أصبح مسار رسمي متاحًا؛ لا يوجد تكامل أو اعتماد حكومي معلن اليوم.'
            : 'Kamin focuses on the individual-owned university evidence layer: translating records and projects into portable, explainable capability evidence. We design for national taxonomy alignment and future API interoperability if an official path becomes available; there is no claimed government integration or endorsement today.'}</p>
          <a href={lang==='ar'?'/interoperability.html?lang=ar':'/interoperability.html?lang=en'}>{lang==='ar'?'اقرأ قرار التموضع والتكامل':'Read the interoperability decision'}</a>
        </div>
      </div>
    </section>

    <section id="trust" className="section trust">
      <div className="shell trust-grid">
        <div className="trust-copy"><span className="eyebrow"><LockKeyhole size={16}/>Privacy by design</span><h2>{t.trustTitle}</h2><p>{t.compliance.text}</p><div className="trust-links"><a href={lang === 'ar' ? '/trust.html?lang=ar' : '/trust.html?lang=en'}>{lang === 'ar' ? 'مركز الثقة' : 'Trust center'}</a><a href={lang === 'ar' ? '/methodology.html?lang=ar' : '/methodology.html?lang=en'}>{lang === 'ar' ? 'المنهجية والحدود' : 'Methodology & limits'}</a><a href={lang === 'ar' ? '/privacy.html?lang=ar' : '/privacy.html?lang=en'}>{lang === 'ar' ? 'سياسة الخصوصية' : 'Privacy policy'}</a></div></div>
        <div className="trust-cards">{t.trustItems.map(([title,text],i) => {
          const Icon = trustIcons[i]
          return <article key={title}><Icon/><h3>{title}</h3><p>{text}</p></article>
        })}</div>
      </div>
    </section>

    <section id="faq" className="section faq-section">
      <div className="shell faq-grid">
        <div className="section-title"><span>07</span><h2>{lang === 'ar' ? 'أسئلة قبل أن تثق بالتوصية' : 'Questions before you trust a recommendation'}</h2></div>
        <div className="faq-list">
          <details><summary>{lang === 'ar' ? 'هل كامن يقرر من يوظف؟' : 'Does Kamin decide who gets hired?'}</summary><p>{lang === 'ar' ? 'لا. النسخة الحالية أداة دعم قرار للفرد. لا تتخذ قرار توظيف، ولا تمنعك من فرصة، ولا تعرض نسبة Fit غير معايرة.' : 'No. The current release is decision support for the individual. It does not make hiring decisions, block opportunities, or show an uncalibrated fit percentage.'}</p></details>
          <details><summary>{lang === 'ar' ? 'من أين تأتي المهارات؟' : 'Where do skills come from?'}</summary><p>{lang === 'ar' ? 'لا يكفي اسم المقرر وحده. الحكم يستخدم فقط روابط مقررات → مخرجات تعلم → مهارات تم تعريفها صراحةً في طبقة الربط. المقرر غير المربوط يبقى ظاهرًا لكنه لا يولد مهارة.' : 'A course title is not enough. Judgments use only explicit course → learning-outcome → skill mappings. An unmapped course remains visible but creates no skill.'}</p></details>
          <details><summary>{lang === 'ar' ? 'هل لديكم أرقام دقة منشورة؟' : 'Do you publish accuracy metrics?'}</summary><p>{lang === 'ar' ? 'ليس بعد. نعرض معايير التحقق المستهدفة في صفحة المنهجية، لكننا لا نقدم target على أنه result. أي precision/recall أو pilot metric يجب أن يأتي من اختبار موثق.' : 'Not yet. Methodology lists validation targets, but a target is never presented as a result. Precision, recall, and pilot metrics must come from documented evaluation.'}</p></details>
          <details><summary>{lang === 'ar' ? 'أين تُحفظ بيانات النسخة العامة؟' : 'Where is public-release data stored?'}</summary><p>{lang === 'ar' ? 'محليًا داخل متصفحك. يمكنك اختيار حفظ الملف على هذا الجهاز عبر IndexedDB بموافقة صريحة، أو إبقاءه مؤقتًا للجلسة فقط. لا يوجد تخزين مركزي لملفك في النسخة العامة.' : 'Locally in your browser. With explicit consent you can keep the profile on this device in IndexedDB, or leave it session-only. This public release has no central profile storage.'}</p></details>
        </div>
      </div>
    </section>

    <section className="final-cta"><div className="shell final-cta-row"><div><small>{t.name}</small><h2>{lang === 'ar' ? 'من شهادة يصعب شرحها إلى ملف قدرات يمكن الدفاع عنه.' : 'From a hard-to-explain degree to a defensible capability profile.'}</h2><p>{lang === 'ar' ? 'ابدأ ببيانات وهمية، راجع كل دليل، وشاهد كيف يتحول إلى حكم مفسّر قبل رفع أي ملف حقيقي.' : 'Start with synthetic data, inspect every evidence link, and see how it becomes an explainable judgment before uploading a real file.'}</p></div><button className="button light" onClick={onTry}>{t.hero.cta}{lang === 'ar' ? <ArrowLeft/> : <ArrowRight/>}</button></div></section>
  </>
}

function ValidationSummary({lang,validation}) {
  if(!validation) return null
  const rejected=validation.rejected||[]
  const ssceText=validation.ssceCandidates?.[0]||null
  const ssceLevel=validation.ssceLevelCandidates?.[0]||null
  return <div className="validation-summary" role="status" aria-live="polite">
    <div><strong>{lang==='ar'?'ملخص التحقق':'Validation summary'}</strong><span>{lang==='ar'? `${validation.recognized||0} مقرر تم التعرف عليه` : `${validation.recognized||0} courses recognized`}</span></div>
    <div className="validation-badges">
      <span>{validation.usedOcr?(lang==='ar'?'OCR محلي':'Local OCR'):(lang==='ar'?'نص رقمي':'Digital text')}</span>
      <span>{rejected.length ? (lang==='ar'? `${rejected.length} سطر يحتاج مراجعة` : `${rejected.length} rows need review`) : (lang==='ar'?'لا توجد أسطر مشتبهة':'No suspicious rows')}</span>
      {Number.isFinite(validation.extractionCoverage)&&<span>{lang==='ar'? `تغطية الاستخراج: ${Math.round(validation.extractionCoverage*100)}%` : `Extraction coverage: ${Math.round(validation.extractionCoverage*100)}%`}</span>}
    </div>
    {(ssceText||ssceLevel)&&<div className="sasced-candidate">
      <div><strong>{lang==='ar'?'سياق أكاديمي مرشح — SASCED-20':'Academic context candidate — SASCED-20'}</strong>
        <span>{[
          ssceLevel ? (lang==='ar'? `المستوى ${ssceLevel.code}: ${ssceLevel.labels.ar}` : `Level ${ssceLevel.code}: ${ssceLevel.labels.en}`) : null,
          ssceText ? `${ssceText.code} · ${ssceText.labels[lang]}` : null
        ].filter(Boolean).join(' · ')}</span>
      </div>
      <small>{lang==='ar'?'اقتراح من النص فقط؛ لا يصبح تصنيفًا معتمدًا ولا يؤثر في الحكم حتى يؤكده الطالب أو الجهة الأكاديمية.':'Text-derived candidate only; it is not an approved classification and does not affect judgment until confirmed by the student or academic authority.'}</small>
    </div>}
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
    <div className="mapping-coverage" role="status"><strong>{rows.filter(row=>isMappedCourse(row.code)).length}/{rows.length||0}</strong><span>{lang==='ar'?'مقررات لها ربط قدرات محكوم حاليًا':'courses currently have governed capability mappings'}</span><a href={lang==='ar'?'/mapping.html?lang=ar':'/mapping.html?lang=en'} target="_blank" rel="noreferrer">{lang==='ar'?'منهجية الربط':'Mapping methodology'}</a></div>
    {formOpen && <div className="manual-row"><input aria-label={t.courseCode} placeholder="CPIT-251" value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/><input aria-label={t.courseName} placeholder={t.courseName} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input aria-label={t.grade} placeholder="A / B+" value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}/><button onClick={add}>{t.save}</button></div>}
    <div className="table-scroll"><table><thead><tr><th>{t.courseCode}</th><th>{t.courseName}</th><th>{t.grade}</th><th>{lang==='ar'?'حالة الربط':'Mapping'}</th><th>{lang==='ar'?'سياق البرنامج الوطني':'National programme context'}</th><th><span className="sr-only">remove</span></th></tr></thead><tbody>
      {rows.map((r,i)=>{const national=ssceForCourse(r);return <tr key={i}><td><input value={r.code} aria-label={`${t.courseCode} ${i+1}`} onChange={e=>update(i,'code',e.target.value)}/></td><td><input value={localized(r.name,lang)} aria-label={`${t.courseName} ${i+1}`} onChange={e=>update(i,'name',e.target.value)}/></td><td><input value={r.grade} aria-label={`${t.grade} ${i+1}`} onChange={e=>update(i,'grade',e.target.value)}/></td><td><span className={isMappedCourse(r.code)?'mapping-badge mapped':'mapping-badge unmapped'}>{isMappedCourse(r.code)?(lang==='ar'?'ربط مهارة معتمد حاليًا':'Current governed skill mapping'):(lang==='ar'?'غير مربوط بمهارة بعد':'Not skill-mapped yet')}</span></td><td>{national?<span className="ssce-inline"><b>{national.code}</b><small>{national.labels[lang]}</small></span>:<span className="ssce-none">{lang==='ar'?'غير مستدل من رمز المقرر':'Not inferred from course namespace'}</span>}</td><td><button className="icon-danger" onClick={()=>setRows(rows.filter((_,idx)=>idx!==i))} aria-label={lang==='ar'?`حذف ${r.code}`:`Delete ${r.code}`}><Trash2 size={16}/></button></td></tr>})}
    </tbody></table></div>
    {rows.some(r=>!isMappedCourse(r.code))&&<div className="mapping-note"><SearchCheck size={17}/><span>{lang==='ar'?'المقرر غير المربوط يبقى في سجلك لكنه لا ينتج مهارة أو يؤثر في الحكم حتى يعتمد القسم ربطه بمخرج تعلم ومهارة.':'An unmapped course stays in your record but creates no skill and affects no judgment until the department approves a learning-outcome-to-skill mapping.'}</span></div>}
    <div className="approval approval-consent"><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{lang === 'ar' ? 'أوافق صراحةً على تحليل هذا السجل لبناء ملف مهاراتي بعد مراجعتي له.' : 'I explicitly consent to analyzing this record to build my skills profile after reviewing it.'}</span></label><button className="button primary" disabled={!rows.length || !consent} onClick={onApprove}><Check size={17}/>{t.approve}</button></div>
  </div>
}

function EducationClassificationCard({lang,classification}) {
  const primary=classification?.primary
  if(!primary) return null
  const label=primary.labels[lang]
  const detailed=primary.detailed?.labels?.[lang]
  return <div className="panel ssce-card">
    <div className="panel-head"><div><small>{lang==='ar'?'مرجع وطني للتخصص':'National education reference'}</small><h3>{ssceReference.name[lang]}</h3></div><span className="ssce-code">{primary.code}</span></div>
    <div className="ssce-hierarchy">
      <span><b>06</b>{primary.broad.labels[lang]}</span>
      <span><b>061</b>{primary.narrow.labels[lang]}</span>
      {primary.detailed&&<span><b>{primary.detailed.code}</b>{detailed}</span>}
      <span className="current"><b>{primary.code}</b>{label}</span>
    </div>
    <p>{lang==='ar'
      ? `سياق أكاديمي مستدل من namespace مقررات KAU-FCIT: ${primary.count} من ${classification.totalCourses} مقررات. لا ينتج هذا التصنيف مهارة بحد ذاته.`
      : `Academic context inferred from the KAU-FCIT course namespace: ${primary.count} of ${classification.totalCourses} courses. This classification does not create skill evidence by itself.`}</p>
    {classification.isMixed&&<p className="ssce-warning">{lang==='ar'?'السجل يحتوي أكثر من سياق تخصصي؛ اعتمد التصنيف المؤسسي قبل الاستخدام الرسمي.':'The record contains more than one programme context; confirm the institutional classification before formal use.'}</p>}
    <div className="ssce-links"><a href={ssceReference.sourceUrl} target="_blank" rel="noreferrer">{lang==='ar'?'دليل التصنيف الوطني':'National classification guide'}</a><a href={primary.mappingSourceUrl} target="_blank" rel="noreferrer">{lang==='ar'?'مصدر ربط رمز البرنامج':'Programme-code mapping source'}</a></div>
  </div>
}

function SkillCard({ skill, lang }) {
  const t = copy[lang].app
  const strength=evidenceStrengthText(skill.confidenceLabel,lang)
  const applied=skill.evidence?.some(e=>e.evidenceType==='applied')
  return <article className="skill-card">
    <div className="skill-top"><div><small>{lang==='ar'?'قوة الدليل — مبدئية':'Evidence strength — preliminary'}</small><h3>{skill.labels[lang]}</h3></div><strong>{strength}</strong></div>
    <div className="evidence-level-row"><span>{lang==='ar'?'مستوى الإثبات':'Evidence level'}</span><b>{lang==='ar'?'ربط محكوم':'Governed mapping'}</b>{applied&&<em>{lang==='ar'?'يتضمن دليلًا تطبيقيًا':'includes applied evidence'}</em>}</div>
    <div className="meter categorical" aria-label={`${lang==='ar'?'قوة الدليل':'Evidence strength'}: ${strength}`}><i className={skill.confidenceLabel||'low'}/></div>
    <div className="evidence"><small>{t.evidence}</small>{skill.evidence.map((e,i)=><p key={i}><BookOpen size={15}/><span>{e.code} · {localized(e.name,lang)}</span><b>{e.grade}</b></p>)}</div>
  </article>
}

function FitCard({ item, lang, compared, toggle }) {
  const t = copy[lang].app
  return <article className="fit-card">
    <div className="fit-head"><div><small>{item.provider}</small><h3>{item.title[lang]}</h3></div><span className={`status ${item.status}`}>{t.fit[item.status]}</span></div>
    <div className="fit-score"><strong>{lang==='ar'?'ترتيب مبدئي':'Preliminary ranking'}</strong><span>{lang==='ar'?'النسبة مخفية حتى المعايرة البحثية':'percentage hidden until research calibration'}</span></div>
    <div className="why"><h4>{t.why}</h4>{item.reasons.map((r,i)=><p key={i}><Check size={15}/>{r}</p>)}</div>
    <div className="gap"><small>{item.gapType}</small><p><strong>{t.becomes}</strong> {item.becomes}</p></div>
    <div className="fit-meta"><span>{item.duration[lang]}</span><span>{item.cost[lang]}</span></div>
    <button className={compared?'compare-button selected':'compare-button'} onClick={()=>toggle(item.id)}>{compared?<Check size={16}/>:<Plus size={16}/>} {lang==='ar'?'قارن':'Compare'}</button>
  </article>
}

function StudentInsight({ lang, state, setState, log }) {
  const [agree,setAgree]=useState(false)
  const insight=state.insight||emptyInsightState()
  const grant=()=>{
    if(!agree) return
    setState(s=>({...s,consents:{...s.consents,insight:true},insight:{...emptyInsightState(),...(s.insight||{})},audit:[{label:lang==='ar'?'منح موافقة بصمة الطالب 360':'Student 360 consent granted',ts:Date.now()},...s.audit]}))
    log(lang==='ar'?'بدء ملف Person 360':'Person 360 profile started')
  }
  const updatePreference=(schemeId,optionId)=>{
    setState(s=>({...s,insight:setDeclaredPreference(s.insight||emptyInsightState(),schemeId,optionId)}))
    log(lang==='ar'?'تحديث تفضيل منظم':'Structured preference updated')
  }
  if(!state.consents.insight){
    return <div className="insight-intro">
      <div className="app-title"><small>{lang==='ar'?'Person 360':'Person 360'}</small><h2>{lang==='ar'?'بصمتك قبل التوصية':'Your profile before recommendation'}</h2><p>{lang==='ar'?'نبني صورة منظمة ومتعددة الأبعاد عنك أولًا. لا يوجد تشخيص نفسي، ولا تأثير على قرارات الدورات أو الوظائف قبل التحقق العلمي من كل طبقة.':'We first build a structured, multi-dimensional picture of you. There is no psychological diagnosis and no impact on course or job decisions before each layer is scientifically validated.'}</p></div>
      <div className="insight-privacy-grid">
        <article><ShieldCheck/><strong>{lang==='ar'?'موافقة منفصلة':'Separate consent'}</strong><span>{lang==='ar'?'يمكنك بناء السجل الأكاديمي دون هذه الطبقة، أو سحب موافقتها وحدها لاحقًا.':'You can use the academic profile without this layer, or withdraw only this consent later.'}</span></article>
        <article><SearchCheck/><strong>{lang==='ar'?'مدخلات منظمة':'Structured inputs'}</strong><span>{lang==='ar'?'لا يعتمد محرك القواعد على free text؛ نستخدم vocabularies ومقاييس معرّفة بإصداراتها.':'The rule engine does not rely on free text; inputs use versioned vocabularies and instruments.'}</span></article>
        <article><Fingerprint/><strong>{lang==='ar'?'مصدر كل إشارة محفوظ':'Every signal has provenance'}</strong><span>{lang==='ar'?'الأداة والإصدار والوقت والموافقة والمصدر تبقى مرتبطة بالنتيجة.':'Instrument, version, timestamp, consent and source stay attached to each result.'}</span></article>
      </div>
      <label className="insight-consent"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>{lang==='ar'?'أوافق على بناء ملف Person 360 وحفظ هذه المدخلات محليًا في المتصفح وفق اختياري لحفظ الملف على هذا الجهاز.':'I consent to building my Person 360 profile and storing these inputs locally in the browser according to my device-persistence choice.'}</span></label>
      <button className="button primary" disabled={!agree} onClick={grant}>{lang==='ar'?'ابدأ بصمتي':'Start my profile'}</button>
    </div>
  }
  return <div className="student-insight">
    <div className="app-title"><small>Person 360</small><h2>{lang==='ar'?'بصمتك المنظمة':'Your structured profile'}</h2><p>{lang==='ar'?'هذه التفضيلات مصرح بها منك، وتدخل الآن فقط كإشارات تفضيل منخفضة المخاطر في المطابقة. المقاييس السيكومترية المعيارية تبقى مستقلة حتى تكتمل تهيئتها والتحقق منها.':'These preferences are self-declared and now act only as low-risk preference signals in matching. Standardized psychometric instruments remain separate until implementation and validation are complete.'}</p></div>
    <div className="panel"><div className="panel-head"><div><small>{lang==='ar'?'تفضيلات مصرح بها':'Declared preferences'}</small><h3>{lang==='ar'?'اختيارات مضبوطة بدل النص الحر':'Controlled choices instead of free text'}</h3></div></div>
      <div className="insight-select-grid">{Object.entries(DECLARED_PREFERENCE_SCHEMES).map(([schemeId,scheme])=><label key={schemeId}><span>{scheme.label[lang]}</span><select value={insight.declaredPreferences?.[schemeId]||''} onChange={e=>e.target.value&&updatePreference(schemeId,e.target.value)}><option value="">{lang==='ar'?'اختر…':'Choose…'}</option>{scheme.options.map(option=><option key={option.id} value={option.id}>{option.label[lang]}</option>)}</select></label>)}</div>
    </div>
    <div className="app-title compact"><small>{lang==='ar'?'مسار بحثي منفصل':'Separate research track'}</small><h2>{lang==='ar'?'أدوات مرشحة للمعايرة السعودية — لا تؤثر على الملاءمة':'Candidate instruments for Saudi validation — no Fit effect'}</h2></div>
    <div className="instrument-grid">{Object.values(PSYCHOMETRIC_INSTRUMENTS).map(inst=><article className="panel instrument-card" key={inst.id}><div><small>{inst.sourceSystem}</small><h3>{inst.name[lang]}</h3></div><p>{inst.construct}</p><span className="instrument-status">{inst.status}</span><small>{inst.notes[lang]}</small></article>)}</div>
    <div className="insight-boundary"><ShieldCheck/><span>{lang==='ar'?'في هذه النسخة: التفضيلات المصرح بها تدخل فقط كإشارات تفضيل. درجات IPIP/RIASEC لا تدخل الحكم إطلاقًا قبل دراسة سعودية موثقة للثبات والبنية والملاءمة الثقافية.':'In this version, self-declared preferences act only as preference signals. IPIP/RIASEC instrument scores do not enter judgments at all before documented Saudi reliability, structure, and cultural validation.'}</span></div>
  </div>
}

function KnowledgeMatchContext({ item, lang }) {
  const knowledge=item.knowledgeInsights
  if(!knowledge) return null
  const external=knowledge.externalOccupations||[]
  const activities=knowledge.workActivities||[]
  const gaps=knowledge.developmentGaps||[]
  const bridges=knowledge.bridges||[]
  if(!external.length&&!activities.length&&!gaps.length&&!bridges.length) return null
  return <div className="knowledge-context">
    <div className="knowledge-context-head">
      <div><Sparkles size={16}/><span><strong>{lang==='ar'?'شبكة الفرصة':'Opportunity knowledge graph'}</strong><small>{item.graphTrace?.knowledgeGraphVersion||'kamin-ict-kg-v1'}</small></span></div>
      <div className="knowledge-source-chips">{external.map(ref=><a key={ref.id} href={ref.sourceUrl||'#'} target="_blank" rel="noreferrer" title={ref.reviewStatus||''}>{ref.conceptScheme} {ref.notation}</a>)}</div>
    </div>
    {activities.length>0&&<div className="knowledge-activity"><SearchCheck size={15}/><span><strong>{lang==='ar'?'نشاط مهني مرجعي':'Reference work activity'}</strong>{activities.slice(0,2).map(activity=><small key={activity.id}>{activity.label}</small>)}</span></div>}
    {gaps.length>0&&<div className="knowledge-development">
      <strong>{lang==='ar'?'إشارات تطويرية — لا تغيّر حكم Fit':'Development signals — do not change Fit'}</strong>
      <div>{gaps.slice(0,4).map(gap=><span key={gap.capabilityId}>{gap.label}</span>)}</div>
      <small>{lang==='ar'?'مأخوذة من سياق O*NET السوقي الحالي؛ نستخدمها لتوجيه التعلم فقط، لا كبوابة توظيف.':'Current O*NET market context; used only to guide development, never as a hiring gate.'}</small>
    </div>}
    {bridges.length>0&&<div className="knowledge-bridges">
      <strong>{lang==='ar'?'الجسر التالي المقترح':'Suggested next bridge'}</strong>
      {bridges.slice(0,3).map(bridge=><div key={bridge.id}><BookOpen size={15}/><span><b>{bridge.label}</b><small>{bridge.develops.map(x=>x.label).join(' · ')}</small></span><em>{bridge.reasons?.includes('required-gap')?(lang==='ar'?'يسد فجوة أساسية':'closes a required gap'):(lang==='ar'?'يقوي ملفك':'strengthens the profile')}</em></div>)}
    </div>}
  </div>
}

function MatchExplorer({ lang, profile, matches }) {
  const labels={
    fits:{ar:'تناسبك',en:'Fits'},
    conditional:{ar:'تناسبك بشروط',en:'Fits with conditions'},
    exploratory:{ar:'استكشافي',en:'Exploratory'},
    'not-yet':{ar:'ليس الآن',en:'Not yet'},
  }
  const groups=['job','training']
  return <div className="match-explorer">
    <div className="app-title"><small>{lang==='ar'?'Person 360 → Opportunity':'Person 360 → Opportunity'}</small><h2>{lang==='ar'?'فرصك المفسّرة':'Your explained matches'}</h2><p>{lang==='ar'?'المحرك يقرأ Person 360 كرسم دلالي: يتتبع الدليل إلى القدرة ثم إلى متطلب الفرصة، ويعرض المسار والفجوة دون نسبة ملاءمة غير معايرة.':'The engine reads Person 360 as a semantic graph: it traces evidence to capability and then to opportunity requirements, exposing the path and the gap without an uncalibrated fit percentage.'}</p></div>
    {!profile.goal&&<div className="mapping-note"><Target size={17}/><span>{lang==='ar'?'اختر هدفًا من لوحة القدرات لتحويل النتائج من استكشاف عام إلى توصية موجهة.':'Choose a goal on the dashboard to move from broad exploration to goal-directed matching.'}</span></div>}
    {groups.map(type=>{
      const items=matches.filter(item=>item.type===type)
      return <section className="match-group" key={type}><div className="panel-head"><div><small>{type==='job'?(lang==='ar'?'الوظائف والمسارات':'Jobs & careers'):(lang==='ar'?'التدريب والتطبيق':'Training & applied learning')}</small><h3>{lang==='ar'?'مطابقة على أكثر من بُعد':'Multi-dimensional matching'}</h3></div></div>
        <div className="opportunity-grid">{items.map(item=><article className="panel match-card" key={item.id}>
          <div className="decision-head"><div><small>{item.subtitle[lang]}</small><h3>{item.title[lang]}</h3></div><span className={`status ${item.judgment==='fits'?'yes':item.judgment==='conditional'?'conditional':'no'}`}>{labels[item.judgment][lang]}</span></div>
          <p className="match-outcome">{item.outcome[lang]}</p>
          <div className="mechanism-block"><strong>{lang==='ar'?'يدعم القرار':'Supporting mechanisms'}</strong>{item.supportingMechanisms.map((m,i)=><p key={i}><Check size={15}/>{m}</p>)}</div>
          {item.semanticPaths?.some(path=>path.kind==='capability-match')&&<div className="semantic-path-block"><strong>{lang==='ar'?'مسار الدليل في الشبكة':'Evidence paths in the graph'}</strong>{item.semanticPaths.filter(path=>path.kind==='capability-match').map((path,i)=><div className="semantic-path" key={path.claimId||i}><span>{path.courseCode||'Evidence'}</span><b>→</b><span>{localized(path.capabilityLabel,lang)||path.capabilityKey}</span><b>→</b><span>{item.title[lang]}</span></div>)}</div>}
          <KnowledgeMatchContext item={item} lang={lang}/>
          {item.limitingMechanisms.length>0&&<div className="mechanism-block limits"><strong>{lang==='ar'?'فجوات أو حدود':'Gaps / limits'}</strong>{item.limitingMechanisms.map((m,i)=><p key={i}><span aria-hidden="true">△</span>{m}</p>)}</div>}
          <footer className="match-meta"><span>{item.ruleVersion}</span><span>{item.graphTrace?(item.graphTrace.evidencePathCount+'/'+item.graphTrace.requiredCapabilities+' '+(lang==='ar'?'مسارات دليل · غير معاير رقميًا':'evidence paths · not numerically calibrated')):(lang==='ar'?'غير معاير رقميًا':'not numerically calibrated')}</span></footer>
        </article>)}</div>
      </section>
    })}
  </div>
}

function PilotFeedback({lang}) {
  const [text,setText]=useState('')
  const [consent,setConsent]=useState(false)
  const [status,setStatus]=useState('')
  const [busy,setBusy]=useState(false)
  if(!PILOT_ANALYTICS_ENABLED) return null
  const submit=async()=>{
    setBusy(true); setStatus('')
    try{
      const result=await submitPilotFeedback({text,consent})
      trackPilotEvent('feedback_submitted')
      setStatus(result.submitted
        ? (lang==='ar'?'شكرًا — أُرسل رأيك بموافقتك.':'Thank you — your feedback was submitted with your consent.')
        : (lang==='ar'?'تم حفظ رأيك محليًا لهذه النسخة التجريبية؛ لم يُرسل إلى خادم.':'Your feedback was saved locally for this pilot build; it was not sent to a server.'))
      setText(''); setConsent(false)
    }catch(error){
      setStatus(error?.message==='FEEDBACK_CONSENT_REQUIRED'
        ? (lang==='ar'?'فعّل موافقة الاقتباس/التغذية الراجعة أولًا.':'Please give explicit feedback/testimonial consent first.')
        : (lang==='ar'?'اكتب ملاحظة قصيرة قبل الإرسال.':'Write a short note before submitting.'))
    }finally{setBusy(false)}
  }
  return <div className="panel feedback-panel">
    <div className="panel-head"><div><small>{lang==='ar'?'Pilot اختياري':'Optional pilot'}</small><h3>{lang==='ar'?'ساعدنا في اختبار كامن':'Help us validate Kamin'}</h3></div></div>
    <p>{lang==='ar'?'اكتب تجربتك بعد اكتمال أول ملف. لا تضع أرقامًا جامعية أو محتوى من كشف الدرجات.':'Share your experience after completing your first profile. Do not include student IDs or transcript content.'}</p>
    <textarea value={text} onChange={e=>setText(e.target.value)} maxLength={1200} placeholder={lang==='ar'?'ما الذي كان واضحًا؟ وما الذي أربكك؟':'What was clear? What was confusing?'}/>
    <label className="feedback-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{lang==='ar'?'أوافق صراحةً على جمع هذه الملاحظة واستخدامها كتغذية راجعة/اقتباس تجريبي. هذه الموافقة منفصلة عن استخدام كامن.':'I explicitly consent to collecting this note as pilot feedback/testimonial. This consent is separate from using Kamin.'}</span></label>
    <button className="button primary" disabled={busy||!text.trim()||!consent} onClick={submit}>{lang==='ar'?'إرسال الملاحظة':'Submit feedback'}</button>
    {status&&<div className="portable-status" role="status">{status}</div>}
  </div>
}

function WhatChanged({change,lang}){
  if(!change) return null
  const title={
    upload:{ar:'ما الذي تغيّر بعد الإيداع؟',en:'What changed after deposit?'},
    approve:{ar:'ما الذي تغيّر بعد الاعتماد؟',en:'What changed after approval?'},
    'withdraw-analyze':{ar:'ما الذي تغيّر بعد سحب موافقة السجل؟',en:'What changed after transcript-consent withdrawal?'},
    'withdraw-insight':{ar:'ما الذي تغيّر بعد سحب موافقة البصمة؟',en:'What changed after profile-consent withdrawal?'},
  }[change.type]||{ar:'ما الذي تغيّر؟',en:'What changed?'}
  const items=[]
  if(change.type==='upload'){
    items.push(lang==='ar'? `${change.recognized} مقرر تم التعرف عليه؛ ${change.mapped} منها لها ربط قدرات محكوم حاليًا.` : `${change.recognized} courses were recognized; ${change.mapped} currently have governed capability mappings.`)
    if(change.rejected) items.push(lang==='ar'? `${change.rejected} سطر بقي للمراجعة ولم يدخل الحكم.` : `${change.rejected} row(s) remain for review and do not enter judgment.`)
  }
  if(change.type==='approve'){
    items.push(lang==='ar'? `أصبح ${change.courses} مقررًا جزءًا من سجل الأدلة المعتمد.` : `${change.courses} course(s) are now part of the approved evidence record.`)
    items.push(lang==='ar'? `أُنشئت ${change.skills} قدرة مدعومة بالدليل من الروابط المحكومة فقط.` : `${change.skills} evidence-backed capability/capabilities were created from governed mappings only.`)
  }
  if(change.type==='withdraw-analyze'){
    items.push(lang==='ar'? `أزيل ${change.courses} مقررًا و${change.skills} قدرة مشتقة من السجل من الحساب الحالي.` : `${change.courses} course(s) and ${change.skills} derived capability/capabilities were removed from the current calculation.`)
    items.push(lang==='ar'?'أحكام الملاءمة التي تعتمد على هذه الأدلة أُعيد حسابها فورًا.':'Judgments that depended on that evidence were immediately recomputed.')
  }
  if(change.type==='withdraw-insight'){
    items.push(lang==='ar'? `أزيلت ${change.preferences} تفضيلات مصرح بها من طبقة Person 360.` : `${change.preferences} declared preference(s) were removed from Person 360.`)
    items.push(lang==='ar'?'الأدلة الأكاديمية بقيت كما هي؛ الذي تغير هو سياق التخصيص فقط.':'Academic evidence remains unchanged; only personalization context changed.')
  }
  return <div className="what-changed" role="status" aria-live="polite"><div><Sparkles size={18}/><strong>{title[lang]}</strong></div>{items.map((item,i)=><p key={i}><Check size={15}/>{item}</p>)}</div>
}

function Privacy({ lang, state, setState, log, onExport, onImport, onDelete, onPersistenceChange, onChangeSummary }) {
  const t = copy[lang].app
  const [confirmDelete,setConfirmDelete] = useState(false)
  const [backupPassphrase,setBackupPassphrase] = useState('')
  const [backupConfirm,setBackupConfirm] = useState('')
  const [backupStatus,setBackupStatus] = useState('')
  const [backupBusy,setBackupBusy] = useState(false)
  const backupFileRef = useRef(null)
  const preferenceCount=Object.keys(state.insight?.declaredPreferences||{}).length

  const toggle = (key) => {
    if (key === 'analyze' && state.approved) {
      const coursesRemoved=state.courses?.length||0
      const skillsRemoved=inferSkills(state.courses||[]).length
      onChangeSummary?.({type:'withdraw-analyze',courses:coursesRemoved,skills:skillsRemoved,ts:Date.now()})
      setState(s => ({...s,courses:[],approved:false,consents:{...s.consents,analyze:false},audit:[{label:lang==='ar'?'سحب موافقة تحليل السجل ومحو أثره':'Transcript-analysis consent withdrawn and derived effects removed',ts:Date.now()},...s.audit]}))
      return
    }
    if (key === 'insight' && state.consents.insight) {
      const preferenceCountBefore=Object.keys(state.insight?.declaredPreferences||{}).length
      onChangeSummary?.({type:'withdraw-insight',preferences:preferenceCountBefore,ts:Date.now()})
      setState(s => ({...s,insight:emptyInsightState(),consents:{...s.consents,insight:false},audit:[{label:lang==='ar'?'سحب موافقة ملف القدرات 360° ومحو بياناتها':'Capability Profile 360° consent withdrawn and its data removed',ts:Date.now()},...s.audit]}))
      return
    }
    setState(s => ({...s,consents:{...s.consents,[key]:!s.consents[key]}}))
    log(lang==='ar'? `تغيير موافقة: ${t.consentItems[key]}` : `Consent changed: ${t.consentItems[key]}`)
  }

  const messageFor = error => ({
    PASSPHRASE_TOO_SHORT:lang==='ar'?'استخدم عبارة مرور من 12 حرفًا على الأقل.':'Use a passphrase of at least 12 characters.',
    BACKUP_DECRYPT_FAILED:lang==='ar'?'تعذر فتح النسخة: عبارة المرور خاطئة أو الملف عُدّل/تلف.':'Could not open the backup: wrong passphrase or the file was modified/corrupted.',
    UNSUPPORTED_ENCRYPTED_PROFILE:lang==='ar'?'صيغة النسخة غير مدعومة.':'Unsupported backup format.',
    UNSUPPORTED_PORTABLE_PROFILE:lang==='ar'?'إصدار ملف كامن غير مدعوم.':'Unsupported Kamin profile version.',
    BACKUP_TOO_LARGE:lang==='ar'?'ملف النسخة أكبر من الحد المسموح.':'The backup file is larger than allowed.',
    INVALID_BACKUP_FILE:lang==='ar'?'الملف ليس نسخة كامن مشفّرة صالحة.':'This is not a valid encrypted Kamin backup.',
  }[error?.message] || (lang==='ar'?'تعذر إكمال العملية.':'The operation could not be completed.'))

  const exportBackup = async () => {
    if (backupPassphrase.length < 12) { setBackupStatus(messageFor(new Error('PASSPHRASE_TOO_SHORT'))); return }
    if (backupPassphrase !== backupConfirm) { setBackupStatus(lang==='ar'?'عبارتا المرور غير متطابقتين.':'Passphrases do not match.'); return }
    setBackupBusy(true); setBackupStatus('')
    try {
      await onExport(backupPassphrase)
      setBackupStatus(lang==='ar'?'تم إنشاء نسخة مشفّرة محلية. احفظها مع عبارة المرور في مكان آمن.':'Encrypted local backup created. Keep it and the passphrase in a safe place.')
      setBackupPassphrase(''); setBackupConfirm('')
    } catch (error) { setBackupStatus(messageFor(error)) }
    finally { setBackupBusy(false) }
  }

  const importBackup = async file => {
    if (!file) return
    if (backupPassphrase.length < 12) { setBackupStatus(messageFor(new Error('PASSPHRASE_TOO_SHORT'))); return }
    setBackupBusy(true); setBackupStatus('')
    try {
      await onImport(file,backupPassphrase)
      setBackupStatus(lang==='ar'?'تمت استعادة الملف وإعادة حساب النتائج من الأدلة المحفوظة.':'Profile restored and derived results were recomputed from the saved evidence.')
      setBackupPassphrase(''); setBackupConfirm('')
    } catch (error) { setBackupStatus(messageFor(error)) }
    finally { setBackupBusy(false); if(backupFileRef.current) backupFileRef.current.value='' }
  }

  return <div className="privacy-layout">
    <div className="panel ownership-panel">
      <div className="panel-head"><div><small>{lang==='ar'?'ملكية البيانات':'Data ownership'}</small><h3>{lang==='ar'?'ما المخزن عنك الآن؟':'What is stored about you now?'}</h3></div><span className={state.localPersistence?'status yes':'status conditional'}>{state.localPersistence?(lang==='ar'?'محفوظ على هذا الجهاز':'Saved on this device'):(lang==='ar'?'جلسة مؤقتة':'Session only')}</span></div>
      <div className="ownership-grid">
        <div><strong>{state.courses?.length||0}</strong><span>{lang==='ar'?'سجلات مقررات':'course records'}</span></div>
        <div><strong>{preferenceCount}</strong><span>{lang==='ar'?'تفضيلات مصرح بها':'declared preferences'}</span></div>
        <div><strong>{state.goal?1:0}</strong><span>{lang==='ar'?'هدف/مسار مختار':'selected target/goal'}</span></div>
      </div>
      <p>{lang==='ar'?'ملفات الوظائف والتدريب المرجعية ليست نسخة شخصية مخفية؛ المطابقات يعاد حسابها من أدلتك وتفضيلاتك. موافقتا المرشد والبحث أدناه عرض تجريبي فقط حتى اعتماد البنية الخلفية.':'Reference job/training profiles are not a hidden personal copy; matches are recomputed from your evidence and preferences. Advisor/research sharing controls below are demonstration-only until backend infrastructure is approved.'}</p>
      <button className="button secondary" onClick={()=>onPersistenceChange(!state.localPersistence)}>{state.localPersistence?(lang==='ar'?'إيقاف الحفظ الدائم على هذا الجهاز':'Stop persistent saving on this device'):(lang==='ar'?'الاحتفاظ بملفي على هذا الجهاز':'Keep my profile on this device')}</button>
    </div>
    <div className="panel"><div className="panel-head"><div><small>{t.consent}</small><h3>{lang==='ar'?'كل غرض له إذنه':'Each purpose has its own permission'}</h3></div></div>
      <div className="consents">{Object.keys(state.consents).map(key=>{const note=key==='analyze'
        ? (lang==='ar'?'ضروري فقط بعد اعتماد السجل':'Required only after transcript approval')
        : key==='insight'
          ? (lang==='ar'?'اختياري؛ يبقى محليًا ويتبع اختيارك للحفظ على هذا الجهاز ويمكن سحبه مستقلاً':'Optional; stays local, follows your device-persistence choice, and can be withdrawn independently')
          : (lang==='ar'?'عرض تجريبي فقط — لا توجد مشاركة فعلية مفعّلة في النسخة العامة':'Demonstration only — no operational sharing is enabled in the public release')
        return <label key={key}><span><strong>{t.consentItems[key]}</strong><small>{note}</small></span><input type="checkbox" checked={!!state.consents[key]} onChange={()=>toggle(key)}/></label>})}</div>
    </div>

    <div className="panel portable-backup">
      <div className="portable-head"><LockKeyhole size={30}/><div><small>{lang==='ar'?'استمرارية بلا حساب مركزي':'Continuity without a central account'}</small><h3>{lang==='ar'?'نسخة محلية مشفّرة':'Encrypted local backup'}</h3></div></div>
      <p>{lang==='ar'
        ? 'تحتوي النسخة على حالة الاستعادة وJSON-LD لملف القدرات، وتُشفّر محليًا بـ AES-GCM. عبارة المرور لا تُرسل ولا تُحفظ، لذلك لا يستطيع كامن استعادتها إذا نسيتها.'
        : 'The backup contains restore state plus the capability JSON-LD graph and is encrypted locally with AES-GCM. The passphrase is never sent or stored, so Kamin cannot recover it if you forget it.'}</p>
      <label className="portable-field"><span>{lang==='ar'?'عبارة المرور':'Passphrase'}</span><input type="password" autoComplete="new-password" value={backupPassphrase} onChange={e=>setBackupPassphrase(e.target.value)} placeholder={lang==='ar'?'12 حرفًا على الأقل':'At least 12 characters'}/></label>
      <label className="portable-field"><span>{lang==='ar'?'تأكيد العبارة — مطلوب للتصدير فقط':'Confirm — export only'}</span><input type="password" autoComplete="new-password" value={backupConfirm} onChange={e=>setBackupConfirm(e.target.value)} placeholder={lang==='ar'?'أعد كتابة العبارة':'Repeat passphrase'}/></label>
      <div className="portable-actions">
        <button className="button primary" disabled={backupBusy || (!state.approved && !state.consents.insight)} onClick={exportBackup}><Download size={17}/>{lang==='ar'?'تنزيل نسخة مشفّرة':'Download encrypted backup'}</button>
        <button className="button secondary" disabled={backupBusy} onClick={()=>backupFileRef.current?.click()}><UploadCloud size={17}/>{lang==='ar'?'استعادة نسخة':'Restore backup'}</button>
        <input ref={backupFileRef} className="sr-only" type="file" accept=".kamin,application/json" onChange={e=>importBackup(e.target.files?.[0])}/>
      </div>
      <small className="portable-note">{lang==='ar'
        ? 'عند الاستعادة يعيد كامن حساب المهارات والملاءمة من الأدلة؛ ولا يعيد تفعيل موافقات المشاركة مع المرشد/البحث تلقائيًا.'
        : 'On restore, Kamin recomputes skills and fit from evidence; advisor/research sharing consents are not automatically re-enabled.'}</small>
      {backupStatus&&<div className="portable-status" role="status" aria-live="polite">{backupStatus}</div>}
    </div>

    <div className="panel privacy-actions"><ShieldCheck size={30}/><h3>{lang==='ar'?'ملفك تحت سيطرتك':'Your profile stays under your control'}</h3><p>{t.privacyNote}</p>{confirmDelete ? <div className="delete-confirm"><p>{t.deleteConfirm}</p><div><button className="button danger" onClick={onDelete}><Trash2 size={17}/>{lang==='ar'?'نعم، احذف':'Yes, delete'}</button><button className="button secondary" onClick={()=>setConfirmDelete(false)}>{t.cancel}</button></div></div> : <button className="button danger" onClick={()=>setConfirmDelete(true)}><Trash2 size={17}/>{t.delete}</button>}</div>
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
  const [persistenceDismissed,setPersistenceDismissed] = useState(false)
  const [changeSummary,setChangeSummary] = useState(null)
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const initialSessionRef = useRef(Boolean(sessionStorage.getItem(STORAGE_KEY)||sessionStorage.getItem(LEGACY_SESSION_KEY)))
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const skills = useMemo(()=>state.approved?inferSkills(state.courses):[],[state])
  const recs = useMemo(()=>judgeOpportunities(skills,state.goal,lang),[skills,state.goal,lang])
  const nextDecision = useMemo(()=>{
    if(!state.approved || skills.length===0) return null
    return recs.find(item=>item.gapCode!=='repetition')||null
  },[state.approved,skills,recs])
  const educationClassification = useMemo(()=>state.approved?inferTranscriptSsces(state.courses):{primary:null},[state])
  const compared = recs.filter(r=>compareIds.includes(r.id))
  const personGraph = useMemo(()=>projectStateToPerson360({state,skills,educationClassification}),[state,skills,educationClassification])
  const matchProfile = useMemo(()=>buildMatchingProfile({graph:personGraph}),[personGraph])
  const matches = useMemo(()=>matchTargets(matchProfile,{lang}),[matchProfile,lang])

  useEffect(()=>{
    if(initialSessionRef.current) return undefined
    let cancelled=false
    readLocalProfile().then(saved=>{
      if(cancelled || !saved?.localPersistence) return
      const next=normalizeState(saved)
      setState(next)
      setDraft(next.courses||[])
      setView(next.approved?'dashboard':'start')
      setPersistenceDismissed(true)
      trackPilotEvent('profile_returned_to')
      setNotice(lang==='ar'?'أعدنا ملفك المحفوظ محليًا على هذا الجهاز.':'Your locally saved profile was restored on this device.')
    }).catch(()=>{})
    return()=>{cancelled=true}
  },[])
  useEffect(()=>{
    if(hasMeaningfulProfileState(state)) sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state))
    else sessionStorage.removeItem(STORAGE_KEY)
    if(state.localPersistence) void writeLocalProfile(state).catch(()=>{})
  },[state])
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
  const startManual = () => { setDraft([]); setValidation({recognized:0,rejected:[],usedOcr:false,mode:'manual'}); setReviewConsent(false); setFileError(''); setView('review') }
  const upload = async (file) => {
    if (!file) return
    trackPilotEvent('upload_started')
    setProcessing(true); setProgress(2)
    try {
      const { extractTranscript } = await import('./utils/transcript.js')
      const result = await extractTranscript(file,setProgress)
      setDraft(result.courses)
      setValidation(result.validation||null)
      setChangeSummary({
        type:'upload',
        recognized:result.courses.length,
        mapped:result.courses.filter(course=>isMappedCourse(course.code)).length,
        rejected:(result.validation?.rejected||[]).length,
        ts:Date.now(),
      })
      setReviewConsent(false)
      setFileError(result.courses.length ? '' : (lang==='ar' ? 'لم نتعرف على مقررات قابلة للاعتماد. لم يتم تحميل أي بيانات تجريبية؛ راجع ملخص التحقق أو أضف المقررات يدويًا.' : 'No approvable courses were recognized. No demo data were loaded; review the validation summary or add courses manually.'))
      setView('review')
      log(lang==='ar'? `قراءة ملف محلي: ${file.name}` : `Local file read: ${file.name}`)
      if (!result.courses.length) setDraft([])
      else trackPilotEvent('upload_completed')
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
    const approvedSkills=inferSkills(draft)
    setChangeSummary({type:'approve',courses:draft.length,skills:approvedSkills.length,ts:Date.now()})
    setState(s=>({...s,courses:draft,approved:true,consents:{...s.consents,analyze:true},audit:[{label:lang==='ar'?'منح موافقة تحليل السجل واعتماده':'Transcript analysis consent granted and record approved',ts:Date.now()},...s.audit]}))
    setView('dashboard')
    trackPilotEvent('profile_completed')
    setNotice(lang==='ar' ? 'تم اعتماد السجل. اختر “الاحتفاظ بملفي على هذا الجهاز” إذا أردت العودة إليه بعد إغلاق المتصفح.' : 'Transcript approved. Choose “Keep my profile on this device” if you want it available after closing the browser.')
  }
  const chooseGoal = goal => { setState(s=>({...s,goal})); log(lang==='ar'?'تغيير الهدف':'Goal changed') }
  const toggleCompare = id => setCompareIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):(ids.length<3?[...ids,id]:ids))
  const exportProfile = async passphrase => {
    const portable = await import('./utils/portableProfile.js')
    const person360=projectStateToPerson360({state,skills,educationClassification})
    const payload=portable.buildPortableProfile({state,person360,appVersion:'1.0.0'})
    const envelope=await portable.encryptPortableProfile(payload,passphrase)
    const url=URL.createObjectURL(new Blob([JSON.stringify(envelope,null,2)],{type:'application/vnd.kamin.profile+json'}))
    const a=document.createElement('a')
    a.href=url
    a.download=`kamin-profile-${new Date().toISOString().slice(0,10)}.kamin`
    a.click()
    URL.revokeObjectURL(url)
    log(lang==='ar'?'إنشاء نسخة محلية مشفّرة':'Encrypted local backup created')
  }
  const importProfile = async (file,passphrase) => {
    if (!file || file.size > 10*1024*1024) throw new Error('BACKUP_TOO_LARGE')
    let envelope
    try { envelope=JSON.parse(await file.text()) } catch { throw new Error('INVALID_BACKUP_FILE') }
    const { decryptPortableProfile, normalizePortableState } = await import('./utils/portableProfile.js')
    const payload=await decryptPortableProfile(envelope,passphrase)
    const restored=normalizePortableState(payload)
    const next={
      ...blankState,
      ...restored,
      consents:{...blankState.consents,...restored.consents,advisor:false,research:false},
      insight:{...emptyInsightState(),...(restored.insight||{}),responses:{...(restored.insight?.responses||{})}},
      audit:[{label:lang==='ar'?'استعادة نسخة محلية مشفّرة وإعادة الحساب':'Encrypted local backup restored and recomputed',ts:Date.now()},...(restored.audit||[])].slice(0,100),
    }
    setState(next)
    setDraft(next.courses)
    setValidation(null)
    setCompareIds([])
    setReviewConsent(false)
    setFileError('')
    setView(next.approved?'dashboard':'start')
    setNotice(lang==='ar'?'تمت استعادة ملفك محليًا. أُعيد حساب النتائج من الأدلة، ولم تُفعّل موافقات المشاركة الخارجية.':'Your profile was restored locally. Derived results were recomputed from evidence; external sharing consents remain off.')
  }
  const changePersistence = enabled => {
    if(enabled){
      setPersistenceDismissed(true)
      setState(s=>{
        const next={...s,localPersistence:true,audit:[{label:lang==='ar'?'منح موافقة الحفظ المحلي الدائم على هذا الجهاز':'Persistent local-device storage consent granted',ts:Date.now()},...s.audit].slice(0,100)}
        void writeLocalProfile(next).catch(()=>{})
        return next
      })
      setNotice(lang==='ar'?'سيبقى ملفك على هذا الجهاز حتى تحذفه أو توقف الحفظ الدائم.':'Your profile will remain on this device until you delete it or stop persistent saving.')
    }else{
      setPersistenceDismissed(true)
      void clearLocalProfile().catch(()=>{}).finally(()=>{
        setState(s=>({...s,localPersistence:false,audit:[{label:lang==='ar'?'إيقاف الحفظ المحلي الدائم وحذف النسخة المحفوظة':'Persistent local saving disabled and saved copy deleted',ts:Date.now()},...s.audit].slice(0,100)}))
        setNotice(lang==='ar'?'أُوقِف الحفظ الدائم؛ بقيت جلسة المتصفح الحالية فقط.':'Persistent saving is off; only the current browser session remains.')
      })
    }
  }
  const deleteAll = async () => {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(LEGACY_SESSION_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    clearPilotLocalData()
    try{await clearLocalProfile()}catch{}
    setState(normalizeState(blankState)); setDraft([]); setValidation(null); setCompareIds([]); setReviewConsent(false); setPersistenceDismissed(false); setView('start')
  }

  const nav = [
    ['dashboard',LayoutDashboard,t.app.dashboard],
    ['skills',GraduationCap,t.app.skills],
    ['insight',Fingerprint,t.app.insight],
    ['matches',SearchCheck,t.app.matches],
    ['courses',BookOpen,t.app.courses],
    ['compare',SearchCheck,t.app.compare],
    ['privacy',ShieldCheck,t.app.privacy],
    ['audit',ClipboardCheck,t.app.audit],
  ]

  return <div className="app-overlay" role="dialog" aria-modal="true" aria-label={t.app.title} ref={dialogRef}>
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand"><BrandMark/><div><strong>{t.name}</strong><small>{t.tagline}</small></div></div>
        <nav>{nav.map(([id,Icon,label])=>{const locked=!state.approved && !['insight','matches','privacy','audit'].includes(id);return <button key={id} disabled={locked} title={locked?(lang==='ar'?'اعتمد سجلًا أولًا لفتح هذا القسم':'Approve a transcript first to unlock this section'):undefined} className={view===id?'active':''} onClick={()=>setView(id)}><Icon size={18}/><span className="nav-copy"><span>{label}</span>{locked&&<small>{lang==='ar'?'اعتمد سجلًا للفتح':'Approve a transcript to unlock'}</small>}</span></button>})}</nav>
        <div className="sidebar-trust"><ShieldCheck/><span>{lang==='ar'?'المعالجة محلية في النسخة العامة':'Local processing in public release'}</span></div>
      </aside>
      <div className="app-main">
        <header className="app-topbar"><div><small>{t.app.title}</small><strong>{state.approved?(lang==='ar'?'ملف معتمد':'Approved profile'):(lang==='ar'?'إصدار عام':'Public release')}</strong></div><div><button ref={closeButtonRef} className="icon-button" onClick={onClose} aria-label={lang==='ar'?'إغلاق':'Close'}><X/></button></div></header>
        {notice&&<div className="toast" role="status" aria-live="polite"><Check size={18}/><span>{notice}</span></div>}
        <div className="app-content-wrap" role="main">
          {view==='start' && <section className="app-content onboarding">
            <div className="app-title"><small>01</small><h2>{t.app.title}</h2><p>{t.app.intro}</p></div>
            <div className="onboarding-primary">
              <a className="sample-first-link" href={lang==='ar'?'/sample-report.html?lang=ar':'/sample-report.html?lang=en'} onClick={()=>trackPilotEvent('sample_report_viewed')}><Sparkles size={17}/>{lang==='ar'?'شاهد التقرير التوضيحي أولًا — بدون رفع أي ملف':'View the synthetic report first — no upload required'}</a>
              <button className="onboarding-upload" onClick={()=>fileRef.current?.click()}><div className="start-icon"><UploadCloud/></div><div><small>{lang==='ar'?'المسار الموصى به':'Recommended start'}</small><h3>{t.app.upload}</h3><p>{t.app.uploadHelp}</p></div></button>
              <div className="inline-trust"><ShieldCheck size={19}/><strong>{trustMicrocopy('transcript',lang)}</strong></div>
              <div className="onboarding-secondary">
                <button className="text-button" onClick={()=>cameraRef.current?.click()}><UploadCloud size={16}/>{lang==='ar'?'صوّر بالكاميرا':'Use camera'}</button>
                <button className="text-button" onClick={loadDemo}><Sparkles size={16}/>{t.app.demo}</button>
                <button className="text-button" onClick={startManual}><Plus size={16}/>{lang==='ar'?'أو أدخل يدويًا':'or enter manually'}</button>
                <button className="text-button" onClick={()=>setView('privacy')}><LockKeyhole size={16}/>{lang==='ar'?'استعد ملفك':'Restore your profile'}</button>
              </div>
            </div>
            <label className="sr-only" htmlFor="kamin-transcript-file">{lang==='ar'?'اختر ملف كشف الدرجات':'Choose transcript file'}</label><input id="kamin-transcript-file" className="sr-only" ref={fileRef} type="file" accept=".pdf,image/png,image/jpeg,image/webp,.txt" onChange={e=>upload(e.target.files?.[0])}/>
            <label className="sr-only" htmlFor="kamin-transcript-camera">{lang==='ar'?'صوّر كشف الدرجات بالكاميرا':'Photograph transcript with camera'}</label><input id="kamin-transcript-camera" className="sr-only" ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e=>upload(e.target.files?.[0])}/>
            {processing&&<div className="processing" role="status" aria-live="polite"><div className="processing-row"><div className="spinner"/><strong>{t.app.processing}</strong><b>{progress}%</b></div><div className="progress" aria-label={lang==='ar'?'تقدم قراءة الملف':'File reading progress'}><i style={{width:`${progress}%`}}/></div><small>{trustMicrocopy('transcript',lang)}</small></div>}
          </section>}
          {view==='review' && <section className="app-content"><div className="app-title"><small>02</small><h2>{t.app.review}</h2><p>{lang==='ar'?'التقنية تستخرج؛ أنت تعتمد. صحح أي سطر قبل أن يصبح دليلًا.':'Technology extracts; you approve. Correct any line before it becomes evidence.'}</p></div>{fileError&&<div className="error-banner" role="alert">{fileError}</div>}<ValidationSummary lang={lang} validation={validation}/><WhatChanged change={changeSummary?.type==='upload'?changeSummary:null} lang={lang}/><CourseReview lang={lang} rows={draft} setRows={setDraft} onApprove={approve} consent={reviewConsent} setConsent={setReviewConsent}/></section>}
          {state.approved && view==='dashboard' && <section className="app-content">
            <div className="app-title"><small>{t.app.dashboard}</small><h2>{lang==='ar'?'هذه قدراتك كما نراها الآن':'This is how your capabilities look now'}</h2><p>{lang==='ar'?'كل مؤشر هنا مبدئي وقابل للرجوع إلى دليل في سجلك المعتمد.':'Every indicator here is preliminary and traceable to evidence in your approved record.'}</p></div>
            <WhatChanged change={changeSummary?.type==='approve'?changeSummary:null} lang={lang}/>
            <div className="session-banner"><ShieldCheck size={17}/><span>{state.localPersistence
              ? (lang==='ar'?'ملفك محفوظ محليًا على هذا الجهاز بموافقتك. لا توجد نسخة مركزية لدى كامن.':'Your profile is persistently saved on this device with your consent. Kamin keeps no central copy.')
              : (lang==='ar'?'ملفك مؤقت في جلسة المتصفح الحالية فقط. فعّل الحفظ المحلي أدناه إذا أردت العودة إليه لاحقًا.':'Your profile is session-only right now. Enable local device saving below if you want to return later.')}</span></div>
            {!state.localPersistence&&!persistenceDismissed&&<div className="local-save-prompt"><div><LockKeyhole size={20}/><span><strong>{lang==='ar'?'هل تريد الاحتفاظ بملفك على هذا الجهاز؟':'Keep your profile on this device?'}</strong><small>{lang==='ar'?'يُحفظ محليًا عبر IndexedDB بعد موافقتك، ويمكنك حذفه بالكامل في أي وقت.':'With your consent it is stored locally in IndexedDB and can be fully deleted at any time.'}</small></span></div><div><button className="button primary" onClick={()=>changePersistence(true)}>{lang==='ar'?'نعم، احتفظ بملفي':'Yes, keep my profile'}</button><button className="button secondary" onClick={()=>setPersistenceDismissed(true)}>{lang==='ar'?'ليس الآن':'Not now'}</button></div></div>}
            <div className="metrics"><article><span>{lang==='ar'?'مهارات مدعومة بالدليل':'Evidence-backed skills'}</span><strong>{skills.length}</strong><small>{lang==='ar'?'من السجل المعتمد':'from approved record'}</small></article><article><span>{lang==='ar'?'أعلى قوة دليل':'Highest evidence strength'}</span><strong>{skills[0]?evidenceStrengthText(skills[0].confidenceLabel,lang):'—'}</strong><small>{skills[0]?.labels[lang]||'—'}</small></article><article><span>{lang==='ar'?'الحكم الأعلى حاليًا':'Current top judgment'}</span><strong>{nextDecision?t.app.fit[nextDecision.status]:'—'}</strong><small>{nextDecision?.title[lang]||(lang==='ar'?'أضف دليلًا معتمدًا أولًا':'Add approved evidence first')}</small></article></div>
            <EducationClassificationCard lang={lang} classification={educationClassification}/>
            <div className="dashboard-grid"><div className="panel"><div className="panel-head"><div><small>{t.app.skills}</small><h3>{lang==='ar'?'الأدلة قبل الادعاء':'Evidence before claims'}</h3></div><button className="text-button" onClick={()=>setView('skills')}>{lang==='ar'?'كل المهارات':'All skills'}</button></div>{skills.slice(0,4).map(s=><div className="skill-row" key={s.id}><span>{s.labels[lang]}</span><div><i className={s.confidenceLabel||'low'}/></div><b>{evidenceStrengthText(s.confidenceLabel,lang)}</b></div>)}</div>
            <div className="panel"><div className="panel-head"><div><small>{t.app.goal}</small><h3>{lang==='ar'?'ما الذي تريد الوصول إليه؟':'Where do you want to go?'}</h3></div></div><div className="goal-options">{Object.entries(t.app.goals).map(([id,label])=><button key={id} className={state.goal===id?'active':''} onClick={()=>chooseGoal(id)}><Target size={16}/>{label}</button>)}</div></div></div>
            {nextDecision?<div className="panel decision"><div className="decision-head"><div><small>{lang==='ar'?'القرار التالي':'Next decision'}</small><h3>{nextDecision.title[lang]}</h3></div><span className={`status ${nextDecision.status}`}>{t.app.fit[nextDecision.status]}</span></div><div className="decision-body"><div className="decision-score"><strong>{t.app.fit[nextDecision.status]}</strong><small>{lang==='ar'?'حكم مفسّر — بلا نسبة غير معايرة':'explained judgment — no uncalibrated percentage'}</small></div><div>{nextDecision.reasons.map((reason,i)=><p key={i}><Check size={15}/>{reason}</p>)}<p className="becomes"><strong>{t.app.becomes}</strong> {nextDecision.becomes}</p></div></div><button className="button primary" onClick={()=>setView('courses')}>{lang==='ar'?'استكشف كل الدورات':'Explore all courses'}</button></div>:<div className="panel decision decision-locked"><LockKeyhole size={28}/><div><small>{lang==='ar'?'القرار التالي':'Next decision'}</small><h3>{lang==='ar'?'أضف أو اعتمد مقررًا مرتبطًا بقدرة لفتح أول توصية':'Add or approve capability-linked coursework to unlock your first recommendation'}</h3><p>{lang==='ar'?'لا يعرض كامن حكم دورة عندما لا توجد أي مهارة مدعومة بالدليل. يمكنك مراجعة السجل أو إضافة مقرر يدويًا.':'Kamin does not render a course judgment when the profile has zero evidence-backed skills. Review your transcript or add a course manually.'}</p></div></div>}<PilotFeedback lang={lang}/>
          </section>}
          {view==='insight' && <section className="app-content"><StudentInsight lang={lang} state={state} setState={setState} log={log}/></section>}
          {view==='matches' && <section className="app-content"><MatchExplorer lang={lang} profile={matchProfile} matches={matches}/></section>}
          {state.approved && view==='skills' && <section className="app-content"><div className="app-title"><small>{t.app.skills}</small><h2>{lang==='ar'?'كل مهارة مرتبطة بدليل':'Every skill is tied to evidence'}</h2><p>{lang==='ar'?'نعرض قوة الدليل فئياً في الإصدار العام، ولا نعرض نسبة رقمية حتى تتم معايرتها بالدراسة.':'The public release shows categorical evidence strength and withholds numeric percentages until research calibration.'}</p></div><div className="skills-grid">{skills.map(s=><SkillCard key={s.id} skill={s} lang={lang}/>)}</div></section>}
          {state.approved && view==='courses' && <section className="app-content"><div className="app-title app-title-row"><div><small>{t.app.courses}</small><h2>{lang==='ar'?'لا نرتب الدورات فقط؛ نشرح القرار':'We do not just rank courses; we explain the decision'}</h2></div><select value={state.goal||''} onChange={e=>chooseGoal(e.target.value||null)} aria-label={t.app.goal}><option value="">{lang==='ar'?'اختر هدفًا أولًا':'Choose a goal first'}</option>{Object.entries(t.app.goals).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div><div className="fit-grid">{recs.map(r=><FitCard key={r.id} item={r} lang={lang} compared={compareIds.includes(r.id)} toggle={toggleCompare}/>)}</div></section>}
          {state.approved && view==='compare' && <section className="app-content"><div className="app-title"><small>{t.app.compare}</small><h2>{lang==='ar'?'نفس الأبعاد. قرار أسهل.':'Same dimensions. Easier decision.'}</h2><p>{lang==='ar'?'اختر حتى ثلاث دورات من صفحة الدورات.':'Choose up to three courses from the courses page.'}</p></div><Compare lang={lang} items={compared}/></section>}
          {view==='privacy' && <section className="app-content"><div className="app-title"><small>{t.app.privacy}</small><h2>{lang==='ar'?'أنت صاحب القرار على بياناتك':'You control your data'}</h2><p>{lang==='ar'?'كل غرض له موافقته، والسحب واضح بقدر المنح.':'Each purpose has its own consent, and withdrawal is as clear as granting it.'}</p></div><><WhatChanged change={['withdraw-analyze','withdraw-insight'].includes(changeSummary?.type)?changeSummary:null} lang={lang}/><Privacy lang={lang} state={state} setState={setState} log={log} onExport={exportProfile} onImport={importProfile} onDelete={deleteAll} onPersistenceChange={changePersistence} onChangeSummary={setChangeSummary}/></></section>}
          {view==='audit' && <section className="app-content"><div className="app-title"><small>{t.app.audit}</small><h2>{lang==='ar'?'كشف حساب بياناتك':'Your data statement'}</h2><p>{lang==='ar'?'كل تغيير في ملف النسخة العامة يظهر هنا.':'Every change to your public-release profile appears here.'}</p></div><Audit lang={lang} entries={state.audit}/></section>}
        </div>
        <nav className="bottom-nav" aria-label={lang==='ar'?'تنقل التطبيق على الجوال':'Mobile app navigation'}>{nav.map(([id,Icon,label])=>{const locked=!state.approved&&!['insight','matches','privacy','audit'].includes(id);return <button key={id} className={view===id?'active':''} disabled={locked} title={locked?(lang==='ar'?'اعتمد سجلًا أولًا لفتح هذا القسم':'Approve a transcript first to unlock this section'):undefined} onClick={()=>setView(id)}><Icon size={18}/><span>{label}</span></button>})}</nav>
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
    return <div className="app-overlay" role="alertdialog" aria-modal="true"><div className="error-boundary-card"><ShieldCheck/><h2>{this.props.lang==='ar'?'تعذر إكمال هذه الشاشة بأمان':'This screen could not complete safely'}</h2><p>{this.props.lang==='ar'?'بياناتك لم تُرسل إلى خادم. أغلق التجربة وحاول مرة أخرى أو استخدم الإدخال اليدوي.':'Your data were not sent to a server. Close the app and try again or use manual entry.'}</p><button className="button primary" onClick={this.props.onClose}>{this.props.lang==='ar'?'إغلاق التطبيق':'Close app'}</button></div></div>
  }
}

export default function App() {
  const [lang,setLang] = useState(()=>new URLSearchParams(window.location.search).get('lang')||localStorage.getItem('kamin-lang')||'ar')
  const [appOpen,setAppOpen] = useState(false)
  const appTriggerRef=useRef(null)
  const openApp=()=>{appTriggerRef.current=document.activeElement;setAppOpen(true)}
  const closeApp=()=>{setAppOpen(false);requestAnimationFrame(()=>appTriggerRef.current?.focus?.())}
  const t = copy[lang]
  useEffect(()=>{trackPilotEvent('landing')},[])
  useEffect(()=>{
    const ar = lang === 'ar'
    const title = ar ? 'كامن | ملف قدرات موثّق وملاءمة مفسّرة' : 'Kamin | Evidence-backed capability profiles'
    const description = ar
      ? 'كامن يحوّل السجل الأكاديمي والمشاريع إلى ملف قدرات تملكه، ثم يشرح أي فرص تناسبك، لماذا، وما الذي ينقصك.'
      : 'Kamin turns academic records and projects into a capability profile you own, then explains what fits, why, and what is missing.'
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
    <Header lang={lang} setLang={setLang} onTry={openApp}/>
    <main id="main"><Landing lang={lang} onTry={openApp}/></main>
    <footer><div className="shell footer-row"><div><BrandMark/><span>{t.footer}</span></div><div><a href={lang==='ar'?'/sample-report.html?lang=ar':'/sample-report.html?lang=en'}>{lang==='ar'?'تقرير تجريبي':'Sample report'}</a><a href={lang==='ar'?'/methodology.html?lang=ar':'/methodology.html?lang=en'}>{lang==='ar'?'المنهجية':'Methodology'}</a><a href={lang==='ar'?'/trust.html?lang=ar':'/trust.html?lang=en'}>{lang==='ar'?'مركز الثقة':'Trust center'}</a><a href={lang==='ar'?'/privacy.html?lang=ar':'/privacy.html?lang=en'}>{lang==='ar'?'الخصوصية':'Privacy'}</a><a href={lang==='ar'?'/faq.html?lang=ar':'/faq.html?lang=en'}>{lang==='ar'?'الأسئلة الشائعة':'FAQ'}</a></div></div></footer>
    {appOpen&&<AppErrorBoundary lang={lang} onClose={closeApp}><KaminApp lang={lang} onClose={closeApp}/></AppErrorBoundary>}
  </>
}

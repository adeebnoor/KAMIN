import {pageHref} from '../../public/site-content.js'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, UploadCloud, ShieldCheck, ClipboardCheck, Compass, Target, GraduationCap, BookOpen, Search, Network, ListChecks } from 'lucide-react'
import QuickTour from './QuickTour.jsx'
import RelationshipNetwork from './RelationshipNetwork.jsx'
import InferenceDemo from './InferenceExplorer.jsx'
import CompetitiveHero from './CompetitiveHero.jsx'
import { courseEvidencePrinciple } from '../content/trustCopy.js'
const tr = (lang, ar, en) => lang === 'ar' ? ar : en

// Task 14 · five sections: hero, how it works (3 steps), why you can trust it (3 points), FAQ,
// closing. The idea behind Kamin, who it is for and the service list moved to about.html,
// services.html and trust.html (scripts/landing-moved.mjs), linked under "Learn more". The
// interactive network, knowledge search and inference demo stay in the closed "Explore further".
export default function LandingExperience({ lang, onTry, onProfile, onKnowledge, onSample }) {
  const [knowledgeSearch,setKnowledgeSearch]=useState('')
  const [dimension,setDimension]=useState(0)
  const dimensions=[
    [Compass,tr(lang,'اهتماماتي','My interests'),tr(lang,'ما تستمتع باستكشافه يشرح ارتباط المسارات بك. لا يتحول إلى مهارة مثبتة.','What you enjoy exploring adds context to pathways; it does not become a proven skill.')],
    [Target,tr(lang,'أهدافي','My goals'),tr(lang,'اتجاه تختاره وتعدّله، يساعدك على التركيز على خطوة تهمك.','A direction you can choose and change, helping you focus on a meaningful next step.')],
    [GraduationCap,tr(lang,'أدلتي','My evidence'),tr(lang,'مقررات تراجعها تربط دراستك بالقدرات ومتطلبات المسار.','Reviewed coursework connects your studies to capabilities and pathway requirements.')],
    [ShieldCheck,tr(lang,'تحكّمي بالبيانات','My data controls'),tr(lang,'كل مصدر اختياري وله غرض واضح. يمكنك التخطي أو الحذف دون ضغط لإكمال الملف.','Each optional source has a clear purpose. Skip or delete information without pressure to complete a profile.')],
  ]
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight
  const steps = [
    [UploadCloud, tr(lang,'ارفع كشف درجاتك','Upload your transcript'), tr(lang,'صورة أو PDF، يُقرأ على جهازك فقط.','An image or PDF, read on your device only.')],
    [ClipboardCheck, tr(lang,'راجع واعتمد','Review and approve'), tr(lang,'صحّح أي سطر، ثم وافق على التحليل.','Correct any line, then agree to the analysis.')],
    [ListChecks, tr(lang,'شاهد قدراتك وخطوتك التالية','See your capabilities and next step'), tr(lang,'لكل قدرة مصدرها ومستوى دليلها، ومعها أهم فجوة لهدفك.','Each capability shows its source and evidence level, with the main gap for your goal.')],
  ]
  const trust = [
    [ShieldCheck, tr(lang,'يعمل على جهازك','Runs on your device'), tr(lang,'يُقرأ كشفك ويُحلَّل في متصفحك؛ لا يُرفع إلى أي خادم، ولا تحتاج حسابًا.','Your transcript is read and analysed in your browser; it is not uploaded to any server and needs no account.')],
    [BookOpen, tr(lang,'لكل قدرة مصدر','Every capability has a source'), tr(lang,'تظهر بجانب كل قدرة المقررات التي تدعمها ومستوى الدليل وسببه، ويمكنك تصحيحها أو حذفها.','Each capability shows the courses behind it, its evidence level and why; you can correct or delete them.')],
    [GraduationCap, tr(lang,'الدرجة قرينة لا ضمان','A grade is a clue, not a guarantee'), courseEvidencePrinciple(lang)],
  ]
  const faq = [
    [tr(lang,'هل يمكنني الاستفادة دون مشاركة بياناتي؟','Can I try it without sharing my data?'),tr(lang,'نعم. افتح التقرير التجريبي أو جرّب المثال داخل التطبيق. عند إدخال سجلك الحقيقي، تتم معالجته محليًا. لا يحتاج الاستخدام إلى حساب.','Yes. Open the sample report or try the in-app demo. Your real record is processed locally, and no account is needed.')],
    [tr(lang,'هل الدرجة العالية تعني أنني أتقن المهارة؟','Does a high grade mean I have mastered the skill?'),`${courseEvidencePrinciple(lang)} ${tr(lang,'لذلك يعرض كامن مستوى دليل (قوية، متوسطة، محدودة) مع سببه، لا نسبة.','So Kamin shows an evidence level (strong, moderate, limited) with its reason, never a percentage.')}`],
    [tr(lang,'هل هذه فرص حقيقية ونتائج نهائية؟','Are these live opportunities and final assessments?'),tr(lang,'المسارات والدورات الحالية أمثلة مرجعية. المطابقة استرشادية ولم تُعاير بعد بدراسة مستقلة؛ راجع متطلبات الجهة قبل أي قرار.','Current pathways and courses are reference examples. Matching is exploratory and has not been independently calibrated; check provider requirements before deciding.')],
    [tr(lang,'هل يتأكد كامن أن معلوماتي صحيحة؟','Does Kamin verify that my information is true?'),tr(lang,'يفحص النقص والتكرار وصيغ الدرجات ويطلب مراجعتك. لا يتحقق من أصالة السجل مع الجامعة. استيراد الاعتمادات متاح، لكن سجل جهات الإصدار الموثوقة ما زال فارغًا.','It checks missing fields, duplicates and grade formats, and asks you to review. It does not authenticate transcripts with the university. Credential import is available, but the trusted-issuer registry is still empty.')],
    [tr(lang,'كيف أصحح بياناتي أو أحذفها؟','How do I correct or delete my data?'),tr(lang,'من «بياناتي»: صحّح أي مقرر أو احذفه، واسحب أي موافقة، أو احذف كل شيء من هذا الجهاز.','In “My data”: correct or delete any course, withdraw any consent, or delete everything from this device.')],
    [tr(lang,'بماذا يختلف كامن عن LinkedIn أو جدارات؟','How is Kamin different from LinkedIn or Jadarat?'),tr(lang,'تساعدك LinkedIn على عرض خبرتك والتواصل المهني، وتربط جدارات الباحثين عن عمل في المملكة بالفرص والتدريب. كامن لا يحل محلهما: يضيف ربطًا قابلًا للمراجعة بين مقرراتك وقدراتك، مع مصدر كل قدرة وحدودها.','LinkedIn helps you present your experience and build a professional network, and Jadarat connects job seekers in Saudi Arabia with opportunities and training. Kamin does not replace them: it adds a reviewable link between your coursework and your capabilities, with the source and limits of each.')],
  ]
  return <div className="landing-v2 landing-v3">
    <CompetitiveHero lang={lang} onSample={onSample} onProfile={onProfile} reportHref={pageHref('sample-report.html',lang)}/>

    <section id="how" className="k-how shell" aria-labelledby="k-how-title">
      <div className="k-section-intro"><span className="k-overline">{tr(lang,'كيف يعمل','HOW IT WORKS')}</span><h2 id="k-how-title">{tr(lang,'ثلاث خطوات، وكل خطوة تعرف سببها.','Three steps, each with its reason.')}</h2></div>
      <div className="k-how-grid">
        <ol className="k-steps">{steps.map(([Icon,title,text],i)=><li key={title}><span className="k-step-number">{i+1}</span><Icon size={24} aria-hidden="true"/><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol>
        <QuickTour lang={lang} onSample={onSample} onProfile={onProfile}/>
      </div>
      <p className="k-more-link"><a href={pageHref('guide.html',lang)}>{tr(lang,'دليلك إلى البداية','Your guide to getting started')}</a></p>
    </section>

    <section id="trust" className="k-trust shell" aria-labelledby="k-trust-title">
      <div className="k-section-intro"><span className="k-overline">{tr(lang,'لماذا تثق به','WHY YOU CAN TRUST IT')}</span><h2 id="k-trust-title">{tr(lang,'طموح تدعمه الأدلة. وقرار يبقى بيدك.','Ambition supported by evidence. Decisions that stay yours.')}</h2></div>
      <div className="k-trust-grid">{trust.map(([Icon,title,text])=><article key={title}><Icon size={24} aria-hidden="true"/><h3>{title}</h3><p>{text}</p></article>)}</div>
      <nav className="k-learn-more" aria-label={tr(lang,'اعرف المزيد','Learn more')}><strong>{tr(lang,'اعرف المزيد:','Learn more:')}</strong>
        <a href={pageHref('trust.html',lang)}>{tr(lang,'مركز الثقة','Trust center')}</a>
        <a href={`${pageHref('services.html',lang)}#who-for`}>{tr(lang,'لمن كامن وخدماته','Who Kamin is for and its services')}</a>
        <a href={`${pageHref('about.html',lang)}#idea`}>{tr(lang,'الفكرة التي بُني عليها','The idea behind it')}</a>
        <a href={pageHref('catalog.html',lang)}>{tr(lang,'المعرفة ومصادرها','Knowledge and its sources')}</a>
        <a href={pageHref('validation.html',lang)}>{tr(lang,'خطة التحقق (أهداف لا نتائج)','Validation plan (goals, not results)')}</a>
      </nav>
    </section>

    <section id="home-faq" className="v2-faq shell k-faq" aria-labelledby="k-faq-title"><div className="k-section-intro"><span className="k-overline">{tr(lang,'إجابات واضحة','CLEAR ANSWERS')}</span><h2 id="k-faq-title">{tr(lang,'قبل أن تبدأ','Before you begin')}</h2></div>
      {faq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      <a href={pageHref('faq.html',lang)}>{tr(lang,'جميع الأسئلة الشائعة','All frequently asked questions')}</a>
    </section>

    <details className="pilot-advanced shell"><summary>{tr(lang,'للاستكشاف المتقدم: الشبكة والمنهجية والاستدلال','Explore further: network, methodology and inference')}</summary>
      <RelationshipNetwork lang={lang} demo onKnowledge={()=>onKnowledge()}/>
      <div className="knowledge-gateway" id="profile-dimensions">
        <div className="knowledge-gateway-top"><div><span className="v2-kicker">{tr(lang,'اكتشف قبل أن تشارك','EXPLORE BEFORE YOU SHARE')}</span><h2>{tr(lang,'ما الذي تريد فهمه؟','What would you like to understand?')}</h2><p>{tr(lang,'استكشف القدرات والاهتمامات والمسارات دون إدخال بيانات شخصية.','Explore capabilities, interests and pathways without entering personal information.')}</p></div><Network size={34}/></div>
        <form className="knowledge-home-search" onSubmit={e=>{e.preventDefault();onKnowledge(knowledgeSearch)}}><label className="sr-only" htmlFor="knowledge-home-search">{tr(lang,'ابحث في المعرفة المرجعية','Search reference knowledge')}</label><Search size={21}/><input id="knowledge-home-search" type="search" value={knowledgeSearch} onChange={e=>setKnowledgeSearch(e.target.value)} placeholder={tr(lang,'قدرة، اهتمام، أو مسار… مثل قواعد البيانات','Capability, interest, or pathway… e.g. databases')}/><button className="button primary" type="submit">{tr(lang,'استكشف','Explore')}<Arrow size={17}/></button></form>
        <div className="profile-ribbon" aria-label={tr(lang,'أبعاد ملفك','Your profile dimensions')}>{dimensions.map(([Icon,label],i)=><button key={label} aria-pressed={dimension===i} onClick={()=>setDimension(i)}><Icon size={22}/>{label}</button>)}</div><p className="profile-ribbon-detail" aria-live="polite">{dimensions[dimension][2]}</p>
      </div>
      <InferenceDemo lang={lang}/>
    </details>

    <section className="v2-final k-final"><div className="shell"><span className="k-overline">{tr(lang,'ابدأ من حيث أنت','START WHERE YOU ARE')}</span><h2>{tr(lang,'خطوتك القادمة،\nأقرب مما تتصور.','Your next step.\nCloser than you think.')}</h2><button className="button primary" onClick={onProfile}>{tr(lang,'ابدأ بناء ملفك','Build your profile')}</button><button className="v2-demo-link" onClick={onTry}>{tr(lang,'افتح مساحة العمل','Open workspace')}</button></div></section>
  </div>
}

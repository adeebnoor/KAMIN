import {ArrowLeft, ArrowRight, BookOpen, Compass, Fingerprint, GraduationCap, Network, Route, ShieldCheck, Users} from 'lucide-react'

const tr = (lang, ar, en) => lang === 'ar' ? ar : en

function GraphNode({className, Icon, eyebrow, title}) {
  return <div className={`k-network-node ${className}`}>
    <Icon size={19} aria-hidden="true"/>
    <span><small>{eyebrow}</small><strong>{title}</strong></span>
  </div>
}

export default function CompetitiveHero({lang, onSample, onProfile, reportHref}) {
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight
  return <>
    <section id="home" className="k-network-hero">
      <div className="shell k-network-hero-grid">
        <div className="k-network-copy">
          <span className="k-network-overline">{tr(lang,'كامن · شبكة قدرات مدعومة بالدليل','KAMIN · EVIDENCE-BACKED CAPABILITY NETWORK')}</span>
          <h1>{tr(lang,<>أشخاص. اهتمامات.<br/>قدرات. <em>فرص.</em></>,<>People. Interests.<br/>Capabilities. <em>Opportunities.</em></>)}</h1>
          <p>{tr(lang,
            'بدل نسبة توافق غامضة، يربط كامن مقرراتك ومشاريعك واهتماماتك بقدرات ومسارات يمكن تتبعها. ترى أين يوجد الدليل، وأين توجد الفجوة، ولماذا ظهرت التوصية.',
            'Instead of an opaque fit score, Kamin connects your coursework, projects and interests to traceable capabilities and pathways. You can see the evidence, the gap and why a recommendation appeared.'
          )}</p>
          <div className="k-network-actions">
            <button className="button primary" onClick={onSample}><Compass size={19}/>{tr(lang,'جرّب مثالًا حيًا','Try a live example')}</button>
            <button className="button secondary" onClick={onProfile}><Fingerprint size={19}/>{tr(lang,'ابنِ ملف قدراتك','Build your capability profile')}</button>
          </div>
          <a className="k-network-report" href={reportHref}>{tr(lang,'شاهد تقريرًا تجريبيًا','View a sample report')}<Arrow size={17}/></a>
          <div className="k-ai-principle" aria-label={tr(lang,'مبدأ القرار في كامن','Kamin decision principle')}>
            <span><Network size={18}/><b>{tr(lang,'الذكاء يقترح','AI suggests')}</b></span>
            <span><BookOpen size={18}/><b>{tr(lang,'الدليل يبرّر','Evidence justifies')}</b></span>
            <span><Users size={18}/><b>{tr(lang,'الإنسان يقرر','Humans decide')}</b></span>
          </div>
        </div>

        <div className="k-network-visual" aria-label={tr(lang,'مثال بصري لشبكة كامن','Visual example of the Kamin network')}>
          <div className="k-network-window">
            <div className="k-network-window-top">
              <div><span className="k-live-dot"/><strong>{tr(lang,'رحلة في الشبكة','Journey through the network')}</strong></div>
              <small>{tr(lang,'كل علاقة قابلة للتتبع','Every relation is traceable')}</small>
            </div>
            <div className="k-network-stage" role="img" aria-label={tr(lang,'شخص يرتبط بمقرر واهتمام ثم قدرة وفرصة ومشروع تحقق','A person connected to coursework and interest, then to a capability, opportunity and verification project')}>
              <svg viewBox="0 0 720 430" aria-hidden="true" preserveAspectRatio="none">
                <defs>
                  <marker id="kArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L6,3 z"/></marker>
                  <marker id="kArrowGold" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L6,3 z"/></marker>
                </defs>
                <path className="k-link solid" d="M120 230 C180 210 190 135 265 125" markerEnd="url(#kArrow)"/>
                <path className="k-link dashed" d="M120 245 C180 280 205 335 275 335" markerEnd="url(#kArrowGold)"/>
                <path className="k-link solid" d="M330 130 C390 145 405 205 455 220" markerEnd="url(#kArrow)"/>
                <path className="k-link dashed" d="M338 330 C400 310 415 255 458 235" markerEnd="url(#kArrowGold)"/>
                <path className="k-link solid" d="M520 210 C575 180 598 138 645 132" markerEnd="url(#kArrow)"/>
                <path className="k-link solid" d="M520 240 C580 265 600 315 646 320" markerEnd="url(#kArrow)"/>
                <path className="k-link verify" d="M650 305 C610 270 575 230 530 228" markerEnd="url(#kArrowGold)"/>
              </svg>
              <GraphNode className="person" Icon={Users} eyebrow={tr(lang,'أنت','You')} title={tr(lang,'ملفك','Your profile')}/>
              <GraphNode className="course" Icon={GraduationCap} eyebrow={tr(lang,'دليل','Evidence')} title="CPIT-260"/>
              <GraphNode className="interest" Icon={Compass} eyebrow={tr(lang,'سياق','Context')} title={tr(lang,'اهتمام: البيانات','Interest: data')}/>
              <GraphNode className="capability" Icon={Network} eyebrow={tr(lang,'قدرة','Capability')} title={tr(lang,'قواعد البيانات','Databases')}/>
              <GraphNode className="opportunity" Icon={Route} eyebrow={tr(lang,'مسار','Pathway')} title={tr(lang,'محلل بيانات','Data Analyst')}/>
              <GraphNode className="project" Icon={ShieldCheck} eyebrow={tr(lang,'تحقق','Verification')} title={tr(lang,'مشروع عملي','Practical project')}/>
            </div>
            <div className="k-network-legend">
              <span><i className="solid"/>{tr(lang,'دليل مباشر','Direct evidence')}</span>
              <span><i className="dashed"/>{tr(lang,'علاقة استدلالية','Inferred relation')}</span>
              <span><ShieldCheck size={15}/>{tr(lang,'مراجعة بشرية','Human review')}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="shell k-advantage-band">
        <div className="k-advantage-intro"><small>{tr(lang,'لماذا كامن مختلف؟','WHY KAMIN IS DIFFERENT')}</small><strong>{tr(lang,'من بيانات متناثرة إلى قرار يمكن تفسيره ومراجعته.','From scattered data to a decision you can explain and review.')}</strong></div>
        <div className="k-advantage-grid">
          <article><BookOpen size={22}/><div><b>{tr(lang,'دليل لا ادعاء','Evidence, not claims')}</b><span>{tr(lang,'لا مهارة بلا مصدر واضح.','No capability without a source.')}</span></div></article>
          <article><Network size={22}/><div><b>{tr(lang,'شبكة لا قائمة','Network, not a list')}</b><span>{tr(lang,'العلاقات تكشف ما لا تقوله المعلومة وحدها.','Connections reveal what isolated facts cannot.')}</span></div></article>
          <article><ShieldCheck size={22}/><div><b>{tr(lang,'قرار قابل للاعتراض','Contestable decisions')}</b><span>{tr(lang,'يمكن قبول التوصية أو رفضها أو الاعتراض عليها.','Recommendations can be accepted, rejected or contested.')}</span></div></article>
          <article><Fingerprint size={22}/><div><b>{tr(lang,'خصوصية افتراضية','Private by default')}</b><span>{tr(lang,'يبقى ملفك محليًا ما لم تختر المشاركة.','Your profile stays local unless you choose to share.')}</span></div></article>
        </div>
      </div>
    </section>
  </>
}

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Check, ClipboardCheck, Download,
  FileCheck2, Fingerprint, GraduationCap, Languages, LayoutDashboard, LockKeyhole,
  Menu, Plus, SearchCheck, ShieldCheck, Sparkles, Target, Trash2, UploadCloud, X,
} from 'lucide-react'
import { copy } from './i18n.js'
import { demoCourses, GOALS, SECTORS, VAULT_RECORD_TYPES } from './data.js'
import { goalEvidence, inferSkills, judgeOpportunities, mappingCoverage } from './utils/engine.js'
import { extractTranscript } from './utils/transcript.js'

const LEGACY_KEY = 'kamin-pilot-v1'
const LOCAL_KEY = 'kamin-pilot-v2'
const SESSION_KEY = 'kamin-pilot-v2-session'

const createBlankState = () => ({
  schemaVersion: 2,
  records: [],
  courses: [],
  approved: false,
  goal: null,
  sector: null,
  consents: { analyze: false, advisor: false, research: false },
  audit: [],
  skillOverrides: {},
  storageMode: 'session',
})

const migrate = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return null
  if (parsed.schemaVersion === 2) return { ...createBlankState(), ...parsed }
  if (Array.isArray(parsed.courses)) {
    return {
      ...createBlankState(),
      courses: parsed.courses.map((c) => ({ ...c, source: c.source || 'manual' })),
      approved: false,
      audit: [{
        label: 'تم ترحيل بيانات نسخة سابقة وتحتاج مراجعة واعتمادًا جديدًا',
        ts: Date.now(),
      }, ...(Array.isArray(parsed.audit) ? parsed.audit : [])].slice(0, 100),
    }
  }
  return null
}

const getSaved = () => {
  try {
    const session = migrate(JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'))
    if (session) return { ...session, storageMode: 'session' }
    const local = migrate(JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'))
    if (local) return { ...local, storageMode: 'local' }
    const legacy = migrate(JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'))
    if (legacy) return legacy
  } catch {
    // Corrupt browser storage must never block the public pilot.
  }
  return createBlankState()
}

const localized = (value, lang) => typeof value === 'string'
  ? value
  : value?.[lang] || value?.ar || value?.en || ''

const timeText = (ts, lang) => new Intl.DateTimeFormat(
  lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB',
  { dateStyle: 'medium', timeStyle: 'short' },
).format(new Date(ts))

function setMeta(name, content, attr = 'name') {
  const el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (el) el.setAttribute('content', content)
}

function Logo({ compact = false, lang = 'ar' }) {
  return (
    <span className={compact ? 'logo compact' : 'logo'}>
      <img
        src="/kamin-logo-fixed.webp"
        alt={lang === 'ar' ? 'شعار كامن' : 'Kamin logo'}
        loading={compact ? 'lazy' : 'eager'}
        decoding="async"
      />
    </span>
  )
}

function Header({ lang, setLang, onTry }) {
  const t = copy[lang]
  const [open, setOpen] = useState(false)
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight
  const go = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setOpen(false)
  }

  return (
    <header className="site-header">
      <div className="shell header-row">
        <button className="brand" onClick={() => go('home')} aria-label={t.nav.home}>
          <Logo compact lang={lang} />
          <span><strong>{t.name}</strong><small>{t.tagline}</small></span>
        </button>
        <nav id="mobile-nav" className={open ? 'main-nav open' : 'main-nav'} aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
          <button onClick={() => go('example')}>{lang === 'ar' ? 'مثال' : 'Example'}</button>
          <button onClick={() => go('how')}>{t.nav.how}</button>
          <button onClick={() => go('trust')}>{t.nav.trust}</button>
          <button className="nav-primary" onClick={() => { onTry(); setOpen(false) }}>
            {t.nav.app}<Arrow size={16} />
          </button>
        </nav>
        <div className="header-tools">
          <button
            className="language-button"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            <Languages size={18} /><span>{lang === 'ar' ? 'EN' : 'العربية'}</span>
          </button>
          <button
            className="menu-button"
            aria-label={lang === 'ar' ? (open ? 'إغلاق القائمة' : 'فتح القائمة') : (open ? 'Close menu' : 'Open menu')}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  )
}

function Hero({ lang, onTry }) {
  const t = copy[lang]
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight
  return (
    <section id="home" className="hero">
      <div className="shell hero-grid">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={16} />{t.hero.eyebrow}</span>
          <h1>{t.hero.title}</h1>
          <p>{t.hero.text}</p>
          <div className="hero-actions">
            <button className="button primary" onClick={onTry}>{t.hero.cta}<Arrow size={18} /></button>
            <button className="button secondary" onClick={() => document.getElementById('example')?.scrollIntoView({ behavior: 'smooth' })}>
              {t.hero.secondary}
            </button>
          </div>
          <div className="privacy-chip"><ShieldCheck size={18} /><span>{t.hero.trust}</span></div>
        </div>
        <div className="hero-preview" aria-label={lang === 'ar' ? 'معاينة قيمة كامن' : 'Kamin value preview'}>
          <div className="logo-panel"><Logo lang={lang} /></div>
          <div className="float-card top">
            <BadgeCheck size={18} />
            <div><small>{t.hero.previewApplied}</small><strong>{t.hero.previewAppliedValue}</strong></div>
          </div>
          <div className="float-card bottom">
            <SearchCheck size={18} />
            <div><small>{t.hero.previewOutcome}</small><strong>{t.hero.previewOutcomeValue}</strong></div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ValueExample({ lang }) {
  const t = copy[lang].value
  return (
    <section id="example" className="section value-section">
      <div className="shell">
        <div className="section-title">
          <span>01</span>
          <div><small className="example-label">{t.kicker}</small><h2>{t.title}</h2><p>{t.intro}</p></div>
        </div>
        <div className="value-grid">
          <article className="value-cv">
            <small>{lang === 'ar' ? 'السيرة' : 'CV'}</small>
            <h3>{t.cvTitle}</h3>
            <ul>{t.cvItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <article className="value-kamin">
            <small>{copy[lang].name}</small>
            <h3>{t.kaminTitle}</h3>
            <div className="value-rows">
              {t.rows.map(([label, title, evidence], index) => (
                <div className={`value-row tone-${index + 1}`} key={label}>
                  <span>{label}</span>
                  <div><strong>{title}</strong><small>{evidence}</small></div>
                </div>
              ))}
            </div>
          </article>
        </div>
        <div className="value-result"><ShieldCheck size={18} /><p>{t.result}</p></div>
      </div>
    </section>
  )
}

function HowItWorks({ lang }) {
  const t = copy[lang]
  const stepIcons = [UploadCloud, Sparkles, Target]
  return (
    <section id="how" className="section">
      <div className="shell">
        <div className="section-title"><span>02</span><h2>{t.how.title}</h2></div>
        <div className="cards-3">
          {t.how.steps.map(([title, text], i) => {
            const Icon = stepIcons[i]
            return (
              <article className="info-card" key={title}>
                <div className="icon-box"><Icon /></div>
                <small>0{i + 1}</small><h3>{title}</h3><p>{text}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function VaultGrowth({ lang }) {
  const t = copy[lang]
  return (
    <section className="section vault-growth">
      <div className="shell">
        <div className="section-title"><span>03</span><div><h2>{t.vault.title}</h2><p>{t.vault.text}</p></div></div>
        <div className="vault-preview-grid">
          {VAULT_RECORD_TYPES.map((item) => (
            <article className={item.active ? 'vault-preview active' : 'vault-preview locked'} key={item.id}>
              <div className="icon-box">{item.active ? <FileCheck2 /> : <LockKeyhole />}</div>
              <div>
                <small>{lang === 'ar' ? `الطبقة ${item.layer}` : `Layer ${item.layer}`}</small>
                <h3>{item.labels[lang]}</h3>
                <p>{item.active ? t.vault.active : (item.purposeOnly ? t.vault.purpose : t.vault.later)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Trust({ lang }) {
  const t = copy[lang]
  const trustIcons = [Fingerprint, FileCheck2, ShieldCheck, SearchCheck]
  return (
    <section id="trust" className="section trust">
      <div className="shell trust-grid">
        <div className="trust-copy">
          <span className="eyebrow"><LockKeyhole size={16} />Privacy by design</span>
          <h2>{t.trustTitle}</h2><p>{t.compliance.text}</p>
          <div className="compliance-pill"><ShieldCheck size={18} />{t.compliance.title}</div>
        </div>
        <div className="trust-cards">
          {t.trustItems.map(([title, text], i) => {
            const Icon = trustIcons[i]
            return <article key={title}><Icon /><h3>{title}</h3><p>{text}</p></article>
          })}
        </div>
      </div>
    </section>
  )
}

function Landing({ lang, onTry }) {
  return (
    <>
      <Hero lang={lang} onTry={onTry} />
      <ValueExample lang={lang} />
      <HowItWorks lang={lang} />
      <VaultGrowth lang={lang} />
      <Trust lang={lang} />
      <section id="faq" className="section faq-section">
        <div className="shell faq-grid">
          <div className="section-title"><span>04</span><h2>{lang === 'ar' ? 'أسئلة الثقة قبل التجربة' : 'Trust questions before you try it'}</h2></div>
          <div className="faq-list">
            <details>
              <summary>{lang === 'ar' ? 'هل اسم المقرر وحده يكفي لاستنتاج مهارة؟' : 'Can a course title alone create a skill?'}</summary>
              <p>{lang === 'ar'
                ? 'لا. الربط يجب أن يكون عبر رمز المقرر ومخرج تعلم معتمد. المقرر غير المربوط يظهر لك لكنه لا يدخل في الحكم.'
                : 'No. The course code must map through an approved learning outcome. Unmapped courses remain visible but do not affect judgments.'}</p>
            </details>
            <details>
              <summary>{lang === 'ar' ? 'هل يستطيع كامن منعي من دورة؟' : 'Can Kamin block me from a course?'}</summary>
              <p>{lang === 'ar'
                ? 'لا. الحكم غير حاكم، وكل «لا تناسبك» يرافقها نوع السبب وطريق يوضح متى تصبح مناسبة.'
                : 'No. Judgments are non-binding, and every negative result includes its reason type and a path to suitability.'}</p>
            </details>
            <details>
              <summary>{lang === 'ar' ? 'أين تُحفظ بيانات النسخة العامة؟' : 'Where is public-pilot data stored?'}</summary>
              <p>{lang === 'ar'
                ? 'الجلسة المؤقتة هي الافتراضية. ويمكنك اختيار الحفظ على الجهاز. لا يرفع كامن كشف الدرجات إلى خادمه في هذه النسخة.'
                : 'Temporary session storage is the default. You may opt into device storage. Kamin does not upload the transcript to its server in this pilot.'}</p>
            </details>
          </div>
        </div>
      </section>
      <section className="final-cta">
        <div className="shell final-cta-row">
          <div>
            <small>{copy[lang].name}</small>
            <h2>{lang === 'ar' ? 'لا تدع قدرة لها دليل تبقى كامنة.' : 'Do not let evidence-backed capability stay hidden.'}</h2>
            <p>{lang === 'ar' ? 'ابدأ بسجل واحد، راجع الدليل بنفسك، ثم اتخذ قرارك.' : 'Start with one record, review the evidence yourself, then decide.'}</p>
          </div>
          <button className="button light" onClick={onTry}>
            {copy[lang].hero.cta}{lang === 'ar' ? <ArrowLeft /> : <ArrowRight />}
          </button>
        </div>
      </section>
    </>
  )
}

function StorageChoice({ lang, mode, onChange }) {
  const t = copy[lang].app.storage
  return (
    <fieldset className="storage-choice">
      <legend>{t.title}</legend>
      <label className={mode === 'session' ? 'selected' : ''}>
        <input type="radio" name="storage" value="session" checked={mode === 'session'} onChange={() => onChange('session')} />
        <span><strong>{t.session}</strong><small>{t.sessionHelp}</small></span>
      </label>
      <label className={mode === 'local' ? 'selected' : ''}>
        <input type="radio" name="storage" value="local" checked={mode === 'local'} onChange={() => onChange('local')} />
        <span><strong>{t.local}</strong><small>{t.localHelp}</small></span>
      </label>
    </fieldset>
  )
}

function CourseReview({ lang, rows, setRows, consent, onConsent, onApprove, issue }) {
  const t = copy[lang].app
  const [formOpen, setFormOpen] = useState(!rows.length)
  const [form, setForm] = useState({ code: '', name: '', grade: '' })

  const update = (i, key, value) => setRows(rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r))
  const add = () => {
    if (!form.code.trim() || !form.name.trim() || !form.grade.trim()) return
    setRows([...rows, {
      ...form,
      code: form.code.toUpperCase(),
      source: 'manual',
      reviewRequired: false,
    }])
    setForm({ code: '', name: '', grade: '' })
    setFormOpen(false)
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div><small>{t.review}</small><h3>{lang === 'ar' ? `${rows.length} مقررات مستخرجة` : `${rows.length} extracted courses`}</h3></div>
        <button className="text-button" onClick={() => setFormOpen((v) => !v)}><Plus size={17} />{t.addRow}</button>
      </div>
      {issue && <div className="inline-warning" role="status"><SearchCheck size={18} /><span>{issue}</span></div>}
      {formOpen && (
        <div className="manual-row">
          <input aria-label={t.courseCode} placeholder="CPIT-251" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input aria-label={t.courseName} placeholder={t.courseName} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input aria-label={t.grade} placeholder="A / B+ / أ+" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          <button onClick={add}>{t.save}</button>
        </div>
      )}
      {!!rows.length && (
        <div className="table-scroll">
          <table>
            <thead><tr><th>{t.courseCode}</th><th>{t.courseName}</th><th>{t.grade}</th><th>{t.source}</th><th><span className="sr-only">remove</span></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.code}-${i}`} className={r.reviewRequired ? 'row-review' : ''}>
                  <td><input value={r.code} aria-label={`${t.courseCode} ${i + 1}`} onChange={(e) => update(i, 'code', e.target.value)} /></td>
                  <td><input value={localized(r.name, lang)} aria-label={`${t.courseName} ${i + 1}`} onChange={(e) => update(i, 'name', e.target.value)} /></td>
                  <td><input value={r.grade} aria-label={`${t.grade} ${i + 1}`} onChange={(e) => update(i, 'grade', e.target.value)} /></td>
                  <td><span className="source-chip">{r.source || 'manual'}</span>{r.reviewRequired && <small className="review-chip">{lang === 'ar' ? 'تحتاج مراجعة' : 'Review'}</small>}</td>
                  <td><button className="icon-danger" onClick={() => setRows(rows.filter((_, idx) => idx !== i))} aria-label={lang === 'ar' ? `حذف ${r.code}` : `Delete ${r.code}`}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <label className="explicit-consent">
        <input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} />
        <span>{t.consentAnalyze}</span>
      </label>
      <div className="approval">
        <div><FileCheck2 /><span>{lang === 'ar' ? 'لن تدخل أي بيانات في الاستنتاج قبل اعتمادك وموافقتك.' : 'Nothing enters inference before your approval and consent.'}</span></div>
        <button className="button primary" disabled={!rows.length || !consent} onClick={onApprove}><Check size={17} />{t.approve}</button>
      </div>
    </div>
  )
}

function SkillCard({ skill, lang, override, onOverride }) {
  const t = copy[lang].app
  const denied = override === 'denied'
  const groups = [
    [t.applied, skill.appliedEvidence],
    [t.studied, skill.knowledgeEvidence],
  ].filter(([, evidence]) => evidence.length)

  return (
    <article className={denied ? 'skill-card denied-skill' : 'skill-card'}>
      <div className="skill-top">
        <div><small>{skill.confidenceLabel[lang]}</small><h3>{skill.labels[lang]}</h3></div>
        <div className="provisional-score"><strong>{skill.confidence}</strong><span>/100</span></div>
      </div>
      <div className="meter" role="progressbar" aria-label={skill.confidenceLabel[lang]} aria-valuemin="0" aria-valuemax="100" aria-valuenow={skill.confidence}><i style={{ width: `${skill.confidence}%` }} /></div>
      {groups.map(([groupLabel, evidence]) => (
        <div className="evidence-group" key={groupLabel}>
          <small>{groupLabel}</small>
          {evidence.map((e, i) => (
            <div className="evidence-line" key={`${e.code}-${i}`}>
              <BookOpen size={15} />
              <div>
                <strong>{e.code} · {localized(e.name, lang)}</strong>
                <span>{localized(e.learningOutcome, lang)}</span>
              </div>
              <div className="evidence-badges"><b>{e.grade}</b><em>{lang === 'ar' ? e.reliability.ar : e.reliability.en}</em></div>
            </div>
          ))}
        </div>
      ))}
      <div className="skill-verify">
        <button className={override === 'confirmed' ? 'selected' : ''} onClick={() => onOverride(skill.id, 'confirmed')}><Check size={15} />{t.describesMe}</button>
        <button className={override === 'denied' ? 'selected danger-choice' : ''} onClick={() => onOverride(skill.id, 'denied')}><X size={15} />{t.notMe}</button>
      </div>
      {override && <small className="override-state">{override === 'confirmed' ? t.confirmed : t.denied}</small>}
    </article>
  )
}

function FitCard({ item, lang, compared, toggle }) {
  const t = copy[lang].app
  const provider = localized(item.provider, lang)
  return (
    <article className="fit-card">
      <div className="fit-head">
        <div>
          <small>{provider}{item.illustrative ? ` · ${lang === 'ar' ? 'مثال توضيحي' : 'Illustrative'}` : ''}</small>
          <h3>{item.title[lang]}</h3>
        </div>
        <span className={`status ${item.status}`}>{t.fit[item.status]}</span>
      </div>
      {item.score != null && <div className="fit-score"><strong>{item.score}</strong><span>/100 · {item.scoreLabel}</span></div>}
      <div className="why"><h4>{t.why}</h4>{item.reasons.map((r, i) => <p key={i}><Check size={15} />{r}</p>)}</div>
      <div className="gap"><small>{item.gapType}</small><p><strong>{t.becomes}</strong> {item.becomes}</p></div>
      <div className="outcome-box"><BadgeCheck size={17} /><div><strong>{t.outcome}</strong><p>{item.outcome[lang]}</p></div></div>
      <div className="fit-meta"><span>{item.duration[lang]}</span><span>{item.cost[lang]}</span></div>
      {item.providerUrl && <a className="provider-link" href={item.providerUrl} target="_blank" rel="noreferrer">{t.officialSource} ↗</a>}
      <button className={compared ? 'compare-button selected' : 'compare-button'} onClick={() => toggle(item.id)}>
        {compared ? <Check size={16} /> : <Plus size={16} />} {lang === 'ar' ? 'قارن' : 'Compare'}
      </button>
    </article>
  )
}

function Compare({ lang, items }) {
  const t = copy[lang].app
  if (!items.length) {
    return <div className="empty-state"><SearchCheck /><h3>{lang === 'ar' ? 'اختر حتى ثلاث دورات للمقارنة' : 'Choose up to three courses to compare'}</h3></div>
  }
  return (
    <div className="compare-table-wrap">
      <table className="compare-table">
        <thead><tr><th>{lang === 'ar' ? 'البعد' : 'Dimension'}</th>{items.map((item) => <th key={item.id}>{item.title[lang]}</th>)}</tr></thead>
        <tbody>
          <tr><th>{lang === 'ar' ? 'الحكم' : 'Judgment'}</th>{items.map((item) => <td key={item.id}><span className={`status ${item.status}`}>{t.fit[item.status]}</span></td>)}</tr>
          <tr><th>{lang === 'ar' ? 'المؤشر' : 'Indicator'}</th>{items.map((item) => <td key={item.id}>{item.score == null ? '—' : <><strong className="compare-score">{item.score}/100</strong><small className="block-note">{item.scoreLabel}</small></>}</td>)}</tr>
          <tr><th>{lang === 'ar' ? 'نوع الفجوة' : 'Gap type'}</th>{items.map((item) => <td key={item.id}>{item.gapType}</td>)}</tr>
          <tr><th>{t.outcome}</th>{items.map((item) => <td key={item.id}>{item.outcome[lang]}</td>)}</tr>
          <tr><th>{lang === 'ar' ? 'المدة' : 'Duration'}</th>{items.map((item) => <td key={item.id}>{item.duration[lang]}</td>)}</tr>
          <tr><th>{lang === 'ar' ? 'الكلفة' : 'Cost'}</th>{items.map((item) => <td key={item.id}>{item.cost[lang]}</td>)}</tr>
        </tbody>
      </table>
    </div>
  )
}

function Audit({ lang, entries }) {
  return (
    <div className="panel audit-list">
      {entries.length
        ? entries.map((e, i) => <div className="audit-item" key={`${e.ts}-${i}`}><ClipboardCheck /><div><strong>{e.label}</strong><small>{timeText(e.ts, lang)}</small></div></div>)
        : <p>{lang === 'ar' ? 'لا توجد أحداث بعد.' : 'No events yet.'}</p>}
    </div>
  )
}

function SystemDialog({ lang, dialog, onCancel }) {
  if (!dialog) return null
  return (
    <div className="system-dialog-backdrop" role="presentation">
      <div className="system-dialog" role="alertdialog" aria-modal="true" aria-labelledby="system-dialog-title">
        <ShieldCheck size={28} />
        <h3 id="system-dialog-title">{dialog.title}</h3>
        <p>{dialog.message}</p>
        <div className="dialog-actions">
          <button className="button secondary" onClick={onCancel}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
          {dialog.onConfirm && <button className="button danger" onClick={dialog.onConfirm}>{lang === 'ar' ? 'متابعة' : 'Continue'}</button>}
        </div>
      </div>
    </div>
  )
}

function VaultScreen({ lang, state, onWithdraw }) {
  const t = copy[lang]
  const education = state.records.find((r) => r.type === 'education')
  return (
    <div className="vault-screen-grid">
      {VAULT_RECORD_TYPES.map((item) => {
        const available = item.id === 'education' && !!education
        return (
          <article className={available ? 'vault-record available' : 'vault-record locked'} key={item.id}>
            <div className="vault-record-head">
              <div className="icon-box">{available ? <FileCheck2 /> : <LockKeyhole />}</div>
              <span>{lang === 'ar' ? `الطبقة ${item.layer}` : `Layer ${item.layer}`}</span>
            </div>
            <h3>{item.labels[lang]}</h3>
            {available
              ? <><p>{lang === 'ar' ? `${state.courses.length} مقررات · أودع بإرادتك` : `${state.courses.length} courses · deposited by you`}</p><button className="text-danger" onClick={onWithdraw}><Trash2 size={15} />{lang === 'ar' ? 'سحب هذا السجل' : 'Withdraw this record'}</button></>
              : <p>{item.active ? (lang === 'ar' ? 'لم تودعه بعد' : 'Not deposited yet') : (item.purposeOnly ? t.vault.purpose : t.vault.later)}</p>}
          </article>
        )
      })}
    </div>
  )
}

function GoalPicker({ lang, state, setState, log }) {
  const t = copy[lang].app
  const visibleGoals = Object.entries(GOALS).filter(([, goal]) => !state.sector || goal.sectors.includes(state.sector))

  return (
    <div className="goal-picker">
      <label>
        <span>{lang === 'ar' ? 'قطاع الاهتمام — سياق فقط، لا يغيّر الحكم' : 'Sector of interest — context only, never changes fit'}</span>
        <select value={state.sector || ''} onChange={(e) => {
          const sector = e.target.value || null
          setState((s) => ({ ...s, sector }))
          log(lang === 'ar' ? 'تغيير مرشح القطاع (دون تغيير الحكم)' : 'Sector filter changed (judgment unchanged)')
        }}>
          <option value="">{lang === 'ar' ? 'كل القطاعات' : 'All sectors'}</option>
          {Object.entries(SECTORS).map(([id, labels]) => <option key={id} value={id}>{labels[lang]}</option>)}
        </select>
      </label>
      <div className="goal-options">
        {visibleGoals.map(([id, goal]) => (
          <button key={id} className={state.goal === id ? 'active' : ''} onClick={() => {
            setState((s) => ({ ...s, goal: id }))
            log(lang === 'ar' ? `اختيار هدف: ${goal.labels.ar}` : `Goal selected: ${goal.labels.en}`)
          }}><Target size={16} />{goal.labels[lang]}</button>
        ))}
      </div>
      <button className={state.goal == null ? 'not-sure active' : 'not-sure'} onClick={() => {
        setState((s) => ({ ...s, goal: null }))
        log(lang === 'ar' ? 'الهدف: لا أعرف بعد' : 'Goal: not sure yet')
      }}>{t.notSure}</button>
    </div>
  )
}

function KaminApp({ lang, onClose }) {
  const t = copy[lang]
  const [state, setState] = useState(getSaved)
  const routeView = window.location.hash.match(/^#\/app\/([a-z-]+)/)?.[1]
  const [view, setView] = useState(routeView || (state.approved ? 'dashboard' : 'start'))
  const [draft, setDraft] = useState(state.approved ? state.courses : [])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [compareIds, setCompareIds] = useState([])
  const [notice, setNotice] = useState('')
  const [issue, setIssue] = useState('')
  const [dialog, setDialog] = useState(null)
  const fileRef = useRef(null)
  const dialogRef = useRef(null)
  const closeRef = useRef(null)

  const rawSkills = useMemo(() => state.approved ? inferSkills(state.courses) : [], [state.approved, state.courses])
  const activeSkills = useMemo(
    () => rawSkills.filter((skill) => state.skillOverrides[skill.id] !== 'denied'),
    [rawSkills, state.skillOverrides],
  )
  const coverage = useMemo(() => mappingCoverage(state.courses), [state.courses])
  const recs = useMemo(() => state.approved ? judgeOpportunities(activeSkills, state.goal, lang) : [], [activeSkills, state.approved, state.goal, lang])
  const compared = recs.filter((r) => compareIds.includes(r.id))
  const goalState = useMemo(() => goalEvidence(activeSkills, state.goal, lang), [activeSkills, state.goal, lang])

  useEffect(() => {
    if (state.storageMode === 'local') {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
      sessionStorage.removeItem(SESSION_KEY)
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
      localStorage.removeItem(LOCAL_KEY)
    }
    localStorage.removeItem(LEGACY_KEY)
  }, [state])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!dialog) return
    requestAnimationFrame(() => dialogRef.current?.querySelector('.system-dialog button')?.focus())
  }, [dialog])

  useEffect(() => {
    const previous = document.activeElement
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => closeRef.current?.focus())

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ) || [])]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = oldOverflow
      previous?.focus?.()
    }
  }, [onClose])

  useEffect(() => {
    const syncFromHash = () => {
      const match = window.location.hash.match(/^#\/app\/([a-z-]+)/)
      if (match) setView(match[1])
    }
    window.addEventListener('popstate', syncFromHash)
    window.addEventListener('hashchange', syncFromHash)
    return () => {
      window.removeEventListener('popstate', syncFromHash)
      window.removeEventListener('hashchange', syncFromHash)
    }
  }, [])

  const goView = (id, replace = false) => {
    setView(id)
    const url = `#/app/${id}`
    if (window.location.hash !== url) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', url)
    }
  }

  const log = (label) => setState((s) => ({
    ...s,
    audit: [{ label, ts: Date.now() }, ...s.audit].slice(0, 100),
  }))

  const changeStorage = (mode) => {
    setState((s) => ({ ...s, storageMode: mode }))
    setNotice(lang === 'ar'
      ? (mode === 'session' ? 'الجلسة المؤقتة مفعّلة.' : 'اخترت الحفظ على هذا الجهاز.')
      : (mode === 'session' ? 'Temporary session storage enabled.' : 'You chose storage on this device.'))
  }

  const loadDemo = () => {
    setDraft(demoCourses)
    setIssue('')
    setState((s) => ({ ...s, consents: { ...s.consents, analyze: false } }))
    goView('review')
    log(lang === 'ar' ? 'تحميل بيانات تجريبية' : 'Synthetic demo loaded')
  }

  const upload = async (file) => {
    if (!file) return
    setProcessing(true)
    setProgress(2)
    setIssue('')
    try {
      const result = await extractTranscript(file, setProgress)
      setDraft(result.courses)
      setState((s) => ({ ...s, consents: { ...s.consents, analyze: false } }))
      setIssue(result.courses.length ? '' : t.app.noExtraction)
      goView('review')
      log(lang === 'ar' ? `قراءة ملف محلي: ${file.name}` : `Local file read: ${file.name}`)
    } catch (err) {
      setDraft([])
      setIssue(err?.code === 'LOCAL_OCR_NOT_INSTALLED' ? t.app.ocrBlocked : t.app.noExtraction)
      goView('review')
      log(lang === 'ar' ? 'تعذر استخراج الملف دون طرف خارجي' : 'Extraction stopped rather than using an external service')
    } finally {
      setProcessing(false)
      setProgress(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const setAnalyzeConsent = (checked) => {
    setState((s) => ({
      ...s,
      approved: checked ? s.approved : false,
      consents: { ...s.consents, analyze: checked },
    }))
    log(lang === 'ar' ? (checked ? 'منح موافقة تحليل السجل' : 'سحب موافقة تحليل السجل') : (checked ? 'Transcript analysis consent granted' : 'Transcript analysis consent withdrawn'))
  }

  const approve = () => {
    if (!state.consents.analyze || !draft.length) return
    const now = Date.now()
    const record = {
      id: `education-${now}`,
      type: 'education',
      layer: 1,
      source: draft.some((r) => r.source === 'demo') ? 'demo' : 'user-upload',
      grantedAt: now,
    }
    setState((s) => ({
      ...s,
      courses: draft,
      records: [record, ...s.records.filter((r) => r.type !== 'education')],
      approved: true,
      skillOverrides: {},
      audit: [{
        label: lang === 'ar' ? 'اعتماد السجل وإعادة الحساب' : 'Transcript approved and recalculated',
        ts: now,
      }, ...s.audit].slice(0, 100),
    }))
    goView('dashboard')
    setNotice(lang === 'ar' ? 'تم اعتماد السجل. سيستخدم كامن فقط الروابط المعتمدة المناسبة لمصدر السجل.' : 'Record approved. Kamin will use only mappings approved for this record source.')
  }

  const toggleCompare = (id) => setCompareIds((ids) => ids.includes(id)
    ? ids.filter((x) => x !== id)
    : (ids.length < 3 ? [...ids, id] : ids))

  const setSkillOverride = (id, value) => {
    const affected = recs.filter((r) => r.requires?.includes(id) || r.teaches?.includes(id)).length
    setState((s) => ({ ...s, skillOverrides: { ...s.skillOverrides, [id]: value } }))
    log(lang === 'ar' ? `مراجعة مهارة: ${id} = ${value}` : `Skill review: ${id} = ${value}`)
    setNotice(lang === 'ar'
      ? `تم تحديث ملف المهارة؛ سيعاد حساب ${affected} أحكام مرتبطة بها.`
      : `Skill profile updated; ${affected} related judgments will be recalculated.`)
  }

  const exportProfile = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: state.schemaVersion,
      records: state.records,
      courses: state.courses,
      skills: rawSkills,
      judgments: recs,
      consents: state.consents,
      audit: state.audit,
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'kamin-profile.json'
    a.click()
    URL.revokeObjectURL(url)
    log(lang === 'ar' ? 'تصدير الملف' : 'Profile exported')
  }

  const deleteAll = () => setDialog({
    title: lang === 'ar' ? 'حذف بيانات الجلسة' : 'Delete session data',
    message: t.app.deleteConfirm,
    onConfirm: () => {
      localStorage.removeItem(LOCAL_KEY)
      sessionStorage.removeItem(SESSION_KEY)
      setState(createBlankState())
      setDraft([])
      setCompareIds([])
      setDialog(null)
      goView('start', true)
    },
  })

  const withdrawEducation = () => setDialog({
    title: lang === 'ar' ? 'سحب السجل التعليمي' : 'Withdraw education record',
    message: lang === 'ar'
      ? 'سيختفي أثر السجل من المهارات والأحكام فورًا، وسيُسجّل السحب في سجل الاستخدام.'
      : 'Its effect will be removed from skills and judgments immediately, and the withdrawal will be recorded.',
    onConfirm: () => {
      setState((s) => ({
        ...s,
        records: s.records.filter((r) => r.type !== 'education'),
        courses: [],
        approved: false,
        skillOverrides: {},
        consents: { ...s.consents, analyze: false },
        audit: [{ label: lang === 'ar' ? 'سحب السجل التعليمي' : 'Education record withdrawn', ts: Date.now() }, ...s.audit],
      }))
      setDraft([])
      setDialog(null)
      goView('vault')
    },
  })

  const nav = [
    ['dashboard', LayoutDashboard, t.app.dashboard],
    ['skills', GraduationCap, t.app.skills],
    ['courses', BookOpen, t.app.courses],
    ['compare', SearchCheck, t.app.compare],
    ['vault', FileCheck2, t.app.vault],
    ['privacy', ShieldCheck, t.app.privacy],
    ['audit', ClipboardCheck, t.app.audit],
  ]

  const bottomNav = nav.filter(([id]) => ['dashboard', 'skills', 'courses', 'vault', 'privacy', 'audit'].includes(id))
  const firstDecision = recs.find((r) => r.status === 'yes' || r.status === 'conditional') || recs[0]

  return (
    <div className="app-overlay" role="presentation">
      <div className="app-shell" role="dialog" aria-modal="true" aria-labelledby="kamin-app-title" ref={dialogRef}>
        <aside className="app-sidebar">
          <div className="app-brand"><Logo compact lang={lang} /><div><strong>{t.name}</strong><small>{t.tagline}</small></div></div>
          <nav aria-label={lang === 'ar' ? 'شاشات كامن' : 'Kamin screens'}>
            {nav.map(([id, Icon, label]) => (
              <button
                key={id}
                disabled={!state.approved && !['privacy', 'audit', 'vault'].includes(id)}
                className={view === id ? 'active' : ''}
                onClick={() => goView(id)}
              ><Icon size={18} />{label}</button>
            ))}
          </nav>
          <div className="sidebar-trust"><ShieldCheck /><span>{lang === 'ar' ? 'المعالجة محلية في النسخة العامة' : 'Local processing in the public pilot'}</span></div>
        </aside>

        <div className="app-main">
          <div className="app-topbar">
            <div><small id="kamin-app-title">{t.app.title}</small><strong>{state.approved ? (lang === 'ar' ? 'ملف معتمد من الطالب' : 'Student-approved profile') : (lang === 'ar' ? 'نسخة تجريبية عامة' : 'Public pilot')}</strong></div>
            <button className="icon-button" ref={closeRef} onClick={onClose} aria-label={t.app.close}><X /></button>
          </div>

          {notice && <div className="toast" role="status" aria-live="polite"><Check size={18} /><span>{notice}</span></div>}

          <div className="app-content-wrap" role="document">
            {view === 'start' && (
              <section className="app-content" aria-labelledby="start-title">
                <div className="app-title"><small>01</small><h2 id="start-title">{t.app.title}</h2><p>{t.app.intro}</p></div>
                <StorageChoice lang={lang} mode={state.storageMode} onChange={changeStorage} />
                <div className="start-grid">
                  <button className="start-card" onClick={loadDemo}><div className="start-icon"><Sparkles /></div><h3>{t.app.demo}</h3><p>{lang === 'ar' ? 'شاهد الرحلة كاملة ببيانات اصطناعية.' : 'See the full journey with synthetic data.'}</p></button>
                  <button className="start-card" onClick={() => fileRef.current?.click()}><div className="start-icon"><UploadCloud /></div><h3>{t.app.upload}</h3><p>{t.app.uploadHelp}</p></button>
                </div>
                <label className="sr-only" htmlFor="transcript-file">{t.app.upload}</label>
                <input id="transcript-file" className="sr-only" ref={fileRef} type="file" accept=".pdf,image/*,.txt" onChange={(e) => upload(e.target.files?.[0])} />
                {processing && (
                  <div className="processing" role="status" aria-live="polite">
                    <div className="processing-row"><div className="spinner" /><strong>{t.app.processing}</strong><b>{progress}%</b></div>
                    <div className="progress" aria-label={lang === 'ar' ? 'تقدم قراءة الملف' : 'File reading progress'}><i style={{ width: `${progress}%` }} /></div>
                    <small>{t.app.localOnly}</small>
                  </div>
                )}
                <div className="privacy-promise"><ShieldCheck /><div><strong>{lang === 'ar' ? 'وعد النسخة العامة' : 'Public-pilot promise'}</strong><p>{t.app.localOnly}</p></div></div>
              </section>
            )}

            {view === 'review' && (
              <section className="app-content" aria-labelledby="review-title">
                <div className="app-title"><small>02</small><h2 id="review-title">{t.app.review}</h2><p>{lang === 'ar' ? 'التقنية تستخرج؛ أنت تعتمد. صحح أي سطر قبل أن يصبح دليلًا.' : 'Technology extracts; you approve. Correct any row before it becomes evidence.'}</p></div>
                <CourseReview
                  lang={lang}
                  rows={draft}
                  setRows={setDraft}
                  consent={state.consents.analyze}
                  onConsent={setAnalyzeConsent}
                  onApprove={approve}
                  issue={issue}
                />
              </section>
            )}

            {state.approved && view === 'dashboard' && (
              <section className="app-content" aria-labelledby="dashboard-title">
                <div className="app-title"><small>{t.app.dashboard}</small><h2 id="dashboard-title">{lang === 'ar' ? 'هذه قدراتك كما يدعمها الدليل الآن' : 'Capabilities supported by your evidence right now'}</h2><p>{lang === 'ar' ? 'المهارة لا تظهر من اسم المقرر وحده، والمؤشر ليس درجة على شخصك.' : 'A course title alone never creates a skill, and the indicator is not a score of you.'}</p></div>
                <div className="session-banner"><ShieldCheck size={17} /><span>{state.storageMode === 'session' ? t.app.storage.sessionHelp : t.app.storage.localHelp}</span></div>

                {(coverage.unmapped.length > 0 || coverage.unknownGrade.length > 0) && (
                  <div className="quality-banner" role="status">
                    <SearchCheck size={18} />
                    <div>
                      <strong>{lang === 'ar' ? 'جودة الدليل قبل عدد المهارات' : 'Evidence quality before skill count'}</strong>
                      <p>{coverage.unmapped.length > 0 && `${coverage.unmapped.length} ${lang === 'ar' ? 'مقرر غير مربوط بعد ولن يدخل في الحكم.' : 'course(s) are not yet mapped and will not affect judgments.'}`} {coverage.unknownGrade.length > 0 && `${coverage.unknownGrade.length} ${lang === 'ar' ? 'درجة تحتاج مراجعة.' : 'grade(s) need review.'}`}</p>
                    </div>
                  </div>
                )}

                <div className="metrics">
                  <article><span>{lang === 'ar' ? 'مهارات مدعومة بالدليل' : 'Evidence-backed skills'}</span><strong>{activeSkills.length}</strong><small>{lang === 'ar' ? 'بعد استبعاد المنفي' : 'after denied skills are excluded'}</small></article>
                  <article><span>{lang === 'ar' ? 'أدلة تطبيق' : 'Applied evidence'}</span><strong>{activeSkills.reduce((sum, s) => sum + s.appliedEvidence.length, 0)}</strong><small>{lang === 'ar' ? 'منفصلة عن «درست»' : 'separate from studied evidence'}</small></article>
                  <article><span>{lang === 'ar' ? 'مقررات قابلة للاستخدام' : 'Usable mapped courses'}</span><strong>{coverage.usable.length}</strong><small>{lang === 'ar' ? 'من روابط مناسبة للمصدر' : 'from source-appropriate mappings'}</small></article>
                </div>

                <div className="dashboard-grid">
                  <div className="panel">
                    <div className="panel-head"><div><small>{t.app.skills}</small><h3>{lang === 'ar' ? 'الدليل قبل الادعاء' : 'Evidence before claims'}</h3></div><button className="text-button" onClick={() => goView('skills')}>{lang === 'ar' ? 'كل المهارات' : 'All skills'}</button></div>
                    {activeSkills.length ? activeSkills.slice(0, 4).map((s) => (
                      <div className="skill-row" key={s.id}><span>{s.labels[lang]}</span><div><i style={{ width: `${s.confidence}%` }} /></div><b>{s.confidence}</b></div>
                    )) : <p className="muted-note">{lang === 'ar' ? 'لا توجد مهارة يمكن استنتاجها من ربط معتمد لهذا المصدر حتى الآن.' : 'No skill can be inferred from an approved mapping for this source yet.'}</p>}
                  </div>
                  <div className="panel">
                    <div className="panel-head"><div><small>{t.app.goal}</small><h3>{lang === 'ar' ? 'ما الذي تريد الوصول إليه؟' : 'Where do you want to go?'}</h3></div></div>
                    <GoalPicker lang={lang} state={state} setState={setState} log={log} />
                  </div>
                </div>

                <div className="panel claim-evidence">
                  <div className="panel-head"><div><small>{lang === 'ar' ? 'القول مقابل الدليل' : 'Claim vs evidence'}</small><h3>{state.goal ? GOALS[state.goal]?.labels?.[lang] : t.app.notSure}</h3></div></div>
                  {!state.goal
                    ? <p>{t.app.noGoal}</p>
                    : <div className="claim-columns">
                      <div><strong>{lang === 'ar' ? 'ما يدعمه سجلك' : 'What your record supports'}</strong>{goalState.evidence.length ? goalState.evidence.map((s) => <span key={s.id}><Check size={14} />{s.labels[lang]}</span>) : <p>{lang === 'ar' ? 'لا نرى بعد دليلًا مرتبطًا بهذا الهدف.' : 'We do not yet see evidence linked to this goal.'}</p>}</div>
                      <div><strong>{lang === 'ar' ? 'ما يزال يحتاج دليلًا' : 'Still needs evidence'}</strong>{goalState.missing.map((label) => <span key={label}><SearchCheck size={14} />{label}</span>)}</div>
                    </div>}
                </div>

                {firstDecision && (
                  <div className="panel decision">
                    <div className="decision-head"><div><small>{lang === 'ar' ? 'مثال حكم حالي' : 'Current judgment example'}</small><h3>{firstDecision.title[lang]}</h3></div><span className={`status ${firstDecision.status}`}>{t.app.fit[firstDecision.status]}</span></div>
                    {firstDecision.score != null && <div className="decision-score-inline"><strong>{firstDecision.score}/100</strong><small>{firstDecision.scoreLabel}</small></div>}
                    <div className="decision-body-simple">{firstDecision.reasons.map((r, i) => <p key={i}><Check size={15} />{r}</p>)}<p className="becomes"><strong>{t.app.becomes}</strong> {firstDecision.becomes}</p></div>
                    <button className="button primary" onClick={() => goView('courses')}>{lang === 'ar' ? 'استكشف كل الدورات' : 'Explore all courses'}</button>
                  </div>
                )}
              </section>
            )}

            {state.approved && view === 'skills' && (
              <section className="app-content" aria-labelledby="skills-title">
                <div className="app-title"><small>{t.app.skills}</small><h2 id="skills-title">{lang === 'ar' ? 'كل مهارة مرتبطة بدليل ومخرج تعلم' : 'Every skill is tied to evidence and a learning outcome'}</h2><p>{lang === 'ar' ? 'يمكنك تأكيد المهارة أو نفيها. النفي يخرجها من الأحكام فورًا.' : 'You may confirm or deny a skill. Denial removes it from judgments immediately.'}</p></div>
                <div className="skills-grid">
                  {rawSkills.length
                    ? rawSkills.map((s) => <SkillCard key={s.id} skill={s} lang={lang} override={state.skillOverrides[s.id]} onOverride={setSkillOverride} />)
                    : <div className="empty-state"><SearchCheck /><h3>{lang === 'ar' ? 'لا توجد مهارات من ربط معتمد لهذا المصدر بعد' : 'No skills from an approved mapping for this source yet'}</h3><p>{lang === 'ar' ? 'هذا أكثر أمانًا من استنتاج مهارات بكلمات مفتاحية من اسم المقرر.' : 'That is safer than inferring skills from course-title keywords.'}</p></div>}
                </div>
              </section>
            )}

            {state.approved && view === 'courses' && (
              <section className="app-content" aria-labelledby="courses-title">
                <div className="app-title app-title-row">
                  <div><small>{t.app.courses}</small><h2 id="courses-title">{lang === 'ar' ? 'الحكم مع السبب والطريق والنتيجة' : 'Judgment, reason, path and outcome'}</h2><p>{!state.goal ? t.app.noGoal : (lang === 'ar' ? 'القطاع سياق فقط ولا يغير الملاءمة.' : 'Sector is context only and never changes fit.')}</p></div>
                  <button className="button secondary" onClick={() => goView('compare')}>{t.app.compare} ({compareIds.length}/3)</button>
                </div>
                <div className="fit-grid">{recs.map((r) => <FitCard key={r.id} item={r} lang={lang} compared={compareIds.includes(r.id)} toggle={toggleCompare} />)}</div>
              </section>
            )}

            {state.approved && view === 'compare' && (
              <section className="app-content" aria-labelledby="compare-title">
                <div className="app-title"><small>{t.app.compare}</small><h2 id="compare-title">{lang === 'ar' ? 'نفس الأبعاد، قرار أسهل' : 'Same dimensions, easier decision'}</h2><p>{lang === 'ar' ? 'المؤشر مبدئي وغير معاير حتى اكتمال الدراسة الاسترجاعية.' : 'The indicator is provisional and uncalibrated until retrospective validation is complete.'}</p></div>
                <Compare lang={lang} items={compared} />
              </section>
            )}

            {view === 'vault' && (
              <section className="app-content" aria-labelledby="vault-title">
                <div className="app-title"><small>{t.app.vault}</small><h2 id="vault-title">{lang === 'ar' ? '10 أنواع سجلات، لكن واحدًا فقط مفعّل الآن' : 'Ten record types, but only one is active now'}</h2><p>{lang === 'ar' ? 'الرؤية كاملة، والنطاق التنفيذي ضيق عمدًا.' : 'The vision is visible; the operational scope is deliberately narrow.'}</p></div>
                <VaultScreen lang={lang} state={state} onWithdraw={withdrawEducation} />
              </section>
            )}

            {view === 'privacy' && (
              <section className="app-content" aria-labelledby="privacy-title">
                <div className="app-title"><small>{t.app.privacy}</small><h2 id="privacy-title">{lang === 'ar' ? 'أنت صاحب القرار على بياناتك' : 'You control your data'}</h2><p>{lang === 'ar' ? 'كل غرض له موافقته، والسحب واضح بقدر المنح.' : 'Each purpose has its own consent, and withdrawal is as clear as granting it.'}</p></div>
                <div className="privacy-layout">
                  <div className="panel">
                    <div className="panel-head"><div><small>{t.app.consent}</small><h3>{lang === 'ar' ? 'الموافقات ليست مفعّلة مسبقًا' : 'Consents are never pre-enabled'}</h3></div></div>
                    <div className="consents">
                      {Object.keys(state.consents).map((key) => (
                        <label key={key}>
                          <span><strong>{t.app.consentItems[key]}</strong><small>{key === 'analyze' ? (lang === 'ar' ? 'سحبها يوقف الاستنتاج فورًا ويحتاج اعتمادًا جديدًا للعودة.' : 'Withdrawal stops inference immediately and requires re-approval to resume.') : (lang === 'ar' ? 'اختياري وغير مفعّل تشغيليًا في النسخة العامة.' : 'Optional and not operational in the public pilot.')}</small></span>
                          <input type="checkbox" checked={!!state.consents[key]} onChange={(e) => {
                            if (key === 'analyze') setAnalyzeConsent(e.target.checked)
                            else {
                              setState((s) => ({ ...s, consents: { ...s.consents, [key]: e.target.checked } }))
                              log(lang === 'ar' ? `تغيير موافقة: ${t.app.consentItems[key]}` : `Consent changed: ${t.app.consentItems[key]}`)
                            }
                          }} />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="panel privacy-actions">
                    <ShieldCheck size={30} /><h3>{lang === 'ar' ? 'ملفك تحت سيطرتك' : 'Your profile stays under your control'}</h3>
                    <p>{state.storageMode === 'session' ? t.app.storage.sessionHelp : t.app.storage.localHelp}</p>
                    <button className="button secondary" onClick={exportProfile}><Download size={17} />{t.app.export}</button>
                    <button className="button danger" onClick={deleteAll}><Trash2 size={17} />{t.app.delete}</button>
                  </div>
                </div>
              </section>
            )}

            {view === 'audit' && (
              <section className="app-content" aria-labelledby="audit-title">
                <div className="app-title"><small>{t.app.audit}</small><h2 id="audit-title">{lang === 'ar' ? 'كشف حساب بياناتك' : 'Your data statement'}</h2><p>{lang === 'ar' ? 'كل تغيير مهم في النسخة العامة يظهر هنا.' : 'Every material change in the public pilot appears here.'}</p></div>
                <Audit lang={lang} entries={state.audit} />
              </section>
            )}
          </div>

          <nav className="bottom-nav" aria-label={lang === 'ar' ? 'تنقل التطبيق على الجوال' : 'Mobile app navigation'}>
            {bottomNav.map(([id, Icon, label]) => (
              <button key={id} className={view === id ? 'active' : ''} disabled={!state.approved && !['privacy', 'audit', 'vault'].includes(id)} onClick={() => goView(id)}>
                <Icon size={18} /><span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
        <SystemDialog lang={lang} dialog={dialog} onCancel={() => setDialog(null)} />
      </div>
    </div>
  )
}

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('kamin-lang') === 'en' ? 'en' : 'ar')
  const [appOpen, setAppOpen] = useState(() => window.location.hash.startsWith('#/app/'))

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('kamin-lang', lang)
    const description = lang === 'ar'
      ? 'كامن يحوّل السجل الأكاديمي إلى أدلة مهارية مفسّرة تساعد الطالب على فهم ما طبّقه وما درسه واتخاذ قرار تعلم أوضح.'
      : 'Kamin turns academic records into explainable skill evidence, separating applied from studied learning to support clearer decisions.'
    document.title = lang === 'ar' ? 'كامن | خزنة قدراتك' : 'Kamin | Your capability vault'
    setMeta('description', description)
    setMeta('og:title', document.title, 'property')
    setMeta('og:description', description, 'property')
    setMeta('og:locale', lang === 'ar' ? 'ar_SA' : 'en_US', 'property')
    setMeta('twitter:title', document.title)
    setMeta('twitter:description', description)
  }, [lang])

  useEffect(() => {
    const sync = () => setAppOpen(window.location.hash.startsWith('#/app/'))
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  const openApp = () => {
    setAppOpen(true)
    if (!window.location.hash.startsWith('#/app/')) window.history.pushState({}, '', '#/app/start')
  }

  const closeApp = () => {
    setAppOpen(false)
    window.history.pushState({}, '', `${window.location.pathname}${window.location.search}`)
  }

  return (
    <>
      <Header lang={lang} setLang={setLang} onTry={openApp} />
      <main id="main"><Landing lang={lang} onTry={openApp} /></main>
      <footer>
        <div className="shell footer-row">
          <div><Logo compact lang={lang} /><span>© 2026 {copy[lang].name}</span></div>
          <div>
            <a href="/privacy.html">{lang === 'ar' ? 'الخصوصية' : 'Privacy'}</a>
            <span>{lang === 'ar' ? 'مصمم وفق مبادئ نظام حماية البيانات الشخصية — ليس اعتمادًا رسميًا.' : 'Designed around PDPL principles — not an official certification.'}</span>
          </div>
        </div>
      </footer>
      {appOpen && <KaminApp lang={lang} onClose={closeApp} />}
    </>
  )
}

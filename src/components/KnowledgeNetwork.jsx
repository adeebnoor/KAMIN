import { useState } from 'react'
import { BookOpen, Fingerprint, Target, GraduationCap, BriefcaseBusiness, Link2 } from 'lucide-react'

const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const label = (value, lang) => typeof value === 'string' ? value : value?.[lang] || ''

export default function KnowledgeNetwork({ match, lang, goalLabel, demo = false }) {
  const [selected, setSelected] = useState('profile')
  const paths = match?.semanticPaths?.filter(p => p.kind === 'capability-match') || []
  const [pathIndex, setPathIndex] = useState(0)
  const path = paths[pathIndex] || paths[0]
  const nodes = [
    { id: 'record', x: 19, y: 24, Icon: BookOpen, title: path?.courseCode || tr(lang, 'أضف سجلّك', 'Add your record'), type: tr(lang, 'مصدر المعلومة', 'Evidence source'), text: path ? `${label(path.courseName, lang)} · ${tr(lang, 'راجعه الطالب؛ لم تتحقق الجامعة منه.', 'Student-reviewed; not institutionally verified.')}` : tr(lang, 'لن نضع مقررًا أو مهارة في ملفك دون مصدر. ابدأ بسجلك ثم راجع الاستخراج.', 'We will not invent a course or skill. Add your record and review the extraction.') },
    { id: 'goal', x: 19, y: 76, Icon: Target, title: goalLabel || tr(lang, 'هدفك القادم', 'Your next goal'), type: tr(lang, 'اختيارك أنت', 'Your choice'), text: tr(lang, 'الهدف يضع الفرص في سياق ما تريد الوصول إليه. تغييره لا يغيّر أدلتك أو قدراتك.', 'Your goal puts opportunities in context. Changing it does not change your evidence or capabilities.') },
    { id: 'profile', x: 50, y: 50, Icon: Fingerprint, title: tr(lang, demo ? 'ملف سارة' : 'ملف قدراتك', demo ? 'Sara’s profile' : 'Your profile'), type: tr(lang, 'أنت في المركز', 'You at the center'), text: tr(lang, 'نربط سجلك بقدراتك وهدفك. لكل علاقة مصدر، ويمكنك مراجعتها؛ ليست مجرد كلمات متشابهة.', 'Your record, capabilities and goal form a connected profile. Every evidence relationship has a traceable source; this is more than keyword similarity.') },
    { id: 'skill', x: 81, y: 24, Icon: GraduationCap, title: path ? label(path.capabilityLabel, lang) : tr(lang, 'قدرة تحتاج دليلًا', 'Evidence needed'), type: tr(lang, 'ربط مقرر بقدرة', 'Course-to-skill link'), text: path ? tr(lang, `يرتبط ${path.courseCode} بهذه القدرة عبر خريطة مقررات تجريبية. الدرجة وحدها لا تثبت الإتقان المهني.`, `${path.courseCode} links to this capability through the pilot course map. A grade alone does not prove professional mastery.`) : tr(lang, 'غياب الدليل لا يعني غياب القدرة. أضف معلومة صحيحة يمكن مراجعتها.', 'Missing evidence is not a missing ability. Add accurate information that can be reviewed.') },
    { id: 'opportunity', x: 81, y: 76, Icon: BriefcaseBusiness, title: label(match?.title, lang) || tr(lang, 'مسار تستكشفه', 'A path to explore'), type: match?.type==='training' ? tr(lang, 'تدريب مرجعي', 'Reference training') : tr(lang, 'ملف مهني مرجعي', 'Reference career'), text: tr(lang, 'نتتبع العلاقة: المقرر ← القدرة ← متطلب المسار. هذا استكشاف أولي، وليس إعلان توظيف أو ضمان قبول.', 'Trace the connection: record → capability → pathway requirement. This is preliminary exploration, not a vacancy or acceptance guarantee.') },
  ]
  const active = nodes.find(n => n.id === selected) || nodes[2]
  return <div className="knowledge-network">
    <div className="network-heading"><span><Link2 size={16}/>{tr(lang, 'شبكة قدرات مترابطة', 'Your connected capabilities')}</span><small>{tr(lang, demo ? 'مثال تفاعلي · بيانات وهمية' : 'من بيانات ملفك', demo ? 'Interactive demo · synthetic data' : 'From your profile')}</small></div>
    <div className="network-canvas" dir="ltr" role="group" aria-label={tr(lang, 'خريطة الدليل والقدرة والفرصة؛ اختر أي عقدة لشرحها', 'Evidence, capability and opportunity map; select a node to explain it')}>
      <svg viewBox="0 0 600 350" preserveAspectRatio="none" aria-hidden="true"><path d="M114 84 L300 175 L486 84 M114 266 L300 175 L486 266 M114 84 Q300 -3 486 84 M486 84 L486 266"/><path className={path?'network-path-evidence':'network-path-missing'} d="M114 84 Q300 -3 486 84 L486 266"/><path className="network-path-context" d="M114 266 L300 175"/></svg>
      {nodes.map(({ id, x, y, title, type, Icon }) => <button key={id} style={{ left: `${x}%`, top: `${y}%` }} className={`graph-node node-${id} ${selected === id ? 'selected' : ''}`} aria-pressed={selected === id} onClick={() => setSelected(id)} dir={lang === 'ar' ? 'rtl' : 'ltr'}><Icon size={20}/><strong>{title}</strong><small>{type}</small></button>)}
    </div>
    {paths.length > 1 && <label className="network-path-picker">{tr(lang, 'استكشف علاقة أخرى', 'Explore another connection')}<select value={paths[pathIndex] ? pathIndex : 0} onChange={e => { setPathIndex(Number(e.target.value)); setSelected('skill') }}>{paths.map((p, i) => <option value={i} key={p.claimId}>{p.courseCode} — {label(p.capabilityLabel, lang)}</option>)}</select></label>}
    <div className="network-explanation" aria-live="polite"><strong>{active.title}</strong><p>{active.text}</p></div>
    <div className="network-key"><span><i/>{path ? tr(lang, 'علاقة بالدليل', 'Evidence link') : tr(lang, 'دليل غير متاح', 'Evidence unavailable')}</span><span><i/>{tr(lang, 'هدف مصرح به', 'Declared goal')}</span><span>{tr(lang, 'اضغط على العقد للاستكشاف', 'Select nodes to explore')}</span></div>
  </div>
}

import { copy } from '../../i18n.js'
import { permissionsOn, storedCounts } from '../../utils/privacySections.js'
import { normalizeDigitalInterests } from '../../digitalInterests.js'
import { preferenceCount } from '../../insight.js'

// The labels of the old count tiles (Tasks 05/06), unchanged; only counts above zero are listed now.
const LABELS = {
  courses: ['سجلات مقررات', 'course records'],
  projects: ['أدلة تطبيقية مصرّح بها', 'self-declared applied evidence'],
  tasks: ['سجلات تقدم في المهام', 'task progress records'],
  credentials: ['نتائج تحقق من اعتمادات', 'credential verification results'],
  digital: ['اهتمامات رقمية مؤكدة', 'confirmed digital interests'],
  preferences: ['تفضيلات مصرح بها', 'declared preferences'],
  goal: ['هدف/مسار مختار', 'selected target/goal'],
  // Task 58
  plan: ['خطوات محفوظة في خطتي', 'saved steps in My plan'],
  notForMe: ['عناصر عُلّمت «ليس لي»', 'items marked “not for me”'],
  // Task 79
  roadmap: ['علامات إنجاز في خرائط الطريق', 'ticked roadmap items'],
}

// Task 27 · the status card at the top: where the profile is saved, how many permissions are on,
// and what is stored (only kinds that hold something), then the note on reference profiles that
// was in this card before (word for word). Keeps the `ownership-panel` class and the
// saved / session badge that the top bar's save chip (Task 26) matches.
export default function StatusSummary({ lang, state }) {
  const p = copy[lang].screens.privacy
  const digital = normalizeDigitalInterests(state.insight?.digitalInterests)
  const { on, total } = permissionsOn(state.consents)
  const { listed, rest } = storedCounts({
    courses: state.courses?.length || 0, projects: state.projects?.length || 0, tasks: state.tasks?.length || 0,
    credentials: state.credentials?.length || 0, digital: digital.confirmed.length,
    preferences: preferenceCount(state.insight?.declaredPreferences), // Task 78: each chosen chip counts
    // Task 58: every chosen goal (goal is goals[0]), the saved steps and the "not for me" marks.
    goal: state.goals?.length || (state.goal ? 1 : 0), plan: state.plan?.length || 0, notForMe: state.notForMe?.length || 0,
    roadmap: state.roadmapDone?.length || 0,
  })
  const sep = lang === 'ar' ? '، ' : ', '
  const stored = listed.length
    ? listed.map(({ key, count }) => `${count} ${LABELS[key][lang === 'ar' ? 0 : 1]}`).join(sep) + (rest ? ` · ${p.nothingElse}` : '')
    : p.nothingStored
  return <div className="panel ownership-panel" data-testid="privacy-status">
    <div className="panel-head"><div><h3>{lang==='ar'?'ما المخزن عنك الآن؟':'What is stored about you now?'}</h3></div><span className={state.localPersistence?'status yes':'status conditional'}>{state.localPersistence?(lang==='ar'?'محفوظ على هذا الجهاز':'Saved on this device'):(lang==='ar'?'جلسة مؤقتة':'Session only')}</span></div>
    <ul className="privacy-status-lines">
      <li data-testid="privacy-permissions-on"><span>{p.permissionsOn}:</span> <strong>{on} {p.of} {total}</strong></li>
      <li data-testid="privacy-stored"><span>{p.stored}:</span> <strong>{stored}</strong></li>
    </ul>
    <p className="privacy-reference-note">{lang==='ar'?'ملفات الوظائف والتدريب المرجعية ليست نسخة شخصية مخفية؛ المطابقات يعاد حسابها من أدلتك وتفضيلاتك. موافقتا المرشد والبحث أدناه عرض تجريبي فقط حتى اعتماد البنية الخلفية.':'Reference job/training profiles are not a hidden personal copy; matches are recomputed from your evidence and preferences. Advisor/research sharing controls below are demonstration-only until backend infrastructure is approved.'}</p>
  </div>
}

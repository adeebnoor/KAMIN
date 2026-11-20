import { SearchCheck } from 'lucide-react'

// Task 04: derived items (recommendation reviews, tasks, projects) that relied on a capability
// which lost its evidence. They are flagged "needs review", never deleted. Loaded lazily: it only
// renders after a recompute has flagged something.
const KIND = { 'recommendation-review': { ar: 'مراجعة توصية', en: 'Recommendation review' }, task: { ar: 'مهمة تطبيقية', en: 'Applied task' }, project: { ar: 'دليل تطبيقي مصرّح', en: 'Self-declared project' } }

export default function NeedsReview({ lang, items }) {
  if (!items?.length) return null
  return <div className="mapping-note needs-review" data-testid="needs-review" role="note"><SearchCheck size={17}/><div><strong>{lang === 'ar' ? 'عناصر تحتاج إلى مراجعة' : 'Items that need review'}</strong><p>{lang === 'ar' ? 'اعتمدت هذه العناصر على قدرة لم يعد لها دليل. لم نحذفها؛ راجعها وقرر.' : 'These relied on a capability that no longer has evidence. Nothing was deleted; review them and decide.'}</p><ul>{items.map(item => <li key={`${item.kind}:${item.id}`}>{KIND[item.kind]?.[lang]}: {item.title?.[lang] || item.title?.ar}</li>)}</ul></div></div>
}

// A pathway's four-step development plan and its text download (K08). Task 74: moved here, word for word, from
// src/components/DecisionStudio.jsx ("Show connections" → "Development plan"), so the old interface and the new one
// (My plan → "Why these paths?" → a pathway → "Open this pathway’s plan", src/ui2/components/GoalPicker.jsx) show
// the same plan from the same code. The plan changes no evidence, skill or fit judgment.
import { useMemo, useState } from 'react'
import { Download, ShieldCheck } from 'lucide-react'
import { skills as skillCatalog } from '../data.js'
const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const skillLabel = (id, lang) => skillCatalog[id]?.labels?.[lang] || id
export function buildDevelopmentPlan(match, lang = 'ar') {
  if (!match) return []
  const required = (match.missingSkills || []).map(id => skillLabel(id, lang))
  const developing = (match.knowledgeInsights?.developmentGaps || []).map(g => g.label)
  const focus = required[0] || developing[0] || tr(lang, 'تطبيق قدراتك الحالية', 'applying your current capabilities')
  return [
    { title: tr(lang, 'راجع نقطة البداية', 'Review your starting point'), action: required.length ? tr(lang, `تأكد من نقص دليل على: ${required.join('، ')}. إذا درستها بالفعل، راجع المقرر الأصلي قبل تعلمها من جديد.`, `Check the missing evidence for ${required.join(', ')}. If you already studied it, review the original record before repeating the learning.`) : tr(lang, 'المتطلبات الموجودة في هذا المثال لها روابط دليل. راجع مدى تمثيلها لمهاراتك الحالية؛ هذا لا يثبت الجاهزية المهنية.', 'This example’s requirements have evidence links. Check how well they reflect your current skills; this does not establish professional readiness.') },
    { title: tr(lang, 'اختر تجربة تطبيقية واحدة', 'Choose one applied exercise'), action: tr(lang, `اجعل تركيزك: ${focus}. اختر مهمة صغيرة تخدم مسار «${match.title.ar}»، وحدد مخرجًا تستطيع عرضه وشرحه.`, `Focus on ${focus}. Choose a small task for “${match.title.en}” and define an output you can show and explain.`) },
    { title: tr(lang, 'وثّق ما فعلته بنفسك', 'Document your own contribution'), action: tr(lang, 'احتفظ بملف العمل وطريقة تنفيذه والنتيجة. اذكر مساهمة الفريق أو أدوات الذكاء الاصطناعي بوضوح، وما تستطيع شرحه بنفسك.', 'Keep the work, method and result. Clearly describe team or AI contributions and what you can explain yourself.') },
    { title: tr(lang, 'راجع الدليل مع مرشد', 'Review the evidence with an advisor'), action: tr(lang, 'اطلب تغذية راجعة على المخرج، ثم حدّث بياناتك المتاحة في كامن. تنفيذ الخطة لا يضيف مهارة تلقائيًا؛ اعتماد المشاريع غير متاح في النسخة الحالية.', 'Ask for feedback, then update the information supported by Kamin. Completing a plan does not automatically add a skill; project verification is not available in this release.') },
  ]
}
// The line that says what the profile is made of (the plan file's third line, and "Show connections"' status).
export const planStatus = (state, lang) => state.courses.some(c=>c.source==='demo') ? tr(lang, 'ملف يتضمن بيانات وهمية · تجربة فقط', 'Profile includes synthetic data · demo only') : tr(lang, 'استكشاف مبدئي · كتالوج مرجعي', 'Preliminary exploration · reference catalog')
// The plan's panel: the pathway, "Download plan", the four steps and the sentence that it changes nothing.
export function DevelopmentPlanPanel({ lang, match, state }) {
  const [exportError, setExportError] = useState('')
  const plan = useMemo(() => buildDevelopmentPlan(match, lang), [match, lang])
  const downloadPlan = () => {
    try {
      const content = [tr(lang, 'كامن — خطة تطوير استرشادية', 'Kamin — exploratory development plan'), match.title[lang], planStatus(state, lang), ...plan.flatMap((p, i) => [`${i + 1}. ${p.title}`, p.action]), tr(lang, 'هذه الخطة لا تغيّر أدلة الملف أو حكم الملاءمة.', 'This plan does not change profile evidence or fit judgments.')].join('\n\n')
      const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/plain;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = 'kamin-development-plan.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setExportError(tr(lang, 'تعذر تنزيل الخطة. حاول مرة أخرى.', 'Could not download the plan. Please try again.')) }
  }
  return <div className="panel studio-plan"><div className="panel-head"><div><small>{tr(lang, 'خطة عمل مقترحة', 'SUGGESTED ACTION PLAN')}</small><h3>{match?.title[lang]}</h3></div><button className="text-button" onClick={downloadPlan}><Download size={17}/>{tr(lang, 'تنزيل الخطة', 'Download plan')}</button></div><p>{tr(lang, 'الأولوية لنقص دليل المتطلبات، ثم فرص التطوير. إشارات السوق الأجنبية سياق إضافي، ولا تمثل طلب السوق السعودي.', 'Required evidence gaps come first, followed by development opportunities. Foreign market signals are additional context, not Saudi demand.')}</p><ol>{plan.map(p => <li key={p.title}><h4>{p.title}</h4><p>{p.action}</p></li>)}</ol><div className="studio-grounding"><ShieldCheck size={18}/>{tr(lang, 'الخطة لا تغيّر المهارات أو نتائج المطابقة، ولا تَعِد بقبول أو توظيف.', 'The plan does not change skills or matching results, and does not promise acceptance or employment.')}</div>{exportError && <p role="alert">{exportError}</p>}</div>
}

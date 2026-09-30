import { useState } from 'react'
import { Columns3 } from 'lucide-react'
import { skills as catalog } from '../data.js'
import { DECLARED_PREFERENCE_SCHEMES } from '../insight.js'
import { taskWorkHours, tasksForSkillCount } from '../tasks/progress.js'

const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const label = (id, lang) => Object.values(catalog).find(s => s.id === id)?.labels[lang] || id
const preferenceFields = [['careerInterest', 'preferredInterests'], ['workValue', 'preferredValues'], ['workStructure', 'preferredWorkStructure'], ['collaboration', 'preferredCollaboration']]

// Compare two or three pathways on evidence present, evidence missing, work required and,
// only if the student opts in, declared constraints. No readiness percentage: none is calibrated.
export default function PathwayCompare({ lang, matches = [], profile }) {
  const jobs = matches.filter(m => m.type === 'job')
  const [selected, setSelected] = useState(() => jobs.slice(0, 2).map(m => m.id))
  const [includePreferences, setIncludePreferences] = useState(false)
  const chosen = selected.map(id => jobs.find(m => m.id === id)).filter(Boolean)
  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= 3 ? s : [...s, id])
  const have = new Set(profile?.skills || [])
  const preferences = profile?.preferences || {}
  const constraint = (match, scheme, field) => {
    const mine = preferences[scheme]
    if (!mine) return tr(lang, 'لم تُحدد', 'not declared')
    return (match[field] || []).includes(mine) ? tr(lang, 'متوافق', 'aligned') : tr(lang, 'مختلف', 'differs')
  }
  return <section className="panel pathway-compare" data-testid="pathway-compare" aria-label={tr(lang, 'مقارنة المسارات', 'Pathway comparison')}>
    <div className="panel-head"><div><small>{tr(lang, 'قارن قبل أن تختار', 'COMPARE BEFORE YOU CHOOSE')}</small><h3><Columns3 size={18}/> {tr(lang, 'مقارنة مسارين أو ثلاثة', 'Compare two or three pathways')}</h3></div></div>
    <div className="compare-picker">{jobs.map(m => <label key={m.id} className={`choice-chip ${selected.includes(m.id) ? 'selected' : ''}`}><input type="checkbox" checked={selected.includes(m.id)} disabled={!selected.includes(m.id) && selected.length >= 3} onChange={() => toggle(m.id)}/><span>{m.title[lang]}</span></label>)}</div>
    <label className="choice-chip compare-preferences"><input type="checkbox" checked={includePreferences} onChange={e => setIncludePreferences(e.target.checked)}/><span>{tr(lang, 'أضف قيودي المصرّح بها (تفضيلاتي) إلى المقارنة', 'Include my declared constraints (preferences) in the comparison')}</span></label>
    {chosen.length >= 2 ? <div className="table-scroll" role="region" aria-label={tr(lang,'جدول مقارنة المسارات — قابل للتمرير','Pathway comparison table — scrollable')} tabIndex={0}><table className="compare-table"><thead><tr><th>{tr(lang, 'البُعد', 'Dimension')}</th>{chosen.map(m => <th key={m.id}>{m.title[lang]}</th>)}</tr></thead><tbody>
      <tr><th>{tr(lang, 'الأدلة المتوفرة', 'Evidence present')}</th>{chosen.map(m => { const present = (m.requiredSkills || []).filter(id => have.has(id)); return <td key={m.id}>{present.length ? present.map(id => label(id, lang)).join(tr(lang, '، ', ', ')) : tr(lang, 'لا شيء بعد', 'none yet')}</td> })}</tr>
      <tr><th>{tr(lang, 'الأدلة الناقصة', 'Evidence missing')}</th>{chosen.map(m => <td key={m.id} className={m.missingSkills?.length ? 'compare-gap' : ''}>{m.missingSkills?.length ? m.missingSkills.map(id => label(id, lang)).join(tr(lang, '، ', ', ')) : tr(lang, 'لا فجوة في المتطلبات الأساسية', 'no core-requirement gap')}</td>)}</tr>
      <tr><th>{tr(lang, 'العمل المطلوب', 'Work required')}</th>{chosen.map(m => { const hours = taskWorkHours(m.missingSkills || []); const count = tasksForSkillCount(m.missingSkills || []); return <td key={m.id}>{count ? tr(lang, `${count} مهمة · نحو ${hours} ساعة`, `${count} task(s) · about ${hours} hours`) : m.missingSkills?.length ? tr(lang, 'لا مهمة جاهزة لهذه الفجوة بعد', 'no ready task for this gap yet') : tr(lang, 'لا عمل إضافي للمتطلبات الأساسية', 'no additional core work')}</td> })}</tr>
      <tr><th>{tr(lang, 'الحكم الحالي', 'Current judgment')}</th>{chosen.map(m => <td key={m.id}>{m.judgment === 'fits' ? tr(lang, 'تناسبك', 'fits') : m.judgment === 'conditional' ? tr(lang, 'تناسبك بشروط', 'fits with conditions') : m.judgment === 'exploratory' ? tr(lang, 'استكشافي', 'exploratory') : tr(lang, 'ليس الآن', 'not yet')}</td>)}</tr>
      {includePreferences && preferenceFields.map(([scheme, field]) => <tr key={scheme}><th>{DECLARED_PREFERENCE_SCHEMES[scheme].label[lang]}</th>{chosen.map(m => <td key={m.id}>{constraint(m, scheme, field)}</td>)}</tr>)}
    </tbody></table></div> : <p className="compare-empty">{tr(lang, 'اختر مسارين على الأقل.', 'Choose at least two pathways.')}</p>}
    <small>{tr(lang, 'لا نعرض نسبة جاهزية لأن لا معايرة منشورة لها. التفضيلات سياق تختار مشاركته ولا تغيّر الحكم.', 'No readiness percentage is shown because none is calibrated. Preferences are context you choose to include; they change no judgment.')}</small>
  </section>
}

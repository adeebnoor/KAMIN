import { useState } from 'react'
import { Compass, Target, Users, Heart, BookOpen, GraduationCap, Fingerprint, Sparkles } from 'lucide-react'
import { DECLARED_PREFERENCE_SCHEMES } from '../insight.js'
import { copy } from '../i18n.js'
const tr = (lang, ar, en) => lang === 'ar' ? ar : en
export const preferenceLabel = (preferences, key, lang) => DECLARED_PREFERENCE_SCHEMES[key]?.options.find(option => option.id === preferences?.[key])?.label[lang] || ''

export default function ProfileNetwork({ lang, state = {}, demo = false }) {
  const [selected, setSelected] = useState('interest')
  const prefs = state.consents?.insight ? state.insight?.declaredPreferences || {} : {}
  const unknown = tr(lang, 'أضفه عندما تكون مستعدًا', 'Add it when you are ready')
  const declared = tr(lang, 'اختيارك الشخصي', 'Self-declared')
  const count = state.approved ? state.courses?.length || 0 : 0
  const work = ['collaboration', 'workStructure', 'pace', 'responsibility'].map(key => preferenceLabel(prefs, key, lang)).filter(Boolean)
  const nodes = [
    { id:'interest', x:78, y:16, Icon:Compass, title:tr(lang,'اهتماماتك','Interests'), value:preferenceLabel(prefs,'careerInterest',lang), tone:'violet', source:declared, detail:tr(lang,'ما الذي تستمتع باستكشافه؟ اهتمامك يضيف سياقًا لشرح المسارات المرتبطة بك، ولا يثبت مهارة مهنية.','What do you enjoy exploring? Your interest adds context to pathway explanations; it does not prove a professional skill.') },
    { id:'goal', x:22, y:16, Icon:Target, title:tr(lang,'هدفك','Your goal'), value:copy[lang].app.goals[state.goal] || '', tone:'coral', source:declared, detail:tr(lang,'ما الخطوة التي تريد الوصول إليها؟ هدفك يوجّه استكشاف المسارات. يمكنك تغييره أو تركه غير محدد.','What do you want to move toward? Your goal directs pathway exploration. You can change it or leave it undecided.') },
    { id:'work', x:83, y:50, Icon:Users, title:tr(lang,'أسلوب عملك','Work style'), value:work[0] || '', tone:'blue', source:declared, detail:tr(lang,'التعاون وهيكلة العمل يساعدان في تفسير توافق بيئة المسار مع تفضيلاتك. الإيقاع والمسؤولية محفوظان للسياق فقط حاليًا.','Collaboration and work structure help explain contextual alignment. Pace and responsibility are currently saved for context only.') + (work.length ? ` ${work.join(' · ')}` : '') },
    { id:'record', x:17, y:50, Icon:GraduationCap, title:tr(lang,'دراستك','Your studies'), value:count ? tr(lang,`${count} مقررات راجعتها`,`${count} reviewed courses`) : '', tone:'teal', source:count ? tr(lang,'سجل راجعته أنت','Student-reviewed record') : tr(lang,'لم يُضف دليل بعد','No evidence added yet'), detail:tr(lang,'السجل مصدر للأدلة الأكاديمية داخل الشبكة. تراجع المقررات والدرجات قبل ربطها بالقدرات؛ مراجعتك لا تعني توثيقًا من الجامعة.','Your transcript supplies academic evidence. Review courses and grades before they link to capabilities; your review is not institutional verification.') },
    { id:'values', x:78, y:84, Icon:Heart, title:tr(lang,'ما يهمك','Your values'), value:preferenceLabel(prefs,'workValue',lang), tone:'amber', source:declared, detail:tr(lang,'إنجاز أم استقلالية أم علاقات؟ ما تقدّره في العمل يضيف بُعدًا لتفسير توافق المسار، دون تصنيفك أو الحكم على شخصيتك.','Achievement, independence or relationships? Your work values add context to pathway explanations without judging your personality.') },
    { id:'learning', x:22, y:84, Icon:BookOpen, title:tr(lang,'طريقة تعلّمك','Learning preference'), value:preferenceLabel(prefs,'learningMode',lang), tone:'green', source:declared, detail:tr(lang,'كيف تفضّل أن تتعلم الآن؟ نحفظ اختيارك في ملفك لتراجعه؛ لا يغيّر ترتيب المسارات حاليًا ولا يُعد تشخيصًا لأسلوب تعلم ثابت.','How do you prefer to learn right now? This choice is saved for your reflection; it does not currently change pathway rankings or diagnose a fixed learning style.') },
  ]
  const active = nodes.find(node => node.id === selected)
  return <div className="profile-network">
    <div className="profile-network-head"><span><Sparkles size={17}/>{tr(lang,'كل بُعد يضيف علاقة','Every dimension adds a connection')}</span><small>{demo ? tr(lang,'مثال تفاعلي · بيانات وهمية','Interactive demo · synthetic data') : tr(lang,'يتحدّث من اختياراتك','Updates from your choices')}</small></div>
    <div className="profile-orbit" dir="ltr" role="group" aria-label={tr(lang,'شبكة اهتماماتك وأهدافك وتفضيلاتك ودراستك','Network of interests, goals, preferences and studies')}>
      <svg viewBox="0 0 600 380" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="300" cy="190" rx="196" ry="142" className="profile-orbit-ring"/>{nodes.map(node => <path key={node.id} d={`M300 190 L${node.x * 6} ${node.y * 3.8}`} className={`${node.id === 'record' && count ? 'evidence-connection' : ''} ${selected === node.id ? 'active-connection' : ''}`}/>)}</svg>
      <div className="profile-person" dir={lang==='ar'?'rtl':'ltr'}><Fingerprint size={34}/><strong>{demo ? tr(lang,'سارة','Sara') : tr(lang,'أنت','You')}</strong><span>{tr(lang,'في قلب الشبكة','At the center')}</span><b>360°</b></div>
      {nodes.map(({ id, x, y, Icon, title, value, tone }) => <button key={id} className={`profile-node tone-${tone} ${selected===id?'selected':''} ${value?'has-value':'unfilled'}`} style={{left:`${x}%`,top:`${y}%`}} aria-pressed={selected===id} onClick={()=>setSelected(id)} dir={lang==='ar'?'rtl':'ltr'}><span className="dimension-icon"><Icon size={23}/></span><strong>{title}</strong><small>{value || tr(lang,'لم تحدد بعد','Not set yet')}</small></button>)}
    </div>
    <div className={`profile-node-detail tone-${active.tone}`} aria-live="polite"><div><active.Icon size={20}/><strong>{active.title}</strong><span>{active.value ? active.source : unknown}</span></div><p>{active.detail}</p></div>
    <div className="profile-network-legend"><span><i/>{tr(lang,'معلومات تختارها','Your own choices')}</span><span><i/>{tr(lang,'دليل تراجعه','Evidence you review')}</span></div>
  </div>
}

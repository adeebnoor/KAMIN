import { useState } from 'react'
import { Compass, Target, Users, Heart, BookOpen, LayoutList, Gauge, Flag, ShieldCheck, ArrowLeft, ArrowRight, UploadCloud, Waypoints, Check } from 'lucide-react'
import { DECLARED_PREFERENCE_SCHEMES, emptyInsightState, setDeclaredPreference } from '../insight.js'
import { PSYCHOMETRIC_INSTRUMENTS } from '../psychometrics/registry.js'
import { copy } from '../i18n.js'
import ProfileNetwork from './ProfileNetwork.jsx'
import DigitalInterests from './DigitalInterests.jsx'
const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const fields = {
  careerInterest: { Icon:Compass, tone:'violet', help:{ar:'أي نوع من الأنشطة يجذبك الآن؟ يضيف سياقًا لتفسير المسارات.',en:'What activities attract you now? This adds context to pathway explanations.'} },
  workValue: { Icon:Heart, tone:'amber', help:{ar:'ما الذي يهمك في العمل؟ يساعد على شرح التوافق مع المسار.',en:'What matters at work? This helps explain contextual alignment.'} },
  collaboration: { Icon:Users, tone:'blue', help:{ar:'اختر بيئة التعاون الأقرب لك؛ لا توجد إجابة أفضل للجميع.',en:'Choose a collaboration setting that reflects you. There is no best answer for everyone.'} },
  workStructure: { Icon:LayoutList, tone:'teal', help:{ar:'مقدار التنظيم الذي تفضّله يضيف سياقًا للمطابقة.',en:'Your preferred level of structure adds context to matching.'} },
  learningMode: { Icon:BookOpen, tone:'green', help:{ar:'لملفك ومراجعتك الذاتية؛ لا يغيّر ترتيب المسارات حاليًا.',en:'Saved for your reflection; it does not currently change pathway rankings.'} },
  pace: { Icon:Gauge, tone:'coral', help:{ar:'نحفظه ضمن صورتك عن نفسك؛ لا يؤثر في المطابقة حاليًا.',en:'Saved as part of your profile; it does not currently affect matching.'} },
  responsibility: { Icon:Flag, tone:'violet', help:{ar:'ما ترغب في تجربته مستقبلًا، وليس إثباتًا لخبرة قيادية.',en:'What you want to try, not evidence of leadership experience.'} },
}
export default function StudentInsight({ lang, state, setState, log, onGoal, onExplore, onRecord, onSave }) {
  const [agree,setAgree] = useState(false)
  const insight = state.insight || emptyInsightState()
  const Arrow = lang==='ar' ? ArrowLeft : ArrowRight
  const grant = () => {
    if(!agree) return
    setState(s=>({...s,consents:{...s.consents,insight:true},insight:{...emptyInsightState(),...(s.insight||{})},audit:[{label:tr(lang,'منح موافقة بصمة الطالب 360','Student 360 consent granted'),ts:Date.now()},...s.audit]}))
  }
  const updatePreference = (schemeId,optionId) => {
    setState(s=>{
      const current = s.insight || emptyInsightState()
      if(!optionId){const prefs={...current.declaredPreferences};delete prefs[schemeId];return {...s,insight:{...current,declaredPreferences:prefs,updatedAt:new Date().toISOString()}}}
      return {...s,insight:setDeclaredPreference(current,schemeId,optionId)}
    })
    log(tr(lang,'تحديث تفضيل منظم','Structured preference updated'))
  }
  if(!state.consents.insight) return <div className="insight-intro">
    <div className="app-title"><small>{tr(lang,'ابدأ من نفسك','START WITH YOURSELF')}</small><h2>{tr(lang,'اهتماماتك بداية الشبكة','Your interests start the network')}</h2><p>{tr(lang,'ابنِ صورة عن اهتماماتك وأهدافك وأسلوب عملك وتعلّمك. يمكنك البدء الآن دون سجل أكاديمي.','Build a picture of your interests, goals, work style and learning preferences. You can start without a transcript.')}</p></div>
    <div className="profile-welcome-art" aria-hidden="true">{[Compass,Target,Users,Heart,BookOpen,UploadCloud].map((Icon,i)=><span key={i} className={`tone-${['violet','coral','blue','amber','green','teal'][i]}`}><Icon size={30}/></span>)}</div>
    <div className="insight-privacy-grid">
      <article><Compass/><strong>{tr(lang,'قل ما يشبهك اليوم','Reflect who you are today')}</strong><span>{tr(lang,'اختيارات قصيرة، ويمكنك ترك أي سؤال أو تعديل إجابتك لاحقًا.','Short choices. Skip any question or change your answer later.')}</span></article>
      <article><Waypoints/><strong>{tr(lang,'شاهد كيف تتصل المعلومات','See the connections')}</strong><span>{tr(lang,'الاهتمامات والقيم وأسلوب العمل تضيف سياقًا لتفسير المسارات؛ ولا تثبت مهارة.','Interests, values and work style add context to pathway explanations; they do not prove a skill.')}</span></article>
      <article><ShieldCheck/><strong>{tr(lang,'ملف تملكه أنت','A profile you control')}</strong><span>{tr(lang,'معالجة محلية، وحفظ على الجهاز باختيارك، وسحب مستقل لهذه الموافقة.','Local processing, optional device saving and separate consent withdrawal.')}</span></article>
    </div>
    <label className="insight-consent"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>{tr(lang,'أوافق على بناء ملف Person 360 باستخدام اختياراتي محليًا في المتصفح، ويمكنني سحب موافقتي وحذفها لاحقًا.','I consent to building my Person 360 profile using my choices locally in the browser. I can withdraw this consent and delete them later.')}</span></label>
    <button className="button primary" disabled={!agree} onClick={grant}>{tr(lang,'ابدأ بصمتي','Start my profile')}<Arrow size={18}/></button>
    <p className="profile-optional-note">{tr(lang,'هذه أسئلة اختيارية للتعريف بنفسك، وليست اختبارًا أو تشخيصًا نفسيًا.','These optional questions describe your preferences; they are not a test or psychological diagnosis.')}</p>
  </div>
  return <div className="student-insight">
    <div className="app-title"><small>{tr(lang,'ملفك يتشكل باختياراتك','YOUR CHOICES SHAPE YOUR PROFILE')}</small><h2>{tr(lang,'اهتماماتك ووجهتك','Your interests and direction')}</h2><p>{tr(lang,'اختر ما يشبهك الآن، وشاهد أثره في شبكتك. «لم أحدد بعد» إجابة مقبولة؛ لا تحتاج لملء كل الحقول.','Choose what reflects you now and see it in your network. “Undecided” is valid; you do not need to fill every field.')}</p></div>
    <div className="profile-builder-layout"><div className="profile-fields">
      <ChoiceGroup lang={lang} id="goal" title={tr(lang,'هدفي القادم','My next goal')} help={tr(lang,'ما الاتجاه الذي تريد استكشافه؟ يمكنك تغييره متى شئت.','Which direction do you want to explore? You can change it anytime.')} options={Object.entries(copy[lang].app.goals).map(([id,label])=>({id,label}))} value={state.goal||''} onChange={value=>onGoal(value||null)} Icon={Target}/>
      <ChoiceGroup lang={lang} id="careerInterest" title={DECLARED_PREFERENCE_SCHEMES.careerInterest.label[lang]} help={fields.careerInterest.help[lang]} options={DECLARED_PREFERENCE_SCHEMES.careerInterest.options.map(o=>({id:o.id,label:o.label[lang]}))} value={insight.declaredPreferences?.careerInterest||''} onChange={value=>updatePreference('careerInterest',value)} Icon={Compass}/>
      <details className="optional-preferences"><summary>{tr(lang,'أضف تفضيلات أخرى — اختياري','More preferences — optional')}</summary><div className="profile-fields">      {Object.entries(fields).filter(([id])=>id!=='careerInterest').map(([id,{Icon,tone,help}])=><label key={id} className={`profile-field tone-${tone}`}><span className="dimension-icon"><Icon size={22}/></span><strong>{DECLARED_PREFERENCE_SCHEMES[id].label[lang]}</strong><small id={`benefit-${id}`}>{help[lang]}</small><select aria-label={DECLARED_PREFERENCE_SCHEMES[id].label[lang]} aria-describedby={`benefit-${id}`} value={insight.declaredPreferences?.[id]||''} onChange={e=>updatePreference(id,e.target.value)}><option value="">{tr(lang,'لم أحدد بعد / لا أرغب بالإجابة','Undecided / prefer not to answer')}</option>{DECLARED_PREFERENCE_SCHEMES[id].options.map(option=><option key={option.id} value={option.id}>{option.label[lang]}</option>)}</select></label>)}</div></details>
    </div><aside className="profile-live-preview"><ProfileNetwork lang={lang} state={state}/><p><Check size={16}/>{tr(lang,'تُحدَّث الشبكة فور اختيارك. لا تتحول التفضيلات إلى مهارات مثبتة.','The network updates with your choices. Preferences never become proven skills.')}</p></aside></div>
    <DigitalInterests lang={lang} state={state} setState={setState} onSkip={onExplore}/>
    <div className="profile-next-actions"><div><strong>{tr(lang,'شبكتك تبدأ بما أضفته','Your network starts with what you added')}</strong><p>{tr(lang,'استكشف الآن، أو أضف دليلًا أكاديميًا، أو احفظ ملفك لتكمله لاحقًا.','Explore now, add academic evidence or save your profile to continue later.')}</p></div><div><button className="button primary" onClick={onExplore}><Waypoints size={18}/>{tr(lang,'استكشف شبكتي','Explore my network')}</button><button className="button secondary" onClick={onRecord}><UploadCloud size={18}/>{tr(lang,'أضف سجلي الأكاديمي','Add my transcript')}</button><button className="text-button" onClick={onSave}>{tr(lang,'خيارات حفظ ملفي','Profile saving options')}</button></div></div>
    <details className="profile-research-details"><summary>{tr(lang,'المقاييس النفسية والبحثية وحدود استخدامها','Psychometric research and its limits')}</summary><div className="app-title compact"><h3>{tr(lang,'أدوات مرشحة للمعايرة السعودية — لا تؤثر على الملاءمة','Candidate instruments for Saudi validation — no Fit effect')}</h3></div><div className="instrument-grid">{Object.values(PSYCHOMETRIC_INSTRUMENTS).map(inst=><article className="panel instrument-card" key={inst.id}><div><small>{inst.sourceSystem}</small><h3>{inst.name[lang]}</h3></div><p>{inst.construct}</p><span className="instrument-status">{inst.status}</span><small>{inst.notes[lang]}</small></article>)}</div><div className="insight-boundary"><ShieldCheck/><span>{tr(lang,'درجات IPIP/RIASEC لا تدخل الحكم إطلاقًا قبل دراسة سعودية موثقة للثبات والبنية والملاءمة الثقافية.','IPIP/RIASEC instrument scores never enter judgments before documented Saudi reliability, structure and cultural validation.')}</span></div></details>
  </div>
}

function ChoiceGroup({lang,id,title,help,options,value,onChange,Icon}) {
 return <fieldset className="choice-group" aria-describedby={`choice-help-${id}`}><legend><Icon size={20}/>{title}</legend><p id={`choice-help-${id}`}>{help}</p><div className="choice-options">{[{id:'',label:tr(lang,'لم أحدد بعد','Undecided')},...options].map(option=><label className="choice-chip" key={option.id}><input type="radio" name={id} value={option.id} checked={value===option.id} onChange={()=>onChange(option.id)}/><span>{option.label}</span></label>)}</div></fieldset>
}

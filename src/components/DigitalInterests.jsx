import { useState } from 'react'
import { Check, Compass, Eye, LockKeyhole, MessageSquareText, ShieldCheck, Trash2, X } from 'lucide-react'
import { DIGITAL_TOPICS, confirmDigitalInterest, emptyDigitalInterests, grantDigitalAnalysis, normalizeDigitalInterests, removeDigitalInterest, suggestDigitalInterests } from '../digitalInterests.js'
import { trustMicrocopy } from '../content/trustCopy.js'

const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const topicLabel = (id,lang) => DIGITAL_TOPICS.find(topic => topic.id === id)?.label[lang] || id
export default function DigitalInterests({lang,state,setState,onSkip}){
  const [open,setOpen] = useState(false)
  const [agree,setAgree] = useState(false)
  const [text,setText] = useState('')
  const [candidates,setCandidates] = useState([])
  const [isDemo,setIsDemo] = useState(false)
  const [message,setMessage] = useState('')
  const current = normalizeDigitalInterests(state.insight?.digitalInterests)
  const update = transform => setState(previous => ({...previous,insight:{...previous.insight,digitalInterests:transform(normalizeDigitalInterests(previous.insight?.digitalInterests))}}))
  const revoke = () => {
    update(()=>emptyDigitalInterests());setText('');setCandidates([]);setAgree(false);setIsDemo(false)
    setMessage(tr(lang,'حُذفت الاهتمامات الرقمية وموافقتها وروابطها من ملفك على هذا المتصفح. احذف أي نسخة احتياطية قديمة بنفسك.','Digital interests, their consent and connections were removed from this browser profile. Delete older downloaded backups separately.'))
  }
  const analyze = () => {
    try {
      const found = suggestDigitalInterests(text,current)
      setCandidates(found);setText('');setIsDemo(false)
      setMessage(found.length ? tr(lang,'هذه اقتراحات تنتظر رأيك. أُفرغ مربع النص؛ لن تُحفظ المنشورات في ملفك.','These suggestions await your review. The text box was cleared; posts will not be saved in your profile.') : tr(lang,'لم نجد موضوعًا من قائمة الموضوعات المحدودة. هذا لا يعني غياب الاهتمامات؛ يمكنك اختيارها يدويًا في ملفك.','No topic from the limited topic list was found. This does not mean you lack interests; you can choose preferences manually in your profile.'))
    } catch {setMessage(tr(lang,'أدخل نصًا قصيرًا بعد منح الموافقة، بحد أقصى ٤٠٠٠ حرف.','Enter a short text after giving consent, up to 4,000 characters.'))}
  }
  const sample = () => {
    setOpen(true);setText('');setIsDemo(true)
    setCandidates(suggestDigitalInterests('أتعلم تحليل البيانات باستخدام SQL وأستكشف تجربة المستخدم وFigma.',grantDigitalAnalysis()))
    setMessage(tr(lang,'مثال وهمي فقط — لن يُضاف إلى ملفك ولن يغيّر موافقاتك.','Synthetic example only — it will not enter your profile or change your consent.'))
  }
  return <section className="digital-interests" aria-labelledby="digital-interests-title" id="digital-interests">
    <div className="digital-heading"><span className="dimension-icon tone-violet"><MessageSquareText size={26}/></span><div><small>{tr(lang,'مصدر إضافي · اختياري بالكامل','AN EXTRA SOURCE · ENTIRELY OPTIONAL')}</small><h3 id="digital-interests-title">{tr(lang,'اهتمامات من نشاطك الرقمي','Interests from your digital activity')}</h3><p>{tr(lang,'دع نصوصًا تختارها تقترح موضوعات تستكشفها. أنت تقرر ما يمثلك وما يدخل ملفك.','Let text you choose suggest topics to explore. You decide what reflects you and enters your profile.')}</p></div></div>
    <div className="digital-trust"><ShieldCheck size={20}/><p>{trustMicrocopy('digitalInterests',lang)}</p></div>
    <div className="digital-actions"><button className="button secondary" aria-expanded={open} onClick={()=>setOpen(!open)}><Compass size={18}/>{tr(lang,open?'إخفاء التحليل':'استكشف هذا المصدر',open?'Hide analysis':'Explore this source')}</button><button className="text-button" onClick={sample}><Eye size={18}/>{tr(lang,'جرّب مثالًا دون بياناتك','Try an example without your data')}</button><button className="text-button" onClick={onSkip}>{tr(lang,'تخطَّ واستكشف ملفك','Skip and explore your profile')}</button></div>
    {open && <div className="digital-content">
      <div className="digital-steps"><span>1 · {tr(lang,'تختار النص','Choose text')}</span><span>2 · {tr(lang,'تراجع الاقتراح','Review suggestions')}</span><span>3 · {tr(lang,'تؤكد ما يمثلك','Confirm what fits you')}</span></div>
      <p className="digital-boundary">{tr(lang,'التحليل تجريبي بقائمة كلمات عربية وإنجليزية لستة موضوعات تقنية ومهنية. قد يخطئ في فهم النقد أو النفي. لا يقيس الشخصية أو المهارة أو الجاهزية.','This experimental analysis uses Arabic and English keywords for six technical and career topics. It may misunderstand criticism or negation. It does not measure personality, skill or readiness.')}</p>
      {!current.analysisConsent ? <div className="digital-permission">
        <label className="digital-checkbox"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>{tr(lang,'أوافق على تحليل نصوص أختارها محليًا لاقتراح اهتمامات أراجعها. تُحفظ فقط الموضوعات التي أؤكدها والكلمات الدالة عليها وتاريخ التأكيد؛ ويمكنني سحب الموافقة وحذفها.','I consent to local analysis of text I choose to suggest interests for my review. Only topics I confirm, their matching keywords and confirmation dates are saved. I can withdraw consent and delete them.')}</span></label>
        <button className="button primary" disabled={!agree} onClick={()=>{update(()=>grantDigitalAnalysis());setCandidates([]);setIsDemo(false);setMessage('')}}>{tr(lang,'فعّل التحليل الاختياري','Enable optional analysis')}</button>
      </div> : <div className="digital-input">
        <label htmlFor="digital-posts">{tr(lang,'نصوص اخترتها عن التعلم أو العمل','Selected text about learning or work')}</label>
        <p id="digital-posts-help">{tr(lang,'الصق مقاطع قصيرة كتبتها أنت، بعد إزالة الأسماء والمعرّفات وبيانات الآخرين. لا تضف رسائل خاصة أو معلومات صحية أو مالية أو عن مخالفات.','Paste short excerpts you wrote, removing names, identifiers and other people’s data. Do not include private messages, health, financial or violation details.')}</p>
        <textarea id="digital-posts" aria-describedby="digital-posts-help" rows={4} maxLength={4000} value={text} onChange={event=>setText(event.target.value)} autoComplete="off" spellCheck={false} placeholder={tr(lang,'مثلًا: أستمتع بتعلم SQL وتحليل البيانات…','For example: I enjoy learning SQL and data analysis…')}/>
        <div className="digital-actions"><button className="button primary" disabled={!text.trim()} onClick={analyze}>{tr(lang,'اقترح اهتمامات لأراجعها','Suggest interests for review')}</button><button className="text-button" disabled={!text} onClick={()=>setText('')}>{tr(lang,'امسح النص','Clear text')}</button><small>{text.length} / 4000</small></div>
      </div>}
      {!!candidates.length && <div className="digital-candidates" aria-label={tr(lang,'اقتراحات الاهتمامات','Interest suggestions')}>
        <h4>{tr(lang,isDemo?'هكذا تظهر الاقتراحات':'هل تمثلك هذه الموضوعات؟',isDemo?'This is how suggestions appear':'Do these topics reflect you?')}</h4>
        {candidates.map(candidate=><article className="digital-candidate" key={candidate.topicId}><div><strong>{topicLabel(candidate.topicId,lang)}</strong><p>{tr(lang,'سبب الاقتراح: كلمات وردت في النص','Suggested because these words appeared')} — <bdi>{candidate.matchedTerms.join(' · ')}</bdi></p><small>{tr(lang,'اقتراح غير مؤكد؛ ذكر الموضوع لا يعني الاهتمام به.','Unconfirmed suggestion; mentioning a topic does not mean you are interested in it.')}</small></div><div className="digital-actions"><button className="button secondary" disabled={isDemo} onClick={()=>{update(value=>confirmDigitalInterest(value,candidate));setCandidates(items=>items.filter(item=>item.topicId!==candidate.topicId));setMessage(tr(lang,'أُضيف الاهتمام بتأكيدك. استخدامه في شرح المسارات له اختيار منفصل أدناه.','Interest added with your confirmation. Using it in pathway explanations is a separate choice below.'))}}><Check size={16}/>{tr(lang,'يمثلني — أضفه','Reflects me — add it')}</button><button className="text-button" onClick={()=>setCandidates(items=>items.filter(item=>item.topicId!==candidate.topicId))}><X size={16}/>{tr(lang,'لا يمثلني','Does not reflect me')}</button></div></article>)}
      </div>}
      {!!current.confirmed.length && <div className="digital-confirmed"><h4>{tr(lang,'اهتمامات أكدتها بنفسك','Interests you confirmed')}</h4>{current.confirmed.map(item=><div className="digital-saved-topic" key={item.topicId}><span><Check size={16}/>{topicLabel(item.topicId,lang)}</span><button className="text-button" aria-label={tr(lang,`حذف اهتمام ${topicLabel(item.topicId,lang)}`,`Delete interest ${topicLabel(item.topicId,lang)}`)} onClick={()=>update(value=>removeDigitalInterest(value,item.topicId))}><Trash2 size={17}/>{tr(lang,'حذف','Delete')}</button></div>)}<label className="digital-checkbox"><input type="checkbox" checked={current.contextConsent} onChange={event=>update(value=>({...value,contextConsent:event.target.checked}))}/><span>{tr(lang,'أسمح باستخدام اهتماماتي المؤكدة لشرح روابط المسارات داخل كامن. هذا لا يغيّر حكم الملاءمة أو الأهلية ولا يشاركها مع جهة أخرى.','Allow my confirmed interests to explain pathway connections within Kamin. This does not change fit or eligibility judgments or share them with another party.')}</span></label></div>}
      {current.analysisConsent && <button className="text-button digital-withdraw" onClick={revoke}><Trash2 size={17}/>{tr(lang,'اسحب الموافقة واحذف الاهتمامات الرقمية','Withdraw consent and delete digital interests')}</button>}
      <p className="digital-storage"><LockKeyhole size={16}/>{tr(lang,'الموضوعات المؤكدة تتبع خيار حفظ ملفك. بيانات المتصفح المحلية ليست مشفّرة من كامن؛ استخدم جهازًا موثوقًا. النسخة الاحتياطية التي تنزّلها مشفّرة بعبارتك.','Confirmed topics follow your profile saving choice. Browser storage is not encrypted by Kamin; use a trusted device. Downloaded backups are encrypted with your passphrase.')}</p>
    </div>}
    {message && <p className="digital-status" role="status">{message}</p>}
  </section>
}

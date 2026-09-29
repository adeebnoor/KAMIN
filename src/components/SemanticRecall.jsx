import {useEffect,useRef,useState} from 'react'
import {Sparkles,Download,Trash2,ArrowLeft,ArrowRight} from 'lucide-react'
import {targetProfiles} from '../matching/targets.js'
import {skills} from '../data.js'
import {EMBEDDING_MODEL} from '../semantic/config.js'
const tr=(lang,ar,en)=>lang==='ar'?ar:en
export default function SemanticRecall({lang,matches=[],onInspect}){
 const [agreed,setAgreed]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0)
 const [text,setText]=useState(''),[results,setResults]=useState(null),[error,setError]=useState(''),[cacheNotice,setCacheNotice]=useState(false),[status,setStatus]=useState('')
 const worker=useRef(null),timer=useRef(null),phase=useRef('idle')
 const Arrow=lang==='ar'?ArrowLeft:ArrowRight
 const dispose=()=>{clearTimeout(timer.current);const current=worker.current;worker.current=null;if(current){current.onmessage=null;current.postMessage({type:'dispose'});setTimeout(()=>current.terminate(),300)};phase.current='idle'}
 useEffect(()=>()=>dispose(),[])
 const failure=code=>{dispose();setBusy(false);setReady(false);setError(code)}
 const load=()=>{
  if(!agreed)return
  dispose();setError('');setStatus('');setBusy(true);setProgress(0);phase.current='loading'
  try{
   const current=new Worker(new URL('../semantic/recall.worker.js',import.meta.url),{type:'module'});worker.current=current
   current.onmessage=({data})=>{
    if(current!==worker.current)return
    if(data.status==='loading')setProgress(data.progress)
    if(data.status==='cache-unavailable')setCacheNotice(true)
    if(data.status==='ready'){clearTimeout(timer.current);setReady(true);setBusy(false);phase.current='ready'}
    if(data.status==='result'){clearTimeout(timer.current);setResults(data.results);setBusy(false);phase.current='ready'}
    if(data.status==='error')failure(data.code)
   }
   current.onerror=()=>failure('MODEL_UNAVAILABLE')
   timer.current=setTimeout(()=>failure('MODEL_TIMEOUT'),180000)
   current.postMessage({type:'load'})
  }catch{failure('MODEL_UNAVAILABLE')}
 }
 const query=()=>{
  if(!ready||!text.trim()||!agreed)return
  setBusy(true);setError('');setResults(null);phase.current='query'
  timer.current=setTimeout(()=>failure('MODEL_TIMEOUT'),30000)
  worker.current.postMessage({type:'query',text:text.trim()})
 }
 const clear=async()=>{
  dispose();setReady(false);setBusy(false);setText('');setResults(null);setAgreed(false)
  try{await caches.delete(EMBEDDING_MODEL.cache);setStatus(tr(lang,'أُزيلت ملفات النموذج المحفوظة لهذه الميزة.','Saved model files for this feature were removed.'))}catch{setError('CACHE_DELETE_FAILED')}
 }
 return <section className="semantic-recall"><div className="portable-head"><Sparkles size={27}/><div><small>{tr(lang,'استكشاف دلالي محلي · تجريبي','LOCAL SEMANTIC EXPLORATION · EXPERIMENTAL')}</small><h3>{tr(lang,'صف اهتمامك بكلماتك','Describe your interest in your own words')}</h3></div></div><p>{tr(lang,'مثل: «أحب اكتشاف الأنماط في الأرقام وشرحها للآخرين». يقترح نموذج متعدد اللغات مسارات قريبة في المعنى؛ ثم تفحص الشبكة أدلتها ومتطلباتها. لا يتحول النص إلى مهارة أو تفضيل معتمد.','Try “I enjoy finding patterns in numbers and explaining them to others.” A multilingual model recalls related pathways; the graph then checks evidence and requirements. Your text never becomes an approved skill or preference.')}</p>
 <details className="semantic-disclosure"><summary>{tr(lang,'فعّل الاستكشاف المحلي — اختياري','Enable local exploration — optional')}</summary><p>{tr(lang,'التنزيل الأول نحو 145 MB للنموذج ومشغّل WASM، وقد يحتاج عدة دقائق وذاكرة كافية. يعمل الحساب داخل جهازك؛ الخادم يستقبل طلبات الملفات العامة فقط، ولا يستقبل عبارتك. تُحفظ ملفات النموذج في ذاكرة المتصفح المؤقتة إن أمكن.','The first download is about 145 MB for the model and WASM runtime, and may take several minutes and sufficient memory. Computation stays on your device; the server receives only public asset requests, never your phrase. Model files are cached in the browser when available.')}</p><label><input type="checkbox" checked={agreed} disabled={busy} onChange={e=>{setAgreed(e.target.checked);if(!e.target.checked){dispose();setReady(false);setText('');setResults(null)}}}/> {tr(lang,'أوافق على التحليل المحلي وتحميل ملفات النموذج وحفظها على هذا الجهاز.','I agree to local analysis and downloading/caching model files on this device.')}</label><div className="query-actions"><button className="button secondary" disabled={!agreed||busy||ready} onClick={load}><Download size={17}/>{ready?tr(lang,'النموذج جاهز','Model ready'):tr(lang,'تحميل النموذج المحلي','Load local model')}</button><button className="text-button" onClick={clear}><Trash2 size={17}/>{tr(lang,'إيقاف الميزة وحذف ملفات النموذج','Stop and delete model files')}</button></div>{busy&&phase.current==='loading'&&<div role="status"><p>{tr(lang,`تحميل وتهيئة النموذج: ${progress}%`,`Loading and preparing model: ${progress}%`)}</p><progress value={progress} max="100" aria-label={tr(lang,'تقدم تحميل النموذج','Model download progress')}/></div>}
 {ready&&<><label htmlFor="free-interest">{tr(lang,'اهتمامك أو نشاط تستمتع به — حتى 300 حرف','An interest or activity you enjoy — up to 300 characters')}</label><textarea id="free-interest" value={text} maxLength={300} disabled={busy} onChange={e=>{setText(e.target.value);setResults(null)}}/><small>{tr(lang,'اكتب عن النشاط فقط. لا تضع أسماء أو معلومات صحية أو مالية. لا نحفظ هذا النص.','Describe only the activity. Do not enter names, health or financial information. This text is not saved.')}</small><div className="query-actions"><button className="button primary" disabled={busy||!text.trim()} onClick={query}><Sparkles size={17}/>{busy?tr(lang,'جارٍ البحث محليًا…','Searching locally…'):tr(lang,'اقترح مسارات قريبة','Suggest related pathways')}</button></div></>}
 </details>
 {cacheNotice&&<p className="semantic-status" role="status">{tr(lang,'تعذر حفظ بعض ملفات النموذج؛ قد تحتاج تنزيلها مجددًا عند العودة.','Some model files could not be cached; returning may require another download.')}</p>}
 {error&&<p className="semantic-error" role="alert">{error==='CACHE_DELETE_FAILED'?tr(lang,'تعذر حذف ذاكرة النموذج. راجع إعدادات بيانات الموقع في المتصفح.','Could not delete the model cache. Check the browser’s site-data settings.'):tr(lang,'تعذر تحميل النموذج أو تشغيله. تحقق من الاتصال ومساحة الجهاز، ثم أعد المحاولة. يمكنك استخدام اختيارات الاهتمامات المنظمة الآن.','The model could not load or run. Check connectivity and device space, then retry. Structured interest choices remain available.')}</p>}
 {status&&<p role="status">{status}</p>}
 {results!==null&&<div aria-live="polite"><h4>{tr(lang,'مسارات للاستكشاف، وليست أحكام ملاءمة','Pathways to explore, not fit judgments')}</h4>{results.length?<div className="recall-results">{results.map(({id})=>{const target=targetProfiles.find(t=>t.id===id),match=matches.find(m=>m.id===id);return <article key={id}><small>{tr(lang,'اقتراح من تشابه المعنى','Recalled by semantic similarity')}</small><h4>{target.title[lang]}</h4><p>{target.outcome[lang]}</p><strong>{tr(lang,'ما تفحصه الشبكة','What the graph checks')}</strong><ul>{(target.requiredSkills||[]).map(key=><li key={key}>{skills[key]?.labels?.[lang]||key} — {match?.missingSkills?.includes(key)?tr(lang,'يحتاج دليلًا','needs evidence'):match?tr(lang,'يوجد رابط دليل؛ راجع تفسيره','an evidence link exists; review it'):tr(lang,'افحص الدليل','check evidence')}</li>)}</ul>{!target.requiredSkills?.length&&<p>{tr(lang,'مسار تعلم بلا متطلب دخول محدد في الكتالوج.','Learning pathway without a catalogued entry requirement.')}</p>}<button className="text-button" onClick={()=>onInspect(id)}>{tr(lang,'افحص المسار وأدلته','Inspect pathway and evidence')}<Arrow size={17}/></button></article>})}</div>:<p>{tr(lang,'لم نجد قربًا دلاليًا كافيًا في الكتالوج المحدود. جرّب وصف النشاط بوضوح أو استخدم الخيارات المنظمة.','No sufficiently related item was found in the limited catalog. Describe the activity more clearly or use structured choices.')}</p>}<p>{tr(lang,'لا نعرض نسبة جاهزية أو نستنتج شخصية. الاستدعاء يرشح فقط؛ تبقى الأدلة والقواعد مصدر التفسير.','No readiness percentage or personality inference is produced. Recall only suggests candidates; evidence and rules remain the source of explanation.')}</p></div>}
 </section>
}

import { useId, useRef, useState } from 'react'
import { BadgeCheck, FileSearch, Trash2 } from 'lucide-react'
import { verifyCredential } from '../credentials/verify.js'
import { trustedIssuers } from '../credentials/issuers.js'
import { buildCredentialRecord } from '../credentials/records.js'

const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const outcomeLabel = { verified: ['موثّق من جهة إصدار معتمدة', 'Verified by a trusted issuer'], unverified: ['غير موثّق', 'Unverified'], unresolved: ['غير محسوم', 'Unresolved'] }
const reasonText = {
  'issuer:not-in-trusted-registry': ['جهة الإصدار ليست في سجل الجهات المعتمدة (السجل فارغ في هذه النسخة).', 'The issuer is not in the trusted-issuer registry (empty in this release).'],
  'proof:missing': ['لا توقيع رقمي في المستند.', 'The document carries no digital proof.'],
  'proof:unsupported-suite': ['نوع التوقيع غير مدعوم (المدعوم: eddsa-jcs-2022).', 'Unsupported proof suite (supported: eddsa-jcs-2022).'],
  'proof:signature-invalid': ['التوقيع لا يطابق المحتوى؛ قد يكون المستند عُدّل.', 'The signature does not match the content; the document may have been altered.'],
  'proof:verification-method-not-registered': ['مفتاح التوقيع غير مسجّل لهذه الجهة.', 'The signing key is not registered for this issuer.'],
  'proof:verification-failed': ['تعذر التحقق من التوقيع.', 'Signature verification failed.'],
  'validity:expired': ['انتهت صلاحية الاعتماد.', 'The credential has expired.'],
  'validity:not-yet-valid': ['الاعتماد لم يبدأ سريانه بعد.', 'The credential is not yet valid.'],
  'validity:invalid-dates': ['تواريخ الصلاحية غير صالحة.', 'Validity dates are invalid.'],
  'status:unresolved-no-status-service': ['حالة الإلغاء لا يمكن التحقق منها بلا خدمة حالة.', 'Revocation status cannot be checked without a status service.'],
}
const explain = (reason, lang) => reasonText[reason]?.[lang === 'ar' ? 0 : 1] || (reason.startsWith('structure:') ? tr(lang, `بنية غير صالحة: ${reason.slice(10)}`, `Invalid structure: ${reason.slice(10)}`) : reason)

export default function CredentialImport({ lang, records = [], onSave, onRemove }) {
  const id = useId()
  const fileRef = useRef(null)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const load = async file => {
    setError(''); setPending(null)
    if (!file) return
    try {
      if (file.size > 512 * 1024) throw new Error('TOO_LARGE')
      const doc = JSON.parse(await file.text())
      const result = await verifyCredential(doc, { trustedIssuers })
      setPending({ record: buildCredentialRecord(doc, result), result })
    } catch (e) {
      setError(e.message === 'TOO_LARGE' ? tr(lang, 'الملف أكبر من 512 كيلوبايت.', 'The file is larger than 512 KB.') : tr(lang, 'تعذر قراءة الملف كاعتماد JSON.', 'The file could not be read as a JSON credential.'))
    } finally { if (fileRef.current) fileRef.current.value = '' }
  }
  return <section className="panel credential-import" data-testid="credential-import" aria-label={tr(lang, 'استيراد اعتماد قابل للتحقق', 'Import a verifiable credential')}>
    <div className="panel-head"><div><small>{tr(lang, 'اعتماد محمول قابل للتحقق', 'VERIFIABLE PORTABLE CREDENTIAL')}</small><h3><BadgeCheck size={18}/> {tr(lang, 'استورد اعتمادًا موقّعًا وتحقق منه محليًا', 'Import a signed credential and verify it locally')}</h3></div></div>
    <p>{tr(lang, 'يُفحص المستند محليًا: البنية، وجهة الإصدار مقابل سجل الجهات المعتمدة، والتوقيع الرقمي (eddsa-jcs-2022)، والصلاحية، وحالة الإلغاء. الاعتماد يصبح «موثّقًا» فقط إذا نجحت كلها؛ وجود JSON-LD أو رمز QR أو ختم بصري لا يكفي. سجل الجهات المعتمدة فارغ في هذه النسخة، فكل استيراد يبقى غير موثّق حتى تُعتمد جهة بموجب اتفاق.', 'The document is checked locally: structure, issuer against the trusted-issuer registry, digital proof (eddsa-jcs-2022), validity window and revocation status. It is “verified” only when all pass; JSON-LD, a QR code or a visual seal is not enough. The registry is empty in this release, so every import stays unverified until an issuer is admitted under an agreement.')}</p>
    <label className="button secondary" htmlFor={`${id}-file`}><FileSearch size={16}/>{tr(lang, 'اختر ملف اعتماد (.json / .jsonld)', 'Choose a credential file (.json / .jsonld)')}</label>
    <input ref={fileRef} id={`${id}-file`} className="sr-only" type="file" accept=".json,.jsonld,application/json,application/ld+json" onChange={e => load(e.target.files?.[0])}/>
    {error && <p role="alert">{error}</p>}
    {pending && <div className={`credential-result ${pending.result.outcome}`} data-testid="credential-result" role="status">
      <strong>{outcomeLabel[pending.result.outcome][lang === 'ar' ? 0 : 1]}</strong>
      <span>{tr(lang, 'جهة الإصدار: ', 'Issuer: ')}{pending.record.issuerName || pending.record.issuerId || tr(lang, 'غير محددة', 'not stated')}{pending.record.achievements.length > 0 && <> · {tr(lang, 'إنجازات: ', 'achievements: ')}{pending.record.achievements.map(a => a.name || a.id).slice(0, 5).join(tr(lang, '، ', ', '))}</>}</span>
      {pending.result.reasons.length > 0 && <ul>{pending.result.reasons.map(r => <li key={r}>{explain(r, lang)}</li>)}</ul>}
      <div className="review-actions"><button type="button" className="button primary" onClick={() => { onSave(pending.record); setPending(null) }}>{tr(lang, 'احفظ نتيجة التحقق محليًا', 'Save the verification result locally')}</button><button type="button" className="button secondary" onClick={() => setPending(null)}>{tr(lang, 'تجاهل', 'Discard')}</button></div>
      <small>{tr(lang, 'يُحفظ ناتج التحقق ومعرّفات الإنجازات فقط، لا المستند نفسه.', 'Only the verification result and achievement identifiers are stored, not the document.')}</small>
    </div>}
    {records.length > 0 && <ul className="credential-list">{records.map(r => <li key={r.id}><span className={`provenance-badge ${r.outcome === 'verified' ? 'document' : r.outcome === 'unresolved' ? 'mixed' : 'declared'}`}>{outcomeLabel[r.outcome][lang === 'ar' ? 0 : 1]}</span><span>{r.issuerName || r.issuerId || '—'}</span><small>{new Date(r.importedAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB')}</small>{onRemove && <button type="button" className="text-button" onClick={() => onRemove(r.id)}><Trash2 size={14}/>{tr(lang, 'حذف', 'Remove')}</button>}</li>)}</ul>}
  </section>
}

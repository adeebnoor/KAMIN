import { Suspense, lazy, useRef, useState } from 'react'
import { Download, LockKeyhole, UploadCloud } from 'lucide-react'
import { copy } from '../../i18n.js'
import TechDetails from '../TechDetails.jsx'

const CredentialImport = lazy(()=>import('../CredentialImport.jsx'))

// Task 27 · section 3, "Back up and restore": the encrypted backup, restore (with its own
// passphrase field), the capabilities file and, on its own line at the end, importing a signed
// credential. Moved from Privacy.jsx word for word (Task 05 and the Oct 25 supervisor UX fix).
export default function BackupSection({ lang, state, onExport, onImport, onExportClr, onSaveCredential, onRemoveCredential, onBackupDone }) {
  const [backupPassphrase,setBackupPassphrase] = useState('')
  const [backupConfirm,setBackupConfirm] = useState('')
  // Supervisor UX fix (Oct 25): restore has its own passphrase field and its own inline error.
  const [restorePassphrase,setRestorePassphrase] = useState('')
  const [restoreError,setRestoreError] = useState('')
  const [backupStatus,setBackupStatus] = useState('')
  const [backupBusy,setBackupBusy] = useState(false)
  const backupFileRef = useRef(null)

  const messageFor = error => ({
    PASSPHRASE_TOO_SHORT:lang==='ar'?'استخدم عبارة مرور من 12 حرفًا على الأقل.':'Use a passphrase of at least 12 characters.',
    BACKUP_DECRYPT_FAILED:lang==='ar'?'تعذر فتح النسخة: عبارة المرور خاطئة أو الملف عُدّل/تلف.':'Could not open the backup: wrong passphrase or the file was modified/corrupted.',
    UNSUPPORTED_ENCRYPTED_PROFILE:lang==='ar'?'صيغة النسخة غير مدعومة.':'Unsupported backup format.',
    UNSUPPORTED_PORTABLE_PROFILE:lang==='ar'?'إصدار ملف كامن غير مدعوم.':'Unsupported Kamin profile version.',
    BACKUP_TOO_LARGE:lang==='ar'?'ملف النسخة أكبر من الحد المسموح.':'The backup file is larger than allowed.',
    INVALID_BACKUP_FILE:lang==='ar'?'الملف ليس نسخة كامن مشفّرة صالحة.':'This is not a valid encrypted Kamin backup.',
  }[error?.message] || (lang==='ar'?'تعذر إكمال العملية.':'The operation could not be completed.'))

  const exportBackup = async () => {
    if (backupPassphrase.length < 12) { setBackupStatus(messageFor(new Error('PASSPHRASE_TOO_SHORT'))); return }
    if (backupPassphrase !== backupConfirm) { setBackupStatus(lang==='ar'?'عبارتا المرور غير متطابقتين.':'Passphrases do not match.'); return }
    setBackupBusy(true); setBackupStatus('')
    try {
      await onExport(backupPassphrase)
      setBackupStatus(lang==='ar'?'تم إنشاء نسخة مشفّرة محلية. احفظها مع عبارة المرور في مكان آمن.':'Encrypted local backup created. Keep it and the passphrase in a safe place.')
      setBackupPassphrase(''); setBackupConfirm('')
      onBackupDone?.(Date.now())
    } catch (error) { setBackupStatus(messageFor(error)) }
    finally { setBackupBusy(false) }
  }

  const importBackup = async file => {
    if (!file) return
    setRestoreError('')
    if (restorePassphrase.length < 12) { setRestoreError(messageFor(new Error('PASSPHRASE_TOO_SHORT'))); if(backupFileRef.current) backupFileRef.current.value=''; return }
    setBackupBusy(true); setBackupStatus('')
    try {
      await onImport(file,restorePassphrase)
      setBackupStatus(lang==='ar'?'تمت استعادة الملف وإعادة حساب النتائج من الأدلة المحفوظة.':'Profile restored and derived results were recomputed from the saved evidence.')
      setRestorePassphrase('')
    } catch (error) { setRestoreError(messageFor(error)) }
    finally { setBackupBusy(false); if(backupFileRef.current) backupFileRef.current.value='' }
  }

  return <>
    <div className="panel portable-backup">
      <div className="portable-head"><LockKeyhole size={30}/><div><small>{lang==='ar'?'استمرارية بلا حساب مركزي':'Continuity without a central account'}</small><h3>{lang==='ar'?'نسخة محلية مشفّرة':'Encrypted local backup'}</h3></div></div>
      <p>{copy[lang].screens.myData.backup}</p><TechDetails lang={lang}>{copy[lang].screens.myData.technical.backup}</TechDetails>
      <label className="portable-field"><span>{lang==='ar'?'عبارة المرور':'Passphrase'}</span><input type="password" autoComplete="new-password" value={backupPassphrase} onChange={e=>setBackupPassphrase(e.target.value)} placeholder={lang==='ar'?'12 حرفًا على الأقل':'At least 12 characters'}/></label>
      <label className="portable-field"><span>{lang==='ar'?'تأكيد العبارة — مطلوب للتصدير فقط':'Confirm — export only'}</span><input type="password" autoComplete="new-password" value={backupConfirm} onChange={e=>setBackupConfirm(e.target.value)} placeholder={lang==='ar'?'أعد كتابة العبارة':'Repeat passphrase'}/></label>
      <div className="portable-actions">
        <button className="button primary" disabled={backupBusy || (!state.approved && !state.consents.insight && !state.recommendationReviews.length)} onClick={exportBackup}><Download size={17}/>{lang==='ar'?'تنزيل نسخة مشفّرة':'Download encrypted backup'}</button>
        {onExportClr&&<button className="button secondary" disabled={!state.approved && !state.projects?.length} onClick={onExportClr} data-testid="export-clr"><Download size={17}/>{copy[lang].screens.myData.exportFile}</button>}
      </div>
      <div className="portable-restore" data-testid="restore-backup"><h4>{lang==='ar'?'استعادة نسخة محفوظة':'Restore a saved backup'}</h4>
        <label className="portable-field"><span>{lang==='ar'?'عبارة مرور النسخة المستعادة':'Passphrase of the backup to restore'}</span><input type="password" autoComplete="current-password" value={restorePassphrase} onChange={e=>{setRestorePassphrase(e.target.value);setRestoreError('')}} aria-invalid={!!restoreError} aria-describedby={restoreError?'kamin-restore-error':undefined} placeholder={lang==='ar'?'العبارة التي استخدمتها عند إنشاء النسخة':'The passphrase you used when creating it'}/></label>
        {restoreError&&<p className="field-error" id="kamin-restore-error" role="alert">{restoreError}</p>}
        <button className="button secondary" disabled={backupBusy} onClick={()=>backupFileRef.current?.click()}><UploadCloud size={17}/>{lang==='ar'?'اختر ملف النسخة واستعدها':'Choose the backup file and restore'}</button>
        <input ref={backupFileRef} className="sr-only" type="file" accept=".kamin,application/json" aria-label={lang==='ar'?'ملف النسخة المشفّرة':'Encrypted backup file'} onChange={e=>importBackup(e.target.files?.[0])}/>
      </div>
      <small className="portable-note">{lang==='ar'
        ? 'عند الاستعادة يعيد كامن حساب المهارات والملاءمة من الأدلة؛ ولا يعيد تفعيل موافقات المشاركة مع المرشد/البحث تلقائيًا.'
        : 'On restore, Kamin recomputes skills and fit from evidence; advisor/research sharing consents are not automatically re-enabled.'}</small>
      {backupStatus&&<div className="portable-status" role="status" aria-live="polite">{backupStatus}</div>}
    </div>
    {onSaveCredential&&<Suspense fallback={<p role="status">{lang==='ar'?'جارٍ تحميل أداة التحقق…':'Loading the verifier…'}</p>}><CredentialImport lang={lang} records={state.credentials||[]} onSave={onSaveCredential} onRemove={onRemoveCredential}/></Suspense>}
  </>
}

import { useState } from 'react'
import { ShieldCheck, Trash2 } from 'lucide-react'
import { copy } from '../../i18n.js'
import TechDetails from '../TechDetails.jsx'
import { pageHref } from '../../../public/site-content.js'
import { deleteEverythingPreview } from '../../utils/dataControl.js'
import { readStudy } from '../../utils/pilotAnalytics.js'

// Task 27 · section 5, "Delete": the existing panel, its delete button and its confirmation,
// unchanged (moved from Privacy.jsx). startWithDeleteConfirm (Task 15) shows the confirmation at once.
export default function DeleteSection({ lang, state, onDelete, startWithDeleteConfirm = false }) {
  const t = copy[lang].app
  const [confirmDelete,setConfirmDelete] = useState(startWithDeleteConfirm)
  return <div className="panel privacy-actions"><ShieldCheck size={30}/><h3>{lang==='ar'?'ملفك تحت سيطرتك':'Your profile stays under your control'}</h3><p>{t.privacyNote}</p><p><a href={pageHref('runs-where.html',lang)} data-testid="runs-where-link">{lang==='ar'?'ما الذي يعمل وأين؟ كل ميزة ومكان بياناتها':'What runs where? Every feature and where its data is kept'}</a></p><TechDetails lang={lang}>{copy[lang].screens.myData.technical.storage}</TechDetails>{confirmDelete ? <DeleteEverythingConfirm lang={lang} state={state}><button className="button danger" onClick={onDelete}><Trash2 size={17}/>{lang==='ar'?'نعم، احذف كل شيء من هذا الجهاز':'Yes, delete everything from this device'}</button><button className="button secondary" onClick={()=>setConfirmDelete(false)}>{t.cancel}</button></DeleteEverythingConfirm> : <button className="button danger" onClick={()=>setConfirmDelete(true)}><Trash2 size={17}/>{t.delete}</button>}</div>
}

// Task 06: before deleting everything, list what will be removed from this device and what is
// outside KAMIN's control (downloaded backups, share links already sent).
function DeleteEverythingConfirm({ lang, state, children }) {
  const preview = deleteEverythingPreview(state, lang, { studyKept: readStudy() !== null })
  const items = preview.items.filter(i => i.count > 0)
  return <div className="delete-confirm" role="alertdialog" aria-labelledby="delete-all-title" data-testid="delete-everything-confirm">
    <p id="delete-all-title"><strong>{lang==='ar'?'سيُحذف من هذا الجهاز:':'This will be deleted from this device:'}</strong></p>
    <ul>{items.length ? items.map(i => <li key={i.label}>{i.count} {i.label}</li>) : <li>{lang==='ar'?'لا توجد بيانات محفوظة سوى إعدادات هذه الجلسة.':'Nothing saved except this session’s settings.'}</li>}</ul>
    <p>{lang==='ar'?'من: ':'From: '}{preview.stores.join(lang==='ar'?'، ':', ')}.</p>
    <TechDetails lang={lang}>{preview.storesTechnical}</TechDetails>
    {preview.kept && <p data-testid="delete-study-kept">{preview.kept}</p>}
    <p className="delete-outside">{preview.outside}</p>
    <div>{children}</div>
  </div>
}

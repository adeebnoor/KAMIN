// Signals, not verdicts: shown so silent tampering is harder and reviewers can verify at the source.
// Moved unchanged from src/App.jsx (Task 22): the review summary card and the start screen's upload
// error (Task 21) both use it.
export default function DocumentSignals({lang,document:doc}){
  if(!doc) return null
  const ar=lang==='ar'
  const rows=[]
  if(doc.kind==='pdf'){
    rows.push(doc.signed
      ? (doc.signatureCoversFile===false
        ? {tone:'warn',text:ar?'يحمل توقيعًا رقميًا، لكن الملف حُفظ مرة أخرى بعد التوقيع؛ قد يكون المحتوى تغيّر بعده.':'Carries a digital signature, but the file was saved again after signing; content may have changed since.'}
        : {tone:'ok',text:ar?'يحمل توقيعًا رقميًا يغطي الملف كاملًا. لم نتحقق من شهادة الموقّع.':'Carries a digital signature covering the whole file. The signer’s certificate was not verified.'})
      : {tone:'neutral',text:ar?'لا توقيع رقمي في الملف. كثير من الجامعات تصدر كشوفًا دون توقيع.':'No digital signature in the file. Many universities issue transcripts without one.'})
    if(doc.incrementalUpdates>0) rows.push({tone:'warn',text:ar?`حُفظ الملف ${doc.incrementalUpdates} مرة بعد إنشائه الأول.`:`The file was re-saved ${doc.incrementalUpdates} time(s) after it was first created.`})
    if(doc.editorSoftware) rows.push({tone:'warn',text:ar?`أُنتج أو عُدّل ببرنامج تحرير عام: ${doc.producer||doc.creator}.`:`Produced or edited with general-purpose software: ${doc.producer||doc.creator}.`})
    else if(doc.producer||doc.creator) rows.push({tone:'neutral',text:ar?`المنتج: ${doc.producer||doc.creator}.`:`Producer: ${doc.producer||doc.creator}.`})
    if(doc.modifiedAfterCreation) rows.push({tone:'warn',text:ar?'تاريخ آخر تعديل يأتي بعد تاريخ الإنشاء.':'The last-modified date is later than the creation date.'})
  }
  for(const qr of doc.qr||[]){
    rows.push(qr.url
      ? {tone:'ok',link:qr.url,text:ar?`رمز QR يشير إلى ${qr.host}. الفتح يرسل الرابط إلى ذلك الموقع فقط عند نقرك.`:`A QR code points to ${qr.host}. Opening it sends the link to that site only when you click.`}
      // Task 55: the text of a QR code that is not a link is never shown (it may hold the student number).
      : {tone:'neutral',text:ar?'يحمل المستند رمز QR بنص ليس رابطًا. لا نعرض نصه لأنه قد يتضمن بيانات شخصية مثل الرقم الجامعي.':'The document carries a QR code with text that is not a link. Its text is not shown, because it may hold personal details such as a student number.'})
  }
  if(!rows.length) return null
  return <div className="document-signals" data-testid="document-signals">
    <strong>{ar?'إشارات سلامة المستند — تُحسب محليًا ولا تُثبت الأصالة':'Document integrity signals — computed locally; they do not prove authenticity'}</strong>
    <ul>{rows.map((row,i)=><li key={i} className={row.tone}>{row.text}{row.link&&<> <a href={row.link} target="_blank" rel="noopener noreferrer">{ar?'تحقق من المصدر':'Verify at the source'}</a></>}</li>)}</ul>
    <small>{ar?'الإشارات لا تُغيّر أي حكم. مستوى الإثبات يبقى «مدعومًا بمستند» حتى يتحقق مُصدر معتمد.':'Signals change no judgment. The evidence level stays “document-backed” until an authorized issuer verifies it.'}</small>
  </div>
}

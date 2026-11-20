// Task 46 · the usage log says what happened, never what the student wrote or how they named a file.
// Transcript files are often named after the student ("Transcript_<name>_<number>.pdf"). Before Task 46
// the upload line copied the file name and the project line copied the project title, and both stayed in
// session storage, on the device (IndexedDB) and in encrypted backups, even after delete or withdrawal.
//
// One rule, used everywhere a profile is loaded or data is deleted: an audit line written in one of the
// old formats is dropped. `normalizeState` (App.jsx), `readLocalProfile` (localProfileStore.js),
// `buildPortableProfile` / `normalizePortableState` (portableProfile.js) and `deleteItem` /
// `withdrawConsent` (dataControl.js) all call `cleanAuditEntries`.

// The label prefixes of the old lines, both languages. Everything after the prefix was student content.
export const OLD_AUDIT_PREFIXES = Object.freeze([
  'Local file read: ',
  'قراءة ملف محلي: ',
  'Self-declared applied evidence recorded: ',
  'تسجيل دليل تطبيقي مصرّح: ',
])

/** True when an audit label is in an old format that carries a file name or a project title. */
export const isStudentContentAuditLabel = label =>
  typeof label === 'string' && OLD_AUDIT_PREFIXES.some(prefix => label.trimStart().startsWith(prefix))

/**
 * The usage log without old-format lines (and without entries that are not objects), newest first,
 * at most `max` entries. Every other line is kept exactly as it was, with its time.
 */
export function cleanAuditEntries(entries, max = 100) {
  if (!Array.isArray(entries)) return []
  return entries.filter(entry => entry && typeof entry === 'object' && !isStudentContentAuditLabel(entry.label)).slice(0, max)
}

/**
 * A fixed code for the browser console instead of the raw error object: a short upper-case code such as
 * `PDF_OPEN_FAILED` is passed through, any other message (which could quote a file name or file text) is
 * replaced by `UNEXPECTED_ERROR`.
 */
export const errorCode = error => {
  const message = typeof error?.message === 'string' ? error.message : ''
  return /^[A-Z][A-Z0-9_]{2,63}$/.test(message) ? message : 'UNEXPECTED_ERROR'
}

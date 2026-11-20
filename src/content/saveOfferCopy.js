// Task 65 · the offer to keep the profile on this device (the dashboard's words, src/components/Dashboard.jsx, and
// the message after keeping it, src/App.jsx), moved here unchanged so the new interface's My plan makes the same
// offer word for word. [Arabic, English] pairs.
export const SAVE_OFFER = Object.freeze({
  question: ['ملفك مؤقت في هذه الجلسة. هل تريد الاحتفاظ به على هذا الجهاز؟', 'Your profile lasts only for this session. Keep it on this device?'],
  detail: ['يُحفظ على جهازك فقط بعد موافقتك، ويمكنك حذفه في أي وقت.', 'It is stored on this device only, with your consent, and you can delete it at any time.'],
  keep: ['نعم، احتفظ بملفي', 'Yes, keep my profile'],
  notNow: ['ليس الآن', 'Not now'],
  kept: ['حُفظ ملفك على هذا الجهاز. احتفظ أيضًا بنسخة احتياطية مشفّرة.', 'Your profile was saved on this device. Keep an encrypted backup too.'],
  savedNote: ['ملفك محفوظ محليًا على هذا الجهاز بموافقتك.', 'Your profile is saved on this device, with your consent.'],
})
export const saveOffer = (key, lang) => SAVE_OFFER[key][lang === 'ar' ? 0 : 1]

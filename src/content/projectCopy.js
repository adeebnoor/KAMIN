// Task 63 · the self-declared project sentences, in one place, so both interfaces show the same words (the old
// panel, src/components/ProjectEvidence.jsx, and step 2 of the new interface, src/ui2/screens/Projects.jsx).
// They are the old panel's sentences word for word (moved here unchanged; e2e/keep-features.spec.js K03 holds
// them literally). The evidence rule is unchanged too: a project is self-declared, never a capability, and
// changes no evidence level (src/utils/projectEvidence.js).
export const PROJECT_COPY = Object.freeze({
  ar: Object.freeze({
    badge: 'تصريح ذاتي · بانتظار مراجعة',
    rule: 'مشروع أو شهادة أو تدريب يغطي فجوة في ملفك. يُسجَّل كتصريح ذاتي بمستوى «تطبيقي مصرّح»، ولا يصبح قدرة أو يغيّر الملاءمة حتى يراجعه مستشار أو تتحقق منه جهة معتمدة.',
    saved: 'سُجّل الدليل محليًا كتصريح ذاتي. لم يُضف قدرة ولم يتغيّر أي حكم؛ يرتفع مستواه فقط بعد مراجعة مستشار أو جهة معتمدة.',
    urlError: 'الرابط يجب أن يبدأ بـ https://، أو اتركه فارغًا.',
    invalid: 'تعذر تسجيل الدليل. أكمل العنوان واختر قدرة واحدة على الأقل.',
    abstain: 'غير محسوم: لا جملة في الوصف تدعم اقتراحًا. اختر القدرات بنفسك أو أضف تفاصيل عمّا نفذته.',
    suggestNote: 'الاقتراح لا يضيف قدرة ولا يغيّر مستوى إثبات؛ ما تحدده أنت هو ما يُحفظ. الطريقة: مطابقة قاموس محلي مع اقتباس الجملة الداعمة، دون نموذج خارجي.',
    openLink: 'فتح الرابط',
    limit: max => `وصل السجل إلى ${max} دليلًا. احذف دليلًا قديمًا للمتابعة.`,
  }),
  en: Object.freeze({
    badge: 'Self-declared · awaiting review',
    rule: 'A project, certificate or internship that covers a gap in your profile. It is recorded as self-declared "applied" evidence and never becomes a capability or changes Fit until an advisor reviews it or an authorized issuer verifies it.',
    saved: 'Recorded locally as self-declared evidence. No capability was added and no judgment changed; the level rises only after an advisor or authorized issuer reviews it.',
    urlError: 'The link must start with https://, or leave it empty.',
    invalid: 'Could not record the evidence. Complete the title and choose at least one capability.',
    abstain: 'Unresolved: no sentence in the description supports a suggestion. Choose capabilities yourself or add detail about what you did.',
    suggestNote: 'A suggestion adds no capability and changes no evidence level; only what you tick is saved. Method: local lexicon matching that quotes the supporting sentence, with no external model.',
    openLink: 'Open link',
    limit: max => `The record holds ${max} entries. Remove an older one to continue.`,
  }),
})

export const projectCopy = lang => PROJECT_COPY[lang === 'en' ? 'en' : 'ar']

export const TRUST_MICROCOPY = Object.freeze({
  digitalInterests:{
    ar:'بلا ربط حسابات أو إرسال نصوصك إلى خادم. لن تُحفظ المنشورات الأصلية. التخطي متاح، ولن تُضاف مهارة أو درجة ملاءمة بسبب الإفصاح.',
    en:'No account connection or text sent to a server. Original posts are not saved. You can skip; disclosure does not add a skill or improve a fit judgment.',
  },
  transcript:{
    ar:'كشف درجاتك لا يغادر جهازك — كل القراءة والتحليل يحدثان هنا في متصفحك.',
    en:'Your transcript never leaves your device — all reading and analysis happen here in your browser.',
  },
  preferences:{
    ar:'تفضيلاتك تبقى على جهازك ما لم تختر أنت مشاركة مستقلة ومفعّلة لاحقًا.',
    en:'Your preferences stay on your device unless you later choose a separately enabled sharing flow.',
  },
})

export const trustMicrocopy = (surface='transcript',lang='ar') => {
  const item=TRUST_MICROCOPY[surface]||TRUST_MICROCOPY.transcript
  return item[lang]||item.ar
}

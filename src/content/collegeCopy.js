// Task 55 · the words for the college line, its note and the one-tap fix. Kept apart from i18n.js so
// they load with the review screen and the dashboard note (lazy), not with the first page.
export const COLLEGE_COPY = Object.freeze({
  ar: Object.freeze({
    college: 'الكلية',
    major: 'التخصص',
    notRight: 'ليست صحيحة؟',
    fix: 'تصحيح',
    listLabel: 'اختر كليتك',
    which: 'من أي كلية هذه المقررات؟',
    unrecognised: 'لم نتعرّف على كليتك: «{raw}»',
    notFound: 'لم نجد كليتك في هذا الكشف.',
    noMap: 'لا خريطة مقررات معتمدة لهذه الكلية بعد، فلا تنتج مقرراتها قدرات.',
    saved: 'مقرراتك محفوظة؛ تظهر القدرات حين تكون لكليتك خريطة مقررات معتمدة.',
  }),
  en: Object.freeze({
    college: 'College',
    major: 'Major',
    notRight: 'Not right?',
    fix: 'Fix',
    listLabel: 'Choose your college',
    which: 'Which college are these courses from?',
    unrecognised: 'We couldn’t recognise your college: «{raw}»',
    notFound: 'We couldn’t find your college on this transcript.',
    noMap: 'This college has no approved course map yet, so its courses create no capability.',
    saved: 'Your courses are saved; capabilities appear when your college has an approved course map.',
  }),
})

export const collegeCopy = lang => COLLEGE_COPY[lang === 'ar' ? 'ar' : 'en']

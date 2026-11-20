// Task 18 · the trial consent text and the end-of-session form, in Arabic and English.
// STATUS: APPROVED by the supervisor (approval recorded by the team on 2026-11-11). The version is
// written into every study file so the team knows which text a participant agreed to. Any change to the
// text needs a new approval and a new `version`; set `approved` back to false until then (the screen
// then shows the draft notice again).
// Task 44 (2026-11-19): version 2 adds one point (the fifth) saying the file also counts how the suggestions were used,
// numbers and the method's version only (src/pilot/studyCounts.js). Every other sentence is v1's, word for word.
// Approved under Amjd's standing approval of 2026-11-18 (the supervisor approved the tasks that need approval);
// v1 was 'pilot-consent-v1-2026-11-11'. A participant who agreed to v1 records no suggestion counts.

export const PILOT_CONSENT = Object.freeze({
  version: 'pilot-consent-v2-2026-11-19',
  approved: true,
  approvedOn: '2026-11-19',
  ar: {
    title: 'المشاركة في تجربة كامن',
    draftNotice: 'نص مسودة لم يعتمده المشرف بعد. لا تُستخدم مع مشاركين قبل اعتماده.',
    intro: 'نختبر سهولة استخدام كامن مع طلاب كلية الحاسبات وتقنية المعلومات. نختبر التطبيق، لا نختبرك أنت.',
    points: [
      'المشاركة طوعية. يمكنك التوقف أو الانسحاب في أي وقت دون ذكر سبب، ولا يؤثر ذلك على درجاتك أو علاقتك بالكلية.',
      'تستخدم سجلًا أكاديميًا وهميًا جاهزًا، لا سجلك الحقيقي.',
      'تبقى بيانات التجربة على هذا الجهاز ولا تُرسل إلى أي خادم.',
      'في النهاية ترى «ملف الدراسة المجهول» كاملًا، ثم تقرر بنفسك أن تنزّله وتسلّمه للفريق. يحتوي على رمز دراسة عشوائي، وأوقات تقريبية لخطوات الاستخدام، ونتيجة المهام الست، وإجابة سؤال واحد، وتعليقك الاختياري. لا يحتوي على اسمك أو رقمك الجامعي أو أي درجة أو مقرر.',
      'ويعدّ الملف أيضًا كيف استخدمت الاقتراحات: كم مهارة مقترحة أبقيت أو أزلت أو أضفت بنفسك، وكم خطوة تالية أخذت أو استبعدت أو حذفت من خطتك. يحتوي على أرقام وإصدار طريقة الاقتراح فقط، ولا يحتوي أبدًا على نص مشروعك ولا على المهارات أو المقررات نفسها.',
      'زر «الانسحاب من الدراسة» متاح طوال الجلسة ويحذف بيانات التجربة من هذا الجهاز فورًا. إذا سلّمت الملف ثم أردت الانسحاب، أعطِ الفريق رمز الدراسة ليحذفه.',
      'يحذف الفريق الملفات بعد انتهاء التحليل، في المدة التي يحددها البروتوكول المعتمد.',
    ],
    agree: 'قرأت ما سبق وأوافق على المشاركة',
    start: 'ابدأ الجلسة',
    decline: 'لا، أريد استخدام كامن دون المشاركة',
  },
  en: {
    title: 'Taking part in the Kamin trial',
    draftNotice: 'Draft text, not yet approved by the supervisor. Do not use with participants before approval.',
    intro: 'We are testing how easy Kamin is to use with students of the Faculty of Computing and Information Technology. We are testing the app, not you.',
    points: [
      'Taking part is voluntary. You can stop or withdraw at any time without giving a reason, and it does not affect your grades or your standing with the faculty.',
      'You use a ready-made synthetic transcript, not your own record.',
      'The trial data stays on this device and is not sent to any server.',
      'At the end you see the whole “anonymous study file”, then decide yourself whether to download it and hand it to the team. It holds a random study code, rounded times of the steps you took, the result of the six tasks, the answer to one question and your optional comment. It holds no name, student ID, grade or course.',
      'The file also counts how you used the suggestions: how many suggested skills you kept, removed or added yourself, and how many next steps you took, set aside or removed from your plan. It holds numbers and the version of the suggestion method only, never your project text or the skills and courses themselves.',
      'The “Withdraw from the study” button is there for the whole session and deletes the trial data from this device at once. If you already handed over the file and want to withdraw, give the team your study code and they delete it.',
      'The team deletes the files after the analysis, within the period set by the approved protocol.',
    ],
    agree: 'I have read the above and agree to take part',
    start: 'Start the session',
    decline: 'No, I want to use Kamin without taking part',
  },
})

export const PILOT_COPY = Object.freeze({
  ar: {
    bar: 'جلسة تجربة', code: 'رمز الدراسة', finish: 'إنهاء الجلسة', withdraw: 'الانسحاب من الدراسة',
    withdrawConfirm: 'سيُحذف كل ما سُجّل في هذه الجلسة من هذا الجهاز. هل تريد الانسحاب؟', withdrawYes: 'نعم، انسحب واحذف', cancel: 'إلغاء',
    withdrawn: 'انسحبت من الدراسة. لم يبقَ شيء من بيانات التجربة على هذا الجهاز.',
    formTitle: 'نهاية الجلسة', formIntro: 'تُملأ مع الميسّر. لكل مهمة: نجحت وحدك، أو بمساعدة، أو لم تكتمل.',
    outcomes: { success: 'نجحت وحدي', 'with-help': 'بمساعدة', failed: 'لم تكتمل' },
    tasks: {
      'build-profile': '1. بناء الملف من السجل الوهمي',
      'find-evidence': '2. معرفة المقررات التي تدعم قدرة',
      'understand-recommendation': '3. فهم سبب اقتراح مسار وما ينقصه',
      'choose-learning-step': '4. اختيار مقرر وإضافته إلى المقارنة',
      'save-and-restore': '5. الحفظ ثم الاستعادة من النسخة الاحتياطية',
      'correct-withdraw-delete': '6. تعديل درجة، وسحب الموافقة، وحذف كل شيء',
    },
    clarity: 'بشكل عام، ما مدى وضوح ما عليك فعله في كامن؟', clarityScale: ['1 غير واضح أبدًا', '2', '3', '4', '5 واضح جدًا'], clarityNone: 'أفضّل ألا أجيب',
    comment: 'تعليق (اختياري): ما الذي أربكك، إن وُجد؟', commentWarning: 'لا تكتب اسمك أو رقمك الجامعي أو بريدك أو رقم هاتفك أو أي درجة.',
    commentBlocked: 'يبدو أن التعليق يحتوي على بريد أو رقم طويل. احذفه ثم احفظ.',
    save: 'احفظ الإجابات', saved: 'حُفظت الإجابات على هذا الجهاز.',
    reviewTitle: 'ما سيحتويه الملف', reviewIntro: 'هذا هو الملف كاملًا كما سيُنزَّل. لا شيء غيره.',
    download: 'نزّل ملف الدراسة المجهول', downloaded: 'نُزّل الملف. سلّمه للفريق، ثم احذف بيانات الجلسة من هذا الجهاز.',
    endSession: 'احذف بيانات الجلسة من هذا الجهاز', ended: 'حُذفت بيانات الجلسة من هذا الجهاز.',
    close: 'إغلاق',
    syntheticButton: 'استخدم السجل الوهمي للدراسة',
  },
  en: {
    bar: 'Trial session', code: 'Study code', finish: 'Finish the session', withdraw: 'Withdraw from the study',
    withdrawConfirm: 'Everything recorded in this session will be deleted from this device. Withdraw?', withdrawYes: 'Yes, withdraw and delete', cancel: 'Cancel',
    withdrawn: 'You have withdrawn from the study. No trial data is left on this device.',
    formTitle: 'End of the session', formIntro: 'Filled in with the facilitator. For each task: done alone, with help, or not completed.',
    outcomes: { success: 'Done alone', 'with-help': 'With help', failed: 'Not completed' },
    tasks: {
      'build-profile': '1. Build the profile from the synthetic transcript',
      'find-evidence': '2. Find which courses support a capability',
      'understand-recommendation': '3. Find why a path was suggested and what is missing',
      'choose-learning-step': '4. Choose a course and add it to the comparison',
      'save-and-restore': '5. Save, then restore from the backup',
      'correct-withdraw-delete': '6. Change a grade, withdraw consent, delete everything',
    },
    clarity: 'Overall, how clear was it what to do in Kamin?', clarityScale: ['1 not clear at all', '2', '3', '4', '5 very clear'], clarityNone: 'I prefer not to answer',
    comment: 'Comment (optional): what, if anything, confused you?', commentWarning: 'Do not type your name, student ID, email, phone number or any grade.',
    commentBlocked: 'The comment seems to contain an email address or a long number. Remove it, then save.',
    save: 'Save the answers', saved: 'Answers saved on this device.',
    reviewTitle: 'What the file will contain', reviewIntro: 'This is the whole file exactly as it will be downloaded. Nothing else.',
    download: 'Download my anonymous study file', downloaded: 'File downloaded. Hand it to the team, then delete the session data from this device.',
    endSession: 'Delete the session data from this device', ended: 'The session data was deleted from this device.',
    close: 'Close',
    syntheticButton: 'Use the study’s synthetic transcript',
  },
})

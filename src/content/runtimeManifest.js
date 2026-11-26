// Task 16 · What runs where. One entry per feature: where it runs, what data it touches and where
// that data is kept. The public page "What runs where" (scripts/runs-where-page.mjs) is generated
// from this file, and tests/networkGuard.test.js ties every network call in src/ to an entry here.
//
// runsIn is 'browser' or 'not-built'. Nothing is 'server': KAMIN has no server that receives or
// processes student data. The host only serves the site's files (pages, scripts, fonts, model).

export const RUNS_IN = Object.freeze(['browser', 'not-built'])

// Where a feature keeps the data it touches.
export const STORED_IN = Object.freeze({
  nowhere: { ar: 'لا يُحفظ: يُستخدم في الذاكرة ثم يُترك', en: 'Not kept: used in memory, then dropped' },
  session: { ar: 'جلسة هذا التبويب (sessionStorage)، وتُمسح عند إغلاقه', en: 'This tab’s session (sessionStorage), cleared when it closes' },
  device: { ar: 'هذا الجهاز (IndexedDB) فقط إذا اخترت «احتفظ بملفي»', en: 'This device (IndexedDB), only if you choose “Keep my profile”' },
  cache: { ar: 'ذاكرة المتصفح المؤقتة (Cache Storage): ملفات الموقع العامة فقط، لا بياناتك', en: 'Browser cache (Cache Storage): public site files only, never your data' },
  file: { ar: 'ملف مشفّر تنزّله أنت وتحتفظ به حيث تشاء', en: 'An encrypted file you download and keep wherever you choose' },
  link: { ar: 'داخل الرابط نفسه بعد علامة # التي لا يرسلها المتصفح إلى الموقع', en: 'Inside the link itself, after the #, which browsers never send to the site' },
  study: { ar: 'هذا الجهاز (التخزين المحلي) أثناء جلسة التجربة، ثم ملف تنزّله أنت وتسلّمه للفريق بنفسك', en: 'This device (localStorage) during the trial session, then a file you download and hand to the team yourself' },
  repo: { ar: 'بيانات مرجعية عامة مضمّنة في الموقع، لا بيانات طالب', en: 'Public reference data shipped with the site, no student data' },
  none: { ar: 'غير موجود', en: 'Does not exist' },
})

const f = (id, runsIn, name, does, data, storedIn, code = [], network = null) =>
  Object.freeze({ id, runsIn, name, does, data, storedIn, code: Object.freeze(code), network })

export const RUNTIME_MANIFEST = Object.freeze([
  f('transcript-reading', 'browser',
    { ar: 'قراءة السجل الأكاديمي', en: 'Reading your transcript' },
    { ar: 'يقرأ ملف PDF بمكتبة PDF.js، والصورة بالتعرّف الضوئي Tesseract، داخل متصفحك. ملفات القراءة تُحمَّل من الموقع نفسه.', en: 'Reads a PDF with PDF.js and an image with Tesseract OCR, inside your browser. The reader files load from this site.' },
    { ar: 'الملف الذي تختاره، والمقررات والدرجات المستخرجة منه', en: 'The file you pick, and the courses and grades read from it' },
    'session', ['src/utils/transcript.js', 'src/utils/documentIntegrity.js']),
  f('course-mapping', 'browser',
    { ar: 'ربط المقررات بالقدرات', en: 'Linking courses to capabilities' },
    { ar: 'يربط كل مقرر بالقدرات وفق خريطة الكتالوج الرسمي المضمّنة في الموقع.', en: 'Links each course to capabilities using the official catalog map shipped with the site.' },
    { ar: 'رموز مقرراتك ودرجاتها', en: 'Your course codes and grades' },
    'session', ['src/catalog/colleges.js', 'src/utils/engine.js']),
  f('evidence-levels', 'browser',
    { ar: 'مستويات الدليل', en: 'Evidence levels' },
    { ar: 'يحدد مستوى الدليل لكل قدرة بقواعد مكتوبة. الدرجة قرينة لا ضمان، ولا تُعرض نسب مئوية.', en: 'Sets each capability’s evidence level by written rules. A grade is a clue, not a guarantee; no percentages are shown.' },
    { ar: 'مقرراتك المعتمدة', en: 'Your approved courses' },
    'session', ['src/evidence/levels.js', 'src/evidence/recompute.js']),
  f('matching', 'browser',
    { ar: 'المسارات والدورات المقترحة', en: 'Suggested pathways and courses' },
    { ar: 'يقارن قدراتك بمتطلبات المسارات المرجعية بقواعد وشبكة علاقات محلية، ويشرح الأدلة والفجوات.', en: 'Compares your capabilities with reference pathways using rules and a local relationship graph, and explains evidence and gaps.' },
    { ar: 'قدراتك وهدفك واهتماماتك', en: 'Your capabilities, goal and interests' },
    'session', ['src/matching', 'src/network']),
  // Task 19: planned feature, early version. The list is a local file reviewed by the team; nothing is fetched.
  f('learning-path', 'browser',
    { ar: 'مسار التعلم المقترح (ميزة مخطط لها)', en: 'Suggested learning path (planned feature)' },
    { ar: 'يقارن مستويات أدلتك بما يتطلبه المجال الذي تختاره، ثم يقترح من قائمة محلية يراجعها الفريق ما يسدّ الفجوة فقط، مع سبب كل اقتراح. روابط المزوّدين نص للعرض فقط ولا يُجلب منها شيء.', en: 'Compares your evidence levels with what the field you choose requires, then suggests, from a local list the team reviews, only what closes that gap, with the reason for each. Provider links are display text only; nothing is fetched from them.' },
    { ar: 'مستويات أدلة قدراتك، والمجال الذي تختاره (لا يُحفظ)', en: 'Your capabilities’ evidence levels, and the field you choose (not kept)' },
    'nowhere', ['src/path/gap.js', 'src/path/suggest.js', 'src/catalog/learning-opportunities.json', 'src/path/nextSteps.js', 'src/ui2/screens/NextSteps.jsx']), // Task 70: step 4 replaces LearningPath.jsx
  f('project-suggestion', 'browser',
    { ar: 'اقتراح القدرات من وصف مشروع', en: 'Suggesting capabilities from a project description' },
    { ar: 'يقترح قدرات من وصف تكتبه، بمعجم محلي مضمّن في الموقع. لا يُرسل النص إلى أي خدمة.', en: 'Suggests capabilities from a description you write, using a local word list shipped with the site. The text is not sent anywhere.' },
    { ar: 'وصف المشروع الذي تكتبه', en: 'The project description you write' },
    'session', ['src/ai/projectSuggestImproved.js', 'src/ai/lexicon/capabilities.json']),
  f('embeddings', 'browser',
    { ar: 'البحث بالمعنى في الاهتمامات، و«انظر أعمق» في المشاريع (تجربة للمراجعين فقط، غير مفعّلة افتراضيًا)', en: 'Searching by meaning: interests, and “Look deeper” on projects (a reviewers’ trial only, off by default)' },
    { ar: 'نموذج لغوي صغير (MiniLM) يعمل في متصفحك. يُحمَّل من الموقع نفسه مرة واحدة عند طلبك، ولا يُستخدم أي نموذج بعيد.', en: 'A small language model (MiniLM) runs in your browser. It loads from this site once, when you ask for it; no remote model is used.' },
    { ar: 'عبارة الاهتمام التي تكتبها، أو وصف المشروع حين تضغط «انظر أعمق» (لا يُحفظ أي منهما)، وملفات النموذج العامة', en: 'The interest phrase you type, or the project description when you press “Look deeper” (neither is kept), and the public model files' },
    // Task 43: the same worker also runs the project step's "Look deeper" (src/ai/hybridFallback.js). Task 80 made hybrid
    // the default; Task 80b put it back behind ?suggest=hybrid, so the row names both uses and says the second is opt-in.
    'cache', ['src/semantic/recall.worker.js', 'src/semantic/config.js', 'src/ai/hybridFallback.js', 'src/ui2/components/LookDeeper.jsx'],
    { primitive: 'fetch', target: 'same-origin', what: { ar: 'ملفات النموذج من /models/ على الموقع نفسه', en: 'Model files from /models/ on this site' } }),
  f('knowledge-explorer', 'browser',
    { ar: 'مستكشف المعرفة', en: 'Knowledge explorer' },
    { ar: 'يشغّل استعلامات القراءة فقط على بيانات الكتالوج المرجعية داخل متصفحك.', en: 'Runs read-only queries over the reference catalog data inside your browser.' },
    { ar: 'بيانات الكتالوج العامة', en: 'Public catalog data' },
    'repo', ['src/knowledge/runQuery.js', 'src/knowledge/query.worker.js']),
  f('local-save', 'browser',
    { ar: 'الحفظ على هذا الجهاز', en: 'Saving on this device' },
    { ar: 'يبقى ملفك في جلسة التبويب. إذا اخترت «احتفظ بملفي» يُحفظ في هذا المتصفح فقط، ويمكنك حذفه في أي وقت.', en: 'Your profile stays in the tab’s session. If you choose “Keep my profile” it is kept in this browser only, and you can delete it at any time.' },
    { ar: 'ملفك كاملًا: المقررات والقدرات والهدف والموافقات', en: 'Your whole profile: courses, capabilities, goal and consents' },
    'device', ['src/utils/localProfileStore.js', 'src/utils/dataControl.js']),
  f('encrypted-backup', 'browser',
    { ar: 'النسخة الاحتياطية المشفّرة', en: 'Encrypted backup' },
    { ar: 'يشفّر ملفك بعبارة مرور تختارها (AES-GCM) وينزّله ملفًا. لا تُحفظ عبارة المرور، ولا تُرفع النسخة إلى أي مكان.', en: 'Encrypts your profile with a passphrase you choose (AES-GCM) and downloads it as a file. The passphrase is not kept and the backup is not uploaded.' },
    { ar: 'ملفك وعبارة المرور', en: 'Your profile and passphrase' },
    'file', ['src/utils/portableProfile.js']),
  f('share-link', 'browser',
    { ar: 'رابط مشاركة القدرات', en: 'Capability share link' },
    { ar: 'يشفّر القدرات التي تختارها فقط ويضعها مع مفتاحها في الرابط بعد علامة #. يصل الرابط إلى من ترسله إليه أنت فقط.', en: 'Encrypts only the capabilities you choose and puts them, with their key, in the link after the #. The link reaches only the people you send it to.' },
    { ar: 'القدرات التي تختارها وهدفك', en: 'The capabilities you choose and your goal' },
    'link', ['src/utils/capabilitySnapshot.js', 'src/utils/snapshotLink.js']),
  f('credential-verification', 'browser',
    { ar: 'التحقق من الشهادات الرقمية', en: 'Checking digital credentials' },
    { ar: 'يتحقق من توقيع الشهادة داخل متصفحك. قائمة الجهات الموثوقة فارغة في هذه النسخة، فتبقى كل شهادة «غير متحقق منها».', en: 'Checks a credential’s signature in your browser. The trusted-issuer list is empty in this release, so every credential stays “unverified”.' },
    { ar: 'نتيجة التحقق فقط، لا وثيقة الشهادة', en: 'The result only, not the credential document' },
    'session', ['src/credentials/verify.js', 'src/credentials/issuers.js']),
  f('offline-cache', 'browser',
    { ar: 'العمل دون اتصال', en: 'Working offline' },
    { ar: 'عامل خدمة يحفظ نسخة من صفحات الموقع وملفاته العامة ليفتح دون اتصال. يتجاهل أي عنوان خارج الموقع.', en: 'A service worker keeps a copy of the site’s pages and public files so it opens offline. It ignores any address outside the site.' },
    { ar: 'ملفات الموقع العامة فقط', en: 'Public site files only' },
    'cache', ['public/sw.js', 'src/main.jsx'],
    { primitive: 'fetch', target: 'same-origin', what: { ar: 'صفحات الموقع وملفاته فقط', en: 'This site’s pages and files only' } }),
  // Task 18: the trial runs in the browser; the study file is handed over by the participant, never sent.
  f('pilot-feedback', 'browser',
    { ar: 'تجربة الطلاب (وضع الدراسة)', en: 'Student trial (study mode)' },
    { ar: 'يعمل فقط مع رابط الدراسة وبعد موافقة المشارك. يسجّل على هذا الجهاز أسماء بعض الخطوات بأوقات مقرّبة إلى الدقيقة، ونتيجة المهام الست، وأعدادًا فقط عن استخدام الاقتراحات، ونموذج النهاية. يراجع المشارك «ملف الدراسة المجهول» وينزّله ويسلّمه للفريق؛ لا يُرسل شيء.', en: 'Only with the study link and after the participant agrees. Records on this device a few step names with times rounded to the minute, the six task results, counts only of how the suggestions were used, and the end-of-session form. The participant reviews the “anonymous study file”, downloads it and hands it to the team; nothing is sent.' },
    { ar: 'أسماء الخطوات وأوقاتها المقرّبة، أعداد استخدام الاقتراحات، نتائج المهام، إجابة سؤال واحد، تعليق اختياري؛ لا اسم ولا درجة ولا مقرر', en: 'Step names and rounded times, counts of how suggestions were used, task results, one answer, an optional comment; no name, grade or course' },
    'study', ['src/utils/pilotAnalytics.js', 'src/pilot/studyFile.js', 'src/pilot/studyCounts.js', 'src/components/PilotStudy.jsx', 'src/content/pilotConsent.js', 'src/pilot/syntheticTranscripts.js']),
  f('accounts', 'not-built',
    { ar: 'الحسابات وتسجيل الدخول', en: 'Accounts and sign-in' },
    { ar: 'غير موجودة. لا تحتاج حسابًا، ولا نعرف من أنت.', en: 'Do not exist. You need no account, and we do not know who you are.' },
    { ar: 'لا شيء', en: 'Nothing' }, 'none'),
  f('central-storage', 'not-built',
    { ar: 'التخزين المركزي للملفات', en: 'Central storage of profiles' },
    { ar: 'غير موجود. لا يملك فريق المشروع نسخة من ملفك.', en: 'Does not exist. The project team has no copy of your profile.' },
    { ar: 'لا شيء', en: 'Nothing' }, 'none'),
  f('external-ai', 'not-built',
    { ar: 'خدمات الذكاء الاصطناعي الخارجية', en: 'External AI services' },
    { ar: 'غير مستخدمة وخارج النطاق. لا يُرسل أي نص أو سجل إلى نموذج بعيد مثل OpenAI أو Gemini أو Claude.', en: 'Not used, and out of scope. No text or transcript is sent to a remote model such as OpenAI, Gemini or Claude.' },
    { ar: 'لا شيء', en: 'Nothing' }, 'none'),
  f('advisor-sharing', 'not-built',
    { ar: 'المشاركة مع المرشد أو الجامعة', en: 'Sharing with an advisor or university' },
    { ar: 'غير مفعّلة. صفحة المرشد عرض ببيانات وهمية فقط.', en: 'Not active. The advisor page is a demo with synthetic data only.' },
    { ar: 'لا شيء', en: 'Nothing' }, 'none'),
])

export const featuresRunningIn = runsIn => RUNTIME_MANIFEST.filter(item => item.runsIn === runsIn)
export const NETWORK_FEATURES = Object.freeze(RUNTIME_MANIFEST.filter(item => item.network))

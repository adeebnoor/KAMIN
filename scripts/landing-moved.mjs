// Task 14 · content moved off the home page (11 sections → 5) onto existing public pages, behind
// "Learn more" links on the home page. The wording is the home page's, unchanged.
const card=(title,body,id='')=>`<section class="k-doc-card"${id?` id="${id}"`:''}><h2>${title}</h2>${body}</section>`
const p=s=>`<p>${s}</p>`
const t=(lang,ar,en)=>lang==='ar'?ar:en
const href=(lang,file)=>`/${lang}/${file}`

// about.html — the idea behind Kamin (was #person360 on the home page)
export const aboutIdea=lang=>card(t(lang,'الفكرة التي بُني عليها كامن','The idea behind Kamin'),
 p(t(lang,'العلاقة تفسّر ما لا تقوله المعلومة وحدها.','A connection explains what one fact cannot.'))+
 p(t(lang,'مستوحى من منهج صاحب المشروع في بحث الدكتوراه: جمع خصائص كيانات متعددة في شبكة دلالية، ثم اكتشاف الروابط بينها. في كامن نطبق هذا النمط على الشخص، وأدلته، وقدراته، ومسارات التعلم والعمل.','Inspired by the founder’s doctoral research approach: connecting entities through their properties in a semantic network. Kamin applies that pattern to people, their evidence, capabilities, and learning and career pathways.'))+
 `<ol><li><strong>${t(lang,'مقرر قواعد البيانات','Database (I) course')}</strong> — CPIT-240</li><li><strong>${t(lang,'قدرة في قواعد البيانات','Database capability')}</strong> — ${t(lang,'علاقة من خريطة المقررات التجريبية','Linked through the pilot course map')}</li><li><strong>${t(lang,'متطلب لمسار تحليل البيانات','A requirement for data analysis')}</strong> — ${t(lang,'دليل يدعم الاستكشاف، لا ضمان جاهزية','Evidence for exploration, not proof of readiness')}</li></ol>`+
 p(t(lang,'نستعير النمط البحثي؛ صلاحية التوصيات هنا تحتاج تحققًا مستقلًا.','The research pattern transfers; the validity of these recommendations still requires separate evaluation.'))+
 p(`<a href="${href(lang,'methodology.html')}">${t(lang,'تعرّف على المنهجية وحدودها','Read the methodology and its limits')}</a>`),'idea')

// services.html — who Kamin is for (was .k-audiences) and the three services (was #proof)
export const servicesWhoFor=lang=>card(t(lang,'من أين تبدأ؟','Where would you like to start?'),
 `<ul><li><strong>${t(lang,'طالب أو خريج','Student or graduate')}</strong> — ${t(lang,'افهم ما تدعمه أدلتك، وقارن المسارات، وابنِ مخرجًا يعكس ما تستطيع إنجازه.','Understand what your evidence supports, compare pathways and create work that shows what you can do.')} <a href="${href(lang,'')}">${t(lang,'ابدأ ملفك','Build your profile')}</a></li>`+
 `<li><strong>${t(lang,'مستشار مهني','Career advisor')}</strong> — ${t(lang,'ابدأ حوار الإرشاد من دليل واضح. استكشف نموذج المراجعة وحدود النسخة الحالية.','Start the guidance conversation with clear evidence. Explore the review model and its current limits.')} <a href="${href(lang,'advisor.html')}">${t(lang,'استكشف عرضًا وهميًا','Explore a synthetic demo')}</a></li>`+
 `<li><strong>${t(lang,'جامعة أو مركز إرشاد','University or career center')}</strong> — ${t(lang,'شارك في اختبار قيمة كامن، وراجع مقاييس التجربة وخطوات التحقق المؤسسي.','Explore the pilot, its evaluation measures and the path to institutional verification.')} <a href="${href(lang,'business-model.html')}">${t(lang,'خطة الجامعات والشركاء','Universities & partners')}</a></li></ul>`+
 p(t(lang,'نسخة بحثية عامة · المسارات استرشادية · المشاركة المؤسسية غير مفعّلة.','Public research release · Exploratory pathways · Institutional sharing is not active.')),'who-for')

export const servicesProof=lang=>card(t(lang,'ملف واحد. علاقات تكشف أكثر.','One profile. Connections that reveal more.'),
 p(t(lang,'تبدأ من صورة عنك، ثم تربط ما تعرفه وما تفضّله بالمسارات الممكنة.','Start with a picture of yourself, then connect what you know and prefer to possible pathways.'))+
 `<ol><li><strong>${t(lang,'افهم شبكة قدراتك','Explore your capability network')}</strong> — ${t(lang,'اجمع اهتماماتك وأهدافك وتفضيلاتك ودراستك في شبكة واحدة، وافهم دور كل بُعد.','Connect your interests, goals, preferences and studies in one network, and understand each dimension.')}</li>`+
 `<li><strong>${t(lang,'اسأل: لماذا هذا المسار؟','Ask: why this pathway?')}</strong> — ${t(lang,'مساعد قرار يشرح الدليل والفجوات من ملفك؛ لا تحتاج إلى كتابة سؤال طويل.','A decision guide explains your evidence and gaps. Choose a question to get a grounded answer.')}</li>`+
 `<li><strong>${t(lang,'حوّل الفجوة إلى خطة','Turn a gap into a plan')}</strong> — ${t(lang,'اختر مسارًا، وحدد ما يحتاج دليلًا، واحصل على خطوات عملية قابلة للمراجعة.','Choose a pathway, identify missing evidence and build a practical plan you can review.')}</li></ol>`+
 p(t(lang,'تعمل الخدمات محليًا: شبكة تفسّر العلاقات، واكتشاف اختياري للمسارات من اهتمام تكتبه بكلماتك. المسارات أمثلة مرجعية وليست وظائف شاغرة أو دورات للحجز.','Services run locally: a graph explains connections, and optional discovery explores pathways from interests in your own words. Pathways are reference examples, not vacancies or bookable courses.')),'services-proof')

// trust.html — an honest profile (was #trust on the home page)
export const trustHonest=lang=>card(t(lang,'ابنِ ملفًا يشبهك، لا إجابة مثالية.','Build a profile that reflects you.'),
 p(t(lang,'المبالغة قد تقودك إلى مسار يحتاج استعدادًا مختلفًا. الملف الصادق يساعدك على رؤية نقطة البداية، حتى عندما تكون بعض المعلومات غير مكتملة.','Overstating experience can point you toward a path requiring different preparation. An honest profile helps you see where to start, even when some details are missing.'))+
 `<ul><li><strong>${t(lang,'نعطيك السبب قبل أن نسأل','A reason for every question')}</strong> — ${t(lang,'الاهتمامات تضيف سياقًا، والهدف يوجّه الاستكشاف، والسجل يدعم الأدلة. تختار ما تضيفه.','Interests add context, goals guide exploration and transcripts support evidence. You choose what to add.')}</li>`+
 `<li><strong>${t(lang,'«لم أحدد بعد» إجابة مقبولة','“Undecided” is a valid answer')}</strong> — ${t(lang,'لا نكافئ زيادة الادعاءات. المعلومات الناقصة تظهر كحدود، لا كفشل.','More claims do not earn rewards. Missing information is a visible limit, not a failure.')}</li>`+
 `</ul>`+p(t(lang,'المراجعة والتصحيح والحذف موضّحة في هذه الصفحة أعلاه.','Reviewing, correcting and deleting your data are covered above on this page.')),'honest-profile')

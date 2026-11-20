// Task 65 · the words of the "Suggested learning path" (src/components/LearningPath.jsx), moved here unchanged so the
// new interface's step 4 (the Details sheet of a next-step card) shows the same sentences word for word.
// Nothing else lives here.
export const LEARNING_PATH_COPY = Object.freeze({
  ar: {
    planned: 'ميزة مخطط لها', title: 'مسار تعلم مقترح',
    // Task 24: the one-line summary shown while the path is closed.
    show: 'اعرض', hide: 'أخفِ', stepsFor: n => `${n} ${n === 1 ? 'خطوة مقترحة' : 'خطوات مقترحة'} لمسار`, noGapShort: 'لا فجوة ظاهرة لمسار', nothingShort: 'لا شيء في القائمة بعد لمسار',
    intro: 'هذه نسخة أولية من ميزة مخطط لها للمرحلة القادمة. تأتي الاقتراحات من قائمة صغيرة يبنيها الفريق ويراجعها بنفسه داخل الموقع، ولا يُجلب شيء من أي خدمة خارجية. كل اقتراح يذكر الفجوة التي يسدّها.',
    field: 'المجال الذي تريده', needs: 'ما يتطلبه هذا المجال منك',
    status: { sufficient: 'دليل كافٍ', limited: 'دليل محدود', missing: 'لا يوجد دليل في سجلك' },
    noGap: 'لا توجد فجوة ظاهرة لهذا المجال: في سجلك دليل كافٍ على كل ما يتطلبه. لا نقترح شيئًا.',
    nothing: 'لا يوجد في القائمة بعد ما يسدّ:',
    steps: 'خطوات مقترحة', closes: 'يسدّ', needsFirst: 'يحتاج أولًا', why: 'لماذا يظهر هذا؟',
    noProvider: 'مثال مختلق بلا مزوّد حقيقي', illustrative: 'مثال توضيحي', reviewed: 'راجعه القسم', source: 'مصدر هذا البند',
    // Task 36: once every capability a university course links to has a reviewed item.
    introReviewed: 'تأتي الاقتراحات من قائمة صغيرة داخل الموقع راجعها مراجعان من القسم، ولا يُجلب شيء من أي خدمة خارجية. كل اقتراح يذكر الفجوة التي يسدّها.',
    kind: { 'university-course': 'مقرر جامعي', course: 'دورة', certificate: 'شهادة' },
    level: { intro: 'مستوى تمهيدي', intermediate: 'مستوى متوسط', advanced: 'مستوى متقدم' },
    order: 'الترتيب بقواعد مكتوبة: ما تستوفي متطلباته أولًا، ثم ما يسدّ قدرة غير موجودة، ثم المستوى الأسهل. لا توجد درجات.',
  },
  en: {
    planned: 'Planned feature', title: 'Suggested learning path',
    // Task 24: the one-line summary shown while the path is closed.
    show: 'Show', hide: 'Hide', stepsFor: n => `${n} suggested ${n === 1 ? 'step' : 'steps'} for`, noGapShort: 'No visible gap for', nothingShort: 'Nothing in the list yet for',
    intro: 'This is an early version of a feature planned for the next phase. Suggestions come from a small list the team builds and reviews itself, inside the site; nothing is fetched from any outside service. Every suggestion names the gap it closes.',
    field: 'The field you want', needs: 'What this field needs from you',
    status: { sufficient: 'Enough evidence', limited: 'Limited evidence', missing: 'No evidence in your record' },
    noGap: 'No visible gap for this field: your record has enough evidence for everything it requires. We suggest nothing.',
    nothing: 'The list has nothing yet that closes:',
    steps: 'Suggested steps', closes: 'Closes', needsFirst: 'Needs first', why: 'Why is this here?',
    noProvider: 'Invented example, no real provider', illustrative: 'Illustrative example', reviewed: 'Reviewed by the department', source: 'Source of this item',
    // Task 36: once every capability a university course links to has a reviewed item.
    introReviewed: 'Suggestions come from a small list inside the site that two department reviewers checked; nothing is fetched from any outside service. Every suggestion names the gap it closes.',
    kind: { 'university-course': 'University course', course: 'Course', certificate: 'Certificate' },
    level: { intro: 'Introductory level', intermediate: 'Intermediate level', advanced: 'Advanced level' },
    order: 'Ordered by written rules: what you meet the prerequisites for first, then what closes a missing capability, then the easier level. There is no score.',
  },
})

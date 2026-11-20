// Task 12 · plain words for developer terms. Student screens use the plain words; the technical
// term may appear only inside a "Technical details" block (src/components/TechDetails.jsx).
export const PLAIN_TERMS = Object.freeze({
  'IndexedDB': { ar: 'على هذا الجهاز', en: 'on this device' },
  'sessionStorage': { ar: 'لهذه الجلسة فقط', en: 'for this session only' },
  'CLR 2.0 export': { ar: 'نزّل ملفًا بقدراتك', en: 'download a file with your capabilities' },
  'governed mapping': { ar: 'ربط معتمد بين المقرر والقدرة', en: 'approved link between course and capability' },
  'explained judgment': { ar: 'النتيجة وسببها', en: 'the result and its reason' },
  'personalization context': { ar: 'ما اخترته عن نفسك', en: 'what you chose about yourself' },
  'JSON-LD': { ar: 'ملف قدراتك', en: 'your capability file' },
  'AES-GCM': { ar: 'مشفّر على جهازك', en: 'encrypted on your device' },
  'OCR': { ar: 'قراءة صورة على جهازك', en: 'reading an image on your device' },
  'SASCED': { ar: 'التصنيف السعودي للتخصصات', en: 'Saudi classification of study fields' },
  'course namespace': { ar: 'رمز المقرر', en: 'course code' },
  'eddsa-jcs-2022': { ar: 'التوقيع الرقمي', en: 'digital signature' },
  'URL fragment': { ar: 'نهاية الرابط', en: 'the end of the link' },
  'SPARQL': { ar: 'أداة الاستعلام للمراجعين', en: 'reviewer query tool' },
  'RDF': { ar: 'شبكة المعرفة', en: 'knowledge network' },
  // Task 28 · Interests & goal, Show connections, Matches and Courses.
  'Person 360': { ar: 'ملفك', en: 'your profile' },
  '360°': { ar: 'ملفك', en: 'your profile' },
  'inference': { ar: 'ربط بقاعدة ثابتة', en: 'a link made by a fixed rule' },
  'rule R1': { ar: 'قاعدة الربط بالدليل', en: 'the evidence rule' },
  'kamin-relations': { ar: 'إصدار قواعد الربط', en: 'version of the linking rules' },
  'semantic': { ar: 'حسب المعنى', en: 'by meaning' },
  'multi-dimensional': { ar: 'من عدة جوانب', en: 'from several sides' },
  'calibrated': { ar: 'درجة رقمية', en: 'a score' },
})

// Task 28 · the six Holland (RIASEC) interest areas in plain activity words. The option ids in
// src/insight.js stay the RIASEC names (stored data does not change); the Holland name and letter
// are shown to reviewers inside "Technical details" only.
export const INTEREST_AREAS = Object.freeze({
  realistic: { code: 'R', holland: 'Realistic', ar: 'بناء الأشياء وإصلاحها', en: 'Building and fixing things' },
  investigative: { code: 'I', holland: 'Investigative', ar: 'حل المشكلات والتحليل', en: 'Solving problems and analysing' },
  artistic: { code: 'A', holland: 'Artistic', ar: 'الإبداع والتصميم', en: 'Creating and designing' },
  social: { code: 'S', holland: 'Social', ar: 'مساعدة الآخرين وتعليمهم', en: 'Helping and teaching' },
  enterprising: { code: 'E', holland: 'Enterprising', ar: 'القيادة والإقناع', en: 'Leading and persuading' },
  conventional: { code: 'C', holland: 'Conventional', ar: 'التنظيم وحفظ الترتيب', en: 'Organising and keeping order' },
})

// Task 28 · words that must not be visible on Interests & goal, Show connections, Matches and
// Courses outside "Technical details", in either language. Latin words are matched ignoring case;
// "R1"–"R4" and "infer" as whole words only.
export const SCREEN_JARGON = Object.freeze(['360', 'Person 360', 'RDF', 'JSON-LD', 'kamin-relations', 'inference', 'semantic', 'Realistic', 'Conventional', 'multi-dimensional', 'استدلال', 'دلالي', 'واقعي', 'تقليدي'])
const RULE_ID = /\bR[1-4]\b/, INFER = /\binfer\b/i
export function jargonIn(text) {
  const value = String(text), lower = value.toLowerCase()
  const found = SCREEN_JARGON.filter(term => lower.includes(term.toLowerCase()))
  for (const word of [RULE_ID, INFER]) { const hit = value.match(word); if (hit) found.push(hit[0]) }
  return found
}

// Terms that must not appear on student screens outside "Technical details".
export const TECHNICAL_TERMS = Object.freeze(['IndexedDB', 'sessionStorage', 'localStorage', 'CLR', 'JSON-LD', 'JSON', 'AES', 'GCM', 'OCR', 'SASCED', 'namespace', 'eddsa', 'SPARQL', 'RDF', 'urn:', 'governed', 'محكوم', 'مفسّر', 'explained judgment', 'personalization'])

export const plain = (term, lang = 'ar') => PLAIN_TERMS[term]?.[lang] || term

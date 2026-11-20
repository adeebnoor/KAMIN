// Interest vocabulary for interests in the student's own words (follow-up to Task 56).
// The approved project engine (src/ai/projectSuggestImproved.js with src/ai/lexicon) recognises
// capabilities in technical wording; it abstains on everyday goals such as "I want to build apps that
// help hospitals". This separate word list recognises such goals in English, Arabic and Saudi dialect.
//
// Goals only, never evidence:
// - it gives topic chips ("Apps", "Health") and pathway chips (targets in src/matching/targets.js),
//   never a capability, an evidence level or anything the person graph reads;
// - it is not part of src/ai/lexicon, so project suggestions stay exactly as they were;
// - it is loaded only with src/interests/freeText.js (on demand), never in the initial bundle.
// No score: a term is either found or not. Deterministic; the order below is the order of the chips.
export const INTEREST_VOCABULARY_VERSION = 'kamin-interest-vocabulary-v1'

// Terms are written normalised (see normalize below). `words`: single words, matched after common
// Arabic prefixes (و ف ب ل ك ال لل وال بال …), Arabic possessive endings and English endings
// (s, es, ing, ed, er, ers) are removed. `phrases`: consecutive words, matched the same way.
export const INTEREST_TOPICS = Object.freeze([
  {
    id: 'apps', labels: { ar: 'تطبيقات', en: 'Apps' }, pathways: ['job-software-engineer'],
    words: ['app', 'application', 'android', 'iphone', 'ios', 'تطبيق', 'تطبيقات', 'ابلكيشن', 'ابليكيشن', 'ابلكيشنات', 'ابليكيشنات'],
    phrases: [['mobile', 'app']],
  },
  {
    id: 'websites', labels: { ar: 'مواقع الويب', en: 'Websites' }, pathways: ['job-web-developer', 'training-web-developer'],
    words: ['website', 'webpage', 'web', 'frontend', 'موقع', 'مواقع', 'ويب', 'ويبسايت'],
    phrases: [['front', 'end'], ['web', 'site']],
  },
  {
    id: 'games', labels: { ar: 'ألعاب', en: 'Games' }, pathways: ['job-software-engineer'],
    words: ['game', 'gaming', 'videogame', 'لعبه', 'العاب', 'قيمز', 'جيمز', 'قيمنق'],
    phrases: [['video', 'game']],
  },
  {
    id: 'security', labels: { ar: 'الاختراق والأمن', en: 'Hacking and security' }, pathways: ['job-cyber-analyst'],
    words: ['hack', 'hacking', 'hacker', 'cybersecurity', 'cyber', 'security', 'pentest', 'pentesting', 'اختراق', 'هكر', 'هاكر', 'هكرز', 'تهكير', 'سيبراني'],
    phrases: [['ethical', 'hacking'], ['امن', 'معلومات'], ['امن', 'شبكات']],
  },
  {
    id: 'ai', labels: { ar: 'الذكاء الاصطناعي', en: 'AI' }, pathways: ['training-ai-work'],
    words: ['ai', 'chatbot', 'chatbots'],
    phrases: [['artificial', 'intelligence'], ['machine', 'learning'], ['deep', 'learning'], ['ذكاء', 'اصطناعي'], ['تعلم', 'اله'], ['شات', 'بوت']],
  },
  {
    id: 'data', labels: { ar: 'البيانات', en: 'Data' }, pathways: ['job-data-analyst'],
    words: ['data', 'analytics', 'dashboard', 'بيانات', 'داتا', 'احصاء'],
    phrases: [],
  },
  {
    id: 'design', labels: { ar: 'التصميم', en: 'Design' }, pathways: [],
    words: ['design', 'designer', 'ui', 'ux', 'تصميم', 'اصمم', 'يصمم', 'نصمم', 'ديزاين', 'ديزاينر', 'واجهات'],
    phrases: [['user', 'experience'], ['user', 'interface']],
  },
  {
    id: 'health', labels: { ar: 'الصحة', en: 'Health' }, pathways: [],
    words: ['hospital', 'health', 'healthcare', 'medical', 'medicine', 'clinic', 'patient', 'doctor', 'nurse', 'مستشفي', 'مستشفيات', 'صحه', 'صحي', 'صحيه', 'طبي', 'طبيه', 'طب', 'مريض', 'عياده', 'عيادات', 'دكتور', 'دكاتره', 'اطباء'],
    phrases: [],
  },
])

// Arabic: no diacritics or tatweel; أ إ آ ٱ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي. English: lower case.
export const normalize = text => String(text || '')
  .toLowerCase()
  .replace(/[ً-ٰٟـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')

const AR_PREFIXES = ['وال', 'بال', 'فال', 'كال', 'ولل', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك']
const AR_SUFFIXES = ['هم', 'ها', 'كم', 'نا', 'ي', 'ه']
const EN_SUFFIXES = ['ers', 'ing', 'es', 'ed', 'er', 's']
const isArabic = word => /[؀-ۿ]/.test(word)

// Every form a word may be a term in: as written, without one prefix, without one ending, or both.
function forms(word) {
  const out = new Set([word])
  if (isArabic(word)) {
    const stems = [word, ...AR_PREFIXES.filter(p => word.startsWith(p) && word.length - p.length >= 2).map(p => word.slice(p.length))]
    for (const stem of stems) {
      out.add(stem)
      for (const s of AR_SUFFIXES) if (stem.endsWith(s) && stem.length - s.length >= 3) out.add(stem.slice(0, -s.length))
    }
  } else {
    for (const s of EN_SUFFIXES) if (word.endsWith(s) && word.length - s.length >= 3) out.add(word.slice(0, -s.length))
  }
  return out
}

const tokens = text => normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(forms)

/**
 * The interest topics found in a sentence, in vocabulary order.
 * @returns {{ topics: string[], pathways: string[] }} topic ids, and their pathway ids (no duplicates)
 */
export function matchInterestVocabulary(text) {
  const words = tokens(text)
  const has = term => words.some(f => f.has(term))
  const hasPhrase = phrase => words.some((_, i) => phrase.every((term, k) => words[i + k]?.has(term)))
  const found = INTEREST_TOPICS.filter(topic => topic.words.some(has) || topic.phrases.some(hasPhrase))
  return { topics: found.map(t => t.id), pathways: [...new Set(found.flatMap(t => t.pathways))] }
}

export const interestTopic = id => INTEREST_TOPICS.find(t => t.id === id) || null

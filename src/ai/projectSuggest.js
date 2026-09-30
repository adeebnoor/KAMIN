// A narrowly scoped, measurable assistant: from a project description, suggest capabilities
// and quote the exact sentence that supports each suggestion. The student accepts or corrects.
// Deterministic lexicon matching, fully local, no external model. Every suggestion carries its
// evidence sentence; with no supporting sentence the assistant abstains ("unresolved").
export const PROJECT_SUGGEST_VERSION = 'kamin-project-suggest-lexicon-v1'

// Patterns are matched case-insensitively on normalised text. Arabic forms include common
// definite-article and plural variants.
const LEXICON = {
  database: [/\bsql\b/i, /\bdatabases?\b/i, /\bpostgres(?:ql)?\b/i, /\bmysql\b/i, /\bschema\b/i, /\bquer(?:y|ies)\b/i, /قواعد?\s*(?:ال)?بيانات/, /قاعدة\s*(?:ال)?(?:بيانات|تدريبية)/, /استعلام/, /جداول/],
  statistics: [/\bstatistic(?:s|al)?\b/i, /\bregression\b/i, /\bhypothesis\b/i, /\bconfidence interval\b/i, /\bdescriptive\b/i, /\bp-value\b/i, /إحصائ?[يى]|الإحصاء/, /انحدار/, /فاصل\s*(?:ال)?ثقة/, /تحليل\s*كمي/, /متوسط|انحراف\s*معياري/],
  software: [/\bimplement(?:ed|ation)?\b/i, /\brefactor(?:ed|ing)?\b/i, /\bmodule\b/i, /\bapi\b/i, /\bsoftware\b/i, /هندسة\s*(?:ال)?برمجيات/, /برمج|كود|وحدة\s*برمجية|واجهة\s*برمجية/],
  testing: [/\bunit tests?\b/i, /\btest(?:ing|s| cases?)\b/i, /\bpytest\b/i, /\bjest\b/i, /\bcoverage\b/i, /اختبار(?:ات)?/, /حالات\s*(?:ال)?اختبار/, /تغطية\s*(?:ال)?اختبار/],
  'db-operations': [/\bbackups?\b/i, /\brestor(?:e|ed|ation)\b/i, /\breplication\b/i, /\bpermissions?\b/i, /\bprivileges?\b/i, /\bdba\b/i, /نسخ(?:ة)?\s*احتياطي/, /استعادة/, /صلاحيات/, /تشغيل\s*قواعد/],
  'web-development': [/\bhtml\b/i, /\bcss\b/i, /\breact\b/i, /\bfront-?end\b/i, /\bresponsive\b/i, /\bweb (?:app|page|interface)\b/i, /واجهة\s*(?:ال)?ويب/, /صفحة\s*ويب|موقع\s*إلكتروني|متجاوب/],
  'systems-analysis': [/\bworkflows?\b/i, /\bstakeholders?\b/i, /\buse cases?\b/i, /\bprocess (?:map|model)\b/i, /\bas-is\b/i, /سير\s*(?:ال)?عمل/, /أصحاب\s*(?:ال)?مصلحة/, /حالات\s*(?:ال)?استخدام/, /تحليل\s*(?:ال)?نظم/],
  requirements: [/\brequirements?\b/i, /\buser stor(?:y|ies)\b/i, /\bacceptance criteria\b/i, /\bspecification\b/i, /متطلبات/, /قصص\s*(?:ال)?مستخدم/, /معايير\s*(?:ال)?قبول/, /مواصفات/],
  project: [/\bproject plan\b/i, /\bmilestones?\b/i, /\bgantt\b/i, /\bproject (?:scope|schedule)\b/i, /\bproject manage/i, /خطة\s*(?:ال)?مشروع/, /معالم|جدول\s*زمني/, /إدارة\s*(?:ال)?مشروع/, /نطاق\s*(?:ال)?مشروع/],
  cyber: [/\bvulnerabilit(?:y|ies)\b/i, /\bsecurity\b/i, /\bfirewall\b/i, /\bencrypt(?:ion|ed)\b/i, /\bpenetration\b/i, /\bthreat\b/i, /ثغر(?:ة|ات)/, /أمن\s*(?:سيبراني|المعلومات)?/, /جدار\s*(?:ال)?حماية/, /تشفير/, /تهديد/],
  'ai-work': [/\bllm\b/i, /\bchatgpt\b/i, /\bprompt(?:s|ing)?\b/i, /\bmachine learning\b/i, /\bmodel (?:training|fine-tun)/i, /\bai\b/i, /نموذج\S*\s*لغوي/, /ذكاء\s*اصطناعي/, /تعلم\s*(?:ال)?آل[يى]/, /موجّه|أوامر\s*(?:ال)?نموذج/],
}

const normalise = text => String(text || '').replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim()
const sentences = text => normalise(text).split(/(?<=[.!?؟؛])\s+|\n+/).map(s => s.trim()).filter(s => s.length >= 3)

// Returns {version, suggestions:[{skillId, snippet, matches}], abstained}
export function suggestCapabilities(description, { max = 4 } = {}) {
  const found = new Map()
  for (const sentence of sentences(description)) {
    for (const [skillId, patterns] of Object.entries(LEXICON)) {
      const hits = patterns.map(p => sentence.match(p)?.[0]).filter(Boolean)
      if (!hits.length) continue
      const entry = found.get(skillId) || { skillId, snippet: sentence.slice(0, 200), matches: [] }
      entry.matches.push(...hits.filter(h => !entry.matches.includes(h)))
      if (entry.snippet.length < sentence.length && entry.matches.length === hits.length) entry.snippet = sentence.slice(0, 200)
      found.set(skillId, entry)
    }
  }
  const suggestions = [...found.values()].sort((a, b) => b.matches.length - a.matches.length).slice(0, max)
    .map(s => ({ ...s, confidence: s.matches.length >= 2 ? 'multiple-cues' : 'single-cue' }))
  return { version: PROJECT_SUGGEST_VERSION, suggestions, abstained: suggestions.length === 0 }
}

// Engineering evaluation on a frozen labelled set: precision, recall and abstention per language.
export function evaluateSuggestions(cases) {
  const per = { ar: { tp: 0, fp: 0, fn: 0, abstained: 0, n: 0 }, en: { tp: 0, fp: 0, fn: 0, abstained: 0, n: 0 } }
  for (const item of cases) {
    const bucket = per[item.lang]
    bucket.n += 1
    const got = new Set(suggestCapabilities(item.text).suggestions.map(s => s.skillId))
    const want = new Set(item.expected)
    if (!got.size) bucket.abstained += 1
    for (const id of got) want.has(id) ? bucket.tp++ : bucket.fp++
    for (const id of want) if (!got.has(id)) bucket.fn++
  }
  const summarise = b => ({ cases: b.n, precision: b.tp + b.fp ? b.tp / (b.tp + b.fp) : null, recall: b.tp + b.fn ? b.tp / (b.tp + b.fn) : null, abstentionRate: b.n ? b.abstained / b.n : null })
  return { version: PROJECT_SUGGEST_VERSION, ar: summarise(per.ar), en: summarise(per.en) }
}

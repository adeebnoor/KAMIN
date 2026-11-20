// Builds lexicon/capabilities-v2.json from lexicon/capabilities-v1-copy.json (a copy of KAMIN's src/ai/lexicon/capabilities.json).
// Every change is listed here and in CHANGES-v2.md. Designed from general domain vocabulary and the DEV sets only
// (course-dev-set.json, dev-set.json); no test-set case was used to choose a term.
// Usage (inside evaluation/):  node experimental/build-lexicon-v2.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const lex = JSON.parse(fs.readFileSync(path.join(HERE, 'lexicon', 'capabilities-v1-copy.json'), 'utf8'))
const caps = lex.capabilities
const find = (cap, kind, t) => caps[cap][kind].find(e => e.t === t)
const add = (cap, kind, t, why) => { if (!find(cap, kind, t)) caps[cap][kind].push({ t, why: `${why} [v2]` }) }
const remove = (cap, kind, t) => { const i = caps[cap][kind].findIndex(e => e.t === t); if (i < 0) throw new Error(`missing ${cap}.${kind}.${t}`); caps[cap][kind].splice(i, 1) }
const move = (cap, from, to, t, why) => { const e = find(cap, from, t); if (!e) throw new Error(`missing ${cap}.${from}.${t}`); remove(cap, from, t); caps[cap][to].push({ t, why: `${why} [v2: moved ${from} → ${to}]` }) }
// R1 secondary-mention guard: a strong term marked generic does not suggest its capability when it is the ONLY distinct term
// of that capability in the whole text and every sentence holding it is a topic list (2+ commas). See the engine.
const generic = (cap, t) => { const e = find(cap, 'strong', t); if (!e) throw new Error(`missing ${cap}.strong.${t}`); e.generic = true }

// R1 · generic broad nouns (dev: cd-CPCS-371, cd-CPCS-372, cd-CPCS-462, cd-CPCS-405, cd-CPIT-305)
generic('cyber', 'security'); generic('cyber', 'أمن')
generic('database', 'database')
generic('requirements', 'requirement')
// R2 · cyber domain terms, so a real security text has 2+ distinct terms (dev: cd-CPCS-464 should keep cyber)
for (const t of ['breach', 'intrusion', 'malware', 'malicious', 'cipher', 'cryptography', 'cryptographic', 'attack', 'cyber']) add('cyber', 'strong', t, 'security domain term')
// R3 · AI by its full name and intelligent systems (dev: cd-CPCS-433, cd-CPIS-363)
add('ai-work', 'strong', 'artificial intelligence', 'direct name')
add('ai-work', 'strong', 'intelligent system', 'AI systems')
add('ai-work', 'strong', 'intelligent agent', 'AI systems')
// R4 · web protocol vocabulary as weak pairs (dev: cd-CPCS-474)
add('web-development', 'weak', 'http', 'web protocol, only with another web term')
add('web-development', 'weak', 'web service', 'only with another web term')
add('web-development', 'strong', 'web application', 'direct')
add('web-development', 'strong', 'web development', 'direct')
add('web-development', 'strong', 'web programming', 'direct')
// R5 · requirements elicitation vocabulary (dev: cd-CPCS-381)
add('requirements', 'strong', 'user needs', 'requirements elicitation')
add('requirements', 'strong', 'elicitation', 'requirements elicitation')
add('requirements', 'strong', 'احتياجات المستخدم', 'user needs')
// R6 · systems analysis: "process" alone and "business process" alone are too generic (dev: cd-CPIT-436 updating business
// processes, cd-CPIT-221 "processes" + "job interviews"); general systems-analysis vocabulary added instead (brief)
remove('systems-analysis', 'weak', 'process')
move('systems-analysis', 'strong', 'weak', 'business process', 'also e-business and operations courses')
for (const t of ['systems analysis', 'system analysis', 'systems planning', 'information system development', 'current system', 'process model', 'business process model'])
  add('systems-analysis', 'strong', t, 'systems-analysis vocabulary')
for (const t of ['analysis and design', 'information system', 'feasibility', 'process modeling']) add('systems-analysis', 'weak', t, 'only with another analysis term')
// R7 · project management vocabulary (brief: planning, scheduling, estimation, cost, risk, milestones, Agile/Scrum, team management)
for (const t of ['agile', 'risk management', 'cost estimation', 'effort estimation', 'project estimation', 'project planning', 'team management', 'project manager'])
  { if (find('project', 'weak', t)) remove('project', 'weak', t); add('project', 'strong', t, 'project-management vocabulary') }
for (const t of ['planning', 'scheduling', 'estimation', 'cost', 'risk', 'team', 'iteration', 'release', 'budget', 'stakeholder'])
  add('project', 'weak', t, 'only with another project-management term')
// R8 · software development wording (dev: cd-CPCS-457 "software systems", cd-CPIT-499 "coding ... implementation")
add('software', 'strong', 'software development', 'direct')
add('software', 'strong', 'software system', 'direct')
add('software', 'weak', 'implementation', 'generic alone')
add('software', 'weak', 'coding', 'generic alone')

lex.version = 'kamin-capability-lexicon-v2-experimental'
lex.builtOn = 'v1 + changes R1–R8 from course-dev-set.json and dev-set.json only (see eval/experimental/CHANGES-v2.md)'
fs.writeFileSync(path.join(HERE, 'lexicon', 'capabilities-v2.json'), JSON.stringify(lex, null, 1) + '\n')
console.log('wrote lexicon/capabilities-v2.json')

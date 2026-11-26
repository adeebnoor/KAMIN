// Task 79 · checks every link in src/catalog/roadmaps.json from this laptop.
// Developer tool only: never part of the app, the build or CI (no npm script, no workflow calls it). The app itself
// requests nothing; the student opens these links in a new tab.
//
//   node scripts/check-roadmap-links.mjs            check and print the result
//   node scripts/check-roadmap-links.mjs --stamp    also write the date and the counts into roadmaps.json (linksChecked)
//
// Each URL is asked for once with GET (redirects followed, 20 s timeout, 6 at a time) and sorted into:
//   ok        2xx (the final address is printed when a redirect moved it to another page)
//   blocked   401 / 403 / 429 / 999: the site answers but refuses scripts; open it in a browser to check by hand
//   dead      404 / 410, any other 4xx or 5xx, or no answer: replace the link
// Sends no data: a plain GET with a browser-like User-Agent, no cookies, no body. Exit code 1 when a link is dead.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'src', 'catalog', 'roadmaps.json')
const REPORT = path.join(ROOT, 'reports', 'roadmap-links.json')
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
const BLOCKED = new Set([401, 403, 429, 999])

/** Every link of the file, once, with the ids that use it. */
export function roadmapLinks(data) {
  const links = new Map()
  const add = (url, id) => { if (!links.has(url)) links.set(url, []); links.get(url).push(id) }
  for (const r of data.resources || []) add(r.url, `resource:${r.id}`)
  for (const c of data.certifications || []) add(c.url, `certification:${c.id}`)
  return [...links].map(([url, ids]) => ({ url, ids }))
}

export function classify(status) {
  if (status >= 200 && status < 300) return 'ok'
  if (BLOCKED.has(status)) return 'blocked'
  return 'dead'
}

const samePage = (a, b) => {
  try {
    const x = new URL(a), y = new URL(b)
    const clean = u => `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase()
    return clean(x) === clean(y)
  } catch { return a === b }
}

async function check({ url, ids }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': AGENT, accept: 'text/html,*/*' } })
    response.body?.cancel().catch(() => {})
    const result = classify(response.status)
    return { url, ids, status: response.status, result, finalUrl: response.url, moved: result === 'ok' && !samePage(url, response.url) }
  } catch (error) {
    return { url, ids, status: 0, result: 'dead', error: error.name === 'AbortError' ? 'timeout' : String(error.cause?.code || error.message) }
  } finally { clearTimeout(timer) }
}

async function main() {
  const data = JSON.parse(readFileSync(FILE, 'utf8'))
  const links = roadmapLinks(data)
  const results = []
  for (let i = 0; i < links.length; i += 6) results.push(...await Promise.all(links.slice(i, i + 6).map(check)))
  const count = kind => results.filter(r => r.result === kind).length
  const summary = { date: new Date().toLocaleDateString('sv-SE'), total: results.length, ok: count('ok'), blocked: count('blocked'), dead: count('dead') }
  for (const r of results) {
    const where = r.moved ? `  → ${r.finalUrl}` : ''
    console.log(`${r.result.padEnd(8)} ${String(r.status || r.error).padEnd(8)} ${r.url}${where}`)
  }
  console.log(`\n${summary.total} links: ${summary.ok} ok, ${summary.blocked} blocked for scripts (check by hand), ${summary.dead} dead`)
  mkdirSync(path.dirname(REPORT), { recursive: true })
  writeFileSync(REPORT, JSON.stringify({ summary, results }, null, 2) + '\n')
  if (process.argv.includes('--stamp')) {
    data.linksChecked = summary
    writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n')
  }
  process.exitCode = summary.dead ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()

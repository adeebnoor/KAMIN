import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { RUNTIME_MANIFEST, NETWORK_FEATURES } from '../src/content/runtimeManifest.js'
import { EMBEDDING_MODEL } from '../src/semantic/config.js'

// Task 16 · the app makes no outside calls. Every network primitive in the shipped code must be an
// allowlisted same-origin use tied to a feature in src/content/runtimeManifest.js, and no shipped
// file may name an outside AI/API host.

const ROOT = path.resolve(import.meta.dirname, '..')
const rel = file => path.relative(ROOT, file).split(path.sep).join('/')
const walk = dir => readdirSync(dir).flatMap(name => {
  const full = path.join(dir, name)
  return statSync(full).isDirectory() ? walk(full) : [full]
})
const CODE = /\.(m?js|jsx|ts|tsx)$/
// Shipped code: the app (src/), the static scripts copied to the site (public/*.js) and index.html.
const shipped = [
  ...walk(path.join(ROOT, 'src')).filter(f => CODE.test(f) || f.endsWith('.json')),
  ...readdirSync(path.join(ROOT, 'public')).filter(f => CODE.test(f)).map(f => path.join(ROOT, 'public', f)),
  path.join(ROOT, 'index.html'),
]
const code = shipped.filter(f => !f.endsWith('.json'))

export const PRIMITIVES = {
  fetch: /\bfetch\s*\(/g,
  XMLHttpRequest: /\bXMLHttpRequest\b/g,
  WebSocket: /\bWebSocket\b/g,
  sendBeacon: /\bsendBeacon\b/g,
  EventSource: /\bEventSource\b/g,
  importScripts: /\bimportScripts\s*\(/g,
}

// The only allowed network calls. Each one names its manifest feature and how many hits it has.
export const ALLOWLIST = [
  { file: 'src/semantic/recall.worker.js', primitive: 'fetch', count: 2, feature: 'embeddings', why: 'model files from /models/ on this site' },
  { file: 'public/sw.js', primitive: 'fetch', count: 3, feature: 'offline-cache', why: 'offline copy of this site’s own files; other origins are ignored' },
]

// Outside AI and API hosts that must never appear in shipped code.
export const BLOCKED_HOSTS = [
  'api.openai.com', 'openai.azure.com', 'generativelanguage.googleapis.com', 'aiplatform.googleapis.com',
  'api.anthropic.com', 'api.cohere.ai', 'api.cohere.com', 'api.mistral.ai', 'api-inference.huggingface.co',
  'huggingface.co', 'api.groq.com', 'api.deepseek.com', 'openrouter.ai', 'api.together.xyz', 'api.x.ai',
  'localhost:11434', '127.0.0.1:11434', 'cdn.jsdelivr.net', 'unpkg.com',
]

const strip = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

export function scanNetworkCalls(files = code) {
  const hits = []
  for (const file of files) {
    const source = strip(readFileSync(file, 'utf8'))
    for (const [primitive, re] of Object.entries(PRIMITIVES)) {
      const count = (source.match(re) || []).length
      if (count) hits.push({ file: rel(file), primitive, count })
    }
  }
  return hits
}

describe('network guard: no outside calls from the app', () => {
  it('scans a real code base (sanity)', () => {
    expect(code.length).toBeGreaterThan(50)
    expect(code.some(f => rel(f) === 'src/App.jsx')).toBe(true)
  })

  it('every fetch / XMLHttpRequest / WebSocket / sendBeacon / EventSource / importScripts is allowlisted', () => {
    const unexpected = scanNetworkCalls().filter(hit => !ALLOWLIST.some(a => a.file === hit.file && a.primitive === hit.primitive && a.count === hit.count))
    expect(unexpected, 'network calls outside the allowlist (add a manifest feature and an allowlist entry, same-origin only)').toEqual([])
  })

  it('every allowlist entry still exists, so the list cannot go stale', () => {
    const hits = scanNetworkCalls()
    for (const entry of ALLOWLIST) expect(hits, entry.file).toContainEqual({ file: entry.file, primitive: entry.primitive, count: entry.count })
  })

  it('no shipped file names an outside AI or API host', () => {
    const found = []
    for (const file of shipped) {
      const source = readFileSync(file, 'utf8').toLowerCase()
      for (const host of BLOCKED_HOSTS) if (source.includes(host)) found.push(`${rel(file)}: ${host}`)
    }
    expect(found).toEqual([])
  })

  it('no network call is given an absolute http(s) or protocol-relative address', () => {
    const found = []
    for (const file of code) {
      const source = strip(readFileSync(file, 'utf8'))
      for (const m of source.matchAll(/\b(fetch|sendBeacon|EventSource|WebSocket|importScripts)\s*\(\s*['"`](https?:|wss?:|\/\/)/g)) found.push(`${rel(file)}: ${m[0]}`)
    }
    expect(found).toEqual([])
  })

  it('allowlisted calls are tied to manifest features that declare them, and vice versa', () => {
    for (const entry of ALLOWLIST) {
      const feature = RUNTIME_MANIFEST.find(item => item.id === entry.feature)
      expect(feature, entry.feature).toBeTruthy()
      expect(feature.network?.target).toBe('same-origin')
      expect(feature.code).toContain(entry.file)
    }
    expect(NETWORK_FEATURES.map(item => item.id).sort()).toEqual([...new Set(ALLOWLIST.map(a => a.feature))].sort())
  })

  it('the allowlisted calls really are same-origin', () => {
    // Model: a root-relative path, remote models off, and the host pinned to this site.
    expect(EMBEDDING_MODEL.root).toMatch(/^\/(?!\/)/)
    const worker = readFileSync(path.join(ROOT, 'src/semantic/recall.worker.js'), 'utf8')
    expect(worker).toContain('env.allowRemoteModels=false')
    expect(worker).toContain('env.remoteHost=location.origin')
    expect(worker).toMatch(/fetch\(model\.root\+/)
    // Pilot (Task 18): no endpoint at all any more; the study file is downloaded and handed over.
    const pilot = readFileSync(path.join(ROOT, 'src/utils/pilotAnalytics.js'), 'utf8')
    expect(pilot).not.toMatch(/ENDPOINT|\bfetch\s*\(|sendBeacon|XMLHttpRequest/)
    expect(RUNTIME_MANIFEST.find(item => item.id === 'pilot-feedback')).toMatchObject({ runsIn: 'browser', storedIn: 'study', network: null })
    // Offline cache: returns before any request to another origin.
    expect(readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8')).toContain('if (url.origin !== location.origin) return')
    // OCR and PDF readers load their files from this site, not a CDN.
    const transcript = readFileSync(path.join(ROOT, 'src/utils/transcript.js'), 'utf8')
    for (const key of ['workerPath', 'corePath', 'langPath']) expect(transcript).toMatch(new RegExp(`${key}:'/ocr/`))
  })

  it('catches an outside call if someone adds one (self-test on a sample)', () => {
    const sample = "export const ask=()=>fetch('https://api.openai.com/v1/chat/completions',{method:'POST'})"
    const hasPrimitive = PRIMITIVES.fetch.test(strip(sample)); PRIMITIVES.fetch.lastIndex = 0
    expect(hasPrimitive).toBe(true)
    expect(BLOCKED_HOSTS.some(host => sample.includes(host))).toBe(true)
    expect(/\bfetch\s*\(\s*['"`](https?:|\/\/)/.test(sample)).toBe(true)
  })
})

// Task 49 · the whole repository, not only the app. Every .js/.mjs/.jsx file under these folders is
// scanned, committed or not yet committed; files Git ignores (vendor copies that `npm run build`
// writes into public/ocr/ and public/ai-runtime/) are not ours and are left out.
// evaluation/ (the browser-model evaluation) is scanned like eval/.
export const REPO_DIRS = ['src', 'public', 'scripts', 'eval', 'evaluation', 'resources']
const REPO_CODE = /\.(m?js|jsx)$/

export function repoCodeFiles() {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...REPO_DIRS], { cwd: ROOT, encoding: 'utf8' })
  return [...new Set(out.split('\0').filter(f => REPO_CODE.test(f)))].sort().map(f => path.join(ROOT, f)).filter(f => existsSync(f))
}

// Network primitives, including calls through another name: `fetchImpl(url)`, `fetchJson(...)`, or
// handing the built-in on (`fetchImpl = globalThis.fetch`).
export const REPO_PRIMITIVES = {
  fetch: /\bfetch\w*\s*\(|\b(?:globalThis|window|self)\.fetch\b/g,
  XMLHttpRequest: /\bXMLHttpRequest\b/g,
  sendBeacon: /\bsendBeacon\b/g,
  WebSocket: /\bWebSocket\b/g,
  EventSource: /\bEventSource\b/g,
  importScripts: /\bimportScripts\s*\(/g,
}

// The only network calls in the repository. Each names why it is allowed.
export const REPO_ALLOWLIST = [
  ...ALLOWLIST,
  { file: 'scripts/prepare-semantic.mjs', primitive: 'fetch', count: 1, why: 'build time only: downloads the pinned MiniLM model files from huggingface.co once into .model-cache/ (sha256 checked); sends no text and no user data; the app then serves them from /models/ on this site' },
  { file: 'evaluation/download-model.mjs', primitive: 'fetch', count: 1, why: 'developer tool, never part of the app or the build: downloads a public comparison model (ONNX) from huggingface.co into evaluation/models/ (git-ignored); sends no text and no user data' },
]

// Hosts that may be written in code outside comments (links in comments are documentation and are
// not checked). None of them is ever requested by the app; `files` limits a host to the files named.
export const HOST_ALLOWLIST = [
  // The KAMIN origin.
  { host: 'kamin-12mf.onrender.com', why: 'the Render URL used in page metadata and as the default SITE_ORIGIN' },
  { host: 'kamin.invalid', why: 'placeholder base for building a relative link with new URL(); never requested' },
  // Vocabulary and namespace IRIs: identifiers inside RDF/JSON-LD, never requested.
  ...['www.w3.org', 'schema.org', 'purl.org', 'w3id.org', 'data.europa.eu', 'purl.imsglobal.org', 'www.sitemaps.org']
    .map(host => ({ host, why: 'vocabulary or namespace IRI (an identifier, never requested)' })),
  // Sources and links a person can open; the code never requests them.
  ...['esco.ec.europa.eu', 'europass.europa.eu', 'www.onetcenter.org', 'www.onetonline.org', 'www.1edtech.org', 'credentialengine.org',
    'ipip.ori.org', 'fcitweb.kau.edu.sa', 'faculty.ksu.edu.sa', 'www.qu.edu.sa', 'dgp.sdaia.gov.sa', 'github.com', 'adeebnoor.github.io']
    .map(host => ({ host, why: 'cited source or a link people open themselves; never requested by code' })),
  { host: 'huggingface.co', files: ['scripts/prepare-semantic.mjs', 'scripts/public-page-content.mjs', 'evaluation/download-model.mjs'], why: 'the pinned model download at build time, the model-card link on the methodology page, and the evaluation tool that downloads comparison models' },
]

const HOST = /\bhttps?:\/\/([a-z0-9][a-z0-9.-]*(?::\d+)?)/gi

export function scanRepoSource(file, raw) {
  const source = strip(raw)
  const calls = []
  for (const [primitive, re] of Object.entries(REPO_PRIMITIVES)) {
    const count = (source.match(re) || []).length
    if (count) calls.push({ file, primitive, count })
  }
  const hosts = [...new Set([...source.matchAll(HOST)].map(m => m[1].toLowerCase()))].map(host => ({ file, host }))
  return { calls, hosts }
}

export function scanRepository(files = repoCodeFiles()) {
  const calls = [], hosts = []
  for (const file of files) {
    const found = scanRepoSource(rel(file), readFileSync(file, 'utf8'))
    calls.push(...found.calls); hosts.push(...found.hosts)
  }
  return { calls, hosts }
}

export const callAllowed = hit => REPO_ALLOWLIST.some(a => a.file === hit.file && a.primitive === hit.primitive && a.count === hit.count)
export const hostAllowed = hit => HOST_ALLOWLIST.some(a => a.host === hit.host && (!a.files || a.files.includes(hit.file)))

// Outside AI services and their keys must not be named anywhere in repository code, comments included.
export const BANNED_NAMES = [...BLOCKED_HOSTS.filter(host => host !== 'huggingface.co'),
  'googleapis', 'openai', 'anthropic', 'ollama', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'x-goog-api-key']

describe('repository guard: no script, module or tool calls an outside service (Task 49)', () => {
  const files = repoCodeFiles()
  const scan = scanRepository(files)

  it('scans every code file in src/, public/, scripts/, eval/ and resources/, and no ignored vendor copy', () => {
    const names = files.map(rel)
    for (const known of ['src/App.jsx', 'public/sw.js', 'scripts/prepare-semantic.mjs', 'eval/project-suggest/eval.mjs', 'evaluation/eval.mjs', 'evaluation/download-model.mjs']) expect(names).toContain(known)
    expect(names.every(name => REPO_DIRS.some(dir => name.startsWith(`${dir}/`)))).toBe(true)
    expect(names.some(name => /^public\/(ocr|ai-runtime|models)\//.test(name))).toBe(false)
    expect(names.length).toBeGreaterThan(code.length - 1)
  })

  it('every network call (fetch, aliases like fetchImpl(), XMLHttpRequest, sendBeacon, WebSocket, EventSource) is allowlisted', () => {
    expect(scan.calls.filter(hit => !callAllowed(hit)), 'network calls outside the reviewed list').toEqual([])
  })

  it('every repository allowlist entry still exists, so the list cannot go stale', () => {
    for (const entry of REPO_ALLOWLIST) expect(scan.calls, entry.file).toContainEqual({ file: entry.file, primitive: entry.primitive, count: entry.count })
  })

  it('every http(s) host written in code (outside comments) is on the reviewed list', () => {
    expect(scan.hosts.filter(hit => !hostAllowed(hit)), 'outside hosts not on HOST_ALLOWLIST').toEqual([])
  })

  it('every host allowlist entry is still used, so the list cannot go stale', () => {
    for (const entry of HOST_ALLOWLIST) expect(scan.hosts.some(hit => hit.host === entry.host), entry.host).toBe(true)
  })

  it('no network call anywhere is given an absolute address, except the pinned model download', () => {
    const found = []
    for (const file of files) {
      const source = strip(readFileSync(file, 'utf8'))
      for (const m of source.matchAll(/\b(fetch\w*|sendBeacon|EventSource|WebSocket|importScripts)\s*\(\s*['"`](https?:|wss?:|\/\/)/g)) found.push(`${rel(file)}: ${m[0]}`)
    }
    expect(found.sort()).toEqual(["evaluation/download-model.mjs: fetch(`https:", "scripts/prepare-semantic.mjs: fetch(`https:"])
  })

  it('no repository code names an outside AI service or its API key, comments included', () => {
    const found = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8').toLowerCase()
      for (const name of BANNED_NAMES) if (source.includes(name.toLowerCase())) found.push(`${rel(file)}: ${name}`)
    }
    // The app's own "What runs where" entry states that no remote model is used; it names them to say so.
    expect(found.filter(hit => !hit.startsWith('src/content/runtimeManifest.js: '))).toEqual([])
    expect(found.filter(hit => hit.startsWith('src/content/runtimeManifest.js: ')).sort()).toEqual(['src/content/runtimeManifest.js: openai'])
  })

  it('the old evaluation copy, the taxonomy service and its settings are gone', () => {
    for (const gone of ['resources/eval', 'src/taxonomy/externalService.js', 'src/taxonomy/config.js']) expect(existsSync(path.join(ROOT, gone)), gone).toBe(false)
    const settings = ['.env.example', 'render.yaml', 'vercel.json', 'public/_headers', 'public/_redirects',
      ...readdirSync(path.join(ROOT, '.github/workflows')).map(f => `.github/workflows/${f}`)]
    for (const file of settings.filter(f => existsSync(path.join(ROOT, f)))) {
      expect(readFileSync(path.join(ROOT, file), 'utf8'), file).not.toMatch(/VITE_SSCO_ENABLED|VITE_OCCUPATION_TAXONOMY_ENDPOINT/)
    }
  })

  it('catches a new outside call or host anywhere in the repository (self-test on samples)', () => {
    const plain = scanRepoSource('scripts/zz-sample.mjs', "await fetch('https://example.com')")
    expect(plain.calls.filter(hit => !callAllowed(hit))).toEqual([{ file: 'scripts/zz-sample.mjs', primitive: 'fetch', count: 1 }])
    expect(plain.hosts.filter(hit => !hostAllowed(hit))).toEqual([{ file: 'scripts/zz-sample.mjs', host: 'example.com' }])
    const aliased = scanRepoSource('eval/zz-sample.mjs', 'export const run=({fetchImpl=globalThis.fetch}={})=>fetchImpl(url)')
    expect(aliased.calls).toEqual([{ file: 'eval/zz-sample.mjs', primitive: 'fetch', count: 2 }])
    expect(scanRepoSource('resources/zz.mjs', 'new XMLHttpRequest(); navigator.sendBeacon(u); new WebSocket(u); new EventSource(u)').calls.map(hit => hit.primitive).sort())
      .toEqual(['EventSource', 'WebSocket', 'XMLHttpRequest', 'sendBeacon'])
    // An allowed host is only allowed in the files named for it; a link in a comment is documentation.
    expect(hostAllowed({ file: 'src/App.jsx', host: 'huggingface.co' })).toBe(false)
    expect(scanRepoSource('src/x.js', '// see https://example.com/docs\nexport const x=1').hosts).toEqual([])
    // One more call in an allowlisted file changes its count, so it is caught too.
    expect(callAllowed({ file: 'scripts/prepare-semantic.mjs', primitive: 'fetch', count: 2 })).toBe(false)
  })
})

describe('runtime manifest: what runs where', () => {
  const REQUIRED = ['transcript-reading', 'course-mapping', 'evidence-levels', 'matching', 'project-suggestion', 'embeddings',
    'local-save', 'encrypted-backup', 'share-link', 'credential-verification', 'pilot-feedback', 'accounts']

  it('lists every feature the task names, once', () => {
    const ids = RUNTIME_MANIFEST.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of REQUIRED) expect(ids).toContain(id)
  })

  it('nothing runs on a server: only "browser" or "not-built"', () => {
    for (const item of RUNTIME_MANIFEST) expect(['browser', 'not-built'], item.id).toContain(item.runsIn)
  })

  it('accounts, central storage and external AI are listed as not built', () => {
    for (const id of ['accounts', 'central-storage', 'external-ai']) expect(RUNTIME_MANIFEST.find(item => item.id === id)?.runsIn).toBe('not-built')
  })

  it('every entry is complete in Arabic and English, and its code exists', () => {
    for (const item of RUNTIME_MANIFEST) {
      for (const key of ['name', 'does', 'data']) for (const lang of ['ar', 'en']) expect(item[key][lang]?.trim(), `${item.id}.${key}.${lang}`).toBeTruthy()
      for (const file of item.code) expect(existsSync(path.join(ROOT, file)), `${item.id}: ${file}`).toBe(true)
      if (item.runsIn === 'browser') expect(item.code.length, item.id).toBeGreaterThan(0)
    }
  })
})

describe('the "What runs where" page matches the manifest', async () => {
  const { runsWherePage } = await import('../scripts/runs-where-page.mjs')
  const { footerItems } = await import('../public/site-content.js')
  for (const lang of ['ar', 'en']) {
    it(`${lang}: one row per built feature and one item per feature that is not built`, () => {
      const [title, lead, body] = runsWherePage(lang)
      expect(title).toBe(lang === 'ar' ? 'ما الذي يعمل وأين' : 'What runs where')
      expect(lead).toBeTruthy()
      for (const item of RUNTIME_MANIFEST) {
        expect(body, item.id).toContain(`data-feature="${item.id}" data-runs-in="${item.runsIn}"`)
        expect(body, item.id).toContain(item.name[lang].replaceAll('&', '&amp;').replaceAll('<', '&lt;'))
      }
      expect(body.match(/data-feature=/g)).toHaveLength(RUNTIME_MANIFEST.length)
      expect(body).not.toMatch(/data-runs-in="server"/)
    })
  }
  it('is linked from the footer of every public page', () => {
    expect(footerItems.map(([file]) => file)).toContain('runs-where.html')
  })
})

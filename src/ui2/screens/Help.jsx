// Task 68 · Help: one short page of links, reached from Profile and from the footer (Home and Help). Loads on its own
// (lazy, from AppNext.jsx). Read about KAMIN: How KAMIN works (guide.html), About, Privacy policy, What runs where, Test
// results and Contact, each the public page in the interface's language (pageHref, public/site-content.js), opened in
// the same tab so Back returns here. Then Reviewer tools, with one line saying they are for reviewers: the knowledge
// explorer and the pathway search by meaning (the local MiniLM model). Each opens a sub-page at ?app=help#<tool> (the
// same address rule as Settings' sections, Task 67) holding the old interface's component, unchanged and loaded when
// opened: KnowledgeWorkspace.jsx and SemanticRecall.jsx (its own consent before any download stays as it is).
// Nothing here explains how KAMIN works: the pages do; the main screens never do (Task 68).
import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, FileCheck2, MessageSquareText, Monitor, Network, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { pageHref } from '../../../public/site-content.js'
import { replaceUrl, urlWithApp } from '../../utils/useAppHistory.js'
import { HELP_PAGES, HELP_SECTIONS, VIEW_TEXT, helpSectionFromHash } from '../views.js'
import { nextCopy } from '../copy.js'
import { followLink } from '../NavTabs.jsx'
import '../help.css'

// The reviewer tools: the old interface's components, each loaded when its sub-page opens.
const KnowledgeWorkspace = lazy(() => import('../../components/KnowledgeWorkspace.jsx'))
const SemanticRecall = lazy(() => import('../../components/SemanticRecall.jsx'))

export const PAGE_ICONS = Object.freeze({ guide: BookOpen, about: Users, privacy: ShieldCheck, 'runs-where': Monitor, tests: FileCheck2, contact: MessageSquareText })
export const TOOL_ICONS = Object.freeze({ knowledge: Network, pathways: Sparkles })
// The address of a reviewer tool's sub-page (?app=help#knowledge), from the current address (language and switch kept).
export const toolHref = tool => `${urlWithApp('help', { keepHash: false })}#${tool}`

function HelpRow({ icon: Icon, label, href, onClick, testId }) {
  return <a className="ui2-help-row" href={href} onClick={onClick} data-testid={testId}>
    <Icon size={18} aria-hidden="true"/>
    <span className="ui2-help-row-label">{label}</span>
    <ChevronDown size={16} className="ui2-help-row-open" aria-hidden="true"/>
  </a>
}

// `entry`: { tool }, a reviewer tool to open at once (the footer's links; a new object each time); otherwise the
// address names it.
export default function Help({ lang, profile, focusHeading, entry = null, onNavigate }) {
  const w = nextCopy(lang).help
  const id = useId()
  const { state, derived } = profile
  const [section, setSection] = useState(() => entry?.tool || helpSectionFromHash(globalThis.location?.hash))
  const heading = useRef(null)
  const title = useRef(null)
  const page = useRef(null)
  // As in Settings: the tool this page added a history entry for (Back from it is the list), and the row to focus again.
  const pushedFor = useRef(null)
  const lastRow = useRef(null)
  const firstRender = useRef(true)
  // Back from a tool returns focus to the row that opened it; otherwise a tool's title, or the page heading. (Back also
  // sets focusHeading, sometimes in a later render than the section's own change, so both effects use the same rule.)
  const rowOf = tool => tool && page.current?.querySelector(`.ui2-help-row[data-testid="ui2-help-${tool}"]`)
  const focusTarget = () => (!section && rowOf(lastRow.current)) || title.current || heading.current
  useEffect(() => { if (focusHeading) focusTarget()?.focus() }, [focusHeading]) // eslint-disable-line react-hooks/exhaustive-deps
  // The footer opens a tool while Help is already open: the same as a tap on its row.
  useEffect(() => { if (entry?.tool && entry.tool !== section) open(entry.tool) }, [entry]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onPop = () => setSection(helpSectionFromHash(location.hash))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const target = focusTarget()
    target?.focus()
    if (target !== rowOf(lastRow.current)) window.scrollTo?.(0, 0)
  }, [section])

  const open = tool => {
    lastRow.current = tool
    history.pushState(history.state, '', toolHref(tool))
    pushedFor.current = tool
    setSection(tool)
  }
  const close = () => {
    if (pushedFor.current === section) { history.back(); return }
    replaceUrl(location.pathname + location.search)
    setSection(null)
  }
  const loading = <p role="status">{nextCopy(lang).profile.loading}</p>
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft

  const tools = {
    knowledge: () => <KnowledgeWorkspace lang={lang} personalGraph={derived.personGraph} hasProfile={Boolean(state.approved || state.consents?.insight)} onStudent={() => onNavigate('profile')}/>,
    // "Inspect pathway and evidence" opens step 4, where every pathway and its reasons are ("Why these paths?").
    pathways: () => <SemanticRecall lang={lang} matches={derived.matches} onInspect={() => onNavigate('next')}/>,
  }

  // On a sub-page the page heading stays "Help" for screen readers; "Reviewer tools" is the title, and the tool's own
  // heading (the old component's) names it.
  return <section className="ui2-page ui2-help" aria-labelledby={section ? `${id}-title` : 'ui2-page-title'} data-view="help" data-section={section || undefined} data-testid="ui2-page" ref={page}>
    {section && <button type="button" className="ui2-text-btn ui2-help-back" onClick={close}><Back size={16} aria-hidden="true"/>{w.back}</button>}
    <h1 id="ui2-page-title" tabIndex={-1} ref={heading} className={section ? 'ui2-vh' : undefined}>{VIEW_TEXT.help.title[lang]}</h1>
    {section ? <div className="ui2-help-section" data-testid="ui2-help-section">
      <h2 id={`${id}-title`} className="ui2-help-title" tabIndex={-1} ref={title}>{w.reviewerTitle}</h2>
      <p className="ui2-help-note">{w.reviewerLine}</p>
      <div className="ui2-legacy ui2-help-legacy"><Suspense fallback={loading}>{tools[section]()}</Suspense></div>
    </div> : <>
      <p>{VIEW_TEXT.help.line[lang]}</p>
      <section className="ui2-help-group" aria-labelledby={`${id}-pages`}>
        <h2 id={`${id}-pages`}>{w.pagesTitle}</h2>
        <ul className="ui2-help-list">{HELP_PAGES.map(([page, file]) => <li key={page}>
          <HelpRow icon={PAGE_ICONS[page]} label={w.pages[page]} href={pageHref(file, lang)} testId={`ui2-help-${page}`}/>
        </li>)}</ul>
      </section>
      <section className="ui2-help-group" aria-labelledby={`${id}-tools`} data-testid="ui2-reviewer-tools">
        <h2 id={`${id}-tools`}>{w.reviewerTitle}</h2>
        <p className="ui2-help-note">{w.reviewerLine}</p>
        <ul className="ui2-help-list">{HELP_SECTIONS.map(tool => <li key={tool}>
          <HelpRow icon={TOOL_ICONS[tool]} label={w.tools[tool]} href={toolHref(tool)} onClick={event => followLink(event, () => open(tool))} testId={`ui2-help-${tool}`}/>
        </li>)}</ul>
      </section>
    </>}
  </section>
}

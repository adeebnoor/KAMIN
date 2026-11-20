// Task 68 · the new interface's footer, on Home and Help only (never in the four steps of the flow): Help, then the same
// public pages Help lists (How KAMIN works, About, Privacy policy, What runs where, Test results, Contact) and the two
// reviewer tools. One line on desktop, a compact list on phones (src/ui2/footer.css). The public pages are written
// with pageHref (public/site-content.js), so each opens in the interface's language; Help and the tools are real links
// to ?app=help(#tool), and a plain click opens them in place (NavTabs.jsx followLink).
import { pageHref } from '../../public/site-content.js'
import { urlWithApp } from '../utils/useAppHistory.js'
import { HELP_PAGES, HELP_SECTIONS, VIEW_TEXT } from './views.js'
import { nextCopy } from './copy.js'
import { followLink } from './NavTabs.jsx'
import './footer.css'

export default function Footer({ lang, onNavigate, onTool }) {
  const w = nextCopy(lang).help
  const help = urlWithApp('help', { keepHash: false })
  return <footer className="ui2-footer" data-testid="ui2-footer">
    <nav aria-label={w.footer}>
      <ul className="ui2-footer-links">
        <li><a href={help} onClick={event => followLink(event, () => onNavigate('help'))}>{VIEW_TEXT.help.title[lang]}</a></li>
        {HELP_PAGES.map(([page, file]) => <li key={page}><a href={pageHref(file, lang)}>{w.pages[page]}</a></li>)}
        <li className="ui2-footer-note">{w.reviewerShort}</li>
        {HELP_SECTIONS.map(tool => <li key={tool}><a href={`${help}#${tool}`} onClick={event => followLink(event, () => onTool(tool))}>{w.tools[tool]}</a></li>)}
      </ul>
    </nav>
  </footer>
}

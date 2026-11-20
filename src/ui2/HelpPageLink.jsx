// Task 68 · a "Why?" sheet's link to the matching Help page ("Read more: How KAMIN works"): the public page in the
// interface's language (pageHref), opened in a new tab so the step the student is on (a project being written, a goal
// being chosen) stays as it is. `page` is one of Help's pages (HELP_PAGES in views.js).
import { pageHref } from '../../public/site-content.js'
import { HELP_PAGES } from './views.js'
import { fillIn, nextCopy } from './copy.js'

export default function HelpPageLink({ lang, page }) {
  const w = nextCopy(lang).help
  const file = HELP_PAGES.find(([id]) => id === page)[1]
  return <p className="ui2-help-link" data-testid="ui2-why-help">
    <a href={pageHref(file, lang)} target="_blank" rel="noreferrer">{fillIn(w.more, { page: w.pages[page] })}</a>
  </p>
}

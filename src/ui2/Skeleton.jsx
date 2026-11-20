// Task 60 · skeleton loading: grey bars in the shape of the page while a screen loads, instead of a spinner.
// Screen readers hear one short "Loading…".
export default function Skeleton({ lang = 'ar', lines = 3 }) {
  return <div className="ui2-skeleton" role="status" data-testid="ui2-skeleton">
    <span className="ui2-vh">{lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</span>
    {Array.from({ length: lines + 1 }, (_, i) => <span key={i} aria-hidden="true"/>)}
  </div>
}

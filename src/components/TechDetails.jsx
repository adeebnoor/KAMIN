// Task 12 · technical terms live here only: a closed "Technical details" block under plain text.
// Task 28: an optional className keeps a block's own layout (e.g. the RDF table under "Show connections").
export default function TechDetails({ lang, className = '', children }) {
  return <details className={`tech-details${className ? ` ${className}` : ''}`}><summary>{lang === 'ar' ? 'تفاصيل تقنية' : 'Technical details'}</summary><div>{children}</div></details>
}

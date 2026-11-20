// Task 60 · a chip: a short label (a step number, a tag), or a choice that is on or off when it has onClick.
export default function Chip({ children, selected, onClick, ...rest }) {
  if (!onClick) return <span className="ui2-chip" {...rest}>{children}</span>
  return <button type="button" className="ui2-chip" aria-pressed={selected === undefined ? undefined : !!selected} onClick={onClick} {...rest}>{children}</button>
}
